import * as THREE from 'three';
import {
  GROUND,
  LAYOUT,
  SIQ_HALF,
  TAJ,
  TREASURY,
  canyonAxisX,
  wallAxisX,
} from '../sim/layout';
import { hash2 } from '../sim/math';
import { terrainHeight } from '../sim/terrain';
import { box, compose, merged, stage, stone } from './geom';
import type { Quality } from './quality';
import { windowLights } from './textures';

export interface LandmarkMotion {
  flags: THREE.Object3D[];
  shafts: THREE.Mesh[];
}

export function addLandmarks(scene: THREE.Scene, quality: Quality): LandmarkMotion {
  const flags: THREE.Object3D[] = [];
  const shafts: THREE.Mesh[] = [];
  addWall(scene, flags);
  addTaj(scene);
  addPetra(scene, shafts);
  addColosseum(scene);
  addPyramid(scene);
  addMachu(scene);
  addRedeemer(scene, quality);
  return { flags, shafts };
}

function addWall(scene: THREE.Scene, flags: THREE.Object3D[]): void {
  const segment = merged([
    box(6.6, 7.2, 8.4, 0, 3.6, 0),
    ...merlons(3.15, 7.2),
    ...merlons(-3.15, 7.2),
  ]);
  const step = 8;
  const z0 = LAYOUT.wallZ0;
  const z1 = LAYOUT.wallZ1;
  const count = Math.floor((z1 - z0) / step);
  const material = stone('#ffffff', 0.9);
  const mesh = new THREE.InstancedMesh(segment, material, count);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  const up = new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3();
  const yAxis = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const z = z0 + i * step;
    const xA = wallAxisX(z);
    const xB = wallAxisX(z + step);
    const yA = terrainHeight(xA, z);
    const yB = terrainHeight(xB, z + step);
    dir.set(xB - xA, yB - yA, step);
    const length = dir.length();
    dir.multiplyScalar(1 / length);
    xAxis.crossVectors(up, dir);
    if (xAxis.lengthSq() < 1e-6) xAxis.set(1, 0, 0);
    xAxis.normalize();
    yAxis.crossVectors(dir, xAxis).normalize();
    basis.makeBasis(xAxis, yAxis, dir);
    quat.setFromRotationMatrix(basis);
    mid.set((xA + xB) / 2, (yA + yB) / 2, z + step / 2);
    scale.set(1, 1, (length * 1.05) / 8.4);
    matrix.compose(mid, quat, scale);
    mesh.setMatrixAt(i, matrix);
    color.setHSL(0.08, 0.18, 0.62 + hash2(i, 2) * 0.12);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const towerGeo = merged([
    box(13, 15, 13, 0, 7.5, 0),
    box(15.4, 1.3, 15.4, 0, 15.4, 0),
    box(9, 2.4, 9, 0, 17.2, 0),
    box(0.25, 3.2, 0.25, 0, 19.5, 0),
  ]);
  const towers: number[] = [];
  for (let z = z0 + 36; z < z1; z += 72) towers.push(z);
  const towerMesh = new THREE.InstancedMesh(towerGeo, stone('#ffffff', 0.86), towers.length);
  towerMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(towers.length * 3), 3);
  towers.forEach((z, i) => {
    const x = wallAxisX(z);
    const y = terrainHeight(x, z);
    towerMesh.setMatrixAt(i, compose(x, y, z));
    color.setHSL(0.07, 0.16, 0.5 + hash2(i, 9) * 0.08);
    towerMesh.setColorAt(i, color);
    const flag = banner();
    flag.position.set(x, y + 21.2, z);
    scene.add(flag);
    flags.push(flag);
  });
  towerMesh.instanceMatrix.needsUpdate = true;
  if (towerMesh.instanceColor) towerMesh.instanceColor.needsUpdate = true;
  towerMesh.frustumCulled = false;
  towerMesh.castShadow = true;
  towerMesh.receiveShadow = true;
  scene.add(towerMesh);
}

function merlons(x: number, base: number): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = [];
  for (const z of [-2.6, 0, 2.6]) geos.push(box(0.85, 1.35, 1.5, x, base + 0.67, z));
  return geos;
}

function banner(): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(2.6, 0.45);
  shape.lineTo(2.15, 1.15);
  shape.lineTo(0, 1.35);
  const geometry = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: '#9d2a2a',
      roughness: 0.7,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  );
  mesh.castShadow = true;
  return mesh;
}

