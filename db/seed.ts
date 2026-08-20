import { eq } from "drizzle-orm";
import { getDb, getRawClient } from "./index";
import fs from "fs";
import path from "path";
import { createPasswordRecord, verifyPassword } from "./security";
import { realAssetsList } from "./real-assets-seed";
import {
  activityLogs,
  assetCategories,
  assetImages,
  assetModels,
  assetRequestItems,
  assetRequests,
  assetStatuses,
  assets,
  auditItems,
  auditSessions,
  contracts,
  customFields,
  departments,
  depreciationEntries,
  depreciationProfiles,
  disposalItems,
  disposalRequests,
  locations,
  maintenanceRecords,
  manufacturers,
  notifications,
  roles,
  suppliers,
  systemSettings,
  users,
} from "./schema";

let seeded = false;

const demoAccounts = [
  { email: "admin@assetflow.local", username: "admin", password: "AssetFlow@2569!" },
  { email: "supplies@assetflow.local", username: "supplies", password: "Supplies@2569!" },
  { email: "director@assetflow.local", username: "approver", password: "Approver@2569!" },
  { email: "narin@assetflow.local", username: "user.demo", password: "User@2569!" },
] as const;

export async function ensureDemoCredentials() {
  const db = getDb();
  for (const account of demoAccounts) {
    const [current] = await db.select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
      passwordSalt: users.passwordSalt,
      passwordIterations: users.passwordIterations,
    }).from(users).where(eq(users.email, account.email)).limit(1);
    if (!current) continue;
    const isValid = current.username === account.username && current.passwordHash && current.passwordSalt
      ? await verifyPassword(account.password, current.passwordHash, current.passwordSalt, current.passwordIterations)
      : false;
    if (isValid) continue;
    const password = await createPasswordRecord(account.password);
    await db.update(users).set({
      username: account.username,
      passwordHash: password.hash,
      passwordSalt: password.salt,
      passwordIterations: password.iterations,
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, current.id));
  }
}

export async function purgeOldMockups() {
  // No-op in production with real assets
  return;
}

export async function ensureTablesExist() {
  try {
    if (typeof fs === "undefined" || !fs.existsSync) return;
    const migrationDir = path.join(process.cwd(), "drizzle");
    const migrationFiles = ["0000_acoustic_monster_badoon.sql", "0001_loose_giant_girl.sql"];

    for (const file of migrationFiles) {
      const fullPath = path.join(migrationDir, file);
      if (fs.existsSync(fullPath)) {
        const sqlContent = fs.readFileSync(fullPath, "utf-8");
        const statements = sqlContent
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        const client = getRawClient();
        for (const statement of statements) {
          try {
            await client.execute(statement);
          } catch {
            // ignore already exists errors
          }
        }
      }
    }
  } catch {
    // In serverless edge runtime, local fs is absent; tables are already in Turso DB
  }
}

