// File: src/app/api/vision/upload/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { put } from '@vercel/blob'; // <-- Impor fungsi 'put' dari Vercel Blob

export async function POST(req: Request) {
    try {
        const imageBuffer = Buffer.from(await req.arrayBuffer());

        if (!imageBuffer || imageBuffer.length === 0) {
            return new NextResponse('EMPTY_PAYLOAD', { status: 400 });
        }
        if (imageBuffer[0] !== 0xFF || imageBuffer[1] !== 0xD8 || imageBuffer[2] !== 0xFF) {
            return new NextResponse('CORRUPTED_FILE', { status: 400 });
        }

        const timestamp = Date.now();
        const filename = `edge_vision_${timestamp}.jpg`;
        const fileSizeKb = Math.round(imageBuffer.length / 1024);

        // --- LOGIKA BARU: Unggah ke Vercel Blob ---
        const blob = await put(filename, imageBuffer, {
            access: 'public', // Jadikan file dapat diakses secara publik
            contentType: 'image/jpeg',
        });
        // `blob.url` akan berisi URL publik yang permanen
        // -----------------------------------------

        console.log(`[API ROUTE] File ${filename} (${fileSizeKb} KB) diunggah ke Vercel Blob.`);

        // Simpan URL permanen dari Vercel Blob, bukan path lokal
        await db.execute('INSERT INTO visi_edge (file_path, file_size_kb, image_url) VALUES (?, ?, ?)', [filename, fileSizeKb, blob.url]);

        return new NextResponse('IMAGE_SAVED', { status: 200 });
    } catch (error: any) {
        console.error('[API ROUTE ERROR / UPLOAD]', error.message);
        return new NextResponse('SERVER_ERROR', { status: 500 });
    }
}