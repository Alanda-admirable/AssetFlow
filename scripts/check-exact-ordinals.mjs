import ExcelJS from "exceljs";

const filePath = "E:/demo/AssetFlow/ทะเบียนครุภัณฑ์.xlsx";
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(filePath);

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

console.log("=== ตรวจสอบลำดับที่ (คอลัมน์ 'ที่') ในทุกชีตของ Excel ===\n");

let totalOrdinalItems = 0;
let totalRowsParsed = 0;
const sheetDetails = [];

for (const sheet of workbook.worksheets) {
  if (sheet.name.includes("ฟอร์มสำรวจ") || sheet.name.includes("แบบสำรวจ")) {
    continue;
  }

  let normalItems = [];
  let damagedItems = [];
  let unnumberedItems = [];
  let isDamagedSection = false;

  for (let r = 5; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const col1 = getText(row.getCell(1).value);
    const col2 = getText(row.getCell(2).value);
    const col3 = getText(row.getCell(3).value);
    const col4 = getText(row.getCell(4).value);
    const col5 = getText(row.getCell(5).value);

    const rowStr = [col1, col2, col3, col4, col5].join(" ").trim();
    if (!rowStr) continue;

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

    if (rowStr.includes("รายการชำรุด") || col1.includes("ชำรุด") || col3.includes("ชำรุด")) {
      isDamagedSection = true;
      continue;
    }

    if (col1.startsWith("ประเภท") || col3.startsWith("ประเภท") || rowStr.startsWith("ประเภท")) {
      continue;
    }

    if (col1 === "ที่" || col3 === "รายการ" || col2 === "เลขที่ครุภัณฑ์") continue;

    const assetCode = col2;
    const name = col3;
    const loc = col4;
    const note = col5;

    if (!name && !assetCode) continue;

    const itemObj = { rowNumber: r, col1, assetCode, name, loc, note, isDamaged: isDamagedSection };

    if (!isNaN(Number(col1)) && Number(col1) > 0) {
      if (isDamagedSection) {
        damagedItems.push(itemObj);
      } else {
        normalItems.push(itemObj);
      }
    } else {
      unnumberedItems.push(itemObj);
    }
  }

  const sheetTotal = normalItems.length + damagedItems.length + unnumberedItems.length;
  totalOrdinalItems += normalItems.length + damagedItems.length;
  totalRowsParsed += sheetTotal;

  sheetDetails.push({
    sheetName: sheet.name,
    normalCount: normalItems.length,
    damagedCount: damagedItems.length,
    unnumberedCount: unnumberedItems.length,
    sheetTotal,
    maxNormalOrdinal: normalItems.length > 0 ? normalItems[normalItems.length - 1].col1 : 0,
    maxDamagedOrdinal: damagedItems.length > 0 ? damagedItems[damagedItems.length - 1].col1 : 0,
    unnumberedSamples: unnumberedItems
  });
}

sheetDetails.forEach(s => {
  console.log(`📌 [${s.sheetName}]`);
  console.log(`   - รายการปกติ (มีลำดับ 1 ถึง ${s.maxNormalOrdinal}): ${s.normalCount} รายการ`);
  if (s.damagedCount > 0) {
    console.log(`   - รายการชำรุดท้ายชีต (มีลำดับ 1 ถึง ${s.maxDamagedOrdinal}): ${s.damagedCount} รายการ`);
  }
  if (s.unnumberedCount > 0) {
    console.log(`   - รายการที่ไม่มีเลขลำดับ (ช่อง 'ที่' ว่าง): ${s.unnumberedCount} รายการ -> ${JSON.stringify(s.unnumberedSamples.map(u => ({ row: u.rowNumber, code: u.assetCode, name: u.name })))}`);
  }
  console.log(`   👉 รวมในชีตนี้: ${s.sheetTotal} รายการ\n`);
});

console.log("==========================================");
console.log(`รวมรายการทั้งหมดที่มีเลขลำดับ 'ที่': ${totalOrdinalItems} รายการ`);
console.log(`รวมรายการทั้งหมด (รวมช่อง 'ที่' ว่าง): ${totalRowsParsed} รายการ`);
console.log("==========================================");
