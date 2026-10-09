// AUDIT SD IV, SD26 (2026-10-09; bible/11-Multiplayer/Super-Dungeons.md): THE LIFECYCLE AND THE DUNGEON - the two
// lenses' findings on the Hollow's own ground, each reproduced and pinned here, run from the hosts' own text where the
// fix is theirs (each by its finding's number, F2-F40): no Mark in a Hollow (F2); a slow frame's walk-in taken (F3); the
// Rift's press its ring, not a cube of air (F33); the Return never on the Rift's foot while a lower floor is near (F34);
// the way back stood clear of both portals (F35); the ring sized by the disc it is (F36); a Hollow on dry ground (F37);
// the end out of the water (F38); the Hollow host's scan in slices (F39); and the step out to the Hour before the
// Hollow's door (F40).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SD_NO_MARK, sdEndMarks, sdRiftPlace, sdReturnPlace, sdLandingPlace, SD_RETURN_GAP_M, SD_RIFT_MIN_M, SD_RIFT_REACH_M, SD_RETURN_REACH_M, SD_STEP_M,
  SD_LANDING_PAST_M, SD_LANDING_CLEAR_M, sdRiftFit, sdRiftSweep, SD_RIFT_SIZE_M, SD_RIFT_AIR_M,
} from '../src/world/sdDungeon.js';
import { SD_REALM_TEXT } from '../src/world/sdRealm.js';
import { createSdEnd, SD_STEP_GAP_MS, SD_STEP_JUMP_M, SD_RIFT_KEY, SD_RIFT_PRESS_M } from '../src/scenes/sdEnd.js';
import { riftCentreY } from '../src/world/sdRiftModel.js';
import { pickActivatableHit, RAY_DISTANCE } from '../src/player/activate.js';
import { sdCities, findSdSite } from '../src/systems/sdSite.js';
import { scanGatePixels } from '../src/systems/gateSite.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { createSpawnGround } from '../src/world/spawnedDungeons.js';
import { sdRoll } from '../src/net/sdLaw.js';
import { collectDungeonEnemies } from '../src/characters/dungeonEnemies.js';
import { dungeonEndOf } from '../src/world/dungeonEnd.js';
import { RDB_SIDE } from '../src/world/rdbLayout.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = read('src/scenes/world.js');
/** A `function name(` of a host's own (two-space indent), its text. */
const fnIn = (src, name) => { const at = src.indexOf(`\n  function ${name}(`); assert.ok(at > 0, name); return src.slice(at + 1, src.indexOf('\n  }\n', at) + 4); };
const evalIn = (expr, env) => new Function(...Object.keys(env), `return (${expr});`)(...Object.values(env));

// ── F2: no Mark in a Hollow ───────────────────────────────────────────

test('SD26 NO MARK IN A HOLLOW (AUDIT SD IV F2): a Mark set in an Abyss Dungeon is refused in its own words, as the court\'s and the Hour\'s are - a dungeon anchor knows its dungeon by the pixel alone, and a later Hollow on that pixel (another layout) took a Recall to the old one\'s spot, in rock or the void; a plain dungeon\'s Mark is set as ever (mutants: the Hollow\'s Mark set)', () => {
  const said = [];
  let set = 0;
  const run = (loc, { realm = null, court = null } = {}) => {
    const modes = { gateArenaDay: () => court, sdRealmSlot: () => realm, get dungeonLocation() { return loc; }, anchorContext: () => ({ worldContext: 'Dungeon', local: [1, 2, 3], buildingKey: 0, interior: null }) };
    const env = {
      modes, sdSay: (t) => said.push(t), setMidScreenText: (t) => said.push(t), COURT_TEXT: { noMark: 'court' }, SD_REALM_TEXT, SD_NO_MARK,
      walkMode: true, playerSpawned: true, player: { pos: [1, 2, 3] }, cam: { pos: [0, 0, 0], yaw: 0, pitch: 0 }, WORLD_CONTEXT: { Exterior: 'Exterior', Dungeon: 'Dungeon' },
      state: { current: { x: 300, y: 200 }, compensation: [0, 0, 0], worldCoords: () => ({ x: 0, z: 0 }) }, playerTravelPixel: () => ({ x: 300, y: 200 }),
      mapPixelToWorldCoords: () => ({ x: 0, z: 0 }), groundFrameHeight: (y) => y, STREAMING_TERRAIN_SCALE: 1,
      playerEntity: {}, makeAnchor: (a) => { set += 1; return a; },
    };
    evalIn(fnIn(W, 'setRecallAnchor'), env)();
    return env.playerEntity.anchorPosition ?? null;
  };
  assert.equal(run({ superTier: true, sdSlot: 7 }), null, 'a Hollow: no anchor');
  assert.deepEqual(said, [SD_NO_MARK]);
  assert.equal(SD_NO_MARK, 'You cannot set a Mark in an Abyss Dungeon.');
  assert.ok(run({ name: 'Old Maze' }), 'a plain dungeon: set');
  assert.equal(set, 1);
  said.length = 0;
  run({ sdRealm: 7 }, { realm: 7 });
  assert.deepEqual(said, [SD_REALM_TEXT.noMark], 'the Hour says its own first');
});

