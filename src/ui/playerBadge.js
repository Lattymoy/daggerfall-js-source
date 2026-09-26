// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC3 — WHAT A TITLE AND A GLYPH LOOK LIKE. One home, both faces.
//
// Mac (2026-09-22): "Player titles appear above a player name... 1st
// title is Founder with a gold color, 2nd title is Developer with a
// red color", and "name glyphs... appear on the right side of the
// player name. Sprouting green plant. Attached to new accounts for 2
// weeks. Developer glyph specifficaly for developers."
//
// ═══ WHY THIS IS NOT IN identityToken.js ═══════════════════════════
//
// That module holds the VOCABULARY - which titles and glyphs exist -
// and it is in the RELAY BUNDLE: SLAM8 hashes its raw bytes, so a word
// of presentation added there costs a RELAY_VERSION bump and drops
// every connected player. The relay has no opinion about gold. So the
// vocabulary is imported FROM there and the appearance lives here,
// where it can be changed for nothing.
//
// AND THE TABLES ARE DERIVED FROM THAT VOCABULARY RATHER THAN BESIDE
// IT: a pin walks TITLES and GLYPHS and requires every member to have
// an entry here, so a third title added to the token cannot reach a
// screen as a blank. That is this repo's DERIVED OVER ENUMERATED with
// the enumeration kept honest by a walk.
//
// ═══ TWO FACES, ONE LAW ════════════════════════════════════════════
//
// The enhanced DOM layer (ui/nameLayer.js) is what an online player
// sees - online forces that lane (OL1) - and it can draw a real shape
// in a real colour. The classic bitmap pass (net/remotePlayers.js
// drawNames) is what a host with no `document` draws, which is every
// Node probe and every suite in test/, and it draws through a
// DAGGERFALL FONT: `drawText` puts NOTHING on screen for a glyph that
// font has no record for.
//
// So a glyph has TWO spellings and it is written down rather than
// discovered: `svg` for the face that can draw a sprouting plant, and
// `mark` - one character inside FONT0003's own range - for the face
// that cannot. ACC1d-MARK learned this the hard way one slice ago: a
// tick is the obvious badge and is not in that font, so it would have
// been invisible in the classic face while the DOM face showed it.
// THE LIMIT, SAID RATHER THAN LEFT TO BE FOUND: this container has no
// ARENA2, so the real FONT0003 is not read by any pin here - the range
// is held instead.
//
// A TITLE HAS ONE SPELLING, because it is a WORD, and a word is ASCII
// and both faces draw it. Only the colour differs in how it is spelled
// (an RGBA array here, `cssRgba` for the DOM), which is exactly how
// SOC4's party green already crosses that seam.
// ═══════════════════════════════════════════════════════════════════

import { TITLES, GLYPHS } from '../net/identityToken.js';

/** An RGBA 0..1 array as CSS. ONE HOME, and it is here rather than in
 *  ui/nameLayer.js (which re-exports it, so SOC4's pin that the party
 *  green survives the trip is untouched) because THREE surfaces now
 *  cross this seam: the name over a head, the chat roster and the
 *  account card's own sheet - and the sheet may not import a layer
 *  that pulls the whole remote-player pass in behind it. */
export function cssRgba(rgba) {
  if (!Array.isArray(rgba) || rgba.length < 3) return null;
  const hex = (v) => Math.max(0, Math.min(255, Math.round(Number(v) * 255))).toString(16).padStart(2, '0');
  return `#${hex(rgba[0])}${hex(rgba[1])}${hex(rgba[2])}`;
}

/** A title's word, as a player reads it. Capitalised because it is a
 *  title and not an identifier; the wire's own spelling is lower-case
 *  and is what everything else keys by. */
export const TITLE_TEXT = Object.freeze({
  founder: 'Founder',
  developer: 'Developer',
  dungeonmaster: 'Dungeon Master',   // TITLE-N (2026-09-24, Mac)
  disciple: 'Disciple',              // TITLE-N: the Patreon tiers, lowest first
  apostle: 'Apostle',
  hierophant: 'Hierophant',
  shadowfang: 'Shadow Fang',         // SHADOW-FANG (2026-09-26, Mac): SirMcMobdon's own
});

