// AUDIT ANTICHEAT A1 (2026-10-17; #955 - assuredumbrel's "close release-build cheat doors", picked up and audited) -
// THE LIVE ENTITY IS PUBLISHED ON A PROBE'S BOOT ALONE.
//
// surfacePlayer() wrote `window.__playerEntity` on every page, so the whole live entity - stats, gold, pack, carry,
// the lot - was one line away from any console. #955 gated it on `?shot`, the probes' boot (every tools/*Probe.mjs
// that reads the handle boots with it), and an online boot drops `?shot` before anything reads it (onlineLane.js
// ONLINE_REFUSED_FLAGS). Its cut minted a URLSearchParams a call, inside the frame - PERF-URL's waste, and
// test/systems/perfurl_doors.test.js failed on it - so the gate reads systems/pageQuery.js's memo instead.
//
// It hides a handle; it is no lock (bible/01-Overview/Audit-Log.md, AUDIT ANTICHEAT): the browser's console reaches a
// module's live exports without it. What another player sees, takes or is ranked against is the Integrity arc's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerEntity, surfacePlayer } from '../../src/characters/playerEntity.js';
import { refuseOnlinePowerFlags } from '../../src/systems/online/onlineLane.js';

/** Run `fn` on a page whose query is `search`, its `window` the global as a browser's is; the globals restored after. */
function onPage(search, fn) {
  const saved = ['window', 'location'].map((k) => /** @type {const} */ ([k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  /** @type {any} */ (globalThis).window = globalThis;
  /** @type {any} */ (globalThis).location = { search };
  try { return fn(); } finally {
    for (const [k, d] of saved) { if (d) Object.defineProperty(globalThis, k, d); else delete /** @type {any} */ (globalThis)[k]; }
    delete /** @type {any} */ (globalThis).__playerEntity;
  }
}
const published = () => Object.hasOwn(globalThis, '__playerEntity');

test('AUDIT ANTICHEAT A1: a ?shot boot is handed the live entity itself, and no played page is handed anything', () => {
  onPage('?shot&class=3', () => {
    surfacePlayer();
    assert.equal(/** @type {any} */ (globalThis).__playerEntity, playerEntity, 'the probe\'s boot: the live entity, not a copy');
  });
  for (const search of ['', '?world&load=1', '?world&classic&novideo']) {
    onPage(search, () => { surfacePlayer(); assert.equal(published(), false, `"${search}" is a played page`); });
  }
  // the online boot's own params, as world.js treats them: the lane drops ?shot and publishes the drop
  const params = new URLSearchParams('?world&shot&online&realm=r1&load=1');
  assert.deepEqual(refuseOnlinePowerFlags(params), ['shot']);
  onPage(`?${params}`, () => { surfacePlayer(); assert.equal(published(), false, 'an online boot asked with ?shot'); });
});

test('AUDIT ANTICHEAT A1: a page whose search loses ?shot loses the handle at the next surface', () => {
  onPage('?world&shot', () => {
    surfacePlayer();
    assert.equal(published(), true);
    /** @type {any} */ (globalThis).location.search = '?world';   // a replaceState, as publishBootParams makes one
    surfacePlayer();
    assert.equal(published(), false, 'the handle an earlier publish left is taken away');
  });
});

test('AUDIT ANTICHEAT A1: the gate is one parse a search - surfacePlayer runs in the frame (PERF-URL)', () => {
  const Real = globalThis.URLSearchParams;
  let minted = 0;
  globalThis.URLSearchParams = class extends Real { constructor(/** @type {any[]} */ ...a) { super(...a); minted++; } };
  try {
    onPage('?shot&anticheat-a1', () => { for (let i = 0; i < 1000; i++) surfacePlayer(); });
    onPage('?world&anticheat-a1', () => { for (let i = 0; i < 1000; i++) surfacePlayer(); });
  } finally { globalThis.URLSearchParams = Real; }
  assert.equal(minted, 2, 'two searches, two parses - not one a call');
});
