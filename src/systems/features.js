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
import { OUTDOORS_TIERS, OUTDOORS_DEFAULT, outdoorsRead, outdoorsWrite } from '../world/outdoors.js';   // FT4: the outdoors as one three-way row

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

/** FT9 (2026-09-14): A VENDORED MOD'S ROW - its own switch, its own
 *  title with the creator's name in it (Mac, 2026-09-08), its own
 *  description as the note. One source: modSettings.js, where the mod's
 *  modsettings ship. The mod's OTHER knobs stay under its card on the
 *  Mods page, whose Enabled row is a pointer here. `effect` is the
 *  port's word on when the switch lands, per mod. */
const modFeature = (vendor, effect) => {
  const mod = MOD_SETTINGS[vendor];
  return Object.freeze({
    id: `mod-${vendor.toLowerCase()}`,
    title: `${mod.title} by ${mod.author}`,
    note: mod.keys.Enabled.description,
    effect,
    kinds: Object.freeze(['mod']),
    control: Object.freeze({ store: 'mods', vendor, key: 'Enabled' }),
  });
};

/** The rows. Shape:
 *    { id, title, note, effect?, kinds: [kind, ...],
 *      control: { store: 'prefs',    key, tiers?: [[value, label], ...], default?: value, read?: () => value, write?: (value) => void }
 *             | { store: 'settings', key: 'Section/Key' }
 *             | { store: 'mods',     vendor, key } }
 *  `effect` is the "takes effect when" line, if the switch has one.
 *  `read`/`write` (FT2) let a row that CONDENSES two stores show the
 *  live one and write both; absent, the row is getPref/setPref over its key.
 *  `also` (FT2) names the OTHER controls the row's write covers, so their
 *  own panes draw a pointer to this row instead of a second switch.
 *  `default` (FT4) is the tier a condensed row reads at the stores' own
 *  defaults, when its tiers are not the pref's values. */
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
  // FT4 (2026-09-14): THE OUTDOORS - Mac's own condensing example. EE1's
  // Enhanced environments (the port's) and Dynamic Skies' Enabled (the
  // mod's) decided the sky between them from two panes. One three-way
  // row: Daggerfall's outdoors, the enhanced outdoors under the port's
  // dome, or under Dynamic Skies' skybox (world/outdoors.js).
  Object.freeze({
    id: 'enhanced-environments',
    title: 'Enhanced environments',
    note: 'The enhanced outdoors: a procedural sky with the sun, both moons on their real phases and a star field, '
      + 'a finely stepped sunrise and sunset, volumetric clouds that build with the weather, drift on the wind and cast '
      + 'their shadows on the land, rain and snow that fall through the world around you, a sky that turns through the day '
      + 'rather than only at midnight, and a million blades of grass in the meadows bending in the same wind. '
      + 'Off returns Daggerfall\u2019s SKY*.DAT panorama and its own weather. On, the sky is either the port\u2019s own dome '
      + 'or Dynamic Skies\u2019 skybox (BadLuckBurt and carademono, carried with permission): its sun and scattering, '
      + 'textured cloud layers per weather, twinkling stars, both moons on their orbits, its fog, its longer sunrise and sunset, '
      + 'and a lightning flash under thunder. The mod\u2019s fog density and pixel-snow knobs stay on the Mods page.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced', 'mod']),
    control: Object.freeze({
      store: 'prefs', key: 'enhancedEnvironments', tiers: OUTDOORS_TIERS, default: OUTDOORS_DEFAULT, read: outdoorsRead, write: outdoorsWrite,
      also: Object.freeze([Object.freeze({ store: 'mods', vendor: 'dynamic-skies', key: 'Enabled' })]),   // written by outdoorsWrite while the outdoors are on
    }),
  }),
  // FT5 (2026-09-14): ENHANCED AI - the navmesh-driven enemy motor
  // (12-Enhanced-AI/Enhanced-AI-Arc.md), off by default because DFU's
  // classic motor is the 1:1 law. The words are AUDIT 59 F3's, kept
  // true by test/ft5_enhancedai.test.js against the arc's own list of
  // what is still ahead. NOT a merge with DFU's Enhancements/
  // EnhancedCombatAI ("Smarter Enemies", UNAVAILABLE in settings.js: the port runs the
  // classic path only) - a different thing that shares half a name,
  // which the note says outright so the two cannot be read as one.
  Object.freeze({
    id: 'enhanced-ai',
    title: 'Enhanced AI',
    note: 'Enemies find their way: a navmesh baked from each dungeon, so they path around pillars and down '
      + 'corridors instead of walking into walls the way classic Daggerfall\u2019s do. Senses, decisions and '
      + 'attacks stay classic; only the way an enemy moves changes. Dungeons for now - towns, interiors and '
      + 'doors are still to come, and enemies bunch up until the crowd slice lands. Off keeps the 1:1 classic motor. '
      + 'This is the port\u2019s own, not Daggerfall Unity\u2019s \u201cSmarter Enemies\u201d setting (EnhancedCombatAI), '
      + 'which the port does not run.',
    effect: 'Takes effect on the next dungeon you enter.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'enhancedAI' }),
  }),
  // FT6 (2026-09-14): ENHANCED WATER (WATER1) - the surface pass over the
  // terrain's water tiles on the enhanced skin; off, or the classic
  // skin, draws DFU's flat tile. The switch's composition has one home
  // now (render/waterSurface.js waterSwitchOn); `?water=off` is the kill door.
  Object.freeze({
    id: 'enhanced-water',
    title: 'Enhanced water',
    note: 'The oceans, rivers and ponds drawn as water: waves that rise with the wind, the sky and the '
      + 'sun reflected off the surface, the moon\u2019s glint at night, rain pocking it, the clouds\u2019 '
      + 'shadows crossing it, and the shore feathered along its own edge. Off returns Daggerfall\u2019s '
      + 'flat water tile.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'enhancedWater' }),
  }),
  // FT7 (2026-09-14): THE TWO QUALITY TIERS OF THE ENHANCED OUTDOORS
  // (PERF1) - the grass field's fraction and the clouds' march. Both
  // are inert unless the outdoors row above is on (world.js gates the
  // grass on enhancedEnvironments; the clouds ride the enhanced lane),
  // which each note now says. Enhanced, the port's own dials.
  Object.freeze({
    id: 'grass-density',
    title: 'Grass density',
    note: 'How much of the meadow grows under the enhanced outdoors: the full field, half, a quarter, or none. '
      + 'The single heaviest thing outdoors - try half first if the FPS counter says the frame is the GPU\u2019s.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'grassDensity', tiers: Object.freeze([[1, 'Full'], [0.5, 'Half'], [0.25, 'Quarter'], [0, 'Off']]) }),
  }),
  Object.freeze({
    id: 'cloud-quality',
    title: 'Cloud quality',
    note: 'How finely the volumetric clouds over the enhanced outdoors are marched. Low is a coarser sky map with fewer steps; '
      + 'High is for a machine with room to spare.',
    effect: 'Takes effect when the world next loads.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'cloudQuality', tiers: Object.freeze([['default', 'Default'], ['lo', 'Low'], ['hi', 'High']]) }),
  }),
  // FT8 (2026-09-14): ENHANCED COMBAT VISUALS (ECV1) - what the enhanced
  // skin DRAWS for a concealed foe; the rules are DFU's either way. The
  // last row of the Enhanced category of Settings, which is a pointer
  // here now. Read once per frame by every foe host through
  // combatVisualsOn (systems/combatVisuals.js; `?combatvisuals=off` the
  // kill door), so a press takes effect at once.
  Object.freeze({
    id: 'enhanced-combat-visuals',
    title: 'Enhanced combat visuals',
    note: 'How a magically concealed enemy is drawn. Classic Daggerfall and Daggerfall Unity hide it '
      + 'completely - an imp that casts Chameleon on itself vanishes, and still takes your hits. On, a '
      + 'chameleoned enemy shimmers at low opacity, a shadow-spell enemy is a dark silhouette, and a hit '
      + 'on an unseen enemy flashes it for a moment - an invisible one included, the one thing this shows that the classic draw never does. '
      + 'Otherwise invisibility still hides it. Nothing about the rules changes: what the enemy can do, and what can hit it, are classic. '
      + 'Off keeps the 1:1 draw.',
    effect: 'Takes effect at once.',
    kinds: Object.freeze(['enhanced']),
    control: Object.freeze({ store: 'prefs', key: 'enhancedCombatVisuals' }),
  }),
  // FT9 (2026-09-14): THE FIVE PACKS WITH A SWITCH (Dynamic Skies' is
  // the outdoors row's, FT4). Windmills (Kamer) has no switch and so no
  // row - a row needs a control. The order is the Mods pane's.
  modFeature('seasons-iliac-bay', 'Takes effect when the world next loads.'),
  modFeature('roads-hazelnut', 'Takes effect when the world next loads.'),
  modFeature('meanerMonsters', 'Takes effect on monsters spawned after the switch.'),
  modFeature('pcaao', 'Takes effect at once.'),
  modFeature('unleveledLoot', 'Takes effect on the next roll.'),
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
    else {
      // FT4: a condensed row's tiers are its own vocabulary, so it names its default itself
      const def = c.default ?? PREF_DEFAULTS[c.key];
      if (!c.tiers.some(([v]) => String(v) === String(def))) out.push(`tiers do not include the default ${def}`);
    }
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