/** SHADOW-FANG (2026-09-26, Mac): "SirMcMobdon gets a brand new
 *  title/glyph... Black and crimson graident for the title/glyph with the
 *  title name being Shadow Fang", and the glyph "like the reference
 *  shown" - a snarling wolf's head in profile, black, with a red eye.
 *  The two ends of that gradient, named once: every table below that
 *  paints Shadow Fang reads them from here. */
const SHADOW_BLACK = Object.freeze([0.051, 0.027, 0.035, 1]);    // #0d0709 - black, a breath of blood in it
const SHADOW_CRIMSON = Object.freeze([0.827, 0.098, 0.235, 1]);  // #d3193c
/** The wolf's eye, the one red that is not the gradient's (the reference's). */
const SHADOW_EYE = Object.freeze([1, 0.133, 0.18, 1]);           // #ff222e

/** A title's colour, RGBA 0..1 - the same shape SOC4's PARTY_GREEN is
 *  in, so `nameLayer.cssRgba` turns it into CSS and `drawText` takes it
 *  as a tint, and neither face writes a colour down a second time.
 *  Mac: Founder gold, Developer red, Dungeon Master orange (TITLE-N). The
 *  three Patreon tiers had no colour named: a colour each, none near
 *  another title's, rising from teal to violet to rose - this table is
 *  the one place to change them, and costs no relay. */
export const TITLE_RGBA = Object.freeze({
  founder: Object.freeze([1, 0.784, 0.29, 1]),      // #ffc84a
  developer: Object.freeze([0.886, 0.271, 0.227, 1]), // #e2453a
  dungeonmaster: Object.freeze([1, 0.549, 0.102, 1]), // #ff8c1a
  disciple: Object.freeze([0.369, 0.784, 0.722, 1]),  // #5ec8b8
  apostle: Object.freeze([0.616, 0.486, 0.941, 1]),   // #9d7cf0
  hierophant: Object.freeze([0.910, 0.451, 0.749, 1]), // #e873bf
  // SHADOW-FANG: the gradient's crimson end - the colour a face that cannot draw a gradient uses (the account
  // card's button, the classic face's edge), and the glyph's outline
  shadowfang: SHADOW_CRIMSON,
});

/** SHADOW-FANG: A TITLE DRAWN AS A GRADIENT - its stops, RGBA 0..1, left
 *  to right along the word. A title named here is painted by `titlePaint`
 *  on every DOM face and a letter at a time by the classic one; a title
 *  that is not keeps its one colour above. "Shadow" in the black, "Fang"
 *  in the crimson. */
export const TITLE_GRADIENT = Object.freeze({
  shadowfang: Object.freeze([SHADOW_BLACK, SHADOW_CRIMSON]),
});

/** A glyph's colour. The sprout is green because Mac said green; the
 *  dev glyph takes the Developer title's own red, read from it rather
 *  than repeated, so the two halves of one grant cannot drift apart;
 *  the moderator's shield is blue because Mac picked the blue shield
 *  (MOD1). */
export const GLYPH_RGBA = Object.freeze({
  sprout: Object.freeze([0.42, 0.82, 0.36, 1]),   // #6bd15c
  dev: TITLE_RGBA.developer,
  mod: Object.freeze([0.29, 0.565, 0.886, 1]),   // #4a90e2
  // TITLE-N: each new glyph wears its own title's colour, read from it - the two halves of one grant cannot drift
  dm: TITLE_RGBA.dungeonmaster,
  disciple: TITLE_RGBA.disciple,
  apostle: TITLE_RGBA.apostle,
  hierophant: TITLE_RGBA.hierophant,
  shadowfang: TITLE_RGBA.shadowfang,   // SHADOW-FANG: the outline's crimson - the fill is the gradient below
});

/** SHADOW-FANG: A GLYPH FILLED WITH A GRADIENT - its title's two stops,
 *  read from it and turned round, left to right across the 16x16 box. The
 *  wolf faces right, so its mane takes the crimson and its face the black
 *  its red eye burns in, as the reference's does. A glyph named here is
 *  drawn filled, outlined in its own colour (GLYPH_RGBA) at GLYPH_EDGE_W so
 *  the black half still reads over a night sky. */
