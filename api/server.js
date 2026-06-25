// Ini # Ini adalah isi dari file server.js di dalam folder agrosyng.analyzer.web.id/api/server.js

const express = require('express');
const mysql = require('mysql2/promise');
const fs = require('fs/promises');
const path = require('path');
const cors = require('cors');

const app = express();

// Bypassing Passenger Port Anomaly:
// Pada shared hosting LVE tertentu, port tidak selalu diinjeksi via ENV. 
// Jika kosong, kita paksakan berjalan di instance lokal yang ditangkap Passenger.
const PORT = process.env.PORT || 'passenger';
const isProduction = process.env.NODE_ENV === 'production';

// [PERBAIKAN] Gunakan variabel environment untuk kredensial, dengan fallback untuk lokal.
// --- KONFIGURASI KONEKSI DATABASE ---
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'agrosync_db',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0
});

// Detektor Galat Koneksi (Agar Error terlihat di Log, bukan sekadar Error 500)
db.getConnection()
    .then(() => console.log('[DATABASE] MySQL Terkoneksi dengan Presisi.'))
    .catch((err) => console.error('[FATAL DATABASE ERROR] Gagal menyambung ke MySQL:', err.message));

// --- MIDDLEWARE ---
// [MODIFIKASI] Dengan arsitektur terpadu, CORS tidak lagi menjadi masalah.
// Namun, tetap baik untuk mengaktifkannya untuk fleksibilitas di masa depan.
app.use(cors());
app.use(express.json());

// Sajikan gambar dari folder `public/uploads` (hanya untuk pengembangan lokal)
if (!isProduction) {
    app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
}

// Middleware untuk validasi API Key dari perangkat keras
// --- MIDDLEWARE OTENTIKASI HARDWARE ---
const validateApiKey = (req, res, next) => {
    const clientKey = req.headers['x-api-key'];

    // Pemanggilan absolut ke memori cPanel dengan fallback toleransi
    const serverKey = process.env.HARDWARE_API_KEY;

    // Jika variabel environment di cPanel hilang/mati, cegah crash
    if (isProduction && !serverKey) {
        console.error("[FATAL SECURITY] Variabel HARDWARE_API_KEY tidak diatur di lingkungan produksi!");
        return res.status(500).json({ error: 'Kesalahan konfigurasi keamanan server.' });
    }

    if (!clientKey || clientKey !== serverKey) {
        console.warn(`[SECURITY] Intrusi ditolak. Key yang masuk: ${clientKey}`);
        return res.status(401).json({ error: 'AKSES DITOLAK: Kunci API Perangkat Keras Tidak Valid.' });
    }

    next(); // Lolos otentikasi, teruskan ke rute utama
};

// --- STATE UNTUK THROTTLING ---
let lastTelemetryInsert = 0;
const DB_INSERT_INTERVAL = 60000; // 60 Detik

// --- API ROUTES ---

// [POST] /api/telemetry - Menerima data dari NodeMCU (Dilindungi API Key)
// Middleware `validateApiKey` dijalankan sebelum handler utama
app.post('/telemetry', validateApiKey, async (req, res) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).send('Request body tidak boleh kosong.');
        }
        // KOREKSI KUNCI PAYLOAD SESUAI NODEMCU
        const { suhu, kelembaban, kecepatan_angin, status_alert } = req.body;
        const suhuValue = parseFloat(suhu);
        const kelembabanValue = parseFloat(kelembaban);
        const anginValue = parseFloat(kecepatan_angin);
        const alertValue = status_alert === undefined ? 0 : Number(status_alert);

        if (Number.isNaN(suhuValue) || Number.isNaN(kelembabanValue) || Number.isNaN(anginValue) || Number.isNaN(alertValue) || (alertValue !== 0 && alertValue !== 1)) {
            return res.status(400).send('Struktur atau tipe data payload tidak valid.');
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
        res.status(500).json({ error: 'Terjadi kesalahan pada server saat memproses telemetri.' });
    }
});

// [POST] /api/vision/upload - Menerima biner JPEG mentah dari ESP32-CAM
app.post('/vision/upload', validateApiKey, express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
    try {
        const imageBuffer = req.body;
        
        // Validasi absolut keberadaan buffer
        if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
            return res.status(400).json({ error: 'Payload ditolak. Bukan biner yang valid.' });
        }

        const timestamp = Date.now();
        const filename = `edge_vision_${timestamp}.jpg`;
        
        // Logika mundur satu direktori dari /api ke root frontend lalu masuk ke /uploads
        const uploadDir = path.join(__dirname, '..', 'uploads');
        
        await fs.mkdir(uploadDir, { recursive: true });
        const filepath = path.join(uploadDir, filename);
        
        await fs.writeFile(filepath, imageBuffer);
        
        const fileSizeKb = (imageBuffer.length / 1024).toFixed(2);
        const imageUrl = `/uploads/${filename}`;
        
        await db.execute('INSERT INTO visi_edge (file_path, file_size_kb, image_url) VALUES (?, ?, ?)', [imageUrl, fileSizeKb, imageUrl]);
        
        console.log(`[VISION] Biner sukses ditulis ke disk: ${filename} (${fileSizeKb} KB)`);
        res.status(200).send('OK');
    } catch (error) {
        console.error('[FATAL VISION ERROR]', error);
        res.status(500).json({ error: `Gagal memproses gambar: ${error.message}` });
    }
});

// [GET] /api/telemetry/latest - Data telemetri terbaru
app.get('/telemetry/latest', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM mikroklimat ORDER BY waktu_rekam DESC LIMIT 1');
        if (rows.length > 0) res.status(200).json(rows[0]);
        else res.status(404).json({ message: "Data kosong" });
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengambil data telemetri terbaru.' });
    }
});

