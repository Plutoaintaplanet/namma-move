const neo4j = require("neo4j-driver");
require("dotenv").config();

let driver;

function getDriver() {
    if (driver) return driver;

    const uri = process.env.NEO4J_URI;
    const user = process.env.NEO4J_USER;
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !user || !password) {
        return null;
    }

    try {
        // Aura usually needs neo4j+s://
        // We'll log the URI (masked) to help debug Vercel logs
        const maskedUri = uri.replace(/\/\/.*@/, "//***:***@");
        console.log(`Connecting to Neo4j at: ${maskedUri}`);

        driver = neo4j.driver(
            uri,
            neo4j.auth.basic(user, password),
            {
                maxConnectionPoolSize: 10,
                connectionTimeout: 15000,
                // Disable driver logging in prod to avoid clutter
                logging: process.env.NODE_ENV === 'production' ? null : neo4j.logging.console('info')
            }
        );
        return driver;
    } catch (e) {
        console.error("Failed to create Neo4j driver:", e.message);
        return null;
    }
}

async function ping() {
    const d = getDriver();
    if (!d) {
        const missing = [];
        if (!process.env.NEO4J_URI) missing.push("NEO4J_URI");
        if (!process.env.NEO4J_USER) missing.push("NEO4J_USER");
        if (!process.env.NEO4J_PASSWORD) missing.push("NEO4J_PASSWORD");
        throw new Error(`Driver not initialized - missing env vars: ${missing.join(", ")}`);
    }
    
    // Explicitly use "neo4j" if no database name is provided, 
    // as Aura Free tier usually only has one database named "neo4j"
    const dbName = process.env.NEO4J_DATABASE || "neo4j";
    const session = d.session({ database: dbName });
    
    try {
        await session.run("RETURN 1");
        return true;
    } catch (e) {
        console.error(`Ping failed for database "${dbName}":`, e.message);
        throw e;
    } finally {
        await session.close();
    }
}

// For routes, always get the fresh driver instance
function getSession() {
    const d = getDriver();
    if (!d) throw new Error("Neo4j Driver not available");
    return d.session({ database: process.env.NEO4J_DATABASE || "neo4j" });
}

// Exporting functions instead of a static driver instance for better serverless handling
module.exports = { getDriver, ping, getSession };