// ── F3: a slow frame's walk-in ────────────────────────────────────────

/** A renderer that keeps nothing (the end stands its meshes on it). */
const quietRenderer = () => ({ uploadTexture: () => {}, uploadEmissionTexture: () => {}, createMesh: (m) => ({ m }), destroyMesh: () => {} });

test('SD26 A SLOW FRAME\'S WALK-IN IS TAKEN (AUDIT SD IV F3): walking into the Rift at 3 and 2 frames a second, or across one long hitch on the crossing, hands it over once - a 250 ms gap was "a frame not ticked", so under 4 frames a second no walk-in was ever taken and a hitch on the crossing left the player standing in the ring; a host held for seconds, and a jump, still forget the step (mutants: the quarter-second gap)', () => {
  const walkIn = (frameMs, { hitch = 0 } = {}) => {
    let clock = 1000;
    const got = [];
    const end = createSdEnd({ renderer: quietRenderer(), audio: null, now: () => clock, onRift: () => got.push('rift') });
    end.stand({ rift: { at: [0, 0, 0], size: 4 }, retAt: null });
    // 1.4 m a second, the dt cap's tenth of a second of it a frame at most (scenes/dungeon.js) - from 3 m out, then stood in it
    const step = 1.4 * Math.min(0.1, frameMs / 1000);
    for (let z = 3; z > -0.5; z -= step) {
      const crossing = z > 1 && z - step <= 1;
      clock += frameMs + (crossing ? hitch : 0);
      end.frame([0, 0, z - step]);
    }
    for (let k = 0; k < 10; k++) { clock += frameMs; end.frame([0, 0, 0]); }
    return got.length;
  };
  assert.equal(walkIn(16), 1, 'sixty frames a second');
  assert.equal(walkIn(333), 1, 'three');
  assert.equal(walkIn(500), 1, 'two');
  assert.equal(walkIn(16, { hitch: 600 }), 1, 'a hitch on the crossing');
  assert.equal(walkIn(16, { hitch: SD_STEP_GAP_MS + 500 }), 0, 'a host held for seconds forgets it');
  assert.equal(SD_STEP_GAP_MS, 2000);
  assert.ok(SD_STEP_JUMP_M > 1.4 * 0.1 * 2, 'a slow frame\'s feet are never a jump');
});

// ── F33: the Rift pressed at its ring ─────────────────────────────────

/** A hall the collider answers (x0..x1, z0..z1, floor y0, ceiling y0 + h): a ray's first surface, Infinity past `max`. */
function boxCollider({ x0 = 0, x1 = 20, z0 = 0, z1 = 20, y0 = 0, h = 9 } = {}) {
  const raycast = (o, d, max = Infinity) => {
    let t = Infinity;
    for (const [ax, at] of [[0, x0], [0, x1], [2, z0], [2, z1], [1, y0], [1, y0 + h]]) { if (Math.abs(d[ax]) < 1e-12) continue; const k = (at - o[ax]) / d[ax]; if (k > 1e-9) t = Math.min(t, k); }
    return t <= max ? t : Infinity;
  };
  return { raycast, raycastHit: (o, d, max) => ({ dist: raycast(o, d, max), key: null }) };
}
const unit = (from, to) => { const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]], l = Math.hypot(...d); return d.map((v) => v / l); };
/** A body as the dungeon host lists it (dungeonContext.js lootTargets' `corpse:`). */
const bodyAt = (p, i = 0) => ({ key: `corpse:${i}`, aabb: { min: [p[0] - 0.5, p[1], p[2] - 0.5], max: [p[0] + 0.5, p[1] + 0.6, p[2] + 0.5] }, distance: RAY_DISTANCE, reach: 3.75, body: true });

