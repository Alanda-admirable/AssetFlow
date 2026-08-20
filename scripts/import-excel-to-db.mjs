import ExcelJS from "exceljs";
import { createClient } from "@libsql/client/http";

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

function detectAccurateCategory(name, currentCategoryHeader) {
  const n = (name || "").toLowerCase();
  if (n.includes("เก้าอี้")) return "เก้าอี้";
  if (n.includes("โต๊ะ")) return "โต๊ะ";
  if (n.includes("คอมพิวเตอร์") || n.includes("pc ") || n.includes("จอ acer") || n.includes("จอ hp") || n.includes("จอ dell") || n.includes("จอ lenovo") || n.includes("notbook") || n.includes("notebook")) return "คอมพิวเตอร์";
  if (n.includes("พิมพ์") || n.includes("printer") || n.includes("brother") || n.includes("fujixerox") || n.includes("epson") || n.includes("canon")) return "เครื่องพิมพ์";
  if (n.includes("ปรับอากาศ") || n.includes("แอร์")) return "เครื่องปรับอากาศ";
  if (n.includes("ตู้") || n.includes("ชั้นวาง") || n.includes("ชั้นเหล็ก") || n.includes("ชั้นไม้") || n.includes("ตู้เซฟ") || n.includes("ตู้นิรภัย")) return "ตู้/ชั้นวางของ";
  if (n.includes("กล้อง")) return "กล้องถ่ายรูป";
  if (n.includes("รถยนต์") || n.includes("รถกระบะ") || n.includes("รถตู้") || n.includes("จักรยานยนต์") || n.includes("ยานพาหนะ") || n.includes("รถแวน") || n.includes("รถตรวจการณ์")) return "ยานพาหนะ";
  if (n.includes("ไมค์") || n.includes("ลำโพง") || n.includes("โทรทัศน์") || n.includes("ทีวี") || n.includes("projector") || n.includes("โปรเจคเตอร์") || n.includes("conference") || n.includes("เครื่องเสียง")) return "เครื่องใช้ไฟฟ้าและเครื่องเสียง";
  if (n.includes("พัดลม") || n.includes("ตู้เย็น") || n.includes("เครื่องทำน้ำเย็น") || n.includes("เครื่องฟอกอากาศ") || n.includes("ไมโครเวฟ") || n.includes("ถังต้มน้ำร้อน")) return "เครื่องใช้ไฟฟ้า";
  if (n.includes("โซฟา") || n.includes("ชุดรับแขก") || n.includes("ผ้าม่าน") || n.includes("โพเดียม") || n.includes("ธง") || n.includes("พระบรมฉายาลักษณ์") || n.includes("รูปติดผนัง") || n.includes("ป้าย") || n.includes("ฉากกั้นห้อง") || n.includes("โต๊ะหมู่พระ")) return "เฟอร์นิเจอร์/ตกแต่ง";
  
  if (currentCategoryHeader && currentCategoryHeader !== "ครุภัณฑ์ทั่วไป") {
    return currentCategoryHeader;
  }
  return "ครุภัณฑ์ทั่วไป";
}

