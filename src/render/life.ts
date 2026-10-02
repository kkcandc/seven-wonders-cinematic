import * as THREE from 'three';
import { GROUND, LAYOUT, canyonAxisX, routeX, wallAxisX } from '../sim/layout';
import { hash2, mulberry32 } from '../sim/math';
import { terrainHeight } from '../sim/terrain';
import { compose, merged } from './geom';
import type { Quality } from './quality';
import { softDisc } from './textures';

export interface Life {
  update(time: number, camera: THREE.Vector3): void;
}

export function addLife(scene: THREE.Scene, quality: Quality): Life {
  const disc = softDisc();
  const pines = plantPines(scene, quality);
  const broad = plantBroadleaf(scene, quality);
  plantCypress(scene);
  const people = plantPeople(scene, quality);
  const birds = plantBirds(scene, quality);
  const motes = routeMotes(scene, disc);
  const mist = valleyMist(scene, disc, quality);
  const clouds = cloudSprites(scene, disc, quality);
  void pines;
  void broad;
  return {
    update(time, camera) {
      for (const bird of birds) {
        const data = bird.userData as BirdData;
        const angle = time * data.speed + data.phase;
        bird.position.set(
          data.x + Math.cos(angle) * data.radius,
          data.y + Math.sin(angle * 2.2) * 2.4,
          data.z + Math.sin(angle) * data.radius * 0.65,
        );
        bird.lookAt(bird.position.x - Math.sin(angle), bird.position.y, bird.position.z + Math.cos(angle));
        data.left.rotation.z = Math.sin(time * 8 + data.phase) * 0.55;
        data.right.rotation.z = -Math.sin(time * 8 + data.phase) * 0.55;
      }
      const positions = motes.geometry.getAttribute('position') as THREE.BufferAttribute;
      const colors = motes.geometry.getAttribute('color') as THREE.BufferAttribute;
      const span = 170;
      for (let i = 0; i < positions.count; i += 1) {
        const z = camera.z - 20 + ((i / positions.count) * span + time * 18) % span;
        const x = routeX(z) + Math.sin(i * 1.7) * 1.8;
        const y = terrainHeight(x, z) + 1.4 + (i % 5) * 0.35;
        positions.setXYZ(i, x, y, z);
        const along = z - camera.z;
        const fade = Math.min(1, Math.max(0, along / 16)) * (1 - Math.min(1, Math.max(0, (along - 110) / 50)));
        colors.setXYZ(i, 1.0 * fade, 0.78 * fade, 0.42 * fade);
      }
      positions.needsUpdate = true;
      colors.needsUpdate = true;

      const mistPos = mist.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < mistPos.count; i += 1) {
        const base = mist.userData.base as Float32Array;
        mistPos.setY(i, base[i] + Math.sin(time * 0.6 + i) * 1.4);
      }
      mistPos.needsUpdate = true;

      for (const cloud of clouds) {
        cloud.position.x += Math.sin(time * 0.15 + cloud.position.z * 0.01) * 0.02;
        const material = cloud.material as THREE.SpriteMaterial;
        const dist = camera.distanceTo(cloud.position);
        material.opacity = Math.max(0, 0.42 - dist / 900);
      }

      void people;
    },
  };
}

function plantPines(scene: THREE.Scene, quality: Quality): THREE.InstancedMesh {
  const trunk = new THREE.CylinderGeometry(0.22, 0.38, 4.4, 5);
  trunk.translate(0, 2.2, 0);
  paint(trunk, '#6b4a32');
  const lower = new THREE.ConeGeometry(2.15, 5.4, 6);
  lower.translate(0, 5.5, 0);
  paint(lower, '#2f5a34');
  const upper = new THREE.ConeGeometry(1.45, 3.6, 6);
  upper.translate(0, 7.8, 0);
  paint(upper, '#3e7344');
  const geo = merged([trunk, lower, upper]);
  const spots: THREE.Matrix4[] = [];
  scatter(spots, 11, Math.floor(280 * quality.density), 20, 760, 120, (x, z) => {
    return Math.abs(x - wallAxisX(z)) > 11 && Math.abs(x - wallAxisX(z)) < 130;
  });
  scatter(spots, 19, Math.floor(70 * quality.density), LAYOUT.rome.z - 260, LAYOUT.rome.z + 260, 180, (x, z) => {
    const dx = x / (LAYOUT.rome.a + 16);
    const dz = (z - LAYOUT.rome.z) / (LAYOUT.rome.b + 16);
    return dx * dx + dz * dz > 1;
  });
  return commitPlants(scene, geo, spots);
}

function plantCypress(scene: THREE.Scene): void {
  const trunk = new THREE.CylinderGeometry(0.18, 0.28, 2.2, 5);
  trunk.translate(0, 1.1, 0);
  paint(trunk, '#6a4b32');
  const leaf = new THREE.ConeGeometry(0.85, 8.5, 6);
  leaf.translate(0, 6.2, 0);
  paint(leaf, '#1e4d38');
  const geo = merged([trunk, leaf]);
  const spots: THREE.Matrix4[] = [];
  for (let z = LAYOUT.taj.z - 210; z <= LAYOUT.taj.z - 68; z += 13) {
    for (const x of [-20, -30, 20, 30]) {
      spots.push(compose(x, GROUND.taj, z, 0, 1, 1.15 + (z % 26 === 0 ? 0.25 : 0), 1));
    }
  }
  commitPlants(scene, geo, spots);
}

