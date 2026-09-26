// WB5 (2026-09-25, Mac: "On death the boss would physically spew out per player loot and bounce (sort of how dropping a
// torch works) and have a sort of rarity glow attached to it"): THE SPOILS, DRIVEN. The spew (world/gateSpew.js - each
// piece's launch out of his chest toward the player's side, one at a time, and the thrown torch's own flight: gravity
// by its drag, the bounce off the struck face at its bounciness, rest under a fifth of the throw); the glow
// (render/spoilsGlow.js - Loot Rarity's own colours, a beam by tier over a halo, the pass on the duel wall's law); the
// roll and the Sigil Stone's own row (systems/gateSpoils.js); the floor, once a day, and the crash's door
// (scenes/spoilsPool.js); the court's burst and the world host's seams.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { spewLaunches, spewPiece, stepSpew, flySpew, SPEW_GAP_MS, SPEW_SPREAD, SPEW_SPEED, SPEW_BOUNCE, SPEW_GRAVITY_DRAG, SPEW_FLIGHT_MAX_S } from '../src/world/gateSpew.js';
import { PROJECTILE, PROJECTILE_FIXED_DT } from '../src/scenes/droppedTorches.js';
import { seededRng } from '../src/systems/wind.js';
import {
  tierColour, spoilsLineVertices, SpoilsGlowRenderer, SPOILS_LINE_H, SPOILS_LINE_W, SPOILS_LINE_MIN_RAD, SPOILS_GLOW_MAX, SPOILS_GLOW_FS, SPOILS_GLOW_VS, lineHeight,
} from '../src/render/spoilsGlow.js';
import { RARITIES, rarityChances } from '../src/systems/lootRarity.js';
import {
  rollSpoils, spoilsBase, magicOrBetter, sigilStone, isSigilStone, SPOILS_GOLD_PER_LEVEL, SPOILS_LEGENDARY, SPOILS_SOURCE, SIGIL_STONE, SIGIL_STONE_TEMPLATE,
} from '../src/systems/gateSpoils.js';
import {
  createSpoilsPool, spoilsList, spoilsStore, recoverSpoils, savedSince, SPOILS_TAKE_M, SPOILS_STORE_KEY, SPOILS_DAY_KEY, SPOILS_TEXT, SIGIL_TIER,
} from '../src/scenes/spoilsPool.js';
import { isAmmunition, templateByIndex, setItemFields, mintCondition, inventoryItemImage, registerCustomTemplates, ITEM_TEMPLATES } from '../src/systems/itemTemplates.js';
import { RRI_TEMPLATES } from '../src/systems/rriItems.js';
import { isStackable, stacksWith, addItem } from '../src/systems/inventory.js';
import { isDeclaredItemField } from '../src/systems/itemFields.js';
import { THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE } from '../src/characters/thunderlockIds.js';
import { execFileSync } from 'node:child_process';
import { RANDOM_TREASURE_ICONS, validLootItem } from '../src/systems/loot.js';
import { createGateCourt, SPEW_AT_MS, RECEIPT_WAIT_MS, COURT_STRIKE_TEXT } from '../src/scenes/gateCourt.js';
import { GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { mintReceipt } from '../src/net/gateReceipt.js';
import { courtToDungeon, COURT_TEXT } from '../src/world/gateArena.js';
import { readFileSync } from 'node:fs';

/** A floor at y 0, as the collider's ray answers it. */
const floor = (from, dir, len) => { if (dir[1] >= 0) return null; const t = from[1] / -dir[1]; return t <= len ? { dist: t, normal: [0, 1, 0] } : null; };

test('WB5 the spew\'s launches: one a piece, the seed\'s own and the same every time, leaving one at a time, out toward the player\'s side of him within the spread, up, at the throw\'s speeds (mutants: all at once; toward his back)', () => {
  const a = spewLaunches(seededRng(77), 5, Math.PI / 2), b = spewLaunches(seededRng(77), 5, Math.PI / 2);
  assert.deepEqual(a, b, 'the seed\'s own');
  assert.deepEqual(a.map((l) => l.at), [0, 1, 2, 3, 4].map((i) => i * SPEW_GAP_MS), 'one at a time');
  for (const l of a) {
    assert.ok(Math.abs(Math.hypot(...l.dir) - 1) < 1e-9, 'a unit direction');
    assert.ok(l.dir[1] > 0.5, 'up');
    const off = Math.atan2(l.dir[0], l.dir[2]) - Math.PI / 2;
    assert.ok(Math.abs(off) <= SPEW_SPREAD + 1e-9, 'toward the player\'s side of him');
    assert.ok(l.speed >= SPEW_SPEED.min && l.speed <= SPEW_SPEED.max);
  }
  assert.notDeepEqual(spewLaunches(seededRng(78), 5, 0), spewLaunches(seededRng(77), 5, 0), 'another seed, another spew');
});

test('WB5 the flight is the thrown torch\'s: gravity gathered by its drag, the flight reflected off the struck face with the speed at its bounciness and the gravity dropped, rest on the struck point once a bounce leaves it under a fifth of the throw - out from his chest to the floor a few metres off, in about a second (mutants: the bounce kept at full speed; rest never reached)', () => {
  const [l] = spewLaunches(seededRng(5), 1, 0);
  const p = spewPiece([0, 3.1, 0], l);
  assert.deepEqual(p.gravity, [0, 0, 0]);
  assert.equal(stepSpew(p, floor), 'fly');
  assert.ok(Math.abs(p.gravity[1] - PROJECTILE.gravityAccel * SPEW_GRAVITY_DRAG * PROJECTILE_FIXED_DT) < 1e-12, 'gravity gathered by the torch\'s drag, a fixed step at a time');
  let bounces = 0, steps = 1, speedAtBounce = [];
  while (!p.rest && steps < 5000) { const w = stepSpew(p, floor); steps++; if (w === 'bounce') { bounces++; speedAtBounce.push(p.speedCurrent); } }
  assert.ok(p.rest, 'it comes to rest');
  assert.equal(p.pos[1], 0, 'on the floor it struck');
  assert.ok(bounces >= 2, `it bounces: ${bounces}`);
  for (let i = 1; i < speedAtBounce.length; i++) assert.ok(Math.abs(speedAtBounce[i] - speedAtBounce[i - 1] * SPEW_BOUNCE) < 1e-9, 'each bounce at the bounciness');
  assert.ok(speedAtBounce.at(-1) < l.speed * PROJECTILE.restFraction, 'at rest once under a fifth of the throw');
  const d = Math.hypot(p.pos[0], p.pos[2]);
  assert.ok(d > 3 && d < 9, `a few metres off him: ${d.toFixed(2)}`);
  assert.ok(steps * PROJECTILE_FIXED_DT < 2, `in about a second: ${(steps * PROJECTILE_FIXED_DT).toFixed(2)} s`);
  assert.equal(stepSpew(p, floor), 'rest', 'and stays');
  // a piece that never finds ground stands where it is after its time
  const lost = spewPiece([0, 3, 0], l);
  let n = 0;
  while (!lost.rest && n < 10000) { stepSpew(lost, () => null); n++; }
  assert.ok(lost.rest && Math.abs(n * PROJECTILE_FIXED_DT - SPEW_FLIGHT_MAX_S) < 0.05, 'stood after its flight\'s time');
  // the frame clock: what happened on the way
  const q = spewPiece([0, 3.1, 0], l);
  const seen = [];
  for (let t = 0; t < 3 && !q.rest; t += 1 / 60) seen.push(flySpew(q, 1 / 60, floor));
  assert.ok(seen.includes('bounce') && seen.at(-1) === 'rest');
});

test('WB5 the glow, WBX3 a line: Loot Rarity\'s own colours, a SMALL line out of the top of the piece\'s own sprite - taller by tier, never thinner on the screen than its floor, a Legendary\'s and an Artifact\'s pulsing; the pass adds one quad a piece, capped, no depth written, the faded skipped (mutants: the beam back; the line off the sprite\'s crown)', () => {
  assert.deepEqual(tierColour('rare').map((c) => Math.round(c * 255)), [0xe4, 0xc3, 0x4f], 'Rare\'s #e4c34f');
  assert.deepEqual(tierColour('magic').map((c) => Math.round(c * 255)), [0x6f, 0x9e, 0xe8]);
  assert.deepEqual(tierColour('nonsense'), tierColour('common'));
  const order = ['common', 'magic', 'rare', 'legendary', 'artifact'];
  for (let i = 1; i < order.length; i++) assert.ok(SPOILS_LINE_H[order[i]] > SPOILS_LINE_H[order[i - 1]], `${order[i]} taller than ${order[i - 1]}`);
  for (const t of order) { assert.ok(RARITIES[t], t); assert.ok(SPOILS_LINE_H[t] <= 2.5, `${t}: small - a line, not WB5's 8 m beam`); }
  assert.equal(lineHeight('nonsense'), SPOILS_LINE_H.common);
  assert.ok(SPOILS_LINE_W <= 0.1, 'thin');
  assert.equal(spoilsLineVertices().length, 12, 'one quad');
  assert.match(SPOILS_GLOW_FS, /float pulse = 1\.0 \+ uPulse \* 0\.35 \* sin\(/);
  assert.match(SPOILS_GLOW_VS, /vec3 mid = uRoot \+ vec3\(0\.0, aP\.y \* uHeight, 0\.0\);/, 'up out of the root');
  assert.match(SPOILS_GLOW_VS, /float w = max\(uWidth, length\(toEye\) \* uMinRad\);/, 'never thinner than its floor on the screen');
  assert.match(SPOILS_GLOW_FS, /float root = exp\(-h \* 14\.0\);/, 'brightest where it leaves the sprite');
  const calls = [];
  const gl = new Proxy({ ARRAY_BUFFER: 1, STATIC_DRAW: 2, FLOAT: 3, TRIANGLES: 4, BLEND: 5, ONE: 6, CULL_FACE: 7 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const pass = new SpoilsGlowRenderer(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  pass.draw([], I, I, [0, 0, 0], 1);
  assert.equal(calls.length, 0, 'nothing to draw, nothing touched');
  const g = (tier, alpha = 1) => ({ root: [1, 0.7, 2], tier, alpha });
  pass.draw([g('magic'), g('legendary'), g('rare', 0), ...Array(12).fill(g('magic'))], I, I, [0, 1.6, 9], 3);
  assert.equal(pass.drawn, SPOILS_GLOW_MAX, 'capped, the faded skipped first');
  assert.equal(calls.filter((c) => c[0] === 'drawArrays').length, SPOILS_GLOW_MAX);
  assert.equal(calls.find((c) => c[0] === 'drawArrays')[3], 6, 'one quad a piece');
  const roots = calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uRoot').map((c) => c.slice(2));
  assert.deepEqual(roots[0], [1, 0.7, 2], 'rooted where the pool said - the sprite\'s crown');
  assert.deepEqual(calls.find((c) => c[0] === 'uniform3f' && c[1] === 'uEye').slice(2), [0, 1.6, 9], 'turned to the eye');
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uMinRad').slice(2), [SPOILS_LINE_MIN_RAD]);
  const pulses = calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uPulse').map((c) => c[2]);
  assert.deepEqual(pulses.slice(0, 2), [0, 1], 'a Legendary pulses, a Magic does not');
  const colours = calls.filter((c) => c[0] === 'uniform3fv' && c[1] === 'uColor').map((c) => c[2]);
  assert.deepEqual(colours.slice(0, 2), [tierColour('magic'), tierColour('legendary')], 'each in its own tier\'s colour');
  const heights = calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uHeight').map((c) => c[2]);
  assert.deepEqual(heights.slice(0, 2), [SPOILS_LINE_H.magic, SPOILS_LINE_H.legendary]);
  assert.deepEqual(calls.filter((c) => c[0] === 'depthMask').map((c) => c[1]), [false, true]);
  assert.deepEqual(calls.filter((c) => c[0] === 'blendFunc').map((c) => c.slice(1)), [[gl.ONE, gl.ONE]]);
});

// ── the roll, the floor and the court's burst ─────────────────────────

test('WB5 the roll: the seed\'s own - the same spoils every time, another seed\'s others; gold by the level, a fifth either way; three graded pieces - the first Rare or better, the others Magic or better - weapons never ammunition, never a piece the port has no row for, each with SetItem\'s condition and KNOWN (the name the floor says is the pack\'s), every field a declared one; and the Sigil Stone, one a kill (mutants: the gold off the level; the first piece only Magic; ammunition kept; no condition; unidentified; a piece without its row)', () => {
  assert.deepEqual(rollSpoils(1234, 12), rollSpoils(1234, 12), 'the same seed and world roll the same');
  assert.notDeepEqual(rollSpoils(1235, 12).pieces.map((p) => p.item.name), rollSpoils(1234, 12).pieces.map((p) => p.item.name));
  let legendary = 0;
  const groups = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const s = rollSpoils(seed, 10);
    assert.ok(s.gold >= SPOILS_GOLD_PER_LEVEL * 10 * 0.8 - 1 && s.gold <= SPOILS_GOLD_PER_LEVEL * 10 * 1.2 + 1, `gold by the level: ${s.gold}`);
    assert.equal(s.pieces.length, 3);
    assert.ok(['rare', 'legendary'].includes(s.pieces[0].tier), `the first is Rare or better: ${s.pieces[0].tier}`);
    if (s.pieces[0].tier === 'legendary') legendary++;
    for (const p of s.pieces) {
      assert.ok(['magic', 'rare', 'legendary'].includes(p.tier), p.tier);
      assert.equal(p.item.rarity, p.tier, 'the tier the item wears');
      assert.ok(templateByIndex(p.item.templateIndex) && String(p.item.name).trim(), 'never a piece the port has no row for');
      assert.ok(!isAmmunition(p.item), 'never ammunition');
      assert.ok(['Weapons', 'Armor', 'Jewellery'].includes(p.item.group));
      groups.add(p.item.group);
      assert.ok(p.item.maxCondition > 0 && p.item.currentCondition === p.item.maxCondition, `${p.item.group} ${p.item.name}: SetItem's condition, whole (${p.item.currentCondition}/${p.item.maxCondition})`);
      assert.equal(p.item.isIdentified, true, 'known');
      for (const k of Object.keys(p.item)) assert.ok(isDeclaredItemField(k), `'${k}' is a declared item field`);
    }
    assert.ok(isSigilStone(s.sigil), 'the Sigil Stone, one a kill');
    for (const k of Object.keys(s.sigil)) assert.ok(isDeclaredItemField(k), `the stone's '${k}' is a declared item field`);
  }
  assert.deepEqual([...groups].sort(), ['Armor', 'Jewellery', 'Weapons'], 'all three makers answer');
  assert.ok(legendary > 200 * SPOILS_LEGENDARY * 0.3 && legendary < 200 * SPOILS_LEGENDARY * 2.5, `about one in ten Legendary: ${legendary}`);
  assert.ok(rollSpoils(9, 30).gold > rollSpoils(9, 3).gold, 'a higher level, more gold');
  // the two Magic-or-better pieces by a boss's chances at the ladder's top, the Common share cut away
  const c = rarityChances(SPOILS_SOURCE);
  const tiers = { magic: 0, rare: 0, legendary: 0 };
  const r = seededRng(4);
  for (let i = 0; i < 4000; i++) tiers[magicOrBetter(r)]++;
  assert.ok(Math.abs(tiers.legendary / 4000 - c.legendary / c.magic) < 0.02 && Math.abs((tiers.rare + tiers.legendary) / 4000 - c.rare / c.magic) < 0.03, JSON.stringify(tiers));
  const base = spoilsBase(5, seededRng(3));
  assert.ok(base.group && base.maxCondition > 0, 'a base piece comes with its condition');
  // as the hosts stand at boot (scenes/shared.js installs Roleplay & Realism's rows): its pieces ride the roll, each on
  // its own row's condition
  registerCustomTemplates(RRI_TEMPLATES);
  let custom = 0;
  for (let seed = 1; seed <= 200; seed++) {
    for (const p of rollSpoils(seed, 10).pieces) {
      if (!RRI_TEMPLATES.some((t) => t.index === p.item.templateIndex)) continue;
      custom++;
      assert.ok(p.item.maxCondition > 0 && p.item.currentCondition === p.item.maxCondition, `${p.item.name}: its own row's condition`);
    }
  }
  assert.ok(custom > 0, `the custom pieces ride the roll: ${custom}`);
});

test('WB5 the Sigil Stone is its own row, not a renamed gem: template 570 (past DFU\'s 288, Climates & Calories\' 530-541 and the Thunderlock\'s 560/561), a gem by group at the gate\'s price with a gem\'s weight and wear and the Ruby\'s art; no ingredient, so it never stacks - a Ruby in the pack keeps its row and the stone its name; it rides the loot validator whole; and every host has the row, because the hosts\' shared module imports it (mutants: a renamed gem; the hosts\' import pulled)', () => {
  assert.equal(SIGIL_STONE_TEMPLATE, 570);
  assert.ok(SIGIL_STONE_TEMPLATE >= ITEM_TEMPLATES.length && ![THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE].includes(SIGIL_STONE_TEMPLATE) && (SIGIL_STONE_TEMPLATE < 530 || SIGIL_STONE_TEMPLATE > 541), 'past every other row');
  const t = templateByIndex(SIGIL_STONE_TEMPLATE);
  assert.equal(t.name, SIGIL_STONE.name); assert.equal(t.basePrice, SIGIL_STONE.value); assert.equal(t.custom, true); assert.equal(t.isIngredient, false);
  assert.equal(t.baseWeight, templateByIndex(0).baseWeight, 'a gem\'s weight'); assert.equal(t.hitPoints, templateByIndex(0).hitPoints, 'and wear');
  const stone = sigilStone();
  assert.deepEqual(stone, { group: 'Gems', templateIndex: SIGIL_STONE_TEMPLATE, name: 'Sigil Stone', value: 5000, maxCondition: 1000, currentCondition: 1000 });
  assert.deepEqual(inventoryItemImage(stone).archive, 254); assert.equal(inventoryItemImage(stone).record, 0, 'the Ruby\'s art');
  const ruby = mintCondition(setItemFields({ group: 'Gems', templateIndex: 0 }));
  assert.equal(isStackable(ruby), true, 'a classic gem is an ingredient, and stacks');
  assert.equal(isStackable(stone), false, 'the stone does not');
  assert.equal(stacksWith(ruby, stone), false);
  const pack = [];
  addItem(pack, ruby); addItem(pack, stone); addItem(pack, sigilStone());
  assert.deepEqual(pack.map((i) => [i.name, i.stackCount ?? 1]), [['Ruby', 1], ['Sigil Stone', 1], ['Sigil Stone', 1]], 'a row each, the name kept');
  assert.deepEqual(validLootItem(JSON.parse(JSON.stringify(stone))), stone, 'whole through the validator');
  // THE WAY THE GAME ASKS: a process that imports the hosts' shared module and nothing else has the row
  const root = new URL('..', import.meta.url);
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', "await import('./src/scenes/shared.js'); const { templateByIndex } = await import('./src/systems/itemTemplates.js'); process.stdout.write(String(templateByIndex(570)?.name ?? null));"], { cwd: root, encoding: 'utf8' });
  assert.equal(out, 'Sigil Stone', 'the hosts carry the row');
  const shared = readFileSync(new URL('../src/scenes/shared.js', import.meta.url), 'utf8');
  assert.match(shared, /^import '\.\.\/systems\/gateSpoils\.js';/m, 'and the import is said out loud');
});

const WALL = 1_700_000_000_000;
/** A floor the pool can spew on: a flat floor at y 0, feet, a clock, a pack and a store. */
function pool({ feet = null, store = null, who = 'char-1' } = {}) {
  const clock = { t: 100000 };
  const pack = [], said = [], sounds = [];
  const mem = new Map();
  const st = store ?? { get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), set: (k, v) => mem.set(k, JSON.stringify(v)), remove: (k) => mem.delete(k), mem };
  const p = createSpoilsPool({
    ray: floor, feet: () => (feet ? feet() : null), now: () => clock.t, take: (x) => pack.push(x), say: (t) => said.push(t), store: st,
    audio: { play3d: (clip, pos) => sounds.push([clip, pos]) }, who: () => who, wall: () => WALL,
  });
  return { p, clock, pack, said, sounds, st };
}
const run = (h, ms, step = 16) => { for (let t = 0; t < ms; t += step) { h.clock.t += step; h.p.frame(); } };

test('WB5 the floor: the burst leaves one piece at a time from his chest, each clattering where it lands and resting in its tier (the Sigil Stone the rarest, the gold plain); a Rare-or-better at rest rings the chime and carries a light; walked over, a piece goes into the pack with its name said; leaving gathers the rest; the device keeps the pieces AS ROLLED, and whose, from the burst until a save holds them - taking and gathering change nothing there (mutants: a piece taken in the air; the take out of reach; the gather leaving pieces; the record without its pieces)', () => {
  const me = { at: null };
  const h = pool({ feet: () => me.at });
  assert.equal(h.p.spew({ day: 700, seed: 99, level: 8, at: [0, 3.1, 0], bearing: 0 }), true);
  const list = spoilsList(99, 8);
  assert.equal(list.length, 5); assert.equal(list[3].tier, SIGIL_TIER); assert.ok(isSigilStone(list[3].item)); assert.equal(list[4].kind, 'gold');
  for (const q of list) assert.ok(RANDOM_TREASURE_ICONS.includes(q.record), 'dressed in a treasure flat');
  const burst = { day: 700, at: WALL, who: 'char-1', pieces: JSON.parse(JSON.stringify(list)) };
  assert.deepEqual(h.st.get(SPOILS_STORE_KEY), [burst], 'the record, at the burst: the pieces as rolled, when and whose');
  run(h, 100);
  assert.deepEqual(h.p.state().pieces.map((q) => q.left), [true, false, false, false, false], 'one at a time');
  run(h, 4000);
  const s = h.p.state().pieces;
  assert.ok(s.every((q) => q.left && q.rest), 'all out and at rest');
  assert.ok(s.every((q) => q.pos[1] === 0), 'on the floor');
  assert.ok(h.sounds.some((x) => x[0] === 380), 'the torch\'s own clatter');
  const rare = list.filter((q) => ['rare', 'legendary', 'artifact'].includes(q.tier)).length;
  assert.equal(h.sounds.filter((x) => x[0] === 364).length, rare, 'the rare chime for each Rare or better, at rest');
  assert.equal(h.p.lights().length, rare, 'and its light');
  assert.equal(h.p.batches().length, 0, 'no sprite with no art (the node test has none)');
  // walk over the first
  me.at = [s[0].pos[0] + SPOILS_TAKE_M + 0.3, 0, s[0].pos[2]];
  run(h, 50);
  assert.equal(h.pack.length, 0, 'out of reach');
  me.at = [s[0].pos[0] + SPOILS_TAKE_M - 0.2, 0, s[0].pos[2]];
  run(h, 50);
  assert.ok(h.pack.length >= 1, 'walked over, taken');
  assert.equal(h.pack[0].item.name, list[0].item.name, 'the first to land, the first taken');
  assert.equal(h.said[0], SPOILS_TEXT.item(list[0].item.name, list[0].tier), 'its name said, with its tier');
  assert.deepEqual(h.st.get(SPOILS_STORE_KEY), [burst], 'taking changes nothing in the record: the pack is only as safe as the last save');
  me.at = null;
  const before = h.pack.length;
  assert.equal(h.p.gather(), 5 - before, 'leaving gathers the rest');
  assert.equal(h.pack.length, 5, 'every piece in the pack');
  assert.equal(h.said.at(-1), SPOILS_TEXT.gathered);
  assert.deepEqual(h.st.get(SPOILS_STORE_KEY), [burst], 'and the record stands until a save holds them');
  assert.ok(h.pack.some((q) => q.kind === 'gold' && q.gold === rollSpoils(99, 8).gold));
  // a piece is never taken in the air
  const h2 = pool({ feet: () => [0, 3.1, 0] });
  h2.p.spew({ day: 701, seed: 5, level: 3, at: [0, 3.1, 0], bearing: 0 });
  run(h2, 60);
  assert.equal(h2.pack.length, 0, 'not in the air, even at his chest');
});

test('WB5 once a day, on this device: the relay answers a fighter who comes back after the kill with his fall and the receipt again, so the day whose spoils left him is kept - a second burst that day spews nothing, gathered or not, in this pool or a new one on the same device; the next day\'s does; with no store the session still holds it (mutants: the device\'s word ignored; the session\'s word ignored)', () => {
  const h = pool();
  assert.equal(h.p.spew({ day: 700, seed: 99, level: 8, at: [0, 3.1, 0], bearing: 0 }), true);
  assert.deepEqual(h.st.get(SPOILS_DAY_KEY), ['700:'], 'the day kept, with its account (AUDIT WB A9 - none named here)');
  assert.equal(h.p.spew({ day: 700, seed: 99, level: 8, at: [0, 3.1, 0], bearing: 0 }), false, 'once');
  h.p.gather();
  assert.equal(h.p.spew({ day: 700, seed: 99, level: 8, at: [0, 3.1, 0], bearing: 0 }), false, 'gathered is not a new floor');
  const again = pool({ store: h.st });
  assert.equal(again.p.spew({ day: 700, seed: 99, level: 8, at: [0, 3.1, 0], bearing: 0 }), false, 'a reconnect, a reload: the device remembers');
  assert.deepEqual(again.p.state().pieces, [], 'and nothing is on its floor');
  assert.equal(again.p.spew({ day: 701, seed: 3, level: 8, at: [0, 3.1, 0], bearing: 0 }), true, 'the next day\'s spoils are the next day\'s');
  const bare = createSpoilsPool({ ray: floor, now: () => 0, take: () => {} });
  assert.equal(bare.spew({ day: 9, seed: 1, level: 1, at: [0, 3, 0], bearing: 0 }), true);
  bare.gather();
  assert.equal(bare.spew({ day: 9, seed: 1, level: 1, at: [0, 3, 0], bearing: 0 }), false, 'no store: the session holds it');
});

test('WB5 a crash loses nothing: at boot the record\'s pieces AS KEPT (not a re-roll) go back to their character, through the loot validator, and the record stays until a save of that character since the burst holds them - then it clears; another character\'s record waits; junk hands over nothing and is cleared; the store is the app\'s own storage as JSON (mutants: a save since ignored; another character handed them; any character\'s save counted; the validator skipped)', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const st = spoilsStore(storage);
  const kept = JSON.parse(JSON.stringify(spoilsList(42, 6)));
  kept[0].item.name = 'As Kept';   // the record's word, whatever a re-roll would say
  st.set(SPOILS_STORE_KEY, { day: 700, at: WALL, who: 'char-1', pieces: kept });
  assert.equal(typeof mem.get(SPOILS_STORE_KEY), 'string');
  const info = (who, t) => ({ characterId: who, characterName: 'Mac', dateAndTime: { realTime: t } });
  const got = [];
  assert.equal(recoverSpoils(st, (p) => got.push(p), { who: 'char-1', saves: [info('char-1', WALL - 1)] }), 5, 'no save since: every piece, taken or not');
  assert.equal(got[0].item.name, 'As Kept', 'the pieces as kept, never a re-roll');
  assert.deepEqual(got.map((p) => (p.kind === 'gold' ? p.gold : p.item.name)), kept.map((p) => (p.kind === 'gold' ? p.gold : p.item.name)));
  assert.ok(st.get(SPOILS_STORE_KEY), 'and the record stays: a second crash before a save loses nothing either');
  assert.equal(recoverSpoils(st, (p) => got.push(p), { who: 'char-2', saves: [] }), 0, 'another character\'s record waits');
  assert.ok(st.get(SPOILS_STORE_KEY));
  assert.equal(recoverSpoils(st, (p) => got.push(p), { who: 'char-1', saves: [info('char-2', WALL + 5)] }), 5, 'another character\'s save holds nothing of mine');
  assert.equal(recoverSpoils(st, () => assert.fail('a save since holds them'), { who: 'char-1', saves: new Map([[3, info('char-1', WALL + 5)]]).values() }), 0);
  assert.equal(st.get(SPOILS_STORE_KEY), null, 'and the record clears');
  assert.equal(savedSince([info('a', 10)], 'a', 9), true); assert.equal(savedSince([info('a', 9)], 'a', 9), false); assert.equal(savedSince([info(null, 10)], null, 9), false, 'no one is no one\'s save');
  // a piece the validator refuses is not handed over; the rest are
  const bad = JSON.parse(JSON.stringify(spoilsList(42, 6)));
  bad[0].item.templateIndex = 99999;
  bad[4].gold = -5;
  st.set(SPOILS_STORE_KEY, { day: 701, at: WALL, who: 'char-1', pieces: bad });
  const got2 = [];
  assert.equal(recoverSpoils(st, (p) => got2.push(p), { who: 'char-1' }), 3, 'no template, no item; no gold below one');
  mem.set(SPOILS_STORE_KEY, '{not json');
  assert.equal(recoverSpoils(st, () => assert.fail('junk hands over nothing')), 0);
  st.set(SPOILS_STORE_KEY, { day: 700, pieces: 'no' });
  assert.equal(recoverSpoils(st, () => assert.fail()), 0);
  assert.equal(st.get(SPOILS_STORE_KEY), null, 'junk is cleared');
  assert.equal(recoverSpoils(spoilsStore({ getItem() { throw new Error('no'); } }), () => assert.fail()), 0, 'a store that throws is a record never kept');
});

test('WB5 the court\'s burst: into his fall his spoils leave his chest toward me, off the seed of the receipt the relay signed for me - once; no receipt, and after a while it is said they are not mine; the floor rides the court\'s billboards, lights and pass, and leaving the court gathers it (mutants: the spew off another seed; no burst; the gather forgotten)', async () => {
  const link = { st: GATE_STATE_EMPTY, r: null, state() { return this.st; }, receipt() { return this.r; } };
  const clock = { t: 50000 };
  const spewed = [], said = [];
  let gathered = 0;
  const fakeSpoils = { spew: (x) => spewed.push(x), frame() {}, batches: () => ['piece'], lights: () => [{ x: 0 }], drawPass: () => true, gather: () => { gathered++; } };
  const c = createGateCourt({ link, spoils: fakeSpoils, now: () => clock.t, feet: () => courtToDungeon(0, 0, 10), player: () => ({ level: 9, health: 50, maxHealth: 50 }), say: (t) => said.push(t) });
  const fell = { ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', x: 0, z: 0, fell: { at: 50000, top: ['Mac'], n: 2 } };
  link.st = fell;
  c.frame();
  assert.deepEqual(spewed, [], 'not before the burst');
  const r = await mintReceipt({ d: 700, b: 'ruhn', s: 'acct-1', c: 31337, x: 'dealt' }, null, { subtle: globalThis.crypto.subtle, nowS: 50 });
  link.r = r;
  clock.t = 50000 + SPEW_AT_MS; c.frame();
  assert.equal(spewed.length, 1);
  assert.equal(spewed[0].seed, 31337, 'the receipt\'s own seed');
  assert.equal(spewed[0].level, 9); assert.equal(spewed[0].day, 700);
  assert.ok(Math.abs(spewed[0].bearing - 0) < 1e-9, 'toward me (south of him)');
  clock.t += 1000; c.frame();
  assert.equal(spewed.length, 1, 'once');
  assert.deepEqual(c.batches().slice(-1), ['piece']); assert.ok(c.lights().some((l) => l.x === 0)); assert.equal(c.drawPass(null, null, null, 0), true);
  link.st = GATE_STATE_EMPTY; c.frame();
  assert.equal(gathered, 1, 'leaving gathers the floor');
  // no receipt
  const link2 = { st: { ...fell, day: 701 }, state() { return this.st; }, receipt: () => null };
  const said2 = [];
  const c2 = createGateCourt({ link: link2, spoils: { ...fakeSpoils, spew: () => assert.fail('no receipt, no spoils') }, now: () => clock.t, say: (t) => said2.push(t) });
  clock.t = 50000 + RECEIPT_WAIT_MS - 1; c2.frame();
  assert.deepEqual(said2, [COURT_TEXT.portal], 'nothing of the spoils yet (WBX2: the way home has risen where he fell, spoils or none)');
  clock.t = 50000 + RECEIPT_WAIT_MS; c2.frame(); c2.frame();
  assert.deepEqual(said2, [COURT_TEXT.portal, COURT_STRIKE_TEXT.noSpoils('Valkynaz Ruhn')], 'said once');
});

test('WB5 the seams, by source: the world host makes the floor on the link with the dungeon\'s own collider for its ray and the character\'s id for its record, takes a spoil through the one door (the purse, the pack), hands it to the court, and asks the crash\'s door once for each character that stands up - in the main frame, online or not, with the save slots\' word (mutants: each seam removed)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const takeSpoil = \(p\) => \{ if \(p\.kind === 'gold'\) addGoldPieces\(playerEntity, p\.gold\); else if \(p\.item\) addItem\(playerEntity\.items, p\.item\); \};/);
  assert.match(w, /const spoilsPool = gateLink \? createSpoilsPool\(\{/);
  assert.match(w, /ray: \(from, dir, len\) => \{ const c = modes\?\.dungeonCtx\?\.collider;/);
  assert.match(w, /store: _spoilsStore,\n    who: \(\) => characterIdOf\(playerEntity\),/);   // AUDIT WB A6: the one store
  assert.match(w, /link: gateLink, spoils: spoilsPool,/);
  assert.match(w, /const who = characterIdOf\(playerEntity\);\n    if \(who === _spoilsAskedFor\) return;\n    _spoilsAskedFor = who;\n    try \{ if \(recoverSpoils\(_spoilsStore, takeSpoil, \{ who, saves: enumerateSaves\(\)\.info\.values\(\) \}\)\) setMidScreenText\(SPOILS_TEXT\.gathered\); \}/);
  assert.match(w, /\n    spoilsRecoverFrame\(\);   \/\/ WB5[^\n]*\n    if \(onlineOn && playerSpawned\) \{/, 'in the main frame, ahead of the online one');
  assert.doesNotMatch(w, /_spoilsRecovered/, 'the online-only door is gone');
});
