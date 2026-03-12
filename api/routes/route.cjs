// api/routes/route.cjs — Optimized for Vercel
const express = require("express");
const { getSession } = require("../db.cjs");
const router = express.Router();

const WALK_SPD = 75; 
function walkMin(m) { return Math.max(1, Math.round(m / WALK_SPD)); }

async function runRead(cypher, params = {}) {
    const s = getSession();
    try {
        const r = await s.executeRead(tx => tx.run(cypher, params));
        return r.records;
    } finally { await s.close(); }
}

async function nearbyStops(lat, lon) {
    const cypher = `
        MATCH (s:Stop)
        WHERE point.distance(s.pos, point({latitude: $lat, longitude: $lon})) < 5000
        OPTIONAL MATCH (s)-[r:CONNECTS]-()
        WITH s, point.distance(s.pos, point({latitude: $lat, longitude: $lon})) AS dist, count(r) as connections
        WHERE connections > 0 OR s.type = 'metro'
        RETURN s.id AS id, s.name AS name, s.lat AS lat, s.lon AS lon, s.type AS type, dist
        ORDER BY dist
        LIMIT 12
    `;
    const recs = await runRead(cypher, { lat, lon });
    return recs.map(r => ({
        id: r.get("id"),
        name: r.get("name"),
        lat: r.get("lat"),
        lon: r.get("lon"),
        type: r.get("type"),
        dist: r.get("dist")
    }));
}

router.get("/", async (req, res) => {
    const { fromLat, fromLon, toLat, toLon } = req.query;
    if (!fromLat || !fromLon || !toLat || !toLon)
        return res.status(400).json({ error: "Coordinates required" });

    const fLat = parseFloat(fromLat), fLon = parseFloat(fromLon);
    const tLat = parseFloat(toLat), tLon = parseFloat(toLon);

    try {
        const [oStops, dStops] = await Promise.all([
            nearbyStops(fLat, fLon),
            nearbyStops(tLat, tLon)
        ]);

        if (oStops.length === 0 || dStops.length === 0) {
            return res.json({ bus: null, metro: null, combo: null, cab: { km: "0.0" } });
        }

        const oIds = oStops.map(s => s.id);
        const dIds = dStops.map(s => s.id);

        // ── Optimized Single Cypher Query ──
        const cypher = `
            MATCH (a:Stop), (b:Stop)
            WHERE a.id IN $oIds AND b.id IN $dIds AND a.id <> b.id
            MATCH path = shortestPath((a)-[:CONNECTS|TRANSFER*1..50]-(b))
            WITH path, a, b,
                 [r IN relationships(path) | {
                     type: type(r),
                     route_id: r.route_id,
                     route_name: r.route_name,
                     route_type: r.route_type,
                     travel_min: coalesce(r.travel_min, r.walk_min, 1.0)
                 }] AS segments,
                 [n IN nodes(path) | {id: n.id, name: n.name, lat: n.lat, lon: n.lon, type: n.type}] AS node_list
            RETURN a.id as oId, b.id as dId, segments, node_list, 
                   reduce(s = 0.0, r IN relationships(path) | s + coalesce(r.travel_min, r.walk_min, 1.0)) as totalMin
            ORDER BY totalMin
            LIMIT 5
        `;

        const recs = await runRead(cypher, { oIds, dIds });

        let bestBus = null, bestMetro = null, bestCombo = null;

        for (const row of recs) {
            const oId = row.get("oId");
            const dId = row.get("dId");
            const segments = row.get("segments");
            const nodeList = row.get("node_list");
            const routeMin = row.get("totalMin");

            const oS = oStops.find(s => s.id === oId);
            const dS = dStops.find(s => s.id === dId);

            // Reconstruct legs
            const legs = [];
            let currentLeg = null;
            for (let i = 0; i < segments.length; i++) {
                const seg = segments[i];
                const fromNode = nodeList[i];
                const toNode = nodeList[i+1];
                if (seg.type === 'TRANSFER') {
                    if (currentLeg) { legs.push(currentLeg); currentLeg = null; }
                    legs.push({ mode: 'walk', duration: Math.round(seg.travel_min), from: fromNode.name, to: toNode.name, stops: [fromNode, toNode] });
                } else {
                    if (currentLeg && currentLeg.route?.id === seg.route_id) {
                        currentLeg.stops.push(toNode);
                        currentLeg.duration += seg.travel_min;
                    } else {
                        if (currentLeg) legs.push(currentLeg);
                        currentLeg = { mode: seg.route_type === 1 ? 'metro' : 'bus', route: { id: seg.route_id, name: seg.route_name }, duration: seg.travel_min, stops: [fromNode, toNode] };
                    }
                }
            }
            if (currentLeg) legs.push(currentLeg);

            const types = legs.map(l => l.mode);
            const cls = types.includes("metro") && types.includes("bus") ? "combo" : types.includes("metro") ? "metro" : "bus";
            const totalMins = walkMin(oS.dist) + routeMin + walkMin(dS.dist);
            
            const now = new Date();
            const depart = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
            const arrive = new Date(now.getTime() + totalMins * 60000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
            const fare = cls === "metro" ? 15 + (nodeList.length * 2) : 5 + (nodeList.length * 1.5);

            const entry = { legs, cls, totalMins: Math.round(totalMins), hops: nodeList.length - 1, fare: Math.round(fare), depart, arrive, oStop: { ...oS, walkMin: walkMin(oS.dist) }, dStop: { ...dS, walkMin: walkMin(dS.dist) }, type: legs.length > 2 ? "interchange" : "direct" };

            if (cls === "bus" && (!bestBus || totalMins < bestBus.totalMins)) bestBus = entry;
            if (cls === "metro" && (!bestMetro || totalMins < bestMetro.totalMins)) bestMetro = entry;
            if (cls === "combo" && (!bestCombo || totalMins < bestCombo.totalMins)) bestCombo = entry;
        }

        res.json({
            bus: bestBus, metro: bestMetro, combo: bestCombo,
            best: bestBus || bestMetro || bestCombo,
            cab: { km: (haversine(fLat, fLon, tLat, tLon) / 1000).toFixed(1) }
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3, r = d => d * Math.PI / 180;
    const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
