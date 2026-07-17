/**
 * ==============================================================================
 * PROYEK SKRIPSI : AGROSYNC TELEMETRY GATEWAY (TITIK 1)
 * MCU            : NodeMCU ESP8266 (DevKit V1.0)
 * FUNGSI         : UART CSV -> JSON -> HTTPS POST -> Polling Command Balik
 * FITUR BARU     : Advance Serial Watchdog & cPanel ModSecurity Bypass
 * ==============================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h> 
#include <SoftwareSerial.h>

// --- KREDENSIAL JARINGAN & SERVER  ---
const char* ssid = "Agroclimate_Vision";
const char* password = "tetepsutra";
const char* serverUrl = "https://agrosync.analyzer.web.id/api/telemetry";

// const char* fingerprint = "1E:45:8E:FC:B1:79:38:42:6F:55:84:BC:AB:C6:16:83:1D:61:16:6E";

// Konfigurasi Pin Komunikasi ke Arduino Uno
SoftwareSerial arduinoSerial(15, 13); // (RX=GPIO15/D8, TX=GPIO13/D7)

// Variabel Diagnostik Watchdog
unsigned long lastSerialCheckTime = 0;
const long serialTimeout = 10000; // Ambang batas 10 detik

void setup() {
  Serial.begin(115200);
  arduinoSerial.begin(9600); 
  
  Serial.println("\n\n=======================================================");
  Serial.println("[BOOT] MEMULAI INISIALISASI SISTEM GATEWAY NODEMCU");
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.printf("[NETWORK] Memulai negosiasi protokol dengan SSID: %s\n", ssid);
  
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(2000);
    wifiAttempts++;
    Serial.printf("[NETWORK] Percobaan %d: Meminta IP Address dari Router...\n", wifiAttempts);
  }
  
  Serial.println("[NETWORK] Autentikasi Wi-Fi Berhasil!");
  Serial.printf("[NETWORK] IP Lokal: %s | Sinyal RSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  Serial.println("=======================================================\n");
  Serial.println("[STATE: LISTENING] Mengawasi port SoftwareSerial dari Arduino Uno...");
}

void loop() {
  unsigned long currentMillis = millis();

  // ==========================================================================
  // 1. MANAJEMEN KONEKSI JARINGAN (HEARTBEAT)
  // ==========================================================================
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[NETWORK ERROR] Sambungan terputus dari Router! Menghentikan transmisi sementara.");
    WiFi.reconnect();
    delay(3000); 
    return;
  }

  // ==========================================================================
  // 2. DIAGNOSTIK KONEKSI SERIAL TINGKAT LANJUT (WATCHDOG)
  // ==========================================================================
  if (currentMillis - lastSerialCheckTime >= serialTimeout) {
    lastSerialCheckTime = currentMillis; 
    
    Serial.println("\n[!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!]");
    Serial.println("[CRITICAL HARDWARE WARNING] TIMEOUT KOMUNIKASI SERIAL!");
    Serial.println("NodeMCU telah terisolasi. 10 Detik tanpa data dari Arduino.");
    Serial.println("------------------------------------------------------------");
    Serial.println("PROBABILITAS KEGAGALAN & PROTOKOL MITIGASI:");
    Serial.println("1. [POWER STARVATION] Arus adaptor 5V/1A terhisap habis oleh ESP.");
    Serial.println("   -> Akibat: Arduino mengalami 'Brownout Reset' berulang kali.");
    Serial.println("2. [UNIFIED GROUND FATALITY] Kabel GND Arduino dan NodeMCU tidak bersatu.");
    Serial.println("   -> Akibat: Logika biner (0/1) hancur karena ketiadaan referensi titik nol.");
    Serial.println("3. [WIRING DISRUPTION] Kabel transmisi data terputus.");
    Serial.println("   -> Periksa: Pin TX Arduino -> Resistor 1k -> [Titik Cabang RX D8 NodeMCU] -> Resistor 2k -> GND.");
    Serial.println("4. [SOFTWARE HALT] Mesin AVR Arduino membeku (Hang).");
    Serial.println("   -> Solusi instan: Tekan tombol RESET fisik pada Arduino Uno.");
    Serial.println("[!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!]\n");
  }

  // ==========================================================================
  // 3. LOGIKA PENERIMAAN DATA (PARSING CSV -> JSON)
  // ==========================================================================
  if (arduinoSerial.available() > 0) {
    lastSerialCheckTime = currentMillis; 

    String csvPayload = arduinoSerial.readStringUntil('\n');
    csvPayload.trim(); 

    if (csvPayload.length() > 0) {
      Serial.println("\n-------------------------------------------------------");
      Serial.printf("[UART RX] Blok data mentah diterima: '%s'\n", csvPayload.c_str());
      Serial.println("[PARSER] Mengekstrak variabel mikroklimat dari struktur CSV...");

      int firstComma = csvPayload.indexOf(',');
      int secondComma = csvPayload.indexOf(',', firstComma + 1);
      int thirdComma = csvPayload.indexOf(',', secondComma + 1);

      if (firstComma > 0 && secondComma > 0 && thirdComma > 0) {
        String strSuhu = csvPayload.substring(0, firstComma);
        String strRH = csvPayload.substring(firstComma + 1, secondComma);
        String strAngin = csvPayload.substring(secondComma + 1, thirdComma);
        String strAlert = csvPayload.substring(thirdComma + 1);

        Serial.printf("   > Suhu: %s C | RH: %s %% | Angin: %s m/s | Hama Flag: %s\n", 
                      strSuhu.c_str(), strRH.c_str(), strAngin.c_str(), strAlert.c_str());

        String jsonPayload = "{";
        jsonPayload += "\"suhu\":" + strSuhu + ",";
        jsonPayload += "\"kelembaban\":" + strRH + ",";
        jsonPayload += "\"kecepatan_angin\":" + strAngin + ","; 
        jsonPayload += "\"status_alert\":" + strAlert;        
        jsonPayload += "}";

        transmisiDataKeServer(jsonPayload);
      } else {
        Serial.println("[PARSER ERROR] Integritas data CSV cacat. Paket dibuang.");
      }
      Serial.println("-------------------------------------------------------");
    }
  }
}

// ==========================================================================
// 4. LOGIKA HTTPS POST DENGAN SHA-1 FINGERPRINT BYPASS
// ==========================================================================
void transmisiDataKeServer(String json) {
  WiFiClientSecure client;
  // [Optimasi Software] Bypass validasi sertifikat SSL yang kadaluarsa tiap 90 hari
  client.setInsecure();
  // Mengatur timeout lebih panjang untuk HTTPS Handshake (15 Detik)
  client.setTimeout(15000);
  // [PENTING] Membebaskan sebagian memori SRAM ESP8266 sebelum inisiasi SSL
  // SSL Handshake butuh memori raksasa, jika SRAM penuh, koneksi akan 'Connection Failed'
  client.setBufferSizes(512, 512);
  HTTPClient http;
  Serial.printf("[HTTPS TX] Memulai negosiasi TLS/SSL ke %s\n", serverUrl);
    // Mulai koneksi HTTP dengan SSL
  if (http.begin(client, serverUrl)) {
    http.addHeader("Content-Type", "application/json");
    // [MODIFIKASI KRUSIAL] Injeksi API Key agar tidak ditolak oleh Express.js
    http.addHeader("X-API-KEY", "tetepsutra");
    // Penyamaran (Spoofing) untuk melewati ModSecurity
    http.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0");
    Serial.printf("[HTTPS TX] Payload: %s\n", json.c_str());
    int httpResponseCode = http.POST(json);
    if (httpResponseCode > 0) {
      Serial.printf("[HTTPS RX] Server merespon dengan kode: %d\n", httpResponseCode);
      if (httpResponseCode == 200 || httpResponseCode == 201) { 
        String responseBody = http.getString();
        responseBody.trim();
        Serial.printf("[PIGGYBACK RX] Balasan server: '%s'\n", responseBody.c_str());
        if (responseBody == "CMD_CAPTURE") {
          Serial.println("[AKSI KONTROL] Menerima instruksi Inspeksi Manual Web!");
          arduinoSerial.print('C'); 
        } else {
          Serial.println("[AKSI KONTROL] Kondisi normal. Mengirim sinyal sehat.");
          arduinoSerial.print('K'); 
        }
      } else {
        Serial.printf("[HTTPS ERROR] cPanel menolak request. Body: %s\n", http.getString().c_str());
      }
    } else {
      Serial.printf("[HTTPS FATAL] Transmisi POST gagal. Kode Error: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end(); 
  } else {
    Serial.println("[HTTPS FATAL] Gagal menghubungkan ke domain (DNS/SSL Handshake Error).");
  }

  Serial.println("[SYSTEM] Transaksi jaringan ditutup. Kembali mendengarkan Arduino...");
}