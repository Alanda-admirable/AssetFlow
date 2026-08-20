import ExcelJS from "exceljs";

const filePath = "E:/demo/AssetFlow/ทะเบียนครุภัณฑ์.xlsx";
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(filePath);

console.log(`=== Total Sheets in Excel: ${workbook.worksheets.length} ===\n`);

let totalRawRows = 0;
let totalParsedAssets = 0;
const allCodesMap = new Map();
const duplicateCodes = new Map();
const emptyCodeAssets = [];
const multiQtyRows = [];
const summaryRowsDetected = [];
const sheetSummaries = [];

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

workbook.eachSheet((worksheet, sheetId) => {
  const sheetName = worksheet.name;
  const rawRows = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = getText(cell.value);
    });
    rawRows.push({ rowNumber, values });
  });

  totalRawRows += rawRows.length;

  let headerRowNumber = -1;
  for (const { rowNumber, values } of rawRows.slice(0, 15)) {
    const str = values.join(" ");
    if (str.includes("รายการ") || str.includes("รหัส") || str.includes("ชื่อ") || str.includes("ลำดับ")) {
      headerRowNumber = rowNumber;
      break;
    }
  }

  let assetCountInSheet = 0;
  let ignoredCountInSheet = 0;
  const sampleAssets = [];

  rawRows.forEach(({ rowNumber, values }) => {
    if (headerRowNumber !== -1 && rowNumber <= headerRowNumber) return;

    const rowStr = values.join(" ").trim();
    if (!rowStr) return;

    // Check footer / summary patterns
    if (
      rowStr.includes("รวมทั้งสิ้น") ||
      rowStr.includes("รวม") ||
      rowStr.includes("ผู้ตรวจนับ") ||
      rowStr.includes("ลงชื่อ") ||
      rowStr.includes("คณะกรรมการ") ||
      rowStr.includes("หมายเหตุ :") ||
      rowStr.includes("ประธานกรรมการ") ||
      rowStr.includes("กรรมการ") ||
      rowStr.startsWith("ใบตรวจนับ") ||
      rowStr.startsWith("แบบตรวจนับ")
    ) {
      ignoredCountInSheet++;
      summaryRowsDetected.push({ sheetName, rowNumber, text: rowStr });
      return;
    }

    const clean = values.filter(v => v !== "");
    if (clean.length === 0) return;

    // Detect code
    let code = "";
    for (let c = 0; c < Math.min(values.length, 6); c++) {
      const v = values[c] || "";
      if (!code && (v.match(/^\d{4}-\d{3,4}/) || v.match(/^[A-Z0-9-]{6,}$/))) {
        code = v;
      }
    }

    // Detect name
    let name = "";
    for (let c = 0; c < Math.min(values.length, 6); c++) {
      const v = values[c] || "";
      if (v && v !== code && isNaN(Number(v)) && !v.startsWith("ลำดับ") && v.length > 2) {
        if (!name) name = v;
      }
    }

    if (!name && clean.length >= 2) name = clean[1];
    if (!code && clean.length >= 1) code = clean[0];

    // Detect quantity > 1
    for (let c = 0; c < values.length; c++) {
      const num = Number(values[c]);
      if (!isNaN(num) && num > 1 && num < 500 && !values[c].includes("-") && !values[c].includes(".")) {
        // Multi quantity row
        multiQtyRows.push({ sheetName, rowNumber, code, name, qty: num, text: rowStr });
        break;
      }
    }

    if (!code && !name) {
      ignoredCountInSheet++;
      return;
    }

    assetCountInSheet++;
    totalParsedAssets++;

    if (code) {
      if (allCodesMap.has(code)) {
        if (!duplicateCodes.has(code)) {
          duplicateCodes.set(code, [allCodesMap.get(code)]);
        }
        duplicateCodes.get(code).push(`${sheetName} (row ${rowNumber}): ${name}`);
      } else {
        allCodesMap.set(code, `${sheetName} (row ${rowNumber}): ${name}`);
      }
    } else {
      emptyCodeAssets.push({ sheetName, rowNumber, name });
    }

    if (sampleAssets.length < 2) {
      sampleAssets.push({ code, name });
    }
  });

  sheetSummaries.push({
    sheetId,
    sheetName,
    rawRowCount: rawRows.length,
    headerRowNumber,
    assetCountInSheet,
    ignoredCountInSheet,
    sampleAssets
  });
});

console.log("=== สรุปการตรวจสอบแต่ละ Sheet ในไฟล์ Excel ===");
sheetSummaries.forEach(s => {
  console.log(`[Sheet ${s.sheetId}] "${s.sheetName}": ข้อมูลดิบ ${s.rawRowCount} บรรทัด -> เป็นครุภัณฑ์ ${s.assetCountInSheet} รายการ (ตัดหัว/ท้าย ${s.ignoredCountInSheet} บรรทัด)`);
});

console.log(`\n--------------------------------------------`);
console.log(`รวมบรรทัดทั้งหมดใน Excel: ${totalRawRows} บรรทัด`);
console.log(`รวมรายการครุภัณฑ์ที่พบจริง: ${totalParsedAssets} รายการ`);
console.log(`รายการที่มีรหัสครุภัณฑ์ซ้ำกัน (Duplicate Codes): ${duplicateCodes.size} รหัส`);
console.log(`รายการที่ไม่มีรหัสครุภัณฑ์ (No Code): ${emptyCodeAssets.length} รายการ`);
console.log(`รายการที่ระบุจำนวนมากกว่า 1 ชิ้นในบรรทัดเดียว (Multi-Qty): ${multiQtyRows.length} รายการ`);
console.log(`--------------------------------------------\n`);

if (duplicateCodes.size > 0) {
  console.log("=== รายละเอียดรหัสครุภัณฑ์ที่ซ้ำกัน (Duplicate Codes) ===");
  for (const [code, list] of duplicateCodes.entries()) {
    console.log(`\n📌 รหัส [${code}] พบซ้ำ ${list.length} จุด:`);
    list.forEach(item => console.log(`   - ${item}`));
  }
}

if (multiQtyRows.length > 0) {
  console.log("\n=== รายการที่มีจำนวน (Qty) มากกว่า 1 ในแถวเดียว (ตัวอย่าง 10 แถวแรก) ===");
  multiQtyRows.slice(0, 10).forEach(m => {
    console.log(`[${m.sheetName} บรรทัด ${m.rowNumber}] ${m.code || 'ไม่มีรหัส'} | ${m.name} | ระบุจำนวน: ${m.qty}`);
  });
}
