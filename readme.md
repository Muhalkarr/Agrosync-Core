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
Proyek ini menggunakan arsitektur hybrid yang dirancang untuk cPanel: backend Express.js dan frontend statis Next.js.

1. Buka terminal (CMD/GitBash).
2. Navigasi ke direktori root proyek: `cd Agrosync-Core`
3. Instal seluruh dependensi: `npm install`
4. **KONFIGURASI WAJIB (Database & API):**
   - Salin file `.env.example` menjadi file baru bernama `.env.local`.
   - Sesuaikan isinya dengan konfigurasi MySQL dan port lokal Anda:
     ```
     # Konfigurasi Database (untuk server.js)
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=
     DB_NAME=agrosync_db

     # Port untuk API Server (Express) saat pengembangan lokal
     API_PORT=3001
     # URL API (Frontend akan memanggil backend di port ini saat pengembangan lokal).
     # DI PRODUKSI (CPANEL), INI HARUS DIUBAH MENJADI URL APLIKASI NODE.JS ANDA.
     NEXT_PUBLIC_API_URL=http://localhost:3001
     ```
5. **Jalankan Proyek Pengembangan (Backend & Frontend Secara Bersamaan):**
     ```bash
     npm run dev
     ```
   - *(Akses dasbor frontend di `http://localhost:3000` dan server API di `http://localhost:3001`)*

### FASE 3: Ekstraksi Anotasi Dataset (Python Core)
Skrip jembatan antara kurasi manusia di Dasbor menuju format MLOps (YOLOv8).
1. Buka terminal (CMD/GitBash).
2. Pastikan dependensi Python terpasang: `pip install mysql-connector-python python-dotenv requests`
3. Pastikan file `.env.local` dari FASE 2 sudah dibuat. Skrip akan otomatis membaca kredensial dari sana.
4. Eksekusi program dari direktori root: `python extractor.py`

---

## 🛑 DIAGNOSTIK MASALAH (Troubleshooting)

* **Dasbor Tidak Memuat Data:** Pastikan kedua server berjalan (`npm run dev`). Cek file `.env.local` dan pastikan `NEXT_PUBLIC_API_URL` menunjuk ke port yang benar (default: 3001).
* **Galat `mysqld_stmt_execute`:** Gunakan XAMPP/MySQL versi stabil. Jika membandel, pastikan fungsi penarikan data masif menggunakan `db.query()` dan bukan `db.execute()`.
* **Peringatan `Hydration Mismatch` (Next.js):** Peringatan zona waktu ini telah dimitigasi dengan `suppressHydrationWarning`.