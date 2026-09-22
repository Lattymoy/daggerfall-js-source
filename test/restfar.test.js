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
  const said = [], secs = [];
  const make = new Function('PARTY_REST_RADIUS', 'setMidScreenText', `${slice}\n return partyRestFarNotice;`);
  return { notice: make(15, (t, s) => { said.push(t); secs.push(s); }), said, secs };
}

test('PARTY-REST4: told ONCE per nap - the same far frame sixty times says it once; near re-arms it; the rest ending re-arms it; the leader\'s own name, or a plain "Your party leader" when the row has none', () => {
  const { notice, said, secs } = liftNotice();
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
  notice(null, false, leader);
  notice({ mode: 0, hoursRemaining: 2, totalHours: 2 }, false, leader);
  assert.equal(said[3], 'Mac is loitering - come within 15 m of them to wait with the party.', 'AUDIT DROPS D3: a loiter is said as one');
  assert.ok(secs.every((s) => s === 4), 'AUDIT DROPS D3: four seconds on the label, every time');
});

test('PARTY-REST4 by source: the notice reads the SAME `near` the mirror reads, before the mirror acts on it; the latch stands down with the party; the text names PARTY_REST_RADIUS', () => {
  const tick = w.slice(w.indexOf('  const partyRestFollowTick = () => {'), w.indexOf('  /** SOC6 ', w.indexOf('  const partyRestFollowTick = () => {')));
  assert.match(tick, /const near = nearAccount\(social\.party\.leader, leaderRow\?\.p\);\s*\n\s*if \(!leaderRest\) _partyRestDeclined = false;[^\n]*\n\s*const dead = playerEntity\.health <= 0 \|\| !!modes\?\.deathUp\?\.\(\);\s*\n\s*if \(!dead\) partyRestFarNotice\(leaderRest, near, leaderRow\);[^\n]*\n\s*if \(mirroring\) \{/,
    'one `near`, read once, the notice before the mirror ends on it, and not while the HUD is down for a death (AUDIT DROPS D3)');
  assert.match(tick, /const leaderRest = leaderRow\?\.online === false \? null : \(leaderRow\?\.p\?\.rest \?\? null\);/, 'AUDIT DROPS D3: an offline leader rests nobody');
  // AUDIT DROPS D2: a mirror closed while the leader still rests is declined for that nap
  assert.match(tick, /if \(mirroring\) \{\s*\n\s*_partyRestMirrored = true;/);
  assert.match(tick, /if \(_partyRestMirrored\) \{ _partyRestMirrored = false; if \(leaderRest\) _partyRestDeclined = true; \}\s*\n\s*if \(!leaderRest \|\| !near \|\| _partyRestDeclined\) return;/);
  assert.match(tick, /if \(mirroring\) ov\._end\(ov\.session\.endEarly\(\)\);[^\n]*\n\s*_partyRestFarSaid = false;[^\n]*\n\s*return;/, 'no party or I lead: the latch stands down');
  assert.match(w, /const PARTY_REST_FAR_TEXT = \(who, loitering = false\) => `\$\{who\} is \$\{loitering \? 'loitering' : 'resting'\} - come within \$\{PARTY_REST_RADIUS\} m of them to \$\{loitering \? 'wait' : 'rest'\} with the party\.`;/, 'the radius is the one law\'s own number, never restated; a loiter is not a rest (AUDIT DROPS D3)');
  assert.match(w, /const partyRestFarNotice = \(leaderRest, near, leaderRow\) => \{\s*if \(!leaderRest \|\| near\) \{ _partyRestFarSaid = false; return; \}\s*if \(_partyRestFarSaid\) return;\s*_partyRestFarSaid = true;\s*setMidScreenText\(PARTY_REST_FAR_TEXT\(leaderRow\?\.name \|\| 'Your party leader', leaderRest\.mode === 0\), PARTY_REST_FAR_SECONDS\);\s*\};/);
  assert.match(w, /const PARTY_REST_FAR_SECONDS = 4;/, 'AUDIT DROPS D3: long enough to be read - the label\'s 1.5 s default is a refusal\'s');
  assert.match(w, /import \{ setMidScreenText \} from '\.\.\/ui\/midScreenText\.js';/, 'the HUD\'s own centred label - the door every refusal takes');
});
