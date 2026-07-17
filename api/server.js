// Ini adalah isi dari file server.js di dalam folder agrosyng.analyzer.web.id/api/server.js

const express = require('express');
const mysql = require('mysql2/promise');
const fs = require('fs/promises');
const path = require('path');
const cors = require('cors');
const archiver = require('archiver');

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
    .then(() => logAndBroadcast('DATABASE', 'MySQL Terkoneksi dengan Presisi.'))
    .catch((err) => logAndBroadcast('FATAL', `Gagal menyambung ke MySQL: ${err.message}`, 'error'));

// --- SERVER-SENT EVENTS (SSE) LOGGING ---
let logClients = [];

function logAndBroadcast(source, message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${source}] ${message}`;
    const logEntry = { timestamp, source, message, level };
    
    if (level === 'error') console.error(logMessage);
    else console.log(logMessage);
    
    // Kirim log ke semua klien SSE yang terhubung
    logClients.forEach(client => {
        client.res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
    });
}

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
        logAndBroadcast('SECURITY', 'FATAL: Variabel HARDWARE_API_KEY tidak diatur di lingkungan produksi!', 'error');
        return res.status(500).json({ error: 'Kesalahan konfigurasi keamanan server.' });
    }

    if (!clientKey || clientKey !== serverKey) {
        logAndBroadcast('SECURITY', `Intrusi ditolak. IP: ${req.ip}. Key yang masuk: ${clientKey}`, 'warn');
        return res.status(401).json({ error: 'AKSES DITOLAK: Kunci API Perangkat Keras Tidak Valid.' });
    }

    next(); // Lolos otentikasi, teruskan ke rute utama
};

// --- STATE UNTUK THROTTLING ---
let lastTelemetryInsert = 0;
const DB_INSERT_INTERVAL = 60000; // 60 Detik

// --- API ROUTES ---

// [PERBAIKAN ARSITEKTUR] Gunakan express.Router untuk membuat aplikasi sadar akan base path /api
const apiRouter = express.Router();

// [GET] /health-check - Endpoint debug untuk verifikasi server berjalan
apiRouter.get('/health-check', (req, res) => {
    res.status(200).send('API Server is alive! Version: 5.0 (SSE)');
});

// [GET] /log-stream - Endpoint untuk Server-Sent Events
apiRouter.get('/log-stream', (req, res) => {
    // Atur header untuk koneksi SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res: res,
    };
    logClients.push(newClient);

    // Hapus klien dari daftar saat koneksi ditutup
    req.on('close', () => {
        logClients = logClients.filter(client => client.id !== clientId);
    });
});

// [POST] /telemetry - Menerima data dari NodeMCU (Dilindungi API Key)
// Middleware `validateApiKey` dijalankan sebelum handler utama
apiRouter.post('/telemetry', validateApiKey, async (req, res) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).send('Request body tidak boleh kosong.');
        }
        // Log payload mentah untuk debugging
        logAndBroadcast('TELEMETRY', `Payload diterima: ${JSON.stringify(req.body)}`);

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
            logAndBroadcast('DATABASE', `Data Iklim disave. (Suhu: ${suhu}C)`);
        }

        const [rows] = await db.execute('SELECT status_perintah FROM command_queue WHERE id = 1');
        if (rows.length > 0 && rows[0].status_perintah === 1) {
            await db.execute('UPDATE command_queue SET status_perintah = 0 WHERE id = 1');
            logAndBroadcast('COMMAND', 'Instruksi CMD_CAPTURE ditembakkan ke perangkat!');
            res.status(200).send('CMD_CAPTURE');
        } else {
            res.status(200).send('OK');
        }
    } catch (error) {
        logAndBroadcast('ERROR', `/telemetry endpoint error: ${error.message}`, 'error');
        res.status(500).json({ error: 'Terjadi kesalahan pada server saat memproses telemetri.' });
    }
});

// [POST] /vision/upload - Menerima biner JPEG mentah dari ESP32-CAM
apiRouter.post('/vision/upload', validateApiKey, express.raw({ type: 'image/jpeg', limit: '10mb' }), async (req, res) => {
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
        
        logAndBroadcast('VISION', `Biner sukses ditulis ke disk: ${filename} (${fileSizeKb} KB)`);
        res.status(200).send('OK');
    } catch (error) {
        logAndBroadcast('ERROR', `Fatal vision upload error: ${error.message}`, 'error');
        res.status(500).json({ error: `Gagal memproses gambar: ${error.message}` });
    }
});

// [GET] /telemetry/latest - Data telemetri terbaru
apiRouter.get('/telemetry/latest', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT id, suhu, kelembaban, kecepatan_angin, status_alert, CONVERT_TZ(waktu_rekam, '+00:00', '+07:00') as waktu_rekam 
            FROM mikroklimat ORDER BY waktu_rekam DESC LIMIT 1
        `);
        if (rows.length > 0) res.status(200).json(rows[0]);
        else res.status(404).json({ message: "Data kosong" });
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengambil data telemetri terbaru.' });
    }
});

