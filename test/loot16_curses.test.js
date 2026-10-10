// LOOT16 - CURSED FINDS, AND THE TEMPLE'S LIFTING (2026-10-07; bible/06-Systems/Loot-II-Arc.md section 8; Mac: "what
// could we do to make it even more amazing, while also balancing everyrhing?", then "Lets go all in").
//
// One Rare or Legendary in twelve that a body or a pile mints is cursed in the door's last pass: a line more - a number
// kind its group may carry and it does not, from the top half of its tier's band - and ONE drawback from DFU's own
// catalogue that the port reads live, beside its flavour or its record's enchantment. Known, its tier reads "Cursed
// Rare" and the drawback is named; worn unknowing, it bites unsaid (DFU's IsIdentified gates the words, never the
// payloads). A temple's Cure Disease priest lifts it for a quarter of the piece's price, at least 300 - the drawback
// gone, the line kept: the find's reward, paid for.
//
// Pinned by execution: the law of a curse (the line, the drawback, the table and its groups, never a dead row, never
// one that undoes the piece's own good, never on an Exalted or a Magic, never twice, the name and the price); the doors
// (one in twelve over 30,000 seeded bodies, after every draw the door made, a body's kit too, off nothing); each
// drawback through DFU's own payload walk, unknown and worn; the card; the lifting's law and the wire; the temple's row
// on either skin, its host hook and its page.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import { LIFT_FLOOR, LIFT_SHARE, liftPrice, liftRefusal, liftCurse, cursedKnown } from '../src/systems/lootCurse.js';
import { ENCHANTMENT_TYPES } from '../src/formats/magicDef.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { equipItem } from '../src/systems/equip.js';
import { validLootItem } from '../src/systems/loot.js';
import { rollCorpseKit } from '../src/systems/foeLootCap.js';
import { PAYLOAD, doItemEnchantmentPayloads, enchantmentMagicRound, computeEnchantmentMods, mobileAffinityMatches } from '../src/systems/enchantments.js';
import { GuildServiceWindow, REFORGE_RECT, LIFT_ROW, LIFT_KEY, PANEL_X, PANEL_Y, _setGuildServiceArtForTests } from '../src/ui/guildServiceWindow.js';
import { mountReforgeWindow, LIFT_TITLE, LIFT_NONE, LIFTED, REFORGE_GUILD_PAGES } from '../src/ui/reforgeWindow.js';
import { withDom } from './invdrag.mjs';
import { rollGemFind } from '../src/systems/gems.js';   // GEM2: the gem find, held off and put back

const T = ENCHANTMENT_TYPES;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); LR._setCurseForTests(null); LR._setExaltedForTests(null); };
const off = () => { _resetForTests(); setPref('lootRarity', false); LR._setCurseForTests(null); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
/** A generator with no pattern between draws - for a rate over many seeds (the LCG's draws lean on each other). */
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const garment = (templateIndex) => mintCondition({ group: templateIndex >= 182 ? 'WomensClothing' : 'MensClothing', templateIndex, name: 'garment', flags: 0, variant: 0 });
const amulet = () => mintCondition({ group: 'Jewellery', templateIndex: 133, name: 'Amulet', flags: 0 });
const cuirass = () => mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0201, name: 'Cuirass', flags: 0 });
const known = (it) => Object.assign(it, { isIdentified: true });
const player = () => ({ isPlayer: true, items: [], goldPieces: 0, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], reactionMods: new Array(11).fill(0), health: 100, maxHealth: 100 });
/** A Rare of `make`'s base cursed with a drawback of `type` (and `param`, when named) - the real mint's, by seed. */
function cursedWith(make, type, param = null, tier = 'rare') {
  for (let seed = 1; seed < 4000; seed++) {
    const it = LR.applyRarity(make(), tier, lcg(seed));
    if (!LR.cursePiece(it, lcg(seed * 31 + 7))) continue;
    if (it.cursed.type === type && (param == null || it.cursed.param === param)) return it;
  }
  throw new Error(`no seed cursed with ${type}:${param}`);
}
const kinds = (it) => new Set(it.affixes.map((a) => a.id));

