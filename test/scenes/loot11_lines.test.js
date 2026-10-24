// LOOT11 - A LINE OF LIGHT OVER EVERY FIND (2026-10-01; bible/06-Systems/Loot-Arc.md section 13, Mac: "Do you wanna
// turn this into an arc and do all of the above?" - "tier beams on Rare+ drops"). The laws pinned here:
//   - THE PICK: a find stands a line when its BEST is Rare or better, in that tier's colour; the nearest eight within
//     40 m, nearest first; gone the moment its best is taken below Rare; off, none.
//   - THE PASS: WBX3's line through the spoils' own renderer, out of the find's crown (a billboard is bottom-anchored).
//   - THE FINDS: a street body of mine (never a peer's), a dungeon's searchable body (the room's) and its piles, a
//     building's piles and bodies, and a pile put down - each host's own pass, in its own air.

import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import { pickLootLines, createLootLines, lootCrown, LOOT_LINES_MAX, LOOT_LINES_REACH, LOOT_LINE_CROWN } from '../../src/scenes/lootLines.js';
import { createDroppedLoot } from '../../src/scenes/droppedLoot.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const piece = (tier, seed = 1) => (tier === 'common' ? createWeapon(113, 1) : LR.applyRarity(createWeapon(113, 1), tier, lcg(seed)));
const find = (x, ...tiers) => ({ root: [x, 1, 0], items: tiers.map((t, i) => piece(t, i + 1)) });

test('LOOT11: the pick - a Rare or better\'s best tier, the nearest eight within 40 m, nearest first; gone below Rare; off none', () => {
  on();
  assert.deepEqual([LOOT_LINES_MAX, LOOT_LINES_REACH], [8, 40]);
  const eye = [0, 1.6, 0];
  const lines = pickLootLines([find(5, 'magic'), find(3, 'common', 'rare'), find(12, 'magic', 'legendary', 'rare'), find(41, 'legendary'), find(1, 'common')], eye);
  assert.deepEqual(lines.map((l) => [l.root[0], l.tier]), [[3, 'rare'], [12, 'legendary']], 'a Magic and a Common none; beyond 40 m none; the best of the list');
  assert.ok(lines.every((l) => l.alpha === 1));
  const many = Array.from({ length: 20 }, (_, i) => find(30 - i, 'rare'));
  const picked = pickLootLines(many, eye);
  assert.equal(picked.length, 8, 'eight');
  assert.deepEqual(picked.map((l) => l.root[0]), [11, 12, 13, 14, 15, 16, 17, 18], 'the nearest, nearest first');
  const f = find(4, 'rare', 'magic');
  assert.equal(pickLootLines([f], eye).length, 1);
  f.items.splice(0, 1);
  assert.equal(pickLootLines([f], eye).length, 0, 'its Rare taken: gone, the list read live');
  for (const bad of [{ root: [NaN, 0, 0], items: [piece('rare')] }, { root: [1, 2], items: [piece('rare')] }, { root: [1, 1, 1], items: [] }, null]) assert.deepEqual(pickLootLines([bad], eye), []);
  _resetForTests(); setPref('lootRarity', false);
  assert.deepEqual(pickLootLines([find(3, 'legendary')], eye), [], 'off: none');
});

