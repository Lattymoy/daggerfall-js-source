// @ts-check
// SIGIL-UI (2026-09-26): THE RUNE - the one picture a sigil wears, a leaf with no imports so the stylesheet
// (ui/enhancedPlusStyle.js, which node tests import for its CSS alone) can paint a tile's corner with it without
// pulling the sigil's law (systems/sigil.js registers a blow modifier when it loads) into every page that reads CSS.
/** The rune: an octagonal ring with a four-point star at its heart - drawn on the pixel grid, never scaled past it. */
export const SIGIL_RUNE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">'
  // the ring - an octagon two pixels thick (outer edge clockwise, inner hole cut by the even-odd rule)
  + '<path fill="currentColor" fill-rule="evenodd" d="M6 1H10V2H12V3H13V5H14V11H13V13H12V14H10V15H6V14H4V13H3V11H2V5H3V3H4V2H6Z'
  + 'M6 3V4H5V5H4V11H5V12H6V13H10V12H11V11H12V5H11V4H10V3Z"/>'
  // the four-point star at its heart
  + '<rect fill="currentColor" x="7" y="4" width="2" height="8"/><rect fill="currentColor" x="4" y="7" width="8" height="2"/>'
  + '<rect fill="currentColor" x="6" y="6" width="4" height="4"/></svg>';
/** AUDIT MERGE-PLUS D5: the rune a TILE'S CORNER wears - the same pixels in the sigil's teal with the kit's black
 *  outline drawn in (the padlock's way, ui/enhancedPlusStyle.js LOCK_GLYPH_SVG): it was a CSS mask over the colour,
 *  and a masked glyph's drop shadow is clipped by its own mask, so the outline that kept it legible on a lit tile
 *  never drew. One pixel of margin all round holds the outline. */
export const SIGIL_RUNE_TILE_SVG = SIGIL_RUNE_SVG
  .replace('viewBox="0 0 16 16"', 'viewBox="-1 -1 18 18"')
  .replace('<path fill="currentColor"', '<g fill="#72f0d8" stroke="#050608" stroke-width="2" paint-order="stroke"><path')
  .replaceAll('<rect fill="currentColor"', '<rect')
  .replace('</svg>', '</g></svg>');
/** The corner rune as a data URL, for a background image. */
export const SIGIL_RUNE_TILE_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(SIGIL_RUNE_TILE_SVG)}")`;
/** SET5: the corner rune in a set's own colour - a set piece's tile wears its Prince's hue (the Aetheric set's own),
 *  the same pixels and outline. A colour that is not a `#rrggbb` answers the sigil's teal. */
const _setRunes = new Map();
export function sigilRuneTileUrl(colour) {
  const c = String(colour ?? '').toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(c)) return SIGIL_RUNE_TILE_URL;
  let u = _setRunes.get(c);
  if (!u) { u = `url("data:image/svg+xml;utf8,${encodeURIComponent(SIGIL_RUNE_TILE_SVG.replace('#72f0d8', c))}")`; _setRunes.set(c, u); }
  return u;
}
/** UI3: the same rune as a picture's source (an `<img>`'s src, not a background) - a set power's tile in the HUD's
 *  status widget (ui/hudStatus.js). The colour law is the corner rune's: a colour that is not `#rrggbb` is the teal. */
export const sigilRuneTileSrc = (colour) => sigilRuneTileUrl(colour).slice(5, -2);
