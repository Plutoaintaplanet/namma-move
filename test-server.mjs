import { spawn } from "child_process";
import fs from "fs";

const envContent = fs.readFileSync("api/.env", "utf8");
for (const line of envContent.split("\n")) {
    if (line.includes("=")) {
        const [k, v] = line.split("=");
        process.env[k.trim()] = v.trim();
    }
}
const server = spawn("node", ["api/index.cjs"], { env: process.env, stdio: "inherit" });

setTimeout(async () => {
    try {
        const fLat = 13.1009, fLon = 77.5963; // Yelahanka
        const tLat = 12.8399, tLon = 77.6770; // Electronic City
        console.log("Fetching route...");
        const res = await fetch(`http://localhost:4000/api/route?fromLat=${fLat}&fromLon=${fLon}&toLat=${tLat}&toLon=${tLon}`);
        const data = await res.json();
        console.log("Response:", JSON.stringify(data).substring(0, 150) + "...");
        if (!data.bus && !data.metro && !data.combo) {
            console.log("No routes found! HOP LIMIT BUG IDENTIFIED.");
        } else {
            console.log("Routes found.");
        }
    } catch (e) {
        console.error("Fetch error:", e.message);
    } finally {
        server.kill();
        process.exit(0);
    }
}, 2000);
