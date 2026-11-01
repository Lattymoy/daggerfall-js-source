// OWN-WORK4 (2026-10-31; bible/06-Systems/Foraging.md): THE SEVEN FORAGING PICTURES, OUR OWN. Each tool, the wood
// bundle and the egg is a recipe for our painter (art/ownPainter.js) at the size and archive the game reads
// (`<archive>_0-0`, 64 x 64, the Fishing-Net 128 x 128). No pixel of the retired release is read.
import { createPainter, RAMP, ellipse, poly, stroke, union } from '../../art/ownPainter.js';

/** A frame along a tool's handle: `u` up the handle from (ox, oy) toward (tx, ty), `v` across it to the right. */
const along = (ox, oy, tx, ty) => {
  const len = Math.hypot(tx - ox, ty - oy),
    dx = (tx - ox) / len,
    dy = (ty - oy) / len;
  return (u, v) => [ox + u * dx - v * dy, oy + u * dy + v * dx];
};
const ptsOf = (T, uvs) => uvs.map(([u, v]) => T(u, v));

function woodAxe() {
  const p = createPainter(64, 64);
  const T = along(12, 60, 44, 8);
  p.fill(stroke([T(0, 0), T(30, 0.6), T(58, 0)], 2.6, 2.2), RAMP.wood, { seed: 1, rough: 0.25 });
  p.fill(
    poly(
      ptsOf(T, [
        [44, -3],
        [55, -3],
        [61, -12],
        [61, -20],
        [52, -17],
        [43, -17],
        [37, -20],
        [38, -12],
      ]),
    ),
    RAMP.iron,
    { gain: 1.2 },
  );
  p.fill(
    poly(
      ptsOf(T, [
        [61, -12],
        [61, -20],
        [59, -20],
        [59, -12],
      ]),
    ),
    RAMP.steel,
    { bias: 0.25 },
  );
  p.fill(
    poly(
      ptsOf(T, [
        [44, -3],
        [55, -3],
        [55, 5],
        [44, 5],
      ]),
    ),
    RAMP.iron,
    { bias: -0.08 },
  );
  p.fill(stroke([T(52, 0), T(58, 0)], 1.4), RAMP.wood, { bias: -0.2 });
  p.outline();
  return p.picture();
}

function pickAxe() {
  const p = createPainter(64, 64);
  const T = along(10, 60, 46, 14);
  p.fill(stroke([T(0, 0), T(30, 0.5), T(54, 0)], 2.6, 2.4), RAMP.wood, { seed: 2, rough: 0.25 });
  const head = [T(50, 0)];
  p.fill(stroke([head[0], T(53, -10), T(52, -19), T(48, -27)], 4.2, 0.8), RAMP.iron, { gain: 1.2 });
  p.fill(stroke([head[0], T(53, 10), T(52, 19), T(48, 27)], 4.2, 0.8), RAMP.iron, { gain: 1.2 });
  p.fill(ellipse(...T(51, 0), 5, 5), RAMP.iron, { bias: -0.05 });
  p.fill(stroke([T(54, -6), T(53, -16)], 0.7), RAMP.steel, { bias: 0.3, over: true });
  p.outline();
  return p.picture();
}

function sickle() {
  const p = createPainter(64, 64);
  const T = along(8, 58, 22, 40);
  p.fill(stroke([T(0, 0), T(18, 0)], 3.4, 3), RAMP.wood, { seed: 3, rough: 0.3 });
  p.fill(stroke([T(1, 0), T(2.5, 0)], 3.6), RAMP.leather, { bias: -0.1 });
  p.fill(stroke([T(16, 0), T(19, 0)], 3.4), RAMP.iron, { bias: -0.1 });
  const arc = [T(18, 0), [18, 34], [19, 24], [25, 15], [34, 10], [44, 9], [53, 13], [58, 20], [59, 27]];
  p.fill(stroke(arc, 3.8, 0.6), RAMP.steel, { gain: 0.9, bias: -0.05 });
  p.fill(stroke(arc.slice(2, 7), 1.2, 0.5), RAMP.steel, { bias: 0.3, over: true });
  p.fill(stroke([T(17, 0), T(21, 0)], 2.6), RAMP.iron);
  p.outline();
  return p.picture();
}

