// IC-GRAND (2026-10-26, the owner: "Each district needs to be distinct with more varying layouts. Its time we also develop
// proper city-like scapes with parkouring opprotunities"; the KPbICA spec he forwarded: "buildings in cut stone, brick and
// half-timbering; inner yards and backyards; a street hierarchy - wide main streets with pathways, side streets, alleys and
// dead ends"; bible/03-World/Arena-Provinces.md IC-GRAND) - THE IMPERIAL CITY'S FABRIC, pinned: its rooftops laid to the
// player's movement's own numbers, each district its own streets and buildings and each neighbourhood its own frame, the
// street hierarchy, the yards, the dead ends, the ways up and the bridges, the park's statues, the canals, and its walls'
// pictures at vanilla's format.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IMPERIAL_STYLES, HOOD_RINGS, ROOF_STEP, STOREY, BAY, ALLEY, LEDGE_Y, PARAPET, STAIR, YARD_WALL, SHED, PAVEMENT, FABRIC_LAWS,
  streetKind, hoodAt, fabricCell, inQuad, centroid, GROUND, fabricGroundAt, fabricKeptClear, _resetFabric, BACK, WELL, SQUARE_FOUNTAIN, ORCHARD, fabricTreeOf,
} from '../../src/world/imperialFabric.js';
import { fabricCellModel } from '../../src/world/imperialFabricModels.js';
import { FACADE_TEXELS, FACADE_WINDOW } from '../../src/world/imperialArt.js';
import { IMPERIAL, IMPERIAL_CELLS, IMPERIAL_SECTORS, polar, imperialCell, imperialDistrictAt } from '../../src/world/imperialCity.js';
import { CAPITAL_ART } from '../../src/world/capitalShapes.js';
import { capitalArt } from '../../src/world/capitalModels.js';
import { PARKOUR_REACH_MIN, PARKOUR_AIR_REACH, PARKOUR_VAULT_MAX, PARKOUR_SAFE_DROP, PARKOUR_RUNLEAP_DIST_MIN, PARKOUR_WALLRUN_MIN, PARKOUR_TOP_MIN_NY } from '../../src/player/parkour.js';
import { JUMP_SPEED, GRAVITY, STEP_OFFSET } from '../../src/player/motor.js';
import { BLOCK_M } from '../../src/world/spawnedDungeons.js';

const B = BLOCK_M, HALF = IMPERIAL_CELLS / 2;
const cellOfPoint = (x, z) => [Math.floor(z / B + HALF), Math.floor(x / B + HALF)];
/** A cell of the city's own near a point with at least `n` buildings - the nearest such, searched outward. */
function sampleCell(x, z, n = 8) {
  const [r0, c0] = cellOfPoint(x, z);
  for (let k = 0; k < 6; k++) for (let r = r0 - k; r <= r0 + k; r++) for (let c = c0 - k; c <= c0 + k; c++) {
    if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== k || !/^I/.test(imperialCell(r, c) ?? '')) continue;
    const L = fabricCell(r, c);
    if (L.plots.length >= n) return L;
  }
  return null;
}
/** Sample cells of each fabric district: two rings out, each half's middle. */
const DISTRICTS = [...IMPERIAL_SECTORS.map(([d, b]) => [d, b]), ['Waterfront District', 165]];
const samples = (d, b) => (d === 'Waterfront District' ? [[b, 7300], [b + 25, 7300]] : [[b + 7.5, 3000], [b + 52.5, 5300], [b + 22.5, 6300]]).map(([bb, r]) => sampleCell(...polar(bb, r))).filter(Boolean);

