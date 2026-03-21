import { NextRequest, NextResponse } from "next/server";
import { Telegraf, Markup } from "telegraf";
import { supabase } from "@/lib/supabase";
import { uploadToR2 } from "@/lib/r2";
import lodash from 'lodash';
import { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, UnderlineType, VerticalAlign, SectionType } from 'docx';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "");
const MAIN_CHANNEL_ID = process.env.MAIN_CHANNEL_ID || "";

// --- Session Management ---
async function getSession(telegram_id: number) {
    const { data } = await supabase.from('bot_sessions').select('*').eq('telegram_id', telegram_id).single();
    if (!data) return { current_step: 'IDLE', data: {} };
    return { current_step: data.current_step, data: data.data || {} };
}

async function updateSession(telegram_id: number, current_step: string, sessionData: any = {}) {
    await supabase.from('bot_sessions').upsert({
        telegram_id,
        current_step,
        data: sessionData,
        updated_at: new Date().toISOString()
    });
}

async function clearSession(telegram_id: number) {
    await supabase.from('bot_sessions').delete().eq('telegram_id', telegram_id);
}

// --- Menu Helpers ---
const MAIN_MENU = Markup.inlineKeyboard([
    [Markup.button.callback("1. NEW Project", "MENU_NEW_PROJ")],
    [Markup.button.callback("2. Laporan project", "MENU_LAP_PROJ")]
]);

// --- TASK TO DESIGNATOR MAPPING FROM KATEGORI.csv ---
const TASK_DESIGNATOR_MAP: Record<string, string[]> = {
  "BC-TR (GALIAN) / BORING MANUAL / ROJOK (DD-BM)": ["EXCAVATION-0.4", "EXCAVATION-0.6", "EXCAVATION-1.0", "EXCAVATION-1.2", "EXCAVATION-1.5", "BCTR-ROCK", "BD-SK", "DD-BRNG-HDPE-40-1", "DD-BRNG-HDPE-40-2", "DD-BRNG-HDPE-50-1", "DD-BRNG-HDPE-50-2", "DD-ROD", "DD-RV-1", "DD-RV-CONCRETE", "DD-DS-S1", "DD-DS-COD1-M"],
  "PEMASANGAN SUBDUCT / HDPE / PIPA": ["HDPE-40-33", "PIPE-BRIDGE", "RP-GALVANIS"],
  "PEMBUATAN & PEMASANGAN HANDHOLE": ["MH-HH-170", "MH-PIT-120", "HH-PIT-80", "HH-PIT-P-HA", "HH-PIT-P-FAT", "HH-PIT-P-FDT", "MH-HH-REKONDISI"],
  "PENARIKKAN KABEL FEEDER": ["AC-ADSS-SM-48C", "AC-ADSS-SM-96C", "AC-ADSS-SM-144C", "AC-ADSS-SM-288C"],
  "PENARIKKAN KABEL DISTRIBUSI": ["AC-ADSS-SM-12C", "AC-ADSS-SM-24C", "AC-ADSS-SM-48C", "AC-ADSS-SM-96C"],
  "PEMASANGAN TIANG 7m / 9m": ["NP-6.0-100-1S", "NP-7.0-140-2S", "NP-7.0-140-3S", "NP-9.0-140-3S", "NP-CB-7.0-250", "NP-CB-9.0-250"],
  "PEMASANGAN ODC": ["FDT-POLE-48C", "FDT-POLE-96C", "FDT-STDG-96C", "FDT-STDG-144C", "FDT-STDG-288C"],
  "PEMASANGAN ODP": ["FAT-PB-8C-SOLID", "FAT-PB-16C-SOLID", "FAT-PDSTL-8", "FAT-PDSTL-16"],
  "PEMASANGAN DAN TERMINASI OTB": ["Base Tray ODC", "OTB-SM-6", "OTB-SM-8", "OTB-SM-12", "OTB-SM-24", "OTB-SM-48", "OTB-SM-96", "OTB-SM-144", "OTB-SM-288"],
  "PEMASANGAN CLOSURE": ["JC-OF-SM-12C", "JC-OF-SM-24C", "JC-OF-SM-48C", "JC-OF-SM-96C", "JC-OF-SM-144C", "JC-OF-SM-288C"],
  "PEMASANGAN AKSESORIS": ["ACC-STAINLESS BELT", "ACC-SUSPENSION AYUN", "ACC-HELLICAL", "ACC-ANCHORING", "ACC-Bracket", "ACC-POLESTRAP SPIRAL"],
  "TERMINASI ODC": ["FS-OF-SM", "NN-OTDR-CORE", "NN-CO-CORE"],
  "TERMINASI ODP": ["FS-OF-SM", "NN-CO-CORE"],
  "TERMINASI CLOSURE": ["FS-OF-SM", "NN-CO-CORE"],
  "PEMASANGAN IKR/IKG": [],
  "INSTALASI FTM": [],
  "INSTALASI JUMPER FTM (OLT-FEEDER)": []
};

// --- Helper Info Syarat Foto Khusus berdasarkan ROLEBOT.txt ---
function getPhotoRequirementMessage(t: string): string {
    if (t.includes('BC-TR (GALIAN)')) return "\n\n  _\"upload foto dari volume satuan per 100M 1foto jadi jika volume di isi 200 maka wajib upload 2foto\"_\n";
    if (t.includes('PEMASANGAN SUBDUCT')) return "\n\n  _\"upload foto min 4 foto per laporan\"_\n";
    if (t.includes('HANDHOLE')) return "\n\n  _\". FOTO PENGUKURAN PANJANG\n  . FOTO PENGUKURAN LEBAR\n  . FOTO PENGUKURAN KEDALAMAN\n  . FOTO TAMPAK JAUH FULL\"_\n";
    if (t.includes('KABEL')) return "\n\n  _\"FOTO Wajib berdasarkan volume 2 foto \n  . FOTO MARKING START\n  . FOTO MARKING END\n  upload foto dari volume satuan per 200M 1foto jadi jika volume di isi 400 maka wajib upload 2foto\"_\n";
    if (t.includes('PEMASANGAN TIANG')) return "\n\n  _\". TAMPAK JAUH\n  . TAMPAK ATAS\n  . TAMPAK BAWAH (COR)\n  . TAMPAK DEKAT\"_\n";
    if (t.includes('PEMASANGAN ODC')) return "\n\n  _\". TAMPAK DALAM TERLIHAT FULL\n  . TAMPAK LUAR POSISI TERTUTUP\n  . TAMPAK JAUH\n  . TAMPAK BLAKANG\"_\n";
    if (t.includes('PEMASANGAN ODP')) return "\n\n  _\". TAMPAK SAMBUNGAN\n  . TAMPAK ACC ODP\n  . TAMPAK FULL POSISI TERTUTUP DAN SUDAH TERLABEL\n  . EVIDEN REDAMAN PER PORT 1-16\n  . TAMPAK JAUH\"_\n";
    if (t.includes('PEMASANGAN DAN TERMINASI OTB')) return "\n\n  _\". TAMPAK DEPAN\n  . TAMPAK JAUH\n  . EVIDEN SAAT TERMINASI MIN 4 FOTO\n  . EVIDEN PENGUKURAN\n  . TAMPAK DEKAT/PROSES\"_\n";
    if (t.includes('PEMASANGAN CLOSURE')) return "\n\n  _\". TAMPAK DALAM\n  . TAMPAK LUAR\n  . EVIDEN SAAT TERMINASI TIAP KASET\n  . TAMPAK JAUH (SUDAH TERTUTUP)\"_\n";
    if (t.includes('TERMINASI ODC')) return "\n\n  _\"upload foto minimal 2 foto setiap 12 volume core\n  . TAMPAK BESTRAY TERBUKA SAAT SETELAH SELESAI TERMINASI\n  . TAMPAK BESTRAY TERPASANG SAMBIL MENUNJUK\"_\n";
    if (t.includes('TERMINASI ODP')) return "\n\n  _\"upload foto minimal 2 foto setiap 1 volume core\n  . TAMPAK SETELAH SELESAI TERMINASI\n  . TAMPAK PROGRES TERMINASI\"_\n";
    if (t.includes('TERMINASI CLOSURE')) return "\n\n  _\"upload foto minimal 2 foto setiap 12 volume core\n  . TAMPAK TIAP KASET\n  . TAMPAK PROGRES\"_\n";
    if (t.includes('PERAPIHAN')) return "\n\n  _\"UPLOAD FOTO LABELING MIN 4 FOTO\"_\n";
    return "\n";
}

