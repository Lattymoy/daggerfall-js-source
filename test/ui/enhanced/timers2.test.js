// TIMERS2 (2026-10-22, the owner: "organize the timer system in the pause menu"): THE TIMERS WINDOW IN GROUPS. The law
// (systems/eventTimers.js TIMER_GROUPS, timerGroupOf, timerGroups: each row under what it is, each group in the list's
// own order), the window (ui/enhanced/enhancedTimers.js: a head a group, how many are under way, a row under way saying
// "Now", a bar showing every group or one alone, kept while the game runs, a group that empties handing the list back to
// All) and the sheet (the Elite Breach's colour, the gate's from its herald's family, the bar and the badge on Stone).
import test from 'node:test';
import assert from 'node:assert/strict';
import { eventTimerRows, TIMER_GROUPS, timerGroupOf, timerGroups } from '../../../src/systems/eventTimers.js';
import { timersWindow, TIMER_KINDS, timerGroupTitle, timerGroupChip } from '../../../src/ui/enhanced/enhancedTimers.js';
import { ENHANCED_CSS } from '../../../src/ui/enhanced/enhancedStyle.js';
import { EG_ARCH_RING_CSS } from '../../../src/ui/eliteGates/egArchMapMark.js';
import { heraldCss } from '../../../src/net/herald/heraldCard.js';

// Friday 2026-10-02 12:20 UTC - a Muster, a gate day, the Reckoning that evening (TIMERS1's own instant)
const NOW = Date.UTC(2026, 9, 2, 12, 20, 0);
const RAIDS = [
  { name: 'Ashfield', region: 'Wayrest', type: 'bandits', startMs: NOW - 1, endMs: NOW + 5000 },
  { name: 'Gothway Garden', region: 'Daggerfall', type: 'orcs', startMs: NOW + 300_000, endMs: NOW + 900_000 },
];

// ── the window, over a document just real enough (timers1.test.js's, with the focus a press leaves) ──
function fakeDoc() {
  const doc = { activeElement: null };
  const node = (tag) => {
    const n = { tag, children: [], className: '', textContent: '', attrs: {}, style: {}, listeners: {}, title: '', type: '',
      append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute(k, v) { n.attrs[k] = v; },
      addEventListener(t, f) { (n.listeners[t] ??= []).push(f); }, focus() { doc.activeElement = n; },
      contains(x) { let found = false; walk(n, (c) => { if (c === x) found = true; }); return found; } };
    Object.defineProperty(n, 'textContent', { get() { return n._t ?? ''; }, set(v) { n._t = v; if (v === '') n.children = []; } });
    return n;
  };
  doc.createElement = node;
  return doc;
}
const walk = (n, f) => { f(n); for (const c of n.children ?? []) walk(c, f); };
const all = (root, cls) => { const out = []; walk(root, (n) => { if (String(n.className).split(' ').includes(cls)) out.push(n); }); return out; };
const text = (n) => { let s = n.textContent; walk(n, (c) => { if (c !== n && c.textContent) s += ` ${c.textContent}`; }); return s.trim(); };
const press = (n) => n.listeners.click[0]();

test('TIMERS2 the law: every kind the window draws stands in exactly one group, in the window\'s order - the world\'s events, the Battlespire, the raids, the seats and their battles, the resets; a kind no group names stands with the resets (mutants: a kind in two groups; the groups reordered; an unknown kind lost)', () => {
  assert.deepEqual(TIMER_GROUPS.map((g) => g.id), ['world', 'spire', 'raids', 'seats', 'resets']);
  const kinds = TIMER_GROUPS.flatMap((g) => g.kinds);
  assert.deepEqual([...kinds].sort(), [...TIMER_KINDS].sort(), 'every kind the sheet colours has a group, and no group names a kind the sheet does not');
  assert.equal(new Set(kinds).size, kinds.length, 'one group a kind');
  assert.deepEqual(['gate', 'serpent', 'super', 'star', 'elite', 'raid', 'battle', 'seat', 'reset'].map(timerGroupOf), ['world', 'world', 'world', 'world', 'spire', 'raids', 'seats', 'seats', 'resets']);
  assert.equal(timerGroupOf('nonesuch'), 'resets');
  for (const id of TIMER_GROUPS.map((g) => g.id)) assert.ok(timerGroupTitle(id) && timerGroupChip(id), `${id}: a head and a button`);
  assert.deepEqual(TIMER_GROUPS.map((g) => timerGroupTitle(g.id)), ['World events', 'The Battlespire', 'Town raids', 'Seats and battles', 'Resets']);
  assert.equal(timerGroupChip('all'), 'All');
});

