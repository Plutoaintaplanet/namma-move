const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "src", "data");
const GTFS_DIR = path.join(__dirname, "..", "bmtc_gtfs_data");

// ── Inline CSV parser ─────────────────────────────────────────────────────────
function parseCSV(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
    if (lines.length < 2) return [];
    const headers = splitLine(lines[0]);
    return lines.slice(1).map((line) => {
        const vals = splitLine(line);
        const obj = {};
        headers.forEach((h, i) => (obj[h.trim()] = (vals[i] || "").trim()));
        return obj;
    });
}
function splitLine(line) {
    const result = []; let cur = ""; let inQ = false;
    for (const c of line) {
        if (c === '"') { inQ = !inQ; continue; }
        if (c === "," && !inQ) { result.push(cur); cur = ""; continue; }
        cur += c;
    }
    result.push(cur);
    return result;
}

function processLocalGTFS() {
    console.log("Reading local GTFS data from:", GTFS_DIR);

    const stopsText = fs.readFileSync(path.join(GTFS_DIR, "stops.txt"), "utf8");
    const routesText = fs.readFileSync(path.join(GTFS_DIR, "routes.txt"), "utf8");
    const tripsText = fs.readFileSync(path.join(GTFS_DIR, "trips.txt"), "utf8");
    const stopTimesText = fs.readFileSync(path.join(GTFS_DIR, "stop_times.txt"), "utf8");

    // Stops
    const stopsOut = parseCSV(stopsText)
        .map((s) => ({
            id: s.stop_id, name: s.stop_name,
            latitude: parseFloat(s.stop_lat),
            longitude: parseFloat(s.stop_lon),
        }))
        .filter((s) => s.id && !isNaN(s.latitude));

    console.log(`Processed ${stopsOut.length} stops.`);

    // Routes
    const routesOut = parseCSV(routesText).map((r) => ({
        id: r.route_id,
        short_name: r.route_short_name || r.route_id,
        long_name: r.route_long_name || "",
        route_type: parseInt(r.route_type) || 3,
    }));

    console.log(`Processed ${routesOut.length} routes.`);

    // Trips → map trip_id to route_id
    const tripsRaw = parseCSV(tripsText);
    const tripToRoute = {}; tripsRaw.forEach((t) => { tripToRoute[t.trip_id] = t.route_id; });

    console.log(`Mapped ${Object.keys(tripToRoute).length} trips.`);

    // stop_times → route_stops (Aggregating all stops per route)
    const routeStopsMap = {}; // route_id -> { stop_id -> stop_sequence }
    const stopTimesLines = stopTimesText.replace(/\r/g, "").split("\n").filter(Boolean);
    const stHeaders = splitLine(stopTimesLines[0]);
    
    console.log("Processing stop_times.txt...");

    for (let i = 1; i < stopTimesLines.length; i++) {
        const vals = splitLine(stopTimesLines[i]);
        const st = {};
        stHeaders.forEach((h, idx) => (st[h.trim()] = (vals[idx] || "").trim()));

        const rid = tripToRoute[st.trip_id];
        if (!rid) continue;

        if (!routeStopsMap[rid]) routeStopsMap[rid] = {};
        
        // We might have multiple trips for the same route each providing different stops
        // or the same stop. We take the stop_sequence provided.
        const seq = parseInt(st.stop_sequence) || 0;
        if (seq > 0) {
            routeStopsMap[rid][st.stop_id] = seq;
        }
    }

    const rsOut = [];
    for (const [rid, stops] of Object.entries(routeStopsMap)) {
        for (const [sid, seq] of Object.entries(stops)) {
            rsOut.push({ route_id: rid, stop_id: sid, stop_sequence: seq });
        }
    }

    console.log(`Processed ${rsOut.length} total route-stop connections.`);

    fs.writeFileSync(path.join(DATA_DIR, "gtfs_stops.json"), JSON.stringify(stopsOut, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, "gtfs_routes.json"), JSON.stringify(routesOut, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, "gtfs_route_stops.json"), JSON.stringify(rsOut, null, 2));

    console.log("\n✅ Local GTFS Integration Done (with multi-trip aggregation)!");
}

try {
    processLocalGTFS();
} catch (e) {
    console.error(e);
    process.exit(1);
}
