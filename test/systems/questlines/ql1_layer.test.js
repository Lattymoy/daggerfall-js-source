// QL1 (bible/06-Systems/Questlines-Arc.md): THE LAYER - the switch and the stamp a quest keeps for life, the bindings an
// objective reads off the machine's own state, the latch, a shared copy's state, and the layer made by the quest bridge
// over a real DFU quest (M0B00Y06, the Fighters Guild's wild beast) from its start to its reward.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { setLocale, BASE_LOCALE } from '../../../src/systems/textManager.js';
import {
  QUESTLINES_PREF, QL_STAMP, questlinesOn, startStamp, isStamped, freshState, readState, writeState, holds, readObjectives,
  observe, outcomeNow, fallbackOutcome, questTierOf, rankTier, reputationTier, levelTier, symName,
} from '../../../src/systems/questlines/qlLaw.js';
import { receivedState, mergeSharedState } from '../../../src/systems/questlines/qlState.js';
import { sheetFor } from '../../../src/systems/questlines/qlSheets.js';
import { FEATURES } from '../../../src/systems/features.js';
import { FEATURE_PREF_ONLINE } from '../../../src/systems/features.js';
import { questSource, loadTables as loadPackTables } from '../../qlSources.mjs';   // AUDIT QUESTLINES LAW-6: the pack as the game reads it
import { goldStack } from '../../../src/systems/inventory.js';
import { createQuestlines, OFFERS_MAX } from '../../../src/systems/questlines/qlLayer.js';
import { filedOutcome } from '../../../src/systems/notebook.js';   // AUDIT QUESTLINES UI-5: the filed outcome, a side record

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
const questFile = new Map(readdirSync(join(VENDOR, 'Quests')).map((f) => [f.replace(/\.txt$/i, '').toUpperCase(), f]));
const questLines = (name) => { const f = questFile.get(String(name).toUpperCase()); return f ? read(join(VENDOR, 'Quests', f)).split(/\r?\n/) : null; };
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}

/** A bridge over the real pack, a player who fights with a long blade. */
function makeBridge(over = {}) {
  const skills = new Array(35).fill(10);
  skills[29] = 60;   // LongBlade
  skills[31] = 40;   // Axe
  return createQuestBridge({
    data: {
      readListTable: (name) => { try { return read(join(VENDOR, 'Tables', `QuestList-${name}.txt`)); } catch { return null; } },
      getQuestSourceLines: (name) => questLines(name),
    },
    classicSeconds: () => 1000,
    playerEntity: { name: 'Hero', level: 8, gender: 'male', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills },
    getReputation: () => 0,
    carriesQuestItem: () => false,
    ...over,
  });
}

// ---- the switch ----

test('QL1 the switch: a Features row, on by default, forced on online (the owner: locked), read when a quest starts', () => {
  const row = FEATURES.find((f) => f.id === 'questlines');
  assert.ok(row, 'the row stands');
  assert.equal(row.control.key, QUESTLINES_PREF);
  assert.equal(row.control.initial, true, 'on by default offline (the owner\'s answer)');
  assert.equal(row.control.online, true, 'forced on online - never "player"');
  assert.equal(FEATURE_PREF_ONLINE[QUESTLINES_PREF], true, 'the lane learns it from the row');
  setPref(QUESTLINES_PREF, false);
  assert.equal(questlinesOn(), false);
  assert.equal(startStamp(), null, 'off: DFU\'s quest');
  setPref(QUESTLINES_PREF, true);
  assert.equal(questlinesOn(), true);
  assert.deepEqual(startStamp(), freshState(), 'on: a fresh state');
  assert.equal(startStamp(false), null);
});

// ---- the saved state ----

