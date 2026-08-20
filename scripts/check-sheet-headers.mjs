import ExcelJS from "exceljs";

const filePath = "E:/demo/AssetFlow/ทะเบียนครุภัณฑ์.xlsx";
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(filePath);

function getText(cellValue) {
  if (!cellValue) return "";
  if (typeof cellValue === "string") return cellValue.trim();
  if (typeof cellValue === "number") return String(cellValue).trim();
  return String(cellValue).trim();
}

console.log("=== ตรวจสอบชื่อชีตและ Header แถว 1-4 ของทุกชีต ===");

for (const sheet of workbook.worksheets) {
  console.log(`Sheet name: "${sheet.name}"`);
  console.log(`  Row 1: "${getText(sheet.getRow(1).getCell(1).value)}"`);
  console.log(`  Row 2: "${getText(sheet.getRow(2).getCell(1).value)}"`);
  console.log(`  Row 3: "${getText(sheet.getRow(3).getCell(1).value)}"`);
  console.log("-----------------------------------------");
}
