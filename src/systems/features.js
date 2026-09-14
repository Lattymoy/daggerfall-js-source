// FT0 (2026-09-14, Mac: "merging mods, certain setting toggles and
// enhanced pane toggles into one universal place to toggle enhanceable
// features"): THE FEATURES REGISTRY - the one declared list behind the
// FEATURES home on the menu rail (ui/enhancedMenu.js paneFeatures).
//
// A feature is a ROW: a title, a note, the kinds it wears as coloured
// labels, and ONE control that names the store and key already
// backing it. The three stores stay where they are - DFU's 171-key
// settings (systems/settings.js), the port's own prefs
// (systems/uiPrefs.js), the vendored mods' modsettings
// (systems/modSettings.js) - and this list is the presentation over
// them: nothing here holds a value.
//
// A row may wear MORE THAN ONE kind (Mac, 2026-09-14): a switch that
// condenses the port's outdoors with Dynamic Skies' is Enhanced AND
// Mod Authored, and the filter shows it under either.
//
// THE LIST IS EMPTY AT FT0 AND FILLS ONE SLICE AT A TIME
// (bible/10-UI/Features-Arc.md - the inventory is the work list; a row
// is audited and fixed before it moves here). checkFeatures() is the
// registry's own law, pinned by test/features.test.js: every row's
// control must name a key its store really has, so a typo cannot ship
// a switch wired to nothing.

import { PREF_DEFAULTS } from './uiPrefs.js';
import { ALL_KEYS } from './settings.js';
import { MOD_SETTINGS } from './modSettings.js';
import { LAND_VIEW_TIERS, landViewRead, landViewWrite } from '../world/landView.js';   // FT2: the one row for both lanes

/** The three kinds, in label order. `label` is what the row wears and
 *  the chip says; the colour is the skin's (ui/enhancedStyle.js .kind). */
export const KINDS = Object.freeze({
  enhanced: Object.freeze({ label: 'Enhanced', blurb: 'Built in house: the port’s own departures from Daggerfall.' }),
  mod: Object.freeze({ label: 'Mod Authored', blurb: 'Mods ported 1:1, under their authors’ names.' }),
  classic: Object.freeze({ label: 'DFU Classic', blurb: 'Daggerfall Unity’s own optional features.' }),
});
export const KIND_ORDER = Object.freeze(['enhanced', 'mod', 'classic']);

/** Where a control's value lives. */
export const STORES = Object.freeze(['prefs', 'settings', 'mods']);

/** The rows. Shape:
 *    { id, title, note, effect?, kinds: [kind, ...],
 *      control: { store: 'prefs',    key, tiers?: [[value, label], ...], read?: () => value, write?: (value) => void }
 *             | { store: 'settings', key: 'Section/Key' }
 *             | { store: 'mods',     vendor, key } }
 *  `effect` is the "takes effect when" line, if the switch has one.
 *  `read`/`write` (FT2) let a row that CONDENSES two stores show the
 *  live one and write both; absent, the row is getPref/setPref over its key.
 *  `also` (FT2) names the OTHER controls the row's write covers, so their
 *  own panes draw a pointer to this row instead of a second switch. */
export const FEATURES = Object.freeze([
  // FT1 (2026-09-14): SMALLER DUNGEONS - DFU's Experimental/SmallerDungeons,
  // ported 1:1 at AUDIT 28 W4 (world/smallerDungeons.js). Mac's first
  // pick: "smaller dungeons should be a genuine enhanced feature that we
  // can build on instead of being hidden in the settings menu". DFU
  // Classic today; it wears Enhanced too the day the port builds on it.
  Object.freeze({
    id: 'smaller-dungeons',
    title: 'Smaller dungeons',
    note: 'Daggerfall\u2019s dungeons are enormous. On, any dungeon over five blocks is rebuilt as a plus of five - '
      + 'a random central block with four border blocks around it, drawn from its own block list, the same five every visit. '
      + 'Main-story dungeons never shrink, a dungeon a quest sent you to keeps the size it had when the quest began, '
      + 'and online every dungeon is full size.',
    effect: 'Takes effect on the next dungeon you enter. A save made at the other size puts you at the dungeon\u2019s start.',
    kinds: Object.freeze(['classic']),
    control: Object.freeze({ store: 'settings', key: 'Experimental/SmallerDungeons' }),
  }),
  // FT2 (2026-09-14): LAND VIEW DISTANCE - the first CONDENSED row. Two
  // controls for one radius: the pref (LV1, the enhanced lane's 1..6)
  // and DFU's Experimental/TerrainDistance (D1, the 1:1 lane's 1..4).
  // One row wearing both labels; it shows the lane's live radius and
  // writes both stores (world/landView.js landViewRead/landViewWrite).
  Object.freeze({
    id: 'land-view-distance',
    title: 'Land view distance',
    note: 'How far the land streams around you, in map pixels each way. Daggerfall Unity\u2019s own is 3 and its furthest is 4; '
      + 'the enhanced outdoors go to 6, drawing the far rings coarse - only their trees and fires - with the haze reaching as far, '
      + 'and a walk across the map building more land. One choice for both lanes: the classic skin, and the enhanced skin with '
      + 'enhanced environments off, read it capped at Daggerfall Unity\u2019s 4.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced', 'classic']),
    control: Object.freeze({
      store: 'prefs', key: 'landViewDistance', tiers: LAND_VIEW_TIERS, read: landViewRead, write: landViewWrite,
      also: Object.freeze([Object.freeze({ store: 'settings', key: 'Experimental/TerrainDistance' })]),   // written by landViewWrite, capped at 4
    }),
  }),
]);

