// AUDIT SUGGESTIONS-1019 (2026-10-19, Mac: "Audit everything" / "Audit everything built"; bible/01-Overview/audits/
// Audit-Suggestions-1019.md): the laws the six cold lanes found wanting in the #suggestions batch, each pinned here by its
// finding's id - the loot's (L1), the health floor's (L2), the skill ticker's (L3) and the class skill swap's (L5).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  _resetUnleveledLoot, setUnleveledLootWorld, _worldReader, unlevelDroppedLoot, addDaedric, addOrcish, installUnleveledLoot, uninstallUnleveledLoot,
  UNLEVELED_MATERIAL_NAMES,
} from '../../src/systems/unleveledLoot.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { makeEnemyEntity } from '../../src/characters/enemy/enemyEntity.js';
import { goldStack } from '../../src/systems/inventory.js';
import { mintBountyItem } from '../../src/systems/bounty/bountyReward.js';
import { defineLiveMaxHealth, createCharacter } from '../../src/systems/chargen.js';
import { setRenownLayer } from '../../src/systems/renownLayer.js';
import { applyLevelUp, skillAdvanceProgress, skillsReadyToImprove, countReadyToImprove, skillCheckWait, raiseSkills, skillUsesForAdvancement, SKILL_ADVANCEMENT_MULTIPLIER, SKILL_RAISE_CHECK_INTERVAL } from '../../src/systems/advancement.js';
import { mentorProfile } from '../../src/systems/mentorMode.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { SKILLS } from '../../src/systems/skills.js';
import { masterSkill } from '../../src/systems/masterSkills.js';
import { CLASSIC_GAME_START_TIME as T0 } from '../../src/systems/gameDate.js';
import { skillTickText } from '../../src/ui/enhanced/enhancedMenu.js';
import { martialPossible } from '../../src/systems/martialPaths.js';
import { swapSkill, swapOpens, swappedCareer, skillSwapRefusal, SKILL_SWAP_GOLD } from '../../src/systems/skillSwap.js';
import { createBankAccounts, EMPIRE_ACCOUNT_REGION } from '../../src/systems/banking.js';
import { writePlayer, isCustomCareer } from '../../src/systems/legacy/family.js';
import { specGuideModel } from '../../src/ui/growth/specGuide.js';

const seq = (...vs) => { let i = 0; return () => vs[i++ % vs.length]; };
const fixed = (v) => () => v;
/** An LCG stream, the same every run. */
const lcg = (seed) => () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
const career = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, attackModifierFlags: 0 });
const saved = _worldReader();
const world = (level, luck) => setUnleveledLootWorld({
  playerEntity: () => ({ level, stats: { luck }, gender: 'male', raceId: 1 }),
  insideOpenShop: () => false, buildingQuality: () => 0, insideDungeon: () => true, regionIndex: () => 17, locationDungeonType: () => 7,
});
const enabled = (k) => (k === 'Enabled' ? true : k === 'Orcish' ? 8 : k === 'Daedric' ? 9 : UNLEVELED_MATERIAL_NAMES.indexOf(k));
function online(fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try { return fn(); } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; }
}

// ── L1: the loot ─────────────────────────────────────────────────────

test('AUDIT L1-1: a room\'s body raised on two clients is the same body - the armour drop\'s own material roll reads the raiser\'s Luck, not the local player\'s, so the condition and the gold after it agree (mutants: the raiser\'s Luck not held through the raise)', () => {
  installUnleveledLoot({ read: enabled });
  let disagree = 0, armour = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const body = (localLevel, localLuck) => {
      _resetUnleveledLoot(); world(localLevel, localLuck);
      const lord = makeEnemyEntity(31, ENEMY_BASICS[31], career(), 5, fixed(0.5)); lord.items = [goldStack(400)];
      unlevelDroppedLoot(lord, { rolls: lcg(seed), luck: 50, level: 5, r: enabled });
      return JSON.stringify(lord.items.map((it) => [it.group, it.material, it.currentCondition, it.stackCount]));
    };
    const a = body(5, 50), b = body(30, 100);
    if (a.includes('"Armor"')) armour++;
    if (a !== b) disagree++;
  }
  uninstallUnleveledLoot(); setUnleveledLootWorld(saved); _resetUnleveledLoot();
  assert.ok(armour > 20, 'the sweep reaches the armour drop');
  assert.equal(disagree, 0);
});

