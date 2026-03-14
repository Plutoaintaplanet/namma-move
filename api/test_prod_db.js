const { getSession } = require("./db.cjs");

async function testNearby(lat, lon, label) {
    const s = getSession();
    const cypher = `
        MATCH (s:Stop)
        WHERE point.distance(s.pos, point({latitude: $lat, longitude: $lon})) < 3000
        RETURN s.id AS id, s.name AS name, s.lat AS lat, s.lon AS lon, s.type AS type, 
               point.distance(s.pos, point({latitude: $lat, longitude: $lon})) AS dist
        ORDER BY dist
        LIMIT 10
    `;
    try {
        const r = await s.executeRead(tx => tx.run(cypher, { lat, lon }));
        console.log(`\n--- Nearby ${label} (${lat}, ${lon}) ---`);
        r.records.forEach(rec => {
            console.log(`${rec.get("type") === "metro" ? "🚇" : "🚌"} ${rec.get("name")} (${rec.get("id")}) - ${Math.round(rec.get("dist"))}m`);
        });
        if (r.records.length === 0) console.log("❌ No stops found!");
    } catch (e) {
        console.error(`Error testing ${label}:`, e.message);
    } finally {
        await s.close();
    }
}

async function run() {
    // Lulu Mall
    await testNearby(12.9708, 77.5644, "Lulu Mall");
    // Toit
    await testNearby(12.9791, 77.6407, "Toit");
    process.exit(0);
}

run();
