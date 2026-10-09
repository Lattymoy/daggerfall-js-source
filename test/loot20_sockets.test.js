// LOOT20 - SOCKETS (2026-10-07; bible/06-Systems/Loot-II-Arc.md section 12; Mac: "what could we do to make it even more
// amazing, while also balancing everyrhing?", then "Lets go all in").
//
// A Rare (150 in a thousand) or a Legendary (300) that a body or a pile mints may carry one empty SOCKET - on a weapon, a
// piece of armour or a jewel, never a garment. At the Reforge one of DFU's eight gems from the pack is set in it for 100
// gold; unset, the gem shatters. A set gem gives one line by the piece's kind - a weapon's blow, every other piece's
// wearer - of a kind the port already reads, so every reader reads it: the fold, a weapon's procs and damage, LOOT12's
// cap, the card. No roll made it: it has no band, is never reforged or honed, never names the piece and never spoils a
// Perfect.
//
// Pinned by execution: the gems and their lines; setting and unsetting in place; the gem's line through its readers;
// what it never is; the door's pass (its rates over 40,000 seeded bodies, never a garment, after every draw, a kit too,
// off nothing); the Reforge's presses and their refusals; the wire; the Sockets page and the hosts' hooks.
//
// GEM1 (bible/06-Systems/Gem-Sockets.md, PINS MOVED): the socket is a LIST now (`sockets`, LOOT20's `socket` still
// read), setting is free and works on a worn piece (its wearer folded again), and the Reforge EXTRACTS a gem whole for
// gold by its grade. The weapons' own pass and the graded gems are test/gem1_sockets.test.js's.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import { linesOf } from '../src/systems/lootPowers.js';
import * as RF from '../src/systems/reforge.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { mintCondition, setItemFields, templateByIndex } from '../src/systems/itemTemplates.js';
import { equipItem } from '../src/systems/equip.js';
import { computeEntityMods } from '../src/systems/entityMods.js';
import { validLootItem } from '../src/systems/loot.js';
import { rollCorpseKit } from '../src/systems/foeLootCap.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';
import { mountReforgeWindow, SOCKETS_NONE, GEMS_NONE, GEM_SET, UNSET_ASK, GEM_SHATTERED } from '../src/ui/reforgeWindow.js';
import { withDom } from './invdrag.mjs';
import { rollGemFind } from '../src/systems/gems.js';   // GEM2: the gem find, held off and put back

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); LR._setSocketForTests(null); LR._setCurseForTests(Infinity); };
const off = () => { _resetForTests(); setPref('lootRarity', false); LR._setSocketForTests(null); LR._setCurseForTests(null); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const known = (it) => Object.assign(it, { isIdentified: true });
const sword = () => createWeapon(120, 1);
const ring = () => mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 });
const gem = (id, n = 1) => Object.assign(mintCondition(setItemFields({ group: 'Gems', templateIndex: LR.GEM_IDS.indexOf(id) })), n > 1 ? { stackCount: n } : {});
const socketed = (make, tier = 'rare', seed = 3) => { const it = known(LR.applyRarity(make(), tier, lcg(seed))); it.sockets = [LR.SOCKET_EMPTY]; return it; };   // GEM1: the list the passes mint
const player = (items = []) => ({ isPlayer: true, items, goldPieces: 0, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], health: 100, maxHealth: 100 });
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;

