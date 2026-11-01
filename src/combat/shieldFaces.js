// @ts-check
// OUR OWN FIRST-PERSON SHIELDS, painted in code for Shield Widget's 600 slots (the mod's
// pictures are retired). A slot is a kind (its archive), a material group and a wear tier (its record), and one of
// the five frames the Animation module plays, from the guard (0) to the shield turned out of the way (4).
import { createPainter, ellipse, poly, stroke, minus, and, RAMP, hex, grain, rampShade } from '../art/ownPainter.js';
import { SHIELD_ARCHIVE_FIRST, SHIELD_FRAMES, SHIELD_RECORDS, SHIELD_TEXTURE_COUNT, shieldTextureName } from './shieldWidget.js';

/** Each archive's kind, in the widget's order. */
export const SHIELD_KINDS = Object.freeze(['buckler', 'round', 'kite', 'tower']);
/** The ten material groups (shieldMaterialOffset's), and the three wear tiers (shieldConditionOffset's). */
export const SHIELD_GROUPS = 10;
export const SHIELD_TIERS = 3;

const ramp = (...colours) => Object.freeze(colours.map((colour) => Object.freeze(hex(colour))));
/** Each group's paints: the face, the rim and the boss. Group 0 is leather on wood, rimmed in iron. */
export const SHIELD_PAINTS = Object.freeze([
  { face: RAMP.leather, rim: RAMP.iron, boss: RAMP.iron },
  { face: RAMP.iron, rim: RAMP.iron, boss: RAMP.steel },
  { face: RAMP.steel, rim: RAMP.steel, boss: RAMP.white },
  { face: ramp('#2f3a22', '#4f5f35', '#77894c', '#a0b06a', '#c7d28f', '#e6ecb8'), rim: RAMP.gold, boss: RAMP.gold },
  { face: RAMP.bronze, rim: RAMP.bronze, boss: RAMP.gold },
  { face: ramp('#3c4652', '#5f6f80', '#8798a8', '#adbccb', '#d1dde8', '#f0f6fb'), rim: RAMP.white, boss: RAMP.white },
  { face: ramp('#141a17', '#24302b', '#38463f', '#4f5f57', '#6b7b72', '#8c9a92'), rim: RAMP.iron, boss: RAMP.steel },
  { face: ramp('#06070b', '#0f1219', '#1a1f2b', '#272f40', '#384358', '#4d5b75'), rim: RAMP.black, boss: RAMP.sea },
  { face: RAMP.olive, rim: RAMP.bronze, boss: RAMP.iron },
  { face: ramp('#1a0505', '#330a0a', '#4f1111', '#6e1a17', '#8f2a20', '#b5432d'), rim: RAMP.black, boss: RAMP.ember },
]);

/** A slot's own name: its kind, group, tier and frame. */
export function shieldFaceOf(index) {
  if (!(index >= 0 && index < SHIELD_TEXTURE_COUNT)) return null;
  const { archive, record, frame } = shieldTextureName(index);
  return { kind: SHIELD_KINDS[archive - SHIELD_ARCHIVE_FIRST], group: record % SHIELD_GROUPS, tier: Math.floor(record / SHIELD_GROUPS), frame };
}

/** Each kind's outline in its own units (x across, y down, about the grip), and how much of the sprite it fills. */
const OUTLINE = {
  buckler: { round: 0.36, at: [0.5, 0.5] },
  round: { round: 0.44, at: [0.5, 0.55] },
  kite: { at: [0.5, 0.5], points: [[-0.44, -0.4], [-0.2, -0.47], [0.2, -0.47], [0.44, -0.4], [0.4, -0.05], [0.2, 0.35], [0, 0.62], [-0.2, 0.35], [-0.4, -0.05]] },
  tower: { at: [0.5, 0.55], points: [[-0.4, -0.3], [-0.25, -0.43], [0, -0.47], [0.25, -0.43], [0.4, -0.3], [0.4, 0.7], [-0.4, 0.7]] },
};

/** The painter's light (art/ownPainter.js): from the upper left, toward the viewer. A surface's light by its normal. */
const LIGHT = [-0.55, -0.62, 0.56];
export const litBy = (normalX, normalY, normalZ) => {
  const len = Math.hypot(normalX, normalY, normalZ) || 1;
  return Math.max(0, Math.min(1, ((normalX * LIGHT[0] + normalY * LIGHT[1] + normalZ * LIGHT[2]) / len + 1) / 2));
};
/** How a face is made: group 0 is planks of wood, the rest metal. A metal's sheen is the share of the light that turns
 *  to its ramp's brightest shades; the rim's bevel rises at `BEVEL` (its slopes' tilt out of the face). */
