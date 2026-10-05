// @ts-check
// SUPPORT1 (2026-10-05, Mac: "I want to add the kofi link in addition to the patron on the website" and "I also want
// to add the patron/kofi ingame on the main menu as 2 icons"): THE PROJECT'S ASKS, ONE HOME.
//
// Two doors ask for support now - the website's (index.html, the corner plaques U64 and PATREON1 built) and the game's
// own front door (ui/enhancedMenu.js, two icons in the top-left corner) - and they must ask at the same addresses under
// the same marks. The game imports this module. The site is a document that runs no script, so scripts/landingHtml.mjs
// injects SUPPORT_MARKS_CSS into it at serve and build - the seam that already gives it the skin's tokens and the
// menu's night - and test/landing.test.js holds the site's links, README.md, SUPPORT.md and the repository's Sponsor
// button (.github/FUNDING.yml) to SUPPORT_ASKS.
//
// PATREON1 (2026-09-25, Mac: "Replace website KOFI with patreon") had made Patreon the only ask. Ko-fi is back beside
// it at Mac's new page; U64's ko-fi.com/dfjs is no longer the project's.
//
// THE MARKS ARE DRAWN, NOT PICTURED. Each is a pixel list painted in box-shadow, as the site's corner mark has been since
// U64: the site carries no raster (test/landing.test.js, U60), and the door's pixel face is the same square pixel.
// Patreon's is PATREON1's own drawing. Ko-fi's is U64's cup with one change: its handle is a RING. U64's handle was a
// solid column, which read as a cup beside the words "Support on Ko-fi"; standing alone as an icon on the game's door
// it read as a goblet, and the hole is what says mug (rendered both at 12x to choose). The body stays FILLED - U64's
// own lesson, whose first draft drew it as a ring and read as an 'o'.
//
// Not a DFU member.

/** One art pixel, in CSS pixels: the site's 4px grid, and the door's. */
export const MARK_PX = 4;

/**
 * @typedef {object} SupportAsk
 * @property {string} id     the class suffix both doors draw the mark by (`supmark-${id}`)
 * @property {string} name   the platform's own name
 * @property {string} label  what a link to it says, the site's words and the door's tooltip alike
 * @property {string} url    where the ask goes
 * @property {readonly string[]} art  the mark, a string a row: '#' brass, '+' dim, '.' clear; its BODY is the last
 *   MARK_BODY_ROWS rows, and anything above them (a mug's steam) rises off it
 */

/** Every mark's body is five rows - Patreon's height - so a door can stand the marks on one line by their feet and
 *  centre the bodies, whatever rises above them. The laid-out box is the WHOLE drawing: a host that lays out less than
 *  it draws finds the rest in its border (the site's plaque found the mug's steam in its top edge). */
export const MARK_BODY_ROWS = 5;

/** Patreon's two shapes (PATREON1): the bar in the dim, standing the full height, a column of air, and the disc in the
 *  brass - five across with its four corners cut, which is what a circle is at this size. */
const PATREON_ART = Object.freeze([
  '+..###.',
  '+.#####',
  '+.#####',
  '+.#####',
  '+..###.',
]);

/** Ko-fi's mug (U64's cup, the handle a ring): two wisps of steam in the dim, a row of air, then the filled body with
 *  its handle on the right - five rows, Patreon's height. */
const KOFI_ART = Object.freeze([
  '.+.+..',
  '+.+...',
  '......',
  '####..',
  '######',
  '####.#',
  '######',
  '####..',
]);

/** @type {readonly SupportAsk[]} The asks, in the order both doors show them - Patreon first, as it was the only one. */
export const SUPPORT_ASKS = Object.freeze([
  Object.freeze({ id: 'patreon', name: 'Patreon', label: 'Support on Patreon', url: 'https://www.patreon.com/c/dfenhanced', art: PATREON_ART }),
  Object.freeze({ id: 'kofi', name: 'Ko-fi', label: 'Support on Ko-fi', url: 'https://ko-fi.com/daggerfallonline', art: KOFI_ART }),
]);

/**
 * One mark's rules: a box the size of its whole drawing, and a ::before one art pixel square at the box's top-left
 * whose box-shadow paints every other pixel. A shadow at the element's own place is clipped away under it, so that one
 * pixel is the ::before's background. The colours are two custom properties the mark declares (SUPPORT_MARKS_CSS), so
 * a door lights a mark by setting one rather than by restating its pixels.
 * @param {SupportAsk} ask
 * @param {number} [px] one art pixel, in CSS pixels
 */
export function markCss(ask, px = MARK_PX) {
  const rows = ask.art.length;
  const cols = Math.max(...ask.art.map((r) => r.length));
  const colour = (ch) => (ch === '#' ? 'var(--mk-hi)' : 'var(--mk-lo)');
  let ground = 'transparent';
  const shadows = [];
  ask.art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    if (x === 0 && y === 0) { ground = colour(ch); return; }
    shadows.push(`${x * px}px ${y * px}px 0 ${colour(ch)}`);
  }));
  return `.supmark-${ask.id} { width: ${cols * px}px; height: ${rows * px}px; }\n`
    + `.supmark-${ask.id}::before { background: ${ground}; box-shadow: ${shadows.join(', ')}; }`;
}

/** Both marks, as the site's corner and the door's icons draw them: the brass and the dim at rest, the brass lit by the
 *  classic shadowed-label pair's gold while the link holding the mark is under the pointer or the keyboard. */
export const SUPPORT_MARKS_CSS = `/* SUPPORT1: the asks' marks (ui/supportAsks.js) - the site's corner and the door's icons */
.supmark { --mk-hi: var(--brass); --mk-lo: #7d7460; position: relative; display: block; flex: none; }
.supmark::before { content: ''; position: absolute; left: 0; top: 0; width: ${MARK_PX}px; height: ${MARK_PX}px; }
a:hover > .supmark, a:focus-visible > .supmark { --mk-hi: rgb(243,239,44); }
${SUPPORT_ASKS.map((a) => markCss(a)).join('\n')}
`;
