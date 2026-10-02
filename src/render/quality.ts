export interface Quality {
  mobile: boolean;
  segments: number;
  chunk: number;
  gridX: number;
  gridZ: number;
  density: number;
  shadow: number;
  dpr: number;
  bloom: number;
}

export function detectQuality(): Quality {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth < 900;
  const cores = navigator.hardwareConcurrency || 8;
  const mobile = coarse || narrow || cores <= 4;
  if (mobile) {
    return {
      mobile: true,
      segments: 16,
      chunk: 220,
      gridX: 3,
      gridZ: 3,
      density: 0.48,
      shadow: 0,
      dpr: Math.min(window.devicePixelRatio || 1, 1.25),
      bloom: 0.28,
    };
  }
  return {
    mobile: false,
    segments: 30,
    chunk: 192,
    gridX: 5,
    gridZ: 5,
    density: 1,
    shadow: 2048,
    dpr: Math.min(window.devicePixelRatio || 1, 1.6),
    bloom: 0.42,
  };
}
