#!/usr/bin/env ts-node
import runMigration from "../migrations/init";

console.log("Starting database setup...");

runMigration()
  .then(() => {
    console.log("✅ Database setup completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Database setup failed:", error);
    process.exit(1);
  });
