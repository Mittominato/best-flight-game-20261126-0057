// Boot and the one loop: input is read every frame, the flight model advances
// in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between screens: title, play, paused, mission complete and game over.
// A sortie is eight rings over Copperwing Island and a landing back on the
// strip; fuel, damage and three airframes turn it into decisions.
//
// ?seed=N fixes the autopilot timing. ?shot=start|play|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, RINGS, SCORE, STEP } from './config.js';
import { createAircraft, updateAircraft } from './aircraft.js';
import { createAudio } from './audio.js';
import { createFlight, EVENT_CRASH, EVENT_FUEL_EMPTY, EVENT_LANDED, EVENT_SCRAPE, EVENT_STALL, startPose } from './flight.js';
import { createHud } from './hud.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createRings } from './rings.js';
import { SCREEN_COMPLETE, SCREEN_OVER, SCREEN_TITLE, stageShot } from './shots.js';
import { createTerrain } from './terrain.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayCopy = document.getElementById('overlay-copy');
const overlayExtra = document.getElementById('overlay-extra');
const overlayPrompt = document.getElementById('overlay-prompt');

// One scene, built in order: the renderer owns it, the terrain and the rings
// fill it, and the plane flies in it.
const plane = createAircraft();
const renderer = createRenderer(canvas, plane);
const scene = renderer.scene;
const terrainApi = createTerrain(scene);
scene.add(plane);
const flight = createFlight(terrainApi);
const rings = createRings(scene);
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);

let screen = SCREEN_TITLE;
let cameraMode = 'chase';
let elapsed = 0;
let best = readBest();
let finalScore = 0;
let finalBreakdown = '';
let stallWarned = false;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score lasts this visit.
  }
}

function announce(message) {
  status.textContent = message;
}

