import { LAYOUT, GROUND, canyonAxisX, routeX, wallAxisX } from './layout';
import { fbm, lerp, mixRgb, rgb, smoothstep, valueNoise, type RGB, type Vec3 } from './math';

/**
 * Continuous land from the Yan ridges to Corcovado.
 * Wonders are pads and silhouettes on this one surface, not separate maps.
 */
export function terrainHeight(x: number, z: number): number {
  const hills = 8 + fbm(x * 0.011, z * 0.011, 4) * 14 + fbm(x * 0.03, z * 0.03, 2) * 3.2;

  const wallFade = (1 - smoothstep(640, 880, z)) * smoothstep(-30, 80, z);
  const axis = wallAxisX(z);
  const dx = x - axis;
  const ridge =
    Math.exp(-(dx * dx) / (2 * 26 * 26)) *
    (36 + Math.sin(z * 0.021) * 5.5 + Math.sin(z * 0.0073) * 7);
  const range = fbm(x * 0.0075 + 4.2, z * 0.0075, 4) * 28;
  const wallH = Math.max(range * 0.72, ridge + 7) + fbm(x * 0.02, z * 0.02, 2) * 2.4;

  const plains = 2.15 + fbm(x * 0.02 + 8, z * 0.02, 3) * 1.15;
  const desert = 5.5 + fbm(x * 0.009 + 2, z * 0.009, 3) * 12 + Math.abs(Math.sin(x * 0.018)) * 3.2;
  const roman = 2.3 + fbm(x * 0.022 + 1.4, z * 0.022, 2) * 0.9;
  const jungle = 4.1 + fbm(x * 0.017, z * 0.017 + 3.1, 4) * 8.5;

  const md = Math.hypot(x - LAYOUT.machu.x, (z - LAYOUT.machu.z) * 0.92);
  const peak = Math.exp(-(md * md) / (2 * 68 * 68)) * 74;
  const huayna = Math.exp(-Math.pow(Math.hypot(x - 110, z - LAYOUT.machu.z - 30), 2) / (2 * 46 * 46)) * 62;
  const puna = Math.exp(-Math.pow(Math.hypot(x + 86, z - LAYOUT.machu.z + 24), 2) / (2 * 42 * 42)) * 54;
  let andes = 26 + peak + huayna + puna + fbm(x * 0.018, z * 0.018, 3) * 6;
  const terrace = Math.exp(-(md * md) / (2 * 46 * 46));
  andes = lerp(andes, Math.round(andes / 2.5) * 2.5, terrace * 0.88);

  const cr = Math.hypot(x * 0.9, z - LAYOUT.christ.z);
  const corcovado = Math.exp(-(cr * cr) / (2 * 46 * 46)) * 90;
  const sugar = Math.exp(-Math.pow(Math.hypot(x - 150, z - LAYOUT.christ.z + 40), 2) / (2 * 38 * 38)) * 34;
  const coast = 1.15 + fbm(x * 0.014 + 5, z * 0.014, 3) * 2.4;
  const rio = coast + corcovado + sugar;

  let h = hills;
  h = lerp(h, wallH, wallFade);

  const toPlains = smoothstep(700, 940, z) * (1 - smoothstep(1280, 1480, z));
  h = lerp(h, plains, toPlains);

  const desertW = smoothstep(1340, 1540, z) * (1 - smoothstep(2100, 2300, z));
  h = lerp(h, desert, desertW);

  const romanW = smoothstep(2080, 2300, z) * (1 - smoothstep(2860, 3080, z));
  h = lerp(h, roman, romanW);

  const jungleW = smoothstep(2920, 3140, z) * (1 - smoothstep(3580, 3780, z));
  h = lerp(h, jungle, jungleW);

  const andesW = smoothstep(3660, 3860, z) * (1 - smoothstep(4180, 4360, z));
  h = lerp(h, andes, andesW);

  const rioW = smoothstep(4280, 4460, z);
  h = lerp(h, rio, rioW);

  h = flattenDisk(h, x, z, LAYOUT.taj.x, LAYOUT.taj.z, 160, 210, GROUND.taj);
  h = flattenDisk(h, x, z, LAYOUT.rome.x, LAYOUT.rome.z, 130, 120, GROUND.rome);
  h = flattenDisk(h, x, z, LAYOUT.chichen.x, LAYOUT.chichen.z, 86, 86, GROUND.chichen);
  h = flattenRect(h, x, z, 4220, 4470, -340, 340, 0.42, 48);
  h = flattenRect(h, x, z, 4460, 4595, -210, 210, GROUND.city, 36);

  const pz = LAYOUT.petra.z;
  const cAxis = canyonAxisX(z);
  const cd = Math.abs(x - cAxis);
  const along = smoothstep(pz - 290, pz - 250, z) * (1 - smoothstep(pz + 8, pz + 42, z));
  const across = 1 - smoothstep(12, 34, cd);
  h = lerp(h, GROUND.petraCourt, along * across);

  const cliff =
    Math.exp(-(cd * cd) / (2 * 30 * 30)) *
    smoothstep(pz + 6, pz + 24, z) *
    (1 - smoothstep(pz + 78, pz + 160, z));
  h = lerp(h, Math.max(h, 54), cliff);

  const summitW = 1 - smoothstep(5, 12, Math.hypot(x, z - LAYOUT.christ.z));
  h = lerp(h, GROUND.summit, summitW * rioW);

  return h;
}

