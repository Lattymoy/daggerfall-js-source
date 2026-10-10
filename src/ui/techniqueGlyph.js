// @ts-check
// TECH-CARD (2026-10-10, the owner: "it needs its own unique glyph as its own element. Like how set pieces and sigils
// get their own sections"): THE TECHNIQUE'S GLYPH - three strokes of a strike on the diagonal, the long one between two
// short, each sharp at both ends. The one picture a technique wears: its block on the card (ui/techniqueCard.js) and
// its chip on the HUD (ui/enhancedHud.js statTile). A leaf with no imports, as the sigil's rune is (ui/sigilRune.js), so
// a stylesheet or a test may read it without the roster.
//
// Not the sigil's ring, nor the open zone's two crossed blades (ui/hudStatus.js STATUS_GLYPHS.wild): a shape no other
// mark in the kit has, so the chip and the block are known for the same thing at a glance.

/** The glyph on the 16px grid, a row a string - `#` a pixel. */
export const TECHNIQUE_GLYPH_ROWS = Object.freeze([
  '................',
  '..............#.',
  '........#....##.',
  '......##...###..',
  '.....###..####..',
  '....###..####...',
  '...###..####....',
  '..##...####...#.',
  '..#...####..##..',
  '.....####..###..',
  '....####..###...',
  '...####..###....',
  '..###...##......',
  '..##....#.......',
  '.#..............',
  '................',
]);

/** The rows as one path - each run of pixels a unit-high rectangle, so the grid is drawn and never smoothed. */
function rowsPath(rows) {
  let d = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      if (row[x] !== '#') { x++; continue; }
      const from = x;
      while (x < row.length && row[x] === '#') x++;
      d += `M${from} ${y}h${x - from}v1h${from - x}z`;
    }
  });
  return d;
}
const GLYPH_PATH = rowsPath(TECHNIQUE_GLYPH_ROWS);

/** The glyph in the text's colour (`currentColor`) - the block's, which the sheet tints and lights. */
export const TECHNIQUE_GLYPH_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">'
  + `<path fill="currentColor" d="${GLYPH_PATH}"/></svg>`;

/** The glyph a TILE wears (the HUD's chip): the same pixels in `colour` with the kit's black outline drawn in - the
 *  sigil rune's tile law (ui/sigilRune.js SIGIL_RUNE_TILE_SVG: a masked glyph's shadow is clipped by its own mask). One
 *  pixel of margin all round holds the outline. A colour that is not `#rrggbb` answers the technique's blue. */
export const TECHNIQUE_GLYPH_BLUE = '#59c7ff';
const _tiles = new Map();
export function techniqueGlyphTileSrc(colour = TECHNIQUE_GLYPH_BLUE) {
  const c = /^#[0-9a-f]{6}$/i.test(String(colour ?? '')) ? String(colour).toLowerCase() : TECHNIQUE_GLYPH_BLUE;
  let src = _tiles.get(c);
  if (!src) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 18 18" shape-rendering="crispEdges">'
      + `<path fill="${c}" stroke="#050608" stroke-width="2" paint-order="stroke" d="${GLYPH_PATH}"/></svg>`;
    src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    _tiles.set(c, src);
  }
  return src;
}