test('SD26 THE RIFT IS PRESSED AT ITS RING (AUDIT SD IV F33): its press is a box turned with it, its gear\'s span across, foot to top, SD_RIFT_PRESS_M either side of its plane - its whole sweep\'s cube (7 m every way) took the press at a body lying before it, at the floor at my feet, and named "The Rift" over them; and from inside that cube a press at the ring itself found nothing. The ring is pressed face on, edge on, and from beside it (mutants: the sweep\'s cube; the box unturned; a surface it has not)', () => {
  const end = createSdEnd({ renderer: quietRenderer(), audio: null, now: () => 0 });
  end.stand({ rift: { at: [10, 0, 10], size: 7, face: [0, 0, 1] }, retAt: null });
  const col = boxCollider();
  const rift = end.targets()[0];
  const top = riftCentreY(7) + 3.5;
  assert.deepEqual(rift.obb.box, [-3.5, 0, -SD_RIFT_PRESS_M, 3.5, top, SD_RIFT_PRESS_M]);
  const pick = (eye, at, extra = []) => pickActivatableHit(eye, unit(eye, at), [...extra, rift], col)?.key ?? null;
  // a body lying 1.6 m before it, pressed from outside the old cube: the body, not the Rift
  const body = bodyAt([10, 0, 8.4]);
  assert.equal(pick([10, 1.6, 5], [10, 0.3, 8.4], [body]), 'corpse:0', 'the body before the ring');
  assert.equal(pick([12.5, 1.6, 6], [10.2, 0.3, 8.4], [body]), 'corpse:0', 'and from aside');
  // the floor at my feet inside the old cube, outside its walk-in: nothing - nor standing under its arc, in its plane
  assert.equal(pick([12, 1.6, 8], [12, 0, 7]), null, 'the floor is the floor');
  assert.equal(pick([12.8, 1.6, 10], [12.8, 0, 9.6]), null, 'under its arc: the floor, never the ring\'s air');
  // the ring itself: face on, from inside the old cube (it picked nothing there), edge on, and from behind
  assert.equal(pick([10, 1.6, 6], [10, riftCentreY(7), 10]), SD_RIFT_KEY, 'face on');
  assert.equal(pick([12, 1.6, 8.5], [12, 1.6, 10]), SD_RIFT_KEY, 'from beside it, at its arc');
  assert.equal(pick([3, 2, 10], [10, 3, 10]), SD_RIFT_KEY, 'edge on');
  assert.equal(pick([10, 1.6, 13], [10, 3, 10]), SD_RIFT_KEY, 'from behind');
  // past its rim, beside it: air
  assert.equal(pick([10, 1.6, 6], [14.5, 1, 10]), null, 'beside its rim');
  // turned: a ring facing x stands its press across z
  const e2 = createSdEnd({ renderer: quietRenderer(), audio: null, now: () => 0 });
  e2.stand({ rift: { at: [10, 0, 10], size: 7, face: [1, 0, 0] }, retAt: null });
  const t2 = e2.targets()[0];
  assert.ok(Math.abs(t2.aabb.min[0] - (10 - SD_RIFT_PRESS_M)) < 1e-6 && Math.abs(t2.aabb.min[2] - 6.5) < 1e-6, JSON.stringify(t2.aabb));
  assert.equal(pickActivatableHit([6, 1.6, 10], unit([6, 1.6, 10], [10, 3, 10]), [t2], col)?.key, SD_RIFT_KEY, 'face on, turned');
  assert.equal(pickActivatableHit([6, 1.6, 12.5], unit([6, 1.6, 12.5], [10, 2, 12.5]), [t2], col)?.key, SD_RIFT_KEY, 'at its arc, turned');
  assert.equal(pickActivatableHit([6, 1.6, 6], unit([6, 1.6, 6], [14, 1.6, 6]), [t2], col)?.key ?? null, null, 'past its rim, turned');
});

// ── F34, F35: the Return beside the Rift, the way back clear of both ──

/** The ray's distance into a box { x0, x1, y0, y1, z0, z1 } from outside it (slabs), or Infinity. */
function intoBox(o, d, b) {
  let t0 = 0, t1 = Infinity;
  for (const [ax, lo, hi] of [[0, b.x0, b.x1], [1, b.y0, b.y1], [2, b.z0, b.z1]]) {
    if (Math.abs(d[ax]) < 1e-12) { if (o[ax] < lo || o[ax] > hi) return Infinity; continue; }
    let a = (lo - o[ax]) / d[ax], c = (hi - o[ax]) / d[ax];
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    if (t0 > t1) return Infinity;
  }
  return t0 > 1e-9 ? t0 : Infinity;
}
/** A hall the end's laws ask (world/sdDungeon.js SdProbe): x0..x1, z0..z1, its floor `floorAt(x, z)` (null outside), its
 *  ceiling at `h`; `solids` boxes the rays meet; `slope` a ramp's floor (y = slope * (x - 10)) the rays meet too. */
