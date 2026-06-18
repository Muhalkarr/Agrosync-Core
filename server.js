/**
 * ==============================================================================
 * AGROSYNC CORE - STANDALONE API SERVER
 * Didesain untuk berjalan di lingkungan Node.js cPanel atau VPS.
 * ==============================================================================
 */

const express = require('express');
const mysql = require('mysql2/promise');
const fs = require('fs/promises');
const path = require('path');
const cors = require('cors');

const app = express();
require('dotenv').config({ path: '.env.local' }); // Pastikan membaca .env.local
const PORT = process.env.API_PORT || 3001; // Jalankan API di port yang berbeda
const isProduction = process.env.NODE_ENV === 'production';

// --- KONFIGURASI ---
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'agrosync_db',
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0
});

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
// Sajikan gambar dari folder `public/uploads` (hanya untuk pengembangan lokal)
if (!isProduction) {
    app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
}

// --- STATE UNTUK THROTTLING ---
let lastTelemetryInsert = 0;
const DB_INSERT_INTERVAL = 60000; // 60 Detik

// --- API ROUTES ---

// [POST] /api/telemetry - Menerima data dari NodeMCU
app.post('/api/telemetry', async (req, res) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).send('BAD_REQUEST_NO_BODY');
        }
        const { suhu, kelembaban, angin, alert } = req.body;
        const suhuValue = parseFloat(suhu);
        const kelembabanValue = parseFloat(kelembaban);
        const anginValue = parseFloat(angin);
        const alertValue = alert === undefined ? 0 : Number(alert);

        if (Number.isNaN(suhuValue) || Number.isNaN(kelembabanValue) || Number.isNaN(anginValue) || Number.isNaN(alertValue) || (alertValue !== 0 && alertValue !== 1)) {
            return res.status(400).send('BAD_PAYLOAD_STRUCTURE');
        }

        const currentTime = Date.now();
        if ((currentTime - lastTelemetryInsert >= DB_INSERT_INTERVAL) || alertValue === 1) {
            await db.execute('INSERT INTO mikroklimat (suhu, kelembaban, kecepatan_angin, status_alert) VALUES (?, ?, ?, ?)', [suhuValue, kelembabanValue, anginValue, alertValue]);
            lastTelemetryInsert = currentTime;
            console.log(`[API] Data Iklim disave. (Suhu: ${suhu}C)`);
        }

        const [rows] = await db.execute('SELECT status_perintah FROM command_queue WHERE id = 1');
        if (rows.length > 0 && rows[0].status_perintah === 1) {
            await db.execute('UPDATE command_queue SET status_perintah = 0 WHERE id = 1');
            console.log('[API] Instruksi CMD_CAPTURE ditembakkan!');
            res.status(200).send('CMD_CAPTURE');
        } else {
            res.status(200).send('OK');
        }
    } catch (error) {
        console.error('[API ERROR /telemetry]', error.message);
        res.status(500).send('SERVER_ERROR');
    }
});

// [POST] /api/vision/upload - Menerima gambar dari ESP32-CAM (Logika Lokal)
app.post('/api/vision/upload', express.raw({ type: 'image/jpeg', limit: '2mb' }), async (req, res) => {
    try {
        const imageBuffer = req.body;
        if (!imageBuffer || imageBuffer.length === 0) return res.status(400).send('EMPTY_PAYLOAD');
        if (imageBuffer[0] !== 0xFF || imageBuffer[1] !== 0xD8 || imageBuffer[2] !== 0xFF) return res.status(400).send('CORRUPTED_FILE');

        const timestamp = Date.now();
        const filename = `edge_vision_${timestamp}.jpg`;
        // Arahkan penyimpanan ke folder di dalam public_html agar dapat diakses oleh web server utama
        const uploadDir = isProduction
            ? path.join(__dirname, '..', 'public_html', 'uploads') // Path produksi cPanel
            : path.join(__dirname, 'public', 'uploads');          // Path pengembangan lokal
        await fs.mkdir(uploadDir, { recursive: true });
        const filepath = path.join(uploadDir, filename);
        const publicPath = `/uploads/${filename}`;
        const fileSizeKb = Math.round(imageBuffer.length / 1024);

        await fs.writeFile(filepath, imageBuffer);
        console.log(`[API] File ${filename} (${fileSizeKb} KB) disimpan.`);

        await db.execute('INSERT INTO visi_edge (file_path, file_size_kb, image_url) VALUES (?, ?, ?)', [publicPath, fileSizeKb, publicPath]);
        res.status(200).send('IMAGE_SAVED');
    } catch (error) {
        console.error('[API ERROR /vision/upload]', error.message);
        res.status(500).send('SERVER_ERROR');
    }
});

