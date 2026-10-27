// SET-CATCHUP (POWER-CEILING, 2026-10-27; bible/11-Multiplayer/Sigil-Sets.md section 5, bible/05-Combat/Power-Ceiling.md;
// the player: "Add more horizontal progression please!"): GOING SIDEWAYS COSTS LESS. Mac's "grow together" stands - a
// set's stage is its lowest worn piece's - but a piece below the highest stage the set has stood at for this character
// (two of its pieces worn at that stage, or the save's record of it) drinks three times the XP until it gets there,
// and never faster past it. Pinned through the real drink (sigilSets.js drinkWorn), the save's own slot and the card.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGIL_STAGES, SIGIL_XP_MAX, sigilRank, setSigilOnline, setSigilRenown, _resetSigilForTests } from '../../../src/systems/sigil/sigil.js';
import { drinkWorn, setCardView, setLines, setReachOf, wornSetRanks, setSetsDueling, catchUpText, _resetSigilSetsForTests } from '../../../src/systems/sigil/sigilSets.js';
import { CATCH_UP_MULT, REACH_PIECES, catchUpXp, reachOfRanks, recordedReach, noteReach, validReachRecord, SET_REACH_SAVE_VENDOR } from '../../../src/systems/sigil/setReach.js';
import { modSaveRecords, restoreModSaveRecords, newGameModSaveRecords } from '../../../src/systems/modSaveData.js';
import { setStageText } from '../../../src/ui/setCard.js';
import { equipItem, unequipItem } from '../../../src/systems/equip.js';
import { mintCondition } from '../../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { registerLocale, patchLocaleTable, setLocale, runtimeCollectionName, TextCollections } from '../../../src/systems/textManager.js';

const XP = SIGIL_STAGES.map((s) => s.xp);   // 0, 5000, 12500, 22500, 37500
const RADIANT = 3;
const player = () => ({ isPlayer: true, items: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 20, career: {}, health: 100, maxHealth: 100, activeEffects: [] });
const piece = (templateIndex, set, xp = 0, name = null) => {
  const it = mintCondition({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Ebony, flags: 0 });
  it.rarity = 'rare';
  it.sigil = { set, party: 1, xp };
  if (name) it.name = name;
  return it;
};
const wear = (e, ...items) => { for (const it of items) { e.items.push(it); equipItem(e, it); } return e; };
function fresh() { _resetSigilForTests(); _resetSigilSetsForTests(); setPref('lootRarity', true); setSigilOnline(true); setSigilRenown(40); }
const BODY = [107, 106, 105, 102, 103, 104];   // helm, two pauldrons, cuirass, gauntlets, greaves

test('SET-CATCHUP THE LAW: a piece below its set\'s reach drinks three times the XP, and the drink that carries it past the reach\'s XP pays the rest whole; at or past the reach, or with none, the drink is the drink (mutants: the pace x2; the split paid fast; a reach of Faint taken as one)', () => {
  assert.equal(CATCH_UP_MULT, 3);
  assert.equal(REACH_PIECES, 2, 'two pieces at a stage: the set\'s first tier stands there');
  assert.equal(catchUpXp(1000, 0, RADIANT), 3000, 'fresh: three times');
  assert.equal(catchUpXp(1000, XP[RADIANT] - 3000, RADIANT), 3000, 'exactly to the reach: still three times');
  assert.equal(catchUpXp(1000, XP[RADIANT] - 300, RADIANT), 300 + (1000 - 100), '300 to get there (100 earned), the other 900 whole');
  assert.equal(catchUpXp(1000, XP[RADIANT] - 1, RADIANT), 1 + 999, 'one short: a point earned closes it');
  assert.equal(catchUpXp(1000, XP[RADIANT], RADIANT), 1000, 'at the reach: whole');
  assert.equal(catchUpXp(1000, XP[4], RADIANT), 1000, 'past it: whole');
  assert.equal(catchUpXp(1000, 0, 0), 1000, 'a reach of Faint: nothing to catch up to');
  assert.equal(catchUpXp(1000, 0, -1), 1000, 'no reach');
  assert.equal(catchUpXp(10.7, 0, 1), 30, 'whole points, as a drink is');
  assert.equal(catchUpXp(0, 0, 4), 0);
  assert.equal(catchUpXp(-5, 0, 4), 0);
});

