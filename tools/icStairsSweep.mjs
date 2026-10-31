#!/usr/bin/env node
// IC-STAIRS (bible/03-World/Arena-Provinces.md IC-STAIRS; the owner, 2026-10-27: "Minecraft looking staircases in Imperial
// city need to be completely redesigned", and "No band aids or half assed work") - EVERY WAY UP OF THE IMPERIAL CITY,
// VERIFIED: each block's stair over the whole plan (world/imperialFabric.js blockStair - every cell of the city's own, each
// stair once, from the cell its block's middle stands in), held to every law test/world/icstairs.test.js pins on its
// sample, and walked by the real PlayerMotor on a Collider of the cells' own models.
//
//   node tools/icStairsSweep.mjs                  every stair's laws (no walk), a line a finding, the tally last
//   node tools/icStairsSweep.mjs --walk           and every stair walked: up, onto its roof, back down
//   node tools/icStairsSweep.mjs --jobs 2         the plan's rows shared out to that many processes
//   node tools/icStairsSweep.mjs --rows 60:80     only these rows of the plan (a job's share)
//   JSON=<file>                                   the tally written there too
//
// THE LAWS (stairProblems): its proportions (risers alike, STAIR.rise at the most, the climb their sum, flights of
// STAIR.flight at the most, its runs the plan's); its head at its building's roof - that building's front, in from its
// corners, never a tower, a flat roof's parapet open over the head (a ray down the roof's edge meets the roof, and past
// the head's end its parapet) or a pitched roof's eave (never a gable's end); every half metre of it before a front of
// its block standing a rail over its steps (but its head's own); its foot on the street's level with open ground before
// it; its ground shut (from the cell of every point of it); no building's door, lamp or bridge on it, no ledge or balcony
// over it, no canal, court or park under it, no building, wall, shed, well, statue, fountain or other stair in it; every
// building along it that a door could enter with the stairs taken off the ground keeping its door; its mesh the city's two stones, a riser a step, its base, piers and end wall down into the
// street, its triangles in budget. THE WALK (walkStair): from the street before its foot to its head (no jump, its feet
// never a riser off its walk), over its roof's edge onto the roof, back down to its foot.
import { fork } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';
import {
  STAIR,
  STAIR_DEPTH,
  PAVEMENT,
  PARAPET,
  LEDGE_Y,
  GROUND,
  fabricCell,
  fabricGroundAt,
  fabricPlotAt,
  fabricClosedOf,
  outwardOf,
  inQuad,
  streetKind,
  stairRuns,
  stairSurface,
  inStair,
  stairGround,
  YARD_WALL,
  BAY,
  hoodAt,
  fabricGroundIn,
  SHED,
  WELL,
  STATUE,
  SQUARE_FOUNTAIN,
  stairMiddle,
} from '../src/world/imperialFabric.js';
import { fabricCellModel, buildStair, buildPlot, partyEdges } from '../src/world/imperialFabricModels.js';
import { fabricCellBuildings, FABRIC_DOOR } from '../src/world/imperialFabricBuildings.js';
import { fabricCellLamps } from '../src/world/imperialFabricLights.js';
import { MeshBuilder } from '../src/world/detStandIns.js';
import { IMPERIAL_CELLS, imperialCell, pointSeg } from '../src/world/imperialCity.js';
import { CAPITAL_ART, CAPITAL_ARCHIVE } from '../src/world/capitalShapes.js';
import { PlayerMotor, CAPSULE_RADIUS } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { identity } from '../src/world/mat4.js';
import { BLOCK_M } from '../src/world/spawnedDungeons.js';

const B = BLOCK_M,
  HALF = IMPERIAL_CELLS / 2;