function showOverlay(title, copy, extra, prompt) {
  overlayTitle.textContent = title;
  overlayCopy.textContent = copy;
  overlayExtra.innerHTML = extra;
  overlayPrompt.textContent = prompt;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

function showTitle() {
  screen = SCREEN_TITLE;
  const bestLine = best > 0 ? `Best score ${best.toLocaleString('en-US')}. ` : '';
  showOverlay(
    'Copperwing Ridge Run',
    `${bestLine}Eight rings over Copperwing Island, then land her back on the strip. `
    + 'Watch the fuel, mind the ridge, and bring all three airframes home in one piece.',
    '',
    'Press Space or click to fly',
  );
  announce('Copperwing Ridge Run. Press Space or click to fly.');
}

function startMission() {
  flight.reset(startPose());
  rings.reset();
  elapsed = 0;
  finalScore = 0;
  stallWarned = false;
  cameraMode = 'chase';
  screen = SCREEN_PLAY;
  hideOverlay();
  audio.unlock();
  audio.click();
  hud.showMessage('Ring 1 — off the strip', 2600);
  announce('Flying. Eight rings, then land on the strip.');
}

function missionScore() {
  const timeBonus = Math.max(0, SCORE.parSeconds - Math.floor(elapsed)) * SCORE.timeBonusPerSecond;
  const damagePenalty = Math.round(flight.state.damage) * SCORE.damagePenalty;
  return {
    total: rings.state.score + SCORE.landing + timeBonus - damagePenalty,
    timeBonus,
    damagePenalty,
  };
}

function completeMission() {
  const { total, timeBonus, damagePenalty } = missionScore();
  finalScore = total;
  finalBreakdown = `Rings ${rings.state.score.toLocaleString('en-US')} · `
    + `Landing ${SCORE.landing.toLocaleString('en-US')} · `
    + `Time bonus ${timeBonus.toLocaleString('en-US')} · `
    + `Damage −${damagePenalty.toLocaleString('en-US')}`;
  if (total > best) {
    best = total;
    saveBest(best);
  }
  screen = SCREEN_COMPLETE;
  showOverlay(
    'Mission complete',
    `Eight rings and a landing on the strip. ${finalBreakdown}.`,
    `Score <b>${total.toLocaleString('en-US')}</b> · Best ${best.toLocaleString('en-US')}`,
    'Press Space or click to fly again',
  );
  announce(`Mission complete. Score ${total}. Best ${best}.`);
}

function gameOver(reason) {
  screen = SCREEN_OVER;
  showOverlay(
    'Out of airframes',
    `${reason} All three airframes are gone. The ridge wins this time.`,
    `Score ${rings.state.score.toLocaleString('en-US')} · Best ${best.toLocaleString('en-US')}`,
    'Press Space or click to try again',
  );
  announce('Out of airframes. Game over.');
}

/** Put the plane back at the last ring it passed, already flying. */
function respawnAtLastRing() {
  const passed = rings.state.passed;
  let pose;
  if (passed > 0) {
    const prev = RINGS[passed - 1];
    const next = rings.target() ?? { x: 0, y: 60, z: 880 };
    const bearing = (Math.atan2(next.x - prev.x, -(next.z - prev.z)) * 180) / Math.PI;
    pose = { x: prev.x, y: prev.y + 12, z: prev.z, heading: (bearing + 360) % 360 };
  } else {
    pose = startPose();
  }
  flight.respawn(pose);
  flight.state.onGround = false;
  flight.state.speed = 46;
  flight.state.throttle = 0.7;
  flight.state.rpm = 0.7;
  flight.state.airTime = 6;
}

function handleCrash() {
  audio.crash();
  if (flight.state.lives <= 1) {
    flight.state.lives = 0;
    gameOver('The Copperwing went down. ');
    return;
  }
  respawnAtLastRing();
  hud.showWarning('AIRFRAME LOST', 2200);
  hud.showMessage(`Back at ring ${rings.state.passed + 1} — ${flight.state.lives} airframes left`, 2600);
  announce(`Airframe lost. ${flight.state.lives} left.`);
}

function handleActions() {
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) {
    const muted = audio.toggleMute();
    hud.showMessage(muted ? 'Sound off' : 'Sound on', 1200);
  }
  if (screen === SCREEN_PLAY) {
    if (actions & (ACTION_CAMERA | ACTION_CONFIRM)) {
      cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
      hud.showMessage(cameraMode === 'chase' ? 'Chase view' : 'Cockpit view', 1200);
    }
    if (actions & ACTION_PAUSE) {
      screen = 'paused';
      showOverlay('Paused', 'The island will wait for you.', '', 'Press P to resume');
      announce('Paused.');
    } else if (actions & ACTION_RESTART) {
      startMission();
    }
    return;
  }
  if (screen === 'paused') {
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
      screen = SCREEN_PLAY;
      hideOverlay();
      announce('Flying.');
    }
    return;
  }
  if (actions & ACTION_CONFIRM) startMission();
}

