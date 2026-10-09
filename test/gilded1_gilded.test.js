// GILDED1 (2026-10-07; bible/06-Systems/Gilded.md; Mac: "I want to add a new weapon of a new rarity. The thunderlock of
// rarity above atheric. The most rare and gilded item in the entire game with a static role. Ensure its powerful but not
// overpowered.") - THE GILDED RUNG, AND THE HOURLOCK. The laws pinned:
//   - THE RUNG: the ladder's top, rank 6 over the Artifact's 5, a gold of its own; NOTHING ROLLS IT.
//   - THE RECORD: a Thunderlock of Dwarven make, its four lines each at the Legendary band's TOP and no higher.
//   - THE MINT: whole, known and priced, a fresh item every call; the wire takes it exactly as minted.
//   - A STATIC ROLL: one number off, a line short or long, a mark another door lays - the wire refuses it; and no door
//     that alters a piece (the Reforge, the hone, the salvage, the item maker, the exalt, the curse, the heirloom) takes it.
//   - THE DROP: one draw, one in fifty (the Brass Remnant's spoils' last - sd9e_spoils.test.js pins the order).
//   - THE HOUR TOLLS: the third shot that LANDS strikes for double, a foe it fells gives the pellet back - its own shots
//     alone, asleep in a duel, nothing with the switch off.
//   - THE LOOK: named as an artifact is, its card's lines and power, its codex row and its first find said; its art in a
//     list, on the doll, in the Morrowind hand and in the classic hand (the gold leaf on the gun, never on the glove).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as LP from '../src/systems/lootPowers.js';
import * as CX from '../src/systems/lootCodex.js';
import {
  GILDED, GILDED_WORTH, GILDED_CHANCE, HOUR_TOLLS, HOURLOCK, GILDED_RECORDS, gildedById, isGilded,
  mintGilded, mintHourlock, rollHourlock, validGildedMarks,
} from '../src/systems/gilded.js';
import { createThunderlock, createPellets, pelletCount, ART_RECORDS, thunderlockImageRecord } from '../src/systems/thunderlock.js';
import { THUNDERLOCK_TEMPLATE } from '../src/characters/thunderlockIds.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { SKILLS } from '../src/systems/skills.js';
import { itemBaseValue, inventoryItemImage, ownItemImage } from '../src/systems/itemTemplates.js';
import { stampedTier } from '../src/systems/rarityTier.js';
import { validLootItem } from '../src/systems/loot.js';
import { salvageRefusal, reforgeRefusal, honeRefusal } from '../src/systems/reforge.js';
import { itemMakerRefuses } from '../src/systems/enchanting.js';
import { heirloomEligible } from '../src/systems/legacy/heirloom.js';
import { temperRefusal } from '../src/net/temperLaw.js';   // CRAFT4's temper, law 7
import { itemLongName } from '../src/systems/itemInfo.js';
import { quickslotKey } from '../src/systems/quickslots.js';
import { ownWeaponModelFor } from '../src/characters/ownWeaponModels.js';
import { SPOILS_LINE_H } from '../src/render/spoilsGlow.js';
import { PI_RIM } from '../src/systems/physicalItems.js';
import { BRIEF_MAX } from '../src/systems/sigilSets.js';
import { setSetsDueling, _resetSigilSetsForTests } from '../src/systems/sigilSets.js';
import { _resetSetPowersForTests } from '../src/systems/sigilSetPowers.js';
import { reportPlayerKill } from '../src/systems/playerKills.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { equipItem } from '../src/systems/equip.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { modSaveRecords, restoreModSaveRecords } from '../src/systems/modSaveData.js';
import { registerPresenter } from '../src/systems/notify.js';
import { handMask, gildFrame, gildKeep, GILD, GILD_RAMP } from '../src/combat/thunderlockArt.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const on = () => { _resetForTests(); setPref('lootRarity', true); CX._resetCodexForTests(); };
const wire = (it) => validLootItem(JSON.parse(JSON.stringify(it)));
const counted = (fn) => { const c = { n: 0 }; c.rolls = () => { c.n++; return fn(); }; return c; };

// ── the rung ──────────────────────────────────────────────────────────

