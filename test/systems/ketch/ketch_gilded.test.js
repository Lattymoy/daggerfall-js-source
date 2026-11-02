// KETCH (2026-10-24; bible/06-Systems/Gilded.md section 10): THE KETCH'S TWO GILDED GUNS - Volendrung's Echo (a gilded
// Thunderlock) and the Ketchmaster's Word (a gilded Pistolet): their records, the band's top and no higher, minted as the
// guns' own door mints them and lawful on the wire; and their powers - HAMMERFALL (a landed shot rings half of itself as
// shock on every OTHER foe within 3.5 m, by each one's resistance) and BROADSIDE (a landed shot marks the foe 2.5 s: the
// next blow of the other hand on it strikes 60% harder, and the mark is spent). tools/mutants/ketch_gilded.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import * as LP from '../../../src/systems/loot/lootPowers.js';
import * as CX from '../../../src/systems/loot/lootCodex.js';
import { VOLENDRUNGS_ECHO, KETCHMASTERS_WORD, HAMMERFALL, BROADSIDE, HOURLOCK, GILDED, mintGilded, validGildedMarks } from '../../../src/systems/gilded.js';
import { THUNDERLOCK_TEMPLATE } from '../../../src/systems/thunderlock.js';
import { PISTOLET_TEMPLATE } from '../../../src/systems/pistolet.js';
import { WEAPON_MATERIALS, WEAPONS } from '../../../src/characters/weapons.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { validLootItem } from '../../../src/systems/loot/loot.js';
import { BRIEF_MAX, setSetsDueling, _resetSigilSetsForTests } from '../../../src/systems/sigil/sigilSets.js';
import { _resetSetPowersForTests } from '../../../src/systems/sigil/sigilSetPowers.js';
import { equipItem } from '../../../src/systems/equip.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { EFFECT_FLAGS } from '../../../src/systems/spellcast.js';
import { setPlayerDoor, takeOwed } from '../../../src/systems/playerDoor.js';

const wire = (it) => validLootItem(JSON.parse(JSON.stringify(it)));
const lines = (r) => r.affixes.map((a) => [a.id, a.param ?? null, a.value]);
let T = 0;
LP._setLootPowersClockForTests(() => T);
const fresh = () => {
  _resetForTests(); setPref('lootRarity', true); CX._resetCodexForTests();
  LP._resetLootPowersForTests(); _resetSetPowersForTests(); _resetSigilSetsForTests();
  setPlayerDoor(null); T = 0; LP.setLootPowersVoice({ say: () => {} });
};
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 20, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 50, maxMagicka: 100, goldPieces: 0 });
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };
const foe = (extra = {}) => ({ careerIndex: 7, career: {}, health: 100, maxHealth: 100, level: 10, ...extra });
const rec = (name, entity, x, z = 0) => ({ name, entity, ai: { feet: [x, 0, z] }, dead: false });

test('KETCH THE RECORDS: Volendrung\'s Echo a Dwarven Thunderlock, the Ketchmaster\'s Word a Dwarven Pistolet - each the Hourlock\'s band-top lines as a gun (the Word\'s Speed for its Agility), a power each, a hint of the airship; minted by the guns\' own door, Gilded, known, and lawful on the wire exactly (mutants: the Echo a bow; the Word\'s lines over the band; a mint the wire refuses)', () => {
  fresh();
  assert.deepEqual([VOLENDRUNGS_ECHO.templateIndex, VOLENDRUNGS_ECHO.material], [THUNDERLOCK_TEMPLATE, WEAPON_MATERIALS.Dwarven]);
  assert.deepEqual([KETCHMASTERS_WORD.templateIndex, KETCHMASTERS_WORD.material], [PISTOLET_TEMPLATE, WEAPON_MATERIALS.Dwarven]);
  assert.deepEqual(lines(VOLENDRUNGS_ECHO), lines(HOURLOCK), 'the Hourlock\'s lines, on a gun');
  assert.deepEqual(lines(KETCHMASTERS_WORD), [['damage', null, 40], ['stat', 'speed', 15], ['skill', SKILLS.Archery, 30], ['elemental', 'shock', 10]]);
  assert.deepEqual([VOLENDRUNGS_ECHO.power, KETCHMASTERS_WORD.power], [HAMMERFALL, BROADSIDE]);
  for (const P of [HAMMERFALL, BROADSIDE]) assert.ok(P.brief.length <= BRIEF_MAX, `${P.name}'s brief fits its row`);
  assert.deepEqual({ share: HAMMERFALL.share, metres: HAMMERFALL.metres }, { share: 50, metres: 3.5 });
  assert.deepEqual({ pct: BROADSIDE.pct, seconds: BROADSIDE.seconds }, { pct: 60, seconds: 2.5 });
  for (const R of [VOLENDRUNGS_ECHO, KETCHMASTERS_WORD]) {
    assert.match(R.hint, /airship/);
    const it = mintGilded(R);
    assert.equal(it.templateIndex, R.templateIndex);
    assert.equal(it.rarity, GILDED);
    assert.equal(it.gilded, R.id);
    assert.equal(it.isIdentified, true);
    assert.ok(validGildedMarks(it));
    assert.ok(wire(it), `${R.name} lawful on the wire`);
    const off = (f) => { const c = JSON.parse(JSON.stringify(it)); f(c); return c; };
    assert.equal(wire(off((c) => { c.affixes[0].value = 39; })), null, 'one number off is a forgery');
    assert.equal(wire(off((c) => { c.affixes.pop(); })), null, 'a line short');
    assert.equal(wire(off((c) => { c.material = WEAPON_MATERIALS.Iron; })), null, 'another make');
    assert.equal(wire(off((c) => { c.templateIndex = WEAPONS.Long_Bow; })), null, 'another weapon');
  }
});

