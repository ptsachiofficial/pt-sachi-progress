import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import archiver from "archiver";
import { Writable } from "stream";

// Helper function to safely fetch image buffers
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (e) {
        return null; // Ignore failed fetches
    }
}

// Ensure Edge runtime can handle streams if Next.js throws an error, but 'archiver' is a Node module.
// So we must force the route to run in 'nodejs' runtime.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("id");

    if (!projectId) {
        return NextResponse.json({ error: "Missing Project ID" }, { status: 400 });
    }

    // Ambil data detail project
    const { data: project } = await supabase.from('master_project').select('*').eq('id', projectId).single();
    if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Ambil semua laporan untuk project tersebut
    // Kita cek dlu view, jika error / tidak ada, fallback ke laporan_kerja
    let reports = [];
    const { data: viewData, error: viewError } = await supabase.from('view_laporan_lengkap').select('*').eq('project_name', project.project_name);
    
    if (viewError) {
        const { data: tableData } = await supabase.from('laporan_kerja').select('*').eq('project_id', projectId);
        reports = tableData || [];
    } else {
        reports = viewData || [];
    }

    if (reports.length === 0) {
        return NextResponse.json({ error: "No reports to download for this project" }, { status: 404 });
    }

    // Setup streaming archiver to standard Node Transform Stream
    const { readable, writable } = new TransformStream();
    
    // In node.js we can convert standard web streams back to Node Writeable if needed, but the simpler approach for archiver with Web Streams API inside NextJs App Router is using passThrough.
    const { PassThrough } = require('stream');
    const passThrough = new PassThrough();

    const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
    });

    archive.on('error', (err) => {
        console.error("Archive Error:", err);
    });

    // Pipe archive output to passthrough stream
    archive.pipe(passThrough);

    // Proses download & zip secara asynchronous tanpa memblokir response HTTP
    (async () => {
        let photoCount = 0;

        for (const rep of reports) {
            // Bersihkan nama string file dan folder supaya gak nyangkut karena \ / : * ? " < > |
            const sanitize = (name: string) => (name || 'Lainnya').replace(/[\\/:*?"<>|]/g, '-');
            
            const catFolder = sanitize(rep.task_category);
            const desigFolder = sanitize(rep.boq_name || rep.task_name);

            // Fetch fotonya jika ada
            const photos = Array.isArray(rep.photo_urls) ? rep.photo_urls : (rep.photo_url ? [rep.photo_url] : []);
            
            for (let i = 0; i < photos.length; i++) {
                const url = photos[i];
                if (!url) continue;

                const buf = await fetchImageBuffer(url);
                if (buf) {
                    const ext = url.split('.').pop() || 'jpg';
                    const dateStr = (rep.created_at || '').split('T')[0] || 'UnknownDate';
                    // Susun nama file: YYYY-MM-DD_TelegramID_Urutan.jpg
                    const fileName = `${dateStr}_${rep.telegram_id}_photo${i+1}.${ext}`;
                    
                    // Folder structure: /Kategori Laporan/Designator/Tanggal.jpg
                    const filePath = `${catFolder}/${desigFolder}/${fileName}`;
                    
                    archive.append(buf, { name: filePath });
                    photoCount++;
                }
            }
        }

        // Kalau ternyata gak ada foto tersimpan atau error smua
        if (photoCount === 0) {
            archive.append("Tidak ada foto pada laporan project ini.", { name: "README.txt" });
        } else {
            archive.append(`Project Name: ${project.project_name}\nTotal Reports: ${reports.length}\nTotal Eviden Downloaded: ${photoCount}\n`, { name: "INFO_PROJECT.txt" });
        }

        archive.finalize();
    })();

    // Gunakan passthrough (Node stream) langsung sebagai web stream yang dimengerti Next.js 13+
    // Note: TypeScript might complain, tapi 'passThrough as any' bekerja dgn baik di App Router.
    const response = new NextResponse(passThrough as any, {
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="Eviden_${project.project_name.replace(/[^a-z0-9]/gi, '_')}.zip"`
        }
    });

    return response;
}
