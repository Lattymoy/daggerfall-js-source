// OVH1 (2026-09-24, Mac: "A new option on the main menu that opens to show 3 large panels. These panels will have
// directional arrows allowing you to switch being different feature sets ... 1. Texture Overhaul 2. Sound Overhaul
// 3. UI Overhaul ... Our first overhaul option will be the file attached. Along with this classic options and
// enhanced options should be in") - THE OVERHAULS: three panels, each ONE choice out of a set.
//
// An option is a WHOLE LOOK, not a new switch. Texture holds the texture packs - Classic, and Vanilla Enhanced (VE3,
// systems/vanillaEnhanced/vanillaEnhanced.js), which ships with the port since VE4 (systems/vanillaEnhanced/vanillaEnhancedPack.js; Port-Doctrine
// records the exception) and is worn by switching its mods on. Sound is
// the port's own sound switches taken together - the Features rows that change what the world
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
import { pageParam } from './pageQuery.js';
import { modSetting, setModSetting } from './modSettings.js';
import { onlineForcedPref, onlineForcedModSetting } from './online/onlineLane.js';
import { uiSkin, setUiSkin, SKIN_NAMES } from './uiSkin.js';
import { activeUiPack, setUiPack, UI_PACKS, UI_PACK_NONE } from './uiPack.js';
import { veBase, veAddons, veWorn, classicTexturesWorn, wearVanillaEnhanced, wearClassicTextures, classicBlocked, customTextureNote } from './vanillaEnhanced/vanillaEnhanced.js';   // VE3; VE4: its add-ons; AUDIT VE R10: a loose pack's say

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
/** GRIM1: the dress an enhanced look wears over the skin - 'none' (Enhanced Plus) or 'grimoire' (DFO Grimoire,
 *  ui/grimoireDress.js). Read off the shelf here rather than through the dress's module, which carries a stylesheet. */
const dressWorn = (search = globalThis.location?.search ?? '') => {
  const url = pageParam('dress', search);
  return (url === 'grimoire' || url === 'none' ? url : getPref('plusDress')) === 'grimoire' ? 'grimoire' : 'none';
};
const uiOption = (id, name, skin, pack, { by, blurb, dress = 'none', vendor = null }) => Object.freeze({
  id, name, by, blurb, skin, pack, dress, vendor,
  isOn: () => uiSkin() === skin && (skin !== 'classic' ? dressWorn() === dress : (activeUiPack()?.id ?? UI_PACK_NONE) === pack),
  // GRIM1: an enhanced look sets its dress on the shelf before the reload (the dress is the page's from its first frame)
  apply: () => {
    const url = new URL(uiChoiceUrl(skin, pack));
    url.searchParams.delete('dress');
    if (skin === 'enhanced' && setPref('plusDress', dress) === false) url.searchParams.set('dress', dress);   // SKIN-CARRY
    return { reload: true, url: url.toString() };
  },
});

/** VE3: a texture look - the texture mods switched on or off as one (systems/vanillaEnhanced/vanillaEnhanced.js). VE4: `addons` lists
 *  the look's optional mods, which the card offers as switches while the look is worn; `vendor` names the vendor/
 *  folder of the pack it wears (the credits' way to it). AUDIT VE R10: `blocked` says what stands in its way now (the
 *  card offers no Use while it does), or null. */
const textureOption = (id, name, { by, blurb, isOn, wear, addons = null, vendor = null, blocked = null }) => Object.freeze({
  id, name, blurb, isOn, addons, vendor, blocked,
  get by() { return typeof by === 'function' ? by() : by; },
  apply: () => { wear(); return { reload: false }; },
});

