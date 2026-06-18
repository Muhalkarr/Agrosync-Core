// File: src/app/api/telemetry/latest/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db'; // Memanggil koneksi database kita

export async function GET() {
    try {
        const [rows] = await db.execute('SELECT * FROM mikroklimat ORDER BY waktu_rekam DESC LIMIT 1');
        
        // rows adalah array, kita cek isinya
        if (Array.isArray(rows) && rows.length > 0) {
            return NextResponse.json(rows[0], { status: 200 });
        } else {
            return NextResponse.json({ message: "Data kosong" }, { status: 404 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}