// MENTOR2 (2026-10-27; bible/06-Systems/Mentor-Mode.md): mentoring beside the party, steadied, gentler, paid, and said.
// Each law here is pinned on both sides of its line, so a one-character change to its number fails a test.
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  mentorEngages, mentorTargetLevel, mentorWorldLevel, mentorProfile, refreshMentor, refreshPupil, pupilMentorLevel, createMentorPresence,
  effectiveLevel, castingLevel, lootGateLevel, mentorPowerScale, mentorScaled, mentoredSkill, expectedSkillAt,
  MENTOR_MIN_GAP, MENTOR_MIN_RATIO, MENTOR_LEVEL_ALLOWANCE, MENTOR_LEVEL_SHARE, MENTOR_WORLD_ALLOWANCE, MENTOR_MAX_DAMAGE_MULT,
  MENTOR_JOIN_MS, MENTOR_LEAVE_MS, MENTOR_FIGHT_HOLD_MS, MENTOR_NEAR_METRES, MENTOR_PUPIL_TALLY,
} from '../../src/systems/mentorMode.js';
import { mentorStatusText, pupilStatusText, mentorHudTile, mentorTipCard, mentorPartyNote, mentorEndedText, levelShort } from '../../src/systems/mentorText.js';
import { createMentorHost } from '../../src/scenes/mentorHost.js';
import { setFirmamentMentorScale, firmamentMentorScale, firmamentStatsAt, setFirmamentTree, setFirmamentOnline, _resetFirmamentLiveForTests } from '../../src/systems/firmamentLive.js';
import { pathTo, treeStats, statDef } from '../../src/net/firmament/firmamentLaw.js';
import { FIRM_NODES } from '../../src/net/firmament/firmamentTree.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { masterSkill } from '../../src/systems/masterSkills.js';
import { SKILLS, tallySkill } from '../../src/systems/skills.js';
import { noteSkillChallenge } from '../../src/systems/skillSoftcap.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { statusTiles, STATUS_GLYPHS } from '../../src/ui/hud/hudStatus.js';
import { statusTip } from '../../src/ui/hud/statusTips.js';
import { partyPoseText } from '../../src/ui/socialPanel.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const STATS = { strength: 80, intelligence: 50, willpower: 50, agility: 70, endurance: 70, personality: 40, speed: 60, luck: 50 };
const body = (level, extra = {}) => ({ level, maxHealth: 400, stats: { ...STATS }, ...extra });

beforeEach(() => { _resetFirmamentLiveForTests(); });

// ── D: the numbers ──────────────────────────────────────────────────

test('MENTOR2 D: THE CONSTANTS - five levels and half again before mentoring engages; the mentor fights three levels (or a quarter) over the group; the world one over; a blow lands at most twice as hard (mutants: each number)', () => {
  assert.deepEqual([MENTOR_MIN_GAP, MENTOR_MIN_RATIO, MENTOR_LEVEL_ALLOWANCE, MENTOR_LEVEL_SHARE, MENTOR_WORLD_ALLOWANCE, MENTOR_MAX_DAMAGE_MULT],
    [5, 1.5, 3, 0.25, 1, 2]);
  assert.deepEqual([MENTOR_JOIN_MS, MENTOR_LEAVE_MS, MENTOR_FIGHT_HOLD_MS, MENTOR_NEAR_METRES, MENTOR_PUPIL_TALLY], [3000, 30000, 30000, 150, 1.2]);
});

test('MENTOR2 D: WHEN MENTORING ENGAGES - the group at least five levels under me AND me at least half again its level, both sides of each line (SOFTCAP1 engaged at three: a level 8 was mentored by a level 5) (mutants: the gap at 4 or 6; the ratio at 1.4 or 1.6; either law dropped)', () => {
  const cases = [
    [10, 5, true], [9, 5, false],        // the gap: 5 engages, 4 does not
    [8, 3, true], [7, 3, false],
    [30, 20, true], [29, 20, false],     // the ratio: 30 is 1.5 x 20; 29 is not
    [45, 25, true], [40, 28, false],     // a level 40 beside a 28: twelve levels, but not half again - no mentoring
    [8, 5, false],                       // SOFTCAP1's own case: no longer
  ];
  for (const [r, ref, on] of cases) assert.equal(mentorEngages(r, ref), on, `${r} beside ${ref}`);
  assert.equal(mentorEngages(0, 5), false);
  assert.equal(mentorEngages(30, null), false);
});

