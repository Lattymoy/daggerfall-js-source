// @ts-check
// QUICK-LOOT-FILTER - WHAT THE TAKE-ALL WANTS, AND WHAT THE WORLD NEED NOT SHOW. The Quick loot row's boxes (systems/features.js):
// a box a rarity tier, a box a gear material, a list of names to skip, and three switches that keep the hover plaque down.
// Every one is the player's own pref, and the defaults take everything. `filterLeaves` is the rarity and material word.
// `takeAllLeaves` (quickLoot.js) asks it, and `hoverHidden` asks `takeAllLeaves` through a seam, so the plaque and the
// take-all never disagree on what a pile holds. Not a DFU member: Daggerfall has no loot filter. Ledger A.
import { getPref, setPref } from './uiPrefs.js';
import { lootRarityOn, rarityOf, RARITY_ORDER } from './loot/lootRarity.js';
import { materialName, itemNameParts } from './item/itemInfo.js';

export const QL_RARITY_PREF = (/** @type {string} */ tier) => `quickLootRar_${tier}`;
export const QL_MATERIAL_PREF = (/** @type {string} */ name) => `quickLootMat_${name}`;
export const QL_MATERIAL_COMMON = 'quickLootMatCommon';
export const QL_HIDE_EMPTY = 'quickLootHideEmpty';
export const QL_HIDE_DULL = 'quickLootHideDull';
export const QL_HIDE_DROPS = 'quickLootHideDrops';
export const QL_HIDE_LEFT = 'quickLootHideLeft';
export const QL_SKIP = 'quickLootSkip';
/** How a skip entry matches a name, and how many entries the list holds. */
export const QL_SKIP_MODES = Object.freeze([['contains', 'Contains'], ['exact', 'Exact'], ['regex', 'Regex']]);
export const QL_SKIP_MAX = 40;
export const QL_SKIP_TEXT_MAX = 60;
/** The tiers the checkboxes list, lowest first (the ladder's own order). */
export const QL_RARITIES = RARITY_ORDER;

/** A box is ticked unless the player has unticked it (a tier or material added later is taken until it is unticked). */
const ticked = (/** @type {string} */ key) => getPref(key) !== false;

/**
 * Whether the rarity and material switches leave a piece of gear on the pile. Pure over the prefs.
 * @param {any} item
 * @param {boolean} gear whether the piece is a graded kind (the caller's own test - quickLoot.js JUNK_GROUPS, no ammunition)
 */
export function filterLeaves(item, gear = true) {
  if (!item || item.questItem || !gear) return false;
  const tier = rarityOf(item);
  if (lootRarityOn() && !ticked(QL_RARITY_PREF(tier))) return true;
  if ((item.group !== 'Weapons' && item.group !== 'Armor') || !Number.isInteger(item.material) || item.material < 0) return false;   // a jewel and a garment have no material (materialName reads an unset one as Iron)
  const metal = materialName(item);
  if (!metal || ticked(QL_MATERIAL_PREF(metal))) return false;
  return getPref(QL_MATERIAL_COMMON) === true ? tier === 'common' : true;
}

/** The hover keys of a body, and of a piece lying on the ground (worldHover.js ITEMISED_KEYS). */
const BODY_KEYS = Object.freeze(['corpse:', 'foeCorpse:', 'guardCorpse:']);
const DROP_KEYS = Object.freeze(['droppedLoot:', 'spoil:']);
const keyIn = (/** @type {string} */ key, /** @type {readonly string[]} */ list) => typeof key === 'string' && list.some((p) => key.startsWith(p));

/** The take-all's own word on a piece (quickLoot.js takeAllLeaves, which registers itself here): systems/quickLoot.js imports
 *  worldHover.js, so worldHover.js cannot import it back - the plaque asks through this seam. Until it registers, nothing is left. */
let _leaves = (/** @type {any} */ _item) => false;
/** The Quick loot row's own switch (quickLoot.js quickLootOn reads the same pref; it cannot be imported back here). Off is
 *  Daggerfall's loot: no plaque is hidden, no body is out of the pick, no row is dropped from a list. */
const quickLootActive = () => !!getPref('quickLoot');
export function setTakeAllLeaves(/** @type {(item: any) => boolean} */ fn) { _leaves = fn; }

/**
 * Whether the hover plaque stays down for this key and what it holds. Pure over the prefs.
 * @param {string} key the activation key under the crosshair
 * @param {any[]} items what the container holds (the plaque's own rows)
 * @param {(item: any) => boolean} [leaves] whether the take-all leaves a piece - the registered takeAllLeaves unless handed one
 */
export function hoverHidden(key, items, leaves = _leaves) {
  if (!quickLootActive()) return false;
  if (keyIn(key, BODY_KEYS)) {
    if (!items.length) return getPref(QL_HIDE_EMPTY) === true;
    return getPref(QL_HIDE_DULL) === true && items.every(leaves);
  }
  if (keyIn(key, DROP_KEYS)) return getPref(QL_HIDE_DROPS) === true && items.length > 0 && items.every(leaves);
  return false;
}

/**
 * Whether a BODY is out of the pick: its plaque would stay down (hoverHidden), so it takes no press either - the ray passes
 * through it to the next body of a pile, and a body the player has already gone through is not opened again for the gear
 * left on it. A body whose list is not known (null: another player's, not yet heard) is never hidden.
 * @param {string} key @param {any[]|null|undefined} items
 */
