"use client";
import { useState } from "react";

export default function DashboardClient({ projects, laporan }: { projects: any[], laporan: any[] }) {
    const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard', 'file_laporan', 'keuangan'
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    // Overview Stats
    const totalProjects = projects.length;
    const totalReports = laporan.length;
    
    // Filtered reports for detailed view
    const filteredLaporan = selectedProjectId ? laporan.filter(l => l.project_id === selectedProjectId || l.lokasi) : laporan; // fallback filter logic if project_id isn't directly inside view_laporan_lengkap wait it isn't.

    // Let's refine the filter: view_laporan_lengkap might not have project_id, but it has project_name or we can join it.
    // Wait, let's just use the selected project's name to filter from view_laporan_lengkap since it has project_name.
    
    const selectedProjectInfo = projects.find(p => p.id === selectedProjectId);
    const displayedLaporan = selectedProjectInfo ? laporan.filter(l => l.project_name === selectedProjectInfo.project_name) : [];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
            {/* Sidebar */}
            <aside className="w-full md:w-64 bg-white border-r border-slate-200 shrink-0 shadow-sm md:min-h-screen">
                <div className="p-6">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">PT Sachi</h2>
                    <p className="text-xs text-slate-500 font-medium tracking-wide uppercase mt-1">Progress System</p>
                </div>
                <nav className="flex flex-col gap-1 px-4 mt-2">
                    <button 
                        onClick={() => { setActiveTab("dashboard"); setSelectedProjectId(null); }}
                        className={`text-left px-4 py-3 rounded-xl transition-all font-semibold flex items-center gap-3 ${activeTab === "dashboard" ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                        <span>🏠</span> Overview
                    </button>
                    <button 
                        onClick={() => { setActiveTab("file_laporan"); setSelectedProjectId(null); }}
                        className={`text-left px-4 py-3 rounded-xl transition-all font-semibold flex items-center gap-3 ${activeTab === "file_laporan" ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                        <span>📁</span> File Laporan
                    </button>
                    <button 
                        onClick={() => { setActiveTab("keuangan"); setSelectedProjectId(null); }}
                        className={`text-left px-4 py-3 rounded-xl transition-all font-semibold flex items-center gap-3 ${activeTab === "keuangan" ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                        <span>💰</span> Laporan Keuangan <span className="ml-auto text-[10px] bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full">SGERA</span>
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-10 overflow-y-auto w-full">
                
                {/* TAB: DASHBOARD (OVERVIEW) */}
                {activeTab === "dashboard" && (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                        <header className="mb-10">
                            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Dashboard Overview</h1>
                            <p className="text-slate-500">Ringkasan singkat dari seluruh progress lapangan.</p>
                        </header>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-5">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-3xl">🗂️</div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Total Projects</p>
                                    <p className="text-4xl font-black text-slate-800">{totalProjects}</p>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-5">
                                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-3xl">📝</div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Total Laporan Masuk</p>
                                    <p className="text-4xl font-black text-slate-800">{totalReports}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-lg mb-4">Laporan Terbaru Secara Keseluruhan</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {laporan.slice(0,4).map((item) => (
                                    <ReportCard key={item.id} item={item} />
                                ))}
                            </div>
                            {laporan.length === 0 && <p className="text-slate-400 italic">Belum ada laporan dari Telegram Bot.</p>}
                        </div>
                    </div>
                )}

                {/* TAB: FILE LAPORAN (PROJECT FOLDERS) */}
                {activeTab === "file_laporan" && (
                    <div className="animate-in fade-in zoom-in-95 duration-300 w-full">
                        {!selectedProjectId ? (
                            <>
                                <header className="mb-8">
                                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">📁 File Laporan (Projects)</h1>
                                    <p className="text-slate-500">Pilih folder project di bawah ini untuk melihat detail laporkan kerjanya.</p>
                                </header>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {projects.map(p => (
                                        <div 
                                            key={p.id} 
                                            onClick={() => setSelectedProjectId(p.id)}
                                            className="bg-white p-6 rounded-3xl cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300 border border-slate-100 group"
                                        >
                                            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300 origin-bottom-left">📂</div>
                                            <h3 className="font-bold text-slate-800 text-lg mb-1">{p.project_name}</h3>
                                            <p className="text-sm text-slate-500 line-clamp-1">{p.lokasi || "Lokasi Belum Ditentukan"}</p>
                                            <div className="mt-4 inline-flex text-xs font-semibold bg-sky-50 text-sky-700 px-3 py-1 rounded-full">Lihat Detail &rarr;</div>
                                        </div>
                                    ))}
                                    {projects.length === 0 && <p className="text-slate-500">Belum ada project yang didaftarkan melalui Telegram bot (Menu NEW Project).</p>}
                                </div>
                            </>
                        ) : (
                            <>
                                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                                    <div>
                                        <button onClick={() => setSelectedProjectId(null)} className="text-sky-600 font-semibold mb-3 hover:underline">&larr; Kembali ke Folder</button>
                                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2 flex items-center gap-3">
                                            <span>📂</span> {selectedProjectInfo?.project_name}
                                        </h1>
                                        <p className="text-slate-500 font-medium">{selectedProjectInfo?.lokasi} | {selectedProjectInfo?.nama_mitra}</p>
                                    </div>
                                    <div className="bg-sky-50 rounded-2xl p-4 min-w-[200px] text-center border border-sky-100">
                                        <p className="text-sky-600 font-bold text-sm uppercase mb-1">Total Laporan Proyek</p>
                                        <p className="text-3xl font-black text-sky-700">{displayedLaporan.length}</p>
                                    </div>
                                </header>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {displayedLaporan.map((item) => (
                                        <ReportCard key={item.id} item={item} />
                                    ))}
                                    {displayedLaporan.length === 0 && (
                                        <div className="col-span-full py-10 flex text-slate-400 justify-center">
                                            Belum ada laporan spesifik pada project ini.
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* TAB: LAPORAN KEUANGAN */}
                {activeTab === "keuangan" && (
                    <div className="animate-in fade-in zoom-in-95 duration-300 w-full h-full flex flex-col items-center justify-center p-20 text-center">
                        <div className="text-6xl mb-6">🚧</div>
                        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Laporan Keuangan</h1>
                        <p className="text-slate-500 max-w-md mx-auto">Modul laporan keuangan ini sedang dalam tahap pengembangan (Next Update). Segera hadir!</p>
                    </div>
                )}
            </main>
        </div>
    );
}


// --- Reusable Component untuk render Card Laporan ---
function ReportCard({ item }: { item: any }) {
    // Handling multiple photos properly from JSONB array
    const photos = Array.isArray(item.photo_urls) ? item.photo_urls : (item.photo_url ? [item.photo_url] : []);
    const coverPhoto = photos.length > 0 ? photos[0] : null;

    return (
        <div className="bg-white rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden group flex flex-col">
            <div className="relative aspect-video w-full bg-slate-100 overflow-hidden mt-1 mx-1 rounded-t-[22px]">
                {coverPhoto ? (
                    <>
                        <img
                            src={coverPhoto}
                            alt="Eviden"
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700"
                        />
                        {photos.length > 1 && (
                            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-2 py-1 flex items-center gap-1 rounded-full">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                {photos.length}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-medium">Tanpa Foto</div>
                )}
                
                <div className="absolute top-2 left-2 z-10">
                   <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-md ${item.status === 'nok' ? 'bg-rose-500/90 text-white' : 'bg-emerald-500/90 text-white'}`}>
                       {item.status === 'nok' ? 'NOK' : (item.status === 'submitted' ? 'DONE' : item.status)}
                   </span>
                </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2 gap-2">
                    <h3 className="font-extrabold text-slate-900 leading-tight line-clamp-2">{item.task_name || "Laporan Lapangan"}</h3>
                </div>
                
                <p className="text-xs text-sky-600 font-bold mb-3 uppercase tracking-wide">{item.task_category || "-"}</p>

                <div className="bg-slate-50 rounded-xl p-3 mb-4 flex gap-4 text-center divide-x divide-slate-200">
                    <div className="flex-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Volume</p>
                        <p className="text-sm font-black text-slate-700">{item.quantity || "-"}</p>
                    </div>
                    <div className="flex-1">
                         <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Tanggal</p>
                         <p className="text-xs font-bold text-slate-700 mt-1">{new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                    </div>
                </div>

                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">👤</div>
                        ID: {item.telegram_id}
                    </div>
                </div>
            </div>
        </div>
    );
}
