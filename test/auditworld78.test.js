// AUDIT WORLD7/8 (Mac, 2026-09-14: "Continue" after WORLD8): three opus lenses over the quest clocks' played time and
// the hour's respawn - A the Clock and the spawn interval, B the dungeon memory's foes (the stamp, the rebuild, the
// sweep, the stream), C the loot's stamps, the wire and the records. Paid here, executed where a rig reaches:
//  A1/A2/A5: a BACKWARD sample online added its whole span to every running clock - an offline save is game-weeks
//    past the shared calendar (the world starts at the classic start plus wall time), the relay's welcome can
//    correct this machine's clock backwards - so Brisienna's fourteen days became forty-four played for exactly
//    the character Mac brought over. A backward gap online charges nothing and moves the sample; offline the raw
//    gap stands, DFU's own. A11: a save from before the sample field stamped NaN into the remainder.
//  A3/A6: CreateFoe's marker ahead of the world spawned nothing for the whole offset - a backward gap online is a
//    resume too; the marker moves on the in-flight path as well (an away mid-flight counted whole once the wave
//    landed and a second wave fired at once).
//  C1: the claim minted the record BEFORE stamping it, so a chest closed an hour after its last use carried the
//    previous word's stamp and every receiver skipped it as due - a stash lost in silence. C2: a peer's far-future
//    stamp switched the hour off for a container for everyone and rode into the memory for thirty days - clamped to
//    now. C3: the rebuild's refusals asked before the corpse is freed. C4: the sweep rolls a pile the room EMPTIED; a
//    remainder keeps it. C6: the open window's guard above the forgetting. C12: an un-death forgets the body's loot
//    record. A4/C8: the record said a hidden tab charges a step per throttled tick; the machine ticks off the frame
//    loop, so it charges one step on return. C7/C9: two record sentences corrected.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Clock, PLAYED_STEP_MAX_SECONDS } from '../src/systems/quest/clock.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { setSharedClock, sharedWallMs, worldMinutes, sharedClockOn } from '../src/systems/worldTick.js';
import { sharedClassicMinutes, wallMsForClassicMinutes, respawnDue, RESPAWN_MS } from '../src/net/wire.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const questFor = (now, step) => ({ rolls: () => 0.5, nowSeconds: () => now.t, questClockStepMax: () => step.v, resources: new Map(), getPlace: () => null, travelSecondsTo: () => null, getTask: () => null });

test('AUDIT WORLD7/8 A1/A2/A11: the Clock - a backward sample online charges nothing and moves the sample (an offline save game-weeks ahead, a relay correction backwards); offline the raw gap stands as ever; a restored clock with no sample takes now, not NaN', () => {
  const now = { t: 100_000 }, step = { v: PLAYED_STEP_MAX_SECONDS };
  const q = questFor(now, step);
  const c = new Clock(q, 'Clock _c_ 14.00:00'); c.startTimer();
  const fourteen = 14 * 86400;
  assert.equal(c.remainingTimeInSeconds, fourteen);
  // the save's sample thirty game days AHEAD of the shared world (the character Mac brought over)
  c.restoreSaveData({ ...c.getSaveData(), lastWorldTimeSample: now.t + 30 * 86400 });
  c.tick(q);
  assert.equal(c.remainingTimeInSeconds, fourteen, 'nothing charged, nothing ADDED (it was forty-four days)');
  now.t += 600; c.tick(q);
  assert.equal(c.remainingTimeInSeconds, fourteen - 600, 'the sample moved: the next ten played minutes charge ten');
  // the relay's welcome corrects the clock backwards mid-session
  now.t -= 6000; c.tick(q);
  assert.equal(c.remainingTimeInSeconds, fourteen - 600, 'a backward correction charges nothing');
  now.t += 60; c.tick(q);
  assert.equal(c.remainingTimeInSeconds, fourteen - 660, 'and counts on from there');
  // offline: the raw gap, DFU's own (a backward jump there is a load, whose sample is the save's)
  step.v = Infinity;
  const off = new Clock(q, 'Clock _o_ 01:00'); off.startTimer();
  now.t -= 100; off.tick(q);
  assert.equal(off.remainingTimeInSeconds, 3700, 'offline untouched');
  // A11: a save from before the field
  const nan = new Clock(q, 'Clock _n_ 01:00'); nan.startTimer();
  nan.restoreSaveData({ ...nan.getSaveData(), lastWorldTimeSample: undefined });
  assert.equal(nan._lastWorldTimeSample, now.t, 'the sample is now');
  now.t += 60; nan.tick(q);
  assert.equal(nan.remainingTimeInSeconds, 3540, 'and the remainder is a number');
  const src = rd('src/systems/quest/clock.js');
  assert.match(src, /const raw = now - this\._lastWorldTimeSample;\s*\n\s*const difference = Number\.isFinite\(step\) \? Math\.min\(Math\.max\(raw, 0\), step\) : raw;/);
  assert.match(src, /this\._lastWorldTimeSample = Number\.isFinite\(dataIn\.lastWorldTimeSample\) \? dataIn\.lastWorldTimeSample : \(this\.parentQuest\?\.nowSeconds\?\.\(\) \?\? 0\);/);
});

