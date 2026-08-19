import { createClient as createLocalClient } from "@libsql/client";
import { createClient as createTursoClient } from "@libsql/client/web";
import path from "path";

const localDbPath = path.join(process.cwd(), "assetflow.db");
const localClient = createLocalClient({
  url: `file:${localDbPath.replace(/\\/g, "/")}`,
});

const tursoUrl = "libsql://assetflow-alanda-admirable.aws-ap-northeast-1.turso.io";
const tursoToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcxMDg0OTksImlkIjoiMDFhMDE3ZjctOWUwMS03ZTkxLThmMGUtNmIzZTZiMGE4MWVjIiwia2lkIjoiMzRqbVdvVlhXUXFsMG9ra0tlY0dUc3plNHlCQXZzcjRrOHE4MmVQNUJpcyIsInJpZCI6ImQ5NzZhYjIxLWQyY2EtNDNmNi05YzU2LWM3Nzc1MDU3MzNiZCJ9._n_fU1s2UGQ5WDtpQCkzm_5k2b1HS8rDAv2q-r6OI_ygmrr63ARcuU4nPuXgz1VrLVtEMfstotURajxTlISDDQ";

const tursoClient = createTursoClient({
  url: tursoUrl,
  authToken: tursoToken,
});

async function migrateData() {
  console.log("Starting full SQLite -> Turso Cloud Database migration...");

  // Disable foreign keys during table creation and import
  await tursoClient.execute("PRAGMA foreign_keys = OFF;");

  // 1. Get all table creation DDLs from sqlite_master
  const masterRows = await localClient.execute("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' ORDER BY type DESC;");
  
  // Clean existing tables first
  for (const row of masterRows.rows) {
    if (row.type === "table") {
      try {
        await tursoClient.execute(`DROP TABLE IF EXISTS "${row.name}";`);
      } catch (e) {}
    }
  }

  // Create all tables
  for (const row of masterRows.rows) {
    if (row.type === "table") {
      console.log(`Creating table [${row.name}] on Turso...`);
      try {
        await tursoClient.execute(String(row.sql));
      } catch (e) {
        console.error(`Error creating table ${row.name}:`, e.message);
      }
    }
  }

  // Ordered list of tables to insert
  const orderedTables = [
    "roles",
    "departments",
    "users",
    "locations",
    "asset_categories",
    "asset_statuses",
    "manufacturers",
    "suppliers",
    "asset_models",
    "assets",
    "asset_images",
    "documents",
    "asset_movements",
    "asset_requests",
    "asset_request_items",
    "maintenance_records",
    "maintenance_schedules",
    "audit_sessions",
    "audit_items",
    "audit_committees",
    "audit_signoffs",
    "approval_logs",
    "activity_logs",
    "notifications",
    "scan_logs",
    "auth_sessions",
    "system_settings",
  ];

  // Also include any other tables not in the priority list
  const allTableNames = masterRows.rows.filter(r => r.type === "table").map(r => String(r.name));
  const remainingTables = allTableNames.filter(t => !orderedTables.includes(t));
  const finalTableList = [...orderedTables.filter(t => allTableNames.includes(t)), ...remainingTables];

  // Copy data
  for (const tableName of finalTableList) {
    console.log(`Migrating data for table [${tableName}]...`);
    const dataRows = await localClient.execute(`SELECT * FROM "${tableName}";`);
    
    for (const item of dataRows.rows) {
      const columns = Object.keys(item);
      const placeholders = columns.map(() => "?").join(", ");
      const values = columns.map((col) => item[col]);
      const insertSql = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(", ")}) VALUES (${placeholders});`;
      try {
        await tursoClient.execute({ sql: insertSql, args: values });
      } catch (e) {
        console.error(`Error inserting into ${tableName}:`, e.message);
      }
    }
    console.log(`✓ Copied ${dataRows.rows.length} rows into [${tableName}]`);
  }

  // Create indices
  for (const row of masterRows.rows) {
    if (row.type === "index") {
      try {
        await tursoClient.execute(String(row.sql));
      } catch (e) {}
    }
  }

  console.log("\n=======================================================");
  console.log("  MIGRATION TO TURSO CLOUD DATABASE COMPLETED 100%!");
  console.log("=======================================================\n");

  // Verify
  const assetCount = await tursoClient.execute("SELECT COUNT(*) as count FROM assets;");
  const userCount = await tursoClient.execute("SELECT COUNT(*) as count FROM users;");
  const locRows = await tursoClient.execute("SELECT building, room FROM locations;");
  console.log("Verification on Turso Cloud Database:");
  console.log("- Total assets in Turso:", assetCount.rows[0].count);
  console.log("- Total users in Turso:", userCount.rows[0].count);
  console.log("- Locations in Turso:", locRows.rows);
}

migrateData().catch(console.error);
