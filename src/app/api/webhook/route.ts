import { NextRequest, NextResponse } from "next/server";
import { Telegraf, Markup } from "telegraf";
import { supabase } from "@/lib/supabase";
import { uploadToR2 } from "@/lib/r2";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "");

// State Management Helpers using Supabase bot_sessions
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

// --- COMMANDS ---
bot.start(async (ctx) => {
    await clearSession(ctx.from.id);
    const welcomeText = `*Selamat Datang di Sistem Pelaporan PT Sachi* 🏢\n\n` +
        `Bot ini akan membantu Anda melaporkan bukti kerja lapangan atau manajemen material dengan cepat.\n\n` +
        `Pilih menu di bawah ini untuk memulai proses interaktif:`;

    const inlineKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback("📝 Laporan Pekerjaan (Progres)", "MENU_PROGRES")],
        [Markup.button.callback("📦 Manajemen Material (In/Out)", "MENU_MATERIAL")]
    ]);

    await ctx.reply(welcomeText, { parse_mode: 'Markdown', ...inlineKeyboard });
});

bot.command('cancel', async (ctx) => {
    await clearSession(ctx.from.id);
    await ctx.reply("❌ Proses dibatalkan. Ketik /start untuk kembali ke menu utama.");
});

// --- CALLBACK QUERIES ---
bot.on("callback_query", async (ctx) => {
    const cbQuery = ctx.callbackQuery as any;
    const data = cbQuery.data;
    const telegram_id = ctx.from.id;

    // Acknowledge the button click so loading spinner on user side stops
    try { await ctx.answerCbQuery(); } catch (e) { }

    // ---------------------------------------------
    // ----------- ALUR LAPORAN PEKERJAAN ----------
    // ---------------------------------------------
    if (data === "MENU_PROGRES") {
        const { data: projects } = await supabase.from('master_project').select('id, project_name').limit(10);

        if (!projects || projects.length === 0) {
            return ctx.reply("Belum ada data project di database. Hubungi admin.");
        }

        const buttons = projects.map(p => [Markup.button.callback(p.project_name, `PROJ_${p.id}`)]);
        await updateSession(telegram_id, 'PROG_WAIT_PROJECT', { type: 'laporan' });
        return ctx.editMessageCaption(
            "📝 *Laporan Pekerjaan*\n\nSilakan pilih Project / Lokasi pekerjaan Anda:",
            { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
        ).catch(() => ctx.reply("Silakan pilih Project dari daftar berikut:", Markup.inlineKeyboard(buttons)));
    }

    // User selected a Project for Laporan
    if (data.startsWith("PROJ_")) {
        const projId = data.replace("PROJ_", "");
        const session = await getSession(telegram_id);

        if (session.current_step === 'PROG_WAIT_PROJECT') {
            await updateSession(telegram_id, 'PROG_WAIT_SEARCH_BOQ', { ...session.data, project_id: projId });
            return ctx.reply("🔍 Ketik *Kata Kunci* dari tipe pekerjaan / designator BOQ.\n\n_Contoh ketik: tiang, atau adss, atau kabel_", { parse_mode: 'Markdown' });
        }

        if (session.current_step === 'MAT_WAIT_PROJECT') {
            await updateSession(telegram_id, 'MAT_WAIT_TYPE', { ...session.data, project_id: projId });
            return ctx.reply("Silakan pilih jenis transaksi material:", Markup.inlineKeyboard([
                [Markup.button.callback("Masuk (IN)", "MAT_TYPE_IN"), Markup.button.callback("Keluar (OUT)", "MAT_TYPE_OUT")]
            ]));
        }
    }

    // User selected BOQ for Laporan
    if (data.startsWith("BOQ_")) {
        const boqId = data.replace("BOQ_", "");
        const session = await getSession(telegram_id);
        if (session.current_step === 'PROG_WAIT_SELECT_BOQ') {
            await updateSession(telegram_id, 'PROG_WAIT_QTY', { ...session.data, boq_id: boqId });
            return ctx.reply("✏️ Masukkan *Volume/Jumlah* pekerjaan berupa angka (misalnya: 50 atau 10.5):", { parse_mode: 'Markdown' });
        }
    }

    // ---------------------------------------------
    // ----------- ALUR MANAJEMEN MATERIAL ---------
    // ---------------------------------------------
    if (data === "MENU_MATERIAL") {
        const { data: projects } = await supabase.from('master_project').select('id, project_name').limit(10);
        if (!projects || projects.length === 0) return ctx.reply("Belum ada data project di database. Hubungi admin.");

        const buttons = projects.map(p => [Markup.button.callback(p.project_name, `PROJ_${p.id}`)]);
        await updateSession(telegram_id, 'MAT_WAIT_PROJECT', { type: 'material' });

        return ctx.editMessageCaption(
            "📦 *Manajemen Material*\n\nPilih Project tujuan transaksi material ini:",
            { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
        ).catch(() => ctx.reply("Pilih Project tujuan material:", Markup.inlineKeyboard(buttons)));
    }

    if (data.startsWith("MAT_TYPE_")) {
        const ty = data.replace("MAT_TYPE_", ""); // IN or OUT
        const session = await getSession(telegram_id);
        if (session.current_step === 'MAT_WAIT_TYPE') {
            await updateSession(telegram_id, 'MAT_WAIT_SEARCH_ITEM', { ...session.data, tr_type: ty });
            return ctx.reply(`Transaksi Material ${ty}.\n🔍 Ketik *Kata Kunci* dari tipe material.\n\n_Contoh ketik: closure, pigtail, dll_`, { parse_mode: 'Markdown' });
        }
    }

    // User selected Material for Manajemen Material
    if (data.startsWith("MATITEM_")) {
        const matId = data.replace("MATITEM_", "");
        const session = await getSession(telegram_id);
        if (session.current_step === 'MAT_WAIT_SELECT_ITEM') {
            await updateSession(telegram_id, 'MAT_WAIT_QTY', { ...session.data, material_id: matId });
            return ctx.reply("✏️ Masukkan *Jumlah Barang* berupa angka:", { parse_mode: 'Markdown' });
        }
    }
    // User manually types BOQ/Material if not found
    if (data === "MANUAL_BOQ") {
        const session = await getSession(telegram_id);
        if (session.current_step === 'PROG_WAIT_SELECT_BOQ') {
            await updateSession(telegram_id, 'PROG_WAIT_MANUAL_BOQ', session.data);
            return ctx.reply("📝 Silakan ketik *Nama/Tipe Pekerjaan (BOQ)* yang dimaksud secara manual:", { parse_mode: 'Markdown' });
        }
    }

    if (data === "MANUAL_MATITEM") {
        const session = await getSession(telegram_id);
        if (session.current_step === 'MAT_WAIT_SELECT_ITEM') {
            await updateSession(telegram_id, 'MAT_WAIT_MANUAL_ITEM', session.data);
            return ctx.reply("📝 Silakan ketik *Nama Material* tersebut secara manual:", { parse_mode: 'Markdown' });
        }
    }
});

// --- TEXT MESSAGES FOR STATES ---
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const telegram_id = ctx.from.id;
    const session = await getSession(telegram_id);

    if (session.current_step === 'IDLE') {
        return ctx.reply("Tidak ada proses aktif. Ketik /start untuk membuat laporan atau /cancel untuk membatalkan sesuatu.");
    }

    // -- STATE LAPORAN PROGRES --
    if (session.current_step === 'PROG_WAIT_SEARCH_BOQ') {
        const { data: boqs } = await supabase.from('master_boq').select('id, task_name').ilike('task_name', `%${text}%`).limit(8);

        const buttons = [];
        if (boqs && boqs.length > 0) {
            boqs.forEach(b => buttons.push([Markup.button.callback(b.task_name, `BOQ_${b.id}`)]));
        }

        // Selalu berikan opsi input manual jika tidak ketemu
        buttons.push([Markup.button.callback("⚠️ Tidak Ada di Daftar (Ketik Manual)", "MANUAL_BOQ")]);

        await updateSession(telegram_id, 'PROG_WAIT_SELECT_BOQ', { ...session.data, search_term: text });

        if (!boqs || boqs.length === 0) {
            return ctx.reply(`Pencarian '${text}' tidak ditemukan di database.`, Markup.inlineKeyboard(buttons));
        } else {
            return ctx.reply("Pilih jenis pekerjaan di bawah ini. Jika tidak ada, tekan tombol paling bawah:", Markup.inlineKeyboard(buttons));
        }
    }

    if (session.current_step === 'PROG_WAIT_MANUAL_BOQ') {
        const custom_boq_name = text;
        // Kita tidak punya boq_id untuk input manual, jadi simpan id kosong atau flag di session.
        await updateSession(telegram_id, 'PROG_WAIT_QTY', { ...session.data, boq_id: null, custom_boq_name: custom_boq_name });
        return ctx.reply(`_"${custom_boq_name}"_ dicatat sebagai pekerjaan.\n\n✏️ Masukkan *Volume/Jumlah* pekerjaan berupa angka (misalnya: 50 atau 10.5):`, { parse_mode: 'Markdown' });
    }

    if (session.current_step === 'PROG_WAIT_QTY') {
        const vol = parseFloat(text.replace(',', '.'));
        if (isNaN(vol)) return ctx.reply("Harap masukkan *angka* yang valid (misal: 12 atau 15.5):", { parse_mode: 'Markdown' });
        await updateSession(telegram_id, 'PROG_WAIT_NOTES', { ...session.data, quantity: vol });
        return ctx.reply("📝 Berikan *Catatan/Keterangan* pekerjaan (misalnya: Instalasi sisi utara jalan):", { parse_mode: 'Markdown' });
    }

    if (session.current_step === 'PROG_WAIT_NOTES') {
        await updateSession(telegram_id, 'PROG_WAIT_PHOTO', { ...session.data, notes: text });
        return ctx.reply("📸 Langkah terakhir! Silakan unggah *1 Bukti Foto* pekerjaan Anda. (Kirim sebagai Gambar, bukan sebagai file/Dokumen).", { parse_mode: 'Markdown' });
    }

    // -- STATE MANAJEMEN MATERIAL --
    if (session.current_step === 'MAT_WAIT_SEARCH_ITEM') {
        const { data: mats } = await supabase.from('master_material').select('id, material_name').ilike('material_name', `%${text}%`).limit(8);
        if (!mats || mats.length === 0) {
            return ctx.reply(`Tidak ada material yang cocok dengan pencarian '${text}'. Coba ketik kata kunci lain:`);
        }

        const buttons = mats.map(m => [Markup.button.callback(m.material_name, `MATITEM_${m.id}`)]);
        await updateSession(telegram_id, 'MAT_WAIT_SELECT_ITEM', session.data);
        return ctx.reply("Pilih Material yang sesuai:", Markup.inlineKeyboard(buttons));
    }

    if (session.current_step === 'MAT_WAIT_MANUAL_ITEM') {
        const custom_mat_name = text;
        await updateSession(telegram_id, 'MAT_WAIT_QTY', { ...session.data, material_id: null, custom_mat_name: custom_mat_name });
        return ctx.reply(`_"${custom_mat_name}"_ dicatat sebagai material.\n\n✏️ Masukkan *Jumlah Barang* berupa angka:`, { parse_mode: 'Markdown' });
    }

    if (session.current_step === 'MAT_WAIT_QTY') {
        const vol = parseFloat(text.replace(',', '.'));
        if (isNaN(vol)) return ctx.reply("Harap masukkan *angka* yang valid:", { parse_mode: 'Markdown' });
        await updateSession(telegram_id, 'MAT_WAIT_NOTES', { ...session.data, quantity: vol });
        return ctx.reply("📝 Berikan *Keterangan/Surat Jalan/Catatan* terkait material ini:", { parse_mode: 'Markdown' });
    }

    if (session.current_step === 'MAT_WAIT_NOTES') {
        await updateSession(telegram_id, 'MAT_WAIT_PHOTO', { ...session.data, notes: text });
        return ctx.reply("📸 Opsional: Anda dapat mengunggah foto surat jalan/kondisi material, atau ketik kata 'SKIP' untuk mengirim tanpa foto.", { parse_mode: 'Markdown' });
    }

    // Handle SKIP Photo for material
    if (session.current_step === 'MAT_WAIT_PHOTO' && text.toUpperCase() === 'SKIP') {
        const sd = session.data;
        const msg = await ctx.reply("⏳ Menyimpan transaksi material...");
        const { error } = await supabase.from("transaksi_material").insert({
            telegram_id: telegram_id,
            project_id: sd.project_id,
            material_id: sd.material_id,
            transaction_type: sd.tr_type,
            quantity: sd.quantity,
            notes: sd.notes,
            photo_url: null,
            status: "submitted"
        });

        if (error) {
            console.error(error);
            return ctx.reply("❌ Gagal menyimpan ke database Supabase");
        }
        await clearSession(telegram_id);
        return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, "✅ *Transaksi Material Berhasil Disimpan!*", { parse_mode: "Markdown" });
    }

    return ctx.reply("Harap ikuti instruksi yang spesifik sebelumnya atau kirim /cancel untuk mereset.");
});

