import { eq, sql } from "drizzle-orm";
import { getDb, getRawClient } from "../../../db";
import { assets, departments, locations } from "../../../db/schema";
import { canManage, getActor } from "../../lib/actor";

export const dynamic = "force-dynamic";

// GET: ดึงรายการสถานที่จัดเก็บทั้งหมดพร้อมรายละเอียดหน่วยงานและห้องย่อย
export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

    const db = getDb();
    const locRows = await db.select().from(locations);
    const deptRows = await db.select().from(departments);

    return Response.json({ locations: locRows, departments: deptRows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "โหลดข้อมูลสถานที่จัดเก็บไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}

// POST: เพิ่มสถานที่จัดเก็บใหม่
export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (!canManage(actor)) return Response.json({ error: "ไม่มีสิทธิ์จัดการสถานที่" }, { status: 403 });

    const body = await request.json();
    const { name, rooms, department } = body;

    if (!name || !String(name).trim()) {
      return Response.json({ error: "กรุณาระบุชื่อสถานที่จัดเก็บ" }, { status: 400 });
    }

    const db = getDb();
    const locName = String(name).trim();
    const roomDetails = String(rooms || "ห้องทั่วไป").trim();
    const deptName = String(department || "สำนักงานจังหวัด").trim();

    // สร้าง Department ถ้ายังไม่มี
    let deptId: number | null = null;
    if (deptName) {
      const [existingDept] = await db.select().from(departments).where(eq(departments.name, deptName)).limit(1);
      if (existingDept) {
        deptId = existingDept.id;
      } else {
        const [newDept] = await db.insert(departments).values({
          code: `DEPT-${Date.now().toString(36)}`,
          name: deptName,
        }).returning();
        deptId = newDept.id;
      }
    }

    // สร้าง Location
    const locCode = `LOC-${Date.now().toString(36)}`;
    const [newLoc] = await db.insert(locations).values({
      code: locCode,
      building: locName,
      floor: "1",
      room: roomDetails,
      departmentId: deptId,
      isActive: true,
    }).returning();

    return Response.json({ success: true, location: newLoc });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เพิ่มสถานที่จัดเก็บไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}

// PUT: แก้ไขชื่อสถานที่จัดเก็บ / อัปเดตข้อมูลสถานที่และพัสดุในฐานข้อมูลจริงถาวร
export async function PUT(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (!canManage(actor)) return Response.json({ error: "ไม่มีสิทธิ์จัดการสถานที่" }, { status: 403 });

    const body = await request.json();
    const { oldName, newName, rooms, department } = body;

    if (!newName || !String(newName).trim()) {
      return Response.json({ error: "กรุณาระบุชื่อสถานที่จัดเก็บใหม่" }, { status: 400 });
    }

    const rawOldName = String(oldName || "").trim();
    const targetNewName = String(newName).trim();
    const targetRooms = String(rooms || "").trim();
    const targetDept = String(department || "").trim();

    const rawClient = getRawClient();

    // 1. อัปเดตตาราง locations — exact match only, no LIKE
    if (rawOldName && rawOldName !== targetNewName) {
      await rawClient.execute({
        sql: "UPDATE locations SET building = ? WHERE building = ?",
        args: [targetNewName, rawOldName],
      });
    }

    if (targetRooms) {
      await rawClient.execute({
        sql: "UPDATE locations SET room = ? WHERE building = ?",
        args: [targetRooms, targetNewName],
      });
    }

    // 2. อัปเดตตาราง departments — find by location's departmentId, not first row
    if (targetDept) {
      const db = getDb();
      const locRows = await rawClient.execute({
        sql: "SELECT department_id FROM locations WHERE building = ? LIMIT 1",
        args: [targetNewName],
      });
      const deptId = locRows.rows[0]?.department_id;
      if (deptId) {
        await db.update(departments).set({ name: targetDept }).where(eq(departments.id, Number(deptId)));
      } else {
        const [existingDept] = await db.select().from(departments).where(eq(departments.name, targetDept)).limit(1);
        if (!existingDept) {
          await db.insert(departments).values({ code: `DEPT-${Date.now().toString(36)}`, name: targetDept });
        }
      }
    }

    // 3. ถ้าไม่มี location ใดๆ ในตารางเลย ให้สร้างขึ้นใหม่
    const locCheck = await rawClient.execute("SELECT COUNT(*) as count FROM locations;");
    if (Number(locCheck.rows[0]?.count || 0) === 0) {
      await rawClient.execute({
        sql: "INSERT INTO locations (code, building, floor, room, is_active) VALUES (?, ?, '1', ?, 1);",
        args: [`LOC-${Date.now().toString(36)}`, targetNewName, targetRooms || "ห้องทั่วไป"],
      });
    }

    return Response.json({
      success: true,
      message: `อัปเดตข้อมูลสถานที่จัดเก็บ "${targetNewName}" ลงฐานข้อมูลเรียบร้อยแล้ว`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "แก้ไขสถานที่จัดเก็บไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}

// DELETE: ลบสถานที่จัดเก็บออกจากฐานข้อมูลจริง
export async function DELETE(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (!canManage(actor)) return Response.json({ error: "ไม่มีสิทธิ์จัดการสถานที่" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const locName = String(body.locationName || "").trim();

    if (!locName) {
      return Response.json({ error: "กรุณาระบุชื่อสถานที่ที่ต้องการลบ" }, { status: 400 });
    }

    const rawClient = getRawClient();
    await rawClient.execute({
      sql: "UPDATE assets SET location_id = NULL WHERE location_id IN (SELECT id FROM locations WHERE building = ?)",
      args: [locName],
    });
    await rawClient.execute({
      sql: "DELETE FROM locations WHERE building = ?",
      args: [locName],
    });

    return Response.json({ success: true, message: `ลบสถานที่ "${locName}" ออกจากระบบเรียบร้อยแล้ว` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ลบสถานที่จัดเก็บไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}
