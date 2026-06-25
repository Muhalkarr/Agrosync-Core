import os
import requests
import shutil
from dotenv import load_dotenv

# Load konfigurasi dari .env.local
load_dotenv('.env.local')

# API Peladen Produksi
API_URL = "https://agrosync.analyzer.web.id/api/vision/extract-mlops"
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://agrosync.analyzer.web.id")
EXPORT_DIR = "Agrosync_Curated_Dataset"

# Injeksi Header Anti-WAF
HEADERS_PALSU = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive'
}

def setup_directories():
    labels = ['UNLABELED', 'HAMA', 'NORMAL', 'BURAM']
    for label in labels:
        path = os.path.join(EXPORT_DIR, label)
        os.makedirs(path, exist_ok=True)
    print(f"[INFO] Direktori dataset siap di: {EXPORT_DIR}")

def fetch_and_download():
    print(f"[SYSTEM] Memanggil data dari API: {API_URL}")
    
    try:
        # 1. Minta daftar gambar dari server Express
        api_response = requests.get(API_URL, headers=HEADERS_PALSU, timeout=15)
        api_response.raise_for_status()
        dataset = api_response.json()
        
        total_citra = len(dataset)
        print(f"[INFO] Ditemukan {total_citra} citra di server. Memulai ekstraksi biner...")
        
        sukses, gagal = 0, 0
        
        # 2. Iterasi dan unduh masing-masing gambar
        for data in dataset:
            row_id = data.get('id')
            label = data.get('manual_label')
            image_url = data.get('image_url')
            
            if not image_url:
                continue

            file_name = image_url.split('/')[-1]
            full_image_url = f"{FRONTEND_URL.rstrip('/')}{image_url}"
            dst_path = os.path.join(EXPORT_DIR, label, f"id{row_id}_{file_name}")

            # Lewati jika gambar sudah pernah diunduh sebelumnya
            if os.path.exists(dst_path):
                print(f"[SKIP] Citra {file_name} sudah ada di folder {label}")
                continue

            # Unduh biner gambar
            try:
                img_response = requests.get(full_image_url, stream=True, headers=HEADERS_PALSU, timeout=15)
                if img_response.status_code == 200:
                    with open(dst_path, 'wb') as f:
                        shutil.copyfileobj(img_response.raw, f)
                    sukses += 1
                else:
                    gagal += 1
                    print(f"[WARNING] Gagal mengunduh {file_name} - HTTP {img_response.status_code}")
            except Exception as e:
                gagal += 1
                print(f"[ERROR] Koneksi putus saat mengunduh {file_name}: {e}")

        print("=====================================================")
        print("[DONE] Ekstraksi Selesai!")
        print(f"Total Baru Berhasil: {sukses} citra")
        print(f"Total Gagal/Lewat: {gagal} citra")
        print("=====================================================")

    except Exception as err:
        print(f"[FATAL ERROR] Gagal menghubungi API Server: {err}")

if __name__ == "__main__":
    setup_directories()
    fetch_and_download()