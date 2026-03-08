require("dotenv").config({ path: "api/.env" });
const { driver } = require("./api/db.cjs");

async function nominatimSearch(query) {
    const q = encodeURIComponent(query + ", Bangalore, India");
    const primaryUrl = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
    const res = await fetch(primaryUrl, {
        headers: { "User-Agent": "NammaMove/1.0 (Testing script)" }
    });
    const data = await res.json();
    if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name };
    }
    return null;
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3, r = d => d * Math.PI / 180;
    const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DB = process.env.NEO4J_DATABASE || "neo4j";

async function runRead(cypher, params = {}) {
    const s = driver.session({ database: DB });
    try {
        const r = await s.executeRead(tx => tx.run(cypher, params));
        return r.records;
    } finally { await s.close(); }
}

let _stopsCache = null;
async function getAllStops() {
    if (_stopsCache) return _stopsCache;
    const recs = await runRead("MATCH (s:Stop)-[:CONNECTS]-() RETURN DISTINCT s.id AS id, s.name AS name, s.lat AS lat, s.lon AS lon, s.type AS type");
    _stopsCache = recs.map(r => ({ id: r.get("id"), name: r.get("name"), lat: r.get("lat"), lon: r.get("lon"), type: r.get("type") }));
    return _stopsCache;
}

async function nearbyStops(lat, lon) {
    const all = await getAllStops();
    const sorted = all
        .map(stop => ({ ...stop, dist: haversine(lat, lon, stop.lat, stop.lon) }))
        .sort((a, b) => a.dist - b.dist);
    const buses = sorted.filter(st => st.type !== "metro" && st.dist <= 1200).slice(0, 6);
    const metros = sorted.filter(st => st.type === "metro" && st.dist <= 2000).slice(0, 3);
    const fallbackBuses = buses.length ? buses : sorted.filter(st => st.type !== "metro").slice(0, 5);
    return [...fallbackBuses, ...metros].sort((a, b) => a.dist - b.dist);
}

async function findRoute(fromId, toId) {
    const recs = await runRead(
        `MATCH (a:Stop {id: $from}), (b:Stop {id: $to})
         MATCH path = shortestPath((a)-[:CONNECTS*1..60]-(b))
         WITH path,
              reduce(t=0.0, r IN relationships(path) | t + r.travel_min) AS totalMin,
              [r IN relationships(path) | r.route_id]   AS routeIds,
              [r IN relationships(path) | r.route_type] AS routeTypes,
              [n IN nodes(path) | {id:n.id,name:n.name}] AS stops
         RETURN stops, routeIds, routeTypes, totalMin
         ORDER BY totalMin LIMIT 1`,
        { from: fromId, to: toId }
    );
    if (!recs.length) return null;
    const rec = recs[0];
    return {
        stops: rec.get("stops").length,
        totalMin: rec.get("totalMin"),
        routeTypes: rec.get("routeTypes")
    };
}

async function run() {
    const fromLoc = await nominatimSearch("UB City");
    const toLoc = await nominatimSearch("Domlur");

    console.log("From:", fromLoc);
    console.log("To:", toLoc);

    if (!fromLoc || !toLoc) {
        console.log("Could not resolve coordinates.");
        process.exit(1);
    }

    try {
        const [oStops, dStops] = await Promise.all([
            nearbyStops(fromLoc.lat, fromLoc.lon),
            nearbyStops(toLoc.lat, toLoc.lon)
        ]);

        console.log("\nOrigin closest stops:");
        oStops.forEach(st => console.log(`  - ${st.name} (${st.dist.toFixed(0)}m) - ${st.type}`));
        console.log("\nDest closest stops:");
        dStops.forEach(st => console.log(`  - ${st.name} (${st.dist.toFixed(0)}m) - ${st.type}`));

        let foundAny = false;
        console.log("\nSearching routes...");
        for (const oS of oStops.slice(0, 8)) {
            for (const dS of dStops.slice(0, 8)) {
                if (oS.id === dS.id) continue;
                const r = await findRoute(oS.id, dS.id);
                if (r) {
                    console.log(`  ✅ Found route: ${oS.name} -> ${dS.name} (${r.stops} stops, ${r.totalMin} mins)`);
                    foundAny = true;
                }
            }
        }

        if (!foundAny) {
            console.log("  ❌ No routes found!");
        }
    } finally {
        await driver.close();
    }
}
run().catch(console.error);
