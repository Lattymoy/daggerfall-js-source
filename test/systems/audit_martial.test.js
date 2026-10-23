// AUDIT MARTIAL (2026-10-17; bible/01-Overview/audits/Audit-Martial.md). The owner, of PR #990 (MARTIAL + BAL10): "Please
// audit and ensure everything is perfection". Five cold lanes read a frozen snapshot (3866fefae) - the law and the powers,
// the engine's edits, online integrity, the surface and its words, the pins and the record - and every finding fixed here
// is pinned by execution through the producers that mint the shapes in play: real foes (makeEnemyEntity), the real save,
// the technique runner's own press (stepTechnique), the landing seam both resolutions tell, the kill seam, the magic
// round, the swing law and both mods' arms, the Stats page's estimate, the relay's stand-in (bossStandIn), the shaft's
// door into a body the relay runs, the classic sheet's own drawing and the law's words in the player's language. Each
// pin fails on the frozen code.
import { modsOff } from '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ALLOC_CHILD_ARGS } from '../allocChild.mjs';
import * as MP from '../../src/systems/martialPaths.js';
import * as POW from '../../src/systems/martialPowers.js';
import * as WM from '../../src/systems/weaponMastery.js';
import * as AP from '../../src/systems/arcanePaths.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { masterSkill, masterableCount } from '../../src/systems/masterSkills.js';
import { SKILLS } from '../../src/systems/skills.js';
import { playerEntity, hurtPlayer } from '../../src/characters/playerEntity.js';
import { weaponBlowMods } from '../../src/systems/entityMods.js';
import { setStruck, _resetSetPowersForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { setSigilDueling } from '../../src/systems/sigil/sigil.js';
import { setPlayerDoor, oweFoe, takeOwed } from '../../src/systems/playerDoor.js';
import { _resetPlayerHealForTests } from '../../src/systems/playerHeal.js';
import { reportPlayerKill } from '../../src/systems/playerKills.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { maxFatigue } from '../../src/systems/statMods.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { LOOT_RARITY_KEY } from '../../src/systems/loot/lootRarity.js';
import { TOLL_REFUND_S } from '../../src/systems/loot/lootPowers.js';
import { stepTechnique, refusal, techniqueInHand, claimShot, _resetTechniquesForTests } from '../../src/combat/techniques.js';
import { tellTechniqueLanded } from '../../src/combat/technique/techniqueBlow.js';
import { shaftOnRelayBody } from '../../src/combat/arrowFlight.js';
import { calculateAttackDamage } from '../../src/combat/formulas.js';
import { OFF_HAND_BLOW } from '../../src/combat/twoHands/handsLaw.js';
import { computeCombatStats } from '../../src/combat/combatStats.js';
import { getMeleeWeaponAnimTime, registerMeleeWeaponAnimTime, registerSwingReader, registerSwingPaceMod } from '../../src/characters/weaponStates.js';
import { installSwingLaw } from '../../src/combat/swingLaw.js';
import { rrMeleeWeaponAnimTime } from '../../src/systems/roleplayRealism/rrRealism.js';
import { runMagicRoundsFor } from '../../src/systems/worldTick.js';
import { setCourtRules } from '../../src/systems/courtRules.js';
import { bossStandIn } from '../../src/world/gate/gateBoss.js';
import { makeEnemyEntity } from '../../src/characters/enemy/enemyEntity.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { KNIGHT_CITY_WATCH } from '../../src/characters/mobile/mobileTypes.js';
import { EQUIP_SLOTS, equipTableOf } from '../../src/systems/equip.js';
import { mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { FIRM_NODES } from '../../src/net/firmament/firmamentTree.js';
import { pathTo } from '../../src/net/firmament/firmamentLaw.js';
import { setFirmamentTree, setFirmamentOnline, _resetFirmamentLiveForTests } from '../../src/systems/firmamentLive.js';
import { _resetFirmamentPowersForTests } from '../../src/systems/firmamentPowers.js';
import { CharSheet } from '../../src/ui/charsheet.js';
import { patchLocaleTable, parseStringTableCsv, setLocale } from '../../src/systems/textManager.js';
import { registerWeaponBlowMod } from '../../src/systems/entityMods.js';
import { pcaaoAttackDamage } from '../../src/combat/pcaao.js';
import { PlayerWeapon } from '../../src/combat/playerWeapon.js';
import { playerArrowHitFoe } from '../../src/combat/arrowFlight.js';
import { registerTechniqueLandedListener, registerTechniqueUsedListener } from '../../src/combat/technique/techniqueBlow.js';
import { techniqueWait } from '../../src/combat/techniques.js';
import { techniqueFxLive, resetTechniqueFx } from '../../src/combat/technique/techniqueFx.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { ARROW_TEMPLATE } from '../../src/systems/inventory.js';
import { swingPacePct, swingHandling, SWING_FRAME_MIN } from '../../src/characters/weaponStates.js';
import { readSwing } from '../../src/combat/swingLaw.js';
import { WEAPON_TYPES } from '../../src/combat/fpsWeapon.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { installRoleplayRealismItems } from '../../src/systems/roleplayRealismItems/rriInstall.js';
import { installRoleplayRealism } from '../../src/systems/roleplayRealism/rrInstall.js';
import { rriMeleeWeaponAnimTime } from '../../src/systems/roleplayRealismItems/rriRealism.js';
import { liveStat } from '../../src/systems/statMods.js';
import { THUNDERLOCK_TEMPLATE } from '../../src/characters/thunderlockIds.js';
import { raisePlayerSkills } from '../../src/scenes/shared.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const { LongBlade: LB, ShortBlade: SB, Axe: AX, BluntWeapon: BL, Archery: AR, HandToHand: HH } = SKILLS;
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const STATS = { strength: 70, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 50, luck: 50 };
const career = buildCustomCareer({ name: 'Fighter', hp: 12, stats: STATS,
  skills: [LB, SB, AX, BL, AR, HH, SKILLS.Dodging, SKILLS.CriticalStrike, SKILLS.Running, SKILLS.Jumping, SKILLS.Climbing, SKILLS.Swimming] });
/** A chargen'd fighter, online, level 20, `skills` mastered and standing at `raw` (martial_paths.test.js's own). */
function fighter(skills = [], raw = 150, c = career) {
  const p = structuredClone(playerEntity);
  createCharacter(p, c, -1, { rolls: () => 0.5 });
  p._online = true; p.level = 20; p.activeEffects = [];
  p.health = p.maxHealth = 200; p.fatigue = 0;
  for (const s of skills) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true, `master ${s}`); p.skills[s] = raw; }
  return p;
}
function pathFighter(id, raw = 150) {
  const p = fighter(MP.MARTIAL_BY_ID[id].skills, raw);
  assert.equal(MP.chooseMartialPath(p, id).ok, true);
  return p;
}
const weapon = (templateIndex, extra = {}) => mintCondition(setItemFields({ group: 'Weapons', templateIndex, material: 0, ...extra }));
const held = (p, it) => { p.items = [it]; equipTableOf(p)[EQUIP_SLOTS.RightHand] = it; return p; };
/** A REAL FOE as the hosts mint it (audit_schools.test.js realFoe). */
const FOE_CAREER = { hitPointsPerLevel: 8, strength: 50, intelligence: 50, willpower: 0, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
const realFoe = (mt, over = {}) => Object.assign(makeEnemyEntity(mt, ENEMY_BASICS[mt], FOE_CAREER, 21, () => 0.5), { activeEffects: [] }, over);
const ORC = 7, RAT = 0, SKELETON = 15;
const rec = (name, entity, ai = {}) => ({ name, entity, ai: { feet: [0, 0, 1], isHostile: true, ...ai }, dead: false });
/** A door: foe records, the hurts it takes, the bundles cast on me. */
function door(foes = [], me = null) {
  const d = { hurts: [], cast: [], opts: [] };
  setPlayerDoor({ foes: () => foes.filter((f) => !f.dead), feet: () => [0, 0, 0], hurtFoe: (f, n) => d.hurts.push([f.name, n]), castOnPlayer: (b, o) => { d.cast.push(b); d.opts.push(o ?? null); }, player: () => me });
  return d;
}
const land = (id, f, damage, use = {}) => tellTechniqueLanded({ id, use }, f, damage);
/** The runner's ctx for a press (martial_paths.test.js press): a drawn weapon's machine at rest, a door that drains. */
function press(p, item) {
  const pw = { weapon: item?.group === 'Weapons' ? item : null, sheathed: false, machine: { state: 'Idle', now: 0, cooldownUntil: 0 } };
  return { entity: p, pw, held: true, ready: true, cam: { feet: [0, 0, 0], pos: [0, 1.6, 0], yaw: 0, pitch: 0 }, rig: {}, door: { drainFatigue: (n) => { p.fatigue -= n; } }, startSwing: () => true, say: () => {} };
}
let _clock = 100;
/** Every hook back at its rest - at each test's start and its end (AUDIT SCHOOLS L5 M5's law). */
function reset() {
  POW._resetMartialPowersForTests(); WM._resetWeaponMasteryForTests(); _resetSetPowersForTests(); _resetPlayerHealForTests(); _resetTechniquesForTests();
  _clock = 100; POW._setMartialPowersClockForTests(() => _clock); POW._setMartialPowersRandForTests(null);
  setSigilDueling(false); setPlayerDoor(null); setPref(LOOT_RARITY_KEY, true); setCourtRules(false); setLocale('en');
}
/** A test's body between two rests - the hooks reset at its start and at its end, whatever it throws (an async body
 *  at its settling). */
function clean(fn) {
  reset();
  const done = () => { reset(); POW._setMartialPowersClockForTests(null); };
  let r;
  try { r = fn(); } catch (e) { done(); throw e; }
  if (r && typeof r.then === 'function') return r.finally(done);
  done();
  return r;
}

test('AUDIT MARTIAL L1 M1: nothing guesses what the pool\'s door leaves - Felling Strike heals for a foe its kill fells within the loot\'s bound, never one left standing; Thousand Cuts cuts a foe the blow may not fell; Gutting Lunge reads the foe\'s health before the blow (mutants: the heal at the landing; the bound dropped; the cut guarded by a guess; the lunge after the blow)', () => clean(() => {
  let me = pathFighter('woodsman'); me.health = 100; door([], me);
  const tree = realFoe(ORC, { health: 8 });
  land('fellingStrike', rec('o', tree), 9);
  assert.equal(me.health, 100, 'a party\'s toughness may keep it standing: no heal at the landing');
  reportPlayerKill(tree);
  assert.equal(me.health, 120, 'its kill fells it: 10% of 200');
  reportPlayerKill(tree); assert.equal(me.health, 120, 'one heal a felling');
  const late = realFoe(ORC, { health: 8 });
  land('fellingVolley', rec('l', late), 9);
  _clock += TOLL_REFUND_S + 0.01; reportPlayerKill(late);
  assert.equal(me.health, 120, 'a kill past the bound is another blow\'s');
  reset();
  me = pathFighter('blademaster'); const o = rec('o', realFoe(ORC, { health: 6 })); let d = door([o], me);
  land('thousandCuts', o, 8);
  assert.deepEqual(d.hurts, [['o', 4]], 'cut again for half - the door, not a guess, decides whether the blow fells it');
  reset();
  me = pathFighter('bloodletter');
  const thirty = rec('t', realFoe(ORC)); thirty.entity.health = Math.round(thirty.entity.maxHealth * 0.3);
  const under = rec('u', realFoe(ORC)); under.entity.health = Math.floor(under.entity.maxHealth * 0.24);
  d = door([thirty, under], me);
  land('guttingLunge', thirty, thirty.entity.health - 2);
  assert.deepEqual(d.hurts, [], 'at 30% before the blow: none (the frozen code took it again on its guess of what the blow left)');
  land('guttingLunge', under, 5);
  assert.deepEqual(d.hurts, [['u', 5]], 'already under 25%: the blow again');
}));

test('AUDIT MARTIAL L1 L1: Windstrike\'s "at most 3 foes" counts foes, never shafts - two shafts of one volley on one foe pay once, and the third foe still pays (mutants: a landing counted; a repeat foe counted)', () => clean(() => {
  const me = pathFighter('windrunner'); me.fatigue = 0; door([], me);
  const use = {};
  const one = rec('a', realFoe(ORC)), two = rec('b', realFoe(RAT)), three = rec('c', realFoe(ORC)), four = rec('d', realFoe(ORC));
  const pay = Math.round(maxFatigue(me) * 0.05);
  land('windVolley', one, 3, use); land('windVolley', one, 3, use);
  assert.equal(me.fatigue, pay, 'two shafts, one foe');
  land('windVolley', two, 3, use); land('windVolley', three, 3, use); land('windVolley', four, 3, use);
  assert.equal(me.fatigue, 3 * pay, 'three foes, the fourth none');
}));

test('AUDIT MARTIAL L1 L2: Flowing Steel builds from a blow that counts whole - an off-hand blow that does not builds no stack (the loot\'s Flow\'s law, TWO-HANDS AUDIT 2), through the real formula (mutants: info.blow ignored)', () => clean(() => {
  const me = pathFighter('blademaster');
  const blade = weapon(WEAPONS.Shortsword);
  for (let i = 0; i < 5; i++) calculateAttackDamage(me, realFoe(ORC), { weapon: blade, rolls: () => 0.85, ...OFF_HAND_BLOW });
  assert.equal(POW.martialBlowPct(me, realFoe(ORC)), 0, 'five off-hand blows that count no whole charge: no stack');
  for (let i = 0; i < 2; i++) calculateAttackDamage(me, realFoe(ORC), { weapon: blade, rolls: () => 0.3 });
  assert.equal(POW.martialBlowPct(me, realFoe(ORC)), 2 * MP.MARTIAL_NUMBERS.flowingSteel.pct, 'two whole blows: two stacks');
}));

test('AUDIT MARTIAL L1 L3 / L1 L7: a signature\'s window opens AS THE PRESS GOES - the runner\'s real press, no foe struck: Rallying Cleave\'s blows, Cyclone\'s pace, Earthsplitter\'s guard, Savage Whirl\'s leech, Phantom Strike\'s evasion (the words say so; told at a landing, the window opened mid-sweep and never on a whiff) (mutants: the press untold; a window at the landing)', () => clean(() => {
  const pressOf = (id, item) => { const me = pathFighter(id); held(me, item); me.fatigue = maxFatigue(me); door([], me); stepTechnique(1 / 60, press(me, item)); return me; };
  let me = pressOf('warblade', weapon(WEAPONS.War_Axe));
  assert.equal(weaponBlowMods(weapon(WEAPONS.War_Axe), 100, me, realFoe(ORC), { unaware: false }) >= 115, true, 'Rallying Cleave\'s 15% on the next blow');
  assert.equal(POW.martialBlowPct(me, realFoe(ORC)), MP.MARTIAL_NUMBERS.rallyingCleave.pct);
  reset(); me = pressOf('bladedancer', weapon(WEAPONS.Longsword));
  assert.equal(POW.martialPace({ entity: me }), MP.MARTIAL_NUMBERS.cyclone.pace, 'Cyclone\'s quickening');
  reset(); me = pressOf('juggernaut', weapon(WEAPONS.Warhammer));
  me.health = me.maxHealth = 1000; setStruck(realFoe(ORC), me, 100); hurtPlayer(me, 100);
  assert.equal(me.health, 925, 'Earthsplitter\'s 25% lighter, the swing a whiff');
  reset(); me = pressOf('berserker', weapon(WEAPONS.War_Axe));
  me.health = 100; POW.martialStrike(me, realFoe(ORC, { health: 1000, maxHealth: 1000 }), 50);
  assert.equal(me.health, 105, 'Savage Whirl\'s leech from the press on');
  reset(); me = pathFighter('shadowdancer'); door([], me);   // its form is a dash at a foe (a motor and a mark the press here has none of): the seam the runner tells, told
  POW.martialUsed({ id: 'phantomStrike', entity: me });
  POW._setMartialPowersRandForTests(() => 0.33);
  me.health = me.maxHealth = 1000; setStruck(realFoe(ORC), me, 10); hurtPlayer(me, 10);
  assert.equal(me.health, 1000, 'Phantom Strike\'s one in three');
}));

test('AUDIT MARTIAL L1 L4: Savage Whirl\'s leech is of what the foe could lose, never the overkill (AUDIT SCHOOLS L1 M6\'s `took`) (mutants: the whole blow leeched)', () => clean(() => {
  const me = pathFighter('berserker'); me.health = 100; door([], me);
  POW.martialUsed({ id: 'savageWhirl', entity: me });
  POW.martialStrike(me, realFoe(RAT, { health: 3 }), 21);
  assert.equal(me.health, 100, '10% of 3 is 0.3 - the fraction carried');
  POW.martialStrike(me, realFoe(ORC, { health: 1000, maxHealth: 1000 }), 30);
  assert.equal(me.health, 103, '3 + the 0.3 carried');
}));

test('AUDIT MARTIAL L1 L5: no rider answers a foe no kill of mine counts - the City Watch, my own summon (mutants: neverCounts dropped at the landing)', () => clean(() => {
  let me = pathFighter('woodsman'); me.health = 100; door([], me);
  const watch = realFoe(KNIGHT_CITY_WATCH, { health: 5 });
  watch.mobileType = KNIGHT_CITY_WATCH;
  land('fellingStrike', rec('w', watch), 9); reportPlayerKill(watch);
  assert.equal(me.health, 100, 'felling the watch heals nothing');
  reset();
  me = pathFighter('crusader');
  const mine = rec('m', realFoe(SKELETON, { team: 'PlayerAlly' }));
  const d = door([mine], me);
  land('hallowedShot', mine, 20);
  assert.deepEqual(d.hurts, [], 'my own raised skeleton takes no Hallowed second burn');
}));

test('AUDIT MARTIAL L1 L6 / L2 F2: a signature\'s HUD chip makes nothing a frame - its name kept a text revision, never six lines built (TECHFX1\'s measure, in a child: the runner\'s frame and the chip with a path\'s signature in hand, under 2 bytes a frame) (mutants: the name rebuilt a read)', () => clean(() => {
  const url = (p) => JSON.stringify(pathToFileURL(join(ROOT, p)).href);
  const script = `
    await import(${url('test/modsOff.js')});
    globalThis.location = { search: '?online' };
    const T = await import(${url('src/combat/techniques.js')});
    const MP = await import(${url('src/systems/martialPaths.js')});
    const { createCharacter } = await import(${url('src/systems/chargen.js')});
    const { buildCustomCareer } = await import(${url('src/systems/customClass.js')});
    const { masterSkill } = await import(${url('src/systems/masterSkills.js')});
    const { SKILLS } = await import(${url('src/systems/skills.js')});
    const { playerEntity } = await import(${url('src/characters/playerEntity.js')});
    const { PlayerWeapon } = await import(${url('src/combat/playerWeapon.js')});
    const { createWeapon } = await import(${url('src/combat/enemyEquipment.js')});
    const S = SKILLS;
    const p = structuredClone(playerEntity);
    createCharacter(p, buildCustomCareer({ name: 'F', hp: 12, stats: { strength: 70, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 50, luck: 50 },
      skills: [S.LongBlade, S.Archery, S.ShortBlade, S.Axe, S.BluntWeapon, S.HandToHand, S.Dodging, S.CriticalStrike, S.Running, S.Jumping, S.Climbing, S.Swimming] }), -1, { rolls: () => 0.5 });
    p._online = true; p.fatigue = 6400;
    for (const s of [S.LongBlade, S.Archery]) { p.skills[s] = 100; masterSkill(p, s); }
    MP.chooseMartialPath(p, 'ranger');
    const bytes = (fn) => { for (let f = 0; f < 20000; f++) fn(); let least = Infinity; for (let w = 0; w < 6; w++) { globalThis.gc(); globalThis.gc(); const h0 = process.memoryUsage().heapUsed; for (let f = 0; f < 5000; f++) fn(); least = Math.min(least, (process.memoryUsage().heapUsed - h0) / 5000); } return least; };
    const sink = [], pos = [1, 2, 3];
    const out = { control: bytes(() => { sink[0] = [pos[0] + 0.5, pos[1] + 0.5, pos[2] + 0.5]; }) };
    const pw = new PlayerWeapon({ weapon: createWeapon(120, 1), liveSpeed: 50 }); pw.sheathed = false; pw.update(0);
    const ctx = { rig: {}, entity: p, pw, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: 0, feet: new Float32Array(3) }, collider: null, held: false, ready: true, cancel: false, paralyzed: false, blocked: false, holding: false, startSwing: () => false, door: null, say: () => {}, noteShot: () => {} };
    const key = () => 'MOUSE3';
    out.signature = bytes(() => { T.stepTechnique(1 / 60, ctx); sink[1] = T.techniqueHudChips(p, pw, key); });
    console.log(JSON.stringify({ out, name: T.techniqueHudChips(p, pw, key)[0]?.name ?? null }));
  `;
  const run = spawnSync(process.execPath, [...ALLOC_CHILD_ARGS, '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const r = JSON.parse(run.stdout.trim().split('\n').pop());
  assert.equal(r.name, 'Mark of the Hunt', 'the measure ran with the signature in hand');
  assert.ok(r.out.control >= 40, `the control made ${r.out.control.toFixed(2)} bytes a frame - the measure is blind`);
  assert.ok(r.out.signature < 2, `a signature in hand: ${r.out.signature.toFixed(2)} bytes a frame`);
}));

test('AUDIT MARTIAL L1 N1, L1 N3, L4 N3: a follow-up owed a body the relay runs shows its number; "blows and arrows" where arrows pay; Blackjack\'s "twice" is its number; Hallowed Strike\'s mace says its +25 to hit (mutants: the number in the record\'s branch alone; Blackjack\'s times moved)', () => clean(() => {
  const powers = src('src/systems/martialPowers.js');
  const shown = powers.indexOf('  if (!f?.dead) showFollowUp(n, word, entity);'), branch = powers.indexOf('  if (f) { if (!f.dead) door.hurtFoe(f, n); return; }');
  assert.ok(shown >= 0 && branch > shown, 'the number before the record\'s branch (the loot\'s again, ROSE-SEEN)');
  const W = (id) => MP.martialWords(id);
  assert.match(W('blademaster').passive, /blows or arrows/); assert.match(W('cutthroat').passive, /blows and arrows/);
  assert.match(W('berserker').passive, /blows and arrows/); assert.match(W('warblade').rider, /blows and arrows/);
  assert.equal(MP.MARTIAL_NUMBERS.blackjack.times, 2, 'the word "twice" is this number');
  assert.equal(W('cutthroat').rider, 'An enemy that hadn\'t noticed you takes the blow twice.');
  assert.match(W('crusader').techniqueText, /\+25 to hit\.$/);
}));

test('AUDIT MARTIAL L3 F1: an OLDER BUILD\'s save keeps the permanent choice - the career\'s mirror (a record every build carries whole) gives the path back, already asked; a mirror another character wrote (an heir\'s inherited career) gives nothing; the live career never holds it (mutants: no mirror written; the mirror read from a newer save; the character\'s id unread)', () => clean(() => {
  const p = pathFighter('cutthroat'); p.martialPrompted = true;
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(p)));
  assert.deepEqual(snap.career.martialMirror, { path: 'cutthroat', of: snap.characterId });
  const older = { ...snap }; delete older.martialPath; delete older.martialPrompted;   // what an older build saves again
  const back = structuredClone(playerEntity);
  restorePlayer(back, older);
  assert.equal(back.martialPath, 'cutthroat'); assert.equal(back.martialPrompted, true, 'never asked again - no second choice');
  assert.equal(back.career.martialMirror, undefined, 'the mirror is the save\'s');
  assert.deepEqual(MP.martialChoices(back), []);
  const heir = { ...older, career: { ...snap.career, martialMirror: { path: 'cutthroat', of: 'someone-else' } } };
  const child = structuredClone(playerEntity);
  restorePlayer(child, heir);
  assert.equal(child.martialPath, null, 'another character\'s choice is not this one\'s');
  const chose = { ...snap, martialPath: null, martialPrompted: false };
  const none = structuredClone(playerEntity);
  restorePlayer(none, chose);
  assert.equal(none.martialPath, null, 'a newer save says null for none - the mirror is never asked');
}));

test('AUDIT MARTIAL L3 F2 / L2 F1: a body the relay runs reads no half line - its health a placeholder - so the Axe and the Blunt Weapon past 100 each pay the plain potency there (x1.4 at 200, the halves\' mean); an ordinary foe keeps its halves (mutants: the placeholder read as full)', () => clean(() => {
  const axe = fighter([AX], 200), hammer = fighter([BL], 200);
  const boss = bossStandIn({ mobile: 31 }, 'the Warden');
  const at = (p, w, foe) => WM.weaponPastPct(w, p, foe, { online: true });
  assert.equal(at(axe, weapon(WEAPONS.War_Axe), boss), 40);
  assert.equal(at(hammer, weapon(WEAPONS.Warhammer), boss), 40);
  const wounded = realFoe(ORC); wounded.health = Math.floor(wounded.maxHealth * 0.2);
  const fresh = realFoe(ORC);
  assert.deepEqual([at(axe, weapon(WEAPONS.War_Axe), wounded), at(axe, weapon(WEAPONS.War_Axe), fresh)], [80, 0]);
  assert.deepEqual([at(hammer, weapon(WEAPONS.Warhammer), wounded), at(hammer, weapon(WEAPONS.Warhammer), fresh)], [0, 80]);
}));

test('AUDIT MARTIAL L3 F3: Grit regrows no health in the court whose law bars regeneration (WBX6), its fatigue still; outside it, both (mutants: the court unread)', () => clean(() => {
  const me = pathFighter('brawler'); me.maxHealth = 200; me.health = 100; me.fatigue = 0;
  const sinks = { heal() {}, damage() {}, fatigue() {}, magicka() {} };
  setCourtRules(true);
  runMagicRoundsFor(me, 0, 3, { sinks, rolls: () => 0.5 });
  assert.equal(me.health, 100, 'no regeneration in the court');
  assert.ok(me.fatigue > 0, 'its fatigue comes back');
  setCourtRules(false);
  runMagicRoundsFor(me, 3, 4, { sinks, rolls: () => 0.5 });
  assert.equal(me.health, 102, 'outside it: 1% of 200 a round');
}));

test('AUDIT MARTIAL L2 F3: the swing\'s pace reads the weapon only once a climb would pay - on a mod\'s own arm a Longsword\'s swing never asks the reader, and a Short Blade past 100 is paced off the swing\'s family with no record built (mutants: the reader asked eagerly; the climb read after the weapon)', () => clean(() => {
  let asked = 0;
  registerSwingReader(() => { asked++; return null; });
  registerMeleeWeaponAnimTime(() => 0.2);
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };   // the page's own switch (onlineLane.js isOnlinePage) - the climb pays online
  try {
    const sword = held(fighter([LB], 200), weapon(WEAPONS.Longsword));
    assert.equal(getMeleeWeaponAnimTime(50, { entity: sword, weaponType: 0, usingRightHand: true }), 0.2);
    const dirk = held(fighter([SB], 200), weapon(WEAPONS.Shortsword));
    assert.ok(Math.abs(getMeleeWeaponAnimTime(50, { entity: dirk, weaponType: 0, usingRightHand: true }) - 0.2 / 1.4) < 1e-9, 'x1.4 at 200');
    assert.equal(asked, 0, 'the record never built');
  } finally { registerMeleeWeaponAnimTime(null); installSwingLaw(); if (had === undefined) delete globalThis.location; else globalThis.location = had; }
}));