test('LOOT20: DFU\'s eight gems and their lines - a weapon\'s blow, every other piece\'s wearer, each a line the port already reads; set and unset in place', () => {
  on();
  assert.deepEqual(GROUP_TEMPLATE_INDICES.Gems, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(LR.GEM_IDS.map((g, i) => [LR.GEM_NAMES[g], templateByIndex(i).name]), LR.GEM_IDS.map((g, i) => [templateByIndex(i).name, templateByIndex(i).name]), 'the templates\' own order and names');
  assert.deepEqual(LR.SOCKET_PER_MILLE, { rare: 150, legendary: 300 });
  assert.deepEqual(LR.SOCKET_GROUPS, ['Weapons', 'Armor', 'Jewellery'], 'never a garment - the wardrobe keeps the fight off the clothes');
  const want = {
    ruby: [['elemental', 'fire', 3], ['resist', 'fire', 10]], sapphire: [['elemental', 'frost', 3], ['resist', 'frost', 10]],
    emerald: [['leech', undefined, 3], ['resist', 'poison', 10]], diamond: [['damage', undefined, 6], ['resist', 'magic', 10]],
    amber: [['stat', 'speed', 4], ['stat', 'luck', 3]], jade: [['stat', 'willpower', 4], ['stat', 'willpower', 4]],
    turquoise: [['stat', 'agility', 4], ['stat', 'personality', 4]], malachite: [['stat', 'strength', 4], ['stat', 'endurance', 4]],
  };
  for (const g of LR.GEM_IDS) {
    const w = LR.gemLine(sword(), g), o = LR.gemLine(ring(), g);
    assert.deepEqual([[w.id, w.param, w.value], [o.id, o.param, o.value]], want[g], g);
    assert.ok(LR.validAffix(w) && LR.validAffix(o) && w.gem === g && o.gem === g);
    assert.equal(LR.gemKindOf(gem(g)), g);
  }
  assert.equal(LR.gemKindOf(sword()), null);
  assert.equal(LR.gemLine(sword(), 'opal'), null);
  // set, in place: the line after the piece's own, the socket named, the price by its worth
  const it = socketed(ring);
  const before = { lines: it.affixes.length, value: it.value, name: it.name };
  const line = LR.setGem(it, 'ruby');
  assert.deepEqual(line, { id: 'resist', param: 'fire', value: 10, gem: 'ruby' });
  assert.deepEqual(it.affixes.at(-1), line);
  assert.equal(it.affixes.length, before.lines + 1);
  assert.deepEqual([it.sockets, LR.socketGem(it), LR.hasSocket(it)], [['ruby'], 'ruby', true]);
  assert.equal(it.value, before.value + LR.affixesWorth([line], it));
  assert.equal(it.name, before.name, 'never names the piece');
  assert.equal(LR.setGem(it, 'jade'), null, 'one gem at a time');
  assert.equal(LR.unsetGem(it), 'ruby');
  assert.deepEqual([it.sockets, it.affixes.length, it.value], [[LR.SOCKET_EMPTY], before.lines, before.value], 'unset: as it was, the gem gone');
  assert.equal(LR.unsetGem(it), null);
  assert.equal(LR.setGem(known(LR.applyRarity(ring(), 'rare', lcg(3))), 'ruby'), null, 'no socket, no gem');
  assert.equal(LR.setGem(it, 'opal'), null);
});

test('LOOT20: a set gem\'s line through every reader - the fold, LOOT12\'s cap, a weapon\'s procs and damage, the card - and never a roll\'s: no band, never reforged or honed, never spoiling a Perfect or the Exalted\'s own line', () => {
  on();
  const e = player();
  const r1 = socketed(ring, 'rare', 4);
  r1.affixes = [{ id: 'resist', param: 'fire', value: 35 }, { id: 'stat', param: 'strength', value: 6 }];
  LR.setGem(r1, 'ruby');
  e.items.push(r1); equipItem(e, r1); computeEntityMods(e);
  assert.equal(e._mods.resist.fire, LR.RESIST_CAP, '35 and the ruby\'s 10: to the cap - a socket counts toward it');
  assert.deepEqual(LR.rolledResistOf(e, 'fire'), { worn: 45, counts: 45 });
  const r2 = socketed(ring, 'rare', 5);
  r2.affixes = [{ id: 'stat', param: 'agility', value: 6 }];
  LR.setGem(r2, 'jade');
  e.items.push(r2); equipItem(e, r2); computeEntityMods(e);
  assert.equal(e._mods.stats.willpower, 4, 'a jewel\'s jade: Willpower to its wearer');
  // a weapon's: its procs and its damage
  const blade = socketed(sword, 'rare', 6);
  LR.setGem(blade, 'ruby');
  assert.deepEqual(linesOf(blade, 'elemental').map((a) => [a.param, a.value]), [['fire', 3]], 'the ruby\'s fire on a blow (lootPowers.js)');
  const plain = socketed(sword, 'rare', 7);
  plain.affixes = [{ id: 'stat', param: 'strength', value: 6 }];
  const withDiamond = JSON.parse(JSON.stringify(plain));
  LR.setGem(withDiamond, 'diamond');
  assert.equal(LR.affixWeaponDamage(withDiamond, 100), 106);
  assert.equal(LR.affixWeaponDamage(plain, 100), 100);
  const leech = JSON.parse(JSON.stringify(plain));
  LR.setGem(leech, 'emerald');
  assert.deepEqual(linesOf(leech, 'leech').map((a) => a.value), [3]);
  // the card
  const at = r1.affixes.length - 1;
  assert.equal(LR.affixLine(r1, at), 'Ruby: +10% Fire resistance');
  assert.equal(LR.affixBand(r1, at), null, 'no band');
  assert.ok(LR.rarityLines(r1).includes('Ruby: +10% Fire resistance'));
  const empty = socketed(ring, 'rare', 8);
  assert.ok(LR.rarityLines(empty).includes('Socket: empty'));
  assert.ok(!LR.rarityLines(r1).includes('Socket: empty'));
  // never a roll's
  assert.ok(!LR.reforgeableLines(r1).includes(at), 'never reforged');
  assert.ok(!LR.honeableLines(r1).includes(at), 'never honed');
  const perfect = socketed(ring, 'rare', 9);
  perfect.affixes.forEach((a, i) => { a.value = LR.affixBand(perfect, i)[1]; });
  assert.ok(LR.isPerfect(perfect));
  LR.setGem(perfect, 'amber');
  assert.ok(LR.isPerfect(perfect), 'a gem never spoils a Perfect');
  assert.equal(LR.tierLabel(perfect), 'Perfect Rare');
  const ex = LR.applyRarity(sword(), 'legendary', lcg(3));
  LR.exaltLegendary(ex, lcg(4));
  const own = ex.affixes.length - 1;
  ex.sockets = [LR.SOCKET_EMPTY];
  LR.setGem(ex, 'sapphire');
  assert.deepEqual(LR.reforgeableLines(ex), [own], 'the Exalted\'s own line, never the gem\'s after it');
  assert.deepEqual(LR.affixBand(ex, own), LR.AFFIX_RANGES[ex.affixes[own].id].legendary);
  assert.equal(LR.affixBand(ex, own + 1), null);
});

test('LOOT20: the door\'s pass - a Rare 150 in a thousand, a Legendary 300, never a garment; after every draw the door made; a body\'s kit too; off nothing', () => {
  on();
  LR._setWeaponSocketsForTests({ first: 0, more: 0 });   // GEM1: the weapons' own pass held off - LOOT20's alone is measured here
  LR.registerGemFind(null);   // GEM2: and the gem find, the door's last draw since, which a socket's draw moves
  const n = { rare: 0, legendary: 0 }, s = { rare: 0, legendary: 0 };
  let garments = 0, others = 0;
  const rolls = mulberry(20);
  for (let i = 0; i < 40000; i++) {
    const items = [createWeapon(113 + (i % 18), i % 6, rolls), mintCondition({ group: 'MensClothing', templateIndex: 155, name: 'c', flags: 0, variant: 0 })];
    LR.rollLootRarity(items, { kind: 'corpse', tier: 18, boss: true, family: null }, { rolls, luck: 50 });
    for (const it of items) {
      if (LR.isGarment(it)) { if (LR.hasSocket(it)) garments++; continue; }
      if (n[it.rarity] != null) { n[it.rarity]++; if (LR.socketsOf(it).join() === LR.SOCKET_EMPTY) s[it.rarity]++; } else if (LR.hasSocket(it)) others++;
    }
  }
  assert.ok(Math.abs(s.rare / n.rare - 0.15) < 0.015, `Rare: ${s.rare} of ${n.rare}`);
  assert.ok(Math.abs(s.legendary / n.legendary - 0.3) < 0.04, `Legendary: ${s.legendary} of ${n.legendary}`);
  assert.deepEqual([garments, others], [0, 0], 'never a garment, a Magic or a plain piece');
  // after every draw: the same seed with a socket on every piece and on none - the rest the same
  const src = { kind: 'pile', tier: 14, boss: false, family: null };
  const list = () => [sword(), mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0201, name: 'c', flags: 0 }), ring()];
  let compared = 0;
  for (let seed = 1; seed < 60; seed++) {
    LR._setSocketForTests(1000);
    const all = list(); LR.rollLootRarity(all, src, { rolls: lcg(seed) });
    LR._setSocketForTests(0);
    const none = list(); LR.rollLootRarity(none, src, { rolls: lcg(seed) });
    all.forEach((it, i) => {
      const { sockets, ...rest } = it;
      assert.deepEqual(rest, none[i], `seed ${seed}: piece ${i} the same but its socket`);
      if (it.rarity === 'rare' || it.rarity === 'legendary') { assert.deepEqual(sockets, [LR.SOCKET_EMPTY]); compared++; } else assert.equal(sockets, undefined);
    });
  }
  assert.ok(compared > 10);
  // a body's kit
  LR._setSocketForTests(1000);
  let kit = 0;
  let kitGarments = 0;
  for (let seed = 1; seed < 300 && !(kit && kitGarments); seed++) {
    const body = { mobileType: 141, level: 16, equip: null, items: [sword(), mintCondition({ group: 'MensClothing', templateIndex: 165, name: 'Shirt', flags: 0, variant: 0 })] };
    for (const it of rollCorpseKit(body, { rolls: lcg(seed) })) {
      if (LR.isGarment(it)) { assert.equal(LR.hasSocket(it), false, 'a kit\'s garment: never'); kitGarments++; continue; }
      if (it.rarity === 'rare' || it.rarity === 'legendary') { assert.deepEqual(it.sockets, [LR.SOCKET_EMPTY]); kit++; }
    }
  }
  assert.ok(kit, 'a body\'s own piece');
  assert.ok(kitGarments, 'and its garments laddered beside it, none socketed');
  assert.deepEqual(LR.socketPass([known(LR.applyRarity(mintCondition({ group: 'WomensClothing', templateIndex: 195, name: 'Gown', flags: 0, variant: 0 }), 'rare', lcg(2)))], () => 0), [], 'nor any garment the pass is handed');
  LR._setSocketForTests(null);
  assert.deepEqual(LR.socketPass([known(LR.applyRarity(sword(), 'rare', lcg(2)))], () => 0.999).length, 0, 'over the chance: none');
  off();
  LR._setSocketForTests(1000);
  assert.deepEqual(LR.socketPass([known(LR.applyRarity(sword(), 'rare', lcg(2)))], () => 0), [], 'off: nothing');
  LR._setSocketForTests(null);
  LR._setWeaponSocketsForTests(null);
  LR.registerGemFind(rollGemFind);
});

