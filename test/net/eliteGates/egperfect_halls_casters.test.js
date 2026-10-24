// EG-PERFECT (2026-10-18, the owner: "I want to ensure ... the design of the halls, and everything is absolutely perfect";
// bible/11-Multiplayer/Elite-Gates.md section 11.4: "a second fight floor 3-4 m up, on two stairs, where Casters stand"; section
// 11.7: "Casters stand at `anchors.caster` (raised where the chamber has a second floor)") - A CHAMBER'S CASTERS ON ITS RAISED
// ANCHORS. The law lays a kit chamber's caster anchors on its balconies (net/eliteGates/egFragLaw.js egFragChamber) and a hero's
// records name theirs on its galleries, and the relay read none: every Caster rose where its wave rose and walked the court. Now
// the stands are laid at the wake (net/eliteGates/egBrain.js egCasterStands) and a Caster risen in that chamber rises on its nearest
// free stand at the raised floor's height and keeps to it (net/eliteGates/egLegion.js egStandFree, egLegionRaise), its Bolt landing
// on its mark's own floor - the same bodies, under THE LEGION'S CAP, its Bolt THE WIDTH RULE's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egOnFight, EG_SEALED_MS, EG_SPEC } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egCasterStands } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND, EG_LEGION_KINDS, egLegionRaise, egLegionRoom, egStandFree } from '../../../src/net/eliteGates/egLegion.js';
import { EG_BALCONY_OUT_CM, EG_BALCONY_R_CM } from '../../../src/net/eliteGates/egFragLaw.js';
import { validEgOut } from '../../../src/net/wire.js';

const T0 = 1_800_000_000_000;
/** PIN MOVED (EG-PERFECT, spec law 10 - 2026-10-18): the stands measured on spec law 9's halls, named (law 10 lays these seeds'
 *  halls anew - its own stands pinned below, 4 m up and more). */
const LAW = 9;
/** A breach of `n` members on hall `h` of `seed` (law `law`), stepped to its wake (the closing pin's rig; poses carry `y`). */
function at(seed, h, n = 2, law = LAW) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  B.egv = law;
  const clock = { now: T0 + EG_SEALED_MS + 100 };
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, clock.now), null);
  B.h = h; B.sg = 'arrive'; B.wk = clock.now; B.cnt = { left: 1_800_000, at: clock.now }; B.pulledAt = clock.now; B.su = clock.now + 30_000;
  const spec = egHallOf(seed, h, 0, law), pos = {}, frames = [];
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + spec.arrive.x, z: spec.arrive.z, y: spec.arrive.y ?? 0 };
  let bad = 0;
  const take = (list) => { for (const f of list) { const { to, ...rest } = f; if (!validEgOut(JSON.parse(JSON.stringify(rest)))) bad++; frames.push(f); } return list; };
  const step = (ms = 250) => { clock.now += ms; return take(egStep(B, clock.now, Object.entries(B.mem).filter(([, m]) => m.alive).map(([sub]) => ({ sub, sx: pos[sub].sx, y: pos[sub].y, z: pos[sub].z, dead: false, at: clock.now })), rng)); };
  const put = (sub, x, z, y) => { pos[sub] = { sx: spec.x0 + x, z, y }; };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', 'the hall woke');
  return { B, spec, clock, pos, frames, step, put, bad: () => bad };
}

