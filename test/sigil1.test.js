// SIGIL1 (2026-09-25, Mac: "weapons obtained through online play recieve a sort of sigil power that is only effective
// online, which also scales with your renown. Sigil power does not work offline"; asked: "Bonus damage", "Magic and
// up, found online", "Bigger fights, stronger sigils", "Five named stages", and "Chance at the drop, then grows"):
// SOME WEAPONS WON ONLINE CARRY A SIGIL, AND IT GROWS (systems/sigil.js). The law's numbers; the blow, online and at
// a foe alone; the stamp over a won list; the drink and its words; the item field on the wire; the outdoor pool's
// kill door and its reader, driven; the hosts' other doors mounted from comment-stripped source or matched there.
// `06-Systems/Online-Arc.md` SIGIL1.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SIGIL_BANDS, SIGIL_POWER_MAX, SIGIL_CHANCE_BASE, SIGIL_CHANCE_PER, SIGIL_STAGES, SIGIL_XP_MAX, validSigil, sigilRank,
  renownSigilStage, sigilStageIn, sigilPercent, sigilChance, sigilFloor, rollSigil, setSigilOnline, setSigilRenown,
  sigilOnline, sigilRenown, drinkSigil, sigilRiseLine, sigilBlow, sigilLines, _resetSigilForTests,
} from '../src/systems/sigil.js';
import { stampWonWeapons, rarityLines } from '../src/systems/lootRarity.js';
import { weaponBlowMods } from '../src/systems/entityMods.js';
import { weaponAttackDamage } from '../src/combat/formulas.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { validItemField } from '../src/systems/itemFields.js';
import { validLootItem } from '../src/systems/loot.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { PARTY_MAX } from '../src/net/wire.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { _resetPartyScaleForTests } from '../src/systems/partyScale.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const mount = (src, scope, tail) => { const k = Object.keys(scope); return new Function(...k, `${src}\n${tail}`)(...k.map((x) => scope[x])); };
/** The balanced `open`..`close` run starting at the first `open` at or after `from`. */
function balanced(text, from, open = '(', close = ')') {
  let depth = 0;
  for (let i = text.indexOf(open, from); i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return text.slice(from, i + 1);
  }
  throw new Error('unbalanced');
}
const seq = (...v) => { let i = 0; return () => v[i++]; };
const magicSword = (extra = {}) => ({ group: 'Weapons', templateIndex: 120, material: 0, rarity: 'magic', affixes: [], ...extra });