test('QL1 the state: written whole, read back field by field, and anything else read as DFU\'s quest', () => {
  const st = { ...freshState(), tier: 3, done: ['a', 'b'], failed: ['c'], choices: { fate: 'spare' }, outcome: 'mercy', paid: true, moved: false, acts: { 'fish-caught': 2 } };
  assert.deepEqual(readState(writeState(st)), st);
  assert.notEqual(writeState(st), st, 'a copy, never the live state');
  assert.equal(readState(null), null);
  assert.equal(readState({ ...st, stamp: QL_STAMP + 1 }), null, 'a later law\'s stamp is not misread');
  assert.equal(readState({ stamp: QL_STAMP, tier: 9 }).tier, 4, 'tier clamped');
  assert.deepEqual(readState({ stamp: QL_STAMP, done: ['x', 3, 'x', ''], choices: { a: 1, b: 'y' }, acts: { k: -1, j: 2 } }),
    { ...freshState(), done: ['x'], choices: { b: 'y' }, acts: { j: 2 } }, 'each field of its own kind - nothing throws');
});

test('QL1 a shared copy (decision 7): the party\'s progress travels, the holder\'s reward never does; a resync is monotonic', () => {
  // PIN MOVED (AUDIT QUESTLINES REWARD-15): a state keeps no `offer` - a reward's choice waits in the layer's offers
  const sender = { ...freshState(), done: ['a'], choices: { fate: 'spare' }, outcome: null, paid: true, moved: true, acts: { k: 1 } };
  const got = receivedState(writeState(sender));
  assert.deepEqual(got.done, ['a']);
  assert.deepEqual(got.choices, { fate: 'spare' });
  assert.equal(got.paid, false, 'a copy arrives unpaid');
  assert.equal(got.moved, false);
  assert.equal('offer' in got, false, 'no choice of reward rides a quest\'s state');
  assert.deepEqual(got.acts, {}, 'an act is this world\'s');
  assert.equal(receivedState(null), null, 'DFU\'s quest arrives as DFU\'s');
  const local = { ...freshState(), done: ['b'], failed: ['a'], choices: { fate: 'kill' }, paid: true, acts: { j: 3 } };
  const merged = mergeSharedState(local, writeState({ ...sender, outcome: 'mercy' }));
  assert.deepEqual(merged.done.sort(), ['a', 'b']);
  assert.deepEqual(merged.failed, [], 'done beats failed');
  assert.deepEqual(merged.choices, { fate: 'kill' }, 'this copy\'s choice stands');
  assert.equal(merged.outcome, 'mercy', 'an outcome either copy reached stands');
  assert.equal(merged.paid, true, 'the holder\'s own pay');
  assert.deepEqual(merged.acts, { j: 3 });
  assert.equal(mergeSharedState(null, writeState(sender)), null, 'a copy that was DFU\'s stays DFU\'s');
});

// ---- the bindings, over a quest-shaped fixture ----

function fixture() {
  const task = (on) => ({ getTriggerValue: () => on });
  const quest = {
    questComplete: false, questSuccess: false,
    tasks: new Map([['S.02', task(true)], ['mondead', task(false)]]),
    resources: new Map([
      ['letter', { isItem: true }], ['ticks', { isClock: true, clockEnabled: true, clockFinished: false }],
      ['done', { isClock: true, clockEnabled: false, clockFinished: true }], ['bear', { isFoe: true, killCount: 2, spawnCount: 2 }],
      ['rat', { isFoe: true, killCount: 1, spawnCount: 3 }],
    ]),
    activeLogMessages: new Map([[0, { stepID: 0, messageID: 1010 }], [5, { stepID: 1, messageID: 1011 }]]),
    hooks: { globalVars: new Map([[7, true]]) },
    ql: { ...freshState(), acts: { 'fish-caught': 2 }, choices: { fate: 'spare' } },
  };
  return quest;
}

