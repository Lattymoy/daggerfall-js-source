// WILD1 (2026-10-07, bible/11-Multiplayer/Wild-Zone.md): THE OPEN ZONE'S FIGHTS AND A BODY'S ONE PIECE (net/wildFight.js),
// and THE ROOM'S REMAINS ON A PLAYER'S SIDE (net/wildRemains.js) - each over a fake wire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWildFight, WILD_BODY_MS } from '../src/net/wildFight.js';
import { createWildRemains, WILD_NO_STORE } from '../src/net/wildRemains.js';
import { validWildData } from '../src/net/wire.js';

const PA = 'peer-000a', PB = 'peer-000b';
/** Two fighters over a wire that projects every frame through the wire's own law, as the relay does - a directed frame
 *  reaches the other, a room's frame (INT9: a pick) the room alone. */
function pair({ fairA = () => true, fairB = () => true } = {}) {
  let t = 0;
  const log = { [PA]: [], [PB]: [] };
  const room = [];
  const queue = [];
  const bodies = [];
  const mk = (me, other, fair, extra) => createWildFight({
    send: (d, o) => { const v = validWildData(d); if (!v) return false; log[me].push(v); if (v.to) queue.push([other, me, v]); else room.push([me, v, o?.room ?? null]); return true; },
    now: () => t, can: () => true, fair, ...extra,
  });
  const a = mk(PA, PB, fairA, { onBody: (from, b) => bodies.push([from, b.s, b.items.length]) });
  const b = mk(PB, PA, fairB, {});
  const by = { [PA]: a, [PB]: b };
  const flush = () => { while (queue.length) { const [to, from, d] = queue.shift(); by[to].onFrame(from, d, `acct-${from}`); } };
  return { a, b, flush, room, bodies, step: (ms) => { t += ms; }, log: { a: log[PA], b: log[PB] } };
}
const blow = { by: 'melee', p: [1000, 2, 1000], d: 7 };

// PIN MOVED (INT9, 2026-10-09 - bible/06-Systems/Integrity-Arc.md lane 2): WILD1's defender resolved every blow on its
// own machine and answered with a `result`, and the last fair attacker whose blow landed was the killer for ten seconds.
// Now the relay referees the zone (net/wildRef.js): a blow goes out carrying the striker's rolled number for the referee,
// nothing at me is resolved, and a fall and its killer are the referee's word (test/int9_wild_ref.test.js).
test('WILD1 fight: a fair blow goes out numbered with the striker\'s rolled damage, for the referee; nothing at me is resolved or answered (INT9)', () => {
  const w = pair();
  assert.equal(w.a.blow(PB, 'strike', blow), 1);
  assert.deepEqual(w.log.a[0], { to: PB, k: 'strike', n: 1, by: 'melee', p: [1000, 2, 1000], d: 7 });
  w.flush();
  assert.equal(w.log.b.length, 0, 'no result: the defender resolves nothing');
  assert.equal(w.a.blow(PB, 'strike', blow), 2, 'numbered');
});

test('WILD1 fight: no blow out at a player who is not fair (my party, outside the zone)', () => {
  const w = pair({ fairA: () => false, fairB: () => false });
  assert.equal(w.a.blow(PB, 'strike', blow), 0);
  assert.equal(w.log.a.length, 0);
});

