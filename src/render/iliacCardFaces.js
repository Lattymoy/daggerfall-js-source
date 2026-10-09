// @ts-check
// CARDS8 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md sections 6.2 and 9): THE FACES OF ILIAC HAND. Mac answered
// section 9's fifth question for the collectible cards: "Painted in code" - the way the Hold'em deck is (section 21).
// So every Iliac Hand card is drawn here, on a canvas, from paths: the frame in its tier's colour, the frame's window
// in its kind's shape, the emblem large in the window, the cost in a magicka gem, the power in a shield, the name in a
// banner, the rules beneath.
//
//   kind     | window                    | cost gem | power shield | ground
//   unit     | square                    | yes      | yes          | earth
//   spell    | rounded                   | yes      | no           | arcane blue
//   prince   | pointed arch              | yes      | yes          | Oblivion's purple, the emblem in gold
//   location | wide landscape, name atop | no       | no           | the Bay's green
//
// DECIDED (section 6.2): rarity is the loot's. The frame is RARITIES[tier].colour (systems/lootRarity.js) - imported,
// never copied - and the higher the tier the heavier the frame: studs from rare, a double rule from legendary, and an
// inner glow line for the aetheric and the artifact.
//
// THE ART IS OURS (Port-Doctrine, A RENDER OF GAME DATA IS GAME DATA): every emblem is an original glyph traced from
// moveTo/lineTo/quadraticCurveTo/arc and filled or stroked - no ARENA2 pixel, no sprite's silhouette, no font glyph for
// a picture. The card stock is the house deck's own (cardFaces.js STOCK): one tavern, one card stock.
//
// THE TABLES ARE PURE (EMBLEM_PAINTERS' keys, KIND_ART, TIER_FRAMES, iliacLayout, wrapCardText): pinned by
// test/cards8_faces.test.js against a recording context; only the painting needs a page.
//
// SCALE: every measure is in u = h / 100, so one painter serves the Collections grid's 78 x 112 tile (CSS px, at a
// devicePixelRatio of 1 or 2), the large view of a pressed card (about 260 x 371) and a 350 x 500 card held up to read.
// AUDIT CARDS-5 (lane B) made two faces of that one painter:
//   TILE MODE (h <= ILIAC_TILE_MAX_H): the rules and the flavor are 4-6 px there - decoration, not words - so a tile
//   paints neither, nor their box. Their room goes to the picture and the name: the window fills the card above the
//   banner, the emblem grows with it, the name is at least 7.2u (8 CSS px on the 112 tile) on up to two lines, the gem
//   and the shield sit over the window's corners (the gem top-left, the shield bottom-right) a size larger.
//   THE FULL FACE: the rules shrink to fit their box; the shield stands in the box's bottom-right corner, inside the
//   panel and clear of its rounded corner, and only the lines that pass beside it are narrowed; the flavor shrinks
//   before it is dropped, and it is dropped only when the rules at their least would not leave it room.
// THE FRAME READS AT EVERY TIER: a dark keyline runs between every rim and the panel (the common's and the aetheric's
// pale rims are 1.1:1 against the stock without one), and the digits sit wholly on the gem's dark facets.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { RARITIES } from '../systems/lootRarity.js';
import { STOCK } from './cardFaces.js';

/** The card's shape, width over height: the house deck's poker proportion, a little narrower. */
export const ILIAC_CARD_ASPECT = 0.7;

/** MEASURE (CARDS8): the inks the faces share. */
export const COST_GEM = '#2456c8';        // the magicka gem - blue, as the game's magicka bar is
const COST_GEM_LIGHT = '#7da6f2';
export const POWER_SHIELD = '#8e2a1c';    // the power shield - a war-red heater
const FRAME_DARK = '#2a2118';
const GOLD = '#c9a24a';
const GOLD_DARK = '#8a6a24';
const TEXT_INK = '#2a2018';
const FLAVOR_INK = '#6a5a40';
const TEXT_BOX = '#fbf6e6';
const GLOW_CORE = '#ffffff';
const BACK_FIELD = '#16384a';             // the Bay's deep water, not the house deck's crimson

/** The inks the faces write and paint in, by part: what the pins hold each word and each mark to. */
export const ILIAC_INKS = Object.freeze({
  text: TEXT_INK, flavor: FLAVOR_INK, box: TEXT_BOX, digit: GLOW_CORE, gemLight: COST_GEM_LIGHT, frame: FRAME_DARK,
  gold: GOLD, goldDark: GOLD_DARK, back: BACK_FIELD,
});

const TAU = Math.PI * 2;

/**
 * The art window by kind: its shape, its ground and the ink its emblem is drawn in (a prince's gold on the dark of
 * Oblivion; the others a dark ink on a light ground).
 */
export const KIND_ART = Object.freeze({
  unit: Object.freeze({ window: 'square', ground: '#d6c79f', ink: '#3b2a18', cost: true, power: true }),
  spell: Object.freeze({ window: 'rounded', ground: '#c6d4ea', ink: '#1f2d58', cost: true, power: false }),
  prince: Object.freeze({ window: 'arch', ground: '#3a1d42', ink: '#e6c66a', cost: true, power: true }),
  location: Object.freeze({ window: 'landscape', ground: '#bccfa6', ink: '#2c3a22', cost: false, power: false }),
});

/**
 * The frame by tier, in RARITY_ORDER: `band` the coloured rim's width in u, `studs` the diamonds set in it (corners,
 * then mid-sides), `double` a second rule inside the rim, `glow` the inner glow line of the two tiers past legendary.
 */
export const TIER_FRAMES = Object.freeze({
  common: Object.freeze({ band: 1.4, studs: 0, double: false, glow: false }),
  magic: Object.freeze({ band: 1.8, studs: 0, double: false, glow: false }),
  rare: Object.freeze({ band: 2.2, studs: 4, double: false, glow: false }),
  legendary: Object.freeze({ band: 2.6, studs: 8, double: true, glow: false }),
  aetheric: Object.freeze({ band: 2.8, studs: 8, double: true, glow: true }),
  artifact: Object.freeze({ band: 3.0, studs: 8, double: true, glow: true }),
  gilded: Object.freeze({ band: 3.2, studs: 8, double: true, glow: true }),   // GILDED1's rung (merged under the arc): the widest band, every stud, gold leaf over everything
});

// ---- the emblems -------------------------------------------------------------------------------------------------
// Each glyph is traced in a box one unit across about the origin (-0.5..0.5, y down). A detail cut out of a glyph (an
// eye socket, a window) is a sub-path filled 'evenodd', so the ground shows through it; parts that overlap are filled
// one at a time, so neither cuts the other.

/** A whole circle as its own sub-path. */
function circ(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }

/** A closed polygon as its own sub-path. */
function poly(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** A polygon mirrored about x = 0 from its right half, traced top-centre to bottom-centre. */
function mirror(ctx, half) { poly(ctx, [...half, ...half.slice().reverse().map(([x, y]) => [-x, y])]); }

/** The same points with x negated. */
const flipX = (pts) => pts.map(([x, y]) => [-x, y]);

/** The end of a half-outline's step: [x, y] for a line, [cx, cy, x, y] for a curve. */
const stepEnd = (st) => (st.length === 4 ? [st[2], st[3]] : [st[0], st[1]]);

/**
 * A shape mirrored about x = 0 from its right half - lines and curves - traced top-centre to bottom-centre: each step
 * [x, y] a line to there, [cx, cy, x, y] a curve; the left half is the same steps walked back with x negated.
 */
function mirrorQ(ctx, half) {
  const [x0, y0] = stepEnd(half[0]);
  ctx.moveTo(x0, y0);
  for (const st of half.slice(1)) { if (st.length === 4) ctx.quadraticCurveTo(st[0], st[1], st[2], st[3]); else ctx.lineTo(st[0], st[1]); }
  for (let i = half.length - 1; i >= 1; i--) {
    const st = half[i], [x, y] = stepEnd(half[i - 1]);
    if (st.length === 4) ctx.quadraticCurveTo(-st[0], st[1], -x, y); else ctx.lineTo(-x, y);
  }
  ctx.closePath();
}

/** An oval as its own sub-path (a scaled arc - the transform is taken when the point is added). */
function oval(ctx, x, y, rx, ry) {
  ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry); ctx.moveTo(1, 0); ctx.arc(0, 0, 1, 0, TAU); ctx.restore();
}

