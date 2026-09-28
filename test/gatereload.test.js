// GATE-RELOAD (2026-09-26, volo on Discord: "the oblivion gate is bugged rn" - "you cant enter it" - "it kicks you out
// instantly"): AN OUTDATED GAME IS TOLD TO RELOAD, NOT THAT AN OPEN GATE IS CLOSED. AUDIT WBX R7 (world116, deployed
// 21:12 UTC) refuses the `in` of a game that does not know the brain's law in the one refusal word such a game acts on -
// "the gate is closed" - and every game loaded before that deploy (a tab left open, a desktop copy whose update waits for
// the app to quit) walked into the court, was refused and was thrown out before the gate a second later, reading "The
// gate is closed." in front of an open gate. Reproduced in a real browser against the real Room: the build before the
// deploy (c0093f70) is thrown out so; this build's own `in` fights. The relay says that word in a `no` for R7 alone (a
// window that has ended is refused at the hello, as an `error`), so the client reads it as what it means. Design:
// bible/11-Multiplayer/World-Bosses.md section 12.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGateLink, gateRefusalText, GATE_NO_TEXT, GATE_OUTDATED_TEXT } from '../src/net/gateLink.js';
import { GATE_NO_WORDS, GATE_BRAIN_V, validGateOut } from '../src/net/wire.js';
import { gateTimes, gateRoomKey } from '../src/net/gateLaw.js';
import { COURT_CENTRE } from '../src/net/gateBrain.js';
import { fakeRooms } from './fakeRoom.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('GATE-RELOAD the link: a refusal of my `in` that says the gate is closed is said as an outdated game - save, then reload or update - and still hands its word to the host, which takes me out; every other refusal keeps its own words (mutants: the closed gate said as closed; the host not told)', () => {
  const said = [], refused = [];
  const link = createGateLink({ now: () => 0, say: (s) => said.push(s), onRefused: (m) => refused.push(m) });
  link.word({ k: 'no', m: 'the gate is closed' });
  assert.deepEqual(said, [GATE_OUTDATED_TEXT]);
  assert.deepEqual(refused, ['the gate is closed'], 'the host is handed the relay\'s own word');
  assert.match(GATE_OUTDATED_TEXT, /older than this gate/);
  assert.match(GATE_OUTDATED_TEXT, /save, then reload \(or update the app\)/, 'what to do, and on the desktop copy too');
  assert.doesNotMatch(GATE_OUTDATED_TEXT, /closed/i, 'never that the open gate is closed');
  assert.equal(gateRefusalText('the gate is closed'), GATE_OUTDATED_TEXT);
  for (const w of GATE_NO_WORDS.filter((x) => x !== 'the gate is closed')) assert.equal(gateRefusalText(w), GATE_NO_TEXT[w], w);
  assert.equal(gateRefusalText('a word no build knows'), 'a word no build knows');
  // the hello's refusal of a window that has ended keeps its own words (world.js ejectFromCourt's terminal arm)
  assert.equal(GATE_NO_TEXT['the gate is closed'], 'The gate is closed.');
});

test('GATE-RELOAD the relay: its `no` says the gate is closed for ONE reason - the brain\'s law unknown (AUDIT WBX R7) - and a game that says it is let in; the window\'s own end is the hello\'s `error`, never a `no`, so the client\'s reading of the word stays true (mutants: the reading pinned on a second sender)', async () => {
  const relay = read('server/src/index.js');
  const closedNo = relay.match(/k: 'no', m: 'the gate is closed'/g) ?? [];
  assert.equal(closedNo.length, 1, 'one sender of the word in a `no`');
  assert.match(relay, /if \(!\(m\.bv >= GATE_BRAIN_MIN\)\) \{ this\._send\(ws, JSON\.stringify\(\{ t: 'gate', k: 'no', m: 'the gate is closed' \}\)\); return; \}/, 'and it is the brain\'s door');
  assert.match(relay, /const no = f\.fell \|\| f\.wrath \? 'the gate is closing' : Object\.keys\(f\.players\)\.length >= GATE_FIGHTERS_MAX \? 'the court is full' : 'the gate is sealed';/, 'the join\'s refusals name the other words');
  assert.match(relay, /if \(!gateHolds\(day, now\)\) return 'the gate is closed';/, 'the window\'s end is the hello\'s word...');
  assert.match(relay, /if \(isGateRoom\(a\.key\)\) \{ const no = await this\._gateAdmit\(a\.key, who\.subject, now\); if \(no\) \{ this\._refuse\(ws, no\); return; \} \}/, '...refused as an error, the socket closed');

  const DAY = 200, TT = gateTimes(DAY);
  const realNow = Date.now; let clock = TT.openAt + 1000; Date.now = () => clock;
  try {
    const r = fakeRooms({ now: () => clock }).room(gateRoomKey(DAY));
    const pose = { x: COURT_CENTRE[0], y: 0, z: COURT_CENTRE[2] + 3, yaw: 0, pitch: 0 };
    const old = r.connect(); await r.hello(old, 'peer-0001', pose);
    await r.raw(old, JSON.stringify({ t: 'gate', k: 'in', lv: 10 }));   // the shape every build before AUDIT WBX says
    const no = old.sent.filter((m) => m.t === 'gate').at(-1);
    assert.deepEqual(no, { t: 'gate', k: 'no', m: 'the gate is closed' }, 'the word an older game acts on');
    // ...and the link of THIS build, handed the relay's own frame through the wire's projection, says what it means
    const said = [], refused = [];
    createGateLink({ now: () => clock, say: (s) => said.push(s), onRefused: (m) => refused.push(m) }).word(validGateOut(no));
    assert.deepEqual(said, [GATE_OUTDATED_TEXT]); assert.deepEqual(refused, ['the gate is closed']);
    const now = r.connect(); await r.hello(now, 'peer-0002', pose);
    await r.raw(now, JSON.stringify({ t: 'gate', k: 'in', lv: 10, bv: GATE_BRAIN_V }));
    assert.equal(now.sent.filter((m) => m.t === 'gate').at(-1)?.k, 'st', 'this build\'s own `in` fights');
  } finally { Date.now = realNow; }
});

test('GATE-RELOAD the host: a refused `in` takes the player out of the court in the words the link said (the terminal arm keeps the hello\'s own) (mutants: the eject in the old words)', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /import \{ createGateLink, GATE_NO_TEXT, gateRefusalText \} from '\.\.\/net\/gateLink\.js';/);
  assert.match(world, /onRefused: \(why\) => \{ if \(modes\?\.gateArenaDay\?\.\(\) != null\) ejectFromCourt\(gateRefusalText\(why\)\); \},/);
  assert.doesNotMatch(world, /ejectFromCourt\(GATE_NO_TEXT\[why\]/, 'no refusal of an `in` said in the old words');
  assert.match(world, /else if \(courtDay != null && online\?\.terminal\) ejectFromCourt\(GATE_NO_TEXT\[online\.error\] \?\? COURT_TEXT\.lost\);/, 'a hello refused at the window\'s end still says the gate is closed');
  assert.match(read('src/net/gateLink.js'), /if \(g\.k === 'no'\) \{ say\(gateRefusalText\(g\.m\)\); onRefused\(g\.m\); return; \}/);
});
