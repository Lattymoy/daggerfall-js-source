// POWER-CEILING, AUDIT HORIZONTAL D2 (bible/05-Combat/Power-Ceiling.md section 5): THE ROOM IS OBEYED, NOT ONLY ASKED. The
// source sweep proves each registry asks blowRoom or guardRoom; a registry that asked and then spent its raw per cent
// passed it. Here each one the execution pins in powerceiling.test.js did not reach - the sky's, mastery's and the
// martial path's blows, the sky's, the martial path's and the Living Aegis's guards, and Unbroken's half - runs with
// its power really awake, minted by its own producers: whole while there is room, nothing once the product is spent.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blowRoom, guardRoom, openBlowCeiling, closeBlowCeiling, ceilingProducts } from '../../src/systems/powerCeiling.js';
import { FIRM_NODES } from '../../src/net/firmament/firmamentTree.js';
import { pathTo, blowPct } from '../../src/net/firmament/firmamentLaw.js';
import { setFirmamentTree, setFirmamentOnline, firmamentStats, _resetFirmamentLiveForTests } from '../../src/systems/firmamentLive.js';
import { firmamentBlow, firmamentDamage, FIRMAMENT_POWERS, _resetFirmamentPowersForTests } from '../../src/systems/firmamentPowers.js';
import { weaponMasteryBlow, weaponPastPct, _resetWeaponMasteryForTests } from '../../src/systems/weaponMastery.js';
import * as MP from '../../src/systems/martialPaths.js';
import * as POW from '../../src/systems/martialPowers.js';
import * as AP from '../../src/systems/arcanePaths.js';
import * as APOW from '../../src/systems/arcanePowers.js';
import { signatureSpell } from '../../src/systems/signatureSpells.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { masterSkill } from '../../src/systems/masterSkills.js';
import { SKILLS } from '../../src/systems/skills.js';
import { playerEntity, hurtPlayer, registerPlayerDamageMod } from '../../src/characters/playerEntity.js';
import { setStruck, setDamageMod, SIGIL_SETS_POWER, _resetSetPowersForTests, _setSetPowersClockForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { SIGIL_XP_MAX, setSigilOnline, setSigilRenown, setSigilDueling, _resetSigilForTests } from '../../src/systems/sigil/sigil.js';
import { _resetSigilSetsForTests } from '../../src/systems/sigil/sigilSets.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { equipItem } from '../../src/systems/equip.js';
import { mintCondition } from '../../src/systems/item/itemTemplates.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { WEAPONS, WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';

const RULE = 'THE CEILING HOLDS (bible/05-Combat/Power-Ceiling.md section 5): a registry spends the room it is given, never its raw per cent';
/** `fn()` with the product already spent: a blow's (or a hurt's) every share taken before the registry asks. */
const spentBlow = (fn) => { const was = openBlowCeiling(); blowRoom(1e9); try { return fn(); } finally { closeBlowCeiling(was); } };
/** `fn()` inside a fresh product, as the runner holds it for a blow. */
const openBlow = (fn) => { const was = openBlowCeiling(); try { return fn(); } finally { closeBlowCeiling(was); } };
const ORC = Object.freeze({ isPlayer: false, careerIndex: 7, career: {}, health: 100, maxHealth: 100, level: 10, activeEffects: [] });
const foe = (over = {}) => ({ ...ORC, ...over });
const SPEND = 'powerceiling-spend';
/** A foe's blow of `n` through my real door (playerEntity.js hurtPlayer), and what it took. `spent` ([name, fn]): a guard
 *  that spends the whole share is asked first, and that registry after it. */
function struck(me, n, spent = null) {
  if (spent) {
    registerPlayerDamageMod(SPEND, (_e, d) => { guardRoom(100); return d; });
    registerPlayerDamageMod(spent[0], null);
    registerPlayerDamageMod(spent[0], spent[1]);   // registered again: asked after the spender
  }
  try { const was = me.health; setStruck(foe(), me, n); hurtPlayer(me, n); return was - me.health; } finally { registerPlayerDamageMod(SPEND, null); }
}
/** `fn()` on an online page (the paths and mastery read the page's own word). */
function online(fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try { return fn(); } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; }
}
const weapon = (templateIndex) => ({ group: 'Weapons', templateIndex, material: WEAPON_MATERIALS.Daedric, flags: 0, maxCondition: 100, currentCondition: 100 });
const STATS = { strength: 60, intelligence: 60, willpower: 60, agility: 60, endurance: 60, personality: 50, speed: 50, luck: 50 };
const S = SKILLS;
/** audit_martial.test.js's fighter and schools_arcane.test.js's mage: every path's two skills in a group that may master them. */
const FIGHTER = buildCustomCareer({ name: 'Fighter', hp: 12, stats: STATS,
  skills: [S.LongBlade, S.ShortBlade, S.Axe, S.BluntWeapon, S.Archery, S.HandToHand, S.Dodging, S.CriticalStrike, S.Running, S.Jumping, S.Climbing, S.Swimming] });
