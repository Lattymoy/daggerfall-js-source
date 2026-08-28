// CG1 - the chargen nit batch: the question scroll's pixel shear and
// the difficulty dagger's fading trail. Rows 379/382/383 of the same
// U18-U20 cluster stay as recorded postures (no keybinding registry;
// end-state-verbatim; value-verbatim) - this slice takes the two that
// were genuinely buildable.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tickDaggerTrails, DAGGER_TRAIL_LINGER_S } from '../src/systems/customClass.js';
import { Renderer } from '../src/render/renderer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');

// ---------------------------------------------------------------
// 1. AnimateDagger's machine (CreateCharCustomClass.cs:515-531)
// ---------------------------------------------------------------

test('CG1: a dagger move spawns a full-alpha trail AT THE LANDING that fades over one second', () => {
  const st = {};
  assert.deepEqual(tickDaggerTrails(st, 115, 0), [], 'the first frame latches, no trail');
  assert.deepEqual(tickDaggerTrails(st, 115, 0.5), [], 'sitting still spawns nothing');
  const born = tickDaggerTrails(st, 100, 1.0);
  assert.equal(born.length, 1);
  assert.equal(born[0].y, 100, 'the trail stands where the dagger LANDED (:518 copies the moved position)');
  assert.equal(born[0].alpha, 1, 'BackgroundColor starts 255');
  const mid = tickDaggerTrails(st, 100, 1.4);
  assert.ok(Math.abs(mid[0].alpha - 0.6) < 1e-9, '255 * timeLeft / linger');
  assert.deepEqual(tickDaggerTrails(st, 100, 1.0 + DAGGER_TRAIL_LINGER_S), [],
    'removed at zero (:529-530)');
});

test('CG1: rapid moves leave a CHAIN of ghosts, oldest first - the Components.Add order', () => {
  const st = {};
  tickDaggerTrails(st, 115, 0);
  tickDaggerTrails(st, 100, 0.1);
  tickDaggerTrails(st, 80, 0.3);
  const out = tickDaggerTrails(st, 60, 0.5);
  assert.deepEqual(out.map((t) => t.y), [100, 80, 60], 'each landing keeps its ghost');
  assert.ok(out[0].alpha < out[1].alpha && out[1].alpha < out[2].alpha,
    'older ghosts are further faded');
});

test('CG1: a spot the dagger sat on for over a second leaves NO ghost when it moves away', () => {
  // the trail spawns at ARRIVAL - a dagger parked past the linger has
  // already burned it, which is DFU's own behavior (the flash only
  // becomes visible if the dagger moves on within the second)
  const st = {};
  tickDaggerTrails(st, 115, 0);
  tickDaggerTrails(st, 100, 0.1);       // arrive at 100
  const out = tickDaggerTrails(st, 60, 2.0);   // leave 1.9s later
  assert.deepEqual(out.map((t) => t.y), [60], 'only the fresh landing carries a trail');
});

test('CG1: the custom-class draw rides the machine, trails AFTER the dagger, real alpha blend', () => {
  const ca = src('ui/chargenArt.js');
  const daggerAt = ca.indexOf("drawImg(renderer, dagger, m, CUSTOM_DAGGER_X, dy);");
  const trailAt = ca.indexOf('tickDaggerTrails(c._daggerTrails, dy, performance.now() / 1000)');
  assert.ok(daggerAt > 0 && trailAt > daggerAt, 'dagger first, trails after - the DFU panel order');
  assert.ok(ca.includes('[1, 1, 1, t.alpha], { blend: true }'),
    'the fade is REAL alpha through the blend arm, not the cutout path');
});

// ---------------------------------------------------------------
// 2. The question scroll's pixel shear (RestrictedRenderArea)
// ---------------------------------------------------------------

test('CG1: setScreenScissor speaks GL bottom-left with the shake offset applied', () => {
  const calls = [];
  const gl = {
    SCISSOR_TEST: 'ST',
    drawingBufferHeight: 600,
    enable: (f) => calls.push(['enable', f]),
    disable: (f) => calls.push(['disable', f]),
    scissor: (...a) => calls.push(['scissor', ...a]),
  };
  Renderer.prototype.setScreenScissor.call({ gl, _screenOffset: [3, 5] }, 20, 136, 320, 48);
  assert.deepEqual(calls[0], ['enable', 'ST']);
  // y flip: top-left 136 (+5 shake) with height 48 -> GL y = 600 - 141 - 48
  assert.deepEqual(calls[1], ['scissor', 23, 600 - 141 - 48, 320, 48]);
  Renderer.prototype.clearScreenScissor.call({ gl });
  assert.deepEqual(calls[2], ['disable', 'ST'], 'the bracket closes - scissor also gates gl.clear');
});

test('CG1: the question rows draw SHEARED at the textArea boundary, inside the bracket', () => {
  const ca = src('ui/chargenArt.js');
  const setAt = ca.indexOf('renderer.setScreenScissor(m.ox + QSCROLL_TEXT_LEFT * m.s, m.oy + top * m.s');
  const rowGuard = ca.indexOf('if (vy + QUESTION_ROW_H <= top || vy >= bottom) continue;');
  const clearAt = ca.indexOf('renderer.clearScreenScissor();');
  assert.ok(setAt > 0 && rowGuard > setAt && clearAt > rowGuard,
    'set -> overlap-only row skip -> clear, in that order');
  // the old whole-row pop is GONE: a row partially past the edge draws
  // and the scissor cuts it at the pixel
  assert.equal(ca.includes('if (vy < top || vy + QUESTION_ROW_H > bottom) continue;'), false,
    'no row pops at the boundary any more');
});
