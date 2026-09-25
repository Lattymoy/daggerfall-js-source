// PERF-EXT-C (2026-09-25) - THE STREAMING HITCHES, the grass's share.
//
// The players: "fps issues in the exterior but fine in the interior",
// "me too my friend.. don't know why. I got a RX6600". Outdoors the
// frame pays for the stream, and the grass was the biggest single piece
// of it: every map-pixel crossing threw the field away (AUDIT 49 F2 /
// GR5's `labGrassField = null`) and regrew it over ~176 frames, and the
// slot count behind every rebuild was re-swept from scratch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../src/render/labGrass.js';   // a namespace, so a seam that is missing fails ITS pin and not the file

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORLD = readFileSync(join(root, 'src/scenes/world.js'), 'utf8');

// ─── PERF-EXT-C1: THE DISC IS SWEPT ONCE ─────────────────────────────
test('PERF-EXT-C1: discSlotCount sweeps once per question - every field after the first reads the memo, and the world warms it at mount', () => {
  assert.equal(typeof G.discSweeps, 'function', 'the sweep counter is the seam this pin reads');
  const r = { allocSlots() {}, writeSlot() {}, clearSlot() {} };
  const before = G.discSweeps();
  const a = G.createGrassField(r, { keep: () => 0 });
  const b = G.createGrassField(r, { keep: () => 0 });
  assert.equal(a.slots, 394, 'the shipped span holds 394 cells (grasspath.test.js holds that against a brute force)');
  assert.equal(b.slots, a.slots, 'the same answer the second time');
  assert.ok(G.discSweeps() - before <= 1, `two fields, at most one sweep (${G.discSweeps() - before})`);
  // every argument is part of the question: a memo keyed on less answers
  // one question with another's count
  const s0 = G.discSweeps();
  const q = [G.discSlotCount(157, 30), G.discSlotCount(157, 30), G.discSlotCount(157, 31), G.discSlotCount(157, 30, 12), G.discSlotCount(158, 30)];
  assert.equal(q[0], q[1]);
  assert.equal(G.discSweeps() - s0, 4, 'four distinct questions, four sweeps - and the repeat none');
  // the memo IS the sweep's answer
  assert.equal(G.discSlotCount(G.LAB_GRASS.span), a.slots);
  // the world pays the one sweep at mount, behind the loading screen
  assert.match(WORLD, /  let labGrassField = null;[^\n]*\n  if \(labGrass\) discSlotCount\(LAB_GRASS\.span\);/, 'warmed where the renderer is built');
});