function addTaj(scene: THREE.Scene): void {
  const y0 = GROUND.taj;
  const marbleBits: THREE.BufferGeometry[] = [];
  const redBits: THREE.BufferGeometry[] = [];
  const inkBits: THREE.BufferGeometry[] = [];

  redBits.push(box(TAJ.plinthW + 10, 1.7, TAJ.plinthD + 10, 0, y0 + 0.85, 0));
  marbleBits.push(box(TAJ.plinthW, TAJ.plinthH, TAJ.plinthD, 0, y0 + 1.7 + TAJ.plinthH / 2, 0));

  const deck = y0 + 1.7 + TAJ.plinthH;
  marbleBits.push(box(TAJ.body, TAJ.bodyH, TAJ.body, 0, deck + TAJ.bodyH / 2, 0));

  const archH = 16;
  const archW = 8.2;
  const face = TAJ.body / 2 + 0.18;
  for (const side of [-1, 1]) {
    inkBits.push(box(archW, archH, 0.42, side * face, deck + 1.2 + archH / 2, 0));
    inkBits.push(box(0.42, archH, archW, 0, deck + 1.2 + archH / 2, side * face));
    inkBits.push(box(archW * 0.62, archH * 0.72, 0.3, side * (face - 8), deck + 2 + archH * 0.36, 0));
  }

  const roof = deck + TAJ.bodyH;
  const drum = new THREE.CylinderGeometry(TAJ.drumR, TAJ.drumR + 0.6, TAJ.drumH, 28);
  drum.translate(0, roof + TAJ.drumH / 2, 0);
  marbleBits.push(drum);
  const dome = new THREE.SphereGeometry(TAJ.domeR, 28, 18);
  dome.scale(1, 1.18, 1);
  dome.translate(0, roof + TAJ.drumH + TAJ.domeR * 0.72, 0);
  marbleBits.push(dome);
  const finial = new THREE.CylinderGeometry(0.18, 0.45, 6.5, 8);
  finial.translate(0, roof + TAJ.drumH + TAJ.domeR * 1.55, 0);
  marbleBits.push(finial);
  const finialTip = new THREE.SphereGeometry(0.45, 10, 8);
  finialTip.translate(0, roof + TAJ.drumH + TAJ.domeR * 1.55 + 3.4, 0);
  marbleBits.push(finialTip);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * 18;
      const cz = sz * 18;
      const chat = new THREE.SphereGeometry(3.1, 14, 10);
      chat.scale(1, 0.85, 1);
      chat.translate(cx, roof + 3.3, cz);
      marbleBits.push(chat);
      const neck = new THREE.CylinderGeometry(1.6, 1.9, 2.2, 10);
      neck.translate(cx, roof + 1.1, cz);
      marbleBits.push(neck);
    }
  }

  const corner = TAJ.plinthW * 0.42;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const mx = sx * corner;
      const mz = sz * corner;
      const shaft = new THREE.CylinderGeometry(1.15, 1.85, TAJ.minaretH, 12);
      shaft.translate(mx, deck + TAJ.minaretH / 2, mz);
      marbleBits.push(shaft);
      for (const t of [0.38, 0.68]) {
        const balcony = new THREE.CylinderGeometry(2.5, 2.5, 0.45, 12);
        balcony.translate(mx, deck + TAJ.minaretH * t, mz);
        marbleBits.push(balcony);
      }
      const cap = new THREE.SphereGeometry(2.05, 12, 10);
      cap.scale(1, 0.9, 1);
      cap.translate(mx, deck + TAJ.minaretH + 1.1, mz);
      marbleBits.push(cap);
    }
  }

  const marble = new THREE.MeshPhysicalMaterial({
    color: '#f6f2ea',
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.4,
    clearcoatRoughness: 0.25,
  });
  const white = new THREE.Mesh(merged(marbleBits), marble);
  white.position.set(0, 0, LAYOUT.taj.z);
  stage(white, true);
  scene.add(white);

  const sandstone = new THREE.Mesh(merged(redBits), stone('#a24d3c', 0.8));
  sandstone.position.set(0, 0, LAYOUT.taj.z);
  stage(sandstone, true);
  scene.add(sandstone);

  const rails = new THREE.Mesh(
    merged([
      box(1.15, 0.55, 156, -13.5, y0 + 0.32, LAYOUT.taj.z - 158),
      box(1.15, 0.55, 156, 13.5, y0 + 0.32, LAYOUT.taj.z - 158),
    ]),
    stone('#a24d3c', 0.8),
  );
  stage(rails, false);
  scene.add(rails);

  const ink = new THREE.Mesh(
    merged(inkBits),
    new THREE.MeshStandardMaterial({ color: '#6e5b4e', roughness: 0.72, metalness: 0 }),
  );
  ink.position.set(0, 0, LAYOUT.taj.z);
  stage(ink, false);
  scene.add(ink);
}