test('SIGIL1 the law: a sigil\'s power is a per cent of damage at its full rank, in its tier\'s band (Magic 2-5, Rare 4-8, Legendary 7-12); a won weapon carries one 200 per mille alone and 40 more a fighter past the first, the band\'s floor rising a seventh a fighter so eight always win its top; five stages - Faint, Kindled, Bright, Radiant, Ascendant - each 20% more of the power, the sigil\'s own rank by what it has drunk and the wielder\'s Renown opening each at 1, 10, 20, 30, 40, the lower of the two standing; no Renown, dormant (mutants: a band, the chance, the floor, a stage\'s share or threshold, the lower of the two, a forged record taken)', () => {
  assert.deepEqual(SIGIL_BANDS, { magic: [2, 5], rare: [4, 8], legendary: [7, 12] });
  assert.equal(SIGIL_POWER_MAX, 12);
  assert.deepEqual([SIGIL_CHANCE_BASE, SIGIL_CHANCE_PER], [200, 40]);
  assert.deepEqual(SIGIL_STAGES.map((s) => [s.name, s.xp, s.renown, s.share]), [
    ['Faint', 0, 1, 20], ['Kindled', 5000, 10, 40], ['Bright', 12500, 20, 60], ['Radiant', 22500, 30, 80], ['Ascendant', 37500, 40, 100],
  ]);
  assert.equal(SIGIL_XP_MAX, 37500);
  assert.deepEqual([1, 2, 4, 8, 99, 0, Number.NaN].map(sigilChance), [200, 240, 320, 480, 480, 200, 200], 'one in five alone, nearly one in two for a full party');
  assert.deepEqual([1, 2, 4, 8].map((n) => sigilFloor('magic', n)), [2, 2, 3, 5]);
  assert.deepEqual([1, 2, 4, 8].map((n) => sigilFloor('rare', n)), [4, 5, 6, 8]);
  assert.deepEqual([1, 2, 4, 8].map((n) => sigilFloor('legendary', n)), [7, 8, 9, 12], 'a fight of eight: the band\'s top');
  assert.equal(sigilFloor('common', 8), 0);
  // the roll: at or over the chance, nothing; under it, a fresh record at Faint, the power from the fight's floor up
  assert.equal(rollSigil('magic', 1, seq(0.2)), null, '200 per mille is not under 200');
  assert.deepEqual(rollSigil('magic', 1, seq(0.1999, 0)), { power: 2, party: 1, xp: 0 });
  assert.deepEqual(rollSigil('magic', 1, seq(0, 0.999)), { power: 5, party: 1, xp: 0 }, 'the band is inclusive');
  assert.deepEqual(rollSigil('legendary', 1, seq(0, 0)), { power: 7, party: 1, xp: 0 });
  assert.equal(rollSigil('legendary', 1, seq(0.3)), null);
  assert.deepEqual(rollSigil('legendary', 8, seq(0.47, 0)), { power: 12, party: 8, xp: 0 }, 'eight fighting: 480 per mille, and the top every time');
  assert.deepEqual(rollSigil('rare', 4, seq(0.3, 0)), { power: 6, party: 4, xp: 0 });
  assert.deepEqual(rollSigil('rare', 99, seq(0, 0)), { power: 8, party: PARTY_MAX, xp: 0 }, 'never past the seats');
  assert.equal(rollSigil('common', 8, seq(0, 0)), null);
  assert.equal(rollSigil('artifact', 8, seq(0, 0)), null);
  // the rank, the stage, the per cent
  const s = (xp, power = 10) => ({ power, party: 1, xp });
  assert.deepEqual([0, 4999, 5000, 12499, 12500, 22499, 22500, 37499, 37500].map((x) => sigilRank(s(x))), [0, 0, 1, 1, 2, 2, 3, 3, 4]);
  assert.deepEqual([null, 0, 1, 9, 10, 19, 20, 29, 30, 39, 40, 50, 1.5, Number.NaN].map(renownSigilStage), [-1, -1, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, -1, -1]);
  assert.equal(sigilStageIn(s(37500), 12), 1, 'an Ascendant sigil in a Renown 12 hand stands at Kindled');
  assert.equal(sigilStageIn(s(0), 50), 0, 'a Faint sigil in a Renown 50 hand stands at Faint');
  assert.equal(sigilStageIn(s(37500), null), -1, 'no Renown: dormant');
  assert.deepEqual([0, 5000, 12500, 22500, 37500].map((x) => sigilPercent(s(x, 12), 40)), [2.4, 4.8, 7.2, 9.6, 12]);
  assert.deepEqual([0, 5000, 12500, 22500, 37500].map((x) => sigilPercent(s(x, 5), 40)), [1, 2, 3, 4, 5]);
  assert.equal(sigilPercent(s(37500, 12), 25), 7.2, 'held at Bright by Renown 25');
  assert.equal(sigilPercent(s(37500, 12), null), 0);
  // the record
  assert.ok(validSigil({ power: 1, party: 1, xp: 0 }));
  assert.ok(validSigil({ power: SIGIL_POWER_MAX, party: PARTY_MAX, xp: SIGIL_XP_MAX }));
  for (const bad of [null, [], 'Ascendant', { power: 0, party: 1, xp: 0 }, { power: 13, party: 1, xp: 0 }, { power: 2.5, party: 1, xp: 0 },
    { power: 2, party: 0, xp: 0 }, { power: 2, party: PARTY_MAX + 1, xp: 0 }, { power: 2, party: 1, xp: -1 }, { power: 2, party: 1, xp: SIGIL_XP_MAX + 1 },
    { power: 2, party: 1, xp: 0.5 }, { power: 2, party: 1 }]) {
    assert.equal(validSigil(bad), false, JSON.stringify(bad));
    assert.equal(sigilPercent(bad, 40), 0, 'a forged record gives nothing');
  }
});

