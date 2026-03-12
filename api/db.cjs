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
        throw new Error("Driver not initialized - missing env vars");
    }
    
    // Aura Free databases are ALWAYS named "neo4j". 
    // Using the DB ID as the database name will cause authentication failure.
    const dbName = "neo4j"; 
    const session = d.session({ database: dbName });
    
    try {
        await session.run("RETURN 1");
        return true;
    } catch (e) {
        console.error(`Ping failed for database "${dbName}":`, e.message);
        throw new Error(`${e.message} (Note: Ensure NEO4J_DATABASE is NOT set to your DB ID in Vercel)`);
    } finally {
        await session.close();
    }
}

function getSession() {
    const d = getDriver();
    if (!d) throw new Error("Neo4j Driver not available");
    // Standardize on "neo4j" database name for Aura
    return d.session({ database: "neo4j" });
}

// Exporting functions instead of a static driver instance for better serverless handling
module.exports = { getDriver, ping, getSession };
