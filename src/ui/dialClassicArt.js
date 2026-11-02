// DIAL-CLASSIC (2026-10-12, Mac: "do you remember the compass inventory, skills, magic and map selector here the arena2
// files look for those symbols green should be the skills based on the face of your character youve choosen, blue magic,
// yellow inventory and red map, make the icons fit to each other sizewise"): THE TAB DIAL'S FOUR DOORS IN DAGGERFALL'S
// OWN ART. Under DFO Grimoire the dial's doors were pieces of the pack's paintings (GRIM4: the Empire's helm, the
// spellmaker's book, the map of Tamriel, a chest); they are now the classic HUD bar's own buttons and the player's own
// face, read out of the player's ARENA2 when the dial is raised - nothing of the game's art ships with the port:
//   SKILLS  the character's face - the head the large HUD and the sheet wear (the race's FACE??I0.CIF at the chosen
//           face, or the curse's override: the werewolf's, the wereboar's, the vampire's - systems/vampirism.js)
//   MAGIC   the spellbook button's star        } MAIN00I0.IMG, the 320x46 bar (ui/hud/hudLarge.js), each cut off the
//   ITEMS   the inventory button's sack        } stone it is painted on along its own outline - the masks below are
//   MAP     the map button's scroll            } the icons' pixels, in or out, worked once off the bar
// THE SIZES MATCH: the three bar icons at four screen pixels to each of their own (76-80 px tall) and every face at
// three, trimmed to its painted pixels (a head's picture carries clear margins - Breton woman 7 stands 34x29 in a 35x49
// picture). Measured over all 160 player heads: their painted areas lie within a third of each other, so one whole
// scale draws every face at the same weight - the red-haired Breton (30x29) at 90x87, the blue-haired (26x35) at 78x105,
// as Mac asked ("check all heads if they match like the red haired here") - every pixel square. Only a head longer than
// 36 pixels a side is fitted down to CLASSIC_FACE_MAX, so no door outgrows the rose.
//
// PORTRAIT3D (2026-10-15, the owner: "5. Do this" - the tab dial's door among the faces still Daggerfall's): with
// Morrowind's data attached SKILLS is the player's Morrowind head, as the large HUD's (characters/headPortraits.js
// playerHeadImage - the helm worn, the curse's head; the wereboar's Daggerfall's), trimmed to its painted pixels and
// drawn at CLASSIC_FACE_MAX at most, smooth (`smooth`: data-grim-dial-face="head" lifts the pixels' squaring off it).
//
// The pack's paintings stay the dial's until the player's art is read (the front menu has no data), and wherever it
// cannot be. A leaf of the dial: the hosts hand it their data door (setClassicDialSource) and the dial asks it to wear
// the art each time it rises (pixelDial.js setDialOpenHook).
import { ImgFile } from '../formats/imgFile.js';
import { CifRciFile } from '../formats/cifRciFile.js';
import { bitmapToColor32 } from '../formats/color32Order.js';
import { raceArt } from '../systems/races.js';
import { racialOverrideHeadArt } from '../systems/vampirism.js';
import { playerHeadImage, playerHeadKey } from '../characters/headPortraits.js';   // PORTRAIT3D

/** The bar the three icons are cut from, and each icon's box on it [x, y, w, h] and its pixels' spans along each row
 *  of the box ([from, to) pairs, left to right) - the icon and its own dark outline, the stone left out. */
