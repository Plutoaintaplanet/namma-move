/**
 * fetch-bmtc-gtfs.cjs  (CommonJS – works even with "type":"module" in package.json)
 *
 * Produces:
 *   src/data/gtfs_stops.json
 *   src/data/gtfs_routes.json
 *   src/data/gtfs_route_stops.json
 *
 * Run once:  node scripts/fetch-bmtc-gtfs.cjs
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

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

// ── Download with redirect following ──────────────────────────────────────────
function download(url, dest, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 8) return reject(new Error("Too many redirects"));
        const proto = url.startsWith("https") ? https : http;
        const file = fs.createWriteStream(dest);
        proto.get(url, { headers: { "User-Agent": "namma-move-builder/1.0" } }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                file.close(); try { fs.unlinkSync(dest); } catch (_) { }
                return resolve(download(res.headers.location, dest, redirects + 1));
            }
            if (res.statusCode !== 200) {
                file.close(); try { fs.unlinkSync(dest); } catch (_) { }
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            res.pipe(file);
            file.on("finish", () => { file.close(); resolve(dest); });
        }).on("error", (e) => { try { fs.unlinkSync(dest); } catch (_) { } reject(e); });
    });
}

// ── Pure-JS zip reader ────────────────────────────────────────────────────────
function readZipEntries(buf) {
    const entries = {};
    let off = 0;
    while (off < buf.length - 4) {
        if (buf.readUInt32LE(off) !== 0x04034b50) break;
        const compression = buf.readUInt16LE(off + 8);
        const compressedSz = buf.readUInt32LE(off + 18);
        const fileNameLen = buf.readUInt16LE(off + 26);
        const extraLen = buf.readUInt16LE(off + 28);
        const fileName = buf.slice(off + 30, off + 30 + fileNameLen).toString("utf8");
        const dataStart = off + 30 + fileNameLen + extraLen;
        const compressed = buf.slice(dataStart, dataStart + compressedSz);
        if (compression === 0) {
            entries[fileName] = compressed.toString("utf8");
        } else if (compression === 8) {
            try { entries[fileName] = zlib.inflateRawSync(compressed).toString("utf8"); }
            catch (_) { entries[fileName] = null; }
        }
        off = dataStart + compressedSz;
    }
    return entries;
}

// ── Sample dataset ─────────────────────────────────────────────────────────────
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
        { id: "S026", name: "KR Puram", latitude: 13.0068, longitude: 77.6974 },
        { id: "S027", name: "Brookefield", latitude: 12.9631, longitude: 77.7149 },
        { id: "S028", name: "Bellandur", latitude: 12.9373, longitude: 77.6768 },
        { id: "S029", name: "Sarjapur Road", latitude: 12.9107, longitude: 77.6754 },
        { id: "S030", name: "Yelahanka New Town", latitude: 13.0985, longitude: 77.5966 },
    ];

    const routes = [
        { id: "R500", short_name: "500", long_name: "Majestic – Whitefield", route_type: 3 },
        { id: "R335E", short_name: "335E", long_name: "Majestic – Electronic City", route_type: 3 },
        { id: "R201", short_name: "201", long_name: "Majestic – Indiranagar", route_type: 3 },
        { id: "R225", short_name: "225", long_name: "Majestic – Banashankari", route_type: 3 },
        { id: "RG10", short_name: "G10", long_name: "Yeshwantpur – Silk Board", route_type: 3 },
        { id: "R401", short_name: "401", long_name: "Shivajinagar – Whitefield", route_type: 3 },
        { id: "R250", short_name: "250", long_name: "Majestic – Yelahanka", route_type: 3 },
        { id: "R600", short_name: "600", long_name: "Indiranagar – Electronic City", route_type: 3 },
    ];

    const routeStops = [
        // 500: Majestic → Shivajinagar → MG Road → Indiranagar → Domlur → Marathahalli → KR Puram → Brookefield → Whitefield
        { route_id: "R500", stop_id: "S001", stop_sequence: 1 },
        { route_id: "R500", stop_id: "S002", stop_sequence: 2 },
        { route_id: "R500", stop_id: "S023", stop_sequence: 3 },
        { route_id: "R500", stop_id: "S004", stop_sequence: 4 },
        { route_id: "R500", stop_id: "S022", stop_sequence: 5 },
        { route_id: "R500", stop_id: "S021", stop_sequence: 6 },
        { route_id: "R500", stop_id: "S026", stop_sequence: 7 },
        { route_id: "R500", stop_id: "S027", stop_sequence: 8 },
        { route_id: "R500", stop_id: "S005", stop_sequence: 9 },

        // 335E: Majestic → Jayanagar → Koramangala → Silk Board → Electronic City
        { route_id: "R335E", stop_id: "S001", stop_sequence: 1 },
        { route_id: "R335E", stop_id: "S007", stop_sequence: 2 },
        { route_id: "R335E", stop_id: "S003", stop_sequence: 3 },
        { route_id: "R335E", stop_id: "S012", stop_sequence: 4 },
        { route_id: "R335E", stop_id: "S006", stop_sequence: 5 },

        // 201: Majestic → MG Road → Shivajinagar → Indiranagar
        { route_id: "R201", stop_id: "S001", stop_sequence: 1 },
        { route_id: "R201", stop_id: "S023", stop_sequence: 2 },
        { route_id: "R201", stop_id: "S002", stop_sequence: 3 },
        { route_id: "R201", stop_id: "S004", stop_sequence: 4 },

        // 225: Majestic → Jayanagar → Basavanagudi → Banashankari → JP Nagar → Bannerghatta Rd
        { route_id: "R225", stop_id: "S001", stop_sequence: 1 },
        { route_id: "R225", stop_id: "S007", stop_sequence: 2 },
        { route_id: "R225", stop_id: "S024", stop_sequence: 3 },
        { route_id: "R225", stop_id: "S008", stop_sequence: 4 },
        { route_id: "R225", stop_id: "S014", stop_sequence: 5 },
        { route_id: "R225", stop_id: "S025", stop_sequence: 6 },

        // G10: Yeshwantpur → Rajajinagar → Malleswaram → Majestic → Jayanagar → Koramangala → Silk Board
        { route_id: "RG10", stop_id: "S009", stop_sequence: 1 },
        { route_id: "RG10", stop_id: "S016", stop_sequence: 2 },
        { route_id: "RG10", stop_id: "S017", stop_sequence: 3 },
        { route_id: "RG10", stop_id: "S001", stop_sequence: 4 },
        { route_id: "RG10", stop_id: "S007", stop_sequence: 5 },
        { route_id: "RG10", stop_id: "S003", stop_sequence: 6 },
        { route_id: "RG10", stop_id: "S012", stop_sequence: 7 },

        // 401: Shivajinagar → Domlur → Marathahalli → Brookefield → Whitefield
        { route_id: "R401", stop_id: "S002", stop_sequence: 1 },
        { route_id: "R401", stop_id: "S022", stop_sequence: 2 },
        { route_id: "R401", stop_id: "S021", stop_sequence: 3 },
        { route_id: "R401", stop_id: "S027", stop_sequence: 4 },
        { route_id: "R401", stop_id: "S005", stop_sequence: 5 },

        // 250: Majestic → Malleswaram → Hebbal → Nagawara → Yelahanka
        { route_id: "R250", stop_id: "S001", stop_sequence: 1 },
        { route_id: "R250", stop_id: "S017", stop_sequence: 2 },
        { route_id: "R250", stop_id: "S010", stop_sequence: 3 },
        { route_id: "R250", stop_id: "S020", stop_sequence: 4 },
        { route_id: "R250", stop_id: "S011", stop_sequence: 5 },

        // 600: Indiranagar → Domlur → Koramangala → Silk Board → Electronic City
        { route_id: "R600", stop_id: "S004", stop_sequence: 1 },
        { route_id: "R600", stop_id: "S022", stop_sequence: 2 },
        { route_id: "R600", stop_id: "S003", stop_sequence: 3 },
        { route_id: "R600", stop_id: "S012", stop_sequence: 4 },
        { route_id: "R600", stop_id: "S006", stop_sequence: 5 },
    ];

    fs.writeFileSync(path.join(outDir, "gtfs_stops.json"), JSON.stringify(stops, null, 2));
    fs.writeFileSync(path.join(outDir, "gtfs_routes.json"), JSON.stringify(routes, null, 2));
    fs.writeFileSync(path.join(outDir, "gtfs_route_stops.json"), JSON.stringify(routeStops, null, 2));

    console.log("✅ Sample Bangalore dataset written:");
    console.log(`   Stops: ${stops.length}  Routes: ${routes.length}  Route-Stops: ${routeStops.length}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    const outDir = path.join(__dirname, "..", "src", "data");
    fs.mkdirSync(outDir, { recursive: true });
    const tmpZip = path.join(__dirname, "bmtc_gtfs_tmp.zip");

    const SOURCES = [
        "https://github.com/Vonter/bmtc-gtfs/raw/master/bmtc_gtfs.zip",
        "https://github.com/anikets95/bmtc-data/raw/master/bmtc_gtfs.zip",
        "https://transitfeeds.com/p/bmtc/1066/latest/download",
        "https://github.com/opentransittools/open-bus-data/raw/main/bangalore/bmtc_gtfs.zip",
    ];

    let zipBuf = null;
    for (const url of SOURCES) {
        try {
            console.log(`Trying: ${url}`);
            await download(url, tmpZip);
            zipBuf = fs.readFileSync(tmpZip);
            console.log(`✓ Downloaded ${(zipBuf.length / 1024 / 1024).toFixed(1)} MB`);
            break;
        } catch (e) {
            console.warn(`  ✗ ${e.message}`);
        }
    }

    if (!zipBuf) {
        console.log("\n⚠  GTFS download failed. Using built-in sample dataset.");
        generateSampleData(outDir);
        return;
    }

    const entries = readZipEntries(zipBuf);
    try { fs.unlinkSync(tmpZip); } catch (_) { }

    const required = ["stops.txt", "routes.txt", "trips.txt", "stop_times.txt"];
    const missing = required.filter((f) => !entries[f]);
    if (missing.length) {
        console.warn(`Missing in zip: ${missing.join(", ")}. Using sample dataset.`);
        generateSampleData(outDir);
        return;
    }

    // Stops
    const stopsOut = parseCSV(entries["stops.txt"])
        .map((s) => ({
            id: s.stop_id, name: s.stop_name,
            latitude: parseFloat(s.stop_lat),
            longitude: parseFloat(s.stop_lon),
        }))
        .filter((s) => s.id && !isNaN(s.latitude));

    // Routes
    const routesOut = parseCSV(entries["routes.txt"]).map((r) => ({
        id: r.route_id,
        short_name: r.route_short_name || r.route_id,
        long_name: r.route_long_name || "",
        route_type: parseInt(r.route_type) || 3,
    }));

    // Trips → pick one representative trip per route
    const tripsRaw = parseCSV(entries["trips.txt"]);
    const tripToRoute = {}; tripsRaw.forEach((t) => { tripToRoute[t.trip_id] = t.route_id; });
    const repTrip = {};
    tripsRaw.forEach((t) => {
        if (!repTrip[t.route_id] || t.trip_id < repTrip[t.route_id]) repTrip[t.route_id] = t.trip_id;
    });
    const repSet = new Set(Object.values(repTrip));

    // stop_times → route_stops
    const rsOut = [];
    const seen = new Set();
    parseCSV(entries["stop_times.txt"]).forEach((st) => {
        if (!repSet.has(st.trip_id)) return;
        const rid = tripToRoute[st.trip_id];
        if (!rid) return;
        const key = `${rid}|${st.stop_id}`;
        if (seen.has(key)) return;
        seen.add(key);
        rsOut.push({ route_id: rid, stop_id: st.stop_id, stop_sequence: parseInt(st.stop_sequence) || 0 });
    });

    fs.writeFileSync(path.join(outDir, "gtfs_stops.json"), JSON.stringify(stopsOut));
    fs.writeFileSync(path.join(outDir, "gtfs_routes.json"), JSON.stringify(routesOut));
    fs.writeFileSync(path.join(outDir, "gtfs_route_stops.json"), JSON.stringify(rsOut));

    console.log("\n✅ Done!");
    console.log(`   Stops: ${stopsOut.length}  Routes: ${routesOut.length}  Route-Stops: ${rsOut.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
