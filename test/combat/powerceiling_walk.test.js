// POWER-CEILING (2026-10-27, bible/05-Combat/Power-Ceiling.md; the owner: "No exceptions and no band aids"): THE CEILING
// HOLDS, WALKED. No line of any piece past the Legendary band's top; the ladder the seven rungs it has; every number a
// power or a set carries at or under today's strongest of its kind. Pinned against every fixed record the game keeps and
// every item its honest producers mint (test/honestItems.mjs), so a record added above the ceiling fails here, named.
// The composites (the blow's product, the guards' share) are test/combat/powerceiling.test.js's.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RARITY_ORDER, RARITIES, ROLLED_TIERS, AFFIX_RANGES, AFFIX_KINDS, validAffix, allLegendaries, applyRarity, exaltLegendary,
  legendariesFor, GEM_GRADE_LINES, gemPieceCap, rarityEligible, rarityOf, kindParams,
} from '../../src/systems/loot/lootRarity.js';
import '../../src/systems/thunderlock.js';   // The Last Lock, a registered Legendary
import { AETHERIC_RECORDS, mintAetheric } from '../../src/systems/aetheric.js';
import { GILDED_RECORDS, GILDED_ERAS, mintGilded } from '../../src/systems/gilded.js';
import { SIGIL_BANDS, SIGIL_POWER_MAX } from '../../src/systems/sigil/sigil.js';
import { SIGIL_SETS, tierValues, SET_STAGE_MAX } from '../../src/systems/sigil/sigilSets.js';
import { TECHNIQUE_BANDS } from '../../src/combat/technique/techniqueRoster.js';
import { createArtifact } from '../../src/systems/loot/loot.js';
import { readMagicDef, MAGIC_ITEM_RECORD_SIZE } from '../../src/formats/magicDef.js';
import { mintPiece } from '../../src/systems/smithItems.js';
import { RECIPES, MASTERWORK } from '../../src/net/recipeLaw.js';
import { mintCondition } from '../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { DFU_MAGIC_ITEMS } from '../dfuMagicItems.mjs';
import { honestItems, honestItemsSkipped } from '../honestItems.mjs';
import {
  linesPastCeiling, lineTop, powerNumbers, roleTops, LOWER_IS_STRONGER, pathNumbers, PATH_LOWER_IS_STRONGER, skyNumbers,
} from '../../tools/powerCeiling.mjs';

/** Every failure names the rule it breaks. */
const RULE = 'THE CEILING HOLDS (bible/05-Combat/Power-Ceiling.md): a higher number or a new rung needs the owner\'s word, quoted there';
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const past = (where, item) => { const p = linesPastCeiling(item); assert.deepEqual(p, [], `${where}: ${p.join(', ')} - ${RULE}`); };

/** THE LEGENDARY BAND'S TOPS, every kind - the ceiling of every line in the game. */
const TOPS = Object.freeze({
  damage: 40, armor: 20, stat: 15, resist: 50, skill: 30, weight: 50, elemental: 10, leech: 10, thorns: 10, focus: 10, slayer: 30,
  standing: 8, warmth: 10, dry: 50, castSpeed: 15, potency: 15, wellspring: 10, technique: 50,
});

