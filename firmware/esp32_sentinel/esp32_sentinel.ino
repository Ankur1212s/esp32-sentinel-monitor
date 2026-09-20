#include <DHT.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>

// ================= USER CONFIGURATION =================
// 1. Mobile number to receive intrusion SMS (with country code):
#define TARGET_PHONE_NUMBER "+91XXXXXXXXXX"

// 2. Permanent 24/7 Vercel cloud dashboard endpoint:
const char* SERVER_URL = "https://esp32-sentinel-monitor-187t-ankur1212s.vercel.app/api/readings";

#define UNIT_CALLSIGN         "UNIT-01"
#define ALERT_MIN_DIST_CM     3.0    // Ignore < 3cm (ultrasonic blind zone)
#define ALERT_MAX_DIST_CM     12.0   // Triggers ONLY when hand is closer than 12cm (ignores desk at 15-25cm)
#define UPLOAD_INTERVAL_MS    10000  // Upload telemetry to cloud website every 10 seconds
#define SMS_COOLDOWN_MS       60000  // Minimum 60s cooldown between SMS alerts
// ======================================================

// --- PIN DEFINITIONS ---
#define DHTPIN        4      // DHT11 Data Pin (Wire VCC to 5V rail!)
#define DHTTYPE       DHT11
#define MQ135_PIN     34     // MQ-135 Gas Sensor Analog Pin
#define TRIG_PIN      32     // HC-SR04 Trigger Pin
#define ECHO_PIN      33     // HC-SR04 Echo Pin (via 1k/2k resistor divider)
#define GPS_RX_PIN    25     // ESP32 RX <- NEO-6M GPS TX
#define GPS_TX_PIN    26     // ESP32 TX -> NEO-6M GPS RX

DHT dht(DHTPIN, DHTTYPE);
TinyGPSPlus gps;
HardwareSerial gpsSerial(1); // Hardware UART1 for GPS

unsigned long lastUploadTime = 0;
unsigned long lastSmsTime = 0;

// Helper to send AT command and wait for OK/ERROR
String sendAT(String cmd, unsigned long timeout = 2500) {
  while (Serial.available()) Serial.read();
  Serial.println(cmd);
  String resp = "";
  unsigned long start = millis();
  while (millis() - start < timeout) {
    while (Serial.available() > 0) {
      resp += (char)Serial.read();
    }
    if (resp.indexOf("OK") != -1 || resp.indexOf("ERROR") != -1) break;
  }
  return resp;
}

// Distance measurement via HC-SR04
float getDistanceCM() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 25000); // 25ms timeout (~4m)
  if (duration <= 0) return -1.0;
  return (duration * 0.0343) / 2.0;
}

// Format live Google Maps location link
String getGoogleMapsLink() {
  if (gps.location.isValid()) {
    return "https://maps.google.com/?q=" + String(gps.location.lat(), 6) + "," + String(gps.location.lng(), 6);
  }
  return "GPS indoor (searching)";
}

// Send SMS alert via A7670C
void sendSMS(String text) {
  sendAT("AT+CMGF=1", 500);

  Serial.print("AT+CMGS=\"");
  Serial.print(TARGET_PHONE_NUMBER);
  Serial.println("\"");
  delay(800);

  Serial.println(text);
  Serial.write(26); // ASCII 26 (Ctrl+Z) sends the SMS
  delay(4000);
}

// Upload JSON payload over Airtel 4G LTE to Vercel
void postTelemetryToCloud(String json) {
  sendAT("AT+HTTPTERM", 200);
  sendAT("AT+HTTPINIT", 1000);

  sendAT("AT+HTTPPARA=\"URL\",\"" + String(SERVER_URL) + "\"", 1000);
  sendAT("AT+HTTPPARA=\"SSLCFG\",0", 300);
  sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 300);
  sendAT("AT+HTTPPARA=\"USERAGENT\",\"Mozilla/5.0 (Windows NT 10.0; Win64; x64)\"", 300);

  int payloadLen = json.length() + 2;
  Serial.println("AT+HTTPDATA=" + String(payloadLen) + ",5000");
  delay(800);

  Serial.println(json);
  delay(800);

  while (Serial.available()) Serial.read();
  Serial.println("AT+HTTPACTION=1");

  // Wait for modem to complete transmission
  unsigned long start = millis();
  while (millis() - start < 8000) {
    if (Serial.find("+HTTPACTION:")) break;
  }

  sendAT("AT+HTTPTERM", 500);
}

