"use client";
import { useState } from "react";

export default function DashboardClient({ projects, laporan }: { projects: any[], laporan: any[] }) {
    const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard', 'file_laporan', 'keuangan'
    
    // Breadcrumb / Hierarki Folder
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedDesignator, setSelectedDesignator] = useState<string | null>(null);

    const resetSelection = () => {
        setSelectedProjectId(null);
        setSelectedCategory(null);
        setSelectedDesignator(null);
    };

    // Use local state so we can edit/delete without reloading
    const [localLaporan, setLocalLaporan] = useState(laporan);

    // Data Helpers
    const totalProjects = projects.length;
    const totalReports = localLaporan.length;
    
    const selectedProjectInfo = projects.find(p => p.id === selectedProjectId);
    const displayedLaporan = selectedProjectInfo ? localLaporan.filter(l => l.project_name === selectedProjectInfo.project_name) : [];

    // Pengelompokan Kategori
    const reportsByCategory = displayedLaporan.reduce((acc: Record<string, any[]>, rep: any) => {
        const cat = rep.task_category || "Lainnya";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(rep);
        return acc;
    }, {} as Record<string, any[]>);
    
    // Jika Kategori Dipilih
    const reportsInCategory = selectedCategory ? (reportsByCategory[selectedCategory] || []) : [];
    
    // Pengelompokan Designator dalam Kategori 
    const reportsByDesignator = reportsInCategory.reduce((acc: Record<string, any[]>, rep: any) => {
        const desig = rep.boq_name || rep.task_name || "Lainnya";
        if (!acc[desig]) acc[desig] = [];
        acc[desig].push(rep);
        return acc;
    }, {} as Record<string, any[]>);

    // Jika Designator Dipilih
    const reportsInDesignator = selectedDesignator ? (reportsByDesignator[selectedDesignator] || []) : [];

    // Handler klik fitur Download ZIP
    const handleDownloadZip = () => {
        if (!selectedProjectId) return;
        window.open(`/api/download?id=${selectedProjectId}`, '_blank');
    };

    // Handler klik fitur Download DOCX
    const handleDownloadDocx = (cat?: string) => {
        if (!selectedProjectId) return;
        const url = `/api/download-docx?id=${selectedProjectId}${cat ? `&cat=${encodeURIComponent(cat)}` : ''}`;
        window.open(url, '_blank');
    };

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
                        onClick={() => { setActiveTab("dashboard"); resetSelection(); }}
                        className={`text-left px-4 py-3 rounded-xl transition-all font-semibold flex items-center gap-3 ${activeTab === "dashboard" ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                        <span>🏠</span> Overview
                    </button>
                    <button 
                        onClick={() => { setActiveTab("file_laporan"); resetSelection(); }}
                        className={`text-left px-4 py-3 rounded-xl transition-all font-semibold flex items-center gap-3 ${activeTab === "file_laporan" ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                        <span>📁</span> File Laporan
                    </button>
                    <button 
                        onClick={() => { setActiveTab("keuangan"); resetSelection(); }}
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
                                {localLaporan.slice(0,4).map((item: any) => (
                                    <ReportCard 
                                        key={item.id} 
                                        item={item} 
                                        onDelete={(id) => setLocalLaporan(prev => prev.filter(l => l.id !== id))}
                                        onEdit={(id, updates) => setLocalLaporan(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))}
                                    />
                                ))}
                            </div>
                            {localLaporan.length === 0 && <p className="text-slate-400 italic">Belum ada laporan dari Telegram Bot.</p>}
                        </div>
                    </div>
                )}

                {/* TAB: FILE LAPORAN (HIERARCHY FOLDERS) */}
                {activeTab === "file_laporan" && (
                    <div className="animate-in fade-in zoom-in-95 duration-300 w-full">
                        
                        {/* 1. Tampilan Utama Project */}
                        {!selectedProjectId && (
                            <>
                                <header className="mb-8">
                                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">📁 File Laporan (Projects)</h1>
                                    <p className="text-slate-500">Pilih folder project di bawah ini untuk melihat struktur laporannya.</p>
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
                                            <div className="mt-4 inline-flex text-xs font-semibold bg-sky-50 text-sky-700 px-3 py-1 rounded-full">Buka Folder &rarr;</div>
                                        </div>
                                    ))}
                                    {projects.length === 0 && <p className="text-slate-500">Belum ada project yang didaftarkan melalui Telegram bot (Menu NEW Project).</p>}
                                </div>
                            </>
                        )}

                        {/* 2. Tampilan Isi Project -> Kategori Laporan */}
                        {selectedProjectId && !selectedCategory && (
                            <>
                                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                                    <div>
                                        <button onClick={() => setSelectedProjectId(null)} className="text-sky-600 font-semibold mb-3 hover:underline">&larr; Kembali ke Daftar Project</button>
                                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2 flex items-center gap-3">
                                            <span>📂</span> {selectedProjectInfo?.project_name}
                                        </h1>
                                        <p className="text-slate-500 font-medium">Laporan Dikelompokkan Berdasarkan Modul Kategori</p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button onClick={() => handleDownloadDocx()} className="bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold px-5 py-3 rounded-2xl transition border border-blue-100 flex items-center justify-center gap-2">
                                            <span>📄</span> Unduh DOCX Project
                                        </button>
                                        <button onClick={handleDownloadZip} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold px-5 py-3 rounded-2xl transition border border-emerald-100 flex items-center justify-center gap-2">
                                            <span>📥</span> Unduh ZIP Terstruktur
                                        </button>
                                    </div>
                                </header>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {Object.keys(reportsByCategory).map(cat => (
                                        <div 
                                            key={cat} 
                                            onClick={() => setSelectedCategory(cat)}
                                            className="bg-white p-6 rounded-3xl cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300 border border-slate-100 group flex items-center gap-4"
                                        >
                                            <div className="text-4xl group-hover:scale-110 transition-transform duration-300">📁</div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-lg mb-1">{cat}</h3>
                                                <p className="text-xs text-slate-500 font-medium">{reportsByCategory[cat].length} Laporan Termasuk</p>
                                            </div>
                                        </div>
                                    ))}
                                    {Object.keys(reportsByCategory).length === 0 && (
                                        <div className="col-span-full py-10 flex text-slate-400 justify-center">Belum ada laporan pada project ini.</div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* 3. Tampilan Kategori -> Subfolder Designator */}
                        {selectedProjectId && selectedCategory && !selectedDesignator && (
                            <>
                                <header className="mb-8 border-b border-slate-200 pb-6">
                                    <button onClick={() => setSelectedCategory(null)} className="text-sky-600 font-semibold mb-3 hover:underline">&larr; Kembali ke Folder Project</button>
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-3 text-sm font-bold text-slate-400 mb-2 uppercase tracking-wide">
                                                <span>📂 {selectedProjectInfo?.project_name}</span> <span>/</span> <span>📁 {selectedCategory}</span>
                                            </div>
                                            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Pilih Subfolder Designator</h1>
                                        </div>
                                        <button onClick={() => handleDownloadDocx(selectedCategory!)} className="bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold px-5 py-3 rounded-2xl transition border border-blue-100 flex items-center justify-center gap-2">
                                            <span>📄</span> Unduh DOCX Kategori Ini
                                        </button>
                                    </div>
                                </header>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {Object.keys(reportsByDesignator).map(desig => (
                                        <div 
                                            key={desig} 
                                            onClick={() => setSelectedDesignator(desig)}
                                            className="bg-slate-50 p-5 rounded-3xl cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300 border border-slate-200 border-dashed group"
                                        >
                                            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300 origin-bottom-left">📂</div>
                                            <h3 className="font-bold text-slate-800 text-sm mb-1 leading-tight">{desig}</h3>
                                            <p className="text-xs text-sky-600 font-semibold">{reportsByDesignator[desig].length} Item Card</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* 4. Tampilan Designator -> List Report Card Asli */}
                        {selectedProjectId && selectedCategory && selectedDesignator && (
                            <>
                                <header className="mb-8 border-b border-slate-200 pb-6">
                                    <button onClick={() => setSelectedDesignator(null)} className="text-sky-600 font-semibold mb-3 hover:underline">&larr; Kembali ke Subfolder Kategori</button>
                                    <div className="flex items-center gap-3 text-sm font-bold text-slate-400 mb-2 uppercase tracking-wide">
                                        <span>📂 Project</span> <span>/</span> <span>📁 {selectedCategory}</span> <span>/</span> <span>📁 {selectedDesignator}</span>
                                    </div>
                                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Detail Laporan Eviden</h1>
                                </header>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {reportsInDesignator.map((item: any) => (
                                        <ReportCard 
                                            key={item.id} 
                                            item={item} 
                                            onDelete={(id) => setLocalLaporan(prev => prev.filter(l => l.id !== id))}
                                            onEdit={(id, updates) => setLocalLaporan(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))}
                                        />
                                    ))}
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
function ReportCard({ item, onDelete, onEdit }: { item: any, onDelete?: (id: string) => void, onEdit?: (id: string, updates: any) => void }) {
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ quantity: item.quantity || "", notes: item.notes || "" });
    const [isDeleting, setIsDeleting] = useState(false);

    let parsedPhotos: string[] = [];
    if (Array.isArray(item.photo_urls)) {
        parsedPhotos = item.photo_urls;
    } else if (typeof item.photo_urls === 'string') {
        try { parsedPhotos = JSON.parse(item.photo_urls); } catch (e) {}
    }
    if (parsedPhotos.length === 0 && item.photo_url) {
        parsedPhotos = [item.photo_url];
    }
    
    const photos = parsedPhotos
        .filter(p => typeof p === 'string' && p.startsWith('http'))
        .map(p => {
            if (p.includes('.r2.dev') || p.includes('r2.cloudflarestorage.com')) {
                const parts = p.split('/');
                const fileName = parts[parts.length - 1];
                return `/api/image?file=${fileName}`;
            }
            return p;
        });
    const coverPhoto = photos.length > 0 ? photos[0] : null;

    const openPreview = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (photos.length > 0) {
            setCurrentPhotoIndex(0);
            setIsPreviewOpen(true);
        }
    };

    const nextPhoto = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
    };

    const prevPhoto = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Yakin ingin menghapus laporan ini? Tindakan ini tidak dapat diurungkan dan akan menyinkronkan foto di Telegram.")) return;
        
        setIsDeleting(true);
        try {
            const res = await fetch('/api/report/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id })
            });
            if (res.ok) {
                onDelete?.(item.id);
            } else {
                alert("Gagal menghapus laporan.");
            }
        } catch (e) {
            alert("Terjadi kesalahan.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSaveEdit = async () => {
        try {
            const res = await fetch('/api/report/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id, quantity: editForm.quantity, notes: editForm.notes })
            });
            if (res.ok) {
                onEdit?.(item.id, editForm);
                setIsEditing(false);
            } else {
                alert("Gagal menyimpan perubahan.");
            }
        } catch (e) {
            alert("Terjadi kesalahan.");
        }
    };

    if (isDeleting) {
        return <div className="bg-slate-100 rounded-3xl animate-pulse h-64 border border-slate-200"></div>;
    }

    return (
        <>
            <div className="bg-white rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden flex flex-col relative">
                {/* Menu Kebab */}
                <div className="absolute top-2 right-2 z-20">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                        className="bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm transition"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>
                    </button>
                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-lg border border-slate-100 py-1 flex flex-col text-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                            <button className="px-4 py-2 text-left hover:bg-slate-50 font-semibold text-slate-700" onClick={() => { setIsMenuOpen(false); setIsEditing(true); }}>Edit</button>
                            <button className="px-4 py-2 text-left hover:bg-red-50 font-semibold text-red-600" onClick={(e) => { setIsMenuOpen(false); handleDelete(e); }}>Delete</button>
                        </div>
                    )}
                </div>

                <div 
                    className="relative aspect-video w-full bg-slate-100 overflow-hidden mt-1 mx-1 rounded-t-[22px] cursor-pointer group"
                    onClick={openPreview}
                >
                    {coverPhoto ? (
                        <>
                            <img
                                src={coverPhoto}
                                alt="Eviden"
                                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700"
                            />
                            {photos.length > 1 && (
                                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-2 py-1 flex items-center gap-1 rounded-full z-10">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    {photos.length}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                                <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg transition-opacity duration-300">
                                    Lihat Foto
                                </span>
                            </div>
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

            {/* Edit Modal */}
            {isEditing && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setIsEditing(false)}
                >
                    <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-slate-900 mb-4">Edit Laporan</h3>
                        
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Volume / Quantity</label>
                            <input 
                                type="text" 
                                value={editForm.quantity} 
                                onChange={e => setEditForm(prev => ({ ...prev, quantity: e.target.value }))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                placeholder="Contoh: 15 Meter"
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Catatan Tambahan</label>
                            <textarea 
                                value={editForm.notes} 
                                onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[100px]"
                                placeholder="Tambahkan catatan jika perlu..."
                            ></textarea>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setIsEditing(false)}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={handleSaveEdit}
                                className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-xl transition shadow-md shadow-sky-500/30"
                            >
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Preview Modal */}
            {isPreviewOpen && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                    onClick={() => setIsPreviewOpen(false)}
                >
                    <button 
                        className="absolute top-4 right-4 text-white hover:text-slate-300 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                        onClick={() => setIsPreviewOpen(false)}
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    {photos.length > 1 && (
                        <>
                            <button 
                                className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 text-white hover:text-slate-300 bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors"
                                onClick={prevPhoto}
                            >
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <button 
                                className="absolute right-4 md:right-10 top-1/2 -translate-y-1/2 text-white hover:text-slate-300 bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors"
                                onClick={nextPhoto}
                            >
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </>
                    )}

                    <div className="relative max-w-5xl max-h-screen w-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <img 
                            src={photos[currentPhotoIndex]} 
                            alt={`Preview ${currentPhotoIndex + 1}`} 
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        />
                        {photos.length > 1 && (
                            <div className="absolute bottom-[-40px] text-white/80 font-medium text-sm bg-black/50 px-4 py-1.5 rounded-full">
                                Foto {currentPhotoIndex + 1} dari {photos.length}
                            </div>
                        )}
                        <p className="text-white mt-8 text-xs break-all bg-black/50 px-2 py-1 rounded">Debug URL: {photos[currentPhotoIndex]}</p>
                    </div>
                </div>
            )}
        </>
    );
}