test('SET-CATCHUP THE REACH: the second-best rank among a set\'s WORN pieces - a piece in the pack counts for nothing - and never lower than the save\'s record of it (mutants: the best rank taken; one piece a reach; the record lowered; the pack counted)', () => {
  fresh();
  assert.equal(reachOfRanks([4]), -1, 'one piece is no set standing');
  assert.equal(reachOfRanks([4, 0]), 0, 'an Ascendant piece and a fresh one stood at Faint together');
  assert.equal(reachOfRanks([1, 3, 3, 0]), 3);
  const e = player();
  wear(e, piece(107, 'dagon', XP[3]), piece(106, 'dagon', XP[1]));
  e.items.push(piece(105, 'dagon', XP[4]), piece(102, 'mora', XP[2]));
  // PIN MOVED (AUDIT HORIZONTAL D1): the pack counted - a lent Ascendant pair carried for one kill made a reach for good
  assert.deepEqual([...wornSetRanks(e)], [['dagon', [3, 1]]], 'the worn pieces, by set - the pack\'s never');
  assert.equal(setReachOf(e, 'dagon'), 1, 'the Radiant one and the Bright one worn: Bright - the Ascendant one in the pack is no part of it');
  assert.equal(setReachOf(e, 'mora'), -1);
  const lent = player();
  lent.items.push(piece(107, 'dagon', XP[4]), piece(106, 'dagon', XP[4]));
  drinkWorn(lent, null, 10);
  assert.equal(recordedReach('dagon'), -1, 'a lent pair carried, never worn: no reach');
  wear(e, piece(105, 'dagon', XP[3]));
  assert.deepEqual([...noteReach(wornSetRanks(e))], [['dagon', 3]], 'recorded');
  assert.equal(recordedReach('dagon'), 3);
  noteReach(new Map([['dagon', [0, 0]]]));
  assert.equal(recordedReach('dagon'), 3, 'never lowered');
  e.items.length = 0;
  assert.equal(setReachOf(e, 'dagon'), 3, 'the pieces gone, the record keeps it');
  const m = wear(player(), piece(107, 'mora', XP[1] - 10), piece(106, 'mora', XP[1] - 10));
  drinkWorn(m, null, 10);
  m.items.length = 0;
  assert.equal(recordedReach('mora'), 1, 'a rise the drink made is recorded after it, the pieces gone or not');
});

test('SET-CATCHUP THE DRINK: a full Dagon\'s Brand at Radiant, a fresh helm swapped in - the set falls to Faint (grow together, as ever), and the fresh helm drinks three times the kill\'s XP until Radiant while the rest drink it whole; the old helm sold, the record keeps the pace; a duel or offline, nothing drinks (mutants: the fresh piece drinking whole; every piece drinking fast; the record never written)', () => {
  fresh();
  const e = player();
  const set = BODY.map((t) => piece(t, 'dagon', XP[RADIANT]));
  wear(e, ...set);
  const fresher = piece(107, 'dagon', 0, 'Helm');
  const old = set[0];
  unequipItem(e, old);
  wear(e, fresher);
  let r = drinkWorn(e, null, 1000);
  assert.equal(fresher.sigil.xp, 3000, 'the fresh helm: three times');
  assert.deepEqual(set.slice(1).map((p) => p.sigil.xp), new Array(5).fill(XP[RADIANT] + 1000), 'the rest: the drink');
  assert.equal(old.sigil.xp, XP[RADIANT], 'the old helm in the pack drinks nothing');
  assert.deepEqual(r, { lines: [], rose: false });
  e.items.splice(e.items.indexOf(old), 1);   // sold: two worn pieces still stand at Radiant and the record has it
  drinkWorn(e, null, 1000);
  assert.equal(fresher.sigil.xp, 6000, 'still three times');
  r = drinkWorn(e, null, 1000);
  assert.equal(fresher.sigil.xp, 9000);
  for (const p of set.slice(1)) p.sigil = { ...p.sigil, xp: XP[RADIANT] };   // the record alone, now: every other piece at Radiant as before
  r = drinkWorn(e, null, 5000);
  assert.equal(fresher.sigil.xp, XP[RADIANT] + 500, 'the 13,500 to Radiant at three times (4,500 earned), the other 500 whole');
  assert.deepEqual(r.lines, ['Your Dagon\'s Brand brightens: Radiant.'], 'the set rose with it - from Faint, once');
  drinkWorn(e, null, 1000);
  assert.equal(fresher.sigil.xp, XP[RADIANT] + 1500, 'caught up: the drink whole');
  assert.equal(recordedReach('dagon'), RADIANT);
  const plain = Object.assign(createWeapon(120, 0), { rarity: 'rare', sigil: { power: 5, party: 1, xp: 0 } });
  drinkWorn(e, plain, 1000);
  assert.equal(plain.sigil.xp, 1000, 'a plain sigil weapon: no set, no catch-up');
  const before = fresher.sigil.xp;
  setSetsDueling(true);
  drinkWorn(e, null, 1000);
  assert.equal(fresher.sigil.xp, before, 'a duel: no piece drinks');
  setSetsDueling(false);
  _resetSigilForTests();
  drinkWorn(e, null, 1000);
  assert.equal(fresher.sigil.xp, before, 'offline: nothing');
});