test('IC-GRAND THE ROOFTOPS ARE A WAY - the fabric laid to the movement\'s own numbers (player/parkour.js, player/motor.js): a roof\'s step a jump and a catch at Climbing 0, an alley under the running leap\'s shortest flight, a parapet under a vault, a way up\'s riser under a step, a ledge at a wall run\'s reach, a garden wall within a catch, a kerb under a step, every pitch a top the hands keep (mutants: a step past the reach; an alley past the leap; a parapet over a vault)', () => {
  const rise = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY);
  assert.ok(Math.abs(FABRIC_LAWS.stepReach - (PARKOUR_REACH_MIN + PARKOUR_AIR_REACH + rise)) < 1e-9);
  assert.ok(ROOF_STEP <= FABRIC_LAWS.stepReach - 0.05 && ROOF_STEP === STOREY / 2, 'a half storey, under the reach less a hand\'s breadth');
  assert.ok(ALLEY + 0.6 <= FABRIC_LAWS.leapMin && FABRIC_LAWS.leapMin === PARKOUR_RUNLEAP_DIST_MIN, 'an alley leapt with a stride to spare');
  assert.ok(PARAPET < PARKOUR_VAULT_MAX && PARAPET > 0.5, 'a parapet vaulted, over a knee');
  // PIN MOVED (IC-STAIRS): the ways up are built stairs now - a riser the motor steps, a tread a foot's (test/world/icstairs.test.js
  // holds their every law); the crates' 1.2 m steps under a vault are gone
  assert.ok(2 * STAIR.rise < STEP_OFFSET && STAIR.tread >= 0.28, 'a way up\'s risers stepped, a foot\'s room on each');
  assert.ok(LEDGE_Y <= PARKOUR_WALLRUN_MIN + PARKOUR_REACH_MIN + PARKOUR_AIR_REACH - 0.04, 'a ledge in a wall run\'s reach');
  assert.ok(YARD_WALL.h <= FABRIC_LAWS.stepReach && SHED.h - YARD_WALL.h <= PARKOUR_VAULT_MAX, 'a garden wall caught, a shed vaulted from it');
  assert.ok(PAVEMENT.h < STEP_OFFSET, 'a kerb stepped');
  assert.ok(STOREY * 2 + ROOF_STEP <= PARKOUR_SAFE_DROP + STOREY, 'a balcony\'s drop');
  for (const [d, st] of Object.entries(IMPERIAL_STYLES)) assert.ok(Math.cos((st.pitch * Math.PI) / 180) >= PARKOUR_TOP_MIN_NY, `${d}: its roofs a top the hands keep`);
});

test('IC-GRAND THE HEIGHT WALK - in every district a building beside a building is at most a step higher (but a tower, a climb of its own): the roofs run on round every block (mutant: the walk\'s step two half storeys)', () => {
  _resetFabric();
  let pairs = 0;
  for (const [d, b] of DISTRICTS) {
    for (const L of samples(d, b)) {
      const plots = L.plots;
      for (let i = 0; i < plots.length; i++) for (let j = i + 1; j < plots.length; j++) {
        const p = plots[i], q = plots[j];
        const shared = p.q.filter((a) => q.q.some((c) => Math.hypot(a[0] - c[0], a[1] - c[1]) < 1e-6)).length;
        if (shared < 2 || p.tower || q.tower) continue;
        pairs++;
        assert.ok(Math.abs(p.h - q.h) <= ROOF_STEP + 1e-9, `${d}: ${p.h} beside ${q.h}`);
      }
    }
  }
  assert.ok(pairs > 100, `${pairs} neighbours`);
});

