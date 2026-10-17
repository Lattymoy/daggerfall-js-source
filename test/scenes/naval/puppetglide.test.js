// PUPPET-GLIDE (FIELD BUGS 2026-10-02d, Discord: "Ai ships move very janky and quick") - another player's ship was
// eased straight onto each of her stander's words (PUPPET_EASE) and run on from the moment the word ARRIVED, so a word a
// little late or early - a relay's 50-400 ms - moved the point she eased to by her way times the difference: a galley
// at 4 m/s was drawn at up to 10, lurching each word and stepping astern. At a steady latency she was smooth, which is
// all test/navalRoom.mjs had ever sent. Now, under way, she sails on at her word's way along her own heading and the gap
// is taken up at PUPPET_CATCH, capped (scenes/naval/navalHost.js). Two real hosts over the pool, a relay of their own that
// keeps the word's order (a socket's) and jitters its latency. Red on the record's code (42e50765).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea, freshPool } from '../../navalSea.mjs';
import { PUPPET_CATCH, PUPPET_CATCH_MPS, PUPPET_CATCH_SHARE, PREDICT_MAX_S } from '../../../src/scenes/naval/navalHost.js';

/** A stander `a` and a watcher `b`; `a`'s word every 0.2 s (FOES_MS), each `lo`..`hi` s late but never before the last. */
async function pair({ lo, hi, seed = 11 }) {
  const mk = async (id, i) => sea({ hull: null, settings: { ShipsAtSea: 'off' }, seed: 5 + i * 7919, pool: await freshPool(),
    online: { id: () => id, peers: () => [{ id: id === 'a' ? 'b' : 'a', feet: [0, 0, 0] }], sendHit: () => false } });
  const A = await mk('a', 0), B = await mk('b', 1);
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const queue = [];
  let t = 0, sent = -Infinity, last = 0;
  const tick = (dt) => {
    t += dt;
    A.host.frame(dt); B.host.frame(dt);
    if (t - sent >= 0.2) {
      sent = t;
      last = Math.max(last, t + lo + rnd() * (hi - lo));
      queue.push({ at: last, rec: JSON.stringify(A.host.word((p) => p)) });
    }
    while (queue.length && queue[0].at <= t) B.host.applyWord('a', JSON.parse(queue.shift().rec), (p) => p);
  };
  return { A, B, tick };
}
/** Her copy on `b` watched for `secs` at `dt`: the speed drawn each frame, the frames she moved astern, how far from her
 *  stander's own. */
function watch(p, seed, secs, dt) {
  const copy = () => [...p.B.host._sea.values()].find((e) => e.owner && e.ship.seed === seed);
  const own = [...p.A.host._sea.values()].find((e) => e.ship.seed === seed);
  const out = { drawn: [], astern: 0, off: [], truth: [], slip: [] };
  let prev = null, ownPrev = null;
  for (let i = 0; i < secs / dt; i++) {
    p.tick(dt);
    const c = copy();
    if (!c?.boat) continue;
    const pos = [...c.boat.GameObject.position];
    if (prev) {
      const dx = pos[0] - prev[0], dz = pos[2] - prev[2];
      out.drawn.push(Math.hypot(dx, dz) / dt);
      if (dx * Math.sin(c.ship.yaw) + dz * Math.cos(c.ship.yaw) < -1e-4) out.astern++;
      out.off.push(Math.hypot(pos[0] - own.ship.pos[0], pos[2] - own.ship.pos[2]));
      out.truth.push(own.ship.speed);
      out.slip.push(Math.abs(Math.hypot(dx, dz) - Math.hypot(own.ship.pos[0] - ownPrev[0], own.ship.pos[2] - ownPrev[2])) / dt);   // her copy's way against her own, frame by frame
    }
    prev = pos; ownPrev = [...own.ship.pos];
  }
  return out;
}
const pct = (a, k) => [...a].sort((x, y) => x - y)[Math.floor(k * (a.length - 1))];

