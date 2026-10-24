// AUDIT EG IV (2026-10-13, the Elite Gates arc's fourth audit; bible/11-Multiplayer/Elite-Gates.md sections 12, 15 and 21; the
// legion group's findings): THE LEGION AS WRITTEN - a lord's summons, a Binder's raise and the Low Road's foes held to the room
// under the legion's cap (a mechanic's own body standing whatever the room); a Binder's raise claimed once and spent when
// broken; the gate's rows read, never copied (the Caster's burning ground, the Daedra Lord's Cleave, the Mother of Dusk's
// Hellfire, the Harrier's numbers); a Court's Sappers feeding by the gate's law and cap; ROLE READS over all sixteen kinds; a
// Harrier's mark outside a Court; the host hits counted; a Sapper's rift the nearest and opened at a third of its own health.
// Every fixture is the producers' own: the halls from the law (egHallOf), the breach from the director (egBreachNew, egEnter,
// egStep, egBlow), the lords from net/eliteGates/egLords.js, the legion from egLegionRaise and egLegionStep.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ROLE, EG_FL, EG_GONE, egFightNew, egHas, egGone, egBlowsStep } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND, EG_LEGION_KINDS, egLegionRaise, egLegionStep, egLegionRoom, egLegionCapOf, egLegionSummon, EG_RETARGET_MS, EG_BITE_REACH } from '../../../src/net/eliteGates/egLegion.js';
import { egLordsNew, egLordsWake, egLordsStep, egLordsOf, egObjsOf } from '../../../src/net/eliteGates/egLords.js';
import { EG_V_BY_KEY } from '../../../src/net/eliteGates/egVestige.js';
import { ATTACKS, POOLS, HARRIER_S, HOST_RETARGET_MS, HARRIER_BITE_REACH, SAP_HEAL, SAP_FEEDS_MAX, HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { egTalliesOf } from '../../../src/net/eliteGates/egTally.js';
import { egGive8Hall } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courts and its
// lords, its courses along +z from the plate, where law 8 lays them) and stand on it still - a finder scans law 8's halls by
// name, and a breach stands in a circle given at law 8 as a breach of law 8's is given to a client (test/egGive8.mjs
// egGive8Hall); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and test/net/eliteGates/law9_rooms.test.js's

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
/** The legion standing in a fight: its foes (a friend is none). */
const foes = (F) => F.bodies.filter((b) => b.role === EG_ROLE.add && b.hp > 0 && !egHas(b, EG_FL.friend));
const vId = (key) => EG_V_BY_KEY[key].id;

// ── a lord's fight stood straight from the law ─────────────────────────────────────────────────────────────────────────
/** The first Court the law lays for `lord` (from Hall 5, every fifth). */
function courtOf(lord) {
  for (let seed = 1; seed < 300; seed++) for (let h = 5; h <= 200; h += 5) { const spec = egHallOf(seed, h, 0, 8); if (spec.kind === 'court' && spec.lord === lord) return spec; }
  throw new Error(`no Court of ${lord}`);
}
/** Lord `lord`'s fight for a company of `n` (level 40), woken, the company about the fight's heart: `beat(now)` its lords. */
function stand(lord, n) {
  const spec = courtOf(lord), subs = Array.from({ length: n }, (_, i) => `m${i}`);
  const F = egFightNew(spec, T0, subs.map(() => 40), subs), out = [], rng = seeded(11);
  egLordsNew(F, spec, lord, T0, out, { decrees: {}, n });
  egLordsWake(F, spec, T0, out, { n });
  const fx = spec.fight?.x ?? spec.foe?.x ?? 0, fz = spec.fight?.z ?? spec.foe?.z ?? 0;
  const here = subs.map((sub, i) => ({ sub, x: fx + 3 + i * 1.5, z: fz + 3 }));
  const beat = (now) => { const o = []; egLordsStep(F, spec, now, here, rng, o, { decrees: {}, n, covenant: 0 }); egBlowsStep(F, spec, now, here, o, []); return o; };
  return { F, spec, here, beat, L: egLordsOf(F)[0] };
}
/** The legion stood to its cap (Harriers): answers the cap. */
function fill(F) { egLegionRaise(F, Array(egLegionRoom(F)).fill(EG_KIND.harrier), [[0, 0]], T0, [], {}); assert.equal(egLegionRoom(F), 0); return egLegionCapOf(F); }

// ── a breach's hall woken by the director ──────────────────────────────────────────────────────────────────────────────
/** Breach `seed`'s hall `h` for a company of `n`, woken with the company on its arrival plate, then stood at `at` (each
 *  member's `[x, z]`, the hall's frame), the legion its wake raised cleared (`clear`): `step`, `blow`, `stand`. */
function breach({ seed = 12345, h = 5, n = 3, strata = [], at = null, clear = true, vs = {} } = {}) {
  const rng = seeded(seed);
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [], pr: 'pyre' });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  B.strata = [...strata];
  for (const [sub, v] of Object.entries(vs)) B.mem[sub].vs = v;
  const spec = egGive8Hall(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const frames = [];
  const step = (ms = 250) => { now += ms; const o = egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); frames.push(...o); return o; };
  for (let k = 0; k < 200 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  const f = spec.fight ?? spec.fl?.[0] ?? { x: 0, z: 0 };
  const place = at ?? Object.fromEntries(co.map(([sub], i) => [sub, [f.x + i * 1.5, f.z + 1]]));
  for (const [sub, [x, z]] of Object.entries(place)) pos[sub] = { sx: spec.x0 + x, z };
  step();
  if (clear && B.F) B.F.bodies = B.F.bodies.filter((b) => b.role !== EG_ROLE.add);
  let q = 1;
  const blow = (sub, i, d, r, xz = place[sub]) => { now += 300; return egBlow(B, sub, { k: 'hit', i, q: q++, d, r }, { sx: spec.x0 + xz[0], y: 0, z: xz[1] }, now); };
  return { B, spec, pos, place, frames, step, blow, rng, now: () => now, stand: (sub, x, z) => { pos[sub] = { sx: spec.x0 + x, z }; } };
}

