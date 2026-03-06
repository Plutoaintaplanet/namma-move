require("dotenv").config({ path: "api/.env" });
const { driver } = require("./api/db.cjs");

async function run() {
    const s = driver.session({ database: process.env.NEO4J_DATABASE || "neo4j" });
    try {
        const res = await s.executeRead(tx => tx.run(`
            MATCH (s:Stop)
            OPTIONAL MATCH (s)-[r:CONNECTS]-()
            WITH s, count(r) as connections
            RETURN count(s) as total, sum(CASE WHEN connections = 0 THEN 1 ELSE 0 END) as orphaned
        `));
        console.log("Total stops:", res.records[0].get("total").toNumber());
        console.log("Orphaned stops:", res.records[0].get("orphaned").toNumber());
    } finally {
        await s.close();
        await driver.close();
    }
}
run().catch(console.error);
