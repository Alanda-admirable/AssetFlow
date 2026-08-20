import ExcelJS from "exceljs";
import { createClient } from "@libsql/client/http";
import path from "path";
import fs from "fs";

const TURSO_URL = "https://assetflow-alanda-admirable.aws-ap-northeast-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcxMDg0OTksImlkIjoiMDFhMDE3ZjctOWUwMS03ZTkxLThmMGUtNmIzZTZiMGE4MWVjIiwia2lkIjoiMzRqbVdvVlhXUXFsMG9ra0tlY0dUc3plNHlCQXZzcjRrOHE4MmVQNUJpcyIsInJpZCI6ImQ5NzZhYjIxLWQyY2EtNDNmNi05YzU2LWM3Nzc1MDU3MzNiZCJ9._n_fU1s2UGQ5WDtpQCkzm_5k2b1HS8rDAv2q-r6OI_ygmrr63ARcuU4nPuXgz1VrLVtEMfstotURajxTlISDDQ";

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN
});

function getText(cellValue) {
  if (!cellValue) return "";
  if (typeof cellValue === "string") return cellValue.trim();
  if (typeof cellValue === "number") return String(cellValue).trim();
  if (typeof cellValue === "object") {
    if (cellValue.text) return String(cellValue.text).trim();
    if (cellValue.result) return String(cellValue.result).trim();
    if (cellValue.richText) return cellValue.richText.map(t => t.text).join("").trim();
  }
  return String(cellValue).trim();
}