test('LOOT11: the pass - the spoils\' own renderer, out of each find\'s crown, in its tier\'s colour; the finds asked only while the row is on', () => {
  on();
  assert.deepEqual(lootCrown([1, 2, 3], { w: 0.5, h: 0.8 }), [1, 2.8, 3], 'a bottom-anchored billboard\'s crown');
  assert.deepEqual(lootCrown([1, 2, 3], null), [1, 2 + LOOT_LINE_CROWN, 3], 'a sprite not yet sized');
  assert.equal(lootCrown(null, null), null);
  const calls = [];
  const gl = new Proxy({ ARRAY_BUFFER: 1, STATIC_DRAW: 2, FLOAT: 3, TRIANGLES: 4, BLEND: 5, ONE: 6, CULL_FACE: 7 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const pass = createLootLines(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  assert.equal(pass.draw([find(3, 'magic')], I, I, [0, 1.6, 0], 1), false, 'nothing Rare: nothing drawn');
  assert.equal(calls.length, 0, 'and nothing touched');
  assert.equal(pass.draw(() => [find(3, 'rare'), find(6, 'legendary')], I, I, [0, 1.6, 0], 1), true);
  const roots = calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uRoot').map((c) => c.slice(2));
  assert.deepEqual(roots, [[3, 1, 0], [6, 1, 0]], 'out of each crown');
  const pulses = calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uPulse').map((c) => c[2]);
  assert.deepEqual(pulses, [0, 1], 'a Legendary pulses');
  let asked = 0;
  _resetForTests(); setPref('lootRarity', false);
  assert.equal(pass.draw(() => { asked++; return [find(3, 'legendary')]; }, I, I, [0, 1.6, 0], 1), false);
  assert.equal(asked, 0, 'off: the finds never gathered');
  assert.equal(createLootLines(null).draw([find(1, 'rare')], I, I, [0, 0, 0], 1), false, 'no context, no pass');
});

test('LOOT11: the finds - a pile put down (a house\'s treasure too); a body of mine in the street, never a peer\'s; the dungeon\'s bodies, piles and drops', () => {
  on();
  const renderer = { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, drawBillboards: () => {} };
  const pool = createDroppedLoot({ renderer, getTexture: async () => null, uploadRecordFrame: () => {} });
  const rare = piece('rare');
  pool.seedPile([piece('common'), rare], [4, 0, 2], { archive: 205, record: 0 }, 'treasure:0');
  const finds = pool.lootFinds();
  assert.equal(finds.length, 1);
  assert.deepEqual(finds[0].root, [4, LOOT_LINE_CROWN, 2], 'its crown');
  assert.ok(finds[0].items.includes(rare), 'its list, live');
  const ef = read('src/scenes/exteriorFoes.js');
  assert.match(ef, /lootFinds: \(\) => foes\.filter\(\(f\) => f\.dead && f\.corpseMarker && !f\.puppet && !f\.corpseDisabled && f\.entity\?\.items\?\.length\)\.map\(\(f\) => \(\{ root: lootCrown\(f\.corpseMarker\.pos, f\.corpseMarker\.size\), items: f\.entity\.items \}\)\),/, 'my bodies, never a peer\'s');
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /\.\.\.foes\.filter\(\(f\) => lootableBody\(f\) && f\.corpsePos && f\.entity\?\.items\?\.length\)\.map\(\(f\) => \(\{ root: lootCrown\(f\.corpsePos, f\.corpseBatch\?\.size\), items: f\.entity\.items \}\)\),/, 'a searchable body (the room\'s)');
  assert.match(dc, /\.\.\.lootPiles\.filter\(\(p\) => p\.items\?\.length\)\.map\(\(p\) => \(\{ root: lootCrown\(p\.pos, p\.batch\?\.size\), items: p\.items \}\)\),\s*\.\.\.droppedLoot\.lootFinds\(\),/, 'its piles and what was put down');
});

test('LOOT11: every host draws them in its own pass - the street after the gate\'s fire, the dungeon after its billboards, a building after its characters', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const lootLines = createLootLines\(renderer\.gl\);/, 'one pass, built once');
  assert.match(w, /if \(lootLines\.draw\(\(\) => \[\.\.\.exteriorFoes\.lootFinds\(\), \.\.\.droppedLoot\.lootFinds\(\)\], proj, view, new Float32Array\(mwv\.eye\), now \/ 1000,/, 'the street\'s');
  assert.match(w, /drawLootLines: \(\{ proj, view, eye, finds \}\) => \{\s*if \(lootLines\.draw\(finds, proj, view, eye, performance\.now\(\) \/ 1000, \{ mode: renderer\._fogMode/, 'the modes\' hook, in their own air');
  const m = read('src/scenes/worldModes.js');
  assert.match(m, /host\.drawLootLines\?\.\(\{ proj, view, eye: mwv\.eye, finds: \(\) => dungeonCtx\.lootFinds\?\.\(\) \?\? \[\] \}\);/, 'the dungeon\'s');
  assert.match(m, /host\.drawLootLines\?\.\(\{ proj, view, eye: mwv\.eye, finds: \(\) => \[\.\.\.interiorDropped\.lootFinds\(\), \.\.\.\(interiorFoes\?\.lootFinds\?\.\(\) \?\? \[\]\)\] \}\);/, 'a building\'s');
});
