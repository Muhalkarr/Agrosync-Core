/**
 * ==============================================================================
 * PROYEK SKRIPSI: AGROSYNC EDGE VISION (TITIK 2)
 * MCU           : AI Thinker ESP32-CAM
 * FUNGSI        : Interupsi Hardware -> PWM Flash -> Frame Discard -> HTTPS POST Raw
 * CORE VERSION  : ESP32 Arduino Core v3.x Compatible
 * ==============================================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClientSecure.h> // Pustaka Wajib untuk koneksi HTTPS cPanel
#include <HTTPClient.h>
#include "soc/soc.h"           // Mengimpor definisi register dasar sistem silikon
#include "soc/rtc_cntl_reg.h"  // Mengimpor definisi register kontrol daya (termasuk detektor penurunan tegangan)

// --- KREDENSIAL JARINGAN & SERVER ABSOLUT ---
const char* ssid = "Agroclimate_Vision";
const char* password = "tetepsutra";

// Alamat absolut Server Node.js (cPanel Domainesia)
const char* serverUrl = "https://agrosync.analyzer.web.id/api/vision/upload";
const char* configUrl = "https://agrosync.analyzer.web.id/api/vision/config"; // Rute opsional untuk konfigurasi

// --- KONFIGURASI HARDWARE PIN ---
#define PIN_TRIGGER 13 // Pin penerima sinyal 3.3V dari Arduino
#define PIN_FLASH 4    // Pin absolut untuk High-Power LED Flash

// KONFIGURASI PWM UNTUK LED FLASH (Arsitektur API v3.x)
#define FLASH_FREQ 5000       // Frekuensi 5000 Hz
#define FLASH_RESOLUTION 8    // Resolusi 8-bit (0-255)

// Konfigurasi Pin Spesifik Modul Kamera AI-Thinker
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

unsigned long lastStatusTime = 0;
const long statusInterval = 10000; 
bool isCameraInitComplete = false;

void setup() {
  Serial.begin(115200);
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.println("\n\n=======================================================");
  Serial.println("[BOOT] MEMULAI INISIALISASI KERNEL ESP32-CAM");
  
  pinMode(PIN_TRIGGER, INPUT_PULLDOWN); 
  
  // INISIALISASI PWM LEDC (Sintaks Baru ESP32 Core v3.x)
  Serial.println("[HARDWARE] Mengalokasikan LEDC PWM untuk Flash (v3.x API)...");
  ledcAttach(PIN_FLASH, FLASH_FREQ, FLASH_RESOLUTION);
  ledcWrite(PIN_FLASH, 0); // Matikan LED saat booting
  
  // 1. INISIALISASI KAMERA & PSRAM
  Serial.println("[HARDWARE] Mengonfigurasi register OV2640...");
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Verifikasi ketersediaan PSRAM untuk resolusi tinggi
  if(psramFound()){
    Serial.println("[MEMORY] 4MB PSRAM Terdeteksi. Resolusi dikunci di UXGA.");
    config.frame_size = FRAMESIZE_UXGA; // Resolusi 1600x1200 untuk visibilitas hama maksimal
    config.jpeg_quality = 10;           // Kualitas tinggi (0-63, makin kecil makin bagus)
    config.fb_count = 2;                // Double buffering untuk mencegah frame drop
  } else {
    Serial.println("[MEMORY FATAL] PSRAM TIDAK TERDETEKSI! Resolusi diturunkan ke SVGA.");
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[FATAL ERROR] Inisialisasi Kamera Gagal. Kode Kesalahan: 0x%x\n", err);
    Serial.println("[HALT] Sistem dihentikan.");
    return; 
  }
  isCameraInitComplete = true;
  Serial.println("[HARDWARE] Modul Kamera OV2640 Berhasil Terpasang.");

  // 2. INISIALISASI JARINGAN (Mode Performa Tinggi)
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false); // Blokir mode hemat daya antena
  WiFi.begin(ssid, password);
  Serial.printf("[NETWORK] Memulai negosiasi protokol dengan SSID: %s\n", ssid);
  
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(2000);
    wifiAttempts++;
    Serial.printf("[NETWORK] Percobaan %d: Meminta alokasi IP...\n", wifiAttempts);
  }
  Serial.printf("[NETWORK] Autentikasi Berhasil! Alamat IP Lokal: %s\n", WiFi.localIP().toString().c_str());
  Serial.println("=======================================================\n");
  Serial.println("[STATE: IDLE] Menunggu interupsi tegangan 3.3V di Pin GPIO13.");
}

void loop() {
  if (!isCameraInitComplete) return;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[NETWORK ERROR] Sambungan terputus! Memulihkan koneksi...");
    WiFi.reconnect();
    delay(3000); 
    return;
  }

  unsigned long currentMillis = millis();
  if (currentMillis - lastStatusTime >= statusInterval) {
    lastStatusTime = currentMillis;
    Serial.println("[STATE: STANDBY] Kamera aktif. Menunggu pemicu.");
  }

  // Deteksi lonjakan tegangan dari Master Arduino
  if (digitalRead(PIN_TRIGGER) == HIGH) {
    Serial.println("\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
    Serial.println("[TRIGGER: ACTIVE] Lonjakan tegangan terbaca di GPIO13!");
    
    // Objek Klien Keamanan HTTPS
    WiFiClientSecure client;
    
    // [MODIFIKASI KRUSIAL MUTLAK] Bypass validasi SSL dengan metode yang benar
    client.setInsecure(); 
    client.setTimeout(15000);           // Toleransi TCP 15 detik

    // 0. TARIK KONFIGURASI KECERAHAN DARI PELADEN
    Serial.println("[VISION] Mengambil konfigurasi kecerahan optik dari Server HTTPS...");
    int dynamicBrightness = 20; // Nilai aman default jika jaringan lambat
    
    HTTPClient httpConfig;
    if (httpConfig.begin(client, configUrl)) {
      httpConfig.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0");
      // [MODIFIKASI KRUSIAL] API Key untuk rute GET
      httpConfig.addHeader("X-API-KEY", "tetepsutra");
      
      int codeConf = httpConfig.GET();
      if (codeConf == 200 || codeConf == 201) {
        String payload = httpConfig.getString();
        dynamicBrightness = payload.toInt();
        if(dynamicBrightness < 0) dynamicBrightness = 0;
        if(dynamicBrightness > 255) dynamicBrightness = 255;
      } else {
        Serial.printf("[VISION WARNING] Gagal menarik konfigurasi (Kode: %d). Menggunakan default 20.\n", codeConf);
      }
      httpConfig.end();
    } else {
      Serial.println("[VISION ERROR] Gagal membuka soket HTTPS untuk konfigurasi.");
    }

    // 1. PENYALAAN OPTIK TERKENDALI DINAMIS
    Serial.printf("[VISION] Menyalakan LED Flash pada intensitas %d/255...\n", dynamicBrightness);
    ledcWrite(PIN_FLASH, dynamicBrightness);
    
    delay(500); // Jeda stabilisasi listrik sirkuit DC-DC

    // 2. FRAME DISCARDING (Membersihkan Buffer DMA & Kalibrasi AEC)
    Serial.println("[VISION] Membuang 3 frame sampah untuk konvergensi optik...");
    camera_fb_t * fb = NULL; 

    for (int i = 0; i < 4; i++) {
      fb = esp_camera_fb_get();
      
      if (!fb) {
        Serial.println("[ERROR] Kegagalan alokasi Frame Buffer.");
        ledcWrite(PIN_FLASH, 0); // Amankan LED jika terjadi error
        return; 
      }
      
      if (i < 3) {
        esp_camera_fb_return(fb); 
        fb = NULL; 
        delay(100); 
      }
    }
    
    // 3. PEMADAMAN OPTIK
    ledcWrite(PIN_FLASH, 0); 

    Serial.printf("[VISION] Gambar matang berhasil dipotret! Ukuran File Biner: %d Bytes\n", fb->len);
    Serial.println("[NETWORK] Membuka soket TCP SSL ke Server Node.js...");
    
    // 4. TRANSMISI JARINGAN (GAMBAR RAW)
    HTTPClient http;
    
    // Pastikan limitasi hardware terkelola, kosongkan memori SRAM sebelum inisiasi SSL berat
    // HAPUS perintah client.setBufferSizes(512, 512); 
    // ESP32 tidak membutuhkannya dan akan menyebabkan kompilasi meledak.
    // [MODIFIKASI KRUSIAL] Eksekusi Bypass validasi SSL dengan SINTAKS YANG BENAR
    client.setInsecure(); 
    client.setTimeout(20000); // Naikkan toleransi TCP menjadi 20 detik (Sering dibutuhkan ESP32-CAM)
    
    if (http.begin(client, serverUrl)) {
      http.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0");
      http.addHeader("Content-Type", "image/jpeg");
      // [MODIFIKASI KRUSIAL] API Key untuk rute POST Upload Gambar
      http.addHeader("X-API-KEY", "tetepsutra");
      
      int httpResponseCode = http.POST(fb->buf, fb->len);
      if (httpResponseCode > 0) {
        Serial.printf("[NETWORK] Transmisi Selesai. Kode Respon Server: %d\n", httpResponseCode);
        if (httpResponseCode == 200 || httpResponseCode == 201) {
           Serial.println("[SUCCESS] Gambar berhasil disimpan oleh Server Node.js.");
        } else {
           Serial.printf("[NETWORK ERROR] Respon dari cPanel: %s\n", http.getString().c_str());
        }
      } else {
        Serial.printf("[NETWORK FATAL] Transmisi Gagal. Diagnostik: %s\n", http.errorToString(httpResponseCode).c_str());
      }
      http.end();
    } else {
       Serial.println("[NETWORK FATAL] Gagal menghubungkan ke domain (DNS/SSL Handshake Error).");
    }

    // 5. PEMBERSIHAN MEMORI & SIKLUS PENDINGINAN
    esp_camera_fb_return(fb); 
    Serial.println("[MEMORY] Frame buffer dibersihkan dari RAM.");
    Serial.println("[COOLDOWN] Menidurkan sensor kamera selama 5 detik...");
    Serial.println("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n");
    
    delay(5000); 
    lastStatusTime = millis(); 
  }
}