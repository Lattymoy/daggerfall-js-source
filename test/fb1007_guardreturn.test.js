// GUARD-RETURN (2026-10-07, a player through the lead: "Protect an Honored Mage: assassins spawn again after leaving and
// re-entering the Mages Guild"; bible/06-Systems/Quest-Arc.md GUARD-RETURN). N0B20Y02: `until _S.12_ performed: pc at
// _magesguild_ set _S.01_`, and `_S.01_` is `create foe _F.00_ every 55 minutes 1 times with 100% success` - the three
// Nightblades. PcAt.Update (PcAt.cs) STARTS the task on every tick the player is in the hall and CLEARS it on every tick
// they are not; a clear rearms the task's actions (Task.SetTriggerValue -> RearmActions), and the next tick the task
// runs set again, Task.Update's `if (!prevTriggered) action.InitialiseOnSet()` re-arms the wave whole
// (CreateFoe.InitialiseOnSet: lastSpawnTime 0, spawnCounter 0 - "This can be cleared on next set/rearm"). So a guard
// who steps out of the hall while the trance runs and comes back meets the wave again, killed or not: CreateFoe reads
// no kill count (only AddQuestResourceObjects' placed foe does, `killCount < spawnCount`). That is Daggerfall Unity's
// own law, not the port's, and it is pinned here AS DFU's - a departure is Mac's call (the record names the 26 vendored
// quests that share the shape). The real script, parsed and ticked through the quest's own update, the Place's own
// isPlayerHere over the hosts' location seams, the Foe's own incrementKills.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { SITE_TYPES, MARKER_TYPES } from '../src/systems/quest/place.js';
import { PLAYED_STEP_MAX_SECONDS } from '../src/systems/quest/clock.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}

const HALL = { mapId: 1001, buildingKey: 0x10203 };
const STEP = 10;   // seconds a tick

/** The quest over the hosts' clock and location seams; the hall a Building site with one spawn marker (the startup's
 *  `place npc _sleepingmage_`), and a spawn seam that counts the waves made and stands every foe at once. */
function guard(online) {
  const now = { s: 1_000_000, raised: 0 };
  const waves = [];
  const at = { inside: true };
  const lines = rd('vendor/dfu-quests/Quests/N0B20Y02.txt').split(/\r?\n/);
  const world = {
    createFoeGameObjects: (foe, n) => { waves.push({ at: now.s, foe: foe.symbol.name, n }); return Array.from({ length: n }, () => ({})); },
    tryPlaceFoe: () => true,
    playerInside: () => (at.inside ? { building: { buildingKey: HALL.buildingKey } } : null),
    currentLocation: () => ({ loaded: true, mapTableData: { mapId: HALL.mapId } }),
  };
  const q = new QuestMachine({
    nowSeconds: () => now.s, raisedSeconds: () => now.raised, questClockStepMax: () => (online ? PLAYED_STEP_MAX_SECONDS : Infinity),
    showPopup() {}, getQuestSourceLines: () => lines, sharedClock: () => online, world,
  }).parseQuestShape('N0B20Y02');
  q.hooks.world = world;   // the shape's parse is headless (no scene); the running host hands its seams
  q.hooks.cullResourceTarget = () => {};   // the machine's cull looks the quest up among its live ones; a shape is not one
  q.rolls = () => 0.5;
  q.resources.get('magesguild').siteDetails = {
    siteType: SITE_TYPES.Building, mapId: HALL.mapId, buildingKey: HALL.buildingKey, magicNumberIndex: 0,
    selectedMarker: { targetResources: null }, questItemMarkers: [],
    questSpawnMarkers: [{ markerType: MARKER_TYPES.QuestSpawn, flatPosition: { x: 5, y: 0, z: 5 }, dungeonX: 0, dungeonZ: 0, targetResources: null }],
  };
  const run = (seconds, each) => { for (let t = 0; t < seconds; t += STEP) { now.s += STEP; q.update(); each?.(); } };
  return { q, now, waves, at, run, start: now.s };
}

/** The wave's own kill law: the three dead, credited to the Foe as the death route credits them. */
const killWave = (q) => q.resources.get('F.00').incrementKills(3);

test('GUARD-RETURN: a guard who stays in the hall meets ONE wave of three Nightblades in the three hours, killed or not, online and off', () => {
  for (const online of [false, true]) {
    const { q, waves, run } = guard(online);
    run(3600, () => { if (waves.length === 1 && q.resources.get('F.00').killCount === 0) killWave(q); });
    run(2 * 3600 - 60);
    assert.equal(q.getTask({ name: 'S.12' }).getTriggerValue(), false, 'still inside the trance');
    assert.equal(waves.length, 1, `${online ? 'online' : 'offline'}: one wave`);
    assert.deepEqual([waves[0].foe, waves[0].n], ['F.00', 3], 'the three Nightblades');
    assert.equal(q.getTask({ name: 'S.03' }).getTriggerValue(), true, '`killed 3 _F.00_` read the kills');
  }
});

test('GUARD-RETURN: the three killed, a guard who steps out and comes back while the trance runs meets them AGAIN - DFU\'s law: PcAt clears `_S.01_` while away, and setting it again re-arms the wave (CreateFoe.InitialiseOnSet), which reads no kill', () => {
  for (const online of [false, true]) {
    const { q, waves, at, run, now } = guard(online);
    run(3600);
    assert.equal(waves.length, 1, 'the first wave, inside its 55 minutes');
    killWave(q);
    const s01 = q.getTask({ name: 'S.01' });
    const wave = s01.actions.find((a) => a.constructor.name === 'CreateFoe');
    assert.equal(wave.spawnCounter, 1, 'the wave counted - `1 times` spent');

    at.inside = false;   // out of the hall
    run(600);
    assert.equal(s01.getTriggerValue(), false, 'away: `pc at` cleared `_S.01_`');
    assert.equal(waves.length, 1, 'no wave while away');

    at.inside = true;   // back, the trance still running
    const back = now.s;
    run(55 * 60);
    assert.equal(q.getTask({ name: 'S.12' }).getTriggerValue(), false, 'back inside the three hours');
    assert.equal(s01.getTriggerValue(), true, 'back: `_S.01_` set again');
    assert.equal(waves.length, 2, `${online ? 'online' : 'offline'}: the re-set re-armed the wave - a second three`);
    assert.deepEqual([waves[1].foe, waves[1].n], ['F.00', 3]);
    assert.ok(waves[1].at > back && waves[1].at <= back + 55 * 60, 'inside one interval of the return');
    assert.equal(q.resources.get('F.00').killCount, 3, 'the kills stand - the wave never read them');
  }
});

test('GUARD-RETURN: once the trance is over the `until` is done - a return to the hall arms nothing', () => {
  const { q, waves, at, run } = guard(false);
  run(3600);
  killWave(q);
  at.inside = false;
  run(2 * 3600 + 60);
  assert.equal(q.getTask({ name: 'S.12' }).getTriggerValue(), true, 'the three hours are over');
  at.inside = true;
  run(2 * 3600);
  assert.equal(q.getTask({ name: 'S.01' }).getTriggerValue(), false, 'nothing sets `_S.01_` again');
  assert.equal(waves.length, 1, 'no wave after the guard');
});