// ── lane1 #6: A LORD'S SUMMONS UNDER THE CAP ───────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV A SUMMONS IS HELD TO THE ROOM (section 12: "Every wave is held to the room under the cap: the hall\'s, a lord\'s fury\'s and its summons\'"): with the legion at its cap, the Mother of Dusk\'s anchors rise in the Moonfall with no Divers, the Cairn-Keeper\'s failed tithe bursts with no Wraiths and Morvayn\'s Last Rites raise none - while the body a mechanic needs (Morvayn\'s odd member\'s Wraith, the Night-Stalker\'s lone member\'s Blood Thrall) stands whatever the room and is counted after; egLegionSummon keeps the first of a summons it has room for (mutants: a summons past the room; the mechanic\'s body held; the room read as the cap)', () => {
  // the Mother of Dusk, in the Moonfall: her anchors rise again, each with two Divers - none at the cap
  {
    const S = stand('dusk', 2), cap = fill(S.F);
    S.L.hp = S.L.max * 0.3;
    let t = T0 + 1000;
    for (let k = 0; k < 8; k++) S.beat((t += 250));
    assert.equal(S.L.ph, 3, 'the Moonfall');
    for (const a of egObjsOf(S.F, 'anchor')) egGone(S.F, [a], EG_GONE.slain, 'x', t, []);
    S.F.mem.groundedUntil = 0; S.F.mem.anchorsBackAt = t + 100;
    const o = S.beat((t += 250));
    assert.ok(o.some((f) => f.k === 'esay' && f.w === 'anchors'), 'her anchors rose');
    assert.equal(foes(S.F).length, cap, 'no Diver past the cap');
    assert.ok(!foes(S.F).some((b) => b.k === EG_KIND.diver));
  }
  // the Cairn-Keeper, a company of six failing its tithe in her third phase
  {
    const S = stand('cairnkeeper', 6), cap = fill(S.F);
    S.L.hp = S.L.max * 0.3;
    let t = T0, most = 0;
    for (let k = 0; k < 4 * 30; k++) { S.beat((t += 250)); most = Math.max(most, foes(S.F).length); }
    assert.ok(S.F.mem.titheAt > T0 + 15_000, 'a tithe was laid and failed');
    assert.equal(most, cap, 'its bursts raise none past the cap');
  }
  // Morvayn: the odd member's Wraith (a chain's mechanic) stands at the cap and counts; the Last Rites raise none
  {
    const S = stand('morvayn', 3), cap = fill(S.F);
    S.L.hp = S.L.max * 0.6;   // EG-PERFECT (PIN MOVED): the Chaining is her second phase's - turned at 0.66
    let t = T0;
    for (let k = 0; k < 4 * 16 && !S.F.mem.chains?.length; k++) S.beat((t += 250));
    assert.equal(S.F.mem.chains.length, 1, 'one chain of two');
    const w = foes(S.F).filter((b) => b.k === EG_KIND.wraith);
    assert.equal(w.length, 1, 'the odd member bound to a Wraith, room or none');
    assert.ok(S.F.tethers.some((x) => x[0] === w[0].i && x[2] === 2), 'its chain');
    assert.equal(foes(S.F).length, cap + 1, 'and counted against the room after');
    assert.equal(egLegionRoom(S.F), 0);
    S.L.hp = S.L.max * 0.3;
    for (let k = 0; k < 4 * 8; k++) S.beat((t += 250));
    assert.equal(S.L.ph, 3);
    assert.ok(S.F.mem.ritesAt > t, 'the Last Rites came');
    assert.equal(foes(S.F).filter((b) => b.k === EG_KIND.wraith).length, 1, 'and raised no Wraith past the cap');
  }
  // the Night-Stalker and a lone member: its Blood Thrall stands at the cap
  {
    const S = stand('stalker', 1), cap = fill(S.F);
    S.F.mem.tetherAt = T0 + 100;
    S.beat(T0 + 250);
    const th = foes(S.F).filter((b) => b.k === EG_KIND.thrall);
    assert.equal(th.length, 1, 'the thrall stands');
    assert.ok(S.F.tethers.some((x) => x[0] === th[0].i && x[1] === 'm0' && x[2] === 1), 'tethered to the lone member');
    assert.equal(foes(S.F).length, cap + 1);
  }
  // egLegionSummon: the room's worth of a summons, the first kept; a mechanic's first `need` whatever the room
  const S = stand('hound', 2), F = S.F, cap = egLegionCapOf(F);
  egLegionRaise(F, Array(cap - 1).fill(EG_KIND.harrier), [[0, 0]], T0, [], {});
  assert.deepEqual(egLegionSummon(F, [EG_KIND.wraith, EG_KIND.diver, EG_KIND.binder], [[1, 1]], T0, []).map((b) => b.k), [EG_KIND.wraith], 'one room, the first');
  assert.deepEqual(egLegionSummon(F, [EG_KIND.thrall, EG_KIND.wraith], [[1, 1]], T0, [], { need: 1 }).map((b) => b.k), [EG_KIND.thrall], 'none: the mechanic\'s alone');
});

