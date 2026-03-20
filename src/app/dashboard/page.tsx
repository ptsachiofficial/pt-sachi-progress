import { supabase } from "@/lib/supabase";
import DashboardClient from "./DashboardClient";

export const revalidate = 0; // Disable static caching, always fetch fresh data

export default async function DashboardPage() {
    // 1. Fetch Projects
    const { data: projects, error: projectsError } = await supabase
        .from("master_project")
        .select("*")
        .order("created_at", { ascending: false });

    // 2. Fetch Laporan
    // Attempting to fetch from view first. If view doesn't exist, fallback to laporan_kerja
    const { data: laporanView, error: viewError } = await supabase
        .from("view_laporan_lengkap")
        .select("*")
        .order("created_at", { ascending: false });

    let laporan = laporanView;
    let fallbackError = null;

    if (viewError) {
        console.log("View tidak ditemukan, fallback ke tabel laporan_kerja");
        const { data: laporanTable, error: tableError } = await supabase
            .from("laporan_kerja")
            .select("*")
            .order("created_at", { ascending: false });

        laporan = laporanTable;
        fallbackError = tableError;
    }

    const error = (viewError && fallbackError) || projectsError;

    if (error) {
        return (
            <div className="min-h-screen p-10 bg-red-50 text-red-600">
                <p className="font-semibold text-2xl">Oops! Gagal memuat data dari database.</p>
                <p className="mt-2">Pastikan kredensial Supabase di `.env.local` sudah benar dan struktur tabel Anda mutakhir.</p>
            </div>
        );
    }

    return <DashboardClient projects={projects || []} laporan={laporan || []} />;
}

