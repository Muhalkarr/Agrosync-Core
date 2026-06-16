import mysql.connector
import os
import shutil

# ==============================================================================
# AGROSYNC DATASET EXTRACTOR (PYTHON CORE)
# Fungsi: Menyalin citra yang telah dikurasi manusia dari Node.js ke folder AI
# ==============================================================================

# 1. Konfigurasi Path (SESUAIKAN DENGAN LOKASI FOLDER BACKEND ANDA)
# Contoh jika folder agrosync-backend ada di C:/Arsitektur.../agrosync-backend
BACKEND_UPLOAD_DIR = r"C:\Arsitektur_server_Nodejs_dan_skema_Database_MySQL\agrosync-backend"
EXPORT_DIR = "./Agrosync_Curated_Dataset"

def main():
    print("[SYSTEM] Memulai Ekstraksi Dataset Agrosync...")
    
    # 2. Koneksi ke MySQL Database Lokal
    try:
        db = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="agrosync_db"
        )
        cursor = db.cursor()
    except Exception as e:
        print(f"[FATAL ERROR] Gagal terhubung ke MySQL: {e}")
        return

    # Buat direktori ekspor bersih
    os.makedirs(f"{EXPORT_DIR}/HAMA", exist_ok=True)
    os.makedirs(f"{EXPORT_DIR}/NORMAL", exist_ok=True)

    # 3. Kueri Ekstraksi Selektif (Hanya ambil yang valid)
    query = "SELECT id, file_path, manual_label FROM visi_edge WHERE manual_label IN ('HAMA', 'NORMAL')"
    cursor.execute(query)
    rows = cursor.fetchall()

    if not rows:
        print("[INFO] Tidak ada data berlabel HAMA atau NORMAL di database.")
        return

    sukses = 0
    gagal = 0

    print(f"[INFO] Ditemukan {len(rows)} citra terkurasi. Memulai penyalinan biner...")

    # 4. Loop Pemindahan Biner
    for row_id, file_path, label in rows:
        # file_path formatnya: /uploads/edge_vision_12345.jpg
        # Hapus garis miring pertama agar path.join tidak kebingungan di Windows
        clean_path = file_path.lstrip('/') 
        src_path = os.path.join(BACKEND_UPLOAD_DIR, clean_path)
        
        file_name = os.path.basename(file_path)
        dst_path = os.path.join(EXPORT_DIR, label, f"id{row_id}_{file_name}")

        try:
            shutil.copy2(src_path, dst_path)
            sukses += 1
        except Exception as e:
            print(f"[WARNING] Gagal menyalin {file_name}: File fisik tidak ditemukan di hard disk.")
            gagal += 1

    print("=====================================================")
    print(f"[DONE] Ekstraksi Selesai!")
    print(f"Total Berhasil: {sukses} citra")
    print(f"Total Gagal (Hilang): {gagal} citra")
    print(f"Lokasi Output: {os.path.abspath(EXPORT_DIR)}")
    print("=====================================================")

if __name__ == "__main__":
    main()