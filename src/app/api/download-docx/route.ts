import { NextRequest, NextResponse } from "next/server";
import { generateDocxReports } from "@/lib/docxHelper";
import archiver from "archiver";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("id");
    const category = searchParams.get("cat"); // optional

    if (!projectId) {
        return NextResponse.json({ error: "Missing Project ID" }, { status: 400 });
    }

    try {
        const reports = await generateDocxReports(projectId, category || undefined);

        if (!reports || reports.length === 0) {
            return NextResponse.json({ error: "No data available for DOCX" }, { status: 404 });
        }

        // If there's only 1 part, just return the docx file directly
        if (reports.length === 1) {
            const report = reports[0];
            const cleanCat = report.catName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);
            const filename = `Report_${cleanCat}_${projectId.slice(0, 5)}.docx`;

            return new NextResponse(report.buffer as any, {
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "Content-Disposition": `attachment; filename="${filename}"`
                }
            });
        }

        // If there are multiple parts, zip them
        const { PassThrough } = require('stream');
        const passThrough = new PassThrough();
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => console.error("Archive Error:", err));
        archive.pipe(passThrough);

        for (const report of reports) {
            const cleanCat = report.catName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);
            const filename = `Report_${cleanCat}_${projectId.slice(0, 5)}_Part${report.part}.docx`;
            archive.append(report.buffer, { name: filename });
        }

        archive.finalize();

        return new NextResponse(passThrough as any, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="Reports_DOCX_${projectId.slice(0, 5)}.zip"`
            }
        });

    } catch (e: any) {
        console.error("DOCX download error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
