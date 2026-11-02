// FIELD BUGS 2026-10-30b CASTLE-TALK (bible/01-Overview/bugs/Field-Bugs-2026-10-30b.md section 1): "the Queen of
// Daggerfall, and some of the other Courtesans, having strange hit-boxes for interacting/talking to them". Every person
// in Castle Daggerfall (S0000160.RDB) carries a Dialogue action; its relay took the person's own box, came first in the
// target list and won every tie within its 3.2 m - a press there talked to no one and named no one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ActionSystem, EFFECT_ACTION_FLAGS } from '../../src/world/actionSystem.js';
import { layoutRdbBlock, MOVE_ACTION_FLAGS, ACTION_FLAGS } from '../../src/world/rdbLayout.js';
import { activationTargets, pickActivatableHit, STATIC_NPC_ACTIVATION_DISTANCE } from '../../src/player/activate.js';
import { composeActivationTargets } from '../../src/systems/worldHover.js';
import { TextureFile } from '../../src/formats/textureFile.js';
import { billboardSize } from '../../src/world/rmbFlats.js';
import { castleBlockOf, castleBlockName, CASTLE_BLOCK_INDEX, CAPITAL_CASTLE_HALLS, BAY_CASTLE_HALLS } from '../../src/world/capitalCastles.js';
import { skipReal, game, ARENA2 } from '../lwRealTown.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const DC = rd('src/scenes/dungeonContext.js');
/** The context's registerFlatAction, as written, over `env`. */
function registerFlatActionOf(env) {
  const at = DC.indexOf('const registerFlatAction = async (');
  const end = DC.indexOf('\n  };\n', at);
  assert.ok(at > 0 && end > at, 'registerFlatAction stands in buildDungeonContext');
  const fn = DC.slice(at + 'const registerFlatAction = '.length, end + 4);
  // eslint-disable-next-line no-new-func
  return new Function(...Object.keys(env), `return (${fn});`)(...Object.values(env));
}
/** worldModes.js personAabb: a person's box stands on their feet. */
const personAabb = (pn) => ({ min: [pn.x - pn.width / 2, pn.y, pn.z - pn.width / 2], max: [pn.x + pn.width / 2, pn.y + pn.height, pn.z + pn.width / 2] });

/** Who a press two metres before flat `f`'s face picks (`t` its TEXTURE file), its relay registered as the dungeon
 *  context registers it (`person`). */
async function pressAt(f, person, t) {
  const actions = new ActionSystem(null);
  const reg = registerFlatActionOf({ actions, getTexture: async () => t, billboardSize, EFFECT_ACTION_FLAGS, MOVE_ACTION_FLAGS, moveFlats: [] });
  await reg(0, f.position, f.action, f.x, f.y, f.z, f.archive, f.record, true, person);
  const size = billboardSize(t, f.record);
  const pn = { x: f.x, y: f.y - size.h / 2, z: f.z, width: size.w, height: size.h };
  const targets = composeActivationTargets(activationTargets(actions.objects), [() => [{ key: 'person:0', aabb: personAabb(pn), distance: STATIC_NPC_ACTIVATION_DISTANCE }]]);
  const face = [pn.x, pn.y + size.h * 0.85, pn.z], eye = [pn.x, pn.y + 1.6, pn.z - 2];   // a standing player's eye
  const d = face.map((v, k) => v - eye[k]), n = Math.hypot(...d);
  return pickActivatableHit(eye, d.map((v) => v / n), targets, { raycast: () => Infinity })?.key ?? null;   // nothing between
}

