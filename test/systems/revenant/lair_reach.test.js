// LAIR-REACH (FIELD BUGS 2026-10-19, the Discord: "You guys ever found The Revenant that would show on red on the map in
// the cave it's supposed to be in? I swear i explored fully 2 caves already for this one rev and i can't find him" - and
// "he never showed up in the lair. I had to bait them out to me on the road"): A REVENANT AT HOME STANDS WHERE A WALK
// REACHES. RVN7d stood it "at the layout marker farthest from the entrance", over the layout's raw enemy markers - and the
// caps DFU closes a dungeon's layout with (its border blocks, named B...) ring the layout, so that marker all but always
// stood in one: a pocket no walk reaches (SD-REACH found the same of the Rift, 2026-10-08, and fixed the Rift alone). The
// lair's stand and the Rift now ask the host's one end (scenes/dungeonContext.js dungeonEnd): the farthest of SD-REACH's
// candidates (world/superDungeon/sdDungeon.js sdEndMarks - an interior block's enemy markers, out of the water where any
// is). The record: bible/01-Overview/bugs/Field-Bugs-2026-10-19.md LAIR-REACH.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sdEndMarks } from '../../../src/world/superDungeon/sdDungeon.js';
import { dungeonEndOf } from '../../../src/world/dungeon/dungeonEnd.js';
import { RDB_SIDE } from '../../../src/world/rdbLayout.js';

const S = RDB_SIDE;
/** A block of the layout at grid (gx, gz) - its name, its origin, its water (the layout's dungeon.blocks shape). */
const block = (name, gx, gz, waterLevel = 10000) => ({ name, originX: gx * S, originZ: gz * S, layout: { startMarkers: [], waterLevel } });
const at = (gx, gz, lx, lz, y = 0) => ({ x: gx * S + lx, y, z: gz * S + lz, mobileType: 0 });
const D = readFileSync(new URL('../../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');

test('LAIR-REACH the law the lair now reads: the farthest marker a walk reaches - never a border cap\'s, though the caps ring the layout and hold the farthest point; with every marker in a cap, the farthest of them (mutant: the raw markers)', () => {
  // the way in at the start block; an interior block beyond it; a cap closing the layout past both
  const blocks = [block('N0000010.RDB', 0, 0), block('N0000022.RDB', 1, 0), block('B0000003.RDB', 2, 0), block('B0000004.RDB', 0, 1)];
  const from = { x: 10, z: 10 };
  const near = at(0, 0, 30, 30), deep = at(1, 0, S - 20, 40), cap = at(2, 0, S / 2, S / 2), side = at(0, 1, 15, S - 5);
  const enemies = [near, cap, deep, side];
  assert.equal(dungeonEndOf(from, enemies), cap, 'the raw markers: the cap\'s pocket - where the lair stood its revenant');
  const end = dungeonEndOf(from, sdEndMarks(enemies, blocks));
  assert.deepEqual([end.x, end.z], [deep.x, deep.z], 'SD-REACH\'s candidates: the interior block\'s, the deepest a walk reaches');
  assert.deepEqual([dungeonEndOf(from, sdEndMarks([cap, side], blocks))].map((m) => [m.x, m.z]), [[cap.x, cap.z]], 'every marker in a cap: the farthest of them - a lair somewhere, never none');
  // out of the water where any is: a flooded interior block's marker is the end only when no interior marker is dry
  const wet = [block('N0000010.RDB', 0, 0), block('N0000022.RDB', 1, 0, 0), block('B0000003.RDB', 2, 0), block('B0000004.RDB', 0, 1)];
  const dryEnd = dungeonEndOf(from, sdEndMarks(enemies, wet, () => -5));
  assert.deepEqual([dryEnd.x, dryEnd.z], [near.x, near.z], 'the deep block flooded: the dry one');
});

test('LAIR-REACH the host: the lair\'s stand and the Rift ask ONE end - dungeonEnd, over SD-REACH\'s candidates from the way in - and nothing in the host hands dungeonEndOf the raw markers; a lair with no end frees its claim (mutants: the lair off the law; the Rift off it; the candidates unasked)', () => {
  // LAIR-WALK (test/systems/revenant/lair_walk.test.js): `reaches`, the walk's test - the Rift asks none (dungeonEndOf)
  assert.match(D, /function dungeonEnd\(reaches = null\) \{\n\s*const from = dungeon\.enterMarker \?\? dungeon\.startMarker \?\? null;\n\s*return reachableEndOf\(from, sdEndMarks\(_layoutEnemies, dungeon\.blocks, \(m\) => floorLanding\(collider, \[m\.x, m\.y \+ 0\.2, m\.z\]\)\[1\]\), reaches\)/);
  const ends = D.slice(D.indexOf('function dungeonEnd(reaches = null) {'), D.indexOf('/** ITS LAIR STAND'));
  assert.equal((D.match(/reachableEndOf\(|dungeonEndOf\(/g)?.length ?? 0) - (ends.match(/reachableEndOf\(|dungeonEndOf\(/g)?.length ?? 0), 0, 'the end\'s law asked in dungeonEnd alone');
  const lair = D.slice(D.indexOf('async function standLairRevenant() {'), D.indexOf('function standDungeonBand('));
  assert.match(lair, /const far = \(reaches && dungeonEnd\(reaches\)\) \|\| dungeonEnd\(\);/, 'the lair\'s stand - the walk\'s end, else SD-REACH\'s');
  assert.match(lair, /if \(!far\) \{ releaseRevenantStand\(r\); return null; \}/, 'no end: the claim freed');
  assert.doesNotMatch(lair, /_layoutEnemies/, 'never the raw markers');
  const rift = D.slice(D.indexOf('function standSdEnd() {'), D.indexOf('const probe = sdProbeOf(collider);', D.indexOf('function standSdEnd() {')));   // SD-THROUGH (PIN MOVED): the end's one probe (scenes/superDungeon/sdEnd.js sdProbeOf)
  assert.match(rift, /const end = dungeonEnd\(\);/, 'the Rift');
});
