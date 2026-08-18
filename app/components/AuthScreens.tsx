"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function safeReturnTo() {
  if (typeof window === "undefined") return "/";
  const value = new URLSearchParams(window.location.search).get("returnTo") || "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function LoginScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session?t=" + Date.now(), { cache: "no-store" }).then((response) => {
      if (response.ok) router.replace(safeReturnTo());
    }).catch(() => undefined);
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "เข้าสู่ระบบไม่สำเร็จ");
      router.replace(safeReturnTo());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-story">
      <div className="auth-brand"><span>AF</span><div><strong>AssetFlow</strong><small>ระบบบริหารจัดการครุภัณฑ์</small></div></div>
      <div className="auth-copy"><p>ASSET OPERATIONS · 2569</p><h1>ของทุกชิ้น<br />มีผู้รับผิดชอบ</h1><span>ติดตามทะเบียน การยืมคืน การซ่อม โอนย้าย ตรวจนับ และเอกสารในพื้นที่เดียว พร้อมแยกสิทธิ์ตามหน้าที่</span></div>
      <div className="auth-points"><div><b>01</b><span><strong>ผู้ดูแลระบบ</strong><small>จัดการข้อมูล ขั้นตอน และงานหลังบ้านทั้งหมด</small></span></div><div><b>02</b><span><strong>ผู้ใช้งานทั่วไป</strong><small>เห็นเฉพาะทะเบียน คำขอ งานซ่อม และข้อมูลของตน</small></span></div><div><b>03</b><span><strong>ตรวจสอบย้อนหลัง</strong><small>ทุกการทำรายการผูกกับบัญชีผู้ใช้งาน</small></span></div></div>
    </section>
    <section className="auth-panel">
      <form className="login-card" onSubmit={submit}>
        <div className="login-heading"><span>เข้าสู่ระบบ</span><h2>ยินดีต้อนรับกลับ</h2><p>ใช้ User ID และรหัสผ่านที่ได้รับจากผู้ดูแลระบบ</p></div>
        {error ? <div className="auth-error" role="alert">{error}</div> : null}
        <label className="auth-field"><span>User ID</span><input name="username" autoComplete="username" placeholder="เช่น admin" required autoFocus /></label>
        <label className="auth-field"><span>รหัสผ่าน</span><div><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="กรอกรหัสผ่าน" required /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "ซ่อน" : "แสดง"}</button></div></label>
        <button className="auth-submit" disabled={busy}>{busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}<span>→</span></button>
        <div className="demo-accounts"><p>บัญชีสำหรับทดลอง</p><button type="button" onClick={() => fillCredentials("admin", "AssetFlow@2569!")}><span>ADMIN</span><strong>admin</strong><small>AssetFlow@2569!</small></button><button type="button" onClick={() => fillCredentials("user.demo", "User@2569!")}><span>USER</span><strong>user.demo</strong><small>User@2569!</small></button></div>
      </form>
    </section>
  </main>;
}

function fillCredentials(username: string, password: string) {
  const usernameInput = document.querySelector<HTMLInputElement>('input[name="username"]');
  const passwordInput = document.querySelector<HTMLInputElement>('input[name="password"]');
  if (usernameInput) usernameInput.value = username;
  if (passwordInput) passwordInput.value = password;
  passwordInput?.focus();
}

export function ChangePasswordScreen() {
  const router = useRouter();
  const [actor, setActor] = useState<{ fullName: string; username: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return router.replace("/login");
      const payload = await response.json();
      setActor(payload.actor);
    }).catch(() => router.replace("/login"));
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    if (form.get("newPassword") !== form.get("confirmPassword")) {
      setError("ยืนยันรหัสผ่านใหม่ไม่ตรงกัน");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      router.replace(safeReturnTo());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return <main className="password-page"><form className="password-card" onSubmit={submit}><div className="auth-brand dark"><span>AF</span><div><strong>AssetFlow</strong><small>ตั้งค่าความปลอดภัยบัญชี</small></div></div><p className="eyebrow">FIRST SIGN-IN</p><h1>ตั้งรหัสผ่านใหม่</h1><p>สวัสดี {actor?.fullName || "ผู้ใช้งาน"} เพื่อความปลอดภัย กรุณาเปลี่ยนรหัสเริ่มต้นก่อนใช้งานระบบ</p>{error ? <div className="auth-error" role="alert">{error}</div> : null}<label className="auth-field"><span>รหัสผ่านปัจจุบัน</span><input name="currentPassword" type="password" required autoComplete="current-password" /></label><label className="auth-field"><span>รหัสผ่านใหม่</span><input name="newPassword" type="password" required autoComplete="new-password" /><small>อย่างน้อย 12 ตัว พร้อมพิมพ์เล็ก พิมพ์ใหญ่ ตัวเลข และสัญลักษณ์</small></label><label className="auth-field"><span>ยืนยันรหัสผ่านใหม่</span><input name="confirmPassword" type="password" required autoComplete="new-password" /></label><button className="auth-submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านและเริ่มใช้งาน"}<span>→</span></button></form></main>;
}