test('CASTLE-TALK a person whose flat carries a Dialogue action answers a press at their face from talking range - its relay takes no box of its own; a person who shows text keeps theirs (mutants: the relay boxed again; every person\'s relay unboxed)', async () => {
  assert.match(DC, /if \(f\.action\) await registerFlatAction\(bi, f\.position, f\.action, f\.x \+ b\.originX, f\.y, f\.z \+ b\.originZ, f\.archive, f\.record, true, !!pn && !showsText\(pn\)\);/, 'the flats loop says which flats are people who talk');
  assert.match(DC, /const showsText = \(pn\) => pn\?\.action\?\.actionFlag === ACTION_FLAGS\.ShowText \|\| pn\?\.action\?\.actionFlag === ACTION_FLAGS\.ShowTextWithInput;/);
  assert.match(DC, /return people\.filter\(\(pn\) => pn\.active !== false && pn\.width && !showsText\(pn\)\);/, 'npcTargets reads the same law');
  // Queen Aubk-i's picture's size (TEXTURE.334 record 21: 85 x 166 at scale -128), standing where she stands
  const t = { recordCount: 32, getSize: () => ({ width: 85, height: 166 }), getScale: () => ({ width: -128, height: -128 }) };
  const queen = { x: 5.5, y: 1.04, z: -16.7, archive: 334, record: 21, position: 4321, action: { actionFlag: ACTION_FLAGS.Dialogue, isFlat: true, triggerFlag: 0 } };
  assert.equal(await pressAt(queen, true, t), 'person:0', 'her face from two metres: the person');
  assert.match(String(await pressAt(queen, false, t)), /^act:/, 'the relay boxed took the press (the report)');
});

test('CASTLE-TALK on the game\'s own court: Castle Daggerfall\'s Queen (S0000160) and a noble of Torval\'s copy of Sentinel\'s halls answer the press; a copy of Castle Daggerfall keeps the foyer guard who opens the way to its court (mutant: a chain\'s head dropped)', { skip: skipReal }, async () => {
  const g = game();
  const texOf = new Map();
  const tex = (a) => {
    if (!texOf.has(a)) { const t = new TextureFile(); t.load(new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), TextureFile.indexToFileName(a)))), TextureFile.indexToFileName(a)); texOf.set(a, t); }
    return texOf.get(a);
  };
  const layout = (name, copy = null) => {
    const i = g.blocks.getBlockIndex(name), b = g.blocks.getBlock(i);
    return layoutRdbBlock(copy ? castleBlockOf(b, copy) : b, copy ? copy.index : i, true, (id) => g.modelOf(id));
  };
  const queen = layout('S0000160.RDB').flats.find((f) => f.npc && f.archive === 334 && f.record === 21);
  assert.equal(queen?.action?.actionFlag, ACTION_FLAGS.Dialogue, 'Queen Aubk-i carries a Dialogue action');
  assert.equal(await pressAt(queen, true, tex(queen.archive)), 'person:0', 'her face from two metres: the Queen');
  assert.match(String(await pressAt(queen, false, tex(queen.archive))), /^act:/, 'the relay boxed took the press (the report)');
  // TAMRIEL-WIDE: Torval's castle is Sentinel's halls copied, its court re-seated - a noble there talks the same
  const hall = BAY_CASTLE_HALLS[CAPITAL_CASTLE_HALLS[5]].halls[0][0];
  const noble = layout(hall, { name: castleBlockName(hall), index: CASTLE_BLOCK_INDEX }).flats.find((f) => f.npc && f.action?.actionFlag === ACTION_FLAGS.Dialogue);
  assert.ok(noble, `a person with a Dialogue action in Torval's copy of ${hall}`);
  assert.equal(await pressAt(noble, true, tex(noble.archive)), 'person:0', 'past the Bay too');
  // AUDIT FB1030 D1: Alinor's, Falinesti's and Helstrom's halls are Castle Daggerfall's - its foyer guard (183.3, the
  // terms of audience) opens the two foyer doors the court stands behind, so the copy keeps him and his chain
  const throne = BAY_CASTLE_HALLS[CAPITAL_CASTLE_HALLS[3]].halls[0][0];
  const copy = layout(throne, { name: castleBlockName(throne), index: CASTLE_BLOCK_INDEX });
  const guard = copy.flats.find((f) => f.archive === 183 && f.record === 3 && f.action?.actionFlag === ACTION_FLAGS.ShowTextWithInput);
  assert.ok(guard, 'the foyer guard stands in the copy');
  assert.ok(copy.actionLinks.get(guard.position)?.nextKey > 0, 'and his chain to the doors with him');
});