// [GET] /telemetry/all - Semua data telemetri
apiRouter.get('/telemetry/all', async (req, res) => {
    // [PERBAIKAN PERFORMA] Implementasi paginasi sisi server
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25; // Default ke 25 baris per halaman
    const offset = (page - 1) * limit;

    try {
        const timeWindowSeconds = 60; // Jendela waktu korelasi: +/- 60 detik

        // [PERBAIKAN] Query utama sekarang menggabungkan data visi dan telemetri
        const mainQuery = `
            SELECT 
                m.id, CONVERT_TZ(m.waktu_rekam, '+00:00', '+07:00') as waktu_rekam, m.suhu, m.kelembaban, m.kecepatan_angin, m.status_alert,
                (
                    SELECT v.image_url 
                    FROM visi_edge v 
                    WHERE v.waktu_tangkap BETWEEN m.waktu_rekam - INTERVAL ? SECOND AND m.waktu_rekam + INTERVAL ? SECOND
                    ORDER BY ABS(TIMESTAMPDIFF(SECOND, v.waktu_tangkap, m.waktu_rekam))
                    LIMIT 1
                ) AS correlated_image_url,
                (
                    SELECT v.manual_label 
                    FROM visi_edge v 
                    WHERE v.waktu_tangkap BETWEEN m.waktu_rekam - INTERVAL ? SECOND AND m.waktu_rekam + INTERVAL ? SECOND
                    ORDER BY ABS(TIMESTAMPDIFF(SECOND, v.waktu_tangkap, m.waktu_rekam))
                    LIMIT 1
                ) AS correlated_label
            FROM mikroklimat m
            ORDER BY m.waktu_rekam DESC
            LIMIT ? OFFSET ?
        `;

        const [dataResult, countResult] = await Promise.all([
            db.query(mainQuery, [timeWindowSeconds, timeWindowSeconds, timeWindowSeconds, timeWindowSeconds, limit, offset]),
            db.query('SELECT COUNT(*) as total FROM mikroklimat')
        ]);

        const rows = dataResult[0];
        const total = countResult[0][0].total;

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.status(200).json({ data: rows, totalItems: total });
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengekstrak seluruh data gudang.' });
    }
});

// [GET] /telemetry/graph-history - Data historis khusus untuk grafik dasbor utama
apiRouter.get('/telemetry/graph-history', async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
        let query = "SELECT CONVERT_TZ(waktu_rekam, '+00:00', '+07:00') as waktu_rekam, suhu, kelembaban, kecepatan_angin FROM mikroklimat";
        const params = [];

        if (startDate && endDate) {
            query += ' WHERE waktu_rekam BETWEEN ? AND ?';
            params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        }

        query += ' ORDER BY waktu_rekam DESC';

        const [rows] = await db.execute(query, params);
        // Balikkan array agar urutan waktunya dari yang terlama ke terbaru, sesuai untuk grafik
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.status(200).json(rows.reverse());
    } catch (error) {
        console.error('[API ERROR /telemetry/graph-history]', error.message);
        res.status(500).json({ error: 'Gagal mengambil data riwayat untuk grafik.' });
    }
});

