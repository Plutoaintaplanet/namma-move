const path = require("path");
const env = require("dotenv").config({ path: path.join(__dirname, "../api/.env") });

console.log("--- Environment Debug ---");
if (env.error) {
    console.log("❌ Error loading .env:", env.error.message);
} else {
    console.log("✅ .env loaded successfully.");
}

const keys = Object.keys(process.env).filter(k => k.startsWith("NEO4J_"));
console.log("Detected NEO4J Keys:", keys);

if (keys.length < 3) {
    console.log("⚠️ WARNING: You are missing one or more required keys (URI, USER, PASSWORD).");
}
