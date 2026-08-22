// Q3-iii - FOE SPAWNING: CreateFoe's tick-driven spawn law over the
// new deps.world foe seam (createFoeGameObjects/tryPlaceFoe as
// GameObjectHelper.CreateFoeGameObjects and TryPlacement+
// PlaceFoeFreely), CastSpellOnFoe's queue with both C# quirks kept,
// and Foe.SetFoeName's world half (monster names through classic
// srand, the 55%-male humanoid roll, the grounded enemyNames list)
// with the namePending headless charter.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { GENDERS } from '../src/characters/nameHelper.js';
import { srand } from '../src/formats/dfRandom.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');

function loadTables() {
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  }
  loadQuestTables(sources);
}
loadTables();

// ---- the crafted foe seam ----

function makeWorld() {
  const world = {
    currentRegionIndex: () => 0,
    isPlayerInLocationRect: () => world._inRect,
    createFoeGameObjects: (foe, count) => {
      world.created.push([foe.symbol.name, count]);
      if (world._failCreate) return null;
      return Array.from({ length: count }, (_, i) => ({ foe: foe.symbol.name, i }));
    },
    tryPlaceFoe: (handle) => {
      if (world._placeFails > 0) { world._placeFails--; return false; }
      world.placed.push(handle);
      return true;
    },
    raiseOnEncounterEvent: () => { world.encounters++; },
    _inRect: true, _failCreate: false, _placeFails: 0,
    created: [], placed: [], encounters: 0,
  };
  return world;
}

function makeMachine(world) {
  const calls = [];
  const clock = { t: 100000 };
  const m = new QuestMachine({
    nowSeconds: () => clock.t,
    world,
    showPopup: (_q, message) => calls.push(['showPopup', message]),
  });
  m.clock = clock;
  m.calls = calls;
  m.of = (name) => calls.filter((c) => c[0] === name);
  return m;
}

const HEADER = ['Quest: __QF', 'QRC:', 'Message:  1011', ' x', '', 'QBN:'];
const seq = (arr, tail = 0.4) => () => (arr.length ? arr.shift() : tail);
const schedule = (m, qbn, rolls = () => 0.4) => m.scheduleQuest([...HEADER, ...qbn], 0, { rolls });
const createFoeOf = (q) => [...q.tasks.values()][0].actions.find((a) => a.constructor.name === 'CreateFoe');

// ---------------------------------------------------------------

test('CreateFoe parse: all four forms, the msg option, and send-without-count = infinite', () => {
  const m = makeMachine(null);
  const q = schedule(m, [
    'Foe _rat_ is Giant_rat', '',
    ' create foe _rat_ every 5 minutes 3 times with 40% success msg 1011',
    ' create foe _rat_ every 2 minutes indefinitely with 100% success',
    ' send _rat_ every 70 minutes 10 times with 10% success',
    ' send _rat_ every 1410 minutes with 100% success',
  ]);
  const acts = [...q.tasks.values()][0].actions.filter((a) => a.constructor.name === 'CreateFoe');
  assert.equal(acts.length, 4);
  const [a, b, c, d] = acts;
  assert.deepEqual([a.spawnInterval, a.spawnMaxTimes, a.spawnChance, a.msgMessageID, a.isSendAction],
    [300, 3, 40, 1011, false], 'minutes*60, count, percent, the msg option');
  assert.deepEqual([b.spawnInterval, b.spawnMaxTimes, b.msgMessageID], [120, -1, -1], 'indefinitely = -1');
  assert.deepEqual([c.spawnInterval, c.spawnMaxTimes, c.isSendAction], [4200, 10, true]);
  assert.deepEqual([d.spawnMaxTimes, d.isSendAction], [-1, true], '"send" without a count implies infinite');
});

