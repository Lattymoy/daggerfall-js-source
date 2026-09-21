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

// LOOT-DUP (2026-09-15, AUDIT ONCRASH1's own finding): AND EVERY FRAME LEARNS ITS OWN FATE.
//
// The boolean this door returns is the QUEUE's news. With anything already waiting it answers `flush` - true when
// some OTHER blow went - and a frame that is merely queued answers false although it usually leaves a frame later.
// `grantCorpse` read that as its own frame's answer and emptied a corpse with it, so a queued-then-delivered grant
// filled the taker's pack while the body kept the same list, and the next peer to ask was granted the same loot
// again. These pins drive the contract that replaces it: exactly one of `sent`/`dropped`, exactly once, whenever
// THAT frame's story really ends.
test('LOOT-DUP: a queued frame reports SENT when it itself leaves - not when the queue drains around it (mutant: the old boolean, which says false for a frame that is about to go)', () => {
  let open = false, at = 0;
  const sent = [];
  const pend = makeHitPend({ send: (h) => { if (!open) return false; sent.push(h); return true; }, room: () => 'r', now: () => at, warn: () => {} });
  const fates = [];
  const fate = (n) => ({ sent: () => fates.push(`sent:${n}`), dropped: () => fates.push(`drop:${n}`) });
  assert.equal(pend.send({ i: 1 }, fate(1)), false, 'the gate is shut: held');
  assert.deepEqual(fates, [], 'and NOTHING is said yet - the frame\'s story is not over');
  assert.equal(pend.send({ i: 2 }, fate(2)), false);
  assert.deepEqual(fates, []);
  open = true;
  pend.flush(at);
  assert.deepEqual(fates, ['sent:1', 'sent:2'], 'each frame says so as IT goes, in order');
  assert.deepEqual(sent, [{ i: 1 }, { i: 2 }]);
  // and a frame that goes at once says so at once
  fates.length = 0;
  assert.equal(pend.send({ i: 3 }, fate(3)), true);
  assert.deepEqual(fates, ['sent:3']);
});

test('LOOT-DUP: every way a frame can die reports DROPPED, exactly once - the eviction, the age, the room change, the bad shape, the pool going away (mutant: any one path settling nothing, which strands a reservation for ever)', () => {
  const fates = [];
  const fate = (n) => ({ sent: () => fates.push(`sent:${n}`), dropped: () => fates.push(`drop:${n}`) });
  // 1. the eviction: max held, the oldest goes
  {
    let at = 0;
    const pend = makeHitPend({ send: () => false, room: () => 'r', now: () => at, max: 2, warn: () => {} });
    pend.send({ i: 1 }, fate(1)); pend.send({ i: 2 }, fate(2)); pend.send({ i: 3 }, fate(3));
    assert.deepEqual(fates, ['drop:1'], 'the oldest is told, and only the oldest');
  }
  // 2. the age: the fight moved on
  {
    fates.length = 0;
    let at = 0;
    const pend = makeHitPend({ send: () => false, room: () => 'r', now: () => at, ms: 100, warn: () => {} });
    pend.send({ i: 1 }, fate(1));
    at = 500; pend.flush(at);
    assert.deepEqual(fates, ['drop:1']);
  }
  // 3. the room change: a blow minted elsewhere names nothing here
  {
    fates.length = 0;
    let room = 'r', at = 0;
    const pend = makeHitPend({ send: () => false, room: () => room, now: () => at, warn: () => {} });
    pend.send({ i: 1 }, fate(1));
    room = 'other';
    pend.send({ i: 2 }, fate(2));
    assert.ok(fates.includes('drop:1'), 'the old room\'s held frame is told');
  }
  // 4. no room at all
  {
    fates.length = 0;
    const pend = makeHitPend({ send: () => true, room: () => null, now: () => 0, warn: () => {} });
    assert.equal(pend.send({ i: 1 }, fate(1)), false);
    assert.deepEqual(fates, ['drop:1']);
  }
  // 5. a frame the door will not take at all
  {
    fates.length = 0;
    const pend = makeHitPend({ send: () => true, room: () => 'r', now: () => 0, warn: () => {} });
    assert.equal(pend.send(null, fate(1)), false);
    assert.equal(pend.send([1, 2], fate(2)), false);
    assert.deepEqual(fates, ['drop:1', 'drop:2'], 'a refusal is an ANSWER - silence is what stranded the corpse');
  }
  // 6. the pool going away hands back everything it was holding
  {
    fates.length = 0;
    const pend = makeHitPend({ send: () => false, room: () => 'r', now: () => 0, warn: () => {} });
    pend.send({ i: 1 }, fate(1)); pend.send({ i: 2 }, fate(2));
    pend.clear();
    assert.deepEqual(fates, ['drop:1', 'drop:2']);
    assert.equal(pend.held, 0);
  }
});

