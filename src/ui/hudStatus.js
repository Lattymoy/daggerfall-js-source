// @ts-check
// ═══════════════════════════════════════════════════════════════════
// UI3 (2026-09-27) - THE STATUS WIDGET.
//
// Mac: "move buffs/debuffs/etc to their own widget space somewhere on
// the side of the screen, where it doesn't interact with other UI
// elements, and use square icons with glyphs for each effect (climates
// and calories included)". The effects were TEXT chips in one row at
// the foot of the HUD - a spell's name and rounds, a set power's, a
// felt need's word - under the vitals and the Renown row, so the foot
// was crowded and the bar had no room for its numbers. They leave it
// for a column of SQUARE tiles at the left edge, standing on the
// quickslot block's caption (ui/enhancedHud.js mounts it there, so it
// rides the block's corner and scale and can never meet the diamond),
// one tile an effect:
//   - a SPELL: its own ICON00I0 icon (ui/enhancedArt.js
//     spellIconPicture, fitted by UI1's law), framed green when I cast
//     it on myself and red when another did, dashed for an item's held
//     magic; its rounds at its foot; blinking as it ends - under two
//     rounds, and never an item's (DFU's own laws, hudActiveSpells.js);
//   - a SET POWER: the sigil's rune in its set's colour, its window or
//     its recovery at its foot (a recovery dimmed and dashed, as the
//     chip was);
//   - a NEED (Climates & Calories - survival/status.js
//     survivalHudChips): the port's own pixel glyph for what the
//     classic art has no icon for - hunger, thirst, sleep, wet, hot,
//     cold, stiff, drunk - framed amber while it is felt and red while
//     it costs (the chips' own two levels: RED MEANS IT COSTS), how bad
//     at its foot ("2/3", NEED-TIER);
//   - a POISON and a DISEASE, shown at last - on the Status box's own
//     law (systems/healthStatus.js): a poison once it has left its
//     waiting, a disease once its incubation is over and by the name
//     its own message gives it (diseases.js DISEASE_NAMES), an
//     infection never (DFU says nothing of one until the dream).
// The name stands beside each tile where there is room; on a phone, or
// in a band too short for three rows, the tiles stand alone.
//
// THE BAND. The widget grows up from the caption and wraps into a next
// column before it meets whatever stands above it at the left edge -
// the chat's box, the escort faces, the touch layer's top buttons -
// measured by the HUD (statRoom), never assumed. Where there is no band
// at all - a phone on its side, where the diamond reaches the top, or
// the chat opened tall on a laptop - it stands BESIDE the diamond
// instead, as tall as the diamond (statPlace).
// ═══════════════════════════════════════════════════════════════════
import { DISEASE_NAMES } from '../systems/diseases.js';
import { HUD_NEED_WORDS } from '../systems/survival/status.js';

/** A tile's side: a 16px picture at two to one inside a 2px frame. */
export const STAT_TILE = 36;
/** The picture's box inside it. */
export const STAT_PIC = 32;
/** Between two rows - the foot's plate hangs half into it. */
export const STAT_GAP = 8;
/** Air under whatever stands above the band. */
export const STAT_AIR = 8;
/** The widget's own lift off the caption it stands on (the sheet's `.hud-stat` margin-bottom). */
export const STAT_LIFT = 8;
/** Fewer rows than this and the names go: a cramped band is icons alone. */
export const STAT_TIGHT_ROWS = 3;
/** More columns than this and the names go too: a widget of names five columns wide is a wall across the world. */
export const STAT_WIDE_COLUMNS = 2;
/** A SHORT screen - a phone on its side, where the quickslot diamond already reaches the top - and its smaller tiles: a
 *  16px picture at one and a half inside the same 2px frame, closer together (the sheet's own media rule says the same
 *  numbers; the diamond shrinks there too). */
