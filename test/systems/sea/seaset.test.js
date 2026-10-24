// SEA-SET (2026-10-22, the owner: "Build ever single bit of this" - the Eltheric Ocean's Abyss-only gear;
// bible/11-Multiplayer/Sigil-Sets.md section 6h, bible/03-World/Eltheric-Ocean.md SEA-SET): THE ELTHERIC TIDEMAIL - its law,
// its nine pieces, its three powers through SET2's seams and its own ship's door, and where the deep gives it up: a legend
// ended, a ruin's or a vault's pile (systems/sea/seaSpoils.js). tools/mutants/seaset.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  setBlow, setFold, captainsDue, _setSetPowersClockForTests, _resetSetPowersForTests, setSetPowersVoice,
} from '../../../src/systems/sigil/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, SIGIL_STAGES, SIGIL_SET_IDS, SIGIL_POWER_MAX, _resetSigilForTests } from '../../../src/systems/sigil/sigil.js';
import { WORLD_SET_IDS, BRIEF_MAX, SET_STAGE_MAX, setById, raidSetOf, tierValues, _resetSigilSetsForTests } from '../../../src/systems/sigil/sigilSets.js';
import {
  AETHERIC_RECORDS, STARSPUN_SET_PIECES, ELTHERIC_SET_PIECES, ELTHERIC_CHANCE, SERPENT_SET_POWER, TIDEMAIL_SALT, elthericChance, rollElthericPiece,
  aethericMaterial, mintAetheric, validSetMarks, AETHERIC,
} from '../../../src/systems/aetheric.js';
import { seaPlaceBand, seaPileSource, seaPileMore } from '../../../src/systems/sea/seaSpoils.js';
import { setWildHere } from '../../../src/systems/wild/wildZone.js';
import { ETHER_KIND } from '../../../src/systems/wild/etherWild.js';
import { _resetPlayerHealForTests } from '../../../src/systems/playerHeal.js';
import { setPlayerDoor } from '../../../src/systems/playerDoor.js';
import { equipItem } from '../../../src/systems/equip.js';
import { mintCondition } from '../../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { WEAPON_HANDS } from '../../../src/characters/equipRules.js';
import { AFFIX_RANGES } from '../../../src/systems/loot/lootRarity.js';
import { SIGIL_BANDS } from '../../../src/systems/sigil/sigil.js';
import { validLootItem } from '../../../src/systems/loot/loot.js';
import { itemFindings, ITEM_LAW_VERSION } from '../../../src/systems/item/itemLaw.js';
import { BANDS, VEIL_X, LEAGUE_PX, veilhaven, ETHER_WORD } from '../../../src/world/ethericSea.js';
import { synthesizeEtherLocation } from '../../../src/world/etherPlaces.js';
import { LEGENDS } from '../../../src/systems/naval/etherShips.js';
import { mulberry32 } from '../../../src/combat/blood/bloodArt.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({
  isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [],
  health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const BODY = [107, 106, 105, 102, 103, 104, 108];
const XP = SIGIL_STAGES.map((s) => s.xp);
const piece = (templateIndex, set, xp = 0) => {
  const it = mintCondition({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Steel, flags: 0 });
  it.rarity = 'rare';
  it.sigil = { set, party: 1, xp };
  return it;
};
const wearSet = (e, set, n, xp = 0) => { for (const t of BODY.slice(0, n)) { const it = piece(t, set, xp); e.items.push(it); equipItem(e, it); } return e; };
const sword = () => createWeapon(120, 0, () => 0.5);
const RAT = Object.freeze({ name: 'rat' });
let T = 0;
_setSetPowersClockForTests(() => T);
function fresh() {
  _resetSigilForTests(); _resetSigilSetsForTests(); _resetSetPowersForTests(); _resetPlayerHealForTests(); setPlayerDoor(null); T = 0; setWildHere(false);
  setSetPowersVoice({ say: () => {}, sound: () => {} });
}
const online = (renown = 1) => { setSigilOnline(true); setSigilRenown(renown); };
const door = (me) => setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => me });
/** The first whole pixel of a band coming west from the Veil. */
const bandX = (id) => Math.floor(VEIL_X - BANDS.find((b) => b.id === id).from * LEAGUE_PX) - 2;
const place = (px, py, kind = 'ruin', extra = {}) => ({ ...synthesizeEtherLocation({ name: 'T', mapTableData: { mapId: 1, longitude: 0, latitude: 0 }, exterior: { exteriorData: {} } }, { key: `${px},${py}`, cx: 9, cy: 9, px, py, kind, name: 'Old Thal' }), ...extra });

