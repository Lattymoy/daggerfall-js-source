// OWN-WORK4 (2026-10-31; bible/06-Systems/Roleplay-Realism.md): THE VARIANT KEEPERS AND THE WEEK BUTTON, OUR OWN.
// Six keepers a shop's or tavern's quality draws (197 records 0-3 at 47 x 76, 5 at 61 x 117, 6 at 71 x 128) are
// recipes for our painter (art/ownPainter.js): a person standing as Daggerfall's keepers stand, better dressed as the
// house is better. Record 4 stays Daggerfall's own, rebuilt (rrDerivedArt.json). No pixel of the release is read.
import { createPainter, RAMP, ellipse, poly, stroke, rect, union, textWidth, NARROW } from '../../art/ownPainter.js';

/** One keeper, standing, in a space 47 wide and `H` tall (the feet on its floor). `o`: skin, hair (and `long`), beard,
 *  top and its cut ('tunic', 'robe', 'dress'), apron, belt, trim, legs, boots, a held `mug`. */
function keeper(p, H, o) {
  const y = (f) => f * H; // heights as a share of the figure
  const cx = 23.5;
  const legs = o.top === 'robe' || o.top === 'dress';
  if (!legs) {
    p.fill(stroke([[cx - 5, y(0.55)], [cx - 6, y(0.9)]], 4.2, 3.6), o.legs, { seed: 3, rough: 0.15 });
    p.fill(stroke([[cx + 5, y(0.55)], [cx + 6, y(0.9)]], 4.2, 3.6), o.legs, { seed: 4, rough: 0.15, bias: -0.08 });
  }
  p.fill(poly([[cx - 11, y(0.88)], [cx - 2, y(0.88)], [cx - 1, y(0.99)], [cx - 12, y(0.99)]]), o.boots, { gain: 1.2 });
  p.fill(poly([[cx + 2, y(0.88)], [cx + 11, y(0.88)], [cx + 12, y(0.99)], [cx + 1, y(0.99)]]), o.boots, { gain: 1.2, bias: -0.08 });
  // long hair falls behind the shoulders, so it goes down first
  if (o.long) p.fill(poly([[cx - 6.5, y(0.05)], [cx + 6.5, y(0.05)], [cx + 7.5, y(0.27)], [cx - 7.5, y(0.27)]]), o.hair, { seed: 9, rough: 0.2 });
  // the body: shoulders to the hem
  const hem = legs ? y(0.9) : y(0.58);
  const flare = legs ? 13 : 11;
  const body = poly([[cx - 4, y(0.2)], [cx + 4, y(0.2)], [cx + 11, y(0.235)], [cx + 10, y(0.42)], [cx + flare, hem], [cx - flare, hem], [cx - 10, y(0.42)], [cx - 11, y(0.235)]]);
  p.fill(body, o.cloth, { seed: 5, rough: 0.12, gain: 1.1 });
  if (o.trim) {
    p.fill(stroke([[cx, y(0.22)], [cx, hem]], 1.2), o.trim, { bias: 0.1 });
    p.fill(stroke([[cx - flare + 1, hem - 1], [cx + flare - 1, hem - 1]], 1), o.trim, { over: true });
  }
  if (o.apron) p.fill(poly([[cx - 8, y(0.4)], [cx + 8, y(0.4)], [cx + 10, y(0.74)], [cx - 10, y(0.74)]]), o.apron, { seed: 6, rough: 0.1 });
  if (o.belt) {
    p.fill(rect(cx - 10.5, y(0.4), cx + 10.5, y(0.4) + 2.2), o.belt, { gain: 0.8 });
    p.fill(rect(cx - 1.4, y(0.4), cx + 1.4, y(0.4) + 2.2), RAMP.gold, { bias: 0.1 });
  }
  if (o.chain) p.fill(stroke([[cx - 6, y(0.23)], [cx - 3, y(0.31)], [cx, y(0.33)], [cx + 3, y(0.31)], [cx + 6, y(0.23)]], 0.7), RAMP.gold, { bias: 0.15 });
  // the arms, the hands at the hips (or one holding a mug)
  p.fill(stroke([[cx - 10.5, y(0.255)], [cx - 13.5, y(0.36)], [cx - 13, y(0.5)]], 3.3, 2.9), o.sleeve ?? o.cloth, { seed: 7, rough: 0.1 });
  const right = o.mug ? [[cx + 10.5, y(0.255)], [cx + 15, y(0.34)], [cx + 11, y(0.42)]] : [[cx + 10.5, y(0.255)], [cx + 13.5, y(0.36)], [cx + 13, y(0.5)]];
  p.fill(stroke(right, 3.3, 2.9), o.sleeve ?? o.cloth, { seed: 8, rough: 0.1, bias: -0.1 });
  p.fill(ellipse(cx - 13, y(0.52), 2.6, 2.6), o.skin);
  if (o.mug) {
    p.fill(rect(cx + 5, y(0.38), cx + 11, y(0.47)), RAMP.wood, { gain: 1.1 });
    p.fill(rect(cx + 5, y(0.375), cx + 11, y(0.385)), RAMP.egg, { bias: 0.1 });
    p.fill(ellipse(cx + 10.5, y(0.43), 2.6, 2.6), o.skin);
  } else p.fill(ellipse(cx + 13, y(0.52), 2.6, 2.6), o.skin, { bias: -0.05 });
  // the head: the face's marks set by the pixel, so they stay one pixel at either size
  p.fill(rect(cx - 2.2, y(0.16), cx + 2.2, y(0.23)), o.skin, { bias: -0.1 });
  const hy = y(0.105);
  p.fill(ellipse(cx, hy, 5.2, y(0.07)), o.skin, { gain: 1.1 });
  p.fill(union(ellipse(cx, y(0.05), 5.8, y(0.035)), rect(cx - 5.6, y(0.05), cx - 4.4, y(0.11))), o.hair, { seed: 10, rough: 0.25 });
  if (o.beard) p.fill(poly([[cx - 5, y(0.125)], [cx - 2, y(0.135)], [cx + 2, y(0.135)], [cx + 5, y(0.125)], [cx + 3, y(0.185)], [cx, y(0.2)], [cx - 3, y(0.185)]]), o.beard, { seed: 11, rough: 0.25 });
  const pix = (x, yy) => [Math.floor((x * p.width) / 47), Math.floor((yy * p.height) / H)];
  const [ex, ey] = pix(cx - 2, hy), [fx] = pix(cx + 2, hy), [nx, ny] = pix(cx, hy + y(0.025)), [, my] = pix(cx, hy + y(0.045));
  for (const x of [ex, fx]) p.set(x, ey, RAMP.black[1]);
  p.set(ex, ey - 1, o.hair[1]);
  p.set(fx, ey - 1, o.hair[1]);
  p.set(nx, ny, o.skin[2]);
  for (const x of [nx - 1, nx, nx + 1]) p.set(x, my, o.beard ? o.beard[0] : o.skin[1]);
  p.outline({ keep: 0.35 });
}

