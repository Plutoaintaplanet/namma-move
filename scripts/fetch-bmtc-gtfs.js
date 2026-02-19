/**
 * fetch-bmtc-gtfs.js
 * 
 * Downloads the unofficial BMTC GTFS zip, extracts it, and produces:
 *   src/data/gtfs_stops.json
 *   src/data/gtfs_routes.json  
 *   src/data/gtfs_route_stops.json
 * 
 * These replace the Supabase backend entirely.
 * Run once: node scripts/fetch-bmtc-gtfs.js
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ── Inline CSV parser (no dependency needed) ──────────────────────────────────
function parseCSV(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
    if (lines.length < 2) return [];
    const headers = splitCSVLine(lines[0]);
    return lines.slice(1).map((line) => {
        const values = splitCSVLine(line);
        const obj = {};
        headers.forEach((h, i) => (obj[h.trim()] = (values[i] || "").trim()));
        return obj;
    });
}

function splitCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQuotes = !inQuotes; continue; }
        if (c === "," && !inQuotes) { result.push(current); current = ""; continue; }
        current += c;
    }
    result.push(current);
    return result;
}

// ── Download helper ───────────────────────────────────────────────────────────
function download(url, dest) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith("https") ? https : http;
        const file = fs.createWriteStream(dest);
        const req = proto.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
            // Follow redirects up to 5 times
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                file.close();
                fs.unlinkSync(dest);
                return resolve(download(res.headers.location, dest));
            }
            if (res.statusCode !== 200) {
                file.close();
                fs.unlinkSync(dest);
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            res.pipe(file);
            file.on("finish", () => { file.close(); resolve(dest); });
        });
        req.on("error", (err) => { fs.unlinkSync(dest); reject(err); });
    });
}

// ── Unzip a specific file from a .zip buffer ──────────────────────────────────
// Pure Node.js zip reader (no unzip library needed for flat zips)
function readZipEntries(buffer) {
    const entries = {};
    let offset = 0;
    while (offset < buffer.length - 4) {
        const sig = buffer.readUInt32LE(offset);
        if (sig !== 0x04034b50) break; // Local file header signature
        const compression = buffer.readUInt16LE(offset + 8);
        const compressedSize = buffer.readUInt32LE(offset + 18);
        const fileNameLen = buffer.readUInt16LE(offset + 26);
        const extraLen = buffer.readUInt16LE(offset + 28);
        const fileName = buffer.slice(offset + 30, offset + 30 + fileNameLen).toString("utf8");
        const dataStart = offset + 30 + fileNameLen + extraLen;
        const compressedData = buffer.slice(dataStart, dataStart + compressedSize);

        if (compression === 0) {
            // Stored (no compression)
            entries[fileName] = compressedData.toString("utf8");
        } else if (compression === 8) {
            // Deflate
            try {
                entries[fileName] = zlib.inflateRawSync(compressedData).toString("utf8");
            } catch (e) {
                entries[fileName] = null;
            }
        }
        offset = dataStart + compressedSize;
    }
    return entries;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    const outDir = path.join(__dirname, "..", "src", "data");
    fs.mkdirSync(outDir, { recursive: true });

    const tmpZip = path.join(__dirname, "bmtc_gtfs.zip");

    // Try multiple known BMTC GTFS sources
    const SOURCES = [
        // Unofficial BMTC GTFS from transitfeeds / public mirrors
        "https://github.com/opentransittools/open-bus-data/raw/main/bangalore/bmtc_gtfs.zip",
        // Fallback: Kaggle exported CSV mirror (opentransittools)
        "https://storage.googleapis.com/transitfeeds-public/providers/929/20240101/original/bmtc_gtfs.zip",
    ];

    let zipBuffer = null;
    for (const url of SOURCES) {
        try {
            console.log(`\nTrying: ${url}`);
            await download(url, tmpZip);
            zipBuffer = fs.readFileSync(tmpZip);
            console.log(`✓ Downloaded ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB`);
            break;
        } catch (err) {
            console.warn(`  ✗ Failed: ${err.message}`);
        }
    }

    if (!zipBuffer) {
        // ── FALLBACK: generate a sample dataset so the app works offline ────────
        console.log("\n⚠  Could not download GTFS zip. Generating Bangalore sample dataset…");
        generateSampleData(outDir);
        cleanup(tmpZip);
        return;
    }

    console.log("Parsing zip entries…");
    const entries = readZipEntries(zipBuffer);

    const requiredFiles = ["stops.txt", "routes.txt", "trips.txt", "stop_times.txt"];
    const missing = requiredFiles.filter((f) => !entries[f]);
    if (missing.length > 0) {
        console.warn(`Missing in zip: ${missing.join(", ")}`);
        console.log("Generating sample dataset instead…");
        generateSampleData(outDir);
        cleanup(tmpZip);
        return;
    }

    // ── Parse stops ─────────────────────────────────────────────────────────
    console.log("Processing stops…");
    const stopsRaw = parseCSV(entries["stops.txt"]);
    const stopsOut = stopsRaw
        .map((s) => ({
            id: s.stop_id,
            name: s.stop_name,
            latitude: parseFloat(s.stop_lat),
            longitude: parseFloat(s.stop_lon),
        }))
        .filter((s) => s.id && !isNaN(s.latitude) && !isNaN(s.longitude));

    // ── Parse routes ──────────────────────────────────────────────────────────
    console.log("Processing routes…");
    const routesRaw = parseCSV(entries["routes.txt"]);
    const routesOut = routesRaw.map((r) => ({
        id: r.route_id,
        short_name: r.route_short_name || r.route_id,
        long_name: r.route_long_name || "",
        route_type: parseInt(r.route_type) || 3,
    }));

    // ── Build routeId → stopSequence from trips + stop_times ──────────────────
    console.log("Processing trips + stop_times (this may take a moment)…");
    const tripsRaw = parseCSV(entries["trips.txt"]);
    // Map trip_id → route_id
    const tripToRoute = {};
    tripsRaw.forEach((t) => { tripToRoute[t.trip_id] = t.route_id; });

    // Choose one representative trip per route (shortest trip_id alphabetically)
    const routeRepTrip = {}; // route_id → trip_id
    tripsRaw.forEach((t) => {
        if (!routeRepTrip[t.route_id] || t.trip_id < routeRepTrip[t.route_id]) {
            routeRepTrip[t.route_id] = t.trip_id;
        }
    });
    const repTripSet = new Set(Object.values(routeRepTrip));

    const stopTimesRaw = parseCSV(entries["stop_times.txt"]);
    const routeStopsOut = [];
    const seen = new Set();

    stopTimesRaw.forEach((st) => {
        const tripId = st.trip_id;
        if (!repTripSet.has(tripId)) return;
        const routeId = tripToRoute[tripId];
        if (!routeId) return;
        const key = `${routeId}|${st.stop_id}`;
        if (seen.has(key)) return;
        seen.add(key);
        routeStopsOut.push({
            route_id: routeId,
            stop_id: st.stop_id,
            stop_sequence: parseInt(st.stop_sequence) || 0,
        });
    });

    // ── Write output ───────────────────────────────────────────────────────────
    fs.writeFileSync(path.join(outDir, "gtfs_stops.json"), JSON.stringify(stopsOut));
    fs.writeFileSync(path.join(outDir, "gtfs_routes.json"), JSON.stringify(routesOut));
    fs.writeFileSync(path.join(outDir, "gtfs_route_stops.json"), JSON.stringify(routeStopsOut));

    console.log(`\n✅ Done!`);
    console.log(`   Stops:       ${stopsOut.length}`);
    console.log(`   Routes:      ${routesOut.length}`);
    console.log(`   Route-Stops: ${routeStopsOut.length}`);
    console.log(`   Output: src/data/`);

    cleanup(tmpZip);
}

// ── Sample dataset (realistic Bangalore stops & routes) ───────────────────────
function generateSampleData(outDir) {
    const stops = [
        { id: "S001", name: "Majestic Bus Stand", latitude: 12.9774, longitude: 77.5714 },
        { id: "S002", name: "Shivajinagar", latitude: 12.9850, longitude: 77.6006 },
        { id: "S003", name: "Koramangala", latitude: 12.9352, longitude: 77.6245 },
        { id: "S004", name: "Indiranagar", latitude: 12.9784, longitude: 77.6408 },
        { id: "S005", name: "Whitefield", latitude: 12.9698, longitude: 77.7499 },
        { id: "S006", name: "Electronic City", latitude: 12.8441, longitude: 77.6602 },
        { id: "S007", name: "Jayanagar", latitude: 12.9308, longitude: 77.5838 },
        { id: "S008", name: "Banashankari", latitude: 12.9257, longitude: 77.5499 },
        { id: "S009", name: "Yeshwantpur", latitude: 13.0278, longitude: 77.5390 },
        { id: "S010", name: "Hebbal", latitude: 13.0354, longitude: 77.5955 },
        { id: "S011", name: "Yelahanka", latitude: 13.1007, longitude: 77.5963 },
        { id: "S012", name: "Silk Board", latitude: 12.9177, longitude: 77.6228 },
        { id: "S013", name: "HSR Layout", latitude: 12.9116, longitude: 77.6389 },
        { id: "S014", name: "JP Nagar", latitude: 12.9063, longitude: 77.5857 },
        { id: "S015", name: "Kengeri", latitude: 12.9082, longitude: 77.4834 },
        { id: "S016", name: "Rajajinagar", latitude: 12.9955, longitude: 77.5546 },
        { id: "S017", name: "Malleswaram", latitude: 13.0036, longitude: 77.5685 },
        { id: "S018", name: "Vijayanagar", latitude: 12.9717, longitude: 77.5310 },
        { id: "S019", name: "BTM Layout", latitude: 12.9165, longitude: 77.6101 },
        { id: "S020", name: "Nagawara", latitude: 13.0429, longitude: 77.6184 },
        { id: "S021", name: "Marathahalli", latitude: 12.9591, longitude: 77.6974 },
        { id: "S022", name: "Domlur", latitude: 12.9607, longitude: 77.6389 },
        { id: "S023", name: "MG Road", latitude: 12.9751, longitude: 77.6063 },
        { id: "S024", name: "Basavanagudi", latitude: 12.9420, longitude: 77.5742 },
        { id: "S025", name: "Bannerghatta Road", latitude: 12.8952, longitude: 77.5970 },
    ];

    const routes = [
        { id: "R500", short_name: "500", long_name: "Majestic – Whitefield", route_type: 3 },
        { id: "R335E", short_name: "335E", long_name: "Majestic – Electronic City", route_type: 3 },
        { id: "R201", short_name: "201", long_name: "Majestic – Indiranagar", route_type: 3 },
        { id: "R225", short_name: "225", long_name: "Majestic – Banashankari", route_type: 3 },
        { id: "R G10", short_name: "G10", long_name: "Yeshwantpur – Silk Board", route_type: 3 },
    ];

    const routeStops = [
        // Route 500: Majestic → Shivajinagar → Indiranagar → Whitefield
        { route_id: "R500", stop_id: "S001", stop_sequence: 1 },
        { route_id: "R500", stop_id: "S002", stop_sequence: 2 },
        { route_id: "R500", stop_id: "S023", stop_sequence: 3 },
        { route_id: "R500", stop_id: "S004", stop_sequence: 4 },
        { route_id: "R500", stop_id: "S022", stop_sequence: 5 },
        { route_id: "R500", stop_id: "S021", stop_sequence: 6 },
        { route_id: "R500", stop_id: "S005", stop_sequence: 7 },

        // Route 335E: Majestic → Jayanagar → Koramangala → Silk Board → Electronic City
        { route_id: "R335E", stop_id: "S001", stop_sequence: 1 },
        { route_id: "R335E", stop_id: "S007", stop_sequence: 2 },
        { route_id: "R335E", stop_id: "S003", stop_sequence: 3 },
        { route_id: "R335E", stop_id: "S012", stop_sequence: 4 },
        { route_id: "R335E", stop_id: "S006", stop_sequence: 5 },

        // Route 201: Majestic → MG Road → Indiranagar
        { route_id: "R201", stop_id: "S001", stop_sequence: 1 },
        { route_id: "R201", stop_id: "S023", stop_sequence: 2 },
        { route_id: "R201", stop_id: "S002", stop_sequence: 3 },
        { route_id: "R201", stop_id: "S004", stop_sequence: 4 },

        // Route 225: Majestic → Banashankari → JP Nagar
        { route_id: "R225", stop_id: "S001", stop_sequence: 1 },
        { route_id: "R225", stop_id: "S007", stop_sequence: 2 },
        { route_id: "R225", stop_id: "S024", stop_sequence: 3 },
        { route_id: "R225", stop_id: "S008", stop_sequence: 4 },
        { route_id: "R225", stop_id: "S014", stop_sequence: 5 },

        // Route G10: Yeshwantpur → Rajajinagar → Malleswaram → Majestic → Jayanagar → Koramangala → Silk Board
        { route_id: "R G10", stop_id: "S009", stop_sequence: 1 },
        { route_id: "R G10", stop_id: "S016", stop_sequence: 2 },
        { route_id: "R G10", stop_id: "S017", stop_sequence: 3 },
        { route_id: "R G10", stop_id: "S001", stop_sequence: 4 },
        { route_id: "R G10", stop_id: "S007", stop_sequence: 5 },
        { route_id: "R G10", stop_id: "S003", stop_sequence: 6 },
        { route_id: "R G10", stop_id: "S012", stop_sequence: 7 },
    ];

    fs.writeFileSync(path.join(outDir, "gtfs_stops.json"), JSON.stringify(stops, null, 2));
    fs.writeFileSync(path.join(outDir, "gtfs_routes.json"), JSON.stringify(routes, null, 2));
    fs.writeFileSync(path.join(outDir, "gtfs_route_stops.json"), JSON.stringify(routeStops, null, 2));

    console.log(`✅ Sample Bangalore dataset written to src/data/`);
    console.log(`   Stops: ${stops.length} | Routes: ${routes.length} | Route-Stops: ${routeStops.length}`);
}

function cleanup(tmpZip) {
    if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);
}

main().catch((err) => { console.error(err); process.exit(1); });