test('the spawn cycle whole: backdate, wave placement one per tick, msg once, counter at wave end, the max gate', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  // parse (monster name) takes 2 rolls; backdate 0.999 -> floor(.999*60)=59;
  // chance 100% never fails (Range(0,100) max 99)
  const q = schedule(m, [
    'Foe _rat_ is 2 Giant_rat', '',
    ' create foe _rat_ every 1 minutes 2 times with 100% success msg 1011',
  ], seq([0.1, 0.1, 0.999]));
  const act = createFoeOf(q);

  m.tick();   // backdate: lastSpawnTime = 100000 - 59 = 99941; not due (due at 100001)
  assert.equal(world.created.length, 0, 'the backdated timer still waits out the remainder');
  m.clock.t = 100001;
  m.tick();   // due -> chance ok -> wave of 2 minted, first handle placed, msg fires
  assert.deepEqual(world.created, [['rat', 2]], 'CreateFoeGameObjects(foe, spawnCount)');
  assert.equal(world.placed.length, 1, 'one placement attempt per tick');
  assert.equal(m.of('showPopup').length, 1, 'msg on the FIRST placed foe only');
  m.tick();   // second handle placed
  assert.equal(world.placed.length, 2);
  assert.equal(m.of('showPopup').length, 1, 'the msg never repeats');
  assert.equal(act.spawnCounter, 0, 'the wave has not been counted yet');
  m.tick();   // the wave is complete: counter++ and the cycle ends
  assert.equal(act.spawnCounter, 1);
  assert.ok(world.encounters >= 2, 'RaiseOnEncounterEvent rode the pending ticks');

  // wave 2 becomes due a full interval after wave 1 STARTED
  m.clock.t = 100061;
  m.tick(); m.tick(); m.tick();
  assert.equal(world.created.length, 2);
  assert.equal(act.spawnCounter, 2);

  // the max gate holds until a rearm
  m.clock.t = 100200;
  m.tick(); m.tick();
  assert.equal(world.created.length, 2, 'spawnMaxTimes reached - no further waves');

  // InitialiseOnSet: a task rearm restarts the cycle whole. The
  // untriggered state must be OBSERVED by an update (prevTriggered
  // follows the update tail), so the edge is clear->tick->start->tick
  const startup = [...q.tasks.values()][0];
  startup.clear(); m.tick(); startup.start();
  m.tick();
  assert.equal(act.spawnCounter, 0, 'the rearm reset the counter');
  m.clock.t = 100260;
  m.tick();
  assert.equal(world.created.length, 3, 'the cycle runs again after the rearm');
});

test('a failed chance roll consumes the WHOLE interval before the next try', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  // backdate 0.999 -> due at 100001; chance 20: roll 0.9 -> 90 >= 20 FAILS
  schedule(m, [
    'Foe _rat_ is Giant_rat', '',
    ' create foe _rat_ every 1 minutes 5 times with 20% success',
  ], seq([0.1, 0.1, 0.999, 0.9, 0.1]));
  m.tick();
  m.clock.t = 100001;
  m.tick();   // due, roll fails - but lastSpawnTime was already consumed
  assert.equal(world.created.length, 0);
  m.clock.t = 100060;
  m.tick();
  assert.equal(world.created.length, 0, 'not due again until a full interval after the FAILED try');
  m.clock.t = 100061;
  m.tick();   // due again, roll 0.1 -> 10 < 20 succeeds
  assert.equal(world.created.length, 1);
});

test('a hidden foe blocks the spawn but the interval is already spent', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Foe _rat_ is Giant_rat', '',
    ' create foe _rat_ every 1 minutes 5 times with 100% success',
  ], seq([0.1, 0.1, 0.999]));
  q.getResource({ name: 'rat' }).isHidden = true;
  m.tick();
  m.clock.t = 100001;
  m.tick();
  assert.equal(world.created.length, 0, 'hidden - no wave');
  q.getResource({ name: 'rat' }).isHidden = false;
  m.clock.t = 100002;
  m.tick();
  assert.equal(world.created.length, 0, 'the interval was consumed by the blocked try');
  m.clock.t = 100061;
  m.tick();
  assert.equal(world.created.length, 1);
});

