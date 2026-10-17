#!/usr/bin/env node
// FIELD BUGS 2026-10-16b STALL-SHAPE: A YARD'S SAVED STALLS AND BOULDERS, RE-SEATED WHERE THEIR OWNERS PUT THEM.
//
//   node tools/yardReseat.mjs           print the migration (server-account/migrations/0121_yard_reseat.sql) it writes
//   node tools/yardReseat.mjs --write   write it
//
// A yard's piece is a record of where its model's ORIGIN stands - `pos`, from its building's own origin, with its turn
// and its scale (net/decorLaw.js decorPlaceOf) - worked out by the placer against the model as it stood that day: a
// model is lifted by its own bottom and set clear of a wall by its own reach (systems/decor/decorPlacer.js - "the RECORD says
// where the origin is - nothing is re-derived at a restore"). So a stand-in rebuilt round another origin moves every
// piece placed by the old one. FIELD BUGS 2026-10-15f TEMPLE-STEPS (c2b52fdff1, the web's deploy done at
// 2026-10-16T00:43:25Z) rebuilt two kinds a yard can hold:
//
//   - THE MARKET STALLS: the mesh at the prefab's 0.75 about the origin Unity stands it on - its counter at the origin,
//     its back 2 m along -x - where the stand-in had been the mesh at 1 with its back at the origin. Every saved stall
//     drew 2.06 m (times its scale) further back - into the wall its owner had stood it against - and a quarter smaller.
//     STALL-SHAPE rebuilds the pack's other stall (53113 on) about its own origin too, 0.26 m further back again.
//   - THE BOULDERS: the mesh's box at its prefab's scale of 2 to 8, centred on the box's middle - where the stand-in had
//     been the mesh at 1, round the origin. Every saved boulder grew two to eight times about another middle.
//
// The migration puts each back: its model's box as it stood when the piece was placed (WAS), and as it stands now (NOW),
// turned by the piece's own turn and times its scale - the origin moved so the box's middle over the ground and its foot
// stand where they stood, and the scale divided by what the stand-in grew (`k`), so the piece is the size its owner saw.
// No piece is made smaller than the law's least scale (DECOR_SCALE_MIN, a boulder of 8 placed under 2 stands at it,
// bigger than it was), none moves past its yard's bound (DECOR_YARD_POS_MAX, down as well - decorPlaceOf drops a place
// past it on any axis) or up past its height (DECOR_YARD_HIGH),
// and a piece re-seated carries `reseat` in its place (decorPlaceOf reads past it), which this statement never moves
// twice. A piece placed before the deploy (`placed_at`, the service's own clock) was placed by WD3's stand-ins; one placed
// since, by TEMPLE-STEPS' - its rocks are STALL-SHAPE's, and only the second stall moved. No record says a piece was moved
// since it was placed: one placed before and moved since is put back as if it had not been (the owner moves it once more).
//
// The turn is the place's yaw alone (`rot[0]`): the placer mints a model's place [yaw, 0, 0] (systems/decor/decorPlacer.js), so
// no saved stall or boulder carries a pitch or a roll; one sent by hand is re-seated about its yaw.
//
// Arithmetic alone: the turn's cosine and sine are their Taylor series to the 18th and 19th powers (|turn| <= 180
// degrees - within 1e-8), so no statement leans on SQLite's math extension, which a D1 database is not promised to carry.
// The WAS boxes are the stand-ins' own, evaluated from their builders at f3ed9e2097 (WD3, unchanged to c2b52fdff1^) and
// at c2b52fdff1; the NOW boxes are the builders' at this change - test/world/fb1016b_stallshape.test.js holds them to the live
// builders, so a stand-in whose box moves again fails there until its saved pieces are re-seated.
import { writeFileSync, readFileSync } from 'node:fs';
import { isMain } from './lib/isMain.mjs';
import { DECOR_SCALE_MIN, DECOR_SCALE_MAX, DECOR_YARD_POS_MAX, DECOR_YARD_HIGH } from '../src/net/decorLaw.js';

export const YARD_RESEAT_FILE = 'server-account/migrations/0121_yard_reseat.sql';
/** What a re-seated piece's place carries, and the statement asks before it moves one. */
export const YARD_RESEAT_MARK = 'STALL-SHAPE';
/** TEMPLE-STEPS' stand-ins reached the players: #934's web deploy done, 2026-10-16T00:43:25Z (the service's seconds). */
export const YARD_RESEAT_AT = 1792111405;

