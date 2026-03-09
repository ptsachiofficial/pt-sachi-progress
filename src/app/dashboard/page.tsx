import { supabase } from "@/lib/supabase";

export const revalidate = 0; // Disable static caching, always fetch fresh data

export default async function DashboardPage() {
    // Attempting to fetch from view first. If view doesn't exist, we can fallback to laporan_kerja
    const { data: laporanView, error: viewError } = await supabase
        .from("view_laporan_lengkap")
        .select("*")
        .order("created_at", { ascending: false });

    // Fallback if view is not created yet
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

    const error = viewError && fallbackError;

    return (
        <div className="min-h-screen bg-slate-50 p-6 sm:p-12 font-sans">
            <header className="mb-10 text-center sm:text-left">
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">PT Sachi Progress Dashboard</h1>
                <p className="text-lg text-slate-500">Pantau laporan kerja lapangan secara real-time</p>
            </header>

            {error ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
                    <p className="font-semibold">Oops! Gagal memuat data dari database.</p>
                    <p className="text-sm mt-1">Pastikan kredensial Supabase di `.env.local` sudah benar, dan tabel SQL sudah di setup menggunakan script `supabase_schema.sql`.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {laporan?.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                            <span className="text-4xl mb-3">📁</span>
                            <p className="font-medium">Belum ada laporan kerja yang masuk.</p>
                            <p className="text-sm mt-1 text-slate-400">Kirim laporan beserta foto dari Telegram Bot untuk mulai mengisi dashboard.</p>
                        </div>
                    )}
                    {laporan?.map((item: any) => (
                        <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group cursor-pointer">
                            <div className="relative aspect-video w-full bg-slate-100 overflow-hidden">
                                {item.photo_url ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={item.photo_url}
                                        alt="Eviden"
                                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300">Tanpa Foto</div>
                                )}
                            </div>
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        {item.status || 'Submitted'}
                                    </span>
                                    <time className="text-xs text-slate-500 font-medium">
                                        {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </time>
                                </div>
                                <h3 className="font-semibold text-slate-900 mb-1 line-clamp-1">{item.boq_name || "Laporan Lapangan"}</h3>
                                <p className="text-sm text-slate-600 mb-4 line-clamp-2">{item.notes || "Tidak ada detail keterangan deskripsi disertakan."}</p>

                                <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        ID: {item.telegram_id}
                                    </div>
                                    {item.location && (
                                        <div className="flex items-center gap-1 shrink-0">
                                            <svg className="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            {item.location}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
