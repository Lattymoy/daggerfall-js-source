// EG-FULL, LAYER THREE (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 11.4, 11.10 and
// 13.3): THE FRAGMENTS' RELAY HALF (net/eliteGates/egBrain.js over net/eliteGates/egFragLaw.js) - an engine worked from within its reach and its
// cooldown kept, its blow told and landing on the legion; a false wall that falls to one blow and the alcove behind it,
// each member's once; THE FORK's High Road cache and Low Road niche, the Low Road's foes risen as it is taken, its closing
// waiting the roads' difference; the Clan Pit's Honour Horn, answered alone or fouled; a lord's page of the Annals at
// its first fall; the fragments' Lurkers dormant in the walls - every frame held to the wire's projection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egBreachNew, egEnter, egStep, egBlow, egWord, EG_HORN_FIRST_MS, EG_HORN_RING_M } from '../../../src/net/eliteGates/egBrain.js';
import { egHallOf, egFirstHallOf, EG_SEALED_MS, EG_CLOSING_SPAN_MS } from '../../../src/net/eliteGates/egLaw.js';
import { EG_ENGINES, EG_ENGINE_CD_MS, EG_ENGINE_TELL_MS, EG_NICHE_HEAL } from '../../../src/net/eliteGates/egFragLaw.js';
import { egAnnalsLordPage } from '../../../src/net/eliteGates/egAnnals.js';
import { EG_KIND } from '../../../src/net/eliteGates/egLegion.js';
import { EG_ROLE, EG_FL } from '../../../src/net/eliteGates/egBodies.js';
import { validEgIn, validEgOut, EG_SAY_KEYS } from '../../../src/net/wire.js';
import { EG_SAY } from '../../../src/scenes/eliteGates/egFight.js';

const T0 = 1_800_000_000_000;
/** The first hall (over seeds 1-400, circles 2-20) whose spec `want(spec)` takes. */
function findHall(want, circles = [2, 20]) {
  for (let seed = 1; seed <= 400; seed++) for (let c = circles[0]; c <= circles[1]; c++) for (let s = 1; s <= 5; s++) {
    const h = egFirstHallOf(c) + s - 1, spec = egHallOf(seed, h, 0);
    if (want(spec)) return { seed, h, spec };
  }
  throw new Error('no such hall');
}
/** A breach of `n` members standing on hall `h`'s arrival plate, stepped to its wake. Answers the record, the clock's
 *  holder, the poses, the frames (each held to validEgOut) and `step()`/`say()`. */
function at(seed, h, n = 2) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  const clock = { now: T0 + EG_SEALED_MS + 100 };
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, clock.now), null);
  B.h = h; B.sg = 'arrive'; B.wk = clock.now; B.cnt = { left: 1_800_000, at: clock.now }; B.pulledAt = clock.now; B.su = clock.now + 30_000;
  const spec = egHallOf(seed, h, 0), pos = {}, frames = [];
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + spec.arrive.x, z: spec.arrive.z };
  let bad = 0;
  const take = (list) => { for (const f of list) { const { to, ...rest } = f; if (!validEgOut(JSON.parse(JSON.stringify(rest)))) bad++; frames.push(f); } return list; };
  const step = (ms = 250) => { clock.now += ms; return take(egStep(B, clock.now, Object.entries(B.mem).filter(([, m]) => m.alive).map(([sub]) => ({ sub, sx: pos[sub].sx, z: pos[sub].z, dead: false, at: clock.now })), rng)); };
  const say = (sub, m) => take(egWord(B, sub, m, pos[sub], clock.now, rng));
  const put = (sub, x, z) => { pos[sub] = { sx: spec.x0 + x, z }; };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', 'the hall woke');
  return { B, spec, clock, pos, frames, step, say, put, bad: () => bad };
}

