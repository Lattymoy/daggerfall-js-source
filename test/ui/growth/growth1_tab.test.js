// GROWTH (2026-10-17, the owner: "properly give the specialization its own UI for ease of player use and proper
// descriptions instead of keeping players guessing" and "instead of having ascend in one place and the firmament trees in
// another (including the new naval tree), I want to give the firmament, level up page, and specializations its own tab
// within the pause menu"; asked: "Growth", the skies "drawn in the tab", the old doors moved, the classic skin let in;
// bible/10-UI/Growth.md). Pinned here:
//   GROWTH1  the tab (PAUSE_TABS after Stats), its rail and its landings, what waits on each page, the moved doors
//   GROWTH2  the Specialisations guide - every path's state on this character, what opens it, what it does, its Choose
//   GROWTH3  the stage - a face kept across the window's redraws, full screen, a phone's door, the tab's Escape; the
//            three windows' `embed` modes (by source - the browser probe tools/growthProbe.mjs drives them for real)
//   GROWTH4  the classic sheet's rows open the guide; the one ask's words name the Growth tab on the enhanced skin
// The pure law first; the pause window driven over the fake document last (its globals stand for the rest of the file).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { playerEntity } from '../../../src/characters/playerEntity.js';
import { createCharacter } from '../../../src/systems/chargen.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { masterSkill } from '../../../src/systems/masterSkills.js';
import * as AP from '../../../src/systems/arcanePaths.js';
import * as MP from '../../../src/systems/martialPaths.js';
import { specGuideModel, skillStand, skillStandText, spellLines, techniqueLines, stateTag, SPEC_STATES, stateLine, pathSteps, familyLine, firstFamily, useLine } from '../../../src/ui/growth/specGuide.js';
import { GROWTH_PAGE_SECTIONS, growthPageAt, SPEC_LANDINGS } from '../../../src/ui/growth/growthPages.js';
import { growthSections, growthDue, resetGrowthTab, growthSection, setGrowthSection } from '../../../src/ui/growth/growthTab.js';
import { drawStage, dropStage, stageBack, stageAsks, stageLive, stageFace } from '../../../src/ui/growth/growthStage.js';
import { _resetForTests, setPref } from '../../../src/systems/uiPrefs.js';
import { LOOT_RARITY_KEY } from '../../../src/systems/loot/lootRarity.js';
import { setSigilDueling } from '../../../src/systems/sigil/sigil.js';
import { audio } from '../../../src/systems/audio.js';
import { levelUpScreenFor } from '../../../src/ui/charSheetDoor.js';
import { destroyLevelNotices } from '../../../src/ui/levelUp/levelNotice.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const { LongBlade: LB, ShortBlade: SB, Archery: AR, Axe: AX, Destruction: DES, Restoration: RES, Alteration: ALT, Mysticism: MYS, Illusion: ILL } = SKILLS;

/** A made character of the given career groups, every skill at 30, then `raised` raised (and `mastered` mastered). */
function hero({ primary, major, minor, raised = {}, mastered = [] }) {
  const p = structuredClone(playerEntity);
  createCharacter(p, { name: 'Tester', hp: 12, primarySkills: primary, majorSkills: major, minorSkills: minor,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } }, -1, { rolls: () => 0.5 });
  p.career = { ...p.career, primarySkills: primary, majorSkills: major, minorSkills: minor };
  p._online = true; p.level = 20;
  p.skills = p.skills.map(() => 30);
  for (const s of mastered) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true, `master ${s}`); }
  for (const [s, v] of Object.entries(raised)) p.skills[s] = v;
  return p;
}
/** A spellsword: Long Blade, Archery and Destruction primary; Restoration, Alteration and Axe major; three minors. */
const spellsword = (o = {}) => hero({ primary: [LB, AR, DES], major: [RES, ALT, AX], minor: [MYS, ILL, SKILLS.Stealth], ...o });
const family = (m, id) => m.families.find((f) => f.id === id);

// ── GROWTH1: the tab and its rail ───────────────────────────────────────────────────────────────────────────────────

