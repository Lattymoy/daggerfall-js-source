// QUEST-AUDIT IV (bible/01-Overview/audits/Quest-Audit-IV.md), the questlines' lanes: each fix held by a pin that fails on
// the code before it - the Old Coil's sea, a deed's return clock, the answers' width, the couriers met first, a named
// piece offered, the Hour broken first, the Festival's walk, the Herald's ladder, Imrah's books, the Warden's act, an
// unstamped step, a title held back, and the Sky-Ketch said.
import '../../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { lineById, lineStepOf } from '../../../src/systems/questlines/qlLines.js';
import { NEED_CHECKS, createLineRunner } from '../../../src/systems/questlines/qlLineRunner.js';
import { rollRewardChoice } from '../../../src/systems/questlines/qlRewards.js';
import { sheetFor } from '../../../src/systems/questlines/qlSheets.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { noteLadderDone } from '../../../src/systems/arena/arenaLadder.js';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
import { STAR_LIFE_MS } from '../../../src/net/starfall/starfallLaw.js';
import { createKetchClaims } from '../../../src/net/ketch/ketchClaims.js';
import { hearActs } from '../../../src/systems/questlines/qlActs.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { QUESTLINES_PREF } from '../../../src/systems/questlines/qlLaw.js';
import { patchWidthProblems } from '../../../tools/qlCheck.mjs';
import { ROOT } from '../../qlSources.mjs';
import { stepRig } from '../../qlStepRig.mjs';

const QUESTS = join(ROOT, 'src/systems/questlines/quests');
const script = (q) => readFileSync(join(QUESTS, `${q}.txt`), 'utf8');
const DAY = 86400;
afterEach(() => { setPref(QUESTLINES_PREF, true); noteLadderDone(null); });

test('QUEST-AUDIT IV B1: the Old Coil\'s berths and its Serpent wait on the sea - a step whose deed cannot be done never begins to fail (mutants: either need dropped)', () => {
  const steps = lineById('oldCoil').steps;
  assert.deepEqual(steps.map((s) => s.needs ?? []), [[], ['naval'], ['naval']]);
});

test('QUEST-AUDIT IV B2: a deed done late keeps its step - the 60-day clock stops at the deed and 30 days are given to come back, whose end says the deed was done (mutants: QLOC03\'s `stop timer _wait_`; its `_meet_`)', () => {
  const R = stepRig('QLOC03');
  R.tick(3);
  R.advance(4 * 3600);
  R.advance(55 * DAY);
  R.act('serpent-slain', 1);
  R.tick(4);
  R.advance(6 * DAY, 6);
  assert.equal(R.quest.questComplete, false, 'day 61, the serpent slain on day 55: still Hamid\'s to hear');
  R.advance(31 * DAY, 6);
  assert.equal(R.quest.questComplete, true, 'the return\'s own 30 days');
  assert.match(R.st.popups.at(-1), /sailed with the season/);
  // the other three deeds that ran under the same clock stop it and start their return
  for (const [q, deed] of [['QLHR02', '_broken_'], ['QLBD02', '_hasbook_'], ['QLCH02', '_haskey_']]) {
    const qbn = script(q).slice(script(q).search(/^QBN:/m));
    assert.match(qbn, /^Clock _meet_ 30\.00:00/m, `${q}: a return clock`);
    assert.match(qbn, /^_meet_ task:\n\tsay 1050\n\tend quest/m, `${q}: its end said`);
    const body = qbn.slice(qbn.indexOf(`${deed} task:`)).split(/\n\n/)[0];
    const late = /^_late_ task:\n\twhen _courier_ and _broken_\n\tstop timer _wait_/m.test(qbn);
    assert.ok(body.includes('start timer _meet_') && (body.includes('stop timer _wait_') || late), `${q}: ${deed} stops the wait and starts the return`);
  }
});

test('QUEST-AUDIT IV B3: every answer a line\'s script asks is one line of at most 30 characters - the classic pick list draws it unwrapped from x 86 (mutants: QLBD05\'s 1031 long again)', () => {
  const problems = [];
  for (const f of readdirSync(QUESTS).filter((n) => n.endsWith('.txt')).sort()) {
    problems.push(...patchWidthProblems(f.replace('.txt', ''), [{ old: '', new: readFileSync(join(QUESTS, f), 'utf8') }]).filter((p) => /answer/.test(p)));
  }
  assert.deepEqual(problems, []);
});