function plantBroadleaf(scene: THREE.Scene, quality: Quality): THREE.InstancedMesh {
  const trunk = new THREE.CylinderGeometry(0.28, 0.42, 6.5, 5);
  trunk.translate(0, 3.25, 0);
  paint(trunk, '#5c4030');
  const canopy = new THREE.SphereGeometry(3.3, 7, 5);
  canopy.translate(0, 8.2, 0);
  paint(canopy, '#1f6a38');
  const side = new THREE.SphereGeometry(2.2, 6, 4);
  side.translate(1.6, 7.1, 0.4);
  paint(side, '#2d7a40');
  const geo = merged([trunk, canopy, side]);
  const spots: THREE.Matrix4[] = [];
  scatter(spots, 29, Math.floor(320 * quality.density), LAYOUT.chichen.z - 280, LAYOUT.chichen.z + 280, 150, (x, z) => {
    return Math.hypot(x, z - LAYOUT.chichen.z) > 42;
  });
  scatter(spots, 41, Math.floor(90 * quality.density), LAYOUT.petra.z - 280, LAYOUT.petra.z + 40, 70, (x, z) => {
    return Math.abs(x - canyonAxisX(z)) > SIQ_CLEAR;
  });
  scatter(spots, 53, Math.floor(120 * quality.density), LAYOUT.machu.z - 200, LAYOUT.machu.z + 160, 120, (x, z) => {
    return Math.hypot(x, z - LAYOUT.machu.z) > 26 && terrainHeight(x, z) < 96;
  });
  scatter(spots, 67, Math.floor(36 * quality.density), LAYOUT.christ.z - 180, LAYOUT.christ.z + 40, 140, (x, z) => {
    return Math.hypot(x, z - LAYOUT.christ.z) > 24 && z < 4460;
  });
  return commitPlants(scene, geo, spots);
}

const SIQ_CLEAR = 16;

function scatter(
  out: THREE.Matrix4[],
  seed: number,
  count: number,
  z0: number,
  z1: number,
  xSpread: number,
  accept: (x: number, z: number) => boolean,
): void {
  const rng = mulberry32(seed);
  const target = out.length + count;
  let guard = 0;
  while (out.length < target && guard < count * 12) {
    guard += 1;
    const z = z0 + rng() * (z1 - z0);
    const x = (rng() - 0.5) * xSpread * 2;
    if (!accept(x, z)) continue;
    const h = terrainHeight(x, z);
    const s = 0.7 + rng() * 0.9;
    out.push(compose(x, h, z, rng() * Math.PI * 2, s, 0.85 + rng() * 0.5, s));
  }
}

function commitPlants(
  scene: THREE.Scene,
  geometry: THREE.BufferGeometry,
  matrices: THREE.Matrix4[],
): THREE.InstancedMesh {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, matrices.length));
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  if (matrices.length === 0) mesh.count = 0;
  scene.add(mesh);
  return mesh;
}