test('EG-PERFECT A CHAMBER\'S CASTER STANDS (sections 11.4 and 11.7): seed 1\'s hall 9 - a Wellspring in the Fallen Stacks - stands its two on its balconies 3.6 m over the court (each anchor\'s plan, the balcony\'s height, the court\'s the spot names, and the chamber\'s reach: its court and balconies about it, 1 m under its floor to 5 m over); seed 1\'s hall 14 its two on its hero\'s gallery (the hero\'s own box); seed 1\'s hall 22 none on its passage\'s anchor; a Rampart none (mutants: a stand at the spot\'s own height; a passage\'s anchor stood; the reach\'s pad)', () => {
  const pad = (EG_BALCONY_OUT_CM + EG_BALCONY_R_CM) / 100;
  assert.equal(pad, 7);
  const yard = egHallOf(1, 9, 0, LAW), ch = yard.frags[3], R = (ch.z1 - ch.z0) / 2;
  assert.deepEqual([yard.kind, ch.cls, ch.kit, ch.play, R], ['yard', 'chamber', 'stacks', 'balcony', 22]);
  const box = [ch.x - R - pad, ch.y - 1, ch.z0 - pad, ch.x + R + pad, ch.y + 5, ch.z1 + pad];
  assert.deepEqual(egCasterStands(yard), [[111.75, 34.02, -24.1, -27.7, box], [62.75, 34.02, -24.1, -27.7, box]]);
  assert.deepEqual(yard.discs.filter((d) => d.role === 'balcony').map((d) => [d.x, d.z, d.y]), [[111.75, 34.02, -24.1], [62.75, 34.02, -24.1]]);
  // a hero chamber: the gallery its record names (its spot's own height), the hero's box its reach
  const hero = egHallOf(1, 14, 0, LAW), H = hero.heroes.find((q) => q.id === 'egheroStacks');
  assert.deepEqual(egCasterStands(hero), [[-14.55, 44.03, 23.5, 23.5, [H.box[0], H.box[1] - 1, H.box[2], H.box[3], H.box[4], H.box[5]]], [-51.75, 39.63, 23.5, 23.5, [H.box[0], H.box[1] - 1, H.box[2], H.box[3], H.box[4], H.box[5]]]]);
  assert.ok(hero.fl.some((f) => f.y === 20) && egOnFight(hero, -14.55, 44.03, 0, 23.5), 'the gallery 3.5 m over its court');
  // a passage's anchor: a stand on its own floor, no second one
  const deep = egHallOf(1, 22, 0, LAW);
  assert.deepEqual(deep.spots.caster.map((q) => deep.frags[q.f].cls), ['chamber', 'chamber', 'passage']);
  assert.equal(egCasterStands(deep).length, 2);
  assert.deepEqual(egCasterStands(egHallOf(1, 4, 0, LAW)), [], 'a Rampart\'s Casters keep their pillars');
  // spec law 10 (the build's): seed 1's hall 14 a Fallen Stacks' two balconies, its stands on them 4 m and more over its court
  const k10 = egHallOf(1, 14, 0, EG_SPEC), st10 = egCasterStands(k10);
  assert.deepEqual(st10.map((q) => q.slice(0, 3)), k10.discs.filter((d) => d.role === 'balcony').map((d) => [d.x, d.z, d.y]), 'law 10: on its balconies');
  assert.ok(st10.length === 2 && st10.every((q) => q[2] - q[3] >= 4), `law 10: 4 m up and more (${st10.map((q) => (q[2] - q[3]).toFixed(1))})`);
});

