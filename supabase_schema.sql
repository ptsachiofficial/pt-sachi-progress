-- Setup Supabase SQL Schema for PT Sachi Progress Reporting

-- (Tambahan) Hapus tabel dan view lama jika sudah ada agar bisa dibuat ulang dengan struktur terbaru
DROP VIEW IF EXISTS view_laporan_lengkap CASCADE;
DROP TABLE IF EXISTS laporan_kerja CASCADE;
DROP TABLE IF EXISTS bot_sessions CASCADE;
DROP TABLE IF EXISTS master_boq CASCADE;
DROP TABLE IF EXISTS master_material CASCADE;


-- 1. Table: bot_sessions
-- Digunakan untuk menyimpan state atau langkah dari user di Telegram Bot
CREATE TABLE IF NOT EXISTS bot_sessions (
    telegram_id BIGINT PRIMARY KEY,
    current_step VARCHAR(50) NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Table: master_boq
-- Digunakan untuk data Bill of Quantities / jenis pekerjaan
CREATE TABLE IF NOT EXISTS master_boq (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Table: master_material
-- Digunakan untuk data Material yang digunakan
CREATE TABLE IF NOT EXISTS master_material (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
    unit VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Table: laporan_kerja
-- Digunakan untuk menyimpan laporan kerja dengan relasi dan foto
CREATE TABLE IF NOT EXISTS laporan_kerja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    location VARCHAR(255),
    photo_url TEXT,
    boq_id UUID REFERENCES master_boq(id),
    material_id UUID REFERENCES master_material(id),
    quantity NUMERIC,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. View (Optional): view_laporan_lengkap
-- View untuk mempermudah dashboard mengambil data laporan beserta nama BOQ dan Material
CREATE OR REPLACE VIEW view_laporan_lengkap AS
SELECT 
    lk.id,
    lk.telegram_id,
    lk.location,
    lk.photo_url,
    lk.quantity,
    lk.notes,
    lk.status,
    lk.created_at,
    mb.task_name as boq_name,
    mm.material_name as material_name
FROM laporan_kerja lk
LEFT JOIN master_boq mb ON lk.boq_id = mb.id
LEFT JOIN master_material mm ON lk.material_id = mm.id;