test('MENTOR2 D: THE LEVELS - the mentor FIGHTS at the group\'s level plus three or plus a quarter, whichever is more, never at or past their own; the WORLD is built at the group\'s plus one (mutants: the lift at 2; the quarter at a fifth; the world at the fight\'s level; the cap at the real level)', () => {
  const rows = [
    [10, [5], 8, 6], [8, [3], 6, 4], [30, [5], 8, 6], [30, [20], 25, 21], [45, [25], 31, 26],
    [20, [3, 5], 7, 5], [30, [3, 5, 20], 8, 6], [15, [5, 30], 12, 10],
  ];
  for (const [r, partners, fight, world] of rows) {
    assert.deepEqual([mentorTargetLevel(r, partners), mentorWorldLevel(r, partners)], [fight, world], `${r} beside ${partners}`);
    assert.ok(fight < r, 'never at the real level');
  }
  assert.deepEqual([mentorTargetLevel(9, [5]), mentorWorldLevel(9, [5])], [null, null]);
  assert.deepEqual([mentorTargetLevel(30, []), mentorWorldLevel(30, [])], [null, null]);
});

test('MENTOR2 D: THE PROFILE - its fight level, its world level, a power scale equal to its gear scale, a blow at most twice as hard (SOFTCAP1\'s cap was 5); the readers: the world reads worldLevel, a spell reads level, the loot gate the real one (mutants: the cap at 5; the world at the fight level; the caster at the world level; the gate at the mentored level)', () => {
  const e = body(30);
  const m = mentorProfile(e, [5]);
  assert.deepEqual([m.level, m.worldLevel, m.realLevel, m.reference], [8, 6, 30, 5]);
  assert.equal(m.powerScale, m.gearScale);
  assert.equal(m.gearScale, Math.sqrt(expectedSkillAt(8) / expectedSkillAt(30)));
  assert.equal(m.damageTakenMult, MENTOR_MAX_DAMAGE_MULT, 'a level 30 beside a level 5: the most, never past it');
  assert.ok(400 / m.mentoredMaxHealth > 2, 'the body alone would have said more');
  e._mentor = m;
  assert.deepEqual([effectiveLevel(e), castingLevel(e), lootGateLevel(e), mentorPowerScale(e)], [6, 8, 30, m.powerScale]);
  const free = body(30);
  assert.deepEqual([effectiveLevel(free), castingLevel(free), lootGateLevel(free), mentorPowerScale(free)], [30, 30, 30, 1]);
  const near = mentorProfile(body(30), [20]);
  assert.ok(near.damageTakenMult > 1 && near.damageTakenMult < 2, `beside a level 20: ${near.damageTakenMult}`);
});

test('MENTOR2 D: refreshMentor says the start, the end and a moved level apart - only the start and the end reach the chat (mutants: a move said as a start; the end unsaid)', () => {
  const e = body(30);
  assert.equal(refreshMentor(e, [5]), 'on');
  assert.equal(refreshMentor(e, [5]), null);
  assert.equal(refreshMentor(e, [6]), 'moved', 'the group moved a level');
  assert.equal(refreshMentor(e, []), 'off');
  assert.equal(e._mentor, null);
});

// ── A: beside me, steadied ──────────────────────────────────────────