// [GET] /telemetry/stats - Statistik agregat
apiRouter.get('/telemetry/stats', async (req, res) => {
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

// [GET] /vision/config - Memberikan instruksi kecerahan flash ke ESP-CAM sebelum memotret
apiRouter.get('/vision/config', validateApiKey, async (req, res) => {
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
        logAndBroadcast('ERROR', `Config error: Gagal membaca command_queue: ${error.message}`, 'error');
        // HUKUM FAIL-SAFE: Jangan biarkan ESP-CAM menerima galat 500, paksa nilai default
        res.status(200).send("20");
    }
});
// [GET] /vision/latest - Gambar terbaru
apiRouter.get('/vision/latest', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT id, file_path, file_size_kb, manual_label, image_url, CONVERT_TZ(waktu_tangkap, '+00:00', '+07:00') as waktu_tangkap 
            FROM visi_edge ORDER BY waktu_tangkap DESC LIMIT 1
        `);
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
// [PERBAIKAN KEAMANAN] Endpoint ini sekarang dilindungi oleh API Key.
apiRouter.get('/vision/extract-mlops', validateApiKey, async (req, res) => {
    try {
        // Tarik HANYA data yang belum diberi label manual (atau sesuai kebutuhan Anda)
        // Jika ingin menarik semua, hapus atau sesuaikan klausa WHERE
        const [rows] = await db.execute('SELECT id, manual_label, image_url FROM visi_edge ORDER BY waktu_tangkap DESC');
        res.status(200).json(rows);
    } catch (error) {
        logAndBroadcast('MLOPS', `Gagal mengekstrak data: ${error.message}`, 'error');
        res.status(500).json({ error: 'Gagal mengekstrak data dari database.' });
    }
});

// [GET] /vision/archive - Arsip gambar dengan paginasi
apiRouter.get('/vision/archive', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const filterLabel = req.query.label || 'ALL';
        const offset = (page - 1) * limit;

        let dataQuery = "SELECT id, file_path, file_size_kb, manual_label, image_url, CONVERT_TZ(waktu_tangkap, '+00:00', '+07:00') as waktu_tangkap FROM visi_edge";
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

// [PUT] /vision/label/:id - Melabeli gambar
apiRouter.put('/vision/label/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { label } = req.body;
        const validLabels = ['UNLABELED', 'HAMA', 'BUKAN HAMA', 'BURAM'];
        if (!validLabels.includes(label)) {
            return res.status(400).json({ error: 'Format label tidak valid. Gunakan: UNLABELED, HAMA, BUKAN HAMA, atau BURAM.' });
        }
        await db.execute('UPDATE visi_edge SET manual_label = ? WHERE id = ?', [label, id]);
        res.status(200).send("LABEL_UPDATED");
    } catch (error) {
        res.status(500).json({ error: 'Gagal memperbarui label gambar.' });
    }
});

// [POST] /command/trigger-camera - Memicu kamera dari dasbor
apiRouter.post('/command/trigger-camera', async (req, res) => {
    try {
        const kecerahan = req.body.kecerahan !== undefined ? req.body.kecerahan : 20;
        await db.execute('UPDATE command_queue SET status_perintah = 1, kecerahan = ? WHERE id = 1', [kecerahan]);
        res.status(200).json({ message: "Perintah dimasukkan antrean." });
    } catch (error) {
        res.status(500).json({ error: 'Gagal memproses perintah kamera.' });
    }
});

// [PUT] /command/brightness - Sinkronisasi slider kecerahan
apiRouter.put('/command/brightness', async (req, res) => {
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

// --- ENDPOINT MANAJEMEN DATA ---

// [GET] /vision/export-dataset - Membuat dan mengirim arsip ZIP dari dataset visual, dengan filter label
apiRouter.get('/vision/export-dataset', async (req, res) => {
    const labelFilter = req.query.label || 'ALL'; // Ambil filter dari query
    const archive = archiver('zip', {
        zlib: { level: 9 } // Level kompresi maksimal untuk ukuran file terkecil
    });

    // Tangani error yang mungkin terjadi selama proses pembuatan arsip
    archive.on('error', function(err) {
        res.status(500).send({error: err.message});
    });

    // Set header agar browser secara otomatis memulai unduhan
    const fileName = `agrosync_dataset_${labelFilter}_${Date.now()}.zip`;
    res.attachment(fileName);
    
    // Alirkan (pipe) output arsip langsung ke respons HTTP
    archive.pipe(res);

    try {
        let query = 'SELECT image_url, manual_label FROM visi_edge';
        const queryParams = [];
        if (labelFilter !== 'ALL') {
            query += ' WHERE manual_label = ?';
            queryParams.push(labelFilter);
        }
        const [rows] = await db.execute(query, queryParams);
        
        if (rows.length === 0) {
            return archive.finalize(); // Kirim zip kosong jika tidak ada gambar
        }

        for (const row of rows) {
            if (row.image_url) {
                const filePath = path.join(__dirname, '..', row.image_url);
                const entryName = `${row.manual_label}/${path.basename(row.image_url)}`;
                // Tambahkan file ke arsip dengan path folder yang sesuai (e.g., HAMA/image.jpg)
                archive.file(filePath, { name: entryName });
            }
        }

        await archive.finalize();
        logAndBroadcast('EXPORT', `Arsip dataset visual (filter: ${labelFilter}) berhasil dibuat dan dikirim.`);

    } catch (error) {
        logAndBroadcast('ERROR', `/vision/export-dataset error: ${error.message}`, 'error');
        if (!res.headersSent) res.status(500).json({ error: 'Gagal membuat arsip dataset.' });
    }
});

// [GET] /export/synergized - Membuat dan mengirim arsip gabungan (CSV telemetri + Gambar)
apiRouter.get('/export/synergized', async (req, res) => {
    const labelFilter = req.query.label || 'ALL';
    const timeWindowSeconds = 60; // Jendela waktu korelasi: +/- 60 detik
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', function(err) {
        res.status(500).send({ error: err.message });
    });

    res.attachment(`agrosync_synergized_dataset_${Date.now()}.zip`);
    archive.pipe(res);

    try {
        logAndBroadcast('EXPORT', 'Memulai pembuatan dataset sinergi...');
        // Query ini mencari gambar terdekat dalam jendela waktu untuk setiap data telemetri, dengan filter label
        const mainQuery = `
            SELECT 
                m.id, m.waktu_rekam, m.suhu, m.kelembaban, m.kecepatan_angin, m.status_alert,
                (
                    SELECT v.image_url 
                    FROM visi_edge v 
                    WHERE 
                        v.waktu_tangkap BETWEEN m.waktu_rekam - INTERVAL ? SECOND AND m.waktu_rekam + INTERVAL ? SECOND
                        ${labelFilter !== 'ALL' ? 'AND v.manual_label = ?' : ''}
                    ORDER BY ABS(TIMESTAMPDIFF(SECOND, v.waktu_tangkap, m.waktu_rekam))
                    LIMIT 1
                ) AS correlated_image_url,
                (
                    SELECT v.manual_label 
                    FROM visi_edge v 
                    WHERE 
                        v.waktu_tangkap BETWEEN m.waktu_rekam - INTERVAL ? SECOND AND m.waktu_rekam + INTERVAL ? SECOND
                        ${labelFilter !== 'ALL' ? 'AND v.manual_label = ?' : ''}
                    ORDER BY ABS(TIMESTAMPDIFF(SECOND, v.waktu_tangkap, m.waktu_rekam))
                    LIMIT 1
                ) AS correlated_label
            FROM mikroklimat m
            ORDER BY m.waktu_rekam DESC
        `;

        const queryParams = labelFilter !== 'ALL' 
            ? [timeWindowSeconds, timeWindowSeconds, labelFilter, timeWindowSeconds, timeWindowSeconds, labelFilter] 
            : [timeWindowSeconds, timeWindowSeconds, timeWindowSeconds, timeWindowSeconds];

        const [allRows] = await db.query(mainQuery, queryParams);

        // Jika ada filter label, kita hanya ingin baris yang memiliki gambar terkorelasi
        const rows = labelFilter !== 'ALL' ? allRows.filter(row => row.correlated_image_url) : allRows;

        if (rows.length === 0) {
            logAndBroadcast('EXPORT', 'Tidak ada data telemetri yang cocok untuk diekspor.');
            return archive.finalize();
        }

        // 1. Buat konten CSV
        let csvContent = "No,Waktu Rekam (UTC),Suhu (C),Kelembaban (%),Kecepatan Angin (m/s),Status Inframerah,URL Gambar,Label Gambar\n";
        const imagesToInclude = new Map();
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        rows.forEach((row, index) => {
            const waktuString = new Date(row.waktu_rekam).toISOString().replace('T', ' ').replace('.000Z', '');
            const statusInframerah = row.status_alert === 1 ? "TERHALANG" : "NORMAL";
            const urlGambar = row.correlated_image_url ? `${baseUrl}${row.correlated_image_url}` : 'N/A';
            const labelGambar = row.correlated_label || 'N/A';
            
            csvContent += `${index + 1},"${waktuString}",${row.suhu},${row.kelembaban},${row.kecepatan_angin},"${statusInframerah}","${urlGambar}","${labelGambar}"\n`;
            
            if (row.correlated_image_url && row.correlated_label) {
                imagesToInclude.set(row.correlated_image_url, row.correlated_label);
            }
        });

        archive.append(csvContent, { name: 'correlated_telemetry_data.csv' });

        for (const [imageUrl, label] of imagesToInclude.entries()) {
            const filePath = path.join(__dirname, '..', imageUrl);
            const entryName = `${label}/${path.basename(imageUrl)}`;
            archive.file(filePath, { name: entryName });
        }

        await archive.finalize();
        logAndBroadcast('EXPORT', `Dataset sinergi (filter: ${labelFilter}) dengan ${rows.length} baris dan ${imagesToInclude.size} gambar unik berhasil dikirim.`);
    } catch (error) {
        logAndBroadcast('ERROR', `/export/synergized error: ${error.message}`, 'error');
        if (!res.headersSent) res.status(500).json({ error: 'Gagal membuat arsip dataset sinergi.' });
    }
});

// [GET] /telemetry/export-all - Mengambil SEMUA data telemetri untuk ekspor CSV
apiRouter.get('/telemetry/export-all', async (req, res) => {
    try {
        logAndBroadcast('EXPORT', 'Memulai ekstraksi data telemetri penuh untuk ekspor CSV...');
        const timeWindowSeconds = 60; // Jendela waktu korelasi: +/- 60 detik

        // Query ini mencari label gambar terdekat dalam jendela waktu untuk setiap data telemetri
        const [rows] = await db.execute(`
            SELECT 
                m.id, 
                CONVERT_TZ(m.waktu_rekam, '+00:00', '+07:00') as waktu_rekam,
                m.suhu, 
                m.kelembaban, 
                m.kecepatan_angin, 
                m.status_alert,
                (
                    SELECT v.image_url 
                    FROM visi_edge v 
                    WHERE v.waktu_tangkap BETWEEN m.waktu_rekam - INTERVAL ? SECOND AND m.waktu_rekam + INTERVAL ? SECOND
                    ORDER BY ABS(TIMESTAMPDIFF(SECOND, v.waktu_tangkap, m.waktu_rekam))
                    LIMIT 1
                ) AS correlated_image_url,
                (
                    SELECT v.manual_label 
                    FROM visi_edge v 
                    WHERE v.waktu_tangkap BETWEEN m.waktu_rekam - INTERVAL ? SECOND AND m.waktu_rekam + INTERVAL ? SECOND
                    ORDER BY ABS(TIMESTAMPDIFF(SECOND, v.waktu_tangkap, m.waktu_rekam))
                    LIMIT 1
                ) AS correlated_label
            FROM mikroklimat m
            ORDER BY m.waktu_rekam ASC
        `, [timeWindowSeconds, timeWindowSeconds, timeWindowSeconds, timeWindowSeconds]);

        logAndBroadcast('EXPORT', `Ekstraksi selesai. ${rows.length} baris data telemetri siap diekspor.`);
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json(rows);

    } catch (error) {
        logAndBroadcast('ERROR', `/telemetry/export-all error: ${error.message}`, 'error');
        res.status(500).json({ error: 'Gagal mengekstrak data telemetri untuk ekspor.' });
    }
});

// [DELETE] /telemetry/bulk - Menghapus data telemetri secara massal berdasarkan array ID
apiRouter.delete('/telemetry/bulk', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Payload harus berupa array ID yang tidak kosong.' });
        }
        // Membuat placeholder '?' sebanyak jumlah ID untuk query yang aman
        const placeholders = ids.map(() => '?').join(',');
        const [result] = await db.execute(`DELETE FROM mikroklimat WHERE id IN (${placeholders})`, ids);
        
        logAndBroadcast('DB_CLEANUP', `${result.affectedRows} baris telemetri dihapus.`);
        res.status(200).json({ message: `${result.affectedRows} data telemetri berhasil dihapus.` });
    } catch (error) {
        logAndBroadcast('ERROR', `/telemetry/bulk error: ${error.message}`, 'error');
        res.status(500).json({ error: 'Gagal menghapus data telemetri.' });
    }
});

// [DELETE] /telemetry/all-data - Menghapus SEMUA data telemetri
apiRouter.delete('/telemetry/all-data', async (req, res) => {
    try {
        await db.execute('TRUNCATE TABLE mikroklimat');
        logAndBroadcast('DB_CLEANUP', 'Semua data telemetri telah dihapus via TRUNCATE.');
        res.status(200).json({ message: 'Semua data telemetri berhasil dihapus.' });
    } catch (error) {
        logAndBroadcast('ERROR', `/telemetry/all-data error: ${error.message}`, 'error');
        res.status(500).json({ error: 'Gagal menghapus semua data telemetri.' });
    }
});

// [DELETE] /vision/bulk - Menghapus data citra visual secara massal (DB & File Fisik)
apiRouter.delete('/vision/bulk', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Payload harus berupa array ID yang tidak kosong.' });
        }

        const placeholders = ids.map(() => '?').join(',');

        // 1. Ambil path file yang akan dihapus dari database
        const [rows] = await db.execute(`SELECT image_url FROM visi_edge WHERE id IN (${placeholders})`, ids);
        
        // 2. Hapus record dari tabel visi_edge
        const [deleteResult] = await db.execute(`DELETE FROM visi_edge WHERE id IN (${placeholders})`, ids);

        // 3. Hapus file fisik dari direktori /uploads
        const deleteFilePromises = rows.map(row => {
            if (row.image_url) {
                const filePath = path.join(__dirname, '..', row.image_url);
                return fs.unlink(filePath).catch(err => {
                    if (err.code !== 'ENOENT') console.error(`Gagal menghapus file: ${filePath}`, err);
                });
            }
            return Promise.resolve();
        });
        await Promise.all(deleteFilePromises);

        logAndBroadcast('DB_CLEANUP', `${deleteResult.affectedRows} record gambar dan file fisiknya telah dihapus.`);
        res.status(200).json({ message: `${deleteResult.affectedRows} data gambar berhasil dihapus.` });
    } catch (error) {
        logAndBroadcast('ERROR', `/vision/bulk error: ${error.message}`, 'error');
        res.status(500).json({ error: 'Gagal menghapus data gambar.' });
    }
});

// [DELETE] /vision/all-data - Menghapus SEMUA data citra visual (DB & File Fisik)
apiRouter.delete('/vision/all-data', async (req, res) => {
    try {
        // 1. Ambil semua path file dari database
        const [rows] = await db.execute('SELECT image_url FROM visi_edge');
        
        // 2. Hapus semua record dari tabel visi_edge
        await db.execute('TRUNCATE TABLE visi_edge');

        // 3. Hapus semua file fisik dari direktori /uploads
        const deleteFilePromises = rows.map(row => {
            if (row.image_url) {
                const filePath = path.join(__dirname, '..', row.image_url);
                return fs.unlink(filePath).catch(err => {
                    if (err.code !== 'ENOENT') console.error(`Gagal menghapus file: ${filePath}`, err);
                });
            }
            return Promise.resolve();
        });
        await Promise.all(deleteFilePromises);

        logAndBroadcast('DB_CLEANUP', 'Semua data gambar dan file fisiknya telah dihapus via TRUNCATE.');
        res.status(200).json({ message: 'Semua data gambar berhasil dihapus.' });
    } catch (error) {
        logAndBroadcast('ERROR', `/vision/all-data error: ${error.message}`, 'error');
        res.status(500).json({ error: 'Gagal menghapus semua data gambar.' });
    }
});

// [DELETE] /maintenance/prune-telemetry - Menghapus data telemetri yang lebih tua dari N hari
apiRouter.delete('/maintenance/prune-telemetry', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30; // Default 30 hari jika tidak dispesifikasikan
        if (days <= 0) {
            return res.status(400).json({ error: 'Jumlah hari harus lebih besar dari 0.' });
        }

        const [result] = await db.execute(
            'DELETE FROM mikroklimat WHERE waktu_rekam < NOW() - INTERVAL ? DAY',
            [days]
        );

        logAndBroadcast('DB_MAINTENANCE', `${result.affectedRows} baris data telemetri yang lebih tua dari ${days} hari telah dihapus.`);
        res.status(200).json({ message: `${result.affectedRows} data lama berhasil dihapus.` });
    } catch (error) {
        logAndBroadcast('ERROR', `/maintenance/prune-telemetry error: ${error.message}`, 'error');
        res.status(500).json({ error: 'Gagal melakukan pembersihan data lama.' });
    }
});

// Pasang router utama ke base path /api
app.use('/api', apiRouter);

// --- GLOBAL ERROR HANDLER ---
// Membunuh HTML balasan Express dan menggantinya dengan JSON diagnostik
app.use((err, req, res, next) => {
    logAndBroadcast('FATAL', `Express middleware error: ${err.stack}`, 'error');
    res.status(500).json({ error: `Arsitektur Middleware Runtuh: ${err.message}` });
});

// --- SERVER START ---
const server = app.listen(PORT, () => {
    // [PERBAIKAN] Pesan log yang lebih jelas dan akurat
    if (PORT === 'passenger') {
        logAndBroadcast('SYSTEM', 'Server API diambil alih oleh Phusion Passenger.');
    } else {
        logAndBroadcast('SYSTEM', `Server API berjalan di port: ${PORT}`);
    }
});