/** The plan's cell a point (the city's metres) stands in. */
export const cellOfPoint = (x, z) => [Math.floor(z / B + HALF), Math.floor(x / B + HALF)];
/** A point of a stair's frame (metres along its wall from its foot, out from the wall) in the city's metres. */
export const stairPoint = (s, x, o) => [s.at[0] + s.t[0] * x + s.n[0] * o, s.at[1] + s.t[1] * x + s.n[1] * o];
/** The building a stair's head climbs to - the one just in from its head landing. */
export const stairHead = (s) => fabricPlotAt(...stairPoint(s, s.len - STAIR.head / 2, -0.5));
/** One block's stair, whichever cell's layout holds it (a layout is a cache's: its stair is the same stair, another object). */
export const sameStair = (a, b) => a.key === b.key && a.edge === b.edge && a.at[0] === b.at[0] && a.at[1] === b.at[1];
/** Does any of these points (the city's metres) stand in a stair's footprint - from its wall's line out past its coping,
 *  foot to head. */
const inFootprint = (s, pts) =>
  pts.some(([x, z]) => {
    const dx = x - s.at[0],
      dz = z - s.at[1],
      a = dx * s.t[0] + dz * s.t[1],
      o = dx * s.n[0] + dz * s.n[1];
    return a > 0 && a < s.len && o > 0.02 && o < STAIR_DEPTH + 0.04;
  });
/** A wall's footprint as points: along it every 10 cm, across it at its faces and middle. */
const wallPts = (a, b, t) => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
    n = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L],
    out = [];
  for (let u = 0; u <= L + 1e-9; u += 0.1)
    for (const w of [-t / 2, 0, t / 2])
      out.push([a[0] + ((b[0] - a[0]) * u) / L + n[0] * w, a[1] + ((b[1] - a[1]) * u) / L + n[1] * w]);
  return out;
};
/** A square's footprint (side 2h about c) as points, its outline every 25 cm and its middle; a disc's (radius r). */
const squarePts = (c, h) => {
  const out = [c];
  for (let u = -h; u <= h + 1e-9; u += 0.25)
    for (const v of [-h, h]) out.push([c[0] + u, c[1] + v], [c[0] + v, c[1] + u]);
  return out;
};
const discPts = (c, r) => [
  c,
  ...Array.from({ length: 32 }, (_, k) => [
    c[0] + r * Math.cos((k * Math.PI) / 16),
    c[1] + r * Math.sin((k * Math.PI) / 16),
  ]),
];
/** Ground a body cannot walk onto: a building, a wall, a stair, a statue, a canal (a court, a square, the park and a street
 *  are open ground - the Elven Gardens' warped courts' quads lie over some of their streets, so a street there reads
 *  `court` to the walkers, and is walked). */
export const solidGround = (g) =>
  g === GROUND.building || g === GROUND.wall || g === GROUND.stair || g === GROUND.statue || g === GROUND.canal;
/** A stair's triangle budget: four a riser, its runs' parapet, coping and soffit, its piers, its end wall and newel. */
export const stairBudget = (s) => 4 * s.risers + 24 * s.flights.length + 64;
/** Every cell of the city's own (its fabric's). */
export function fabricCells(rows = [0, IMPERIAL_CELLS]) {
  const out = [];
  for (let r = rows[0]; r < rows[1]; r++)
    for (let c = 0; c < IMPERIAL_CELLS; c++) if (/^I[0-9a-z]{4}$/.test(imperialCell(r, c) ?? '')) out.push([r, c]);
  return out;
}

/** A stair built alone at the city's middle (so its float32 corners keep their millimetres): its triangles in its own
 *  frame - along, out, height; the normal's (along, out, up); the record. */
export function stairFaces(stair) {
  const mb = new MeshBuilder(),
    s = { ...stair, at: [0, 0] };
  buildStair(mb, s);
  const m = mb.build(),
    out = [];
  const fr = (x, y, z) => {
    const mz = -z;
    return [x * s.t[0] + mz * s.t[1], x * s.n[0] + mz * s.n[1], y];
  };
  for (const sm of m.subMeshes)
    for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
      const ix = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
      const nx = m.normals[ix[0] * 3],
        ny = m.normals[ix[0] * 3 + 1],
        nz = -m.normals[ix[0] * 3 + 2];
      out.push({
        archive: sm.textureArchive,
        record: sm.textureRecord,
        n: [nx * s.t[0] + nz * s.t[1], nx * s.n[0] + nz * s.n[1], ny],
        p: ix.map((i) => fr(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2])),
        uv: ix.map((i) => [m.uvs[i * 2], m.uvs[i * 2 + 1]]),
      });
    }
  return out;
}

