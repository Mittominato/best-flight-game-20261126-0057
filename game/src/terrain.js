// The island: one height function shared by the mesh, the flight model and
// the screenshots, so the ground the plane flies over is the ground it can
// hit. Copperwing Island is a 2400 m island with a lake valley, a ridge
// across the north, a beach ring and a flat airstrip on the south coast.
import * as THREE from 'three';
import { PALETTE, RUNWAY, WORLD } from './config.js';
import { createFractalNoise, createRandom } from './random.js';

const fbm = createFractalNoise(1337, 4);

/** Smoothstep helper: 0 below a, 1 above b. */
export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Height of the island at world (x, z), in metres above sea level. */
export function heightAt(x, z) {
  const r = Math.hypot(x, z) / WORLD.half;
  const island = 1 - smoothstep(0.62, 1.02, r); // falls to the sea at the edge
  if (island <= 0) return -6;
  // Rolling hills.
  let h = (fbm(x * 0.0016 + 7.3, z * 0.0016 + 2.9) - 0.42) * 150;
  // The north ridge: a long mountain spine across the top of the island.
  const ridgeD = Math.abs(z + 560) / 260 + Math.abs(x) / 1300;
  h += Math.max(0, 1 - ridgeD) * 190;
  // A second, lower hill mass in the south-west.
  const swD = Math.hypot(x + 620, z - 420) / 420;
  h += Math.max(0, 1 - swD) * 70;
  h = Math.max(2, h) * island;
  // The lake valley: a bowl around (-260, 260) flattened to just above the water.
  const lakeD = Math.hypot(x + 260, z - 260) / 260;
  const lake = 1 - smoothstep(0.55, 1, lakeD);
  h = h * (1 - lake) + 2.5 * lake;
  // The airstrip is graded flat, with a wide flat bowl around it so the
  // departure and the final approach never meet a hillside.
  const ex = Math.abs(x - RUNWAY.x) / 420;
  const ez = Math.abs(z - RUNWAY.z) / 280;
  const strip = 1 - smoothstep(0.65, 1, Math.hypot(ex, ez));
  h = h * (1 - strip) + RUNWAY.elevation * strip;
  return h;
}

/** Is this point open water (sea or lake)? */
export function isWater(x, z) {
  if (Math.hypot(x, z) / WORLD.half > 0.98) return true;
  const lakeD = Math.hypot(x + 260, z - 260) / 260;
  return lakeD < 0.62 && heightAt(x, z) < 3.2;
}

function colourFor(x, z, h, slope) {
  const c = new THREE.Color();
  if (h < 4.5) c.setHex(PALETTE.sand);
  else if (h > 205) c.setHex(PALETTE.snow);
  else if (h > 120 || slope > 0.55) c.setHex(PALETTE.rock);
  else {
    c.setHex(PALETTE.grass);
    // Forest patches: darker green where the noise says so.
    const f = fbm(x * 0.004 + 31, z * 0.004 + 17);
    if (f > 0.56) c.setHex(PALETTE.forest);
  }
  // Gentle variation so the ground never reads as flat colour.
  const v = 0.92 + fbm(x * 0.02 + 3, z * 0.02 + 11) * 0.16;
  c.multiplyScalar(v);
  return c;
}

