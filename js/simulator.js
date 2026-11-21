/**
 * AeroLab RMS-32 | Scientific Environmental Simulator & Physics Engine
 * Generates realistic micro-climate stochastic fluctuations, psychrometric calculations,
 * and maintains continuous historical records with localStorage persistence.
 */

class EnvironmentalSimulator {
  constructor() {
    this.savedMode = localStorage.getItem("rms32_active_mode") || "simulated";
    // Only auto-start simulation if saved mode is actually simulated
    this.isRunning = this.savedMode === "simulated";
    this.updateInterval = 10000; // 10 seconds (0.1 Hz)
    this.timerId = null;

    // Simulation presets
    this.presets = {
      lab: { name: "Laboratory Cleanroom", baseTemp: 22.4, tempVar: 0.8, baseHum: 48.0, humVar: 3.5, tolerance: "strict" },
      server: { name: "Server Room Rack A", baseTemp: 27.8, tempVar: 1.5, baseHum: 35.0, humVar: 4.0, tolerance: "moderate" },
      cleanroom: { name: "ISO Class 5 Cleanroom", baseTemp: 20.2, tempVar: 0.3, baseHum: 44.5, humVar: 1.5, tolerance: "ultra-strict" },
      tropical: { name: "Tropical Vivarium", baseTemp: 29.5, tempVar: 1.8, baseHum: 78.0, humVar: 5.0, tolerance: "humid" }
    };

    this.currentPresetKey = "lab";
    this.currentPreset = this.presets.lab;

    // Current live state
    this.state = {
      temp: this.currentPreset.baseTemp,
      humid: this.currentPreset.baseHum,
      tempSpike: 0,
      humidSpike: 0,
      dewPoint: 0,
      heatIndex: 0,
      vpd: 0, // Vapor pressure deficit (kPa)
      uncertainty: 0.15,
      timestamp: Date.now()
    };

    // 24-hour historical records (stores last 24h data)
    this.history = [];
    this.listeners = [];

    this.loadHistory();
    this.recalculateDerived();
  }

  // Load history from localStorage if available, or generate initial baseline
  loadHistory() {
    try {
      const stored = localStorage.getItem("rms32_history");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.history = parsed;
          const latest = this.history[this.history.length - 1];
          this.state.temp = latest.temp;
          this.state.humid = latest.humid;
          this.state.timestamp = latest.timestamp;
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to read localStorage history:", e);
    }

    // Fallback: If no history saved and in simulated mode, pre-generate 24h data
    if (this.savedMode === "simulated") {
      this.init24HourHistory();
    } else {
      // Hardware mode without prior data: baseline 1 point
      this.history = [{
        id: 1,
        timestamp: Date.now(),
        temp: 22.4,
        humid: 48.0,
        dewPoint: 11.2,
        heatIndex: 22.4,
        status: "Nominal"
      }];
    }
  }

  saveHistory() {
    try {
      // Save at most latest 500 records to avoid quota limits
      const sliceToSave = this.history.slice(-500);
      localStorage.setItem("rms32_history", JSON.stringify(sliceToSave));
    } catch (e) {
      console.warn("Failed to write to localStorage:", e);
    }
  }

  // Pre-generate 144 data points (one every 10 min for past 24 hours)
  init24HourHistory() {
    const points = 144;
    const intervalMs = 10 * 60 * 1000;
    const now = Date.now();
    const startTime = now - points * intervalMs;

    this.history = [];
    let curT = this.currentPreset.baseTemp;
    let curH = this.currentPreset.baseHum;

    for (let i = 0; i < points; i++) {
      const t = startTime + i * intervalMs;
      const hourOfDay = new Date(t).getHours() + new Date(t).getMinutes() / 60;
      const diurnalTempOffset = Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI) * 1.4;
      const hvacCycle = Math.sin((i / 8) * Math.PI) * 0.6;
      const randomNoise = (Math.random() - 0.5) * 0.35;

      curT = this.currentPreset.baseTemp + diurnalTempOffset + hvacCycle + randomNoise;
      curH = this.currentPreset.baseHum - diurnalTempOffset * 1.8 + (Math.random() - 0.5) * 1.2;
      curH = Math.max(15, Math.min(95, curH));

      const dp = this.computeDewPoint(curT, curH);
      const hi = this.computeHeatIndex(curT, curH);

      let status = "Nominal";
      if (curT > 28.5 || curH > 75 || curH < 25) status = "Caution";
      if (curT > 32.0 || curH > 85) status = "Anomaly";

      this.history.push({
        id: i + 1,
        timestamp: t,
        temp: parseFloat(curT.toFixed(2)),
        humid: parseFloat(curH.toFixed(2)),
        dewPoint: parseFloat(dp.toFixed(2)),
        heatIndex: parseFloat(hi.toFixed(2)),
        status: status
      });
    }

