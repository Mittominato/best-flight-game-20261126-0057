// The flight model: arcade handling with real discipline — speed makes lift,
// banking turns the heading, a slow wing stalls and sinks, and the ground is
// only forgiving on the runway. No browser in here: step() takes inputs and
// returns event flags, so the same code flies the game and the screenshots.
import * as THREE from 'three';
import { LIVES, PLANE, RUNWAY } from './config.js';
import { heightAt, isWater } from './terrain.js';

export const EVENT_NONE = 0;
export const EVENT_SCRAPE = 1; // a hard touchdown or a brush with the ground
export const EVENT_CRASH = 2; // the airframe is lost
export const EVENT_LANDED = 4; // a good landing on the runway
export const EVENT_FUEL_EMPTY = 8; // the tank just ran dry
export const EVENT_STALL = 16; // the wing stopped flying this step

const DEG = Math.PI / 180;
export const GEAR_HEIGHT = 2.2; // metres from the plane origin to the wheels
const WORLD_EDGE = 1450;

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function approach(current, target, rate, dt) {
  const d = target - current;
  const step = rate * dt;
  if (Math.abs(d) <= step) return target;
  return current + Math.sign(d) * step;
}

/** Where the plane starts: parked on the runway, facing east (090). */
export function startPose() {
  return {
    x: RUNWAY.x - RUNWAY.length / 2 + 40,
    y: RUNWAY.elevation + GEAR_HEIGHT,
    z: RUNWAY.z,
    heading: RUNWAY.heading,
  };
}

