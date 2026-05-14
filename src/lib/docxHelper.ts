import { supabase } from "@/lib/supabase";
import lodash from 'lodash';
import { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, UnderlineType, VerticalAlign, SectionType } from 'docx';

export async function generateDocxReports(projectId: string, selectedCategory?: string): Promise<{ buffer: Buffer, part: number, totalParts: number, catName: string }[]> {
    const { data: p } = await supabase.from('master_project').select('*').eq('id', projectId).single();
    
    let query = supabase.from('evidences').select('*').eq('project_id', projectId);
    if (selectedCategory) {
        query = query.eq('category', selectedCategory);
    }
    const { data: evidences } = await query;

    if (!p) throw new Error("Project not found");

    const reports: { buffer: Buffer, part: number, totalParts: number, catName: string }[] = [];
    const maxEvidencesPerDoc = 100;
    const evs = evidences || [];
    
    // Split into chunks of max 100 evidences
    const chunks = lodash.chunk(evs, maxEvidencesPerDoc);
    const totalParts = chunks.length || 1;

    for (let part = 0; part < totalParts; part++) {
        const chunkEvs = chunks[part] || [];
        const sections: any[] = [];
        const grouped = lodash.groupBy(chunkEvs, 'category');

        for (const category of Object.keys(grouped)) {
            const catEvidences = grouped[category];
            const photoChunks = lodash.chunk(catEvidences, 4);

            for (const [chunkIdx, chunk] of photoChunks.entries()) {
                const pageChildren: any[] = [];

                // 1. DYNAMIC CATEGORY TITLE (Centered, Underlined, Bold)
                pageChildren.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: category.toUpperCase() + (totalParts > 1 ? ` (Part ${part + 1})` : ''),
                            bold: true,
                            underline: { type: UnderlineType.SINGLE },
                            size: 28,
                        }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                }));

                // 2. Info Table (With Top & Bottom borders)
                const headerTable = new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                        bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                        insideHorizontal: { style: BorderStyle.NONE },
                        insideVertical: { style: BorderStyle.NONE },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Proyek", bold: true })] })], width: { size: 25, type: WidthType.PERCENTAGE } }),
                                new TableCell({ children: [new Paragraph(`: ${p.project_name || '-'}`)] }),
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "No Kontrak", bold: true })] })] }),
                                new TableCell({ children: [new Paragraph(`: Sachi21032026`)] }),
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Nomor PO", bold: true })] })] }),
                                new TableCell({ children: [new Paragraph(`: Sachi21032026`)] }),
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Lokasi", bold: true })] })] }),
                                new TableCell({ children: [new Paragraph(`: ${p.lokasi || '-'}`)] }),
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Site Operation", bold: true })] })] }),
                                new TableCell({ children: [new Paragraph(`: Sachi21032026`)] }),
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Pelaksana", bold: true })] })] }),
                                new TableCell({ children: [new Paragraph(`: ${p.nama_mitra || '-'}`)] }),
                            ]
                        }),
                    ],
                });
                pageChildren.push(headerTable);
                pageChildren.push(new Paragraph({ text: "", spacing: { after: 300 } }));

                // 4. Evidence Photo Grid (2x2 Portrait Boxes)
                const imagesInChunk: any[] = [];
                for (const ev of chunk) {
                    if (ev.r2_url) {
                        try {
                            const res = await fetch(ev.r2_url);
                            const buffer = Buffer.from(await res.arrayBuffer());
                            imagesInChunk.push(new ImageRun({
                                data: buffer,
                                transformation: { width: 241, height: 328 }, // 6.39cm x 8.68cm approx
                                type: 'jpg'
                            }));
                        } catch (e) { imagesInChunk.push(null); }
                    } else { imagesInChunk.push(null); }
                }

                const createPhotoCell = (imgRun: any) => new TableCell({
                    children: [
                        new Paragraph({
                            children: imgRun ? [imgRun] : [new TextRun({ text: "LETAK FOTO", color: "888888", size: 16 })],
                            alignment: AlignmentType.CENTER,
                        })
                    ],
                    width: { size: 48, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 2 },
                        bottom: { style: BorderStyle.SINGLE, size: 2 },
                        left: { style: BorderStyle.SINGLE, size: 2 },
                        right: { style: BorderStyle.SINGLE, size: 2 },
                    },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 50, bottom: 50 }
                });

                const createSpacerCell = () => new TableCell({
                    children: [new Paragraph("")],
                    width: { size: 4, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                    }
                });

                const photoRows = [
                    new TableRow({
                        children: [createPhotoCell(imagesInChunk[0]), createSpacerCell(), createPhotoCell(imagesInChunk[1])]
                    }),
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph("")],
                                columnSpan: 3,
                                borders: {
                                    top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                                    left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
                                }
                            })
                        ]
                    }),
                    new TableRow({
                        children: [createPhotoCell(imagesInChunk[2]), createSpacerCell(), createPhotoCell(imagesInChunk[3])]
                    }),
                ];

                const photoTable = new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        insideHorizontal: { style: BorderStyle.NONE },
                        insideVertical: { style: BorderStyle.NONE },
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE }
                    },
                    rows: photoRows
                });

                pageChildren.push(photoTable);
                sections.push({ children: pageChildren, properties: { type: SectionType.NEXT_PAGE } });
            }
        }

        if (sections.length === 0) {
            sections.push({ children: [new Paragraph("Belum ada evidens foto.")] });
        }

        const doc = new Document({ sections });
        const buffer = await Packer.toBuffer(doc);
        reports.push({ buffer, part: part + 1, totalParts, catName: selectedCategory || "ALL" });
    }

    return reports;
}
