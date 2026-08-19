import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { createPasswordRecord } from "../../../db/security";
import { departments, roles, users } from "../../../db/schema";
import { getActor } from "../../lib/actor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor || (actor.roleCode !== "admin" && actor.roleCode !== "asset_officer")) {
      return Response.json({ error: "ไม่มีสิทธิ์เข้าถึงข้อมูลผู้ใช้งาน" }, { status: 403 });
    }
    const db = getDb();
    const rows = await db
      .select({
        id: users.id,
        employeeCode: users.employeeCode,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        status: users.status,
        roleId: users.roleId,
        role: roles.name,
        roleCode: roles.code,
        departmentId: users.departmentId,
        department: departments.name,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .orderBy(desc(users.id));

    return Response.json({ users: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลผู้ใช้ได้";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor || (actor.roleCode !== "admin" && actor.roleCode !== "asset_officer")) {
      return Response.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเพิ่มผู้ใช้งานได้" }, { status: 403 });
    }
    const body = await request.json();
    const { fullName, username, email, employeeCode, phone, roleId, departmentId, departmentName, status, password } = body;

    if (!fullName || !email || !username) {
      return Response.json({ error: "กรุณากรอกชื่อ-นามสกุล, ชื่อผู้ใช้ และอีเมลให้ครบถ้วน" }, { status: 400 });
    }

    const db = getDb();

    // Check duplicate username
    const existing = await db
      .select({ id: users.id, username: users.username, email: users.email })
      .from(users)
      .where(eq(users.username, username.trim()));

    if (existing.length > 0) {
      return Response.json({ error: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว" }, { status: 400 });
    }

    // Auto-create or resolve custom department name if typed freely
    let targetDeptId = departmentId ? Number(departmentId) : null;
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

    const defaultPassword = password?.trim() || "AssetFlow@2569!";
    const passwordRecord = await createPasswordRecord(defaultPassword);

    const [newUser] = await db
      .insert(users)
      .values({
        employeeCode: employeeCode?.trim() || null,
        username: username.trim(),
        email: email.trim(),
        fullName: fullName.trim(),
        phone: phone?.trim() || null,
        passwordHash: passwordRecord.hash,
        passwordSalt: passwordRecord.salt,
        passwordIterations: passwordRecord.iterations,
        mustChangePassword: false,
        roleId: roleId ? Number(roleId) : 1,
        departmentId: targetDeptId,
        status: status || "active",
      })
      .returning();

    return Response.json({ success: true, user: newUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เพิ่มผู้ใช้งานไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}
