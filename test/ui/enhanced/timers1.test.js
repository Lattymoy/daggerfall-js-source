// TIMERS1 (2026-10-02, Mac: "we need to create a new unique UI element for reset times like the Sunday wars, oblivion
// gates, town raids, and anything else so the player can keep track of when things are and watch countdowns. Im
// thinking maybe an enhanced plus button on the pause menu next to the profile icon").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eventTimerRows, timerText, localWhenText } from '../../../src/systems/eventTimers.js';
import { timersMark, timersWindow, placeBeside } from '../../../src/ui/enhanced/enhancedTimers.js';
import { gateTimes, gameDayAt, gateAt } from '../../../src/net/gate/gateLaw.js';
import { seatWeekOf, seatWeekStartMs, SEAT_RECKONING_MS, BATTLE_LENGTH_MS } from '../../../src/net/townSeatLaw.js';
import { ENHANCED_CSS } from '../../../src/ui/enhanced/enhancedStyle.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const byId = (rows, id) => rows.find((r) => r.id === id);
// Friday 2026-10-02 12:20 UTC - a Muster, a gate day, the Reckoning that evening
const NOW = Date.UTC(2026, 9, 2, 12, 20, 0);

test('TIMERS1: the gate\'s row is gateLaw\'s - coming to its opening, live to its seal, then to its collapse', () => {
  const t = gateAt(NOW);
  const before = eventTimerRows({ now: t.omenAt - 1000 });
  assert.equal(byId(before, `gate:${t.day}`).at, t.openAt, 'quiet: counts to the opening');
  assert.equal(byId(before, `gate:${t.day}`).live, false);
  const open = eventTimerRows({ now: t.openAt + 1000, gate: { place: 'Daggerfall' } });
  const g = byId(open, `gate:${t.day}`);
  assert.deepEqual([g.live, g.at, g.where], [true, t.sealAt, 'Near Daggerfall'], 'open: live to the seal, where it stands');
  assert.equal(byId(open, `gate:${t.day + 1}`).at, gateTimes(t.day + 1).openAt, '...and the next one after it');
  const shut = eventTimerRows({ now: t.sealAt + 1000 });
  assert.deepEqual([byId(shut, `gate:${t.day}`).live, byId(shut, `gate:${t.day}`).at], [true, t.wrathAt], 'sealed for the night: live to the collapse');
});

test('TIMERS1: the seat week is townSeatLaw\'s - the Reckoning and the Turning (Sunday 18:00 UTC), and a Season\'s end', () => {
  const rows = eventTimerRows({ now: NOW, zero: 0, seatsOpen: true });
  const turning = seatWeekStartMs(seatWeekOf(NOW) + 1);
  assert.equal(byId(rows, 'turning').at, turning);
  assert.equal(new Date(turning).getUTCDay(), 0, 'a Sunday');
  assert.equal(new Date(turning).getUTCHours(), 18, '18:00 UTC');
  assert.equal(byId(rows, 'reckoning').at, turning - SEAT_RECKONING_MS, 'the Muster counts to the Reckoning');
  assert.equal(byId(rows, 'reckoning').live, false);
  const reck = eventTimerRows({ now: turning - 3600_000, seatsOpen: true });
  assert.deepEqual([byId(reck, 'reckoning').live, byId(reck, 'reckoning').at], [true, turning], 'in the Reckoning: live to the Turning');
  assert.ok(rows.some((r) => r.id.startsWith('season:') && /ends$/.test(r.title)), 'a counted Season names its end');
  assert.ok(!eventTimerRows({ now: NOW, seatsOpen: true }).some((r) => r.id.startsWith('season:')), 'no zero, no Season');
  // AUDIT TIMERS1 D5: an account the seats are not open to is not told of their week
  const shut = eventTimerRows({ now: NOW, zero: 0 });
  assert.ok(!shut.some((r) => r.kind === 'seat'), 'no Reckoning, no Turning, no Season for a closed account');
  assert.doesNotMatch(byId(shut, 'daily').detail, /Watch/, '...nor the Watch\'s daily cap');
});

