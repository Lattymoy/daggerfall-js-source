// FIELD BUGS 2026-10-19f CHAIN-SEEN (a player's private report: a Legendary bow's Chain Lightning shows nothing) - the
// arc lands: half the shaft's damage, as shock, on the nearest other foe within 6 m, through that foe's own pool's door.
// But the door runs no formula, and HN1's numbers are the formula's readout (ui/hitNumbers.js), so the arc rose no
// number and said no word - the same omission ROSE-SEEN (bible/01-Overview/bugs/Field-Bugs-2026-10-15e.md) closed for
// its neighbour, again()'s follow-up. Every reach of a blow on another foe in systems/loot/lootPowers.js was the same:
// Earthshaker's quake and Dragonfire's burst, and Dragonfire's own second burn rose untagged. Each raises its number now,
// tagged with its power's name (`reachOn`). bible/06-Systems/Loot-Arc.md, CHAIN-SEEN.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as LP from '../../src/systems/loot/lootPowers.js';
import { _resetSetPowersForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { _resetSigilSetsForTests } from '../../src/systems/sigil/sigilSets.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { equipItem } from '../../src/systems/equip.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { EFFECT_FLAGS } from '../../src/systems/spellcast.js';
import { DRAGONFIRE_OATH, DRAGONFIRE, mintGilded } from '../../src/systems/gilded.js';
import { mountHitNumbers, unmountHitNumbers } from '../../src/ui/hitNumbers.js';

const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 20, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 50, maxMagicka: 100, goldPieces: 0 });
const foe = (careerIndex, extra = {}) => ({ careerIndex, career: {}, health: 100, maxHealth: 100, level: 10, ...extra });
const rec = (name, entity, x, z = 0) => ({ name, entity, ai: { feet: [x, 0, z] }, dead: false });
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };
/** A Legendary of a record, on its own base, through the ladder's own door. */
const legendary = (id) => {
  const r = LR.legendaryById(id);
  const it = LR.applyRarity(createWeapon(r.templates[0], 0, () => 0.5), 'legendary', lcg(1), [r]);
  it.isIdentified = true;
  return it;
};
const fresh = () => { _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); _resetSetPowersForTests(); _resetSigilSetsForTests(); setPlayerDoor(null); };
/** The door a power lands through: the foes standing, and what each took. */
const door = (foes, me) => {
  const hurts = [];
  setPlayerDoor({ foes: () => foes.filter((f) => !f.dead), feet: () => [0, 0, 0], hurtFoe: (f, n) => hurts.push([f.name, n]), castOnPlayer: () => {}, player: () => me });
  return hurts;
};
const DAEDROTH = 27, FIRE_DAEDRA = 26, ORC = 7;

/** HN1's layer on a stub document: every number raised, `[its text, its tag]`. */
function numbers() {
  const nodes = [];
  const el = (tag) => {
    const e = { tag, children: [], style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, className: '', textContent: '', listeners: {},
      append(...c) { this.children.push(...c); }, isConnected: true, addEventListener(n, f) { this.listeners[n] = f; }, remove() { this.isConnected = false; }, setAttribute() {} };
    nodes.push(e); return e;
  };
  globalThis.document = { createElement: el, getElementById: () => null, body: el('body') };
  return () => nodes.filter((n) => n.className?.startsWith('hitnum ')).map((n) => [n.textContent, n.children[0]?.textContent ?? null]);
}

test('CHAIN-SEEN THE ARC SAYS ITS HARM: a Legendary bow\'s Chain Lightning raises the arc\'s own number on the enhanced HUD, its power\'s name its tag - half the shaft, as shock, on the nearest other foe within 6 m; none where no foe is in reach or the one in reach is proof against shock, none on the classic skin, and the arc lands as before (mutants: the arc silent; untagged; the word never handed)', () => {
  const raised = numbers();
  try {
    fresh();
    assert.equal(LR.powerOf('stormcaller').name, 'Chain Lightning');
    const me = player(), bow = wear(me, legendary('stormcaller'));
    const struck = foe(ORC), near = foe(ORC), far = foe(ORC), proof = foe(ORC, { career: { immunityFlags: EFFECT_FLAGS.Shock } });
    let hurts = door([rec('struck', struck, 0), rec('near', near, 3), rec('far', far, 9)], me);
    LP.lootStrike(me, struck, 40, bow);
    assert.deepEqual([raised(), hurts], [[], [['near', 20]]], 'the classic skin draws nothing, and the arc lands');
    mountHitNumbers();
    LP.lootStrike(me, struck, 40, bow);
    assert.deepEqual(raised(), [['20', 'Chain Lightning']], 'its number, its name');
    assert.deepEqual(hurts, [['near', 20], ['near', 20]]);
    hurts = door([rec('struck', struck, 0), rec('proof', proof, 2)], me);
    LP.lootStrike(me, struck, 40, bow);
    assert.deepEqual([raised().length, hurts], [1, []], 'shock-proof: nothing lands, nothing said');
    door([rec('struck', struck, 0), rec('far', far, 9)], me);
    LP.lootStrike(me, struck, 40, bow);
    assert.equal(raised().length, 1, 'none in reach: nothing said');
  } finally { unmountHitNumbers(); delete globalThis.document; }
});

test('CHAIN-SEEN EVERY REACH ON ANOTHER FOE SAYS ITS HARM: Earthshaker\'s quake a number on each foe it reaches, Dragonfire\'s burst on each Daedra it reaches and its second burn on the struck one - each tagged with its power\'s name (ROSE-SEEN\'s law, again()\'s); the foes it never reaches say nothing (mutants: the quake silent; its word never handed; the burst silent; the burn untagged; its word never handed)', () => {
  const raised = numbers();
  try {
    fresh(); mountHitNumbers();
    assert.equal(LR.powerOf('orsiniums-anvil').name, 'Earthshaker');
    const me = player(), anvil = wear(me, legendary('orsiniums-anvil'));
    const struck = foe(ORC);
    let hurts = door([rec('struck', struck, 0), rec('a', foe(ORC), 2), rec('b', foe(ORC), 2.5, 1), rec('c', foe(ORC), 5)], me);
    LP.lootStrike(me, struck, 40, anvil);
    assert.deepEqual(hurts, [['a', 10], ['b', 10]], 'a quarter to every other foe within 3 m, as before');
    assert.deepEqual(raised(), [['10', 'Earthshaker'], ['10', 'Earthshaker']], 'a number each');
    fresh(); mountHitNumbers();
    assert.equal(DRAGONFIRE.name, 'Dragonfire');
    const me2 = player(), oath = wear(me2, mintGilded(DRAGONFIRE_OATH));
    const daedroth = foe(DAEDROTH);
    hurts = door([rec('struck', daedroth, 0), rec('near', foe(FIRE_DAEDRA), 1.5), rec('orc', foe(ORC), 1)], me2);
    const before = raised().length;
    LP.lootStrike(me2, daedroth, 90, oath);
    assert.deepEqual(hurts.sort(), [['near', 30], ['struck', 30]], 'its burn and its burst, as before');
    assert.deepEqual(raised().slice(before), [['30', 'Dragonfire'], ['30', 'Dragonfire']], 'the struck one\'s burn named, the burst\'s number named');
  } finally { unmountHitNumbers(); delete globalThis.document; }
});
