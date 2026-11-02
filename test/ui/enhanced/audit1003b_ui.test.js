// AUDIT PRE-MERGE 1003b (2026-10-03, the owner: "We're going to do one last deep audit on everything before we push this.
// It needs to be perfection"): THE PRIVATE SESSION'S CARD IN THE ARENA WINDOW (ARENA6; src/ui/arena/arenaWindow.js over
// src/systems/arena/arenaBoard.js sessionCard, src/ui/enhanced/enhancedPlusStyle.js) - lens U's findings, each red first, on chargenDom's
// page as test/systems/arena/audit1003_ui.test.js mounts the window. The layout's measure is Chromium's (the lens's probe); the rules
// that make it are pinned here. The record: bible/01-Overview/audits/Audit-PreMerge-1003.md, its second pass.
import '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as AB from '../../../src/systems/arena/arenaBoard.js';
import { ARENA_TEXT } from '../../../src/systems/arena/arenaText.js';
import { mountArenaWindow } from '../../../src/ui/arena/arenaWindow.js';
import { ARENA_WINDOW_CSS } from '../../../src/ui/enhanced/enhancedPlusStyle.js';

const O = ARENA_TEXT.online;
const CODE = 'K7PX2M';
// chargenDom's page, dressed as test/systems/arena/audit1003_ui.test.js dresses it: a dataset, a class list, an attribute taken off,
// and Chromium's focus fixup - a focused control made `disabled` lets the focus fall to the page
const plainMake = document.createElement;
document.createElement = (t) => {
  const n = plainMake(t);
  // a dataset is its data-* attributes, as a browser keeps them (domRepaint.js finds a focus by `data-focus`)
  n.dataset = new Proxy({}, { set(o, k, v) { o[k] = v; n.attrs[`data-${String(k).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`] = String(v); return true; } });
  const cls = () => n.className.split(/\s+/).filter(Boolean);
  const list = {
    add: (...c) => { n.className = [...new Set([...cls(), ...c])].join(' '); },
    remove: (...c) => { n.className = cls().filter((x) => !c.includes(x)).join(' '); },
    toggle: (c, on = !cls().includes(c)) => { if (on) list.add(c); else list.remove(c); return on; },
    contains: (c) => cls().includes(c),
  };
  Object.defineProperty(n, 'classList', { get: () => list });
  n.removeAttribute = (k) => { delete n.attrs[k]; };
  const set = n.setAttribute.bind(n);
  n.setAttribute = (k, v) => { set(k, v); if (k === 'disabled' && document.activeElement === n) document.activeElement = document.body; };
  return n;
};
const all = (n) => (n?.children ?? []).flatMap((c) => (c?.tagName ? [c, ...all(c)] : []));
const has = (n, c) => String(n?.className ?? '').split(/\s+/).includes(c);
const kids = (n, c) => all(n).filter((x) => has(x, c));
const attr = (n, k) => n?.attrs?.[k];
const textOf = (n) => (n?.children?.length ? `${n._text ?? ''}${n.children.map(textOf).join('')}` : String(n?.textContent ?? ''));

/** The host's session: Hela hosts, Alva and Brann registered, here. */
const pss = (more = {}) => ({ k: 'pss', c: CODE, hn: 'Hela', hm: 'm1', h: 1, me: 'm1', m: [['m1', 'Hela', 0, 1, '', ''], ['m2', 'Alva', 0, 1, '', ''], ['m3', 'Brann', 0, 1, '', '']], r: '', b: '', o: '', ph: '', f: [], hist: [], lo: 0, ...more });
function mounted(state, act = () => ({ ok: true, text: '' })) {
  const host = document.createElement('div');
  document.body.append(host);
  const board = () => AB.arenaBoard({ ladder: null, league: null, gameMinutes: 0, name: 'Hela', online: { hall: { status: 'open', queue: 'idle', live: [] }, session: state.session }, replays: [] });
  const v = mountArenaWindow(host, { board, act, page: 'bouts', onExit: () => {} });
  return { host, v, done: () => { v.unmount(); host.remove(); } };
}
const byFocus = (host, key) => all(host).find((x) => x.dataset?.focus === key) ?? null;

test('AUDIT PRE-MERGE 1003b U4: the keyboard keeps its row - Enter on "Make Red - Brann", and the redraw that makes Brann the Red keeps the focus on Brann\'s own press (shut, saying why), never the next member\'s; Start bout pressed keeps its focus (mutants: the picked member\'s press dropped; no key; Start shut by `disabled`)', () => {
  const state = { session: { in: true, code: CODE, host: true, state: pss() } };
  const W = mounted(state);
  try {
    const red = byFocus(W.host, 'aw-priv-m3-r');
    assert.ok(red, 'Brann\'s Make Red keyed');
    red.focus();
    state.session = { ...state.session, state: pss({ r: 'm3' }) };   // the relay's answer: Brann is the Red
    W.v.refresh();
    const now = document.activeElement;
    assert.equal(now?.dataset?.focus, 'aw-priv-m3-r', 'the focus on Brann\'s own press');
    assert.equal(attr(now, 'aria-disabled'), 'true', 'shut by aria-disabled');
    assert.ok(String(attr(now, 'aria-label')).includes(O.privIsRed), 'and saying why');
    // both picked: Start bout, pressed, shuts - the focus stays on it
    state.session = { ...state.session, state: pss({ r: 'm3', b: 'm2' }) };
    W.v.refresh();
    const go = byFocus(W.host, 'aw-priv-go');
    go.focus();
    state.session = { ...state.session, state: pss({ r: 'm3', b: 'm2', o: 'abcdef0123456789', ph: 'call', f: ['m3', 'm2'] }) };
    W.v.refresh();
    assert.notEqual(document.activeElement, document.body, 'Start bout keeps the focus');
    assert.equal(document.activeElement?.dataset?.focus, 'aw-priv-go');
  } finally { W.done(); }
});

