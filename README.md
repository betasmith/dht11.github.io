# AeroLab RMS-32 | Scientific Room Monitoring System (IoT)

A laboratory-grade, precision IoT Web Dashboard designed for real-time room environmental monitoring (Temperature, Relative Humidity, Dew Point, and Vapor Pressure Deficit). Features **Dual Theme System** (clean Scientific White Mode and high-contrast Black, White, Lime Green Dark Mode), dynamic neural particle animations with traveling signal packets, vibrant dual-axis Bézier spline graphics with animated live beacon pulses, smooth numerical tweening, an interactive 10-second telemetry cadence progress bar, 24-hour historical logging, RFC-4180 CSV export, creative animated hardware workflow, native WebSerial direct USB connection, and wireless Pocket Wi-Fi WebSocket streaming.

---

## ⏱️ Telemetry Cadence: 10 Seconds (0.1 Hz)

* **Sampling Interval**: Updates every **10.0 seconds** ($0.1\text{ Hz}$).
* **Dynamic Cadence Progress Tracker**: Real-time visual countdown bar tracking incoming telemetry frames.
* **Smooth Value Tweening**: Numerical readings glide smoothly with ease-out cubic transitions between updates.

---

## 🔬 Connection Options: USB vs. Pocket Wi-Fi

You can connect your physical ESP32 to this web dashboard in two ways:

1. **Option A: Direct USB Cable (WebSerial)**:
   - Connect ESP32 via USB.
   - Click **"Connect Real ESP32"** ➔ **"Connect via USB Serial"** ➔ pick your COM port.
   - Zero networking or router setup needed.

2. **Option B: Wireless Pocket Wi-Fi (WebSocket)**:
   - Connect both your computer/phone and ESP32 to the same **Pocket Wi-Fi** or Mobile Hotspot.
   - Flash the **Pocket Wi-Fi Sketch** below.
   - In the dashboard, enter `ws://<ESP32-IP>:81` and click **"Connect Wi-Fi"**!
   - Telemetry flows completely over the air in real-time.

---

## ⚡ 1. Pocket Wi-Fi / Hotspot Arduino Sketch

### Prerequisites:
In the Arduino IDE:
1. Go to **Sketch** ➔ **Include Library** ➔ **Manage Libraries...**
2. Search for and install:
   - **`DHT sensor library`** by Adafruit
   - **`WebSockets`** by Markus Sattler

### Arduino C++ Code:
```cpp
#include <WiFi.h>
#include <WebSocketsServer.h> // Library: "WebSockets" by Markus Sattler
#include "DHT.h"

// ==========================================
// 1. Enter your Pocket Wi-Fi credentials:
// ==========================================
const char* ssid = "YOUR_POCKET_WIFI_SSID";
const char* password = "YOUR_POCKET_WIFI_PASSWORD";

#define DHTPIN 4     // Pin connected to DHT22 data pin
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// Start WebSocket Server on port 81
WebSocketsServer webSocket = WebSocketsServer(81);
unsigned long lastMsg = 0;

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    IPAddress ip = webSocket.remoteIP(num);
    Serial.printf("[%u] Dashboard connected from %s\n", num, ip.toString().c_str());
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();

  // Connect to your Pocket Wi-Fi
  Serial.print("Connecting to Pocket Wi-Fi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected successfully!");
  Serial.print(">>> YOUR ESP32 IP ADDRESS: ");
  Serial.println(WiFi.localIP()); // <-- COPY THIS IP ADDRESS!

  // Start WebSocket Server
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();

  // Send real sensor telemetry every 10 seconds (0.1 Hz)
  if (millis() - lastMsg > 10000) {
    lastMsg = millis();

    float temp = dht.readTemperature();
    float humid = dht.readHumidity();

    if (!isnan(temp) && !isnan(humid)) {
      char jsonBuffer[100];
      snprintf(jsonBuffer, sizeof(jsonBuffer), "{\"temp\":%.2f,\"humid\":%.2f}", temp, humid);

      // Broadcast wirelessly to web dashboard
      webSocket.broadcastTXT(jsonBuffer);
      Serial.println(jsonBuffer);
    }
  }
}
```

---

## ⚡ 2. USB Cable (WebSerial) Arduino Sketch

```cpp
#include "DHT.h"

#define DHTPIN 4     // Digital pin connected to DHT22
#define DHTTYPE DHT22

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200); // 115200 baud
  dht.begin();
  delay(1000);
}

void loop() {
  float temp = dht.readTemperature(); // Celsius
  float humid = dht.readHumidity();   // %

  if (!isnan(temp) && !isnan(humid)) {
    // Send standard JSON line over USB Serial
    Serial.print("{\"temp\":");
    Serial.print(temp, 2);
    Serial.print(",\"humid\":");
    Serial.print(humid, 2);
    Serial.println("}");
  }

  delay(10000); // Send data every 10 seconds (0.1 Hz)
}
```

---

## 🚀 Step-by-Step: Connecting via Pocket Wi-Fi

1. **Turn on your Pocket Wi-Fi router** (or mobile hotspot).
2. **Connect your Computer** to the Pocket Wi-Fi network.
3. Flash the **Pocket Wi-Fi Arduino Sketch** to your ESP32 with your Wi-Fi name and password filled in.
4. Open the Arduino IDE **Serial Monitor** (set to `115200 baud`).
   When it connects, it will print:
   ```
   WiFi Connected successfully!
   >>> YOUR ESP32 IP ADDRESS: 192.168.8.105
   ```
5. Open [index.html](file:///c:/Users/vathana/Documents/IoT%20Web/index.html) in your browser.
6. Click **"Connect Real ESP32"** ➔ switch to the **"Wi-Fi (WebSocket)"** tab.
7. Enter your IP address with port 81:
   ```
   ws://192.168.8.105:81
   ```
8. Click **"Connect Wi-Fi"**! Real physical telemetry will begin streaming live wirelessly into your dashboard and charts!
