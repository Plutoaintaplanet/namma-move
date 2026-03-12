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

        // ── Create Stop nodes in batches ───────────────────────────────────────────
        console.log(`Creating ${stops.length} Stop nodes...`);
        const stopBatches = [];
        const BATCH_SIZE = 1000;

        const preparedStops = stops.map(s => ({
            id: s.id, name: s.name, lat: s.latitude, lon: s.longitude,
            type: s.id.startsWith("M") ? "metro" : "bus"
        }));

        for (let i = 0; i < preparedStops.length; i += BATCH_SIZE) {
            const batch = preparedStops.slice(i, i + BATCH_SIZE);
            await session.run(`
                UNWIND $batch AS s
                MERGE (node:Stop {id: s.id})
                SET node.name = s.name, node.lat = s.lat, node.lon = s.lon, node.type = s.type
            `, { batch });
            process.stdout.write(`  Inserted ${Math.min(i + BATCH_SIZE, stops.length)} / ${stops.length}\r`);
        }
        console.log("\n  ✅ Stop nodes created");

        // ── Build ordered route-stop map ──────────────────────────────────────────
        const routeMap = Object.fromEntries(routes.map(r => [r.id, r]));
        const byRoute = {};
        routeStops.forEach(rs => {
            if (!byRoute[rs.route_id]) byRoute[rs.route_id] = [];
            byRoute[rs.route_id].push(rs);
        });

        // ── Create CONNECTS edges in batches ───────────────────────────────────────
        console.log(`Building edge objects...`);
        const preparedEdges = [];
        for (const [routeId, rsArr] of Object.entries(byRoute)) {
            const ordered = rsArr.sort((a, b) => a.stop_sequence - b.stop_sequence);
            const route = routeMap[routeId];
            if (!route) continue;

            const isMetro = route.route_type === 1;
            const travelMin = isMetro ? 2.5 : 4;

            for (let i = 0; i < ordered.length - 1; i++) {
                preparedEdges.push({
                    from: ordered[i].stop_id,
                    to: ordered[i + 1].stop_id,
                    routeId: routeId,
                    routeName: route.short_name + " – " + route.long_name,
                    routeType: route.route_type,
                    travelMin: travelMin,
                    seq: i
                });
            }
        }

        console.log(`Creating ${preparedEdges.length} CONNECTS edges in batches...`);
        for (let i = 0; i < preparedEdges.length; i += BATCH_SIZE) {
            const batch = preparedEdges.slice(i, i + BATCH_SIZE);
            await session.run(`
                UNWIND $batch AS e
                MATCH (a:Stop {id: e.from}), (b:Stop {id: e.to})
                MERGE (a)-[r:CONNECTS {route_id: e.routeId, seq: e.seq}]->(b)
                SET r.route_name = e.routeName,
                    r.route_type = e.routeType,
                    r.travel_min = e.travelMin
                WITH a, b, e
                WHERE e.routeType = 1
                MERGE (b)-[r2:CONNECTS {route_id: e.routeId + "_REV", seq: e.seq}]->(a)
                SET r2.route_name = e.routeName + " (Reverse)",
                    r2.route_type = e.routeType,
                    r2.travel_min = e.travelMin
            `, { batch });
            process.stdout.write(`  Inserted ${Math.min(i + BATCH_SIZE, preparedEdges.length)} / ${preparedEdges.length}\r`);
        }

        console.log(`\n  ✅ All CONNECTS edges created`);

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
        console.error("\n❌ Seed failed:", e.message);
        throw e;
    } finally {
        await session.close();
        await driver.close();
    }
}

seed().catch(e => { console.error(e); process.exit(1); });
