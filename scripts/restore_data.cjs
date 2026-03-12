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

const SAMPLE_STOPS = [
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

const SAMPLE_ROUTES = [
    { id: "R500", short_name: "500", long_name: "Majestic – Whitefield", route_type: 3 },
    { id: "R335E", short_name: "335E", long_name: "Majestic – Electronic City", route_type: 3 },
    { id: "R201", short_name: "201", long_name: "Majestic – Indiranagar", route_type: 3 },
    { id: "R225", short_name: "225", long_name: "Majestic – Banashankari", route_type: 3 },
    { id: "RG10", short_name: "G10", long_name: "Yeshwantpur – Silk Board", route_type: 3 },
    { id: "R401", short_name: "401", long_name: "Shivajinagar – Whitefield", route_type: 3 },
    { id: "R250", short_name: "250", long_name: "Majestic – Yelahanka", route_type: 3 },
    { id: "R600", short_name: "600", long_name: "Indiranagar – Electronic City", route_type: 3 },
];

const SAMPLE_RS = [
    { route_id: "R500", stop_id: "S001", stop_sequence: 1 },
    { route_id: "R500", stop_id: "S002", stop_sequence: 2 },
    { route_id: "R500", stop_id: "S023", stop_sequence: 3 },
    { route_id: "R500", stop_id: "S004", stop_sequence: 4 },
    { route_id: "R500", stop_id: "S022", stop_sequence: 5 },
    { route_id: "R500", stop_id: "S021", stop_sequence: 6 },
    { route_id: "R500", stop_id: "S026", stop_sequence: 7 },
    { route_id: "R500", stop_id: "S027", stop_sequence: 8 },
    { route_id: "R500", stop_id: "S005", stop_sequence: 9 },
    { route_id: "R335E", stop_id: "S001", stop_sequence: 1 },
    { route_id: "R335E", stop_id: "S007", stop_sequence: 2 },
    { route_id: "R335E", stop_id: "S003", stop_sequence: 3 },
    { route_id: "R335E", stop_id: "S012", stop_sequence: 4 },
    { route_id: "R335E", stop_id: "S006", stop_sequence: 5 },
    { route_id: "R201", stop_id: "S001", stop_sequence: 1 },
    { route_id: "R201", stop_id: "S023", stop_sequence: 2 },
    { route_id: "R201", stop_id: "S002", stop_sequence: 3 },
    { route_id: "R201", stop_id: "S004", stop_sequence: 4 },
    { route_id: "R225", stop_id: "S001", stop_sequence: 1 },
    { route_id: "R225", stop_id: "S007", stop_sequence: 2 },
    { route_id: "R225", stop_id: "S024", stop_sequence: 3 },
    { route_id: "R225", stop_id: "S008", stop_sequence: 4 },
    { route_id: "R225", stop_id: "S014", stop_sequence: 5 },
    { route_id: "R225", stop_id: "S025", stop_sequence: 6 },
    { route_id: "RG10", stop_id: "S009", stop_sequence: 1 },
    { route_id: "RG10", stop_id: "S016", stop_sequence: 2 },
    { route_id: "RG10", stop_id: "S017", stop_sequence: 3 },
    { route_id: "RG10", stop_id: "S001", stop_sequence: 4 },
    { route_id: "RG10", stop_id: "S007", stop_sequence: 5 },
    { route_id: "RG10", stop_id: "S003", stop_sequence: 6 },
    { route_id: "RG10", stop_id: "S012", stop_sequence: 7 },
    { route_id: "R401", stop_id: "S002", stop_sequence: 1 },
    { route_id: "R401", stop_id: "S022", stop_sequence: 2 },
    { route_id: "R401", stop_id: "S021", stop_sequence: 3 },
    { route_id: "R401", stop_id: "S027", stop_sequence: 4 },
    { route_id: "R401", stop_id: "S005", stop_sequence: 5 },
    { route_id: "R250", stop_id: "S001", stop_sequence: 1 },
    { route_id: "R250", stop_id: "S017", stop_sequence: 2 },
    { route_id: "R250", stop_id: "S010", stop_sequence: 3 },
    { route_id: "R250", stop_id: "S020", stop_sequence: 4 },
    { route_id: "R250", stop_id: "S011", stop_sequence: 5 },
    { route_id: "R600", stop_id: "S004", stop_sequence: 1 },
    { route_id: "R600", stop_id: "S022", stop_sequence: 2 },
    { route_id: "R600", stop_id: "S003", stop_sequence: 3 },
    { route_id: "R600", stop_id: "S012", stop_sequence: 4 },
    { route_id: "R600", stop_id: "S006", stop_sequence: 5 },
];

function restore() {
    console.log("Restoring transit data...");

    const stopsText = fs.readFileSync(path.join(GTFS_DIR, "stops.txt"), "utf8");
    const fullStops = parseCSV(stopsText)
        .map((s) => ({
            id: String(s.stop_id), name: s.stop_name,
            latitude: parseFloat(s.stop_lat),
            longitude: parseFloat(s.stop_lon),
        }))
        .filter((s) => s.id && !isNaN(s.latitude));

    console.log(`Loaded ${fullStops.length} full stops.`);

    // Merge full stops with sample stops (avoid duplicates)
    const combinedStops = [...fullStops];
    const existingIds = new Set(fullStops.map(s => s.id));
    SAMPLE_STOPS.forEach(s => {
        if (!existingIds.has(s.id)) combinedStops.push(s);
    });

    console.log(`Total stops: ${combinedStops.length}`);

    fs.writeFileSync(path.join(DATA_DIR, "gtfs_stops.json"), JSON.stringify(combinedStops, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, "gtfs_routes.json"), JSON.stringify(SAMPLE_ROUTES, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, "gtfs_route_stops.json"), JSON.stringify(SAMPLE_RS, null, 2));

    console.log("✅ Data files restored with full stops and sample routes.");
}

restore();
