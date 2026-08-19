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
    <section className="auth-story" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", padding: "64px 56px" }}>
      <div className="auth-brand" style={{ marginBottom: "16px" }}>
        <span style={{ width: "52px", height: "52px", fontSize: "20px" }}>AF</span>
        <div>
          <strong style={{ fontSize: "32px", letterSpacing: "-0.5px" }}>AssetFlow</strong>
          <small style={{ fontSize: "16px", color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>ระบบบริหารจัดการครุภัณฑ์</small>
        </div>
      </div>
      <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "15px", lineHeight: "1.6", maxWidth: "360px", margin: "0" }}>
        ระบบบันทึกทะเบียนพัสดุ สถานที่จัดเก็บ ตรวจนับครุภัณฑ์ และจัดการสิทธิ์ผู้ใช้งาน
      </p>
    </section>
    <section className="auth-panel">
      <form className="login-card" onSubmit={submit}>
        <div className="login-heading"><span>เข้าสู่ระบบ</span><h2>ยินดีต้อนรับกลับ</h2><p>ใช้ User ID และรหัสผ่านที่ได้รับจากผู้ดูแลระบบ</p></div>
        {error ? <div className="auth-error" role="alert">{error}</div> : null}
        <label className="auth-field"><span>User ID</span><input name="username" autoComplete="username" placeholder="เช่น admin" required autoFocus /></label>
        <label className="auth-field"><span>รหัสผ่าน</span><div><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="กรอกรหัสผ่าน" required /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "ซ่อน" : "แสดง"}</button></div></label>
        <button className="auth-submit" disabled={busy}>{busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}<span>→</span></button>
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
