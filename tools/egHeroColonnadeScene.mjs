// THE BROKEN COLONNADE, THE HERO PASSAGE - the Broken Galleries' third hero fragment, its scene written from numbers.
//
//     node tools/egHeroColonnadeScene.mjs [--out=src/assets/egfrags/source/egheroColonnade.fbx]
//
// EG-HERO (2026-10-13, Mac: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md sections 11.2 and 11.6).
// Written from numbers alone (no game data, no third-party art, no trigonometry - tools/egHeroKit.mjs's tables and hash),
// through the reference's writer (tools/egRefFragScene.mjs writeRefFragFbx), baked by tools/bakeEgHeroColonnade.mjs through
// tools/fragBake.mjs; test/tooling/eghero_galleries.test.js writes it again and holds it to the committed bytes.
//
// THE PLACE (section 11.2's row: "a colonnade toppled across the void: drums as steps, arches to run along"): the Galleries'
// great colonnade come down across the void. The company enters under a standing arch, onto a length of its entablature
// still riding two columns whose feet are gone into the dark; crosses on a drum lying where it fell (the course's still
// piece) and on two drums ROLLING back and forth along fallen architraves at the law's fixed 2.0 m/s (its signature -
// net/eliteGates/egSpanLaw.js EG_DRUM_MPS, ridden as Rails); and lands on the far length of entablature, out under the second arch. On
// either side the colonnade stands broken in the void - columns rising from nowhere to broken tops and gilded capitals, a
// lintel still bridging two of them, one column fallen right across under the course, loose drums adrift below. A capital
// standing clear of the near landing's east side holds lumen past an optional hard jump (the alcove). Open to the sky: no
// wall, no vault, no ceiling.
//
// THE ENVELOPE - the code-built Colonnade passage's (net/eliteGates/egFragLaw.js egFragPassage 'colonnade'):
//   open (`open` 1, `height` 0 - no walls, no vault): the mouth 5 m wide (halfW 250) at the foot of the mouth (0, 0, 0), the
//   floor at Z 0, its opening under the arch 4.6 m to the spring (a socket keeps at least 3.5 m);
//   28 m long (len 2800), one exit 5 m wide at Y 28, its floor at Z 0;
//   its course the kit's (EG_FRAG_PIECES.colonnade): a still drum, then two drums rolling 1.4 m either way (the kit's 1.5,
//   held 0.3 m clear of what stands beside each), the landings 4.6 m and 4.8 m (the kit's 3.9 m, for a fight);
//   the box: X -8.6 to 8.6 (the side columns), Y 0 to 28, Z -12.9 (the columns' broken feet) to 8.3 (the arches).
// THE LAW: two fight floors (the landings) and one traversal floor (the alcove's capital), every edge of them open but the
// mouth's and the exit's, no ceiling, no hazard (the drums are the signature - the course), the still drum and two rolling
// drums THE TIMED SOLVER proves, a six-node walk graph that never crosses, Lurkers, the alcove, three lights and the
// collider's proxy (the landings, the capital, the arches' columns).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { refFragMesh, writeRefFragFbx } from './egRefFragScene.mjs';
import { RINGS, r4, hash01, facing, block, cells, lathe, sweep } from './egHeroKit.mjs';
import { ROOT } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';

/** Where the scene is committed. */
export const HERO_COLONNADE_FBX = 'src/assets/egfrags/source/egheroColonnade.fbx';
const SEED = 0xc01a;
/** The passage's half-width and length, the landings' ends (m). */
const HW = 2.5, LEN = 28, NEAR = 4.6, FAR = 23.6;
/** The arches: their columns' radius and middle across (their bases clear of the landings' edges), the spring, the
 *  intrados's and the extrados's radii (the crown 7.65 m up). */
const ARCH = Object.freeze({ r: 0.42, x: 3.05, spring: 4.6, ri: 3.05, ro: 3.85 });
/** Each arch's band along the course: its capitals' abaci (1.26 m square) inside it, never behind the mouth or past the exit. */
const ARCH_Y = Object.freeze([[0.02, 1.28], [LEN - 1.28, LEN - 0.02]]);
/** THE COURSE: `[kind, label, y0, y1, top, amp (cm), ph (ms)]` - the still drum 0.35 m up off the near landing (its gap
 *  2.2 m), the rolling drums level (their gaps 2.6 m and 3.0 m, their travel 1.2 m either way, half a roll apart: at their
 *  nearest they pass 0.6 m apart, and each stays past net/eliteGates/egSpanLaw.js EG_RAIL_CLEAR of the still ground beside it), the far
 *  landing 2.6 m past the second. 3 m wide each. */
