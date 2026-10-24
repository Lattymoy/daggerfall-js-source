// MARTIAL - MARTIAL SPECIALISATIONS (2026-10-17; bible/05-Combat/Martial-Specialisations.md). The owner: "we've properly
// balanced mages, added a specialization tree and added the firmament system. I want to do the same for other weapon
// types/classes." Asked, the owner chose: the six weapon skills, fifteen paths; the signature a technique on the technique
// key when the weapon carries no line; an arcane path and a martial path together; and the balance pass whole - every
// weapon past 100, the fists' missing modifiers, the short blades' handling and the Firmament's weapon notables (BAL10).
// Pinned by execution through the real producers: the law (systems/martialPaths.js), the save (systems/save/save.js), the
// technique runner (combat/techniques.js), the swing law (characters/weaponStates.js, combat/swingLaw.js and both mods'
// arms), the blow's registry (systems/entityMods.js weaponBlowMods), both damage cores (combat/formulas.js,
// combat/pcaao.js), the player's damage door (characters/playerEntity.js), the swing's and the shaft's one resolution
// (combat/playerWeapon.js resolveHit, combat/arrowFlight.js playerArrowHitFoe) and the sky (net/firmament/firmamentTree.js).
import '../modsOff.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as MP from '../../src/systems/martialPaths.js';
import * as POW from '../../src/systems/martialPowers.js';
import * as WM from '../../src/systems/weaponMastery.js';
import * as AP from '../../src/systems/arcanePaths.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { masterSkill, setMasterSkills } from '../../src/systems/masterSkills.js';
import { SKILLS } from '../../src/systems/skills.js';
import { playerEntity, hurtPlayer } from '../../src/characters/playerEntity.js';
import { weaponBlowMods, registerWeaponBlowMod, computeEntityMods } from '../../src/systems/entityMods.js';
import { setStruck, _resetSetPowersForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { setSigilDueling } from '../../src/systems/sigil/sigil.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { _resetPlayerHealForTests } from '../../src/systems/playerHeal.js';
import { reportPlayerKill } from '../../src/systems/playerKills.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { maxFatigue, liveStat } from '../../src/systems/statMods.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { LOOT_RARITY_KEY, validAffix } from '../../src/systems/loot/lootRarity.js';
import { techniqueInHand, refusal, stepTechnique, techniqueWait, techniqueHudChips, LADDER_OFF_TEXT, _resetTechniquesForTests } from '../../src/combat/techniques.js';
import { TECHNIQUES, TECHNIQUE_FAMILIES, techniqueFamily, techniquesFor, GAUNTLETS_TEMPLATE } from '../../src/combat/technique/techniqueRoster.js';
import { tellTechniqueLanded, tellTechniqueUsed } from '../../src/combat/technique/techniqueBlow.js';
import { PlayerWeapon } from '../../src/combat/playerWeapon.js';
import { playerArrowHitFoe } from '../../src/combat/arrowFlight.js';
import { calculateAttackDamage, enemyEntityGroup, ENEMY_GROUPS } from '../../src/combat/formulas.js';
import { pcaaoHandToHandAttackDamage } from '../../src/combat/pcaao.js';
import { getMeleeWeaponAnimTime, registerMeleeWeaponAnimTime, swingPacePct, registerSwingPaceMod, swingHandling, SWING_HANDLING, SWING_SHORT_BLADE, SWING_PACE_MOST, SWING_FRAME_MIN, swingFrameSeconds } from '../../src/characters/weaponStates.js';
import { readSwing } from '../../src/combat/swingLaw.js';
import { WEAPON_TYPES } from '../../src/combat/fpsWeapon.js';
import { rriMeleeWeaponAnimTime } from '../../src/systems/roleplayRealismItems/rriRealism.js';
import { rrMeleeWeaponAnimTime } from '../../src/systems/roleplayRealism/rrRealism.js';
import { EQUIP_SLOTS, equipTableOf } from '../../src/systems/equip.js';
import { mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { THUNDERLOCK_TEMPLATE } from '../../src/characters/thunderlockIds.js';
import { FIRM_NODES } from '../../src/net/firmament/firmamentTree.js';

const { LongBlade: LB, ShortBlade: SB, Axe: AX, BluntWeapon: BL, Archery: AR, HandToHand: HH, Destruction: DES, Restoration: RES } = SKILLS;
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** The page's own switch (onlineLane.js isOnlinePage), for the doors that read it themselves. */
function page(online, fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: online ? '?online' : '' };
  try { return fn(); } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; }
}
const STATS = { strength: 70, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 50, luck: 50 };
// primary Long Blade, Short Blade, Axe; major Blunt, Archery, Hand-to-Hand - every pair of the six reachable (2 / 2 / 1)
const career = buildCustomCareer({ name: 'Fighter', hp: 12, stats: STATS,
  skills: [LB, SB, AX, BL, AR, HH, SKILLS.Dodging, SKILLS.CriticalStrike, SKILLS.Running, SKILLS.Jumping, SKILLS.Climbing, SKILLS.Swimming] });
/** A chargen'd fighter, online (Master Skills in force), level 20, with `skills` mastered and standing at `raw`. */
function fighter(skills = [], raw = 150) {
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p._online = true; p.level = 20; p.activeEffects = [];
  p.health = p.maxHealth = 200; p.fatigue = 0;
  for (const s of skills) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true, `master ${s}`); p.skills[s] = raw; }
  return p;
}
/** A fighter of path `id`: its two skills mastered at `raw`, the path chosen. */
function pathFighter(id, raw = 150) {
  const p = fighter(MP.MARTIAL_BY_ID[id].skills, raw);
  assert.equal(MP.chooseMartialPath(p, id).ok, true);
  return p;
}
const weapon = (templateIndex, extra = {}) => mintCondition(setItemFields({ group: 'Weapons', templateIndex, material: 0, ...extra }));
const gauntlets = (extra = {}) => mintCondition(setItemFields({ group: 'Armor', templateIndex: GAUNTLETS_TEMPLATE, material: 0, ...extra }));
const held = (p, it) => { p.items = [it]; equipTableOf(p)[EQUIP_SLOTS.RightHand] = it; return p; };
const foe = (over = {}) => ({ isPlayer: false, career: {}, stats: { willpower: 50, agility: 50, luck: 50 }, activeEffects: [], level: 20, health: 100, maxHealth: 100, careerIndex: 7, ...over });
/** A door: foe records (each `{ name, entity, ai }`), the hurts it takes and the bundles cast on me. */
function door(foes = [], me = null) {
  const d = { hurts: [], cast: [] };
  setPlayerDoor({ foes: () => foes.filter((f) => !f.dead), feet: () => [0, 0, 0], hurtFoe: (f, n) => d.hurts.push([f.name, n]), castOnPlayer: (b) => d.cast.push(b), player: () => me });
  return d;
}
let _clock = 100;
const reset = () => {
  POW._resetMartialPowersForTests(); WM._resetWeaponMasteryForTests(); _resetSetPowersForTests(); _resetPlayerHealForTests(); _resetTechniquesForTests();
  _clock = 100; POW._setMartialPowersClockForTests(() => _clock); POW._setMartialPowersRandForTests(null);
  setSigilDueling(false); setPlayerDoor(null); setPref(LOOT_RARITY_KEY, true);
};
/** The blow's whole registry on a 100 at `target` - every modifier the port registers (asleep ones answer nothing). */
const blow100 = (w, p, target, info = { unaware: false }) => weaponBlowMods(w, 100, p, target, info);

