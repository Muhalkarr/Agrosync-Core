/**
 * ==============================================================================
 * AGROSYNC CORE BACKEND SERVER (FINAL BUILD)
 * ARSITEKTUR : Asynchronous Non-Blocking I/O, Database Throttling, API Distributor
 * ==============================================================================
 */

const express = require('express');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- MANAJEMEN STATUS GLOBAL DI RAM (Ultra-Low Latency) ---
// Menyimpan kecerahan agar tidak perlu membaca database terus menerus
let currentFlashBrightness = 15;

// --- FUNGSI FORMAT WAKTU ABSOLUT (WIB) ---
const logTime = (message) => {
    const timeStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    console.log(`[${timeStr}] ${message}`);
};

// PILAR D: Manajemen Sistem File Lokal (Penyimpanan Gambar Edge)
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

// PILAR B: Optimasi Koneksi Database (Connection Pooling)
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'agrosync_db',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0
});

// // Middleware Global
// app.use(cors());
// app.use('/uploads', express.static(UPLOAD_DIR));

// ==============================================================================
// BLOK 0: MIDDLEWARE & KEAMANAN (WAJIB PALING ATAS)
// ==============================================================================

// 1. Injeksi CORS (Mengizinkan Akses Lintas Jaringan / Ponsel)
app.use(cors({
    origin: [
        '*', // Sementara gunakan asterisk (*) sampai sistem stabil, lalu ganti dengan domain Anda
        'https://agrosync.analyzer.web.id'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Parser JSON untuk menerima data payload (seperti nilai kecerahan)
app.use(express.json());

// 3. Ekspos Folder Uploads agar gambar bisa diakses publik (Browser/Ponsel)
// PERBAIKAN MUTLAK: Gunakan __dirname, BUKAN __shrink
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Memori penahan untuk Database Throttling
let lastTelemetryInsert = 0;
const DB_INSERT_INTERVAL = 60000; // 60 Detik

/**
 * ==============================================================================
 * BLOK 1: PENERIMAAN DATA (DATA INGESTION - DARI PERANGKAT KERAS)
 * ==============================================================================
 */

// A. Endpoint Telemetri (Dari NodeMCU)
app.post('/api/telemetry', express.json(), async(req, res) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).send('BAD_REQUEST_NO_BODY');
        }

        const { suhu, kelembaban, angin, alert } = req.body;
        const suhuValue = parseFloat(suhu);
        const kelembabanValue = parseFloat(kelembaban);
        const anginValue = parseFloat(angin);
        const alertValue = alert === undefined ? 0 : Number(alert);

        if (
            Number.isNaN(suhuValue) ||
            Number.isNaN(kelembabanValue) ||
            Number.isNaN(anginValue) ||
            Number.isNaN(alertValue) ||
            (alertValue !== 0 && alertValue !== 1)
        ) {
            console.warn('[API TELEMETRY PAYLOAD]', req.body);
            return res.status(400).send('BAD_PAYLOAD_STRUCTURE');
        }

        // SMART THROTTLING (60 Detik atau Darurat)
        const currentTime = Date.now();
        if ((currentTime - lastTelemetryInsert >= DB_INSERT_INTERVAL) || alertValue === 1) {
            const insertQuery = 'INSERT INTO mikroklimat (suhu, kelembaban, kecepatan_angin, status_alert) VALUES (?, ?, ?, ?)';
            await db.execute(insertQuery, [suhuValue, kelembabanValue, anginValue, alertValue]);
            lastTelemetryInsert = currentTime;

            // INJEKSI STEMPEL WAKTU (TIMESTAMP)
            const timeStr = new Date().toLocaleTimeString('id-ID', { hour12: false });
            console.log(`[${timeStr}] [DB SUCCESS] Data Iklim disave. (Suhu: ${suhu}C, Kelembaban: ${kelembaban}%, Angin: ${angin} m/s, Alert: ${alert})`);
        }

        // PIGGYBACK POLLING
        const [rows] = await db.execute('SELECT status_perintah FROM command_queue WHERE id = 1');
        if (rows.length > 0 && rows[0].status_perintah === 1) {
            res.status(200).send('CMD_CAPTURE');
            await db.execute('UPDATE command_queue SET status_perintah = 0 WHERE id = 1');
            console.log('[API] Instruksi CMD_CAPTURE ditembakkan ke ESP-CAM via NodeMCU!');
        } else {
            res.status(200).send('OK');
        }
    } catch (error) {
        console.error('[DB ERROR / TELEMETRY]', error.message);
        res.status(500).send('SERVER_ERROR');
    }
});

