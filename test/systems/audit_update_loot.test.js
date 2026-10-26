// AUDIT UPDATE (2026-10-25, bible/01-Overview/audits/Audit-Update-2026-10-25.md): LOOT-GATE's findings, lane L - the
// roll's own level (L1, L4), the Imbue's piece at its new tier's law (L2), the Item Maker's rows (L3), a counter's price
// for an imbued piece (L5), the drought (L6), one reading of a level (L9). The room's base at the room's level is pinned
// by test/systems/partyloot.test.js (each peer's own level registered, an elite among the layout's bodies).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerRollerLevel, withRollerLevel, rollerLevel, droughtHeld, gateLevel } from '../../src/systems/loot/lootLevelGate.js';
import { applyRarity, addTechniqueLine, rarityEligible, rarityChances, pileSource, rollCorpseLoot, LOOT_RARITY_KEY } from '../../src/systems/loot/lootRarity.js';
import { techniquesFor, TECHNIQUE_BANDS } from '../../src/combat/technique/techniqueRoster.js';
import { itemFindings } from '../../src/systems/item/itemLaw.js';   // registers the item law the Imbue's guard reads (loot.js setItemLaw)
import { setItemLaw, createRandomWeapon } from '../../src/systems/loot/loot.js';
import { worthCeiling } from '../../src/systems/item/itemLaw.js';
import { imbuePiece, imbueTarget } from '../../src/systems/reforge.js';
import { welkyndShards } from '../../src/systems/gate/gateSpoils.js';
import { counterValueOf } from '../../src/systems/tradeModes.js';
import { noteTaken, droughtOf, _setDroughtForTests } from '../../src/systems/loot/lootDrought.js';
import { sigilFloor } from '../../src/systems/sigil/sigil.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';

setPref(LOOT_RARITY_KEY, true);
registerRollerLevel(null);

const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const purse = () => ({ level: 3, items: [welkyndShards(500)], goldPieces: 10_000_000 });
/** A found Magic weapon, as a source door mints one (createRandomWeapon, then the ladder's own applyRarity). */
function foundMagic(r, { technique = false } = {}) {
  for (let i = 0; i < 500; i++) {
    const w = createRandomWeapon(8, r);
    if (!w || !rarityEligible(w) || (technique && !techniquesFor(w).length)) continue;
    applyRarity(w, 'magic', r);
    w.isIdentified = true;
    return w;
  }
  throw new Error('no weapon');
}

test('AUDIT UPDATE L1: withRollerLevel - a scope\'s level beats the registered player\'s, nests, puts the outer back, and a scope of no level rolls ungated (mutants: the scope unread; the outer lost)', () => {
  registerRollerLevel(() => 30);
  try {
    assert.equal(rollerLevel(), 30);
    assert.equal(withRollerLevel(3, () => rollerLevel()), 3, 'the room\'s level, never this client\'s player');
    assert.deepEqual(withRollerLevel(3, () => [withRollerLevel(12, () => rollerLevel()), rollerLevel()]), [12, 3]);
    assert.equal(withRollerLevel(null, () => rollerLevel()), null, 'a scope that names no level: no gate, the registry unread');
    assert.equal(rollerLevel(), 30, 'and the registry stands again after it');
    assert.throws(() => withRollerLevel(5, () => { throw new Error('x'); }));
    assert.equal(rollerLevel(), 30, 'a throw puts it back too');
  } finally { registerRollerLevel(null); }
});

test('AUDIT UPDATE L4: the corpse door names its roller\'s level - with no registry (a scene\'s first foes, before any host frame) a level-1 roller\'s body still rolls gated (mutants: the level unpassed; the door unwired)', () => {
  const src = readFileSync('src/scenes/hostCombat.js', 'utf8');
  assert.match(src, /rollCorpseLoot\(entity, basics, \{ rolls, luck, find, qualityMult: lootQualityMult, weights: plain\?\.plainLadder \? plainFoeRarityWeights\(ease\) : null, level: effectiveLevel\(player\) \}\);/);
  // the same bodies on the same dice, the level handed in and not: a level 1 meets far fewer Rares (x0.15 - LOOT-GATE)
  const top = (level) => {
    let n = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const r = lcg(seed);
      const w = createRandomWeapon(12, r);
      if (!w || !rarityEligible(w)) continue;
      const body = { level: 12, mobileType: 7, items: [w] };
      rollCorpseLoot(body, ENEMY_BASICS[7], { rolls: r, ...(level ? { level } : {}) });
      if (w.rarity === 'rare' || w.rarity === 'legendary') n++;
    }
    return n;
  };
  const open = top(null), gated = top(1);
  assert.ok(open >= 20, `Rares or better, ungated: ${open}`);
  assert.ok(gated * 3 < open, `gated at level 1: ${gated} of ${open}`);
});

