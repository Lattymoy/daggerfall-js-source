// WILD1 (2026-10-07, bible/11-Multiplayer/Wild-Zone.md): THE OPEN ZONE'S FIGHTS AND A BODY'S ONE PIECE (net/wildFight.js),
// and THE ROOM'S REMAINS ON A PLAYER'S SIDE (net/wildRemains.js) - each over a fake wire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWildFight, WILD_PICK_WAIT_MS } from '../src/net/wildFight.js';
import { createWildRemains, WILD_NO_STORE } from '../src/net/wildRemains.js';
import { validWildData } from '../src/net/wire.js';

const PA = 'peer-000a', PB = 'peer-000b';
/** Two fighters over a wire that projects every frame through the wire's own law, as the relay does. */
function pair({ fairA = () => true, fairB = () => true } = {}) {
  let t = 0;
  const log = { [PA]: [], [PB]: [] };
  const mk = (me, other, fair, extra) => {
    const m = createWildFight({
      send: (d) => { const v = validWildData(d); if (!v) return false; log[me].push(v); queue.push([other, me, v]); return true; },
      now: () => t, can: () => true, fair, vitals: () => [40, 100], ...extra,
    });
    return m;
  };
  const queue = [];
  const hits = [];
  const got = [];
  const picked = [];
  const a = mk(PA, PB, fairA, { onResult: (d) => hits.push(['a', d.dmg]), onGot: (from, it) => got.push([from, it]), onNoGift: (from) => got.push([from, null]) });
  const b = mk(PB, PA, fairB, { onBlow: () => ({ hit: true, dmg: 7 }), onPicked: (peer, i) => picked.push([peer, i]) });
  const by = { [PA]: a, [PB]: b };
  const flush = () => { while (queue.length) { const [to, from, d] = queue.shift(); by[to].onFrame(from, d, `acct-${from}`); } };
  return { a, b, flush, hits, got, picked, step: (ms) => { t += ms; }, log: { a: log[PA], b: log[PB] } };
}
const A = { lv: 5, r: 1, st: [50, 50, 50, 50, 50, 50, 50, 50], sk: [40, 30, 20, 10], cf: [0, 0, 0], h: [80, 100] };
const blow = { by: 'melee', p: [1000, 2, 1000], a: A };

test('WILD1 fight: a fair blow is resolved by its defender and answered; the last fair attacker is the killer for ten seconds', () => {
  const w = pair();
  assert.equal(w.a.blow(PB, 'strike', blow), 1);
  w.flush();
  assert.deepEqual(w.hits, [['a', 7]], 'the defender\'s answer');
  assert.deepEqual(w.b.killer(), { id: PA, sub: `acct-${PA}` });
  w.step(10_001);
  assert.equal(w.b.killer(), null, 'past the credit window');
  // a replayed number is not a second blow
  w.b.onFrame(PA, { k: 'strike', to: PB, n: 1, ...blow });
  assert.equal(w.log.b.filter((d) => d.k === 'result').length, 1);
});

test('WILD1 fight: no blow out at a player who is not fair (my party, outside the zone), and none taken from one', () => {
  const w = pair({ fairA: () => false, fairB: () => false });
  assert.equal(w.a.blow(PB, 'strike', blow), 0);
  w.b.onFrame(PA, { k: 'strike', to: PB, n: 5, ...blow });
  assert.equal(w.log.b.length, 0, 'unread');
});

test('WILD1 fight: a body offers its worn pieces to its killer; ONE pick, answered with the piece - once', () => {
  const w = pair();
  w.b.offerWorn(PA, 'death0001', [{ group: 'Armor', templateIndex: 102 }, { group: 'Weapons', templateIndex: 120 }]);
  w.flush();
  assert.equal(w.a.body(PB).items.length, 2);
  assert.equal(w.a.pick(PB, 1), true);
  assert.equal(w.a.pick(PB, 0), false, 'one pick a body');
  w.flush();
  assert.deepEqual(w.picked, [[PA, 1]], 'the fallen hears the pick');
  assert.deepEqual(w.b.claim(), { to: PA, s: 'death0001', i: 1 });
  w.b.settleOffer({ group: 'Weapons', templateIndex: 120 });
  w.flush();
  assert.deepEqual(w.got, [[PB, { group: 'Weapons', templateIndex: 120 }]], 'the gift arrives');
  assert.equal(w.b.claim(), null);
});

test('WILD1 fight: a pick the fallen never answers is given up - the killer holds nothing it was not given', () => {
  const w = pair();
  w.b.offerWorn(PA, 'death0002', [{ group: 'Armor', templateIndex: 102 }]);
  w.flush();
  w.a.pick(PB, 0);
  w.step(WILD_PICK_WAIT_MS + 1);
  w.a.tick();
  assert.deepEqual(w.got, [[PB, null]]);
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