// B. Endpoint Vision Edge (Dari ESP32-CAM)
const rawParser = express.raw({ type: 'image/jpeg', limit: '2mb' });
app.post('/api/vision/upload', rawParser, async(req, res, next) => {
    try {
        const imageBuffer = req.body;
        if (!imageBuffer || imageBuffer.length === 0) return res.status(400).send('EMPTY_PAYLOAD');
        if (imageBuffer[0] !== 0xFF || imageBuffer[1] !== 0xD8 || imageBuffer[2] !== 0xFF) return res.status(400).send('CORRUPTED_FILE');

        const timestamp = Date.now();
        const filename = `edge_vision_${timestamp}.jpg`;
        const filepath = path.join(UPLOAD_DIR, filename);
        const fileSizeKb = Math.round(imageBuffer.length / 1024);

        await fs.promises.writeFile(filepath, imageBuffer);
        console.log(`[VISION SUCCESS] File ${filename} (${fileSizeKb} KB) diselamatkan ke disk.`);

        const insertQuery = 'INSERT INTO visi_edge (file_path, file_size_kb) VALUES (?, ?)';
        await db.execute(insertQuery, [`/uploads/${filename}`, fileSizeKb]);

        if (!res.headersSent) res.status(200).send('IMAGE_SAVED');
    } catch (error) {
        next(error);
    }
});

/**
 * ==============================================================================
 * BLOK 2: DISTRIBUSI DATA (DATA DISTRIBUTION - UNTUK DASHBOARD NEXT.JS)
 * ==============================================================================
 */

