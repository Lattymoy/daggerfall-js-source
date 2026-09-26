// @ts-check
// SIGIL-UI (2026-09-26): THE RUNE - the one picture a sigil wears, a leaf with no imports so the stylesheet
// (ui/enhancedPlusStyle.js, which node tests import for its CSS alone) can mask a tile's corner with it without
// pulling the sigil's law (systems/sigil.js registers a blow modifier when it loads) into every page that reads CSS.
/** The rune: an octagonal ring with a four-point star at its heart - drawn on the pixel grid, never scaled past it. */
export const SIGIL_RUNE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">'
  // the ring - an octagon two pixels thick (outer edge clockwise, inner hole cut by the even-odd rule)
  + '<path fill="currentColor" fill-rule="evenodd" d="M6 1H10V2H12V3H13V5H14V11H13V13H12V14H10V15H6V14H4V13H3V11H2V5H3V3H4V2H6Z'
  + 'M6 3V4H5V5H4V11H5V12H6V13H10V12H11V11H12V5H11V4H10V3Z"/>'
  // the four-point star at its heart
  + '<rect fill="currentColor" x="7" y="4" width="2" height="8"/><rect fill="currentColor" x="4" y="7" width="8" height="2"/>'
  + '<rect fill="currentColor" x="6" y="6" width="4" height="4"/></svg>';
/** The rune as a data URL, for a CSS mask (the tile's corner mark). */
export const SIGIL_RUNE_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(SIGIL_RUNE_SVG)}")`;