test('AUDIT MARTIAL L2 F5: a signature\'s shaft into the sea serpent\'s hide is weighed by its form and told to the riders, and what the blow owes the body rides its one claim (mutants: no weight; no tell; the owed left behind)', () => clean(() => {
  const me = pathFighter('ranger'); door([], me);
  const hide = bossStandIn({ mobile: 4 }, 'the sea serpent');
  const before = POW.martialBlowPct(me, hide);
  assert.equal(shaftOnRelayBody({ technique: { id: 'huntersMark', mult: 1.2, use: {} } }, hide, 10), 12, 'x1.2');
  assert.equal(POW.martialBlowPct(me, hide) - before, MP.MARTIAL_NUMBERS.huntersMark.pct, 'the hide marked');
  oweFoe(hide, 5);
  assert.equal(shaftOnRelayBody({ technique: null }, hide, 10), 15, 'a plain shaft carries what is owed');
  assert.equal(shaftOnRelayBody({ technique: null }, hide, 10), 10, 'once');
}));

test('AUDIT MARTIAL L2 F7: the Stats page\'s estimate keeps nothing - eight real fist blows land the same with the page built between them (the Firmament\'s fist stars carry a fraction a blow) (mutants: a carry written by the estimate)', () => clean(() => {
  const named = (name) => [...FIRM_NODES.values()].find((n) => n.name === name).key;
  const tree = { start: 'st.start', keys: [] };
  for (const k of [named('Pankration'), named('Iron Knuckles')]) tree.keys.push(...pathTo(tree, k));
  const run = (opens) => {
    _resetFirmamentLiveForTests(); _resetFirmamentPowersForTests();
    setFirmamentOnline(true); setFirmamentTree(tree);
    const p = fighter([HH], 120);
    const orc = makeEnemyEntity(ORC, ENEMY_BASICS[ORC], null, 20, () => 0.5);
    const seq = [];
    for (let i = 0; i < 8; i++) { seq.push(calculateAttackDamage(p, orc, { weapon: null, rolls: () => 0.3 })); if (i === 0) for (let k = 0; k < opens; k++) computeCombatStats(p, { weapon: null, core: 'classic' }); }
    return seq;
  };
  try {
    const plain = run(0);
    assert.ok(new Set(plain).size > 1, `the carry shows in the run: ${plain}`);
    assert.deepEqual(run(1), plain); assert.deepEqual(run(3), plain);
  } finally { _resetFirmamentLiveForTests(); _resetFirmamentPowersForTests(); }
  // the paths' own carries: a Berserker's Frenzy on the fists, and a Long Blade past 100 (online) on the sword
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try {
    const seq = (make, w, opens) => {
      reset();
      const p = make();
      const orc = makeEnemyEntity(ORC, ENEMY_BASICS[ORC], null, 20, () => 0.5);
      const out = [];
      for (let i = 0; i < 8; i++) { out.push(calculateAttackDamage(p, orc, { weapon: w, rolls: () => 0.3 })); if (i === 0) for (let k = 0; k < opens; k++) computeCombatStats(p, { weapon: w, core: 'classic' }); }
      return out;
    };
    // Frenzy's 20% on a 7-point fist blow through the registry both cores call - 1.4 a blow, the fraction carried
    const frenzy = (opens) => {
      reset();
      const p = pathFighter('berserker'); p.health = 40;
      const orc = makeEnemyEntity(ORC, ENEMY_BASICS[ORC], null, 20, () => 0.5);
      const out = [];
      for (let i = 0; i < 8; i++) { out.push(weaponBlowMods(null, 7, p, orc, { unaware: false })); if (i === 0) for (let k = 0; k < opens; k++) computeCombatStats(p, { weapon: null, core: 'classic' }); }
      return out;
    };
    const fists = frenzy(0);
    assert.ok(new Set(fists).size > 1, `Frenzy's carry shows: ${fists}`);
    for (const opens of [1, 2, 3]) assert.deepEqual(frenzy(opens), fists, `Frenzy's carry kept from the page (${opens})`);
    // and Flowing Steel's one stack, 3% of a 7 - the page's own blows sum to no whole point by chance
    const flowing = (opens) => {
      reset();
      const p = pathFighter('blademaster');
      const orc = makeEnemyEntity(ORC, ENEMY_BASICS[ORC], null, 20, () => 0.5);
      POW.martialStrike(p, orc, 10);
      const out = [];
      for (let i = 0; i < 12; i++) { out.push(weaponBlowMods(null, 7, p, orc, { unaware: false })); if (i === 0) for (let k = 0; k < opens; k++) computeCombatStats(p, { weapon: null, core: 'classic' }); }
      return out;
    };
    const flow = flowing(0);
    assert.ok(new Set(flow).size > 1, `Flowing Steel's carry shows: ${flow}`);
    for (const opens of [1, 2, 3]) assert.deepEqual(flowing(opens), flow, `Flowing Steel's carry kept from the page (${opens})`);
    const sword = weapon(WEAPONS.Longsword);
    const master = () => held(fighter([LB], 173), sword);
    const blades = seq(master, sword, 0);
    assert.ok(new Set(blades).size > 1, `the Long Blade's carry shows: ${blades}`);
    for (const opens of [1, 2, 3]) assert.deepEqual(seq(master, sword, opens), blades, `the past-100 carry kept from the page (${opens})`);
  } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; }
}));

