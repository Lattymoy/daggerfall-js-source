// QT-LIVE1 (Mac, 2026-09-21: "The time doesn't print out live?" - "Do it").
// The enhanced journal's "Time remains" line rendered once when the
// panel opened and again on a click. Every host holds the quest
// machine's tick under the pause gate (DFU's PauseGame -> timeScale 0),
// so under the menu `remainingTimeInSeconds` is the remainder as of the
// last tick BEFORE it opened; offline the world stops too and that is
// harmless, but online the world runs on at twelve to one and a minute
// fell off every five real seconds with the line not moving. Two
// halves: the Clock answers its remainder AS OF NOW off the same
// arithmetic its tick subtracts (nothing is ticked under the gate), and
// the journal re-reads the host's log once a second and rewrites the
// span in place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Clock, PLAYED_STEP_MAX_SECONDS } from '../src/systems/quest/clock.js';
import { questTimerWords } from '../src/ui/enhancedMenu.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const questFor = (now, step) => ({ rolls: () => 0.5, nowSeconds: () => now.t, questClockStepMax: () => step.v, resources: new Map(), getPlace: () => null, travelSecondsTo: () => null, getTask: () => null });

test('QT-LIVE1a liveRemainingSeconds is the remainder the NEXT tick leaves - online clamped to one played step and never negative, offline the raw gap, floored at zero; and the tick then agrees with it', () => {
  const now = { t: 1000 }, step = { v: PLAYED_STEP_MAX_SECONDS };
  const q = questFor(now, step);
  const c = new Clock(q, 'Clock _c_ 01:00'); c.startTimer();
  assert.equal(c.liveRemainingSeconds(q), 3600, 'nothing has passed');
  now.t += 90;
  assert.equal(c.liveRemainingSeconds(q), 3510, 'ninety world seconds under the menu read off the line');
  assert.equal(c.remainingTimeInSeconds, 3600, 'and the FIELD did not move - nothing was ticked');
  now.t += 2 * PLAYED_STEP_MAX_SECONDS;
  assert.equal(c.liveRemainingSeconds(q), 3600 - PLAYED_STEP_MAX_SECONDS, 'online a gap past the step is time away: one step, no more');
  now.t = 500;
  assert.equal(c.liveRemainingSeconds(q), 3600, 'a backward sample online charges nothing');
  // the tick's own answer is the live read's, because they are one arithmetic
  now.t = 1000 + 400;
  const read = c.liveRemainingSeconds(q);
  c.tick(q);
  assert.equal(c.remainingTimeInSeconds, read, 'ONE HOME: what the read said is what the tick left');
  // offline: the raw gap, both directions (a backward jump there is a load)
  step.v = Infinity;
  const off = new Clock(q, 'Clock _o_ 00:10'); off.startTimer();
  now.t += 120;
  assert.equal(off.liveRemainingSeconds(q), 480);
  now.t -= 300;
  assert.equal(off.liveRemainingSeconds(q), 780, 'offline the raw gap stands, DFU\'s own arithmetic');
  now.t += 300 + 100_000;
  assert.equal(off.liveRemainingSeconds(q), 0, 'floored: a clock past its end reads zero, never a negative');
});

test('QT-LIVE1b a clock that is not running answers its field - disabled, and finished', () => {
  const now = { t: 0 }, step = { v: Infinity };
  const q = questFor(now, step);
  const idle = new Clock(q, 'Clock _i_ 01:00');
  now.t = 500;
  assert.equal(idle.liveRemainingSeconds(q), 3600, 'never started: the field');
  const done = new Clock(q, 'Clock _d_ 00:01'); done.startTimer();
  now.t += 120; done.tick(q);
  assert.equal(done.clockFinished, true);
  now.t += 999;
  assert.equal(done.liveRemainingSeconds(q), 0, 'finished: the field, which tick zeroed');
});