/** The top of what stands on a building's roof's edge just in from a stair's line at `x` along it - a ray down its own mesh
 *  (built with `stairs` near it). */
function edgeTop(p, Lp, s, stairs, x) {
  const mb = new MeshBuilder();
  buildPlot(mb, p, partyEdges(Lp, p), stairs);
  const m = mb.build(),
    col = new Collider();
  col.addMesh('p', m.positions, m.indices, identity());
  const q = stairPoint(s, x, -0.2);
  return p.h + 3 - col.raycast([q[0], p.h + 3, -q[1]], [0, -1, 0], 6);
}

/**
 * EVERY LAW OF A WAY UP (the header's), each broken one a line - none for a stair that holds them all.
 * @param {any} s a stair (world/imperialFabric.js blockStair's)
 * @param {any} L the layout of the cell that draws it (its block's middle's)
 */
export function stairProblems(s, L) {
  const bad = [],
    say = (m) => bad.push(m);
  // drawn by the cell it stands in (its middle's)
  const [mr, mc] = cellOfPoint(...stairMiddle(s));
  if (mr !== L.r || mc !== L.c || !L.stairs.some((o) => sameStair(o, s)))
    say(`drawn by cell ${L.r},${L.c}, its middle in ${mr},${mc}`);
  // its proportions
  if (!(s.rise <= STAIR.rise + 1e-9 && s.rise >= 0.15)) say(`a riser of ${s.rise}`);
  if (Math.abs(s.risers * s.rise - (s.top - s.y0)) > 1e-9) say("its climb not its risers' sum");
  if (s.flights.reduce((a, m) => a + m, 0) !== s.risers || !s.flights.every((m) => m >= 2 && m <= STAIR.flight))
    say(`flights ${s.flights}`);
  if (JSON.stringify(s.runs) !== JSON.stringify(stairRuns(s)) || Math.abs(s.runs[s.runs.length - 1].s1 - s.len) > 1e-9)
    say("its runs not its plan's");
  // its head at its building's roof
  const p = stairHead(s);
  if (!p || p.key !== s.key || p.tower) {
    say('its head before no building of its own');
    return bad;
  }
  if (p.h !== s.top || stairSurface(s, s.len - 0.1) !== p.h) say(`its head at ${s.top} under a roof at ${p.h}`);
  const a = p.q[s.edge],
    b = p.q[(s.edge + 1) & 3],
    n = outwardOf(p.q, s.edge),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (const x of [s.len - STAIR.head, s.len]) {
    const q = stairPoint(s, x, 0),
      u = ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) / len;
    if (
      !(u > STAIR.end - 1e-6 && u < len - STAIR.end + 1e-6) ||
      Math.abs((q[0] - a[0]) * n[0] + (q[1] - a[1]) * n[1]) > 1e-6
    )
      say("its head off its building's front");
  }
  // a roof to step onto: the building STAIR.roof deep behind its head (stairAt's own law - never a building's sliver)
  for (const x of [s.len - STAIR.head, s.len - STAIR.wall])
    if (!inQuad(p.q, ...stairPoint(s, x, -STAIR.roof)))
      say(`its roof under ${STAIR.roof} m deep behind its head at ${x.toFixed(2)}`);
  const [hr, hc] = cellOfPoint(...[0, 1].map((k) => p.q.reduce((sum, v) => sum + v[k], 0) / 4)),
    Lp = fabricCell(hr, hc);
  if (!Lp.nearStairs.some((o) => sameStair(o, s))) say("the head's cell knows nothing of its stair");
  const opening = [s.len - STAIR.head + 0.15, (2 * s.len - STAIR.head - STAIR.wall) / 2, s.len - STAIR.wall - 0.15];
  if (p.roof === 'flat') {
    for (const x of opening)
      if (Math.abs(edgeTop(p, Lp, s, Lp.nearStairs, x) - p.h) > 1e-3)
        say(`its roof's parapet shut over its head at ${x.toFixed(2)}`);
    if (Math.abs(edgeTop(p, Lp, s, Lp.nearStairs, s.len + 0.3) - p.h - PARAPET) > 1e-3)
      say("its roof's parapet open past its head");
  } else {
    if ((p.roof === 'gableS') !== (s.edge % 2 === 0)) say("its head at a gable's end");
    for (const x of opening)
      if (edgeTop(p, Lp, s, Lp.nearStairs, x) > p.h + 0.2)
        say(`something over the eave at its head at ${x.toFixed(2)}`);
  }
  // the wall behind it
  for (let x = 0.05; x <= s.len - 0.05; x += 0.5) {
    const o = fabricPlotAt(...stairPoint(s, x, -STAIR.into));
    if (!o || (o.key !== p.key && o.h < stairSurface(s, x) + STAIR.rail)) {
      say(`no wall a rail over its step at ${x.toFixed(1)}`);
      break;
    }
  }
  // its foot
  if (s.y0 !== (streetKind(p.sw[s.edge]) === 'main' ? PAVEMENT.h : 0) || stairSurface(s, -0.01) !== s.y0)
    say("its foot off the street's level");
  // a body's way up the street to its first step: no building, no canal, no wall within a body's radius of its face
  for (const x of [-0.3, -0.9, -1.5])
    for (const o of [0.75, 1.05]) {
      const q = stairPoint(s, x, o),
        C = fabricCell(...cellOfPoint(...q)),
        g = fabricGroundAt(...q);
      if (
        fabricPlotAt(...q) ||
        g === GROUND.canal ||
        C.ground.deadEnds.some((w) => pointSeg(...q, w.a, w.b) < 0.3 + CAPSULE_RADIUS) ||
        C.ground.yards.some((w) => pointSeg(...q, w.a, w.b) < YARD_WALL.t / 2 + CAPSULE_RADIUS)
      ) {
        say(`no way to its foot at ${x}, ${o}`);
        break;
      }
    }
  // its ground, and what stands on it
  for (let x = -STAIR.margin + 0.1; x < s.len + STAIR.margin - 0.1; x += 0.7)
    for (const o of [0.4, STAIR.width, STAIR_DEPTH]) {
      const g = fabricGroundAt(...stairPoint(s, x, o)),
        under = g === GROUND.under || stairGround(s, ...stairPoint(s, x, o)) === GROUND.under; // the park's ground under it the park's
      if (under ? stairSurface(s, x - 0.5) - s.rise - STAIR.waist < STAIR.clear : !fabricClosedOf(g)) {
        say(`its ground open at ${x.toFixed(1)}, ${o}`);
        break;
      }
    }
  const cells = new Map();
  for (const [x, z] of [
    [s.box[0], s.box[1]],
    [s.box[2], s.box[1]],
    [s.box[0], s.box[3]],
    [s.box[2], s.box[3]],
  ]) {
    const rc = cellOfPoint(x, z);
    cells.set(rc.join(','), rc);
  }
  for (const [r, c] of cells.values()) {
    const C = fabricCell(r, c);
    for (const bd of fabricCellBuildings(r, c)) {
      const [x, z] = bd.door.at,
        w = FABRIC_DOOR.w / 2 + FABRIC_DOOR.jamb;
      for (const k of [-1, 0, 1])
        if (
          stairGround(
            s,
            x + k * w * -bd.door.n[1] + bd.door.n[0] * 0.3,
            z + k * w * bd.door.n[0] + bd.door.n[1] * 0.3,
          ) === GROUND.stair
        ) {
          say(`a door on its shut ground (building ${bd.key})`);
          break;
        }
    }
    for (const lamp of fabricCellLamps(r, c)) if (inStair(s, ...lamp.at, 0)) say('a lamp on it');
    for (const br of C.bridges)
      for (const t of [0.5, br.len - 0.5])
        if (inStair(s, br.from[0] + br.n[0] * t, br.from[1] + br.n[1] * t, 1.2)) {
          say('a bridge over it');
          break;
        }
    for (const q of C.canals)
      for (let x = 0; x < s.len; x += 1)
        if (inQuad(q, ...stairPoint(s, x, STAIR.width / 2))) {
          say('a canal under it');
          break;
        }
    // nothing else stands in it, no court under it: the cell's walls, sheds, wells, statues and fountains, another stair
    const G = C.ground;
    if (G.yards.some((w) => inFootprint(s, wallPts(w.a, w.b, YARD_WALL.t)))) say('a garden wall in it');
    if (G.deadEnds.some((w) => inFootprint(s, wallPts(w.a, w.b, 0.6)))) say("a dead end's wall in it");
    if (G.sheds.some((v) => inFootprint(s, squarePts(v, SHED.w / 2)))) say('a shed in it');
    if (G.wells.some((v) => inFootprint(s, discPts(v, WELL.r)))) say('a well in it');
    if (G.statues.some((v) => inFootprint(s, squarePts(v, STATUE.plinth / 2)))) say('a statue in it');
    if (G.fountains.some((v) => inFootprint(s, discPts(v, SQUARE_FOUNTAIN.r)))) say('a fountain in it');
    if (
      G.stairs.some(
        (o) =>
          !sameStair(o, s) &&
          inFootprint(
            s,
            wallPts(stairPoint(o, 0, STAIR_DEPTH / 2), stairPoint(o, o.len, STAIR_DEPTH / 2), STAIR_DEPTH),
          ),
      )
    )
      say('another stair in it');
    for (const q of [...C.courts, ...C.parks])
      for (let x = 0; x <= s.len; x += 0.5)
        if ([0.1, STAIR_DEPTH / 2, STAIR_DEPTH].some((o) => inQuad(q, ...stairPoint(s, x, o)))) {
          say('a court or the park under it');
          break;
        }
  }
  for (let x = 0.05; x < s.len; x += 0.25)
    if ([0.25, 0.85, 1.45, STAIR_DEPTH - 0.02].some((o) => fabricPlotAt(...stairPoint(s, x, o)))) {
      say(`a building in it at ${x.toFixed(1)}`);
      break;
    }
  // no ledge or balcony over it: the buildings along it, built as their cells build them
  const along = new Map();
  for (let x = 0; x <= s.len; x += 1) {
    const o = fabricPlotAt(...stairPoint(s, x, -0.3));
    if (o) along.set(o.key, o);
  }
  for (const o of along.values()) {
    const [r, c] = cellOfPoint(...[0, 1].map((k) => o.q.reduce((sum, v) => sum + v[k], 0) / 4)),
      C = fabricCell(r, c);
    // a building a door could enter (a bay before which the street - or the stair - stands; never the park's) keeps its door
    if (doorable(o) && !fabricCellBuildings(r, c).some((bd) => bd.key === o.key))
      say(`building ${o.key} along it lost its door`);
    const mb = new MeshBuilder();
    buildPlot(mb, o, 0, C.nearStairs);
    const m = mb.build();
    for (const sm of m.subMeshes) {
      if (sm.textureRecord !== CAPITAL_ART.wallStone && sm.textureRecord !== CAPITAL_ART.timber) continue;
      for (let i = sm.startIndex; i < sm.startIndex + sm.primitiveCount * 3; i += 3) {
        const v = [0, 1, 2].map((k) => {
          const j = m.indices[i + k] * 3;
          return [m.positions[j], m.positions[j + 1], -m.positions[j + 2]];
        });
        const y = (v[0][1] + v[1][1] + v[2][1]) / 3;
        if (
          y > o.h - 0.01 ||
          (sm.textureRecord === CAPITAL_ART.wallStone && !(y > LEDGE_Y - 0.31 && y < LEDGE_Y + 0.01))
        )
          continue;
        if (inStair(s, (v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][2] + v[1][2] + v[2][2]) / 3, 0)) {
          say(`a ${sm.textureRecord === CAPITAL_ART.timber ? 'balcony' : 'ledge'} over it`);
          break;
        }
      }
    }
  }
  // its mesh
  const faces = stairFaces(s),
    records = new Set(faces.map((f) => `${f.archive}:${f.record}`));
  if (
    records.size !== 2 ||
    !records.has(`${CAPITAL_ARCHIVE}:${CAPITAL_ART.wallStone}`) ||
    !records.has(`${CAPITAL_ARCHIVE}:${CAPITAL_ART.bridgeStone}`)
  )
    say(`its pictures ${[...records]}`);
  if (faces.length > stairBudget(s)) say(`${faces.length} triangles over its budget ${stairBudget(s)}`);
  const risers = new Set(
    faces
      .filter(
        (f) =>
          f.record === CAPITAL_ART.bridgeStone &&
          f.n[0] < -0.99 &&
          f.p.every((q) => q[1] >= -STAIR.into - 1e-3 && q[1] <= STAIR.width + 1e-3 && q[2] <= s.top + 1e-3),
      )
      .map((f) => f.p[0][0].toFixed(2)),
  );
  if (risers.size !== s.risers) say(`${risers.size} risers drawn of ${s.risers}`);
  const down = (x0, x1) =>
    faces.some(
      (f) =>
        f.record === CAPITAL_ART.wallStone &&
        Math.abs(f.n[2]) < 1e-6 &&
        f.p.some((q) => q[2] <= -0.3 + 1e-6) &&
        f.p.every((q) => q[0] >= x0 - 1e-3 && q[0] <= x1 + 1e-3),
    );
  const land = s.runs.filter((g) => g.kind === 'landing');
  const base = (x) =>
    faces.some(
      (f) =>
        f.record === CAPITAL_ART.wallStone &&
        f.n[1] > 0.99 &&
        f.p.every((q) => Math.abs(q[1] - STAIR_DEPTH) < 1e-3) &&
        f.p.some((q) => q[2] <= -0.3 + 1e-6) &&
        Math.min(...f.p.map((q) => q[0])) <= x &&
        Math.max(...f.p.map((q) => q[0])) >= x,
    );
  if (!base(s.runs[0].s1 / 2) || !base((s.runs[1].s0 + s.runs[1].s1) / 2)) say('its base not down into the street');
  for (const g of land.slice(1))
    if (!down(g.s0 - STAIR.tread, g.s1)) say(`no pier down into the street under its landing at ${g.s0.toFixed(1)}`);
  if (!down(s.len - STAIR.wall - 1e-3, s.len)) say('its end wall not down into the street');
  return bad;
}