function addPetra(scene: THREE.Scene, shafts: THREE.Mesh[]): void {
  const pz = LAYOUT.petra.z;
  const zStart = pz - 270;
  const zEnd = pz - 8;
  const step = 16;
  const count = Math.ceil((zEnd - zStart) / step) * 2 + 18;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const material = stone('#ffffff', 0.93);
  const walls = new THREE.InstancedMesh(geo, material, count);
  const color = new THREE.Color();
  let n = 0;
  const place = (x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0, hue = 0.04) => {
    walls.setMatrixAt(n, compose(x, y, z, yaw, sx, sy, sz));
    color.setHSL(hue + hash2(n, 4) * 0.03, 0.42, 0.38 + hash2(n, 5) * 0.16);
    walls.setColorAt(n, color);
    n += 1;
  };

  for (let z = zStart; z < zEnd; z += step) {
    const axis = canyonAxisX(z + step / 2);
    const height = 36 + hash2(Math.floor(z), 1) * 22;
    const thick = 14 + hash2(Math.floor(z), 2) * 6;
    const ground = GROUND.petraCourt - 3;
    place(axis - SIQ_HALF - thick / 2, ground + height / 2, z + step / 2, thick, height, step * 1.08);
    place(axis + SIQ_HALF + thick / 2, ground + height / 2, z + step / 2, thick, height, step * 1.08, 0, 0.03);
    if (hash2(Math.floor(z), 8) > 0.72) {
      const lintelH = 3 + hash2(Math.floor(z), 6);
      place(axis, 28 + hash2(Math.floor(z), 7) * 8, z + step / 2, SIQ_HALF * 2 + 2, lintelH, 3.2, 0, 0.05);
    }
  }

  place(canyonAxisX(pz) , GROUND.petraCourt + 26, pz + 22, 64, 58, 36, 0, 0.02);
  place(canyonAxisX(pz) - 24, GROUND.petraCourt + 18, pz + 8, 18, 40, 22, 0.08, 0.035);
  place(canyonAxisX(pz) + 22, GROUND.petraCourt + 20, pz + 10, 16, 44, 20, -0.06, 0.03);

  walls.count = n;
  walls.instanceMatrix.needsUpdate = true;
  if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
  walls.frustumCulled = false;
  walls.castShadow = true;
  walls.receiveShadow = true;
  scene.add(walls);

  const front = pz;
  const base = GROUND.petraCourt;
  const roseBits: THREE.BufferGeometry[] = [];
  const darkBits: THREE.BufferGeometry[] = [];
  roseBits.push(box(TREASURY.width, 15.5, TREASURY.depth, 0, base + 7.75, front + TREASURY.depth / 2));
  const columns = 6;
  for (let i = 0; i < columns; i += 1) {
    const x = -9 + (i * 18) / (columns - 1);
    const column = new THREE.CylinderGeometry(0.48, 0.58, 11.5, 8);
    column.translate(x, base + 6.2, front - 0.6);
    roseBits.push(column);
  }
  roseBits.push(box(TREASURY.width + 1.2, 1.6, 2.2, 0, base + 12.6, front - 0.4));
  darkBits.push(box(4.2, 7.4, 0.8, 0, base + 4.1, front - 0.7));
  const tholos = new THREE.CylinderGeometry(3.1, 3.4, 8.5, 14);
  tholos.translate(0, base + 20.5, front + 2.4);
  roseBits.push(tholos);
  const cone = new THREE.ConeGeometry(3.6, 4.2, 14);
  cone.translate(0, base + 26.4, front + 2.4);
  roseBits.push(cone);
  const pediment = new THREE.ConeGeometry(8.5, 4.5, 4);
  pediment.rotateY(Math.PI / 4);
  pediment.scale(1.4, 1, 0.45);
  pediment.translate(0, base + 16.8, front + 0.2);
  roseBits.push(pediment);
  const urn = new THREE.SphereGeometry(1.15, 10, 8);
  urn.translate(0, base + 30.2, front + 2.4);
  roseBits.push(urn);
  roseBits.push(box(TREASURY.width - 2, 8, 6, 0, base + 24, front + 3));

  const rose = new THREE.Mesh(merged(roseBits), stone('#d48972', 0.78));
  stage(rose, true);
  scene.add(rose);
  const door = new THREE.Mesh(merged(darkBits), stone('#2a1410', 0.95));
  stage(door, false);
  scene.add(door);

  const torchMat = new THREE.MeshBasicMaterial({ color: '#ffb06a' });
  torchMat.color.multiplyScalar(3.2);
  for (const x of [-8.5, 8.5]) {
    const torch = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), torchMat);
    torch.position.set(canyonAxisX(front) + x, base + 2.2, front - 2);
    scene.add(torch);
  }

  const shaftMat = new THREE.MeshBasicMaterial({
    color: '#ffc39a',
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  for (let i = 0; i < 5; i += 1) {
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(7, 42), shaftMat.clone());
    const z = zStart + 30 + i * 48;
    shaft.position.set(canyonAxisX(z), 24, z);
    shaft.rotation.z = -0.35 + i * 0.04;
    shaft.rotation.y = 0.4;
    scene.add(shaft);
    shafts.push(shaft);
  }
}

