// EG-FULL (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 8, 9, 13, 15, 16 and 21): THE
// SPIRE'S DIRECTOR, PLAYED (net/eliteGates/egBrain.js over net/eliteGates/egBodies.js, egLegion.js, egLords.js, egRun.js, egVestige.js) - a
// company walked and fought through the breach by an auto-player that stands where a player would (behind each body, on a
// Rampart's winch, on a Holdfast's relic, at an Orrery's stones), every frame the director says held to the wire's
// projection: six circles cleared, every lord fought to its fall, a fall that is a witness's with its recall and its
// Memento, the Redoubt's heal, offers, decrees and Ready, a forsaking.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egBreachNew, egEnter, egStep, egBlow, egDown, egWord, EG_RD_RECALL_MS, EG_RD_WINDOW_MS, egGeo } from '../../../src/net/eliteGates/egBrain.js';
import { egHallOf, egCircleOfHall, egFirstHallOf, egBossOf, EG_SEALED_MS, EG_LORDS } from '../../../src/net/eliteGates/egLaw.js';
import { egGive8 } from '../../egGive8.mjs';   // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9): law 8's circles given
import { EG_OFFER_MAX, EG_VESTIGES, EG_MASTERIES } from '../../../src/net/eliteGates/egVestige.js';
import { egBossNo } from '../../../src/net/eliteGates/egLords.js';
import { validEgOut } from '../../../src/net/wire.js';

const T0 = 1_800_000_000_000;
/** The order-of-play solver for an Athenaeum's Orrery (net/superDungeon/sdBrain.js solveGear's back-substitution). */
/** Which lords' falls the frames said: the `efell`s' bodies, read off the bodies the frames stood (`ead`, `efs`). */
function lordsFelled(frames) {
  const bodies = new Map(), out = [];
  for (const f of frames) {
    if (f.k === 'efs') bodies.clear();   // a fight's numbers are its own
    for (const t of f.k === 'ead' ? f.a : f.k === 'efs' ? f.b : []) bodies.set(t[0], t);
    if (f.k === 'efell') { const t = bodies.get(f.i); if (t && t[1] === 0) out.push(t[2]); }
  }
  return out;
}
function solve(o, st) {
  const t = Array(o.order.length).fill(0);
  for (let p = o.order.length - 1; p >= 0; p--) { const j = o.order[p]; let have = st[j]; for (let q = p + 1; q < o.order.length; q++) have += t[o.order[q]] * o.gear[o.order[q]][j]; t[j] = ((o.truth[j] - have) % 12 + 12) % 12; }
  return t;
}

/**
 * A breach opened for `n` members on `seed`, admitted, and played: `until(B, frames)` stops it; `start` begins at that
 * hall's arrival; `hook(B, now, pos, act)` runs every beat (act(sub, frame) says a member's word). Answers the record, the
 * frames (each held to validEgOut - `bad` counts the refused) and the clock.
 */