test('SIGIL1 the blow: online, with my Renown known, my weapon\'s sigil adds its per cent of the whole blow at a foe, the fraction carried on the weapon (Faint 2.4% on blows of 10 lands a point on the 5th and the 9th); offline, or online before my Renown is known, nothing; never a duel\'s blow, a peer\'s, a foe\'s, a blow at a player, a hand without a sigil; FormulaHelper\'s weapon damage reads it at its tail (mutants: the online gate, the Renown cap, the carry, the duel\'s stub or a player target taken, the registration or the tail dropped)', () => {
  _resetSigilForTests();
  const me = { isPlayer: true };
  const rat = { careerIndex: 0 };
  const held = (xp, power = 12) => magicSword({ sigil: { power, party: 1, xp } });
  assert.equal(sigilBlow(held(37500), 100, me, rat), 100, 'offline: dormant');
  setSigilRenown(40);
  assert.equal(sigilRenown(), null, 'offline, no Renown is taken');
  setSigilOnline(true);
  assert.equal(sigilOnline(), true);
  assert.equal(sigilBlow(held(37500), 100, me, rat), 100, 'online, before my Renown is known: dormant');
  setSigilRenown(1);
  const faint = held(0);
  assert.deepEqual(Array.from({ length: 10 }, () => sigilBlow(faint, 10, me, rat)), [10, 10, 10, 10, 11, 10, 10, 10, 11, 10], 'Faint 2.4% of 10, carried');
  assert.equal(sigilBlow(held(0), 10, me, rat), 10, 'a second weapon carries its own');
  setSigilRenown(40);
  assert.equal(sigilBlow(held(37500), 100, me, rat), 112, 'Ascendant in a Renown 40 hand: the whole power');
  setSigilRenown(12);
  assert.equal(sigilBlow(held(37500), 100, me, rat), 104, 'held at Kindled by Renown 12: 4.8 of 100');
  setSigilRenown(40);
  assert.equal(sigilBlow(held(37500), 100, { isPlayer: true, peer: true }, rat), 100, 'a peer\'s blow resolved here - the duel\'s stub');
  assert.equal(sigilBlow(held(37500), 100, me, { isPlayer: true }), 100, 'a blow at a player');
  assert.equal(sigilBlow(held(37500), 100, { careerIndex: 0 }, me), 100, 'a foe\'s blow');
  assert.equal(sigilBlow(held(37500), 100, { careerIndex: 0 }, rat), 100, 'a foe\'s blow at a foe');
  assert.equal(sigilBlow(magicSword(), 100, me, rat), 100, 'no sigil');
  assert.equal(sigilBlow(null, 100, me, rat), 100, 'the bare hand');
  assert.equal(sigilBlow(held(37500), 100, me, null), 100);
  assert.equal(sigilBlow(held(37500), 0, me, rat), 0, 'a miss stays a miss');
  assert.equal(weaponBlowMods(held(37500), 100, me, rat), 112, 'registered with the entity\'s blow modifiers');
  // FormulaHelper's weapon damage, whole: a player's longsword at a rat
  const player = { isPlayer: true, level: 1, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, activeEffects: [], items: [] };
  const w = createWeapon(120, 0, () => 0.5);
  const base = weaponAttackDamage(player, rat, 42, w, () => 0.5);   // a swing's modifier big enough that a tenth is whole
  assert.equal(base, 50, 'the longsword\'s 8 and the swing\'s 42');
  w.sigil = { power: 10, party: 1, xp: 37500 };
  assert.equal(weaponAttackDamage(player, rat, 42, w, () => 0.5), 55, 'the sigil over the whole blow');
  setSigilOnline(false);
  assert.equal(sigilRenown(), null, 'going offline forgets the Renown');
  assert.equal(weaponAttackDamage(player, rat, 42, w, () => 0.5), 50, 'offline: the blow as Daggerfall rolls it');
  _resetSigilForTests();
});

