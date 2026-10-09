// GEM1-GEM3 - GEM SOCKETS (2026-10-09; bible/06-Systems/Gem-Sockets.md; Mac: "Id like to have and show weapons with
// physical gem slots that can be slotted into, along with introducing new gem items into the world loot pool and world
// bosses").
//
// GEM1: a socket LIST (`sockets`) where LOOT20 wrote one string - a weapon holds its size's (a short blade one, a
// one-handed weapon two, a two-handed one three), the weapons' own pass gives the rest after every draw a door made, a
// gem is set in the pack for nothing but the gem, and a piece's gems of one kind read at most one Rare line (law 6).
// GEM2: the port's thirty-two graded gems (Chipped, Flawed, Flawless, Perfect of DFU's eight) - their rows, their lines,
// the world's gem find at every door the ladder rolls at, and the three world bosses' gems and sockets, each a last draw.
// GEM3: the wells on the card, the chooser, the tile's pips, the gem's "Set in...".
//
// Pinned by execution through the real doors and presses; LOOT20's own pins (test/loot20_sockets.test.js) moved with
// the list and stand beside these.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as G from '../src/systems/gems.js';
import * as RF from '../src/systems/reforge.js';
import { linesOf } from '../src/systems/lootPowers.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { mintCondition, setItemFields, templateByIndex } from '../src/systems/itemTemplates.js';
import { stacksWith, isStackable } from '../src/systems/inventory.js';
import { validLootItem } from '../src/systems/loot.js';
import { itemFindings } from '../src/systems/itemLaw.js';
import { rollCorpseKit } from '../src/systems/foeLootCap.js';
import { equipItem } from '../src/systems/equip.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';
import { rollSpoils } from '../src/systems/gateSpoils.js';
import { rollSerpentSpoils } from '../src/systems/serpentSpoils.js';
import { rollSdSpoils } from '../src/systems/sdSpoils.js';
import { socketWells, socketChooser, markSocketFrame, wellText, GEM_GRADE_COLOURS } from '../src/ui/socketWells.js';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { UNSET_ASK } from '../src/ui/reforgeWindow.js';
import { withDom } from './invdrag.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); LR._setSocketForTests(null); LR._setWeaponSocketsForTests(null); LR._setCurseForTests(Infinity); };   // the gem find as gems.js registered it at import - a test that holds it off puts it back
const off = () => { _resetForTests(); setPref('lootRarity', false); LR._setSocketForTests(null); LR._setWeaponSocketsForTests(null); LR._setCurseForTests(null); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const known = (it) => Object.assign(it, { isIdentified: true });
const weapon = (t, tier = 'rare', seed = 3) => known(LR.applyRarity(createWeapon(t, 1), tier, lcg(seed)));
const ring = (tier = 'rare') => known(LR.applyRarity(mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 }), tier, lcg(3)));
const holes = (it, n = LR.socketMax(it)) => Object.assign(it, { sockets: Array(n).fill(LR.SOCKET_EMPTY) });
const player = (items = []) => ({ isPlayer: true, items, goldPieces: 0, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], health: 100, maxHealth: 100 });
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);

test('GEM2 the find registers itself: gems.js, imported, is the door\'s last draw - a pile whose every draw lands ends in a gem', () => {
  on();
  const items = [createWeapon(122, 1)];
  LR.rollLootRarity(items, { kind: 'pile', tier: 12, boss: false, family: null }, { rolls: () => 0 });
  assert.ok(LR.gemKindOf(items.at(-1)), items.at(-1)?.name);
  off();
});