test('GROWTH1 THE TAB: Growth stands after Stats in the window\'s one list; a landing names it, a page of it, or a family\'s guide - each a Growth landing, no other tab\'s (mutants: the tab left out; a family landing unread; the leaf drifting from the tab)', () => {
  const menu = rd('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /const PAUSE_TABS = Object\.freeze\(\[\['quests', 'Quests'\], \['stats', 'Stats'\], \['growth', 'Growth'\], \['holdings', 'Holdings'\],/);
  assert.match(menu, /growth: pauseGrowth,/);
  assert.match(menu, /else if \(growthPageAt\(at\)\) pauseTab = 'growth';/);
  assert.match(menu, /resetGrowthTab\(at\);/);
  assert.deepEqual(GROWTH_PAGE_SECTIONS.map(([id]) => id), ['level', 'specs', 'firmament', 'captain']);
  for (const at of ['growth', 'level', 'specs', 'firmament', 'captain', 'specs:arcane', 'specs:martial']) assert.equal(growthPageAt(at), true, at);
  for (const at of ['stats', 'holdings', 'family', 'revenants', null, undefined, 'specs:nope']) assert.equal(growthPageAt(at), false, String(at));
  assert.deepEqual(SPEC_LANDINGS, { 'specs:arcane': 'arcane', 'specs:martial': 'martial' });
  resetGrowthTab('specs:martial'); assert.equal(growthSection(), 'specs');
  resetGrowthTab('captain'); assert.equal(growthSection(), 'captain');
  resetGrowthTab(null); assert.equal(growthSection(), 'level', 'a bare landing: the Level page');
  setGrowthSection('firmament'); assert.equal(growthSection(), 'firmament');
  setGrowthSection('nope'); assert.equal(growthSection(), 'firmament', 'no such page: it stays');
  // the boot door reads the LEAF, never the tab (whose guide reads the spellbook's chunk)
  assert.match(rd('src/ui/pauseDoor.js'), /import \{ growthPageAt \} from '\.\/growth\/growthPages\.js';/);
  assert.doesNotMatch(rd('src/ui/pauseDoor.js'), /growth\/growthTab\.js/);
});

test('GROWTH1 THE RAIL: the Captain\'s Stars where the host hands a captain\'s sky over (else three pages); what waits - a level owed, the paths open, the captain\'s points unspent (mutants: the captain drawn for any host; a due page read off another\'s count)', () => {
  assert.deepEqual(growthSections({}).map(([id]) => id), ['level', 'specs', 'firmament']);
  assert.deepEqual(growthSections({ captain: { stars: () => ({}) } }).map(([id]) => id), ['level', 'specs', 'firmament', 'captain']);
  const e = spellsword({ mastered: [LB, AR] });
  e.readyToLevelUp = true;
  const due = growthDue({ entity: e, captain: { model: () => ({ stars: { points: 6, set: 2 } }) } });
  assert.deepEqual(due, { level: 1, specs: 1, firmament: 0, captain: 4 });
  e.readyToLevelUp = false;
  assert.deepEqual(growthDue({ entity: e }), { level: 0, specs: 1, firmament: 0, captain: 0 });
});

// ── GROWTH2: the guide's law ────────────────────────────────────────────────────────────────────────────────────────

test('GROWTH2 THE GUIDE: every path of both families, each in its state on THIS character - open (both mastered), ready (both at 100, one to master), within reach, closed (the family\'s other path held), never (a skill this class cannot master) - in that order, the nearest first (mutants: a state misread; the order the table\'s; the nearest last)', () => {
  // Long Blade and Archery mastered (primary: 2 of 2), Destruction primary unmastered - its slot gone; Restoration at 100
  const e = spellsword({ mastered: [LB, AR], raised: { [RES]: 100, [ALT]: 76, [AX]: 64 } });
  const m = specGuideModel(e);
  assert.equal(m.masterOn, true);
  const ma = family(m, 'martial');
  assert.equal(ma.paths.length, 15);
  assert.deepEqual(ma.paths.map((p) => p.state), [...ma.paths.map((p) => p.state)].sort((a, b) => SPEC_STATES.indexOf(a) - SPEC_STATES.indexOf(b)), 'in the states\' order');
  assert.equal(ma.paths[0].id, 'ranger'); assert.equal(ma.paths[0].state, 'open');
  assert.equal(ma.open, 1);
  const st = (f, id) => f.paths.find((p) => p.id === id).state;
  assert.equal(st(ma, 'woodsman'), 'reach', 'Axe (major, a slot left) and Archery (mastered)');
  assert.equal(st(ma, 'blademaster'), 'never', 'Short Blade is no skill of this class');
  const ar = family(m, 'arcane');
  assert.equal(st(ar, 'bloodmage'), 'slots', 'Destruction is primary and the primary masteries are spent - by the player, not the class (AUDIT GROWTH LANE1-4)');
  assert.equal(st(ar, 'warden'), 'reach', 'Alteration and Restoration, both major, two major slots');
  // the nearest first: Warden (Restoration at 100, Alteration 76 - 24 owed) before Trickster (Alteration and Illusion - 94)
  const reach = ar.paths.filter((p) => p.state === 'reach').map((p) => p.id);
  assert.ok(reach.indexOf('warden') < reach.indexOf('trickster'), reach.join());
  // ready: both at 100, one still to master
  const r = spellsword({ mastered: [RES], raised: { [ALT]: 100 } });
  assert.equal(st(family(specGuideModel(r), 'arcane'), 'warden'), 'ready');
  // chosen, and the family's others closed; the other family untouched
  const c = spellsword({ mastered: [LB, AR] });
  assert.equal(MP.chooseMartialPath(c, 'ranger').ok, true);
  const cm = specGuideModel(c);
  assert.deepEqual([family(cm, 'martial').held.id, st(family(cm, 'martial'), 'ranger'), st(family(cm, 'martial'), 'woodsman')], ['ranger', 'chosen', 'closed']);
  assert.equal(family(cm, 'martial').paths[0].id, 'ranger', 'the chosen first');
  assert.equal(st(family(cm, 'arcane'), 'warden'), 'reach', 'the arcane family is its own');
  // Master Skills off: nothing opens - the guide says why (the state is reach, never open)
  const off = spellsword({ mastered: [LB, AR] });
  off._online = false; off.masterSkills = false;
  const om = specGuideModel(off);
  assert.equal(om.masterOn, false);
  assert.equal(st(family(om, 'martial'), 'ranger'), 'reach');
  assert.equal(family(om, 'martial').open, 0);
});

test('GROWTH2 WHAT OPENS IT: each skill of a pair in its own words - mastered, ready to master, its climb to 100, its group\'s masteries spent, or no skill of the class (mutants: a state\'s words swapped; the climb\'s count wrong)', () => {
  const e = spellsword({ mastered: [LB, AR], raised: { [RES]: 100, [ALT]: 76 } });
  const s = (id) => skillStand(e, id);
  assert.deepEqual([s(LB).state, s(RES).state, s(ALT).state, s(DES).state, s(SB).state], ['mastered', 'ready', 'climb', 'full', 'misc']);
  assert.equal(skillStandText(s(LB)), 'Long Blade: mastered (100)');
  assert.equal(skillStandText(s(RES)), 'Restoration: 100 - ready to master in Master Skills');
  assert.equal(skillStandText(s(ALT)), 'Alteration: 76 of 100, then master it');
  assert.equal(skillStandText(s(DES)), 'Destruction: no primary mastery slots left');
  assert.equal(skillStandText(s(SB)), 'Short Blade: not one of your class skills, so it can\'t be mastered');
  assert.deepEqual(['open', 'ready', 'reach', 'closed', 'slots', 'never', 'chosen'].map(stateTag), ['Available', 'Needs mastering', 'Not yet', 'Closed', 'No slots left', 'Not for your class', 'Chosen']);
});

test('GROWTH2 WHAT IT DOES: the passive and the signature in the laws\' own words; a signature spell read as the spellbook reads it (its target, its element, each effect - no empty slot), a signature technique by each of its weapons (its cooldown, its fatigue) (mutants: an empty slot read; the forms\' numbers not the law\'s)', () => {
  const e = spellsword({ mastered: [LB, AR] });
  const m = specGuideModel(e);
  const ranger = family(m, 'martial').paths.find((p) => p.id === 'ranger');
  assert.deepEqual(ranger.passive, MP.MARTIAL_BY_ID.ranger.passive);
  assert.equal(ranger.signature.kind, 'technique');
  assert.equal(ranger.signature.name, MP.MARTIAL_BY_ID.ranger.technique.name);
  assert.equal(ranger.signature.text, `${MP.MARTIAL_BY_ID.ranger.technique.text} ${MP.MARTIAL_BY_ID.ranger.rider}`);
  const forms = MP.MARTIAL_BY_ID.ranger.forms;
  assert.deepEqual(techniqueLines(MP.MARTIAL_BY_ID.ranger), [
    `Long blade: ${MP.signatureById(forms.longBlade).cooldown}-second cooldown, ${MP.signatureById(forms.longBlade).fatigue} fatigue.`,
    `Bow: ${MP.signatureById(forms.archery).cooldown}-second cooldown, ${MP.signatureById(forms.archery).fatigue} fatigue.`,
  ].sort((a, b) => techniqueLines(MP.MARTIAL_BY_ID.ranger).indexOf(a) - techniqueLines(MP.MARTIAL_BY_ID.ranger).indexOf(b)));
  const blood = family(m, 'arcane').paths.find((p) => p.id === 'bloodmage');
  assert.deepEqual([blood.signature.kind, blood.signature.name, blood.signature.text], ['spell', AP.PATH_BY_ID.bloodmage.spell.name, AP.PATH_BY_ID.bloodmage.rider]);
  const lines = spellLines('bloodmage');
  assert.equal(lines[0], 'Single target at range - Fire based');
  assert.equal(lines.length, 2, 'one effect: the maker\'s two empty slots read nothing');
  assert.match(lines[1], /^Damage Health\. Magnitude: 10 - 18 \+ 2 - 3 per 1 level\(s\)\.$/);
  assert.equal(spellLines('nope').length, 0);
});

test('GROWTH2 CHOOSE: an open path\'s Choose asks in the law\'s own box and commits through the law - permanent; a path not open has none (mutants: the ask the other family\'s; the choice not the law\'s)', () => {
  const e = spellsword({ mastered: [LB, AR, RES], raised: { [ALT]: 100 } });
  assert.equal(masterSkill(e, ALT).ok, true);
  const m = specGuideModel(e);
  const warden = family(m, 'arcane').paths.find((p) => p.id === 'warden');
  assert.equal(warden.state, 'open');
  assert.deepEqual(warden.ask(), AP.pathChoiceRows(e, 'warden'));
  const ranger = family(m, 'martial').paths.find((p) => p.id === 'ranger');
  assert.deepEqual(ranger.ask(), MP.martialChoiceRows(e, 'ranger'));
  assert.deepEqual(warden.choose(), { ok: true, text: 'Specialization chosen: Warden.' });
  assert.equal(e.arcanePath, 'warden');
  assert.equal(family(specGuideModel(e), 'arcane').paths.find((p) => p.id === 'trickster').choose().ok, false, 'the law refuses a second');
});

// ── AUDIT GROWTH lane 1: the law and the model (bible/01-Overview/audits/Audit-Growth.md) ──────────────────────────

test('AUDIT GROWTH LANE1-1/4 THE SLOTS: a pair the slots left can never hold is no slot of its own - two minor schools, two majors with one major slot left - and it says so, apart from a skill the class can\'t master (mutants: the pair counted skill by skill; the slots read as the class; the shared line dropped)', () => {
  // two minor schools at 100, one minor slot: each alone reads ready, the pair never fits (pathPossible's own count)
  const e = spellsword({ raised: { [ILL]: 100, [MYS]: 100 } });
  const ar = family(specGuideModel(e), 'arcane');
  const seer = ar.paths.find((p) => p.id === 'seer');
  assert.deepEqual(seer.pair.map((s) => s.state), ['ready', 'ready']);
  assert.equal(seer.state, 'slots');
  assert.deepEqual(pathSteps(seer).map(([, text]) => text), ['Illusion: 100 - ready to master in Master Skills', 'Mysticism: 100 - ready to master in Master Skills',
    'Illusion and Mysticism are both minor skills, and you can master only one more minor skill.']);
  assert.equal(stateLine(ar, seer, true), 'You don\'t have enough mastery slots left to master both of these skills.');
  assert.equal(stateTag(seer.state), 'No slots left');
  // two major weapons at 100 with one major slot left (Axe mastered): Blademaster can't open; Warblade (Axe and Long Blade) can
  const w = hero({ primary: [DES, RES, ALT], major: [LB, SB, AX], minor: [MYS, ILL, SKILLS.Stealth], mastered: [AX], raised: { [LB]: 100, [SB]: 100 } });
  const ma = family(specGuideModel(w), 'martial');
  const st = (id) => ma.paths.find((p) => p.id === id).state;
  assert.deepEqual([st('blademaster'), st('warblade'), st('bloodletter')], ['slots', 'ready', 'ready']);
  // a group the player's own masteries filled: the skill's own line, no shared one; the class's own refusal is 'never'
  const s = spellsword({ mastered: [LB, AR] });
  const sa = family(specGuideModel(s), 'arcane');
  const blood = sa.paths.find((p) => p.id === 'bloodmage');
  assert.equal(blood.state, 'slots');
  assert.deepEqual(pathSteps(blood).map(([state]) => state), ['full', 'climb'], 'Destruction\'s own "no primary mastery slots left" says it - no shared line');
  const bm = family(specGuideModel(s), 'martial').paths.find((p) => p.id === 'blademaster');
  assert.equal(bm.state, 'never');
  assert.equal(stateLine(family(specGuideModel(s), 'martial'), bm, true), 'Your class can\'t master both of these skills.');
  // neither is shown until asked: the reachable list leaves both out
  assert.equal(SPEC_STATES.indexOf('slots') > SPEC_STATES.indexOf('closed') && SPEC_STATES.indexOf('slots') < SPEC_STATES.indexOf('never'), true);
  assert.match(rd('src/ui/growth/specGuide.js'), /const reachable = fam\.paths\.filter\(\(p\) => p\.state !== 'never' && p\.state !== 'slots'\);/);
});

test('AUDIT GROWTH LANE1-4 THE HEADLINE: no path for the family says whether the class never could or the player\'s masteries spent the slots (mutants: the spent read as the class\'s)', () => {
  const never = hero({ primary: [LB, AR, DES], major: [AX, SB, SKILLS.BluntWeapon], minor: [SKILLS.Stealth, SKILLS.Running, SKILLS.Swimming] });
  assert.equal(familyLine(family(specGuideModel(never), 'arcane')), 'Your class can\'t master two schools of magic, so no arcane path is available.');
  const spent = hero({ primary: [LB, AR, DES], major: [AX, SB, SKILLS.BluntWeapon], minor: [RES, SKILLS.Stealth, SKILLS.Running], mastered: [LB, AR] });
  const f = family(specGuideModel(spent), 'arcane');
  assert.deepEqual([f.possible, f.classPossible], [false, true]);
  assert.equal(familyLine(f), 'Your mastery slots left can\'t hold two schools of magic, so no arcane path is available.');
  assert.equal(familyLine(family(specGuideModel(spellsword()), 'arcane')), 'Master any two schools of magic to unlock the path for that pair.');
});

test('AUDIT GROWTH LANE1-2 MASTER SKILLS OFF: a pair with nothing left to climb says to turn it on, and a skill past 100 shows the 100 the game reads (mutants: the climb\'s line; the raw value)', () => {
  const off = spellsword({ mastered: [LB, AR] });
  off.skills[LB] = 150;
  off._online = false; off.masterSkills = false;
  const ma = family(specGuideModel(off), 'martial');
  const ranger = ma.paths.find((p) => p.id === 'ranger');
  assert.equal(ranger.state, 'reach');
  assert.equal(stateLine(ma, ranger, false), 'Turn Master Skills on to unlock this path.');
  assert.equal(skillStand(off, LB).value, 100, 'masterCappedSkill: past 100 reads 100 while Master Skills is off');
  assert.equal(skillStandText(skillStand(off, LB)), 'Long Blade: mastered (100)');
  off.masterSkills = true;
  assert.equal(skillStand(off, LB).value, 150);
});

test('AUDIT GROWTH LANE1-3 THE CHOSEN PATH ASLEEP: Master Skills off, mentoring, a duel, the beast (martial only) - its line says its powers are off (mutants: a gate missed; the beast read for the arcane)', () => {
  const c = spellsword({ mastered: [LB, AR, RES, ALT] });
  assert.equal(MP.chooseMartialPath(c, 'ranger').ok, true);
  assert.equal(AP.choosePath(c, 'warden').ok, true);
  const line = (id) => { const f = family(specGuideModel(c), id); return stateLine(f, f.paths.find((p) => p.state === 'chosen'), true); };
  assert.equal(line('martial'), 'Your specialization.');
  c._mentor = { level: 5 };
  assert.equal(line('arcane'), 'Your specialization. Its powers are off while you mentor a lower-level party.');
  c._mentor = null;
  setSigilDueling(true);
  try { assert.equal(line('martial'), 'Your specialization. Its powers are off during a duel.'); } finally { setSigilDueling(false); }
  c.isInBeastForm = true;
  assert.deepEqual([line('martial'), line('arcane')], ['Your specialization. Its powers are off in beast form.', 'Your specialization.']);
  c.isInBeastForm = false;
  c._online = false; c.masterSkills = false;
  assert.equal(line('arcane'), 'Your specialization. Its powers are off while Master Skills is off.');
});

test('AUDIT GROWTH LANE1-12 ONE SKILL LEFT: the state line names the skill that still needs it, and "both" only when both do (mutants: the one read as both)', () => {
  const e = spellsword({ mastered: [AR], raised: { [AX]: 64, [RES]: 100, [ALT]: 76 } });
  const m = specGuideModel(e);
  const line = (fid, id) => { const f = family(m, fid); return stateLine(f, f.paths.find((p) => p.id === id), true); };
  assert.equal(line('martial', 'woodsman'), 'Raise Axe to 100 and master it to unlock this path.');
  assert.equal(line('arcane', 'warden'), 'Raise Alteration to 100, then master both skills to unlock this path.');
  assert.equal(line('arcane', 'trickster'), 'Raise both skills to 100 and master them to unlock this path.');
  const r = spellsword({ mastered: [RES], raised: { [ALT]: 100 } });
  const ra = family(specGuideModel(r), 'arcane');
  assert.equal(stateLine(ra, ra.paths.find((p) => p.id === 'warden'), true), 'Master Alteration on the Master Skills page to unlock this path.');
  const b = spellsword({ raised: { [RES]: 100, [ALT]: 100 } });
  const ba = family(specGuideModel(b), 'arcane');
  assert.equal(stateLine(ba, ba.paths.find((p) => p.id === 'warden'), true), 'Both skills are at 100. Master them on the Master Skills page to unlock this path.');
});

test('AUDIT GROWTH LANE1-9/10 THE FAMILY FIRST AND THE RAIL\'S COUNT: a family with a choice waiting opens before one held; the rail counts a choice per family, not its paths (mutants: the held first; the paths summed)', () => {
  const c = spellsword({ mastered: [LB, AR, RES, ALT] });
  assert.equal(AP.choosePath(c, 'warden').ok, true);
  const m = specGuideModel(c);
  assert.equal(family(m, 'martial').open, 1);
  assert.equal(firstFamily(m), 'martial');
  assert.equal(firstFamily(specGuideModel(spellsword())), 'arcane');
  // three schools mastered open three paths - one choice
  const three = spellsword({ mastered: [DES, RES, ALT] });
  assert.equal(family(specGuideModel(three), 'arcane').open, 3);
  assert.equal(growthDue({ entity: three }).specs, 1);
  const both = spellsword({ mastered: [LB, AR, RES, ALT] });
  assert.equal(growthDue({ entity: both }).specs, 2);
});

test('AUDIT GROWTH LANE1-11 HOW IT IS USED: the spell from any spell shelf; a found technique wins the key only while the loot ladder is on (mutants: the ladder\'s words always)', () => {
  assert.equal(useLine('spell'), 'Once chosen, buy it wherever spells are sold and cast it like any other spell.');
  setPref(LOOT_RARITY_KEY, false);
  assert.equal(useLine('technique'), 'Once chosen, press your Weapon Technique key while fighting with one of its two skills.');
  setPref(LOOT_RARITY_KEY, true);
  try { assert.match(useLine('technique'), / A weapon with a technique of its own uses that instead\.$/); } finally { setPref(LOOT_RARITY_KEY, false); }
});

test('AUDIT GROWTH LANE1-5/6/7 THE RIDERS SAY WHAT THE POWERS DO: the Brawler\'s answers that foe\'s blows only, the Bloodmage\'s a target below the line after the hit, the Berserker\'s arrows too (mutants: the old overclaim; the old underclaim)', () => {
  assert.equal(MP.MARTIAL_BY_ID.brawler.rider, `For ${MP.MARTIAL_NUMBERS.knockout.seconds} seconds, blows from the enemy it hits deal ${MP.MARTIAL_NUMBERS.knockout.lighter}% less damage to you.`);
  assert.match(AP.PATH_BY_ID.bloodmage.rider, /^If the target is below 30% health after the hit, it takes the same damage again\.$/);
  assert.match(MP.MARTIAL_BY_ID.berserker.rider, /every blow or arrow you land heals you/);
});

test('AUDIT GROWTH LANE1-8 ONE LEVEL, ONE FANFARE: the Level page builds the screen on every visit; a level the strip never announced (a save\'s, an Oghma level) sounds once, and the next level sounds again (mutants: the latch dropped; set before it is read)', () => {
  const played = [];
  const was = audio.playOneShot;
  audio.playOneShot = (snd) => { played.push(snd); };
  try {
    destroyLevelNotices();
    const e = structuredClone(playerEntity);
    Object.assign(e, { level: 5, readyToLevelUp: true, pendingLevel: 6, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } });
    for (let visit = 0; visit < 3; visit++) assert.ok(levelUpScreenFor(e));
    assert.equal(played.length, 1, 'a loaded level: once');
    e.pendingLevel = 7;
    levelUpScreenFor(e);
    assert.equal(played.length, 2, 'the next level sounds');
    const o = structuredClone(e);
    Object.assign(o, { oghmaLevelUp: true, pendingLevel: null });
    for (let visit = 0; visit < 3; visit++) levelUpScreenFor(o);
    assert.equal(played.length, 3, 'an Oghma level: once');
  } finally { audio.playOneShot = was; destroyLevelNotices(); }
});

