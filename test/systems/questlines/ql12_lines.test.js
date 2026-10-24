// QL12-QL16 (bible/06-Systems/Questlines-Arc.md section 4): THE QUESTLINES. Each line's steps are the port's own scripts
// (systems/questlines/quests/<QUEST>.txt) on DFU's machine, so the pins hold each as the sheets' pins hold DFU's: it is
// in the pack, it parses with every line claimed by a template, its title is its step's, every message it names is
// written, every act it waits on is one the features say (qlActs.js). A step the service witnesses waits on the act its
// receipt is (net/questlineClaims.js); the Covens' Hoard's key is kept by the outcome the service reads. And the
// runner (qlLineRunner.js): a line opens at its gate, its steps start one after another, a failed step comes again, the
// service is asked at a witnessed step's start and end, and a load asks again what it never answered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { QL_LINES, lineById, lineStepOf, lineOpens, opensWords } from '../../../src/systems/questlines/qlLines.js';
import { createLineRunner, STEP_GAP_S, RETRY_GAP_S, CLAIM_RETRY_MS, NEED_CHECKS } from '../../../src/systems/questlines/qlLineRunner.js';
import { LOOT_RARITY_KEY } from '../../../src/systems/loot/lootRarity.js';
import { KINGS_GAMBIT_KEY } from '../../../src/systems/features.js';
import { setSigilOnline, setSigilRenown } from '../../../src/systems/sigil/sigil.js';
import { REVENANT_MIN_RENOWN } from '../../../src/systems/revenant/revenant.js';
import { QL_SERVICE_LINES, QL_WITNESS_KINDS, qlClaimOf, qlStepClaimed, QL_TITLES } from '../../../src/net/questlineClaims.js';
import { ACT_KINDS } from '../../../src/systems/questlines/qlActs.js';
import { sheetFor } from '../../../src/systems/questlines/qlSheets.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { QUESTLINES_PREF } from '../../../src/systems/questlines/qlLaw.js';
import { QUEST_FILES, packMachine, parsedQuest } from '../../qlSources.mjs';

/** The act a witness's receipt is, and how many of it the step asks (the script's `ql act <kind> <n>`). */
const WITNESS_ACT = Object.freeze({
  rite: ['rite-broken', 1], breach: ['breach-closed', 1], redoubt: ['redoubt-taken', 1], redoubts3: ['redoubt-taken', 3],
  valkynaz: ['valkynaz-felled', 1], hour: ['hour-broken', 1], serpent: ['serpent-slain', 1],
  star: ['star-held', 1], stars3: ['star-held', 3],   // PIN MOVED (STAR8): the fallen stars
  ketch: ['warden-felled', 1],   // PIN MOVED (KETCH): the Tonal Warden felled
});

const scriptText = (name) => readFileSync(QUEST_FILES.get(name.toUpperCase()).path, 'utf8');
const qbnOf = (text) => text.slice(Math.max(0, text.search(/^\s*QBN:/im)));

test('QL12 the lines: ids unique, every step its own quest, the service\'s lines the registry\'s with as many steps', () => {
  assert.equal(new Set(QL_LINES.map((l) => l.id)).size, QL_LINES.length);
  const quests = QL_LINES.flatMap((l) => l.steps.map((s) => s.quest));
  assert.equal(new Set(quests).size, quests.length, 'no quest is two steps');
  for (const q of quests) assert.match(q, /^QL[A-Z]{2}\d{2}$/, `${q}: the questlines' own names`);
  for (const [id, svc] of Object.entries(QL_SERVICE_LINES)) {
    const l = lineById(id);
    assert.ok(l, `${id}: the service pays a line the registry holds`);
    assert.equal(l.steps.length, svc.steps, `${id}: as many steps on both ends`);
    for (const k of Object.values(svc.witness)) assert.ok(QL_WITNESS_KINDS.includes(k), `${id}: ${k}`);
    assert.ok(l.opens.online, `${id}: a line the service pays opens only where it answers`);
  }
  assert.equal(new Set(QL_TITLES).size, QL_TITLES.length, 'a title a line');
  for (const l of QL_LINES) {
    assert.ok(l.title() && l.lead() && l.giver(), `${l.id}: its words`);
    for (let i = 0; i < l.steps.length; i++) assert.deepEqual(lineStepOf(l.steps[i].quest), { line: l, index: i });
  }
});

test('QL12 each step\'s script: in the pack, parsed with every line claimed, its title its step\'s, every message it names written', () => {
  const machine = packMachine();
  const problems = [];
  for (const l of QL_LINES) {
    for (const s of l.steps) {
      const f = QUEST_FILES.get(s.quest);
      if (!f || f.dir !== 'questlines') { problems.push(`${s.quest}: no script in systems/questlines/quests`); continue; }
      const p = parsedQuest(s.quest, machine);
      if (!p) { problems.push(`${s.quest}: does not parse`); continue; }
      if (p.quest.displayName !== s.title()) problems.push(`${s.quest}: DisplayName "${p.quest.displayName}" is not its step's "${s.title()}"`);
      for (const t of p.quest.tasks.values()) for (const line of t.pendingActionLines ?? []) problems.push(`${s.quest}: no template claims "${String(line).trim()}"`);
      const text = scriptText(s.quest);
      const written = new Set([...text.matchAll(/^\s*(?:Message:\s*(\d+)|[A-Za-z]+:\s*\[(\d+)\])\s*$/gm)].map((m) => Number(m[1] ?? m[2])));
      const qbn = qbnOf(text);
      const named = [
        ...[...qbn.matchAll(/\b(?:say|log|notify|used|anyInfo|rumors|ask|choices)\s+(\d{4})\b/g)].map((m) => Number(m[1])),
        ...[...qbn.matchAll(/\bchoices((?:\s+\d{4}\s+_[A-Za-z0-9.]+_)+)/g)].flatMap((m) => [...m[1].matchAll(/(\d{4})/g)].map((x) => Number(x[1]))),
      ];
      for (const id of new Set(named)) if (!written.has(id)) problems.push(`${s.quest}: names message ${id}, which it does not write`);
      if (!sheetFor(s.quest)) problems.push(`${s.quest}: no sheet`);
    }
  }
  assert.deepEqual(problems, []);
});