test('GEM1: a weapon holds its size\'s sockets - a short blade one, a one-handed weapon two, a two-handed one three (DFU\'s hands table, never the bow setting) - armour and a jewel one, nothing else; a Magic weapon one; the list, LOOT20\'s string still read', () => {
  on();
  const sizes = Object.fromEntries([113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 560].map((t) => [t, LR.socketMax({ group: 'Weapons', templateIndex: t })]));
  assert.deepEqual(sizes, { 113: 1, 114: 1, 115: 3, 116: 1, 117: 1, 118: 2, 119: 2, 120: 2, 121: 2, 122: 3, 123: 3, 124: 2, 125: 3, 126: 3, 127: 2, 128: 3, 129: 3, 130: 3, 131: 0, 560: 3 });
  assert.deepEqual(LR.WEAPON_SOCKETS, { short: 1, one: 2, two: 3 });
  assert.equal(LR.socketMax({ group: 'Armor', templateIndex: 102 }), 1);
  assert.equal(LR.socketMax({ group: 'Jewellery', templateIndex: 135 }), 1);
  assert.equal(LR.socketMax({ group: 'MensClothing', templateIndex: 155 }), 0, 'never a garment');
  assert.equal(LR.socketMax({ group: 'Gems', templateIndex: 0 }), 0);
  assert.deepEqual(['magic', 'rare', 'legendary', 'common', 'aetheric'].map((rarity) => LR.socketCap({ group: 'Weapons', templateIndex: 122, rarity })), [1, 3, 3, 0, 0]);
  assert.deepEqual(['magic', 'rare', 'legendary'].map((rarity) => LR.socketCap({ group: 'Armor', templateIndex: 102, rarity })), [0, 1, 1], 'a Magic piece of armour never');
  // the list, in order: set in a well, unset from the middle - the gems' lines always last, in the sockets' order
  const bow = holes(weapon(130));
  const own = bow.affixes.length;
  assert.deepEqual(LR.setGem(bow, 'flawless-ruby', 2), { id: 'elemental', param: 'fire', value: 4, gem: 'flawless-ruby' });
  LR.setGem(bow, 'chipped-emerald');
  assert.deepEqual(bow.sockets, ['chipped-emerald', LR.SOCKET_EMPTY, 'flawless-ruby']);
  assert.deepEqual(bow.affixes.slice(own).map((a) => a.gem), ['chipped-emerald', 'flawless-ruby'], 'the sockets\' order');
  assert.equal(LR.setGem(bow, 'ruby', 0), null, 'a set well takes nothing');
  assert.equal(LR.setGem(bow, 'opal', 1), null);
  assert.equal(LR.emptySockets(bow), 1);
  assert.equal(LR.socketLine(bow), 'Socket: empty');
  LR.setGem(bow, 'perfect-diamond');
  assert.equal(LR.socketLine(bow), null, 'no well empty');
  assert.equal(LR.unsetGem(bow, 1), 'perfect-diamond');
  assert.deepEqual(bow.affixes.slice(own).map((a) => a.gem), ['chipped-emerald', 'flawless-ruby']);
  assert.equal(LR.socketLine(holes(weapon(122))), 'Sockets: 3 empty');
  assert.equal(bow.socket, undefined, 'the list alone');
  // LOOT20's string is read as a list of one, and the first write makes it the list
  const old = Object.assign(ring(), { socket: LR.SOCKET_EMPTY });
  assert.deepEqual(LR.socketsOf(old), [LR.SOCKET_EMPTY]);
  assert.ok(LR.hasSocket(old));
  LR.setGem(old, 'jade');
  assert.deepEqual([old.socket, old.sockets], [undefined, ['jade']]);
  // the wire's law: never past the cap, never both shapes, the lines in the sockets' order; a Magic weapon's one
  const wire = (it) => validLootItem(JSON.parse(JSON.stringify(it)));
  assert.ok(wire(bow));
  assert.equal(wire({ ...bow, sockets: [...bow.sockets, LR.SOCKET_EMPTY] }), null, 'past its three');
  assert.equal(wire({ ...holes(weapon(120)), sockets: Array(3).fill(LR.SOCKET_EMPTY) }), null, 'a longsword\'s two');
  assert.equal(wire({ ...bow, affixes: [...bow.affixes.slice(0, own), ...bow.affixes.slice(own).reverse()] }), null, 'the gems out of order');
  assert.equal(wire({ ...bow, socket: LR.SOCKET_EMPTY }), null, 'both shapes');
  assert.ok(wire(holes(weapon(113, 'magic'), 1)), 'a Magic weapon\'s one');
  assert.equal(wire({ ...weapon(122, 'magic'), sockets: [LR.SOCKET_EMPTY, LR.SOCKET_EMPTY] }), null, 'a Magic weapon\'s two');
  assert.deepEqual(itemFindings(JSON.parse(JSON.stringify(bow))), [], 'the realm\'s law: lawful');
  assert.ok(itemFindings({ ...JSON.parse(JSON.stringify(bow)), provenance: 'p' }).includes('socket'), 'never a made piece');
  off();
});

