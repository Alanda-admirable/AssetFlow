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

console.log("=== เจาะลึกการนับ 468 รายการตรงตามลำดับ 'ที่' ใน Excel ===\n");

const sheetRows = [];
let grandTotal = 0;

for (const sheet of workbook.worksheets) {
  if (sheet.name.includes("ฟอร์มสำรวจ") || sheet.name.includes("แบบสำรวจ") || sheet.name.includes("ชำรุด (อก)")) {
    continue;
  }

  const items = [];
  let currentCategory = "ครุภัณฑ์ทั่วไป";

  for (let r = 5; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const col1 = getText(row.getCell(1).value);
    const col2 = getText(row.getCell(2).value);
    const col3 = getText(row.getCell(3).value);
    const col4 = getText(row.getCell(4).value);
    const col5 = getText(row.getCell(5).value);

    const rowStr = [col1, col2, col3, col4, col5].join(" ").trim();
    if (!rowStr) continue;

    // Filter headers, summaries, footers
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

    // Category sub-header row
    if (
      col1.startsWith("ประเภท") ||
      col3.startsWith("ประเภท") ||
      rowStr.startsWith("ประเภท") ||
      col1 === "ครุภัณฑ์ต่ำกว่าเกณฑ์" ||
      col2 === "ครุภัณฑ์ต่ำกว่าเกณฑ์" ||
      col3 === "ครุภัณฑ์ต่ำกว่าเกณฑ์" ||
      (col3 === "เครื่องคอมพิวเตอร์" && !col1 && !col2 && !col4 && !col5) ||
      (col3 === "เครื่องปรับอากาศ" && !col1 && !col2 && !col4 && !col5) ||
      (col3 === "เครื่องใช้ไฟฟ้าและเครื่องเสียง" && !col1 && !col2 && !col4 && !col5)
    ) {
      if (col1.startsWith("ประเภท") || col3.startsWith("ประเภท")) {
        currentCategory = (col1.startsWith("ประเภท") ? col1 : col3).replace(/^ประเภท/, "").trim();
      }
      continue;
    }

    if (col1 === "ที่" || col3 === "รายการ" || col2 === "เลขที่ครุภัณฑ์") continue;

    const assetCode = col2;
    const name = col3;
    const loc = col4;
    const note = col5;

    if (!name && !assetCode) continue;

    let isDamaged = false;
    if (rowStr.includes("รายการชำรุด") || note.includes("ชำรุด") || name.includes("ชำรุด")) {
      isDamaged = true;
    }

    items.push({
      rowNumber: r,
      ordinal: col1,
      assetCode,
      name,
      loc,
      note,
      category: currentCategory,
      isDamaged
    });
  }

  grandTotal += items.length;
  sheetRows.push({
    sheetName: sheet.name,
    count: items.length,
    items
  });
}

sheetRows.forEach((s, idx) => {
  console.log(`[${idx + 1}] ชีต "${s.sheetName}": ${s.count} รายการ`);
});

console.log(`\n👉 ยอดรวมสุทธิที่ตัดหัวข้อคั่นออกแล้ว = ${grandTotal} รายการ`);