test('AUDIT EG IV THE LOW ROAD\'S FOES ARE HELD TO THE ROOM (section 12): a member taking the Low Road of Hall 7\'s forked Span with the legion at its cap raises none of its foes, and with room raises them (mutants: the Low Road raised past the cap)', () => {
  for (const full of [true, false]) {
    const S = breach({ seed: 1, h: 7, n: 1, at: { 'acct-0': [0, 0] } }), { B, spec } = S;
    assert.equal(spec.kind, 'span');
    assert.ok(spec.fork && (spec.spots.lowfoe ?? []).length === 2, 'a fork with its Low Road\'s two foes');
    const cap = egLegionCapOf(B.F);
    if (full) egLegionRaise(B.F, Array(cap).fill(EG_KIND.harrier), [[0, 0]], S.now(), [], {});
    S.stand('acct-0', spec.fork.lowX, spec.fork.z + 2);
    const o = S.step();
    assert.ok(o.some((f) => f.k === 'esay' && f.w === 'lowroad'), 'the Low Road taken');
    const low = o.filter((f) => f.k === 'ead').flatMap((f) => f.a);
    assert.equal(low.length, full ? 0 : 2, full ? 'none past the cap' : 'its two foes');
  }
});

// ── lane1 #12: THE BINDER ──────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV A BINDER RAISES ONCE (section 12: "raises the last fallen add of its wave once, a 6 s cast broken by blows that land a tenth of its health in it"): of two Binders and one slain Breaker of a wave, one casts - the body claimed - and the other none; broken, the cast is spent and never begun again, and nobody raises the Breaker; a cast run out raises it once, its bar taken down; with no room under the cap none begins (mutants: the fallen left for another Binder; a broken cast begun again; the bar left up; a cast begun at the cap)', () => {
  const S = breach({ n: 2, at: { 'acct-0': [0, 41], 'acct-1': [-6, 41] } }), { B } = S, F = B.F, W = 77;
  const [b1, b2, br] = egLegionRaise(F, [EG_KIND.binder, EG_KIND.binder, EG_KIND.breaker], [[3, 41], [5, 41], [0, 44]], S.now(), [], { wave: W });
  b1.up = b2.up = br.up = 0; br.hp = 1;
  S.blow('acct-0', br.i, 50, HIT_KINDS.Shaft);
  assert.equal(F.mem.fallen.filter((x) => x.wv === W).length, 1, 'the Breaker fell');
  S.step(); S.step();
  const casting = [b1, b2].filter((b) => b.cast);
  assert.equal(casting.length, 1, 'one Binder casts: the body is claimed');
  assert.equal(F.mem.fallen.filter((x) => x.wv === W).length, 0, 'taken off the fallen');
  const [c] = casting;
  const o = S.blow('acct-0', c.i, Math.ceil(c.max * 0.15), HIT_KINDS.Shaft);
  assert.ok(o.some((f) => f.k === 'esay' && f.w === 'raisebroken'), 'broken');
  assert.equal(F.pg.raise, null, 'its bar down');
  for (let k = 0; k < 4 * 8; k++) S.step();
  assert.ok(!b1.cast && !b2.cast, 'never begun again, by either');
  assert.equal(foes(F).filter((b) => b.k === EG_KIND.breaker).length, 0, 'the Breaker never raised');
  // a broken cast SPENDS the raise: a Binder with a second fallen Breaker of its wave raises it never
  const V = breach({ n: 2, at: { 'acct-0': [0, 41], 'acct-1': [-6, 41] } }), K = V.B.F;
  const [bx, k1, k2] = egLegionRaise(K, [EG_KIND.binder, EG_KIND.breaker, EG_KIND.breaker], [[3, 41], [0, 44], [1, 44]], V.now(), [], { wave: W });
  bx.up = k1.up = k2.up = 0; k1.hp = k2.hp = 1;
  V.blow('acct-0', k1.i, 50, HIT_KINDS.Shaft); V.blow('acct-0', k2.i, 50, HIT_KINDS.Shaft);
  V.step(); V.step();
  assert.ok(bx.cast, 'a raise begun');
  V.blow('acct-0', bx.i, Math.ceil(bx.max * 0.15), HIT_KINDS.Shaft);
  for (let k = 0; k < 4 * 8; k++) V.step();
  assert.ok(!bx.cast && bx.raised, 'spent: the second body never taken up');
  assert.equal(K.mem.fallen.filter((x) => x.wv === W).length, 1, 'it lies still');
  assert.equal(foes(K).filter((b) => b.k === EG_KIND.breaker).length, 0);
  // a cast run out: raised once, said, its bar down
  const T = breach({ n: 2, at: { 'acct-0': [0, 41], 'acct-1': [-6, 41] } }), G = T.B.F;
  const [bd, bk] = egLegionRaise(G, [EG_KIND.binder, EG_KIND.breaker], [[3, 41], [0, 44]], T.now(), [], { wave: W });
  bd.up = bk.up = 0; bk.hp = 1;
  T.blow('acct-0', bk.i, 50, HIT_KINDS.Shaft);
  let said = 0;
  for (let k = 0; k < 4 * 8; k++) said += T.step().filter((f) => f.k === 'esay' && f.w === 'raised').length;
  assert.equal(said, 1, 'raised once');
  assert.equal(foes(G).filter((b) => b.k === EG_KIND.breaker).length, 1);
  assert.ok(bd.raised && !bd.cast && G.pg.raise == null, 'spent, its bar down');
  // at the cap: none begins
  const U = breach({ n: 2, at: { 'acct-0': [0, 41], 'acct-1': [-6, 41] } }), H = U.B.F;
  const [bu, bv] = egLegionRaise(H, [EG_KIND.binder, EG_KIND.breaker], [[3, 41], [0, 44]], U.now(), [], { wave: W });
  bu.up = bv.up = 0; bv.hp = 1;
  U.blow('acct-0', bv.i, 50, HIT_KINDS.Shaft);
  egLegionRaise(H, Array(egLegionRoom(H)).fill(EG_KIND.harrier), [[-6, 30]], U.now(), [], {});
  U.step(); U.step();
  assert.ok(!bu.cast, 'no room, no cast');
  assert.equal(H.mem.fallen.filter((x) => x.wv === W).length, 1, 'the body still lies');
});