const COURSE = Object.freeze([['still', 'a', 6.8, 9.4, 0.35, 0, 0], ['drum', 'b', 12.0, 15.0, 0, 120, 300], ['drum', 'c', 18.0, 21.0, 0, 120, 1500]]);
const PIECE_W = 3.0;
/** The alcove's capital: its middle, its half-size, its top (an optional jump of 2.3 m, 0.4 m up, off the near landing). */
const CAP = Object.freeze({ x: 5.6, y: 2.0, h: 0.8, top: 0.4 });

const R16 = RINGS[16], R24 = RINGS[24];
/** A COLUMN on mesh `m` at (x, y): its shaft from z0 to z1 (radius r, a slight swell), a torus at its foot and, when `cap`,
 *  a gilded capital and abacus over its top - its foot broken off when `broken` (no base) - ashlar drums (pillar). */
function column(m, x, y, r, z0, z1, { cap = true, broken = false, mats = [0, 1] } = {}) {
  const [stone, gold] = mats, h = z1 - z0;
  const prof = broken ? [] : [[r * 1.22, z0], [r * 1.22, z0 + 0.22], [r * 1.08, z0 + 0.32]];
  prof.push([r, z0 + (broken ? 0 : 0.42)], [r * 1.04, z0 + h * 0.35], [r * 0.9, z1]);
  lathe(m, x, y, prof, 16, stone, { top: !cap, foot: broken });
  if (cap) {
    lathe(m, x, y, [[r * 0.9, z1], [r * 1.05, z1 + 0.18], [r * 1.35, z1 + 0.45]], 16, gold, { top: false });
    block(m, x - r * 1.5, y - r * 1.5, z1 + 0.45, x + r * 1.5, y + r * 1.5, z1 + 0.72, stone);
  }
  return m;
}
/** An ARCH on mesh `m` over the course at Y y0..y1: a half-ring of voussoirs springing at `spring` either side of the
 *  course, its intrados radius ri and extrados ro (twelve courses - the kit's 24-ring's first half), every face flat. */
function arch(m, y0, y1, spring, ri, ro, mat, gap = [-1, -1]) {
  const ring = (rr) => R24.slice(0, 13).map(([c, s]) => [rr * c, spring + rr * s]);
  const I = ring(ri), O = ring(ro), uv = (p, n) => (Math.abs(n[1]) > 0.7 ? [p[0] / 2, p[2] / 2] : [p[1] / 2 + p[0] / 2, p[2] / 2]);
  for (let k = 0; k < 12; k++) {
    if (k >= gap[0] && k < gap[1]) continue;
    const [a, b, c, d] = [I[k], I[k + 1], O[k + 1], O[k]];
    facing(m, [[a[0], y0, a[1]], [b[0], y0, b[1]], [c[0], y0, c[1]], [d[0], y0, d[1]]], [0, -1, 0], mat, uv);
    facing(m, [[a[0], y1, a[1]], [b[0], y1, b[1]], [c[0], y1, c[1]], [d[0], y1, d[1]]], [0, 1, 0], mat, uv);
    const mi = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], mo = [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2];
    facing(m, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [-mi[0], 0, spring - mi[1]], mat, uv);
    facing(m, [[d[0], y0, d[1]], [c[0], y0, c[1]], [c[0], y1, c[1]], [d[0], y1, d[1]]], [mo[0], 0, mo[1] - spring], mat, uv);
  }
  for (const k of [0, 12]) facing(m, [[I[k][0], y0, I[k][1]], [O[k][0], y0, O[k][1]], [O[k][0], y1, O[k][1]], [I[k][0], y1, I[k][1]]], [0, 0, -1], mat, uv);
  // a broken arch's two faces at its break, facing into the gap
  for (const [k, sg] of gap[0] >= 0 ? [[gap[0], 1], [gap[1], -1]] : []) facing(m, [[I[k][0], y0, I[k][1]], [O[k][0], y0, O[k][1]], [O[k][0], y1, O[k][1]], [I[k][0], y1, I[k][1]]], [-sg * (I[k][1] - spring), 0, sg * I[k][0]], mat, uv);
  return m;
}
/** A DRUM LYING on mesh `m`: a cylinder of radius r along `axis` (a unit [x, y, z]) about its middle c, `len` long - a
 *  sweep of the kit's 12-ring, smooth round its sides, flat at its ends. */
