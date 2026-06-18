// File: src/app/api/telemetry/history/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        const [rows] = await db.execute(
            'SELECT waktu_rekam, suhu, kelembaban, kecepatan_angin FROM mikroklimat ORDER BY waktu_rekam DESC LIMIT 20'
        );

        // Di Express, Anda melakukan reverse(). Di sini kita bisa langsung kirim. Frontend yang akan melakukan reverse jika perlu.
        return NextResponse.json(rows, { status: 200 });
    } catch (error: any) {
        console.error('[API ROUTE ERROR / TELEMETRY HISTORY]', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}