test('SET-CATCHUP THE SAVE: the reach rides the character\'s save under its own slot, a forged or unknown entry dropped, a new game empty (mutants: the record left out of the save; a stage past Ascendant taken)', () => {
  fresh();
  noteReach(new Map([['dagon', [3, 3]], ['panoply', [4, 2]]]));
  assert.deepEqual(modSaveRecords()[SET_REACH_SAVE_VENDOR], { reach: { dagon: 3, panoply: 2 } });
  restoreModSaveRecords({ [SET_REACH_SAVE_VENDOR]: { reach: { dagon: 4, mora: 5, sheogorath: 2, nocturnal: 1.5, ruhn: 0 } } });
  assert.deepEqual(modSaveRecords()[SET_REACH_SAVE_VENDOR], { reach: { dagon: 4, ruhn: 0 } }, 'a stage 0..4 of a set that is one');
  restoreModSaveRecords({});
  assert.deepEqual(modSaveRecords()[SET_REACH_SAVE_VENDOR], { reach: {} }, 'a save from before: none');
  noteReach(new Map([['dagon', [2, 2]]]));
  newGameModSaveRecords();
  assert.equal(recordedReach('dagon'), -1, 'a new character starts with none');
  assert.deepEqual(validReachRecord(null), {});
  assert.deepEqual(validReachRecord({ reach: [3] }), {});
});

test('SET-CATCHUP THE CARD: the set\'s stage line names the piece holding it and its pace - "(3x XP)" when its next stage is the reach, "(3x XP to Radiant)" past it - and the classic tooltip\'s head says the same; nothing when no piece is below the reach (mutants: the pace unsaid; said for a piece at the reach)', () => {
  fresh();
  const e = player();
  const set = BODY.map((t) => piece(t, 'dagon', XP[RADIANT]));
  wear(e, ...set);
  let v = setCardView(set[1], e);
  assert.equal(v.catchUp, null, 'the whole set at Radiant: nothing to catch up');
  const fresher = piece(107, 'dagon', 0, 'Helm');
  unequipItem(e, set[0]);
  wear(e, fresher);
  v = setCardView(fresher, e);
  assert.deepEqual(v.catchUp, { stage: RADIANT, name: 'Radiant', mult: CATCH_UP_MULT });
  assert.equal(setStageText(v, (it) => it.name), 'Faint · Kindled: grow your Helm (3x XP to Radiant)');
  assert.equal(setStageText(v, (it) => it.name, { compact: true }), 'Kindled: grow your Helm (3x XP to Radiant)');
  assert.match(setLines(fresher, e)[0], /^Dagon's Brand: 6 of 9 worn, Faint, 3x XP to Radiant$/);
  fresher.sigil = { ...fresher.sigil, xp: XP[2] };
  v = setCardView(fresher, e);
  assert.equal(setStageText(v, (it) => it.name, { compact: true }), 'Radiant: grow your Helm (3x XP)', 'the next stage is the reach');
  fresher.sigil = { ...fresher.sigil, xp: XP[RADIANT] };
  v = setCardView(fresher, e);
  assert.equal(v.catchUp, null, 'caught up');
  assert.equal(catchUpText(null), '');
  assert.equal(sigilRank({ set: 'dagon', party: 1, xp: SIGIL_XP_MAX }), 4);
});

test('SET-CATCHUP ONE LANGUAGE A LINE (AUDIT HORIZONTAL D6): the pace is English, as the stage line and the tooltip\'s head it sits in - a catalogue that drafted the pace alone (German\'s rows, "{mult}x EP bis {stage}") made "grow your Helm (3x EP bis Radiant)"; the sets\' batch routes the line whole (mutant: a German pace in the English line)', () => {
  fresh();
  registerLocale({ code: 'de', name: 'Deutsch' });
  patchLocaleTable('de', runtimeCollectionName(TextCollections.Port), [['sets.catchUp', '{mult}x EP'], ['sets.catchUpTo', '{mult}x EP bis {stage}']]);   // the drafted rows the pace had
  setLocale('de');
  try {
    const e = player();
    const set = BODY.map((t) => piece(t, 'dagon', XP[RADIANT]));
    wear(e, ...set);
    const fresher = piece(107, 'dagon', 0, 'Helm');
    unequipItem(e, set[0]);
    wear(e, fresher);
    const v = setCardView(fresher, e);
    assert.equal(setStageText(v, (it) => it.name), 'Faint · Kindled: grow your Helm (3x XP to Radiant)', 'the card\'s line, whole');
    assert.equal(setLines(fresher, e)[0], 'Dagon\'s Brand: 6 of 9 worn, Faint, 3x XP to Radiant', 'the tooltip\'s head, whole');
    fresher.sigil = { ...fresher.sigil, xp: XP[2] };
    assert.equal(setStageText(setCardView(fresher, e), (it) => it.name, { compact: true }), 'Radiant: grow your Helm (3x XP)');
  } finally { setLocale('en'); }
});