// PIN MOVED (INT9): WILD1's fallen took the picked piece out of its pack and GAVE it (`gave`) - a pick nobody answered was
// given up. Now the pick goes to the relay, in the room that refereed the fall, under the fall's id: the relay signs the
// fall with it, the service takes the piece off the fallen's record, and the remains hold it for the killer alone.
test('WILD1 fight: a body offers its worn pieces to its killer - only under a fall the referee called by its hand; ONE pick, to the room that refereed the fall (INT9), naming what the offer showed there (PIN MOVED, AUDIT INT9: `t`, `m` - the place alone was an index into a list the fallen built)', () => {
  const w = pair();
  w.b.offerWorn(PA, '0123456789ab', [{ group: 'Armor', templateIndex: 102 }]);
  w.flush();
  assert.equal(w.a.body(PB), null, 'no fall of mine called: no body');
  w.a.fell(PB, '0123456789ab', 'world:400,120');
  w.b.offerWorn(PA, 'ffffffffffff', [{ group: 'Armor', templateIndex: 102 }]);
  w.flush();
  assert.equal(w.a.body(PB), null, 'another fall\'s offer');
  w.b.offerWorn(PA, '0123456789ab', [{ group: 'Armor', templateIndex: 102 }, { group: 'Weapons', templateIndex: 120 }]);
  w.flush();
  assert.deepEqual(w.bodies, [[PB, '0123456789ab', 2]]);
  assert.equal(w.a.pick(PB, 2), false, 'an offer\'s place');
  assert.equal(w.a.pick(PB, 1), true);
  assert.equal(w.a.pick(PB, 0), false, 'one pick a body');
  assert.deepEqual(w.room, [[PA, { k: 'pick', r: '0123456789ab', w: 1, t: 120, m: 0 }, 'world:400,120']], 'to the room, never to the fallen');
});

test('WILD1 fight: a body\'s offer stands the referee\'s pick window, then goes (INT9)', () => {
  const w = pair();
  w.a.fell(PB, '0123456789ab', null);
  w.b.offerWorn(PA, '0123456789ab', [{ group: 'Armor', templateIndex: 102 }]);
  w.flush();
  assert.ok(w.a.body(PB));
  w.step(WILD_BODY_MS + 1);
  w.a.tick();
  assert.equal(w.a.body(PB), null);
  assert.equal(w.a.pick(PB, 0), false);
});

/** A pool as droppedLoot's: seeded piles, their items the very array a window moves records out of. */
function pool() {
  const piles = [];
  return {
    piles,
    seedPile: (items, feet) => { const p = { items, pos: feet, dead: false }; piles.push(p); return p; },
    removePile: (p) => { p.dead = true; piles.splice(piles.indexOf(p), 1); },
  };
}
const sameKind = (a, b) => a.group === b.group && a.templateIndex === b.templateIndex;

test('WILD1 remains: the room\'s word stands a pile that takes nothing; a take the window made is lifted back out and asked for, and the room\'s record given', () => {
  const sent = [], said = [];
  const pack = [];
  const p = pool();
  const book = createWildRemains({
    send: (d) => { sent.push(d); return true; },
    pool: () => p, toScene: (x) => x, mine: (rec) => rec.oid === 'me', pack: () => pack,
    mint: (list) => list.map((it) => ({ ...it })), addItem: (list, it) => { const h = list.find((x) => sameKind(x, it)); if (h) { h.stackCount = (h.stackCount ?? 1) + (it.stackCount ?? 1); return h; } list.push(it); return it; },
    stacksWith: sameKind, say: (l) => said.push(l), now: () => 0, nameOf: (it) => `#${it.templateIndex}`,
  });
  book.setRoom('world:25,7');
  book.setPool(p);
  book.onWord({ k: 'ri', r: 'rrrrrr01', p: [1, 2, 3], nm: 'Ria', os: null, oid: 'me', ttl: 600_000, off: 0, items: [{ group: 'Armor', templateIndex: 101 }, { group: 'Ingredients', templateIndex: 5, stackCount: 6 }], end: 1 });
  assert.equal(p.piles.length, 1);
  const pile = p.piles[0];
  assert.equal(pile.noStore, WILD_NO_STORE, 'nothing is put on remains');
  assert.equal(pile.label, 'Your remains', 'mine, named so');
  assert.deepEqual(book.mineHere().map((m) => m.r), ['rrrrrr01']);
  // the window takes the armour whole and two of the six ingredients (merged into a stack the pack already held)
  const armour = pile.items[0];
  pack.push({ group: 'Ingredients', templateIndex: 5, stackCount: 1 });
  pile.items.splice(0, 1); pack.push(armour);
  pile.items[0].stackCount = 4; pack[0].stackCount += 2;
  book.tick();
  assert.deepEqual(sent, [{ k: 'take', r: 'rrrrrr01', i: 0, n: 1 }, { k: 'take', r: 'rrrrrr01', i: 1, n: 2 }]);
  assert.deepEqual(pack, [{ group: 'Ingredients', templateIndex: 5, stackCount: 1 }], 'what the window moved is out again until the room gives it');
  book.onWord({ k: 'got', r: 'rrrrrr01', i: 0, it: { group: 'Armor', templateIndex: 101 } });
  book.onWord({ k: 'rm', r: 'rrrrrr01', i: 0, n: 1 });
  book.onWord({ k: 'no', r: 'rrrrrr01', i: 1 });
  assert.deepEqual(pack.map((x) => x.templateIndex), [5, 101], 'the won record arrives; the lost one never does');
  assert.ok(said.includes('Someone took that first.'));
  // another's take moves the pile in place, and the last record gone takes the pile
  book.onWord({ k: 'rm', r: 'rrrrrr01', i: 1, n: 4 });
  assert.equal(pile.dead, true);
});