test('QUEST-AUDIT IV B4: a line\'s first courier is met for the first time - its letters are taken in hand since QL-OFFERED (mutants: QLBD02\'s "again"; QLWR03\'s "same boy")', () => {
  const courier = (q) => { const t = script(q); return t.slice(t.indexOf('Message:  1012'), t.indexOf('\n\n', t.indexOf('Message:  1012'))); };
  assert.doesNotMatch(courier('QLBD02'), /\bagain\b/);
  assert.doesNotMatch(courier('QLWR03'), /\bsame\b/);
});

test('QUEST-AUDIT IV B5: an ending that hands a named blade over offers it to any class that may wield it - the two best weapon skills choose the plain cards alone (mutants: drawNamed\'s skills the holder\'s)', () => {
  const skills = new Array(35).fill(20);
  skills[SKILLS.Archery] = 70;
  skills[SKILLS.HandToHand] = 60;
  const archer = { name: 'Hero', level: 20, career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills };
  const named = sheetFor('QLWR04').outcomes.find((o) => o.id === 'mercy').named;
  let offered = 0;
  for (let seed = 1; seed <= 20; seed++) if (rollRewardChoice({ seed, level: 20, tier: 4, entity: archer, named }).some((p) => p.named && p.item.name === named.name)) offered++;
  assert.equal(offered, 20);
});

test('QUEST-AUDIT IV B6: the Hour broken before the Prior is met - his answer pays at once, and the journal never sends the player back down (mutants: `_met_` without its click kept; `_clearclick_` without `not _broken_`; `_road_` logging regardless)', () => {
  const R = stepRig('QLHR02');
  R.tick(3);
  R.advance(4 * 3600);
  R.act('hour-broken', 1);
  R.tick(4);
  R.click('_prior_');
  R.tick(4);
  assert.equal(R.st.asked.length, 1, 'asked which power');
  R.answer(0);
  R.tick(8);
  assert.ok(R.quest.questComplete && R.quest.questSuccess, 'paid on the answer - no second visit');
  assert.ok(!R.log().some(([, id]) => id === 1020), '"Now I must reach the Hour" never filed');
});

test('QUEST-AUDIT IV C1: the Thirteenth of Frostfall\'s walk to the coven needs no Festival once the star is held, and the last night\'s star counts while it lives past the close (mutants: the step\'s `deed`; the needs check without it; the star\'s tail)', () => {
  assert.equal(lineById('thirteenthFrostfall').steps[0].deed, '_held_');
  const close = FESTIVALS[0].toMs;
  assert.equal(NEED_CHECKS.starfall(close), false, 'the line itself opens on the Festival\'s days alone');
  const tasks = new Map([['held', { getTriggerValue: () => true }]]);
  const q = { uid: 7, questName: 'QLTF01', questComplete: false, questTombstoned: false, shelvedAt: null, tasks, getTask: (s) => tasks.get(s.name) ?? null };
  const at = (ms) => {
    const shelved = [];
    const machine = { quests: new Map([[7, q]]), questsToInvoke: [], scheduleQuestByName: () => null, shelveQuest: (uid) => { shelved.push(uid); return { ok: true }; }, reclaimQuest: () => ({ ok: true }) };
    const runner = createLineRunner({ machine, service: null, nowMs: () => ms, ctx: { level: () => 20, online: () => true, nowSeconds: () => 1e6 } });
    runner.restore({ thirteenthFrostfall: { step: 0, outcomes: {}, done: false, wait: 0, claims: {}, begun: 1, lettered: 1, taken: true } });
    runner.look();
    return shelved;
  };
  assert.deepEqual(at(close + DAY * 1000), [], 'held: the walk to the coven is never set aside');
  tasks.clear();
  assert.deepEqual(at(close + STAR_LIFE_MS / 2), [], 'not held yet, the last star still alive: not set aside under it');
  assert.deepEqual(at(close + 2 * STAR_LIFE_MS), [7], 'not held, the last star faded: set aside until the Festival comes again');
});

test('QUEST-AUDIT IV C2: the Herald\'s Call is a registered account\'s, and waits on a bout the Herald still offers - a guest or a Grand Champion is never given a line that cannot end (mutants: `account`; the ladder\'s need)', () => {
  const l = lineById('introArena');
  assert.equal(l.opens.account, true);
  assert.deepEqual(l.steps.map((s) => s.needs), [['arenaLadder'], ['arenaLadder']]);
  assert.equal(NEED_CHECKS.arenaLadder(), true, 'no climb heard: the ladder is open');
  noteLadderDone({ v: 1, tier: 9, won: 3, paid: 3, champs: [], grand: true, record: {} });
  assert.equal(NEED_CHECKS.arenaLadder(), false, 'the Grand Champion beaten');
});

