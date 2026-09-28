// SET1 (2026-09-26, Mac: "sigil armor sets that also come with set builds (think having multiple of one set type grants
// detailed abilities)"; chose tiers at 2 / 4 / 6, "Grow together", online only and never in duels): THE SET LAW
// (systems/sigilSets.js, and the record's one new field in systems/sigil.js). The registry and its numbers; the record
// with a `set` and no `power`, and every reader of the power reading its absence as no blow; what may be a piece; the
// worn pieces per set - the nine places, one weapon a set; the stage - the lowest piece's, the Renown's cap, what holds
// it; the tiers awake by the count; the one question the powers ask. bible/11-Multiplayer/Sigil-Sets.md sections 1-2.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIGIL_SET_IDS, SIGIL_STAGES, SIGIL_XP_MAX, validSigil, sigilSetId, sigilHasBlow, sigilPercent, sigilLines, sigilView,
  setSigilOnline, setSigilRenown, _resetSigilForTests,
} from '../src/systems/sigil.js';
import {
  SIGIL_SETS, WORLD_SET_IDS, SET_TIERS, SET_STAGE_MAX, SET_PLACES, stageValue, tierValues, setPieceKind, setIdOf, isSetPiece,
  wornSetPieces, setState, wornSets, awakeTier, setSetsDueling, setsDueling, setsAwake, setById, _resetSigilSetsForTests,
} from '../src/systems/sigilSets.js';
import { equipItem, unequipItem } from '../src/systems/equip.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { validItemField } from '../src/systems/itemFields.js';
import { validLootItem } from '../src/systems/loot.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';

const player = () => ({ isPlayer: true, items: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {}, health: 20, maxHealth: 30, activeEffects: [] });
const armour = (templateIndex, set, xp = 0) => {
  const it = mintCondition({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Steel, flags: 0 });
  it.rarity = 'rare';
  if (set) it.sigil = { set, party: 1, xp };
  return it;
};
const weapon = (templateIndex, set, xp = 0, power = 5) => {
  const it = createWeapon(templateIndex, 0);
  it.rarity = 'rare';
  it.sigil = set ? { power, set, party: 1, xp } : { power, party: 1, xp };
  return it;
};
const wear = (e, ...items) => { for (const it of items) { e.items.push(it); equipItem(e, it); } };
const BODY = [107, 106, 105, 102, 103, 104, 108];   // helm, right and left pauldron, cuirass, gauntlets, greaves, boots
const XP = SIGIL_STAGES.map((s) => s.xp);           // 0, 5000, 12500, 22500, 37500

test('SET1 the registry: five sets in the record\'s own order - the four of the world, then the gate boss\'s own (Aetheric) - each with three tiers at 2, 4 and 6 pieces, every number a whole pair from Faint to Ascendant, every tier\'s words whole at both ends (mutants: a set out of the record\'s order; a tier at the wrong count)', () => {
  assert.deepEqual(Object.keys(SIGIL_SETS), [...SIGIL_SET_IDS], 'the registry and the record name the same sets, in one order');
  assert.deepEqual(WORLD_SET_IDS, ['malacath', 'dagon', 'nocturnal', 'mora']);
  assert.deepEqual(SET_TIERS, [2, 4, 6]);
  assert.equal(SET_PLACES.length, 9, 'seven body pieces, the shield, the weapon');
  for (const set of Object.values(SIGIL_SETS)) {
    assert.equal(setById(set.id), set);
    assert.equal(set.aetheric, set.id === 'ruhn', 'only the boss\'s own set is Aetheric');
    assert.match(set.colour, /^#[0-9a-f]{6}$/);
    assert.deepEqual(set.tiers.map((t) => t.at), [...SET_TIERS], set.id);
    for (const t of set.tiers) {
      for (const [k, pair] of Object.entries(t.values)) {
        assert.ok(Array.isArray(pair) && pair.length === 2 && pair.every(Number.isInteger), `${set.id}.${t.key}.${k}`);
      }
      for (const st of [0, SET_STAGE_MAX]) {
        const words = t.text(tierValues(t, st));
        assert.doesNotMatch(words, /undefined|NaN/, `${set.id}.${t.key} at ${st}: ${words}`);
      }
    }
  }
  assert.equal(setById('nobody'), null);
  assert.equal(setById('__proto__'), null, 'an own id, never the prototype\'s');
});

test('SET1 the numbers\' line: a number at a stage is its place on the line from Faint (0) to Ascendant (4), rounded - a falling number (a recovery) falls - and a stage off the line is clamped to it (mutants: the line from 1; no clamp)', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((s) => stageValue([2, 6], s)), [2, 3, 4, 5, 6]);
  assert.deepEqual([0, 1, 2, 3, 4].map((s) => stageValue([300, 150], s)), [300, 263, 225, 188, 150]);
  assert.deepEqual([0, 4].map((s) => stageValue([10, 30], s)), [10, 30]);
  assert.equal(stageValue([2, 6], -1), 2, 'asleep reads as Faint');
  assert.equal(stageValue([2, 6], 9), 6);
  assert.equal(stageValue([2, 6], Number.NaN), 2);
  assert.deepEqual(tierValues(SIGIL_SETS.dagon.tiers[0], 4), { strength: 6, critical: 12 });
});

