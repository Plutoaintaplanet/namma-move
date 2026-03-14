// api/routes/route.cjs — Optimized for Speed & Metro Visibility
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

// ── Optimized Nearby Search (Always grabs Metro + Bus separately) ─────────────
async function nearbyStops(lat, lon) {
    // Spatial index (CREATE POINT INDEX) makes this near-instant
    const cypher = `
        MATCH (s:Stop)
        WHERE point.distance(s.pos, point({latitude: $lat, longitude: $lon})) < 4000
        WITH s, point.distance(s.pos, point({latitude: $lat, longitude: $lon})) AS dist
        ORDER BY dist
        WITH s.type as type, collect({id: s.id, name: s.name, lat: s.lat, lon: s.lon, type: s.type, dist: dist}) as stops
        RETURN 
            [x IN stops WHERE x.type = 'metro'][0..5] as metros,
            [x IN stops WHERE x.type = 'bus'][0..10] as buses
    `;
    const recs = await runRead(cypher, { lat, lon });
    if (!recs.length) return [];
    
    const metros = recs[0].get("metros") || [];
    const buses = recs[0].get("buses") || [];
    return [...metros, ...buses];
}

async function findRoute(fromId, toId) {
    const recs = await runRead(
        `MATCH (a:Stop {id: $from}), (b:Stop {id: $to})
         MATCH path = shortestPath((a)-[:CONNECTS*1..60]->(b))
         WITH path,
              reduce(t=0.0, r IN relationships(path) | t + coalesce(r.travel_min, 3.0)) AS totalMin,
              [r IN relationships(path) | { id: r.route_id, name: r.route_name, type: r.route_type }] AS segments,
              [n IN nodes(path) | {id:n.id, name:n.name, lat:n.lat, lon:n.lon, type: n.type}] AS nodeList
         RETURN nodeList, segments, totalMin
         ORDER BY totalMin LIMIT 1`,
        { from: fromId, to: toId }
    );
    if (!recs.length) return null;

    const rec = recs[0];
    const nodeList = rec.get("nodeList"), segments = rec.get("segments");
    const totalMin = Number(rec.get("totalMin"));

    const legs = [];
    let cur = { 
        mode: segments[0].type === 1 ? 'metro' : 'bus',
        route: { id: segments[0].id, name: segments[0].name, type: segments[0].type }, 
        duration: 0,
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
                duration: 0,
                stops: [nodeList[i], nodeList[i + 1]] 
            }; 
        }
    }
    legs.push(cur);

    const types = legs.map(l => l.mode);
    const cls = types.includes("metro") && types.includes("bus") ? "combo" : types.includes("metro") ? "metro" : "bus";
    return { legs, cls, totalMin, hops: nodeList.length - 1 };
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
        const [oStops, dStops] = await Promise.all([nearbyStops(fLat, fLon), nearbyStops(tLat, tLon)]);
        let bestBus = null, bestMetro = null, bestCombo = null;

        // Try to find direct or interchange paths between all nearby stop pairs
        for (const oS of oStops) {
            for (const dS of dStops) {
                if (oS.id === dS.id) continue;
                const r = await findRoute(oS.id, dS.id);
                if (!r) continue;
                
                const totalMins = walkMin(oS.dist) + r.totalMin + walkMin(dS.dist);
                const tf = r.legs.reduce((s, l) => s + fare(l.route.type, l.stops.length - 1), 0);
                const arr = new Date(baseTime.getTime() + totalMins * 60000);
                
                const entry = {
                    cls: r.cls, type: r.legs.length > 1 ? "interchange" : "direct",
                    legs: r.legs, hops: r.hops, totalMins: Math.round(totalMins), fare: tf,
                    depart: baseTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                    arrive: arr.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                    nextDep: nextDep(r.legs[0].route.type, baseTime),
                    oStop: { ...oS, walkMin: walkMin(oS.dist) },
                    dStop: { ...dS, walkMin: walkMin(dS.dist) },
                };

                if (r.cls === "bus" && (!bestBus || totalMins < bestBus.totalMins)) bestBus = entry;
                if (r.cls === "metro" && (!bestMetro || totalMins < bestMetro.totalMins)) bestMetro = entry;
                if (r.cls === "combo" && (!bestCombo || totalMins < bestCombo.totalMins)) bestCombo = entry;
            }
        }

        // ── Manual Bus-to-Metro combo fallback (if no direct paths found) ─────
        if (!bestCombo) {
            const mO = oStops.filter(s => s.type === 'metro');
            const mD = dStops.filter(s => s.type === 'metro');
            const bO = oStops.filter(s => s.type === 'bus');

            for (const busStart of bO) {
                for (const boardMetro of mO) {
                    const busPath = await findRoute(busStart.id, boardMetro.id);
                    if (!busPath || busPath.cls !== "bus") continue;

                    for (const alightMetro of mD) {
                        if (boardMetro.id === alightMetro.id) continue;
                        const metroPath = await findRoute(boardMetro.id, alightMetro.id);
                        if (!metroPath || metroPath.cls !== "metro") continue;

                        const total = walkMin(busStart.dist) + busPath.totalMin + metroPath.totalMin + walkMin(alightMetro.dist);
                        if (!bestCombo || total < bestCombo.totalMins) {
                            bestCombo = {
                                cls: "combo", type: "interchange", totalMins: Math.round(total), fare: 45,
                                legs: [...busPath.legs, ...metroPath.legs],
                                depart: baseTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                                arrive: new Date(baseTime.getTime() + total * 60000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                                oStop: { ...busStart, walkMin: walkMin(busStart.dist) },
                                dStop: { ...alightMetro, walkMin: walkMin(alightMetro.dist) }
                            };
                        }
                    }
                }
            }
        }

        res.json({ bus: bestBus, metro: bestMetro, combo: bestCombo, cab });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
