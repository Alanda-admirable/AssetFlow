import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { activityLogs, assetCategories, assetImages, assetMovements, assetRequestItems, assets, assetStatuses, auditItems, disposalItems, locations, maintenanceRecords } from "../../../../db/schema";
import { canManage, getActor } from "../../../lib/actor";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const assetId = Number(params.id);
    const actor = await getActor(request);
    if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (!canManage(actor)) return Response.json({ error: "ไม่มีสิทธิ์แก้ไขครุภัณฑ์" }, { status: 403 });

    const db = getDb();
    const [existing] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    if (!existing) return Response.json({ error: "ไม่พบข้อมูลครุภัณฑ์" }, { status: 404 });

    const body = await request.json() as Record<string, any>;
    let categoryId = body.categoryId !== undefined && body.categoryId !== "" ? Number(body.categoryId) : existing.categoryId;
    const categoryName = String(body.categoryName || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();

    // Auto-create / lookup category if freeform text provided
    if (!categoryId && categoryName) {
      const [existingCategory] = await db.select().from(assetCategories).where(eq(assetCategories.name, categoryName)).limit(1);
      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        const categoryCode = `CAT-${Date.now().toString().slice(-4)}`;
        const [newCat] = await db.insert(assetCategories).values({
          code: categoryCode,
          name: categoryName,
          usefulLifeYears: 5,
          depreciationRate: 20
        }).returning();
        categoryId = newCat.id;
      }
    }

    // Status handling
    let statusId = existing.statusId;
    if (body.statusId) {
      statusId = Number(body.statusId);
    } else if (body.status) {
      const [st] = await db.select().from(assetStatuses).where(eq(assetStatuses.code, String(body.status))).limit(1);
      if (st) statusId = st.id;
    }

    const rawLocation = String(body.locationName || body.location || body.room || body.building || "").trim();
    let locationId = body.locationId !== undefined && body.locationId !== "" ? Number(body.locationId) : existing.locationId;

    // Lookup or create location if name provided
    if (!locationId && rawLocation) {
      const [existingLoc] = await db.select().from(locations).where(eq(locations.room, rawLocation)).limit(1);
      if (existingLoc) {
        locationId = existingLoc.id;
      } else {
        const locCode = `LOC-${Date.now().toString().slice(-4)}`;
        const [newLoc] = await db.insert(locations).values({
          code: locCode,
          building: "ศาลากลางจังหวัดปทุมธานี",
          floor: "1",
          room: rawLocation,
          isActive: true,
        }).returning();
        locationId = newLoc.id;
      }
    }

    let condition = existing.condition;
    if (body.condition) {
      condition = String(body.condition);
    } else if (body.status === "damaged") {
      condition = "damaged";
    } else if (body.status === "available") {
      condition = "good";
    }

    const updateData = {
      assetCode: body.assetCode ? String(body.assetCode).trim() : existing.assetCode,
      name: body.name ? String(body.name).trim() : existing.name,
      description: body.description !== undefined ? String(body.description).trim() : existing.description,
      budgetYear: body.budgetYear ? String(body.budgetYear).trim() : existing.budgetYear,
      purchasePrice: body.purchasePrice !== undefined ? Number(body.purchasePrice) : existing.purchasePrice,
      categoryId,
      statusId,
      locationId,
      condition,
      updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    };

    const [updated] = await db.update(assets).set(updateData).where(eq(assets.id, assetId)).returning();

    // Update image URL in asset_images if provided
    if (imageUrl) {
      await db.delete(assetImages).where(eq(assetImages.assetId, assetId));
      await db.insert(assetImages).values({
        assetId,
        objectKey: imageUrl,
        imageType: "main",
        altText: updated.name,
        uploadedBy: actor.id,
      });
    }

    await db.insert(activityLogs).values({
      userId: actor.id,
      action: "asset.update",
      targetType: "asset",
      targetId: assetId,
      summary: `แก้ไขครุภัณฑ์รหัส [${updated.assetCode}] ${updated.name}`,
      beforeJson: JSON.stringify(existing),
      afterJson: JSON.stringify(updated),
    });

    return Response.json({ asset: updated });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "แก้ไขไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const assetId = Number(params.id);
    const actor = await getActor(request);
    if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (!canManage(actor)) return Response.json({ error: "ไม่มีสิทธิ์ลบครุภัณฑ์" }, { status: 403 });

    const db = getDb();
    const [existing] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    if (!existing) return Response.json({ error: "ไม่พบข้อมูลครุภัณฑ์" }, { status: 404 });

    await db.insert(activityLogs).values({
      userId: actor.id,
      action: "asset.delete",
      targetType: "asset",
      targetId: assetId,
      summary: `ลบครุภัณฑ์รหัส [${existing.assetCode}] ${existing.name}`,
      beforeJson: JSON.stringify(existing),
    });

    await db.delete(assetImages).where(eq(assetImages.assetId, assetId));
    await db.delete(assetRequestItems).where(eq(assetRequestItems.assetId, assetId));
    await db.delete(maintenanceRecords).where(eq(maintenanceRecords.assetId, assetId));
    await db.delete(auditItems).where(eq(auditItems.assetId, assetId));
    await db.delete(disposalItems).where(eq(disposalItems.assetId, assetId));
    await db.delete(assetMovements).where(eq(assetMovements.assetId, assetId));
    await db.delete(assets).where(eq(assets.id, assetId));

    return Response.json({ message: "ลบรายการเรียบร้อยแล้ว" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "ลบไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const body = await request.clone().json().catch(() => ({}));
  if (body._method === "DELETE") return DELETE(request, context);
  if (body._method === "PUT") return PUT(request, context);
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}
