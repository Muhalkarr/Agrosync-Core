# 🌾 AGROSYNC CORE SYSTEM
**Sistem Pemantauan Mikroklimat & Gateway Visi Edge Terdistribusi**

Repositori ini memuat infrastruktur perangkat lunak pusat (Peladen Backend, Dasbor Frontend, dan Ekstraktor Dataset) untuk proyek Internet of Things (IoT) Agrosync. Sistem ini dirancang untuk menerima telemetri asinkron dan matriks gambar biner (JPEG) dari mikrokontroler Edge (NodeMCU & ESP32-CAM) di lingkungan pertanian *Green House*.

---

## ⚠️ PRASYARAT ABSOLUT (Sistem Kebutuhan)
Sebelum Anda menjalankan proyek ini, pastikan mesin komputasi Anda telah terinstal tumpukan teknologi (Tech Stack) berikut:
* **Node.js** (Minimal v18.x Lts)
* **Python** (Minimal v3.10)
* **MySQL Server** (Dapat menggunakan XAMPP, Laragon, atau MySQL murni)
* **Git** (Untuk manajemen repositori)

---

## 🛠️ PANDUAN INSTALASI & EKSEKUSI (Langkah-demi-Langkah)

### FASE 1: Imigrasi Basis Data (MySQL)
Sistem ini tidak akan berjalan tanpa struktur tabel yang valid.
1. Nyalakan layanan **MySQL** pada mesin Anda (via XAMPP Control Panel atau sejenisnya).
2. Buka antarmuka manajemen (contoh: `http://localhost/phpmyadmin`).
3. Buat sebuah basis data baru dengan nama persis: `agrosync_db`.
4. Pastikan Anda mengeksekusi skema tabel untuk tabel `mikroklimat`, `visi_edge`, dan `command_queue` sesuai arsitektur IoT.

### FASE 2: Inisiasi Peladen (Backend Engine)
Peladen ini bertindak sebagai jembatan *Asynchronous Non-Blocking I/O* bagi sensor fisik.
1. Buka terminal (CMD/GitBash).
2. Masuk ke direktori backend: `cd agrosync-backend`
3. Instal seluruh dependensi: `npm install express mysql2 cors multer`
4. **KALIBRASI KRITIS:** Buka berkas `server.js`. Pastikan konfigurasi *user* dan *password* MySQL cocok dengan mesin lokal Anda (bawaan XAMPP biasanya user: `root` dan password kosong `''`).
5. Jalankan peladen: `node server.js`
*(Tanda Keberhasilan: Terminal menampilkan log "Server FULL BUILD beroperasi pada Port 3000").*

### FASE 3: Command Center (Frontend Dashboard)
Antarmuka penyajian wawasan analitis dengan mekanisme *Client-Side Rendering* (Next.js).
1. Buka jendela terminal **BARU** (biarkan terminal Backend tetap menyala).
2. Masuk ke direktori frontend: `cd agrosync-web`
3. Instal dependensi: `npm install`
4. **KALIBRASI IP ABSOLUT:** Buka file `src/app/page.tsx`, `src/app/vision/page.tsx`, dan `src/app/analytics/page.tsx`. Temukan variabel `SERVER_URL`. Anda **WAJIB** mengganti IP pada URL tersebut dengan alamat IP lokal (IPv4) komputer Anda saat ini (Cek via perintah `ipconfig`).
5. Kompilasi dan jalankan: `npm run dev`
*(Akses dasbor melalui peramban web di jaringan yang sama melalui port 3001, contoh: http://192.168.0.126:3001).*

### FASE 4: Ekstraksi Anotasi Dataset (Python Core)
Skrip jembatan antara kurasi manusia di Dasbor menuju format MLOps (YOLOv8).
1. Pastikan ekstensi MySQL Connector terpasang: `pip install mysql-connector-python`
2. **KALIBRASI DIREKTORI:** Buka `extractor.py` dan ubah variabel `BACKEND_UPLOAD_DIR` menjadi alamat jalur fisik absolut ( *Absolute Path* ) menuju folder `agrosync-backend/uploads` di komputer Anda.
3. Eksekusi program: `python extractor.py`

---

## 🛑 DIAGNOSTIK MASALAH (Troubleshooting)

* **Dasbor Tidak Memuat Data:** Pastikan `SERVER_URL` di Frontend menggunakan IP komputer Anda, bukan localhost/127.0.0.1. Pastikan juga Windows Defender Firewall Anda telah dibuka untuk port 3000 dan 3001 (Inbound Rules TCP).
* **Galat `mysqld_stmt_execute`:** Gunakan XAMPP/MySQL versi stabil. Jika membandel, pastikan fungsi penarikan data masif menggunakan `db.query()` dan bukan `db.execute()`.
* **Peringatan `Hydration Mismatch` (Next.js):** Peringatan zona waktu ini telah dimitigasi dengan `suppressHydrationWarning`.