function play({ n = 3, seed = 12345, start = 0, until = () => false, hook = null, maxMs = 4 * 3600_000, own = [] } = {}) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  const pos = {};
  for (const [sub] of co) { assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null); pos[sub] = { sx: 0, z: 0 }; }
  if (start > 1) { B.h = start; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000; }
  const frames = [];
  let bad = 0;
  const take = (list) => { for (const f of list) { const { to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); if (!v) bad++; frames.push({ ...rest, ...(to ? { to } : {}) }); } };
  const act = (sub, m) => take(egWord(B, sub, m, pos[sub], now, rng));
  while (now < T0 + maxMs && !B.end && !until(B, frames)) {
    now += 250;
    const spec = B.h > 0 ? egHallOf(B.seed, B.h, egGeo(B), B.egv) : null;   // EG-PERFECT (PIN MOVED): the hall the relay lays - its span decrees' ground (egGeo), never ground 0
    const F = B.F;
    for (const [sub, m] of Object.entries(B.mem)) {
      if (!m.alive || !spec) continue;
      const p = pos[sub], x0 = spec.x0;
      const live = F ? F.bodies.filter((b) => b.hp > 0 && !(b.fl & (2 | 16 | 128))) : [];
      const tgt = live.filter((b) => b.role === 1)[0] ?? live.sort((a, b) => Math.hypot(a.x - (p.sx - x0), a.z - p.z) - Math.hypot(b.x - (p.sx - x0), b.z - p.z))[0];
      if (B.sg === 'arrive' || B.sg === 'wait') { p.sx = x0 + spec.arrive.x + (m.n - 1) * 0.5; p.z = spec.arrive.z; }
      else if (B.sg === 'trial') {
        if (spec.kind === 'span' || spec.kind === 'brink' || (spec.kind === 'deepway' && F?.chamberDone)) { p.sx = x0 + spec.end.x; p.z = spec.end.z; }
        else if (spec.kind === 'rampart' && spec.variant === 'winch') { const w = spec.spots.winch[(m.n - 1) % 2]; p.sx = x0 + w.x; p.z = w.z; }
        else if (spec.kind === 'rampart' && spec.variant === 'gauntlet') { const g = (F?.gauntlet ?? []).find((q) => !q.done); if (g) { p.sx = x0 + g.p.plate[0]; p.z = g.p.plate[1]; } }
        else if (spec.kind === 'yard' && spec.variant === 'holdfast') { const r = spec.spots.relic[0]; p.sx = x0 + r.x + (m.n - 1) * 0.3; p.z = r.z; }
        else if (spec.kind === 'deepway' && F?.chamber === 2) { const e = spec.spots.engine[0]; p.sx = x0 + e.x; p.z = e.z; }
        else if (spec.kind === 'court' && F && !F.bodies.some((b) => b.role === 0 && b.up2)) { p.sx = x0 + spec.ring.x; p.z = spec.ring.z; }
        else if (tgt) { const yw = tgt.yaw ?? 0, sd = m.n % 2 ? 1 : -1; p.sx = x0 + tgt.x - Math.sin(yw) * 1.5 + sd * 0.3; p.z = tgt.z - Math.cos(yw) * 1.5; }
      } else if (B.sg === 'closing') { p.sx = x0 + spec.end.x; p.z = spec.end.z; }
    }
    hook?.(B, now, pos, act);
    take(egStep(B, now, Object.entries(B.mem).filter(([, m]) => m.alive).map(([sub]) => ({ sub, sx: pos[sub].sx, z: pos[sub].z, dead: false, at: now })), rng));
    for (const [sub, m] of Object.entries(B.mem)) {
      if (!m.alive) continue;
      const p = pos[sub];
      if (B.sg === 'trial' && B.F) {
        const sp = egHallOf(B.seed, B.h, egGeo(B), B.egv);
        const live = B.F.bodies.filter((b) => b.hp > 0 && !(b.fl & (2 | 16 | 128)));
        const tgt = live.filter((b) => b.role === 1)[0] ?? live.sort((a, b) => Math.hypot(a.x - (p.sx - sp.x0), a.z - p.z) - Math.hypot(b.x - (p.sx - sp.x0), b.z - p.z))[0];
        if (tgt) take(egBlow(B, sub, { k: 'hit', i: tgt.i, q: Math.floor(now / 250), d: 200, r: 1 }, { sx: p.sx, z: p.z }, now));
        if (sp.kind === 'athenaeum' && B.F.orrery && !B.F.lock.ok) {
          const sol = solve(B.F.orrery, B.F.lock.st), i = sol.findIndex((t) => t !== 0);
          const stone = i >= 0 && B.F.bodies.find((b) => b.t === 'stone' && b.pt === i);
          if (stone) { p.sx = sp.x0 + stone.x; p.z = stone.z + 1; act(sub, { k: 'pz', i, a: sol[i] <= 6 ? 1 : -1 }); }
        }
      }
      if (B.sg === 'closing') egDown(B, sub, B.h, { sx: p.sx, z: p.z }, now);
      if (B.sg === 'rest' && !own.includes(sub)) {
        if (m.offer?.length) act(sub, { k: 'pick', v: m.offer[0] });
        for (const a of B.asks ?? []) if (!(sub in a.v)) act(sub, { k: 'vote', q: a.q, y: a.q === 'ready' ? 1 : 0 });
      }
    }
  }
  return { B, frames, bad, now: () => now };
}

