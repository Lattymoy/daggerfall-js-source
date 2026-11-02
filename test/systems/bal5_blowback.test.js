// BAL5 - THE BLOW PAID BACK (2026-10-11; bible/05-Combat/Balance-Arc.md section 11). A player's report from the
// feature-feedback channel: "the Ancient Lich is an endgame mob in OG Daggerfall and I can just give it the light skin
// stare and let it attack me until thorns damage kills him" - and Troll's Blood, held, on a random Rare. Mac: "Make the
// best balancing decisions".
//
// The arc's measurement (section 2) stood a level-20 player in seven pieces of plain ebony - no loot line, no set. The
// two causes it could not see:
//   - THE THORNS paid back up to 25 on every foe's blow that landed, past the foe's armour and the metal it asks of a
//     weapon: a whole endgame swing (13.35 at an Ancient Lich in a Dragon's Den) for every blow taken, and the kill with
//     it. Now at most 10 - the top of a Legendary line's band - and a blow paid back (the thorns, Spite of the Spurned)
//     never takes a foe's last point: the kill is the player's to take (systems/playerDoor.js paidBack).
//   - TROLL'S BLOOD, held, on one Rare armour piece in nine: a Regenerate every magic round for as long as it is worn,
//     on a piece the port's smiths mend (DISC22-A). Retired from the draw; a piece that drew it keeps it, lawful.
//
// Pinned by execution through the real damage door (playerEntity.js hurtPlayer), the real Ancient Lich's row and the
// real Rare mint; the door stands in for the host's (systems/playerDoor.js) and lands its hurts on the foe's health.

import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as LP from '../../src/systems/loot/lootPowers.js';
import { setStruck, _resetSetPowersForTests, _setSetPowersClockForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, _resetSigilForTests } from '../../src/systems/sigil/sigil.js';
import { _resetSigilSetsForTests, SIGIL_SETS } from '../../src/systems/sigil/sigilSets.js';
import { hurtPlayer } from '../../src/characters/playerEntity.js';
import { setPlayerDoor, paidBack } from '../../src/systems/playerDoor.js';
import { equipItem } from '../../src/systems/equip.js';
import { mintCondition } from '../../src/systems/item/itemTemplates.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { makeEnemyEntity } from '../../src/characters/enemy/enemyEntity.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import { ENCHANTMENT_TYPES } from '../../src/systems/enchantments.js';
import { itemFindings } from '../../src/systems/item/itemLaw.js';

const T = ENCHANTMENT_TYPES;
_setSetPowersClockForTests(() => 0);   // a blow's mark and the door that takes it, at one moment
const fresh = () => {
  _resetForTests(); setPref('lootRarity', true);
  LP._resetLootPowersForTests(); _resetSetPowersForTests(); _resetSigilForTests(); _resetSigilSetsForTests(); setPlayerDoor(null);
};
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 20, career: {}, activeEffects: [], health: 1000, maxHealth: 1000, magicka: 0, maxMagicka: 1000 });
const plate = (t, affixes = [], sigil = null) => Object.assign(mintCondition({ group: 'Armor', templateIndex: t, material: ARMOR_MATERIAL.Ebony, flags: 0 }), { rarity: 'rare', affixes }, sigil ? { sigil } : {});
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };
const cuirass = () => mintCondition({ group: 'Armor', templateIndex: 102, material: ARMOR_MATERIAL.Ebony, flags: 0 });
/** The real Ancient Lich, as a dungeon mints it (DFU's row: 30-170 health, 70-100 a blow). */
const ancientLich = () => makeEnemyEntity(MOBILE_TYPES.AncientLich, ENEMY_BASICS[MOBILE_TYPES.AncientLich], { ...stats(), attackModifierFlags: 0 }, 21, () => 0.99);
/** The host's door, standing in: the foes my harm reaches, and each hurt LANDED on the foe's health, as a pool's door
 *  lands it (a foe at 0 is dead and gone from the list). */
function door(foes) {
  const d = { hurts: [] };
  setPlayerDoor({
    foes: () => foes.filter((f) => !f.dead),
    feet: () => [0, 0, 0],
    hurtFoe: (f, n) => { d.hurts.push(n); f.entity.health -= n; if (f.entity.health <= 0) f.dead = true; },
    castOnPlayer: () => {},
    player: () => null,
  });
  return d;
}
/** A foe's blow at me as the game deals one: the attack formula's struck tail marks it, my damage door takes it. */
const struck = (me, foe, n) => { me.health = me.maxHealth; setStruck(foe, me, n); hurtPlayer(me, n); };

test('BAL5 paidBack: a blow paid back takes what it would, never a foe\'s last point - a fraction of a point left counts as one; nothing for nothing; a record without a health taken at its word (mutants: the last point taken; the floor dropped; a nothing passed)', () => {
  const f = (health) => ({ entity: { health } });
  assert.equal(paidBack(f(50), 10), 10, 'a foe with room takes it whole');
  assert.equal(paidBack(f(8), 10), 7, 'a foe at 8 is left its last point');
  assert.equal(paidBack(f(1), 10), 0, 'a foe at its last point takes nothing');
  assert.equal(paidBack(f(1.4), 10), 1, 'a fraction over the last point: one whole point, and 0.4 stands');
  assert.equal(paidBack(f(0.5), 10), 0, 'under a point: nothing');
  assert.equal(paidBack(f(50), 0), 0, 'nothing paid back is nothing');
  assert.equal(paidBack({ entity: {} }, -3), 0, 'nor less than nothing');
  assert.equal(paidBack({ entity: {} }, 6), 6, 'a record that says no health is taken at its word');
});

