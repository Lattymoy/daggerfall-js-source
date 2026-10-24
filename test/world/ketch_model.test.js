// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 3): THE SHIP AS BUILT AGAINST ITS DECK PLAN - a foot finds
// every floor where the plan says it stands (the Anchor Deck, the waist, the gun deck and its landing, the hold, the main
// top and its yard, the gangway, the bridge's core), the hatches open in the floor, the quarter wall closing the waist,
// nothing under the Sailwalk but sky, the bridge's outer ring its sections' own (they fall), every part solid where it
// must be; the course a body can run - its gaps within the Hour's envelope, its drops under the fall that hurts.
// tools/mutants/ketch_model.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKetchShip, buildKetchParts, KT_FLOOR_T } from '../../src/world/ketch/ketchModel.js';
import {
  deckToDungeon, KT_WAIST, KT_HATCH, KT_HOLD_HATCH, KT_QUARTER_WALL, KT_MAIN_TOP, KT_YARD, KT_GANGWAY, KT_BRIDGE, KT_COURSE, KT_COURSE_SPEC,
  KT_SECTIONS, KT_RESONATORS, sectionAt, KT_LIFT,
} from '../../src/net/ketch/ketchDeck.js';
import { EG_GAP_MIN_CM, EG_GAP_MAX_CM } from '../../src/net/eliteGates/egSpanLaw.js';
import { FALL_DAMAGE_THRESHOLD } from '../../src/player/motor.js';
import { ketchShipLocation } from '../../src/world/ketch/ketchShip.js';
import { madeDungeon, dungeonTierLabel } from '../../src/world/dungeon/dungeonLabel.js';

const ship = buildKetchShip();
/** The nearest hit of a ray from deck point `o` along `d` on a triangle soup (the dungeon's frame), as the deck's distance. */
function cast(hit, o, d, max = 200) {
  const O = deckToDungeon(...o), best = { t: Infinity };
  for (let i = 0; i < hit.length; i += 9) {
    const ax = hit[i], ay = hit[i + 1], az = hit[i + 2];
    const e1 = [hit[i + 3] - ax, hit[i + 4] - ay, hit[i + 5] - az], e2 = [hit[i + 6] - ax, hit[i + 7] - ay, hit[i + 8] - az];
    const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
    if (Math.abs(det) < 1e-9) continue;
    const s = [O[0] - ax, O[1] - ay, O[2] - az], u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det;
    if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
    if (v < 0 || u + v > 1) continue;
    const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
    if (t > 1e-6 && t < best.t) best.t = t;
  }
  return best.t <= max ? best.t : null;
}
/** The floor's height under deck point (x, z), looking down from `from`. */
const floorAt = (hit, x, z, from) => { const t = cast(hit, [x, from, z], [0, -1, 0]); return t == null ? null : Math.round((from - t) * 100) / 100 + 0; };

test('KETCH A FOOT FINDS EVERY FLOOR WHERE THE PLAN SAYS: the Anchor Deck and the waist at 0, the gun deck and its landing at -6, the hold at -12, the main top and its yard at the lift\'s head, the gangway and the bridge\'s core at 0 (mutants: the hold a deck high; the yard missing)', () => {
  const H = ship.hit;
  assert.equal(floorAt(H, 0, 6, 3), 0, 'the Anchor Deck');
  assert.equal(floorAt(H, 0, 20, 3), 0, 'the waist');
  assert.equal(floorAt(H, 0, 80, -3), -6, 'the gun deck');
  assert.equal(floorAt(H, 6, 120, -3), -6, 'the landing');
  assert.equal(floorAt(H, 0, 100, -9), -12, 'the hold');
  assert.equal(floorAt(H, KT_MAIN_TOP.x + 4.5, KT_MAIN_TOP.z, KT_MAIN_TOP.y + 3), KT_MAIN_TOP.y, 'the main top');
  assert.equal(floorAt(H, (KT_YARD.x0 + KT_YARD.x1) / 2, KT_YARD.z, KT_YARD.y + 3), KT_YARD.y, 'the yard');
  assert.equal(floorAt(H, (KT_GANGWAY.ax + KT_GANGWAY.bx) / 2, (KT_GANGWAY.az + KT_GANGWAY.bz) / 2, 3), 0, 'the gangway');
  assert.equal(floorAt(H, KT_BRIDGE.x, KT_BRIDGE.z, 3), 0, 'the bridge\'s core');
  assert.ok(KT_FLOOR_T > 0);
});