test('SEA-SET THE LAW: the Eltheric Tidemail last of every set - Aetheric, the Drowned Queen its patron, the aether\'s blue its colour, no raiding party\'s, never a world set; Stormwrack, Undertow and the Captain\'s Due at 2, 4 and 6 pieces with the design\'s numbers Faint to Ascendant, every brief inside BRIEF_MAX at every stage (mutants: a tier\'s number; the set\'s place; a world set)', () => {
  assert.deepEqual(SIGIL_SET_IDS.slice(-1), ['eltheric']);
  assert.deepEqual(Object.keys(setById('starspun') ? Object.fromEntries(SIGIL_SET_IDS.map((k) => [k, 1])) : {}).slice(-2), ['starspun', 'eltheric']);
  const s = setById('eltheric');
  assert.deepEqual([s.id, s.name, s.prince, s.colour, s.aetheric, 'raid' in s, s.role],
    ['eltheric', 'The Eltheric Tidemail', 'The Drowned Queen', '#6fcfe6', true, false, 'What the deep gives back to those who sail it']);
  assert.ok(!WORLD_SET_IDS.includes('eltheric'), 'no world drop rolls it');
  assert.ok(![0, 1, 2].some((p) => raidSetOf(p)?.id === 'eltheric'), 'no raiding party pays it');
  assert.deepEqual(s.tiers.map((t) => [t.at, t.key, t.name, t.values]), [
    [2, 'stormwrack', 'Stormwrack', { shock: [10, 30], speed: [2, 6] }],
    [4, 'undertow', 'Undertow', { more: [15, 40] }],
    [6, 'captains-due', "The Captain's Due", { guns: [10, 30], hull: [10, 25] }],
  ]);
  for (const t of s.tiers) for (let st = 0; st <= SET_STAGE_MAX; st++) {
    const b = t.brief(tierValues(t, st));
    assert.ok(b.length <= BRIEF_MAX, `${t.key} at ${st}: "${b}" (${b.length})`);
    assert.ok(!/\S - \S/.test(t.text(tierValues(t, st))), `${t.key}: no dash aside`);
  }
  assert.equal(s.tiers[0].brief(tierValues(s.tiers[0], 0)), '+10 shock resist, +2 Speed');
  assert.equal(s.tiers[1].text(tierValues(s.tiers[1], SET_STAGE_MAX)), `Your weapon deals 40% more damage in the open ${ETHER_WORD} Ocean, and half of that anywhere else`);
  assert.equal(s.tiers[2].brief(tierValues(s.tiers[2], SET_STAGE_MAX)), 'Guns +30%, hull hits -25%');
});