test('AUDIT MARTIAL L2 F9 / L2 F11: each skill notable keeps every stat it had before BAL10, the skill beside it; and Roleplay & Realism\'s own arm blends a short blade as the dagger it handles as (mutants: a stat traded away; the blend the long blade\'s)', () => clean(() => {
  const named = (name) => ({ ...[...FIRM_NODES.values()].find((n) => n.name === name).stats });
  for (const [name, before, skill] of [['Blade Dancer', { longDmg: 4, speed: 2 }, 'skill.LongBlade'], ['Iron Knuckles', { fistDmg: 5, strength: 3 }, 'skill.HandToHand'],
    ['Headsman', { axeDmg: 4, strength: 3 }, 'skill.Axe'], ['Bonebreaker', { bluntDmg: 4, meleeDmg: 2 }, 'skill.BluntWeapon']]) {
    const now = named(name);
    for (const [k, v] of Object.entries(before)) assert.equal(now[k], v, `${name} keeps ${k}`);
    assert.ok(now[skill] > 0, `${name} raises ${skill}`);
  }
  const at = (weaponType, shortBlade) => rrMeleeWeaponAnimTime({ liveSpeed: 90, liveStrength: 40, weaponType, weight: 2, shortBlade });
  assert.equal(at(0, true), at(4, true), 'a shortsword drawn as a long blade swings as the dagger does');
  assert.ok(at(0, false) > at(0, true), 'a long blade keeps its own blend');
}));