function probeHall({ x0 = 0, x1 = 20, z0 = 0, z1 = 20, h = 8, floorAt = () => 0, solids = [], slope = 0 } = {}) {
  return {
    floor: (at) => (at[0] >= x0 && at[0] <= x1 && at[2] >= z0 && at[2] <= z1 ? floorAt(at[0], at[2]) : null),
    ray: (o, d, max) => {
      let t = Infinity;
      for (const [ax, at] of [[0, x0], [0, x1], [2, z0], [2, z1], [1, h]]) { if (Math.abs(d[ax]) < 1e-12) continue; const k = (at - o[ax]) / d[ax]; if (k > 1e-9) t = Math.min(t, k); }
      for (const b of solids) t = Math.min(t, intoBox(o, d, b));
      if (slope) { const den = d[1] - slope * d[0]; if (Math.abs(den) > 1e-12) { const k = (slope * (o[0] - 10) - o[1]) / den; if (k > 1e-9) t = Math.min(t, k); } }
      return t <= max ? t : null;
    },
  };
}
const apart = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('SD26 THE RETURN NEVER STANDS ON THE RIFT\'S FOOT WHILE A LOWER FLOOR IS NEAR (AUDIT SD IV F34): an end on a dais, or on a ramp in a narrow passage, had no bearing whose floor was the ring\'s own, and the Return stood on the ring\'s foot - inside its walk-in, a walk to it crossing the Rift\'s first, and a small ring\'s every walk-in the Return\'s (to the way in). Now the same bearings onto a lower floor (a dais\'s foot, down the ramp) before the foot; the ring\'s own floor first, never a higher one, and boxed in still its foot (mutants: never lower; lower first; a higher floor taken)', () => {
  // a 2 x 2 m dais a metre high under the end, in a great hall
  const dais = probeHall({ floorAt: (x, z) => (x >= 9 && x <= 11 && z >= 9 && z <= 11 ? 1 : 0), solids: [{ x0: 9, x1: 11, y0: 0, y1: 1, z0: 9, z1: 11 }] });
  const r1 = sdRiftPlace([10, 1, 10], dais);
  assert.deepEqual(r1.at, [10, 1, 10], 'the Rift on the dais');
  const t1 = sdReturnPlace(r1, dais);
  assert.ok(close(t1[0], 10 + r1.size / 2 + SD_RETURN_GAP_M) && t1[1] === 0 && close(t1[2], 10), `at the dais's foot, east: ${JSON.stringify(t1)}`);
  // a narrow passage climbing east at 0.45: the least ring, the Return down the ramp, west
  const ramp = probeHall({ x0: 0, x1: 30, z0: 8.8, z1: 11.2, h: 20, floorAt: (x) => 0.45 * (x - 10), slope: 0.45 });
  const r2 = sdRiftPlace([10, 0, 10], ramp);
  assert.equal(r2.size, SD_RIFT_MIN_M);
  const t2 = sdReturnPlace(r2, ramp);
  assert.ok(close(t2[0], 10 - (SD_RIFT_MIN_M / 2 + SD_RETURN_GAP_M)) && close(t2[1], -0.45 * (SD_RIFT_MIN_M / 2 + SD_RETURN_GAP_M)) && close(t2[2], 10), `down the ramp: ${JSON.stringify(t2)}`);
  // a passage with a step up a metre east of the end and a drop a metre west: down, never up
  const steps = probeHall({ x0: 0, x1: 30, z0: 8.8, z1: 11.2, h: 20, floorAt: (x) => (x >= 11.5 ? 1 : x < 9 ? -1 : 0), solids: [{ x0: 11.5, x1: 30, y0: 0, y1: 1, z0: 8.8, z1: 11.2 }] });
  const t4 = sdReturnPlace({ at: [10, 0, 10], size: SD_RIFT_MIN_M }, steps);
  assert.ok(close(t4[0], 10 - (SD_RIFT_MIN_M / 2 + SD_RETURN_GAP_M)) && t4[1] === -1, `down the step, never up the other: ${JSON.stringify(t4)}`);
  // either way, out of the Rift's walk-in: apart across the floor by both reaches, or a floor below its foot's step
  for (const [r, t] of [[r1, t1], [r2, t2]]) {
    const clear = apart(r.at, t) >= Math.min(SD_RIFT_REACH_M, r.size / 4) + SD_RETURN_REACH_M || t[1] < r.at[1] - SD_STEP_M;
    assert.ok(clear, `${JSON.stringify(r)} / ${JSON.stringify(t)}`);
  }
  // the ring's own floor first: a pit east of it, the next bearing round on its floor - never down into the pit
  const pit = probeHall({ x1: 40, z1: 40, h: 12, floorAt: (x, z) => (x >= 24 && x <= 25.5 && z >= 19 && z <= 21 ? -1 : 0) });
  const t3 = sdReturnPlace({ at: [20, 0, 20], size: 7 }, pit);
  const s3 = 20 + (3.5 + SD_RETURN_GAP_M) * Math.SQRT1_2;
  assert.ok(close(t3[0], s3) && t3[1] === 0 && close(t3[2], s3), `north-east, on its floor: ${JSON.stringify(t3)}`);
  // boxed in: its foot, as ever (test/sd4b_rift.test.js)
  assert.deepEqual(sdReturnPlace({ at: [1, 0, 1], size: 2.6 }, probeHall({ x1: 2, z1: 2 })), [1, 0, 1]);
});