test('SET1 the record: a sigil carries a power, a set, or both - never neither - and a set is one the registry knows; every reader of the power reads a set\'s armour as no blow (no per cent, no "undefined" in its words, a card with no blow); the item field and the loot door take a set piece and refuse a forged set (mutants: power still required; any set taken; the blow read off a set piece)', () => {
  const weaponSigil = { power: 5, party: 1, xp: 0 };
  const armourSigil = { set: 'dagon', party: 2, xp: 100 };
  const setWeapon = { power: 5, set: 'mora', party: 1, xp: 0 };
  for (const s of [weaponSigil, armourSigil, setWeapon]) assert.ok(validSigil(s), JSON.stringify(s));
  for (const s of [
    { party: 1, xp: 0 },                       // neither
    { set: 'nobody', party: 1, xp: 0 },        // a set no one made
    { set: 5, party: 1, xp: 0 },
    { set: '__proto__', party: 1, xp: 0 },
    { power: 0, set: 'dagon', party: 1, xp: 0 },   // a power present and malformed
    { power: 13, party: 1, xp: 0 },
    { set: 'dagon', party: 0, xp: 0 },
    { set: 'dagon', party: 1, xp: SIGIL_XP_MAX + 1 },
  ]) assert.equal(validSigil(s), false, JSON.stringify(s));
  assert.equal(sigilSetId(armourSigil), 'dagon');
  assert.equal(sigilSetId(weaponSigil), null);
  assert.equal(sigilSetId({ set: 'nobody', party: 1, xp: 0 }), null);
  assert.equal(sigilHasBlow(armourSigil), false);
  assert.equal(sigilHasBlow(setWeapon), true);
  _resetSigilForTests();
  try {
    setSigilOnline(true); setSigilRenown(40);
    assert.equal(sigilPercent(armourSigil, 40), 0, 'no power, no blow');
    assert.equal(sigilPercent(setWeapon, 40), 1, 'a set weapon keeps its blow (5% at Faint)');
    const piece = armour(102, 'dagon');
    const lines = sigilLines(piece);
    assert.deepEqual(lines, ['Sigil (Faint)', 'Faint: 0 / 5,000 to Kindled']);
    const v = sigilView(piece);
    assert.equal(v.blow, false); assert.equal(v.pct, 0); assert.equal(v.full, null); assert.equal(v.set, 'dagon');
    setSigilOnline(false);
    assert.deepEqual(sigilLines(piece), ['Sigil (Dormant - wakes online, with your Renown)']);
    assert.deepEqual(sigilLines(weapon(120, null)), ['Sigil (Dormant - wakes online, with your Renown): +5% at Ascendant'], 'a weapon\'s words are what they were');
  } finally { _resetSigilForTests(); }
  assert.deepEqual(validItemField('sigil', armourSigil), armourSigil);
  assert.equal(validItemField('sigil', { set: 'nobody', party: 1, xp: 0 }), undefined);
  const wire = validLootItem(JSON.parse(JSON.stringify(armour(107, 'nocturnal', 777))));
  assert.deepEqual(wire.sigil, { set: 'nocturnal', party: 1, xp: 777 }, 'a set piece crosses the wire whole');
  assert.equal(validLootItem({ ...armour(107), sigil: { set: 'forged', party: 1, xp: 0 } }), null, 'a forged set is no item');
});

