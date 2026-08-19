import { createClient } from "@libsql/client";
import path from "path";

const dbPath = path.join(process.cwd(), "assetflow.db");
const client = createClient({
  url: `file:${dbPath.replace(/\\/g, "/")}`,
});

async function main() {
  console.log("Checking tables and users in assetflow.db...");
  try {
    const userRows = await client.execute("SELECT id, username, email, full_name, status FROM users;");
    console.log("Current users in DB:", userRows.rows);

    // Let's test foreign key check
    const fkCheck = await client.execute("PRAGMA foreign_key_check;");
    console.log("FK check result:", fkCheck.rows);

    // Let's see what happens if we delete user with ID = 4 or ID = 2 or ID = 3
    for (const u of userRows.rows) {
      if (u.id !== 1) { // Not root admin
        console.log(`\nTesting delete on user ID: ${u.id} (${u.username})...`);
        try {
          // Let's test raw delete without any cleanup to see what FK error triggers!
          await client.execute({
            sql: "DELETE FROM users WHERE id = ?",
            args: [u.id]
          });
          console.log(`Successfully deleted user ID: ${u.id}`);
        } catch (delErr) {
          console.error(`Direct delete failed for user ID ${u.id}:`, delErr.message);
        }
      }
    }

  } catch (err) {
    console.error("SQL Error encountered:", err);
  }
}

main();
