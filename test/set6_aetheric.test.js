// SET6 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md section 6; Mac: "Boss kills has the chance of
// dropping a rare boss themed weapon/armor set with the rarity Atheric (new)"): AETHERIC, AND RUHN'S REGALIA. The ladder's
// new rung under the Artifact - its place, its colour, never rolled; the nine Regalia records and their mint (Daedric,
// known, a sigil of their set, a price, every field a declared one); the whole set worn; the drop - the spoils' LAST
// roll, so every earlier spoils is what it was for its seed; the floor, the card, the wire.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AETHERIC, AETHERIC_WORTH, REGALIA, REGALIA_CHANCE, REGALIA_SET, REGALIA_FIRE_RESIST, aethericById, isAetheric, mintAetheric, rollRegalia,
} from '../src/systems/aetheric.js';
import {
  RARITY_ORDER, RARITIES, ROLLED_TIERS, rarityOf, rarityRank, applyRarity, rarityEligible, bestRarity, rarityLines, rollRarity,
  affixesWorth, validAffix, AFFIX_RANGES,
} from '../src/systems/lootRarity.js';
import { rollSpoils, spoilsBase, magicOrBetter, SPOILS_GOLD_PER_LEVEL, SPOILS_LEGENDARY } from '../src/systems/gateSpoils.js';
import { spoilsList } from '../src/scenes/spoilsPool.js';
import { SPOILS_LINE_H, tierColour } from '../src/render/spoilsGlow.js';
import { SIGIL_POWER_MAX, validSigil, sigilHasBlow, setSigilOnline, setSigilRenown, _resetSigilForTests } from '../src/systems/sigil.js';
import { SIGIL_SETS, SET_PLACES, setIdOf, setPieceKind, wornSets, _resetSigilSetsForTests } from '../src/systems/sigilSets.js';
import { equipItem } from '../src/systems/equip.js';
import { itemBaseValue, templateByIndex } from '../src/systems/itemTemplates.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { SKILLS } from '../src/systems/skills.js';
import { getItemHands, ITEM_HANDS } from '../src/characters/equipTable.js';
import { isDeclaredItemField } from '../src/systems/itemFields.js';
import { validLootItem } from '../src/systems/loot.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { seededRng } from '../src/systems/wind.js';

const seq = (...v) => { let i = 0; return () => v[i++]; };
const counted = (fn) => { const c = { n: 0 }; c.rolls = () => { c.n++; return fn(); }; return c; };

test('SET6 the rung: Aetheric stands between the Legendary and the Artifact - rank 4, the Artifact moved to 5 - in the aether\'s pale blue-white, a tint of its own; an Aetheric piece wears its own field; the ladder never ROLLS it and never re-rolls a piece that wears it (mutants: the rung out of its place; the roll taking it)', () => {
  assert.deepEqual(RARITY_ORDER, ['common', 'magic', 'rare', 'legendary', 'aetheric', 'artifact']);
  assert.deepEqual(RARITY_ORDER.map((t) => RARITIES[t].rank), [0, 1, 2, 3, 4, 5], 'the order is the rank');
  assert.equal(AETHERIC, 'aetheric');
  assert.deepEqual({ label: RARITIES.aetheric.label, colour: RARITIES.aetheric.colour }, { label: 'Aetheric', colour: '#bfe8ff' });
  assert.equal(RARITIES.aetheric.tint.length, 4);
  assert.deepEqual(ROLLED_TIERS, ['magic', 'rare', 'legendary'], 'the rolled tiers are what they were');
  const piece = mintAetheric(REGALIA[0]);
  assert.equal(rarityOf(piece), 'aetheric');
  assert.equal(rarityRank(piece), 4);
  assert.equal(isAetheric(piece), true);
  assert.equal(isAetheric({ rarity: 'legendary' }), false);
  assert.equal(rarityEligible(piece), false, 'never rolled again');
  const plain = { group: 'Armor', templateIndex: 102, material: ARMOR_MATERIAL.Steel, name: 'Cuirass' };
  assert.deepEqual(applyRarity({ ...plain }, 'aetheric', () => 0), plain, 'the ladder\'s roll leaves a piece as it was');
  const sources = [{ boss: true, tier: 21, luck: 100 }, { tier: 21, luck: 100 }, { tier: 1, luck: 0 }];
  const r = seededRng(606);
  for (let i = 0; i < 3000; i++) assert.notEqual(rollRarity(sources[i % 3], r), 'aetheric', 'no source rolls it');
  assert.equal(bestRarity([{ rarity: 'legendary' }, piece, { rarity: 'magic' }]), 'aetheric', 'above a Legendary');
  assert.equal(bestRarity([piece, { artifact: true }]), 'artifact', 'under an Artifact');
});

