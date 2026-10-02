/** Shared site plan. Landmarks, terrain pads, and the flight all read these numbers. */

export const LAYOUT = {
  wallZ0: 24,
  wallZ1: 700,
  taj: { x: 0, z: 1080 },
  petra: { x: 0, z: 1800 },
  rome: { x: 0, z: 2520, a: 88, b: 72, wallH: 46 },
  chichen: { x: 0, z: 3240, base: 56, stepH: 2.55, levels: 9 },
  machu: { x: 0, z: 3960 },
  christ: { x: 0, z: 4680 },
  endZ: 5050,
} as const;

export const GROUND = {
  taj: 2.15,
  rome: 2.35,
  chichen: 4.35,
  petraCourt: 3.2,
  city: 2.05,
  water: 0.72,
  summit: 98,
} as const;

export const TAJ = {
  plinthW: 118,
  plinthD: 118,
  plinthH: 6.4,
  body: 54,
  bodyH: 26,
  drumH: 5.5,
  drumR: 10,
  domeR: 12.4,
  minaretH: 44,
} as const;

export const TREASURY = {
  width: 26,
  depth: 9,
  height: 40,
} as const;

/** Half-width of the open Siq floor, center to inner wall face. */
export const SIQ_HALF = 7.4;

export function tajDomeY(): number {
  return GROUND.taj + TAJ.plinthH + TAJ.bodyH + TAJ.drumH + TAJ.domeR * 0.35;
}

export function treasuryTopY(): number {
  return GROUND.petraCourt + TREASURY.height;
}

export function pyramidTopY(): number {
  return GROUND.chichen + LAYOUT.chichen.levels * LAYOUT.chichen.stepH + 7.5;
}

export function wallAxisX(z: number): number {
  return Math.sin(z * 0.011) * 54 + Math.sin(z * 0.0042 + 1.2) * 24;
}

export function canyonAxisX(z: number): number {
  return Math.sin((z - LAYOUT.petra.z) * 0.01) * 14;
}

/** Spine of the journey. The wall and the Siq bend; every other wonder sits on x = 0. */
export function routeX(z: number): number {
  if (z <= 760) return wallAxisX(z);
  const tail = wallAxisX(760);
  if (z < LAYOUT.taj.z) {
    const u = (z - 760) / (LAYOUT.taj.z - 760);
    return tail * (1 - u * u * (3 - 2 * u));
  }
  if (z < LAYOUT.petra.z + 40) {
    const u = Math.min(1, Math.max(0, (z - (LAYOUT.petra.z - 320)) / 180));
    const s = u * u * (3 - 2 * u);
    return canyonAxisX(z) * s;
  }
  const leave = canyonAxisX(LAYOUT.petra.z);
  if (z < LAYOUT.rome.z - 80) {
    const u = (z - (LAYOUT.petra.z + 40)) / (LAYOUT.rome.z - 80 - (LAYOUT.petra.z + 40));
    const s = Math.min(1, Math.max(0, u));
    return leave * (1 - s);
  }
  return 0;
}