test('SD26 THE WAY BACK STANDS CLEAR OF BOTH PORTALS (AUDIT SD IV F35): a Return stood on a corner\'s diagonal had no bearing that led away from the Rift, and the way back from the Hour stood the player on its foot in plain rooms (a 6 x 6 m room with the end at its middle) - one step off it and back carried them to the way in, L6 F18 again. Now the first spot on the Return\'s floor clear of both portals\' reach by SD_LANDING_CLEAR_M, SD_LANDING_PAST_M from it on each bearing, then just past its reach; over every room 3 to 12 m and every end in it, never inside either; boxed in, still its foot; and a walk out and back from it carries no one (mutants: the foot kept; inside the Rift\'s reach; the near ring unasked)', () => {
  const six = probeHall({ x1: 6, z1: 6, h: 5 });
  const rift = sdRiftPlace([3, 0, 3], six), ret = sdReturnPlace(rift, six), land = sdLandingPlace(rift, ret, six);
  assert.ok(close(ret[0], 3 + (rift.size / 2 + SD_RETURN_GAP_M) * Math.SQRT1_2) && close(ret[2], ret[0]), `its corner's diagonal: ${JSON.stringify(ret)}`);
  assert.ok(close(land[0], ret[0] - SD_LANDING_PAST_M) && land[1] === 0 && close(land[2], ret[2]), `west of it, clear of both: ${JSON.stringify(land)}`);
  assert.equal(SD_LANDING_CLEAR_M, 0.4);
  // every room 3 to 12 m, every end a metre apart in it: never in either's reach and its margin
  let n = 0;
  for (let W = 3; W <= 12; W++) for (let D = 3; D <= 12; D++) {
    const p = probeHall({ x1: W, z1: D, h: 5 });
    for (let x = 0.5; x < W; x += 1) for (let z = 0.5; z < D; z += 1) {
      const r = sdRiftPlace([x, 0, z], p), t = sdReturnPlace(r, p), l = sdLandingPlace(r, t, p);
      assert.ok(apart(l, t) >= SD_RETURN_REACH_M + SD_LANDING_CLEAR_M - 1e-9 && apart(l, r.at) >= Math.min(SD_RIFT_REACH_M, r.size / 4) + SD_LANDING_CLEAR_M - 1e-9, `${W}x${D} at ${x},${z}: ${JSON.stringify([r.at, t, l])}`);
      n++;
    }
  }
  assert.ok(n > 3000);
  // a Return in a 3 x 2 m alcove: nothing a metre and a half off it - just past its reach, the first bearing (east)
  const alcove = probeHall({ x0: 9.5, x1: 12.5, z0: 9, z1: 11, h: 5 });
  const lp = sdLandingPlace({ at: [11, 0, 30], size: 2.6 }, [11, 0, 10], alcove);
  assert.ok(close(lp[0], 11 + SD_RETURN_REACH_M + SD_LANDING_CLEAR_M) && close(lp[2], 10), `the near ring: ${JSON.stringify(lp)}`);
  // boxed in: its foot (test/sd11c_page.test.js)
  assert.deepEqual(sdLandingPlace({ at: [1, 0, 1], size: 2.6 }, [1.6, 0, 1], probeHall({ x1: 2, z1: 2 })), [1.6, 0, 1]);
  // the real end: stood on the landing, a metre out and back - nothing taken
  const got = [];
  let clock = 1000;
  const end = createSdEnd({ renderer: quietRenderer(), audio: null, now: () => clock, onRift: () => got.push('rift'), onReturn: () => got.push('return') });
  end.stand({ rift, retAt: ret });
  end.frame(null);
  for (const dx of [0, -0.25, -0.5, -0.75, -1, -0.75, -0.5, -0.25, 0, 0.25]) { clock += 16; end.frame([land[0] + dx, 0, land[2]]); }
  assert.deepEqual(got, [], 'neither carried me');
});

// ── F36: the ring sized by the disc it is ─────────────────────────────