test('QL1 the bindings: each reads the machine\'s own state - tasks, items, clocks, steps, globals, foes - and nothing else', () => {
  const q = fixture();
  const p = { carries: (r) => r === q.resources.get('letter') };
  const y = (b) => holds(q, b, p);
  assert.equal(y({ started: true }), true);
  assert.equal(y({ ended: true }), false);
  assert.equal(y({ task: '_S.02_' }), true, 'the script\'s spelling');
  assert.equal(y({ task: 'S.02' }), true, 'the inner name');
  assert.equal(y({ task: '_mondead_' }), false);
  assert.equal(y({ task: '_nosuch_' }), false);
  assert.equal(y({ item: '_letter_' }), true);
  assert.equal(holds(q, { item: '_letter_' }), false, 'no probe: never carried');
  assert.equal(y({ item: '_ticks_' }), false, 'a clock is no item');
  assert.equal(y({ clock: '_ticks_' }), true);
  assert.equal(y({ clock: '_done_' }), false);
  assert.equal(y({ clockDone: '_done_' }), true);
  assert.equal(y({ step: 1 }), true, 'a step by its id, not its key');
  assert.equal(y({ step: 5 }), false);
  assert.equal(y({ global: 7 }), true);
  assert.equal(y({ global: 8 }), false);
  assert.equal(y({ foeDead: '_bear_' }), true);
  assert.equal(y({ foeDead: '_rat_' }), false, 'every spawn');
  assert.equal(y({ act: 'fish-caught', n: 2 }), true);
  assert.equal(y({ act: 'fish-caught', n: 3 }), false);
  assert.equal(y({ choice: { branch: 'fate', is: 'spare' } }), true);
  assert.equal(y({ choice: { branch: 'fate', is: 'kill' } }), false);
  assert.equal(y({ all: [{ task: 'S.02' }, { global: 7 }] }), true);
  assert.equal(y({ all: [{ task: 'S.02' }, { global: 8 }] }), false);
  assert.equal(y({ all: [] }), false, 'an empty all holds nothing');
  assert.equal(y({ any: [{ global: 8 }, { step: 0 }] }), true);
  assert.equal(y({ not: { ended: true } }), true);
  assert.equal(y({ nosuch: true }), false, 'an unknown kind never opens an objective');
  assert.equal(y(null), false);
  assert.equal(symName('_S.02_'), 'S.02');
});

test('QL1 the latch: done stays done when the script clears its task, a branch\'s first choice stands, the outcome settles once', () => {
  const on = new Map([['kill', false], ['report', false], ['spare', false], ['slay', false]]);
  const task = (k) => ({ getTriggerValue: () => on.get(k) });
  const q = { questComplete: false, questSuccess: false, tasks: new Map([...on.keys()].map((k) => [k, task(k)])), resources: new Map(), activeLogMessages: new Map(), ql: freshState() };
  const sheet = {
    objectives: [
      { id: 'kill', text: 'k', done: { task: 'kill' } },
      { id: 'report', text: 'r', open: { task: 'kill' }, done: { task: 'report' } },
    ],
    branches: [{ id: 'fate', text: 'f', choices: [{ id: 'spare', text: 's', sets: 'spare' }, { id: 'slay', text: 'x', sets: 'slay' }] }],
    outcomes: [{ id: 'mercy', text: 'm', on: { choice: { branch: 'fate', is: 'spare' } }, pay: 'lesser' }, { id: 'done', text: 'd', on: { task: 'report' }, pay: 'standard' }, { id: 'failed', text: 'f', on: { ended: true }, pay: 'none', failure: true }],
  };
  assert.deepEqual(readObjectives(q, sheet).map((o) => o.state), ['open', 'hidden']);
  on.set('kill', true);
  assert.deepEqual(observe(q, sheet).done, ['kill']);
  assert.deepEqual(readObjectives(q, sheet).map((o) => o.state), ['done', 'open']);
  on.set('kill', false);   // the script clears it again
  assert.deepEqual(readObjectives(q, sheet).map((o) => o.state), ['done', 'open'], 'latched');
  on.set('slay', true); on.set('spare', true);
  assert.deepEqual(observe(q, sheet).chose, [{ branch: 'fate', choice: 'spare' }], 'the first choice in the branch\'s order');
  on.set('spare', false);
  observe(q, sheet);
  assert.equal(q.ql.choices.fate, 'spare', 'a choice is never taken back');
  assert.equal(observe(q, sheet).outcome, null, 'no outcome until it is settled');
  assert.equal(observe(q, sheet, {}, { settle: true }).outcome, 'mercy');
  on.set('report', true);
  assert.equal(observe(q, sheet, {}, { settle: true }).outcome, null, 'settled once');
  assert.equal(q.ql.outcome, 'mercy');
  // an unstamped quest is read, never written
  const plain = { ...q, ql: null };
  assert.deepEqual(observe(plain, sheet, {}, { settle: true }), { done: [], failed: [], chose: [], outcome: null });
  // the fallback: a quest that ended with no outcome holding
  const ended = { questComplete: true, questSuccess: false, tasks: new Map(), resources: new Map(), activeLogMessages: new Map(), ql: freshState() };
  assert.equal(outcomeNow(ended, { outcomes: [{ id: 'x', on: { task: 'none' } }] }), null);
  assert.equal(fallbackOutcome(ended, sheet).id, 'failed');
  assert.equal(fallbackOutcome({ ...ended, questSuccess: true }, sheet).id, 'done', 'success: the outcome named done first');
  const unnamed = { outcomes: sheet.outcomes.filter((o) => o.id !== 'done' && o.id !== 'failed').concat([{ id: 'lost', on: { ended: true }, failure: true }]) };
  // PIN MOVED (AUDIT QUESTLINES LAW-1): a success with no `done` is the sheet's own `success`, never a guess at the first
  assert.equal(fallbackOutcome({ ...ended, questSuccess: true }, unnamed), null, '...never the first that is no failure');
  assert.equal(fallbackOutcome({ ...ended, questSuccess: true }, { ...unnamed, success: 'mercy' }).id, 'mercy', '...but the one the sheet names');
  assert.equal(fallbackOutcome(ended, unnamed).id, 'lost', '...and a failure the first failure');
});