// --- PHOTO UPLOAD ---
bot.on('photo', async (ctx) => {
    const telegram_id = ctx.from.id;
    const session = await getSession(telegram_id);

    if (session.current_step !== 'PROG_WAIT_PHOTO' && session.current_step !== 'MAT_WAIT_PHOTO') {
        return ctx.reply("Foto diterima, namun Anda belum berada di tahap unggah foto. Ketik /start untuk memulai.");
    }

    try {
        const photo = ctx.message.photo.pop();
        if (!photo) return;
        const initMsg = await ctx.reply("⏳ _Sedang mengunggah foto laporan ke Cloudflare R2..._", { parse_mode: "Markdown" });

        const fileLink = await ctx.telegram.getFileLink(photo.file_id);
        const response = await fetch(fileLink.toString());
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const fileName = `${ctx.from.id}-${Date.now()}.jpg`;
        const photoUrl = await uploadToR2(buffer, fileName);

        await ctx.telegram.editMessageText(ctx.chat.id, initMsg.message_id, undefined, "⏳ _Sedang memproses database..._", { parse_mode: "Markdown" });

        const sd = session.data;

        if (session.current_step === 'PROG_WAIT_PHOTO') {
            const finalNotes = sd.custom_boq_name ? `[Manual Item: ${sd.custom_boq_name}] ` + sd.notes : sd.notes;
            const { error } = await supabase.from("laporan_kerja").insert({
                telegram_id: ctx.from.id,
                project_id: sd.project_id,
                boq_id: sd.boq_id,
                quantity: sd.quantity,
                notes: finalNotes,
                photo_url: photoUrl,
                status: "submitted"
            });
            if (error) throw error;
        } else if (session.current_step === 'MAT_WAIT_PHOTO') {
            const finalNotes = sd.custom_mat_name ? `[Manual Item: ${sd.custom_mat_name}] ` + sd.notes : sd.notes;
            const { error } = await supabase.from("transaksi_material").insert({
                telegram_id: ctx.from.id,
                project_id: sd.project_id,
                material_id: sd.material_id,
                transaction_type: sd.tr_type,
                quantity: sd.quantity,
                notes: finalNotes,
                photo_url: photoUrl,
                status: "submitted"
            });
            if (error) throw error;
        }

        await clearSession(telegram_id);
        await ctx.telegram.editMessageText(ctx.chat.id, initMsg.message_id, undefined, "✅ *Berhasil!* Foto dan data sudah terekam di sistem PT Sachi.", { parse_mode: "Markdown" });

    } catch (e: any) {
        console.error("Bot Error:", e);
        await ctx.reply(`❌ *Terjadi kesalahan* saat memproses gambar:\n\n${e.message}`, { parse_mode: "Markdown" });
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