test('LOOT16: a curse - a line more from the top half of its band, of a kind its group carries and the piece does not; one drawback of the live table and of its group, beside its enchantment; the name kept, the line\'s worth on its price', () => {
  on();
  // the table: six live rows, never a dead one (law 8)
  assert.deepEqual(LR.CURSE_DRAWBACKS.map((r) => r.type), [T.BadRepWith, T.BadReactionsFrom, T.ItemDeteriorates, T.UserTakesDamage, T.LowDamageVs, T.HealthLeech]);
  for (const dead of [T.ExtraWeight, T.WeakensArmor, T.VisionProblems, T.WalkingProblems]) assert.ok(!LR.CURSE_DRAWBACKS.some((r) => r.type === dead));
  assert.equal(LR.CURSE_IN, 12);
  const params = (type, item) => LR.curseParams(LR.CURSE_DRAWBACKS.find((r) => r.type === type), item);
  assert.deepEqual(params(T.BadRepWith, amulet()), [0, 1, 2, 3, 4], 'a social group - never All');
  assert.deepEqual(params(T.ItemDeteriorates, garment(155)), [2], 'cloth: in holy places alone');
  assert.deepEqual(params(T.ItemDeteriorates, cuirass()), [1, 2], 'armour: in the sun too');
  assert.deepEqual(params(T.ItemDeteriorates, createWeapon(120, 1)), [1, 2], 'a weapon: in the sun too');
  assert.deepEqual(params(T.UserTakesDamage, amulet()), [1], 'in holy places - never the sun');
  assert.deepEqual(params(T.HealthLeech, createWeapon(120, 1)), [1], 'unless used daily');
  for (const item of [garment(155), amulet(), cuirass()]) {
    assert.deepEqual([params(T.LowDamageVs, item), params(T.HealthLeech, item)], [[], []], `a ${item.group} strikes nothing`);
  }
  // never a drawback that undoes the piece's own good: Good Rep With the group or every group, Potent Vs the kind
  assert.deepEqual(params(T.BadRepWith, { ...amulet(), enchantments: [{ type: T.GoodRepWith, param: 3 }] }), [0, 1, 2, 4]);
  assert.deepEqual(params(T.BadRepWith, { ...amulet(), enchantments: [{ type: T.GoodRepWith, param: 5 }] }), []);
  assert.deepEqual(params(T.LowDamageVs, { ...createWeapon(120, 1), enchantments: [{ type: T.PotentVs, param: 0 }] }), [1, 2, 3]);
  // the mint, over many seeds and every group
  const makes = [['rare', () => createWeapon(120, 1)], ['rare', cuirass], ['rare', amulet], ['rare', () => garment(155)], ['rare', () => garment(195)],
    ['legendary', () => createWeapon(120, 1)], ['legendary', () => garment(163)]];
  const seenTypes = new Set();
  for (let seed = 1; seed < 160; seed++) {
    for (const [tier, make] of makes) {
      const it = LR.applyRarity(make(), tier, lcg(seed));
      const before = { name: it.name, value: it.value, ench: it.enchantments.map((e) => ({ ...e })), kinds: kinds(it), n: it.affixes.length, lines: it.affixes.map((a) => ({ ...a })) };
      assert.equal(LR.cursePiece(it, lcg(seed * 7 + 3)), true, `${it.group} ${tier} seed ${seed}`);
      assert.equal(it.affixes.length, before.n + 1);
      const line = it.affixes[before.n];
      const k = LR.AFFIX_KINDS[line.id];
      assert.ok(k.groups.includes(it.group) && !k.proc, `${line.id}: a number its group carries`);
      const numbers = LR.AFFIX_IDS.filter((id) => LR.AFFIX_KINDS[id].groups.includes(it.group) && !LR.AFFIX_KINDS[id].proc);
      if (numbers.some((id) => !before.kinds.has(id))) assert.ok(!before.kinds.has(line.id), `${line.id}: a kind the piece did not carry`);
      else assert.ok(k.params && !before.lines.some((a) => a.id === line.id && a.param === line.param), `every kind carried (${numbers.join(', ')}): ${line.id} with a param its lines leave free`);
      const [lo, hi] = LR.AFFIX_RANGES[line.id][tier];
      assert.ok(line.value >= Math.ceil((lo + hi) / 2) && line.value <= hi, `${line.id} ${line.value}: the top half of [${lo}-${hi}]`);
      assert.ok(LR.validAffix(line));
      assert.equal(it.name, before.name, 'never renamed');
      assert.equal(it.value, before.value + LR.affixesWorth([line], it), 'the line\'s worth; the drawback\'s nothing');
      assert.deepEqual(it.enchantments.slice(0, -1), before.ench, 'its own enchantment kept');
      assert.deepEqual(it.enchantments.at(-1), it.cursed, 'the drawback beside it');
      assert.ok(params(it.cursed.type, { ...it, enchantments: before.ench }).includes(it.cursed.param), 'a drawback its group takes');
      assert.ok(LR.validCurse(it) && LR.isCursed(it));
      assert.equal(LR.cursePiece(it, lcg(1)), false, 'never twice');
      seenTypes.add(it.cursed.type);
    }
  }
  assert.equal(seenTypes.size, 6, 'every row drawn');
  // never a Magic, an Exalted, nor a piece of no tier
  const magic = LR.applyRarity(createWeapon(120, 1), 'magic', lcg(2));
  assert.equal(LR.cursePiece(magic, lcg(2)), false);
  const ex = LR.applyRarity(createWeapon(120, 1), 'legendary', lcg(2));
  LR.exaltLegendary(ex, lcg(3));
  assert.equal(LR.cursePiece(ex, lcg(2)), false, 'an Exalted\'s extra line is its own find');
  assert.equal(LR.cursePiece(createWeapon(120, 1), lcg(2)), false);
  assert.equal(LR.cursePiece(null), false);
});