/** Could a door enter a building at all, the ways up aside - a bay of a street front of its before which (0.8 and 2 m out)
 *  the ground with every stair taken off it (FOUND AT THE SWEEP: a stair's ground had hidden a warped court before a
 *  front, which no door had ever taken) is the street or a square (world/imperialFabricBuildings.js doorOf's law). */
export function doorable(o) {
  const L = fabricCell(...cellOfPoint(...[0, 1].map((k) => o.q.reduce((sum, v) => sum + v[k], 0) / 4))); // its cell's ground, as doorOf reads it
  const bare = (x, z) => fabricGroundIn({ ...L, ground: { ...L.ground, stairs: [] } }, x, z);
  return [0, 1, 2, 3].some((e) => {
    if (!(o.out & (1 << e))) return false;
    const a = o.q[e],
      b = o.q[(e + 1) & 3],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = outwardOf(o.q, e),
      bays = Math.max(1, Math.round(len / BAY));
    return [...Array(bays).keys()].some((k) => {
      const m = [a[0] + ((b[0] - a[0]) * (k + 0.5)) / bays, a[1] + ((b[1] - a[1]) * (k + 0.5)) / bays];
      return [0.8, 2].every((d) => [GROUND.street, GROUND.square].includes(bare(m[0] + n[0] * d, m[1] + n[1] * d)));
    });
  });
}
/** A Collider of the cells' own models round a cell (its eight neighbours too). */
export function cellsCollider(r, c) {
  const col = new Collider(() => 0);
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const m = fabricCellModel(r + dr, c + dc);
      if (m) col.addMesh(`c${dr},${dc}`, m.positions, m.indices, identity());
    }
  return col;
}
/**
 * THE WALK: the real motor on `col` - from the street before a stair's foot up its middle to its head (no jump), over its
 * roof's edge onto the roof, back to the head and down to its foot. Each leg's seconds (null where it never arrived), the
 * feet where each ended (along, out, height), and the worst its feet stood off the stair's own walk on the way up.
 */
