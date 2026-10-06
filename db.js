const { Pool } = require("pg");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.example)");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  keepAlive: true,
});
// Prevent the app from crashing when the database drops an idle connection
pool.on("error", e => console.error("DB pool error:", e.message));
module.exports = pool;