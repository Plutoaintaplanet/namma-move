const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.VITE_SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

// Extract project ID from https://project_id.supabase.co
const projectId = new URL(dbUrl).hostname.split('.')[0];

const client = new Client({
  host: `db.${projectId}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password: dbPassword,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

const sqlSchema = `
-- 1. Saved Locations
CREATE TABLE IF NOT EXISTS saved_locations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  name text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  address text
);

-- 2. Trip Reports (Crowdsourcing)
CREATE TABLE IF NOT EXISTS trip_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id text NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. User Savings (Tracker)
CREATE TABLE IF NOT EXISTS user_savings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  amount_saved float NOT NULL,
  co2_saved float NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Route Chat (Realtime)
CREATE TABLE IF NOT EXISTS route_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id text NOT NULL,
  text text NOT NULL,
  user_name text DEFAULT 'Commuter',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
`;

async function sync() {
  if (dbPassword === 'YOUR_DATABASE_PASSWORD_HERE') {
    console.error('❌ Please set SUPABASE_DB_PASSWORD in your .env file first!');
    process.exit(1);
  }

  console.log(`🚀 Connecting to Supabase project: ${projectId}...`);
  try {
    await client.connect();
    console.log('✅ Connected. Applying schema updates...');
    
    await client.query(sqlSchema);
    console.log('✨ All tables created/updated successfully!');

    // Enable Realtime (optional, can fail if already enabled)
    try {
        await client.query("ALTER PUBLICATION supabase_realtime ADD TABLE route_messages;");
        console.log('📡 Realtime enabled for route_messages.');
    } catch (e) {
        console.log('ℹ️ Realtime already enabled or skipping publication update.');
    }

  } catch (err) {
    console.error('❌ Error syncing SQL:', err.message);
  } finally {
    await client.end();
  }
}

sync();
