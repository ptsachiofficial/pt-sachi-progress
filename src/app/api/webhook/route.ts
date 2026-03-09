import { NextRequest, NextResponse } from "next/server";
import { Telegraf, Markup } from "telegraf";
import { supabase } from "@/lib/supabase";
import { uploadToR2 } from "@/lib/r2";

// Initialize the bot with the token
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "");

// --- START COMMAND ---
bot.start(async (ctx) => {
    const welcomeText = `*Selamat Datang di Sistem Pelaporan PT Sachi* 🏢\n\n` +
        `Bot ini akan membantu Anda melaporkan bukti kerja lapangan dengan cepat dan sistematis.\n\n` +
        `*Tata Cara Penggunaan:*\n` +
        `1. Tekan tombol *Mulai Laporan Baru* di bawah ini.\n` +
        `2. Kirimkan pesan dengan format:\n   \`[Lokasi] - [BOQ/Material] - [Kuantitas] \`\n   _(Contoh: Jakarta - AC-ADSS-SM-12C - 50)_\n` +
        `3. Setelah mengirimkan data kerjanya, kirimkan *1 Buah Foto Bukti Pekerjaan* sebagai lampiran evidensi.\n\n` +
        `Pilih menu di bawah ini untuk melanjutkan:`;

    // Try to send the logo if public URL is available, otherwise just text
    const logoUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/logo.png`
        : "https://raw.githubusercontent.com/ptsachiofficial/pt-sachi-progress/main/public/logo.png"; // Fallback URL from your Github

    try {
        await ctx.replyWithPhoto(
            { url: logoUrl },
            {
                caption: welcomeText,
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("📝 Mulai Laporan Baru", "NEW_REPORT")],
                    [Markup.button.callback("📊 Cek Status Data Master", "CHECK_DB")]
                ])
            }
        );
    } catch (e) {
        // Fallback without photo if the photo fetch fails
        await ctx.reply(welcomeText, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback("📝 Mulai Laporan Baru", "NEW_REPORT")],
                [Markup.button.callback("📊 Cek Status Data Master", "CHECK_DB")]
            ])
        });
    }
});

// --- CALLBACK QUERIES (INLINE KEYBOARD ACTIONS) ---
bot.action("NEW_REPORT", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply("Sip! Silakan langsung ketik rincian laporannya terlebih dahulu. \n\nMisal: `Jakarta - Kabel FO - 50`\n\nAtau jika Anda mau langsung kirim beserta *Foto*, cantumkan rincian di kolom keterangan (caption) fotonya ya!", { parse_mode: 'Markdown' });
});

bot.action("CHECK_DB", async (ctx) => {
    await ctx.answerCbQuery();
    try {
        // Check row counts of master data
        const { count: boqCount } = await supabase.from('master_boq').select('*', { count: 'exact', head: true });
        const { count: matCount } = await supabase.from('master_material').select('*', { count: 'exact', head: true });

        await ctx.reply(`*Status Data Master:*\n\n✅ BOQ/Designator Data: *${boqCount || 0}* Item\n✅ Material Data: *${matCount || 0}* Item\n\nJika jumlah di atas lebih dari 0, berarti data CSV Anda sudah berhasil terunggah!`, { parse_mode: 'Markdown' });
    } catch (e: any) {
        await ctx.reply("Data master sedang sinkronisasi. Coba lagi nanti ya.");
    }
});

// --- PHOTO HANDLER ---
bot.on('photo', async (ctx) => {
    try {
        const photo = ctx.message.photo.pop(); // Get highest resolution photo
        if (!photo) return;

        const caption = ctx.message.caption || "";
        const initMsg = await ctx.reply("⏳ _Sedang mengunggah foto laporan ke Cloudflare R2..._", { parse_mode: "Markdown" });

        // 1. Get the file from Telegram
        const fileLink = await ctx.telegram.getFileLink(photo.file_id);
        const response = await fetch(fileLink.toString());
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Upload photo to Cloudflare R2
        const fileName = `${ctx.from.id}-${Date.now()}.jpg`;
        const photoUrl = await uploadToR2(buffer, fileName);

        await ctx.telegram.editMessageText(ctx.chat.id, initMsg.message_id, undefined, "⏳ _Sedang memproses database Supabase..._", { parse_mode: "Markdown" });

        // Parsing caption for simplicity (Assuming format 'Location - Item - Qty')
        const parts = caption.split("-").map(p => p.trim());
        const location = parts[0] || "Tidak diketahui";
        const catatan_lengkap = caption || "Tanpa Keterangan";

        // 3. Insert report into Supabase
        const { error } = await supabase
            .from("laporan_kerja")
            .insert({
                telegram_id: ctx.from.id,
                photo_url: photoUrl,
                location: location,
                notes: catatan_lengkap,
                status: "submitted"
            });

        if (error) {
            console.error(error);
            throw new Error("Gagal menyimpan ke database Supabase");
        }

        await ctx.telegram.editMessageText(ctx.chat.id, initMsg.message_id, undefined, "✅ *Laporan berhasil disimpan!* \nFoto dan data rincian sudah terekam di sistem PT Sachi.", { parse_mode: "Markdown" });
    } catch (e: any) {
        console.error("Bot Error:", e);
        await ctx.reply(`❌ *Terjadi kesalahan* saat memproses laporan:\n\n${e.message}`, { parse_mode: "Markdown" });
    }
});

// --- TEXT HANDLER FOR REPORT ---
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    await ctx.reply("Teks diterima: \n" + text + "\n\nMohon kirimkan foto sebagai bukti evidensi pekerjaan. Jika ingin melapor, langsung sertakan teks di atas ini ke dalam kotak *Keterangan/Caption* foto sebelum dikirim.");
});

// App Router Webhook Endpoint
export async function POST(req: NextRequest) {
    try {
        // Optional webhook signature protection (recommended)
        const secret = req.headers.get("x-telegram-bot-api-secret-token");
        if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        // Forward update to telegraf
        await bot.handleUpdate(body);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Webhook Handler Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