test('SET6 the Regalia: nine fixed records, one for each place a set is worn - the seven body pieces, the Tower Shield and the Battle Axe (one-handed, so the shield is worn with it) - each three affixes at the TOP of the Legendary band but the gate\'s fire, +10 an armour piece (AUDIT FINAL, Mac: "Lower per piece" - at the top, any two pieces made the wearer immune to fire and the Burning Gate\'s tier meant nothing), a line of lore, the Warden\'s own set (mutants: an affix under the top; a place left out; the fire back at the band\'s top)', () => {
  assert.equal(REGALIA.length, SET_PLACES.length);
  assert.deepEqual(REGALIA.map((r) => r.templateIndex), [107, 106, 105, 102, 103, 104, 108, 112, 127], 'helm, right and left pauldron, cuirass, gauntlets, greaves, boots, tower shield, battle axe');
  assert.equal(getItemHands(mintAetheric(aethericById('ruhn-gatecleaver'))), ITEM_HANDS.Either, 'one hand - the War Axe would take both and bump the shield');
  assert.equal(new Set(REGALIA.map((r) => r.id)).size, 9, 'every id its own');
  assert.equal(REGALIA_SET, 'ruhn');
  assert.equal(SIGIL_SETS.ruhn.aetheric, true);
  for (const r of REGALIA) {
    assert.match(r.name, /^Ruhn's /, r.id);
    assert.equal(r.set, 'ruhn');
    assert.ok(r.lore && r.lore.length > 20, `${r.id}: its lore`);
    assert.equal(r.affixes.length, 3, `${r.id}: three affixes`);
    for (const a of r.affixes) {
      assert.ok(validAffix(a), `${r.id}: ${JSON.stringify(a)}`);
      if (a.id === 'resist' && a.param === 'fire') assert.equal(a.value, REGALIA_FIRE_RESIST, `${r.id}: the gate's fire, +${REGALIA_FIRE_RESIST}`);
      else assert.equal(a.value, AFFIX_RANGES[a.id].legendary[1], `${r.id}: ${a.id} at the Legendary band's top`);
    }
    if (r.group === 'Armor') assert.ok(r.affixes.some((a) => a.id === 'resist' && a.param === 'fire'), `${r.id}: the gate's fire`);
    assert.equal(aethericById(r.id), r);
  }
  // AUDIT FINAL: the whole body and the shield carry +80 - past immunity only with the Burning Gate's tier, never at two
  assert.equal(REGALIA_FIRE_RESIST, 10);
  const pieces = REGALIA.filter((r) => r.group === 'Armor').length;
  assert.equal(pieces * REGALIA_FIRE_RESIST, 80, 'eight pieces, +80');
  assert.ok(2 * REGALIA_FIRE_RESIST < 100, 'two pieces are no immunity');
  assert.equal(aethericById('the-warden'), null, 'a Legendary is not an Aetheric');
  const axe = aethericById('ruhn-gatecleaver');
  assert.deepEqual(axe.affixes.map((a) => [a.id, a.param ?? null, a.value]), [['damage', null, 40], ['stat', 'strength', 15], ['skill', SKILLS.Axe, 30]]);
});

test('SET6 the mint: a record made an item by the game\'s own minters - Daedric, whole, known - its name, its tier and record, its affixes a COPY, a sigil of its set fresh at Faint (the Gatecleaver\'s with the widest band\'s top blow), its price its make\'s and its affixes\' and the rung\'s; every field declared, a valid loot item on the wire, a set piece of the Regalia (mutants: the affixes shared with the record; unidentified; the price without the rung\'s worth; the axe\'s blow dropped)', () => {
  for (const r of REGALIA) {
    const it = mintAetheric(r);
    assert.equal(it.name, r.name);
    assert.equal(it.templateIndex, r.templateIndex);
    assert.equal(it.group, r.group);
    assert.equal(it.material, r.group === 'Weapons' ? WEAPON_MATERIALS.Daedric : ARMOR_MATERIAL.Daedric, `${r.id}: Daedric`);
    assert.ok(it.maxCondition > 0 && it.currentCondition === it.maxCondition, `${r.id}: whole`);
    assert.equal(it.rarity, 'aetheric');
    assert.equal(it.aetheric, r.id);
    assert.equal(it.isIdentified, true, 'known');
    assert.deepEqual(it.affixes, r.affixes.map((a) => ({ ...a })));
    assert.notEqual(it.affixes[0], r.affixes[0], 'a copy - the record is never the item\'s');
    assert.equal(it.enchantments, undefined, 'no DFU enchantment: it drops known, and breaks and stays');
    assert.ok(validSigil(it.sigil));
    assert.equal(it.sigil.set, 'ruhn');
    assert.equal(it.sigil.xp, 0, 'fresh, at Faint');
    assert.equal(it.sigil.party, 1);
    assert.equal(sigilHasBlow(it.sigil), r.group === 'Weapons', 'the axe alone carries a blow');
    if (r.group === 'Weapons') assert.equal(it.sigil.power, SIGIL_POWER_MAX);
    assert.equal(it.value, itemBaseValue(it) + affixesWorth(it.affixes) + AETHERIC_WORTH);
    for (const k of Object.keys(it)) assert.ok(isDeclaredItemField(k), `${r.id}: '${k}' is a declared item field`);
    const wire = validLootItem(it);
    assert.ok(wire, `${r.id} rides the wire`);
    assert.deepEqual([wire.rarity, wire.aetheric, wire.sigil], [it.rarity, it.aetheric, it.sigil]);
    assert.equal(setIdOf(it), 'ruhn', 'a Regalia set piece');
    assert.equal(setPieceKind(it), r.group === 'Weapons' ? 'weapon' : r.templateIndex === 112 ? 'shield' : 'armor');
    assert.ok(templateByIndex(it.templateIndex));
  }
  const a = mintAetheric(REGALIA[0]), b = mintAetheric(REGALIA[0]);
  assert.notEqual(a, b, 'a fresh item every mint');
  a.affixes[0].value = 1;
  assert.equal(REGALIA[0].affixes[0].value, 20, 'the record untouched');
});

test('SET6 the Regalia worn whole: the nine places count nine, and online every tier of the Warden\'s set is awake - the card and the powers read the set as any other (mutants: the shield or the axe not counted)', () => {
  _resetSigilForTests(); _resetSigilSetsForTests();
  setSigilOnline(true); setSigilRenown(1);
  const e = { isPlayer: true, items: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {}, health: 50, maxHealth: 50, activeEffects: [] };
  for (const r of REGALIA) { const it = mintAetheric(r); e.items.push(it); equipItem(e, it); }
  const [st] = wornSets(e);
  assert.equal(st.id, 'ruhn');
  assert.equal(st.count, 9, 'seven body pieces, the shield, the axe');
  assert.equal(st.stageName, 'Faint');
  assert.deepEqual(st.tiers.map((t) => t.awake), [true, true, true]);
  _resetSigilForTests(); _resetSigilSetsForTests();
});

test('SET6 the drop: the spoils\' LAST roll - a Regalia piece a sixth of the time, the same seed choosing which, one roll when none drops - so every earlier spoils (the gold, the three graded pieces) is exactly what it was for its seed; the piece leaves last, Aetheric and known (mutants: the roll before the graded pieces; a chance of its own; every piece the same)', () => {
  assert.equal(REGALIA_CHANCE, 1 / 6);
  assert.equal(rollRegalia(seq(1 / 6)), null, 'a sixth is not under a sixth');
  const one = counted(() => 0.5);
  assert.equal(rollRegalia(one.rolls), null);
  assert.equal(one.n, 1, 'one roll when nothing drops');
  assert.equal(rollRegalia(seq(0.1666, 0)).aetheric, REGALIA[0].id);
  assert.equal(rollRegalia(seq(0, 0.9999)).aetheric, REGALIA[8].id, 'the last record reachable');
  // the pre-SET6 spoils, spelt with the same public makers: the gold and the three graded pieces are the same
  const before = (seed, level) => {
    const rolls = seededRng(seed >>> 0);
    const gold = Math.round(SPOILS_GOLD_PER_LEVEL * level * (0.8 + 0.4 * rolls()));
    const tiers = [rolls() < SPOILS_LEGENDARY ? 'legendary' : 'rare'];
    const items = [applyRarity(spoilsBase(level, rolls), tiers[0], rolls)];
    for (let i = 0; i < 2; i++) { const base = spoilsBase(level, rolls); const t = magicOrBetter(rolls); items.push(applyRarity(base, t, rolls)); }
    return { gold, names: items.map((it) => it.name), affixes: items.map((it) => JSON.stringify(it.affixes ?? null)), next: rolls() };
  };
  let drops = 0;
  const seen = new Set();
  for (let seed = 1; seed <= 3000; seed++) {
    const s = rollSpoils(seed, 12);
    const b = before(seed, 12);
    assert.equal(s.gold, b.gold, `seed ${seed}: the gold`);
    assert.deepEqual(s.pieces.slice(0, 3).map((p) => p.item.name), b.names, `seed ${seed}: the three graded pieces`);
    assert.deepEqual(s.pieces.slice(0, 3).map((p) => JSON.stringify(p.item.affixes ?? null)), b.affixes);
    const has = s.pieces.length === 4;
    assert.equal(has, b.next < REGALIA_CHANCE, `seed ${seed}: the next roll decides it`);
    if (!has) continue;
    drops++;
    const p = s.pieces[3];
    assert.equal(p.tier, 'aetheric');
    assert.equal(p.item.rarity, 'aetheric');
    assert.equal(p.item.isIdentified, true);
    seen.add(p.item.aetheric);
  }
  assert.ok(Math.abs(drops / 3000 - 1 / 6) < 0.02, `a sixth of the kills (${drops} of 3000)`);
  assert.equal(seen.size, 9, 'every piece of the nine drops');
  assert.deepEqual(rollSpoils(77, 12), rollSpoils(77, 12), 'the same seed, the same spoils');
});

test('SET6 the floor and the card: a Regalia piece is laid as an item in its tier\'s line - between the Legendary\'s height and the Artifact\'s, in the rung\'s colour - before the Sigil Stone and the gold; its card names the rung, its affixes, its sigil and its lore, and its name is its record\'s with no material before it (mutants: the line at a lower tier\'s height; the lore unsaid; the Daedric prefix)', () => {
  let seed = 1;
  while (seed < 500 && rollSpoils(seed, 12).pieces.length !== 4) seed++;
  assert.ok(seed < 500, 'a kill whose spoils carry a Regalia piece, within the first five hundred seeds');
  const list = spoilsList(seed, 12);
  assert.equal(list.length, 6, 'three graded pieces, the Regalia piece, the stone, the gold');
  assert.equal(list[3].kind, 'item');
  assert.equal(list[3].tier, 'aetheric');
  assert.equal(list[4].item.name, 'Sigil Stone');
  assert.equal(list[5].kind, 'gold');
  assert.ok(SPOILS_LINE_H.aetheric > SPOILS_LINE_H.legendary && SPOILS_LINE_H.aetheric < SPOILS_LINE_H.artifact);
  assert.deepEqual(tierColour('aetheric').map((c) => Math.round(c * 255)), [0xbf, 0xe8, 0xff]);
  setPref('lootRarity', true);
  const lines = rarityLines(mintAetheric(aethericById('ruhn-warden-plate')));
  assert.equal(lines[0], 'Aetheric');
  assert.deepEqual(lines.slice(1, 4), ['+20 armor', '+10% Fire resistance', '+15 Endurance']);
  assert.match(lines.at(-1), /^Beaten in the gate's own heart/, 'the lore, last - as a Legendary\'s');
  for (const r of REGALIA) assert.equal(itemLongName(mintAetheric(r)), r.name, `${r.id}: named as a Legendary is - never "Daedric ${r.name}"`);
});