function addColosseum(scene: THREE.Scene): void {
  const a = LAYOUT.rome.a;
  const b = LAYOUT.rome.b;
  const cz = LAYOUT.rome.z;
  const ground = GROUND.rome;
  const travertine = stone('#e7d3b0', 0.82);
  const podiumGeo = new THREE.CylinderGeometry(1, 1.04, 2.4, 48);
  const podium = new THREE.Mesh(podiumGeo, travertine);
  podium.scale.set(a + 8, 1, b + 8);
  podium.position.set(0, ground + 1.2, cz);
  stage(podium, true);
  scene.add(podium);

  const arch = merged([
    box(1.15, 8.8, 3.3, -2.35, 4.4, 0),
    box(1.15, 8.8, 3.3, 2.35, 4.4, 0),
    box(5.7, 1.35, 3.3, 0, 9.35, 0),
  ]);
  const perLevel = 76;
  const levels = 3;
  const arches = new THREE.InstancedMesh(arch, travertine, perLevel * levels);
  const color = new THREE.Color('#f0e2c8');
  const xAxis = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const zAxis = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  let n = 0;
  for (let level = 0; level < levels; level += 1) {
    for (let i = 0; i < perLevel; i += 1) {
      const theta = (i / perLevel) * Math.PI * 2;
      const x = Math.cos(theta) * a;
      const z = Math.sin(theta) * b;
      const ox = Math.cos(theta) / a;
      const oz = Math.sin(theta) / b;
      zAxis.set(ox, 0, oz).normalize();
      xAxis.crossVectors(yAxis, zAxis).normalize();
      matrix.makeBasis(xAxis, yAxis, zAxis);
      matrix.setPosition(x, ground + 2.4 + level * 10.6, cz + z);
      arches.setMatrixAt(n, matrix);
      arches.setColorAt(n, color);
      n += 1;
    }
  }
  arches.instanceMatrix.needsUpdate = true;
  if (arches.instanceColor) arches.instanceColor.needsUpdate = true;
  arches.frustumCulled = false;
  arches.castShadow = true;
  arches.receiveShadow = true;
  scene.add(arches);

  const atticGeo = new THREE.BoxGeometry(4.8, 8.2, 3.6);
  const attic = new THREE.InstancedMesh(atticGeo, travertine, perLevel);
  for (let i = 0; i < perLevel; i += 1) {
    const theta = (i / perLevel) * Math.PI * 2;
    const x = Math.cos(theta) * (a + 0.4);
    const z = Math.sin(theta) * (b + 0.4);
    const ox = Math.cos(theta) / a;
    const oz = Math.sin(theta) / b;
    zAxis.set(ox, 0, oz).normalize();
    xAxis.crossVectors(yAxis, zAxis).normalize();
    matrix.makeBasis(xAxis, yAxis, zAxis);
    matrix.setPosition(x, ground + 2.4 + 3 * 10.6 + 2.4, cz + z);
    attic.setMatrixAt(i, matrix);
  }
  attic.instanceMatrix.needsUpdate = true;
  attic.frustumCulled = false;
  attic.castShadow = true;
  attic.receiveShadow = true;
  scene.add(attic);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64), stone('#c6a56a', 0.9));
  floor.geometry.rotateX(-Math.PI / 2);
  floor.scale.set(a * 0.78, 1, b * 0.78);
  floor.position.set(0, ground + 2.55, cz);
  floor.receiveShadow = true;
  scene.add(floor);

  const hypoBits: THREE.BufferGeometry[] = [];
  for (let i = -3; i <= 3; i += 1) {
    hypoBits.push(box(1.1, 2.2, b * 0.9, i * 8, ground + 3.5, cz));
    hypoBits.push(box(a * 0.7, 2.2, 1.1, 0, ground + 3.5, cz + i * 6));
  }
  const hypo = new THREE.Mesh(merged(hypoBits), stone('#8d7350', 0.95));
  stage(hypo, false);
  scene.add(hypo);

  const cloth = new THREE.MeshBasicMaterial({
    color: '#b84332',
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const awning = new THREE.InstancedMesh(new THREE.PlaneGeometry(10, 16), cloth, 24);
  for (let i = 0; i < 24; i += 1) {
    const theta = (i / 24) * Math.PI * 2;
    const x = Math.cos(theta) * (a * 0.72);
    const z = Math.sin(theta) * (b * 0.72);
    matrix.makeRotationX(-0.55);
    const yaw = new THREE.Matrix4().makeRotationY(-theta);
    matrix.premultiply(yaw);
    matrix.setPosition(x, ground + 40, cz + z);
    awning.setMatrixAt(i, matrix);
  }
  awning.instanceMatrix.needsUpdate = true;
  awning.frustumCulled = false;
  scene.add(awning);
}

function addPyramid(scene: THREE.Scene): void {
  const ground = GROUND.chichen;
  const cz = LAYOUT.chichen.z;
  const levels = LAYOUT.chichen.levels;
  const base = LAYOUT.chichen.base;
  const stepH = LAYOUT.chichen.stepH;
  const lightBits: THREE.BufferGeometry[] = [];
  const shadeBits: THREE.BufferGeometry[] = [];
  for (let i = 0; i < levels; i += 1) {
    const size = base - i * ((base - 16) / levels);
    const block = box(size, stepH, size, 0, ground + i * stepH + stepH / 2, 0);
    if (i % 2 === 0) lightBits.push(block);
    else shadeBits.push(block);
  }
  const top = ground + levels * stepH;
  lightBits.push(box(13, 7.2, 11, 0, top + 3.6, 0));
  shadeBits.push(box(3.2, 4.4, 0.4, 0, top + 2.6, -5.6));
  lightBits.push(box(15, 1.4, 12, 0, top + 7.6, 0));

  const stairCount = 42;
  const stairH = levels * stepH;
  const outer = -base / 2 - 1.5;
  const inner = -7;
  const stairBits: THREE.BufferGeometry[] = [];
  for (let i = 0; i < stairCount; i += 1) {
    const u = (i + 0.5) / stairCount;
    const y = ground + u * stairH;
    const z = outer + u * (inner - outer);
    stairBits.push(box(11, stairH / stairCount + 0.12, 1.15, 0, y, z));
  }
  const north = merged(stairBits);
  const east = north.clone();
  east.rotateY(Math.PI / 2);
  const south = north.clone();
  south.rotateY(Math.PI);
  const west = north.clone();
  west.rotateY(-Math.PI / 2);

  const limestone = new THREE.Mesh(merged(lightBits), stone('#f3ead6', 0.8));
  limestone.position.set(0, 0, cz);
  stage(limestone, true);
  scene.add(limestone);
  const band = new THREE.Mesh(merged(shadeBits), stone('#e4d2ae', 0.84));
  band.position.set(0, 0, cz);
  stage(band, true);
  scene.add(band);
  const stairs = new THREE.Mesh(merged([north, east, south, west]), stone('#f7f1e4', 0.76));
  stairs.position.set(0, 0, cz);
  stage(stairs, true);
  scene.add(stairs);

  for (const x of [-6.2, 6.2]) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), stone('#6d6a55', 0.7));
    head.scale.set(1.4, 0.7, 1.6);
    head.position.set(x, ground + 1.1, cz + outer - 0.6);
    scene.add(head);
  }
}

