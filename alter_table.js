console.log(`
Silakan Buka SQL Editor di Supabase Anda, lalu Jalankan kueri berikut ini untuk memperbarui tabel dan view-nya:

ALTER TABLE master_project
ADD COLUMN area VARCHAR(255),
ADD COLUMN site_name VARCHAR(255);

DROP VIEW IF EXISTS view_laporan_lengkap CASCADE;
CREATE OR REPLACE VIEW view_laporan_lengkap AS
SELECT 
    lk.id,
    lk.telegram_id,
    mp.project_name as location,
    mp.area,
    mp.site_name,
    lk.photo_url,
    lk.quantity,
    lk.notes,
    lk.status,
    lk.created_at,
    mb.task_name as boq_name
FROM laporan_kerja lk
LEFT JOIN master_boq mb ON lk.boq_id = mb.id
LEFT JOIN master_project mp ON lk.project_id = mp.id;

DROP VIEW IF EXISTS view_transaksi_material CASCADE;
CREATE OR REPLACE VIEW view_transaksi_material AS
SELECT 
    tm.id,
    tm.telegram_id,
    mp.project_name as project_name,
    mp.area,
    mp.site_name,
    tm.transaction_type,
    tm.photo_url,
    tm.quantity,
    tm.notes,
    tm.status,
    tm.created_at,
    mm.material_name,
    mm.code as material_code
FROM transaksi_material tm
LEFT JOIN master_material mm ON tm.material_id = mm.id
LEFT JOIN master_project mp ON tm.project_id = mp.id;
`);
