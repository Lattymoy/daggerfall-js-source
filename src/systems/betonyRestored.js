// BET1 (2026-10-05, the owner: "This is the next mod I would like to integrate") - BETONY RESTORED 1.1.3 (Cliffworms),
// the mod's code and art. bible/03-World/Betony-Restored.md is the page; vendor/betony-restored/README.md the provenance.
//
// The mod is four things, and this module is the three that are not world data:
//   - THE WORLD DATA - 25 places on the island of Betony (Betony City, four towns, seven dungeons, ten homes and farms,
//     a tavern, a temple and a shrine) and fourteen new blocks: vendor/betony-restored/WorldDataPack, rebuilt from the player's own
//     MAPS.BSA and BLOCKS.BSA through the world-data door (scenes/modWorldData.js, formats/worldDataPack.js);
//   - THE SCRIPT (`Betony Restored.dll`, read off its IL: vendor/betony-restored/il/BetonyRestored.il.txt) - Lord
//     Mogref's faction, and the street NPCs a town's day and its rain show and hide (UpdateExteriorNPCs) - below;
//   - THE PICTURES - its own drawings, Kamer's sitting patrons and the Mara statue, the classic records it moved or
//     painted on (rebuilt from the player's own TEXTURE files), its scale files - below, on the texture door;
//   - BETONY'S ROADS - Basic Roads' arrays with the island's roads drawn in (vendor/betony-restored/roads.json) - below.
// And the rules it ships for Flat Replacer (Numidium3rd's, a peer the port does not carry): the portraits its custom
// people talk with - below, on FLATS.CFG's face door.
//
// A LEAF apart from the settings store and the doors it registers on: no DOM, no world - the hosts hand in what
// PlayerGPS, WorldTime and WeatherManager answer.
//
// Four hosts: world.js WIRED (the street people's update on its frame's edges, Betony's roads on its terrain);
// worldModes.js and dungeonContext.js stand no street (the update walks ExteriorParent's people alone); exterior.js
// (the bench) FLAGGED - it stands every street person of a record in one batch for the whole city, up front, and
// cannot set one down (its own note at its exterior-NPC pass). The faction, the pictures, the DET stand-ins and the
// portraits are doors every host reads.

import DERIVED from '../../vendor/betony-restored/Textures/derived.json' with { type: 'json' };
import RESHADED from '../../vendor/betony-restored/Textures/reshaded.json' with { type: 'json' };
import FLAT_REPLACEMENTS from '../../vendor/betony-restored/FlatReplacements/BetonyRestoredFlatReplacements.json' with { type: 'json' };
import ROADS_DIFF from '../../vendor/betony-restored/roads.json' with { type: 'json' };
import { modSetting, latchModLoaded, modLatchedOn } from './modSettings.js';
import { registerCustomFaction } from '../formats/factionFile.js';
import { addVendorTextures } from './textureReplacement.js';
import { registerBillboardXml } from '../world/billboardXml.js';
import { buildDerivedPicture } from '../formats/derivedTexture.js';
import { shareDetailedShipsArt } from './detailedShips.js';
import { installDetStandIns } from '../world/detStandIns.js';
import { setFlatFaceOverride } from '../characters/staticNpc.js';
import { isPlayerInTown } from './nearbyObjects.js';
import { DAWN_HOUR, DUSK_HOUR } from './gameDate.js';

export const BETONY_VENDOR = 'betony-restored';
/** The mod loaded for the game - the world-data loader's latch once its pack is on the door (a pack that did not load
 *  is a mod not loaded, as WD3's are), or its Init's (installBetonyRestored) in a host that inits before the packs load. */
export const betonyLoaded = () => modLatchedOn(BETONY_VENDOR) === true;

