import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

/**
 * Migration to add admin_ip_address column to blogs table
 */
async function addAdminIpColumn() {
  // Create a PostgreSQL connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Initialize Drizzle ORM
  const db = drizzle(pool);

  try {
    console.log("🔄 Starting migration to add admin_ip_address column...");

    // Add the admin_ip_address column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE blogs
      ADD COLUMN IF NOT EXISTS admin_ip_address TEXT;
    `);

    console.log("✅ Migration completed successfully");
  } catch (error) {
    console.error("❌ Error during migration:", error);
    throw error;
  } finally {
    // Close the connection pool
    await pool.end();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  addAdminIpColumn()
    .then(() => {
      console.log("🚀 Migration completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    });
}

export default addAdminIpColumn;