test('TIMERS1: the week\'s battles from the seats list - coming to the start, live to the end; the Royal Tourney to the Turning', () => {
  const start = NOW + 26 * 3600_000;
  const seats = [
    { key: 'w', name: 'Wayrest', tier: 'palace', battle: { kind: 'siege', guild: 'The Red Hand', against: 'Crows', startsAt: start / 1000, endsAt: null, state: 'scheduled' } },
    { key: 'v', name: 'Ilessan', tier: 'palace', battle: { kind: 'revolt', guild: 'Ilessan', startsAt: (NOW - 600_000) / 1000, endsAt: null, state: 'scheduled' } },
    { key: 'f', name: 'Old', tier: 'palace', battle: { kind: 'siege', startsAt: (NOW - 7200_000) / 1000, endsAt: (NOW - 3600_000) / 1000, state: 'scheduled' } },
    { key: 'x', name: 'Fought', tier: 'palace', battle: { kind: 'siege', startsAt: start / 1000, state: 'fought' } },
    { key: 's', name: 'Sentinel', tier: 'crown', holder: { edict: 'royal-tourney' } },
  ];
  const rows = eventTimerRows({ now: NOW, seats });
  // AUDIT TIMERS1 D1: the service's shape - each side the guild record, never a name; a revolt names the holder alone
  const g = (name, tag) => ({ id: 1, name, tag, heraldry: {} });
  const real = eventTimerRows({ now: NOW, seats: [
    { key: 'a', name: 'Anticlere', tier: 'palace', battle: { kind: 'siege', guild: g('Silver Hand', 'SH'), against: g('the Ebon Oath', 'EO'), startsAt: start / 1000, state: 'scheduled' } },
    { key: 'b', name: 'Ilessan', tier: 'palace', holder: { guild: g('Crows', 'CR') }, battle: { kind: 'revolt', guild: null, startsAt: start / 1000, state: 'scheduled' } },
    { key: 'c', name: 'Kvatch', tier: 'palace', battle: { kind: 'tourney', guild: g('Red Hand', 'RH'), startsAt: start / 1000, state: 'scheduled' } },
  ] });
  assert.equal(byId(real, 'battle:a').where, 'Silver Hand <SH> against the Ebon Oath <EO>');
  assert.equal(byId(real, 'battle:b').where, 'Against Crows <CR>');
  assert.equal(byId(real, 'battle:c').where, 'Red Hand <RH>');
  assert.ok(!real.some((r) => /object Object/.test(`${r.where} ${r.title}`)), 'no "[object Object]" anywhere');
  // AUDIT TIMERS1 D2: a crown's battle over (still 'scheduled' until the Turning) does not hide its Royal Tourney
  const crown = eventTimerRows({ now: NOW, seats: [{ key: 'r', name: 'Wayrest', tier: 'crown', holder: { edict: 'royal-tourney' },
    battle: { kind: 'siege', startsAt: (NOW - 7200_000) / 1000, endsAt: (NOW - 4500_000) / 1000, state: 'scheduled' } }] });
  assert.ok(byId(crown, 'royal:r'), 'the Royal Tourney still stands');
  const siege = byId(rows, 'battle:w');
  assert.deepEqual([siege.title, siege.where, siege.live, siege.at], ['Siege of Wayrest', 'The Red Hand against Crows', false, start]);
  const revolt = byId(rows, 'battle:v');
  assert.deepEqual([revolt.live, revolt.at], [true, NOW - 600_000 + BATTLE_LENGTH_MS.revolt], 'a revolt under way, to its two hours\' end');
  assert.equal(byId(rows, 'battle:f'), undefined, 'a battle already over says nothing');
  assert.equal(byId(rows, 'battle:x'), undefined, 'nor one fought');
  assert.equal(byId(rows, 'royal:s').at, seatWeekStartMs(seatWeekOf(NOW) + 1));
});