function getRequiredPhotoCount(t: string, vol: number): number {
    let requiredPhotos = 1;
    if (t.includes('GALIAN') || t.includes('ROJOK')) requiredPhotos = Math.max(1, Math.ceil(vol / 100));
    else if (t.includes('SUBDUCT') || t.includes('HDPE') || t.includes('PEMASANGAN ODC') || t.includes('CLOSURE') || t.includes('PERAPIHAN')) requiredPhotos = 4;
    else if (t.includes('HANDHOLE') || t.includes('TIANG')) requiredPhotos = vol * 4;
    else if (t.includes('FEEDER') || t.includes('DISTRIBUSI')) requiredPhotos = 2 + Math.ceil(vol / 200);
    else if (t.includes('PEMASANGAN ODP')) requiredPhotos = vol * 20;
    else if (t.includes('OTB')) requiredPhotos = 8;
    else if (t.includes('TERMINASI ODC') || t.includes('TERMINASI CLOSURE')) requiredPhotos = Math.max(1, Math.ceil(vol / 12) * 2);
    else if (t.includes('TERMINASI ODP')) requiredPhotos = vol * 2;
    return requiredPhotos;
}

// --- COMMANDS ---
bot.start(async (ctx) => {
    await clearSession(ctx.from.id);
    const welcomeText = `🚀 *SELAMAT DATANG DI SISTEM PELAPORAN PT SACHI* 🚀\n\n` +
        `Halo! Bot ini dirancang khusus untuk mempermudah Anda dalam melaporkan progres pekerjaan lapangan serta mendata keluar-masuk material secara *real-time*.\n\n` +
        `📖 *TATA CARA PENGGUNAAN:*\n` +
        `1️⃣ *NEW Project* 🏢\n` +
        `   Gunakan menu ini jika Anda ingin mendaftarkan proyek baru. Siapkan data seperti _Nama Mitra_, _No SPMK_, _Lokasi_, dan _Koordinat_.\n` +
        `2️⃣ *Laporan project* 📝\n` +
        `   Gunakan menu ini untuk melaporkan progres harian dari proyek yang sudah terdaftar. Anda dapat memilih tahapan pekerjaan (seperti _Persiapan_, _Instalasi_, dll) dan mengunggah foto bukti beserta jumlah volume.\n` +
        `3️⃣ *Pembatalan* ❌\n` +
        `   Kapan saja Anda merasa salah ketik atau ingin mengulang, cukup ketik perintah /batal atau /cancel untuk mereset seluruh proses yang sedang Anda lakukan.\n\n` +
        `✨ *Pilih menu di bawah ini untuk memulai:*`;

    await ctx.reply(welcomeText, { parse_mode: 'Markdown', ...MAIN_MENU });
});

bot.command(['cancel', 'batal'], async (ctx) => {
    await clearSession(ctx.from.id);
    await ctx.reply("❌ *Proses Dibatalkan!*\n\nSeluruh data sesi Anda telah berhasil dibersihkan. Silakan ketik /start untuk kembali ke layar utama. 🔄", { parse_mode: 'Markdown' });
});

