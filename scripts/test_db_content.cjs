const neo4j = require("neo4j-driver");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../api/.env") });

const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function test() {
    console.log("Checking Neo4j at:", process.env.NEO4J_URI);
    const session = driver.session({ database: process.env.NEO4J_DATABASE || "neo4j" });
    
    try {
        const stopCount = await session.run("MATCH (n:Stop) RETURN count(n) as count");
        console.log("✅ Total Stops in DB:", stopCount.records[0].get("count").low);

        const edgeCount = await session.run("MATCH ()-[r:CONNECTS]->() RETURN count(r) as count");
        console.log("✅ Total Connections in DB:", edgeCount.records[0].get("count").low);

        const sampleStop = await session.run("MATCH (n:Stop) RETURN n LIMIT 1");
        if (sampleStop.records.length > 0) {
            console.log("✅ Sample Stop Properties:", Object.keys(sampleStop.records[0].get("n").properties));
        } else {
            console.log("❌ NO STOPS FOUND. Please run 'npm run seed' in the api folder.");
        }

    } catch (e) {
        console.error("❌ Database Connection Error:", e.message);
    } finally {
        await session.close();
        await driver.close();
    }
}

test();