test('MARTIAL1 THE LAW: fifteen pairs of the six weapon skills, whole and distinct; each path\'s signature answers both its families and its forms are its own; the families are the roster\'s; no signature is a loot technique (mutants: a pair twice; a form for the wrong family; a signature in the roster)', () => {
  assert.deepEqual(MP.MARTIAL_SKILLS, [LB, SB, AX, BL, AR, HH]);
  assert.deepEqual(MP.MARTIAL_PATHS.map((p) => [p.id, [...p.skills]]), [
    ['blademaster', [LB, SB]], ['warblade', [LB, AX]], ['vanguard', [LB, BL]], ['ranger', [LB, AR]], ['bladedancer', [LB, HH]],
    ['bloodletter', [SB, AX]], ['cutthroat', [SB, BL]], ['assassin', [SB, AR]], ['shadowdancer', [SB, HH]],
    ['juggernaut', [AX, BL]], ['woodsman', [AX, AR]], ['berserker', [AX, HH]],
    ['crusader', [BL, AR]], ['brawler', [BL, HH]], ['windrunner', [AR, HH]],
  ]);
  const pairs = new Set(MP.MARTIAL_PATHS.map((p) => [...p.skills].sort((a, b) => a - b).join(',')));
  assert.equal(pairs.size, 15, '6 choose 2, each once');
  for (const p of MP.MARTIAL_PATHS) {
    assert.deepEqual(Object.keys(p.forms).sort(), p.skills.map((s) => MP.MARTIAL_FAMILY[s]).sort(), `${p.id}: a form for each of its two families`);
    for (const [fam, id] of Object.entries(p.forms)) {
      const f = MP.SIGNATURE_TECHNIQUES[id];
      assert.equal(f.path, p.id); assert.ok(f.families.includes(fam)); assert.equal(f.id, id);
      assert.ok(['rain', 'pierce', 'leap', 'dash', 'swing'].includes(f.mech), `${id}: a mechanic the runner performs`);
      assert.ok(TECHNIQUES[f.fx], `${id}: wears a roster technique's feel`);
      assert.equal((fam === 'archery'), (f.mech === 'rain' || f.mech === 'pierce'), `${id}: a bow shoots, a blade or a fist strikes`);
    }
    assert.equal(MP.martialOfPair(p.skills[1], p.skills[0]), p, 'either order names it');
  }
  assert.equal(MP.martialOfPair(LB, LB), null);
  assert.deepEqual(MP.MARTIAL_FAMILY, { [LB]: 'longBlade', [SB]: 'shortBlade', [AX]: 'axe', [BL]: 'blunt', [AR]: 'archery', [HH]: 'handToHand' });
  for (const fam of Object.values(MP.MARTIAL_FAMILY)) assert.ok(TECHNIQUE_FAMILIES.includes(fam), `${fam}: the roster's word`);
  assert.equal(techniqueFamily(weapon(WEAPONS.Longsword)), 'longBlade'); assert.equal(techniqueFamily(weapon(WEAPONS.Tanto)), 'shortBlade');
  assert.equal(techniqueFamily(weapon(WEAPONS.War_Axe)), 'axe'); assert.equal(techniqueFamily(weapon(WEAPONS.Mace)), 'blunt');
  assert.equal(techniqueFamily(weapon(WEAPONS.Long_Bow)), 'archery');
  // never a loot line: none in the roster, none a piece may roll, none the item law reads
  for (const id of MP.SIGNATURE_IDS) {
    assert.equal(Object.hasOwn(TECHNIQUES, id), false, `${id} is no roster technique`);
    assert.equal(validAffix({ id: 'technique', param: id, value: 20 }), false, `a line naming ${id} is no line`);
  }
  for (const t of Object.values(WEAPONS)) assert.ok(techniquesFor(weapon(t)).every((id) => !MP.isSignatureTechnique(id)));
  // the forms' numbers, every one
  assert.deepEqual(Object.fromEntries(MP.SIGNATURE_IDS.map((id) => { const f = MP.SIGNATURE_TECHNIQUES[id]; return [id, [f.path, f.mech, f.base, f.fatigue, f.cooldown, f.toHit ?? null]]; })), {
    thousandCuts: ['blademaster', 'dash', 1.0, 5, 12, 15], rallyingCleave: ['warblade', 'swing', 1.1, 5, 12, 15], judgement: ['vanguard', 'leap', 1.3, 6, 14, 20],
    huntersMark: ['ranger', 'pierce', 1.2, 4, 12, null], huntersPounce: ['ranger', 'leap', 1.3, 5, 12, 20], cyclone: ['bladedancer', 'swing', 1.0, 5, 10, 15],
    guttingLunge: ['bloodletter', 'dash', 1.2, 5, 11, 15], blackjack: ['cutthroat', 'swing', 1.4, 4, 10, 30], vanishingShot: ['assassin', 'pierce', 1.6, 4, 14, null],
    vanishingStrike: ['assassin', 'dash', 1.3, 5, 14, 20], phantomStrike: ['shadowdancer', 'dash', 1.2, 4, 12, 20], earthsplitter: ['juggernaut', 'swing', 1.0, 6, 14, 15],
    fellingVolley: ['woodsman', 'rain', 0.6, 6, 14, null], fellingStrike: ['woodsman', 'leap', 1.3, 5, 14, 20], savageWhirl: ['berserker', 'swing', 1.2, 6, 14, 15],
    hallowedShot: ['crusader', 'pierce', 1.2, 4, 12, null], hallowedStrike: ['crusader', 'swing', 1.5, 5, 12, 25], knockout: ['brawler', 'swing', 1.6, 5, 11, 30],
    windVolley: ['windrunner', 'rain', 0.5, 6, 16, null], windKick: ['windrunner', 'leap', 1.2, 4, 11, 20],
  });
  assert.equal(MP.SIGNATURE_TECHNIQUES.windKick.airborne, true, 'the Windrunner kicks from the air, as the Flying Kick does');
  assert.deepEqual(JSON.parse(JSON.stringify(MP.MARTIAL_NUMBERS)), {
    flowingSteel: { pct: 3, stacks: 5, seconds: 4 }, warRhythm: { pct: 15, seconds: 10 }, ironDiscipline: { lighter: 10 }, huntersInstinct: { pct: 20 },
    dancersStep: { oneIn: 10 }, bloodlust: { health: 5 }, cheapShot: { pct: 25 }, openingStrike: { pct: 30 }, lightStep: { agility: 10, dodging: 15 },
    standFirm: { below: 0.3, heal: 20, recover: 180 }, tireless: { fatigue: 15 }, frenzy: { below: 0.5, pct: 20, pace: 10 }, purge: { pct: 20 },
    grit: { health: 1, fatigue: 2 }, windborne: { speed: 10, running: 15, jumping: 15 },
    thousandCuts: { share: 0.5 }, rallyingCleave: { pct: 15, seconds: 8 }, judgement: { heal: 4, foes: 3 }, huntersMark: { pct: 20, seconds: 12 },
    cyclone: { pace: 20, seconds: 6 }, guttingLunge: { below: 0.25 }, blackjack: { times: 2 }, vanishingStrike: { rounds: 4 },
    phantomStrike: { oneIn: 3, seconds: 6 }, earthsplitter: { lighter: 25, seconds: 10 }, fellingStrike: { heal: 10 }, savageWhirl: { leech: 10, seconds: 8 },
    hallowedStrike: { share: 0.5 }, knockout: { lighter: 30, seconds: 8 }, windstrike: { fatigue: 5, foes: 3 },
  });
  assert.equal(POW.MARTIAL_BLOW_MOST, 40);
});