export const STAT_SHORT_QUERY = '(max-height: 500px)';
/** @typedef {{ tile: number, pic: number, gap: number, colGap: number }} StatMetrics */
/** @type {Readonly<{ full: StatMetrics, short: StatMetrics }>} */
export const STAT_METRICS = Object.freeze({
  full: Object.freeze({ tile: STAT_TILE, pic: STAT_PIC, gap: STAT_GAP, colGap: 14 }),
  short: Object.freeze({ tile: 28, pic: 24, gap: 6, colGap: 10 }),
});
/** The widget keeps to the screen's left half: its right edge this far short of the middle, where the reticle is. */
export const STAT_MIDDLE_CLEAR = 24;
/** A name's widest, beside its tile (the sheet's `.hst-name` max-width) and the gap between them (`.hst-cell`'s): a column
 *  of names is this much wider than a column of tiles. */
export const STAT_NAME_MAX = 120;
export const STAT_NAME_GAP = 8;

/**
 * THE GLYPHS - drawn on the 16px grid the classic's own spell icons use, each pixel a letter: `k` the kit's black
 * outline (every glyph wears one, so it reads over any ground), `.` nothing, the rest the glyph's own palette. Made
 * from shapes and outlined by a machine, then looked at (tools/uiStatusProbe.mjs draws them all).
 */
