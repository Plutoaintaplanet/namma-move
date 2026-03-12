// routes/route.js  — GET /api/route?fromLat&fromLon&toLat&toLon&time
const express = require("express");
const { driver } = require("../db");
const router = express.Router();
const DB = process.env.NEO4J_DATABASE || "neo4j";

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

// ── Single read query ─────────────────────────────────────────────────────────
async function runRead(cypher, params = {}) {
    const s = driver.session({ database: DB });
    try {
        const r = await s.executeRead(tx => tx.run(cypher, params));
        return r.records;
    } finally { await s.close(); }
}

// ── Get ALL stops from Neo4j (cached after first call) ───────────────────────
let _stopsCache = null;
async function getAllStops() {
    if (_stopsCache) return _stopsCache;
    const recs = await runRead("MATCH (s:Stop)-[:CONNECTS]-() RETURN DISTINCT s.id AS id, s.name AS name, s.lat AS lat, s.lon AS lon, s.type AS type");
    _stopsCache = recs.map(r => ({ id: r.get("id"), name: r.get("name"), lat: r.get("lat"), lon: r.get("lon"), type: r.get("type") }));
    return _stopsCache;
}

// ── Find nearby stops using JS Haversine (avoids Neo4j float param issue) ────
const METRO_RADIUS_M = 2000; // walk up to 2km to reach a Metro station
const BUS_RADIUS_M = 1200; // keep bus stops within 1.2km
async function nearbyStops(lat, lon) {
    const all = await getAllStops();
    const sorted = all
        .map(s => ({ ...s, dist: haversine(lat, lon, s.lat, s.lon) }))
        .sort((a, b) => a.dist - b.dist);
    const buses = sorted.filter(s => s.type !== "metro" && s.dist <= BUS_RADIUS_M).slice(0, 6);
    const metros = sorted.filter(s => s.type === "metro" && s.dist <= METRO_RADIUS_M).slice(0, 3);
    // If no buses within radius, take the 5 closest regardless
    const fallbackBuses = buses.length ? buses : sorted.filter(s => s.type !== "metro").slice(0, 5);
    return [...fallbackBuses, ...metros].sort((a, b) => a.dist - b.dist);
}


// ── Find shortest path in Neo4j ───────────────────────────────────────────────
async function findRoute(fromId, toId) {
    const recs = await runRead(
        `MATCH (a:Stop {id: $from}), (b:Stop {id: $to})
     MATCH path = shortestPath((a)-[:CONNECTS*1..150]->(b))
     WITH path,
          reduce(t=0.0, r IN relationships(path) | t + r.travel_min) AS totalMin,
          [r IN relationships(path) | r.route_id]   AS routeIds,
          [r IN relationships(path) | r.route_name] AS routeNames,
          [r IN relationships(path) | r.route_type] AS routeTypes,
          [n IN nodes(path) | {id:n.id,name:n.name,lat:n.lat,lon:n.lon}] AS stops
     RETURN stops, routeIds, routeNames, routeTypes, totalMin
     ORDER BY totalMin LIMIT 1`,
        { from: fromId, to: toId }
    );
    if (!recs.length) return null;

    const rec = recs[0];
    const stops = rec.get("stops"), routeIds = rec.get("routeIds");
    const routeNames = rec.get("routeNames"), routeTypes = rec.get("routeTypes");
    const rawMin = rec.get("totalMin");
    const totalMin = (rawMin && typeof rawMin.toNumber === "function") ? rawMin.toNumber() : Number(rawMin);

    if (!routeIds.length) return null;

    // Group stops by route leg
    const legs = [];
    let cur = { route: { id: routeIds[0], name: routeNames[0], type: typeof routeTypes[0] === "object" ? routeTypes[0].toNumber() : routeTypes[0] }, stops: [stops[0], stops[1]] };
    for (let i = 1; i < routeIds.length; i++) {
        if (routeIds[i] === cur.route.id) { cur.stops.push(stops[i + 1]); }
        else { legs.push(cur); cur = { route: { id: routeIds[i], name: routeNames[i], type: typeof routeTypes[i] === "object" ? routeTypes[i].toNumber() : routeTypes[i] }, stops: [stops[i], stops[i + 1]] }; }
    }
    legs.push(cur);

    const types = legs.map(l => l.route.type === 1 ? "metro" : "bus");
    const cls = types.includes("metro") && types.includes("bus") ? "combo" : types.includes("metro") ? "metro" : "bus";
    return { legs, cls, totalMin, hops: stops.length - 1 };
}