const MAGE = buildCustomCareer({ name: 'Mage', hp: 8, stats: STATS,
  skills: [S.Destruction, S.Restoration, S.Alteration, S.Mysticism, S.Illusion, S.Thaumaturgy, S.ShortBlade, S.Archery, S.Medical, S.Etiquette, S.Streetwise, S.Lockpicking] });
/** A chargen'd character, online, level 20, `skills` mastered and standing at `raw` (audit_martial.test.js's fighter). */
function hero(skills = [], raw = 150, career = FIGHTER) {
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p._online = true; p.level = 20; p.activeEffects = [];
  p.health = p.maxHealth = 2000; p.fatigue = 0;
  for (const s of skills) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true, `master ${s}`); p.skills[s] = raw; }
  return p;
}
function reset() {
  _resetForTests(); setPref('lootRarity', true);
  _resetFirmamentLiveForTests(); _resetFirmamentPowersForTests(); _resetWeaponMasteryForTests();
  POW._resetMartialPowersForTests(); APOW._resetArcanePowersForTests(); _resetSetPowersForTests(); _resetSigilSetsForTests(); _resetSigilForTests();
  POW._setMartialPowersClockForTests(null); APOW._setArcanePowersClockForTests(null); _setSetPowersClockForTests(null);
  setSigilDueling(false); setPlayerDoor(null);
}

test('POWER-CEILING THE SKY OBEYS ITS ROOM (AUDIT HORIZONTAL D2): a sword under the Steed\'s Starway (+3% melee) lands its share whole with room and nothing more once the product is spent; the Warrior\'s Starway and Shield Wall (6% lighter) the same off a foe\'s blow (mutants: the sky\'s blow and its guard each asking and spending the raw per cent)', () => {
  reset();
  const walk = (start, ...to) => { const t = { start, keys: [] }; for (const k of to) t.keys.push(...pathTo(t, k)); return t; };
  const named = (name) => [...FIRM_NODES.values()].find((n) => n.name === name)?.key ?? assert.fail(`no star ${name}`);
  setFirmamentOnline(true);
  setFirmamentTree(walk('st.start', 'st.r1', 'wr.r2', named('Shield Wall')));
  const me = { isPlayer: true, health: 4000, maxHealth: 4000, activeEffects: [] };
  const sword = weapon(WEAPONS.Longsword);
  const pct = blowPct(firmamentStats(), { skill: 'LongBlade', group: 'humanoid' });
  assert.ok(pct > 0, 'the sky adds to the sword');
  assert.equal(openBlow(() => firmamentBlow(sword, 1000, me, foe(), { unaware: false })), 1000 + pct * 10, `whole: +${pct}%`);
  assert.equal(spentBlow(() => firmamentBlow(sword, 1000, me, foe(), { unaware: false })), 1000, `no room, no more - ${RULE}`);
  const less = -(firmamentStats().blowTaken ?? 0);
  assert.ok(less > 0, 'the sky lightens a blow');
  assert.equal(struck(me, 1000), 1000 - less * 10, `whole: ${less}% off`);
  me.health = 4000;
  assert.equal(struck(me, 1000, [FIRMAMENT_POWERS, firmamentDamage]), 1000, `no room, nothing off - ${RULE}`);
  assert.deepEqual(ceilingProducts(), { blow: null, guard: null });
  reset();
});