test('EG-FULL LAYER THREE AN ENGINE (section 11.10): worked from within 2 m it tells its blow 1.5 s - a member caught takes the place\'s 20% - and its landing takes its share from the adds caught; once in 30 s; from too far, nothing; the Shelf topples once; every frame the wire\'s (mutants: an engine worked from across the hall; the cooldown forgotten; the adds untouched)', () => {
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): an engine of the place's 20% - never a flood (the Sluice's blow is its
  // fire, `p` 0 - net/eliteGates/egBrain.js): the first such hall found was one before LAW 9's halls, and is the first whose engine is
  // no flood now
  const blows = (k) => EG_ENGINES[k].pct > 0 && !EG_ENGINES[k].once && !EG_ENGINES[k].flood;
  const { seed, h, spec } = findHall((q) => q.engines.some((e) => blows(e.kind)) && (q.kind === 'yard' || q.kind === 'proving'));
  const w = at(seed, h, 2), e = spec.engines.find((q) => blows(q.kind));
  for (let k = 0; k < 24; k++) w.step();   // a wave risen
  w.put('acct-0', e.x + 10, e.z);
  assert.equal(w.say('acct-0', { k: 'use', i: e.i }).length, 0, 'from 10 m - nothing');
  w.put('acct-0', e.x + 1, e.z);
  const out = w.say('acct-0', { k: 'use', i: e.i });
  const blow = out.find((f) => f.k === 'eb');
  assert.ok(out.some((f) => f.k === 'esay' && f.w === 'engine'), 'the engine worked, said');
  // the union floor may hold the blow a beat; the engine's own landing does not wait on it
  if (blow) { assert.equal(blow.wu, EG_ENGINE_TELL_MS); assert.ok(Math.abs(blow.p - 0.2) < 1e-9 && blow.o === 0, 'the place\'s 20%'); }
  assert.equal(w.say('acct-0', { k: 'use', i: e.i }).length, 0, 'once in 30 s');
  // an add stood in its blow loses its share at the landing
  const F = w.B.F, add = F.bodies.find((b) => b.role === EG_ROLE.add && !(b.fl & EG_FL.friend));
  const hit = w.B.F.engHits[0];
  assert.ok(hit, 'its blow waits to land');
  if (add) {
    const s0 = hit.s, [ax, az] = s0[0] === 'd' ? [s0[1], s0[2]] : [(s0[1] + s0[3]) / 2, (s0[2] + s0[4]) / 2];
    add.x = ax; add.z = az; add.mv = null; add.up = 0;
    const before = add.hp;
    for (let k = 0; k < 8; k++) w.step();
    assert.ok(add.hp < before - add.max * EG_ENGINES[e.kind].pct * 0.99 || !F.bodies.includes(add), `the add caught loses ${EG_ENGINES[e.kind].pct * 100}%`);
  } else assert.fail('a wave stands to be caught');
  assert.equal(w.B.F.engHits.length, 0, 'landed');
  w.clock.now += EG_ENGINE_CD_MS;
  const again = w.say('acct-0', { k: 'use', i: e.i });
  assert.ok(again.some((f) => f.k === 'esay' && f.w === 'engine'), 'worked again after its cooldown');
  // the Shelf topples once
  const sh = findHall((q) => q.engines.some((x) => x.kind === 'shelf') && q.kind !== 'court');
  const w2 = at(sh.seed, sh.h, 1), se = sh.spec.engines.find((x) => x.kind === 'shelf');
  w2.put('acct-0', se.x + 1, se.z);
  assert.ok(w2.say('acct-0', { k: 'use', i: se.i }).some((f) => f.k === 'esay' && f.w === 'engine'));
  w2.clock.now += EG_ENGINE_CD_MS + 1000;
  assert.equal(w2.say('acct-0', { k: 'use', i: se.i }).length, 0, 'the Shelf topples once');
  assert.equal(w.bad(), 0);
  assert.deepEqual(validEgIn({ k: 'use', i: 2 }), { k: 'use', i: 2 });
  assert.equal(validEgIn({ k: 'use', i: 9 }), null);
});