test('AUDIT WORLD7/8 A3/A6: CreateFoe - a marker ahead of the world online is a resume (the first wave waits a full interval from here, not the whole offset); a backward gap mid-session the same; an away while a wave is in flight is forgiven too (one wave after the interval, not two at once); offline the marker arithmetic is DFU\'s own', () => {
  const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(VENDOR, 'Tables', f), 'utf8').replace(/^﻿/, '');
  loadQuestTables(sources);
  const rig = (step, inRect, minutes = 1) => {
    const world = { currentRegionIndex: () => 0, isPlayerInLocationRect: () => inRect.v, created: [], placed: [], createFoeGameObjects: (foe, count) => { world.created.push(count); return Array.from({ length: count }, (_, i) => ({ i })); }, tryPlaceFoe: (h) => { world.placed.push(h); return true; }, raiseOnEncounterEvent() {} };
    const clock = { t: 100000 };
    const m = new QuestMachine({ nowSeconds: () => clock.t, world, questClockStepMax: () => step.v, showPopup() {} });
    const q = m.scheduleQuest(['Quest: __QF', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Foe _rat_ is 2 Giant_rat', '', ` send _rat_ every ${minutes} minutes 9 times with 100% success`], 0, { rolls: () => 0.4 });
    const act = [...q.tasks.values()].flatMap((t) => t.actions).find((a) => a.constructor.name === 'CreateFoe');
    assert.ok(act, 'the send action is CreateFoe\'s send arm');
    return { world, clock, m, act };
  };
  // A3: the marker thirty game days ahead (an offline save's), the world behind it
  { const step = { v: PLAYED_STEP_MAX_SECONDS }, inRect = { v: true }; const { world, clock, m, act } = rig(step, inRect);
    m.tick(); act.lastSpawnTime = clock.t + 30 * 86400; act._lastTick = null;
    m.tick();
    assert.equal(act.lastSpawnTime, clock.t, 'the marker stands here'); assert.equal(world.created.length, 0);
    clock.t += 30; m.tick(); assert.equal(world.created.length, 0, 'half an interval: not yet');
    clock.t += 30; m.tick(); assert.equal(world.created.length, 1, 'a full interval played: the wave (it was never, for the whole offset)');
    // a backward gap mid-session (the relay's correction)
    m.tick(); m.tick();
    clock.t -= 5000; m.tick();
    assert.equal(act.lastSpawnTime, clock.t, 'a backward gap is a resume'); assert.equal(world.created.length, 1);
    clock.t += 60; m.tick(); assert.equal(world.created.length, 2, 'the next wave a full interval on');
  }
  // A6: an away while a wave is in flight - the send variant places nothing until the player is in the rect; an
  // hour's interval, past the step, so the one step a return charges does not itself reach the next wave
  { const step = { v: PLAYED_STEP_MAX_SECONDS }, inRect = { v: true }; const { world, clock, m, act } = rig(step, inRect, 60);
    m.tick();
    let guard = 0; while (world.created.length === 0 && guard++ < 100) { clock.t += 60; m.tick(); }
    assert.equal(world.created.length, 1, 'the first wave rolled'); assert.equal(act.spawnInProgress, true);
    inRect.v = false;
    clock.t += 6 * 3600; m.tick();   // six game hours away, the wave still in flight
    inRect.v = true; m.tick(); m.tick();
    assert.equal(world.placed.length, 2, 'the wave lands on the return'); assert.equal(act.spawnCounter, 1);
    m.tick();
    assert.equal(world.created.length, 1, 'no second wave at once: the away was forgiven on the in-flight path too - one step of the six hours charged, the hour\'s interval not yet');
    clock.t += 1800; m.tick();
    assert.equal(world.created.length, 2, 'the interval done: the next wave');
  }
  // offline: no step - the offset counts whole
  { const step = { v: Infinity }, inRect = { v: true }; const { world, clock, m, act } = rig(step, inRect);
    m.tick(); act.lastSpawnTime = clock.t + 30 * 86400; act._lastTick = null;
    m.tick(); assert.equal(act.lastSpawnTime, clock.t + 30 * 86400, 'offline the marker is DFU\'s own');
    clock.t += 3600; m.tick(); assert.equal(world.created.length, 0);
  }
  const src = rd('src/systems/quest/actions.js');
  assert.match(src, /else if \(this\._lastTick == null\) \{ if \(Number\.isFinite\(step\) && \(gameSeconds - this\.lastSpawnTime > step \|\| gameSeconds < this\.lastSpawnTime\)\) this\.lastSpawnTime = gameSeconds; this\._lastTick = gameSeconds; \}/);
  assert.match(src, /else if \(Number\.isFinite\(step\) && gameSeconds < this\._lastTick\) \{ this\.lastSpawnTime = gameSeconds; this\._lastTick = gameSeconds; \}/);
  assert.match(src, /else \{ const forgiven = Math\.max\(0, gameSeconds - this\._lastTick - step\); if \(forgiven > 0\) this\.lastSpawnTime \+= forgiven; this\._lastTick = gameSeconds; \}/, 'the in-flight path forgives too');
});

test('AUDIT WORLD7/8 A4/A10/C7/C9: the records and the residue - the machine ticks off the frame loop (a hidden tab runs no frames and charges one step on return), the record and the constant say so; the stand-down wording is gone or stamped superseded; the pre-WORLD8 memory sentence and the Ledger\'s WORLD5 sentence corrected', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(!townTalk\.overlayActive && !_loading\) questBridge\.tick\(dt\);/, 'the quest tick is the frame\'s');
  assert.equal(/visibilitychange/.test(w), false, 'no hidden-tab timer drives it');
  assert.match(rd('src/systems/quest/clock.js'), /a hidden tab runs no frames and charges one step\s*\n\s*\* {2}when it comes back/, 'the constant\'s note');
  const arc = rd('bible/06-Systems/Online-Arc.md');
  assert.match(arc, /the tab closed or hidden \(the\nmachine ticks off the frame loop, so a hidden tab runs no frames and\ncharges one step when it comes back\)/, 'the record');
  assert.equal(arc.includes('charges a step per throttled tick'), false);
  assert.match(arc, /is applied as it stands and stamped at the arrival that applied it,\nso it is due an hour later\./, 'C7: a pre-WORLD8 memory is due an hour after the arrival that applied it');
  assert.match(arc, /\[WORLD7: the word is `questClockStepMax` now, the\nsame on both hosts\.\]/, 'A10: AUDIT WORLD5 C10 stamped');
  assert.match(rd('bible/01-Overview/Port-Ledger.md'), /the stood-down hours never charged when it stands up \[superseded by WORLD7: the clocks charge played time\]/, 'C9');
  assert.match(rd('src/scenes/exterior.js'), /AUDIT WORLD5 C10 \/ WORLD7: the quest clocks' played step, this host's word too/, 'A10: the host\'s import comment');
});