test('WILD1 remains: an ask that never left puts the record back on the pile; a room change takes every pile', () => {
  const p = pool();
  const pack = [];
  const book = createWildRemains({
    send: () => false, pool: () => p, toScene: (x) => x, mine: () => false, pack: () => pack,
    mint: (list) => list.map((it) => ({ ...it })), addItem: (list, it) => list.push(it), stacksWith: sameKind, now: () => 0,
  });
  book.setRoom('world:25,7'); book.setPool(p);
  book.onWord({ k: 'ri', r: 'rrrrrr02', p: [0, 0, 0], nm: 'Ria', os: 'x', oid: 'y', ttl: 600_000, off: 0, items: [{ group: 'Armor', templateIndex: 101 }], end: 1 });
  const pile = p.piles[0];
  assert.equal(pile.label, "Ria's remains");
  const it = pile.items.pop(); pack.push(it);
  book.tick();
  assert.deepEqual(pile.items.map((x) => x.templateIndex), [101], 'back where it was');
  assert.deepEqual(pack, []);
  book.setRoom('world:26,7');
  assert.equal(p.piles.length, 0);
});

test('INT9 remains: the killer\'s piece is no pile of anyone\'s - the killer\'s own game asks for it the moment the room says the remains, once; another sees only the rest', () => {
  const mk = (me) => {
    const sent = [], p = pool(), pack = [];
    const book = createWildRemains({
      send: (d) => { sent.push(d); return true; }, pool: () => p, toScene: (x) => x, mine: () => false, pack: () => pack,
      mint: (list) => list.map((it) => ({ ...it })), addItem: (list, it) => list.push(it), stacksWith: sameKind, now: () => 0, me: () => me,
    });
    book.setRoom('world:25,7'); book.setPool(p);
    return { book, sent, p, pack };
  };
  const word = { k: 'ri', r: '0123456789ab', p: [0, 0, 0], nm: 'Ria', os: 'acct-ria', oid: 'peer-0001', ttl: 600_000, off: 0, items: [{ group: 'Weapons', templateIndex: 120 }, { group: 'Armor', templateIndex: 101 }], end: 1, wk: 'acct-bo', wi: 0 };
  const killer = mk('acct-bo'), other = mk('acct-cy');
  for (const x of [killer, other]) x.book.onWord(word);
  assert.deepEqual(killer.sent, [{ k: 'take', r: '0123456789ab', i: 0, n: 1 }], 'asked for at once');
  killer.book.onWord(word);
  assert.equal(killer.sent.length, 1, 'once');
  assert.deepEqual(other.sent, []);
  for (const x of [killer, other]) assert.deepEqual(x.p.piles[0].items.map((i) => i.templateIndex), [101], 'the pile is the rest');
  killer.book.onWord({ k: 'got', r: '0123456789ab', i: 0, it: { group: 'Weapons', templateIndex: 120 } });
  assert.deepEqual(killer.pack.map((i) => i.templateIndex), [120], 'the piece picked off the body, arrived');
  assert.equal(killer.book.has('0123456789ab'), true);
});
