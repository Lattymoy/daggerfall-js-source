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
import { SD_NO_MARK } from '../src/world/sdDungeon.js';
import { SD_REALM_TEXT } from '../src/world/sdRealm.js';
import { createSdEnd, SD_STEP_GAP_MS, SD_STEP_JUMP_M, SD_RIFT_KEY, SD_RIFT_PRESS_M } from '../src/scenes/sdEnd.js';
import { riftCentreY } from '../src/world/sdRiftModel.js';
import { pickActivatableHit, RAY_DISTANCE } from '../src/player/activate.js';

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
