// G7b - THE DAEDRA SUMMONED WINDOW, pinned against
// DaggerfallDaedraSummonedWindow.cs: the four-line chunk walk, the
// last chunk's Yes/No gate over the offer flow's REAL respond, the
// answer's message through the same chunks, and the host's
// one-consumer mount with the box-chain fallback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DaedraSummonedWindow, tokensToLines, TEXT_LINES_PER_CHUNK, REFUSAL_FOE_COUNT,
} from '../src/ui/daedraSummonedWindow.js';
import { DAEDRA } from '../src/systems/daedraSummoning.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T = (text) => ({ formatting: 'text', text });
const BR = { formatting: 'newline' };
const tokensFor = (lines) => lines.flatMap((l) => [T(l), BR]);
const mkWindow = (offerLines, { respond = () => null, spawn = null, onClose = null } = {}) =>
  new DaedraSummonedWindow({
    flcBytes: new Uint8Array(8),   // not a FLIC: readyToPlay stays false, the logic runs anyway
    flcName: 'AZURA.FLC',
    offerStep: { kind: 'offer', prompt: { tokens: tokensFor(offerLines) }, respond },
    spawnRefusalFoes: spawn, onClose,
  });

test('G7b: tokensToLines keeps loadMessage\'s text+break pairing', () => {
  assert.deepEqual(tokensToLines(tokensFor(['a', 'b'])), ['a', 'b']);
  assert.deepEqual(tokensToLines([T('tail with no break')]), ['tail with no break']);
  assert.deepEqual(tokensToLines([]), []);
  assert.equal(TEXT_LINES_PER_CHUNK, 4, ':26');
  assert.deepEqual([...REFUSAL_FOE_COUNT], [3, 5], 'Random.Range(3,6) at the refusal (:86)');
});

test('G7b: the chunk walk - four lines a page, the LAST offer page answers to Y/N alone', () => {
  const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`);
  const w = mkWindow(lines);
  assert.deepEqual(w.chunk, lines.slice(0, 4), 'DisplayNextTextChunk at Setup');
  assert.equal(w.lastChunk, false);
  w.click();
  assert.deepEqual(w.chunk, lines.slice(4, 8));
  w.input('Space');   // any key pages too
  assert.deepEqual(w.chunk, lines.slice(8, 10));
  assert.equal(w.lastChunk, true, 'the tail chunk arms the answer');
  w.click();
  assert.equal(w.done, false, 'a click on the last OFFER chunk does nothing - DFU waits on Yes/No');
  assert.deepEqual(w.chunk, lines.slice(8, 10), 'and the page does not move');
});

test('G7b: YES runs the machine\'s respond once and reads the accept message; the last click closes', () => {
  let responded = [];
  let closed = 0;
  const accept = ['well', 'met', 'mortal', 'I have', 'work'];   // five lines: two pages
  const w = mkWindow(['the offer'], {
    respond: (yes) => { responded.push(yes); return { kind: 'accepted', popup: { tokens: tokensFor(accept) } }; },
    onClose: () => closed++,
  });
  assert.equal(w.lastChunk, true, 'a one-line offer is its own last chunk');
  w.input('KeyY');
  assert.deepEqual(responded, [true], 'the offer flow\'s REAL respond - startQuestImmediate rides it');
  assert.deepEqual(w.chunk, accept.slice(0, 4), 'the answer\'s message through the same chunks');
  w.input('KeyY');
  assert.deepEqual(responded, [true], 'past the answer Y is just a key: it PAGES, never re-responds');
  assert.deepEqual(w.chunk, accept.slice(4), 'the tail page');
  w.click();
  assert.equal(w.done, true, 'past the answer, the last click closes');
  w.click();
  assert.equal(closed, 1, 'one close, however many keys land on the tail');
});

test('G7b: NO refuses, looses the daedra through the flagged door, and an empty popup closes at once', () => {
  let spawned = 0;
  const responded = [];
  const w = mkWindow(['the offer'], {
    respond: (yes) => { responded.push(yes); return { kind: 'refused', popup: { tokens: tokensFor(['begone']) } }; },
    spawn: () => spawned++,
  });
  w.input('KeyN');
  assert.deepEqual(responded, [false]);
  assert.equal(spawned, 1, 'the refusal\'s 3-5 daedra ride the host door (FLAGGED unmounted)');
  assert.deepEqual(w.chunk, ['begone']);
  // and an answer with NO message closes immediately
  const w2 = mkWindow(['x'], { respond: () => ({ kind: 'accepted', popup: null }) });
  w2.input('Enter');
  assert.equal(w2.done, true, 'nothing to read: the window leaves with the answer');
});

test('G7b: sixteen princes, sixteen films, and the host mounts ONE consumer of the step', () => {
  const videos = DAEDRA.map((d) => d.video);
  assert.equal(videos.length, 16, 'one row per prince');
  assert.ok(videos.every((v) => /^[A-Z0-9]+\.FLC$/.test(v)), 'each names its .FLC');
  assert.equal(new Set(videos).size, 16, 'no prince borrows another\'s film');
  const wm = read('src/scenes/worldModes.js');
  assert.ok(wm.includes("fetchBytes(r.daedra.video).then((bytes) => {"), 'the film fetches on a successful summons');
  assert.ok(wm.includes('if (!sw.flc.readyToPlay) { mountBoxes(); return; }'),
    'an unreadable FLC falls back to the box chain - never traps');
  const offerIdx = wm.indexOf("if (offered?.kind === 'offer' && r.daedra.video)");
  const boxIdx = wm.indexOf('if (offered) { mountBoxes(); return null; }');
  assert.ok(offerIdx > 0 && boxIdx > offerIdx,
    'the step has ONE consumer: the film window first, the boxes only when no film can');
  const fp = read('src/ui/daedraSummonedWindow.js');
  assert.ok(fp.includes('new FlcPlayer(this.flc, { loop: true })'), 'the film LOOPS - FLCPlayer.Loop defaults true (:38)');
});
