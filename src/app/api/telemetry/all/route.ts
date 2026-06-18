// File: src/app/api/telemetry/all/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        const [rows] = await db.execute(
            'SELECT waktu_rekam, suhu, kelembaban, kecepatan_angin, status_alert FROM mikroklimat ORDER BY waktu_rekam DESC'
        );

        return NextResponse.json(rows, {
            status: 200,
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, private' }
        });
    } catch (error: any) {
        console.error('[API ROUTE ERROR / TELEMETRY ALL]', error.message);
        return NextResponse.json({ error: "Gagal mengekstrak seluruh data gudang." }, { status: 500 });
    }
}