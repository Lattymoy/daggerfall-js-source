// AUDIT QUESTS (2026-09-22, Mac: "I want you to do a deep conprehensive
// audit and ensure everything is linked up properly with quests and
// such").
//
// THE AUDIT CAME BACK CLEAN, AND THAT IS THE PROBLEM THIS FILE SOLVES.
// A sweep that finds nothing is worth nothing tomorrow: the same holes
// can open on the next commit and nobody would know until a player
// reported a quest that does not start. So every link the audit walked
// by hand is a LAW here, driven over the whole shipped corpus, and the
// exemptions are named with their reasons rather than left as silence.
//
// WHAT WAS WALKED, AND WHAT EACH PIN BELOW HOLDS:
//
//   1. THE REGISTRY. All 82 slots of DFU's RegisterActionTemplates,
//      in DFU's own ORDER - getActionTemplate is a first-match scan,
//      so a slot that moves changes which template claims a line.
//      Checked against Interkarma/daggerfall-unity @2343305d1.
//   2. THE CORPUS PARSES. All 265 shipped quests, through the real
//      machine, and only the four known-upstream lines are left
//      unclaimed - each named below with the reason it pends in DFU
//      too. An unmatched line is a quest step that silently does
//      nothing, and NOTHING logs it.
//   3. THE ROUND TRIP, BOTH HALVES. Every quest DIRTIED and then
//      saved -> restored -> saved, identical; and the envelope checked
//      for what it CAPTURED, because a field the quest never writes
//      round-trips perfectly and still loses the data.
//   4. THE OFFER. Every quest the lists can offer has a file, and the
//      table's `-` disabled marker is honoured by the reader.
//   5. THE HOOKS. Every `hooks.world.X` the engine reads is provided by
//      the shipped host, or is on the exemption list below WITH its
//      reason. This is the pin that would have caught a hook the engine
//      reads and no host answers - a silent no-op, the fault class this
//      port has paid for repeatedly.
//
// TWO OF THESE PINS WERE WRITTEN WRONG FIRST, and the mutants said so.
// Pin 2 looked for a NULL action in `task.actions` - a thing nothing
// pushes there, so it could never fail; the real signal is
// `pendingActionLines`, and reading it turned up four corpus lines no
// template claims. Pin 3 round-tripped PRISTINE quests, where a
// constructor default and a saved default are the same value, so
// deleting a restore line changed nothing. Both are recorded here
// because the shape of the mistake outlasts the fix: a pin that
// asserts a structurally impossible failure, and a pin whose fixture
// is too clean to carry the fault.
//
// WHY PIN 1 IS NOT auditquest_patterns.test.js AGAIN. That pin does
// the deeper comparison - all 82 patterns regenerated from DFU's C#,
// structure for structure - but it opens a DFU CHECKOUT, so it calls
// `t.skip` whenever DFU_PATH is unset, which is CI's normal state.
// The registry's order is therefore unguarded exactly where guarding
// matters. Pin 1 carries DFU's order as a RECORDED FIXTURE instead,
// so it runs on every machine with no checkout at all; the two are
// the same law at different depths, and the shallow one is the one
// that is always on.
//
// The four hosts are NOT equal here and that is recorded rather than
// asserted: `scenes/exterior.js` builds its own questWorld that is 16
// keys behind `scenes/world.js`'s. It is the dev scene reached by
// `?region=&loc=` (its own header says so) and it has no save path at
// all, so it is not held to the shipped host's surface - but the gap is
// named in the arc page so promoting that host cannot quietly inherit it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUESTS = join(ROOT, 'vendor/dfu-quests/Quests');
const TABLES = join(ROOT, 'vendor/dfu-quests/Tables');

/** The shipped corpus, once for the file - reading 265 files per test
 *  would be the slowest thing in the suite for no extra proof. */
const questFiles = readdirSync(QUESTS).filter((f) => f.endsWith('.txt')).sort();
const questSource = new Map(questFiles.map((f) => [f, readFileSync(join(QUESTS, f), 'utf8').split(/\r?\n/)]));

async function loadedTables() {
  const { loadQuestTables } = await import('../src/systems/quest/tables.js');
  const sources = {};
  for (const f of readdirSync(TABLES)) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(TABLES, f), 'utf8').replace(/^﻿/, '');
  }
  loadQuestTables(sources);
}

