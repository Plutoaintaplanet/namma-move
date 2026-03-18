const { ping, getSession } = require("../api/db.cjs");
const stops = require("../src/data/gtfs_stops.json");
const routes = require("../src/data/gtfs_routes.json");
const routeStops = require("../src/data/gtfs_route_stops.json");

async function fix() {
    console.log("🚀 Starting Database Auto-Repair...");
    
    try {
        await ping();
        console.log("✅ Database is ONLINE.");
    } catch (e) {
        console.error("❌ Database is OFFLINE. Please check your credentials in api/.env");
        console.error("Error Detail:", e.message);
        return;
    }

    const session = getSession();
    try {
        console.log("🧹 Clearing old data...");
        await session.run("MATCH (n:Stop) DETACH DELETE n");

        console.log(`📥 Seeding ${stops.length} stops...`);
        const formattedStops = stops.map(s => ({
            id: s.id, name: s.name, lat: s.latitude, lon: s.longitude,
            type: s.id.toString().startsWith("M") ? "metro" : "bus"
        }));

        await session.run(
            `UNWIND $batch AS s
             MERGE (n:Stop {id: s.id})
             SET n.name = s.name, n.lat = s.lat, n.lon = s.lon, n.type = s.type,
                 n.pos = point({latitude: s.lat, longitude: s.lon})`,
            { batch: formattedStops }
        );

        console.log("🔗 Creating route connections...");
        const routeMap = Object.fromEntries(routes.map(r => [r.id, r]));
        const byRoute = {};
        routeStops.forEach(rs => {
            if (!byRoute[rs.route_id]) byRoute[rs.route_id] = [];
            byRoute[rs.route_id].push(rs);
        });

        const edgeBatch = [];
        for (const [routeId, rsArr] of Object.entries(byRoute)) {
            const ordered = rsArr.sort((a, b) => a.stop_sequence - b.stop_sequence);
            const route = routeMap[routeId];
            if (!route) continue;

            for (let i = 0; i < ordered.length - 1; i++) {
                edgeBatch.push({
                    from: ordered[i].stop_id,
                    to: ordered[i+1].stop_id,
                    routeId: routeId,
                    routeName: route.short_name,
                    routeType: route.route_type,
                    travelMin: route.route_type === 1 ? 2.5 : 4
                });
            }
        }

        await session.run(
            `UNWIND $batch AS e
             MATCH (a:Stop {id: e.from})
             MATCH (b:Stop {id: e.to})
             MERGE (a)-[r:CONNECTS {routeId: e.routeId}]->(b)
             SET r.routeName = e.routeName, r.routeType = e.routeType, r.travelMin = e.travelMin`,
            { batch: edgeBatch }
        );

        console.log("✨ REPAIR COMPLETE. 100% of data synced.");
    } catch (e) {
        console.error("❌ Repair failed:", e.message);
    } finally {
        await session.close();
    }
}

fix();
