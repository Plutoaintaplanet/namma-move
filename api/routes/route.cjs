// api/routes/route.cjs — Super-Query Optimized for Vercel (4 vCPU / 8GB)
const express = require("express");
const { getSession } = require("../db.cjs");
const router = express.Router();

// ── Math helpers ──────────────────────────────────────────────────────────────
const WALK_SPD = 78;
function walkMin(m) { return Math.max(1, Math.round(m / WALK_SPD)); }
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3, r = d => d * Math.PI / 180;
    const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function nextDep(rt, base) {
    const h = base.getHours(), m = base.getMinutes();
    const inSvc = rt === 1 ? (h >= 5 && (h < 22 || (h === 22 && m < 30))) : (h >= 5 && h < 23);
    if (!inSvc) return null;
    const peak = (h >= 7 && h < 10) || (h >= 17 && h < 20);
    const freq = rt === 1 ? (peak ? 6 : 10) : (peak ? 8 : 15);
    const d = new Date(base); d.setMinutes(d.getMinutes() + (freq - (m % freq)) % freq);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fare(rt, hops) {
    if (rt === 1) return 45; if (hops <= 3) return 7; if (hops <= 8) return 10; if (hops <= 14) return 15; return 20;
}

async function runRead(cypher, params = {}) {
    const s = getSession();
    try {
        const r = await s.executeRead(tx => tx.run(cypher, params));
        return r.records;
    } finally { await s.close(); }
}

async function nearbyStops(lat, lon, radius = 3000) {
    const cypher = `
        MATCH (s:Stop)
        WHERE point.distance(s.pos, point({latitude: $lat, longitude: $lon})) < $radius
        RETURN s.id AS id, s.name AS name, s.lat AS lat, s.lon AS lon, s.type AS type, 
               point.distance(s.pos, point({latitude: $lat, longitude: $lon})) AS dist
        ORDER BY dist
        LIMIT 40
    `;
    const recs = await runRead(cypher, { lat, lon, radius });
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
    const { fromLat, fromLon, toLat, toLon, time } = req.query;
    if (!fromLat || !fromLon || !toLat || !toLon)
        return res.status(400).json({ error: "Coordinates required" });

    const fLat = parseFloat(fromLat), fLon = parseFloat(fromLon);
    const tLat = parseFloat(toLat), tLon = parseFloat(toLon);
    const baseTime = time ? (() => { const [h, m] = time.split(":"); const d = new Date(); d.setHours(+h, +m, 0, 0); return d; })() : new Date();

    const distM = haversine(fLat, fLon, tLat, tLon), km = distM / 1000;
    const cab = {
        km: km.toFixed(1),
        autoFare: km <= 1.9 ? 30 : Math.round(30 + (km - 1.9) * 15),
        autoMin: Math.max(5, Math.round(km / 24 * 60)),
        cabFare: Math.max(60, Math.round(km * 14)),
        cabMin: Math.max(5, Math.round(km / 21 * 60)),
        bikeFare: Math.max(30, Math.round(km * 8)),
        bikeMin: Math.max(4, Math.round(km / 30 * 60)),
    };

    try {
        const [allO, allD] = await Promise.all([nearbyStops(fLat, fLon), nearbyStops(tLat, tLon)]);
        
        // Use a focused set of stops for the batch query
        const oStops = [...allO.filter(s => s.type === 'metro').slice(0, 3), ...allO.filter(s => s.type !== 'metro').slice(0, 6)];
        const dStops = [...allD.filter(s => s.type === 'metro').slice(0, 3), ...allD.filter(s => s.type !== 'metro').slice(0, 6)];
        const oIds = oStops.map(s => s.id);
        const dIds = dStops.map(s => s.id);

        // ── THE SUPER QUERY ──
        // Finds all paths between all nearby stops in ONE round-trip
        const cypher = `
            MATCH (a:Stop), (b:Stop)
            WHERE a.id IN $oIds AND b.id IN $dIds AND a.id <> b.id
            MATCH path = shortestPath((a)-[:CONNECTS*1..60]-(b))
            WITH path, a, b,
                 reduce(t=0.0, r IN relationships(path) | t + coalesce(r.travel_min, 2.0)) AS totalMin,
                 [r IN relationships(path) | { id: r.route_id, name: r.route_name, type: r.route_type }] AS segments,
                 [n IN nodes(path) | { id: n.id, name: n.name, lat: n.lat, lon: n.lon, type: n.type }] AS nodeList
            RETURN a.id AS oId, b.id AS dId, segments, nodeList, totalMin
            ORDER BY totalMin ASC
            LIMIT 15
        `;
        
        const routeRecs = await runRead(cypher, { oIds, dIds });
        
        let bestBus = null, bestMetro = null, bestCombo = null;

        for (const rec of routeRecs) {
            const oId = rec.get("oId"), dId = rec.get("dId");
            const segments = rec.get("segments"), nodeList = rec.get("node_list");
            const pathMin = rec.get("totalMin");

            const oS = oStops.find(s => s.id === oId);
            const dS = dStops.find(s => s.id === dId);

            // Reconstruct legs from segments
            const legs = [];
            let cur = { 
                mode: segments[0].type === 1 ? 'metro' : 'bus',
                route: { id: segments[0].id, name: segments[0].name, type: segments[0].type },
                stops: [nodeList[0], nodeList[1]]
            };
            for (let i = 1; i < segments.length; i++) {
                if (segments[i].id === cur.route.id) {
                    cur.stops.push(nodeList[i + 1]);
                } else {
                    legs.push(cur);
                    cur = {
                        mode: segments[i].type === 1 ? 'metro' : 'bus',
                        route: { id: segments[i].id, name: segments[i].name, type: segments[i].type },
                        stops: [nodeList[i], nodeList[i + 1]]
                    };
                }
            }
            legs.push(cur);

            const types = legs.map(l => l.mode);
            const cls = types.includes("metro") && types.includes("bus") ? "combo" : types.includes("metro") ? "metro" : "bus";
            const totalMins = walkMin(oS.dist) + pathMin + walkMin(dS.dist);
            const tf = legs.reduce((s, l) => s + fare(l.route.type, l.stops.length - 1), 0);
            const arr = new Date(baseTime.getTime() + totalMins * 60000);

            const entry = {
                cls, type: legs.length > 1 ? "interchange" : "direct",
                legs, hops: nodeList.length - 1, totalMins: Math.round(totalMins), fare: tf,
                depart: baseTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                arrive: arr.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                nextDep: nextDep(legs[0].route.type, baseTime),
                oStop: { ...oS, walkMin: walkMin(oS.dist) },
                dStop: { ...dS, walkMin: walkMin(dS.dist) },
            };

            if (cls === "bus" && (!bestBus || totalMins < bestBus.totalMins)) bestBus = entry;
            if (cls === "metro" && (!bestMetro || totalMins < bestMetro.totalMins)) bestMetro = entry;
            if (cls === "combo" && (!bestCombo || totalMins < bestCombo.totalMins)) bestCombo = entry;
        }

        res.json({ bus: bestBus, metro: bestMetro, combo: bestCombo, cab });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