test('TIMERS2 the layout: the rows by group in TIMER_GROUPS\'s order, each group\'s rows in the list\'s own order (live first, soonest end first, then soonest start), and how many of each are under way; a group with no row left out (mutants: a group\'s rows resorted; the live count off; an empty group drawn)', () => {
  const rows = eventTimerRows({ now: NOW, raids: RAIDS, region: 'Daggerfall', seatsOpen: true, zero: 0 });
  const groups = timerGroups(rows);
  assert.deepEqual(groups.map((g) => g.id), ['world', 'raids', 'seats', 'resets'], 'no Elite row without a breach or the boards\' door: no Spire group');
  for (const g of groups) {
    assert.deepEqual(g.rows, rows.filter((r) => timerGroupOf(r.kind) === g.id), `${g.id}: the list's own order`);
    assert.equal(g.live, g.rows.filter((r) => r.live).length);
  }
  assert.deepEqual(groups.find((g) => g.id === 'raids').rows.map((r) => [r.title, r.live]), [['Raids elsewhere: Ashfield', true], ['Raid on Gothway Garden', false]]);
  assert.equal(groups.find((g) => g.id === 'raids').live, 1);
  assert.equal(groups.reduce((n, g) => n + g.rows.length, 0), rows.length, 'every row in one group');
  assert.deepEqual(timerGroups([]), []);
  assert.deepEqual(timerGroups(null), []);
});

test('TIMERS2 the window: a head a group with how many are under way, a row under way saying "Now" above its countdown and no other row; the countdowns still rewritten in place (mutants: the badge on a coming row; the head\'s count unsaid; the rows rebuilt every tick)', () => {
  let now = NOW;
  const view = timersWindow(fakeDoc(), { read: () => ({ now, raids: RAIDS, region: 'Daggerfall' }), onClose() {}, every: 1e9, group: 'all' });
  view.stop();
  const root = view.root;
  assert.deepEqual(all(root, 'tm-section').map((h) => h.className), ['tm-section tm-g-world', 'tm-section tm-g-raids', 'tm-section tm-g-resets']);
  assert.deepEqual(all(root, 'tm-section').map(text), ['World events', 'Town raids 1 under way', 'Resets']);
  const live = all(root, 'tm-row').filter((r) => r.className.split(' ').includes('live'));
  assert.equal(live.length, 1);
  assert.deepEqual(all(live[0], 'tm-badge').map((b) => b.textContent), ['Now']);
  assert.equal(all(root, 'tm-badge').length, 1, 'a coming row wears no "Now"');
  const count = all(live[0], 'tm-count')[0];
  assert.equal(count.textContent, '0:05');
  now += 2000; view.draw();
  assert.equal(all(root, 'tm-raid')[0], live[0], 'the same row, moved on');
  assert.equal(count.textContent, '0:03');
});