// ── GROWTH3: the stage (pure: a made host) and the windows' embedding (by source) ───────────────────────────────────

/** The smallest host a stage needs: elements that hold children, a body to stand a full screen on. */
function fakeDoc() {
  const mk = (tag) => {
    const n = { tag, className: '', children: [], parentNode: null, textContent: '', onclick: null,
      append(...k) { for (const c of k) { if (typeof c === 'string') continue; c.parentNode?.children && (c.parentNode.children = c.parentNode.children.filter((x) => x !== c)); c.parentNode = n; n.children.push(c); } },
      click() { n.onclick?.(); },
      remove() { if (n.parentNode) n.parentNode.children = n.parentNode.children.filter((x) => x !== n); n.parentNode = null; },
      querySelector(sel) { const cls = sel.split(' ').pop().replace(/^\./, ''); const walk = (x) => { for (const c of x.children) { if (String(c.className).split(' ').includes(cls)) return c; const f = walk(c); if (f) return f; } return null; }; return walk(n); },
      get isConnected() { let x = n; while (x.parentNode) x = x.parentNode; return x === body; },
      get clientWidth() { return 800; },
    };
    return n;
  };
  const body = mk('body');
  return { mk, body, doc: { body, querySelector: (sel) => body.querySelector(sel) } };
}

