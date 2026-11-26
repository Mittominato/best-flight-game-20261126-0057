// The screenshot scenes behind ?shot=start|play|end. Each one flies the real
// flight model with a simple autopilot — bank toward the next ring, pitch
// toward its altitude, throttle up to cruise — so the frame is what a real
// sortie looks like, and the same scene always gives the same frame. The
// island itself is fixed, so the seed only varies the autopilot's timing.
import { RINGS, RUNWAY, SCORE, STEP } from './config.js';
import { EVENT_CRASH, EVENT_LANDED, GEAR_HEIGHT, startPose } from './flight.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_COMPLETE = 'complete';
export const SCREEN_OVER = 'over';

const PLAY_SECONDS = 48;
const END_LIMIT_SECONDS = 600;

/** Wrap an angle difference to [-180, 180]. */
function wrap180(a) {
  return ((a + 540) % 360) - 180;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * The autopilot: steer toward a target point (a ring, or the runway for the
 * landing), with the same inputs a player would give the stick. On the ground
 * it keeps the wings level and rotates once the wing is flying; in the air
 * it holds altitude by aiming for a vertical speed that closes the error.
 */
function autopilot(flight, rings, landing) {
  const f = flight.state;
  if (f.onGround) {
    return {
      pitch: f.speed > 30 ? 0.6 : 0,
      roll: 0,
      throttle: 0.95,
      brake: false,
    };
  }
  let tx;
  let ty;
  let tz;
  let throttle = 0.9;
  let dist = Infinity;
  if (landing) {
    // Final approach in two parts. First, position: fly to the downwind
    // point on the extended centreline west of the field, the same way the
    // rings are flown, so the plane arrives lined up. Then the beam: once
    // there, the runway centreline extended west is a beam to steer onto
    // and follow down — a line cannot be orbited the way a point can. If
    // the plane ever flies past the runway on the beam, it goes around and
    // positions again.
    const thresholdX = RUNWAY.x - 60;
    const downwind = { x: RUNWAY.x - RUNWAY.length / 2 - 890, y: RUNWAY.elevation + 94, z: RUNWAY.z };
    const along = thresholdX - f.pos.x; // > 0 while west of the threshold
    const crossTrack = RUNWAY.z - f.pos.z; // +ve north of the centreline
    const distDown = Math.hypot(downwind.x - f.pos.x, downwind.y - f.pos.y, downwind.z - f.pos.z);
    if (!f.onBeam && distDown < 150) f.onBeam = true;
    if (f.onBeam) {
      if (along < -270) f.onBeam = false; // past the runway end: go around
      const desiredHeading = RUNWAY.heading + clamp(crossTrack * 0.5, -45, 45);
      // The glide is measured west of the threshold: once the plane is past
      // it, the target stays at gear height so it settles onto the strip
      // instead of climbing away as the distance behind it grows.
      const distToThreshold = Math.hypot(Math.max(along, 0), crossTrack);
      // Stay at pattern height until the plane is near the centreline,
      // then glide down on the distance to the threshold. The glide
      // bottoms out 150 m short of the threshold, so the plane is already
      // at gear height when it crosses it — a glide that only reaches the
      // ground at the threshold floats past the strip before it settles.
      // The floor sits 0.6 m below gear height, so the plane is driven
      // firmly onto the strip instead of hovering a hand's width above it.
      ty = Math.abs(crossTrack) < 60
        ? RUNWAY.elevation + GEAR_HEIGHT - 0.6 + Math.max(0, (distToThreshold - 150) * 0.12)
        : RUNWAY.elevation + 74;
      throttle = 0.5;
      const headingError = wrap180(desiredHeading - f.heading);
      let wantRoll = clamp(headingError * 1.4, -55, 55);
      if (along < 200 && Math.abs(crossTrack) < 30 && Math.abs(headingError) < 15) {
        wantRoll = 0; // wings level for the touchdown
      }
      const roll = clamp(wantRoll / 62, -1, 1);
      const vsTarget = clamp((ty - f.pos.y) * 0.5, -8, 6);
      const wantPitch = (Math.asin(clamp(vsTarget / Math.max(f.speed, 12), -0.6, 0.6)) * 180) / Math.PI;
      const pitch = clamp(wantPitch / 28, -1, 1);
      return { pitch, roll, throttle, brake: false };
    }
    // Position: lead-point approach to the downwind point, as for a ring.
    const prev = RINGS[RINGS.length - 1];
    const dxW = downwind.x - prev.x;
    const dyW = downwind.y - prev.y;
    const dzW = downwind.z - prev.z;
    const lenW = Math.hypot(dxW, dyW, dzW) || 1;
    const lead = distDown > 260 ? 260 : 0;
    tx = downwind.x - (dxW / lenW) * lead;
    ty = downwind.y - (dyW / lenW) * lead;
    tz = downwind.z - (dzW / lenW) * lead;
    dist = Math.hypot(tx - f.pos.x, tz - f.pos.z, ty - f.pos.y);
    throttle = 0.6;
  } else {
    const target = rings.target();
    if (!target) return { pitch: 0, roll: 0, throttle: 0.3, brake: false };
    // Fly the course the way it was laid out: approach each ring from the
    // previous one, aiming first at a point 260 m short of it so the plane
    // is lined up and straight when it crosses the ring — a pure chase of
    // the centre just orbits it. Slow down as the ring gets close, so the
    // turn can keep up with the bearing.
    const idx = rings.state.next;
    const prev = idx === 0 ? startPose() : RINGS[idx - 1];
    const dxT = target.x - prev.x;
    const dyT = target.y - prev.y;
    const dzT = target.z - prev.z;
    const lenT = Math.hypot(dxT, dyT, dzT) || 1;
    const distToTarget = Math.hypot(target.x - f.pos.x, target.y - f.pos.y, target.z - f.pos.z);
    const lead = distToTarget > 260 ? 260 : 0;
    tx = target.x - (dxT / lenT) * lead;
    ty = target.y - (dyT / lenT) * lead;
    tz = target.z - (dzT / lenT) * lead;
    dist = Math.hypot(tx - f.pos.x, tz - f.pos.z, ty - f.pos.y);
    throttle = distToTarget > 400 ? 0.9 : distToTarget > 200 ? 0.6 : 0.45;
  }
  const dx = tx - f.pos.x;
  const dz = tz - f.pos.z;
  const bearing = (Math.atan2(dx, -dz) * 180) / Math.PI;
  const headingError = wrap180(bearing - f.heading);
  let wantRoll = clamp(headingError * 1.4, -55, 55);
  // The flight model reads the stick as the bank it should hold (stick * 62),
  // so ask for the bank directly — a difference of angles would stall at 61%.
  const roll = clamp(wantRoll / 62, -1, 1);
  // Altitude hold: the vertical speed that would close the altitude error.
  const vsTarget = clamp((ty - f.pos.y) * 0.5, -7, 6);
  const wantPitch = (Math.asin(clamp(vsTarget / Math.max(f.speed, 12), -0.6, 0.6)) * 180) / Math.PI;
  const pitch = clamp(wantPitch / 28, -1, 1);
  return { pitch, roll, throttle, brake: false };
}

/** Fly the real rules forward for `seconds`, steering with the autopilot. */
function flyFor(flight, rings, seconds, landing) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = autopilot(flight, rings, landing);
    // The throttle input is a held key: -1, 0 or 1. The autopilot wants a
    // level, so push toward it and hold still once there.
    const want = input.throttle;
    const current = flight.state.throttle;
    const throttleInput = Math.abs(want - current) < 0.06 ? 0 : Math.sign(want - current);
    const events = flight.step(STEP, {
      pitch: input.pitch,
      roll: input.roll,
      throttle: throttleInput,
      brake: input.brake,
    });
    const passed = rings.check(flight.state.pos);
    if (passed && passed.fuel) flight.state.fuel = 100;
    if (events & EVENT_CRASH) return 'crash';
    if (events & EVENT_LANDED) return 'landed';
  }
  return 'flying';
}

