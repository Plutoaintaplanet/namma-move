const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const neo4j = require("neo4j-driver");

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
    
    // We will let Neo4j decide the default database by NOT passing a name,
    // or use the one provided in env.
    const dbName = process.env.NEO4J_DATABASE || undefined;
    const session = d.session({ database: dbName });
    
    try {
        await session.run("RETURN 1");
        return true;
    } catch (e) {
        console.error(`Ping failed for database "${dbName || 'default'}":`, e.message);
        throw e;
    } finally {
        await session.close();
    }
}

function getSession() {
    const d = getDriver();
    if (!d) throw new Error("Neo4j Driver not available");
    const dbName = (process.env.NEO4J_DATABASE || "").trim() || undefined;
    return d.session({ database: dbName });
}

module.exports = { getDriver, ping, getSession };