test('MENTOR2 A: THE PRESENCE - a partner counts after MENTOR_JOIN_MS beside me and for MENTOR_LEAVE_MS after they go; a fight holds the answer for at most MENTOR_FIGHT_HOLD_MS; a member who left the party drops at once; reset forgets (mutants: no join wait; no linger; the hold forever; the members unread)', () => {
  const pr = createMentorPresence();
  const near = [{ acct: 'a', level: 5 }];
  assert.deepEqual(pr.levels(near, 0), [], 'just arrived');
  assert.deepEqual(pr.levels(near, MENTOR_JOIN_MS - 1), []);
  assert.deepEqual(pr.levels(near, MENTOR_JOIN_MS), [5], 'beside me long enough');
  assert.deepEqual(pr.levels([], MENTOR_JOIN_MS + MENTOR_LEAVE_MS), [5], 'gone, still counted');
  assert.deepEqual(pr.levels([], MENTOR_JOIN_MS + MENTOR_LEAVE_MS + 1), [], 'gone past the linger');
  assert.deepEqual(pr.levels(near, 100000), [], 'back: the wait starts again');
  // the fight: a change waits for its end, at most MENTOR_FIGHT_HOLD_MS - asked only while a change waits
  const f = createMentorPresence();
  f.levels(near, 0); assert.deepEqual(f.levels(near, MENTOR_JOIN_MS), [5]);
  let asked = 0;
  const fight = () => { asked++; return true; };
  assert.deepEqual(f.levels([], 10000, { fighting: fight }), [5]);
  assert.equal(asked, 0, 'no change waits: the fight is not asked');
  const gone = MENTOR_JOIN_MS + MENTOR_LEAVE_MS + 1;
  assert.deepEqual(f.levels([], gone, { fighting: fight }), [5], 'a partner gone past the linger mid-fight: held');
  assert.equal(asked, 1);
  assert.deepEqual(f.levels([], gone + MENTOR_FIGHT_HOLD_MS - 1, { fighting: true }), [5], 'held to the last moment');
  assert.deepEqual(f.levels([], gone + MENTOR_FIGHT_HOLD_MS, { fighting: true }), [], 'the hold ends');
  const g = createMentorPresence();
  assert.deepEqual(g.levels(near, 0, { fighting: true }), [], 'a partner arriving mid-fight waits for its end');
  assert.deepEqual(g.levels(near, MENTOR_JOIN_MS, { fighting: true }), []);
  assert.deepEqual(g.levels(near, MENTOR_JOIN_MS + 1), [5], 'the fight over');
  // the party
  const h = createMentorPresence();
  h.levels(near, 0); h.levels(near, MENTOR_JOIN_MS);
  assert.deepEqual(h.levels([], MENTOR_JOIN_MS + 1, { member: (acct) => acct === 'b' }), [], 'left the party: gone at once');
  h.levels(near, 0); h.levels(near, MENTOR_JOIN_MS);
  h.reset();
  assert.deepEqual(h.levels([], MENTOR_JOIN_MS + 1), []);
  assert.deepEqual(pr.levels([{ acct: 'x', level: 0 }, { acct: null, level: 5 }, null], 0), [], 'a bad row is no partner');
});

/** The streaming host's doors, faked: a party, the bodies drawn in my room, my feet, a fight, the chat. */
function rig({ outdoors = false } = {}) {
  const me = body(30, { isPlayer: true });
  const lines = [];
  const state = { party: true, mates: [{ acct: 'low', online: true, p: { cl: 5 } }], near: [{ acct: 'low', feet: [10, 0, 0] }], fighting: false };
  const social = { get party() { return state.party ? { members: [] } : null; }, others: () => state.mates };
  const host = createMentorHost({
    player: () => me, social: () => social, near: () => state.near, outdoors: () => outdoors, feet: () => [0, 0, 0],
    fighting: () => state.fighting, chat: () => ({ active: 'main', push: (tab, l) => lines.push(l.text) }),
  });
  return { me, lines, state, host };
}