export function createFlight(terrain) {
  const state = {
    pos: new THREE.Vector3(),
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    vspeed: 0,
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    rpm: 0,
    lives: LIVES,
    onGround: true,
    landed: false,
    airTime: 0,
    stalled: false,
    onBeam: false, // autopilot latch: true once the plane is on the final beam
  };

  function reset(pose) {
    const p = pose ?? startPose();
    state.pos.set(p.x, p.y, p.z);
    state.heading = p.heading;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.vspeed = 0;
    state.throttle = 0;
    state.fuel = PLANE.fuelCapacity;
    state.damage = 0;
    state.rpm = 0;
    state.onGround = true;
    state.landed = false;
    state.airTime = 0;
    state.stalled = false;
    state.onBeam = false;
  }

  function overRunway(x, z) {
    return Math.abs(x - RUNWAY.x) < RUNWAY.length / 2 + 6
      && Math.abs(z - RUNWAY.z) < RUNWAY.width / 2 + 6;
  }

  /**
   * One fixed step. `input` is { pitch, roll, throttle, brake } with pitch and
   * roll in [-1, 1] (stick deflection), throttle in [-1, 1] (held key or wheel)
   * and brake a boolean (airbrake). Returns EVENT_* flags.
   */
  function step(dt, input) {
    let events = EVENT_NONE;
    const wasFuel = state.fuel;

    // Throttle and engine.
    if (state.fuel > 0) {
      state.throttle = clamp(state.throttle + input.throttle * PLANE.throttleRate * dt, 0, 1);
      state.fuel = Math.max(0, state.fuel - state.throttle * PLANE.fuelBurn * dt);
      if (state.fuel === 0 && wasFuel > 0) events |= EVENT_FUEL_EMPTY;
    } else {
      state.throttle = 0; // engine out: glide
    }
    state.rpm = approach(state.rpm, state.fuel > 0 ? state.throttle : 0, 1.2, dt);

    // Attitude: the stick asks for a bank and a pitch; both answer slower
    // when the wing is slow, and barely at all below the stall.
    const authority = clamp((state.speed - 6) / (PLANE.stallSpeed + 6), 0.15, 1);
    const targetRoll = input.roll * 62;
    const targetPitch = input.pitch * 28;
    state.roll = approach(state.roll, targetRoll, PLANE.rollRate * authority, dt);
    state.pitch = approach(state.pitch, targetPitch, PLANE.pitchRate * authority, dt);

    // A banked wing turns the heading; a level wing flies straight.
    state.heading = (state.heading + PLANE.turnRate * Math.sin(state.roll * DEG) * dt + 360) % 360;

    // Speed: thrust pulls toward the throttle's speed, drag and climb bleed it.
    const targetSpeed = state.throttle * PLANE.maxSpeed;
    const climbBleed = Math.max(0, state.pitch) * 0.55;
    let nextSpeed = state.speed + (targetSpeed - state.speed) * PLANE.drag * dt * 3;
    nextSpeed -= climbBleed * dt;
    if (input.brake) nextSpeed -= 22 * dt;
    if (state.onGround) nextSpeed -= 6 * dt; // rolling resistance
    state.speed = Math.max(0, nextSpeed);

    // Lift: enough speed and the wing holds the nose's climb; too slow and
    // the plane sinks no matter what the stick says.
    const flying = state.speed > PLANE.stallSpeed;
    state.stalled = !flying && !state.onGround && state.speed < PLANE.stallSpeed - 4;
    let vs = state.speed * Math.sin(state.pitch * DEG);
    if (!flying) vs -= (PLANE.stallSpeed - state.speed) * 0.55 + PLANE.sinkRate * 0.4;
    if (state.onGround && state.speed < PLANE.stallSpeed) vs = 0;
    state.vspeed = vs;

    // Move.
    const hRad = state.heading * DEG;
    const fx = Math.sin(hRad);
    const fz = -Math.cos(hRad); // heading 0 is north (-Z), 90 is east (+X)
    state.pos.x += fx * state.speed * Math.cos(state.pitch * DEG) * dt;
    state.pos.z += fz * state.speed * Math.cos(state.pitch * DEG) * dt;
    state.pos.y += state.vspeed * dt;
    if (!state.onGround) state.airTime += dt;

    // Leaving the island: the wind nudges the nose back toward home. The
    // nudge is gentle and proportional, so it never fights a hard turn.
    if (Math.hypot(state.pos.x, state.pos.z) > WORLD_EDGE) {
      const home = (Math.atan2(-state.pos.x, state.pos.z) * 180) / Math.PI + 180;
      let diff = ((home - state.heading + 540) % 360) - 180;
      state.heading = (state.heading + Math.max(-12, Math.min(12, diff * 0.15)) * dt + 360) % 360;
    }

    // Take-off: enough speed on the ground and the wing lifts.
    if (state.onGround && state.speed > PLANE.stallSpeed && state.pitch > 2) {
      state.onGround = false;
      state.landed = false; // a later landing can count again
    }

    // Ground contact. A plane that was already rolling stays rolling: only
    // a touchdown out of the air is judged as a landing or a crash, so
    // taxiing with the stick over never shreds the airframe step by step.
    const ground = heightAt(state.pos.x, state.pos.z);
    const clearance = state.pos.y - ground;
    const wasAirborne = !state.onGround;
    if (clearance <= GEAR_HEIGHT) {
      const hard = state.vspeed < -5 || Math.abs(state.roll) > 28 || state.speed > 62;
      const onStrip = overRunway(state.pos.x, state.pos.z);
      if (isWater(state.pos.x, state.pos.z)) {
        return events | EVENT_CRASH; // ditching in the sea or the lake
      }
      if (!wasAirborne) {
        state.pos.y = ground + GEAR_HEIGHT;
        state.vspeed = 0;
        state.onGround = true;
        return events;
      }
      if (onStrip && !hard && state.speed > 18) {
        // A good landing: roll out on the strip.
        state.pos.y = ground + GEAR_HEIGHT;
        state.vspeed = 0;
        state.pitch = 0;
        state.roll = approach(state.roll, 0, 120, dt);
        state.onGround = true;
        state.speed = Math.max(0, state.speed - 26 * dt);
        if (state.airTime > 5 && !state.landed) {
          state.landed = true;
          return events | EVENT_LANDED;
        }
        return events;
      }
      if (hard) {
        state.damage = Math.min(PLANE.maxDamage, state.damage + PLANE.damagePerHardLanding);
        if (state.damage >= PLANE.maxDamage || state.vspeed < -11) return events | EVENT_CRASH;
        // A survivable bounce: lose speed, stay down, keep rolling.
        state.pos.y = ground + GEAR_HEIGHT;
        state.vspeed = 0;
        state.speed *= 0.45;
        state.onGround = true;
        return events | EVENT_SCRAPE;
      }
      // A gentle touch on rough ground: roll, don't crash.
      state.pos.y = ground + GEAR_HEIGHT;
      state.vspeed = 0;
      state.onGround = true;
      state.speed = Math.max(0, state.speed - 18 * dt);
    } else if (clearance < 12 && state.speed > 10) {
      // Tree strike: close to the ground through the forest.
      for (let i = 0; i < terrain.treeSpots.length; i += 1) {
        const t = terrain.treeSpots[i];
        const dx = state.pos.x - t.x;
        const dz = state.pos.z - t.z;
        if (dx * dx + dz * dz < 12 && state.pos.y < t.h + 11) {
          state.damage = Math.min(PLANE.maxDamage, state.damage + PLANE.damagePerScrape);
          if (state.damage >= PLANE.maxDamage) return events | EVENT_CRASH;
          return events | EVENT_SCRAPE;
        }
      }
    }
    if (state.stalled) events |= EVENT_STALL;
    return events;
  }

  /** Lose one airframe and put the plane back at the last safe place. */
  function respawn(pose) {
    state.lives -= 1;
    const p = pose ?? startPose();
    state.pos.set(p.x, p.y, p.z);
    state.heading = p.heading;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.vspeed = 0;
    state.throttle = 0;
    state.fuel = PLANE.fuelCapacity;
    state.damage = 0;
    state.rpm = 0;
    state.onGround = true;
    state.landed = false;
    state.airTime = 0;
    state.onBeam = false;
  }

  reset();
  return { state, reset, step, respawn, overRunway };
}
