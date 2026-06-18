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
Peladen ini bertindak sebagai jembatan *Asynchronous Non-Blocking I/O* bagi sensor fisik dan antarmuka untuk frontend.
1. Buka terminal (CMD/GitBash).
2. Navigasi ke direktori root proyek: `cd Agrosync-Core`
3. Instal seluruh dependensi (untuk backend dan frontend): `npm install`
4. **KONFIGURASI WAJIB (Backend):**
   - Buat file baru bernama `.env` di direktori root.
   - Salin dan tempel konten berikut ke dalamnya, sesuaikan dengan konfigurasi MySQL Anda:
     ```
     # Konfigurasi Database
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=
     DB_NAME=agrosync_db

     # URL Frontend (untuk CORS)
     FRONTEND_URL=http://localhost:3001
     ```
5. Jalankan peladen backend: `node server.js`
   *(Tanda Keberhasilan: Terminal menampilkan log "Server FULL BUILD beroperasi pada Port 3000").*

### FASE 3: Command Center (Frontend Dashboard)
Antarmuka penyajian wawasan analitis dengan mekanisme *Client-Side Rendering* (Next.js).
1. Buka jendela terminal **BARU** (biarkan terminal Backend tetap menyala).
2. Navigasi ke direktori root proyek: `cd Agrosync-Core`
3. **KONFIGURASI WAJIB (Frontend):**
   - Buat file baru bernama `.env.local` di direktori root.
   - Salin dan tempel konten berikut ke dalamnya. IP `127.0.0.1` atau `localhost` sudah cukup untuk pengembangan lokal.
     ```
     NEXT_PUBLIC_API_URL=http://localhost:3000
     ```
4. Kompilasi dan jalankan: `npm run dev`
   *(Akses dasbor melalui peramban web di `http://localhost:3001`)*.

### FASE 4: Ekstraksi Anotasi Dataset (Python Core)
Skrip jembatan antara kurasi manusia di Dasbor menuju format MLOps (YOLOv8).
1. Pastikan dependensi Python terpasang: `pip install mysql-connector-python python-dotenv`
2. Pastikan file `.env` dari FASE 2 sudah dibuat. Skrip akan otomatis membaca kredensial dari sana.
3. Eksekusi program dari direktori root: `python extractor.py`

---

## 🛑 DIAGNOSTIK MASALAH (Troubleshooting)

* **Dasbor Tidak Memuat Data:** Pastikan backend berjalan di port 3000. Cek file `.env.local` dan pastikan `NEXT_PUBLIC_API_URL` sudah benar. Jika perangkat lain di jaringan (misal: ponsel) tidak bisa akses, pastikan Windows Defender Firewall Anda telah membuka port 3000 dan 3001 (Inbound Rules TCP).
* **Galat `mysqld_stmt_execute`:** Gunakan XAMPP/MySQL versi stabil. Jika membandel, pastikan fungsi penarikan data masif menggunakan `db.query()` dan bukan `db.execute()`.
* **Peringatan `Hydration Mismatch` (Next.js):** Peringatan zona waktu ini telah dimitigasi dengan `suppressHydrationWarning`.