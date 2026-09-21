// MENU1 - THE ENHANCED MENUS THAT SOMETIMES DO NOT OPEN (2026-09-15,
// Mac relaying a player: "sometimes you're unable to open the enhanced
// menus. For example a player might open the radial and select the
// spellbook, but it will fail to open").
//
// THE ROOT CAUSE IS THE DEPLOY. Every enhanced menu builds to its own
// content-hashed lazy chunk (`dist/assets/enhancedSpellbook-*.js` and
// five siblings), fetched by a dynamic `import()` the first time a
// player opens that door, and the deploy DELETES the files it
// replaces - measured against the live site, the previous build's
// `assets/main-EDqp0hIk.js` answered 404 within the hour, while a
// chunk whose content did not change kept its hash and survived. So a
// tab open across a deploy asks for old chunk URLs, and the ones that
// 404 are exactly the menus that deploy touched. The dial is in the
// main bundle, so the rose still opens; the door behind it does not.
// That is the whole "random".
//
// WHAT MADE IT UNREPORTABLE was the doors' answer. Six of seven caught
// the rejection, wrote `console.warn` and called `close()`;
// `charSheetDoor.js` had no catch at all. The player got nothing - no
// box, no line - from a failure they did not cause, in a game where
// every other refusal speaks ("(the spellbook art is unavailable)").
// A door that declines in silence is indistinguishable from a press
// that was not received, which is exactly how it was reported.
//
// `ui/enhancedChunk.js` is the one home: retry once, then SPEAK in the
// door's own host element, and STAY OPEN behind the notice so the game
// does not hand the keys back to a player who thinks they missed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mountEnhancedChunk, paintChunkNotice, isChunkLoadError, RELOAD_TEXT, BROKEN_TEXT,
} from '../src/ui/enhancedChunk.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(join(root, rel), 'utf8');

/** The smallest element the notice needs: append, a document that can make more. */
function fakeHost() {
  const mk = (tag) => {
    const n = {
      tag, style: { cssText: '' }, children: [], textContent: null, type: null,
      listeners: new Map(),
      append: (...kids) => n.children.push(...kids),
      addEventListener: (t, f) => n.listeners.set(t, f),
      get text() { return [n.textContent, ...n.children.map((c) => c.text)].filter(Boolean).join(' '); },
      get all() { return [n, ...n.children.flatMap((c) => c.all)]; },
    };
    return n;
  };
  const host = mk('div');
  host.ownerDocument = { createElement: mk };
  return host;
}

const failing = (msg) => () => Promise.reject(new Error(msg));
const CHUNK_404 = 'Failed to fetch dynamically imported module: https://x/assets/enhancedSpellbook-B4Vx.js';

// ═══ the retry ═══════════════════════════════════════════════════
test('MENU1: a transient failure is retried once, and the second try mounts', async () => {
  let tries = 0;
  const mounted = [];
  const ok = await mountEnhancedChunk({
    load: () => { tries++; return tries === 1 ? Promise.reject(new Error(CHUNK_404)) : Promise.resolve({ m: 1 }); },
    mount: (mod) => mounted.push(mod),
    host: fakeHost(), onDismiss: () => {}, wait: async () => {},
  });
  assert.equal(ok, true);
  assert.equal(tries, 2, 'one retry - a blip costs one round trip to rule out');
  assert.deepEqual(mounted, [{ m: 1 }], 'and the door mounts for real');
});

test('MENU1: a chunk that is really gone is tried exactly twice, never forever', async () => {
  let tries = 0;
  const warn = console.warn; console.warn = () => {};
  try {
    const ok = await mountEnhancedChunk({
      load: () => { tries++; return Promise.reject(new Error(CHUNK_404)); },
      mount: () => assert.fail('must not mount'),
      host: fakeHost(), onDismiss: () => {}, wait: async () => {},
    });
    assert.equal(ok, false);
  } finally { console.warn = warn; }
  assert.equal(tries, 2, 'the attempt and its one retry');
});

// ═══ the silence, which was the bug ══════════════════════════════
test('MENU1: a failed mount SPEAKS, and does not close the door behind the player\'s back', async () => {
  const host = fakeHost();
  let dismissed = 0;
  const warn = console.warn; console.warn = () => {};
  try {
    await mountEnhancedChunk({
      load: failing(CHUNK_404), mount: () => {}, host,
      onDismiss: () => { dismissed++; }, wait: async () => {},
    });
  } finally { console.warn = warn; }
  assert.equal(host.children.length, 1, 'the notice is in the door\'s own host element');
  assert.match(host.text, /updated while this tab was open/, 'and says the thing a player can act on');
  assert.equal(dismissed, 0,
    'the door STAYS: closing it silently is what made this indistinguishable from a press that never landed');
  // ...and the player can put it away, which runs the door's own close.
  const dismiss = host.all.find((n) => n.textContent === 'Close');
  assert.ok(dismiss, 'there is a way out');
  dismiss.listeners.get('click')();
  assert.equal(dismissed, 1, 'and it is the door\'s own close');
});