/** An n-pointed star's points about (x, y). */
function starPts(x, y, r, inner, n = 5) {
  const pts = [];
  for (let k = 0; k < n * 2; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / n, rr = k % 2 ? r * inner : r;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  return pts;
}

/** Fill what has been traced, then start a fresh path: the parts of a glyph that overlap are filled one by one. */
function part(ctx, rule = 'nonzero') { ctx.fill(rule); ctx.beginPath(); }

/** Stroke what has been traced, then start a fresh path. */
function line(ctx, width = 0.07) { ctx.lineWidth = width; ctx.stroke(); ctx.beginPath(); }

/** The skull's outline with its sockets, nose and teeth cut: undead's whole glyph and the lich's under its crown. */
function skull(ctx) {
  ctx.moveTo(-0.18, 0.42); ctx.lineTo(-0.18, 0.28); ctx.lineTo(-0.28, 0.22);
  ctx.quadraticCurveTo(-0.36, 0.14, -0.36, -0.1);
  ctx.arc(0, -0.1, 0.36, Math.PI, TAU);
  ctx.quadraticCurveTo(0.36, 0.14, 0.28, 0.22); ctx.lineTo(0.18, 0.28); ctx.lineTo(0.18, 0.42); ctx.closePath();
  circ(ctx, -0.14, -0.04, 0.1); circ(ctx, 0.14, -0.04, 0.1);                                 // the sockets
  poly(ctx, [[0, 0.08], [0.05, 0.17], [-0.05, 0.17]]);                                       // the nose
  for (const x of [-0.06, 0.06]) poly(ctx, [[x - 0.015, 0.3], [x + 0.015, 0.3], [x + 0.015, 0.39], [x - 0.015, 0.39]]);   // the teeth's gaps
  part(ctx, 'evenodd');
}

/** A crescent: circle 1 less circle 2, traced as one outline (the outer arc away from circle 2, the inner one back). */
function crescent(ctx, x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = x1 + (a * dx) / d, my = y1 + (a * dy) / d;
  const pA = [mx + (h * dy) / d, my - (h * dx) / d], pB = [mx - (h * dy) / d, my + (h * dx) / d];
  ctx.moveTo(pA[0], pA[1]);
  ctx.arc(x1, y1, r1, Math.atan2(pA[1] - y1, pA[0] - x1), Math.atan2(pB[1] - y1, pB[0] - x1), true);
  ctx.arc(x2, y2, r2, Math.atan2(pB[1] - y2, pB[0] - x2), Math.atan2(pA[1] - y2, pA[0] - x2), false);
  ctx.closePath();
}

/** A sword upright about the origin, its point up: the warrior's crossed pair. */
function sword(ctx) {
  poly(ctx, [[0, -0.5], [0.045, -0.42], [0.045, 0.2], [-0.045, 0.2], [-0.045, -0.42]]);    // the blade
  poly(ctx, [[-0.16, 0.2], [0.16, 0.2], [0.16, 0.26], [-0.16, 0.26]]);                       // the guard
  poly(ctx, [[-0.03, 0.26], [0.03, 0.26], [0.03, 0.4], [-0.03, 0.4]]);                       // the grip
  circ(ctx, 0, 0.455, 0.05);                                                                  // the pommel
}

/** A sine row of water, stroked across the box at `y`. */
function waveRow(ctx, y, amp) {
  ctx.moveTo(-0.46, y);
  for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(-0.46 + 0.23 * i + 0.115, y + (i % 2 ? amp : -amp), -0.46 + 0.23 * (i + 1), y);
}

/** A tower or wall with crenels along its top: x0..x1, its merlons' tops at yt, the crenels `notch` deep, base yb. */
function crenellated(ctx, x0, x1, yt, yb, n, notch) {
  ctx.moveTo(x0, yb); ctx.lineTo(x0, yt);
  const step = (x1 - x0) / (2 * n - 1);
  for (let k = 0; k < 2 * n - 1; k++) {
    const y = k % 2 ? yt + notch : yt;
    ctx.lineTo(x0 + k * step, y); ctx.lineTo(x0 + (k + 1) * step, y);
  }
  ctx.lineTo(x1, yb); ctx.closePath();
}

/** Each emblem's tracing in the unit box; the ink is set before it is called. */
const GLYPHS = {
  beast(ctx) {        // a paw print: the pad and four toes
    ctx.moveTo(0, -0.02);
    ctx.quadraticCurveTo(0.3, 0.02, 0.3, 0.28); ctx.quadraticCurveTo(0.3, 0.44, 0.12, 0.42);
    ctx.quadraticCurveTo(0, 0.38, -0.12, 0.42); ctx.quadraticCurveTo(-0.3, 0.44, -0.3, 0.28);
    ctx.quadraticCurveTo(-0.3, 0.02, 0, -0.02); ctx.closePath();
    oval(ctx, -0.36, -0.12, 0.1, 0.13); oval(ctx, -0.13, -0.32, 0.1, 0.14);
    oval(ctx, 0.13, -0.32, 0.1, 0.14); oval(ctx, 0.36, -0.12, 0.1, 0.13);
    part(ctx);
  },
  undead(ctx) { skull(ctx); },                                                     // a skull
  ghost(ctx) {        // a shade: a domed sheet with a ragged hem, two eyes and a mouth
    ctx.moveTo(-0.32, 0.38); ctx.lineTo(-0.32, -0.08); ctx.arc(0, -0.08, 0.32, Math.PI, TAU); ctx.lineTo(0.32, 0.38);
    for (let i = 0; i < 4; i++) { const x0 = 0.32 - 0.16 * i; ctx.quadraticCurveTo(x0 - 0.08, i % 2 ? 0.28 : 0.5, x0 - 0.16, 0.38); }
    ctx.closePath();
    oval(ctx, -0.12, -0.1, 0.06, 0.09); oval(ctx, 0.12, -0.1, 0.06, 0.09); oval(ctx, 0, 0.1, 0.07, 0.1);
    part(ctx, 'evenodd');
  },
  vampire(ctx) {      // the fang-drop: an upper lip, two long fangs and a drop of blood beneath one
    ctx.moveTo(-0.42, -0.34); ctx.quadraticCurveTo(0, -0.1, 0.42, -0.34); ctx.lineTo(0.4, -0.22);
    ctx.quadraticCurveTo(0, 0.04, -0.4, -0.22); ctx.closePath(); part(ctx);
    for (const m of [1, -1]) {
      ctx.moveTo(0.13 * m, -0.15); ctx.lineTo(0.27 * m, -0.15); ctx.quadraticCurveTo(0.24 * m, 0.05, 0.19 * m, 0.2);
      ctx.quadraticCurveTo(0.16 * m, 0.02, 0.13 * m, -0.15); ctx.closePath(); part(ctx);
    }
    ctx.moveTo(0.19, 0.26); ctx.quadraticCurveTo(0.27, 0.36, 0.27, 0.4); ctx.arc(0.19, 0.4, 0.08, 0, Math.PI);
    ctx.quadraticCurveTo(0.11, 0.36, 0.19, 0.26); ctx.closePath(); part(ctx);
  },
  lich(ctx) {         // a crowned skull
    ctx.save(); ctx.translate(0, 0.1); ctx.scale(0.78, 0.78); skull(ctx); ctx.restore();
    poly(ctx, [[-0.26, -0.22], [-0.26, -0.44], [-0.13, -0.32], [0, -0.5], [0.13, -0.32], [0.26, -0.44], [0.26, -0.22]]);
    part(ctx);
  },
  were(ctx) {         // a wolf's head, full face: the ears pricked, the eyes slanted, the nose cut
    mirror(ctx, [[0, -0.2], [0.13, -0.24], [0.34, -0.48], [0.4, -0.14], [0.38, 0.04], [0.24, 0.2], [0.12, 0.42], [0, 0.46]]);
    poly(ctx, [[0.2, -0.06], [0.07, -0.02], [0.17, 0.02]]); poly(ctx, flipX([[0.2, -0.06], [0.07, -0.02], [0.17, 0.02]]));
    poly(ctx, [[0.22, -0.24], [0.33, -0.38], [0.35, -0.2]]); poly(ctx, flipX([[0.22, -0.24], [0.33, -0.38], [0.35, -0.2]]));
    poly(ctx, [[-0.06, 0.33], [0.06, 0.33], [0, 0.4]]);
    part(ctx, 'evenodd');
  },
  orc(ctx) {          // tusks: a heavy under-jaw with two tusks thrust up out of it
    ctx.moveTo(-0.4, -0.05); ctx.quadraticCurveTo(-0.38, 0.42, 0, 0.44); ctx.quadraticCurveTo(0.38, 0.42, 0.4, -0.05);
    ctx.lineTo(0.28, -0.05); ctx.quadraticCurveTo(0.26, 0.28, 0, 0.3); ctx.quadraticCurveTo(-0.26, 0.28, -0.28, -0.05);
    ctx.closePath(); part(ctx);
    for (const m of [1, -1]) {
      ctx.moveTo(0.08 * m, 0.27); ctx.quadraticCurveTo(0.2 * m, -0.05, 0.3 * m, -0.46);
      ctx.quadraticCurveTo(0.3 * m, -0.05, 0.24 * m, 0.24); ctx.closePath(); part(ctx);
    }
    for (const x of [-0.12, -0.04, 0.04, 0.12]) poly(ctx, [[x - 0.035, 0.3], [x + 0.035, 0.3], [x, 0.2]]);   // the under-teeth
    part(ctx);
  },
  giant(ctx) {        // a great knotted club, slanted, its head studded
    ctx.save(); ctx.rotate(Math.PI / 6);
    ctx.moveTo(-0.05, 0.46); ctx.lineTo(0.05, 0.46); ctx.quadraticCurveTo(0.08, 0.1, 0.16, -0.2);
    ctx.quadraticCurveTo(0.22, -0.46, 0, -0.48); ctx.quadraticCurveTo(-0.22, -0.46, -0.16, -0.2);
    ctx.quadraticCurveTo(-0.08, 0.1, -0.05, 0.46); ctx.closePath();
    ctx.restore(); part(ctx);
    ctx.save(); ctx.rotate(Math.PI / 6);
    for (const [x, y, m] of [[0.17, -0.3, 1], [-0.17, -0.3, -1], [0.12, -0.08, 1], [-0.12, -0.08, -1]]) {
      poly(ctx, [[x, y - 0.05], [x + 0.11 * m, y], [x, y + 0.05]]);
    }
    poly(ctx, [[-0.05, -0.46], [0, -0.56], [0.05, -0.46]]);
    ctx.restore(); part(ctx);
  },
  centaur(ctx) {      // a horseshoe pierced by an arrow
    ctx.moveTo(-0.34, 0.36); ctx.lineTo(-0.36, -0.02); ctx.arc(0, -0.02, 0.36, Math.PI, TAU); ctx.lineTo(0.34, 0.36);
    ctx.lineTo(0.2, 0.36); ctx.lineTo(0.21, -0.02); ctx.arc(0, -0.02, 0.21, 0, Math.PI, true); ctx.lineTo(-0.2, 0.36);
    ctx.closePath();
    for (const a of [Math.PI + 0.45, Math.PI + 1.1, TAU - 1.1, TAU - 0.45]) circ(ctx, Math.cos(a) * 0.285, -0.02 + Math.sin(a) * 0.285, 0.035);
    circ(ctx, -0.275, 0.18, 0.035); circ(ctx, 0.275, 0.18, 0.035);
    part(ctx, 'evenodd');
    ctx.moveTo(-0.42, 0.42); ctx.lineTo(0.34, -0.34);
    for (const t of [0, 0.07]) { ctx.moveTo(-0.42 + t, 0.42 - t); ctx.lineTo(-0.44 + t, 0.3 - t); ctx.moveTo(-0.42 + t, 0.42 - t); ctx.lineTo(-0.3 + t, 0.44 - t); }
    line(ctx, 0.05);
    poly(ctx, [[0.45, -0.45], [0.27, -0.4], [0.4, -0.27]]); part(ctx);
  },
  harpy(ctx) {        // a harpy, full face: a hag's head in wild locks, her wings raised in ragged primaries, taloned feet
    const wing = [[0.06, -0.08], [0.14, -0.26], [0.28, -0.42], [0.48, -0.5], [0.42, -0.38], [0.5, -0.34], [0.42, -0.26],
      [0.49, -0.2], [0.38, -0.14], [0.43, -0.06], [0.3, -0.04], [0.18, 0.06], [0.08, 0.12]];
    poly(ctx, wing); part(ctx); poly(ctx, flipX(wing)); part(ctx);
    oval(ctx, 0, 0.08, 0.1, 0.2); part(ctx);                                                // the body
    circ(ctx, 0, -0.22, 0.09);                                                               // the head
    for (const m of [1, -1]) poly(ctx, [[0.05 * m, -0.29], [0.17 * m, -0.33], [0.1 * m, -0.24], [0.18 * m, -0.18], [0.07 * m, -0.17]]);
    part(ctx);
    for (const m of [1, -1]) {
      ctx.moveTo(0.04 * m, 0.24); ctx.lineTo(0.09 * m, 0.38);
      ctx.moveTo(0.09 * m, 0.38); ctx.lineTo(0.03 * m, 0.47);
      ctx.moveTo(0.09 * m, 0.38); ctx.lineTo(0.1 * m, 0.48);
      ctx.moveTo(0.09 * m, 0.38); ctx.lineTo(0.17 * m, 0.45);
    }
    line(ctx, 0.045);
  },
  nymph(ctx) {        // a water-lily: three petals over the pad
    ctx.moveTo(0, 0.2); ctx.quadraticCurveTo(0.18, -0.1, 0, -0.46); ctx.quadraticCurveTo(-0.18, -0.1, 0, 0.2); part(ctx);
    for (const m of [1, -1]) {
      ctx.moveTo(-0.02 * m, 0.22); ctx.quadraticCurveTo(-0.36 * m, 0.12, -0.42 * m, -0.22);
      ctx.quadraticCurveTo(-0.14 * m, -0.12, -0.02 * m, 0.22); part(ctx);
    }
    ctx.moveTo(-0.44, 0.3); ctx.quadraticCurveTo(0, 0.5, 0.44, 0.3); ctx.quadraticCurveTo(0, 0.4, -0.44, 0.3); part(ctx);
  },
  dreugh(ctx) {       // a crab's pincer: the palm, the fixed finger and the moving one closing on it, the arm
    oval(ctx, -0.1, 0.1, 0.26, 0.22); part(ctx);
    ctx.moveTo(-0.02, -0.08); ctx.quadraticCurveTo(0.3, -0.42, 0.47, -0.06); ctx.quadraticCurveTo(0.28, -0.2, 0.1, 0.02);
    ctx.closePath(); part(ctx);
    ctx.moveTo(0.06, 0.26); ctx.quadraticCurveTo(0.42, 0.28, 0.44, 0.02); ctx.quadraticCurveTo(0.3, 0.14, 0.1, 0.1);
    ctx.closePath(); part(ctx);
    for (const [x, y] of [[0.22, -0.13], [0.32, -0.12]]) poly(ctx, [[x - 0.03, y], [x + 0.03, y - 0.01], [x + 0.01, y + 0.06]]);
    for (const [x, y] of [[0.24, 0.13], [0.34, 0.1]]) poly(ctx, [[x - 0.03, y], [x + 0.03, y + 0.01], [x + 0.01, y - 0.06]]);
    part(ctx);
    ctx.moveTo(-0.26, 0.24); ctx.lineTo(-0.44, 0.44); line(ctx, 0.14);
  },
  daedra(ctx) {       // a horned mask: the face with slit eyes and a fanged mouth cut, two horns swept up
    mirror(ctx, [[0, -0.12], [0.2, -0.14], [0.26, 0.0], [0.22, 0.22], [0.1, 0.4], [0, 0.44]]);
    poly(ctx, [[0.05, -0.02], [0.19, -0.06], [0.15, 0.04]]); poly(ctx, flipX([[0.05, -0.02], [0.19, -0.06], [0.15, 0.04]]));
    poly(ctx, [[-0.1, 0.2], [0.1, 0.2], [0, 0.3]]);
    part(ctx, 'evenodd');
    for (const m of [1, -1]) {
      ctx.moveTo(0.12 * m, -0.13); ctx.quadraticCurveTo(0.34 * m, -0.2, 0.34 * m, -0.48);
      ctx.quadraticCurveTo(0.52 * m, -0.12, 0.25 * m, 0.0); ctx.closePath(); part(ctx);
    }
  },
  atronach(ctx) {     // an elemental's heart: a cut crystal in a ring, four motes on the ring, four rays out
    circ(ctx, 0, 0, 0.36); line(ctx, 0.06);
    poly(ctx, [[0, -0.24], [0.15, 0], [0, 0.24], [-0.15, 0]]); poly(ctx, [[0, -0.1], [0.06, 0], [0, 0.1], [-0.06, 0]]);
    part(ctx, 'evenodd');
    for (const [x, y] of [[0, -0.36], [0.36, 0], [0, 0.36], [-0.36, 0]]) circ(ctx, x, y, 0.06);
    part(ctx);
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; ctx.moveTo(Math.cos(a) * 0.28, Math.sin(a) * 0.28); ctx.lineTo(Math.cos(a) * 0.48, Math.sin(a) * 0.48); }
    line(ctx, 0.05);
  },
  dragon(ctx) {       // a dragon's head in profile: the swept horn, the open jaws, the eye cut, spines down the neck
    poly(ctx, [[-0.32, -0.08], [-0.48, -0.44], [-0.16, -0.22], [0.06, -0.2], [0.44, -0.08], [0.48, 0.0], [0.2, 0.04], [0.02, 0.08],
      [0.36, 0.16], [0.38, 0.22], [0.04, 0.26], [-0.08, 0.48], [-0.4, 0.46], [-0.36, 0.1]]);
    poly(ctx, [[-0.04, -0.13], [0.08, -0.13], [0.0, -0.07]]);
    circ(ctx, 0.4, -0.04, 0.02);
    part(ctx, 'evenodd');
    poly(ctx, [[-0.385, 0.4], [-0.49, 0.34], [-0.383, 0.3]]); poly(ctx, [[-0.375, 0.26], [-0.48, 0.2], [-0.371, 0.16]]);
    poly(ctx, [[0.14, 0.04], [0.19, 0.035], [0.165, 0.1]]); poly(ctx, [[0.3, 0.018], [0.35, 0.012], [0.325, 0.07]]);
    part(ctx);
  },
  knight(ctx) {       // a great helm: the eye slits either side of the nasal, rows of breaths
    mirror(ctx, [[0, -0.44], [0.3, -0.4], [0.34, -0.3], [0.34, 0.3], [0.24, 0.44], [0, 0.46]]);
    poly(ctx, [[-0.28, -0.1], [-0.04, -0.1], [-0.04, -0.03], [-0.28, -0.03]]); poly(ctx, [[0.04, -0.1], [0.28, -0.1], [0.28, -0.03], [0.04, -0.03]]);
    for (const x of [-0.22, -0.14, 0.14, 0.22]) for (const y of [0.16, 0.25]) circ(ctx, x, y, 0.025);
    part(ctx, 'evenodd');
  },
  mage(ctx) {         // a wizard's hat, its tip drooping, a star cut in the cone, its brim
    ctx.moveTo(-0.26, 0.26); ctx.quadraticCurveTo(-0.08, -0.12, 0.08, -0.48); ctx.quadraticCurveTo(0.16, -0.4, 0.26, -0.36);
    ctx.quadraticCurveTo(0.12, -0.3, 0.12, -0.2); ctx.quadraticCurveTo(0.2, 0.1, 0.26, 0.26); ctx.closePath();
    poly(ctx, starPts(0.0, 0.04, 0.1, 0.45));
    part(ctx, 'evenodd');
    oval(ctx, 0, 0.3, 0.46, 0.11); part(ctx);
  },
  thief(ctx) {        // a key, slanted: the ring of its bow, the shaft, the two-step bit
    ctx.save(); ctx.rotate(Math.PI / 4);
    circ(ctx, 0, -0.28, 0.17); circ(ctx, 0, -0.28, 0.08);
    ctx.restore(); part(ctx, 'evenodd');
    ctx.save(); ctx.rotate(Math.PI / 4);
    poly(ctx, [[-0.045, -0.13], [0.045, -0.13], [0.045, 0.46], [-0.045, 0.46]]);
    poly(ctx, [[0.045, 0.26], [0.2, 0.26], [0.2, 0.33], [0.045, 0.33]]);
    poly(ctx, [[0.045, 0.38], [0.16, 0.38], [0.16, 0.45], [0.045, 0.45]]);
    ctx.restore(); part(ctx);
  },
  assassin(ctx) {     // a curved blade point down, a drop at its point
    circ(ctx, 0, -0.445, 0.05); part(ctx);
    poly(ctx, [[-0.04, -0.395], [0.04, -0.395], [0.04, -0.2], [-0.04, -0.2]]); part(ctx);
    poly(ctx, [[-0.18, -0.2], [0.18, -0.2], [0.14, -0.14], [-0.14, -0.14]]); part(ctx);
    ctx.moveTo(-0.07, -0.14); ctx.quadraticCurveTo(-0.1, 0.18, 0.12, 0.36); ctx.quadraticCurveTo(0.02, 0.12, 0.07, -0.14);
    ctx.closePath(); part(ctx);
    ctx.moveTo(0.2, 0.38); ctx.quadraticCurveTo(0.24, 0.42, 0.24, 0.45); ctx.arc(0.2, 0.45, 0.04, 0, Math.PI);
    ctx.quadraticCurveTo(0.16, 0.42, 0.2, 0.38); ctx.closePath(); part(ctx);
  },
  priest(ctx) {       // a chalice under a light
    ctx.moveTo(-0.3, -0.26); ctx.lineTo(0.3, -0.26); ctx.quadraticCurveTo(0.3, 0.08, 0.04, 0.12); ctx.lineTo(0.04, 0.3);
    ctx.lineTo(0.2, 0.4); ctx.lineTo(0.2, 0.45); ctx.lineTo(-0.2, 0.45); ctx.lineTo(-0.2, 0.4); ctx.lineTo(-0.04, 0.3);
    ctx.lineTo(-0.04, 0.12); ctx.quadraticCurveTo(-0.3, 0.08, -0.3, -0.26); ctx.closePath();
    circ(ctx, 0, -0.42, 0.055);
    part(ctx);
    for (const a of [Math.PI, Math.PI * 1.25, Math.PI * 1.75, 0]) { ctx.moveTo(Math.cos(a) * 0.1, -0.42 + Math.sin(a) * 0.1); ctx.lineTo(Math.cos(a) * 0.18, -0.42 + Math.sin(a) * 0.18); }
    line(ctx, 0.04);
  },
  warrior(ctx) {      // two swords crossed
    for (const m of [1, -1]) { ctx.save(); ctx.rotate((m * Math.PI) / 4); sword(ctx); ctx.restore(); part(ctx); }
  },
  noble(ctx) {        // a five-pointed crown, its points balled, three stones cut in its band
    poly(ctx, [[-0.4, 0.26], [-0.44, -0.2], [-0.22, 0.0], [0, -0.32], [0.22, 0.0], [0.44, -0.2], [0.4, 0.26]]);
    poly(ctx, [[-0.4, 0.3], [0.4, 0.3], [0.4, 0.42], [-0.4, 0.42]]);
    circ(ctx, -0.44, -0.27, 0.05); circ(ctx, 0, -0.39, 0.06); circ(ctx, 0.44, -0.27, 0.05);
    for (const x of [-0.2, 0, 0.2]) circ(ctx, x, 0.36, 0.035);
    part(ctx, 'evenodd');
  },
  prince(ctx) {       // the crescent and the star - a Daedric Prince's mark
    crescent(ctx, -0.06, 0, 0.42, 0.1, -0.06, 0.34); part(ctx);
    poly(ctx, starPts(0.16, -0.04, 0.15, 0.42)); part(ctx);
  },
  artifact(ctx) {     // a brilliant-cut gem, faceted in line, with a glint beside it
    const outline = [[-0.4, -0.14], [-0.22, -0.34], [0.22, -0.34], [0.4, -0.14], [0, 0.42]];
    ctx.save(); ctx.globalAlpha = 0.35; poly(ctx, outline); part(ctx); ctx.restore();
    poly(ctx, outline);
    ctx.moveTo(-0.4, -0.14); ctx.lineTo(0.4, -0.14);
    ctx.moveTo(-0.22, -0.34); ctx.lineTo(-0.13, -0.14); ctx.lineTo(0, -0.34); ctx.lineTo(0.13, -0.14); ctx.lineTo(0.22, -0.34);
    ctx.moveTo(-0.13, -0.14); ctx.lineTo(0, 0.42); ctx.lineTo(0.13, -0.14);
    line(ctx, 0.05);
    poly(ctx, starPts(0.38, -0.4, 0.1, 0.25, 4)); part(ctx);
  },
  fire(ctx) {         // a flame of three tongues with its hot heart cut
    ctx.moveTo(0, 0.46);
    ctx.quadraticCurveTo(-0.36, 0.46, -0.34, 0.12); ctx.quadraticCurveTo(-0.32, -0.1, -0.16, -0.26);
    ctx.quadraticCurveTo(-0.16, -0.06, -0.06, 0.0); ctx.quadraticCurveTo(-0.12, -0.3, 0.06, -0.48);
    ctx.quadraticCurveTo(0.08, -0.24, 0.2, -0.14); ctx.quadraticCurveTo(0.22, -0.24, 0.2, -0.32);
    ctx.quadraticCurveTo(0.38, -0.1, 0.34, 0.12); ctx.quadraticCurveTo(0.36, 0.46, 0, 0.46); ctx.closePath();
    ctx.moveTo(0, 0.38); ctx.quadraticCurveTo(-0.18, 0.38, -0.16, 0.2); ctx.quadraticCurveTo(-0.14, 0.04, 0.02, -0.08);
    ctx.quadraticCurveTo(0.0, 0.08, 0.12, 0.14); ctx.quadraticCurveTo(0.2, 0.38, 0, 0.38); ctx.closePath();
    part(ctx, 'evenodd');
  },
  frost(ctx) {        // a six-armed snowflake, each arm twice branched
    for (let k = 0; k < 6; k++) {
      ctx.save(); ctx.rotate((k * Math.PI) / 3);
      ctx.moveTo(0, 0); ctx.lineTo(0, -0.44);
      ctx.moveTo(0, -0.22); ctx.lineTo(-0.12, -0.32); ctx.moveTo(0, -0.22); ctx.lineTo(0.12, -0.32);
      ctx.moveTo(0, -0.34); ctx.lineTo(-0.07, -0.41); ctx.moveTo(0, -0.34); ctx.lineTo(0.07, -0.41);
      ctx.restore();
    }
    line(ctx, 0.07);
  },
  shock(ctx) {        // a lightning bolt
    poly(ctx, [[0.08, -0.48], [-0.26, 0.04], [-0.02, 0.04], [-0.12, 0.48], [0.28, -0.08], [0.04, -0.08], [0.2, -0.48]]);
    part(ctx);
  },
  heal(ctx) {         // a heart giving off light
    ctx.moveTo(0, 0.42); ctx.quadraticCurveTo(-0.38, 0.14, -0.36, -0.08); ctx.quadraticCurveTo(-0.34, -0.3, -0.16, -0.3);
    ctx.quadraticCurveTo(-0.04, -0.3, 0, -0.16); ctx.quadraticCurveTo(0.04, -0.3, 0.16, -0.3);
    ctx.quadraticCurveTo(0.34, -0.3, 0.36, -0.08); ctx.quadraticCurveTo(0.38, 0.14, 0, 0.42); ctx.closePath();
    part(ctx);
    for (const [x0, y0, x1, y1] of [[0, -0.36, 0, -0.48], [-0.22, -0.36, -0.3, -0.46], [0.22, -0.36, 0.3, -0.46], [-0.42, -0.14, -0.5, -0.2], [0.42, -0.14, 0.5, -0.2]]) {
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    }
    line(ctx, 0.05);
  },
  shadow(ctx) {       // an eye in smoke: the lid's almond, the iris cut, the pupil, three wisps beneath
    ctx.moveTo(-0.44, -0.06); ctx.quadraticCurveTo(0, -0.4, 0.44, -0.06); ctx.quadraticCurveTo(0, 0.26, -0.44, -0.06); ctx.closePath();
    circ(ctx, 0, -0.06, 0.13); circ(ctx, 0, -0.06, 0.065);
    part(ctx, 'evenodd');
    ctx.moveTo(-0.3, 0.18); ctx.quadraticCurveTo(-0.18, 0.3, -0.3, 0.44);
    ctx.moveTo(0, 0.22); ctx.quadraticCurveTo(0.12, 0.34, 0, 0.48);
    ctx.moveTo(0.3, 0.18); ctx.quadraticCurveTo(0.42, 0.3, 0.3, 0.44);
    line(ctx, 0.06);
  },
  city(ctx) {         // a skyline: a gabled house, a spired tower, a house - their windows and the door cut
    poly(ctx, [[-0.46, 0.42], [-0.46, 0.0], [-0.32, -0.14], [-0.18, 0.0], [-0.18, 0.42]]);
    poly(ctx, [[-0.14, 0.42], [-0.14, -0.2], [0, -0.46], [0.14, -0.2], [0.14, 0.42]]);
    poly(ctx, [[0.18, 0.42], [0.18, -0.06], [0.32, -0.22], [0.46, -0.06], [0.46, 0.42]]);
    poly(ctx, [[-0.36, 0.08], [-0.28, 0.08], [-0.28, 0.18], [-0.36, 0.18]]);
    ctx.moveTo(-0.045, 0.0); ctx.lineTo(-0.045, -0.1); ctx.arc(0, -0.1, 0.045, Math.PI, TAU); ctx.lineTo(0.045, 0.0); ctx.closePath();
    poly(ctx, [[-0.06, 0.26], [0.06, 0.26], [0.06, 0.4], [-0.06, 0.4]]);
    poly(ctx, [[0.25, 0.04], [0.29, 0.04], [0.29, 0.14], [0.25, 0.14]]); poly(ctx, [[0.35, 0.04], [0.39, 0.04], [0.39, 0.14], [0.35, 0.14]]);
    part(ctx, 'evenodd');
  },
  desert(ctx) {       // a sun over two dunes
    circ(ctx, 0.16, -0.24, 0.15); part(ctx);
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; ctx.moveTo(0.16 + Math.cos(a) * 0.2, -0.24 + Math.sin(a) * 0.2); ctx.lineTo(0.16 + Math.cos(a) * 0.27, -0.24 + Math.sin(a) * 0.27); }
    line(ctx, 0.04);
    ctx.save(); ctx.globalAlpha = 0.55;
    ctx.moveTo(-0.5, 0.2); ctx.quadraticCurveTo(-0.1, -0.06, 0.5, 0.14); ctx.lineTo(0.5, 0.46); ctx.lineTo(-0.5, 0.46); ctx.closePath();
    part(ctx); ctx.restore();
    ctx.moveTo(-0.5, 0.46); ctx.lineTo(-0.5, 0.32); ctx.quadraticCurveTo(0.1, 0.12, 0.5, 0.4); ctx.lineTo(0.5, 0.46); ctx.closePath();
    part(ctx);
  },
  fortress(ctx) {     // a towered wall: two crenellated towers, the curtain between, its gate and the arrow slits cut
    crenellated(ctx, -0.46, -0.2, -0.44, 0.44, 3, 0.07);
    crenellated(ctx, 0.2, 0.46, -0.44, 0.44, 3, 0.07);
    crenellated(ctx, -0.2, 0.2, -0.14, 0.44, 3, 0.07);
    ctx.moveTo(-0.1, 0.42); ctx.lineTo(-0.1, 0.2); ctx.arc(0, 0.2, 0.1, Math.PI, TAU); ctx.lineTo(0.1, 0.42); ctx.closePath();
    for (const x of [-0.33, 0.33]) poly(ctx, [[x - 0.02, -0.22], [x + 0.02, -0.22], [x + 0.02, 0.0], [x - 0.02, 0.0]]);
    part(ctx, 'evenodd');
  },
  dungeon(ctx) {      // a stone archway, its portcullis half-raised over the dark
    ctx.moveTo(-0.42, 0.44); ctx.lineTo(-0.42, -0.06); ctx.arc(0, -0.06, 0.42, Math.PI, TAU); ctx.lineTo(0.42, 0.44);
    ctx.lineTo(0.26, 0.44); ctx.lineTo(0.26, -0.06); ctx.arc(0, -0.06, 0.26, 0, Math.PI, true); ctx.lineTo(-0.26, 0.44);
    ctx.closePath(); part(ctx);
    for (const x of [-0.18, -0.09, 0, 0.09, 0.18]) { ctx.moveTo(x, -0.06 - Math.sqrt(0.26 * 0.26 - x * x)); ctx.lineTo(x, 0.24); }
    for (const y of [-0.14, 0.06]) { const hw = Math.sqrt(0.26 * 0.26 - Math.max(0, -0.06 - y) ** 2); ctx.moveTo(-hw, y); ctx.lineTo(hw, y); }
    line(ctx, 0.035);
    for (const x of [-0.18, -0.09, 0, 0.09, 0.18]) poly(ctx, [[x - 0.025, 0.24], [x + 0.025, 0.24], [x, 0.31]]);
    part(ctx);
  },
  sea(ctx) {          // a curling wave over two rows of swell
    ctx.moveTo(-0.46, 0.02); ctx.quadraticCurveTo(-0.34, -0.42, 0.04, -0.42); ctx.quadraticCurveTo(0.34, -0.42, 0.3, -0.16);
    ctx.quadraticCurveTo(0.2, -0.28, 0.08, -0.2); ctx.quadraticCurveTo(-0.02, -0.1, 0.12, 0.02); ctx.closePath();
    part(ctx);
    waveRow(ctx, 0.18, 0.1); waveRow(ctx, 0.36, 0.1);
    line(ctx, 0.07);
  },
  // AUDIT CARDS-5 (B6/B7/B10): the artifacts, the Princes, the beasts and the rites that had borrowed another's picture.
  razor(ctx) {        // Mehrunes' Razor: a slim dagger, its blade curved like a talon, a swept guard, a ringed pommel
    ctx.save(); ctx.rotate(Math.PI / 5); ctx.scale(1.16, 1.16);
    ctx.moveTo(-0.05, 0.1); ctx.quadraticCurveTo(-0.12, -0.22, 0.07, -0.5); ctx.quadraticCurveTo(0.0, -0.2, 0.05, 0.1); ctx.closePath();
    ctx.moveTo(-0.2, 0.02); ctx.quadraticCurveTo(0, 0.14, 0.2, 0.02); ctx.lineTo(0.18, 0.1); ctx.quadraticCurveTo(0, 0.22, -0.18, 0.1); ctx.closePath();
    poly(ctx, [[-0.03, 0.14], [0.03, 0.14], [0.03, 0.34], [-0.03, 0.34]]);
    ctx.restore(); part(ctx);
    ctx.save(); ctx.rotate(Math.PI / 5); ctx.scale(1.16, 1.16); circ(ctx, 0, 0.41, 0.075); circ(ctx, 0, 0.41, 0.035); ctx.restore();
    part(ctx, 'evenodd');
  },
  staff(ctx) {        // the Wabbajack: a gnarled staff, knotted, its head twisted into a curl against a hooked prong
    ctx.moveTo(-0.32, 0.48); ctx.quadraticCurveTo(-0.06, 0.2, 0.04, -0.1); line(ctx, 0.085);
    circ(ctx, -0.2, 0.31, 0.06); circ(ctx, -0.05, 0.1, 0.055); part(ctx);
    ctx.moveTo(0.04, -0.1); ctx.quadraticCurveTo(-0.02, -0.38, 0.2, -0.43); ctx.quadraticCurveTo(0.42, -0.44, 0.4, -0.24);
    ctx.quadraticCurveTo(0.38, -0.08, 0.23, -0.12); ctx.quadraticCurveTo(0.12, -0.16, 0.18, -0.27);
    ctx.moveTo(0.04, -0.1); ctx.quadraticCurveTo(-0.22, -0.14, -0.22, -0.34);
    line(ctx, 0.07);
    circ(ctx, 0.19, -0.28, 0.045); circ(ctx, -0.22, -0.38, 0.055); part(ctx);
  },
  book(ctx) {         // the Oghma Infinium: a thick tome, its page block showing, its cover framed and set with an eye
    const pages = [[0.24, -0.42], [0.36, -0.32], [0.36, 0.44], [-0.24, 0.44], [-0.36, 0.34], [0.24, 0.34]];
    ctx.save(); ctx.globalAlpha = 0.45; poly(ctx, pages); part(ctx); ctx.restore();
    poly(ctx, pages); line(ctx, 0.03);
    ctx.moveTo(0.28, -0.38); ctx.lineTo(0.28, 0.38); ctx.lineTo(-0.3, 0.38);
    ctx.moveTo(0.32, -0.35); ctx.lineTo(0.32, 0.41); ctx.lineTo(-0.27, 0.41);
    line(ctx, 0.016);
    poly(ctx, [[-0.36, -0.42], [0.24, -0.42], [0.24, 0.34], [-0.36, 0.34]]);
    poly(ctx, [[-0.31, -0.37], [0.19, -0.37], [0.19, 0.29], [-0.31, 0.29]]);
    poly(ctx, [[-0.285, -0.345], [0.165, -0.345], [0.165, 0.265], [-0.285, 0.265]]);
    ctx.moveTo(-0.25, -0.04); ctx.quadraticCurveTo(-0.06, -0.24, 0.13, -0.04); ctx.quadraticCurveTo(-0.06, 0.16, -0.25, -0.04); ctx.closePath();
    circ(ctx, -0.06, -0.04, 0.05);
    part(ctx, 'evenodd');
    for (const y of [-0.3, 0.16]) poly(ctx, [[-0.41, y], [-0.36, y], [-0.36, y + 0.06], [-0.41, y + 0.06]]);
    poly(ctx, [[0.24, -0.1], [0.31, -0.1], [0.31, 0.02], [0.24, 0.02]]);
    part(ctx);
  },
  claymore(ctx) {     // Chrysamere: a great two-handed sword upright, its fuller cut, its quillons swept up and balled
    poly(ctx, [[0, -0.5], [0.055, -0.4], [0.055, 0.14], [-0.055, 0.14], [-0.055, -0.4]]);
    poly(ctx, [[-0.014, -0.36], [0.014, -0.36], [0.014, 0.06], [-0.014, 0.06]]);
    part(ctx, 'evenodd');
    ctx.moveTo(-0.34, 0.02); ctx.quadraticCurveTo(0, 0.2, 0.34, 0.02); ctx.lineTo(0.32, 0.1); ctx.quadraticCurveTo(0, 0.28, -0.32, 0.1); ctx.closePath();
    circ(ctx, -0.36, 0.04, 0.05); circ(ctx, 0.36, 0.04, 0.05);
    poly(ctx, [[-0.032, 0.18], [0.032, 0.18], [0.032, 0.4], [-0.032, 0.4]]);
    circ(ctx, 0, 0.45, 0.055);
    part(ctx);
  },
  rose(ctx) {         // the Sanguine Rose: a bloom, its petals folded in, on a thorned stem with one leaf
    ctx.moveTo(0, 0.06); ctx.quadraticCurveTo(-0.3, 0.04, -0.28, -0.22); ctx.quadraticCurveTo(-0.22, -0.34, -0.12, -0.3);
    ctx.quadraticCurveTo(-0.06, -0.46, 0.06, -0.4); ctx.quadraticCurveTo(0.2, -0.44, 0.17, -0.3);
    ctx.quadraticCurveTo(0.3, -0.32, 0.28, -0.2); ctx.quadraticCurveTo(0.3, 0.04, 0, 0.06); ctx.closePath();
    crescent(ctx, 0, -0.14, 0.2, 0, -0.2, 0.19);
    crescent(ctx, 0.0, -0.22, 0.11, -0.03, -0.25, 0.1);
    part(ctx, 'evenodd');
    ctx.moveTo(0, 0.04); ctx.quadraticCurveTo(-0.07, 0.28, 0.02, 0.5); line(ctx, 0.05);
    poly(ctx, [[-0.03, 0.15], [-0.12, 0.13], [-0.035, 0.21]]); poly(ctx, [[-0.005, 0.32], [0.09, 0.29], [0.005, 0.38]]);
    poly(ctx, [[-0.01, 0.42], [-0.1, 0.43], [0.0, 0.47]]);
    ctx.moveTo(-0.03, 0.29); ctx.quadraticCurveTo(-0.2, 0.16, -0.32, 0.26); ctx.quadraticCurveTo(-0.17, 0.38, -0.03, 0.29); ctx.closePath();
    part(ctx);
  },
  daedric(ctx) {      // a Daedric sigil, a Prince's and no one Prince's: a broken ring, a spire through it, horns across it
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      ctx.moveTo(Math.cos(a + 0.32) * 0.42, Math.sin(a + 0.32) * 0.42); ctx.arc(0, 0, 0.42, a + 0.32, a + Math.PI / 2 - 0.32);
    }
    line(ctx, 0.06);
    poly(ctx, [[0, -0.5], [0.075, -0.1], [0, 0.5], [-0.075, -0.1]]); part(ctx);
    crescent(ctx, 0, -0.06, 0.3, 0, -0.18, 0.27); part(ctx);
    for (const m of [1, -1]) poly(ctx, [[0.42 * m, -0.04], [0.5 * m, 0], [0.42 * m, 0.04], [0.34 * m, 0]]);
    part(ctx);
  },
  scorpion(ctx) {     // a scorpion from above: two pincers out before it, eight legs, its tail curled round to the sting
    for (const m of [1, -1]) {
      for (const y of [-0.08, 0.0, 0.08, 0.16]) { ctx.moveTo(0.06 * m, y); ctx.lineTo(0.24 * m, y - 0.07); ctx.lineTo(0.34 * m, y + 0.05); }
      ctx.moveTo(0.06 * m, -0.2); ctx.lineTo(0.18 * m, -0.26); ctx.lineTo(0.22 * m, -0.34);
    }
    line(ctx, 0.04);
    oval(ctx, 0, -0.02, 0.1, 0.2); circ(ctx, 0, -0.22, 0.075); part(ctx);
    for (const m of [1, -1]) { crescent(ctx, 0.23 * m, -0.4, 0.09, 0.23 * m, -0.48, 0.065); part(ctx); }
    for (const [x, y, r] of [[0, 0.21, 0.055], [0.02, 0.29, 0.05], [0.08, 0.36, 0.048], [0.16, 0.39, 0.046], [0.24, 0.36, 0.044], [0.29, 0.29, 0.042]]) circ(ctx, x, y, r);
    part(ctx);
    ctx.moveTo(0.27, 0.27); ctx.quadraticCurveTo(0.36, 0.14, 0.24, 0.12); ctx.lineTo(0.3, 0.18); ctx.quadraticCurveTo(0.3, 0.24, 0.33, 0.29); ctx.closePath();
    part(ctx);
  },
  bat(ctx) {          // a bat, its wings spread, their trailing edges scalloped between the fingers; the ears pricked
    mirrorQ(ctx, [[0, -0.1], [0.05, -0.22], [0.08, -0.1], [0.2, -0.1, 0.3, -0.26], [0.42, -0.24, 0.5, -0.1],
      [0.4, -0.06, 0.38, 0.06], [0.3, 0.0, 0.24, 0.14], [0.17, 0.06, 0.09, 0.12], [0.06, 0.22], [0, 0.26]]);
    poly(ctx, [[0.02, -0.06], [0.06, -0.08], [0.05, -0.04]]); poly(ctx, flipX([[0.02, -0.06], [0.06, -0.08], [0.05, -0.04]]));
    part(ctx, 'evenodd');
  },
  boar(ctx) {         // a boar's head, full face: the ears up, the eyes slanted, the snout's disc and nostrils, two tusks
    mirrorQ(ctx, [[0, -0.28], [0.1, -0.28], [0.22, -0.46], [0.3, -0.2], [0.34, -0.02], [0.26, 0.14], [0.2, 0.2], [0.2, 0.36], [0.16, 0.44], [0, 0.44]]);
    for (const m of [1, -1]) {
      poly(ctx, [[0.08 * m, -0.08], [0.2 * m, -0.13], [0.16 * m, -0.03]]);
      poly(ctx, [[0.13 * m, -0.28], [0.21 * m, -0.38], [0.25 * m, -0.22]]);
    }
    oval(ctx, 0, 0.33, 0.155, 0.095); oval(ctx, 0, 0.33, 0.125, 0.068);
    oval(ctx, -0.05, 0.33, 0.025, 0.035); oval(ctx, 0.05, 0.33, 0.025, 0.035);
    part(ctx, 'evenodd');
    for (const m of [1, -1]) {
      ctx.moveTo(0.18 * m, 0.31); ctx.quadraticCurveTo(0.4 * m, 0.32, 0.42 * m, 0.06); ctx.quadraticCurveTo(0.33 * m, 0.24, 0.18 * m, 0.22);
      ctx.closePath(); part(ctx);
    }
  },
  tree(ctx) {         // a spriggan: a gnarled tree that stands like a man - root-feet, branch-arms, a face in the bark
    ctx.moveTo(-0.12, 0.44); ctx.quadraticCurveTo(-0.05, 0.1, -0.11, -0.16); ctx.lineTo(0.11, -0.16); ctx.quadraticCurveTo(0.05, 0.1, 0.12, 0.44); ctx.closePath();
    oval(ctx, -0.045, -0.06, 0.03, 0.022); oval(ctx, 0.045, -0.06, 0.03, 0.022); oval(ctx, 0, 0.04, 0.02, 0.035);
    part(ctx, 'evenodd');
    ctx.moveTo(-0.1, 0.4); ctx.quadraticCurveTo(-0.2, 0.42, -0.32, 0.47); ctx.moveTo(0.1, 0.4); ctx.quadraticCurveTo(0.2, 0.42, 0.32, 0.47);
    ctx.moveTo(-0.07, -0.02); ctx.quadraticCurveTo(-0.26, -0.04, -0.34, -0.26); ctx.moveTo(-0.29, -0.15); ctx.lineTo(-0.42, -0.14);
    ctx.moveTo(0.07, -0.02); ctx.quadraticCurveTo(0.26, 0.0, 0.36, -0.22); ctx.moveTo(0.31, -0.11); ctx.lineTo(0.43, -0.08);
    line(ctx, 0.06);
    ctx.moveTo(0, -0.14); ctx.lineTo(0, -0.32); ctx.moveTo(0, -0.22); ctx.lineTo(-0.13, -0.37); ctx.moveTo(0, -0.25); ctx.lineTo(0.13, -0.41);
    line(ctx, 0.045);
    for (const [x, y] of [[-0.34, -0.29], [0.37, -0.25], [-0.14, -0.4], [0.14, -0.44], [0.0, -0.36], [-0.44, -0.14], [0.45, -0.08]]) oval(ctx, x, y, 0.055, 0.04);
    part(ctx);
  },
  gargoyle(ctx) {     // a gargoyle crouched on its plinth: horned, its wings folded up behind its shoulders
    mirrorQ(ctx, [[0, -0.28], [0.06, -0.3], [0.14, -0.47], [0.11, -0.28], [0.12, -0.18], [0.07, -0.12], [0.18, -0.12],
      [0.26, -0.3], [0.38, -0.47], [0.41, -0.2], [0.36, 0.06], [0.28, 0.0], [0.3, 0.18], [0.24, 0.3], [0.32, 0.34], [0.42, 0.34],
      [0.42, 0.46], [0, 0.46]]);
    for (const m of [1, -1]) {
      poly(ctx, [[0.025 * m, -0.24], [0.09 * m, -0.255], [0.07 * m, -0.21]]);
      poly(ctx, [[0.19 * m, -0.1], [0.34 * m, -0.38], [0.25 * m, -0.07]]);
    }
    ctx.moveTo(-0.13, 0.34); ctx.quadraticCurveTo(0, 0.08, 0.13, 0.34); ctx.closePath();
    poly(ctx, [[-0.4, 0.355], [0.4, 0.355], [0.4, 0.375], [-0.4, 0.375]]);
    part(ctx, 'evenodd');
  },
  banish(ctx) {       // a broken chain: two links pulled apart, each open at the break, the snap flashing between
    ctx.save(); ctx.rotate(Math.PI / 4); ctx.scale(1.25, 1.25);
    ctx.moveTo(0.08, -0.08); ctx.lineTo(0.08, -0.26); ctx.arc(0, -0.26, 0.08, 0, Math.PI, true); ctx.lineTo(-0.08, -0.12);
    ctx.moveTo(-0.08, 0.08); ctx.lineTo(-0.08, 0.26); ctx.arc(0, 0.26, 0.08, Math.PI, 0, true); ctx.lineTo(0.08, 0.12);
    ctx.restore(); line(ctx, 0.07);
    ctx.save(); ctx.rotate(Math.PI / 4); ctx.scale(1.25, 1.25);
    poly(ctx, [[-0.028, -0.52], [0.028, -0.52], [0.028, -0.3], [-0.028, -0.3]]);
    poly(ctx, [[-0.028, 0.3], [0.028, 0.3], [0.028, 0.52], [-0.028, 0.52]]);
    ctx.restore(); part(ctx);
    ctx.save(); ctx.rotate(Math.PI / 4); ctx.scale(1.25, 1.25);
    for (const [x0, y0, x1, y1] of [[0.07, 0, 0.22, 0], [-0.07, 0, -0.22, 0], [0.06, -0.04, 0.17, -0.12], [-0.06, 0.04, -0.17, 0.12], [0.06, 0.04, 0.17, 0.12], [-0.06, -0.04, -0.17, -0.12]]) {
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    }
    ctx.restore(); line(ctx, 0.035);
  },
  recall(ctx) {       // a spiral portal: the way home winding in to its eye, its rim a broken ring
    for (let k = 0; k <= 72; k++) {
      const t = k / 72, a = t * Math.PI * 5, r = 0.04 + t * 0.3;
      if (k) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    line(ctx, 0.065);
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4 + 0.15; ctx.moveTo(Math.cos(a) * 0.45, Math.sin(a) * 0.45); ctx.arc(0, 0, 0.45, a, a + Math.PI / 4 - 0.3); }
    line(ctx, 0.05);
    circ(ctx, 0, 0, 0.055); part(ctx);
  },
  sun(ctx) {          // a holy sun: a ringed disc, twelve rays about it, long and short by turns
    circ(ctx, 0, 0, 0.21); circ(ctx, 0, 0, 0.165); circ(ctx, 0, 0, 0.12); part(ctx, 'evenodd');
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6, r1 = k % 2 ? 0.38 : 0.5, hw = k % 2 ? 0.05 : 0.07;
      const [c, sn] = [Math.cos(a), Math.sin(a)];
      poly(ctx, [[c * 0.25 - sn * hw, sn * 0.25 + c * hw], [c * r1, sn * r1], [c * 0.25 + sn * hw, sn * 0.25 - c * hw]]);
    }
    part(ctx);
  },
  // CARDS9 (section 30): the bosses' own pictures - the Gate's Warden, the Sea Serpent, the Abyss Dungeon's Remnant.
  gate(ctx) {         // the Burning Gate: a horned arch of black iron, its gap a tongue of fire, spikes along its crown
    ctx.moveTo(-0.42, 0.46); ctx.lineTo(-0.42, -0.06); ctx.quadraticCurveTo(-0.42, -0.42, 0, -0.44);
    ctx.quadraticCurveTo(0.42, -0.42, 0.42, -0.06); ctx.lineTo(0.42, 0.46); ctx.lineTo(0.26, 0.46); ctx.lineTo(0.26, -0.04);
    ctx.quadraticCurveTo(0.26, -0.28, 0, -0.29); ctx.quadraticCurveTo(-0.26, -0.28, -0.26, -0.04); ctx.lineTo(-0.26, 0.46);
    ctx.closePath();
    part(ctx);
    for (const m of [1, -1]) poly(ctx, [[0.36 * m, -0.3], [0.5 * m, -0.5], [0.24 * m, -0.38]]);   // the horns
    for (let k = -2; k <= 2; k++) poly(ctx, [[k * 0.09 - 0.035, -0.43], [k * 0.09, -0.52 + Math.abs(k) * 0.02], [k * 0.09 + 0.035, -0.43]]);
    part(ctx);
    // the fire in the gap: one tall tongue and two low ones
    ctx.moveTo(-0.2, 0.46); ctx.quadraticCurveTo(-0.22, 0.2, -0.08, 0.06); ctx.quadraticCurveTo(-0.08, 0.2, 0, 0.22);
    ctx.quadraticCurveTo(-0.04, 0.02, 0.06, -0.16); ctx.quadraticCurveTo(0.12, 0.06, 0.08, 0.2);
    ctx.quadraticCurveTo(0.16, 0.12, 0.14, 0.04); ctx.quadraticCurveTo(0.24, 0.22, 0.2, 0.46); ctx.closePath();
    part(ctx);
  },
  serpent(ctx) {      // the Old Coil: a sea serpent rising in three arches out of a swell, its finned head turned back
    for (const [x0, x1, h] of [[-0.46, -0.18, 0.3], [-0.12, 0.14, 0.26]]) {   // two body arches, thick
      ctx.moveTo(x0, 0.16); ctx.quadraticCurveTo((x0 + x1) / 2, 0.16 - h * 2, x1, 0.16);
      ctx.lineTo(x1 - 0.08, 0.16); ctx.quadraticCurveTo((x0 + x1) / 2, 0.16 - h * 1.45, x0 + 0.08, 0.16); ctx.closePath();
    }
    part(ctx);
    // the neck rising to the head, the head turned back over it with its jaw open
    ctx.moveTo(0.2, 0.16); ctx.quadraticCurveTo(0.24, -0.2, 0.34, -0.34); ctx.lineTo(0.46, -0.38); ctx.lineTo(0.5, -0.3);
    ctx.lineTo(0.4, -0.27); ctx.lineTo(0.48, -0.2); ctx.lineTo(0.38, -0.2); ctx.quadraticCurveTo(0.32, -0.04, 0.3, 0.16); ctx.closePath();
    part(ctx);
    for (let k = 0; k < 3; k++) poly(ctx, [[0.2 + k * 0.04, -0.06 - k * 0.1], [0.12 + k * 0.03, -0.12 - k * 0.1], [0.24 + k * 0.04, -0.12 - k * 0.1]]);   // the fin down its neck
    part(ctx);
    waveRow(ctx, 0.28, 0.08); waveRow(ctx, 0.44, 0.08);
    line(ctx, 0.07);
  },
  gear(ctx) {         // the Brass Remnant's turning gear: a cogwheel of twelve teeth round an hourglass cut through its hub
    const teeth = 12, r0 = 0.36, r1 = 0.48;
    for (let k = 0; k < teeth; k++) {
      const a0 = (k * 2 * Math.PI) / teeth, a1 = a0 + Math.PI / teeth;
      const p = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
      const pts = [p(a0, r0), p(a0 + 0.06, r1), p(a1 - 0.06, r1), p(a1, r0)];
      if (k === 0) ctx.moveTo(pts[0][0], pts[0][1]); else ctx.lineTo(pts[0][0], pts[0][1]);
      for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]);
      const n = p(a1 + Math.PI / teeth, r0); ctx.lineTo(n[0], n[1]);
    }
    ctx.closePath();
    circ(ctx, 0, 0, 0.24);   // the hub's hole
    part(ctx, 'evenodd');
    poly(ctx, [[-0.13, -0.17], [0.13, -0.17], [0.025, 0], [0.13, 0.17], [-0.13, 0.17], [-0.025, 0]]);   // the hourglass in it
    part(ctx);
  },
};

