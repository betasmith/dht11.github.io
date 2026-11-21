/**
 * AeroLab RMS-32 | Main Application Controller
 * Handles UI interactions, Persistent Real ESP32 WebSerial & WebSocket connectivity,
 * Auto-reconnect on refresh, Reset confirmation with pre-download options,
 * Gauges, Dual-Axis Charts, CSV Export & Smooth System Workflow.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Instantiate Simulator & Chart
  const simulator = new EnvironmentalSimulator();
  const chart = new TelemetryChart("telemetryChart", "chartTooltip");

  // Read saved state from localStorage
  let savedMode = localStorage.getItem("rms32_active_mode") || "simulated";
  let activeDataSource = savedMode; // "simulated" | "webserial" | "websocket"
  let isHardwareConnected = false;
  let isUnitCelsius = true;
  let currentPage = 1;
  const rowsPerPage = 10;
  let searchQuery = "";
  let lastUpdateEpoch = Date.now();

  // Serial & WebSocket Instances
  let serialPort = null;
  let serialReader = null;
  let serialKeepReading = false;
  let webSocketConn = null;

  // DOM Elements - Navigation & Badges
  const deviceStatusBadge = document.getElementById("deviceStatusBadge");
  const statusText = document.getElementById("statusText");
  const btnOpenConnectModal = document.getElementById("btnOpenConnectModal");
  const btnSimulateToggle = document.getElementById("btnSimulateToggle");
  const simulateBtnText = document.getElementById("simulateBtnText");
  const btnResetData = document.getElementById("btnResetData");
  const btnThemeToggle = document.getElementById("btnThemeToggle");
  const themeToggleText = document.getElementById("themeToggleText");

  // Telemetry Strip DOM
  const lastUpdateRelative = document.getElementById("lastUpdateRelative");
  const lastUpdateExact = document.getElementById("lastUpdateExact");
  const updatePulse = document.getElementById("updatePulse");
  const telemetrySource = document.getElementById("telemetrySource");
  const nodeIdDisplay = document.getElementById("nodeIdDisplay");
  const cadenceProgressBar = document.getElementById("cadenceProgressBar");
  const cadenceCountdown = document.getElementById("cadenceCountdown");

  // Temperature & Humidity Metric DOM
  const tempValue = document.getElementById("tempValue");
  const tempUnit = document.getElementById("tempUnit");
  const tempBadge = document.getElementById("tempBadge");
  const tempGaugeCircle = document.getElementById("tempGaugeCircle");
  const tempGaugePct = document.getElementById("tempGaugePct");
  const tempMin = document.getElementById("tempMin");
  const tempMax = document.getElementById("tempMax");
  const tempAvg = document.getElementById("tempAvg");
  const tempUnitToggle = document.getElementById("tempUnitToggle");

  const humidValue = document.getElementById("humidValue");
  const humidBadge = document.getElementById("humidBadge");
  const humidGaugeCircle = document.getElementById("humidGaugeCircle");
  const humidGaugePct = document.getElementById("humidGaugePct");
  const humidDewPoint = document.getElementById("humidDewPoint");
  const humidVpd = document.getElementById("humidVpd");
  const humidComfort = document.getElementById("humidComfort");

  // History Table & CSV DOM
  const historyTableBody = document.getElementById("historyTableBody");
  const searchInput = document.getElementById("historySearchInput");
  const btnExportCsv = document.getElementById("btnExportCsv");
  const btnResetHistoryTable = document.getElementById("btnResetHistoryTable");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const paginationInfo = document.getElementById("paginationInfo");

  // System Diagram Components
  const diagramNodes = document.querySelectorAll(".diagram-node");
  const detailTitle = document.getElementById("detailTitle");
  const detailDesc = document.getElementById("detailDesc");
  const detailCode = document.getElementById("detailCode");
  const espLedTx = document.getElementById("espLedTx");
  const espLedRx = document.getElementById("espLedRx");
  const pipelineStatusBadge = document.getElementById("pipelineStatusBadge");

  // Hardware Connect Modal DOM
  const connectModalOverlay = document.getElementById("connectModalOverlay");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const btnModalCloseSecondary = document.getElementById("btnModalCloseSecondary");
  const tabBtnSerial = document.getElementById("tabBtnSerial");
  const tabBtnWifi = document.getElementById("tabBtnWifi");
  const tabBtnCode = document.getElementById("tabBtnCode");
  const tabContentSerial = document.getElementById("tabContentSerial");
  const tabContentWifi = document.getElementById("tabContentWifi");
  const tabContentCode = document.getElementById("tabContentCode");
  const btnStartWebSerial = document.getElementById("btnStartWebSerial");
  const serialBaudSelect = document.getElementById("serialBaudSelect");
  const serialLogBox = document.getElementById("serialLogBox");
  const wsUrlInput = document.getElementById("wsUrlInput");
  const btnConnectWs = document.getElementById("btnConnectWs");
  const wsLogBox = document.getElementById("wsLogBox");
  const btnCopyCode = document.getElementById("btnCopyCode");
  const codeBlockSnippet = document.getElementById("codeBlockSnippet");

  // Reset Confirmation Modal DOM
  const resetModalOverlay = document.getElementById("resetModalOverlay");
  const btnCloseResetModal = document.getElementById("btnCloseResetModal");
  const btnCancelReset = document.getElementById("btnCancelReset");
  const btnResetDirectly = document.getElementById("btnResetDirectly");
  const btnDownloadAndReset = document.getElementById("btnDownloadAndReset");
  const resetRecordCount = document.getElementById("resetRecordCount");

  // Setup Initial Chart Data from persistent history
  chart.setData(simulator.history, "24h");
  updateTelemetryView(simulator.state, simulator.history);
  renderTable();

  // ==========================================================================
  // Auto-Reconnect & Persistent Mode Initialization
  // ==========================================================================
  initConnectionState();

  async function initConnectionState() {
    if (savedMode === "webserial") {
      // User was previously in USB WebSerial hardware mode! Do NOT start demo simulation!
      simulator.stop();
      btnSimulateToggle.classList.remove("active");
      simulateBtnText.textContent = "Switch to Demo";
      telemetrySource.textContent = "ESP32 (USB Reconnecting...)";
      nodeIdDisplay.textContent = "ESP32-USB-COM";

      deviceStatusBadge.className = "device-status-badge connecting";
      statusText.textContent = "ESP32: RECONNECTING USB...";

      // Check if browser has remembered a previously paired serial port
      if ("serial" in navigator) {
        try {
          const ports = await navigator.serial.getPorts();
          if (ports.length > 0) {
            appendLog(serialLogBox, "Found previously authorized ESP32 USB port. Auto-connecting...");
            serialPort = ports[0];
            const baudRate = parseInt(localStorage.getItem("rms32_baud") || "115200", 10);
            await serialPort.open({ baudRate });

            isHardwareConnected = true;
            activeDataSource = "webserial";
            setConnectionUI("real-hardware");
            telemetrySource.textContent = "Real Hardware (USB Serial)";
            pipelineStatusBadge.textContent = "HARDWARE LIVE";

            btnStartWebSerial.innerHTML = `Disconnect Serial Port`;
            btnStartWebSerial.className = "btn btn-disconnect";

            appendLog(serialLogBox, "SUCCESS: Auto-reconnected to ESP32! Reading live data stream...");
            showToast("Auto-reconnected to ESP32 over USB Serial!", "emerald");

            readSerialStream();
            return;
          } else {
            appendLog(serialLogBox, "No previously paired port found. Click 'Connect via USB Serial'.");
          }
        } catch (err) {
          appendLog(serialLogBox, `Auto-reconnect note: ${err.message}`);
          console.warn("WebSerial auto-reconnect:", err);
        }
      }
      deviceStatusBadge.className = "device-status-badge connecting";
      statusText.textContent = "ESP32: CLICK TO CONNECT USB";
    } else if (savedMode === "websocket") {
      // User was previously connected via Wi-Fi
      simulator.stop();
      btnSimulateToggle.classList.remove("active");
      simulateBtnText.textContent = "Switch to Demo";
      const savedWs = localStorage.getItem("rms32_ws_url");
      if (savedWs) {
        wsUrlInput.value = savedWs;
        connectToWebSocket(savedWs);
      }
    } else {
      // Default: Simulated mode
      simulator.start();
      setConnectionUI("simulated");
    }
  }

  // ==========================================================================
  // Reset Data & History Workflow (With Pre-Download Prompt)
  // ==========================================================================
  function openResetModal() {
    resetRecordCount.textContent = simulator.history.length;
    resetModalOverlay.classList.add("open");
  }

  function closeResetModal() {
    resetModalOverlay.classList.remove("open");
  }

  btnResetData.addEventListener("click", openResetModal);
  if (btnResetHistoryTable) {
    btnResetHistoryTable.addEventListener("click", openResetModal);
  }

  btnCloseResetModal.addEventListener("click", closeResetModal);
  btnCancelReset.addEventListener("click", closeResetModal);
  resetModalOverlay.addEventListener("click", (e) => {
    if (e.target === resetModalOverlay) closeResetModal();
  });

  // Action 1: Download CSV & Reset
  btnDownloadAndReset.addEventListener("click", () => {
    exportToCsv(); // Generate and trigger download
    executeDataReset();
    closeResetModal();
    showToast("Telemetry downloaded to CSV & history reset.", "emerald");
  });

  // Action 2: Reset Directly
  btnResetDirectly.addEventListener("click", () => {
    executeDataReset();
    closeResetModal();
    showToast("Telemetry history reset directly.", "rose");
  });

  function executeDataReset() {
    // Wipe history from memory and localStorage
    simulator.history = [];
    localStorage.removeItem("rms32_history");

    // Add baseline fresh point
    const resetEntry = {
      id: 1,
      timestamp: Date.now(),
      temp: simulator.state.temp,
      humid: simulator.state.humid,
      dewPoint: parseFloat(simulator.state.dewPoint.toFixed(2)),
      heatIndex: parseFloat(simulator.state.heatIndex.toFixed(2)),
      status: "Nominal"
    };
    simulator.history.push(resetEntry);
    simulator.saveHistory();

    // Reset chart
    chart.setData(simulator.history, chart.timeframe);

    // Reset table & stats
    currentPage = 1;
    searchQuery = "";
    if (searchInput) searchInput.value = "";

    updateTelemetryView(simulator.state, simulator.history);
    renderTable();
  }

  // ==========================================================================
  // Simulation Toggle Logic
  // ==========================================================================
  btnSimulateToggle.addEventListener("click", () => {
    if (activeDataSource !== "simulated") {
      // Switch back from real hardware to simulation
      disconnectHardware();
      activeDataSource = "simulated";
      localStorage.setItem("rms32_active_mode", "simulated");

      simulator.start();
      setConnectionUI("simulated");
      simulateBtnText.textContent = "Pause Simulation";
      btnSimulateToggle.classList.add("active");
      telemetrySource.textContent = "Simulated (Stochastic Model)";
      nodeIdDisplay.textContent = "ESP32-S3-08B7A (Demo)";
      showToast("Switched back to Demo Simulation mode.", "emerald");
      return;
    }

    if (simulator.isRunning) {
      simulator.stop();
      btnSimulateToggle.classList.remove("active");
      simulateBtnText.textContent = "Resume Simulation";
      setConnectionUI("disconnected");
      telemetrySource.textContent = "Paused";
      showToast("Simulation paused.", "muted");
    } else {
      simulator.start();
      btnSimulateToggle.classList.add("active");
      simulateBtnText.textContent = "Pause Simulation";
      setConnectionUI("simulated");
      telemetrySource.textContent = "Simulated (Stochastic Model)";
      showToast("Simulation running.", "emerald");
    }
  });

  // ==========================================================================
  // Real ESP32 WebSerial Connection (USB Cable)
  // ==========================================================================
  btnStartWebSerial.addEventListener("click", async () => {
    if (!("serial" in navigator)) {
      alert("WebSerial is not supported in this browser.\nPlease use Google Chrome, Microsoft Edge, or Opera.");
      appendLog(serialLogBox, "ERROR: WebSerial API not supported by this browser.");
      return;
    }

    if (isHardwareConnected && serialPort) {
      // User explicitly disconnected
      disconnectHardware();
      localStorage.setItem("rms32_active_mode", "simulated");
      btnStartWebSerial.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/></svg>
        Connect via USB Serial
      `;
      btnStartWebSerial.className = "btn btn-connect";
      showToast("ESP32 USB Serial disconnected.", "rose");
      return;
    }

    try {
      appendLog(serialLogBox, "Requesting USB serial port access...");
      serialPort = await navigator.serial.requestPort();
      const baudRate = parseInt(serialBaudSelect.value, 10) || 115200;
      localStorage.setItem("rms32_baud", baudRate.toString());

      appendLog(serialLogBox, `Opening port at ${baudRate} baud...`);
      await serialPort.open({ baudRate });

      isHardwareConnected = true;
      activeDataSource = "webserial";
      localStorage.setItem("rms32_active_mode", "webserial");
      simulator.stop(); // Stop artificial simulation!

      setConnectionUI("real-hardware");
      btnSimulateToggle.classList.remove("active");
      simulateBtnText.textContent = "Switch to Demo";
      telemetrySource.textContent = "Real Hardware (USB Serial)";
      nodeIdDisplay.textContent = "ESP32-USB-COM";
      pipelineStatusBadge.textContent = "HARDWARE LIVE";

      btnStartWebSerial.innerHTML = `Disconnect Serial Port`;
      btnStartWebSerial.className = "btn btn-disconnect";

      appendLog(serialLogBox, "SUCCESS: Connected to ESP32! Reading live data stream...");
      showToast("Connected to ESP32 via USB Serial!", "emerald");

      readSerialStream();
    } catch (err) {
      appendLog(serialLogBox, `Connection Failed: ${err.message}`);
      console.error(err);
    }
  });

  async function readSerialStream() {
    serialKeepReading = true;
    let buffer = "";

    try {
      const textDecoder = new TextDecoderStream();
      serialPort.readable.pipeTo(textDecoder.writable).catch(() => {});
      const reader = textDecoder.readable.getReader();
      serialReader = reader;

      while (serialKeepReading) {
        const { value, done } = await reader.read();
        if (done) {
          reader.releaseLock();
          break;
        }
        if (value) {
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop(); // keep last incomplete chunk

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              appendLog(serialLogBox, `RX > ${trimmed}`);
              parseAndApplyHardwareData(trimmed);
            }
          }
        }
      }
    } catch (err) {
      if (serialKeepReading) {
        appendLog(serialLogBox, `Serial Read Note: ${err.message}`);
      }
    }
  }

  // ==========================================================================
  // Real ESP32 WebSocket Connection (Wi-Fi Wireless)
  // ==========================================================================
  function connectToWebSocket(url) {
    appendLog(wsLogBox, `Connecting to WebSocket: ${url}...`);

    try {
      webSocketConn = new WebSocket(url);

      webSocketConn.onopen = () => {
        appendLog(wsLogBox, "WebSocket connected successfully!");
        isHardwareConnected = true;
        activeDataSource = "websocket";
        localStorage.setItem("rms32_active_mode", "websocket");
        localStorage.setItem("rms32_ws_url", url);

        simulator.stop();
        setConnectionUI("real-hardware");
        telemetrySource.textContent = "Real Hardware (Wi-Fi WebSocket)";
        nodeIdDisplay.textContent = "ESP32-WIFI-CLIENT";
        pipelineStatusBadge.textContent = "HARDWARE LIVE";
        btnConnectWs.textContent = "Disconnect";
        btnConnectWs.className = "btn btn-disconnect";
        showToast("Connected to ESP32 over Wi-Fi!", "emerald");
      };

      webSocketConn.onmessage = (event) => {
        const raw = event.data;
        appendLog(wsLogBox, `WS RX > ${raw}`);
        parseAndApplyHardwareData(raw);
      };

      webSocketConn.onerror = (err) => {
        appendLog(wsLogBox, `WebSocket Error: ${err.message || "Failed to reach host"}`);
      };

      webSocketConn.onclose = () => {
        appendLog(wsLogBox, "WebSocket connection closed.");
        if (activeDataSource === "websocket") {
          disconnectHardware();
        }
      };
    } catch (e) {
      appendLog(wsLogBox, `Error: ${e.message}`);
    }
  }

  btnConnectWs.addEventListener("click", () => {
    const url = wsUrlInput.value.trim();
    if (!url) return;

    if (webSocketConn) {
      webSocketConn.close();
      webSocketConn = null;
      btnConnectWs.textContent = "Connect Wi-Fi";
      btnConnectWs.className = "btn btn-connect";
      localStorage.setItem("rms32_active_mode", "simulated");
      return;
    }

    connectToWebSocket(url);
  });

  // Parses incoming hardware data string (JSON or CSV format)
  function parseAndApplyHardwareData(rawStr) {
    let t = null;
    let h = null;

    // Try parsing as JSON: {"temp": 24.5, "humid": 55.2}
    try {
      const data = JSON.parse(rawStr);
      t = data.temp !== undefined ? data.temp : data.temperature;
      h = data.humid !== undefined ? data.humid : data.humidity;
    } catch (e) {
      // Fallback: try parsing CSV "24.5, 55.2"
      const parts = rawStr.split(",");
      if (parts.length >= 2) {
        const p1 = parseFloat(parts[0]);
        const p2 = parseFloat(parts[1]);
        if (!isNaN(p1) && !isNaN(p2)) {
          t = p1;
          h = p2;
        }
      }
    }

    if (t !== null && h !== null && !isNaN(t) && !isNaN(h)) {
      t = parseFloat(t.toFixed(2));
      h = parseFloat(h.toFixed(2));

      // Calculate psychrometrics
      const dp = parseFloat(simulator.computeDewPoint(t, h).toFixed(2));
      const hi = parseFloat(simulator.computeHeatIndex(t, h).toFixed(2));
      const vpd = parseFloat(simulator.computeVPD(t, h).toFixed(2));

      // Update simulator state
      simulator.state.temp = t;
      simulator.state.humid = h;
      simulator.state.dewPoint = dp;
      simulator.state.heatIndex = hi;
      simulator.state.vpd = vpd;
      simulator.state.timestamp = Date.now();

      // Determine status
      let status = "Nominal";
      if (t > 28.0 || h > 70.0 || h < 30.0) status = "Caution";
      if (t > 33.0 || h > 85.0) status = "Alert";

      // Append to history
      const newEntry = {
        id: simulator.history.length + 1,
        timestamp: simulator.state.timestamp,
        temp: t,
        humid: h,
        dewPoint: dp,
        heatIndex: hi,
        status: status
      };

      simulator.history.push(newEntry);
      if (simulator.history.length > 500) simulator.history.shift();

      // Persist real history to localStorage
      simulator.saveHistory();

      lastUpdateEpoch = Date.now();
      flashUpdatePulse();
      blinkActivityLeds();
      updateTelemetryView(simulator.state, simulator.history);
      chart.setData(simulator.history);
      renderTable();
    }
  }

  function disconnectHardware() {
    serialKeepReading = false;
    if (serialReader) {
      serialReader.cancel().catch(() => {});
      serialReader = null;
    }
    if (serialPort) {
      serialPort.close().catch(() => {});
      serialPort = null;
    }
    if (webSocketConn) {
      webSocketConn.close();
      webSocketConn = null;
    }
    isHardwareConnected = false;
  }

  function setConnectionUI(type) {
    if (type === "real-hardware") {
      deviceStatusBadge.className = "device-status-badge hardware-live";
      statusText.textContent = "ESP32: REAL HARDWARE (LIVE)";
    } else if (type === "simulated") {
      deviceStatusBadge.className = "device-status-badge connected";
      statusText.textContent = "ESP32: SIMULATED";
    } else {
      deviceStatusBadge.className = "device-status-badge disconnected";
      statusText.textContent = "ESP32: DISCONNECTED";
    }
  }

  function appendLog(elem, text) {
    if (!elem) return;
    const timeStr = new Date().toLocaleTimeString();
    elem.textContent += `\n[${timeStr}] ${text}`;
    elem.scrollTop = elem.scrollHeight;
  }

  function blinkActivityLeds() {
    if (espLedTx) {
      espLedTx.setAttribute("fill", "#22c55e");
      setTimeout(() => espLedTx.setAttribute("fill", "#475569"), 150);
    }
    if (espLedRx) {
      espLedRx.setAttribute("fill", "#38bdf8");
      setTimeout(() => espLedRx.setAttribute("fill", "#475569"), 200);
    }
  }

  // ==========================================================================
  // Modal Interactions (Open/Close, Tabs, Copy Code)
  // ==========================================================================
  btnOpenConnectModal.addEventListener("click", () => {
    connectModalOverlay.classList.add("open");
  });

  const closeModal = () => connectModalOverlay.classList.remove("open");
  btnCloseModal.addEventListener("click", closeModal);
  btnModalCloseSecondary.addEventListener("click", closeModal);
  connectModalOverlay.addEventListener("click", (e) => {
    if (e.target === connectModalOverlay) closeModal();
  });

  function switchTab(activeBtn, activePane) {
    [tabBtnSerial, tabBtnWifi, tabBtnCode].forEach((b) => b.classList.remove("active"));
    [tabContentSerial, tabContentWifi, tabContentCode].forEach((p) => p.classList.remove("active"));
    activeBtn.classList.add("active");
    activePane.classList.add("active");
  }

  tabBtnSerial.addEventListener("click", () => switchTab(tabBtnSerial, tabContentSerial));
  tabBtnWifi.addEventListener("click", () => switchTab(tabBtnWifi, tabContentWifi));
  tabBtnCode.addEventListener("click", () => switchTab(tabBtnCode, tabContentCode));

  // Toggle between Pocket Wi-Fi code and USB Serial code
  const btnCodeSelectWifi = document.getElementById("btnCodeSelectWifi");
  const btnCodeSelectUsb = document.getElementById("btnCodeSelectUsb");

  const wifiCodeSnippet = `#include <WiFi.h>
#include <WebSocketsServer.h> // Install "WebSockets" by Markus Sattler in Arduino Library Manager
#include "DHT.h"

// 1. Enter your Pocket Wi-Fi credentials
const char* ssid = "YOUR_POCKET_WIFI_SSID";
const char* password = "YOUR_POCKET_WIFI_PASSWORD";

#define DHTPIN 4     // Digital pin connected to DHT22
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

WebSocketsServer webSocket = WebSocketsServer(81); // WebSocket server on port 81
unsigned long lastMsg = 0;

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    IPAddress ip = webSocket.remoteIP(num);
    Serial.printf("[%u] Dashboard connected from %s\\n", num, ip.toString().c_str());
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();

  // Connect to Pocket Wi-Fi
  Serial.print("Connecting to Pocket Wi-Fi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\\nWiFi connected successfully!");
  Serial.print(">>> YOUR ESP32 IP ADDRESS: ");
  Serial.println(WiFi.localIP()); // <-- Copy this IP address into the website!

  // Start WebSocket Server on port 81
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
      snprintf(jsonBuffer, sizeof(jsonBuffer), "{\\"temp\\":%.2f,\\"humid\\":%.2f}", temp, humid);

      // Broadcast wirelessly to web dashboard
      webSocket.broadcastTXT(jsonBuffer);
      Serial.println(jsonBuffer);
    }
  }
}`;

  const usbCodeSnippet = `#include "DHT.h"

#define DHTPIN 4     // Digital pin connected to DHT11
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();
  delay(1000);
}

void loop() {
  float temp = dht.readTemperature(); // Celsius
  float humid = dht.readHumidity();   // %

  if (!isnan(temp) && !isnan(humid)) {
    // Send formatted JSON to USB Serial
    Serial.print("{\\"temp\\":");
    Serial.print(temp, 2);
    Serial.print(",\\"humid\\":");
    Serial.print(humid, 2);
    Serial.println("}");
  }

  delay(10000); // Send data every 10 seconds (0.1 Hz)
}`;

  if (btnCodeSelectWifi && btnCodeSelectUsb) {
    btnCodeSelectWifi.addEventListener("click", () => {
      codeBlockSnippet.querySelector("code").textContent = wifiCodeSnippet;
      btnCodeSelectWifi.classList.add("active");
      btnCodeSelectUsb.classList.remove("active");
    });

    btnCodeSelectUsb.addEventListener("click", () => {
      codeBlockSnippet.querySelector("code").textContent = usbCodeSnippet;
      btnCodeSelectUsb.classList.add("active");
      btnCodeSelectWifi.classList.remove("active");
    });
  }

  btnCopyCode.addEventListener("click", () => {
    const code = codeBlockSnippet.innerText;
    navigator.clipboard.writeText(code).then(() => {
      btnCopyCode.textContent = "Copied!";
      setTimeout(() => (btnCopyCode.textContent = "Copy Code"), 2000);
      showToast("Arduino ESP32 code copied to clipboard!", "emerald");
    });
  });

  tempUnitToggle.addEventListener("click", () => {
    isUnitCelsius = !isUnitCelsius;
    tempUnitToggle.textContent = isUnitCelsius ? "°F" : "°C";
    updateTelemetryView(simulator.state, simulator.history);
  });

  // ==========================================================================
  // Telemetry Updates & Gauges
  // ==========================================================================
  simulator.subscribe((state, newEntry, history) => {
    if (activeDataSource !== "simulated") return;
    lastUpdateEpoch = Date.now();
    flashUpdatePulse();
    blinkActivityLeds();
    updateTelemetryView(state, history);
    chart.setData(history);
    renderTable();
  });

  function flashUpdatePulse() {
    updatePulse.classList.add("flash");
    setTimeout(() => updatePulse.classList.remove("flash"), 250);
  }

  // Dynamic number tweening helper (Smooth animated numerical transitions)
  function tweenNumber(element, targetVal, decimals = 1, duration = 400) {
    if (!element) return;
    const currentVal = parseFloat(element.textContent);
    if (isNaN(currentVal) || Math.abs(currentVal - targetVal) < 0.01) {
      element.textContent = targetVal.toFixed(decimals);
      return;
    }

    element.classList.remove("value-flash");
    void element.offsetWidth; // Force CSS reflow
    element.classList.add("value-flash");

    const startTime = performance.now();
    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const val = currentVal + (targetVal - currentVal) * ease;
      element.textContent = val.toFixed(decimals);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = targetVal.toFixed(decimals);
      }
    }
    requestAnimationFrame(step);
  }

  // 10-Second Telemetry Cadence & Countdown Watcher
  setInterval(() => {
    const elapsedSec = (Date.now() - lastUpdateEpoch) / 1000;
    if (!simulator.isRunning && !isHardwareConnected) {
      lastUpdateRelative.textContent = "Stream Paused";
      if (cadenceCountdown) cadenceCountdown.textContent = "Paused";
      if (cadenceProgressBar) cadenceProgressBar.style.width = "0%";
      return;
    }

    const roundedSec = Math.floor(elapsedSec);
    if (roundedSec < 2) {
      lastUpdateRelative.textContent = "Just now";
    } else {
      lastUpdateRelative.textContent = `${roundedSec}s ago`;
    }

    // 10-second cadence countdown and bar
    const cycleTotal = 10;
    const remaining = Math.max(0, cycleTotal - (elapsedSec % cycleTotal));
    if (cadenceCountdown) {
      cadenceCountdown.textContent = `${Math.ceil(remaining)}s`;
    }
    if (cadenceProgressBar) {
      const pct = Math.max(0, Math.min(100, (remaining / cycleTotal) * 100));
      cadenceProgressBar.style.width = `${pct}%`;
    }
  }, 250);

  // Theme Manager (Black, White, Lime Green Aesthetic)
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("rms32_theme", theme);
    if (themeToggleText) {
      themeToggleText.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
    }
    chart.render();
    if (simulator.state) {
      updateTelemetryView(simulator.state, simulator.history);
    }
  }

  const initialTheme = localStorage.getItem("rms32_theme") || "light";
  applyTheme(initialTheme);

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const nextTheme = current === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      showToast(
        nextTheme === "dark"
          ? "Dark Mode enabled (Black, White, Lime Green)"
          : "Clean White Light Mode enabled",
        "emerald"
      );
    });
  }

  function updateTelemetryView(state, history) {
    const dateObj = new Date(state.timestamp);
    lastUpdateExact.textContent =
      dateObj.toLocaleTimeString([], { hour12: false }) +
      "." +
      String(dateObj.getMilliseconds()).padStart(3, "0");

    const displayTemp = isUnitCelsius ? state.temp : (state.temp * 9) / 5 + 32;
    const unitSymbol = isUnitCelsius ? "°C" : "°F";
    tweenNumber(tempValue, displayTemp, 1);
    tempUnit.textContent = unitSymbol;

    const tempPct = Math.max(0, Math.min(100, ((state.temp - 10) / (40 - 10)) * 100));
    setRadialGauge(tempGaugeCircle, tempGaugePct, tempPct, getTempColor(state.temp));

    if (state.temp >= 19.5 && state.temp <= 25.5) {
      tempBadge.className = "card-badge badge-optimal";
      tempBadge.textContent = "NOMINAL";
    } else if (state.temp > 28.0 || state.temp < 16.0) {
      tempBadge.className = "card-badge badge-critical";
      tempBadge.textContent = "ALERT";
    } else {
      tempBadge.className = "card-badge badge-caution";
      tempBadge.textContent = "ELEVATED";
    }

    const temps = history.map((h) => (isUnitCelsius ? h.temp : (h.temp * 9) / 5 + 32));
    const minT = temps.length ? Math.min(...temps) : displayTemp;
    const maxT = temps.length ? Math.max(...temps) : displayTemp;
    const avgT = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : displayTemp;

    tempMin.textContent = `${minT.toFixed(1)}${unitSymbol}`;
    tempMax.textContent = `${maxT.toFixed(1)}${unitSymbol}`;
    tempAvg.textContent = `${avgT.toFixed(1)}${unitSymbol}`;

    tweenNumber(humidValue, state.humid, 1);
    const humidPct = Math.max(0, Math.min(100, state.humid));
    setRadialGauge(humidGaugeCircle, humidGaugePct, humidPct, getHumidColor(state.humid));

    if (state.humid >= 40 && state.humid <= 60) {
      humidBadge.className = "card-badge badge-optimal";
      humidBadge.textContent = "OPTIMAL";
      humidComfort.textContent = "Comfortable";
    } else if (state.humid > 70) {
      humidBadge.className = "card-badge badge-caution";
      humidBadge.textContent = "HIGH RH";
      humidComfort.textContent = "Muggy";
    } else {
      humidBadge.className = "card-badge badge-caution";
      humidBadge.textContent = "LOW RH";
      humidComfort.textContent = "Dry";
    }

    humidDewPoint.textContent = `${state.dewPoint.toFixed(1)} °C`;
    humidVpd.textContent = `${state.vpd ? state.vpd.toFixed(2) : "1.25"} kPa`;
  }

  function setRadialGauge(circleElem, textElem, percent, color) {
    if (!circleElem || !textElem) return;
    const circumference = 2 * Math.PI * 26; // r=26
    const offset = circumference - (percent / 100) * circumference;
    circleElem.style.strokeDasharray = `${circumference} ${circumference}`;
    circleElem.style.strokeDashoffset = offset;
    circleElem.style.stroke = color;
    textElem.textContent = `${Math.round(percent)}%`;
  }

  function isDarkTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function getTempColor(t) {
    const dark = isDarkTheme();
    if (t < 18) return dark ? "#38bdf8" : "#0284c7"; // Cold cyan
    if (t <= 26) return dark ? "#22c55e" : "#059669"; // Optimal lime green / emerald
    if (t <= 30) return dark ? "#eab308" : "#d97706"; // Amber
    return dark ? "#f43f5e" : "#e11d48"; // Rose critical
  }

  function getHumidColor(h) {
    const dark = isDarkTheme();
    if (h >= 40 && h <= 60) return dark ? "#22c55e" : "#059669";
    if (h > 60 && h <= 75) return dark ? "#38bdf8" : "#0284c7";
    return dark ? "#eab308" : "#d97706";
  }

  // ==========================================================================
  // Chart Controls (Timeframe & Legends)
  // ==========================================================================
  document.querySelectorAll(".tf-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tf-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tf = btn.getAttribute("data-timeframe");
      chart.setData(simulator.history, tf);
    });
  });

  const legendTemp = document.getElementById("legendTemp");
  const legendHumid = document.getElementById("legendHumid");

  legendTemp.addEventListener("click", () => {
    chart.showTemp = !chart.showTemp;
    legendTemp.style.opacity = chart.showTemp ? "1" : "0.4";
    chart.render();
  });

  legendHumid.addEventListener("click", () => {
    chart.showHumid = !chart.showHumid;
    legendHumid.style.opacity = chart.showHumid ? "1" : "0.4";
    chart.render();
  });

  // ==========================================================================
  // 24-Hour History Table & Pagination
  // ==========================================================================
  function getFilteredHistory() {
    let list = [...simulator.history].reverse(); // newest first
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      list = list.filter((item) => {
        const timeStr = new Date(item.timestamp).toLocaleString().toLowerCase();
        return (
          timeStr.includes(q) ||
          item.status.toLowerCase().includes(q) ||
          item.temp.toString().includes(q)
        );
      });
    }
    return list;
  }

  function renderTable() {
    const list = getFilteredHistory();
    const totalPages = Math.max(1, Math.ceil(list.length / rowsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * rowsPerPage;
    const pageItems = list.slice(startIdx, startIdx + rowsPerPage);

    historyTableBody.innerHTML = "";

    pageItems.forEach((row, i) => {
      const tr = document.createElement("tr");
      const dt = new Date(row.timestamp);
      const timeStr = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const dateStr = dt.toLocaleDateString([], { month: "short", day: "numeric" });

      const statusBadgeClass =
        row.status === "Nominal"
          ? "badge-optimal"
          : row.status === "Caution"
          ? "badge-caution"
          : "badge-critical";

      tr.innerHTML = `
        <td class="col-id">#${row.id || startIdx + i + 1}</td>
        <td class="col-time">${dateStr} ${timeStr}</td>
        <td class="col-temp">${row.temp.toFixed(1)} °C</td>
        <td class="col-humid">${row.humid.toFixed(1)} %</td>
        <td class="col-dew">${row.dewPoint ? row.dewPoint.toFixed(1) : "--"} °C</td>
        <td class="col-heat">${row.heatIndex ? row.heatIndex.toFixed(1) : "--"} °C</td>
        <td class="col-status"><span class="table-status-pill ${statusBadgeClass}">${row.status}</span></td>
      `;
      historyTableBody.appendChild(tr);
    });

    paginationInfo.textContent = `Showing ${pageItems.length ? startIdx + 1 : 0}-${startIdx + pageItems.length} of ${list.length} records (Page ${currentPage}/${totalPages})`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }

  prevPageBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  nextPageBtn.addEventListener("click", () => {
    currentPage++;
    renderTable();
  });

  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    currentPage = 1;
    renderTable();
  });

  // ==========================================================================
  // CSV Exporter (24-Hour Complete Dataset)
  // ==========================================================================
  btnExportCsv.addEventListener("click", () => {
    exportToCsv();
  });

  function exportToCsv() {
    const records = simulator.history;
    if (!records.length) {
      showToast("No historical records available to export", "rose");
      return;
    }

    const now = new Date();
    const exportTimeISO = now.toISOString();

    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += `# ================================================================\r\n`;
    csvContent += `# AeroLab RMS-32 | Scientific Telemetry Export\r\n`;
    csvContent += `# Export Generated: ${exportTimeISO}\r\n`;
    csvContent += `# Total Telemetry Frames: ${records.length}\r\n`;
    csvContent += `# ================================================================\r\n`;

    const headers = [
      "Record_ID",
      "Timestamp_ISO",
      "Timestamp_Local",
      "Temperature_Celsius",
      "Temperature_Fahrenheit",
      "Relative_Humidity_Pct",
      "Dew_Point_Celsius",
      "Heat_Index_Celsius",
      "Status"
    ];
    csvContent += headers.join(",") + "\r\n";

    records.forEach((r, idx) => {
      const dt = new Date(r.timestamp);
      const iso = dt.toISOString();
      const local = dt.toLocaleString().replace(/,/g, "");
      const tempF = ((r.temp * 9) / 5 + 32).toFixed(2);

      const row = [
        r.id || idx + 1,
        iso,
        `"${local}"`,
        r.temp.toFixed(2),
        tempF,
        r.humid.toFixed(2),
        r.dewPoint !== undefined ? r.dewPoint.toFixed(2) : "",
        r.heatIndex !== undefined ? r.heatIndex.toFixed(2) : "",
        r.status
      ];
      csvContent += row.join(",") + "\r\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = `AeroLab_RMS32_Telemetry_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${records.length} records to ${filename}`, "emerald");
  }

  // ==========================================================================
  // Interactive System Workflow Architecture Diagram (Zero Glitch!)
  // ==========================================================================
  const nodeData = {
    sensors: {
      title: "1. Environmental Sensor Array (DHT11 / BME280)",
      desc: "Measures ambient dry-bulb temperature via thermal band-gap and relative humidity via capacitive dielectric polymer. Connects directly to ESP32 digital GPIO 4 or I2C bus.",
      code: "Bus: GPIO 4 / I2C (0x76) | Sample Rate: 0.5 Hz | Uncertainty: ±0.2°C, ±1.5% RH"
    },
    esp32: {
      title: "2. ESP32-S3 Dual-Core Microcontroller (MCU)",
      desc: "Executes onboard firmware, samples the sensor pins, packages readings into JSON packets, and transmits via hardware UART (115200 bps USB) or 2.4 GHz Wi-Fi stack.",
      code: "SoC: Xtensa 32-bit LX7 | Clock: 240 MHz | Baud: 115200 bps | Stream: JSON / Serial"
    },
    comms: {
      title: "3. Communication Hub (WebSerial & WebSocket)",
      desc: "Bridges physical hardware directly into the client web browser with zero server latency using the HTML5 WebSerial API (USB) or WebSocket protocol over Wi-Fi.",
      code: "Protocol: WebSerial (115200 bps) / WebSocket (TCP 81) | Payload: UTF-8 JSON"
    },
    dashboard: {
      title: "4. AeroLab RMS Web Telemetry Engine",
      desc: "Client-side telemetry interface rendering real-time dual-axis spline charts, psychrometric calculations (Magnus dew point), circular percentage gauges, and 24h CSV exports.",
      code: "Engine: Retina Canvas 2D + WebAudio + Local Storage | Theme: Precision Scientific White"
    }
  };

  diagramNodes.forEach((node) => {
    node.addEventListener("click", () => {
      const key = node.getAttribute("data-node");
      if (nodeData[key]) {
        detailTitle.textContent = nodeData[key].title;
        detailDesc.textContent = nodeData[key].desc;
        detailCode.textContent = nodeData[key].code;

        diagramNodes.forEach((n) => {
          const rect = n.querySelector(".node-box");
          if (rect) rect.style.stroke = "";
        });
        const activeRect = node.querySelector(".node-box");
        if (activeRect) {
          activeRect.style.stroke = isDarkTheme() ? "#22c55e" : "#0284c7";
          activeRect.style.strokeWidth = "2.8";
        }
      }
    });
  });

  // ==========================================================================
  // Toast Notifications
  // ==========================================================================
  function showToast(message, type = "cyan") {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "toast";

    let iconColor = "#38bdf8";
    if (type === "emerald") iconColor = "#34d399";
    if (type === "rose") iconColor = "#fb7185";
    if (type === "amber") iconColor = "#fbbf24";

    toast.innerHTML = `
      <svg style="width:16px; height:16px; color:${iconColor}; flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
      </svg>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
});