test('MENTOR2 A: THE HOST - a party member drawn in my room mentors me after the join wait, the Firmament told the share, the chat told once; leaving the party ends it the same frame (SOFTCAP1\'s own promise); an offline member, a member with no level, a member past MENTOR_NEAR_METRES outdoors count for nothing (mutants: the wait skipped; the share untold; the chat told twice; the party left unread; the distance unread)', () => {
  const { me, lines, state, host } = rig();
  host.frame(0);
  assert.equal(me._mentor, null, 'just arrived');
  host.frame(MENTOR_JOIN_MS);
  assert.equal(me._mentor?.level, 8);
  assert.equal(firmamentMentorScale(), me._mentor.powerScale);
  host.frame(MENTOR_JOIN_MS + 16);
  assert.deepEqual(lines, [mentorStatusText(me)], 'said once');
  state.party = false;
  host.frame(MENTOR_JOIN_MS + 32);
  assert.equal(me._mentor, null, 'the party left: myself again, the same frame');
  assert.equal(firmamentMentorScale(), 1);
  assert.deepEqual(lines, [mentorStatusText({ _mentor: mentorProfile(body(30), [5]) }), mentorEndedText()]);
  for (const mate of [{ acct: 'low', online: false, p: { cl: 5 } }, { acct: 'low', online: true, p: {} }]) {
    const r = rig();
    r.state.mates = [mate];
    r.host.frame(0); r.host.frame(MENTOR_JOIN_MS);
    assert.equal(r.me._mentor, null, JSON.stringify(mate));
  }
  const out = rig({ outdoors: true });
  out.state.near = [{ acct: 'low', feet: [MENTOR_NEAR_METRES + 1, 0, 0] }];
  out.host.frame(0); out.host.frame(MENTOR_JOIN_MS);
  assert.equal(out.me._mentor, null, 'outdoors, past the reach');
  out.state.near = [{ acct: 'low', feet: [MENTOR_NEAR_METRES - 1, 50, 0] }];
  out.host.frame(MENTOR_JOIN_MS * 3); out.host.frame(MENTOR_JOIN_MS * 4);
  assert.equal(out.me._mentor?.level, 8, 'outdoors, within it (the height is no distance)');
  const inside = rig();
  inside.state.near = [{ acct: 'low', feet: [5000, 0, 0] }];
  inside.host.frame(0); inside.host.frame(MENTOR_JOIN_MS);
  assert.equal(inside.me._mentor?.level, 8, 'in a dungeon or a building the room is the bound');
});

test('MENTOR2 A: THE HOST HOLDS A FIGHT - a partner who walks off mid-fight leaves the mentor as they were until the fight ends or the hold runs out (mutants: the fight unread)', () => {
  const { me, state, host } = rig();
  host.frame(0); host.frame(MENTOR_JOIN_MS);
  state.near = []; state.fighting = true;
  host.frame(MENTOR_JOIN_MS + MENTOR_LEAVE_MS + 10);
  assert.equal(me._mentor?.level, 8, 'mid-fight: held');
  state.fighting = false;
  host.frame(MENTOR_JOIN_MS + MENTOR_LEAVE_MS + 20);
  assert.equal(me._mentor, null, 'the fight over: the partner long gone');
  // leaving the party is no change the fight holds: I am myself again the same frame (mutant: the party left unread)
  const r = rig();
  r.host.frame(0); r.host.frame(MENTOR_JOIN_MS);
  r.state.fighting = true; r.state.party = false;
  r.host.frame(MENTOR_JOIN_MS + 16);
  assert.equal(r.me._mentor, null, 'left the party mid-fight: ended at once');
});