/** One painter per emblem, `(ctx, cx, cy, size, ink)`: the glyph `size` across, centred on (cx, cy), in `ink`. */
function painter(trace) {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} size
   * @param {string} ink
   */
  return (ctx, cx, cy, size, ink) => {
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(size, size);
    ctx.fillStyle = ink; ctx.strokeStyle = ink;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    trace(ctx);
    ctx.restore();
  };
}

/**
 * The emblems the catalog's cards carry (net/iliacCards.js CARD_EMBLEMS), each its painter. Creatures, callings,
 * princes and things, the schools of a spell, and the lie of a land.
 */
export const EMBLEM_PAINTERS = Object.freeze(Object.fromEntries(Object.entries(GLYPHS).map(([k, trace]) => [k, painter(trace)])));

/**
 * EMBLEM_PAINTERS' keys in their order: the first set's 34 (its beetle gone - no card is an insect once the scorpion
 * has its own), then AUDIT CARDS-5's 14 (razor, staff, book, claymore, rose, daedric, scorpion, bat, boar, tree,
 * gargoyle, banish, recall, sun), then CARDS9's 3 (gate, serpent, gear - the bosses' own) - net/iliacCards.js
 * CARD_EMBLEMS, the same list. 'prince', the moon and the star, is
 * Azura's own; 'daedric' is the sigil of a Prince who has no picture of their own.
 */
