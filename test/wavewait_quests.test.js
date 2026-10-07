// WAVE-WAIT (2026-10-07, bible/06-Systems/Online-Waits.md WAIT2; Mac: "Take care of this", over the sweep of the waits
// still long online): A WAVE THE QUEST WAITS ON COMES ON THE SHORT WAIT ONLINE. A wave's interval runs on played time
// online (WORLD7's step, QCLOCK-WORLD's lived charge) and REST8 kept it whole as pacing - right for a wave that harasses,
// wrong for a wave that IS the quest's next page: the King of Worms (S0000021) makes his offer only once his zombie
// messenger is killed, and it is sent `every 1410 minutes` - up to 117.5 real minutes of play before a main-quest giver
// would offer, and no rest brought it sooner. Online now an awaited wave's FIRST arrival lands inside the short wait
// (ONLINE_DELAY_SECONDS) - the messenger's, and the Honored Mage's Nightblades' (N0B20Y02, 55 minutes); the waves after
// it keep the script's interval, a task set again does not make a wave that came a first arrival again (AUDIT WAITS W3),
// every other wave is DFU's whole, and offline nothing moves. The real scripts, parsed and ticked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { waveIsAwaited, ONLINE_DELAY_SECONDS, PLAYED_STEP_MAX_SECONDS } from '../src/systems/quest/clock.js';
import { CreateFoe } from '../src/systems/quest/actions.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}
const parse = (name, online, now, world = null) => {
  const lines = rd(`vendor/dfu-quests/Quests/${name}.txt`).split(/\r?\n/);
  const q = new QuestMachine({
    nowSeconds: () => now.s, raisedSeconds: () => now.raised, questClockStepMax: () => (online ? PLAYED_STEP_MAX_SECONDS : Infinity),
    showPopup() {}, getQuestSourceLines: () => lines, sharedClock: () => online, world,
  }).parseQuestShape(name);
  if (world) q.hooks.world = world;   // the shape's parse is headless; the running host hands the spawn seam
  return q;
};

/** The wave of `foe` in a real script, over a spawn seam that counts the waves and places every foe at once (a `send` finds the
 *  player in town). `roll` is the quest's die: 0 is the worst case, no backdate - the wave a whole interval out. */
function wave(name, foe, online, roll = 0, start = true) {
  const now = { s: 1_000_000, raised: 0 };
  const waves = [];
  const world = {
    createFoeGameObjects: (foe, n) => { waves.push(now.s); return Array.from({ length: n }, () => ({})); },
    tryPlaceFoe: () => true,
    isPlayerInLocationRect: () => true,
  };
  const q = parse(name, online, now, world);
  q.rolls = () => roll;
  const action = [...q.tasks.values()].flatMap((t) => t.actions).find((a) => a.constructor.name === 'CreateFoe' && a.foeSymbol?.name === foe);
  assert.ok(action, `${name} sends a wave of ${foe}`);
  const play = (seconds, step = 60) => { for (let t = 0; t < seconds; t += step) { now.s += step; action.update(); } };
  const t0 = now.s;
  if (start) action.update();   // the task fires at t0: the wave's first update, its draw
  return { q, now, waves, world, action, play, t0 };
}

/** N0B20Y02's guard over its real task: `until _S.12_ performed: pc at _magesguild_ set _S.01_` sets `_S.01_` while the
 *  guard stands in the hall and clears it on a tick outside (PcAt.cs). `away()` is a minute out of the hall and back -
 *  the task cleared, then set again, so the next tick's edge re-arms its wave whole (InitialiseOnSet). */
