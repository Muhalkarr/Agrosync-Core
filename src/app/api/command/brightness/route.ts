// File: src/app/api/command/brightness/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(req: Request) {
    try {
        const { kecerahan } = await req.json();
        if (kecerahan === undefined || kecerahan < 0 || kecerahan > 255) {
            return new NextResponse("Invalid brightness value", { status: 400 });
        }
        await db.execute('UPDATE command_queue SET kecerahan = ? WHERE id = 1', [kecerahan]);
        console.log(`[API ROUTE] Kecerahan LED diperbarui secara senyap ke: ${kecerahan}/255`);
        return new NextResponse("OK", { status: 200 });
    } catch (error: any) {
        console.error('[API ROUTE ERROR / BRIGHTNESS]', error.message);
        return new NextResponse('SERVER_ERROR', { status: 500 });
    }
}