test('MENU1: the RELOAD button is offered for a stale chunk and withheld for a broken one', async () => {
  const warn = console.warn; console.warn = () => {};
  try {
    const stale = fakeHost();
    await mountEnhancedChunk({ load: failing(CHUNK_404), mount: () => {}, host: stale, onDismiss: () => {}, wait: async () => {} });
    assert.ok(stale.all.some((n) => n.textContent === 'Reload'), 'a deploy took the chunk - a reload is the fix');
    assert.match(stale.text, new RegExp(RELOAD_TEXT.slice(0, 40)));

    // A module that LOADED and threw while evaluating is a bug: a
    // reload reproduces it, so offering one would be a lie.
    const broken = fakeHost();
    await mountEnhancedChunk({ load: failing('x is not a function'), mount: () => {}, host: broken, onDismiss: () => {}, wait: async () => {} });
    assert.equal(broken.all.some((n) => n.textContent === 'Reload'), false, 'a reload does not fix a throw');
    assert.match(broken.text, new RegExp(BROKEN_TEXT.slice(0, 30)));
  } finally { console.warn = warn; }
});

test('MENU1: the reload is OFFERED, never taken - unsaved progress is the player\'s to spend', async () => {
  const host = fakeHost();
  let reloads = 0;
  const warn = console.warn; console.warn = () => {};
  try {
    await mountEnhancedChunk({
      load: failing(CHUNK_404), mount: () => {}, host, onDismiss: () => {}, wait: async () => {},
      notice: (h, o) => paintChunkNotice(h, { ...o, reload: () => reloads++ }),
    });
  } finally { console.warn = warn; }
  assert.equal(reloads, 0, 'nothing reloads on its own');
  host.all.find((n) => n.textContent === 'Reload').listeners.get('click')();
  assert.equal(reloads, 1, 'only the player\'s press does');
});

test('MENU1: a door torn down while the chunk was in flight mounts nothing and says nothing', async () => {
  const host = fakeHost();
  let alive = true;
  const ok = await mountEnhancedChunk({
    load: () => { alive = false; return Promise.resolve({}); },   // the player closed it mid-flight
    mount: () => assert.fail('a dead door must not mount'),
    alive: () => alive, host, onDismiss: () => {}, wait: async () => {},
  });
  assert.equal(ok, false);
  assert.equal(host.children.length, 0, 'and no notice over a screen that is gone');
});

// ═══ the classification ══════════════════════════════════════════
test('MENU1: the three engines\' wordings for a chunk that would not fetch all read as one', () => {
  for (const m of [
    'Failed to fetch dynamically imported module: https://x/assets/a.js',   // Chromium
    'error loading dynamically imported module: https://x/assets/a.js',      // Firefox
    'Importing a module script failed.',                                     // WebKit
  ]) assert.equal(isChunkLoadError(new Error(m)), true, m);
  for (const m of ['x is not a function', 'Cannot read properties of undefined']) {
    assert.equal(isChunkLoadError(new Error(m)), false, m);
  }
});

// ═══ the law: every door goes through the one home ═══════════════
test('MENU1: no ui/*Door.js mounts a lazy chunk on its own', () => {
  const doors = readdirSync(join(root, 'src/ui')).filter((f) => f.endsWith('Door.js'));
  assert.ok(doors.length >= 7, `the doors are still here: ${doors.length}`);
  const lazy = [];
  const rogue = [];
  for (const f of doors) {
    const text = src(`src/ui/${f}`);
    if (!/import\(['"]\.[^'"]+['"]\)/.test(text)) continue;
    lazy.push(f);
    // A dynamic import is allowed ONLY inside the one home's `load`
    // thunk (or with its own optional catch, which is a feature that
    // is off rather than a screen that failed).
    for (const m of text.matchAll(/^(.*import\(['"]\.[^'"]+['"]\).*)$/gm)) {
      const line = m[1];
      if (/load: \(\) =>/.test(line) || /\.catch\(\(\) => null\)/.test(line)) continue;
      rogue.push(`${f}: ${line.trim()}`);
    }
    // THE ONE HOME, however many of its exports a door takes. This read
    // the import line VERBATIM and so failed the first door to need a
    // second export from the same module - ui/charSheetDoor.js takes
    // `paintChunkNotice` as well, to clear its own wait before the
    // notice is drawn over it (LV1b). What the gate is about is the
    // HOME, not the spelling of the list.
    assert.match(text, /import \{[^}]*\bmountEnhancedChunk\b[^}]*\} from '\.\/enhancedChunk\.js'/, `${f} imports the one home`);
  }
  assert.ok(lazy.length >= 7, `every enhanced door is a lazy chunk: ${lazy.join(', ')}`);
  assert.deepEqual(rogue, [],
    'these lines fetch a lazy chunk outside ui/enhancedChunk.js, so a deploy that moves the chunk\n'
    + 'fails them silently again - which is the whole of MENU1:\n' + rogue.join('\n'));
});