test('MARTIAL1 THE CHOICE: two weapon skills mastered open their path; the choice is permanent; refused with Master Skills off, a skill unmastered, an id no table holds; held mentoring, awake not; one arcane path and one martial path together (mutants: one skill opens; the choice undone; off still opens; mentoring awake)', () => {
  reset();
  const p = fighter([LB, AR]);
  assert.deepEqual(MP.martialChoices(p).map((x) => x.id), ['ranger']);
  assert.equal(MP.nextMartialChoice(p).id, 'ranger');
  assert.match(MP.martialRefusal(p, 'blademaster'), /Master Long Blade and Short Blade first/);
  assert.match(MP.martialRefusal(p, 'samurai'), /No such/);
  assert.equal(MP.martialPossible(p), true);
  assert.equal(MP.martialPossible({ career: { primarySkills: [LB], majorSkills: [DES, RES], minorSkills: [] } }), false, 'one weapon skill in the career meets no path');
  assert.equal(MP.martialHeld(p), null, 'not chosen');
  const r = MP.chooseMartialPath(p, 'ranger');
  assert.equal(r.ok, true); assert.match(r.text, /Ranger/);
  assert.equal(p.martialPath, 'ranger');
  assert.equal(MP.chooseMartialPath(p, 'ranger').ok, false, 'chosen once');
  assert.deepEqual(MP.martialChoices(p), [], 'nothing more to choose');
  assert.equal(MP.martialHeld(p)?.id, 'ranger'); assert.equal(MP.martialAwake(p)?.id, 'ranger');
  p._mentor = { level: 5 };
  assert.equal(MP.martialHeld(p)?.id, 'ranger', 'mentoring, held');
  assert.equal(MP.martialAwake(p), null, 'mentoring, asleep');
  p._mentor = null;
  assert.equal(MP.martialHeld({ ...p, peer: 'x' }), null, 'never a peer\'s stand-in');
  const off = fighter([LB, AR]);
  off._online = false; setMasterSkills(off, false);
  assert.deepEqual(MP.martialChoices(off), [], 'offline with the switch off, nothing opens');
  assert.match(MP.martialRefusal(off, 'ranger'), /Master Skills is off/);
  // a spellsword: Destruction and Restoration (primary), Long Blade and Short Blade (major) - both specialisations held
  const sw = structuredClone(playerEntity);
  createCharacter(sw, buildCustomCareer({ name: 'Spellsword', hp: 10, stats: STATS,
    skills: [DES, RES, SKILLS.Alteration, LB, SB, SKILLS.Dodging, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking, SKILLS.Running, SKILLS.Jumping] }), -1, { rolls: () => 0.5 });
  sw._online = true;
  for (const s of [DES, RES, LB, SB]) { sw.skills[s] = 100; assert.equal(masterSkill(sw, s).ok, true); }
  assert.equal(AP.choosePath(sw, 'bloodmage').ok, true);
  assert.equal(MP.chooseMartialPath(sw, 'blademaster').ok, true, 'the arcane path closes nothing of the martial');
  assert.equal(AP.pathHeld(sw)?.id, 'bloodmage'); assert.equal(MP.martialHeld(sw)?.id, 'blademaster');
  // the words: the box's rows, its two skills, its reset's price, each path's numbers in its own words
  const rows = MP.martialChoiceRows(fighter([LB, AR]), 'ranger');
  assert.equal(rows[0], 'Martial specialization: Ranger?'); assert.equal(rows[1], 'Long Blade and Archery');   // PIN MOVED (AUDIT MARTIAL L4 L4): never the arcane ask's words
  assert.ok(rows.includes('Resetting it later costs 200,000 gold.'));   // PIN MOVED (SPEC-RESET): the paid reset's price, where it said permanent
  assert.match(MP.martialPowerRows(MP.MARTIAL_BY_ID.vanguard).join(' '), /10% less damage.*Judgement \(signature technique\).*8 meters.*2\.5 meters.*4% of your health.*3 enemies/);
  assert.match(MP.martialPowerRows(MP.MARTIAL_BY_ID.berserker).join(' '), /Below 50%.*20% more damage.*10%.*Savage Whirl.*3 meters.*8 seconds.*10%/);
  assert.match(MP.martialOpenRows([MP.MARTIAL_BY_ID.ranger, MP.MARTIAL_BY_ID.vanguard]).join(' '), /2 martial specializations are open to you: Ranger, Vanguard/);   // PIN MOVED (VOICE2): specialization (Voice.md rule 8)
});

test('MARTIAL1 THE SAVE: the martial path and its one ask round-trip beside the arcane path; an id no table holds reads as none; a save from before the arc has none (mutants: the path dropped on save; an unknown id kept)', () => {
  const p = pathFighter('juggernaut');
  p.martialPrompted = true;
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(p)));
  assert.equal(snap.martialPath, 'juggernaut'); assert.equal(snap.martialPrompted, true);
  const back = structuredClone(playerEntity);
  restorePlayer(back, snap);
  assert.equal(back.martialPath, 'juggernaut'); assert.equal(back.martialPrompted, true);
  const forged = structuredClone(playerEntity);
  restorePlayer(forged, { ...snap, martialPath: 'samurai' });
  assert.equal(forged.martialPath, null);
  const { martialPath: _a, martialPrompted: _b, ...before } = snap;
  before.career = { ...snap.career }; delete before.career.martialMirror;   // PIN MOVED (AUDIT MARTIAL L3 F1): a save from before the arc carries no mirror either
  const old = structuredClone(playerEntity);
  restorePlayer(old, before);
  assert.equal(old.martialPath, null); assert.equal(old.martialPrompted, false);
});

/** The runner's ctx for a press: the entity, a drawn weapon's machine at rest, a door that drains fatigue. */
function press(p, item, { held: down = true } = {}) {
  const pw = { weapon: item?.group === 'Weapons' ? item : null, sheathed: false, machine: { state: 'Idle', now: 0, cooldownUntil: 0 } };
  return { entity: p, pw, held: down, ready: true, cam: { feet: [0, 0, 0], pos: [0, 1.6, 0], yaw: 0, pitch: 0 }, rig: 'rig', door: { drainFatigue: (n) => { p.fatigue -= n; } }, startSwing: () => true, say: () => {} };
}

