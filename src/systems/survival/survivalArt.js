// THE SURVIVAL PICTURES WE PAINT. Raw meat (538 record 2, 47 x 24) and the waterskin (539 record 0, 23 x 26) have no
// classic picture to start from, so they are recipes for our painter (art/ownPainter.js). The spoiled faces are our
// rot (rotPicture.js) over a fresh picture - the player's own food, or this raw meat (itemIcons.js OWN_ICONS). No
// pixel of the retired release is read.
import { createPainter, RAMP, ellipse, stroke, union } from '../../art/ownPainter.js';

function rawMeat() {
  const painter = createPainter(47, 24);
  painter.fill(stroke([[34, 13], [44, 9]], 2.6), RAMP.bone, { gain: 0.9 });
  painter.fill(ellipse(44, 8.5, 2.6, 3.2), RAMP.bone, { bias: 0.1 });
  painter.fill(ellipse(45.5, 11, 2, 2.4), RAMP.bone, { bias: -0.05 });
  const cut = union(ellipse(19, 13, 18, 9.5, -0.12), ellipse(30, 13.5, 8, 7));
  painter.fill(cut, RAMP.fat, { gain: 0.8, bias: 0.05 });
  painter.fill(union(ellipse(19, 13.5, 16, 8, -0.12), ellipse(29, 14, 6.5, 5.5)), RAMP.meat, { gain: 1.1, seed: 538, rough: 0.2 });
  const marbling = [
    [[8, 11], [14, 13], [20, 12]],
    [[14, 17], [22, 16], [28, 18]],
    [[22, 9], [27, 11]],
  ];
  for (const strand of marbling) painter.fill(stroke(strand, 0.6), RAMP.fat.slice(2), { over: true });
  painter.fill(ellipse(31, 14, 2.2, 2), RAMP.bone, { over: true, bias: 0.1 });
  painter.outline({ keep: 0.35 });
  return painter.picture();
}

function waterskin() {
  const painter = createPainter(23, 26);
  painter.fill(stroke([[5, 6], [3, 2.5], [9, 1], [17, 2], [20.5, 6], [20, 11]], 0.9), RAMP.leather, { bias: 0.05 });
  const bag = union(ellipse(12, 17, 9.5, 8), ellipse(10, 11, 6, 6));
  painter.fill(bag, RAMP.leather, { gain: 1.15, seed: 539, rough: 0.18 });
  painter.fill(stroke([[5, 16], [12, 19], [19, 16]], 0.5), RAMP.leather[1], { over: true });
  painter.fill(stroke([[6, 7], [4.5, 3.5]], 2.2), RAMP.leather, { bias: -0.05 });
  painter.fill(stroke([[4.4, 3.4], [3.8, 2]], 1.6), RAMP.wood, { bias: 0.15 });
  painter.fill(stroke([[3.5, 5.5], [7.5, 6]], 0.7), RAMP.rope, { bias: 0.1 });
  painter.outline({ keep: 0.35 });
  return painter.picture();
}

/** Each painted picture's recipe, by name (`archive_record-frame`). */
export const SURVIVAL_ART = Object.freeze({ '538_2-0': rawMeat, '539_0-0': waterskin });
/** Our painted picture `name`, top-down RGBA - or null where it is not one we paint. */
export const survivalPicture = (name) => (Object.hasOwn(SURVIVAL_ART, name) ? SURVIVAL_ART[name]() : null);