export const STATUS_GLYPHS = Object.freeze({
  // REST1: a campfire - the flame over its crossed logs - while the night interval runs (Rested)
  rested: Object.freeze({ pal: { f: '#ffb02a', y: '#fff0a0', w: '#9a6a3a', d: '#5a3a1e' }, rows: [
    '................', '......kkkk......', '......kffk......', '.....kkffkk.....',
    '.....kffffk.....', '....kkfyyfkk....', '....kfyyyyfk....', '...kkfyyyyfkk...',
    '...kfffyyfffk...', '..kkkffffffkkk..', '.kkwwkkkkkkwwkk.', 'kkwwwddkkddwwwkk',
    'kwwkkwwddwwkkwwk', 'kkkkkkkwwkkkkkkk', '......kkkk......', '................',
  ] }),
  // a drumstick: the meat up and right, the bone down and left
  hunger: Object.freeze({ pal: { a: '#c8763a', b: '#e8a060', c: '#8a4a22', w: '#efe6cf' }, rows: [
    '................', '......kkkkkkk...', '.....kkbbbaakk..', '....kkbbbaaaakk.',
    '....kbbbaaaaaak.', '....kbbaaaaaaak.', '....kbaaaaaaack.', '....kaaaaaaacck.',
    '....kaaaaaaccck.', '...kkaaaaaccckk.', '.kkkwaaaacckkk..', 'kkwwwwkkkkkk....',
    'kwwwwkk.........', 'kwwwwk..........', 'kkwwwk..........', '.kkkkk..........',
  ] }),
  // a drop of water
  thirst: Object.freeze({ pal: { a: '#5d8fe0', b: '#b7d3ff', c: '#2f5cab' }, rows: [
    '................', '......kkkk......', '......kaak......', '.....kkaakk.....',
    '.....kaaaak.....', '....kkaaaakk....', '....kbaaaaak....', '...kkbaaaaakk...',
    '..kkabaaaaaakk..', '..kaabaaaaacck..', '..kaabaaaaccck..', '..kkabaaaccckk..',
    '...kaaaacccck...', '...kkkaccckkk...', '.....kkkkkk.....', '................',
  ] }),
  // a crescent moon and a z
  sleep: Object.freeze({ pal: { a: '#e8dfa8', c: '#b8a860', z: '#b7c8ff' }, rows: [
    '.........kkkkkkk', '.........kzzzzzk', '.........kkkkzkk', '...kkkk...kkzkk.',
    '..kkaak..kkzkkkk', '.kkaaak..kzzzzzk', 'kkaaakk..kkkkkkk', 'kaaaak..........',
    'kaaaakk.........', 'kaaaaakk........', 'kaaaaackk.kkk...', 'kaaaaccckkkck...',
    'kkaaccccccckk...', '.kkcccccccck....', '..kkccccckkk....', '...kkkkkkk......',
  ] }),
  // a cloud and its rain
  wet: Object.freeze({ pal: { a: '#aab4c4', b: '#dde4ee', c: '#7a8496', r: '#7fc7ff' }, rows: [
    '................', '......kkkkkkk...', '.....kkbbbbbk...', '..kkkkbbbbbbkk..',
    '.kkaaaaaaaaaakk.', '.kaaaaaaaaaaaak.', '.kaaaaaaaaaaaak.', '.kkaaaaaaaaaaak.',
    '..kccccccccccck.', '..kkkkkkkkkcckk.', '...krrkkrkkkrk..', '...krkkkrkkkrk..',
    '..kkrkkrrkkrkk..', '..krkkkrkkkrk...', '..kkk.kkk.kkk...', '................',
  ] }),
  // a sun - warm, hot, scorching
  hot: Object.freeze({ pal: { a: '#ffb02a', b: '#fff0a0', r: '#ff7a2a' }, rows: [
    '......kkkk......', '......krrk......', '..kkkkkrrkkkkk..', '..krrkkkkkkrrk..',
    '..krrkkkkkkrrk..', '..kkkkbbaakkkk..', 'kkkkkbbaaaakkkkk', 'krrkkbaaaaakkrrk',
    'krrkkaaaaaakkrrk', 'kkkkkaaaaaakkkkk', '..kkkkaaaakkkk..', '..krrkkkkkkrrk..',
    '..krrkkkkkkrrk..', '..kkkkkrrkkkkk..', '......krrk......', '......kkkk......',
  ] }),
  // a snowflake - cold, freezing, deadly cold
  cold: Object.freeze({ pal: { a: '#cfeeff', b: '#ffffff' }, rows: [
    '................', '.....kkkkkk.....', '..kkkkaaaakkkk..', '..kakkkaakkkak..',
    '..kkakkaakkakk..', '.kkkkakaakakkkk.', '.kakkkabbakkkak.', '.kaaaabbbbaaaak.',
    '.kaaaabbbbaaaak.', '.kakkkabbakkkak.', '.kkkkakaakakkkk.', '..kkakkaakkakk..',
    '..kakkkaakkkak..', '..kkkkaaaakkkk..', '.....kkkkkk.....', '................',
  ] }),
  // a bone, and the ache either side of it
  stiff: Object.freeze({ pal: { w: '#efe6cf', c: '#b8ab8c', r: '#e0584a' }, rows: [
    '.........kkkk...', '.........kcckk..', '.........kccckk.', '...kkk...kcckckk',
    '...krkk.kkccccck', '..kkkrkkkcccccck', '..krkkkkccckkkkk', '..kkkkkwwckk....',
    '....kkwwwkk.....', 'kkkkkwwwkkkkk...', 'kwwwwwwkkkkrk...', 'kwwwwwkk.krkkk..',
    'kkwkwwk..kkkrk..', '.kkwwck....kkk..', '..kkcck.........', '...kkkk.........',
  ] }),
  // a tankard and its foam
  drunk: Object.freeze({ pal: { a: '#c8963a', b: '#e8c070', c: '#7a5424', f: '#fff8e8' }, rows: [
    '......kkk.......', '..kkkkkfkk......', '.kkffffffkkk....', '.kfffffffffkk...',
    '.kffffffffffk...', '.kkfffffaffkk...', '..kbbaaaaaakkkk.', '..kccccccccaaak.',
    '..kbbaaaaaaakak.', '..kbbaaaaaaakak.', '..kbbaaaaaaakak.', '..kbbaaaaaaaaak.',
    '..kcccccccckkkk.', '..kbbaaaaaak....', '..kbbaaaaaak....', '..kkkkkkkkkk....',
  ] }),
  // a skull, in the poison's green
  poison: Object.freeze({ pal: { a: '#8fd46a', b: '#d4ffc0', c: '#4f9a3a' }, rows: [
    '......kkkk......', '....kkkbbkkk....', '...kkbbbaaakk...', '..kkbbbaaaaakk..',
    '..kbbbaaaaaaak..', '.kkbbaaaaaaaakk.', '.kbbkkaaaakkaak.', '.kbakkkaakkkaak.',
    '.kkaaaaaaaaaakk.', '..kaaaakkaaack..', '..kkaaaaaaackk..', '...kkaaaaackk...',
    '....kakaakck....', '....kaaaccck....', '....kkkkkkkk....', '................',
  ] }),
  // a spore
  disease: Object.freeze({ pal: { a: '#c8d24a', b: '#eef59a', c: '#6e7a18' }, rows: [
    '....kkkkkkkk....', '...kkaakkaakk...', '...kaaakkaaak...', '.kkkkaakkaakkkk.',
    'kkakkkabbakkkakk', 'kaaakbbbbaakaaak', 'kaaaabbbaaaaaaak', 'kkkkbbbcaaaakkkk',
    'kkkkbbaaacaakkkk', 'kaaaaaacaaaaaaak', 'kaaakaaaaaakaaak', 'kkakkkaaaakkkakk',
    '.kkkkaakkaakkkk.', '...kaaakkaaak...', '...kkaakkaakk...', '....kkkkkkkk....',
  ] }),
});
/** The kit's outline black (ui/enhancedFrame.js FRAME_TONES.outline). */
const OUTLINE = '#050608';

