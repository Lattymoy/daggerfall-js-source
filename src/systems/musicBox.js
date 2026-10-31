// @ts-check
// MUSIC-BOX (2026-10-31; bible/06-Systems/Online-Arc.md MUSIC-BOX). The port's own - DFU has none.
// THE TUNES: the General MIDI songs of SongManager's playlists, each once, named by where the game plays them.
// THE SHEETS: a tune is collected by reading its Sheet music, which a foe of my killing blow may drop into my pack (a
// tune not yet held three times in four); a known tune's sheet is kept to sell.
// THE BOX: a placed piece made the `music` station. Pressed, it lists my tunes; the one picked plays in that room,
// looped, over its own music. Each character picks for itself. Kept in the save's per-mod slot (modSaveData.js).
import { registerModSaveData } from './modSaveData.js';
import { t } from './textManager.js';
import { registerItemUseHandler, setItemFields, mintCondition } from './item/itemTemplates.js';
import { MUSIC_SHEET_TEMPLATE, MUSIC_SHEET_GROUP } from './musicSheetRow.js';
export { MUSIC_SHEET_TEMPLATE, MUSIC_SHEET_GROUP, MUSIC_SHEET_ROW } from './musicSheetRow.js';
import { registerPlayerKillListener } from './playerKills.js';
import { playerDoor } from './playerDoor.js';
import { addItem } from './inventory.js';
import {
  SUNNY_SONGS, CLOUDY_SONGS, OVERCAST_SONGS, RAIN_SONGS, SNOW_SONGS, NIGHT_SONGS, TAVERN_SONGS, TEMPLE_GOOD_SONGS,
  TEMPLE_NEUTRAL_SONGS, TEMPLE_BAD_SONGS, SHOP_SONGS, MAGES_GUILD_SONGS, PALACE_SONGS, CASTLE_SONGS, COURT_SONGS,
  KNIGHT_SONGS, INTERIOR_SONGS, SNEAKING_SONGS, DUNGEON_SONGS,
} from './song/songManager.js';

export const MUSIC_BOX_VENDOR = 'musicBox';
/** The station that makes a piece a music box. */
export const MUSIC_STATION = 'music';
/** A kill's chance to drop a sheet, and the share of sheets that are a tune not yet held while any is left. */
export const MUSIC_SHEET_CHANCE = 1 / 40;
export const MUSIC_SHEET_NEW_SHARE = 0.75;
/** The most boxes a character keeps a pick for; the oldest pick goes first. */
export const MUSIC_BOX_PICKS_MAX = 32;

const stem = (/** @type {string} */ name) => name.replace(/\.HMI$/, '');
/** The groups, in the list's order: an id, its name, the playlists it gathers. A song stands in its first. */
/** @type {ReadonlyArray<[string, () => string, ReadonlyArray<ReadonlyArray<string>>]>} */
const GROUPS = Object.freeze([
  ['day', () => t('music.group.day', 'Day'), [SUNNY_SONGS, CLOUDY_SONGS]],
  ['overcast', () => t('music.group.overcast', 'Overcast'), [OVERCAST_SONGS]],
  ['rain', () => t('music.group.rain', 'Rain'), [RAIN_SONGS]],
  ['snow', () => t('music.group.snow', 'Snow'), [SNOW_SONGS]],
  ['night', () => t('music.group.night', 'Night'), [NIGHT_SONGS]],
  ['tavern', () => t('music.group.tavern', 'Tavern'), [TAVERN_SONGS]],
  ['temple', () => t('music.group.temple', 'Temple'), [TEMPLE_GOOD_SONGS, TEMPLE_NEUTRAL_SONGS, TEMPLE_BAD_SONGS]],
  ['shop', () => t('music.group.shop', 'Shop'), [SHOP_SONGS]],
  ['mages', () => t('music.group.mages', 'Mages Guild'), [MAGES_GUILD_SONGS]],
  ['palace', () => t('music.group.palace', 'Palace'), [PALACE_SONGS, CASTLE_SONGS, COURT_SONGS, KNIGHT_SONGS]],
  ['home', () => t('music.group.home', 'House'), [INTERIOR_SONGS]],
  ['sneaking', () => t('music.group.sneaking', 'Sneaking'), [SNEAKING_SONGS]],
  ['dungeon', () => t('music.group.dungeon', 'Dungeon'), [DUNGEON_SONGS]],
]);

/** Every tune, in the list's order: `{ key, group, n, of }` - its MIDI.BSA stem, its group, its place in the group. */
export const MUSIC_TUNES = Object.freeze((() => {
  const seen = new Set(), out = [];
  for (const [group, , lists] of GROUPS) {
    const keys = [];
    for (const list of lists) for (const name of list) { const k = stem(name); if (!seen.has(k)) { seen.add(k); keys.push(k); } }
    keys.forEach((key, i) => out.push(Object.freeze({ key, group, n: i + 1, of: keys.length })));
  }
  return out;
})());
const TUNE_KEYS = new Set(MUSIC_TUNES.map((x) => x.key));