test('AUDIT L1-2: an armour drop\'s condition never stands over its own maximum - the ramp\'s middle metal can be lighter plate than the random piece the condition is read off (mutant: the cap dropped)', () => {
  installUnleveledLoot({ read: enabled });
  _resetUnleveledLoot(); world(1, 50);
  let over = 0, n = 0;
  for (let seed = 1; seed <= 12000; seed++) {
    const loot = [];
    const it = addDaedric(loot, 31, lcg(seed), 1);
    if (it?.group !== 'Armor') continue;
    n++;
    if (it.currentCondition > it.maxCondition) over++;
  }
  uninstallUnleveledLoot(); setUnleveledLootWorld(saved); _resetUnleveledLoot();
  assert.ok(n > 1000); assert.equal(over, 0);
});

test('AUDIT L1-3: a bounty\'s piece carries SELL-AS-FOUND\'s mark, the condition it was handed over at (mutant: the mark dropped)', () => {
  const it = mintBountyItem(2, { rolls: lcg(7), rarityOn: false });
  assert.ok(it.currentCondition < it.maxCondition, 'handed over worn');
  assert.equal(it.foundCondition, it.currentCondition);
});

test('AUDIT L1-4 and L6-8: the ramp\'s middle metal goes through the Mods pane\'s switches; an Orc\'s withheld armour is plate of the level\'s metal (mutants: the switch ignored; the Orcish plate left Orcish)', () => {
  _resetUnleveledLoot(); world(5, 50);
  const plate = []; addOrcish(plate, 24, seq(0.999, 0.999, 0, 0.5, 0.2, 0.999, 0.999), 5);   // a Warlord over 80, the ramp withholds, the armour arm
  assert.equal(plate[0]?.group, 'Armor'); assert.equal(plate[0].material, 0x0200 + 4, 'Dwarven plate at level 5');
  setUnleveledLootWorld(saved); _resetUnleveledLoot();
});

test('AUDIT L1-4: a switched middle metal - Dwarven set to drop as Iron on the Mods pane - drops as Iron (mutant: the switch ignored)', async () => {
  const MS = await import('../../src/systems/modSettings.js');
  MS._resetModSettings();
  MS.setModSetting('unleveledLoot', 'Dwarven', 0);
  _resetUnleveledLoot(); world(5, 50);
  const sword = []; addOrcish(sword, 24, seq(0.999, 0.999, 0.999, 0.5, 0.5), 5);
  setUnleveledLootWorld(saved); _resetUnleveledLoot(); MS._resetModSettings();
  assert.equal(sword[0].material, 0, 'Iron');
});

// ── L2: the health floor ─────────────────────────────────────────────

const hero = ({ level = 9, raw = 150, end = 50, h = 30 } = {}) => defineLiveMaxHealth({
  isPlayer: true, level, career: { hitPointsPerLevel: h }, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: end, personality: 50, speed: 50, luck: 50 },
  maxHealth: raw, health: raw, readyToLevelUp: true,
});

test('AUDIT L2-1: an online level-up leaves current health where it stood - a high roll costs none, a low one heals none (mutants: the refresh keeping the fraction)', () => {
  online(() => {
    for (const roll of [0, 0.5, 0.999]) {
      const e = hero(); setRenownLayer(e, 1);
      const before = e.health;
      applyLevelUp(e, () => {}, fixed(roll));
      assert.equal(e.health, before, `roll ${roll}`);
      setRenownLayer(e, null);
    }
  });
});

test('AUDIT L2-2: the Endurance a level-up spends, and the Oghma Infinium\'s, reach the floor at once (mutants: the refresh before the points; the book\'s arm unrefreshed)', () => {
  online(() => {
    const e = hero(); setRenownLayer(e, 1);
    applyLevelUp(e, (stats) => { stats.endurance = 60; }, fixed(0));
    assert.equal(e.maxHealth, Math.floor(55 + 9 * 23.5), 'END 60 on all nine levels, now');
    setRenownLayer(e, null);
    const o = hero({ level: 10 }); o.oghmaLevelUp = true; setRenownLayer(o, 1);
    applyLevelUp(o, (stats) => { stats.endurance = 80; }, fixed(0));
    assert.equal(o.maxHealth, Math.floor(55 + 9 * 25.5), 'the book\'s thirty, END 80');
    setRenownLayer(o, null);
  });
});

