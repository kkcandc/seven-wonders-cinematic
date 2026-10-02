import {
  canyonAxisX,
  LAYOUT,
  routeX,
  wallAxisX,
} from './layout';
import { tajDomeY, treasuryTopY, pyramidTopY } from './layout';
import { clamp, lerp, lerpVec, dist2, type Vec3 } from './math';
import { terrainHeight } from './terrain';
import { FLIGHT_SECONDS, WONDERS } from './wonders';

export { FLIGHT_SECONDS };

export interface CameraKey {
  t: number;
  pos: Vec3;
  look: Vec3;
  fov: number;
  roll: number;
}

export interface Pose {
  position: Vec3;
  look: Vec3;
  fov: number;
  roll: number;
}

function key(
  t: number,
  x: number,
  z: number,
  lift: number,
  look: Vec3,
  fov: number,
  roll = 0,
): CameraKey {
  return {
    t,
    pos: { x, y: terrainHeight(x, z) + lift, z },
    look,
    fov,
    roll,
  };
}

function wallKey(t: number, z: number, fov: number): CameraKey {
  const x = wallAxisX(z);
  const y = terrainHeight(x, z);
  const z2 = z + 56;
  const x2 = wallAxisX(z2);
  const y2 = terrainHeight(x2, z2);
  const curv = wallAxisX(z + 24) - 2 * x + wallAxisX(z - 24);
  const roll = clamp(-curv * 0.0035, -0.11, 0.11);
  return {
    t,
    pos: { x: x - 22, y: y + 18, z },
    look: { x: x2 - 4, y: y2 + 9, z: z2 },
    fov,
    roll,
  };
}

