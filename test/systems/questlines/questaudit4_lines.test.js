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
import { noteLadderDone, ladderDoneFor, _forgetLaddersForTests } from '../../../src/systems/arena/arenaClimbSeen.js';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
import { STAR_LIFE_MS } from '../../../src/net/starfall/starfallLaw.js';
import { createKetchClaims } from '../../../src/net/ketch/ketchClaims.js';
import { hearActs } from '../../../src/systems/questlines/qlActs.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { QUESTLINES_PREF } from '../../../src/systems/questlines/qlLaw.js';
import { patchWidthProblems } from '../../../tools/qlCheck.mjs';
import { qlLineDetail } from '../../../src/ui/questlines/qlJournal.js';
import { fakePage } from '../../hudPage.mjs';
import { ROOT, packMachine, parsedQuest } from '../../qlSources.mjs';
import { stepRig } from '../../qlStepRig.mjs';

const QUESTS = join(ROOT, 'src/systems/questlines/quests');
const script = (q) => readFileSync(join(QUESTS, `${q}.txt`), 'utf8');
const DAY = 86400;
afterEach(() => { setPref(QUESTLINES_PREF, true); _forgetLaddersForTests(); });

test('QUEST-AUDIT IV B1: the Old Coil\'s berths and its Serpent wait on the sea - a step whose deed cannot be done never begins to fail (mutants: either need dropped; QLOC03\'s deed)', () => {
  const steps = lineById('oldCoil').steps;
  assert.deepEqual(steps.map((s) => s.needs ?? []), [[], ['naval'], ['naval']]);
  assert.equal(steps[2].deed, '_slain_', 'AUDIT QA4 C4: the Serpent slain, the walk to Hamid\'s tavern needs no sea');
});

test('QUEST-AUDIT IV B2: a deed done late keeps its step - the 60-day clock stops at the deed and 30 days are given to come back, whose end says the deed was done (mutants: QLOC03\'s `_meet_` unstarted; its `_gone_` on `_meet_` alone; the late outcome dropped)', () => {
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
  assert.match(R.st.popups.at(-1), /sailed with the season\. He may send for you again\./, 'AUDIT QA4 C2: never final - the line offers the step again');
  assert.equal(R.quest.ql.outcome, 'late', 'AUDIT QA4 C1: the sheet\'s late end, never "gone down for the season"');
  // AUDIT QA4 C5: a deed done early keeps the 60 days - the later of the two clocks ends it
  const E = stepRig('QLOC03');
  E.tick(3);
  E.advance(4 * 3600);
  E.advance(2 * DAY);
  E.act('serpent-slain', 1);
  E.tick(4);
  E.advance(33 * DAY, 6);
  assert.equal(E.quest.questComplete, false, 'slain on day 2: day 35 is still inside the 60');
  E.advance(26 * DAY, 6);
  assert.equal(E.quest.questComplete, true);
  // the other three deeds that ran under the same clock stop it and start their return
  for (const [q, deed] of [['QLHR02', '_broken_'], ['QLBD02', '_hasbook_'], ['QLCH02', '_haskey_']]) {
    const qbn = script(q).slice(script(q).search(/^QBN:/m));
    assert.match(qbn, /^Clock _meet_ 30\.00:00/m, `${q}: a return clock`);
    assert.match(qbn, new RegExp(`^_lapsed_ task:\\n\\twhen _wait_ and not ${deed}\\n\\tsay 1003\\n\\tend quest`, 'm'), `${q}: the 60 days end it only undone`);
    assert.match(qbn, /^_gone_ task:\n\twhen _wait_ and _meet_\n\tsay 1050\n\tend quest/m, `${q}: done, the later of the two clocks ends it`);
    const body = qbn.slice(qbn.indexOf(`${deed} task:`)).split(/\n\n/)[0];
    assert.ok(body.includes('start timer _meet_') && !body.includes('stop timer _wait_'), `${q}: ${deed} starts the return and leaves the wait`);
    assert.equal(sheetFor(q).outcomes.find((o) => o.id === 'late')?.on?.task, '_gone_', `${q}: the late end is the sheet's own`);
    assert.ok(sheetFor(q).outcomes.findIndex((o) => o.id === 'late') < sheetFor(q).outcomes.findIndex((o) => o.id === 'failed'), `${q}: before the catch-all`);
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

test('QUEST-AUDIT IV C2, AUDIT QA4 B1: the Herald\'s Call is a registered account\'s, and waits on a bout the Herald still offers - the climb\'s end kept by account, so another account never reads it and a page knows it before its board is asked (mutants: `account`; the ladder\'s need; the account unread; the device\'s memory unread)', () => {
  const l = lineById('introArena');
  assert.equal(l.opens.account, true);
  assert.deepEqual(l.steps.map((s) => s.needs), [['arenaLadder'], ['arenaLadder']]);
  const grand = { v: 1, tier: 9, won: 3, paid: 3, champs: [], grand: true, record: {} };
  assert.equal(NEED_CHECKS.arenaLadder(0, { account: 'acct-a' }), true, 'no climb heard: the ladder is open');
  noteLadderDone(grand, 'acct-a');
  assert.equal(NEED_CHECKS.arenaLadder(0, { account: 'acct-a' }), false, 'the Grand Champion beaten');
  assert.equal(NEED_CHECKS.arenaLadder(0, { account: 'acct-b' }), true, 'another account signed in reads its own');
  // a new page: the device remembers (appStorage - the page's localStorage)
  const kept = new Map();
  const was = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)) };
  try {
    noteLadderDone(grand, 'acct-c');
    _forgetLaddersForTests();
    assert.equal(ladderDoneFor('acct-c'), true, 'a page that never asked the board knows it');
    assert.equal(ladderDoneFor('acct-d'), false);
  } finally { globalThis.localStorage = was; }
  const src = readFileSync(join(ROOT, 'src/systems/questlines/qlLineRunner.js'), 'utf8');
  assert.match(src, /NEED_CHECKS\[n\]\?\.\(nowMs\(\), \{ account: service\?\.account\?\.\(\) \?\? null \}\)/, 'the runner asks for the signed-in account');
});

