"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { canAccessSection, navigationForRole, sectionTitles } from "../lib/navigation";
import type { Asset, BootstrapData, RequestRow } from "../lib/types";
import { exportAssetsToExcel } from "../lib/excelExport";

type ModalName = "asset" | "request" | "transfer" | "maintenance" | "document" | null;

const statusLabels: Record<string, string> = {
  available: "พร้อมใช้งาน",
  assigned: "มีผู้รับผิดชอบ",
  borrowed: "ถูกยืมใช้งาน",
  maintenance: "อยู่ระหว่างซ่อม",
  damaged: "ชำรุด",
  disposed: "จำหน่ายแล้ว",
  draft: "ร่าง",
  pending_approval: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  checked_out: "กำลังใช้งาน",
  completed: "เสร็จสิ้น",
  reported: "แจ้งแล้ว",
  waiting_parts: "รออะไหล่",
  in_progress: "กำลังดำเนินการ",
  planned: "วางแผนแล้ว",
  active: "ใช้งานอยู่",
  renewal_pending: "รอต่ออายุ",
  fact_finding: "ตรวจสอบข้อเท็จจริง",
  suspended: "ระงับการใช้งาน",
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function thaiDate(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  const str = String(value);
  const date = new Date(str.includes("T") ? str : str.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return str;
  return new Intl.DateTimeFormat("th-TH", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
}

function badge(status: string | null | undefined, color?: string | null) {
  const str = String(status || "");
  const tone = color || ({ pending_approval: "orange", approved: "green", checked_out: "violet", completed: "gray", rejected: "red", waiting_parts: "orange", in_progress: "blue", planned: "gray", active: "green", renewal_pending: "orange", fact_finding: "violet", suspended: "red" }[str] ?? "blue");
  return <span className={`status status-${tone}`}>{statusLabels[str] || str || "ไม่ระบุ"}</span>;
}

function exportAssets(rows: Asset[]) {
  const headers = ["รหัสครุภัณฑ์", "ชื่อครุภัณฑ์", "หมวดหมู่", "ที่ตั้ง", "มูลค่าจัดซื้อ"];
  const csv = [headers.join(","), ...rows.map((r) => [r.assetCode, r.name, r.category || "", r.location || "", r.purchasePrice || 0].map((v) => `"${v}"`).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `assets-export-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><div className="empty-mark">AF</div><strong>{title}</strong><p>{detail}</p></div>;
}

function LoadingScreen() {
  return <div className="loading-screen"><div className="loading-brand">AF</div><div><strong>กำลังเปิดระบบบริหารครุภัณฑ์</strong><span>เชื่อมข้อมูลและตรวจสิทธิ์ผู้ใช้งาน…</span></div></div>;
}

function getCategoryIcon(category?: string | null) {
  const cat = (category || "").toLowerCase();
  if (cat.includes("เก้าอี้")) return "💺";
  if (cat.includes("โต๊ะ")) return "🪑";
  if (cat.includes("คอมพิวเตอร์")) return "💻";
  if (cat.includes("พิมพ์") || cat.includes("printer")) return "🖨️";
  if (cat.includes("ปรับอากาศ") || cat.includes("แอร์")) return "❄️";
  if (cat.includes("ยานพาหนะ") || cat.includes("รถ")) return "🚗";
  if (cat.includes("ตู้") || cat.includes("ชั้นวาง")) return "🗄️";
  if (cat.includes("กล้อง")) return "📷";
  if (cat.includes("ไฟฟ้า") || cat.includes("เสียง") || cat.includes("ทีวี")) return "📻";
  if (cat.includes("เฟอร์นิเจอร์")) return "🛋️";
  return "📦";
}

function getMainLocationName(fullLocationStr?: string | null) {
  if (!fullLocationStr) return "สำนักงานจังหวัดปทุมธานี";
  const mainPart = fullLocationStr.split(/\s*>\s*/)[0].trim();
  return mainPart || "สำนักงานจังหวัดปทุมธานี";
}

function isAssetInLocation(asset: Asset, locName: string) {
  if (!locName || locName === "all") return true;
  const locStr = (asset.location || asset.building || "").toLowerCase();
  const target = locName.toLowerCase();
  if (!locStr) return false;
  return locStr === target || locStr.includes(target) || target.includes(locStr);
}

function PanelHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="panel-head">
      <h3>{title}</h3>
      {action ? <button className="button ghost" onClick={onAction}>{action}</button> : null}
    </div>
  );
}

function AddLocationModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, rooms: string, department: string) => void }) {
  const [name, setName] = useState("");
  const [rooms, setRooms] = useState("");
  const [department, setDepartment] = useState("สำนักงานจังหวัด");

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <button className="modal-backdrop" onClick={onClose} />
      <div className="modal-card" style={{ maxWidth: "520px" }}>
        <div className="modal-head">
          <div>
            <span>ระบบบริหารจัดการสถานที่จัดเก็บ</span>
            <h2>เพิ่มสถานที่จัดเก็บหลักใหม่</h2>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onAdd(name.trim(), rooms.trim(), department.trim()); onClose(); } }}>
          <div className="modal-body" style={{ gap: "14px" }}>
            <div className="form-field">
              <span>ชื่อสถานที่จัดเก็บหลัก <b>*</b></span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น ศาลากลางจังหวัด, อาคารสำนักงานจังหวัด"
                required
                autoFocus
              />
            </div>
            <div className="form-field">
              <span>รายละเอียดอาคาร / ห้องย่อยจัดเก็บภายใน</span>
              <textarea
                value={rooms}
                onChange={(e) => setRooms(e.target.value)}
                placeholder="เช่น เรือนรับรองชั้น 1, ห้องโถงพิธีการ, เรือนใหญ่ชั้น 2"
                rows={3}
                style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
              />
            </div>
            <div className="form-field">
              <span>หน่วยงานรับผิดชอบ</span>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="เช่น สำนักงานจังหวัด"
              />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="button ghost" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="button primary">บันทึกสถานที่ใหม่</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditLocationModal({
  locationName,
  initialRooms,
  initialDepartment,
  onClose,
  onSave,
}: {
  locationName: string;
  initialRooms?: string;
  initialDepartment?: string;
  onClose: () => void;
  onSave: (oldName: string, newName: string, rooms: string, department: string) => void;
}) {
  const [name, setName] = useState(locationName);
  const [rooms, setRooms] = useState(initialRooms || "เรือนรับรอง (ห้องโถงพิธีการชั้น 1), เรือนใหญ่");
  const [department, setDepartment] = useState(initialDepartment || "สำนักงานจังหวัด");

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <button className="modal-backdrop" onClick={onClose} />
      <div className="modal-card" style={{ maxWidth: "520px" }}>
        <div className="modal-head">
          <div>
            <span>ทะเบียนสถานที่จัดเก็บหลัก</span>
            <h2>แก้ไขข้อมูลสถานที่จัดเก็บ</h2>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              onSave(locationName, name.trim(), rooms.trim(), department.trim());
              onClose();
            }
          }}
        >
          <div className="modal-body" style={{ gap: "14px" }}>
            <div className="form-field">
              <span>ชื่อสถานที่จัดเก็บหลัก <b>*</b></span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-field">
              <span>รายละเอียดอาคาร / ห้องย่อยจัดเก็บภายใน</span>
              <textarea
                value={rooms}
                onChange={(e) => setRooms(e.target.value)}
                rows={3}
                style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
              />
            </div>
            <div className="form-field">
              <span>หน่วยงานรับผิดชอบ</span>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="button ghost" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="button primary">บันทึกการแก้ไข</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteLocationModal({
  locationName,
  onClose,
  onConfirm,
}: {
  locationName: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <button className="modal-backdrop" onClick={onClose} />
      <div className="modal-card" style={{ maxWidth: "440px" }}>
        <div className="modal-head">
          <div>
            <span>ยืนยันการลบสถานที่จัดเก็บ</span>
            <h2>ต้องการลบสถานที่นี้หรือไม่?</h2>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: "14px", color: "#475569", lineHeight: "1.5" }}>
            คุณกำลังจะลบสถานที่ <strong>"{locationName}"</strong> ออกจากระบบทะเบียนสถานที่จัดเก็บ
          </p>
        </div>
        <div className="modal-foot">
          <button type="button" className="button ghost" onClick={onClose}>ยกเลิก</button>
          <button
            type="button"
            className="button danger"
            onClick={() => {
              onConfirm(locationName);
              onClose();
            }}
          >
            ยืนยันการลบสถานที่
          </button>
        </div>
      </div>
    </div>
  );
}

{/* Selectable Print Checklist Options Modal */}
function PrintChecklistModal({
  allAssets,
  allLocations,
  onClose,
  onConfirmPrint,
}: {
  allAssets: Asset[];
  allLocations: string[];
  onClose: () => void;
  onConfirmPrint: (selectedAssets: Asset[]) => void;
}) {
  const [selectedLoc, setSelectedLoc] = useState<string>("all");
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Calculate available rooms based on selectedLoc
  const availableRooms = useMemo(() => {
    let assetsPool = allAssets;
    if (selectedLoc !== "all") {
      assetsPool = allAssets.filter((a) => isAssetInLocation(a, selectedLoc));
    }
    const set = new Set<string>();
    assetsPool.forEach((a) => {
      const room = a.location || a.building || "ห้องทั่วไป / ไม่ระบุ";
      set.add(room);
    });
    return Array.from(set);
  }, [allAssets, selectedLoc]);

  // Calculate available categories
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    allAssets.forEach((a) => {
      set.add(a.category || "ไม่ระบุหมวดหมู่");
    });
    return Array.from(set);
  }, [allAssets]);

  useEffect(() => {
    setSelectedRooms(availableRooms);
  }, [availableRooms]);

  useEffect(() => {
    setSelectedCategories(availableCategories);
  }, [availableCategories]);

  // Filter final selected assets for printing
  const filteredPrintAssets = useMemo(() => {
    return allAssets.filter((a) => {
      if (selectedLoc !== "all" && !isAssetInLocation(a, selectedLoc)) return false;
      const room = a.location || a.building || "ห้องทั่วไป / ไม่ระบุ";
      if (selectedRooms.length > 0 && !selectedRooms.includes(room)) return false;
      const cat = a.category || "ไม่ระบุหมวดหมู่";
      if (selectedCategories.length > 0 && !selectedCategories.includes(cat)) return false;
      return true;
    });
  }, [allAssets, selectedLoc, selectedRooms, selectedCategories]);

  function toggleAllRooms(select: boolean) {
    setSelectedRooms(select ? availableRooms : []);
  }

  function toggleAllCategories(select: boolean) {
    setSelectedCategories(select ? availableCategories : []);
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <button className="modal-backdrop" onClick={onClose} />
      <div className="modal-card" style={{ maxWidth: "680px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-head">
          <div>
            <span>ระบบออกเอกสารการตรวจนับ</span>
            <h2>ตัวเลือกการพิมพ์ใบตรวจนับพัสดุ</h2>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ overflowY: "auto", flex: 1, padding: "20px", gap: "16px" }}>
          
          {/* Step 1: Select Main Location */}
          <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
            <strong style={{ fontSize: "14px", color: "#0f172a", display: "block", marginBottom: "8px" }}>
              1. เลือกสถานที่จัดเก็บหลัก / อาคาร
            </strong>
            <select
              value={selectedLoc}
              onChange={(e) => setSelectedLoc(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
            >
              <option value="all">ทุกสถานที่จัดเก็บหลัก ({allAssets.length} รายการ)</option>
              {allLocations.map((loc) => {
                const count = allAssets.filter((a) => isAssetInLocation(a, loc)).length;
                return (
                  <option key={loc} value={loc}>
                    {loc} ({count} รายการ)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Step 2: Select Rooms */}
          <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                2. เลือกห้อง / จุดจัดเก็บพัสดุย่อย ({selectedRooms.length}/{availableRooms.length} ห้อง)
              </strong>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" className="button ghost" style={{ fontSize: "11px", padding: "2px 8px" }} onClick={() => toggleAllRooms(true)}>เลือกทั้งหมด</button>
                <button type="button" className="button ghost" style={{ fontSize: "11px", padding: "2px 8px" }} onClick={() => toggleAllRooms(false)}>ยกเลิกทั้งหมด</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "8px", maxHeight: "160px", overflowY: "auto", paddingRight: "4px" }}>
              {availableRooms.map((room) => {
                const count = allAssets.filter((a) => (selectedLoc === "all" || isAssetInLocation(a, selectedLoc)) && (a.location || a.building || "ห้องทั่วไป / ไม่ระบุ") === room).length;
                const checked = selectedRooms.includes(room);
                return (
                  <label key={room} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", background: checked ? "#f0fdfa" : "#f8fafc", padding: "6px 10px", borderRadius: "6px", border: checked ? "1px solid #0f766e" : "1px solid #e2e8f0", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedRooms((prev) => [...prev, room]);
                        else setSelectedRooms((prev) => prev.filter((r) => r !== room));
                      }}
                    />
                    <span style={{ flex: 1, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={room}>{room}</span>
                    <b style={{ color: "#0f766e", fontSize: "11px" }}>{count}</b>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Step 3: Select Categories */}
          <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                3. เลือกหมวดหมู่ครุภัณฑ์ ({selectedCategories.length}/{availableCategories.length} หมวด)
              </strong>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" className="button ghost" style={{ fontSize: "11px", padding: "2px 8px" }} onClick={() => toggleAllCategories(true)}>เลือกทั้งหมด</button>
                <button type="button" className="button ghost" style={{ fontSize: "11px", padding: "2px 8px" }} onClick={() => toggleAllCategories(false)}>ยกเลิกทั้งหมด</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px", maxHeight: "140px", overflowY: "auto", paddingRight: "4px" }}>
              {availableCategories.map((cat) => {
                const count = allAssets.filter((a) => (a.category || "ไม่ระบุหมวดหมู่") === cat).length;
                const checked = selectedCategories.includes(cat);
                return (
                  <label key={cat} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", background: checked ? "#f0fdfa" : "#f8fafc", padding: "6px 10px", borderRadius: "6px", border: checked ? "1px solid #0f766e" : "1px solid #e2e8f0", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCategories((prev) => [...prev, cat]);
                        else setSelectedCategories((prev) => prev.filter((c) => c !== cat));
                      }}
                    />
                    <span style={{ flex: 1, color: "#334155" }}>{cat}</span>
                    <b style={{ color: "#0f766e", fontSize: "11px" }}>{count}</b>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Summary Box */}
          <div style={{ background: "#f0fdfa", padding: "14px", borderRadius: "10px", border: "1px solid #b5d5d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: "12px", color: "#0f766e", fontWeight: "bold", display: "block" }}>สรุปยอดที่จะสั่งพิมพ์ใบตรวจนับ:</span>
              <span style={{ fontSize: "13px", color: "#0f172a" }}>
                รวมพัสดุทั้งสิ้น <strong>{filteredPrintAssets.length}</strong> รายการ
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#475569" }}>
              {filteredPrintAssets.length === 0 ? "⚠️ กรุณาเลือกรายการอย่างน้อย 1 รายการ" : "✓ พร้อมสั่งพิมพ์"}
            </div>
          </div>

        </div>

        <div className="modal-foot">
          <button type="button" className="button ghost" onClick={onClose}>ยกเลิก</button>
          <button
            type="button"
            className="button primary"
            disabled={filteredPrintAssets.length === 0}
            onClick={() => {
              onConfirmPrint(filteredPrintAssets);
              onClose();
            }}
          >
            🖨️ พิมพ์ใบตรวจนับ ({filteredPrintAssets.length} รายการที่เลือก)
          </button>
        </div>
      </div>
    </div>
  );
}

{/* Location Directory: Structured Table List View */}
function LocationDirectoryView({
  locations,
  locationDetails,
  assets,
  onSelectLocation,
  onEditLocation,
  onDeleteLocation,
}: {
  locations: string[];
  locationDetails?: Record<string, { rooms?: string; department?: string }>;
  assets: Asset[];
  onSelectLocation: (locationName: string) => void;
  onEditLocation: (locationName: string) => void;
  onDeleteLocation: (locationName: string) => void;
}) {
  return (
    <div className="panel" style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid #e2e8f0", background: "#ffffff" }}>
      <div className="table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", fontSize: "12px", color: "#475569" }}>
              <th style={{ padding: "12px 16px", width: "60px", textAlign: "center" }}>ลำดับ</th>
              <th style={{ padding: "12px 16px" }}>สถานที่จัดเก็บหลัก / อาคาร</th>
              <th style={{ padding: "12px 16px" }}>หน่วยงานรับผิดชอบ</th>
              <th style={{ padding: "12px 16px" }}>รายละเอียดอาคาร / ห้องย่อยภายใน</th>
              <th style={{ padding: "12px 16px", textAlign: "center", width: "120px" }}>จำนวนพัสดุ</th>
              <th style={{ padding: "12px 16px", textAlign: "right", width: "260px" }}>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                  ยังไม่มีสถานที่จัดเก็บในระบบ กดปุ่ม <strong>+ เพิ่มสถานที่จัดเก็บใหม่</strong> เพื่อสร้างรายการแรก
                </td>
              </tr>
            ) : (
              locations.map((locName, idx) => {
                const locAssets = assets.filter((a) => isAssetInLocation(a, locName));
                const subRooms = Array.from(
                  new Set(
                    locAssets
                      .map((a) => a.location)
                      .filter(Boolean)
                      .map((loc) => {
                        const parts = (loc || "").split(/\s*>\s*/);
                        return parts.length > 1 ? parts.slice(1).join(" > ") : null;
                      })
                      .filter(Boolean)
                  )
                ) as string[];

                const details = locationDetails?.[locName] || {};
                const defaultRooms = "เรือนรับรอง (ห้องโถงพิธีการชั้น 1), เรือนใหญ่, หอกลอง/หอบูชา";
                const displayRooms = details.rooms || (subRooms.length ? subRooms.join(", ") : defaultRooms);
                const displayDepartment = details.department || "สำนักงานจังหวัด";

                return (
                  <tr
                    key={locName}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      fontSize: "13px",
                      transition: "background-color 0.15s ease",
                    }}
                    className="table-row-hover"
                  >
                    <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: "bold", color: "#64748b" }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <strong style={{ color: "#0f172a", fontSize: "14px", display: "block" }}>{locName}</strong>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#0f766e", fontWeight: 600 }}>
                      {displayDepartment}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#475569", maxWidth: "340px", lineHeight: "1.4" }}>
                      {displayRooms}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <span
                        style={{
                          background: "#f0fdfa",
                          color: "#0f766e",
                          fontSize: "12px",
                          fontWeight: "bold",
                          padding: "4px 12px",
                          borderRadius: "20px",
                          border: "1px solid #b5d5d0",
                          display: "inline-block",
                        }}
                      >
                        {locAssets.length} รายการ
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="button primary"
                          style={{ fontSize: "12px", padding: "6px 10px", gap: "4px" }}
                          onClick={() => onSelectLocation(locName)}
                        >
                          <span>แคตตาล็อกรูปภาพ</span>
                          <span>→</span>
                        </button>
                        <button
                          type="button"
                          className="button ghost"
                          style={{ fontSize: "12px", padding: "6px 8px" }}
                          onClick={() => onEditLocation(locName)}
                          title="แก้ไขสถานที่"
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          className="button danger"
                          style={{ fontSize: "12px", padding: "6px 8px" }}
                          onClick={() => onDeleteLocation(locName)}
                          title="ลบสถานที่"
                        >
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VisualCatalog({
  assets,
  allAssets,
  allLocationsList,
  data,
  role,
  selectedLocation,
  setSelectedLocation,
  onBackToDirectory,
  helpers,
}: {
  assets: Asset[];
  allAssets: Asset[];
  allLocationsList?: string[];
  data: BootstrapData;
  role?: string | null;
  selectedLocation?: string;
  setSelectedLocation?: (loc: string) => void;
  onBackToDirectory?: () => void;
  helpers: any;
}) {
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [customPrintAssets, setCustomPrintAssets] = useState<Asset[] | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  async function handleExportExcel() {
    try {
      setIsExportingExcel(true);
      await exportAssetsToExcel(displayedAssets as any, (current, total) => {
        setExportProgress({ current, total });
      });
    } catch (err) {
      console.error("Export Excel error:", err);
      alert("เกิดข้อผิดพลาดในการสร้างไฟล์ Excel");
    } finally {
      setIsExportingExcel(false);
      setExportProgress(null);
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return ["all", ...Array.from(set)];
  }, [assets]);

  const displayedAssets = useMemo(() => {
    if (selectedCategory === "all") return assets;
    return assets.filter((a) => a.category === selectedCategory);
  }, [assets, selectedCategory]);

  const canManage = role === "admin" || role === "asset_officer";

  async function handleDelete(asset: Asset) {
    const ok = await helpers.post(`/api/assets/${asset.id}`, { _method: "DELETE" }, `ลบครุภัณฑ์ ${asset.assetCode} เรียบร้อยแล้ว`);
    if (ok) {
      setActiveAsset(null);
      setConfirmDeleteId(null);
    }
  }

  async function handleUpdateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingAsset) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: formData.get("name"),
      assetCode: formData.get("assetCode"),
      categoryName: formData.get("categoryName"),
      imageUrl: formData.get("imageUrl"),
      building: formData.get("building"),
      location: formData.get("room"),
      description: formData.get("description"),
      purchasePrice: formData.get("purchasePrice"),
    };
    const ok = await helpers.post(`/api/assets/${editingAsset.id}`, { ...payload, _method: "PUT" }, "แก้ไขข้อมูลครุภัณฑ์เรียบร้อยแล้ว");
    if (ok) {
      setEditingAsset(null);
      setActiveAsset(null);
    }
  }

  function triggerSelectedPrint(selectedAssets: Asset[]) {
    setCustomPrintAssets(selectedAssets);
    setTimeout(() => {
      window.print();
    }, 150);
  }

  const fallbackImg = "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80";

  // Group assets for print checklist
  const printAssetsPool = customPrintAssets || (allAssets && allAssets.length ? allAssets : assets);
  const groupedByRoomForPrint = Object.entries(
    printAssetsPool.reduce<Record<string, Asset[]>>((acc, item) => {
      const room = item.location || item.building || "ห้องทั่วไป / ไม่ระบุ";
      if (!acc[room]) acc[room] = [];
      acc[room].push(item);
      return acc;
    }, {})
  );

  return (
    <div className="catalog-wrapper">
      {/* Category Pills & Action Toolbar */}
      <div className="catalog-filter-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <div className="category-pills" style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {onBackToDirectory && (
            <button
              className="button ghost"
              style={{ padding: "6px 12px", fontSize: "13px" }}
              onClick={onBackToDirectory}
            >
              ← ทะเบียนสถานที่
            </button>
          )}

          {/* View Mode Toggle */}
          <div style={{ display: "inline-flex", background: "#e2e8f0", padding: "3px", borderRadius: "8px", gap: "2px" }}>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "6px",
                border: "none",
                background: viewMode === "table" ? "#ffffff" : "transparent",
                color: viewMode === "table" ? "#0f766e" : "#475569",
                boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                cursor: "pointer"
              }}
            >
              📋 ตาราง ({displayedAssets.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "6px",
                border: "none",
                background: viewMode === "grid" ? "#ffffff" : "transparent",
                color: viewMode === "grid" ? "#0f766e" : "#475569",
                boxShadow: viewMode === "grid" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                cursor: "pointer"
              }}
            >
              🖼️ การ์ดรูปภาพ
            </button>
          </div>

          <button
            className={`pill-btn ${selectedCategory === "all" ? "active" : ""}`}
            onClick={() => setSelectedCategory("all")}
          >
            ทั้งหมด ({assets.length})
          </button>
          {categories.filter((c) => c !== "all").map((cat) => (
            <button
              key={cat}
              className={`pill-btn ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              <span>{getCategoryIcon(cat)} {cat}</span> ({assets.filter((a) => a.category === cat).length})
            </button>
          ))}
        </div>

        <div className="catalog-actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {canManage && (
            <button className="button primary" onClick={() => helpers.setModal("asset")}>
              + เพิ่มข้อมูลครุภัณฑ์
            </button>
          )}
          <button
            className="button ghost"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            title="ส่งออกทะเบียนครุภัณฑ์เป็นไฟล์ Excel"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
          >
            {isExportingExcel ? (
              <span>⏳ กำลังสร้าง Excel ({exportProgress ? `${exportProgress.current}/${exportProgress.total}` : "..."})</span>
            ) : (
              <span>📊 ส่งออก Excel</span>
            )}
          </button>
          <button
            className="button ghost"
            onClick={() => exportAssets(displayedAssets)}
            title="ส่งออกเฉพาะข้อความแบบ CSV"
            style={{ padding: "8px 10px", fontSize: "12px", opacity: 0.75 }}
          >
            CSV
          </button>
          <button className="button primary" onClick={() => setIsPrintModalOpen(true)}>
            🖨️ พิมพ์ใบตรวจนับ
          </button>
        </div>
      </div>

      {displayedAssets.length === 0 ? (
        <Empty title="ไม่พบรายการในระบบ" detail="ลองเปลี่ยนคำค้นหา ตัวกรองประเภท หรือกดเพิ่มรายการใหม่" />
      ) : viewMode === "table" ? (
        /* Responsive Asset Table View */
        <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 600 }}>
                  <th style={{ padding: "12px 14px", width: "50px", textAlign: "center" }}>ที่</th>
                  <th style={{ padding: "12px 14px", width: "160px" }}>รหัสครุภัณฑ์</th>
                  <th style={{ padding: "12px 14px" }}>รายการครุภัณฑ์ / ยี่ห้อ / ลักษณะ</th>
                  <th style={{ padding: "12px 14px", width: "140px" }}>หมวดหมู่</th>
                  <th style={{ padding: "12px 14px", width: "200px" }}>จุดที่ตั้ง / ห้อง</th>
                  <th style={{ padding: "12px 14px", width: "100px", textAlign: "center" }}>สถานะ</th>
                  <th style={{ padding: "12px 14px", width: "140px", textAlign: "right" }}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {displayedAssets.map((asset, idx) => (
                  <tr
                    key={asset.id}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                    className="table-row-hover"
                    onClick={() => setActiveAsset(asset)}
                  >
                    <td style={{ padding: "10px 14px", textAlign: "center", color: "#64748b", fontWeight: 600 }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 600, color: "#0f766e" }}>
                      {asset.assetCode}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "18px" }}>{getCategoryIcon(asset.category)}</span>
                        <div>
                          <strong style={{ color: "#0f172a", display: "block" }}>{asset.name}</strong>
                          {asset.description && (
                            <span style={{ fontSize: "11px", color: "#64748b" }}>{asset.description}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#334155" }}>
                      <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: "12px", fontSize: "12px" }}>
                        {asset.category || "ครุภัณฑ์ทั่วไป"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#475569", fontSize: "12px" }}>
                      {asset.location || "สำนักงานจังหวัด"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      {badge(asset.status, asset.statusColor)}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="button ghost"
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                          onClick={() => setActiveAsset(asset)}
                        >
                          ดูข้อมูล
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            className="button ghost"
                            style={{ fontSize: "11px", padding: "4px 8px" }}
                            onClick={() => setEditingAsset(asset)}
                          >
                            แก้ไข
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Catalog Image Cards Grid */
        <div className="catalog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
          {displayedAssets.map((asset) => {
            const hasImg = Boolean(asset.imageUrl);
            const img = asset.imageUrl || fallbackImg;
            return (
              <div
                key={asset.id}
                className="catalog-card"
                onClick={() => setActiveAsset(asset)}
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
              >
                <div
                  className="catalog-card-media"
                  style={{
                    width: "100%",
                    height: "160px",
                    overflow: "hidden",
                    background: hasImg ? "#f1f5f9" : "linear-gradient(135deg, #f0fdfa 0%, #e2e8f0 100%)",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {hasImg ? (
                    <img src={img} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: "48px", display: "block" }}>{getCategoryIcon(asset.category)}</span>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>{asset.category || "ครุภัณฑ์"}</span>
                    </div>
                  )}
                </div>
                <div className="catalog-card-info" style={{ padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", color: "#0f766e", fontWeight: 700 }}>
                      {asset.category || "ไม่ระบุหมวดหมู่"}
                    </span>
                    {badge(asset.status, asset.statusColor)}
                  </div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>{asset.name}</h4>
                  <div style={{ fontSize: "12px", color: "#64748b", fontFamily: "monospace", marginBottom: "6px" }}>
                    รหัส: {asset.assetCode}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#475569", borderTop: "1px solid #f1f5f9", paddingTop: "8px", marginTop: "4px" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "140px" }}>{asset.location || "ส่วนกลาง"}</span>
                    <strong style={{ color: "#0f766e" }}>{money(asset.purchasePrice)}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Asset Detail Modal */}
      {activeAsset && (
        <div className="modal-layer" role="dialog" aria-modal="true">
          <button className="modal-backdrop" onClick={() => setActiveAsset(null)} />
          <div className="modal-card" style={{ maxWidth: "720px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div className="modal-head">
              <div>
                <span>รายละเอียดรายการในแคตตาล็อก</span>
                <h2>{activeAsset.name}</h2>
              </div>
              <button type="button" onClick={() => setActiveAsset(null)}>×</button>
            </div>
            <div className="modal-body" style={{ overflowY: "auto", flex: 1, padding: "20px", gap: "16px" }}>
              <div
                style={{
                  width: "100%",
                  minHeight: "280px",
                  maxHeight: "480px",
                  overflow: "hidden",
                  borderRadius: "12px",
                  background: "#0f172a",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: "8px",
                  boxShadow: "inset 0 0 10px rgba(0,0,0,0.5)",
                }}
              >
                <img
                  src={activeAsset.imageUrl || fallbackImg}
                  alt={activeAsset.name}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "460px",
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                    borderRadius: "6px",
                  }}
                />
              </div>
              <dl className="info-grid">
                <div><dt>รหัสครุภัณฑ์</dt><dd>{activeAsset.assetCode}</dd></div>
                <div><dt>Serial Number</dt><dd>{activeAsset.serialNumber || "—"}</dd></div>
                <div><dt>หมวดหมู่</dt><dd>{activeAsset.category || "—"}</dd></div>
                <div><dt>สถานที่จัดเก็บ</dt><dd>{activeAsset.location || "—"}</dd></div>
                <div><dt>อาคาร / เรือน</dt><dd>{activeAsset.building || "—"}</dd></div>
                <div><dt>มูลค่าจัดซื้อ</dt><dd>{money(activeAsset.purchasePrice)}</dd></div>
                <div><dt>สถานะ</dt><dd>{badge(activeAsset.status, activeAsset.statusColor)}</dd></div>
                <div><dt>ผู้รับผิดชอบ</dt><dd>{activeAsset.assignedTo || "ส่วนกลาง"}</dd></div>
              </dl>
              {activeAsset.description && (
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px" }}>
                  <strong>คำบรรยาย / หมายเหตุ:</strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#334155" }}>{activeAsset.description}</p>
                </div>
              )}
            </div>
            <div className="modal-foot">
              {canManage && (
                <>
                  <button type="button" className="button danger" onClick={() => setConfirmDeleteId(activeAsset.id)}>
                    ลบรายการนี้
                  </button>
                  <button type="button" className="button primary" onClick={() => { setEditingAsset(activeAsset); setActiveAsset(null); }}>
                    แก้ไขข้อมูล
                  </button>
                </>
              )}
              <button type="button" className="button ghost" onClick={() => setActiveAsset(null)}>ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {editingAsset && (
        <div className="modal-layer" role="dialog" aria-modal="true">
          <button className="modal-backdrop" onClick={() => setEditingAsset(null)} />
          <div className="modal-card" style={{ maxWidth: "640px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div className="modal-head">
              <div>
                <span>แก้ไขข้อมูลครุภัณฑ์</span>
                <h2>{editingAsset.name}</h2>
              </div>
              <button type="button" onClick={() => setEditingAsset(null)}>×</button>
            </div>
            <form onSubmit={handleUpdateSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <div className="modal-body" style={{ overflowY: "auto", flex: 1, padding: "20px", gap: "12px" }}>
                <Field label="ชื่อครุภัณฑ์" name="name" required><input name="name" defaultValue={editingAsset.name} required /></Field>
                <Field label="รหัสครุภัณฑ์" name="assetCode" required><input name="assetCode" defaultValue={editingAsset.assetCode} required /></Field>
                <Field label="หมวดหมู่" name="categoryName"><input name="categoryName" defaultValue={editingAsset.category || ""} placeholder="เช่น พระพุทธรูป, ศิลปวัตถุ, เครื่องใช้ไฟฟ้า" /></Field>
                <Field label="ราคาจัดซื้อ (บาท)" name="purchasePrice" type="number"><input name="purchasePrice" type="number" defaultValue={editingAsset.purchasePrice} /></Field>
                <Field label="URL รูปภาพ / แนบรูปถ่าย" name="imageUrl"><input name="imageUrl" defaultValue={editingAsset.imageUrl || ""} placeholder="วางลิงก์ URL รูปภาพหรือระบุตำแหน่งรูปถ่าย" /></Field>
                <Field label="สถานที่จัดเก็บหลัก / อาคาร" name="building"><input name="building" defaultValue={editingAsset.building || ""} placeholder="เช่น จวนผู้ว่าราชการจังหวัด" /></Field>
                <Field label="ห้อง / รายละเอียดสถานที่" name="room"><input name="room" defaultValue={editingAsset.location || ""} placeholder="เช่น หอกลอง/หอบูชา" /></Field>
                <label className="form-field full">
                  <span>คำบรรยาย / รายละเอียดพัสดุ</span>
                  <textarea name="description" defaultValue={editingAsset.description || ""} rows={3} placeholder="คำบรรยายพัสดุ สภาพ ประวัติ..." style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
                </label>
              </div>
              <div className="modal-foot">
                <button type="button" className="button ghost" onClick={() => setEditingAsset(null)}>ยกเลิก</button>
                <button type="submit" className="button primary">บันทึกการแก้ไข</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="modal-layer" role="dialog" aria-modal="true">
          <button className="modal-backdrop" onClick={() => setConfirmDeleteId(null)} />
          <div className="modal-card" style={{ maxWidth: "420px" }}>
            <div className="modal-head">
              <div>
                <span>ยืนยันการลบรายการ</span>
                <h2>ต้องการลบครุภัณฑ์นี้หรือไม่?</h2>
              </div>
              <button type="button" onClick={() => setConfirmDeleteId(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: "14px", color: "#475569" }}>
                การลบรายการครุภัณฑ์นี้จะไม่สามารถย้อนกลับได้ คุณแน่ใจหรือไม่ที่จะลบรายการออกขากระบบ?
              </p>
            </div>
            <div className="modal-foot">
              <button type="button" className="button ghost" onClick={() => setConfirmDeleteId(null)}>ยกเลิก</button>
              <button type="button" className="button danger" onClick={() => { const a = assets.find((x) => x.id === confirmDeleteId); if (a) handleDelete(a); }}>
                ยืนยันลบข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Checklist Selection Modal */}
      {isPrintModalOpen && (
        <PrintChecklistModal
          allAssets={allAssets && allAssets.length ? allAssets : assets}
          allLocations={allLocationsList || ["จวนผู้ว่าราชการจังหวัด"]}
          onClose={() => setIsPrintModalOpen(false)}
          onConfirmPrint={triggerSelectedPrint}
        />
      )}

      {/* Print-only Checklist Layout (A4 Portrait with exact CSS classes) */}
      <div className="print-checklist-only">
        <div className="print-header">
          <h2>ใบตรวจนับครุภัณฑ์</h2>
          <p>หน่วยงาน: {data.actor?.departmentName || data.meta?.departments?.[0]?.name || "สำนักงานจังหวัด"} · วันที่พิมพ์: {new Date().toLocaleDateString("th-TH")} (รวม {printAssetsPool.length} รายการ)</p>
        </div>

        {groupedByRoomForPrint.map(([roomName, roomAssets]) => (
          <div key={roomName} className="print-room-group">
            <h3 className="print-room-title">ห้อง / สถานที่: {roomName} (จำนวน {roomAssets.length} รายการ)</h3>
            <div className="print-items-list">
              {roomAssets.map((item, idx) => (
                <div key={item.id} className="print-item-row">
                  {/* Left Column: Image on the left, details text on the right */}
                  <div className="print-item-left">
                    <span className="print-item-index" style={{ fontWeight: "bold", fontSize: "12px", marginRight: "4px" }}>{idx + 1}.</span>
                    <img
                      src={item.imageUrl || fallbackImg}
                      alt={item.name}
                      className="print-item-img"
                    />
                    <div className="print-item-details">
                      <h4 className="print-item-name">{item.name}</h4>
                      <div className="print-item-meta">
                        <span>รหัส: <strong className="mono">{item.assetCode}</strong></span>
                        <span>หมวดหมู่: {item.category || "—"} · S/N: {item.serialNumber || "—"}</span>
                        <span>มูลค่าจัดซื้อ: <strong>{money(item.purchasePrice)}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Space for check / notes */}
                  <div className="print-item-right">
                    <div className="print-checkboxes">
                      <span className="print-box-item">[  ] ปกติ</span>
                      <span className="print-box-item">[  ] ชำรุด</span>
                      <span className="print-box-item">[  ] สูญหาย</span>
                    </div>
                    <div className="print-dotted-lines">
                      <div className="print-line">หมายเหตุ: ............................................................................</div>
                      <div className="print-line">ผู้ตรวจ: ........................................... วันที่: ......./......./.......</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="print-footer">
          <p>ลงชื่อผู้ตรวจนับ: ........................................................... (...........................................................)  ตำแหน่ง: ...........................................................</p>
          <small>AssetFlow Management System · เอกสารสืบค้นเพื่อการตรวจนับครุภัณฑ์ประจำปี</small>
        </div>
      </div>
    </div>
  );
}

function renderSection(
  section: string,
  data: BootstrapData,
  assets: Asset[],
  allAssets: Asset[],
  allLocationsList: string[],
  selectedId: string | undefined,
  helpers: RenderHelpers
) {
  switch (section) {
    case "dashboard":
    case "assets":
      return (
        <VisualCatalog
          data={data}
          assets={assets}
          allAssets={allAssets}
          allLocationsList={allLocationsList}
          role={data.actor?.roleCode}
          selectedLocation={helpers.selectedLocation}
          setSelectedLocation={helpers.setSelectedLocation}
          onBackToDirectory={helpers.onBackToDirectory}
          helpers={helpers}
        />
      );
    case "users":
      return <Users data={data} helpers={helpers} />;
    default:
      return (
        <VisualCatalog
          data={data}
          assets={assets}
          allAssets={allAssets}
          allLocationsList={allLocationsList}
          role={data.actor?.roleCode}
          selectedLocation={helpers.selectedLocation}
          setSelectedLocation={helpers.setSelectedLocation}
          onBackToDirectory={helpers.onBackToDirectory}
          helpers={helpers}
        />
      );
  }
}

type RenderHelpers = {
  setModal: (value: ModalName) => void;
  post: (url: string, payload: unknown, success: string) => Promise<boolean>;
  busy: boolean;
  query: string;
  setQuery: (value: string) => void;
  scanCode: string;
  setScanCode: (value: string) => void;
  scanResult: Asset | null;
  setScanResult: (value: Asset | null) => void;
  router: ReturnType<typeof useRouter>;
  selectedLocation?: string;
  setSelectedLocation?: (loc: string) => void;
  selectedCategory?: string;
  setSelectedCategory?: (cat: string) => void;
  selectedYear?: string;
  setSelectedYear?: (yr: string) => void;
  onBackToDirectory?: () => void;
  reloadBootstrap?: () => void;
};

export function AppShell({ section, selectedId }: { section: string; selectedId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<ModalName>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [scanResult, setScanResult] = useState<Asset | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [currentView, setCurrentView] = useState<"directory" | "catalog">("catalog");
  const [customLocations, setCustomLocations] = useState<Array<{ name: string; rooms?: string; department?: string }>>([]);
  const [deletedLocationNames, setDeletedLocationNames] = useState<string[]>([]);
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [editingLocationName, setEditingLocationName] = useState<string | null>(null);
  const [deletingLocationName, setDeletingLocationName] = useState<string | null>(null);

  const locationDetails = useMemo(() => {
    const map: Record<string, { rooms?: string; department?: string }> = {};
    const defaultDept = String(data?.meta?.departments?.[0]?.name || data?.actor?.departmentName || "สำนักงานจังหวัดปทุมธานี");
    (data?.meta?.locations || []).forEach((loc: any) => {
      const locKey = loc.room || loc.building;
      if (locKey) {
        map[locKey] = { rooms: String(loc.room || ""), department: defaultDept };
      }
    });
    customLocations.forEach((loc) => {
      map[loc.name] = { rooms: loc.rooms, department: loc.department || defaultDept };
    });
    return map;
  }, [data, customLocations]);

  const allLocationsList = useMemo(() => {
    if (!data) return ["สำนักงานจังหวัดปทุมธานี"];
    const set = new Set<string>();
    data.assets.forEach((a) => {
      if (a.location) set.add(a.location);
    });
    (data.meta?.locations || []).forEach((l: any) => {
      if (l.room) set.add(l.room);
    });
    customLocations.forEach((c) => set.add(c.name));
    if (set.size === 0) set.add("สำนักงานจังหวัดปทุมธานี");
    return Array.from(set).filter((name) => !deletedLocationNames.includes(name));
  }, [data, customLocations, deletedLocationNames]);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/bootstrap", { cache: "no-store" });
      const payload = await response.json();
      if (response.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname || "/")}`);
        return;
      }
      if (response.status === 403 && payload.code === "PASSWORD_CHANGE_REQUIRED") {
        router.replace(`/change-password?returnTo=${encodeURIComponent(pathname || "/")}`);
        return;
      }
      if (!response.ok) throw new Error(payload.error || "โหลดข้อมูลไม่สำเร็จ");
      setData(payload);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setMobileNav(false); }, [pathname]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredAssets = useMemo(() => {
    if (!data) return [];
    let list = data.assets;
    if (selectedLocation !== "all") {
      list = list.filter((a) => isAssetInLocation(a, selectedLocation));
    }
    const keyword = query.trim().toLocaleLowerCase("th");
    if (!keyword) return list;
    return list.filter((item) => [item.assetCode, item.serialNumber, item.name, item.category, item.location, item.assignedTo].some((value) => value?.toLocaleLowerCase("th").includes(keyword)));
  }, [data, query, selectedLocation]);

  async function post(url: string, payload: unknown, success: string) {
    setBusy(true);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "ทำรายการไม่สำเร็จ");
      setToast(success);
      setModal(null);
      await loadData(true);
      return true;
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "ทำรายการไม่สำเร็จ");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); } finally {
      setBusy(false);
      window.location.href = "/login";
    }
  }

  function handleOpenLocation(locName: string) {
    setSelectedLocation(locName);
    setCurrentView("catalog");
  }

  async function handleAddLocation(name: string, rooms: string, department: string) {
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rooms, department }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "เพิ่มสถานที่จัดเก็บไม่สำเร็จ");
      setCustomLocations((prev) => [...prev, { name, rooms, department }]);
      setDeletedLocationNames((prev) => prev.filter((n) => n !== name));
      setToast(`เพิ่มสถานที่จัดเก็บ "${name}" เรียบร้อยแล้ว`);
      await loadData(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  async function handleSaveEditLocation(oldName: string, newName: string, rooms: string, department: string) {
    try {
      const res = await fetch("/api/locations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName, newName, rooms, department }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "แก้ไขข้อมูลสถานที่จัดเก็บไม่สำเร็จ");
      setCustomLocations((prev) => {
        const filtered = prev.filter((x) => x.name !== oldName);
        return [...filtered, { name: newName, rooms, department }];
      });
      if (oldName !== newName) {
        setDeletedLocationNames((prev) => [...prev, oldName]);
      }
      setToast(`อัปเดตข้อมูลสถานที่ "${newName}" เรียบร้อยแล้ว`);
      setEditingLocationName(null);
      await loadData(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  async function handleDeleteLocationConfirm(locName: string) {
    try {
      const res = await fetch("/api/locations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationName: locName }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "ลบสถานที่จัดเก็บไม่สำเร็จ");
      setCustomLocations((prev) => prev.filter((x) => x.name !== locName));
      setDeletedLocationNames((prev) => [...prev, locName]);
      setToast(`ลบสถานที่ "${locName}" ออกจากทะเบียนสถานที่เรียบร้อยแล้ว`);
      setDeletingLocationName(null);
      await loadData(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  if (loading) return <LoadingScreen />;
  if (error || !data) return <div className="fatal"><div className="fatal-card"><div className="brand-symbol">AF</div><h1>ยังเปิดระบบไม่ได้</h1><p>{error || "ไม่พบข้อมูล"}</p><button className="button primary" onClick={() => loadData()}>ลองอีกครั้ง</button></div></div>;

  return (
    <div className="app-frame">
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <div className="brand"><div className="brand-symbol">AF</div><div><strong>AssetFlow</strong><span>ระบบบริหารครุภัณฑ์</span></div></div>
        <nav className="nav-scroll" aria-label="เมนูหลัก">
          <div className="nav-group">
            <p>ทะเบียนสถานที่และพัสดุ</p>
            <button
              className={`nav-item-btn ${(section === "dashboard" || section === "assets") && currentView === "directory" ? "active" : ""}`}
              onClick={() => {
                router.replace("/");
                setCurrentView("directory");
                setSelectedLocation("all");
              }}
            >
              <span className="nav-icon">LOC</span>
              <span>ทะเบียนสถานที่จัดเก็บ</span>
            </button>
          </div>

          <div className="nav-group" style={{ marginTop: "20px" }}>
            <p>สถานที่จัดเก็บหลัก</p>
            {allLocationsList.map((locName) => {
              const active = (section === "dashboard" || section === "assets") && currentView === "catalog" && selectedLocation === locName;
              const count = data.assets.filter((a) => isAssetInLocation(a, locName)).length;
              return (
                <button
                  key={locName}
                  className={`nav-item-btn ${active ? "active" : ""}`}
                  onClick={() => {
                    router.replace("/");
                    setSelectedLocation(locName);
                    setCurrentView("catalog");
                  }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", textAlign: "left" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                    <span className="nav-label-truncate" title={locName}>{locName}</span>
                  </div>
                  <b className="count-badge" style={{ background: "#0f766e", color: "#ffffff", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold" }}>
                    {count || data.assets.length}
                  </b>
                </button>
              );
            })}
          </div>

          {data.actor?.roleCode === "admin" && (
            <div className="nav-group" style={{ marginTop: "24px" }}>
              <p>ระบบการจัดการ (ADMIN)</p>
              <button
                className={`nav-item-btn ${section === "users" ? "active" : ""}`}
                onClick={() => {
                  router.replace("/users");
                }}
              >
                <span className="nav-icon">USR</span>
                <span>ผู้ใช้และสิทธิ์</span>
              </button>
            </div>
          )}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{data.actor?.fullName?.slice(0, 1) || "A"}</div>
          <div><strong>{data.actor?.fullName || "ผู้ใช้งาน"}</strong><span>{data.actor?.roleName || "ไม่ระบุบทบาท"}</span></div>
          <button className="logout-button" onClick={logout} disabled={busy} aria-label="ออกจากระบบ" title="ออกจากระบบ">↪</button>
        </div>
      </aside>

      {mobileNav ? <button className="scrim" aria-label="ปิดเมนู" onClick={() => setMobileNav(false)} /> : null}

      <main className="main-shell">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="เปิดเมนู">☰</button>
          <div className="topbar-title">
            <p className="eyebrow">ระบบบริหารจัดการสถานที่และครุภัณฑ์</p>
            <h1>
              {section === "users"
                ? "ผู้ใช้งานและสิทธิ์การเข้าถึง"
                : currentView === "directory"
                ? "ทะเบียนพิกัดสถานที่จัดเก็บพัสดุ"
                : selectedLocation !== "all"
                ? `แคตตาล็อกรูปภาพ: ${selectedLocation}`
                : "แคตตาล็อกรูปภาพครุภัณฑ์ทั้งหมด"}
            </h1>
          </div>
          <div className="global-search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหารหัส Serial ชื่อ ห้อง หรือผู้รับผิดชอบ" />
          </div>
        </header>

        {toast ? <div className="toast-bar">{toast}</div> : null}

        <div className="content-shell">
          {section === "users" ? (
            <Users data={data} helpers={{ setModal, post, busy, query, setQuery, scanCode, setScanCode, scanResult, setScanResult, router, reloadBootstrap: () => loadData(true) }} />
          ) : currentView === "directory" ? (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">LOCATION DIRECTORY · ทะเบียนพิกัดสถานที่จัดเก็บ</p>
                  <span>รายการสถานที่จัดเก็บครุภัณฑ์อย่างเป็นทางการ</span>
                </div>
                <div className="heading-actions">
                  <button className="button primary" onClick={() => setIsAddLocationOpen(true)}>
                    + เพิ่มสถานที่จัดเก็บใหม่
                  </button>
                </div>
              </div>

              <LocationDirectoryView
                locations={allLocationsList}
                locationDetails={locationDetails}
                assets={data.assets}
                onSelectLocation={(locName) => handleOpenLocation(locName)}
                onEditLocation={(locName) => setEditingLocationName(locName)}
                onDeleteLocation={(locName) => setDeletingLocationName(locName)}
              />
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">ASSET CATALOG · แคตตาล็อกรูปภาพครุภัณฑ์</p>
                  <span>{selectedLocation === "all" ? "แสดงภาพครุภัณฑ์ วัตถุมงคล และพัสดุรวมทุกสถานที่" : `แคตตาล็อกรูปภาพครุภัณฑ์และพัสดุประจำ ${selectedLocation}`}</span>
                </div>
              </div>

              {renderSection(section, data, filteredAssets, data.assets, allLocationsList, selectedId, {
                setModal,
                post,
                busy,
                query,
                setQuery,
                scanCode,
                setScanCode,
                scanResult,
                setScanResult,
                router,
                selectedLocation,
                setSelectedLocation,
                selectedCategory,
                setSelectedCategory,
                selectedYear,
                setSelectedYear,
                onBackToDirectory: () => {
                  setCurrentView("directory");
                  setSelectedLocation("all");
                },
                reloadBootstrap: () => loadData(true),
              })}
            </>
          )}
        </div>
      </main>

      {modal ? <Modal name={modal} data={data} busy={busy} onClose={() => setModal(null)} onPost={post} onUploaded={() => loadData(true)} /> : null}

      {isAddLocationOpen && (
        <AddLocationModal
          onClose={() => setIsAddLocationOpen(false)}
          onAdd={handleAddLocation}
        />
      )}

      {editingLocationName && (
        <EditLocationModal
          locationName={editingLocationName}
          initialRooms={locationDetails[editingLocationName]?.rooms}
          initialDepartment={locationDetails[editingLocationName]?.department}
          onClose={() => setEditingLocationName(null)}
          onSave={handleSaveEditLocation}
        />
      )}

      {deletingLocationName && (
        <DeleteLocationModal
          locationName={deletingLocationName}
          onClose={() => setDeletingLocationName(null)}
          onConfirm={handleDeleteLocationConfirm}
        />
      )}
    </div>
  );
}

{/* Complete User & Permission Management Component */}
function Users({ data, helpers }: { data: BootstrapData; helpers?: RenderHelpers }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [resettingPasswordUser, setResettingPasswordUser] = useState<any | null>(null);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [toast, setToast] = useState("");
  const [userList, setUserList] = useState<any[]>(data.users || []);

  useEffect(() => {
    setUserList(data.users || []);
  }, [data.users]);

  const rolesList = (data.meta?.roles as any[]) || [
    { id: 1, code: "admin", name: "ผู้ดูแลระบบ" },
    { id: 2, code: "asset_officer", name: "เจ้าหน้าที่พัสดุ" },
    { id: 3, code: "approver", name: "ผู้อนุมัติ" },
    { id: 4, code: "staff", name: "เจ้าหน้าที่ทั่วไป" },
    { id: 5, code: "auditor", name: "ผู้ตรวจสอบ" },
  ];

  const departmentsList = (data.meta?.departments as any[]) || [];

  const filteredUsers = useMemo(() => {
    return userList.filter((u) => {
      if (roleFilter !== "all" && u.roleCode !== roleFilter) return false;
      if (departmentFilter !== "all" && u.department !== departmentFilter) return false;
      if (searchQuery.trim()) {
        const kw = searchQuery.trim().toLowerCase();
        const matchName = String(u.fullName || "").toLowerCase().includes(kw);
        const matchCode = String(u.employeeCode || "").toLowerCase().includes(kw);
        const matchUsername = String(u.username || "").toLowerCase().includes(kw);
        const matchEmail = String(u.email || "").toLowerCase().includes(kw);
        if (!matchName && !matchCode && !matchUsername && !matchEmail) return false;
      }
      return true;
    });
  }, [userList, roleFilter, departmentFilter, searchQuery]);

  const stats = useMemo(() => {
    return {
      total: userList.length,
      admins: userList.filter((u) => u.roleCode === "admin").length,
      officers: userList.filter((u) => u.roleCode === "asset_officer").length,
      active: userList.filter((u) => u.status === "active" || !u.status).length,
    };
  }, [userList]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }

  async function handleAddUser(payload: any) {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "เพิ่มผู้ใช้ไม่สำเร็จ");
      showToast(`เพิ่มผู้ใช้งาน "${payload.fullName}" เรียบร้อยแล้ว`);
      setIsAddUserOpen(false);
      if (helpers?.reloadBootstrap) {
        helpers.reloadBootstrap();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  async function handleUpdateUser(id: number, payload: any) {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "แก้ไขข้อมูลไม่สำเร็จ");
      showToast("อัปเดตข้อมูลผู้ใช้งานเรียบร้อยแล้ว");
      setEditingUser(null);
      if (helpers?.reloadBootstrap) {
        helpers.reloadBootstrap();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  async function handleResetPassword(id: number, password: string) {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
      showToast("รีเซ็ตรหัสผ่านใหม่เรียบร้อยแล้ว");
      setResettingPasswordUser(null);
      if (helpers?.reloadBootstrap) {
        helpers.reloadBootstrap();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  async function handleDeleteUser(id: number) {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "ลบผู้ใช้ไม่สำเร็จ");
      setUserList((prev) => prev.filter((u) => u.id !== id));
      showToast("ลบผู้ใช้งานออกจากระบบเรียบร้อยแล้ว");
      setDeletingUser(null);
      if (helpers?.reloadBootstrap) {
        helpers.reloadBootstrap();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {toast && <div className="toast-bar">{toast}</div>}

      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">USER & PERMISSION MANAGEMENT · การดูแลผู้ใช้งานและสิทธิ์การเข้าถึง</p>
          <span>ระบบบริหารจัดการบัญชีผู้ใช้ บทบาทหน้าที่ และสิทธิ์ในระบบ AssetFlow</span>
        </div>
        <div className="heading-actions">
          <button className="button primary" onClick={() => setIsAddUserOpen(true)}>
            + เพิ่มผู้ใช้งานใหม่
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>ผู้ใช้งานทั้งหมด</span>
          <h2 style={{ margin: "4px 0 0 0", color: "#0f172a", fontSize: "24px" }}>{stats.total} คน</h2>
        </div>
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: "12px", color: "#0f766e", fontWeight: 600 }}>ผู้ดูแลระบบ (Admin)</span>
          <h2 style={{ margin: "4px 0 0 0", color: "#0f766e", fontSize: "24px" }}>{stats.admins} คน</h2>
        </div>
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>เจ้าหน้าที่พัสดุ (Officer)</span>
          <h2 style={{ margin: "4px 0 0 0", color: "#2563eb", fontSize: "24px" }}>{stats.officers} คน</h2>
        </div>
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 600 }}>สถานะปกติ (Active)</span>
          <h2 style={{ margin: "4px 0 0 0", color: "#16a34a", fontSize: "24px" }}>{stats.active} คน</h2>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", background: "#ffffff", padding: "14px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", gap: "10px", flex: 1, minWidth: "260px" }}>
          <input
            type="text"
            placeholder="ค้นหาชื่อ รหัสพนักงาน Username หรืออีเมล..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
          />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
          >
            <option value="all">ทุกสิทธิ์ / ทุกบทบาท</option>
            {rolesList.map((r) => (
              <option key={r.code} value={r.code}>{r.name}</option>
            ))}
          </select>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
          >
            <option value="all">ทุกสังกัดหน่วยงาน</option>
            {departmentsList.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main User Data Table */}
      <div className="panel" style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid #e2e8f0", background: "#ffffff" }}>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", fontSize: "12px", color: "#475569" }}>
                <th style={{ padding: "12px 16px", width: "50px", textAlign: "center" }}>ลำดับ</th>
                <th style={{ padding: "12px 16px" }}>ผู้ใช้งาน / รหัสพนักงาน</th>
                <th style={{ padding: "12px 16px" }}>ชื่อผู้ใช้ / อีเมล</th>
                <th style={{ padding: "12px 16px" }}>สังกัดหน่วยงาน</th>
                <th style={{ padding: "12px 16px" }}>บทบาทและสิทธิ์</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>สถานะใช้งาน</th>
                <th style={{ padding: "12px 16px" }}>เข้าใช้งานล่าสุด</th>
                <th style={{ padding: "12px 16px", textAlign: "right", width: "200px" }}>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                    ไม่พบข้อมูลผู้ใช้งานตรงกับเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, idx) => {
                  const roleBadgeColor = {
                    admin: "#0f766e",
                    asset_officer: "#2563eb",
                    approver: "#d97706",
                    staff: "#475569",
                    auditor: "#7c3aed",
                  }[String(user.roleCode || "")] || "#475569";

                  return (
                    <tr key={user.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: "13px" }} className="table-row-hover">
                      <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "bold", color: "#64748b" }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <strong style={{ color: "#0f172a", display: "block" }}>{String(user.fullName || "—")}</strong>
                        <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>{String(user.employeeCode || "ไม่ระบุรหัส")}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontWeight: 600, color: "#334155", display: "block" }}>{String(user.username || "—")}</span>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>{String(user.email || "")}</span>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#334155" }}>
                        {String(user.department || "สำนักงานจังหวัด")}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            background: `${roleBadgeColor}15`,
                            color: roleBadgeColor,
                            fontSize: "11px",
                            fontWeight: "bold",
                            padding: "3px 10px",
                            borderRadius: "12px",
                            border: `1px solid ${roleBadgeColor}40`,
                            display: "inline-block",
                          }}
                        >
                          {String(user.role || user.roleCode || "ผู้ใช้งาน")}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {badge(user.status ? String(user.status) : "active")}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#64748b", fontSize: "12px" }}>
                        {user.lastLoginAt ? thaiDate(String(user.lastLoginAt), true) : "ยังไม่เคยเข้าใช้"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="button ghost"
                            style={{ fontSize: "11px", padding: "4px 8px" }}
                            onClick={() => setEditingUser(user)}
                            title="แก้ไขสิทธิ์/ข้อมูล"
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            className="button ghost"
                            style={{ fontSize: "11px", padding: "4px 8px", color: "#2563eb" }}
                            onClick={() => setResettingPasswordUser(user)}
                            title="เปลี่ยนรหัสผ่าน"
                          >
                            เปลี่ยนรหัส
                          </button>
                          <button
                            type="button"
                            className="button danger"
                            style={{ fontSize: "11px", padding: "4px 8px" }}
                            onClick={() => setDeletingUser(user)}
                            title="ลบผู้ใช้"
                          >
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role & Permissions Reference Matrix */}
      <div className="panel" style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid #e2e8f0", background: "#ffffff", padding: "20px" }}>
        <h3 style={{ margin: "0 0 6px 0", fontSize: "15px", color: "#0f172a" }}>ตารางสรุปสิทธิ์การเข้าถึงระบบตามบทบาท (Role & Permissions Matrix)</h3>
        <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#64748b" }}>อ้างอิงสิทธิ์การเข้าถึงเมนูและฟังก์ชันงานหลักในระบบ AssetFlow</p>
        
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569" }}>
                <th style={{ padding: "10px 12px" }}>เมนู / สิทธิ์การใช้งาน</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>ผู้ดูแลระบบ (Admin)</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>เจ้าหน้าที่พัสดุ (Officer)</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>ผู้อนุมัติ (Approver)</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>เจ้าหน้าที่ทั่วไป (Staff)</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>ผู้ตรวจสอบ (Auditor)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>ดูทะเบียนสถานที่และแคตตาล็อกรูปภาพ</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ เต็มรูปแบบ</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ เต็มรูปแบบ</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ เต็มรูปแบบ</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ อ่านอย่างเดียว</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ อ่านอย่างเดียว</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>เพิ่ม / แก้ไข / ลบ ข้อมูลครุภัณฑ์และสถานที่</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ อนุญาต</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ อนุญาต</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#dc2626" }}>✗ ไม่อนุญาต</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#dc2626" }}>✗ ไม่อนุญาต</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#dc2626" }}>✗ ไม่อนุญาต</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>พิมพ์ใบตรวจนับ &amp; ส่งออก CSV</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ อนุญาต</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ อนุญาต</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ อนุญาต</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ อนุญาต</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ อนุญาต</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>พิจารณาอนุมัติคำขอยืม / โอนย้าย</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ อนุมัติได้</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#dc2626" }}>✗ ไม่อนุญาต</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ อนุมัติได้</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#dc2626" }}>✗ ไม่อนุญาต</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#dc2626" }}>✗ ไม่อนุญาต</td>
              </tr>
              <tr>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>จัดการบัญชีผู้ใช้งานและสิทธิ์ (Admin Menu)</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#16a34a" }}>✓ จัดการได้ 100%</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#dc2626" }}>✗ ซ่อนเมนู</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#dc2626" }}>✗ ซ่อนเมนู</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#dc2626" }}>✗ ซ่อนเมนู</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#dc2626" }}>✗ ซ่อนเมนู</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <UserFormModal
          roles={rolesList}
          departments={departmentsList}
          onClose={() => setIsAddUserOpen(false)}
          onSubmit={handleAddUser}
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <UserFormModal
          user={editingUser}
          roles={rolesList}
          departments={departmentsList}
          onClose={() => setEditingUser(null)}
          onSubmit={(payload) => handleUpdateUser(Number(editingUser.id), payload)}
        />
      )}

      {/* Reset Password Modal */}
      {resettingPasswordUser && (
        <ResetPasswordModal
          user={resettingPasswordUser}
          onClose={() => setResettingPasswordUser(null)}
          onReset={(password) => handleResetPassword(Number(resettingPasswordUser.id), password)}
        />
      )}

      {/* Delete User Modal */}
      {deletingUser && (
        <div className="modal-layer" role="dialog" aria-modal="true">
          <button className="modal-backdrop" onClick={() => setDeletingUser(null)} />
          <div className="modal-card" style={{ maxWidth: "420px" }}>
            <div className="modal-head">
              <div>
                <span>ยืนยันการลบผู้ใช้งาน</span>
                <h2>ต้องการลบบัญชีนี้หรือไม่?</h2>
              </div>
              <button type="button" onClick={() => setDeletingUser(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: "14px", color: "#475569", lineHeight: "1.5" }}>
                คุณกำลังจะลบบัญชี <strong>"{String(deletingUser.fullName)}"</strong> ({String(deletingUser.username)}) ออกจากระบบอย่างถาวร
              </p>
            </div>
            <div className="modal-foot">
              <button type="button" className="button ghost" onClick={() => setDeletingUser(null)}>ยกเลิก</button>
              <button type="button" className="button danger" onClick={() => handleDeleteUser(Number(deletingUser.id))}>
                ยืนยันการลบผู้ใช้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserFormModal({
  user,
  roles,
  departments,
  onClose,
  onSubmit,
}: {
  user?: any;
  roles: any[];
  departments: any[];
  onClose: () => void;
  onSubmit: (payload: any) => void;
}) {
  const isEdit = Boolean(user);
  const [fullName, setFullName] = useState(user?.fullName ? String(user.fullName) : "");
  const [employeeCode, setEmployeeCode] = useState(user?.employeeCode ? String(user.employeeCode) : "");
  const [username, setUsername] = useState(user?.username ? String(user.username) : "");
  const [email, setEmail] = useState(user?.email ? String(user.email) : "");
  const [phone, setPhone] = useState(user?.phone ? String(user.phone) : "");
  const [roleId, setRoleId] = useState(user?.roleId || roles[0]?.id || 1);
  const [departmentName, setDepartmentName] = useState(user?.department || departments[0]?.name || "สำนักงานจังหวัด");
  const [status, setStatus] = useState(user?.status ? String(user.status) : "active");
  const [password, setPassword] = useState("");
  const [showUserPassword, setShowUserPassword] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || (!isEdit && !username.trim())) {
      alert("กรุณากรอกข้อมูลสำคัญให้ครบถ้วน");
      return;
    }
    const matchedDept = departments.find((d) => d.name === departmentName.trim());
    onSubmit({
      fullName: fullName.trim(),
      employeeCode: employeeCode.trim(),
      username: username.trim(),
      email: email.trim(),
      phone: phone.trim(),
      roleId: Number(roleId),
      departmentId: matchedDept ? matchedDept.id : undefined,
      departmentName: departmentName.trim(),
      status,
      ...(password.trim() ? { password: password.trim(), resetPassword: password.trim() } : {}),
    });
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <button className="modal-backdrop" onClick={onClose} />
      <div className="modal-card" style={{ maxWidth: "580px" }}>
        <div className="modal-head">
          <div>
            <span>ระบบบริหารบัญชีผู้ใช้งานและสิทธิ์</span>
            <h2>{isEdit ? `แก้ไขสิทธิ์ / ข้อมูลผู้ใช้: ${user.fullName}` : "เพิ่มผู้ใช้งานใหม่ (สร้าง ID & Password)"}</h2>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ gap: "12px" }}>
            <div className="form-field">
              <span>ชื่อ-นามสกุล <b>*</b></span>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="เช่น นายสมชาย ใจดี" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-field">
                <span>รหัสพนักงาน</span>
                <input type="text" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="เช่น EMP-0099" />
              </div>
              <div className="form-field">
                <span>เบอร์โทรศัพท์</span>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="เช่น 081-234-5678" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-field">
                <span>ชื่อผู้ใช้ (User ID / Username) <b>*</b></span>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required disabled={isEdit} placeholder="เช่น admin_2 หรือ officer.p" />
              </div>
              <div className="form-field">
                <span>อีเมล <b>*</b></span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="เช่น officer@pathumthani.go.th" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-field">
                <span>บทบาทและสิทธิ์การเข้าถึง (Role) <b>*</b></span>
                <select value={roleId} onChange={(e) => setRoleId(Number(e.target.value))} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  {roles.map((r) => {
                    const desc = {
                      admin: "ผู้ดูแลระบบ (Admin) — สิทธิ์เต็มทุกเมนู",
                      asset_officer: "เจ้าหน้าที่พัสดุ (Officer) — จัดการครุภัณฑ์/สถานที่",
                      approver: "ผู้อนุมัติ (Approver) — พิจารณาคำขอ ยืม/โอนย้าย",
                      staff: "เจ้าหน้าที่ทั่วไป (Staff) — ดูข้อมูลและยื่นคำขอ",
                      auditor: "ผู้ตรวจสอบ (Auditor) — ตรวจนับและออกรายงาน",
                    }[String(r.code)] || r.name;
                    return (
                      <option key={r.id} value={r.id}>{desc}</option>
                    );
                  })}
                </select>
              </div>

              <div className="form-field">
                <span>สังกัดหน่วยงาน (เลือกหรือพิมพ์ได้อิสระ) <b>*</b></span>
                <input
                  type="text"
                  list="dept-options-list"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  placeholder="เช่น สำนักงานจังหวัดปทุมธานี"
                  required
                />
                <datalist id="dept-options-list">
                  {departments.map((d) => (
                    <option key={d.id} value={d.name} />
                  ))}
                  <option value="สำนักงานจังหวัดปทุมธานี" />
                  <option value="กลุ่มงานยุทธศาสตร์และข้อมูล" />
                  <option value="ที่ทำการปกครองจังหวัด" />
                  <option value="ฝ่ายเทคโนโลยีสารสนเทศ" />
                  <option value="ฝ่ายการเงินและบัญชี" />
                  <option value="ฝ่ายทรัพยากรบุคคล" />
                </datalist>
              </div>
            </div>

            <div className="form-field">
              <span>{isEdit ? "เปลี่ยนรหัสผ่านใหม่ (Password) — เว้นว่างไว้หากไม่ต้องการเปลี่ยน" : "กำหนดรหัสผ่านเข้าใช้งาน (Password) *"}</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type={showUserPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isEdit ? "กรอกรหัสผ่านใหม่" : "เช่น Pss@1234 หรือปล่อยว่างเพื่อใช้ AssetFlow@2569!"}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="button ghost"
                  style={{ minWidth: "60px", padding: "0 10px", fontSize: "13px" }}
                  onClick={() => setShowUserPassword((prev) => !prev)}
                >
                  {showUserPassword ? "ซ่อน" : "แสดง"}
                </button>
              </div>
            </div>

            <div className="form-field">
              <span>สถานะผู้ใช้งาน</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value="active">ใช้งานอยู่ (Active)</option>
                <option value="suspended">ระงับการใช้งาน (Suspended)</option>
              </select>
            </div>
          </div>

          <div className="modal-foot">
            <button type="button" className="button ghost" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="button primary">{isEdit ? "บันทึกการแก้ไข" : "บันทึกและสร้างผู้ใช้งาน"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({
  user,
  onClose,
  onReset,
}: {
  user: any;
  onClose: () => void;
  onReset: (password: string) => void;
}) {
  const [password, setPassword] = useState("");

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <button className="modal-backdrop" onClick={onClose} />
      <div className="modal-card" style={{ maxWidth: "440px" }}>
        <div className="modal-head">
          <div>
            <span>รีเซ็ตรหัสผ่าน</span>
            <h2>กำหนดรหัสผ่านใหม่: {user.fullName}</h2>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (password.trim()) {
              onReset(password.trim());
            }
          }}
        >
          <div className="modal-body">
            <div className="form-field">
              <span>พิมพ์รหัสผ่านใหม่ <b>*</b></span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ป้อนรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร"
                required
                autoFocus
              />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="button ghost" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="button primary">ยืนยันตั้งรหัสผ่านใหม่</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Modal({ name, data, busy, onClose, onPost, onUploaded }: { name: Exclude<ModalName, null>; data: BootstrapData; busy: boolean; onClose: () => void; onPost: (url: string, payload: unknown, success: string) => Promise<boolean>; onUploaded: () => void }) {
  const modalTitle = { asset: "เพิ่มครุภัณฑ์ใหม่", request: "สร้างคำขอเบิก / ยืม", transfer: "โอนย้ายครุภัณฑ์", maintenance: "แจ้งซ่อมครุภัณฑ์", document: "แนบเอกสารระบบ" }[name];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());

    if (name === "asset") {
      await onPost("/api/assets", values, "เพิ่มครุภัณฑ์ใหม่เรียบร้อยแล้ว");
      return;
    }
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <button className="modal-backdrop" onClick={onClose} />
      <div className="modal-card" style={{ maxWidth: "680px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-head"><div><span>แบบฟอร์มบันทึกข้อมูลครุภัณฑ์</span><h2>{modalTitle}</h2></div><button type="button" onClick={onClose}>×</button></div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div className="modal-body" style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
            {name === "asset" ? <AssetForm data={data} /> : null}
          </div>
          <div className="modal-foot" style={{ borderTop: "1px solid #e2e8f0", padding: "14px 20px", display: "flex", justifyContent: "flex-end", gap: "10px", background: "#ffffff" }}>
            <button type="button" className="button ghost" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="button primary" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกครุภัณฑ์ใหม่"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, name, type = "text", required = false, placeholder, defaultValue, children }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string; children?: React.ReactNode }) {
  return <label className="form-field"><span>{label}{required ? <b>*</b> : null}</span>{children || <input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} />}</label>;
}

function AssetForm({ data }: { data: BootstrapData }) {
  const [imagePreview, setImagePreview] = useState<string>("");

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImagePreview(String(event.target.result));
        }
      };
      reader.readAsDataURL(file);
    }
  }

  return (
    <div className="form-grid" style={{ gap: "14px" }}>
      <Field label="ชื่อครุภัณฑ์ / พัสดุ" name="name" required placeholder="เช่น พระพุทธรูปปูนปั้น, พัดลมตั้งพื้น, โน้ตบุ๊ก" />
      <Field label="รหัสครุภัณฑ์" name="assetCode" required placeholder="เช่น จว-พพ-033/2569" />
      
      {/* Category: Free text manual input with clean placeholder, NO hardcoded prefill */}
      <Field label="หมวดหมู่ครุภัณฑ์ (ระบุได้เอง)" name="categoryName">
        <input name="categoryName" list="category-suggestions" placeholder="พิมพ์ระบุหมวดหมู่ เช่น พระพุทธรูป, ศิลปวัตถุ..." />
        <datalist id="category-suggestions">
          {data.meta.categories.map((c: any, i: number) => <option key={i} value={String(c.name || c.categoryName || "")} />)}
          <option value="พระพุทธรูปและวัตถุมงคล" />
          <option value="เครื่องใช้ไฟฟ้าและภายนอก" />
          <option value="เฟอร์นิเจอร์และตกแต่ง" />
          <option value="อุปกรณ์สำนักงาน" />
        </datalist>
      </Field>

      <Field label="ราคา / มูลค่าจัดซื้อ (บาท)" name="purchasePrice" type="number" placeholder="เช่น 137000" />
      
      {/* Clean inputs for Building & Room without prefilled values */}
      <Field label="สถานที่จัดเก็บหลัก / อาคาร" name="building" placeholder="เช่น จวนผู้ว่าราชการจังหวัด, ศาลากลางจังหวัด" />
      <Field label="ห้อง / จุดจัดเก็บพัสดุ" name="room" placeholder="เช่น หอกลอง/หอบูชา, เรือนรับรองชั้น 1" />

      {/* Image Attachment & Live Preview */}
      <div className="form-field full" style={{ gridColumn: "1 / -1", background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px dashed #cbd5e1" }}>
        <span style={{ fontWeight: "bold", color: "#0f172a", marginBottom: "6px", display: "block" }}>
          อัปโหลด / แนบรูปถ่ายครุภัณฑ์
        </span>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" style={{ width: "90px", height: "90px", objectFit: "cover", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
          ) : (
            <div style={{ width: "90px", height: "90px", borderRadius: "8px", background: "#e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: "11px", textAlign: "center", padding: "4px" }}>
              <span>ไม่มีรูปภาพ</span>
            </div>
          )}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
            <div>
              <span style={{ fontSize: "12px", color: "#475569", display: "block", marginBottom: "2px" }}>เลือกไฟล์รูปภาพจากเครื่อง:</span>
              <input type="file" accept="image/*" onChange={handleFileChange} style={{ fontSize: "13px", width: "100%" }} />
            </div>
            <input type="hidden" name="imageUrl" value={imagePreview} />
            <div>
              <span style={{ fontSize: "12px", color: "#475569", display: "block", marginBottom: "2px" }}>หรือวาง URL รูปภาพถ่าย:</span>
              <input
                type="text"
                placeholder="https://..."
                value={imagePreview.startsWith("data:") ? "" : imagePreview}
                onChange={(e) => setImagePreview(e.target.value)}
                style={{ fontSize: "12px", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "100%" }}
              />
            </div>
          </div>
        </div>
      </div>

      <Field label="Serial Number (ถ้ามี)" name="serialNumber" placeholder="เช่น BUD-SEC-033" />
      <Field label="ปีงบประมาณ" name="budgetYear" placeholder="2569" />

      <label className="form-field full" style={{ gridColumn: "1 / -1" }}>
        <span>คำบรรยาย / รายละเอียดพัสดุเพิ่มเติม</span>
        <textarea name="description" rows={3} placeholder="ระบุลักษณะ สภาพประวัติ รายละเอียดการได้มา หรือหมายเหตุ..." style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
      </label>
    </div>
  );
}