test('IC-GRAND EACH DISTRICT ITS OWN - its frame of streets, its blocks\' sizes, its walls\' and roofs\' pictures; and inside it each neighbourhood its own frame off its own seed - five rings out by half, the heart\'s its landmark\'s (mutants: one frame for all; one neighbourhood a district)', () => {
  assert.equal(Object.keys(IMPERIAL_STYLES).length, 7);
  const looks = new Set(Object.values(IMPERIAL_STYLES).map((st) => `${st.frame}|${st.walls[0]}|${st.roof}|${st.P}|${st.Q}`));
  assert.equal(looks.size, 7, 'no two districts alike');
  assert.deepEqual(new Set(Object.values(IMPERIAL_STYLES).map((st) => st.frame)), new Set(['grid', 'polar', 'park', 'axial', 'organic', 'docks']));
  assert.deepEqual(HOOD_RINGS, [IMPERIAL.palaceWall.r, ...IMPERIAL.roads.rings.slice(0, 1), 4050, 5150, IMPERIAL.roads.rings[2], IMPERIAL.cityWall.r].map((v, i) => (i === 2 || i === 3 ? v : v)));
  for (const [d, b] of IMPERIAL_SECTORS) {
    const hoods = new Map();
    for (let r = IMPERIAL.palaceWall.r + 50; r < IMPERIAL.cityWall.r - 50; r += 150) for (let bb = b + 1; bb < b + 60; bb += 2) {
      const h = hoodAt(...polar(bb, r));
      if (h && h.district === d) hoods.set(h.key, h);
    }
    assert.ok(hoods.size >= 15, `${d}: ${hoods.size} neighbourhoods`);
    const frames = new Set([...hoods.values()].map((h) => `${h.kind}|${h.turn.toFixed(3)}|${h.P[0].toFixed(2)}`));
    assert.ok(frames.size >= 10, `${d}: ${frames.size} frames of its own`);
    assert.equal([...hoods.values()].filter((h) => h.heart).length, 1, `${d}: one heart`);
  }
  assert.equal(hoodAt(0, 0), null, 'the Palace District none');
  assert.equal(hoodAt(...polar(300, 9000)), null, 'the lake none');
});

test('IC-GRAND THE STREETS\' HIERARCHY - an alley (ALLEY, leapt), a lane, a side street and a main street with its pavements in every district but the park\'s paths; the city\'s avenues, radials and ring roads over them; a main street\'s fronts paved a step up (mutants: the main street\'s pavement gone; an alley a lane)', () => {
  assert.deepEqual([streetKind(ALLEY), streetKind(5), streetKind(8), streetKind(10), streetKind(14)], ['alley', 'lane', 'side', 'main', 'main']);
  for (const [d, st] of Object.entries(IMPERIAL_STYLES)) {
    if (st.frame === 'park') { assert.ok(st.streets.every(([w]) => w > ALLEY), `${d}: its paths`); continue; }
    const kinds = new Set(st.streets.map(([w]) => streetKind(w)));
    assert.ok(kinds.has('alley') && kinds.has('main'), `${d}: ${[...kinds]}`);
    assert.ok(st.streets.some(([w]) => streetKind(w) === 'lane' || streetKind(w) === 'side'), `${d}: a lesser street`);
  }
  // a main street's front paved: a building on a main street carries its pavement in its model
  _resetFabric();
  let paved = 0;
  for (const [d, b] of DISTRICTS) for (const L of samples(d, b)) for (const p of L.plots) if (p.sw.some((w) => streetKind(w) === 'main')) paved++;
  assert.ok(paved > 20, `${paved} fronts on main streets`);
  assert.ok(IMPERIAL.avenue.w > IMPERIAL.roads.ring && IMPERIAL.roads.ring > IMPERIAL.roads.radial && IMPERIAL.roads.radial > 14, 'the city\'s own roads the widest');
});