test('GILDED1 THE RUNG: the ladder\'s top - rank 6 over the Artifact\'s 5, gold leaf of its own; the rolled tiers what they were and the roll never lands on it, nor re-rolls a piece that wears it (mutants: the rung under the Artifact; the roll taking it)', () => {
  on();
  assert.equal(GILDED, 'gilded');
  assert.equal(LR.RARITY_ORDER.at(-1), GILDED, 'the last rung');
  assert.deepEqual({ rank: LR.RARITIES.gilded.rank, label: LR.RARITIES.gilded.label, colour: LR.RARITIES.gilded.colour }, { rank: 6, label: 'Gilded', colour: '#ffcf4d' });
  for (const t of LR.RARITY_ORDER.slice(0, -1)) assert.ok(LR.RARITIES[t].rank < LR.RARITIES.gilded.rank, `over ${t}`);
  assert.equal(LR.RARITIES.gilded.tint.length, 4);
  assert.deepEqual([...LR.ROLLED_TIERS], ['magic', 'rare', 'legendary'], 'nothing rolls it');
  const plain = createThunderlock();
  const before = JSON.stringify(plain);
  assert.equal(JSON.stringify(LR.applyRarity(plain, GILDED, () => 0)), before, 'asked for the rung, the ladder leaves the piece as it was');
  const h = mintHourlock();
  assert.equal(LR.rarityEligible(h), false, 'and a piece that wears it is never rolled again (every door asks this first, as SET6\'s)');
  assert.equal(LR.rarityOf(h), GILDED);
  assert.equal(stampedTier(h), true, 'a stamped tier - minted whole, as the Aetheric is');
  assert.equal(isGilded(h), true);
  assert.equal(isGilded(createThunderlock()), false);
  // the rung's dress, tallest and strongest of them all
  for (const t of LR.RARITY_ORDER.slice(0, -1)) assert.ok(SPOILS_LINE_H.gilded > SPOILS_LINE_H[t], `its line over ${t}'s`);
  for (const t of Object.keys(PI_RIM).filter((k) => k !== 'gilded')) assert.ok(PI_RIM.gilded > PI_RIM[t], `its rim over ${t}'s`);
});

// ── the record ────────────────────────────────────────────────────────

test('GILDED1 THE RECORD: one, a Thunderlock of the gun\'s own Dwarven make - +40% damage, +15 Agility, +30 Archery, +10 shock a shot: each line the Legendary band\'s TOP and no higher - its power The Hour Tolls, its lore; frozen whole (mutants: a line over the band\'s top; the power\'s every)', () => {
  assert.equal(GILDED_RECORDS.length, 1);
  assert.equal(GILDED_RECORDS[0], HOURLOCK);
  assert.equal(gildedById('the-hourlock'), HOURLOCK);
  assert.equal(gildedById('the-hourlocks'), null);
  assert.equal(gildedById(undefined), null);
  assert.deepEqual([HOURLOCK.name, HOURLOCK.group, HOURLOCK.templateIndex, HOURLOCK.material], ['The Hourlock', 'Weapons', THUNDERLOCK_TEMPLATE, WEAPON_MATERIALS.Dwarven]);
  assert.deepEqual(HOURLOCK.affixes.map((a) => [a.id, a.param ?? null, a.value]),
    [['damage', null, 40], ['stat', 'agility', 15], ['skill', SKILLS.Archery, 30], ['elemental', 'shock', 10]]);
  for (const a of HOURLOCK.affixes) {
    assert.ok(LR.validAffix(a), `${a.id}: a line the ladder carries`);
    assert.equal(a.value, LR.AFFIX_RANGES[a.id].legendary[1], `${a.id}: the Legendary band's top - powerful, never past it`);
  }
  assert.ok(Object.isFrozen(HOURLOCK) && Object.isFrozen(HOURLOCK.affixes) && HOURLOCK.affixes.every((a) => Object.isFrozen(a)), 'frozen whole');
  assert.equal(HOURLOCK.power, HOUR_TOLLS);
  assert.deepEqual({ kind: HOUR_TOLLS.kind, every: HOUR_TOLLS.every, pct: HOUR_TOLLS.pct, refund: HOUR_TOLLS.refund }, { kind: 'toll', every: 3, pct: 100, refund: true });
  assert.ok(HOUR_TOLLS.brief.length <= BRIEF_MAX, `"${HOUR_TOLLS.brief}" fits the card's row`);
  assert.ok(Object.isFrozen(HOUR_TOLLS));
  assert.equal(LR.powerOf('the-hourlock'), HOUR_TOLLS, 'the ladder reads its power through the one door');
  assert.match(HOURLOCK.lore, /Hour/);
});

