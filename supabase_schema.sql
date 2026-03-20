-- Setup Supabase SQL Schema for PT Sachi Progress Reporting
-- Update according to ROLEBOT.txt flow

DROP VIEW IF EXISTS view_laporan_lengkap CASCADE;
DROP VIEW IF EXISTS view_transaksi_material CASCADE;
DROP TABLE IF EXISTS laporan_kerja CASCADE;
DROP TABLE IF EXISTS transaksi_material CASCADE;
DROP TABLE IF EXISTS bot_sessions CASCADE;
DROP TABLE IF EXISTS master_boq CASCADE;
DROP TABLE IF EXISTS master_material CASCADE;
DROP TABLE IF EXISTS master_project CASCADE;

-- 0. Table: master_project
CREATE TABLE IF NOT EXISTS master_project (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_mitra VARCHAR(255),
    nama_user VARCHAR(255),
    no_spmk VARCHAR(255),
    project_name VARCHAR(255) NOT NULL,
    lokasi VARCHAR(255),
    kordinat VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 1. Table: bot_sessions
-- Digunakan untuk menyimpan state atau langkah dari user di Telegram Bot
CREATE TABLE IF NOT EXISTS bot_sessions (
    telegram_id BIGINT PRIMARY KEY,
    current_step VARCHAR(50) NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Table: master_boq
CREATE TABLE IF NOT EXISTS master_boq (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Table: master_material
CREATE TABLE IF NOT EXISTS master_material (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
    unit VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Table: laporan_kerja
CREATE TABLE IF NOT EXISTS laporan_kerja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    project_id UUID REFERENCES master_project(id),
    task_category VARCHAR(100), -- e.g., 'Instalasi'
    task_name VARCHAR(255),     -- e.g., 'BC-TR (GALIAN)'
    boq_id UUID REFERENCES master_boq(id),
    quantity NUMERIC,
    notes TEXT,
    photo_urls JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'submitted',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4b. Table: transaksi_material
CREATE TABLE IF NOT EXISTS transaksi_material (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    project_id UUID REFERENCES master_project(id),
    material_id UUID REFERENCES master_material(id),
    transaction_type VARCHAR(10) NOT NULL, -- 'IN' atau 'OUT'
    quantity NUMERIC NOT NULL,
    photo_urls JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'submitted',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. View: view_laporan_lengkap
CREATE OR REPLACE VIEW view_laporan_lengkap AS
SELECT 
    lk.id,
    lk.telegram_id,
    mp.project_name,
    mp.lokasi,
    mp.nama_mitra,
    lk.task_category,
    lk.task_name,
    lk.photo_urls,
    lk.quantity,
    lk.notes,
    lk.status,
    lk.created_at,
    mb.task_name as boq_name
FROM laporan_kerja lk
LEFT JOIN master_boq mb ON lk.boq_id = mb.id
LEFT JOIN master_project mp ON lk.project_id = mp.id;

-- 6. View: view_transaksi_material
CREATE OR REPLACE VIEW view_transaksi_material AS
SELECT 
    tm.id,
    tm.telegram_id,
    mp.project_name,
    mp.lokasi,
    mp.nama_mitra,
    tm.transaction_type,
    tm.photo_urls,
    tm.quantity,
    tm.notes,
    tm.status,
    tm.created_at,
    mm.material_name,
    mm.code as material_code
FROM transaksi_material tm
LEFT JOIN master_material mm ON tm.material_id = mm.id
LEFT JOIN master_project mp ON tm.project_id = mp.id;

