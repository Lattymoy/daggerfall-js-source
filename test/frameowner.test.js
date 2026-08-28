// P0 (Mac 2026-08-28, the crash under the wizard) - THE FRAME OWNER.
// A scene host's requestAnimationFrame loop had no owner: nothing
// could stop one once started, so an unwind that failed to navigate
// (or any path that boots a second host) left an old frame updating
// foes against torn state - the live TypeError under the wizard,
// null feet indexed at enemyMotor's raw [0] reads. The fix is an
// owner for the frame, not a null check: guarding feet?.[0] would
// draw foes against a dead world and call it working.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { claimFrame, frameAlive } from '../src/scenes/shared.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');

test('P0: the token is a generation - a later claim kills every earlier holder', () => {
  const a = claimFrame();
  assert.equal(frameAlive(a), true, 'the newest claim owns the frame');
  const b = claimFrame();
  assert.equal(frameAlive(a), false, 'the old session is dead the moment another claims');
  assert.equal(frameAlive(b), true);
  // idempotence of the check: asking does not disturb ownership
  assert.equal(frameAlive(b), true);
  assert.equal(frameAlive(a), false);
});

test('P0: every rAF host claims at boot and checks at the top of every frame', () => {
  // The three scene hosts with unconditional rAF recursion (worldModes
  // has no loop of its own - its frame is CALLED by world.js's, so the
  // owner covers it).
  for (const h of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeon.js']) {
    const s = code(h);
    assert.match(s, /const _frameToken = claimFrame\(\);/, `${h} claims at boot`);
    // the guard is the FIRST statement of frame() - before any state
    // is touched, because the point is not to touch it
    assert.match(s, /function frame\(now\) \{\n\s+if \(!frameAlive\(_frameToken\)\) return;/,
      `${h} stops recursing the moment it loses ownership`);
  }
});

test('P0: both unwinds claim BEFORE they act - the old loop dies even if navigation stalls', () => {
  const s = code('scenes/shared.js');
  assert.match(s, /export function exitToTitleMenu\(\) \{\n\s+claimFrame\(\);/,
    'the bare-URL unwind kills the loop first');
  assert.match(s, /export async function endRunToTitleMenu\(renderer\) \{\n\s+claimFrame\(\);/,
    'the death video owns the canvas - the host loop stops before it plays');
});