/** A glyph as an SVG on its 16px grid - one rect a run of a colour along a row - or null for a name there is none of. */
export function statusGlyphSvg(name) {
  const g = Object.hasOwn(STATUS_GLYPHS, name) ? STATUS_GLYPHS[name] : null;
  if (!g) return null;
  let body = '';
  g.rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') body += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${ch === 'k' ? OUTLINE : g.pal[ch]}"/>`;
      x = end;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${body}</svg>`;
}
const _srcs = new Map();
/** A glyph as a picture's source (an `<img>`'s src), made once a name. */
export function statusGlyphSrc(name) {
  if (!_srcs.has(name)) {
    const svg = statusGlyphSvg(name);
    _srcs.set(name, svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : null);
  }
  return _srcs.get(name);
}

/**
 * The poisons and diseases the widget shows - the Status box's law (systems/healthStatus.js healthStatusRows): ONE
 * tile for being poisoned, once any poison has left its waiting (the game names none: "You have been poisoned."); a
 * tile a disease whose incubation is over, by its name; nothing for an entry that has ended, one still waiting or
 * incubating, or an infection (no disease row: `disease` null).
 * @param {any} entity
 * @returns {{ key: string, name: string, glyph: string }[]}
 */
export function afflictionRows(entity) {
  const out = [];
  let poisoned = false;
  for (const a of entity?.activeEffects ?? []) {
    if (!a || a.ended) continue;
    if (a.kind === 'poison' && a.state !== 'waiting') poisoned = true;
    else if (a.kind === 'disease' && a.incubationOver && a.disease != null && DISEASE_NAMES[a.disease]) {
      out.push({ key: `disease:${a.disease}`, name: DISEASE_NAMES[a.disease], glyph: 'disease' });
    }
  }
  if (poisoned) out.unshift({ key: 'poison', name: 'Poisoned', glyph: 'poison' });
  return out;
}

let _coldWords = null;
/** A need chip's glyph: its own key's, and the temperature's by which way it runs - the cold words (read off the
 *  chips' own table, never restated) a snowflake, the warm ones the sun. */
export function needGlyph(chip) {
  if (chip?.key === 'temp') {
    _coldWords ??= new Set(['cold', 'freezing', 'deadly cold'].map((w) => HUD_NEED_WORDS.temp[w][0]));
    return _coldWords.has(chip.text) ? 'cold' : 'hot';
  }
  return Object.hasOwn(STATUS_GLYPHS, chip?.key) ? chip.key : null;
}

/**
 * @typedef {{ key: string, kind: 'buff'|'debuff'|'set'|'warn'|'danger'|'more', name: string, foot: string|null,
 *   blink: boolean, item: boolean, recovering: boolean, spell: number|null, glyph: string|null, set: string|null,
 *   bundle: number|null, endable: boolean }} StatusTile
 */
/**
 * The widget's tiles, in the order the foot row read them: the spells (mine, then others'), the set powers, the
 * poisons and diseases, the needs.
 * @param {{ spells?: any[], powers?: any[], afflictions?: any[], needs?: any[], rested?: { minutes: number }|null }} lists - `spells` ui/enhancedHud.js
 *   effectRows, `powers` the host's set chips (systems/sigilSetPowers.js setHudChips), `afflictions` afflictionRows,
 *   `needs` survivalHudChips, `rested` REST1's night interval (its real minutes left)
 * @returns {StatusTile[]}
 */
export function statusTiles({ spells = [], powers = [], afflictions = [], needs = [], rested = null } = {}) {
  /** @type {StatusTile[]} */
  const out = [];
  const tile = (t) => out.push({ foot: null, blink: false, item: false, recovering: false, spell: null, glyph: null, set: null, bundle: null, endable: false, ...t });
  spells.forEach((e, i) => tile({
    // AUDIT UI C3: a party mate's gift is a BUFF - ALLY-CAST lets a mate lay only what helps (systems/allyCast.js)
    key: `spell${i}`, kind: e.self || e.ally ? 'buff' : 'debuff', name: String(e.name ?? ''),
    // AUDIT UI C5: and an item's held magic has no time at its foot - it runs while the item is held, its rounds are no
    // clock (they count down to nothing and it runs on)
    foot: Number.isFinite(e.rounds) && !e.item ? String(e.rounds) : null,
    blink: !!e.expiring && !e.item,   // SetIconBlinkState: an item's never blinks
    item: !!e.item, spell: Number.isInteger(e.icon) && e.icon >= 0 ? e.icon : null,
    bundle: e.bundleId ?? null, endable: !!e.endable && e.bundleId != null,   // BUFF-END: a right-click ends it (ui/enhancedHud.js)
  }));
  for (const c of powers) tile({ key: `set:${c.key}`, kind: 'set', name: String(c.name ?? ''), foot: c.text ? String(c.text) : null, recovering: c.state === 'recovering', set: c.set ?? null });
  for (const a of afflictions) tile({ key: a.key, kind: 'debuff', name: a.name, glyph: a.glyph });
  // NEED-TIER: and how bad, at its foot ("2/3" - Hungry of Peckish, Hungry, Starving), as a spell's rounds are: the glyph
  // is one picture for every stage and the name goes where there is no room, so the foot is what says it there
  for (const c of needs) tile({ key: `need:${c.key}`, kind: c.level === 'danger' ? 'danger' : 'warn', name: String(c.text ?? ''), glyph: needGlyph(c), foot: c.tier ? `${c.tier}/${c.of}` : null });
  // REST1: Rested - the night interval's real minutes left at its foot (systems/restAct.js nightRealMinutesLeft), a buff
  if (rested?.minutes > 0) tile({ key: 'rested', kind: 'buff', name: 'Rested', foot: `${rested.minutes}m`, glyph: 'rested' });
  return out;
}

/**
 * How tall the widget may stand above the caption, in its block's own (unscaled) pixels: from the caption it stands on
 * (`captionTop`, a screen y) up to whatever stands above the band (`above`, a screen y - the chat's box, the escort
 * faces, the touch layer's buttons), less the air under that and the widget's own lift, over the HUD's scale. Under a
 * tile (even under nothing) where there is no band.
 */
export function statRoom({ captionTop, above = 0, scale = 1 }) {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const room = Math.floor((captionTop - Math.max(0, Number(above) || 0) - STAT_AIR) / s - STAT_LIFT);
  return Number.isFinite(room) ? room : 0;
}
/** How many rows of tiles a room holds (one at the least), at a screen's tile and gap. */
export const statRows = (room, m = STAT_METRICS.full) => Math.max(1, Math.floor((room + m.gap) / (m.tile + m.gap)));

/**
 * The band BESIDE the diamond, in the block's own pixels: from the caption's top - or from under whatever stands above
 * (`above`, as statRoom reads it) where that reaches lower, so a chat's peek lines crossing the diamond on a phone on its
 * side pass over no tile - down to the diamond's bottom. `offset` is where the band starts below the caption's top (the
 * widget's `top` while it stands there); `room` is 0 with no diamond (the hotbar up, the switch off).
 */
export function statSide({ captionTop, diamondBottom, above = 0, scale = 1 }) {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (!Number.isFinite(diamondBottom) || !Number.isFinite(captionTop) || diamondBottom <= captionTop) return { room: 0, offset: 0 };
  const top = Math.max(captionTop, Math.max(0, Number(above) || 0) + STAT_AIR);
  return { room: Math.max(0, Math.floor((diamondBottom - top) / s)), offset: Math.round((top - captionTop) / s) };
}

/** How many columns of tiles a width holds (one at the least), at a screen's tile and column gap. */
export const statColumns = (width, m = STAT_METRICS.full) => Math.max(1, Math.floor((width + m.colGap) / (m.tile + m.colGap)));

/**
 * Where the widget stands, in how many rows and at most how many columns: ABOVE the caption while the band there holds
 * two rows or more (or all the tiles); BESIDE the diamond (`side`, as tall as its band - `sideRoom`, statSide's) where
 * the band above holds one row or none and the diamond holds more - a row of a dozen tiles is a strip across the world,
 * a column beside the diamond is not; NOWHERE (`none`) where neither holds a tile - the chat opened over the whole left
 * edge of a phone on its side - rather than over what stands there: it steps aside until there is room again. Its
 * columns stop short of the screen's middle (`aboveWidth` / `sideWidth`, the block's pixels from where it would start to
 * the middle less STAT_MIDDLE_CLEAR): it is the left edge's, and the reticle is the middle's (statOverflow folds what
 * does not fit). The names stand only while there is room for them - three rows or more, two columns at the most for
 * `count` tiles, and never beside the diamond.
 * @param {{ room: number, sideRoom?: number, count: number, metrics?: { tile: number, pic: number, gap: number, colGap: number },
 *   aboveWidth?: number, sideWidth?: number }} band
 * @returns {{ side: boolean, rows: number, columns: number, tight: boolean, none: boolean }}
 */
export function statPlace({ room, sideRoom = 0, count, metrics = STAT_METRICS.full, aboveWidth = Infinity, sideWidth = Infinity }) {
  const n = Math.max(1, count);
  const above = room >= metrics.tile ? statRows(room, metrics) : 0;
  const beside = sideRoom >= metrics.tile ? statRows(sideRoom, metrics) : 0;
  if (!above && !beside) return { side: false, rows: 1, columns: 1, tight: true, none: true };
  const side = beside > above && above < Math.min(2, n);
  const rows = side ? beside : above;
  const width = side ? sideWidth : aboveWidth;
  const columns = Number.isFinite(width) ? statColumns(width, metrics) : Math.ceil(n / rows);
  const cols = Math.ceil(n / rows);
  // AUDIT UI C2: a column of names is wider than a column of tiles - the names stand only where their columns fit short
  // of the middle too (two columns ran 45px past it at 1.5x on a 1024px screen, and nothing folded)
  const named = cols * (metrics.tile + STAT_NAME_GAP + STAT_NAME_MAX) + (cols - 1) * metrics.colGap;
  const tight = side || rows < STAT_TIGHT_ROWS || cols > STAT_WIDE_COLUMNS || (Number.isFinite(width) && named > width);
  return { side, rows, columns, tight, none: false };
}

/**
 * The tiles that fit `rows` x `columns`: all of them, or all but the last few folded into one more tile - "+3" - that
 * says how many it stands for (the Status box and the sheet say them all).
 * @param {StatusTile[]} tiles
 * @returns {StatusTile[]}
 */
export function statOverflow(tiles, { rows, columns }) {
  const room = Math.max(1, rows) * Math.max(1, columns);
  if (tiles.length <= room) return tiles;
  const shown = tiles.slice(0, room - 1);
  const more = tiles.length - shown.length;
  return [...shown, { key: 'more', kind: 'more', name: `${more} more`, foot: `+${more}`, blink: false, item: false, recovering: false, spell: null, glyph: null, set: null, bundle: null, endable: false }];   // BUFF-END: "+N" ends nothing
}
