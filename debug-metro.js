import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import neo4j from 'neo4j-driver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'api/.env') });

const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function traceMetro() {
    console.log("Connecting to Neo4j...");
    const s = driver.session({ database: process.env.NEO4J_DATABASE || "neo4j" });
    try {
        // Find 2 metro stops
        const stops = await s.executeRead(tx => tx.run(`MATCH (m:Stop {type: 'metro'}) RETURN m.id as id, m.name as name LIMIT 2`));
        if (stops.records.length < 2) return console.log("No metro stops found!");

        const m1 = stops.records[0].get("id");
        const m2 = stops.records[1].get("id");
        console.log(`Testing shortest path between Metro stops ${m1} and ${m2}`);

        const pathResult = await s.executeRead(tx => tx.run(
            `MATCH (a:Stop {id: $from}), (b:Stop {id: $to})
             MATCH path = shortestPath((a)-[:CONNECTS*1..60]-(b))
             RETURN path`,
            { from: m1, to: m2 }
        ));

        if (pathResult.records.length === 0) {
            console.log("❌ Neo4j shortestPath returned NO PATH.");
        } else {
            console.log("✅ Neo4j shortestPath SUCCESS!");
            const fullQuery = await s.executeRead(tx => tx.run(
                `MATCH (a:Stop {id: $from}), (b:Stop {id: $to})
                 MATCH path = shortestPath((a)-[:CONNECTS*1..60]-(b))
                 WITH path,
                      reduce(t=0.0, r IN relationships(path) | t + r.travel_min) AS totalMin,
                      [r IN relationships(path) | r.route_id]   AS routeIds,
                      [r IN relationships(path) | r.route_name] AS routeNames,
                      [r IN relationships(path) | r.route_type] AS routeTypes,
                      [n IN nodes(path) | {id:n.id,name:n.name,lat:n.lat,lon:n.lon}] AS stops
                 RETURN stops, routeIds, routeNames, routeTypes, totalMin
                 ORDER BY totalMin LIMIT 1`,
                { from: m1, to: m2 }
            ));
            if (fullQuery.records.length > 0) console.log("✅ Route extraction query SUCCESS!\nRoute Types:", fullQuery.records[0].get("routeTypes"));
            else console.log("❌ Route extraction query FAILED.");
        }

    } catch (e) {
        console.error("Error tracing Metro:", e);
    } finally {
        await s.close();
        await driver.close();
    }
}

traceMetro();
