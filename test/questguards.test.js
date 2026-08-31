// QG1 - THE LAST RETIRABLE GUARDS (2026-08-28). CastEffectDo,
// ClickedFoe and PromptMulti become real ActionTemplates on the Q5
// harness, and the READY-SPELL DOORS go live: the machine has declared
// notifyNewReadySpell/notifyCastReadySpell and the two world reads
// (getClassicSpellEffects / spellHasMatchForClassicEffect) since the
// Q arc, and NOTHING production-side raised or answered them - so the
// three corpus quests that write `cast X spell do` (Banish_Daedra,
// Open, Sleep) parsed to a completed template and a trigger that could
// never fire. The registry keeps exactly ONE guard now: WorldUpdate,
// whose blocker (the world-data variant system) is real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { defaultActionTemplates, CastEffectDo, ClickedFoe, PromptMulti, CastSpellDo } from '../src/systems/quest/actions.js';
import { pickQuestFoe, DEFAULT_ACTIVATION_DISTANCE } from '../src/player/activate.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
const readSrc = (p) => readFileSync(p, 'utf8');
const sources = {};
for (const f of readdirSync(join(VENDOR, 'Tables'))) {
  if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
}
loadQuestTables(sources);

function makeMachine(overrides = {}) {
  const calls = [];
  const capture = (name) => (...args) => { calls.push([name, ...args]); };
  const world = {
    currentRegionIndex: () => 0,
    isPlayerInLocationRect: () => true,
    currentLocation: () => ({ loaded: true, mapTableData: { locationType: 0 } }),
    getFactionData: () => null,
    getClassicSpellEffects: (id) => overrides.classicSpells?.[id] ?? null,
    spellHasMatchForClassicEffect: (sp, effect) => (sp?.effects ?? []).some((e) =>
      ((e.type ?? 0) & 0xff) === ((effect.type ?? 0) & 0xff)
      && ((e.subType ?? 0) & 0xff) === ((effect.subType ?? 0) & 0xff)),
  };
  const m = new QuestMachine({
    nowSeconds: () => 0,
    world,
    playerEntity: { isPlayer: true, level: 5, activeEffects: [] },
    getGoldPieces: () => (m.pieces ?? 0),
    deductGoldPieces: (n) => { m.pieces -= n; calls.push(['deductGoldPieces', n]); },
    showPopup: capture('showPopup'),
    showPromptMulti: (q, message, buttons, respond) => {
      calls.push(['showPromptMulti', message.id, [...buttons]]);
      m.lastRespond = respond;
    },
    ...overrides.deps,
  });
  m.calls = calls;
  m.of = (name) => calls.filter((c) => c[0] === name);
  return m;
}

const HEADER = ['Quest: __QG1', 'QRC:', 'Message:  1011', ' x', '', 'Message:  1072', ' which way?', '', 'QBN:'];
const schedule = (m, qbn) => m.scheduleQuest([...HEADER, ...qbn], 0, { rolls: () => 0.4 });
const trig = (q, name) => q.getTask({ name }).getTriggerValue();

// ── the registry ─────────────────────────────────────────────────

test('QG1: ONE guard stands - WorldUpdate - and the three retired slots hold their classes', () => {
  const templates = defaultActionTemplates();
  const guards = templates.filter((t) => t.constructor.name === 'PendingTrigger');
  assert.equal(guards.length, 1, 'only WorldUpdate still pends');
  assert.match(guards[0].pattern.source, /^worldupdate /);
  // the retired three sit in the registry as real templates, in the
  // C# registration order (CastSpellDo then CastEffectDo, verbatim)
  const names = templates.map((t) => t.constructor.name);
  assert.ok(names.includes('CastEffectDo'));
  assert.ok(names.includes('ClickedFoe'));
  assert.ok(names.includes('PromptMulti'));
  assert.equal(names[names.indexOf('CastSpellDo') + 1], 'CastEffectDo',
    'QuestMachine.cs registers CastEffectDo right after CastSpellDo');
  assert.equal(names[names.length - 1], 'PromptMulti', 'PromptMulti is the last registration');
});

// ── CastEffectDo ─────────────────────────────────────────────────

