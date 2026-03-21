import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Telegraf } from "telegraf";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "");
const MAIN_CHANNEL_ID = process.env.MAIN_CHANNEL_ID || "";

export async function GET(req: Request) {
    try {
        // Vercel Cron protection check (Aman dari publik)
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
             return new NextResponse("Unauthorized", { status: 401 });
        }

        if (!MAIN_CHANNEL_ID) {
            return NextResponse.json({ error: "MAIN_CHANNEL_ID not set" }, { status: 500 });
        }

        // Cari project yang main_message_id-nya masih kosong / belum dikirim ke channel
        const { data: projects, error } = await supabase
            .from('master_project')
            .select('*')
            .is('main_message_id', null);

        if (error) {
            console.error("Cron Error fetching projects:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!projects || projects.length === 0) {
            return NextResponse.json({ success: true, message: "Aman, tidak ada project tertunda." });
        }

        let syncedCount = 0;
        let discussion_chat_id: number | null = null;
        
        try {
            const chatInfo = await bot.telegram.getChat(MAIN_CHANNEL_ID) as any;
            if (chatInfo.linked_chat_id) discussion_chat_id = chatInfo.linked_chat_id;
        } catch(e) { console.error("Linked chat info error:", e); }

        for (const p of projects) {
            try {
                const msg = await bot.telegram.sendMessage(
                    MAIN_CHANNEL_ID,
                    `🏢 *PROJECT BARU*: ${p.project_name || '-'}\n📄 *SPMK*: ${p.no_spmk || '-'}\n📍 *Lokasi*: ${p.lokasi || '-'}\n\n_Seluruh dokumentasi progres proyek ini akan dikumpulkan di bawah thread pesan ini._`,
                    { parse_mode: 'Markdown' }
                );
                
                await supabase.from('master_project').update({ 
                    main_message_id: msg.message_id, 
                    discussion_chat_id: discussion_chat_id 
                }).eq('id', p.id);

                syncedCount++;
                // Beri jeda 1 detik agar tidak terkenal "Flood Control" (limit rate) oleh sistem Telegram
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err: any) {
                console.error(`Gagal mengirim project ${p.id}: `, err.message);
            }
        }

        return NextResponse.json({ success: true, processed: syncedCount });
    } catch (error: any) {
        console.error("Cron Handler Error:", error);
        return NextResponse.json({ error: "Internal Server Error", detail: error.message }, { status: 500 });
    }
}