/** A box: render/frustum.js localAabb's [minX, minY, minZ, maxX, maxY, maxZ], metres. */
/** Every stall's, WD3's builder (x0 -0.4 to x1 2.75, the awning's high edge 4.4). */
export const STALL_BOX_WD3 = Object.freeze([-0.4, 0, -2.4, 2.75, 4.4, 2.45]);
/** Every stall's, TEMPLE-STEPS' - and STALL-SHAPE's counter stall's (the box kept). */
export const STALL_BOX_NOW = Object.freeze([-2.0625, 0, -1.86, 0.3, 3.3, 1.8]);
/** STALL-SHAPE's open stall (53113 on): the frame 0.2 m back, 0.206 up, 0.066 across, no counter, at 0.75. */
export const OPEN_STALL_BOX_NOW = Object.freeze([-2.2125, 0, -1.8105, -0.0615, 3.4545, 1.8495]);
export const COUNTER_STALLS = Object.freeze([53100, 53101, 53102, 53103, 53104, 53106, 53107, 53108, 53109]);
export const OPEN_STALLS = Object.freeze([53113, 53115, 53117, 53118, 53121, 53122, 53123, 53124]);
/** What the stalls grew by at TEMPLE-STEPS: the prefab's 0.75. */
export const STALL_K = 0.75;
/** Each rock's, WD3's builder (the boulder round its origin, the mesh at 1, its rim pushed out by its id's seed). */
export const ROCK_BOX_WD3 = Object.freeze({
  53006: [-0.226406, -0.12, -0.251709, 0.278465, 0.33, 0.296942], 53012: [-0.473724, -0.13, -0.268142, 0.431261, 0.28, 0.26585],
  53014: [-0.615383, -0.05, -0.46802, 0.47357, 0.35, 0.535653], 53017: [-0.2817, -0.05, -0.428387, 0.296552, 0.64, 0.429729],
  53020: [-0.743893, -0.05, -0.598985, 0.787606, 0.96, 0.642975], 53023: [-0.681927, -0.25, -0.594267, 0.652108, 0.52, 0.666381],
  53029: [-0.302549, -0.09, -0.274144, 0.264379, 0.17, 0.303291], 53030: [-0.313368, -0.07, -0.213128, 0.275539, 0.17, 0.194352],
  53031: [-0.238374, -0.09, -0.232624, 0.262537, 0.18, 0.194537], 53032: [-0.556896, -0.12, -0.514704, 0.537748, 0.22, 0.54053],
  53033: [-0.313258, -0.1, -0.283295, 0.305679, 0.12, 0.295455], 53035: [-0.31748, -0.4, -0.296898, 0.391648, 0.41, 0.31919],
  53036: [-0.329286, -0.1, -0.287957, 0.357572, 0.54, 0.297244], 53037: [-0.925233, -0.14, -0.837453, 0.95666, 0.71, 0.792177],
  53038: [-0.960688, -0.18, -0.664702, 0.768595, 0.47, 0.665316], 53039: [-1.069271, -0.16, -0.846553, 1.246957, 0.66, 0.871185],
  53040: [-1.23477, -0.19, -1.291343, 1.175076, 0.52, 1.368774], 53042: [-1.031626, -0.11, -1.034972, 1.030194, 0.22, 1.069274],
  53054: [-0.380459, -0.05, -0.292738, 0.467575, 0.13, 0.298958], 53064: [-0.363017, -0.05, -0.428691, 0.376021, 0.37, 0.409391],
  53083: [-0.406759, -0.05, -0.23743, 0.335147, 0.13, 0.249957], 53085: [-0.346818, -0.05, -0.318846, 0.316258, 0.14, 0.27277],
  53086: [-1.208504, -0.05, -0.617461, 1.16387, 0.56, 0.633971],
});
/** Each rock's, TEMPLE-STEPS' builder - unchanged by STALL-SHAPE. */
export const ROCK_BOX_NOW = Object.freeze({
  53006: [-1.366447, -0.738, -1.562793, 1.492473, 1.962, 1.594734], 53012: [-2.148195, -0.65, -1.271291, 1.946256, 1.39, 1.189943],
  53014: [-1.885066, -0.05, -1.489733, 2.188409, 1.396, 2.212384], 53017: [-1.211771, -0.05, -2.031227, 1.987632, 3.834, 2.642086],
  53020: [-2.559338, -0.05, -1.939317, 2.992115, 3.844, 2.732568], 53023: [-1.525747, -0.51, -1.151077, 0.936068, 1.046, 1.151977],
  53029: [-2.055897, -0.552, -1.791453, 1.126483, 1.002, 1.386954], 53030: [-2.74289, -0.552, -1.61654, 1.479394, 1.336, 1.414485],
  53031: [-1.633253, -0.51, -1.290151, 1.191586, 1.056, 1.111467], 53032: [-1.496333, -0.372, -1.489537, 1.467867, 0.672, 1.417229],
  53033: [-1.197188, -0.408, -1.247501, 1.112523, 0.476, 0.966032], 53035: [-1.135145, -0.36, -1.501593, 1.578086, 1.984, 1.5787],
  53036: [-1.769261, -0.618, -1.570251, 2.015764, 3.246, 1.747795], 53037: [-3.164011, -0.564, -2.745274, 3.847995, 2.86, 3.355369],
  53038: [-3.579495, -0.704, -1.986528, 2.962217, 1.872, 3.082199], 53039: [-4.264714, -0.656, -3.381254, 4.294974, 2.632, 2.844407],
  53040: [-2.999847, -0.567, -3.277583, 3.513542, 1.569, 3.971793], 53042: [-3.665372, -0.456, -4.08858, 3.904145, 0.896, 3.747141],
  53054: [-2.528612, -0.05, -2.401428, 3.891707, 1.064, 1.919181], 53064: [-2.095135, -0.05, -2.500007, 2.131888, 2.202, 2.098935],
  53083: [-2.233555, -0.05, -1.357521, 1.974411, 0.798, 1.402978], 53085: [-1.930978, -0.05, -3.009645, 2.948896, 1.088, 1.476333],
  53086: [-5.163713, -0.05, -2.232297, 3.400785, 2.24, 2.427954],
});
/** What each rock grew by at TEMPLE-STEPS: its prefab's scale (world/townStandIns.js RMBRP_ROCK_SCALE as it stood). */
export const ROCK_K = Object.freeze({
  53006: 6, 53012: 5, 53014: 4, 53017: 6, 53020: 4, 53023: 2, 53029: 6, 53030: 8, 53031: 6, 53032: 3, 53033: 4, 53035: 4,
  53036: 6, 53037: 4, 53038: 4, 53039: 4, 53040: 3, 53042: 4, 53054: 8, 53064: 6, 53083: 6, 53085: 8, 53086: 4,
});

