const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "src", "data");

function generateSyntheticRoutes() {
    console.log("🚀 Generating synthetic bus routes to connect all 4,000+ stops...");

    // 1. Load Data
    const stops = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "gtfs_stops.json"), "utf8"));
    const routes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "gtfs_routes.json"), "utf8"));
    const routeStops = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "gtfs_route_stops.json"), "utf8"));

    // 2. Identify unconnected BMTC stops
    // We already have some sample routes. Let's keep those.
    const bmtcStops = stops.filter(s => !s.id.toString().startsWith("M-"));
    console.log(`Found ${bmtcStops.length} BMTC bus stops.`);

    const newRoutes = [];
    const newRouteStops = [];
    let routeCounter = 1;

    // 3. Create Horizontal Routes (Sort by Latitude -> grouped by roughly same Lat, sweeping Longitude)
    const hStops = [...bmtcStops].sort((a, b) => a.latitude - b.latitude);
    const CHUNK_SIZE = 25;
    
    for (let i = 0; i < hStops.length; i += CHUNK_SIZE) {
        const chunk = hStops.slice(i, i + CHUNK_SIZE);
        // Sort the chunk by longitude to make a logical path East-West
        chunk.sort((a, b) => a.longitude - b.longitude);
        
        if (chunk.length < 2) continue;

        const routeId = `SYN-H${routeCounter}`;
        newRoutes.push({
            id: routeId,
            short_name: `H${routeCounter}`,
            long_name: `${chunk[0].name.substring(0,15)} ↔ ${chunk[chunk.length-1].name.substring(0,15)}`,
            route_type: 3
        });

        chunk.forEach((stop, idx) => {
            newRouteStops.push({
                route_id: routeId,
                stop_id: stop.id,
                stop_sequence: idx + 1
            });
        });
        routeCounter++;
    }

    // 4. Create Vertical Routes (Sort by Longitude -> grouped by roughly same Lon, sweeping Latitude)
    const vStops = [...bmtcStops].sort((a, b) => a.longitude - b.longitude);
    routeCounter = 1;

    for (let i = 0; i < vStops.length; i += CHUNK_SIZE) {
        const chunk = vStops.slice(i, i + CHUNK_SIZE);
        // Sort the chunk by latitude to make a logical path North-South
        chunk.sort((a, b) => a.latitude - b.latitude);
        
        if (chunk.length < 2) continue;

        const routeId = `SYN-V${routeCounter}`;
        newRoutes.push({
            id: routeId,
            short_name: `V${routeCounter}`,
            long_name: `${chunk[0].name.substring(0,15)} ↔ ${chunk[chunk.length-1].name.substring(0,15)}`,
            route_type: 3
        });

        chunk.forEach((stop, idx) => {
            newRouteStops.push({
                route_id: routeId,
                stop_id: stop.id,
                stop_sequence: idx + 1
            });
        });
        routeCounter++;
    }

    // 5. Merge and Save
    // Remove old synthetic routes if they exist to prevent duplicates
    const finalRoutes = routes.filter(r => !r.id.startsWith("SYN-")).concat(newRoutes);
    const finalRouteStops = routeStops.filter(rs => !rs.route_id.startsWith("SYN-")).concat(newRouteStops);

    fs.writeFileSync(path.join(DATA_DIR, "gtfs_routes.json"), JSON.stringify(finalRoutes, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, "gtfs_route_stops.json"), JSON.stringify(finalRouteStops, null, 2));

    console.log(`✅ Generated ${newRoutes.length} synthetic routes.`);
    console.log(`✅ Created ${newRouteStops.length} new connections.`);
    console.log(`Total Routes: ${finalRoutes.length}, Total Connections: ${finalRouteStops.length}`);
}

generateSyntheticRoutes();
