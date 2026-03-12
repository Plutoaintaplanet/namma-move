require("dotenv").config({ path: require('path').join(__dirname, '.env') });
const { driver } = require("./db.cjs");

async function debug() {
    const session = driver.session();
    try {
        // Majestic Coordinates
        const lat = 12.9757, lon = 77.5729;
        
        console.log("1. Checking for stops near Majestic...");
        const nearby = await session.run(`
            MATCH (s:Stop)
            WITH s, point.distance(s.pos, point({latitude: $lat, longitude: $lon})) AS dist
            WHERE dist < 1000
            RETURN s.id, s.name, dist
            ORDER BY dist LIMIT 5
        `, { lat, lon });
        nearby.records.forEach(r => console.log(`   - ${r.get(1)} (${r.get(0)}) at ${Math.round(r.get(2))}m`));

        if (nearby.records.length === 0) {
            console.log("   ❌ NO NEARBY STOPS FOUND! Database might be empty or pos property missing.");
            return;
        }

        const fromId = nearby.records[0].get(0);
        // Find a stop far away (e.g. Indiranagar approx)
        const targetLat = 12.9784, targetLon = 77.6408;
        const targets = await session.run(`
            MATCH (s:Stop)
            WITH s, point.distance(s.pos, point({latitude: $lat, longitude: $lon})) AS dist
            WHERE dist < 1000
            RETURN s.id, s.name, dist
            ORDER BY dist LIMIT 1
        `, { lat: targetLat, lon: targetLon });
        
        if (targets.records.length === 0) {
            console.log("   ❌ NO TARGET STOPS FOUND!");
            return;
        }
        const toId = targets.records[0].get(0);
        console.log(`\n2. Routing from ${fromId} to ${toId}... (METRO)`);

        const route = await session.run(`
            MATCH (a:Stop {id: $from}), (b:Stop {id: $to})
            MATCH path = shortestPath((a)-[:CONNECTS|TRANSFER*1..100]-(b))
            RETURN nodes(path) as nodes, relationships(path) as rels
        `, { from: fromId, to: toId });

        if (route.records.length > 0) {
            console.log("   ✅ METRO ROUTE FOUND!");
        }

        console.log("\n4. Checking SAMPLE BUS Routing (S001 to S005)...");
        const busRoute = await session.run(`
            MATCH (a:Stop {id: 'S001'}), (b:Stop {id: 'S005'})
            MATCH path = shortestPath((a)-[:CONNECTS|TRANSFER*1..100]-(b))
            RETURN nodes(path) as nodes
        `);
        if (busRoute.records.length > 0) {
            console.log("   ✅ SAMPLE BUS ROUTE FOUND!");
        } else {
            console.log("   ❌ NO SAMPLE BUS ROUTE FOUND between S001 and S005.");
        }

    } finally {
        await session.close();
        await driver.close();
    }
}
debug();