test('SEA-SET THE RECORDS: nine in the places\' order - the seven body pieces, a round shield and a ONE-HANDED Saber (all nine worn at once) - Adamantium, the one metal no other set wears; every affix at the Legendary band\'s middle and the blow the band\'s middle (the Old Coil\'s measure: a world boss\'s ground); never a shock resistance, one resistance of an element at most; AETHERIC_RECORDS ends with them (mutants: a number off the middle; a shock piece; the make; the order)', () => {
  assert.equal(ELTHERIC_SET_PIECES.length, 9);
  assert.deepEqual(ELTHERIC_SET_PIECES.map((r) => [r.group, r.templateIndex]), [...BODY.map((t) => ['Armor', t]), ['Armor', 110], ['Weapons', 119]]);
  assert.equal(WEAPON_HANDS['119'], 'Either', 'the Saber is one-handed - the shield beside it');
  assert.ok(ELTHERIC_SET_PIECES.every((r) => r.set === 'eltheric' && r.make === 'Adamantium' && (r.group !== 'Weapons' || r.power === SERPENT_SET_POWER) && r.id.startsWith('eltheric-')));
  assert.equal(SERPENT_SET_POWER, Math.round((SIGIL_BANDS.legendary[0] + SIGIL_BANDS.legendary[1]) / 2));
  assert.ok(!AETHERIC_RECORDS.filter((r) => r.set !== 'eltheric').some((r) => r.make === 'Adamantium'), 'no other set wears Adamantium');
  const mid = (id) => Math.round((AFFIX_RANGES[id].legendary[0] + AFFIX_RANGES[id].legendary[1]) / 2);
  for (const r of ELTHERIC_SET_PIECES) {
    assert.equal(r.affixes.length, 3, r.id);
    for (const a of r.affixes) assert.equal(a.value, mid(a.id), `${r.id} ${a.id}`);
    assert.ok(r.lore && r.name, r.id);
  }
  const resists = ELTHERIC_SET_PIECES.flatMap((r) => r.affixes.filter((a) => a.id === 'resist').map((a) => a.param));
  assert.deepEqual(resists.sort(), ['fire', 'frost', 'magic', 'poison'], 'one of each element at most, never shock (Stormwrack carries it)');
  assert.deepEqual(AETHERIC_RECORDS.slice(-ELTHERIC_SET_PIECES.length - STARSPUN_SET_PIECES.length), [...STARSPUN_SET_PIECES, ...ELTHERIC_SET_PIECES]);
  assert.equal(new Set(AETHERIC_RECORDS.map((r) => r.id)).size, AETHERIC_RECORDS.length, 'every id its own');
});

test('SEA-SET MINTED AND CHECKED: each record mints Adamantium, Aetheric, known, its set\'s sigil fresh at Faint (the saber\'s with its blow), passes the wire\'s check and item law 11; an affix past its record, another set\'s sigil or another make is no item (mutants: the material; the check; the law\'s records)', () => {
  assert.equal(ITEM_LAW_VERSION, 13);   // PIN MOVED (KETCH): law 13 - the Gilded rung's Ketch pair (Volendrung's Echo, the Ketchmaster's Word) lawful; PIN MOVED (GUNS-UNFOUND): law 12 - the Hourlock lawful as a gilded Dwarven Long Bow and as the Thunderlock minted before, the Sunken Sovereign as the Ebony Saber again and as the Pistolet minted between; PIN MOVED: law 11 (10 on its branch, renumbered past PISTOLET's at the merge)
  for (const r of ELTHERIC_SET_PIECES) {
    const it = mintAetheric(r);
    assert.equal(it.material, aethericMaterial(r));
    assert.equal(it.material, r.group === 'Weapons' ? 6 : ARMOR_MATERIAL.Adamantium, `${r.id}: Adamantium`);
    assert.deepEqual([it.rarity, it.aetheric, it.isIdentified, it.name], [AETHERIC, r.id, true, r.name]);
    assert.deepEqual(it.sigil, r.group === 'Weapons' ? { power: SERPENT_SET_POWER, set: 'eltheric', party: 1, xp: 0 } : { set: 'eltheric', party: 1, xp: 0 });
    assert.ok(validSetMarks(structuredClone(it)), r.id);
    assert.ok(validLootItem(structuredClone(it)), `${r.id}: off the wire`);
    assert.deepEqual(itemFindings(structuredClone(it)), [], `${r.id}: lawful`);
  }
  const forged = mintAetheric(ELTHERIC_SET_PIECES[0]);
  forged.affixes[1].value += 1;
  assert.equal(validSetMarks(forged), null, 'an affix past its record');
  const other = mintAetheric(ELTHERIC_SET_PIECES[1]);
  other.sigil.set = 'starspun';
  assert.equal(validSetMarks(other), null, 'another set\'s sigil');
  const make = mintAetheric(ELTHERIC_SET_PIECES[2]);
  make.material = ARMOR_MATERIAL.Ebony;
  assert.equal(validSetMarks(make), null, 'another make');
  assert.ok(SIGIL_POWER_MAX >= SERPENT_SET_POWER);
});

