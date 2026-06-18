// File: src/app/api/telemetry/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';

// Gunakan global object agar memori lastTelemetryInsert tetap bertahan
// selama server Node.js (dalam mode dev) menyala.
const globalState = global as any;
if (!globalState.lastTelemetryInsert) {
   globalState.lastTelemetryInsert = 0;
}
const DB_INSERT_INTERVAL = 60000; // 60 Detik

export async function POST(req: Request) {
   try {
       const body = await req.json();

       if (!body || Object.keys(body).length === 0) {
           return new NextResponse('BAD_REQUEST_NO_BODY', { status: 400 });
       }

       const { suhu, kelembaban, angin, alert } = body;
       const suhuValue = parseFloat(suhu);
       const kelembabanValue = parseFloat(kelembaban);
       const anginValue = parseFloat(angin);
       const alertValue = alert === undefined ? 0 : Number(alert);

       if (
           Number.isNaN(suhuValue) || Number.isNaN(kelembabanValue) || 
           Number.isNaN(anginValue) || Number.isNaN(alertValue) ||
           (alertValue !== 0 && alertValue !== 1)
       ) {
           return new NextResponse('BAD_PAYLOAD_STRUCTURE', { status: 400 });
       }

       // SMART THROTTLING
       const currentTime = Date.now();
       if ((currentTime - globalState.lastTelemetryInsert >= DB_INSERT_INTERVAL) || alertValue === 1) {
           const insertQuery = 'INSERT INTO mikroklimat (suhu, kelembaban, kecepatan_angin, status_alert) VALUES (?, ?, ?, ?)';
           await db.execute(insertQuery, [suhuValue, kelembabanValue, anginValue, alertValue]);
           globalState.lastTelemetryInsert = currentTime;
           console.log(`[API ROUTE] Data Iklim disave. (Suhu: ${suhu}C)`);
       }

       // PIGGYBACK POLLING (Mengecek perintah potret dari Dashboard)
       const [rows]: any = await db.execute('SELECT status_perintah FROM command_queue WHERE id = 1');
       if (rows.length > 0 && rows[0].status_perintah === 1) {
           await db.execute('UPDATE command_queue SET status_perintah = 0 WHERE id = 1');
           console.log('[API ROUTE] Instruksi CMD_CAPTURE ditembakkan!');
           return new NextResponse('CMD_CAPTURE', { status: 200 }); // Kirim perintah ke NodeMCU
       } else {
           return new NextResponse('OK', { status: 200 });
       }

   } catch (error: any) {
       console.error('[API ROUTE ERROR / TELEMETRY]', error.message);
       return new NextResponse('SERVER_ERROR', { status: 500 });
   }
}