test('MARTIAL3 THE SIGNATURE IN HAND: the technique key\'s answer with no line on the weapon - the form of the family in hand; a line on the weapon wins; the bare hand Hand-to-Hand\'s, gloves or none; never the claws, the Thunderlock, a weapon outside the pair, or a path not held; no ladder needed; the forms share one cooldown (mutants: the line loses; the claws strike; the ladder refuses a signature; the forms\' cooldowns apart)', () => {
  reset();
  const ranger = pathFighter('ranger');
  const sword = weapon(WEAPONS.Longsword), bow = weapon(WEAPONS.Long_Bow);
  assert.equal(techniqueInHand(ranger, { weapon: sword })?.id, 'huntersPounce');
  assert.equal(techniqueInHand(ranger, { weapon: bow })?.id, 'huntersMark');
  const hand = techniqueInHand(ranger, { weapon: bow });
  assert.deepEqual([hand.value, hand.known, hand.signature, hand.tech.name], [0, true, 'ranger', 'Mark of the Hunt']);
  assert.equal(techniqueInHand(ranger, { weapon: bow }), hand, 'kept while nothing it was read from moves');
  assert.equal(techniqueInHand(ranger, { weapon: weapon(WEAPONS.War_Axe) }), null, 'an axe is no Ranger\'s');
  assert.equal(techniqueInHand(ranger, { weapon: null }), null, 'nor the bare hand');
  assert.equal(techniqueInHand(ranger, { weapon: weapon(THUNDERLOCK_TEMPLATE) }), null, 'the Thunderlock is a gun, no bow\'s');
  const lined = weapon(WEAPONS.Longsword, { affixes: [{ id: 'technique', param: 'leap', value: 20 }] });
  assert.equal(techniqueInHand(ranger, { weapon: lined })?.id, 'leap', 'a line on the weapon wins');
  const dancer = pathFighter('bladedancer');
  assert.equal(techniqueInHand(dancer, { weapon: { werecreatureClaws: true } }), null, 'the beast knows no technique - not even a path with a fist\'s form');
  assert.equal(techniqueInHand(dancer, { weapon: null })?.id, 'cyclone', 'bare-handed');
  equipTableOf(dancer)[EQUIP_SLOTS.Gloves] = gauntlets();
  assert.equal(techniqueInHand(dancer, { weapon: null })?.id, 'cyclone', 'in plain gauntlets');
  equipTableOf(dancer)[EQUIP_SLOTS.Gloves] = gauntlets({ affixes: [{ id: 'technique', param: 'kick', value: 20 }] });
  assert.equal(techniqueInHand(dancer, { weapon: null })?.id, 'kick', 'gauntlets with a line: the line');
  const off = pathFighter('ranger'); off._online = false; off.masterSkills = false;
  assert.equal(techniqueInHand(off, { weapon: sword }), null, 'a path not held answers nothing');
  // the ladder off: a found line sleeps, a signature does not - and answers the key the sleeping line leaves free (PIN
  // MOVED, AUDIT MARTIAL L4 L6); with no path held, the line's own refusal
  setPref(LOOT_RARITY_KEY, false);   // set back by reset() at the next test's start and the file's end (AUDIT MARTIAL L5 L2)
  assert.equal(techniqueInHand(ranger, { weapon: lined })?.id, 'huntersPounce', 'the line asleep: the signature');
  assert.equal(refusal(techniqueInHand(off, { weapon: lined }), press(off, lined)), LADDER_OFF_TEXT);
  ranger.fatigue = maxFatigue(ranger);
  assert.equal(refusal(techniqueInHand(ranger, { weapon: sword }), press(ranger, sword)), 'Not here.', 'past the ladder\'s gate - a pounce asks a motor this press has none of');
  const cm = pathFighter('crusader'); cm.fatigue = maxFatigue(cm);
  assert.equal(refusal(techniqueInHand(cm, { weapon: weapon(WEAPONS.Mace) }), press(cm, weapon(WEAPONS.Mace))), null, 'a swing goes');
  assert.equal(techniqueHudChips(ranger, { weapon: sword }, 'X')[0]?.name, 'Mark of the Hunt', 'the chip names it with the ladder off');
  setPref(LOOT_RARITY_KEY, true);
  // a press: the Crusader's mace swings its form, and the bow's form waits on the same clock
  const cr = pathFighter('crusader');
  cr.fatigue = maxFatigue(cr);
  const mace = weapon(WEAPONS.Mace);
  const fat = cr.fatigue;
  stepTechnique(1 / 60, press(cr, mace));
  assert.equal(techniqueWait('hallowedStrike'), 12);
  assert.equal(techniqueWait('hallowedShot'), 12, 'one cooldown for both forms');
  assert.ok(fat - cr.fatigue > 0, 'its fatigue paid');
  assert.equal(techniqueWait('crush'), 0, 'no loot technique\'s clock moved');
});

test('MARTIAL2 THE WEAPON PAST 100: online, each effective point of the climb - Long Blade every blow 1% harder, Archery every arrow, the Axe 2% at a foe under half, the Blunt Weapon 2% at a foe at half or more, the Short Blade every swing 1% quicker, Hand-to-Hand nothing more; never offline, mentoring, in a duel, as the beast, at a player or the Warden (mutants: a half\'s line moved; the axe and the hammer swapped; the climb read raw; offline paid)', () => {
  reset();
  page(true, () => {
    const lb = held(fighter([LB], 200), weapon(WEAPONS.Longsword));
    assert.equal(blow100(weapon(WEAPONS.Longsword), lb, foe()), 140, 'x1.4 at 200 (effective 140)');
    lb.skills[LB] = 150;
    assert.equal(blow100(weapon(WEAPONS.Longsword), lb, foe()), 117, 'effective 117 at 150');
    lb.skills[LB] = 100;
    assert.equal(blow100(weapon(WEAPONS.Longsword), lb, foe()), 100, 'at 100, nothing');
    const ar = fighter([AR], 200);
    assert.equal(blow100(weapon(WEAPONS.Long_Bow), ar, foe()), 140);
    assert.equal(blow100(weapon(WEAPONS.Longsword), ar, foe()), 100, 'a sword in an archer\'s hand climbs nothing');
    const ax = fighter([AX], 200);
    assert.equal(blow100(weapon(WEAPONS.War_Axe), ax, foe({ health: 49 })), 180, 'under half: x1.8');
    assert.equal(blow100(weapon(WEAPONS.War_Axe), ax, foe({ health: 50 })), 100, 'at half: nothing');
    const bl = fighter([BL], 200);
    assert.equal(blow100(weapon(WEAPONS.Warhammer), bl, foe({ health: 50 })), 180, 'at half or more: x1.8');
    assert.equal(blow100(weapon(WEAPONS.Warhammer), bl, foe({ health: 49 })), 100);
    const hh = fighter([HH], 200);
    assert.equal(blow100(null, hh, foe()), 100, 'the fist\'s formula pays already');
    const sb = fighter([SB], 200);
    assert.equal(blow100(weapon(WEAPONS.Shortsword), sb, foe()), 100, 'a short blade pays in pace');
    assert.equal(WM.weaponMasteryPace({ entity: sb }, { family: 'shortBlade' }), 40);
    assert.equal(WM.weaponMasteryPace({ entity: sb }, { family: 'longBlade' }), 0);
    // the carry: 10 blows of 5 at +17% land 58, never 50 and never 60
    lb.skills[LB] = 150; WM._resetWeaponMasteryForTests();
    const lsw = weapon(WEAPONS.Longsword);
    let n = 0; for (let i = 0; i < 10; i++) n += weaponBlowMods(lsw, 5, lb, foe(), { unaware: false });
    assert.equal(n, 58);
    // asleep
    lb.skills[LB] = 200;
    assert.equal(blow100(lsw, lb, { ...foe(), isPlayer: true }), 100, 'never at a player');
    assert.equal(blow100(lsw, lb, foe({ warded: true })), 100, 'nor the Warden\'s ward');
    lb._mentor = { level: 3 }; assert.equal(blow100(lsw, lb, foe()), 100, 'mentoring'); lb._mentor = null;
    lb.isInBeastForm = true; assert.equal(blow100(lsw, lb, foe()), 100, 'the beast'); lb.isInBeastForm = false;
    setSigilDueling(true); try { assert.equal(blow100(lsw, lb, foe()), 100, 'a refereed fight'); } finally { setSigilDueling(false); }
    assert.equal(blow100(lsw, { ...lb, peer: 'x' }, foe()), 100, 'a peer\'s stand-in');
    const unmastered = fighter([], 100); unmastered.skills[LB] = 200;
    assert.equal(blow100(lsw, unmastered, foe()), 100, 'only a mastered skill climbs');
  });
  page(false, () => {
    const lb = fighter([LB], 200);
    lb._online = false; lb.masterSkills = true;
    assert.equal(blow100(weapon(WEAPONS.Longsword), lb, foe()), 100, 'offline the weapon past 100 is Daggerfall\'s');
  });
});

