import { createClient } from "@libsql/client";
import path from "path";

const dbPath = path.join(process.cwd(), "assetflow.db");
const client = createClient({
  url: `file:${dbPath.replace(/\\/g, "/")}`,
});

async function main() {
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
  console.log("All tables in SQLite:", tables.rows.map(t => t.name));

  for (const t of tables.rows) {
    const tableName = t.name;
    if (tableName.startsWith("sqlite_") || tableName.startsWith("_")) continue;
    const fks = await client.execute(`PRAGMA foreign_key_list("${tableName}");`);
    for (const fk of fks.rows) {
      if (fk.table === "users") {
        console.log(`Table [${tableName}] Column [${fk.from}] -> references users(id)`);
      }
    }
  }
}

main();