/** FM twins whose name does not say their General MIDI tune (SongManager's FM lists, place by place). */
const FM_TWINS = Object.freeze({
  FM_SWIM2: 'SWIMMING', FM_SUNNY: 'SUNNYDAY', FM_RAIN: 'RAINING', FMOVER_C: 'OVERCAST', FMOVER_S: 'OVERSNOW',
  FMSNEAK2: 'SNEAKNG2', FM_SQR_2: 'SQUARE_2', FM_NITE3: 'GMAGE_3', FM_DNGN1: 'DUNGEON', FM_DNGN2: 'DUNGEON6',
  FM_DNGN3: 'DUNGEON7', FM_DNGN4: 'DUNGEON8', FM_DNGN5: 'DUNGEON9',
});
/** The tune a song played is - its own stem, or its FM twin's (`12FM` is `12`, `FPALAC` is `GPALAC`) - or null. */
export function tuneOfSong(/** @type {unknown} */ name) {
  if (typeof name !== 'string') return null;
  const k = stem(name.toUpperCase());
  if (TUNE_KEYS.has(k)) return k;
  const twin = FM_TWINS[/** @type {keyof typeof FM_TWINS} */ (k)] ?? (/^\d\dFM$/.test(k) ? k.slice(0, 2) : /^F/.test(k) ? `G${k.slice(1)}` : null);
  return twin && TUNE_KEYS.has(twin) ? twin : null;
}

/** A tune's name, in the player's language. */
export function tuneName(/** @type {string} */ key) {
  const tune = MUSIC_TUNES.find((x) => x.key === key);
  if (!tune) return key;
  const g = GROUPS.find(([id]) => id === tune.group);
  const group = g ? g[1]() : tune.group;
  return tune.of === 1 ? group : t('music.tune', '{group} {n}', { group, n: tune.n });
}

const fresh = () => ({ tunes: {}, picks: {} });
let box = /** @type {{ tunes: Record<string, number>, picks: Record<string, string> }} */ (fresh());
const PIECE_RE = /^[A-Za-z0-9_-]{1,24}$/;   // net/decorLaw.js DECOR_ID_RE

/** A save's record read: tunes the list knows, each with the UTC day it was first heard; picks of a known tune, at most
 *  MUSIC_BOX_PICKS_MAX. A row out of its law is dropped. */
export function readMusicBox(/** @type {any} */ rec) {
  const out = fresh();
  const tunes = rec?.tunes, picks = rec?.picks;
  if (tunes && typeof tunes === 'object' && !Array.isArray(tunes)) {
    for (const [k, day] of Object.entries(tunes)) if (TUNE_KEYS.has(k) && Number.isSafeInteger(day) && day >= 0) out.tunes[k] = day;
  }
  if (picks && typeof picks === 'object' && !Array.isArray(picks)) {
    for (const [id, k] of Object.entries(picks).slice(-MUSIC_BOX_PICKS_MAX)) if (PIECE_RE.test(id) && TUNE_KEYS.has(k)) out.picks[id] = k;
  }
  return out;
}

/** A song or a tune key learned on UTC day `day`: its tune collected, if it is one and new. Whether it was new. */
export function noteTuneHeard(/** @type {unknown} */ name, /** @type {number} */ day) {
  const k = tuneOfSong(name);
  if (!k || Object.hasOwn(box.tunes, k)) return false;
  box.tunes[k] = Number.isSafeInteger(day) && day >= 0 ? day : 0;
  return true;
}
/** The tunes collected, `{ key: day }` - a copy. */
export const tunesHeard = () => ({ ...box.tunes });
/** How many of the list are collected. */
export const tuneCount = () => ({ held: Object.keys(box.tunes).length, total: MUSIC_TUNES.length });
/** The tunes collected, in the list's order. */
export const tunesHeld = () => MUSIC_TUNES.filter((x) => Object.hasOwn(box.tunes, x.key)).map((x) => x.key);

/** What the box `pieceId` plays for this character, or null (the room's own music). */
export const boxPick = (/** @type {string} */ pieceId) => (Object.hasOwn(box.picks, pieceId) ? box.picks[pieceId] : null);
/** Whether any box has a pick - the frame's cheap first ask. */
export const anyBoxPick = () => Object.keys(box.picks).length > 0;
/** The boxes with a pick. */
export const pickedBoxes = () => Object.keys(box.picks);
/** Set what the box `pieceId` plays - a collected tune, or null for the room's own music. Whether it was taken. */
export function setBoxPick(/** @type {string} */ pieceId, /** @type {string | null} */ key) {
  if (typeof pieceId !== 'string' || !PIECE_RE.test(pieceId)) return false;
  delete box.picks[pieceId];
  if (key == null) return true;
  if (!Object.hasOwn(box.tunes, key)) return false;
  box.picks[pieceId] = key;   // re-set, so it is the newest
  const ids = Object.keys(box.picks);
  for (const id of ids.slice(0, Math.max(0, ids.length - MUSIC_BOX_PICKS_MAX))) delete box.picks[id];
  return true;
}
export const _resetMusicBoxForTests = (/** @type {any} */ rec = null) => { box = readMusicBox(rec); };