test('GEM1 law 6: a piece\'s gems of one kind read at most one Rare line - the fold, the blow, the damage and the compare read the held sum; the card says each line\'s own number and when the cap bites; the piece\'s own lines never held', () => {
  on();
  assert.deepEqual(['elemental', 'leech', 'damage', 'stat', 'resist'].map(LR.gemPieceCap), [6, 7, 25, 10, 35]);
  const blade = holes(weapon(122));
  blade.affixes = [{ id: 'damage', value: 30 }];
  LR.setGem(blade, 'perfect-ruby'); LR.setGem(blade, 'flawless-ruby'); LR.setGem(blade, 'perfect-diamond');
  assert.deepEqual(LR.readLines(blade).map((a) => a.value), [30, 6, 0, 12], 'the second ruby has nothing left of fire\'s six');
  assert.deepEqual(blade.affixes.map((a) => a.value), [30, 6, 4, 12], 'and the piece still carries every line as set');
  assert.deepEqual(linesOf(blade, 'elemental').map((a) => [a.param, a.value]), [['fire', 6]], 'the blow (lootPowers.js)');
  assert.equal(LR.affixWeaponDamage(blade, 100), 142, 'its own 30 whole, the diamond\'s 12');
  assert.equal(LR.gemCapLine(blade), 'Gems: +6 Fire damage at most');
  assert.ok(LR.rarityLines(blade).includes('Gems: +6 Fire damage at most'));
  assert.ok(LR.rarityLines(blade).includes('Flawless Ruby: +4 Fire damage'), 'each line its own number');
  // two kinds fill side by side; a flawed and a flawless ruby are four and two - six, whole
  const two = holes(weapon(126));
  two.affixes = [];
  LR.setGem(two, 'flawless-ruby'); LR.setGem(two, 'flawed-ruby'); LR.setGem(two, 'perfect-sapphire');
  assert.deepEqual(LR.readLines(two).map((a) => a.value), [4, 2, 6]);
  assert.equal(LR.gemCapLine(two), null, 'held at nothing: no word');
  // three diamonds: twelve, twelve and one - the damage line's Rare top
  const d = holes(weapon(126));
  d.affixes = [];
  for (let i = 0; i < 3; i++) LR.setGem(d, 'perfect-diamond');
  assert.equal(LR.affixWeaponDamage(d, 100), 125);
  // the stats fold held too: two perfect malachites on a worn blade, strength ten
  const e = player();
  const m = holes(weapon(122));
  m.affixes = [];
  LR.setGem(m, 'perfect-malachite'); LR.setGem(m, 'perfect-malachite');
  e.items.push(m);
  equipItem(e, m);
  assert.equal(LR.affixFold(e).stats.strength, 10, 'eight and two');
  // the compare reads what the piece gives
  const worn = holes(weapon(122));
  worn.affixes = [];
  LR.setGem(worn, 'chipped-ruby');
  const rows = LR.lineComparison({ equip: { slots: [] }, items: [] }, blade, [worn]).rows;
  assert.ok(rows.some((r) => r.text === '+6 Fire damage' && r.delta === 5), JSON.stringify(rows));
  off();
});
test('GEM1 the weapons\' own pass: a Magic weapon a socket 120 in a thousand and never two, a Rare\'s first 250 and each more 300, a Legendary\'s 400 and 450, never past its size; after every draw the door made (the late finds\' too), a body\'s kit too; off nothing', () => {
  on();
  assert.deepEqual(LR.WEAPON_SOCKET_PER_MILLE, { magic: 120, rare: 250, legendary: 400 });
  assert.deepEqual(LR.MORE_SOCKET_PER_MILLE, { rare: 300, legendary: 450 });
  LR.registerGemFind(null);
  const n = { magic: 0, rare: 0, legendary: 0 }, any = { magic: 0, rare: 0, legendary: 0 }, three = { full: 0, of: 0 };
  let over = 0, armourMore = 0, shortMore = 0;
  const rolls = mulberry(9);
  for (let i = 0; i < 30000; i++) {
    const items = [createWeapon(113 + (i % 18), i % 6, rolls), mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0201, name: 'c', flags: 0 })];
    LR.rollLootRarity(items, { kind: 'corpse', tier: 18, boss: true, family: null }, { rolls, luck: 50 });
    for (const it of items) {
      const k = LR.socketsOf(it).length;
      if (k > LR.socketCap(it)) over++;
      if (it.group === 'Armor') { if (k > 1) armourMore++; continue; }
      if (LR.socketMax(it) === 1 && k > 1) shortMore++;
      if (n[it.rarity] == null) continue;
      n[it.rarity]++;
      if (k) any[it.rarity]++;
      if (it.rarity === 'legendary' && LR.socketMax(it) === 3) { three.of++; if (k === 3) three.full++; }
    }
  }
  assert.deepEqual([over, armourMore, shortMore], [0, 0, 0], 'never past a piece\'s size or tier');
  assert.ok(Math.abs(any.magic / n.magic - 0.12) < 0.012, `Magic: ${any.magic} of ${n.magic}`);
  assert.ok(Math.abs(any.rare / n.rare - (0.15 + 0.85 * 0.25)) < 0.02, `Rare: ${any.rare} of ${n.rare}`);
  assert.ok(Math.abs(any.legendary / n.legendary - (0.3 + 0.7 * 0.4)) < 0.05, `Legendary: ${any.legendary} of ${n.legendary}`);
  assert.ok(three.full > 0 && Math.abs(three.full / three.of - 0.58 * 0.45 * 0.45) < 0.06, `a two-handed Legendary's three: ${three.full} of ${three.of}`);
  // after every draw: the same seed with the pass at every chance and at none - every piece the same but its sockets
  const src = { kind: 'corpse', tier: 21, boss: true, family: null };
  const list = () => [createWeapon(122, 1), createWeapon(118, 1), createWeapon(113, 1), mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0201, name: 'c', flags: 0 })];
  let differed = 0;
  for (let seed = 1; seed < 80; seed++) {
    LR._setWeaponSocketsForTests({ first: 1000, more: 1000 });
    const all = list(); LR.rollLootRarity(all, src, { rolls: lcg(seed) });
    LR._setWeaponSocketsForTests({ first: 0, more: 0 });
    const none = list(); LR.rollLootRarity(none, src, { rolls: lcg(seed) });
    assert.equal(all.length, none.length, `seed ${seed}: the late finds the seed's own`);
    all.forEach((it, i) => {
      const strip = (x) => { const { sockets, ...rest } = x; return rest; };
      assert.deepEqual(strip(it), strip(none[i]), `seed ${seed}: piece ${i} the same but its sockets`);
      if (it.group === 'Weapons' && LR.socketCap(it)) { assert.equal(LR.socketsOf(it).length, LR.socketCap(it), 'every chance: its whole size'); if (LR.socketsOf(none[i]).length !== LR.socketCap(it)) differed++; }
    });
  }
  assert.ok(differed > 20, `${differed} weapons told apart`);
  // a body's kit
  LR._setWeaponSocketsForTests({ first: 1000, more: 1000 });
  let kit = 0;
  for (let seed = 1; seed < 300 && !kit; seed++) {
    const body = { mobileType: 141, level: 16, equip: null, items: [createWeapon(122, 1)] };
    for (const it of rollCorpseKit(body, { rolls: lcg(seed) })) if (it.group === 'Weapons' && LR.socketCap(it)) { assert.equal(LR.socketsOf(it).length, LR.socketCap(it)); kit++; }
  }
  assert.ok(kit, 'a body\'s own blade');
  LR._setWeaponSocketsForTests(null);
  assert.deepEqual(LR.weaponSocketPass([weapon(122)], () => 0.999), [], 'over the chance: none');
  let drawn = 0;
  LR._setWeaponSocketsForTests({ first: 0, more: 0 });
  LR.weaponSocketPass([weapon(122)], () => { drawn++; return 0; });
  assert.equal(drawn, 0, 'a chance of none costs a seed no draw');
  off();
  LR._setWeaponSocketsForTests({ first: 1000, more: 1000 });
  assert.deepEqual(LR.weaponSocketPass([weapon(122)], () => 0), [], 'off: nothing');
  LR._setWeaponSocketsForTests(null);
  LR.registerGemFind(G.rollGemFind);
});

