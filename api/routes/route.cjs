// api/routes/route.cjs — Enhanced Routing with multi-modal support
const express = require("express");
const { driver } = require("../db.cjs");
const router = express.Router();
const DB = process.env.NEO4J_DATABASE || "neo4j";

// ── Math helpers ──────────────────────────────────────────────────────────────
const WALK_SPD = 75; // meters per minute
function walkMin(m) { return Math.max(1, Math.round(m / WALK_SPD)); }
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3, r = d => d * Math.PI / 180;
    const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Database Access ──────────────────────────────────────────────────────────
async function runRead(cypher, params = {}) {
    const s = driver.session({ database: DB });
    try {
        const r = await s.executeRead(tx => tx.run(cypher, params));
        return r.records;
    } finally { await s.close(); }
}

// ── Find nearby stops ────────────────────────────────────────────────────────
// Using Neo4j Point for high performance
async function nearbyStops(lat, lon, limit = 12) {
    const cypher = `
        MATCH (s:Stop)
        WITH s, point.distance(s.pos, point({latitude: $lat, longitude: $lon})) AS dist
        WHERE dist < 3000
        RETURN s.id AS id, s.name AS name, s.lat AS lat, s.lon AS lon, s.type AS type, dist
        ORDER BY dist
        LIMIT 50
    `;
    const recs = await runRead(cypher, { lat, lon });
    const all = recs.map(r => ({
        id: r.get("id"),
        name: r.get("name"),
        lat: r.get("lat"),
        lon: r.get("lon"),
        type: r.get("type"),
        dist: r.get("dist")
    }));

    // Ensure we get some of each if available
    const metros = all.filter(s => s.type === 'metro').slice(0, 4);
    const buses = all.filter(s => s.type === 'bus').slice(0, 8);
    
    // Combine and remove duplicates, sorted by distance
    const combined = [...metros, ...buses].sort((a,b) => a.dist - b.dist);
    return combined;
}

// ── Multi-modal Router ────────────────────────────────────────────────────────
async function findMultiModalRoute(fromId, toId) {
    const cypher = `
        MATCH (a:Stop {id: $from}), (b:Stop {id: $to})
        MATCH path = shortestPath((a)-[:CONNECTS|TRANSFER*1..100]-(b))
        WITH path,
             [r IN relationships(path) | {
                 type: type(r),
                 route_id: r.route_id,
                 route_name: r.route_name,
                 route_type: r.route_type,
                 travel_min: coalesce(r.travel_min, r.walk_min, 1.0),
                 from_id: startNode(r).id,
                 to_id: endNode(r).id
             }] AS segments,
             [n IN nodes(path) | {id: n.id, name: n.name, lat: n.lat, lon: n.lon, type: n.type}] AS node_list
        RETURN segments, node_list
    `;
    const recs = await runRead(cypher, { from: fromId, to: toId });
    if (!recs.length) return null;

    const segments = recs[0].get("segments");
    const nodeList = recs[0].get("node_list");

    // Process segments into legs
    const legs = [];
    let totalMin = 0;
    
    if (segments.length === 0) return null;

    let currentLeg = null;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        // Shortest path node list is always node[i] -- relationship[i] -- node[i+1]
        // BUT because relationship is undirected in MATCH, we must check which node is which
        const fromNode = nodeList[i];
        const toNode = nodeList[i+1];
        
        totalMin += seg.travel_min;

        if (seg.type === 'TRANSFER') {
            if (currentLeg) {
                legs.push(currentLeg);
                currentLeg = null;
            }
            legs.push({
                mode: 'walk',
                duration: Math.round(seg.travel_min),
                from: fromNode.name,
                to: toNode.name,
                stops: [fromNode, toNode]
            });
        } else {
            // Mode is CONNECTS (Transit)
            if (currentLeg && currentLeg.route?.id === seg.route_id) {
                currentLeg.stops.push(toNode);
                currentLeg.duration += seg.travel_min;
            } else {
                if (currentLeg) legs.push(currentLeg);
                currentLeg = {
                    mode: seg.route_type === 1 ? 'metro' : 'bus',
                    route: { id: seg.route_id, name: seg.route_name },
                    duration: seg.travel_min,
                    stops: [fromNode, toNode]
                };
            }
        }
    }
    if (currentLeg) legs.push(currentLeg);

    const types = legs.map(l => l.mode);
    const cls = types.includes("metro") && types.includes("bus") ? "combo" : types.includes("metro") ? "metro" : "bus";

    // Simple estimation for UI requirements
    const now = new Date();
    const depart = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const arrive = new Date(now.getTime() + totalMin * 60000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const fare = cls === "metro" ? 15 + (nodeList.length * 2) : 5 + (nodeList.length * 1.5);

    return {
        legs,
        cls,
        totalMin: Math.round(totalMin),
        hops: nodeList.length - 1,
        fare: Math.round(fare),
        depart,
        arrive,
        type: legs.length > 2 ? "interchange" : "direct"
    };
}

// ── Main handler ──────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
    const { fromLat, fromLon, toLat, toLon } = req.query;
    if (!fromLat || !fromLon || !toLat || !toLon)
        return res.status(400).json({ error: "Coordinates required" });

    const fLat = parseFloat(fromLat), fLon = parseFloat(fromLon);
    const tLat = parseFloat(toLat), tLon = parseFloat(toLon);

    try {
        const [oStops, dStops] = await Promise.all([
            nearbyStops(fLat, fLon, 10),
            nearbyStops(tLat, tLon, 10)
        ]);

        let bestBus = null, bestMetro = null, bestCombo = null;

        // Try combinations of nearby stops
        for (const oS of oStops) {
            for (const dS of dStops) {
                if (oS.id === dS.id) continue;
                const r = await findMultiModalRoute(oS.id, dS.id);
                if (!r) continue;

                const totalMins = walkMin(oS.dist) + r.totalMin + walkMin(dS.dist);
                const entry = {
                    ...r,
                    totalMins,
                    oStop: { ...oS, walkMin: walkMin(oS.dist) },
                    dStop: { ...dS, walkMin: walkMin(dS.dist) }
                };

                if (r.cls === "bus" && (!bestBus || totalMins < bestBus.totalMins)) bestBus = entry;
                if (r.cls === "metro" && (!bestMetro || totalMins < bestMetro.totalMins)) bestMetro = entry;
                if (r.cls === "combo" && (!bestCombo || totalMins < bestCombo.totalMins)) bestCombo = entry;
            }
        }

        // Return standardized format for frontend
        res.json({
            bus: bestBus, 
            metro: bestMetro,
            combo: bestCombo,
            best: bestBus || bestMetro || bestCombo,
            cab: {
                km: (haversine(fLat, fLon, tLat, tLon) / 1000).toFixed(1)
            }
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
