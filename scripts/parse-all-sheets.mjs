import ExcelJS from "exceljs";
import path from "path";

async function parseAllSheets() {
  const filePath = path.resolve("ทะเบียนครุภัณฑ์.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  console.log(`=== Total Sheets: ${workbook.worksheets.length} ===`);
  
  let totalValidAssets = 0;
  const summaryBySheet = [];

  for (const sheet of workbook.worksheets) {
    const rows = [];
    let currentCategory = "";
    let officeLocation = "";
    let fiscalYear = "";

    // Read header info from top rows
    const r2 = sheet.getRow(2).values;
    if (r2) {
      officeLocation = r2.filter(Boolean)[0] || "";
    }
    const r3 = sheet.getRow(3).values;
    if (r3) {
      fiscalYear = r3.filter(Boolean)[0] || "";
    }

    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const values = (row.values || []).slice(1).map(v => {
        if (v && typeof v === "object") {
          if (v.text) return v.text.trim();
          if (v.result) return String(v.result).trim();
          if (v.richText) return v.richText.map(t => t.text).join("").trim();
          return "";
        }
        return v !== undefined && v !== null ? String(v).trim() : "";
      });

      // Check if this row is a category header e.g. "ประเภทโต๊ะ", "ประเภทเก้าอี้", "ประเภทเครื่องปรับอากาศ"
      const col1 = values[0] || "";
      const col2 = values[1] || "";
      const col3 = values[2] || "";
      const col4 = values[3] || "";
      const col5 = values[4] || "";

      if (col1.startsWith("ประเภท") || (col1 === col2 && col2 === col3 && col1.includes("ประเภท"))) {
        currentCategory = col1.replace(/^ประเภท/, "").trim();
        continue;
      }

      // Check if it's a valid data row (col 1 is number or has asset code in col 2 or item name in col 3)
      const isHeader = col1 === "ที่" || col3 === "รายการ" || col1.includes("ทะเบียน");
      if (isHeader) continue;

      if (col2 || col3) {
        // If col1 is numeric or col2 looks like asset code or col3 has description
        const assetCode = col2;
        const name = col3;
        const locationOrUser = col4;
        const note = col5;

        if (name && !name.includes("รายการ") && !name.includes("ทะเบียนคุม")) {
          rows.push({
            sheetName: sheet.name,
            no: col1,
            assetCode: assetCode || "ไม่มีเลข",
            name: name,
            category: currentCategory || "ครุภัณฑ์ทั่วไป",
            locationOrUser,
            officeLocation,
            fiscalYear,
            note
          });
        }
      }
    }

    totalValidAssets += rows.length;
    summaryBySheet.push({
      sheetName: sheet.name,
      officeLocation,
      count: rows.length,
      sample: rows.slice(0, 3)
    });
  }

  console.log(`Total valid assets found across all sheets: ${totalValidAssets}`);
  console.log("\nSummary by Sheet:");
  console.dir(summaryBySheet, { depth: null });
}

parseAllSheets().catch(console.error);