test('EG-FULL A BREACH PLAYED THROUGH SIX CIRCLES: a company of three walked and fought from the first hall through thirty - every kind of hall stood and passed, every Court\'s lord felled (its fall said by name), six Redoubts taken with their offers and the company\'s word, the count still running; every frame the director says passes the wire (mutants: a hall that never closes; a frame the wire refuses; a Court with no lord)', () => {
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): the six circles given at spec law 8 (test/egGive8.mjs) - the company
  // walks each hall's line from its plate to its door, law 8's; a LAW 9 hall is walked along its route (THE ROUTE'S PROOFS' sweep)
  egGive8(12345, [1, 2, 3, 4, 5, 6]);
  const { B, frames, bad } = play({ n: 3, seed: 12345, until: (b) => b.h > 30 });
  assert.equal(bad, 0, 'every frame passes the wire');
  assert.equal(B.end, null);
  assert.ok(B.h > 30 && B.rd >= 6, `reached hall ${B.h}, Redoubt ${B.rd}`);
  const kinds = new Set(Array.from({ length: 30 }, (_, i) => egHallOf(12345, i + 1, 0).kind));
  for (const k of ['yard', 'span', 'proving', 'rampart', 'court', 'brink']) assert.ok(kinds.has(k), `a ${k} stood`);
  const fells = lordsFelled(frames);
  for (let c = 1; c <= 6; c++) assert.ok(fells.includes(egBossNo(egBossOf(12345, c))), `circle ${c}'s ${egBossOf(12345, c)} said fallen`);
  assert.ok(frames.filter((f) => f.k === 'efell').every((f) => ['M0', 'M1', 'M2'].includes(f.n)), 'its fall names who felled it');
  for (const k of ['efs', 'ead', 'eb', 'ehp', 'edie', 'rd', 'offer', 'ask', 'tally', 'eheal']) assert.ok(frames.some((f) => f.k === k), `a ${k} said`);
  const offers = frames.filter((f) => f.k === 'offer');
  assert.ok(offers.every((f) => typeof f.to === 'string'), 'an offer is its member\'s alone');
  for (const m of Object.values(B.mem)) assert.ok((m.vs ?? []).length + (m.mast >= 0 ? 1 : 0) >= 5, 'a Vestige picked at each Redoubt');
});

test('EG-FULL EVERY LORD TO ITS FALL (section 13.3): each of the thirteen lords, met at its own Court, fought by a company of three standing where players would - its errands, phases and fury run, its fall said and the Court a Redoubt (mutants: a lord that cannot fall; a lord\'s blow the wire refuses)', () => {
  const found = {};
  for (const seed of [77, 5, 0xbeef, 12345, 4242, 99, 31337]) for (let c = 1; c <= 30; c++) { const L = egBossOf(seed, c); found[L] ??= { seed, c }; }
  for (const key of Object.keys(EG_LORDS)) {
    const at = found[key];
    assert.ok(at, `${key} met`);
    const h = egFirstHallOf(at.c) + 4;
    const { B, frames, bad } = play({ n: 3, seed: at.seed, start: h, until: (b) => b.sg === 'rest' || b.h !== h, maxMs: 40 * 60_000 });
    assert.equal(bad, 0, `${key}: every frame passes the wire`);
    assert.equal(B.sg, 'rest', `${key} fell (stage ${B.sg} at hall ${B.h})`);
    assert.ok(lordsFelled(frames).includes(egBossNo(key)), `${key}'s fall said`);
    assert.ok(frames.some((f) => f.k === 'eb'), `${key} threw blows`);
  }
});