export const GLYPH_GRADIENT = Object.freeze({
  shadowfang: Object.freeze([...TITLE_GRADIENT.shadowfang].reverse()),
});
/** The outline a gradient glyph wears, in the 16x16 box's units. */
export const GLYPH_EDGE_W = 0.55;

/** SHADOW-FANG: A SECOND SHAPE ON A GLYPH, in a colour of its own - the
 *  wolf's eye, an angry red slit over the black. Filled, on top. */
export const GLYPH_DETAIL = Object.freeze({
  shadowfang: Object.freeze({ path: 'M9.3 4.7L11.8 5.5L9.8 6.2Z', rgba: SHADOW_EYE }),
});

/** THE CLASSIC FACE'S STAND-IN: one character, and it must be one the
 *  Daggerfall font actually has a record for or it draws as nothing at
 *  all. Held inside FONT0003's printable range by a pin. */
export const GLYPH_MARK = Object.freeze({
  sprout: '+',
  dev: '*',
  mod: '#',   // MOD1: the classic face has no shield; a hash reads as a badge at that size
  dm: '&',            // TITLE-N: one character each, inside the font's range and none another glyph's
  disciple: '~',
  apostle: '^',
  hierophant: '!',
  shadowfang: '>',    // SHADOW-FANG: the wolf's muzzle, facing the way the glyph's does
});

/** The printable range the classic font covers. ACC1d-MARK's own bound,
 *  restated here because it is this table that has to stay inside it. */
export const FONT_GLYPH_MIN = 33;
export const FONT_GLYPH_MAX = 126;

/** THE DOM FACE'S REAL SHAPE, an inline SVG path on a 16x16 box, drawn
 *  in `currentColor` so the colour above is the only place a colour is
 *  decided. Paths rather than an emoji: an emoji is a font lottery -
 *  it resolves to whatever colour font the machine happens to have,
 *  at whatever weight, beside a pixel face that has neither. */
export const GLYPH_PATH = Object.freeze({
  // a sprout: a stem from the soil, one leaf each side
  sprout: 'M8 15V7M8 9C8 9 5 9 3.5 7.5S2 3 2 3s3 0 4.5 1.5S8 9 8 9zM8 8c0 0 3 0 4.5-1.5S14 2 14 2s-3 0-4.5 1.5S8 8 8 8z',
  // a developer's angle brackets
  dev: 'M5.5 4L1.5 8l4 4M10.5 4l4 4-4 4',
  // MOD1: a moderator's shield - a flat top, straight sides, a point below
  mod: 'M8 1.5L2.5 3.5v4c0 3.5 2.4 6 5.5 7 3.1-1 5.5-3.5 5.5-7v-4z',
  // TITLE-N: the Dungeon Master's twenty-sided die - the hexagon's outline, the face turned to the eye, its edges out
  dm: 'M8 1.5l5.6 3.25v6.5L8 14.5l-5.6-3.25v-6.5zM8 4.5L4.5 10.5h7zM8 1.5v3M2.4 11.25l2.1-.75M13.6 11.25l-2.1-.75',
  // the Disciple's candle flame
  disciple: 'M8 1.5c1.6 2.6 3.5 4.1 3.5 6.8a3.5 3.5 0 0 1-7 0C4.5 5.6 6.4 4.1 8 1.5zM8 9.2c.7.9 1.2 1.6 1.2 2.4a1.2 1.2 0 0 1-2.4 0c0-.8.5-1.5 1.2-2.4z',
  // the Apostle's open book
  apostle: 'M8 4.5C6.5 3.5 4.5 3 1.5 3v9.5c3 0 5 .5 6.5 1.5 1.5-1 3.5-1.5 6.5-1.5V3c-3 0-5 .5-6.5 1.5zM8 4.5V14',
  // the Hierophant's crown
  hierophant: 'M2 13h12M2.5 13L1.8 5l3.6 3L8 2.5 10.6 8l3.6-3-.7 8',
  // SHADOW-FANG: the reference's wolf, in profile facing right - the ear raised, the brow down, the jaws open on
  // three fangs, the mane swept back in six blades and the ruff under the throat
  shadowfang: 'M15.9 6.3Q15.8 5.5 15 5.3L11.4 4.1L9.9 3.3L8.7 0.3L6.9 3.2Q4.9 2.1 2.5 2.4Q4.2 3.2 5 4.5Q2.8 4.8 1 6.3Q3.2 6.6 4.3 7.6Q2.3 8.7 1.1 10.5Q3.2 10 4.8 10.2Q3.6 11.7 3.2 13.8Q5.2 12.2 6.8 11.9Q6.3 13.4 6.5 15.3Q7.8 13.2 9.2 12.7Q9.6 14 10.4 15.2Q10.5 12.9 11.6 12L12.9 11.3L15.1 10.7L14 10.4L13.8 9.4L13.3 10.3L9.8 8.8L11.7 8.3L12.1 9.5L12.6 8.1L14.4 7.6L14.8 8.7L15.2 7.4L15.9 7Z',
});

