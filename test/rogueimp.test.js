// ROGUE-IMP (2026-09-26, Triage on the Discord: "Rogue imp unable to kill hes in the floorboards" - "was able to fireball
// the floor, but it spawns in the floorboards"): N0B30Y15 places its imp (a FLYING foe) at a QuestSpawn marker of a
// palace - a building. A building's marker is its flat's BASE on the floor (world/interiorLayout.js); the interior's
// stand handed it to the pool as a sprite CENTRE (the dungeon's RDB convention), and the pool dropped the flyer half its
// idle sprite: its feet under the boards, its body in the floor, out of every blade's reach. The stand hands the marker
// over as FEET now. The pool is driven here (a fake texture, a MONSTER.BSA with no careers - the default stats), and
// the host's wiring pinned by source (the host needs a browser to import).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { idleSpriteHeight } from '../src/characters/enemyAnchor.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const IMP = 1;
/** A quest resource's behaviour, as far as the pool's binding asks (scenes/questFoeHost.js bindQuestFoeHost). */
const behaviour = () => ({ bindHost() {}, start() {} });
const stubTex = { getSize: () => ({ width: 64, height: 120 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const pool = () => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {}, textures: new Map() },
  collider: { raycast: () => 0.5, heightAt: () => 0 },
  fetchBytes: async (name) => { if (name === 'MONSTER.BSA') return Uint8Array.from([0, 0, 0x00, 0x01]); throw new Error(`no ${name} in this pin`); },   // no records, a name directory: every career is the defaults
  getTexture: async () => stubTex,
  uploadRecordFrame: () => {},
  currentMinute: () => 1000,
  playerEntity: { level: 1, reflexes: 2, skills: 30, items: [], stats: { strength: 50, agility: 50, luck: 50 } },
  audio: null, onPlayerHurt: () => {}, rand: () => 0.5, rolls: () => 0.5,
});

test('ROGUE-IMP: an imp is a flyer, and the pool reads a flyer\'s point as its sprite CENTRE unless told the point is its feet', async () => {
  assert.equal(ENEMY_BASICS[IMP].behaviour, 'Flying');
  const idleH = idleSpriteHeight(stubTex);
  assert.ok(idleH > 1, `a sprite tall enough to bury (${idleH.toFixed(2)})`);
  const floor = 10;
  const centre = pool();
  const asCentre = await centre.spawnFoe(IMP, [5, floor, 5], { questBehaviour: behaviour() });
  assert.ok(Math.abs(asCentre.ai.feet[1] - (floor - idleH / 2)) < 1e-9, 'a centre on the floor: the feet half a sprite under it - the report');
  const feet = pool();
  const asFeet = await feet.spawnFoe(IMP, [5, floor + 0.1, 5], { questBehaviour: behaviour(), feetGiven: true });
  assert.ok(Math.abs(asFeet.ai.feet[1] - (floor + 0.1)) < 1e-9, 'handed its feet: it hangs on the floor');
});

test('ROGUE-IMP by source: the building\'s marker stand hands the marker over as FEET, a walker\'s hair above the floor - the dungeon\'s marker stand keeps the centre it is', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /export const INTERIOR_MARKER_FEET_LIFT = 0\.1;/, 'the pool\'s own walker lift');
  assert.match(wm, /interiorFoes\.spawnFoe\(foe\.foeType, interiorCtx\.parentPt\(position\.x, position\.y \+ INTERIOR_MARKER_FEET_LIFT, position\.z\), \{\s*gender, questBehaviour: behaviour, feetGiven: true,\s*(?:\/\/[^\n]*\n\s*)*questMarker: true,[^\n]*\n\s*\}\)/);   // QUEST-PARTY phase 3b: and flagged a marker's
  const fx = src('src/scenes/exteriorFoes.js');
  assert.match(fx, /pos\[1\] \+ \(feetGiven \|\| groundAlign \|\| transformY \? 0 : 0\.1\)/, 'feet given: no second lift, so a walker stands exactly where it did');
  assert.match(fx, /\} else if \(behaviour === 'Flying' && !feetGiven\) pending\.feet\[1\] -= idleH \/ 2 \+ 0\.1;/, 'and no flyer\'s drop - which stays for the true centres (CreateFoe\'s, the watch\'s)');
  const dc = src('src/scenes/dungeonContext.js');
  assert.match(dc, /Flying/, 'the dungeon keeps its own centre law (enemyAnchor.js feetFromCentre) for an RDB marker');
});