test('LOOT16: the doors - one Rare or Legendary in twelve a body or a pile mints, after every draw the door made; a body\'s kit too; never an Exalted; off nothing', () => {
  on();
  // the rate, over 30,000 seeded bodies through the real door
  let laddered = 0, cursed = 0, magicCursed = 0;
  const rolls = mulberry(16);
  for (let n = 0; n < 30000; n++) {
    const items = [createWeapon(113 + (n % 18), n % 6, rolls), garment(155)];
    LR.rollLootRarity(items, { kind: 'corpse', tier: 18, boss: true, family: null }, { rolls, luck: 50 });
    for (const it of items) {
      if (it.rarity === 'rare' || it.rarity === 'legendary') { laddered++; if (LR.isCursed(it)) cursed++; } else if (LR.isCursed(it)) magicCursed++;
    }
  }
  const rate = cursed / laddered;
  assert.ok(laddered > 10000 && Math.abs(rate - 1 / 12) < 0.01, `one in twelve: ${cursed} of ${laddered} (${(rate * 12).toFixed(3)} x)`);
  assert.equal(magicCursed, 0, 'never a Magic or a plain piece');
  // after every draw the door made: the same seed with every piece cursed and with none - the pieces' own draws the same
  const src = { kind: 'pile', tier: 14, boss: false, family: null };
  const list = () => [createWeapon(120, 1), cuirass(), amulet(), garment(155), garment(195)];
  let both = 0;
  LR.registerGemFind(null);   // PIN MOVED (GEM2, bible/06-Systems/Gem-Sockets.md): the gem find is the door's last draw since - a curse's draw moves it, and its gem is no piece of the list
  try {
    for (let seed = 1; seed < 80; seed++) {
      LR._setCurseForTests(1);
      const all = list(); LR.rollLootRarity(all, src, { rolls: lcg(seed) });
      LR._setCurseForTests(Infinity);
      const none = list(); LR.rollLootRarity(none, src, { rolls: lcg(seed) });
      LR._setCurseForTests(null);
      // PIN MOVED (TECH1, bible/05-Combat/Weapon-Techniques.md): a weapon's technique is the door's very last draw, after the
      // curse's - where a curse drew, the two runs' techniques differ, so it is set aside on both sides
      const own = (x) => (x.affixes ?? []).filter((a) => !LR.isTechniqueAffix(a));
      all.forEach((it, i) => {
        const twin = none[i];
        assert.deepEqual([it.rarity, it.name, it.legendary], [twin.rarity, twin.name, twin.legendary], `seed ${seed}: piece ${i}'s tier and name`);
        assert.ok(!LR.isCursed(twin));
        if (it.rarity === 'rare' || it.rarity === 'legendary') {
          if (it.exalted) { assert.ok(!LR.isCursed(it)); return; }
          both++;
          assert.ok(LR.isCursed(it), `seed ${seed}: piece ${i} cursed`);
          assert.deepEqual(own(it).slice(0, -1), own(twin), 'its own lines its seed\'s');
        } else assert.deepEqual(own(it), own(twin));
      });
    }
    assert.ok(both > 20, `${both} Rares and Legendaries compared`);
  } finally {
    LR.registerGemFind(rollGemFind);
  }
  // never an Exalted: every Legendary exalted in the last pass, every one passed by
  LR._setExaltedForTests(1000);
  LR._setCurseForTests(1);
  const legs = [createWeapon(120, 1)];
  LR.rollLootRarity(legs, { kind: 'corpse', tier: 21, boss: true, family: null }, { rolls: () => 0 });
  assert.equal(legs[0].rarity, 'legendary');
  assert.deepEqual([legs[0].exalted, LR.isCursed(legs[0])], [true, false]);
  LR._setExaltedForTests(null);
  // a body's kit: its own Rares and Legendaries, cursed by the same pass
  let kitCursed = 0;
  for (let seed = 1; seed < 400 && !kitCursed; seed++) {
    const body = { mobileType: 141, level: 16, equip: null, items: [createWeapon(120, 1), cuirass()] };
    const out = rollCorpseKit(body, { rolls: lcg(seed) });
    for (const it of out) if (it.rarity === 'rare' || it.rarity === 'legendary') { assert.ok(LR.isCursed(it)); kitCursed++; }
    for (const it of body.items) if (it.rarity === 'magic') assert.ok(!LR.isCursed(it));
  }
  assert.ok(kitCursed, 'a body\'s kit can come off it cursed');
  // the pass alone answers the pieces it cursed, and nothing with the switch off
  const two = [LR.applyRarity(createWeapon(120, 1), 'rare', lcg(4)), LR.applyRarity(createWeapon(120, 1), 'magic', lcg(4))];
  assert.deepEqual(LR.cursePass(two, lcg(9)), [two[0]]);
  LR._setCurseForTests(null);
  // the pass draws for a piece it may curse alone - a Magic, an Exalted, a plain piece and a cursed one cost a seeded
  // stream nothing, so what its door's caller draws next (a kit's sigils, a hold's) moves only for a Rare or a Legendary
  let drawn = 0;
  const counting = () => { drawn++; return 0.99; };
  const ex = LR.applyRarity(createWeapon(120, 1), 'legendary', lcg(2));
  LR.exaltLegendary(ex, lcg(3));
  const already = LR.applyRarity(createWeapon(120, 1), 'rare', lcg(5));
  LR.cursePiece(already, lcg(6));
  LR.cursePass([LR.applyRarity(createWeapon(120, 1), 'magic', lcg(4)), LR.applyRarity(createWeapon(120, 1), 'rare', lcg(4)), ex, createWeapon(120, 1), already], counting);
  assert.equal(drawn, 1, 'one draw: the Rare\'s');
  off();
  LR._setCurseForTests(1);
  const plain = [LR.applyRarity(createWeapon(120, 1), 'rare', lcg(4))];
  assert.deepEqual(LR.cursePass(plain, () => 0), [], 'off: nothing');
  assert.ok(!LR.isCursed(plain[0]));
  LR._setCurseForTests(null);
});

