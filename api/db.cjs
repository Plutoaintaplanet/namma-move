const neo4j = require("neo4j-driver");
require("dotenv").config();

let driver;

function getDriver() {
    // Return existing driver if it's already connected
    if (driver) return driver;

    const uri = (process.env.NEO4J_URI || "").trim();
    const user = (process.env.NEO4J_USER || "").trim();
    const password = (process.env.NEO4J_PASSWORD || "").trim();

    if (!uri || !user || !password) {
        console.error("❌ Missing Neo4j credentials in environment variables");
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
    if (!d) throw new Error("Neo4j Driver could not be initialized. Check Vercel Env Vars.");
    
    // Aura Free Tier only allows the "neo4j" database.
    // Using any other name (like the DB ID) will cause an Auth Error.
    const session = d.session({ database: "neo4j" });
    
    try {
        await session.run("RETURN 1");
        return true;
    } catch (e) {
        console.error("Ping Error:", e.message);
        // Provide a very specific error if it's an Auth failure
        if (e.message.includes("authentication failure") || e.message.includes("unauthorized")) {
            throw new Error("Authentication failed. Please verify NEO4J_USER and NEO4J_PASSWORD in Vercel.");
        }
        throw e;
    } finally {
        await session.close();
    }
}

function getSession() {
    const d = getDriver();
    if (!d) throw new Error("Neo4j Driver not available");
    return d.session({ database: "neo4j" });
}

module.exports = { getDriver, ping, getSession };