/**
 * Set `flight` and `rings` to the named scene and return the screen to draw
 * over it, the score to show and the elapsed time.
 */
export function stageShot(name, flight, rings) {
  flight.reset(startPose());
  rings.reset();
  if (name !== 'play' && name !== 'end') {
    // Title: the plane parked on the strip, engine idling, ready to go.
    flight.state.throttle = 0.25;
    flight.state.rpm = 0.25;
    return { screen: SCREEN_TITLE, score: 0, elapsed: 0 };
  }
  if (name === 'play') {
    flyFor(flight, rings, PLAY_SECONDS, false);
    return { screen: SCREEN_PLAY, score: rings.state.score, elapsed: PLAY_SECONDS };
  }
  // End: fly the whole course, then land, however long the autopilot needs.
  let elapsed = 0;
  let outcome = 'flying';
  while (elapsed < END_LIMIT_SECONDS && outcome === 'flying') {
    const landing = rings.state.done;
    outcome = flyFor(flight, rings, 5, landing);
    elapsed += 5;
    if (outcome === 'crash') break;
    if (outcome === 'landed') break;
  }
  const landed = outcome === 'landed';
  const timeBonus = landed ? Math.max(0, SCORE.parSeconds - elapsed) * SCORE.timeBonusPerSecond : 0;
  const score = rings.state.score + (landed ? SCORE.landing + timeBonus : 0);
  return {
    screen: landed ? SCREEN_COMPLETE : SCREEN_OVER,
    score,
    elapsed,
  };
}
