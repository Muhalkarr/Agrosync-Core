// File: src/app/api/telemetry/latest/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
   try {
       const [rows] = await db.execute('SELECT * FROM mikroklimat ORDER BY waktu_rekam DESC LIMIT 1');

       if (Array.isArray(rows) && rows.length > 0) {
           // Non-aktifkan caching untuk data real-time
           return NextResponse.json(rows[0], { 
               status: 200,
               headers: { 'Cache-Control': 'no-store, max-age=0' }
           });
       } else {
           return NextResponse.json({ message: "Data kosong" }, { status: 404 });
       }
   } catch (error: any) {
       console.error('[API ROUTE ERROR / LATEST]', error.message);
       return NextResponse.json({ error: error.message }, { status: 500 });
   }
}
