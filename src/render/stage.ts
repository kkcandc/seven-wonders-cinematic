import * as THREE from 'three';
import { GROUND, LAYOUT } from '../sim/layout';
import { atmosphereAtZ, WONDERS, type Atmosphere } from '../sim/wonders';
import type { RGB } from '../sim/math';
import type { Quality } from './quality';
import { softDisc } from './textures';

export interface Stage {
  update(atmo: Atmosphere, camera: THREE.Camera, time: number, wonderId: string): void;
  /** Builds image-based lighting after the first frame is already on screen. */
  warm(): void;
}

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vDir = world.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uStars;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 col = mix(uHorizon, uZenith, pow(max(h, 0.0), 0.62));
    col = mix(uHorizon * 0.9, col, smoothstep(-0.15, 0.1, h));
    float sun = clamp(max(dot(dir, normalize(uSunDir)), 0.0), 0.0, 1.0);
    col += uSunColor * pow(sun, 6.0) * 0.55;
    float disc = smoothstep(0.9975, 0.9996, sun);
    col += uSunColor * disc * 2.4;
    vec3 cell = floor(dir * 280.0);
    float hash = fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
    float stars = step(0.992, hash) * smoothstep(0.08, 0.4, h);
    col += stars * uStars * 1.6;
    col = pow(max(col, vec3(0.0)), vec3(0.454545));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const waterVertex = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec3 displaced = position;
    displaced.y += sin(position.x * 0.35 + uTime * 1.3) * 0.05;
    displaced.y += cos(position.z * 0.22 - uTime * 0.9) * 0.04;
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec2 p = vWorld.xz * 0.12;
    float w1 = sin(p.x * 2.4 + uTime * 1.2) * cos(p.y * 1.8 - uTime);
    float w2 = sin(p.y * 3.1 - uTime * 0.7);
    vec3 n = normalize(vNormal + vec3(w1, 0.0, w2) * 0.16);
    vec3 view = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, view), 0.0), 3.0);
    vec3 col = mix(uDeep, uShallow, fres);
    vec3 halfVec = normalize(normalize(uSunDir) + view);
    float spec = pow(clamp(max(dot(n, halfVec), 0.0), 0.0, 1.0), 24.0);
    col += uSunColor * spec * 1.6;
    float dist = length(cameraPosition - vWorld);
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));
    col = pow(max(col, vec3(0.0)), vec3(0.454545));
    gl_FragColor = vec4(col, mix(0.78, 0.94, fres));
  }
`;

const deckVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const deckFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    float n = sin(vWorld.x * 0.04 + uTime * 0.15) * sin(vWorld.z * 0.035 - uTime * 0.12);
    n += sin(vWorld.x * 0.09 - vWorld.z * 0.02 + uTime * 0.2) * 0.45;
    float alpha = smoothstep(0.15, 0.85, n * 0.5 + 0.5) * uOpacity;
    float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(0.0, 0.15, vUv.y);
    edge *= smoothstep(1.0, 0.85, vUv.x) * smoothstep(1.0, 0.85, vUv.y);
    float through = smoothstep(1.5, 16.0, abs(cameraPosition.y - vWorld.y));
    float dist = length(cameraPosition - vWorld);
    float fog = exp(-dist * dist * 0.000012);
    vec3 col = pow(max(uColor, vec3(0.0)), vec3(0.454545));
    gl_FragColor = vec4(col, alpha * edge * through * fog);
  }
`;

function paint(color: THREE.Color, value: RGB): void {
  color.setRGB(value.r, value.g, value.b, THREE.SRGBColorSpace);
}