test('BAL5 THE THORNS: all I wear, at most 10 a blow (it was 25) - and an Ancient Lich left to strike me is worn to its last point and never killed: the kill is mine (mutants: the cap at 25; the thorns past the floor; the floor at 0)', () => {
  fresh();
  assert.equal(LP.THORNS_CAP, 10);
  const me = player();
  wear(me, plate(102, [{ id: 'thorns', value: 6 }]));
  wear(me, plate(107, [{ id: 'thorns', value: 6 }]));
  wear(me, plate(104, [{ id: 'thorns', value: 6 }]));
  assert.equal(LP.wornSum(me, 'thorns'), 18, 'three Rare lines, summed');
  const lich = ancientLich();
  lich.health = 47;
  const rec = { name: 'lich', entity: lich, dead: false };
  const d = door([rec]);
  struck(me, lich, 80);
  assert.deepEqual(d.hurts, [10], 'eighteen worn, ten back: the cap');
  for (let i = 0; i < 40; i++) struck(me, lich, 80);
  assert.equal(lich.health, 1, 'worn down to its last point');
  assert.equal(rec.dead, false, 'and never killed by standing still');
  assert.deepEqual(d.hurts, [10, 10, 10, 10, 6], 'ten a blow while it has room, then what is left over its last point, then nothing');
});

test('BAL5 SPITE OF THE SPURNED: its share of what a blow took, back - and never the kill (mutants: Spite past the floor)', () => {
  fresh();
  setSigilOnline(true); setSigilRenown(1);
  const me = player();
  for (const t of [107, 106, 105, 102]) wear(me, plate(t, [], { set: 'malacath', party: 1, xp: 0 }));
  const lich = ancientLich();
  lich.health = 20;
  const rec = { name: 'lich', entity: lich, dead: false };
  const d = door([rec]);
  for (let i = 0; i < 10; i++) struck(me, lich, 80);
  assert.deepEqual(d.hurts, [8, 8, 3], 'a tenth of 80 at Faint, twice, then what is left over its last point');
  assert.equal(lich.health, 1);
  assert.equal(rec.dead, false);
  assert.match(SIGIL_SETS.malacath.tiers[1].text({ back: 10 }), /never kills/, 'the set\'s card says so');
});

test('BAL5 THE THORNS AND SPITE TOGETHER: each paid back over what the other left, so the two never make a kill between them', () => {
  fresh();
  setSigilOnline(true); setSigilRenown(1);
  const me = player();
  for (const t of [107, 106, 105, 102]) wear(me, plate(t, [{ id: 'thorns', value: 6 }], { set: 'malacath', party: 1, xp: 0 }));
  const lich = ancientLich();
  lich.health = 30;
  const rec = { name: 'lich', entity: lich, dead: false };
  const d = door([rec]);
  for (let i = 0; i < 10; i++) struck(me, lich, 80);
  assert.equal(lich.health, 1);
  assert.equal(rec.dead, false);
  assert.equal(d.hurts.reduce((a, b) => a + b, 0), 29, 'everything over its last point, and not one point more');
});

test('BAL5 TROLL\'S BLOOD: retired from the Rare armour draw - three thousand seeded Rares never draw it, and draw every other armour flavour - while a piece that drew it stays lawful and keeps it (mutants: the retired flavour drawn; the mark dropped; the flavour struck from the law)', () => {
  fresh();
  const troll = LR.RARE_FLAVOURS.Armor.find((f) => f.type === T.CastWhenHeld && f.param === 24);
  assert.ok(troll, 'still in the list - the law reads it');
  assert.equal(troll.retired, true);
  const live = LR.RARE_FLAVOURS.Armor.filter((f) => !f.retired).map((f) => `${f.type}:${f.param}`).sort();
  assert.equal(live.length, LR.RARE_FLAVOURS.Armor.length - 1, 'Troll\'s Blood alone is retired');
  const drawn = new Set();
  for (let seed = 1; seed <= 3000; seed++) {
    const r = LR.applyRarity(cuirass(), 'rare', lcg(seed));
    assert.equal(r.rarity, 'rare');
    const e = r.enchantments[0];
    assert.ok(!(e.type === T.CastWhenHeld && e.param === 24), `seed ${seed} drew Troll's Blood`);
    drawn.add(`${e.type}:${e.param}`);
  }
  assert.deepEqual([...drawn].sort(), live, 'every other armour flavour still drawn');
  // a Rare that drew it before BAL5: the same mint, its flavour Troll's Blood - the law finds nothing
  const old = LR.applyRarity(cuirass(), 'rare', lcg(7));
  assert.deepEqual(itemFindings(JSON.parse(JSON.stringify(old))), [], 'the mint is lawful');
  old.enchantments = [{ type: T.CastWhenHeld, param: 24 }];
  assert.deepEqual(itemFindings(JSON.parse(JSON.stringify(old))), [], 'and so is the piece that drew Troll\'s Blood');
  const forged = { ...old, enchantments: [{ type: T.CastWhenHeld, param: 10 }] };   // Free Action: never an armour flavour
  assert.ok(itemFindings(JSON.parse(JSON.stringify(forged))).includes('enchantments'), 'a flavour never in the list is still a finding');
});
