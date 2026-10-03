// ARENA4b (2026-10-03, the coordinator's note on the client stream's pennants: a rival's and a watched fighter's banner
// are read off the relay's bills - `go.vs.b`, the hall's live list `a.b` / `b.b` - and the relay never sent one): THE
// RELAY BILLS EACH FIGHTER'S BANNER. The token signs no banner, so the fighter's own word claims it (net/arenaLaw.js
// bannerClaim - 'red', 'blue' or none; anything else dropped, never a refusal): the queue's `q` and a ladder bout's
// `in`. It is cosmetic only - a banner's points are the account service's, counted off its own arena_members row. The
// hall bills it to the rival and on the list to watch (server/src/index.js `_bill`), the bout's room carries it on its
// fighters to its own list entry (net/arenaBrain.js liveEntry), and the hour's exhibition bills its sides Red and Blue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRooms } from './fakeRoom.mjs';
import {
  ARENA_HALL, arenaBoutRoom, bannerClaim, ARENA_BANNERS, ARENA_EX_BANNERS, validArenaIn, validArenaOut, ARENA_FLOOR_CENTRE,
} from '../src/net/arenaLaw.js';
import { openBout, liveEntry } from '../src/net/arenaBrain.js';
import { exhibitionFor, exhibitionBoutId } from '../src/net/arenaExhibition.js';
import { createArenaOnline } from '../src/scenes/arenaOnline.js';
import { arenaLadderOf } from '../src/net/arenaLaw.js';
import { fighterIdentity } from '../src/systems/arenaFighters.js';