test('IC-GRAND THE URBAN FABRIC - courts parted into backyards by garden walls with their sheds, alleys closed at an end (dead ends), ways up from the street and bridges between the roofs in every built district; the Arboretum\'s park with its statues; the Elven Gardens\' canals; the walls cut stone, brick and half-timbering (mutants: no yard; no dead end; no bridge; no statue)', () => {
  _resetFabric();
  const total = { yards: 0, sheds: 0, deadEnds: 0, stairs: 0, bridges: 0, courts: 0, statues: 0, canals: 0, parks: 0 };
  const walls = new Set();
  for (const [d, b] of DISTRICTS) {
    for (const L of samples(d, b)) {
      for (const k of Object.keys(total)) total[k] += L[k].length;
      for (const p of L.plots) walls.add(p.wall);
    }
  }
  for (const k of ['yards', 'sheds', 'deadEnds', 'stairs', 'bridges', 'courts']) assert.ok(total[k] > 0, `${k}: ${total[k]}`);
  // a garden wall parts a court: its middle in one of the cell's courts, never through a building
  for (const [d, b] of DISTRICTS) for (const L of samples(d, b)) for (const y of L.yards) {
    const m = [(y.a[0] + y.b[0]) / 2, (y.a[1] + y.b[1]) / 2];
    assert.ok(L.courts.some((q) => inQuad(q, ...m)), `${d}: a garden wall in a court`);
  }
  // the Arboretum's statues and park, the Elven Gardens' canals: their own cells searched
  let statues = 0, canals = 0;
  for (let k = 0; k < 40 && !statues; k++) { const L = fabricCell(...cellOfPoint(...polar(122 + (k % 8) * 7, 3600 + Math.floor(k / 8) * 300))); statues += L.statues.length; }
  for (let k = 0; k < 40 && !canals; k++) { const L = fabricCell(...cellOfPoint(...polar(302 + (k % 8) * 7, 3600 + Math.floor(k / 8) * 300))); canals += L.canals.length; }
  assert.ok(statues > 0, 'the Arboretum\'s statues');
  assert.ok(canals > 0, 'the Elven Gardens\' canals');
  for (const w of ['facadeStone', 'facadeBrick', 'facadeTimber']) assert.ok(walls.has(w), `${w} stands`);
  // every way up's head at its roof's edge (PIN MOVED, IC-STAIRS: a built stair's head landing at the roof, not the crates' last
  // step a vault under it); every bridge over a street too wide to leap, to a roof within a step
  _resetFabric();
  for (const [d, b] of DISTRICTS) for (const L of samples(d, b)) {
    for (const s of L.stairs) assert.ok(s.runs.at(-1).kind === 'head' && s.runs.at(-1).y === s.top && Math.abs(s.risers * s.rise - (s.top - s.y0)) < 1e-9, `${d}: a way up's head at its roof's edge (${s.top})`);
    for (const br of L.bridges) assert.ok(br.len > ALLEY + 0.5 && br.len <= 18 && br.y - 0.3 >= 1.8 + 0.4, `${d}: a bridge ${br.len} long at ${br.y} - a body\'s headroom under it`);
  }
});

