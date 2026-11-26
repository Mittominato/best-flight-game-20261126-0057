// A small seeded random number generator (mulberry32): the same seed gives
// the same island, the same ring course and the same screenshots.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 2D value noise in [0, 1): smooth hills from a hashed grid. */
export function createNoise(seed) {
  const rand = createRandom(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) base[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < 512; i += 1) perm[i] = base[i & 255];

  function hash(ix, iz) {
    return perm[(perm[ix & 255] + iz) & 255] / 255;
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  return function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const a = hash(ix, iz);
    const b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1);
    const d = hash(ix + 1, iz + 1);
    const u = smooth(fx);
    const v = smooth(fz);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Fractal noise: several octaves of value noise, still in [0, 1). */
export function createFractalNoise(seed, octaves) {
  const layers = [];
  for (let i = 0; i < octaves; i += 1) layers.push(createNoise(seed + i * 101));
  return function fbm(x, z) {
    let sum = 0;
    let amp = 0.5;
    let total = 0;
    for (let i = 0; i < octaves; i += 1) {
      const f = 2 ** i;
      sum += layers[i](x * f, z * f) * amp;
      total += amp;
      amp *= 0.5;
    }
    return sum / total;
  };
}