/**
 * THE RE-SEATS, one a model and a time: `before` - placed before YARD_RESEAT_AT (WD3's stand-ins) or since (TEMPLE-STEPS');
 * `was` the box it was placed by, `now` the box it stands by, `k` what the model grew by between them.
 * @type {ReadonlyArray<{ model: number, before: boolean, was: readonly number[], now: readonly number[], k: number }>}
 */
export const YARD_RESEATS = Object.freeze([
  ...COUNTER_STALLS.map((model) => ({ model, before: true, was: STALL_BOX_WD3, now: STALL_BOX_NOW, k: STALL_K })),
  ...OPEN_STALLS.map((model) => ({ model, before: true, was: STALL_BOX_WD3, now: OPEN_STALL_BOX_NOW, k: STALL_K })),
  ...OPEN_STALLS.map((model) => ({ model, before: false, was: STALL_BOX_NOW, now: OPEN_STALL_BOX_NOW, k: 1 })),
  ...Object.keys(ROCK_BOX_WD3).map(Number).map((model) => ({ model, before: true, was: ROCK_BOX_WD3[model], now: ROCK_BOX_NOW[model], k: ROCK_K[model] })),
].map(Object.freeze));

const round = (v, places) => { const p = 10 ** places; return Math.round(v * p) / p; };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mid = (b, a) => (b[a] + b[a + 3]) / 2;

/** The re-seat's own numbers for a piece of `scale` turned `yaw` degrees: its new scale, and how far its origin moves in
 *  the yard's frame - [dx, dy, dz]. */