test('AUDIT L2-3: mentor mode sizes the body the blows land on - an unlucky roller under the floor and an average one at it, the same online maximum, mentor alike (mutant: the floor\'s share unread)', () => {
  const a = hero({ level: 30, raw: 400 }), b = hero({ level: 30, raw: 0 });
  setRenownLayer(a, 1);
  b.maxHealth = a.maxHealth; setRenownLayer(b, 1);
  assert.equal(a.maxHealth, b.maxHealth);
  assert.deepEqual([mentorProfile(a, [10]).mentoredMaxHealth, mentorProfile(a, [10]).damageTakenMult], [mentorProfile(b, [10]).mentoredMaxHealth, mentorProfile(b, [10]).damageTakenMult]);
  setRenownLayer(a, null); setRenownLayer(b, null);
});

// ── L3: the skill ticker ─────────────────────────────────────────────

const skillCareer = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.5,
  strength: 60, intelligence: 40, willpower: 45, agility: 55, endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};
const fresh = () => { const p = { isPlayer: true, reflexes: 2, items: [] }; createCharacter(p, skillCareer, 16, { rolls: seq(0) }); p.level = 7; return p; };
const fill = (p, i) => { p.skillUses[i] = skillUsesForAdvancement(p.skills[i], SKILL_ADVANCEMENT_MULTIPLIER[i], 1.5, 7); };

test('AUDIT L3-1: ready while the gate is shut says when a rest raises it, and the strip counts nothing until it opens - the gate is strictly more than 360 minutes past the last check (mutants: the gate unread; the gate a minute early)', () => {
  const p = fresh();
  fill(p, SKILLS.Axe);
  const last = p.lastSkillCheckTime;
  assert.equal(skillCheckWait(p, last + 60), SKILL_RAISE_CHECK_INTERVAL + 1 - 60);
  assert.equal(skillCheckWait(p, last + SKILL_RAISE_CHECK_INTERVAL), 1, 'exactly 6 hours is not past the gate');
  assert.equal(skillCheckWait(p, last + SKILL_RAISE_CHECK_INTERVAL + 1), 0);
  assert.equal(countReadyToImprove(p, { now: last + 60 }), 0, 'gated: no strip line');
  assert.equal(countReadyToImprove(p, { now: last + 361 }), 1);
  assert.equal(skillTickText(skillAdvanceProgress(p, SKILLS.Axe, { now: last + 60 })), 'Ready - a rest or a trip raises it once 6 more hours have passed');
  assert.equal(skillTickText(skillAdvanceProgress(p, SKILLS.Axe, { now: last + 361 })), 'Ready - rest or travel to raise it');
  assert.deepEqual(raiseSkills(p, last + SKILL_RAISE_CHECK_INTERVAL, seq(0), () => {}), [], 'the pass agrees: shut at 360');
});

test('AUDIT L3-2: a primary the pass takes from 99 to 100 locks a later 95-and-up skill in the same pass - the reading says so, as the pass does (mutant: the lock read before the pass alone)', () => {
  const p = fresh();
  assert.ok(SKILLS.LongBlade < SKILLS.BluntWeapon, 'the pass reaches Long Blade first');
  p.skills[SKILLS.LongBlade] = 99; fill(p, SKILLS.LongBlade);
  p.skills[SKILLS.BluntWeapon] = 96; fill(p, SKILLS.BluntWeapon);
  assert.equal(skillAdvanceProgress(p, SKILLS.BluntWeapon).held, 'lock', 'Long Blade reaches 100 first in the same pass');
  const ready = skillsReadyToImprove(p);
  const raised = raiseSkills(p, p.lastSkillCheckTime + 361, seq(0), () => {});
  assert.deepEqual(ready, [SKILLS.LongBlade]);
  assert.deepEqual(raised, ready);
});

test('AUDIT L3-2: a seeded sweep with primaries at 99 among the rest agrees with the pass skill for skill (mutant: the in-pass lock forgotten)', () => {
  const rnd = lcg(31019);
  const values = [40, 94, 95, 97, 99, 100];
  for (let trial = 0; trial < 200; trial++) {
    const p = fresh();
    for (let i = 0; i < p.skillUses.length; i++) {
      p.skills[i] = values[Math.floor(rnd() * values.length)];
      const need = skillUsesForAdvancement(p.skills[i], SKILL_ADVANCEMENT_MULTIPLIER[i], 1.5, 7);
      p.skillUses[i] = Math.floor(rnd() * 2 * need);
    }
    assert.deepEqual(skillsReadyToImprove(p), raiseSkills(p, p.lastSkillCheckTime + 361, seq(0), () => {}), `trial ${trial}`);
  }
});

