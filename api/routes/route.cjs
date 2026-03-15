// api/routes/route.cjs — Optimized for Vercel with batch processing
const express = require("express");
const { driver } = require("../db.cjs");
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
    const s = driver.session({ database: DB });
    try {
        const r = await s.executeRead(tx => tx.run(cypher, params));
        return r.records;
    } finally { await s.close(); }
}

async function nearbyStops(lat, lon) {
    // Metro range 8km, Bus range 2.5km
    const cypher = `
        MATCH (s:Stop)
        WHERE point.distance(s.pos, point({latitude: $lat, longitude: $lon})) < 8000
        WITH s, point.distance(s.pos, point({latitude: $lat, longitude: $lon})) AS dist
        ORDER BY dist
        WITH collect({id: s.id, name: s.name, lat: s.lat, lon: s.lon, type: s.type, dist: dist}) as allStops
        RETURN 
            [x IN allStops WHERE x.type = 'metro'][0..5] as metros,
            [x IN allStops WHERE x.type = 'bus' AND x.dist < 2500][0..10] as buses
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
    if (!fromLat || !fromLon || !toLat || !toLon)
        return res.status(400).json({ error: "Coordinates required" });

    const fLat = parseFloat(fromLat), fLon = parseFloat(fromLon);
    const tLat = parseFloat(toLat), tLon = parseFloat(toLon);
    const baseTime = time ? (() => { const [h, m] = time.split(":"); const d = new Date(); d.setHours(+h, +m, 0, 0); return d; })() : new Date();

    try {
        const [oData, dData] = await Promise.all([nearbyStops(fLat, fLon), nearbyStops(tLat, tLon)]);
        
        const oMetros = oData.metros.map(s => s.id);
        const dMetros = dData.metros.map(s => s.id);
        const oAll = [...oData.buses, ...oData.metros.slice(0, 2)].map(s => s.id);
        const dAll = [...dData.buses, ...dData.metros.slice(0, 2)].map(s => s.id);

        if (oAll.length === 0 || dAll.length === 0) {
            return res.json({ bus: null, metro: null, combo: null, cab: { km: (haversine(fLat, fLon, tLat, tLon) / 1000).toFixed(1) } });
        }

        const metroCypher = `
            MATCH (a:Stop), (b:Stop)
            WHERE a.id IN $oMetros AND b.id IN $dMetros AND a.id <> b.id
            MATCH path = (a)-[:CONNECTS*1..50]->(b)
            WHERE all(r IN relationships(path) WHERE r.route_type = 1)
            WITH path, a, b ORDER BY length(path) ASC
            WITH a, b, head(collect(path)) as path
            RETURN a.id as oId, b.id as dId,
                   [r IN relationships(path) | { route_id: r.route_id, route_name: r.route_name, route_type: r.route_type, travel_min: coalesce(r.travel_min, 2.5) }] AS segments,
                   [n IN nodes(path) | {id: n.id, name: n.name, lat: n.lat, lon: n.lon, type: n.type}] AS node_list,
                   reduce(s = 0.0, r IN relationships(path) | s + coalesce(r.travel_min, 2.5)) as totalMin
        `;

        const anyCypher = `
            MATCH (a:Stop), (b:Stop)
            WHERE a.id IN $oAll AND b.id IN $dAll AND a.id <> b.id
            MATCH path = shortestPath((a)-[:CONNECTS*1..50]->(b))
            RETURN a.id as oId, b.id as dId,
                   [r IN relationships(path) | { route_id: r.route_id, route_name: r.route_name, route_type: r.route_type, travel_min: coalesce(r.travel_min, 3.0) }] AS segments,
                   [n IN nodes(path) | {id: n.id, name: n.name, lat: n.lat, lon: n.lon, type: n.type}] AS node_list,
                   reduce(s = 0.0, r IN relationships(path) | s + coalesce(r.travel_min, 3.0)) as totalMin
        `;

        const [metroRecs, anyRecs] = await Promise.all([
            (oMetros.length && dMetros.length) ? runRead(metroCypher, { oMetros, dMetros }) : [],
            runRead(anyCypher, { oAll: oAll, dAll: dAll })
        ]);

        let bestBus = null, bestMetro = null, bestCombo = null;

        const processResults = (recs) => {
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
                if (!legs.length) continue;
                
                const types = legs.map(l => l.mode);
                const cls = types.includes("metro") && types.includes("bus") ? "combo" : types.includes("metro") ? "metro" : "bus";
                const totalMins = walkMin(oS.dist) + routeMin + walkMin(dS.dist);
                
                const arrive = new Date(baseTime.getTime() + totalMins * 60000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
                const fare = cls === "metro" ? 45 : (nodeList.length <= 5 ? 10 : 20);

                const entry = { 
                    legs, cls, totalMins: Math.round(totalMins), 
                    hops: nodeList.length - 1, fare, 
                    depart: baseTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }), 
                    arrive, 
                    oStop: { ...oS, walkMin: walkMin(oS.dist) }, 
                    dStop: { ...dS, walkMin: walkMin(dS.dist) } 
                };

                if (cls === "bus" && (!bestBus || totalMins < bestBus.totalMins)) bestBus = entry;
                if (cls === "metro" && (!bestMetro || totalMins < bestMetro.totalMins)) bestMetro = entry;
                if (cls === "combo" && (!bestCombo || totalMins < bestCombo.totalMins)) bestCombo = entry;
            }
        };

        processResults(metroRecs);
        processResults(anyRecs);

        res.json({
            bus: bestBus, metro: bestMetro, combo: bestCombo,
            cab: { km: (haversine(fLat, fLon, tLat, tLon) / 1000).toFixed(1) }
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
