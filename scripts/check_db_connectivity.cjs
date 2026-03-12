require("dotenv").config({ path: './api/.env' });
const neo4j = require("neo4j-driver");
const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));
const session = driver.session({ database: process.env.NEO4J_DATABASE || "neo4j" });

async function check() {
    try {
        const res = await session.run("MATCH (s:Stop) WHERE (s)-[:CONNECTS]-() RETURN count(DISTINCT s)");
        console.log("Stops with connections:", res.records[0].get(0).toNumber());
        
        const sample = await session.run("MATCH (s:Stop) WHERE (s)-[:CONNECTS]-() RETURN s.name, s.id LIMIT 10");
        console.log("Sample active stops:", sample.records.map(r => `${r.get(0)} (${r.get(1)})`));
    } finally {
        await session.close();
        await driver.close();
    }
}
check();