test('SEA-SET THE DEEP\'S SHARES: a legend\'s - the Deep Aether\'s a quarter, the Abyss\'s every time; a vault\'s a quarter and half; a ruin\'s a twentieth and a tenth; the fleet\'s every time; the Shallows and the Reaches none - and the roll: one draw when nothing drops, two when a piece does, one at a share of 1, none at 0, the same seed choosing which (mutants: a share; the always; the draw)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(ELTHERIC_CHANCE)), { legend: { deep: 0.25, abyss: 1 }, vault: { deep: 0.25, abyss: 0.5 }, ruin: { deep: 0.05, abyss: 0.1 }, fleet: { deep: 1, abyss: 1 }, storm: { deep: 1 / 40, abyss: 1 / 20 } });   // PIN MOVED (SEA-EVENTS): the storm's wrack
  for (const src of ['legend', 'vault', 'ruin', 'fleet']) for (const band of ['shallows', 'reaches']) assert.equal(elthericChance(src, band), 0, `${src} in ${band}`);
  assert.equal(elthericChance('nope', 'abyss'), 0);
  assert.equal(elthericChance('constructor', 'abyss'), 0, 'an own key alone');
  assert.equal(elthericChance('legend', 'constructor'), 0, 'an own band alone');
  let draws = 0;
  const count = (xs) => () => { draws++; return xs[draws - 1]; };
  draws = 0; assert.equal(rollElthericPiece(count([0.3]), 0.25), null); assert.equal(draws, 1, 'nothing drops: one draw');
  draws = 0; assert.equal(rollElthericPiece(count([0.2, 0.5]), 0.25).aetheric, ELTHERIC_SET_PIECES[4].id); assert.equal(draws, 2, 'a piece: two');
  draws = 0; assert.equal(rollElthericPiece(count([0.99]), 1).aetheric, ELTHERIC_SET_PIECES[8].id); assert.equal(draws, 1, 'every time: one draw, the which');
  draws = 0; assert.equal(rollElthericPiece(count([0]), 0), null); assert.equal(draws, 0, 'no share: no draw at all');
  assert.equal(rollElthericPiece(() => 0.999999, 1).aetheric, ELTHERIC_SET_PIECES[8].id, 'the last piece at the top of the draw');
  // the legends: the deep's two and the abyss's two carry it, the Reaches' two never
  const carries = LEGENDS.map((l) => [l.id, elthericChance('legend', l.band)]);
  assert.deepEqual(carries, [['wake', 0], ['queen', 0], ['hunger', 0.25], ['lantern', 0.25], ['regent', 1], ['starless', 1]]);
  assert.equal(TIDEMAIL_SALT, 0x71de);
});

test('SEA-SET THE PILES: an isle\'s place\'s band read off its own longitude and latitude; a ruin\'s pile rolls the ruin\'s share, a vault\'s the vault\'s, last and on the pile\'s own dice; a place of the Bay, or of a band with no share, rolls nothing and draws nothing (mutants: the band; the source; the dice untouched)', () => {
  const h = veilhaven();
  assert.equal(seaPlaceBand(place(bandX('abyss'), -6000)), 'abyss');
  assert.equal(seaPlaceBand(place(bandX('deep'), -5000)), 'deep');
  assert.equal(seaPlaceBand(place(h.px, h.py, 'port')), 'shallows');
  assert.equal(seaPlaceBand({ mapTableData: { longitude: 400 * 128, latitude: 380 * 128 } }), null, 'a place of the Bay');
  assert.equal(seaPlaceBand({ ether: '1,1', mapTableData: {} }), null);
  assert.equal(seaPileSource(place(1, 1)), 'ruin');
  assert.equal(seaPileSource({ ether: '1,1', wildRing: 4 }), 'vault', 'an isle\'s place the door stamped a vault');
  assert.equal(seaPileSource({ wildRing: 4 }), 'ruin', 'a mountain hall is no vault of the deep');
  let draws = 0;
  const rolls = (xs) => () => xs[Math.min(draws++, xs.length - 1)];
  const items = [{ templateIndex: 1 }];
  draws = 0; assert.equal(seaPileMore(items, place(bandX('reaches') - 50, -5000), rolls([0])).length, 1); assert.equal(draws, 0, 'the Reaches: no share, no draw');
  draws = 0; assert.equal(seaPileMore([], place(bandX('abyss'), -6000), rolls([0.09, 0.1])).length, 1, 'the abyss ruin: a tenth - 0.09 drops'); assert.equal(draws, 2);
  draws = 0; assert.equal(seaPileMore([], place(bandX('abyss'), -6000), rolls([0.11])).length, 0, '0.11 does not');
  draws = 0; assert.equal(seaPileMore([], place(bandX('deep'), -6000), rolls([0.06])).length, 0, 'the deep ruin: a twentieth - 0.06 does not');
  draws = 0; assert.equal(seaPileMore([], place(bandX('deep'), -6000, 'ruin', { wildRing: 3 }), rolls([0.2, 0.3])).length, 1, 'a deep vault: a quarter - 0.2 drops');
  draws = 0; assert.equal(seaPileMore([], place(bandX('abyss'), -6000, 'ruin', { wildRing: 4 }), rolls([0.45, 0.3])).length, 1, 'an abyss vault: half');
  draws = 0; assert.equal(seaPileMore([{ templateIndex: 1 }], { mapTableData: { longitude: 400 * 128, latitude: 380 * 128 } }, rolls([0])).length, 1); assert.equal(draws, 0, 'the Bay: untouched');
  const before = [{ templateIndex: 9 }];
  draws = 0; const after = seaPileMore(before, place(bandX('abyss'), -6000), rolls([0, 0]));
  assert.equal(after, before, 'in place');
  assert.deepEqual([after[0], after[1].aetheric], [{ templateIndex: 9 }, ELTHERIC_SET_PIECES[0].id], 'last');
});