test('QG1 CastEffectDo: parse, the latch, the fire, and the deaf-after-complete quirk', () => {
  // BARE QBN lines form the STARTUP task - the harness's own first
  // lesson (Q5); a named task never runs untriggered, and an update
  // action only updates inside a running task.
  const m = makeMachine();
  const q = schedule(m, [
    'cast Levitate effect do _done_', '',
    '_done_ task:', ' say 1004', '',
  ]);
  const startup = [...q.tasks.values()].find((t) => t.actions.some((a) => a instanceof CastEffectDo));
  assert.ok(startup, 'the bare line minted a real CastEffectDo in the startup task');
  const action = startup.actions.find((a) => a instanceof CastEffectDo);
  assert.equal(action.effectKey, 'Levitate', 'DFU\'s own per-class key literal, via dfuEffectKeyOf');
  assert.equal(action.taskSymbol.name, 'done');

  // a readied spell that does not carry the effect: the latch is KEPT
  // (CastEffectDo.cs:69-77 has no clear on the miss fall-through -
  // unlike CastSpellDo, which consumes one bundle per evaluation)
  m.notifyNewReadySpell({ effects: [{ type: 1, subType: 2 }] });
  m.tick();
  assert.ok(action.lastReadySpell, 'a MISS keeps the latch - the C# quirk, pinned');
  assert.equal(trig(q, 'done'), false);

  // a CAST clears it
  m.notifyCastReadySpell({});
  assert.equal(action.lastReadySpell, null);

  // the matching pair fires the task and completes
  m.notifyNewReadySpell({ effects: [{ type: 1, subType: 2 }, { type: 14, subType: 255 }] });
  m.tick();
  assert.equal(trig(q, 'done'), true, 'the task started');
  assert.equal(action.isComplete, true);

  // SetComplete unsubscribed - further readies are invisible, and the
  // STALE bundle stays latched (C# never clears it either; the same
  // deaf-after-complete shape CastSpellDo records)
  const stale = action.lastReadySpell;
  m.notifyNewReadySpell({ effects: [{ type: 9, subType: 9 }] });
  assert.equal(action.lastReadySpell, stale, 'deaf after complete, never rebound');
});

test('QG1 dfuEffectKeyOf: DFU\'s per-class key literals, derived - spaces out, subgroup hyphenated', async () => {
  const { dfuEffectKeyOf } = await import('../src/systems/spellEffects.js');
  assert.equal(dfuEffectKeyOf(14, 255), 'Levitate', 'Levitate.cs:23');
  assert.equal(dfuEffectKeyOf(14, -1), 'Levitate', 'the -1/255 byte fold, records vs registry');
  assert.equal(dfuEffectKeyOf(1, 2), 'ContinuousDamage-SpellPoints',
    'ContinuousDamageSpellPoints.cs:24 - both halves lose their spaces');
  assert.equal(dfuEffectKeyOf(7, 0), 'Drain-Strength', 'DrainStrength.cs:22');
  assert.equal(dfuEffectKeyOf(200, 200), null, 'a pair the registry does not carry');
});

test('QG1 CastEffectDo: the validate arm eats the latch like the sibling', () => {
  const action = new CastEffectDo(null);
  action.effectKey = null;   // unresolvable
  action.onNewReadySpell({ effects: [{ type: 1, subType: 1 }] });
  assert.ok(action.lastReadySpell);
  action.parentQuest = { hooks: {} };
  action.update(null);
  assert.equal(action.lastReadySpell, null, ':62-66 clears on the way out');
});

// ── ClickedFoe ───────────────────────────────────────────────────