export function bodyHidden(key, items) {
  return Array.isArray(items) && hoverHidden(key, items.filter(Boolean));
}
/** A dungeon body's pick fields: a body, and out of the pick while its plaque is down (player/activate.js reads `skip`). `contents(key)` is the host's list. */
export const bodyTarget = (/** @type {string} */ key, /** @type {(key: string) => any[]|null|undefined} */ contents) => ({ body: true, skip: () => bodyHidden(key, contents(key)) });

// ── SKIP BY NAME ────────────────────────────────────────────────────────────────────────────
// A list of names the take-all leaves (and the plaque stays down for, with the boxes above): each entry `{ mode, text }`,
// matched against the name the plaque prints (itemNameParts) and the item's own names, without regard to case. It binds ANY
// piece but a quest's item - a Raw meat is no gear - and ahead of every other box.
/** @type {Map<string, RegExp|null>} */
const _regex = new Map();
/**
 * REGEX-SAFE: whether a pattern is one the browser's matcher cannot be made to stall on. A name is matched on the main thread, and
 * a pattern with a quantified group (`(a+)+`, `(a|aa)*`), a backreference or a lookaround can take exponential time on a name that
 * almost matches. None of those is allowed. What is left - literals, classes, anchors, alternation, a quantifier on a single
 * character or class - runs in time that grows with the pattern times the name, and both are bounded (QL_SKIP_TEXT_MAX, NAME_MATCH_MAX).
 * Pure.
 */
export function regexIsSafe(/** @type {string} */ text) {
  let inClass = false, closedGroup = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') { if (/[1-9k]/.test(text[i + 1] ?? '')) return false; i++; closedGroup = false; continue; }   // \1 and \k<name> are backreferences
    if (inClass) { if (c === ']') inClass = false; continue; }
    if (c === '[') { inClass = true; closedGroup = false; continue; }
    if (c === '(' && text[i + 1] === '?' && !(text[i + 2] === ':' || (text[i + 2] === '<' && text[i + 3] !== '=' && text[i + 3] !== '!'))) return false;   // (?= (?! (?<= (?<!
    if (closedGroup && (c === '*' || c === '+' || c === '?' || (c === '{' && /^\{\d+(,\d*)?\}/.test(text.slice(i))))) return false;
    closedGroup = c === ')';
  }
  return true;
}
/** The longest name a pattern is run against: the longest an item name is is far below it. */
export const NAME_MATCH_MAX = 200;
const compiled = (/** @type {string} */ text) => {
  if (!_regex.has(text)) { let re = null; try { re = regexIsSafe(text) ? new RegExp(text, 'i') : null; } catch { re = null; } _regex.set(text, re); }   // a bad or unsafe pattern matches nothing
  return _regex.get(text) ?? null;
};
/** Is a pattern a pattern? Pure - the drawer says so before it adds one. */
export const validSkipEntry = (/** @type {any} */ e) => !!e && typeof e.text === 'string' && e.text.trim() !== '' && e.text.length <= QL_SKIP_TEXT_MAX
  && QL_SKIP_MODES.some(([m]) => m === e.mode) && (e.mode !== 'regex' || compiled(e.text) !== null);
/** The skip list now: the valid entries of the pref. */
export const skipList = () => { const v = getPref(QL_SKIP); return Array.isArray(v) ? v.filter(validSkipEntry).slice(0, QL_SKIP_MAX) : []; };
/** Does one entry match one name? Pure. */
export function skipMatches(/** @type {{ mode: string, text: string }} */ e, /** @type {string} */ name) {
  const n = String(name ?? '').toLowerCase(), t = e.text.trim().toLowerCase();
  if (!n) return false;
  return e.mode === 'exact' ? n === t : e.mode === 'regex' ? !!compiled(e.text)?.test(String(name).slice(0, NAME_MATCH_MAX)) : n.includes(t);
}
/** Whether the player's skip list leaves this piece (a quest's item never). Pure over the prefs. */
export function nameLeaves(/** @type {any} */ item) {
  if (!item || item.questItem) return false;
  const list = skipList();
  if (!list.length) return false;
  const names = [itemNameParts(item).name, item.name, item.shortName].filter((n) => typeof n === 'string' && n);
  return list.some((e) => names.some((n) => skipMatches(e, n)));
}

// ── THE OLD TIER BAR ────────────────────────────────────────────────────────────────────────
let _migrated = false;
/** The Take gear bar (`quickLootTier`: All, Magic+, Rare+) is gone from the row - the rarity boxes say what it said. A word
 *  stored by an earlier build is carried over once: Magic+ unticks Common, Rare+ unticks Common and Magic, and the bar is
 *  set back to All, so no hidden setting goes on leaving gear the player cannot see why. */
export function migrateQuickLootTier() {
  if (_migrated) return;
  _migrated = true;
  const tier = getPref('quickLootTier');
  if (tier !== 'magic' && tier !== 'rare') return;
  setPref(QL_RARITY_PREF('common'), false);
  if (tier === 'rare') setPref(QL_RARITY_PREF('magic'), false);
  setPref('quickLootTier', 'all');
}
export const _resetMigration = () => { _migrated = false; _regex.clear(); };

/**
 * The rows a pile's list draws and the take walks: with `quickLootHideLeft` on, the pieces the take-all would leave are not in
 * the list at all (the plaque, the wheel and the lit row's take read this one walk - systems/worldHover.js hoverItems - so the row
 * the player sees is the piece the take moves). The pile itself is untouched: the classic window, a click and the take-all
 * still see every piece. Pure over the prefs.
 * @param {any[]} items the pile's pieces, holes already dropped
 */
export function hoverVisible(items) {
  return quickLootActive() && getPref(QL_HIDE_LEFT) === true ? items.filter((it) => !_leaves(it)) : items;
}
