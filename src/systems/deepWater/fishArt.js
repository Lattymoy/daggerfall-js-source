// THE SEVEN FISH, OUR OWN PICTURES. Each species is a recipe for our painter (art/ownPainter.js), keyed by the
// texture name the species reads, at the power-of-two size the sea samples. A fish is drawn in the shape it shows
// (its billboard's aspect, `space`) and sampled at its picture's size, so restoreIconAspect gives its icon that shape
// back. All face left. No pixel of the retired release is read.
import { createPainter, RAMP, ellipse, poly, stroke, union, rampShade } from '../../art/ownPainter.js';

/** A body lit from above: `back` over the line `split` (a y), `belly` under it. */
const twoTone =
  (back, belly, split) =>
  ({ y, px, py, t: light }) =>
    rampShade(y < split ? back : belly, light, px, py);
/** The eye at (x, y), `radius` round: dark, its rim pale, one glint. */
function eye(painter, x, y, radius, rim = RAMP.white) {
  painter.fill(ellipse(x, y, radius, radius), rim[2]);
  painter.fill(ellipse(x, y, radius * 0.66, radius * 0.66), RAMP.black[0]);
  painter.fill(
    ellipse(x - radius * 0.3, y - radius * 0.3, Math.max(0.5, radius * 0.25), Math.max(0.5, radius * 0.25)),
    RAMP.white[5],
  );
}

function butterflyfish(queue = null) {
  const painter = createPainter(64, 64, { space: [89, 64], queue });
  const body = ellipse(50, 33, 25, 21);
  painter.fill(
    poly([
      [30, 18],
      [44, 8],
      [64, 9],
      [76, 22],
      [60, 18],
    ]),
    RAMP.yellow,
    { gain: 0.6 },
  );
  painter.fill(
    poly([
      [40, 50],
      [70, 44],
      [74, 54],
      [56, 60],
    ]),
    RAMP.yellow,
    { gain: 0.6, bias: -0.1 },
  );
  painter.fill(
    poly([
      [72, 33],
      [86, 22],
      [88, 44],
    ]),
    RAMP.yellow,
    { gain: 0.5, bias: 0.05 },
  );
  painter.fill(body, twoTone(RAMP.yellow, RAMP.white, 51), { gain: 1.1 });
  painter.fill(
    stroke(
      [
        [28, 31],
        [5, 32],
      ],
      3,
      1.6,
    ),
    RAMP.yellow,
    { bias: -0.05 },
  );
  painter.fill(
    stroke(
      [
        [34, 14],
        [36, 30],
        [33, 46],
      ],
      3.6,
    ),
    RAMP.black,
    { over: true },
  );
  painter.fill(ellipse(66, 46, 3, 3), RAMP.black[1], { over: true });
  eye(painter, 34, 29, 3.4);
  painter.outline({ keep: 0.35 });
  return painter.picture();
}

function bass(queue = null) {
  const painter = createPainter(64, 32, { space: [73, 32], queue });
  const body = union(ellipse(34, 17, 27, 10), ellipse(22, 16, 16, 10.5));
  painter.fill(
    poly([
      [22, 8],
      [30, 2],
      [46, 4],
      [52, 9],
    ]),
    RAMP.olive,
    { gain: 0.6, bias: -0.1 },
  );
  painter.fill(
    poly([
      [40, 24],
      [52, 23],
      [50, 30],
    ]),
    RAMP.olive,
    { gain: 0.6 },
  );
  painter.fill(
    poly([
      [57, 17],
      [71, 6],
      [68, 17],
      [71, 28],
    ]),
    RAMP.ember,
    { gain: 0.6 },
  );
  painter.fill(body, twoTone(RAMP.olive, RAMP.pale, 19), { gain: 1.1 });
  painter.fill(
    stroke(
      [
        [16, 16],
        [30, 17],
        [44, 16],
        [58, 17],
      ],
      1.8,
    ),
    RAMP.olive.slice(0, 3),
    { over: true, seed: 2, rough: 0.6 },
  );
  painter.fill(
    stroke(
      [
        [4, 16],
        [12, 19],
      ],
      1.1,
    ),
    RAMP.black[1],
    { over: true },
  );
  painter.fill(
    stroke(
      [
        [17, 9],
        [19, 16],
        [17, 23],
      ],
      0.7,
    ),
    RAMP.olive[1],
    { over: true },
  );
  eye(painter, 10, 12, 2.4, RAMP.yellow);
  painter.outline({ keep: 0.35 });
  return painter.picture();
}

