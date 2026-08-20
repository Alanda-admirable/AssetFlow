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

console.log("=== ตรวจสอบและคัดกรองข้อมูลครุภัณฑ์ที่ถูกต้องจริงจากไฟล์ Excel ===\n");

const cleanAssets = [];
const subHeaderRows = [];
const templateRows = [];
const duplicateCheck = new Map();
const noCodeRows = [];

workbook.eachSheet((worksheet, sheetId) => {
  const sheetName = worksheet.name;

  // 1. Skip Template / Draft sheets
  if (sheetName.includes("ฟอร์มสำรวจ") || sheetName.includes("แบบสำรวจ")) {
    console.log(`⏩ [Sheet ${sheetId}] ข้ามชีต "${sheetName}" (เป็นแบบฟอร์มร่างกระดาษเปล่า ปี 2562)`);
    return;
  }

  // 2. Handle Damaged summary sheet
  const isDamagedSheet = sheetName.includes("ชำรุด");

  const rawRows = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = getText(cell.value);
    });
    rawRows.push({ rowNumber, values });
  });

  let headerRowNumber = -1;
  for (const { rowNumber, values } of rawRows.slice(0, 15)) {
    const str = values.join(" ");
    if (str.includes("รายการ") || str.includes("รหัส") || str.includes("ชื่อ") || str.includes("ลำดับ") || str.includes("เลขที่ครุภัณฑ์")) {
      headerRowNumber = rowNumber;
      break;
    }
  }

  let sheetValidCount = 0;

  rawRows.forEach(({ rowNumber, values }) => {
    if (headerRowNumber !== -1 && rowNumber <= headerRowNumber) return;

    const rowStr = values.join(" ").trim();
    if (!rowStr) return;

    // Filter footers and signatures and table sub-header notes
    if (
      rowStr.includes("รวมทั้งสิ้น") ||
      rowStr.includes("ผู้ตรวจนับ") ||
      rowStr.includes("ลงชื่อ") ||
      rowStr.includes("คณะกรรมการ") ||
      rowStr.includes("หมายเหตุ :") ||
      rowStr.includes("ประธานกรรมการ") ||
      rowStr.includes("กรรมการ") ||
      rowStr.includes("(ชนิด/ยี่ห้อ/ลักษณะ/สี/ขนาด)") ||
      rowStr.startsWith("ใบตรวจนับ") ||
      rowStr.startsWith("แบบตรวจนับ") ||
      rowStr.startsWith("หน้า ")
    ) {
      return;
    }

    // Filter subheaders (e.g. "ประเภทโต๊ะ", "ประเภทเก้าอี้", etc.)
    const firstCell = values[0] || values[1] || "";
    if (
      rowStr.startsWith("ประเภท") ||
      (firstCell.startsWith("ประเภท") && values.filter(v => v !== "" && v !== firstCell).length === 0)
    ) {
      subHeaderRows.push({ sheetName, rowNumber, text: rowStr });
      return;
    }

    // Identify Columns
    // Check if column 1 is ordinal (1, 2, 3...) or code
    let ordinal = "";
    let code = "";
    let name = "";
    let locationDetail = "";
    let remarks = "";

    const nonEmpties = values.filter(v => v !== "");
    if (nonEmpties.length === 0) return;

    // Standard column layout:
    // Col 0: ที่ (1, 2, 3...)
    // Col 1: เลขที่ครุภัณฑ์
    // Col 2: รายการ
    // Col 3: จุดที่ตั้ง/ผู้ใช้งาน
    // Col 4: หมายเหตุ
    if (values[1] && (values[1].match(/^\d{4}-/) || values[1].match(/^[A-Z0-9-]{6,}$/) || values[1].includes("-") || values[1] === "ไม่มีเลข")) {
      ordinal = values[0];
      code = values[1];
      name = values[2] || nonEmpties[1] || "";
      locationDetail = values[3] || "";
      remarks = values[4] || "";
    } else if (values[0] && (values[0].match(/^\d{4}-/) || values[0].match(/^[A-Z0-9-]{6,}$/))) {
      code = values[0];
      name = values[1] || "";
      locationDetail = values[2] || "";
      remarks = values[3] || "";
    } else {
      // Fallback
      if (!isNaN(Number(values[0])) && values[1]) {
        ordinal = values[0];
        code = values[1];
        name = values[2] || values[1];
        locationDetail = values[3] || "";
        remarks = values[4] || "";
      } else {
        name = nonEmpties[0] || "";
        code = nonEmpties[1] || "";
      }
    }

    if (!name && !code) return;

    if (code === "ไม่มีเลข" || !code) {
      noCodeRows.push({ sheetName, rowNumber, name, locationDetail, remarks });
    }

    sheetValidCount++;
    cleanAssets.push({
      sheetName,
      rowNumber,
      code,
      name,
      locationDetail,
      remarks,
      isDamaged: isDamagedSheet || remarks.includes("ชำรุด") || name.includes("ชำรุด")
    });
  });

  console.log(`✅ [Sheet ${sheetId}] "${sheetName}": ข้อมูลครุภัณฑ์จริงที่ถูกต้อง = ${sheetValidCount} รายการ`);
});

console.log(`\n======================================================`);
console.log(`📊 ผลการตรวจสอบและคัดกรองข้อมูลครุภัณฑ์สุทธิ:`);
console.log(`- รายการครุภัณฑ์จริงที่ถูกต้องทั้งหมด: ${cleanAssets.length} รายการ`);
console.log(`- แถวหัวข้อคั่นหมวดหมู่ที่ตรวจพบและตัดออก (เช่น ประเภทโต๊ะ, ประเภทเก้าอี้): ${subHeaderRows.length} แถว`);
console.log(`- รายการที่ระบุว่า "ไม่มีเลข" หรือรอเลขครุภัณฑ์: ${noCodeRows.length} รายการ`);
console.log(`======================================================\n`);

console.log("--- ตัวอย่างแถวหัวข้อคั่นหมวดหมู่ที่ตัดออก (Sub-headers) ---");
subHeaderRows.slice(0, 8).forEach(sh => console.log(`[${sh.sheetName} แถว ${sh.rowNumber}] ${sh.text}`));

console.log("\n--- ตัวอย่างรายการที่ 'ไม่มีเลขครุภัณฑ์' (แต่เป็นทรัพย์สินจริงที่มีอยู่ในห้อง) ---");
noCodeRows.slice(0, 8).forEach(nc => console.log(`[${nc.sheetName} แถว ${nc.rowNumber}] ${nc.name} | จุดที่ตั้ง: ${nc.locationDetail || '-'} | หมายเหตุ: ${nc.remarks || '-'}`));