test('QUEST-AUDIT IV C3: Imrah\'s two books are the player\'s to keep - each made permanent where it is handed over (mutants: either `make ... permanent`)', () => {
  assert.match(script('QLSK01'), /\tget item _guide_\n\tmake _guide_ permanent\n/);
  assert.match(script('QLSK02'), /\tget item _thunder_\n\tmake _thunder_ permanent\n/);
});

test('QUEST-AUDIT IV C4: the Tonal Warden\'s act is the character\'s that fought - one switched away is owed it, said when they stand again (mutants: the act said to whoever stands; the owed act never paid)', () => {
  const heard = [];
  hearActs('qa4', (kind) => heard.push(kind));
  try {
    let who = 'ch-b', ms = 1e6;
    const store = new Map([['kt.ketchActs', [{ ch: 'ch-a' }]]]);
    const claims = createKetchClaims({ claim: async () => ({}), store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, who: () => who, nowMs: () => ms });
    claims.tick();
    assert.deepEqual(heard, [], 'ch-b hears nothing of ch-a\'s Warden');
    who = 'ch-a';
    ms += 5000;
    claims.tick();
    assert.deepEqual(heard, ['warden-felled'], 'said once ch-a stands');
    assert.deepEqual(claims.owed(), []);
    // the share's act goes through the owing door, and a kept receipt carries the character it came to
    const src = readFileSync(join(ROOT, 'src/net/ketch/ketchClaims.js'), 'utf8');
    assert.match(src, /keep\(kept\(\)\.map\(\(k\) => \(k\.r === r \? \{ \.\.\.k, a: 1 \} : k\)\)\); owe\(e\); \}/);
    assert.match(src, /const owe = \(e\) => \{ if \(!e\.ch \|\| e\.ch === who\(\)\) noteAct\('warden-felled'\); else keepOwed/);
    assert.match(src, /\{ r, cid: cid\(\), \.\.\.\(typeof character === 'string' && character \? \{ ch: character \} : \{\}\) \}/);
  } finally { hearActs('qa4', null); }
});

test('QUEST-AUDIT IV D1: a line\'s step is stamped whatever the switch says when it starts - its acts heard and its end moving the line (mutants: stamp under the switch alone; the unstamped end ignored)', () => {
  const R = stepRig('QLIT01', { on: false });
  assert.ok(lineStepOf('QLIT01'));
  assert.ok(R.quest.ql, 'stamped at its start, the switch off');
  R.quest.ql = null;   // a save from before: its step kept unstamped
  R.tick(1);
  assert.ok(R.quest.ql, 'stamped at the next look');
  const src = readFileSync(join(ROOT, 'src/systems/questlines/qlLayer.js'), 'utf8');
  assert.match(src, /if \(!isStamped\(quest\)\) \{ if \(lineStepOf\(quest\?\.questName\)\) runner\.ended\(quest, null\); return null; \}/);
  assert.match(src, /if \(quest\.ql == null && !quest\.questComplete && !quest\.questTombstoned && lineStepOf\(quest\.questName\)\) quest\.ql = layer\.stamp\(quest\);/);
});

test('QUEST-AUDIT IV D2, D3: a step the service pays by the line before (the Covens\' Hoard\'s) holds the title back until it pays - and the page names the Sky-Ketch among the witnessed places (mutants: `waits`; the Ketch\'s words)', () => {
  const machine = { quests: new Map(), questsToInvoke: [], scheduleQuestByName: () => null };
  const runner = createLineRunner({ machine, service: null, nowMs: () => 0, ctx: { level: () => 20, online: () => true, nowSeconds: () => 1e6 } });
  runner.restore({ covensHoard: { step: 3, outcomes: { 2: { id: 'keep', text: 'kept' } }, done: true, wait: 0, claims: { 0: 'opened', 1: 'opened', 2: 'unseen' }, begun: 1, lettered: 1, taken: true } });
  const row = runner.rows().find((r) => r.id === 'covensHoard');
  assert.deepEqual(row.steps.map((s) => !!s.waits), [false, false, true]);
  const page = readFileSync(join(ROOT, 'src/ui/questlines/qlJournal.js'), 'utf8');
  assert.match(page, /unseen \|\| \(line\.steps \?\? \[\]\)\.some\(\(s\) => s\.waits\) \? t\('ql\.journal\.lineTitleWaits'/);
  assert.match(page, /against the Sea Serpent, aboard the Sky-Ketch or at a fallen star\. The account service/);
});
