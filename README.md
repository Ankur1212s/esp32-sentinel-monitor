# Sentinel-4G: ESP32 Remote Cellular Security & Environmental Monitor

A battery-powered, long-range remote monitoring and intrusion detection system built on **ESP32**, **A7670C LTE Cat-1 cellular**, **NEO-6M GPS**, and environmental sensors.

---

## ⚡ Features
- **Instant SMS Intrusion Alerts**: Uses HC-SR04 ultrasonic distance sensing with baseline motion detection to send real-time SMS alerts containing clickable Google Maps links.
- **Cellular Telemetry Upload**: Streams live temperature, humidity, gas quality, and GPS coordinates over 4G LTE to a central web dashboard.
- **Interactive Web Dashboard**: Built with FastAPI, Leaflet.js, Chart.js, and Tailwind CSS. Shows live GPS location tracking, historical sensor trends, and security breach status.
- **Battery Powered**: Powered by a 3.7V 7600mAh Li-ion battery pack with a 5A BMS and an IP2312 fast-charge module.

---

## 🛠️ Hardware Components
| Component | Purpose | Interface / Operating Voltage |
| :--- | :--- | :--- |
| **ESP32 DevKit** | Main Microcontroller | 5V VIN / 3.3V Logic |
| **A7670C** | 4G LTE Cat-1 Modem (SMS & HTTP) | UART (115200 baud) / Direct VBAT (3.7V) |
| **NEO-6M** | GPS Location & Tracking | Hardware UART1 (9600 baud) / 3.3V |
| **HC-SR04** | Ultrasonic Intrusion Detection | GPIO (with 5V→3.3V voltage divider on ECHO) |
| **DHT11** | Temperature & Humidity | Single-bus GPIO / 3.3V |
| **MQ-135** | Air Quality / Gas Sensing | ADC Analog Input / 5V (heater) |
| **MT3608** | Step-Up Boost Converter | 3.7V In → 5.0V Out |
| **IP2312** | Fast Charger Board | 3A 1S Li-ion USB-C Charging |
| **Battery Pack** | 3.7V 7600mAh Li-ion (Parallel) | Protected with 1S 5A BMS |

---

## 🔌 Pin Mapping (ESP32)

| Module Pin | ESP32 Pin / Rail | Notes |
| :--- | :--- | :--- |
| **A7670C TX** | **RX0 (GPIO 3)** | Modem Serial (115200 baud) |
| **A7670C RX** | **TX0 (GPIO 1)** | Modem Serial (115200 baud) |
| **A7670C VBAT** | **Battery (+)** | 1000µF 25V capacitor in parallel |
| **NEO-6M TX** | **GPIO 25** | Hardware UART1 RX |
| **NEO-6M RX** | **GPIO 26** | Hardware UART1 TX |
| **HC-SR04 TRIG** | **GPIO 32** | Digital Output |
| **HC-SR04 ECHO** | **GPIO 33** | Via 1kΩ / 2kΩ resistor voltage divider |
| **DHT11 DATA** | **GPIO 4** | Internal pull-up enabled |
| **MQ135 A0** | **GPIO 34** | ADC1 Analog Input |
| **Common GND** | **Battery (-)** | Star-topology tied at battery negative |

---

## 🚀 Getting Started

### 1. Firmware Setup (ESP32)
1. Open `firmware/esp32_sentinel/esp32_sentinel.ino` in Arduino IDE.
2. Install required libraries via Library Manager:
   - `DHT sensor library` (Adafruit)
   - `Adafruit Unified Sensor`
   - `TinyGPSPlus` (Mikal Hart)
3. Update configuration values:
   ```cpp
   #define TARGET_PHONE_NUMBER "+91XXXXXXXXXX" // Your phone number
   const char* SERVER_URL = "https://your-domain.com/api/readings";
   ```
4. Select board **ESP32 Dev Module** and upload.

### 2. Backend & Dashboard Setup
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
2. Start the local server:
   ```bash
   python server.py
   ```
3. Open `http://localhost:8000` in your browser.
4. Expose the port to 4G using a tunnel (e.g. `ssh -R 80:localhost:8000 a.pinggy.io` or `localhost.run`).

---

## 📄 License
MIT License
