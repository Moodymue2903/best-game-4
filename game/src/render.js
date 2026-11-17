// THUNDERHEAD RUN — the renderer. Three.js (vendored ESM) turns the 2D
// simulation into a 3D canyon: the player stays near z = 0, the world
// scrolls toward them, and the chase camera banks with the board.

import * as THREE from 'three';
import { PALETTE, CANYON_HALF } from './config.js';

const C = PALETTE;

function lambert(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, flatShading: false, ...opts });
}

function emissive(color, intensity) {
  return new THREE.MeshBasicMaterial({ color });
}

// 3-stop sunset gradient for the sky: sapphire zenith -> indigo ->
// magenta/amber horizon. A canvas texture fills the screen as the background.
function skyGradientTexture() {
  const cv = document.createElement('canvas');
  cv.width = 4;
  cv.height = 512;
  const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#0e2466');
  gr.addColorStop(0.55, '#2b1d7a');
  gr.addColorStop(0.85, '#ff3b8d');
  gr.addColorStop(1, '#ff9e2c');
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 512);
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const scene = new THREE.Scene();
  scene.background = skyGradientTexture();
  scene.fog = new THREE.Fog(new THREE.Color('#3a2a6e'), 70, 160);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 3.4, 7.5);

  // Lights: soft warm key from above + cool fill + warm pink fill so the
  // clouds read as sunset clouds, not faceted rock.
  const key = new THREE.DirectionalLight(0xfff2cc, 0.9);
  key.position.set(4, 16, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x5ef2ff, 0.5);
  fill.position.set(-8, 4, -6);
  scene.add(fill);
  const pinkFill = new THREE.DirectionalLight(0xff9ecf, 0.6);
  pinkFill.position.set(-6, 8, -2);
  scene.add(pinkFill);
  scene.add(new THREE.AmbientLight(0xffe9c8, 0.85));
  const boardLight = new THREE.PointLight(0x9fefff, 5, 12);
  boardLight.position.set(0, 1.5, 1);
  scene.add(boardLight);

  // Stars: tiny points high in the sky for depth.
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 220; i++) {
    starPos.push((Math.random() - 0.5) * 220, 18 + Math.random() * 60, -60 - Math.random() * 80);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 })));

  // Canyon walls: instanced smooth cloud puffs on both sides, scrolling.
  // (Spheres, not faceted polyhedra: a detail-0 icosahedron has one normal
  // per face, so even smooth shading reads as chunked rock.)
  const blobGeo = new THREE.SphereGeometry(1, 6, 4);
  const blobMat = lambert(0xfff5e0);
  const blobCount = 70;
  const blobs = new THREE.InstancedMesh(blobGeo, blobMat, blobCount);
  blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(blobs);
  const blobData = [];
  const tint = new THREE.Color();
  const palette = [0xfff5e0, 0xfff5e0, 0xffe9b8, 0xffd9a0, 0xffc53d, 0xff9ecf];
  for (let i = 0; i < blobCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    blobData.push({
      side,
      x: side * (12 + Math.random() * 9),
      y: -2 + Math.random() * 11,
      z: 8 - Math.random() * 100,
      s: 1.8 + Math.random() * 2.6,
      tint: palette[i % palette.length],
    });
  }
  const dummy = new THREE.Object3D();

  // Cloud floor the board surfs above.
  const floorBlobs = new THREE.InstancedMesh(blobGeo, lambert(0xffe9b8), 40);
  floorBlobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(floorBlobs);
  const floorData = [];
  for (let i = 0; i < 40; i++) {
    floorData.push({ x: -16 + Math.random() * 32, y: -5.5 - Math.random() * 1.5, z: 8 - Math.random() * 100, s: 2 + Math.random() * 2 });
  }

  // Cyan energy rails: glowing streaks along the canyon floor so the
  // board's path pops with colour even in a thumbnail.
  const railMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.55 });
  const rails = [];
  for (let i = 0; i < 6; i++) {
    const rail = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 26), railMat);
    rail.rotation.x = -Math.PI / 2;
    rail.position.set(-7.5 + i * 3, -4.6, 8 - i * 16);
    scene.add(rail);
    rails.push(rail);
  }

  // The player: chunky gold-and-cyan hoverboard + cyan rider.
  const player = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 2.5), lambert(0xffc53d));
  board.position.y = 0.35;
  player.add(board);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 2.3), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
  glow.position.y = 0.24;
  player.add(glow);
  const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 8), lambert(0x5ef2ff));
  rider.position.y = 1.25;
  player.add(rider);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), lambert(0xffc53d));
  helmet.position.y = 2.05;
  player.add(helmet);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.2), new THREE.MeshBasicMaterial({ color: 0x0a1030 }));
  visor.position.set(0, 2.05, -0.3);
  player.add(visor);
  scene.add(player);
  player.scale.setScalar(1.2); // the rider is the protagonist: it must read as a character, not a dot

  // Exhaust trail: a fading line of cyan points behind the board.
  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array(24 * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0x5ef2ff, transparent: true, opacity: 0.8 }));
  trail.frustumCulled = false;
  scene.add(trail);
  const trailPoints = [];

  // Gold twin of the exhaust trail: cyan + gold ribbon behind the board.
  const trailGoldGeo = new THREE.BufferGeometry();
  trailGoldGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
  const trailGold = new THREE.Line(trailGoldGeo, new THREE.LineBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.7 }));
  trailGold.frustumCulled = false;
  scene.add(trailGold);

  // Lightning sweep warning plane + strike bolt.
  const warnMat = new THREE.MeshBasicMaterial({ color: 0xff4d5e, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
  const warn = new THREE.Mesh(new THREE.PlaneGeometry(3, 14), warnMat);
  warn.position.set(0, 4, -10);
  warn.visible = false;
  scene.add(warn);
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 3), 3));
  const bolt = new THREE.Line(boltGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
  bolt.visible = false;
  bolt.frustumCulled = false;
  scene.add(bolt);

  // Zap arc: jagged line from the board to the zap point.
  const zapGeo = new THREE.BufferGeometry();
  zapGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(7 * 3), 3));
  const zapLine = new THREE.Line(zapGeo, new THREE.LineBasicMaterial({ color: 0x5ef2ff }));
  zapLine.visible = false;
  zapLine.frustumCulled = false;
  scene.add(zapLine);
  const zapLight = new THREE.PointLight(0x5ef2ff, 0, 25);
  scene.add(zapLight);

  const world = {
    renderer, scene, camera, blobs, blobData, floorBlobs, floorData, rails,
    player, board, rider, trail, trailGeo, trailPoints, trailGold, trailGoldGeo,
    warn, bolt, zapLine, zapLight, boardLight, dummy, tint,
    meshes: new Map(), titan: null, time: 0, shake: 0,
  };
  return world;
}

