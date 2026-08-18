import ExcelJS from "exceljs";
import type { Asset } from "./types";

export const statusLabels: Record<string, string> = {
  active: "พร้อมใช้งาน",
  available: "พร้อมใช้งาน",
  in_use: "กำลังใช้งาน",
  assigned: "มีผู้รับผิดชอบ",
  borrowed: "ถูกยืมใช้งาน",
  in_repair: "ส่งซ่อม",
  maintenance: "อยู่ระหว่างซ่อม",
  damaged: "ชำรุด",
  disposed: "จำหน่ายแล้ว",
  written_off: "จำหน่ายแล้ว",
  pending_approval: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  checked_out: "ยืมใช้งาน",
  completed: "เสร็จสิ้น",
  rejected: "ไม่อนุมัติ",
  waiting_parts: "รออะไหล่",
  in_progress: "กำลังดำเนินการ",
  planned: "ตามแผน",
  renewal_pending: "รอต่ออายุ",
  fact_finding: "ตรวจสอบข้อเท็จจริง",
  suspended: "ระงับการใช้งาน",
};

/**
 * ส่งออกข้อมูลครุภัณฑ์เป็นไฟล์ Excel (.xlsx) พร้อมฝังรูปภาพขนาดใหญ่พิเศษ (High-Resolution Inspection Size)
 */
export async function exportAssetsToExcel(
  rows: Asset[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AssetFlow";
  workbook.lastModifiedBy = "AssetFlow System";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet("ทะเบียนครุภัณฑ์", {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  // กำหนดคอลัมน์ (ขยายคอลัมน์รูปภาพเป็น 46 กว้าง ~350px ให้เห็นรายละเอียดสิ่งของชัดเจน)
  worksheet.columns = [
    { header: "ลำดับ", key: "index", width: 8 },
    { header: "รูปภาพครุภัณฑ์ (ภาพขยายตรวจนับ)", key: "image", width: 46 },
    { header: "รหัสครุภัณฑ์", key: "assetCode", width: 22 },
    { header: "ชื่อรายการครุภัณฑ์", key: "name", width: 35 },
    { header: "หมวดหมู่", key: "category", width: 18 },
    { header: "สถานที่จัดเก็บ", key: "location", width: 28 },
    { header: "ราคาจัดซื้อ (บาท)", key: "purchasePrice", width: 18 },
    { header: "สถานะ", key: "status", width: 16 },
    { header: "วันที่ได้มา", key: "acquisitionDate", width: 16 },
    { header: "หมายเหตุ / อาคาร", key: "building", width: 22 },
  ];

  // สไตล์แถวหัวตาราง (Header Row)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 38;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" }, // Slate 900
    };
    cell.font = {
      name: "Segoe UI",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      bottom: { style: "medium", color: { argb: "FF38BDF8" } }, // Accent cyan line
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  const total = rows.length;

  for (let i = 0; i < total; i++) {
    const r = rows[i];
    const rowIndex = i + 2; // แถวข้อมูลเริ่มจาก row 2
    if (onProgress) onProgress(i + 1, total);

    const row = worksheet.addRow({
      index: i + 1,
      image: "",
      assetCode: r.assetCode || "-",
      name: r.name || "-",
      category: r.category || "-",
      location: r.location || "-",
      purchasePrice: r.purchasePrice || 0,
      status: statusLabels[r.status || ""] || r.status || "พร้อมใช้งาน",
      acquisitionDate: r.purchaseDate ? new Date(r.purchaseDate).toLocaleDateString("th-TH") : "-",
      building: r.building || "-",
    });

    // ความสูงแถว 165px (~220 screen pixels) ให้เห็นภาพใหญ่เต็มตา ชัดเจนทุกรายละเอียด
    row.height = 165;

    // จัดตำแหน่งและฟอร์แมตเซลล์
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.font = { name: "Segoe UI", size: 10 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      // สีแถวสลับ (Zebra striping)
      if (i % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
    });

    row.getCell("index").alignment = { vertical: "middle", horizontal: "center" };
    row.getCell("assetCode").alignment = { vertical: "middle", horizontal: "center" };
    row.getCell("assetCode").font = { name: "Segoe UI", size: 11, bold: true };
    row.getCell("purchasePrice").numFmt = "#,##0.00";
    row.getCell("purchasePrice").alignment = { vertical: "middle", horizontal: "right" };
    row.getCell("status").alignment = { vertical: "middle", horizontal: "center" };
    row.getCell("acquisitionDate").alignment = { vertical: "middle", horizontal: "center" };

    // แทรกรูปภาพขนาดใหญ่พิเศษ (310 x 205 px) คมชัดเต็มช่องเซลล์
    if (r.imageUrl) {
      try {
        const res = await fetch(r.imageUrl);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const ext = r.imageUrl.toLowerCase().endsWith(".png") ? "png" : "jpeg";

          const imageId = workbook.addImage({
            buffer: buffer,
            extension: ext,
          });

          // วางรูปภาพด้วยขนาดคงที่ 310 x 205 px เพื่อความคมชัดสูงสุด
          worksheet.addImage(imageId, {
            tl: { col: 1.05, row: rowIndex - 1 + 0.03 } as any,
            ext: { width: 310, height: 205 },
            editAs: "oneCell",
          });
        }
      } catch (err) {
        console.warn(`[ExcelExport] ไม่สามารถโหลดรูปภาพสำหรับ ${r.assetCode}:`, err);
      }
    }
  }

  // สร้างไฟล์และดาวน์โหลดลงเครื่องผู้ใช้
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `AssetFlow_ทะเบียนครุภัณฑ์_พร้อมรูปภาพขยาย_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
