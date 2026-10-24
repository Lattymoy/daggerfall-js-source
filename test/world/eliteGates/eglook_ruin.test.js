// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md section 3,
// with section 1's forms and 1.5's Brink): THE RUIN (world/eliteGates/egRuin.js) - the academy that is not the law, a mesh a hall: the
// foundations under every floor, the cornices under every edge, the bridges under every way, the column rings with the
// lamps on them, the plates' arches, the statues, banners and the band's own things. The laws, not the pixels: nothing of
// it above a floor's top inside that floor's footprint and nothing through another floor (every disc, band, lane and ramp,
// judged here by this file's own geometry), nothing in a passage or a hero's room, nothing tall within 4 m of a way onto a
// disc; every cornice under its floor's top and within the Hour's teeth's reach; every disc's lamp on a column, at its
// fixture, tinted the band's, the count and the budget as they were; the worker's build the main thread's byte for byte;
// the budget a hall; a Brink hall's two bands; the lite tier smaller; the tall pieces dithering out of the camera's way
// (scenes/eliteGates/egGroundLook.js on the circle's one pass - scenes/eliteGates/egCircleHost.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEgRuinParts, egRuinColumns, egRuinBudget, egRuinBands, egDiscLamps, egArchRise, EG_RUIN, EG_RUIN_CORNICE, EG_FIXTURE_V, EG_FIXTURE_FLAME } from '../../../src/world/eliteGates/egRuin.js';
import { egCircleLights, egToDungeon, egIsleDisc, egWallBand, egTubeBand, EG_LAMP, EG_LAMP_BUDGET } from '../../../src/world/eliteGates/egHall.js';
import { egCircleBuild, egCirclePartsTransfers } from '../../../src/world/eliteGates/egCircleParts.js';
import { egCircleSpecs, egBandOfHall, EG_BRINK_HALLS, EG_HALL_PITCH } from '../../../src/net/eliteGates/egLaw.js';
import { egBandArchive, EG_KIT_MAP, EG_DRESS } from '../../../src/world/eliteGates/egBandArt.js';
import { EG_KIT_RECORD, EG_KIT_RECORDS } from '../../../src/world/eliteGates/egKit.js';
import { egAtmosOf } from '../../../src/world/eliteGates/egAtmos.js';
import { createEgGroundLook } from '../../../src/scenes/eliteGates/egGroundLook.js';
import { createEgOccluders } from '../../../src/scenes/eliteGates/egOcclude.js';
import { SD_REALM_ORIGIN } from '../../../src/net/superDungeon/sdBrain.js';
import { egLawSeam } from '../../../src/net/eliteGates/egLaw.js';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins measure spec law 8's halls - drawn where no law is named
// (net/eliteGates/egLaw.js egLawSeam - a test's seam, never a breach's: a breach draws its own law), the dress, the camera and the client
// as they were written over law 8's ground; LAW 9's dress is THE DRESS slice's (Elite-Gates-Ascent.md section 8) and its
// ground test/net/eliteGates/law9_rooms.test.js's
egLawSeam(8);

const K = EG_KIT_RECORD;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** The circles judged: every band, the forked roads (a ground a seed), the Brinks. */
const CIRCLES = [[7, 1], [7, 3], [7, 5], [7, 6], [77, 8], [77, 11], [3, 13], [3, 16], [3, 18], [12345, 20], [2, 4], [2, 9], [1, 7], [1, 12]].map(([s, c]) => [s, c, c > 1 ? s % 9 : 0]);
const built = new Map();
const ruinOf = (seed, c, geo, lite = false) => { const k = `${seed}:${c}:${geo}:${lite}`; if (!built.has(k)) built.set(k, buildEgRuinParts(seed, c, geo, { lite })); return built.get(k); };