test('EG-FULL LAYER THREE THE ALCOVES (section 11.10): a seam alcove\'s false wall stands at the wake - one blow fells it, said; a member within reach then takes what it holds, once; before the wall falls, nothing; a page of the Annals said to its finder alone (mutants: an alcove open behind its wall; an alcove that gives twice)', () => {
  const { seed, h, spec } = findHall((q) => q.alcoves.some((a) => a.seal === 'seam') && q.kind !== 'court');
  const w = at(seed, h, 2), a = spec.alcoves.find((q) => q.seal === 'seam');
  const wall = w.B.F.bodies.find((b) => b.role === EG_ROLE.obj && b.alc === a.i);
  assert.ok(wall && wall.hp === 1, 'its false wall stands - one blow');
  w.put('acct-1', a.x, a.z);
  w.step();
  assert.ok(!w.frames.some((f) => f.k === 'egot' && f.to === 'acct-1'), 'nothing behind a standing wall');
  w.put('acct-0', a.x - Math.sign(a.x - spec.x0 + 0.001) * 1.2, a.z);
  const out = egBlow(w.B, 'acct-0', { k: 'hit', i: wall.i, q: 1, d: 50, r: 0 }, w.pos['acct-0'], w.clock.now);
  w.frames.push(...out);
  assert.ok(out.some((f) => f.k === 'esay' && f.w === 'seam'), 'the false wall falls, said');
  w.step();
  const got = w.frames.filter((f) => f.k === 'egot' && f.to === 'acct-1');
  assert.equal(got.length, 1, 'what it holds, once');
  assert.equal(got[0].w, a.holds === 'page' ? 'page' : a.holds);
  if (got[0].w === 'page') assert.ok(got[0].p >= 0 && got[0].p < 17, 'a found page');
  for (let k = 0; k < 4; k++) w.step();
  assert.equal(w.frames.filter((f) => f.k === 'egot' && f.to === 'acct-1').length, 1, 'never twice');
  assert.equal(w.bad(), 0);
  assert.deepEqual(validEgOut({ k: 'egot', w: 'page', p: 3 }), { k: 'egot', w: 'page', p: 3 });
  assert.equal(validEgOut({ k: 'egot', w: 'page', p: 30 }), null, 'a page past the thirty');
});

test('EG-FULL LAYER THREE THE FORK (section 11.4): the High Road\'s cache seals a Reliquary for each who touches it, once; the Low Road\'s niche heals its 15% once and gives a shard; the Low Road\'s foes rise as the first member takes it; a door opened from the High Road with a member still below waits the roads\' difference (mutants: the cache given twice; the niche heal to all; a closing that leaves the Low Road behind)', () => {
  const { seed, h, spec } = findHall((q) => !!q.fork && q.fork.lo > q.fork.hi + 1);
  const w = at(seed, h, 2), F = spec.fork, hc = spec.spots.hcache[0], ln = spec.spots.lniche[0];
  w.put('acct-0', hc.x, hc.z);
  w.step(); w.step();
  assert.equal(w.frames.filter((f) => f.k === 'egot' && f.to === 'acct-0' && f.w === 'rel').length, 1, 'the cache\'s Reliquary, once');
  assert.ok(w.frames.some((f) => f.k === 'esay' && f.w === 'hcache'));
  const before = w.B.F.bodies.filter((b) => b.role === EG_ROLE.add && b.k === EG_KIND.harrier).length;
  w.put('acct-1', ln.x, ln.z);
  w.step(); w.step();
  const heal = w.frames.filter((f) => f.k === 'eheal' && f.why === 'niche');
  assert.equal(heal.length, 1, 'the niche heals once');
  assert.equal(heal[0].to, 'acct-1', 'its member alone');
  assert.equal(heal[0].p, EG_NICHE_HEAL);
  assert.ok(w.frames.some((f) => f.k === 'egot' && f.to === 'acct-1' && f.w === 'shard'), 'and a shard');
  assert.ok(w.B.F.bodies.filter((b) => b.role === EG_ROLE.add && b.k === EG_KIND.harrier).length >= before + 2, 'the Low Road\'s foes rise');
  assert.ok(w.frames.some((f) => f.k === 'esay' && f.w === 'lowroad'));
  // the door from the High Road while the Low Road still has a member
  w.put('acct-1', F.lowX, (F.z + F.plate) / 2);
  w.put('acct-0', spec.end.x, spec.end.z);
  w.step();
  assert.equal(w.B.sg, 'closing');
  const wait = w.B.su - w.B.dn;
  assert.equal(wait, EG_CLOSING_SPAN_MS + Math.round((F.lo - F.hi) * 1000), 'the closing waits the roads\' difference');
  assert.equal(w.bad(), 0);
});

