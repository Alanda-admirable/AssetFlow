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

console.log("=== รายการที่ไม่มีเลขลำดับ (ช่อง 'ที่' ว่าง) หรือเป็นข้อความคั่นในทุกชีต ===");

for (const sheet of workbook.worksheets) {
  if (sheet.name.includes("ฟอร์มสำรวจ") || sheet.name.includes("แบบสำรวจ") || sheet.name.includes("ชำรุด (อก)")) {
    continue;
  }

  const weirdRows = [];

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

    if (col1.startsWith("ประเภท") || col3.startsWith("ประเภท") || rowStr.startsWith("ประเภท")) {
      continue;
    }

    if (col1 === "ที่" || col3 === "รายการ" || col2 === "เลขที่ครุภัณฑ์") continue;

    // Check if col1 is empty or not a number
    if (!col1 || isNaN(Number(col1))) {
      weirdRows.push({ rowNumber: r, col1, col2, col3, col4, col5 });
    }
  }

  if (weirdRows.length > 0) {
    console.log(`\n📌 [${sheet.name}] มี ${weirdRows.length} แถวที่ไม่มีเลขลำดับ:`);
    weirdRows.forEach(w => {
      console.log(`   - Row ${w.rowNumber}: [ที่: "${w.col1}"] | [เลข: "${w.col2}"] | [รายการ: "${w.col3}"] | [ที่ตั้ง: "${w.col4}"] | [หมายเหตุ: "${w.col5}"]`);
    });
  }
}