test('SET1 what may be a piece: a body piece of armour, a shield, a weapon - never ammunition, jewellery or clothing, whatever the sigil says (mutants: jewellery taken; ammunition taken)', () => {
  assert.equal(setPieceKind(armour(102)), 'armor');
  assert.equal(setPieceKind(armour(110)), 'shield');
  assert.equal(setPieceKind(weapon(120, null)), 'weapon');
  assert.equal(setPieceKind(mintCondition({ group: 'Weapons', templateIndex: 131, flags: 0 })), null, 'an arrow');
  const ring = { ...mintCondition({ group: 'Jewellery', templateIndex: 135, flags: 0 }), sigil: { set: 'mora', party: 1, xp: 0 } };
  assert.equal(setPieceKind(ring), null);
  assert.equal(setIdOf(ring), null, 'a set\'s sigil on a ring names nothing');
  assert.equal(setIdOf(armour(102, 'malacath')), 'malacath');
  assert.equal(isSetPiece(armour(102)), false, 'no sigil, no set');
  assert.equal(isSetPiece(weapon(120, null)), false, 'a weapon sigil of no set');
  assert.equal(isSetPiece(weapon(120, 'dagon')), true);
  assert.equal(setPieceKind(null), null);
});

test('SET1 the worn pieces: counted per set where they are worn - the seven body pieces, the shield, ONE weapon a set whatever the hands hold - in the registry\'s order; a piece in the pack counts for nothing, and one taken off stops counting (mutants: two weapons of a set counted twice; the pack counted; the order the table\'s)', () => {
  const e = player();
  const body = BODY.map((t) => armour(t, 'malacath'));
  wear(e, ...body, armour(110, 'malacath'));
  e.items.push(armour(102, 'dagon'));   // in the pack
  let worn = wornSetPieces(e);
  assert.deepEqual([...worn.keys()], ['malacath']);
  assert.equal(worn.get('malacath').length, 8, 'seven body pieces and the shield');
  // weapons in both hands, both of one set: once
  const e2 = player();
  const w1 = weapon(116, 'dagon'), w2 = weapon(113, 'dagon');
  wear(e2, w1, w2);
  assert.equal(e2.equip.slots[EQUIP_SLOTS.RightHand] != null && e2.equip.slots[EQUIP_SLOTS.LeftHand] != null, true, 'a weapon in each hand');
  assert.equal(wornSetPieces(e2).get('dagon').length, 1, 'two weapons of a set are one piece');
  // two sets, in the registry's order whatever order they were worn in
  const e3 = player();
  wear(e3, armour(107, 'mora'), armour(108, 'malacath'), armour(102, 'mora'));   // the table reads the helm (Mora's) first
  worn = wornSetPieces(e3);
  assert.deepEqual([...worn.keys()], ['malacath', 'mora'], 'the registry\'s order, not the table\'s');
  assert.deepEqual([...worn.values()].map((l) => l.length), [1, 2]);
  unequipItem(e3, e3.items[0]);
  assert.equal(wornSetPieces(e3).get('mora').length, 1, 'taken off, it stops counting');
  assert.equal(wornSetPieces({}).size, 0);
  assert.equal(wornSetPieces(null).size, 0);
});

