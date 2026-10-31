// SHARED-HEALTH in a duel (bible/06-Systems/Integrity-Arc.md section 5, "Decisions (2026-10-26, SHARED-HEALTH)"): the
// referee counts on the player's own health. Driven on the real relay Room (test/fakeRoom.mjs) refereeing the bout, its
// words projected by the wire's own laws into a real duel manager (net/duel/duelSession.js) and a real health mirror.
// Moved here from fb1019f_duelbar.test.js when the DUEL-BAR seam it shared that file with was retired.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../../fakeRoom.mjs';
import { createDuelManager } from '../../../src/net/duel/duelSession.js';
import { createRefereeHealthMirror } from '../../../src/net/siege/refereeHealthMirror.js';
import { validVitOut, validDuelData, validDuelRefOut } from '../../../src/net/wire.js';
import { ROYAL_RING, SIEGE_UNITS_PER_M } from '../../../src/net/siege/siegeRef.js';

const M = SIEGE_UNITS_PER_M;
const T = 1_800_000_000;
const P = (x) => ({ x: 1000 * M + x * M, y: 0, z: 1000 * M, yaw: 0, pitch: 0 });
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };

/**
 * A duel on the real relay: peer-0001 is a real duel manager - its frames said into the Room, the Room's frames to it
 * projected by the wire (validDuelData, validDuelRefOut), as net/online.js hands them on - and peer-0002 a bare socket
 * the test speaks for. `pump` carries both ways until the wire is quiet.
 */
async function withRelayDuel(fn) {
  const realNow = Date.now; let clock = T * 1000; Date.now = () => clock;
  const r = fakeRoom('world:3,12', { now: () => clock });
  const join = async (id, x) => { const ws = r.connect(); await r.hello(ws, id, P(x), { lv: 10, look: LOOK }); return ws; };
  const say = (ws, d) => r.raw(ws, JSON.stringify({ t: 'duel', data: d }));
  try {
    const a = await join('peer-0001', -2), b = await join('peer-0002', 2);
    const outbox = [];
    let read = 0;
    const mgr = createDuelManager({
      send: (d) => { outbox.push(d); return true; }, now: () => clock, selfId: () => 'peer-0001', near: () => true, can: () => null,
      ringFor: () => [1000 * M, 0, 1000 * M], reaches: () => true,
    });
    const pump = async () => {
      for (let moved = true; moved;) {
        moved = false;
        while (outbox.length) { moved = true; await say(a, outbox.shift()); }
        while (read < a.sent.length) {
          moved = true;
          const m = a.sent[read++];
          if (m.t === 'duel') { const d = validDuelData(m.data); if (d) mgr.onFrame(m.id, d, m.sub ?? null); }
          if (m.t === 'dref') { const g = validDuelRefOut(m); if (g) mgr.onRef(g); }
        }
      }
    };
    await fn({ mgr, a, b, say, pump, step: (ms) => { clock += ms; }, r, now: () => clock });
  } finally { Date.now = realNow; }
}
/** The bout set on the real relay: my ask, their yes, my start - answered by the Room's `bout`. */
async function boutSet({ mgr, b, say, pump }) {
  assert.deepEqual(mgr.request('peer-0002'), { ok: true });
  await pump();
  const s = b.sent.find((m) => m.t === 'duel' && m.data.k === 'ask').data.s;
  await say(b, { to: 'peer-0001', s, k: 'yes' });
  return s;
}

test('SHARED-HEALTH THE DUEL ON THE REAL RELAY: the bout asks both fighters for their health; my report anchors my count at my own share; a blow on me lands on my own health as its share; PVP-HEALTH: the pool is my real maximum; PVP-HEAL: a potion mid-duel heals a quarter of it at most; the bout over, my health stays where the fight left it (mutants: no ask at the bout; the blow unsaid to the struck; the heal uncapped)', () => withRelayDuel(async (w) => {
  const { a, b, say, pump, step, r, now } = w;
  const player = { health: 500, maxHealth: 1000 };   // a large health, so a fist's blow moves it by whole points
  const mirror = createRefereeHealthMirror({ read: () => player, write: (h) => { player.health = h; }, send: (rep) => { r.raw(a, JSON.stringify({ t: 'vit', ...rep })); return true; }, now });
  let read = 0;
  const vitPump = async () => {
    await pump();
    for (let moved = true; moved;) {
      moved = false;
      mirror.frame(true);
      await new Promise((done) => setImmediate(done));
      while (read < a.sent.length) { const g = validVitOut(a.sent[read++]); if (g) { moved = true; mirror.onVit(g); } }
    }
  };
  const s = await boutSet(w);
  await vitPump();
  assert.ok(a.sent.some((m) => m.t === 'vit' && m.k === 'ask'), 'the bout asks for my health');
  const anchored = a.sent.filter((m) => m.t === 'vit' && m.k === 'h').at(-1);
  assert.deepEqual([anchored.h, anchored.m], [500, 1000], 'my count anchored at my own half of my real 1,000');
  step(ROYAL_RING.countdownMs + 1);
  const wordsBefore = a.sent.filter((m) => m.t === 'vit' && m.k === 'h').length;
  await say(b, { to: 'peer-0001', s, k: 'strike', n: 1, by: 'melee', p: [P(2).x, 0, P(2).z], d: 999 });
  const told = a.sent.filter((m) => m.t === 'vit' && m.k === 'h').slice(wordsBefore);
  assert.equal(told.length, 1, 'the blow is said on my health at once - not first at my next report');
  assert.equal(told[0].n, anchored.n, 'a word of the referee\'s own, answering no new report');
  await vitPump();
  const hp = a.sent.filter((m) => m.t === 'dref' && m.k === 'hp').at(-1);
  assert.ok(hp.d > 0, 'a blow landed');
  assert.equal(player.health, 500 - hp.d, 'off my own health');
  assert.ok(player.health < 500);
  const after = player.health;
  // a potion mid-duel: a quarter of my whole, and my health pulled back to it
  step(1000);
  player.health = 1000;
  await vitPump();
  assert.equal(player.health, after + 250, 'PVP-HEAL: a quarter of the whole in the fight');
  await say(b, { to: 'peer-0001', s, k: 'end', why: 'yield' });
  await vitPump();
  assert.equal(player.health, after + 250, 'the bout over: my health is where the fight left it');
}));
