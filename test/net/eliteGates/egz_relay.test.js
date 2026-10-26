// EG-ZQ (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 8.3, 9, 11.7, 12, 13.2 and
// 14, the departures of EG5 + EG-ZK and the findings of EG-ZJ): THE RELAY'S LAST DEBTS, against the director (net/eliteGates/egBrain.js
// over net/eliteGates/egLords.js, net/eliteGates/egLegion.js and net/eliteGates/egWalkGraph.js), the wire (net/wire.js) and the screen (net/eliteGates/egLink.js,
// scenes/eliteGates/egFight.js) - the legion's way on kept only while it is walked (EG-ZK's rule for the lords, the graph's own now); a
// Rampart's pinned Caster kept on its pillar whatever the pillar's plan meets; every lord's health its fighters' shares (a
// member recalled into a hall brings its share, a fall retires one, a recall restores it - the gate's retireShare and
// restoreShare, through the seam's join); Colossal's size on the wire and on the screen; the Markynaz's decree folded with
// the circle's; and a spot's height, said in centimetres as the page now says.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validEgOut, EG_SIZE_WIRE_MIN, EG_SIZE_WIRE_MAX } from '../../../src/net/wire.js';
import { egHallOf, egCircleSpecs, EG_SEALED_MS, EG_DECREES, EG_DECREE_BY_KEY, EG_LORDS, EG_LAW_UNIT } from '../../../src/net/eliteGates/egLaw.js';
import { EG_HERO_FRAGS } from '../../../src/net/eliteGates/egHeroFrags.js';
import { egBreachNew, egEnter, egStep, egWord } from '../../../src/net/eliteGates/egBrain.js';   // AUDIT WORLD-EVENTS L1-4: `yield`, the fall given in to
import { EG_SEAM, egLordsFight, egLordsOf, egLordLaw, egLordsShare, egMarkynazDecree, egBossLook } from '../../../src/net/eliteGates/egLords.js';
import { EG_ROLE, EG_FL, egFightNew, egPlace, egCarry, egWalk } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND, EG_LEGION_KINDS, egLegionRaise, walkGraph } from '../../../src/net/eliteGates/egLegion.js';
import { egFightView, egWalkGraph, egWalkNext, egWayOn, egRegionAt, egArchCut, EG_NODE_REACH_M } from '../../../src/net/eliteGates/egWalkGraph.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { egLookOf } from '../../../src/scenes/eliteGates/egFight.js';
import { EG_LORD_PRESENCE } from '../../../src/world/eliteGates/egKit.js';   // EG-LOOK (section 9): the sprite at the lord's presence
import { dpsRef } from '../../../src/net/gate/gateBrain.js';
import { egGive8Hall } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courts and its
// lords, its courses along +z from the plate, where law 8 lays them) and stand on it still - a finder scans law 8's halls by
// name, and a breach stands in a circle given at law 8 as a breach of law 8's is given to a client (test/egGive8.mjs
// egGive8Hall); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and test/net/eliteGates/law9_rooms.test.js's

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };

/**
 * A breach at hall `h` of `seed` whose members (`lvs`, one a member) entered before its first wake, the circle bearing `dc`:
 * `at(sub, x, z)` stands a member (the hall's frame), `dead(sub, on)` says its death in the census, `step(subs)` beats the
 * director with those members' bodies (the frames kept), `wake()` beats until the trial with `subs` on the plate.
 */