test('MENTOR2 A: THE WIRING - the streaming host builds the mentor host over the party members drawn in my room (partyNear), outdoors by its feet, its fight by the mode\'s foes, and frames it from the party frame; PARTY-LOOT keeps the whole party\'s levels; the old per-frame block is gone (mutants: the whole party read; the frame call dropped)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const mentorHost = createMentorHost\(\{\n\s+player: \(\) => playerEntity, social: \(\) => social, near: \(\) => partyNear\(\),\n\s+outdoors: \(\) => _mode\(\) === 'exterior', feet: \(\) => player\.feetAt\?\.\(\) \?\? player\.pos,\n\s+fighting: \(\) => areEnemiesNearby\(enchantFoes\(\)\), chat: \(\) => chatLog,\n\s+\}\);/);
  assert.match(w, /const partyFrame = \(nowMs\) => \{\n[^\n]*\n\s+mentorHost\.frame\(nowMs\);/);
  assert.match(w, /partyLevels: \(\) => partyMateLevels\(\),/);
  assert.doesNotMatch(w, /refreshMentor\(|setFirmamentMentoring/);
});

// ── B: the powers at a share ────────────────────────────────────────

test('MENTOR2 B: THE SHARE - mentorScaled is the number at the power scale, whole outside mentoring; the Firmament scales its combat channels and leaves its life channels whole, by the share the host hands in (mutants: a life channel scaled; the combat ones whole; the share ignored)', () => {
  const e = body(30);
  assert.equal(mentorScaled(e, 20), 20, 'not mentoring: whole');
  e._mentor = mentorProfile(e, [5]);
  assert.equal(mentorScaled(e, 20), 20 * e._mentor.powerScale);
  setFirmamentOnline(true);
  // the Warrior's Gate of the Sign (+5% Strength and Endurance, combat) and Gentle Hands (the herbalist's, life)
  const tree = { start: 'wr.start', keys: [] };
  for (const want of ['wr.g', [...FIRM_NODES.values()].find((n) => n.name === 'Gentle Hands')?.key]) for (const k of pathTo(tree, want) ?? []) if (!tree.keys.includes(k)) tree.keys.push(k);
  setFirmamentTree(tree);
  const whole = treeStats(tree);
  const k = 0.5;
  const half = firmamentStatsAt(k);
  let combat = 0, life = 0;
  for (const [key, v] of Object.entries(whole)) {
    if (statDef(key)?.kind === 'life') { assert.equal(half[key], v, `${key} whole`); life++; } else { assert.equal(half[key], Math.round(v * k), `${key} at half`); combat++; }
  }
  assert.ok(combat > 0 && life > 0, `both kinds walked (${combat} combat, ${life} life)`);
  assert.deepEqual([whole['pct.strength'], half['pct.strength']], [5, 3], 'a five at half: three');
  assert.deepEqual(firmamentStatsAt(1), whole);
  setFirmamentMentorScale(0.5);
  assert.equal(firmamentMentorScale(), 0.5);
  setFirmamentMentorScale(2);
  assert.equal(firmamentMentorScale(), 1, 'never past whole');
});

test('MENTOR2 B: THE SOURCES - no power sleeps on `_mentor` any more: the paths\' awake gates, the Firmament\'s fight and life, the potency and the weapon\'s climb read the share or the mentored climb; the foes\' edge still reads none while mentoring (mutants: a gate put back; the edge woken)', () => {
  for (const f of ['src/systems/arcanePaths.js', 'src/systems/martialPaths.js', 'src/systems/firmamentPowers.js', 'src/systems/spell/spellPower.js']) {
    assert.doesNotMatch(read(f).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''), /_mentor\b/, `${f} gates nothing on mentoring`);
  }
  // the weapon's climb pays the mentored climb; WEAPON-GEAR's gear past 200 stays off for a mentor, its own arc's law
  const wm = read('src/systems/weaponMastery.js');
  assert.doesNotMatch(/export function weaponClimb[\s\S]*?\n\}/.exec(wm)[0], /_mentor\b/, 'the climb gates nothing on mentoring');
  assert.match(read('src/systems/skillSoftcap.js'), /entity\._mentor \|\| !masterSkillsActive\(entity\)\) return 0;[\s\S]*entity\._mentor \|\| !masterSkillsActive\(entity\)\) return 0;/, 'the edge and the veteran: none while mentoring');
  assert.match(read('src/systems/spell/spellPower.js'), /const climbed = fightingClimb\(caster, school\);/);
  assert.match(read('src/systems/weaponMastery.js'), /const c = fightingClimb\(entity, skill\);/);
  assert.equal((read('src/scenes/hostMagic.js').match(/effectiveLevel/g) ?? []).length, 0, 'every cast of mine at castingLevel');
});

