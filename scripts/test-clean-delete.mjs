import { createClient } from "@libsql/client";
import path from "path";

const dbPath = path.join(process.cwd(), "assetflow.db");
const client = createClient({
  url: `file:${dbPath.replace(/\\/g, "/")}`,
});

export async function deleteUserPermanently(userId) {
  const targetUserId = Number(userId);
  console.log(`Starting permanent hard delete for user ID ${targetUserId}...`);

  // เคลียร์ทุกตารางที่อ้างอิง users(id) ใน SQLite อย่างสมบูรณ์แบบ
  await client.execute({ sql: "DELETE FROM auth_sessions WHERE user_id = ?", args: [targetUserId] });
  await client.execute({ sql: "DELETE FROM activity_logs WHERE user_id = ?", args: [targetUserId] });
  await client.execute({ sql: "DELETE FROM notifications WHERE user_id = ?", args: [targetUserId] });
  await client.execute({ sql: "DELETE FROM scan_logs WHERE scanned_by = ?", args: [targetUserId] });
  await client.execute({ sql: "DELETE FROM audit_committees WHERE user_id = ?", args: [targetUserId] });
  await client.execute({ sql: "DELETE FROM audit_signoffs WHERE user_id = ?", args: [targetUserId] });
  await client.execute({ sql: "DELETE FROM approval_logs WHERE approver_id = ?", args: [targetUserId] });

  await client.execute({ sql: "UPDATE assets SET assigned_user_id = NULL WHERE assigned_user_id = ?", args: [targetUserId] });
  await client.execute({ sql: "UPDATE assets SET created_by = NULL WHERE created_by = ?", args: [targetUserId] });
  await client.execute({ sql: "UPDATE asset_images SET uploaded_by = NULL WHERE uploaded_by = ?", args: [targetUserId] });
  await client.execute({ sql: "UPDATE documents SET uploaded_by = NULL WHERE uploaded_by = ?", args: [targetUserId] });
  
  await client.execute({ sql: "UPDATE asset_movements SET from_user_id = NULL WHERE from_user_id = ?", args: [targetUserId] });
  await client.execute({ sql: "UPDATE asset_movements SET to_user_id = NULL WHERE to_user_id = ?", args: [targetUserId] });
  await client.execute({ sql: "UPDATE asset_movements SET performed_by = NULL WHERE performed_by = ?", args: [targetUserId] });
  await client.execute({ sql: "UPDATE asset_acceptances SET accepted_by = NULL WHERE accepted_by = ?", args: [targetUserId] });
  await client.execute({ sql: "UPDATE return_checklists SET checked_by = NULL WHERE checked_by = ?", args: [targetUserId] });

  await client.execute({ sql: "UPDATE audit_items SET checked_by = NULL WHERE checked_by = ?", args: [targetUserId] });
  await client.execute({ sql: "UPDATE audit_sessions SET created_by = NULL WHERE created_by = ?", args: [targetUserId] });

  await client.execute({ sql: "UPDATE asset_requests SET requester_id = NULL WHERE requester_id = ?", args: [targetUserId] });
  await client.execute({ sql: "UPDATE maintenance_records SET reported_by = NULL WHERE reported_by = ?", args: [targetUserId] });
  await client.execute({ sql: "UPDATE disposal_requests SET requested_by = NULL WHERE requested_by = ?", args: [targetUserId] });
  await client.execute({ sql: "UPDATE disposal_requests SET approved_by = NULL WHERE approved_by = ?", args: [targetUserId] });
  await client.execute({ sql: "UPDATE saved_reports SET owner_id = NULL WHERE owner_id = ?", args: [targetUserId] });
  await client.execute({ sql: "UPDATE import_jobs SET uploaded_by = NULL WHERE uploaded_by = ?", args: [targetUserId] });

  // ลบออกจากตาราง users ถาวร
  const delResult = await client.execute({ sql: "DELETE FROM users WHERE id = ?", args: [targetUserId] });
  console.log(`User ID ${targetUserId} permanently deleted! Rows affected:`, delResult.rowsAffected);
}

async function run() {
  const users = await client.execute("SELECT id, username, full_name, status FROM users;");
  console.log("Current users before delete:", users.rows);

  // Test deleting inactive test users (2, 3, 4, 5)
  for (const u of users.rows) {
    if (u.id !== 1) {
      await deleteUserPermanently(u.id);
    }
  }

  const remaining = await client.execute("SELECT id, username, full_name, status FROM users;");
  console.log("\nRemaining users after permanent delete:", remaining.rows);
}

run();