test('AUDIT PRE-MERGE 1003b U10: the code is spelled to a screen reader in a span it reads, the large letters hidden from it - never a name on a paragraph (mutant: the aria-label on the <p>)', () => {
  const W = mounted({ session: { in: true, code: CODE, host: true, state: pss() } });
  try {
    const p = kids(W.host, 'aw-privcode')[0];
    assert.equal(attr(p, 'aria-label'), undefined, 'no name on the paragraph');
    const sr = kids(p, 'aw-sr')[0];
    assert.equal(textOf(sr), `${O.privCodeLabel}: K 7 P X 2 M`);
    assert.ok(all(p).some((x) => attr(x, 'aria-hidden') === 'true' && textOf(x) === CODE), 'the large letters hidden from the reader');
  } finally { W.done(); }
});

test('AUDIT PRE-MERGE 1003b U11: the code box has a label a player sees, asks a phone for capitals and a Go key, takes a pasted " K7P - X2A ", and leaves Enter to an IME\'s composition (mutants: the placeholder the only label; no autocapitalize; a nine-character box; Enter mid-composition joining)', () => {
  const acts = [];
  const W = mounted({ session: { in: false } }, (kind, data) => { acts.push([kind, data]); return { ok: true, text: '' }; });
  try {
    const input = all(W.host).find((x) => x.tagName === 'INPUT' && has(x, 'aw-privinput'));
    const label = all(W.host).find((x) => x.tagName === 'LABEL' && has(x, 'aw-privlabel'));
    assert.ok(label && textOf(label) === O.privCodeLabel && label.htmlFor === input.id, 'a visible label for the box');
    assert.equal(attr(input, 'autocapitalize'), 'characters');
    assert.equal(attr(input, 'enterkeyhint'), 'go');
    assert.equal(attr(input, 'autocorrect'), 'off');
    assert.ok(input.maxLength >= 11, `room for a pasted code with spaces and a dash (${input.maxLength})`);
    const key = (e) => input.dispatchEvent?.(Object.assign(new Event('keydown'), e)) ?? (input.listeners?.keydown ?? []).forEach((f) => f({ preventDefault() {}, ...e }));
    key({ key: 'Enter', isComposing: true });
    assert.deepEqual(acts, [], 'Enter inside a composition is the composition\'s');
  } finally { W.done(); }
});

test('AUDIT PRE-MERGE 1003b U1: the session\'s card spans the Bouts page and a member\'s name keeps its twelve characters beside the presses - in one 300 px cell the names were 0 px wide (48 of 62 at 1280) (mutants: the card in one cell; the name\'s floor gone)', () => {
  assert.match(ARENA_WINDOW_CSS, /\.aw-bout-card\.k-session \{ grid-column: 1 \/ -1; \}/);
  assert.match(ARENA_WINDOW_CSS, /\.aw-privm \{ display: grid; grid-template-columns: minmax\(12ch, 1fr\) auto;/);
  assert.match(ARENA_WINDOW_CSS, /\.aw-act\[aria-disabled="true"\] \{ opacity: 0\.4; cursor: not-allowed; \}/, 'a shut press looks shut');
});

test('AUDIT PRE-MERGE 1003b M2: under retro mode\'s pillarbox the quest card steps aside for the versus bar by the PICTURE\'s width - #551 inset the card into the picture, and U4\'s 1100 px read the window\'s: at 1366x768 in 4:3 the card overlapped the bar 36x54 px (mutants: the narrow mark never written; the rule gone)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../../../src/ui/enhanced/enhancedHud.js', import.meta.url), 'utf8');
  assert.match(src, /const narrow = !!ui && ui\.w <= ARENA_CARD_ROOM_PX;/, 'the picture\'s width read');
  assert.match(src, /if \(narrow\) doc\.documentElement\?\.setAttribute\?\.\('data-ui-narrow', ''\); else doc\.documentElement\?\.removeAttribute\?\.\('data-ui-narrow'\);/, 'and worn on the root');
  const css = (await import('node:fs')).readFileSync(new URL('../../../src/ui/enhanced/enhancedStyle.js', import.meta.url), 'utf8');
  assert.match(css, /:root\[data-ui-narrow\] body:has\(\.arena-hud\.on\) \.qtrack \{ visibility: hidden; \}/, 'the card steps aside in a narrow picture');
});