test('EG-PERFECT CASTERS RISE ON THE STANDS (section 11.7): seed 1\'s hall 9 on the relay - three Casters risen at the great rift take the two balconies (the nearest free first), at 3.6 m over the court, pinned, and the third rises at its wave\'s spot; one risen on the arrival plate never takes a stand; a stand its Caster fell from is taken again; THE LEGION\'S CAP holds as it held; with the company at the court\'s heart 24.5 m off, each keeps its balcony (never walks the stair down) and bolts the court below, its Bolt (THE WIDTH RULE\'s r 3) landing on its mark\'s feet at the court\'s height (mutants: a stand outside its chamber taken; not pinned; the Bolt at its Caster\'s height)', () => {
  const w = at(1, 9, 2), F = w.B.F, spec = w.spec, S = F.stands;
  assert.deepEqual(S, egCasterStands(spec), 'laid at the wake');
  const spring = F.bodies.find((b) => b.role === EG_ROLE.obj && b.great);
  assert.ok(spring && Math.hypot(spring.x - 87.25, spring.z - 34.02) < 22, 'the great rift on the court');
  const room0 = egLegionRoom(F);
  const [a, b, c] = egLegionRaise(F, [EG_KIND.caster, EG_KIND.caster, EG_KIND.caster], [[spring.x, spring.z, -27.7]], w.clock.now, []);
  assert.equal(egLegionRoom(F), room0 - 3, 'the same bodies under the cap');
  assert.deepEqual([a.x, a.z, a.y, a.stand, a.pinned, a.ov], [111.75, 34.02, -24.1, 1, 1, -27.7]);
  assert.deepEqual([b.x, b.z, b.y, b.stand, b.pinned], [62.75, 34.02, -24.1, 2, 1]);
  assert.equal(c.stand, undefined, 'both stands held: at its wave\'s spot');
  assert.equal(c.pinned, undefined);
  assert.ok(Math.hypot(c.x - spring.x, c.z - spring.z) < 2 && c.y === -27.7);
  // the arrival plate is no chamber's: a Caster risen there (a Vigil's escort) rises there, a stand free or not
  b.hp = 0;
  assert.equal(egStandFree(F, spec.arrive.x, spec.arrive.z, spec.arrive.y), -1);
  const [p] = egLegionRaise(F, [EG_KIND.caster], [[spec.arrive.x, spec.arrive.z, spec.arrive.y]], w.clock.now, []);
  assert.equal(p.stand, undefined);
  assert.ok(Math.hypot(p.x - spec.arrive.x, p.z - spec.arrive.z) < 2);
  // the fallen one's stand taken again by the next risen in the chamber
  assert.equal(egStandFree(F, spring.x, spring.z, -27.7), 1);
  const [b2] = egLegionRaise(F, [EG_KIND.caster], [[spring.x + 3, spring.z, -27.7]], w.clock.now, []);
  assert.deepEqual([b2.x, b2.z, b2.y, b2.stand], [62.75, 34.02, -24.1, 2]);
  for (const q of [c, p]) q.hp = 0;   // only the stands' two this pin watches
  // the company at the court's heart, 24.5 m from each balcony: each Caster would close to its range - pinned, it keeps its balcony
  w.put('acct-0', 87.25, 34.02, -27.7); w.put('acct-1', 88.25, 34.02, -27.7);
  const n0 = w.frames.length;
  for (let k = 0; k < 120 && w.B.sg === 'trial'; k++) {
    w.step();
    for (const q of [a, b2].filter((q) => q.hp > 0)) {
      const st = S[q.stand - 1];
      assert.ok(Math.hypot(q.x - st[0], q.z - st[1]) <= EG_BALCONY_R_CM / 100 && q.y === -24.1, `a Caster keeps its balcony (${q.x}, ${q.y}, ${q.z})`);
    }
  }
  const bolts = w.frames.slice(n0).filter((f) => f.k === 'eb' && (f.o === a.i || f.o === b2.i));
  assert.ok(bolts.length >= 4, `${bolts.length} Bolts from the balconies in 30 s`);
  assert.equal(EG_LEGION_KINDS[EG_KIND.caster].blow.r, 3, 'THE WIDTH RULE: 6 m across');
  for (const f of bolts) {
    assert.equal(f.y, -27.7, 'on the court, never the balcony\'s height');
    assert.equal(f.s[0][0], 'd');
    assert.ok([[87.25, 34.02], [88.25, 34.02]].some(([x, z]) => f.s[0][1] === x && f.s[0][2] === z), 'at its mark\'s feet');
  }
  assert.equal(w.bad(), 0);
});

test('EG-PERFECT A STAND 4 M UP OVERLOOKS ITS FLOOR (sections 11.4 and 11.7; Elite-Gates-Ascent.md section 2): seed 2\'s hall 57 - a Deepway\'s Eclipse Vault, its balcony 4.0 m over its floor, a storey apart by the walk graph\'s own measure (EG_STACK_M) - its Caster on the stand bolts the floor the balcony overlooks, its Bolt at that floor\'s height (mutants: the stand\'s overlook dropped - a Bolt only at its own storey)', () => {
  const w = at(2, 57, 1), F = w.B.F, spec = w.spec;
  assert.deepEqual(F.stands.map((q) => q.slice(0, 4)), [[18.5, 53, 4, 0]]);
  const [a] = egLegionRaise(F, [EG_KIND.caster], [[0, 53, 0]], w.clock.now, []);
  assert.deepEqual([a.x, a.z, a.y, a.stand, a.ov], [18.5, 53, 4, 1, 0]);
  w.put('acct-0', 4.5, 53, 0);   // on the chamber's floor, 14 m from the stand: in the Caster's range
  assert.ok(egOnFight(spec, 4.5, 53, 0, 0));
  const n0 = w.frames.length;
  for (let k = 0; k < 80 && a.hp > 0 && w.B.sg === 'trial'; k++) w.step();
  const bolts = w.frames.slice(n0).filter((f) => f.k === 'eb' && f.o === a.i);
  assert.ok(bolts.length >= 2, `${bolts.length} Bolts over the floor in 20 s`);
  assert.ok(bolts.every((f) => f.y === 0 && f.s[0][1] === 4.5 && f.s[0][2] === 53));
  assert.equal(w.bad(), 0);
});
