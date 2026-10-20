// GILDED2 (2026-10-15; bible/06-Systems/Gilded.md section 7; Mac: "With the introduction of elite dungeons soon. I want to
// enhance the rewards for each world activety. We need to add a rare gilded weapon to the oblivion gates. A gilded weapon
// to the serpent") - THE WORLD'S TWO GILDED. The laws pinned:
//   - THE RECORDS: the Dragonfire Oath (a Daedric Dai-Katana) and the Sunken Sovereign (an Ebony Saber), after the
//     Hourlock - four lines each at the Legendary band's TOP and no higher, a power each, frozen whole.
//   - THE MINT: a DFU weapon's own (CreateWeapon), whole, known and priced; the wire takes it exactly as minted and
//     refuses one number off; the Hourlock's mint is the gun's still.
//   - THE DROPS: one draw each, one in a hundred - the gate Warden's spoils' very last, and a dealing ship's serpent
//     hoard's very last (a ship that stood never), so every spoils before them is what it was for its seed.
//   - DRAGONFIRE: a landed blow on a Daedra bursts on every OTHER Daedra within 3 m for a third of it, unresisted - never
//     on another kind of foe, never from a blow on one.
//   - UNDERTOW: its landed blows on a foe are counted on THAT foe, +10% a blow up to +50%; a foe it fells heals 10%.
//   - THE LOOK: named as an artifact is, its card's lines and power, its codex row's own hint.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as LP from '../../src/systems/loot/lootPowers.js';
import * as CX from '../../src/systems/loot/lootCodex.js';
import {
  GILDED, GILDED_WORTH, GILDED_RECORDS, HOURLOCK, DRAGONFIRE_OATH, SUNKEN_SOVEREIGN, DRAGONFIRE, UNDERTOW,
  GATE_GILDED_CHANCE, SERPENT_GILDED_CHANCE, gildedById, mintGilded, mintHourlock, rollDragonfireOath, rollSunkenSovereign,
  validGildedMarks,
} from '../../src/systems/gilded.js';
import { createThunderlock } from '../../src/systems/thunderlock.js';
import { WEAPON_MATERIALS, WEAPONS } from '../../src/characters/weapons.js';
import { SKILLS } from '../../src/systems/skills.js';
import { itemBaseValue } from '../../src/systems/item/itemTemplates.js';
import { validLootItem } from '../../src/systems/loot/loot.js';
import { itemLongName } from '../../src/systems/item/itemInfo.js';
import { BRIEF_MAX, setSetsDueling, _resetSigilSetsForTests } from '../../src/systems/sigil/sigilSets.js';
import { _resetSetPowersForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { reportPlayerKill } from '../../src/systems/playerKills.js';
import { equipItem } from '../../src/systems/equip.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { rollSpoils } from '../../src/systems/gate/gateSpoils.js';
import { rollSerpentSpoils } from '../../src/systems/serpent/serpentSpoils.js';
import { spoilsList } from '../../src/scenes/spoilsPool.js';   // AUDIT WORLD-REWARDS A1: the floor's pictures
import { RANDOM_TREASURE_ICONS } from '../../src/systems/loot/loot.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { SPOILS_GLOW_MAX } from '../../src/render/spoilsGlow.js';
import { salvageRefusal, reforgeRefusal } from '../../src/systems/reforge.js';
import { itemMakerRefuses } from '../../src/systems/enchanting.js';
import { EFFECT_FLAGS } from '../../src/systems/spellcast.js';
import { setPlayerDoor, takeOwed } from '../../src/systems/playerDoor.js';   // AUDIT WORLD-REWARDS B1: a relay body's burn, owed to its claim

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const on = () => { _resetForTests(); setPref('lootRarity', true); CX._resetCodexForTests(); };
const wire = (it) => validLootItem(JSON.parse(JSON.stringify(it)));
const counted = (fn) => { const c = { n: 0 }; c.rolls = () => { c.n++; return fn(); }; return c; };
const lines = (r) => r.affixes.map((a) => [a.id, a.param ?? null, a.value]);

// ── the records ───────────────────────────────────────────────────────

test('GILDED2 THE RECORDS: the Hourlock, then the gate\'s Dragonfire Oath (a Daedric Dai-Katana: +40% damage, +15 Strength, +30 Long Blade, +15 Endurance - AUDIT WORLD-REWARDS B1: no slayer) and the serpent\'s Sunken Sovereign (an Ebony Saber: +40% damage, +15 Agility, +30 Long Blade, 10% leech) - every line the Legendary band\'s TOP and no higher, a power each, frozen whole (mutants: a line over the band; the Oath\'s make; the Sovereign\'s slayer)', () => {
  assert.deepEqual(GILDED_RECORDS, [HOURLOCK, DRAGONFIRE_OATH, SUNKEN_SOVEREIGN]);
  assert.deepEqual(GILDED_RECORDS.map((r) => r.id), ['the-hourlock', 'the-dragonfire-oath', 'the-sunken-sovereign']);
  assert.equal(new Set(GILDED_RECORDS.map((r) => r.id)).size, 3, 'three ids');
  for (const r of [DRAGONFIRE_OATH, SUNKEN_SOVEREIGN]) {
    assert.equal(gildedById(r.id), r);
    assert.equal(r.group, 'Weapons');
    assert.equal(LR.legendaryById(r.id), null, `${r.id}: no Legendary's id - the ladder's one door reads the Gilded last`);
    for (const a of r.affixes) {
      assert.ok(LR.validAffix(a), `${r.id} ${a.id}: a line the ladder carries`);
      assert.equal(a.value, LR.AFFIX_RANGES[a.id].legendary[1], `${r.id} ${a.id}: the Legendary band's top - powerful, never past it`);
    }
    assert.ok(Object.isFrozen(r) && Object.isFrozen(r.affixes) && r.affixes.every((a) => Object.isFrozen(a)) && Object.isFrozen(r.power), `${r.id}: frozen whole`);
    assert.ok(r.power.brief.length <= BRIEF_MAX, `"${r.power.brief}" fits the card's row`);
    assert.equal(LR.powerOf(r.id), r.power, 'the ladder reads its power through the one door');
    assert.ok(r.lore && r.hint, 'its lore and its own hint');
  }
  assert.deepEqual([DRAGONFIRE_OATH.name, DRAGONFIRE_OATH.templateIndex, DRAGONFIRE_OATH.material], ['The Dragonfire Oath', WEAPONS.Dai_Katana, WEAPON_MATERIALS.Daedric]);
  assert.deepEqual(lines(DRAGONFIRE_OATH), [['damage', null, 40], ['stat', 'strength', 15], ['skill', SKILLS.LongBlade, 30], ['stat', 'endurance', 15]]);
  assert.deepEqual([SUNKEN_SOVEREIGN.name, SUNKEN_SOVEREIGN.templateIndex, SUNKEN_SOVEREIGN.material], ['The Sunken Sovereign', WEAPONS.Saber, WEAPON_MATERIALS.Ebony]);
  assert.deepEqual(lines(SUNKEN_SOVEREIGN), [['damage', null, 40], ['stat', 'agility', 15], ['skill', SKILLS.LongBlade, 30], ['leech', null, 10]]);
  assert.equal(DRAGONFIRE_OATH.power, DRAGONFIRE);
  assert.deepEqual({ kind: DRAGONFIRE.kind, group: DRAGONFIRE.group, share: DRAGONFIRE.share, metres: DRAGONFIRE.metres }, { kind: 'dragonfire', group: 'daedra', share: 33, metres: 3 });
  assert.equal(SUNKEN_SOVEREIGN.power, UNDERTOW);
  assert.deepEqual({ kind: UNDERTOW.kind, pct: UNDERTOW.pct, max: UNDERTOW.max, seconds: UNDERTOW.seconds, heal: UNDERTOW.heal }, { kind: 'undertow', pct: 10, max: 5, seconds: 6, heal: 10 });
});

// ── the mint ──────────────────────────────────────────────────────────

test('GILDED2 THE MINT: a DFU weapon\'s own (CreateWeapon - its make, its span, its condition), named, Gilded, its lines a copy, KNOWN, priced over its make by its lines and GILDED_WORTH; the wire takes it exactly and refuses one number off, a line short, a material or template not its own and any mark another door lays; the Hourlock\'s mint stays the gun\'s (mutants: the Thunderlock for every record)', () => {
  on();
  for (const r of [DRAGONFIRE_OATH, SUNKEN_SOVEREIGN]) {
    const it = mintGilded(r), plain = createWeapon(r.templateIndex, r.material);
    assert.deepEqual([it.templateIndex, it.material, it.group, it.minDamage, it.maxDamage, it.maxCondition], [plain.templateIndex, plain.material, plain.group, plain.minDamage, plain.maxDamage, plain.maxCondition], `${r.id}: CreateWeapon's own`);
    assert.deepEqual([it.name, it.rarity, it.gilded, it.isIdentified], [r.name, GILDED, r.id, true]);
    assert.deepEqual(it.affixes, r.affixes.map((a) => ({ ...a })));
    assert.notEqual(it.affixes[0], r.affixes[0], 'a copy, never the record\'s own');
    assert.equal(it.value, itemBaseValue(it) + LR.affixesWorth(it.affixes) + GILDED_WORTH);
    assert.notEqual(mintGilded(r), mintGilded(r), 'a fresh item every call');
    assert.ok(validGildedMarks(it) && wire(it), `${r.id}: the wire takes it as minted`);
    const off = (f) => { const c = JSON.parse(JSON.stringify(it)); f(c); return c; };
    assert.equal(wire(off((c) => { c.affixes[0].value = 39; })), null, 'one number off is a forgery');
    assert.equal(wire(off((c) => { c.affixes.pop(); })), null, 'a line short');
    assert.equal(wire(off((c) => { c.material = WEAPON_MATERIALS.Iron; })), null, 'another make');
    assert.equal(wire(off((c) => { c.templateIndex = WEAPONS.Longsword; })), null, 'another weapon');
    assert.equal(wire(off((c) => { c.honed = 1; })), null, 'a mark another door lays');
    assert.equal(salvageRefusal(it), 'gilded', 'never salvaged');
    assert.ok(reforgeRefusal(it), 'never reforged');
    assert.equal(itemMakerRefuses(it), true, 'never the item maker\'s');
  }
  const h = mintHourlock();
  assert.equal(h.templateIndex, createThunderlock().templateIndex, 'the Hourlock is the gun\'s mint still');
  assert.equal(h.value, 39740, 'and its price what every gift of it was minted at');
});

// ── the drops ─────────────────────────────────────────────────────────

test('GILDED2 THE DROPS: ONE draw each, always - under its chance its record, else nothing; one in a hundred (mutants: the chances)', () => {
  on();
  assert.deepEqual([GATE_GILDED_CHANCE, SERPENT_GILDED_CHANCE], [1 / 100, 1 / 100]);
  for (const [roll, chance, id] of [[rollDragonfireOath, GATE_GILDED_CHANCE, 'the-dragonfire-oath'], [rollSunkenSovereign, SERPENT_GILDED_CHANCE, 'the-sunken-sovereign']]) {
    const yes = counted(() => chance - 1e-9), no = counted(() => chance);
    assert.equal(roll(yes.rolls)?.gilded, id);
    assert.equal(roll(no.rolls), null);
    assert.deepEqual([yes.n, no.n], [1, 1], 'one draw, whatever it answers - the spoils\' stream never shifts');
  }
});

test('GILDED2 THE GATE\'S AND THE SERPENT\'S: the Oath the Warden\'s spoils\' LAST piece, the Sovereign a dealing ship\'s hoard\'s - a ship that stood never - each about one in a hundred, after even the technique pass (mutants: the Oath before the passes; the Sovereign to a ship that stood)', () => {
  on();
  let oath = 0, sov = 0;
  const N = 4000;
  for (let i = 1; i <= N; i++) {
    const k = (i * 2654435761) >>> 0;
    const g = rollSpoils(k, 15);
    const gi = g.pieces.findIndex((p) => p.tier === GILDED);
    if (gi >= 0) {
      oath++;
      assert.equal(gi, g.pieces.length - 1, `seed ${k}: the Oath leaves last`);
      assert.equal(g.pieces[gi].item.gilded, 'the-dragonfire-oath');
      assert.deepEqual(g.pieces[gi].item.affixes, DRAGONFIRE_OATH.affixes.map((a) => ({ ...a })), 'no pass reached it');
      assert.ok(wire(g.pieces[gi].item), 'and the wire takes it');
    }
    const s = rollSerpentSpoils(k, 15, 'dealt');
    const si = s.pieces.findIndex((p) => p.tier === GILDED);
    if (si >= 0) {
      sov++;
      assert.equal(si, s.pieces.length - 1, `seed ${k}: the Sovereign leaves last`);
      assert.equal(s.pieces[si].item.gilded, 'the-sunken-sovereign');
      assert.ok(wire(s.pieces[si].item));
    }
    assert.ok(!rollSerpentSpoils(k, 15, 'stood').pieces.some((p) => p.tier === GILDED), 'a ship that stood: never');
  }
  assert.ok(oath > 0 && Math.abs(oath / N - GATE_GILDED_CHANCE) < 0.006, `the Oath ${oath} of ${N}`);
  assert.ok(sov > 0 && Math.abs(sov / N - SERPENT_GILDED_CHANCE) < 0.006, `the Sovereign ${sov} of ${N}`);
  // the very last draw of each - after the technique pass, so every spoils before it is what it was for its seed
  assert.match(strip(read('src/systems/gate/gateSpoils.js')), /techniquePass\(pieces\.map\(\(p\) => p\.item\), rolls\);\s*const oath = rollDragonfireOath\(rolls\);\s*if \(oath\) pieces\.push\(\{ item: oath, tier: oath\.rarity \}\);\s*const more = \[\];\s*for \(const bit of SPOILS_PORTENT_BITS\) if \(\(p & bit\) !== 0\) more\.push\(graded\(spoilsBase\(lv, rolls\), magicOrBetter\(rolls\), rolls\)\);[\s\S]{0,700}?return \{ gold, pieces, sigil: sigilStone\(\), card, gems, portent: more\.length \};/);   // PIN MOVED (WB14g): still the plain spoils' last draw - a portent night's pieces after it, drawn only for a receipt's `p` (test/net/gate/wb14g_pays.test.js)   // PIN MOVED (AUDIT WB14 PLAY-7): and the passes over a portent's pieces alone, after them
  for (const [f, fn] of [['src/systems/gate/gateSpoils.js', 'rollDragonfireOath'], ['src/systems/serpent/serpentSpoils.js', 'rollSunkenSovereign']]) {
    assert.equal(strip(read(f)).split(`${fn}(`).length - 1, 1, `${f}: ONE draw of it, and only there`);
  }
  assert.match(strip(read('src/systems/serpent/serpentSpoils.js')), /techniquePass\(pieces\.map\(\(p\) => p\.item\), rolls\);\s*const sovereign = dealt \? rollSunkenSovereign\(rolls\) : null;\s*if \(sovereign\) pieces\.push\(\{ item: sovereign, tier: sovereign\.rarity \}\);\s*return \{ gold, pieces, embers: serpentEmbers\(\), card, gems \};/);
});

test('GILDED2 THE FLOOR (AUDIT WORLD-REWARDS A1): in a spoils the Oath came in, every other picture is the one the seed gave it - the pieces\', the ember\'s, the gold\'s, the card\'s and the gems\' - and the Oath\'s is drawn LAST; the Oath still leaves among the pieces, inside the glow\'s eight (mutants: the Oath\'s picture in its place)', () => {
  on();
  let n = 0;
  for (let i = 1; i <= 6000 && n < 12; i++) {
    const k = (i * 2654435761) >>> 0;
    const list = spoilsList(k, 5);
    const at = list.findIndex((e) => e.item?.gilded === 'the-dragonfire-oath');
    if (at < 0) continue;
    n++;
    const look = seededRng((k ^ 0x5eed) >>> 0), flat = () => RANDOM_TREASURE_ICONS[Math.floor(look() * RANDOM_TREASURE_ICONS.length)];
    const pieces = list.filter((e) => e.kind === 'item' && e.tier !== 'aetheric' && e.tier !== 'artifact' && e.tier !== 'common' && e.tier !== 'gilded');
    const regalia = list.filter((e) => e.tier === 'aetheric' && e.item?.aetheric);
    const card = list.filter((e) => e.tier === 'aetheric' && !e.item?.aetheric), gems = list.filter((e) => e.kind === 'item' && e.tier === 'common');
    const ember = list.find((e) => e.tier === 'artifact'), gold = list.find((e) => e.kind === 'gold');
    const want = [...pieces, ...regalia].map(() => flat());
    assert.deepEqual([...pieces, ...regalia].map((e) => e.record), want, `seed ${k}: the pieces' pictures, the seed's`);
    assert.deepEqual([ember.record, gold.record], [flat(), flat()], `seed ${k}: the ember's and the gold's, the seed's`);
    assert.deepEqual([...card, ...gems].map((e) => e.record), [...card, ...gems].map(() => flat()), `seed ${k}: the card's and the gems', the seed's`);
    assert.equal(list[at].record, flat(), `seed ${k}: the Oath's, last`);
    assert.ok(at < SPOILS_GLOW_MAX, `seed ${k}: the Oath inside the glow's eight (at ${at})`);
  }
  assert.ok(n >= 5, `Oath spoils seen (${n})`);
});

// ── the powers ────────────────────────────────────────────────────────

let T = 0;
LP._setLootPowersClockForTests(() => T);
const fresh = () => {
  on(); LP._resetLootPowersForTests(); _resetSetPowersForTests(); _resetSigilSetsForTests();
  setPlayerDoor(null); T = 0; LP.setLootPowersVoice({ say: () => {} });
};
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 20, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 50, maxMagicka: 100, goldPieces: 0 });
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };
const foe = (careerIndex, extra = {}) => ({ careerIndex, career: {}, health: 100, maxHealth: 100, level: 10, ...extra });
const rec = (name, entity, x, z = 0) => ({ name, entity, ai: { feet: [x, 0, z] }, dead: false });
const DAEDROTH = 27, FIRE_DAEDRA = 26, ORC = 7;