test('the send gate: placement waits until the player stands in a location rect', () => {
  const world = makeWorld();
  world._inRect = false;
  const m = makeMachine(world);
  schedule(m, [
    'Foe _rat_ is Giant_rat', '',
    ' send _rat_ every 1 minutes 3 times with 100% success',
  ], seq([0.1, 0.1, 0.999]));
  m.tick();
  m.clock.t = 100001;
  m.tick(); m.tick(); m.tick();
  assert.equal(world.created.length, 1, 'the wave minted');
  assert.equal(world.placed.length, 0, 'but placement holds outside the rect');
  world._inRect = true;
  m.tick();
  assert.equal(world.placed.length, 1, 'the player arrived - the pending wave lands');
});

test('a failed tryPlaceFoe is retried next tick without losing the handle', () => {
  const world = makeWorld();
  world._placeFails = 2;
  const m = makeMachine(world);
  schedule(m, [
    'Foe _rat_ is Giant_rat', '',
    ' create foe _rat_ every 1 minutes 3 times with 100% success',
  ], seq([0.1, 0.1, 0.999]));
  m.tick();
  m.clock.t = 100001;
  m.tick(); m.tick();   // both attempts fail (no space)
  assert.equal(world.placed.length, 0);
  m.tick();
  assert.equal(world.placed.length, 1, 'the third try stands the same foe');
});

test('creation failure and a missing Foe symbol both error-terminate the quest', () => {
  const w1 = makeWorld();
  w1._failCreate = true;
  const m1 = makeMachine(w1);
  const q1 = schedule(m1, [
    'Foe _rat_ is Giant_rat', '',
    ' create foe _rat_ every 1 minutes 1 times with 100% success',
  ], seq([0.1, 0.1, 0.999]));
  m1.tick();
  m1.clock.t = 100001;
  m1.tick();
  assert.equal(m1.quests.has(q1.uid), false, 'CreateFoeGameObjects failed - the quest is removed');

  const m2 = makeMachine(makeWorld());
  const q2 = schedule(m2, [' create foe _ghost_ every 1 minutes 1 times with 100% success'], seq([0.999]));
  m2.tick();   // backdates from t=100000: due at 100001
  m2.clock.t = 100001;
  m2.tick();
  assert.equal(m2.quests.has(q2.uid), false, 'no Foe resource - the quest is removed');
});

test('HEADLESS: the spawn law idles without the seam and the quest stands', () => {
  const m = makeMachine(null);
  const q = schedule(m, [
    'Foe _rat_ is Giant_rat', '',
    ' create foe _rat_ every 1 minutes 1 times with 100% success',
  ]);
  m.tick(); m.clock.t = 101000; m.tick();
  assert.equal(m.quests.has(q.uid), true);
  const p = q.getResource({ name: 'rat' });
  assert.equal(p.namePending, true, 'the name half pends LOUDLY');
  assert.equal(p.displayName, '');
  assert.equal(p.foeType, 0, 'the table half still resolved (Giant_rat id 0)');
  assert.equal(p.spawnCount, 1, 'ParseInt-missing-count 0 clamps to 1');
});

test('CastSpellOnFoe: the classic id from Quests-Spells, plain queueing with NO duplicate refusal', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Foe _imp_ is Imp', '',
    ' cast Shield spell on _imp_',
    ' cast Shield spell on _imp_',
  ]);
  m.tick();
  const imp = q.getResource({ name: 'imp' });
  assert.equal(imp.spellQueueCount, 2, 'the same spell queues twice - unlike the item queue');
  assert.deepEqual(imp.spellQueue[0], { classicId: 17, customKey: '' }, 'Quests-Spells Shield = 17');
});

test('CastSpellOnFoe: the custom form carries the key; classic id stays the default 0', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Foe _imp_ is Imp', '',
    ' cast MyMod.Fireball custom spell on _imp_',
  ]);
  m.tick();
  assert.deepEqual(q.getResource({ name: 'imp' }).spellQueue[0], { classicId: 0, customKey: 'MyMod.Fireball' });
});