export function walkStair(col, s) {
  const m = new PlayerMotor(col, { speed: 50, running: 50, swimming: 30 });
  const W = (x, o) => {
    const q = stairPoint(s, x, o);
    return [q[0], -q[1]];
  };
  const local = () => {
    const x = m.pos[0] - s.at[0],
      z = -m.pos[2] - s.at[1];
    return [x * s.t[0] + z * s.t[1], x * s.n[0] + z * s.n[1], m.pos[1]];
  };
  const frame = (input, yaw) =>
    m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...input }, yaw, 0);
  const [sx, sz] = W(-1.5, STAIR.width / 2);
  m.spawn(sx, s.y0 + 0.05, sz);
  for (let k = 0; k < 30; k++) frame({}, 0);
  let worst = 0,
    climbing = true;
  const walk = (to, secs) => {
    const [tx, tz] = W(...to);
    for (let k = 0; k < secs * 60; k++) {
      if (Math.hypot(tx - m.pos[0], tz - m.pos[2]) < 0.2) return k / 60;
      frame({ forward: 1 }, Math.atan2(tx - m.pos[0], tz - m.pos[2]));
      if (climbing) {
        const [x, o, y] = local();
        if (x > 0 && x < s.len - 0.5 && o > 0.3) worst = Math.max(worst, Math.abs(y - stairSurface(s, x)));
      }
    }
    return null;
  };
  const up = walk([s.len - 1, STAIR.width / 2], 40),
    head = local();
  climbing = false;
  const onto = walk([s.len - 1, -2.5], 10),
    roof = local();
  const back = walk([s.len - 1, STAIR.width / 2], 10),
    down = back === null ? null : walk([-1.5, STAIR.width / 2], 40),
    foot = local();
  return { up, head, onto, roof, down, foot, worst };
}
/** The walk's laws, each broken one a line. */
export function walkProblems(s, w, p = stairHead(s)) {
  const bad = [];
  if (w.up === null || Math.abs(w.head[2] - s.top) > 0.05)
    bad.push(`never walked up to its head (at ${w.head.map((v) => v.toFixed(2))})`);
  if (w.worst > s.rise + 0.02) bad.push(`its feet ${w.worst.toFixed(3)} off its walk`);
  if (w.onto === null || !(w.roof[1] < -2) || !inQuad(p.q, ...stairPoint(s, w.roof[0], w.roof[1])))
    bad.push(`never onto its roof (at ${w.roof.map((v) => v.toFixed(2))})`);
  else if (p.roof === 'flat' ? Math.abs(w.roof[2] - p.h) > 0.05 : w.roof[2] < p.h + 0.5)
    bad.push(`on its roof at ${w.roof[2].toFixed(2)} (the roof's ${p.h})`);
  if (w.down === null || w.foot[2] > s.y0 + 0.05 || w.foot[2] < -0.05 || !(w.foot[0] < 0))
    bad.push(`never back down to its foot (at ${w.foot.map((v) => v.toFixed(2))})`); // on the street, or its pavement
  return bad;
}