test('AUDIT UPDATE L2: a found Magic piece imbued Rare stands at the Rare\'s law - its technique rolled again in the Rare\'s band, its sigil at the Rare\'s floor - and a piece the law would hold is never made (mutants: the technique kept at its Magic value; the sigil left; the guard unread)', () => {
  let n = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const r = lcg(seed);
    const w = foundMagic(r, { technique: true });
    const line = addTechniqueLine(w, r);
    if (!line || itemFindings(w).length) continue;
    const p = purse(); p.items.push(w);
    assert.equal(imbuePiece(w, p, r).ok, true);
    n++;
    assert.deepEqual(itemFindings(w), [], `seed ${seed}: the judge holds no imbued piece`);
    const t = w.affixes.filter((a) => a.id === 'technique');
    assert.equal(t.length, 1, 'its technique kept, once');
    assert.equal(t[0].param, line.param, 'the same technique');
    assert.ok(t[0].value >= TECHNIQUE_BANDS.rare[0] && t[0].value <= TECHNIQUE_BANDS.rare[1], `in the Rare's band: ${t[0].value}`);
  }
  assert.ok(n >= 40, `pieces imbued: ${n}`);
  for (const power of [2, 3]) {
    const r = lcg(1000 + power);
    const w = foundMagic(r);
    w.sigil = { power, party: 1, xp: 0 };
    assert.deepEqual(itemFindings(w), []);
    const p = purse(); p.items.push(w);
    assert.equal(imbuePiece(w, p, r).ok, true);
    assert.equal(w.sigil.power, sigilFloor('rare', 1), 'raised to the Rare\'s floor');
    assert.deepEqual(itemFindings(w), []);
  }
  // the guard: a law that holds what the Imbue made - the piece put back exactly and nothing paid
  const r = lcg(77);
  const w = foundMagic(r);
  const before = structuredClone(w);
  const p = purse(); p.items.push(w);
  const gold = p.goldPieces, shards = JSON.stringify(p.items[0]);
  setItemLaw((it) => (it.imbued ? ['held'] : []), worthCeiling);
  try {
    assert.deepEqual(imbuePiece(w, p, r), { ok: false, reason: 'not' });
  } finally { setItemLaw(itemFindings, worthCeiling); }
  assert.deepEqual(w, before, 'put back as it was');
  assert.equal(p.goldPieces, gold); assert.equal(JSON.stringify(p.items[0]), shards, 'and nothing paid');
});

test('AUDIT UPDATE L3: a found Magic piece the Item Maker enchanted is not the Imbue\'s - the Rare\'s flavour would write over its rows; a cursed one still is, for its refusal (mutants: the maker\'s rows unread; the curse\'s drawback read as one)', () => {
  const w = foundMagic(lcg(5));
  assert.equal(imbueTarget(w), 'rare');
  const made = { ...w, enchantments: [{ type: 11, param: -1, enchantCost: 100, parentEnchantment: 0 }] };
  assert.equal(imbueTarget(made), null);
  const drawback = { type: 30, param: 2 };
  const cursed = { ...w, cursed: { ...drawback }, enchantments: [{ ...drawback }] };
  assert.equal(imbueTarget(cursed), 'rare', 'its drawback is no maker\'s row - the page lists it and says Cursed');
});

test('AUDIT UPDATE L5: an imbued piece sells at a counter for what it sold at before - plain for a plain made Magic, the found Magic\'s price for one made Rare (mutants: the Imbue\'s worth unrecorded; the whole roll taken off)', () => {
  let n = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const r = lcg(seed);
    const w = foundMagic(r);
    const was = counterValueOf(w);
    const p = purse(); p.items.push(w);
    if (!imbuePiece(w, p, r).ok) continue;
    n++;
    assert.equal(w.rarity, 'rare');
    assert.equal(counterValueOf(w), was, `seed ${seed}: the Magic's price`);
  }
  assert.ok(n >= 30, `pieces imbued: ${n}`);
  for (let i = 0; i < 20; i++) {
    const w = createRandomWeapon(5, lcg(500 + i));
    if (!w || !rarityEligible(w)) continue;
    const was = counterValueOf(w);
    const p = purse(); p.items.push(w);
    assert.equal(imbuePiece(w, p, lcg(i)).ok, true);
    assert.equal(w.rarity, 'magic');
    assert.equal(counterValueOf(w), was, 'a plain piece made Magic sells as the plain piece');
  }
});

test('AUDIT UPDATE L6: under level 10 the drought does not count a piece - but a Legendary taken still empties it (mutants: the Legendary held too; the hold lifted)', () => {
  registerRollerLevel(() => 6);
  try {
    _setDroughtForTests(240);
    assert.equal(noteTaken({ rarity: 'rare', untaken: true, templateIndex: 0, group: 'Weapons' }), false, 'a Rare under 10 counts nothing');
    assert.equal(droughtOf(), 240);
    assert.equal(noteTaken({ rarity: 'legendary', untaken: true, templateIndex: 0, group: 'Weapons' }), true);
    assert.equal(droughtOf(), 0, 'a Legendary empties it at any level');
  } finally { registerRollerLevel(null); _setDroughtForTests(0); }
});

test('AUDIT UPDATE L9: one reading of a level - a number\'s string gates as its number, an empty one or nonsense as none (mutants: a string unread; an empty string held)', () => {
  const crypt = pileSource(9);
  assert.deepEqual(rarityChances({ ...crypt, rollerLevel: '3' }), rarityChances({ ...crypt, rollerLevel: 3 }));
  assert.deepEqual(rarityChances({ ...crypt, rollerLevel: '' }), rarityChances(crypt));
  assert.deepEqual([gateLevel('7'), gateLevel(''), gateLevel('x'), gateLevel(0), gateLevel(-2), gateLevel(null)], [7, null, null, null, null, null]);
  assert.equal(droughtHeld(''), false);
  assert.equal(droughtHeld('5'), true);
});
