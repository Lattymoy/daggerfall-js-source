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
import { createSdEnd, SD_STEP_GAP_MS, SD_STEP_JUMP_M } from '../src/scenes/sdEnd.js';

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
