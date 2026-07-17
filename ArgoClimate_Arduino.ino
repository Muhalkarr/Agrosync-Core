/**
 * ==============================================================================
 * PROYEK SKRIPSI: AGROSYNC KINETIC HUB - MASTER CONTROLLER (TITIK 1)
 * ARSITEKTUR    : Finite State Machine (FSM) Non-Blocking & Asinkron
 * MCU           : Arduino Uno Rev3 (16 MHz, 8-bit AVR)
 * UI OUTPUT     : LCD 16x2 I2C & Serial Monitor (115200 bps)
 * DATA LINK     : SoftwareSerial ke NodeMCU (9600 bps)
 * EDGE TRIGGER  : Digital Pulse Output ke ESP32-CAM (Sinyal 3.3V via Divider)
 * ==============================================================================
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <SoftwareSerial.h>

/* --- ALOKASI PIN MUTLAK (HARDWARE MAPPING) --- */
// PILAR A: Kepatuhan pada Arsitektur AVR (Tidak boleh diubah)
#define PIN_ANEMO 2       // WAJIB D2 (Hardware Interrupt 0) untuk pulsa angin
#define PIN_HAMA 3        // WAJIB D3 (Hardware Interrupt 1) untuk sensor IR 
#define PIN_BUTTON 4      // Pin untuk tombol LCD
#define PIN_DHT A1        // Digital I/O (Ingat: Pasang Resistor Pull-up 4.7k ke 5V di dekat Arduino)
#define PIN_LED_R 5       // Pin PWM (Pulse Width Modulation) untuk warna Merah
#define PIN_LED_G 6       // Pin PWM untuk warna Hijau
#define PIN_LED_B 9       // Pin PWM untuk warna Biru
#define PIN_CAM_TRIG 8    // Digital Output Pemicu ke ESP32-CAM (Lewat Voltage Divider!)
#define DHTTYPE DHT22     // Tipe Sensor Suhu/Kelembapan

/* --- INSTANSIASI OBJEK KOMPONEN --- */
DHT dht(PIN_DHT, DHTTYPE);
LiquidCrystal_I2C lcd(0x27, 16, 2); // Alamat I2C default layar. Jika layar tidak tampil teks, ganti ke 0x3F.
SoftwareSerial espSerial(10, 11);   // RX=10 (Aman 3.3V masuk), TX=11 (5V keluar -> Divider -> NodeMCU)

/* --- VARIABEL VOLATILE (MEMORI ISOLASI UNTUK ISR) --- 
 * Kata kunci 'volatile' memaksa kompilator memuat variabel ini langsung dari RAM, 
 * bukan dari register, karena nilainya bisa berubah sewaktu-waktu oleh Interupsi (Interrupt).
 */
volatile unsigned int pulseCount = 0;
volatile bool flagHama = false;
volatile unsigned long lastHamaTime = 0;
volatile unsigned long lastAnemoTime = 0;

/* --- VARIABEL MANAJEMEN WAKTU (FINITE STATE MACHINE) --- 
 * PILAR B: Mengganti fungsi delay() yang memblokir prosesor dengan selisih waktu millis().
 */
unsigned long prevMillisSensor = 0;
unsigned long prevMillisLCD = 0;
unsigned long lcdWakeTime = 0;       // Mengingat kapan LCD dihidupkan
unsigned long prevMillisESP = 0;
unsigned long alertStartTime = 0;
unsigned long camPulseStartTime = 0;

// Konstanta Interval Waktu (dalam milidetik)
const long intervalSensor = 2000;   // Sensor DHT22 butuh jeda minimal 2 detik per bacaan
const long lcdDuration = 15000;     // Durasi menyala (15.000 milidetik / 15 detik)
const long intervalLCD = 3000;      // Layar LCD berganti halaman setiap 3 detik
const long intervalESP = 5000;      // Mengirim paket CSV ke NodeMCU setiap 5 detik
const long alertDuration = 3000;    // Durasi LED Merah menyala setelah hama terdeteksi
const long camPulseDuration = 50;   // Lama sinyal HIGH dikirim ke ESP32-CAM (50ms cukup untuk memicu)

/* --- BUFFER DATA --- */
float t = 0.0;
float h = 0.0;
float windSpeed = 0.0;
byte lcdState = 0;
bool isCamPulsing = false; // Penanda apakah sinyal trigger kamera sedang aktif
bool isLcdOn = false;      // TAMBAHKAN INI! Penanda status fisik layar LCD

