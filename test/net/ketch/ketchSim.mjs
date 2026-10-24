// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md sections 4-7): A VOYAGE SAILED IN A TEST - the director
// (net/ketch/ketchBrain.js) beaten on a fake clock with a crew standing where a test puts it: through the Watch, the
// Gallery, the Starved Engine fed, the bridge reached and the Tonal Warden felled. Its frames are the room's own, in
// order - the director's tests read the state, the page's tests fold the frames (net/ketch/ketchLink.js).
import assert from 'node:assert/strict';
import { newVoyage, joinVoyage, stepVoyage, voyageWord, voyageStateOf, ktLeastMs, KT_BRIDGE_CRADLE0, KT_RESONATOR0, KT_SAILWALK_LEAST_MS } from '../../../src/net/ketch/ketchBrain.js';
import { ketchRoomKey, ketchVoyageOf, KT_STAGE } from '../../../src/net/ketch/ketchLaw.js';
import { KT_CRADLES, KT_BRIDGE_CRADLES, KT_SOCKETS, KT_RESONATORS } from '../../../src/net/ketch/ketchDeck.js';
import { KW_ID, KW_FORK_ID0 } from '../../../src/net/ketch/ketchWarden.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { validKetchOut, KT_OUT_KINDS } from '../../../src/net/wire.js';

export const OWNER = '0123456789abcdef';
export const T0 = ketchVoyageOf(1).at + 60_000;
export const SHAFT = HIT_KINDS.Shaft;
export const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
/** A ship with `n` members at `lv`, aboard at T0. */
export function ship(n = 4, lv = 30) {
  const V = newVoyage(ketchRoomKey(1, OWNER), T0);
  for (let k = 0; k < n; k++) joinVoyage(V, `mem${k}`, `P${k}`, lv, T0);
  return V;
}
/** Every member standing at one spot (or each its own). */
export const all = (V, p) => Object.fromEntries(V.crew.map((s, k) => [s, typeof p === 'function' ? p(k) : [...p]]));
export const bodiesOf = (where) => Object.entries(where).map(([sub, p]) => ({ sub, x: p[0], y: p[1], z: p[2], dead: !!p[3] }));
export const poseOf = (p) => (p ? { x: p[0], y: p[1], z: p[2], dead: !!p[3] } : null);
/** Beat the ship every 250 ms from `from`, `act(now)` before each beat, until a frame `until` says. */
export function sail(V, from, where, { until = () => false, act = null, most = 600_000, rng = seeded(7) } = {}) {
  const out = [];
  for (let now = from; now <= from + most; now += 250) {
    const mark = out.length;
    if (act) for (const x of act(now, rng) ?? []) out.push({ now, ...x });
    for (const x of stepVoyage(V, now, bodiesOf(typeof where === 'function' ? where(now) : where), rng)) out.push({ now, ...x });
    for (let i = mark; i < out.length; i++) if (until(out[i])) return { out, now };
  }
  return { out, now: null };
}
/** Every member strikes the first risen construct standing on `floor` (a shaft: no reach to keep), from its spot. */
export const strikeFloor = (V, where, floor) => (now, rng) => {
  const out = [];
  for (const sub of V.crew) {
    const B = V.bodies.find((q) => q.floor === floor && q.h > 0 && now >= q.upAt);
    if (!B) break;
    out.push(...voyageWord(V, sub, { k: 'hit', o: B.id, d: 1e6, r: SHAFT, q: null }, poseOf(where[sub]), now, rng));
  }
  return out;
};
export const WAIST = [0, 0, 30], GALLERY = [0, -6, 100], HOLD_MID = [0, -12, 90];
/** Every frame the director says passes the wire's projection whole (the page reads nothing else). */
export function wireOk(frames) {
  for (const f of frames) {
    const { now: _n, to: _t, ...x } = f;
    const w = validKetchOut(x);
    assert.ok(w, `the wire drops a ${x.k}: ${JSON.stringify(x).slice(0, 300)}`);
    assert.ok(KT_OUT_KINDS.includes(x.k));
  }
}
/** The ship sailed through the Watch and the Gallery: the engine starving at the moment answered. */
export function toEngine(V, from = T0) {
  const w = all(V, WAIST);
  const a = sail(V, from, w, { act: strikeFloor(V, w, 'waist'), until: (f) => f.k === 'sg' && f.sg === KT_STAGE.gallery });
  assert.ok(a.now, 'the Watch broken');
  const g = all(V, GALLERY);
  const b = sail(V, a.now + 250, g, { act: strikeFloor(V, g, 'landing'), until: (f) => f.k === 'sg' && f.sg === KT_STAGE.engine });
  assert.ok(b.now, 'the Wardens down');
  return b.now;
}
/** A carried cell's least walk to a spot (the step law, AUDIT KETCH L1-7) - a sim's carrier waits it out. */
export const carried = (V, sub, spot) => { const c = V.cells.carry[sub]; return c ? Math.ceil(ktLeastMs(Math.hypot(spot[0] - c.x, spot[1] - c.z), true)) : 0; };
/** The engine fed by the crew from where it starves: each member in turn takes a cradle's cell and sets it. Answers
 *  `{ now, frames }` - every frame said while it was fed, each with its moment. */
