// OVH1 (2026-09-24, Mac: "A new option on the main menu that opens to show 3 large panels. These panels will have
// directional arrows allowing you to switch being different feature sets ... 1. Texture Overhaul 2. Sound Overhaul
// 3. UI Overhaul ... Our first overhaul option will be the file attached. Along with this classic options and
// enhanced options should be in") - THE OVERHAULS: three panels, each ONE choice out of a set.
//
// An option is a WHOLE LOOK, not a new switch. Texture holds the texture packs - none ships yet, so it stands empty
// (OVH1b). Sound is the port's own sound switches taken together - the Features rows that change what the world
// sounds like, set as Daggerfall has them (Classic) or as the port adds them (Enhanced) - so the panel and the Features
// home can never disagree: they read and write the same rows, and a mix the player made on Features reads back as
// "Custom", never as a lie. UI is the skin, and on the classic skin the UI pack worn over it (systems/uiPack.js) -
// GrimoireUI is the first.
//
// A later texture or sound pack is a row here, the same shape as GrimoireUI's: its files, its `apply`, its `isOn`.
//
// ONLINE: every choice here is the player's own online (OVH3 - the skin is no longer the lane's); a panel says what
// the online panels keep over it.
import { FEATURES, resolveControl } from './features.js';
import { getPref, setPref } from './uiPrefs.js';
import { modSetting, setModSetting } from './modSettings.js';
import { onlineForcedPref, onlineForcedModSetting } from './onlineLane.js';
import { uiSkin, setUiSkin, SKIN_NAMES } from './uiSkin.js';
import { activeUiPack, setUiPack, UI_PACKS, UI_PACK_NONE } from './uiPack.js';

const row = (id) => {
  const f = FEATURES.find((x) => x.id === id);
  if (!f) throw new Error(`overhauls: no Features row '${id}'`);
  return f;
};

/** A Features row as two ends of a look: `classic` is its first state (Off, or a tier row's first tier - Daggerfall's
 *  own), `enhanced` its shipped default. Read and written through the row's own store and lane, as its tile is. */
export function rowEnds(f) {
  const c = resolveControl(f);
  if (c.store === 'prefs' && c.tiers) {
    const def = c.default ?? c.initial;
    return {
      classic: c.tiers[0][0], enhanced: c.tiers.some(([v]) => String(v) === String(def)) ? def : c.tiers[c.tiers.length - 1][0],
      read: () => String(c.read ? c.read() : getPref(c.key)),
      write: (v) => (c.write ?? ((x) => setPref(c.key, x)))(v),
      forced: onlineForcedPref(c.key) !== undefined,
    };
  }
  if (c.store === 'prefs') {
    return { classic: false, enhanced: true, read: () => String(!!getPref(c.key)), write: (v) => setPref(c.key, !!v), forced: onlineForcedPref(c.key) !== undefined };
  }
  if (c.store === 'mods') {
    return {
      classic: false, enhanced: true,
      read: () => String(modSetting(c.vendor, c.key) === true || modSetting(c.vendor, c.key) === 'True'),
      write: (v) => setModSetting(c.vendor, c.key, !!v),
      forced: onlineForcedModSetting(c.vendor, c.key) !== undefined,
    };
  }
  throw new Error(`overhauls: '${f.id}' lives in the ${c.store} store, which a look does not set`);
}

/** A preset option over Features rows: every row at the one end. */
function preset(id, name, end, rows, { by, blurb }) {
  return Object.freeze({
    id, name, by, blurb, rows: Object.freeze([...rows]),
    isOn: () => rows.every((r) => { const e = rowEnds(row(r)); return e.read() === String(e[end]); }),
    apply: () => { for (const r of rows) { const e = rowEnds(row(r)); e.write(e[end]); } return { reload: false }; },
  });
}

/** The rows the sound looks set - what the world SOUNDS like, the port's own departures. */
export const SOUND_ROWS = Object.freeze(['enhanced-sounds', 'mod-immersive-footsteps']);