/** DFU's RegisterActionTemplates (QuestMachine.cs:339-428) IN ORDER,
 *  spelled in the port's class names. This list is the registry's
 *  actual law and it is an ORDERED one: getActionTemplate is a
 *  first-match scan (QuestMachine.cs:751-763), so a slot that moves
 *  changes which template claims an ambiguous line. Eight rows carry
 *  the DFU name they were renamed from - seven because the port's own
 *  modules already own those words (Season/Weather/Climate/Enemies/
 *  KillFoe/SetPlayerCrime/SpawnCityGuards), and slot 69 because
 *  WorldUpdate routes into the mod-facing WorldDataVariants system
 *  the Port-Ledger holds at "Not planned", so the port stands a
 *  PendingTrigger there carrying DFU's verbatim pattern. Checked
 *  against Interkarma/daggerfall-unity @2343305d1 - all 82 slots
 *  agree positionally. */
const DFU_REGISTRY_ORDER = [
  'WhenPcEntersExits',
  'WhenNpcIsAvailable',
  'WhenReputeWith',
  'WhenSkillLevel',
  'WhenAttributeLevel',
  'WhenTask',
  'ClickedNpc',
  'ClickedItem',
  'LevelCompleted',
  'InjuredFoe',
  'KilledFoe',
  'TotingItemAndClickedNpc',
  'DailyFrom',
  'DroppedItemAtPlace',
  'SeasonCondition',   // DFU Season
  'WeatherCondition',   // DFU Weather
  'ClimateCondition',   // DFU Climate
  'EndQuest',
  'Prompt',
  'Say',
  'PlaySound',
  'StartTask',
  'ClearTask',
  'LogMessage',
  'PickOneOf',
  'RemoveLogMessage',
  'PlayVideo',
  'PcAt',
  'CreateNpcAt',
  'CreateNpc',
  'PlaceNpc',
  'PlaceItem',
  'GivePc',
  'GiveItem',
  'StartStopTimer',
  'CreateFoe',
  'PlaceFoe',
  'HideNpc',
  'RestoreNpc',
  'AddFace',
  'DropFace',
  'GetItem',
  'StartQuest',
  'RunQuest',
  'UnsetTask',
  'ChangeReputeWith',
  'ReputeExceedsDo',
  'RevealLocation',
  'RestrainFoe',
  'MakePermanent',
  'HaveItem',
  'AddAsQuestor',
  'DropAsQuestor',
  'ItemUsedDo',
  'TakeItem',
  'TeleportPc',
  'DialogLink',
  'AddDialog',
  'RumorMill',
  'MakePcDiseased',
  'CurePcDisease',
  'CastSpellDo',
  'CastEffectDo',
  'CastSpellOnFoe',
  'RemoveFoe',
  'LegalRepute',
  'MuteNpc',
  'DestroyNpc',
  'PendingTrigger',   // DFU WorldUpdate
  'EnemiesAction',   // DFU Enemies
  'ClickedFoe',
  'KillFoeAction',   // DFU KillFoe
  'PayMoney',
  'JournalNote',
  'ChangeFoeInfighting',
  'ChangeFoeTeam',
  'PlaySong',
  'SetPlayerCrimeAction',   // DFU SetPlayerCrime
  'SpawnCityGuardsAction',   // DFU SpawnCityGuards
  'UnrestrainFoe',
  'TrainPc',
  'PromptMulti',
];

test('AUDIT QUESTS 1: the action registry mirrors DFU slot for slot, in order', async () => {
  const { defaultActionTemplates } = await import('../src/systems/quest/actions.js');
  const registered = defaultActionTemplates().map((t) => t.constructor.name);

  // The whole law in one line: same names, same count, SAME ORDER.
  // A dropped slot, an extra one, a rename and a reorder all fail
  // here, and the diff names the slot.
  assert.deepEqual(registered, DFU_REGISTRY_ORDER,
    'the registry is DFU RegisterActionTemplates in its own order');

  // The second net, off the source: a class added to actions.js
  // tomorrow and never registered matches no quest line. It fails
  // here rather than in a player's quest log.
  const src = readFileSync(join(ROOT, 'src/systems/quest/actions.js'), 'utf8');
  const defined = [...src.matchAll(/^(?:export )?class (\w+)/gm)].map((m) => m[1]);
  const missing = defined.filter((d) => d !== 'ActionTemplate' && !registered.includes(d));
  assert.deepEqual(missing, [], 'an action class ported and never registered matches no quest line');
  assert.ok(!registered.includes('ActionTemplate'), 'the BASE is not registered - it would match everything');

  // A duplicate is worse than a missing one: under a first-match scan
  // the second registration is unreachable, so the law it carries
  // never runs and nothing says so.
  const dupes = registered.filter((n, i) => registered.indexOf(n) !== i && n !== 'PendingTrigger');
  assert.deepEqual([...new Set(dupes)], [], 'no action class is registered twice');
});