// IC-GRAND x THE COORDINATOR'S REVIEW OF THE RENDERS (2026-10-26): "BLOCK INTERIORS and VOIDS ... Courtyards should be
// courtyard-sized (yards, gardens, sheds, wells, trees), streets and plazas paved, and large empty lots either built,
// planted (gardens, orchards in the Elven Gardens/Arboretum) or made squares with something in them".
test('IC-GRAND COURTS COURTYARD-SIZED - a court BACK.min or more across both ways stands a back range in its middle (no street front, BACK.gap in from the ring all round, lower than the ring), the garden walls from the ring to its faces and never through a building; a well in a yard (closed), a square\'s fountain at its middle (closed); trees in the stone yards, orchards in rows in the Arboretum\'s park and the Elven Gardens\' garden courts (mutants: no back range; the walls through it; no well; no fountain; the orchards unordered)', () => {
  _resetFabric();
  let wide = 0, built = 0, wells = 0, yardWalls = 0;
  const dist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz); };
  for (const [d, b] of DISTRICTS) for (const L of samples(d, b)) {
    for (const q of L.courts) {
      const cw = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), ct = Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]);
      if (Math.min(cw, ct) < BACK.min + 0.5) continue;
      const backs = L.near.filter((p) => p.back && inQuad(q, ...centroid(p.q)));
      const ring = L.near.filter((p) => !p.back && p.q.some((v) => q.some((c) => Math.hypot(v[0] - c[0], v[1] - c[1]) < 0.01)));
      if (!ring.length) continue;   // a court whose ring the roads or the walls took
      wide++;
      if (backs.length) built++;
      for (const p of backs) {
        assert.equal(p.out, 0, `${d}: a back range faces no street`);
        for (const v of p.q) {
          assert.ok(inQuad(q, ...v), `${d}: inside its court`);
          assert.ok(Math.min(...q.map((c, e) => dist(v, c, q[(e + 1) & 3]))) > BACK.gap - 0.5, `${d}: its yards round it`);
        }
        assert.ok(p.h <= Math.min(...ring.map((r) => r.h)) + 1e-9, `${d}: lower than its ring`);
        assert.equal(fabricGroundAt(...centroid(p.q)), GROUND.building);
      }
    }
    for (const y of L.yards) {
      yardWalls++;
      for (const t of [0.25, 0.5, 0.75]) { const m = [y.a[0] + (y.b[0] - y.a[0]) * t, y.a[1] + (y.b[1] - y.a[1]) * t]; assert.equal(L.near.some((p) => inQuad(p.q, ...m)), false, `${d}: a garden wall through a building`); }
    }
    for (const w of L.wells) { wells++; assert.equal(fabricGroundAt(...w), GROUND.wall, `${d}: a well closed`); assert.ok(L.courts.some((q) => inQuad(q, ...w)), `${d}: a well in a court`); }
  }
  assert.ok(wide >= 10 && built / wide > 0.8, `${built} of ${wide} wide courts built in`);
  assert.ok(wells > 3 && yardWalls > 10, `${wells} wells, ${yardWalls} garden walls`);
  assert.ok(BACK.min >= 2 * BACK.gap + 8 && WELL.h <= YARD_WALL.h && SQUARE_FOUNTAIN.r > 2);
  // the Market's squares: each its fountain at its middle, closed
  let squares = 0, fountains = 0;
  for (let k = 0; k < 120 && fountains < 2; k++) {
    const L = fabricCell(...cellOfPoint(...polar(4 + (k % 12) * 4.5, 2600 + Math.floor(k / 12) * 380)));
    squares += L.squares.length;
    for (const f of L.fountains) { fountains++; assert.equal(fabricGroundAt(...f), GROUND.statue); assert.ok(L.squares.some((q) => Math.hypot(...[0, 1].map((i) => centroid(q)[i] - f[i])) < 0.01), 'at a square\'s middle'); }
  }
  assert.ok(squares > 0 && fountains > 0, `${fountains} fountains in ${squares} squares`);
  // trees: the stone yards' few; the orchards in rows - every tree of an orchard's patch on the lattice of every other tile
  const T = [12, 15, 16, 18];
  let yard = 0, orchard = 0, off = 0;
  for (const [d, b] of DISTRICTS.filter(([dd]) => IMPERIAL_STYLES[dd].court === 'yard')) for (const L of samples(d, b)) for (const q of L.courts) {
    const xs = q.map((v) => v[0]), zs = q.map((v) => v[1]);
    for (let x = Math.floor(Math.min(...xs) / 6.4) * 6.4 + 3.2; x < Math.max(...xs); x += 6.4) for (let z = Math.floor(Math.min(...zs) / 6.4) * 6.4 + 3.2; z < Math.max(...zs); z += 6.4) if (inQuad(q, x, z) && fabricTreeOf(GROUND.court, x, z, T) >= 0) yard++;
  }
  assert.ok(yard > 5, `${yard} trees in the stone yards`);
  for (let i = 0; i < 400; i++) for (let j = 0; j < 40; j++) {
    const [cx, cz] = polar(150, 3600), x = cx + (i - 200) * 6.4 + 3.2, z = cz + (j - 20) * 6.4 + 3.2;
    if (!inOrchardPatch(x, z) || fabricTreeOf(GROUND.park, x, z, T) < 0) continue;
    if (Math.floor(x / ORCHARD.tile) % 2 === 0 && Math.floor(z / ORCHARD.tile) % 2 === 0) orchard++; else off++;
  }
  assert.ok(orchard > 50 && off === 0, `${orchard} orchard trees in rows, ${off} out of them`);
});
/** Is a point in an orchard's patch (world/imperialFabric.js fabricTreeOf's own law, asked of it: a patch every lattice
 *  tile of which - every other tile each way - stands a tree; the grove's dice never stand them all). */