function hall(online) {
  const now = { s: 1_000_000, raised: 0 };
  const waves = [];
  const world = { createFoeGameObjects: (foe, n) => { waves.push(now.s); return Array.from({ length: n }, () => ({})); }, tryPlaceFoe: () => true };
  const q = parse('N0B20Y02', online, now, world);
  q.rolls = () => 0;   // the worst roll: no backdate
  const s01 = q.getTask({ name: 'S.01' });
  const tick = () => { now.s += 60; s01.update(); };
  const play = (minutes) => { for (let m = 0; m < minutes; m++) tick(); };
  const away = () => { s01.clear(); tick(); s01.start(); return now.s + 60; };   // the tick of the return
  s01.start();
  return { q, now, waves, play, away, back: now.s + 60 };
}

test('WAVE-WAIT: the reading over all 241 waves of the corpus - a wave whose kill the quest waits on (an offer, a reward); of them only the King of Worms\' messenger and the Honored Mage\'s Nightblades are longer than the short wait, and every long wave that harasses is not read', () => {
  const awaitedLong = [];
  let waves = 0;
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Quests')).filter((x) => x.endsWith('.txt')).sort()) {
    const name = f.replace('.txt', '');
    const q = parse(name, true, { s: 0, raised: 0 });
    for (const t of q.tasks.values()) for (const a of t.actions) {
      if (a.constructor?.typeName !== 'CreateFoe') continue;
      waves++;
      if (a.spawnInterval > ONLINE_DELAY_SECONDS && waveIsAwaited(q, a.foeSymbol?.name)) awaitedLong.push(`${name}:${a.foeSymbol.name}:${a.spawnInterval / 60}`);
    }
  }
  assert.equal(waves, 241);
  assert.deepEqual(awaitedLong, ['N0B20Y02:F.00:55', 'S0000021:zombie:1410']);
  // the harassers keep the script's pacing: K'avar's archers, the knights on the totem, the Sx100 ambushes and S0000103's
  // vampires, the Nightblade after Aubk-i, the bribe path's knights and barbarians (their kills say a line), the posse,
  // the thief
  const harass = { S0000501: 'F.00', S0000008: 'knights', S0000103: 'F.00', S0000100: 'F.00', S0000012: 'F.00', S0000009: 'knights', O0B00Y11: 'posse', A0C00Y15: 'thief' };
  for (const [name, foe] of Object.entries(harass)) assert.equal(waveIsAwaited(parse(name, true, { s: 0, raised: 0 }), foe), false, `${name}'s ${foe} harasses`);
  assert.equal(waveIsAwaited(parse('S0000009', true, { s: 0, raised: 0 }), 'barbarians'), false, '`when _S.07_ and _yes_` says a line - not the quest\'s page');
});

test('WAVE-WAIT: online the King of Worms\' messenger (S0000021, `send _zombie_ every 1410 minutes`) comes inside the short wait of play even at the worst roll - and offline at DFU\'s whole interval', () => {
  const on = wave('S0000021', 'zombie', true);
  assert.deepEqual([on.action.spawnInterval, on.action.spawnMaxTimes, on.action.spawnChance, on.action.isSendAction], [1410 * 60, -1, 100, true]);
  on.play(2 * 3600);
  assert.equal(on.waves[0] - on.t0, ONLINE_DELAY_SECONDS, 'the first zombie at the short wait (24 minutes of the character\'s clock: two real minutes of play)');
  const off = wave('S0000021', 'zombie', false);
  off.play(25 * 3600, 600);
  assert.equal(off.waves[0] - off.t0, 1410 * 60, 'offline: DFU\'s Range(0, interval) backdate whole - a full interval at the worst roll');
});