// ── the script: BetonyRestoredMod (il/BetonyRestored.il.txt) ───────────────────────────────────────────────────────
/** RegisterFactionIds (IL_0308-038d): RegisterCustomFaction(1432, data). THE KEY IS 1432 AND THE RECORD'S OWN `id` IS
 *  1532 - the IL pushes 1432 as the call's first argument and stores 1532 in FactionData.id. DFU keys the dictionary by
 *  the argument (FactionFile.RegisterCustomFaction, PersistentFactionData.AddCustomFactions), and Lord Mogref's person
 *  in the palace (PALAAA00Betony's interior, 183_4) carries 1432, so he is found; the record keeps its 1532, as DFU
 *  keeps it - his parent's children list names 1532 (RelinkChildren pushes the record's id), the mod's own quirk. */
export const LORD_MOGREF_FACTION_KEY = 1432;
export const LORD_MOGREF_FACTION = Object.freeze({
  id: 1532, parent: 203, type: 4, name: 'Lord Mogref', summon: -1, region: 20, power: 18, face: 405, race: 3, sgroup: 3, ggroup: -1, children: null,
});
/** The three flag bits the mod reads on a street person (its fields npcFlagHideDay/Night/Weather; the IL loads them as
 *  literals, IL_0435, IL_0449, IL_0471). The author sets them in the World Data Editor on a flat with a faction - the
 *  marketplace's stalls, wares and traders. */
export const BETONY_NPC_FLAGS = Object.freeze({ hideDay: 1, hideNight: 2, hideWeather: 4 });

/**
 * UpdateExteriorNPCs' law for one street StaticNPC (IL_0409-049a), the SetActive it gives: a person flagged to hide by
 * day is shown only at night and dry-or-unflagged-for-rain; one flagged to hide by night, only by day the same way; any
 * other only while it is not raining on one flagged for the weather.
 *   hideWeather = (flags & 4) > 0 && IsRaining
 *   flags & 1 ? (IsDay ? false : !hideWeather) : flags & 2 ? (IsDay ? !hideWeather : false) : !hideWeather
 */
export function betonyNpcShown(flags, isDay, isRaining) {
  const hideWeather = (flags & BETONY_NPC_FLAGS.hideWeather) !== 0 && isRaining;
  if (flags & BETONY_NPC_FLAGS.hideDay) return isDay ? false : !hideWeather;
  if (flags & BETONY_NPC_FLAGS.hideNight) return isDay ? !hideWeather : false;
  return !hideWeather;
}

/**
 * UpdateExteriorNPCs (IL_03a4-04b0) over the host's street people: nothing unless IsPlayerInTown(false, true) - a town
 * type's map pixel and the player outside (IL_03de-03e5) - then every StaticNPC under the exterior with a faction
 * (IL_041d-0428: a billboard with no StaticNPC, or a faction of 0, is passed over) takes betonyNpcShown's answer. The
 * DFU walk is `ExteriorParent.GetComponentsInChildren<Billboard>(true)`: every location the streaming world holds, not
 * the player's alone - so the hosts hand in every built pixel's people.
 *
 * RECORDED DEPARTURE (BET-FIX, Port-Ledger A): the mod's SetActive(true) also stands back up an individual a live quest
 * has placed somewhere else (the away arm of SetupIndividualStaticNPC set that home copy inactive at layout) - a
 * questor twice in the world after the next dawn. The port keeps the quest's word: `pn.questAway` is the away arm's
 * mark (the hosts set it), and an away person stays down whatever the hour.
 *
 * @param {Array<{factionID:number, flags:number, active:boolean, questAway?:boolean}>} npcs
 * @returns {number} how many changed - the host stands a pixel's batches again when its people did
 */
export function updateExteriorNpcs(npcs, { locationType, inside, isDay, isRaining }) {
  if (!isPlayerInTown(locationType, { mustBeOutside: true, inside: !!inside })) return 0;
  let changed = 0;
  for (const pn of npcs ?? []) {
    if (!pn || !pn.factionID) continue;
    const shown = !pn.questAway && betonyNpcShown(pn.flags ?? 0, !!isDay, !!isRaining);
    if (pn.active !== shown) { pn.active = shown; changed++; }
  }
  return changed;
}

