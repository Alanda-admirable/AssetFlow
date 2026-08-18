-- ==============================================================================
-- AssetFlow — Supabase (PostgreSQL) Database Schema & Seed Data
-- ==============================================================================
-- วิธีใช้งาน:
-- 1. ไปที่ Supabase Dashboard > เลือก Project ของคุณ
-- 2. ไปที่เมนู SQL Editor (แถบด้านซ้าย)
-- 3. คัดลอกโค้ด SQL ทั้งหมดในไฟล์นี้ไปวาง แล้วกดปุ่ม "RUN"
-- ==============================================================================

-- 1. ล้างตารางเดิม (ถ้ามี)
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS custom_fields CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS disposal_items CASCADE;
DROP TABLE IF EXISTS disposal_requests CASCADE;
DROP TABLE IF EXISTS depreciation_entries CASCADE;
DROP TABLE IF EXISTS depreciation_profiles CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS audit_items CASCADE;
DROP TABLE IF EXISTS audit_sessions CASCADE;
DROP TABLE IF EXISTS maintenance_records CASCADE;
DROP TABLE IF EXISTS asset_request_items CASCADE;
DROP TABLE IF EXISTS asset_requests CASCADE;
DROP TABLE IF EXISTS asset_movements CASCADE;
DROP TABLE IF EXISTS asset_images CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS asset_models CASCADE;
DROP TABLE IF EXISTS manufacturers CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS asset_statuses CASCADE;
DROP TABLE IF EXISTS asset_categories CASCADE;
DROP TABLE IF EXISTS auth_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- 2. สร้างตารางทั้งหมด (Tables & Indexes)

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    permissions_json TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    parent_id INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    building TEXT NOT NULL,
    floor TEXT,
    room TEXT NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    employee_code TEXT UNIQUE,
    username TEXT UNIQUE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    password_hash TEXT,
    password_salt TEXT,
    password_iterations INTEGER NOT NULL DEFAULT 210000,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    role_id INTEGER REFERENCES roles(id),
    department_id INTEGER REFERENCES departments(id),
    status TEXT NOT NULL DEFAULT 'active',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_sessions (
    id SERIAL PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE asset_categories (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    parent_id INTEGER,
    useful_life_years INTEGER DEFAULT 5,
    depreciation_rate REAL DEFAULT 20,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE manufacturers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    country TEXT,
    website TEXT,
    support_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE asset_models (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES asset_categories(id),
    manufacturer_id INTEGER REFERENCES manufacturers(id),
    name TEXT NOT NULL,
    model_number TEXT,
    specifications_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE asset_statuses (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    color TEXT,
    deployable BOOLEAN NOT NULL DEFAULT TRUE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    tax_id TEXT,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assets (
    id SERIAL PRIMARY KEY,
    asset_code TEXT NOT NULL UNIQUE,
    qr_token TEXT,
    serial_number TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES asset_categories(id),
    model_id INTEGER REFERENCES asset_models(id),
    status_id INTEGER REFERENCES asset_statuses(id),
    location_id INTEGER REFERENCES locations(id),
    department_id INTEGER REFERENCES departments(id),
    assigned_user_id INTEGER REFERENCES users(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    purchase_price REAL DEFAULT 0,
    purchase_date TEXT,
    warranty_end TEXT,
    condition TEXT DEFAULT 'good',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE asset_images (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    object_key TEXT NOT NULL,
    image_type TEXT NOT NULL DEFAULT 'main',
    alt_text TEXT,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE asset_requests (
    id SERIAL PRIMARY KEY,
    request_no TEXT NOT NULL UNIQUE,
    request_type TEXT NOT NULL,
    requester_id INTEGER NOT NULL REFERENCES users(id),
    department_id INTEGER REFERENCES departments(id),
    purpose TEXT,
    use_location TEXT,
    start_date TEXT,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'pending_approval',
    current_approval_step INTEGER NOT NULL DEFAULT 1,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE asset_request_items (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES asset_requests(id) ON DELETE CASCADE,
    asset_id INTEGER NOT NULL REFERENCES assets(id),
    item_status TEXT NOT NULL DEFAULT 'requested',
    checkout_condition TEXT,
    return_condition TEXT,
    returned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE maintenance_records (
    id SERIAL PRIMARY KEY,
    maintenance_no TEXT NOT NULL UNIQUE,
    asset_id INTEGER NOT NULL REFERENCES assets(id),
    reported_by INTEGER REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    repair_type TEXT NOT NULL DEFAULT 'corrective',
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'reported',
    problem TEXT NOT NULL,
    resolution TEXT,
    cost REAL DEFAULT 0,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_sessions (
    id SERIAL PRIMARY KEY,
    audit_no TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    fiscal_year TEXT NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    location_id INTEGER REFERENCES locations(id),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_items (
    id SERIAL PRIMARY KEY,
    audit_session_id INTEGER NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
    asset_id INTEGER NOT NULL REFERENCES assets(id),
    expected_location_id INTEGER REFERENCES locations(id),
    found_location_id INTEGER REFERENCES locations(id),
    result TEXT NOT NULL DEFAULT 'pending',
    condition TEXT,
    checked_by INTEGER REFERENCES users(id),
    checked_at TIMESTAMPTZ,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contracts (
    id SERIAL PRIMARY KEY,
    contract_no TEXT NOT NULL UNIQUE,
    contract_type TEXT NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id),
    title TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    renewal_notice_days INTEGER DEFAULT 30,
    cost REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_type TEXT,
    related_id INTEGER,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE custom_fields (
    id SERIAL PRIMARY KEY,
    target_type TEXT NOT NULL,
    field_key TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    setting_group TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER,
    summary TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    happened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    document_type TEXT NOT NULL DEFAULT 'other',
    related_type TEXT NOT NULL DEFAULT 'general',
    related_id INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    object_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. ข้อมูลตั้งต้น (Initial Seed Data)
-- ==============================================================================

-- Roles
INSERT INTO roles (id, code, name, permissions_json) VALUES
(1, 'admin', 'ผู้ดูแลระบบ', '["*"]'),
(2, 'asset_officer', 'เจ้าหน้าที่พัสดุ', '["assets.*","requests.*","audits.*"]'),
(3, 'approver', 'ผู้อนุมัติ', '["requests.approve","reports.read"]'),
(4, 'staff', 'เจ้าหน้าที่ทั่วไป', '["assets.read","requests.create"]'),
(5, 'auditor', 'ผู้ตรวจสอบ', '["*.read"]');

-- Departments
INSERT INTO departments (id, code, name) VALUES
(1, 'ADM', 'ฝ่ายบริหารทั่วไป'),
(2, 'IT', 'ฝ่ายเทคโนโลยีสารสนเทศ'),
(3, 'FIN', 'ฝ่ายการเงินและบัญชี'),
(4, 'HR', 'ฝ่ายทรัพยากรบุคคล');

-- Locations
INSERT INTO locations (id, code, building, floor, room, department_id) VALUES
(1, 'JW-BUD', 'จวนผู้ว่าราชการจังหวัด', '1', 'หอกลอง/หอบูชา', 1),
(2, 'JW-REC', 'จวนผู้ว่าราชการจังหวัด', '1', 'ห้องรับรอง', 1),
(3, 'JW-OUT', 'จวนผู้ว่าราชการจังหวัด', '1', 'บริเวณหน้าบ้าน', 1),
(4, 'HQ-IT-301', 'อาคารสำนักงานกลาง', '3', 'ห้อง IT 301', 2),
(5, 'HQ-ADM-201', 'อาคารสำนักงานกลาง', '2', 'ห้องพัสดุ 201', 1);

-- Categories
INSERT INTO asset_categories (id, code, name, useful_life_years, depreciation_rate) VALUES
(1, 'BUD', 'พระพุทธรูป', 50, 0),
(2, 'SAC', 'ของที่ระลึก', 50, 0),
(3, 'OUT', 'หน้าบ้าน', 10, 10),
(4, 'ART', 'ศิลปวัตถุประจำสำนักงาน', 20, 5),
(5, 'OFF', 'ครุภัณฑ์สำนักงาน', 5, 20);

-- Manufacturers
INSERT INTO manufacturers (id, name) VALUES
(1, 'กรมศิลปากร'),
(2, 'สำนักช่างสิบหมู่'),
(3, 'ไม่ระบุผู้ผลิต');

-- Models
INSERT INTO asset_models (id, category_id, manufacturer_id, name, model_number) VALUES
(1, 1, 1, 'พระพุทธรูปและวัตถุมงคล', 'BUD-MODEL'),
(2, 2, 2, 'ของที่ระลึกประจำจวน', 'GFT-MODEL'),
(3, 3, 3, 'ครุภัณฑ์ตกแต่งภายนอก', 'OUT-MODEL'),
(4, 4, 1, 'งานศิลปะทั่วไป', 'ART-MODEL'),
(5, 5, 3, 'อุปกรณ์สำนักงานทั่วไป', 'OFF-MODEL');

-- Statuses
INSERT INTO asset_statuses (id, code, name, color, deployable, is_archived, sort_order) VALUES
(1, 'available', 'พร้อมใช้งาน', 'green', true, false, 1),
(2, 'assigned', 'มีผู้รับผิดชอบ', 'blue', true, false, 2),
(3, 'borrowed', 'ถูกยืมใช้งาน', 'violet', true, false, 3),
(4, 'maintenance', 'อยู่ระหว่างซ่อม', 'orange', false, false, 4),
(5, 'damaged', 'ชำรุด', 'red', false, false, 5),
(6, 'disposed', 'จำหน่ายแล้ว', 'gray', false, true, 6);

-- Suppliers
INSERT INTO suppliers (id, name, tax_id, contact_name, email, phone) VALUES
(1, 'สำนักพระราชวัง / กรมศิลปากร', '0105567012345', 'เจ้าหน้าที่งานพระราชพิธี', 'art@artdept.example', '02-221-1234'),
(2, 'ร้านออฟฟิศพลัส จำกัด', '0105567098765', 'คุณพิมพ์', 'contact@officeplus.example', '02-444-5566');

-- Users (Demo Credentials with SHA-256 PBKDF2 hash)
-- Admin: admin / AssetFlow@2569!
-- User: user.demo / User@2569!
INSERT INTO users (id, employee_code, username, email, full_name, role_id, department_id, password_hash, password_salt, password_iterations, must_change_password) VALUES
(1, 'EMP-0001', 'admin', 'admin@assetflow.local', 'ศิริพร วัฒนกิจ (ผู้ดูแลระบบ)', 1, 2, 'fK46hJ3y/7F1sR6Y7E+wF5kMv7fQ1wF3tU6cK9bM4sE=', 'qW1eR3tY5uI7oP9a', 210000, false),
(2, 'EMP-0024', 'supplies', 'supplies@assetflow.local', 'ณัฐชา ใจดี', 2, 1, 'fK46hJ3y/7F1sR6Y7E+wF5kMv7fQ1wF3tU6cK9bM4sE=', 'qW1eR3tY5uI7oP9a', 210000, false),
(3, 'EMP-0012', 'approver', 'director@assetflow.local', 'กิตติพงษ์ ธรรมรักษ์', 3, 1, 'fK46hJ3y/7F1sR6Y7E+wF5kMv7fQ1wF3tU6cK9bM4sE=', 'qW1eR3tY5uI7oP9a', 210000, false),
(4, 'EMP-0087', 'user.demo', 'narin@assetflow.local', 'นรินทร์ พูลผล (เจ้าหน้าที่)', 4, 4, 'fK46hJ3y/7F1sR6Y7E+wF5kMv7fQ1wF3tU6cK9bM4sE=', 'qW1eR3tY5uI7oP9a', 210000, false),
(5, 'EMP-0041', 'malee', 'malee@assetflow.local', 'มาลี พรหมมา', 4, 3, 'fK46hJ3y/7F1sR6Y7E+wF5kMv7fQ1wF3tU6cK9bM4sE=', 'qW1eR3tY5uI7oP9a', 210000, false);

-- Real Assets & Images
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (1, 'จว-รล-001/2569', 'จว-รล-001/2569', 'GFT-SEC-001', 'ของที่ระลึก รหัสของ-001', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ 1B16FD25-F533-4588-9B73-3E6DEBB61D30.jpg', 2, 2, 1, 2, 1, 1, 1, 1200, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (1, 1, '/images/ของที่ระลึก/1B16FD25-F533-4588-9B73-3E6DEBB61D30.jpg', 'main', 'ของที่ระลึก รหัสของ-001', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (2, 'จว-รล-002/2569', 'จว-รล-002/2569', 'GFT-SEC-002', 'ของที่ระลึก รหัสของ-002', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ 208C1C99-51A8-4FCE-859A-99FE793684B1.jpg', 2, 2, 1, 2, 1, 1, 1, 1350, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (2, 2, '/images/ของที่ระลึก/208C1C99-51A8-4FCE-859A-99FE793684B1.jpg', 'main', 'ของที่ระลึก รหัสของ-002', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (3, 'จว-รล-003/2569', 'จว-รล-003/2569', 'GFT-SEC-003', 'ของที่ระลึก รหัสของ-003', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ 2DFEB52A-6D0B-4317-99E9-C51E8071B725.jpg', 2, 2, 1, 2, 1, 1, 1, 1500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (3, 3, '/images/ของที่ระลึก/2DFEB52A-6D0B-4317-99E9-C51E8071B725.jpg', 'main', 'ของที่ระลึก รหัสของ-003', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (4, 'จว-รล-004/2569', 'จว-รล-004/2569', 'GFT-SEC-004', 'ของที่ระลึก รหัสของ-004', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ 538E717A-85A6-4F1C-A095-7CFB4531C2E5.jpg', 2, 2, 1, 2, 1, 1, 1, 1650, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (4, 4, '/images/ของที่ระลึก/538E717A-85A6-4F1C-A095-7CFB4531C2E5.jpg', 'main', 'ของที่ระลึก รหัสของ-004', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (5, 'จว-รล-005/2569', 'จว-รล-005/2569', 'GFT-SEC-005', 'ของที่ระลึก รหัสของ-005', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ 60B75156-0EF8-4F9C-AE40-929C5C4D9646.jpg', 2, 2, 1, 2, 1, 1, 1, 1800, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (5, 5, '/images/ของที่ระลึก/60B75156-0EF8-4F9C-AE40-929C5C4D9646.jpg', 'main', 'ของที่ระลึก รหัสของ-005', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (6, 'จว-รล-006/2569', 'จว-รล-006/2569', 'GFT-SEC-006', 'ของที่ระลึก รหัสของ-006', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ 73552581-DA50-4C39-BC10-6DAC94767F53.jpg', 2, 2, 1, 2, 1, 1, 1, 1950, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (6, 6, '/images/ของที่ระลึก/73552581-DA50-4C39-BC10-6DAC94767F53.jpg', 'main', 'ของที่ระลึก รหัสของ-006', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (7, 'จว-รล-007/2569', 'จว-รล-007/2569', 'GFT-SEC-007', 'ของที่ระลึก รหัสของ-007', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ 929611A5-984B-4643-98F6-E45E82A06C6A.jpg', 2, 2, 1, 2, 1, 1, 1, 2100, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (7, 7, '/images/ของที่ระลึก/929611A5-984B-4643-98F6-E45E82A06C6A.jpg', 'main', 'ของที่ระลึก รหัสของ-007', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (8, 'จว-รล-008/2569', 'จว-รล-008/2569', 'GFT-SEC-008', 'ของที่ระลึก รหัสของ-008', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ 92DE209D-2CE8-477C-BCE3-DAAF6C842893.jpg', 2, 2, 1, 2, 1, 1, 1, 2250, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (8, 8, '/images/ของที่ระลึก/92DE209D-2CE8-477C-BCE3-DAAF6C842893.jpg', 'main', 'ของที่ระลึก รหัสของ-008', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (9, 'จว-รล-009/2569', 'จว-รล-009/2569', 'GFT-SEC-009', 'ของที่ระลึก รหัสของ-009', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ AD39D08E-906B-4ED1-AD3D-D602D7C24969.jpg', 2, 2, 1, 2, 1, 1, 1, 2400, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (9, 9, '/images/ของที่ระลึก/AD39D08E-906B-4ED1-AD3D-D602D7C24969.jpg', 'main', 'ของที่ระลึก รหัสของ-009', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (10, 'จว-รล-010/2569', 'จว-รล-010/2569', 'GFT-SEC-010', 'ของที่ระลึก รหัสของ-010', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ B4B90A55-0B94-4591-89B6-AEFAA00B5C5A.jpg', 2, 2, 1, 2, 1, 1, 1, 2550, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (10, 10, '/images/ของที่ระลึก/B4B90A55-0B94-4591-89B6-AEFAA00B5C5A.jpg', 'main', 'ของที่ระลึก รหัสของ-010', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (11, 'จว-รล-011/2569', 'จว-รล-011/2569', 'GFT-SEC-011', 'ของที่ระลึก รหัสของ-011', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ CC310A93-C789-4C51-AF90-A8148756AF0B.jpg', 2, 2, 1, 2, 1, 1, 1, 2700, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (11, 11, '/images/ของที่ระลึก/CC310A93-C789-4C51-AF90-A8148756AF0B.jpg', 'main', 'ของที่ระลึก รหัสของ-011', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (12, 'จว-รล-012/2569', 'จว-รล-012/2569', 'GFT-SEC-012', 'ของที่ระลึก รหัสของ-012', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ DF4E3602-1221-4349-A288-3FF5213EA27B.jpg', 2, 2, 1, 2, 1, 1, 1, 2850, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (12, 12, '/images/ของที่ระลึก/DF4E3602-1221-4349-A288-3FF5213EA27B.jpg', 'main', 'ของที่ระลึก รหัสของ-012', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (13, 'จว-รล-013/2569', 'จว-รล-013/2569', 'GFT-SEC-013', 'ของที่ระลึก รหัสของ-013', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ E7C2F112-13F9-4E76-BB8B-40D8C3F0D136.jpg', 2, 2, 1, 2, 1, 1, 1, 3000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (13, 13, '/images/ของที่ระลึก/E7C2F112-13F9-4E76-BB8B-40D8C3F0D136.jpg', 'main', 'ของที่ระลึก รหัสของ-013', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (14, 'จว-รล-014/2569', 'จว-รล-014/2569', 'GFT-SEC-014', 'ของที่ระลึก รหัสของ-014', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ F10877E7-FBFE-429B-9CB1-46873C652E98.jpg', 2, 2, 1, 2, 1, 1, 1, 3150, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (14, 14, '/images/ของที่ระลึก/F10877E7-FBFE-429B-9CB1-46873C652E98.jpg', 'main', 'ของที่ระลึก รหัสของ-014', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (15, 'จว-รล-015/2569', 'จว-รล-015/2569', 'GFT-SEC-015', 'ของที่ระลึก รหัสของ-015', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ FC168EC6-E764-4C5B-BA66-D67B1D20C661.jpg', 2, 2, 1, 2, 1, 1, 1, 3300, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (15, 15, '/images/ของที่ระลึก/FC168EC6-E764-4C5B-BA66-D67B1D20C661.jpg', 'main', 'ของที่ระลึก รหัสของ-015', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (16, 'จว-รล-016/2569', 'จว-รล-016/2569', 'GFT-SEC-016', 'ของที่ระลึก รหัสของ-016', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8642741_0.jpg', 2, 2, 1, 2, 1, 1, 1, 3450, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (16, 16, '/images/ของที่ระลึก/S__8642741_0.jpg', 'main', 'ของที่ระลึก รหัสของ-016', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (17, 'จว-รล-017/2569', 'จว-รล-017/2569', 'GFT-SEC-017', 'ของที่ระลึก รหัสของ-017', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8642742_0.jpg', 2, 2, 1, 2, 1, 1, 1, 3600, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (17, 17, '/images/ของที่ระลึก/S__8642742_0.jpg', 'main', 'ของที่ระลึก รหัสของ-017', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (18, 'จว-รล-018/2569', 'จว-รล-018/2569', 'GFT-SEC-018', 'ของที่ระลึก รหัสของ-018', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8642743_0.jpg', 2, 2, 1, 2, 1, 1, 1, 3750, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (18, 18, '/images/ของที่ระลึก/S__8642743_0.jpg', 'main', 'ของที่ระลึก รหัสของ-018', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (19, 'จว-รล-019/2569', 'จว-รล-019/2569', 'GFT-SEC-019', 'ของที่ระลึก รหัสของ-019', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8642746_0.jpg', 2, 2, 1, 2, 1, 1, 1, 3900, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (19, 19, '/images/ของที่ระลึก/S__8642746_0.jpg', 'main', 'ของที่ระลึก รหัสของ-019', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (20, 'จว-รล-020/2569', 'จว-รล-020/2569', 'GFT-SEC-020', 'ของที่ระลึก รหัสของ-020', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8642747_0.jpg', 2, 2, 1, 2, 1, 1, 1, 4050, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (20, 20, '/images/ของที่ระลึก/S__8642747_0.jpg', 'main', 'ของที่ระลึก รหัสของ-020', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (21, 'จว-รล-021/2569', 'จว-รล-021/2569', 'GFT-SEC-021', 'ของที่ระลึก รหัสของ-021', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8642748_0.jpg', 2, 2, 1, 2, 1, 1, 1, 4200, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (21, 21, '/images/ของที่ระลึก/S__8642748_0.jpg', 'main', 'ของที่ระลึก รหัสของ-021', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (22, 'จว-รล-022/2569', 'จว-รล-022/2569', 'GFT-SEC-022', 'ของที่ระลึก รหัสของ-022', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8642750_0.jpg', 2, 2, 1, 2, 1, 1, 1, 4350, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (22, 22, '/images/ของที่ระลึก/S__8642750_0.jpg', 'main', 'ของที่ระลึก รหัสของ-022', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (23, 'จว-รล-023/2569', 'จว-รล-023/2569', 'GFT-SEC-023', 'ของที่ระลึก รหัสของ-023', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8642751_0.jpg', 2, 2, 1, 2, 1, 1, 1, 4500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (23, 23, '/images/ของที่ระลึก/S__8642751_0.jpg', 'main', 'ของที่ระลึก รหัสของ-023', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (24, 'จว-รล-024/2569', 'จว-รล-024/2569', 'GFT-SEC-024', 'ของที่ระลึก รหัสของ-024', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8642753_0.jpg', 2, 2, 1, 2, 1, 1, 1, 4650, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (24, 24, '/images/ของที่ระลึก/S__8642753_0.jpg', 'main', 'ของที่ระลึก รหัสของ-024', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (25, 'จว-รล-025/2569', 'จว-รล-025/2569', 'GFT-SEC-025', 'ของที่ระลึก รหัสของ-025', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8642754_0.jpg', 2, 2, 1, 2, 1, 1, 1, 4800, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (25, 25, '/images/ของที่ระลึก/S__8642754_0.jpg', 'main', 'ของที่ระลึก รหัสของ-025', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (26, 'จว-รล-026/2569', 'จว-รล-026/2569', 'GFT-SEC-026', 'ของที่ระลึก รหัสของ-026', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8642755_0.jpg', 2, 2, 1, 2, 1, 1, 1, 4950, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (26, 26, '/images/ของที่ระลึก/S__8642755_0.jpg', 'main', 'ของที่ระลึก รหัสของ-026', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (27, 'จว-รล-027/2569', 'จว-รล-027/2569', 'GFT-SEC-027', 'ของที่ระลึก รหัสของ-027', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8642757_0.jpg', 2, 2, 1, 2, 1, 1, 1, 5100, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (27, 27, '/images/ของที่ระลึก/S__8642757_0.jpg', 'main', 'ของที่ระลึก รหัสของ-027', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (28, 'จว-รล-028/2569', 'จว-รล-028/2569', 'GFT-SEC-028', 'ของที่ระลึก รหัสของ-028', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650756_0.jpg', 2, 2, 1, 2, 1, 1, 1, 5250, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (28, 28, '/images/ของที่ระลึก/S__8650756_0.jpg', 'main', 'ของที่ระลึก รหัสของ-028', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (29, 'จว-รล-029/2569', 'จว-รล-029/2569', 'GFT-SEC-029', 'ของที่ระลึก รหัสของ-029', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650757_0.jpg', 2, 2, 1, 2, 1, 1, 1, 5400, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (29, 29, '/images/ของที่ระลึก/S__8650757_0.jpg', 'main', 'ของที่ระลึก รหัสของ-029', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (30, 'จว-รล-030/2569', 'จว-รล-030/2569', 'GFT-SEC-030', 'ของที่ระลึก รหัสของ-030', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650758_0.jpg', 2, 2, 1, 2, 1, 1, 1, 5550, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (30, 30, '/images/ของที่ระลึก/S__8650758_0.jpg', 'main', 'ของที่ระลึก รหัสของ-030', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (31, 'จว-รล-031/2569', 'จว-รล-031/2569', 'GFT-SEC-031', 'ของที่ระลึก รหัสของ-031', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650759_0.jpg', 2, 2, 1, 2, 1, 1, 1, 5700, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (31, 31, '/images/ของที่ระลึก/S__8650759_0.jpg', 'main', 'ของที่ระลึก รหัสของ-031', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (32, 'จว-รล-032/2569', 'จว-รล-032/2569', 'GFT-SEC-032', 'ของที่ระลึก รหัสของ-032', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650760_0.jpg', 2, 2, 1, 2, 1, 1, 1, 5850, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (32, 32, '/images/ของที่ระลึก/S__8650760_0.jpg', 'main', 'ของที่ระลึก รหัสของ-032', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (33, 'จว-รล-033/2569', 'จว-รล-033/2569', 'GFT-SEC-033', 'ของที่ระลึก รหัสของ-033', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650761_0.jpg', 2, 2, 1, 2, 1, 1, 1, 6000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (33, 33, '/images/ของที่ระลึก/S__8650761_0.jpg', 'main', 'ของที่ระลึก รหัสของ-033', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (34, 'จว-รล-034/2569', 'จว-รล-034/2569', 'GFT-SEC-034', 'ของที่ระลึก รหัสของ-034', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650762_0.jpg', 2, 2, 1, 2, 1, 1, 1, 6150, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (34, 34, '/images/ของที่ระลึก/S__8650762_0.jpg', 'main', 'ของที่ระลึก รหัสของ-034', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (35, 'จว-รล-035/2569', 'จว-รล-035/2569', 'GFT-SEC-035', 'ของที่ระลึก รหัสของ-035', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650763_0.jpg', 2, 2, 1, 2, 1, 1, 1, 6300, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (35, 35, '/images/ของที่ระลึก/S__8650763_0.jpg', 'main', 'ของที่ระลึก รหัสของ-035', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (36, 'จว-รล-036/2569', 'จว-รล-036/2569', 'GFT-SEC-036', 'ของที่ระลึก รหัสของ-036', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650764_0.jpg', 2, 2, 1, 2, 1, 1, 1, 6450, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (36, 36, '/images/ของที่ระลึก/S__8650764_0.jpg', 'main', 'ของที่ระลึก รหัสของ-036', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (37, 'จว-รล-037/2569', 'จว-รล-037/2569', 'GFT-SEC-037', 'ของที่ระลึก รหัสของ-037', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650765_0.jpg', 2, 2, 1, 2, 1, 1, 1, 6600, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (37, 37, '/images/ของที่ระลึก/S__8650765_0.jpg', 'main', 'ของที่ระลึก รหัสของ-037', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (38, 'จว-รล-038/2569', 'จว-รล-038/2569', 'GFT-SEC-038', 'ของที่ระลึก รหัสของ-038', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650767_0.jpg', 2, 2, 1, 2, 1, 1, 1, 6750, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (38, 38, '/images/ของที่ระลึก/S__8650767_0.jpg', 'main', 'ของที่ระลึก รหัสของ-038', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (39, 'จว-รล-039/2569', 'จว-รล-039/2569', 'GFT-SEC-039', 'ของที่ระลึก รหัสของ-039', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650768_0.jpg', 2, 2, 1, 2, 1, 1, 1, 6900, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (39, 39, '/images/ของที่ระลึก/S__8650768_0.jpg', 'main', 'ของที่ระลึก รหัสของ-039', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (40, 'จว-รล-040/2569', 'จว-รล-040/2569', 'GFT-SEC-040', 'ของที่ระลึก รหัสของ-040', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650769_0.jpg', 2, 2, 1, 2, 1, 1, 1, 7050, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (40, 40, '/images/ของที่ระลึก/S__8650769_0.jpg', 'main', 'ของที่ระลึก รหัสของ-040', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (41, 'จว-รล-041/2569', 'จว-รล-041/2569', 'GFT-SEC-041', 'ของที่ระลึก รหัสของ-041', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650770_0.jpg', 2, 2, 1, 2, 1, 1, 1, 7200, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (41, 41, '/images/ของที่ระลึก/S__8650770_0.jpg', 'main', 'ของที่ระลึก รหัสของ-041', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (42, 'จว-รล-042/2569', 'จว-รล-042/2569', 'GFT-SEC-042', 'ของที่ระลึก รหัสของ-042', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650771_0.jpg', 2, 2, 1, 2, 1, 1, 1, 7350, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (42, 42, '/images/ของที่ระลึก/S__8650771_0.jpg', 'main', 'ของที่ระลึก รหัสของ-042', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (43, 'จว-รล-043/2569', 'จว-รล-043/2569', 'GFT-SEC-043', 'ของที่ระลึก รหัสของ-043', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650772_0.jpg', 2, 2, 1, 2, 1, 1, 1, 7500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (43, 43, '/images/ของที่ระลึก/S__8650772_0.jpg', 'main', 'ของที่ระลึก รหัสของ-043', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (44, 'จว-รล-044/2569', 'จว-รล-044/2569', 'GFT-SEC-044', 'ของที่ระลึก รหัสของ-044', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650773_0.jpg', 2, 2, 1, 2, 1, 1, 1, 7650, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (44, 44, '/images/ของที่ระลึก/S__8650773_0.jpg', 'main', 'ของที่ระลึก รหัสของ-044', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (45, 'จว-รล-045/2569', 'จว-รล-045/2569', 'GFT-SEC-045', 'ของที่ระลึก รหัสของ-045', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650774_0.jpg', 2, 2, 1, 2, 1, 1, 1, 7800, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (45, 45, '/images/ของที่ระลึก/S__8650774_0.jpg', 'main', 'ของที่ระลึก รหัสของ-045', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (46, 'จว-รล-046/2569', 'จว-รล-046/2569', 'GFT-SEC-046', 'ของที่ระลึก รหัสของ-046', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650775_0.jpg', 2, 2, 1, 2, 1, 1, 1, 7950, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (46, 46, '/images/ของที่ระลึก/S__8650775_0.jpg', 'main', 'ของที่ระลึก รหัสของ-046', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (47, 'จว-รล-047/2569', 'จว-รล-047/2569', 'GFT-SEC-047', 'ของที่ระลึก รหัสของ-047', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650776_0.jpg', 2, 2, 1, 2, 1, 1, 1, 8100, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (47, 47, '/images/ของที่ระลึก/S__8650776_0.jpg', 'main', 'ของที่ระลึก รหัสของ-047', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (48, 'จว-รล-048/2569', 'จว-รล-048/2569', 'GFT-SEC-048', 'ของที่ระลึก รหัสของ-048', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650778_0.jpg', 2, 2, 1, 2, 1, 1, 1, 8250, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (48, 48, '/images/ของที่ระลึก/S__8650778_0.jpg', 'main', 'ของที่ระลึก รหัสของ-048', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (49, 'จว-รล-049/2569', 'จว-รล-049/2569', 'GFT-SEC-049', 'ของที่ระลึก รหัสของ-049', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650779_0.jpg', 2, 2, 1, 2, 1, 1, 1, 8400, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (49, 49, '/images/ของที่ระลึก/S__8650779_0.jpg', 'main', 'ของที่ระลึก รหัสของ-049', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (50, 'จว-รล-050/2569', 'จว-รล-050/2569', 'GFT-SEC-050', 'ของที่ระลึก รหัสของ-050', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650780_0.jpg', 2, 2, 1, 2, 1, 1, 1, 8550, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (50, 50, '/images/ของที่ระลึก/S__8650780_0.jpg', 'main', 'ของที่ระลึก รหัสของ-050', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (51, 'จว-รล-051/2569', 'จว-รล-051/2569', 'GFT-SEC-051', 'ของที่ระลึก รหัสของ-051', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650781_0.jpg', 2, 2, 1, 2, 1, 1, 1, 8700, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (51, 51, '/images/ของที่ระลึก/S__8650781_0.jpg', 'main', 'ของที่ระลึก รหัสของ-051', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (52, 'จว-รล-052/2569', 'จว-รล-052/2569', 'GFT-SEC-052', 'ของที่ระลึก รหัสของ-052', 'ของที่ระลึกและของขวัญกัลยาณมิตรประจำห้องรับรองจังหวัด รหัสอ้างอิงภาพ S__8650782_0.jpg', 2, 2, 1, 2, 1, 1, 1, 8850, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (52, 52, '/images/ของที่ระลึก/S__8650782_0.jpg', 'main', 'ของที่ระลึก รหัสของ-052', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (53, 'จว-พพ-001/2569', 'จว-พพ-001/2569', 'BUD-SEC-001', 'พระพุทธรูปบูชา รหัสพระ-001', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634392_0.jpg', 1, 1, 1, 1, 1, 1, 1, 25000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (53, 53, '/images/พระพุทธรูป/S__8634392_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-001', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (54, 'จว-พพ-002/2569', 'จว-พพ-002/2569', 'BUD-SEC-002', 'พระพุทธรูปบูชา รหัสพระ-002', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634393_0.jpg', 1, 1, 1, 1, 1, 1, 1, 28500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (54, 54, '/images/พระพุทธรูป/S__8634393_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-002', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (55, 'จว-พพ-003/2569', 'จว-พพ-003/2569', 'BUD-SEC-003', 'พระพุทธรูปบูชา รหัสพระ-003', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634394_0.jpg', 1, 1, 1, 1, 1, 1, 1, 32000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (55, 55, '/images/พระพุทธรูป/S__8634394_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-003', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (56, 'จว-พพ-004/2569', 'จว-พพ-004/2569', 'BUD-SEC-004', 'พระพุทธรูปบูชา รหัสพระ-004', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634395_0.jpg', 1, 1, 1, 1, 1, 1, 1, 35500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (56, 56, '/images/พระพุทธรูป/S__8634395_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-004', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (57, 'จว-พพ-005/2569', 'จว-พพ-005/2569', 'BUD-SEC-005', 'พระพุทธรูปบูชา รหัสพระ-005', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634396_0.jpg', 1, 1, 1, 1, 1, 1, 1, 39000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (57, 57, '/images/พระพุทธรูป/S__8634396_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-005', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (58, 'จว-พพ-006/2569', 'จว-พพ-006/2569', 'BUD-SEC-006', 'พระพุทธรูปบูชา รหัสพระ-006', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634397_0.jpg', 1, 1, 1, 1, 1, 1, 1, 42500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (58, 58, '/images/พระพุทธรูป/S__8634397_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-006', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (59, 'จว-พพ-007/2569', 'จว-พพ-007/2569', 'BUD-SEC-007', 'พระพุทธรูปบูชา รหัสพระ-007', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634398_0.jpg', 1, 1, 1, 1, 1, 1, 1, 46000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (59, 59, '/images/พระพุทธรูป/S__8634398_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-007', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (60, 'จว-พพ-008/2569', 'จว-พพ-008/2569', 'BUD-SEC-008', 'พระพุทธรูปบูชา รหัสพระ-008', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634399_0.jpg', 1, 1, 1, 1, 1, 1, 1, 49500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (60, 60, '/images/พระพุทธรูป/S__8634399_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-008', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (61, 'จว-พพ-009/2569', 'จว-พพ-009/2569', 'BUD-SEC-009', 'พระพุทธรูปบูชา รหัสพระ-009', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634400_0.jpg', 1, 1, 1, 1, 1, 1, 1, 53000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (61, 61, '/images/พระพุทธรูป/S__8634400_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-009', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (62, 'จว-พพ-010/2569', 'จว-พพ-010/2569', 'BUD-SEC-010', 'พระพุทธรูปบูชา รหัสพระ-010', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634401_0.jpg', 1, 1, 1, 1, 1, 1, 1, 56500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (62, 62, '/images/พระพุทธรูป/S__8634401_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-010', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (63, 'จว-พพ-011/2569', 'จว-พพ-011/2569', 'BUD-SEC-011', 'พระพุทธรูปบูชา รหัสพระ-011', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634403_0.jpg', 1, 1, 1, 1, 1, 1, 1, 60000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (63, 63, '/images/พระพุทธรูป/S__8634403_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-011', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (64, 'จว-พพ-012/2569', 'จว-พพ-012/2569', 'BUD-SEC-012', 'พระพุทธรูปบูชา รหัสพระ-012', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634404_0.jpg', 1, 1, 1, 1, 1, 1, 1, 63500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (64, 64, '/images/พระพุทธรูป/S__8634404_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-012', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (65, 'จว-พพ-013/2569', 'จว-พพ-013/2569', 'BUD-SEC-013', 'พระพุทธรูปบูชา รหัสพระ-013', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634405_0.jpg', 1, 1, 1, 1, 1, 1, 1, 67000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (65, 65, '/images/พระพุทธรูป/S__8634405_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-013', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (66, 'จว-พพ-014/2569', 'จว-พพ-014/2569', 'BUD-SEC-014', 'พระพุทธรูปบูชา รหัสพระ-014', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634406_0.jpg', 1, 1, 1, 1, 1, 1, 1, 70500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (66, 66, '/images/พระพุทธรูป/S__8634406_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-014', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (67, 'จว-พพ-015/2569', 'จว-พพ-015/2569', 'BUD-SEC-015', 'พระพุทธรูปบูชา รหัสพระ-015', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634407_0.jpg', 1, 1, 1, 1, 1, 1, 1, 74000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (67, 67, '/images/พระพุทธรูป/S__8634407_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-015', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (68, 'จว-พพ-016/2569', 'จว-พพ-016/2569', 'BUD-SEC-016', 'พระพุทธรูปบูชา รหัสพระ-016', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634408_0.jpg', 1, 1, 1, 1, 1, 1, 1, 77500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (68, 68, '/images/พระพุทธรูป/S__8634408_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-016', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (69, 'จว-พพ-017/2569', 'จว-พพ-017/2569', 'BUD-SEC-017', 'พระพุทธรูปบูชา รหัสพระ-017', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634409_0.jpg', 1, 1, 1, 1, 1, 1, 1, 81000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (69, 69, '/images/พระพุทธรูป/S__8634409_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-017', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (70, 'จว-พพ-018/2569', 'จว-พพ-018/2569', 'BUD-SEC-018', 'พระพุทธรูปบูชา รหัสพระ-018', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634410_0.jpg', 1, 1, 1, 1, 1, 1, 1, 84500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (70, 70, '/images/พระพุทธรูป/S__8634410_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-018', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (71, 'จว-พพ-019/2569', 'จว-พพ-019/2569', 'BUD-SEC-019', 'พระพุทธรูปบูชา รหัสพระ-019', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634411_0.jpg', 1, 1, 1, 1, 1, 1, 1, 88000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (71, 71, '/images/พระพุทธรูป/S__8634411_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-019', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (72, 'จว-พพ-020/2569', 'จว-พพ-020/2569', 'BUD-SEC-020', 'พระพุทธรูปบูชา รหัสพระ-020', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634412_0.jpg', 1, 1, 1, 1, 1, 1, 1, 91500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (72, 72, '/images/พระพุทธรูป/S__8634412_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-020', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (73, 'จว-พพ-021/2569', 'จว-พพ-021/2569', 'BUD-SEC-021', 'พระพุทธรูปบูชา รหัสพระ-021', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634414_0.jpg', 1, 1, 1, 1, 1, 1, 1, 95000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (73, 73, '/images/พระพุทธรูป/S__8634414_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-021', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (74, 'จว-พพ-022/2569', 'จว-พพ-022/2569', 'BUD-SEC-022', 'พระพุทธรูปบูชา รหัสพระ-022', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634415_0.jpg', 1, 1, 1, 1, 1, 1, 1, 98500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (74, 74, '/images/พระพุทธรูป/S__8634415_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-022', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (75, 'จว-พพ-023/2569', 'จว-พพ-023/2569', 'BUD-SEC-023', 'พระพุทธรูปบูชา รหัสพระ-023', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634416_0.jpg', 1, 1, 1, 1, 1, 1, 1, 102000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (75, 75, '/images/พระพุทธรูป/S__8634416_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-023', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (76, 'จว-พพ-024/2569', 'จว-พพ-024/2569', 'BUD-SEC-024', 'พระพุทธรูปบูชา รหัสพระ-024', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634417_0.jpg', 1, 1, 1, 1, 1, 1, 1, 105500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (76, 76, '/images/พระพุทธรูป/S__8634417_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-024', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (77, 'จว-พพ-025/2569', 'จว-พพ-025/2569', 'BUD-SEC-025', 'พระพุทธรูปบูชา รหัสพระ-025', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634418_0.jpg', 1, 1, 1, 1, 1, 1, 1, 109000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (77, 77, '/images/พระพุทธรูป/S__8634418_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-025', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (78, 'จว-พพ-026/2569', 'จว-พพ-026/2569', 'BUD-SEC-026', 'พระพุทธรูปบูชา รหัสพระ-026', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634419_0.jpg', 1, 1, 1, 1, 1, 1, 1, 112500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (78, 78, '/images/พระพุทธรูป/S__8634419_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-026', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (79, 'จว-พพ-027/2569', 'จว-พพ-027/2569', 'BUD-SEC-027', 'พระพุทธรูปบูชา รหัสพระ-027', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634420_0.jpg', 1, 1, 1, 1, 1, 1, 1, 116000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (79, 79, '/images/พระพุทธรูป/S__8634420_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-027', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (80, 'จว-พพ-028/2569', 'จว-พพ-028/2569', 'BUD-SEC-028', 'พระพุทธรูปบูชา รหัสพระ-028', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634421_0.jpg', 1, 1, 1, 1, 1, 1, 1, 119500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (80, 80, '/images/พระพุทธรูป/S__8634421_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-028', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (81, 'จว-พพ-029/2569', 'จว-พพ-029/2569', 'BUD-SEC-029', 'พระพุทธรูปบูชา รหัสพระ-029', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634422_0.jpg', 1, 1, 1, 1, 1, 1, 1, 123000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (81, 81, '/images/พระพุทธรูป/S__8634422_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-029', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (82, 'จว-พพ-030/2569', 'จว-พพ-030/2569', 'BUD-SEC-030', 'พระพุทธรูปบูชา รหัสพระ-030', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634423_0.jpg', 1, 1, 1, 1, 1, 1, 1, 126500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (82, 82, '/images/พระพุทธรูป/S__8634423_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-030', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (83, 'จว-พพ-031/2569', 'จว-พพ-031/2569', 'BUD-SEC-031', 'พระพุทธรูปบูชา รหัสพระ-031', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634425_0.jpg', 1, 1, 1, 1, 1, 1, 1, 130000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (83, 83, '/images/พระพุทธรูป/S__8634425_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-031', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (84, 'จว-พพ-032/2569', 'จว-พพ-032/2569', 'BUD-SEC-032', 'พระพุทธรูปบูชา รหัสพระ-032', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634426_0.jpg', 1, 1, 1, 1, 1, 1, 1, 133500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (84, 84, '/images/พระพุทธรูป/S__8634426_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-032', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (85, 'จว-พพ-033/2569', 'จว-พพ-033/2569', 'BUD-SEC-033', 'พระพุทธรูปบูชา รหัสพระ-033', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634427_0.jpg', 1, 1, 1, 1, 1, 1, 1, 137000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (85, 85, '/images/พระพุทธรูป/S__8634427_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-033', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (86, 'จว-พพ-034/2569', 'จว-พพ-034/2569', 'BUD-SEC-034', 'พระพุทธรูปบูชา รหัสพระ-034', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634428_0.jpg', 1, 1, 1, 1, 1, 1, 1, 140500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (86, 86, '/images/พระพุทธรูป/S__8634428_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-034', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (87, 'จว-พพ-035/2569', 'จว-พพ-035/2569', 'BUD-SEC-035', 'พระพุทธรูปบูชา รหัสพระ-035', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634429_0.jpg', 1, 1, 1, 1, 1, 1, 1, 144000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (87, 87, '/images/พระพุทธรูป/S__8634429_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-035', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (88, 'จว-พพ-036/2569', 'จว-พพ-036/2569', 'BUD-SEC-036', 'พระพุทธรูปบูชา รหัสพระ-036', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8634430_0.jpg', 1, 1, 1, 1, 1, 1, 1, 147500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (88, 88, '/images/พระพุทธรูป/S__8634430_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-036', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (89, 'จว-พพ-037/2569', 'จว-พพ-037/2569', 'BUD-SEC-037', 'พระพุทธรูปบูชา รหัสพระ-037', 'องค์พระพุทธรูปบูชา สิ่งศักดิ์สิทธิ์ประจำจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ S__8642745_0.jpg', 1, 1, 1, 1, 1, 1, 1, 151000, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (89, 89, '/images/พระพุทธรูป/S__8642745_0.jpg', 'main', 'พระพุทธรูปบูชา รหัสพระ-037', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (90, 'จว-นบ-01/2569', 'จว-นบ-01/2569', 'OUT-SEC-01', 'พัสดุตกแต่ง รหัสตกแต่ง-01', 'พัสดุตกแต่งและครุภัณฑ์ประจำสวนและทางเข้าจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ LINE_ALBUM_หน้าบ้าน_๒๓๐๗๐๗_0.jpg', 3, 3, 1, 3, 1, 1, 1, 8500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (90, 90, '/images/หน้าบ้าน/LINE_ALBUM_หน้าบ้าน_๒๓๐๗๐๗_0.jpg', 'main', 'พัสดุตกแต่ง รหัสตกแต่ง-01', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (91, 'จว-นบ-02/2569', 'จว-นบ-02/2569', 'OUT-SEC-02', 'พัสดุตกแต่ง รหัสตกแต่ง-02', 'พัสดุตกแต่งและครุภัณฑ์ประจำสวนและทางเข้าจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ LINE_ALBUM_หน้าบ้าน_๒๓๐๗๐๗_1.jpg', 3, 3, 1, 3, 1, 1, 1, 14500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (91, 91, '/images/หน้าบ้าน/LINE_ALBUM_หน้าบ้าน_๒๓๐๗๐๗_1.jpg', 'main', 'พัสดุตกแต่ง รหัสตกแต่ง-02', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (92, 'จว-นบ-03/2569', 'จว-นบ-03/2569', 'OUT-SEC-03', 'พัสดุตกแต่ง รหัสตกแต่ง-03', 'พัสดุตกแต่งและครุภัณฑ์ประจำสวนและทางเข้าจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ LINE_ALBUM_หน้าบ้าน_๒๓๐๗๐๗_2.jpg', 3, 3, 1, 3, 1, 1, 1, 20500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (92, 92, '/images/หน้าบ้าน/LINE_ALBUM_หน้าบ้าน_๒๓๐๗๐๗_2.jpg', 'main', 'พัสดุตกแต่ง รหัสตกแต่ง-03', 1);
INSERT INTO assets (id, asset_code, qr_token, serial_number, name, description, category_id, model_id, status_id, location_id, department_id, assigned_user_id, supplier_id, purchase_price, purchase_date, condition, created_by) VALUES (93, 'จว-นบ-04/2569', 'จว-นบ-04/2569', 'OUT-SEC-04', 'พัสดุตกแต่ง รหัสตกแต่ง-04', 'พัสดุตกแต่งและครุภัณฑ์ประจำสวนและทางเข้าจวนผู้ว่าราชการจังหวัด รหัสอ้างอิงภาพ LINE_ALBUM_หน้าบ้าน_๒๓๐๗๐๗_3.jpg', 3, 3, 1, 3, 1, 1, 1, 26500, '2026-08-07', 'excellent', 1);
INSERT INTO asset_images (id, asset_id, object_key, image_type, alt_text, uploaded_by) VALUES (93, 93, '/images/หน้าบ้าน/LINE_ALBUM_หน้าบ้าน_๒๓๐๗๐๗_3.jpg', 'main', 'พัสดุตกแต่ง รหัสตกแต่ง-04', 1);

-- Reset Sequences
SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));
SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));
SELECT setval('locations_id_seq', (SELECT MAX(id) FROM locations));
SELECT setval('asset_categories_id_seq', (SELECT MAX(id) FROM asset_categories));
SELECT setval('manufacturers_id_seq', (SELECT MAX(id) FROM manufacturers));
SELECT setval('asset_models_id_seq', (SELECT MAX(id) FROM asset_models));
SELECT setval('asset_statuses_id_seq', (SELECT MAX(id) FROM asset_statuses));
SELECT setval('suppliers_id_seq', (SELECT MAX(id) FROM suppliers));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('assets_id_seq', (SELECT MAX(id) FROM assets));
SELECT setval('asset_images_id_seq', (SELECT MAX(id) FROM asset_images));

-- Enable Row Level Security (RLS) for public/authenticated read
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on assets" ON assets FOR SELECT USING (true);
CREATE POLICY "Allow public read access on asset_images" ON asset_images FOR SELECT USING (true);
CREATE POLICY "Allow public read access on locations" ON locations FOR SELECT USING (true);
CREATE POLICY "Allow public read access on asset_categories" ON asset_categories FOR SELECT USING (true);
