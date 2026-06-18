// File: src/app/api/telemetry/stats/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        // Jalankan semua query agregasi secara paralel untuk performa maksimal
        const [statsResult]: any = await db.query(`
            SELECT
                MAX(suhu) as maxSuhu,
                AVG(kelembaban) as avgKelembaban,
                AVG(kecepatan_angin) as avgAngin,
                SUM(CASE WHEN status_alert = 1 THEN 1 ELSE 0 END) as totalAlerts
            FROM mikroklimat
        `);

        const stats = statsResult[0];

        return NextResponse.json({
            maxSuhu: parseFloat(stats.maxSuhu) || 0,
            avgKelembaban: Math.round(parseFloat(stats.avgKelembaban)) || 0,
            avgAngin: parseFloat(parseFloat(stats.avgAngin).toFixed(1)) || 0,
            totalAlerts: parseInt(stats.totalAlerts) || 0
        });

    } catch (error: any) {
        console.error('[API ROUTE ERROR / TELEMETRY STATS]', error.message);
        return NextResponse.json({ error: "Gagal menghitung statistik." }, { status: 500 });
    }
}