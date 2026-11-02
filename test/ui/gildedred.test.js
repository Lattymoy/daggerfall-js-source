// GILDED-RED (2026-10-22; bible/06-Systems/Gilded.md section 8; Mac: "Can we change the gilded rarity to red instead of
// gold (keep the gold skins) and give it a better indicator than 2 stars"). The owner chose from sheets rendered in the
// real Enhanced pack: Crimson for the rung, a gold crown with red jewels for its pips. The laws pinned:
//   - THE RUNG IN CRIMSON: the ladder's table, and the Plus sheet's vars in its colour - its light only 30% of the way
//     to white, so the bevel's lit edge reads red and not pink (the other tiers' lights stand nearer white).
//   - THE CROWN: the rung's pips are a picture - a gold crown, its outline drawn in, set with the rung's own crimson -
//     not a font's two stars; every place that draws a tier's pips draws it.
//   - EVERY HAND COPY IS THE TABLE'S: the breathing frame, the big picture's glow, the codex's found row, the quick
//     loot's gem - each in the table's crimson, and the old gold nowhere in the sheets.
//   - ON STONE'S GROUND: the post's win line lifts the crimson to its own light, as the audit lifted the darkest three.
//   - THE PAGE'S INK: DFO Grimoire deepens the crimson into an ink that reads on both its grounds.
//   - THE GOLD KEPT: the pieces' own art is still gold leaf - the ramp the sprite and the list pictures take.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RARITIES } from '../../src/systems/loot/lootRarity.js';
import { ITEM_FRAME_CSS, REFORGE_CSS, GILDED_CROWN_SVG, rarityVarsCss } from '../../src/ui/enhanced/enhancedPlusStyle.js';
import { ENHANCED_CSS } from '../../src/ui/enhanced/enhancedStyle.js';
import { tierMarkCss, TIER_MARKS } from '../../src/ui/lootTierMarks.js';
import { kitCss, G, RARITY_INK } from '../../src/ui/grimoireDress.js';
import { LOOT_BANNER_CSS } from '../../src/ui/lootBanner.js';
import { GILD_RAMP } from '../../src/combat/thunderlockArt.js';
import { PLUS_THEMES } from '../../src/ui/enhanced/enhancedFrame.js';