const G = UI_PACKS.grimoire;
export const OVERHAUL_PANELS = Object.freeze([
  // OVH1b (2026-09-24, Mac: "Currently there are no texture packs, it should be empty"): the panel stood empty until the
  // first texture pack - it is a pack's door, not a second face on the Features switches. VE3 (2026-10-05): Vanilla
  // Enhanced is that pack, beside Classic.
  Object.freeze({
    id: 'texture', title: 'Texture Overhaul',
    effect: 'Takes effect when the world next loads.',
    online: null,
    get custom() { return customTextureNote(); },   // AUDIT VE R10: a loose pack alone is no mix of mods
    options: Object.freeze([
      textureOption('classic', 'Classic', {
        by: 'The original game',
        blurb: 'The original game\u2019s own textures, for the classic look.',
        isOn: classicTexturesWorn, wear: wearClassicTextures, blocked: classicBlocked,
      }),
      textureOption('vanilla-enhanced', 'Vanilla Enhanced', {
        by: () => { const b = veBase(); return b?.version ? `carademono, version ${b.version}` : 'carademono'; },
        blurb: 'The original game\u2019s own textures, remastered and sharper: the ground, trees, rocks, city walls and dungeons.',
        isOn: veWorn, wear: wearVanillaEnhanced, addons: veAddons, vendor: 'vanilla-enhanced',
      }),
    ]),
  }),
  Object.freeze({
    id: 'sound', title: 'Sound Overhaul',
    effect: 'Takes effect at once.',
    online: null,
    options: Object.freeze([
      preset('classic', 'Classic', 'classic', SOUND_ROWS, { by: 'The original game', blurb: 'The original game\u2019s own sounds, for a retro feel.' }),
      preset('enhanced', 'Enhanced', 'enhanced', SOUND_ROWS, { by: 'DFO Online and Immersive Footsteps', blurb: 'New and improved sounds and ambience.' }),
    ]),
  }),
  Object.freeze({
    id: 'ui', title: 'UI Overhaul',
    effect: 'Switching reloads the game.',
    online: 'Online, chat, friends, party and trading keep their own panels with any of these.',
    options: Object.freeze([
      uiOption('classic', SKIN_NAMES.classic, 'classic', UI_PACK_NONE, { by: 'The original game', blurb: 'The original game\u2019s own interface, for the classic feel.' }),
      // PLUS1 (2026-09-25): the enhanced screens in the refreshed dress. PLUS-ONLY (2026-09-26): and the only enhanced
      // option - plain Enhanced, which stood beside it, is retired (systems/uiSkin.js isEnhancedPlus).
      uiOption('enhanced-plus', SKIN_NAMES.enhanced, 'enhanced', UI_PACK_NONE, { by: 'DFO Online', blurb: 'A modern interface built for mouse and keyboard, controller or phone. You can adjust some settings and the controller bindings.' }),
      uiOption(G.id, G.title, 'classic', G.id, { by: `${G.author}, version ${G.version}`, blurb: 'The classic interface with improvements: 3 times the detail, a new font, a spellbook for all your spells, and parchment and wood in place of the original stone.' }),
      // GRIM1 (2026-10-09, Discord: "I want some of the features of enhanced+ just not the overall look of it"): DFO
      // GRIMOIRE - the enhanced skin, every window and feature it carries, dressed in GrimoireUI's own parchment, wood,
      // red presses, glass vials and lettering (ui/grimoireDress.js). Its art is the pack's, so it names the pack.
      uiOption('dfo-grimoire', 'DFO Grimoire', 'enhanced', UI_PACK_NONE, { dress: 'grimoire', vendor: G.vendor, by: `DFO Online, in ${G.author}'s GrimoireUI ${G.version}`, blurb: 'GrimoireUI\u2019s parchment, wood and red-and-gold buttons on every window, with everything Enhanced Plus has: the hotbar, camps and tents, resting, the maps, trading and every online panel. Your vitals show as glass vials.' }),
    ]),
  }),
]);

/** The option in effect on a panel, or null when the player's own mix matches none (the panel says "Custom"). */
export function currentOption(panel) { return panel.options.find((o) => o.isOn()) ?? null; }
/** Rows of a preset the online lane is holding at a forced value - said on the panel, never hidden. */
export const forcedRows = (option) => (option.rows ?? []).filter((r) => rowEnds(row(r)).forced);
