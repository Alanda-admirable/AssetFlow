import ExcelJS from "exceljs";
import path from "path";

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

async function detailedAnalysis() {
  const filePath = path.resolve("ทะเบียนครุภัณฑ์.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const allRecords = [];
  const sheetStats = [];

  for (const sheet of workbook.worksheets) {
    const r2Val = getText(sheet.getRow(2).getCell(1).value);
    const r3Val = getText(sheet.getRow(3).getCell(1).value);
    const sheetTitle = r2Val || sheet.name;
    const fiscalYear = r3Val || "2568";

    let currentCategory = "ครุภัณฑ์ทั่วไป";
    const sheetRecords = [];

    // Data rows generally start at row 7
    for (let r = 7; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const col1 = getText(row.getCell(1).value);
      const col2 = getText(row.getCell(2).value);
      const col3 = getText(row.getCell(3).value);
      const col4 = getText(row.getCell(4).value);
      const col5 = getText(row.getCell(5).value);

      // Check if all cells in row are empty
      if (!col1 && !col2 && !col3 && !col4 && !col5) continue;

      // Category divider row e.g. "ประเภทโต๊ะ", "ประเภทเก้าอี้", "ประเภทเครื่องปรับอากาศ"
      if (col1.startsWith("ประเภท") || col3.startsWith("ประเภท")) {
        const catText = col1.startsWith("ประเภท") ? col1 : col3;
        currentCategory = catText.replace(/^ประเภท/, "").trim();
        continue;
      }

      // Check if it's header repetition
      if (col1 === "ที่" || col3 === "รายการ" || col3.includes("(ชนิด/ยี่ห้อ")) continue;

      // Check if valid asset row
      const assetCode = col2;
      const name = col3;
      const subLocation = col4;
      const note = col5;

      if (!name && !assetCode) continue;

      // Determine status from note
      let status = "available";
      if (note.includes("ชำรุด") || note.includes("ส่งคืนแล้ว") || sheet.name.includes("ชำรุด")) {
        status = "damaged";
      } else if (note.includes("ยืม") || note.includes("ส่งซ่อม")) {
        status = "maintenance";
      }

      const record = {
        sheet: sheet.name,
        roomDepartment: sheetTitle,
        category: currentCategory,
        no: col1,
        assetCode: assetCode || `ไม่มีเลข-${sheet.name}-${r}`,
        name: name || assetCode,
        location: subLocation ? `${sheetTitle} > ${subLocation}` : sheetTitle,
        status,
        note
      };

      sheetRecords.push(record);
      allRecords.push(record);
    }

    sheetStats.push({
      sheet: sheet.name,
      title: sheetTitle,
      count: sheetRecords.length,
      categories: [...new Set(sheetRecords.map(r => r.category))]
    });
  }

  console.log("=== สรุปผลการวิเคราะห์ไฟล์ ทะเบียนครุภัณฑ์.xlsx ===");
  console.log(`จำนวน Sheet ทั้งหมด: ${workbook.worksheets.length}`);
  console.log(`จำนวนรายการครุภัณฑ์ทั้งหมดที่สกัดได้: ${allRecords.length} รายการ`);
  console.log("\nรายละเอียดตามแต่ละ Sheet/ห้อง:");
  console.table(sheetStats);

  // Group by category
  const catCount = {};
  for (const r of allRecords) {
    catCount[r.category] = (catCount[r.category] || 0) + 1;
  }
  console.log("\nสรุปตามหมวดหมู่ครุภัณฑ์ (Categories):");
  console.table(catCount);

  // Sample records
  console.log("\nตัวอย่างรายการครุภัณฑ์ 5 รายการแรก:");
  console.dir(allRecords.slice(0, 5), { depth: null });
}

detailedAnalysis().catch(console.error);
