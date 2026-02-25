/**
 * fetch-gtfs.cjs
 * Downloads official BMTC + BMRCL GTFS from tdh.dult-karnataka.com
 * and converts them into the three JSON files used by the app.
 *
 * Run: node scripts/fetch-gtfs.cjs
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ── Inline CSV parser ────────────────────────────────────────────────────────
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

// ── Fetch a URL as text ───────────────────────────────────────────────────────
function fetchText(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 8) return reject(new Error("Too many redirects"));
        const proto = url.startsWith("https") ? https : http;
        proto.get(url, { headers: { "User-Agent": "namma-move-builder/1.0" } }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                return resolve(fetchText(res.headers.location, redirects + 1));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${res.statusCode} at ${url}`));
            }
            const enc = res.headers["content-encoding"];
            let stream = res;
            if (enc === "gzip") stream = res.pipe(zlib.createGunzip());
            if (enc === "deflate") stream = res.pipe(zlib.createInflate());
            let body = "";
            stream.on("data", (c) => (body += c));
            stream.on("end", () => resolve(body));
            stream.on("error", reject);
        }).on("error", reject);
    });
}

// ── Fetch one GTFS agency ─────────────────────────────────────────────────────
async function fetchAgency(name, baseUrl) {
    const files = ["stops.txt", "routes.txt", "trips.txt", "stop_times.txt"];
    const out = {};
    for (const f of files) {
        const url = `${baseUrl}/${f}`;
        try {
            process.stdout.write(`  Fetching ${url} ... `);
            const text = await fetchText(url);
            out[f] = parseCSV(text);
            console.log(`${out[f].length} rows`);
        } catch (e) {
            console.log(`FAILED: ${e.message}`);
            out[f] = null;
        }
    }
    return out;
}

// ── Process one agency's GTFS into our JSON shape ─────────────────────────────
function processAgency(agencyName, data, prefix) {
    const { stops: stopsRaw, routes: routesRaw, trips: tripsRaw, "stop_times.txt": stTimesRaw } = {
        stops: data["stops.txt"],
        routes: data["routes.txt"],
        trips: data["trips.txt"],
        "stop_times.txt": data["stop_times.txt"],
    };

    if (!stopsRaw || !routesRaw || !tripsRaw || !stTimesRaw) {
        console.warn(`  ⚠  ${agencyName}: missing some files, skipping.`);
        return { stops: [], routes: [], routeStops: [] };
    }

    // stops
    const stops = stopsRaw
        .map((s) => ({
            id: prefix + (s.stop_id || s.zone_id || ""),
            name: s.stop_name || s.stop_id,
            latitude: parseFloat(s.stop_lat),
            longitude: parseFloat(s.stop_lon),
        }))
        .filter((s) => s.id && !isNaN(s.latitude) && !isNaN(s.longitude));

    const stopIdMap = {};
    stopsRaw.forEach((s) => {
        stopIdMap[s.stop_id] = prefix + (s.stop_id || s.zone_id || "");
    });

    // routes
    const isMetro = agencyName === "BMRCL";
    const routes = routesRaw.map((r) => ({
        id: prefix + r.route_id,
        short_name: r.route_short_name || r.route_id,
        long_name: r.route_long_name || "",
        route_type: isMetro ? 1 : (parseInt(r.route_type) || 3),
    }));

    const routeIdMap = {};
    routesRaw.forEach((r) => { routeIdMap[r.route_id] = prefix + r.route_id; });

    // trips → pick lexicographically smallest trip_id per route as representative
    const repTrip = {};
    tripsRaw.forEach((t) => {
        const rid = t.route_id;
        if (!repTrip[rid] || t.trip_id < repTrip[rid]) repTrip[rid] = t.trip_id;
    });
    const repSet = new Set(Object.values(repTrip));

    const tripToRoute = {};
    tripsRaw.forEach((t) => { tripToRoute[t.trip_id] = t.route_id; });

    // stop_times → route_stops
    const seen = new Set();
    const routeStops = [];

    // Process in chunks to avoid OOM on huge stop_times.txt (BMTC has millions)
    for (const st of stTimesRaw) {
        if (!repSet.has(st.trip_id)) continue;
        const origRouteId = tripToRoute[st.trip_id];
        if (!origRouteId) continue;
        const rid = routeIdMap[origRouteId];
        const sid = stopIdMap[st.stop_id] || (prefix + st.stop_id);
        const key = `${rid}|${sid}`;
        if (seen.has(key)) continue;
        seen.add(key);
        routeStops.push({
            route_id: rid,
            stop_id: sid,
            stop_sequence: parseInt(st.stop_sequence) || 0,
            // Store scheduled arrival for departure time feature
            arrival_time: st.arrival_time || st.departure_time || "",
        });
    }

    console.log(`  ✓ ${agencyName}: ${stops.length} stops, ${routes.length} routes, ${routeStops.length} route-stops`);
    return { stops, routes, routeStops };
}

// ── Merge and write ────────────────────────────────────────────────────────────
async function main() {
    const outDir = path.join(__dirname, "..", "src", "data");
    fs.mkdirSync(outDir, { recursive: true });

    const agencies = [
        { name: "BMRCL", baseUrl: "https://tdh.dult-karnataka.com/bmrcl", prefix: "M_" },
        { name: "BMTC", baseUrl: "https://tdh.dult-karnataka.com/bmtc", prefix: "B_" },
    ];

    let allStops = [], allRoutes = [], allRouteStops = [];

    for (const ag of agencies) {
        console.log(`\n📥 Fetching ${ag.name} GTFS from ${ag.baseUrl} ...`);
        const data = await fetchAgency(ag.name, ag.baseUrl);
        const { stops, routes, routeStops } = processAgency(ag.name, data, ag.prefix);
        allStops = allStops.concat(stops);
        allRoutes = allRoutes.concat(routes);
        allRouteStops = allRouteStops.concat(routeStops);
    }

    // Deduplicate stops by id
    const stopsSeen = new Set();
    allStops = allStops.filter((s) => { if (stopsSeen.has(s.id)) return false; stopsSeen.add(s.id); return true; });

    const stopsPath = path.join(outDir, "gtfs_stops.json");
    const routesPath = path.join(outDir, "gtfs_routes.json");
    const rsPath = path.join(outDir, "gtfs_route_stops.json");

    fs.writeFileSync(stopsPath, JSON.stringify(allStops, null, 1));
    fs.writeFileSync(routesPath, JSON.stringify(allRoutes, null, 1));
    fs.writeFileSync(rsPath, JSON.stringify(allRouteStops, null, 1));

    console.log("\n✅ Done! Written to src/data/");
    console.log(`   Stops: ${allStops.length}  Routes: ${allRoutes.length}  Route-Stops: ${allRouteStops.length}`);
    console.log(`   File sizes: stops=${(fs.statSync(stopsPath).size / 1024 / 1024).toFixed(1)}MB, routes=${(fs.statSync(routesPath).size / 1024).toFixed(0)}KB, route_stops=${(fs.statSync(rsPath).size / 1024 / 1024).toFixed(1)}MB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