test('QL11/QL12 every act a line\'s script waits on is one the features say; a witnessed step waits on its receipt\'s act', () => {
  const problems = [];
  for (const l of QL_LINES) {
    l.steps.forEach((s, i) => {
      if (!QUEST_FILES.has(s.quest)) return;   // the script pin names it
      const qbn = qbnOf(scriptText(s.quest));
      const acts = [...qbn.matchAll(/^\s*ql act ([a-z0-9-]+) (\d+)\s*$/gm)].map((m) => [m[1], Number(m[2])]);
      for (const [kind] of acts) if (!Object.hasOwn(ACT_KINDS, kind)) problems.push(`${s.quest}: waits on "${kind}", which no feature says`);
      const w = QL_SERVICE_LINES[l.id]?.witness?.[i];
      if (w) {
        const [kind, n] = WITNESS_ACT[w];
        if (!acts.some(([k, c]) => k === kind && c >= n)) problems.push(`${s.quest}: witnessed by ${w}, so it waits on "ql act ${kind} ${n}"`);
      }
    });
  }
  assert.deepEqual(problems, []);
});

test('QL13 the Covens\' Hoard\'s key: kept by the outcome the service reads, and only behind the Burning Doors witnessed whole', () => {
  const svc = QL_SERVICE_LINES.covensHoard;
  const step = lineById('covensHoard').steps[svc.key.at];
  const sheet = sheetFor(step.quest);
  assert.ok(sheet, `${step.quest}: its sheet`);
  const ids = (sheet?.outcomes ?? []).filter((o) => !o.failure).map((o) => o.id);
  assert.ok(ids.includes(svc.key.choice), `the outcome "${svc.key.choice}" keeps the key`);
  assert.ok(ids.some((id) => id !== svc.key.choice), 'and another gives it up');
  assert.equal(svc.after, 'burningDoors', 'the Burning Doors witnessed whole (AUDIT QUESTLINES SERVICE-4: its title held, never its breach alone)');
  assert.equal(QL_SERVICE_LINES.burningDoors.title, 'doorwarden');
  assert.deepEqual(QL_SERVICE_LINES.burningDoors.witness, { 2: 'rite', 3: 'breach' });
});

// ═══ AUDIT QUESTLINES (LINES-4, -8, -9, -10, -23, -24, -26, -27, ACTS-7): THE SCRIPTS' WORDS AND PAY, HELD TO THE WORLD ═══

/** A step's script on the real bridge as the game drives it: the pack's own source, the player's pack (a quest item given
 *  is carried), the town and the sky's hour the host's (noon). The world's own part - an NPC stood at a place - is done by
 *  hand, as ql4_branches' gargoyle is; every other line runs as written. */
async function stepOnBridge(name, { inTown = true } = {}) {
  const { createQuestBridge } = await import('../../../src/scenes/quest/questBridge.js');
  const { questSource, loadTables } = await import('../../qlSources.mjs');
  const { questlinesOn } = await import('../../../src/systems/questlines/qlLaw.js');
  loadTables();
  setPref(QUESTLINES_PREF, true);
  const st = { s: 400 * 86400 + 12 * 3600, inTown, pack: new Set(), asked: [], rewards: [], offers: [] };
  const bridge = createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n) => questSource(n, questlinesOn()) },
    classicSeconds: () => st.s, skySeconds: () => st.s, worldSeconds: () => st.s, isPlayerInTown: () => st.inTown, questlineService: null,
    playerEntity: { name: 'Hero', level: 20, gender: 'female', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30) },
    showChoice: (_q, message, choices, respond) => st.asked.push({ message, choices, respond }),
    giveItemToPlayer: (item) => st.pack.add(item),
    carriesQuestItem: (res) => !!res && st.pack.has(res.daggerfallUnityItem),
    offerReward: (_q, item) => st.rewards.push(item),
    onQuestlineOffer: (o) => st.offers.push(o),
    onQuestStarted: (q) => { for (const task of q.tasks.values()) for (const a of task.actions) if ((a.constructor?.typeName ?? a.typeName) === 'PlaceNpc') a.isComplete = true; },
  });
  const quest = bridge.machine.startQuestByName(name);
  const tick = (n = 1) => { for (let i = 0; i < n; i++) bridge.machine.tick(); };
  const words = (id) => quest.getMessage(id).getTextTokens(-1, () => 0, false).map((x) => x.text).join(' ').replace(/\s+/g, ' ');
  return { bridge, quest, st, tick, words };
}