export const SHIELD_PLANKS = 5;
export const SHIELD_SHEEN = 0.8;
export const BEVEL = 1.6;

/** The face's light at (x, y): a shallow dome about the grip, turned away as the frame turns the shield. */
function faceLight(x, y, centreX, centreY, k, squash, turn) {
  return litBy((x - centreX) / (0.5 * k * squash), (y - centreY) / (0.5 * k), 1.6) - 0.18 * turn;
}

/**
 * Our painting of one slot, `{ width, height, data }` top-down RGBA with a 1-bit cutout, at its archive's size
 * (`size`, the widget's own table). The frames turn the shield out of the way: down and to the left, squared off
 * toward its edge. The forearm holds it from below, so the bottom edge is painted and the top one is clear. OWN-WORK4
 * AUDIT: lit from the painter's light - a face of wood planks or sheened metal, a bevelled rim, a domed boss with
 * its shadow, and studs that catch the light.
 */
export function paintShieldFace(index, size) {
  const face = shieldFaceOf(index);
  if (!face || !size) return null;
  const { width, height } = size;
  const painter = createPainter(width, height);
  const shape = OUTLINE[face.kind];
  const paint = SHIELD_PAINTS[face.group];
  const turn = face.frame / (SHIELD_FRAMES - 1);
  const k = Math.min(width, height);
  const centreX = width * (shape.at[0] - 0.12 * turn), centreY = height * (shape.at[1] + 0.2 * turn), squash = 1 - 0.45 * turn, rot = -0.18 * turn;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  // a point of the shield's own (units of k about its grip) on the picture, and a picture point in the shield's units
  const at = ([x, y]) => [centreX + (x * squash * cos - y * sin) * k, centreY + (x * squash * sin + y * cos) * k];
  const local = (x, y) => {
    const dx = (x - centreX) / k, dy = (y - centreY) / k;
    return [(dx * cos + dy * sin) / squash, -dx * sin + dy * cos];
  };
  const shapeOf = (inset) =>
    shape.round
      ? ellipse(centreX, centreY, (shape.round - inset) * squash * k, (shape.round - inset) * k, rot)
      : poly(shape.points.map(([x, y]) => at([x * (1 - inset * 2.2), y * (1 - inset * 2.2)])));
  // the forearm, from under the bottom edge up to the grip, behind the shield
  painter.fill(stroke([[centreX + 0.16 * k, height + 0.2 * k], [centreX + 0.02 * k, centreY + 0.05 * k]], 0.15 * k, 0.11 * k), RAMP.leather, { gain: 0.9 });
  const outer = shapeOf(0), ridge = shapeOf(0.025), inner = shapeOf(0.05);
  const light = (x, y) => faceLight(x, y, centreX, centreY, k, squash, turn);
  if (face.group === 0) {
    // planks of wood, upright: each its own tone, its grain waving along it, a dark seam between
    painter.fill(inner, ({ x, y, px, py }) => {
      const [localX, localY] = local(x, y);
      const across = (localX / 0.9 + 0.5) * SHIELD_PLANKS, plank = Math.floor(across), within = across - plank;
      if (within < 0.07) return rampShade(paint.face, light(x, y) * 0.35, px, py);
      const wave = Math.sin(localY * 38 + grain(plank, 7, 11 + face.group) * 6 + Math.sin(localX * 30) * 1.4);
      const tone = light(x, y) * 0.85 + (grain(plank, 3, 5) - 0.5) * 0.18 + wave * 0.07 + (grain(px, py, 3) - 0.5) * 0.08;
      return rampShade(RAMP.wood, tone, px, py);
    });
  } else {
    // metal: the dome's light, a sheen where it faces the light, brushed along the rows
    painter.fill(inner, ({ x, y, px, py }) => {
      const level = light(x, y), brushed = (grain(0, py, 17 + face.group) - 0.5) * 0.08;
      const sheen = level > SHIELD_SHEEN ? (level - SHIELD_SHEEN) * 1.2 : 0;
      return rampShade(paint.face, level * 0.82 + sheen + brushed, px, py);
    });
  }
  // the rim, bevelled: its outer slope faces out from the grip, its inner slope back in toward the face
  painter.fill(minus(outer, inner), ({ x, y, px, py }) => {
    const [localX, localY] = local(x, y);
    const len = Math.hypot(localX, localY) || 1, out = ridge.has(x, y) ? -1 : 1;
    return rampShade(paint.rim, litBy((out * localX * squash) / len, (out * localY) / len, 1 / BEVEL) * 1.1 - 0.05, px, py);
  });
  // the boss on a round shield, a spine down a long one
  if (shape.round) {
    const [bossX, bossY] = at([0, 0]), bossRadius = 0.09 * k;
    // its shadow on the face, away from the light
    painter.fill(minus(ellipse(bossX + 0.05 * k, bossY + 0.055 * k, bossRadius * squash, bossRadius, rot), ellipse(bossX, bossY, bossRadius * squash, bossRadius, rot)), ({ px, py }) => rampShade(paint.face, 0.08, px, py), { clip: inner });
    painter.fill(ellipse(bossX, bossY, bossRadius * squash, bossRadius, rot), paint.boss, { gain: 1.6 });
    painter.fill(ellipse(bossX - 0.035 * k * squash, bossY - 0.035 * k, 0.025 * k * squash, 0.022 * k), paint.boss[paint.boss.length - 1]);
  } else painter.fill(stroke([at([0, -0.38]), at([0, 0.45])], 0.025 * k), paint.rim, { gain: 1.5, clip: inner });
  // the studs round the rim: each a dome, its glint toward the light and its shadow away
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rimAt = (shape.round ?? 0.4) - 0.025;
    const [x, y] = at([Math.cos(a) * rimAt, Math.sin(a) * rimAt * (shape.round ? 1 : 1.1)]);
    if (face.tier === 2 && i % 3 === 1) continue; // battered: some are gone
    const studRadius = Math.max(1.4, 0.018 * k);
    painter.fill(ellipse(x + studRadius * 0.6, y + studRadius * 0.6, studRadius, studRadius), ({ px, py }) => rampShade(paint.rim, 0.05, px, py), { clip: outer });
    painter.fill(ellipse(x, y, studRadius, studRadius), paint.boss, { gain: 1.7, clip: outer }); // a dome steep enough to glint
  }
  wear(painter, face, at, k, inner, outer);
  painter.outline({ keep: 0.35 });
  // the cutout's own rule: nothing over the top edge (open air above the rim)
  for (let x = 0; x < width; x++) painter.set(x, 0, null);
  return painter.picture();
}

