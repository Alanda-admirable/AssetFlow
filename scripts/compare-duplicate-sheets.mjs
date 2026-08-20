import ExcelJS from "exceljs";

const filePath = "E:/demo/AssetFlow/ทะเบียนครุภัณฑ์.xlsx";
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(filePath);

function getRows(ws) {
  const list = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const vals = [];
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      let v = cell.value;
      if (typeof v === "object" && v) v = v.text || v.result || JSON.stringify(v);
      vals.push(String(v || "").trim());
    });
    list.push({ rowNumber, vals: vals.filter(Boolean) });
  });
  return list;
}

const s11 = workbook.getWorksheet("ฟอร์มสำรวจ");
const s5 = workbook.getWorksheet("ตรวจสอบ (แก้ล่าสุด 13 พ.ย. 68)");

console.log("=== เปรียบเทียบ Sheet 'ฟอร์มสำรวจ' vs 'ตรวจสอบ (แก้ล่าสุด 13 พ.ย. 68)' ===");
console.log(`ฟอร์มสำรวจ: ${s11 ? s11.rowCount : 'none'} rows`);
console.log(`ตรวจสอบ (แก้ล่าสุด 13 พ.ย. 68): ${s5 ? s5.rowCount : 'none'} rows`);

const r11 = getRows(s11);
const r5 = getRows(s5);

console.log("\n--- ตัวอย่าง 10 แถวแรกของ 'ฟอร์มสำรวจ' ---");
r11.slice(0, 10).forEach(r => console.log(`[${r.rowNumber}] ${r.vals.join(" | ")}`));

console.log("\n--- ตัวอย่าง 10 แถวแรกของ 'ตรวจสอบ (แก้ล่าสุด 13 พ.ย. 68)' ---");
r5.slice(0, 10).forEach(r => console.log(`[${r.rowNumber}] ${r.vals.join(" | ")}`));