test('LOOT20: the Reforge\'s presses - a gem from the pack, every refusal taking nothing; unset free and the gem shattered; GEM1: setting free, a worn piece filled where it is worn, the extraction paid by the grade; the wire takes a socket only as made', () => {
  on();
  const piece = socketed(ring, 'rare', 11);
  const locked = Object.assign(gem('ruby'), { locked: true });
  const me = player([piece, gem('sapphire', 2), locked]);
  me.goldPieces = 150;
  const held = (items) => { const h = RF.gemsHeld(items); return Object.fromEntries(LR.ALL_GEM_IDS.filter((g) => h[g]).map((g) => [g, h[g]])); };
  assert.deepEqual(Object.keys(RF.gemsHeld([])), [...LR.ALL_GEM_IDS], 'every gem, every grade (GEM2)');
  assert.deepEqual(held(me.items), { sapphire: 2 }, 'a locked gem is kept');
  assert.equal(RF.setGemRefusal(piece, 'ruby', me), 'nogem');
  assert.equal(RF.setGemRefusal(piece, 'sapphire', me), null);
  assert.equal(RF.setGemRefusal(known(LR.applyRarity(ring(), 'rare', lcg(3))), 'sapphire', me), 'not');
  piece.isIdentified = false;
  assert.equal(RF.setGemRefusal(piece, 'sapphire', me), 'unknown');
  known(piece);
  assert.equal(RF.setGemRefusal(piece, 'sapphire', { ...me, goldPieces: 0 }), null, 'GEM1 (PIN MOVED): setting is free - the gem is the price');
  const done = RF.setGemPiece(piece, 'sapphire', me);
  assert.equal(done.ok, true);
  assert.deepEqual(done.line, { id: 'resist', param: 'frost', value: 10, gem: 'sapphire' });
  assert.deepEqual([held(me.items), me.goldPieces], [{ sapphire: 1 }, 150], 'one gem from the stack, no gold');
  assert.equal(RF.setGemRefusal(piece, 'sapphire', me), 'set');
  assert.deepEqual(RF.setGemPiece(piece, 'sapphire', me), { ok: false, reason: 'set' });
  assert.deepEqual([held(me.items), me.goldPieces], [{ sapphire: 1 }, 150], 'nothing taken');
  // GEM1 (PIN MOVED): a worn piece is filled where it is worn, and its wearer folded again at once
  const worn = player();
  const wp = socketed(ring, 'rare', 12);
  wp.affixes = [{ id: 'stat', param: 'agility', value: 6 }];
  worn.items.push(wp, gem('jade')); equipItem(worn, wp); computeEntityMods(worn);
  assert.equal(worn._mods.stats.willpower ?? 0, 0);
  assert.equal(RF.setGemRefusal(wp, 'jade', worn), null);
  assert.equal(RF.setGemPiece(wp, 'jade', worn).ok, true);
  assert.equal(worn._mods.stats.willpower, 4, 'the jade\'s Willpower on its wearer with no fold of the test\'s own');
  assert.equal(RF.unsetGemRefusal(wp), null);
  assert.equal(RF.unsetGemPiece(wp, worn).ok, true);
  assert.equal(worn._mods.stats.willpower ?? 0, 0, 'and off again');
  // unset: free, the gem shattered
  assert.equal(RF.unsetGemRefusal(socketed(ring, 'rare', 13)), 'empty');
  const gone = RF.unsetGemPiece(piece, me);
  assert.deepEqual(gone, { ok: true, gem: 'sapphire' });
  assert.deepEqual([piece.sockets, held(me.items), me.goldPieces], [[LR.SOCKET_EMPTY], { sapphire: 1 }, 150], 'no gem comes back, nothing paid');
  assert.deepEqual(RF.unsetGemPiece(piece, { items: [] }), { ok: false, reason: 'gone' });
  // GEM1: the extraction - the gem whole into the pack, its grade's price; short of it, nothing taken
  assert.deepEqual(RF.EXTRACT_PRICE, { chipped: 50, flawed: 100, plain: 200, flawless: 400, perfect: 800 });
  RF.setGemPiece(piece, 'sapphire', me);
  assert.equal(RF.extractPrice(piece), 200);
  assert.equal(RF.extractGemRefusal(piece, me), 'gold');
  assert.deepEqual(RF.extractGemPiece(piece, me), { ok: false, reason: 'gold' });
  assert.deepEqual([piece.sockets, held(me.items), me.goldPieces], [['sapphire'], {}, 150], 'refused: nothing moved');
  me.goldPieces = 250;
  assert.deepEqual(RF.extractGemPiece(piece, me), { ok: true, gem: 'sapphire', price: 200 });
  assert.deepEqual([piece.sockets, held(me.items), me.goldPieces], [[LR.SOCKET_EMPTY], { sapphire: 1 }, 50], 'whole again, the gold paid');
  assert.equal(RF.extractGemRefusal(piece, me), 'empty');
  assert.ok(RF.takeGem([gem('amber', 3)], 'amber'));
  const stack = [gem('amber', 3)];
  RF.takeGem(stack, 'amber');
  assert.equal(stack[0].stackCount, 2, 'a stack shrinks');
  off();
  assert.equal(RF.setGemRefusal(piece, 'sapphire', me), 'off');
  assert.equal(RF.extractGemRefusal(piece, me), 'off');
  on();
  // the wire
  const set = socketed(ring, 'rare', 14);
  LR.setGem(set, 'ruby');
  const wire = (it) => validLootItem(JSON.parse(JSON.stringify(it)));
  assert.ok(wire(set) && wire(socketed(ring, 'rare', 15)));
  assert.equal(wire({ ...set, sockets: [LR.SOCKET_EMPTY] }), null, 'an empty socket with a gem\'s line');
  assert.equal(wire({ ...set, sockets: ['jade'] }), null, 'a gem\'s line of another gem');
  assert.equal(wire({ ...set, affixes: set.affixes.map((a) => (a.gem ? { ...a, gem: 'sapphire' } : a)) }), null, 'its line marked with another gem');
  assert.equal(wire({ ...set, affixes: set.affixes.map((a) => (a.gem ? { ...a, value: 40 } : a)) }), null, 'a forged value');
  assert.equal(wire({ ...set, sockets: undefined }), null, 'a gem\'s line with no socket');
  assert.equal(wire({ ...socketed(ring, 'rare', 16), sockets: ['opal'] }), null);
  assert.equal(wire({ ...known(LR.applyRarity(ring(), 'magic', lcg(2))), sockets: [LR.SOCKET_EMPTY] }), null, 'never a Magic jewel');
  assert.equal(wire({ ...known(LR.applyRarity(mintCondition({ group: 'MensClothing', templateIndex: 155, name: 'c', flags: 0, variant: 0 }), 'rare', lcg(2))), sockets: [LR.SOCKET_EMPTY] }), null, 'never a garment');
  // GEM1: LOOT20's string, as a save or a room's memory carries it, is read - and never beside a list
  const old = { ...JSON.parse(JSON.stringify(set)), sockets: undefined, socket: 'ruby' };
  assert.ok(wire(old), 'the string a piece was saved with');
  assert.deepEqual(LR.socketsOf(old), ['ruby']);
  assert.equal(wire({ ...old, sockets: ['ruby'] }), null, 'both: a forgery');
});

