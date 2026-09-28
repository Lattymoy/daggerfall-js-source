// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DUNGEON-SEAMS (2026-09-26, a player, relayed by Mac: "if you look
// around stairs and curved cellings in dungeons, you can spot holes
// leading into void, sometimes you can even see other rooms through
// those holes") - THE HOLES IN DAGGERFALL'S OWN MODELS, CLOSED.
//
// The holes are the data's, not the port's: Arch3dFile reads ARCH3D
// byte for byte as DFU does (the parity harness, AUDIT 18; DFU's own
// Arch3dPatch.cs byte fixes included, formats/arch3dPatch.js), and DFU
// shows every one of them. A stair's treads and risers stop one or two
// units (2.5-5 cm; the spiral landing's flight, four) short of the
// stair's own side walls, with nothing modelled under them; a
// corridor's posts float a unit or two off its floor; and some vaulted
// and round rooms' ceilings stop short of the corridor piece they meet.
// Through a slit the camera sees
// the interior's black clear colour - the "void" - or another room of
// the level, which is drawn whole behind it (a dungeon has no occlusion
// culling to hide it).
//
// XJDHDR's "Unofficial Block, Location and Model Fixes" for DFU replaces
// 25 of the 32 meshes ruled here (its Model fixes page: "Closed holes
// between steps and walls", "Closed gaps between the pillars' ends and
// the ceiling + floor", "Fixed gap between the ... circle's ceiling and
// adjacent corridor models"...); the other seven are the census's, the
// same defect in a variant or a re-textured twin. The port cannot ship
// those meshes, so it moves the offending corners itself - a table of
// rules per model, each a coordinate that moves to the face it was meant
// to meet, measured by tools/seamCensus.mjs over every dungeon block of
// the player's own data, where each moved corner lands measured too (and
// pinned by test/dungeonseams.test.js, data-gated). The reader is untouched - the
// patch is applied to a COPY where the pipeline builds a model
// (scenes/dataPipeline.js), so the parity harness still reads DFU's
// bytes - and it is recorded as a departure in the Port-Ledger.
//
// A MOVED CORNER KEEPS ITS TEXTURE COORDINATES (ARCH3D stores them per
// corner): no corner moves more than five units (12.5 cm). Measured on
// every drawn triangle's edges, a straight flight's stretches by at most
// 4.5%; the spiral's steps by 8.3%; and the first risers of 59002 and
// the sloped stair, a hand high, by 13-14% (AUDIT DUNGEON-SEAMS 6). No
// triangle flips or folds flat. The collider is built from the same positions, so a
// foot finds the tread where the eye does - and the nav-mesh cache is
// versioned past it (ai/navClient.js NAV_BAKE_VERSION).
// ═══════════════════════════════════════════════════════════════════

/** @typedef {{ axis: 'x'|'y'|'z', map: Record<string, number> }} AxisRule */
/** @typedef {{ at: [number, number, number], to: [number, number, number] }} PointRule */

/** Stair sides: every corner on `from` moves to `to`, on one axis - the treads' and risers' ends out to the wall. */
const side = (axis, pairs) => ({ axis, map: Object.fromEntries(pairs) });
/** One stray corner, where it stands and where its neighbours expect it. */
const point = (at, to) => ({ at, to });
/** THE VAULT CORNER (61004, and its two re-textured twins): two corners off the unit grid by up to a unit - a wedge up
 *  to 13 mm wide along the ceiling's joins with the corridor pieces round it (61003, 61020, 61021, ...). */
const VAULT_CORNER = [point([128.242, -128, 31.199], [128, -128, 32]), point([-63.996, -95.02, -127.992], [-64, -95.996, -128])];
/** THE SPIRAL's steps, out to the shaft's four walls. */
const SPIRAL = [side('x', [[120, 122], [-120, -122]]), side('z', [[120, 122], [-120, -122]])];
/** THE SLOPED STAIR (63026): its ramp's four corners onto the floors' edges it joins, its first riser's foot onto the
 *  floor. (Its last tread overhangs the next floor a unit above it - a lip with the floor under it, no hole: moved onto
 *  the floor's edge it butted there with no corner shared and the joint cracked a pixel at a time, AUDIT DUNGEON-SEAMS
 *  3.) */
const SLOPED_STAIR = [
  point([2, 4, 64], [0, 0, 64]), point([-130, 4, 64], [-128, 0, 64]),
  point([2, -124, -192], [0, -128, -192]), point([-130, -124, -192], [-128, -128, -192]),
  point([-2, -2, 68], [-2, 0, 68]), point([-128, -2, 68], [-128, 0, 68]),
];
/** THE ROUND ROOM (63034, and its re-textured twins 63134 and 63234): four corners of its ceiling's rim, off the corridor mouths it
 *  meets (63007 at x -256, 63041 at z 256) by up to two and a half units - each onto the corridor's own corner. */
const ROUND_ROOM = [
  point([61.688, -126, 256.617], [64, -126, 256]),
  point([-256.617, -126, -61.684], [-256, -126, -64]),
  point([-255.621, -126, -193.121], [-256, -126, -192]),
  point([-256.082, -25.152, -215.754], [-256, -24, -216]),
];