test('TIMERS1: the raids, the game day and the UTC day', () => {
  const raids = [
    { name: 'Gothway Garden', region: 'Daggerfall', type: 'orcs', startMs: NOW + 300_000, endMs: NOW + 900_000 },
    { name: 'Ashfield', region: 'Wayrest', type: 'bandits', startMs: NOW - 60_000, endMs: NOW + 540_000 },
    { name: 'Gone', startMs: NOW - 900_000, endMs: NOW - 60_000 },
    { name: 'Cleansed', startMs: NOW - 60_000, endMs: NOW + 60_000, done: true },
  ];
  const rows = eventTimerRows({ now: NOW, raids, region: 'Daggerfall' });
  const coming = rows.find((r) => r.title === 'Raid on Gothway Garden');
  assert.deepEqual([coming.live, coming.at, coming.where, coming.detail], [false, NOW + 300_000, 'In Daggerfall', 'Orcs attack'], 'my own region\'s raid, whole');
  // AUDIT TIMERS1 D3: every other region's raids are ONE row - the soonest to matter (one under way, to its end)
  const else1 = byId(rows, 'raids:elsewhere');
  assert.deepEqual([else1.title, else1.live, else1.at, else1.where, else1.detail], ['Raids elsewhere: Ashfield', true, NOW + 540_000, 'In Wayrest', null]);
  assert.ok(!rows.some((r) => /Gone|Cleansed/.test(r.title)), 'an ended or cleansed raid says nothing');
  const many = Array.from({ length: 22 }, (_, i) => ({ name: `T${i}`, region: `R${i % 11}`, type: 'orcs', startMs: NOW + (i + 1) * 60_000, endMs: NOW + (i + 11) * 60_000 }));
  const crowd = eventTimerRows({ now: NOW, raids: many, region: 'R3' });
  assert.equal(crowd.filter((r) => r.kind === 'raid').length, 3, 'twenty-two raids: R3\'s two and one row for the rest');
  assert.equal(byId(crowd, 'raids:elsewhere').detail, '19 more today across the Iliac Bay');
  assert.equal(byId(eventTimerRows({ now: NOW, raids: many }), 'raids:elsewhere').title, 'Next raid: T0', 'with no region known, the next one');
  assert.equal(byId(rows, 'gameday').title, 'New bounty hunts and raids', 'AUDIT TIMERS1 D4: the event clock\'s day, said as what turns - not the calendar\'s');
  const next = byId(rows, 'gameday').at;
  assert.equal(gameDayAt(next), gameDayAt(NOW) + 1, 'the next game day');
  assert.ok(gameDayAt(next - 1) === gameDayAt(NOW), '...at its first instant');
  assert.equal(byId(rows, 'daily').at, Date.UTC(2026, 9, 3), '00:00 UTC');
});

test('TIMERS1: live rows first, soonest end first; then what is coming, soonest first; nothing without a clock', () => {
  const rows = eventTimerRows({ now: NOW, seatsOpen: true, raids: [{ name: 'A', startMs: NOW - 1, endMs: NOW + 5000 }] });
  const firstComing = rows.findIndex((r) => !r.live);
  assert.ok(rows.slice(0, firstComing).every((r) => r.live) && rows.slice(firstComing).every((r) => !r.live));
  for (let i = firstComing + 1; i < rows.length; i++) assert.ok(rows[i].at >= rows[i - 1].at);
  assert.deepEqual(eventTimerRows({ now: NaN }), []);
  assert.deepEqual(eventTimerRows(null), []);
});

test('TIMERS1: the words - a countdown in d/h, h:mm:ss or m:ss, and the moment in the player\'s own clock', () => {
  assert.equal(timerText(0), '0:00');
  assert.equal(timerText(-5000), '0:00');
  assert.equal(timerText(247_000), '4:07');
  assert.equal(timerText(246_500), '4:07', 'AUDIT TIMERS1 D7: rounded up, as the gate\'s banner rounds');
  assert.equal(timerText(400), '0:01');
  assert.equal(timerText(3_909_000), '1:05:09');
  assert.equal(timerText(2 * 86400_000 + 4 * 3600_000 + 59_000), '2d 04h');
  const today = new Date(2026, 9, 2, 9, 0).getTime();
  assert.equal(localWhenText(new Date(2026, 9, 2, 18, 5).getTime(), today), '18:05');
  assert.equal(localWhenText(new Date(2026, 9, 4, 18, 0).getTime(), today), 'Sun 18:00');
  assert.equal(localWhenText(new Date(2026, 9, 18, 18, 0).getTime(), today), 'Sun 18 Oct 18:00', 'AUDIT TIMERS1 D9: beyond the week, which Sunday');
});

// ── the window, over a document just real enough ──
function fakeDoc() {
  const node = (tag) => {
    const n = { tag, children: [], className: '', textContent: '', attrs: {}, style: {}, listeners: {}, title: '', type: '',
      append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute(k, v) { n.attrs[k] = v; },
      addEventListener(t, f) { (n.listeners[t] ??= []).push(f); } };
    Object.defineProperty(n, 'textContent', { get() { return n._t ?? ''; }, set(v) { n._t = v; if (v === '') n.children = []; } });
    return n;
  };
  return { createElement: node };
}
const walk = (n, f) => { f(n); for (const c of n.children ?? []) walk(c, f); };
const all = (root, cls) => { const out = []; walk(root, (n) => { if (String(n.className).split(' ').includes(cls)) out.push(n); }); return out; };

