import { getDb } from "../../../db";
import { seedDatabaseIfEmpty } from "../../../db/seed";
import { activityLogs, assetRequestItems, assetRequests } from "../../../db/schema";
import { getActor } from "../../lib/actor";

export async function POST(request: Request) {
  try {
    await seedDatabaseIfEmpty();
    const actor = await getActor(request);
    if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const purpose = String(body.purpose || "").trim();
    const assetId = Number(body.assetId);
    if (!purpose || !assetId) return Response.json({ error: "กรุณาเลือกครุภัณฑ์และระบุเหตุผล" }, { status: 400 });
    const now = new Date();
    const requestNo = `BR-${now.getFullYear() + 543}-${String(now.getTime()).slice(-5)}`;
    const db = getDb();
    const [created] = await db.insert(assetRequests).values({
      requestNo,
      requestType: String(body.requestType || "borrow"),
      requesterId: actor.id,
      purpose,
      useLocation: String(body.useLocation || ""),
      startDate: String(body.startDate || ""),
      dueDate: String(body.dueDate || ""),
      status: "pending_approval",
      currentApprovalStep: 1,
      submittedAt: new Date().toISOString(),
    }).returning();
    await db.insert(assetRequestItems).values({ requestId: created.id, assetId, itemStatus: "requested" });
    await db.insert(activityLogs).values({ userId: actor.id, action: "request.submit", targetType: "request", targetId: created.id, summary: `ส่งคำขอ ${requestNo} เพื่อรออนุมัติ` });
    return Response.json({ request: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "ส่งคำขอไม่สำเร็จ" }, { status: 500 });
  }
}