/**
 * THE RULES, by ARCH3D model id - in the model's own units (a point's ARCH3D value over 256). A point whose `axis`
 * coordinate is a key of `map` (to within POINT_EPS) takes the value it maps to; a point within STRAY_EPS of a
 * PointRule's `at` on all three axes stands at its `to`.
 * @type {Readonly<Record<number, ReadonlyArray<AxisRule | PointRule>>>}
 */
export const SEAM_RULES = Object.freeze({
  // STAIRS - the treads and risers of the straight flights, one or two units short of their own side walls
  61017: [side('x', [[62, 64], [-62, -64]])],
  61018: [side('x', [[62, 64], [-62, -64]])],
  61117: [side('x', [[62, 64], [-62, -64]])],
  61118: [side('x', [[62, 64], [-62, -64]])],
  61218: [side('x', [[62, 64], [-62, -64]])],
  67016: [side('x', [[63, 64], [-63, -64]])],
  67025: [side('x', [[63, 64], [-63, -64]])],
  67116: [side('x', [[63, 64], [-63, -64]])],
  67125: [side('x', [[63, 64], [-63, -64]])],
  67225: [side('x', [[63, 64], [-63, -64]])],
  58008: [side('x', [[48, 50], [-48, -50]])],
  58009: [side('x', [[358, 360], [154, 152]])],
  58050: [side('x', [[-358, -360], [-154, -152]])],
  59002: [side('x', [[-166, -168], [38, 40]]), side('y', [[-2, 0]])],   // and its foot, walls and first riser, two units over the floor it stands on
  59007: [side('x', [[-358, -360], [102, 104]])],
  59011: [side('x', [[102, 104], [-102, -104]])],
  59012: [side('x', [[230, 232], [-230, -232]])],
  59013: [side('x', [[102, 104], [-102, -104]])],
  // THE L: two flights about a landing, each two units off the stringer wall beside it (x 24; z -24) - and that wall's
  // foot four units over the landing at its far end, a sliver along the landing's edge
  59004: [side('x', [[26, 24]]), side('z', [[-26, -24]]), point([-256, -2, -24], [-256, 2, -24])],
  // THE SLOPED STAIR (and its re-textured 63126): the ramp under its steps four units under the floors it runs between,
  // and its first riser two units over the floor it rises from - a slit at each, the level below or the void behind it
  63026: SLOPED_STAIR,
  63126: SLOPED_STAIR,
  // THE SPIRAL: square in plan, its steps stopping at +-120 inside a shaft (56008/56009) whose walls stand at +-122
  56300: SPIRAL,
  56301: SPIRAL,
  // ...and the flight that ends on the landing (56000), which every block stands two units off its shaft's centre: its
  // -x ends already on the wall at -120, its +x ends and the landing's edge four and two units short of the wall at 124
  56000: [side('x', [[120, 124], [122, 124]]), side('z', [[120, 122], [-120, -122]])],
  // ...and the wedge under that landing (56002), off the same centre: its +x edge two units short of the wall
  56002: [side('x', [[122, 124]])],
  // THE POSTS: two free-standing posts in a corridor (63022) stopping a unit or two short of its floor and ceiling
  63022: [side('y', [[-2, 0], [-1, 0], [-124, -126]])],
  // CEILINGS - corners off the grid, where the vault or the round room meets the corridor
  61004: VAULT_CORNER,
  61104: VAULT_CORNER,
  61204: VAULT_CORNER,
  63034: ROUND_ROOM,
  63134: ROUND_ROOM,
  63234: ROUND_ROOM,
});

/** How near a coordinate must be to a rule's value to be it (ARCH3D's grid is 1/256). */
export const POINT_EPS = 1e-6;
/** How near a stray corner must be to the rule's `at` - its three coordinates to the thousandth the table spells. */
export const STRAY_EPS = 0.002;
const AXIS = { x: 'x', y: 'y', z: 'z' };

/** One point through a model's rules - a new point when a rule moves it, else the same one. */
function movedPoint(p, rules) {
  let out = p;
  for (const r of rules) {
    if ('at' in r) {
      if (Math.abs(out.x - r.at[0]) <= STRAY_EPS && Math.abs(out.y - r.at[1]) <= STRAY_EPS && Math.abs(out.z - r.at[2]) <= STRAY_EPS) {
        out = { ...out, x: r.to[0], y: r.to[1], z: r.to[2] };
      }
      continue;
    }
    const k = AXIS[r.axis];
    const v = out[k];
    for (const from in r.map) {
      if (Math.abs(v - Number(from)) <= POINT_EPS) {
        if (out === p) out = { ...p };
        out[k] = r.map[from];
        break;
      }
    }
  }
  return out;
}

/**
 * THE PATCH: `dfMesh` (Arch3dFile.getMesh's, which the archive caches and others read) as the port draws model
 * `modelId` - a copy with its rules applied, or the very mesh when it has none.
 */
export function patchSeams(modelId, dfMesh) {
  const rules = SEAM_RULES[modelId];
  if (!rules || !dfMesh?.subMeshes) return dfMesh;
  return {
    ...dfMesh,
    subMeshes: dfMesh.subMeshes.map((sm) => ({
      ...sm,
      planes: sm.planes.map((pl) => ({ ...pl, points: pl.points.map((p) => movedPoint(p, rules)) })),
    })),
  };
}