// ── C: paid ─────────────────────────────────────────────────────────

const LB = SKILLS.LongBlade;
const career = buildCustomCareer({ name: 'Fighter', hp: 12, stats: STATS, skills: [LB, SKILLS.ShortBlade, SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.Archery, SKILLS.HandToHand, SKILLS.Dodging, SKILLS.CriticalStrike, SKILLS.Running, SKILLS.Jumping, SKILLS.Climbing, SKILLS.Swimming] });
function fighter(level, raw) {
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p._online = true; p.level = level; p.activeEffects = [];
  p.skills[LB] = 100; assert.equal(masterSkill(p, LB).ok, true); p.skills[LB] = raw;
  p.skillUses = new Array(35).fill(0);
  return p;
}
const progress = (p) => p.skillUses[LB] + (p.skillUseFrac?.[LB] ?? 0);

test('MENTOR2 C: THE MENTOR LEARNS FROM THE FIGHT THEY HAD - past 100 a foe is weighed against the skill the mentor fights with, so the group\'s foes teach a mentored master (they had taught nothing); never more than a fair foe of their own level (mutants: the real skill read; the mentored one read for the cost)', () => {
  const run = (p, level = 21) => { noteSkillChallenge(p, { level }); for (let i = 0; i < 10; i++) tallySkill(p, LB, 1); return progress(p); };
  const solo = fighter(30, 150);
  const mentor = fighter(30, 150);
  mentor._mentor = mentorProfile(mentor, [20]);
  assert.ok(mentoredSkill(mentor, 150) < 150);
  const s = run(solo), m = run(mentor);
  assert.ok(m > s && s > 0, `the group's foe teaches the mentor more than its real reading would (${m} > ${s})`);
  const own = run(fighter(30, 150), 30);
  assert.ok(own > m, `a fair foe of their own level still teaches more (${own} > ${m})`);
  const low = fighter(30, 150);
  low._mentor = mentorProfile(low, [5]);
  assert.equal(run(low, low._mentor.worldLevel), 0, 'beside a level 5: the group\'s foes are no match even for the mentored skill');
});

test('MENTOR2 C: THE PUPIL - a member far enough below a partner to be mentored trains MENTOR_PUPIL_TALLY times as fast below 100, whole uses with the fraction carried; never past 100; never without a mentor beside them (mutants: the bonus off; the fraction dropped; the bonus past 100)', () => {
  assert.equal(pupilMentorLevel(5, [30, 12, 9]), 30, 'the highest who mentors me');
  assert.equal(pupilMentorLevel(5, [9]), null, 'four levels: no mentor');
  const p = fighter(5, 40);
  assert.equal(refreshPupil(p, [30]), 'on');
  assert.deepEqual(p._pupil, { mentor: 30 });
  for (let i = 0; i < 10; i++) tallySkill(p, LB, 1);
  assert.equal(p.skillUses[LB], 12, 'ten uses beside a mentor: twelve');
  for (let i = 0; i < 2; i++) tallySkill(p, LB, 1);
  assert.equal(p.skillUses[LB], 14, 'the fraction carried: 2.4 more of 12');
  assert.equal(refreshPupil(p, []), 'off');
  tallySkill(p, LB, 5);
  assert.equal(p.skillUses[LB], 19, 'no mentor: whole uses as Daggerfall counts them');
  const master = fighter(5, 150);
  master._pupil = { mentor: 30 };
  tallySkill(master, LB, 1);
  assert.equal(progress(master), 0, 'past 100 the softcap\'s own law, no bonus (no foe: nothing)');
});