function buildKeys(): CameraKey[] {
  const keys: CameraKey[] = [];
  const tajLook = { x: 0, y: tajDomeY(), z: LAYOUT.taj.z };
  const treasuryLook = { x: canyonAxisX(LAYOUT.petra.z), y: treasuryTopY() - 12, z: LAYOUT.petra.z };
  const romeLook = { x: 0, y: 22, z: LAYOUT.rome.z };
  const pyramidLook = { x: 0, y: pyramidTopY() - 6, z: LAYOUT.chichen.z };
  const machuY = terrainHeight(0, LAYOUT.machu.z);
  const machuLook = { x: 6, y: machuY + 6, z: LAYOUT.machu.z };
  const christLook = { x: 0, y: 98 + 24, z: LAYOUT.christ.z };

  const wallZs = [36, 120, 200, 280, 360, 440, 520, 600, 690];
  wallZs.forEach((z, i) => {
    const t = (i / (wallZs.length - 1)) * 0.142;
    keys.push(wallKey(t, z, i === 0 ? 74 : 62));
  });

  const descent: Array<[number, number, number, number]> = [
    [0.15, 760, 22, 64],
    [0.162, 840, 12, 58],
    [0.174, 920, 5.5, 52],
    [0.188, 1002, 1.7, 48],
  ];
  for (const [t, z, lift, fov] of descent) {
    keys.push(key(t, routeX(z) * 0.25, z, lift, tajLook, fov, 0));
  }

  keys.push(key(0.205, 0, 1048, 3.2, { x: 0, y: tajDomeY() + 2, z: LAYOUT.taj.z }, 46, 0));
  keys.push(key(0.228, -62, 1088, 28, tajLook, 50, -0.04));
  keys.push(key(0.252, -28, 1164, 52, { x: 8, y: tajDomeY() + 4, z: LAYOUT.taj.z }, 54, 0.05));
  keys.push(key(0.275, 10, 1260, 20, { x: 0, y: 18, z: 1400 }, 58, 0));

  const pz = LAYOUT.petra.z;
  const siq: Array<[number, number, number]> = [
    [0.3, pz - 280, 16],
    [0.322, pz - 210, 6.4],
    [0.344, pz - 140, 5.2],
    [0.366, pz - 70, 5.4],
    [0.386, pz - 28, 7.5],
  ];
  for (const [t, z, lift] of siq) {
    const x = canyonAxisX(z);
    keys.push(
      key(t, x, z, lift, { x: canyonAxisX(z + 36), y: 14, z: z + 36 }, t < 0.33 ? 66 : 58, 0),
    );
  }
  keys.push(key(0.404, canyonAxisX(pz - 14), pz - 14, 18, treasuryLook, 46, 0));
  keys.push(key(0.422, canyonAxisX(pz - 8), pz - 8, 56, { ...treasuryLook, y: treasuryTopY() }, 42, 0));
  keys.push(key(0.44, canyonAxisX(pz + 48), pz + 48, 28, { x: 0, y: 40, z: pz + 140 }, 60, 0.06));
  keys.push(key(0.458, 8, pz + 180, 16, romeLook, 60, 0));

  keys.push(key(0.478, -150, LAYOUT.rome.z - 220, 26, romeLook, 68, -0.05));
  keys.push(key(0.498, -70, LAYOUT.rome.z - 90, 16, romeLook, 60, -0.03));
  keys.push(key(0.516, -18, LAYOUT.rome.z - 72, 62, romeLook, 62, 0));
  keys.push(key(0.536, 6, LAYOUT.rome.z + 8, 6.5, { x: -10, y: 28, z: LAYOUT.rome.z - 20 }, 56, 0.02));
  keys.push(key(0.556, 24, LAYOUT.rome.z + 72, 58, romeLook, 64, 0.05));
  keys.push(key(0.576, 16, LAYOUT.rome.z + 210, 18, pyramidLook, 62, 0));

  keys.push(key(0.6, -36, LAYOUT.chichen.z - 240, 14, pyramidLook, 64, 0));
  keys.push(key(0.625, -8, LAYOUT.chichen.z - 90, 7, pyramidLook, 52, 0));
  keys.push(key(0.65, 0, LAYOUT.chichen.z - 42, 6, { x: 0, y: pyramidTopY(), z: LAYOUT.chichen.z }, 46, 0));
  keys.push(key(0.675, -42, LAYOUT.chichen.z + 6, 32, pyramidLook, 50, -0.04));
  keys.push(key(0.7, -18, LAYOUT.chichen.z + 120, 22, machuLook, 58, 0));
  keys.push(key(0.725, 0, LAYOUT.chichen.z + 240, 28, machuLook, 60, 0));

  keys.push(key(0.748, -20, LAYOUT.machu.z - 220, 36, machuLook, 64, 0));
  keys.push(key(0.772, -36, LAYOUT.machu.z - 80, 22, machuLook, 56, -0.04));
  keys.push(key(0.796, -24, LAYOUT.machu.z - 8, 14, machuLook, 50, 0));
  keys.push(key(0.82, 18, LAYOUT.machu.z + 70, 20, { x: -4, y: machuY + 10, z: LAYOUT.machu.z }, 54, 0.05));
  keys.push(key(0.845, 8, LAYOUT.machu.z + 180, 26, christLook, 60, 0));
  keys.push(key(0.868, 0, 4380, 18, christLook, 62, 0));

  keys.push(key(0.89, -8, 4490, 42, christLook, 60, 0));
  keys.push(key(0.912, 4, 4568, 34, christLook, 54, 0.02));
  keys.push(key(0.934, -8, 4648, 36, christLook, 46, 0));
  keys.push(key(0.956, -46, 4672, 30, { x: 2, y: 98 + 22, z: LAYOUT.christ.z }, 44, -0.02));
  keys.push(key(0.978, -22, 4724, 42, { x: 0, y: 98 + 16, z: LAYOUT.christ.z - 10 }, 50, 0));
  keys.push(key(1, -8, 4788, 48, { x: 0, y: 98 + 20, z: LAYOUT.christ.z }, 48, 0));

  for (let i = 1; i < keys.length; i += 1) {
    if (keys[i].t <= keys[i - 1].t) {
      throw new Error(`Flight keys are out of order at ${i}`);
    }
    if (keys[i].pos.z + 0.01 < keys[i - 1].pos.z) {
      throw new Error(`Flight z rewinds at ${i}: ${keys[i - 1].pos.z} -> ${keys[i].pos.z}`);
    }
  }
  return keys;
}

export const FLIGHT_KEYS: readonly CameraKey[] = buildKeys();

export function sampleFlight(t: number): Pose {
  const keys = FLIGHT_KEYS;
  const tt = clamp(t, 0, 1);
  if (tt <= keys[0].t) return poseOf(keys[0]);
  const last = keys[keys.length - 1];
  if (tt >= last.t) return poseOf(last);
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t < tt) i += 1;
  const a = keys[i];
  const b = keys[i + 1];
  const u = clamp((tt - a.t) / (b.t - a.t), 0, 1);
  const s = u * u * (3 - 2 * u);
  return {
    position: lerpVec(a.pos, b.pos, s),
    look: lerpVec(a.look, b.look, s),
    fov: lerp(a.fov, b.fov, s),
    roll: lerp(a.roll, b.roll, s),
  };
}

function poseOf(keyframe: CameraKey): Pose {
  return {
    position: keyframe.pos,
    look: keyframe.look,
    fov: keyframe.fov,
    roll: keyframe.roll,
  };
}

export function nearestFlightT(position: Vec3): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= 160; i += 1) {
    const t = i / 160;
    const d = dist2(sampleFlight(t).position, position);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

export function heroT(id: string): number {
  const wonder = WONDERS.find((item) => item.id === id);
  if (!wonder) throw new Error(`Unknown wonder ${id}`);
  return wonder.tHero;
}