/**
 * The three events InitMod subscribes UpdateExteriorNPCs to besides PlayerGPS.OnEnterLocationRect (IL_029a-02d9):
 * WeatherManager.OnWeatherChange, WorldTime.OnDawn and WorldTime.OnDusk. WorldTime.RaiseEvents' dawn and dusk are an
 * HOUR's edge (WorldTime.cs:84-95: `lastHour != DawnHour && Hour == DawnHour`) - a jump straight past six raises none.
 * The hosts feed it the hour their sky shows (TIME1: the hour every isNight of theirs reads) and the weather word, and
 * ask it each frame whether the mod's update runs.
 */
export function createBetonyEvents() {
  let lastHour = null, lastWeather = null;
  return {
    /** Whether this frame raises OnDawn, OnDusk or OnWeatherChange. The first call only remembers. */
    tick(hour, weather) {
      const first = lastHour === null;
      const dawn = !first && lastHour !== DAWN_HOUR && hour === DAWN_HOUR;
      const dusk = !first && lastHour !== DUSK_HOUR && hour === DUSK_HOUR;
      const weatherChange = !first && weather !== lastWeather;
      lastHour = hour; lastWeather = weather;
      return dawn || dusk || weatherChange;
    },
  };
}

let _installed = false;
/**
 * Init + Awake + InitMod, once, at the boot every host shares (scenes/shared.js): the mod latched loaded for the game
 * or not, then while it is loaded "Begin mod init: BetonyRestored", the faction (its failure logged as the mod logs it,
 * "BetonyRestored: Failed to register faction ids."), "Finished mod init: BetonyRestored" - and the port's halves the
 * script has no word for: the pictures and Flat Replacer's portraits. The four event subscriptions are the hosts' (the
 * frame loop's edges; world.js).
 */
export function installBetonyRestored({ fetchBytes = null } = {}) {
  if (_installed) return false;
  _installed = true;
  // The world-data loader latches the mod as its pack lands on the door (scenes/modWorldData.js: a pack that did not
  // load, or a closed door, is a mod not loaded - WD3's law) and world.js loads the packs BEFORE this Init: its answer
  // stands. A host that inits first latches the switch, and the loader's answer replaces it when it comes.
  const latched = modLatchedOn(BETONY_VENDOR);
  if (!(latched === undefined ? latchModLoaded(BETONY_VENDOR, modSetting(BETONY_VENDOR, 'Enabled') === true) : latched === true)) return true;
  console.log('Begin mod init: BetonyRestored');
  if (!registerCustomFaction(LORD_MOGREF_FACTION_KEY, LORD_MOGREF_FACTION)) console.warn('BetonyRestored: Failed to register faction ids.');
  console.log('Finished mod init: BetonyRestored');
  installBetonyArt({ fetchBytes });
  installFlatReplacerPortraits();
  return true;
}
export function _resetBetonyRestored() { _installed = false; _artInstalled = false; }

// ── the pictures ───────────────────────────────────────────────────────────────────────────────────────────────────
/** The pictures that are the author's own (no classic record is them), shipped as PNG: Cliffworms' two bottle shelves,
 *  the Mara statue (WilhelmBlack and King of Worms, the readme says, from Finding My Religion) and Kamer's two sitting
 *  patrons, every frame. The tool's measurement (tools/betonyRestoredAssets.mjs); test/bet1_betony.test.js holds the
 *  list to the directory. */
export const BETONY_OWN_ART = Object.freeze([
  ...Array.from({ length: 31 }, (_, f) => `1200_53-${f}`),
  ...Array.from({ length: 32 }, (_, f) => `1200_54-${f}`),
  '1210_14-0', '1210_15-0', '1230_11-0',
]);
/** The pictures rebuilt from classic records (the extinguished lights with the flame taken out, the smokeless pot
 *  218_5, the shelves of classic bottles and goblets), by name. */
export const BETONY_DERIVED = DERIVED;
/** The pictures that re-shade a classic record whole (the rest of the extinguished lights): not carried - the player's
 *  own copy of the mod answers first (an attached .dfmod), and the record each re-shades stands in. */
export const BETONY_RESHADED = RESHADED;
/** The xml scale of each picture carried here (Textures/1230_11-0.xml) - 1210_17 and _18's are Detailed Ships',
 *  identical, and ride with its pictures. */
