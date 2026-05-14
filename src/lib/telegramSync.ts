import { Telegraf } from "telegraf";
import { supabase } from "@/lib/supabase";
import lodash from 'lodash';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "");
const MAIN_CHANNEL_ID = process.env.MAIN_CHANNEL_ID || "";

export async function updateCategoryProgress(projectId: string, category: string) {
    if (!MAIN_CHANNEL_ID) return;
    try {
        const { data: p } = await supabase.from('master_project').select('*').eq('id', projectId).single();
        if (!p) return;

        let main_msg_id = p.main_message_id;
        let discussion_chat_id = p.discussion_chat_id;
        let category_msgs = p.category_messages || {};

        if (!discussion_chat_id) {
            try {
                const chatInfo = await bot.telegram.getChat(MAIN_CHANNEL_ID) as any;
                if (chatInfo.linked_chat_id) {
                    discussion_chat_id = chatInfo.linked_chat_id;
                    await supabase.from('master_project').update({ discussion_chat_id }).eq('id', projectId);
                }
            } catch (e) { console.error("Linked chat info error:", e); }
        }

        if (!main_msg_id || category === "REFRESH_ONLY") {
            const msgText = `🏢 *PROJECT*: ${p.project_name || '-'}\n📄 *SPMK*: ${p.no_spmk || '-'}\n📍 *Lokasi*: ${p.lokasi || '-'}\n\n_Seluruh dokumentasi progres akan kami kumpulkan di bawah pesan ini._`;

            let successEdit = false;
            if (p.main_message_id) {
                try {
                    await bot.telegram.editMessageText(MAIN_CHANNEL_ID, Number(p.main_message_id), undefined, msgText, { parse_mode: 'Markdown' });
                    successEdit = true;
                } catch (e) { console.log("Edit failed, sending new message..."); }
            }

            if (!successEdit) {
                if (p.main_message_id) {
                    try { await bot.telegram.deleteMessage(MAIN_CHANNEL_ID, Number(p.main_message_id)); } catch (e) { }
                }
                const msg = await bot.telegram.sendMessage(MAIN_CHANNEL_ID, msgText, { parse_mode: 'Markdown' });
                main_msg_id = msg.message_id;
            }

            await supabase.from('master_project').update({
                main_message_id: main_msg_id,
                group_message_id: null
            }).eq('id', projectId);

            for (let i = 0; i < 10; i++) {
                await new Promise(r => setTimeout(r, 1000));
                const { data: pCheck } = await supabase.from('master_project').select('group_message_id, discussion_chat_id').eq('id', projectId).single();
                if (pCheck?.group_message_id) {
                    p.group_message_id = pCheck.group_message_id;
                    discussion_chat_id = pCheck.discussion_chat_id || discussion_chat_id;
                    break;
                }
            }
        } else {
            const { data: pCheck } = await supabase.from('master_project').select('group_message_id, discussion_chat_id').eq('id', projectId).single();
            if (pCheck) {
                p.group_message_id = pCheck.group_message_id;
                discussion_chat_id = pCheck.discussion_chat_id || discussion_chat_id;
            }
        }

        if (category === "REFRESH_ONLY") {
            const { data: oldEvs } = await supabase.from('evidences')
                .select('id, category, laporan_id')
                .eq('project_id', projectId)
                .or('category.eq.Instalasi,category.eq.Persiapan,category.eq.Finish Instalation,category.eq.Closing');

            if (oldEvs && oldEvs.length > 0) {
                for (const ev of oldEvs) {
                    const { data: lap } = await supabase.from('laporan_kerja').select('task_name').eq('id', ev.laporan_id).single();
                    if (lap && lap.task_name) {
                        let cleanName = lap.task_name;
                        if (cleanName.includes('(')) {
                            cleanName = cleanName.replace(/.*\((.*)\)/, '$1').trim();
                        }
                        await supabase.from('evidences').update({ category: cleanName }).eq('id', ev.id);
                    }
                }
            }

            const { data: allEvs } = await supabase.from('evidences').select('category').eq('project_id', projectId);
            const uniqueCats = Array.from(new Set((allEvs || []).map(x => x.category)));
            for (const cat of uniqueCats) {
                await updateCategoryProgress(projectId, cat);
            }
            return;
        }

        if (discussion_chat_id) {
            const oldMsgIds = category_msgs[category] || [];
            for (const msgId of oldMsgIds) {
                try { await bot.telegram.deleteMessage(discussion_chat_id, msgId); } catch (e) { }
            }
        }

        const { data: evidences } = await supabase.from('evidences').select('*').eq('project_id', projectId).eq('category', category);
        
        // --- ADDED THIS LINE to clear DB messages and stop if 0 evidences ---
        if (!evidences || evidences.length === 0) {
            delete category_msgs[category];
            await supabase.from('master_project').update({ category_messages: category_msgs }).eq('id', projectId);
            return;
        }

        const chunks = lodash.chunk(evidences, 10);
        let newMessageIds: number[] = [];

        for (const [idx, chunk] of chunks.entries()) {
            const mediaGroup = chunk.map((ev: any, i: number) => ({
                type: 'photo' as const,
                media: ev.telegram_file_id,
                caption: (idx === 0 && i === 0) ? `📂 *Designator:* ${category}\n_Total Eviden:_ ${evidences.length} Foto` : undefined,
                parse_mode: 'Markdown' as const
            }));

            try {
                const extra: any = {
                    parse_mode: 'Markdown',
                    reply_to_message_id: Number(p.group_message_id) || undefined
                };

                const msgs = await bot.telegram.sendMediaGroup(discussion_chat_id!, mediaGroup, extra);
                msgs.forEach((m: any) => newMessageIds.push(m.message_id));
            } catch (e) {
                console.error("Gagal kirim MediaGroup ke discussion", e);
                try {
                    const msgs = await bot.telegram.sendMediaGroup(discussion_chat_id!, mediaGroup);
                    msgs.forEach((m: any) => newMessageIds.push(m.message_id));
                } catch (e2) { }
            }
        }

        if (newMessageIds.length > 0) {
            category_msgs[category] = newMessageIds;
            await supabase.from('master_project').update({ category_messages: category_msgs }).eq('id', projectId);
        }
    } catch (e) {
        console.error("updateCategoryProgress error:", e);
    }
}