export const EMBLEM_KEYS = Object.freeze(Object.keys(GLYPHS));

/** The emblem a card without a known one is drawn with, by kind - a gap in the catalog shows, it does not throw. */
const KIND_EMBLEM = Object.freeze({ unit: 'warrior', spell: 'shock', prince: 'daedric', location: 'city' });

// ---- the words ----------------------------------------------------------------------------------------------------

/**
 * Break `text` into lines no wider than `maxWidth` by the context's own measure (its current font): words go whole
 * where they fit, a word wider than the line is broken by letters, and a newline in the text always breaks.
 * `maxWidth` may be a function of the line's index, for a box whose lines are not all one width (the lines that pass
 * beside the power shield are shorter).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number | ((line: number) => number)} maxWidth
 * @returns {string[]}
 */
export function wrapCardText(ctx, text, maxWidth) {
  const width = (t) => ctx.measureText(t)?.width ?? 0;
  const limit = typeof maxWidth === 'function' ? maxWidth : () => maxWidth;
  const lines = [];
  for (const para of String(text ?? '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = '';
    for (const word of words) {
      const next = cur ? `${cur} ${word}` : word;
      if (width(next) <= limit(lines.length)) { cur = next; continue; }
      if (cur) lines.push(cur);
      cur = '';
      if (width(word) <= limit(lines.length)) { cur = word; continue; }
      let piece = '';   // the word is wider than a line: break it by letters, at least one to a line
      for (const ch of word) {
        if (piece && width(piece + ch) > limit(lines.length)) { lines.push(piece); piece = ''; }
        piece += ch;
      }
      cur = piece;
    }
    if (cur || !words.length) lines.push(cur);
  }
  return lines;
}

const FACE = 'px Georgia, serif';

/** Shrink a font from `px` until `text` fits `maxW`, down to `minPx`; returns the size set. */
function fitFont(ctx, text, maxW, px, minPx, style) {
  let p = px;
  ctx.font = `${style}${p}${FACE}`;
  while (p > minPx && (ctx.measureText(text)?.width ?? 0) > maxW) { p = Math.max(minPx, p * 0.9); ctx.font = `${style}${p}${FACE}`; }
  return p;
}

/**
 * The name's lines at the font now set: one line, or the two that split its words most evenly (the longer of the two
 * as short as it can be). A name of one word stays one line.
 */
function nameSplit(ctx, text) {
  const words = text.split(/\s+/).filter(Boolean);
  const width = (t) => ctx.measureText(t)?.width ?? 0;
  let best = null;
  for (let k = 1; k < words.length; k++) {
    const pair = [words.slice(0, k).join(' '), words.slice(k).join(' ')];
    const m = Math.max(width(pair[0]), width(pair[1]));
    if (!best || m < best.m) best = { m, pair };
  }
  return best ? best.pair : [text];
}

/**
 * B17: the name fitted to its banner: one line from the largest size down to the one-line floor; then two lines (the
 * most even split) from the two-line size down to its floor; at that floor a line still too wide is drawn condensed
 * to the banner's inner width (fillText's maxWidth), never over the notches. Returns the size, the lines and the
 * width each is held to.
 */
function fitName(ctx, text, L) {
  const nb = L.nameBox, f = L.nameFont, width = (t) => ctx.measureText(t)?.width ?? 0;
  const set = (px) => { ctx.font = `bold ${px}${FACE}`; };
  for (let px = f.one; px >= f.oneMin - 1e-9; px -= f.step) {
    set(px);
    if (width(text) <= nb.w) return { px, lines: [text] };
  }
  for (let px = f.two; px >= f.twoMin - 1e-9; px -= f.step) {
    set(px);
    const lines = nameSplit(ctx, text);
    if (lines.every((t) => width(t) <= nb.w)) return { px, lines };
  }
  set(f.twoMin);
  return { px: f.twoMin, lines: nameSplit(ctx, text) };
}

// ---- the frame ----------------------------------------------------------------------------------------------------

/** A rectangle with its corners rounded `r`, as one sub-path. */
function roundRect(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + k, y); ctx.lineTo(x + w - k, y); ctx.quadraticCurveTo(x + w, y, x + w, y + k);
  ctx.lineTo(x + w, y + h - k); ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  ctx.lineTo(x + k, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - k);
  ctx.lineTo(x, y + k); ctx.quadraticCurveTo(x, y, x + k, y); ctx.closePath();
}

