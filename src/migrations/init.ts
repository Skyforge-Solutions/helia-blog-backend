import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { admins, blogs } from "../schema";
import { sql } from "drizzle-orm";
import * as bcrypt from "bcrypt";

/**
 * Main migration function to create tables and seed initial data
 */
async function runMigration() {
  // Create a PostgreSQL connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Initialize Drizzle ORM
  const db = drizzle(pool);

  try {
    console.log("🔄 Starting database migration and seeding...");

    // Create tables if they don't exist
    console.log("📊 Creating tables...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS blogs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        summary VARCHAR(200),
        author_name VARCHAR(50) NOT NULL,
        author_email VARCHAR(100) NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'pending',
        views INTEGER NOT NULL DEFAULT 0,
        submission_date TIMESTAMPTZ NOT NULL DEFAULT now(),
        approval_date TIMESTAMPTZ,
        last_modified TIMESTAMPTZ NOT NULL DEFAULT now(),
        ip_address TEXT NOT NULL,
        admin_notes TEXT
      );
      
      -- Drop the old admins table if it exists (to remove email field)
      DROP TABLE IF EXISTS admins;
      
      -- Create new admins table without email field
      CREATE TABLE admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_login TIMESTAMPTZ
      );
    `);

    // Get admin credentials from env vars
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "strongpassword";

    // Hash the admin password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

    // Check if admin user exists
    const adminUsers = await db
      .select()
      .from(admins)
      .where(sql`username = ${adminUsername}`)
      .execute();

    if (adminUsers.length === 0) {
      // Admin doesn't exist, create it
      console.log("👤 Creating admin user...");

      await db
        .insert(admins)
        .values({
          username: adminUsername,
          password: hashedPassword,
        })
        .execute();

      console.log("✅ Admin user created successfully");
    } else {
      // Admin exists, update password to match env var
      console.log("🔄 Checking admin credentials...");

      // Update the admin credentials to match env vars
      await db
        .update(admins)
        .set({
          password: hashedPassword,
        })
        .where(sql`username = ${adminUsername}`)
        .execute();

      console.log("✅ Admin credentials updated successfully");
    }

    console.log("✅ Database migration and seeding completed successfully");
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
  runMigration()
    .then(() => {
      console.log("🚀 Migration completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    });
}

export default runMigration;
