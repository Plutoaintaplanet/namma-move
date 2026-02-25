const neo4j = require("neo4j-driver");
require("dotenv").config();

const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
    {
        maxConnectionPoolSize: 10,
        connectionTimeout: 15000,
    }
);

async function ping() {
    const session = driver.session({ database: process.env.NEO4J_DATABASE || "neo4j" });
    try {
        await session.run("RETURN 1");
        return true;
    } finally {
        await session.close();
    }
}

function getSession() {
    return driver.session({ database: process.env.NEO4J_DATABASE || "neo4j" });
}

module.exports = { driver, ping, getSession };
