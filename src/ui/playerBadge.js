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
});

/** A title's colour, RGBA 0..1 - the same shape SOC4's PARTY_GREEN is
 *  in, so `nameLayer.cssRgba` turns it into CSS and `drawText` takes it
 *  as a tint, and neither face writes a colour down a second time.
 *  Mac: Founder gold, Developer red. */
export const TITLE_RGBA = Object.freeze({
  founder: Object.freeze([1, 0.784, 0.29, 1]),      // #ffc84a
  developer: Object.freeze([0.886, 0.271, 0.227, 1]), // #e2453a
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
});

/** THE CLASSIC FACE'S STAND-IN: one character, and it must be one the
 *  Daggerfall font actually has a record for or it draws as nothing at
 *  all. Held inside FONT0003's printable range by a pin. */
export const GLYPH_MARK = Object.freeze({
  sprout: '+',
  dev: '*',
  mod: '#',   // MOD1: the classic face has no shield; a hash reads as a badge at that size
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
});

/** Is this glyph DRAWN as an outline rather than filled? The sprout is
 *  a shape and the brackets are strokes; said here so the layer does
 *  not have to know which is which by name. */
export const GLYPH_STROKE = Object.freeze({ sprout: true, dev: true, mod: true });

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
  return { key, text, rgba: TITLE_RGBA[key] ?? null };
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
    out.push({ key, mark: GLYPH_MARK[key] ?? '', rgba: GLYPH_RGBA[key] ?? null, path: GLYPH_PATH[key] ?? '' });
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
export const badgeCss = () => [
  ...TITLES.map((t) => `.card button.acttitle.${badgeClass('tl', t)} { color: ${cssRgba(TITLE_RGBA[t])}; }`),
  ...GLYPHS.map((g) => `.card .acctglyph.${badgeClass('gl', g)} .acctglyphart { color: ${cssRgba(GLYPH_RGBA[g])}; }`),
].join('\n');

/** The classic face's whole suffix: the marks, run together, or ''.
 *  One string, because that face draws a run and measures it. */
export const glyphMarks = (peer) => glyphBadges(peer).map((g) => g.mark).join('');
