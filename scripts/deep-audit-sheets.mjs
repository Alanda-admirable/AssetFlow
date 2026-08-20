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

console.log("=== วิเคราะห์เจาะลึก 16 Sheets ในไฟล์ Excel ===\n");

workbook.eachSheet((worksheet, sheetId) => {
  console.log(`\n======================================================`);
  console.log(`[Sheet ${sheetId}] Name: "${worksheet.name}" (Total Rows: ${worksheet.rowCount})`);
  console.log(`======================================================`);

  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = getText(cell.value);
    });
    rows.push({ rowNumber, values });
  });

  // Print first 8 rows
  console.log("--- ตัวอย่าง 8 แถวแรก ---");
  rows.slice(0, 8).forEach(r => {
    console.log(`Row ${r.rowNumber}: [${r.values.filter(v => v !== '').join(' | ')}]`);
  });

  // Check section headers / sub headers
  const subHeaders = [];
  const validItems = [];
  const footers = [];

  rows.forEach(r => {
    const str = r.values.join(' ');
    if (
      str.includes("ประเภท") &&
      (str.includes("เฟอร์นิเจอร์") || str.includes("คอมพิวเตอร์") || str.includes("เครื่องใช้ไฟฟ้า") || str.includes("ยานพาหนะ"))
    ) {
      subHeaders.push({ rowNumber: r.rowNumber, text: str });
    }
  });

  if (subHeaders.length > 0) {
    console.log(`--- พบแถวหมวดหมู่ย่อย (Section Sub-headers): ${subHeaders.length} จุด ---`);
    subHeaders.forEach(sh => console.log(`   - Row ${sh.rowNumber}: ${sh.text}`));
  }
});