test("CastSpellOnFoe QUIRK: a Quests-Spells miss completes the TEMPLATE, so the action still queues classic 0", () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Foe _imp_ is Imp', '',
    ' cast Totally_Bogus spell on _imp_',
  ]);
  m.tick();
  const imp = q.getResource({ name: 'imp' });
  assert.equal(imp.spellQueueCount, 1, "C#'s SetComplete lands on the factory template, not the minted action");
  assert.deepEqual(imp.spellQueue[0], { classicId: 0, customKey: '' });
});

test('CastSpellOnFoe with a missing Foe error-terminates the quest', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [' cast Shield spell on _nobody_']);
  m.tick();
  assert.equal(m.quests.has(q.uid), false);
});

test('SetFoeName: a monster draws a classic-srand name, typeName from the grounded list', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Foe _rat_ is Giant_rat', '', 'variable _pad_']);
  const rat = q.getResource({ name: 'rat' });
  assert.equal(rat.namePending, false);
  assert.equal(rat.typeName, 'Rat', 'enemyNames[0]');
  assert.ok(rat.displayName.length > 0, 'the monster-name draw landed');
  assert.equal(rat.humanoidGender, GENDERS.Male, 'monsters stay the Male default');
});

test('SetFoeName: a humanoid rolls gender at 55% MALE and draws from the region bank', () => {
  const m1 = makeMachine(makeWorld());
  const q1 = schedule(m1, ['Foe _mage_ is Mage', '', 'variable _pad_'], () => 0.5);
  const he = q1.getResource({ name: 'mage' });
  assert.equal(he.typeName, 'Mage', 'enemyNames[43 + 128 - 128]');
  assert.equal(he.humanoidGender, GENDERS.Male, '0.5 < 0.55 is MALE - the 55% law');
  assert.ok(he.displayName.length > 0);
  const m2 = makeMachine(makeWorld());
  const q2 = schedule(m2, ['Foe _mage_ is Mage', '', 'variable _pad_'], () => 0.6);
  assert.equal(q2.getResource({ name: 'mage' }).humanoidGender, GENDERS.Female);
});

// ---- the Q3-iii VERIFY pins (the mutation campaign's boundaries) ----

test('the Dice100 boundary: a roll landing EXACTLY on the chance fails; Range(0,100) tops at 99', () => {
  // chance 20, chance roll 0.20 -> floor(20) >= 20 -> FailedRoll
  const w1 = makeWorld();
  const m1 = makeMachine(w1);
  schedule(m1, [
    'Foe _rat_ is Giant_rat', '',
    ' create foe _rat_ every 1 minutes 5 times with 20% success',
  ], seq([0.1, 0.1, 0.999, 0.20]));
  m1.tick(); m1.clock.t = 100001; m1.tick();
  assert.equal(w1.created.length, 0, '20 >= 20 is a FAILED roll - the >= law');
  // chance 100 NEVER fails: the highest draw is 99
  const w2 = makeWorld();
  const m2 = makeMachine(w2);
  schedule(m2, [
    'Foe _rat_ is Giant_rat', '',
    ' create foe _rat_ every 1 minutes 5 times with 100% success',
  ], seq([0.1, 0.1, 0.999, 0.9999]));
  m2.tick(); m2.clock.t = 100001; m2.tick();
  assert.equal(w2.created.length, 1, 'floor(.9999*100)=99 < 100 - Range(0,100) exclusive');
});

test('indefinitely spawns FOREVER: the -1 escape on the max gate', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  schedule(m, [
    'Foe _rat_ is Giant_rat', '',
    ' create foe _rat_ every 1 minutes indefinitely with 100% success',
  ], seq([0.1, 0.1, 0.999]));
  m.tick();
  for (let w = 1; w <= 3; w++) {
    m.clock.t = 100001 + (w - 1) * 60;
    m.tick(); m.tick();   // spawn + wave-complete
  }
  assert.equal(world.created.length, 3, 'the counter never gates an infinite action');
});

test('a SHORT wave from the mint error-terminates exactly like a null one', () => {
  const world = makeWorld();
  world.createFoeGameObjects = (foe, count) => Array.from({ length: count - 1 }, (_, i) => ({ i }));
  const m = makeMachine(world);
  const q = schedule(m, [
    'Foe _rats_ is 2 Giant_rat', '',
    ' create foe _rats_ every 1 minutes 1 times with 100% success',
  ], seq([0.1, 0.1, 0.999]));
  m.tick(); m.clock.t = 100001; m.tick();
  assert.equal(m.quests.has(q.uid), false, 'length !== spawnCount throws, the quest is removed');
});