function rockfish(queue = null) {
  const painter = createPainter(32, 16, { space: [44, 16], queue });
  const body = union(ellipse(21, 8.5, 16, 5.6), ellipse(13, 8, 10, 6));
  painter.fill(
    poly([
      [10, 4],
      [16, 0.5],
      [26, 1.5],
      [32, 4],
    ]),
    RAMP.ember,
    { gain: 0.5, bias: 0.05 },
  );
  painter.fill(
    poly([
      [34, 8.5],
      [43, 2],
      [43, 15],
    ]),
    RAMP.ember,
    { gain: 0.5 },
  );
  painter.fill(body, twoTone(RAMP.ember, RAMP.yellow, 10), { gain: 1.1 });
  painter.fill(
    stroke(
      [
        [12, 8],
        [34, 8.5],
      ],
      0.5,
    ),
    RAMP.ember[2],
    { over: true },
  );
  eye(painter, 7, 6.5, 1.8, RAMP.yellow);
  painter.outline({ keep: 0.35 });
  return painter.picture();
}

function carp(queue = null) {
  const painter = createPainter(32, 32, { space: [52, 32], queue });
  const body = ellipse(25, 17, 20, 11);
  painter.fill(
    poly([
      [16, 8],
      [24, 2],
      [38, 4],
      [40, 10],
    ]),
    RAMP.bronze,
    { gain: 0.5, bias: -0.1 },
  );
  painter.fill(
    poly([
      [42, 17],
      [51, 7],
      [48, 17],
      [51, 28],
    ]),
    RAMP.bronze,
    { gain: 0.5 },
  );
  painter.fill(
    poly([
      [26, 26],
      [34, 26],
      [32, 31],
    ]),
    RAMP.bronze,
    { gain: 0.5 },
  );
  painter.fill(body, twoTone(RAMP.bronze, RAMP.gold, 21), { gain: 1.1 });
  const scale = ({ px, py, t: light }) =>
    (px + (py >> 1)) % 3 === 0 && py % 2 === 0 ? rampShade(RAMP.bronze, light - 0.25, px, py) : null;
  painter.fill(ellipse(27, 17, 15, 8), scale, { over: true });
  painter.fill(
    stroke(
      [
        [13, 9],
        [15, 17],
        [13, 25],
      ],
      0.8,
    ),
    RAMP.bronze[1],
    { over: true },
  );
  eye(painter, 9, 14, 2.2, RAMP.gold);
  painter.outline({ keep: 0.35 });
  return painter.picture();
}

function mackerel(queue = null) {
  const painter = createPainter(32, 16, { space: [36, 16], queue });
  const body = union(ellipse(16, 8, 13, 4.4), ellipse(10, 8, 8, 4.6));
  painter.fill(
    poly([
      [27, 8],
      [35, 2],
      [32, 8],
      [35, 14],
    ]),
    RAMP.sea,
    { gain: 0.5 },
  );
  painter.fill(
    poly([
      [12, 4],
      [16, 1.5],
      [20, 4],
    ]),
    RAMP.sea,
    { gain: 0.5, bias: -0.1 },
  );
  painter.fill(body, twoTone(RAMP.sea, RAMP.white, 8.5), { gain: 1.1 });
  const bars = ({ x, y, px, py, t: light }) =>
    y < 7.5 && Math.floor(x + Math.abs(y - 5) * 1.5) % 4 < 1.5 ? rampShade(RAMP.black, light + 0.2, px, py) : null;
  painter.fill(body, bars, { over: true });
  eye(painter, 5, 7, 1.4);
  painter.outline({ keep: 0.35 });
  return painter.picture();
}