/** The FOUR lines in the shipped corpus that match no template, each
 *  with the reason it is not a port gap. This list is the real output
 *  of the parse - `pendingActionLines` is where Task._readTaskLines
 *  puts a line the factory could not claim, and nothing anywhere logs
 *  it, so a quest carrying one simply does nothing at that step.
 *  Every entry below was checked against DFU @2343305d1 and pends
 *  THERE too. */
const KNOWN_PENDING = Object.freeze({
  // The quest source says it outright: "-- Discovered a new op-code:".
  // An unknown op-code has no template in DFU either.
  'B0B71Y03.txt': '_0x3c_ 19',
  // DFU's PcAt pattern reads the PLACE as `\\w+` and only the TASK as
  // `[a-zA-Z0-9_.]+` (PcAt.cs:42-45), so a dotted place symbol matches
  // in neither engine. The port is verbatim; the quest source is the
  // odd one.
  'M0B11Y18.txt': 'pc at _L.00_ set _S.12_',
  // The quest source's own next line reads "--not known what this
  // intends to do". No DFU action carries a `location` pattern.
  'S0000007.txt': 'location _tavern_ 100 27000',
  // The demo quest's "custom action" - DFU's JuggleAction is
  // COMMENTED OUT of RegisterActionTemplates (QuestMachine.cs:342),
  // so it pends upstream by deliberate choice.
  '__DEMO01.txt': 'juggle 5 apples every 2 seconds drop 40%',
});

test('AUDIT QUESTS 2: every shipped quest parses, and only the four known lines find no template', async () => {
  await loadedTables();
  const { QuestMachine } = await import('../src/systems/quest/machine.js');
  const machine = new QuestMachine({ nowSeconds: () => 0 });

  const failed = [];
  const pending = new Map();
  for (const [f, lines] of questSource) {
    let quest = null;
    try {
      quest = machine.parseQuestForLists(lines, 0, { rolls: () => 0 });
    } catch (e) {
      failed.push(`${f}: ${e?.message ?? e}`);
      continue;
    }
    if (!quest) { failed.push(`${f}: parsed to null`); continue; }
    // THE SIGNAL. An unmatched line is NOT a null action - the factory
    // returns null and _readTaskLines pends the raw text instead
    // (task.js:192-201). A pin that looked for a null in `actions`
    // could never fail: nothing pushes one there.
    for (const task of quest.tasks?.values() ?? []) {
      for (const line of task.pendingActionLines ?? []) {
        if (!pending.has(f)) pending.set(f, []);
        pending.get(f).push(line.trim());
      }
    }
  }
  assert.deepEqual(failed, [], 'every shipped quest parses');
  assert.ok(questSource.size >= 265, `the corpus has not shrunk (${questSource.size})`);

  const got = Object.fromEntries([...pending].map(([f, ls]) => [f, ls.join(' | ')]));
  // A template whose pattern narrows - the fault this pin exists for -
  // shows up as EXTRA entries here, named by quest and by line.
  assert.deepEqual(got, { ...KNOWN_PENDING },
    'a quest line no template claims is a step that silently does nothing');
});

