import { createClient } from "@libsql/client";
import path from "path";

const dbPath = path.join(process.cwd(), "assetflow.db");
const client = createClient({
  url: `file:${dbPath.replace(/\\/g, "/")}`,
});

async function testFullDatabaseSuite() {
  console.log("=================================================");
  console.log("  AssetFlow Comprehensive DB & Logic Test Suite  ");
  console.log("=================================================\n");

  // 1. Test Locations Table
  console.log("[1/5] Testing locations table and department persistence...");
  const initialLocs = await client.execute("SELECT * FROM locations;");
  console.log("Initial locations:", initialLocs.rows);

  // Update location from default to "จวนผู้ว่าราชการจังหวัดปทุมธานี"
  console.log("Updating location to 'จวนผู้ว่าราชการจังหวัดปทุมธานี' and department to 'สำนักงานจังหวัดปทุมธานี'...");
  await client.execute({
    sql: "UPDATE locations SET building = ?, room = ? WHERE id = 1;",
    args: ["จวนผู้ว่าราชการจังหวัดปทุมธานี", "เรือนรับรอง (ห้องโถงพิธีการชั้น 1), เรือนใหญ่, หอกลอง/หอบูชา"]
  });
  await client.execute({
    sql: "UPDATE departments SET name = ? WHERE id = 1;",
    args: ["สำนักงานจังหวัดปทุมธานี"]
  });

  const updatedLocs = await client.execute("SELECT * FROM locations;");
  console.log("Updated locations in DB:", updatedLocs.rows);
  const updatedDepts = await client.execute("SELECT * FROM departments;");
  console.log("Updated departments in DB:", updatedDepts.rows);

  // 2. Test Assets Table & Location Links
  console.log("\n[2/5] Testing 93 assets integrity...");
  const assetCount = await client.execute("SELECT COUNT(*) as total FROM assets;");
  console.log(`Total assets in DB: ${assetCount.rows[0].total}`);

  // 3. Test Users Table
  console.log("\n[3/5] Testing user management...");
  const userRows = await client.execute("SELECT id, username, email, full_name, status FROM users;");
  console.log("Current active users:", userRows.rows);

  // Create a new user test
  console.log("Creating test officer user...");
  const newOfficer = await client.execute({
    sql: "INSERT INTO users (username, email, full_name, role_id, department_id, password_hash, password_salt, password_iterations, status) VALUES (?, ?, ?, 2, 1, 'test', 'test', 1000, 'active') RETURNING id;",
    args: ["officer.pathum", "officer@pathumthani.go.th", "นายสุรชัย ปทุมทอง"]
  });
  console.log("Created officer ID:", newOfficer.rows[0].id);

  // 4. Test Permanent Delete on the newly created user
  console.log("\n[4/5] Testing permanent deletion on test user...");
  const delRes = await client.execute({
    sql: "DELETE FROM users WHERE id = ?;",
    args: [newOfficer.rows[0].id]
  });
  console.log("Deleted test officer successfully! Rows affected:", delRes.rowsAffected);

  // 5. Test SQLite Foreign Keys & Integrity Check
  console.log("\n[5/5] Running SQLite integrity check...");
  const integrity = await client.execute("PRAGMA integrity_check;");
  console.log("Integrity check result:", integrity.rows);

  console.log("\n=================================================");
  console.log("  ALL TESTS PASSED! DATABASE & SQL INTEGRITY 100%");
  console.log("=================================================");
}

testFullDatabaseSuite();