test('GILDED2 DRAGONFIRE: a landed blow of the Oath on a Daedra burns it again for a third, and every OTHER Daedra within 3 m for as much, unresisted (a fire-immune Daedra takes it whole) - never another kind of foe, never past 3 m, never from a blow on a foe that is not one; AUDIT WORLD-REWARDS B1: a body the relay runs (no record - the gate\'s Warden, his host, an Elite Gate\'s legion) takes its burn OWED to its blow\'s own claim, and no other is reached from it; B3: a blow the ward turns, nothing; another weapon\'s blows nothing; asleep in a duel (mutants: every foe burns; the struck one spared; the element\'s share taken; the relay\'s body unburnt; the ward\'s blow answered)', () => {
  fresh();
  const me = player();
  const oath = wear(me, mintGilded(DRAGONFIRE_OATH));
  const struck = foe(DAEDROTH), near1 = foe(FIRE_DAEDRA, { career: { immunityFlags: EFFECT_FLAGS.Fire } }), near2 = foe(29), far = foe(31), past = foe(25), orc = foe(ORC), human = foe(0, { affinity: 'Human' });
  const foes = [rec('struck', struck, 0), rec('near1', near1, 1.5), rec('near2', near2, 0, 2.9), rec('far', far, 3.4), rec('past', past, 3.05), rec('orc', orc, 1)];   // AUDIT WORLD-REWARDS E4: one just past 3 m
  const hurts = [];
  setPlayerDoor({ foes: () => foes.filter((f) => !f.dead), feet: () => [0, 0, 0], hurtFoe: (f, n) => hurts.push([f.name, n]), player: () => me });
  assert.deepEqual(LP.wornPowers(me).map((p) => p.id), ['the-dragonfire-oath']);
  assert.equal(LP.foeGroup(struck), 'daedra');
  LP.lootStrike(me, struck, 90, oath);
  assert.deepEqual(hurts.sort(), [['near1', 30], ['near2', 30], ['struck', 30]], 'a third again to the struck Daedra, a third to each within 3 m - unresisted, the orc and the far one untouched');
  assert.equal(LP.elementShare(near1, 'fire'), 0, 'the fire-immune one, immune to any flame but this');
  hurts.length = 0;
  LP.lootStrike(me, orc, 90, oath);
  assert.deepEqual(hurts, [], 'a blow on a foe that is no Daedra burns nothing');
  foes.push(rec('human', human, 0.5));
  LP.lootStrike(me, human, 90, oath);
  assert.deepEqual(hurts, [], 'nor on a class foe');
  const other = createWeapon(WEAPONS.Longsword, 1);
  LP.lootStrike(me, struck, 90, other);
  assert.deepEqual(hurts, [], 'another weapon\'s blows nothing');
  setSetsDueling(true);
  LP.lootStrike(me, struck, 90, oath);
  assert.deepEqual(hurts, [], 'asleep in a duel');
  setSetsDueling(false);
  // B1: a body the relay runs - the Warden's stand-in, a Ward-Bearer of his host - is no record of the door: its burn is
  // OWED to the claim its blow sends (dungeonContext.js landOnBoss/landOnHost take it), and no other is reached from it
  const warden = foe(31);
  LP.lootStrike(me, warden, 90, oath);
  assert.deepEqual(hurts, [], 'no record, no burst');
  assert.equal(takeOwed(warden), 30, 'its burn rides its own claim');
  assert.equal(takeOwed(warden), 0, 'taken once');
  // B3: a blow the ward turns - the strike told before the court turns it - burns nothing and owes nothing
  warden.warded = true;
  LP.lootStrike(me, warden, 90, oath);
  assert.equal(takeOwed(warden), 0, 'the ward turned it whole');
  assert.equal(LP.lootBlow(oath, 100, me, struck, {}), 100, 'no slayer line now - the burn is its edge on a Daedra');
});

