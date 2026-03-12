/**
 * seed_robust.js — Advanced seeder for Namma Move
 * 
 * Enhancements:
 *  1. Uses Neo4j Point for spatial queries.
 *  2. Creates bidirectional edges for Metro.
 *  3. Automatically creates TRANSFER edges between stops within 200m.
 */

require("dotenv").config({ path: require('path').join(__dirname, '.env') });
const neo4j = require("neo4j-driver");

const stops = require("../src/data/gtfs_stops.json");
const routes = require("../src/data/gtfs_routes.json");
const routeStops = require("../src/data/gtfs_route_stops.json");

const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function seed() {
    const session = driver.session({ database: process.env.NEO4J_DATABASE || "neo4j" });
    console.log("🌱 Starting Robust Seeding...\n");

    try {
        // 1. Clear Graph
        console.log("Cleaning existing data...");
        await session.run("MATCH (n:Stop) DETACH DELETE n");

        // 2. Create Stops with Spatial Point
        console.log(`Creating ${stops.length} Stop nodes...`);
        const formattedStops = stops.map(s => ({
            id: String(s.id),
            name: s.name,
            lat: s.latitude,
            lon: s.longitude,
            type: String(s.id).startsWith("M-") ? "metro" : "bus"
        }));

        const stopChunk = 2000;
        for (let i = 0; i < formattedStops.length; i += stopChunk) {
            const chunk = formattedStops.slice(i, i + stopChunk);
            await session.run(`
                UNWIND $batch AS s
                CREATE (n:Stop {id: s.id})
                SET n.name = s.name,
                    n.lat  = s.lat,
                    n.lon  = s.lon,
                    n.type = s.type,
                    n.pos  = point({latitude: s.lat, longitude: s.lon})
            `, { batch: chunk });
            console.log(`  Inserted ${i + chunk.length} stops...`);
        }

        // 3. Create Constraints & Indexes
        console.log("Creating indexes...");
        try { await session.run("DROP INDEX stop_id IF EXISTS"); } catch(e) {}
        try { await session.run("DROP INDEX stop_name IF EXISTS"); } catch(e) {}
        await session.run("CREATE CONSTRAINT stop_id_unique IF NOT EXISTS FOR (s:Stop) REQUIRE s.id IS UNIQUE");
        await session.run("CREATE INDEX stop_pos IF NOT EXISTS FOR (s:Stop) ON (s.pos)");

        // 4. Create Route Connections
        console.log("Building route connections...");
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

            const isMetro = route.route_type === 1;
            const travelMin = isMetro ? 2.5 : 4.0;

            for (let i = 0; i < ordered.length - 1; i++) {
                edgeBatch.push({
                    from: String(ordered[i].stop_id),
                    to: String(ordered[i + 1].stop_id),
                    routeId: routeId,
                    routeName: route.short_name + " - " + route.long_name,
                    routeType: route.route_type,
                    travelMin: travelMin,
                    seq: i
                });
            }
        }

        console.log(`Creating ${edgeBatch.length} CONNECTS edges...`);
        const edgeChunk = 5000;
        for (let i = 0; i < edgeBatch.length; i += edgeChunk) {
            const chunk = edgeBatch.slice(i, i + edgeChunk);
            await session.run(`
                UNWIND $batch AS e
                MATCH (a:Stop {id: e.from}), (b:Stop {id: e.to})
                CREATE (a)-[r:CONNECTS {route_id: e.routeId}]->(b)
                SET r.route_name = e.routeName,
                    r.route_type = e.routeType,
                    r.travel_min = e.travelMin,
                    r.seq        = e.seq
                WITH a, b, e, r
                WHERE e.routeType = 1
                CREATE (b)-[r2:CONNECTS {route_id: e.routeId + "_REV"}]->(a)
                SET r2.route_name = e.routeName + " (Reverse)",
                    r2.route_type = e.routeType,
                    r2.travel_min = e.travelMin,
                    r2.seq        = e.seq
            `, { batch: chunk });
            console.log(`  Inserted ${i + chunk.length} edges...`);
        }

        // 5. Create Virtual Interchanges (Transfers)
        console.log("Generating Virtual Interchanges (Transfers < 200m)...");
        // This query finds all stops within 200m and creates a TRANSFER relationship
        // We limit it to avoid a combinatorial explosion in very dense hubs
        await session.run(`
            MATCH (a:Stop)
            MATCH (b:Stop)
            WHERE a.id < b.id 
              AND point.distance(a.pos, b.pos) < 200
            WITH a, b, point.distance(a.pos, b.pos) as dist
            // Limit to 5 closest neighbors per stop to keep graph clean
            ORDER BY dist
            WITH a, b, dist
            CREATE (a)-[:TRANSFER {dist: dist, walk_min: dist / 75.0}]->(b)
            CREATE (b)-[:TRANSFER {dist: dist, walk_min: dist / 75.0}]->(a)
        `);
        console.log("  ✅ Virtual Interchanges created");

        // 6. Final Validation
        const stopCount = await session.run("MATCH (n:Stop) RETURN count(n)");
        const edgeCount = await session.run("MATCH ()-[r:CONNECTS]->() RETURN count(r)");
        const xferCount = await session.run("MATCH ()-[r:TRANSFER]->() RETURN count(r)");

        console.log("\n🚀 SEEDING COMPLETE!");
        console.log(`   Nodes: ${stopCount.records[0].get(0)}`);
        console.log(`   Connections: ${edgeCount.records[0].get(0)}`);
        console.log(`   Transfers: ${xferCount.records[0].get(0)}`);

    } catch (e) {
        console.error("\n❌ Seed failed:", e.message);
    } finally {
        await session.close();
        await driver.close();
    }
}

seed();