test('MARTIAL2 + BAL10 THE SWING: every short blade handles as the Dagger in all three arms (the port\'s law, Roleplay & Realism\'s and its Items\'); the Short Blade past 100 and a path\'s pace divide the frame, never past SWING_PACE_MOST nor under the law\'s floor (mutants: the tanto a long blade; the pace multiplied; no floor)', () => {
  reset();
  assert.equal(SWING_SHORT_BLADE, SWING_HANDLING[4]);
  assert.equal(swingHandling(WEAPON_TYPES.LongBlade, false, true), SWING_SHORT_BLADE);
  assert.equal(swingHandling(WEAPON_TYPES.LongBlade, false, false), 1);
  for (const t of [WEAPONS.Tanto, WEAPONS.Shortsword, WEAPONS.Wakazashi, WEAPONS.Dagger]) {
    const r = readSwing({ entity: held(fighter(), weapon(t)), weaponType: 0, usingRightHand: true });
    assert.deepEqual([r.family, r.shortBlade], ['shortBlade', true], `${t} swings with Short Blade`);
  }
  assert.deepEqual((({ family, shortBlade }) => [family, shortBlade])(readSwing({ entity: held(fighter(), weapon(WEAPONS.Longsword)), weaponType: 0 })), ['longBlade', false]);
  assert.equal(readSwing({ entity: fighter(), weaponType: WEAPON_TYPES.Melee }).family, 'handToHand');
  assert.equal(readSwing({ entity: fighter(), weaponType: WEAPON_TYPES.Werecreature }).family, null, 'the claws are no family');
  // the port's law: a Shortsword drawn as a long blade swings at the Dagger's 0.9
  const stout = { strength: 100 };
  const ss = held(fighter(), weapon(WEAPONS.Shortsword)); Object.assign(ss.stats, stout);
  const ls = held(fighter(), weapon(WEAPONS.Longsword)); Object.assign(ls.stats, stout);
  const tShort = getMeleeWeaponAnimTime(50, { entity: ss, weaponType: 0, usingRightHand: true });
  const tLong = getMeleeWeaponAnimTime(50, { entity: ls, weaponType: 0, usingRightHand: true });
  assert.ok(Math.abs(tShort / tLong - 0.9) < 1e-12, `the short blade's 0.9 (${tShort} / ${tLong})`);
  // the mods' arms
  assert.ok(Math.abs(rriMeleeWeaponAnimTime({ liveSpeed: 50, liveStrength: 100, weaponWeight: 1, weaponType: 0, shortBlade: true }) / rriMeleeWeaponAnimTime({ liveSpeed: 50, liveStrength: 100, weaponWeight: 1, weaponType: 0 }) - 0.9) < 1e-12);
  assert.ok(Math.abs(rrMeleeWeaponAnimTime({ liveSpeed: 50, liveStrength: 50, weaponType: 0, shortBlade: true }) / rrMeleeWeaponAnimTime({ liveSpeed: 50, liveStrength: 50, weaponType: 0 }) - 0.9) < 1e-12);
  // the pace: a Short Blade at 200 online, a 40% quicker swing; the floor holds at the top of Speed
  page(true, () => {
    const sb = held(fighter([SB], 200), weapon(WEAPONS.Shortsword)); Object.assign(sb.stats, stout);
    const ctx = { entity: sb, weaponType: 0, usingRightHand: true };
    assert.equal(swingPacePct(ctx, readSwing(ctx)), 40);
    const plain = swingFrameSeconds(50, { handling: SWING_SHORT_BLADE });
    assert.ok(Math.abs(getMeleeWeaponAnimTime(50, ctx) - plain / 1.4) < 1e-12, 'x1.4 the swings');
    assert.equal(getMeleeWeaponAnimTime(100, ctx), SWING_FRAME_MIN, 'never under the swing law\'s floor');
    assert.equal(getMeleeWeaponAnimTime(50, null), (3 * 65) / 980, 'a wielder the port does not know keeps DFU\'s line, unpaced');
    // a mod's arm answering (Roleplay & Realism: Items' weaponBalance is on by default): its answer is paced alike
    registerMeleeWeaponAnimTime(() => 0.28);
    try { assert.ok(Math.abs(getMeleeWeaponAnimTime(50, ctx) - 0.28 / 1.4) < 1e-12, 'the override\'s frame, x1.4 the swings'); } finally { registerMeleeWeaponAnimTime(null); }
    // and a path's pace beside it, all of them at most SWING_PACE_MOST
    const bz = held(pathFighter('berserker', 200), weapon(WEAPONS.War_Axe));
    bz.health = 90;
    const bctx = { entity: bz, weaponType: 12, usingRightHand: true };
    assert.equal(swingPacePct(bctx, readSwing(bctx)), 10, 'Frenzy\'s 10 under half');
    assert.equal(SWING_PACE_MOST, 50);
    registerSwingPaceMod('martial-probe', () => 80);
    try { assert.equal(swingPacePct(bctx, readSwing(bctx)), 50, 'every pace together, at most 50'); } finally { registerSwingPaceMod('martial-probe', null); }
    assert.equal(swingPacePct(bctx, readSwing(bctx)), 10, 'a name removed');
  });
});

