// File: src/app/api/vision/archive/route.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '12');
        const filterLabel = searchParams.get('label') || 'ALL';
        
        const offset = (page - 1) * limit;

        let dataQuery = 'SELECT * FROM visi_edge';
        let countQuery = 'SELECT COUNT(*) as total FROM visi_edge';
        let queryParams: (string | number)[] = [];

        if (filterLabel !== 'ALL') {
            dataQuery += ' WHERE manual_label = ?';
            countQuery += ' WHERE manual_label = ?';
            queryParams.push(filterLabel);
        }

        dataQuery += ' ORDER BY waktu_tangkap DESC LIMIT ? OFFSET ?';
        
        const [rows] = await db.query(dataQuery, [...queryParams, limit, offset]);
        const [countRows]: any = await db.query(countQuery, queryParams);
        
        const host = req.headers.get('host');
        const protocol = req.headers.get('x-forwarded-proto') || 'http';
        const baseUrl = `${protocol}://${host}`;

        const totalItems = countRows[0].total;
        const totalPages = Math.ceil(totalItems / limit);

        const formattedRows = (rows as any[]).map(row => ({
            ...row,
            image_url: `${baseUrl}${row.file_path}`
        }));

        return NextResponse.json({
            images: formattedRows,
            pagination: {
                current_page: page,
                total_pages: totalPages,
                total_items: totalItems
            }
        });
    } catch (error: any) {
        console.error('[API ROUTE ERROR / VISION ARCHIVE]', error.message);
        return NextResponse.json({ error: "Gagal menarik data arsip visi." }, { status: 500 });
    }
}