/** TILE MODE: a card this tall or less (the Collections grid's 112) paints no rules and no flavor - see the header. */
export const ILIAC_TILE_MAX_H = 140;

/** B16: the dark keyline between every rim and the panel, in u. */
const KEYLINE = 1.3;

/**
 * Where a card's parts sit at w x h: the panel's inset, the rim and its keyline, the studs, the art window (x, y, w, h
 * and its shape), the emblem's centre and size, the banner and the name's box inside its notches, the text box (null
 * in TILE MODE), the gem's and the shield's centres (null where the kind has none). Pure - the painter and the pins
 * both read it.
 * @param {string} kind
 * @param {string} tier
 * @param {number} w
 * @param {number} h
 */
export function iliacLayout(kind, tier, w, h) {
  const u = h / 100, art = KIND_ART[kind] ?? KIND_ART.unit, frame = TIER_FRAMES[tier] ?? TIER_FRAMES.common;
  const tile = h <= ILIAC_TILE_MAX_H;
  const rimIn = (1 + frame.band) * u, p = rimIn + KEYLINE * u, innerW = w - 2 * p;
  const mid = (1 + frame.band / 2) * u;
  const rim = { mid, width: frame.band * u, inner: rimIn };
  const studR = (frame.band * 0.7 + 0.8) * u;
  const studs = [[mid, mid], [w - mid, mid], [mid, h - mid], [w - mid, h - mid], [w / 2, mid], [w / 2, h - mid], [mid, h / 2], [w - mid, h / 2]]
    .slice(0, frame.studs);
  const landscape = art.window === 'landscape';
  let banner, win, box = null, gem = null, shield = null;
  if (tile) {
    const bh = 18 * u;
    banner = { x: p + 0.8 * u, y: landscape ? p + 1.2 * u : h - p - 1.2 * u - bh, w: innerW - 1.6 * u, h: bh };
    const wy = landscape ? banner.y + bh + 1.4 * u : p + 1.2 * u;
    win = { x: p + 1.2 * u, y: wy, w: innerW - 2.4 * u, h: (landscape ? h - p - 1.2 * u : banner.y - 1.4 * u) - wy };
    if (art.cost) { const r = 8 * u; gem = { x: p + 0.87 * r + 0.6 * u, y: p + r + 0.6 * u, r }; }
    if (art.power) { const hw = 7 * u, hh = 8 * u; shield = { x: w - p - 1.2 * u - hw, y: banner.y - 0.8 * u - hh, hw, hh }; }
  } else {
    banner = landscape ? { x: p + 1 * u, y: p + 1.2 * u, w: innerW - 2 * u, h: 10 * u } : { x: p + 1 * u, y: 57.5 * u, w: innerW - 2 * u, h: 10 * u };
    if (landscape) win = { x: p + 1.5 * u, y: banner.y + banner.h + 2.5 * u, w: innerW - 3 * u, h: 36 * u };
    else if (art.window === 'square') { const s = Math.min(43 * u, innerW - 4 * u); win = { x: (w - s) / 2, y: 13 * u, w: s, h: s }; }
    else win = { x: p + 2 * u, y: 13 * u, w: innerW - 4 * u, h: 43 * u };
    box = { x: p + 2 * u, y: landscape ? win.y + win.h + 3 * u : 68.5 * u, w: innerW - 4 * u, h: 0 };
    box.h = h - p - 1.6 * u - box.y;
    if (art.cost) { const r = 6.2 * u; gem = { x: p + 0.87 * r + 1.2 * u, y: p + r + 1 * u, r }; }
    if (art.power) { const hw = 5.5 * u, hh = 6.5 * u; shield = { x: w - p - 1.8 * u - hw, y: h - p - 1.6 * u - hh, hw, hh }; }
  }
  const notch = 2.2 * u, nameMargin = 1 * u;
  const nameBox = { x: banner.x + notch + nameMargin, y: banner.y, w: banner.w - 2 * notch - 2 * nameMargin, h: banner.h };
  const nameFont = tile ? { one: 8.6 * u, oneMin: 7.6 * u, two: 7.6 * u, twoMin: 7.2 * u, step: 0.2 * u, lh: 1.02 }
    : { one: 5.8 * u, oneMin: 4.6 * u, two: 4.2 * u, twoMin: 3.4 * u, step: 0.2 * u, lh: 1.05 };
  const emblem = {
    cx: win.x + win.w / 2,
    cy: win.y + win.h / 2 + (art.window === 'arch' ? win.h * 0.06 : 0),
    size: Math.min(win.w, win.h) * (landscape ? 0.86 : tile ? 0.8 : 0.78),
  };
  if (tile && art.window === 'arch') emblem.cy = win.y + win.h * 0.56;
  return { u, p, tile, frame, art, rim, studs, studR, win, emblem, banner, notch, nameBox, nameFont, box, gem, shield, shape: art.window };
}

