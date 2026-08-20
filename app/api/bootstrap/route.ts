import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { seedDatabaseIfEmpty } from "../../../db/seed";
import {
  activityLogs,
  assetCategories,
  assetImages,
  assetModels,
  assetStatuses,
  assets,
  departments,
  locations,
  manufacturers,
  notifications,
  roles,
  users,
} from "../../../db/schema";
import { getActor } from "../../lib/actor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await seedDatabaseIfEmpty();
    const db = getDb();
    const actor = await getActor(request);
    if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

    const isAdmin = actor.roleCode === "admin";

    // Run all database queries in parallel for maximum performance
    const [
      assetRows,
      notificationRows,
      userRows,
      categoryRows,
      statusRows,
      locationRows,
      departmentRows,
      modelRows,
      imageRows,
      roleRows,
    ] = await Promise.all([
      db
        .select({
          id: assets.id,
          assetCode: assets.assetCode,
          serialNumber: assets.serialNumber,
          name: assets.name,
          status: assetStatuses.code,
          statusName: assetStatuses.name,
          statusColor: assetStatuses.color,
          category: assetCategories.name,
          manufacturer: manufacturers.name,
          model: assetModels.name,
          location: locations.room,
          building: locations.building,
          department: departments.name,
          assignedTo: users.fullName,
          purchasePrice: assets.purchasePrice,
          purchaseDate: assets.purchaseDate,
          warrantyEnd: assets.warrantyEnd,
          description: assets.description,
          qrToken: assets.qrToken,
          updatedAt: assets.updatedAt,
        })
        .from(assets)
        .leftJoin(assetStatuses, eq(assets.statusId, assetStatuses.id))
        .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
        .leftJoin(assetModels, eq(assets.modelId, assetModels.id))
        .leftJoin(manufacturers, eq(assetModels.manufacturerId, manufacturers.id))
        .leftJoin(locations, eq(assets.locationId, locations.id))
        .leftJoin(departments, eq(assets.departmentId, departments.id))
        .leftJoin(users, eq(assets.assignedUserId, users.id))
        .orderBy(desc(assets.updatedAt)),
      db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(10),
      isAdmin
        ? db
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
            })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .leftJoin(departments, eq(users.departmentId, departments.id))
        : Promise.resolve([]),
      db.select().from(assetCategories),
      db.select().from(assetStatuses).orderBy(assetStatuses.sortOrder),
      db.select().from(locations),
      db.select().from(departments),
      db
        .select({
          id: assetModels.id,
          name: assetModels.name,
          manufacturer: manufacturers.name,
          categoryId: assetModels.categoryId,
          modelNumber: assetModels.modelNumber,
        })
        .from(assetModels)
        .leftJoin(manufacturers, eq(assetModels.manufacturerId, manufacturers.id)),
      db.select().from(assetImages),
      db.select().from(roles),
    ]);

    const imageMap = new Map<number, string>();
    for (const img of imageRows) {
      if (!imageMap.has(img.assetId)) imageMap.set(img.assetId, img.objectKey);
    }

    const visibleAssets = assetRows.map((item) => ({
      ...item,
      imageUrl: imageMap.get(item.id) || null,
    }));

    const totalValue = visibleAssets.reduce((sum, item) => sum + Number(item.purchasePrice || 0), 0);
    const stats = {
      totalAssets: visibleAssets.length,
      available: visibleAssets.filter((item) => item.status === "available").length,
      inUse: visibleAssets.filter((item) => ["assigned", "borrowed"].includes(item.status || "")).length,
      maintenance: visibleAssets.filter((item) => item.status === "maintenance").length,
      pendingApprovals: 0,
      overdue: 0,
      totalValue,
      unreadNotifications: notificationRows.filter((item) => !item.readAt).length,
    };

    const { sessionId: _sessionId, ...publicActor } = actor;

    return Response.json({
      actor: publicActor,
      stats,
      assets: visibleAssets,
      notifications: notificationRows,
      users: isAdmin ? userRows : [],
      meta: { categories: categoryRows, statuses: statusRows, locations: locationRows, departments: departmentRows, models: modelRows, roles: roleRows },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลได้";
    return Response.json({ error: message }, { status: 500 });
  }
}
