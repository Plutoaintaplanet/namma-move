import neo4j from "neo4j-driver";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "api", ".env") });

async function check() {
    console.log("URI:", process.env.NEO4J_URI);
    const driver = neo4j.driver(
        process.env.NEO4J_URI,
        neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
    );
    const session = driver.session({ database: process.env.NEO4J_DATABASE || "neo4j" });

    try {
        const busStops = await session.run("MATCH (s:Stop) WHERE s.type <> 'metro' RETURN count(s) AS count");
        console.log("Bus Stops:", busStops.records[0].get("count").toNumber());

        const busEdges = await session.run("MATCH (a:Stop)-[r:CONNECTS]->(b:Stop) WHERE a.type <> 'metro' OR b.type <> 'metro' RETURN count(r) AS count");
        console.log("Bus-related Edges:", busEdges.records[0].get("count").toNumber());

        const metroEdges = await session.run("MATCH (a:Stop)-[r:CONNECTS]->(b:Stop) WHERE a.type = 'metro' AND b.type = 'metro' RETURN count(r) AS count");
        console.log("Metro Edges:", metroEdges.records[0].get("count").toNumber());

        const sampleBusStops = await session.run("MATCH (s:Stop) WHERE s.type <> 'metro' RETURN s.name, s.id LIMIT 5");
        console.log("Sample Bus Stops:", JSON.stringify(sampleBusStops.records.map(r => r.toObject()), null, 2));

        const sampleEdges = await session.run("MATCH (a:Stop)-[r:CONNECTS]->(b:Stop) RETURN a.name, b.name, r.route_id LIMIT 10");
        console.log("Sample Edges:", JSON.stringify(sampleEdges.records.map(r => r.toObject()), null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await session.close();
        await driver.close();
    }
}
check();