/** Trace the art window's shape. */
function windowPath(ctx, L) {
  const { x, y, w, h } = L.win, u = L.u;
  if (L.shape === 'rounded') roundRect(ctx, x, y, w, h, 7 * u);
  else if (L.shape === 'arch') {
    const shoulder = y + Math.min(h * 0.4, w * 0.55);
    ctx.moveTo(x, y + h); ctx.lineTo(x, shoulder);
    ctx.quadraticCurveTo(x, y + (shoulder - y) * 0.25, x + w / 2, y);
    ctx.quadraticCurveTo(x + w, y + (shoulder - y) * 0.25, x + w, shoulder);
    ctx.lineTo(x + w, y + h); ctx.closePath();
  } else roundRect(ctx, x, y, w, h, 0.8 * u);
}

/** A diamond stud set in the rim at (x, y). */
function stud(ctx, x, y, r, colour, u) {
  ctx.fillStyle = colour; ctx.strokeStyle = FRAME_DARK; ctx.lineWidth = 0.4 * u;
  ctx.beginPath(); poly(ctx, [[x, y - r], [x + r, y], [x, y + r], [x - r, y]]); ctx.fill(); ctx.stroke();
}

/**
 * The frame: the card's dark edge, the rim in the tier's colour (heavier the higher the tier), the dark keyline that
 * parts every rim from the panel (the dark edge left showing between them), the panel, its double rule (each edged
 * dark, so a pale tier's still reads) and glow, and the studs.
 */