test('GILDED2 UNDERTOW: the Sovereign\'s landed blows on a foe are that foe\'s - +10% a blow before, up to +50%, for 6 s from the last (B4: let go after); another foe starts at nought; a blow asked and never landed counts nothing, nor one the ward turns (B3); a foe it fells (within TOLL_REFUND_S of its last landed blow on it) heals 10% of my health, once - and each foe one swing fells, its own (B2); another weapon neither reads nor moves it (mutants: no cap; one count for every foe; no heal; any kill heals; no window; one heal a swing)', () => {
  fresh();
  const me = player();
  const sov = wear(me, mintGilded(SUNKEN_SOVEREIGN));
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], player: () => me });
  assert.deepEqual(LP.wornPowers(me).map((p) => p.id), ['the-sunken-sovereign']);
  const a = foe(ORC), b = foe(ORC);
  const land = (f) => { const d = LP.lootBlow(sov, 100, me, f, {}); LP.lootStrike(me, f, d, sov); return d; };
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(() => land(a)), [100, 110, 120, 130, 140, 150, 150], 'ten a blow before it, never past fifty');
  assert.equal(land(b), 100, 'another foe starts at nought');
  LP.lootBlow(sov, 100, me, b, {}); LP.lootBlow(sov, 100, me, b, {});
  assert.equal(land(b), 110, 'blows asked and never landed count nothing');
  const other = createWeapon(WEAPONS.Longsword, 1);
  assert.equal(LP.lootBlow(other, 100, me, a, {}), 100, 'another weapon reads none of it');
  LP.lootStrike(me, b, 100, other);
  assert.equal(land(b), 120, 'nor moves it');
  // TWO-HANDS (AUDIT 2): a landed blow that does not count whole (an off-hand blow's share of the time - formulas.js
  // `blow`) drags nothing deeper
  LP.lootStrike(me, b, 100, sov, { blow: false });
  assert.equal(LP.lootBlow(sov, 100, me, b, {}), 130, 'no stack from a blow that does not count whole (the three landed before it, its +30%)');
  // B4: the tide lets go - six seconds from the last landed blow on it, the foe is at nought again
  T = 5.9;
  assert.equal(LP.lootBlow(sov, 100, me, a, {}), 150, 'held while the tide holds');
  T = 6.1;
  assert.equal(LP.lootBlow(sov, 100, me, a, {}), 100, 'let go past it');
  assert.equal(land(a), 100, 'and it starts again from nought');
  // B3: a blow the ward turns counts nothing
  const w = foe(31, { warded: true });
  for (let i = 0; i < 4; i++) land(w);
  w.warded = false;
  assert.equal(LP.lootBlow(sov, 100, me, w, {}), 100, 'the ward\'s blows dragged nothing');
  // the kill: the tide's heal
  me.health = 50;
  T = 10; land(a); const after = me.health;   // its leech heals a little of the blow itself
  T = 10.4; reportPlayerKill(a);
  assert.equal(me.health, after + 10, 'a foe it fells: 10% of my health back');
  reportPlayerKill(a);
  assert.equal(me.health, after + 10, 'once');
  const c = foe(ORC);
  T = 20; land(c); const before = me.health;
  T = 20 + LP.TOLL_REFUND_S + 0.5; reportPlayerKill(c);
  assert.equal(me.health, before, 'a fall past the bound is not its');
  T = 30; reportPlayerKill(foe(ORC));
  assert.equal(me.health, before, 'a foe it never struck heals nothing');
  // B2: one swing strikes two, then the hosts fell them - each its own heal
  me.health = 40;
  const d = foe(ORC), e = foe(ORC);
  T = 40; land(d); land(e); const swung = me.health;
  T = 40.2; reportPlayerKill(d); reportPlayerKill(e);
  assert.equal(me.health, swung + 20, 'two felled, two heals');
});

