// api/routes/route.cjs — Ported correctly for Vercel with high performance
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

// ── Optimized Spatial Search ──────────────────────────────────────────────────
async function nearbyStops(lat, lon) {
    // Separate queries for Metro and Bus to guarantee we see both
    const cypher = `
        MATCH (s:Stop)
        WHERE point.distance(s.pos, point({latitude: $lat, longitude: $lon})) < 8000
        WITH s, point.distance(s.pos, point({latitude: $lat, longitude: $lon})) AS dist
        ORDER BY dist
        WITH s.type as type, collect({id: s.id, name: s.name, lat: s.lat, lon: s.lon, type: s.type, dist: dist}) as stops
        RETURN 
            [x IN stops WHERE x.type = 'metro'][0..5] as metros,
            [x IN stops WHERE x.type = 'bus' AND x.dist < 2000][0..10] as buses
    `;
    const recs = await runRead(cypher, { lat, lon });
    if (!recs.length) return [];
    const m = recs[0].get("metros") || [], b = recs[0].get("buses") || [];
    return [...m, ...b];
}

async function findRoute(fromId, toId) {
    const recs = await runRead(
        `MATCH (a:Stop {id: $from}), (b:Stop {id: $to})
         MATCH path = shortestPath((a)-[:CONNECTS*1..60]-(b))
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
    const nodes = rec.get("nodeList"), segs = rec.get("segments"), totalMin = Number(rec.get("totalMin"));
    const legs = [];
    let cur = { 
        mode: segs[0].type === 1 ? 'metro' : 'bus',
        route: { id: segs[0].id, name: segs[0].name, type: segs[0].type }, 
        duration: 0,
        stops: [nodes[0], nodes[1]] 
    };
    for (let i = 1; i < segs.length; i++) {
        if (segs[i].id === cur.route.id) { cur.stops.push(nodes[i + 1]); }
        else { 
            legs.push(cur); 
            cur = { 
                mode: segs[i].type === 1 ? 'metro' : 'bus',
                route: { id: segs[i].id, name: segs[i].name, type: segs[i].type }, 
                duration: 0,
                stops: [nodes[i], nodes[i + 1]] 
            }; 
        }
    }
    legs.push(cur);
    const types = legs.map(l => l.mode);
    const cls = types.includes("metro") && types.includes("bus") ? "combo" : types.includes("metro") ? "metro" : "bus";
    return { legs, cls, totalMin, hops: nodes.length - 1 };
}

router.get("/", async (req, res) => {
    const { fromLat, fromLon, toLat, toLon, time } = req.query;
    if (!fromLat || !fromLon || !toLat || !toLon)
        return res.status(400).json({ error: "Missing coordinates" });

    const fLat = parseFloat(fromLat), fLon = parseFloat(fromLon);
    const tLat = parseFloat(toLat), tLon = parseFloat(toLon);
    const baseTime = time ? (() => { const [h, m] = time.split(":"); const d = new Date(); d.setHours(+h, +m, 0, 0); return d; })() : new Date();

    const km = haversine(fLat, fLon, tLat, tLon) / 1000;
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

        for (const oS of oStops) {
            for (const dS of dStops) {
                if (oS.id === dS.id) continue;
                const r = await findRoute(oS.id, dS.id);
                if (!r) continue;
                
                const total = walkMin(oS.dist) + r.totalMin + walkMin(dS.dist);
                const tf = r.legs.reduce((s, l) => s + fare(l.route.type, l.stops.length - 1), 0);
                const entry = {
                    cls: r.cls, legs: r.legs, totalMins: Math.round(total), fare: tf,
                    depart: baseTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                    arrive: new Date(baseTime.getTime() + total * 60000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                    nextDep: nextDep(r.legs[0].route.type, baseTime),
                    oStop: { ...oS, walkMin: walkMin(oS.dist) },
                    dStop: { ...dS, walkMin: walkMin(dS.dist) },
                };
                if (r.cls === "bus" && (!bestBus || total < bestBus.totalMins)) bestBus = entry;
                if (r.cls === "metro" && (!bestMetro || total < bestMetro.totalMins)) bestMetro = entry;
                if (r.cls === "combo" && (!bestCombo || total < bestCombo.totalMins)) bestCombo = entry;
            }
        }

        // Multi-modal fallback logic
        if (!bestCombo) {
            const mO = oStops.filter(s => s.type === 'metro'), mD = dStops.filter(s => s.type === 'metro'), bO = oStops.filter(s => s.type === 'bus');
            for (const busStart of bO) {
                for (const boardMetro of mO) {
                    const busLeg = await findRoute(busStart.id, boardMetro.id);
                    if (!busLeg || busLeg.cls !== "bus") continue;
                    for (const alightMetro of mD) {
                        if (boardMetro.id === alightMetro.id) continue;
                        const metroLeg = await findRoute(boardMetro.id, alightMetro.id);
                        if (!metroLeg || metroLeg.cls !== "metro") continue;
                        const total = walkMin(busStart.dist) + busLeg.totalMin + metroLeg.totalMin + walkMin(alightMetro.dist);
                        if (!bestCombo || total < bestCombo.totalMins) {
                            bestCombo = {
                                cls: "combo", type: "interchange", totalMins: Math.round(total), fare: 45,
                                legs: [...busLeg.legs, ...metroLeg.legs],
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
