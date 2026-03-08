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
        const fLat = 12.9716, fLon = 77.5961; // UB City
        const tLat = 12.9609, tLon = 77.6387; // Domlur
        console.log("Fetching route via API...");
        const res = await fetch(`http://localhost:4000/api/route?fromLat=${fLat}&fromLon=${fLon}&toLat=${tLat}&toLon=${tLon}`);
        const data = await res.json();
        if (!data.bus && !data.metro && !data.combo) {
            console.log(JSON.stringify(data, null, 2));
            console.log("No routes found! API BUG.");
        } else {
            console.log("Response:", JSON.stringify({
                bus: data.bus ? data.bus.totalMins : null,
                metro: data.metro ? data.metro.totalMins : null,
                combo: data.combo ? data.combo.totalMins : null
            }));
            console.log("Routes found.");
        }
    } catch (e) {
        console.error("Fetch error:", e.message);
    } finally {
        server.kill();
        process.exit(0);
    }
}, 2000);