// [GET] /api/telemetry/all - Semua data telemetri
app.get('/telemetry/all', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM mikroklimat ORDER BY waktu_rekam DESC');

        // Transformasikan string biner menjadi float murni
        const parsedRows = rows.map(row => ({
            ...row,
            suhu: parseFloat(row.suhu),
            kelembaban: parseFloat(row.kelembaban),
            kecepatan_angin: parseFloat(row.kecepatan_angin)
        }));

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.status(200).json(parsedRows);
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengekstrak seluruh data gudang.' });
    }
});

// [GET] /api/telemetry/stats - Statistik agregat
app.get('/telemetry/stats', async (req, res) => {
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
        res.status(500).json({ error: 'Gagal menghitung statistik.' });
    }
});

// [GET] /api/vision/config - Memberikan instruksi kecerahan flash ke ESP-CAM sebelum memotret
app.get('/vision/config', validateApiKey, async (req, res) => {
    try {
        // Menarik instruksi kecerahan dari antrean perintah
        const [rows] = await db.execute('SELECT kecerahan FROM command_queue WHERE id = 1');

        if (rows.length > 0 && rows[0].kecerahan !== null) {
            // Semburkan angka murni (contoh: "120") agar parser C++ mikrokontroler tidak kesulitan
            res.status(200).send(rows[0].kecerahan.toString());
        } else {
            // Jika tabel kosong atau anomali, berikan nilai aman
            res.status(200).send("20");
        }
    } catch (error) {
        console.error('[CONFIG ERROR] Gagal membaca tabel command_queue:', error.message);
        // HUKUM FAIL-SAFE: Jangan biarkan ESP-CAM menerima galat 500, paksa nilai default
        res.status(200).send("20");
    }
});
// [GET] /api/vision/latest - Gambar terbaru
app.get('/vision/latest', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM visi_edge ORDER BY waktu_tangkap DESC LIMIT 1');
        if (rows.length > 0) {
            const data = rows[0];
            res.status(200).json(data);
        } else {
            res.status(404).json({ message: "Belum ada gambar" });
        }
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengambil gambar terbaru.' });
    }
});

// --- ENDPOINT KHUSUS EKSTRAKTOR PYTHON (MLOps) ---
app.get('/vision/extract-mlops', async (req, res) => {
    try {
        // Tarik HANYA data yang belum diberi label manual (atau sesuai kebutuhan Anda)
        // Jika ingin menarik semua, hapus klausa WHERE
        const [rows] = await db.execute('SELECT id, manual_label, image_url FROM visi_edge ORDER BY waktu_tangkap DESC');
        res.status(200).json(rows);
    } catch (error) {
        console.error('[API] Gagal mengekstrak data MLOps:', error);
        res.status(500).json({ error: 'Gagal mengekstrak data dari database.' });
    }
});

// [GET] /api/vision/archive - Arsip gambar dengan paginasi
app.get('/vision/archive', async (req, res) => {
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
        res.status(500).json({ error: 'Gagal menarik data arsip visi.' });
    }
});

// [PUT] /api/vision/label/:id - Melabeli gambar
app.put('/vision/label/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { label } = req.body;
        const validLabels = ['UNLABELED', 'HAMA', 'NORMAL', 'BURAM'];
        if (!validLabels.includes(label)) {
            return res.status(400).json({ error: 'Format label tidak valid. Gunakan: UNLABELED, HAMA, NORMAL, atau BURAM.' });
        }
        await db.execute('UPDATE visi_edge SET manual_label = ? WHERE id = ?', [label, id]);
        res.status(200).send("LABEL_UPDATED");
    } catch (error) {
        res.status(500).json({ error: 'Gagal memperbarui label gambar.' });
    }
});

// [POST] /api/command/trigger-camera - Memicu kamera dari dasbor
app.post('/command/trigger-camera', async (req, res) => {
    try {
        const kecerahan = req.body.kecerahan !== undefined ? req.body.kecerahan : 20;
        await db.execute('UPDATE command_queue SET status_perintah = 1, kecerahan = ? WHERE id = 1', [kecerahan]);
        res.status(200).json({ message: "Perintah dimasukkan antrean." });
    } catch (error) {
        res.status(500).json({ error: 'Gagal memproses perintah kamera.' });
    }
});

// [PUT] /api/command/brightness - Sinkronisasi slider kecerahan
app.put('/command/brightness', async (req, res) => {
    try {
        const { kecerahan } = req.body;
        if (kecerahan === undefined || kecerahan < 0 || kecerahan > 255) {
            return res.status(400).json({ error: 'Nilai kecerahan tidak valid. Harus antara 0 dan 255.' });
        }
        await db.execute('UPDATE command_queue SET kecerahan = ? WHERE id = 1', [kecerahan]);
        res.status(200).send("OK");
    } catch (error) {
        res.status(500).json({ error: 'Gagal memperbarui kecerahan.' });
    }
});

// --- GLOBAL ERROR HANDLER ---
// Membunuh HTML balasan Express dan menggantinya dengan JSON diagnostik
app.use((err, req, res, next) => {
    console.error('[EXPRESS MIDDLEWARE ERROR]', err.stack);
    res.status(500).json({ error: `Arsitektur Middleware Runtuh: ${err.message}` });
});

// --- SERVER START ---
app.listen(PORT, () => {
    // [PERBAIKAN] Pesan log yang lebih jelas dan akurat
    if (PORT === 'passenger') {
        console.log(`[AGROSYNC API SERVER] Diambil alih oleh Phusion Passenger.`);
    } else {
        console.log(`[AGROSYNC API SERVER] Berjalan di port: ${PORT}`);
    }
});