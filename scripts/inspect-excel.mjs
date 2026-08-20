import ExcelJS from "exceljs";
import path from "path";

async function inspectExcel() {
  const filePath = path.resolve("ทะเบียนครุภัณฑ์.xlsx");
  console.log("Reading file:", filePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  console.log(`Workbook has ${workbook.worksheets.length} sheets:`);
  for (const sheet of workbook.worksheets) {
    console.log(`\n--- Sheet: "${sheet.name}" (Rows: ${sheet.rowCount}, Cols: ${sheet.columnCount}) ---`);
    // Print first 10 rows
    for (let r = 1; r <= Math.min(sheet.rowCount, 15); r++) {
      const row = sheet.getRow(r);
      const values = row.values.slice(1).map(v => {
        if (v && typeof v === "object") {
          if (v.text) return v.text;
          if (v.result) return v.result;
          if (v.richText) return v.richText.map(t => t.text).join("");
          return JSON.stringify(v);
        }
        return v !== undefined && v !== null ? String(v) : "";
      });
      if (values.some(v => v !== "")) {
        console.log(`Row ${r}:`, values);
      }
    }
  }
}

inspectExcel().catch(console.error);