test('BAL10 THE FISTS: a player\'s bare-handed blow reads the blow modifiers in both cores, with the host\'s word - never the beast\'s claws, never a foe\'s fists (mutants: the stock arm unread; the overhaul\'s; the claws read)', () => {
  reset();
  const seen = [];
  const p = fighter(); p.skills[HH] = 50;
  const target = foe({ careerIndex: 7 });
  // AUDIT MARTIAL L5 L2: the same roll with the probe off, so "it landed" is the probe's 7 and nothing else
  const without = calculateAttackDamage({ ...p, isPlayer: true }, target, { rolls: () => 0, unaware: true });
  const withoutO = pcaaoHandToHandAttackDamage(p, target, 0, true, () => 0, { unaware: false });
  registerWeaponBlowMod('bal10-probe', (w, d, a, t, info) => { seen.push([w, info?.unaware ?? null]); return d + 7; });
  try {
    const plain = calculateAttackDamage({ ...p, isPlayer: true }, target, { rolls: () => 0, unaware: true });
    assert.deepEqual(seen.at(-1), [null, true], 'the stock core: the fists, with the host\'s word');
    assert.equal(plain, without + 7, 'the modifier landed whole');
    seen.length = 0;
    assert.equal(pcaaoHandToHandAttackDamage(p, target, 0, true, () => 0, { unaware: false }), withoutO + 7);
    assert.deepEqual(seen, [[null, false]], 'the overhaul\'s core too');
    seen.length = 0;
    pcaaoHandToHandAttackDamage({ ...p, isInBeastForm: true }, target, 0, true, () => 0);
    calculateAttackDamage({ ...p, isInBeastForm: true }, target, { rolls: () => 0 });
    assert.deepEqual(seen, [], 'never the beast\'s claws');
    pcaaoHandToHandAttackDamage(foe(), p, 5, false, () => 0);
    assert.deepEqual(seen, [], 'never a foe\'s');
  } finally { registerWeaponBlowMod('bal10-probe', null); }
});

test('MARTIAL4 THE PASSIVES: each through its own seam, on both sides of its line - the blow, the strike, the pace, the damage door, the evasion, the hurt, the kill, the round and the fold; asleep in a duel, mentoring and as the beast (mutants: each number; each line; a window never ending)', () => {
  reset();
  const w = weapon(WEAPONS.Longsword);
  // Blademaster: five landed blows, five stacks, 3% each - gone after 4 s
  const bm = pathFighter('blademaster');
  for (let i = 0; i < 6; i++) POW.martialStrike(bm, foe(), 10);
  assert.equal(blow100(w, bm, foe()), 115);
  _clock += 4.01; assert.equal(blow100(w, bm, foe()), 100);
  // Warblade: a kill quickens the swings 15% for 10 s
  reset();
  const wb = pathFighter('warblade'); door([], wb);
  assert.equal(POW.martialPace({ entity: wb }), 0);
  reportPlayerKill(foe());
  assert.equal(POW.martialPace({ entity: wb }), 15);
  _clock += 10.01; assert.equal(POW.martialPace({ entity: wb }), 0);
  // Vanguard: a foe's blow 10% lighter, whole points, the fraction carried; a fall is no blow
  reset();
  const vg = pathFighter('vanguard'); vg.health = vg.maxHealth = 1000; door([], vg);
  const orc = foe();
  setStruck(orc, vg, 100); hurtPlayer(vg, 100); assert.equal(vg.health, 910);
  hurtPlayer(vg, 100); assert.equal(vg.health, 810, 'a fall is whole');
  const h0 = vg.health;
  setStruck(orc, vg, 5); hurtPlayer(vg, 5); setStruck(orc, vg, 5); hurtPlayer(vg, 5);
  assert.equal(h0 - vg.health, 9, 'half a point carried');
  // Ranger: beasts 20% harder; a class foe is a man
  reset();
  const rg = pathFighter('ranger');
  const rat = foe({ careerIndex: 0 });
  assert.equal(enemyEntityGroup(0), ENEMY_GROUPS.Animals);
  assert.equal(blow100(w, rg, rat), 120);
  assert.equal(blow100(w, rg, foe({ careerIndex: 0, affinity: 'Human' })), 100);
  // Bladedancer: one foe blow in ten misses
  reset();
  const bd = pathFighter('bladedancer'); bd.health = bd.maxHealth = 1000; door([], bd);
  POW._setMartialPowersRandForTests(() => 0.099); setStruck(orc, bd, 10); hurtPlayer(bd, 10);
  assert.equal(bd.health, 1000, 'one in ten: missed whole');
  POW._setMartialPowersRandForTests(() => 0.1); setStruck(orc, bd, 10); hurtPlayer(bd, 10);
  assert.equal(bd.health, 990);
  POW._setMartialPowersRandForTests(() => 0); hurtPlayer(bd, 10);
  assert.equal(bd.health, 980, 'a fall is never evaded');
  // Bloodletter: a kill heals 5%; the City Watch never counts
  reset();
  const bl = pathFighter('bloodletter'); bl.health = 100; door([], bl);
  reportPlayerKill(foe()); assert.equal(bl.health, 110);
  reportPlayerKill(foe({ team: 'PlayerAlly' })); assert.equal(bl.health, 110);
  // Cutthroat: a foe that has not noticed me, 25%
  reset();
  const ct = pathFighter('cutthroat');
  assert.equal(blow100(w, ct, foe(), { unaware: true }), 125); assert.equal(blow100(w, ct, foe(), { unaware: false }), 100);
  // Assassin: the first landed blow at each foe, 30%
  reset();
  const as = pathFighter('assassin'); const mark = foe();
  assert.equal(blow100(w, as, mark), 130);
  POW.martialStrike(as, mark, 10);
  assert.equal(blow100(w, as, mark), 100); assert.equal(blow100(w, as, foe()), 130, 'another foe\'s first');
  // Shadowdancer and Windrunner: the fold
  reset();
  const sd = pathFighter('shadowdancer');
  const m1 = computeEntityMods(sd);
  assert.deepEqual([m1.stats.agility, m1.skills[SKILLS.Dodging]], [10, 15]);
  const wr = pathFighter('windrunner');
  const m2 = computeEntityMods(wr);
  assert.deepEqual([m2.stats.speed, m2.skills[SKILLS.Running], m2.skills[SKILLS.Jumping]], [10, 15, 15]);
  assert.equal(liveStat(wr, 'speed'), wr.stats.speed + 10);
  // Juggernaut: a hurt across 30% heals 20%, ready again after 3 minutes; one already under crosses nothing
  reset();
  const jg = pathFighter('juggernaut'); jg.health = jg.maxHealth = 100; door([], jg);
  hurtPlayer(jg, 75); assert.equal(jg.health, 45, 'crossed: 25 + 20');
  hurtPlayer(jg, 20); assert.equal(jg.health, 25, 'recovering');
  _clock += 181; jg.health = 25; hurtPlayer(jg, 5); assert.equal(jg.health, 20, 'under the line already: nothing crossed');
  jg.health = 40; hurtPlayer(jg, 20); assert.equal(jg.health, 40, 'ready again, crossed: 20 + 20');
  // Woodsman: a kill, 15% of the fatigue back
  reset();
  const wd = pathFighter('woodsman'); wd.fatigue = 0; door([], wd);
  reportPlayerKill(foe()); assert.equal(wd.fatigue, Math.round(maxFatigue(wd) * 0.15));
  // Berserker: under half, 20% harder and 10% quicker
  reset();
  const bz = pathFighter('berserker'); bz.health = 100;
  assert.equal(blow100(w, bz, foe()), 100);
  bz.health = 99; assert.equal(blow100(w, bz, foe()), 120);
  // Crusader: undead and daedra 20%
  reset();
  const cr = pathFighter('crusader');
  assert.equal(enemyEntityGroup(15), ENEMY_GROUPS.Undead);
  assert.equal(blow100(w, cr, foe({ careerIndex: 15 })), 120); assert.equal(blow100(w, cr, foe()), 100);
  // Brawler: each round, 1% of the health and 2% of the fatigue
  reset();
  const br = pathFighter('brawler'); br.health = 100; br.fatigue = 0;
  POW.martialRound(br);
  assert.equal(br.health, 102); assert.equal(br.fatigue, Math.round(maxFatigue(br) * 0.02));
  // asleep: a duel, mentoring, the beast
  reset();
  const cz = pathFighter('cutthroat');
  setSigilDueling(true); try { assert.equal(blow100(w, cz, foe(), { unaware: true }), 100); } finally { setSigilDueling(false); }
  cz._mentor = { level: 2 }; assert.equal(blow100(w, cz, foe(), { unaware: true }), 100); cz._mentor = null;
  cz.isInBeastForm = true; assert.equal(blow100(w, cz, foe(), { unaware: true }), 100);
});

