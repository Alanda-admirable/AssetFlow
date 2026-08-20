import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { seedDatabaseIfEmpty } from "../../../db/seed";
import { activityLogs, assetCategories, assetImages, assets, locations } from "../../../db/schema";
import { canManage, getActor } from "../../lib/actor";

export async function GET(request: Request) {
  await seedDatabaseIfEmpty();
  const actor = await getActor(request);
  if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const db = getDb();
  const rows = await db.select().from(assets).orderBy(desc(assets.updatedAt));
  return Response.json({ assets: rows });
}

export async function POST(request: Request) {
  try {
    await seedDatabaseIfEmpty();
    const actor = await getActor(request);
    if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (!canManage(actor)) return Response.json({ error: "ไม่มีสิทธิ์เพิ่มครุภัณฑ์" }, { status: 403 });
    
    const body = await request.json() as Record<string, any>;
    const assetCode = String(body.assetCode || "").trim();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim() || null;
    const imageUrl = String(body.imageUrl || "").trim();
    let categoryId = Number(body.categoryId) || null;
    const categoryName = String(body.categoryName || "").trim();

    if (!assetCode || !name) return Response.json({ error: "กรุณาระบุรหัสและชื่อครุภัณฑ์" }, { status: 400 });

    const db = getDb();

    // Auto-create / lookup category if freeform text provided
    if (!categoryId && categoryName) {
      const [existingCategory] = await db.select().from(assetCategories).where(eq(assetCategories.name, categoryName)).limit(1);
      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        const categoryCode = `CAT-${Date.now().toString(36)}`;
        const [newCat] = await db.insert(assetCategories).values({
          code: categoryCode,
          name: categoryName,
          usefulLifeYears: 5,
          depreciationRate: 20
        }).returning();
        categoryId = newCat.id;
      }
    }

    const duplicate = await db.select({ id: assets.id }).from(assets).where(eq(assets.assetCode, assetCode)).limit(1);
    if (duplicate.length) return Response.json({ error: "รหัสครุภัณฑ์นี้มีอยู่แล้วในระบบ" }, { status: 409 });

    const rawLocation = String(body.locationName || body.location || body.building || "").trim();
    const room = String(body.room || "").trim();
    const cabinet = String(body.cabinet || "").trim();
    let locationId = Number(body.locationId) || null;

    // Auto-create location hierarchy from freeform location string or parts
    if (!locationId && (rawLocation || room || cabinet)) {
      const parts = rawLocation ? rawLocation.split(/\s*>\s*/).filter(Boolean) : [];
      if (room) parts.push(room);
      if (cabinet) parts.push(cabinet);

      const fullBuilding = parts[0] || "จวนผู้ว่าราชการจังหวัด";
      const fullRoom = parts.slice(1).join(" > ") || "ทั่วไป";
      const locCode = `LOC-${Date.now().toString(36)}`;
      const [newLoc] = await db.insert(locations).values({
        code: locCode,
        building: fullBuilding,
        floor: "1",
        room: fullRoom,
        isActive: true,
      }).returning();
      locationId = newLoc.id;
    }

    const [asset] = await db.insert(assets).values({
      assetCode,
      name,
      description,
      serialNumber: String(body.serialNumber || "") || null,
      categoryId,
      modelId: Number(body.modelId) || null,
      statusId: Number(body.statusId) || 1,
      locationId: locationId || 1,
      departmentId: Number(body.departmentId) || 1,
      purchasePrice: Number(body.purchasePrice) || 0,
      purchaseDate: String(body.purchaseDate || "") || new Date().toISOString().split("T")[0],
      warrantyEnd: String(body.warrantyEnd || "") || null,
      budgetYear: String(body.budgetYear || "2569"),
      budgetSource: String(body.budgetSource || "งบประมาณแผ่นดิน"),
      qrToken: assetCode,
      createdBy: actor.id,
    }).returning();

    // Save image URL into asset_images if provided
    if (imageUrl) {
      await db.insert(assetImages).values({
        assetId: asset.id,
        objectKey: imageUrl,
        imageType: "main",
        altText: name,
        uploadedBy: actor.id,
      });
    }

    await db.insert(activityLogs).values({
      userId: actor.id,
      action: "asset.create",
      targetType: "asset",
      targetId: asset.id,
      summary: `เพิ่มครุภัณฑ์รหัส [${assetCode}] ${name}`,
      afterJson: JSON.stringify({ asset, imageUrl, categoryName }),
    });

    return Response.json({ asset }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
