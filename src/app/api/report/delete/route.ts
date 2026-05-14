import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { updateCategoryProgress } from "@/lib/telegramSync";

export async function POST(req: NextRequest) {
    try {
        const { id } = await req.json();
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        const { data: report } = await supabase.from('laporan_kerja').select('*').eq('id', id).single();
        if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

        // Get categories to sync BEFORE deleting
        const { data: evs } = await supabase.from('evidences').select('category').eq('laporan_id', id);
        const catsToSync = Array.from(new Set((evs || []).map(e => e.category)));

        // Delete from database
        await supabase.from('evidences').delete().eq('laporan_id', id);
        const { error } = await supabase.from('laporan_kerja').delete().eq('id', id);

        if (error) throw error;

        // Sync with Telegram so it matches DB
        if (report.project_id) {
            for (const cat of catsToSync) {
                await updateCategoryProgress(report.project_id, cat);
            }
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Delete report error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
