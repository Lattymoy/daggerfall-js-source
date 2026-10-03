// TIME4 (2026-10-01, Mac: "Let's do it. This needs to be perfect"): THE WORDS. Design: bible/06-Systems/Online-Time-Arc.md
// section 7. What the player is told about online time is the law's own numbers: the Online pane's sentence (true when
// it opens, before the sky's switch and after), the patch notes' figures, and the bible's switch instant - each held
// here to the law it states, so a dial turned in net/skyLaw.js without its words fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKY_SEGMENTS, skyClassicMinutes } from '../src/net/skyLaw.js';
import { skyDayWords } from '../src/ui/enhancedMenu.js';
import { PLAYED_STEP_MAX_SECONDS } from '../src/systems/quest/clock.js';
import { REST_WAIT_PER_HOUR, MINUTES_PER_TICK } from '../src/systems/restSession.js';
import { DAWN_HOUR, DUSK_HOUR } from '../src/systems/gameDate.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const SWITCH = SKY_SEGMENTS[SKY_SEGMENTS.length - 1];
const REAL_MIN_PER_SKY_DAY = 1440 / SWITCH.minutesPerMs / 60_000;
const minuteOfDay = (m) => ((m % 1440) + 1440) % 1440;

test('TIME4 the Online pane says the sky\'s day as it is when the pane opens: two hours until the switch (and when, in this machine\'s time), an hour from it - midnight on the hour, dusk at :45, in this machine\'s own minutes', () => {
  const utc = (ms) => new Date(ms).getUTCMinutes() + new Date(ms).getUTCSeconds() / 60;
  const before = skyDayWords(SWITCH.fromMs - 1, (ms) => `<${ms}>`, utc);
  assert.equal(before, `A day in the world is two hours of real time until <${SWITCH.fromMs}>; from then on it is an hour: midnight falls on the hour, and dusk at :45.`);
  const after = skyDayWords(SWITCH.fromMs, String, utc);
  assert.equal(after, 'A day in the world is an hour of real time: midnight falls on the hour, and dusk at :45.');
  // AUDIT TIME: the minutes are this machine's own - a clock set a quarter of an hour off UTC (Nepal's +5:45) hears its own,
  // and one set half an hour off (India's +5:30) its own
  assert.equal(skyDayWords(SWITCH.fromMs, String, (ms) => (utc(ms) + 45) % 60), 'A day in the world is an hour of real time: midnight falls at :45, and dusk at :30.');
  assert.equal(skyDayWords(SWITCH.fromMs, String, (ms) => (utc(ms) + 30) % 60), 'A day in the world is an hour of real time: midnight falls at :30, and dusk at :15.');
  // ...and every number in it is the law's
  assert.equal(REAL_MIN_PER_SKY_DAY, 60, 'an hour: the sky\'s rate (change it and change the words)');
  for (let k = 1; k <= 48; k++) {
    const hour = Math.ceil(SWITCH.fromMs / 3_600_000) * 3_600_000 + k * 3_600_000;   // :00 UTC
    assert.ok(Math.abs(minuteOfDay(skyClassicMinutes(hour)) - 0) < 1e-6 || Math.abs(minuteOfDay(skyClassicMinutes(hour)) - 1440) < 1e-6, 'midnight on the hour');
    const dusk = hour + 45 * 60_000;
    assert.ok(Math.abs(minuteOfDay(skyClassicMinutes(dusk)) - DUSK_HOUR * 60) < 1e-6, 'dusk at :45');
  }
  // before the switch the sky is the event clock's: a day every two real hours
  const ev = skyClassicMinutes(SWITCH.fromMs - 3_600_000 * 4) - skyClassicMinutes(SWITCH.fromMs - 3_600_000 * 6);
  assert.ok(Math.abs(ev - 1440) < 1e-6, 'two real hours, a day, before it');
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /can hurt you too\. ' \+ skyDayWords\(\) \+ ' The world\\u2019s clock and sky run on real time/, 'the paragraph opens its clock with the sentence');
  assert.match(menu, /a full moon holds a lycanthrope for its night alone\./, 'TIME2, said at the door');
  assert.match(menu, /loans and repairs run on it\. Quests online have no time limits: none fails because time ran out, a bounty never lapses, and a quest that would make you wait days \(a letter, a meeting\) moves on after a minute or two of play\./, 'TIMEFREE, said at the door (TIME3 said the quest timers ran on it)');
});

test('TIME4 the figures the patch notes stated are the law\'s own: a day of 60 minutes, a full moon\'s night of 30, nightfall within 30, a three-day wait in about half a minute of rest, half an hour of game time at most for a tab away', () => {
  // the notes themselves live on the pull request since REL6, never as a file in the tree
  assert.equal(REAL_MIN_PER_SKY_DAY, 60);
  // a night (dusk to dawn) and the longest wait for nightfall (dawn to dusk) are twelve sky hours each
  const night = ((24 - DUSK_HOUR + DAWN_HOUR) * 60) / SWITCH.minutesPerMs / 60_000;
  const day = ((DUSK_HOUR - DAWN_HOUR) * 60) / SWITCH.minutesPerMs / 60_000;
  assert.deepEqual([night, day], [30, 30]);
  // the rest's pace: an hour is six sub-ticks of REST_WAIT_PER_HOUR / MINUTES_PER_TICK real seconds
  const restSeconds = 72 * 6 * (REST_WAIT_PER_HOUR / MINUTES_PER_TICK);
  assert.ok(restSeconds > 20 && restSeconds < 45, `72 hours rested in ${restSeconds} real seconds - about half a minute`);
  assert.equal(PLAYED_STEP_MAX_SECONDS, 30 * 60);
});

test('TIME4 the bible says what was built, and the switch instant it names is the law\'s', () => {
  const iso = new Date(SWITCH.fromMs).toISOString().replace('.000Z', 'Z');
  assert.equal(iso, '2026-10-03T17:07:30Z');
  const arc = rd('bible/06-Systems/Online-Time-Arc.md');
  assert.match(arc, /\*\*Status: BUILT 2026-10-01 - TIME1, TIME2, TIME3 and TIME4\*\*/);
  assert.ok(arc.includes(`**The sky switches at ${iso}**`), 'the design page names the law\'s instant - move both together (node tools/skyCutover.mjs)');
  assert.match(arc, /### 6\.3a As built \(TIME3\)/);
  assert.match(arc, /\*\*DECIDED 2026-10-01\*\*/);
  assert.match(arc, /9\. \*\*Time zones\*\*/, 'Mac\'s idea, recorded and not built');
  assert.ok(rd('bible/06-Systems/Online-Arc.md').includes(`a day every real\nhour from ${iso}`), 'WORLD5\'s note names the same instant');
  assert.match(rd('bible/06-Systems/Lived-Time.md'), /ANSWERED AND BUILT 2026-10-01/);
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /\[TIME3, 2026-10-01 \(`Online-Time-Arc\.md` 6\.3a\): the quest's clock is the CHARACTER's own now\./);
  assert.match(rd('bible/11-Multiplayer/World-Bosses.md'), /it RETIRES from the words/);
  assert.match(rd('bible/03-World/Clock-Arc.md'), /\[TIME1, 2026-10-01/);
  assert.match(rd('bible/06-Systems/Quest-Arc.md'), /## TIME3 - QUESTS ON TWO CLOCKS/);
  assert.match(rd('bible/01-Overview/Port-Ledger.md'), /\| \*\*ONLINE, A SKY THAT TURNS, A FULL MOON'S NIGHT AND QUESTS ON YOUR OWN TIME \(TIME1-TIME4/);
});