test('GEM2 the graded gems: thirty-two rows of the port\'s own at 1900-1931, each on its kind\'s DFU art, the grade in its name, an ingredient stacking with its own row alone, lawful and on the wire, on no shelf; every gem\'s line at every grade, the plain column LOOT20\'s', () => {
  on();
  assert.deepEqual(LR.GEM_GRADES, ['chipped', 'flawed', 'plain', 'flawless', 'perfect']);
  assert.equal(LR.GEM_GRADE_TEMPLATE_BASE, 1900);
  assert.deepEqual([LR.GEM_GRADE_TEMPLATES.length, LR.GEM_GRADE_TEMPLATES[0], LR.GEM_GRADE_TEMPLATES.at(-1)], [32, 1900, 1931]);
  assert.equal(LR.ALL_GEM_IDS.length, 40);
  assert.deepEqual(GROUP_TEMPLATE_INDICES.Gems, [0, 1, 2, 3, 4, 5, 6, 7], 'no shelf draws a graded row');
  assert.deepEqual(G.GEM_GRADE_PRICE, { chipped: 0.25, flawed: 0.5, plain: 1, flawless: 2, perfect: 4 });
  for (const grade of LR.GEM_ROW_GRADES) for (const [k, kind] of LR.GEM_IDS.entries()) {
    const id = LR.gemId(kind, grade);
    const g = G.mintGem(id);
    const row = templateByIndex(g.templateIndex), dfu = templateByIndex(k);
    assert.equal(g.templateIndex, LR.GEM_GRADE_TEMPLATE_BASE + LR.GEM_ROW_GRADES.indexOf(grade) * 8 + k, id);
    assert.deepEqual([g.group, g.name, LR.gemKindOf(g), LR.gemTemplateOf(id), LR.gemKind(id), LR.gemGrade(id)], ['Gems', `${LR.GEM_GRADE_WORDS[grade]} ${dfu.name}`, id, g.templateIndex, kind, grade]);
    assert.deepEqual([row.worldTexArchive, row.worldTexRecord, row.isIngredient, row.weight], [dfu.worldTexArchive, dfu.worldTexRecord, true, dfu.weight], `${id}: its kind's art and weight`);
    assert.equal(row.basePrice, Math.max(1, Math.round(dfu.basePrice * G.GEM_GRADE_PRICE[grade])));
    assert.deepEqual(itemFindings(JSON.parse(JSON.stringify(g))), [], `${id}: lawful`);
    assert.ok(validLootItem(JSON.parse(JSON.stringify(g))), `${id}: on the wire`);
  }
  assert.equal(G.mintGem('ruby').templateIndex, 0, 'a plain gem is DFU\'s own');
  assert.equal(G.mintGem('opal'), null);
  const a = G.mintGem('flawless-ruby'), b = G.mintGem('flawless-ruby'), plain = G.mintGem('ruby');
  assert.ok(isStackable(a) && stacksWith(a, b), 'a row stacks with its own');
  assert.ok(!stacksWith(a, plain) && !stacksWith(a, G.mintGem('perfect-ruby')), 'never a Ruby of another grade');
  assert.deepEqual(JSON.parse(JSON.stringify(LR.GEM_GRADE_LINES)), {
    ruby: { weapon: { id: 'elemental', param: 'fire', values: [1, 2, 3, 4, 6] }, other: { id: 'resist', param: 'fire', values: [4, 7, 10, 15, 20] } },
    emerald: { weapon: { id: 'leech', param: null, values: [1, 2, 3, 5, 7] }, other: { id: 'resist', param: 'poison', values: [4, 7, 10, 15, 20] } },
    sapphire: { weapon: { id: 'elemental', param: 'frost', values: [1, 2, 3, 4, 6] }, other: { id: 'resist', param: 'frost', values: [4, 7, 10, 15, 20] } },
    diamond: { weapon: { id: 'damage', param: null, values: [2, 4, 6, 9, 12] }, other: { id: 'resist', param: 'magic', values: [4, 7, 10, 15, 20] } },
    jade: { weapon: { id: 'stat', param: 'willpower', values: [1, 2, 4, 6, 8] }, other: { id: 'stat', param: 'willpower', values: [1, 2, 4, 6, 8] } },
    turquoise: { weapon: { id: 'stat', param: 'agility', values: [1, 2, 4, 6, 8] }, other: { id: 'stat', param: 'personality', values: [1, 2, 4, 6, 8] } },
    malachite: { weapon: { id: 'stat', param: 'strength', values: [1, 2, 4, 6, 8] }, other: { id: 'stat', param: 'endurance', values: [1, 2, 4, 6, 8] } },
    amber: { weapon: { id: 'stat', param: 'speed', values: [1, 2, 4, 6, 8] }, other: { id: 'stat', param: 'luck', values: [1, 2, 3, 4, 6] } },
  });
  for (const kind of LR.GEM_IDS) {
    assert.deepEqual(LR.gemLine(weapon(120), kind), { ...LR.GEM_LINES[kind].weapon, gem: kind }, `${kind}: the plain grade is LOOT20's`);
    for (const id of LR.ALL_GEM_IDS.filter((x) => LR.gemKind(x) === kind)) {
      const w = LR.gemLine(weapon(120), id);
      assert.ok(LR.validAffix(w) && LR.validAffix(LR.gemLine(ring(), id)), id);
      assert.ok(w.value <= LR.gemPieceCap(w.id), `${id}: never past its kind's Rare top`);
    }
  }
  assert.deepEqual(LR.gemLine(ring(), 'perfect-emerald'), { id: 'resist', param: 'poison', value: 20, gem: 'perfect-emerald' });
  assert.deepEqual(LR.gemLine(weapon(120), 'chipped-diamond'), { id: 'damage', value: 2, gem: 'chipped-diamond' });
  assert.equal(LR.GEM_NAMES['perfect-amber'], 'Perfect Amber');
  off();
});