test('MENTOR2 C: THE SAVE - neither the mentor\'s profile nor the pupil\'s word nor its fraction is restored (mutants: the pupil restored)', () => {
  const p = fighter(5, 40);
  p._pupil = { mentor: 30 }; p._pupilFrac = new Array(35).fill(0.4);
  const back = structuredClone(playerEntity);
  restorePlayer(back, JSON.parse(JSON.stringify(snapshotPlayer(p))));
  assert.deepEqual([back._mentor, back._pupil, back._pupilFrac], [null, null, null]);
});

test('MENTOR2 C: THE LOOT GATE - the corpse\'s roll and the registry read the real level (a mentor is no young character); the corpse\'s items and the world stay the group\'s (mutants: the gate at the mentored level; the items at the real level)', () => {
  const c = read('src/scenes/hostCombat.js');
  assert.match(c, /level: lootGateLevel\(player\) \}\);/);
  assert.match(c, /\{ level: effectiveLevel\(player\), gender: player\.gender \}/);
  assert.match(c, /equipEnemy\(entity, mobileType, effectiveLevel\(player\), rolls, \{ player \}\)/);
  assert.match(read('src/systems/loot/lootPowers.js'), /return me \? lootGateLevel\(me\) : null;/);
});

// ── E: said ─────────────────────────────────────────────────────────

test('MENTOR2 E: THE WORDS - the status names the level fought at, the real one and the share; the pupil\'s line its bonus; the HUD\'s tile and card; the party\'s note; a member\'s level beside their place (mutants: the share unsaid; the pupil unsaid; the level unsaid)', () => {
  const e = body(30);
  assert.match(mentorStatusText(e), /^Not mentoring\./);
  assert.equal(mentorHudTile(e), null);
  assert.equal(mentorPartyNote(e), null);
  e._mentor = mentorProfile(e, [5]);
  const pct = Math.round(e._mentor.powerScale * 100);
  assert.equal(mentorStatusText(e), `Mentoring: you fight as level 8 (really 30). Your gear and powers act at ${pct}%. Your real progress is kept.`);
  assert.deepEqual(mentorHudTile(e), { name: 'Mentoring', foot: 'Lv 8', pupil: false });
  assert.equal(mentorPartyNote(e), mentorStatusText(e));
  const pupil = body(5, { _pupil: { mentor: 30 } });
  assert.equal(pupilStatusText(pupil), 'A mentor is beside you: your skills train 20% faster.');
  assert.deepEqual(mentorHudTile(pupil), { name: 'Mentored', foot: '+20%', pupil: true });
  assert.deepEqual(mentorTipCard(pupil), { meta: 'Mentor Mode', lines: [pupilStatusText(pupil)] });
  // the HUD: the tile, its glyph, its card
  const [tile] = statusTiles({ mentor: mentorHudTile(e) });
  assert.deepEqual([tile.key, tile.kind, tile.glyph, tile.name, tile.foot], ['mentor', 'buff', 'mentor', 'Mentoring', 'Lv 8']);
  assert.ok(Object.hasOwn(STATUS_GLYPHS, 'mentor'));
  assert.deepEqual(statusTip(tile, e), { title: 'Mentoring', meta: 'Mentor Mode', lines: [mentorStatusText(e)], foot: 'Lv 8' });
  assert.equal(levelShort(12), 'Lv 12');
  assert.equal(partyPoseText({ loc: 'Daggerfall', h: 50, hm: 60, cl: 12 }), 'Lv 12 - Daggerfall - 50/60 HP');
  assert.equal(partyPoseText({ loc: 'Daggerfall', h: 50, hm: 60 }), 'Daggerfall - 50/60 HP', 'a relay from before `cl`: no level');
  assert.match(read('src/ui/enhanced/enhancedHud.js'), /const mentor = mentorHudTile\(vitals\);\n\s+if \(mentor\) all\.unshift\(\.\.\.statusTiles\(\{ mentor \}\)\);/);
  assert.match(read('src/scenes/world.js'), /mentorNote: \(\) => mentorPartyNote\(playerEntity\),/);
});