function addMachu(scene: THREE.Scene): void {
  const cz = LAYOUT.machu.z;
  const stoneBits: THREE.BufferGeometry[] = [];
  const grassBits: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i += 1) {
    const z = cz - 8 - i * 11;
    const width = 46 - i * 3.2;
    const y = terrainHeight(0, z);
    stoneBits.push(box(width, 2.4, 9, 0, y + 0.4, z));
    grassBits.push(box(width - 0.6, 0.35, 8.4, 0, y + 1.7, z));
  }
  const houses: Array<[number, number, number, number]> = [
    [0, 2, 8, 6],
    [9, 6, 6, 5],
    [-8, 5, 7, 5],
    [5, -4, 5, 4.5],
    [-6, -5, 6.5, 5],
    [13, -1, 4.5, 4],
    [-13, 1, 5, 4.2],
  ];
  for (const [x, dz, w, d] of houses) {
    const z = cz + dz;
    const y = terrainHeight(x, z);
    stoneBits.push(box(w, 3.4, d, x, y + 1.7, z));
    const roof = new THREE.ConeGeometry(1, 1.6, 4);
    roof.rotateY(Math.PI / 4);
    roof.scale(w * 0.72, 1, d * 0.72);
    roof.translate(x, y + 3.4 + 0.8, z);
    stoneBits.push(roof);
    stoneBits.push(box(w * 0.28, 1.8, 0.12, x, y + 1.2, z - d / 2 - 0.02));
  }

  const rock = new THREE.Mesh(merged(stoneBits), stone('#b7b1a4', 0.9));
  stage(rock, true);
  scene.add(rock);
  const grass = new THREE.Mesh(merged(grassBits), stone('#6f8f46', 0.95));
  grass.receiveShadow = true;
  scene.add(grass);
}

