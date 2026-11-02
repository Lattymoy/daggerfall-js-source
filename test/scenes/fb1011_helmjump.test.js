// HELM-JUMP (FIELD BUGS 2026-10-11, bible/01-Overview/bugs/Field-Bugs-2026-10-11.md): "If you recall from the helm of a ship,
// you get sent to the void. You can unstuck to get out but then you're trapped at sea with no boat." A Recall, a guild's
// teleport, an unstuck and a quest's respawn are jumps DFU raises neither the travel nor the load event for, and the
// Come Sail Away helm heard none of them: its sail stood the player back at the drive position of the boat the jump had
// left (and hidden) at sea. The runtime's half - OnPreJump leaves the helm as a fast travel does - is pinned in
// test/systems/comeSailAway/csa_sailing.test.js; this file holds the host's: the teleport core raises it, for exactly the jumps no other
// event releases, before anything the jump awaits, and every reported road goes through that core.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const body = (src, head) => {
  const at = src.indexOf(head);
  assert.ok(at >= 0, `${head} stands`);
  const ends = ['\n  }\n', '\n  };\n'].map((e) => src.indexOf(e, at)).filter((i) => i > at);
  return src.slice(at, Math.min(...ends));
};

test('HELM-JUMP the teleport core lets go of the helm first - every jump but a load, a fast travel and a party\'s journey', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const csaPreJump = \(\) => \{ if \(csaRuntime\) csaCall\(\(\) => csaRuntime\.OnPreJump\(\)\); \};/, 'the runtime\'s OnPreJump, through the one guarded call');
  const core = body(w, '  async function _teleportToPixel(');
  const raise = core.indexOf('    if (modEvent == null && !resolveArrival) csaPreJump();');
  assert.ok(raise > 0, 'raised for the jumps with no event of their own - a load (OnStartLoad), a fast travel (OnPreFastTravel) and a party\'s arrival (after it is certain) release it themselves');
  assert.ok(raise < core.indexOf('    csaOnTeleport();'), 'before the waves are told of the jump');
  assert.ok(raise < core.indexOf('await '), 'before anything the jump awaits - the frames that run under the build must find no helm to pin to');
  assert.equal((core.match(/csaPreJump\(\)/g) ?? []).length, 1, 'once');
  // the fast travel and the load still release it their own way
  assert.match(w, /if \(csaRuntime && !partyArrival\) csaCall\(\(\) => csaRuntime\.OnPreFastTravel\(\)\);/);
  assert.match(w, /await _teleportToPixel\(pick\.pixel\.x, pick\.pixel\.y, null,\n\s*\{ arriveMinutes:[^\n]*\n[^\n]*\n\s*travelStart, modEvent: 'travel',/, 'the travel map\'s jump names its event, so the core does not release twice');
});

test('HELM-JUMP the reported roads - the Recall, the unstuck - and the teleport service and a quest\'s respawn go through the core', () => {
  const w = read('src/scenes/world.js');
  for (const [head, call] of [
    ['  async function recallToAnchor(', 'await _teleportToPixel(a.pixel.x, a.pixel.y);'],
    ['  const unstuckOutdoors = () => {', 'await _teleportToPixel(town.mapPixel.x, town.mapPixel.y, null, { reposition: REPOSITION.RandomStartMarker });'],
    ['  async function teleportTo(', 'await _teleportToPixel(pick.pixel.x, pick.pixel.y, null,'],
    ['  async function _respawnAtSite(', 'await _teleportToPixel(px.x, px.y);'],
  ]) {
    const fn = body(w, head);
    assert.ok(fn.includes(call), `${head.trim()} jumps through the core`);
    assert.doesNotMatch(fn.slice(0, fn.indexOf(call)), /modEvent: '(load|travel)'|resolveArrival/, `${head.trim()} raises no event that would skip the release`);
  }
});
