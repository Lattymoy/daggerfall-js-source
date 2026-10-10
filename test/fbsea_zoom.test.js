// FIELD BUGS 2026-09-29 (the sea) #3 - "You should be able to scroll and zoom out farther" (the Discord, through Mac).
// Both third-person cameras stopped at their references' foot distances (the Morrowind camera's 800 units, 11.4 m;
// Eye of the Beholder's -10) beside a ship 44 to 93 m long, and at the helm the camera's own casts met the sailed
// boat's masts, rails and deckhouses - pinned short, the Morrowind wheel held by its own no-op while pinned. At a helm
// the zoom now reaches out to frame the hull (player/seaZoom.js), by a ratio a notch past the foot's far end, and the
// camera passes her own buckets by.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMwCamera, MAX_DISTANCE, MIN_DISTANCE, MW_UNITS_PER_METER, WHEEL_STEP } from '../src/player/mwCamera.js';
import { createEotbCamera, MAX_Z } from '../src/player/eotbCamera.js';
import { SEA_ZOOM_REACH, SEA_ZOOM_RATIO, seaZoomReach, seaZoomStep } from '../src/player/seaZoom.js';
import { Collider } from '../src/player/collider.js';
import { colliderPoses } from '../src/world/prefabColliders.js';
import { meshLocalBounds, Boat } from '../src/systems/comeSailAwayBoat.js';
import { readyPool } from './navalSea.mjs';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const EOTB = readFileSync(new URL('../src/player/eotbCamera.js', import.meta.url), 'utf8');

test('FIELD BUGS 2026-09-29 (the sea) #3: THE MORROWIND CAMERA AT A HELM - a notch out is a ratio, the hull\'s reach in ten; in by the ratio (HELM-ZOOM: the whole range, from the base in a dozen notches - the reference\'s ten-unit ladder below 800 took sixty); off the helm the distance comes back to 800 and the save keeps no more; on foot the reference\'s far end stands (mutants: the ratio unapplied, the reach unclamped, the helm\'s distance kept off it, the save past the reference)', () => {
  const cam = createMwCamera();
  const settle = () => cam.eye({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0 });
  cam.wheel(-1); settle();
  cam.wheel(-200); settle();
  assert.equal(cam.baseDistance(), MAX_DISTANCE, 'on foot: the reference\'s far end');
  cam.wheel(-1); settle();
  assert.equal(cam.baseDistance(), MAX_DISTANCE, '...and no farther');
  cam.setSeaReach(66);
  const far = 66 * MW_UNITS_PER_METER;
  let notches = 0;
  while (cam.baseDistance() < far - 1e-6 && notches < 100) { cam.wheel(-1); settle(); notches++; }
  assert.equal(notches, Math.ceil(Math.log(far / MAX_DISTANCE) / Math.log(SEA_ZOOM_RATIO)), `the hull's reach in ${notches} notches, a ratio each`);
  assert.ok(notches <= 11, 'a dozen at most - at ten units a notch it was 380');
  cam.wheel(-5); settle();
  assert.ok(Math.abs(cam.baseDistance() - far) < 1e-6, 'pinned at the reach');
  assert.equal(cam.state().baseDistance, MAX_DISTANCE, 'the save keeps the reference\'s own');
  cam.wheel(1); settle();
  assert.ok(Math.abs(cam.baseDistance() - far / SEA_ZOOM_RATIO) < 1e-6, 'in by the ratio');
  for (let i = 0; i < 8; i++) { cam.wheel(1); settle(); }
  const under = cam.baseDistance();
  assert.ok(under < MAX_DISTANCE && under >= MIN_DISTANCE, `back under the far end (${under})`);
  cam.wheel(1); settle();
  assert.ok(Math.abs(cam.baseDistance() - Math.max(MIN_DISTANCE, under / SEA_ZOOM_RATIO)) < 1e-6, 'PIN MOVED (HELM-ZOOM): by the ratio below it too');
  // HELM-ZOOM: from the base distance to the hull's reach in a dozen notches (sixty-one to the far end alone before)
  const fresh = createMwCamera();
  fresh.setSeaReach(66);
  let n = 0;
  while (fresh.baseDistance() < far - 1e-6 && n < 100) { fresh.wheel(-1); fresh.eye({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0 }); n++; }
  assert.ok(n <= 14, `out of first person to the hull's reach in ${n} notches (seventy-seven to 800 alone before)`);
  for (let i = 0; i < 40 && fresh.thirdPerson(); i++) { fresh.wheel(1); fresh.eye({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0 }); }
  assert.equal(fresh.mode(), 'first', 'and in by the ratio to the nearest ring, then into the head as on foot');
  // PIN MOVED (AUDIT HELM-ZOOM E2): one notch a frame at a helm - out notch by notch, as a wheel's clicks come
  for (let i = 0; i < 12; i++) { cam.wheel(-1); settle(); }
  assert.ok(cam.baseDistance() > MAX_DISTANCE);
  cam.setSeaReach(0);
  assert.equal(cam.baseDistance(), MAX_DISTANCE, 'off the helm: the reference\'s far end');
  cam.setSeaReach(8);
  assert.equal(cam.seaFar(), 0, 'a boat no bigger than the foot\'s reach changes nothing');
});