/** A volume of air - a union of boxes, less `solid` - its rays marched a centimetre a step. */
function airProbe(boxes, solid = () => false) {
  const inside = (q) => !solid(q) && boxes.some((b) => q[0] >= b.x0 && q[0] <= b.x1 && q[1] >= b.y0 && q[1] <= b.y1 && q[2] >= b.z0 && q[2] <= b.z1);
  return {
    inside,
    floor: (at) => (inside([at[0], at[1] + 0.05, at[2]]) ? at[1] : null),
    ray: (o, d, max) => { for (let t = 0.01; t <= max; t += 0.01) if (!inside([o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t])) return t; return null; },
  };
}
/** Whether the ring as it stands (its disc in its face's plane, about its hovering centre) is all in the air, and
 *  `air` beyond its upper rim. */
function ringInAir(rift, p, air = 0) {
  const R = rift.size / 2 + air, cy = riftCentreY(rift.size), ax = [-rift.face[2], 0, rift.face[0]];
  for (let k = 0; k <= 180; k++) {
    const a = (k / 180) * Math.PI, u = Math.cos(a) * R, v = Math.sin(a) * R;
    if (!p.inside([rift.at[0] + ax[0] * u, rift.at[1] + cy + v, rift.at[2] + ax[2] * u])) return false;
  }
  return true;
}

test('SD26 THE RING IS SIZED BY THE DISC IT IS (AUDIT SD IV F36): the hall\'s measure asks the ceiling straight up from the foot and the walls at chest height - a ceiling beside the axis (a raised bay, a shaft over the end) went unseen and a 7 m ring stood through a 5 m ceiling, and its own hover put its top past its air. Now its disc is swept in its face\'s plane from its hovering centre - across and up between, never below (a step beside its foot is no wall), never along its face - and the measure\'s height is its top\'s; a great hall still stands the whole ring, and every client the same (mutants: unswept; the hover unasked; only across; the lower half asked; along its face; never halved)', () => {
  // a 5 m hall with a 3 x 3 m bay rising to 9 m over the end
  const bay = airProbe([{ x0: 0, x1: 30, y0: 0, y1: 5, z0: 0, z1: 30 }, { x0: 13.5, x1: 16.5, y0: 0, y1: 9, z0: 13.5, z1: 16.5 }]);
  const r1 = sdRiftPlace([15, 0, 15], bay);
  assert.ok(r1.size < SD_RIFT_SIZE_M && r1.size > sdRiftFit(5, Infinity), `under the bay: ${JSON.stringify(r1)}`);
  assert.ok(ringInAir(r1, bay, 0.2), 'its disc in the air, and its air past its rim');
  assert.ok(sdRiftSweep(r1.at, r1.size + 0.05, r1.face, bay) < r1.size + 0.05, 'and as large as it stands');
  // a 3.5 m hall with a 2 x 2 m shaft over the end
  const shaft = airProbe([{ x0: 0, x1: 30, y0: 0, y1: 3.5, z0: 0, z1: 30 }, { x0: 14, x1: 16, y0: 0, y1: 12, z0: 14, z1: 16 }]);
  const r2 = sdRiftPlace([15, 0, 15], shaft);
  assert.ok(r2.size < 4 && ringInAir(r2, shaft, 0.2), JSON.stringify(r2));
  // its hover: a flat ceiling at 7.3 m - its top and its air under it, never its size and its air
  const flat = airProbe([{ x0: 0, x1: 30, y0: 0, y1: 7.3, z0: 0, z1: 30 }]);
  const r3 = sdRiftPlace([15, 0, 15], flat);
  assert.ok(riftCentreY(r3.size) + r3.size / 2 + SD_RIFT_AIR_M <= 7.3 + 0.02 && r3.size > 6.7, JSON.stringify(r3));
  // a great hall: the whole ring, at the end
  const great = airProbe([{ x0: 0, x1: 40, y0: 0, y1: 12, z0: 0, z1: 40 }]);
  assert.equal(sdRiftPlace([20, 0, 20], great).size, SD_RIFT_SIZE_M);
  // swept in its own plane (across x for a face along z): a step a hand high beside its foot is no wall, nor a column
  // before its face
  const step = airProbe([{ x0: 0, x1: 30, y0: 0, y1: 12, z0: 0, z1: 30 }], (q) => q[0] >= 16.45 && q[1] < 0.3);
  assert.equal(sdRiftSweep([15, 0, 15], 7, [0, 0, 1], step), 7, 'a step beside its foot');
  const column = airProbe([{ x0: 0, x1: 30, y0: 0, y1: 12, z0: 0, z1: 30 }], (q) => Math.abs(q[0] - 15) < 0.2 && Math.abs(q[2] - 17.5) < 0.2);
  assert.equal(sdRiftSweep([15, 0, 15], 7, [0, 0, 1], column), 7, 'a column before its face');
  assert.ok(sdRiftSweep([15, 0, 15], 7, [1, 0, 0], column) < 7, 'the same column in its plane');
  // the same answer every time
  assert.deepEqual(sdRiftPlace([15, 0, 15], bay), r1);
});