test('AUDIT QUESTLINES LINES-4: the Covens\' Hoard kept pays the Guild\'s fee in gold, as the seal does - the Weir Key is the account\'s, once, so the keep is never paid by the key alone - and Ysolde says so before the choice and after it, never handing over a key the script cannot promise (mutants: `ql paid` back on the keep path; 1030 without the house\'s once; 1040\'s "slides the key across")', async () => {
  const { quest, st, tick, words } = await stepOnBridge('QLCH03');
  tick(2);
  for (const r of quest.resources.values()) if (r.isPerson && r.symbol?.name === 'ysolde') r.setPlayerClicked();
  tick(2);
  assert.equal(st.asked.length, 1, 'asked once');
  assert.equal(st.asked[0].message.id, 1030);
  assert.match(words(1030), /gives a Spire key to a house once/, 'the house\'s once, said before the choice');
  st.asked[0].respond(0);   // keep
  tick(6);
  assert.ok(quest.questComplete && quest.questSuccess);
  assert.equal(quest.ql.outcome, QL_SERVICE_LINES.covensHoard.key.choice, 'the outcome the service pays the key on');
  assert.equal(st.rewards.length, 1, 'the Guild\'s fee, in gold - whatever the service answers of the key');
  assert.equal(st.offers.length, 1, 'and the choice of gear');
  assert.doesNotMatch(words(1040), /slides the key/);
  assert.match(words(1040), /A house has it once/);
  // PIN MOVED (AUDIT QUESTLINES VOICE-QL): the house's once said as a sentence of its own, no dash aside (Voice.md rule 5)
  assert.match(sheetFor('QLCH03').outcomes.find((o) => o.id === 'keep').text, /A house is given that key only once/);
});

test('AUDIT QUESTLINES LINES-8, ACTS-7: the watch\'s letter waits for a town by day, as a courier\'s does, and the purse and the end wait for the letter - a revenant that kneels in the wild ends nothing there; the sheet\'s word is heard when they are (mutants: the purse and the end in the letter\'s own tick; the word bound to `_heard_`)', async () => {
  const { bridge, quest, st, tick } = await stepOnBridge('QLIW02', { inTown: false });
  tick(2);
  bridge.questlines.act('revenant-knelt', 1);
  tick(2);
  st.s += 2 * 3600;   // the word's clock (half an hour to an hour and a half) run out - still in the wild, by day
  tick(8);
  assert.equal(quest.questComplete, false, 'nothing ends in the wild');
  assert.equal(st.rewards.length, 0, 'no purse before the letter');
  assert.ok(![...st.pack].some((it) => it.questSymbol?.name === 'thanks'));
  st.inTown = true;
  tick(600);   // a courier's 40 to 500 ticks, in a town (GivePc.cs:96)
  assert.ok([...st.pack].some((it) => it.questSymbol?.name === 'thanks'), 'the letter in the pack');
  assert.equal(st.rewards.length, 1, 'then the purse');
  assert.ok(quest.questComplete && quest.questSuccess);
  assert.equal(quest.ql.outcome, 'done');
  const sheet = sheetFor('QLIW02');
  assert.deepEqual(sheet.objectives.find((o) => o.id === 'word').done, { task: '_paid_' }, 'the word heard with the letter and the purse');
  assert.match(sheet.objectives.find((o) => o.id === 'kneel').text, /brought to its knees/, 'ACTS-7: it kneels whoever struck it');
});

/** The purse a step draws from, by its line's tier (the writers' brief, "REWARDS"); the outcome's pay scales it (qlRewards.js). */
const GOLD_BAND = Object.freeze({ 1: [100, 200], 2: [200, 400], 3: [300, 600], 4: [500, 900] });
/** A script's words a player reads: its QRC, comments left out. */
const qrcWords = (text) => text.slice(0, Math.max(0, text.search(/^\s*QBN:/im))).split(/\r?\n/).filter((l) => !/^\s*--/.test(l)).join('\n');
/** A sheet's words a player reads. */
const sheetWords = (q) => {
  const s = sheetFor(q);
  return [...(s?.objectives ?? []).map((o) => o.text), ...(s?.branches ?? []).flatMap((b) => [b.text, ...b.choices.map((c) => c.text)]), ...(s?.outcomes ?? []).map((o) => o.text)].join('\n');
};
/** A script's messages by id, each its lines. */
const messagesOf = (text) => {
  const map = new Map();
  let id = null;
  for (const line of qrcWords(text).split(/\r?\n/)) {
    const h = /^\s*(?:Message:\s*(\d+)|[A-Za-z]+:\s*\[(\d+)\])\s*$/.exec(line);
    if (h) { id = Number(h[1] ?? h[2]); map.set(id, []); } else if (id != null) map.get(id).push(line);
  }
  return map;
};
const personsOf = (text) => new Set([...qbnOf(text).matchAll(/^\s*Person (_[a-zA-Z0-9]+_)/gm)].map((m) => m[1]));