test('LOOT16: each drawback bites through DFU\'s own payload walk - worn unknowing as known; the card says it once it is known, and a Legendary\'s curse line its band', () => {
  on();
  // Bad Rep With: the magic round's -10 with its group, unknown
  const badRep = cursedWith(amulet, T.BadRepWith);
  assert.notEqual(badRep.isIdentified, true, 'unknown');
  const p1 = player();
  p1.items.push(badRep); equipItem(p1, badRep);
  enchantmentMagicRound(p1, 1);
  assert.equal(p1.reactionMods[badRep.cursed.param], -10, 'the group thinks the less of you, unsaid');
  // Bad Reactions From: the constant's -5 to hit with its kind near
  const badReact = cursedWith(amulet, T.BadReactionsFrom, 0);   // humanoids
  const p2 = player();
  p2.items.push(badReact); equipItem(p2, badReact);
  assert.equal(computeEnchantmentMods(p2, { nearbyFoes: () => [{ mobileType: 141 }] }).chanceToHitMod, -5);
  assert.equal(computeEnchantmentMods(p2, { nearbyFoes: () => [] }).chanceToHitMod, 0);
  // User Takes Damage: in a holy place, a point every fourth round
  const hurtful = cursedWith(amulet, T.UserTakesDamage);
  const p3 = player();
  p3.items.push(hurtful); equipItem(p3, hurtful);
  let hurt = 0;
  enchantmentMagicRound(p3, 4, { ctx: { inHolyPlace: () => true, inSunlight: () => false, hurtSelf: (n) => { hurt += n; } } });
  enchantmentMagicRound(p3, 8, { ctx: { inHolyPlace: () => false, inSunlight: () => true, hurtSelf: (n) => { hurt += n; } } });
  assert.equal(hurt, 1, 'in the temple, never in the sun');
  // Item Deteriorates: the piece's condition, in a holy place
  const rotting = cursedWith(garment.bind(null, 155), T.ItemDeteriorates);
  const p4 = player();
  p4.items.push(rotting); equipItem(p4, rotting);
  const was = rotting.currentCondition;
  enchantmentMagicRound(p4, 4, { ctx: { inHolyPlace: () => true, inSunlight: () => false } });
  assert.equal(rotting.currentCondition, was - 1);
  // Low Damage Vs: five off a blow on its kind
  const blunt = cursedWith(() => createWeapon(120, 1), T.LowDamageVs, 2);   // humanoids
  assert.ok(mobileAffinityMatches(141, 2) && !mobileAffinityMatches(0, 2));
  assert.equal(doItemEnchantmentPayloads(PAYLOAD.Strikes, blunt, { entity: player(), target: { mobileType: 141 }, damage: 20 }), 15);
  assert.equal(doItemEnchantmentPayloads(PAYLOAD.Strikes, blunt, { entity: player(), target: { mobileType: 0 }, damage: 20 }), 20);
  // Health Leech: unless used daily, a point every fourth round once a day has gone by
  const leech = cursedWith(() => createWeapon(120, 1), T.HealthLeech);
  const p5 = player();
  p5.items.push(leech); equipItem(p5, leech);
  leech.timeHealthLeechLastUsed = 0;
  let bled = 0;
  enchantmentMagicRound(p5, 4, { nowMinutes: 3 * 1440, ctx: { hurtSelf: (n) => { bled += n; } } });
  assert.equal(bled, 1);
  // the card: unknown, the tier alone; known, "Cursed Rare" and the drawback named
  const r = cursedWith(amulet, T.BadRepWith, 3);
  assert.deepEqual(LR.rarityLines(r), ['Rare', 'Unidentified'], 'unknown: nothing said');
  assert.equal(LR.tierLabel(r), 'Rare');
  known(r);
  assert.equal(LR.tierLabel(r), 'Cursed Rare');
  assert.equal(LR.curseLine(r), 'Bad Rep With: Nobility');
  assert.ok(LR.rarityLines(r).includes('Bad Rep With: Nobility'));
  assert.equal(LR.rarityLines(r)[0], 'Cursed Rare');
  const leg = known(cursedWith(() => createWeapon(120, 1), T.UserTakesDamage, null, 'legendary'));
  assert.equal(LR.tierLabel(leg), 'Cursed Legendary');
  const own = LR.legendaryById(leg.legendary).affixes.length;
  assert.equal(LR.affixBand(leg, own - 1), null, 'a record\'s line has no band');
  assert.deepEqual(LR.affixBand(leg, own), LR.AFFIX_RANGES[leg.affixes[own].id].legendary, 'the curse\'s line its band');
  // a Perfect Rare cursed says both
  const perfect = known(cursedWith(amulet, T.BadReactionsFrom));
  perfect.affixes.forEach((a, i) => { a.value = LR.affixBand(perfect, i)[1]; });
  assert.equal(LR.tierLabel(perfect), 'Cursed Perfect Rare');
  assert.equal(LR.curseLine(r.cursed ? { ...r, cursed: null } : r), '');
});

