const neo4j = require("neo4j-driver");
require("dotenv").config();

let driver;

function getDriver() {
    if (driver) return driver;

    const uri = (process.env.NEO4J_URI || "").trim();
    const user = (process.env.NEO4J_USER || "").trim();
    const password = (process.env.NEO4J_PASSWORD || "").trim();

    if (!uri || !password) {
        console.error("❌ Missing NEO4J_URI or NEO4J_PASSWORD");
        return null;
    }

    try {
        // Standardize: Aura usernames are almost always 'neo4j'
        // If the provided user looks like a DB ID, we'll keep it but log a warning
        const effectiveUser = (user === "959e56fa" || !user) ? "neo4j" : user;

        driver = neo4j.driver(
            uri,
            neo4j.auth.basic(effectiveUser, password),
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
    if (!d) throw new Error("Neo4j Driver could not be initialized. Check Vercel Environment Variables.");
    
    // Aura Free Tier only allows the "neo4j" database.
    const session = d.session({ database: "neo4j" });
    
    try {
        await session.run("RETURN 1");
        return true;
    } catch (e) {
        if (e.message.includes("authentication failure") || e.message.includes("unauthorized")) {
            const user = (process.env.NEO4J_USER || "").trim();
            throw new Error(`Authentication Failed. Your current user is "${user}". Try changing NEO4J_USER to "neo4j" in the Vercel dashboard.`);
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