test('POWER-CEILING MASTERY OBEYS ITS ROOM (AUDIT HORIZONTAL D2): an axe at a skill of 200 (140 effective) on a foe under half health lands its +80% whole with room and nothing once the product is spent (mutant: mastery asking and spending the raw per cent)', () => online(() => {
  reset();
  const me = hero([S.Axe], 200);
  const axe = weapon(WEAPONS.War_Axe);
  const low = foe({ health: 10 });
  assert.equal(weaponPastPct(axe, me, low), 80, 'the axe\'s two per cent an effective point past 100, at 140');
  assert.equal(openBlow(() => weaponMasteryBlow(axe, 1000, me, low)), 1800, 'whole: +80%');
  assert.equal(spentBlow(() => weaponMasteryBlow(axe, 1000, me, low)), 1000, `no room, no more - ${RULE}`);
  reset();
}));

test('POWER-CEILING THE MARTIAL PATH OBEYS ITS ROOM (AUDIT HORIZONTAL D2): the Assassin\'s Opening Strike (+30%) and the Vanguard\'s Iron Discipline (10% lighter) whole with room, nothing once the product or the share is spent (mutants: the path\'s blow and its guard each asking and spending the raw per cent)', () => online(() => {
  reset();
  const assassin = hero(MP.MARTIAL_BY_ID.assassin.skills);
  assert.equal(MP.chooseMartialPath(assassin, 'assassin').ok, true);
  const blade = weapon(WEAPONS.Dagger);
  assert.equal(openBlow(() => POW.martialBlow(blade, 1000, assassin, foe(), {})), 1300, 'whole: the first blow at a foe, +30%');
  assert.equal(spentBlow(() => POW.martialBlow(blade, 1000, assassin, foe(), {})), 1000, `no room, no more - ${RULE}`);
  reset();
  const vanguard = hero(MP.MARTIAL_BY_ID.vanguard.skills);
  assert.equal(MP.chooseMartialPath(vanguard, 'vanguard').ok, true);
  assert.equal(struck(vanguard, 1000), 900, 'whole: 10% lighter');
  assert.equal(struck(vanguard, 1000, [POW.MARTIAL_POWERS, POW.martialDamageMod]), 1000, `no room, nothing off - ${RULE}`);
  reset();
}));

test('POWER-CEILING THE LIVING AEGIS AND UNBROKEN OBEY THEIR ROOM (AUDIT HORIZONTAL D2): the Warden\'s cast guard (20% lighter) and Malacath\'s halving whole with room, nothing once the share is spent (mutants: each asking and spending the raw per cent)', () => online(() => {
  reset();
  const warden = hero(AP.PATH_BY_ID.warden.schools, 150, MAGE);
  assert.equal(AP.choosePath(warden, 'warden').ok, true);
  APOW.pathLanded({ caster: warden, spell: signatureSpell('warden'), r: {}, self: true });   // Living Aegis cast on myself
  assert.equal(struck(warden, 1000), 800, 'whole: 20% lighter');
  warden.health = 2000;
  assert.equal(struck(warden, 1000, [APOW.ARCANE_POWERS, APOW.pathDamageMod]), 1000, `no room, nothing off - ${RULE}`);
  reset();
  setSigilOnline(true); setSigilRenown(40);
  let now = 0;
  _setSetPowersClockForTests(() => now);
  const orcBane = { isPlayer: true, items: [], stats: { ...STATS }, skills: new Array(35).fill(50), level: 30, career: {}, activeEffects: [], health: 50, maxHealth: 10000, magicka: 0, maxMagicka: 0 };
  for (const t of [107, 106, 105, 108, 102, 103]) {
    const it = mintCondition({ group: 'Armor', templateIndex: t, material: ARMOR_MATERIAL.Ebony, flags: 0 });
    it.rarity = 'rare'; it.affixes = []; it.sigil = { set: 'malacath', party: 1, xp: SIGIL_XP_MAX };
    orcBane.items.push(it); equipItem(orcBane, it);
  }
  hurtPlayer(orcBane, 100000);
  assert.equal(orcBane.health, 1, 'Unbroken: the killing blow leaves one, and the half begins');
  orcBane.health = 4000;   // over half: no Hold the Line, no Last Stand - the half alone
  now = 1;
  assert.equal(struck(orcBane, 1000), 500, 'whole: half');
  orcBane.health = 4000;
  assert.equal(struck(orcBane, 1000, [SIGIL_SETS_POWER, setDamageMod]), 1000, `no room, nothing off - ${RULE}`);
  reset();
}));