/** Is this glyph DRAWN as an outline rather than filled? The sprout is
 *  a shape and the brackets are strokes; said here so the layer does
 *  not have to know which is which by name. */
export const GLYPH_STROKE = Object.freeze({ sprout: true, dev: true, mod: true, dm: true, disciple: true, apostle: true, hierophant: true, shadowfang: false });

/**
 * The title a peer wears, ready to draw: `{ key, text, rgba }`, or
 * null. It takes the peer rather than the string so every caller asks
 * the same question of the same shape, and it refuses anything the
 * vocabulary does not name - net/wire.js `readBadge` has already done
 * that at the door, and this is the second door, because a title is
 * text a stranger's relay put on my screen.
 * @param {any} peer
 */
export function titleBadge(peer) {
  const key = peer?.title;
  if (typeof key !== 'string' || !TITLES.includes(key)) return null;
  const text = TITLE_TEXT[key];
  if (!text) return null;
  return { key, text, rgba: TITLE_RGBA[key] ?? null, gradient: TITLE_GRADIENT[key] ?? null };
}

/** SHADOW-FANG: a gradient's colour at `t` along it (0 the first stop, 1
 *  the last), RGBA 0..1 - the classic face's tint for one letter of a
 *  gradient title, since a bitmap run takes a single tint. */
export function gradientAt(stops, t) {
  if (!Array.isArray(stops) || !stops.length) return null;
  if (stops.length === 1) return stops[0];
  const f = Math.max(0, Math.min(1, Number(t) || 0)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f));
  const k = f - i, a = stops[i], b = stops[i + 1];
  return [0, 1, 2, 3].map((c) => a[c] + (b[c] - a[c]) * k);
}

/** A gradient's stops as a CSS linear-gradient, left to right. */
export const cssGradient = (stops) => `linear-gradient(90deg, ${stops.map(cssRgba).join(', ')})`;

/** THE STYLE PROPERTIES A DOM FACE WRITES FOR A TITLE, every one of them
 *  every time, so a face that re-uses one element (the name over a head)
 *  clears what the title before this one set. A one-colour title is its
 *  `color`; a GRADIENT title (SHADOW-FANG) is the gradient clipped to the
 *  letters, in bold so there is letter enough to carry it, with the text
 *  shadow every face gives its titles off - under a clipped background a
 *  text shadow paints OVER the letters - and each letter edged in the
 *  title's own colour instead, so the black half still reads over a night
 *  sky (a crimson halo round the word was tried first and lost "Shadow"
 *  on every dark ground). No title: all empty. */
