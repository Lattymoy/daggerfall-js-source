// @ts-check
// OW-ENEMY-TYPES - WHICH ENEMY GROUPS THE OVERWORLD DRAWS (a player's ask: "only see packs of wolves").
// Under the Enemies switch (travelViewFilters.js), shown while it is on, are the creature types. A group is drawn
// while its type is on. A group's type is the kind its label names: the first member's mobile type.
// `hidden` holds the types switched OFF, so a type a mod adds later is drawn until it is hidden. A mark with no
// `foe` (a raider's ship, a rite's faithful, a chase) is never filtered.
// The list is every table the encounter law may read (encounterTableChoices, a mod's too), named by enemyDisplayName.
// ═══════════════════════════════════════════════════════════════════
import { appStorage } from '../appStorage.js';
import { t } from '../textManager.js';
import { ENCOUNTER_TABLES } from '../../characters/encounterTables.js';
import { encounterTableChoices, encounterTableGeneration } from '../../characters/encounterTableDoor.js';
import { enemyDisplayName } from '../../characters/enemy/enemyBasics.js';

export const TV_ENEMY_STORE_KEY = 'dfjs.overworld.enemies';

/** The panel's words, said in the player's language (read when they are drawn, not when this file loads). */
export const TV_ENEMY_TEXT = Object.freeze({
  get title() { return t('overworld.enemyTypes.title', 'Enemy types'); },
  head: (shown, all) => t('overworld.enemyTypes.head', 'Creatures {shown}/{all}', { shown, all }),
  typeTip: (label, on) => (on
    ? t('overworld.enemyTypes.tipHide', 'Hide {label} groups on the overworld', { label: label.toLowerCase() })
    : t('overworld.enemyTypes.tipShow', 'Show {label} groups on the overworld', { label: label.toLowerCase() })),
  get all() { return t('overworld.enemyTypes.all', 'All'); },
  get none() { return t('overworld.enemyTypes.none', 'None'); },
});

/** @typedef {{ key: string, label: string }} EnemyType */

/** @type {{ gen: number, types: EnemyType[] } | null} */
let catalogue = null;
/** The creature types a band or a camp can be, alphabetical - read again when a mod registers a table. */
export function enemyCatalogue() {
  const gen = encounterTableGeneration();
  if (catalogue?.gen === gen) return catalogue.types;
  const ids = new Set();
  for (let i = 0; i < ENCOUNTER_TABLES.length; i++) for (const t of encounterTableChoices(i)) for (const id of t) if (Number.isSafeInteger(id) && id >= 0) ids.add(id);
  const types = [...ids]
    .map((id) => ({ key: String(id), label: enemyDisplayName(id) ?? '' }))
    .filter((t) => t.label)
    .sort((a, b) => a.label.localeCompare(b.label) || Number(a.key) - Number(b.key));
  catalogue = { gen, types };
  return types;
}

/** @type {{ hidden: readonly string[] } | null} */
let state = null;
const listeners = new Set();

function read() {
  const s = { hidden: /** @type {string[]} */ ([]) };
  let raw = null;
  try { raw = appStorage()?.getItem(TV_ENEMY_STORE_KEY) ?? null; } catch { raw = null; }
  if (raw) {
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(v?.hidden)) s.hidden = v.hidden.filter((k) => typeof k === 'string');
    } catch { /* a bad word: the defaults */ }
  }
  return s;
}

/** The types switched off now: { hidden }. */
export function travelViewEnemies() {
  state ??= read();
  return state;
}

function set(next) {
  state = next;
  try { appStorage()?.setItem(TV_ENEMY_STORE_KEY, JSON.stringify(next)); } catch { /* held for the session */ }
  for (const fn of [...listeners]) { try { fn(next); } catch { /* a listener's own fault */ } }
  return next;
}

/** Hear a change; returns the way to stop hearing it. */
export function onTravelViewEnemies(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Is a group of this mobile type drawn? A mark with no type is. Pure over the state. */
export function enemyTypeShown(type, s = travelViewEnemies()) {
  if (type === undefined || type === null) return true;
  return !s.hidden.includes(String(type));
}

/** Flip one type. Returns its new state (shown). */
export function toggleEnemyType(key) {
  const s = travelViewEnemies();
  const hidden = s.hidden.includes(key) ? s.hidden.filter((k) => k !== key) : [...s.hidden, key];
  return enemyTypeShown(key, set({ hidden }));
}

/** Show or hide every type in the list at once (All / None). Types the list does not carry stay as they were. */
export function setEnemyTypes(shown) {
  const mine = new Set(enemyCatalogue().map((t) => t.key));
  const rest = travelViewEnemies().hidden.filter((k) => !mine.has(k));
  return set({ hidden: shown ? rest : [...rest, ...mine] });
}

/** Pins: back to the device's word. */
export function _resetTravelViewEnemies() { state = null; listeners.clear(); catalogue = null; }