// ── F37: a Hollow on dry ground ───────────────────────────────────────

const T = LOCATION_TYPES;
const place = (region, index, px, py, type, { name = `P${region}.${index}`, w = 1, h = 1, buildings = 0 } = {}) => ({
  name, regionIndex: region, locationIndex: index, hasDungeon: false,
  mapTableData: { mapId: py * 1000 + px, locationType: type, longitude: 0, latitude: 0 },
  exterior: { exteriorData: { width: w, height: h, locationId: py * 1000 + px }, buildingCount: buildings },
});
function mapsOf(places) {
  const regions = [0, 1].map(() => ({ mapTable: [], mapNames: [] }));
  for (const p of places) { regions[p.regionIndex].mapTable[p.locationIndex] = { mapId: p.mapTableData.mapId, locationType: p.mapTableData.locationType }; regions[p.regionIndex].mapNames[p.locationIndex] = p.name; }
  return { regionCount: 2, getRegion: (r) => regions[r], getClimateIndex: () => 231, getPoliticIndex: (x) => 128 + (x < 500 ? 0 : 1), getRegionIndexAt: (x) => (x < 500 ? 0 : 1) };
}
/** A WoodsFile's surface over a byte a pixel (test/spawnshore.test.js's), its large map flat. */
const woodsOf = (byteAt, large = 0) => ({
  getHeightMapValue: byteAt,
  getHeightMapValuesRange1Dim(x0, y0, dim) { const dst = new Uint8Array(dim * dim); for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) dst[x + y * dim] = byteAt(x0 + x, y0 + y); return dst; },
  getLargeHeightMapValuesRange: (x, y, dim) => new Uint8Array(dim * 3 * dim * 3).fill(large),
});

test('SD26 A HOLLOW STANDS ON DRY GROUND (AUDIT SD IV F37): every spawned dungeon stands only where the plateau the build flattens it to is above the beach band (SPAWN-SHORE) - the Hollow\'s site was the gate scan\'s, whose one land test is the pixel\'s own byte over the sea\'s, so a coast\'s low first land stood it on a square of sand. Now from the slot\'s roll on through its city\'s pixels to the first dry one (the roll\'s own where it is dry, as before), and a city with none passes to the next; the world host hands it the spawns\' own test (mutants: the ground unasked; the first dry pixel, not the roll\'s; a wet city ends it; the world\'s ground not handed)', () => {
  // a coast west of the city: sea under x 297, a beach (byte 5 - 40 m, under the 41.5 m dry line) to x 300, land past it
  const byte = (x) => (x < 297 ? 0 : x <= 300 ? 5 : 20);
  const woods = woodsOf((x) => byte(x));
  const ground = createSpawnGround(woods);
  const city = place(0, 0, 300, 200, T.TownCity, { w: 3, h: 3, buildings: 80 });
  const scan = scanGatePixels(mapsOf([city]), { heightAt: (x) => byte(x) });
  const cities = sdCities([city], 0, { regionNameOf: () => 'Nowhere' });
  let wetBefore = 0, moved = 0;
  for (let s = 1; s <= 60; s++) {
    const rec = { s, r: 0 };
    const was = findSdSite(rec, scan, cities), now = findSdSite(rec, scan, cities, ground);
    assert.ok(now && ground(now.px, now.py), `slot ${s}: dry (${now?.px},${now?.py})`);
    if (!ground(was.px, was.py)) { wetBefore += 1; if (was.px !== now.px || was.py !== now.py) moved += 1; } else assert.deepEqual(now, was, `slot ${s}: the roll's own, dry`);
    assert.deepEqual(findSdSite(rec, scan, cities, ground), now, 'the same for every client');
  }
  assert.ok(wetBefore > 3 && moved === wetBefore, `the beach's slots moved (${wetBefore})`);
  // from the roll on: the next dry pixel in the list after it
  const byTown = [...scan.byRegion.values()].flatMap((l) => Array.from(l)).filter((p) => scan.towns[scan.townAt[p]]?.px === 300).sort((a, b) => a - b);
  const rec = Array.from({ length: 60 }, (_, i) => ({ s: i + 1, r: 0 })).find((r) => { const w = findSdSite(r, scan, cities); return !ground(w.px, w.py); });
  const roll = sdRoll(rec.s, 4) % byTown.length;
  const next = Array.from({ length: byTown.length }, (_, j) => byTown[(roll + j) % byTown.length]).find((p) => ground(p % 1000, Math.floor(p / 1000)));
  const site = findSdSite(rec, scan, cities, ground);
  assert.equal(site.py * 1000 + site.px, next);
  // a city all beach passes to the next
  const second = place(0, 1, 400, 300, T.TownCity, { w: 2, h: 2 });
  const two = sdCities([city, second], 0, { regionNameOf: () => 'Nowhere' });
  const scan2 = scanGatePixels(mapsOf([city, second]), { heightAt: (x) => byte(x) });
  const allWet = (px) => px > 350;
  assert.equal(findSdSite({ s: 3, r: 0 }, scan2, two, allWet).city, second, 'the next city');
  assert.equal(findSdSite({ s: 3, r: 0 }, scan2, [city], () => false), null, 'none dry: no site');
  // the world host hands the spawns' own test through
  assert.match(W, /\n {4}ground: \(px, py\) => _spawnGround\(px, py\),/);
  assert.match(read('src/scenes/sdHost.js'), /findSdSite\(r, sc, cities\(r\.r\), ground\)/);
});

