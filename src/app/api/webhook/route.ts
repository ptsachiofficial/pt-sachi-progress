import { NextRequest, NextResponse } from "next/server";
import { Telegraf, Markup } from "telegraf";
import { supabase } from "@/lib/supabase";
import { uploadToR2 } from "@/lib/r2";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "");

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
    await ctx.reply("❌ *Semua proses telah dibatalkan!*\n\nData sesi Anda sudah dibersihkan. Silakan ketik /start untuk kembali ke menu utama.", { parse_mode: 'Markdown' });
});

// --- CALLBACK QUERIES ---
bot.on("callback_query", async (ctx) => {
    const cbQuery = ctx.callbackQuery as any;
    const data = cbQuery.data;
    const telegram_id = ctx.from.id;

    try { await ctx.answerCbQuery(); } catch (e) { }

    if (data === "MENU_MAIN") {
        await clearSession(telegram_id);
        return ctx.editMessageText("Pilih menu di bawah ini:", MAIN_MENU);
    }

    // ============================================
    // 1. NEW PROJECT FLOW
    // ============================================
    if (data === "MENU_NEW_PROJ") {
        await updateSession(telegram_id, 'NEW_PROJ_MITRA', { projectDraft: {} });
        return ctx.editMessageText(
            "📝 *FORM PENGISIAN PROJECT BARU*\n\n1. Masukkan *Nama Mitra*:",
            { parse_mode: 'Markdown' }
        );
    }

    if (data === "CONFIRM_SAVE_PROJ") {
        const session = await getSession(telegram_id);
        const p = session.data.projectDraft;
        if (!p) return ctx.reply("Sesi kadaluarsa. Silakan ulangi /start.");
        
        ctx.editMessageText("⏳ Menyimpan project baru...");
        const { error } = await supabase.from('master_project').insert({
            nama_mitra: p.mitra,
            nama_user: p.user,
            no_spmk: p.spmk,
            project_name: p.nama_project,
            lokasi: p.lokasi,
            kordinat: p.kordinat
        });

        if (error) {
            console.error(error);
            return ctx.reply("❌ Gagal menyimpan project.");
        }
        await clearSession(telegram_id);
        return ctx.reply("✅ Project berhasil disimpan! Silakan klik /start untuk memulai laporan.");
    }

    if (data === "CONFIRM_CANCEL_PROJ") {
        await clearSession(telegram_id);
        return ctx.editMessageText("❌ Penambahan project dibatalkan.\n\nPilih menu:", MAIN_MENU);
    }

    // ============================================
    // 2. LAPORAN PROJECT FLOW
    // ============================================
    if (data === "MENU_LAP_PROJ") {
        const { data: projects } = await supabase.from('master_project').select('id, project_name').order('created_at', { ascending: false }).limit(10);
        
        if (!projects || projects.length === 0) {
            return ctx.reply("Belum ada data project di database. Buat project baru terlebih dahulu.");
        }

        const buttons = projects.map(p => [Markup.button.callback(p.project_name, `SELPROJ_${p.id}`)]);
        buttons.push([Markup.button.callback("🔙 Batal/Kembali", "MENU_MAIN")]);
        
        return ctx.editMessageText(
            "📋 *List Data Project Tersimpan*\n\nSilakan pilih project:",
            { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
        ).catch(() => ctx.reply("Silakan pilih Project:", Markup.inlineKeyboard(buttons)));
    }

    if (data.startsWith("SELPROJ_")) {
        const projId = data.replace("SELPROJ_", "");
        const session = await getSession(telegram_id);

        const { data: p } = await supabase.from('master_project').select('*').eq('id', projId).single();
        if(!p) return;

        const detail = `*DETAIL PO*\n`+
            `No SPMK: ${p.no_spmk || '-'}\n`+
            `Nama Project: ${p.project_name || '-'}\n`+
            `Lokasi: ${p.lokasi || '-'}\n`+
            `Kordinat: ${p.kordinat || '-'}\n`;

        const buttons = [
            [Markup.button.callback("📝 Laporan Progres", `LAPPROG_${projId}`)],
            [Markup.button.callback("📊 STATUS", `STATPROJ_${projId}`)],
            [Markup.button.callback("🔙 Batal/kembali", "MENU_LAP_PROJ")]
        ];

        return ctx.editMessageText(detail, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) })
            .catch(()=>ctx.reply(detail, { parse_mode:'Markdown', ...Markup.inlineKeyboard(buttons) }));
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
            "Pilih Kategori Pekerjaan:",
            { ...Markup.inlineKeyboard(buttons) }
        ).catch(() => ctx.reply("Pilih Kategori Pekerjaan:", Markup.inlineKeyboard(buttons)));
    }

    // Laporan Progres - Pilih Sub Kategori/Task
    if (data.startsWith("LAPCAT_")) {
        const cat = data.replace("LAPCAT_", "");
        const session = await getSession(telegram_id);
        const projId = session.data.project_id;
        if(!projId) return ctx.reply("Sesi hilang. Ketik /start");

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
            `Kategori: *${catName}*\nPilih pekerjaan:`,
            { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
        ).catch(() => ctx.reply(`Kategori: *${catName}*\nPilih pekerjaan:`, Markup.inlineKeyboard(buttons)));
    }

    if (data.startsWith("TASKSEL_")) {
        const session = await getSession(telegram_id);
        const parts = data.replace("TASKSEL_", "").split("_");
        const idx = parseInt(parts[2]);
        const taskName = session.data.tasks[idx];

        if (session.data.category === "Persiapan") {
            await updateSession(telegram_id, 'LAP_WAIT_PERSIAPAN_STAT', { ...session.data, task: taskName });
            return ctx.editMessageText(
                `Kategori: *Persiapan*\nTask: *${taskName}*\n\nPilih status penyelesaian:`,
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
                `Task: *${taskName}*\n\n🔍 Silakan ketik sebagian atau keseluruhan *Nama Material* yang akan diinput:`,
                { parse_mode: 'Markdown' }
            );
        } else if (session.data.category === "Instalasi") {
            await updateSession(telegram_id, 'LAP_WAIT_SEARCH_BOQ', { ...session.data, task: taskName });
            return ctx.editMessageText(
                `Task: *${taskName}*\n\n🔍 Silakan ketik kata kunci *Designator Instalasi* (contoh: tiang, galian, rodding, dsb):`,
                { parse_mode: 'Markdown' }
            );
        }

        // Jika selain itu (Finish, Closing), langsung ke volume. (Karena gak ada BOQ khusus)
        await updateSession(telegram_id, 'LAP_WAIT_QTY', { ...session.data, task: taskName });
        return ctx.editMessageText(
            `Task: *${taskName}*\n✏️ Masukkan *Volume/Jumlah* kegiatan berlalu berupa angka:`,
            { parse_mode: 'Markdown' }
        ).catch(() => ctx.reply(`Task: *${taskName}*\n✏️ Masukkan *Volume/Jumlah* kegiatan berlalu berupa angka:`));
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
            return ctx.editMessageText("📝 Silakan ketik *Nama/Designator* secara manual:", { parse_mode: 'Markdown' });
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
                `✔️ Anda memilih: *${designatorName}*\n\n✏️ Sekarang masukkan *Volume/Jumlah* berupa angka:`,
                { parse_mode: 'Markdown' }
            );
        }
    }

    if (data.startsWith("PERSIAPAN_STAT_")) {
        const stat = data.replace("PERSIAPAN_STAT_", ""); // DONE or NOK
        const session = await getSession(telegram_id);
        const sd = session.data;
        if(!sd.project_id) return ctx.reply("Sesi hilang. Ketik /start");
        
        ctx.editMessageText(`⏳ Menyimpan status ${stat} untuk ${sd.task}...`);

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
            return ctx.reply(`❌ Gagal menyimpan laporan ke database.\nErr: ${error.message}`);
        }

        await clearSession(telegram_id);
        const finishBtns = [
            [Markup.button.callback("📑 Kembali ke Laporan Project", `LAPPROG_${sd.project_id}`)],
            [Markup.button.callback("🏠 Menu Utama", `MENU_MAIN`)]
        ];
        return ctx.reply(`✅ *Status ${sd.task} berhasil disimpan sebagai ${stat}!*`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(finishBtns) });
    }

    if (data === "FINISH_PHOTO_UPLOAD") {
        const session = await getSession(telegram_id);
        const sd = session.data;
        if(!sd.project_id) return ctx.reply("Sesi hilang. Ketik /start");
        
        // --- Photo Rule Validation ---
        let requiredPhotos = 1;
        const vol = sd.quantity || 1;
        const t = sd.task || "";
        
        if (t.includes('GALIAN') || t.includes('ROJOK')) requiredPhotos = Math.max(1, Math.ceil(vol / 20));
        else if (t.includes('SUBDUCT') || t.includes('HDPE') || t.includes('PEMASANGAN ODC') || t.includes('CLOSURE') || t.includes('PERAPIHAN')) requiredPhotos = 4;
        else if (t.includes('HANDHOLE') || t.includes('TIANG')) requiredPhotos = vol * 4;
        else if (t.includes('FEEDER') || t.includes('DISTRIBUSI')) requiredPhotos = 2 + Math.ceil(vol / 50);
        else if (t.includes('PEMASANGAN ODP')) requiredPhotos = vol * 20;
        else if (t.includes('OTB')) requiredPhotos = 8;
        else if (t.includes('TERMINASI ODC') || t.includes('TERMINASI CLOSURE')) requiredPhotos = Math.max(1, Math.ceil(vol / 12) * 2);
        else if (t.includes('TERMINASI ODP')) requiredPhotos = vol * 2;
        
        const photos = sd.photos || [];
        if (photos.length < requiredPhotos) {
            return ctx.reply(`⚠️ Peringatan: Untuk pekerjaan *${t}* dengan volume *${vol}*, Anda DIWAJIBKAN mengunggah minimal *${requiredPhotos} foto* sesuai aturan.\n\nAnda baru mengunggah *${photos.length} foto*. Silakan kirimkan foto tambahannya sekarang.`, { parse_mode: 'Markdown' });
        }
        // -----------------------------

        ctx.editMessageText("⏳ Menyimpan semua foto laporan...");

        const { error } = await supabase.from('laporan_kerja').insert({
            telegram_id: telegram_id,
            project_id: sd.project_id,
            boq_id: sd.boq_id,
            task_category: sd.category,
            task_name: sd.task + (sd.designator ? ` (${sd.designator})` : ''),
            quantity: vol,
            notes: "Dilaporkan via Bot", // Bisa dikembangkan klo butuh notes manual
            photo_urls: photos,
            status: "submitted"
        });

        if (error) {
            console.error(error);
            return ctx.reply(`❌ Gagal menyimpan laporan ke database.\nErr: ${error.message}`);
        }

        await clearSession(telegram_id);
        const finishBtns = [
            [Markup.button.callback("📑 Kembali ke Laporan Project", `LAPPROG_${sd.project_id}`)],
            [Markup.button.callback("🏠 Menu Utama", `MENU_MAIN`)]
        ];
        return ctx.reply("✅ *Laporan Berhasil Disimpan!*", { parse_mode: 'Markdown', ...Markup.inlineKeyboard(finishBtns) });
    }

    // Status / Recap logic
    if(data.startsWith("STATPROJ_")) {
        const projId = data.replace("STATPROJ_", "");
        
        const { data: p } = await supabase.from('master_project').select('*').eq('id', projId).single();
        if(!p) return ctx.reply("Project tidak ditemukan.");

        const { data: laps } = await supabase.from('laporan_kerja').select('*').eq('project_id', projId);

        let statusText = `*STATUS PROSES*:\n\n*Persiapan:*\n`;
        const cPersiapan = laps?.filter(x=>x.task_category==='Persiapan')||[];
        statusText += `a. Aanwijzing: ${cPersiapan.some(x=>x.task_name==='Aanwijzing')?'✅':'❌'}\n`;
        statusText += `b. Perijinan: ${cPersiapan.some(x=>x.task_name==='Perijinan')?'✅':'❌'}\n\n`;

        statusText += `*Instalasi (Total Ter-record):*\n`;
        const cInstalasi = laps?.filter(x=>x.task_category==='Instalasi')||[];
        const grouped = cInstalasi.reduce((acc, obj) => {
            acc[obj.task_name] = (acc[obj.task_name] || 0) + parseFloat(obj.quantity||0);
            return acc;
        }, {} as any);

        Object.keys(grouped).forEach(k => {
            statusText += `- ${k}: ${grouped[k]}\n`;
        });
        if(Object.keys(grouped).length === 0) statusText += "Belum ada laporan instalasi.\n";

        return ctx.editMessageText(statusText, { 
            parse_mode: 'Markdown', 
            ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Kembali", `SELPROJ_${projId}`)]]) 
        }).catch(()=> ctx.reply(statusText, { parse_mode:'Markdown'}));
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
            return ctx.reply("2. Masukkan *Nama User*:", { parse_mode: 'Markdown' });
        }
        if (step === 'NEW_PROJ_USER') {
            await updateSession(telegram_id, 'NEW_PROJ_SPMK', { projectDraft: { ...pd, user: text } });
            return ctx.reply("3. Masukkan *No SPMK*:", { parse_mode: 'Markdown' });
        }
        if (step === 'NEW_PROJ_SPMK') {
            await updateSession(telegram_id, 'NEW_PROJ_NAMA', { projectDraft: { ...pd, spmk: text } });
            return ctx.reply("4. Masukkan *Nama Project*:", { parse_mode: 'Markdown' });
        }
        if (step === 'NEW_PROJ_NAMA') {
            await updateSession(telegram_id, 'NEW_PROJ_LOKASI', { projectDraft: { ...pd, nama_project: text } });
            return ctx.reply("5. Masukkan *Lokasi*:", { parse_mode: 'Markdown' });
        }
        if (step === 'NEW_PROJ_LOKASI') {
            await updateSession(telegram_id, 'NEW_PROJ_KORDINAT', { projectDraft: { ...pd, lokasi: text } });
            return ctx.reply("6. Masukkan *Kordinat* (atau ketik - jika tidak ada):", { parse_mode: 'Markdown' });
        }
        if (step === 'NEW_PROJ_KORDINAT') {
            const finalPd = { ...pd, kordinat: text };
            await updateSession(telegram_id, 'NEW_PROJ_CONFIRM', { projectDraft: finalPd });
            
            const recap = `*KONFIRMASI DATA HASIL PENGISIAN*\n\n`+
                `Nama Mitra: ${finalPd.mitra}\n`+
                `Nama User: ${finalPd.user}\n`+
                `No SPMK: ${finalPd.spmk}\n`+
                `Nama Project: ${finalPd.nama_project}\n`+
                `Lokasi: ${finalPd.lokasi}\n`+
                `Kordinat: ${finalPd.kordinat}\n\n`+
                `Simpan ke database?`;

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
                isBoq ? item.task_name : item.material_name,
                isBoq ? `SELDB_BOQ_${item.id}` : `SELDB_MAT_${item.id}`
            )
        ]);

        // Beri opsi manual jika tdk ketemu
        buttons.push([Markup.button.callback("⚠️ Tidak Ada di Daftar (Ketik Manual)", `SELDB_${isBoq ? 'BOQ' : 'MAT'}_MANUAL`)]);

        return ctx.reply(
            dbData.length > 0 ? `Ditemukan hasil dari kata kunci *'${text}'*:\nPilih yang paling sesuai:` : `Pencarian *'${text}'* tidak ditemukan.`, 
            { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
        );
    }

    if (session.current_step === "LAP_WAIT_MANUAL_INPUT_NAME") {
        await updateSession(telegram_id, 'LAP_WAIT_QTY', { ...session.data, designator: text });
        return ctx.reply(`Catatan manual: *${text}*\n\n✏️ Sematkan *Volume/Jumlah* berupa angka:`, { parse_mode: 'Markdown' });
    }
    // =========================================================================

    if (session.current_step === "LAP_WAIT_QTY") {
        const vol = parseFloat(text.replace(',', '.'));
        if (isNaN(vol)) return ctx.reply("Harap masukkan *angka* yang valid:");
        
        await updateSession(telegram_id, 'LAP_WAIT_PHOTO', { ...session.data, quantity: vol, photos: [] });

        return ctx.reply(
            `Tahap Terakhir: Unggah Foto Eviden/Laporan\n\n`+
            `📸 *Silakan kirim foto satu per satu.*\n`+
            `Jika semua foto sudah diunggah, klik tombol *[✅ Selesai Upload]* di bawah ini agar disimpan.`,
            { 
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([[Markup.button.callback("✅ Selesai Upload", `FINISH_PHOTO_UPLOAD`)]])
            }
        );
    }

});