test('TIMERS1: the window draws its rows (TIMERS2: in groups), rewrites the countdowns in place, and rebuilds only when a row changes', () => {
  let now = NOW;
  const src = { raids: [{ name: 'Ashfield', region: 'Wayrest', type: 'bandits', startMs: NOW - 1, endMs: NOW + 5000 }] };
  let closed = 0;
  const view = timersWindow(fakeDoc(), { read: () => ({ ...src, now }), onClose: () => { closed++; }, every: 1e9, group: 'all' });
  view.stop();
  const root = view.root;
  assert.ok(root.className.includes('px-win') && root.className.includes('px-timerswin'), 'the pause window\'s frame');
  assert.deepEqual(all(root, 'tm-section-name').map((n) => n.textContent), ['World events', 'Town raids', 'Resets'], 'PIN MOVED (TIMERS2): the rows under what they are, a row under way saying "Now" itself - timers2.test.js');
  const row = all(root, 'tm-raid')[0];
  const count = all(row, 'tm-count')[0];
  assert.equal(count.textContent, '0:05');
  now += 2000; view.draw();
  assert.equal(all(root, 'tm-raid')[0], row, 'the same row, moved on');
  assert.equal(all(row, 'tm-count')[0].textContent, '0:03');
  now += 10_000; view.draw();
  assert.equal(all(root, 'tm-raid').length, 0, 'an ended raid leaves the list');
  all(root, 'tm-close')[0].listeners.click[0]();
  assert.equal(closed, 1);
  const empty = timersWindow(fakeDoc(), { read: () => null, onClose() {}, every: 1e9 });
  empty.stop();
  assert.equal(all(empty.root, 'tm-empty')[0].textContent, 'The world\'s clock cannot be read right now.', 'AUDIT TIMERS1 UI-8: no source is the connection, said so - never "nothing is scheduled"');
  assert.deepEqual([view.root.attrs.role, view.root.attrs['aria-modal'], view.root.attrs['aria-labelledby']], ['dialog', 'true', 'tm-title'], 'AUDIT TIMERS1 UI-6: a dialog, named by its title');
});

test('TIMERS1: the hourglass - a button that opens, placed just left of the profile mark it is measured against', () => {
  let opened = 0;
  const b = timersMark(fakeDoc(), { onOpen: () => { opened++; } });
  assert.equal(b.className, 'px-timersmark');
  assert.match(b.attrs['aria-label'], /Timers/);
  assert.equal(b.title, 'Timers');
  assert.deepEqual(b.children.map((c) => c.className), ['px-hourglass'], 'HOURGLASS-ALONE: the glass, and no word beside it (the owner: "remove the text \"timer\" from next of the hourglass")');
  assert.ok(!ENHANCED_CSS.includes('px-timersword'), 'and no rule left for the word');
  b.listeners.click[0]();
  assert.equal(opened, 1);
  const mark = { style: {}, offsetHeight: 44 };
  placeBeside(mark, { getBoundingClientRect: () => ({ left: 1096, top: 10, width: 172, height: 48 }) }, { getBoundingClientRect: () => ({ right: 1280, top: 0 }) });
  assert.deepEqual(mark.style, { right: '194px', top: '12px' });
});

