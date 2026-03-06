require("dotenv").config();
const neo4j = require("neo4j-driver");

const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function test() {
    const session = driver.session();
    try {
        console.log("Fetching Metro coordinates...");
        const res = await session.run(`
            MATCH (n:Stop) WHERE n.name CONTAINS 'Whitefield (Kadugodi)' OR n.name CONTAINS 'Majestic Metro'
            RETURN n.id as id, n.name as name, n.lat as lat, n.lon as lon
        `);
        res.records.forEach(r => {
            console.log(r.get("name"), r.get("lat"), r.get("lon"), r.get('id'));
        });
    } catch (e) {
        console.error(e);
    } finally {
        await session.close();
        await driver.close();
    }
}
test();