// ── lane1 #16: THE GATE'S ROWS, READ ───────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV THE GATE\'S ROWS READ, NEVER COPIED (ONE DFU MEMBER, ONE EXPORT; AUDIT EG III L1-23\'s class): a Caster\'s Bolt leaves the gate\'s burning ground (POOLS.hellfire: r 3, 6 s, 8% + 3); the Daedra Lord\'s Cleave is ATTACKS.cleave\'s row and reach; the Harrier\'s health, mark and bite the gate\'s; the Mother of Dusk\'s Hellfire is the gate\'s row with its pool - and no gate row stands as a literal in net/eliteGates/egLegion.js or net/eliteGates/egLords.js (mutants: the Bolt\'s pool at the old 6% + 2; the Cleave\'s reach drifted; the Hellfire\'s pool dropped)', () => {
  // the Caster: a Bolt at a member, the pool it lays
  const spec = egHallOf(1, 1, 0, 8), F = egFightNew(spec, T0, [40], ['m0']);
  const [c] = egLegionRaise(F, [EG_KIND.caster], [[spec.fight.x, spec.fight.z]], T0, [], {});
  c.up = 0; c.next = 0;
  const pools = [];
  egLegionStep(F, spec, T0 + 1000, [{ sub: 'm0', x: spec.fight.x, z: spec.fight.z + 14 }], seeded(3), [], { pool: (...a) => pools.push(a) });
  assert.equal(pools.length, 1, 'a Bolt thrown');
  const [, , r, , ms, p, b] = pools[0];
  assert.deepEqual({ r, ms, p, b }, { r: POOLS.hellfire.r, ms: POOLS.hellfire.ms, p: POOLS.hellfire.pct, b: POOLS.hellfire.base });
  assert.deepEqual({ r, ms, p, b }, { r: 3, ms: 6000, p: 0.08, b: 3 }, 'the gate\'s numbers');
  // the Daedra Lord's Cleave, the Harrier's numbers
  const D = EG_LEGION_KINDS[EG_KIND.dlord].blow, A = ATTACKS.cleave;
  assert.deepEqual([D.nm, D.r, D.arc, D.wu, D.rec, D.p, D.b, D.reach], [A.name, A.r, A.arc, A.windup, A.recover, A.pct, A.base, A.range]);
  const G = egFightNew(spec, T0, [40], ['m0']), [dl] = egLegionRaise(G, [EG_KIND.dlord], [[spec.fight.x, spec.fight.z]], T0, [], {});
  dl.up = 0;
  const struck = (d) => { const o = []; dl.atk = null; dl.next = 0; egLegionStep(G, spec, T0 + 1000, [{ sub: 'm0', x: dl.x, z: dl.z + d }], seeded(3), o, {}); return o.some((f) => f.k === 'eb'); };
  assert.deepEqual([struck(A.range - 0.2), struck(A.range + 0.2)], [true, false], 'within the Cleave\'s reach, and no further');
  assert.deepEqual([EG_LEGION_KINDS[EG_KIND.harrier].hpS, EG_RETARGET_MS, EG_BITE_REACH], [HARRIER_S, HOST_RETARGET_MS, HARRIER_BITE_REACH]);
  // the Mother of Dusk's Hellfire, its burning ground laid as it lands
  const S = stand('dusk', 4);
  let t = T0, fire = null;
  for (let k = 0; k < 4 * 120 && !fire; k++) fire = S.beat((t += 250)).find((f) => f.k === 'eb' && f.nm === 'Hellfire') ?? null;
  assert.ok(fire, 'a Hellfire thrown');
  assert.equal(fire.p > 0 && fire.s.length, Math.min(S.here.length, ATTACKS.hellfire.max));
  assert.ok(fire.s.every((s) => s[0] === 'd' && s[3] === ATTACKS.hellfire.r));
  const ez = [];
  for (let k = 0; k < 4 * 4; k++) ez.push(...S.beat((t += 250)).filter((f) => f.k === 'ez'));
  const burn = ez.filter((z) => z.kind === 'burn' && z.from === fire.at);
  assert.equal(burn.length, fire.s.length, 'its burning ground under each of its marks, from its landing (the gate\'s landingPools)');
  assert.ok(burn.every((z, j) => z.until - z.from === POOLS.hellfire.ms && z.p === POOLS.hellfire.pct && z.b === POOLS.hellfire.base && z.s[3] === POOLS.hellfire.r && z.s[1] === fire.s[j][1] && z.s[2] === fire.s[j][2]));
  // the source sweep: no gate row's numbers written in the Spire's fight
  for (const file of ['src/net/eliteGates/egLegion.js', 'src/net/eliteGates/egLords.js']) {
    const src = readFileSync(file, 'utf8');
    for (const R of Object.values(ATTACKS)) assert.ok(!new RegExp(`nm: '${R.name}'[^}\\n]*\\bwu: ${R.windup}\\b`).test(src), `${file}: ${R.key} copied`);
    for (const P of Object.values(POOLS)) assert.ok(!src.includes(`${P.ms}, ${P.pct}, ${P.base}`), `${file}: a pool copied`);
  }
  const leg = readFileSync('src/net/eliteGates/egLegion.js', 'utf8');
  assert.ok(!/EG_RETARGET_MS = \d|EG_BITE_REACH = \d|key: 'harrier'[^\n]*hpS: \d/.test(leg), 'the Harrier\'s numbers read');
});