// --- CALLBACK QUERIES ---
bot.on("callback_query", async (ctx) => {
    const cbQuery = ctx.callbackQuery as any;
    const data = cbQuery.data;
    const telegram_id = ctx.from.id;

    try { await ctx.answerCbQuery(); } catch (e) { }

    if (data === "MENU_MAIN") {
        await clearSession(telegram_id);
        return ctx.editMessageText("✨ *Menu Utama PT Sachi*\nSilakan pilih opsi menu di bawah ini:", MAIN_MENU);
    }

    // ============================================
    // 1. NEW PROJECT FLOW
    // ============================================
    if (data === "MENU_NEW_PROJ") {
        await updateSession(telegram_id, 'NEW_PROJ_MITRA', { projectDraft: {} });
        return ctx.editMessageText(
            "📝 *FORM PENGISIAN PROJECT BARU*\n\n1️⃣ Silakan masukkan *Nama Mitra* (contoh: Telkom, Icon+, dsb):",
            { parse_mode: 'Markdown' }
        );
    }

    if (data === "CONFIRM_SAVE_PROJ") {
        const session = await getSession(telegram_id);
        const p = session.data.projectDraft;
        if (!p) return ctx.reply("⚠️ *Sesi Anda telah kedaluwarsa.*\n\nSilakan ketik /start untuk mengulang proses dari awal. 🔄");
        
        ctx.editMessageText("⏳ *Menyimpan Project Baru...*\nMohon tunggu sebentar, sistem sedang memproses data Anda.");
        const { data: insertedProject, error } = await supabase.from('master_project').insert({
            nama_mitra: p.mitra,
            nama_user: p.user,
            no_spmk: p.spmk,
            project_name: p.nama_project,
            lokasi: p.lokasi,
            kordinat: p.kordinat
        }).select().single();

        if (error || !insertedProject) {
            console.error(error);
            return ctx.reply("❌ *Gagal Menyimpan Project!*\n\nTerjadi kesalahan fatal pada sistem. Silakan coba lagi beberapa saat.");
        }
        
        // --- SEGERA KIRIM KE CHANNEL ---
        if (MAIN_CHANNEL_ID) {
            try {
                const msg = await bot.telegram.sendMessage(
                    MAIN_CHANNEL_ID,
                    `🏢 *PROJECT BARU*: ${insertedProject.project_name || '-'}\n📄 *SPMK*: ${insertedProject.no_spmk || '-'}\n📍 *Lokasi*: ${insertedProject.lokasi || '-'}\n\n_Seluruh dokumentasi progres proyek ini akan dikumpulkan di bawah thread pesan ini._`,
                    { parse_mode: 'Markdown' }
                );
                
                let discussion_chat_id = null;
                try {
                    const chatInfo = await bot.telegram.getChat(MAIN_CHANNEL_ID) as any;
                    if (chatInfo.linked_chat_id) discussion_chat_id = chatInfo.linked_chat_id;
                } catch(e) {}
                
                await supabase.from('master_project').update({ 
                    main_message_id: msg.message_id, 
                    discussion_chat_id: discussion_chat_id 
                }).eq('id', insertedProject.id);
            } catch(e) { console.error("Broadcast new project failed:", e); }
        }
        // ---------------------------------

        await clearSession(telegram_id);
        return ctx.reply("✅ *Project Berhasil Disimpan & Diumumkan!*\n\nData proyek Anda telah tercatat dengan aman di database dan diteruskan ke Channel. Silakan ketik /start untuk menu utama. 🚀");
    }

    if (data === "CONFIRM_CANCEL_PROJ") {
        await clearSession(telegram_id);
        return ctx.editMessageText("❌ *Pembuatan Project Dibatalkan.*\n\nSilakan pilih opsi menu lainnya di bawah ini:", MAIN_MENU);
    }

    // ============================================
    // 2. LAPORAN PROJECT FLOW
    // ============================================
    if (data === "MENU_LAP_PROJ") {
        const { data: projects } = await supabase.from('master_project').select('id, project_name').order('created_at', { ascending: false }).limit(10);
        
        if (!projects || projects.length === 0) {
            return ctx.reply("📭 *Data Project Kosong*\n\nBelum ada data project yang terdaftar. Sila buat project baru terlebih dahulu via menu sebelumnya. 🏢", { parse_mode: 'Markdown' });
        }

        const buttons = projects.map(p => [Markup.button.callback(p.project_name, `SELPROJ_${p.id}`)]);
        buttons.push([Markup.button.callback("🔙 Batal/Kembali", "MENU_MAIN")]);
        
        return ctx.editMessageText(
            "📋 *Daftar Project Aktif*\n\nSilakan pilih project yang ingin Anda kelola laporkan progresnya:",
            { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
        ).catch(() => ctx.reply("📋 *Daftar Project Aktif*\nSilakan pilih Project:", Markup.inlineKeyboard(buttons)));
    }

    if (data.startsWith("SELPROJ_")) {
        const projId = data.replace("SELPROJ_", "");
        const session = await getSession(telegram_id);

        const { data: p } = await supabase.from('master_project').select('*').eq('id', projId).single();
        if(!p) return;

        const detail = `📋 *DETAIL PROJECT*\n\n`+
            `🏢 *Nama Project*: ${p.project_name || '-'}\n`+
            `📄 *No. SPMK*: ${p.no_spmk || '-'}\n`+
            `📍 *Lokasi*: ${p.lokasi || '-'}\n`+
            `🌍 *Koordinat*: ${p.kordinat || '-'}\n\n`+
            `Silakan pilih interaksi operasional laporan:`;

        const buttons = [
            [Markup.button.callback("📝 Mengisi Laporan Progres", `LAPPROG_${projId}`)],
            [Markup.button.callback("📊 Cek Status Progres Murni", `STATPROJ_${projId}`)]
        ];
        
        // Hanya tampilkan tombol Refresh untuk admin ID 81358099
        if (telegram_id === 81358099) {
            buttons.push([Markup.button.callback("📢 Refresh/Kirim ke Channel", `REFRESH_PROJ_${projId}`)]);
        }

        buttons.push([Markup.button.callback("🔙 Batal/Kembali", "MENU_LAP_PROJ")]);

        return ctx.editMessageText(detail, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) })
            .catch(()=>ctx.reply(detail, { parse_mode:'Markdown', ...Markup.inlineKeyboard(buttons) }));
    }

    if (data.startsWith("REFRESH_PROJ_")) {
        const projId = data.replace("REFRESH_PROJ_", "");
        await ctx.answerCbQuery("⏳ Sedang menyegarkan data Channel...");
        await updateCategoryProgress(projId, "REFRESH_ONLY");
        return ctx.reply("✅ *Berhasil!* Proyek telah di-broadcast ulang ke Channel agar terhubung dengan Grup Diskusi.", { parse_mode: 'Markdown' });
    }

    // Laporan Progres - Pilih Kategori
    if (data.startsWith("LAPPROG_")) {
        const projId = data.replace("LAPPROG_", "");
        await updateSession(telegram_id, 'LAP_MENU', { project_id: projId });
        
        const categories = [
            ["Persiapan", "CAT_PERSIAPAN"],
            ["Material Delivery", "CAT_MATERIAL"],
            ["Instalasi", "CAT_INSTALASI"],
            ["Finish Instalation", "CAT_FINISH"],
            ["Closing", "CAT_CLOSING"]
        ];

        const buttons = categories.map(c => [Markup.button.callback(c[0], `LAPCAT_${c[1]}`)]);
        buttons.push([Markup.button.callback("🔙 Kembali ke Project", `SELPROJ_${projId}`)]);

        return ctx.editMessageText(
            "📂 *Pilih Kategori Pekerjaan:*\nSilakan tentukan modul kategori laporan Anda.",
            { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
        ).catch(() => ctx.reply("📂 *Pilih Kategori Pekerjaan:*", Markup.inlineKeyboard(buttons)));
    }

    // Laporan Progres - Pilih Sub Kategori/Task
    if (data.startsWith("LAPCAT_")) {
        const cat = data.replace("LAPCAT_", "");
        const session = await getSession(telegram_id);
        const projId = session.data.project_id;
        if(!projId) return ctx.reply("⚠️ *Sesi kedaluwarsa.* Ketik /start untuk mengulang.", { parse_mode: 'Markdown' });

        let tasks: string[] = [];
        let catName = "";

        if (cat === "CAT_PERSIAPAN") { catName = "Persiapan"; tasks = ["Aanwijzing", "Perijinan"]; }
        else if (cat === "CAT_MATERIAL") { catName = "Material Delivery"; tasks = ["Material"]; }
        else if (cat === "CAT_INSTALASI") { 
            catName = "Instalasi"; 
            tasks = [
                "BC-TR (GALIAN) / BORING MANUAL / ROJOK (DD-BM)",
                "PEMASANGAN SUBDUCT / HDPE / PIPA",
                "PEMBUATAN & PEMASANGAN HANDHOLE",
                "PENARIKKAN KABEL FEEDER",
                "PENARIKKAN KABEL DISTRIBUSI",
                "PEMASANGAN TIANG 7m / 9m",
                "PEMASANGAN ODC", "PEMASANGAN ODP", "PEMASANGAN DAN TERMINASI OTB",
                "PEMASANGAN CLOSURE", "PEMASANGAN AKSESORIS", "TERMINASI ODC",
                "TERMINASI ODP", "TERMINASI CLOSURE", "PEMASANGAN IKR/IKG",
                "INSTALASI FTM", "INSTALASI JUMPER FTM (OLT-FEEDER)"
            ];
        }
        else if (cat === "CAT_FINISH") { catName = "Finish Instalation"; tasks = ["PERAPIHAN & LABELLING", "ATP"]; }
        else if (cat === "CAT_CLOSING") { catName = "Closing"; tasks = ["Uji Terima", "Go Live"]; }

        const buttons = tasks.map((t, idx) => [Markup.button.callback(t, `TASKSEL_${cat}_${idx}`)]);
        buttons.push([Markup.button.callback("🔙 Kembali ke Kategori", `LAPPROG_${projId}`)]);

        // Simpan map nama aslinya ke session agar gampang diambil berdasarkan idx
        await updateSession(telegram_id, 'LAP_MENU_CAT', { ...session.data, category: catName, tasks });

        return ctx.editMessageText(
            `📂 *Kategori:* ${catName}\n\n🛠️ *Pilih Jenis Pekerjaan* yang ingin Anda laporkan saat ini:`,
            { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
        ).catch(() => ctx.reply(`📂 *Kategori:* ${catName}\nPilih Pekerjaan:`, Markup.inlineKeyboard(buttons)));
    }

    if (data.startsWith("TASKSEL_")) {
        const session = await getSession(telegram_id);
        const parts = data.replace("TASKSEL_", "").split("_");
        const idx = parseInt(parts[2]);
        const taskName = session.data.tasks[idx];

        if (session.data.category === "Persiapan") {
            await updateSession(telegram_id, 'LAP_WAIT_PERSIAPAN_STAT', { ...session.data, task: taskName });
            return ctx.editMessageText(
                `📌 *Kategori:* Persiapan\n🛠️ *Task:* ${taskName}\n\nPilih status penyelesaian untuk tahap ini:`,
                { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
                    [Markup.button.callback("✅ DONE", "PERSIAPAN_STAT_DONE")],
                    [Markup.button.callback("❌ NOK", "PERSIAPAN_STAT_NOK")]
                ])}
            ).catch(() => ctx.reply(`Pilih status penyelesaian untuk ${taskName}:`));
        }

        // ================= NEW DB SEARCH FLOW =================
        // Jika Material Delivery atau Instalasi, minta ketik keyword pencarian.
        if (session.data.category === "Material Delivery") {
            await updateSession(telegram_id, 'LAP_WAIT_SEARCH_MAT', { ...session.data, task: taskName });
            return ctx.editMessageText(
                `🛠️ *Task:* ${taskName}\n\n🔍 *Pencarian Material*\nSilakan ketik nama material (sebagian/keseluruhan) yang akan dilaporkan:`,
                { parse_mode: 'Markdown' }
            );
        } else if (session.data.category === "Instalasi") {
            const mapped = TASK_DESIGNATOR_MAP[taskName] || [];
            
            if (mapped.length > 0) {
                const { data: dbData } = await supabase.from('master_boq').select('id, task_name').in('task_name', mapped);
                
                if (dbData && dbData.length > 0) {
                    const buttons = [];
                    // Urutkan supaya menyesuaikan order yg kita punya (opsional) atau biarkan langsung push
                    for (let item of dbData) {
                        buttons.push([Markup.button.callback(item.task_name, `SELDB_BOQ_${item.id}`)]);
                    }
                    buttons.push([Markup.button.callback("🔍 Pencarian Lainnya (Ketik Manual)", "SEARCH_OTHER_BOQ")]);

                    await updateSession(telegram_id, 'LAP_WAIT_SEARCH_BOQ_OPTIONAL', { ...session.data, task: taskName });
                    return ctx.editMessageText(
                        `🛠️ *Task:* ${taskName}\n\n📋 *Pilihan Designator*\nSilakan pilih item yang tersedia di bawah ini, atau klik fitur *Pencarian Lainnya* jika Anda tidak menemukan yang spesifik:`,
                        { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
                    );
                }
            }
            
            await updateSession(telegram_id, 'LAP_WAIT_SEARCH_BOQ', { ...session.data, task: taskName });
            return ctx.editMessageText(
                `🛠️ *Task:* ${taskName}\n\n🔍 *Pencarian Designator*\nSilakan ketik kata kunci spesifik (contoh: tiang, galian, rodding, dsb):`,
                { parse_mode: 'Markdown' }
            );
        }

        // Jika selain itu (Finish, Closing), langsung ke volume. (Karena gak ada BOQ khusus)
        await updateSession(telegram_id, 'LAP_WAIT_QTY', { ...session.data, task: taskName });
        return ctx.editMessageText(
            `🛠️ *Task:* ${taskName}\n\n✏️ *Pengisian Volume*\nSilakan masukkan total *Volume/Jumlah* yang telah dikerjakan (masukkan angka saja):`,
            { parse_mode: 'Markdown' }
        ).catch(() => ctx.reply(`🛠️ *Task:* ${taskName}\n✏️ Masukkan *Volume/Jumlah* kegiatan berlalu berupa angka:`));
    }

    if (data === "SEARCH_OTHER_BOQ") {
        const session = await getSession(telegram_id);
        await updateSession(telegram_id, 'LAP_WAIT_SEARCH_BOQ', session.data);
        return ctx.editMessageText("🔍 *Pencarian Manual Designator:*\nSilakan ketik kata kunci yang ingin Anda cari (contoh: tiang, galian, seling, dsb):", { parse_mode: 'Markdown' });
    }

    // Callback pencarian terpilih (dari fitur bot.on('text') pencarian BOQ/Mat)
    if (data.startsWith("SELDB_BOQ_") || data.startsWith("SELDB_MAT_")) {
        const isBoq = data.startsWith("SELDB_BOQ_");
        const id = data.replace(isBoq ? "SELDB_BOQ_" : "SELDB_MAT_", "");
        const session = await getSession(telegram_id);
        
        let designatorName = "";
        let boq_id = null;

        if (id === "MANUAL") {
            // User akan ketik manual
            await updateSession(telegram_id, 'LAP_WAIT_MANUAL_INPUT_NAME', session.data);
            return ctx.editMessageText("📝 *Input Manual Designator:*\nSilakan ketik secara manual nama material atau designator tersebut:", { parse_mode: 'Markdown' });
        } else {
            // Get from DB
            if (isBoq) {
                const { data: dbData } = await supabase.from('master_boq').select('*').eq('id', id).single();
                if(dbData) { designatorName = dbData.task_name; boq_id = dbData.id; }
            } else {
                const { data: dbData } = await supabase.from('master_material').select('*').eq('id', id).single();
                if(dbData) { designatorName = dbData.material_name; boq_id = dbData.id; } // BOQ id is kept loosely for material too
            }
            
            await updateSession(telegram_id, 'LAP_WAIT_QTY', { ...session.data, designator: designatorName, boq_id });
            return ctx.editMessageText(
                `✔️ *Item Terpilih:* ${designatorName}\n\n✏️ *Pengisian Volume*\nSilakan masukkan jumlah *Volume* yang telah dieksekusi (hanya angka, contoh: 10 atau 4.5):`,
                { parse_mode: 'Markdown' }
            );
        }
    }

    if (data.startsWith("PERSIAPAN_STAT_")) {
        const stat = data.replace("PERSIAPAN_STAT_", ""); // DONE or NOK
        const session = await getSession(telegram_id);
        const sd = session.data;
        if(!sd.project_id) return ctx.reply("⚠️ *Sesi kedaluwarsa.* Ketik /start untuk mengulang.", { parse_mode: 'Markdown' });
        
        ctx.editMessageText(`⏳ *Memproses Data...*\nMenyimpan status *${stat}* untuk tugas *${sd.task}*. Mohon tunggu... 🔄`, { parse_mode: 'Markdown' });

        const { error } = await supabase.from('laporan_kerja').insert({
            telegram_id: telegram_id,
            project_id: sd.project_id,
            task_category: sd.category,
            task_name: sd.task,
            quantity: 1,
            notes: `Status: ${stat}`,
            photo_urls: [],
            status: stat === "DONE" ? "submitted" : "nok"
        });

        if (error) {
            console.error(error);
            return ctx.reply(`❌ *Gagal Menyimpan Data!*\n\n${error.message}`);
        }

        await clearSession(telegram_id);
        const finishBtns = [
            [Markup.button.callback("📑 Kembali ke Laporan Project", `LAPPROG_${sd.project_id}`)],
            [Markup.button.callback("🏠 Menu Utama", `MENU_MAIN`)]
        ];
        return ctx.reply(`✅ *Berhasil!*\nStatus pekerjaan *${sd.task}* telah resmi tersimpan sebagai *${stat}*. 🎯`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(finishBtns) });
    }

    if (data === "FINISH_PHOTO_UPLOAD") {
        const session = await getSession(telegram_id);
        const sd = session.data;
        if(!sd.project_id) return ctx.reply("⚠️ *Sesi kedaluwarsa.* Ketik /start untuk mengulang.", { parse_mode: 'Markdown' });
        
        // --- Photo Rule Validation ---
        const vol = sd.quantity || 1;
        const t = sd.task || "";
        const requiredPhotos = getRequiredPhotoCount(t, vol);
        
        const photos = sd.photos || [];
        if (photos.length < requiredPhotos) {
            const extraMsg = getPhotoRequirementMessage(t);
            return ctx.reply(`⚠️ *PERINGATAN STANDAR KUALITAS* ⚠️\n\nUntuk tugas *${t}* ber-volume *${vol}*, Anda wajib mengunggah minimum *${requiredPhotos} bukti foto* guna lolos dari kriteria validasi PT Sachi.${extraMsg}\nSaat ini foto yang ter-unggah baru *${photos.length}* lembar.\n\n📸 *Mohon lengkapi sisanya sekarang juga!*`, { parse_mode: 'Markdown' });
        }
        // -----------------------------

        ctx.editMessageText("⏳ *Mengunggah Laporan...*\nMenyatukan data dan foto ke dalam sistem pusat PT Sachi. Mohon tunggu sebentar... ☁️", { parse_mode: 'Markdown' });

        const photoUrls = photos.map((p: any) => p.r2_url);

        const { data: laporanData, error } = await supabase.from('laporan_kerja').insert({
            telegram_id: telegram_id,
            project_id: sd.project_id,
            boq_id: sd.boq_id,
            task_category: sd.category,
            task_name: sd.task + (sd.designator ? ` (${sd.designator})` : ''),
            quantity: vol,
            notes: "Dilaporkan via Bot",
            photo_urls: photoUrls,
            status: "submitted"
        }).select().single();

        if (error) {
            console.error(error);
            return ctx.reply(`❌ *Gagal Menyimpan Data!*\n\n${error.message}`);
        }

        // Insert ke tabel evidences
        if (laporanData && photos.length > 0) {
            const evData = photos.map((p: any) => ({
                laporan_id: laporanData.id,
                project_id: sd.project_id,
                category: sd.category,
                telegram_file_id: p.file_id,
                r2_url: p.r2_url
            }));
            await supabase.from('evidences').insert(evData);
            
            // Trigger update MediaGroup ke Discussion Group
            await updateCategoryProgress(sd.project_id, sd.category);
        }

        await clearSession(telegram_id);
        const finishBtns = [
            [Markup.button.callback("📑 Kembali ke Laporan Project", `LAPPROG_${sd.project_id}`)],
            [Markup.button.callback("🏠 Menu Utama", `MENU_MAIN`)]
        ];
        return ctx.reply("✅ *LAPORAN SUKSES DITERIMA!* 🎉\n\nData progres dan bukti foto evidens Anda sudah masuk dengan rapi ke Server. Terima kasih atas kerja kerasnya di lapangan! 💪", { parse_mode: 'Markdown', ...Markup.inlineKeyboard(finishBtns) });
    }

    // Status / Recap logic
    if(data.startsWith("STATPROJ_")) {
        const projId = data.replace("STATPROJ_", "");
        
        const { data: p } = await supabase.from('master_project').select('*').eq('id', projId).single();
        if(!p) return ctx.reply("⚠️ *Data Tidak Ditemukan*\nID Project tersebut sudah tidak valid atau telah dihapus.", { parse_mode: 'Markdown' });

        const { data: laps } = await supabase.from('laporan_kerja').select('*').eq('project_id', projId);

        let statusText = `📊 *REKAPITULASI PROGRES PROJECT*\n\n📌 *Tahap Persiapan:*\n`;
        const cPersiapan = laps?.filter(x=>x.task_category==='Persiapan')||[];
        statusText += `  • Aanwijzing : ${cPersiapan.some(x=>x.task_name==='Aanwijzing')?'✅ Selesai':'❌ Belum'}\n`;
        statusText += `  • Perijinan : ${cPersiapan.some(x=>x.task_name==='Perijinan')?'✅ Selesai':'❌ Belum'}\n\n`;

        statusText += `🏗️ *Tahap Instalasi (Akumulasi Volume):*\n`;
        const cInstalasi = laps?.filter(x=>x.task_category==='Instalasi')||[];
        const grouped = cInstalasi.reduce((acc, obj) => {
            acc[obj.task_name] = (acc[obj.task_name] || 0) + parseFloat(obj.quantity||0);
            return acc;
        }, {} as any);

        const keys = Object.keys(grouped);
        keys.forEach(k => {
            statusText += `  • ${k} : *${grouped[k]}*\n`;
        });
        if(keys.length === 0) statusText += "  _(Belum ada progres instalasi yang tercatat)_\n";

        return ctx.editMessageText(statusText, { 
            parse_mode: 'Markdown', 
            ...Markup.inlineKeyboard([
               [Markup.button.callback("📄 Generate Report DOCX", `EXPORTDOC_${projId}`)],
               [Markup.button.callback("🔙 Kembali", `SELPROJ_${projId}`)]
            ]) 
        }).catch(()=> ctx.reply(statusText, { parse_mode:'Markdown'}));
    }

    if (data.startsWith("EXPORTDOC_")) {
        const projId = data.replace("EXPORTDOC_", "");
        ctx.reply("⏳ *Sedang me-render dokumen DOCX...* Mohon tunggu beberapa saat karena bot perlu menarik foto-foto evidens.", { parse_mode: 'Markdown' });
        
        try {
            const buffer = await generateDocxReport(projId);
            await ctx.telegram.sendDocument(ctx.chat!.id, { source: buffer, filename: `Report_PT_SACHI_${projId.slice(0,5)}.docx` }, { caption: "✅ *Report DOCX Berhasil Dibuat!*", parse_mode: 'Markdown' });
        } catch (e: any) {
            console.error(e);
            ctx.reply(`❌ *Gagal membuat DOCX:*\n${e.message}`, { parse_mode: 'Markdown' });
        }
        return;
    }
});