test('WAVE-WAIT: the first arrival keeps DFU\'s draw - one Range a wave, its span the short wait online; the waves after it keep the script\'s interval; a rest spends none of it', () => {
  const on = wave('S0000021', 'zombie', true, 0.5);
  on.play(3600);
  assert.equal(on.waves[0] - on.t0, ONLINE_DELAY_SECONDS / 2, 'a roll of a half: halfway into the short wait');
  on.play(on.waves[0] + 1410 * 60 - 60 - on.now.s);
  assert.equal(on.waves.length, 1, 'the second messenger is the script\'s pacing again - not before 1410 minutes');
  on.play(120);
  assert.equal(on.waves.length, 2);
  assert.equal(on.waves[1] - on.waves[0], 1410 * 60);
  // a rest (a raise) spends nothing: eight hours raised, then the first wave still waits its lived minutes
  const rest = wave('S0000021', 'zombie', true);
  rest.play(10 * 60);
  rest.now.s += 8 * 3600; rest.now.raised += 8 * 3600; rest.action.update();
  assert.equal(rest.waves.length, 0, 'a night of rest does not bring the messenger');
  rest.play(14 * 60);
  assert.equal(rest.waves.length, 1, 'fourteen more lived minutes do (10 + 14 = the short wait)');
});

test('WAVE-WAIT: a load does not put it back a whole interval - restoreSaveData stamps `now` on a wave that never ran (DFU\'s quirk), and online an awaited one still lands inside the short wait; a harassing wave is DFU\'s whole', () => {
  const on = wave('S0000021', 'zombie', true, 0, false);
  const data = on.action.getSaveData();
  assert.equal(data.lastSpawnTime ?? 0, 0, 'saved before its first update');
  on.action.restoreSaveData(data);
  assert.equal(on.action.lastSpawnTime, on.now.s, 'the quirk: stamped now - offline, the first wave a whole interval on');
  on.action.update();
  on.play(2 * 3600);
  assert.equal(on.waves[0] - on.t0, ONLINE_DELAY_SECONDS);
  // K'avar's archers (S0000501, `create foe _F.00_ every 2000 minutes 5 times`): harassment - the whole interval online
  const archers = wave('S0000501', 'F.00', true);
  assert.equal(archers.action.spawnInterval, 2000 * 60);
  archers.play(2000 * 60, 600);
  assert.equal(archers.waves[0] - archers.t0, 2000 * 60, 'the archers keep the script\'s pacing online');
});

test('WAVE-WAIT: the Honored Mage\'s Nightblades (N0B20Y02, every 55 minutes, once) come inside the short wait online - inside the guard, as GUARD-WINDOW keeps it; offline at the interval', () => {
  const on = wave('N0B20Y02', 'F.00', true);
  on.play(3600);
  assert.equal(on.waves[0] - on.t0, ONLINE_DELAY_SECONDS);
  const off = wave('N0B20Y02', 'F.00', false);
  off.play(3600);
  assert.equal(off.waves[0] - off.t0, 55 * 60);
});

test('WAVE-WAIT (AUDIT WAITS W3): a wave that has come is the script\'s pacing again, whatever sets its task again - the Honored Mage\'s guard steps out of the hall and back (`pc at` clears and sets `_S.01_`; InitialiseOnSet re-arms the wave whole): before the Nightblades come a return still waits the short wait, after they come it is DFU\'s draw', () => {
  const g = hall(true);
  g.play(10);
  const back = g.away();   // out and back before the wave: it has not come - still its first arrival
  g.play(30);
  assert.equal(g.waves.length, 1);
  assert.equal(g.waves[0] - back, ONLINE_DELAY_SECONDS, 'the short wait from the return (the worst roll: none of it backdated)');
  const again = g.away();   // out and back after the three have stood in the hall
  g.play(54);
  assert.equal(g.waves.length, 1, 'the wave re-armed after it came is not a first arrival - no second wave on the short wait');
  g.play(2);
  assert.equal(g.waves.length, 2);
  assert.equal(g.waves[1] - again, 55 * 60, 'DFU\'s draw whole: at the worst roll its whole interval');
  // offline the same steps are DFU's: each arming its interval at the worst roll
  const off = hall(false);
  off.play(10);
  const offBack = off.away();
  off.play(56);
  assert.deepEqual(off.waves.map((w) => w - offBack), [55 * 60]);
});

