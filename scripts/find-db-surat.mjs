import { createClient } from "@libsql/client";
import path from "path";

const dbPath = path.join(process.cwd(), "assetflow.db");
const client = createClient({
  url: `file:${dbPath.replace(/\\/g, "/")}`,
});

async function main() {
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
  for (const t of tables.rows) {
    const tableName = t.name;
    if (tableName.startsWith("sqlite_") || tableName.startsWith("_")) continue;
    try {
      const rows = await client.execute(`SELECT * FROM "${tableName}";`);
      for (const r of rows.rows) {
        const jsonStr = JSON.stringify(r);
        if (jsonStr.includes("สุราษ")) {
          console.log(`Found in table [${tableName}]:`, r);
        }
      }
    } catch (e) {
      // ignore
    }
  }
}

main();