function paintFrame(ctx, L, colour, w, h) {
  const { u, p, frame, rim } = L, r = 4 * u;
  ctx.fillStyle = FRAME_DARK; ctx.beginPath(); roundRect(ctx, 0, 0, w, h, r); ctx.fill();
  ctx.strokeStyle = colour; ctx.lineWidth = rim.width;
  ctx.beginPath(); roundRect(ctx, rim.mid, rim.mid, w - 2 * rim.mid, h - 2 * rim.mid, r - rim.mid / 2); ctx.stroke();
  if (frame.glow) { ctx.strokeStyle = GLOW_CORE; ctx.lineWidth = 0.35 * u; ctx.stroke(); }    // the rim's shine
  ctx.fillStyle = STOCK; ctx.beginPath(); roundRect(ctx, p, p, w - 2 * p, h - 2 * p, 2.5 * u); ctx.fill();
  if (frame.glow) {
    ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = colour; ctx.lineWidth = 2.4 * u;
    ctx.beginPath(); roundRect(ctx, p, p, w - 2 * p, h - 2 * p, 2.5 * u); ctx.stroke(); ctx.restore();
  }
  if (frame.double) {
    ctx.beginPath(); roundRect(ctx, p + 1.1 * u, p + 1.1 * u, w - 2 * p - 2.2 * u, h - 2 * p - 2.2 * u, 2 * u);
    ctx.strokeStyle = FRAME_DARK; ctx.lineWidth = 0.9 * u; ctx.stroke();
    ctx.strokeStyle = colour; ctx.lineWidth = 0.5 * u; ctx.stroke();
  }
  for (const [x, y] of L.studs) stud(ctx, x, y, L.studR, colour, u);
}

/** The art window: its ground by kind, a soft halo, the emblem large, the window's edge. */
function paintArt(ctx, L, emblem, colour) {
  const { u, win, art } = L, { cx, cy, size } = L.emblem;
  ctx.save();
  ctx.beginPath(); windowPath(ctx, L); ctx.clip();
  ctx.fillStyle = art.ground; ctx.fillRect(win.x, win.y, win.w, win.h);
  if (L.shape === 'landscape') { ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(win.x, win.y + win.h * 0.68, win.w, win.h * 0.32); }
  ctx.fillStyle = L.shape === 'arch' ? 'rgba(230,198,106,0.16)' : 'rgba(255,255,255,0.24)';
  ctx.beginPath(); ctx.arc(cx, cy, size * 0.6, 0, TAU); ctx.fill();
  EMBLEM_PAINTERS[emblem](ctx, cx, cy, size, art.ink);
  ctx.restore();
  ctx.strokeStyle = FRAME_DARK; ctx.lineWidth = 1.1 * u; ctx.beginPath(); windowPath(ctx, L); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = 0.5 * u; ctx.stroke();
  if (L.frame.glow) { ctx.strokeStyle = GLOW_CORE; ctx.lineWidth = 0.25 * u; ctx.stroke(); }
}

/** The name's banner: a swallow-tailed ribbon in the tier's colour, the name fitted inside its notches (B17). */
function paintBanner(ctx, L, name, colour) {
  const { u, banner: b, notch: n, nameBox: nb } = L;
  ctx.fillStyle = colour; ctx.strokeStyle = FRAME_DARK; ctx.lineWidth = 0.6 * u;
  ctx.beginPath();
  poly(ctx, [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w - n, b.y + b.h / 2], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h], [b.x + n, b.y + b.h / 2]]);
  ctx.fill(); ctx.stroke();
  const text = String(name ?? '');
  const { px, lines } = fitName(ctx, text, L);
  ctx.fillStyle = TEXT_INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lh = px * L.nameFont.lh, y0 = b.y + b.h / 2 + 0.03 * px - ((lines.length - 1) * lh) / 2;
  lines.forEach((t, i) => {
    const wide = (ctx.measureText(t)?.width ?? 0) > nb.w;
    if (wide) ctx.fillText(t, nb.x + nb.w / 2, y0 + i * lh, nb.w); else ctx.fillText(t, nb.x + nb.w / 2, y0 + i * lh);
  });
}

/**
 * The text box's lines: where line `i` of a block starting at `y0` (each `lh` tall) may run - the box's width, or,
 * for a line that passes beside the power shield, the width left of it (B2: only the shield's corner is cleared).
 */
