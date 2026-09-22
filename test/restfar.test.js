// PARTY-REST4 (2026-09-22, Mac: "Notification when youre not near the
// party leader for resting"): a follower whose leader rests OUT OF THEIR
// REACH is told so once, on the HUD's own centred label, and told again
// only after that rest has ended or they have come near. The notice is
// a pure function of (the leader's rest, my nearness, the leader's row)
// over one latch, so it is lifted out of scenes/world.js and DRIVEN
// here; the wiring into partyRestFollowTick is pinned by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const w = rd('src/scenes/world.js');

/** The notice, lifted out of the host closure: from the text's declaration through the function's close. */
function liftNotice() {
  const start = w.indexOf('  const PARTY_REST_FAR_TEXT = ');
  const end = w.indexOf('  const partyRestFollowTick = ');
  assert.ok(start > 0 && end > start, 'the notice sits between the text and the follow tick');
  const slice = w.slice(start, end);
  const said = [];
  const make = new Function('PARTY_REST_RADIUS', 'setMidScreenText', `${slice}\n return partyRestFarNotice;`);
  return { notice: make(15, (t) => said.push(t)), said };
}

test('PARTY-REST4: told ONCE per nap - the same far frame sixty times says it once; near re-arms it; the rest ending re-arms it; the leader\'s own name, or a plain "Your party leader" when the row has none', () => {
  const { notice, said } = liftNotice();
  const rest = { mode: 1, hoursRemaining: 6, totalHours: 8 };
  const leader = { acct: 'a1', name: 'Mac' };
  for (let i = 0; i < 60; i++) notice(rest, false, leader);
  assert.deepEqual(said, ['Mac is resting - come within 15 m of them to rest with the party.'], 'once, with the leader\'s name and the radius');
  notice(rest, true, leader);
  assert.equal(said.length, 1, 'near: nothing said (the mirror opens instead)');
  notice(rest, false, leader);
  assert.equal(said.length, 2, '...and far again after being near is a new word');
  notice(null, false, leader);
  notice(null, false, leader);
  assert.equal(said.length, 2, 'no rest: nothing');
  notice(rest, false, null);
  assert.equal(said[2], 'Your party leader is resting - come within 15 m of them to rest with the party.', 'the rest ended and began again: said again, with the fallback name');
  notice(rest, false, { acct: 'a1', name: '' });
  assert.equal(said.length, 3, 'still latched');
});

test('PARTY-REST4 by source: the notice reads the SAME `near` the mirror reads, before the mirror acts on it; the latch stands down with the party; the text names PARTY_REST_RADIUS', () => {
  const tick = w.slice(w.indexOf('  const partyRestFollowTick = () => {'), w.indexOf('  /** SOC6 ', w.indexOf('  const partyRestFollowTick = () => {')));
  assert.match(tick, /const near = nearAccount\(social\.party\.leader, leaderRow\?\.p\);\s*\n\s*partyRestFarNotice\(leaderRest, near, leaderRow\);[^\n]*\n\s*if \(mirroring\) \{/,
    'one `near`, read once, the notice before the mirror ends on it');
  assert.match(tick, /if \(mirroring\) ov\._end\(ov\.session\.endEarly\(\)\);[^\n]*\n\s*_partyRestFarSaid = false;[^\n]*\n\s*return;/, 'no party or I lead: the latch stands down');
  assert.match(w, /const PARTY_REST_FAR_TEXT = \(who\) => `\$\{who\} is resting - come within \$\{PARTY_REST_RADIUS\} m of them to rest with the party\.`;/, 'the radius is the one law\'s own number, never restated');
  assert.match(w, /const partyRestFarNotice = \(leaderRest, near, leaderRow\) => \{\s*if \(!leaderRest \|\| near\) \{ _partyRestFarSaid = false; return; \}\s*if \(_partyRestFarSaid\) return;\s*_partyRestFarSaid = true;\s*setMidScreenText\(PARTY_REST_FAR_TEXT\(leaderRow\?\.name \|\| 'Your party leader'\)\);\s*\};/);
  assert.match(w, /import \{ setMidScreenText \} from '\.\.\/ui\/midScreenText\.js';/, 'the HUD\'s own centred label - the door every refusal takes');
});
