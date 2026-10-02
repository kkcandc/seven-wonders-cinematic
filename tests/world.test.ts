import { describe, expect, it } from 'vitest';
import { sampleFlight } from '../src/sim/flight';
import { canyonAxisX, LAYOUT, wallAxisX } from '../src/sim/layout';
import { terrainHeight } from '../src/sim/terrain';
import { atmosphereAtZ, WONDERS, wonderAtT } from '../src/sim/wonders';

describe('wonders', () => {
  it('covers the film with seven contiguous chapters', () => {
    expect(WONDERS).toHaveLength(7);
    expect(WONDERS[0].t0).toBe(0);
    expect(WONDERS[WONDERS.length - 1].t1).toBe(1);
    for (let i = 0; i < WONDERS.length; i += 1) {
      const wonder = WONDERS[i];
      expect(wonder.tHero).toBeGreaterThanOrEqual(wonder.t0);
      expect(wonder.tHero).toBeLessThan(wonder.t1);
      if (i > 0) expect(wonder.t0).toBeCloseTo(WONDERS[i - 1].t1, 6);
    }
    const ids = new Set(WONDERS.map((wonder) => wonder.id));
    expect(ids.size).toBe(7);
  });

  it('resolves the chapter under the playhead', () => {
    expect(wonderAtT(0).id).toBe('wall');
    expect(wonderAtT(0.22).id).toBe('taj');
    expect(wonderAtT(1).id).toBe('christ');
  });
});

describe('terrain', () => {
  it('stays finite across the route', () => {
    for (let z = 0; z <= 5000; z += 40) {
      for (const x of [-80, 0, 80]) {
        const h = terrainHeight(x, z);
        expect(Number.isFinite(h)).toBe(true);
      }
    }
  });

  it('lifts the wall ridge above the valley mist', () => {
    const z = 320;
    const crest = terrainHeight(wallAxisX(z), z);
    const valley = terrainHeight(wallAxisX(z) + 90, z);
    expect(crest).toBeGreaterThan(28);
    expect(crest).toBeGreaterThan(valley + 8);
  });

  it('cuts a low Siq between high rock', () => {
    const z = LAYOUT.petra.z - 120;
    const floor = terrainHeight(canyonAxisX(z), z);
    const wall = terrainHeight(canyonAxisX(z) + 36, z);
    expect(floor).toBeLessThan(6);
    expect(wall).toBeGreaterThan(floor + 8);
  });

  it('raises Corcovado above the city shore', () => {
    const peak = terrainHeight(0, LAYOUT.christ.z);
    const shore = terrainHeight(0, LAYOUT.christ.z - 150);
    expect(peak).toBeGreaterThan(90);
    expect(peak).toBeGreaterThan(shore + 50);
  });
});

describe('flight', () => {
  it('moves forward and stays above the ground', () => {
    let previousZ = -Infinity;
    let worst = { t: 0, clearance: Infinity, z: 0, x: 0 };
    for (let i = 0; i <= 400; i += 1) {
      const t = i / 400;
      const pose = sampleFlight(t);
      expect(Number.isFinite(pose.position.y)).toBe(true);
      expect(Number.isFinite(pose.look.y)).toBe(true);
      expect(pose.fov).toBeGreaterThan(20);
      expect(pose.fov).toBeLessThan(100);
      expect(pose.position.z).toBeGreaterThan(previousZ - 0.75);
      previousZ = pose.position.z;
      const ground = terrainHeight(pose.position.x, pose.position.z);
      const clearance = pose.position.y - ground;
      if (clearance < worst.clearance) {
        worst = { t, clearance, z: pose.position.z, x: pose.position.x };
      }
    }
    expect(worst.clearance, `t=${worst.t.toFixed(3)} x=${worst.x.toFixed(1)} z=${worst.z.toFixed(1)}`).toBeGreaterThan(1.15);
    const opening = sampleFlight(0);
    const ridge = terrainHeight(wallAxisX(opening.position.z), opening.position.z);
    expect(opening.position.y).toBeGreaterThan(ridge + 8);
  });

  it('visits each wonder in order', () => {
    const seen: string[] = [];
    for (let i = 0; i <= 100; i += 1) {
      const id = wonderAtT(i / 100).id;
      if (seen[seen.length - 1] !== id) seen.push(id);
    }
    expect(seen).toEqual(WONDERS.map((wonder) => wonder.id));
  });
});

describe('atmosphere', () => {
  it('blends a normalized sun along the route', () => {
    for (const z of [100, LAYOUT.taj.z, LAYOUT.petra.z, LAYOUT.christ.z, 3000]) {
      const atmo = atmosphereAtZ(z);
      const len = Math.hypot(atmo.sunDir.x, atmo.sunDir.y, atmo.sunDir.z);
      expect(len).toBeCloseTo(1, 5);
      expect(atmo.exposure).toBeGreaterThan(0.5);
      expect(atmo.density).toBeGreaterThan(0);
      expect(atmo.zenith.r).toBeGreaterThanOrEqual(0);
      expect(atmo.horizon.b).toBeLessThanOrEqual(1);
    }
    expect(atmosphereAtZ(LAYOUT.christ.z).stars).toBeGreaterThan(0.4);
    expect(atmosphereAtZ(LAYOUT.taj.z).stars).toBe(0);
    expect(atmosphereAtZ(200).density).toBeLessThan(0.002);
    expect(atmosphereAtZ(LAYOUT.petra.z).density).toBeLessThan(0.0025);
  });
});