test('MARTIAL3 THE RIDERS: each through the one landing door both resolutions tell, on a foe of mine alone - and the door told by the swing\'s resolveHit and the shaft\'s playerArrowHitFoe (mutants: each rider\'s number; another path\'s form answered; the tell dropped from either resolution)', () => {
  const rec = (name, ent) => ({ name, entity: ent, ai: { feet: [0, 0, 1] }, dead: false });
  const land = (id, f, damage, use = {}) => tellTechniqueLanded({ id, use }, f, damage);
  const used = (id, ent) => tellTechniqueUsed(id, {}, ent);   // PIN MOVED (AUDIT MARTIAL L1 L3): a window opens as the press goes
  // Blademaster: cut again for half
  reset();
  let me = pathFighter('blademaster'); let o = rec('o', foe()); let d = door([o], me);
  land('thousandCuts', o, 20); assert.deepEqual(d.hurts, [['o', 10]]);
  land('cyclone', o, 20); assert.deepEqual(d.hurts, [['o', 10]], 'another path\'s form answers nothing');
  // Warblade: 15% harder for 8 s
  reset(); me = pathFighter('warblade'); o = rec('o', foe()); door([o], me);
  used('rallyingCleave', me);
  const w = weapon(WEAPONS.Longsword);
  assert.equal(blow100(w, me, foe()), 115); _clock += 8.01; assert.equal(blow100(w, me, foe()), 100);
  // Vanguard: 4% of my health a foe, from three at most
  reset(); me = pathFighter('vanguard'); me.health = 50; me.maxHealth = 100; door([], me);
  const use = {};
  for (let i = 0; i < 5; i++) land('judgement', rec(`f${i}`, foe()), 10, use);
  assert.equal(me.health, 62);
  // Ranger: marked for 12 s, 20% harder
  reset(); me = pathFighter('ranger'); const prey = foe(); o = rec('o', prey); door([o], me);
  land('huntersMark', o, 10);
  assert.equal(blow100(weapon(WEAPONS.Long_Bow), me, prey), 120); _clock += 12.01; assert.equal(blow100(weapon(WEAPONS.Long_Bow), me, prey), 100);
  // Bladedancer: 20% quicker for 6 s
  reset(); me = pathFighter('bladedancer'); o = rec('o', foe()); door([o], me);
  used('cyclone', me); assert.equal(POW.martialPace({ entity: me }), 20);
  _clock += 6.01; assert.equal(POW.martialPace({ entity: me }), 0);
  // Bloodletter: a foe already under 25% takes it again (PIN MOVED, AUDIT MARTIAL L1 M1: its health before the blow - the
  // pool's door lands the blow after, and may land less)
  reset(); me = pathFighter('bloodletter'); o = rec('o', foe({ health: 24 })); const p25 = rec('p', foe({ health: 25 })); d = door([o, p25], me);
  land('guttingLunge', o, 6); assert.deepEqual(d.hurts, [['o', 6]], '24 of 100');
  land('guttingLunge', p25, 5); assert.deepEqual(d.hurts, [['o', 6]], '25 of 100, on the line: nothing');
  // Cutthroat: a foe that had not noticed me takes it twice
  reset(); me = pathFighter('cutthroat'); o = { ...rec('o', foe()), ai: { feet: [0, 0, 1], detected: false } }; d = door([o], me);
  land('blackjack', o, 12); assert.deepEqual(d.hurts, [['o', 12]]);
  land('blackjack', { ...o, ai: { detected: true } }, 12); assert.deepEqual(d.hurts, [['o', 12]], 'a foe that saw me: once');
  // Assassin: Chameleon, 4 rounds (one more than it says), once a press
  reset(); me = pathFighter('assassin'); d = door([], me);
  const u2 = {};
  land('vanishingShot', rec('a', foe()), 10, u2); land('vanishingShot', rec('b', foe()), 10, u2);
  assert.deepEqual(d.cast.map((b) => [b.effects[0].type, b.effects[0].durationBase]), [[23, 5]]);
  // Shadowdancer: one blow in three missed for 6 s
  reset(); me = pathFighter('shadowdancer'); me.health = me.maxHealth = 1000; door([], me);
  POW._setMartialPowersRandForTests(() => 0.33);
  setStruck(foe(), me, 10); hurtPlayer(me, 10); assert.equal(me.health, 990, 'before it, nothing evaded');
  used('phantomStrike', me);
  setStruck(foe(), me, 10); hurtPlayer(me, 10); assert.equal(me.health, 990, 'one in three: missed');
  _clock += 6.01; setStruck(foe(), me, 10); hurtPlayer(me, 10); assert.equal(me.health, 980, 'the window ends');
  // Juggernaut: foes' blows 25% lighter for 10 s
  reset(); me = pathFighter('juggernaut'); door([], me);
  used('earthsplitter', me);
  me.health = me.maxHealth = 1000;
  setStruck(foe(), me, 100); hurtPlayer(me, 100); assert.equal(me.health, 925);
  // Woodsman: a foe it fells restores 10% of my health - the kill's word (PIN MOVED, AUDIT MARTIAL L1 M1)
  reset(); me = pathFighter('woodsman'); me.health = 100; door([], me);
  const tree = foe({ health: 10 });
  land('fellingStrike', rec('o', tree), 9); assert.equal(me.health, 100, 'not felled');
  reportPlayerKill(tree); assert.equal(me.health, 120, '10% of 200, its kill');
  // Berserker: 10% of every landed blow heals for 8 s
  reset(); me = pathFighter('berserker'); me.health = 100; door([], me);
  used('savageWhirl', me);
  POW.martialStrike(me, foe(), 50); assert.equal(me.health, 105);
  // Crusader: undead and daedra take half again
  reset(); me = pathFighter('crusader'); o = rec('o', foe({ careerIndex: 15 })); const man = rec('man', foe()); d = door([o, man], me);
  land('hallowedShot', o, 20); land('hallowedStrike', man, 20);
  assert.deepEqual(d.hurts, [['o', 10]]);
  // Brawler: the foe it strikes hits me 30% lighter for 8 s
  reset(); me = pathFighter('brawler'); const thug = foe(); door([], me);
  land('knockout', rec('t', thug), 10);
  me.health = me.maxHealth = 1000;
  setStruck(thug, me, 100); hurtPlayer(me, 100); assert.equal(me.health, 930);
  setStruck(foe(), me, 100); hurtPlayer(me, 100); assert.equal(me.health, 830, 'another foe: whole');
  // Windrunner: 5% of my fatigue a foe, three at most
  reset(); me = pathFighter('windrunner'); me.fatigue = 0; door([], me);
  const u3 = {}; for (let i = 0; i < 4; i++) land('windVolley', rec(`f${i}`, foe()), 5, u3);
  assert.equal(me.fatigue, 3 * Math.round(maxFatigue(me) * 0.05));
  // never a player, never asleep
  reset(); me = pathFighter('blademaster'); const pl = rec('p', { ...foe(), isPlayer: true }); o = rec('o', foe()); d = door([pl, o], me);
  land('thousandCuts', pl, 20); setSigilDueling(true); try { land('thousandCuts', o, 20); } finally { setSigilDueling(false); }
  assert.deepEqual(d.hurts, []);
  // THE TELL: the swing's one resolution and the shaft's
  reset(); me = pathFighter('blademaster');
  const told = [];
  const pw = new PlayerWeapon({ weapon: w, liveSpeed: 50 });
  pw.techniqueBlow = { id: 'thousandCuts', mult: 1, reach: 3, arc: 'all', feet: [0, 0, 0], yaw: 0, use: {} };
  const struck = rec('s', foe());
  d = door([struck], me);
  pw.resolveHit([struck], me, () => ({ dist: 1, inView: true, losClear: true }), () => 0);
  assert.equal(d.hurts.length, 1, 'resolveHit told the landing: cut again');
  told.push(...d.hurts);
  const shaft = { weapon: weapon(WEAPONS.Long_Bow), technique: { id: 'huntersMark', mult: 1, pierce: 1 }, pos: [0, 0, 0] };
  reset(); me = pathFighter('ranger'); const deer = foe({ careerIndex: 0 }); const rd = rec('d', deer); door([rd], me);
  playerArrowHitFoe(shaft, rd, { playerEntity: me, rolls: () => 0 });
  assert.equal(blow100(weapon(WEAPONS.Long_Bow), me, deer), 140, 'playerArrowHitFoe told the landing: the mark (20) on a beast (20)');
});