export async function seedDatabaseIfEmpty() {
  if (seeded) return;
  await ensureTablesExist();
  const db = getDb();
  await purgeOldMockups();
  const existing = await db.select({ id: roles.id }).from(roles).limit(1);
  const existingAssets = await db.select({ id: assets.id }).from(assets).limit(1);
  if (existing.length && existingAssets.length) {
    seeded = true;
    return;
  }
  if (existing.length && !existingAssets.length) {
    try {
      await db.delete(assetImages);
      await db.delete(assetRequestItems);
      await db.delete(maintenanceRecords);
      await db.delete(auditItems);
      await db.delete(disposalItems);
      await db.delete(depreciationEntries);
      
      await db.delete(assets);
      await db.delete(assetRequests);
      await db.delete(auditSessions);
      await db.delete(disposalRequests);
      await db.delete(depreciationProfiles);
      await db.delete(notifications);
      await db.delete(activityLogs);
      await db.delete(contracts);
      await db.delete(customFields);
      await db.delete(systemSettings);

      await db.delete(users);
      await db.delete(locations);
      await db.delete(assetModels);
      await db.delete(manufacturers);
      await db.delete(assetCategories);
      await db.delete(departments);
      await db.delete(roles);
      await db.delete(assetStatuses);
      await db.delete(suppliers);
    } catch (err) {
      console.error("Error clearing tables:", err);
    }
  } else if (existing.length) {
    await ensureDemoCredentials();
    seeded = true;
    return;
  }

  const insertedRoles = await db.insert(roles).values([
    { code: "admin", name: "ผู้ดูแลระบบ", permissionsJson: "[\"*\"]" },
    { code: "asset_officer", name: "เจ้าหน้าที่พัสดุ", permissionsJson: "[\"assets.*\",\"requests.*\",\"audits.*\"]" },
    { code: "approver", name: "ผู้อนุมัติ", permissionsJson: "[\"requests.approve\",\"reports.read\"]" },
    { code: "staff", name: "เจ้าหน้าที่ทั่วไป", permissionsJson: "[\"assets.read\",\"requests.create\"]" },
    { code: "auditor", name: "ผู้ตรวจสอบ", permissionsJson: "[\"*.read\"]" },
  ]).returning();

  const insertedDepartments = await db.insert(departments).values([
    { code: "ADM", name: "ฝ่ายบริหารทั่วไป" },
    { code: "IT", name: "ฝ่ายเทคโนโลยีสารสนเทศ" },
    { code: "FIN", name: "ฝ่ายการเงินและบัญชี" },
    { code: "HR", name: "ฝ่ายทรัพยากรบุคคล" },
  ]).returning();

  const adminRole = insertedRoles.find((item) => item.code === "admin")!;
  const officerRole = insertedRoles.find((item) => item.code === "asset_officer")!;
  const approverRole = insertedRoles.find((item) => item.code === "approver")!;
  const staffRole = insertedRoles.find((item) => item.code === "staff")!;
  const itDepartment = insertedDepartments.find((item) => item.code === "IT")!;
  const adminDepartment = insertedDepartments.find((item) => item.code === "ADM")!;
  const financeDepartment = insertedDepartments.find((item) => item.code === "FIN")!;
  const hrDepartment = insertedDepartments.find((item) => item.code === "HR")!;

  const insertedUsers = await db.insert(users).values([
    { employeeCode: "EMP-0001", username: "admin", email: "admin@assetflow.local", fullName: "ศิริพร วัฒนกิจ", roleId: adminRole.id, departmentId: itDepartment.id },
    { employeeCode: "EMP-0024", username: "supplies", email: "supplies@assetflow.local", fullName: "ณัฐชา ใจดี", roleId: officerRole.id, departmentId: adminDepartment.id },
    { employeeCode: "EMP-0012", username: "approver", email: "director@assetflow.local", fullName: "กิตติพงษ์ ธรรมรักษ์", roleId: approverRole.id, departmentId: adminDepartment.id },
    { employeeCode: "EMP-0087", username: "user.demo", email: "narin@assetflow.local", fullName: "นรินทร์ พูลผล", roleId: staffRole.id, departmentId: hrDepartment.id },
    { employeeCode: "EMP-0041", email: "malee@assetflow.local", fullName: "มาลี พรหมมา", roleId: staffRole.id, departmentId: financeDepartment.id },
  ]).returning();

  const adminUser = insertedUsers[0];
  const officerUser = insertedUsers[1];
  const directorUser = insertedUsers[2];
  const narinUser = insertedUsers[3];
  const maleeUser = insertedUsers[4];

  const insertedLocations = await db.insert(locations).values([
    { code: "JW-BUD", building: "จวนผู้ว่าราชการจังหวัด", floor: "1", room: "หอกลอง/หอบูชา", departmentId: adminDepartment.id },
    { code: "JW-REC", building: "จวนผู้ว่าราชการจังหวัด", floor: "1", room: "ห้องรับรอง", departmentId: adminDepartment.id },
    { code: "JW-OUT", building: "จวนผู้ว่าราชการจังหวัด", floor: "1", room: "บริเวณหน้าบ้าน", departmentId: adminDepartment.id },
    { code: "HQ-IT-301", building: "อาคารสำนักงานกลาง", floor: "3", room: "ห้อง IT 301", departmentId: itDepartment.id },
    { code: "HQ-ADM-201", building: "อาคารสำนักงานกลาง", floor: "2", room: "ห้องพัสดุ 201", departmentId: adminDepartment.id },
  ]).returning();

  const insertedCategories = await db.insert(assetCategories).values([
    { code: "BUD", name: "พระพุทธรูป", usefulLifeYears: 50, depreciationRate: 0 },
    { code: "SAC", name: "ของที่ระลึก", usefulLifeYears: 50, depreciationRate: 0 },
    { code: "OUT", name: "หน้าบ้าน", usefulLifeYears: 10, depreciationRate: 10 },
    { code: "ART", name: "ศิลปวัตถุประจำสำนักงาน", usefulLifeYears: 20, depreciationRate: 5 },
    { code: "OFF", name: "ครุภัณฑ์สำนักงาน", usefulLifeYears: 5, depreciationRate: 20 },
  ]).returning();

  const insertedManufacturers = await db.insert(manufacturers).values([
    { name: "กรมศิลปากร" }, { name: "สำนักช่างสิบหมู่" }, { name: "ไม่ระบุผู้ผลิต" },
  ]).returning();

  const insertedModels = await db.insert(assetModels).values([
    { categoryId: insertedCategories[0].id, manufacturerId: insertedManufacturers[0].id, name: "พระพุทธรูปและวัตถุมงคล", modelNumber: "BUD-MODEL" },
    { categoryId: insertedCategories[1].id, manufacturerId: insertedManufacturers[1].id, name: "ของที่ระลึกประจำจวน", modelNumber: "GFT-MODEL" },
    { categoryId: insertedCategories[2].id, manufacturerId: insertedManufacturers[2].id, name: "ครุภัณฑ์ตกแต่งภายนอก", modelNumber: "OUT-MODEL" },
    { categoryId: insertedCategories[3].id, manufacturerId: insertedManufacturers[0].id, name: "งานศิลปะทั่วไป", modelNumber: "ART-MODEL" },
    { categoryId: insertedCategories[4].id, manufacturerId: insertedManufacturers[2].id, name: "อุปกรณ์สำนักงานทั่วไป", modelNumber: "OFF-MODEL" },
  ]).returning();

  const insertedStatuses = await db.insert(assetStatuses).values([
    { code: "available", name: "พร้อมใช้งาน", color: "green", deployable: true, sortOrder: 1 },
    { code: "assigned", name: "มีผู้รับผิดชอบ", color: "blue", sortOrder: 2 },
    { code: "borrowed", name: "ถูกยืมใช้งาน", color: "violet", sortOrder: 3 },
    { code: "maintenance", name: "อยู่ระหว่างซ่อม", color: "orange", sortOrder: 4 },
    { code: "damaged", name: "ชำรุด", color: "red", sortOrder: 5 },
    { code: "disposed", name: "จำหน่ายแล้ว", color: "gray", isArchived: true, sortOrder: 6 },
  ]).returning();

  const available = insertedStatuses[0];
  const assigned = insertedStatuses[1];
  const borrowed = insertedStatuses[2];

  const insertedSuppliers = await db.insert(suppliers).values([
    { name: "สำนักพระราชวัง / กรมศิลปากร", taxId: "0105567012345", contactName: "เจ้าหน้าที่งานพระราชพิธี", email: "art@artdept.example", phone: "02-221-1234" },
    { name: "ร้านออฟฟิศพลัส จำกัด", taxId: "0105567098765", contactName: "คุณพิมพ์", email: "contact@officeplus.example", phone: "02-444-5566" },
  ]).returning();

  const insertedAssets: Array<typeof assets.$inferSelect> = [];
  for (const item of realAssetsList) {
    const cat = insertedCategories.find((c) => c.name === item.category)!;
    const model = insertedModels.find((m) => m.categoryId === cat.id)!;
    const roomName = item.location.split(/\s*>\s*/).pop();
    const loc = insertedLocations.find((l) => l.room === roomName) || insertedLocations[0];

    const [insertedAsset] = await db.insert(assets).values({
      assetCode: item.assetCode,
      serialNumber: item.serialNumber,
      name: item.name,
      description: item.description,
      categoryId: cat.id,
      modelId: model.id,
      statusId: available.id,
      locationId: loc.id,
      departmentId: adminDepartment.id,
      assignedUserId: adminUser.id,
      supplierId: insertedSuppliers[0].id,
      purchasePrice: item.purchasePrice || 0,
      purchaseDate: "2026-08-07",
      condition: "excellent",
      createdBy: officerUser.id,
    }).returning();
    insertedAssets.push(insertedAsset);

    await db.insert(assetImages).values({
      assetId: insertedAsset.id,
      objectKey: item.imageUrl,
      imageType: "main",
      altText: item.name,
      uploadedBy: officerUser.id,
    });
  }

  const insertedRequests = await db.insert(assetRequests).values([
    { requestNo: "BR-2569-00042", requestType: "borrow", requesterId: narinUser.id, departmentId: hrDepartment.id, purpose: "ใช้จัดอบรมบุคลากรภายนอกสถานที่", useLocation: "ศูนย์ประชุมจังหวัด", startDate: "2026-07-18", dueDate: "2026-07-22", status: "checked_out", currentApprovalStep: 2, submittedAt: "2026-07-15 09:30:00" },
    { requestNo: "BR-2569-00043", requestType: "borrow", requesterId: maleeUser.id, departmentId: financeDepartment.id, purpose: "ใช้ฉายเอกสารประกอบการประชุมงบประมาณ", useLocation: "ห้องประชุม 401", startDate: "2026-07-21", dueDate: "2026-07-21", status: "pending_approval", currentApprovalStep: 1, submittedAt: "2026-07-19 10:12:00" },
    { requestNo: "TR-2569-00018", requestType: "transfer", requesterId: officerUser.id, departmentId: adminDepartment.id, purpose: "ปรับย้ายอุปกรณ์ให้ตรงกับผู้ใช้งานปัจจุบัน", useLocation: "ห้องบุคคล 305", startDate: "2026-07-22", status: "pending_approval", currentApprovalStep: 1, submittedAt: "2026-07-19 13:45:00" },
  ]).returning();

  await db.insert(assetRequestItems).values([
    { requestId: insertedRequests[0].id, assetId: insertedAssets[0].id, itemStatus: "checked_out", checkoutCondition: "สภาพปกติ อุปกรณ์ครบ" },
    { requestId: insertedRequests[1].id, assetId: insertedAssets[3].id, itemStatus: "requested" },
    { requestId: insertedRequests[2].id, assetId: insertedAssets[1].id, itemStatus: "requested" },
  ]);

  await db.insert(maintenanceRecords).values([
    { maintenanceNo: "MT-2569-00016", assetId: insertedAssets[2].id, reportedBy: maleeUser.id, problem: "พิมพ์กระดาษแล้วมีเส้นดำและดึงกระดาษเอียง", priority: "high", repairType: "warranty", supplierId: insertedSuppliers[0].id, status: "waiting_parts", reportedAt: "2026-07-17 08:50:00", dueAt: "2026-07-23" },
    { maintenanceNo: "MT-2569-00017", assetId: insertedAssets[5].id, reportedBy: officerUser.id, problem: "พนักพิงโยกและชุดปรับระดับชำรุด", priority: "normal", repairType: "corrective", supplierId: insertedSuppliers[1].id, status: "reported", reportedAt: "2026-07-19 09:20:00", dueAt: "2026-07-26" },
  ]);

  const insertedAudits = await db.insert(auditSessions).values([
    { auditNo: "AU-2569-0004", name: "ตรวจนับครุภัณฑ์ประจำปี ฝ่าย IT", fiscalYear: "2569", departmentId: itDepartment.id, locationId: insertedLocations[0].id, startDate: "2026-07-15", endDate: "2026-07-31", status: "in_progress", createdBy: officerUser.id },
    { auditNo: "AU-2569-0005", name: "ตรวจนับห้องประชุมและพื้นที่ส่วนกลาง", fiscalYear: "2569", departmentId: adminDepartment.id, startDate: "2026-08-01", endDate: "2026-08-10", status: "planned", createdBy: officerUser.id },
  ]).returning();

  await db.insert(auditItems).values([
    { auditSessionId: insertedAudits[0].id, assetId: insertedAssets[1].id, expectedLocationId: insertedLocations[0].id, foundLocationId: insertedLocations[0].id, result: "found", condition: "excellent", checkedBy: officerUser.id, checkedAt: "2026-07-18 10:10:00" },
    { auditSessionId: insertedAudits[0].id, assetId: insertedAssets[4].id, expectedLocationId: insertedLocations[0].id, result: "pending" },
  ]);

  await db.insert(contracts).values([
    { contractNo: "CT-2569-0011", contractType: "maintenance", supplierId: insertedSuppliers[0].id, title: "บริการดูแลเครื่องคอมพิวเตอร์และเครือข่าย", startDate: "2026-01-01", endDate: "2026-12-31", renewalNoticeDays: 60, cost: 185000, status: "active" },
    { contractNo: "CT-2568-0027", contractType: "warranty", supplierId: insertedSuppliers[1].id, title: "ประกันอุปกรณ์ห้องประชุม", startDate: "2025-09-01", endDate: "2026-08-31", renewalNoticeDays: 45, cost: 42000, status: "renewal_pending" },
  ]);

  const [profile] = await db.insert(depreciationProfiles).values({ assetId: insertedAssets[0].id, method: "straight_line", usefulLifeYears: 5, salvageValue: 1, startDate: "2026-02-20" }).returning();
  await db.insert(depreciationEntries).values([
    { profileId: profile.id, periodDate: "2026-12-31", amount: 8150, accumulatedAmount: 8150, netBookValue: 40750 },
  ]);

  const [disposal] = await db.insert(disposalRequests).values({ disposalNo: "DS-2569-0003", reason: "damaged", description: "ชำรุดและค่าซ่อมไม่คุ้มค่า", requestedBy: officerUser.id, status: "fact_finding", committeeOrderNo: "คำสั่ง 78/2569", submittedAt: "2026-07-18 14:30:00" }).returning();
  await db.insert(disposalItems).values({ disposalRequestId: disposal.id, assetId: insertedAssets[5].id, conditionNote: "ชุดปรับระดับและโครงสร้างชำรุด", estimatedValue: 500, finalAction: "sell" });

  await db.insert(notifications).values([
    { userId: officerUser.id, type: "overdue", severity: "danger", title: "ครุภัณฑ์ใกล้เกินกำหนดคืน", message: "BR-2569-00042 ครบกำหนดคืนภายใน 3 วัน", relatedType: "request", relatedId: insertedRequests[0].id },
    { userId: directorUser.id, type: "approval", severity: "warning", title: "มีคำขอรออนุมัติ 2 รายการ", message: "กรุณาตรวจสอบคำขอยืมและคำขอโอนย้ายล่าสุด", relatedType: "request", relatedId: insertedRequests[1].id },
    { userId: officerUser.id, type: "contract", severity: "info", title: "สัญญาใกล้หมดอายุ", message: "CT-2568-0027 เหลือระยะเวลา 43 วัน", relatedType: "contract", relatedId: 2 },
  ]);

  await db.insert(customFields).values([
    { targetType: "asset", fieldKey: "gf_code", fieldLabel: "รหัส GF", fieldType: "text", isRequired: false, sortOrder: 1 },
    { targetType: "asset", fieldKey: "voucher_no", fieldLabel: "เลขที่ฎีกา", fieldType: "text", isRequired: false, sortOrder: 2 },
    { targetType: "maintenance", fieldKey: "repair_center_ref", fieldLabel: "เลขรับงานศูนย์ซ่อม", fieldType: "text", isRequired: false, sortOrder: 1 },
  ]);

  await db.insert(systemSettings).values([
    { settingKey: "organization_name", settingValue: "สำนักงานตัวอย่าง", settingGroup: "general", isPublic: true },
    { settingKey: "fiscal_year", settingValue: "2569", settingGroup: "general", isPublic: true },
    { settingKey: "approval_levels", settingValue: "2", settingGroup: "workflow" },
    { settingKey: "overdue_reminder_days", settingValue: "3", settingGroup: "notification" },
    { settingKey: "public_qr_view", settingValue: "limited", settingGroup: "security" },
  ]);

  await db.insert(activityLogs).values([
    { userId: officerUser.id, action: "asset.update", targetType: "asset", targetId: insertedAssets[2].id, summary: "เปลี่ยนสถานะเครื่องพิมพ์เป็น อยู่ระหว่างซ่อม" },
    { userId: narinUser.id, action: "request.checkout", targetType: "request", targetId: insertedRequests[0].id, summary: "รับมอบโน้ตบุ๊กสำหรับงานภาคสนาม" },
    { userId: officerUser.id, action: "audit.scan", targetType: "audit", targetId: insertedAudits[0].id, summary: "ตรวจพบ MacBook Air ตรงตำแหน่ง" },
    { userId: directorUser.id, action: "request.review", targetType: "request", targetId: insertedRequests[1].id, summary: "เปิดตรวจสอบคำขอยืม BR-2569-00043" },
  ]);

  await ensureDemoCredentials();
  seeded = true;
}