// ── the mint ──────────────────────────────────────────────────────────

test('GILDED1 THE MINT: the Thunderlock\'s own mint, named, of its tier and record, its lines a copy, KNOWN, priced its make + its lines + GILDED_WORTH (the Aetheric\'s five times over); a fresh item every call; the wire takes it as minted (mutants: the price; unknown)', () => {
  on();
  const a = mintHourlock(), b = mintHourlock();
  assert.notEqual(a, b, 'a fresh item');
  assert.notEqual(a.affixes, b.affixes);
  assert.notEqual(a.affixes[0], HOURLOCK.affixes[0], 'its lines a copy - the record is never handed out');
  assert.equal(Object.isFrozen(a.affixes[0]), false);
  assert.deepEqual([a.name, a.rarity, a.gilded, a.isIdentified, a.group, a.templateIndex, a.material], ['The Hourlock', GILDED, 'the-hourlock', true, 'Weapons', THUNDERLOCK_TEMPLATE, WEAPON_MATERIALS.Dwarven]);
  assert.ok(a.maxCondition > 0 && a.currentCondition === a.maxCondition, 'the weapons\' one pool at its make');
  assert.equal(GILDED_WORTH, 12500);
  assert.equal(a.value, itemBaseValue(createThunderlock({ material: WEAPON_MATERIALS.Dwarven })) + LR.affixesWorth(HOURLOCK.affixes) + GILDED_WORTH);
  assert.deepEqual(mintGilded(HOURLOCK), { ...a, affixes: a.affixes.map((x) => ({ ...x })) }, 'mintHourlock is mintGilded of its record');
  const back = wire(a);
  assert.ok(back, 'the wire takes it');
  assert.deepEqual(JSON.parse(JSON.stringify(back)), JSON.parse(JSON.stringify(a)), 'as minted');
});

// ── a static roll ─────────────────────────────────────────────────────

test('GILDED1 A STATIC ROLL: the wire holds it to its record EXACTLY - one number off, a param changed, a line dropped, added or moved, another record, another tier, template or make, any mark another door lays, any enchantment: refused; a piece of no Gilded record passes untouched (mutants: the band let in; a mark let in)', () => {
  on();
  const forge = (f) => { const it = mintHourlock(); f(it); return wire(it); };
  assert.ok(forge(() => {}));
  assert.equal(forge((it) => { it.affixes[0].value = 39; }), null, 'one under');
  assert.equal(forge((it) => { it.affixes[0].value = 41; }), null, 'one over');
  assert.equal(forge((it) => { it.affixes[1].param = 'strength'; }), null, 'a param changed');
  assert.equal(forge((it) => { it.affixes.pop(); }), null, 'a line dropped');
  assert.equal(forge((it) => { it.affixes.push({ id: 'leech', value: 10 }); }), null, 'a line added');
  assert.equal(forge((it) => { it.affixes.reverse(); }), null, 'the lines moved');
  assert.equal(forge((it) => { it.gilded = 'the-hourlocks'; }), null, 'no such record');
  assert.equal(forge((it) => { it.rarity = 'legendary'; }), null, 'its record on another tier');
  assert.equal(forge((it) => { delete it.gilded; }), null, 'the tier with no record - never a bare word');
  assert.equal(forge((it) => { it.templateIndex = 120; }), null, 'another template');
  assert.equal(forge((it) => { it.material = WEAPON_MATERIALS.Daedric; }), null, 'another make');
  for (const [k, v] of [['sigil', { set: 'numidium', piece: 0 }], ['legendary', 'wyrmbane'], ['aetheric', 'x'], ['imprint', 'nightwhisper'], ['cursed', { type: 1, param: 0 }], ['socket', 'empty'], ['reforged', 0], ['honed', 1], ['exalted', true]]) {
    assert.equal(validGildedMarks({ ...mintHourlock(), [k]: v }), null, `${k}: a mark another door lays`);
  }
  assert.equal(forge((it) => { it.enchantments = [{ type: 0, param: 5 }]; }), null, 'a DFU enchantment');
  assert.equal(forge((it) => { it.customEnchantments = [{ type: 10, param: 1 }]; }), null, 'a made one');
  const plain = createWeapon(120, 1);
  assert.equal(validGildedMarks(plain), plain, 'a piece of no Gilded record passes untouched');
  assert.equal(validGildedMarks(null), null);
});

