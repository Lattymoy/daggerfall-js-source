// REST-OFFLINE1 (Discord, 2026-09-22, a crash report): "TypeError: Cannot
// read properties of null (reading 'now') at markPartyRestSpent <-
// toggleRest <- travel". Offline there is no party and no social clock:
// `social` is built by socialStart alone (an online account), and the
// party-rest gate already answers null on `!social?.party` - but the
// shared reset every granted rest runs read `social.now()` blind, and the
// rest (and the frame) died with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('REST-OFFLINE1: by source - the party-rest reset is a no-op with no social clock, before it touches a field', () => {
  const w = read('src/scenes/world.js');
  const at = w.indexOf('const markPartyRestSpent = () => {');
  assert.ok(at > 0, 'the shared reset stands');
  const body = w.slice(at, w.indexOf('\n  };', at));
  const guard = body.indexOf('if (!social) return;');
  assert.ok(guard > 0, 'the reset returns without a social clock');
  assert.ok(guard < body.indexOf('_partyRestReady = false;'), 'before the first field it resets');
  assert.ok(guard < body.indexOf('_partyRestJustStartedAt = social.now();'), 'and before the clock read that threw');
  // the gate's own offline answer, which this mirrors
  assert.match(w, /const partyRestGate = \(\) => \{\s*\n\s*if \(!social\?\.party\) return null;/);
  // the only `social` constructions: the online link's
  assert.equal((w.match(/^\s*social = new SocialState\(/gm) ?? []).length, 1);
  assert.match(w, /let social = null/);
});