test('LOOT20: the Sockets page - a row a socketed piece; an empty one offers each gem the pack holds and sets it; a set one unsets, asked first, the gem shattered; the host hands the law', () => {
  on();
  withDom((dom) => {
    const piece = socketed(sword, 'rare', 21);
    const plain = known(LR.applyRarity(sword(), 'rare', lcg(22)));
    const me = player([piece, plain, gem('ruby'), gem('diamond')]);
    me.goldPieces = 500;
    const calls = [];
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, {
      page: 'sockets', items: () => me.items, payer: () => me, gold: () => me.goldPieces, picture: () => null, nameOf: (it) => it.name,
      reforge: () => ({ ok: false }), salvage: () => ({ ok: false }),
      setGem: (it, g) => { calls.push(['set', g]); return RF.setGemPiece(it, g, me); },
      unsetGem: (it, at) => { calls.push(['unset']); return RF.unsetGemPiece(it, me, at); },
    });
    try {
      const shell = one(host, 'reforge-shell');
      assert.equal(kids(shell, 'socket-row').length, 1, 'the socketed piece alone');
      const choices = () => kids(one(shell, 'socket-card'), 'socket-choice');
      assert.deepEqual(choices().map((c) => c.dataset.gem), ['ruby', 'diamond'], 'the gems the pack holds');
      assert.ok(textOf(choices()[1]).includes('+6% damage'), 'a weapon\'s diamond');
      one(choices()[1], 'set-press').onclick({ stopPropagation() {} });
      assert.deepEqual(calls, [['set', 'diamond']]);
      assert.equal(one(shell, 'broker-note').textContent, GEM_SET(piece.name, 'diamond'));
      const unset = () => one(one(shell, 'socket-card'), 'unset-press');
      assert.equal(unset().textContent, 'Unset');
      unset().onclick({ stopPropagation() {} });
      assert.equal(one(shell, 'broker-note').textContent, UNSET_ASK('diamond'), 'asked first');
      assert.equal(unset().textContent, 'Shatter it');
      unset().onclick({ stopPropagation() {} });
      assert.deepEqual(calls.at(-1), ['unset']);
      assert.equal(one(shell, 'broker-note').textContent, GEM_SHATTERED(piece.name, 'diamond'));
      assert.deepEqual(choices().map((c) => c.dataset.gem), ['ruby'], 'empty again - the diamond gone for good');
      me.items = [piece];
      view.repaint();
      assert.ok(textOf(one(shell, 'socket-card')).includes(GEMS_NONE));
      me.items = [plain];
      view.repaint();
      assert.ok(kids(shell, 'codex-head').some((h) => h.textContent === SOCKETS_NONE));
    } finally { view.unmount(); }
  });
  assert.match(read('src/scenes/worldModes.js'), /setGem: \(item, gem\) => setGemPiece\(item, gem, playerEntity\),[^\n]*\n\s+unsetGem: \(item, at\) => unsetGemPiece\(item, playerEntity, at\),[^\n]*\n\s+extractGem: \(item, at\) => extractGemPiece\(item, playerEntity, at\),/, 'the guild\'s window on the player\'s own pack (GEM1: a socket of several, and the extraction)');
});
