require("dotenv").config();
const { driver } = require("./db");

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3, r = d => d * Math.PI / 180;
    const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function walkMin(m) { return Math.max(1, Math.round(m / 78)); }
function nextDep(rt, base) { return "10:00 AM"; }
function fare(rt, hops) { return 15; }

async function runRead(cypher, params = {}) {
    const s = driver.session({ database: process.env.NEO4J_DATABASE || "neo4j" });
    try {
        const r = await s.executeRead(tx => tx.run(cypher, params));
        return r.records;
    } finally { await s.close(); }
}
let _stopsCache = null;
async function getAllStops() {
    if (_stopsCache) return _stopsCache;
    const recs = await runRead("MATCH (s:Stop) RETURN s.id AS id, s.name AS name, s.lat AS lat, s.lon AS lon, s.type AS type");
    _stopsCache = recs.map(r => ({ id: r.get("id"), name: r.get("name"), lat: r.get("lat"), lon: r.get("lon"), type: r.get("type") }));
    return _stopsCache;
}
async function nearbyStops(lat, lon) {
    const all = await getAllStops();
    const sorted = all
        .map(s => ({ ...s, dist: haversine(lat, lon, s.lat, s.lon) }))
        .sort((a, b) => a.dist - b.dist);
    const buses = sorted.filter(s => s.type !== "metro" && s.dist <= 1200).slice(0, 6);
    const metros = sorted.filter(s => s.type === "metro" && s.dist <= 2000).slice(0, 3);
    const fallbackBuses = buses.length ? buses : sorted.filter(s => s.type !== "metro").slice(0, 5);
    return [...fallbackBuses, ...metros].sort((a, b) => a.dist - b.dist);
}

async function findRoute(fromId, toId) {
    const recs = await runRead(
        `MATCH (a:Stop {id: $from}), (b:Stop {id: $to})
         MATCH path = shortestPath((a)-[:CONNECTS*1..60]-(b))
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

async function main() {
    const fLat = 12.971598, fLon = 77.594562; // Majestic
    const tLat = 12.925000, tLon = 77.593000; // Jayanagar
    const baseTime = new Date();

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

            const entry = { cls: r.cls, type: r.legs.length > 1 ? "interchange" : "direct", totalMins: Math.round(total) };
            if (r.cls === "bus" && (!bestBus || total < bestBus.totalMins)) bestBus = entry;
            if (r.cls === "metro" && (!bestMetro || total < bestMetro.totalMins)) bestMetro = entry;
            if (r.cls === "combo" && (!bestCombo || total < bestCombo.totalMins)) bestCombo = entry;
        }
    }

    console.log(JSON.stringify({ bus: bestBus, metro: bestMetro, combo: bestCombo }, null, 2));
    await driver.close();
}

main().catch(console.error);
