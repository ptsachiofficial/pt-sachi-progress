-- Supabase SQL Editor
-- Jalankan kode berikut untuk menambahkan tabel dan kolom baru

-- 1. Tambahkan kolom baru di master_project
ALTER TABLE master_project
ADD COLUMN IF NOT EXISTS main_message_id BIGINT,
ADD COLUMN IF NOT EXISTS discussion_chat_id BIGINT,
ADD COLUMN IF NOT EXISTS category_messages JSONB DEFAULT '{}'::jsonb;

-- 2. Buat tabel evidences
CREATE TABLE IF NOT EXISTS evidences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    laporan_id UUID REFERENCES laporan_kerja(id) ON DELETE CASCADE,
    project_id UUID REFERENCES master_project(id) ON DELETE CASCADE,
    category VARCHAR(100),
    telegram_file_id VARCHAR(255) NOT NULL,
    r2_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. (Opsional) Update view agar turut menampilkan data dari evidences jika diperlukan