/** The wear tiers: worn scratches the face; battered dents it and chips the rim. The marks are the slot's own, so
 *  each frame shows the same shield. */
function wear(painter, face, at, k, inner, outer) {
  if (!face.tier) return;
  const seed = 97 + face.group * 7 + SHIELD_RECORDS * face.tier;
  const rand = (i) => grain(i, face.tier, seed);
  const scratches = face.tier === 1 ? 5 : 9;
  for (let i = 0; i < scratches; i++) {
    const a = [rand(i * 4) * 0.6 - 0.3, rand(i * 4 + 1) * 0.6 - 0.3];
    const b = [a[0] + (rand(i * 4 + 2) - 0.5) * 0.25, a[1] + (rand(i * 4 + 3) - 0.5) * 0.25];
    painter.fill(stroke([at(a), at(b)], 0.006 * k), (spot) => [Math.round(spot.t * 40), Math.round(spot.t * 34), Math.round(spot.t * 28)], { clip: inner, over: true });
  }
  if (face.tier < 2) return;
  for (let i = 0; i < 4; i++) {
    const [x, y] = at([rand(50 + i) * 0.5 - 0.25, rand(60 + i) * 0.5 - 0.25]);
    painter.fill(ellipse(x, y, 0.05 * k, 0.035 * k, rand(70 + i) * 3), SHIELD_PAINTS[face.group].face, { bias: -0.15, gain: -0.6, clip: inner, over: true });
  }
  for (let i = 0; i < 3; i++) {
    const a = rand(80 + i) * Math.PI * 1.2 - Math.PI * 1.1; // the upper rim, where a blow lands
    const [x, y] = at([Math.cos(a) * 0.4, Math.sin(a) * 0.45]);
    const chip = and(ellipse(x, y, 0.035 * k, 0.03 * k), minus(outer, inner));
    const [x0, y0, x1, y1] = chip.box.map(Math.round);
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) if (chip.has(px + 0.5, py + 0.5)) painter.set(px, py, null);
  }
}