test('AUDIT L3-3: an unmastered 100 a mastery is open to says to master it; a locked skill is not said to be "at 95" (mutant: the open mastery read as the cap)', () => {
  const p = fresh();
  p._online = true;
  p.skills[SKILLS.Axe] = 100;
  assert.equal(skillAdvanceProgress(p, SKILLS.Axe).held, 'master');
  assert.equal(skillTickText(skillAdvanceProgress(p, SKILLS.Axe)), 'At 100 - master it to climb further');
  p.skills[SKILLS.LongBlade] = 100; masterSkill(p, SKILLS.LongBlade); masterSkill(p, SKILLS.Axe);
  p.skills[SKILLS.CriticalStrike] = 100;
  assert.equal(skillAdvanceProgress(p, SKILLS.CriticalStrike).held, 'cap', 'both primary slots spent: no mastery to be had');
});

// ── L5: the class skill swap ─────────────────────────────────────────

const { BluntWeapon: BL, LongBlade: LB, Etiquette: ET, Streetwise: ST, Mercantile: ME, Dodging: DO, Lockpicking: LP, Climbing: CL, Medical: MD, Running: RU, Jumping: JU, Swimming: SW, Stealth: SE } = SKILLS;
function frank({ gold = SKILL_SWAP_GOLD, primary = [ET, ST, ME], major = [BL, DO, LP], minor = [CL, MD, RU, JU, SW, SE], mastered = [BL] } = {}) {
  const p = structuredClone(playerEntity);
  createCharacter(p, { name: 'Monk', hp: 12, primarySkills: primary, majorSkills: major, minorSkills: minor,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } }, -1, { rolls: () => 0.5 });
  p.career = { ...p.career, primarySkills: primary, majorSkills: major, minorSkills: minor };
  p._online = true; p.level = 30;
  p.skills = p.skills.map(() => 40);
  for (const s of mastered) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true); }
  p.goldPieces = gold; p.items = [];
  return p;
}

test('AUDIT L5-1: the hint is shown where one swap opens a path and not where none can - a class with no weapon skill and every slot spent is told nothing (mutant: the hint on the old test)', () => {
  const p = frank();
  assert.equal(specGuideModel(p).families.find((f) => f.id === 'martial').swapOpens, true, 'Blunt mastered, one swap away');
  assert.equal(swapOpens(p, SE, LB, martialPossible), true);
  // no weapon skill in the class, and every one of the 2/2/1 slots spent on others
  const spent = frank({ primary: [ET, ST, ME], major: [CL, DO, LP], minor: [MD, RU, JU, SW, SE], mastered: [ET, ST, DO, LP, MD] });
  const m = specGuideModel(spent).families.find((f) => f.id === 'martial');
  assert.equal(m.possible, false); assert.equal(m.swapOpens, false, 'no slot left to master a weapon in');
});

test('AUDIT L5-1 and L5-2: the swap says what it costs beyond the gold - a group whose slots are spent, and a swap that moves the 95 lock offline (mutants: the slots unread; the lock turn unread)', () => {
  const p = frank({ mastered: [BL, DO] });   // both major slots spent
  const sw = specGuideModel(p).swap;
  assert.equal(sw.slotsLeft(LP), 0);
  assert.equal(sw.slotsLeft(SE), 1);
  const off = frank({ mastered: [] });
  off._online = false; off.masterSkills = false;
  off.skills[LB] = 100;
  assert.equal(specGuideModel(off).swap.lockTurn(ET, LB), 'on', 'a 100 brought into the primaries starts the lock');
  off.skills[ET] = 100; off.skills[LB] = 40;
  assert.equal(specGuideModel(off).swap.lockTurn(ET, LB), 'off', 'the primary at 100 taken out ends it');
  off._online = true;
  assert.equal(specGuideModel(off).swap.lockTurn(ET, LB), null, 'Master Skills in force: no lock to move');
});

test('AUDIT L5-4: a swapped stock class is the character\'s own - the family keeps it whole for an heir, as a custom one, and its household still wears the class (mutants: the mark dropped; the family\'s record keyed on the name alone)', () => {
  const p = frank(); p.careerIndex = 0; p.career.name = 'Mage';
  swapSkill(p, SE, LB);
  assert.equal(p.career.swapped, true);
  assert.deepEqual(swappedCareer(frank(), SE, LB).minorSkills, p.career.minorSkills);
  const person = writePlayer({ id: 1 }, p);
  assert.ok(person.career, 'kept whole');
  assert.ok(person.career.minorSkills.includes(LB));
  assert.equal(isCustomCareer(person), true);
});