// ── lane1 #17: A SAPPER FEEDS ITS LORD BY THE GATE'S LAW ──────────────────────────────────────────────────────────────
test('AUDIT EG IV A COURT\'S SAPPERS FEED BY THE GATE\'S LAW (section 12: "heals it, the gate\'s law"; net/gate/gateBrain.js sapperBeat): each Sapper reaching the lord heals it SAP_HEAL (2%) while the fight\'s feedings last - SAP_FEEDS_MAX, six - and burns out against it after, healing nothing (mutants: the feedings uncapped; the heal a literal off the gate\'s)', () => {
  assert.deepEqual([SAP_HEAL, SAP_FEEDS_MAX], [0.02, 6]);
  const S = breach({ n: 2, at: { 'acct-0': [0, 30], 'acct-1': [2, 30] } }), F = S.B.F, L = egLordsOf(F)[0];
  L.hp = Math.round(L.max * 0.5);
  const before = L.hp, said = [];
  for (let k = 0; k < SAP_FEEDS_MAX + 2; k++) {
    const [s] = egLegionRaise(F, [EG_KIND.sapper], [[L.x + L.r + 0.5, L.z]], S.now(), [], {});
    s.up = 0; s.lordGoal = L.i;
    said.push(...S.step().filter((f) => f.k === 'esay' && f.w === 'sapperfed'));
  }
  assert.equal(said.length, SAP_FEEDS_MAX, 'six fed');
  assert.equal(F.mem.fed, SAP_FEEDS_MAX);
  assert.ok(Math.abs(L.hp - (before + SAP_FEEDS_MAX * SAP_HEAL * L.max)) < 1, `six heals of 2% (${L.hp - before})`);
  assert.equal(foes(F).filter((b) => b.k === EG_KIND.sapper).length, 0, 'the last two burnt out against him');
});

