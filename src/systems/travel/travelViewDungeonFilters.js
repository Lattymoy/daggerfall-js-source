// @ts-check
// OW-DUNGEON-TYPES: which found dungeons the Overworld draws (a player's ask: dungeons by tier, regular or elite, one or both).
// Under the Dungeons switch (travelViewFilters.js), shown only while it is on: a found dungeon is drawn while its tier
// (Regular, Elite, Abyss: systems/dungeon/dungeonTier.js) and its size (Small, Medium, Large: world/dungeon/dungeonLabel.js)
// are on. Only found dungeons are judged: an unfound lair ("?") has neither and stays the Dungeons switch's alone,
// and a size not known is never hidden. The state is the tiers and sizes switched OFF, so a new tier shows until it is
// hidden. It is kept on the device, as the other filters are.
import { appStorage } from '../appStorage.js';
import { t } from '../textManager.js';   // L10N4: the panel's words are the port's own

export const TV_DUNGEON_STORE_KEY = 'dfjs.overworld.dungeons';
/** The tiers and sizes the switches list, with their words: [key, label]. The words are read when the panel is built. */
export const dungeonTierRows = () => [['regular', t('travel.dungeons.regular', 'Regular')], ['elite', t('travel.dungeons.elite', 'Elite')], ['super', t('travel.dungeons.abyss', 'Abyss')]];
export const dungeonSizeRows = () => [['small', t('travel.dungeons.small', 'Small')], ['medium', t('travel.dungeons.medium', 'Medium')], ['large', t('travel.dungeons.large', 'Large')]];
export const TV_DUNGEON_TEXT = Object.freeze({
  get title() { return t('travel.dungeons.title', 'Dungeon types'); },
  get tier() { return t('travel.dungeons.tier', 'Tier'); },
  get size() { return t('travel.dungeons.size', 'Size'); },
  tip: (/** @type {string} */ label, /** @type {boolean} */ on) => (on
    ? t('travel.dungeons.hide', 'Hide dungeons on the overworld: {label}', { label })
    : t('travel.dungeons.show', 'Show dungeons on the overworld: {label}', { label })),
});

/** @type {{ tiers: readonly string[], sizes: readonly string[] } | null} */
let state = null;
const listeners = new Set();

function read() {
  const s = { tiers: /** @type {string[]} */ ([]), sizes: /** @type {string[]} */ ([]) };
  let raw = null;
  try { raw = appStorage()?.getItem(TV_DUNGEON_STORE_KEY) ?? null; } catch { raw = null; }
  if (raw) {
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(v?.tiers)) s.tiers = v.tiers.filter((k) => typeof k === 'string');
      if (Array.isArray(v?.sizes)) s.sizes = v.sizes.filter((k) => typeof k === 'string');
    } catch { /* a bad word: the defaults */ }
  }
  return s;
}
/** The tiers and sizes switched off now: { tiers, sizes }. */
export function travelViewDungeons() {
  state ??= read();
  return state;
}
function set(next) {
  state = next;
  try { appStorage()?.setItem(TV_DUNGEON_STORE_KEY, JSON.stringify(next)); } catch { /* held for the session */ }
  for (const fn of [...listeners]) { try { fn(next); } catch { /* a listener's own fault */ } }
  return next;
}
/** Hear a change; returns the way to stop hearing it. */
export function onTravelViewDungeons(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Is a found dungeon of this tier and size drawn? A mark with neither is not judged. Pure over the state. */
export function dungeonTypeShown(tier, size, s = travelViewDungeons()) {
  if (typeof tier === 'string' && s.tiers.includes(tier)) return false;
  if (typeof size === 'string' && s.sizes.includes(size)) return false;
  return true;
}
/** Flip one tier. Returns its new state (shown). */
export function toggleDungeonTier(key) {
  const s = travelViewDungeons();
  const tiers = s.tiers.includes(key) ? s.tiers.filter((k) => k !== key) : [...s.tiers, key];
  return !set({ ...s, tiers }).tiers.includes(key);
}
/** Flip one size. Returns its new state (shown). */
export function toggleDungeonSize(key) {
  const s = travelViewDungeons();
  const sizes = s.sizes.includes(key) ? s.sizes.filter((k) => k !== key) : [...s.sizes, key];
  return !set({ ...s, sizes }).sizes.includes(key);
}
/** Pins: back to the device's word. */
export function _resetTravelViewDungeons() { state = null; listeners.clear(); }