function gateMesh(mult) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.2, 10, 28), new THREE.MeshBasicMaterial({ color: mult > 1 ? 0xffd23f : 0x2ecc71 }));
  g.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.07, 8, 28), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.7 }));
  g.add(inner);
  return g;
}

function crowMesh(shielded, brute) {
  const g = new THREE.Group();
  const bodyColor = brute ? 0x2a2f3e : 0xff2e93;
  const scale = brute ? 1.9 : 1;
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.42 * scale, 1.3 * scale, 6), lambert(bodyColor));
  body.rotation.x = -Math.PI / 2;
  g.add(body);
  const wingGeo = new THREE.BoxGeometry(1.1 * scale, 0.08, 0.5 * scale);
  const wingMat = lambert(brute ? 0x1a1a26 : 0xc40e6e);
  const wl = new THREE.Mesh(wingGeo, wingMat);
  wl.position.set(-0.7 * scale, 0.1, 0);
  const wr = new THREE.Mesh(wingGeo, wingMat);
  wr.position.set(0.7 * scale, 0.1, 0);
  g.add(wl, wr);
  g.userData = { wl, wr, flap: Math.random() * 6 };
  if (shielded) {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), new THREE.MeshBasicMaterial({ color: 0x5ef2ff, transparent: true, opacity: 0.35 }));
    g.add(bubble);
  }
  if (brute) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    eye.position.set(0, 0.25, -0.6);
    g.add(eye);
  }
  if (!brute) g.scale.setScalar(1.8); // crows must read as a threat, not a speck
  return g;
}

function whaleMesh() {
  const g = new THREE.Group();
  // Long axis across the frame (x), so the whale reads as a whale from the
  // chase camera instead of a circle seen from behind.
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), lambert(0xfff5e0));
  body.scale.set(2.6, 0.9, 1.1);
  g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), lambert(0xffd166));
  belly.scale.set(2.2, 0.55, 0.9);
  belly.position.y = -0.45;
  g.add(belly);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 4), lambert(0x00e5ff));
  fin.position.set(0.3, 0.95, 0);
  g.add(fin);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 4), lambert(0xfff5e0));
  tail.rotation.z = -Math.PI / 2;
  tail.position.x = 2.8;
  g.add(tail);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x0a1030 }));
  eye.position.set(-1.6, 0.3, 0.55);
  g.add(eye);
  g.scale.setScalar(1.8);
  return g;
}

function orbMesh() {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: 0x5ef2ff }));
  return m;
}

function gapMesh() {
  const m = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), new THREE.MeshBasicMaterial({ color: 0x05070f }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = -3.4;
  return m;
}