function resolveRoomAndDept(sheetName, row2Text) {
  let deptName = "สำนักงานจังหวัดปทุมธานี";
  let roomName = sheetName.trim();

  const combined = `${sheetName} ${row2Text}`;

  if (combined.includes("กลุ่มงานอำนวยการ") || sheetName === "อำนวยการ") {
    deptName = "สำนักงานจังหวัดปทุมธานี";
    roomName = "กลุ่มงานอำนวยการ";
  } else if (combined.includes("ศูนย์ดำรงธรรม")) {
    deptName = "กลุ่มงานศูนย์ดำรงธรรม";
    roomName = "กลุ่มงานศูนย์ดำรงธรรม";
  } else if (combined.includes("บริหารทรัพยากรบุคคล") || combined.includes("บุคคล")) {
    deptName = "กลุ่มงานบริหารทรัพยากรบุคคล";
    roomName = "กลุ่มงานบริหารทรัพยากรบุคคล";
  } else if (combined.includes("ตรวจสอบภายใน") || combined.includes("ตรวจสอบ")) {
    deptName = "หน่วยตรวจสอบภายในจังหวัด";
    roomName = "หน่วยตรวจสอบภายในจังหวัด";
  } else if (combined.includes("ห้องผู้ว่า")) {
    roomName = "ห้องผู้ว่าราชการจังหวัดปทุมธานี";
  } else if (combined.includes("พงศธร") || combined.includes("รอง 3")) {
    roomName = "ห้องรองผู้ว่าฯ 1 (พงศธร)";
  } else if (combined.includes("รอง 2") || combined.includes("หลังเก่า 2 ชั้น")) {
    roomName = "ห้องรองผู้ว่าฯ 2 (ห้องอาคารหลังเก่า 2 ชั้น)";
  } else if (combined.includes("ห้องรอง1") || combined.includes("ห้องรอง 1") || combined.includes("ห้องรองผู้ว่าฯ 3")) {
    roomName = "ห้องรองผู้ว่าฯ 3";
  } else if (combined.includes("เจ้าพระยา")) {
    roomName = "ห้องประชุมเจ้าพระยา ชั้น 2 ศาลากลางหลังเก่า";
  } else if (combined.includes("ศาลารักษ์")) {
    roomName = "อาคารศาลารักษ์ปทุม";
  } else if (combined.includes("ห้องรับ-ส่ง")) {
    roomName = "ห้องรับ-ส่งหนังสือ";
  } else if (combined.includes("ห้องประชุมชั้น 3") || combined.includes("ห้องประชุมชั้น3")) {
    roomName = "ห้องประชุมชั้น 3";
  } else if (combined.includes("ห้องประชุมชั้น 4") || combined.includes("ห้องประชุมชั้น4")) {
    roomName = "ห้องประชุมชั้น 4";
  } else if (combined.includes("ห้องประชุมชั้น 5") || combined.includes("ห้องประชุมชั้น5")) {
    roomName = "ห้องประชุมชั้น 5";
  }

  return { deptName, roomName };
}

async function retryExecute(fn, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      console.log(`Retry attempt ${i + 1} due to error:`, err.message);
      await new Promise(res => setTimeout(res, 1500));
    }
  }
}