// ── the look ──────────────────────────────────────────────────────────

test('GILDED2 THE LOOK: named as an artifact is (no metal before it); its card the tier, its four lines, its power and its lore; the codex lists all three at the rung\'s head, each unfound by its OWN hint, and says the first find (mutants: one hint for all)', () => {
  on();
  const o = mintGilded(DRAGONFIRE_OATH), s = mintGilded(SUNKEN_SOVEREIGN);
  assert.equal(itemLongName(o), 'The Dragonfire Oath');
  assert.equal(itemLongName(s), 'The Sunken Sovereign');
  for (const [it, r] of [[o, DRAGONFIRE_OATH], [s, SUNKEN_SOVEREIGN]]) {
    assert.deepEqual(LR.rarityLines(it), ['Gilded', ...r.affixes.map((a) => LR.affixLabel(a)), `${r.power.name}: ${r.power.brief}`, r.lore]);
  }
  assert.deepEqual(CX.codexGilded().map((r) => [r.id, r.found, r.name, r.hint]), [
    ['the-hourlock', false, null, CX.GILDED_HINT],
    ['the-dragonfire-oath', false, null, DRAGONFIRE_OATH.hint],
    ['the-sunken-sovereign', false, null, SUNKEN_SOVEREIGN.hint],
  ], 'listed, unfound, each by its own hint');
  assert.notEqual(DRAGONFIRE_OATH.hint, CX.GILDED_HINT);
  assert.equal(CX.noteFind(o), true);
  assert.deepEqual(CX.codexCount().gilded, 1);
  assert.equal(CX.codexGilded()[1].name, 'The Dragonfire Oath');
});