test('AUDIT QUESTLINES LINES-9, -10, -23, -24, -27, ACTS-7: the lines\' words hold to the world they run in - no year named but the Spire\'s fall (the online calendar runs a year a month), no years counted on the Weir Road, Corvane never "always" at a tavern a step moves, no giver asks for "tomorrow" (the next step is an hour off), a later introduction\'s giver new, the Covenant never the Order\'s, a revenant brought to its knees, every purse its tier\'s band (mutants: QLWR04\'s "3E 406"; QLWR02\'s "eight years"; QLWR01\'s "I am always here"; QLIT01\'s "Ask me about it tomorrow"; QLIP02\'s "_crafter_, the court crafter"; QLBD05\'s "keepers of the Covenant"; QLIW02\'s "Beat a revenant"; QLBD01\'s 150 to 250)', () => {
  const problems = [];
  for (const l of QL_LINES) l.steps.forEach((s, i) => {
    if (!QUEST_FILES.has(s.quest)) return;   // the script pin names it
    const text = scriptText(s.quest);
    const flat = `${qrcWords(text)}\n${sheetWords(s.quest)}`.replace(/\s+/g, ' ');
    for (const m of flat.matchAll(/3E (\d+)/g)) if (m[1] !== '398') problems.push(`${s.quest}: names 3E ${m[1]} - the world's year runs on`);
    if (l.id === 'weirRoad') {
      for (const m of flat.matchAll(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+) years\b/gi)) problems.push(`${s.quest}: counts "${m[0]}" since the Spire fell`);
      if (/\balways (?:here|there)\b/i.test(flat)) problems.push(`${s.quest}: Corvane "always" at a tavern each step moves`);
    }
    if (/\b(?:ask|see|find|come to) me\b[^."]*\btomorrow\b/i.test(flat)) problems.push(`${s.quest}: a giver asks for tomorrow - the next step is an hour off`);
    if (/keepers? of the Covenant|kept the Covenant/i.test(flat)) problems.push(`${s.quest}: the Order of the Hour as the Covenant's keeper - it is the Emperors' blood's`);
    if (/\bbeat (?:a|one|your) revenant/i.test(flat)) problems.push(`${s.quest}: a revenant "beaten" by the player - it kneels whoever struck it`);
    if (l.group === 'intro' && i > 0) {
      const earlier = new Set(l.steps.slice(0, i).flatMap((p) => (QUEST_FILES.has(p.quest) ? [...personsOf(scriptText(p.quest))] : [])));
      const first = (messagesOf(text).get(1010) ?? []).join(' ').replace(/\s+/g, ' ');
      for (const m of first.matchAll(/(_[a-zA-Z0-9]+_), the /g)) if (earlier.has(m[1])) problems.push(`${s.quest}: ${m[1]} is made fresh, yet spoken of as the last step's`);
    }
    const g = /^\s*Item _gold_ gold range (\d+) to (\d+)/m.exec(qbnOf(text));
    const band = GOLD_BAND[l.tier];
    if (g && (Number(g[1]) !== band[0] || Number(g[2]) !== band[1])) problems.push(`${s.quest}: a purse of ${g[1]} to ${g[2]}, the tier-${l.tier} band ${band.join(' to ')}`);
  });
  assert.deepEqual(problems, []);
});

test('AUDIT QUESTLINES LINES-26: every letter a line hands over is named in the pack by who sent it - DFU names a quest letter by its last line (ItemHelper.cs:335-348, itemInfo.js questLetterName), so each ends on a sign-off naming its sender: a Person of its own, a name, or the line\'s giver (mutants: QLIA01\'s "Somebody always bleeds." last; QLHR01\'s "of the Order of the Hour" alone)', () => {
  const problems = [];
  for (const l of QL_LINES) for (const s of l.steps) {
    if (!QUEST_FILES.has(s.quest)) continue;
    const text = scriptText(s.quest);
    const persons = personsOf(text);
    const calling = l.giver().split(',')[0].replace(/^(?:a|an|the) /i, '').toLowerCase();
    for (const m of qbnOf(text).matchAll(/^\s*Item _[a-zA-Z0-9]+_ letter used (\d+)/gm)) {
      const last = (messagesOf(text).get(Number(m[1])) ?? []).map((x) => x.replace(/^<ce>/, '').trim()).filter(Boolean).at(-1) ?? '';
      const named = [...last.matchAll(/_[a-zA-Z0-9]+_/g)].some((x) => persons.has(x[0])) || /\b[A-Z][a-z]+ (?:al-)?[A-Z][a-z]+/.test(last) || last.toLowerCase().includes(calling);
      if (!named || /[.!?]$/.test(last)) problems.push(`${s.quest}: letter ${m[1]} reads "Letter: ${last}" in the pack`);
    }
  }
  assert.deepEqual(problems, []);
});

test('QL12 the claim\'s shape: a line the service pays, a step inside it, its phase (AUDIT QUESTLINES SERVICE-6), a plain choice - refused, never repaired', () => {
  assert.deepEqual(qlClaimOf({ line: 'burningDoors', step: 3, phase: 'open' }), { line: 'burningDoors', step: 3, phase: 'open', choice: null });
  assert.deepEqual(qlClaimOf({ line: 'covensHoard', step: 2, phase: 'end', choice: 'keep' }), { line: 'covensHoard', step: 2, phase: 'end', choice: 'keep' });
  for (const bad of [null, [], {}, { line: 'introSea', step: 0, phase: 'open' }, { line: 'burningDoors', step: 5, phase: 'open' }, { line: 'burningDoors', step: -1, phase: 'end' },
    { line: 'burningDoors', step: 1.5, phase: 'end' }, { line: 'burningDoors', step: '1', phase: 'end' }, { line: 'covensHoard', step: 2, phase: 'end', choice: 'KEEP' }, { line: '__proto__', step: 0, phase: 'open' },
    { line: 'burningDoors', step: 3 }, { line: 'burningDoors', step: 3, phase: 'shut' }]) {
    assert.equal(qlClaimOf(bad), null, JSON.stringify(bad));
  }
  assert.equal(qlStepClaimed('burningDoors', 0), false, 'a letter is the client\'s');
  assert.equal(qlStepClaimed('burningDoors', 2), true);
  assert.equal(qlStepClaimed('covensHoard', 2), true, 'the key\'s and the title\'s');
  assert.equal(qlStepClaimed('introSea', 0), false, 'an introduction pays nothing of the service\'s');
});

test('QL12 a line opens at its gate, and says what it waits on', () => {
  const l = lineById('covensHoard');
  const probe = (o) => ({ level: () => 20, online: () => true, lineDone: () => false, ...o });
  assert.equal(lineOpens(l, probe()), false, 'the Burning Doors first');
  assert.equal(lineOpens(l, probe({ lineDone: (id) => id === 'burningDoors' })), true);
  assert.equal(lineOpens(l, probe({ lineDone: () => true, online: () => false })), false, 'online alone');
  assert.equal(opensWords(l, probe()), 'Opens after The Burning Doors.');
  assert.equal(opensWords(lineById('burningDoors'), probe({ level: () => 3, online: () => false })), 'Opens at level 10, online.');
  assert.equal(opensWords(lineById('introCrafts'), probe({ level: () => 9 })), null);
});

/** A machine the runner can drive: quests by name, scheduled for the next tick as the real one does. */
function fakeMachine() {
  let uid = 1;
  const m = {
    quests: new Map(), questsToInvoke: [], scheduled: [],
    scheduleQuestByName(name) { const q = { uid: uid++, questName: name, questComplete: false, questTombstoned: false }; m.questsToInvoke.push(q); m.scheduled.push(name); return q; },
    tick() { for (const q of m.questsToInvoke.splice(0)) m.quests.set(q.uid, q); },
    end(name, success = true) { for (const q of m.quests.values()) if (q.questName === name && !q.questComplete) { q.questComplete = true; q.questSuccess = success; return q; } return null; },
  };
  return m;
}

function runnerWith({ level = 30, online = true, service = null } = {}) {
  setPref(QUESTLINES_PREF, true);
  const clock = { s: 1000, ms: 0 };
  const machine = fakeMachine();
  const honours = [];
  const runner = createLineRunner({
    machine, service, nowMs: () => clock.ms,
    ctx: { level: () => level, online: () => online, nowSeconds: () => clock.s, onHonour: (h) => honours.push(h), outcomeText: (q) => `${q.questName} ended` },
  });
  const step = () => { runner.look(); machine.tick(); };
  return { runner, machine, clock, honours, step };
}

test('QL12 the runner: a line opens, its first step starts once, the next an hour after it ends, the line done at its last', () => {
  const { runner, machine, clock, step } = runnerWith({ level: 2, online: false });
  step(); step();
  assert.deepEqual(machine.scheduled.filter((n) => n.startsWith('QLIT')), ['QLIT01'], 'started once, not every tick');
  assert.ok(!machine.scheduled.includes('QLBD01'), 'the Burning Doors: level 10, online');
  assert.ok(!machine.scheduled.includes('QLIP01'), 'the crafts: online - the Professions answer there');
  assert.ok(!machine.scheduled.includes('QLIS01'), 'the sea: level 5');
  const q = machine.end('QLIT01');
  assert.deepEqual(runner.ended(q, { id: 'done', failure: false }), { line: 'introTables', step: 0, moved: true, done: false });
  step();
  assert.ok(!machine.scheduled.includes('QLIT02'), 'not in the same breath');
  clock.s += STEP_GAP_S;
  step();
  assert.ok(machine.scheduled.includes('QLIT02'));
  const last = runner.ended(machine.end('QLIT02'), { id: 'done', failure: false });
  assert.equal(last.done, true);
  const row = runner.rows().find((r) => r.id === 'introTables');
  assert.equal(row.state, 'done');
  assert.deepEqual(row.steps.map((s) => s.state), ['done', 'done']);
  assert.equal(row.outcome, 'QLIT02 ended', 'the last step\'s outcome is the line\'s');
});

test('QL12 the runner: a step that ends badly is offered again a day later; a quest no line holds moves nothing', () => {
  const { runner, machine, clock, step } = runnerWith({ level: 2, online: false });
  step();
  const r = runner.ended(machine.end('QLIT01', false), { id: 'failed', failure: true });
  assert.equal(r.moved, false);
  clock.s += RETRY_GAP_S - 1; step();
  assert.equal(machine.scheduled.filter((n) => n === 'QLIT01').length, 1);
  clock.s += 1; step();
  assert.equal(machine.scheduled.filter((n) => n === 'QLIT01').length, 2, 'again');
  assert.equal(runner.ended({ questName: 'M0B00Y06', questSuccess: true }, null), null);
  assert.equal(runner.lineState('introTables').step, 0);
});

test('QL12 the runner, the switch off: no line opens (its quests would not be stamped)', () => {
  const { machine, step } = runnerWith({ level: 30 });
  setPref(QUESTLINES_PREF, false);
  step();
  assert.deepEqual(machine.scheduled, []);
  setPref(QUESTLINES_PREF, true);
});

test('QL12 the service: every step of a paid line opened at its start, a witnessed step\'s end claimed with its outcome; a title told once; an end not witnessed yet is `unseen` and asked again, and again after a load (AUDIT QUESTLINES SERVICE-2, LINES-11)', async () => {
  // the service as server-account/src/questlines.js answers: an `open` opens, an `end` looks for its receipt, the title
  // paid once
  let witnessNow = false;
  const serviceFor = (calls) => {
    let titled = false;
    return {
      account: () => 'acct',
      claim: async (body) => {
        calls.push(body);
        if (body.phase === 'open') return { ok: true, data: { opened: true } };
        if (!witnessNow) return { ok: true, data: { witnessed: false } };
        const title = body.step === 3 && !titled ? 'doorwarden' : undefined;
        if (title) titled = true;
        return { ok: true, data: { witnessed: true, ...(title ? { title } : {}) } };
      },
    };
  };
  const calls = [];
  const { runner, machine, clock, honours, step } = runnerWith({ level: 30, service: serviceFor(calls) });
  const settle = () => new Promise((r) => setImmediate(r));
  const walk = async (to) => {
    for (let i = 0; i < to; i++) {
      step(); await settle();
      runner.ended(machine.end(`QLBD0${i + 1}`), { id: 'done', failure: false });
      clock.s += STEP_GAP_S;
    }
    step(); await settle();
  };
  const bd = () => calls.filter((c) => c.line === 'burningDoors');
  await walk(2);   // the letter and the coven are the client's own; the rite's step opens
  assert.deepEqual(bd(), [0, 1, 2].map((s) => ({ line: 'burningDoors', step: s, phase: 'open' })), 'each step opened at its start - the first letter the witness\'s window');
  runner.ended(machine.end('QLBD03'), { id: 'done', failure: false });
  step(); await settle();
  assert.deepEqual(bd().at(-1), { line: 'burningDoors', step: 2, phase: 'end', choice: 'done' }, 'claimed at its end, with its outcome');
  assert.equal(runner.lineState('burningDoors').claims[2], 'unseen', 'not witnessed yet: asked again later');
  assert.equal(runner.rows().find((l) => l.id === 'burningDoors').steps[2].unseen, true);
  witnessNow = true;
  step(); await settle();
  assert.equal(bd().filter((c) => c.step === 2 && c.phase === 'end').length, 1, 'not before its minute');
  const save = runner.snapshot();
  // a load: the unanswered end asked again at once
  const calls2 = [];
  const again = runnerWith({ level: 30, service: serviceFor(calls2) });
  again.runner.restore(save);
  again.step(); await settle();
  assert.equal(calls2.filter((c) => c.line === 'burningDoors' && c.step === 2 && c.phase === 'end').length, 1, 'asked at the load');
  assert.equal(again.runner.lineState('burningDoors').claims[2], 'witnessed');
  // and the first page's own retry, its minute come
  clock.ms += CLAIM_RETRY_MS;
  step(); await settle();
  assert.equal(runner.lineState('burningDoors').claims[2], 'witnessed');
  assert.equal(runner.rows().find((l) => l.id === 'burningDoors').steps[2].unseen, false);
  // the breach: its end pays the title, told once
  clock.s += STEP_GAP_S; step(); await settle();
  runner.ended(machine.end('QLBD04'), { id: 'done', failure: false });
  step(); await settle();
  assert.deepEqual(honours, [{ line: 'burningDoors', title: 'doorwarden', key: false, keys: null, keyHeld: false }]);
});

test('QL12 the runner offline: an endgame line begun waits where it stood, and says why', () => {
  let online = true;
  setPref(QUESTLINES_PREF, true);
  const machine = fakeMachine();
  const clock = { s: 0 };
  const runner = createLineRunner({ machine, service: { account: () => 'a', claim: async () => ({ ok: true, data: { opened: true } }) }, ctx: { level: () => 30, online: () => online, nowSeconds: () => clock.s } });
  runner.look(); machine.tick();
  runner.ended(machine.end('QLBD01'), { id: 'met', failure: false });
  clock.s += STEP_GAP_S;
  online = false;
  runner.look(); machine.tick();
  assert.ok(!machine.scheduled.includes('QLBD02'));
  const row = runner.rows().find((r) => r.id === 'burningDoors');
  assert.equal(row.state, 'waiting');
  assert.equal(row.opens, 'Continues online.', 'AUDIT QUESTLINES UI-7 (PIN MOVED): a line begun continues - it never "Opens" again');
  assert.equal(row.honour, 'doorwarden');
  online = true;
  runner.look(); machine.tick();
  assert.ok(machine.scheduled.includes('QLBD02'));
});

test('QL1/QL12 an outcome settles at the end its script names: a failure clock\'s end is the sheet\'s `failed`, an act\'s is its own, and the step moves - or comes again', async () => {
  const { createQuestBridge } = await import('../../../src/scenes/quest/questBridge.js');
  const { questSource } = await import('../../qlSources.mjs');
  const { questlinesOn } = await import('../../../src/systems/questlines/qlLaw.js');
  setPref(QUESTLINES_PREF, true);
  const run = (finish) => {
    const offers = [];
    const bridge = createQuestBridge({
      data: { readListTable: () => null, getQuestSourceLines: (n) => questSource(n, questlinesOn()) },
      classicSeconds: () => 0, questlineService: null,
      playerEntity: { name: 'Hero', level: 8, gender: 'male', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30) },
      onQuestlineOffer: (o) => offers.push(o), offerReward: () => {},
    });
    const q = bridge.machine.startQuestByName('QLIA01');
    for (let i = 0; i < 3; i++) bridge.machine.tick();
    finish(bridge, q);
    for (let i = 0; i < 6; i++) bridge.machine.tick();
    return { q, offers };
  };
  const lost = run((b, q) => q.getTask({ name: 'wait' }).start());
  assert.ok(lost.q.questComplete);
  assert.equal(lost.q.ql.outcome, 'failed', 'the catch-all failure row, at the end its clock named');
  assert.equal(lost.offers.length, 0, 'a failure pays no gear');
  const won = run((b) => b.questlines.act('arena-won', 1));
  assert.equal(won.q.ql.outcome, 'won');
  assert.equal(won.offers.length, 1, 'the choice of three');
});

