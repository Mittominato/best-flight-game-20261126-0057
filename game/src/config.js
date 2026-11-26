// Copperwing Ridge Run — every tuning number and colour in one place.
// Units are metres, metres per second and degrees. The island is 2400 m
// across, centred on the origin; the airstrip sits on the south coast.
/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const WORLD = {
  size: 2400,
  half: 1200,
  seaLevel: 0,
  maxHeight: 260,
  segments: 128,
};

export const RUNWAY = {
  // Flat strip on the south coast, heading east (090).
  x: 0,
  z: 880,
  heading: 90,
  length: 420,
  width: 30,
  elevation: 6,
};

export const PLANE = {
  cruiseSpeed: 62, // m/s at full throttle, level
  maxSpeed: 85,
  stallSpeed: 24, // below this the wing stops flying
  climbRate: 9, // m/s at full throttle, nose up
  sinkRate: 7, // m/s gliding with the engine out
  rollRate: 95, // deg/s at full stick
  pitchRate: 55,
  turnRate: 34, // deg/s of heading at a 45 deg bank
  throttleRate: 0.55, // per second holding the key
  drag: 0.12,
  fuelCapacity: 100,
  fuelBurn: 0.55, // per second at full throttle
  fuelRefill: 100, // the fuel ring tops the tank up
  damagePerHardLanding: 34,
  damagePerScrape: 22,
  maxDamage: 100,
};

export const LIVES = 3;

/** The ring course: each ring's centre, radius and the message shown passing it. */
export const RINGS = [
  { x: 0, y: 70, z: 620, r: 16, note: 'Ring 1 — off the strip' },
  { x: -260, y: 95, z: 260, r: 16, note: 'Ring 2 — over the lake' },
  { x: -520, y: 130, z: -120, r: 15, note: 'Ring 3 — valley run' },
  { x: -380, y: 170, z: -520, r: 15, note: 'Ring 4 — ridge climb' },
  { x: 60, y: 200, z: -640, r: 15, note: 'Ring 5 — fuel stop', fuel: true },
  { x: 480, y: 150, z: -420, r: 15, note: 'Ring 6 — north headland' },
  { x: 640, y: 100, z: 40, r: 16, note: 'Ring 7 — east cliffs' },
  { x: 320, y: 60, z: 560, r: 16, note: 'Ring 8 — final turn' },
];

export const SCORE = {
  ring: 1000,
  fuelRing: 250,
  landing: 2000,
  timeBonusPerSecond: 25, // under the par time
  parSeconds: 240,
  damagePenalty: 10, // per point of damage at landing
};

export const PALETTE = {
  skyTop: 0x2f6fb4,
  skyBottom: 0xbfd9ea,
  sun: 0xfff2cf,
  fog: 0xc3d6e2,
  sea: 0x2e6f8e,
  sand: 0xd9c28f,
  grass: 0x5d8a4a,
  forest: 0x3d6b34,
  rock: 0x8a7f74,
  snow: 0xe8edf0,
  lake: 0x3f7d9e,
  runway: 0x484d54,
  runwayLine: 0xf2f0e6,
  planeBody: 0xc96a2e, // copper orange
  planeTrim: 0x2e3a45,
  planeGlass: 0x9fc4d4,
  ring: 0xffc53d,
  ringNext: 0x37e08b,
  hudAmber: '#ffb454',
  hudGreen: '#7be495',
  hudRed: '#ff6b5e',
  hudInk: '#eef3f6',
  hudMuted: '#9fb4c0',
  panel: 'rgba(10, 18, 24, 0.72)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_READOUT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'copperwing-ridge-run.best';
