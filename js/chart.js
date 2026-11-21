/**
 * AeroLab RMS-32 | Standalone Precision Scientific Chart Engine
 * Dual-axis (Temperature & Humidity), Retina sharp, responsive, zero-dependency.
 * Upgraded with rich vibrant color gradients, live beacon radar pulse animation,
 * and adaptive Dark Mode (Black, Crisp White, and Electric Lime Green).
 */

class TelemetryChart {
  constructor(canvasId, tooltipId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.tooltip = document.getElementById(tooltipId);
    this.wrapper = this.canvas.parentElement;

    this.showTemp = true;
    this.showHumid = true;
    this.timeframe = "24h"; // "5m", "1h", "6h", "24h"

    this.data = []; // [{ timestamp, temp, humid }]

    this.padding = { top: 28, right: 62, bottom: 42, left: 62 };
    this.hoverIndex = -1;

    // Animated beacon pulse properties
    this.pulsePhase = 0;
    this.animId = null;

    this.initEvents();
    this.resize();
    this.startBeaconLoop();
  }

  isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  initEvents() {
    window.addEventListener("resize", () => {
      this.resize();
      this.render();
    });

    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      this.handleHover(mouseX, mouseY);
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.hoverIndex = -1;
      if (this.tooltip) this.tooltip.style.display = "none";
      this.render();
    });
  }

  startBeaconLoop() {
    const loop = () => {
      this.pulsePhase = (this.pulsePhase + 0.04) % (Math.PI * 2);
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.wrapper.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
  }

  setData(dataList, timeframe = null) {
    if (timeframe) this.timeframe = timeframe;
    this.data = dataList || [];
    this.render();
  }

  getFilteredData() {
    if (!this.data || this.data.length === 0) return [];

    const now = this.data[this.data.length - 1].timestamp;
    let cutoffMs = 24 * 3600 * 1000; // default 24h

    if (this.timeframe === "5m") cutoffMs = 5 * 60 * 1000;
    else if (this.timeframe === "1h") cutoffMs = 1 * 3600 * 1000;
    else if (this.timeframe === "6h") cutoffMs = 6 * 3600 * 1000;
    else if (this.timeframe === "24h") cutoffMs = 24 * 3600 * 1000;

    const filtered = this.data.filter((d) => d.timestamp >= now - cutoffMs);
    return filtered.length > 1 ? filtered : this.data.slice(-20);
  }

  handleHover(mouseX, mouseY) {
    const dataset = this.getFilteredData();
    if (!dataset.length) return;

    const plotWidth = this.width - this.padding.left - this.padding.right;
    const plotHeight = this.height - this.padding.top - this.padding.bottom;

    if (
      mouseX < this.padding.left ||
      mouseX > this.width - this.padding.right ||
      mouseY < this.padding.top ||
      mouseY > this.height - this.padding.bottom
    ) {
      this.hoverIndex = -1;
      if (this.tooltip) this.tooltip.style.display = "none";
      this.render();
      return;
    }

    const ratio = (mouseX - this.padding.left) / plotWidth;
    const index = Math.round(ratio * (dataset.length - 1));
    this.hoverIndex = Math.max(0, Math.min(dataset.length - 1, index));

    const item = dataset[this.hoverIndex];
    if (item && this.tooltip) {
      const dateStr = new Date(item.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

      const dark = this.isDark();
      const tempColor = dark ? "#4ade80" : "#f43f5e";
      const humidColor = dark ? "#38bdf8" : "#0284c7";

      this.tooltip.innerHTML = `
        <div style="font-weight:700; color:${dark ? '#a1a1aa' : '#64748b'}; margin-bottom:6px; font-size:11px; letter-spacing:0.5px;">
          TIME: ${dateStr}
        </div>
        <div style="display:flex; justify-content:space-between; gap:14px; color:${tempColor}; font-weight:700; font-size:13px; margin-bottom:3px;">
          <span>Temperature:</span><span>${item.temp.toFixed(1)} °C</span>
        </div>
        <div style="display:flex; justify-content:space-between; gap:14px; color:${humidColor}; font-weight:700; font-size:13px;">
          <span>Rel. Humidity:</span><span>${item.humid.toFixed(1)} %</span>
        </div>
      `;
      this.tooltip.style.display = "block";
      this.tooltip.style.left = `${mouseX}px`;
      this.tooltip.style.top = `${mouseY - 12}px`;
    }

    this.render();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const dark = this.isDark();
    const dataset = this.getFilteredData();

    if (dataset.length < 2) {
      ctx.fillStyle = dark ? "#4ade80" : "#94a3b8";
      ctx.font = "13px 'JetBrains Mono', Consolas, monospace";
      ctx.textAlign = "center";
      ctx.fillText("Awaiting telemetry telemetry stream...", this.width / 2, this.height / 2);
      return;
    }

    const plotX = this.padding.left;
    const plotY = this.padding.top;
    const plotW = this.width - this.padding.left - this.padding.right;
    const plotH = this.height - this.padding.top - this.padding.bottom;

    // Determine Min & Max bounds with scientific padding
    let minTemp = Math.min(...dataset.map((d) => d.temp));
    let maxTemp = Math.max(...dataset.map((d) => d.temp));
    let minHum = Math.min(...dataset.map((d) => d.humid));
    let maxHum = Math.max(...dataset.map((d) => d.humid));

    minTemp = Math.floor(minTemp - 1.5);
    maxTemp = Math.ceil(maxTemp + 1.5);
    if (maxTemp - minTemp < 4) maxTemp = minTemp + 4;

    minHum = Math.floor(Math.max(0, minHum - 4));
    maxHum = Math.ceil(Math.min(100, maxHum + 4));
    if (maxHum - minHum < 8) maxHum = minHum + 8;

    // Scientific Grid Lines & Y-Axis Labels
    const steps = 5;
    ctx.lineWidth = 1;
    ctx.font = "11px 'JetBrains Mono', Consolas, monospace";

    for (let i = 0; i <= steps; i++) {
      const y = plotY + (plotH / steps) * i;

      // Horizontal grid
      ctx.strokeStyle = dark
        ? (i === steps ? "rgba(74, 222, 128, 0.2)" : "rgba(255, 255, 255, 0.05)")
        : (i === steps ? "#cbd5e1" : "#f1f5f9");
      ctx.beginPath();
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotW, y);
      ctx.stroke();

      // Left Axis (Temp °C)
      if (this.showTemp) {
        const valTemp = maxTemp - ((maxTemp - minTemp) / steps) * i;
        ctx.fillStyle = dark ? "#4ade80" : "#f43f5e";
        ctx.textAlign = "right";
        ctx.fillText(`${valTemp.toFixed(1)}°`, plotX - 10, y + 4);
      }

      // Right Axis (Humidity %)
      if (this.showHumid) {
        const valHum = maxHum - ((maxHum - minHum) / steps) * i;
        ctx.fillStyle = dark ? "#38bdf8" : "#0284c7";
        ctx.textAlign = "left";
        ctx.fillText(`${valHum.toFixed(0)}%`, plotX + plotW + 10, y + 4);
      }
    }

    // Time X-Axis Ticks
    const timeTicks = 6;
    ctx.fillStyle = dark ? "#94a3b8" : "#64748b";
    ctx.textAlign = "center";
    for (let i = 0; i <= timeTicks; i++) {
      const idx = Math.floor((i / timeTicks) * (dataset.length - 1));
      const x = plotX + (i / timeTicks) * plotW;
      const t = new Date(dataset[idx].timestamp);
      const timeLabel =
        this.timeframe === "5m"
          ? t.toLocaleTimeString([], { minute: "2-digit", second: "2-digit" })
          : t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      ctx.fillText(timeLabel, x, plotY + plotH + 20);
    }

    // Coordinate conversion helpers
    const getX = (index) => plotX + (index / (dataset.length - 1)) * plotW;
    const getYTemp = (temp) => plotY + plotH - ((temp - minTemp) / (maxTemp - minTemp)) * plotH;
    const getYHum = (hum) => plotY + plotH - ((hum - minHum) / (maxHum - minHum)) * plotH;

    // Palette Configuration based on theme
    let tempStroke, tempGradTop, tempGradBottom;
    let humidStroke, humidGradTop, humidGradBottom;

    if (dark) {
      // Black, White, Lime Green Theme
      // Temperature: Electric Lime Green (#22c55e to #4ade80)
      const gradT = ctx.createLinearGradient(plotX, 0, plotX + plotW, 0);
      gradT.addColorStop(0, "#22c55e");
      gradT.addColorStop(0.5, "#4ade80");
      gradT.addColorStop(1, "#a3e635");
      tempStroke = gradT;
      tempGradTop = "rgba(74, 222, 128, 0.28)";
      tempGradBottom = "rgba(34, 197, 94, 0.01)";

      // Humidity: Luminous Ice Cyan & Pure White (#38bdf8 to #ffffff)
      const gradH = ctx.createLinearGradient(plotX, 0, plotX + plotW, 0);
      gradH.addColorStop(0, "#0284c7");
      gradH.addColorStop(0.6, "#38bdf8");
      gradH.addColorStop(1, "#ffffff");
      humidStroke = gradH;
      humidGradTop = "rgba(56, 189, 248, 0.24)";
      humidGradBottom = "rgba(255, 255, 255, 0.01)";
    } else {
      // Light Mode: Sunset Coral-Orange & Royal Azure
      const gradT = ctx.createLinearGradient(plotX, 0, plotX + plotW, 0);
      gradT.addColorStop(0, "#e11d48");
      gradT.addColorStop(0.7, "#f43f5e");
      gradT.addColorStop(1, "#fb923c");
      tempStroke = gradT;
      tempGradTop = "rgba(244, 63, 94, 0.22)";
      tempGradBottom = "rgba(251, 146, 60, 0.01)";

      const gradH = ctx.createLinearGradient(plotX, 0, plotX + plotW, 0);
      gradH.addColorStop(0, "#0284c7");
      gradH.addColorStop(0.7, "#0ea5e9");
      gradH.addColorStop(1, "#38bdf8");
      humidStroke = gradH;
      humidGradTop = "rgba(14, 165, 233, 0.22)";
      humidGradBottom = "rgba(56, 189, 248, 0.01)";
    }

    // 1. Draw Humidity Curve & Gradient Area
    if (this.showHumid) {
      this.drawSpline(dataset, getX, getYHum, "humid", humidStroke, humidGradTop, humidGradBottom, plotY, plotH);
    }

    // 2. Draw Temperature Curve & Gradient Area
    if (this.showTemp) {
      this.drawSpline(dataset, getX, getYTemp, "temp", tempStroke, tempGradTop, tempGradBottom, plotY, plotH);
    }

    // 3. Draw Dynamic Animated Live Beacon on Latest Data Point
    const lastIdx = dataset.length - 1;
    const lastX = getX(lastIdx);

    if (this.showHumid) {
      const lastHumY = getYHum(dataset[lastIdx].humid);
      this.drawBeacon(lastX, lastHumY, dark ? "#38bdf8" : "#0284c7");
    }
    if (this.showTemp) {
      const lastTempY = getYTemp(dataset[lastIdx].temp);
      this.drawBeacon(lastX, lastTempY, dark ? "#4ade80" : "#f43f5e");
    }

    // 4. Draw Crosshair on Hover
    if (this.hoverIndex >= 0 && this.hoverIndex < dataset.length) {
      const hX = getX(this.hoverIndex);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = dark ? "rgba(74, 222, 128, 0.45)" : "#94a3b8";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(hX, plotY);
      ctx.lineTo(hX, plotY + plotH);
      ctx.stroke();
      ctx.restore();

      const item = dataset[this.hoverIndex];

      if (this.showHumid) {
        const hYHum = getYHum(item.humid);
        this.drawHoverPoint(hX, hYHum, dark ? "#38bdf8" : "#0284c7");
      }
      if (this.showTemp) {
        const hYTemp = getYTemp(item.temp);
        this.drawHoverPoint(hX, hYTemp, dark ? "#4ade80" : "#f43f5e");
      }
    }
  }

  drawSpline(dataset, getX, getY, key, strokeStyle, gradTop, gradBottom, plotY, plotH) {
    const ctx = this.ctx;
    const baseY = plotY + plotH;
    const pts = dataset.map((d, i) => ({ x: getX(i), y: getY(d[key]) }));

    // Area fill gradient
    const areaGrad = ctx.createLinearGradient(0, plotY, 0, baseY);
    areaGrad.addColorStop(0, gradTop);
    areaGrad.addColorStop(1, gradBottom);

    ctx.beginPath();
    ctx.moveTo(pts[0].x, baseY);
    ctx.lineTo(pts[0].x, pts[0].y);

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }

    ctx.lineTo(pts[pts.length - 1].x, baseY);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Line stroke with subtle glow
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2.8;
    ctx.stroke();
    ctx.restore();
  }

  drawBeacon(x, y, color) {
    const ctx = this.ctx;
    const pulseRadius = 5 + Math.sin(this.pulsePhase) * 6;
    const pulseAlpha = Math.max(0, 1 - pulseRadius / 11);

    // Expanding ripple ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, pulseRadius), 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = pulseAlpha * 0.6;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Solid core dot
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  }

  drawHoverPoint(x, y, color) {
    const ctx = this.ctx;
    const dark = this.isDark();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#0c120e" : "#ffffff";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.restore();
  }
}