async function importExcelToTurso() {
  console.log("=== เริ่มต้นกระบวนการนำเข้า ทะเบียนครุภัณฑ์.xlsx เข้าสู่ Turso Cloud DB ===");
  const filePath = path.resolve("ทะเบียนครุภัณฑ์.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // 1. Parse Excel data
  const rawItems = [];
  const categorySet = new Set();
  const locationSet = new Set();
  const departmentSet = new Set();

  for (const sheet of workbook.worksheets) {
    const r2Val = getText(sheet.getRow(2).getCell(1).value);
    const r3Val = getText(sheet.getRow(3).getCell(1).value);
    const sheetTitle = r2Val || sheet.name;
    const fiscalYear = r3Val || "2568";

    // Extract department & building from sheetTitle
    // Example: "สำนักงานจังหวัดปทุมธานี (1502) ห้องรับ-ส่งหนังสือ"
    let deptName = "สำนักงานจังหวัดปทุมธานี";
    let roomName = sheetTitle.replace("สำนักงานจังหวัดปทุมธานี (1502)", "").trim() || sheet.name;
    if (roomName.startsWith("กลุ่มงาน")) {
      deptName = roomName;
    }
    departmentSet.add(deptName);
    locationSet.add(roomName);

    let currentCategory = "ครุภัณฑ์ทั่วไป";

    for (let r = 7; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const col1 = getText(row.getCell(1).value);
      const col2 = getText(row.getCell(2).value);
      const col3 = getText(row.getCell(3).value);
      const col4 = getText(row.getCell(4).value);
      const col5 = getText(row.getCell(5).value);

      if (!col1 && !col2 && !col3 && !col4 && !col5) continue;

      if (col1.startsWith("ประเภท") || col3.startsWith("ประเภท")) {
        const catText = col1.startsWith("ประเภท") ? col1 : col3;
        currentCategory = catText.replace(/^ประเภท/, "").trim();
        continue;
      }

      if (col1 === "ที่" || col3 === "รายการ" || col3.includes("(ชนิด/ยี่ห้อ")) continue;

      const assetCode = col2;
      const name = col3;
      const subLocation = col4;
      const note = col5;

      if (!name && !assetCode) continue;

      categorySet.add(currentCategory || "ครุภัณฑ์ทั่วไป");

      let status = "available";
      let condition = "good";
      if (note.includes("ชำรุด") || sheet.name.includes("ชำรุด")) {
        status = "damaged";
        condition = "damaged";
      } else if (note.includes("ยืม") || note.includes("ส่งซ่อม")) {
        status = "maintenance";
        condition = "fair";
      }

      rawItems.push({
        sheetName: sheet.name,
        deptName,
        roomName,
        subLocation,
        category: currentCategory || "ครุภัณฑ์ทั่วไป",
        no: col1,
        assetCode,
        name: name || assetCode,
        status,
        condition,
        note,
        fiscalYear: "2568"
      });
    }
  }

  console.log(`อ่านข้อมูลสำเร็จ: ${rawItems.length} รายการ จาก ${workbook.worksheets.length} แผ่นงาน`);

  // 2. Clear old asset items in Turso DB
  console.log("กำลังลบข้อมูลครุภัณฑ์เก่า...");
  await client.execute("DELETE FROM asset_images");
  await client.execute("DELETE FROM asset_request_items");
  await client.execute("DELETE FROM maintenance_records");
  await client.execute("DELETE FROM audit_items");
  await client.execute("DELETE FROM disposal_items");
  await client.execute("DELETE FROM depreciation_entries");
  await client.execute("DELETE FROM depreciation_profiles");
  await client.execute("DELETE FROM assets");

  // 3. Ensure Statuses exist
  console.log("กำลังเตรียมข้อมูลสถานะ (Statuses)...");
  const statusesData = [
    { code: "available", name: "พร้อมใช้งาน", color: "green", deployable: 1, sort_order: 1 },
    { code: "assigned", name: "มีผู้รับผิดชอบ", color: "blue", deployable: 0, sort_order: 2 },
    { code: "borrowed", name: "ถูกยืมใช้งาน", color: "violet", deployable: 0, sort_order: 3 },
    { code: "maintenance", name: "อยู่ระหว่างซ่อม", color: "orange", deployable: 0, sort_order: 4 },
    { code: "damaged", name: "ชำรุด", color: "red", deployable: 0, sort_order: 5 },
    { code: "disposed", name: "จำหน่ายแล้ว", color: "gray", deployable: 0, sort_order: 6 },
  ];
  for (const s of statusesData) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO asset_statuses (code, name, color, deployable, is_archived, sort_order) VALUES (?, ?, ?, ?, 0, ?)`,
      args: [s.code, s.name, s.color, s.deployable, s.sort_order]
    });
  }

  const statusRows = await client.execute("SELECT id, code FROM asset_statuses");
  const statusMap = new Map(statusRows.rows.map(r => [r.code, r.id]));

  // 4. Ensure Departments exist
  console.log("กำลังเตรียมข้อมูลกลุ่มงาน/ฝ่าย (Departments)...");
  let deptIdx = 1;
  for (const dept of departmentSet) {
    const code = `D-${String(deptIdx++).padStart(3, "0")}`;
    await client.execute({
      sql: `INSERT OR IGNORE INTO departments (code, name) VALUES (?, ?)`,
      args: [code, dept]
    });
  }
  const deptRows = await client.execute("SELECT id, name FROM departments");
  const deptMap = new Map(deptRows.rows.map(r => [r.name, r.id]));

  // 5. Ensure Locations exist
  console.log("กำลังเตรียมข้อมูลสถานที่/ห้อง (Locations)...");
  let locIdx = 1;
  for (const loc of locationSet) {
    const code = `LOC-${String(locIdx++).padStart(3, "0")}`;
    await client.execute({
      sql: `INSERT OR IGNORE INTO locations (code, building, floor, room) VALUES (?, 'ศาลากลางจังหวัดปทุมธานี', '1', ?)`,
      args: [code, loc]
    });
  }
  const locRows = await client.execute("SELECT id, room FROM locations");
  const locMap = new Map(locRows.rows.map(r => [r.room, r.id]));

  // 6. Ensure Categories & Models exist
  console.log("กำลังเตรียมข้อมูลหมวดหมู่ (Categories)...");
  let catIdx = 1;
  for (const cat of categorySet) {
    const code = `CAT-${String(catIdx++).padStart(3, "0")}`;
    await client.execute({
      sql: `INSERT OR IGNORE INTO asset_categories (code, name, useful_life_years, depreciation_rate) VALUES (?, ?, 5, 20)`,
      args: [code, cat]
    });
  }
  const catRows = await client.execute("SELECT id, name FROM asset_categories");
  const catMap = new Map(catRows.rows.map(r => [r.name, r.id]));

  // Ensure Manufacturer
  await client.execute(`INSERT OR IGNORE INTO manufacturers (name) VALUES ('สำนักงานจังหวัดปทุมธานี')`);
  const mfgRows = await client.execute("SELECT id FROM manufacturers WHERE name = 'สำนักงานจังหวัดปทุมธานี' LIMIT 1");
  const mfgId = mfgRows.rows[0]?.id || 1;

  for (const [catName, catId] of catMap.entries()) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO asset_models (category_id, manufacturer_id, name, model_number) VALUES (?, ?, ?, ?)`,
      args: [catId, mfgId, `รุ่นมาตรฐาน ${catName}`, `${catName}-STD`]
    });
  }
  const modelRows = await client.execute("SELECT id, category_id FROM asset_models");
  const modelMap = new Map(modelRows.rows.map(r => [r.category_id, r.id]));

  // Get Admin user ID for assigned/creator
  const userRows = await client.execute("SELECT id FROM users WHERE username = 'admin' LIMIT 1");
  const adminUserId = userRows.rows[0]?.id || 1;

  // 7. Insert all 476 Assets
  console.log(`กำลังนำเข้าครุภัณฑ์ทั้งหมด ${rawItems.length} รายการสู่ Database...`);
  const usedCodes = new Set();
  let insertCount = 0;

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    
    // Ensure unique assetCode
    let cleanCode = item.assetCode ? item.assetCode.replace(/\s+/g, " ").trim() : "";
    if (!cleanCode || cleanCode === "ไม่มีเลข" || cleanCode === "-") {
      cleanCode = `PHT-NOCODE-${String(i + 1).padStart(4, "0")}`;
    }
    if (usedCodes.has(cleanCode)) {
      cleanCode = `${cleanCode}-${i + 1}`;
    }
    usedCodes.add(cleanCode);

    const categoryId = catMap.get(item.category) || catRows.rows[0]?.id;
    const modelId = modelMap.get(categoryId) || modelRows.rows[0]?.id;
    const locationId = locMap.get(item.roomName) || locRows.rows[0]?.id;
    const departmentId = deptMap.get(item.deptName) || deptRows.rows[0]?.id;
    const statusId = statusMap.get(item.status) || statusMap.get("available") || 1;

    let desc = item.subLocation ? `ตำแหน่งจัดวาง: ${item.subLocation}` : "";
    if (item.note) {
      desc = desc ? `${desc} | หมายเหตุ: ${item.note}` : `หมายเหตุ: ${item.note}`;
    }

    await client.execute({
      sql: `INSERT INTO assets (
        asset_code, serial_number, name, description,
        category_id, model_id, status_id, location_id, department_id,
        assigned_user_id, purchase_price, budget_year, qr_token, condition, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        cleanCode,
        null,
        item.name,
        desc || null,
        categoryId,
        modelId,
        statusId,
        locationId,
        departmentId,
        adminUserId,
        0,
        item.fiscalYear,
        cleanCode,
        item.condition,
        adminUserId
      ]
    });
    insertCount++;
  }

  console.log(`\n🎉 นำเข้าข้อมูลสำเร็จเรียบร้อยทั้งหมด ${insertCount} รายการ!`);
  const finalCount = await client.execute("SELECT COUNT(*) as cnt FROM assets");
  console.log(`📊 ตรวจสอบยอดรวมใน Database จริง: ${finalCount.rows[0].cnt} รายการ`);
}

importExcelToTurso().catch(console.error);
