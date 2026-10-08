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
// SCALE: every measure is in u = h / 100, so one painter serves a 70 x 100 tile in the binder's grid and a 350 x 500
// card held up to read; the text shrinks to fit its box and the flavor is dropped when it does not.
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
  insect(ctx) {       // a beetle: the shell split down its back, the head, six legs and the feelers
    oval(ctx, 0, 0.08, 0.24, 0.32);
    poly(ctx, [[-0.015, -0.18], [0.015, -0.18], [0.015, 0.34], [-0.015, 0.34]]);
    part(ctx, 'evenodd');
    circ(ctx, 0, -0.36, 0.11); part(ctx);
    for (const m of [1, -1]) {
      ctx.moveTo(0.2 * m, -0.06); ctx.lineTo(0.38 * m, -0.2); ctx.lineTo(0.44 * m, -0.3);
      ctx.moveTo(0.23 * m, 0.08); ctx.lineTo(0.46 * m, 0.1);
      ctx.moveTo(0.2 * m, 0.24); ctx.lineTo(0.38 * m, 0.38); ctx.lineTo(0.42 * m, 0.47);
      ctx.moveTo(0.05 * m, -0.45); ctx.quadraticCurveTo(0.1 * m, -0.5, 0.22 * m, -0.48);
    }
    line(ctx, 0.05);
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
  harpy(ctx) {        // a feathered wing over a taloned foot
    ctx.moveTo(-0.36, 0.0); ctx.quadraticCurveTo(-0.1, -0.5, 0.46, -0.42);
    for (const [x, y] of [[0.38, -0.28], [0.3, -0.3], [0.24, -0.14], [0.14, -0.18], [0.08, 0.0], [-0.02, -0.04], [-0.1, 0.12], [-0.2, 0.06], [-0.3, 0.14]]) ctx.lineTo(x, y);
    ctx.closePath(); part(ctx);
    ctx.moveTo(-0.22, 0.1); ctx.lineTo(0, 0.3);
    ctx.moveTo(0, 0.3); ctx.quadraticCurveTo(-0.14, 0.32, -0.14, 0.46);
    ctx.moveTo(0, 0.3); ctx.quadraticCurveTo(0.04, 0.4, -0.01, 0.48);
    ctx.moveTo(0, 0.3); ctx.quadraticCurveTo(0.16, 0.32, 0.18, 0.44);
    line(ctx, 0.06);
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

/** The emblem a card without a known one is drawn with, by kind - a gap in the catalog shows, it does not throw. */
const KIND_EMBLEM = Object.freeze({ unit: 'warrior', spell: 'shock', prince: 'prince', location: 'city' });

// ---- the words ----------------------------------------------------------------------------------------------------

/**
 * Break `text` into lines no wider than `maxWidth` by the context's own measure (its current font): words go whole
 * where they fit, a word wider than the line is broken by letters, and a newline in the text always breaks.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
export function wrapCardText(ctx, text, maxWidth) {
  const width = (t) => ctx.measureText(t)?.width ?? 0;
  const lines = [];
  for (const para of String(text ?? '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = '';
    for (const word of words) {
      const next = cur ? `${cur} ${word}` : word;
      if (width(next) <= maxWidth) { cur = next; continue; }
      if (cur) lines.push(cur);
      cur = '';
      if (width(word) <= maxWidth) { cur = word; continue; }
      let piece = '';   // the word is wider than a line: break it by letters, at least one to a line
      for (const ch of word) {
        if (piece && width(piece + ch) > maxWidth) { lines.push(piece); piece = ''; }
        piece += ch;
      }
      cur = piece;
    }
    if (cur || !words.length) lines.push(cur);
  }
  return lines;
}

/** Shrink a font from `px` until `text` fits `maxW`, down to `minPx`; returns the size set. */
function fitFont(ctx, text, maxW, px, minPx, style) {
  let p = px;
  ctx.font = `${style}${p}px Georgia, serif`;
  while (p > minPx && (ctx.measureText(text)?.width ?? 0) > maxW) { p = Math.max(minPx, p * 0.9); ctx.font = `${style}${p}px Georgia, serif`; }
  return p;
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

/**
 * Where a card's parts sit at w x h: the panel's inset, the art window (x, y, w, h and its shape), the banner, the text
 * box, the gem's and the shield's centres (null where the kind has none). Pure - the painter and the pins both read it.
 * @param {string} kind
 * @param {string} tier
 * @param {number} w
 * @param {number} h
 */
export function iliacLayout(kind, tier, w, h) {
  const u = h / 100, art = KIND_ART[kind] ?? KIND_ART.unit, frame = TIER_FRAMES[tier] ?? TIER_FRAMES.common;
  const p = (1 + frame.band + 0.8) * u, innerW = w - 2 * p;
  const landscape = art.window === 'landscape';
  const banner = landscape ? { x: p + 1 * u, y: p + 1.2 * u, w: innerW - 2 * u, h: 9 * u } : { x: p + 1 * u, y: 58 * u, w: innerW - 2 * u, h: 9 * u };
  let win;
  if (landscape) win = { x: p + 1.5 * u, y: banner.y + banner.h + 2.5 * u, w: innerW - 3 * u, h: 36 * u };
  else if (art.window === 'square') { const s = Math.min(44 * u, innerW - 4 * u); win = { x: (w - s) / 2, y: 13 * u, w: s, h: s }; }
  else win = { x: p + 2 * u, y: 13 * u, w: innerW - 4 * u, h: 44 * u };
  const box = { x: p + 2 * u, y: landscape ? win.y + win.h + 3 * u : 68.5 * u, w: innerW - 4 * u, h: 0 };
  box.h = h - p - 2 * u - box.y;
  const gem = art.cost ? { x: p + 4.2 * u, y: p + 4.2 * u, r: 6.2 * u } : null;
  const shield = art.power ? { x: w - p - 4.5 * u, y: h - p - 1.5 * u, hw: 5.5 * u, hh: 6.5 * u } : null;
  return { u, p, frame, art, win, banner, box, gem, shield, shape: art.window };
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

/** The frame: the card's dark edge, the rim in the tier's colour (heavier the higher the tier), its studs, the panel. */
function paintFrame(ctx, L, colour, w, h) {
  const { u, p, frame } = L, r = 4 * u;
  ctx.fillStyle = FRAME_DARK; ctx.beginPath(); roundRect(ctx, 0, 0, w, h, r); ctx.fill();
  const mid = (1 + frame.band / 2) * u;
  ctx.strokeStyle = colour; ctx.lineWidth = frame.band * u;
  ctx.beginPath(); roundRect(ctx, mid, mid, w - 2 * mid, h - 2 * mid, r - mid / 2); ctx.stroke();
  ctx.fillStyle = STOCK; ctx.beginPath(); roundRect(ctx, p, p, w - 2 * p, h - 2 * p, 2.5 * u); ctx.fill();
  if (frame.double) {
    ctx.strokeStyle = colour; ctx.lineWidth = 0.5 * u;
    ctx.beginPath(); roundRect(ctx, p + 1.1 * u, p + 1.1 * u, w - 2 * p - 2.2 * u, h - 2 * p - 2.2 * u, 2 * u); ctx.stroke();
  }
  if (frame.glow) {
    ctx.save(); ctx.globalAlpha = 0.45; ctx.strokeStyle = colour; ctx.lineWidth = 2.4 * u;
    ctx.beginPath(); roundRect(ctx, p, p, w - 2 * p, h - 2 * p, 2.5 * u); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = GLOW_CORE; ctx.lineWidth = 0.5 * u;
    ctx.beginPath(); roundRect(ctx, p + 0.4 * u, p + 0.4 * u, w - 2 * p - 0.8 * u, h - 2 * p - 0.8 * u, 2.3 * u); ctx.stroke();
  }
  const sr = (frame.band * 0.7 + 0.8) * u;
  const corners = [[mid, mid], [w - mid, mid], [mid, h - mid], [w - mid, h - mid]];
  const sides = [[w / 2, mid], [w / 2, h - mid], [mid, h / 2], [w - mid, h / 2]];
  for (const [x, y] of [...corners, ...sides].slice(0, frame.studs)) stud(ctx, x, y, sr, colour, u);
}

/** The art window: its ground by kind, a soft halo, the emblem large, the window's edge. */
function paintArt(ctx, L, emblem, colour) {
  const { u, win, art } = L;
  ctx.save();
  ctx.beginPath(); windowPath(ctx, L); ctx.clip();
  ctx.fillStyle = art.ground; ctx.fillRect(win.x, win.y, win.w, win.h);
  if (L.shape === 'landscape') { ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(win.x, win.y + win.h * 0.68, win.w, win.h * 0.32); }
  const cx = win.x + win.w / 2, cy = win.y + win.h / 2 + (L.shape === 'arch' ? win.h * 0.06 : 0);
  const size = Math.min(win.w, win.h) * (L.shape === 'landscape' ? 0.86 : 0.78);
  ctx.fillStyle = L.shape === 'arch' ? 'rgba(230,198,106,0.16)' : 'rgba(255,255,255,0.24)';
  ctx.beginPath(); ctx.arc(cx, cy, size * 0.6, 0, TAU); ctx.fill();
  EMBLEM_PAINTERS[emblem](ctx, cx, cy, size, art.ink);
  ctx.restore();
  ctx.strokeStyle = FRAME_DARK; ctx.lineWidth = 1.1 * u; ctx.beginPath(); windowPath(ctx, L); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = 0.5 * u; ctx.stroke();
  if (L.frame.glow) { ctx.strokeStyle = GLOW_CORE; ctx.lineWidth = 0.25 * u; ctx.stroke(); }
}

/** The name's banner: a swallow-tailed ribbon in the tier's colour, the name fitted across it. */
function paintBanner(ctx, L, name, colour) {
  const { u, banner: b } = L, n = 2.2 * u;
  ctx.fillStyle = colour; ctx.strokeStyle = FRAME_DARK; ctx.lineWidth = 0.6 * u;
  ctx.beginPath();
  poly(ctx, [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w - n, b.y + b.h / 2], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h], [b.x + n, b.y + b.h / 2]]);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = TEXT_INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const text = String(name ?? '');
  fitFont(ctx, text, b.w - 2 * n - 2 * u, 5.6 * u, 3 * u, 'bold ');
  ctx.fillText(text, b.x + b.w / 2, b.y + b.h / 2 + 0.3 * u);
}

/** The rules in their box, shrunk to fit; the flavor in italics beneath when there is room for it. */
function paintText(ctx, L, text, flavor) {
  const { u, box } = L;
  ctx.fillStyle = TEXT_BOX; ctx.strokeStyle = FRAME_DARK; ctx.lineWidth = 0.4 * u;
  ctx.beginPath(); roundRect(ctx, box.x, box.y, box.w, box.h, 1.5 * u); ctx.fill(); ctx.stroke();
  const pad = 1.4 * u, maxW = box.w - 2 * pad, top = box.y + pad;
  const bottom = (L.shield ? Math.min(box.y + box.h, L.shield.y - L.shield.hh - 0.5 * u) : box.y + box.h) - pad * 0.6;
  const avail = bottom - top;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  let px = 5.2 * u, lines = [];
  for (;;) {
    ctx.font = `${px}px Georgia, serif`;
    lines = wrapCardText(ctx, text, maxW);
    if (lines.length * px * 1.15 <= avail || px <= 3.6 * u) break;
    px = Math.max(3.6 * u, px - 0.3 * u);
  }
  const lh = px * 1.15, room = Math.max(0, Math.floor(avail / lh));
  if (lines.length > room) {
    lines = lines.slice(0, room);
    if (room) {
      let last = lines[room - 1];
      while (last && (ctx.measureText(`${last}…`)?.width ?? 0) > maxW) last = last.slice(0, -1);
      lines[room - 1] = `${last}…`;
    }
  }
  ctx.fillStyle = TEXT_INK;
  lines.forEach((t, i) => ctx.fillText(t, box.x + box.w / 2, top + i * lh));
  if (!flavor) return;
  const fpx = Math.min(px * 0.9, 4.6 * u);
  ctx.font = `italic ${fpx}px Georgia, serif`;
  const flines = wrapCardText(ctx, flavor, maxW), flh = fpx * 1.15;
  if (lines.length * lh + 0.8 * u + flines.length * flh > avail) return;   // no room: the flavor is the first to go
  ctx.fillStyle = FLAVOR_INK;
  const fy = bottom - flines.length * flh;
  flines.forEach((t, i) => ctx.fillText(t, box.x + box.w / 2, fy + i * flh));
}

/** The magicka gem top-left: a cut hexagon in blue, its upper facets lit, the cost on it. */
function paintGem(ctx, L, cost) {
  const { u, gem: g } = L, pts = [];
  for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 3; pts.push([g.x + Math.cos(a) * g.r, g.y + Math.sin(a) * g.r]); }
  ctx.fillStyle = COST_GEM; ctx.beginPath(); poly(ctx, pts); ctx.fill();
  ctx.fillStyle = COST_GEM_LIGHT; ctx.beginPath(); poly(ctx, [pts[5], pts[0], pts[1], [g.x, g.y - g.r * 0.2]]); ctx.fill();
  ctx.strokeStyle = FRAME_DARK; ctx.lineWidth = 0.6 * u; ctx.beginPath(); poly(ctx, pts); ctx.stroke();
  const t = String(cost ?? 0);
  ctx.fillStyle = GLOW_CORE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fitFont(ctx, t, g.r * 1.4, 7 * u, 3 * u, 'bold ');
  ctx.fillText(t, g.x, g.y + 0.4 * u);
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
  fitFont(ctx, t, s.hw * 1.5, 7 * u, 3 * u, 'bold ');
  ctx.fillText(t, s.x, s.y - 0.4 * u);
}

/**
 * Paint one Iliac Hand card, filling (0, 0)-(w, h) of `ctx`: the frame in the tier's colour, the art window in the
 * kind's shape with the emblem in it, the name's banner, the rules and flavor, the cost gem (not a location's) and the
 * power shield (a unit's and a prince's only).
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
  paintText(ctx, L, card?.text ?? '', card?.flavor ?? '');
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
