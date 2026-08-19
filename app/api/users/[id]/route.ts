import { eq } from "drizzle-orm";
import { getDb, getRawClient } from "../../../../db";
import { createPasswordRecord } from "../../../../db/security";
import { departments, users } from "../../../../db/schema";
import { getActor } from "../../../lib/actor";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const actor = await getActor(request);
    if (!actor || (actor.roleCode !== "admin" && actor.roleCode !== "asset_officer")) {
      return Response.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถแก้ไขข้อมูลผู้ใช้ได้" }, { status: 403 });
    }
    const rawParams = await context.params;
    const targetUserId = Number(rawParams?.id);
    if (!targetUserId || Number.isNaN(targetUserId)) {
      return Response.json({ error: "รหัสผู้ใช้ไม่ถูกต้อง" }, { status: 400 });
    }

    const body = await request.json();
    const { fullName, email, employeeCode, phone, roleId, departmentId, departmentName, status, resetPassword } = body;

    const db = getDb();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetUserId));
    if (!existing) {
      return Response.json({ error: "ไม่พบผู้ใช้งานนี้ในระบบ" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (fullName !== undefined) updateData.fullName = String(fullName).trim();
    if (email !== undefined) updateData.email = String(email).trim();
    if (employeeCode !== undefined) updateData.employeeCode = employeeCode ? String(employeeCode).trim() : null;
    if (phone !== undefined) updateData.phone = phone ? String(phone).trim() : null;
    if (roleId !== undefined) updateData.roleId = roleId ? Number(roleId) : null;
    
    // Auto-create or resolve custom department name if typed
    let targetDeptId = departmentId !== undefined ? (departmentId ? Number(departmentId) : null) : undefined;
    const customDept = String(departmentName || "").trim();
    if (customDept) {
      const [existingDept] = await db.select().from(departments).where(eq(departments.name, customDept)).limit(1);
      if (existingDept) {
        targetDeptId = existingDept.id;
      } else {
        const [newDept] = await db.insert(departments).values({
          code: `DEPT-${Date.now().toString().slice(-4)}`,
          name: customDept,
        }).returning();
        targetDeptId = newDept.id;
      }
    }
    if (targetDeptId !== undefined) updateData.departmentId = targetDeptId;

    if (status !== undefined) updateData.status = String(status);

    if (resetPassword && String(resetPassword).trim()) {
      const passwordRecord = await createPasswordRecord(String(resetPassword).trim());
      updateData.passwordHash = passwordRecord.hash;
      updateData.passwordSalt = passwordRecord.salt;
      updateData.passwordIterations = passwordRecord.iterations;
    }

    await db.update(users).set(updateData).where(eq(users.id, targetUserId));

    return Response.json({ success: true, message: "อัปเดตข้อมูลผู้ใช้งานเรียบร้อยแล้ว" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "แก้ไขข้อมูลผู้ใช้งานไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const actor = await getActor(request);
    if (!actor || (actor.roleCode !== "admin" && actor.roleCode !== "asset_officer")) {
      return Response.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถลบผู้ใช้ได้" }, { status: 403 });
    }
    const rawParams = await context.params;
    const targetUserId = Number(rawParams?.id);
    if (!targetUserId || Number.isNaN(targetUserId)) {
      return Response.json({ error: "รหัสผู้ใช้ไม่ถูกต้อง" }, { status: 400 });
    }

    if (targetUserId === actor.id) {
      return Response.json({ error: "ไม่สามารถลบบัญชีผู้ใช้งานของตนเองที่กำลังเข้าสู่ระบบอยู่ได้" }, { status: 400 });
    }

    const rawClient = getRawClient();

    // 1. เคลียร์ Foreign Key ในทุกตารางของ SQLite อย่างสมบูรณ์แบบ
    await rawClient.execute({ sql: "DELETE FROM auth_sessions WHERE user_id = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "DELETE FROM activity_logs WHERE user_id = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "DELETE FROM notifications WHERE user_id = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "DELETE FROM scan_logs WHERE scanned_by = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "DELETE FROM audit_committees WHERE user_id = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "DELETE FROM audit_signoffs WHERE user_id = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "DELETE FROM approval_logs WHERE approver_id = ?", args: [targetUserId] });

    await rawClient.execute({ sql: "UPDATE assets SET assigned_user_id = NULL WHERE assigned_user_id = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "UPDATE assets SET created_by = NULL WHERE created_by = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "UPDATE asset_images SET uploaded_by = NULL WHERE uploaded_by = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "UPDATE documents SET uploaded_by = NULL WHERE uploaded_by = ?", args: [targetUserId] });
    
    await rawClient.execute({ sql: "UPDATE asset_movements SET from_user_id = NULL WHERE from_user_id = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "UPDATE asset_movements SET to_user_id = NULL WHERE to_user_id = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "UPDATE asset_movements SET performed_by = NULL WHERE performed_by = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "UPDATE asset_acceptances SET accepted_by = NULL WHERE accepted_by = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "UPDATE return_checklists SET checked_by = NULL WHERE checked_by = ?", args: [targetUserId] });

    await rawClient.execute({ sql: "UPDATE audit_items SET checked_by = NULL WHERE checked_by = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "UPDATE audit_sessions SET created_by = NULL WHERE created_by = ?", args: [targetUserId] });

    await rawClient.execute({ sql: "UPDATE asset_requests SET requester_id = NULL WHERE requester_id = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "UPDATE maintenance_records SET reported_by = NULL WHERE reported_by = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "UPDATE disposal_requests SET requested_by = NULL WHERE requested_by = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "UPDATE disposal_requests SET approved_by = NULL WHERE approved_by = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "UPDATE saved_reports SET owner_id = NULL WHERE owner_id = ?", args: [targetUserId] });
    await rawClient.execute({ sql: "UPDATE import_jobs SET uploaded_by = NULL WHERE uploaded_by = ?", args: [targetUserId] });

    // 2. ลบผู้ใช้งานออกจากตาราง users ถาวร 100% (Hard Delete)
    const delResult = await rawClient.execute({ sql: "DELETE FROM users WHERE id = ?", args: [targetUserId] });

    return Response.json({
      success: true,
      message: "ลบผู้ใช้งานออกจากระบบอย่างถาวรเรียบร้อยแล้ว",
      rowsAffected: delResult.rowsAffected
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ลบผู้ใช้งานไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const body = await request.clone().json().catch(() => ({}));
  if (body._method === "DELETE") return DELETE(request, context);
  if (body._method === "PUT") return PUT(request, context);
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}
