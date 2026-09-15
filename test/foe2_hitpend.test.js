// AUDIT FOES FOE2 - A BLOW THE WIRE REFUSED MUST NOT BE LOST (2026-09-15,
// Mac relaying players: "during online play, certain enemies cant be damaged").
//
// The acts got this law at AUDIT WORLD3 A3 and the blow did not, and the blow
// needed it more: an act is a STATE, so a lost one reads wrong until someone
// touches the door again; a hit is a DELTA and the striker applies nothing
// locally. `damageFoe`'s non-authority arm hands the blow to the owner and
// RETURNS, so a refused frame is not a late blow - it is a blow that never
// happened, and the enemy just does not take damage.
//
// `sendHit` refuses on five conditions and BOTH sinks discarded the answer
// (`?? false`, never read). The commonest refusal is the rate gate, and it is
// not random: one swing emits ONE FRAME PER FOE IN REACH, in pool order,
// against HIT_HZ_MAX (10/s). Measured over the real swing timing, a Speed-100
// character among six foes offers 26 blows a second and lands 44 on the first
// two while the last three take TWO apiece - the same physical enemies starve
// every swing. That is "certain enemies cannot be damaged", in a fight with no
// network trouble at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHitPend } from '../src/net/hitPend.js';

/** A wire that takes `n` blows and then refuses, as the gate does. */
function wire({ room = 'dungeon:m187' } = {}) {
  const w = { sent: [], allow: Infinity, room, warned: [], t: 0 };
  w.pend = makeHitPend({
    send: (hit) => { if (w.sent.length >= w.allow) return false; w.sent.push(hit); return true; },
    room: () => w.room,
    now: () => w.t,
    warn: (l) => w.warned.push(l),
  });
  return w;
}

test('FOE2: a blow the wire refuses WAITS, and goes on a later frame - in the order it was struck', () => {
  const w = wire();
  w.allow = 2;
  for (const i of [1, 2, 3, 4, 5]) w.pend.send({ i, dmg: 3 });
  assert.deepEqual(w.sent.map((h) => h.i), [1, 2], 'the gate took two');
  assert.equal(w.pend.held, 3, 'and the other three are HELD, not lost - this is the whole finding');

  w.allow = 4; w.t = 100;
  assert.equal(w.pend.flush(), true, 'the next frame drains what it can');
  assert.deepEqual(w.sent.map((h) => h.i), [1, 2, 3, 4]);
  assert.equal(w.pend.held, 1);

  w.allow = Infinity; w.t = 200;
  w.pend.flush();
  assert.deepEqual(w.sent.map((h) => h.i), [1, 2, 3, 4, 5], 'every blow landed, none twice, in the order struck');
  assert.equal(w.pend.held, 0);
  assert.equal(w.pend.flush(), false, 'an empty queue is not a frame');
});

test('FOE2: a new blow goes BEHIND what is already waiting - one foe cannot overtake another', () => {
  const w = wire();
  w.allow = 0;
  w.pend.send({ i: 1, dmg: 3 });
  assert.equal(w.pend.held, 1);
  w.allow = 1;                       // room for exactly one
  w.pend.send({ i: 2, dmg: 3 });
  assert.deepEqual(w.sent.map((h) => h.i), [1], 'the OLDER blow took the slot, not the one just struck');
  assert.equal(w.pend.held, 1);
});

test('FOE2: the queue is BOUNDED both ways - a held blow that can never be sent is the live-lock, not the fix', () => {
  // by count: the oldest go, and it is said once
  const w = wire();
  w.allow = 0;
  for (let i = 0; i < 200; i++) w.pend.send({ i, dmg: 1 });
  assert.equal(w.pend.held, 64, 'at most `max` held');
  assert.equal(w.warned.length, 1, 'said once, not two hundred times');
  assert.match(w.warned[0], /more blows than the wire will carry/);
  w.allow = Infinity; w.t = 1;
  w.pend.flush();
  assert.deepEqual(w.sent.map((h) => h.i), Array.from({ length: 64 }, (_, n) => 136 + n), 'the newest 64 - the oldest were dropped');

  // by age: a blow from a fight that has moved on is not resurrected by a late reconnect
  const w2 = wire();
  w2.allow = 0;
  w2.pend.send({ i: 7, dmg: 3 });
  assert.equal(w2.pend.held, 1);
  w2.allow = Infinity;
  w2.t = 1999;
  w2.pend.flush();
  assert.deepEqual(w2.sent.map((h) => h.i), [7], 'inside the window it still lands');
  const w3 = wire();
  w3.allow = 0;
  w3.pend.send({ i: 7, dmg: 3 });
  w3.allow = Infinity;
  w3.t = 2001;
  assert.equal(w3.pend.flush(), false);
  assert.deepEqual(w3.sent, [], 'past it the blow is gone - an eight-second reconnect must not land a blow on a foe that died');
  assert.equal(w3.pend.held, 0, 'and it does not sit in the queue for ever');
});

test('FOE2: a blow minted in ANOTHER room names nothing here - the room change empties the queue', () => {
  const w = wire();
  w.allow = 0;
  w.pend.send({ i: 3, dmg: 3 });
  assert.equal(w.pend.held, 1);
  w.room = 'world:3,12';            // out of the dungeon: index 3 is another pool's now
  w.allow = Infinity;
  assert.equal(w.pend.flush(), false);
  assert.deepEqual(w.sent, [], 'the dungeon\'s blow did not follow me into the country');
  assert.equal(w.pend.held, 0);

  // ...and with no room at all (offline, between joins) nothing is held
  const w2 = wire();
  w2.allow = 0; w2.room = null;
  assert.equal(w2.pend.send({ i: 1, dmg: 3 }), false);
  assert.equal(w2.pend.held, 0);
});

test('FOE2: the door refuses what is not a blow, and holds nothing for it', () => {
  const w = wire();
  w.allow = 0;
  for (const bad of [null, undefined, 0, 'hit', [1, 2]]) assert.equal(w.pend.send(bad), false, `${JSON.stringify(bad)} is not a blow`);
  assert.equal(w.pend.held, 0);
});
