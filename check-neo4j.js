import neo4j from "neo4j-driver";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "api", ".env") });

async function check() {
    console.log("URI:", process.env.NEO4J_URI);
    if (!process.env.NEO4J_URI) {
        console.error("NEO4J_URI IS UNDEFINED. Check api/.env path.");
        return;
    }
    const driver = neo4j.driver(
        process.env.NEO4J_URI,
        neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
    );
    const session = driver.session({ database: process.env.NEO4J_DATABASE || "neo4j" });

    try {
        const stops = await session.run("MATCH (s:Stop {type: 'metro'}) RETURN count(s) AS count");
        console.log("Metro Stops:", stops.records[0].get("count").toNumber());

        const edges = await session.run("MATCH (:Stop {type: 'metro'})-[r:CONNECTS]->(:Stop {type: 'metro'}) RETURN count(r) AS count");
        console.log("Metro-to-Metro Edges:", edges.records[0].get("count").toNumber());

        const samples = await session.run("MATCH (a:Stop {type: 'metro'})-[r:CONNECTS]->(b:Stop {type: 'metro'}) RETURN a.name, b.name, r.route_id LIMIT 3");
        console.log("Samples:", JSON.stringify(samples.records.map(r => r.toObject()), null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await session.close();
        await driver.close();
    }
}
check();