/* --- LOGIKA STATUS SISTEM (ENUMERATION) --- */
enum SystemState { BOOT, LOKAL, ONLINE, ALERT };
SystemState sysState = LOKAL;
SystemState prevState = LOKAL; // Mengingat state sebelum masuk mode darurat (Alert)

void setup() {
  /* 1. Konfigurasi Mode Pin GPIO */
  pinMode(PIN_ANEMO, INPUT_PULLUP); // Aktifkan resistor internal agar tidak floating
  pinMode(PIN_HAMA, INPUT_PULLUP);
  pinMode(PIN_BUTTON, INPUT_PULLUP); // Mengaktifkan resistor pengaman internal
  pinMode(PIN_LED_R, OUTPUT);
  pinMode(PIN_LED_G, OUTPUT);
  pinMode(PIN_LED_B, OUTPUT);
  pinMode(PIN_CAM_TRIG, OUTPUT);
  
  digitalWrite(PIN_CAM_TRIG, LOW); // Pastikan ESP32-CAM tidak terpicu saat Arduino baru menyala

  /* 2. Konfigurasi Protokol Komunikasi */
  // PILAR B: Baud rate tinggi untuk Laptop mencegah bottleneck. Baud rendah untuk NodeMCU demi stabilitas bit.
  Serial.begin(115200);   
  espSerial.begin(9600);  
  dht.begin();
  lcd.init();
  lcd.backlight();

  /* 3. Booting Antarmuka (UI) */
  setRGB(0, 255, 0); // Nyalakan Hijau Konstan
  lcd.setCursor(0,0); lcd.print("AGROSYNC HUB");
  lcd.setCursor(0,1); lcd.print("SISTEM SIAP...");
  
  Serial.println("\n[SYSTEM] ARDUINO MASTER CONTROLLER ONLINE");
  delay(2000);          // delay() diizinkan HANYA di setup() untuk memberi waktu sensor panas
  lcd.noBacklight();    // Matikan lampu latar saat alat pertama kali stand-by
  lcd.clear();

  /* 4. Registrasi Interupsi Perangkat Keras (Interrupt Service Routine / ISR) */
  // RISING: Menangkap pulsa saat magnet anemometer mendekat (LOW ke HIGH)
  attachInterrupt(digitalPinToInterrupt(PIN_ANEMO), isrAnemo, RISING);
  // FALLING: Menangkap pulsa saat ngengat memotong sinar IR (HIGH ke LOW)
  attachInterrupt(digitalPinToInterrupt(PIN_HAMA), isrHama, FALLING);
}