test('GEM2 the world\'s gem find: 30 in a thousand and 5 a tier to 150, a pile 1.3 times and a boss 2.5, luck the ladder\'s own; the grade the source\'s band, a boss four tiers deeper; at every door, its very last draw; off nothing', () => {
  on();
  assert.deepEqual(G.GEM_FIND, { base: 30, perTier: 5, cap: 150 });
  assert.deepEqual([0, 10, 19, 30].map((tier) => G.gemFindChance({ tier })), [30, 80, 125, 150]);
  assert.deepEqual([G.gemFindChance({ tier: 10, kind: 'pile' }), G.gemFindChance({ tier: 4, boss: true }), G.gemFindChance({ tier: 10, luck: 100 }), G.gemFindChance({ tier: 10, luck: 0 })], [104, 125, 120, 40]);
  assert.deepEqual(JSON.parse(JSON.stringify(G.GEM_GRADE_BANDS)), [
    { tier: 0, weights: [70, 30, 0, 0, 0] }, { tier: 5, weights: [30, 50, 20, 0, 0] }, { tier: 10, weights: [0, 30, 45, 25, 0] },
    { tier: 15, weights: [0, 0, 35, 50, 15] }, { tier: 20, weights: [0, 0, 0, 60, 40] },
  ]);
  assert.equal(G.GEM_BOSS_TIERS, 4);
  assert.deepEqual([0, 4, 5, 14, 15, 20].map((tier) => G.gemGradeBand({ tier }).tier), [0, 0, 5, 10, 15, 20]);
  assert.equal(G.gemGradeBand({ tier: 11, boss: true }).tier, 15, 'a boss four tiers deeper');
  // the grades by band, over 4,000 gems each
  const count = (source) => {
    const c = Object.fromEntries(LR.GEM_GRADES.map((g) => [g, 0])), kinds = new Set();
    const rolls = mulberry(5);
    for (let i = 0; i < 4000; i++) { const g = G.rollGem(source, rolls); c[LR.gemGrade(LR.gemKindOf(g))]++; kinds.add(LR.gemKind(LR.gemKindOf(g))); }
    return { c, kinds: kinds.size };
  };
  const low = count({ tier: 2 }), mid = count({ tier: 12 }), top = count({ tier: 21, boss: true });
  assert.deepEqual([low.c.plain, low.c.flawless, low.c.perfect], [0, 0, 0], 'a shallow source: chipped and flawed alone');
  assert.ok(Math.abs(low.c.chipped / 4000 - 0.7) < 0.03);
  assert.deepEqual([mid.c.chipped, mid.c.perfect], [0, 0]);
  assert.deepEqual([top.c.chipped, top.c.flawed, top.c.plain], [0, 0, 0], 'the deepest: flawless and perfect');
  assert.ok(Math.abs(top.c.perfect / 4000 - 0.4) < 0.03, `${top.c.perfect}`);
  assert.deepEqual([low.kinds, top.kinds], [8, 8], 'every kind');
  // at the door: the find its very last draw - nothing after it - and the weapons' pass before it: at every chance, each
  // socket the pass gives is one draw more before the find
  const src = { kind: 'pile', tier: 18, boss: false, family: null };
  const door = (seed, t) => {
    const base = lcg(seed);
    let n = 0, at = -1;
    LR._setWeaponSocketsForTests(t);
    LR.registerGemFind((s, rolls) => { at = n; return G.rollGemFind(s, rolls); });
    const items = [createWeapon(122, 1)];
    LR.rollLootRarity(items, src, { rolls: () => { n++; return base(); } });
    LR._setWeaponSocketsForTests(null);
    return { n, at, items };
  };
  let found = 0, passed = 0;
  for (let seed = 1; seed < 200; seed++) {
    const { n, at, items } = door(seed, null);
    assert.ok(n - at === 1 || n - at === 3, `seed ${seed}: the find's own one draw, or three when it lands - nothing after (${n - at})`);
    if (items.some((it) => LR.gemKindOf(it))) { found++; assert.ok(LR.gemKindOf(items.at(-1)), 'and its gem last on the list'); }
    const hi = door(seed, { first: 1000, more: 1000 }), lo = door(seed, { first: 0, more: 0 });
    const holesIn = (list) => list.reduce((k, it) => k + LR.socketsOf(it).length, 0);   // a unique find laddered beside the blade takes its own
    const gave = holesIn(hi.items) - holesIn(lo.items);
    assert.equal(hi.at - lo.at, gave, `seed ${seed}: the pass's draws before the find`);
    if (gave) passed++;
  }
  assert.ok(passed > 20, `${passed} weapons socketed before the find`);
  assert.ok(found > 10, `${found} gems found over 199 piles`);
  LR.registerGemFind(G.rollGemFind);
  assert.deepEqual(G.rollGemFind({ tier: 10 }, () => 0.999), [], 'over the chance: none, and one draw');
  off();
  assert.equal(G.gemFindChance({ tier: 21, boss: true }), 0);
  const offList = [createWeapon(122, 1)];
  LR.rollLootRarity(offList, src, { rolls: () => 0 });
  assert.equal(offList.length, 1, 'off: DFU\'s list');
});

