// AUDIT EG V, fix group F ("law"; bible/11-Multiplayer/Elite-Gates.md sections 8.7, 18 and 31's AUDIT EG V record) - THE
// DIRECTOR'S HALVES of what spec law 8 lays, driven through the real director (net/eliteGates/egBrain.js egBreachNew, egEnter, egStep) over
// the real hall law. Pins L1-21 (THE MOLTEN RIM keeps every way across it: the course's landing, Grath's bridges, the Wyrm's
// stairs, the Twin Lords' bridge - each a causeway the screens never cast back on, net/eliteGates/egLaw.js egMoltenRim and egRimCastsBack;
// its zones stood again when the fight's newest push them out; a screen casting back only off every causeway, scenes/eliteGates/egFight.js)
// and L3-18 (the Reliquary Vault stood and taken in a Proving Walk and on a forked span, in the trial and in the closing).
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egSpecForget, egMoltenRim, egRimCastsBack, egOnFight, EG_SEALED_MS, EG_LORDS, EG_RIM_IN_M, EG_RIM_OUT_M } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egGeo } from '../../../src/net/eliteGates/egBrain.js';
import { egSpanPairs, egJumpReach } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egObjsOf, zoneOut } from '../../../src/net/eliteGates/egLords.js';
import { egInShape } from '../../../src/net/eliteGates/egShape.js';
import { validEgOut } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { egGive8Halls } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's
const GIVEN = [[1, 115, 0], [1, 105, 0], [1, 110, 0], [3, 110, 0], [1, 125, 0], [3, 105, 0], [4, 110, 0], [4, 38, 0], [1, 122, 0]];
egGive8Halls(GIVEN);

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
/** A breach of `n` admitted (test/net/eliteGates/egaudit4_legion_run.test.js's own), its hall `h` woken by the director under strata `strata`,
 *  the company on the arrival plate: `step` moves it to `pos` (each member's hall-frame `[x, z]`) and beats. */
function hall({ seed, h, n = 2, strata = [] }) {
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]), rng = seeded(seed);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [], pr: 'pyre' });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, T0 + EG_SEALED_MS + 100);
  let now = T0 + EG_SEALED_MS + 100;
  B.strata = [...strata];
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const spec = egHallOf(seed, h, egGeo(B), B.egv);
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const frames = [];
  const step = (ms = 250) => { now += ms; const o = egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); frames.push(...o); return o; };
  for (let k = 0; k < 200 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  const put = (sub, [x, z]) => { pos[sub] = { sx: spec.x0 + x, z }; };
  return { B, spec, frames, step, put, now: () => now };
}