void loop() {
  unsigned long currentMillis = millis(); // Ambil stempel waktu saat ini

  /* ========================================================================
   * BLOK 1: RUTINITAS PEMICU KAMERA (NON-BLOCKING PULSE)
   * Mengembalikan pin D8 ke LOW setelah 50ms tanpa menggunakan delay()
   * ======================================================================== */
  if (isCamPulsing && (currentMillis - camPulseStartTime >= camPulseDuration)) {
    digitalWrite(PIN_CAM_TRIG, LOW);
    isCamPulsing = false;
    Serial.println("[VISION] Pulse Trigger Kamera Selesai (LOW).");
  }

/* ========================================================================
   * BLOK 2: POLLING HANDSHAKE & COMMAND DARI NODEMCU
   * ======================================================================== */
  if (espSerial.available() > 0) {
    char c = espSerial.read();
    
    if (c == 'K') { 
      // --- SINYAL JARINGAN NORMAL ---
      if (sysState != ALERT && sysState != ONLINE) {
        sysState = ONLINE;
        setRGB(0, 0, 255); // Biru
        Serial.println("[NET] Link NodeMCU Stabil (ONLINE)");
      } else if (sysState == ALERT) {
        prevState = ONLINE; // Ingat status agar kembali Biru pasca-darurat
      }
    } 
    else if (c == 'C') {
      // --- PERINTAH INSPEKSI MANUAL DARI WEB ---
      Serial.println("[SYSTEM] INSTRUKSI MANUAL WEB DITERIMA!");
       
      // Langsung picu pin kamera secara paksa (Bypass Hardware)
      digitalWrite(PIN_CAM_TRIG, HIGH);
      isCamPulsing = true;
      camPulseStartTime = currentMillis;
       
      // Berikan indikator visual putih (Opsional, akan tertimpa siklus berikutnya)
      setRGB(255, 255, 255); 
    }
  }

  /* ========================================================================
   * BLOK 3: AKUISISI DATA SENSOR IKLIM (Setiap 2 Detik)
   * ======================================================================== */
  if (currentMillis - prevMillisSensor >= intervalSensor) {
    prevMillisSensor = currentMillis;
    float rawT = dht.readTemperature();
    float rawH = dht.readHumidity();
    
    // Validasi data (Mencegah pengiriman nilai cacat / Not a Number)
    if (!isnan(rawT) && !isnan(rawH)) {
      t = rawT; h = rawH;
    }
  }

  /* ========================================================================
   * BLOK 4: KALKULASI KECEPATAN ANGIN & TRANSMISI CSV (Setiap 5 Detik)
   * ======================================================================== */
  if (currentMillis - prevMillisESP >= intervalESP) {
    prevMillisESP = currentMillis;
    
    /* Critical Section: 
     * Matikan interupsi sementara saat kita menyalin variabel pulseCount 
     * agar nilainya tidak berubah tiba-tiba saat sedang dikalkulasi.
     */
    noInterrupts(); 
    unsigned int pCount = pulseCount;
    pulseCount = 0; // Reset hitungan pulsa
    interrupts();   // Nyalakan interupsi kembali

    // Konversi Pulsa ke Revolusi per Detik (RPS) -> durasi interval = 5 detik
    float rps = (float)pCount / 5.0; 
    // Persamaan Kalibrasi Anemometer (Sesuaikan dengan spesifikasi pabrik)
    windSpeed = ((-0.0181 * (rps * rps)) + (1.3859 * rps) + 1.4055);
    
    // Filter noise: Jika kecepatan di bawah 1.5 m/s, anggap 0 (angin terlalu lemah memutar bearing)
    if (windSpeed <= 1.5) windSpeed = 0.0; 

    // Kirim data ke NodeMCU dengan flag hama = 0 (Normal)
    kirimCSV(t, h, windSpeed, 0);
  }

  /* ========================================================================
   * BLOK 5: PENANGANAN DARURAT (HAMA TERDETEKSI OLEH INTERUPSI)
   * Skrip ini tereksekusi segera setelah isrHama() mendeteksi perubahan.
   * ======================================================================== */
  if (flagHama) {
    flagHama = false;                 // Turunkan bendera
    alertStartTime = currentMillis;   // Catat waktu mulai darurat
    
    // 5A. Aktifkan Pemicu ESP32-CAM (Trigger High)
    digitalWrite(PIN_CAM_TRIG, HIGH);
    isCamPulsing = true;
    camPulseStartTime = currentMillis;
    Serial.println("\n[VISION] MENGIRIM TRIGGER KE ESP32-CAM (HIGH)!");

    // 5B. Ubah Status Mesin ke ALERT
    if (sysState != ALERT) {
      prevState = sysState;
      sysState = ALERT;
    }
    
    setRGB(255, 0, 0); // Nyalakan LED Merah
    kirimCSV(t, h, windSpeed, 1); // Kirim CSV ke NodeMCU dengan flag hama = 1 (Peringatan)
    
    Serial.println("[!!!] HAMA MASUK PERANGKAP - NOTIFIKASI DIKIRIM\n");
    
    // Bajak tampilan LCD untuk peringatan instan & BANGUNKAN LAYAR PAKSA
    lcd.backlight();
    isLcdOn = true;
    lcdWakeTime = currentMillis; // Reset timer 15 detik dari sekarang

    lcd.clear();
    lcd.setCursor(0,0); lcd.print("!!! PERINGATAN");
    lcd.setCursor(0,1); lcd.print("HAMA TERDETEKSI");
  }

  /* ========================================================================
   * BLOK 6: PEMULIHAN STATUS PASCADARURAT (Setelah 3 Detik)
   * ======================================================================== */
  if (sysState == ALERT && (currentMillis - alertStartTime >= alertDuration)) {
    sysState = prevState; // Kembali ke status sebelum hama datang (LOKAL atau ONLINE)
    
    if (sysState == ONLINE) setRGB(0, 0, 255); // Biru
    else setRGB(0, 255, 0);                    // Hijau
    
    lcd.clear();
    Serial.println("[SYSTEM] Kembali ke Mode Normal.");
  }

  /* ========================================================================
   * BLOK 7: ROTASI ANTARMUKA LAYAR LCD (Paging UI)
   * ======================================================================== */
    // 1. MEMBACA TOMBOL FISIK
  if (digitalRead(PIN_BUTTON) == LOW && !isLcdOn) {
    lcd.backlight();           // Nyalakan lampu latar
    isLcdOn = true;            // Ubah status
    lcdWakeTime = millis();    // Catat waktu tombol ditekan
    lcdState = 0;              // Reset tampilan ke halaman pertama
    Serial.println("[UI] Tombol ditekan. Layar LCD Aktif 15 Detik.");
  }

    // 2. PEMBARUAN LAYAR (Hanya berjalan JIKA layar sedang ON)
  if (isLcdOn && sysState != ALERT && (currentMillis - prevMillisLCD >= intervalLCD)) {
    prevMillisLCD = currentMillis;
    lcd.clear();

    if (lcdState == 0) {
      lcd.setCursor(0,0); lcd.print("Suhu: "); lcd.print(t, 1); lcd.print(" C");
      lcd.setCursor(0,1); lcd.print("RH  : "); lcd.print(h, 1); lcd.print(" %");
      lcdState = 1;
    } else {
      lcd.setCursor(0,0); lcd.print("Angin:"); lcd.print(windSpeed, 1); lcd.print(" m/s");
      lcd.setCursor(0,1); 
      if (sysState == ONLINE) lcd.print("Net: CONNECTED");
      else lcd.print("Net: STANDBY");
      lcdState = 0;
    }
  }

  // 3. AUTO-OFF TIMER (Mematikan layar setelah 15 detik)
  if (isLcdOn && (currentMillis - lcdWakeTime >= lcdDuration)) {
    lcd.noBacklight();
    lcd.clear();
    isLcdOn = false;
    Serial.println("[UI] Waktu habis. Layar LCD Stand-by.");
  }
}