function addRedeemer(scene: THREE.Scene, quality: Quality): void {
  const y0 = GROUND.summit;
  const cz = LAYOUT.christ.z;
  const bits: THREE.BufferGeometry[] = [];
  bits.push(box(10, 5.4, 8, 0, y0 + 2.7, cz));
  const robe = new THREE.CylinderGeometry(2.35, 6.5, 16.5, 20);
  robe.translate(0, y0 + 5.4 + 8.25, cz);
  bits.push(robe);
  const torso = new THREE.CapsuleGeometry(2.05, 6.2, 4, 10);
  torso.translate(0, y0 + 22.6, cz);
  bits.push(torso);
  const head = new THREE.SphereGeometry(1.55, 16, 12);
  head.scale(0.92, 1.18, 0.95);
  head.translate(0, y0 + 27.6, cz + 0.2);
  bits.push(head);
  bits.push(box(12.8, 1.45, 1.55, -8.1, y0 + 24.1, cz));
  bits.push(box(12.8, 1.45, 1.55, 8.1, y0 + 24.1, cz));
  bits.push(box(1.3, 2.1, 0.7, -14.2, y0 + 23.2, cz));
  bits.push(box(1.3, 2.1, 0.7, 14.2, y0 + 23.2, cz));
  bits.push(box(16, 0.8, 10, 0, y0 + 0.5, cz - 14));

  const soapstone = new THREE.MeshPhysicalMaterial({
    color: '#e4dfd6',
    roughness: 0.55,
    metalness: 0.04,
    clearcoat: 0.18,
    clearcoatRoughness: 0.4,
  });
  const statue = new THREE.Mesh(merged(bits), soapstone);
  stage(statue, true);
  scene.add(statue);

  const windows = windowLights();
  const buildingMat = new THREE.MeshStandardMaterial({
    color: '#141820',
    roughness: 0.85,
    metalness: 0.08,
    emissive: '#ffd2a8',
    emissiveMap: windows,
    emissiveIntensity: 1.35,
  });
  const buildingCount = Math.floor(78 * quality.density);
  const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), buildingMat, buildingCount);
  const color = new THREE.Color();
  let placed = 0;
  for (let i = 0; placed < buildingCount && i < buildingCount * 4; i += 1) {
    const lane = (i % 9) - 4;
    const x = lane * 22 + (hash2(i, 3) - 0.5) * 8;
    if (Math.abs(x) < 16) continue;
    const z = 4472 + hash2(i, 11) * 112;
    const height = 8 + hash2(i, 12) * (Math.abs(x) > 70 ? 42 : 16);
    const width = 7 + hash2(i, 13) * 8;
    const depth = 7 + hash2(i, 14) * 8;
    buildings.setMatrixAt(placed, compose(x, GROUND.city + height / 2, z, 0, width, height, depth));
    color.setHSL(0.62, 0.15, 0.18 + hash2(i, 15) * 0.12);
    buildings.setColorAt(placed, color);
    placed += 1;
  }
  buildings.count = placed;
  buildings.instanceMatrix.needsUpdate = true;
  if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
  buildings.frustumCulled = false;
  buildings.castShadow = false;
  buildings.receiveShadow = true;
  scene.add(buildings);
}