test('SET1 the stage: the lowest worn piece\'s rank capped by the Renown\'s stage; what holds it - the piece to grow, the Renown, or both when they meet - and the Renown that opens the next; the tiers awake by the count at the set\'s stage, Faint\'s numbers while it sleeps; AUDIT U3: the piece to grow is the one FURTHEST BEHIND (least XP), not the first of the lowest stage; L5: `text: false` builds the numbers alone (mutants: the highest piece\'s rank; the cap unread; a tier awake below its count; the first of the lowest stage named; the words built for a numbers-only read)', () => {
  const pieces = [armour(102, 'dagon', XP[3]), armour(107, 'dagon', XP[1]), armour(108, 'dagon', XP[4]), armour(104, 'dagon', XP[2])];
  // Renown 40 opens Ascendant: the lowest piece (Kindled) holds the set
  let st = setState('dagon', pieces, 40, true);
  assert.equal(st.count, 4);
  assert.equal(st.stage, 1);
  assert.equal(st.stageName, 'Kindled');
  assert.equal(st.heldPiece, pieces[1], 'the helm, the one to grow');
  assert.equal(st.heldRenown, false);
  assert.deepEqual(st.tiers.map((t) => t.awake), [true, true, false], 'four pieces: the 2 and the 4');
  assert.deepEqual(st.tiers[0].values, { strength: 3, critical: 6 }, 'Kindled\'s numbers');
  assert.equal(st.tiers[1].text, 'Your weapon blows deal +6% damage, +12% below half health');
  assert.equal(st.tiers[1].full, 'Your weapon blows deal +12% damage, +24% below half health', 'and what it is at Ascendant');
  // Renown 9 opens only Faint: the Renown holds it
  st = setState('dagon', pieces, 9, true);
  assert.equal(st.stage, 0);
  assert.equal(st.heldPiece, null);
  assert.equal(st.heldRenown, true);
  assert.equal(st.renownNext, 10);
  // they meet at Kindled: both hold it
  st = setState('dagon', pieces, 10, true);
  assert.equal(st.stage, 1);
  assert.equal(st.heldPiece, pieces[1]);
  assert.equal(st.heldRenown, true);
  // every piece Ascendant, Renown 40: nothing holds it
  st = setState('dagon', pieces.map((p) => ({ ...p, sigil: { ...p.sigil, xp: XP[4] } })), 45, true);
  assert.equal(st.stage, SET_STAGE_MAX);
  assert.equal(st.heldPiece, null); assert.equal(st.heldRenown, false);
  // asleep: no tier awake, Faint's numbers said
  st = setState('dagon', pieces, null, true);
  assert.equal(st.stage, -1); assert.equal(st.stageName, 'Dormant');
  assert.deepEqual(st.tiers.map((t) => t.awake), [false, false, false]);
  assert.deepEqual(st.tiers[0].values, { strength: 2, critical: 4 });
  assert.equal(setState('dagon', pieces, 40, false).stage, -1, 'and asleep when the session says so');
  // six pieces wake the third
  assert.deepEqual(setState('nocturnal', BODY.slice(0, 6).map((t) => armour(t, 'nocturnal', XP[4])), 40, true).tiers.map((t) => t.awake), [true, true, true]);
  assert.deepEqual(setState('nocturnal', [armour(102, 'nocturnal')], 40, true).tiers.map((t) => t.awake), [false, false, false], 'one piece wakes nothing');
  assert.equal(setState('nobody', pieces, 40, true), null);
  // AUDIT SET U3: two pieces at one stage - a helm 100 XP short of Kindled and fresh boots - the boots are the ones to grow
  const helm = armour(107, 'dagon', XP[1] - 100), boots = armour(108, 'dagon', 0);
  st = setState('dagon', [helm, boots, armour(102, 'dagon', XP[2])], 40, true);
  assert.equal(st.stage, 0, 'both Faint');
  assert.equal(st.heldPiece, boots, 'the fresh boots, not the helm first in slot order');
  assert.equal(setState('dagon', [boots, helm], 40, true).heldPiece, boots, 'whatever the order');
  // L5: a numbers-only read - the tiers' words unbuilt, their numbers and wakefulness the same
  const words = setState('dagon', pieces, 40, true);
  const bare = setState('dagon', pieces, 40, true, { text: false });
  assert.deepEqual(bare.tiers.map((t) => [t.awake, t.values]), words.tiers.map((t) => [t.awake, t.values]));
  assert.deepEqual(bare.tiers.map((t) => [t.text, t.full]), [['', ''], ['', ''], ['', '']]);
  assert.equal(bare.heldPiece, words.heldPiece);
});

test('SET1 the session and the powers\' one question: awake online with my Renown known and not in a duel; awakeTier answers a tier\'s numbers for MY entity alone - never a peer\'s, never a foe\'s - and only while the set wears enough pieces (mutants: the duel unread; a peer\'s set awake; the count unread)', () => {
  _resetSigilForTests(); _resetSigilSetsForTests();
  try {
    const e = player();
    wear(e, ...BODY.slice(0, 4).map((t) => armour(t, 'dagon', XP[4])));
    assert.equal(setsAwake(), false, 'offline');
    assert.equal(awakeTier(e, 'dagon', 0), null);
    setSigilOnline(true);
    assert.equal(setsAwake(), false, 'online, my Renown not yet known');
    setSigilRenown(40);
    assert.equal(setsAwake(), true);
    assert.deepEqual(awakeTier(e, 'dagon', 0), { strength: 6, critical: 12 });
    assert.deepEqual(awakeTier(e, 'dagon', 1), { more: 12 });
    assert.equal(awakeTier(e, 'dagon', 2), null, 'four pieces: the third sleeps');
    assert.equal(awakeTier(e, 'mora', 0), null, 'a set not worn');
    setSetsDueling(true);
    assert.equal(setsDueling(), true);
    assert.equal(setsAwake(), false, 'a duel');
    assert.equal(awakeTier(e, 'dagon', 0), null);
    setSetsDueling(false);
    assert.equal(awakeTier({ ...e, peer: true }, 'dagon', 0), null, 'a peer\'s entity');
    assert.equal(awakeTier({ ...e, isPlayer: false }, 'dagon', 0), null, 'a foe');
    const sets = wornSets(e);
    assert.equal(sets.length, 1);
    assert.equal(sets[0].id, 'dagon'); assert.equal(sets[0].count, 4); assert.equal(sets[0].stage, 4);
  } finally { _resetSigilForTests(); _resetSigilSetsForTests(); }
});
