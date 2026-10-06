// PERF-URL (2026-09-29, Mac: "I'm receiving reports after some updates, performance seems to be worse") - THE PAGE'S
// QUERY IS PARSED ONCE A SEARCH, AND NO DOOR PARSES ON ITS OWN.
//
// Counted in the real game (Knightstale in the rain, the world host settled): 84 URLSearchParams minted a frame - 54
// by the online lane's `isOnlinePage` (every getPref and every modSetting asks it), 24 by the skin's `skinOverride`,
// the rest by the kill doors read in the frame. systems/pageQuery.js is the one home now; these pins hold it by COUNT
// (the doctrine's own - never a wall clock) and sweep src/ so the next door cannot mint its own again, which is how
// PERF-SUN's single-file fix of the same waste (windDrive.js swayDisabled, 2026-09-19) was undone door by door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { codeOnly } from './codeOnly.mjs';
import { pageParam, pageHas } from '../src/systems/pageQuery.js';
import { isOnlinePage, onlineForcedPref } from '../src/systems/onlineLane.js';
import { skinOverride, uiSkin, isEnhanced } from '../src/systems/uiSkin.js';
import { airOn, contactOn } from '../src/render/airPass.js';
import { shadowCacheOn } from '../src/render/shadowPass.js';
import { exposureFor, EL_EXPOSURE } from '../src/render/enhancedLighting.js';
import { motionEnabled } from '../src/ui/windowMotion.js';
import { swayDisabled } from '../src/systems/windDrive.js';
import { cullDisabled } from '../src/render/frustum.js';
import { BOOT_DOOR_KEYS, ONLINE_REFUSED_FLAGS } from '../src/systems/onlineLane.js';

// AUDIT PERF-URL A2: a PATH, not a URL's pathname - `.pathname` is percent-encoded (a clone under "My Projects" read
// My%20Projects and the sweep threw ENOENT), and the repo's other ~490 pins take fileURLToPath
const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Count every URLSearchParams minted while `fn` runs. */
function minted(fn) {
  const Real = globalThis.URLSearchParams;
  let n = 0;
  globalThis.URLSearchParams = class extends Real { constructor(...a) { super(...a); n++; } };
  try { fn(); } finally { globalThis.URLSearchParams = Real; }
  return n;
}

test('PERF-URL: one parse a search - a thousand reads of the same search mint one URLSearchParams, a new search one more', () => {
  const n = minted(() => {
    for (let i = 0; i < 1000; i++) {
      assert.equal(pageParam('skin', '?perfurl-a&skin=classic'), 'classic');
      assert.equal(pageHas('perfurl-a', '?perfurl-a&skin=classic'), true);
    }
  });
  assert.equal(n, 1, 'the same search is parsed once, whatever is read off it');
  assert.equal(minted(() => { pageParam('skin', '?perfurl-b'); pageParam('skin', '?perfurl-b'); }), 1, 'a different search is parsed once more');
});

test('PERF-URL: the frame’s doors read through it - the online lane, the skin, the air, the shadow cache - one parse between them', () => {
  const search = '?perfurl-c&online=1&skin=classic&air=off';
  const n = minted(() => {
    for (let i = 0; i < 100; i++) {
      assert.equal(isOnlinePage(search), true);
      assert.equal(skinOverride(search), 'classic');
      assert.equal(uiSkin(search), 'classic');
      assert.equal(isEnhanced(search), false);
      assert.equal(airOn(search), false);
      assert.equal(contactOn(search), true);
      assert.equal(shadowCacheOn(search, null), false);   // CACHE-OFF: off unless asked on
      assert.equal(onlineForcedPref('perfurl-not-a-forced-key', search), undefined);
      assert.equal(swayDisabled(search), false);   // AUDIT PERF-URL A4: PERF-SUN's door, through the one home too
    }
  });
  assert.equal(n, 1, 'nine doors a hundred times each, off one search: one parse');
});

test('PERF-URL: keyed on the search it READS, so the boot’s published URL is the answer the moment it lands (MAC-N3)', () => {
  // publishBootParams rewrites location.search once, before the world boots - a latch read before it would answer
  // the menu's URL for the whole session, the very bug MAC-N3 fixed. The memo is keyed on the string, never latched.
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const loc = { search: '' };
  Object.defineProperty(globalThis, 'location', { value: loc, configurable: true, writable: true });
  try {
    assert.equal(isOnlinePage(), false, 'the menu: not online');
    assert.equal(skinOverride(), null);
    loc.search = '?world&online&skin=classic';   // the boot publishes what it decided
    assert.equal(isOnlinePage(), true, 'the published URL is read at once');
    assert.equal(skinOverride(), 'classic');
    loc.search = '?world';
    assert.equal(isOnlinePage(), false, 'and a URL without it is not online');
    assert.equal(skinOverride(), null);
    assert.equal(exposureFor(), EL_EXPOSURE, 'no door: the default');
    loc.search = '?exposure=1.5';
    assert.equal(exposureFor(), 1.5);
    assert.equal(motionEnabled({ location: { search: '?motion' }, navigator: { webdriver: true } }), true, 'a window’s own search is read, not the page’s');
    assert.equal(motionEnabled({ location: { search: '?nomotion' }, navigator: {} }), false);
    loc.search = '?cull=off';   // AUDIT PERF-URL A3: the frustum's escape hatch sniffed the search with its own regex
    assert.equal(cullDisabled(), true);
    loc.search = '?cull=on';
    assert.equal(cullDisabled(), false);
    loc.search = '?sway=off';
    assert.equal(swayDisabled(), true);
  } finally {
    if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location;
  }
});

