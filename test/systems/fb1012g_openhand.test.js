// FIELD BUGS 2026-10-12g OPEN-HAND - "Im doing less dmg with the Rose gauntlets then I do without them": "The gauntlets
// do 2 Hits for hand to hand (2nd Hit only 50% since last update) ... from Place 11 in Gate without them to 26 with the
// biggest Hand to hand Upgrade". BAL7's half is right, and on the first blow it changes nothing; the second blow went
// through the struck foe's record in the player's door, and the gate's Warden is no host's foe record - the relay runs
// him - so at the Gate Open Hand struck once. Its follow-up is owed now (systems/playerDoor.js) and the dungeon host's
// claim to the relay carries it, one frame and one blow token; a player's body takes none (BAL8). The 80-90 a crit
// against 100-130 is the lycanthrope's curse made the beast's alone (BAL6), in the same update - answered on the page.
// bible/01-Overview/bugs/Field-Bugs-2026-10-12g.md.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as LP from '../../src/systems/loot/lootPowers.js';
import { _resetSetPowersForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { setPlayerDoor, oweFoe, takeOwed } from '../../src/systems/playerDoor.js';
import { equipItem } from '../../src/systems/equip.js';
import { mintCondition } from '../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { bossStandIn, bossLookOf } from '../../src/world/gate/gateBoss.js';

const fresh = () => { _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); _resetSetPowersForTests(); setPlayerDoor(null); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 20, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 0, maxMagicka: 100 });
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };
const rose = () => {
  const rec = LR.legendaryById('gauntlets-of-the-rose');
  const it = LR.applyRarity(mintCondition({ group: rec.group, templateIndex: rec.templates[0], material: ARMOR_MATERIAL.Leather, flags: 0 }), 'legendary', lcg(1), [rec]);
  it.isIdentified = true;
  return it;
};

test('OPEN-HAND the Rose\'s second blow on the gate\'s Warden - no foe record of the door - is owed, for half, and taken once; on a foe the door holds it lands through the door as ever and nothing is owed (mutants: the follow-up dropped again; owed twice over; taken and kept)', () => {
  fresh();
  const me = player();
  wear(me, rose());
  const warden = bossStandIn(bossLookOf('ruhn'), 'Ruhn');
  const hurts = [];
  const mob = { careerIndex: 7, career: {}, health: 100, maxHealth: 100 };
  setPlayerDoor({ foes: () => [{ entity: mob, ai: { feet: [0, 0, 0] }, dead: false }], feet: () => [0, 0, 0], hurtFoe: (f, n) => hurts.push(n), castOnPlayer: () => {}, player: () => me });
  LP.lootStrike(me, warden, 84, null);
  assert.deepEqual(hurts, [], 'the door holds no record of him');
  assert.equal(takeOwed(warden), 42, 'owed to his claim: half the blow');
  assert.equal(takeOwed(warden), 0, 'taken once');
  LP.lootStrike(me, mob, 84, null);
  assert.deepEqual(hurts, [42], 'a foe the door holds takes it through the door');
  assert.equal(takeOwed(mob), 0, 'and nothing is owed');
  LP.lootStrike(me, warden, 84, createWeapon(120, 0, () => 0.5));
  assert.equal(takeOwed(warden), 0, 'a weapon\'s blow is no fist\'s');
  LP.lootStrike(me, warden, 30, null); LP.lootStrike(me, warden, 1, null);
  assert.equal(takeOwed(warden), 16, 'owed blows add up until the claim takes them, never less than a point each');
  oweFoe(warden, 0); oweFoe(null, 5);
  assert.equal(takeOwed(warden), 0); assert.equal(takeOwed(null), 0);
});

test('OPEN-HAND the dungeon host\'s claims carry what is owed - the Warden\'s, a crystal\'s, one of his host\'s - before the ward is read; a player\'s claim drops it (mutants: a claim without it; the rival\'s carrying it)', () => {
  const dc = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(dc, /function landOnBoss\(boss, damage, r\) \{\n\s*damage \+= takeOwed\(boss\.entity\);/);
  assert.match(dc, /const landOnCrystal = \(cr, damage, r\) => \{ damage \+= takeOwed\(cr\.entity\); return /);
  assert.match(dc, /const landOnHost = \(hb, damage, r, tick = false\) => \{ damage \+= takeOwed\(hb\.entity\); return /);   // PIN MOVED (FIELD BUGS 2026-10-19f BOSS-DOT): and a round's mark
  assert.match(dc, /const landOnRival = \(rb, damage, kind\) => \(takeOwed\(rb\.entity\), !!opts\.onArenaHit\?\.\(\{ i: rb\.rival, d: damage, kind,/);
  const lp = readFileSync(new URL('../../src/systems/loot/lootPowers.js', import.meta.url), 'utf8');
  assert.match(lp, /if \(f\) \{ if \(!f\.dead\) door\.hurtFoe\(f, n\); return; \}\n\s*oweFoe\(target, n\);/);
});