test('QL1 the tier (section 5.1): a guild\'s rank, a reputation\'s band, a social quest\'s level, a sheet\'s own word first', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 9].map(rankTier), [1, 1, 2, 2, 3, 3, 4, 4]);
  assert.deepEqual([10, 19, 20, 39, 40, 59, 60].map(reputationTier), [1, 1, 2, 2, 3, 3, 4]);
  assert.deepEqual([1, 6, 7, 13, 14, 20, 21].map(levelTier), [1, 1, 2, 2, 3, 3, 4]);
  assert.equal(questTierOf({ minReq: 5, level: 30 }), 3, 'a guild quest: its rank, whatever the level');
  assert.equal(questTierOf({ minReq: 1, level: 30, social: true }), 4, 'a social quest: the level');
  assert.equal(questTierOf({ minReq: 45, level: 1 }), 3, 'a reputation');
  assert.equal(questTierOf({ minReq: null, level: 15 }), 3, 'no row: the level');
  assert.equal(questTierOf({ minReq: 0, sheetTier: 4 }), 4, 'a sheet\'s own');
});

// ---- the machine: the stamp at the one start door ----

test('QL1 the stamp: the machine asks at its one start door and keeps the answer for life, through a save and a restore', () => {
  let answer = null;
  const m = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: questLines, questlinesStamp: () => answer });
  const plain = m.startQuestByName('M0B00Y06');
  assert.equal(plain.ql, null, 'off: DFU\'s quest');
  answer = { ...freshState(), tier: 2 };
  const stamped = m.startQuestByName('M0C00Y11');
  assert.deepEqual(stamped.ql, { ...freshState(), tier: 2 });
  answer = null;
  const data = m.getSaveData();
  const m2 = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: questLines, questlinesStamp: () => freshState() });
  m2.restoreSaveData(data);
  assert.equal(m2.quests.get(plain.uid).ql, null, 'a load never stamps a quest that began without one');
  assert.deepEqual(m2.quests.get(stamped.uid).ql, { ...freshState(), tier: 2 }, 'and keeps the one it began with');
});

// ---- the bridge: M0B00Y06 from its start to its reward ----