// ═══ AUDIT QUESTLINES (LINES, ACTS-2): the runner's gates, its stalls and its order ═══

test('AUDIT QUESTLINES ACTS-2, LINES-3, LINES-6: a step whose deed needs a switch that is off, or the Renown a revenant comes at, waits and says so - never started to fail every day; each need is one the runner can read (mutants: the needs unread; the line begun regardless; the Renown)', () => {
  assert.deepEqual(Object.keys(NEED_CHECKS).sort(), ['kingsGambit', 'lootRarity', 'naval', 'renown', 'starfall']);   // PIN MOVED (STAR8): the Starfall running
  for (const l of QL_LINES) for (const s of l.steps) for (const n of s.needs ?? []) assert.ok(n in NEED_CHECKS, `${s.quest} needs ${n}`);
  assert.deepEqual(QL_LINES.flatMap((l) => l.steps.filter((s) => s.needs).map((s) => `${s.quest}:${s.needs.join('+')}`)),
    ['QLTF01:starfall', 'QLTF03:starfall', 'QLIG01:lootRarity', 'QLIG02:lootRarity', 'QLIS01:naval', 'QLIS02:naval', 'QLIS03:naval', 'QLIT02:kingsGambit', 'QLIW02:renown']);   // PIN MOVED (STAR8): the Festival line's star steps
  // Loot rarity off: the Smith's Secrets never begins, and its row says why
  setPref(LOOT_RARITY_KEY, false);
  setPref(KINGS_GAMBIT_KEY, true);
  try {
    const { runner, machine, clock, step } = runnerWith({ level: 4, online: false });
    for (let i = 0; i < 4; i++) { step(); clock.s += STEP_GAP_S; }
    assert.ok(!machine.scheduled.includes('QLIG01'));
    assert.equal(runner.lineState('introGear'), null, 'not begun - its first step\'s need is the line\'s gate');
    assert.deepEqual(['state', 'opens'].map((k) => runner.rows().find((l) => l.id === 'introGear')[k]), ['locked', 'Opens with Loot rarity on.']);
    setPref(LOOT_RARITY_KEY, true);
    step();
    assert.ok(machine.scheduled.includes('QLIG01'), 'on: it begins');
  } finally { setPref(LOOT_RARITY_KEY, true); }
  // The King's Gambit off: A Seat at the Table's second step waits where the line stands
  setPref(KINGS_GAMBIT_KEY, false);
  try {
    const { runner, machine, clock, step } = runnerWith({ level: 2, online: false });
    step();
    runner.ended(machine.end('QLIT01'), { id: 'done', failure: false });
    clock.s += STEP_GAP_S;
    step();
    assert.ok(!machine.scheduled.includes('QLIT02'));
    const row = runner.rows().find((l) => l.id === 'introTables');
    assert.deepEqual([row.state, row.opens], ['waiting', 'Opens with The King’s Gambit on.']);
    setPref(KINGS_GAMBIT_KEY, true);
    step();
    assert.ok(machine.scheduled.includes('QLIT02'));
  } finally { setPref(KINGS_GAMBIT_KEY, true); }
  // the Renown a revenant comes at: online, below it the Bay's second step waits
  setSigilOnline(true);
  setSigilRenown(3);
  try {
    assert.equal(NEED_CHECKS.renown(), false, 'Renown 3 online: held');
    setSigilRenown(REVENANT_MIN_RENOWN);
    assert.equal(NEED_CHECKS.renown(), true);
  } finally { setSigilOnline(false); }
  assert.equal(NEED_CHECKS.renown(), true, 'offline: no revenant is held');
});

