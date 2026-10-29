// SHADER-EASE GFX-BAR and FIX-STUTTER (2026-10-29, the owner: Chrome froze for 30-60 s in the world after each update).
// The menu's graphics bar (ui/gfxPrepBar.js): its count over a stub context's started programs, read without linking;
// its phases; no bar without KHR_parallel_shader_compile. The Fix stutter button's rules, its panel's open and close,
// the words within PLAIN-TEXT, and main.js's wiring around both menus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startPrograms, startProgramsInTurn, buildProgram, startedPrograms } from '../../src/render/glProgram.js';
import {
  gfxProgress, gfxStep, gfxStart, chromiumWeb, mountGfxPrep, gfxWords, GFX_HOLD_MS, GFX_READY_MS, GFX_POLL_MS, GFX_GIVE_UP_MS,
  CHROME_WIN, EDGE_WIN, CHROME_MAC,
} from '../../src/ui/gfxPrepBar.js';
import { stringBreach } from '../../tools/plainText.mjs';

const KHR = { COMPLETION_STATUS_KHR: 0x91b1 };
/** A context that counts every compile and link, its programs done when the test says. */
function stubGl({ ext = true } = {}) {
  const calls = { program: 0, shader: 0, link: 0 }, done = new Set();
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, LINK_STATUS: 3, COMPILE_STATUS: 4,
    getExtension: (n) => (ext && n === 'KHR_parallel_shader_compile' ? KHR : null),
    createProgram: () => ({ id: ++calls.program }),
    createShader: () => { calls.shader++; return {}; },
    shaderSource() {}, compileShader() {}, attachShader() {}, deleteShader() {}, deleteProgram() {},
    linkProgram: () => { calls.link++; },
    getProgramParameter: (p, q) => (q === KHR.COMPLETION_STATUS_KHR ? done.has(p) : true),
    getShaderParameter: () => true,
    isContextLost: () => false,
  };
  return { gl, calls, done };
}
const pairs = (n, tag = 'p') => Array.from({ length: n }, (_, i) => [`vs ${tag}${i}`, `fs ${tag}${i}`]);
const progOf = (gl, i, tag = 'p') => new Map(startedPrograms(gl)).get(`vs ${tag}${i}\0fs ${tag}${i}`);

test('GFX-BAR the count: N started and k done is k of N; a program a build took is done; polling never compiles or links', () => {
  const { gl, calls, done } = stubGl();
  startPrograms(gl, pairs(4));
  const poll = gfxProgress(gl, KHR);
  assert.deepEqual(poll(), { done: 0, total: 4 });
  done.add(progOf(gl, 0)); done.add(progOf(gl, 2));
  const before = { ...calls };
  assert.deepEqual(poll(), { done: 2, total: 4 });
  buildProgram(gl, 'vs p1', 'fs p1');   // taken: gone from the started list, never reported done by the driver
  assert.deepEqual(poll(), { done: 3, total: 4 }, 'taken counts done');
  assert.equal(calls.program, before.program, 'no program made by the polls (the build took the started one)');
  assert.equal(calls.link, before.link, 'no link by the polls');
  assert.equal(calls.shader, before.shader);
  done.add(progOf(gl, 3));
  assert.deepEqual(poll(), { done: 4, total: 4 });
});

test('GFX-BAR the count: a queued pair (startProgramsInTurn, no program yet) is pending; a lost context is all done', async () => {
  const { gl } = stubGl();
  let release = () => {};
  const queue = startProgramsInTurn(gl, pairs(3, 'q'), () => new Promise((r) => { release = r; }));
  const poll = gfxProgress(gl, KHR);
  assert.deepEqual(poll(), { done: 0, total: 3 }, 'one started, two queued: none done');
  gl.isContextLost = () => true;
  assert.deepEqual(poll(), { done: 3, total: 3 });
  release();
  await queue;
});

test('GFX-BAR polling never asks startPrograms\' ready(): the spy list is read, and nothing is started', () => {
  const { gl, calls } = stubGl();
  let reads = 0;
  const list = (g) => { reads++; return startedPrograms(g); };
  startPrograms(gl, pairs(2, 's'));
  const made = calls.program;
  const poll = gfxProgress(gl, KHR, list);
  for (let i = 0; i < 5; i++) poll();
  assert.equal(reads, 5);
  assert.equal(calls.program, made, 'ready() would start again a pair a build took; the bar never does');
});