test('TIMERS2 the bar: All and a button for each group with a row, each its count and a mark where one is under way; a press shows that group alone, pressed, and the next window opens on it; a group that empties hands the list back to All; no clock, no bar (mutants: the press ignored; the choice forgotten; an emptied group left showing nothing; a bar with nothing to show)', () => {
  let now = NOW;
  const read = () => ({ now, raids: RAIDS, region: 'Daggerfall' });
  const doc = fakeDoc();
  const view = timersWindow(doc, { read, onClose() {}, every: 1e9, group: 'all' });
  view.stop();
  const root = view.root;
  const chips = () => all(root, 'tm-chip');
  assert.deepEqual(chips().map((c) => [all(c, 'tm-chip-name')[0].textContent, all(c, 'tm-chip-n')[0].textContent, c.attrs['aria-pressed'], c.className.split(' ').includes('live')]), [
    ['All', '7', 'true', true], ['World', '3', 'false', false], ['Raids', '2', 'false', true], ['Resets', '2', 'false', false],   // the gate's omen and the next, the serpent's rising
  ]);
  const raids = chips()[2];
  raids.focus(); press(raids);
  assert.deepEqual(all(root, 'tm-section-name').map((n) => n.textContent), ['Town raids'], 'that group alone');
  assert.deepEqual(chips().map((c) => c.attrs['aria-pressed']), ['false', 'false', 'true', 'false']);
  assert.equal(doc.activeElement, chips()[2], 'the focus stays on the pressed button through the bar\'s rebuild');
  assert.equal(all(root, 'tm-row').length, 2);
  const next = timersWindow(fakeDoc(), { read, onClose() {}, every: 1e9 });
  next.stop();
  assert.deepEqual(all(next.root, 'tm-section-name').map((n) => n.textContent), ['Town raids'], 'the next window opens on the group last shown');
  // the raids end: the group empties, and the list is All again
  now = NOW + 2 * 3600_000;
  view.draw();
  assert.ok(!all(root, 'tm-chip-raids').length, 'no button for a group with no row');
  assert.deepEqual(all(root, 'tm-section-name').map((n) => n.textContent), ['World events', 'Resets'], 'All again - never a window showing nothing');
  assert.equal(all(root, 'tm-chip').find((c) => c.attrs['aria-pressed'] === 'true')?.className.includes('tm-chip-all'), true);
  // no clock: no rows, no bar - the empty list says why
  const lone = timersWindow(fakeDoc(), { read: () => ({ now: NaN }), onClose() {}, every: 1e9, group: 'all' });
  lone.stop();
  assert.equal(all(lone.root, 'tm-chip').length, 0);
  assert.equal(all(lone.root, 'tm-empty').length, 1, 'no clock: said so, as TIMERS1 said it');
  // AUDIT TIMERS2 M4: the fall-back is the choice now - the raids back, the next window (the pause face's redraw) opens on All
  now = NOW;
  const again = timersWindow(fakeDoc(), { read, onClose() {}, every: 1e9 });
  again.stop();
  assert.deepEqual(all(again.root, 'tm-section-name').map((n) => n.textContent), ['World events', 'Town raids', 'Resets'], 'All, as the player last saw it - not the emptied group come back');
});