test('QG1 ClickedFoe: the plain click triggers and rearms; the say forms are Say-shadowed, in C# too', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Foe _crook_ is Thief', '',
    '_start_ task:', ' clicked foe _crook_', '',
  ]);
  const start = q.getTask({ name: 'start' });
  assert.ok(start.actions.some((a) => a instanceof ClickedFoe), 'the plain form reaches the class');
  const foe = q.getFoe({ name: 'crook' });
  assert.ok(foe, 'the Foe resource stands');
  m.tick();
  assert.equal(trig(q, 'start'), false, 'unclicked');
  foe.setPlayerClicked();
  m.tick();
  assert.equal(trig(q, 'start'), true, 'the click fired the trigger');
  assert.equal(foe.hasPlayerClicked, false, 'ScheduleClickRearm consumed the click');

  // FIRST-COME-FIRST-SERVE: the rearm drains BETWEEN tasks
  // (Quest.cs:353-364), so a second task watching the same foe in the
  // same tick never sees the click - the base postTick clear alone
  // would let both fire.
  const mFF = makeMachine();
  const qFF = schedule(mFF, [
    'Foe _crook_ is Thief', '',
    '_first_ task:', ' clicked foe _crook_', '',
    '_second_ task:', ' clicked foe _crook_', '',
  ]);
  qFF.getFoe({ name: 'crook' }).setPlayerClicked();
  mFF.tick();
  assert.equal(trig(qFF, 'first'), true, 'the first watcher takes the click');
  assert.equal(trig(qFF, 'second'), false, 'and consumes it before the second runs');

  // THE SHADOW, pinned: Test() is unanchored and Say registers at
  // QuestMachine.cs:366, ClickedFoe at :417 - so the say form mints a
  // SAY in DFU and must mint a Say here (the UnrestrainFoe quirk's
  // shape; ClickedNpc escapes only because triggers register first).
  const m2 = makeMachine();
  const q2 = schedule(m2, [
    'Foe _crook_ is Thief', '',
    '_start_ task:', ' clicked foe _crook_ say 1011', '',
  ]);
  const shadowed = q2.getTask({ name: 'start' });
  assert.ok(shadowed.actions.some((a) => a.constructor.name === 'Say'),
    'the say form is EATEN by Say - quirk preserved, not fixed');
  assert.ok(!shadowed.actions.some((a) => a instanceof ClickedFoe));

  // the say ARM still exists for direct construction (and the save
  // shape), exactly as upstream - driven here by hand
  const m3 = makeMachine();
  const q3 = schedule(m3, [
    'Foe _crook_ is Thief', '',
    '_start_ task:', ' clicked foe _crook_', '',
  ]);
  const direct = q3.getTask({ name: 'start' }).actions.find((a) => a instanceof ClickedFoe);
  direct.id = 1011;
  q3.getFoe({ name: 'crook' }).setPlayerClicked();
  m3.tick();
  assert.equal(m3.of('showPopup').length, 1, 'the id arm pops when the field is set');
});

test('QG1 ClickedFoe: the gold arm - COINS alone, deducted on covering, the otherwise-task on failing', () => {
  const m = makeMachine();
  m.pieces = 50;
  const q = schedule(m, [
    'Foe _crook_ is Thief', '',
    '_start_ task:', ' clicked foe _crook_ and at least 100 gold otherwise do _poor_', '',
    '_poor_ task:', ' say 1004', '',
  ]);
  const foe = q.getFoe({ name: 'crook' });
  foe.setPlayerClicked();
  m.tick();
  assert.equal(trig(q, 'start'), false, 'too poor - the trigger must NOT fire (:96-100)');
  assert.equal(trig(q, 'poor'), true, 'the otherwise-task started instead');
  assert.equal(m.pieces, 50, 'an uncovered click deducts NOTHING');

  const m2 = makeMachine();
  m2.pieces = 150;
  const q2 = schedule(m2, [
    'Foe _crook_ is Thief', '',
    '_start_ task:', ' clicked foe _crook_ and at least 100 gold otherwise do _poor_', '',
    '_poor_ task:', ' say 1004', '',
  ]);
  q2.getFoe({ name: 'crook' }).setPlayerClicked();
  m2.tick();
  assert.equal(trig(q2, 'start'), true, 'covered - the trigger fires');
  assert.equal(m2.pieces, 50, 'and the coins are spent (GoldPieces -= goldAmount, :94)');
  assert.equal(trig(q2, 'poor'), false);
});

// ── PromptMulti ──────────────────────────────────────────────────

test('QG1 PromptMulti: the C# header\'s own example parses whole - four buttons, colon notes discarded', () => {
  const action = new PromptMulti(null).createNew(
    'promptmulti 1072 4:noChoice _dirRand_ 24:south _headS_ 25:west _headW_ 28:swest _headSW_', null);
  assert.ok(action);
  assert.equal(action.id, 1072);
  assert.deepEqual(
    [action.opt1button, action.opt2button, action.opt3button, action.opt4button],
    [4, 24, 25, 28],
    'the numbers are BUTTONS.RCI records, unchecked past the named enum exactly as the C# cast');
  assert.deepEqual(
    [action.opt1TaskSymbol.name, action.opt2TaskSymbol.name, action.opt3TaskSymbol.name, action.opt4TaskSymbol.name],
    ['dirRand', 'headS', 'headW', 'headSW']);
  // the two- and three-option forms
  const three = new PromptMulti(null).createNew('promptmulti 1010 3 _a_ 4 _b_ 5 _c_', null);
  assert.equal(three.opt3button, 5);
  assert.equal(three.opt4TaskSymbol, null);
  const two = new PromptMulti(null).createNew('promptmulti 1010 3 _a_ 4 _b_', null);
  assert.equal(two.opt3TaskSymbol, null);
  assert.equal(two.opt2TaskSymbol.name, 'b');
});

