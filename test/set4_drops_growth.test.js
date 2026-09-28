// SET4 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md sections 4-5; Mac: sets "come from any source, just
// like weapons", and "Grow together"): WHERE SET PIECES COME FROM, AND HOW THEY GROW. The win: every door SIGIL1 stamps
// at (lootRarity.js stampWonWeapons) now also rolls a set sigil on every Magic-or-better piece of armour and every shield
// by SIGIL1's own chance law, one of the four sets of the world at even odds, and a fresh weapon sigil joins a set one
// time in three - after SIGIL1's own draws, so theirs stay what they were. The drink: every worn set piece drinks the
// Renown XP the weapon in hand drinks, each once, and a rise is said once for a set (sigilSets.js drinkWorn, driven, and
// world.js's sigilDrinks mounted from its comment-stripped source).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SIGIL_STAGES, SIGIL_XP_MAX, sigilChance, validSigil, sigilHasBlow, sigilRank, setSigilOnline, setSigilRenown, rollSigil,
  _resetSigilForTests,
} from '../src/systems/sigil.js';
import {
  WORLD_SET_IDS, SET_WEAPON_JOIN_IN, SIGIL_SETS, rollWorldSet, rollSetSigil, rollSetJoin, setRiseLine, drinkWorn,
  setSetsDueling, wornSets, _resetSigilSetsForTests,
} from '../src/systems/sigilSets.js';
import { stampWonWeapons } from '../src/systems/lootRarity.js';
import '../src/systems/sigilSetPowers.js';   // the powers' fold, registered at import - as world.js imports it
import { computeEntityMods, entityStatMod } from '../src/systems/entityMods.js';
import { equipItem } from '../src/systems/equip.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { validItemField } from '../src/systems/itemFields.js';
import { validLootItem } from '../src/systems/loot.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { PARTY_MAX } from '../src/net/wire.js';
import { seededRng } from '../src/systems/wind.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { _resetPartyScaleForTests } from '../src/systems/partyScale.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
/** The balanced `open`..`close` run starting at the first `open` at or after `from`. */
function balanced(text, from, open = '(', close = ')') {
  let depth = 0;
  for (let i = text.indexOf(open, from); i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return text.slice(from, i + 1);
  }
  throw new Error('unbalanced');
}
const mount = (src, scope, tail) => new Function(...Object.keys(scope), `${src}\n${tail}`)(...Object.values(scope));
const seq = (...v) => { let i = 0; return () => v[i++]; };
const counted = (fn) => { const c = { n: 0 }; c.rolls = () => { c.n++; return fn(); }; return c; };

const player = () => ({ isPlayer: true, items: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {}, health: 50, maxHealth: 50, activeEffects: [] });
const BODY = [107, 106, 105, 102, 103, 104, 108];   // helm, right and left pauldron, cuirass, gauntlets, greaves, boots
const XP = SIGIL_STAGES.map((s) => s.xp);
const piece = (templateIndex, set, xp = 0) => {
  const it = mintCondition({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Steel, flags: 0 });
  it.rarity = 'rare';
  if (set) it.sigil = { set, party: 1, xp };
  return it;
};
const wear = (e, ...items) => { for (const it of items) { e.items.push(it); equipItem(e, it); } return e; };
const setWeapon = (set, xp = 0, templateIndex = 120) => { const w = createWeapon(templateIndex, 0); w.rarity = 'rare'; w.sigil = set ? { power: 5, set, party: 1, xp } : { power: 5, party: 1, xp }; return w; };
function fresh() { _resetSigilForTests(); _resetSigilSetsForTests(); setPref('lootRarity', true); }
const online = (renown) => { setSigilOnline(true); setSigilRenown(renown); };

