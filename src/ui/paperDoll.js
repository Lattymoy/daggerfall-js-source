// U8f: the PAPERDOLL BASE - the avatar on the inventory window (DFU
// PaperDoll + PaperDollRenderer, MIT Daggerfall Workshop). Verbatim
// laws:
// - the panel is 110x184 at (49,13) on the inventory (paperDollWidth/
//   Height; paperDoll.Position);
// - the BACKGROUND is a subrect (8,7,110,184) of the context SCBG:
//   SCBG04I0 in town, SCBG07I0 in dungeons, SCBG08I0 graveyards,
//   else the race's own sheet (GetPaperDollBackground - the region
//   branch pends the travel arc; our exterior hosts are towns);
// - BODY art places by its OWN IMG header offset minus the
//   paperDollOrigin (200,8) - the classic files bake their screen
//   position;
// - BlitBody: the nude body first, then (NoPlayerNudity censoring,
//   the DFU default) the CLOTHED body welds over the unclothed
//   halves - upper down to waistHeight 40, lower below it - gated
//   on IsUpperClothed/IsLowerClothed (chest/legs slots);
// - the HEAD is the race/gender FACE CIF at the entity's faceIndex,
//   placed by its record offset.
// INTERIM loud: race Breton / male / face 0 until chargen fronts
// the entity (playerEntity carries no identity yet); item overlay
// layers ride U8g.

import { ImgFile } from '../formats/imgFile.js';
import { CifRciFile } from '../formats/cifRciFile.js';
import { bitmapToColor32 } from './hud.js';
import { EQUIP_SLOTS, equipTableOf } from '../systems/equip.js';

export const PAPERDOLL_W = 110;
export const PAPERDOLL_H = 184;
export const PAPERDOLL_ORIGIN = Object.freeze([200, 8]);   // paperDollOrigin
export const BG_SUBRECT = Object.freeze([8, 7, 110, 184]); // backgroundSubRect
export const WAIST_HEIGHT = 40;

// Breton (RaceTemplate verbatim); the other 7 races join with chargen
const RACE_ART = Object.freeze({
  Breton: {
    background: 'SCBG00I0.IMG',
    bodyMale: ['BODY00I0.IMG', 'BODY00I1.IMG'],      // unclothed, clothed
    bodyFemale: ['BODY10I0.IMG', 'BODY10I1.IMG'],
    headsMale: 'FACE00I0.CIF', headsFemale: 'FACE10I0.CIF',
  },
});
const CONTEXT_BG = Object.freeze({ town: 'SCBG04I0.IMG', dungeon: 'SCBG07I0.IMG', graveyard: 'SCBG08I0.IMG' });

let _art = null;
export async function preloadPaperDollArt(deps, { race = 'Breton', gender = 'male', faceIndex = 0, context = 'town' } = {}) {
  if (_art) return;
  try {
    const { renderer, fetchBytes, palette } = deps;
    const ra = RACE_ART[race];
    const [unclothed, clothed] = gender === 'male' ? ra.bodyMale : ra.bodyFemale;
    const loadOne = async (name) => {
      const img = new ImgFile();
      img.load(await fetchBytes(name), name, palette);
      const bmp = img.getDFBitmap();
      return { tex: renderer.uploadTexture('img', name, bitmapToColor32(bmp, palette)), w: bmp.width, h: bmp.height, off: img.imageOffset };
    };
    const face = new CifRciFile();
    face.load(await fetchBytes(gender === 'male' ? ra.headsMale : ra.headsFemale), gender === 'male' ? ra.headsMale : ra.headsFemale, palette);
    const headBmp = face.getDFBitmap(faceIndex, 0);
    const head = {
      tex: renderer.uploadTexture('img', `head_${race}_${gender}_${faceIndex}`, bitmapToColor32(headBmp, palette)),
      w: headBmp.width, h: headBmp.height, off: face.getOffset(faceIndex),
    };
    _art = {
      bg: await loadOne(CONTEXT_BG[context] ?? ra.background),
      nude: await loadOne(unclothed),
      clothed: await loadOne(clothed),
      head,
    };
  } catch { console.warn('[paperdoll] BODY/FACE/SCBG art unavailable; the panel stays bare'); }
}
export const paperDollArtLoaded = () => !!_art;

/** One layer at its baked IMG offset, translated to the panel. src
 *  is an optional {v0,v1} band for the censor welds. */
function layer(renderer, m, x, y, img, band) {
  const [ox, oy] = PAPERDOLL_ORIGIN;
  const sy = band ? img.h * band[0] : 0;
  const h = band ? img.h * (band[1] - band[0]) : img.h;
  renderer.drawScreenQuad(img.tex,
    { x: m.ox + (x + img.off.x - ox) * m.s, y: m.oy + (y + img.off.y - oy + sy) * m.s, w: img.w * m.s, h: h * m.s },
    band ? { u0: 0, v0: band[0], u1: 1, v1: band[1] } : undefined);
}

/** Draw the avatar with the panel's top-left at virtual (x,y). */
export function drawPaperDoll(renderer, m, entity, x, y) {
  if (!_art) return false;
  // the background subrect fills the panel exactly
  renderer.drawScreenQuad(_art.bg.tex,
    { x: m.ox + x * m.s, y: m.oy + y * m.s, w: PAPERDOLL_W * m.s, h: PAPERDOLL_H * m.s },
    { u0: BG_SUBRECT[0] / _art.bg.w, v0: BG_SUBRECT[1] / _art.bg.h, u1: (BG_SUBRECT[0] + BG_SUBRECT[2]) / _art.bg.w, v1: (BG_SUBRECT[1] + BG_SUBRECT[3]) / _art.bg.h });
  layer(renderer, m, x, y, _art.nude);
  // the censor welds (NoPlayerNudity default): clothed halves cover
  // unclothed chest/legs
  const table = equipTableOf(entity);
  const upperClothed = table[EQUIP_SLOTS.ChestClothes] || table[EQUIP_SLOTS.ChestArmor];
  const lowerClothed = table[EQUIP_SLOTS.LegsClothes];
  const split = WAIST_HEIGHT / _art.clothed.h;
  if (!upperClothed) layer(renderer, m, x, y, _art.clothed, [0, split]);
  if (!lowerClothed) layer(renderer, m, x, y, _art.clothed, [split, 1]);
  layer(renderer, m, x, y, _art.head);
  return true;
}