test('AUDIT QUESTS 3: a DIRTIED quest survives save -> restore -> save for the whole corpus', async () => {
  await loadedTables();
  const { QuestMachine } = await import('../src/systems/quest/machine.js');

  // A FRESHLY PARSED quest is nearly all defaults, so round-tripping
  // one proves almost nothing: drop `questTombstoneTime` out of
  // restoreSaveData and a pristine corpus still agrees, because the
  // constructor's 0 and the saved 0 are the same 0. A real save is a
  // quest mid-play. So every quest is DIRTIED first - every field the
  // envelope carries pushed off its default - and THEN round-tripped.
  const dirty = (quest) => {
    quest.questSuccess = true;
    quest.addLogStep(3, 1010);
    quest.addLogStep(7, 1020);
    quest.oneTimeDisplayedMessages.add(1234);
    let i = 0;
    for (const task of quest.tasks.values()) {
      task.setTriggerValue(i % 2 === 0);
      task.prevTriggered = i % 3 === 0;
      if (i % 5 === 0) task.dropped = true;
      i++;
    }
    // tombstone() LAST: it completes the quest and stamps the time,
    // and it posts through the talk hooks, which a hookless machine
    // simply drops.
    quest.tombstone();
  };

  const drift = [];
  for (const [f, lines] of questSource) {
    const a = new QuestMachine({ nowSeconds: () => 4242 });
    let quest;
    try { quest = a.parseQuestForLists(lines, 0, { rolls: () => 0 }); } catch { continue; }
    if (!quest) continue;
    dirty(quest);
    a.quests.set(quest.uid, quest);

    let saved;
    try { saved = JSON.parse(JSON.stringify(a.getSaveData())); } catch (e) { drift.push(`${f}: save threw ${e.message}`); continue; }

    // The restoring machine's clock is DIFFERENT on purpose: a field
    // the restore forgets and re-derives from `now` reads 0 here
    // rather than 4242, so the forgetting shows.
    const b = new QuestMachine({ nowSeconds: () => 0 });
    try { b.restoreSaveData(saved); } catch (e) { drift.push(`${f}: restore threw ${e.message}`); continue; }

    let again;
    try { again = JSON.parse(JSON.stringify(b.getSaveData())); } catch (e) { drift.push(`${f}: re-save threw ${e.message}`); continue; }

    if (JSON.stringify(saved) !== JSON.stringify(again)) {
      const keys = Object.keys(saved).filter((k) => JSON.stringify(saved[k]) !== JSON.stringify(again[k]));
      drift.push(`${f}: differs at ${keys.join(', ')}`);
    }
  }
  assert.deepEqual(drift.slice(0, 10), [],
    'a quest that does not survive its own save is a quest that breaks on load');

  // ...AND THE OTHER HALF, which a round trip structurally cannot see.
  // A field the quest never WRITES into its envelope round-trips
  // perfectly and still loses the data: save omits it, restore has
  // nothing to read, re-save omits it again, and all three agree. So
  // the envelope is also checked for what it CAPTURED - every value
  // dirty() pushed off its default has to be findable in the saved
  // quest, at the key that carries it.
  const one = new QuestMachine({ nowSeconds: () => 4242 });
  const q = one.parseQuestForLists(questSource.get('_TUTOR__.txt') ?? [...questSource.values()][0], 0, { rolls: () => 0 });
  dirty(q);
  one.quests.set(q.uid, q);
  const env = JSON.parse(JSON.stringify(one.getSaveData())).quests[0];

  assert.equal(env.questSuccess, true, 'the outcome is captured');
  assert.equal(env.questTombstoned, true, 'the tombstone is captured');
  assert.equal(env.questTombstoneTime, 4242, 'the tombstone TIME is captured, not re-derived on load');
  assert.ok(env.oneTimeDisplayedMessages.includes(1234), 'a once-per-quest message is captured');
  const step = env.activeLogMessages.find((e) => e.stepID === 3);
  assert.ok(step, 'a log step is captured');
  assert.equal(step.messageID, 1010, 'with its message');
  // The journal reads %qdt off this stamp (getCurrentLogMessageTime):
  // drop it and every restored entry dates to quest start instead.
  assert.equal(step.time, 4242, 'AND its time - the journal dates every entry by it');
  assert.ok(env.tasks.some((t) => t.dropped === true), 'a dropped task is captured');
  assert.ok(env.tasks.some((t) => t.triggered === true), 'a triggered task is captured');
});

test('AUDIT QUESTS 4: every quest the lists can offer has a file, and a disabled row is not offered', async () => {
  const { Table } = await import('../src/systems/quest/table.js');
  const have = new Set(questFiles.map((f) => f.slice(0, -4)));

  let offerable = 0;
  const missing = [];
  for (const name of ['QuestList-Classic', 'QuestList-DFU']) {
    const table = new Table(readFileSync(join(TABLES, `${name}.txt`), 'utf8'));
    for (let i = 0; i < table.rowCount; i++) {
      const quest = table.getValue('name', i);
      if (!quest) continue;
      offerable++;
      // THE DISABLED MARKER. A row whose name starts with `-` is one
      // the list turns off, and the reader is what honours it - if it
      // ever stopped, the picker would offer `-10C00Y00`, a name no
      // file answers to, and the offer would fail with no message.
      assert.ok(!quest.startsWith('-'), `a disabled row reached the picker: ${quest}`);
      if (!have.has(quest)) missing.push(`${name}: ${quest}`);
    }
  }
  assert.deepEqual(missing, [], 'a listed quest with no file is an offer that cannot be taken');
  assert.ok(offerable >= 188, `the offerable pool has not shrunk (${offerable})`);
});

