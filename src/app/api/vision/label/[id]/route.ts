// File: src/app/api/vision/label/[id]/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = params; // Ambil ID dari URL
        const { label } = await req.json(); // Ambil label dari body

        const validLabels = ['UNLABELED', 'HAMA', 'NORMAL', 'BURAM'];
        if (!validLabels.includes(label)) {
            return new NextResponse("Format label tidak valid!", { status: 400 });
        }

        await db.execute('UPDATE visi_edge SET manual_label = ? WHERE id = ?', [label, id]);
        
        console.log(`[API ROUTE] Berkas ID ${id} berhasil dilabeli sebagai: ${label}`);
        return new NextResponse("LABEL_UPDATED", { status: 200 });

    } catch (error: any) {
        console.error('[API ROUTE ERROR / LABEL]', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}