test('SEA-SET STORMWRACK (2): one fold - shock resistance and Speed, Faint to Ascendant; nothing with one piece, nothing asleep (mutants: the element; the stat)', () => {
  fresh();
  const e = wearSet(player(), 'eltheric', 2);
  assert.equal(setFold(e).resist?.shock ?? 0, 0, 'asleep offline');
  online();
  assert.deepEqual([setFold(e).resist.shock, setFold(e).stats.speed], [10, 2]);
  online(40);
  const asc = wearSet(player(), 'eltheric', 2, XP[4]);
  assert.deepEqual([setFold(asc).resist.shock, setFold(asc).stats.speed], [30, 6]);
  online(1);
  assert.equal(setFold(wearSet(player(), 'eltheric', 1)).resist?.shock ?? 0, 0, 'one piece wakes nothing');
});

test('SEA-SET UNDERTOW (4): my weapon blow its share more while I stand in the open Eltheric Ocean - the zone\'s live flag on the sea\'s ground - and half of it anywhere else (the mountains\' zone too); never asleep, never with three pieces, never a bare-handed blow (mutants: the share at sea; the half ashore; the ground)', () => {
  fresh(); online();
  const e = wearSet(player(), 'eltheric', 4), w = sword();
  assert.equal(setBlow(w, 100, e, RAT, {}), 107, 'ashore: half of 15, carried');
  assert.equal(setBlow(w, 100, e, RAT, {}), 108, 'the half carried');
  setWildHere(true, 4, ETHER_KIND);
  assert.equal(setBlow(w, 100, e, RAT, {}), 115, 'at sea: the whole');
  setWildHere(true, 4);
  assert.equal(setBlow(sword(), 100, e, RAT, {}), 107, 'the mountains are no sea');
  setWildHere(true, 2, ETHER_KIND);
  online(40);
  const asc = wearSet(player(), 'eltheric', 4, XP[4]);
  assert.equal(setBlow(sword(), 100, asc, RAT, {}), 140, 'Ascendant at sea');
  assert.equal(setBlow(null, 100, asc, RAT, {}), 100, 'no weapon, no Undertow');
  assert.equal(setBlow(sword(), 100, wearSet(player(), 'eltheric', 3), RAT, {}), 100, 'three pieces');
  online(1);
  assert.equal(setBlow(sword(), 100, wearSet(player(), 'eltheric', 4), RAT, {}), 115, 'Faint again');
  setSigilOnline(false);
  assert.equal(setBlow(sword(), 100, e, RAT, {}), 100, 'asleep');
  setWildHere(false);
});