test('AUDIT QUESTS 5: every world hook the engine reads is answered by the shipped host, or exempt with a reason', () => {
  // THE FAULT CLASS THIS PIN EXISTS FOR: a hook the engine reads off
  // `hooks.world` that no host provides is not an error anywhere - the
  // optional chain answers undefined and the action, condition or macro
  // silently does nothing. It has bitten this port before, and a sweep
  // by hand only proves it for the day it was run.
  const engineDir = join(ROOT, 'src/systems/quest');
  const read = new Map();
  for (const f of readdirSync(engineDir)) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(join(engineDir, f), 'utf8');
    src.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/hooks\s*\??\.\s*world\s*\??\.\s*([A-Za-z_$][\w$]*)/g)) {
        if (!read.has(m[1])) read.set(m[1], `${f}:${i + 1}`);
      }
    });
  }
  assert.ok(read.size >= 28, `the engine still reads a world surface (${read.size})`);

  // What the SHIPPED host answers: world.js's questWorld, read as the
  // keys of the object literal it hands the machine.
  const host = readFileSync(join(ROOT, 'src/scenes/world.js'), 'utf8').split('\n');
  const start = host.findIndex((l) => /^\s*const questWorld = \{/.test(l));
  assert.ok(start >= 0, 'world.js still builds a questWorld');
  const provided = new Set();
  let depth = 0;
  for (let i = start; i < host.length; i++) {
    const line = host[i];
    if (i > start && depth === 1) {
      const m = /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(line);
      if (m) provided.add(m[1]);
    }
    depth += (line.split('{').length - 1) - (line.split('}').length - 1)
      + (line.split('[').length - 1) - (line.split(']').length - 1);
    if (i > start && depth <= 0) break;
  }
  assert.ok(provided.size >= 50, `world.js still answers a full surface (${provided.size})`);

  // THE EXEMPTIONS, each with the reason it is not a hole. They are
  // listed rather than skipped so that a hook added tomorrow with no
  // answer fails this pin instead of joining them in silence.
  const EXEMPT = {
    // systems/talkMacros.js `talkMacroHooks` LAYERS these three over the
    // machine's bundle when a talk pipeline exists, which is DFU's own
    // shape: they are TalkManager's rows, not GameManager's. Its note
    // says it outright - "with no pipeline they are simply absent and
    // answer [nullMCP]" - which is MacroHelper's behaviour too.
    talkHonoric: 'layered by talkMacroHooks when a pipeline exists',
    talkLocationOfRegionalBuilding: 'layered by talkMacroHooks when a pipeline exists',
    talkPCGreetingOrFollowUpText: 'layered by talkMacroHooks when a pipeline exists',
    // The court's four are answered a DIFFERENT and equally correct
    // way: scenes/arrestFlow.js hands `expandMacroValues` an explicit
    // value map (cri/pen/gtp/dip) and NO questLike context, so the
    // handler table is never consulted on that path. The entries here
    // are MacroHelper's rows ported for completeness, not a live seam.
    courtCrimeName: 'answered by arrestFlow\'s own value map (%cri)',
    courtPenaltyText: 'answered by arrestFlow\'s own value map (%pen)',
    courtFine: 'answered by arrestFlow\'s own value map (%gtp)',
    courtDaysInPrison: 'answered by arrestFlow\'s own value map (%dip)',
  };

  const unanswered = [...read.entries()]
    .filter(([name]) => !provided.has(name) && !(name in EXEMPT))
    .map(([name, where]) => `${name} (read at ${where})`);
  assert.deepEqual(unanswered, [],
    'a world hook the engine reads and no host answers is a silent no-op');

  // ...and an exemption that stops being needed is itself a drift: if
  // the host starts answering one, the note here has gone stale.
  const stale = Object.keys(EXEMPT).filter((k) => provided.has(k));
  assert.deepEqual(stale, [], 'an exemption the host now answers should be deleted from the list');
  // every exemption must still be a hook the engine actually reads
  const orphanExempt = Object.keys(EXEMPT).filter((k) => !read.has(k));
  assert.deepEqual(orphanExempt, [], 'an exemption for a hook nobody reads is dead weight');
});