test('SET4 the roll: a won piece of armour\'s set sigil by SIGIL1\'s own chance law (200 per mille alone, 40 more a fighter), one of the four sets of the world at even odds - never the Aetheric - a fresh record at Faint with no blow and its fight\'s size; nothing for a tier with no band; and a fresh weapon sigil joins a set one time in three (mutants: a chance of its own; the Aetheric rolled; the join every time)', () => {
  assert.deepEqual(WORLD_SET_IDS, ['malacath', 'dagon', 'nocturnal', 'mora']);
  assert.deepEqual([0, 0.2499, 0.25, 0.5, 0.75, 0.99999999].map((r) => rollWorldSet(() => r)), ['malacath', 'malacath', 'dagon', 'nocturnal', 'mora', 'mora'], 'four quarters');
  for (const party of [1, 2, 4, 8]) {
    const at = sigilChance(party) / 1000;
    assert.equal(rollSetSigil('magic', party, seq(at, 0)), null, `at ${sigilChance(party)} per mille: not under it`);
    assert.deepEqual(rollSetSigil('magic', party, seq(at - 0.0001, 0.5)), { set: 'nocturnal', party, xp: 0 }, `under it, for ${party}`);
  }
  const s = rollSetSigil('legendary', 99, seq(0, 0.3));
  assert.deepEqual(s, { set: 'dagon', party: PARTY_MAX, xp: 0 }, 'never past the seats');
  assert.equal(validSigil(s), true);
  assert.equal(sigilHasBlow(s), false, 'armour carries no blow');
  for (const tier of ['common', 'artifact', 'aetheric', undefined]) {
    const c = counted(() => 0);
    assert.equal(rollSetSigil(tier, 8, c.rolls), null, `${tier}: no band`);
    assert.equal(c.n, 0, '...and nothing rolled');
  }
  assert.equal(rollSetSigil('rare', 1, seq(0.1999, 0)).set, 'malacath');
  assert.equal(SET_WEAPON_JOIN_IN, 3);
  assert.equal(rollSetJoin(seq(0.3333, 0.75)), 'mora', 'under a third: it joins');
  assert.equal(rollSetJoin(seq(1 / 3)), null, 'a third: not');
  const one = counted(() => 0.9);
  assert.equal(rollSetJoin(one.rolls), null);
  assert.equal(one.n, 1, 'one roll when it does not join');
  let joined = 0;
  const r = seededRng(20260926);
  for (let i = 0; i < 30000; i++) if (rollSetJoin(r)) joined++;
  assert.ok(Math.abs(joined / 30000 - 1 / 3) < 0.01, `a third of them (${joined} of 30000)`);
  const tally = new Map(WORLD_SET_IDS.map((id) => [id, 0]));
  for (let i = 0; i < 40000; i++) { const id = rollWorldSet(r); tally.set(id, tally.get(id) + 1); }
  for (const [id, n] of tally) assert.ok(Math.abs(n / 40000 - 0.25) < 0.01, `${id}: a quarter (${n})`);
});

