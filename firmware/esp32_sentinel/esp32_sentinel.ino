#include <DHT.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>

// ================= USER CONFIGURATION =================
// Your permanent 24/7 Vercel cloud endpoint
const char* SERVER_URL = "https://esp32-sentinel-monitor-187t-ankur1212s.vercel.app/api/readings";

#define UNIT_CALLSIGN         "UNIT-01"
#define MOTION_SENSITIVITY_CM 15.0   // Trigger intrusion alert if object gets 15cm closer than baseline
#define UPLOAD_INTERVAL_MS    10000  // Upload telemetry to cloud every 10 seconds
// ======================================================

// --- PIN DEFINITIONS ---
#define DHTPIN        4
#define DHTTYPE       DHT11
#define MQ135_PIN     34
#define TRIG_PIN      32
#define ECHO_PIN      33
#define GPS_RX_PIN    25   // ESP32 RX <- GPS TX
#define GPS_TX_PIN    26   // ESP32 TX -> GPS RX

// --- HARDWARE OBJECTS ---
DHT dht(DHTPIN, DHTTYPE);
TinyGPSPlus gps;
HardwareSerial gpsSerial(1); // Hardware UART1 for GPS

unsigned long lastUploadTime = 0;
float baselineDistance = 100.0;
bool motionAlertActive = false;

// Helper to measure distance via HC-SR04
float getDistanceCM() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 25000); // 25ms timeout (~4m max)
  if (duration <= 0) return -1.0;
  return (duration * 0.0343) / 2.0;
}

// Upload JSON payload over Airtel 4G LTE to Vercel
void postTelemetryToCloud(String json) {
  // Ensure network data stack is ready
  Serial.println("AT+NETOPEN");
  delay(1000);

  // Initialize HTTP service
  Serial.println("AT+HTTPINIT");
  delay(500);

  // Set cloud URL
  Serial.print("AT+HTTPPARA=\"URL\",\"");
  Serial.print(SERVER_URL);
  Serial.println("\"");
  delay(500);

  // Enable SSL profile for HTTPS (Vercel requires HTTPS)
  Serial.println("AT+HTTPPARA=\"SSLCFG\",0");
  delay(300);

  // Set JSON content type
  Serial.println("AT+HTTPPARA=\"CONTENT\",\"application/json\"");
  delay(500);

  // Buffer size & timeout
  Serial.print("AT+HTTPDATA=");
  Serial.print(json.length());
  Serial.println(",8000");
  delay(1000);

  // Send the JSON payload
  Serial.print(json);
  delay(1000);

  // Execute HTTP POST (Method 1 = POST)
  Serial.println("AT+HTTPACTION=1");
  delay(4000);

  // Terminate HTTP session
  Serial.println("AT+HTTPTERM");
  delay(500);
}

void setup() {
  // Serial (UART0) is wired to A7670C (RX0 & TX0) at 115200 baud
  Serial.begin(115200);

  // GPS on Hardware UART1 (GPIO 25 RX, GPIO 26 TX) at 9600 baud
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // Initialize Sensors
  dht.begin();
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(MQ135_PIN, INPUT);

  // Allow voltage rails and modem 3 seconds to stabilize
  delay(3000);

  // Connect to Airtel 4G Network
  Serial.println("AT");
  delay(1000);
  Serial.println("AT+CGDCONT=1,\"IP\",\"airtelgprs.com\"");
  delay(1500);
  Serial.println("AT+NETOPEN");
  delay(2000);

  // Calibrate baseline room/desk distance at power-on
  float sum = 0;
  int count = 0;
  for (int i = 0; i < 5; i++) {
    float d = getDistanceCM();
    if (d > 2.0 && d < 300.0) {
      sum += d;
      count++;
    }
    delay(200);
  }
  if (count > 0) {
    baselineDistance = sum / count;
  }
}

void loop() {
  // 1. Constantly feed GPS parser
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // 2. Ultrasonic Motion Check
  float currentDist = getDistanceCM();
  if (currentDist > 2.0 && (baselineDistance - currentDist) >= MOTION_SENSITIVITY_CM) {
    motionAlertActive = true;
  }

  // 3. Telemetry Upload to Cloud Website every 10 seconds
  if (millis() - lastUploadTime >= UPLOAD_INTERVAL_MS) {
    lastUploadTime = millis();

    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    int gas = analogRead(MQ135_PIN);

    // Build clean JSON payload
    String payload = "{";
    payload += "\"unit_id\":\"" + String(UNIT_CALLSIGN) + "\",";
    payload += "\"dist\":" + String(currentDist > 0 ? currentDist : baselineDistance, 1) + ",";
    payload += "\"temp\":" + String(isnan(temp) ? 0.0 : temp, 1) + ",";
    payload += "\"hum\":" + String(isnan(hum) ? 0.0 : hum, 1) + ",";
    payload += "\"gas\":" + String(gas) + ",";
    payload += "\"lat\":" + String(gps.location.isValid() ? String(gps.location.lat(), 6) : "0.0") + ",";
    payload += "\"lon\":" + String(gps.location.isValid() ? String(gps.location.lng(), 6) : "0.0") + ",";
    payload += "\"alert\":" + String(motionAlertActive ? "true" : "false");
    payload += "}";

    // Stream directly to Vercel
    postTelemetryToCloud(payload);

    // Reset alert flag after transmitting
    motionAlertActive = false;
  }

  delay(100);
}