export function createStage(scene: THREE.Scene, renderer: THREE.WebGLRenderer, quality: Quality): Stage {
  const zenith = new THREE.Color();
  const horizon = new THREE.Color();
  const fogColor = new THREE.Color();
  const sunColor = new THREE.Color();
  const ground = new THREE.Color();
  const sunDir = new THREE.Vector3(0, 1, 0);
  const time = { value: 0 };
  const density = { value: 0.003 };
  const stars = { value: 0 };

  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: zenith },
      uHorizon: { value: horizon },
      uSunDir: { value: sunDir },
      uSunColor: { value: sunColor },
      uStars: { value: stars },
    },
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1700, 32, 20), skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  const fog = new THREE.FogExp2(fogColor, density.value);
  scene.fog = fog;

  const hemi = new THREE.HemisphereLight(zenith, ground, 0.72);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(sunColor, 3.4);
  sun.castShadow = quality.shadow > 0;
  sun.shadow.mapSize.set(quality.shadow || 256, quality.shadow || 256);
  sun.shadow.camera.near = 12;
  sun.shadow.camera.far = 380;
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.12;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight('#d7e4f2', 0.45);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#ff7a45', 0.2);
  scene.add(rim);
  scene.add(new THREE.AmbientLight('#fff4e8', 0.12));

  const disc = softDisc();
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: disc,
      color: '#ffd0a4',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  sunSprite.scale.set(160, 160, 1);
  scene.add(sunSprite);

  const water = (width: number, depth: number, deep: string, shallow: string) => {
    const geometry = new THREE.PlaneGeometry(width, depth, 40, 40);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: time,
        uDeep: { value: new THREE.Color(deep) },
        uShallow: { value: new THREE.Color(shallow) },
        uSunDir: { value: sunDir },
        uSunColor: { value: sunColor },
        uFogColor: { value: fogColor },
        uFogDensity: density,
      },
      vertexShader: waterVertex,
      fragmentShader: waterFragment,
    });
    return new THREE.Mesh(geometry, material);
  };

  const pool = water(24, 176, '#0c4a52', '#b7d4c8');
  pool.position.set(0, GROUND.taj + 0.16, LAYOUT.taj.z - 152);
  scene.add(pool);
  const bay = water(900, 460, '#10202e', '#c46a52');
  bay.position.set(0, 0.92, 4340);
  scene.add(bay);

  const deckMat = (opacity: number, color: string) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: time,
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
      },
      vertexShader: deckVertex,
      fragmentShader: deckFragment,
    });
  const wallDeck = new THREE.Mesh(flat(1100, 820), deckMat(0.28, '#f3efe6'));
  wallDeck.position.set(0, 16, 380);
  scene.add(wallDeck);
  const andesDeck = new THREE.Mesh(flat(760, 520), deckMat(0.34, '#f7f9fb'));
  andesDeck.position.set(0, 58, LAYOUT.machu.z);
  scene.add(andesDeck);
  const cityDeck = new THREE.Mesh(flat(860, 380), deckMat(0.28, '#e7b19a'));
  cityDeck.position.set(0, 7, 4520);
  scene.add(cityDeck);
  const wallOpacity = wallDeck.material as THREE.ShaderMaterial;

  const envs = new Map<string, THREE.Texture>();
  scene.environmentIntensity = 0.78;
  let envId = '';
  let warmed = false;
  const fillOffset = new THREE.Vector3();

  return {
    warm() {
      if (warmed) return;
      warmed = true;
      try {
        for (const [id, texture] of bakeEnvironments(renderer)) envs.set(id, texture);
      } catch {
        // Sky, sun, and fog still light the passage if the probe fails.
      }
    },
    update(atmo, camera, elapsed, wonderId) {
      time.value = elapsed;
      density.value = atmo.density;
      stars.value = atmo.stars;
      paint(zenith, atmo.zenith);
      paint(horizon, atmo.horizon);
      paint(fogColor, atmo.fog);
      paint(sunColor, atmo.sun);
      paint(ground, atmo.ground);
      sunDir.set(atmo.sunDir.x, atmo.sunDir.y, atmo.sunDir.z);
      fog.density = atmo.density;
      renderer.setClearColor(horizon);
      sky.position.copy(camera.position);
      const position = camera.position;
      sun.position.copy(position).addScaledVector(sunDir, 240);
      sun.target.position.copy(position);
      sun.target.updateMatrixWorld();
      fillOffset.set(-sunDir.x, 0.45, -sunDir.z).multiplyScalar(180);
      fill.position.copy(position).add(fillOffset);
      const dusk = Math.min(1, Math.max(0, (position.z - 4300) / 400));
      rim.intensity = 0.15 + dusk * 1.25;
      rim.position.set(position.x + 40, position.y + 20, position.z - 80);
      sunSprite.position.copy(position).addScaledVector(sunDir, 900);
      sunSprite.material.color.copy(sunColor);
      const sprite = sunSprite.material as THREE.SpriteMaterial;
      sprite.opacity = sunDir.y > 0.05 ? 0.95 : 0;
      (wallOpacity.uniforms.uOpacity as { value: number }).value = 0.1 + atmo.mist * 0.2;
      if (wonderId !== envId) {
        const next = envs.get(wonderId);
        if (next) scene.environment = next;
        envId = wonderId;
      }
    },
  };
}

function flat(width: number, depth: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, depth, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function bakeEnvironments(renderer: THREE.WebGLRenderer): Map<string, THREE.Texture> {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = new THREE.WebGLCubeRenderTarget(64);
  const camera = new THREE.CubeCamera(0.1, 30, target);
  const bakeZenith = new THREE.Color();
  const bakeHorizon = new THREE.Color();
  const bakeSun = new THREE.Color();
  const bakeDir = new THREE.Vector3();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: bakeZenith },
      uHorizon: { value: bakeHorizon },
      uSunDir: { value: bakeDir },
      uSunColor: { value: bakeSun },
      uStars: { value: 0 },
    },
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
  });
  const bakeScene = new THREE.Scene();
  bakeScene.add(new THREE.Mesh(new THREE.SphereGeometry(12, 16, 12), material));
  const map = new Map<string, THREE.Texture>();
  for (const wonder of WONDERS) {
    const atmo = atmosphereAtZ(wonder.z);
    paint(bakeZenith, atmo.zenith);
    paint(bakeHorizon, atmo.horizon);
    paint(bakeSun, atmo.sun);
    bakeDir.set(atmo.sunDir.x, atmo.sunDir.y, atmo.sunDir.z);
    (material.uniforms.uStars as { value: number }).value = atmo.stars;
    camera.update(renderer, bakeScene);
    map.set(wonder.id, pmrem.fromCubemap(target.texture).texture);
  }
  pmrem.dispose();
  target.dispose();
  renderer.setRenderTarget(null);
  return map;
}