test('SET4 the stamp: a list won online - every Magic-or-better piece of armour and every shield rolls a set sigil, a weapon\'s fresh sigil may join a set; never a Common piece, jewellery, clothing, a quest\'s piece, an artifact, one already marked; offline or with the ladder off, nothing; and SIGIL1\'s own draws are the ones they were, the set\'s after them (mutants: armour skipped; shields skipped; jewellery and clothing taken; a quest\'s piece taken; one marked twice; the join rolled inside the weapon pass; the join dropped)', () => {
  fresh();
  const list = () => [
    { group: 'Weapons', templateIndex: 120, material: 0, rarity: 'magic', affixes: [] },          // 0 a Magic longsword
    piece(107),                                                                                     // 1 a Rare helm
    { ...piece(112), rarity: 'magic' },                                                             // 2 a Magic tower shield
    { ...piece(102), rarity: 'legendary' },                                                         // 3 a Legendary cuirass
    { ...piece(104), rarity: undefined },                                                           // 4 Common greaves
    { group: 'Jewellery', templateIndex: 133, rarity: 'rare' },                                     // 5 an amulet
    { group: 'MensClothing', templateIndex: 141, rarity: 'rare' },                                  // 6 a shirt
    { ...piece(103), questItem: true },                                                             // 7 a quest's gauntlets
    { ...piece(108), rarity: 'artifact' },                                                          // 8 an artifact's boots
    { ...piece(105), sigil: { set: 'mora', party: 2, xp: 900 } },                                   // 9 marked already
  ];
  const off = list();
  assert.equal(stampWonWeapons(off, 4, { rolls: () => 0 }), 0, 'offline: nothing');
  assert.ok(off.slice(0, 9).every((it) => it.sigil === undefined));
  setSigilOnline(true);
  const won = list();
  assert.equal(stampWonWeapons(won, 4, { rolls: () => 0 }), 4, 'the sword, the helm, the shield, the cuirass');
  assert.deepEqual(won[0].sigil, { power: 3, party: 4, xp: 0, set: 'malacath' }, 'the sword\'s blow, and a set');
  for (const i of [1, 2, 3]) assert.deepEqual(won[i].sigil, { set: 'malacath', party: 4, xp: 0 }, `piece ${i}`);
  for (const i of [4, 5, 6, 7, 8]) assert.equal(won[i].sigil, undefined, `piece ${i}: never`);
  assert.deepEqual(won[9].sigil, { set: 'mora', party: 2, xp: 900 }, 'one already marked keeps its own');
  // every record rides the wire
  for (const i of [0, 1, 2, 3]) {
    assert.deepEqual(validItemField('sigil', won[i].sigil), won[i].sigil);
    assert.ok(validLootItem({ ...won[i], name: 'x', value: 1 })?.sigil, `piece ${i} is a loot item with its sigil`);
  }
  // SIGIL1's draws first and unchanged: the same seed gives the weapons the same powers as SIGIL1 alone
  const weapons = () => [0, 1, 2, 3].map((i) => ({ group: 'Weapons', templateIndex: 116 + i, material: 0, rarity: ['magic', 'rare', 'legendary', 'rare'][i], affixes: [] }));
  for (const seed of [1, 7, 42, 1999, 31337]) {
    const alone = weapons();
    const r1 = seededRng(seed);
    for (const it of alone) { const s = rollSigil(it.rarity, 3, r1); if (s) it.sigil = s; }
    const mixed = [...weapons(), piece(107), piece(112)];
    stampWonWeapons(mixed, 3, { rolls: seededRng(seed) });
    assert.deepEqual(mixed.slice(0, 4).map((it) => it.sigil?.power ?? null), alone.map((it) => it.sigil?.power ?? null), `seed ${seed}: the weapons' powers are SIGIL1's`);
    // and a second machine with the same seed mints the same list
    const again = [...weapons(), piece(107), piece(112)];
    stampWonWeapons(again, 3, { rolls: seededRng(seed) });
    assert.deepEqual(again.map((it) => it.sigil ?? null), mixed.map((it) => it.sigil ?? null), `seed ${seed}: the same list on every machine`);
  }
  // a roll that misses: the weapon pass took its one draw, the armour its own
  const c = counted(() => 0.9);
  assert.equal(stampWonWeapons([{ group: 'Weapons', templateIndex: 120, material: 0, rarity: 'magic' }, piece(107), piece(112)], 1, { rolls: c.rolls }), 0);
  assert.equal(c.n, 3, 'one chance roll each, nothing more');
  setPref('lootRarity', false);
  assert.equal(stampWonWeapons(list(), 8, { rolls: () => 0 }), 0, 'the ladder off: no tier, no sigil');
  fresh();
});