/** Wear a UI choice: the skin, and the pack over a classic one. Both land on the shelf, then the page reloads - the
 *  two skins are two hosts (uiSkin.js). Answers the URL to load, carrying the choice on it when the shelf refused
 *  (SKIN-CARRY's law, for the pack too). */
export function uiChoiceUrl(skin, pack, href = globalThis.location?.href ?? 'http://localhost/') {
  const url = new URL(href);
  // PLUS-ONLY: `plus` is dropped with the others - a retired instruction left on the address means nothing now
  url.searchParams.delete('skin'); url.searchParams.delete('uipack'); url.searchParams.delete('plus');
  if (setUiSkin(skin) === null) url.searchParams.set('skin', skin);
  if (skin === 'classic' && setUiPack(pack) === false) url.searchParams.set('uipack', pack);
  return url.toString();
}
const uiOption = (id, name, skin, pack, { by, blurb }) => Object.freeze({
  id, name, by, blurb, skin, pack,
  isOn: () => uiSkin() === skin && (skin !== 'classic' || (activeUiPack()?.id ?? UI_PACK_NONE) === pack),
  apply: () => ({ reload: true, url: uiChoiceUrl(skin, pack) }),
});

const G = UI_PACKS.grimoire;
export const OVERHAUL_PANELS = Object.freeze([
  // OVH1b (2026-09-24, Mac: "Currently there are no texture packs, it should be empty"): the panel stands, and holds
  // nothing until the first texture pack ships - it is a pack's door, not a second face on the Features switches.
  Object.freeze({
    id: 'texture', title: 'Texture Overhaul',
    effect: 'Takes effect when the world next loads.',
    online: null,
    empty: 'No texture packs yet.',
    options: Object.freeze([]),
  }),
  Object.freeze({
    id: 'sound', title: 'Sound Overhaul',
    effect: 'Takes effect at once.',
    online: null,
    options: Object.freeze([
      preset('classic', 'Classic', 'classic', SOUND_ROWS, { by: 'Daggerfall', blurb: 'Daggerfall’s own sounds and nothing added: its footsteps, its ambience, silence between.' }),
      preset('enhanced', 'Enhanced', 'enhanced', SOUND_ROWS, { by: 'The port and Immersive Footsteps', blurb: 'A quiet wind outdoors that rises and falls with the weather, the inventory’s clink and click, and footsteps that answer the ground you walk on.' }),
    ]),
  }),
  Object.freeze({
    id: 'ui', title: 'UI Overhaul',
    effect: 'Switching reloads the game.',
    online: 'Online, the chat, your friends, the party and trading keep their own panels over any of these.',
    options: Object.freeze([
      uiOption('classic', SKIN_NAMES.classic, 'classic', UI_PACK_NONE, { by: 'Daggerfall', blurb: 'Daggerfall’s own screens, pixel for pixel: the inventory, the spellbook, the conversations and the maps as they shipped.' }),
      // PLUS1 (2026-09-25): the enhanced screens in the refreshed dress. PLUS-ONLY (2026-09-26): and the only enhanced
      // option - plain Enhanced, which stood beside it, is retired (systems/uiSkin.js isEnhancedPlus).
      uiOption('enhanced-plus', SKIN_NAMES.enhanced, 'enhanced', UI_PACK_NONE, { by: 'The port', blurb: 'The port’s own screens in stone and brass: a hotbar, the enhanced inventory and spellbook, the held map, framed windows that unfold, the guild and shop windows rebuilt, and every panel built for a mouse, a pad and a phone.' }),
      uiOption(G.id, G.title, 'classic', G.id, { by: `${G.author}, version ${G.version}`, blurb: 'Daggerfall’s screens redrawn at three times the detail: parchment and wood in place of the rock, a spellbook that is a book, and new lettering.' }),
    ]),
  }),
]);

/** The option in effect on a panel, or null when the player's own mix matches none (the panel says "Custom"). */
export function currentOption(panel) { return panel.options.find((o) => o.isOn()) ?? null; }
/** Rows of a preset the online lane is holding at a forced value - said on the panel, never hidden. */
export const forcedRows = (option) => (option.rows ?? []).filter((r) => rowEnds(row(r)).forced);