test('KETCH THE WAYS DOWN AND THE WALLS: each hatch open in its floor (a stair under it, the grate its own part); the quarter wall closing the waist aft; the mast-lift\'s shaft open its height (mutants: the hatch floored over; the quarter wall missing)', () => {
  const H = ship.hit;
  const w = floorAt(H, 0, (KT_HATCH.z0 + KT_HATCH.z1) / 2, 3);
  assert.ok(w < -0.5 && w > -6.5, `under the Watch hatch a stair, not the deck (${w})`);
  const h = floorAt(H, 0, (KT_HOLD_HATCH.z0 + KT_HOLD_HATCH.z1) / 2, -3);
  assert.ok(h < -6.5 && h > -12.5, `under the hold hatch a stair (${h})`);
  const wall = cast(H, [0, 1, KT_WAIST.z1 - 4], [0, 0, 1]);
  assert.ok(wall != null && Math.abs(wall - (KT_QUARTER_WALL.z - (KT_WAIST.z1 - 4))) < 0.6, `the quarter wall at z ${KT_QUARTER_WALL.z}`);
  const shaft = floorAt(H, KT_LIFT.x, KT_LIFT.z, KT_LIFT.y1 - 1);
  assert.ok(shaft == null || shaft <= KT_LIFT.y0 + 0.01, 'the shaft open to the hold\'s floor (the cage its own part)');
  const P = buildKetchParts();
  assert.ok(P.grateWatch.hit.length > 0 && P.grateHold.hit.length > 0, 'the grates solid, apart');
  assert.ok(P.cage.hit.length > 0 && P.doors.hit.length > 0 && P.gateHold.hit.length > 0 && P.gateTop.hit.length > 0);
});

test('KETCH THE OPEN SKY AND THE FALLING RING: nothing under the Sailwalk but sky; the bridge\'s outer ring no floor of the ship\'s - each of its eight sections solid in its own part, a resonator on four of them (mutants: a section not solid)', () => {
  const H = ship.hit;
  for (const z of [70, 100, 140, 170]) assert.equal(floorAt(H, KT_COURSE_SPEC.x, z, KT_LIFT.y1 + 4), null, `open sky at z ${z}`);
  const ring = [KT_BRIDGE.x, KT_BRIDGE.z - (KT_BRIDGE.core + KT_BRIDGE.r) / 2];
  const f = floorAt(H, ring[0], ring[1], 3);
  assert.ok(f == null || f < -0.5, 'the ring\'s floor is its sections\'');
  const P = buildKetchParts();
  assert.equal(P.sections.length, KT_SECTIONS);
  for (let k = 0; k < KT_SECTIONS; k++) {
    const a = ((k + 0.5) * Math.PI) / 4, x = KT_BRIDGE.x + Math.sin(a) * 22, z = KT_BRIDGE.z + Math.cos(a) * 22;   // past the resonators' pylons (19 out)
    assert.equal(sectionAt(x, z), k);
    assert.equal(floorAt(P.sections[k].hit, x, z, 3), 0, `section ${k} solid`);
  }
  for (const [x, z] of KT_RESONATORS) assert.equal(sectionAt(x, z) % 2, 0, 'a resonator on 0, 2, 4, 6');
});

