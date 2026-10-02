import * as THREE from 'three';
import { srgbToLinear } from '../sim/math';
import { terrainColor, terrainHeight } from '../sim/terrain';
import type { Quality } from './quality';

interface Chunk {
  ix: number;
  iz: number;
  mesh: THREE.Mesh;
}

/**
 * A sliding patch of the continuous world. Chunks recycle as the camera flies
 * so the whole passage stays one landscape instead of a loaded scene list.
 */
export function createTerrain(scene: THREE.Scene, quality: Quality): { update(x: number, z: number): void } {
  const { chunk: size, segments: seg, gridX, gridZ } = quality;
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
  });
  const pool: Chunk[] = [];
  const originX = Math.floor(gridX / 2);
  const originZ = Math.floor(gridZ / 2);

  for (let jz = 0; jz < gridZ; jz += 1) {
    for (let jx = 0; jx < gridX; jx += 1) {
      const geometry = new THREE.PlaneGeometry(size, size, seg, seg);
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(size / 2, 0, size / 2);
      const colors = new Float32Array((seg + 1) * (seg + 1) * 3);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mesh = new THREE.Mesh(geometry, material);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      scene.add(mesh);
      pool.push({ ix: jx - originX, iz: jz - originZ, mesh });
    }
  }

  function fill(chunk: Chunk, ix: number, iz: number): void {
    const geometry = chunk.mesh.geometry;
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const color = geometry.getAttribute('color') as THREE.BufferAttribute;
    const heights = new Float32Array((seg + 1) * (seg + 1));
    for (let j = 0; j <= seg; j += 1) {
      for (let i = 0; i <= seg; i += 1) {
        const index = j * (seg + 1) + i;
        const lx = position.getX(index);
        const lz = position.getZ(index);
        heights[index] = terrainHeight(ix * size + lx, iz * size + lz);
      }
    }
    const step = size / seg;
    for (let j = 0; j <= seg; j += 1) {
      for (let i = 0; i <= seg; i += 1) {
        const index = j * (seg + 1) + i;
        const h = heights[index];
        position.setY(index, h);
        const i0 = Math.max(0, i - 1);
        const i1 = Math.min(seg, i + 1);
        const j0 = Math.max(0, j - 1);
        const j1 = Math.min(seg, j + 1);
        const hx = heights[j * (seg + 1) + i1] - heights[j * (seg + 1) + i0];
        const hz = heights[j1 * (seg + 1) + i] - heights[j0 * (seg + 1) + i];
        const slope = Math.hypot(hx, hz) / (step * ((i1 - i0) || 1));
        const lx = position.getX(index);
        const lz = position.getZ(index);
        const albedo = terrainColor(ix * size + lx, iz * size + lz, h, slope);
        color.setXYZ(index, srgbToLinear(albedo.r), srgbToLinear(albedo.g), srgbToLinear(albedo.b));
      }
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    chunk.mesh.position.set(ix * size, 0, iz * size);
    chunk.ix = ix;
    chunk.iz = iz;
  }

  for (const chunk of pool) fill(chunk, chunk.ix, chunk.iz);

  let anchorX = Number.NaN;
  let anchorZ = Number.NaN;

  return {
    update(x: number, z: number) {
      const cx = Math.floor(x / size);
      const cz = Math.floor(z / size);
      if (cx === anchorX && cz === anchorZ) return;
      anchorX = cx;
      anchorZ = cz;
      const needed: Array<[number, number]> = [];
      for (let jz = 0; jz < gridZ; jz += 1) {
        for (let jx = 0; jx < gridX; jx += 1) {
          needed.push([cx + jx - originX, cz + jz - originZ]);
        }
      }
      const spare = pool.filter((chunk) => !needed.some(([ix, iz]) => chunk.ix === ix && chunk.iz === iz));
      for (const [ix, iz] of needed) {
        if (pool.some((chunk) => chunk.ix === ix && chunk.iz === iz)) continue;
        const chunk = spare.pop();
        if (!chunk) continue;
        fill(chunk, ix, iz);
      }
    },
  };
}