function step(dt) {
  const stick = input.stick();
  const throttleKeys = input.throttleKeys();
  const throttleInput = throttleKeys !== 0 ? throttleKeys : Math.sign(input.takeWheel());
  const events = flight.step(dt, {
    pitch: stick.pitch,
    roll: stick.roll,
    throttle: throttleInput,
    brake: input.brakeHeld(),
  });
  elapsed += dt;

  const passed = rings.check(flight.state.pos);
  if (passed) {
    audio.ring();
    if (passed.fuel) {
      flight.state.fuel = 100;
      hud.showMessage('Fuel ring — tank full', 2200);
    } else {
      hud.showMessage(passed.note, 2200);
    }
    announce(passed.note);
  }
  if (events & EVENT_LANDED) {
    audio.thud();
    if (rings.state.done) {
      completeMission();
    } else {
      hud.showMessage('Down safe — but the course is not finished. Take off and keep flying.', 3200);
      flight.state.landed = false; // allow another landing to count later
    }
  }
  if (events & EVENT_SCRAPE) {
    audio.scrape();
    hud.showWarning(`HARD TOUCHDOWN — DAMAGE ${Math.round(flight.state.damage)}%`, 1800);
  }
  if (events & EVENT_FUEL_EMPTY) {
    hud.showWarning('FUEL EMPTY — GLIDING', 2600);
    announce('Fuel empty. Gliding.');
  }
  if (events & EVENT_STALL) {
    if (!stallWarned) {
      stallWarned = true;
      audio.stall();
      hud.showWarning('STALL — NOSE DOWN, ADD POWER', 2000);
    }
  } else {
    stallWarned = false;
  }
  if (events & EVENT_CRASH) handleCrash();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  handleActions();
  if (screen === SCREEN_PLAY) {
    accumulator += dt;
    while (accumulator >= STEP && screen === SCREEN_PLAY) {
      step(STEP);
      accumulator -= STEP;
    }
  } else {
    accumulator = 0;
  }
  // The title screen keeps the island alive behind the panel.
  terrainApi.update(dt);
  rings.update(now / 1000);
  updateAircraft(plane, flight.state.rpm, dt);
  audio.update(flight.state.rpm, flight.state.speed, screen === SCREEN_PLAY && !flight.state.onGround);
  renderer.update(flight.state, cameraMode, dt, rings);
  hud.update(
    { flight: flight.state, rings, score: rings.state.score, elapsed, lives: flight.state.lives },
    dt,
  );
}

function runShot(name) {
  const staged = stageShot(name, flight, rings);
  screen = staged.screen;
  elapsed = staged.elapsed;
  finalScore = staged.score;
  if (screen === SCREEN_COMPLETE) {
    const { timeBonus, damagePenalty } = missionScore();
    showOverlay(
      'Mission complete',
      `Eight rings and a landing on the strip. Rings ${rings.state.score.toLocaleString('en-US')} · `
      + `Landing ${SCORE.landing.toLocaleString('en-US')} · Time bonus ${timeBonus.toLocaleString('en-US')} · `
      + `Damage −${damagePenalty.toLocaleString('en-US')}.`,
      `Score <b>${staged.score.toLocaleString('en-US')}</b> · Best ${best.toLocaleString('en-US')}`,
      'Press Space or click to fly again',
    );
  } else if (screen === SCREEN_OVER) {
    // The staged crash spent the airframes: show the HUD to match.
    flight.state.lives = 0;
    showOverlay(
      'Out of airframes',
      'The Copperwing went down on the ridge. All three airframes are gone.',
      `Score ${staged.score.toLocaleString('en-US')} · Best ${best.toLocaleString('en-US')}`,
      'Press Space or click to try again',
    );
  } else if (screen === SCREEN_TITLE) {
    showTitle();
  } else {
    hideOverlay();
  }
  let painted = 0;
  function paint() {
    terrainApi.update(1 / 60);
    rings.update(performance.now() / 1000);
    updateAircraft(plane, flight.state.rpm, 1 / 60);
    renderer.update(flight.state, cameraMode, 1 / 60, rings);
    hud.update(
      { flight: flight.state, rings, score: rings.state.score, elapsed, lives: flight.state.lives },
      1 / 60,
    );
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

let last = performance.now();
let accumulator = 0;

// A handle for live checks: the flight state, the plane mesh, the renderer
// and the scene, so a browser console can inspect a running game.
window.__game = { flight, plane, renderer, rings, scene };

// Leaving the tab pauses a running game rather than letting it fly unseen.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === SCREEN_PLAY) {
    screen = 'paused';
    showOverlay('Paused', 'The island will wait for you.', '', 'Press P to resume');
    announce('Paused.');
  }
});

if (shot) {
  // The renderer needs a real scene before the first frame: the terrain and
  // the plane were added above, so the shot can paint immediately.
  runShot(shot);
} else {
  showTitle();
  announce('Copperwing Ridge Run. Press Space or click to fly.');
  requestAnimationFrame(frame);
}