test('AUDIT QUESTLINES LINES-12, LINES-19, LINES-7: a step that will not begin here waits RETRY_GAP_S and says so; a step\'s quest gone without its end (an error) is offered again a day later, never every tick (mutants: the wait on a refused parse; the stall\'s words; dropped)', () => {
  const { runner, machine, clock, step } = runnerWith({ level: 2, online: false });
  const schedule = machine.scheduleQuestByName.bind(machine);
  let refuse = true;
  machine.scheduleQuestByName = (name) => (refuse && name === 'QLIT01' ? null : schedule(name));
  step(); step(); step();
  assert.equal(runner.lineState('introTables').wait, clock.s + RETRY_GAP_S, 'a day');
  assert.equal(runner.rows().find((l) => l.id === 'introTables').opens, 'Its next step could not begin here: it will be offered again.');
  refuse = false;
  step();
  assert.ok(!machine.scheduled.includes('QLIT01'), 'not before its day');
  clock.s += RETRY_GAP_S;
  step();
  assert.deepEqual(machine.scheduled.filter((n) => n === 'QLIT01'), ['QLIT01'], 'then once');
  assert.equal(runner.rows().find((l) => l.id === 'introTables').opens, null, 'begun: the stall unsaid');
  // an error removes the quest: no `end quest`, the machine's onQuestEnded alone
  const q = [...machine.quests.values()].find((x) => x.questName === 'QLIT01');
  machine.quests.delete(q.uid);
  q.questTombstoned = true;
  runner.dropped(q);
  step();
  assert.deepEqual(machine.scheduled.filter((n) => n === 'QLIT01'), ['QLIT01'], 'not parsed again every tick');
  clock.s += RETRY_GAP_S;
  step();
  assert.equal(machine.scheduled.filter((n) => n === 'QLIT01').length, 2, 'a day later');
});

