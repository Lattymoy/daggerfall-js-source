// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HERALDRY-SHOWN (2026-10-02, Mac: "lets finish the build work") — A
// GUILD'S HERALDRY AS A SWATCH, the one DOM door of Seats-Arc 8.1's
// small faces: "the frame of the guild tag, the siege HUD ... and the
// Chronicle".
//
// The drawing is ui/heraldryArt.js shieldSvg - the banner's own field,
// border and device on a small shield - set as a picture (a data: URI,
// never markup, SOC3's rule the Guild tab's banner keeps). The tag's
// frame wears the same picture as its background (`heraldrySwatchSrc`);
// the HUD and the Chronicle an <img> (`heraldrySwatch`, `paintSwatch`).
//
// Where a face finds the heraldry: net/heraldryIndex.js heraldryIndex, by
// the guild's tag (a Chronicle row's guild by its name too), off what the
// client already holds (the seats' list,
// a seat's standings, the reader's own guild) - `heraldryLookup` keeps
// that index for a face asked every frame. And which guild a Chronicle
// row is about: `chronicleGuildOf`.
//
// Not a DFU member: Daggerfall Unity has no player guilds. Ledger A
// (ONLINE).
// ═══════════════════════════════════════════════════════════════════
import { heraldryOf, heraldryText, heraldryKey } from '../net/heraldryLaw.js';
import { heraldryIndex, armsNamed } from '../net/heraldryIndex.js';
import { shieldSvg } from './heraldryArt.js';

/** The swatch's class. */
export const HERALDRY_SWATCH_CLASS = 'dfherald';
/** A swatch's width in the text it stands in, CSS px. */
export const HERALDRY_SWATCH_PX = 14;

/** A heraldry's swatch as a picture's source - a data: URI of its shield - or '' for none. */
export const heraldrySwatchSrc = (heraldry) => {
  const svg = shieldSvg(heraldry, { size: HERALDRY_SWATCH_PX });
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '';
};

/** Each picture's heraldry as last painted, so a face asked every frame writes only a change. */
const painted = new WeakMap();
/**
 * PAINT a picture `img` with `heraldry` - its shield, its words for a reader - or hide it for none. Written only when the
 * heraldry changes. Whether it shows one.
 */
export function paintSwatch(img, heraldry) {
  const h = heraldryOf(heraldry);
  const key = h ? heraldryKey(h) : ''; // AUDIT GUILD2 G12: the whole arms - a division or a device's colour changed is a new picture
  if (painted.get(img) === key) return !!h;
  painted.set(img, key);
  if (h) {
    img.src = heraldrySwatchSrc(h);
    img.alt = heraldryText(h);
    img.title = heraldryText(h);
  } else img.alt = '';
  img.style.display = h ? '' : 'none';
  return !!h;
}

/**
 * A GUILD'S SWATCH on `doc`: a small picture of its shield (`size` px wide), or null for a guild with none - so a face
 * only appends what there is.
 */
export function heraldrySwatch(doc, heraldry, { size = HERALDRY_SWATCH_PX, className = HERALDRY_SWATCH_CLASS } = {}) {
  if (!heraldryOf(heraldry)) return null;
  const img = doc.createElement('img');
  img.className = className;
  img.setAttribute('width', String(size));
  img.setAttribute('height', String(Math.round(size * 1.04)));
  img.style.verticalAlign = 'middle';
  img.style.marginRight = '0.3em';
  paintSwatch(img, heraldry);
  return img;
}

/**
 * A LOOKUP BY TAG for a face asked every frame: `sources()` names what the client holds (heraldryIndex's), and the index
 * is built again only when one of them is another object than the last time. `(tag, name?) => heraldry`, or null - with
 * `name` (a Chronicle row's guild as it was that day), only where the guild holding the tag now bears that name too
 * (AUDIT HERALDRY H3: a disbanded guild's tag taken by a new one is not its arms); a name tag's live guild asks by tag.
 * @param {() => any[]} sources
 */
export function heraldryLookup(sources) {
  /** @type {any[]} */ let seen = [];
  let index = new Map();
  return (tag, name = undefined) => {
    if (typeof tag !== 'string' || !tag) return null;
    const now = sources() ?? [];
    if (now.length !== seen.length || now.some((x, i) => x !== seen[i])) {
      seen = [...now];
      index = heraldryIndex(...now);
    }
    return armsNamed(index, tag, name);
  };
}

/** The guild each Chronicle row's line names first (net/townSeatLaw.js chronicleLine), where it is not `guild`. */
const CHRONICLE_FIRST = Object.freeze({
  contested: 'a',
  'siege-forfeit': 'against',
  'siege-void': 'holder',
  'fealty-sworn': 'vassal',
  'fealty-broken': 'breaker',
  'fealty-tribute': 'vassal',
  'fealty-lapsed': 'vassal',
});
/**
 * THE GUILD A CHRONICLE ROW IS ABOUT - the one its line names first, `{ name, tag }` as it was that day - or null for a row
 * that names none (a Royal Tourney's, a work's raising, a battle moved, a void Tourney's, a voided battle that restored
 * no holder).
 */
export function chronicleGuildOf(row) {
  const d = row?.data ?? {};
  if (row?.kind === 'siege-void' && d.battle === 'tourney') return null; // its line names neither guild
  // AUDIT HERALDRY H1: a battle the Moderators voided names the holder it went back to, if any - never its attacker (`guild`)
  const g = row?.kind === 'siege-voided' ? (d.restored ? d.holder : null) : d[CHRONICLE_FIRST[row?.kind] ?? 'guild'];
  return g && typeof g === 'object' && typeof g.tag === 'string' && g.tag ? g : null;
}
