// The scene: renderer, sky dome, sun, fog and the two cameras — a chase
// camera that follows the plane and a cockpit camera from the pilot's seat
// with a lit instrument panel. The renderer owns no game rules; it only
// shows where the plane is and what it is doing.
import * as THREE from 'three';
import { PALETTE, WORLD } from './config.js';

const DEG = Math.PI / 180;

/** A vertical gradient sky painted on a canvas, wrapped on a dome. */
function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2f6fb4');
  grad.addColorStop(0.45, '#7fb0d8');
  grad.addColorStop(0.72, '#c3d6e2');
  grad.addColorStop(1, '#e8e2cf');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The cockpit panel: six dials drawn on a canvas, lit amber on dark. */
function createPanelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, texture };
}

function drawPanel(canvas, flight, rings) {
  const ctx = canvas.getContext('2d');
  const W = 512;
  const H = 128;
  ctx.fillStyle = '#10181d';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#2c3a42';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, W - 4, H - 4);
  const dials = [
    { x: 52, label: 'KT', value: flight.speed * 1.944, max: 180 },
    { x: 140, label: 'FT', value: Math.max(0, flight.pos.y - 6) * 3.28, max: 3000 },
    { x: 228, label: 'HDG', value: flight.heading, max: 360 },
    { x: 316, label: 'THR', value: flight.throttle * 100, max: 100 },
    { x: 404, label: 'FUEL', value: flight.fuel, max: 100 },
    { x: 470, label: 'RING', value: rings.passed, max: 8 },
  ];
  ctx.textAlign = 'center';
  for (const d of dials) {
    ctx.beginPath();
    ctx.arc(d.x, 56, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#0a1216';
    ctx.fill();
    ctx.strokeStyle = '#ffb454';
    ctx.lineWidth = 2;
    ctx.stroke();
    const frac = Math.min(1, d.value / d.max);
    const angle = -Math.PI * 0.75 + frac * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(d.x, 56);
    ctx.lineTo(d.x + Math.cos(angle) * 32, 56 + Math.sin(angle) * 32);
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#9fb4c0';
    ctx.font = 'bold 13px ui-monospace, Menlo, monospace';
    ctx.fillText(d.label, d.x, 116);
    ctx.fillStyle = '#eef3f6';
    ctx.font = 'bold 15px ui-monospace, Menlo, monospace';
    ctx.fillText(String(Math.round(d.value)), d.x, 62);
  }
}

export function createRenderer(canvas, plane) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.fog, 900, 3200);

  // Sky dome and sun disc.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(4200, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(110, 24),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.set(-1800, 1500, -2600);
  sun.lookAt(0, 0, 0);
  scene.add(sun);

  // Light: a warm sun with shadows and a cool sky fill.
  const sunLight = new THREE.DirectionalLight(0xfff2cf, 2.6);
  sunLight.position.set(-900, 1200, -700);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  const sc = sunLight.shadow.camera;
  sc.left = -160;
  sc.right = 160;
  sc.top = 160;
  sc.bottom = -160;
  sc.near = 100;
  sc.far = 3200;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0xbfd9ea, 0x5d6b4a, 0.9));

  // The chase and cockpit cameras.
  const chase = new THREE.PerspectiveCamera(62, 1, 0.5, 9000);
  const cockpit = new THREE.PerspectiveCamera(74, 1, 0.1, 9000);
  scene.add(chase, cockpit);

  // Cockpit furniture: a dashboard with the lit panel and two side struts.
  const panel = createPanelTexture();
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.9, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x141c20, roughness: 0.8 }),
  );
  const panelFace = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.8),
    new THREE.MeshBasicMaterial({ map: panel.texture }),
  );
  panelFace.position.set(0, 0, -0.26);
  dash.add(panelFace);
  const cockpitGroup = new THREE.Group();
  cockpitGroup.add(dash);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 2.2, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x2e3a45, roughness: 0.6 }),
    );
    strut.position.set(side * 1.5, 0.9, -0.6);
    strut.rotation.x = -0.35;
    cockpitGroup.add(strut);
  }
  cockpit.add(cockpitGroup);
  dash.position.set(0, -0.75, -2.1);

  // Camera smoothing state. The chase camera starts on the plane, not at
  // the world origin, so the first frame already frames the aircraft.
  const chasePos = new THREE.Vector3(0, 30, 60);
  const lookAt = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const tmpE = new THREE.Euler();
  let panelTimer = 0;
  let firstFrame = true;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    chase.aspect = w / h;
    cockpit.aspect = w / h;
    chase.updateProjectionMatrix();
    cockpit.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    scene,
    /** Move the cameras for this frame; `mode` is 'chase' or 'cockpit'. */
    update(flight, mode, dt, rings) {
      const f = flight;
      // The plane mesh follows the flight state exactly.
      tmpE.set(-f.pitch * DEG, (f.heading * DEG) - Math.PI, f.roll * DEG, 'YXZ');
      tmpQ.setFromEuler(tmpE);
      plane.position.copy(f.pos);
      plane.quaternion.copy(tmpQ);

      if (mode === 'cockpit') {
        // Pilot's seat: just behind the windscreen, looking along the nose.
        tmpV.set(0, 0.55, 0.4).applyQuaternion(tmpQ).add(f.pos);
        cockpit.position.copy(tmpV);
        cockpit.quaternion.copy(tmpQ);
        panelTimer -= dt;
        if (panelTimer <= 0) {
          panelTimer = 0.2;
          drawPanel(panel.canvas, f, rings.state);
          panel.texture.needsUpdate = true;
        }
        renderer.render(scene, cockpit);
      } else {
        // Chase: behind and above the tail, easing toward its slot so the
        // camera never snaps when the plane banks.
        const back = 26 + f.speed * 0.14;
        const up = 7 + f.speed * 0.03;
        tmpV.set(0, up, back).applyQuaternion(tmpQ).add(f.pos);
        if (firstFrame) {
          chasePos.copy(tmpV);
          tmpV2.set(0, 1.5, -18).applyQuaternion(tmpQ).add(f.pos);
          lookAt.copy(tmpV2);
          firstFrame = false;
        }
        chasePos.lerp(tmpV, 1 - Math.exp(-5.5 * dt));
        chase.position.copy(chasePos);
        tmpV2.set(0, 1.5, -18).applyQuaternion(tmpQ).add(f.pos);
        lookAt.lerp(tmpV2, 1 - Math.exp(-7 * dt));
        chase.lookAt(lookAt);
        renderer.render(scene, chase);
      }
    },
    /** The cockpit panel shows the live numbers; call with the ring state. */
    updatePanel(flight, rings) {
      drawPanel(panel.canvas, flight, rings.state);
      panel.texture.needsUpdate = true;
    },
    dispose() {
      renderer.dispose();
    },
  };
}