test('BAL10 THE FIRMAMENT: every weapon family two notables that raise its skill - Axe and Blunt a third - stats moved, never a key; no sign passes a cap (mutants: a notable\'s skill dropped)', () => {
  const named = (name) => [...FIRM_NODES.values()].find((n) => n.name === name);
  // PIN MOVED (AUDIT MARTIAL L2 F9): each skill notable keeps every stat it had, the skill beside it
  assert.deepEqual({ ...named('Blade Dancer').stats }, { longDmg: 4, speed: 2, 'skill.LongBlade': 4 });
  assert.deepEqual({ ...named('Iron Knuckles').stats }, { fistDmg: 5, strength: 3, 'skill.HandToHand': 4 });
  assert.deepEqual({ ...named('Headsman').stats }, { axeDmg: 4, strength: 3, 'skill.Axe': 5 });
  assert.deepEqual({ ...named('Bonebreaker').stats }, { bluntDmg: 4, meleeDmg: 2, 'skill.BluntWeapon': 5 });
  assert.deepEqual({ ...named('Carnage').stats }, { killHeal: 2, axeDmg: 4 });
  assert.deepEqual({ ...named("Templar's Mace").stats }, { bluntDmg: 5, spellPower: 4 });
  assert.equal(named("Battlemage's Focus"), undefined, 'renamed - the Elite Gates\' Vestige keeps the name');
  for (const [skill, dmg] of [['LongBlade', 'longDmg'], ['ShortBlade', 'shortDmg'], ['Axe', 'axeDmg'], ['BluntWeapon', 'bluntDmg'], ['Archery', 'bowDmg'], ['HandToHand', 'fistDmg']]) {
    const notables = [...FIRM_NODES.values()].filter((n) => n.kind === 'notable' && n.stats[`skill.${skill}`] > 0);
    assert.ok(notables.length >= 2, `${skill}: ${notables.map((n) => n.name)}`);
    assert.ok([...FIRM_NODES.values()].some((n) => n.kind === 'notable' && n.stats[dmg] > 0), dmg);
  }
  assert.equal(named('Headsman').key, 'wr.c1.2', 'the key stands');
});

test('MARTIAL THE SEAMS: every host\'s rig registers the powers; the one ask, the classic sheet\'s W row and the enhanced card read the law; the save writes both fields', () => {
  assert.match(src('src/combat/weapon/weaponRig.js'), /^import '\.\.\/\.\.\/systems\/martialPowers\.js';/m);
  assert.match(src('src/systems/martialPowers.js'), /^import '\.\/weaponMastery\.js';/m);
  const shared = src('src/scenes/shared.js');
  assert.match(shared, /const martial = ask && !windowed \? nextMartialChoice\(entity\) : null;/);
  assert.match(shared, /entity\.martialPrompted = true;/);
  const sheet = src('src/ui/charsheet.js');
  assert.match(sheet, /action === 'KeyW' \|\| action === 'w'\)\) \{ this\._martialPrompt\(\); return; \}/);
  // PIN MOVED (GROWTH2, bible/10-UI/Growth.md section 5): the enhanced card is the Growth tab's guide, reading the same law
  assert.match(src('src/ui/growth/specGuide.js'), /pair: \(p\) => p\.skills, pairText: martialSkillsText, ask: \(e, id\) => martialChoiceRows\(e, id\), choose: chooseMartialPath,/);
  assert.match(src('src/combat/playerWeapon.js'), /if \(techOn\(foe\)\) tellTechniqueLanded\(tb, foe, blow\);/);
  assert.match(src('src/combat/arrowFlight.js'), /if \(m\.technique && !playerBody\(foe\)\) tellTechniqueLanded\(m\.technique, foe, dmg\);/);
  // BAL10: both mods' arms hand the swing reader's word on, and the sheet's estimate reads the fists' modifiers as the cores do
  assert.match(src('src/systems/roleplayRealismItems/rriKits.js'), /shortBlade: !melee && techniqueFamily\(weapon\) === 'shortBlade',/);
  assert.match(src('src/systems/roleplayRealism/rrInstall.js'), /weight, shortBlade: !!w\?\.shortBlade \}\);/);
  assert.match(src('src/combat/combatStats.js'), /return entity\.isInBeastForm \? d : weaponBlowMods\(null, d, entity, foe, ESTIMATE\);/);   // PIN MOVED (AUDIT MARTIAL L2 F7): the estimate's own word
});

// AUDIT MARTIAL L5 L2: every hook back at its rest when the file ends, whatever a test left
after(() => { reset(); POW._setMartialPowersClockForTests(null); });