export const CLASSIC_BAR_FILE = 'MAIN00I0.IMG';
export const CLASSIC_DIAL = Object.freeze({
  magic: Object.freeze({ box: Object.freeze([97, 2, 21, 20]), rows: Object.freeze([
    '10-11', '9-12', '9-12', '4-7 8-12 14-16', '4-7 8-12 13-17', '3-17', '4-16', '5-15', '1-20', '0-21',
    '0-20', '1-18', '5-15', '4-17', '4-17', '3-12 13-16', '4-6 8-12 14-15', '8-12', '8-11', '9-10']) }),
  items: Object.freeze({ box: Object.freeze([184, 2, 34, 20]), rows: Object.freeze([
    '27-29', '25-31', '24-32', '23-33', '9-11 22-34', '6-12 13-20 22-34', '3-21 22-33', '2-32', '1-29', '1-30',
    '0-31', '0-31', '1-32', '3-32', '7-32', '9-10 11-31', '12-31', '15-17 19-30', '19-31', '20-30']) }),
  map: Object.freeze({ box: Object.freeze([193, 25, 22, 19]), rows: Object.freeze([
    '16-18 20-21', '1-21', '0-21', '0-21', '1-20', '2-20', '2-20', '2-20', '2-20', '2-20',
    '2-20', '2-20', '2-20', '2-20', '1-20', '0-21', '0-22', '0-22', '1-21']) }),
});
/** Screen pixels to each of the bar icons' own, and to each of a face's; the longest side a face is drawn at. */
export const CLASSIC_ICON_SCALE = 4;
export const CLASSIC_FACE_SCALE = 3;
export const CLASSIC_FACE_MAX = 108;
/** A face's scale: three, unless its longer painted side would pass CLASSIC_FACE_MAX - then fitted to it. */
export const faceScale = (w, h) => Math.min(CLASSIC_FACE_SCALE, CLASSIC_FACE_MAX / Math.max(1, w, h));
/** The painted box of a palette bitmap - every pixel not the clear index - [x, y, w, h], or null for an empty one. */
export function paintedBox(bmp, clear = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < bmp.height; y++) for (let x = 0; x < bmp.width; x++) {
    if (bmp.data[y * bmp.width + x] === clear) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}
/** A row's spans, read. */
export const spansOf = (row) => (row ? row.split(' ').map((sp) => sp.split('-').map(Number)) : []);

/** One bar icon, cut: `bar` the bar's palette-index bitmap ({ width, height, data }) - an RGBA picture of the box,
 *  every pixel outside the icon's spans clear (and the bar's own clear index too). */
export function cutBarIcon(bar, palette, name) {
  const { box: [bx, by, bw, bh], rows } = CLASSIC_DIAL[name];
  const rgba = new Uint8ClampedArray(bw * bh * 4);
  rows.forEach((row, y) => {
    for (const [a, b] of spansOf(row)) {
      for (let x = a; x < b; x++) {
        const idx = bar.data[(by + y) * bar.width + bx + x];
        if (idx === 0) continue;
        const c = palette.get(idx), o = (y * bw + x) * 4;
        rgba[o] = c.r; rgba[o + 1] = c.g; rgba[o + 2] = c.b; rgba[o + 3] = 255;
      }
    }
  });
  return { width: bw, height: bh, rgba, scale: CLASSIC_ICON_SCALE };
}

/** The head the player wears, as hudLarge.js loadHudLargeHead reads it: the curse's override first, else the race's
 *  heads at the chosen face. Answers { file, record }. */
export function faceSourceOf(entity) {
  const ov = racialOverrideHeadArt(entity);
  if (ov) return ov;
  return { file: raceArt(entity?.race ?? 'Breton', entity?.gender ?? 'male').heads, record: Math.max(0, entity?.faceIndex ?? 0) };
}
const faceKey = (entity) => { const f = faceSourceOf(entity); return `${f.file}#${f.record}|mw${playerHeadKey(entity)}`; };   // PORTRAIT3D: and the Morrowind head's

/** PORTRAIT3D: the picture a Morrowind head is taken at - twice the longest side a face is drawn at. */
export const HEAD_DIAL_PX = CLASSIC_FACE_MAX * 2;
/** The painted box of an RGBA picture - every pixel not clear - [x, y, w, h], or null for an empty one. */
export function alphaBox(img) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.data[(y * img.width + x) * 4 + 3] === 0) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}
/** PORTRAIT3D: a Morrowind head's picture as the SKILLS door wears it - trimmed to its painted pixels, drawn
 *  CLASSIC_FACE_MAX / HEAD_DIAL_PX of its own (its longer side CLASSIC_FACE_MAX at most), smooth; null for an empty one.
 *  @param {{ width: number, height: number, data: Uint8Array|Uint8ClampedArray } | null} img */
export function headDialPicture(img) {
  const box = img ? alphaBox(img) : null;
  if (!box) return null;
  const [bx, by, bw, bh] = box;
  const rgba = new Uint8ClampedArray(bw * bh * 4);
  for (let y = 0; y < bh; y++) rgba.set(img.data.subarray(((by + y) * img.width + bx) * 4, ((by + y) * img.width + bx + bw) * 4), y * bw * 4);
  return { width: bw, height: bh, rgba, scale: CLASSIC_FACE_MAX / HEAD_DIAL_PX, smooth: true };
}
/** PORTRAIT3D: the player's Morrowind head as the SKILLS door wears it, or null where none is drawn. */
export async function readHeadDial(entity) {
  return headDialPicture(await playerHeadImage(entity, { px: HEAD_DIAL_PX, ph: HEAD_DIAL_PX }).catch(() => null));
}