test('TIMERS2 the sheet: the Elite Breach\'s rows in its arch\'s gold (they drew in no colour), the gate\'s red the colour its Discord card wears, the bar and the badge styled, and Stone\'s light ground lifting the badge past 4.5:1 (mutants: the elite\'s colour dropped; the gate\'s a literal again)', () => {
  assert.ok(ENHANCED_CSS.includes(`.px-timerswin .tm-elite { --tm-kind: ${EG_ARCH_RING_CSS}; }`));
  assert.ok(ENHANCED_CSS.includes(`.px-timerswin .tm-gate { --tm-kind: ${heraldCss('gate')}; }`));
  for (const rule of ['.px-timerswin .tm-groups {', '.px-timerswin .tm-chip {', '.px-timerswin .tm-chip.on {', '.px-timerswin .tm-badge {', '.px-timerswin .tm-section-live {']) assert.ok(ENHANCED_CSS.includes(rule), rule);
  assert.match(ENHANCED_CSS, /@media \(max-width: 560px\) \{[^}]*\}\n  \.px-timerswin \.tm-count \{ font-size: 16px; \}\n[^\n]*\n  \.px-timerswin \.tm-row \{ flex-wrap: wrap; \}\n  \.px-timerswin \.tm-text \{ flex: 1 1 0; \}\n  \.px-timerswin \.tm-door \{ flex: 1 0 100%;/, 'a row\'s door on a line of its own on a phone (seen at 390x844: beside the clock it left the words a word a line)');
  assert.match(ENHANCED_CSS, /:root\[data-plus-theme="stone"\] \.px-timerswin \.tm-badge, :root\[data-plus-theme="stone"\] \.px-timerswin \.tm-section-live \{ color: #c8ffd6; \}/, 'TIMERS1\'s live green on Stone (7.1:1 over its panel, as timers1.test.js measures it)');
});

// ═══ AUDIT TIMERS2 ═══════════════════════════════════════════════════════════════════════════════════════════════

const ROW_DOOR = { board: () => {} };

test('AUDIT TIMERS2 M3: the bar\'s buttons are written in place - the same buttons while the groups are the same, their counts, marks and names moved with the world; a group going rebuilds the bar and the focus that stood on its button goes to All (mutants: the counts left stale; the bar rebuilt every change; the focus dropped)', () => {
  let now = NOW;
  const raids = [...RAIDS, { name: 'Glenpoint', region: 'Daggerfall', type: 'orcs', startMs: NOW + 600_000, endMs: NOW + 1_200_000 }];
  const doc = fakeDoc();
  const view = timersWindow(doc, { read: () => ({ now, raids, region: 'Daggerfall' }), onClose() {}, every: 1e9, group: 'all' });
  view.stop();
  const root = view.root;
  const button = (id) => all(root, `tm-chip-${id}`)[0];
  const r0 = button('raids');
  assert.deepEqual([all(r0, 'tm-chip-n')[0].textContent, r0.attrs['aria-label']], ['3', 'Raids 3, 1 under way'], 'the mark in the name, not the colour alone (L8)');
  now = NOW + 10_000; view.draw();   // Ashfield's raid over: one row fewer, none under way
  assert.equal(button('raids'), r0, 'the same button');
  assert.deepEqual([all(r0, 'tm-chip-n')[0].textContent, r0.attrs['aria-label'], r0.className.split(' ').includes('live')], ['2', 'Raids 2', false]);
  r0.focus();
  now = NOW + 2 * 3600_000; view.draw();   // every raid over: the group goes
  assert.equal(button('raids'), undefined);
  assert.equal(doc.activeElement, button('all'), 'the focus on a button that went is All\'s');
  assert.ok(all(root, 'tm-chip').every((b) => b.attrs['data-focus'] === `timers-${b.className.split(' ').find((c) => c.startsWith('tm-chip-')).slice(8)}`), 'each found again by the pause face\'s redraw (ui/domRepaint.js data-focus)');
});

test('AUDIT TIMERS2 M5, L8: a redraw of the pause face leaves the focus where it put it back - Close takes it only from outside the window; the clock\'s words through the text core; a row under way with a door wears its "Now", a coming one none (mutants: Close taking the focus every draw; "Now" on a coming door row)', () => {
  const raf = globalThis.requestAnimationFrame;
  const frame = [];
  globalThis.requestAnimationFrame = (f) => frame.push(f);   // the browser's order: the draw, then the redraw's focus, then the frame
  const flush = () => { while (frame.length) frame.shift()(); };
  try {
    const doc = fakeDoc();
    doc.activeElement = doc.createElement('button');   // the hourglass, outside the window
    const src = () => ({ now: NOW, raids: RAIDS, region: 'Daggerfall' });
    const first = timersWindow(doc, { read: src, onClose() {}, every: 1e9, group: 'all' });
    first.stop(); flush();
    assert.equal(doc.activeElement, first.close, 'opened from outside: Close');
    const redrawn = timersWindow(doc, { read: src, onClose() {}, every: 1e9, group: 'all' });
    redrawn.stop();
    const chip = all(redrawn.root, 'tm-chip-raids')[0];
    chip.focus();   // ui/domRepaint.js giveFocus - the pause face's redraw puts the focus back on the same button, before the frame
    flush();
    assert.equal(doc.activeElement, chip, 'a focus inside the window is the window\'s own to keep');
  } finally { globalThis.requestAnimationFrame = raf; }
  const view = timersWindow(fakeDoc(), { read: () => ({ now: NOW, raids: RAIDS, region: 'Daggerfall', elite: { op: NOW - 60_000, h: 0 }, doors: ROW_DOOR }), onClose() {}, every: 1e9, group: 'all' });
  view.stop();
  const doorRows = all(view.root, 'tm-elite');
  assert.deepEqual(doorRows.map((r) => [r.className.split(' ').includes('live'), all(r, 'tm-door').length, all(r, 'tm-badge').length]), [[false, 1, 0], [false, 1, 0]], 'the breach\'s call and the season\'s end, both coming: their doors and no "Now"');
  assert.ok(all(view.root, 'tm-when').every((w) => /^(at|ends) /.test(w.textContent)), 'the clock\'s words, English here, through the text core');
});

test('AUDIT TIMERS2 H1, H2, M3, M6, L7, L9: the sheet - the window at one height and its list alone scrolling; a thumb\'s 44px for the bar\'s buttons and the phone\'s door at its own 46px; the live mark drawn under a button, never beside its word, and dark on the pressed one; the count two figures wide in the button\'s own colour; the row\'s mark by its title (mutants: the window sized to its rows; the body scrolling; the 30px buttons; the dot back; the count dimmed)', () => {
  assert.match(ENHANCED_CSS, /\n\.px-win\.px-timerswin \{ height: min\(680px, 86dvh\); max-height: min\(680px, 86dvh\);/, 'H1: one height - a filter\'s press moves nothing');
  assert.match(ENHANCED_CSS, /\.px-win\.px-timerswin \.px-body \{ padding: 20px 24px 22px; display: flex; flex-direction: column; overflow: hidden; \}/);
  assert.match(ENHANCED_CSS, /\.px-timerswin \.tm-list \{ flex: 1 1 auto; min-height: 0; overflow-y: auto;/, 'M6: the list alone scrolls, under a bar that stands');
  assert.match(ENHANCED_CSS, /@media \(max-width: 860px\), \(pointer: coarse\) \{\n  \.px-timerswin \.tm-chip \{ min-height: 44px; \}\n\}/, 'H2: the sheet\'s 44px query');
  assert.doesNotMatch(ENHANCED_CSS, /\.tm-door \{[^}]*min-height: 36px/, 'H2: no rule takes the door under its own 46px');
  assert.doesNotMatch(ENHANCED_CSS, /tm-chip\.live \.tm-chip-name::after/, 'M3: no dot beside a word');
  assert.match(ENHANCED_CSS, /\.px-timerswin \.tm-chip\.live \{ box-shadow: inset 0 -3px 0 #9fe8b4; \}\n\.px-timerswin \.tm-chip\.on\.live \{ box-shadow: inset 0 -3px 0 #0a0c11; \}/, 'L7: the mark dark on brass');
  assert.match(ENHANCED_CSS, /\.px-timerswin \.tm-chip-n \{ font-variant-numeric: tabular-nums; min-width: 2ch; text-align: right; \}/, 'M3, L7: two figures\' room, and no opacity');
  assert.match(ENHANCED_CSS, /\.px-timerswin \.tm-name::before \{ content: '\\25c6'; position: absolute; left: -14px; top: 50%; transform: translateY\(-50%\);/, 'L9: by the title');
  assert.doesNotMatch(ENHANCED_CSS, /\.tm-row::before/);
  assert.match(ENHANCED_CSS, /@media \(max-height: 560px\) \{\n  \.px-win\.px-timerswin \{ height: calc\(100dvh - 20px\); \}\n  \.px-timerswin \.tm-lead \{ display: none; \}\n\}/, 'M6: a phone on its side gives the list the lead\'s line');
});