test('QT-LIVE1c questTimerWords: the line for the selected quest off a FRESH log, urgent under a world day, null when the clock is gone', () => {
  const log = { active: [
    { id: 5, name: 'A Small Debt', questName: '_BRISIEN', clockSeconds: 2 * 86400 + 3600, messages: [{ getTextTokens: () => [{ formatting: 'text', text: 'Pay up.' }] }] },
    { id: 6, name: 'A Rush Job', questName: '00B00Y00', clockSeconds: 1800, messages: [{ getTextTokens: () => [{ formatting: 'text', text: 'Hurry.' }] }] },
    { id: 7, name: 'No Clock', questName: '00B00Y01', clockSeconds: null, messages: [{ getTextTokens: () => [{ formatting: 'text', text: 'Whenever.' }] }] },
  ], finished: [] };
  assert.deepEqual(questTimerWords(log, 'a:5'), { text: 'Time remains: 2 days 1 hour', urgent: false });
  assert.deepEqual(questTimerWords(log, 'a:6'), { text: 'Time remains: 30 min', urgent: true });
  assert.equal(questTimerWords(log, 'a:7'), null, 'no clock: the panel is stale as a whole');
  assert.equal(questTimerWords(log, 'a:9'), null, 'the quest ended under the menu');
  assert.equal(questTimerWords(null, 'a:5'), null, 'a host with no log');
});

test('QT-LIVE1d the journal arms the once-a-second redraw ONLY under a timer, reads the host\'s log fresh each time, rewrites the span in place, and repaints when the line is gone', () => {
  const src = rd('src/ui/enhancedMenu.js');
  const meta = src.slice(src.indexOf('if (sel.clockSeconds != null) {'), src.indexOf('if (meta.childNodes.length)'));
  assert.match(meta, /armQuestTimer\(timer, sel\.key\);/, 'armed inside the timer block, keyed on the selected row');
  const arm = src.slice(src.indexOf('function armQuestTimer(span, key) {'), src.indexOf('function remainWords(s) {'));
  assert.match(arm, /questTimer = setInterval\(\(\) => \{/);
  assert.match(arm, /\}, 1000\);/, 'once a second - the words are minutes, and online a minute is five real seconds');
  assert.match(arm, /questTimerWords\(hooks\.questLog\?\.\(\), key\)/, 'the HOST\'s log, read fresh - never a log captured at render');
  assert.match(arm, /span\.textContent = w\.text;/);
  assert.match(arm, /span\.className = `px-qtimer\$\{w\.urgent \? ' urgent' : ''\}`;/, 'the urgent gold follows the number');
  assert.match(arm, /if \(!w\) \{ render\(\); return; \}/, 'a fired clock or an ended quest is a stale PANEL');
  assert.match(arm, /if \(questTimer\) \{ clearInterval\(questTimer\); questTimer = null; \}/, 're-arming clears the last one first');
});

// THE DERIVED LAW. Every interval this screen arms is owned: the
// variable it lands in is cleared by the rebuild (renderInto) AND by
// the unmount. The ground clock earned that law (PX1b); the quest timer
// is the second interval, and a third cannot arrive without both
// clears - the population is every `X = setInterval(` in the file.
test('QT-LIVE1e every setInterval in the enhanced menu is cleared by the rebuild and by the unmount (derived)', () => {
  const src = rd('src/ui/enhancedMenu.js');
  const owners = new Set([...src.matchAll(/(\w+) = setInterval\(/g)].map((m) => m[1]));
  assert.ok(owners.has('groundTimer') && owners.has('questTimer'), `the intervals: ${[...owners].join(', ')}`);
  const rebuild = src.slice(src.indexOf('function renderInto() {'), src.indexOf('const shell = el(\'div\', \'shell\');'));
  const unmountAt = src.indexOf('if (keyHandler) globalThis.removeEventListener(\'keydown\', keyHandler, { capture: true });');
  assert.ok(unmountAt > 0);
  const unmount = src.slice(unmountAt, src.indexOf('keyHandler = null;', unmountAt));
  for (const v of owners) {
    assert.match(src, new RegExp(`^let ${v} = null;`, 'm'), `${v} is module state, one owner`);
    assert.match(rebuild, new RegExp(`if \\(${v}\\) \\{ clearInterval\\(${v}\\); ${v} = null; \\}`), `${v} cleared by the rebuild`);
    assert.match(unmount, new RegExp(`if \\(${v}\\) \\{ clearInterval\\(${v}\\); ${v} = null; \\}`), `${v} cleared by the unmount`);
  }
});