export const BETONY_XML = Object.freeze({ 1230: Object.freeze({ 11: Object.freeze([0.7, 0.7]) }) });
/**
 * The people the mod places whose pictures are the RMB Resource Pack's (StarMadeKnight's NPCs - the pack's catalogue
 * names them) - not this author's, not credited by its readme, and WD3 carries nothing of the pack: the player's own
 * sprite of the same kind stands in (a classic record, sized as it sizes itself), and the player's own copy of the pack
 * or of this mod answers first. Read off the catalogue's names and each picture:
 *   1200_13 "Noble Swordsman" (the tavern of MARKAA00Betony's subrecord 6; no picture in this mod at all) - 183_10, the
 *           nobleman in the green and gold coat;
 *   1200_14 "Wealthy Woman" (the same tavern) - 183_5, the woman in the long tan gown;
 *   1200_19 "Armored Woman" (the tavern of subrecord 9) - 182_45, the woman in the silver doublet.
 */
export const BETONY_NPC_STAND_INS = Object.freeze({ 13: Object.freeze([183, 10]), 14: Object.freeze([183, 5]), 19: Object.freeze([182, 45]) });
export const BETONY_NPC_ARCHIVE = 1200;

export const betonyArtUrl = (name) => new URL(`../../vendor/betony-restored/Textures/${name}.png`, import.meta.url).href;
const parseName = (name) => { const m = /^(\d+)_(\d+)-(\d+)$/.exec(name); return { archive: Number(m[1]), record: Number(m[2]), frame: Number(m[3]) }; };
/** A record of one of Daggerfall's own archives the mod replaces (218_5) - every other picture here is of an archive no
 *  TEXTURE file has (540, 1200, 1210, 1230), which stands on the door as that archive. */
const isClassicArchive = (archive) => archive <= 511;

let _artInstalled = false;
/** The pictures on the texture door, behind the mod's latch: the drawings by fetch, the classic ones built from the
 *  player's records, the re-shades and the pack's people stood in by classic records (yielding to the player's own);
 *  the xml scale; Detailed Ships' identical pictures shared; DET's stand-ins on for the pieces the blocks place.
 *  Returns the pictures registered. */