// ── lane1 #18: ROLE READS ──────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV ROLE READS OVER ALL SIXTEEN KINDS (section 12: "one sprite never plays two roles in a band, and every role also carries a mark that is not a colour"): in every band each sprite plays one role - the elites (a Kynval, the Daedra Lord) one - a friend is a human shape no foe wears, the standard-bearer a Daedra Seducer of its own, the Blood Thrall a Vampire on its feet, the Wraith a Wraith; every body is one Daggerfall draws (mutants: the Ghost on the Shade\'s sprite; the standard on the Dremora; the thrall on the Giant Bat)', () => {
  const role = (k) => (k === EG_KIND.dlord || k === EG_KIND.kynval ? 'elite' : EG_LEGION_KINDS[k].key);
  for (let band = 0; band < 4; band++) {
    const by = {};
    for (const K of EG_LEGION_KINDS) (by[K.mob[band]] ??= new Set()).add(role(K.id));
    for (const [mob, roles] of Object.entries(by)) assert.equal(roles.size, 1, `band ${band}: mobile ${mob} plays ${[...roles]}`);
  }
  for (const K of EG_LEGION_KINDS) {
    for (const m of K.mob) assert.ok(ENEMY_BASICS[m]?.maleTexture > 0, `${K.name}: ${m} drawn`);
    assert.equal(K.mob.every((m) => m >= 128), !!K.friend, `${K.name}: a human shape exactly when a friend`);
  }
  assert.deepEqual([EG_KIND.ghost, EG_KIND.deserter, EG_KIND.standard, EG_KIND.thrall, EG_KIND.wraith, EG_KIND.bearer].map((k) => EG_LEGION_KINDS[k].mob[2]), [130, 129, 29, 28, 23, 25]);
  assert.equal(EG_LEGION_KINDS[EG_KIND.thrall].hover, 0, 'the thrall on its feet');
});