test('the msg-once law holds ACROSS actions: oncePerQuest suppresses a second action sharing the id', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  schedule(m, [
    'Foe _rat_ is Giant_rat', '',
    ' create foe _rat_ every 1 minutes 1 times with 100% success msg 1011',
    ' create foe _rat_ every 1 minutes 1 times with 100% success msg 1011',
  ], seq([0.1, 0.1, 0.999, 0.999]));
  m.tick();
  m.clock.t = 100001;
  for (let i = 0; i < 8; i++) m.tick();
  assert.ok(world.placed.length >= 2, 'both actions placed a foe');
  assert.equal(m.of('showPopup').length, 1, 'the second 1011 is suppressed by oneTimeDisplayedMessages');
});

test('the spawn count clamps at C#\'s 8 even when the script asks for more', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Foe _horde_ is 20 Giant_rat', '', 'variable _pad_']);
  assert.equal(q.getResource({ name: 'horde' }).spawnCount, 8, 'Mathf.Clamp(20, 1, 8)');
});

test('IsClassEnemyId is the 128 BIT: monsters never take the humanoid branch', () => {
  // a female-side roll would flip humanoidGender IF the monster
  // misrouted through the humanoid arm - it must stay the Male default
  const m1 = makeMachine(makeWorld());
  const q1 = schedule(m1, ['Foe _rat_ is Giant_rat', '', 'variable _pad_'], () => 0.9);
  assert.equal(q1.getResource({ name: 'rat' }).humanoidGender, GENDERS.Male, 'Giant_rat (0) is a monster');
  const m2 = makeMachine(makeWorld());
  const q2 = schedule(m2, ['Foe _imp_ is Imp', '', 'variable _pad_'], () => 0.9);
  assert.equal(q2.getResource({ name: 'imp' }).humanoidGender, GENDERS.Male, 'Imp (1) is a monster - the low bit is not the class bit');
});

test('the humanoid gender boundary: a roll EXACTLY at 0.55 is Female (strict <)', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Foe _mage_ is Mage', '', 'variable _pad_'], () => 0.55);
  assert.equal(q.getResource({ name: 'mage' }).humanoidGender, GENDERS.Female);
});

test('name determinism: the srand chains draw the exact classic names', () => {
  // humanoid: seed floor(.9995*1000)=999 -> srand(999) -> fullName
  const m1 = makeMachine(makeWorld());
  const q1 = schedule(m1, ['Foe _mage_ is Mage', '', 'variable _pad_'], () => 0.9995);
  assert.equal(q1.getResource({ name: 'mage' }).displayName, 'Chird-e', 'srand(999) + the Breton bank, verbatim');
  // monster: srand(999 + randomRange(1,1000000) drawn from a KNOWN
  // DFRandom state) -> monsterName on the reseeded chain
  srand(4242);
  const m2 = makeMachine(makeWorld());
  const q2 = schedule(m2, ['Foe _rat_ is Giant_rat', '', 'variable _pad_'], () => 0.9995);
  assert.equal(q2.getResource({ name: 'rat' }).displayName, 'Baaliblex', 'the monster seed composition, verbatim');
});

test('the Foe state bits: kill sets deathTrigger; the cloned item queue keeps the originals', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Foe _rat_ is Giant_rat', '', 'variable _pad_']);
  const rat = q.getResource({ name: 'rat' });
  assert.equal(rat.deathTrigger, false);
  rat.kill();
  assert.equal(rat.deathTrigger, true);
  assert.equal(rat.spellQueueCount, 0, 'an empty queue counts 0');
  rat.setInjured(); rat.rearmInjured();
  assert.equal(rat.injuredTrigger, false, 'RearmInjured clears the wave trigger');
  rat.setRestrained(); rat.clearRestrained();
  assert.equal(rat.isRestrained, false, 'ClearRestrained releases');
  assert.equal(rat.getClonedItemQueue(), null, 'null when empty');
  const item = { name: 'a dagger', uid: 7 };
  rat.queueItem(item);
  const clones = rat.getClonedItemQueue();
  assert.equal(clones.length, 1);
  assert.notEqual(clones[0], item, 'a CLONE crossed');
  assert.equal(rat.itemQueue[0], item, 'the original stays on the Foe');
});

