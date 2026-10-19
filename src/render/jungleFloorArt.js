// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BANTHA2 (2026-10-19, the owner, with their "Jungle Preview": "At the ground level, the image shows the flora abundence
// that should be present in the jungle" - a floor carpeted in grass, ferns and broad leaves under the trees, no ground
// showing between them): THE JUNGLE FLOOR'S PLANTS, stood as the meadow's sprites are (render/grassMeadow.js MEADOW1 -
// crossed cards at a tuft's own yaw, lit by their faces, swaying their share of the wind) by a grass field of the jungle's
// own (scenes/jungleFloorHost.js). bible/03-World/Bantha-Jungle.md "The floor" is the record.
//
// The plants are the rainforest's own low cover - archive 500's ferns, sedge, broad-leaved bush, palmlets and flowering
// stems, the very pictures BANTHA1's floor storey stands as flats (world/terrain/jungleNature.js) - and the owner's tall
// tuft (src/assets/grass/source/tuft-tall.png, the meadow's first sprite) for its grass. Each picture is laid in the
// meadow's atlas cell (fitSprite: whole texels where it fits, its foot on the cell's floor) beside the tuft, so the
// meadow's program and its coverage-kept mip chain wear them unchanged; of its colour law they take the ground's light and
// never its hue (`hue` 0, uArtHue: a fern on the jungle's red earth stays a fern's green - the meadow's tufts took that
// earth's hue and stood pale). A plant's card stands at its own height (`height`, the
// card's drawn height over the lab's mean blade, times the blade's own draw and the patch's), so the floor's sizes vary
// as the meadow's do; which plant a tuft wears is the width byte's, by shares the patch leans (a lush patch more fern and
// leaf, a poor one more grass and sedge) - ladderPick's law in the vertex stage, floorPick's here.
// ═══════════════════════════════════════════════════════════════════
import { fitSprite, meadowSpriteBox, buildMeadowAtlas, buildMeadowMips, cardMeasures, MEADOW_SLOTS, MEADOW_GREEN, MEADOW_LUSH, MEADOW_PATCH_SCALE } from './grassMeadow.js';
import { MEADOW_SPRITES } from './meadowArt.js';
import { ladderPick, heightFloor, heightSpan, LAB_GRASS } from './labGrass.js';
import { smoothstep } from '../systems/mathf.js';

/** The rainforest's archive: its low cover (TREE_RECORDS' others - world/terrain/terrainNature.js). */
export const JUNGLE_FLOOR_ARCHIVE = 500;
/**
 * THE PLANTS, in atlas order. `record` archive 500's (null: the owner's tall tuft); `height` the mean drawn height of its
 * card (m - the cover a walker wades through: grass and sedge to the knee, ferns and palmlets to the waist, archive 500's
 * own billboards stand two and three metres); `stiff` its share of its own standing lean and `sway` of the wind's (the
 * meadow's own: grass whole, a woody bush 0.3 and 0.6, fronds between); `share` its share of the width byte at the poor
 * patch's end and the lush's - the last takes the rest.
 */
export const JUNGLE_FLOOR_PLANTS = Object.freeze([
  Object.freeze({ name: 'grass', record: null, height: 0.5, stiff: 1, sway: 1, share: Object.freeze([0.42, 0.3]) }),
  Object.freeze({ name: 'sedge', record: 7, height: 0.5, stiff: 1, sway: 1, share: Object.freeze([0.16, 0.1]) }),
  Object.freeze({ name: 'fern', record: 9, height: 1.2, stiff: 0.6, sway: 0.8, share: Object.freeze([0.12, 0.2]) }),
  Object.freeze({ name: 'frond', record: 10, height: 0.95, stiff: 0.6, sway: 0.8, share: Object.freeze([0.1, 0.16]) }),
  Object.freeze({ name: 'broadleaf', record: 1, height: 0.9, stiff: 0.3, sway: 0.6, share: Object.freeze([0.05, 0.08]) }),
  Object.freeze({ name: 'palmlet', record: 27, height: 1, stiff: 0.5, sway: 0.7, share: Object.freeze([0.06, 0.07]) }),
  Object.freeze({ name: 'bloom', record: 21, height: 0.9, stiff: 0.5, sway: 0.7, share: Object.freeze([0.04, 0.05]) }),
  Object.freeze({ name: 'spike', record: 6, height: 1.1, stiff: 0.4, sway: 0.7, share: Object.freeze([0.04, 0.04]) }),
]);
/** The lab's mean blade height (m): a card's side is a blade's height times its plant's scale. */
export const FLOOR_MEAN_BLADE = heightFloor(LAB_GRASS.height) + heightSpan(LAB_GRASS.height) / 2;

/**
 * THE FLOOR'S SET for the meadow's program (render/labGrass.js MEADOW_ART's shape), from the pictures `pictureOf(record)`
 * answers ({ width, height, data }: RGBA, top row first - the classic record's or a pack's), or null when any plant has
 * none (no ARENA2: no floor - never a plant stood in another's picture).
 * @param {(record: number) => ({ width: number, height: number, data: Uint8Array | Uint8ClampedArray } | null)} pictureOf
 */
export function jungleFloorArt(pictureOf) {
  const sprites = [];
  for (const p of JUNGLE_FLOOR_PLANTS) {
    if (p.record == null) { sprites.push(MEADOW_SPRITES[0]); continue; }
    const pic = pictureOf(p.record);
    if (!pic?.width || !pic.height) return null;
    sprites.push(fitSprite(pic, p.name));
  }
  const boxes = sprites.map((s) => Object.freeze(meadowSpriteBox(s)));
  const variants = JUNGLE_FLOOR_PLANTS.map((p, i) => Object.freeze({ name: p.name, scale: p.height / (FLOOR_MEAN_BLADE * Math.max(boxes[i].v1, 1e-3)), stiff: p.stiff, sway: p.sway }));
  const atlas = buildMeadowAtlas({ sprites });
  return Object.freeze({
    name: 'jungle-floor', variants: Object.freeze(variants), boxes: Object.freeze(boxes), sprites,
    pick: ladderPick(JUNGLE_FLOOR_PLANTS.map((p, i) => [i, p.share[0], p.share[1]])),
    green: MEADOW_GREEN, hue: 0, ...cardMeasures(variants, boxes), mips: () => buildMeadowMips(atlas), slots: MEADOW_SLOTS,
  });
}

/** THE PICK, as the vertex stage runs it (ladderPick): which plant a tuft wears off its width byte `r` and its patch's
 *  tint, and its card's side over the lab's blade height. `art` jungleFloorArt's. Pure. */
export function floorPick(art, r, tint) {
  const lush = smoothstep(MEADOW_LUSH[0], MEADOW_LUSH[1], tint);
  let at = 0, variant = JUNGLE_FLOOR_PLANTS.length - 1;
  for (let i = 0; i < JUNGLE_FLOOR_PLANTS.length - 1; i++) {
    const [poor, rich] = JUNGLE_FLOOR_PLANTS[i].share;
    at += poor * (1 - lush) + rich * lush;   // GLSL's mix, term for term
    if (r < at) { variant = i; break; }
  }
  return { variant, scale: art.variants[variant].scale * (MEADOW_PATCH_SCALE[0] * (1 - lush) + MEADOW_PATCH_SCALE[1] * lush), lush };
}
