export const navigationGroups = [
  {
    label: "ทะเบียนสถานที่และพัสดุ",
    items: [
      { key: "assets", label: "ทะเบียนสถานที่จัดเก็บ", short: "LOC" },
    ],
  },
] as const;

export const validSections: string[] = [
  "dashboard",
  "assets",
  "users",
  "notifications",
];

export const roleSections: Record<string, readonly string[]> = {
  admin: ["dashboard", "assets", "users", "notifications"],
  asset_officer: ["dashboard", "assets", "notifications"],
  approver: ["dashboard", "assets", "notifications"],
  staff: ["dashboard", "assets", "notifications"],
  auditor: ["dashboard", "assets", "notifications"],
};

export function canAccessSection(roleCode: string | null | undefined, section: string) {
  if (section === "users") return roleCode === "admin";
  return validSections.includes(section);
}

export function navigationForRole(roleCode: string | null | undefined) {
  return navigationGroups;
}

export const sectionTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: "ทะเบียนพิกัดสถานที่จัดเก็บพัสดุ", subtitle: "ทะเบียนสถานที่และแคตตาล็อกรูปภาพครุภัณฑ์" },
  assets: { title: "ทะเบียนพิกัดสถานที่จัดเก็บพัสดุ", subtitle: "ทะเบียนสถานที่และแคตตาล็อกรูปภาพครุภัณฑ์" },
  users: { title: "ผู้ใช้และสิทธิ์", subtitle: "กำหนดบทบาท สังกัดหน่วยงาน และขอบเขตการเข้าถึง" },
  notifications: { title: "ศูนย์แจ้งเตือน", subtitle: "แจ้งเตือนระบบและการเปลี่ยนแปลงข้อมูล" },
};