// ---- AUDIT 24 (the seven-slice sweep): CreateFoe's three ----

test('AUDIT 24: the msg option keeps the LAST match - C# walks the whole MatchCollection', () => {
  const m = makeMachine(null);
  const q = schedule(m, [
    'Foe _rat_ is Giant_rat', '',
    ' create foe _rat_ every 5 minutes 3 times with 40% success msg 1011 msg 1012',
  ]);
  const act = createFoeOf(q);
  // C#: `foreach (Match option in options) { ... action.msgMessageID = ... }`
  // reassigns on every hit, so the LAST msg is the one that survives.
  // The port used a single .exec and kept the first.
  assert.equal(act.msgMessageID, 1012, 'the second msg overwrites the first');
});

test('AUDIT 24: the backdate draw is UNCONDITIONAL - "every 0 minutes" still spends a roll', () => {
  // CreateFoe.cs:110 calls Random.Range(0, spawnInterval) with no zero
  // guard, and `every 0 minutes` is all over the corpus (S0000008,
  // S0000503, M0B21Y19, N0B00Y16). A `n > 0 ?` guard skipped the draw
  // on every one of them and slid the quest's whole roll stream.
  const world = makeWorld();
  const m = makeMachine(world);
  const drawn = [];
  const rolls = () => { drawn.push(1); return 0.5; };
  const q = schedule(m, [
    'Foe _rat_ is Giant_rat', '',
    ' create foe _rat_ every 0 minutes 1 times with 100% success',
  ], rolls);
  const act = createFoeOf(q);
  assert.equal(act.spawnInterval, 0, 'zero-minute interval');
  const before = drawn.length;
  m.tick();
  // two draws this tick: the (zero-width) backdate, then Dice100
  assert.equal(drawn.length - before, 2, 'the backdate draw is taken even at interval 0');
  assert.equal(act.lastSpawnTime, m.clock.t, 'floor(r * 0) is 0 - the value is unchanged');
});

test('AUDIT 24: RestoreSaveData re-stamps a zero lastSpawnTime with NOW, retiring the backdate', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Foe _rat_ is Giant_rat', '',
    ' create foe _rat_ every 10 minutes 1 times with 100% success',
  ]);
  const act = createFoeOf(q);
  const saved = act.getSaveData();
  assert.equal(saved.lastSpawnTime, 0, 'saved before the first update');

  // CreateFoe.cs:427-429 - the one non-pure line in any action's
  // RestoreSaveData. Without it the port backdated after every such
  // load, spawning early and spending a roll DFU never spends.
  const world2 = makeWorld();
  const m2 = makeMachine(world2);
  m2.clock.t = 555000;
  const q2 = schedule(m2, [
    'Foe _rat_ is Giant_rat', '',
    ' create foe _rat_ every 10 minutes 1 times with 100% success',
  ], () => 0.999);
  const act2 = createFoeOf(q2);
  m2.tick();   // arm the task first - InitialiseOnSet zeroes the timer
  act2.restoreSaveData(saved);
  assert.equal(act2.lastSpawnTime, 555000, 'stamped NOW, not left at 0');
  m2.tick();
  assert.equal(act2.lastSpawnTime, 555000, 'Update never reaches the backdate again');
  // the discriminator: a 0.999 backdate would have moved the timer to
  // 555000-599, making the wave due at 555001 instead of 555600
  m2.clock.t = 555100;
  m2.tick();
  assert.equal(world2.created.length, 0, 'the first wave waits a FULL interval from the load');
  m2.clock.t = 555600;
  m2.tick();
  assert.equal(world2.created.length, 1, 'due exactly one interval after the load');
});