// ── the law's floors, this file's own geometry (net/eliteGates/egLaw.js egOnFloor's shapes; a ramp's quad, world/eliteGates/egHall.js rampCorners')
function floorsOf(spec) {
  const F = [];
  for (const d of spec.discs) F.push({ box: [d.x - d.r, d.z - d.r, d.x + d.r, d.z + d.r], top: d.y ?? 0, on: (x, z) => (x - d.x) ** 2 + (z - d.z) ** 2 <= d.r * d.r, at: () => d.y ?? 0 });
  for (const b of spec.bands) F.push({ box: [b.x - b.halfW, b.z0, b.x + b.halfW, b.z1], top: b.y ?? 0, on: (x, z) => Math.abs(x - b.x) <= b.halfW && z >= b.z0 && z <= b.z1, at: () => b.y ?? 0 });
  for (const l of spec.lanes ?? []) {
    const dx = l.bx - l.ax, dz = l.bz - l.az, L = dx * dx + dz * dz;
    const on = (x, z) => { const t = Math.max(0, Math.min(1, ((x - l.ax) * dx + (z - l.az) * dz) / L)); return Math.hypot(x - l.ax - dx * t, z - l.az - dz * t) <= l.hw; };
    F.push({ box: [Math.min(l.ax, l.bx) - l.hw, Math.min(l.az, l.bz) - l.hw, Math.max(l.ax, l.bx) + l.hw, Math.max(l.az, l.bz) + l.hw], top: l.y ?? 0, on, at: () => l.y ?? 0 });
  }
  for (const q of spec.ramps ?? []) {
    const dx = q.bx - q.ax, dz = q.bz - q.az, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    const s = (x, z) => (x - q.ax) * ux + (z - q.az) * uz, t = (x, z) => -(x - q.ax) * uz + (z - q.az) * ux;
    F.push({ box: [Math.min(q.ax, q.bx) - q.hw, Math.min(q.az, q.bz) - q.hw, Math.max(q.ax, q.bx) + q.hw, Math.max(q.az, q.bz) + q.hw], top: Math.min(q.y0, q.y1),
      on: (x, z) => s(x, z) >= 0 && s(x, z) <= L && Math.abs(t(x, z)) <= q.hw, at: (x, z) => q.y0 + (q.y1 - q.y0) * Math.max(0, Math.min(1, s(x, z) / L)) });
  }
  return F;
}
/** Every triangle of a ruin part in its hall's frame: `fn(ax, ay, az, bx, by, bz, cx, cy, cz, sub)`. */
function eachTri(part, spec, fn) {
  const P = part.model.positions, ox = SD_REALM_ORIGIN[0] + spec.x0, oz = SD_REALM_ORIGIN[2];
  part.model.subMeshes.forEach((sm, si) => {
    for (let k = sm.startIndex; k < sm.startIndex + sm.primitiveCount * 3; k += 3) {
      const i = part.model.indices[k] * 3, j = part.model.indices[k + 1] * 3, l = part.model.indices[k + 2] * 3;
      fn(P[i] - ox, P[i + 1], P[i + 2] - oz, P[j] - ox, P[j + 1], P[j + 2] - oz, P[l] - ox, P[l + 1], P[l + 2] - oz, si);
    }
  });
}
/** The ways onto a disc (net/eliteGates/egLaw.js egMoltenRim's ends, the steps' ends, the passages' mouths, the ring walls' gaps). */
function waysOf(spec) {
  const W = [];
  for (const q of spec.steps ?? []) { const hw = q.w / 2 + (q.amp ?? 0); W.push([q.x, q.z - q.d / 2, hw], [q.x, q.z + q.d / 2, hw]); if ((q.road ?? 0) === 0 && q.after > 0) W.push([q.x, q.z + q.d / 2 + q.after, q.w / 2]); }
  for (const l of spec.lanes ?? []) W.push([l.ax, l.az, l.hw], [l.bx, l.bz, l.hw]);
  for (const b of spec.bands) W.push([b.x, b.z0, b.halfW], [b.x, b.z1, b.halfW]);
  for (const q of spec.ramps ?? []) W.push([q.ax, q.az, q.hw], [q.bx, q.bz, q.hw]);
  for (const q of spec.caves ?? []) W.push([q.x, q.z0, q.halfW + 0.6], [q.x, q.z1, q.halfW + 0.6]);
  for (const d of spec.deco ?? []) if (d.t === 'wall' || d.t === 'tiers') W.push([d.x, d.z - d.r, 0.2 * d.r], [d.x, d.z + d.r, 0.2 * d.r]);
  return W;
}