test('MENU1: and no door is left catching a mount failure by hand', () => {
  const bad = readdirSync(join(root, 'src/ui')).filter((f) => f.endsWith('Door.js'))
    .filter((f) => /could not mount|would not mount/.test(src(`src/ui/${f}`)));
  assert.deepEqual(bad, [], 'the console.warn-and-close pattern is the defect, not the handling');
});

// ═══ MENU1-WARM: THE BYTES ARE ASKED FOR EARLY, NOT ON THE KEYPRESS ══
//
// Mac, 2026-09-19: "look for any elements of hitching, or hiccups."
//
// MENU1 is about a chunk that FAILS. This is its other half: one that
// merely arrives LATE. Every door's `import()` is the first time its
// file is asked for, and it is asked for on the frame the player pressed
// the key - 28 KB for the inventory, 78 KB for the menu, fetched, parsed
// and compiled while the game holds still. Warmed idly instead, the
// module map already has it and the door's await costs nothing.
test('MENU1-WARM: every chunk is warmed, one at a time, each behind its own idle wait', async () => {
  const { warmEnhancedChunks, _resetChunkWarmForTests, WARM_CHUNKS } = await import('../src/ui/enhancedChunk.js');
  _resetChunkWarmForTests();
  const order = [];
  let inFlight = 0, maxInFlight = 0;
  const chunks = ['a', 'b', 'c'].map((n) => () => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    order.push(`load:${n}`);
    return Promise.resolve().then(() => { inFlight--; return {}; });
  });
  const idle = (fn) => { order.push('idle'); fn(); };
  const done = await warmEnhancedChunks({ chunks, idle });
  assert.equal(done, 3, 'every chunk warmed');
  assert.equal(maxInFlight, 1, 'seven parallel fetches would be the stall this removes');
  assert.deepEqual(order, ['idle', 'load:a', 'idle', 'load:b', 'idle', 'load:c'],
    'each chunk waits for its own idle answer - it must never race the world stream');
  // the real list is the doors' own
  assert.ok(WARM_CHUNKS.length >= 6, 'the six shared chunks behind the seven doors');
});

test('MENU1-WARM: a warm that fails is silent, does not stop the rest, and never speaks over MENU1’s notice', async () => {
  const { warmEnhancedChunks, _resetChunkWarmForTests } = await import('../src/ui/enhancedChunk.js');
  _resetChunkWarmForTests();
  const seen = [];
  const chunks = [
    () => { seen.push('a'); return Promise.reject(new Error('404')); },
    () => { seen.push('b'); return Promise.resolve({}); },
  ];
  const done = await warmEnhancedChunks({ chunks, idle: (fn) => fn() });
  assert.deepEqual(seen, ['a', 'b'], 'a failed warm does not stop the next');
  assert.equal(done, 1, 'and is not counted');
  // The door is what speaks. A warm that logged would put a line on the
  // console for a fetch the player never asked for, and MENU1's whole
  // point is that the PLAYER is told, in the overlay, by the door.
  const chunkSrc = src('src/ui/enhancedChunk.js');
  const fn = chunkSrc.split('export async function warmEnhancedChunks(')[1].split('\n}')[0];
  assert.doesNotMatch(fn, /console\./, 'a warm must leave no trace when it fails');
});

test('MENU1-WARM: it runs ONCE a session, and stands down when the session is gone', async () => {
  const { warmEnhancedChunks, _resetChunkWarmForTests } = await import('../src/ui/enhancedChunk.js');
  _resetChunkWarmForTests();
  let loads = 0;
  const chunks = [() => { loads++; return Promise.resolve({}); }];
  await warmEnhancedChunks({ chunks, idle: (fn) => fn() });
  await warmEnhancedChunks({ chunks, idle: (fn) => fn() });
  assert.equal(loads, 1, 'the latch is a session’s');
  _resetChunkWarmForTests();
  const after = await warmEnhancedChunks({ chunks, idle: (fn) => fn(), alive: () => false });
  assert.equal(after, 0, 'a dead session warms nothing');
});

test('MENU1-WARM: the world host asks for it, and never awaits it', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /void import\('\.\.\/ui\/enhancedChunk\.js'\)\.then\(\(m\) => m\.warmEnhancedChunks\(\)\)\.catch\(\(\) => \{\}\);/,
    'the boot fires the warm and forgets it - an awaited warm would be the stall itself');
  const boot = w.split('export async function bootWorld(')[1].slice(0, 1200);
  assert.ok(boot.includes('warmEnhancedChunks'), 'and it is asked for at the boot, not on a door');
});
