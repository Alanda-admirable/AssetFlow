# 🚀 คู่มือการตั้งค่า Supabase & Cloudinary สำหรับ AssetFlow (ฟรี 100%)

คู่มือนี้จะแนะนำวิธีเชื่อมต่อ **AssetFlow** เข้ากับ **Supabase (ฐานข้อมูล Real-time 24 ชม.)** และ **Cloudinary (ที่เก็บรูปภาพฟรี)** เพื่อให้หลายเครื่องสามารถดูและอัปเดตข้อมูลพร้อมกันได้ตลอดเวลา โดยไม่ต้องเปิดคอมพิวเตอร์เครื่องใดเครื่องหนึ่งทิ้งไว้

---

## 📌 ขั้นตอนที่ 1: ตั้งค่า Supabase (ฐานข้อมูลฟรี 500 MB)

1. **สมัครใช้งาน:** เข้าไปที่ [https://supabase.com](https://supabase.com) แล้วคลิก **"Start your project"** (เข้าสู่ระบบด้วย GitHub หรือ Email ฟรี)
2. **สร้างโปรเจกต์ใหม่:**
   - คลิกปุ่ม **"New project"**
   - ตั้งชื่อโปรเจกต์ เช่น `AssetFlow`
   - ตั้ง **Database Password** (จดรหัสผ่านนี้ไว้)
   - เลือก Region ที่ใกล้ที่สุด (เช่น `Singapore (ap-southeast-1)`)
   - คลิก **"Create new project"** (รอระบบสร้างฐานข้อมูลประมาณ 1-2 นาที)
3. **รันสคริปต์สร้างตารางและข้อมูล:**
   - ไปที่เมนู **"SQL Editor"** (ไอคอน `>_` แถบเมนูด้านซ้าย)
   - เปิดไฟล์ [`supabase_schema.sql`](file:///e:/demo/AssetFlow/supabase_schema.sql) ในโฟลเดอร์โปรเจกต์ คัดลอกโค้ดทั้งหมด
   - นำไปวางในช่อง SQL Editor บนหน้าเว็บ Supabase แล้วคลิกปุ่ม **"RUN"** (สีเขียวด้านล่างขวา)
   - เมื่อขึ้นข้อความ *Success. No rows returned* แสดงว่าตารางและข้อมูลครุภัณฑ์ 93 รายการถูกสร้างเรียบร้อยแล้ว
4. **คัดลอก API Keys:**
   - ไปที่เมนู **Project Settings** (ไอคอนฟันเฟืองด้านล่างซ้าย) > เลือก **API**
   - คัดลอกค่าต่อไปนี้:
     - **Project URL**
     - **Project API Keys (`anon` / `public`)**
     - **Project API Keys (`service_role` / `secret`)**

---

## 📌 ขั้นตอนที่ 2: ตั้งค่า Cloudinary (ที่เก็บรูปภาพฟรี 25 GB)

1. **สมัครใช้งาน:** เข้าไปที่ [https://cloudinary.com](https://cloudinary.com) แล้วคลิก **"Sign Up for Free"**
2. **คัดลอก API Keys:**
   - เมื่อเข้าสู่หน้า Dashboard (Console) จะเห็นกล่อง **Product Environment Credentials**
   - คัดลอกค่า 3 ตัวนี้:
     - **Cloud Name**
     - **API Key**
     - **API Secret**

---

## 📌 ขั้นตอนที่ 3: นำค่าไปใส่ในไฟล์ `.env.local`

เปิดไฟล์ [`.env.local`](file:///e:/demo/AssetFlow/.env.local) ในโฟลเดอร์ `e:\demo\AssetFlow` แล้ววางค่าที่คัดลอกมา ดังนี้:

```env
# 1. Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 2. Cloudinary
CLOUDINARY_CLOUD_NAME=my-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz12345
```

---

## 📌 ขั้นตอนที่ 4: เริ่มรันระบบ

ดับเบิลคลิกไฟล์ [`start.bat`](file:///e:/demo/AssetFlow/start.bat) หรือรันคำสั่ง:

```powershell
cd e:\demo\AssetFlow
npm run dev
```

- **เมื่อตั้งค่าเรียบร้อย:**
  - รูปภาพใหม่ที่อัปโหลดจะถูกส่งขึ้น **Cloudinary** อัตโนมัติ และได้ URL CDN คุณภาพสูง โหลดเร็วทั่วโลก
  - ฐานข้อมูลจะซิงค์และบันทึกอยู่บน Cloud 24 ชม.
  - หากไม่ได้ใส่ Key ระบบจะสลับกลับมาใช้ Local SQLite และ Local Folder ให้อัตโนมัติโดยไม่มีข้อผิดพลาด (Zero Error Fallback)