test('EG-LOOK THE RUIN\'S LAW (Elite-Gates-Look.md section 3: "none of it is a collider; all of it stands outside every floor\'s footprint in plan, or below every floor\'s top", "nothing of it pokes through another floor of the hall"): over circles of every band, every triangle of every hall\'s ruin - its corners, its edges\' middles and its centre - stands at or under the top of every disc, band, lane and ramp whose footprint holds it, and none inside a passage\'s room or a hero\'s box; the ruin is no collider (the circle\'s collider\'s triangles are the circle\'s alone); and the law keeps what the ruin lays - every cornice run, every bridge\'s bay, all but a few foundation pieces (mutants: the law\'s judge asleep; the cornice cut where it meets another floor no more; a foundation\'s top over its lip; a bridge laid through a box)', () => {
  let tris = 0, judged = 0;
  for (const [seed, c, geo] of CIRCLES) {
    const specs = egCircleSpecs(seed, c, geo), parts = ruinOf(seed, c, geo);
    assert.deepEqual(parts.map((p) => p.h), specs.map((s) => s.h), 'a part a hall');
    for (const [i, part] of parts.entries()) {
      const spec = specs[i], F = floorsOf(spec);
      assert.equal(part.x0, spec.x0);
      const rooms = [...(spec.caves ?? []).filter((q) => !q.open).map((q) => [q.x - q.halfW, Math.min(q.y, q.yB ?? q.y) + 0.05, q.z0 + 0.05, q.x + q.halfW, Math.max(q.y, q.yB ?? q.y) + q.height - 0.05, q.z1 - 0.05]), ...(spec.heroes ?? []).map((q) => q.box)];
      const bad = (x, y, z) => {
        for (const f of F) if (x >= f.box[0] && x <= f.box[2] && z >= f.box[1] && z <= f.box[3] && f.on(x, z) && y > f.at(x, z) + 1e-3) return `over a floor at ${[x, y, z].map((v) => v.toFixed(2))}`;
        for (const b of rooms) if (x > b[0] && x < b[3] && y > b[1] && y < b[4] && z > b[2] && z < b[5]) return `in a room at ${[x, y, z].map((v) => v.toFixed(2))}`;
        return '';
      };
      eachTri(part, spec, (ax, ay, az, bx, by, bz, cx, cy, cz) => {
        tris++;
        const top = Math.max(ay, by, cy), x0 = Math.min(ax, bx, cx), x1 = Math.max(ax, bx, cx), z0 = Math.min(az, bz, cz), z1 = Math.max(az, bz, cz);
        if (!F.some((f) => top > f.top + 1e-3 && f.box[0] <= x1 && f.box[2] >= x0 && f.box[1] <= z1 && f.box[3] >= z0) && !rooms.some((b) => b[0] < x1 && b[3] > x0 && b[2] < z1 && b[5] > z0)) return;
        judged++;
        for (const p of [[ax, ay, az], [bx, by, bz], [cx, cy, cz], [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2], [(bx + cx) / 2, (by + cy) / 2, (bz + cz) / 2], [(ax + cx) / 2, (ay + cy) / 2, (az + cz) / 2], [(ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3]]) {
          const why = bad(...p);
          assert.equal(why, '', `seed ${seed} circle ${c} hall ${spec.h}: the ruin ${why}`);
        }
      });
    }
    assert.equal(egCircleBuild({ seed, c, geo }).tris.length, egCircleBuild({ seed, c, geo }).tris.length, 'the collider the circle\'s alone');
  }
  assert.ok(tris > 400000 && judged > 2000, `the ruins judged (${tris} triangles, ${judged} near a floor)`);
  // the judge's rollback is its last word, never the ruin's way of keeping the law: the cornices are cut where another
  // floor meets them, so the law keeps every run; a foundation's top is laid under its lip, so the law keeps all but a few
  // of its pieces (a raised disc's over a lower floor); a bridge's run is cut where a box the law keeps stands under its
  // deck (a step's body, a passage's walls, a chamber, a piece that falls), so the law keeps every bay
  const kept = { foundation: [0, 0], cornice: [0, 0], bridge: [0, 0] };
  for (const [seed, c, geo] of CIRCLES) for (const h of egRuinBudget(seed, c, geo)) for (const k of Object.keys(kept)) { const e = h.kinds[k]; if (e) { kept[k][0] += e.kept; kept[k][1] += e.cut; } }
  assert.ok(kept.cornice[0] > 500 && kept.cornice[1] === 0, `every cornice run kept by the law (${kept.cornice})`);
  assert.ok(kept.bridge[0] > 200 && kept.bridge[1] === 0, `every bridge's bay kept by the law (${kept.bridge})`);
  assert.ok(kept.foundation[0] > 1500 && kept.foundation[1] / (kept.foundation[0] + kept.foundation[1]) < 0.03, `the foundations kept by the law (${kept.foundation})`);
});

test('EG-LOOK THE WAYS KEPT CLEAR (section 3.3: "never within 4 m of a way onto the disc"): every column, statue, arch and the band\'s things of every hall\'s plan (world/eliteGates/egRuin.js egRuinColumns) stands its own radius and EG_RUIN.wayPad clear of every way onto a disc - the course\'s landings and every step\'s ends, the lanes\', bands\' and stairs\' ends, the passages\' mouths, the ring walls\' gaps - and out of every floor\'s footprint (mutants: the ways\' pad let go; a column stood on its floor\'s edge)', () => {
  assert.equal(EG_RUIN.wayPad, 4);
  let n = 0;
  for (const [seed, c, geo] of CIRCLES) for (const spec of egCircleSpecs(seed, c, geo)) {
    const plan = egRuinColumns(spec), W = waysOf(spec), F = floorsOf(spec);
    const tall = [...plan.cols.map((q) => [q.x, q.z, q.kind === 'statue' ? 1.3 : q.rad, q.kind]), ...plan.arches.flatMap((q) => [[q.x, q.z - q.w / 2 - 0.4, 0.6, 'arch'], [q.x, q.z + q.w / 2 + 0.4, 0.6, 'arch']]), ...plan.among.map((q) => [q.x, q.z, 1.4, 'among'])];
    for (const [x, z, r, kind] of tall) {
      n++;
      for (const [wx, wz, hw] of W) assert.ok(Math.hypot(x - wx, z - wz) - hw >= EG_RUIN.wayPad + r - 1e-9, `seed ${seed} hall ${spec.h}: a ${kind} ${(Math.hypot(x - wx, z - wz) - hw).toFixed(2)} m from a way`);
      for (const f of F) assert.ok(!f.on(x, z), `seed ${seed} hall ${spec.h}: a ${kind} on a floor`);
    }
  }
  assert.ok(n > 500, `${n} tall pieces`);
});

test('EG-LOOK THE PIECES THAT FALL (the spans\' own - scenes/eliteGates/egSpan.js stands each with its own cornice and torn foundation, and fells it; a ruin under one would hang in the air after it goes): no foundation, bridge, cornice, column or anything of the ruin under or in Grath\'s islands (world/eliteGates/egHall.js egIsleDisc), the Falling Wall\'s walkway (egWallBand) or the Collapsing Tube\'s floor (egTubeBand) - not a corner of a triangle inside one\'s footprint at or under its top, down the whole deep; no column ring, lamp column or band\'s thing planned round an island that falls (its lamps where egCircleLights had them); and the pieces beside them still stand (mutants: an island that falls given its ring; the ruin laid under a falling piece)', () => {
  const seen = { isle: 0, wall: 0, tube: 0 };
  let near = 0;
  for (const [seed, c, geo] of CIRCLES) {
    const specs = egCircleSpecs(seed, c, geo), parts = ruinOf(seed, c, geo), lights = egCircleLights(seed, c, geo);
    for (const [i, spec] of specs.entries()) {
      const plan = egRuinColumns(spec), fall = [];
      spec.discs.forEach((d, di) => {
        if (!egIsleDisc(spec, d)) return;
        seen.isle++;
        fall.push({ y: d.y ?? 0, on: (x, z) => Math.hypot(x - d.x, z - d.z) < d.r, by: (x, z) => Math.hypot(x - d.x, z - d.z) < d.r + 3 });
        assert.equal(plan.cols.filter((q) => q.d === di).length + plan.among.filter((q) => q.d === di).length, 0, `seed ${seed} hall ${spec.h}: no ring round an island that falls`);
        let lit = 0;   // its lamps where they were (the budget thins a ring by its spread order - world/eliteGates/egHall.js)
        for (let k = 0; k < egDiscLamps(d); k++) {
          const a = (k / egDiscLamps(d)) * Math.PI * 2 + Math.PI / 4, w = egToDungeon(spec, d.x + Math.cos(a) * (d.r - 1), (d.y ?? 0) + EG_LAMP.h, d.z + Math.sin(a) * (d.r - 1));
          if (lights.some((q) => Math.hypot(q.x - w[0], q.y - w[1], q.z - w[2]) < 1e-6)) lit++;
        }
        assert.ok(lit >= 1, `seed ${seed} hall ${spec.h}: an island's lamps where they were`);
      });
      for (const b of spec.bands) {
        const wall = egWallBand(spec, b), tube = egTubeBand(b);
        if (!wall && !tube) continue;
        seen[wall ? 'wall' : 'tube']++;
        fall.push({ y: b.y ?? 0, on: (x, z) => Math.abs(x - b.x) < b.halfW && z > b.z0 && z < b.z1, by: (x, z) => Math.abs(x - b.x) < b.halfW + 3 && z > b.z0 - 3 && z < b.z1 + 3 });
      }
      if (!fall.length) continue;
      eachTri(parts[i], spec, (...t) => {
        for (const f of fall) {
          for (let k = 0; k < 9; k += 3) {
            if (f.by(t[k], t[k + 2])) near++;
            assert.ok(!(f.on(t[k], t[k + 2]) && t[k + 1] <= f.y + 1e-3), `seed ${seed} hall ${spec.h}: the ruin under a piece that falls at ${[t[k], t[k + 1], t[k + 2]].map((v) => v.toFixed(2))}`);
          }
        }
      });
    }
  }
  assert.ok(seen.isle >= 3 && seen.wall >= 3 && seen.tube >= 1, `the pieces that fall judged (${JSON.stringify(seen)})`);
  assert.ok(near > 1000, `the ruin beside them still standing (${near} corners within 3 m)`);
});

test('EG-LOOK THE CORNICES (section 3.2: "its top 0.02 m under the edge line\'s strip, outside the floor by at most 0.35 m, never above the floor"): under every edge of every standing disc the moulding runs round its rim (where no other floor meets it), every corner of it at or under the floor\'s top less EG_RUIN_CORNICE.under and within EG_RUIN_CORNICE.reach of its circle; and every face of it in a band of the moulding\'s picture (EG_KIT_MAP), its v down the profile (mutants: the cornice over the floor; its reach past the teeth\'s)', () => {
  assert.deepEqual([EG_RUIN_CORNICE.under, EG_RUIN_CORNICE.reach], [0.002, 0.35]);
  let rims = 0, corners = 0;
  for (const [seed, c, geo] of CIRCLES.slice(0, 6)) {
    const specs = egCircleSpecs(seed, c, geo), parts = ruinOf(seed, c, geo);
    for (const [i, part] of parts.entries()) {
      const spec = specs[i];
      for (const d of spec.discs) {
        if (d.role === 'isle' && spec.kind === 'court') continue;   // Grath's islands fall: the spans stand them
        const y = d.y ?? 0;
        let near = 0;
        const others = floorsOf({ ...spec, discs: spec.discs.filter((q) => q !== d) });   // a band's or a lane's own cornice by it is theirs
        eachTri(part, spec, (...t) => {
          const sm = part.model.subMeshes[t[9]];
          if (sm.textureRecord !== K.moulding) return;
          for (let k = 0; k < 9; k += 3) {
            const dr = Math.hypot(t[k] - d.x, t[k + 2] - d.z) - d.r;
            if (dr < -0.08 || dr > 0.6 || t[k + 1] > y + 0.5 || t[k + 1] < y - 1) continue;
            if (others.some((f) => t[k] >= f.box[0] - 0.5 && t[k] <= f.box[2] + 0.5 && t[k + 2] >= f.box[1] - 0.5 && t[k + 2] <= f.box[3] + 0.5)) continue;
            near++; corners++;
            assert.ok(t[k + 1] <= y - EG_RUIN_CORNICE.under + 1e-4, `hall ${spec.h} ${d.role}: a cornice ${(t[k + 1] - y).toFixed(3)} m about its floor`);
            assert.ok(dr <= EG_RUIN_CORNICE.reach + 1e-4, `hall ${spec.h} ${d.role}: a cornice ${dr.toFixed(3)} m past its rim`);
          }
        });
        if (d.role === 'court' || d.role === 'arrive') { assert.ok(near > 50, `hall ${spec.h}: the ${d.role}'s rim corniced`); rims++; }
      }
    }
  }
  assert.ok(rims >= 8 && corners > 5000, `${rims} rims, ${corners} corners`);
  const bands = EG_KIT_MAP[K.moulding].bands;
  assert.deepEqual(Object.keys(bands), ['fillet', 'ornament', 'band', 'cove', 'torn'], 'the moulding\'s bands (EG_KIT_MAP)');
});

test('EG-LOOK THE LAMPS ON THEM (section 3.3: "egCircleLights stands each court\'s and plate\'s lamps on a column of its ring, at the column\'s top ... a lamp is a fixture you see - never a light in the air"): every disc\'s lamp stands on its ruin column at its fixture\'s flame (world/eliteGates/egRuin.js egRuinColumns lamp(d, k)), its column\'s top 2.6-3.4 m over the floor and outside every floor, its flame drawn there (the fixture record\'s flame cells on their crossed quad, cut out); the same columns on the lite tier; tinted the band\'s (world/eliteGates/egAtmos.js lamp); the count of lamps a disc and the budget as they were (mutants: a lamp left at the rim; the lamp the old gold; a lamp column dropped on the phones\' tier)', () => {
  let lamps = 0;
  for (const [seed, c, geo] of CIRCLES) {
    const specs = egCircleSpecs(seed, c, geo), L = egCircleLights(seed, c, geo), parts = ruinOf(seed, c, geo);
    for (const p of L) assert.ok(L.filter((q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) <= EG_LAMP_BUDGET.r).length <= EG_LAMP_BUDGET.n, 'the budget');
    for (const [i, spec] of specs.entries()) {
      const plan = egRuinColumns(spec), lite = egRuinColumns(spec, { lite: true }), F = floorsOf(spec);
      assert.deepEqual(lite.lamps, plan.lamps, `hall ${spec.h}: the lamps' columns the same on the phones' tier`);
      const flames = [];
      eachTri(parts[i], spec, (...t) => { const sm = parts[i].model.subMeshes[t[9]]; if (sm.textureRecord === K.fixture) flames.push(t); });
      spec.discs.forEach((d, di) => {
        for (let k = 0; k < egDiscLamps(d); k++) {
          const on = plan.lamp(di, k);
          if (egIsleDisc(spec, d)) { assert.equal(on, null, 'an island that falls: no column round it - its lamp where it was'); continue; }
          assert.ok(on, `seed ${seed} hall ${spec.h}: the ${d.role}'s lamp ${k} on a column`);
          lamps++;
          const col = plan.cols.find((q) => q.kind === 'lamp' && q.d === di && q.k === k), y = d.y ?? 0;
          assert.ok(col.top - y >= EG_RUIN.lampTop[0] - 1e-9 && col.top - y <= EG_RUIN.lampTop[1] + 1e-9, 'its column\'s top');
          for (const f of F) assert.ok(!f.on(col.x, col.z) && !f.on(on.at[0], on.at[2]), 'out of every floor');
          const w = egToDungeon(spec, on.at[0], on.at[1], on.at[2]), lit = L.find((q) => Math.hypot(q.x - w[0], q.y - w[1], q.z - w[2]) < 1e-6);
          if (lit) assert.deepEqual(lit.color, [...egAtmosOf(on.band).lamp], 'the band\'s tint');
          // its flame drawn: a fixture triangle about the light, in the flame cells
          const ox = on.at[0], oy = on.at[1], oz = on.at[2];
          assert.ok(flames.some((t) => [0, 3, 6].every((j) => Math.hypot(t[j] - ox, t[j + 2] - oz) < 0.6 && Math.abs(t[j + 1] - oy) < 0.7)), `seed ${seed} hall ${spec.h}: the ${d.role}'s lamp ${k}'s flame drawn`);
        }
      });
    }
  }
  assert.ok(lamps > 300, `${lamps} lamps`);
  assert.equal(egDiscLamps({ role: 'court' }) + egDiscLamps({ role: 'end' }) + egDiscLamps({ role: 'bastion' }) + egDiscLamps({ role: 'island' }), 9, 'the count a disc');
  assert.deepEqual(Object.keys(EG_FIXTURE_FLAME), ['tripod', 'lantern', 'moonlamp', 'basket']);
  assert.deepEqual([EG_FIXTURE_V.flame, EG_FIXTURE_V.cells], [EG_KIT_MAP[K.fixture].bands.flame, EG_KIT_MAP[K.fixture].cells]);
});

test('EG-LOOK THE RUIN BUILT IN THE WORKER (sections 3 and 3.6; Elite-Gates.md section 7): the swap\'s worker\'s build (world/eliteGates/egCircleParts.js egCircleBuild) carries the ruin a hall exactly as the main thread builds it, byte for byte, its buffers handed over; a second build the same bytes; every hall within its budget - at most 20,000 triangles and 14 draws (its sub-meshes), each in its band\'s archive and the kit\'s records (and the ashlar); the lite tier smaller (mutants: the budget let go; a Brink\'s draws past 14)', () => {
  const plain = (m) => JSON.stringify({ ...m, positions: Array.from(m.positions), normals: Array.from(m.normals), uvs: Array.from(m.uvs), indices: Array.from(m.indices) });
  for (const [seed, c, geo] of [[7, 6, 4], [3, 16, 3]]) {
    const w = egCircleBuild({ seed, c, geo }), main = buildEgRuinParts(seed, c, geo);
    assert.deepEqual(w.ruins.map((p) => [p.h, p.x0, plain(p.model), p.sphere]), main.map((p) => [p.h, p.x0, plain(p.model), p.sphere]), `seed ${seed} circle ${c}: the worker's ruin the main thread's`);
    const bufs = new Set(egCirclePartsTransfers(w));
    for (const p of w.ruins) for (const k of ['positions', 'normals', 'uvs', 'indices']) assert.ok(bufs.has(p.model[k].buffer), 'handed over');
    assert.deepEqual(buildEgRuinParts(seed, c, geo).map((p) => plain(p.model)), main.map((p) => plain(p.model)), 'the same bytes again');
  }
  assert.deepEqual([EG_RUIN.tris, EG_RUIN.trisLite], [20000, 12000]);
  const allowed = new Set([...EG_KIT_RECORDS, EG_DRESS.pillar]);
  let worst = 0, draws = 0;
  for (const [seed, c, geo] of CIRCLES) {
    const specs = egCircleSpecs(seed, c, geo), desk = ruinOf(seed, c, geo), lite = ruinOf(seed, c, geo, true);
    for (const [i, p] of desk.entries()) {
      const n = p.model.indices.length / 3, ln = lite[i].model.indices.length / 3, spec = specs[i];
      worst = Math.max(worst, n); draws = Math.max(draws, p.model.subMeshes.length);
      assert.ok(n <= EG_RUIN.tris && n > 1000, `hall ${spec.h}: ${n} triangles`);
      assert.ok(ln <= EG_RUIN.trisLite && ln < n, `hall ${spec.h}: the lite tier ${ln} of ${n}`);
      assert.ok(p.model.subMeshes.length <= 14, `hall ${spec.h}: ${p.model.subMeshes.length} draws`);
      const archives = new Set(egRuinBands(c).map(egBandArchive));
      for (const sm of p.model.subMeshes) { assert.ok(archives.has(sm.textureArchive), 'its band\'s archive'); assert.ok(allowed.has(sm.textureRecord), `record ${sm.textureRecord}`); }
      if (!EG_BRINK_HALLS.includes(spec.h)) assert.ok(p.model.subMeshes.every((sm) => sm.textureArchive === egBandArchive(egBandOfHall(spec.h))), 'one band');
      const [x, , z, r] = p.sphere;
      assert.ok(Math.abs(x - (SD_REALM_ORIGIN[0] + spec.x0)) < EG_HALL_PITCH / 2 && r < EG_HALL_PITCH / 2 && Number.isFinite(z), 'its sphere about its hall');
    }
  }
  assert.ok(worst > 15000 && draws >= 10, `the budget used (${worst} triangles, ${draws} draws at the most)`);
  // the budget's measure, kind by kind
  const b = egRuinBudget(7, 1, 0);
  assert.equal(b.length, 5);
  for (const h of b) assert.ok(h.tris <= EG_RUIN.tris && h.kinds.foundation?.kept > 0 && h.kinds.cornice?.kept > 0, `hall ${h.h}: its foundations and cornices`);
});

test('EG-LOOK THE BRINK (section 1.5: "its first third wears the band above\'s dress, its last third the band below\'s, and the middle mixes them by the hall\'s own seed, piece by piece"): each Brink hall\'s ruin is laid in both bands\' archives - every corner of its first third\'s pieces in the band above\'s, its last third\'s in its own; every other hall in its own alone; and the circle\'s host puts up both dresses for a Brink circle (mutants: the first third in the new band; the host\'s dress of the band above forgotten)', () => {
  assert.deepEqual([...EG_BRINK_HALLS], [26, 51, 76]);
  for (const [seed, c] of [[7, 6], [3, 11], [77, 16]]) {
    const spec = egCircleSpecs(seed, c, 0)[0], part = ruinOf(seed, c, 0)[0] ?? buildEgRuinParts(seed, c, 0)[0], band = egBandOfHall(spec.h);
    assert.ok(EG_BRINK_HALLS.includes(spec.h));
    assert.deepEqual(egRuinBands(c), [band - 1, band]);
    const seen = new Set();
    eachTri(part, spec, (ax, ay, az, bx, by, bz, cx, cy, cz, si) => {
      const arch = part.model.subMeshes[si].textureArchive, z = (az + bz + cz) / 3;
      seen.add(arch);
      if (z < spec.len / 3 - 3) assert.equal(arch, egBandArchive(band - 1), `hall ${spec.h}: the first third the band above's (z ${z.toFixed(1)})`);
      if (z > (2 * spec.len) / 3 + 3) assert.equal(arch, egBandArchive(band), `hall ${spec.h}: the last third its own`);
    });
    assert.deepEqual([...seen].sort(), [egBandArchive(band - 1), egBandArchive(band)].sort(), 'both bands');
    assert.deepEqual(egRuinBands(c + 1), [band]);
  }
  const EC = rd('src/scenes/eliteGates/egCircleHost.js');
  assert.match(EC, /egBandUp\(eh\.c\);[^\n]*\n    if \(eh\.c > 1\) egBandUp\(eh\.c - 1\);/, 'the circle\'s host puts up a Brink\'s band above at its stand (a swap from the circle before has it up)');
  assert.match(rd('src/tools/spireLab.js'), /for \(const b of egRuinBands\(C\)\) if \(b !== BAND\) for \(const \[rec, art\] of egBandArt\(b\)\) \{ renderer\.uploadTexture\(egBandArchive\(b\)/, 'the lab too');
});

test('EG-LOOK LITE AND THE BAND\'S FORMS (section 3.5: "one spire a foundation, columns every 12 m, no statues or banners, bridges\' arches every 12 m"; section 1): the phones\' tier stands fewer columns, no statue and no banner, its lamps\' columns the same; a ring\'s columns 6-9 m apart on the desktop; each band\'s arch its own rise; the ruin\'s pictures worn as EG_KIT_MAP says - a shaft\'s v up it, a banner\'s down from its rod, a flame\'s in its cells (mutants: lite\'s columns at the desktop\'s pitch; statues on the phones; a shaft worn upside down)', () => {
  let desk = 0, lite = 0, statues = 0;
  for (const [seed, c, geo] of CIRCLES) for (const spec of egCircleSpecs(seed, c, geo)) {
    const D = egRuinColumns(spec), Lt = egRuinColumns(spec, { lite: true });
    desk += D.cols.length; lite += Lt.cols.length; statues += D.cols.filter((q) => q.kind === 'statue').length;
    assert.equal(Lt.cols.filter((q) => q.kind === 'statue').length, 0, 'no statue on the phones');
    for (const q of D.cols.filter((p) => p.n)) { const arc = (2 * Math.PI * q.ring) / q.n; assert.ok(arc >= EG_RUIN.pitch[0] * 0.8 && arc <= EG_RUIN.pitch[1] * 1.25, `a ring's arc ${arc.toFixed(1)} m`); }
    for (const q of Lt.cols.filter((p) => p.n)) assert.ok((2 * Math.PI * q.ring) / q.n >= EG_RUIN.pitchLite * 0.8, 'the phones\' pitch');
  }
  assert.ok(lite < desk * 0.8 && statues >= 6, `${lite} columns on the phones of ${desk}, ${statues} statues`);
  for (const [seed, c, geo] of CIRCLES.slice(0, 5)) for (const p of ruinOf(seed, c, geo, true)) assert.ok(p.model.subMeshes.every((sm) => sm.textureRecord !== K.banner), 'no banner on the phones');
  assert.deepEqual(['round', 'pointed', 'lancet', 'squat'].map((s) => +egArchRise(s, 6).toFixed(3)), [3, 5.196, 6.148, 1.5]);
  // the pictures' ways: a shaft's v rising up it, a banner's falling from its rod, the flames within their cells
  const spec = egCircleSpecs(7, 1, 0)[0], part = ruinOf(7, 1, 0)[0], UV = part.model.uvs;
  let shafts = 0, banners = 0;
  part.model.subMeshes.forEach((sm) => {
    for (let k = sm.startIndex; k < sm.startIndex + sm.primitiveCount * 3; k += 3) {
      const v = [0, 1, 2].map((j) => part.model.indices[k + j]), y = v.map((i) => part.model.positions[i * 3 + 1]), vv = v.map((i) => UV[i * 2 + 1]);
      const hi = y.indexOf(Math.max(...y)), lo = y.indexOf(Math.min(...y));
      if (y[hi] - y[lo] < 0.5) continue;
      if (sm.textureRecord === K.shaft && EG_KIT_MAP[K.shaft].v === 'up') { shafts++; assert.ok(vv[hi] > vv[lo], 'a shaft\'s v up it'); }
      if (sm.textureRecord === K.banner) { banners++; assert.ok(vv[hi] < vv[lo], 'a banner\'s v down from its rod'); }
      if (sm.textureRecord === K.fixture && y[hi] - y[lo] > 0.4) for (const q of vv) assert.ok(q >= EG_FIXTURE_V.flame[0] - 1e-6 && q <= EG_FIXTURE_V.flame[1] + 1e-6 || q >= EG_FIXTURE_V.body[0] - 1e-6, 'a fixture\'s rows');
    }
  });
  assert.ok(shafts > 50, `${shafts} shaft faces`);
  void spec; void banners;
});

// ── THE RUIN'S OCCLUDERS ─────────────────────────────────────────────────────────────────────────────────────────────
/** A renderer as far as the ground look and the dither pass reach (meshes, views, the dissolve, the draws and shadows). */
function fakeRenderer() {
  const log = { draws: [], dissolve: [], shadows: [], made: 0, freed: 0 };
  return {
    log,
    createMesh: (m) => { log.made++; return { vao: {}, subMeshes: m.subMeshes.map((s) => ({ ...s })) }; },
    destroyMesh: (g) => { log.freed++; g._dead = true; },
    meshView: (mesh, subs) => (mesh && !mesh._dead ? { vao: mesh.vao, subMeshes: subs, viewOf: mesh } : null),
    setDissolve: (k) => log.dissolve.push(k),
    drawMesh: (g) => log.draws.push(g),
    recordShadowMesh: (g) => log.shadows.push(g),
  };
}
test('EG-LOOK THE RUIN\'S OCCLUDERS (EG-ZN\'s law, Elite-Gates.md section 11.8; Elite-Gates-Look.md section 3.3: "columns at the rim + 2.5 m will stand between a third-person camera and the body near a rim"): every column, statue and arch of a hall\'s ruin is an occluder of its mesh (world/eliteGates/egRuin.js model.occluders); stood (scenes/eliteGates/egGroundLook.js), a camera\'s ray through a column of the eye\'s hall dithers it out - the ruin\'s draw taken for the frame, the rest of its mesh drawn and the column under the dissolve, no shadow recorded for it - and back once the ray is clear; another hall\'s ruin tries nothing; the circle\'s host lays the ruin\'s pass on the circle\'s one (mutants: the ruin\'s pass never tried; its shadow recorded; the tall pieces unmarked)', () => {
  const seed = 7, c = 1, specs = egCircleSpecs(seed, c, 0), parts = buildEgRuinParts(seed, c, 0);
  // the marks: a piece a column, each box holding its column
  for (const [i, part] of parts.entries()) {
    const spec = specs[i], plan = egRuinColumns(spec), occ = part.model.occluders;
    assert.ok(occ.length >= plan.cols.length + plan.arches.length, `hall ${spec.h}: its tall pieces marked (${occ.length})`);
    for (const q of plan.cols) {
      const [x, , z] = egToDungeon(spec, q.x, 0, q.z);
      const top = q.kind === 'statue' ? q.floor + 2 : q.top;
      assert.ok(occ.some((o) => x >= o.b[0] && x <= o.b[3] && z >= o.b[2] && z <= o.b[5] && o.b[4] >= top - 0.01), `hall ${spec.h}: its ${q.kind} column an occluder`);
    }
    for (const o of occ) for (const [s, at, n] of o.r) assert.ok(s < part.model.subMeshes.length && at >= part.model.subMeshes[s].startIndex && at + n * 3 <= part.model.subMeshes[s].startIndex + part.model.subMeshes[s].primitiveCount * 3, 'its runs in its sub-mesh');
  }
  // the pass, stood with the circle
  const R = fakeRenderer(), G = createEgGroundLook({ renderer: R, lite: false });
  G.stand(seed, c, 0, parts, null);
  const circle = createEgOccluders({ renderer: R }), pass = G.occluders(circle);
  const spec = specs[0], col = egRuinColumns(spec).cols.find((q) => q.kind === 'whole' || q.kind === 'broken'), mid = Math.max(col.floor + 0.5, Math.min(col.top - 0.3, col.floor + 1.5));
  const out = [col.x - col.cx, col.z - col.cz], l = Math.hypot(...out), ux = out[0] / l, uz = out[1] / l;
  const eye = egToDungeon(spec, col.x + ux * 3, mid, col.z + uz * 3), body = egToDungeon(spec, col.x - ux * 3, mid, col.z - uz * 3);
  G.frame(eye, 0);
  const ruinDraw = G.draws()[0];
  assert.equal(ruinDraw.hidden, false, 'the eye\'s hall\'s ruin drawn');
  assert.ok(G.draws().slice(1, 5).every((d) => d.hidden), 'the other halls\' not');
  pass.frame({ eye, points: [body], dt: 0.1 });
  R.log.draws.length = 0; R.log.dissolve.length = 0; R.log.shadows.length = 0;
  const n = pass.draw(null);
  assert.ok(n > 0 && pass.stats().ruin.dithering > 0, 'the column between dithers');
  assert.equal(ruinDraw.hidden, true, 'the ruin\'s draw taken for the frame');
  assert.ok(R.log.dissolve.some((k) => k < 1) && R.log.dissolve.at(-1) === 1, 'under the dissolve, then whole again');
  assert.equal(R.log.shadows.length, 0, 'no shadow recorded for the ruin (noShadow)');
  assert.equal(pass.stats().pieces, 0, 'the circle\'s own pass as it was (no circle stood here)');
  for (let i = 0; i < 6; i++) pass.frame({ eye: null, points: null, dt: 0.2 });
  pass.draw(null);
  assert.equal(ruinDraw.hidden, false, 'back whole once the ray is clear');
  // another hall: its ruin tries nothing
  G.frame(egToDungeon(specs[2], 0, 2, 10), 0);
  pass.frame({ eye, points: [body], dt: 0.1 });
  assert.equal(pass.stats().ruin.dithering, 0, 'the eye elsewhere: the first hall\'s columns try nothing');
  const freed = G.down([]);
  assert.equal(freed, 5);
  assert.equal(R.log.freed, 5, 'every ruin freed');
  const EC = rd('src/scenes/eliteGates/egCircleHost.js');
  assert.match(EC, /const egOcc = ground\.occluders\(createEgOccluders\(\{ renderer \}\)\);/, 'the circle\'s host: one pass for the circle\'s rock and the ruin\'s');
  assert.ok(EC.indexOf('const ground = createEgGroundLook(') < EC.indexOf('const egOcc = ground.occluders('), 'the ground look made first');
});