const KEEPERS = {
  // a poor shop: roughspun and a work apron
  0: { skin: RAMP.skin, hair: RAMP.brown, top: 'tunic', cloth: RAMP.brown, apron: RAMP.leather, belt: RAMP.leather, legs: RAMP.grey, boots: RAMP.leather },
  // a plain one: a green dress, her hair long
  1: { skin: RAMP.skin, hair: RAMP.wood, long: true, top: 'dress', cloth: RAMP.green, belt: RAMP.leather, boots: RAMP.leather },
  // a good one: a blue doublet, a grey beard
  2: { skin: RAMP.skin, hair: RAMP.grey, beard: RAMP.grey, top: 'tunic', cloth: RAMP.blue, belt: RAMP.black, trim: RAMP.white, legs: RAMP.black, boots: RAMP.black },
  // the finest: a wine robe, gold at the hem and a gold chain
  3: { skin: RAMP.skin, hair: RAMP.black, top: 'robe', cloth: RAMP.wine, trim: RAMP.gold, chain: true, boots: RAMP.black },
  // a fine tavern's keeper: a white shirt, a wine vest, a clean apron, a mug
  5: { skin: RAMP.skin, hair: RAMP.brown, top: 'tunic', cloth: RAMP.wine, sleeve: RAMP.white, apron: RAMP.white, belt: RAMP.black, trim: RAMP.gold, legs: RAMP.black, boots: RAMP.black, mug: true },
  // the tavern's own keeper: a white shirt, a green vest, an apron, a mug
  6: { skin: RAMP.skin, hair: RAMP.red, beard: RAMP.red, top: 'tunic', cloth: RAMP.green, sleeve: RAMP.white, apron: RAMP.egg, belt: RAMP.leather, legs: RAMP.brown, boots: RAMP.leather, mug: true },
};
/** The picture sizes the game reads: the classic keeper each one stands in for (rrVariants.js RR_KEEPER_OF). */
export const RR_KEEPER_SIZE = Object.freeze({ 0: [47, 76], 1: [47, 76], 2: [47, 76], 3: [47, 76], 5: [61, 117], 6: [71, 128] });

/** Our keeper for 197 record `record`, top-down RGBA - or null where the record is not one we paint. */
export function rrKeeperPicture(record) {
  const size = RR_KEEPER_SIZE[record];
  if (!size) return null;
  const H = (47 * size[1]) / size[0];
  const p = createPainter(size[0], size[1], { space: [47, H] });
  keeper(p, H, KEEPERS[record]);
  return p.picture();
}

/** The training window's week button (BUTTONS.RCI record 21, RR_WEEK_BUTTON): carved stone at a classic button's 32 x 16,
 *  "5 DAYS" raised in our narrow letters. */
export function rrWeekButtonPicture() {
  const p = createPainter(32, 16);
  p.fill(rect(0, 0, 32, 16), RAMP.stone.slice(2, 6), { seed: 21, rough: 0.6 });
  for (let x = 0; x < 32; x++) { p.set(x, 0, RAMP.stone[6]); p.set(x, 15, RAMP.stone[0]); }
  for (let y = 0; y < 16; y++) { p.set(0, y, RAMP.stone[6]); p.set(31, y, RAMP.stone[0]); }
  const label = '5 DAYS';
  p.text(label, Math.floor((32 - textWidth(label, NARROW)) / 2), 4, RAMP.stone[6], { shadow: RAMP.stone[0], font: NARROW });
  return p.picture();
}