function titanMesh() {
  const g = new THREE.Group();
  const main = new THREE.Mesh(new THREE.IcosahedronGeometry(4.2, 1), lambert(0x6a4a9e));
  main.scale.set(1.25, 1, 1);
  g.add(main);
  const brow = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), lambert(0x4a3572));
  brow.position.set(-2.5, 2.2, 1.5);
  g.add(brow);
  // Eyes and weak points sit on the FRONT face (+z, toward the camera):
  // on the far side they were occluded by the Titan's own body.
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2e4d }));
  eyeL.position.set(-1.2, 0.8, 3.8);
  const eyeR = eyeL.clone();
  eyeR.position.x = 1.2;
  g.add(eyeL, eyeR);
  g.userData.weak = [];
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    g.add(w);
    g.userData.weak.push(w);
  }
  g.position.set(0, 3.5, -24);
  return g;
}

function syncEntities(world, state) {
  const seen = new Set();
  for (const e of state.entities) {
    seen.add(e);
    let m = world.meshes.get(e);
    if (!m) {
      if (e.kind === 'gate') m = gateMesh(e.mult || 1);
      else if (e.kind === 'crow' || e.kind === 'shielded' || e.kind === 'brute') m = crowMesh(e.kind === 'shielded', e.kind === 'brute');
      else if (e.kind === 'whale') m = whaleMesh();
      else if (e.kind === 'orb') m = orbMesh();
      else if (e.kind === 'gap') m = gapMesh();
      else continue;
      world.meshes.set(e, m);
      world.scene.add(m);
    }
    m.position.set(e.x, e.y + (e.kind === 'gate' ? 1.2 : e.kind === 'orb' ? 1 : 0), e.z);
    if (e.kind === 'crow' || e.kind === 'shielded' || e.kind === 'brute') {
      const u = m.userData;
      u.flap += 0.35;
      u.wl.rotation.z = Math.sin(u.flap) * 0.7;
      u.wr.rotation.z = -Math.sin(u.flap) * 0.7;
      m.rotation.y = Math.PI;
    }
    if (e.kind === 'orb') m.rotation.y += 0.08;
    if (e.kind === 'gate') m.rotation.z += 0.01;
  }
  for (const [e, m] of world.meshes) {
    if (!seen.has(e)) {
      world.scene.remove(m);
      world.meshes.delete(e);
    }
  }
}