test('AUDIT QUESTLINES LINES-13, LINES-17, LINES-18: ended() moves a line only on its own step; a dozen lines open begin an hour apart, never in one breath; a step\'s quest already running is the step - its opening asked (mutants: the step guard; the pacing; the adopted copy\'s open)', async () => {
  const { runner, machine, clock, step } = runnerWith({ level: 2, online: false });
  step();
  const q2 = machine.scheduleQuestByName('QLIT02');
  machine.tick();
  q2.questComplete = true;
  assert.equal(runner.ended(q2, { id: 'done', failure: false }), null, 'a stale copy of another step moves nothing');
  assert.equal(runner.lineState('introTables').step, 0);
  // the pacing: level 30 offline - the introductions that open offline, one an hour
  const many = runnerWith({ level: 30, online: false });
  many.step();
  const begun = () => QL_LINES.filter((l) => many.runner.lineState(l.id)).length;
  assert.equal(begun(), 1, 'one line on the first tick');
  many.step();
  assert.equal(begun(), 1, 'and none more in the same hour');
  many.clock.s += STEP_GAP_S;
  many.step();
  assert.equal(begun(), 2, 'the next an hour on');
  // an adopted copy: the Old Coil's first step already running when the line begins - its opening asked all the same
  const calls = [];
  const svc = { account: () => 'a', guest: () => false, claim: async (b) => { calls.push(b); return { ok: true, data: { opened: true } }; } };
  const adopt = runnerWith({ level: 8, online: true, service: svc });
  adopt.machine.quests.set(999, { uid: 999, questName: 'QLOC01', questComplete: false, questTombstoned: false });
  for (let i = 0; i < 6 && !adopt.runner.lineState('oldCoil'); i++) { adopt.step(); adopt.clock.s += STEP_GAP_S; }
  adopt.step();
  await new Promise((r) => setImmediate(r));
  assert.ok(!adopt.machine.scheduled.includes('QLOC01'), 'the running copy is the step');
  assert.deepEqual(calls.filter((c) => c.line === 'oldCoil'), [{ line: 'oldCoil', step: 0, phase: 'open' }]);
  void clock;
});