/** The row whose control is this store's key, or null. The settings
 *  pane asks it for every key it draws: a key that lives on the home
 *  is drawn there as a pointer, not as a second switch (one home per
 *  idea). */
export function featureForControl(store, key, vendor = null) {
  const is = (k) => k.store === store && k.key === key && (store !== 'mods' || k.vendor === vendor);
  return FEATURES.find((f) => is(f.control) || (f.control.also ?? []).some(is)) ?? null;   // FT2: a covered control points here too
}

/** Does this store hold this key? The three stores answer differently
 *  and this is the one place that knows how. */
function storeHas(control) {
  switch (control.store) {
    case 'prefs': return Object.hasOwn(PREF_DEFAULTS, control.key);
    case 'settings': return ALL_KEYS.includes(control.key);
    case 'mods': return !!MOD_SETTINGS[control.vendor]?.keys?.[control.key];
    default: return false;
  }
}

/** Everything wrong with one row, as sentences; [] when it is sound. */
export function checkFeature(f) {
  const out = [];
  if (!f || typeof f !== 'object') return ['not an object'];
  if (typeof f.id !== 'string' || !f.id) out.push('no id');
  if (typeof f.title !== 'string' || !f.title) out.push('no title');
  if (!Array.isArray(f.kinds) || !f.kinds.length) out.push('no kinds');
  else {
    for (const k of f.kinds) if (!KINDS[k]) out.push(`unknown kind '${k}'`);
    if (new Set(f.kinds).size !== f.kinds.length) out.push('a kind repeated');
  }
  const c = f.control;
  if (!c || typeof c !== 'object') out.push('no control');
  else if (!STORES.includes(c.store)) out.push(`unknown store '${c.store}'`);
  else if (!storeHas(c)) out.push(`${c.store} has no key '${c.store === 'mods' ? `${c.vendor}/` : ''}${c.key}'`);
  else if (c.store === 'prefs' && c.tiers !== undefined) {
    if (!Array.isArray(c.tiers) || !c.tiers.length) out.push('tiers is not a list');
    else if (!c.tiers.some(([v]) => String(v) === String(PREF_DEFAULTS[c.key]))) out.push(`tiers do not include the default ${PREF_DEFAULTS[c.key]}`);
  }
  if (c && typeof c === 'object' && c.also !== undefined) {
    // FT2: every control the row ALSO covers is a real key of its store
    if (!Array.isArray(c.also)) out.push('also is not a list');
    else for (const a of c.also) {
      if (!a || !STORES.includes(a.store)) out.push(`also: unknown store '${a?.store}'`);
      else if (!storeHas(a)) out.push(`also: ${a.store} has no key '${a.store === 'mods' ? `${a.vendor}/` : ''}${a.key}'`);
    }
  }
  if (c && typeof c === 'object') {
    // FT2: a condensed row's read and write are functions or absent - never one without the other
    if (c.read !== undefined && typeof c.read !== 'function') out.push('read is not a function');
    if (c.write !== undefined && typeof c.write !== 'function') out.push('write is not a function');
    if ((c.read === undefined) !== (c.write === undefined)) out.push('read and write come together');
  }
  return out;
}

/** Everything wrong with the list: per-row problems, prefixed by id,
 *  plus a repeated id or a repeated control (two rows over one switch). */
export function checkFeatures(list) {
  const out = [];
  const ids = new Set();
  const controls = new Set();
  list.forEach((f, i) => {
    const name = f?.id ?? `#${i}`;
    for (const p of checkFeature(f)) out.push(`${name}: ${p}`);
    if (ids.has(f?.id)) out.push(`${name}: id repeated`);
    ids.add(f?.id);
    const c = f?.control;
    if (c && typeof c === 'object') {
      for (const k of [c, ...(Array.isArray(c.also) ? c.also : [])]) {   // FT2: a covered control is a control
        const sig = `${k.store}:${k.vendor ?? ''}:${k.key}`;
        if (controls.has(sig)) out.push(`${name}: control repeated (${sig})`);
        controls.add(sig);
      }
    }
  });
  return out;
}

/** The rows wearing `kind`; every row when kind is null. */
export function filterFeatures(list, kind) {
  return kind == null ? list.slice() : list.filter((f) => f.kinds.includes(kind));
}

/** The chip counts: every row, then per kind (a two-kind row counts
 *  under both, because the filter shows it under both). */
export function featureCounts(list) {
  const out = { all: list.length };
  for (const k of KIND_ORDER) out[k] = 0;
  for (const f of list) for (const k of f.kinds) if (out[k] !== undefined) out[k] += 1;
  return out;
}