test('WAVE-WAIT (AUDIT WAITS W3): what says a wave has come outlives a load - a kill of its foe on record (saved with the quest) and the wave\'s own saved count; the session\'s arrival is forgotten, neither of these', () => {
  // the Nightblades killed in a session before (a load restores the Foe's kills) and the guard set again: DFU's draw
  const killed = hall(true);
  killed.q.getFoe({ name: 'F.00' }).killCount = 1;
  killed.play(56);
  assert.deepEqual(killed.waves.map((w) => w - killed.back), [55 * 60], 'a kill on record: no short wait');
  // the messenger came, the game saved and loaded (a fresh action off its save: `_arrived` gone, its count kept), not
  // killed: the next keeps the script's 1410 minutes
  const on = wave('S0000021', 'zombie', true, 0.5);
  on.play(ONLINE_DELAY_SECONDS);
  assert.equal(on.waves.length, 1);
  const loaded = new CreateFoe(on.q);
  loaded.restoreSaveData(on.action.getSaveData());
  assert.equal(loaded.spawnCounter, 1);
  for (let t = 0; t < 120 * 60; t += 60) { on.now.s += 60; loaded.update(); }
  assert.equal(on.waves.length, 1, 'no messenger on the short wait after a load');
});

test('WAVE-WAIT (AUDIT WAITS W4): an attempt that brings nothing is no arrival - the messenger hidden, kept off the ground, or lost in flight: online the next comes a short wait on, not a whole interval; and the first arrival takes DFU\'s one draw, as the interval did', () => {
  const zombie = (w) => w.q.getFoe({ name: 'zombie' });
  for (const [what, spoil, mend] of [
    ['hidden', (w) => { zombie(w).isHidden = true; }, (w) => { zombie(w).isHidden = false; }],
    ['kept off', (w) => { w.world.foeKeptOff = () => true; }, (w) => { w.world.foeKeptOff = () => false; }],
  ]) {
    const on = wave('S0000021', 'zombie', true);
    spoil(on);
    on.play(ONLINE_DELAY_SECONDS);
    assert.equal(on.waves.length, 0, `${what}: the attempt at the short wait brings nothing`);
    mend(on);
    on.play(ONLINE_DELAY_SECONDS + 120);
    assert.equal(on.waves.length, 1, `${what}: the messenger a short wait (and a tick) on`);
    assert.ok(on.waves[0] - (on.t0 + ONLINE_DELAY_SECONDS) <= ONLINE_DELAY_SECONDS + 60);
  }
  // a send's wave waits for the player in town; a streaming-world rebuild (a journey) loses it in flight (CreateFoe.cs
  // :373-377) - it never came
  const lost = wave('S0000021', 'zombie', true);
  lost.world.isPlayerInLocationRect = () => false;
  lost.play(ONLINE_DELAY_SECONDS);
  assert.equal(lost.waves.length, 1);
  assert.equal(lost.action.spawnInProgress, true, 'made, pending - the player is not in town');
  lost.action.onInitWorld();
  lost.world.isPlayerInLocationRect = () => true;
  lost.play(ONLINE_DELAY_SECONDS + 120);
  assert.equal(lost.waves.length, 2, 'a wave lost in flight never came: the next a short wait on');
  assert.ok(lost.waves[1] - lost.waves[0] <= ONLINE_DELAY_SECONDS + 60);
  // the draws: the first update takes one (the backdate's Range), the spawn one (the chance) - online as offline, the
  // quest's roll stream where DFU has it
  for (const online of [true, false]) {
    const w = wave('S0000021', 'zombie', online, 0, false);
    let draws = 0;
    w.q.rolls = () => { draws++; return 0.5; };
    w.action.update();
    assert.equal(draws, 1, `${online ? 'online' : 'offline'}: one draw for the first arrival`);
    w.play(online ? ONLINE_DELAY_SECONDS : 1410 * 60, online ? 60 : 600);
    assert.equal(w.waves.length, 1);
    assert.equal(draws, 2, 'and one for the chance');
  }
});