    const latest = this.history[this.history.length - 1];
    this.state.temp = latest.temp;
    this.state.humid = latest.humid;
    this.state.timestamp = latest.timestamp;
    this.recalculateDerived();
    this.saveHistory();
  }

  // Calculate psychrometric Dew Point via Magnus formula
  computeDewPoint(t, rh) {
    const a = 17.27;
    const b = 237.7;
    const alpha = (a * t) / (b + t) + Math.log(rh / 100.0);
    return (b * alpha) / (a - alpha);
  }

  // Calculate NOAA Heat Index (°C)
  computeHeatIndex(t, rh) {
    const tf = (t * 9) / 5 + 32;
    if (tf < 80) return t;
    const hif =
      -42.379 +
      2.04901523 * tf +
      10.14333127 * rh -
      0.22475541 * tf * rh -
      0.00683783 * tf * tf -
      0.05481717 * rh * rh +
      0.00122874 * tf * tf * rh +
      0.00085282 * tf * rh * rh -
      0.00000199 * tf * tf * rh * rh;
    return ((hif - 32) * 5) / 9;
  }

  // Calculate Vapor Pressure Deficit (VPD in kPa)
  computeVPD(t, rh) {
    const vpsat = 0.61078 * Math.exp((17.27 * t) / (t + 237.3));
    const vpact = vpsat * (rh / 100.0);
    return Math.max(0, vpsat - vpact);
  }

  recalculateDerived() {
    this.state.dewPoint = this.computeDewPoint(this.state.temp, this.state.humid);
    this.state.heatIndex = this.computeHeatIndex(this.state.temp, this.state.humid);
    this.state.vpd = this.computeVPD(this.state.temp, this.state.humid);
  }

  // Single simulation step
  tick() {
    this.state.tempSpike *= 0.88;
    if (Math.abs(this.state.tempSpike) < 0.05) this.state.tempSpike = 0;

    this.state.humidSpike *= 0.88;
    if (Math.abs(this.state.humidSpike) < 0.1) this.state.humidSpike = 0;

    const targetTemp = this.currentPreset.baseTemp + this.state.tempSpike;
    const targetHum = this.currentPreset.baseHum + this.state.humidSpike;

    const driftT = (targetTemp - this.state.temp) * 0.12;
    const noiseT = (Math.random() - 0.5) * 0.22;
    this.state.temp = parseFloat((this.state.temp + driftT + noiseT).toFixed(2));

    const driftH = (targetHum - this.state.humid) * 0.1;
    const noiseH = (Math.random() - 0.5) * 0.55;
    this.state.humid = parseFloat((this.state.humid + driftH + noiseH).toFixed(2));
    this.state.humid = Math.max(5, Math.min(99, this.state.humid));

    this.state.timestamp = Date.now();
    this.recalculateDerived();

    let status = "Nominal";
    if (Math.abs(this.state.temp - this.currentPreset.baseTemp) > 3.0 || Math.abs(this.state.humid - this.currentPreset.baseHum) > 15) {
      status = "Caution";
    }
    if (this.state.temp > 33.0 || this.state.temp < 14.0 || this.state.humid > 88) {
      status = "Anomaly";
    }

    const newEntry = {
      id: this.history.length + 1,
      timestamp: this.state.timestamp,
      temp: this.state.temp,
      humid: this.state.humid,
      dewPoint: parseFloat(this.state.dewPoint.toFixed(2)),
      heatIndex: parseFloat(this.state.heatIndex.toFixed(2)),
      status: status
    };

    this.history.push(newEntry);
    if (this.history.length > 500) {
      this.history.shift();
    }

    // Debounced save
    if (this.history.length % 5 === 0) {
      this.saveHistory();
    }

    this.notify(newEntry);
  }

  start() {
    if (this.timerId) return;
    this.isRunning = true;
    this.timerId = setInterval(() => {
      this.tick();
    }, this.updateInterval);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
  }

  subscribe(callback) {
    this.listeners.push(callback);
  }

  notify(entry) {
    this.listeners.forEach((fn) => fn(this.state, entry, this.history));
  }
}