export function installBetonyArt({ fetchBytes = null } = {}) {
  if (_artInstalled) return 0;
  _artInstalled = true;
  registerBillboardXml(BETONY_VENDOR, BETONY_XML, betonyLoaded);
  shareDetailedShipsArt(betonyLoaded);   // 1210_8-12 and 1210_17-20 and their two scales: Detailed Ships' pictures, pixel for pixel
  installDetStandIns(betonyLoaded);      // the DET models and flats its blocks place - the port's own stand-ins
  const load = fetchBytes ?? (async (name) => { const r = await fetch(betonyArtUrl(name)); if (!r.ok) throw new Error(`${name}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); });
  const gate = betonyLoaded;
  const own = BETONY_OWN_ART.map((name) => ({ ...parseName(name), fileName: name, standIn: true, gate, load }));
  const derived = Object.entries(DERIVED).map(([name, spec]) => {
    const at = parseName(name);
    // 218_5 is ONE RECORD of a real archive (TEXTURE.218), overridden as a texture pack overrides one - never a stand-in
    // for the archive (textureReplacement.js `standIn`: the archive number cannot tell, the registration says)
    return { ...at, fileName: name, standIn: !isClassicArchive(at.archive), gate, build: (ctx) => buildDerivedPicture(spec, ctx.classicRgba) };
  });
  const classicStandIn = (archive, record, frame, from, fileName) => ({
    archive, record, frame, fileName, standIn: true, yields: true, gate,
    build: async (ctx) => ({ ...(await buildDerivedPicture({ from }, ctx.classicRgba)), scale: (await ctx.classicScale?.(from[0], from[1])) ?? null }),
  });
  const reshaded = Object.entries(RESHADED).map(([name, from]) => { const at = parseName(name); return classicStandIn(at.archive, at.record, at.frame, from, `betony-stand-in-${name}`); });
  const people = Object.entries(BETONY_NPC_STAND_INS).map(([record, from]) => classicStandIn(BETONY_NPC_ARCHIVE, Number(record), 0, [...from], `betony-stand-in-${BETONY_NPC_ARCHIVE}_${record}-0`));
  return addVendorTextures([...own, ...derived, ...reshaded, ...people]);
}

// ── Flat Replacer's portraits (FlatReplacements/BetonyRestoredFlatReplacements.json) ────────────────────────────────
/**
 * Six rules for Flat Replacer, each a flat that replaces itself (TextureArchive/Record == ReplaceTextureArchive/Record)
 * so that its one effect is FlatPortrait: the talk window's face for the custom people. Regions -1, FactionId -1 and
 * BuildingType -1 are "any", QualityMin 1 to QualityMax 20 every building's quality - every interior, which is where
 * Flat Replacer works and where the mod places them. A face is a TFAC00I0.RCI record (DaggerfallTalkWindow's
 * CommonFaces): 360 and 243 are Daggerfall's own; 1200014 and the like are the RMB Resource Pack's pictures
 * (`TFAC00I0.RCI_1200014-0`), which answer through the player's own attached copy of the pack (ui/nativeTalk.js,
 * DFMOD1) - without it the record is no picture, and the face is DFU's own pick (the faction's, else 410).
 * The port has no Flat Replacer: FLATS.CFG's face for the flat is the door it writes (characters/staticNpc.js, RR2's
 * seam), which is exactly the face TalkManager.GetPortraitIndexFromStaticNPCBillboard asks the billboard for.
 */
export function flatReplacerPortraits(rules = FLAT_REPLACEMENTS) {
  const out = [];
  for (const r of rules ?? []) {
    if (r.TextureArchive !== r.ReplaceTextureArchive || r.TextureRecord !== r.ReplaceTextureRecord) continue;   // a replacement of the picture itself - none of the six
    if (!(r.FlatPortrait >= 0)) continue;
    out.push({ archive: r.TextureArchive, record: r.TextureRecord, face: r.FlatPortrait, classic: r.FlatPortrait < CUSTOM_PORTRAIT_FIRST });
  }
  return out;
}
/** TFAC00I0.RCI holds 503 classic faces (0..502, hudEscortFaces.js: "61..502 -> TFAC00I0.RCI"); anything past is a
 *  mod's picture. */
export const CUSTOM_PORTRAIT_FIRST = 503;
let _hasModPortrait = () => false;
/** The host's answer to "does an attached mod carry this face" (systems/dfmodTextures.js hasDfmodCifRci) - set where
 *  the hosts wire the door, so this module stays a leaf. */
export function setBetonyPortraitProbe(fn) { _hasModPortrait = typeof fn === 'function' ? fn : () => false; }
function installFlatReplacerPortraits() {
  for (const p of flatReplacerPortraits()) {
    setFlatFaceOverride(p.archive, p.record, p.classic
      ? () => (betonyLoaded() ? p.face : null)
      : () => (betonyLoaded() && _hasModPortrait('TFAC00I0.RCI', p.face) ? p.face : null));
  }
}

// ── Betony's roads ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Basic Roads' arrays as the mod ships them (its roadData and trackData replace Basic Roads' own: ModManager asks the
 *  mods loaded last first, and the mod loads after its dependencies): Hazelnut's, with the island's roads written in.
 *  `net` is world/roadsProducer.js loadModRoads' answer; a new one is returned, the arrays copied. */
export function withBetonyRoads(net, diff = ROADS_DIFF) {
  if (!net?.roads || !net?.tracks) return net;
  const roads = Uint8Array.from(net.roads), tracks = Uint8Array.from(net.tracks);
  for (const [i, v] of diff.roads.pixels) roads[i] = v;
  for (const [i, v] of diff.tracks.pixels) tracks[i] = v;
  let n = 0; for (const v of roads) if (v) n++;
  return { ...net, roads, tracks, source: net.source, stats: { ...(net.stats ?? {}), roadPixels: n, betony: true } };
}
export const BETONY_ROADS = ROADS_DIFF;
