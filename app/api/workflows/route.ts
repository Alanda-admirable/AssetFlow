import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { seedDatabaseIfEmpty } from "../../../db/seed";
import {
  activityLogs,
  approvalLogs,
  assetMovements,
  assetRequestItems,
  assetRequests,
  assets,
  maintenanceRecords,
  notifications,
  systemSettings,
} from "../../../db/schema";
import { canApprove, canManage, getActor, isAdmin } from "../../lib/actor";

export async function POST(request: Request) {
  try {
    await seedDatabaseIfEmpty();
    const actor = await getActor(request);
    if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const command = String(body.command || "");
    const db = getDb();

    if (["approve", "reject"].includes(command)) {
      if (!canApprove(actor)) return Response.json({ error: "ไม่มีสิทธิ์อนุมัติคำขอ" }, { status: 403 });
      const requestId = Number(body.requestId);
      const status = command === "approve" ? "approved" : "rejected";
      await db.update(assetRequests).set({ status, updatedAt: new Date().toISOString() }).where(eq(assetRequests.id, requestId));
      await db.insert(approvalLogs).values({ requestId, stepNo: 1, approverId: actor.id, action: command, comment: String(body.comment || "") });
      await db.insert(activityLogs).values({ userId: actor.id, action: `request.${command}`, targetType: "request", targetId: requestId, summary: `${command === "approve" ? "อนุมัติ" : "ไม่อนุมัติ"}คำขอเลขที่ #${requestId}` });
      return Response.json({ ok: true });
    }

    if (["checkout", "checkin"].includes(command)) {
      if (!canManage(actor)) return Response.json({ error: "ไม่มีสิทธิ์ส่งมอบหรือรับคืน" }, { status: 403 });
      const requestId = Number(body.requestId);
      const items = await db.select().from(assetRequestItems).where(eq(assetRequestItems.requestId, requestId));
      const status = command === "checkout" ? "checked_out" : "completed";
      await db.update(assetRequests).set({ status, completedAt: command === "checkin" ? new Date().toISOString() : null }).where(eq(assetRequests.id, requestId));
      for (const item of items) {
        await db.update(assetRequestItems).set({ itemStatus: command === "checkout" ? "checked_out" : "returned", returnCondition: command === "checkin" ? String(body.condition || "good") : null }).where(eq(assetRequestItems.id, item.id));
        await db.insert(assetMovements).values({ assetId: item.assetId, movementType: command, requestId, performedBy: actor.id, note: String(body.note || "") });
      }
      await db.insert(activityLogs).values({ userId: actor.id, action: `request.${command}`, targetType: "request", targetId: requestId, summary: command === "checkout" ? `ส่งมอบครุภัณฑ์สำหรับคำขอ #${requestId}` : `รับคืนครุภัณฑ์สำหรับคำขอ #${requestId}` });
      return Response.json({ ok: true });
    }

    if (command === "transfer") {
      if (!canManage(actor)) return Response.json({ error: "ไม่มีสิทธิ์โอนย้ายครุภัณฑ์" }, { status: 403 });
      const assetId = Number(body.assetId);
      const locationId = Number(body.locationId);
      const [before] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
      await db.update(assets).set({ locationId, departmentId: Number(body.departmentId) || before.departmentId, updatedAt: new Date().toISOString() }).where(eq(assets.id, assetId));
      await db.insert(assetMovements).values({ assetId, movementType: "transfer", fromLocationId: before.locationId, toLocationId: locationId, performedBy: actor.id, note: String(body.note || "") });
      await db.insert(activityLogs).values({ userId: actor.id, action: "asset.transfer", targetType: "asset", targetId: assetId, summary: `โอนย้ายครุภัณฑ์ ${before.assetCode}` });
      return Response.json({ ok: true });
    }

    if (command === "maintenance") {
      const assetId = Number(body.assetId);
      const problem = String(body.problem || "").trim();
      if (!assetId || !problem) return Response.json({ error: "กรุณาเลือกครุภัณฑ์และระบุอาการ" }, { status: 400 });
      const maintenanceNo = `MT-${new Date().getFullYear() + 543}-${String(Date.now()).slice(-5)}`;
      const [created] = await db.insert(maintenanceRecords).values({ maintenanceNo, assetId, reportedBy: actor.id, problem, priority: String(body.priority || "normal"), status: "reported", dueAt: String(body.dueAt || "") }).returning();
      await db.insert(activityLogs).values({ userId: actor.id, action: "maintenance.create", targetType: "maintenance", targetId: created.id, summary: `แจ้งซ่อม ${maintenanceNo}` });
      return Response.json({ maintenance: created }, { status: 201 });
    }

    if (command === "read_notification") {
      const notificationId = Number(body.notificationId);
      const [notification] = await db.select({ userId: notifications.userId }).from(notifications).where(eq(notifications.id, notificationId)).limit(1);
      if (!notification || (!isAdmin(actor) && notification.userId !== actor.id)) return Response.json({ error: "ไม่มีสิทธิ์เปิดการแจ้งเตือนนี้" }, { status: 403 });
      await db.update(notifications).set({ readAt: new Date().toISOString() }).where(eq(notifications.id, notificationId));
      return Response.json({ ok: true });
    }

    if (command === "update_setting") {
      if (!isAdmin(actor)) return Response.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขการตั้งค่าได้" }, { status: 403 });
      await db.update(systemSettings).set({ settingValue: String(body.value ?? ""), updatedAt: new Date().toISOString() }).where(eq(systemSettings.settingKey, String(body.key || "")));
      await db.insert(activityLogs).values({ userId: actor.id, action: "settings.update", targetType: "setting", summary: `แก้ไขการตั้งค่า ${String(body.key || "")}` });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "ไม่รู้จักคำสั่งนี้" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ" }, { status: 500 });
  }
}