/** FONT0003's advances for printable ASCII, in sixteenths of its em (DFU's face, the pack's TTF - lane 4's measure); a
 *  classic pixel is two of them. An accented letter is its base letter's; any other letter the widest. */
const UNITS = 'ffiljnmehihlehefifhikijjjjeegjhinjjjkkkjkfekinljjkkjklkmkkjgffjkgijijiijkfekfnkijjihgkjmliifffj';
const classicPx = (s) => [...s.normalize('NFD')].filter((c) => !/\p{M}/u.test(c)).reduce((w, c) => { const i = c.codePointAt(0) - 32; return w + (i >= 0 && i < UNITS.length ? UNITS.charCodeAt(i) - 97 : 13) / 2; }, 0);

test('AUDIT MARTIAL L4 M1: the line a choice says - martial and arcane - fits the classic screen\'s 312 px from the sheet\'s notice to its edge, unwrapped, for every path in English and every whole Latin language (the frozen martial line ran ~100 characters, and the arcane spell\'s sentence past the screen too) (mutants: the technique\'s sentence back)', () => clean(() => {
  const langs = ['en', 'cs', 'da', 'de', 'es', 'fr', 'id', 'it', 'nb', 'pt-BR', 'ro'];
  const mage = buildCustomCareer({ name: 'Mage', hp: 10, stats: STATS, skills: [SKILLS.Destruction, SKILLS.Restoration, SKILLS.Alteration, SKILLS.Mysticism, SKILLS.Illusion, SKILLS.Thaumaturgy, SB, AR, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking] });
  for (const lang of langs) {
    if (lang !== 'en') patchLocaleTable(lang, 'Port_Strings', parseStringTableCsv(src(`locales/${lang}/Port_Strings.csv`)));
    setLocale(lang);
    for (const p of MP.MARTIAL_PATHS) {
      const r = MP.chooseMartialPath(fighter(p.skills, 100), p.id);
      assert.ok(r.ok && classicPx(r.text) <= 312, `${lang} ${p.id}: "${r.text}" ${classicPx(r.text)} px`);
    }
    for (const p of AP.PATHS) {
      const m = fighter([], 100, mage);
      for (const s of p.schools) { m.skills[s] = 100; masterSkill(m, s); }
      const r = AP.choosePath(m, p.id);
      assert.ok(r.ok && classicPx(r.text) <= 312, `${lang} ${p.id}: "${r.text}" ${classicPx(r.text)} px`);
    }
  }
}));

test('AUDIT MARTIAL L4 L1: the classic skill plate never passes the screen\'s foot - the Minor page with Hand-to-Hand among its skills and both specialisation rows (204 of 200 on the frozen code) (mutants: the plate pinned at 100)', () => clean(() => {
  const spellsword = buildCustomCareer({ name: 'Spellsword', hp: 10, stats: STATS,
    skills: [SKILLS.Destruction, SKILLS.Restoration, SKILLS.Alteration, LB, SB, SKILLS.Mysticism, HH, SKILLS.Dodging, SKILLS.Running, SKILLS.Jumping, SKILLS.Climbing, SKILLS.Swimming] });
  const p = fighter([SKILLS.Destruction, SKILLS.Restoration, LB, SB], 100, spellsword);
  assert.ok(AP.pathChoices(p).length && MP.martialChoices(p).length, 'both rows show');
  const rects = [];
  const font = { tex: 'font', glyph: () => null, fnt: { fixedHeight: 7, fixedWidth: 4, glyphWidth: () => 4 } };
  const renderer = { uploadTexture: () => 'tex', releaseTexture() {}, drawScreenQuad(_t, r) { rects.push(r); }, drawScreenQuadRun() {} };
  const sheet = new CharSheet(p, {});
  sheet.page = 3;
  sheet._drawSkillPage(renderer, font, { s: 1, ox: 0, oy: 0 });
  const plate = rects[0];
  assert.ok(plate.y + plate.h <= 200, `plate y ${plate.y} h ${plate.h}`);
  assert.ok(sheet._martialRow[1] + sheet._martialRow[3] <= 200, 'the W row on the screen');
}));

