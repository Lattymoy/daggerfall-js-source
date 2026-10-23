// LOOT-MARKS (2026-10-12, Mac with a player's video: "seeing rarity in the quickloot is quite hard can you make em more
// visible"): A TIER YOU SEE AT A GLANCE. The quick loot's plaque told a tier only by its name's colour - on Enhanced Plus's
// dark stone the Aetheric's pale blue stood beside a common's bone, the Rare's gold beside the Gilded's; on DFO Grimoire's
// page every tier is deepened into the ink (RARITY_INK) and the Rare, the Legendary and the Gilded read as three browns.
// Each rolled row now carries its tier twice more: a GEM before its name - a square of the tier's own bright colour
// (systems/loot/lootRarity.js RARITIES, test/ui/lootmarks1.test.js holds the two tables equal), edged dark so it stands on stone
// and on paper alike - and a WASH, the row laid on its tier's colour fading to the right. A common row wears neither.
// A leaf: the colours and the two sheets' rules, no import.

/** Each rolled tier's own colour - RARITIES[tier].colour (common has none). */
export const TIER_MARKS = Object.freeze({
  magic: '#6f9ee8', rare: '#e4c34f', legendary: '#e07a2e', aetheric: '#bfe8ff', artifact: '#b57bee', gilded: '#ff3b4a',
});
/** The gem's side in CSS pixels, and the gap after it. */
export const TIER_GEM_PX = 9;
export const TIER_GEM_GAP_PX = 7;

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** The rules for one sheet. `scope` the selector the plaque sits under ('' for Plus's own sheet); `wash(tier)` the
 *  wash's colour for that tier (the stone's: its own bright colour; the page's: its ink tone); `edge` the gem's
 *  outline; `selGround` the lit row's own band, laid under the wash so a lit tier keeps both (null: the wash alone,
 *  stronger); `bang` whether each must say !important (the dress's ink pass re-says Plus's colours). */
export function tierMarkCss({ scope = '', wash, washAlpha, edge, selGround = null, bang = false }) {
  const b = bang ? ' !important' : '';
  const at = (s) => (scope ? `${scope} ${s}` : s);
  const out = [
    // the row reaches the plaque's inner edges, as the lit row does, so its wash is a band - its words do not move
    `${at('.wplaque-row[data-rarity]')} { margin: 0 calc(-1 * var(--wp-pad-x, 14px))${b}; padding: 0 var(--wp-pad-x, 14px)${b}; }`,
    `${at('.wplaque-row[data-rarity] > span:first-child::before')} { content: ''${b}; display: inline-block${b}; width: ${TIER_GEM_PX}px${b}; height: ${TIER_GEM_PX}px${b}; margin-right: ${TIER_GEM_GAP_PX}px${b}; vertical-align: 0${b}; box-shadow: 0 0 0 1px ${edge}, 1px 2px 0 rgba(0,0,0,0.45)${b}; }`,
  ];
  for (const [k, c] of Object.entries(TIER_MARKS)) {
    const w = wash(k);
    out.push(`${at(`.wplaque-row[data-rarity="${k}"]`)} { background: linear-gradient(90deg, ${rgba(w, washAlpha)}, ${rgba(w, washAlpha * 0.35)} 55%, ${rgba(w, 0)} 92%)${b}; }`);
    out.push(`${at(`.wplaque-row.sel[data-rarity="${k}"]`)} { background: linear-gradient(90deg, ${rgba(w, Math.min(1, washAlpha * 1.5))}, ${rgba(w, washAlpha * 0.5)} 60%, ${rgba(w, 0.04)} 100%)${selGround ? `, ${selGround}` : ''}${b}; }`);
    out.push(`${at(`.wplaque-row[data-rarity="${k}"] > span:first-child::before`)} { background: ${c}${b}; }`);
  }
  // the Gilded's gem is set, not painted: GILDED-RED's crimson stone in a rim of the crown's gold, and a glint
  out.push(`${at('.wplaque-row[data-rarity="gilded"] > span:first-child::before')} { box-shadow: inset 0 0 0 2px #f6c945, 0 0 0 1px ${edge}, 0 0 5px rgba(255, 59, 74, 0.8), 1px 2px 0 rgba(0,0,0,0.45)${b}; }`);
  return out.join('\n');
}
