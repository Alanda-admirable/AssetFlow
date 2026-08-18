import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { createPasswordRecord, verifyPassword } from "../../../../db/security";
import { activityLogs, users } from "../../../../db/schema";
import { getActor } from "../../../lib/actor";

function isStrongPassword(value: string) {
  return value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const body = await request.json() as { currentPassword?: string; newPassword?: string };
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (!isStrongPassword(newPassword)) return Response.json({ error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัว และมีตัวพิมพ์เล็ก พิมพ์ใหญ่ ตัวเลข และสัญลักษณ์" }, { status: 400 });
    if (currentPassword === newPassword) return Response.json({ error: "รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านเดิม" }, { status: 400 });

    const db = getDb();
    const [account] = await db.select({ hash: users.passwordHash, salt: users.passwordSalt, iterations: users.passwordIterations }).from(users).where(eq(users.id, actor.id)).limit(1);
    const valid = account?.hash && account.salt ? await verifyPassword(currentPassword, account.hash, account.salt, account.iterations) : false;
    if (!valid) return Response.json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 400 });

    const password = await createPasswordRecord(newPassword);
    await db.update(users).set({
      passwordHash: password.hash,
      passwordSalt: password.salt,
      passwordIterations: password.iterations,
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, actor.id));
    await db.insert(activityLogs).values({ userId: actor.id, action: "auth.password_change", targetType: "user", targetId: actor.id, summary: "เปลี่ยนรหัสผ่านสำเร็จ" });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ" }, { status: 500 });
  }
}