test('QUEST-AUDIT IV C3: Imrah\'s two books are the player\'s to keep - each made permanent where it is handed over (mutants: either `make ... permanent`)', () => {
  assert.match(script('QLSK01'), /_book_ task:\n\tget item _guide_\n\n/, 'the guide is the step\'s while it runs (AUDIT QA4 C3: a retaken step never doubles it)');
  assert.match(script('QLSK01'), /_paid_ task:\n\twhen _clicked_ and _boarded_\n\tsay 1013\n\tmake _guide_ permanent\n/, 'and the player\'s once paid');
  assert.match(script('QLSK02'), /\tget item _thunder_\n\tmake _thunder_ permanent\n/);
});

test('QUEST-AUDIT IV C4: the Tonal Warden\'s act is the character\'s the receipt came to - one switched away is owed it, said when they stand again (mutants: the act said to whoever stands; the owed act never paid; an owed act kept for ever)', () => {
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
    // AUDIT QA4 B5: an act owed a character that never stands again is let go after a week
    store.set('kt.ketchActs', [{ ch: 'gone', at: ms - 8 * DAY * 1000 }, { ch: 'here-soon', at: ms }]);
    assert.deepEqual(claims.owed().map((o) => o.ch), ['here-soon']);
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

test('QUEST-AUDIT IV D2, D3, AUDIT QA4 B4, C7: a step the service pays by the line before (the Covens\' Hoard\'s) holds the title back until it pays, the page naming that line - and the page names the Sky-Ketch among the witnessed places, an Abyss Dungeon\'s Hour by its name (mutants: `waits`; the line before unnamed; the Ketch\'s words)', () => {
  const machine = { quests: new Map(), questsToInvoke: [], scheduleQuestByName: () => null };
  const runner = createLineRunner({ machine, service: null, nowMs: () => 0, ctx: { level: () => 20, online: () => true, nowSeconds: () => 1e6 } });
  runner.restore({ covensHoard: { step: 3, outcomes: { 2: { id: 'keep', text: 'kept' } }, done: true, wait: 0, claims: { 0: 'opened', 1: 'opened', 2: 'unseen' }, begun: 1, lettered: 1, taken: true } });
  const row = runner.rows().find((r) => r.id === 'covensHoard');
  assert.deepEqual(row.steps.map((s) => !!s.waits), [false, false, true]);
  assert.equal(row.after, lineById('burningDoors').title());
  const words = (box) => box.textContent ?? '';
  const page = words(qlLineDetail(fakePage(), row, { titleText: (k) => k }));
  assert.match(page, new RegExp(`The title covenbane waits until the account service has seen every deed of ${row.after}\\.`));
  const witnessed = words(qlLineDetail(fakePage(), { ...lineById('burningDoors'), title: 'x', lead: 'x', giver: 'x', state: 'running', steps: [{ quest: 'QLBD03', title: 'x', state: 'next', witnessed: true }] }));
  assert.match(witnessed, /or an Abyss Dungeon.s Shattered Hour\. Others are the Sea Serpent, the Sky-Ketch and the fallen stars\./);
});

test('AUDIT QA4 B2: an act a step set aside out of season waits on takes the step back, so a star held as it faded and counted late is heard - never an act it does not wait on, never a step the player set aside (mutants: the wake unread by the act; any kind wakes it; the player\'s own aside woken)', () => {
  const q = parsedQuest('QLTF01', packMachine()).quest;
  q.shelvedAt = 1;
  const reclaimed = [];
  const machine = { quests: new Map([[q.uid, q]]), questsToInvoke: [], scheduleQuestByName: () => null, reclaimQuest: (uid) => { reclaimed.push(uid); q.shelvedAt = null; return { ok: true }; } };
  const runner = createLineRunner({ machine, service: null, nowMs: () => 0, ctx: { level: () => 20, online: () => true, nowSeconds: () => 1e6 } });
  const rec = (aside) => ({ thirteenthFrostfall: { step: 0, outcomes: {}, done: false, wait: 0, claims: {}, begun: 1, lettered: 1, taken: true, aside } });
  runner.restore(rec(false));
  assert.equal(runner.wakeAside(q, 'star-held'), false, 'the player\'s own aside stays theirs');
  runner.restore(rec(true));
  assert.equal(runner.wakeAside(q, 'fish-caught'), false, 'an act it does not wait on');
  assert.equal(runner.wakeAside(q, 'star-held'), true);
  assert.deepEqual(reclaimed, [q.uid]);
  assert.equal(runner.lineState('thirteenthFrostfall').aside, false);
  const src = readFileSync(join(ROOT, 'src/systems/questlines/qlLayer.js'), 'utf8');
  assert.match(src, /if \(quest\.shelvedAt != null && !runner\.wakeAside\(quest, kind\)\) continue;/);
});
