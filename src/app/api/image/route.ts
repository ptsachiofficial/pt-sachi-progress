import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/lib/r2";

export async function GET(req: NextRequest) {
    const file = req.nextUrl.searchParams.get("file");
    if (!file) {
        return new NextResponse("File parameter is missing", { status: 400 });
    }

    try {
        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: file,
        });

        const data = await s3Client.send(command);
        
        // Convert to byte array to safely return as buffer
        const byteArray = await data.Body?.transformToByteArray();

        if (!byteArray) {
            return new NextResponse("Failed to read image body", { status: 500 });
        }

        // Convert Uint8Array to Buffer which satisfies Next.js BodyInit type
        const buffer = Buffer.from(byteArray);

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": data.ContentType || "image/jpeg",
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error: any) {
        console.error("Image proxy error:", error);
        return new NextResponse("Image not found", { status: 404 });
    }
}