function angelfish(queue = null) {
  const painter = createPainter(32, 64, { space: [40, 64], queue });
  painter.fill(
    poly([
      [11, 22],
      [19, 6],
      [25, 1],
      [29, 4],
      [27, 26],
    ]),
    RAMP.white,
    { gain: 0.6, bias: -0.1 },
  );
  painter.fill(
    poly([
      [11, 42],
      [19, 58],
      [25, 63],
      [29, 60],
      [27, 38],
    ]),
    RAMP.white,
    { gain: 0.6, bias: -0.15 },
  );
  painter.fill(
    poly([
      [28, 32],
      [38, 24],
      [39, 40],
    ]),
    RAMP.white,
    { gain: 0.5, bias: -0.05 },
  );
  painter.fill(
    poly([
      [4, 32],
      [16, 18],
      [30, 32],
      [16, 46],
    ]),
    RAMP.white,
    { gain: 1.1 },
  );
  painter.fill(ellipse(17, 32, 11, 11), RAMP.white, { gain: 1.1 });
  const bands = ({ x, px, py, t: light }) =>
    (x > 9.5 && x < 13.5) || (x > 18 && x < 23) || (x > 27 && x < 31) ? rampShade(RAMP.black, light, px, py) : null;
  painter.fill(
    poly([
      [0, 0],
      [40, 0],
      [40, 64],
      [0, 64],
    ]),
    bands,
    { over: true },
  );
  eye(painter, 8, 30, 2.1, RAMP.white);
  painter.outline({ keep: 0.35 });
  return painter.picture();
}

function grouper(queue = null) {
  const painter = createPainter(32, 32, { space: [55, 32], queue });
  const body = union(ellipse(28, 17, 23, 11), ellipse(16, 17, 14, 12));
  painter.fill(
    poly([
      [18, 7],
      [26, 2],
      [42, 4],
      [46, 9],
    ]),
    RAMP.grey,
    { gain: 0.5, bias: -0.05 },
  );
  painter.fill(
    poly([
      [47, 17],
      [54, 9],
      [55, 25],
    ]),
    RAMP.grey,
    { gain: 0.5 },
  );
  painter.fill(
    poly([
      [30, 26],
      [40, 26],
      [36, 31],
    ]),
    RAMP.grey,
    { gain: 0.5, bias: -0.1 },
  );
  painter.fill(body, twoTone(RAMP.grey, RAMP.white, 21), { gain: 1.1 });
  const spots = ({ px, py, t: light }) =>
    (px * 5 + py * 3) % 11 === 0 ? rampShade(RAMP.grey, light - 0.3, px, py) : null;
  painter.fill(body, spots, { over: true });
  painter.fill(
    stroke(
      [
        [3, 19],
        [12, 22],
      ],
      1.3,
    ),
    RAMP.black[1],
    { over: true },
  );
  eye(painter, 10, 13, 2.4, RAMP.yellow);
  painter.outline({ keep: 0.35 });
  return painter.picture();
}

/** Each species' recipe, by the texture name it reads (world/passiveFish.js PASSIVE_FISH_SPECIES). */
export const FISH_ART = Object.freeze({
  longnose_butterflyfish: butterflyfish,
  largemouth_bass: bass,
  canary_rockfish: rockfish,
  crucian_carp: carp,
  mackerel,
  white_zebra_angelfish: angelfish,
  finulon: grouper,
});
/** Our picture of the species named `name`, top-down RGBA - or null where it is none of the seven. With a `queue`
 *  the painting is queued for paintSteps (art/ownPainter.js), its pixels laid as they run. */
export const fishPicture = (name, queue = null) => (Object.hasOwn(FISH_ART, name) ? FISH_ART[name](queue) : null);
