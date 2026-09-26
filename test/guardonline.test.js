// GUARD-ONLINE (2026-09-26, Mac: "Guard the guild quest (mages guild) - wait time for this should be alot shorter";
// asked, "Starts ~1 min after you arrive"): online the world clock is the shared one, a game day two real hours and a
// rest no way past it (RESTX2), so N0B10Y03's `daily from 00:00 to 03:00` came round once every two hours. Online, for
// that quest alone, the window is the player's ARRIVAL's - it opens ten game minutes after they are first in the
// hall and stands an hour; leaving after it closes and coming back opens it again, staying keeps it shut so the
// questor can pay. Offline is DFU's, and so is every other quest online.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ONLINE_GUARD_WINDOWS, guardWindowStep } from '../src/systems/quest/onlineGuard.js';
import { DailyFrom, PcAt } from '../src/systems/quest/actions.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { TaskType } from '../src/systems/quest/task.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f)).replace(/^﻿/, '');
  loadQuestTables(sources);
}
const MIN = 60;
const WIN = ONLINE_GUARD_WINDOWS.N0B10Y03;

test('GUARD-ONLINE: the window is the arrival\'s - ten game minutes on it opens, an hour on it shuts, staying keeps it shut, coming back opens it again', () => {
  assert.deepEqual({ ...WIN }, { place: 'magesguild', delaySeconds: 10 * MIN, lengthSeconds: 60 * MIN }, 'about a real minute online, then five');
  const s = { guardAnchor: null, guardAway: false };
  const at = (here, t) => guardWindowStep(s, here, t, WIN);
  assert.equal(at(false, 1000), false, 'not yet in the hall: no watch');
  assert.equal(s.guardAnchor, null);
  assert.equal(at(true, 2000), false, 'arrived: the thieves are not there yet');
  assert.equal(s.guardAnchor, 2000);
  assert.equal(at(true, 2000 + 10 * MIN - 1), false);
  assert.equal(at(true, 2000 + 10 * MIN), true, 'ten game minutes on');
  assert.equal(at(false, 2000 + 40 * MIN), true, 'stepping out mid-watch does not move it');
  assert.equal(at(true, 2000 + 70 * MIN), true, 'inclusive to the hour');
  assert.equal(at(true, 2000 + 70 * MIN + 1), false, 'shut');
  assert.equal(at(true, 2000 + 200 * MIN), false, 'and it STAYS shut while the player stays - the questor pays on a shut window');
  assert.equal(at(false, 2000 + 201 * MIN), false, 'left after it closed');
  assert.equal(at(true, 2000 + 202 * MIN), false, 'back: a new watch, not yet open');
  assert.equal(s.guardAnchor, 2000 + 202 * MIN);
  assert.equal(at(true, 2000 + 212 * MIN), true, 'and ten minutes later the thieves come again');
  assert.equal(at(true, 100), false, 'a clock behind the arrival (a load) starts the watch over');
  assert.equal(s.guardAnchor, 100);
});

/** A DailyFrom over a stand-in quest - the action's own checkTrigger, the place and the clock as the quest's. */
const daily = ({ questName = 'N0B10Y03', online = true, here = () => true, now = () => 0 } = {}) => {
  const quest = {
    questName, nowSeconds: now,
    hooks: { sharedClock: () => online },
    getPlace: (sym) => (sym?.name === 'magesguild' ? { isPlayerHere: here } : null),
  };
  return new DailyFrom(null).createNew('daily from 00:00 to 03:00', quest);
};

test('GUARD-ONLINE: DailyFrom keeps DFU\'s window offline and for every other quest, and takes the arrival\'s online for Guard the Guild', () => {
  let t = 12 * 3600;   // noon on day 0
  const now = () => t;
  assert.equal(daily({ online: false, now }).checkTrigger(), false, 'offline at noon: DFU\'s 00:00-03:00, shut');
  assert.equal(daily({ questName: 'M0B00Y00', now }).checkTrigger(), false, 'online, another quest: DFU\'s window');
  const a = daily({ now });
  assert.equal(a.checkTrigger(), false, 'online at noon, just arrived');
  t += 10 * MIN;
  assert.equal(a.checkTrigger(), true, 'ten game minutes after arriving the guard window stands - noon or not');
  t = 24 * 3600 + 3600;   // 01:00 on day 1
  assert.equal(daily({ online: false, now }).checkTrigger(), true, 'offline at 01:00: DFU\'s window is open');
  let here = false;
  const away = daily({ now, here: () => here });
  assert.equal(away.checkTrigger(), false, 'online and not in the hall: no watch starts');
  assert.equal(away.guardAnchor, null, '...and no arrival is taken');
  t += 30 * MIN;
  here = true;
  away.checkTrigger();
  assert.equal(away.guardAnchor, t, 'the arrival is read off the quest\'s own place');
  // it rides the save beside C#'s fields, and an older save without it restores as "no watch yet"
  const shape = away.saveShape.map(([f]) => f);
  assert.deepEqual(shape, ['minDailySeconds', 'maxDailySeconds', 'guardAnchor', 'guardAway']);
});

test('GUARD-ONLINE: the table names the real quest\'s watch - N0B10Y03\'s _S.02_ is a DailyFrom whose task keeps PcAt on the place the window reads', () => {
  const lines = rd('vendor/dfu-quests/Quests/N0B10Y03.txt').replace(/^﻿/, '').split(/\r?\n/);
  const m = new QuestMachine({ nowSeconds: () => 0, showPopup() {}, getQuestSourceLines: () => lines });
  const quest = m.parseQuestShape('N0B10Y03');
  assert.ok(quest, 'the vendored quest parses');
  const s02 = quest.tasks.get('S.02');
  assert.equal(s02.type, TaskType.Standard);
  assert.ok(s02.actions[0] instanceof DailyFrom, 'its trigger is the daily window');
  const pcAt = s02.actions.find((a) => a instanceof PcAt);
  assert.equal(pcAt?.placeSymbol?.name, ONLINE_GUARD_WINDOWS.N0B10Y03.place, 'the watch is kept where the script keeps it');
  assert.ok(quest.resources.get(ONLINE_GUARD_WINDOWS.N0B10Y03.place)?.isPlace, 'a Place of the quest');
  // ...and the payment still waits on the window being shut
  assert.ok(quest.tasks.get('pcgetsgold'), 'the reward task stands');
});

test('GUARD-ONLINE: the shared clock reaches the quest - both bridge hosts say it, the bridge carries it, the machine hands it to the actions', () => {
  assert.match(rd('src/scenes/questBridge.js'), /sharedClock: \(\) => !!ctx\.sharedClock\?\.\(\),/);
  assert.match(rd('src/scenes/questBridge.js'), /'sharedClock'/, 'a contract seam - a host that forgets it is reported');
  assert.match(rd('src/systems/quest/machine.js'), /sharedClock: \(\) => !!this\.deps\.sharedClock\?\.\(\),/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(rd(f), /sharedClock: \(\) => sharedClockOn\(\),/, `${f} wires it`);
  }
  const m = new QuestMachine({ sharedClock: () => true });
  assert.equal(m._buildHooks().sharedClock(), true);
  assert.equal(new QuestMachine({})._buildHooks().sharedClock(), false, 'a machine told nothing is offline');
});
