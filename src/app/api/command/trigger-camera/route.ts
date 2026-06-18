// File: src/app/api/command/trigger-camera/route.ts (Correct Path)
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const kecerahan = body.kecerahan !== undefined ? body.kecerahan : 20;

        await db.execute('UPDATE command_queue SET status_perintah = 1, kecerahan = ? WHERE id = 1', [kecerahan]);

        console.log(`[API ROUTE] Inspeksi Manual diterima. Kecerahan LED diatur ke: ${kecerahan}/255`);
        return NextResponse.json({ message: "Perintah dimasukkan antrean." }, { status: 200 });
    } catch (error: any) {
        console.error('[API ROUTE ERROR / TRIGGER]', error.message);
        return NextResponse.json({ error: "Gagal memproses perintah." }, { status: 500 });
    }
}