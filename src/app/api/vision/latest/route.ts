// File: src/app/api/vision/latest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const [rows]: any = await db.execute('SELECT * FROM visi_edge ORDER BY waktu_tangkap DESC LIMIT 1');
        
        if (rows.length > 0) {
            const data = rows[0];
            
            return NextResponse.json(data, {
                status: 200,
                headers: { 'Cache-Control': 'no-store, max-age=0' }
            });
        } else {
            return NextResponse.json({ message: "Belum ada gambar" }, { status: 404 });
        }
    } catch (error: any) {
        console.error('[API ROUTE ERROR / VISION LATEST]', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}