export const TITLE_PAINT_KEYS = Object.freeze(['color', 'backgroundImage', 'webkitBackgroundClip', 'backgroundClip', 'webkitTextFillColor', 'webkitTextStroke', 'fontWeight', 'textShadow', 'filter']);
export function titlePaint(badge) {
  const out = Object.fromEntries(TITLE_PAINT_KEYS.map((k) => [k, '']));
  if (!badge) return out;
  out.color = cssRgba(badge.rgba) ?? '';
  if (Array.isArray(badge.gradient) && badge.gradient.length > 1) {
    const edge = cssRgba(badge.rgba) ?? '';
    out.backgroundImage = cssGradient(badge.gradient);
    out.webkitBackgroundClip = 'text';
    out.backgroundClip = 'text';
    out.webkitTextFillColor = 'transparent';
    out.webkitTextStroke = `0.5px ${edge}`;
    out.fontWeight = '700';
    out.textShadow = 'none';
    out.filter = 'drop-shadow(0 1px 0 #000)';
  }
  return out;
}
/** `titlePaint` written onto an element's style - the chat line's and the
 *  profile card's title, each built fresh. (The name over a head keeps
 *  its own diffing door and walks TITLE_PAINT_KEYS itself.) */
export function paintTitle(node, badge) {
  const p = titlePaint(badge);
  for (const k of TITLE_PAINT_KEYS) node.style[k] = p[k];
  return node;
}

/**
 * The glyphs a peer wears, in the vocabulary's own order rather than
 * the wire's. ORDER IS NOT A PREFERENCE: a glyph is TRUE of a player,
 * not chosen by one, so two players with the same glyphs must show
 * them the same way round - which a list taken in arrival order would
 * not guarantee.
 * @param {any} peer
 */
export function glyphBadges(peer) {
  const on = Array.isArray(peer?.glyphs) ? peer.glyphs : [];
  const out = [];
  for (const key of GLYPHS) {
    if (!on.includes(key)) continue;
    out.push({
      key, mark: GLYPH_MARK[key] ?? '', rgba: GLYPH_RGBA[key] ?? null, path: GLYPH_PATH[key] ?? '',
      gradient: GLYPH_GRADIENT[key] ?? null, detail: GLYPH_DETAIL[key] ?? null,   // SHADOW-FANG
    });
  }
  return out;
}

/** ═══ ACC3c: THE COLOURS AS A STYLESHEET ═════════════════════════
 *
 * `ui/enhancedAccount.js` may not style itself - a pin holds it, and
 * enhancedStyle.js's own header says why: two copies of a design
 * language is how the front door and the rooms behind it drift apart.
 * So the card writes a CLASS and the skin carries the colour, and the
 * skin gets the colour from HERE rather than from a hex somebody typed
 * a second time.
 *
 * WALKED, not listed: a title added to the vocabulary gets a rule
 * without anybody remembering to write one.
 */
export const badgeClass = (kind, key) => `${kind}-${key}`;
/** SHADOW-FANG: `titlePaint`'s properties as CSS declarations, the colour
 *  left to the button (its border is drawn in it) - so a gradient title's
 *  word on the card is the SAME paint as over a head, not a second one. */
const CSS_NAME = { backgroundImage: 'background-image', webkitBackgroundClip: '-webkit-background-clip', backgroundClip: 'background-clip', webkitTextFillColor: '-webkit-text-fill-color', webkitTextStroke: '-webkit-text-stroke', fontWeight: 'font-weight', textShadow: 'text-shadow', filter: 'filter' };
const wordCss = (t) => {
  const p = titlePaint(titleBadge({ title: t }));
  return Object.entries(CSS_NAME).filter(([k]) => p[k]).map(([k, css]) => `${css}: ${p[k]};`).join(' ');
};
export const badgeCss = () => [
  ...TITLES.map((t) => `.card button.acttitle.${badgeClass('tl', t)} { color: ${cssRgba(TITLE_RGBA[t])}; }`),
  // SHADOW-FANG: a gradient title's word (the card wraps it in .acttitleword) - the button keeps the plain colour
  ...TITLES.filter((t) => TITLE_GRADIENT[t]).map((t) => `.card button.acttitle.${badgeClass('tl', t)} .acttitleword { ${wordCss(t)} }`),
  ...GLYPHS.map((g) => `.card .acctglyph.${badgeClass('gl', g)} .acctglyphart { color: ${cssRgba(GLYPH_RGBA[g])}; }`),
].join('\n');