test('LOOT16: the lifting - a quarter of the piece\'s price, at least 300; known, unworn and paid for; the drawback gone, the line and the price kept; refused, nothing taken - and the wire takes a curse only as a door makes one', () => {
  on();
  const piece = known(cursedWith(amulet, T.BadRepWith));
  const me = player();
  me.items.push(piece);
  assert.deepEqual([LIFT_FLOOR, LIFT_SHARE], [300, 0.25]);
  assert.equal(liftPrice(piece), Math.max(300, Math.round(piece.value / 4)));
  assert.equal(liftPrice({ ...piece, value: 400 }), 300, 'at least 300');
  assert.equal(liftPrice({ ...piece, value: 4000 }), 1000, 'a quarter');
  assert.equal(liftPrice(LR.applyRarity(amulet(), 'rare', lcg(2))), null, 'no curse, no price');
  const price = liftPrice(piece);
  // refusals, each taking nothing
  assert.equal(liftRefusal(piece, me), 'gold');
  me.goldPieces = price - 1;
  assert.deepEqual(liftCurse(piece, me), { ok: false, reason: 'gold' });
  assert.equal(me.goldPieces, price - 1);
  me.goldPieces = price + 50;
  piece.isIdentified = false;
  assert.equal(liftRefusal(piece, me), 'unknown', 'a curse the guild has not named');
  assert.deepEqual(cursedKnown(me.items), [], 'and the temple sees none');
  known(piece);
  assert.deepEqual(cursedKnown(me.items), [piece]);
  equipItem(me, piece);
  assert.equal(liftRefusal(piece, me), 'worn');
  me.equip = null; piece.equipSlot = undefined;
  delete piece.equipSlot;
  assert.equal(liftRefusal(LR.applyRarity(amulet(), 'rare', lcg(2)), me), 'not');
  assert.deepEqual(liftCurse(known(cursedWith(amulet, T.BadRepWith)), me), { ok: false, reason: 'gone' }, 'a piece not in the pack');
  // the lifting
  assert.equal(liftRefusal(piece, me), null);
  const before = { affixes: JSON.stringify(piece.affixes), value: piece.value, flavour: piece.enchantments.slice(0, -1) };
  assert.deepEqual(liftCurse(piece, me), { ok: true, price });
  assert.equal(me.goldPieces, 50, 'paid');
  assert.deepEqual(piece.enchantments, before.flavour, 'the drawback gone, its flavour kept');
  assert.equal(piece.cursed, undefined);
  assert.equal(JSON.stringify(piece.affixes), before.affixes, 'the line kept');
  assert.equal(piece.value, before.value);
  assert.equal(LR.tierLabel(piece), 'Rare');
  assert.ok(validLootItem(JSON.parse(JSON.stringify(piece))), 'a lifted piece is a piece');
  assert.deepEqual(liftCurse(piece, me), { ok: false, reason: 'not' }, 'once');
  off();
  const later = known(cursedWith(amulet, T.BadRepWith));
  assert.equal(liftRefusal(later, { ...me, goldPieces: 99999 }), 'off');
  on();
  // the wire: a curse as a door makes one, and no forgery
  const c = known(cursedWith(() => createWeapon(120, 1), T.LowDamageVs));
  assert.ok(validLootItem(JSON.parse(JSON.stringify(c))));
  const forged = (patch) => validLootItem({ ...JSON.parse(JSON.stringify(c)), ...patch });
  assert.equal(forged({ cursed: { type: T.ExtraWeight, param: 0 }, enchantments: [...c.enchantments, { type: T.ExtraWeight, param: 0 }] }), null, 'a row off the table');
  assert.equal(forged({ cursed: { type: T.BadRepWith, param: 5 }, enchantments: [...c.enchantments, { type: T.BadRepWith, param: 5 }] }), null, 'a param off its row');
  assert.equal(forged({ cursed: { type: T.BadRepWith, param: 1 } }), null, 'a drawback the piece does not carry');
  assert.equal(forged({ cursed: 'yes' }), null);
  assert.equal(forged({ exalted: true }), null, 'never on an Exalted');
  assert.equal(forged({ rarity: 'magic' }), null, 'never on a Magic');
  const ring = known(cursedWith(amulet, T.BadRepWith));
  assert.equal(validLootItem({ ...JSON.parse(JSON.stringify(ring)), cursed: { type: T.LowDamageVs, param: 0 }, enchantments: [...ring.enchantments, { type: T.LowDamageVs, param: 0 }] }), null, 'a weapon\'s drawback on a jewel');
  const cloth = known(cursedWith(garment.bind(null, 155), T.ItemDeteriorates));
  assert.equal(validLootItem({ ...JSON.parse(JSON.stringify(cloth)), cursed: { type: T.ItemDeteriorates, param: 1 }, enchantments: [...cloth.enchantments, { type: T.ItemDeteriorates, param: 1 }] }), null, 'the sun on cloth');
});

