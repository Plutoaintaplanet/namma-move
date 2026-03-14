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
    const dbName = (process.env.NEO4J_DATABASE || "").trim() || undefined;
    const session = driver.session({ database: dbName });
    console.log(`🌱 Seeding Neo4j database: ${dbName || 'default'}...\n`);

    try {
        // ── Clear existing data ────────────────────────────────────────────────────
        console.log("Clearing existing Stop nodes and CONNECTS edges...");
        await session.run("MATCH (n:Stop) DETACH DELETE n");

        // ── Create Stop nodes ────────────────────────────────────────────────────
        console.log(`Creating ${stops.length} Stop nodes...`);
        const formattedStops = stops.map(s => ({
            id: s.id, name: s.name, lat: s.latitude, lon: s.longitude,
            type: s.id.toString().startsWith("M") ? "metro" : "bus"
        }));
        
        // Chunk stop insertion to avoid large payload errors
        for (let i = 0; i < formattedStops.length; i += 2000) {
            const chunk = formattedStops.slice(i, i + 2000);
            await session.run(
                `UNWIND $batch AS s
                 MERGE (n:Stop {id: s.id})
                 SET n.name = s.name, 
                     n.lat = s.lat, 
                     n.lon = s.lon, 
                     n.type = s.type,
                     n.pos = point({latitude: s.lat, longitude: s.lon})`,
                { batch: chunk }
            );
            process.stdout.write(`  Inserted ${Math.min(i + 2000, formattedStops.length)} stops...\r`);
        }
        console.log("\n  ✅ Stop nodes created");

        // ── Build ordered route-stop map ──────────────────────────────────────────
        const routeMap = Object.fromEntries(routes.map(r => [r.id, r]));
        const byRoute = {};
        routeStops.forEach(rs => {
            if (!byRoute[rs.route_id]) byRoute[rs.route_id] = [];
            byRoute[rs.route_id].push(rs);
        });

        // ── Create CONNECTS edges between consecutive stops ───────────────────────
        let edgeCount = 0;
        const edgeBatch = [];
        for (const [routeId, rsArr] of Object.entries(byRoute)) {
            const ordered = rsArr.sort((a, b) => a.stop_sequence - b.stop_sequence);
            const route = routeMap[routeId];
            if (!route) continue;

            const isMetro = route.route_type === 1;
            const travelMin = isMetro ? 2.5 : 4;

            for (let i = 0; i < ordered.length - 1; i++) {
                const edge = {
                    from: ordered[i].stop_id,
                    to: ordered[i + 1].stop_id,
                    routeId: routeId,
                    routeName: route.short_name + " – " + route.long_name,
                    routeType: route.route_type,
                    travelMin: travelMin,
                    seq: i
                };
                edgeBatch.push(edge);

                // If Metro, add the return direction as well
                if (isMetro) {
                    edgeBatch.push({
                        ...edge,
                        from: ordered[i + 1].stop_id,
                        to: ordered[i].stop_id,
                        seq: i // same seq or reversed, doesn't matter much for shortestPath
                    });
                }
            }
        }

        console.log(`Batch creating ${edgeBatch.length} edges...`);
        // Neo4j handles up to ~10k efficiently in one UNWIND, let's chunk it
        const chunkSize = 5000;
        for (let i = 0; i < edgeBatch.length; i += chunkSize) {
            const chunk = edgeBatch.slice(i, i + chunkSize);
            await session.run(
                `UNWIND $batch AS e
                 MATCH (a:Stop {id: e.from}), (b:Stop {id: e.to})
                 MERGE (a)-[r:CONNECTS {route_id: e.routeId}]->(b)
                 SET r.route_name = e.routeName,
                     r.route_type = e.routeType,
                     r.travel_min = e.travelMin,
                     r.seq        = e.seq`,
                { batch: chunk }
            );
            edgeCount += chunk.length;
            process.stdout.write(`  Inserted ${edgeCount} edges...\n`);
        }

        console.log(`\n  ✅ ${edgeCount} CONNECTS edges created`);

        // ── Create indexes ─────────────────────────────────────────────────────────
        console.log("\nCreating indexes...");
        try {
            await session.run("CREATE INDEX stop_id IF NOT EXISTS FOR (s:Stop) ON (s.id)");
            await session.run("CREATE INDEX stop_name IF NOT EXISTS FOR (s:Stop) ON (s.name)");
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
