#include <DHT.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>

// ================= USER CONFIGURATION =================
#define TARGET_PHONE_NUMBER "+91XXXXXXXXXX" // Enter recipient mobile number with country code
const char* SERVER_URL = "https://your-tunnel-or-server.domain/api/readings";

#define MOTION_SENSITIVITY_CM 15.0   // Trigger if someone gets 15cm closer than baseline
#define UPLOAD_INTERVAL_MS    10000  // Upload to server every 10 seconds
#define SMS_COOLDOWN_MS       45000  // Minimum cooldown between SMS alerts
// ======================================================

// --- PIN DEFINITIONS ---
#define DHTPIN        4
#define DHTTYPE       DHT11
#define MQ135_PIN     34
#define TRIG_PIN      32
#define ECHO_PIN      33
#define GPS_RX_PIN    25
#define GPS_TX_PIN    26

DHT dht(DHTPIN, DHTTYPE);
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);

unsigned long lastUploadTime = 0;
unsigned long lastSmsTime = 0;
float baselineDistance = 100.0;

float getDistanceCM() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 25000);
  if (duration <= 0) return -1.0;
  return (duration * 0.0343) / 2.0;
}

String getGoogleMapsLink() {
  if (gps.location.isValid()) {
    return "https://maps.google.com/?q=" + String(gps.location.lat(), 6) + "," + String(gps.location.lng(), 6);
  }
  return "GPS indoor (searching)";
}

void sendIntrusionSMS(float currentDist) {
  Serial.println("AT+CMGF=1");
  delay(500);

  Serial.print("AT+CMGS=\"");
  Serial.print(TARGET_PHONE_NUMBER);
  Serial.println("\"");
  delay(800);

  Serial.println("🚨 ALERT: Intrusion Motion Detected!");
  Serial.print("Current Distance: ");
  Serial.print(currentDist, 1);
  Serial.println(" cm");
  Serial.print("Baseline was: ");
  Serial.print(baselineDistance, 1);
  Serial.println(" cm");
  Serial.print("Location: ");
  Serial.println(getGoogleMapsLink());
  
  Serial.write(26); // ASCII 26 (Ctrl+Z)
  delay(3000);
}

void postTelemetryOver4G(String json) {
  Serial.println("AT+NETOPEN");
  delay(1000);

  Serial.println("AT+HTTPINIT");
  delay(500);

  Serial.print("AT+HTTPPARA=\"URL\",\"");
  Serial.print(SERVER_URL);
  Serial.println("\"");
  delay(500);

  Serial.println("AT+HTTPPARA=\"CONTENT\",\"application/json\"");
  delay(500);

  Serial.print("AT+HTTPDATA=");
  Serial.print(json.length());
  Serial.println(",8000");
  delay(1000);

  Serial.print(json);
  delay(1000);

  Serial.println("AT+HTTPACTION=1");
  delay(4000);

  Serial.println("AT+HTTPTERM");
  delay(500);
}

void setup() {
  Serial.begin(115200); // Modem on RX0/TX0
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  dht.begin();
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(MQ135_PIN, INPUT);

  delay(3000);

  // Initialize Cellular APN & Internet
  Serial.println("AT");
  delay(1000);
  Serial.println("AT+CGDCONT=1,\"IP\",\"airtelgprs.com\"");
  delay(1500);
  Serial.println("AT+NETOPEN");
  delay(2000);

  // Calibrate baseline distance (average over 5 samples)
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
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  float currentDist = getDistanceCM();

  bool motionDetected = false;
  if (currentDist > 2.0 && (baselineDistance - currentDist) >= MOTION_SENSITIVITY_CM) {
    motionDetected = true;
  }

  if (motionDetected && (millis() - lastSmsTime > SMS_COOLDOWN_MS)) {
    sendIntrusionSMS(currentDist);
    lastSmsTime = millis();
  }

  if (millis() - lastUploadTime >= UPLOAD_INTERVAL_MS) {
    lastUploadTime = millis();

    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    int gas = analogRead(MQ135_PIN);

    String payload = "{";
    payload += "\"dist\":" + String(currentDist > 0 ? currentDist : baselineDistance, 1) + ",";
    payload += "\"temp\":" + String(isnan(temp) ? 0.0 : temp, 1) + ",";
    payload += "\"hum\":" + String(isnan(hum) ? 0.0 : hum, 1) + ",";
    payload += "\"gas\":" + String(gas) + ",";
    payload += "\"lat\":" + String(gps.location.isValid() ? String(gps.location.lat(), 6) : "0.0") + ",";
    payload += "\"lon\":" + String(gps.location.isValid() ? String(gps.location.lng(), 6) : "0.0") + ",";
    payload += "\"alert\":" + String(motionDetected ? "1" : "0");
    payload += "}";

    postTelemetryOver4G(payload);
  }

  delay(200);
}