test('KETCH THE SAILWALK A BODY CAN RUN: every gap within the Hour\'s envelope; every step down under the fall that hurts; its last step at the bridge\'s deck (mutants: a gap past the envelope; the rigging dropping a body onto its health)', () => {
  let prev = null;
  for (const s of KT_COURSE.steps) {
    if (prev && prev.span === s.span) {   // across a section the top lies between (its own gaps the spec's `check` and the next piece's)
      const gap = (s.z - s.d / 2) - (prev.z + prev.d / 2);
      if (s.kind === 'riser') assert.ok(Math.abs(gap) < 1e-6, 'a riser climbed straight off the plate before it (the Hour\'s)');
      else assert.ok(gap * 100 >= EG_GAP_MIN_CM - 1 && gap * 100 <= EG_GAP_MAX_CM + 1, `gap before step ${s.i}: ${gap}`);
      assert.ok(prev.y - s.y < FALL_DAMAGE_THRESHOLD, `step ${s.i} drops ${prev.y - s.y}`);
      assert.ok(s.y - prev.y <= 2.31, `step ${s.i} rises at most the riser`);
    }
    prev = s;
  }
  for (const sec of KT_COURSE_SPEC.sections) if (sec.check != null) assert.ok(sec.check * 100 >= EG_GAP_MIN_CM && sec.check * 100 <= EG_GAP_MAX_CM, 'onto each top a jump');
  assert.ok(Math.abs(KT_COURSE.steps.at(-1).y) < 1e-9, 'down to the bridge\'s deck');
  assert.ok(KT_COURSE.checkpoints.every((c) => c.y >= 0));
});

test('KETCH A PLACE THE PORT MADE: her made location is no dungeon to tier - no "Regular Dungeon, Small" over her deck (the live run\'s banner) (mutants: the Ketch tiered)', () => {
  const loc = ketchShipLocation({ n: 1, owner: '0123456789abcdef' });
  assert.equal(madeDungeon(loc), true);
  assert.equal(dungeonTierLabel(loc), null);
});

test('KETCH THE SHAFT\'S GATES: the hold\'s open with the cage at its foot and the top\'s at the top while the lift runs - neither while it is dead, so no carrier steps off the hold\'s floor onto a dead cage; a cell carried off its deck is said lost, never let go (AUDIT KETCH L3-14; mutants: the hold\'s gate open on a dead lift; a lost cell said let go)', async () => {
  const { ketchShaftGates } = await import('../../src/scenes/ketch/ketchDeckHost.js');
  const { KT_LIFT } = await import('../../src/net/ketch/ketchDeck.js');
  const { KT_LINK_TEXT } = await import('../../src/net/ketch/ketchLink.js');
  assert.deepEqual(ketchShaftGates(KT_LIFT.y0, false), { hold: false, top: false }, 'dead at its foot: shut');
  assert.deepEqual(ketchShaftGates(KT_LIFT.y0, true), { hold: true, top: false });
  assert.deepEqual(ketchShaftGates(KT_LIFT.y1, true), { hold: false, top: true });
  assert.deepEqual(ketchShaftGates((KT_LIFT.y0 + KT_LIFT.y1) / 2, true), { hold: false, top: false }, 'between: both shut');
  assert.notEqual(KT_LINK_TEXT.dropped('Ann', 'left'), KT_LINK_TEXT.dropped('Ann', 'let'));
  assert.match(KT_LINK_TEXT.dropped('Ann', 'left'), /lost/);
});

test('KETCH THE CHECKPOINTS HANG FROM A SPAR: each checkpoint\'s three chains run from inside its floor\'s rim up to the jackstay over it, and the jackstay runs over the Sailwalk\'s line from the main mast\'s vane-spar to the mizzen\'s - never into the empty sky (AUDIT KETCH L4-13; mutants: a chain\'s head in the sky; the mizzen\'s spar short of the line)', async () => {
  const { KT_MASTS, KT_JACKSTAY, KT_VANE_DZ, jackstayY, ketchCheckpointChains } = await import('../../src/world/ketch/ketchModel.js');
  for (const [m, end] of [[KT_MASTS[0], KT_JACKSTAY.fore], [KT_MASTS[1], KT_JACKSTAY.aft]]) {
    const [lo, hi, reach] = m.vanes;
    assert.equal(end.y, (lo + hi) / 2, 'at its spar\'s height');
    assert.equal(end.z, m.z + KT_VANE_DZ, 'in its spar\'s plane');
    assert.ok(KT_JACKSTAY.x > m.x && KT_JACKSTAY.x <= m.x + reach, `on its spar's run (x ${m.x}..${m.x + reach})`);
  }
  for (const c of KT_COURSE.checkpoints) {
    assert.ok(c.z > KT_JACKSTAY.fore.z && c.z < KT_JACKSTAY.aft.z, `checkpoint at z ${c.z} under the jackstay's run`);
    const chains = ketchCheckpointChains(c);
    assert.equal(chains.length, 3);
    for (const [foot, head] of chains) {
      assert.ok(Math.hypot(foot[0] - c.x, foot[2] - c.z) < c.r && Math.abs(foot[1] - c.y) < 0.2, 'its foot inside the floor\'s rim');
      assert.deepEqual(head, [KT_JACKSTAY.x, jackstayY(c.z), c.z], 'its head on the jackstay');
      assert.ok(head[1] > c.y + 10, 'well over the floor');
    }
  }
});