test('AUDIT L6-2: online the swap is paid off the Empire\'s account past the coins; offline the refusal names the coins and letters; a major skill\'s swap says so (mutants: the account unread; the offline words; the group word fixed)', () => {
  const p = frank({ gold: 5000 });
  p.bankAccounts = createBankAccounts();
  p.bankAccounts[EMPIRE_ACCOUNT_REGION].accountGold = 200000;
  assert.equal(skillSwapRefusal(p, LP, LB), null);
  assert.deepEqual(swapSkill(p, LP, LB), { ok: true, text: 'Long Blade is now one of your major skills, in place of Lockpicking.' });
  assert.deepEqual([p.goldPieces, p.bankAccounts[EMPIRE_ACCOUNT_REGION].accountGold], [0, 105000]);
  const away = frank({ gold: 10 }); away._online = false;
  assert.equal(skillSwapRefusal(away, SE, LB), 'Changing a class skill costs 100,000 gold, paid in coins or letters of credit. You have 10.');
});

test('AUDIT L6-3 and L2-2, by source (the hosts and the canvas sheet do not run in Node): the HUD strip counts the skills itself, on the gate\'s clock and only when it shows; the sheet\'s rollout refreshes the floor when it writes its points home (mutants: the strip\'s count fixed at nothing; the rollout\'s refresh dropped)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  const notice = src('src/ui/levelUp/levelNotice.js');
  // SKILL-READY (2026-10-20): the strip no longer counts them - the HUD's tile beside the Renown bar does (ui/hud/hudAdvance.js)
  assert.match(notice, /const rows = hidden \? \[\] : levelNotices\.frame\(now, \{ owed, improvable: improvable \?\? 0 \}\);/);
  assert.match(src('src/ui/hud/hudAdvance.js'), /skillsImprovable\(/, 'the tile counts the skills');
  assert.match(notice, /export const skillsImprovable = \(e = playerEntity\) => countReadyToImprove\(e, \{ now: ownMinutes\(\) \}\);/);
  assert.match(src('src/ui/hud/hud.js'), /drawLevelNotices\(\{ hidden: [^}]*\}\);/, 'the HUD hands no count of its own');
  assert.match(src('src/ui/charsheet.js'), /Object\.assign\(this\.entity\.stats, this\.working\);[^\n]*\n\s+refreshOnlineLayer\(this\.entity, \{ keepHealth: true \}\);/);
});

test('AUDIT L6-4: the tutorial sends the classic skin to no Stats page line - it draws none; the enhanced skin is pointed at it (mutant: the skin unread)', async () => {
  const { TUTORIALS } = await import('../../src/systems/tutorialCatalogue.js');
  const { setUiSkin, isEnhanced } = await import('../../src/systems/uiSkin.js');
  const body = () => TUTORIALS.find((p) => p.id === 'character-sheet').body.join(' ');
  const had = isEnhanced();
  try {
    setUiSkin('enhanced');
    assert.match(body(), /Your Stats page shows how close each skill is\./);
    setUiSkin('classic');
    assert.match(body(), /at most once every 6 hours\./);
    assert.doesNotMatch(body(), /Stats page/);
  } finally { setUiSkin(had ? 'enhanced' : 'classic'); }
});

test('AUDIT L2-4: a small star\'s share of health is of the floored body - two characters of one online maximum, one under the floor and one at it, gain alike (mutant: the share of the stored value alone)', async () => {
  const { setFirmamentTree, setFirmamentOnline, _resetFirmamentLiveForTests } = await import('../../src/systems/firmamentLive.js');
  const { firmamentLayer, _resetFirmamentPowersForTests } = await import('../../src/systems/firmamentPowers.js');
  const { _resetSigilForTests } = await import('../../src/systems/sigil/sigil.js');
  const { pathTo } = await import('../../src/net/firmament/firmamentLaw.js');
  _resetFirmamentLiveForTests(); _resetFirmamentPowersForTests(); _resetSigilForTests();
  const tree = { start: 'wr.start', keys: [] }; tree.keys.push(...pathTo(tree, 'wr.r1'));   // the Warrior's Starway: +1% health
  setFirmamentTree(tree); setFirmamentOnline(true);
  const under = hero({ raw: 150 }), at = hero({ raw: 150 });
  setRenownLayer(under, 1);
  at.maxHealth = under.maxHealth; setRenownLayer(at, 1);
  firmamentLayer(under); firmamentLayer(at);
  assert.equal(under.maxHealth, at.maxHealth);
  assert.ok(under.renownHp > under.evenHp, 'the star gave something');
  setRenownLayer(under, null); setRenownLayer(at, null);
  _resetFirmamentLiveForTests(); _resetFirmamentPowersForTests(); _resetSigilForTests();
});