test('AUDIT MARTIAL L4 L3: a card shows only to a character that can EVER meet a path - two weapon skills (or schools) both minor, one minor slot between them, never can; one mastered and one masterable can; slots spent elsewhere close it (mutants: the slots unread)', () => clean(() => {
  const twoMinors = buildCustomCareer({ name: 'Scholar', hp: 10, stats: STATS,
    skills: [SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking, SKILLS.Mercantile, SKILLS.Pickpocket, AR, SKILLS.Running, SKILLS.Jumping, SKILLS.Destruction, SKILLS.Restoration, LB] });
  const p = fighter([], 50, twoMinors);
  assert.deepEqual([twoMinors.minorSkills.includes(AR), twoMinors.minorSkills.includes(LB)], [true, true]);
  assert.equal(masterableCount(p, MP.MARTIAL_SKILLS), 1);
  assert.equal(MP.martialPossible(p), false, 'Archery and Long Blade both minor: one slot');
  assert.equal(AP.pathPossible(p), false, 'Destruction and Restoration both minor: the same');
  const f = fighter([], 50);
  assert.equal(MP.martialPossible(f), true);
  const spent = fighter([SKILLS.Dodging, SKILLS.CriticalStrike], 100, buildCustomCareer({ name: 'Rogue', hp: 10, stats: STATS,
    skills: [SKILLS.Dodging, SKILLS.CriticalStrike, LB, SKILLS.Running, SKILLS.Jumping, SKILLS.Climbing, SB, SKILLS.Swimming, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking] }));
  assert.equal(MP.martialPossible(spent), false, 'the primary slots spent on Dodging and Critical Strike: Long Blade never, Short Blade alone among the majors');
}));

test('AUDIT MARTIAL L4 L4 / L4 L6 / L4 N1 / L4 N2: the martial ask is never the arcane ask\'s words; a found line asleep (the ladder off) leaves the key to the signature; the runner\'s English lines name a signature in English; no path is named as a star of the Firmament (mutants: the title shared; the sleeping line kept; the localised name in an English line)', () => clean(() => {
  const ranger = pathFighter('ranger');
  assert.equal(MP.martialChoiceRows(fighter([LB, AR], 100), 'ranger')[0], 'Martial specialization: Ranger?', 'never "Specialize as" - the arcane ask\'s');
  const lined = weapon(WEAPONS.Longsword, { affixes: [{ id: 'technique', param: 'leap', value: 20 }] });
  assert.equal(techniqueInHand(ranger, { weapon: lined })?.id, 'leap', 'the ladder on: the line');
  setPref(LOOT_RARITY_KEY, false);
  assert.equal(techniqueInHand(ranger, { weapon: lined })?.id, 'huntersPounce', 'the ladder off: the line sleeps, the signature answers');
  setPref(LOOT_RARITY_KEY, true);
  patchLocaleTable('de', 'Port_Strings', [['martial.crusader.technique', 'Geweihter Schlag']]);
  setLocale('de');
  const cr = pathFighter('crusader'), mace = weapon(WEAPONS.Mace);
  held(cr, mace); cr.fatigue = maxFatigue(cr);
  const ctx = press(cr, mace);
  stepTechnique(1 / 60, ctx);   // the press goes, its cooldown set
  stepTechnique(1 / 60, { ...ctx, held: false });   // and its swing ends, the machine at rest
  const hand = techniqueInHand(cr, ctx.pw);
  assert.equal(hand.tech.name, 'Geweihter Schlag', 'the chip\'s name is the player\'s language');
  assert.match(String(refusal(hand, ctx)), /^Hallowed Strike is not ready \(\d+s\)\.$/, 'the English line, in English');
  setLocale('en');
  const stars = new Set([...FIRM_NODES.values()].map((n) => String(n.name ?? '').toLowerCase().replace(/[^a-z]/g, '')));
  for (const p of MP.MARTIAL_PATHS) assert.equal(stars.has(p.name.toLowerCase().replace(/[^a-z]/g, '')), false, `${p.name}: a star's name`);
  assert.deepEqual([MP.MARTIAL_BY_ID.bladedancer.name, MP.MARTIAL_BY_ID.windrunner.name], ['Skirmisher', 'Strider']);
}));

// ── LANE 5: what the pins could not fail ────────────────────────────────────────────────────────────────────────────

test('AUDIT MARTIAL L5 H1: BAL10\'S FISTS WHERE THEY RUN - both cores\' OUTER calls (calculateAttackDamage, PCAAO\'s pcaaoAttackDamage) lay the blow modifiers over a bare-handed blow whole (a +7 probe, the same roll), with the host\'s word that the foe had not noticed me; never the beast\'s fists, never a foe\'s (mutants: either core\'s result discarded; the overhaul\'s host word dropped)', () => clean(() => {
  const me = fighter([HH], 100);
  const calls = [];
  const stock = (who, at, unaware = false) => calculateAttackDamage(who, at, { weapon: null, rolls: () => 0.3, unaware });
  const over = (who, at, unaware = false) => pcaaoAttackDamage(who, at, { weapon: null, rolls: () => 0.3, dfRand: () => 0, unaware });
  const s0 = stock(me, realFoe(ORC), true), o0 = over(me, realFoe(ORC), true);
  assert.ok(s0 > 0 && o0 > 0, `both cores land the fist (${s0}, ${o0})`);
  registerWeaponBlowMod('audit-fist-probe', (w, d, a, t, info) => { if (w === null) calls.push([!!a?.isPlayer, !!info?.unaware]); return w === null ? d + 7 : d; });
  try {
    assert.equal(stock(me, realFoe(ORC), true), s0 + 7, 'the stock core: the probe whole');
    assert.equal(over(me, realFoe(ORC), true), o0 + 7, 'the overhaul\'s outer call: the probe whole');
    assert.deepEqual(calls, [[true, true], [true, true]], 'each with the host\'s word');
    calls.length = 0;
    const beast = fighter([HH], 100); beast.isInBeastForm = true;
    stock(beast, realFoe(ORC)); over(beast, realFoe(ORC));
    const thug = realFoe(143);
    stock(thug, me); over(thug, me);
    assert.deepEqual(calls, [], 'never the beast, never a foe');
  } finally { registerWeaponBlowMod('audit-fist-probe', null); }
}));

test('AUDIT MARTIAL L5 H1 / L2 F11: BAL10\'S SHORT BLADES WHERE THEY RUN - with the mods on as they ship, Roleplay & Realism: Items\' arm (on by default) and Roleplay & Realism\'s own swing a Shortsword (a long blade\'s sprite) as the dagger it handles as, through the one swing door (mutants: either arm\'s short-blade word dropped)', () => clean(() => {
  installRoleplayRealismItems({ fetchBytes: () => { throw new Error('no art in this pin'); } });
  installRoleplayRealism();
  _resetModSettings();
  try {
    const p = held(fighter(), weapon(WEAPONS.Shortsword));
    const ctx = { entity: p, weaponType: WEAPON_TYPES.LongBlade, usingRightHand: true };
    const w = readSwing(ctx), str = liveStat(p, 'strength');
    assert.equal(w.shortBlade, true);
    const items = (sb) => rriMeleeWeaponAnimTime({ liveSpeed: 80, liveStrength: str, weaponWeight: w.weight, melee: false, weaponType: WEAPON_TYPES.LongBlade, twoHanded: false, shortBlade: sb });
    assert.notEqual(items(true), items(false), 'the word moves the frame');
    assert.equal(getMeleeWeaponAnimTime(80, ctx), items(true), 'Items\' arm: the dagger\'s handling');
    setModSetting('roleplay-realism-items', 'weaponBalance', false);
    setModSetting('roleplay-realism', 'weaponSpeed', true);
    const rr = (sb) => rrMeleeWeaponAnimTime({ liveSpeed: 80, liveStrength: str, weaponType: WEAPON_TYPES.LongBlade, hands: 'One', weight: w.weight, shortBlade: sb });
    assert.notEqual(rr(true), rr(false));
    assert.equal(getMeleeWeaponAnimTime(80, ctx), rr(true), 'R&R\'s own arm: the dagger\'s handling and blend');
    assert.ok(swingHandling(WEAPON_TYPES.LongBlade, false, true) < 1 && SWING_FRAME_MIN > 0);
  } finally { modsOff(); }
}));

test('AUDIT MARTIAL L5 H3: THE STRIKE SEAM, DRIVEN - Opening Strike and the Berserker\'s leech through a real landing (calculateAttackDamage tells the strike listener), not a call to the power (mutants: the strike listener never registered)', () => clean(() => {
  const as = pathFighter('assassin'); held(as, weapon(WEAPONS.Shortsword));
  const mark = realFoe(ORC, { health: 1000, maxHealth: 1000 });
  assert.equal(POW.martialBlowPct(as, mark), MP.MARTIAL_NUMBERS.openingStrike.pct, 'the first blow at it');
  let landed = 0;
  for (let i = 0; i < 4 && !landed; i++) landed = calculateAttackDamage(as, mark, { weapon: weapon(WEAPONS.Shortsword), rolls: () => 0.3 });
  assert.ok(landed > 0);
  assert.equal(POW.martialBlowPct(as, mark), 0, 'its first blow landed: no more Opening Strike');
  reset();
  const bz = pathFighter('berserker'); bz.health = 100;
  POW.martialUsed({ id: 'savageWhirl', entity: bz });
  let dealt = 0;
  for (let i = 0; i < 4 && !dealt; i++) dealt = calculateAttackDamage(bz, realFoe(ORC, { health: 1000, maxHealth: 1000 }), { weapon: weapon(WEAPONS.War_Axe), rolls: () => 0.3 });
  assert.ok(dealt >= 10, `a blow of ${dealt}`);
  assert.equal(bz.health, 100 + Math.floor(dealt / 10), '10% of what landed, through the seam');
}));