test('SIGIL1 the stamp: a list won online - a body at its death, a pile at its mint - marks each Magic, Rare or Legendary weapon one time in five alone, more in a bigger fight, the power from the fight\'s floor; never ammunition, an artifact, a quest\'s item, a Common weapon, armour, one already marked; offline, or with the ladder off, nothing (mutants: the online gate, the ladder gate, the group, ammunition, a quest\'s item, one marked twice, the fight unread)', () => {
  _resetSigilForTests();
  setPref('lootRarity', true);
  const list = () => [
    magicSword(),
    { group: 'Weapons', templateIndex: 122, material: 0, rarity: 'legendary', affixes: [] },
    { group: 'Weapons', templateIndex: 113, material: 0 },
    { group: 'Weapons', templateIndex: 131, material: 0, rarity: 'magic' },
    { group: 'Weapons', templateIndex: 123, material: 0, rarity: 'rare', artifact: true },
    { group: 'Weapons', templateIndex: 121, material: 0, rarity: 'rare', questItem: true },
    { group: 'Armor', templateIndex: 102, material: 0, rarity: 'rare' },
    { group: 'Weapons', templateIndex: 118, material: 0, rarity: 'rare', sigil: { power: 4, party: 1, xp: 77 } },
  ];
  const offline = list();
  assert.equal(stampWonWeapons(offline, 8, { rolls: () => 0 }), 0, 'offline: nothing, whatever the odds');
  assert.ok(offline.slice(0, 7).every((it) => it.sigil === undefined));
  setSigilOnline(true);
  const won = list();
  assert.equal(stampWonWeapons(won, 4, { rolls: () => 0 }), 2, 'the Magic sword and the Legendary claymore');
  assert.deepEqual(won[0].sigil, { power: 3, party: 4, xp: 0 }, 'four fighting: the Magic band from 3');
  assert.deepEqual(won[1].sigil, { power: 9, party: 4, xp: 0 }, 'and the Legendary band from 9');
  assert.ok(won.slice(2, 7).every((it) => it.sigil === undefined), 'Common, ammunition, an artifact, a quest\'s, armour: never');
  assert.deepEqual(won[7].sigil, { power: 4, party: 1, xp: 77 }, 'one already marked keeps its own');
  const at = (v) => () => v;
  assert.equal(stampWonWeapons([magicSword()], 1, { rolls: at(0.21) }), 0, '210 per mille misses alone');
  assert.equal(stampWonWeapons([magicSword()], 2, { rolls: at(0.21) }), 1, 'and lands for two');
  assert.equal(stampWonWeapons([magicSword()], 1, { rolls: at(0.999) }), 0);
  setPref('lootRarity', false);
  assert.equal(stampWonWeapons(list(), 8, { rolls: () => 0 }), 0, 'the ladder off: no tier, no sigil');
  setPref('lootRarity', true);
  assert.equal(stampWonWeapons(null, 8), 0);
  _resetSigilForTests();
});