test('EG-FULL THE FALL, THE MEMENTO AND THE RECALL (section 16.5): a member\'s own word says their fall - not final while their recall is in hand, a Memento laid where they fell, the company\'s row a witness; a witness strikes nothing and pings as one; the next Redoubt calls them back whole (`rise`, to them alone) at the cost of their newest Vestige; a second fall is final, its end receipt owed (mutants: a witness\'s blow landing; no recall; the second fall forgiven)', () => {
  let fellAt = 0, struck = null, pinged = null;
  const { B, frames } = play({ n: 2, seed: 5, until: (b) => b.rd >= 2 && b.sg === 'trial', hook: (b, now, pos, act) => {
    const m1 = b.mem['acct-1'];
    if (!fellAt && b.sg === 'trial' && b.h === 2) { act('acct-1', { k: 'fell' }); fellAt = now; }
    // PIN MOVED (AUDIT EG IV, lane1 #3): a lord asleep takes no blow, so the struck body is one a living member's blow lands on -
    // never a champion still asleep in its court (before, the Proving Walk's sleeping Kynreeve was struck)
    const open = (x) => x.hp > 0 && !(x.fl & (2 | 16 | 128)) && !(x.role === 0 && !x.up2);
    if (fellAt && !m1.alive && struck === null && b.F?.bodies.some(open)) {
      // the witness stands where the living striker stands (behind the body, in reach) - only its fall can refuse the blow
      const t = b.F.bodies.find(open), hp = t.hp, sp = egHallOf(b.seed, b.h, 0);
      const at = { sx: sp.x0 + t.x - Math.sin(t.yaw ?? 0) * 1.5, z: t.z - Math.cos(t.yaw ?? 0) * 1.5 };
      egBlow(b, 'acct-1', { k: 'hit', i: t.i, q: 7_777, d: 500, r: 0 }, at, now);
      const witnessHp = t.hp;
      egBlow(b, 'acct-0', { k: 'hit', i: t.i, q: 7_778, d: 500, r: 0 }, at, now);
      struck = witnessHp === hp && t.hp < hp;   // the witness's blow nothing, the living one's from the same place landing
    }
    if (fellAt && !m1.alive && pinged === null) { act('acct-1', { k: 'ping', x: 1, z: 2, w: 0 }); pinged = 1; }
  } });
  const fall = frames.find((f) => f.k === 'fall' && f.s === 'acct-1');
  assert.ok(fall && fall.fin === 0, 'a fall with the recall in hand is not final');
  assert.equal(struck, true, 'a witness strikes nothing (a living member\'s blow from the same place lands)');
  assert.ok(frames.some((f) => f.k === 'eping' && f.s === 'acct-1' && f.wit === 1), 'a witness pings as one');
  const co = frames.find((f) => f.k === 'co' && f.co.some((r) => r[0] === 'acct-1' && r[6] === 1));
  assert.ok(co, 'the company\'s row says a witness');
  const rise = frames.find((f) => f.k === 'rise' && f.s === 'acct-1');
  assert.ok(rise && rise.to === 'acct-1' && rise.p === 1, 'the Redoubt calls them back whole, to them alone');
  assert.equal(B.mem['acct-1'].alive, 1);
  assert.equal(B.mem['acct-1'].recall, 0, 'the recall spent');
  // a second fall: final
  // PIN MOVED (AUDIT WORLD-EVENTS L1-4, raise before the fall): a death with a companion standing lies down first; given in
  // to (`yield`), it is the fall
  const out = [...egWord(B, 'acct-1', { k: 'fell' }, null, T0 + 9e6, () => 0.5), ...egWord(B, 'acct-1', { k: 'yield' }, null, T0 + 9e6, () => 0.5)];
  const f2 = out.find((f) => f.k === 'fall');
  assert.ok(f2 && f2.fin === 1, 'the second fall is final');
  assert.ok(B.owe.some((o) => o.sub === 'acct-1' && o.claims.q === 'x' && o.claims.why === 'fall'), 'its end receipt owed');
});