test('FIELD BUGS 2026-09-29 (the sea) #3: EYE OF THE BEHOLDER AT A HELM - past the mod\'s own -10 a notch is a ratio (one a frame, by its sign), pinned at the hull\'s reach; in by the ratio to -10 and the mod\'s own increment below; off the helm the next frame pins it back to -10; the mod\'s own boat override keeps its own ladder (mutants: the ratio unapplied, the far pin the mod\'s at sea, the override unasked)', () => {
  const c = createEotbCamera();
  c.loadSettings(null);
  c.toggleOffset(true);
  const base = -c.settings().z;   // the offset's own distance before any scroll
  const dist = () => base + c.scroll();
  c.setSeaReach(66);
  let n = 0;
  while (dist() < 66 - 1e-6 && n < 400) { c.wheel(-1); c.tick({}); n++; }
  assert.ok(n <= 12, `HELM-ZOOM: the hull's reach from the base in ${n} notches (the mod's increment alone took ${Math.round((10 - base) / c.settings().increment)} to -10)`);
  assert.ok(Math.abs(dist() - 66) < 1e-6, 'pinned at the reach');
  c.wheel(-1); c.tick({});
  assert.ok(Math.abs(dist() - 66) < 1e-6, 'and no farther');
  c.wheel(1); c.tick({});
  assert.ok(Math.abs(dist() - 66 / SEA_ZOOM_RATIO) < 1e-6, 'in by the ratio');
  // PIN MOVED (HELM-ZOOM): in by the ratio to the offset's own base, the mod's own ladder below it
  let k = 0;
  while (dist() > base + 1e-6 && k < 60) { c.wheel(1); c.tick({}); k++; }
  assert.ok(Math.abs(dist() - base) < 1e-6 && k <= 12, `in by the ratio to the base (${dist()} in ${k})`);
  c.wheel(1); c.tick({});
  assert.ok(Math.abs(base - dist() - c.settings().increment) < 1e-6, `the mod's own ladder below it (${dist()})`);
  for (let i = 0; i < 60; i++) { c.wheel(-1); c.tick({}); }
  assert.ok(dist() > 10);
  c.setSeaReach(0);
  c.tick({});
  assert.ok(Math.abs(dist() - -MAX_Z) < 1e-9, 'off the helm: the mod\'s own far end, at once');
  assert.match(EOTB, /const far = seaReach > -MAX_Z && !\(cfg\.overrides\.Boat\.enabled && isSailing\) \? -seaReach : MAX_Z;/, 'the mod\'s own boat override keeps its own');
});