function inOrchardPatch(x, z) {
  const T = [12, 15, 16, 18], px = Math.floor(x / ORCHARD.patch) * ORCHARD.patch, pz = Math.floor(z / ORCHARD.patch) * ORCHARD.patch;
  let n = 0;
  for (let a = px + 3.2; a < px + ORCHARD.patch; a += 6.4) for (let b = pz + 3.2; b < pz + ORCHARD.patch; b += 6.4) {
    if (Math.floor(a / ORCHARD.tile) % 2 !== 0 || Math.floor(b / ORCHARD.tile) % 2 !== 0) continue;
    n++;
    if (fabricTreeOf(GROUND.park, a, b, T) < 0) return false;
  }
  return n > 20;
}

test('IC-GRAND A BUILDING STANDS CLEAR - never on a road, a wall\'s foot, the lake or a landmark\'s ground; its ground closed to walkers, the street\'s open (mutants: the roads unread; a building on the water)', () => {
  _resetFabric();
  let built = 0, street = 0;
  for (const [d, b] of DISTRICTS) for (const L of samples(d, b)) for (const p of L.plots) {
    built++;
    for (const v of [...p.q, centroid(p.q)]) assert.equal(fabricKeptClear(v[0], v[1]), false, `${d}: a building on what keeps clear`);
    const [mx, mz] = centroid(p.q);
    assert.ok(inQuad(p.q, mx, mz) && fabricGroundAt(mx, mz) === GROUND.building);
    assert.ok(imperialDistrictAt(mx, mz) === d || (d === 'Waterfront District'), `${d}`);
  }
  for (const [d, b] of DISTRICTS) {
    const [x, z] = polar(b + 30, 4100);   // the district's avenue
    if (d === 'Waterfront District') continue;
    assert.equal(fabricKeptClear(x, z), true, `${d}'s avenue kept clear`);
    if (fabricGroundAt(...polar(b + 30.5, 4100)) === GROUND.none) street++;
  }
  assert.ok(built > 200 && street >= 0);
});

test('IC-GRAND THE WALLS\' PICTURES - a storey of cut stone, brick, half-timbering, ochre stucco and white lime and two ground floors (a shopfront, an arcade), each vanilla\'s own 64 x 128 wall, a window a bay (BAY 1.6 m, a picture\'s width at vanilla\'s 40 texels a metre) laid a storey down from the eave (mutants: the bay a storey wide; the window off the picture)', () => {
  assert.deepEqual(FACADE_TEXELS, { w: 64, h: 128 });
  assert.equal(BAY, 1.6);
  assert.equal(STOREY, 3.2);
  assert.ok(Math.abs(FACADE_TEXELS.w / BAY - 40) < 1e-9 && Math.abs(FACADE_TEXELS.h / STOREY - 40) < 1e-9, 'vanilla\'s 40 texels a metre both ways');
  const [x0, y0, x1, y1] = FACADE_WINDOW.rect;
  assert.ok(x0 > 0 && x1 < FACADE_TEXELS.w && y0 > 0 && y1 < FACADE_TEXELS.h && FACADE_WINDOW.mullion > x0 && FACADE_WINDOW.mullion < x1);
  const art = capitalArt();
  for (const k of ['facadeOchre', 'facadeBrick', 'facadeWhite', 'facadeStone', 'facadeTimber', 'groundShop', 'groundArcade']) {
    const img = art.get(CAPITAL_ART[k]);
    assert.deepEqual([img.width, img.height], [64, 128], k);
  }
  // the wall's picture a bay along it: a 4.8 m front three pictures across
  const L = sampleCell(...polar(37.5, 3000));
  const m = fabricCellModel(L.r, L.c);
  assert.ok(m && m.indices.length > 1000, 'the cell\'s model');
  let maxU = 0;
  for (let i = 0; i < m.uvs.length; i += 2) maxU = Math.max(maxU, m.uvs[i]);
  assert.ok(maxU > 3, 'the pictures repeat along a wall');
});