/** Every .js under src/, outside the lab pages (src/tools/ - pages of their own, outside the game). */
function sourceFiles(dir = join(ROOT, 'src'), out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'tools') sourceFiles(p, out); } else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

test('PERF-URL: no door parses the query on its own - src/ reads the query only where it must, each for a reason', () => {
  // AUDIT PERF-URL A3: EVERY SPELLING OF A READ, not the one literal. The first sweep matched `new URLSearchParams(` on
  // one line, and the frustum's `?cull=off` hatch had been sniffing `location.search` with a regex all along; a
  // `new URL(location.href).searchParams.get(...)`, an alias (`const P = URLSearchParams`) or a constructor split over
  // two lines would have passed as well. A URL BUILT (`searchParams.set/delete` - the menu's links, the overhauls'
  // reload) reads nothing and is not swept.
  const READS = [
    /\bURLSearchParams\b/,                                        // any spelling: `new URLSearchParams(`, split, aliased
    /\.searchParams\s*\.\s*(?:get|getAll|has)\s*\(/,               // a URL object's query, read
    /\.(?:test|exec)\(\s*(?:globalThis\.|window\.)?location\??\.search\b/,   // a regex over the page's search
    /location\??\.search(?:\s*\?\?\s*'')?\)?\s*\.\s*(?:includes|indexOf|match|matchAll|search|startsWith|endsWith|split)\s*\(/,   // a string sniff of it
  ];
  // The sites that may, and why. A LATCH reads once a page by its own slice's contract ("read once", pinned where it
  // was made); the rest build or edit a query rather than read one.
  const ALLOWED = [
    ['src/systems/pageQuery.js', /_params = new URLSearchParams\(search\);/, 'the one home'],
    ['src/main.js', /const params = new URLSearchParams\(location\.search\);/, 'the boot\u2019s own params, which it edits and publishes'],
    ['src/systems/realmSaves.js', /const p = new URLSearchParams\(search\);/, 'realmBootSearch BUILDS a search (deletes and sets)'],
    ['src/systems/legacy/places.js', /const p = new URLSearchParams\(search\);/, 'LEGACY1: birthSearch and loadSearch BUILD a search, as realmBootSearch does'],
    ['src/systems/renderScale.js', /if \(_door === undefined\) _door = renderScaleOf\(new URLSearchParams\(globalThis\.location\?\.search \?\? ''\)\.get\('(\w+)'\)\);/, 'a latch, once a page (test/perfscale.test.js: "read once")'],
    ['src/systems/weatherSim.js', /UrlDoor \?\?= new URLSearchParams\(globalThis\.location\?\.search \?\? ''\)\.get\('(\w+)'\)/, 'four latches, once a page (test/clockArc.test.js: "read once")'],
  ];
  const offenders = [];
  const latched = [];
  let allowed = 0;
  for (const file of sourceFiles()) {
    const rel = relative(ROOT, file).split(sep).join('/');
    const code = codeOnly(readFileSync(file, 'utf8'));
    for (const line of code.split('\n')) {
      if (!READS.some((re) => re.test(line))) continue;
      const ok = ALLOWED.find(([f, re]) => f === rel && re.test(line));
      if (!ok) { offenders.push(`${rel}: ${line.trim().slice(0, 140)}`); continue; }
      allowed++;
      const key = line.match(ok[1])?.[1];
      if (key) latched.push(key);
    }
  }
  assert.deepEqual(offenders, [], 'a door that reads the query on its own - read it through systems/pageQuery.js (pageParam / pageHas)');
  assert.equal(allowed, 10, 'the allowed sites are all still there - one each, places.js\u2019s two and weatherSim\u2019s four (a stale allowance is a hole in the sweep)');
  // AUDIT PERF-URL A5: WHY A LATCH IS SAFE, HELD RATHER THAN SAID. The first cut claimed the boot's publish "runs before
  // any of them is asked" - unverified. What is true: the publish (onlineLane.js publishBootParams) writes main.js's
  // own params, which start from the page's search and edit only the boot's door keys (BOOT_DOOR_KEYS) and, online,
  // the refused power flags - so a latched key reads the same on either side of it, whenever it is first asked.
  assert.deepEqual(latched.sort(), ['evolve', 'renderscale', 'snowground', 'wxfield', 'wxmap']);
  const published = new Set([...BOOT_DOOR_KEYS, ...ONLINE_REFUSED_FLAGS]);
  assert.deepEqual(latched.filter((k) => published.has(k)), [], 'a latched key the boot publishes would keep the menu\u2019s answer for the session - the MAC-N3 bug; read it through pageParam');
});