// ── Main handler ──────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
    const { fromLat, fromLon, toLat, toLon, time } = req.query;
    if (!fromLat || !fromLon || !toLat || !toLon)
        return res.status(400).json({ error: "fromLat,fromLon,toLat,toLon required" });

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

        for (const oS of oStops.slice(0, 8)) {
            for (const dS of dStops.slice(0, 8)) {
                if (oS.id === dS.id) continue;
                const r = await findRoute(oS.id, dS.id);
                if (!r) continue;
                const oWalk = oS.dist, dWalk = dS.dist;
                const total = walkMin(oWalk) + r.totalMin + walkMin(dWalk);
                const tf = r.legs.reduce((s, l) => s + fare(l.route.type, l.stops.length - 1), 0);
                const arr = new Date(baseTime.getTime() + total * 60000);
                const entry = {
                    cls: r.cls, type: r.legs.length > 1 ? "interchange" : "direct",
                    legs: r.legs, hops: r.hops, totalMins: Math.round(total), fare: tf,
                    depart: baseTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                    arrive: arr.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                    nextDep: nextDep(r.legs[0].route.type, baseTime),
                    oStop: { id: oS.id, lat: oS.lat, lon: oS.lon, name: oS.name, walkMin: walkMin(oWalk) },
                    dStop: { id: dS.id, lat: dS.lat, lon: dS.lon, name: dS.name, walkMin: walkMin(dWalk) },
                };
                if (r.cls === "bus" && (!bestBus || total < bestBus.totalMins)) bestBus = entry;
                if (r.cls === "metro" && (!bestMetro || total < bestMetro.totalMins)) bestMetro = entry;
                if (r.cls === "combo" && (!bestCombo || total < bestCombo.totalMins)) bestCombo = entry;
            }
        }

        // ── Bus-to-Metro combo fallback ─────────────────────────────────────
        // If no combo found yet, try: bus from origin → nearest Metro stop → Metro to dest
        if (!bestCombo) {
            const all = await getAllStops();
            const metroStops = all.filter(s => s.type === "metro")
                .map(s => ({ ...s, distFromO: haversine(fLat, fLon, s.lat, s.lon) }))
                .sort((a, b) => a.distFromO - b.distFromO)
                .slice(0, 5);  // top 5 nearest Metro stations to origin

            const dMetros = all.filter(s => s.type === "metro")
                .map(s => ({ ...s, distFromD: haversine(tLat, tLon, s.lat, s.lon) }))
                .sort((a, b) => a.distFromD - b.distFromD)
                .slice(0, 5);  // top 5 nearest Metro stations to destination

            for (const busStop of oStops.filter(s => s.type !== "metro").slice(0, 5)) {
                for (const boardMetro of metroStops) {
                    // Try bus from origin stop → Metro boarding stop
                    const busLeg = await findRoute(busStop.id, boardMetro.id);
                    if (!busLeg || busLeg.cls !== "bus") continue;

                    for (const alightMetro of dMetros) {
                        if (boardMetro.id === alightMetro.id) continue;
                        // Try Metro from boarding → alighting
                        const metroLeg = await findRoute(boardMetro.id, alightMetro.id);
                        if (!metroLeg || metroLeg.cls !== "metro") continue;

                        const oWalk = busStop.dist;
                        const dWalk = alightMetro.distFromD;
                        const totalMins = walkMin(oWalk) + busLeg.totalMin + metroLeg.totalMin + walkMin(dWalk);
                        const tf = busLeg.legs.reduce((s, l) => s + fare(l.route.type, l.stops.length - 1), 0)
                            + metroLeg.legs.reduce((s, l) => s + fare(l.route.type, l.stops.length - 1), 0);
                        const arr = new Date(baseTime.getTime() + totalMins * 60000);
                        const comboEntry = {
                            cls: "combo", type: "interchange",
                            legs: [...busLeg.legs, ...metroLeg.legs],
                            hops: busLeg.hops + metroLeg.hops,
                            totalMins: Math.round(totalMins), fare: tf,
                            depart: baseTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                            arrive: arr.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                            nextDep: nextDep(0, baseTime),
                            oStop: { id: busStop.id, lat: busStop.lat, lon: busStop.lon, name: busStop.name, walkMin: walkMin(oWalk) },
                            dStop: { id: alightMetro.id, lat: alightMetro.lat, lon: alightMetro.lon, name: alightMetro.name, walkMin: walkMin(dWalk) },
                        };
                        if (!bestCombo || totalMins < bestCombo.totalMins) bestCombo = comboEntry;
                    }
                }
            }
        }

        res.json({ bus: bestBus, metro: bestMetro, combo: bestCombo, cab, from: { lat: fLat, lon: fLon }, to: { lat: tLat, lon: tLon } });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
