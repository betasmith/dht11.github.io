/**
 * AeroLab RMS-32 | Dynamic Scientific Background Animation
 * Renders an interactive neural/environmental particle lattice with traveling
 * data pulses, dynamic mouse wave distortion, and adaptive Dark Mode styling
 * (black, crisp white, and glowing lime green theme).
 */

(function () {
  const canvas = document.getElementById("bgCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const particles = [];
  const pulses = []; // Floating energy packets traveling along links
  const ripples = []; // Expanding ripple waves on mouse click/move
  const PARTICLE_COUNT = Math.min(Math.floor((width * height) / 16000), 85);
  const MAX_DISTANCE = 145;

  const mouse = {
    x: null,
    y: null,
    radius: 140,
    down: false
  };

  function isDarkMode() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener("mouseleave", () => {
    mouse.x = null;
    mouse.y = null;
  });

  window.addEventListener("click", (e) => {
    if (ripples.length < 5) {
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 5,
        maxRadius: 180,
        alpha: 0.6
      });
    }
  });

  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = (Math.random() - 0.5) * 0.6;
      this.baseRadius = Math.random() * 2.2 + 1.2;
      this.radius = this.baseRadius;
      this.phase = Math.random() * Math.PI * 2;
      this.pulseSpeed = 0.03 + Math.random() * 0.03;
    }

    update() {
      this.phase += this.pulseSpeed;
      // Subtle rhythmic breathing
      this.radius = this.baseRadius + Math.sin(this.phase) * 0.7;

      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0) { this.x = 0; this.vx *= -1; }
      else if (this.x > width) { this.x = width; this.vx *= -1; }
      if (this.y < 0) { this.y = 0; this.vy *= -1; }
      else if (this.y > height) { this.y = height; this.vy *= -1; }

      // Mouse interactive repelling force
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < mouse.radius && dist > 1) {
          const force = (mouse.radius - dist) / mouse.radius;
          this.x -= (dx / dist) * force * 3;
          this.y -= (dy / dist) * force * 3;
        }
      }

      // Ripple interaction
      for (let i = 0; i < ripples.length; i++) {
        const r = ripples[i];
        const dx = this.x - r.x;
        const dy = this.y - r.y;
        const dist = Math.hypot(dx, dy);
        if (Math.abs(dist - r.radius) < 25) {
          this.radius = this.baseRadius + 2.5;
        }
      }
    }

    draw(dark) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.5, this.radius), 0, Math.PI * 2);

      if (dark) {
        // Dark Mode: Lime green + neon glow
        const glow = Math.sin(this.phase) * 0.2 + 0.6;
        ctx.fillStyle = `rgba(74, 222, 128, ${glow})`;
        ctx.shadowColor = "rgba(74, 222, 128, 0.6)";
        ctx.shadowBlur = 6;
      } else {
        // Light Mode: Cyan & Indigo
        const alpha = Math.sin(this.phase) * 0.15 + 0.35;
        ctx.fillStyle = `rgba(2, 132, 199, ${alpha})`;
        ctx.shadowColor = "rgba(2, 132, 199, 0.3)";
        ctx.shadowBlur = 3;
      }
      ctx.fill();
      ctx.shadowBlur = 0; // reset
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle());
  }

  // Energy packet traveling along connected lattice links
  function spawnEnergyPulse(p1, p2) {
    if (pulses.length > 15) return;
    pulses.push({
      p1,
      p2,
      progress: 0,
      speed: 0.015 + Math.random() * 0.02
    });
  }

  function drawGridSubtle(dark) {
    const gridSize = 70;
    ctx.strokeStyle = dark ? "rgba(34, 197, 94, 0.04)" : "rgba(226, 232, 240, 0.45)";
    ctx.lineWidth = 0.5;

    ctx.beginPath();
    for (let x = 0; x < width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    const dark = isDarkMode();

    drawGridSubtle(dark);

    // Update & draw ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.radius += 3.5;
      r.alpha -= 0.012;
      if (r.alpha <= 0 || r.radius > r.maxRadius) {
        ripples.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = dark
        ? `rgba(74, 222, 128, ${r.alpha})`
        : `rgba(2, 132, 199, ${r.alpha * 0.6})`;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // Update particles & draw connecting vectors
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw(dark);

      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.hypot(dx, dy);

        if (dist < MAX_DISTANCE) {
          const proximity = 1 - dist / MAX_DISTANCE;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);

          if (dark) {
            // Lime green links with subtle pulse
            const alpha = proximity * 0.28;
            ctx.strokeStyle = `rgba(74, 222, 128, ${alpha})`;
            ctx.lineWidth = proximity * 1.2;
          } else {
            // Soft slate-cyan links
            const alpha = proximity * 0.22;
            ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`;
            ctx.lineWidth = proximity * 0.9;
          }
          ctx.stroke();

          // Occasionally spawn a travelling packet along active links
          if (Math.random() < 0.0006) {
            spawnEnergyPulse(particles[i], particles[j]);
          }
        }
      }
    }

    // Update and draw traveling energy pulses
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.progress += p.speed;
      if (p.progress >= 1) {
        pulses.splice(i, 1);
        continue;
      }

      const curX = p.p1.x + (p.p2.x - p.p1.x) * p.progress;
      const curY = p.p1.y + (p.p2.y - p.p1.y) * p.progress;

      ctx.beginPath();
      ctx.arc(curX, curY, 2.8, 0, Math.PI * 2);
      if (dark) {
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#39ff14";
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = "#38bdf8";
        ctx.shadowColor = "#0284c7";
        ctx.shadowBlur = 5;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    requestAnimationFrame(animate);
  }

  animate();
})();