test('QG1 PromptMulti: shows through the hook, completes at SHOW, routes the click by button VALUE', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'promptmulti 1072 4:noChoice _a_ 24:south _b_ 25:west _c_', '',
    '_a_ task:', ' say 1004', '',
    '_b_ task:', ' say 1004', '',
    '_c_ task:', ' say 1004', '',
  ]);
  m.tick();
  const shown = m.of('showPromptMulti');
  assert.equal(shown.length, 1, 'the box showed once - allowRearm false, complete at show');
  assert.deepEqual(shown[0][2], [4, 24, 25], 'the declared buttons, in order, 3-option form');
  assert.equal(shown[0][1], 1072, 'over the declared message');
  // the player clicks button 25 - the west task starts, alone
  m.lastRespond(25);
  m.tick();
  assert.equal(trig(q, 'c'), true);
  assert.equal(trig(q, 'a'), false);
  assert.equal(trig(q, 'b'), false);
});

test('QG1 PromptMulti: a missing message shows no box and still completes - Prompt\'s recorded arm', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'promptmulti 9999 3 _a_ 4 _b_', '',
    '_a_ task:', ' say 1004', '',
    '_b_ task:', ' say 1004', '',
  ]);
  m.tick();
  assert.equal(m.of('showPromptMulti').length, 0);
  const startup = [...q.tasks.values()].find((t) => t.actions.some((a) => a instanceof PromptMulti));
  const action = startup.actions.find((a) => a instanceof PromptMulti);
  assert.equal(action.isComplete, true);
});

// ── CastSpellDo goes LIVE - the doors it waited on ───────────────

test('QG1: `cast X spell do` fires end to end once the world answers and the host raises', () => {
  // The three corpus quests write this line; until QG1 nothing raised
  // notifyNewReadySpell and nothing answered getClassicSpellEffects,
  // so createNew completed the template and the trigger was dead.
  const m = makeMachine({
    classicSpells: { 18: [{ type: 30, subType: 255 }, { type: -1 }, { type: -1 }] },
  });
  const q = schedule(m, [
    'cast Open spell do _done_', '',
    '_done_ task:', ' say 1004', '',
  ]);
  const startup = [...q.tasks.values()].find((t) => t.actions.some((a) => a instanceof CastSpellDo));
  const action = startup?.actions.find((a) => a instanceof CastSpellDo);
  assert.ok(action);
  assert.notEqual(action.spellID, -1, 'the Quests-Spells row resolved');
  assert.ok(action.classicEffects?.length, 'and the world hook answered the record');
  // ready a spell carrying the classic (30,255) pair - subType byte-folds (-1 -> 255)
  m.notifyNewReadySpell({ effects: [{ type: 30, subType: -1 }] });
  m.tick();
  assert.equal(trig(q, 'done'), true, 'the readied spell matched and the task started');
});

// ── the foe-click door ───────────────────────────────────────────

test('QG1 pickQuestFoe: nearest live quest foe under the ray, within reach, walls block', () => {
  const mkFoe = (x, opts = {}) => ({
    dead: false, questBehaviour: { targetSymbol: { name: 'x' } },
    ai: { feet: [x, 0, 0], height: 1.8 }, ...opts,
  });
  const eye = [0, 1, 0];
  const dir = [1, 0, 0];
  const open = { raycast: () => Infinity };
  assert.equal(DEFAULT_ACTIVATION_DISTANCE, 3.2, 'PlayerActivate.cs:77 - 128 * GlobalScale');
  // nearest wins
  const near = mkFoe(2), far = mkFoe(3);
  assert.equal(pickQuestFoe(eye, dir, [far, near], open), near);
  // beyond the activation distance: nothing
  assert.equal(pickQuestFoe(eye, dir, [mkFoe(4)], open), null);
  // dead foes and plain (non-quest) foes never answer
  assert.equal(pickQuestFoe(eye, dir, [mkFoe(2, { dead: true })], open), null);
  assert.equal(pickQuestFoe(eye, dir, [mkFoe(2, { questBehaviour: null })], open), null);
  // a wall strictly in front of the foe blocks the click
  const walled = { raycast: () => 1.0 };
  assert.equal(pickQuestFoe(eye, dir, [mkFoe(2)], walled), null);
  // off-ray: a foe well to the side is not hit
  assert.equal(pickQuestFoe(eye, dir, [mkFoe(2, { ai: { feet: [2, 0, 3], height: 1.8 } })], open), null);
});