test('AUDIT WORLD7/8 B1/B4/C2: the stamp is the RELAY\'s millisecond - under an installed offset the wire\'s inverse over the shared minute answers the relay\'s instant, where sharedWallMs answers this machine\'s (right for a display, wrong for a stamp two machines compare); a stamp ahead of now is clamped at both readers by source', () => {
  const off = 2 * 3600 * 1000;   // this machine two hours from the relay
  const t0 = Date.now();
  setSharedClock(() => sharedClassicMinutes(Date.now() + off), (m) => wallMsForClassicMinutes(m) - off);   // world.js:407's own install
  try {
    assert.equal(sharedClockOn(), true);
    const relay = wallMsForClassicMinutes(worldMinutes());
    const local = sharedWallMs(worldMinutes());
    assert.ok(Math.abs(relay - (Date.now() + off)) < 2000, `the relay's instant (${relay - (Date.now() + off)} ms off)`);
    assert.ok(Math.abs(local - Date.now()) < 2000, 'sharedWallMs is this machine\'s clock');
    assert.ok(relay - local > off - 2000, 'the two differ by the offset - a stamp taken from the wrong one is the offset wrong for every other machine');
    // a host forty minutes slow: with the relay's stamp the hour is the hour
    const stampAtKill = relay; const nowLater = relay + RESPAWN_MS - 60_000;
    assert.equal(respawnDue(stampAtKill, nowLater), false, 'fifty-nine minutes after the kill: not due, whatever the machines\' own clocks say');
    assert.equal(respawnDue(stampAtKill, nowLater + 60_000), true);
  } finally { setSharedClock(null); }
  assert.ok(Date.now() - t0 < 5000);
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /const _wallNow = \(\) => \(sharedClockOn\(\) \? wallMsForClassicMinutes\(worldMinutes\(\)\) : null\);/, 'the dungeon reads the relay\'s');
  assert.equal((d.match(/sharedWallMs\(/g) ?? []).length, 0, 'and never this machine\'s');
  assert.match(d, /f\._diedAt = _n == null \? sf\.died : Math\.min\(sf\.died, _n\); \}/, 'B4: the memory\'s stamp never ahead of now');
  assert.match(d, /const _t = Number\.isFinite\(rec\.t\) \? \(_now == null \? rec\.t : Math\.min\(rec\.t, _now\)\) : _now;/, 'C2: the loot record\'s stamp never ahead of now');
  assert.match(d, /f\._diedAt \?\?= _wallNow\(\);   \/\/ AUDIT WORLD7\/8 B6/, 'B6: the quest pool\'s remove door stamps too');
  assert.match(d, /const RESPAWN_BURST = 4;/, 'B9');
});