test('KETCH HAMMERFALL: a landed shot of the Echo rings half of itself as shock on every OTHER foe within 3.5 m, by each one\'s resistance (an immune one nothing) - never the struck one, never past its reach; another weapon\'s shots nothing; asleep in a duel; a body the relay runs (no record of the door) rings nothing and is owed nothing (mutants: the struck one rung; the reach unbounded; the resistance ignored)', () => {
  fresh();
  const me = player();
  const echo = wear(me, mintGilded(VOLENDRUNGS_ECHO));
  const struck = foe(), a = foe(), b = foe(), immune = foe({ career: { immunityFlags: EFFECT_FLAGS.Shock } }), past = foe();
  const foes = [rec('struck', struck, 0), rec('a', a, 1.5), rec('b', b, 0, 3.4), rec('immune', immune, 1), rec('past', past, 3.6)];
  const hurts = [];
  setPlayerDoor({ foes: () => foes.filter((f) => !f.dead), feet: () => [0, 0, 0], hurtFoe: (f, n) => hurts.push([f.name, n]), player: () => me });
  assert.deepEqual(LP.wornPowers(me).map((p) => p.id), ['volendrungs-echo']);
  LP.lootStrike(me, struck, 90, echo);
  assert.deepEqual(hurts.sort(), [['a', 45], ['b', 45]], 'half the shot to each within 3.5 m; the struck one, the immune one and the one past it none');
  hurts.length = 0;
  LP.lootStrike(me, struck, 90, createWeapon(WEAPONS.Long_Bow, 1));
  assert.deepEqual(hurts, [], 'another weapon\'s shot');
  setSetsDueling(true);
  LP.lootStrike(me, struck, 90, echo);
  assert.deepEqual(hurts, [], 'asleep in a duel');
  setSetsDueling(false);
  const relayBody = foe();
  LP.lootStrike(me, relayBody, 90, echo);
  assert.deepEqual(hurts, [], 'no record: no ring');
  assert.equal(takeOwed(relayBody), 0, 'and nothing owed - its neighbours are not the door\'s');
});

test('KETCH BROADSIDE: a landed shot of the Word marks the foe for 2.5 s; the next blow of ANOTHER weapon on it strikes 60% harder and spends the mark - a blow only asked (an estimate) spends nothing; the Word\'s own next shot answers nothing; another foe is unmarked; the mark lapses (mutants: the Word answering itself; the mark never spent; the mark everlasting; the estimate spending it)', () => {
  fresh();
  const me = player();
  const word = wear(me, mintGilded(KETCHMASTERS_WORD));
  const blade = createWeapon(WEAPONS.Longsword, 1);
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], player: () => me });
  const f = foe(), g = foe();
  assert.equal(LP.lootBlow(blade, 100, me, f, {}), 100, 'unmarked');
  LP.lootStrike(me, f, 50, word);
  assert.equal(LP.lootBlow(word, 100, me, f, {}) - LP.lootBlow(word, 100, me, g, {}), 0, 'the Word answers nothing of its own mark');
  assert.equal(LP.lootBlow(blade, 100, me, g, {}), 100, 'another foe unmarked');
  assert.equal(LP.lootBlow(blade, 100, me, f, { estimate: true }), 160, 'an estimate reads it');
  assert.equal(LP.lootBlow(blade, 100, me, f, {}), 160, 'the other hand answers: +60%');
  assert.equal(LP.lootBlow(blade, 100, me, f, {}), 100, 'spent');
  LP.lootStrike(me, f, 50, word);
  T = BROADSIDE.seconds + 0.01;
  assert.equal(LP.lootBlow(blade, 100, me, f, {}), 100, 'lapsed');
  LP.lootStrike(me, f, 50, blade);
  T += 0.5;
  assert.equal(LP.lootBlow(word, 100, me, f, {}) - LP.lootBlow(word, 100, me, g, {}), 0, 'a blade\'s blow calls no mark');
});