test('PUPPET-GLIDE A JITTERED RELAY: a galley under way, her words 50-400 ms late in order, is drawn within a quarter of her way and never astern, and stays within 1.5 m of her stander\'s own - eased onto each word she was drawn at up to 2.5 times her way, astern every few seconds (mutants: eased as before, uncapped catch, no glide)', async () => {
  const p = await pair({ lo: 0.05, hi: 0.4 });
  const e = p.A.host._sea.get(p.A.host.spawnShip('merchantGalleon', { range: 300, bearing: 0.5 }));
  for (let i = 0; i < 15 / (1 / 30); i++) p.tick(1 / 30);   // under way, her copy stood
  const w = watch(p, e.ship.seed, 45, 1 / 30);
  const way = pct(w.truth, 0.5);
  assert.ok(way > 3, `under way (${way.toFixed(2)} m/s)`);
  assert.ok(Math.max(...w.drawn) <= way * 1.25, `drawn at ${Math.max(...w.drawn).toFixed(2)} m/s at most, her way ${way.toFixed(2)}`);
  assert.ok(pct(w.drawn, 0.05) >= way * 0.75, `and no slower than ${pct(w.drawn, 0.05).toFixed(2)} m/s but for a twentieth of frames`);
  assert.equal(w.astern, 0, 'never a step astern');
  assert.ok(Math.max(...w.off) < 1.5, `within ${Math.max(...w.off).toFixed(2)} m of her stander's`);
});

test('PUPPET-GLIDE A STEADY RELAY: at a steady 80 ms her copy makes her own way frame by frame to a twentieth of it and stands within half a metre of her stander\'s (the latency\'s own lag, no more) - the catch-up\'s law is the constants\' (mutant: the catch never taken)', async () => {
  const p = await pair({ lo: 0.08, hi: 0.08 });
  const e = p.A.host._sea.get(p.A.host.spawnShip('navyCutter', { range: 260, bearing: 2 }));
  for (let i = 0; i < 15 / (1 / 30); i++) p.tick(1 / 30);
  const w = watch(p, e.ship.seed, 30, 1 / 30);
  const way = pct(w.truth, 0.5);
  assert.ok(way > 3, `under way (${way.toFixed(2)} m/s)`);
  assert.ok(pct(w.slip, 0.99) <= way * 0.05, `her own way, frame by frame (${pct(w.slip, 0.99).toFixed(3)} m/s off at the 99th, her way ${way.toFixed(2)})`);
  assert.ok(pct(w.off, 0.5) < 0.5, `within ${pct(w.off, 0.5).toFixed(2)} m`);
  assert.ok(PUPPET_CATCH > 0 && PUPPET_CATCH_MPS > 0 && PUPPET_CATCH_SHARE > 0 && PUPPET_CATCH_SHARE < 0.5, 'a catch-up gentler than her way');
  assert.ok(PREDICT_MAX_S > 0.4, 'the glide outlasts a late word');
});

test('PUPPET-GLIDE A GAP TAKEN UP GENTLY: a copy found 10 m off her word (under PUPPET_SNAP_M - a stander\'s hitch, a course changed between words) closes it no faster than PUPPET_CATCH_MPS + PUPPET_CATCH_SHARE of her way over her own way, and closes it (mutants: the cap gone, the catch never taken)', async () => {
  const p = await pair({ lo: 0.08, hi: 0.08 });
  const e = p.A.host._sea.get(p.A.host.spawnShip('merchantGalleon', { range: 300, bearing: 0.5 }));
  for (let i = 0; i < 15 / (1 / 30); i++) p.tick(1 / 30);
  const c = [...p.B.host._sea.values()].find((x) => x.owner && x.ship.seed === e.ship.seed);
  const back = [-Math.sin(c.ship.yaw) * 10, -Math.cos(c.ship.yaw) * 10];
  c.ship.pos = [c.ship.pos[0] + back[0], c.ship.pos[1], c.ship.pos[2] + back[1]];
  c.boat.GameObject.position = [...c.ship.pos];
  const w = watch(p, e.ship.seed, 30, 1 / 30);
  const way = pct(w.truth, 0.5), cap = PUPPET_CATCH_MPS + PUPPET_CATCH_SHARE * way;
  assert.ok(Math.max(...w.slip) <= cap * 1.1 + 0.05, `taken up at ${Math.max(...w.slip).toFixed(2)} m/s over her way at most (the cap ${cap.toFixed(2)})`);
  assert.ok(Math.max(...w.slip.slice(0, 30)) >= cap * 0.5, 'and taken up from the first second');
  assert.ok(w.off.at(-1) < 1, `closed (${w.off.at(-1).toFixed(2)} m)`);
});