test('GILDED1 NO DOOR ALTERS IT: the salvage, the Reforge, the hone, the item maker, the exalt, the curse, the heirloom and the crafter\'s temper each refuse a Gilded piece - and the codex\'s imprint is never its (mutants: the salvage; the item maker; the heirloom)', () => {
  on();
  const h = mintHourlock();
  assert.equal(salvageRefusal(h), 'gilded', 'never broken down');
  assert.equal(itemMakerRefuses(h), true, 'never enchanted');
  assert.equal(itemMakerRefuses(createThunderlock()), false, 'a plain gun is the item maker\'s');
  assert.deepEqual(LR.reforgeableLines(h), [], 'no line the Reforge turns');
  assert.equal(reforgeRefusal(h, 0, { items: [] }), 'not');
  assert.deepEqual(LR.honeableLines(h), [], 'no line the hone raises');
  assert.equal(honeRefusal(h, 0, { items: [] }), 'not');
  assert.equal(LR.exaltLegendary(h, () => 0), false, 'never exalted');
  assert.equal(LR.cursePiece(h, () => 0), false, 'never cursed');
  assert.equal(h.cursed, undefined);
  assert.equal(heirloomEligible({ ...h, equipSlot: 1 }), false, 'never an heirloom - it is its record\'s');
  assert.equal(CX.imprintRefusal(h, 'nightwhisper', { items: [] }), 'not', 'the imprint is a Rare\'s');
  assert.equal(temperRefusal({ ...createWeapon(120, 1), rarity: GILDED }), 'rarity', 'CRAFT4\'s temper: law 7 shuts the rung - on any base a smith could temper');
  assert.equal(temperRefusal(h), 'not', 'and the gun itself is no recipe\'s');
  assert.equal(JSON.stringify(h), JSON.stringify(mintHourlock()).replace(/"currentCondition":\d+/, `"currentCondition":${h.currentCondition}`), 'and nothing laid on it');
});

// ── the drop ──────────────────────────────────────────────────────────

test('GILDED1 THE DROP: ONE draw, always - under GILDED_CHANCE the Hourlock, else nothing; one in fifty (mutants: the chance)', () => {
  on();
  assert.equal(GILDED_CHANCE, 1 / 50);
  const yes = counted(() => GILDED_CHANCE - 1e-9), no = counted(() => GILDED_CHANCE);
  const got = rollHourlock(yes.rolls);
  assert.equal(got?.gilded, 'the-hourlock');
  assert.equal(rollHourlock(no.rolls), null);
  assert.deepEqual([yes.n, no.n], [1, 1], 'one draw, whatever it answers - the spoils\' stream never shifts');
  let n = 0, seed = 7;
  const lcg = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
  for (let i = 0; i < 20000; i++) if (rollHourlock(lcg)) n++;
  assert.ok(Math.abs(n / 20000 - GILDED_CHANCE) < 0.004, `${n} of 20000`);
  // the Brass Remnant's spoils are where it falls - its last piece's roll, the Remnant's card after it (sd9e_spoils.test.js pins the order)
  assert.match(strip(read('src/systems/sdSpoils.js')), /const brass = rollNumidiumPiece\(rolls\);\s*if \(brass\) pieces\.push\(\{ item: brass, tier: brass\.rarity \}\);\s*const hourlock = rollHourlock\(rolls\);\s*if \(hourlock\) pieces\.push\(\{ item: hourlock, tier: hourlock\.rarity \}\);\s*const card = bossCardRoll\('abyss', rolls\);\s*return \{ gold, pieces, card \};/);   // PIN MOVED (CARDS9): the Brass Remnant's own card one draw after the Hourlock's, last of all
});