test('LOOT16: the temple\'s row - a Cure Disease priest\'s, in the Reforge\'s place on the classic popup and the Plus face, its key L after DFU\'s own; the host\'s hook for a temple\'s priest alone; its page lists what is known and lifts it', () => {
  _setGuildServiceArtForTests({ base: { w: 130, h: 51 }, member: { w: 130, h: 51 } });
  let lifted = 0, closed = 0, served = 0;
  const hooks = (extra) => ({ member: () => true, service: () => 'CureDisease', rows: () => [], onService: () => { served++; return { dispatched: true }; }, onClose: () => { closed++; }, ...extra });
  const [rx, ry, rw, rh] = REFORGE_RECT;
  const mid = [PANEL_X + rx + rw / 2, PANEL_Y + ry + rh / 2];
  const w = new GuildServiceWindow(hooks({ lift: () => { lifted++; return { dispatched: true }; } }));
  assert.equal(w.click(...mid), true);
  assert.deepEqual([lifted, closed, w.done], [1, 1, true], 'a dispatch closes the popup');
  const k = new GuildServiceWindow(hooks({ lift: () => { lifted++; return { dispatched: true }; } }));
  k.input(LIFT_KEY);
  assert.equal(lifted, 2, 'its key');
  const bare = new GuildServiceWindow(hooks({}));
  assert.equal(bare.click(...mid), false, 'no hook, no row');
  bare.input(LIFT_KEY);
  assert.equal(lifted, 2);
  let reforged = 0;
  const both = new GuildServiceWindow(hooks({ reforge: () => { reforged++; return { dispatched: true }; }, lift: () => { lifted++; return { dispatched: true }; } }));
  both.click(...mid);
  assert.deepEqual([reforged, lifted], [1, 2], 'the Reforge\'s row is its own where it stands');
  const teleport = new GuildServiceWindow(hooks({ service: () => 'Teleport', lift: () => { lifted++; return { dispatched: true }; } }));
  teleport.input(LIFT_KEY);
  assert.deepEqual([served, lifted], [1, 2], 'DFU\'s own L (Teleport\'s) first');
  assert.equal(LIFT_ROW, 'Lift Curse');
  assert.match(read('src/ui/enhancedPorts.js'), /\.\.\.\(!w\.hooks\.reforge && w\.hooks\.lift \? \[\{ label: LIFT_ROW, act: \(\) => w\._lift\(\) \}\] : \[\]\)/, 'the Plus face lists it beside the service');
  assert.match(read('src/scenes/worldModes.js'), /lift: route\.guildGroup === GUILD_GROUPS\.HolyOrder && service === 'CureDisease' && lootRarityOn\(\) \? \(\) => shutBox\(\) \?\? \(openLift\(\) \? \{ dispatched: true \} : null\) : null,/, 'a temple\'s Cure Disease priest');   // PIN MOVED (AUDIT CHAP5 D2): a shut hall's row refused on the popup
  assert.match(read('src/scenes/worldModes.js'), /const done = liftCurse\(item, playerEntity\);[\s\S]{0,200}pages: \['lift'\], page: 'lift',/, 'the law\'s, on the player\'s own pack, its one page');
  _setGuildServiceArtForTests(null);
  // the page
  on();
  const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
  const one = (n, cls) => kids(n, cls)[0] ?? null;
  assert.deepEqual(REFORGE_GUILD_PAGES, ['reforge', 'salvage', 'imprint', 'codex', 'scry', 'sockets'], 'the guild\'s window never shows the temple\'s page (LOOT19, LOOT20: its scryers\' and its sockets\' are its own)');
  withDom((dom) => {
    const cursed = known(cursedWith(amulet, T.BadRepWith, 3));
    const unknown = cursedWith(amulet, T.BadReactionsFrom);
    const worn = known(cursedWith(() => createWeapon(120, 1), T.LowDamageVs));
    const plain = known(LR.applyRarity(amulet(), 'rare', lcg(3)));
    const me = { ...player(), items: [cursed, unknown, worn, plain], goldPieces: 100000 };
    equipItem(me, worn);
    const host = dom.mk('div');
    dom.body.append(host);
    const calls = [];
    const view = mountReforgeWindow(host, {
      pages: ['lift'], page: 'lift', items: () => me.items, payer: () => me, gold: () => me.goldPieces, picture: () => null, nameOf: (it) => it.name,
      reforge: () => ({ ok: false }), salvage: () => ({ ok: false }), lift: (it) => { calls.push(it); return liftCurse(it, me); },
    });
    try {
      const shell = one(host, 'reforge-shell');
      assert.equal(shell.attrs['aria-label'], LIFT_TITLE);
      assert.equal(one(shell, 'reforge-tabs').attrs.hidden, '', 'one page: no tabs');
      let rows = kids(shell, 'lift-row');
      assert.equal(rows.length, 2, 'the known cursed - never the unknown, never a clean piece');
      const row = rows.find((r) => one(r, 'broker-name').textContent === cursed.name);
      assert.equal(one(row, 'broker-set').textContent, 'Cursed Rare · Bad Rep With: Nobility');
      assert.equal(one(row, 'broker-price').textContent, `${liftPrice(cursed)} gold`);
      const wornRow = rows.find((r) => r !== row);
      assert.equal(one(wornRow, 'lift-press').attrs.disabled, '', 'worn: take it off first');
      assert.equal(one(wornRow, 'lift-press').textContent, 'Worn');
      one(row, 'lift-press').onclick({ stopPropagation() {} });
      assert.deepEqual(calls, [cursed]);
      assert.equal(one(shell, 'broker-note').textContent, LIFTED(cursed.name));
      rows = kids(shell, 'lift-row');
      assert.equal(rows.length, 1, 'lifted, it leaves the list');
      me.goldPieces = 10;
      me.equip = null; delete worn.equipSlot;
      view.repaint();
      const short = one(kids(shell, 'lift-row')[0], 'lift-press');
      assert.equal(short.textContent, `Need ${liftPrice(worn) - 10} more gold`);
      me.items = [plain];
      view.repaint();
      assert.ok(kids(shell, 'codex-head').some((h) => h.textContent === LIFT_NONE), 'nothing cursed: said');
    } finally { view.unmount(); }
  });
  _resetForTests();
});