// --- TEXT MESSAGES FOR STATES ---
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const telegram_id = ctx.from.id;
    const session = await getSession(telegram_id);

    if (session.current_step === 'IDLE') {
        return;
    }

    // 1. NEW PROJECT
    if (session.current_step.startsWith("NEW_PROJ_")) {
        const pd = session.data.projectDraft;
        const step = session.current_step;

        if (step === 'NEW_PROJ_MITRA') {
            await updateSession(telegram_id, 'NEW_PROJ_USER', { projectDraft: { ...pd, mitra: text } });
            return ctx.reply("2️⃣ Silakan masukkan *Nama User*: 👤", { parse_mode: 'Markdown' });
        }
        if (step === 'NEW_PROJ_USER') {
            await updateSession(telegram_id, 'NEW_PROJ_SPMK', { projectDraft: { ...pd, user: text } });
            return ctx.reply("3️⃣ Selanjutnya, masukkan *No SPMK*: 📄", { parse_mode: 'Markdown' });
        }
        if (step === 'NEW_PROJ_SPMK') {
            await updateSession(telegram_id, 'NEW_PROJ_NAMA', { projectDraft: { ...pd, spmk: text } });
            return ctx.reply("4️⃣ Mari beri nama pada *Project* ini: 🏢", { parse_mode: 'Markdown' });
        }
        if (step === 'NEW_PROJ_NAMA') {
            await updateSession(telegram_id, 'NEW_PROJ_LOKASI', { projectDraft: { ...pd, nama_project: text } });
            return ctx.reply("5️⃣ Tentukan juga *Lokasi* jalurnya: 📍", { parse_mode: 'Markdown' });
        }
        if (step === 'NEW_PROJ_LOKASI') {
            await updateSession(telegram_id, 'NEW_PROJ_KORDINAT', { projectDraft: { ...pd, lokasi: text } });
            return ctx.reply("6️⃣ Terakhir, sertakan *Koordinat* (Ketik '-' jika belum siap): 🌍", { parse_mode: 'Markdown' });
        }
        if (step === 'NEW_PROJ_KORDINAT') {
            const finalPd = { ...pd, kordinat: text };
            await updateSession(telegram_id, 'NEW_PROJ_CONFIRM', { projectDraft: finalPd });
            
            const recap = `📋 *KONFIRMASI DATA PROJECT BARU*\n\n`+
                `🏢 *Nama Mitra*: ${finalPd.mitra}\n`+
                `👤 *Nama User*: ${finalPd.user}\n`+
                `📄 *No SPMK*: ${finalPd.spmk}\n`+
                `🏗️ *Nama Project*: ${finalPd.nama_project}\n`+
                `📍 *Lokasi*: ${finalPd.lokasi}\n`+
                `🌍 *Koordinat*: ${finalPd.kordinat}\n\n`+
                `Apakah data ini sudah benar dan siap disimpan? 💾`;

            return ctx.reply(recap, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("✅ SIMPAN KE DATABASE", "CONFIRM_SAVE_PROJ")],
                    [Markup.button.callback("❌ BATAL", "CONFIRM_CANCEL_PROJ")]
                ])
            });
        }
    }

    // 2. LAPORAN PROGRES TEXT INPUTS
    // ============================================ DB SEARCH ==================
    if (session.current_step === "LAP_WAIT_SEARCH_BOQ" || session.current_step === "LAP_WAIT_SEARCH_MAT") {
        const isBoq = session.current_step === "LAP_WAIT_SEARCH_BOQ";
        
        let dbData = [];
        if (isBoq) {
            const { data } = await supabase.from('master_boq').select('id, task_name').ilike('task_name', `%${text}%`).limit(8);
            dbData = data || [];
        } else {
            const { data } = await supabase.from('master_material').select('id, material_name').ilike('material_name', `%${text}%`).limit(8);
            dbData = data || [];
        }

        const buttons = dbData.map(item => [
            Markup.button.callback(
                isBoq ? (item as any).task_name : (item as any).material_name,
                isBoq ? `SELDB_BOQ_${item.id}` : `SELDB_MAT_${item.id}`
            )
        ]);

        // Beri opsi manual jika tdk ketemu
        buttons.push([Markup.button.callback("⚠️ Tidak Ada di Daftar (Ketik Manual)", `SELDB_${isBoq ? 'BOQ' : 'MAT'}_MANUAL`)]);

        return ctx.reply(
            dbData.length > 0 ? `🔎 *Hasil Pencarian: '${text}'*\nKami menemukan beberapa item. Silakan pilih opsi yang paling akurat:` : `⚠️ *Pencarian Nihil*\nKami tidak menemukan item bernama '${text}'. Silakan ketik ulang atau pilih Input Manual. 💡`, 
            { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
        );
    }

    if (session.current_step === "LAP_WAIT_MANUAL_INPUT_NAME") {
        await updateSession(telegram_id, 'LAP_WAIT_QTY', { ...session.data, designator: text });
        return ctx.reply(`📝 *Input Manual Diterima:*\nItem tercatat sebagai: *${text}*\n\n✏️ *Pengisian Volume:*\nBerapa angka akumulasi volume yang telah dikerjakan? (Hanya angka, contoh: 12.5):`, { parse_mode: 'Markdown' });
    }
    // =========================================================================

    if (session.current_step === "LAP_WAIT_QTY") {
        const vol = parseFloat(text.replace(',', '.'));
        if (isNaN(vol)) return ctx.reply("⚠️ *Format Tidak Sesuai*\nMohon pastikan Anda HANYA menggunakan karakter angka (contoh: 10 atau 2.5). Silakan ulangi:", { parse_mode: 'Markdown' });
        
        await updateSession(telegram_id, 'LAP_WAIT_PHOTO', { ...session.data, quantity: vol, photos: [] });

        const requiredPhotos = getRequiredPhotoCount(session.data.task || '', vol);

        let ruleInfo = getPhotoRequirementMessage(session.data.task || '').replace(/[_"]/g, '');
        if (ruleInfo.trim() !== '') {
            ruleInfo = `\n📋 *Syarat Khusus:*\n${ruleInfo}\n`;
        } else {
            ruleInfo = "\n\n";
        }

        return ctx.reply(
            `🚀 *LANGKAH FINAL: UNGGAH BUKTI FOTO* 📸${ruleInfo}`+
            `⚠️ _Sistem otomatis menahan penyelesaian sampai syarat kuota foto terpenuhi._\n\n`+
            `👉 *Target Minimal Foto Valid: ${requiredPhotos} Lembar*\n\nSilakan kirimkan fotonya satu demi satu ke *Chatroom* secara utuh...`,
            { parse_mode: 'Markdown' }
        );
    }

});

// --- PHOTO UPLOAD ---
bot.on('photo', async (ctx) => {
    const telegram_id = ctx.from.id;
    const session = await getSession(telegram_id);

    if (ctx.message.caption && (ctx.message.caption.toLowerCase().includes('/batal') || ctx.message.caption.toLowerCase().includes('/cancel'))) {
        await clearSession(telegram_id);
        return ctx.reply("❌ *Proses Dibatalkan!*\n\nSeluruh data sesi Anda telah berhasil dibersihkan. Silakan ketik /start untuk kembali ke layar utama. 🔄", { parse_mode: 'Markdown' });
    }

    if (session.current_step !== 'LAP_WAIT_PHOTO') {
        return ctx.reply("⚠️ *Konteks Tidak Sesuai*\nBot mendeteksi upload foto, namun pada riwayat sesi Anda belum ada prosedur pengumpulan bukti. Silakan mulai navigasi secara normal lewat ketik /start. 🔄", { parse_mode: 'Markdown' });
    }

    try {
        const photo = ctx.message.photo.pop();
        if (!photo) return;
        
        // Let user know it's queued
        const initMsg = await ctx.reply("⏳ _Sedang Mengenkripsi dan Memproses Foto ke Server..._ ☁️", { parse_mode: "Markdown" });

        const fileLink = await ctx.telegram.getFileLink(photo.file_id);
        const response = await fetch(fileLink.toString());
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const fileName = `${ctx.from.id}-${Date.now()}.jpg`;
        const photoUrl = await uploadToR2(buffer, fileName);

        // Fetch fresh session to ensure user didn't cancel while photo was buffering/uploading
        const freshSession = await getSession(telegram_id);
        if (freshSession.current_step !== 'LAP_WAIT_PHOTO') {
            await ctx.telegram.editMessageText(ctx.chat.id, initMsg.message_id, undefined, "❌ *Upload Dibatalkan.*\nSesi Anda sudah ditutup sebelum foto ini selesai diproses ke Server.", { parse_mode: "Markdown" });
            return;
        }

        const photos = freshSession.data.photos || [];
        photos.push({ file_id: photo.file_id, r2_url: photoUrl });
        await updateSession(telegram_id, 'LAP_WAIT_PHOTO', { ...freshSession.data, photos });

        const vol = freshSession.data.quantity || 1;
        const requiredPhotos = getRequiredPhotoCount(freshSession.data.task || '', vol);

        if (photos.length >= requiredPhotos) {
            await ctx.telegram.editMessageText(
                ctx.chat.id, 
                initMsg.message_id, 
                undefined, 
                `✅ *Bukti Foto Terekam (${photos.length}/${requiredPhotos})* 🖼️\n\nSelamat! Target minimum batas dokumentasi telah tercukupi.\n\nKlik tombol *[✅ SELESAIKAN LAPORAN]* di bawah ini untuk merangkum datanya, atau kirim lagi sisa potret lainnya jika memang masih ada.`, 
                { 
                    parse_mode: "Markdown",
                    ...Markup.inlineKeyboard([[Markup.button.callback("✅ SELESAIKAN LAPORAN BUKTI", `FINISH_PHOTO_UPLOAD`)]])
                }
            );
        } else {
            const remains = requiredPhotos - photos.length;
            await ctx.telegram.editMessageText(
                ctx.chat.id, 
                initMsg.message_id, 
                undefined, 
                `📈 *Progres Foto Diterima (${photos.length}/${requiredPhotos})* 🖼️\n\nKalkulasi sistem masih memerlukan tambahan *${remains}* lembar foto lagi untuk mencukupi syarat.\n\nSilakan luncurkan foto berikutnya... 🚀`, 
                { parse_mode: "Markdown" }
            );
        }

    } catch (e: any) {
        console.error("Upload Error:", e);
        await ctx.reply(`❌ *Terjadi kesalahan* saat mengunggah foto.\n\n${e.message}`, { parse_mode: "Markdown" });
    }
});

// --- LOGIC FUNCTIONS ---
async function updateCategoryProgress(projectId: string, category: string) {
    if (!MAIN_CHANNEL_ID) return;
    try {
        const { data: p } = await supabase.from('master_project').select('*').eq('id', projectId).single();
        if (!p) return;
        
        let main_msg_id = p.main_message_id;
        let discussion_chat_id = p.discussion_chat_id;
        let category_msgs = p.category_messages || {};

        // 1. Dapatkan Discussion Chat ID jika belum ada
        if (!discussion_chat_id) {
            try {
                const chatInfo = await bot.telegram.getChat(MAIN_CHANNEL_ID) as any;
                if (chatInfo.linked_chat_id) {
                     discussion_chat_id = chatInfo.linked_chat_id;
                     await supabase.from('master_project').update({ discussion_chat_id }).eq('id', projectId);
                }
            } catch(e) { console.error("Linked chat info error:", e); }
        }

        // 2. Jika project lama (belum ter-forward) atau dipaksa refresh
        if (!main_msg_id || (!discussion_chat_id && p.main_message_id) || category === "REFRESH_ONLY") {
            if (p.main_message_id) {
                try { await bot.telegram.deleteMessage(MAIN_CHANNEL_ID, p.main_message_id); } catch(e) {}
            }
            const msg = await bot.telegram.sendMessage(
                MAIN_CHANNEL_ID,
                `🏢 *PROJECT*: ${p.project_name || '-'}\n📄 *SPMK*: ${p.no_spmk || '-'}\n📍 *Lokasi*: ${p.lokasi || '-'}\n\n_Seluruh dokumentasi progres akan kami kumpulkan di bawah pesan ini._`,
                { parse_mode: 'Markdown' }
            );
            main_msg_id = msg.message_id;
            await supabase.from('master_project').update({ main_message_id: main_msg_id }).eq('id', projectId);
            
            // Beri jeda agar Telegram sempat melakukan forward ke group diskusi
            await new Promise(r => setTimeout(r, 2000));
        }

        if (!discussion_chat_id || category === "REFRESH_ONLY") return;

        // 3. Hapus pesan lama kategori ini
        const oldMsgIds = category_msgs[category] || [];
        for (const msgId of oldMsgIds) {
            try { await bot.telegram.deleteMessage(discussion_chat_id, msgId); } catch(e) {}
        }

        // 4. Kirim Album Baru
        const { data: evidences } = await supabase.from('evidences').select('*').eq('project_id', projectId).eq('category', category);
        if (!evidences || evidences.length === 0) return;

        const chunks = lodash.chunk(evidences, 10);
        let newMessageIds: number[] = [];
        
        for (const [idx, chunk] of chunks.entries()) {
            const mediaGroup = chunk.map((ev: any, i: number) => ({
                type: 'photo' as const,
                media: ev.telegram_file_id,
                caption: (idx === 0 && i === 0) ? `📁 *Kategori:* ${category}\n_Total Eviden:_ ${evidences.length} Foto` : undefined,
                parse_mode: 'Markdown' as const
            }));
            
            try {
                // Gunakan group_message_id agar muncul sebagai komentar di channel post
                const extra: any = { parse_mode: 'Markdown' };
                if (p.group_message_id) {
                    extra.reply_to_message_id = p.group_message_id;
                }
                
                const msgs = await bot.telegram.sendMediaGroup(discussion_chat_id, mediaGroup, extra);
                msgs.forEach((m: any) => newMessageIds.push(m.message_id));
            } catch(e) {
                console.error("Gagal kirim MediaGroup ke discussion", e);
                // Fallback: Kirim tanpa reply jika gagal
                try {
                    const msgs = await bot.telegram.sendMediaGroup(discussion_chat_id, mediaGroup);
                    msgs.forEach((m: any) => newMessageIds.push(m.message_id));
                } catch(e2) {}
            }
        }

        if (newMessageIds.length > 0) {
            category_msgs[category] = newMessageIds;
            await supabase.from('master_project').update({ category_messages: category_msgs }).eq('id', projectId);
        }
    } catch(e) {
        console.error("updateCategoryProgress error:", e);
    }
}

async function generateDocxReport(projectId: string): Promise<Buffer> {
    const { data: p } = await supabase.from('master_project').select('*').eq('id', projectId).single();
    const { data: evidences } = await supabase.from('evidences').select('*').eq('project_id', projectId);
    
    if (!p) throw new Error("Project not found");

    const sections: any[] = [];
    const grouped = lodash.groupBy(evidences || [], 'category');

    for (const category of Object.keys(grouped)) {
        const catEvidences = grouped[category];
        const chunks = lodash.chunk(catEvidences, 4);

        for (const [chunkIdx, chunk] of chunks.entries()) {
            const pageChildren: any[] = [];

            // 1. JUDUL (Centered, Underlined, Bold)
            pageChildren.push(new Paragraph({
                children: [
                    new TextRun({
                        text: "JUDUL",
                        bold: true,
                        underline: { type: UnderlineType.SINGLE },
                        size: 28,
                    }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
            }));

            // 2. Info Table (With Top & Bottom borders)
            const headerTable = new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                    bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                    insideHorizontal: { style: BorderStyle.NONE },
                    insideVertical: { style: BorderStyle.NONE },
                },
                rows: [
                    new TableRow({ children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Proyek", bold: true })] })], width: { size: 25, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph(`: ${p.project_name || '-'}`)] }),
                    ]}),
                    new TableRow({ children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "No Kontrak", bold: true })] })] }),
                        new TableCell({ children: [new Paragraph(`: Sachi21032026`)] }),
                    ]}),
                    new TableRow({ children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Nomor PO", bold: true })] })] }),
                        new TableCell({ children: [new Paragraph(`: Sachi21032026`)] }),
                    ]}),
                    new TableRow({ children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Lokasi", bold: true })] })] }),
                        new TableCell({ children: [new Paragraph(`: ${p.lokasi || '-'}`)] }),
                    ]}),
                    new TableRow({ children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Site Operation", bold: true })] })] }),
                        new TableCell({ children: [new Paragraph(`: Sachi21032026`)] }),
                    ]}),
                    new TableRow({ children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Pelaksana", bold: true })] })] }),
                        new TableCell({ children: [new Paragraph(`: ${p.nama_mitra || '-'}`)] }),
                    ]}),
                ],
            });
            pageChildren.push(headerTable);
            pageChildren.push(new Paragraph({ text: "", spacing: { after: 300 } }));

            // 3. Category Title
            pageChildren.push(new Paragraph({
                children: [new TextRun({ text: category.toUpperCase(), bold: true, size: 24 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 }
            }));

            // 4. Evidence Photo Grid (2x2 Portrait Boxes)
            const imagesInChunk: any[] = [];
            for (const ev of chunk) {
                if (ev.r2_url) {
                    try {
                        const res = await fetch(ev.r2_url);
                        const buffer = Buffer.from(await res.arrayBuffer());
                        imagesInChunk.push(new ImageRun({
                            data: buffer,
                            transformation: { width: 280, height: 380 }, // Taller boxes
                            type: 'jpg'
                        }));
                    } catch(e) { imagesInChunk.push(null); }
                } else { imagesInChunk.push(null); }
            }

            const createPhotoCell = (imgRun: any) => new TableCell({
                children: [
                    new Paragraph({
                        children: imgRun ? [imgRun] : [new TextRun({ text: "LETAK FOTO", size: 16 })],
                        alignment: AlignmentType.CENTER,
                    })
                ],
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 2 },
                    bottom: { style: BorderStyle.SINGLE, size: 2 },
                    left: { style: BorderStyle.SINGLE, size: 2 },
                    right: { style: BorderStyle.SINGLE, size: 2 },
                },
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                verticalAlign: VerticalAlign.CENTER
            });

            const photoRows = [
                new TableRow({ children: [createPhotoCell(imagesInChunk[0]), createPhotoCell(imagesInChunk[1])] }),
                new TableRow({ children: [
                    new TableCell({ children: [new Paragraph("")], borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } }), 
                    new TableCell({ children: [new Paragraph("")], borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } })
                ] }), // Spacer
                new TableRow({ children: [createPhotoCell(imagesInChunk[2]), createPhotoCell(imagesInChunk[3])] }),
            ];

            const photoTable = new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: { insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }, top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                rows: photoRows
            });

            pageChildren.push(photoTable);
            sections.push({ children: pageChildren, properties: { type: SectionType.NEXT_PAGE } });
        }
    }

    if (sections.length === 0) {
        sections.push({ children: [new Paragraph("Belum ada evidens foto.")] });
    }

    const doc = new Document({ sections });
    return await Packer.toBuffer(doc);
}

// Webhook Router handling
export async function POST(req: NextRequest) {
    try {
        const secret = req.headers.get("x-telegram-bot-api-secret-token");
        if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();

        // --- Logic: Tangkap pesan yang diforward otomatis dari channel ke group ---
        if (body.message?.forward_from_chat?.id?.toString() === MAIN_CHANNEL_ID) {
            const channelMsgId = body.message.forward_from_message_id;
            const groupMsgId = body.message.message_id;
            const discussionChatId = body.message.chat.id;

            // Update database agar project ini tahu ID pesan mana yang harus dibalas di group agar jadi comment
            await supabase.from('master_project')
                .update({ 
                    group_message_id: groupMsgId,
                    discussion_chat_id: discussionChatId 
                })
                .eq('main_message_id', channelMsgId);
        }

        await bot.handleUpdate(body);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Webhook Handler Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
