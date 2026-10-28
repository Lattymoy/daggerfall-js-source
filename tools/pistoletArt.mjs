// THE DWARVEN PISTOLET'S DOLL LAYERS, from its inventory picture (PISTOLET, 2026-10-21; bible/05-Combat/Dwarven-Pistolet.md).
//
// The owner drew the pistol at Daggerfall's own scale - 24x17, one of its pixels one of the doll's (AUDIT PISTOLET D15:
// not "a dagger's doll record" - those are 56x17 and 36x45) - so this is NOT tools/gunPaperdoll.mjs: that one bakes a 1790px painting down. The picture is never resampled by a filter: the
// doll's layer is the owner's pixels, tilted by RotSprite (below), which keeps every pixel one of the sprite's own.
//
//   public/art/pistolet-icon.png    THE SOURCE - the owner's sprite, whole. It is the inventory picture as it is.
//   -> pistolet-paperdoll-left.png  the doll's LEFT hand's (the picture's right): the fist's gap cut across the grip,
//                                   then the picture tilted DOLL_ANGLE degrees barrel-down - NOT mirrored. The owner,
//                                   2026-10-22, on a level cut and then a quarter turn with a mirrored pair: "Still
//                                   wrong. It should be at a downward angle in the right hand in the picture. Not
//                                   mirrored" - and of this one, "Much better".
//   -> pistolet-paperdoll.png       the doll's RIGHT hand's (the picture's left): the gapped sprite FLIPPED left to
//                                   right - right side up, its barrel now to the picture's right - and tilted 60
//                                   degrees barrel-down, toward the other hand's gun. The owner picked it from rendered
//                                   options after five rejected cuts of this hand (bible/05-Combat/Dwarven-Pistolet.md):
//                                   "#4 is the closest but needs adjusting" (the right gun's pose mirrored, 45 degrees),
//                                   then "C but lower" (60 degrees), and 2 px below the classic fist's gap ("Sorry I
//                                   meant #2", PISTOLET_PAPERDOLL_OFFSET.right). The one doll layer that is a mirror of the
//                                   owner's drawing, by the owner's choice.
//   -> pistolet-icon-gilded.png, pistolet-paperdoll-gilded.png, pistolet-paperdoll-left-gilded.png
//                                   the same three in gold leaf, tools/gunIcons.mjs gild() - the Sunken Sovereign's
//
// THE GAP is the Thunderlock's rule (tools/gunPaperdoll.mjs punchBand): a band square to the grip, so the frame of the gun
// stays above the fist and the butt below it. Its size is a classic weapon's own: the doll's fist leaves an 8-10px gap
// along a classic one-handed weapon's record (TEXTURE.234's dagger, mace, shortsword, war axe, measured), and a pistol's
// grip runs ACROSS its barrel, so the cut runs along the grip. `thick` is how much of the grip the fist covers.
//
//     node tools/pistoletArt.mjs [--band=cx,cy,deg,thick,length]
import { readFileSync, writeFileSync } from 'node:fs';
import { readPng, writePng } from './pngIO.mjs';
import { punchBand } from './gunPaperdoll.mjs';
import { gild } from './gunIcons.mjs';
import { isMain } from './lib/isMain.mjs';
import { scale2x, rotSprite } from '../src/formats/rotSprite.js';

export const SOURCE = 'public/art/pistolet-icon.png';
export const OUT = Object.freeze({
  doll: 'public/art/pistolet-paperdoll.png',
  dollLeft: 'public/art/pistolet-paperdoll-left.png',
  iconGilded: 'public/art/pistolet-icon-gilded.png',
  dollGilded: 'public/art/pistolet-paperdoll-gilded.png',
  dollLeftGilded: 'public/art/pistolet-paperdoll-left-gilded.png',
});

/** The band, in the SOURCE's pixels: its centre as fractions of the sprite (punchBand's own units), the way it runs (the
 *  grip slopes about 12 degrees off upright, down to the right, so the band runs 12 degrees above level), how thick it
 *  is across the grip's length and how long across its width. Centre on rows 8-9 - the grip's middle - so the frame
 *  of the gun (rows 0-6) stays above the fist and the butt (rows 11-16) below it. */
export const BAND = Object.freeze({ cx: 19.7 / 24, cy: 9 / 17, deg: -12, thick: 4, length: 9 });

/** How far the doll's layer is tilted, counter-clockwise on the screen: the barrel, level and pointing left in the
 *  sprite, points down and out at this angle - the owner's "a downward angle". */
export const DOLL_ANGLE = 45;

// Scale2x and RotSprite live in src/formats/rotSprite.js since the spear lab turns pixels with them too; re-exported here.
export { scale2x, rotSprite };

/** Each hand's pose: whether the sprite is flipped left to right first, and how far it is then turned, counter-clockwise.
 *  The left hand's (the picture's right) is the sprite as drawn, tilted DOLL_ANGLE barrel-down to the picture's left;
 *  the right hand's (the picture's left) is the sprite flipped, tilted 60 degrees barrel-down to the picture's right -
 *  the owner's pick. */
export const HAND_POSE = Object.freeze({
  left: Object.freeze({ flip: false, turn: DOLL_ANGLE }),
  right: Object.freeze({ flip: true, turn: -60 }),
});

/** The picture flipped left to right, pixel for pixel. */
export function flipAcross({ width: w, height: h, data }) {
  const out = new Uint8Array(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = (y * w + (w - 1 - x)) * 4;
      out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2]; out[d + 3] = data[s + 3];
    }
  }
  return { width: w, height: h, data: out };
}

/** A hand's doll layer from the gapped sprite, its pose applied. `point` (source pixels) is carried through. */
export function posed(level, hand, point = null) {
  const { flip, turn } = HAND_POSE[hand];
  return rotSprite(flip ? flipAcross(level) : level, turn, point && (flip ? [level.width - point[0], point[1]] : point));
}

/** Where the band's centre - the fist - lands in a hand's layer, in its pixels. src/systems/pistolet.js
 *  PISTOLET_PAPERDOLL_OFFSET seats this point on each hand's fist. */
export const dollGrip = (hand = 'left', { w = 24, h = 17, band = BAND } = {}) =>
  posed({ width: w, height: h, data: new Uint8Array(w * h * 4) }, hand, [band.cx * w, band.cy * h]).at;

/** The doll layers and the gilded set, from the source picture. Pure: a test re-runs it against the shipped files. */
export function pistoletArt(src, band = BAND) {
  const level = { width: src.width, height: src.height, data: new Uint8Array(src.data) };
  const cut = punchBand(level, band);   // cut in the source's own frame (the band is measured there), then turned
  const dollLeft = posed(level, 'left').img;
  const doll = posed(level, 'right').img;   // the right hand's: flipped, the barrel toward the left hand's
  return { doll, dollLeft, iconGilded: gild(src), dollGilded: gild(doll), dollLeftGilded: gild(dollLeft), cut };
}

if (isMain(import.meta.url)) {
  const arg = process.argv.find((a) => a.startsWith('--band='));
  const band = arg ? (([cx, cy, deg, thick, length]) => ({ cx, cy, deg, thick, length }))(arg.slice(7).split(',').map(Number)) : BAND;
  const src = readPng(readFileSync(SOURCE));
  const art = pistoletArt(src, band);
  for (const [k, file] of Object.entries(OUT)) writeFileSync(file, writePng(art[k]));
  console.log(`${SOURCE} ${src.width}x${src.height}: the gap cut ${art.cut} pixels; wrote ${Object.values(OUT).join(', ')}`);
}