test('GEM2 the world bosses: the Warden one gem, the Old Coil one to a ship that dealt, the Brass Remnant two - each Flawless or Perfect, known; their pieces socketed by both passes; every spoils before them the seed\'s own; the same seed the same spoils', () => {
  on();
  assert.deepEqual(G.BOSS_GEMS, { gate: 1, serpent: 1, abyss: 2 });
  assert.deepEqual(G.BOSS_GEM_SOURCE, { tier: 21, boss: true });
  let socketed = 0, many = 0, aethericSocketed = 0;
  const grades = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const k = (seed * 2654435761) >>> 0;
    const g = rollSpoils(k, 12), s = rollSerpentSpoils(k, 12, 'dealt'), st = rollSerpentSpoils(k, 12, 'stood'), a = rollSdSpoils(k, 12);
    assert.deepEqual([g.gems.length, s.gems.length, st.gems.length, a.gems.length], [1, 1, 0, 2]);
    for (const gem of [...g.gems, ...s.gems, ...a.gems]) grades.add(LR.gemGrade(LR.gemKindOf(gem)));
    for (const p of [...g.pieces, ...s.pieces, ...a.pieces]) {
      const n = LR.socketsOf(p.item).length;
      if (p.tier === 'aetheric' || p.tier === 'gilded') { if (n) aethericSocketed++; continue; }
      if (n) socketed++;
      if (n > 1) many++;
      assert.ok(n <= LR.socketCap(p.item));
    }
    assert.deepEqual(JSON.parse(JSON.stringify(rollSpoils(k, 12))), JSON.parse(JSON.stringify(g)), 'the seed\'s own');
  }
  assert.deepEqual([...grades].sort(), ['flawless', 'perfect'], 'a boss\'s grade');
  assert.ok(socketed > 60 && many > 5, `${socketed} socketed, ${many} with more than one`);
  assert.equal(aethericSocketed, 0, 'never an Aetheric or a Gilded piece');
  // every spoils before them the seed's own: the passes at no chance take no draw - the pieces, the gold and the card
  // the same but the sockets
  for (let seed = 1; seed <= 60; seed++) {
    const k = (seed * 40503) >>> 0;
    LR._setSocketForTests(0); LR._setWeaponSocketsForTests({ first: 0, more: 0 });
    const bare = rollSpoils(k, 9);
    LR._setSocketForTests(null); LR._setWeaponSocketsForTests(null);
    const full = rollSpoils(k, 9);
    const strip = (h) => JSON.parse(JSON.stringify({ gold: h.gold, card: h.card, pieces: h.pieces.map((p) => { const { sockets, ...rest } = p.item; return { ...p, item: rest }; }) }));
    assert.deepEqual(strip(full), strip(bare), `seed ${k}`);
  }
  assert.match(read('src/systems/gateSpoils.js'), /const card = bossCardRoll\('gate', rolls\);\s*(\/\/[^\n]*\n\s*)*socketPass\(pieces\.map\(\(p\) => p\.item\), rolls\);\s*weaponSocketPass\(pieces\.map\(\(p\) => p\.item\), rolls\);\s*const gems = bossGems\('gate', rolls\);\s*return \{ gold, pieces, sigil: sigilStone\(\), card, gems \};/);
  assert.match(read('src/systems/serpentSpoils.js'), /const card = dealt \? bossCardRoll\('serpent', rolls\) : null;\s*(\/\/[^\n]*\n\s*)*socketPass\(pieces\.map\(\(p\) => p\.item\), rolls\);\s*weaponSocketPass\(pieces\.map\(\(p\) => p\.item\), rolls\);\s*const gems = dealt \? bossGems\('serpent', rolls\) : \[\];/);
  assert.match(read('src/systems/sdSpoils.js'), /const card = bossCardRoll\('abyss', rolls\);\s*(\/\/[^\n]*\n\s*)*socketPass\(pieces\.map\(\(p\) => p\.item\), rolls\);\s*weaponSocketPass\(pieces\.map\(\(p\) => p\.item\), rolls\);\s*const gems = bossGems\('abyss', rolls\);/);
  // the hosts carry the rows: the world tick, every host's shared module and the headless law import them
  for (const [f, re] of [['src/systems/worldTick.js', /^import '\.\/gems\.js';/m], ['src/scenes/shared.js', /import '\.\.\/systems\/gems\.js';/], ['src/systems/itemLaw.js', /^import '\.\/gems\.js';/m]]) assert.match(read(f), re, f);
  off();
});

