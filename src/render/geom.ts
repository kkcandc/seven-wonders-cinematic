import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function box(w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  return geometry;
}

export function merged(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 0) throw new Error('No geometries to merge');
  if (geometries.length === 1) return geometries[0];
  const geometry = mergeGeometries(geometries, false);
  if (!geometry) throw new Error('Unable to merge geometries');
  for (const source of geometries) source.dispose();
  return geometry;
}

export function stone(color: string, roughness = 0.88): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.02,
  });
}

export function stage(mesh: THREE.Object3D, cast = true): void {
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = cast;
      child.receiveShadow = true;
    }
  });
}

export function compose(
  x: number,
  y: number,
  z: number,
  yaw = 0,
  sx = 1,
  sy = 1,
  sz = 1,
): THREE.Matrix4 {
  const position = new THREE.Vector3(x, y, z);
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const scale = new THREE.Vector3(sx, sy, sz);
  return new THREE.Matrix4().compose(position, rotation, scale);
}