test('QL1/QL3 the bridge makes the layer: M0B00Y06 stamped at its start, its objectives read off its own tasks, its gold scaled and its choice of gear set waiting at GivePc', () => {
  setPref(QUESTLINES_PREF, true);
  const offers = [], rewards = [];
  const bridge = makeBridge({ onQuestlineOffer: (o) => offers.push(o), offerReward: (_q, item) => rewards.push(item) });
  const quest = bridge.machine.startQuestByName('M0B00Y06', 0);
  assert.ok(isStamped(quest), 'stamped at its start');
  assert.equal(quest.ql.tier, 1, 'the Fighters Guild\'s rank-0 quest: tier 1');
  const sheet = sheetFor('M0B00Y06');
  assert.ok(sheet);
  const row = () => bridge.questlines.rowOf(quest);
  assert.deepEqual(row().objectives.map((o) => [o.id, o.state]), [['slay', 'open']], 'the report is hidden until the beast is dead');
  quest.getTask({ name: 'mondead' }).start();
  bridge.questlines.look();
  assert.deepEqual(row().objectives.map((o) => [o.id, o.state]), [['slay', 'done'], ['report', 'open']]);
  // the questor clicked: the script's own reward task runs GivePc
  const gold = quest.getItem({ name: 'gold' }).daggerfallUnityItem;
  const before = gold.stackCount;
  quest.getTask({ name: 'qgclicked' }).start();
  bridge.machine.tick();   // the reward task: GivePc, then `end quest`
  assert.equal(quest.ql.paid, true, 'GivePc marks it paid');
  assert.equal(gold.stackCount, before, 'a standard outcome pays the script\'s own gold');
  assert.equal(rewards.length, 1, 'the script\'s gold reward, through RW1\'s door');
  assert.equal(quest.ql.outcome, 'done', 'settled at its own `end quest` - not at the reward: a quest may pay before it ends (M0B00Y16)');
  assert.equal(offers.length, 1, 'one choice of gear, at the end');
  // filed with the notebook's entry: how it ended - AUDIT QUESTLINES UI-5 (PIN MOVED): as the entry's side record, never a
  // line of DFU's classic logbook (the enhanced archive draws it)
  const entry = bridge.notebook.getFinishedQuests().at(-1);
  assert.equal(filedOutcome(entry), 'The beast is dead and the citizen\'s house is safe.');
  assert.doesNotMatch(entry.map((tok) => tok.text).join(' '), /Outcome|citizen's house is safe/);
  for (let i = 0; i < 5; i++) bridge.machine.tick();
  assert.equal(quest.questTombstoned, true);
  assert.equal(offers.length, 1, 'once');
  const offer = offers[0];
  assert.equal(offer.questName, 'M0B00Y06');
  assert.equal(offer.pieces.length, 3);
  assert.deepEqual(offer.pieces.map((p) => p.kind), ['weapon', 'armor', 'jewel']);
  for (const p of offer.pieces) {
    assert.equal(p.item.isIdentified, true);
    assert.ok(['magic', 'rare'].includes(p.tier), `tier 1 pays Magic: ${p.tier}`);
  }
  assert.equal(bridge.questlines.offers().length, 1, 'waiting to be chosen');
  // the snapshot carries it; a restore brings it back
  const snap = bridge.snapshot();
  assert.equal(snap.questlines.offers.length, 1);
  const b2 = makeBridge({ offerReward: () => {} });   // AUDIT QUESTLINES REWARD-13: a host with the door a piece goes through
  b2.restore(snap);
  assert.equal(b2.questlines.offers().length, 1, 'the choice outlives the session');
  const taken = b2.questlines.take(b2.questlines.offers()[0].id, 1);
  assert.equal(taken?.group, 'Armor');
  assert.equal(b2.questlines.offers().length, 0, 'taken once');
  assert.equal(b2.questlines.take(offer.id, 0), null);
});

test('QL1/QL3 the bridge\'s doors (AUDIT QUESTLINES REWARD-13, REWARD-8, LAW-11): the layer is handed the door a taken piece goes through only where the host has one - a doorless host lists and cuts nothing; an offer the cap cuts is said in the HUD; the lens\'s look (a tick) reads no line or ladder (mutants: the bridge\'s door always handed; the dropped offer unsaid; the lens reads the windows\' rows)', () => {
  setPref(QUESTLINES_PREF, true);
  const hud = [];
  const bridge = makeBridge({ offerReward: () => {}, addHUDText: (s) => hud.push(s) });
  const end = (uid) => {
    const quest = bridge.machine.startQuestByName('M0B00Y06', 0);
    quest.getTask({ name: 'mondead' }).start();
    quest.getTask({ name: 'qgclicked' }).start();
    bridge.machine.tick();
    return quest;
  };
  end();
  assert.equal(bridge.questlines.offers().length, 1);
  const snap = bridge.snapshot();
  const doorless = makeBridge();
  doorless.restore(snap);
  assert.deepEqual(doorless.questlines.offers(), [], 'no door: nothing listed to take');
  assert.equal(doorless.questlines.take(snap.questlines.offers[0].id, 0), null, 'nor taken');
  assert.equal(doorless.snapshot().questlines.offers.length, 1, 'kept in the save for a host that has one');
  // the cap: twelve waiting, a thirteenth cuts the oldest and says so
  const first = snap.questlines.offers[0];
  const full = makeBridge({ offerReward: () => {}, addHUDText: (s) => hud.push(s) });
  full.restore({ ...snap, questlines: { ...snap.questlines, offers: Array.from({ length: OFFERS_MAX }, (_, i) => ({ ...structuredClone(first), id: i + 1 })), nextOffer: OFFERS_MAX + 1 } });
  hud.length = 0;
  const quest = full.machine.startQuestByName('M0B00Y06', 0);
  quest.getTask({ name: 'mondead' }).start();
  quest.getTask({ name: 'qgclicked' }).start();
  full.machine.tick();
  assert.equal(full.questlines.offers().length, OFFERS_MAX);
  assert.ok(hud.some((s) => /Too many rewards wait: the one for .+ is gone\./.test(s)), `said: ${hud.join(' | ')}`);
  // the lens's look reads the walk with no line or ladder rows; the windows' walk has them
  let windows = null;
  const walk = full.questLog;
  full.questLog = (o) => { windows = o?.windows ?? true; return walk.call(full, o); };
  full.lens.look();
  assert.equal(windows, false, 'a look a tick asks for no window rows');
  assert.ok(full.questLog().lines.length > 0, 'the windows\' walk lists the lines');
  assert.deepEqual(walk.call(full, { windows: false }).lines, []);
});

test('QL12 the ladders\' titles - and a waiting reward\'s - are kept while the text stands and read again when it moves - a locale switched (AUDIT QUESTLINES UI-19) (mutants: the titles kept for the page\'s life; the reward named in the words it was rolled in)', () => {
  setPref(QUESTLINES_PREF, true);
  let renamed = false;
  const lines = (name) => (renamed && name === 'M0B00Y06' ? questLines(name).map((l) => (/^\s*DisplayName:/i.test(l) ? 'DisplayName: The Renamed Beast' : l)) : questLines(name));
  const bridge = makeBridge({
    data: { readListTable: (name) => { try { return read(join(VENDOR, 'Tables', `QuestList-${name}.txt`)); } catch { return null; } }, getQuestSourceLines: lines },
    playerEntity: { name: 'Hero', level: 8, gender: 'male', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(10),
      guildMemberships: { mortal: { 41: { guild: 'FightersGuild', rank: 1 } }, vampire: {} } },
    offerReward: () => {},
  });
  const quest = bridge.machine.startQuestByName('M0B00Y06', 0);
  quest.getTask({ name: 'mondead' }).start();
  quest.getTask({ name: 'qgclicked' }).start();
  bridge.machine.tick();
  const offerTitle = () => bridge.journalClean.offers()[0]?.title;
  const title = () => bridge.questLog().ladders.find((l) => l.key === 'FightersGuild').rungs.flatMap((r) => r.quests).find((q) => q.name === 'M0B00Y06').title;
  const was = title();
  assert.notEqual(was, 'The Renamed Beast');
  assert.equal(offerTitle(), was, 'the reward named as the ladder names its quest');
  renamed = true;
  assert.equal(title(), was, 'kept while the text stands');
  assert.equal(offerTitle(), was, 'kept with it');
  setLocale('de');
  try {
    assert.equal(title(), 'The Renamed Beast', 'a locale switched reads it again');
    assert.equal(offerTitle(), 'The Renamed Beast', 'and the waiting reward\'s name with it');
  } finally { setLocale(BASE_LOCALE); }
});

test('QL1 the bridge leaves a quest begun with the switch off as DFU\'s: no objectives, no reward added', () => {
  setPref(QUESTLINES_PREF, false);
  const offers = [];
  const bridge = makeBridge({ onQuestlineOffer: (o) => offers.push(o) });
  const quest = bridge.machine.startQuestByName('M0B00Y06', 0);
  assert.equal(quest.ql, null);
  assert.equal(bridge.questlines.rowOf(quest), null);
  setPref(QUESTLINES_PREF, true);   // turned on mid-quest: the quest keeps the rules it began with
  quest.getTask({ name: 'mondead' }).start();
  quest.getTask({ name: 'qgclicked' }).start();
  for (let i = 0; i < 6; i++) bridge.machine.tick();
  assert.equal(offers.length, 0);
  assert.equal(quest.ql, null);
  const log = bridge.questLog();
  assert.ok(log.ended.every((r) => r.ql === null) && log.active.every((r) => r.ql === null));
});

// ---- AUDIT QUESTLINES LAW-6: four claims of the record, each held by a quest of the pack through the real bridge ----

/** A bridge over the pack as the game reads it (the questlines' patches while the switch is on - test/qlSources.mjs), the
 *  world's half headless: an action that needs a scene finishes quietly. */
function packBridge(over = {}) {
  loadPackTables();
  setPref(QUESTLINES_PREF, true);
  const rec = { offers: [], rep: [], rewards: [], gold: [] };
  let now = 1000;
  const bridge = createQuestBridge({
    data: { readListTable: (name) => { try { return read(join(VENDOR, 'Tables', `QuestList-${name}.txt`)); } catch { return null; } }, getQuestSourceLines: (n) => questSource(n, true) },
    classicSeconds: () => now, nowSeconds: () => now, worldSeconds: () => now,
    playerEntity: { name: 'Hero', level: 10, gender: 'male', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30) },
    getReputation: () => 0, carriesQuestItem: () => false,
    onQuestlineOffer: (o) => rec.offers.push(o), changeReputation: (fid, amount) => rec.rep.push([fid, amount]),
    offerReward: (_q, item) => rec.rewards.push(item), addGold: (n) => rec.gold.push(n),
    ...over,
  });
  const start = (name) => {
    const warn = console.warn; console.warn = () => {};
    try {
      const q = bridge.machine.startQuestByName(name, 0);
      for (const t of q.tasks.values()) for (const a of t.actions) if (!a.isTriggerCondition) { const up = a.update.bind(a); a.update = (c) => { try { up(c); } catch { a.setComplete(); } }; }
      return q;
    } finally { console.warn = warn; }
  };
  const tick = (n = 1) => { const warn = console.warn; console.warn = () => {}; try { for (let i = 0; i < n; i++) { now += 60; bridge.machine.tick(); bridge.questlines.look(); } } finally { console.warn = warn; } };
  return { bridge, rec, start, tick };
}