test('SIGIL1 the drink and the words: the weapon in my hand drinks the Renown XP I earn with it - online, my Renown known - as a NEW record (a copy taken before keeps its own), never past Ascendant, and says a rise, with what my Renown holds it at; a tooltip reads what it gives in my hand, how far it has grown and what holds it, and sleeps offline - under the tier and its affixes, on an unidentified weapon too (mutants: a drink offline, the record written in place, the cap, a rise unsaid, the hold unsaid, the lines dropped)', () => {
  _resetSigilForTests();
  const sword = magicSword({ name: 'Longsword', sigil: { power: 10, party: 3, xp: 4990 } });
  assert.equal(drinkSigil(sword, 100), null, 'offline: it drinks nothing');
  assert.equal(sword.sigil.xp, 4990);
  setSigilOnline(true);
  assert.equal(drinkSigil(sword, 100), null, 'online, my Renown unknown: nothing');
  assert.equal(sword.sigil.xp, 4990);
  setSigilRenown(5);
  const before = sword.sigil;
  const copy = { ...sword };   // a save's or a stream's copy
  assert.equal(drinkSigil(sword, 5), null, 'short of the stage');
  assert.equal(sword.sigil.xp, 4995);
  assert.equal(drinkSigil(sword, 12.9), 1, 'over it: Kindled');
  assert.equal(sword.sigil.xp, 5007, 'whole points');
  assert.notEqual(sword.sigil, before, 'a new record');
  assert.equal(before.xp, 4990, 'the old one unwritten');
  assert.equal(copy.sigil.xp, 4990, 'a copy taken before keeps what it took');
  assert.equal(drinkSigil(sword, 1e9), 4, 'a flood: Ascendant');
  assert.equal(sword.sigil.xp, SIGIL_XP_MAX, 'and no further');
  assert.equal(drinkSigil(sword, 100), null, 'full');
  assert.equal(drinkSigil(magicSword(), 100), null, 'no sigil');
  assert.equal(drinkSigil(sword, 0), null);
  assert.equal(drinkSigil(sword, -5), null);
  assert.equal(drinkSigil(null, 5), null);
  assert.equal(sigilRiseLine('Longsword', 1), 'The sigil on your Longsword brightens: Kindled. Your Renown holds it at Faint until Renown 10.');
  setSigilRenown(10);
  assert.equal(sigilRiseLine('Longsword', 1), 'The sigil on your Longsword brightens: Kindled.');
  assert.equal(sigilRiseLine('Longsword', 9), null);
  // the tooltip
  _resetSigilForTests();
  const rare = (xp, party = 3) => ({ group: 'Weapons', templateIndex: 120, material: 0, rarity: 'rare', affixes: [], sigil: { power: 8, party, xp } });
  assert.deepEqual(sigilLines(rare(0)), ['Sigil (Dormant - wakes online, with your Renown): +8% at Ascendant'], 'offline');
  setSigilOnline(true);
  assert.deepEqual(sigilLines(rare(0)), ['Sigil (Dormant - wakes online, with your Renown): +8% at Ascendant'], 'online, my Renown unknown');
  setSigilRenown(15);
  assert.deepEqual(sigilLines(rare(7000)), ['Sigil (Kindled): +3.2% damage, +8% at Ascendant', 'Kindled: 7,000 / 12,500 to Bright', 'Won in a fight of 3']);
  assert.deepEqual(sigilLines(rare(30000)), ['Sigil (Kindled): +3.2% damage, +8% at Ascendant', 'Held at Kindled by your Renown (Bright at Renown 20)', 'Won in a fight of 3']);
  setSigilRenown(40);
  assert.deepEqual(sigilLines(rare(37500, 1)), ['Sigil (Ascendant): +8% damage, +8% at Ascendant'], 'full, and won alone');
  assert.deepEqual(sigilLines(rare(0, 1)), ['Sigil (Faint): +1.6% damage, +8% at Ascendant', 'Faint: 0 / 5,000 to Kindled']);
  assert.deepEqual(sigilLines(magicSword()), []);
  assert.deepEqual(sigilLines({ ...magicSword(), sigil: { power: 99, party: 1, xp: 0 } }), [], 'a forged record shows nothing');
  assert.deepEqual(rarityLines(rare(7000)), ['Rare', 'Sigil (Kindled): +3.2% damage, +8% at Ascendant', 'Kindled: 7,000 / 12,500 to Bright', 'Won in a fight of 3'], 'under the tier and its affixes');
  const unidentified = { ...rare(7000), enchantments: [{ type: 1, param: 0 }], isIdentified: false };
  assert.deepEqual(rarityLines(unidentified), ['Rare', 'Unidentified', 'Sigil (Kindled): +3.2% damage, +8% at Ascendant', 'Kindled: 7,000 / 12,500 to Bright', 'Won in a fight of 3'], 'a sigil is the port\'s own mark, seen at once');
  _resetSigilForTests();
});

test('SIGIL1 the item field: a sigil rides a won item across the wire as a copy, and a forged one is no item at all (mutants: the field undeclared)', () => {
  assert.deepEqual(validItemField('sigil', { power: 5, party: 2, xp: 10 }), { power: 5, party: 2, xp: 10 });
  assert.equal(validItemField('sigil', { power: 50, party: 2, xp: 10 }), undefined);
  const sword = { templateIndex: 120, group: 'Weapons', name: 'Longsword', material: 0, value: 1, rarity: 'magic', affixes: [], sigil: { power: 5, party: 2, xp: 10 } };
  const got = validLootItem(sword);
  assert.deepEqual(got.sigil, { power: 5, party: 2, xp: 10 });
  assert.notEqual(got.sigil, sword.sigil, 'a copy, never the sender\'s record');
  assert.equal(validLootItem({ ...sword, sigil: { power: 50, party: 2, xp: 10 } }), null, 'a forged power');
  assert.equal(validLootItem({ ...sword, sigil: { power: 5, party: 2, xp: 1e9 } }), null, 'a forged rank');
  assert.equal(validLootItem({ ...sword, sigil: 'Ascendant' }), null);
});