// ── the power ─────────────────────────────────────────────────────────

let T = 0;
LP._setLootPowersClockForTests(() => T);
const fresh = () => {
  on(); LP._resetLootPowersForTests(); _resetSetPowersForTests(); _resetSigilSetsForTests();
  setPlayerDoor(null); T = 0; LP.setLootPowersVoice({ say: () => {} });
};
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 20, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 50, maxMagicka: 100, goldPieces: 0 });
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };
const foe = (extra = {}) => ({ careerIndex: 7, career: {}, health: 100, maxHealth: 100, level: 10, ...extra });

test('GILDED1 THE HOUR TOLLS: its shots that LAND are counted, and the third strikes for double (+100% of the blow) - a shot that misses counts nothing; another weapon\'s blows neither toll nor count; asleep in a duel, nothing with the switch off (mutants: every shot tolls; a miss counted; the count never turns)', () => {
  fresh();
  const me = player();
  const h = wear(me, mintHourlock());
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], player: () => me });
  assert.deepEqual(LP.wornPowers(me).map((p) => p.id), ['the-hourlock'], 'its power worn');
  const f = foe();
  const base = LP.lootBlow(h, 100, me, f, {});
  const land = () => { const d = LP.lootBlow(h, 100, me, f, {}); LP.lootStrike(me, f, d, h); return d; };
  assert.deepEqual([land(), land(), land(), land(), land(), land()], [base, base, base + 100, base, base, base + 100], 'one, two - and the third tolls; and again');
  // a shot asked and never landed counts nothing
  LP.lootBlow(h, 100, me, f, {}); LP.lootBlow(h, 100, me, f, {});
  assert.deepEqual([land(), land(), land()], [base, base, base + 100], 'misses between are not shots that landed');
  // another weapon in the hand: its blows neither toll nor move the count
  const other = createWeapon(120, 1);
  land(); land();
  for (let i = 0; i < 4; i++) { const d = LP.lootBlow(other, 100, me, f, {}); assert.equal(d, LP.lootBlow(other, 100, me, f, {})); LP.lootStrike(me, f, d, other); }
  assert.equal(land(), base + 100, 'the Hourlock\'s third, whatever fell between');
  land(); land();
  setSetsDueling(true);
  assert.deepEqual(LP.wornPowers(me), [], 'asleep in a duel');
  assert.ok(LP.lootBlow(h, 100, me, f, {}) < base + 100, 'a duel\'s third rings nothing');
  setSetsDueling(false);
  setPref('lootRarity', false);
  assert.deepEqual(LP.wornPowers(me), [], 'off: nothing');
  setPref('lootRarity', true);
});

test('GILDED1 THE HOUR TOLLS - THE PELLET BACK: a foe the Hourlock\'s landed shot fells (its kill within TOLL_REFUND_S) gives one pellet back, once; a foe it did not strike, a fall past the bound, or a foe it struck before another shot of its gives none (mutants: no refund; any kill refunds)', () => {
  fresh();
  const me = player();
  const h = wear(me, mintHourlock());
  me.items.push(createPellets(5));
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], player: () => me });
  const a = foe(), b = foe();
  const shoot = (f) => { const d = LP.lootBlow(h, 100, me, f, {}); LP.lootStrike(me, f, d, h); };
  T = 10; shoot(a);
  T = 10.4; reportPlayerKill(a);
  assert.equal(pelletCount(me.items), 6, 'its felling shot back');
  reportPlayerKill(a);
  assert.equal(pelletCount(me.items), 6, 'once');
  T = 20; shoot(a);
  T = 20 + LP.TOLL_REFUND_S + 0.5; reportPlayerKill(a);
  assert.equal(pelletCount(me.items), 6, 'a fall past the bound is not the shot\'s');
  T = 30; shoot(a); T = 30.2; shoot(b);
  T = 30.3; reportPlayerKill(a);
  assert.equal(pelletCount(me.items), 6, 'the last shot was another foe\'s');
  reportPlayerKill(b);
  assert.equal(pelletCount(me.items), 7, 'and that foe\'s fall gives it back');
  T = 40; reportPlayerKill(foe());
  assert.equal(pelletCount(me.items), 7, 'a foe it never struck gives nothing');
  // not worn: no power, no refund
  fresh();
  const you = player();
  you.items.push(mintHourlock(), createPellets(5));
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], player: () => you });
  const c = foe();
  LP.lootStrike(you, c, 100, you.items[0]); reportPlayerKill(c);
  assert.equal(pelletCount(you.items), 5, 'carried, not worn: nothing');
});