/** Advance the world one rendered frame. dt is real seconds. */
export function renderFrame(world, state, dt, camPitch) {
  world.time += dt;
  const t = world.time;
  const speed = state.screen === 'boss' ? 2 : (state.speed || 14);
  const scroll = speed * dt;

  // Canyon walls scroll past and wrap.
  for (let i = 0; i < world.blobData.length; i++) {
    const b = world.blobData[i];
    b.z += scroll;
    if (b.z > 10) b.z -= 108;
    world.dummy.position.set(b.x + Math.sin(t * 0.3 + i) * 0.4, b.y, b.z);
    world.dummy.scale.setScalar(b.s);
    world.dummy.rotation.set(0, t * 0.02 + i, 0);
    world.dummy.updateMatrix();
    world.blobs.setMatrixAt(i, world.dummy.matrix);
    world.tint.setHex(b.tint);
    world.blobs.setColorAt(i, world.tint);
  }
  world.blobs.instanceMatrix.needsUpdate = true;
  if (world.blobs.instanceColor) world.blobs.instanceColor.needsUpdate = true;
  for (let i = 0; i < world.floorData.length; i++) {
    const b = world.floorData[i];
    b.z += scroll;
    if (b.z > 10) b.z -= 108;
    world.dummy.position.set(b.x, b.y, b.z);
    world.dummy.scale.setScalar(b.s);
    world.dummy.rotation.set(0, 0, 0);
    world.dummy.updateMatrix();
    world.floorBlobs.setMatrixAt(i, world.dummy.matrix);
  }
  world.floorBlobs.instanceMatrix.needsUpdate = true;
  for (const rail of world.rails) {
    rail.position.z += scroll;
    if (rail.position.z > 10) rail.position.z -= 108;
  }

  // Player: board banks into the steer, rider bobs, board hovers.
  const p = world.player;
  p.position.set(state.x, state.y + 0.15 + Math.sin(t * 6) * 0.06, 0);
  p.rotation.z = -state.vx * 0.055;
  p.rotation.x = state.vy > 0 ? -0.12 : state.vy < 0 ? 0.1 : 0;
  world.boardLight.position.set(state.x, state.y + 1.5, 1.5);

  // Exhaust trail follows the board.
  world.trailPoints.unshift([state.x, state.y + 0.3, 0.9]);
  if (world.trailPoints.length > 24) world.trailPoints.pop();
  const pos = world.trailGeo.attributes.position.array;
  for (let i = 0; i < 24; i++) {
    const pt = world.trailPoints[Math.min(i, world.trailPoints.length - 1)] || [0, 0, 0];
    pos[i * 3] = pt[0] + (i * 0.02);
    pos[i * 3 + 1] = pt[1];
    pos[i * 3 + 2] = pt[2] + i * 0.55;
  }
  world.trailGeo.attributes.position.needsUpdate = true;
  const gpos = world.trailGoldGeo.attributes.position.array;
  for (let i = 0; i < 24; i++) {
    const pt = world.trailPoints[Math.min(i, world.trailPoints.length - 1)] || [0, 0, 0];
    gpos[i * 3] = pt[0] - 0.15 + (i * 0.02);
    gpos[i * 3 + 1] = pt[1] - 0.12;
    gpos[i * 3 + 2] = pt[2] + i * 0.55;
  }
  world.trailGoldGeo.attributes.position.needsUpdate = true;

  syncEntities(world, state);

  // Titan: build on first boss frame, orbit its weak points.
  if (state.screen === 'boss' && state.boss) {
    if (!world.titan) {
      world.titan = titanMesh();
      world.scene.add(world.titan);
    }
    const b = state.boss;
    world.titan.position.y = 3.5 + Math.sin(t * 0.8) * 0.5;
    world.titan.rotation.y = Math.sin(t * 0.25) * 0.3;
    b.weak.forEach((w, i) => {
      const wm = world.titan.userData.weak[i];
      if (w.dead) { wm.visible = false; return; }
      wm.visible = true;
      wm.position.set(Math.cos(w.angle) * 5.5, Math.sin(w.angle) * 2.2, 3.4);
      const pulse = 0.85 + Math.sin(t * 5 + i * 2) * 0.15;
      wm.scale.setScalar(pulse);
    });
    // Lightning sweep telegraph + strike.
    if (b.sweepState === 'warn') {
      world.warn.visible = true;
      world.warn.position.set(b.sweepX, 4, -10);
      world.warn.material.opacity = 0.2 + Math.sin(t * 20) * 0.12;
      world.bolt.visible = false;
    } else if (b.sweepState === 'strike') {
      world.warn.visible = false;
      world.bolt.visible = true;
      const bp = world.bolt.geometry.attributes.position.array;
      let bx = b.sweepX;
      let by = 12;
      for (let i = 0; i < 9; i++) {
        bp[i * 3] = bx;
        bp[i * 3 + 1] = by;
        bp[i * 3 + 2] = -10;
        bx += (Math.random() - 0.5) * 1.6;
        by -= 1.6;
      }
      world.bolt.geometry.attributes.position.needsUpdate = true;
    } else {
      world.warn.visible = false;
      world.bolt.visible = false;
    }
  } else if (world.titan) {
    world.scene.remove(world.titan);
    world.titan = null;
    world.warn.visible = false;
    world.bolt.visible = false;
  }

  // Zap arc flash.
  if (state.lastZap) {
    world.zapLine.visible = true;
    const zp = world.zapLine.geometry.attributes.position.array;
    const zx = state.lastZap.x;
    const zy = state.lastZap.y + 1;
    const zz = state.lastZap.z;
    for (let i = 0; i < 7; i++) {
      const f = i / 6;
      zp[i * 3] = state.x + (zx - state.x) * f + (i > 0 && i < 6 ? (Math.random() - 0.5) * 1.2 : 0);
      zp[i * 3 + 1] = 1 + (zy - 1) * f + (i > 0 && i < 6 ? (Math.random() - 0.5) * 1.2 : 0);
      zp[i * 3 + 2] = 0 + (zz - 0) * f;
    }
    world.zapLine.geometry.attributes.position.needsUpdate = true;
    world.zapLight.position.set(zx, zy, zz + 4);
    world.zapLight.intensity = 30;
  } else {
    world.zapLine.visible = false;
    world.zapLight.intensity = 0;
  }

  // Chase camera: follows the board, banks slightly, pitches with the mouse.
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 3);
  const sh = world.shake;
  const shx = sh > 0 ? (Math.random() - 0.5) * sh * 0.5 : 0;
  const shy = sh > 0 ? (Math.random() - 0.5) * sh * 0.5 : 0;
  world.camera.position.set(state.x * 0.55 + shx, 3.9 + state.y * 0.55 + (camPitch || 0) + shy, 8.6);
  world.camera.lookAt(state.x * 0.8, 1.3 + state.y * 0.5, -12);
  world.camera.rotation.z += -state.vx * 0.012;

  world.renderer.render(world.scene, world.camera);
}

/** Jolt the camera (crow hit, whale fall, lightning strike). */
export function shake(world, amount) {
  world.shake = Math.max(world.shake, amount);
}