test('AUDIT EG V L1-21 THE MOLTEN RIM KEEPS ITS WAYS (section 18: "the outer 3 m of every disc of a Court is magma (a fight hall\'s way in and out keeps its edge)"): the director zones each Court disc\'s magma and, over it, a causeway (a haven) on every way across - the course\'s landing, Grath\'s bridges, the Wyrm\'s stairs, the Twin Lords\' bridge - so a screen casts back on none of them (egRimCastsBack): THE SPAN BUILD\'s leap from the approach lands on the Court wherever the solver lets it, and a member walks every bridge and stair, its edges as its middle; the rest of the ring casts back as before; its zones ride the wire and stand again when the fight\'s newest zones push them out (mutants: no causeway; a causeway stopped at the disc\'s edge; no causeway on a lane, a band, a stair or the landing; the causeways never zoned; the haven read as magma; the rim never stood again; a rim zone pushed out read as standing)', () => {
  const courts = { isles: [1, 115], perches: [1, 105], disc20: [1, 110], twins: [3, 110], pit: [1, 125], crypt: [3, 105], glade: [4, 110] };
  for (const [ground, [seed, h]] of Object.entries(courts)) {
    const w = hall({ seed, h, strata: ['moltenrim'] }), spec = w.spec, F = w.B.F, t = w.now();
    assert.equal(EG_LORDS[spec.lord].ground, ground);
    const zones = F.zones.filter((z) => z.kind === 'void' || z.kind === 'haven'), M = egMoltenRim(spec);
    assert.deepEqual(zones.filter((z) => z.kind === 'void').map((z) => z.s), M.rings, `${ground}: the magma, a ring a disc`);
    assert.deepEqual(zones.filter((z) => z.kind === 'haven').map((z) => z.s), M.ways, `${ground}: a causeway a way`);
    for (const z of zones) assert.ok(validEgOut(JSON.parse(JSON.stringify({ k: 'ez', ...z }))), 'it rides the wire');
    const discs = spec.fl.filter((f) => f.t === 'd' && f.r > 8);
    assert.equal(M.rings.length, discs.length);
    // the way in: the approach's last leap, wherever THE SPAN BUILD lands it on the Court, and on to the stone inside the magma
    const last = egSpanPairs(spec).filter((p) => p.a && !p.b && (p.a.road ?? 0) === 0).pop();
    const reach = egJumpReach(0).reach;
    for (const off of [-(last.a.w / 2 - 0.25), 0, last.a.w / 2 - 0.25]) for (let d = 0; d <= reach - last.a.after + EG_RIM_IN_M + 0.6; d += 0.1) {
      const x = last.a.x + off, z = last.edge + d;
      assert.equal(egRimCastsBack(F.zones, x, z, t), false, `${ground}: the way in, ${d.toFixed(1)} m past the leap's edge, ${off.toFixed(2)} m across`);
    }
    // ...where the ring alone (law 7's rim, AUDIT EG IV) cast the landing back
    assert.equal(egRimCastsBack(F.zones.filter((z) => z.kind === 'void'), last.a.x, last.edge + 0.5, t), true, 'the ring alone casts it back');
    // every lane, band and stair that meets a disc's rim: walked along its line and along both its edges, nowhere cast back
    for (const [ax, az, bx, bz, hw] of [...spec.lanes.map((l) => [l.ax, l.az, l.bx, l.bz, l.hw]), ...spec.bands.filter((b) => b.role === 'bridge').map((b) => [b.x, b.z0, b.x, b.z1, b.halfW]), ...spec.ramps.map((q) => [q.ax, q.az, q.bx, q.bz, q.hw])]) {
      const L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
      for (const off of [-(hw - 0.25), 0, hw - 0.25]) for (let k = 0; k <= 100; k++) {
        const x = ax + ((bx - ax) * k) / 100 + nx * off, z = az + ((bz - az) * k) / 100 + nz * off;
        assert.equal(egRimCastsBack(F.zones, x, z, t), false, `${ground}: along its way at (${x.toFixed(2)}, ${z.toFixed(2)})`);
      }
    }
    // the rest of the ring still magma: its middle a quarter turn off the way in, on the first disc
    const f0 = discs[0], mid = f0.r - (EG_RIM_IN_M - EG_RIM_OUT_M) / 2 - 0.5;
    const off = [[f0.x + mid, f0.z], [f0.x - mid, f0.z]].find(([x, z]) => !M.ways.some((s) => egInShape(s, x, z)));
    assert.ok(off && egRimCastsBack(F.zones, off[0], off[1], t), `${ground}: the ring off its ways casts back`);
    assert.ok(egOnFight(spec, off[0], off[1]), 'on the Court\'s own disc');
  }
  // Grath's bridges: each end inside its islands' magma, each a causeway
  const g = hall({ seed: 1, h: 115, strata: ['moltenrim'] }), bridges = g.spec.lanes.filter((l) => l.role === 'bridge');
  assert.equal(bridges.length, 3);
  assert.equal(egMoltenRim(g.spec).ways.length, 2 * 3 + 1, 'two ends a bridge, and the way in');
  // the rim stood again: the fight's newest twenty-four zones push it out of its list, and the next beat zones it again
  const F = g.B.F, rimN = F.zones.filter((z) => z.kind === 'void' || z.kind === 'haven').length;
  for (let k = 0; k < 24; k++) zoneOut(F, 'burn', ['d', 0, 30 + k, 2], g.now(), g.now() + 600_000, [], { p: 0.05, b: 1, el: 'fire' });
  assert.equal(F.zones.filter((z) => z.kind === 'void' || z.kind === 'haven').length, 0, 'pushed out');
  const out = g.step();
  assert.equal(F.zones.filter((z) => z.kind === 'void' || z.kind === 'haven').length, rimN, 'stood again');
  assert.equal(out.filter((o) => o.k === 'ez' && (o.kind === 'void' || o.kind === 'haven')).length, rimN, 'and said again');
  // a Yard keeps its edge (AUDIT EG IV's own): no rim
  const Y = hall({ seed: 1, h: 106, strata: ['moltenrim'] });
  assert.ok(!(Y.B.F.zones ?? []).some((z) => z.kind === 'void' || z.kind === 'haven'));
});