test('SEA-SET THE CAPTAIN\'S DUE (6): the ship\'s door - my ship\'s balls\' harm and her hull\'s hurts off the player the door names, Faint to Ascendant; 1 and 1 with five pieces, asleep, or no player (mutants: the guns; the hull; the door)', () => {
  fresh();
  assert.deepEqual(captainsDue(), { guns: 1, hull: 1 }, 'no door');
  const e = wearSet(player(), 'eltheric', 6);
  const sh = piece(110, 'eltheric'); e.items.push(sh); equipItem(e, sh);
  door(e);
  assert.deepEqual(captainsDue(), { guns: 1, hull: 1 }, 'asleep offline');
  online();
  assert.deepEqual(captainsDue(), { guns: 1.1, hull: 0.9 });
  online(40);
  const asc = wearSet(player(), 'eltheric', 6, XP[4]);
  assert.deepEqual(captainsDue(asc), { guns: 1.3, hull: 0.75 });
  assert.deepEqual(captainsDue(wearSet(player(), 'eltheric', 5)), { guns: 1, hull: 1 }, 'five pieces');
  setPlayerDoor(null);
});

test('SEA-SET THE SEAMS by source: the naval host\'s every ball of mine over her refit and the Due\'s guns, a ball\'s and a ram\'s hurt on my ship under the Due\'s hull; a legend ended rolls her band\'s Tidemail off her seed into the boat I sail; a ruin\'s pile rolls it last - the layout\'s, the emptied pile\'s and the room\'s base on its own dice (mutants: each seam)', () => {
  const n = src('src/scenes/naval/navalHost.js');
  assert.match(n, /const k = \(Number\.isFinite\(refit\) && refit > 0 \? refit : 1\) \* captainsDue\(\)\.guns;/);
  assert.match(n, /const hurt = dueOnHull\(shotDamage\(gun, zone, \{ braced: st\.guns\.braced/);
  assert.match(n, /hull: Math\.round\(dealt \* captainsDue\(\)\.hull\), sail: 0, crew: ramMen\(dealt/);
  // PIN MOVED (AUDIT SEA VENTURES D1, D12): her piece out of the host (navalSeaSet.js), and only with her purse
  assert.match(n, /if \(legend\) legendTidemail\(legend, s\.seed, deps\.ether\?\.legendEnded\?\.\(legend\.id, act\), \{ give: \(items\) => deps\.board\?\.giveItems\?\.\(items, boatInPlay\(\) \?\? null, \{ force: true \}\), say: \(text, n\) => deps\.say\?\.\(text, n\) \}\);/);
  assert.match(src('src/scenes/naval/navalSeaSet.js'), /if \(!\(Number\(paid\) > 0\)\) return null;\n  const piece = rollElthericPiece\(mulberry32\(\(\(seed >>> 0\) \^ TIDEMAIL_SALT\) >>> 0\), elthericChance\('legend', legend\.band\)\);\n  if \(!piece\) return null;\n  give\(\[piece\]\);/);
  const d = src('src/scenes/dungeonContext.js');
  assert.match(d, /if \(!onlineRoom\(\)\) seaPileMore\(items, dfLocation\);/);
  assert.match(d, /wildPileMore\(p\.items, rollPileItems, _wildRing\); seaPileMore\(p\.items, dfLocation\); settleLootFlat\(i\);/);
  assert.match(d, /\n    dfLocation,   \/\/ SEA-SET: the place/);
  assert.match(src('src/scenes/roomLootHost.js'), /if \(_wildDungeon\) wildPileMore\(items, \(\) => rollPileItems\(t\), _wildRing, rolls\);\n    seaPileMore\(items, dfLocation, rolls\);/);
  // a legend of the Abyss carries one every time - which one is her seed's own
  const seed = 0x1234567;
  const want = ELTHERIC_SET_PIECES[Math.floor(mulberry32(((seed >>> 0) ^ TIDEMAIL_SALT) >>> 0)() * 9)].id;
  assert.equal(rollElthericPiece(mulberry32(((seed >>> 0) ^ TIDEMAIL_SALT) >>> 0), elthericChance('legend', 'abyss')).aetheric, want);
});