export function feed(V, from) {
  let now = from, s = 0;
  const rng = seeded(3), frames = [];
  const said = (t, list) => { for (const x of list) frames.push({ now: t, ...x }); };
  while (V.cells.banked < V.cells.need) {
    const c = V.cells.cr.findIndex((q) => q.ready);
    if (c < 0) { said(now, stepVoyage(V, now, bodiesOf(all(V, HOLD_MID)), rng)); now += 250; continue; }
    const sub = V.crew[s++ % V.crew.length], cr = KT_CRADLES[c], k = V.cells.sk.findIndex((v) => !v), sk = KT_SOCKETS[k];
    said(now, voyageWord(V, sub, { k: 'pick', c }, poseOf([cr[0], -12, cr[1]]), now, rng));
    const walk = carried(V, sub, sk) + 100;
    said(now, stepVoyage(V, now, bodiesOf({ ...all(V, HOLD_MID), [sub]: [sk[0], -12, sk[1]] }), rng));
    said(now + walk, voyageWord(V, sub, { k: 'bank', s: k }, poseOf([sk[0], -12, sk[1]]), now + walk, rng));
    now += walk + 150;
  }
  said(now, stepVoyage(V, now, bodiesOf(all(V, HOLD_MID)), rng));
  return { now, frames };
}
/** The ship sailed to the bridge, its crew on the core. */
export function toBridge(n = 4) {
  const V = ship(n), t = toEngine(V), fed = feed(V, t);
  const core = all(V, (k) => [Math.sin(k) * 8, 0, 200 + Math.cos(k) * 8]);
  const b = sail(V, fed.now + Math.ceil(KT_SAILWALK_LEAST_MS), core, { most: 1000, until: (f) => f.k === 'sg' });
  return { V, now: b.now + 250, core };
}

/** The Tonal Warden fought from the moment the crew stands on the core to its fall: the Discord's resonators put right
 *  with the bridge's cells, the Last Note's forks broken. Answers `{ out, now }` (every frame, the `in`s' with them). */
export function fightWhole(V, t0, core, rng = seeded(9)) {
  const ins = V.crew.flatMap((s) => voyageWord(V, s, { k: 'in', lv: 30 }, poseOf(core[s]), t0, rng).map((x) => ({ now: t0, ...x })));
  const act = (now) => {
    const out = [], f = V.wf;
    if (!f) return out;
    if (f.ward) {
      for (const [j, sub] of [[0, V.crew[0]], [1, V.crew[1]]]) {
        const c = V.cells.carry[sub];
        if (!c && V.cells.br[j].ready) out.push(...voyageWord(V, sub, { k: 'pick', c: KT_BRIDGE_CRADLE0 + j }, poseOf([KT_BRIDGE_CRADLES[j][0], 0, KT_BRIDGE_CRADLES[j][1]]), now, rng));
        else if (c) { const open = f.rs.flatMap((v, i) => (v === 0 ? [i] : [])), k = j === 0 ? open[0] : open.at(-1), R = KT_RESONATORS[k]; if (now - c.at >= carried(V, sub, R)) out.push(...voyageWord(V, sub, { k: 'bank', s: KT_RESONATOR0 + k }, poseOf([R[0], 0, R[1]]), now, rng)); }
      }
      return out;
    }
    for (const sub of V.crew) {
      const X = f.fk, c = X ? X.c.findIndex((q) => q.h > 0) : -1;
      if (c >= 0 && now < X.at - 500) out.push(...voyageWord(V, sub, { k: 'hit', o: KW_FORK_ID0 + c, d: 1e6, r: SHAFT }, poseOf(core[sub]), now, rng));
      else out.push(...voyageWord(V, sub, { k: 'hit', o: KW_ID, d: 1e6, r: SHAFT }, poseOf(core[sub]), now, rng));
    }
    return out;
  };
  const run = sail(V, t0, core, { act, most: 14 * 60_000, until: (f) => f.k === 'fell' });
  return { out: [...ins, ...run.out], now: run.now };
}

/** A WHOLE VOYAGE for a crew of `n`: the ship as a page is first told it, then every frame the room says from the Watch to
 *  the Warden's fall, in order. Answers `{ V, frames, now }`. */
export function sailWhole(n = 4) {
  const V = ship(n), frames = [{ now: T0, ...voyageStateOf(V, T0) }];
  const w = all(V, WAIST);
  const a = sail(V, T0, w, { act: strikeFloor(V, w, 'waist'), until: (f) => f.k === 'sg' && f.sg === KT_STAGE.gallery });
  const g = all(V, GALLERY);
  const b = sail(V, a.now + 250, g, { act: strikeFloor(V, g, 'landing'), until: (f) => f.k === 'sg' && f.sg === KT_STAGE.engine });
  const fed = feed(V, b.now + 250);
  const core = all(V, (k) => [Math.sin(k) * 8, 0, 200 + Math.cos(k) * 8]);
  const c = sail(V, fed.now + Math.ceil(KT_SAILWALK_LEAST_MS), core, { most: 1000, until: (f) => f.k === 'sg' });
  const fight = fightWhole(V, c.now + 250, core);
  frames.push(...a.out, ...b.out, ...fed.frames, ...c.out, ...fight.out);
  return { V, frames, now: fight.now };
}