/** The rig's frame context over a real PlayerWeapon (tech1_runner.test.js rig). */
function rigFor(entity, item, door = {}, cam = null) {
  const pw = new PlayerWeapon({ weapon: item, liveSpeed: 50 }); pw.sheathed = false; pw.update(0);
  const flat = { raycast: (o, d, max) => { if (!(d[1] < 0)) return Infinity; const t = -o[1] / d[1]; return t <= max ? t : Infinity; }, surfaceHit: (o, d, max) => (d[1] < 0 && o[1] >= 0 && o[1] <= max ? { dist: o[1], normal: [0, 1, 0] } : null), heightAt: () => 0 };
  const said = [], rig = {};   // one rig a frame's context - the runner starts over for another
  const ctx = (heldKey) => ({ rig, entity, pw, cam: cam ?? { pos: [0, 1.7, 0], yaw: 0, pitch: -0.2, feet: [0, 0, 0] }, collider: flat, held: heldKey, ready: true, cancel: false,
    startSwing: (s) => pw.techniqueStrike(s), door: { drainFatigue: (n) => { entity.fatigue -= n; }, ...door }, say: (l) => said.push(l), noteShot: () => {} });
  return { pw, ctx, said };
}

test('AUDIT MARTIAL L5 H4: THE PRESS PRODUCES THE SIGNATURE\'S BLOW AND ITS ONE TOKEN - a swing\'s blow is its form\'s (the mace\'s 1.5, +25, the nearest alone); a cyclone\'s two foes are told with the press\'s token; a leap\'s blow carries it; every shaft of a volley carries it (mutants: no token minted; the leap\'s blow without it; the rain without it; the blow read off the roster)', () => clean(() => {
  const used = [], told = [];
  registerTechniqueUsedListener('audit-press', (p) => used.push(p.use));
  registerTechniqueLandedListener('audit-press', (l) => told.push([l.blow.use, l.foe.name]));
  try {
    const cr = pathFighter('crusader'); cr.fatigue = maxFatigue(cr);
    const mace = weapon(WEAPONS.Mace); held(cr, mace);
    const r = rigFor(cr, mace);
    stepTechnique(1 / 60, r.ctx(true));
    const blow = r.pw.techniqueBlow;
    assert.deepEqual([blow.id, blow.mult, blow.toHit, blow.single], ['hallowedStrike', 1.5, 25, true], 'the form\'s blow');
    assert.ok(blow.use && typeof blow.use === 'object' && blow.use === used.at(-1), 'the press\'s token');
    reset(); used.length = 0;
    const bd = pathFighter('bladedancer'); bd.fatigue = maxFatigue(bd);
    const sword = weapon(WEAPONS.Longsword); held(bd, sword);
    const r2 = rigFor(bd, sword);
    stepTechnique(1 / 60, r2.ctx(true));
    const a = rec('a', realFoe(ORC), { feet: [0, 0, 1] }), b = rec('b', realFoe(ORC), { feet: [0, 0, -1] });
    door([a, b], bd);
    told.length = 0;
    r2.pw.resolveHit([a, b], bd, () => ({ dist: 1, inView: true, losClear: true }), () => 0.3);
    assert.deepEqual(told.map(([u, n]) => [u === used.at(-1), n]), [[true, 'a'], [true, 'b']], 'one token, both foes');
    reset(); used.length = 0;
    const vg = pathFighter('vanguard'); vg.fatigue = maxFatigue(vg);
    const blade = weapon(WEAPONS.Longsword); held(vg, blade);
    const target = rec('t', realFoe(ORC), { feet: [0, 0, 7], height: 1.8, yaw: 0 });
    setPlayerDoor({ foes: () => [target], player: () => vg });
    const motor = { grounded: true, techniqueLaunch() { this.grounded = false; return true; } };
    const r3 = rigFor(vg, blade, { motor: () => motor }, { pos: [0, 1.7, 0], yaw: 0, pitch: -0.02, feet: [0, 0, 0] });
    stepTechnique(1 / 60, r3.ctx(true));
    stepTechnique(1 / 60, r3.ctx(false));
    for (let t = 0; t < 2 && !r3.pw.techniqueBlow; t += 1 / 60) stepTechnique(1 / 60, r3.ctx(false));
    assert.ok(r3.pw.techniqueBlow, `the leap struck (${r3.said.join(' | ')})`);
    assert.equal(r3.pw.techniqueBlow.use, used.at(-1), 'the leap\'s blow carries the press\'s token');
    reset(); used.length = 0;
    const wr = pathFighter('windrunner'); wr.fatigue = maxFatigue(wr);
    const bow = weapon(WEAPONS.Long_Bow); held(wr, bow);
    wr.items.push({ ...createWeapon(ARROW_TEMPLATE, 0), stackCount: 12 });
    const fired = [];
    const r4 = rigFor(wr, bow, { fireArrow: (from, dir, o) => fired.push(o) });
    stepTechnique(1 / 60, r4.ctx(true)); stepTechnique(1 / 60, r4.ctx(true)); stepTechnique(1 / 60, r4.ctx(false));
    let evs = [];
    for (let i = 0; i < 120 && !evs.includes('hit'); i++) evs = r4.pw.update(1 / 60);
    claimShot(evs, r4.ctx(false));
    for (let i = 0; i < 180; i++) stepTechnique(1 / 60, r4.ctx(false));
    assert.ok(fired.length >= 2, `the volley fell (${fired.length})`);
    assert.ok(fired.every((o) => o.technique?.id === 'windVolley' && o.technique.use === used.at(-1)), 'every shaft carries the press\'s token');
  } finally { registerTechniqueUsedListener('audit-press', null); registerTechniqueLandedListener('audit-press', null); }
}));

test('AUDIT MARTIAL L5 H5: NEVER AT A PLAYER, NEVER THE WARD, NEVER IN A REFEREED FIGHT - a path\'s blow at a player\'s body or a warded foe lands as it was (Opening Strike would be 30%), a strike on a player builds no stack, and no pace quickens a swing in a duel (mutants: the blow\'s gate; the strike\'s gate; the ward unread; the pace in a duel)', () => clean(() => {
  const as = pathFighter('assassin');
  const sword = weapon(WEAPONS.Shortsword);
  assert.equal(weaponBlowMods(sword, 100, as, realFoe(ORC), { unaware: false }), 130, 'a foe: 30% harder');
  assert.equal(weaponBlowMods(sword, 100, as, { ...realFoe(ORC), isPlayer: true }, { unaware: false }), 100, 'a player\'s body');
  assert.equal(weaponBlowMods(sword, 100, as, realFoe(ORC, { warded: true }), { unaware: false }), 100, 'the Warden\'s ward');
  const bm = pathFighter('blademaster');
  POW.martialStrike(bm, { ...realFoe(ORC), isPlayer: true }, 10);
  assert.equal(POW.martialBlowPct(bm, realFoe(ORC)), 0, 'no stack from a player');
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try {
    const dirk = held(fighter([SB], 200), weapon(WEAPONS.Shortsword));
    const ctx = { entity: dirk, weaponType: WEAPON_TYPES.LongBlade, usingRightHand: true };
    assert.equal(swingPacePct(ctx, readSwing(ctx)), 40);
    setSigilDueling(true);
    assert.equal(swingPacePct(ctx, readSwing(ctx)), 0, 'a duel: no pace');
    setSigilDueling(false);
    registerSwingPaceMod('audit-slow', () => -30);
    try { assert.equal(swingPacePct(ctx, readSwing(ctx)), 40, 'a modifier answering less than nothing slows nothing'); } finally { registerSwingPaceMod('audit-slow', null); }
  } finally { setSigilDueling(false); if (had === undefined) delete globalThis.location; else globalThis.location = had; }
}));

test('AUDIT MARTIAL L5 M1: EVERY LINE ON BOTH SIDES, EVERY WINDOW AT ITS END - Stand Firm (a hurt to exactly 30% is no crossing; one from exactly 30% is; a saved death and a killing hurt none; ready at 180 s, not 179), Frenzy\'s pace at half and under it, and each window a hundredth before and after its end (mutants: each line\'s side; each window\'s length)', () => clean(() => {
  const jg = pathFighter('juggernaut'); jg.maxHealth = 1000; door([], jg);
  jg.health = 400; hurtPlayer(jg, 100); assert.equal(jg.health, 300, 'to exactly 30%: no crossing');
  hurtPlayer(jg, 10); assert.equal(jg.health, 490, 'from exactly 30%: crossed, 20% back');
  _clock += 179; jg.health = 310; hurtPlayer(jg, 20); assert.equal(jg.health, 290, 'a second short of ready');
  _clock += 1; jg.health = 310; hurtPlayer(jg, 20); assert.equal(jg.health, 490, 'ready on the second');
  _clock += 180; jg.health = 1;
  POW.martialHurt(jg, { before: 400, after: 1, saved: true }); assert.equal(jg.health, 1, 'a death a save turned aside: none');
  POW.martialHurt(jg, { before: 400, after: 0 }); assert.equal(jg.health, 1, 'a killing hurt: none');
  reset();
  const bz = pathFighter('berserker'); bz.maxHealth = 200;
  bz.health = 100; assert.equal(POW.martialPace({ entity: bz }), 0, 'at half: no Frenzy');
  bz.health = 99; assert.equal(POW.martialPace({ entity: bz }), MP.MARTIAL_NUMBERS.frenzy.pace);
  const N = MP.MARTIAL_NUMBERS;
  const edge = (label, open, on, seconds) => { reset(); const t0 = _clock; const read = open(); _clock = t0 + seconds - 0.01; assert.ok(on(read), `${label}: on just before its end`); _clock = t0 + seconds + 0.01; assert.ok(!on(read), `${label}: off just after`); };
  edge('Earthsplitter', () => { const me = pathFighter('juggernaut'); POW.martialUsed({ id: 'earthsplitter', entity: me }); door([], me); return me; }, (me) => { me.health = me.maxHealth = 1000; setStruck(realFoe(ORC), me, 100); hurtPlayer(me, 100); return me.health === 925; }, N.earthsplitter.seconds);
  edge('Savage Whirl', () => { const me = pathFighter('berserker'); POW.martialUsed({ id: 'savageWhirl', entity: me }); return me; }, (me) => { me.health = 100; POW.martialStrike(me, realFoe(ORC, { health: 1000, maxHealth: 1000 }), 50); return me.health === 105; }, N.savageWhirl.seconds);
  edge('Knockout', () => { const me = pathFighter('brawler'); door([], me); const thug = realFoe(ORC); land('knockout', rec('t', thug), 10); return { me, thug }; }, ({ me, thug }) => { me.health = me.maxHealth = 1000; setStruck(thug, me, 100); hurtPlayer(me, 100); return me.health === 930; }, N.knockout.seconds);
  edge('Flowing Steel', () => { const me = pathFighter('blademaster'); POW.martialStrike(me, realFoe(ORC), 10); return me; }, (me) => POW.martialBlowPct(me, realFoe(ORC)) === N.flowingSteel.pct, N.flowingSteel.seconds);
  edge('War Rhythm', () => { const me = pathFighter('warblade'); door([], me); reportPlayerKill(realFoe(ORC)); return me; }, (me) => POW.martialPace({ entity: me }) === N.warRhythm.pct, N.warRhythm.seconds);
  edge('Rallying Cleave', () => { const me = pathFighter('warblade'); POW.martialUsed({ id: 'rallyingCleave', entity: me }); return me; }, (me) => POW.martialBlowPct(me, realFoe(ORC)) === N.rallyingCleave.pct, N.rallyingCleave.seconds);
  edge('Mark of the Hunt', () => { const me = pathFighter('ranger'); door([], me); const prey = realFoe(ORC); land('huntersMark', rec('p', prey), 10); return { me, prey }; }, ({ me, prey }) => POW.martialBlowPct(me, prey) === N.huntersMark.pct, N.huntersMark.seconds);
}));

