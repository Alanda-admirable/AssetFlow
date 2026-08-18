import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { createPasswordRecord } from "../../../../db/security";
import { users } from "../../../../db/schema";
import { getActor } from "../../../lib/actor";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(request);
    if (!actor || actor.roleCode !== "admin") {
      return Response.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถแก้ไขข้อมูลผู้ใช้ได้" }, { status: 403 });
    }
    const { id: idParam } = await context.params;
    const targetUserId = Number(idParam);
    if (!targetUserId || Number.isNaN(targetUserId)) {
      return Response.json({ error: "รหัสผู้ใช้ไม่ถูกต้อง" }, { status: 400 });
    }

    const body = await request.json();
    const { fullName, email, employeeCode, phone, roleId, departmentId, status, resetPassword } = body;

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
    if (departmentId !== undefined) updateData.departmentId = departmentId ? Number(departmentId) : null;
    if (status !== undefined) updateData.status = String(status);

    if (resetPassword && String(resetPassword).trim()) {
      const passwordRecord = await createPasswordRecord(String(resetPassword).trim());
      updateData.passwordHash = passwordRecord.hash;
      updateData.passwordSalt = passwordRecord.salt;
      updateData.passwordIterations = passwordRecord.iterations;
    }

    await db.update(users).set(updateData).where(eq(users.id, targetUserId));

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "แก้ไขข้อมูลผู้ใช้งานไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(request);
    if (!actor || actor.roleCode !== "admin") {
      return Response.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถลบผู้ใช้ได้" }, { status: 403 });
    }
    const { id: idParam } = await context.params;
    const targetUserId = Number(idParam);
    if (!targetUserId || Number.isNaN(targetUserId)) {
      return Response.json({ error: "รหัสผู้ใช้ไม่ถูกต้อง" }, { status: 400 });
    }

    if (targetUserId === actor.id) {
      return Response.json({ error: "ไม่สามารถลบบัญชีผู้ใช้งานของตนเองที่กำลังเข้าสู่ระบบอยู่ได้" }, { status: 400 });
    }

    const db = getDb();
    await db.delete(users).where(eq(users.id, targetUserId));

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ลบผู้ใช้งานไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}
