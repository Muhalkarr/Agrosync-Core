import mysql.connector
import os
import shutil
import requests # <-- Tambahkan library untuk permintaan HTTP
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env.local') # Memuat variabel dari file .env.local agar konsisten

# ==============================================================================
# AGROSYNC DATASET EXTRACTOR (PYTHON CORE)
# Fungsi: Menyalin citra yang telah dikurasi manusia dari Node.js ke folder AI
EXPORT_DIR = "./Agrosync_Curated_Dataset"

def main():
    print("[SYSTEM] Memulai Ekstraksi Dataset Agrosync...")
    
    # 2. Koneksi ke MySQL Database Lokal (Menggunakan Environment Variables)
    try:
        db = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME")
        )
        cursor = db.cursor()
    except Exception as e:
        print(f"[FATAL ERROR] Gagal terhubung ke MySQL: {e}")
        return

    # Buat direktori ekspor bersih
    os.makedirs(f"{EXPORT_DIR}/HAMA", exist_ok=True)
    os.makedirs(f"{EXPORT_DIR}/NORMAL", exist_ok=True)

    # 3. Kueri Ekstraksi Selektif (Hanya ambil yang valid)
    query = "SELECT id, file_path, manual_label, image_url FROM visi_edge WHERE manual_label IN ('HAMA', 'NORMAL') AND image_url IS NOT NULL"
    cursor.execute(query)
    rows = cursor.fetchall()

    if not rows:
        print("[INFO] Tidak ada data berlabel HAMA atau NORMAL di database.")
        return

    sukses = 0
    gagal = 0

    print(f"[INFO] Ditemukan {len(rows)} citra terkurasi. Memulai penyalinan biner...")

    # 4. Loop Pemindahan Biner
    for row_id, file_path, label, image_url in rows:
        file_name = os.path.basename(file_path)
        dst_path = os.path.join(EXPORT_DIR, label, f"id{row_id}_{file_name}")

        try:
            # --- LOGIKA BARU: Unduh gambar dari URL Vercel Blob ---
            response = requests.get(image_url, stream=True)
            if response.status_code == 200:
                with open(dst_path, 'wb') as f:
                    shutil.copyfileobj(response.raw, f)
                sukses += 1
            else:
                print(f"[WARNING] Gagal mengunduh {file_name}: Status {response.status_code}")
                gagal += 1
        except Exception as e:
            print(f"[ERROR] Gagal memproses {file_name}: {e}")
            gagal += 1

    print("=====================================================")
    print(f"[DONE] Ekstraksi Selesai!")
    print(f"Total Berhasil: {sukses} citra")
    print(f"Total Gagal (Hilang): {gagal} citra")
    print(f"Lokasi Output: {os.path.abspath(EXPORT_DIR)}")
    print("=====================================================")

if __name__ == "__main__":
    main()