// A. Kirim Data Metrik Terbaru
app.get('/api/telemetry/latest', async(req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM mikroklimat ORDER BY waktu_rekam DESC LIMIT 1');
        if (rows.length > 0) res.status(200).json(rows[0]);
        else res.status(404).json({ message: "Data kosong" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// B. Kirim Data Historis untuk Grafik (20 data terakhir)
app.get('/api/telemetry/history', async(req, res) => {
    try {
        const [rows] = await db.execute('SELECT waktu_rekam, suhu, kelembaban, kecepatan_angin FROM mikroklimat ORDER BY waktu_rekam DESC LIMIT 20');
        res.status(200).json(rows.reverse());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// C. Kirim Gambar Terbaru dari Kamera
app.get('/api/vision/latest', async(req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM visi_edge ORDER BY waktu_tangkap DESC LIMIT 1');
        if (rows.length > 0) {
            const data = rows[0];
            // Merakit URL gambar menggunakan IP Peladen Anda
            data.image_url = `http://22.3.3.26:3000${data.file_path}`;
            res.status(200).json(data);
        } else {
            res.status(404).json({ message: "Belum ada gambar" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// D. Kirim SELURUH Data Historis Tanpa Batasan (Khusus Ekspor CSV & Analisis Makro)
app.get('/api/telemetry/all', async(req, res) => {
    try {
        // Tarik seluruh baris data dari yang terbaru hingga yang tertua
        const [rows] = await db.execute('SELECT waktu_rekam, suhu, kelembaban, kecepatan_angin, status_alert FROM mikroklimat ORDER BY waktu_rekam DESC');

        // Atur header khusus untuk mencegah caching data masif pada browser
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.status(200).json(rows);
    } catch (error) {
        console.error('[DB ERROR / ANALYTICS ALL]', error.message);
        res.status(500).json({ error: "Gagal mengekstrak seluruh data gudang." });
    }
});

// --- Additions to server.js under BLOK 2: DISTRIBUSI DATA ---

// D. Endpoint Arsip Visi Tangkapan Kamera dengan Paginasi Tingkat Database & Filter Label (Untuk Galeri & Kurasi Arsip Visi)

//         // Ambil data terbatas dan total hitungan baris secara paralel
//         const [rows] = await db.execute(dataQuery, [...queryParams, limit, offset]);
//         const [countRows] = await db.execute(countQuery, queryParams);

//         // Pasang URL publik lengkap pada setiap objek berkas gambar
//         const formattedRows = rows.map(row => ({
//             ...row,
//             image_url: `http://192.168.0.126:3000${row.file_path}`
//         }));

// D. Endpoint Arsip Visi dengan Paginasi Tingkat Database & Filter Label
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
        
        // =====================================================================
        // PERBAIKAN MUTLAK: Gunakan db.query() BUKAN db.execute() 
        // untuk menghindari penolakan LIMIT/OFFSET pada Prepared Statement MySQL
        // =====================================================================
        const [rows] = await db.query(dataQuery, [...queryParams, limit, offset]);
        const [countRows] = await db.query(countQuery, queryParams);
        
        const totalItems = countRows[0].total;
        const totalPages = Math.ceil(totalItems / limit);

        const formattedRows = rows.map(row => ({
            ...row,
            image_url: `http://22.3.3.26:3000${row.file_path}` // Pastikan IP ini sesuai dengan laptop, soalna local host euy....
        }));

        res.status(200).json({
            images: formattedRows,
            pagination: {
                current_page: page,
                limit: limit,
                total_pages: totalPages,
                total_items: totalItems
            }
        });
    } catch (error) {
        console.error('[SERVER ERROR / VISION ARCHIVE]', error.message);
        res.status(500).json({ error: "Gagal menarik data arsip visi." });
    }
});

// F. Endpoint Validasi/Anotasi Gambar Manual (Human-in-the-Loop)
// Ini digunakan Next.js untuk menandai gambar sebagai dataset valid atau sampah.
app.put('/api/vision/label/:id', express.json(), async(req, res) => {
    try {
        const { id } = req.params;
        const { label } = req.body;

        // Proteksi Validasi Struktur Data ENUM
        const validLabels = ['UNLABELED', 'HAMA', 'NORMAL', 'BURAM'];
        if (!validLabels.includes(label)) {
            return res.status(400).send("Format label tidak valid!");
        }

        await db.execute('UPDATE visi_edge SET manual_label = ? WHERE id = ?', [label, id]);
        console.log(`[DATA ANNOTATION] Berkas ID ${id} berhasil dilabeli manual sebagai: ${label}`);
        res.status(200).send("LABEL_UPDATED");
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * ==============================================================================
 * BLOK 3: KONTROL MANUAL & KONFIGURASI EDGE (DARI DASHBOARD & ESP-CAM)
 * ==============================================================================
 */

// A. Menerima Perintah Potret & Angka Kecerahan dari Next.js
app.post('/api/command/trigger-camera', express.json(), async(req, res) => {
    try {
        // Tarik nilai kecerahan dari dashboard, jika kosong gunakan 20
        const kecerahan = req.body.kecerahan !== undefined ? req.body.kecerahan : 20;

        // Simpan perintah potret (1) dan kecerahannya ke database
        await db.execute('UPDATE command_queue SET status_perintah = 1, kecerahan = ? WHERE id = 1', [kecerahan]);

        console.log(`[UI COMMAND] Inspeksi Manual diterima. Kecerahan LED diatur ke: ${kecerahan}/255`);
        res.status(200).json({ message: "Perintah dimasukkan antrean." });
    } catch (error) {
        res.status(500).json({ error: "Gagal memproses perintah." });
    }
});

// B. Endpoint Khusus ESP32-CAM untuk Menarik Angka Kecerahan
app.get('/api/vision/config', async(req, res) => {
    try {
        const [rows] = await db.execute('SELECT kecerahan FROM command_queue WHERE id = 1');
        const kecerahan = rows.length > 0 ? rows[0].kecerahan : 20;

        // Kirim hanya angka mentah (Plain Text) untuk menghemat RAM ESP32-CAM
        res.status(200).send(kecerahan.toString());
    } catch (error) {
        // Jika database error, kirim angka aman default (20)
        res.status(500).send("20");
    }
});

// C. Sinkronisasi Kecerahan Slider secara Real-Time (Tanpa Memotret)
app.put('/api/command/brightness', express.json(), async(req, res) => {
    try {
        const { kecerahan } = req.body;
        if (kecerahan === undefined || kecerahan < 0 || kecerahan > 255) {
            return res.status(400).send("Invalid brightness value");
        }
        await db.execute('UPDATE command_queue SET kecerahan = ? WHERE id = 1', [kecerahan]);
        console.log(`[UI SYNC] Kecerahan LED diperbarui secara senyap ke: ${kecerahan}/255`);
        res.status(200).send("OK");
    } catch (error) {
        res.status(500).send("SERVER_ERROR");
    }
});

// ==============================================================================
// BLOK 4: PENANGANAN RUTE TIDAK DITEMUKAN (FALLBACK / 404 HANDLER)
// ==============================================================================

// Menangani akses langsung ke root (halaman utama)
app.get('/', (req, res) => {
    res.status(200).json({
        system: "Agrosync Core API",
        status: "ACTIVE",
        version: "1.0",
        message: "Akses Ditolak. Ini adalah gerbang protokol mesin. Silakan akses Dashboard di port 3001."
    });
});

// Menangkap semua rute ngawur lainnya (404 Not Found)
app.use((req, res) => {
    res.status(404).json({
        error: "RUTE_TIDAK_VALID",
        message: "Endpoint yang Anda tuju tidak terdaftar di dalam arsitektur Agrosync."
    });
});

/**
 * ==============================================================================
 * JARING PENGAMAN GLOBAL & EKSEKUSI PELADEN
 * ==============================================================================
 */
app.use((err, req, res, next) => {
    if (err.type === 'request.aborted') {
        console.log('\n[NETWORK WARNING] Koneksi TCP terputus di tengah jalan (Request Aborted).\n');
        return res.status(400).send('REQUEST_ABORTED');
    }
    console.error('[SERVER FAULT]', err.message);
    res.status(500).send('SERVER_ERROR');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=================================================`);
    console.log(`[AGROSYNC KERNEL] Server FULL BUILD beroperasi di IP 0.0.0.0 pada Port ${PORT}`);
    console.log(`[AGROSYNC KERNEL] Menunggu I/O Perangkat Keras & Request Next.js...`);
    console.log(`=================================================\n`);
});