test('AUDIT QUESTLINES LINES-21: a claim answered after a load belongs to the records before it - never written into the loaded character\'s line, never told over them (mutants: the generation)', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const svc = { account: () => 'a', guest: () => false, claim: async (b) => { if (b.phase === 'end') await gate; return { ok: true, data: b.phase === 'open' ? { opened: true } : { witnessed: true, title: 'doorwarden' } }; } };
  const { runner, machine, clock, honours, step } = runnerWith({ level: 30, online: true, service: svc });
  runner.restore({ burningDoors: { step: 3, outcomes: {}, done: false, wait: 0, claims: { 2: 'witnessed' } } });
  step();
  runner.ended(machine.end('QLBD04'), { id: 'done', failure: false });
  step();   // the end's claim goes out, its answer held
  const other = { burningDoors: { step: 3, outcomes: {}, done: false, wait: 0, claims: {} } };
  runner.restore(other);   // another character loaded meanwhile
  release();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(runner.lineState('burningDoors').claims[3], undefined, 'the loaded character\'s record untouched');
  assert.deepEqual(honours, [], 'nothing told over them');
  void clock;
});

test('AUDIT QUESTLINES UI-7, UI-14: the rows say a failed step is offered again (`retry`), a step set aside (`shelved`), a step between steps still to come (never "now"); offline a line that can only begin online is not drawn - one begun shows, continuing online (mutants: retry; shelved; the gap\'s `current`; the offline filter)', () => {
  const { runner, machine, clock, step } = runnerWith({ level: 2, online: false });
  step();
  const row = () => runner.rows().find((l) => l.id === 'introTables');
  assert.equal(row().state, 'running');
  runner.ended(machine.end('QLIT01', false), { id: 'failed', failure: true });
  assert.deepEqual([row().state, row().steps[0].state], ['retry', 'next'], 'failed: offered again, its step not under way');
  clock.s += RETRY_GAP_S;
  step();
  assert.equal(row().state, 'running', 'offered again: under way');
  runner.ended(machine.end('QLIT01'), { id: 'done', failure: false });
  assert.deepEqual([row().state, row().steps[1].state], ['waiting', 'next'], 'between steps: the next is still to come');
  clock.s += STEP_GAP_S;
  step();
  const q2 = [...machine.quests.values()].find((q) => q.questName === 'QLIT02');
  q2.shelvedAt = 5;
  assert.deepEqual([row().state, row().steps[1].state], ['shelved', 'current'], 'set aside in the journal');
  // offline: the endgame lines and the online introductions are not drawn - unless begun
  const ids = runner.rows().map((l) => l.id);
  assert.ok(!ids.includes('burningDoors') && !ids.includes('introCrafts') && ids.includes('introTables') && ids.includes('introGear'));
  const begun = runnerWith({ level: 30, online: false });
  begun.runner.restore({ oldCoil: { step: 1, outcomes: {}, done: false, wait: 0, claims: {} } });
  const coil = begun.runner.rows().find((l) => l.id === 'oldCoil');
  assert.deepEqual([coil?.state, coil?.opens], ['waiting', 'Continues online.'], 'a line begun online, seen offline');
});

test('AUDIT QUESTLINES DOC-18, DOC-6, DOC-34: the Cycle is one story in order - the Covens\' Hoard after the Burning Doors, the Weir Road after the Hoard; and every step\'s sheet pays at its line\'s tier - the line\'s `tier` is the sheets\' (mutants: an `after` dropped; a sheet\'s tier drifted)', () => {
  assert.equal(lineById('covensHoard').opens.after, 'burningDoors');
  assert.equal(lineById('weirRoad').opens.after, 'covensHoard');
  for (const l of QL_LINES) for (const s of l.steps) assert.equal(sheetFor(s.quest)?.tier, l.tier, `${s.quest}: its sheet's tier is ${l.id}'s`);
});