test('AUDIT QUESTLINES LAW-6: a success whose own row\'s binding no longer holds as it ends settles its success, never the catch-all failure - the catch-all yields to DFU\'s word that it succeeded (mutants: the catch-all yield deleted)', () => {
  const layer = createQuestlines({ machine: { quests: new Map() }, ctx: {} });
  const quest = (questSuccess) => ({
    questName: 'M0B00Y06', uid: questSuccess ? 1 : 2, questStartTime: 0, questComplete: false, questSuccess, hooks: {},
    tasks: new Map([['S.02', { getTriggerValue: () => false }]]), resources: new Map(), activeLogMessages: new Map(),
    ql: { ...freshState(), paid: questSuccess },
  });
  const paid = quest(true);
  layer.ending(paid);   // its reward task's `_S.02_` cleared again before `end quest`: only `{ ended: true }` holds
  assert.equal(paid.ql.outcome, 'done', 'paid: its success');
  const lapsed = quest(false);
  layer.ending(lapsed);
  assert.equal(lapsed.ql.outcome, 'failed', 'unpaid: the catch-all');
});

test('AUDIT QUESTLINES LAW-6: Nocturnal\'s summoning (40C00Y00) paid and ended an hour later settles `done`, never "lapsed unfulfilled"', () => {
  const { rec, start, tick } = packBridge();
  const q = start('40C00Y00');
  tick(2);
  q.resources.get('monster').killCount = 1; tick(2);   // the mage dead: _S.05_
  const click = q.getTask({ name: 'S.04' }).actions.find((a) => a.typeName === 'ClickedNpc');
  click.checkTrigger = () => true; tick(1); click.checkTrigger = () => false;   // Nocturnal's slave: _S.06_ pays, unsets _S.04_
  assert.equal(q.questSuccess, true, 'paid');
  tick(3);
  assert.equal(q.getTask({ name: 'S.06' }).getTriggerValue(), false, 'its success task no longer holds');
  q.resources.get('bonk').remainingTimeInSeconds = 0; tick(4);   // `_bonk_`: end quest
  assert.equal(q.ql.outcome, 'done', 'never "The contract with Nocturnal lapsed unfulfilled" for a player it paid');
  assert.equal(rec.offers.length, 0, '`own`: the Prince\'s artifact is the reward');
});

