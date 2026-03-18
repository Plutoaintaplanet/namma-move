const neo4j = require("neo4j-driver");
const path = require("path");
// Look for .env in the folder of this file first, then fallback to current dir
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

let driver;

function getDriver() {
    if (driver) return driver;

    const uri = (process.env.NEO4J_URI || "").trim();
    const user = (process.env.NEO4J_USER || "").trim();
    const password = (process.env.NEO4J_PASSWORD || "").trim();

    if (!uri || !user || !password) {
        return null;
    }

    try {
        driver = neo4j.driver(
            uri,
            neo4j.auth.basic(user, password),
            {
                maxConnectionPoolSize: 10,
                connectionTimeout: 15000,
                disableLosslessIntegers: true
            }
        );
        return driver;
    } catch (e) {
        console.error("❌ Driver Creation Error:", e.message);
        return null;
    }
}

async function ping() {
    const d = getDriver();
    if (!d) throw new Error("Neo4j Driver missing environment variables.");
    
    const dbName = process.env.NEO4J_DATABASE || "neo4j";
    const session = d.session({ database: dbName });
    
    try {
        await session.run("RETURN 1");
        return true;
    } finally {
        await session.close();
    }
}

function getSession() {
    const d = getDriver();
    if (!d) throw new Error("Neo4j Driver not available");
    return d.session({ database: process.env.NEO4J_DATABASE || "neo4j" });
}

module.exports = { 
    get driver() { return getDriver(); },
    getDriver, ping, getSession 
};