async function importExcelClean468() {
  const filePath = "E:/demo/AssetFlow/ทะเบียนครุภัณฑ์.xlsx";
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  console.log(`=== โหลดไฟล์ Excel สำเร็จ: ${workbook.worksheets.length} แผ่นงาน ===`);

  const rawItems = [];
  const departmentSet = new Set();
  const locationSet = new Set();
  const categorySet = new Set();

  for (const sheet of workbook.worksheets) {
    if (sheet.name.includes("ฟอร์มสำรวจ") || sheet.name.includes("แบบสำรวจ")) {
      continue;
    }

    const row2Text = getText(sheet.getRow(2).getCell(1).value);
    const { deptName, roomName } = resolveRoomAndDept(sheet.name, row2Text);

    departmentSet.add(deptName);
    locationSet.add(roomName);

    let currentCategoryHeader = "ครุภัณฑ์ทั่วไป";
    let isDamagedSection = false;

    for (let r = 5; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const col1 = getText(row.getCell(1).value);
      const col2 = getText(row.getCell(2).value);
      const col3 = getText(row.getCell(3).value);
      const col4 = getText(row.getCell(4).value);
      const col5 = getText(row.getCell(5).value);

      if (!col1 && !col2 && !col3 && !col4 && !col5) continue;

      const rowStr = [col1, col2, col3, col4, col5].join(" ").trim();
      if (
        rowStr.includes("รวมทั้งสิ้น") ||
        rowStr.includes("ผู้ตรวจนับ") ||
        rowStr.includes("ลงชื่อ") ||
        rowStr.includes("คณะกรรมการ") ||
        rowStr.includes("หมายเหตุ :") ||
        rowStr.includes("ประธานกรรมการ") ||
        rowStr.includes("กรรมการ") ||
        rowStr.includes("(ชนิด/ยี่ห้อ/ลักษณะ/สี/ขนาด)") ||
        rowStr.startsWith("หน้า ")
      ) {
        continue;
      }

      // Check section header for damaged items
      if (rowStr.includes("รายการชำรุด") || col1 === "รายการชำรุด" || col2 === "รายการชำรุด" || col3 === "รายการชำรุด") {
        isDamagedSection = true;
        continue;
      }

      // Sub-header category row filters
      if (
        col1.startsWith("ประเภท") ||
        col3.startsWith("ประเภท") ||
        rowStr.startsWith("ประเภท") ||
        col1 === "ครุภัณฑ์ต่ำกว่าเกณฑ์" ||
        col2 === "ครุภัณฑ์ต่ำกว่าเกณฑ์" ||
        col3 === "ครุภัณฑ์ต่ำกว่าเกณฑ์" ||
        (col1 === "เครื่องปรับอากาศ" && col2 === "เครื่องปรับอากาศ") ||
        (col1 === "เครื่องคอมพิวเตอร์" && col2 === "เครื่องคอมพิวเตอร์") ||
        (col1 === "เครื่องใช้ไฟฟ้าและเครื่องเสียง" && col2 === "เครื่องใช้ไฟฟ้าและเครื่องเสียง")
      ) {
        if (col1.startsWith("ประเภท") || col3.startsWith("ประเภท")) {
          currentCategoryHeader = (col1.startsWith("ประเภท") ? col1 : col3).replace(/^ประเภท/, "").trim();
        }
        continue;
      }

      if (col1 === "ที่" || col3 === "รายการ" || col2 === "เลขที่ครุภัณฑ์") continue;

      const assetCode = col2;
      const name = col3;
      const subLocation = col4;
      const note = col5;

      if (!name && !assetCode) continue;

      const finalCategory = detectAccurateCategory(name, currentCategoryHeader);
      categorySet.add(finalCategory);

      let status = "available";
      let condition = "good";
      if (isDamagedSection || note.includes("ชำรุด") || name.includes("ชำรุด") || sheet.name.includes("ชำรุด")) {
        status = "damaged";
        condition = "damaged";
      } else if (note.includes("ยืม") || note.includes("ส่งซ่อม") || note.includes("รอจำหน่าย")) {
        status = "maintenance";
        condition = "fair";
      }

      rawItems.push({
        sheetName: sheet.name,
        deptName,
        roomName,
        subLocation,
        category: finalCategory,
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

  console.log(`\n✅ กรองข้อมูลครุภัณฑ์จริงสุทธิ: ${rawItems.length} รายการ (เป้าหมาย: 468 รายการ)`);

  // 2. Clear old asset items in Turso DB
  console.log("กำลังล้างข้อมูลครุภัณฑ์เดิมใน Database...");
  await retryExecute(async () => {
    await client.batch([
      "DELETE FROM asset_images",
      "DELETE FROM asset_request_items",
      "DELETE FROM maintenance_records",
      "DELETE FROM audit_items",
      "DELETE FROM disposal_items",
      "DELETE FROM asset_movements",
      "DELETE FROM activity_logs",
      "DELETE FROM depreciation_profiles",
      "DELETE FROM assets"
    ]);
  });

  // 3. Statuses
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
    await retryExecute(async () => {
      await client.execute({
        sql: `INSERT OR IGNORE INTO asset_statuses (code, name, color, deployable, is_archived, sort_order) VALUES (?, ?, ?, ?, 0, ?)`,
        args: [s.code, s.name, s.color, s.deployable, s.sort_order]
      });
    });
  }
  const statusRows = await client.execute("SELECT id, code FROM asset_statuses");
  const statusMap = new Map(statusRows.rows.map(r => [r.code, r.id]));

  // 4. Departments
  console.log("กำลังเตรียมข้อมูลกลุ่มงาน/ฝ่าย (Departments)...");
  let deptIdx = 1;
  for (const dept of departmentSet) {
    const code = `D-${String(deptIdx++).padStart(3, "0")}`;
    await retryExecute(async () => {
      await client.execute({
        sql: `INSERT OR IGNORE INTO departments (code, name) VALUES (?, ?)`,
        args: [code, dept]
      });
    });
  }
  const deptRows = await client.execute("SELECT id, name FROM departments");
  const deptMap = new Map(deptRows.rows.map(r => [r.name, r.id]));

  // 5. Locations (14 official rooms)
  console.log("กำลังเตรียมข้อมูลสถานที่/ห้อง (Locations)...");
  let locIdx = 1;
  for (const loc of locationSet) {
    const code = `LOC-${String(locIdx++).padStart(3, "0")}`;
    await retryExecute(async () => {
      await client.execute({
        sql: `INSERT OR IGNORE INTO locations (code, building, floor, room) VALUES (?, 'ศาลากลางจังหวัดปทุมธานี', '1', ?)`,
        args: [code, loc]
      });
    });
  }
  const locRows = await client.execute("SELECT id, room FROM locations");
  const locMap = new Map(locRows.rows.map(r => [r.room, r.id]));

  // 6. Categories & Models
  console.log("กำลังเตรียมข้อมูลหมวดหมู่ (Categories)...");
  let catIdx = 1;
  for (const cat of categorySet) {
    const code = `CAT-${String(catIdx++).padStart(3, "0")}`;
    await retryExecute(async () => {
      await client.execute({
        sql: `INSERT OR IGNORE INTO asset_categories (code, name, useful_life_years, depreciation_rate) VALUES (?, ?, 5, 20)`,
        args: [code, cat]
      });
    });
  }
  const catRows = await client.execute("SELECT id, name FROM asset_categories");
  const catMap = new Map(catRows.rows.map(r => [r.name, r.id]));

  const modelRows = await client.execute("SELECT id, category_id FROM asset_models");
  let defaultModelId = modelRows.rows[0]?.id;
  if (!defaultModelId) {
    const firstCatId = catRows.rows[0]?.id || 1;
    const resModel = await client.execute({
      sql: `INSERT INTO asset_models (category_id, name, model_number) VALUES (?, 'มาตรฐาน', 'STD-001') RETURNING id`,
      args: [firstCatId]
    });
    defaultModelId = resModel.rows[0]?.id;
  }

  // 7. Insert Assets in Batches of 50
  console.log(`กำลังนำเข้าครุภัณฑ์จำนวน ${rawItems.length} รายการลง Turso DB...`);
  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

  const batchSize = 50;
  for (let b = 0; b < rawItems.length; b += batchSize) {
    const chunk = rawItems.slice(b, b + batchSize);
    const statements = chunk.map((item, idx) => {
      const globalIdx = b + idx;
      const catId = catMap.get(item.category) || catRows.rows[0]?.id || 1;
      const locId = locMap.get(item.roomName) || locRows.rows[0]?.id || 1;
      const deptId = deptMap.get(item.deptName) || deptRows.rows[0]?.id || 1;
      const stId = statusMap.get(item.status) || statusRows.rows[0]?.id || 1;

      let finalCode = item.assetCode;
      if (!finalCode || finalCode === "ไม่มีเลข") {
        finalCode = `PTN-UNSET-${String(globalIdx + 1).padStart(4, "0")}`;
      }

      const desc = [
        item.subLocation ? `ตำแหน่งจัดวาง: ${item.subLocation}` : "",
        item.note ? `หมายเหตุ: ${item.note}` : ""
      ].filter(Boolean).join(" | ");

      return {
        sql: `INSERT INTO assets (
          asset_code, name, category_id, model_id, department_id, location_id,
          status_id, condition, budget_year, description, purchase_price, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          finalCode,
          item.name,
          catId,
          defaultModelId,
          deptId,
          locId,
          stId,
          item.condition,
          item.fiscalYear,
          desc,
          0,
          nowStr,
          nowStr
        ]
      };
    });

    await retryExecute(async () => {
      for (const st of statements) {
        try {
          await client.execute(st);
        } catch (err) {
          if (err.message && err.message.includes("UNIQUE constraint failed")) {
            st.args[0] = `${st.args[0]}-${Math.floor(Math.random() * 1000)}`;
            await client.execute(st);
          } else {
            console.error(`Error inserting asset [${st.args[0]}] ${st.args[1]}:`, err.message);
          }
        }
      }
    });
    console.log(`บันทึกแล้ว ${Math.min(b + batchSize, rawItems.length)} / ${rawItems.length} รายการ...`);
  }

  const finalCheck = await client.execute("SELECT COUNT(*) as c FROM assets");
  console.log(`\n🎉 นำเข้าข้อมูลสำเร็จบริบูรณ์! ยอดในฐานข้อมูลสุทธิ = ${finalCheck.rows[0].c} รายการ`);
}

importExcelClean468().catch(console.error);