function fishingNet() {
  const p = createPainter(128, 128);
  const body = union(union(ellipse(66, 74, 50, 38, -0.2), ellipse(44, 92, 30, 26)), ellipse(88, 52, 30, 26));
  p.fill(
    stroke(
      [
        [14, 96],
        [20, 110],
        [36, 118],
        [60, 114],
        [88, 100],
        [112, 76],
        [118, 50],
      ],
      2.2,
    ),
    RAMP.rope,
    { bias: -0.05 },
  );
  p.fill(
    stroke(
      [
        [16, 66],
        [40, 44],
        [70, 30],
        [104, 26],
        [118, 34],
      ],
      2.6,
    ),
    RAMP.rope,
    { bias: 0.05 },
  );
  for (const [x, y] of [
    [24, 58],
    [46, 40],
    [72, 29],
    [98, 26],
    [116, 33],
  ])
    p.fill(ellipse(x, y, 5, 3.6, -0.4), RAMP.wood, { bias: 0.1 });
  p.outline({ keep: 0.4 });
  // the mesh after the rim, so a cord is never darkened as an edge: two diagonals every 11 pixels, the holes clear
  const on = (k) => ((k % 11) + 11) % 11 < 2;
  const cord = ({ px, py, t }) =>
    on(px + py) || on(px - py) ? RAMP.rope[Math.min(5, Math.floor(t * 4 + (on(px - py) ? 0.6 : 1.4)))] : null;
  p.fill(body, cord, { under: true, gain: 1.1 });
  return p.picture();
}

function woodBundle() {
  const p = createPainter(64, 64);
  const logs = [
    [12, 46, 50, 34, 6.5],
    [10, 36, 48, 24, 6],
    [18, 54, 56, 42, 6],
    [16, 26, 52, 16, 5.5],
  ];
  for (const [x0, y0, x1, y1, r] of logs) {
    p.fill(
      stroke(
        [
          [x0, y0],
          [x1, y1],
        ],
        r,
      ),
      RAMP.wood,
      { seed: x0 + y0, rough: 0.35 },
    );
    p.fill(ellipse(x1, y1, r * 0.75, r, 0.3), RAMP.pale, { bias: 0.15 });
    p.fill(ellipse(x1, y1, r * 0.3, r * 0.42, 0.3), RAMP.pale, { bias: -0.35 });
  }
  p.fill(
    stroke(
      [
        [25, 16],
        [27, 58],
      ],
      1.6,
    ),
    RAMP.rope,
    { bias: 0.1 },
  );
  p.fill(
    stroke(
      [
        [37, 12],
        [39, 54],
      ],
      1.6,
    ),
    RAMP.rope,
    { bias: 0.1 },
  );
  p.outline();
  return p.picture();
}

function egg() {
  const p = createPainter(64, 64);
  const shell = union(ellipse(32, 38, 15, 16), ellipse(32, 30, 12.5, 17));
  p.fill(shell, RAMP.egg, { seed: 5, rough: 0.12, gain: 1.15 });
  p.fill(shell, ({ px, py }) => ((px * 7 + py * 13) % 23 === 0 ? RAMP.egg[1] : null), { over: true });
  p.fill(ellipse(26, 24, 3, 5, -0.4), RAMP.egg[5], { over: true });
  p.outline({ keep: 0.45 });
  return p.picture();
}

function spade() {
  const p = createPainter(64, 64);
  const T = along(52, 8, 18, 50);
  p.fill(stroke([T(-2, -6), T(-2, 6)], 2.2), RAMP.wood, { bias: 0.05 });
  p.fill(stroke([T(0, 0), T(30, 0)], 2.4), RAMP.wood, { seed: 7, rough: 0.25 });
  p.fill(
    poly(
      ptsOf(T, [
        [28, -3],
        [32, -3],
        [32, 3],
        [28, 3],
      ]),
    ),
    RAMP.iron,
    { bias: -0.1 },
  );
  p.fill(
    poly(
      ptsOf(T, [
        [31, -9],
        [31, 9],
        [46, 9],
        [53, 4],
        [55, 0],
        [53, -4],
        [46, -9],
      ]),
    ),
    RAMP.iron,
    { gain: 1.25 },
  );
  p.fill(stroke([T(47, -7), T(53, -1)], 0.7), RAMP.steel, { bias: 0.3, over: true });
  p.outline();
  return p.picture();
}

/** Each picture's recipe, by its archive (record 0, frame 0). */
export const FORAGING_ART = Object.freeze({
  11600: woodAxe,
  11601: pickAxe,
  11602: sickle,
  11603: fishingNet,
  11604: woodBundle,
  11605: egg,
  11606: spade,
});
/** Our picture for `archive`, top-down RGBA - or null where it is not one of the seven. */
export const foragingPicture = (archive) => FORAGING_ART[archive]?.() ?? null;
