const neo4j = require("neo4j-driver");
require("dotenv").config();

let driver;

function getDriver() {
    if (driver) return driver;

    const uri = process.env.NEO4J_URI;
    const user = process.env.NEO4J_USER;
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !user || !password) {
        console.error("❌ Neo4j environment variables missing!");
        return null;
    }

    driver = neo4j.driver(
        uri,
        neo4j.auth.basic(user, password),
        {
            maxConnectionPoolSize: 10,
            connectionTimeout: 15000,
        }
    );
    return driver;
}

async function ping() {
    const d = getDriver();
    if (!d) throw new Error("Driver not initialized - missing env vars");
    const session = d.session({ database: process.env.NEO4J_DATABASE || "neo4j" });
    try {
        await session.run("RETURN 1");
        return true;
    } finally {
        await session.close();
    }
}

function getSession() {
    const d = getDriver();
    if (!d) throw new Error("Driver not initialized - missing env vars");
    return d.session({ database: process.env.NEO4J_DATABASE || "neo4j" });
}

module.exports = { driver: getDriver(), ping, getSession };
