// AUDIT 68 (2026-09-24), cluster formats_c - src/formats skyFile..
// worldDataReplacement. A truncated stored UnityFS block refused rather
// than zero-filled; a reader error from a live bundle worker is the
// answer, not a dead worker to fall back from; SPELLS.STD's gate and
// first-wins fold each live once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readUnityBundle, TEXTURE_FORMAT } from '../src/formats/unityBundle.js';
import { handle } from '../src/formats/unityBundleWorker.js';
import { openUnityBundle } from '../src/formats/unityBundleClient.js';
import { unityFs, serializedFile, texture2dBody } from './unityFixture.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

/** Two 16x16 RGBA32 textures in 256-byte STORED blocks - the shape a mod
 *  built with Unity's Uncompressed option ships. */
function storedTwoTextures() {
  const px = new Uint8Array(16 * 16 * 4).fill(7);
  return unityFs(serializedFile([
    { typeIndex: 0, body: texture2dBody('A', 16, 16, TEXTURE_FORMAT.RGBA32, px) },
    { typeIndex: 0, body: texture2dBody('B', 16, 16, TEXTURE_FORMAT.RGBA32, px) },
  ]), { blockSize: 256 });
}

test('AUDIT 68 S12-bundle-stored-block-short: a truncated stored block is refused, never a zero-filled texture', () => {
  const whole = storedTwoTextures();
  // the intact bundle still reads every pixel
  const intact = readUnityBundle(whole);
  assert.equal(intact.textures.length, 2);
  assert.ok(intact.textures[1].rgba().data.every((b) => b === 7));
  // cut the tail: the last blocks come up short - an LZ4 block that short
  // throws in lz4BlockDecompress, and a stored one must too
  for (const cut of [200, 600]) {
    assert.throws(() => readUnityBundle(whole.subarray(0, whole.length - cut)).textures[1].rgba(),
      /stored block holds \d+ of \d+ bytes/, `cut ${cut}`);
  }
});

/** A Worker double that runs the real worker `handle` on a later tick. */
function fakeWorker() {
  const w = {
    terminated: 0, onmessage: null, onerror: null,
    postMessage(msg) { queueMicrotask(() => handle(msg, (reply) => w.onmessage?.({ data: reply }))); },
    terminate() { w.terminated += 1; },
  };
  return w;
}

test('AUDIT 68 S12-bundle-client-reader-error-reparse: a reader error from a live worker is the answer - no second parse on this thread', async () => {
  // counts the reader's reads of the CALLER's bytes (the worker parses its own copy)
  let hereReads = 0;
  class Watched extends Uint8Array { get buffer() { if (this.watched) hereReads += 1; return super.buffer; } }
  const bytes = new Watched([1, 2, 3]);
  bytes.watched = true;
  const w = fakeWorker();
  const warned = [];
  const warn = console.warn;
  console.warn = (...a) => warned.push(a.join(' '));
  try {
    await assert.rejects(openUnityBundle(bytes, { workerFactory: () => w }), /not a UnityFS archive/);
  } finally { console.warn = warn; }
  assert.equal(hereReads, 0, 'the main thread never re-parsed the bytes the worker already refused');
  assert.doesNotMatch(warned.join('\n'), /worker unavailable/, 'the worker was not dead - it answered');
  assert.equal(w.terminated, 1, 'the worker is still let go');
});

test('AUDIT 68 S12-spellsstd-dup: one SetSpellTypes gate, and the world loader rides the one first-wins fold', () => {
  const spells = rd('src/formats/spellsStd.js');
  assert.equal((spells.match(/effects\[0\]\.type > -1/g) ?? []).length, 1, 'readSpellsStd rides readSpellRecord\'s gate');
  const shared = rd('src/scenes/shared.js');
  assert.ok(shared.includes("spellsByIndexMap(readSpellsStd(await fetch('SPELLS.STD')))"), 'loadMagicRegistries folds through spellsByIndexMap');
  assert.equal(/byIndex\.has\(sp\.index\)/.test(shared), false, 'no hand-rolled copy of the fold');
});