// ── the look ──────────────────────────────────────────────────────────

test('GILDED1 THE LOOK: named as an artifact is (no metal before it); its card the tier, its four lines, its power and its lore; its quickslot key its record\'s; the codex says its first find and keeps it, a save round-trips it and a forged id is dropped (mutants: the metal prefix; the codex blind to it)', () => {
  on();
  const h = mintHourlock();
  assert.equal(itemLongName(h), 'The Hourlock');
  assert.deepEqual(LR.rarityLines(h), ['Gilded', '+40% damage', '+15 Agility', '+30 Archery', '+10 Shock damage',
    `${HOUR_TOLLS.name}: ${HOUR_TOLLS.brief}`, HOURLOCK.lore]);
  assert.ok(quickslotKey(h).endsWith('|gthe-hourlock'), 'its record in its key');
  assert.ok(!quickslotKey(createThunderlock()).includes('|g'), 'and nothing new in another piece\'s - a save\'s keys still resolve');
  // the codex
  const lines = [];
  const off = registerPresenter({ priority: 99, hudText: (t) => { lines.push(t); return true; } });
  try {
    assert.deepEqual(CX.codexKey(h), { kind: 'gilded', id: 'the-hourlock' });
    assert.deepEqual(CX.codexGilded().map((r) => [r.id, r.found, r.name, r.hint]), [['the-hourlock', false, null, CX.GILDED_HINT]], 'listed, unfound, by its hint alone');
    assert.equal(CX.noteFind(h), true);
    assert.deepEqual(lines, ['The Hourlock - a Gilded piece! It joins your codex.']);
    assert.equal(CX.noteFind(mintHourlock()), false, 'once');
    const row = CX.codexGilded()[0];
    assert.deepEqual([row.found, row.name, row.power, row.lore], [true, 'The Hourlock', HOUR_TOLLS, HOURLOCK.lore]);
    assert.deepEqual(CX.codexCount().gilded, 1);
  } finally { off(); }
  const rec = modSaveRecords()[CX.CODEX_SAVE_VENDOR];
  assert.deepEqual(Object.keys(rec.gilded), ['the-hourlock']);
  CX._resetCodexForTests();
  restoreModSaveRecords({ [CX.CODEX_SAVE_VENDOR]: { legendary: {}, aetheric: {}, gilded: { 'the-hourlock': 12, 'no-such': 3 } } });
  assert.deepEqual(CX.foundIds('gilded'), ['the-hourlock'], 'an unknown id dropped');
  assert.equal(CX.foundDay('gilded', 'the-hourlock'), 12);
  restoreModSaveRecords({ [CX.CODEX_SAVE_VENDOR]: { legendary: {}, aetheric: {} } });
  assert.deepEqual(CX.foundIds('gilded'), [], 'a save from before it: none found');
});