test('AUDIT QUESTLINES LAW-6: the werewolf\'s cure ($CUREWER) closed by the system that cured it - machine.tombstoneQuest\'s `ended` - settles there: `cured` (mutants: tombstoneQuest\'s ended settle deleted)', () => {
  const { bridge, start, tick } = packBridge();
  const q = start('$CUREWER');
  tick(2);
  q.getTask({ name: 'S.14' }).start();   // the child drank the blood
  bridge.machine.tombstoneQuest(q, { ended: true });   // lycanthropy.js endLycanthropy's close (world.js tombstoneQuestsByName)
  assert.equal(q.ql.outcome, 'cured');
  assert.equal(q.ql.moved, true, 'settled once, at the tombstone');
});

test('AUDIT QUESTLINES LAW-6: M0B00Y06 whose time runs out inside its hand-in\'s grace ends twice - and settles ONCE: one choice of gear, one outcome (mutants: ending\'s moved guard deleted)', () => {
  const { bridge, rec, start, tick } = packBridge();
  const q = start('M0B00Y06');
  let ends = 0;
  const end = q.endQuest.bind(q);
  q.endQuest = () => { ends++; return end(); };
  tick(1);
  q.getTask({ name: 'mondead' }).start(); q.getTask({ name: 'qgclicked' }).start();
  // the hand-in: gold, `end quest` - a tick, or two where the script's last task (the tiger, picked one in four) said its
  // line and broke the next one whole (Quest.cs reads the break before each task)
  for (let i = 0; i < 2 && !q.ql.paid; i++) tick(1);
  assert.equal(q.ql.paid, true);
  const clock = q.resources.get('2dung');
  clock.remainingTimeInSeconds = 0; clock.clockEnabled = true;   // the time limit runs out inside the grace: its own `end quest`
  tick(5);
  assert.equal(ends, 2, 'the script ended it twice');
  assert.equal(rec.offers.length, 1, 'one choice of gear');
  assert.equal(q.ql.outcome, 'done');
  assert.equal(bridge.questlines.ending(q), null, 'a third end changes nothing');
  assert.equal(rec.offers.length, 1);
});

