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
    const { data: laporanTable, error: laporanError } = await supabase
        .from("laporan_kerja")
        .select(`
            *,
            master_project(project_name, area, site_name),
            master_boq(task_name)
        `)
        .order("created_at", { ascending: false });

    let laporan = (laporanTable || []).map(item => ({
        ...item,
        location: item.master_project?.project_name,
        project_name: item.master_project?.project_name,
        area: item.master_project?.area,
        site_name: item.master_project?.site_name,
        boq_name: item.master_boq?.task_name,
    }));

    const error = laporanError || projectsError;

    if (error) {
        return (
            <div className="min-h-screen p-10 bg-red-50 text-red-600">
                <p className="font-semibold text-2xl">Oops! Gagal memuat data dari database.</p>
                <p className="mt-2">Pastikan kredensial Supabase di `.env.local` sudah benar dan struktur tabel Anda mutakhir.</p>
            </div>
        );
    }

    return <DashboardClient projects={projects || []} laporan={laporan} />;
}