test('FIELD BUGS 2026-09-29 (the sea) #3: THE HELM\'S REACH AND HER OWN HULL - the reach is SEA_ZOOM_REACH of her hull mesh\'s largest half-extent (a Small Ship 66 m, the galley 140 m); at her wheel her own stern pins the camera a few metres out, and with her own buckets passed by it stands at the reach; the world passes them by at a helm alone (mutants: the reach\'s half-extent, the skip unwired)', async () => {
  const pool = await readyPool();
  pool.destroyAll();
  const reachOf = (hull) => { const b = pool.spawnNow(new Boat(hull, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] }); const e = meshLocalBounds({ models: pool.models }, b.MeshCollider.m_Mesh).extent; pool.remove(b); return seaZoomReach(Math.max(...e.map(Math.abs))); };
  const small = reachOf(2), galley = reachOf(3);
  assert.ok(small > 60 && small < 72, `a Small Ship's reach ${small.toFixed(1)} m`);
  assert.ok(galley > 130 && galley < 150, `the galley's ${galley.toFixed(1)} m`);
  assert.equal(SEA_ZOOM_REACH, 3);
  assert.equal(seaZoomStep(80, -1, 10, 90), 90, 'the reach clamps');
  // her hull in the collider as the world stands it (csaSyncColliders' own keys): at her wheel her own rig and stern
  // pin the camera - a galley's at any look, a Small Ship's looking a little up - and passed by, it stands at the reach
  for (const [hull, pitch, reach] of [[3, 0, galley], [2, 0.15, small]]) {
    const boat = pool.spawnNow(new Boat(hull, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
    const col = new Collider(() => -100);
    let i = 0;
    const keys = [];
    for (const { collider: c, world } of colliderPoses(boat.GameObject)) {
      if (c.m_IsTrigger || c.type !== 'MeshCollider') continue;
      const g = pool.models.geometry(c.m_Mesh?.mesh);
      if (!g) continue;
      const key = `csaBoat:1:${i++}`;
      col.addMesh(key, g.positions, g.indices, world);
      keys.push(key);
    }
    const d = boat.DrivePosition.position;
    const feet = [d[0], d[1] - 0.9, d[2]];
    const eyeOf = (filter) => {
      const cam = createMwCamera();
      const frame = () => cam.eye({ fpEye: [feet[0], feet[1] + 1.7, feet[2]], feet, yaw: 0, pitch, spherecast: (o, r, dir, m) => { const h = col.sphereCast(o, r, dir, m, filter).dist; return Number.isFinite(h) ? h : null; } });
      cam.setSeaReach(reach);
      cam.wheel(-1); frame();
      for (let k = 0; k < 120; k++) { cam.wheel(-1); frame(); }   // a notch a frame, as the world flushes them
      return frame();
    };
    const pinned = eyeOf(null), free = eyeOf({ skip: keys });
    assert.ok(pinned.distance < 10, `hull ${hull}: her own rig pins the camera at her wheel (${pinned.distance.toFixed(1)} m)`);
    assert.ok(Math.abs(free.distance - reach) < 1e-6, `hull ${hull}: her own passed by, at the reach (${free.distance.toFixed(1)} m)`);
    pool.remove(boat);
  }
  // the world's wiring
  assert.match(WORLD, /const csaHelm = csaOn\(\) && csaRuntime\?\.isSailing\(\) \? csaRuntime\.state\.CurrentBoat : null;\n\s+const camFilter = csaHelm \? csaCameraFilter\(csaHelm\) : null;/);
  assert.match(WORLD, /raycast: \(o, d, m\) => Math\.min\(collider\.raycast\(o, d, m, camFilter\), hcc\.cameraHit\(o, d, m\)\),[^\n]*\n\s+spherecast: \(o, r, d, m\) => \{ const h = Math\.min\(collider\.sphereCast\(o, r, d, m, camFilter\)\.dist, hcc\.cameraHit\(o, d, m, r\)\);/);   // PIN MOVED (WAGONS3): and my driven wagon's body a wall to the camera on its bench
  assert.match(WORLD, /seaReach: csaHelm \? csaSeaReach\(csaHelm\) : 0,/);
  assert.match(WORLD, /for \(const \[key, b\] of _csaBuckets\) if \(b\.boat === boat\) skip\.push\(key\);/, 'her own buckets, and no other boat\'s');
});

test('AUDIT HELM-ZOOM (E1, E2, E3): IN FROM WHERE THE CAMERA STANDS WHEN PINNED, ONE NOTCH A FRAME, AND THE MOD\'S LADDER BELOW ITS BASE BOTH WAYS - a Morrowind camera pinned at 105 units moves on the first wheel-in (it spent four notches unseen); a burst of twenty clicks in one frame is one notch (a trackpad\'s swipe crossed the whole range); Eye of the Beholder out from below its base steps the mod\'s 0.2 (it leapt to the base) (mutants: in from the wanted distance, the burst summed, the ratio below the base)', () => {
  const cam = createMwCamera();
  cam.setSeaReach(66);
  const pinned = (d) => cam.eye({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, spherecast: () => d });
  cam.wheel(-1); pinned(null);
  for (let i = 0; i < 8; i++) { cam.wheel(-1); pinned(null); }
  assert.ok(cam.baseDistance() > 600, `out (${cam.baseDistance()})`);
  pinned(1.5);   // pinned at 1.5 m
  const at = cam.baseDistance();
  cam.wheel(1); pinned(1.5);
  assert.ok(cam.baseDistance() < 1.5 * MW_UNITS_PER_METER, `the first notch in moves the camera it pinned (${at} -> ${cam.baseDistance()})`);
  // the burst: one notch
  const b = createMwCamera();
  b.setSeaReach(66);
  const s = () => b.eye({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0 });
  b.wheel(-1); s();
  b.wheel(-1); s();
  const one = b.baseDistance();
  b.wheel(-20); s();
  assert.ok(Math.abs(b.baseDistance() - one * SEA_ZOOM_RATIO) < 1e-6, `twenty in one frame: one notch (${one} -> ${b.baseDistance()})`);
  // Eye of the Beholder below its base: the mod's own step out
  const c = createEotbCamera();
  c.loadSettings(null);
  c.toggleOffset(true);
  c.setSeaReach(66);
  const base = -c.settings().z;
  for (let i = 0; i < 3; i++) { c.wheel(1); c.tick({}); }
  const low = base + c.scroll();
  assert.ok(low < base - 1e-6, 'below the base');
  c.wheel(-1); c.tick({});
  assert.ok(Math.abs(base + c.scroll() - (low + c.settings().increment)) < 1e-6, `out by the mod's increment (${low} -> ${base + c.scroll()})`);
});
