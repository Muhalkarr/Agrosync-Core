#  AGROSYNC CORE SYSTEM
**Sistem Pemantauan Mikroklimat & Gateway Visi Edge Terdistribusi**

Repositori ini adalah pusat dari proyek Agrosync, sebuah platform Internet of Things (IoT) yang dirancang untuk memantau kondisi mikroklimat dan visual di lingkungan pertanian. Sistem ini terdiri dari backend Node.js yang andal, dasbor frontend Next.js yang interaktif, dan skrip Python untuk ekstraksi data.

---

##  Arsitektur Sistem

Sistem ini dirancang dengan arsitektur terpadu (unified) untuk kemudahan deployment di lingkungan hosting seperti cPanel, di mana frontend dan backend berada di bawah satu domain.

```
                 +--------------------------------------+
                 |  https://agrosync.analyzer.web.id    |
                 +--------------------------------------+
                              |          ^
                              |          | (HTML/JS/CSS)
                              v          |
                 +--------------------------------------+
                 |         PENGGUNA (Browser)           |
                 +--------------------------------------+
                              |          ^
          (Fetch ke /api/...) |          | (Respons JSON)
                              v          |
                 +--------------------------------------+
                 | .htaccess (Apache Reverse Proxy)     |
                 |  - Meneruskan /api/* ke Node.js      |
                 |  - Menyajikan file statis lainnya    |
                 +--------------------------------------+
                                  |
                                  v
                 +--------------------------------------+
                 |   Aplikasi Node.js (api/server.js)   |
                 |   - Terhubung ke Database MySQL      |
                 |   - Menyimpan gambar ke /uploads/    |
                 +--------------------------------------+
```

---

##  Tumpukan Teknologi (Tech Stack)

| Komponen | Teknologi | Deskripsi |
| :--- | :--- | :--- |
| **Frontend** | Next.js (Static Export), React, TailwindCSS, Recharts | Antarmuka pengguna yang cepat dan interaktif untuk visualisasi data. |
| **Backend** | Node.js, Express.js | API server yang menangani logika bisnis, otentikasi, dan interaksi database. |
| **Database** | MySQL | Penyimpanan data telemetri, metadata gambar, dan antrean perintah. |
| **Ekstraktor** | Python, Requests, python-dotenv | Skrip untuk menarik dataset gambar dari server untuk keperluan MLOps. |
| **Deployment** | cPanel, Apache, Phusion Passenger | Lingkungan hosting untuk menjalankan aplikasi Node.js dan menyajikan web statis. |

---

## 🛠️ Panduan Instalasi & Eksekusi Lokal

### 1. Prasyarat
Pastikan perangkat lunak berikut telah terinstal di mesin Anda:
- **Node.js** (v18.x atau lebih tinggi)
- **Python** (v3.10 atau lebih tinggi)
- **MySQL Server** (misalnya melalui XAMPP, Laragon)
- **Git**

### 2. Inisialisasi Proyek

1.  **Kloning Repositori:**
    ```bash
    git clone <URL_REPOSITORI_ANDA>
    cd Agrosync-Core
    ```
2.  **Instal Dependensi:**
    - Instal dependensi frontend:
    ```bash
    npm install
    ```
    - Instal dependensi backend dan buat `package-lock.json` yang benar:
    ```bash
    cd api && npm install && cd ..
    ```
3.  **Setup Database:**
    - Nyalakan server MySQL Anda.
    - Buat database baru dengan nama `analyzer_agrosync_local.sql`.
    - Impor skema tabel dari file `skema_database.sql` (atau yang serupa) untuk membuat tabel `mikroklimat`, `visi_edge`, dan `command_queue`.

### 3. Konfigurasi Lingkungan
Salin file `.env.example` menjadi `.env.local` dan sesuaikan dengan konfigurasi lokal Anda.

```dotenv
# .env.local - Konfigurasi untuk Pengembangan Lokal

# Konfigurasi Database (untuk api/server.js & extractor.py)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=agrosync_db

# URL untuk API & Frontend
NEXT_PUBLIC_API_URL=
FRONTEND_URL=http://localhost:3000

# Kunci API untuk otentikasi perangkat keras (ESP32/NodeMCU)
HARDWARE_API_KEY=kunci_rahasia_anda_disini
```

### 4. Menjalankan Aplikasi

1.  **Jalankan Server Backend:** Buka terminal dan jalankan:
    ```bash
    node api/server.js
    ```
    Server API akan berjalan di `http://localhost:3001` (default).

2.  **Jalankan Dasbor Frontend:** Buka terminal **kedua** dan jalankan:
    ```bash
    npm run dev
    ```
    Akses dasbor di `http://localhost:3000`.

### 5. Ekstraksi Dataset (Python)
Skrip ini digunakan untuk mengunduh gambar yang telah dilabeli dari dasbor untuk digunakan dalam pelatihan model Machine Learning.

1.  **Instal Dependensi Python:**
    ```bash
    pip install requests python-dotenv
    ```
2.  **Jalankan Ekstraktor:**
    Pastikan `.env.local` sudah dikonfigurasi.
    ```bash
    python extractor.py
    ```

---

## Panduan Deployment (cPanel)

1.  **Build Frontend:** Atur `NEXT_PUBLIC_API_URL=/api` di `.env.local`, lalu jalankan `npm run build`.
2.  **Unggah File:**
    - Unggah isi folder `out/` ke `public_html/agrosync.analyzer.web.id/`.
    - Buat folder `api/` di dalam `public_html/agrosync.analyzer.web.id/`.
    - Unggah `api/server.js` dan `api/package.json` (file yang baru dibuat) ke dalam folder `api/` di server.
3.  **Konfigurasi Node.js App di cPanel:**
    - Atur *Application root* ke `public_html/agrosync.analyzer.web.id/api`.
    - Atur *Application startup file* ke `server.js`.
    - Jalankan "NPM Install".
    - Atur semua *Environment Variables* produksi (kredensial DB, API Key, dll).
4.  **Konfigurasi `.htaccess`:** Pastikan file `.htaccess` di root domain (`public_html/agrosync.analyzer.web.id/`) ada dan dikonfigurasi untuk menangani rute Next.js dan mengecualikan path `/api/`.


## Diagram topologi yang terpasang 
<img width="835" height="1017" alt="image" src="https://github.com/user-attachments/assets/a65b8e65-8247-45ec-9cdc-d518ef15a230" />

Secara kelistrikan, sistem ini sangat tidak ramah.