// [GET] /api/telemetry/latest - Data telemetri terbaru
app.get('/api/telemetry/latest', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM mikroklimat ORDER BY waktu_rekam DESC LIMIT 1');
        if (rows.length > 0) res.status(200).json(rows[0]);
        else res.status(404).json({ message: "Data kosong" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// [GET] /api/telemetry/all - Semua data telemetri
app.get('/api/telemetry/all', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM mikroklimat ORDER BY waktu_rekam DESC');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ error: "Gagal mengekstrak seluruh data gudang." });
    }
});

// [GET] /api/telemetry/stats - Statistik agregat
app.get('/api/telemetry/stats', async (req, res) => {
    try {
        const [statsResult] = await db.query(`
            SELECT
                MAX(suhu) as maxSuhu, AVG(kelembaban) as avgKelembaban,
                AVG(kecepatan_angin) as avgAngin,
                SUM(CASE WHEN status_alert = 1 THEN 1 ELSE 0 END) as totalAlerts
            FROM mikroklimat
        `);
        const stats = statsResult[0];
        res.json({
            maxSuhu: parseFloat(stats.maxSuhu) || 0,
            avgKelembaban: Math.round(parseFloat(stats.avgKelembaban)) || 0,
            avgAngin: parseFloat(parseFloat(stats.avgAngin).toFixed(1)) || 0,
            totalAlerts: parseInt(stats.totalAlerts) || 0
        });
    } catch (error) {
        res.status(500).json({ error: "Gagal menghitung statistik." });
    }
});

// [GET] /api/vision/latest - Gambar terbaru
app.get('/api/vision/latest', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM visi_edge ORDER BY waktu_tangkap DESC LIMIT 1');
        if (rows.length > 0) {
            const data = rows[0];
            res.status(200).json(data);
        } else {
            res.status(404).json({ message: "Belum ada gambar" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// [GET] /api/vision/archive - Arsip gambar dengan paginasi
app.get('/api/vision/archive', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const filterLabel = req.query.label || 'ALL';
        const offset = (page - 1) * limit;

        let dataQuery = 'SELECT * FROM visi_edge';
        let countQuery = 'SELECT COUNT(*) as total FROM visi_edge';
        let queryParams = [];
        if (filterLabel !== 'ALL') {
            dataQuery += ' WHERE manual_label = ?';
            countQuery += ' WHERE manual_label = ?';
            queryParams.push(filterLabel);
        }
        dataQuery += ' ORDER BY waktu_tangkap DESC LIMIT ? OFFSET ?';

        const [rows] = await db.query(dataQuery, [...queryParams, limit, offset]);
        const [countRows] = await db.query(countQuery, queryParams);

        const totalItems = countRows[0].total;
        const totalPages = Math.ceil(totalItems / limit);

        res.status(200).json({
            images: rows,
            pagination: { current_page: page, total_pages: totalPages, total_items: totalItems }
        });
    } catch (error) {
        res.status(500).json({ error: "Gagal menarik data arsip visi." });
    }
});

// [PUT] /api/vision/label/:id - Melabeli gambar
app.put('/api/vision/label/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { label } = req.body;
        const validLabels = ['UNLABELED', 'HAMA', 'NORMAL', 'BURAM'];
        if (!validLabels.includes(label)) {
            return res.status(400).send("Format label tidak valid!");
        }
        await db.execute('UPDATE visi_edge SET manual_label = ? WHERE id = ?', [label, id]);
        res.status(200).send("LABEL_UPDATED");
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// [POST] /api/command/trigger-camera - Memicu kamera dari dasbor
app.post('/api/command/trigger-camera', async (req, res) => {
    try {
        const kecerahan = req.body.kecerahan !== undefined ? req.body.kecerahan : 20;
        await db.execute('UPDATE command_queue SET status_perintah = 1, kecerahan = ? WHERE id = 1', [kecerahan]);
        res.status(200).json({ message: "Perintah dimasukkan antrean." });
    } catch (error) {
        res.status(500).json({ error: "Gagal memproses perintah." });
    }
});

// [PUT] /api/command/brightness - Sinkronisasi slider kecerahan
app.put('/api/command/brightness', async (req, res) => {
    try {
        const { kecerahan } = req.body;
        if (kecerahan === undefined || kecerahan < 0 || kecerahan > 255) {
            return res.status(400).send("Invalid brightness value");
        }
        await db.execute('UPDATE command_queue SET kecerahan = ? WHERE id = 1', [kecerahan]);
        res.status(200).send("OK");
    } catch (error) {
        res.status(500).send("SERVER_ERROR");
    }
});

// --- SERVER START ---
app.listen(PORT, () => {
    console.log(`[AGROSYNC API SERVER] Berjalan di http://localhost:${PORT}`);
});