test('POWER-CEILING THE LADDER: seven rungs in their order, three rolled bands and none above the Legendary, the Legendary band\'s tops and the sigil\'s, all literal (mutants: a rung added; a top raised; a band above the Legendary)', () => {
  assert.deepEqual(RARITY_ORDER, ['common', 'magic', 'rare', 'legendary', 'aetheric', 'artifact', 'gilded'], `the ladder is the seven rungs it has - ${RULE}`);
  assert.deepEqual(RARITY_ORDER.map((r) => RARITIES[r].rank), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(Object.keys(RARITIES), RARITY_ORDER, 'no rung outside the order');
  assert.deepEqual(ROLLED_TIERS, ['magic', 'rare', 'legendary'], 'the rolled tiers - the bands');
  for (const [id, bands] of Object.entries(AFFIX_RANGES)) assert.deepEqual(Object.keys(bands), ROLLED_TIERS, `${id}: a band for each rolled tier and no other - ${RULE}`);
  assert.deepEqual(Object.fromEntries(Object.keys(AFFIX_RANGES).map((id) => [id, AFFIX_RANGES[id].legendary[1]])), TOPS, `the Legendary tops - ${RULE}`);
  assert.deepEqual(Object.keys(SIGIL_BANDS), ROLLED_TIERS);
  assert.equal(SIGIL_POWER_MAX, 12, 'the sigil\'s top: the Legendary band\'s 12');
  assert.equal(SIGIL_POWER_MAX, SIGIL_BANDS.legendary[1]);
  assert.deepEqual(TECHNIQUE_BANDS.legendary, [30, 50]);
});

test('POWER-CEILING THE LINE LAW: a line at its kind\'s top is lawful and one past it is refused - the wire\'s own check (lootRarity.js validAffix) and the walk\'s, every kind (mutants: validAffix reading the Rare band; the walk\'s top one high)', () => {
  for (const id of Object.keys(AFFIX_KINDS)) {
    const params = kindParams(id, { group: AFFIX_KINDS[id].groups[0], templateIndex: 120 });
    const at = { id, ...(params ? { param: params[0] } : {}), value: TOPS[id] };
    assert.equal(validAffix(at), true, `${id} at its top`);
    assert.equal(validAffix({ ...at, value: TOPS[id] + 1 }), false, `${id} one past its top is no line`);
    assert.deepEqual(linesPastCeiling({ affixes: [at] }), []);
    assert.deepEqual(linesPastCeiling({ affixes: [{ ...at, value: TOPS[id] + 1 }] }), [`${id}${params ? `:${params[0]}` : ''} ${TOPS[id] + 1} past ${TOPS[id]}`]);
  }
  assert.equal(lineTop('nope'), null);
  assert.equal(linesPastCeiling({ affixes: [{ id: 'nope', value: 1 }] }).length, 1, 'a line of no kind is past every ceiling');
});

test('POWER-CEILING THE RECORDS: every Legendary record (the thirty, the wardrobe\'s, the arcane three, a registered one), every Aetheric and Gilded record and era, its lines and its blow - and each as its producer mints it, an Exalted Legendary too (mutants: a Regalia line at the top plus one; the Hourlock\'s damage at 41)', () => {
  setPref('lootRarity', true);
  assert.ok(allLegendaries().some((r) => r.id === 'the-last-lock'), 'the registered record walked too');
  for (const r of allLegendaries()) {
    past(`Legendary ${r.id}`, r);
    for (const base of legendaryBases(r)) {
      const it = applyRarity(base, 'legendary', lcg(7), [r]);
      past(`Legendary ${r.id} minted`, it);
      exaltLegendary(it, lcg(11));
      past(`Legendary ${r.id} exalted`, it);
    }
  }
  for (const r of AETHERIC_RECORDS) {
    past(`Aetheric ${r.id}`, r);
    if (r.power !== undefined) assert.ok(r.power <= SIGIL_POWER_MAX, `Aetheric ${r.id}: blow ${r.power} past the sigil's ${SIGIL_POWER_MAX} - ${RULE}`);
    const it = mintAetheric(r);
    past(`Aetheric ${r.id} minted`, it);
    assert.equal(it.rarity, 'aetheric');
  }
  for (const r of [...GILDED_RECORDS, ...GILDED_ERAS]) {
    past(`Gilded ${r.id}`, r);
    const it = mintGilded(r);
    past(`Gilded ${r.id} minted`, it);
    assert.equal(it.rarity, 'gilded');
  }
});
/** The bases a Legendary record lands on, as its own templates say (one of each group where it names none). */
function legendaryBases(r) {
  const ts = r.templates ?? [r.group === 'Weapons' ? 120 : r.group === 'Armor' ? 102 : r.group === 'Jewellery' ? 135 : 154];
  return ts.map((t) => (r.group === 'Weapons' ? createWeapon(t, 0, () => 0.5)
    : mintCondition({ group: r.group === 'Clothing' ? 'MensClothing' : r.group, templateIndex: t, material: r.group === 'Armor' ? ARMOR_MATERIAL.Steel : undefined, flags: 0 })))
    .filter((it) => legendariesFor(it).some((l) => l.id === r.id));
}

test('POWER-CEILING THE ARTIFACTS: DFU\'s twenty-three carry no line and never take one - an artifact is its record\'s, untouched (mutant: an artifact eligible for the ladder)', () => {
  setPref('lootRarity', true);
  const templates = readMagicDef(craftMagicDef(DFU_MAGIC_ITEMS));
  const artifacts = templates.filter((t) => t.type === 1 || t.type === 2);
  assert.equal(artifacts.length, 23);
  for (let i = 0; i < artifacts.length; i++) {
    const it = createArtifact(templates, i);
    assert.equal(rarityOf(it), 'artifact', it.name);
    assert.equal(it.affixes, undefined, `${it.name}: no line`);
    assert.equal(rarityEligible(it), false, `${it.name}: never rolls a tier`);
  }
});
function craftMagicDef(records) {
  const buf = new Uint8Array(4 + records.length * MAGIC_ITEM_RECORD_SIZE);
  const v = new DataView(buf.buffer);
  v.setInt32(0, records.length, true);
  let o = 4;
  for (const r of records) {
    for (let i = 0; i < r.name.length && i < 31; i++) buf[o + i] = r.name.charCodeAt(i);
    o += 32;
    buf[o++] = r.type; buf[o++] = r.group; buf[o++] = r.groupIndex ?? 0;
    for (let i = 0; i < 10; i++) { v.setInt8(o++, r.ench?.[i]?.[0] ?? -1); v.setInt8(o++, r.ench?.[i]?.[1] ?? 0); }
    v.setInt16(o, r.uses ?? 100, true); o += 2;
    v.setInt32(o, r.value ?? 0, true); o += 4;
    buf[o++] = r.material ?? 0;
  }
  return buf;
}

test('POWER-CEILING THE GEMS: every gem\'s line at every grade under its kind\'s top, and a piece\'s gems of one kind together never past the Rare band\'s top (mutants: a Perfect Diamond past the top; the gems\' cap read from the Legendary band)', () => {
  for (const [gem, row] of Object.entries(GEM_GRADE_LINES)) {
    for (const side of ['weapon', 'other']) {
      const r = row[side];
      for (const value of r.values) assert.ok(value <= TOPS[r.id], `${gem} (${side}): ${r.id} ${value} past ${TOPS[r.id]} - ${RULE}`);
    }
  }
  for (const id of Object.keys(AFFIX_RANGES)) assert.equal(gemPieceCap(id), AFFIX_RANGES[id].rare[1], `${id}: the gems' cap is the Rare band's top`);
});

test('POWER-CEILING THE SETS AND THE POWERS: every number at Ascendant and in every power has a role; a line\'s under the Legendary band\'s top of its kind; every other at or under today\'s strongest of its role (mutants: Ruhn\'s fire past 50; Bound in Silk past 140; a recovery made shorter than any today)', () => {
  // today's strongest of each role - a record past one moves it, and fails here with its name
  const STRONGEST = {
    above: 75, below: 33, blow: 140, buff: 20, burst: 40, cadence: 3, chance: 30, climate: 20, cost: 30, find: 1.25, flat: 8, flatGuard: 5,
    gold: 5, guard: 30, heal: 30, hitCap: 25, magicka: 30, mana: 15, manaFlat: 3, pierce: 15, reach: 6, recover: 10, regen: 2, road: 50,
    rounds: 4, seconds: 8, shield: 40, ship: 30, spell: 25, splash: 60, stacks: 5, thorns: 30, ward: 40,
  };
  holdRoles(powerNumbers(), 149, STRONGEST, LOWER_IS_STRONGER, 'FIELD_ROLES');
});
/** THE ROLES HELD: every number has a role; a line's under its kind's Legendary top; every other at or under today's
 *  strongest of its role (`strongest`, as written down - a lower one is lowered there and in the page). */
function holdRoles(numbers, least, strongest, lower, table) {
  assert.ok(numbers.length >= least, `the walk reads ${numbers.length} numbers - the records moved`);
  assert.deepEqual(numbers.filter((n) => !n.role).map((n) => `${n.where}.${n.field}`), [], `a number with no role (tools/powerCeiling.mjs ${table}) - measure it first. ${RULE}`);
  for (const n of numbers.filter((x) => x.role.startsWith('line:'))) {
    const kind = n.role.slice(5);
    assert.ok(n.value <= TOPS[kind], `${n.where}.${n.field} = ${n.value}: a ${kind} past the Legendary band's ${TOPS[kind]} - ${RULE}`);
  }
  const now = roleTops(numbers, lower);
  for (const [role, top] of Object.entries(now)) {
    const was = strongest[role];
    const low = lower.includes(role);
    const holder = numbers.filter((n) => n.role === role && n.value === top).map((n) => `${n.where}.${n.field}`).join(', ');
    assert.ok(was !== undefined, `a new role, ${role} (${holder}) - measure it into Power-Ceiling.md first. ${RULE}`);
    assert.ok(low ? top >= was : top <= was, `${role}: ${holder} at ${top}, past today's strongest ${was} - ${RULE}`);
  }
  assert.deepEqual(now, strongest, 'the strongest of each role, as recorded (a lower one is lowered here and in the page)');
}

test('POWER-CEILING THE PATHS AND THE SKY (AUDIT HORIZONTAL D8): every number of every martial and arcane path has a role, a line\'s under the Legendary band\'s top, every other at or under today\'s strongest path number of its role; every channel the sky can carry at or under today\'s cap - a new path, star or channel fails until it is measured (mutants: Prismatic Ward past 40; Opening Strike past 30; Absolution sooner; a path number with no role; a weapon channel raised; the blow\'s whole raised)', () => {
  // the paths keep their shares as fractions, so their strongest are their own (the loot's chance is 30, Prismatic Ward's 40)
  const PATH_STRONGEST = {
    below: 0.5, blow: 30, blowStack: 3, castSpeed: 20, chance: 40, cost: 20, extra: 0.5, fatigue: 15, foes: 3, guard: 30, heal: 25,
    killHeal: 5, killMana: 20, leech: 10, leechShare: 0.5, manaShare: 0.25, oneIn: 3, pace: 20, perMissing: 2, pierce: 20, reach: 8,
    recover: 120, refund: 1 / 3, regen: 2, rounds: 8, seconds: 30, shieldCap: 20, spell: 25, spellStack: 3, stacks: 5, times: 2,
  };
  holdRoles(pathNumbers(), 100, PATH_STRONGEST, PATH_LOWER_IS_STRONGER, 'PATH_FIELD_ROLES');
  // the sky's channels, each at its cap: the most the whole tree gives, whatever its stars add up to
  const SKY_STRONGEST = {
    absorb: 15, 'act:life': 40, armor: 10, attribute: 15, axeDmg: 30, beastDmg: 30, blowCap: 30, blowTaken: 15, blowTotal: 50, bluntDmg: 30,
    bowDmg: 30, carry: 40, castCost: 25, 'castCost:combat': 20, castCostCap: 25, castSpeed: 15, coldDegrees: 10, daedraDmg: 30, dry: 40,
    evade: 10, fallLess: 40, fatigueLess: 40, fistDmg: 30, heatDegrees: 10, hp: 75, hpPct: 15, hpRegen: 10, killHeal: 6, killMana: 6,
    longDmg: 30, meleeDmg: 30, mp: 75, mpPct: 15, mpRegen: 10, 'pct:combat': 15, 'pct:life': 15, rageDmg: 25, 'resist:combat': 20,
    sailSpeed: 15, shortDmg: 30, 'skill:combat': 15, 'skill:life': 20, 'skillPct:combat': 20, 'skillPct:life': 25, spellPierce: 10,
    spellPower: 30, spellTaken: 15, standing: 10, unawareDmg: 40, undeadDmg: 30, warmth: 6, weaponDmg: 30, 'xp:life': 35, 'yield:life': 30,
  };
  holdRoles(skyNumbers(), 130, SKY_STRONGEST, [], 'skyNumbers');
});

test('POWER-CEILING EVERY ITEM MINTED: the honest producers\' sweep (every loot door, shelf, spoils, the Broker, the crafted pieces, gifts and keepsakes) - a rung of the seven by the piece\'s own word, no line past its top, no sigil past the band (mutants: a Rare\'s band raised past the top; AUDIT HORIZONTAL D3: a named reward minted on an eighth rung)', () => {
  const items = honestItems({ seeds: 2 });
  assert.deepEqual(honestItemsSkipped, [], 'every producer ran');
  assert.ok(items.length > 10000, `the sweep minted ${items.length}`);
  let lines = 0;
  const tiers = new Set();
  for (const { source, item } of items) {
    tiers.add(rarityOf(item));
    // AUDIT HORIZONTAL D3: the piece's own word, as its readers take it (`it.rarity === 'gilded'`) - rarityOf reads an
    // unknown rung as Common or Magic, so asking it could never fail
    assert.ok(item.rarity == null || RARITY_ORDER.includes(item.rarity), `${source}: ${item.rarity} is no rung - ${RULE}`);
    if (item.affixes?.length) { lines += item.affixes.length; past(`${source}: ${item.name}`, item); }
    if (item.sigil?.power !== undefined) assert.ok(item.sigil.power <= SIGIL_POWER_MAX, `${source}: sigil ${item.sigil.power} - ${RULE}`);
  }
  assert.ok(lines > 10000, `the sweep's ${lines} lines`);
  for (const r of ['magic', 'rare', 'legendary', 'aetheric', 'gilded']) assert.ok(tiers.has(r), `the sweep reached ${r}`);
});

test('POWER-CEILING A CRAFTED LEGENDARY (MASTER-ART\'s shape): a Masterwork piece at the Legendary rung, every line its group may carry at the band\'s very top, keeps the law; one point past is refused by the walk and the wire (mutant: the walk letting the top plus one through)', () => {
  setPref('lootRarity', true);
  const recipes = RECIPES.filter((r) => ['weapon', 'staff', 'bow', 'plate', 'chain', 'leather', 'shield', 'garment', 'jewel'].includes(r.kind)).filter((_, i) => i % 9 === 0);
  let minted = 0;
  for (const r of recipes) {
    const it = mintPiece({ recipe: r.id, quality: MASTERWORK, seed: 77, maker: 'Mac', version: 2 }, 'a1b2c3d4e5f60718');
    assert.ok(it, `${r.id} mints`);
    minted++;
    past(`crafted ${r.id}`, it);
    const kinds = Object.keys(AFFIX_KINDS).filter((id) => AFFIX_KINDS[id].groups.includes(it.group) && kindParams(id, it)?.length !== 0);   // a technique only where the piece has one
    it.rarity = 'legendary';
    it.affixes = kinds.map((id) => { const ps = kindParams(id, it); return { id, ...(ps ? { param: ps[0] } : {}), value: TOPS[id] }; });
    past(`crafted ${r.id} at the Legendary rung, every line at its top`, it);
    assert.ok(it.affixes.every(validAffix), 'the wire takes them');
    const over = { ...it, affixes: [{ ...it.affixes[0], value: it.affixes[0].value + 1 }] };
    assert.equal(linesPastCeiling(over).length, 1, `crafted ${r.id}: the top plus one is past the ceiling`);
    assert.equal(validAffix(over.affixes[0]), false);
  }
  assert.ok(minted >= 100, `${minted} crafted pieces walked`);
});