test('KETCH THE GANGWAY\'S SILL LIES ALONG ITS HEAD: every corner of the brass sill within a hand of the head\'s edge on the course\'s side, the sill the gangway\'s width - never square across the last plank\'s far edge in the air (AUDIT KETCH L4-14; mutants: the sill square to the deck)', async () => {
  const { ketchGangwaySill } = await import('../../src/world/ketch/ketchModel.js');
  const W = KT_GANGWAY, L = Math.hypot(W.bx - W.ax, W.bz - W.az), u = [(W.bx - W.ax) / L, (W.bz - W.az) / L], n = [-u[1], u[0]];
  const pts = ketchGangwaySill();
  assert.equal(pts.length, 4);
  const along = pts.map((p) => (p[0] - W.ax) * u[0] + (p[1] - W.az) * u[1]), across = pts.map((p) => (p[0] - W.ax) * n[0] + (p[1] - W.az) * n[1]);
  for (const a of along) assert.ok(a >= -0.31 && a <= 0.11, `a corner ${a.toFixed(2)} m off the head's edge`);
  assert.ok(Math.max(...across) >= W.w / 2 && Math.min(...across) <= -W.w / 2, 'the gangway\'s width');
});

test('KETCH THE PARKED CAGE\'S FLOOR OVER THE HOLD\'S: the cage\'s deck a hair over the hold\'s floor at the shaft\'s foot - never coplanar with it, the two fighting (AUDIT KETCH L4-9; mutants: the cage\'s floor at its own zero)', async () => {
  const { KT_CAGE_LIFT_M } = await import('../../src/world/ketch/ketchModel.js');
  const hold = floorAt(ship.hit, KT_LIFT.x + 1, KT_LIFT.z + 1, KT_LIFT.y0 + 1);
  assert.equal(hold, KT_LIFT.y0, 'the hold\'s floor under the shaft at the lift\'s foot');
  const { cage } = buildKetchParts();
  const pos = cage.model.positions;
  let top = -Infinity;
  for (let i = 1; i < pos.length; i += 3) if (pos[i] < 0.09) top = Math.max(top, pos[i]);   // the floor's top (the nets start at 0.1)
  assert.ok(Math.abs(top - KT_CAGE_LIFT_M) < 1e-4, `the floor's top at ${top}`);
  assert.ok(KT_LIFT.y0 + top - hold >= 0.015, 'drawn clear of the hold\'s floor');
});

test('KETCH THE LODESTONE BEHIND THE HELM: the stone the line\'s words name - blue aether in a brass hoop on a post - stands on the console behind the helm, its foot at the console\'s top, its stone clear over it (AUDIT KETCH L5-7; mutants: no stone)', async () => {
  const { KT_LODESTONE } = await import('../../src/world/ketch/ketchModel.js');
  const { KT_CONSOLE, KT_HELM } = await import('../../src/net/ketch/ketchDeck.js');
  const { KT_REC } = await import('../../src/world/ketch/ketchArt.js');
  const { lodestone } = buildKetchParts();
  assert.ok(lodestone?.model?.positions?.length > 0, 'a part');
  assert.ok(lodestone.model.subMeshes.some((m) => m.textureRecord === KT_REC.aether && m.primitiveCount >= 8), 'of aether');
  assert.ok(KT_LODESTONE.x > KT_CONSOLE.x0 && KT_LODESTONE.x < KT_CONSOLE.x1 && KT_LODESTONE.z > KT_CONSOLE.z0 && KT_LODESTONE.z < KT_CONSOLE.z1, 'on the console');
  assert.ok(KT_LODESTONE.z > KT_HELM.z, 'behind the helm');
  assert.equal(KT_LODESTONE.y, KT_BRIDGE.y + KT_CONSOLE.h, 'its foot on the console\'s top');
  let lo = Infinity; const p = lodestone.model.positions;
  for (let i = 1; i < p.length; i += 3) lo = Math.min(lo, p[i]);
  assert.ok(Math.abs(lo) < 1e-4, 'nothing of it under its foot');
  assert.ok(KT_LODESTONE.lift - KT_LODESTONE.r * 1.35 > 0.12, 'the stone clear over its foot');
  assert.ok(KT_LODESTONE.spin > 0, 'it turns');
});