void setup() {
  Serial.begin(115200); // Modem on RX0 & TX0
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  dht.begin();
  pinMode(DHTPIN, INPUT_PULLUP);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(MQ135_PIN, INPUT);

  delay(3000);
  sendAT("AT", 1000);

  // --- WAIT ACTIVELY FOR AIRTEL 4G CELL TOWER REGISTRATION ---
  for (int i = 0; i < 15; i++) {
    String reg = sendAT("AT+CEREG?", 1500);
    if (reg.indexOf(",1") != -1 || reg.indexOf(", 1") != -1 ||
        reg.indexOf(",5") != -1 || reg.indexOf(", 5") != -1) {
      break; 
    }
    delay(2000);
  }

  // APN and Internet Context
  sendAT("AT+CGDCONT=1,\"IP\",\"airtelgprs.com\"", 2000);
  sendAT("AT+NETOPEN", 3000);

  // Configure SSL Context for Vercel (TLS 1.2, ignore CA, enable SNI)
  sendAT("AT+CSSLCFG=\"sslversion\",0,4", 500);
  sendAT("AT+CSSLCFG=\"authmode\",0,0", 500);
  sendAT("AT+CSSLCFG=\"sni\",0,1", 500);

  // Send single boot confirmation SMS
  sendSMS("✅ SENTINEL-4G: System Booted. Armed & Online!");
}

void loop() {
  // 1. Constantly feed GPS parser
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // 2. Read Ultrasonic Distance
  float currentDist = getDistanceCM();

  // 3. Intrusion Trigger: Only fires if hand is within 12cm (desk at 15-25cm is ignored)
  bool isIntrusion = (currentDist >= ALERT_MIN_DIST_CM && currentDist <= ALERT_MAX_DIST_CM);

  if (isIntrusion && (millis() - lastSmsTime > SMS_COOLDOWN_MS)) {
    String msg = "🚨 ALERT: Hand Motion Detected within 12cm!\n";
    msg += "Proximity: " + String(currentDist, 1) + " cm\n";
    msg += "Location: " + getGoogleMapsLink();
    sendSMS(msg);
    lastSmsTime = millis();
  }

  // 4. Telemetry Upload to Cloud Website every 10 seconds
  if (millis() - lastUploadTime >= UPLOAD_INTERVAL_MS) {
    lastUploadTime = millis();

    // Read DHT11 with retry
    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    if (isnan(temp) || isnan(hum)) {
      delay(250);
      temp = dht.readTemperature();
      hum = dht.readHumidity();
    }

    int gas = analogRead(MQ135_PIN);

    // Build JSON payload
    String payload = "{";
    payload += "\"unit_id\":\"" + String(UNIT_CALLSIGN) + "\",";
    payload += "\"dist\":" + String(currentDist > 0 ? currentDist : 999.0, 1) + ",";
    payload += "\"temp\":" + String(isnan(temp) ? 0.0 : temp, 1) + ",";
    payload += "\"hum\":" + String(isnan(hum) ? 0.0 : hum, 1) + ",";
    payload += "\"gas\":" + String(gas) + ",";
    payload += "\"lat\":" + String(gps.location.isValid() ? String(gps.location.lat(), 6) : "0.0") + ",";
    payload += "\"lon\":" + String(gps.location.isValid() ? String(gps.location.lng(), 6) : "0.0") + ",";
    payload += "\"alert\":" + String(isIntrusion ? "true" : "false");
    payload += "}";

    // Stream directly to Vercel
    postTelemetryToCloud(payload);
  }

  delay(100);
}