test('AUDIT EG V L1-21 THE SCREEN KEEPS THE CAUSEWAY (section 18, scenes/eliteGates/egFight.js): the director\'s rim said over the wire and folded as a screen folds it (net/eliteGates/egLink.js foldEg), a member standing on the course\'s landing inside the magma is never cast back, and one on the ring off every way is - once, then not again inside its 1.5 s (mutants: the screen casting back on any void, a causeway under it or not)', async () => {
  const w = hall({ seed: 1, h: 115, strata: ['moltenrim'] }), spec = w.spec;
  let s = { ...EG_STATE_EMPTY, h: 115 };
  for (const o of w.frames) if (o.k === 'efs' || o.k === 'ez') { const v = validEgOut(JSON.parse(JSON.stringify(o))); if (v) s = foldEg(s, v, w.now()); }
  assert.ok(s.fight.zones.some((z) => z.kind === 'void') && s.fight.zones.some((z) => z.kind === 'haven'), 'the rim and its causeways folded');
  const last = egSpanPairs(spec).filter((p) => p.a && !p.b && (p.a.road ?? 0) === 0).pop(), M = egMoltenRim(spec), f0 = spec.fl.find((f) => f.t === 'd' && f.r > 8);
  const mid = f0.r - (EG_RIM_IN_M - EG_RIM_OUT_M) / 2 - 0.5, off = [[f0.x + mid, f0.z], [f0.x - mid, f0.z]].find(([x, z]) => !M.ways.some((q) => egInShape(q, x, z)));
  let t = w.now() + 100, at = [last.a.x, last.edge + 0.5], backs = 0;
  const E = { b: w.B.b, h: 115, sg: 'trial', seed: 1, geo: egGeo(w.B), end: null, hw: t - 5000, fight: s.fight };
  const renderer = { createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: [0, 0, 0], bounds: [0, 0, 0, 0] }), destroyBillboardBatch: () => {} };
  const getTexture = async () => ({ getSize: () => ({ width: 40, height: 70 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 });
  const fight = createEgFight({ renderer, getTexture, audio: { play3d: () => {}, play3dId: () => {} }, link: { state: () => E }, now: () => t, feet: () => realmToDungeon(spec.x0 + at[0], 0, at[1]), player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0', castBack: () => { backs++; } });
  fight.frame(); await new Promise((r) => setTimeout(r, 0));
  assert.ok(egRimCastsBack(s.fight.zones.filter((z) => z.kind === 'void'), at[0], at[1], t), 'the landing inside the magma');
  for (let k = 0; k < 4; k++) { t += 2000; fight.frame(); }
  assert.equal(backs, 0, 'never cast back on the causeway');
  at = off; t += 2000; fight.frame();
  assert.equal(backs, 1, 'cast back on the ring off its ways');
  t += 500; fight.frame();
  assert.equal(backs, 1, 'once inside its 1.5 s');
});

test('AUDIT EG V L3-18 THE RELIQUARY VAULT STOOD AND TAKEN (section 8.7: "a side span to a cache: an extra Reliquary for each member who reaches it with a fair trail ... a Span or a Proving Walk"): the director stands the Vault\'s cache at the wake of every hall whose law laid one - a Proving Walk\'s (it stood none) and, from spec law 8, a forked span\'s - and a member who reaches it takes a Reliquary once, in the trial and in the closing; the one who never comes takes none (mutants: the Proving Walk\'s vault never stood; the take a span\'s alone; the closing\'s take dropped; twice a member)', () => {
  // a Proving Walk (seed 4's Hall 38): stood at its wake, taken in its trial
  const P = hall({ seed: 4, h: 38 });
  assert.deepEqual([P.spec.kind, P.spec.twist], ['proving', 'vault']);
  const [pv] = egObjsOf(P.B.F, 'vault'), [ps] = P.spec.spots.vault;
  assert.ok(pv && pv.x === ps.x && pv.z === ps.z, 'its cache stood on its spot');
  P.put('acct-0', [ps.x, ps.z]);
  const got = P.step().filter((o) => o.k === 'egot' && o.w === 'rel');
  assert.deepEqual(got.map((o) => o.to), ['acct-0'], 'a Reliquary to the member who reached it');
  assert.equal(P.step().filter((o) => o.k === 'egot' && o.w === 'rel').length, 0, 'once');
  // a forked span (seed 1's Hall 122): its Vault off the fork's island, stood, and taken by a member in the closing the first
  // across opened
  const S = hall({ seed: 1, h: 122 });
  assert.ok(S.spec.fork && S.spec.twist === 'vault');
  const [sv] = egObjsOf(S.B.F, 'vault'), [ss] = S.spec.spots.vault;
  assert.ok(sv && sv.x === ss.x && sv.z === ss.z);
  S.put('acct-0', [S.spec.end.x, S.spec.end.z]);
  for (let k = 0; k < 8 && S.B.sg !== 'closing'; k++) S.step();
  assert.equal(S.B.sg, 'closing', 'the first across opened the door');
  S.put('acct-1', [ss.x, ss.z]);
  const sgot = S.step().filter((o) => o.k === 'egot' && o.w === 'rel');
  assert.deepEqual(sgot.map((o) => o.to), ['acct-1'], 'taken in the closing');
  egSpecForget();   // (the law 8 hall given aside: law 7's own asked)
  assert.equal(egHallOf(1, 122, 0, 7).spots.vault, undefined, 'law 7 laid it nowhere');
  egGive8Halls(GIVEN);
});