test('KETCH THE BOSUN\'S LINE DRAWN ON ITS RIDER\'S PATH: every point of the path from the post to where it sets its rider down has the chain at it, and the chain runs to that landing - never to the gangway\'s old head (AUDIT KETCH L4-6; mutants: the chain to the old end)', async () => {
  const { bosunLineAt } = await import('../../src/world/ketch/ketchModel.js');
  const { line } = buildKetchParts(), p = line.model.positions;
  const near = (q) => { const Q = deckToDungeon(...q); let best = Infinity; for (let i = 0; i < p.length; i += 3) best = Math.min(best, Math.hypot(p[i] - Q[0], p[i + 1] - Q[1], p[i + 2] - Q[2])); return best; };
  for (let k = 0; k <= 16; k++) assert.ok(near(bosunLineAt(k / 16)) < 0.1, `the chain at the path's ${k}/16`);
  assert.ok(near([KT_GANGWAY.ax, 3, KT_GANGWAY.az + 1]) > 1, 'nothing at the old end');
});

test('KETCH-LOOK KL1 THE LAMPS WHERE THEY MEAN SOMETHING: 49 - 23 on her open decks, 24 below, 2 in the cabin; a lamp under each hammer row\'s middle housing, clear of its head\'s whole stroke, and the way-on lamp at the hatch\'s foot; the landing\'s four over its floor; one over each cradle and down the hold\'s middle, a ring of four round the engine, each hung from its ceiling on a rod; every glass clear of every collider and a body\'s head clear under it - the hold\'s stair kept free; their own mesh, never in the ship\'s, so no glass shadows its own light (mutants: a row\'s lamp in its head\'s stroke; the middle lamp over the stair; the lamps in the ship\'s mesh)', async () => {
  const { ketchLampSpots, ketchLights, KT_HUNG_LAMPS, KT_LAMP } = await import('../../src/world/ketch/ketchModel.js');
  const { KT_HAMMER_POSE } = await import('../../src/world/ketch/ketchPose.js');
  const { KT_HAMMER, KT_CRADLES, KT_ENGINE, KT_GALLERY, KT_HOLD } = await import('../../src/net/ketch/ketchDeck.js');
  const { KT_REC } = await import('../../src/world/ketch/ketchArt.js');
  const { up, below, cabin } = ketchLampSpots();
  assert.equal(up.length, 23, 'her open decks\' lamps where they were');
  assert.equal(below.length, 24, 'below decks');
  assert.equal(cabin.length, 2, 'the cabin');
  const lights = ketchLights();
  assert.equal(lights.length, 49);
  assert.deepEqual(['deck', 'below', 'cabin'].map((z) => lights.filter((l) => l.zone === z).length), [23, 24, 2], 'each lamp marked with the zone whose gain it takes');
  const g = KT_LAMP.glass, HEAD = 1.25;   // the head's half-width (buildKetchParts hammer)
  const has = (x, z, y0, y1) => below.some((p) => Math.abs(p[0] - x) < 1e-6 && Math.abs(p[2] - z) < 1e-6 && p[1] > y0 && p[1] < y1);
  for (const z of KT_HAMMER.rows) {
    assert.ok(has(0, z + KT_HUNG_LAMPS.rowDz, KT_GALLERY.y, -KT_FLOOR_T), `the row at ${z} has its lamp`);
    assert.ok(KT_HUNG_LAMPS.rowDz - g > HEAD + 0.1, 'clear of the head in z');
  }
  assert.ok(has(0, KT_HUNG_LAMPS.wayOnZ, KT_GALLERY.y, -KT_FLOOR_T), 'the way-on lamp');
  assert.ok(KT_HUNG_LAMPS.wayOnZ > KT_HATCH.z1 && KT_HUNG_LAMPS.wayOnZ + g < KT_HAMMER.rows[0] - HEAD, 'at the stair\'s foot, clear of the first row\'s head');
  for (const z of KT_HUNG_LAMPS.landing.z) for (const sx of [-1, 1]) assert.ok(has(sx * KT_HUNG_LAMPS.landing.x, z, KT_GALLERY.y, -KT_FLOOR_T), 'the landing\'s');
  assert.ok(KT_HAMMER_POSE.top + 0.9 > -KT_FLOOR_T - KT_HUNG_LAMPS.drop - g, 'the head\'s stroke reaches the lamp\'s height - only z keeps them apart');
  for (const [x, z] of KT_CRADLES) assert.ok(has(Math.sign(x) * KT_HUNG_LAMPS.cradleX, z, KT_HOLD.y, KT_GALLERY.y), `a lamp over the cradle at ${x}, ${z}`);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) assert.ok(has(KT_ENGINE.x + sx * KT_HUNG_LAMPS.engine, KT_ENGINE.z + sz * KT_HUNG_LAMPS.engine, KT_HOLD.y, KT_GALLERY.y), 'the engine\'s ring');
  const hung = below.filter((p) => p.length > 3);
  assert.equal(hung.length, below.length, 'every lamp below decks hangs');
  for (const p of hung) assert.ok(Math.abs(p[3] - (p[1] < KT_GALLERY.y ? KT_GALLERY.y - KT_FLOOR_T : -KT_FLOOR_T)) < 1e-6, 'from the ceiling over it');
  // every glass clear of every collider, and a body's head (2 m) clear under it
  const dist = (P, h) => {   // a point's distance to a triangle soup
    let best = Infinity;
    for (let i = 0; i < h.length; i += 9) {
      const A = [h[i], h[i + 1], h[i + 2]], B = [h[i + 3], h[i + 4], h[i + 5]], C = [h[i + 6], h[i + 7], h[i + 8]];
      const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      // Ericson's closest point on a triangle
      const ab = sub(B, A), ac = sub(C, A), ap = sub(P, A), d1 = dot(ab, ap), d2 = dot(ac, ap);
      let q;
      if (d1 <= 0 && d2 <= 0) q = A;
      else {
        const bp = sub(P, B), d3 = dot(ab, bp), d4 = dot(ac, bp), cp = sub(P, C), d5 = dot(ab, cp), d6 = dot(ac, cp);
        const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
        if (d3 >= 0 && d4 <= d3) q = B;
        else if (d6 >= 0 && d5 <= d6) q = C;
        else if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); q = [A[0] + ab[0] * v, A[1] + ab[1] * v, A[2] + ab[2] * v]; }
        else if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); q = [A[0] + ac[0] * w, A[1] + ac[1] * w, A[2] + ac[2] * w]; }
        else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); q = [B[0] + (C[0] - B[0]) * w, B[1] + (C[1] - B[1]) * w, B[2] + (C[2] - B[2]) * w]; }
        else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; q = [A[0] + ab[0] * v + ac[0] * w, A[1] + ab[1] * v + ac[1] * w, A[2] + ab[2] * v + ac[2] * w]; }
      }
      best = Math.min(best, Math.hypot(P[0] - q[0], P[1] - q[1], P[2] - q[2]));
    }
    return best;
  };
  for (const p of [...up, ...below, ...cabin]) {
    { const d = dist(deckToDungeon(p[0], p[1], p[2]), ship.hit); assert.ok(d > g, `the lamp at ${p.slice(0, 3)} clear of every collider (${d.toFixed(3)})`); }
    const f = floorAt(ship.hit, p[0], p[2], p[1] - g - 0.01);
    assert.ok(f == null || p[1] - g - f >= 2, `a body's head clear under the lamp at ${p.slice(0, 3)} (its floor ${f})`);
  }
  // no glass in the ship's own mesh (it casts): every lamp's glass texels are the lamps' mesh's
  const glassIn = (m) => m.subMeshes.filter((sm) => sm.textureRecord === KT_REC.lamp).reduce((a, sm) => a + sm.primitiveCount, 0);
  assert.equal(glassIn(ship.model), 0, 'no lamp glass in the mesh that casts');
  assert.equal(glassIn(ship.lamps), 49 * 12, 'every lamp\'s glass box in the lamps\' own');
});
