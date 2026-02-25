/**
 * seed.js — loads all Namma Move stops + routes into Neo4j
 *
 * Run: node seed.js
 *
 * What it does:
 *  1. Creates a :Stop node for every stop (BMTC + Metro)
 *  2. Creates [:CONNECTS] edges between consecutive stops on each route
 *     Each edge carries: route_id, route_name, route_type, travel_min
 */

require("dotenv").config();
const neo4j = require("neo4j-driver");

const stops = require("../src/data/gtfs_stops.json");
const routes = require("../src/data/gtfs_routes.json");
const routeStops = require("../src/data/gtfs_route_stops.json");

const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function seed() {
    const session = driver.session();
    console.log("🌱 Seeding Neo4j...\n");

    try {
        // ── Clear existing data ────────────────────────────────────────────────────
        console.log("Clearing existing Stop nodes and CONNECTS edges...");
        await session.run("MATCH (n:Stop) DETACH DELETE n");

        // ── Create Stop nodes ────────────────────────────────────────────────────
        console.log(`Creating ${stops.length} Stop nodes...`);
        for (const s of stops) {
            await session.run(
                `MERGE (s:Stop {id: $id})
         SET s.name = $name,
             s.lat  = $lat,
             s.lon  = $lon,
             s.type = $type`,
                {
                    id: s.id,
                    name: s.name,
                    lat: s.latitude,
                    lon: s.longitude,
                    type: s.id.startsWith("M") ? "metro" : "bus",
                }
            );
        }
        console.log("  ✅ Stop nodes created");

        // ── Build ordered route-stop map ──────────────────────────────────────────
        const routeMap = Object.fromEntries(routes.map(r => [r.id, r]));
        const byRoute = {};
        routeStops.forEach(rs => {
            if (!byRoute[rs.route_id]) byRoute[rs.route_id] = [];
            byRoute[rs.route_id].push(rs);
        });

        // ── Create CONNECTS edges between consecutive stops ───────────────────────
        let edgeCount = 0;
        for (const [routeId, rsArr] of Object.entries(byRoute)) {
            const ordered = rsArr.sort((a, b) => a.stop_sequence - b.stop_sequence);
            const route = routeMap[routeId];
            if (!route) { console.warn(`  ⚠ Route ${routeId} not found, skipping`); continue; }

            const isMetro = route.route_type === 1;
            const travelMin = isMetro ? 2.5 : 4; // minutes per stop

            for (let i = 0; i < ordered.length - 1; i++) {
                const from = ordered[i].stop_id;
                const to = ordered[i + 1].stop_id;
                await session.run(
                    `MATCH (a:Stop {id: $from}), (b:Stop {id: $to})
           MERGE (a)-[r:CONNECTS {route_id: $routeId}]->(b)
           SET r.route_name = $routeName,
               r.route_type = $routeType,
               r.travel_min = $travelMin,
               r.seq        = $seq`,
                    {
                        from: from,
                        to: to,
                        routeId: routeId,
                        routeName: route.short_name + " – " + route.long_name,
                        routeType: route.route_type,
                        travelMin,
                        seq: i,
                    }
                );
                edgeCount++;
            }
            process.stdout.write(`  Route ${routeId} (${ordered.length} stops → ${ordered.length - 1} edges)\n`);
        }

        console.log(`\n  ✅ ${edgeCount} CONNECTS edges created`);

        // ── Create indexes ─────────────────────────────────────────────────────────
        console.log("\nCreating indexes...");
        try {
            await session.run("CREATE INDEX stop_id IF NOT EXISTS FOR (s:Stop) ON (s.id)");
            await session.run("CREATE INDEX stop_name IF NOT EXISTS FOR (s:Stop) ON (s.name)");
            await session.run("CREATE POINT INDEX stop_location IF NOT EXISTS FOR (s:Stop) ON (s.location)");
        } catch (e) {
            console.log("  (Some indexes already exist, that's OK)");
        }

        // ── Summary ────────────────────────────────────────────────────────────────
        const res = await session.run("MATCH (s:Stop) RETURN count(s) AS nodes");
        const ers = await session.run("MATCH ()-[r:CONNECTS]->() RETURN count(r) AS edges");
        console.log(`\n✅ Done!`);
        console.log(`   Nodes: ${res.records[0].get("nodes")}`);
        console.log(`   Edges: ${ers.records[0].get("edges")}`);

    } catch (e) {
        console.error("❌ Seed failed:", e.message);
        throw e;
    } finally {
        await session.close();
        await driver.close();
    }
}

seed().catch(e => { console.error(e); process.exit(1); });