function flattenDisk(
  h: number,
  x: number,
  z: number,
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  target: number,
): number {
  const d = Math.hypot((x - cx) / rx, (z - cz) / rz);
  const w = 1 - smoothstep(0.62, 1, d);
  return lerp(h, target, w);
}

function flattenRect(
  h: number,
  x: number,
  z: number,
  z0: number,
  z1: number,
  x0: number,
  x1: number,
  target: number,
  feather: number,
): number {
  const wz = smoothstep(z0 - feather, z0, z) * (1 - smoothstep(z1, z1 + feather, z));
  const wx = smoothstep(x0 - feather, x0, x) * (1 - smoothstep(x1, x1 + feather, x));
  return lerp(h, target, wz * wx);
}

interface BiomeStop {
  z: number;
  flat: RGB;
  steep: RGB;
}

const BIOMES: readonly BiomeStop[] = [
  { z: 160, flat: rgb('#6d8a45'), steep: rgb('#8a7d68') },
  { z: 720, flat: rgb('#7d9550'), steep: rgb('#91826c') },
  { z: LAYOUT.taj.z, flat: rgb('#8ea85a'), steep: rgb('#cbb892') },
  { z: 1500, flat: rgb('#b07a52'), steep: rgb('#a86448') },
  { z: LAYOUT.petra.z, flat: rgb('#c48962'), steep: rgb('#b56a4e') },
  { z: 2300, flat: rgb('#c2a15a'), steep: rgb('#b49668') },
  { z: LAYOUT.rome.z, flat: rgb('#d2b56e'), steep: rgb('#e4d2ae') },
  { z: 3000, flat: rgb('#2f6a32'), steep: rgb('#4a4634') },
  { z: LAYOUT.chichen.z, flat: rgb('#2a6230'), steep: rgb('#6d6848') },
  { z: LAYOUT.machu.z, flat: rgb('#6e8f48'), steep: rgb('#8e8a80') },
  { z: 4400, flat: rgb('#3e6a3a'), steep: rgb('#6d6a60') },
  { z: LAYOUT.christ.z, flat: rgb('#3a5a34'), steep: rgb('#6a6560') },
];

function biomeAt(z: number): { flat: RGB; steep: RGB } {
  if (z <= BIOMES[0].z) return BIOMES[0];
  const last = BIOMES[BIOMES.length - 1];
  if (z >= last.z) return last;
  let i = 0;
  while (i < BIOMES.length - 1 && BIOMES[i + 1].z < z) i += 1;
  const a = BIOMES[i];
  const b = BIOMES[i + 1];
  const t = (z - a.z) / (b.z - a.z);
  return { flat: mixRgb(a.flat, b.flat, t), steep: mixRgb(a.steep, b.steep, t) };
}

/** sRGB albedo for a terrain sample. Slope is rise/run. */
export function terrainColor(x: number, z: number, height: number, slope: number): RGB {
  const biome = biomeAt(z);
  const rock = smoothstep(0.42, 1.15, slope);
  let color = mixRgb(biome.flat, biome.steep, rock);

  const snowBand = (z < 900 ? smoothstep(48, 66, height) : 0) + (z > 3700 && z < 4450 ? smoothstep(62, 84, height) : 0);
  color = mixRgb(color, rgb('#e7eef2'), Math.min(1, snowBand) * (1 - smoothstep(1.1, 1.8, slope)));

  const blotch = 0.86 + valueNoise(x * 0.07, z * 0.07) * 0.28;
  color = { r: color.r * blotch, g: color.g * blotch, b: color.b * blotch };

  if (height < 15 && z < 820) {
    color = mixRgb(color, rgb('#8d8478'), 0.22);
  }

  const nearTaj = Math.exp(-(x * x + Math.pow(z - LAYOUT.taj.z, 2)) / (2 * 130 * 130));
  color = mixRgb(color, rgb('#d9cbb0'), nearTaj * 0.55 * (1 - rock));

  const road = Math.abs(x - routeX(z));
  if (road < 5.5 && height < 28 && z > 760 && z < 4400) {
    color = mixRgb(color, rgb('#8a704c'), (1 - road / 5.5) * 0.5);
  }

  return {
    r: Math.min(1, color.r),
    g: Math.min(1, color.g),
    b: Math.min(1, color.b),
  };
}

export function terrainNormal(x: number, z: number, e = 1.4): Vec3 {
  const hx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
  const hz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
  const ny = e * 2;
  const len = Math.hypot(hx, ny, hz) || 1;
  return { x: -hx / len, y: ny / len, z: -hz / len };
}