/* ==========================================================================
 * FUNGSI INTERRUPT SERVICE ROUTINES (ISR)
 * Aturan Mutlak ISR: Harus secepat kilat. TIDAK BOLEH ada delay() atau Serial.print() di sini!
 * ========================================================================== */

// ISR untuk Anemometer
void isrAnemo() {
  unsigned long now = millis();
  // Filter Hardware Debounce: Mencegah 1 putaran dihitung ganda akibat getaran per mekanis
  if (now - lastAnemoTime > 10) { 
    pulseCount++;
    lastAnemoTime = now;
  }
}

// ISR untuk Sensor Perangkap Hama (IR)
void isrHama() {
  unsigned long now = millis();
  /* PILAR C (Biologi): Filter Debounce 250ms. 
   * Ngengat (Bactrocera / Spodoptera) yang mengepakkan sayap atau merayap lambat 
   * di depan sensor tidak akan memicu ratusan alert palsu.
   */
  if (now - lastHamaTime > 250) {
    flagHama = true;
    lastHamaTime = now;
  }
}

/* ==========================================================================
 * FUNGSI UTILITAS SISTEM
 * ========================================================================== */

// Pengendali Warna LED RGB (Asumsi tipe Common Cathode)
void setRGB(byte r, byte g, byte b) {
  analogWrite(PIN_LED_R, r);
  analogWrite(PIN_LED_G, g);
  analogWrite(PIN_LED_B, b);
}

// Pengirim Telemetri CSV dengan Proteksi Memori (Tanpa class String)
void kirimCSV(float t_val, float h_val, float w_val, int alert_flag) {
  char tStr[8], hStr[8], wStr[8];
  char payload[40];

  // Konversi tipe float ke Array Karakter (Aman untuk SRAM)
  dtostrf(t_val, 4, 1, tStr);
  dtostrf(h_val, 4, 1, hStr);
  dtostrf(w_val, 4, 1, wStr);

  // Merangkai Array: "Suhu,Kelembaban,Angin,StatusHama"
  snprintf(payload, sizeof(payload), "%s,%s,%s,%d", tStr, hStr, wStr, alert_flag);
  
  espSerial.println(payload); // Tembak ke NodeMCU via pin 11
  
  // Tampilkan apa yang dikirim ke layar laptop untuk debugging
  Serial.print("[TX] Payload ke Server: "); 
  Serial.println(payload);
}