test('TIMERS1 wiring: the pause face carries the hourglass where the host hands a source, and every host hands the world\'s', () => {
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /home\.append\(profileMark\(\)\);[\s\S]{0,600}?if \(hooks\.timers\?\.\(\)\) \{\s*\n\s*mark = timersMark\(document, \{ open: timersOpen,/, 'beside the profile mark, online only');
  assert.match(menu, /timersAnchor = anchorBeside\(mark, home\.querySelector\?\.\('\.px-profile'\), home\);/, 'AUDIT TIMERS1 UI-3: placed again on every resize');
  assert.match(menu, /for \(const n of \[stage, home\.querySelector\?\.\('\.px-profile'\), mark\]\) n\?\.setAttribute\?\.\('inert', ''\);/, 'AUDIT TIMERS1 UI-5/UI-7: the pause face under the window is out of reach');
  assert.match(menu, /read: \(\) => hooks\.timers\?\.\(\{ ask: true \}\) \?\? null/, 'AUDIT TIMERS1 UI-9: only the window read asks the service');
  assert.match(read('src/ui/plus/plusPad.js'), /const visible = \(n\) => !!n && n\.isConnected !== false && !n\.closest\?\.\('\[inert\]'\)/, 'a bumper turns no inert tabs');
  assert.match(menu, /const back = accountOpen \? \(\) => closeAccount\(\)[^\n]*\n\s*: timersOpen && timersView \? \(\) => \{ timersOpen = false; timersFocusBack = true; render\(\); \}/, 'Escape closes a DRAWN window before it resumes (AUDIT TIMERS1 UI-11)');
  assert.match(menu, /stopTimers\(\);   \/\/ TIMERS1: a rebuild/, 'a rebuild stops the old tick');
  assert.match(menu, /timersOpen = false;   \/\/ TIMERS1: and the timers window the same/, 'a visit\'s window');
  const world = read('src/scenes/world.js');
  // EVENTS1: seated where it is made for the HUD's event board too (systems/eventNotices.js seatEventBoard answers it as handed)
  assert.match(world, /const timersSource = seatEventBoard\(\(\{ ask = false \} = \{\}\) => \{\n(\s*\/\/[^\n]*\n)*\s*try \{\n(\s*\/\/[^\n]*\n)*\s*if \(!online \|\| !_sharedClockHeard\) return null;/, 'offline, or before the relay\'s clock: no source, no hourglass');
  assert.match(world, /\} catch \{ return null; \}\n  \}, \(text\) => chatNotice\(text\), townTalk\);[^\n]*\n  const pauseDoorHooks/, 'AUDIT TIMERS1 D6: a pause before the boot declared what it reads is no timers, never a throw');
  assert.equal((world.match(/timers: timersSource,/g) ?? []).length, 2, 'the street\'s pause bag and the modes host');
  assert.match(read('src/scenes/worldModes.js'), /timers: host\.timers,/, 'a building\'s pause');
  assert.match(read('src/scenes/worldModes.js'), /timers: \(o\) => host\.timers\?\.\(o\) \?\? null,/, 'the dungeon\'s opts, the ask carried');
  assert.match(read('src/scenes/dungeonContext.js'), /timers: \(o\) => opts\.timers\?\.\(o\) \?\? null,/, 'the dungeon\'s pause');
  assert.match(world, /if \(ask && seatBook\?\.open !== false && now - _timersSeatAsk > 60_000\)/, 'the seats list asked only by the window');
  assert.match(ENHANCED_CSS, /\n\.px-timersmark \{ position: absolute;/);
  assert.match(ENHANCED_CSS, /\n\.px-win\.px-timerswin \{/);
});

// ── AUDIT TIMERS1, the UI lens: measured in Chromium over the real pause face, held here where it was fixed ──
const lum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('AUDIT TIMERS1 UI-1/UI-2/UI-4: the stage centres on every screen, the pause window clears the corner marks, Stone reads', () => {
  assert.match(ENHANCED_CSS, /\n\.px-stage\.px-timersstage \{ display: grid; justify-content: center; align-content: center;/, 'two classes - the pause stage\'s short-screen padding and flex-start cannot take it');
  assert.match(ENHANCED_CSS, /\.px-over \.px-stage:not\(\.px-acctstage\):not\(\.px-timersstage\) \{ padding-top: max\(7dvh, 64px\); \}/, 'a short screen\'s pause window under the 56px marks');
  assert.match(ENHANCED_CSS, /@media \(max-height: 560px\) \{\n\s*\.px-stage\.px-timersstage \{ padding: 10px 12px; \}\n\s*\.px-win\.px-timerswin \{ max-height: calc\(100dvh - 20px\); \}\n/);
  const stone = '#51514c';   // Stone's panel, measured under the window
  for (const [what, c] of [['dim', '#e2dccd'], ['brass', '#ffd98a'], ['where', '#fbf8f0'], ['count', '#ffe3a6'], ['live count', '#c8ffd6']]) {
    assert.ok(contrast(c, stone) >= 4.5, `Stone ${what} ${c} at ${contrast(c, stone).toFixed(2)}:1`);
    assert.ok(ENHANCED_CSS.includes(c), `${c} in the sheet`);
  }
  assert.match(ENHANCED_CSS, /:root\[data-plus-theme="stone"\] \.px-timerswin \{ --dim: #e2dccd; --brass: #ffd98a;/);
});

test('AUDIT TIMERS1 UI-10: a window taken out of the page stops its own tick', () => {
  let reads = 0;
  const view = timersWindow(fakeDoc(), { read: () => { reads++; return { now: NOW }; }, onClose() {}, every: 5 });
  view.root.isConnected = false;   // removed from the page, its stop never called
  return new Promise((done) => setTimeout(() => {
    const was = reads;
    setTimeout(() => { assert.equal(reads, was, 'no more reads once the tick saw it gone'); assert.equal(was, 1, 'only the first draw read'); view.stop(); done(); }, 40);
  }, 40));
});