test('AUDIT QUESTLINES LAW-6: QLWR04\'s courier letter (`give pc _letter_ notify`) pays nothing - the quest stays unpaid and its mercy\'s gold is scaled x1.25; a second gold reward is never scaled again (mutants: reward\'s letter rule deleted; reward\'s paid guard on the gold deleted)', () => {
  const { rec, start, tick } = packBridge({ playerEntity: { name: 'Hero', level: 20, gender: 'male', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30) } });
  const q = start('QLWR04');
  for (const t of q.tasks.values()) for (const a of t.actions) if (a.typeName === 'PlaceNpc') a.isComplete = true;
  for (const a of q.getTask({ name: 'courier' }).actions) if (a.typeName === 'GivePc') a.offerImmediatelyNow();
  q.getTask({ name: 'courier' }).start(); tick(3);   // the courier's letter arrives
  assert.equal(q.ql.paid, false, 'a letter is the quest\'s mail, never its pay');
  const gold = q.getItem({ name: 'gold' }).daggerfallUnityItem;
  const minted = gold.stackCount;
  q.getTask({ name: 'tomercy' }).start(); tick(6);
  assert.equal(q.ql.outcome, 'mercy');
  assert.equal(gold.stackCount, Math.round(minted * 1.25), 'greater: x1.25 at GivePc');
  assert.ok(rec.rewards.includes(gold), 'the scaled purse is the one offered');
  const second = goldStack(200);
  q.hooks.questReward(q, second, { itemName: 'gold' });   // a second `give pc` of gold: the quest already paid
  assert.equal(second.stackCount, 200, 'scaled once a quest');
});
