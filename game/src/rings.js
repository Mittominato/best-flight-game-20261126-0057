// The ring course: eight glowing gates over the island, flown in order, then
// the landing. Rings are torus meshes that face the direction of travel; the
// next one pulses green, the rest amber, passed ones go dim. Passing a ring
// is a distance check against its centre, so it works the same in the game
// and in the screenshot autopilot.
import * as THREE from 'three';
import { PALETTE, RINGS, SCORE } from './config.js';

const RING_MATERIAL = new THREE.MeshBasicMaterial({
  color: PALETTE.ring, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
});
const NEXT_MATERIAL = new THREE.MeshBasicMaterial({
  color: PALETTE.ringNext, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
});
const DONE_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0x5a6a72, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
});

export function createRings(scene) {
  const group = new THREE.Group();
  const meshes = RINGS.map((ring, i) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(ring.r, 1.1, 10, 40), RING_MATERIAL.clone());
    mesh.position.set(ring.x, ring.y, ring.z);
    // Face the ring toward the previous ring, so the pilot flies through it.
    const prev = RINGS[(i + RINGS.length - 1) % RINGS.length];
    mesh.lookAt(prev.x, prev.y, prev.z);
    group.add(mesh);
    // A small floating label post under each ring, so the course reads from afar.
    if (ring.fuel) {
      const drum = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 3.4, 12),
        new THREE.MeshStandardMaterial({ color: 0x37e08b, roughness: 0.5 }),
      );
      drum.position.set(ring.x, ring.y - ring.r - 8, ring.z);
      group.add(drum);
    }
    return mesh;
  });
  scene.add(group);

  const state = {
    next: 0, // index of the next ring to fly through
    passed: 0,
    score: 0,
    fuelStops: 0,
    done: false,
  };

  function reset() {
    state.next = 0;
    state.passed = 0;
    state.score = 0;
    state.fuelStops = 0;
    state.done = false;
    refresh();
  }

  function refresh() {
    meshes.forEach((mesh, i) => {
      if (i < state.next) mesh.material = DONE_MATERIAL;
      else if (i === state.next) mesh.material = NEXT_MATERIAL;
      else mesh.material = RING_MATERIAL;
    });
  }

  /** The ring the pilot should aim for, or null when the course is done. */
  function target() {
    return state.next < RINGS.length ? RINGS[state.next] : null;
  }

  /**
   * Check the plane's position against the next ring. Returns the ring that
   * was just passed, or null. Passing needs the plane inside the ring's disc.
   */
  function check(pos) {
    const ring = target();
    if (!ring) return null;
    const dx = pos.x - ring.x;
    const dy = pos.y - ring.y;
    const dz = pos.z - ring.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > ring.r * 0.9) return null;
    state.next += 1;
    state.passed += 1;
    state.score += SCORE.ring + (ring.fuel ? SCORE.fuelRing : 0);
    if (ring.fuel) state.fuelStops += 1;
    if (state.next >= RINGS.length) state.done = true;
    refresh();
    return ring;
  }

  /** Pulse the next ring so it is easy to find against the sky. */
  function update(time) {
    const mesh = meshes[state.next];
    if (!mesh) return;
    const s = 1 + Math.sin(time * 4) * 0.05;
    mesh.scale.set(s, s, 1);
  }

  reset();
  return { state, reset, target, check, update, meshes };
}
