import ExcelJS from "exceljs";
import type { Asset } from "./types";

export const statusLabels: Record<string, string> = {
  active: "พร้อมใช้งาน",
  in_use: "กำลังใช้งาน",
  in_repair: "ส่งซ่อม",
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
 * ส่งออกข้อมูลครุภัณฑ์เป็นไฟล์ Excel (.xlsx) พร้อมฝังรูปภาพลงในแต่ละแถว
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

  // กำหนดคอลัมน์
  worksheet.columns = [
    { header: "ลำดับ", key: "index", width: 8 },
    { header: "รูปภาพ", key: "image", width: 18 },
    { header: "รหัสครุภัณฑ์", key: "assetCode", width: 20 },
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
  headerRow.height = 32;
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
    cell.alignment = { vertical: "middle", horizontal: "center" };
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

    row.height = 68; // ความสูงแถวให้พอดีกับ Thumbnail รูปภาพ

    // จัดตำแหน่งและฟอร์แมตเซลล์
    row.eachCell((cell, colNumber) => {
      cell.alignment = { vertical: "middle" };
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
    row.getCell("assetCode").font = { name: "Segoe UI", size: 10, bold: true };
    row.getCell("purchasePrice").numFmt = "#,##0.00";
    row.getCell("purchasePrice").alignment = { vertical: "middle", horizontal: "right" };
    row.getCell("status").alignment = { vertical: "middle", horizontal: "center" };
    row.getCell("acquisitionDate").alignment = { vertical: "middle", horizontal: "center" };

    // แทรกรูปภาพลงในเซลล์คอลัมน์ "รูปภาพ" (Column B)
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

          worksheet.addImage(imageId, {
            tl: { col: 1.15, row: rowIndex - 1 + 0.08 } as any,
            br: { col: 1.85, row: rowIndex - 0.08 } as any,
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
  link.download = `AssetFlow_ทะเบียนครุภัณฑ์_พร้อมรูปภาพ_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
