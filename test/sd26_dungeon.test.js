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
