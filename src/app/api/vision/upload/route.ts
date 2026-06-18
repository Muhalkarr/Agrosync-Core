// File: src/app/api/vision/upload/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
    try {
        const imageBuffer = Buffer.from(await req.arrayBuffer());

        if (!imageBuffer || imageBuffer.length === 0) {
            return new NextResponse('EMPTY_PAYLOAD', { status: 400 });
        }
        // Validasi sederhana untuk file JPEG
        if (imageBuffer[0] !== 0xFF || imageBuffer[1] !== 0xD8 || imageBuffer[2] !== 0xFF) {
            return new NextResponse('CORRUPTED_FILE', { status: 400 });
        }

        const timestamp = Date.now();
        const filename = `edge_vision_${timestamp}.jpg`;
        // Simpan di dalam folder `public/uploads` agar bisa diakses langsung
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await fs.mkdir(uploadDir, { recursive: true }); // Buat folder jika belum ada
        const filepath = path.join(uploadDir, filename);
        const fileSizeKb = Math.round(imageBuffer.length / 1024);

        await fs.writeFile(filepath, imageBuffer);
        console.log(`[API ROUTE] File ${filename} (${fileSizeKb} KB) disimpan.`);

        await db.execute('INSERT INTO visi_edge (file_path, file_size_kb) VALUES (?, ?)', [`/uploads/${filename}`, fileSizeKb]);

        return new NextResponse('IMAGE_SAVED', { status: 200 });
    } catch (error: any) {
        console.error('[API ROUTE ERROR / UPLOAD]', error.message);
        return new NextResponse('SERVER_ERROR', { status: 500 });
    }
}