const C = ARENA_FLOOR_CENTRE;
const arena = (ws) => ws.sent.filter((m) => m.t === 'arena');
const last = (ws, k) => arena(ws).filter((m) => m.k === k).at(-1) ?? null;
const word = (r, ws, w) => r.raw(ws, JSON.stringify({ t: 'arena', ...w }));
async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try { return await fn({ step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}

test('ARENA4b the banner on the wire: the queue\'s word and a ladder fighter\'s `in` claim a banner - red or blue; anything else is dropped, never a refusal; a bill carries it; the hour\'s exhibition is billed by banner alone (mutants: an unknown banner believed; the queue\'s banner dropped; the ladder `in`\'s banner dropped; the exhibition\'s bills dropped)', () => {
  assert.deepEqual(ARENA_BANNERS, ['red', 'blue']);
  assert.deepEqual(ARENA_EX_BANNERS, ['red', 'blue'], 'the exhibition\'s side 0 the Red\'s, side 1 the Blue\'s');
  assert.equal(bannerClaim('red'), 'red');
  assert.equal(bannerClaim('blue'), 'blue');
  for (const b of ['green', 'RED', '', 1, null, undefined, {}]) assert.equal(bannerClaim(b), null, `${String(b)} is no banner`);
  assert.deepEqual(validArenaIn({ k: 'q', lv: 9, b: 'red' }), { k: 'q', lv: 9, b: 'red' });
  assert.deepEqual(validArenaIn({ k: 'q', lv: 9, b: 'green' }), { k: 'q', lv: 9 }, 'an unknown banner dropped, the queue word kept');
  assert.deepEqual(validArenaIn({ k: 'in', r: 'f', tier: 0, bout: 1, lv: 3, b: 'blue' }), { k: 'in', r: 'f', tier: 0, bout: 1, lv: 3, b: 'blue' });
  assert.deepEqual(validArenaIn({ k: 'in', r: 'f', tier: 0, bout: 1, b: 'gold' }), { k: 'in', r: 'f', tier: 0, bout: 1 }, 'a fight is never refused over a pennant');
  assert.deepEqual(validArenaOut({ k: 'go', o: '0123456789abcdef', side: 1, vs: { n: 'Alva', r: 1000, b: 'red' } }).vs, { n: 'Alva', r: 1000, b: 'red' });
  const l = validArenaOut({ k: 'live', l: [{ o: '0123456789abcdef', kind: 'ex', h: 9000, a: { b: 'red' }, b: { b: 'blue' }, tier: 2, sp: 0, at: 1 }, { o: '0123456789abcde0', kind: 'ex', h: 9001, a: { b: 'teal' }, sp: 0, at: 1 }] }).l;
  assert.deepEqual([l[0].a, l[0].b], [{ b: 'red' }, { b: 'blue' }], 'the exhibition\'s sides by their banners');
  assert.equal(l[1].a, undefined, 'an unknown one dropped');
});

test('ARENA4b the relay bills each fighter\'s banner: two queued under their banners are offered and sent to their bout each billed with the other\'s, the bout on the list to watch with both; the bout\'s room carries them to its own entry; a ladder fighter billed by their `in`\'s; the hour\'s exhibition its Red and its Blue (mutants: the bill without the banner; the queue\'s claim not kept; the bout\'s fighters not carrying it, or carrying an unknown one; the live entry without it; the ladder `in`\'s not carried; the exhibition\'s sides unbilled)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const H = W.room(ARENA_HALL);
  const A = H.connect(), B = H.connect();
  await H.hello(A, 'peer-alva', null, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', ar: 1000 });
  await H.hello(B, 'peer-brann', null, { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann', ar: 1040 });
  await word(H, A, { k: 'q', lv: 9, b: 'red' });
  await word(H, B, { k: 'q', lv: 7, b: 'blue' });
  step(1000); await H.fire();
  const oa = last(A, 'of'), ob = last(B, 'of');
  assert.deepEqual(oa.vs, { n: 'Brann', r: 1040, b: 'blue' }, 'Alva is offered the Blue Banner\'s Brann');
  assert.deepEqual(ob.vs, { n: 'Alva', r: 1000, b: 'red' });
  await word(H, A, { k: 'y', o: oa.o });
  await word(H, B, { k: 'y', o: oa.o });
  assert.equal(last(A, 'go').vs.b, 'blue', 'the bout\'s word bills the rival\'s banner');
  assert.equal(last(B, 'go').vs.b, 'red');
  const o = last(A, 'go').o;   // AUDIT PRE-MERGE 1003 S7: the bout's room is the go's, never the offer's id
  await word(H, A, { k: 'ls' });
  const e = last(A, 'live').l.find((x) => x.o === o);
  assert.deepEqual([e.a.b, e.b.b], ['red', 'blue'], 'on the list to watch, both pennants');
  const R = W.room(arenaBoutRoom(o));
  const st = await R.room._boutOf();
  assert.deepEqual(st.f.map((f) => f.banner), ['red', 'blue'], 'the bout\'s room carries each fighter\'s banner');
  assert.deepEqual([liveEntry(st).a.b, liveEntry(st).b.b], ['red', 'blue'], 'and bills them on its own entry');
  // a ladder bout: its fighter's `in` claims the banner the list bills them under
  const L = W.room(arenaBoutRoom('00000000000000cd'));
  const p = L.connect();
  await L.hello(p, 'fight-ceryn', { x: C[0] - 6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Ceryn', kind: 'linked', tokenSub: 'acct-ceryn' });
  await word(L, p, { k: 'in', r: 'f', tier: 0, bout: 0, lv: 3, b: 'blue' });
  const lst = await L.room._boutOf();
  assert.equal(lst.f[0].banner, 'blue');
  await word(H, A, { k: 'ls' });
  assert.equal(last(A, 'live').l.find((x) => x.o === '00000000000000cd')?.a.b, 'blue', 'the ladder bout on the list under its fighter\'s banner');
  // a banner the relay does not know is billed as none
  const st2 = openBout({ o: '00000000000000ef', kind: 'pvp', f: [{ sub: 'a', name: 'Ash', lv: 1, rating: 1000, banner: 'green' }, { sub: 'b', name: 'Birch', lv: 1, rating: 1000 }], now: 0 });
  assert.deepEqual([liveEntry(st2).a.b, liveEntry(st2).b.b], [undefined, undefined]);
  // the hour's exhibition: its sides Red and Blue
  const ex = exhibitionFor(600 * 1440 + 12 * 60 + 2);
  const sx = openBout({ o: exhibitionBoutId(ex.hour), kind: 'ex', f: [], ex, now: 0 });
  assert.deepEqual([liveEntry(sx).a, liveEntry(sx).b], [{ b: 'red' }, { b: 'blue' }]);
}));

test('ARENA4b the client claims my banner: the queue word and a ladder bout\'s `in` carry the account\'s banner (the board\'s), none before the board, and none for a banner the realm does not know; the hall\'s exhibition named off its hour under the banners the relay bills its sides by (mutants: the queue\'s banner unsent; the ladder `in`\'s unsent; an unknown banner claimed; the relay\'s exhibition banners ignored)', async () => {
  const hallSent = [], boutSent = [], entered = [];
  const hallLink = { status: 'open', join() {}, leave() {}, sendArena: (w) => { hallSent.push(w); return true; } };
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: (w) => { boutSent.push(w); return true; } };
  let board = { me: { ladder: arenaLadderOf([]) } };
  const deps = { now: () => 0, session: () => session, makeHall: () => hallLink, bouts: { ask() {}, relayWord: () => true, exhibitionWord: () => true, dismiss() {}, holds: () => false, relay: () => null },
    account: { board: async () => ({ ok: true, data: board }), claim: async () => ({ ok: true, data: {} }), me: () => null }, enterFloor: (k, o) => { entered.push([k, o]); return true; }, level: () => 12,
    names: (seed) => (i, mob) => fighterIdentity(seed, i, mob) };
  const A = createArenaOnline(deps);
  A.model();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(A.act('queue').ok, true);
  assert.deepEqual(hallSent.at(-1), { k: 'q', lv: 12 }, 'no banner worn: none claimed');
  board = { me: { ladder: arenaLadderOf([]), banner: 'red' } };
  const B = createArenaOnline(deps);
  B.model();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(B.act('queue').ok, true);
  assert.deepEqual(hallSent.at(-1), { k: 'q', lv: 12, b: 'red' }, 'the account\'s banner on my queue word');
  board = { me: { ladder: arenaLadderOf([]), banner: 'purple' } };
  const D = createArenaOnline(deps);
  D.model();
  await new Promise((r) => setTimeout(r, 0));
  D.act('queue');
  assert.deepEqual(hallSent.at(-1), { k: 'q', lv: 12 }, 'a banner no banner of the realm: none claimed');
  board = { me: { ladder: arenaLadderOf([]), banner: 'red' } };
  hallSent.length = 0;
  const C2 = createArenaOnline(deps);
  C2.model();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(C2.fightLadder().ok, true);
  session.room = arenaBoutRoom(entered.at(-1)[1]);
  C2.tick();
  assert.deepEqual(boutSent.at(-1), { k: 'in', r: 'f', tier: 0, bout: 0, lv: 12, b: 'red' }, 'and on my ladder bout\'s `in`');
  // the exhibition on the list: the relay's banners kept (here billed the other way about), the names off the hour
  const ex = exhibitionFor(600 * 1440 + 12 * 60 + 2);
  hallLink.onArena({ k: 'live', l: [{ o: exhibitionBoutId(ex.hour), kind: 'ex', h: ex.hour, a: { b: 'blue' }, b: { b: 'red' }, tier: ex.tier, sp: 1, at: 1 }] });
  const e = C2.hall().live[0];
  assert.deepEqual([e.a.b, e.b.b], ['blue', 'red'], 'the relay\'s banners, not the screen\'s guess');
  assert.equal(e.a.n, fighterIdentity(ex.seed, 0, ex.opponents[0].mobile).name);
});
