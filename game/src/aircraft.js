// The Copperwing: a small high-wing bush plane built from primitives, so the
// aircraft the screenshots show is our own model. Forward is -Z in local
// space (three.js convention): nose at -Z, tail at +Z, wings along X.
import * as THREE from 'three';
import { PALETTE } from './config.js';

function mat(color, roughness = 0.55, metalness = 0.25) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function createAircraft() {
  const group = new THREE.Group();
  const body = mat(PALETTE.planeBody);
  const trim = mat(PALETTE.planeTrim, 0.5, 0.4);
  const glass = new THREE.MeshStandardMaterial({
    color: PALETTE.planeGlass, roughness: 0.15, metalness: 0.4,
  });

  // Fuselage: a tapered body, nose to tail.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.55, 7.4, 12), body);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0, 0.4);
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), body);
  nose.scale.set(1, 1, 0.7);
  nose.position.set(0, 0, -3.2);
  group.add(nose);
  // Belly stripe and tail cone.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 6.4), trim);
  stripe.position.set(0, -0.72, 0.4);
  group.add(stripe);
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.16, 2.6, 10), body);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.set(0, 0.35, 5.2);
  group.add(tailCone);

  // Cabin glass: two windscreens and side windows.
  const windscreen = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 1.7), glass);
  windscreen.position.set(0, 0.62, -1.15);
  windscreen.rotation.x = -0.18;
  group.add(windscreen);
  const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.28, 2.2), body);
  cabinRoof.position.set(0, 1.12, -0.9);
  group.add(cabinRoof);

  // High wing with a slight dihedral, plus struts down to the fuselage.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.28, 2.3), body);
  wing.position.set(0, 1.28, -0.6);
  wing.rotation.z = 0.02;
  group.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 2.3), trim);
  wingTipL.position.set(-6.55, 1.3, -0.6);
  group.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 6.55;
  group.add(wingTipR);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), trim);
    strut.position.set(side * 1.9, 0.35, -0.6);
    strut.rotation.z = side * 0.5;
    group.add(strut);
  }

  // Tail: horizontal stabiliser and a tall fin with the copper flash.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.2, 1.4), body);
  stab.position.set(0, 0.62, 5.6);
  group.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 1.9), body);
  fin.position.set(0, 1.5, 5.7);
  fin.rotation.x = 0.18;
  group.add(fin);
  const finFlash = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.1, 1.2), trim);
  finFlash.position.set(0, 1.9, 5.85);
  finFlash.rotation.x = 0.18;
  group.add(finFlash);

  // Propeller: spinner cone plus two blades on a hub that spins.
  const prop = new THREE.Group();
  prop.position.set(0, 0, -4.05);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 12), trim);
  spinner.rotation.x = -Math.PI / 2;
  prop.add(spinner);
  const bladeGeo = new THREE.BoxGeometry(0.34, 3.4, 0.12);
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(bladeGeo, trim);
    blade.rotation.z = angle;
    prop.add(blade);
  }
  group.add(prop);
  // A faint blurred disc that fades in with RPM, so the prop reads as spinning.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.85, 24),
    new THREE.MeshBasicMaterial({
      color: 0x222222, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  disc.position.set(0, 0, -4.0);
  group.add(disc);

  // Fixed landing gear: two main wheels and a tail wheel.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.7, 6), trim);
    leg.position.set(side * 1.15, -1.35, -1.1);
    leg.rotation.z = side * 0.35;
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12), mat(0x1c1c1c, 0.9, 0));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.45, -2.1, -1.1);
    group.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.24, 10), mat(0x1c1c1c, 0.9, 0));
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.75, 5.9);
  group.add(tailWheel);

  // Navigation lights: red left, green right, white tail — small emissive bulbs.
  function navLight(color, x, y, z) {
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color }),
    );
    light.position.set(x, y, z);
    group.add(light);
    return light;
  }
  navLight(0xff2a1a, -6.7, 1.3, -0.6);
  navLight(0x2aff66, 6.7, 1.3, -0.6);
  navLight(0xffffff, 0, 0.6, 6.6);

  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  group.userData.prop = prop;
  group.userData.disc = disc;
  return group;
}

/** Spin the prop to match the engine RPM (0..1) and fade the blur disc in. */
export function updateAircraft(plane, rpm, dt) {
  const prop = plane.userData.prop;
  prop.rotation.z += rpm * 42 * dt;
  plane.userData.disc.material.opacity = rpm * 0.22;
}