/** Read the four pictures: `fetchBytes(name)` the data door, `palette` the game's. Answers { skills, magic, items,
 *  map }, each { width, height, rgba, scale }; a picture that cannot be read is left out (the pack's stands). */
export async function readClassicDial({ fetchBytes, palette }, entity) {
  const out = {};
  try {
    const bar = new ImgFile();
    bar.load(await fetchBytes(CLASSIC_BAR_FILE), CLASSIC_BAR_FILE, palette);
    const bmp = bar.getDFBitmap();
    for (const name of Object.keys(CLASSIC_DIAL)) out[name] = cutBarIcon(bmp, palette, name);
  } catch { /* no bar: the pack's three stand */ }
  const head = await readHeadDial(entity);   // PORTRAIT3D: the Morrowind head first
  if (head) { out.skills = head; return out; }
  try {
    const f = faceSourceOf(entity);
    let bmp;
    if (f.file.endsWith('.IMG')) { const i = new ImgFile(); i.load(await fetchBytes(f.file), f.file, palette); bmp = i.getDFBitmap(); }
    else { const c = new CifRciFile(); c.load(await fetchBytes(f.file), f.file, palette); bmp = c.getDFBitmap(f.record, 0); }
    const box = bmp?.width ? paintedBox(bmp) : null;
    if (box) {
      const [bx, by, bw, bh] = box;
      const c32 = new Uint8Array(bitmapToColor32(bmp, palette).colors.buffer);
      const rgba = new Uint8ClampedArray(bw * bh * 4);
      for (let y = 0; y < bh; y++) rgba.set(c32.subarray(((by + y) * bmp.width + bx) * 4, ((by + y) * bmp.width + bx + bw) * 4), y * bw * 4);
      out.skills = { width: bw, height: bh, rgba, scale: faceScale(bw, bh) };
    }
  } catch { /* no face: the pack's helm stands */ }
  return out;
}

/** Wear the pictures on the page: each as a picture at its own size in a root variable (--dial-classic-<name>), its
 *  drawn size beside it (--dial-classic-w-<name>, -h-) - the dress's rules fall back to the pack's, door by door, for
 *  one not worn - and the root's flag that keeps the pixels square (data-grim-dial-art="classic"). Answers how many. */
export function wearClassicDial(doc, pics) {
  const root = doc?.documentElement;
  if (!root?.style) return false;
  let n = 0;
  for (const [name, p] of Object.entries(pics)) {
    const cv = doc.createElement('canvas');
    cv.width = p.width; cv.height = p.height;
    const g = cv.getContext('2d');
    if (!g) continue;
    g.putImageData(new ImageData(p.rgba, p.width, p.height), 0, 0);
    root.style.setProperty(`--dial-classic-${name}`, `url("${cv.toDataURL('image/png')}")`);
    root.style.setProperty(`--dial-classic-w-${name}`, `${Math.round(p.width * p.scale)}px`);
    root.style.setProperty(`--dial-classic-h-${name}`, `${Math.round(p.height * p.scale)}px`);
    n++;
  }
  if (n) root.dataset.grimDialArt = 'classic';
  if (pics.skills?.smooth) root.dataset.grimDialFace = 'head';   // PORTRAIT3D: a Morrowind head is drawn smooth
  else delete root.dataset.grimDialFace;
  return n;
}

let _source = null, _worn = null, _pending = null;
/** A host's data door: { fetchBytes, palette, entity: () => the player's entity }. */
export function setClassicDialSource(src) { _source = src; _worn = null; }
/** The dial is rising: wear the player's art if it is not worn for this face yet (read once a face - the curse's
 *  change of face reads it again). Answers the read under way, if one began. */
export function refreshClassicDial(doc = globalThis.document) {
  if (!_source || !doc) return null;
  const entity = _source.entity?.();
  const key = faceKey(entity);
  if (_worn === key || _pending) return _pending;
  _pending = readClassicDial(_source, entity)
    .then((pics) => { if (wearClassicDial(doc, pics) === 4) _worn = key; })
    .catch((e) => console.warn('[dial] classic art unavailable:', e?.message ?? e))
    .finally(() => { _pending = null; });
  return _pending;
}
