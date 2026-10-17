// AUDIT EG III (2026-10-13, the Elite Gates arc's third audit) - THE BIBLE PASS, group F: bible/11-Multiplayer/Elite-Gates.md
// section 31's records held to the code as built (RETIRING A FLAG DELETES THE SENTENCE), and the one wire word the merge
// notes found missing.
//   THE SEAL ON THE WIRE - net/wire.js EG_END_WORDS lacked `'seal'` while net/eliteGates/egReceipt.js EG_END_WHYS and net/eliteGates/egLaw.js
//   EG_OPEN_ENDS carried it, so the director's own `egEnd(B, 'seal')` said an `end` and a state every screen's validEgOut
//   refused. The fixture is the producer's: a breach of the director's (egBreachNew, egEnter), ended by egEnd.
//   THE PAGE - the departures later slices closed are gone from the records that kept them, each list numbered without a
//   gap, and section 31 says once how a record names another's departure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validEgOut, EG_END_WORDS } from '../../../src/net/wire.js';
import { egBreachNew, egEnter, egEnd, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { EG_SEALED_MS, EG_OPEN_ENDS } from '../../../src/net/eliteGates/egLaw.js';
import { EG_END_WHYS } from '../../../src/net/eliteGates/egReceipt.js';
import { EG_END_TEXT } from '../../../src/scenes/eliteGates/egClient.js';

const T0 = 1_800_000_000_000;

test('AUDIT EG III THE SEAL ON THE WIRE (section 13.3, THE SEAL; section 23): the director\'s `egEnd(B, \'seal\')` says an `end` frame and a state that the wire carries - before, net/wire.js EG_END_WORDS lacked `\'seal\'` and validEgOut refused both, so no screen heard a sealed end; every end the room says is one the receipt law takes and the client words (mutant: `\'seal\'` off EG_END_WORDS)', () => {
  const co = [['acct-0000', 'M0', 1], ['acct-1000', 'M1', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: co[0][0], o: 'M0', ew: 0, rh: 0, seed: 7, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  const now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, now), null);
  B.h = 3; B.sg = 'trial'; B.wk = now; B.cleared = 2;
  const out = [];
  egEnd(B, 'seal', now + 2000, out);
  const end = out.find((f) => f.k === 'end');
  assert.equal(end?.why, 'seal', 'the director ends at the seal');
  const said = validEgOut(end);
  assert.ok(said, 'the end frame is carried');
  assert.equal(said.why, 'seal');
  const st = validEgOut(egStateOf(B, now + 2000));
  assert.ok(st, 'the whole state is carried');
  assert.equal(st.end, 'seal', 'and says the seal');
  for (const f of out) assert.ok(validEgOut(f), `every frame of the end is carried (${f.k})`);
  // every end the room says is a receipt's why and a line the client says
  for (const why of EG_END_WORDS) {
    assert.ok(EG_END_WHYS.includes(why), `${why}: a receipt's why`);
    assert.equal(typeof EG_END_TEXT[why], 'string', `${why}: the client words it`);
  }
  for (const why of EG_OPEN_ENDS) assert.ok(EG_END_WORDS.includes(why), `${why}: an end that opens the Reliquaries is one the room can say`);
});