test('EG-FULL LAYER THREE THE HONOUR HORN (section 11.2 - the Clan Pit): 20 s after the wake a Kynval steps into the ring and one member is called; another member in the ring fouls it - Ashfall in the Pit; felled honourably, the tiers throw a Reliquary to every member (mutants: a horn never blown; the foul unpunished; the honour unpaid)', () => {
  const { seed, h, spec } = findHall((q) => (q.spots.horn ?? []).length > 0 && q.kind === 'yard');
  const run = (foul) => {
    const w = at(seed, h, 2), horn = spec.spots.horn[0];
    for (const sub of ['acct-0', 'acct-1']) w.put(sub, horn.x + (sub === 'acct-0' ? 12 : -12), horn.z);
    for (let k = 0; k < Math.ceil(EG_HORN_FIRST_MS / 250) + 4; k++) w.step();
    assert.ok(w.frames.some((f) => f.k === 'esay' && f.w === 'horn'), 'the horn sounds');
    const H = w.B.F.horn, kv = w.B.F.bodies.find((b) => b.i === H.kv);
    assert.ok(kv && kv.k === EG_KIND.kynval, 'a Kynval in the ring');
    const other = H.sub === 'acct-0' ? 'acct-1' : 'acct-0';
    if (foul) {
      w.put(other, kv.x + 1, kv.z); w.step();
      assert.ok(w.frames.some((f) => f.k === 'esay' && f.w === 'hornfoul'), 'fouled');
      const n0 = w.frames.length;
      for (let k = 0; k < 30; k++) w.step();
      assert.ok(w.frames.slice(n0).filter((f) => f.k === 'ez' && f.el === 'fire' && f.s?.[0] === 'd' && f.s[3] === 3).length >= 3, 'Ashfall in the Pit - its pools');
    }
    kv.hp = 0; w.B.F.bodies = w.B.F.bodies.filter((b) => b !== kv);
    w.step();
    const rels = w.frames.filter((f) => f.k === 'egot' && f.w === 'rel');
    return { rels, won: w.frames.some((f) => f.k === 'esay' && f.w === 'hornwon'), bad: w.bad() };
  };
  const honour = run(false);
  assert.ok(honour.won && new Set(honour.rels.map((f) => f.to)).size === 2, 'every member a Reliquary');
  const fouled = run(true);
  assert.ok(!fouled.won && fouled.rels.length === 0, 'a fouled horn pays nothing');
  assert.equal(honour.bad + fouled.bad, 0);
  assert.ok(EG_HORN_RING_M === 6);
});

test('EG-FULL LAYER THREE THE ANNALS AND THE LURKERS (sections 11.7 and 11.10): a lord\'s first fall adds its page to every living member at the Redoubt, once; a Low Road\'s Lurkers stand dormant in its walls at the wake; every new beat the director names is the wire\'s and the client words it (mutants: a page given twice; the Low Road empty)', () => {
  const { seed, h, spec } = findHall((q) => q.kind === 'court' && egAnnalsLordPage(q.lord) >= 0);
  const w = at(seed, h, 3);
  w.B.mem['acct-2'].pages = 2 ** egAnnalsLordPage(spec.lord);   // a member who has the page already
  w.B.F.mem.lordsFell = 1;
  w.step();
  const pages = w.frames.filter((f) => f.k === 'egot' && f.w === 'page');
  assert.equal(pages.length, 2, 'each living member its page - never twice');
  assert.ok(pages.every((f) => f.p === egAnnalsLordPage(spec.lord)));
  assert.ok(Object.values(w.B.mem).every((m) => m.pages & (2 ** egAnnalsLordPage(spec.lord))), 'kept on the member');
  const f2 = findHall((q) => !!q.fork && (q.spots.lurker ?? []).some((p) => p.road === 1));
  const w2 = at(f2.seed, f2.h, 2);
  const low = w2.B.F.bodies.filter((b) => b.k === EG_KIND.lurker && b.role === EG_ROLE.add);
  assert.ok(low.length >= (f2.spec.spots.lurker ?? []).filter((p) => p.road === 1).length, 'the Low Road\'s Lurkers');
  assert.ok(low.every((b) => b.fl & EG_FL.dormant), 'dormant in the walls');
  for (const k of ['seam', 'engine', 'horn', 'hornwon', 'hornfoul', 'niche', 'hcache', 'lowroad']) { assert.ok(EG_SAY_KEYS.includes(k), k); assert.ok(EG_SAY[k]('M0', 'Sluice').length > 5, `the client words ${k}`); }
  assert.equal(w.bad() + w2.bad(), 0);
});