// ── lane1 #22: A HARRIER'S MARK ────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV A HARRIER\'S MARK (section 12\'s table, the page to the code): in a Court it runs at the member farthest from the lord, elsewhere at the nearest, and the page says so (mutants: the anchor unread)', () => {
  const spec = egHallOf(1, 1, 0, 8), F = egFightNew(spec, T0, [40, 40], ['a', 'b']);
  const [h] = egLegionRaise(F, [EG_KIND.harrier], [[0, 30]], T0, [], {});
  h.up = 0;
  const here = [{ sub: 'a', x: 0, z: 33 }, { sub: 'b', x: 0, z: 45 }];
  egLegionStep(F, spec, T0 + 100, here, seeded(1), [], {});
  assert.equal(h.tg, 'a', 'elsewhere, the nearest');
  h.tg = null;
  egLegionStep(F, spec, T0 + 200, here, seeded(1), [], { anchor: [0, 31] });
  assert.equal(h.tg, 'b', 'in a Court, the farthest from the lord');
  const page = readFileSync('bible/11-Multiplayer/Elite-Gates.md', 'utf8');
  assert.ok(page.includes('in a Court the one farthest from the lord, as the gate\'s runs from the Warden; elsewhere the nearest'));
  assert.ok(!page.includes('elsewhere, from itself'), 'retired');
});