export function reseatMove({ was, now, k }, scale, yaw) {
  const s2 = clamp(round(scale / k, 3), DECOR_SCALE_MIN, DECOR_SCALE_MAX);
  const lx = scale * mid(was, 0) - s2 * mid(now, 0), lz = scale * mid(was, 2) - s2 * mid(now, 2);
  const r = (yaw * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  // world/mat4.js trs's turn about y: a model's +x stands at (cos, -sin) in the yard, its +z at (sin, cos)
  return { scale: s2, d: [c * lx + s * lz, scale * was[1] - s2 * now[1], -s * lx + c * lz] };
}
/** A yard piece's `place` re-seated - the same fields, its origin and scale moved, the mark set - as the migration writes it. */
export function reseatPlace(place, reseat) {
  const { scale, d } = reseatMove(reseat, place.scale, place.rot[0]);
  const B = DECOR_YARD_POS_MAX;
  const pos = [round(clamp(place.pos[0] + d[0], -B, B), 3), round(clamp(place.pos[1] + d[1], -B, DECOR_YARD_HIGH), 3), round(clamp(place.pos[2] + d[2], -B, B), 3)];
  return { ...place, pos, scale, reseat: YARD_RESEAT_MARK };
}

/**
 * STALL-SHAPE's audit: A YARD PIECE BROUGHT BACK FROM A SNAPSHOT (tools/realmRestore.mjs, a `home_decor` row as the dump
 * holds it) stands as this migration would have left it. One placed by WD3's stand-ins (before YARD_RESEAT_AT) with no
 * mark was never re-seated - by this law it is now. One placed since by TEMPLE-STEPS' open stall may have been placed by
 * STALL-SHAPE's instead (no record says which stand-in a piece was placed against, nor a snapshot whether 0121 had run):
 * it is written as the snapshot holds it, and `unsure` says so to the operator. Never moved twice: a marked place is kept.
 * @param {Record<string, any>} row
 * @returns {{ row: Record<string, any>, reseated: boolean, unsure: boolean }}
 */
export function reseatRestored(row) {
  const kept = { row, reseated: false, unsure: false };
  if (row.yard !== 1) return kept;
  let place;
  try { place = JSON.parse(row.place); } catch { return kept; }
  if (!place || typeof place !== 'object' || place.reseat != null || !Array.isArray(place.pos) || !Array.isArray(place.rot)) return kept;
  const before = row.placed_at < YARD_RESEAT_AT;
  const reseat = YARD_RESEATS.find((m) => m.model === row.model && m.before === before);
  if (!reseat) return kept;
  if (!before) return { row, reseated: false, unsure: true };
  return { row: { ...row, place: JSON.stringify(reseatPlace(place, reseat)) }, reseated: true, unsure: false };
}

const num = (v) => String(round(v, 6));
/** A Taylor series in Horner's form over `r2` (r squared): 1 - r2/d0 (1 - r2/d1 (1 - ...)), each d the next two terms'
 *  ratio - the cosine's 1*2, 3*4, ... 17*18 (to r^18), the sine's 2*3, ... 18*19 (to r^19, times r). */
const horner = (denominators) => denominators.reduceRight((inner, d) => `(1 - r2 / ${d} * ${inner})`, '1');
const COS = horner([2, 12, 30, 56, 90, 132, 182, 240, 306]);
const SIN = `r * ${horner([6, 20, 42, 72, 110, 156, 210, 272, 342])}`;

/** THE MIGRATION's text. */
export function reseatSql() {
  const rows = YARD_RESEATS.map((m) => `  (${m.model}, ${m.before ? 1 : 0}, ${num(mid(m.was, 0))}, ${num(mid(m.was, 2))}, ${num(m.was[1])}, ${num(mid(m.now, 0))}, ${num(mid(m.now, 2))}, ${num(m.now[1])}, ${num(m.k)})`);
  const B = DECOR_YARD_POS_MAX;
  const at = new Date(YARD_RESEAT_AT * 1000).toISOString().replace('.000Z', 'Z');
  return `-- FIELD BUGS 2026-10-16b STALL-SHAPE - A YARD'S SAVED STALLS AND BOULDERS, RE-SEATED WHERE THEIR OWNERS PUT THEM.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the \`d1_migrations\` ledger, which the deploy runs (ACC1-CI).
--
-- WRITTEN BY tools/yardReseat.mjs (node tools/yardReseat.mjs --write) - its header says why; test/world/fb1016b_stallshape.test.js
-- holds this file to it, and runs it over the real service's own rows.
--
-- A yard's piece records where its model's origin stands, worked out against the model as it stood the day it was placed.
-- TEMPLE-STEPS (FIELD BUGS 2026-10-15f; the web's deploy done ${at}, ${YARD_RESEAT_AT} below) rebuilt the market stalls
-- about another origin, a quarter smaller, and the boulders two to eight times bigger about another middle; STALL-SHAPE
-- rebuilt the second stall (53113 on) 0.26 m further back again. Each piece is put back: its model's box as it was (\`was\`)
-- and as it is (\`now\`), turned by its own turn and times its scale - its origin moved so the box's middle and its foot
-- stand where they stood, and its scale divided by what the model grew (\`k\`), never under ${DECOR_SCALE_MIN} or over ${DECOR_SCALE_MAX}
-- (net/decorLaw.js), never past its yard's +-${B} m on any axis (decorPlaceOf drops a place past it) nor up past
-- ${DECOR_YARD_HIGH} m. A piece placed before the deploy was placed by WD3's stand-ins (\`before\` 1); one since, by TEMPLE-STEPS'
-- (only the second stall has moved since). A re-seated place carries "reseat": "${YARD_RESEAT_MARK}", and no place that
-- carries it is moved again. Rooms (\`yard\` 0) hold neither. A place that is not JSON is passed over, whatever order
-- the terms are read in (0109's care: json_extract would throw).
-- The turn's cosine and sine are their series (|turn| <= 180 degrees): arithmetic alone, no extension asked. The scale is
-- divided as a REAL - a scale of 1 over a rock's 6 is a sixth, never SQLite's integer 0.
WITH f(model, before, wx, wz, wy, nx, nz, ny, k) AS (VALUES
${rows.join(',\n')}
)
UPDATE home_decor SET place = (
  SELECT json_set(home_decor.place,
    '$.pos[0]', ROUND(MIN(${B}, MAX(-${B}, x + c * dx + sn * dz)), 3),
    '$.pos[1]', ROUND(MIN(${DECOR_YARD_HIGH}, MAX(-${B}, y + dy)), 3),
    '$.pos[2]', ROUND(MIN(${B}, MAX(-${B}, z - sn * dx + c * dz)), 3),
    '$.scale', s2,
    '$.reseat', '${YARD_RESEAT_MARK}')
  FROM (SELECT x, y, z, s2, ${COS} AS c, ${SIN} AS sn,
          s * wx - s2 * nx AS dx, s * wz - s2 * nz AS dz, s * wy - s2 * ny AS dy
        FROM (SELECT x, y, z, s, r, r * r AS r2, MIN(${DECOR_SCALE_MAX}, MAX(${DECOR_SCALE_MIN}, ROUND(CAST(s AS REAL) / k, 3))) AS s2, wx, wz, wy, nx, nz, ny
              FROM (SELECT json_extract(home_decor.place, '$.pos[0]') AS x, json_extract(home_decor.place, '$.pos[1]') AS y,
                      json_extract(home_decor.place, '$.pos[2]') AS z, json_extract(home_decor.place, '$.scale') AS s,
                      json_extract(home_decor.place, '$.rot[0]') * 3.141592653589793 / 180 AS r, f.*
                    FROM f WHERE f.model = home_decor.model AND f.before = (home_decor.placed_at < ${YARD_RESEAT_AT})))))
WHERE yard = 1 AND json_valid(place) AND (CASE WHEN json_valid(place) THEN json_extract(place, '$.reseat') END) IS NULL
  AND EXISTS (SELECT 1 FROM f WHERE f.model = home_decor.model AND f.before = (home_decor.placed_at < ${YARD_RESEAT_AT}));
`;
}

if (isMain(import.meta.url)) {
  const sql = reseatSql();
  if (process.argv.includes('--write')) {
    writeFileSync(new URL(`../${YARD_RESEAT_FILE}`, import.meta.url), sql);
    console.log(`wrote ${YARD_RESEAT_FILE}`);
  } else if (process.argv.includes('--check')) {
    const on = readFileSync(new URL(`../${YARD_RESEAT_FILE}`, import.meta.url), 'utf8');
    console.log(on === sql ? 'the migration is the tool\'s' : 'the migration is NOT the tool\'s');
    process.exitCode = on === sql ? 0 : 1;
  } else process.stdout.write(sql);
}