/** The classic face's whole suffix: the marks, run together, or ''.
 *  One string, because that face draws a run and measures it. */
export const glyphMarks = (peer) => glyphBadges(peer).map((g) => g.mark).join('');

/** ═══ INSPECT1: ONE GLYPH AS AN SVG NODE - one drawing, every DOM face ═
 *
 * The name over a head (ui/nameLayer.js), the chat's roster and lines
 * (ui/chatPanel.js) and the profile card (ui/profileWindow.js) all
 * draw a glyph, and the first two each wrote the SVG out by hand - so
 * this is the one drawing, and a face only says how thick it draws a
 * stroke at its own size. The path and the colour are the tables
 * above; filled or stroked is GLYPH_STROKE's word. Null where the
 * document has no SVG door (an old WebView): such a document draws NO
 * glyph rather than throwing under somebody's name.
 * @param {any} doc
 * @param {{ key: string, rgba: any, path: string }} g - one of glyphBadges' records
 * @param {string} cls
 * @param {number} [strokeWidth]
 */
export function glyphSvgNode(doc, g, cls, strokeWidth = 1.8) {
  const svg = glyphArtNode(doc, g, cls, strokeWidth);
  if (svg && g.rgba) svg.style.color = cssRgba(g.rgba) ?? '';
  return svg;
}

/** Each gradient a glyph defines needs an id no other node in the
 *  document has - `url(#id)` resolves against the whole document, and a
 *  name that left the screen would take a shared one with it. */
let gradientSerial = 0;

/**
 * THE DRAWING ITSELF, WITH NO COLOUR OF ITS OWN: every shape the tables
 * above paint in `currentColor`, so the caller decides the colour - the
 * DOM faces inline (glyphSvgNode), the account card by its class (ACC3c:
 * that card may not style itself). SHADOW-FANG: a GRADIENT glyph is
 * filled with its stops (a `linearGradient` of its own, after the shape,
 * so the shape stays the first child every face and pin reads) and
 * outlined in `currentColor`; a DETAIL is drawn over it in its own colour.
 * @param {any} doc
 * @param {{ key: string, path: string, gradient?: any, detail?: any }} g
 * @param {string} cls
 * @param {number} [strokeWidth]
 */
export function glyphArtNode(doc, g, cls, strokeWidth = 1.8) {
  const svg = doc?.createElementNS?.('http://www.w3.org/2000/svg', 'svg');
  if (!svg) return null;
  const NS = 'http://www.w3.org/2000/svg';
  svg.setAttribute('class', cls);
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS(NS, 'path');
  path.setAttribute('d', g.path);
  const stops = Array.isArray(g.gradient) && g.gradient.length > 1 ? g.gradient : null;
  // `currentColor` on every shape, so the caller's colour is the one decision
  if (stops) {
    const id = `dfglyph-grad-${++gradientSerial}`;
    path.setAttribute('fill', `url(#${id})`);
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', String(GLYPH_EDGE_W));
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
    const defs = doc.createElementNS(NS, 'defs');
    const grad = doc.createElementNS(NS, 'linearGradient');
    grad.setAttribute('id', id);
    grad.setAttribute('gradientUnits', 'userSpaceOnUse');
    grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0'); grad.setAttribute('x2', '16'); grad.setAttribute('y2', '0');
    stops.forEach((rgba, i) => {
      const stop = doc.createElementNS(NS, 'stop');
      stop.setAttribute('offset', String(i / (stops.length - 1)));
      stop.setAttribute('stop-color', cssRgba(rgba) ?? '');
      grad.append(stop);
    });
    defs.append(grad);
    svg.append(defs);
  } else {
    if (GLYPH_STROKE[g.key]) {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', String(strokeWidth));
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
    } else path.setAttribute('fill', 'currentColor');
    svg.append(path);
  }
  if (g.detail?.path) {
    const d = doc.createElementNS(NS, 'path');
    d.setAttribute('d', g.detail.path);
    d.setAttribute('fill', cssRgba(g.detail.rgba) ?? 'currentColor');
    svg.append(d);
  }
  return svg;
}