function breachAt(seed, h, { lvs = [40, 40], dc = [] } = {}) {
  const rng = seeded(seed);
  const co = lvs.map((_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  co.forEach(([sub], i) => egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), lvs[i], now));
  B.dc = dc.map((p) => [...p]);
  const spec = egGive8Hall(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const deadOf = {}, frames = [];
  const all = co.map(([sub]) => sub);
  const step = (subs = all) => { now += 250; const o = egStep(B, now, subs.map((sub) => ({ sub, ...pos[sub], dead: !!deadOf[sub], at: now })), rng); frames.push(...o); return o; };
  const at = (sub, x, z) => { pos[sub] = { sx: spec.x0 + x, z }; };
  const dead = (sub, on = true) => { deadOf[sub] = on; };
  const wake = (subs = all) => { for (let k = 0; k < 80 && B.sg !== 'trial'; k++) step(subs); assert.equal(B.sg, 'trial', `hall ${h} woke`); };
  return { B, spec, pos, frames, step, at, dead, wake, now: () => now };
}
/** The rows a frame list said (`efs`, `ead`) of body `i`, in order. */
const rowsOf = (frames, i) => frames.flatMap((f) => (f.k === 'efs' ? f.b : f.k === 'ead' ? f.a : [])).filter((t) => t[0] === i);

test('EG-ZQ THE LEGION\'S WAY ON IS KEPT ONLY WHILE IT IS WALKED (section 11.7; EG-ZK\'s departure 7 retired): a Lurker of the legion walking the graph of seed 77\'s Hall 14 to a member past its chamber\'s arch goes to the gap, through it, and heads for the gap\'s far node - set down back on its own half beside the wall (a charge cut there, a push: net/eliteGates/egBodies.js egPlace), its next walk goes by the gap again, never straight across the wall to that node; the rule is the graph\'s own (net/eliteGates/egWalkGraph.js egWayOn), and the lords keep it through the same function: a node still walked to is kept, one left behind dropped, one stood at reached - its region and its floor the walker\'s (mutants: the legion\'s walk keeping a node it was set down from; a node kept with no walk to it; a reached node\'s region or floor not taken; the lords\' rule a second copy)', () => {
  const spec = egHallOf(77, 14, 0, 8), view = egFightView(spec), G = egWalkGraph(view), d = spec.deco.find((q) => q.t === 'arch');
  assert.deepEqual(G.rg, [{ f: 0, side: -1 }, { f: 0, side: 1 }], 'the arch\'s disc in two halves');
  const F = egFightNew(spec, T0, [40, 40]);
  const [lk] = egLegionRaise(F, [EG_KIND.lurker], [[10, d.z + 8]], T0, [], {});
  lk.up = 0; lk.fl = 0;
  const goal = [-8, d.z - 12], speed = EG_LEGION_KINDS[EG_KIND.lurker].speed;
  let now = T0;
  const far = () => lk.wn >= 0 && G.nodes[lk.wn].z < d.z;
  for (let k = 0; k < 60 && !far(); k++) { now += 250; egCarry(F, now); walkGraph(F, view, lk, goal[0], goal[1], 1.5, speed, now); }
  assert.ok(far() && lk.z > d.z, 'through the gap toward the far node, still on its own half');
  assert.ok(Math.abs(lk.mv.tx - G.nodes[lk.wn].x) < 0.011 && Math.abs(lk.mv.tz - G.nodes[lk.wn].z) < 0.011, 'its walk goes to that node');
  // set down back beside the wall on its own half: from there that node is across the wall
  const node = G.nodes[lk.wn];
  egPlace(F, lk, 10, d.z + 1, now);
  assert.ok(egArchCut(spec, 10, d.z + 1, node.x, node.z), 'the far node lies across the wall from where it was set down');
  now += 250;
  walkGraph(F, view, lk, goal[0], goal[1], 1.5, speed, now);
  assert.equal(egArchCut(spec, lk.x, lk.z, lk.mv.tx, lk.mv.tz), null, `its next walk never through the wall (${lk.mv.tx}, ${lk.mv.tz})`);
  assert.deepEqual([lk.mv.tx, lk.mv.tz], [d.x, d.z + 0.8], 'back to the gap\'s near node');
  for (let k = 0; k < 60; k++) { const x0 = lk.x, z0 = lk.z; now += 250; egCarry(F, now); assert.equal(egArchCut(spec, x0, z0, lk.x, lk.z), null, 'never across the wall'); walkGraph(F, view, lk, goal[0], goal[1], 1.5, speed, now); }
  assert.ok(lk.z < d.z && Math.hypot(lk.x - goal[0], lk.z - goal[1]) < 3, `and on through the gap to its member (${lk.x}, ${lk.z})`);
  // THE RULE, on bodies the producers walk: a node still walked to kept; one left behind dropped; one stood at reached
  const bal = egHallOf(77, 12, 0, 8), vb = egFightView(bal), Gb = egWalkGraph(vb), q = bal.ramps[0];
  const Fb = egFightNew(bal, T0, [40]);
  const up = Gb.nodes.findIndex((n) => Math.abs(n.x - q.bx) < 1e-9 && Math.abs(n.z - q.bz) < 1e-9 && vb.fl[Gb.rg[n.rg].f].y === q.y1);
  const low = egRegionAt(vb, Gb, q.ax, q.az, 0)[0];
  assert.ok(up >= 0 && vb.fl[Gb.rg[low].f].y === 0, 'the stair\'s top node, on the floor above; its foot\'s floor below');
  const [w] = egLegionRaise(Fb, [EG_KIND.lurker], [[q.ax, q.az]], T0, [], {});
  w.fr = low; w.wn = up;
  egWalk(Fb, w, q.bx, q.bz, 0, 2, T0 + 250, vb, 0, true, q.y1);
  egWayOn(vb, w);
  assert.deepEqual([w.wn, w.fr], [up, low], 'walking to it: kept');
  egWalk(Fb, w, q.ax - 3, q.az + 1, 0, 2, T0 + 400, vb, 0, true);
  egWayOn(vb, w);
  assert.deepEqual([w.wn, w.fr], [-1, low], 'walking elsewhere since: no way on');
  w.wn = up;
  egPlace(Fb, w, q.ax + 1, q.az, T0 + 500);
  egWayOn(vb, w);
  assert.deepEqual([w.wn, w.fr], [-1, low], 'set down away from it: no way on');
  w.wn = up; egPlace(Fb, w, q.bx - 0.4 * Math.sign(q.bx - q.ax || 1), q.bz, T0 + 750);
  assert.ok(Math.hypot(w.x - q.bx, w.z - q.bz) <= EG_NODE_REACH_M);
  w.y = 0;
  egWayOn(vb, w);
  assert.deepEqual([w.wn, w.fr, w.y], [-1, Gb.nodes[up].rg, q.y1], 'set down at it: reached - its region and its floor');
  // ONE RULE, ONE HOME: the walk-to test lives in the graph alone, and both walkers ask it
  const net = (f) => readFileSync(new URL(`../../../src/net/${f}`, import.meta.url), 'utf8');
  const homes = readdirSync(new URL('../../../src/net/', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.js') && /mv\.tx - wn\.x/.test(net(f)));   // the whole layer, its feature folders' among it
  assert.deepEqual(homes, ['eliteGates/egWalkGraph.js'], 'the rule written once');
  assert.match(net('eliteGates/egLegion.js'), /egWayOn\(view, a\);[^\n]*\n {2}const fr = a\.fr, \[x, z, last\] = egWalkNext/, 'the legion asks it before its next step');
  assert.match(net('eliteGates/egLords.js'), /egWayOn\(view, L, G\);\n {2}const from = regionOf/, 'the lords ask it before they choose their way');
});

test('EG-ZQ A PINNED CASTER KEEPS TO ITS PILLAR (sections 8.3 and 12; EG-ZJ\'s finding retired): on every Rampart of seeds 1-6 whose pinned Casters (a company of two) include one on a pillar whose plan meets a bastion\'s - the walk graph stepping off that pillar onto the bastion (its lip, one way) - every pinned Caster stands on its pillar through fifty seconds of the company marching the walkway; the lip is still the graph\'s (an unpinned walker on the pillar steps off it to a member on the bastion), and the pin keeps the Caster to its own region (mutants: the pin unread; a pinned walker\'s goal its member\'s region)', () => {
  let halls = 0, kept = 0;
  for (let seed = 1; seed <= 6 && halls < 2; seed++) for (let c = 1; c <= 20 && halls < 2; c++) for (const s of egCircleSpecs(seed, c, 0, 8)) {
    if (s.kind !== 'rampart' || halls >= 2) continue;
    const pillars = s.discs.filter((p) => p.role === 'pillar'), bastions = s.discs.filter((p) => p.role === 'bastion');
    const meets = (p) => bastions.find((b) => Math.hypot(p.x - b.x, p.z - b.z) < p.r + b.r + 0.3) ?? null;
    const k = s.variant === 'gauntlet' ? 2 + 1 : 1 + 1;   // the director's count for a company of two
    if (!(s.spots.pillar ?? []).slice(0, k).some((q) => { const p = pillars.find((d) => Math.hypot(d.x - q.x, d.z - q.z) < 0.01); return p && meets(p); })) continue;
    halls++;
    const S = breachAt(seed, s.h, { lvs: [40, 40] });
    S.wake();
    const casters = S.B.F.bodies.filter((b) => b.k === EG_KIND.caster && b.pinned);
    const home = new Map(casters.map((b) => [b.i, pillars.find((p) => Math.hypot(p.x - b.x, p.z - b.z) < p.r)]));
    assert.ok(casters.length === k && casters.every((b) => home.get(b.i)), `Hall ${s.h}: its ${k} Casters raised on their pillars`);
    const over = casters.find((b) => meets(home.get(b.i)));
    assert.ok(over, 'one stands on a pillar whose plan meets a bastion\'s');
    // the lip: the graph steps off that pillar onto the bastion (one way) - an unpinned walker there goes by it
    const view = egFightView(s), G = egWalkGraph(view), P = home.get(over.i), Bs = meets(P);
    const pr = egRegionAt(view, G, P.x, P.z, P.y)[0], br = egRegionAt(view, G, Bs.x, Bs.z, Bs.y)[0];
    assert.ok(G.adj.some((e, u) => G.nodes[u].rg === pr && e.some(([v]) => G.nodes[v].rg === br)), 'the graph steps off the pillar onto the bastion');
    const free = { ...structuredClone(over), pinned: 0, wn: -1 }, pinned = { ...structuredClone(over), wn: -1 };
    const [, , lastFree] = egWalkNext(view, free, Bs.x, Bs.z, Bs.y, over.r), [px, pz, last] = egWalkNext(view, pinned, Bs.x, Bs.z, Bs.y, over.r);
    assert.ok(!lastFree && free.wn >= 0 && free.fr === pr, 'unpinned, it walks off by the lip');
    assert.ok(last && pinned.wn === -1 && Math.hypot(px - P.x, pz - P.z) <= P.r - over.r + 1e-9 && pinned.fr === pr, 'pinned, its goal kept on its own pillar');
    // fifty seconds of the company marching the walkway, end to end
    const W = s.walk;
    for (let j = 0; j < 200 && S.B.F; j++) { const z = W.z0 + ((W.z1 - W.z0) * j) / 200; S.at('acct-0', W.x, z); S.at('acct-1', W.x + 0.5, z); S.step(); }
    for (const b of casters) {
      const p = home.get(b.i);
      if (!S.B.F?.bodies.includes(b)) continue;
      kept++;
      assert.ok(Math.hypot(b.x - p.x, b.z - p.z) <= p.r, `Hall ${s.h}: Caster ${b.i} on its pillar (${b.x}, ${b.z})`);
      assert.equal(b.y, p.y, 'on its top');
    }
  }
  assert.equal(halls, 2, 'two such Ramparts');
  assert.ok(kept >= 4, `their Casters kept (${kept})`);
});

test('EG-ZQ THE LORDS\' SHARES (section 13.2, THE LAW EVERY LORD KEEPS; EG-ZK\'s departure 1 retired): a Proving Walk\'s champion stood for the company the hall woke with is its fighters\' shares (ttkRef - here EG_PROVE_HP_S x the depth - x each one\'s reference damage); a member fallen before the wake and called back by a Memento in the hall brings its share at the fraction the champion stands at; a fall while it sleeps in its ring lets the fallen\'s share go at that fraction and the whole fight is said with it, a witness seen in the hall restores nothing, a recall restores it (FIELD BUGS 2026-10-19e LORD-SHARES: it wakes for the company standing before it, and awake keeps every share - test/net/eliteGates/fb1019e_lordshares.test.js); the last share is never retired; all through the seam\'s join, by the gate\'s own retireShare and restoreShare (mutants: a joiner\'s share unbrought or brought whole; a fall\'s share kept; the seen step restoring the fallen; the recall never restoring; the last share retired; the whole fight unsaid; the held threshold left; a mirror sized)', () => {
  let S = null;
  for (let seed = 1; seed <= 40 && !S; seed++) for (const s of egCircleSpecs(seed, 1, 0, 8)) if (!S && s.kind === 'proving' && s.spots.niche?.length) S = breachAt(seed, s.h, { lvs: [40, 20, 30] });
  const { B, spec } = S, niche = spec.spots.niche[0], dps = [45, 25, 35];
  assert.deepEqual([40, 20, 30].map(dpsRef), dps);
  // acct-2 falls on the arrival plate before the hall wakes: its Memento lies where it fell
  S.at('acct-2', spec.arrive.x + 3, spec.arrive.z + 2); S.dead('acct-2');
  S.step();
  assert.equal(B.mem['acct-2'].alive, 0, 'fallen before the wake');
  S.dead('acct-2', false);
  S.wake(['acct-0', 'acct-1']);
  const L = egLordsOf(B.F)[0];
  assert.ok(L && L.champ, 'the champion stood');
  assert.deepEqual(B.F.subs, ['acct-0', 'acct-1'], 'the company it woke with');
  const per = L.max / (dps[0] + dps[1]);
  assert.ok(Math.abs(per - 40 * B.F.X) < 0.05, `its health per reference damage, EG_PROVE_HP_S x the depth (${per})`);
  S.step(['acct-0', 'acct-1']);
  assert.deepEqual(L.fs, { 'acct-0': { share: per * dps[0], retired: false }, 'acct-1': { share: per * dps[1], retired: false } }, 'its fighters\' shares, summing to its health');
  // bled to 60%, then acct-0 carries acct-2's Memento to the niche: acct-2 is called back into the hall and brings its share
  L.hp = L.max * 0.6;
  const q = B.mementos.find((m) => m.s === 'acct-2');
  S.at('acct-0', q.x, q.z); S.step(['acct-0', 'acct-1']);
  assert.equal(q.by, 'acct-0', 'the Memento carried');
  S.at('acct-0', niche.x, niche.z); S.step(['acct-0', 'acct-1']);
  assert.equal(B.mem['acct-2'].alive, 1, 'called back');
  for (let k = 0; k < 12 && !S.step(['acct-0', 'acct-1']).some((f) => f.k === 'efs'); k++);   // the whole fight just said: the next beat says it again only for a share
  const max0 = L.max, k0 = S.frames.length;
  S.at('acct-2', niche.x, niche.z + 1.5); S.step();
  assert.ok(Math.abs(L.max - (max0 + per * dps[2])) < 1e-6, `its share brought (${max0} -> ${L.max})`);
  assert.ok(Math.abs(L.hp / L.max - 0.6) < 1e-9, 'at the fraction the champion stands at: no heal');
  const said = S.frames.slice(k0).find((f) => f.k === 'efs');
  assert.ok(said && said.b.find((t) => t[0] === L.i)[7] === Math.ceil(L.max), 'the whole fight said again at once, with the new health');
  // acct-1 falls while the champion sleeps in its ring: its share let go at the fraction (PIN MOVED, FIELD BUGS 2026-10-19e
  // LORD-SHARES - a lord awake keeps it)
  assert.equal(L.up2, false, 'asleep in its ring');
  const max1 = L.max;
  S.dead('acct-1'); S.step();
  // PIN MOVED (AUDIT WORLD-EVENTS L1-4, raise before the fall): lying down, its share is kept for a raise; given in to
  // (`yield`), the fall lets it go
  assert.ok(Math.abs(L.max - max1) < 1e-6, 'lying down: its share kept');
  egWord(B, 'acct-1', { k: 'yield' }, null, S.now(), () => 0.5); S.step();
  assert.equal(B.mem['acct-1'].alive, 0);
  assert.ok(Math.abs(L.max - (max1 - per * dps[1])) < 1e-6 && Math.abs(L.hp / L.max - 0.6) < 1e-9, 'a fall before its wake lets its share go, at the fraction');
  assert.equal(L.fs['acct-1'].retired, true);
  // the witness seen in the hall for seconds: nothing restored
  S.dead('acct-1', false);
  const max2 = L.max;
  for (let k = 0; k < 8; k++) S.step();
  assert.equal(L.max, max2, 'the seen-and-restore step skips the fallen');
  // the recall: acct-1's Memento to the niche, and its share restored
  const q1 = B.mementos.find((m) => m.s === 'acct-1');
  S.at('acct-0', q1.x, q1.z); S.step();
  S.at('acct-0', niche.x, niche.z); S.step();
  assert.equal(B.mem['acct-1'].alive, 1, 'called back');
  S.at('acct-1', niche.x + 1, niche.z + 1.5); S.step();
  assert.ok(Math.abs(L.max - max1) < 1e-6 && L.fs['acct-1'].retired === false && Math.abs(L.hp / L.max - 0.6) < 1e-9, 'the recall restores it, at the fraction');
  // the seam's join alone, on a copy of the sleeping champion: every share out but the last; an errand's held threshold kept at its fraction
  const C = structuredClone(B.F), CL = C.bodies.find((b) => b.i === L.i), lf = egLordsFight(C, spec, {}, S.now());
  CL.hpFloor = Math.round(CL.max * 0.33);
  const floorFrac = CL.hpFloor / CL.max;
  assert.equal(EG_SEAM.join(lf, 'acct-0', 'M0', 40, S.now(), null, { admits: false }), false);
  assert.ok(Math.abs(CL.hpFloor / CL.max - floorFrac) < 0.001, 'the held threshold kept at its fraction');
  EG_SEAM.join(lf, 'acct-1', 'M1', 20, S.now(), null, { admits: false });
  const last = CL.max;
  assert.ok(Math.abs(last - per * dps[2]) < 1e-6, 'one share left in');
  assert.equal(egLordsShare(C, 'acct-2', 30, false), false, 'the last share never retired');
  assert.equal(CL.max, last);
  // a mirror carries none; the gate's own functions, imported, never written again
  CL.fl |= EG_FL.mirror;
  assert.equal(egLordsShare(C, 'acct-0', 40, true), false, 'a mirror is sized by nobody');
  const src = readFileSync(new URL('../../../src/net/eliteGates/egLords.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ dpsRef, retireShare, restoreShare \} from '\.\.\/gate\/gateBrain\.js';/);
  assert.doesNotMatch(src, /function (retireShare|restoreShare|shareOut|standsAt)\b/);
});

test('EG-ZQ THE COLOSSAL\'S SIZE ON THE WIRE (section 14, Colossal; EG5\'s departure 3 retired): under Colossal the first Court\'s Grath stands at the law\'s sizeX - its body\'s radius and its row\'s size (`sz`, thousandths: 1250, at rank II 1400; 0 at its look\'s own); the wire carries it within its bounds, the screen holds it on the lord and draws him at his look\'s scale times it, and the screen\'s reach to him is the radius the relay judges by; the law never folds a size past the wire\'s bounds (mutants: the size unsaid or unread; the radius at the look\'s; the bounds dropped; the row cut short)', () => {
  const look = egBossLook('hound');
  assert.equal(look.scale, EG_LORDS.hound.scale);
  for (const [dc, sz] of [[[], 0], [[[EG_DECREE_BY_KEY.colossal.id, 1]], 1250], [[[EG_DECREE_BY_KEY.colossal.id, 2]], 1400]]) {
    const S = breachAt(12345, 5, { dc });
    S.wake();
    const L = egLordsOf(S.B.F)[0], size = sz ? sz / EG_LAW_UNIT : 1;
    assert.equal(L.key, 'hound');
    assert.equal(L.sz, sz, `its size (${sz})`);
    assert.equal(L.r, Math.max(0.8, (1.8 * (look.scale * size)) / 3), 'its body\'s radius at that size');
    const rows = rowsOf(S.frames, L.i);
    assert.ok(rows.length > 0 && rows.every((t) => t.length === 19 && t[17] === sz), 'every row of it says its size');   // PIN MOVED (AUDIT EG V, b: a body's facing on the wire - its row's nineteenth, a walk's tenth)
    // the screen: every word through the wire, folded
    let E = { ...EG_STATE_EMPTY, h: S.B.h };
    for (const f of S.frames) { const w = validEgOut(JSON.parse(JSON.stringify(f))); if (w) E = foldEg(E, w, S.now()); }
    const b = E.fight.bodies.find((x) => x.i === L.i);
    assert.equal(b.sz, size, 'the screen holds it');
    const seen = egLookOf(b, S.spec.band);
    // PIN MOVED (EG-LOOK, Elite-Gates-Look.md section 9 - the lords drawn oversized): `scale` stays his BODY at it, the one the
    // reach below reads; the sprite is drawn at it times his presence (`drawn` - a Court lord's 1.6), never `scale` grown
    assert.equal(seen.scale, look.scale * size, 'his body at it');
    assert.equal(seen.drawn, look.scale * size * EG_LORD_PRESENCE.lord, 'and draws him at it, at his presence');
    assert.equal(Math.max(0.8, (1.8 * seen.scale) / 3), L.r, 'its reach to him the relay\'s own radius');
  }
  // the wire's bounds
  const row = [1, EG_ROLE.lord, 0, 0, 0, 40, 900, 1000, 0, 0, 40, 0, T0, 0, 0, 1, T0, 1250, 3.14], efs = (r) => ({ k: 'efs', h: 5, wk: T0, b: [r], bl: [], tx: [], mk: [], pg: {} });   // PIN MOVED (AUDIT EG V, b: a body's facing on the wire - its row's nineteenth, a walk's tenth)
  const sized = (v) => [...row.slice(0, 17), v, row[18]];
  assert.ok(validEgOut(efs(row)) && validEgOut(efs(sized(0))));
  for (const bad of [EG_SIZE_WIRE_MIN - 1, EG_SIZE_WIRE_MAX + 1, 1250.5, -1250, '1250']) assert.equal(validEgOut(efs(sized(bad))), null, `a size of ${bad}`);
  assert.deepEqual([validEgOut(efs(sized(EG_SIZE_WIRE_MIN))) !== null, validEgOut(efs(sized(EG_SIZE_WIRE_MAX))) !== null], [true, true]);
  assert.equal(validEgOut(efs(row.slice(0, 18))), null, 'a row cut short');
  // every size the law folds (only Colossal names one) inside the wire's bounds
  for (const D of EG_DECREES) for (const L of D.law ?? []) if (L.sizeX != null) assert.ok(L.sizeX >= EG_SIZE_WIRE_MIN && L.sizeX <= EG_SIZE_WIRE_MAX, `${D.key}: ${L.sizeX}`);
});

test('EG-ZQ THE GRAND DUKE\'S DECREE FOLDS (sections 8.5 and 14; EG5\'s departure 6 retired): the Markynaz lays the lord-family decree his hall draws on his own fight, folded with the circle\'s through the fight\'s profile - never in their place: under Vengeful II at seed 1\'s Hall 68 he lays Colossal (his hall\'s own) and his fight runs by both, stood at Colossal\'s health and size; where the circle already bears his hall\'s decree he lays the next it does not; bearing all four, none (mutants: the circle\'s decrees replaced; his decree laid after his birth; a decree borne twice; the order of the four)', () => {
  const lord = EG_DECREES.filter((d) => d.fam === 'lord').map((d) => d.key);
  assert.deepEqual(lord, ['colossal', 'unyielding', 'vengeful', 'grudge']);
  assert.deepEqual([0, 1, 2, 3, 4, 7].map((h) => egMarkynazDecree({}, h)), ['colossal', 'unyielding', 'vengeful', 'grudge', 'colossal', 'grudge'], 'his hall\'s own, by its number');
  assert.equal(egMarkynazDecree({ colossal: 1 }, 68), 'unyielding', 'borne already: the next');
  assert.equal(egMarkynazDecree({ colossal: 2, unyielding: 1, feud: 1 }, 68), 'vengeful');
  assert.equal(egMarkynazDecree({ grudge: 1 }, 3), 'colossal', 'round the four');
  assert.equal(egMarkynazDecree({ colossal: 1, unyielding: 1, vengeful: 2, grudge: 1 }, 5), null, 'all four borne: none');
  assert.equal(egMarkynazDecree({ colossal: 0 }, 0), 'colossal', 'a rank of nought is not borne');
  // in the director: seed 1's Hall 68 is the Shade's Proving Walk, its champion the Markynaz
  const vg = EG_DECREE_BY_KEY.vengeful.id, co = EG_DECREE_BY_KEY.colossal.id;
  const S = breachAt(1, 68, { dc: [[vg, 2]] });
  assert.equal(S.spec.champ, 'markynaz');
  S.wake();
  const M = egLordsOf(S.B.F)[0];
  assert.equal(M.decree, 'colossal', 'he lays his hall\'s own');
  assert.deepEqual(S.B.F.mem.law, egLordLaw({ vengeful: 2, colossal: 1 }), 'his fight runs by both');
  assert.deepEqual([S.B.F.mem.law.dmgX, S.B.F.mem.law.hpX, S.B.F.mem.law.sizeX], [1.4, 1.25, 1.25]);
  assert.equal(M.max, Math.round(40 * S.B.F.team * S.B.F.X * 1.25), 'stood at Colossal\'s health');
  assert.equal(M.sz, 1250, 'and its size');
  const T = breachAt(1, 68, { dc: [[co, 1]] });
  T.wake();
  const N = egLordsOf(T.B.F)[0];
  assert.equal(N.decree, 'unyielding', 'the circle bearing Colossal: he lays the next');
  assert.deepEqual(T.B.F.mem.law, egLordLaw({ colossal: 1, unyielding: 1 }));
  assert.equal(T.B.F.mem.law.shieldX, 2);
});

test('EG-ZQ A SPOT\'S HEIGHT IS SAID IN CENTIMETRES (section 9; EG-ZJ\'s finding decided): the spec says a spot\'s x and z in metres and its y as the law lays it - seed 1\'s Hall 22, a Deepway, has Lurker spots at y -760 over its floors at -7.6 m, and every spot\'s y over three seeds\' first twenty circles is whole centimetres a hundred times a floor the law laid; no spec law moved for it (section 22) (mutants: a spot\'s y said in metres without a law; the page\'s claim)', () => {
  const s = egHallOf(1, 22, 0, 8);
  assert.equal(s.kind, 'deepway');
  assert.deepEqual(s.spots.lurker.filter((q) => q.y !== 0).map((q) => q.y), [-760, -760]);
  assert.deepEqual([...new Set(s.fl.map((f) => f.y))].sort((a, b) => a - b), [-7.6, 0, 3.2]);
  let ys = 0;
  for (let seed = 1; seed <= 3; seed++) for (let c = 1; c <= 20; c++) for (const h of egCircleSpecs(seed, c, 0, 8)) {
    const floors = new Set([...h.fl.map((f) => Math.round(f.y * 100)), ...h.discs.map((d) => Math.round(d.y * 100))]);
    for (const [role, list] of Object.entries(h.spots)) for (const q of list) {
      if (q.y == null) continue;
      ys++;
      // PIN MOVED (EG-HERO-LAY, spec law 7): a hero's rift and hazard anchors are no body's places - a rift set in its wall, a
      // hazard's spout - and stand where its record sets them, in centimetres from its origin
      const hq = (h.heroes ?? []).find((x) => x.f === q.f);
      if (hq && (role === 'rift' || role === 'hazard')) { assert.ok(Number.isInteger(q.y) && EG_HERO_FRAGS[hq.id].anchors[role].some((p) => Math.round(hq.y * 100) + p[1] === q.y), `seed ${seed} Hall ${h.h}'s hero ${role} at y ${q.y}: its record's`); continue; }
      assert.ok(Number.isInteger(q.y) && floors.has(q.y), `seed ${seed} Hall ${h.h}'s ${role} at y ${q.y}: centimetres of a floor the law laid`);
    }
  }
  assert.ok(ys > 100, `${ys} spot heights read`);
  const page = readFileSync(new URL('../../../bible/11-Multiplayer/Elite-Gates.md', import.meta.url), 'utf8');
  const sec9 = page.slice(page.indexOf('## 9. The generator'), page.indexOf('## 10. The spans'));
  assert.match(sec9, /a spot's `y`[^.]*centimetres/, 'section 9 says it');
});
