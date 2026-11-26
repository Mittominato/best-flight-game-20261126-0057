// The HUD: lit instruments over the 3D view — altitude, speed, heading,
// throttle, fuel, damage, rings, time and score, plus an attitude indicator
// and a compass drawn on small canvases, and a needle that points at the
// next ring. Only text that changed is rewritten, so a frame allocates little.
import { PALETTE, RINGS } from './config.js';

const MS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;

function cache() {
  let last = null;
  return (el, value) => {
    if (value !== last) {
      last = value;
      el.textContent = value;
    }
  };
}

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const alt = $('hud-alt');
  const vspeed = $('hud-vspeed');
  const speed = $('hud-speed');
  const heading = $('hud-heading');
  const throttleFill = $('hud-throttle-fill');
  const throttleText = $('hud-throttle-text');
  const fuelFill = $('hud-fuel-fill');
  const fuelText = $('hud-fuel-text');
  const damageFill = $('hud-damage-fill');
  const damageText = $('hud-damage-text');
  const rings = $('hud-rings');
  const time = $('hud-time');
  const score = $('hud-score');
  const lives = $('hud-lives');
  const message = $('hud-message');
  const warning = $('hud-warning');
  const arrow = $('ring-arrow');
  const ringDist = $('ring-dist');
  const attitude = $('attitude');
  const compass = $('compass');
  const actx = attitude.getContext('2d');
  const cctx = compass.getContext('2d');

  const setAlt = cache();
  const setVspeed = cache();
  const setSpeed = cache();
  const setHeading = cache();
  const setThrottle = cache();
  const setFuel = cache();
  const setDamage = cache();
  const setRings = cache();
  const setTime = cache();
  const setScore = cache();
  const setLives = cache();
  const setDist = cache();

  let messageTimer = 0;
  let warningTimer = 0;

  function showMessage(text, ms = 2200) {
    message.textContent = text;
    message.classList.add('show');
    messageTimer = ms;
  }

  function showWarning(text, ms = 1600) {
    warning.textContent = text;
    warning.classList.add('show');
    warningTimer = ms;
  }

  function drawAttitude(pitch, roll) {
    const w = attitude.width;
    const h = attitude.height;
    const cx = w / 2;
    const cy = h / 2;
    actx.clearRect(0, 0, w, h);
    actx.save();
    actx.beginPath();
    actx.arc(cx, cy, 62, 0, Math.PI * 2);
    actx.clip();
    actx.translate(cx, cy);
    actx.rotate(-roll * Math.PI / 180);
    const pitchPx = pitch * 2.2;
    actx.fillStyle = '#3f7fb5';
    actx.fillRect(-70, -70, 140, pitchPx + 70);
    actx.fillStyle = '#7a5a34';
    actx.fillRect(-70, pitchPx, 140, 70 - pitchPx);
    actx.strokeStyle = 'rgba(255,255,255,0.85)';
    actx.lineWidth = 1.5;
    actx.beginPath();
    actx.moveTo(-70, pitchPx);
    actx.lineTo(70, pitchPx);
    actx.stroke();
    actx.beginPath();
    actx.moveTo(-34, pitchPx - 18);
    actx.lineTo(34, pitchPx - 18);
    actx.moveTo(-34, pitchPx + 18);
    actx.lineTo(34, pitchPx + 18);
    actx.stroke();
    actx.restore();
    // Fixed aircraft symbol and the bezel.
    actx.strokeStyle = PALETTE.hudAmber;
    actx.lineWidth = 2.5;
    actx.beginPath();
    actx.moveTo(cx - 26, cy);
    actx.lineTo(cx + 26, cy);
    actx.moveTo(cx, cy - 4);
    actx.lineTo(cx, cy + 4);
    actx.stroke();
    actx.strokeStyle = 'rgba(255,255,255,0.5)';
    actx.lineWidth = 2;
    actx.beginPath();
    actx.arc(cx, cy, 62, 0, Math.PI * 2);
    actx.stroke();
  }

  function drawCompass(headingDeg) {
    const w = compass.width;
    const h = compass.height;
    cctx.clearRect(0, 0, w, h);
    cctx.fillStyle = PALETTE.panel;
    cctx.fillRect(0, 0, w, h);
    const pxPerDeg = w / 120; // 120 degrees visible
    cctx.font = 'bold 13px ui-monospace, Menlo, monospace';
    cctx.textAlign = 'center';
    cctx.textBaseline = 'middle';
    for (let d = -60; d <= 60; d += 5) {
      const deg = Math.round((headingDeg + d + 360) % 360);
      const x = w / 2 + d * pxPerDeg;
      const major = deg % 30 === 0;
      cctx.strokeStyle = major ? PALETTE.hudInk : 'rgba(238,243,246,0.4)';
      cctx.lineWidth = major ? 2 : 1;
      cctx.beginPath();
      cctx.moveTo(x, 6);
      cctx.lineTo(x, major ? 18 : 12);
      cctx.stroke();
      if (major) {
        const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg).padStart(3, '0');
        cctx.fillStyle = PALETTE.hudInk;
        cctx.fillText(label, x, 30);
      }
    }
    // Centre caret.
    cctx.fillStyle = PALETTE.hudAmber;
    cctx.beginPath();
    cctx.moveTo(w / 2 - 6, 0);
    cctx.lineTo(w / 2 + 6, 0);
    cctx.lineTo(w / 2, 7);
    cctx.closePath();
    cctx.fill();
  }

  /**
   * Refresh every instrument from the flight state. `view` is { flight, rings,
   * score, elapsed, lives, camera } and `dt` is the frame time, for fading
   * the flash messages.
   */
  function update(view, dt) {
    const f = view.flight;
    const altFt = Math.max(0, Math.round((f.pos.y - 6) * M_TO_FT));
    setAlt(alt, `${altFt.toLocaleString('en-US')} ft`);
    const vsFpm = Math.round(f.vspeed * M_TO_FT * 60);
    setVspeed(vspeed, `${vsFpm >= 0 ? '+' : ''}${vsFpm} fpm`);
    setSpeed(speed, `${Math.round(f.speed * MS_TO_KT)} kt`);
    setHeading(heading, `${String(Math.round(f.heading)).padStart(3, '0')}°`);
    const thr = Math.round(f.throttle * 100);
    throttleFill.style.width = `${thr}%`;
    setThrottle(throttleText, `THR ${thr}%`);
    const fuel = Math.round(f.fuel);
    fuelFill.style.width = `${fuel}%`;
    fuelFill.classList.toggle('low', fuel < 25);
    setFuel(fuelText, `FUEL ${fuel}%`);
    const dmg = Math.round(Math.min(100, f.damage));
    damageFill.style.width = `${dmg}%`;
    setDamage(damageText, `DMG ${dmg}%`);
    setRings(rings, `RINGS ${view.rings.state.passed}/${RINGS.length}`);
    const t = Math.floor(view.elapsed);
    setTime(time, `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
    setScore(score, `${view.score.toLocaleString('en-US')}`);
    setLives(lives, `AIRFRAMES ${Math.max(0, view.lives)}`);
    drawAttitude(f.pitch, f.roll);
    drawCompass(f.heading);

    // The needle: bearing to the next ring, relative to the nose.
    const target = view.rings.target();
    if (target) {
      const dx = target.x - f.pos.x;
      const dz = target.z - f.pos.z;
      const bearing = (Math.atan2(dx, -dz) * 180) / Math.PI;
      let rel = ((bearing - f.heading + 540) % 360) - 180;
      arrow.style.transform = `rotate(${rel}deg)`;
      const dist = Math.hypot(dx, dz, target.y - f.pos.y);
      setDist(ringDist, `${Math.round(dist)} m`);
      arrow.style.opacity = '1';
      ringDist.style.opacity = '1';
    } else {
      arrow.style.opacity = '0';
      ringDist.style.opacity = '0';
    }

    if (messageTimer > 0) {
      messageTimer -= dt * 1000;
      if (messageTimer <= 0) message.classList.remove('show');
    }
    if (warningTimer > 0) {
      warningTimer -= dt * 1000;
      if (warningTimer <= 0) warning.classList.remove('show');
    }
  }

  return { update, showMessage, showWarning };
}
