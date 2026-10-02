import { clamp, lerp, mixRgb, rgb, type RGB, type Vec3 } from './math';
import { LAYOUT } from './layout';

export interface Wonder {
  id: string;
  name: string;
  place: string;
  chip: string;
  /** Timeline span, 0–1, contiguous across the film. */
  t0: number;
  t1: number;
  /** Hero frame used by the wonder chips. */
  tHero: number;
  z: number;
}

export const WONDERS: readonly Wonder[] = [
  {
    id: 'wall',
    name: 'Great Wall',
    place: 'Yan Mountains',
    chip: 'Wall',
    t0: 0,
    t1: 0.15,
    tHero: 0.055,
    z: 340,
  },
  {
    id: 'taj',
    name: 'Taj Mahal',
    place: 'Agra',
    chip: 'Taj',
    t0: 0.15,
    t1: 0.3,
    tHero: 0.22,
    z: LAYOUT.taj.z,
  },
  {
    id: 'petra',
    name: 'Petra',
    place: 'The Siq',
    chip: 'Petra',
    t0: 0.3,
    t1: 0.45,
    tHero: 0.4,
    z: LAYOUT.petra.z,
  },
  {
    id: 'rome',
    name: 'Colosseum',
    place: 'Rome',
    chip: 'Rome',
    t0: 0.45,
    t1: 0.6,
    tHero: 0.53,
    z: LAYOUT.rome.z,
  },
  {
    id: 'chichen',
    name: 'Chichén Itzá',
    place: 'Yucatán',
    chip: 'Yucatán',
    t0: 0.6,
    t1: 0.74,
    tHero: 0.67,
    z: LAYOUT.chichen.z,
  },
  {
    id: 'machu',
    name: 'Machu Picchu',
    place: 'Andean ridge',
    chip: 'Andes',
    t0: 0.74,
    t1: 0.88,
    tHero: 0.81,
    z: LAYOUT.machu.z,
  },
  {
    id: 'christ',
    name: 'Christ the Redeemer',
    place: 'Corcovado',
    chip: 'Redeemer',
    t0: 0.88,
    t1: 1,
    tHero: 0.955,
    z: LAYOUT.christ.z,
  },
];

export const FLIGHT_SECONDS = 96;

export function wonderAtT(t: number): Wonder {
  const tt = clamp(t, 0, 1);
  for (let i = WONDERS.length - 1; i >= 0; i -= 1) {
    if (tt >= WONDERS[i].t0) return WONDERS[i];
  }
  return WONDERS[0];
}

export function wonderAtZ(z: number): Wonder {
  let best: Wonder = WONDERS[0];
  let bestD = Infinity;
  for (const wonder of WONDERS) {
    const d = Math.abs(wonder.z - z);
    if (d < bestD) {
      bestD = d;
      best = wonder;
    }
  }
  return best;
}

export interface Atmosphere {
  zenith: RGB;
  horizon: RGB;
  fog: RGB;
  sun: RGB;
  ground: RGB;
  /** From the scene toward the sun. */
  sunDir: Vec3;
  density: number;
  exposure: number;
  stars: number;
  mist: number;
}

interface AtmoKey extends Atmosphere {
  z: number;
}

function sun(x: number, y: number, z: number): Vec3 {
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

const ATMO: readonly AtmoKey[] = [
  {
    z: 180,
    zenith: rgb('#16375f'),
    horizon: rgb('#f2b27a'),
    fog: rgb('#e4c7a4'),
    sun: rgb('#ffc27a'),
    ground: rgb('#6a5038'),
    sunDir: sun(-0.55, 0.34, 0.78),
    density: 0.0033,
    exposure: 1.12,
    stars: 0,
    mist: 0.72,
  },
  {
    z: LAYOUT.taj.z,
    zenith: rgb('#8eb6d6'),
    horizon: rgb('#f8d7c6'),
    fog: rgb('#f3e6dc'),
    sun: rgb('#ffe0c2'),
    ground: rgb('#c4b09a'),
    sunDir: sun(-0.15, 0.62, -0.72),
    density: 0.00235,
    exposure: 1.16,
    stars: 0,
    mist: 0.18,
  },
  {
    z: LAYOUT.petra.z,
    zenith: rgb('#24344d'),
    horizon: rgb('#e39a74'),
    fog: rgb('#c4896c'),
    sun: rgb('#ffb080'),
    ground: rgb('#7a4634'),
    sunDir: sun(0.25, 0.72, -0.42),
    density: 0.0044,
    exposure: 1.02,
    stars: 0,
    mist: 0.08,
  },
  {
    z: LAYOUT.rome.z,
    zenith: rgb('#3c7ec8'),
    horizon: rgb('#f6d7a6'),
    fog: rgb('#f0e0c8'),
    sun: rgb('#fff0d2'),
    ground: rgb('#b3966a'),
    sunDir: sun(0.62, 0.58, 0.28),
    density: 0.00215,
    exposure: 1.18,
    stars: 0,
    mist: 0.05,
  },
  {
    z: LAYOUT.chichen.z,
    zenith: rgb('#1c5c62'),
    horizon: rgb('#d5e4c4'),
    fog: rgb('#b7cba8'),
    sun: rgb('#fff2d0'),
    ground: rgb('#3d4a28'),
    sunDir: sun(-0.35, 0.78, 0.42),
    density: 0.00305,
    exposure: 1.06,
    stars: 0,
    mist: 0.22,
  },
  {
    z: LAYOUT.machu.z,
    zenith: rgb('#79a6cc'),
    horizon: rgb('#e7eef3'),
    fog: rgb('#d5e2ea'),
    sun: rgb('#fff6e8'),
    ground: rgb('#8aa07a'),
    sunDir: sun(0.2, 0.86, 0.28),
    density: 0.00185,
    exposure: 1.14,
    stars: 0,
    mist: 0.55,
  },
  {
    z: LAYOUT.christ.z,
    zenith: rgb('#14182e'),
    horizon: rgb('#e36a48'),
    fog: rgb('#c46d62'),
    sun: rgb('#ffb089'),
    ground: rgb('#3a2428'),
    sunDir: sun(-0.72, 0.18, -0.48),
    density: 0.0025,
    exposure: 1.08,
    stars: 0.72,
    mist: 0.28,
  },
];

function lerpSun(a: Vec3, b: Vec3, t: number): Vec3 {
  const x = lerp(a.x, b.x, t);
  const y = lerp(a.y, b.y, t);
  const z = lerp(a.z, b.z, t);
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

export function atmosphereAtZ(z: number): Atmosphere {
  if (z <= ATMO[0].z) {
    const { z: _z, ...rest } = ATMO[0];
    return rest;
  }
  const last = ATMO[ATMO.length - 1];
  if (z >= last.z) {
    const { z: _z, ...rest } = last;
    return rest;
  }
  let i = 0;
  while (i < ATMO.length - 1 && ATMO[i + 1].z < z) i += 1;
  const a = ATMO[i];
  const b = ATMO[i + 1];
  const t = (z - a.z) / (b.z - a.z);
  return {
    zenith: mixRgb(a.zenith, b.zenith, t),
    horizon: mixRgb(a.horizon, b.horizon, t),
    fog: mixRgb(a.fog, b.fog, t),
    sun: mixRgb(a.sun, b.sun, t),
    ground: mixRgb(a.ground, b.ground, t),
    sunDir: lerpSun(a.sunDir, b.sunDir, t),
    density: lerp(a.density, b.density, t),
    exposure: lerp(a.exposure, b.exposure, t),
    stars: lerp(a.stars, b.stars, t),
    mist: lerp(a.mist, b.mist, t),
  };
}