// --- PHOTO UPLOAD ---
bot.on('photo', async (ctx) => {
    const telegram_id = ctx.from.id;
    const session = await getSession(telegram_id);

    if (session.current_step !== 'LAP_WAIT_PHOTO') {
        return ctx.reply("Foto diterima, namun Anda sedang tidak dalam status unggah foto. Ketik /start.");
    }

    try {
        const photo = ctx.message.photo.pop();
        if (!photo) return;
        
        // Let user know it's queued
        const initMsg = await ctx.reply("⏳ _Uploading..._", { parse_mode: "Markdown" });

        const fileLink = await ctx.telegram.getFileLink(photo.file_id);
        const response = await fetch(fileLink.toString());
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const fileName = `${ctx.from.id}-${Date.now()}.jpg`;
        const photoUrl = await uploadToR2(buffer, fileName);

        const photos = session.data.photos || [];
        photos.push(photoUrl);
        await updateSession(telegram_id, 'LAP_WAIT_PHOTO', { ...session.data, photos });

        await ctx.telegram.editMessageText(
            ctx.chat.id, 
            initMsg.message_id, 
            undefined, 
            `✅ *Foto ke-${photos.length} Berhasil Diunggah!*\nSilakan kirim foto tambahannya ke sini jika ada, lalu klik *Selesai*.`, 
            { 
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([[Markup.button.callback("✅ Selesai Upload Foto", `FINISH_PHOTO_UPLOAD`)]])
            }
        );

    } catch (e: any) {
        console.error("Upload Error:", e);
        await ctx.reply(`❌ *Terjadi kesalahan* saat mengunggah foto.\n\n${e.message}`, { parse_mode: "Markdown" });
    }
});

// Webhook Router handling
export async function POST(req: NextRequest) {
    try {
        const secret = req.headers.get("x-telegram-bot-api-secret-token");
        if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        await bot.handleUpdate(body);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Webhook Handler Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