test('GFX-BAR the phases: hidden on a warm cache; filling; ready once full for the hold; gone after the ready time', () => {
  let s = gfxStart();
  s = gfxStep(s, { done: 3, total: 3 }, 0);
  assert.equal(s.phase, 'idle', 'already done when first seen: no bar at all');
  s = gfxStep(s, { done: 0, total: 0 }, 10);
  assert.equal(s.phase, 'idle', 'nothing started yet');
  s = gfxStep(s, { done: 1, total: 4 }, 20);
  assert.equal(s.phase, 'filling');
  s = gfxStep(s, { done: 4, total: 4 }, 100);
  assert.equal(s.phase, 'filling', 'full, the hold not yet run');
  s = gfxStep(s, { done: 4, total: 9 }, 200);
  assert.equal(s.fullAt, null, 'the mount queue landed: the hold starts again');
  s = gfxStep(s, { done: 9, total: 9 }, 300);
  s = gfxStep(s, { done: 9, total: 9 }, 300 + GFX_HOLD_MS - 1);
  assert.equal(s.phase, 'filling');
  s = gfxStep(s, { done: 9, total: 9 }, 300 + GFX_HOLD_MS);
  assert.equal(s.phase, 'ready');
  s = gfxStep(s, { done: 9, total: 9 }, 300 + GFX_HOLD_MS + GFX_READY_MS);
  assert.equal(s.phase, 'gone');
});

test('GFX-BAR the phases: never ready before the mount set is queued; a driver that never says done lets the bar go (mutants: settled ignored; no give-up)', () => {
  let s = gfxStep(gfxStart(), { done: 1, total: 2 }, 0, false);
  s = gfxStep(s, { done: 2, total: 2 }, 10, false);
  s = gfxStep(s, { done: 2, total: 2 }, 10 + GFX_HOLD_MS * 4, false);
  assert.equal(s.phase, 'filling', 'full, but the mount set is still to come');
  s = gfxStep(s, { done: 2, total: 2 }, 20 + GFX_HOLD_MS * 4, true);
  assert.equal(s.phase, 'ready', 'queued, and full past the hold');
  let stuck = gfxStep(gfxStart(), { done: 0, total: 5 }, 0);
  stuck = gfxStep(stuck, { done: 1, total: 5 }, GFX_GIVE_UP_MS - 1);
  assert.equal(stuck.phase, 'filling');
  stuck = gfxStep(stuck, { done: 1, total: 5 }, GFX_GIVE_UP_MS);
  assert.equal(stuck.phase, 'gone', 'the bar goes; the game never waited on it');
});