registerModSaveData(MUSIC_BOX_VENDOR, {
  newSaveData: () => fresh(),
  getSaveData: () => readMusicBox(box),
  restoreSaveData: (rec) => { box = readMusicBox(rec); },
});

/**
 * THE BOX'S SCORE - one frame, in the world host's music chain after the other scores and before the director. While a
 * box this character picked a tune for stands in the room (`here(id)`), its tune plays, looped (`playSong` each frame
 * starts it again when it ends); the frame no box plays, the tune fades and the director's next frame plays its own.
 * Answers whether the box holds the music.
 * @param {{ music: any, here: (id: string) => boolean }} deps
 */
export function createMusicBoxScore({ music, here }) {
  let held = false;
  return {
    frame() {
      const id = anyBoxPick() ? pickedBoxes().find((p) => here(p)) : undefined;
      const want = id ? boxPick(id) : null;
      if (!want) {
        if (held) { held = false; music?.fadeOut?.(); }
        return false;
      }
      held = true;
      music?.playSong?.(`${want}.HMI`);
      return true;
    },
  };
}

// ═══ THE SHEETS ═══════════════════════════════════════════════════════════════════════════════
const today = () => Math.floor(Date.now() / 86_400_000);
/** The sheet's tune, off its `message` (MUSIC_TUNES' index), or null. */
export const sheetTuneOf = (/** @type {any} */ item) => (item?.templateIndex === MUSIC_SHEET_TEMPLATE && Number.isSafeInteger(item.message) ? MUSIC_TUNES[item.message]?.key ?? null : null);
/** A sheet of `key`'s tune, or null for no tune. */
export function mintSheet(/** @type {string} */ key) {
  const i = MUSIC_TUNES.findIndex((x) => x.key === key);
  if (i < 0) return null;
  return mintCondition(setItemFields({
    group: MUSIC_SHEET_GROUP, templateIndex: MUSIC_SHEET_TEMPLATE, material: 0, flags: 0, variant: 0, message: i, stackCount: 1,
    name: t('music.sheet.item', 'Sheet music: {tune}', { tune: tuneName(key) }),
  }));
}
/** Which tune a found sheet is: one not yet held MUSIC_SHEET_NEW_SHARE of the time while any is left, else any. */
export function sheetFind(/** @type {() => number} */ rolls = Math.random) {
  const fresh = MUSIC_TUNES.filter((x) => !Object.hasOwn(box.tunes, x.key));
  const pool = fresh.length && rolls() < MUSIC_SHEET_NEW_SHARE ? fresh : MUSIC_TUNES;
  return pool[Math.min(pool.length - 1, Math.floor(rolls() * pool.length))].key;
}
export const MUSIC_SHEET_TEXT = Object.freeze({
  found: (/** @type {string} */ tune) => t('music.sheet.found', 'You found sheet music: {tune}.', { tune }),
  learned: (/** @type {string} */ tune) => t('music.sheet.learned', 'Your music box can now play {tune}.', { tune }),
  known: (/** @type {string} */ tune) => t('music.sheet.known', 'Your music box can already play {tune}. You can sell this sheet.', { tune }),
});
/** THE SHEET READ: its tune collected and the sheet spent - or, known already, nothing spent. */
export function readSheet(/** @type {any} */ item, /** @type {any[]} */ list) {
  const key = sheetTuneOf(item);
  if (!key) return null;
  if (!noteTuneHeard(key, today())) return { kind: 'text', text: MUSIC_SHEET_TEXT.known(tuneName(key)) };
  const i = Array.isArray(list) ? list.indexOf(item) : -1;
  if (i >= 0) list.splice(i, 1);
  return { kind: 'text', text: MUSIC_SHEET_TEXT.learned(tuneName(key)) };
}
registerItemUseHandler(MUSIC_SHEET_TEMPLATE, (/** @type {any} */ item, /** @type {any[]} */ list) => readSheet(item, list));

/** A foe of my killing blow: a sheet into my pack, MUSIC_SHEET_CHANCE of the time, once a body. Answers the sheet or null. */
const _rolled = new WeakSet();
export function sheetForKill(/** @type {any} */ entity, /** @type {any} */ door = playerDoor(), /** @type {() => number} */ rolls = Math.random) {
  if (!entity || typeof entity !== 'object' || _rolled.has(entity)) return null;
  _rolled.add(entity);
  const me = door?.player?.();
  if (!me || rolls() >= MUSIC_SHEET_CHANCE) return null;
  const sheet = mintSheet(sheetFind(rolls));
  if (!sheet) return null;
  addItem((me.items ??= []), sheet);
  door.say?.(MUSIC_SHEET_TEXT.found(tuneName(/** @type {string} */ (sheetTuneOf(sheet)))));
  return sheet;
}
registerPlayerKillListener(MUSIC_BOX_VENDOR, (/** @type {any} */ entity) => { sheetForKill(entity); });