// ── the host seams, source-pinned (headless cannot boot a canvas) ─

test('QG1 seams: the ready-spell doors are raised by the cast engine and routed by both hosts', () => {
  const hm = readSrc('src/scenes/hostMagic.js');
  assert.match(hm, /onNewReadySpell\?\.\(sp\);\s+\/\/ :348/,
    'SetReadySpell raises NEW after the assignment');
  assert.equal((hm.match(/onCastReadySpell\?\.\(sp\);/g) ?? []).length, 4,
    'every release path raises CAST - self, touch, area, missile - before the ready clears');
  const world = readSrc('src/scenes/world.js');
  assert.match(world, /onNewReadySpell: \(sp\) => questBridge\?\.machine\?\.notifyNewReadySpell\?\.\(sp\)/);
  // MW-D39: the cast moment now also runs the arm's spellcast release;
  // the quest notify is still the FIRST thing it does.
  assert.match(world, /onCastReadySpell: \(sp\) => \{\n\s+questBridge\?\.machine\?\.notifyCastReadySpell\?\.\(sp\);/);
  const dc = readSrc('src/scenes/dungeonContext.js');
  assert.match(dc, /onNewReadySpell: \(sp\) => opts\.questBridge\?\.machine\?\.notifyNewReadySpell\?\.\(sp\)/,
    'the dungeon host\'s own engine raises into the same machine');
});

test('QG1 seams: the two world reads stand on questWorld, byte-folded like MakeClassicKey', () => {
  const world = readSrc('src/scenes/world.js');
  assert.match(world, /getClassicSpellEffects: \(spellID\) => spellRecordOfIndex\(spellID\)\?\.effects \?\? null/,
    'the G4 SPELLS.STD registry answers the record');
  assert.match(world, /\(\(e\.type \?\? 0\) & 0xff\) === \(\(effect\.type \?\? 0\) & 0xff\)/,
    'HasMatchForClassicEffect folds through the byte cast, both sides');
});

test('QG1 seams: the foe-click arm runs FIRST, skips Info mode, and does not consume', () => {
  for (const [file, poolExpr] of [
    ['src/scenes/world.js', /pickQuestFoe\(cam\.pos, useFwd, \[\.\.\.exteriorFoes\.foes, \.\.\.cityGuards\.guards\], collider\)/],
    ['src/scenes/worldModes.js', /pickQuestFoe\(eye, dir, dungeonCtx\.foes, dungeonCtx\.collider\)/],
  ]) {
    const src = readSrc(file);
    assert.match(src, poolExpr, `${file} picks over its live pool`);
    assert.match(src, /getInteractionMode\(\) !== 'info'[^]{0,400}?\.questBehaviour\.doClick\(\)/,
      `${file} gates on Info and clicks through the behaviour`);
  }
  // non-consuming: world.js's arm sits ABOVE the townTalk activation
  const world = readSrc('src/scenes/world.js');
  assert.ok(world.indexOf('qf.questBehaviour.doClick()') < world.indexOf('townTalk.tryActivate(cam.pos'),
    'PlayerActivate.cs:325-339 - the quest-resource arm opens the ladder and falls through');
});

test('QG1 seams: the PromptMulti box contract - click-only, no cancel, records by value', () => {
  const sfw = readSrc('src/ui/guildServiceWindows.js');
  assert.match(sfw, /if \(t\.buttonsMulti\) return;/,
    'the multi box takes NO keys - AllowCancel false, PromptMulti.cs:87-88');
  assert.match(sfw, /t\.buttonsMulti\.includes\(hit\)\) this\._advance\(t\.onButton\?\.\(hit\) \?\? null\);/,
    'only a real button advances, answering its record number');
  assert.match(sfw, /\(t\.buttonsMulti \?\? \[\]\)/, 'the layout draws the declared records');
  const world = readSrc('src/scenes/world.js');
  assert.match(world, /showPromptMulti: \(q, message, buttons, respond\) => showQuestBox\(\{/,
    'the world host mounts the door');
});