test('GROWTH3 THE STAGE: a face is mounted ONCE a visit and its host moved into each new draw of its page (its canvas, view and pending stars with it); another page drops it; full screen moves the same host over the window and back; the tab\'s Escape asks the face, then leaves full screen (mutants: a mount per draw; the face left up on another page; Escape past the face\'s own)', async () => {
  const { mk, body, doc } = fakeDoc();
  const was = globalThis.document;
  globalThis.document = doc;
  const keptW = globalThis.innerWidth;
  globalThis.innerWidth = 1280;
  const el = (t, c, x) => { const n = mk(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
  const words = { el, full: 'Full screen', leave: 'Leave full screen', loading: 'Loading...', failed: 'Failed.' };
  try {
    let mounts = 0, backs = 0, destroyed = 0, sized = [];
    const face = { destroy: () => { destroyed++; }, resize: (refit) => sized.push(refit), back: () => backs++ === 0 };
    const mount = () => { mounts++; return face; };
    const d1 = el('div', 'px-qdetail'); body.append(d1);
    drawStage(d1, 'firmament', mount, words);
    await new Promise((r) => setTimeout(r, 0));
    const host = stageFace() === face ? d1.querySelector('.gr-stagehost') : null;
    assert.ok(host, 'mounted into its host, in the stage');
    d1.remove();
    const d2 = el('div', 'px-qdetail'); body.append(d2);
    drawStage(d2, 'firmament', mount, words);
    assert.equal(mounts, 1, 'mounted once a visit');
    assert.equal(d2.querySelector('.gr-stagehost'), host, 'the same host, moved into the new draw');
    assert.ok(sized.includes(true), 'its first true size refits its view');
    // full screen and back - the same host over the window, then in the stage again
    d2.querySelector('.gr-stagebar').children.find((c) => c.tag === 'button').onclick();
    assert.deepEqual(stageLive(), { key: 'firmament', full: true });
    assert.equal(body.querySelector('.gr-fullbox')?.children.includes(host), true);
    // the tab's Escape: the face's own first (its back() took it), then full screen left
    assert.equal(stageBack(), true); assert.equal(backs, 1); assert.equal(stageLive().full, true, 'the face took the press');
    assert.equal(stageBack(), true); assert.equal(stageLive().full, false, 'then full screen left');
    assert.equal(d2.querySelector('.gr-stagehost'), host, 'the same host, back in the stage');
    assert.equal(stageBack(), false, 'nothing of its own: the window goes on (resumes)');
    // another page drops it
    const d3 = el('div', 'px-qdetail'); body.append(d3);
    drawStage(d3, 'captain', () => ({ destroy: () => {} }), words);
    assert.equal(destroyed, 1, 'the Firmament taken down for the captain\'s sky');
    dropStage();
    assert.equal(stageLive(), null);
    // A PHONE'S STAGE IS THE SCREEN: a door, and the face over everything on its press
    globalThis.innerWidth = 360;
    const d4 = el('div', 'px-qdetail'); body.append(d4);
    drawStage(d4, 'level', () => ({ destroy: () => {} }), { ...words, open: 'Open', lead: 'A line.' });
    assert.equal(d4.querySelector('.gr-stage'), null, 'no stage in a phone\'s pane');
    d4.querySelector('.gr-stagecard').children.find((c) => c.tag === 'button').onclick();
    assert.deepEqual(stageLive(), { key: 'level', full: true });
    dropStage();
  } finally { globalThis.document = was; globalThis.innerWidth = keptW; dropStage(); }
});

test('AUDIT GROWTH LANE2/LANE3 THE STAGE\'S EDGES: a face left before its chunk landed is never built; a chunk that fails is tried once more, a stale one says reload; a door on any screen where the pane cannot hold the face; a phone\'s face asking while it stands nowhere is opened to ask (mutants: built after the drop; no retry; the reload words; the door unread; the ask said into a detached face)', async () => {
  const { mk, body, doc } = fakeDoc();
  const was = globalThis.document;
  globalThis.document = doc;
  const keptW = globalThis.innerWidth;
  globalThis.innerWidth = 1280;
  const el = (t, c, x) => { const n = mk(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
  const words = { el, full: 'Full screen', leave: 'Leave full screen', loading: 'Loading...', failed: 'Failed.', open: 'Open' };
  const text = (n) => (n.textContent ?? '') + (n.children ?? []).map(text).join('');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const { RELOAD_TEXT } = await import('../../../src/ui/enhanced/enhancedChunk.js');
  try {
    // LANE2 N4: left before the chunk landed - never built
    let built = 0;
    const d0 = el('div', 'px-qdetail'); body.append(d0);
    drawStage(d0, 'level', () => { built++; return { destroy() {} }; }, words);
    dropStage();
    await wait(5);
    assert.equal(built, 0, 'a dropped face is never built');
    // LANE2-10: a chunk that fails to load is tried once more; a stale one says a reload fixes it; a bug is not retried
    let tries = 0;
    const face = { destroy() {} };
    const d1 = el('div', 'px-qdetail'); body.append(d1);
    drawStage(d1, 'firmament', () => { if (tries++ === 0) throw new Error('Failed to fetch dynamically imported module: /x.js'); return face; }, words);
    await wait(480);
    assert.deepEqual([tries, stageFace() === face], [2, true], 'tried again, and up');
    dropStage();
    tries = 0;
    const d2 = el('div', 'px-qdetail'); body.append(d2);
    drawStage(d2, 'firmament', () => { tries++; throw new Error('Failed to fetch dynamically imported module: /x.js'); }, words);
    await wait(480);
    assert.equal(tries, 2);
    assert.ok(text(d2).includes(RELOAD_TEXT), 'a stale chunk: reload');
    dropStage();
    tries = 0;
    const d3 = el('div', 'px-qdetail'); body.append(d3);
    drawStage(d3, 'firmament', () => { tries++; throw new Error('boom'); }, words);
    await wait(20);
    assert.equal(tries, 1, 'a bug is not tried again');
    assert.ok(text(d3).includes('Failed.'));
    dropStage();
    // LANE2-8: the door on a wide screen, where the page asks for it
    const d4 = el('div', 'px-qdetail'); body.append(d4);
    drawStage(d4, 'level', () => ({ destroy() {} }), { ...words, door: true });
    assert.equal(d4.querySelector('.gr-stage'), null, 'no stage');
    assert.ok(d4.querySelector('.gr-stagecard'), 'its door');
    dropStage();
    for (const d of [d0, d1, d2, d3, d4]) d.remove();   // the window draws its whole tree anew: no older pane stands
    // LANE3-6: a phone's face, opened then left, asks while it stands nowhere - it is opened again to say it
    globalThis.innerWidth = 360;
    let asks = 0;
    const d5 = el('div', 'px-qdetail'); body.append(d5);
    drawStage(d5, 'captain', () => ({ destroy() {}, back: () => asks++ === 0 }), words);
    await wait(5);
    d5.querySelector('.gr-stagecard').children.find((c) => c.tag === 'button').onclick();
    assert.equal(stageLive().full, true);
    body.querySelector('.gr-fullbox').children.find((c) => String(c.className).includes('gr-fullleave')).onclick();
    assert.equal(stageLive().full, false, 'full screen left: the face waits, detached');
    assert.equal(stageAsks(), true, 'it asked');
    assert.equal(stageLive().full, true, 'and was opened to say it');
    assert.equal(stageAsks(), false, 'the second press goes');
  } finally { globalThis.document = was; globalThis.innerWidth = keptW; dropStage(); }
  // the rest by source: deaf under an inert window; the timers door and the scrim ask; the line in the root's frame;
  // the Grimoire's strip; the focus kept in the box and the leave press in its own strip
  for (const f of ['src/ui/firmamentWindow.js', 'src/ui/skyWindow.js', 'src/ui/enhanced/enhancedLevelUp.js']) assert.match(rd(f), /if \(embed && root\.closest\?\.\('\[inert\]'\)\) return;/, f);
  for (const f of ['src/ui/firmamentWindow.js', 'src/ui/skyWindow.js']) assert.match(rd(f), /const placeSay = \(\) => \{ sayBox\.style\.top = `\$\{Math\.round\(\(barFoot\(\) \|\| 66\) \+ 10\)\}px`; \};/, f);
  const menu = rd('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /if \(pauseTab === 'growth' && growthAsks\(\)\) \{ timersOpen = false; timersFocusBack = true; render\(\); return; \}/, 'the timers door asks');
  assert.match(menu, /\(\) => \{ if \(pauseTab === 'growth' && growthAsks\(\)\) return; onAction\('resume'\); \}\);/, 'the scrim asks');
  const tab = rd('src/ui/growth/growthTab.js');
  assert.match(tab, /:root\[data-plus-dress="grimoire"\] \.px-journal\.gr-book > \.px-qrail \{ width: 25%;/);
  assert.match(tab, /const levelDoor = \(\) => \(globalThis\.innerHeight \?\? 720\) < LEVEL_PANE_MIN_H \|\| /);
  assert.match(tab, /door: levelDoor\(\),/);
  const stage = rd('src/ui/growth/growthStage.js');
  assert.match(stage, /\.gr-fullbox > \.gr-stagehost \{ bottom: 48px; \}/);
  assert.match(stage, /me\.guard = \(e\) => \{ if \(me\.box && !me\.box\.contains\?\.\(/);
  assert.match(stage, /document\.addEventListener\?\.\('focusin', me\.guard, true\);/);
});

test('AUDIT GROWTH LANE3 THE CLASSIC SHEET\'S EDGES: no Growth window while the rollout stands (its points live on the sheet - the window\'s Save and doors would lose them); the sheet disposes what it pushed; a chosen path\'s row only while it is in force; Enter on a focused button is the button\'s in the tab; no dead Close in the tab (mutants: the guide over the rollout; dispose dropped; the dormant row; Enter taken; the Close shown)', async () => {
  const { CharSheet } = await import('../../../src/ui/charsheet.js');
  const e = spellsword({ mastered: [LB, AR] });
  e.readyToLevelUp = true; e.pendingLevel = 21;
  const asked = [];
  const sheet = new CharSheet(e, { growth: (at) => { asked.push(at); return { done: false, tick() {}, draw() {}, dispose() {} }; } });
  assert.equal(sheet.leveling, true, 'the rollout stands');
  assert.equal(sheet._growth('specs:martial'), false, 'no window over it');
  assert.deepEqual(asked, []);
  const plain = new CharSheet(spellsword(), { growth: (at) => { asked.push(at); return { done: false, tick() {}, draw() {}, dispose: () => { asked.push('disposed'); } }; } });
  assert.equal(plain._growth('specs:arcane'), true);
  plain.child = plain.hooks.growth('specs:arcane');
  plain.dispose();
  assert.deepEqual(asked, ['specs:arcane', 'specs:arcane', 'disposed'], 'the host\'s drop reaches the child');
  assert.equal(plain.child, null);
  const src = rd('src/ui/charsheet.js');
  assert.match(src, /const guide = typeof this\.hooks\?\.growth === 'function' && !this\.leveling;/);
  assert.match(src, /const pathText = pathOf\(e\) && masterSkillsActive\(e\) \? t\('schools\.sheet\.chosen'/);
  assert.match(src, /const martialText = martialPathOf\(e\) && masterSkillsActive\(e\) \? t\('martial\.sheet\.chosen'/);
  const lv = rd('src/ui/enhanced/enhancedLevelUp.js');
  assert.match(lv, /case 'Enter': case 'NumpadEnter': if \(embed && t\w*\?\.tagName === 'BUTTON'\) \{ used = false; break; \} confirm\(\); break;/);
  assert.match(lv, /if \(embed && screen\?\.viewOnly\) ok\.hidden = true;/);
});

test('GROWTH3 THE WINDOWS, EMBEDDED (by source; tools/growthProbe.mjs drives them): the Firmament, the captain\'s stars and the Ascension each draw at the stage\'s size with no overlay and no Escape of their own - the window\'s back stack asks back(); unaccepted stars asked about once; a stage between two draws hears no key (mutants: an embedded window\'s own Escape; its overlay registered; the deaf check dropped)', () => {
  const firm = rd('src/ui/firmamentWindow.js');
  assert.match(firm, /\.fmt-root\.fmt-embed \{ position: absolute; z-index: auto; \}/);
  assert.match(firm, /if \(embed\) \{ root\.classList\.add\('fmt-embed'\); root\.setAttribute\('aria-modal', 'false'\); exitBtn\.hidden = true; \}/);
  assert.match(firm, /if \(dead \|\| \(embed && !root\.isConnected\)\) return;/);
  assert.match(firm, /case 'Escape':\n\s*if \(embed\) \{ used = false; break; \}/);
  assert.match(firm, /let unregister = embed \? \(\) => \{\} : registerOverlay\(overlayClose\);/);
  // PIN MOVED (AUDIT GROWTH LANE3-8): the ask is for the stars it named - re-armed when they change
  assert.match(firm, /rearm\(\);\n\s*if \(unaccepted\(\) && !armedClose\) \{ arm\(\); say\(unacceptedLeave\(\), true\); return true; \}/);
  assert.match(firm, /const rearm = \(\) => \{ if \(armedClose && armedAt !== sig\(\)\) armedClose = false; \};/);
  // the captain's and the revenants' skies are one window (ui/skyWindow.js - RVN-STARS); only the captain's is embedded
  // (AUDIT GROWTH LANE4-4: each piece of its embedding pinned as the Firmament's is - no Close, no focus taken, the stage
  // watched, the leaving press's words)
  const sky = rd('src/ui/skyWindow.js');
  assert.match(sky, /case 'Escape': if \(embed\) \{ used = false; break; \} tryClose\(\); break;/);
  assert.match(sky, /rearm\(\);\n\s*if \(dead \|\| !unaccepted\(\) \|\| armedClose\) return false;\n\s*arm\(\);\n\s*say\(W\.unacceptedEsc \?\? W\.unaccepted, true\);\n\s*return true;/);   // PIN MOVED (LANE3-8)
  assert.match(sky, /const rearm = \(\) => \{ if \(armedClose && armedAt !== pending\.join\(\)\) armedClose = false; \};/);
  assert.match(sky, /if \(dead \|\| \(embed && !root\.isConnected\)\) return;/);
  assert.match(sky, /if \(embed\) \{ root\.classList\.add\('fmt-embed'\); root\.setAttribute\('aria-modal', 'false'\); exitBtn\.hidden = true; \}/);
  assert.match(sky, /if \(embed\) try \{ watch = new globalThis\.ResizeObserver\(\(\) => \{ if \(!dead\) resize\(\); \}\); watch\.observe\(root\); \} catch \{ watch = null; \}/);
  assert.match(sky, /if \(!embed\) \(goBtn\.disabled \? homeBtn : goBtn\)\.focus\?\.\(\{ preventScroll: true \}\);/);
  assert.match(rd('src/ui/captainTreeWindow.js'), /unacceptedEsc: t\('captain\.sky\.unacceptedLeave', 'You have unaccepted changes\. Press \{accept\} to keep them, or leave again to discard them\.', \{ accept: t\('captain\.sky\.accept', 'Accept'\) \}\),/);
  assert.doesNotMatch(rd('src/ui/revenantStarsWindow.js'), /embed/, 'the revenant sky stands over the window, never in it');
  assert.match(rd('src/ui/captainTreeWindow.js'), /return mountSkyWindow\(host, sky, \{ changed, onExit, doc, embed \}\);/);
  const lv = rd('src/ui/enhanced/enhancedLevelUp.js');
  assert.match(lv, /if \(embed\) root\.classList\.add\('lv-embed'\);/);
  assert.match(lv, /if \(embed && !root\.isConnected\) return;/, 'the Ascension deaf while detached, as the skies are');
  assert.match(lv, /if \(!embed\) unregister = registerOverlay\(closeArm\);/);
  assert.match(lv, /if \(embed \|\| overlayAction\(e\) !== 'back'\) return;/, 'Escape is the window\'s: a level left stays owed');
  // the window's back stack asks the face first, on the Growth tab with a face up
  assert.match(rd('src/ui/enhanced/enhancedMenu.js'), /: mode === 'pause' && pauseTab === 'growth' && stageLive\(\) \? \(\) => \{ if \(!growthBack\(\)\) onAction\('resume'\); \}/);
  // GROWTH-BOOK: one window size for every page of the tab, face or none
  assert.match(rd('src/ui/enhanced/enhancedMenu.js'), /if \(pauseTab === 'growth'\) win\.classList\.add\('px-win-growth'\);/);
});

// GROWTH5 (the merge of RVN-STARS found it: AUDIT RVN-STARS S8's law, for every face on the stage) - LEAVING ASKS FIRST
test('GROWTH5 LEAVING ASKS FIRST: another page, another tab, the sheet\'s key and the QuickDial\'s each ask the face on the stage before dropping it - its own ask (unaccepted stars said once), never full screen\'s; the second press goes (mutants: the sheet\'s key unasked; the menu never asking; another tab or page unasked; full screen left instead)', async () => {
  const { mk, body, doc } = fakeDoc();
  const was = globalThis.document;
  globalThis.document = doc;
  const keptW = globalThis.innerWidth;
  globalThis.innerWidth = 1280;
  const el = (t, c, x) => { const n = mk(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
  try {
    let pending = true, armed = false;
    const face = { destroy() {}, back: () => { if (!pending || armed) return false; armed = true; return true; } };
    const d = el('div', 'px-qdetail'); body.append(d);
    drawStage(d, 'captain', () => face, { el, full: 'Full screen', leave: 'Leave full screen', loading: '...', failed: '!' });
    await new Promise((r) => setTimeout(r, 0));
    d.querySelector('.gr-stagebar').children.find((c) => c.tag === 'button').onclick();   // full screen
    assert.equal(stageAsks(), true, 'unaccepted stars: the face asks');
    assert.equal(stageAsks(), false, 'the second press goes');
    assert.equal(stageLive().full, true, 'never full screen\'s: the ask leaves it standing');
    pending = false; armed = false;
    assert.equal(stageAsks(), false, 'nothing pending: nothing asked');
  } finally { globalThis.document = was; globalThis.innerWidth = keptW; dropStage(); }
  const sheet = rd('src/ui/charSheetDoor.js');
  assert.match(sheet, /const dialClose = \(\) => \{ if \(view\?\.asksFirst\?\.\(\)\) \{ unregister = registerOverlay\(dialClose\); return; \} close\(\); \};\n\s+unregister = registerOverlay\(dialClose\);/, 'the dial arm asks, and is laid again');
  assert.match(sheet, /if \(view\?\.asksFirst\?\.\(\) \|\| rvnStars\.asks\(\)\) return;\s+\/\/ GROWTH5/, 'the sheet\'s key asks (PIN MOVED, AUDIT GROWTH LANE4-1: a sworn one\'s sky too)');
  const menu = rd('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /asksFirst: \(\) => mode === 'pause' && pauseTab === 'growth' && growthAsks\(\),/);
  assert.match(menu, /b\.onclick = \(\) => \{ if \(pauseTab === 'growth' && id !== 'growth' && growthAsks\(\)\) return;/, 'another tab asks');
  assert.match(rd('src/ui/growth/growthTab.js'), /b\.onclick = \(\) => \{ if \(sec !== id && stageAsks\(\)\) return;/, 'another page asks');
  // PIN MOVED (AUDIT GROWTH LANE3-6): the face's own ask - opened full screen when it asks while it stands nowhere
  assert.match(rd('src/ui/growth/growthStage.js'), /try \{ held = !!me\.face\?\.back\?\.\(\); \} catch \{ return false; \}\n\s*if \(held && !me\.full && !me\.host\.isConnected && me\.words\) setFull\(true, me\.el, me\.words\);/);
});

// ── GROWTH4: the classic sheet's rows and the one ask's words ───────────────────────────────────────────────────────

test('GROWTH4 THE CLASSIC SHEET: where a document stands, its S and W rows open the Growth tab\'s guide on their family - the enhanced pause, pushed as the sheet\'s own child (its Resume back to the sheet); the rows stand whenever the class can meet a path (mutants: the rows only while a path is open; the family landing swapped; the guide on the host\'s slot)', async () => {
  const { CharSheet } = await import('../../../src/ui/charsheet.js');
  const e = spellsword({ raised: { [LB]: 64 } });
  const asked = [];
  const sheet = new CharSheet(e, { growth: (at) => { asked.push(at); return { done: false, tick() {}, draw() {} }; } });
  sheet.page = 1;
  sheet._pathRow = [0, 0, 10, 9]; sheet._martialRow = [0, 10, 10, 9];
  sheet.input('KeyS');
  assert.deepEqual(asked, ['specs:arcane']);
  assert.ok(sheet.child, 'pushed as the sheet\'s child');
  sheet.child = null;
  sheet.input('KeyW');
  assert.deepEqual(asked, ['specs:arcane', 'specs:martial']);
  const src = rd('src/ui/charsheet.js');
  assert.match(src, /: guide && pathPossible\(e\) \? t\('schools\.sheet\.guide', 'Arcane paths  \(S\)'\) : null;/);
  assert.match(src, /: guide && martialPossible\(e\) \? t\('martial\.sheet\.guide', 'Martial paths  \(W\)'\) : null;/);
  const door = rd('src/ui/charSheetDoor.js');
  // PIN MOVED (AUDIT GROWTH LANE3-14): and no relock under the sheet on its Save or Load
  assert.match(door, /if \(typeof document !== 'undefined'\) hooks\.growth = \(at\) => openPauseFlow\(\(\) => \{\}, \{ \.\.\.\(deps\.pause\?\.\(\) \?\? \{\}\), at, onResume: \(\) => \{\}, relock: \(\) => \{\} \}\);/);
  assert.match(rd('src/ui/pauseDoor.js'), /if \(growthPageAt\(hooks\.at\) && typeof document !== 'undefined'\) return enhancedPauseOverlay\(show, hooks\);/, 'on either skin');
});

test('GROWTH4 THE ONE ASK\'S WORDS: on the enhanced skin the No and the several-open box name the Growth tab; the classic skin\'s the skill screen, whose rows open the same guide (mutants: the skins\' words swapped)', () => {
  assert.equal(AP.pathDeclinedGrowthText(), 'You can choose a specialization later on the Growth tab of the pause menu.');
  assert.equal(MP.martialDeclinedGrowthText(), 'You can choose a martial specialization later on the Growth tab of the pause menu.');
  // PIN MOVED (SPEC-RESET, bible/10-UI/Growth.md section 10): the choice is undone only by the paid reset, and the box
  // names its price - on a row of its own (AUDIT SPEC-RESET L4-5)
  assert.equal(AP.pathsOpenRows([AP.PATH_BY_ID.warden], { growth: true }).at(-2), 'See them all and choose one on the Growth tab of the pause menu.');
  assert.equal(MP.martialOpenRows([MP.MARTIAL_BY_ID.ranger], { growth: true }).at(-2), 'See them all and choose one on the Growth tab of the pause menu.');
  assert.equal(MP.martialOpenRows([MP.MARTIAL_BY_ID.ranger]).at(-2), 'Choose one in your skill screen.');
  assert.equal(MP.martialOpenRows([MP.MARTIAL_BY_ID.ranger]).at(-1), 'Resetting it later costs 200,000 gold.');
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /\(\) => say\(isEnhanced\(\) \? pathDeclinedGrowthText\(\) : pathDeclinedText\(\)\)\);/);
  assert.match(shared, /\(\) => say\(isEnhanced\(\) \? martialDeclinedGrowthText\(\) : martialDeclinedText\(\)\)\);/);
  assert.match(shared, /ask\(pathsOpenRows\(open, \{ growth: isEnhanced\(\) \}\), null, null, \{ okOnly: true \}\);/);
  assert.match(shared, /ask\(martialOpenRows\(open, \{ growth: isEnhanced\(\) \}\), null, null, \{ okOnly: true \}\);/);
});

// ── the pause window, driven (LAST: the fake document's globals stand for the rest of the file) ─────────────────────

test('GROWTH THE WINDOW, DRIVEN: the Stats page\'s Growth door (its count) lands on the Growth tab; a family\'s landing opens its guide; a path\'s detail says what opens it, what it does and how it is used, and its Choose asks and chooses; Master Skills and the Captain page lead into the tab; no Ascend or Firmament button stands on the Stats page (mutants: the door\'s count; the detail\'s parts; the moved doors)', async () => {
  await import('../../chargenDom.mjs');
  _resetForTests();
  const { mountEnhancedMenu } = await import('../../../src/ui/enhanced/enhancedMenu.js');
  const { setHoldingsProvider } = await import('../../../src/ui/holdingsPages.js');
  const kept = { ...playerEntity };
  const restore = () => { for (const k of Object.keys(playerEntity)) if (!(k in kept)) delete playerEntity[k]; Object.assign(playerEntity, kept); };
  try {
    Object.assign(playerEntity, spellsword({ mastered: [LB, AR] }));
    const host = globalThis.document.createElement('div');
    const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: {}, onAction: () => {}, at: 'stats' });
    const btn = (text) => host.querySelectorAll('button').find((b) => b.textContent.startsWith(text));
    const rail = (text) => host.querySelectorAll('button').find((b) => String(b.className).includes('px-qrow') && b.textContent.includes(text));
    const tabOn = () => host.querySelectorAll('button').find((b) => b.className === 'on')?.textContent ?? '';
    try {
      assert.equal(btn('Ascend'), undefined, 'no Ascend on the Stats page');
      assert.equal(btn('Firmament'), undefined, 'no Firmament on the Stats page');
      assert.equal(btn('Growth')?.textContent, 'Growth (1)', 'the Growth door counts the path waiting');
      btn('Growth').onclick();
      assert.match(tabOn(), /Growth/);
      rail('Specializations').onclick();
      const bar = host.querySelectorAll('button').find((b) => String(b.className).includes('gr-pathbar') && b.textContent.startsWith('Ranger'));
      bar.onclick();
      const detail = host.querySelectorAll('div').find((d) => String(d.className).includes('gr-detail'))?.textContent ?? '';
      const woods = host.querySelectorAll('button').find((b) => String(b.className).includes('gr-pathbar') && b.textContent.startsWith('Woodsman'));
      woods.onclick();
      assert.equal(btn('Choose Woodsman'), undefined, 'a path not open has no Choose');
      host.querySelectorAll('button').find((b) => String(b.className).includes('gr-pathbar') && b.textContent.startsWith('Ranger')).onclick();
      for (const part of ['Requirements', 'Long Blade: mastered', 'Passive: Hunter\'s Instinct', 'Signature technique: Mark of the Hunt', 'Bow: 12-second cooldown', 'Weapon Technique key']) assert.ok(detail.includes(part), part);
      btn('Choose Ranger').onclick();
      const ask = globalThis.document.body.querySelectorAll('div').find((d) => String(d.className).includes('px-master-ask'));
      assert.match(ask.textContent, /Martial specialization: Ranger\?/);
      ask.querySelectorAll('button').find((b) => b.textContent === 'Yes').onclick();
      assert.equal(playerEntity.martialPath, 'ranger');
      // the Master Skills page's link into the guide
      host.querySelectorAll('button').find((b) => b.textContent.includes('Stats')).onclick();
      btn('Master Skills').onclick();
      btn('Specializations').onclick();
      assert.match(tabOn(), /Growth/);
      assert.ok(host.querySelectorAll('div').some((d) => String(d.className).includes('gr-switch')), 'on the guide');
    } finally { menu.unmount(); }
    // a family's landing (the classic sheet's W) opens its guide; the Captain page's stars lead into the tab
    setHoldingsProvider({ captain: { model: () => ({ crowns: [], refusedAt: 0, marque: null, contracts: [], charts: [], log: [], stars: { level: 3, xp: 100, points: 2, next: 400, set: 0 } }), openStars: () => true, stars: () => ({ ledger: null }) } });
    const host2 = globalThis.document.createElement('div');
    const menu2 = mountEnhancedMenu(host2, { mode: 'pause', hooks: {}, onAction: () => {}, at: 'specs:arcane' });
    try {
      const fam = host2.querySelectorAll('button').find((b) => String(b.className).includes('gr-fam') && String(b.className).includes('on'));
      assert.match(fam.textContent, /^Arcane/, 'the S row\'s family');
      host2.querySelectorAll('button').find((b) => b.textContent.includes('Holdings')).onclick();
      host2.querySelectorAll('button').find((b) => String(b.className).includes('px-qrow') && b.textContent.includes('Captain')).onclick();
      host2.querySelectorAll('button').find((b) => b.textContent === 'Open the stars').onclick();
      const on = host2.querySelectorAll('button').find((b) => String(b.className).includes('px-qrow') && String(b.className).includes('on'));
      assert.match(on.textContent, /Captain's Stars/, 'the Growth tab\'s Captain\'s Stars');
    } finally { menu2.unmount(); setHoldingsProvider(null); }
  } finally { restore(); dropStage(); }
});

test('AUDIT GROWTH LANE5-4 THE TAB WITH ITS REAL FACES, DRIVEN: the Firmament and the captain\'s sky mounted on the stage - a star taken, another page, another tab and the window\'s asksFirst each hold the first press and say so, the second goes and drops the face, the stars never set; the Level page with a level owed draws the owed rollout, never the view (mutants: the Firmament\'s back unreturned; the captain\'s; the owed read false; a face mounted unembedded)', async () => {
  await import('../../chargenDom.mjs');
  _resetForTests();
  const { mountEnhancedMenu } = await import('../../../src/ui/enhanced/enhancedMenu.js');
  const { setHoldingsProvider } = await import('../../../src/ui/holdingsPages.js');
  const { setFirmamentBook } = await import('../../../src/net/firmament/firmamentBook.js');
  const { starsFor, craftPointsFor } = await import('../../../src/net/firmament/firmamentLaw.js');
  const { START_KEYS } = await import('../../../src/net/firmament/firmamentTree.js');
  const { createCaptainLedger } = await import('../../../src/systems/naval/captainLedger.js');
  const settle = async (pred) => { for (let i = 0; i < 200 && !pred(); i++) await new Promise((r) => setTimeout(r, 5)); };
  const kept = { ...playerEntity };
  const restore = () => { for (const k of Object.keys(playerEntity)) if (!(k in kept)) delete playerEntity[k]; Object.assign(playerEntity, kept); };
  let tree = { start: null, nodes: [] };
  const commits = [];
  setFirmamentBook({
    state: { open: true, stars: starsFor(30), craft: craftPointsFor(new Array(10).fill(30)), renown: 30, refund: { freeBelow: 10, perStar: 10 } },
    current: () => tree, read: async () => ({ ok: true }), onChange: () => () => {},
    commit: async (next) => { commits.push(next); tree = next; return { ok: true }; }, respec: async () => ({ ok: false }), canRespec: () => false,
  });
  const ledger = createCaptainLedger();
  for (let i = 0; i < 40; i++) ledger.sailed(90000);
  const setBefore = ledger.tree().slice();
  setHoldingsProvider({ captain: {
    model: () => ({ crowns: [], refusedAt: 0, marque: null, contracts: [], charts: [], log: [], stars: { ...ledger.captain(), set: ledger.tree().length - 1 } }),
    openStars: () => false, stars: () => ({ ledger, changed: () => {} }),
  } });
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);   // the window on the page: its faces stand connected, as in the game
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;   // the skies' frame loop asks for the next frame inside this one: none here
  let menu = null;
  try {
    Object.assign(playerEntity, spellsword({ mastered: [LB, AR] }), { readyToLevelUp: true, pendingLevel: 21, isPlayer: true });
    menu = mountEnhancedMenu(host, { mode: 'pause', hooks: { ascendScreen: () => levelUpScreenFor(playerEntity) }, onAction: () => {}, at: 'firmament' });
    const rail = (text) => host.querySelectorAll('button').find((b) => String(b.className).includes('px-qrow') && b.textContent.includes(text));
    const page = () => host.querySelectorAll('button').find((b) => String(b.className).includes('px-qrow') && String(b.className).includes(' on'))?.textContent ?? '';
    const tab = (text) => host.querySelectorAll('button').find((b) => b.textContent.replace(/\u25c6/g, '') === text);
    const asked = (re) => assert.match(host.textContent, re);
    // THE FIRMAMENT: a birthsign taken - another page asks once, then goes (the face dropped, nothing committed)
    await settle(() => stageFace()?.allocate);
    const firm = stageFace();
    assert.equal(typeof firm.back, 'function', 'the Firmament answers the stage\'s ask');
    assert.equal(host.querySelectorAll('div').some((d) => String(d.className).includes('fmt-embed')), true, 'drawn in the pane, embedded');
    firm.allocate(START_KEYS[1]);
    assert.equal(firm.model().changes.startChanged, true);
    rail('Specializations').onclick();
    assert.match(page(), /Firmament/, 'the first press held');
    asked(/You have unaccepted changes\. Press Accept to keep them, or leave again to discard them\./);
    assert.equal(menu.asksFirst(), false, 'asked once: the window\'s own ask lets the second go');
    rail('Specializations').onclick();
    assert.match(page(), /Specializations/, 'the second press went');
    assert.equal(stageFace(), null, 'the face dropped');
    assert.deepEqual(commits, [], 'nothing accepted');
    // THE CAPTAIN'S SKY: a star taken - the window's asksFirst (the sheet's key, the dial's) holds once; another tab after it goes
    rail('Captain').onclick();
    await settle(() => stageFace()?.take);
    const sky = stageFace();
    assert.equal(typeof sky.back, 'function', 'the captain\'s sky answers the stage\'s ask');
    assert.equal(host.querySelectorAll('div').filter((d) => String(d.className).includes('fmt-embed')).length, 1, 'the captain\'s sky in the pane, embedded');
    const star = (await import('../../../src/systems/naval/captainTree.js')).CAPTAIN_STARS.find((s) => !setBefore.includes(s.id) && s.links?.some?.((l) => setBefore.includes(l)))?.id;
    if (star) sky.take(star); else sky.take((await import('../../../src/systems/naval/captainTree.js')).CAPTAIN_STARS[1].id);
    assert.ok(sky.model().changes.added > 0, 'a star pending');
    assert.equal(menu.asksFirst(), true, 'the sheet\'s or the dial\'s key: asked');
    asked(/You have unaccepted changes\. Press Accept to keep them, or leave again to discard them\./);
    tab('Stats').onclick();
    assert.equal(stageFace(), null, 'another tab, the second press: the face dropped');
    assert.deepEqual(ledger.tree(), setBefore, 'the captain\'s stars never set');
    // THE LEVEL PAGE with a level owed: the owed rollout (pool and Ascend), never the view
    tab('Growth').onclick();
    rail('Level').onclick();
    assert.ok(host.querySelectorAll('div').some((d) => String(d.className).includes('gr-stagecard')), 'a 720-high window: the Level page\'s door, the face full screen (AUDIT GROWTH LANE2-8)');
    await settle(() => stageFace()?.model);
    const lv = stageFace().model();
    assert.equal(lv.crown.viewOnly, false, 'the level owed, not the view of the stars');
    assert.ok(lv.pool > 0, 'its points to place');
    // the window put away takes the face with it (its listeners, its frame loop, a full-screen box)
    menu.unmount(); menu = null;
    assert.equal(stageLive(), null, 'the face went with the window');
    assert.match(rd('src/ui/growth/growthTab.js'), /entity, embed: true, onExit: \(\) => \{ dropStage\(\); ctx\.render\(\); \} \}\)\)/, 'the Ascension ascended: the stage drops it and the page draws again');
  } finally { menu?.unmount(); host.remove?.(); setFirmamentBook(null); setHoldingsProvider(null); restore(); dropStage(); globalThis.requestAnimationFrame = raf; }
});

test('AUDIT GROWTH LANE3-9 / LANE5-6 THE YES/NO CARD AND THE MASTER SKILLS LINE, DRIVEN: Escape over the card is its No and never resumes the game under it; the window\'s unmount takes a standing card down; the Master Skills page draws its specialisation line only for a character with a family to reach or a path held (mutants: the back stack over the card; the card left standing; the line for a class that can never meet a path)', async () => {
  const dom = await import('../../chargenDom.mjs');
  _resetForTests();
  const { mountEnhancedMenu } = await import('../../../src/ui/enhanced/enhancedMenu.js');
  const kept = { ...playerEntity };
  const restore = () => { for (const k of Object.keys(playerEntity)) if (!(k in kept)) delete playerEntity[k]; Object.assign(playerEntity, kept); };
  const card = () => globalThis.document.body.querySelectorAll('div').find((d) => String(d.className).includes('px-master-ask')) ?? null;
  const esc = { stopImmediatePropagation() { this.stopped = true; } };
  const acts = [];
  let menu = null;
  try {
    Object.assign(playerEntity, spellsword({ raised: { [RES]: 100 } }));
    const host = globalThis.document.createElement('div');
    const open = () => {
      menu = mountEnhancedMenu(host, { mode: 'pause', hooks: {}, onAction: (a) => acts.push(a), at: 'stats' });
      host.querySelectorAll('button').find((b) => b.textContent.startsWith('Master Skills'))?.onclick();   // the page keeps its last section
      assert.ok(host.querySelectorAll('button').some((b) => b.textContent.endsWith('Skills') && b.textContent.startsWith('\u2039')), `on the Master Skills page: ${host.querySelectorAll('button').map((b) => b.textContent).join(' | ')}`);
    };
    open();
    const line = () => host.querySelectorAll('div').find((d) => String(d.className).includes('px-master-about'))?.textContent ?? null;
    assert.equal(line(), 'Master two schools of magic or two weapon skills to unlock a specialization. See every path and what it needs on the Growth tab.');
    host.querySelectorAll('button').find((b) => b.textContent === 'Master').onclick();
    assert.ok(card(), 'the card asks');
    dom.keydown('Escape', undefined, esc); dom.keyup('Escape', undefined, esc);
    assert.equal(card(), null, 'Escape: the card\'s No');
    assert.deepEqual(acts, [], 'the game never resumed under it');
    assert.equal(playerEntity.masteredSkills?.includes?.(RES) ?? false, false, 'nothing mastered');
    host.querySelectorAll('button').find((b) => b.textContent === 'Master').onclick();
    assert.ok(card());
    menu.unmount(); menu = null;
    assert.equal(card(), null, 'the window\'s unmount took the card down');
    // a class that can never meet a path of either family: no line
    Object.assign(playerEntity, hero({ primary: [SKILLS.Stealth, SKILLS.Running, SKILLS.Swimming], major: [SKILLS.Climbing, SKILLS.Jumping, SKILLS.Dodging], minor: [SKILLS.Medical, SKILLS.Mercantile, SKILLS.Lockpicking] }));
    open();
    assert.equal(line(), null, 'no specialisation line for a class that can never meet a path');
    menu.unmount(); menu = null;
    // both held: where they are
    Object.assign(playerEntity, spellsword({ mastered: [LB, AR, RES, ALT] }));
    assert.equal(MP.chooseMartialPath(playerEntity, 'ranger').ok, true);
    assert.equal(AP.choosePath(playerEntity, 'warden').ok, true);
    open();
    assert.equal(line(), 'Your specializations are on the Growth tab.');   // PIN MOVED (VOICE2): specialization (Voice.md rule 8)
  } finally { menu?.unmount(); restore(); }
});

test('AUDIT GROWTH LANE5-2 THE BUTTON\'S OWN WORD: in another language the Level page\'s lead names the Ascend button as the button reads, from its own key - never a second translation that can drift (mutants: the lead\'s word written in)', async () => {
  await import('../../chargenDom.mjs');
  _resetForTests();
  const { patchLocaleTable, setLocale } = await import('../../../src/systems/textManager.js');
  const { mountEnhancedMenu } = await import('../../../src/ui/enhanced/enhancedMenu.js');
  const kept = { ...playerEntity };
  const restore = () => { for (const k of Object.keys(playerEntity)) if (!(k in kept)) delete playerEntity[k]; Object.assign(playerEntity, kept); };
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  let menu = null;
  try {
    patchLocaleTable('fr', 'Port_Strings', [['levelup.ok.ascend', 'Monter'], ['growth.level.owed', 'Placez vos points, puis appuyez sur {ascend}.']]);
    setLocale('fr');
    Object.assign(playerEntity, spellsword(), { readyToLevelUp: true, pendingLevel: 21, isPlayer: true });
    const host = globalThis.document.createElement('div');
    menu = mountEnhancedMenu(host, { mode: 'pause', hooks: { ascendScreen: () => levelUpScreenFor(playerEntity) }, onAction: () => {}, at: 'level' });
    assert.match(host.textContent, /Placez vos points, puis appuyez sur Monter\./);
  } finally { menu?.unmount(); setLocale('en'); restore(); dropStage(); globalThis.requestAnimationFrame = raf; }
});