test('GEM3 the wells, the chooser and the pips - and in the pack: an empty well opens the gems the pack holds and sets one in it, a set well asks first and shatters; a loose gem\'s "Set in..."; nothing drawn for a piece without a socket or with the ladder off', () => {
  on();
  withDom((dom) => {
    const bow = holes(weapon(130));
    LR.setGem(bow, 'perfect-ruby', 1);
    const calls = [];
    const wells = socketWells(bow, { picture: () => null, onWell: (at, v) => calls.push([at, v]), asking: 1, open: 0 });
    const ws = kids(wells, 'sock-well');
    assert.deepEqual(ws.map((w) => [w.className, w.dataset.socket, w.dataset.gem ?? null, w.dataset.gemGrade ?? null]), [
      ['sock-well empty press', '0', null, null], ['sock-well set press', '1', 'perfect-ruby', 'perfect'], ['sock-well empty press', '2', null, null]]);
    assert.equal(ws[1].getAttribute('title'), 'Perfect Ruby: +6 Fire damage - press again to shatter it');
    assert.equal(ws[0].getAttribute('title'), 'Empty socket');
    assert.ok('asking' in ws[1].dataset && 'open' in ws[0].dataset && !('open' in ws[2].dataset));
    ws[2].onclick({ stopPropagation() {} });
    assert.deepEqual(calls, [[2, LR.SOCKET_EMPTY]]);
    assert.equal(wellText(bow, 'chipped-amber'), 'Chipped Amber: +1 Speed');
    const still = kids(socketWells(bow), 'sock-well');
    assert.ok(still.length === 3 && still.every((w) => !w.onclick && !w.className.includes('press')), 'with no hand, wells to look at');
    assert.equal(socketWells(weapon(120)), null, 'no socket, no wells');
    const picks = [];
    const ch = socketChooser(bow, [{ id: 'ruby', count: 2 }, { id: 'flawless-diamond', count: 1 }], (id) => picks.push(id));
    const bs = kids(ch, 'sock-pick');
    assert.deepEqual(bs.map((b) => textOf(b)), ['Ruby (2)+3 Fire damage', 'Flawless Diamond+9% damage']);
    bs[1].onclick({ stopPropagation() {} });
    assert.deepEqual(picks, ['flawless-diamond']);
    assert.ok(socketChooser(bow, [], () => {}).className.includes('sock-none'));
    const tile = markSocketFrame(dom.mk('div'), bow);
    assert.equal(tile.dataset.sockets, '3');
    assert.deepEqual(kids(tile, 'sock-pips')[0].children.map((i) => i.className || ''), ['', 'set', '']);
    assert.equal(markSocketFrame(dom.mk('div'), G.mintGem('flawed-jade')).dataset.gemGrade, 'flawed');
    assert.equal(markSocketFrame(dom.mk('div'), weapon(120)).dataset.sockets, undefined);
    assert.deepEqual(Object.keys(GEM_GRADE_COLOURS), LR.GEM_GRADES);
  });
  // the pack: the bow's card, its wells pressed
  globalThis.location = { search: '?skin=enhanced' };
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const bow = holes(weapon(130));
    bow.name = 'Socket Bow';
    const ruby = Object.assign(G.mintGem('flawless-ruby'), { stackCount: 2 });
    const e = { ...player([bow, ruby]), name: 'Aelwyn', career: { name: 'Spellsword' } };
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    try {
      const rowOf = (name) => host.querySelectorAll('.itemrow').find((r) => !r.closest('.loot-win') && textOf(r).includes(name)) ?? null;
      const page = (word) => host.querySelectorAll('.packtab').find((t) => textOf(t).toLowerCase().includes(word)).onclick();
      page('magic');   // a Rare's flavour enchantment puts it on the Magic page
      const wellsNow = () => host.querySelectorAll('.sock-well').filter((w) => w.closest('.packdetail') && w.onclick);
      assert.ok(rowOf('Socket Bow').querySelectorAll('.sock-pips').length === 1, 'the tile\'s pips');
      rowOf('Socket Bow').onclick({ timeStamp: 1e9, detail: 1 });
      assert.equal(wellsNow().length, 3, 'the card\'s three wells, pressable');
      wellsNow()[0].onclick({ stopPropagation() {} });
      const pick = host.querySelectorAll('.sock-pick');
      assert.deepEqual(pick.map((b) => b.dataset.gem), ['flawless-ruby'], 'the gems the pack holds');
      pick[0].onclick({ stopPropagation() {} });
      assert.deepEqual(bow.sockets, ['flawless-ruby', LR.SOCKET_EMPTY, LR.SOCKET_EMPTY]);
      assert.equal(ruby.stackCount, 1, 'one from the stack');
      const said = () => JSON.parse(globalThis.__pack()).notice;
      assert.ok(said().startsWith('Set: the Flawless Ruby in'), said());
      wellsNow()[0].onclick({ stopPropagation() {} });
      assert.deepEqual([bow.sockets[0], said()], ['flawless-ruby', UNSET_ASK('flawless-ruby')], 'asked first');
      wellsNow()[0].onclick({ stopPropagation() {} });
      assert.deepEqual(bow.sockets, Array(3).fill(LR.SOCKET_EMPTY), 'shattered');
      assert.ok(said().startsWith('The Flawless Ruby in') && said().endsWith('shatters; the socket is empty.'), said());
      assert.equal(ruby.stackCount, 1, 'the gem gone, not back');
      // a loose gem's "Set in..."
      page('valuables');
      rowOf('Flawless Ruby').onclick({ timeStamp: 2e9, detail: 1 });
      const act = (label) => host.querySelectorAll('.act').find((b) => b.closest('.acts') && b.textContent === label) ?? null;
      act('Set in...').onclick();
      const home = host.querySelectorAll('.act').find((b) => b.closest('.acts') && b.className.includes('gem-home'));
      assert.ok(home && home.textContent.startsWith('Set in ') && home.textContent.includes('Socket Bow'), home?.textContent);
      home.onclick();
      assert.deepEqual(bow.sockets, ['flawless-ruby', LR.SOCKET_EMPTY, LR.SOCKET_EMPTY]);
      assert.ok(!e.items.includes(ruby), 'the last of the stack went in');
    } finally { view.unmount(); }
  });
  delete globalThis.location;
  assert.match(read('src/ui/enhancedInventory.js'), /markSocketFrame\(node, item\);/);
  assert.match(read('src/ui/enhancedInventory.js'), /const w = socketBlock\(picked, side === 'local' && body, ready\);/);
  off();
  withDom(() => assert.equal(socketWells(holes(weapon(130))), null, 'off: nothing drawn'));
});