test('SET4 the stamp at a real door: an outdoor body\'s won armour takes a set sigil at the kill, online, and never offline (mutants: armour skipped)', async () => {
  fresh(); _resetPartyScaleForTests();
  setSigilOnline(true);
  const pool = createExteriorFoes(rig({ rolls: () => 0 }));
  const rat = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  const helm = piece(107);
  rat.entity.items = [helm];
  pool.damageFoe(rat, 10_000, null, null, { fromPlayer: true });
  assert.ok(rat.dead);
  assert.deepEqual(helm.sigil, { set: 'malacath', party: 1, xp: 0 }, 'the body\'s helm, won');
  fresh(); _resetPartyScaleForTests();
  const solo = createExteriorFoes(rig({ rolls: () => 0 }));
  const rat2 = await solo.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  const helm2 = piece(107);
  rat2.entity.items = [helm2];
  solo.damageFoe(rat2, 10_000, null, null, { fromPlayer: true });
  assert.equal(helm2.sigil, undefined, 'offline, never');
});

test('SET4 the drink: every set piece I wear drinks the Renown XP the weapon in my hand drinks, each once - the weapon in hand never twice, a piece in the pack never - as a NEW record, never past the last stage; asleep in a duel the pieces drink nothing - AUDIT D8 a set\'s weapon in my hand neither, as its set sleeps - and offline nothing drinks (mutants: the weapon in hand drinking twice; the pieces drinking in a duel; a piece in the pack drinking; a set\'s weapon drinking in a duel)', () => {
  fresh(); online(40);
  const e = player();
  const helm = piece(BODY[0], 'dagon', 100), pauldron = piece(BODY[1], 'dagon', 200), packed = piece(BODY[3], 'dagon', 0);
  const sword = setWeapon('dagon', 300);
  wear(e, helm, pauldron, sword);
  e.items.push(packed);
  const helmWas = helm.sigil;
  drinkWorn(e, sword, 50);
  assert.deepEqual([helm, pauldron, sword, packed].map((p) => p.sigil.xp), [150, 250, 350, 0], 'each worn piece once; the weapon in hand once; the pack none');
  assert.notEqual(helm.sigil, helmWas, 'a new record');
  assert.equal(helmWas.xp, 100, 'the old one untouched - a copy taken before keeps what it took');
  const plain = setWeapon(null, 0);
  drinkWorn(e, plain, 10);
  assert.deepEqual([helm, pauldron, sword, plain].map((p) => p.sigil.xp), [160, 260, 360, 10], 'a plain sigil in my hand: it drinks, and every worn set piece too');
  drinkWorn(e, null, 5);
  assert.deepEqual([helm, pauldron, sword].map((p) => p.sigil.xp), [165, 265, 365], 'a bare hand: the pieces still drink');
  drinkWorn(e, sword, 1e9);
  assert.deepEqual([helm, pauldron, sword].map((p) => p.sigil.xp), [SIGIL_XP_MAX, SIGIL_XP_MAX, SIGIL_XP_MAX], 'never past the last stage');
  fresh(); online(40);
  const d = player();
  const dh = piece(BODY[0], 'mora', 0);
  wear(d, dh);
  setSetsDueling(true);
  drinkWorn(d, plain, 100);
  assert.equal(dh.sigil.xp, 0, 'a duel: the pieces sleep');
  assert.equal(plain.sigil.xp, 110, '...the weapon in hand is SIGIL1\'s and drinks');
  const dw = setWeapon('mora', 0);
  drinkWorn(d, dw, 100);
  assert.deepEqual([dh.sigil.xp, dw.sigil.xp], [0, 0], 'AUDIT D8: a set\'s weapon in hand sleeps with its set - no piece drinks');
  setSetsDueling(false);
  drinkWorn(d, dw, 100);
  assert.deepEqual([dh.sigil.xp, dw.sigil.xp], [100, 100], 'the duel over: both drink');
  dh.sigil = { ...dh.sigil, xp: 0 };
  _resetSigilForTests();
  drinkWorn(d, plain, 100);
  assert.deepEqual([dh.sigil.xp, plain.sigil.xp], [0, 110], 'offline: nothing');
  setSigilOnline(true);
  drinkWorn(d, plain, 100);
  assert.deepEqual([dh.sigil.xp, plain.sigil.xp], [0, 110], 'online, my Renown unknown: nothing');
});