// ── lane1 #25: THE HOST HITS COUNTED ───────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV A HOST HIT IS COUNTED (sections 15, 16.1 and 27.6): Sweeping Arc\'s splash lands on its member\'s hall and circle damage (`dh`, `dc` - the earner rule and the receipt\'s share) and on the recap\'s tally, as the blow that carried it - what landed, never past the add\'s health (mutants: the splash uncounted; counted past the health)', () => {
  const S = breach({ n: 2, at: { 'acct-0': [0, 41], 'acct-1': [-6, 41] }, vs: { 'acct-0': [[vId('sweeping'), 3]] } }), { B } = S, F = B.F;
  const [a, b] = egLegionRaise(F, [EG_KIND.breaker, EG_KIND.breaker], [[0, 43], [1.5, 43]], S.now(), [], {});
  a.up = b.up = 0; a.x = 0; a.z = 43; b.x = 1.5; b.z = 43; a.mv = b.mv = null;
  b.hp = 3;
  const m = B.mem['acct-0'], before = [m.dh, m.dc, m.dt ?? 0];
  S.blow('acct-0', a.i, 60, HIT_KINDS.Melee);
  const got = a.max - a.hp;
  assert.ok(got > 0, 'the blow landed');
  assert.ok(!(b.hp > 0), 'the splash felled the second');
  assert.deepEqual([m.dh - before[0], m.dc - before[1], (m.dt ?? 0) - before[2]], [got + 3, got + 3, got + 3], 'the splash counted - its add\'s 3 points, no more');
  assert.equal(egTalliesOf(B).find((r) => r[0] === 'acct-0')?.[1] ?? got + 3, got + 3);
});

// ── lane1 #27: A SAPPER'S RIFT ─────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV A SAPPER OPENS THE NEAREST CLOSED RIFT AT A THIRD OF ITS OWN HEALTH (section 12: "a Yard\'s nearest closed rift (opens it again at a third)"): of two rifts closed, the one nearest the Sapper is its goal, and it rises again at a third of what it held - three rifts\' share, never a five-rift rift\'s; a goal another Sapper opened first is given up for the next (mutants: the first closed; a fifth of the whole)', () => {
  const S = breach({ seed: 1, h: 1, n: 3 }), { B, spec } = S, F = B.F;
  assert.deepEqual([spec.kind, spec.variant], ['yard', 'riftyard']);
  const rifts = egObjsOf(F, 'rift');
  assert.equal(rifts.length, 3, 'three rifts for three');
  const hold = rifts[0].max;
  const by = (o) => Math.hypot(o.x - rifts[0].x, o.z - rifts[0].z);
  const [near, far] = [...rifts.slice(1)].sort((p, q) => by(p) - by(q));
  for (const o of [far, near]) { o.hp = 1; S.blow('acct-0', o.i, 50, HIT_KINDS.Shaft, [spec.fight.x, spec.fight.z]); }
  assert.equal(F.closedSpots.length, 2, 'two closed, the farther first');
  for (let k = 0; k < 4 * 25 && !foes(F).some((b) => b.k === EG_KIND.sapper); k++) S.step();
  const sap = foes(F).find((b) => b.k === EG_KIND.sapper);
  assert.ok(sap, 'a Sapper rose at the standing rift');
  assert.deepEqual([sap.goal[0], sap.goal[1]], [near.x, near.z], 'its goal the nearest closed rift');
  sap.x = near.x + 1; sap.z = near.z; sap.mv = null; sap.up = 0;
  S.step();
  const back = egObjsOf(F, 'rift').find((o) => Math.hypot(o.x - near.x, o.z - near.z) < 0.01 && o.hp > 0);
  assert.ok(back, 'reopened');
  assert.equal(back.max, Math.round(hold / 3), 'at a third of its own health');
  // a goal reopened under it: the next nearest
  const [s2] = egLegionRaise(F, [EG_KIND.sapper], [[rifts[0].x, rifts[0].z]], S.now(), [], {});
  s2.up = 0; s2.goal = [near.x, near.z, hold];
  S.step();
  assert.deepEqual([s2.goal[0], s2.goal[1]], [far.x, far.z], 'the one left');
});