const lyingDrum = (m, c, axis, len, r, mat) => sweep(m, [[c[0] - (axis[0] * len) / 2, c[1] - (axis[1] * len) / 2, c[2] - (axis[2] * len) / 2], [c[0] + (axis[0] * len) / 2, c[1] + (axis[1] * len) / 2, c[2] + (axis[2] * len) / 2]], R16.map(([a, b]) => [r * a, r * b]), mat);

/**
 * THE COLONNADE HERO'S SCENE: every object, art and marker, in Blender's scene (metres, Z up, the course along +Y).
 * @returns {ReturnType<typeof refFragMesh>[]}
 */
export function heroColonnadeScene() {
  const out = [];
  const add = (m) => { out.push(m); return m; };
  const UP = [0, 0, 1];
  const ashlarUv = (p, n) => (Math.abs(n[2]) > 0.7 ? [p[0] / 2, p[1] / 2] : Math.abs(n[0]) > Math.abs(n[1]) ? [p[1] / 2, p[2] / 2] : [p[0] / 2, p[2] / 2]);
  const lipUv = (top) => (p, n) => [(Math.abs(n[0]) > Math.abs(n[1]) ? p[1] : p[0]) / 2, r4(1 - ((top - p[2]) / 1.3) * 0.5)];
  // ══ THE ART ══════════════════════════════════════════════════════════════════════════════════════════════════════
  // ── THE LANDINGS: two lengths of the entablature, their tops the colonnade's flags, their faces its frieze (ashlar, a gilded
  // course along the top) - each still riding two columns whose feet are broken off in the void
  const land = add(refFragMesh('Entablature', ['floor', 'pillar', 'brass', 'root']));
  for (const [y0, y1] of [[0, NEAR], [FAR, LEN]]) {
    cells(land, [-HW, -1.5, -0.5, 0.5, 1.5, HW], [y0, (y0 + y1) / 2, y1], 0, () => true, 0);
    const T = 1.3, bot = -T;
    for (const [pts, want] of [
      [[[-HW, y0, bot], [HW, y0, bot], [HW, y0, 0], [-HW, y0, 0]], [0, -1, 0]], [[[-HW, y1, bot], [HW, y1, bot], [HW, y1, 0], [-HW, y1, 0]], [0, 1, 0]],
      [[[-HW, y0, bot], [-HW, y1, bot], [-HW, y1, 0], [-HW, y0, 0]], [-1, 0, 0]], [[[HW, y0, bot], [HW, y1, bot], [HW, y1, 0], [HW, y0, 0]], [1, 0, 0]],
    ]) {
      facing(land, pts, want, want[1] !== 0 ? 3 : 1, want[1] !== 0 ? lipUv(0) : ashlarUv);
    }
    facing(land, [[-HW, y0, bot], [HW, y0, bot], [HW, y1, bot], [-HW, y1, bot]], [0, 0, -1], 1, ashlarUv);
    // the gilded course along each side just under the edge line, standing 4 cm proud
    for (const s of [-1, 1]) block(land, s > 0 ? HW : -HW - 0.04, y0 + (y0 === 0 ? 0 : 0.02), -0.32, s > 0 ? HW + 0.04 : -HW, y1 - (y1 === LEN ? 0 : 0.02), -0.12, 2);
    // the two columns it still rides, their feet gone
    for (const s of [-1, 1]) column(land, s * 1.35, (y0 + y1) / 2, 0.55, -9.5 + 2.2 * hash01(SEED, y0, s + 2), bot - 0.72, { broken: true, mats: [1, 2] });
  }
  // ── THE ARCHES at the mouth and the exit: two columns each and a half-ring of voussoirs - the opening the course passes
  const arc = add(refFragMesh('Arches', ['pillar', 'brass']));
  for (const [y0, y1] of ARCH_Y) {
    for (const s of [-1, 1]) column(arc, s * ARCH.x, (y0 + y1) / 2, ARCH.r, 0, ARCH.spring - 0.72, { mats: [0, 1] });
    arch(arc, y0, y1, ARCH.spring, ARCH.ri, ARCH.ro, 0, y0 > 1 ? [4, 7] : [-1, -1]);   // the far arch broken at its west haunch
  }
  // its three fallen voussoirs, tumbling below the exit
  for (const [x, y, z, t] of [[1.9, 25.4, -3.4, 0.5], [3.4, 24.6, -5.9, -0.4], [0.8, 26.6, -8.2, 0.3]]) {
    facing(arc, [[x - 0.5, y - 0.6, z], [x + 0.5, y - 0.6, z + t], [x + 0.5, y + 0.6, z + t], [x - 0.5, y + 0.6, z]], [0, 0, 1], 0);
    block(arc, x - 0.45, y - 0.55, z - 0.75, x + 0.45, y + 0.55, z - 0.02 + Math.min(0, t), 0);
  }
  // ── THE COURSE'S BEDS: under the still drum the drum's own body lying across (the span's slab is its top); under each
  // rolling drum the fallen architrave it rolls along, its whole travel and a little more
  const bed = add(refFragMesh('Fallen_Architraves', ['pillar', 'brass', 'root']));
  for (const [kind, , y0, y1, top, amp] of COURSE) {
    if (kind === 'still') lyingDrum(bed, [0, (y0 + y1) / 2, top - 0.6 - 1.15], [1, 0, 0], PIECE_W - 0.1, 1.15, 0);
    else {
      const a = amp / 100 + 0.25;
      block(bed, -1.15, y0 - a, top - 1.55, 1.15, y1 + a, top - 0.72, 0, ashlarUv);
      block(bed, -1.25, y0 - a, top - 0.86, 1.25, y1 + a, top - 0.72, 1, ashlarUv, ['-z']);   // its gilded fillet, the drum's track
    }
  }
  // ── THE COLONNADE STANDING IN THE VOID either side: columns rising from broken feet to broken tops or gilded capitals, a
  // lintel still bridging two, one fallen across under the course, loose drums adrift
  const side = add(refFragMesh('Colonnade', ['pillar', 'brass', 'root']));
  const STAND = [[-5.4, 6.0, -11.5, 1.2, 1], [-6.2, 11.6, -12.6, 3.4, 1], [-5.6, 17.2, -10.8, -1.6, 0], [-6.0, 22.4, -11.9, 2.6, 1], [5.8, 9.0, -12.2, 2.9, 1], [6.3, 14.4, -10.6, -0.8, 0], [5.6, 19.8, -11.4, 3.3, 1], [6.6, 25.2, -12.4, 0.6, 0]];
  for (const [x, y, z0, z1, capped] of STAND) column(side, x, y, 0.55, z0, z1, { cap: !!capped, broken: true, mats: [0, 1] });
  // the lintel still bridging the two west columns at 11.6 and 17.2 (the second broken short - the lintel rests on the first
  // and juts past the break, cracked)
  block(side, -6.9, 10.6, 4.12, -5.5, 15.4, 4.82, 0, ashlarUv);
  block(side, -6.95, 10.6, 4.82, -5.45, 15.4, 4.95, 1, ashlarUv, ['-z']);
  block(side, 4.9, 8.0, 3.62, 6.7, 10.4, 4.28, 0, ashlarUv);
  // one column fallen right across the void under the course, resting at a slant
  sweep(side, [[-7.4, 8.4, -6.8], [-2.5, 12.3, -5.4], [2.5, 16.2, -4.3], [7.8, 20.4, -3.5]], R16.map(([a, b]) => [0.6 * a, 0.6 * b]), 0);
  // the outer rank, further out in the void and lower - the colonnade's second row - one pair still carrying its lintel, a
  // lintel slipped off another to hang at a slant
  const OUTER = [[-9.8, 3.4, -13.0, -2.2, 1], [-10.4, 9.8, -12.4, 0.4, 1], [-10.1, 15.6, -12.9, -3.4, 0], [-9.6, 21.0, -12.2, 0.9, 1], [-10.2, 26.2, -13.1, -1.4, 1], [9.9, 4.8, -12.6, -0.9, 1], [10.3, 11.0, -13.0, 1.5, 1], [9.7, 17.6, -12.5, 1.6, 1], [10.4, 23.4, -12.8, -2.6, 0]];
  for (const [x, y, z0, z1, capped] of OUTER) column(side, x, y, 0.5, z0, z1, { cap: !!capped, broken: true, mats: [0, 1] });
  block(side, 9.0, 10.0, 2.2, 11.0, 18.4, 2.85, 0, ashlarUv);
  block(side, 8.95, 10.0, 2.85, 11.05, 18.4, 2.97, 1, ashlarUv, ['-z']);
  facing(side, [[-9.0, 9.4, 1.1], [-11.2, 9.4, 1.1], [-11.2, 14.6, -2.9], [-9.0, 14.6, -2.9]], [0, -0.6, -0.8], 0, ashlarUv);
  facing(side, [[-9.0, 9.4, 1.75], [-11.2, 9.4, 1.75], [-11.2, 14.6, -2.25], [-9.0, 14.6, -2.25]], [0, 0.6, 0.8], 0, ashlarUv);
  for (const [xa, xb] of [[-9.0, -9.0], [-11.2, -11.2]]) facing(side, [[xa, 9.4, 1.1], [xa, 9.4, 1.75], [xb, 14.6, -2.25], [xb, 14.6, -2.9]], [xa > -10 ? 1 : -1, 0, 0], 0, ashlarUv);
  for (const y of [9.4, 14.6]) { const z = y < 10 ? 1.1 : -2.9; facing(side, [[-9.0, y, z], [-11.2, y, z], [-11.2, y, z + 0.65], [-9.0, y, z + 0.65]], [0, y < 10 ? -1 : 1, 0], 0, ashlarUv); }
  // the loose drums adrift below and beside
  for (let q = 0; q < 7; q++) {
    const x = (q % 2 ? 1 : -1) * (3.6 + 3.2 * hash01(SEED + 1, q)), y = 2 + 24 * hash01(SEED + 2, q), z = -3 - 7 * hash01(SEED + 3, q);
    const ax = [hash01(SEED + 4, q) - 0.5, hash01(SEED + 5, q) - 0.5, 0.6 * (hash01(SEED + 6, q) - 0.5)], l = Math.sqrt(ax[0] * ax[0] + ax[1] * ax[1] + ax[2] * ax[2]);
    lyingDrum(side, [x, y, z], ax.map((v) => v / l), 1.1 + 0.6 * hash01(SEED + 7, q), 0.55 + 0.2 * hash01(SEED + 8, q), 0);
  }
  // ── THE ALCOVE'S CAPITAL: a column standing clear of the near landing's east side, its gilded capital's abacus the alcove's
  // floor (lumen) - an optional hard jump
  const alc = add(refFragMesh('Alcove_Capital', ['pillar', 'brass', 'floor']));
  column(alc, CAP.x, CAP.y, 0.5, -10.4, CAP.top - 0.72 - 0.3, { cap: false, broken: true, mats: [0, 1] });
  lathe(alc, CAP.x, CAP.y, [[0.45, CAP.top - 1.05], [0.6, CAP.top - 0.8], [0.95, CAP.top - 0.42]], 12, 1, { top: false });
  block(alc, CAP.x - CAP.h, CAP.y - CAP.h, CAP.top - 0.42, CAP.x + CAP.h, CAP.y + CAP.h, CAP.top, 0, ashlarUv, ['+z']);
  cells(alc, [CAP.x - CAP.h, CAP.x + CAP.h], [CAP.y - CAP.h, CAP.y + CAP.h], CAP.top, () => true, 2);
  // ── THE EDGE LINE (section 25.3) on every rim: both landings' sides and inner lips, and the capital all round
  const edge = add(refFragMesh('Edge_Lines', ['edge']));
  const E = 0.012, W = 0.12;
  for (const [y0, y1] of [[0, NEAR], [FAR, LEN]]) {
    cells(edge, [-HW, -HW + W], [y0, y1], E);
    cells(edge, [HW - W, HW], [y0, y1], E);
    cells(edge, [-HW + W, HW - W], y0 === 0 ? [NEAR - W, NEAR] : [FAR, FAR + W], E);
  }
  const c0 = CAP.x - CAP.h, c1 = CAP.x + CAP.h, d0 = CAP.y - CAP.h, d1 = CAP.y + CAP.h;
  cells(edge, [c0, c0 + W, c1 - W, c1], [d0, d0 + W, d1 - W, d1], CAP.top + E, (x0, y0, x1, y1) => !(x0 > c0 + 0.01 && x1 < c1 - 0.01 && y0 > d0 + 0.01 && y1 < d1 - 0.01));

  // ══ THE LAW, as named markers ═══════════════════════════════════════════════════════════════════════════════════════
  add(refFragMesh('socket.in')).across(-HW, HW, 0, 0, ARCH.spring);
  add(refFragMesh('socket.out.main')).across(-HW, HW, LEN, 0, ARCH.spring, 0, true);
  add(refFragMesh('floor.fight.near')).level(-HW, 0, HW, NEAR, 0);
  add(refFragMesh('floor.fight.far')).level(-HW, FAR, HW, LEN, 0);
  add(refFragMesh('floor.capital')).level(c0, d0, c1, d1, CAP.top);
  // every edge open but none - the landings' sides, lips, the mouth and the exit, the capital's four (it stands alone)
  add(refFragMesh('open.near')).box(-HW - 0.05, 0, -0.05, HW + 0.05, NEAR + 0.05, 0.05);
  add(refFragMesh('open.far')).box(-HW - 0.05, FAR - 0.05, -0.05, HW + 0.05, LEN, 0.05);
  add(refFragMesh('open.capital')).box(c0 - 0.05, d0 - 0.05, CAP.top - 0.05, c1 + 0.05, d1 + 0.05, CAP.top + 0.05);
  const N = { na: [-1.3, 1.2], nb: [1.3, 1.2], nc: [0, 3.7], fa: [0, 24.1], fb: [-1.3, 26.8], fc: [1.3, 26.8] };
  for (const [k, [x, y]] of Object.entries(N)) add(refFragMesh(`node.${k}`)).disc(x, y, 0, 0.5);
  for (const [a, b] of [['na', 'nb'], ['na', 'nc'], ['nb', 'nc'], ['fa', 'fb'], ['fa', 'fc'], ['fb', 'fc']]) add(refFragMesh(`edge.${a}${b}`)).strip([...N[a], 0], [...N[b], 0], 0.2);
  const cube = (name, x, y, z, s = 0.3) => add(refFragMesh(name)).box(x - s / 2, y - s / 2, z, x + s / 2, y + s / 2, z + s);
  cube('anchor.lurker.near', -1.9, 3.9, 0);
  cube('anchor.lurker.far', 1.9, 24.0, 0);
  cube('anchor.caster.far', 0, 27.3, 0);
  // the course: the still drum, the two rolling drums (their travel their name's - they roll at the law's 2.0 m/s)
  for (const [kind, label, y0, y1, top, amp, ph] of COURSE) add(refFragMesh(`course.${kind}.${label}${amp ? `.amp${amp}` : ''}${ph ? `.ph${ph}` : ''}`)).box(-PIECE_W / 2, y0, top - 0.6, PIECE_W / 2, y1, top);
  add(refFragMesh('alcove.jump.lumen.capital')).box(c0, d0, CAP.top, c1, d1, CAP.top + 0.3);
  cube('light.band.near', 0, 2.3, 3.6, 0.2);
  cube('light.band.mid', 0, 14.3, 6.4, 0.2);
  cube('light.band.far', 0, 25.6, 3.6, 0.2);
  // THE COLLIDER'S PROXY: the landings' and the capital's tops and sides, the arches' columns as boxes
  const px = add(refFragMesh('collider.proxy'));
  for (const [y0, y1] of [[0, NEAR], [FAR, LEN]]) px.box(-HW, y0, -1.3, HW, y1, 0);
  px.box(c0, d0, CAP.top - 0.42, c1, d1, CAP.top);
  for (const [y0, y1] of ARCH_Y) for (const s of [-1, 1]) px.box(s * ARCH.x - ARCH.r, (y0 + y1) / 2 - ARCH.r, 0, s * ARCH.x + ARCH.r, (y0 + y1) / 2 + ARCH.r, ARCH.spring);
  return out;
}

/** THE FILE: the scene written as the reference is (tools/egRefFragScene.mjs writeRefFragFbx). */
export const writeHeroColonnadeFbx = (scene = heroColonnadeScene()) => writeRefFragFbx(scene);

if (isMain(import.meta.url)) {
  const outPath = resolve(process.argv.slice(2).find((a) => a.startsWith('--out='))?.slice(6) ?? resolve(ROOT, HERO_COLONNADE_FBX));
  const bytes = writeHeroColonnadeFbx();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  console.log(`${outPath}: ${heroColonnadeScene().length} objects, ${bytes.length} bytes`);
}