// ── F38: the end out of the water ─────────────────────────────────────

test('SD26 THE END STANDS OUT OF THE WATER (AUDIT SD IV F38): a random marker under its block\'s water is kept (drawn from the underwater table), and when the farthest was in a flooded block the Rift, the Return and the way back from the Hour stood at the bottom of it - the player back from the Hour on their breath. Now a candidate whose foot (the floor the collider finds under it) stands under its block\'s own water level is taken only when none of its kind is dry; a marker over a pool whose floor is under the water is wet; the dungeon host hands the floor through (mutants: the water unasked; the marker\'s own height for its floor; every wet one dropped; the surface upside down; the host unasked)', () => {
  const mk = (x, z, rawY) => ({ archive: 199, record: 15, x, y: -rawY * 0.025, z, rawY, flags: 1, factionOrMobileId: 0, soundIndex: 0, actionByte: 0 });
  // three interior blocks in a row, the third flooded (its surface 2.4 m up): its far marker 6.4 m under it, its near one
  // 0.6 m over it
  const blocks = [
    { name: 'N0000001.RDB', originX: 0, originZ: 0, layout: { markers: [mk(10, 10, -40)], waterLevel: 10000, startMarkers: [] } },
    { name: 'N0000002.RDB', originX: RDB_SIDE, originZ: 0, layout: { markers: [mk(20, 20, -40)], waterLevel: 10000, startMarkers: [] } },
    { name: 'W0000003.RDB', originX: 2 * RDB_SIDE, originZ: 0, layout: { markers: [mk(30, 30, -120), mk(45, 40, 160)], waterLevel: -96, startMarkers: [] } },
  ];
  const enemies = collectDungeonEnemies(blocks.map((b) => ({ markers: b.layout.markers, waterLevel: b.layout.waterLevel, originX: b.originX, originZ: b.originZ })), { locationId: 1234, dungeonType: 0, playerLevel: 24, alternate: false });
  assert.equal(enemies.length, 4, 'the drowned marker is kept by the collection');
  const from = { x: 1, z: 1 };
  const deep = enemies.find((e) => e.y < -3);
  assert.ok(deep && dungeonEndOf(from, enemies).x === deep.x, 'it was the farthest');
  assert.equal(dungeonEndOf(from, sdEndMarks(enemies, blocks.map((b) => ({ ...b, layout: { ...b.layout, waterLevel: 10000 } })))).x, deep.x, 'and dry, the end');
  const end = dungeonEndOf(from, sdEndMarks(enemies, blocks));
  assert.ok(Math.abs(end.x - (2 * RDB_SIDE + 30)) < 1e-9, `the flooded block's marker above its water: ${JSON.stringify(end)}`);
  // its floor asked: that marker stands over a pool, its floor under the water - wet: the far N block's then
  const pool = (m) => (m.x > 2 * RDB_SIDE ? 0 : m.y);
  const end2 = dungeonEndOf(from, sdEndMarks(enemies, blocks, pool));
  assert.ok(Math.abs(end2.x - (RDB_SIDE + 20)) < 1e-9, `out of the pool: ${JSON.stringify(end2)}`);
  // every candidate wet: the end is still the farthest - a Rift somewhere, never none
  const flooded = blocks.map((b) => ({ ...b, layout: { ...b.layout, waterLevel: -400 } }));
  const end3 = dungeonEndOf(from, sdEndMarks(enemies, flooded));
  assert.ok(Math.abs(end3.x - (2 * RDB_SIDE + 45)) < 1e-9, 'all under: the farthest, as ever');
  // the dungeon host hands the floor the collider finds under each (test/sd4b_rift.test.js holds its line)
  assert.match(read('src/scenes/dungeonContext.js'), /sdEndMarks\(_layoutEnemies, dungeon\.blocks, \(m\) => floorLanding\(collider, \[m\.x, m\.y \+ 0\.2, m\.z\]\)\[1\]\)/);
});