const CRIMSON = RARITIES.gilded.colour;
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const RGB = rgbOf(CRIMSON);
/** A tier's custom properties, read off the one table's rules. */
const varsOf = (tier) => {
  const rule = rarityVarsCss().split('\n').find((l) => l.startsWith(`[data-rarity="${tier}"] {`));
  return Object.fromEntries([...rule.matchAll(/(--rar[a-z-]*): ((?:url\("[^"]*"\))|[^;]*);/g)].map((m) => [m[1], m[2]]));
};
/** How far a light stands from its colour toward white, channel by channel (a channel already full has no way to go). */
const towardWhite = (hi, c) => rgbOf(hi).flatMap((h, i) => (rgbOf(c)[i] < 255 ? [(h - rgbOf(c)[i]) / (255 - rgbOf(c)[i])] : []));
const lum = (hex) => {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

test('GILDED-RED THE RUNG IN CRIMSON: the table\'s colour and tint, the Plus vars in it - its light 30% of the way to white, short of pink, where every other tier\'s stands past 40% (mutants: the table left gold; the tint left gold; the light the old 60%; the rgb drifted)', () => {
  assert.equal(CRIMSON, '#ff3b4a');
  assert.deepEqual(RARITIES.gilded.tint.slice(0, 3).map((v, i) => Math.abs(v * 255 - RGB[i]) <= 3), [true, true, true], 'the native scroller\'s tint is the crimson');
  assert.equal(RARITIES.gilded.tint[3], 0.6);
  const v = varsOf('gilded');
  assert.equal(v['--rar'], CRIMSON);
  assert.equal(v['--rar-rgb'], RGB.join(','));
  assert.equal(v['--rar-lo'], '#8e1622');
  for (const k of towardWhite(v['--rar-hi'], CRIMSON)) assert.ok(Math.abs(k - 0.3) < 0.01, `the light ${v['--rar-hi']} is 30% to white (${k.toFixed(3)})`);
  for (const t of ['magic', 'rare', 'legendary', 'artifact']) assert.ok(Math.min(...towardWhite(varsOf(t)['--rar-hi'], RARITIES[t].colour)) > 0.4, `${t}'s light stands nearer white`);
});

test('GILDED-RED THE CROWN: the rung\'s pips are a picture - an 11px gold crown, its outline drawn in, set with three jewels of the table\'s crimson - never the two stars; the pack\'s tile, the card\'s tier line and the loot banner\'s kicker all draw the pips (mutants: the stars back; the jewels gold; the outline dropped; a sheet\'s pips unset)', () => {
  const pips = varsOf('gilded')['--rar-pips'];
  assert.equal(pips, `url("data:image/svg+xml,${encodeURIComponent(GILDED_CROWN_SVG)}")`);
  assert.ok(!pips.includes('2726'), 'no star');
  assert.match(GILDED_CROWN_SVG, /^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg' width='11' height='11' viewBox='0 0 12 12' shape-rendering='crispEdges'>/);
  assert.match(GILDED_CROWN_SVG, /<path d='M1 10\.5V3l2\.5 3L6 1l2\.5 5L11 3v7\.5Z' fill='#f6c945' stroke='#050608' stroke-width='1\.4' paint-order='stroke'/, 'a gold crown, its black outline drawn in');
  assert.equal([...GILDED_CROWN_SVG.matchAll(/<rect [^>]*fill='([^']+)'\/>/g)].map((m) => m[1]).join(), [CRIMSON, CRIMSON, CRIMSON].join(), 'three jewels, the rung\'s crimson');
  for (const t of ['magic', 'rare', 'legendary', 'aetheric', 'artifact']) assert.match(varsOf(t)['--rar-pips'], /^'(\\[0-9a-f]{4})+'$/, `${t} keeps its glyphs`);
  assert.ok(ITEM_FRAME_CSS.includes('.pack-shell .pack-dock .itemrow[data-rarity]::before { content: var(--rar-pips);'), 'the tile');
  assert.ok(ITEM_FRAME_CSS.includes('.card[data-rarity] > ul.rarity > li:first-child::before, .card[data-rarity] > .card-body > ul.rarity > li:first-child::before { content: var(--rar-pips);'), 'the card');
  assert.ok(LOOT_BANNER_CSS.includes('.lb-kicker::after { content: var(--rar-pips, \'\');'), 'the banner');
  assert.ok(LOOT_BANNER_CSS.includes(`.lootbanner-stack [data-rarity="gilded"] { ${rarityVarsCss().split('\n').find((l) => l.startsWith('[data-rarity="gilded"] {')).slice('[data-rarity="gilded"] { '.length)}`), 'the banner\'s stack wears the crown');
});

test('GILDED-RED EVERY HAND COPY IS THE TABLE\'S: the breathing frame (and its still form), the big picture\'s glow and glint, the codex\'s found row, the quick loot\'s gem - the crimson, its rgb and its light; the old gold nowhere in the sheets (mutants: each copy left gold)', () => {
  const frame = ITEM_FRAME_CSS.slice(ITEM_FRAME_CSS.indexOf('@keyframes gilded-glow'), ITEM_FRAME_CSS.indexOf('/* AUDIT MERGE-PLUS D2'));
  const rgbas = [...frame.matchAll(/rgba\((\d+,\d+,\d+),/g)].map((m) => m[1]);
  assert.equal(rgbas.length, 7, 'the keyframes\' four, the big picture\'s one, the still glow\'s two');
  for (const c of rgbas) assert.equal(c, RGB.join(','));
  assert.ok(frame.includes(`drop-shadow(0 0 2px ${varsOf('gilded')['--rar-hi']})`), 'the glint in the rung\'s light');
  assert.ok(REFORGE_CSS.includes(`.broker-offer.codex-gilded.found .broker-name { color: ${CRIMSON}; }`), 'the codex\'s found row');
  assert.equal(TIER_MARKS.gilded, CRIMSON);
  const gem = tierMarkCss({ wash: (k) => TIER_MARKS[k], washAlpha: 0.2, edge: '#000' });
  const crownGold = GILDED_CROWN_SVG.match(/<path [^>]*fill='(#[0-9a-f]{6})'/)[1];
  assert.ok(gem.includes(`.wplaque-row[data-rarity="gilded"] > span:first-child::before { box-shadow: inset 0 0 0 2px ${crownGold}, 0 0 0 1px #000, 0 0 5px rgba(${RGB.join(', ')}, 0.8),`), 'the gem a crimson stone set in the crown\'s gold');
  for (const sheet of [ITEM_FRAME_CSS, REFORGE_CSS, ENHANCED_CSS, gem, LOOT_BANNER_CSS]) {
    assert.ok(!/ffcf4d|fff1b8|8f6410|255, ?207, ?77/i.test(sheet), 'the old gold is gone');
  }
});

test('GILDED-RED ON STONE\'S GROUND: the post\'s win line lifts the crimson to its own light there, as the audit lifted the three darkest - 2.3:1 on the theme\'s window ground, past 4.5:1 lifted, still a crimson (mutants: no lift; the lift the crimson itself)', () => {
  const ground = PLUS_THEMES.stone.ground;
  assert.ok(contrast(CRIMSON, ground) < 4.5, `the crimson alone: ${contrast(CRIMSON, ground).toFixed(2)}:1`);
  const lift = ENHANCED_CSS.match(/:root\[data-plus-theme="stone"\] \.px-postwin \[data-rarity="gilded"\] \{ color: (#[0-9a-f]{6}); \}/)?.[1];
  assert.ok(lift, 'lifted on Stone');
  assert.ok(contrast(lift, ground) >= 4.5, `${lift} on ${ground}: ${contrast(lift, ground).toFixed(2)}:1`);
  const [r, g, b] = rgbOf(lift);
  assert.ok(r === 255 && b >= g, 'the crimson\'s light - its blue over its green, as the crimson\'s');
});

test('GILDED-RED THE PAGE\'S INK: DFO Grimoire writes the rung in the crimson deepened - a red of the crimson\'s own hue that reads at 4.5:1 or better on the cream and on the page; the plaque\'s row wears it (mutants: the old amber; the pale crimson; the plaque\'s copy left amber)', () => {
  const ink = RARITY_INK.gilded;
  assert.equal(ink, '#a3122e');
  for (const ground of ['#efdcae', '#e3c995']) assert.ok(contrast(ink, ground) >= 4.5, `${ink} on ${ground}: ${contrast(ink, ground).toFixed(2)}:1`);
  const [r, g, b] = rgbOf(ink);
  assert.ok(r > 3 * g && r > 3 * b, 'red - not the old amber, whose green stood at half its red');
  assert.ok(kitCss().includes(`${G} .wplaque-row[data-rarity="gilded"] > span:first-child { color: ${ink} !important; }`), 'the plaque\'s row');
});

test('GILDED-RED THE GOLD KEPT: the pieces\' own art is still gold leaf - every step of the ramp the classic sprite and the list pictures take leans yellow, its green past half its red (mutant: the ramp turned to the crimson)', () => {
  assert.equal(GILD_RAMP.length, 7);
  for (const [r, g, b] of GILD_RAMP) assert.ok(r >= g && g >= b && g >= 0.55 * r, `${[r, g, b]} is gold`);
});