/** Build the terrain mesh, sea, lake, trees, clouds, runway and lighthouse. */
export function createTerrain(scene) {
  const group = new THREE.Group();
  const rand = createRandom(20261126);

  // --- Ground mesh -------------------------------------------------------
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, WORLD.segments, WORLD.segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const hx = heightAt(x + 4, z) - heightAt(x - 4, z);
    const hz = heightAt(x, z + 4) - heightAt(x, z - 4);
    const slope = Math.hypot(hx, hz) / 8;
    tmp.copy(colourFor(x, z, h, slope));
    colours[i * 3] = tmp.r;
    colours[i * 3 + 1] = tmp.g;
    colours[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  );
  ground.receiveShadow = true;
  group.add(ground);

  // --- Sea and lake ------------------------------------------------------
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size * 3, WORLD.size * 3),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.15 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0.4;
  group.add(sea);
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(165, 40),
    new THREE.MeshStandardMaterial({ color: PALETTE.lake, roughness: 0.2, metalness: 0.15 }),
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(-260, 2.4, 260);
  group.add(lake);

  // --- Trees -------------------------------------------------------------
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 340 && guard < 6000) {
    guard += 1;
    const x = (rand() * 2 - 1) * (WORLD.half - 60);
    const z = (rand() * 2 - 1) * (WORLD.half - 60);
    const h = heightAt(x, z);
    if (h < 7 || h > 110) continue;
    if (Math.abs(x - RUNWAY.x) < RUNWAY.length / 2 + 80 && Math.abs(z - RUNWAY.z) < 130) continue;
    if (Math.hypot(x + 260, z - 260) < 200) continue;
    treeSpots.push({ x, z, h, s: 0.8 + rand() * 0.7 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const leafGeo = new THREE.ConeGeometry(3.4, 11, 7);
  const leafMat = new THREE.MeshStandardMaterial({ color: PALETTE.forest, roughness: 0.9 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeSpots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  treeSpots.forEach((t, i) => {
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    m.compose(new THREE.Vector3(t.x, t.h + 2.2 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
    trunks.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(t.x, t.h + (5 + 5.5) * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
    leaves.setMatrixAt(i, m);
  });
  trunks.castShadow = true;
  leaves.castShadow = true;
  group.add(trunks, leaves);

  // --- Runway ------------------------------------------------------------
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.length, 0.6, RUNWAY.width),
    new THREE.MeshStandardMaterial({ color: PALETTE.runway, roughness: 0.9 }),
  );
  strip.position.set(RUNWAY.x, RUNWAY.elevation, RUNWAY.z);
  strip.receiveShadow = true;
  group.add(strip);
  const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.runwayLine });
  for (let d = -RUNWAY.length / 2 + 30; d < RUNWAY.length / 2 - 20; d += 40) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(18, 1.6), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(RUNWAY.x + d, RUNWAY.elevation + 0.35, RUNWAY.z);
    group.add(dash);
  }
  for (const side of [-1, 1]) {
    for (const t of [-0.35, 0, 0.35]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.2), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(RUNWAY.x + side * (RUNWAY.length / 2 - 14), RUNWAY.elevation + 0.35, RUNWAY.z + t * RUNWAY.width);
      group.add(bar);
    }
  }

  // Windsock beside the strip: pole, orange cone, swings with the wind.
  const sockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.35, 14, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6 }),
  );
  sockPole.position.set(RUNWAY.x + 60, RUNWAY.elevation + 7, RUNWAY.z + 34);
  sockPole.castShadow = true;
  group.add(sockPole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 7, 10, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7, side: THREE.DoubleSide }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(RUNWAY.x + 56.5, RUNWAY.elevation + 13.4, RUNWAY.z + 34);
  group.add(sock);

  // A small hangar and fuel drums at the west end of the strip.
  const hangar = new THREE.Mesh(
    new THREE.BoxGeometry(26, 10, 18),
    new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.85 }),
  );
  hangar.position.set(RUNWAY.x - RUNWAY.length / 2 - 24, RUNWAY.elevation + 5, RUNWAY.z - 42);
  hangar.castShadow = true;
  group.add(hangar);
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 26, 12, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x9c8a70, roughness: 0.8 }),
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.set(RUNWAY.x - RUNWAY.length / 2 - 24, RUNWAY.elevation + 10, RUNWAY.z - 42);
  group.add(roof);

  // --- Lighthouse on the east cliffs --------------------------------------
  const lx = 760;
  const lz = 120;
  const lh = heightAt(lx, lz);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4.5, 26, 12),
    new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.7 }),
  );
  tower.position.set(lx, lh + 13, lz);
  tower.castShadow = true;
  group.add(tower);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 3.9, 5, 12),
    new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.7 }),
  );
  band.position.set(lx, lh + 16, lz);
  group.add(band);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lamp.position.set(lx, lh + 27.5, lz);
  group.add(lamp);

  // --- Clouds -------------------------------------------------------------
  const clouds = [];
  const puffGeo = new THREE.SphereGeometry(1, 12, 9);
  const puffMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, transparent: true, opacity: 0.9,
    emissive: 0x8a8f96, emissiveIntensity: 0.55,
  });
  for (let i = 0; i < 14; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const puff = new THREE.Mesh(puffGeo, puffMat);
      const s = 14 + rand() * 22;
      puff.scale.set(s, s * 0.42, s * 0.7);
      puff.position.set((rand() - 0.5) * 60, (rand() - 0.5) * 8, (rand() - 0.5) * 36);
      cloud.add(puff);
    }
    cloud.position.set((rand() * 2 - 1) * 1100, 240 + rand() * 130, (rand() * 2 - 1) * 1100);
    cloud.userData.speed = 2 + rand() * 2.5;
    clouds.push(cloud);
    group.add(cloud);
  }

  scene.add(group);

  return {
    group,
    treeSpots,
    update(dt) {
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > WORLD.half + 120) cloud.position.x = -WORLD.half - 120;
      }
      sock.rotation.y = Math.sin(performance.now() * 0.0004) * 0.25;
    },
  };
}