test('LOOT-DUP: exactly ONE of the two, exactly once, on every path - and a fate that throws is the caller\'s problem, never the queue\'s (mutant: settle called twice, which would put a corpse\'s items back after they were granted)', () => {
  let open = false;
  const counts = new Map();
  const bump = (k) => counts.set(k, (counts.get(k) ?? 0) + 1);
  const pend = makeHitPend({ send: () => open, room: () => 'r', now: () => 0, warn: () => {} });
  for (let i = 0; i < 5; i++) pend.send({ i }, { sent: () => bump(`s${i}`), dropped: () => bump(`d${i}`) });
  open = true;
  pend.flush(0);
  pend.flush(0);
  pend.clear();
  for (let i = 0; i < 5; i++) {
    assert.equal(counts.get(`s${i}`), 1, `frame ${i} said sent once`);
    assert.equal(counts.get(`d${i}`), undefined, `frame ${i} never also said dropped`);
  }
  // a throwing fate does not take the queue with it
  const warned = [];
  const p2 = makeHitPend({ send: () => true, room: () => 'r', now: () => 0, warn: (l) => warned.push(l) });
  assert.doesNotThrow(() => p2.send({ i: 9 }, { sent: () => { throw new Error('the caller threw'); } }));
  assert.equal(warned.length, 1);
  assert.match(warned[0], /send handler threw/);
  assert.equal(p2.send({ i: 10 }), true, 'and the door still works');
});

test('LOOT-DUP: a fate that sends ANOTHER blow from inside its own handler does not double-settle or reorder the queue - the corpse arms are exactly this shape (a grant whose drop puts items back, which a later ask sends again)', () => {
  let open = true, at = 0;
  const wire = [];
  const fates = [];
  const pend = makeHitPend({ send: (h) => { if (!open) return false; wire.push(h.i); return true; }, room: () => 'r', now: () => at, warn: () => {} });
  const counts = new Map();
  const bump = (k) => counts.set(k, (counts.get(k) ?? 0) + 1);
  open = false;
  pend.send({ i: 1 }, { sent: () => { bump('s1'); fates.push('s1'); pend.send({ i: 99 }, { sent: () => bump('s99'), dropped: () => bump('d99') }); }, dropped: () => bump('d1') });
  pend.send({ i: 2 }, { sent: () => { bump('s2'); fates.push('s2'); }, dropped: () => bump('d2') });
  open = true;
  pend.flush(at);
  pend.flush(at);
  assert.equal(counts.get('s1'), 1, 'frame 1 settled once, though its handler re-entered the door');
  assert.equal(counts.get('s2'), 1);
  assert.equal(counts.get('s99'), 1, 'and the blow it sent from inside went too');
  assert.equal(counts.get('d1'), undefined); assert.equal(counts.get('d2'), undefined); assert.equal(counts.get('d99'), undefined);
  assert.deepEqual(fates, ['s1', 's2'], 'order kept: one foe cannot overtake another because another re-entered');
  assert.equal(pend.held, 0);
  assert.deepEqual(wire, [1, 2, 99], 'and it goes BEHIND what was already waiting - this module\'s own order law holds through a re-entrant send');
});
