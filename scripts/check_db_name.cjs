require("dotenv").config({ path: './api/.env' });
const neo4j = require("neo4j-driver");
const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));

async function check() {
    // Try without specifying a database name
    const session = driver.session(); 
    try {
        const res = await session.run("RETURN 1");
        console.log("Success without database name!");
        
        const dbRes = await session.run("CALL db.info()");
        console.log("Database Info:", dbRes.records[0].toObject());
    } catch (e) {
        console.log("Failed without database name:", e.message);
    } finally {
        await session.close();
        await driver.close();
    }
}
check();
