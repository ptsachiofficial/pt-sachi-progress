import { NextRequest, NextResponse } from "next/server";
import { Telegraf } from "telegraf";
import { supabase } from "@/lib/supabase";
import { uploadToR2 } from "@/lib/r2";

// Initialize the bot with the token
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "");

// Command start
bot.start(async (ctx) => {
    await ctx.reply("Halo! Saya adalah bot pelaporan progres PT Sachi. Silakan unggah foto beserta lokasi, BOQ, atau deskripsi laporan Anda.");
});

// Handle photo attachments
bot.on('photo', async (ctx) => {
    try {
        const photo = ctx.message.photo.pop(); // Get highest resolution photo
        if (!photo) return;
        
        const caption = ctx.message.caption || "";
        await ctx.reply("Foto diterima, sedang memproses laporan...");
        
        // 1. Get the file from Telegram
        const fileLink = await ctx.telegram.getFileLink(photo.file_id);
        const response = await fetch(fileLink.toString());
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // 2. Upload photo to Cloudflare R2
        const fileName = `${ctx.from.id}-${Date.now()}.jpg`;
        const photoUrl = await uploadToR2(buffer, fileName);
        
        // 3. Insert report into Supabase
        const { error } = await supabase
            .from("laporan_kerja")
            .insert({
                telegram_id: ctx.from.id,
                photo_url: photoUrl,
                notes: caption,
                status: "submitted"
            });
            
        if (error) {
            console.error(error);
            throw new Error("Gagal menyimpan ke database");
        }
        
        await ctx.reply("Laporan berhasil disimpan! Anda bisa melihatnya di Dashboard Web.");
    } catch (e: any) {
        console.error("Bot Error:", e);
        await ctx.reply(`Terjadi kesalahan saat memproses laporan: ${e.message}`);
    }
});

// Generic text handler
bot.on('text', async (ctx) => {
    await ctx.reply("Anda mengirim pesan teks. Jika ingin membuat laporan, mohon kirimkan / start atau langsung kirim foto bukti kerja dengan caption/keterangan.");
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