test('SET4 the rise: said ONCE FOR A SET when its own rank - its lowest piece\'s - rises, with what my Renown holds it at; a piece rising alone above a lower one says nothing; the weapon in hand\'s own line is said unless its set has just said one; `rose` tells the host to fold (mutants: a line a piece; the rise read off the highest piece; the weapon\'s line said twice; the set\'s rank read after the weapon drank; `rose` never told)', () => {
  fresh(); online(40);
  const e = player();
  const a = piece(BODY[0], 'dagon', XP[1] - 10), b = piece(BODY[1], 'dagon', XP[1] - 10);
  wear(e, a, b);
  let r = drinkWorn(e, null, 10);
  assert.deepEqual(r, { lines: ['Your Dagon\'s Brand brightens: Kindled.'], rose: true }, 'two pieces rose together: one line');
  const c = piece(BODY[2], 'dagon', 0);
  wear(e, c);
  assert.equal(wornSets(e)[0].stage, 0, 'a fresh piece pulls the set down to Faint');
  a.sigil = { ...a.sigil, xp: XP[2] - 10 }; b.sigil = { ...b.sigil, xp: XP[2] - 10 };
  r = drinkWorn(e, null, 10);
  assert.equal(sigilRank(a.sigil), 2);
  assert.deepEqual(r, { lines: [], rose: false }, 'a and b rose to Bright, c is still Faint: the set did not rise');
  r = drinkWorn(e, null, XP[1] - 10);
  assert.equal(sigilRank(c.sigil), 1);
  assert.deepEqual(r, { lines: ['Your Dagon\'s Brand brightens: Kindled.'], rose: true }, 'c caught up to Kindled: the set rose with it');
  // the weapon in hand, its own set's line said in its place
  fresh(); online(40);
  const w = player();
  const sword = setWeapon('nocturnal', XP[1] - 1);
  wear(w, piece(BODY[0], 'nocturnal', XP[1] - 1), sword);
  r = drinkWorn(w, sword, 1, itemLongName);
  assert.deepEqual(r.lines, ['Your Nocturnal\'s Shroud brightens: Kindled.'], 'the set\'s line, not the sword\'s as well');
  const behind = setWeapon('nocturnal', XP[1] - 1);
  const w3 = wear(player(), piece(BODY[0], 'nocturnal', XP[1]), behind);
  r = drinkWorn(w3, behind, 1, itemLongName);
  assert.deepEqual(r, { lines: ['Your Nocturnal\'s Shroud brightens: Kindled.'], rose: true }, 'the sword in my hand held its set back: its rise is the set\'s');
  const ahead = setWeapon('nocturnal', XP[2] - 1);
  const w2 = wear(player(), piece(BODY[0], 'nocturnal', 0), ahead);
  r = drinkWorn(w2, ahead, 1, itemLongName);
  assert.deepEqual(r, { lines: [`The sigil on your ${itemLongName(ahead)} brightens: Bright.`], rose: false }, 'the sword rose, its set did not: the sword\'s own line');
  // the Renown holds it
  fresh(); online(12);
  const h = wear(player(), piece(BODY[0], 'mora', XP[2] - 1), piece(BODY[1], 'mora', XP[2] - 1));
  r = drinkWorn(h, null, 1);
  assert.deepEqual(r.lines, ['Your Mora\'s Mantle brightens: Bright. Your Renown holds it at Kindled until Renown 20.']);
  // two sets rising in one drink: a line each, in the registry's order
  fresh(); online(40);
  const two = wear(player(), piece(BODY[0], 'mora', XP[1] - 1), piece(BODY[1], 'malacath', XP[1] - 1));
  assert.deepEqual(drinkWorn(two, null, 1).lines, ['Your Malacath\'s Bulwark brightens: Kindled.', 'Your Mora\'s Mantle brightens: Kindled.']);
});

