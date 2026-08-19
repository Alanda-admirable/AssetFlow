import { getDb, getRawClient } from "./index";
import { seedDatabaseIfEmpty } from "./seed";
import fs from "fs";
import path from "path";

let initialized = false;

export async function initDatabase() {
  if (initialized) return;

  const client = getRawClient();

  // Create tables using DDL migrations if not present
  try {
    if (typeof fs !== "undefined" && fs.existsSync) {
      const migrationDir = path.join(process.cwd(), "drizzle");
      const migrationFiles = ["0000_acoustic_monster_badoon.sql", "0001_loose_giant_girl.sql"];

      for (const file of migrationFiles) {
        const fullPath = path.join(migrationDir, file);
        if (fs.existsSync(fullPath)) {
          const sqlContent = fs.readFileSync(fullPath, "utf-8");
          const statements = sqlContent
            .split("--> statement-breakpoint")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

          for (const statement of statements) {
            try {
              await client.execute(statement);
            } catch (err: any) {
              // Ignore already exists errors during migration replay
            }
          }
        }
      }
    }
  } catch (err) {
    // In edge runtime, fs is absent; tables are already in Turso DB
  }

  // Seed database
  try {
    await seedDatabaseIfEmpty();
  } catch (err) {
    console.error("Database seed error:", err);
  }

  initialized = true;
}
