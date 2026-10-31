// @ts-check
// PVP-SET (the owner, 2026-10-29: "player should get a whole second hot bar of the one we have", "need a menu to make
// spells for thr hot bar small easy", "hot bar need to use exsistning one"): THE PVP SET'S LAW. While my flag is up in
// the zone, the hotbar shows and fires a second set of its own slots (systems/quickslots.js useHotbarSet): toolkit
// spells made in the PvP menu, and items. The set cannot change while the PvP combat lock runs. Pure. A departure: DFU
// has no PvP.
import { t } from '../textManager.js';
import { KIT_IDS, KIT_SPELLS, kitSlotOf, kitBarOf, kitSlotName } from './pvpKit.js';

/** The set's slots (the hotbar's HOTBAR_CAPACITY), the most made spells the menu keeps, and the slot the old bar's
 *  first spell lands on (its keys were 3 to 0). */
export const PVP_SET = Object.freeze({ slots: 16, made: 24, kitFrom: 2 });

/** A made spell as the hotbar keeps it: a 'kit' entry. */
export const kitEntry = (slot) => {
  const kit = kitSlotOf(slot);
  return { type: 'kit', kit, name: kitSlotName(kit) };
};
const sameKit = (a, b) => a.id === b.id && a.pick === b.pick && a.icon === b.icon;
const isKit = (raw) => !!raw && KIT_IDS.includes(raw.id);

/** The menu's made spells as saved: toolkit spells only, each once, at most PVP_SET.made. */
export function kitMadeOf(raw) {
  const out = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!isKit(r)) continue;
    const s = kitSlotOf(r);
    if (!out.some((o) => sameKit(o, s)) && out.length < PVP_SET.made) out.push(s);
  }
  return out;
}
/** Make a spell: the list with it at the end, or null when the list is full. One already made is not made twice. */
export function makeKit(made, slot) {
  const s = kitSlotOf(slot);
  if (made.some((o) => sameKit(o, s))) return made.slice();
  return made.length < PVP_SET.made ? [...made, s] : null;
}
/** The list without made spell `i`. */
export const unmakeKit = (made, i) => made.filter((_, j) => j !== i);

/** A set entry as saved, or null: a toolkit spell, or an item kind (never a book spell). */
function entryOf(raw) {
  if (raw?.type === 'kit' && isKit(raw.kit)) return kitEntry(raw.kit);
  if (raw?.type === 'item' && typeof raw.key === 'string' && typeof raw.kind === 'string')
    return { type: 'item', kind: raw.kind, key: raw.key, name: String(raw.name ?? '') };
  return null;
}
/** The saved record (`{ v: 2, set, made }`), or null when there is none to read. */
export function pvpStoreOf(raw) {
  if (raw?.v !== 2 || !Array.isArray(raw.set)) return null;
  return { set: Array.from({ length: PVP_SET.slots }, (_, i) => entryOf(raw.set[i])), made: kitMadeOf(raw.made) };
}
/** An old save's bar (dfo.pvpKitBar.v1, eight spells on keys 3 to 0) as a set: the spells where their keys were, and
 *  the normal set's first two slots where they hold items (the potions on 1 and 2). No old bar: the default bar. */
export function pvpStoreFromV1(v1, main = []) {
  const bar = kitBarOf(v1);
  const set = Array.from({ length: PVP_SET.slots }, (_, i) => {
    if (i < PVP_SET.kitFrom) return main[i]?.type === 'item' ? entryOf(main[i]) : null;
    const s = bar[i - PVP_SET.kitFrom];
    return s ? kitEntry(s) : null;
  });
  return { set, made: kitMadeOf(bar) };
}

/** A made spell's tag in the menu: where it lands. */
export function kitTag(id) {
  if (id === 'damage') return t('pvp.set.area', 'Area');
  if (id === 'resurrect') return t('pvp.set.touch', 'Touch');
  return t('pvp.set.gift', 'You or ally');
}
/** A made spell's cost as the menu lists it. */
export const kitCostLine = (id) => t('pvp.set.cost', '{n}% magicka', { n: KIT_SPELLS[id]?.cost ?? 0 });
/** The refusal while the combat lock runs, `leftMs` of it left. */
export const pvpSetLockLine = (leftMs) =>
  t('pvp.set.locked', 'You are in combat. You can change your PvP spells in {s} s.', {
    s: Math.max(1, Math.ceil(leftMs / 1000)),
  });

/**
 * A slot's marks on the bar: `cost` what a cast charges now (armour and all), `short` when my magicka is under it, `last`
 * the slot last cast, `cd` the share of the cast clock left (1 just cast, 0 ready), `lock` the combat lock. An item
 * slot carries the lock alone.
 */
export function pvpSlotMarks({
  kit = false,
  cost = 0,
  magicka = 0,
  last = false,
  castAt = -Infinity,
  recoverMs = 0,
  now = 0,
  locked = false,
}) {
  if (!kit) return { lock: !!locked };
  const cd = recoverMs > 0 ? Math.max(0, Math.min(1, (castAt + recoverMs - now) / recoverMs)) : 0;
  return { cost, short: magicka < cost, last: !!last, cd, lock: !!locked };
}
