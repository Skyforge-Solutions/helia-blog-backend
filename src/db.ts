// Database connection setup
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import runMigration from "./migrations/init";

// Create an optimized PostgreSQL connection pool with better timeout settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Increased: wait up to 10 seconds for connection
  maxUses: 7500, // Close and replace a connection after it has been used this many times
  allowExitOnIdle: false, // Prevent immediate termination of the pool
});

// Listen for errors on the pool
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  // Don't crash on connection errors
});

// Helper function to get a client with proper release handling
export async function withClient<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

// Export the drizzle instance
export const db = drizzle(pool);

// Database initialization with migrations
export async function init() {
  try {
    // Run migrations to ensure tables exist and admin is created
    console.log("Running database migrations...");
    await runMigration();

    // Test connection to verify it's working
    await withClient(async (client) => {
      const result = await client.query("SELECT NOW() as time");
      console.log(
        `Database connection test successful at ${result.rows[0].time}`
      );
    });

    console.log("Database initialization completed");
    return db;
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}

// Enable better query debugging in development
if (process.env.NODE_ENV !== "production") {
  // @ts-ignore - debug is an internal property
  db.debug = true;
}

// Graceful shutdown function
export async function closeDatabase() {
  try {
    await pool.end();
    console.log("Database connection pool has been closed");
  } catch (err) {
    console.error("Error closing database pool:", err);
  }
}
