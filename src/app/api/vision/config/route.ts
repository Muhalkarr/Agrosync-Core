// File: src/app/api/vision/config/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        const [rows]: any = await db.execute('SELECT kecerahan FROM command_queue WHERE id = 1');
        const kecerahan = rows.length > 0 ? rows[0].kecerahan : 20;

        // Kirim hanya angka mentah (Plain Text) untuk menghemat RAM ESP32-CAM
        return new NextResponse(kecerahan.toString(), { status: 200 });
    } catch (error) {
        // Jika database error, kirim angka aman default (20)
        return new NextResponse("20", { status: 500 });
    }
}