test('GILDED1 THE ART: in a list the gold gun (record 3), on the doll the gold layer (record 2) - the plain gun its own two - through the one door every slot asks; in the Morrowind hand its gold twin; in the classic hand the rig keys its frames apart (mutants: the gold forgotten in a list; the twin never worn)', () => {
  const h = mintHourlock(), g = createThunderlock();
  assert.deepEqual(ART_RECORDS, { doll: 0, icon: 1, gildedDoll: 2, gildedIcon: 3 });
  assert.deepEqual([thunderlockImageRecord(h, false), thunderlockImageRecord(h, true), thunderlockImageRecord(g, false), thunderlockImageRecord(g, true)], [3, 2, 1, 0]);
  assert.equal(inventoryItemImage(h).record, ART_RECORDS.gildedIcon, 'a list: the door every slot asks');
  assert.equal(inventoryItemImage(g).record, ART_RECORDS.icon);
  assert.equal(ownItemImage(h, { forPaperDoll: true }).record, ART_RECORDS.gildedDoll);
  assert.equal(ownItemImage(createWeapon(120, 1)), null, 'a classic weapon: DFU\'s ladder, as before');
  assert.equal(ownWeaponModelFor(h).model, 'thunderlock_gilded.nif');
  assert.equal(ownWeaponModelFor(g).model, 'thunderlock.nif');
  assert.equal(ownWeaponModelFor(h).bone, ownWeaponModelFor(g).bone, 'the same bone, the same hold');
  const rig = strip(read('src/combat/weaponRig.js'));
  assert.match(rig, /const gilded = thunderlock && item\?\.rarity === 'gilded';/);
  assert.match(rig, /loadThunderlockArt\(renderer, \{ magic: type === WEAPON_TYPES\.Thunderlock_Magic, gilded \}\)/);
});

/** A frame like the sheet's idle: a glove (pink-leaning brown) entering at the foot's left, the gun (brass, yellow-leaning)
 *  above it to the right, and a small glove-hued crevice in the gun that touches nothing. */
function sketch() {
  const w = 120, h = 80, data = new Uint8ClampedArray(w * h * 4);
  const put = (x, y, [r, g, b]) => { const o = (y * w + x) * 4; data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255; };
  for (let y = 10; y < 50; y++) for (let x = 30; x < 115; x++) put(x, y, [176, 140, 52]);   // the brass
  for (let y = 30; y < 34; y++) for (let x = 90; x < 94; x++) put(x, y, [92, 58, 50]);       // a crevice, glove-hued
  for (let y = 45; y < 80; y++) for (let x = 5; x < 45; x++) put(x, y, [120, 72, 60]);       // the glove, to the foot
  return { width: w, height: h, data };
}
const at = (img, x, y) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

test('GILDED1 THE GOLD IN THE HAND: the classic sprite\'s gilding finds the glove by its pink lean over a neighbourhood AND its way in at the foot\'s left, and spares it; the brass is gilded, a glove-hued crevice of the gun too (it touches nothing); the flash and smoke outside the idle silhouette and every alpha are left alone (mutants: the hand never found; alpha written)', () => {
  const idle = sketch();
  const hand = handMask(idle);
  assert.equal(hand[70 * idle.width + 20], 1, 'the glove at the foot');
  assert.equal(hand[52 * idle.width + 40], 1, 'and up its wrist');
  assert.equal(hand[20 * idle.width + 100], 0, 'the brass is not the hand');
  assert.equal(hand[31 * idle.width + 91], 0, 'a crevice that touches nothing is the gun\'s');
  const keep = gildKeep(idle);
  assert.equal(keep[70 * idle.width + 20], 0);
  assert.equal(keep[20 * idle.width + 100], 1);
  assert.equal(keep[5 * idle.width + 5], 0, 'nothing drawn, nothing kept');
  const frame = sketch();
  const flash = (y, x) => { const o = (y * frame.width + x) * 4; frame.data.set([255, 250, 230, 200], o); };
  flash(5, 116); flash(6, 117);
  const glove = at(frame, 20, 70), brass = at(frame, 100, 20), smoke = at(frame, 116, 5);
  gildFrame(frame, keep);
  assert.deepEqual(at(frame, 20, 70), glove, 'the glove as it was');
  assert.deepEqual(at(frame, 116, 5), smoke, 'the flash as it was');
  const gold = at(frame, 100, 20);
  assert.notDeepEqual(gold, brass, 'the brass gilded');
  assert.equal(gold[3], 255, 'alpha never written');
  assert.ok(gold[0] >= gold[1] && gold[1] > gold[2] * 1.4, `gold leaf: ${gold}`);
  assert.equal(GILD.passes, 2);
  for (let i = 1; i < GILD_RAMP.length; i++) assert.ok(GILD_RAMP[i].reduce((s, v) => s + v) > GILD_RAMP[i - 1].reduce((s, v) => s + v), 'the ramp climbs');
});