test('FIX-STUTTER the button: a Chromium tab shows it; the desktop app, Firefox, Safari and a phone do not', () => {
  const chrome = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' };
  assert.equal(chromiumWeb(chrome, undefined), true);
  assert.equal(chromiumWeb({ userAgentData: { brands: [{ brand: 'Microsoft Edge' }, { brand: 'Chromium' }], mobile: false, platform: 'Windows' }, userAgent: '' }, undefined), true);
  assert.equal(chromiumWeb(chrome, { platform: 'win32' }), false, 'the desktop app clears its own cache (CACHE-TURN)');
  assert.equal(chromiumWeb({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; rv:131.0) Gecko/20100101 Firefox/131.0' }, undefined), false);
  assert.equal(chromiumWeb({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15' }, undefined), false);
  assert.equal(chromiumWeb({ userAgentData: { brands: [{ brand: 'Google Chrome' }], mobile: true }, userAgent: '' }, undefined), false);
  assert.equal(chromiumWeb({ userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36' }, undefined), false);
  assert.equal(chromiumWeb({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' }, undefined), false, 'Linux: neither the Windows nor the Mac steps');
  assert.equal(chromiumWeb({ userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' }, undefined), false, 'ChromeOS');
  assert.equal(chromiumWeb({ userAgentData: { brands: [{ brand: 'Brave' }, { brand: 'Chromium' }], mobile: false, platform: 'Windows' }, userAgent: chrome.userAgent }, undefined), false, 'Brave keeps its folders elsewhere');
  assert.equal(chromiumWeb({ userAgent: `${chrome.userAgent} OPR/114.0.0.0` }, undefined), false, 'Opera');
  assert.equal(chromiumWeb({ userAgentData: { brands: [{ brand: 'Google Chrome' }], mobile: false, platform: 'macOS' }, userAgent: '' }, undefined), true, 'the Mac by its platform');
});

// a small DOM: what the bar and the panel touch, and no more
function fakeDom() {
  const byId = new Map();
  const node = (tag) => {
    const n = {
      tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', hidden: false, type: '',
      style: {}, attrs: {}, listeners: new Map(), focused: false,
      classList: { set: new Set(), toggle(c, on) { if (on) this.set.add(c); else this.set.delete(c); }, contains(c) { return this.set.has(c); } },
      get lastElementChild() { return n.children[n.children.length - 1] ?? null; },
      append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); if (c.id) byId.set(c.id, c); } },
      setAttribute(k, v) { n.attrs[k] = v; },
      addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
      click() { for (const fn of n.listeners.get('click') ?? []) fn({ type: 'click', target: n }); },
      focus() { doc.activeElement = n; },
      remove() { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; },
      all() { return [n, ...n.children.flatMap((c) => c.all())]; },
      querySelector(sel) { return n.all().find((c) => c !== n && c.className.split(' ').includes(sel.slice(1))) ?? null; },
      text() { return n.all().map((c) => c.textContent).join(' '); },
    };
    return n;
  };
  const doc = { activeElement: null, head: node('head'), body: node('body'), createElement: node, getElementById: (id) => byId.get(id) ?? null };
  const keys = [], timers = [];
  const win = {
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36', clipboard: { copied: [], writeText(p) { this.copied.push(p); return Promise.resolve(); } } },
    addEventListener: (type, fn, capture) => keys.push({ type, fn, capture }),
    removeEventListener: (type, fn) => { const i = keys.findIndex((k) => k.type === type && k.fn === fn); if (i >= 0) keys.splice(i, 1); },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].fn = null; },
  };
  const press = (key, type = 'keydown') => {
    const e = { type, key, stopped: false, prevented: false, stopImmediatePropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
    for (const k of keys.filter((x) => x.type === type)) k.fn(e);
    return e;
  };
  return { doc, win, keys, timers, press };
}

test('GFX-BAR mounted: the bar fills with the count, says ready, then fades; the poll stops once gone and on unmount', () => {
  const { gl, done } = stubGl();
  startPrograms(gl, pairs(2, 'm'));
  const { doc, win, timers } = fakeDom();
  let clock = 0;
  const g = mountGfxPrep({ gl, doc, win, shell: undefined, now: () => clock, settled: () => true });
  assert.equal(g.bar.hidden, false);
  assert.equal(g.bar.children[0].textContent, gfxWords().preparing);
  assert.equal(g.bar.children[1].children[0].style.width, '0%');
  assert.equal(timers.at(-1).ms, GFX_POLL_MS);
  done.add(progOf(gl, 0, 'm'));
  clock = 10; g.tick();
  assert.equal(g.bar.children[1].children[0].style.width, '50%');
  done.add(progOf(gl, 1, 'm'));
  clock = 20; g.tick();
  clock = 20 + GFX_HOLD_MS; g.tick();
  assert.equal(g.bar.children[0].textContent, gfxWords().ready);
  assert.equal(g.bar.classList.contains('gone'), false);
  const n = timers.length;
  clock += GFX_READY_MS; g.tick();
  assert.equal(g.bar.classList.contains('gone'), true, 'faded');
  assert.equal(timers.length, n, 'no poll after gone');
  g.unmount();
  assert.equal(g.root.parent, null);
});

test('GFX-BAR no KHR_parallel_shader_compile (Firefox, Safari): no bar; the button alone in a Chromium tab, nothing at all elsewhere', () => {
  const { gl } = stubGl({ ext: false });
  const { doc, win, timers } = fakeDom();
  const g = mountGfxPrep({ gl, doc, win, shell: undefined });
  assert.equal(g.bar.hidden, true);
  assert.ok(g.button, 'Chromium in a tab: the button stands');
  assert.equal(timers.length, 0, 'nothing polled');
  g.unmount();
  const firefox = fakeDom();
  firefox.win.navigator.userAgent = 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0';
  assert.equal(mountGfxPrep({ gl, doc: firefox.doc, win: firefox.win, shell: undefined }).root, null);
  const app = fakeDom();
  const inApp = mountGfxPrep({ gl: stubGl().gl, doc: app.doc, win: app.win, shell: { platform: 'win32' } });
  assert.equal(inApp.button, null, 'the desktop app: no button');
  assert.ok(inApp.bar, 'its bar still stands');
  inApp.unmount();
});

test('FIX-STUTTER the panel: the button opens it with the paths and a Copy each; Escape and Close shut it; its keys are the panel\'s', () => {
  const { gl } = stubGl();
  const { doc, win, press, keys } = fakeDom();
  const g = mountGfxPrep({ gl, doc, win, shell: undefined });
  assert.equal(press('Escape').stopped, false, 'no panel: the menu\'s keys are its own');
  g.button.click();
  const shade = g.panel();
  assert.ok(shade && shade.parent === doc.body);
  const words = shade.text();
  for (const p of [CHROME_WIN, EDGE_WIN, CHROME_MAC]) assert.ok(words.includes(p), p);
  assert.ok(words.includes('GrShaderCache') && words.includes('Default\\GPUCache') && words.includes('Default/GPUCache'));
  const copy = shade.all().find((n) => n.tagName === 'BUTTON' && n.textContent === gfxWords().copy);
  copy.click();
  assert.deepEqual(win.navigator.clipboard.copied, [CHROME_WIN]);
  assert.equal(doc.activeElement?.className, 'dfgfx-close', 'Close takes the focus');
  assert.equal(press('ArrowDown').stopped, true, 'the menu under it hears nothing');
  assert.equal(press('ArrowDown', 'keyup').stopped, true);
  const esc = press('Escape');
  assert.ok(esc.stopped && esc.prevented);
  assert.equal(g.panel(), null);
  assert.equal(doc.activeElement, g.button, 'the focus back on the button');
  g.button.click();
  g.panel().querySelector('.dfgfx-close').click();
  assert.equal(g.panel(), null);
  assert.ok(keys.every((k) => k.capture === true), 'laid in capture, ahead of the menu\'s own');
  g.unmount();
  assert.equal(keys.length, 0);
});

test('FIX-STUTTER the panel: a menu laid after the bar, in capture on the same window, hears no key while the panel is up (mutants: the panel\'s keys not stopped)', () => {
  const { gl } = stubGl();
  const dom = fakeDom();
  const g = mountGfxPrep({ gl, doc: dom.doc, win: dom.win, shell: undefined });
  const heard = [];
  // a window's capture listeners run in the order laid, and the first's stopImmediatePropagation ends the walk
  const press = (key) => {
    const e = { type: 'keydown', key, stopped: false, stopImmediatePropagation() { this.stopped = true; }, preventDefault() {} };
    for (const k of [...dom.keys]) { if (e.stopped) break; if (k.type === 'keydown') k.fn(e); }
    return e;
  };
  dom.win.addEventListener('keydown', (e) => heard.push(e.key), true);   // the menu's, as ui/windowStack.js lays it
  press('Enter');
  assert.deepEqual(heard, ['Enter'], 'no panel: the menu hears its keys');
  g.button.click();
  press('Enter'); press('ArrowDown');
  assert.deepEqual(heard, ['Enter'], 'the panel up: the menu hears nothing');
  press('Escape');
  assert.equal(g.panel(), null);
  press('Enter');
  assert.deepEqual(heard, ['Enter', 'Enter']);
  g.unmount();
});

test('GFX-BAR and FIX-STUTTER words: every one within PLAIN-TEXT', () => {
  for (const [k, v] of Object.entries(gfxWords())) assert.equal(stringBreach(v), null, k);
});

test('GFX-BAR wiring: main.js raises the bar with each boot menu and drops it once the menu is left', () => {
  const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /const gfxBar = import\('\.\/ui\/gfxPrepBar\.js'\);/, 'loaded at boot, so the bar is up before the menu');
  assert.match(main, /const gfxPrep = \(on\) => gfxBar\.then\(\(m\) => \(on \? m\.gfxPrepUp\(renderer\.gl\) : m\.gfxPrepDown\(\)\)\)\.catch\(\(\) => \{\}\);/);
  assert.match(main, /runCinematicFrontDoor\(async \(\) => \{\s*status\('main menu'\);\s*await gfxPrep\(true\);[^\n]*\n\s*return runEnhancedMenu\(\);/, 'the bar\'s key listener laid before the menu\'s');
  assert.match(main, /\}\)\.finally\(detachMenuPad\);[^\n]*\n\s*gfxPrep\(false\);/);
  assert.match(main, /await gfxPrep\(true\);\s*const action = await runMenu\(canvas, renderer, status\);\s*gfxPrep\(false\);/);
});
