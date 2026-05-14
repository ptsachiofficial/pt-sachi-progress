import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
    try {
        const { id, quantity, notes } = await req.json();
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        const { error } = await supabase.from('laporan_kerja')
            .update({ quantity, notes })
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Edit report error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