test('SET4 the rise lines: every set at every stage in its own words; the Renown\'s hold named with the Renown that frees it; nothing for a set or a stage that is not one (mutants: the Renown\'s hold unsaid)', () => {
  fresh(); online(40);
  for (const set of Object.values(SIGIL_SETS)) {
    for (let rank = 0; rank < SIGIL_STAGES.length; rank++) assert.equal(setRiseLine(set.id, rank), `Your ${set.name} brightens: ${SIGIL_STAGES[rank].name}.`);
  }
  setSigilRenown(1);
  assert.equal(setRiseLine('ruhn', 4), 'Your Ruhn\'s Regalia brightens: Ascendant. Your Renown holds it at Faint until Renown 10.');
  setSigilRenown(30);
  assert.equal(setRiseLine('ruhn', 3), 'Your Ruhn\'s Regalia brightens: Radiant.', 'the Renown opens it: no hold');
  assert.equal(setRiseLine('sheogorath', 1), null);
  assert.equal(setRiseLine('dagon', 5), null);
  assert.equal(setRiseLine('dagon', -1), null);
  fresh();
});

test('SET4 the host: world.js\'s drink (mounted) - the weapon in my hand and every worn set piece drink a kill\'s XP, the lines said through the town\'s voice, a set that rose folded at once (its stat tier\'s numbers move: Kindled\'s Strength), and past the hour\'s cap nothing drinks (mutants: the fold unrefreshed after a rise; the lines unsaid)', () => {
  const W = strip(read('src/scenes/world.js'));
  const at = W.indexOf('const sigilDrinks = (xp) => {');
  assert.ok(at > 0);
  const said = [];
  let folds = 0;
  const drinks = (cap, held, e) => mount(balanced(W, at, '{', '}'), {
    _renownCapHour: cap, renownHour: () => 500_000, modes: undefined, weaponRig: { playerWeapon: { strikingWeapon: held } }, drinkWorn, itemLongName, playerEntity: e,
    computeEntityMods: (x) => { folds++; return computeEntityMods(x); }, townTalk: { say: (l) => said.push(l) },
  }, 'return sigilDrinks;');
  fresh(); online(40);
  const e = wear(player(), piece(BODY[0], 'dagon', XP[1] - 5), piece(BODY[1], 'dagon', XP[1] - 5));
  assert.equal(entityStatMod(e, 'strength'), 2, 'the Ravager at Faint');
  drinks(null, null, e)(3);
  assert.deepEqual([said.length, folds], [0, 0], 'no rise: nothing said, nothing folded');
  drinks(null, null, e)(2);
  assert.deepEqual(said, ['Your Dagon\'s Brand brightens: Kindled.']);
  assert.equal(folds, 1, 'folded once');
  assert.equal(entityStatMod(e, 'strength'), 3, 'the Ravager at Kindled: 2 + 4 x 1/4');
  drinks(500_000, null, e)(1e6);
  assert.equal(sigilRank(e.items[0].sigil), 1, 'past the hour\'s cap: nothing drinks');
  assert.match(W, /const drank = drinkWorn\(playerEntity, held, xp, itemLongName\);\s*for \(const line of drank\.lines\) townTalk\.say\(line\);\s*if \(drank\.rose\) computeEntityMods\(playerEntity\);/);
  fresh();
});

// ── THE OUTDOOR POOL (sigil1.test.js's crafted rat) ─────────────────
function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const fetchBytes = async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); };
function rig(extra = {}) {
  return {
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 523530, currentPixelKey: () => '3,12',
    playerEntity: { isPlayer: true, level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) },
    audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
    ...extra,
  };
}
