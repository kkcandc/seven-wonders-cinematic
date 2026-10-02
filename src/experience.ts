import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createScore } from './audio';
import { addLandmarks } from './render/landmarks';
import { addLife } from './render/life';
import { detectQuality } from './render/quality';
import { createStage } from './render/stage';
import { createTerrain } from './render/terrainView';
import { FLIGHT_SECONDS, nearestFlightT, sampleFlight, type Pose } from './sim/flight';
import { clamp } from './sim/math';
import { terrainHeight } from './sim/terrain';
import { atmosphereAtZ, WONDERS, wonderAtT, wonderAtZ } from './sim/wonders';
import type { Hud } from './ui';

interface OrbitState {
  target: THREE.Vector3;
  theta: number;
  phi: number;
  radius: number;
}

interface Tween {
  from: number;
  to: number;
  u: number;
  duration: number;
  then?: () => void;
}

type Mode = 'cinematic' | 'orbit' | 'fly';

const gradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float dist = distance(vUv, vec2(0.5));
      float vig = smoothstep(0.95, 0.25, dist);
      col *= mix(1.0, vig, 0.42);
      float grain = fract(sin(dot(vUv * vec2(920.0, 640.0) + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      col += (grain - 0.5) * 0.015;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function startExperience(canvas: HTMLCanvasElement, hud: Hud): void {
  const quality = detectQuality();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !quality.mobile,
      powerPreference: 'high-performance',
      alpha: false,
    });
  } catch {
    hud.fail('This passage needs WebGL.');
    return;
  }

  renderer.setPixelRatio(quality.dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = quality.shadow > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor('#e7c9a4');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.35, 4500);
  const terrain = createTerrain(scene, quality);
  const landmarks = addLandmarks(scene, quality);
  const life = addLife(scene, quality);
  const stage = createStage(scene, renderer, quality);
  const score = createScore();

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), quality.bloom, 0.7, 0.84);
  composer.addPass(bloom);
  const grade = new ShaderPass(gradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  let lastFrame = performance.now();
  const pressed = new Set<string>();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const orbit: OrbitState = {
    target: new THREE.Vector3(),
    theta: 0,
    phi: 1,
    radius: 40,
  };

  const params = new URLSearchParams(window.location.search);
  const startT = Number(params.get('t'));
  const state = {
    mode: 'cinematic' as Mode,
    t: Number.isFinite(startT) ? clamp(startT, 0, 1) : 0,
    playing: params.get('pause') === '1' ? false : true,
    yaw: 0,
    pitch: 0,
    tween: null as Tween | null,
    iris: false,
    degraded: false,
    slow: 0,
    elapsed: 0,
  };

  const iris = document.querySelector<HTMLElement>('#iris');
  const duration = reduceMotion ? FLIGHT_SECONDS * 1.35 : FLIGHT_SECONDS;
  const rollScale = reduceMotion ? 0 : 1;

  function exploring(): boolean {
    return state.mode !== 'cinematic';
  }

  function syncHud(): void {
    const wonder = exploring() ? wonderAtZ(camera.position.z) : wonderAtT(state.t);
    const index = WONDERS.findIndex((item) => item.id === wonder.id);
    hud.setWonder(wonder.name, wonder.place, index);
    hud.setPlaying(state.playing, exploring());
    hud.setProgress(state.t);
    hud.setSound(score.enabled);
  }

  function applyPose(pose: Pose): void {
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(pose.look.x, pose.look.y, pose.look.z);
    camera.rotateZ(pose.roll * rollScale);
    if (Math.abs(camera.fov - pose.fov) > 0.04) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
  }

  function keepAboveGround(): void {
    const ground = terrainHeight(camera.position.x, camera.position.z) + 1.2;
    if (camera.position.y < ground) camera.position.y = ground;
  }

  function enterFly(): void {
    if (state.mode === 'fly') return;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    state.yaw = Math.atan2(direction.x, -direction.z);
    state.pitch = Math.asin(clamp(direction.y, -1, 1));
    state.mode = 'fly';
    state.playing = false;
    state.tween = null;
  }

  function enterOrbit(target: { x: number; y: number; z: number }): void {
    orbit.target.set(target.x, target.y, target.z);
    const offset = camera.position.clone().sub(orbit.target);
    orbit.radius = clamp(offset.length(), 10, 220);
    orbit.phi = Math.acos(clamp(offset.y / orbit.radius, -1, 1));
    orbit.theta = Math.atan2(offset.x, offset.z);
    state.mode = 'orbit';
    state.playing = false;
    state.tween = null;
  }

  function resumeFilm(): void {
    if (state.mode !== 'cinematic') state.t = nearestFlightT(camera.position);
    state.mode = 'cinematic';
    state.playing = true;
    state.tween = null;
  }

  function goToWonder(index: number): void {
    const wonder = WONDERS[index];
    if (!wonder) return;
    const from = state.mode === 'cinematic' ? state.t : nearestFlightT(camera.position);
    state.mode = 'cinematic';
    state.playing = false;
    state.tween = {
      from,
      to: wonder.tHero,
      u: 0,
      duration: reduceMotion ? 0.4 : 2.35,
      then: () => {
        state.t = wonder.tHero;
        const pose = sampleFlight(wonder.tHero);
        applyPose(pose);
        enterOrbit(pose.look);
      },
    };
  }

  hud.onPlay(() => {
    if (exploring()) resumeFilm();
    else state.playing = !state.playing;
    syncHud();
  });
  hud.onScrub((t) => {
    state.tween = null;
    state.iris = false;
    iris?.classList.remove('on');
    state.t = clamp(t, 0, 1);
    state.mode = 'cinematic';
    applyPose(sampleFlight(state.t));
    syncHud();
  });
  hud.onChip((index) => {
    goToWonder(index);
    syncHud();
  });
  hud.onSound(() => {
    score.toggle();
    syncHud();
  });
  hud.onFull(() => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
    else void document.exitFullscreen();
  });

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement) return;
    pressed.add(event.code);
    if (event.code === 'Space') {
      event.preventDefault();
      if (exploring()) resumeFilm();
      else state.playing = !state.playing;
      syncHud();
    }
    if (event.code === 'KeyM') {
      score.toggle();
      syncHud();
    }
    if (event.code === 'Digit1') goToWonder(0);
    if (event.code === 'Digit2') goToWonder(1);
    if (event.code === 'Digit3') goToWonder(2);
    if (event.code === 'Digit4') goToWonder(3);
    if (event.code === 'Digit5') goToWonder(4);
    if (event.code === 'Digit6') goToWonder(5);
    if (event.code === 'Digit7') goToWonder(6);
    if (event.code === 'KeyF') {
      if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
    }
  });
  window.addEventListener('keyup', (event) => {
    pressed.delete(event.code);
  });

  let dragging = false;
  let moved = false;
  let lastX = 0;
  let lastY = 0;
  const pointers = new Map<number, { x: number; y: number }>();

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    moved = false;
    lastX = event.clientX;
    lastY = event.clientY;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const gap = Math.hypot(a.x - b.x, a.y - b.y);
      const previous = Number(canvas.dataset.pinch || gap);
      const delta = gap - previous;
      canvas.dataset.pinch = String(gap);
      if (state.mode === 'orbit') orbit.radius = clamp(orbit.radius - delta * 0.12, 8, 240);
      else {
        camera.fov = clamp(camera.fov - delta * 0.04, 36, 82);
        camera.updateProjectionMatrix();
      }
      return;
    }
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (!moved && dx * dx + dy * dy < 36) return;
    if (!moved && state.mode === 'cinematic') enterFly();
    moved = true;
    if (state.mode === 'orbit') {
      orbit.theta -= dx * 0.005;
      orbit.phi = clamp(orbit.phi + dy * 0.004, 0.16, 1.38);
    } else if (state.mode === 'fly') {
      state.yaw += dx * 0.0032;
      state.pitch = clamp(state.pitch - dy * 0.0028, -1.15, 1.15);
    }
  });
  const endDrag = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) delete canvas.dataset.pinch;
    dragging = false;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      if (state.mode === 'orbit') {
        orbit.radius = clamp(orbit.radius * (event.deltaY > 0 ? 1.08 : 0.92), 8, 240);
      } else if (state.mode === 'fly') {
        camera.getWorldDirection(forward);
        camera.position.addScaledVector(forward, event.deltaY < 0 ? 6 : -6);
      } else {
        state.t = clamp(state.t + Math.sign(event.deltaY) * 0.0035, 0, 1);
        state.playing = false;
      }
    },
    { passive: false },
  );

  function resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
  }
  window.addEventListener('resize', resize);

  function beginIris(): void {
    if (state.iris) return;
    state.iris = true;
    iris?.classList.add('on');
    window.setTimeout(() => {
      state.t = 0;
      iris?.classList.remove('on');
      window.setTimeout(() => {
        state.iris = false;
      }, 700);
    }, 680);
  }

  applyPose(sampleFlight(0));
  terrain.update(camera.position.x, camera.position.z);
  const opening = atmosphereAtZ(camera.position.z);
  renderer.toneMappingExposure = opening.exposure;
  stage.update(opening, camera, 0, wonderAtZ(camera.position.z).id);
  composer.render();
  hud.ready();
  syncHud();

  function frame(): void {
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    state.elapsed += dt;
    const move =
      (pressed.has('KeyW') ? 1 : 0) -
      (pressed.has('KeyS') ? 1 : 0) +
      ((pressed.has('KeyA') ? 1 : 0) - (pressed.has('KeyD') ? 1 : 0)) +
      ((pressed.has('KeyE') ? 1 : 0) - (pressed.has('KeyQ') ? 1 : 0));
    if (move !== 0) enterFly();

    if (state.tween) {
      state.tween.u += dt / state.tween.duration;
      const u = clamp(state.tween.u, 0, 1);
      const s = u * u * (3 - 2 * u);
      state.t = state.tween.from + (state.tween.to - state.tween.from) * s;
      if (state.tween.u >= 1) {
        const done = state.tween.then;
        state.tween = null;
        done?.();
      }
    } else if (state.playing && state.mode === 'cinematic' && !state.iris) {
      state.t += dt / duration;
      if (state.t >= 1) {
        state.t = 1;
        beginIris();
      }
    }

    if (state.mode === 'cinematic') {
      applyPose(sampleFlight(state.t));
    } else if (state.mode === 'orbit') {
      const sin = Math.sin(orbit.phi);
      camera.position.set(
        orbit.target.x + orbit.radius * sin * Math.sin(orbit.theta),
        orbit.target.y + orbit.radius * Math.cos(orbit.phi),
        orbit.target.z + orbit.radius * sin * Math.cos(orbit.theta),
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(orbit.target);
    } else {
      camera.rotation.order = 'YXZ';
      camera.rotation.set(state.pitch, state.yaw, 0);
      camera.getWorldDirection(forward);
      right.crossVectors(forward, camera.up).normalize();
      const speed = (pressed.has('ShiftLeft') || pressed.has('ShiftRight') ? 78 : 34) * dt;
      const ahead = (pressed.has('KeyW') ? 1 : 0) - (pressed.has('KeyS') ? 1 : 0);
      const strafe = (pressed.has('KeyD') ? 1 : 0) - (pressed.has('KeyA') ? 1 : 0);
      const lift = (pressed.has('KeyE') ? 1 : 0) - (pressed.has('KeyQ') ? 1 : 0);
      camera.position.addScaledVector(forward, ahead * speed);
      camera.position.addScaledVector(right, strafe * speed);
      camera.position.y += lift * speed;
    }

    keepAboveGround();
    terrain.update(camera.position.x, camera.position.z);
    const atmo = atmosphereAtZ(camera.position.z);
    renderer.toneMappingExposure = atmo.exposure;
    stage.update(atmo, camera, state.elapsed, wonderAtZ(camera.position.z).id);
    life.update(state.elapsed, camera.position);
    for (const flag of landmarks.flags) {
      flag.rotation.y = Math.sin(state.elapsed * 2.6 + flag.position.x) * 0.55;
    }
    for (const shaft of landmarks.shafts) {
      const material = shaft.material as THREE.MeshBasicMaterial;
      const dist = camera.position.distanceTo(shaft.position);
      material.opacity = dist < 16 ? 0.015 : 0.065 + Math.sin(state.elapsed * 0.8 + shaft.position.z) * 0.02;
    }
    (grade.uniforms.uTime as { value: number }).value = state.elapsed;
    score.setPlace(camera.position.z);
    composer.render();
    syncHud();

    if (!state.degraded && state.elapsed > 2.5) {
      if (dt > 0.045) state.slow += 1;
      else state.slow = Math.max(0, state.slow - 1);
      if (state.slow > 24) {
        state.degraded = true;
        renderer.setPixelRatio(1);
        renderer.shadowMap.enabled = false;
        bloom.strength = 0.18;
        composer.setPixelRatio(1);
      }
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