test('AUDIT MARTIAL L5 M2 / L5 L1: THE LAW\'S GUARDS - a mentored Ranger keeps the pounce (held) though its powers sleep (awake); a path restored with one of its skills unmastered (the save restores the id alone) holds nothing; the Thunderlock past 100 is paid on Archery; the hand at rest (restingWeapon) names the form (mutants: the signature through awake; a mastery unread; the Thunderlock unpaid; the resting hand unread)', () => clean(() => {
  const ranger = pathFighter('ranger');
  ranger._mentor = { level: 5 };
  assert.equal(techniqueInHand(ranger, { weapon: weapon(WEAPONS.Longsword) })?.id, 'huntersPounce', 'held while mentoring');
  assert.equal(POW.martialBlowPct(ranger, realFoe(RAT)), 0, 'its powers asleep');
  for (const [have, label] of [[[LB], 'Archery'], [[AR], 'Long Blade']]) {
    const forged = fighter(have, 150); forged.martialPath = 'ranger';
    assert.equal(MP.martialHeld(forged), null, `${label} unmastered: nothing held`);
    assert.equal(techniqueInHand(forged, { weapon: weapon(have[0] === LB ? WEAPONS.Longsword : WEAPONS.Long_Bow) }), null);
  }
  const archer = fighter([AR], 200);
  assert.equal(WM.weaponPastPct(weapon(THUNDERLOCK_TEMPLATE), archer, realFoe(ORC), { online: true }), 40, 'the Thunderlock is scored on Archery, and paid on it');
  const r = pathFighter('ranger');
  assert.equal(techniqueInHand(r, { restingWeapon: weapon(WEAPONS.Long_Bow), weapon: weapon(WEAPONS.Longsword) })?.id, 'huntersMark', 'the lead hand at rest names it');
}));

test('AUDIT MARTIAL L5 M3: NO KILL OF THE CITY WATCH OR AN ALLY (by its mobileTeam) PAYS A PATH - Bloodlust heals for a foe and for neither (mutants: the Watch counted; mobileTeam unread)', () => clean(() => {
  const me = pathFighter('bloodletter'); me.health = 100; door([], me);
  const watch = realFoe(KNIGHT_CITY_WATCH); watch.mobileType = KNIGHT_CITY_WATCH;
  reportPlayerKill(watch); assert.equal(me.health, 100, 'the Watch');
  reportPlayerKill(realFoe(ORC, { mobileTeam: 'PlayerAlly' })); assert.equal(me.health, 100, 'an ally');
  reportPlayerKill(realFoe(ORC)); assert.equal(me.health, 110, 'a foe: 5% of 200');
}));

test('AUDIT MARTIAL L5 M4 / L5 M6: THE RIDERS\' GUARDS AND THE NUMBER TOLD - a follow-up on a body the relay runs is owed to its claim; Vanishing Strike\'s bundle is a power\'s (the merge that keeps the larger); fatigue never past its top; a shaft told once; the swing and the shaft tell the WEIGHED blow (mutants: the owed dropped; the power word dropped; the cap dropped; a shaft told twice; the raw roll told)', () => clean(() => {
  const cz = pathFighter('crusader'); door([], cz);
  const relay = realFoe(SKELETON);
  land('hallowedShot', { name: 'r', entity: relay, ai: { feet: [0, 0, 1] } }, 20);
  assert.equal(takeOwed(relay), 10, 'owed, half again');
  reset();
  const as = pathFighter('assassin'); const d = door([], as);
  land('vanishingShot', rec('a', realFoe(ORC)), 10);
  assert.deepEqual(d.opts, [{ power: true }], 'a power\'s bundle');
  reset();
  const wr = pathFighter('windrunner'); door([], wr);
  wr.fatigue = maxFatigue(wr) - 1;
  land('windVolley', rec('x', realFoe(ORC)), 3);
  assert.equal(wr.fatigue, maxFatigue(wr), 'at its top');
  reset();
  const cr = pathFighter('crusader');
  const bones = rec('s', realFoe(SKELETON, { health: 1000, maxHealth: 1000 }));
  const d2 = door([bones], cr);
  const shot = { weapon: weapon(WEAPONS.Long_Bow), technique: { id: 'hallowedShot', mult: 2, pierce: 1, use: {} }, pos: [0, 0, 0] };
  const dmg = playerArrowHitFoe(shot, bones, { playerEntity: cr, rolls: () => 0.3 });
  assert.ok(dmg > 0);
  assert.deepEqual(d2.hurts, [['s', Math.round(dmg / 2)]], 'told once, with the weighed number');
  reset();
  const bm = pathFighter('blademaster');
  const o = rec('o', realFoe(ORC, { health: 1000, maxHealth: 1000 }));
  const d3 = door([o], bm);
  const pw = new PlayerWeapon({ weapon: weapon(WEAPONS.Longsword), liveSpeed: 50 });
  pw.techniqueBlow = { id: 'thousandCuts', mult: 2, reach: 3, arc: 'all', feet: [0, 0, 0], yaw: 0, use: {} };
  const [hit] = pw.resolveHit([o], bm, () => ({ dist: 1, inView: true, losClear: true }), () => 0.3);
  assert.ok(hit.damage > 0);
  assert.deepEqual(d3.hurts, [['o', Math.round(hit.damage / 2)]], 'the swing tells the weighed blow');
}));

test('AUDIT MARTIAL L5 M6: THE STATS PAGE\'S FISTS read the blow modifiers as the cores do, and the beast\'s claws none (mutants: the estimate\'s modifiers unread; the claws read)', () => clean(() => {
  const p = fighter([HH], 100);
  const base = computeCombatStats(p, { weapon: null, core: 'classic' });
  registerWeaponBlowMod('audit-sheet-probe', (w, d) => (w === null ? d + 7 : d));
  try {
    const probed = computeCombatStats(p, { weapon: null, core: 'classic' });
    assert.ok(JSON.stringify(probed) !== JSON.stringify(base), 'the estimate reads them');
    const beast = fighter([HH], 100); beast.isInBeastForm = true;
    const b0 = JSON.stringify(computeCombatStats(beast, { weapon: null, core: 'classic' }));
    registerWeaponBlowMod('audit-sheet-probe', null);
    assert.equal(JSON.stringify(computeCombatStats(beast, { weapon: null, core: 'classic' })), b0, 'the claws: none');
  } finally { registerWeaponBlowMod('audit-sheet-probe', null); }
}));

test('AUDIT MARTIAL L5 L1: THE RUNNER\'S OWN WORDS AND FEEL FOR A SIGNATURE - its "ready again" line is said when its slot clears (the classic HUD has no chip), and its press wears its form\'s roster feel (mutants: the line for roster ids alone; the feel looked up by the form\'s id)', () => clean(() => {
  const cr = pathFighter('crusader'); cr.fatigue = maxFatigue(cr);
  const mace = weapon(WEAPONS.Mace); held(cr, mace);
  resetTechniqueFx();
  const r = rigFor(cr, mace);
  stepTechnique(1 / 60, r.ctx(true));
  assert.equal(techniqueFxLive(), true, 'the crush\'s feel');
  for (let i = 0; i < 60 * 13 && techniqueWait('hallowedStrike') > 0; i++) stepTechnique(1 / 60, r.ctx(false));
  assert.ok(r.said.includes('Hallowed Strike is ready again.'), r.said.join(' | '));
  resetTechniqueFx();
}));

test('AUDIT MARTIAL L5 L4: the box counts the OTHER open paths only - none with one open, two with three (mutants: the open path counted among the others)', () => clean(() => {
  const rows1 = MP.martialChoiceRows(fighter([LB, AR], 100), 'ranger');
  assert.equal(rows1.some((r) => /other martial/.test(r)), false);
  const rows3 = MP.martialChoiceRows(fighter([LB, AR, SB], 100), 'ranger');
  assert.equal(rows3.at(-1), '2 other martial specializations are open to you.');   // PIN MOVED (VOICE2): specialization (Voice.md rule 8)
}));

