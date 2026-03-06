require("dotenv").config();
const neo4j = require("neo4j-driver");

const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function test() {
    const session = driver.session();
    try {
        console.log("Testing Metro connection...");
        const res = await session.run(`
            MATCH (a:Stop {name: "Whitefield (Kadugodi) Metro Station"}), (b:Stop {name: "Nadaprabhu Kempegowda Station, Majestic Metro Station"})
            MATCH path = shortestPath((a)-[:CONNECTS*]-(b))
            RETURN [n in nodes(path) | n.name] as p
        `);
        console.log("Found path:", res.records.length > 0 ? res.records[0].get("p").length + " stops" : "None");
        if (res.records.length > 0) {
            console.log(res.records[0].get("p").slice(0, 5));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await session.close();
        await driver.close();
    }
}
test();
