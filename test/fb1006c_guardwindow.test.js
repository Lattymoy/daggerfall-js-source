// FIELD BUGS 2026-10-06c GUARD-WINDOW (bible/01-Overview/Field-Bugs-2026-10-06c.md; Aru on Discord: "So I picked up the
// quest, the three hours passed, the mage disappeared, but no enemies showed up, so now I can't complete it ... I even
// wondered around to check if the assassins would spawn"). N0B20Y02, "Protect an Honored Mage": `until _S.12_
// performed: pc at _magesguild_ set _S.01_`, and `_S.01_` sends the three Nightblades once, at a random point in their
// first 55 minutes (online since WAVE-WAIT, inside the short wait); `_S.12_` (three hours) hides the mage, and the
// reward waits on both. REST8 read `_S.12_` as a delay, and online a delay is cut to the short wait - 24 minutes: the
// mage was hidden before the attack more often than not, and a guard who stepped out in those two real minutes had
// `_S.01_` cleared for good. A deadline by hand now (ONLINE_DEADLINES): the guard keeps its three hours, played, and
// the attack always comes inside it. The real script, parsed and ticked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { ONLINE_DEADLINES, ONLINE_DELAY_SECONDS, PLAYED_STEP_MAX_SECONDS } from '../src/systems/quest/clock.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}

/** The quest over the hosts' clock seams and a spawn seam that counts the waves made and stands every foe at once. */
function guard(online) {
  const now = { s: 1_000_000, raised: 0 };
  const waves = [];
  const lines = rd('vendor/dfu-quests/Quests/N0B20Y02.txt').split(/\r?\n/);
  const world = {
    createFoeGameObjects: (foe, n) => { waves.push({ at: now.s, foe: foe.symbol.name, n }); return Array.from({ length: n }, () => ({})); },
    tryPlaceFoe: () => true,
  };
  const q = new QuestMachine({
    nowSeconds: () => now.s, raisedSeconds: () => now.raised, questClockStepMax: () => (online ? PLAYED_STEP_MAX_SECONDS : Infinity),
    showPopup() {}, getQuestSourceLines: () => lines, sharedClock: () => online, world,
  }).parseQuestShape('N0B20Y02');
  q.hooks.world = world;   // the shape's parse is headless (no scene); the running host hands the spawn seam
  q.rolls = () => 0;   // the worst case: no backdate - the wave a full interval after the guard begins (55 minutes; online 24)
  return { q, now, waves };
}

test('GUARD-WINDOW: the guard of N0B20Y02 is a deadline online - by hand, the reading calls it the trance ending - and keeps its three hours; offline it is DFU\'s clock', () => {
  assert.deepEqual([...ONLINE_DEADLINES.N0B20Y02], ['S.12']);
  for (const online of [true, false]) {
    const { q } = guard(online);
    const c = q.resources.get('S.12');
    assert.equal(c.isDeadline, true, `${online ? 'online' : 'offline'}: a window to act`);
    assert.equal(c.waitsShort, false, 'no short wait - three hours, not the 24-minute cut');
    assert.equal(c.startingTimeInSeconds, 3 * 3600);
  }
  assert.ok(ONLINE_DELAY_SECONDS < 55 * 60, 'the cut it had was shorter than the attack\'s own interval - why it could not stand');
});

test('GUARD-WINDOW: online, a guard who stays in the hall meets the three Nightblades before the mage is hidden - even at the latest the wave can come; under the old short wait the mage went first and the window shut on them', () => {
  for (const online of [true, false]) {
    const { q, now, waves } = guard(online);
    const window = q.resources.get('S.12');
    window.startTimer();
    const s01 = q.getTask({ name: 'S.01' });
    const createFoe = s01.actions.find((a) => a.constructor.name === 'CreateFoe');
    assert.ok(createFoe, '_S.01_ sends the Nightblades');
    assert.deepEqual([createFoe.spawnInterval, createFoe.spawnMaxTimes, createFoe.spawnChance], [55 * 60, 1, 100]);
    s01.start();   // `pc at _magesguild_ set _S.01_` - the guard stands in the hall
    let hiddenAt = null;
    for (let t = 0; t < 4 * 3600 && hiddenAt == null; t += PLAYED_STEP_MAX_SECONDS) {
      now.s += PLAYED_STEP_MAX_SECONDS;
      window.tick(q);
      s01.update();
      if (window.clockFinished) hiddenAt = now.s;
    }
    assert.ok(hiddenAt != null, 'the guard ends');
    assert.equal(waves.length, 1, `${online ? 'online' : 'offline'}: one wave`);
    assert.deepEqual([waves[0].foe, waves[0].n], ['F.00', 3], 'the three Nightblades');
    assert.ok(waves[0].at < hiddenAt, `${online ? 'online' : 'offline'}: the attack (${waves[0].at - 1_000_000} s in) inside the guard (${hiddenAt - 1_000_000} s)`);
  }
});
