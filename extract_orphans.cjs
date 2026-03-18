require("dotenv").config({ path: "api/.env" });
const { getDriver } = require("./api/db.cjs");
const fs = require("fs");

async function run() {
    const driver = getDriver();
    if (!driver) throw new Error("Neo4j driver not available");
    const s = driver.session({ database: process.env.NEO4J_DATABASE || "neo4j" });
    try {
        console.log("Fetching isolated nodes...");
        const res = await s.executeRead(tx => tx.run(`
            MATCH (s:Stop)
            WHERE NOT (s)-[:CONNECTS]-()
            RETURN s.id AS id, s.name AS name, s.lat AS lat, s.lon AS lon, s.type AS type
            LIMIT 10
        `));
        const isolated = res.records.map(r => ({
            id: r.get("id"), name: r.get("name"),
            lat: r.get("lat"), lon: r.get("lon"), type: r.get("type")
        }));
        console.log("Sample of 10 isolated nodes:", isolated);

        // Let's write them all to a file to analyze
        const allRes = await s.executeRead(tx => tx.run(`
            MATCH (s:Stop)
            WHERE NOT (s)-[:CONNECTS]-()
            RETURN s.id AS id, s.name AS name, s.lat AS lat, s.lon AS lon, s.type AS type
        `));

        const allIsolated = allRes.records.map(r => ({
            id: r.get("id"), name: r.get("name")
        }));
        fs.writeFileSync("isolated_stops.json", JSON.stringify(allIsolated, null, 2));
        console.log(`Saved ${allIsolated.length} isolated nodes to isolated_stops.json`);
    } finally {
        await s.close();
        await driver.close();
    }
}
run().catch(console.error);