test('EG-FULL THE REDOUBT\'S CHOICES (section 16.2): the Court fallen, the recalls at EG_RD_RECALL_MS, then the window - the rest\'s heal, each living member\'s own offer (at most EG_OFFER_MAX distinct cards of the catalogue), the next circle\'s decrees asked by family, the Ready; a pick ranks a Vestige; a unanimous Ready ends the rest within three seconds; the next circle carries the decrees the company chose (mutants: an offer to the wrong member; a pick of a card not offered; the Ready ignored)', () => {
  let rdAt = 0, picked = null, refused = null, readyAt = 0;
  const { B, frames } = play({ n: 2, seed: 77, own: ['acct-0'], until: (b) => b.rd >= 1 && b.sg !== 'rest' && readyAt > 0, hook: (b, now, pos, act) => {
    if (b.sg === 'rest' && !rdAt) rdAt = b.rdAt;
    const m0 = b.mem['acct-0'];
    if (b.sg === 'rest' && m0.offer?.length && picked === null) {
      refused = egWord(b, 'acct-0', { k: 'pick', v: 150 }, null, now, () => 0.5).length === 0;
      const card = m0.offer[0];
      act('acct-0', { k: 'pick', v: card });
      picked = card;
    }
    if (b.sg === 'rest') for (const a of b.asks ?? []) if (!('acct-0' in a.v)) act('acct-0', { k: 'vote', q: a.q, y: a.q === 'ready' ? 1 : 0 });
    if (b.sg === 'rest' && b.asks?.some((a) => a.q === 'ready') && !readyAt) readyAt = now;
  } });
  assert.ok(rdAt > 0, 'a Redoubt taken');
  const heal = frames.find((f) => f.k === 'eheal' && f.why === 'rest');
  assert.ok(heal && heal.p === 1, 'the rest heals whole');
  const offers = frames.filter((f) => f.k === 'offer' && f.v.length);
  assert.ok(offers.some((f) => f.to === 'acct-0') && offers.some((f) => f.to === 'acct-1'), 'each member\'s own offer');
  const ids = new Set([...EG_VESTIGES.map((v) => v.id), ...EG_MASTERIES.map((v) => v.id)]);
  for (const o of offers) { assert.ok(o.v.length <= EG_OFFER_MAX + 1); assert.equal(new Set(o.v).size, o.v.length); for (const c of o.v) assert.ok(ids.has(c), `card ${c}`); }
  assert.equal(refused, true, 'a card not offered is not taken');
  assert.ok(picked != null && ((B.mem['acct-0'].vs ?? []).some((p) => p[0] === picked) || B.mem['acct-0'].mast === picked), 'the pick ranks it');
  const decs = frames.filter((f) => f.k === 'ask' && f.q.startsWith('dec:'));
  assert.ok(decs.length >= 1, 'the next circle\'s decrees asked');
  assert.ok(frames.some((f) => f.k === 'esay' && f.w === 'ready'), 'the Ready said');
  assert.equal(egCircleOfHall(B.h), 2, 'into the second circle');
  // PIN MOVED (AUDIT EG V, a1: L2-1 - `Array.isArray(B.dc)` held while every circle bore no decree the company chose; the
  // company voted each family's first, and the second circle bears exactly those)
  assert.deepEqual(B.dc, decs.map((f) => [f.o[0], 1]), 'the next circle carries the decrees the company chose');
  void EG_RD_RECALL_MS; void EG_RD_WINDOW_MS;
});

test('EG-FULL FORSAKING (section 16.5): only a witness may forsake - their recall forfeit, their Memento gone, their row forsaken, their end receipt owed (why forsake); a living member\'s forsake is nothing (mutants: a living member forsaking; a forsaken member recalled)', () => {
  let done = false;
  const { B, frames } = play({ n: 2, seed: 99, until: () => done, hook: (b, now, pos, act) => {
    if (b.sg !== 'trial' || b.h !== 2 || done) return;
    act('acct-0', { k: 'forsake' });
    assert.equal(b.mem['acct-0'].forsaken, 0, 'the living do not forsake');
    act('acct-1', { k: 'fell' });
    act('acct-1', { k: 'forsake' });
    done = true;
  } });
  const m = B.mem['acct-1'];
  assert.deepEqual([m.forsaken, m.recall, m.alive], [1, 0, 0]);
  assert.ok(!B.mementos.some((q) => q.s === 'acct-1'), 'the Memento gone');
  assert.ok(frames.some((f) => f.k === 'co' && f.co.some((r) => r[0] === 'acct-1' && r[7] === 1)), 'the row says forsaken');
  assert.ok(B.owe.some((o) => o.sub === 'acct-1' && o.claims.why === 'forsake'));
});