test('AUDIT MARTIAL L5 H2: THE ONE ASK (scenes/shared.js raisePlayerSkills), DRIVEN - one path open is asked in the martial words and Yes chooses it; several are named in an OK box choosing none; asked once; with the arcane ask due on the same pass, the arcane box first and the martial on the next (mutants: the ask forgets it asked; one open given the OK box; Yes chooses the arcane)', () => clean(() => {
  const asks = [];
  const ask = (rows, onYes, onNo, o = {}) => { asks.push({ rows, onYes, onNo, okOnly: !!o.okOnly }); };
  const one = fighter([LB, AR], 100); one.masterSkillsInfoSeen = true;
  raisePlayerSkills(one, { ask, rolls: () => 0.99 });
  assert.equal(asks.length, 1);
  assert.deepEqual([asks[0].rows[0], asks[0].okOnly, one.martialPrompted], ['Martial specialization: Ranger?', false, true]);
  asks[0].onYes();
  assert.equal(one.martialPath, 'ranger', 'Yes chooses it');
  raisePlayerSkills(one, { ask, rolls: () => 0.99 });
  assert.equal(asks.length, 1, 'asked once');
  const declined = fighter([LB, AR], 100); declined.masterSkillsInfoSeen = true;
  raisePlayerSkills(declined, { ask, rolls: () => 0.99 });
  asks.at(-1).onNo();
  assert.equal(declined.martialPath ?? null, null);
  raisePlayerSkills(declined, { ask, rolls: () => 0.99 });
  assert.equal(asks.length, 2, 'No, and never asked again - the skill screen keeps it');
  asks.length = 1;
  const three = fighter([LB, AR, SB], 100); three.masterSkillsInfoSeen = true;
  raisePlayerSkills(three, { ask, rolls: () => 0.99 });
  assert.deepEqual([asks[1].okOnly, asks[1].onYes, three.martialPath ?? null], [true, null, null], 'named, none chosen');
  assert.match(asks[1].rows.join(' '), /Blademaster, Ranger, Assassin/);
  const spellsword = buildCustomCareer({ name: 'Spellsword', hp: 10, stats: STATS,
    skills: [SKILLS.Destruction, SKILLS.Restoration, SKILLS.Alteration, LB, SB, SKILLS.Mysticism, HH, SKILLS.Dodging, SKILLS.Running, SKILLS.Jumping, SKILLS.Climbing, SKILLS.Swimming] });
  const both = fighter([SKILLS.Destruction, SKILLS.Restoration, LB, SB], 100, spellsword); both.masterSkillsInfoSeen = true;
  const before = asks.length;
  raisePlayerSkills(both, { ask, rolls: () => 0.99 });
  assert.equal(asks.length, before + 1);
  assert.match(asks.at(-1).rows[0], /^Specialize as /, 'the arcane box first');
  raisePlayerSkills(both, { ask, rolls: () => 0.99 });
  assert.equal(asks.at(-1).rows[0], 'Martial specialization: Blademaster?', 'the martial on the next pass');
}));

test('AUDIT MARTIAL L5 H2: THE CLASSIC SHEET\'S W ROW, DRIVEN - drawn under the S row with both open; W asks about the first, No, then W, the next (the plate behind the box); a click on the row asks too; Yes chooses the MARTIAL path; a chosen path\'s W shows what it is, ending in the key\'s words (mutants: W never the next; Yes chooses the arcane; the click asks the arcane; the row over the S row; the about box gone)', () => clean(() => {
  const spellsword = buildCustomCareer({ name: 'Spellsword', hp: 10, stats: STATS,
    skills: [SKILLS.Destruction, SKILLS.Restoration, SKILLS.Alteration, LB, SB, SKILLS.Mysticism, AR, HH, SKILLS.Dodging, SKILLS.Running, SKILLS.Jumping, SKILLS.Climbing] });
  const e = fighter([SKILLS.Destruction, SKILLS.Restoration, LB, SB, AR], 100, spellsword);   // two primary, two major, one minor
  const sheet = new CharSheet(e, {});
  sheet.page = 1;
  const font = { tex: 'font', glyph: () => null, fnt: { fixedHeight: 6, fixedWidth: 4, glyphWidth: () => 4 } };
  const renderer = { uploadTexture: () => 'tex', releaseTexture() {}, drawScreenQuad() {}, drawScreenQuadRun() {} };
  sheet._drawSkillPage(renderer, font, { s: 1, ox: 0, oy: 0 });
  assert.ok(sheet._pathRow && sheet._martialRow, 'both rows drawn');
  assert.equal(sheet._martialRow[1], sheet._pathRow[1] + 9, 'the W row under the S row');
  const titles = [];
  for (let i = 0; i < 3; i++) {
    sheet.input('KeyW');
    titles.push(sheet.child?.rows[0]);
    assert.equal(sheet.page, 1, 'the plate behind the box');
    sheet.input('KeyN');
  }
  assert.deepEqual(titles, ['Martial specialization: Blademaster?', 'Martial specialization: Ranger?', 'Martial specialization: Assassin?']);
  const [x, y, w, h] = sheet._martialRow;
  assert.equal(sheet.click(x + w / 2, y + h / 2), true, 'a click on the row');
  assert.equal(sheet.child?.rows[0], 'Martial specialization: Blademaster?', 'asks the martial, round the pool');
  sheet.input('KeyY');
  assert.deepEqual([e.martialPath, e.arcanePath ?? null], ['blademaster', null], 'Yes chooses the martial path');
  sheet.page = 1;
  sheet._drawSkillPage(renderer, font, { s: 1, ox: 0, oy: 0 });
  sheet.input('KeyW');
  assert.deepEqual([sheet.child.okOnly, sheet.child.rows[0], sheet.child.rows.at(-1)], [true, 'Blademaster - Long Blade and Short Blade', 'Use your Weapon Technique key while holding one of its weapons. A weapon with its own technique uses that instead.']);
}));

// PIN MOVED (GROWTH2, bible/10-UI/Growth.md section 5): the enhanced model is the Growth tab's guide (ui/growth/specGuide.js)
test('AUDIT MARTIAL L5 H2: THE ENHANCED MODEL - each open path with its pair; the box\'s rows the martial ask\'s; a chosen one its powers (mutants: the arcane rows asked; the chosen state lost; the choice the arcane\'s)', () => clean(async () => {
  const { specGuideModel } = await import('../../src/ui/growth/specGuide.js');
  const fam = (e) => specGuideModel(e).families.find((f) => f.id === 'martial');
  const m = fam(fighter([LB, AR, SB], 100));
  assert.deepEqual(m.paths.filter((p) => p.state === 'open').map((p) => [p.id, p.pairText]), [['blademaster', 'Long Blade and Short Blade'], ['ranger', 'Long Blade and Archery'], ['assassin', 'Short Blade and Archery']]);
  assert.equal(m.paths.find((p) => p.id === 'ranger').ask()[0], 'Martial specialization: Ranger?');
  const e = fighter([LB, AR], 100);
  assert.equal(fam(e).paths.find((p) => p.id === 'ranger').choose().ok, true);
  assert.equal(e.martialPath, 'ranger');
  const after = fam(e);
  assert.deepEqual([after.held.id, after.paths[0].id, after.paths[0].state], ['ranger', 'ranger', 'chosen']);
  assert.deepEqual([after.paths[0].passive, after.paths[0].signature.name], [MP.MARTIAL_BY_ID.ranger.passive, MP.MARTIAL_BY_ID.ranger.technique.name]);
}));

// LAST in the file: the pause window's document globals stand for the rest of it (audit_schools.test.js's own law)
// PIN MOVED (GROWTH1/GROWTH2): the Stats page's Growth door counts the path waiting; the guide names it, asks and chooses
test('AUDIT MARTIAL L5 H2: THE ENHANCED PAUSE WINDOW, DRIVEN - the Stats page\'s Growth door counts the waiting martial specialisation, the Growth tab\'s guide names the path and its pair, Choose asks in the skin\'s Yes/No card in the martial words, and Yes chooses it (mutants: the door\'s count; Choose the arcane; the ask the arcane\'s rows)', () => clean(async () => {
  await import('../chargenDom.mjs');
  const { mountEnhancedMenu } = await import('../../src/ui/enhanced/enhancedMenu.js');
  const kept = { ...playerEntity };
  const restore = () => { for (const k of Object.keys(playerEntity)) if (!(k in kept)) delete playerEntity[k]; Object.assign(playerEntity, kept); };
  try {
    Object.assign(playerEntity, fighter([LB, AR], 100));
    const host = globalThis.document.createElement('div');
    const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: {}, onAction: () => {}, at: 'stats' });
    try {
      const btn = (text) => host.querySelectorAll('button').find((b) => b.textContent.startsWith(text));
      const door = btn('Growth');
      assert.equal(door?.textContent, 'Growth (1)');
      assert.equal(btn('Master Skills')?.textContent, 'Master Skills', 'a path waiting is the Growth door\'s count now');
      door.onclick();
      host.querySelectorAll('button').find((b) => String(b.className).includes('px-qrow') && b.textContent.includes('Specializations')).onclick();
      const bar = host.querySelectorAll('button').find((b) => String(b.className).includes('gr-pathbar') && b.textContent.startsWith('Ranger'));
      assert.ok(bar, 'the guide\'s Ranger');
      assert.match(bar.textContent, /Long Blade and Archery/);
      bar.onclick();
      btn('Choose Ranger').onclick();
      const ask = globalThis.document.body.querySelectorAll('div').find((d) => String(d.className).includes('px-master-ask'));
      assert.match(ask.textContent, /Martial specialization: Ranger\?/);
      ask.querySelectorAll('button').find((b) => b.textContent === 'Yes').onclick();
      assert.equal(playerEntity.martialPath, 'ranger');
    } finally { menu.unmount(); }
  } finally { restore(); }
}));