// ── THE OUTDOOR POOL, DRIVEN (pscale1.test.js's crafted rat) ─────────
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
const playerEntity = () => ({ isPlayer: true, level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const rig = (extra = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
  ...extra,
});
const clock = { t: 1000 };
const netted = (pool, { self = 'mac-0001', peers = [] } = {}) => pool.setNet({ selfId: () => self, room: () => 'world:3,12', inRoom: () => true, peers: () => peers, now: () => clock.t, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
const settle = () => new Promise((r) => setTimeout(r, 20));
const blowFrom = (pool, f, who, dmg = 0) => pool.damageFoe(f, dmg, null, null, who === 'me' ? { fromPlayer: true } : { fromPlayer: true, peer: true, peerId: who });

test('SIGIL1 outdoors, driven: the owner\'s kill door marks the body\'s won weapons at the fight\'s size - four fighting it, a Magic sword from 3 - whoever struck last; a reader keeps the count the foe DIED at, since a body\'s record carries none (its Renown bonus reads it); offline the same kill marks nothing (mutants: the stamp unwired, the fight unread, the reader\'s count reset by the body\'s record)', async () => {
  _resetPartyScaleForTests(); _resetSigilForTests();
  setPref('lootRarity', true);
  setSigilOnline(true);
  clock.t = 1000;
  const owner = createExteriorFoes(rig({ rolls: () => 0 }));
  netted(owner);
  const rat = await owner.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  rat.entity.health = rat.entity.maxHealth = 100;
  const sword = magicSword();
  rat.entity.items = [sword];
  for (const id of ['bob-0002', 'carl-0003', 'dave-0004']) blowFrom(owner, rat, id, 0);
  blowFrom(owner, rat, 'me', 1);
  const reader = createExteriorFoes(rig());
  netted(reader, { self: 'eve-0005' });
  reader.applyFoes('mac-0001', owner.foesFrame(true)); await settle();
  const pup = reader.foes.find((f) => f.puppet === 'mac-0001');
  assert.equal(pup._fightN, 4, 'four fight it');
  blowFrom(owner, rat, 'bob-0002', 1000);
  assert.ok(rat.dead, 'bob\'s blow kills it');
  assert.deepEqual(sword.sigil, { power: 3, party: 4, xp: 0 }, 'the body\'s Magic sword, won in a fight of four');
  const body = owner.foesFrame(true).f.find((r) => r.i === rat.seq);
  assert.equal(body.d, 1);
  assert.equal(body.n, undefined, 'a body\'s record carries no count');
  reader.applyFoes('mac-0001', owner.foesFrame(true)); await settle();
  assert.ok(pup.dead, 'the reader\'s copy fell');
  assert.equal(pup._fightN, 4, 'and keeps the fight it died in');
  // offline, the same kill
  _resetPartyScaleForTests(); _resetSigilForTests();
  const solo = createExteriorFoes(rig({ rolls: () => 0 }));
  const rat2 = await solo.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  const sword2 = magicSword();
  rat2.entity.items = [sword2];
  solo.damageFoe(rat2, 10_000, null, null, { fromPlayer: true });
  assert.ok(rat2.dead);
  assert.equal(sword2.sigil, undefined, 'offline, never');
});

test('SIGIL1 the hosts: the session is online from the boot\'s first line and my Renown wakes the sigils where the page adopts it; the kill and the quest feed the weapon in my hand the XP they earn, a rise is said, and past the hour\'s cap nothing is drunk (mounted); every other door marks its list - the dungeon host\'s kill at its fight, a joiner\'s copy of a body at the host\'s count, a body the room\'s memory hands an arrival, every dungeon pile, the watch\'s kill, the World of Daggerfall piles, a tavern\'s treasure; and a joiner reads the count off live records alone (mutants: each door unwired; the drink unwired or uncapped; the session never online; the Renown never taken)', () => {
  const W = strip(read('src/scenes/world.js'));
  const boot = W.indexOf('export async function bootWorld(');
  const on = W.indexOf("setSigilOnline(params.has('online'));");
  assert.ok(boot >= 0 && on > boot && on < W.indexOf('openWodWorld(', boot), 'online from the boot\'s first lines - before any list is minted');
  assert.match(W, /setRenownLayer\(playerEntity, level\);\s*setSigilRenown\(level\);\s*return renownNow;/, 'my Renown, where the page adopts it');
  assert.match(W, /const xp = renownPartyXp\([^;]*;\s*renownTracker\.earn\(xp\);\s*sigilDrinks\(xp\);/, 'a kill feeds what it earns');
  assert.match(W, /const xp = renownQuestXp\(playerEntity\.level, renownNow\);\s*renownTracker\.earn\(xp\);\s*sigilDrinks\(xp\);/, 'and a quest');
  assert.match(W, /rollLootRarity\(items, pileSource\(dungeonRarityTier\(WOD_LOOT_LOCATION_INDEX\)\), \{ luck: liveStat\(playerEntity, 'luck'\) \}\);\s*stampWonWeapons\(items, 1\);/, 'a World of Daggerfall pile');
  // the drink, mounted
  const a = W.indexOf('const sigilDrinks = (xp) => {');
  const drinks = (cap, held, said) => mount(balanced(W, a, '{', '}'), {
    _renownCapHour: cap, weaponRig: { playerWeapon: { strikingWeapon: held } }, drinkSigil, sigilRiseLine, itemLongName,
    townTalk: { say: (l) => said.push(l) },
  }, 'return sigilDrinks;');
  _resetSigilForTests();
  setSigilOnline(true); setSigilRenown(12);
  const said = [];
  const held = createWeapon(120, 0, () => 0.5);
  held.sigil = { power: 5, party: 1, xp: 4999 };
  drinks(null, held, said)(5);
  assert.equal(held.sigil.xp, 5004, 'the weapon in my hand drinks');
  assert.deepEqual(said, [`The sigil on your ${itemLongName(held)} brightens: Kindled.`], 'and the rise is said');
  drinks(null, held, said)(5);
  assert.equal(said.length, 1, 'a drink that rises nothing says nothing');
  drinks(Math.floor(Date.now() / 3_600_000), held, said)(5000);
  assert.equal(held.sigil.xp, 5009, 'past the hour\'s cap it drinks nothing');
  drinks(null, null, said)(5000);
  assert.equal(said.length, 1, 'a bare hand drinks nothing');
  _resetSigilForTests();
  // the dungeon
  const D = strip(read('src/scenes/dungeonContext.js'));
  assert.match(D, /stampWonWeapons\(foe\.entity\.items, _sharedFoe\(foe\) \? fightN\(foe\) : 1\);\s*raiseEnemyDeath\(foe\.entity,/, 'the host\'s kill, at its fight');
  assert.match(D, /if \(r\.d === 1 && !f\.dead\) \{ addCorpseFood\(f\.entity, \{ luck: liveStat\(playerEntity, 'luck'\) \}\); stampWonWeapons\(f\.entity\.items, f\._fightN \?\? 1\); \}/, 'a joiner\'s copy of the body, at the host\'s count');
  assert.match(D, /if \(wire && sf\.dead && !f\.dead && sf\.items == null\) \{ addCorpseFood\(f\.entity, \{ luck: liveStat\(playerEntity, 'luck'\) \}\); stampWonWeapons\(f\.entity\.items, 1\); \}/, 'a body the room\'s memory hands an arrival');
  assert.match(D, /function rollPileItems\(\) \{[\s\S]{0,400}?rollLootRarity\([^;]*;\s*stampWonWeapons\(items, 1\);\s*return items;/, 'every pile, at the build and the hour\'s respawn');
  assert.match(D, /if \(r\.d !== 1\) f\._fightN = r\.n \?\? 1;/, 'a joiner reads the count off live records alone');
  assert.match(strip(read('src/scenes/exteriorFoes.js')), /if \(r\.d !== 1\) f\._fightN = r\.n \?\? 1;/, 'and an outdoor reader');
  assert.match(strip(read('src/scenes/cityGuards.js')), /stampWonWeapons\(g\.entity\.items, 1, \{ rolls: rand \}\);\s*raiseEnemyDeath\(g\.entity,/, 'the watch\'s kill');
  assert.match(strip(read('src/scenes/interiorContext.js')), /pileSource\(INTERIOR_RARITY_TIER\), \{ luck \}\);\s*stampWonWeapons\(items, 1\);/, 'a tavern\'s treasure');
});
