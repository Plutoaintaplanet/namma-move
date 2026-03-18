// api/routes/route.cjs — Robust Multi-modal Routing
const express = require("express");
const { getSession } = require("../db.cjs");
const router = express.Router();
const DB = process.env.NEO4J_DATABASE || "neo4j";

const WALK_SPD = 78; 
function walkMin(m) { return Math.max(1, Math.round(m / WALK_SPD)); }

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3, r = d => d * Math.PI / 180;
    const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function runRead(cypher, params = {}) {
    const session = getSession();
    try {
        const r = await session.executeRead(tx => tx.run(cypher, params));
        return r.records;
    } finally { await session.close(); }
}

async function nearbyStops(lat, lon) {
    // Increased range: Metro 10km, Bus 3.5km
    const cypher = `
        MATCH (s:Stop)
        WHERE point.distance(s.pos, point({latitude: $lat, longitude: $lon})) < 10000
        WITH s, point.distance(s.pos, point({latitude: $lat, longitude: $lon})) AS dist
        ORDER BY dist
        WITH collect({id: s.id, name: s.name, lat: s.lat, lon: s.lon, type: s.type, dist: dist}) as allStops
        RETURN 
            [x IN allStops WHERE x.type = 'metro'][0..5] as metros,
            [x IN allStops WHERE x.type = 'bus' AND x.dist < 3500][0..15] as buses
    `;
    const recs = await runRead(cypher, { lat, lon });
    if (!recs.length) return { metros: [], buses: [] };
    return {
        metros: recs[0].get("metros") || [],
        buses: recs[0].get("buses") || []
    };
}

function processLegs(nodeList, segments) {
    if (!segments.length) return [];
    const legs = [];
    let currentLeg = null;
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const fromNode = nodeList[i];
        const toNode = nodeList[i+1];
        
        if (currentLeg && currentLeg.route?.id === seg.route_id) {
            currentLeg.stops.push(toNode);
            currentLeg.duration += seg.travel_min;
        } else {
            if (currentLeg) legs.push(currentLeg);
            currentLeg = { 
                mode: seg.route_type === 1 ? 'metro' : 'bus', 
                route: { id: seg.route_id, name: seg.route_name, type: seg.route_type }, 
                duration: seg.travel_min, 
                stops: [fromNode, toNode] 
            };
        }
    }
    if (currentLeg) legs.push(currentLeg);
    return legs;
}

router.get("/", async (req, res) => {
    const { fromLat, fromLon, toLat, toLon, time } = req.query;
    if (!fromLat || !fromLon || !toLat || !toLon) return res.status(400).json({ error: "Coords missing" });

    const fLat = parseFloat(fromLat), fLon = parseFloat(fromLon);
    const tLat = parseFloat(toLat), tLon = parseFloat(toLon);
    const baseTime = time ? (() => { const [h, m] = time.split(":"); const d = new Date(); d.setHours(+h, +m, 0, 0); return d; })() : new Date();

    try {
        const [oData, dData] = await Promise.all([nearbyStops(fLat, fLon), nearbyStops(tLat, tLon)]);
        
        const oAllIds = [...oData.metros, ...oData.buses].map(s => s.id);
        const dAllIds = [...dData.metros, ...dData.buses].map(s => s.id);

        const distKm = haversine(fLat, fLon, tLat, tLon) / 1000;
        const cabFare = Math.round(100 + distKm * 18);
        const autoFare = Math.round(30 + distKm * 15);

        if (oAllIds.length === 0 || dAllIds.length === 0) {
            return res.json({ routes: [], cab: { km: distKm.toFixed(1), cabFare, autoFare } });
        }

        // Try to find more paths to identify different categories
        const cypher = `
            MATCH (a:Stop), (b:Stop)
            WHERE a.id IN $oAllIds AND b.id IN $dAllIds AND a.id <> b.id
            MATCH path = shortestPath((a)-[:CONNECTS*1..60]->(b))
            RETURN a.id as oId, b.id as dId,
                   [r IN relationships(path) | { 
                       route_id: r.routeId, 
                       route_name: r.routeName, 
                       route_type: r.routeType, 
                       travel_min: coalesce(r.travelMin, 3.5) 
                   }] AS segments,
                   [n IN nodes(path) | {id: n.id, name: n.name, lat: n.lat, lon: n.lon, type: n.type}] AS node_list,
                   reduce(s = 0.0, r IN relationships(path) | s + coalesce(r.travelMin, 3.5)) as totalMin
            LIMIT 30
        `;

        const recs = await runRead(cypher, { oAllIds, dAllIds });
        const results = [];

        for (const row of recs) {
            const oId = row.get("oId");
            const dId = row.get("dId");
            const segments = row.get("segments");
            const nodeList = row.get("node_list");
            const routeMin = row.get("totalMin");

            const oS = [...oData.metros, ...oData.buses].find(s => s.id === oId);
            const dS = [...dData.metros, ...dData.buses].find(s => s.id === dId);
            if (!oS || !dS) continue;

            const legs = processLegs(nodeList, segments);
            const walkTime = walkMin(oS.dist) + walkMin(dS.dist);
            const totalMins = walkTime + routeMin;
            
            const hasMetro = legs.some(l => l.mode === 'metro');
            const hasBus = legs.some(l => l.mode === 'bus');
            const cls = (hasMetro && hasBus) ? "combo" : hasMetro ? "metro" : "bus";
            
            const arrive = new Date(baseTime.getTime() + totalMins * 60000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
            
            let fare = 0;
            legs.forEach(l => fare += (l.mode === 'metro' ? 25 : 15));

            results.push({
                legs, cls, totalMins: Math.round(totalMins),
                walkingMins: Math.round(walkTime),
                transitMins: Math.round(routeMin),
                fare: Math.min(fare, 70),
                depart: baseTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                arrive,
                oStop: { ...oS, walkMin: walkMin(oS.dist) },
                dStop: { ...dS, walkMin: walkMin(dS.dist) },
                interchanges: legs.length - 1,
                labels: []
            });
        }

        // Deduplicate and Label
        const seen = new Set();
        const deduped = results
            .filter(r => {
                const key = r.legs.map(l => l.route.id).join('-');
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .sort((a, b) => a.totalMins - b.totalMins);

        if (deduped.length > 0) {
            // Label Fastest
            deduped[0].labels.push("Fastest");

            // Label Best Metro (if not already fastest)
            const bestMetro = deduped.find(r => r.cls === 'metro');
            if (bestMetro && !bestMetro.labels.includes("Fastest")) bestMetro.labels.push("Only Metro");

            // Label Best Bus
            const bestBus = deduped.find(r => r.cls === 'bus');
            if (bestBus && !bestBus.labels.includes("Fastest")) bestBus.labels.push("Only BMTC");

            // Label Least Effort (fewest interchanges)
            const leastEffort = [...deduped].sort((a, b) => (a.interchanges + a.walkingMins) - (b.interchanges + b.walkingMins))[0];
            if (leastEffort && !leastEffort.labels.includes("Fastest")) leastEffort.labels.push("Effort Efficient");
        }

        const finalRoutes = deduped.slice(0, 10);

        res.json({
            routes: finalRoutes,
            cab: { km: distKm.toFixed(1), cabFare, autoFare, bikeFare: Math.round(20 + distKm * 10) }
        });

    } catch (e) {
        console.error("Routing Error:", e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