/** The sweep over some rows of the plan: every stair once (its block's cell's), its laws and (`walk`) its walk. */
export function sweep(rows, { walk = false, log = console.log } = {}) {
  const tally = {
    cells: 0,
    stairs: 0,
    walked: 0,
    bad: 0,
    risers: 0,
    tris: 0,
    flights: {},
    tops: { min: Infinity, max: 0 },
    problems: {},
  };
  for (const [r, c] of fabricCells(rows)) {
    const L = fabricCell(r, c);
    tally.cells++;
    // every stair near the cell drawn by the cell its middle stands in (none drawn by no cell)
    for (const o of L.nearStairs) {
      const [mr, mc] = cellOfPoint(...stairMiddle(o));
      if (!fabricCell(mr, mc).stairs.some((q) => sameStair(q, o))) {
        tally.bad++;
        tally.problems['drawn by no cell'] = (tally.problems['drawn by no cell'] ?? 0) + 1;
        log(`cell ${r},${c} near stair ${o.key}/${o.edge}: drawn by no cell (its middle in ${mr},${mc})`);
      }
    }
    if (!L.stairs.length) continue;
    const col = walk ? cellsCollider(r, c) : null;
    for (const s of L.stairs) {
      tally.stairs++;
      tally.risers += s.risers;
      tally.tris += stairFaces(s).length;
      tally.flights[s.flights.length] = (tally.flights[s.flights.length] ?? 0) + 1;
      tally.tops.min = Math.min(tally.tops.min, s.top);
      tally.tops.max = Math.max(tally.tops.max, s.top);
      const bad = stairProblems(s, L);
      if (walk && !bad.some((m) => /building of its own/.test(m))) {
        tally.walked++;
        bad.push(...walkProblems(s, walkStair(col, s)));
      }
      if (bad.length) {
        tally.bad++;
        for (const m of bad) {
          const k = m.replace(/[-\d.,]+/g, '#');
          tally.problems[k] = (tally.problems[k] ?? 0) + 1;
        }
        log(`cell ${r},${c} stair ${s.key}/${s.edge} (${s.top} m): ${bad.join('; ')}`);
      }
    }
  }
  return tally;
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2),
    opt = (k) => {
      const i = argv.indexOf(k);
      return i >= 0 ? argv[i + 1] : null;
    };
  const walk = argv.includes('--walk'),
    jobs = Number(opt('--jobs') ?? 1),
    rows = (opt('--rows') ?? `0:${IMPERIAL_CELLS}`).split(':').map(Number);
  const t0 = Date.now();
  const merge = (all) =>
    all.reduce(
      (a, t) => {
        for (const k of ['cells', 'stairs', 'walked', 'bad', 'risers', 'tris']) a[k] += t[k];
        for (const [k, v] of Object.entries(t.flights)) a.flights[k] = (a.flights[k] ?? 0) + v;
        for (const [k, v] of Object.entries(t.problems)) a.problems[k] = (a.problems[k] ?? 0) + v;
        a.tops.min = Math.min(a.tops.min, t.tops.min);
        a.tops.max = Math.max(a.tops.max, t.tops.max);
        return a;
      },
      {
        cells: 0,
        stairs: 0,
        walked: 0,
        bad: 0,
        risers: 0,
        tris: 0,
        flights: {},
        tops: { min: Infinity, max: 0 },
        problems: {},
      },
    );
  const done = (tally) => {
    const out = { ...tally, seconds: Math.round((Date.now() - t0) / 1000), walk };
    console.log(JSON.stringify(out));
    if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(out, null, 1));
    process.exit(tally.bad ? 1 : 0);
  };
  if (jobs > 1 && !process.send) {
    // the rows shared out, a process each (the layouts are a process's own LRU)
    const span = rows[1] - rows[0],
      parts = [];
    for (let j = 0; j < jobs; j++)
      parts.push([rows[0] + Math.floor((span * j) / jobs), rows[0] + Math.floor((span * (j + 1)) / jobs)]);
    const results = await Promise.all(
      parts.map(
        ([a, b]) =>
          new Promise((res, rej) => {
            const child = fork(fileURLToPath(import.meta.url), ['--rows', `${a}:${b}`, ...(walk ? ['--walk'] : [])], {
              stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
            });
            child.on('message', res);
            child.on('exit', (code) =>
              code === 0 || code === 1 ? null : rej(new Error(`job ${a}:${b} exited ${code}`)),
            );
          }),
      ),
    );
    done(merge(results));
  } else {
    const tally = sweep(rows, { walk });
    if (process.send) process.send(tally, () => process.exit(0));
    else done(tally);
  }
}
