require("dotenv").config({ path: "api/.env" });
const { findRoute } = require("./api/routes/route.cjs");
const { driver, ping } = require("./api/db.cjs");

async function run() {
    await ping();
    console.log("DB Ping OK");
    // Just testing fetch via HTTP directly:
    const fromLat = 12.971598, fromLon = 77.594562; // Majestic
    const toLat = 12.925000, toLon = 77.593000;   // Jayanagar
    const response = await fetch(`http://localhost:4000/api/route?fromLat=${fromLat}&fromLon=${fromLon}&toLat=${toLat}&toLon=${toLon}`);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
}
run().catch(console.error);