function paint(geometry: THREE.BufferGeometry, hex: string): void {
  const color = new THREE.Color(hex);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function plantPeople(scene: THREE.Scene, quality: Quality): THREE.InstancedMesh {
  const body = new THREE.CapsuleGeometry(0.22, 0.92, 2, 6);
  body.translate(0, 0.72, 0);
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0 });
  const spots: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  const dye = new THREE.Color();

  const push = (x: number, y: number, z: number, yaw: number) => {
    const s = 0.9 + hash2(spots.length, 2) * 0.25;
    spots.push(compose(x, y, z, yaw, s, s, s));
    dye.setHSL(hash2(spots.length, 8), 0.45, 0.38 + hash2(spots.length, 9) * 0.2);
    colors.push(dye.clone());
  };

  for (let z = 60; z < 680; z += 26) {
    const axis = wallAxisX(z);
    const y = terrainHeight(axis, z) + 7.25;
    const ahead = wallAxisX(z + 6) - axis;
    const yaw = Math.atan2(ahead, 6);
    push(axis + (z % 52 < 26 ? 1.1 : -1.1), y, z, yaw);
  }

  const crowd = Math.floor(220 * quality.density);
  for (let i = 0; i < crowd; i += 1) {
    const theta = hash2(i, 21) * Math.PI * 2;
    const radius = 18 + hash2(i, 22) * 58;
    const x = Math.cos(theta) * radius * (LAYOUT.rome.a / 70);
    const z = LAYOUT.rome.z + Math.sin(theta) * radius * (LAYOUT.rome.b / 60);
    const tier = i % 5;
    const y = GROUND.rome + 2.6 + tier * 4.2 * (radius > 46 ? 1 : 0);
    push(x, y, z, -theta);
  }

  for (let i = 0; i < Math.floor(36 * quality.density); i += 1) {
    const x = -20 + hash2(i, 30) * 40;
    const z = LAYOUT.taj.z - 70 - hash2(i, 31) * 80;
    push(x, GROUND.taj + 0.05, z, 0);
  }
  for (let i = 0; i < 24; i += 1) {
    const side = i < 12 ? -1 : 1;
    const z = LAYOUT.chichen.z - 34 + (i % 12) * 1.4;
    push(side * 8, GROUND.chichen + 0.05, z, side > 0 ? Math.PI : 0);
  }
  for (let i = 0; i < 18; i += 1) {
    push(-6 + i * 0.7, terrainHeight(0, LAYOUT.machu.z - 10) + 2, LAYOUT.machu.z - 10, 0.4);
  }
  for (let i = 0; i < 16; i += 1) {
    push(-7 + i * 0.9, GROUND.summit + 1, LAYOUT.christ.z - 14, 0);
  }

  const mesh = new THREE.InstancedMesh(body, material, spots.length);
  spots.forEach((matrix, index) => {
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, colors[index]);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

interface BirdData {
  x: number;
  y: number;
  z: number;
  radius: number;
  speed: number;
  phase: number;
  left: THREE.Mesh;
  right: THREE.Mesh;
}

function plantBirds(scene: THREE.Scene, quality: Quality): THREE.Group[] {
  const wing = new THREE.BufferGeometry();
  wing.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1.5, 0.05, 0.1, 0.25, 0, 0.45], 3),
  );
  wing.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({ color: '#1a1c22', side: THREE.DoubleSide });
  const birds: THREE.Group[] = [];
  const count = Math.max(8, Math.floor(16 * quality.density));
  for (let i = 0; i < count; i += 1) {
    const group = new THREE.Group();
    const left = new THREE.Mesh(wing, material);
    const right = new THREE.Mesh(wing, material);
    right.scale.x = -1;
    group.add(left, right);
    const z = i < count * 0.7 ? 80 + hash2(i, 40) * 420 : LAYOUT.christ.z - 80 + hash2(i, 41) * 60;
    const axis = z < 800 ? wallAxisX(z) : 0;
    const data: BirdData = {
      x: axis - 30 + hash2(i, 42) * 60,
      y: (z < 800 ? terrainHeight(axis, z) : 80) + 18 + hash2(i, 43) * 16,
      z,
      radius: 10 + hash2(i, 44) * 16,
      speed: 0.35 + hash2(i, 45) * 0.4,
      phase: hash2(i, 46) * Math.PI * 2,
      left,
      right,
    };
    group.userData = data;
    group.scale.setScalar(2.4);
    scene.add(group);
    birds.push(group);
  }
  return birds;
}

function routeMotes(scene: THREE.Scene, map: THREE.Texture): THREE.Points {
  const count = 90;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 1.5,
    map,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    opacity: 0.85,
    fog: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);
  return points;
}

function valleyMist(scene: THREE.Scene, map: THREE.Texture, quality: Quality): THREE.Points {
  const count = Math.floor(420 * quality.density);
  const positions = new Float32Array(count * 3);
  const base = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const region = i % 3;
    let x = 0;
    let z = 0;
    let y = 12;
    if (region === 0) {
      z = hash2(i, 60) * 760;
      x = wallAxisX(z) + (hash2(i, 61) - 0.5) * 180;
      y = 8 + hash2(i, 62) * 14;
    } else if (region === 1) {
      z = LAYOUT.machu.z - 120 + hash2(i, 63) * 240;
      x = (hash2(i, 64) - 0.5) * 200;
      y = 48 + hash2(i, 65) * 22;
    } else {
      z = 4300 + hash2(i, 66) * 280;
      x = (hash2(i, 67) - 0.5) * 260;
      y = 4 + hash2(i, 68) * 18;
    }
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    base[i] = y;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: '#f4efe6',
    size: 7,
    map,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.userData.base = base;
  scene.add(points);
  return points;
}

function cloudSprites(scene: THREE.Scene, map: THREE.Texture, quality: Quality): THREE.Sprite[] {
  const clouds: THREE.Sprite[] = [];
  const count = Math.floor(18 * quality.density);
  for (let i = 0; i < count; i += 1) {
    const material = new THREE.SpriteMaterial({
      map,
      color: i > count * 0.6 ? '#f7d2c4' : '#f7f4ef',
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    const z = i < count * 0.55 ? 80 + hash2(i, 70) * 620 : LAYOUT.machu.z - 80 + hash2(i, 71) * 200;
    const x = (hash2(i, 72) - 0.5) * 280;
    const y = z < 900 ? 28 + hash2(i, 73) * 20 : 64 + hash2(i, 74) * 16;
    sprite.position.set(x, y, z);
    const scale = 36 + hash2(i, 75) * 50;
    sprite.scale.set(scale * 1.6, scale, 1);
    scene.add(sprite);
    clouds.push(sprite);
  }
  return clouds;
}