function textSpan(L, y, lh) {
  const { u, box } = L, pad = 1.4 * u, left = box.x + pad, right = box.x + box.w - pad;
  const s = L.shield;
  if (s && y + lh > s.y - s.hh - 0.6 * u) return [left, Math.min(right, s.x - s.hw - 0.8 * u)];
  return [left, right];
}

/** Wrap `text` at the font now set into lines that start at `y0`, each held to its own span. */
function wrapAt(ctx, L, text, y0, lh) {
  return wrapCardText(ctx, text, (i) => { const [a, b] = textSpan(L, y0 + i * lh, lh); return b - a; });
}

/**
 * The rules in their box, shrunk to fit; the flavor in italics at the box's foot. B2: the flavor shrinks before it is
 * dropped, and the rules give up a little size to keep it; it goes only when the rules at 3.8u would not leave it room
 * at its floor (3u).
 */
function paintText(ctx, L, text, flavor) {
  const { u, box } = L;
  ctx.fillStyle = TEXT_BOX; ctx.strokeStyle = FRAME_DARK; ctx.lineWidth = 0.4 * u;
  ctx.beginPath(); roundRect(ctx, box.x, box.y, box.w, box.h, 1.5 * u); ctx.fill(); ctx.stroke();
  const pad = 1.4 * u, top = box.y + pad, bottom = box.y + box.h - pad * 0.6, gap = 0.8 * u;
  const rulesAt = (px) => { ctx.font = `${px}${FACE}`; return wrapAt(ctx, L, text, top, px * 1.15); };
  /** The flavor at `fpx`, anchored to the box's foot, below `above` - or null when it will not go. */
  const flavorAt = (fpx, above) => {
    ctx.font = `italic ${fpx}${FACE}`;
    const flh = fpx * 1.15;
    for (let k = 1; k <= 8; k++) {
      const y0 = bottom - k * flh;
      if (y0 < above + gap) return null;
      const fl = wrapAt(ctx, L, flavor, y0, flh);
      if (fl.length <= k) return { fpx, flh, lines: fl, y0 };
    }
    return null;
  };
  let pick = null, alone = null;
  for (let px = 5.2 * u; px >= 3.6 * u - 1e-9; px -= 0.2 * u) {
    const lines = rulesAt(px), end = top + lines.length * px * 1.15;
    if (end > bottom) continue;
    alone ??= { px, lines };
    if (!flavor) break;
    if (px < 3.8 * u - 1e-9) break;
    for (let fpx = Math.min(px * 0.9, 4.6 * u); fpx >= 3.0 * u - 1e-9; fpx -= 0.2 * u) {
      const f = flavorAt(fpx, end);
      if (f) { pick = { px, lines, f }; break; }
    }
    if (pick) break;
  }
  pick ??= alone && { ...alone, f: null };
  if (!pick) {   // the rules will not fit at their least: as many lines as there is room for, the last cut short
    const px = 3.6 * u, lh = px * 1.15, room = Math.max(0, Math.floor((bottom - top) / lh));
    let lines = rulesAt(px);
    if (lines.length > room) {
      lines = lines.slice(0, room);
      if (room) {
        const [a, b] = textSpan(L, top + (room - 1) * lh, lh);
        let last = lines[room - 1];
        while (last && (ctx.measureText(`${last}…`)?.width ?? 0) > b - a) last = last.slice(0, -1);
        lines[room - 1] = `${last}…`;
      }
    }
    pick = { px, lines, f: null };
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = `${pick.px}${FACE}`; ctx.fillStyle = TEXT_INK;
  const lh = pick.px * 1.15;
  pick.lines.forEach((t, i) => { const y = top + i * lh, [a, b] = textSpan(L, y, lh); ctx.fillText(t, (a + b) / 2, y); });
  if (!pick.f) return;   // no room: the flavor is the first to go
  const { fpx, flh, lines: fl, y0 } = pick.f;
  ctx.font = `italic ${fpx}${FACE}`; ctx.fillStyle = FLAVOR_INK;
  fl.forEach((t, i) => { const y = y0 + i * flh, [a, b] = textSpan(L, y, flh); ctx.fillText(t, (a + b) / 2, y); });
}

/**
 * The magicka gem top-left: a cut hexagon in blue, its crown facet lit, the cost on it. B15: the lit facet ends at
 * half the radius above the centre and the digit's em box starts below that, so the white is wholly on the dark blue.
 */
function paintGem(ctx, L, cost) {
  const { u, gem: g } = L, pts = [];
  for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 3; pts.push([g.x + Math.cos(a) * g.r, g.y + Math.sin(a) * g.r]); }
  ctx.fillStyle = COST_GEM; ctx.beginPath(); poly(ctx, pts); ctx.fill();
  ctx.fillStyle = COST_GEM_LIGHT; ctx.beginPath(); poly(ctx, [pts[5], pts[0], pts[1], [g.x, g.y - g.r * 0.62]]); ctx.fill();
  ctx.strokeStyle = FRAME_DARK; ctx.lineWidth = 0.6 * u; ctx.beginPath(); poly(ctx, pts); ctx.stroke();
  const t = String(cost ?? 0);
  ctx.fillStyle = GLOW_CORE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fitFont(ctx, t, g.r * 1.3, g.r * 1.05, g.r * 0.6, 'bold ');
  ctx.fillText(t, g.x, g.y + g.r * 0.16);
}

/** The power shield bottom-right: a heater shield in war-red, rimmed in gold, the power on it. */
function paintShield(ctx, L, power) {
  const { u, shield: s } = L, top = s.y - s.hh;
  ctx.fillStyle = POWER_SHIELD; ctx.strokeStyle = GOLD; ctx.lineWidth = 0.7 * u;
  ctx.beginPath();
  ctx.moveTo(s.x - s.hw, top); ctx.lineTo(s.x + s.hw, top); ctx.lineTo(s.x + s.hw, s.y);
  ctx.quadraticCurveTo(s.x + s.hw, s.y + s.hh * 0.7, s.x, s.y + s.hh); ctx.quadraticCurveTo(s.x - s.hw, s.y + s.hh * 0.7, s.x - s.hw, s.y);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  const t = String(power ?? 0);
  ctx.fillStyle = GLOW_CORE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fitFont(ctx, t, s.hw * 1.5, s.hh * 1.05, s.hh * 0.5, 'bold ');
  ctx.fillText(t, s.x, s.y - s.hh * 0.12);
}

/**
 * Paint one Iliac Hand card, filling (0, 0)-(w, h) of `ctx`: the frame in the tier's colour, the art window in the
 * kind's shape with the emblem in it, the name's banner, the rules and flavor (not on a tile), the cost gem (not a
 * location's) and the power shield (a unit's and a prince's only).
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ name?: string, kind?: string, cost?: number, power?: number|null, tier?: string, text?: string, emblem?: string, flavor?: string }} card
 * @param {number} w
 * @param {number} h
 */
export function paintIliacCard(ctx, card, w, h) {
  const kind = KIND_ART[card?.kind] ? card.kind : 'unit';
  const tier = RARITIES[card?.tier] ? card.tier : 'common';
  const colour = RARITIES[tier].colour;
  const L = iliacLayout(kind, tier, w, h);
  const emblem = EMBLEM_PAINTERS[card?.emblem] ? card.emblem : KIND_EMBLEM[kind];
  ctx.save();
  paintFrame(ctx, L, colour, w, h);
  paintArt(ctx, L, emblem, colour);
  paintBanner(ctx, L, card?.name, colour);
  if (L.box) paintText(ctx, L, card?.text ?? '', card?.flavor ?? '');
  if (L.gem) paintGem(ctx, L, card?.cost);
  if (L.shield) paintShield(ctx, L, card?.power);
  ctx.restore();
}

/**
 * Paint the back, filling (0, 0)-(w, h): the Bay's deep water swelling in gold, the compass rose that sails it - four
 * long points and four short, each half lit and half shadowed, a ring of bearings, north marked - and a wave in each
 * corner. Not the house deck's crimson medallion: a collectible card is never mistaken for a poker card face down.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 */
export function paintIliacBack(ctx, w, h) {
  const u = h / 100, edge = 3 * u, r = 4 * u;
  ctx.save();
  ctx.fillStyle = FRAME_DARK; ctx.beginPath(); roundRect(ctx, 0, 0, w, h, r); ctx.fill();
  ctx.fillStyle = BACK_FIELD; ctx.beginPath(); roundRect(ctx, edge, edge, w - 2 * edge, h - 2 * edge, r - edge / 2); ctx.fill();
  ctx.save();
  ctx.beginPath(); roundRect(ctx, edge, edge, w - 2 * edge, h - 2 * edge, r - edge / 2); ctx.clip();
  ctx.strokeStyle = 'rgba(201,162,74,0.28)'; ctx.lineWidth = 0.6 * u;
  for (let y = edge + 4 * u, row = 0; y < h; y += 6 * u, row++) {
    ctx.beginPath(); ctx.moveTo(-6 * u + (row % 2) * 3 * u, y);
    for (let x = -6 * u + (row % 2) * 3 * u; x < w + 6 * u; x += 6 * u) ctx.quadraticCurveTo(x + 3 * u, y - 2 * u, x + 6 * u, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1.2 * u;
  ctx.beginPath(); roundRect(ctx, edge + 2.5 * u, edge + 2.5 * u, w - 2 * edge - 5 * u, h - 2 * edge - 5 * u, 2 * u); ctx.stroke();
  for (const [x, y] of [[edge + 8 * u, edge + 8 * u], [w - edge - 8 * u, edge + 8 * u], [edge + 8 * u, h - edge - 8 * u], [w - edge - 8 * u, h - edge - 8 * u]]) {
    ctx.save(); ctx.globalAlpha = 0.8; EMBLEM_PAINTERS.sea(ctx, x, y, 8 * u, GOLD); ctx.restore();
  }
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36;
  ctx.translate(cx, cy);
  ctx.fillStyle = BACK_FIELD; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1.4 * u; ctx.stroke();
  ctx.lineWidth = 0.6 * u; ctx.beginPath(); ctx.arc(0, 0, R * 0.86, 0, TAU); ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k < 32; k++) {
    const a = (k * TAU) / 32, r0 = k % 4 ? R * 0.92 : R * 0.86;
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
  }
  ctx.stroke();
  // the rose: the short points first, the four quarters over them, each point lit on one side and shadowed on the other
  for (const [len, base, from] of [[R * 0.6, R * 0.12, Math.PI / 4], [R * 0.98, R * 0.16, 0]]) {
    for (let k = 0; k < 4; k++) {
      const a = from + (k * Math.PI) / 2 - Math.PI / 2;
      const tip = [Math.cos(a) * len, Math.sin(a) * len];
      const l = [Math.cos(a - Math.PI / 2) * base, Math.sin(a - Math.PI / 2) * base];
      const rgt = [Math.cos(a + Math.PI / 2) * base, Math.sin(a + Math.PI / 2) * base];
      ctx.fillStyle = GOLD; ctx.beginPath(); poly(ctx, [[0, 0], l, tip]); ctx.fill();
      ctx.fillStyle = GOLD_DARK; ctx.beginPath(); poly(ctx, [[0, 0], tip, rgt]); ctx.fill();
    }
  }
  ctx.fillStyle = BACK_FIELD; ctx.beginPath(); ctx.arc(0, 0, R * 0.09, 0, TAU); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 0.8 * u; ctx.stroke();
  ctx.fillStyle = GOLD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${5 * u}px Georgia, serif`;
  ctx.fillText('N', 0, -R - 4 * u);
  ctx.restore();
}
