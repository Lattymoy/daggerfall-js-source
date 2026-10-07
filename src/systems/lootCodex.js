// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LOOT10 (2026-10-01) — THE CODEX, AND THE IMPRINT.
//
// The Loot arc (bible/06-Systems/Loot-Arc.md section 12; Mac: "Do you
// wanna turn this into an arc and do all of the above?" - "Legendary
// codex: a collection log of every Legendary you've found ... a reason to
// keep hunting"). Every Legendary record - and every Aetheric piece - the
// character has TAKEN is in its CODEX, with the day it was first found.
// The first find is said and heard (the HUD's line and the level-up's
// fanfare): "Wyrmbane - a Legendary! It joins your codex." The Codex
// page (ui/reforgeWindow.js's fourth) lists every Legendary record (the
// thirty and the Thunderlock's own, AUDIT LOOT F8) and the Aetheric
// sets - a found record whole, an unfound one by where it is found.
//
// HOW A FIND IS SEEN. A piece taken from a body or a pile is told at the
// take (inventory.js's take seam, LOOT8's); everything else that reaches
// the pack - a gate's spoils, a town's thanks, the Broker's wares, a
// trade - is swept up at the next magic round (worldTick.js's round
// hook, the player's own pack and what it wears). A save from before the
// codex was kept fills it SILENTLY at its first sweep: what was already
// carried is the codex's, and nothing is announced that was not just
// found.
//
// THE IMPRINT: a Rare (known, not worn, not imprinted already) takes the
// POWER of a found Legendary of its own group - `imprint`, the record's
// id; lootPowers.js wornPowers reads it on a Rare as on its Legendary
// (LOOT5: one of each power, whatever carries it) - for 20 Welkynd
// Shards and 5,000 gold. It stays Rare. Its card says "Imprint: Silent
// Death (of Nightwhisper)" (lootRarity.js imprintLine).
//
// It rides the character's save (a mod record). OFF IS DFU EXACTLY: no
// find is said, no imprint is made, and an imprint sleeps.
// ═══════════════════════════════════════════════════════════════════

import { lootRarityOn, allLegendaries, legendaryById, powerOf, foundAmong, powerFits, recordFitsGroup } from './lootRarity.js';
import { AETHERIC_RECORDS, aethericById } from './aetheric.js';
import { registerTakeListener } from './inventory.js';
import { registerModSaveData } from './modSaveData.js';
import { registerMagicRoundHook, worldMinutes } from './worldTick.js';
import { hudText } from './notify.js';
import { audio } from './audio.js';
import { SOUND } from './soundClips.js';
import { isEquipped, equipTableOf } from './equip.js';
import { itemIsIdentified } from './tradeModes.js';
import { totalGoldAmount, deductGold } from './court.js';
import { shardsHeld, spendShards } from './reforge.js';

// ── the record ──────────────────────────────────────────────────────
/** `{ legendary: { id: day }, aetheric: { id: day } }` - what this character has found, and the day it first did. */
const empty = () => ({ legendary: {}, aetheric: {} });
let _codex = empty();
/** A save without the codex fills it silently at its first sweep. */
let _backfill = false;
/** The day a find is dated: the world's own day number (worldTick.js's clock, a shared realm's online). */
const _day = () => Math.max(0, Math.floor((Number(worldMinutes()) || 0) / 1440));

/** The codex's own word on a record: its first day, or null. */
export const foundDay = (kind, id) => _codex[kind]?.[id] ?? null;
/** The ids found, of a kind. */
export const foundIds = (kind) => Object.keys(_codex[kind] ?? {});

/** What a piece is to the codex: `{ kind, id }` (a Legendary's record, an Aetheric piece's), or null. */
export function codexKey(item) {
  if (item?.rarity === 'legendary' && typeof item.legendary === 'string' && legendaryById(item.legendary)) return { kind: 'legendary', id: item.legendary };
  if (item?.rarity === 'aetheric' && typeof item.aetheric === 'string' && aethericById(item.aetheric)) return { kind: 'aetheric', id: item.aetheric };
  return null;
}
/** The first find's words: "Wyrmbane - a Legendary! It joins your codex." */
export const CODEX_FIND = (name, kind) => `${name} - ${kind === 'aetheric' ? 'an Aetheric piece' : 'a Legendary'}! It joins your codex.`;

/** NOTE A PIECE: into the codex if it is a record not yet there - said and heard unless `quiet`. Answers whether it
 *  was new. */
export function noteFind(item, { quiet = false } = {}) {
  if (!lootRarityOn()) return false;
  const key = codexKey(item);
  if (!key || foundDay(key.kind, key.id) != null) return false;
  _codex[key.kind][key.id] = _day();
  if (!quiet) {
    const rec = key.kind === 'legendary' ? legendaryById(key.id) : aethericById(key.id);
    hudText(CODEX_FIND(rec?.name ?? item.name ?? '', key.kind));
    audio.playOneShot?.(SOUND.LevelUp, 1);
  }
  return true;
}
/** THE SWEEP: every piece of a pack and of what its wearer wears (a save's first fills it silently). Answers how many
 *  were new. */
export function sweepCodex(entity) {
  if (!lootRarityOn() || !entity) return 0;
  const worn = entity.equip ? equipTableOf(entity).filter(Boolean) : [];
  const quiet = _backfill;
  _backfill = false;
  let n = 0;
  for (const it of [...(entity.items ?? []), ...worn]) if (noteFind(it, { quiet })) n++;
  return n;
}

export const CODEX = 'lootCodex';
export const CODEX_SAVE_VENDOR = 'LootCodex';
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** A record off a save: each kind a map of known ids to whole days; anything else dropped. */
export function validCodexRecord(r) {
  const out = empty();
  for (const kind of ['legendary', 'aetheric']) {
    const m = r && typeof r === 'object' ? r[kind] : null;
    if (!m || typeof m !== 'object' || Array.isArray(m)) continue;
    for (const [id, day] of Object.entries(m)) {
      if (!ID_RE.test(id) || !Number.isSafeInteger(day) || day < 0) continue;
      if (kind === 'legendary' ? !legendaryById(id) : !aethericById(id)) continue;
      out[kind][id] = day;
    }
  }
  return out;
}
/** A save that carries no codex is handed NewSaveData (modSaveData.js, SaveLoadManager's law) - marked `fill`, so the
 *  first sweep takes in what the character already carries without a word; a new game has its own door, and is empty. */
registerModSaveData(CODEX_SAVE_VENDOR, {
  newSaveData: () => ({ ...empty(), fill: true }),
  getSaveData: () => ({ legendary: { ..._codex.legendary }, aetheric: { ..._codex.aetheric } }),
  restoreSaveData: (r) => { _codex = validCodexRecord(r); _backfill = !r || typeof r !== 'object' || r.fill === true; },
  newGame: () => { _codex = empty(); _backfill = false; },
});
registerTakeListener(CODEX, (item) => { noteFind(item); });
registerMagicRoundHook(CODEX, (entity) => { if (entity?.isPlayer) sweepCodex(entity); });

// ── the page ────────────────────────────────────────────────────────
/** Where a family's records are said to be. */
export const FAMILY_HINT = Object.freeze({
  undead: 'Said to be carried by the undead', daedra: 'Said to be held by the daedra', dragon: 'Said to lie in a dragon\'s hoard',
  beast: 'Said to be found among the beasts of the wild', brute: 'Said to be carried by orcs and giants',
  caster: 'Said to be kept by mages and witches', rogue: 'Said to pass among thieves and assassins', warrior: 'Said to be borne by warriors and knights',
});
/** The codex's Legendary rows, the table's order: `{ id, name, group, found, day, hint, power }` - a found record's
 *  name and power, an unfound one's name withheld ("A Legendary of the weapons") and its hint. AUDIT LOOT F8: EVERY
 *  record the tables hold - the thirty and a registered one (the Thunderlock's Last Lock), whose find the codex already
 *  took and said - a record of no family saying its own `hint`. */
export function codexRows() {
  return allLegendaries().map((r) => {
    const day = foundDay('legendary', r.id);
    const p = powerOf(r.id);
    return { id: r.id, kind: 'legendary', name: day != null ? r.name : null, group: r.group, found: day != null, day, hint: FAMILY_HINT[foundAmong(r.id)] ?? r.hint ?? '', power: day != null ? p : null, lore: day != null ? r.lore : null };
  });
}
/** The Aetheric sets' rows: `{ set, pieces: [{ id, name, found, day }] }`, in the records' order. */
export function codexSets() {
  const sets = new Map();
  for (const r of AETHERIC_RECORDS) {
    if (!sets.has(r.set)) sets.set(r.set, []);
    const day = foundDay('aetheric', r.id);
    sets.get(r.set).push({ id: r.id, name: day != null ? r.name : null, found: day != null, day });
  }
  return [...sets].map(([set, pieces]) => ({ set, pieces }));
}
/** How many found, of how many. */
export const codexCount = () => ({ legendary: codexRows().filter((r) => r.found).length, legendaries: allLegendaries().length, aetheric: foundIds('aetheric').length, aetherics: AETHERIC_RECORDS.length });   // AUDIT LOOT F8: of the rows the page lists

// ── the imprint ─────────────────────────────────────────────────────
export const IMPRINT_PRICE = Object.freeze({ shards: 20, gold: 5000 });
/** The found Legendaries a Rare may take the power of: its own group's, with a power it can use (AUDIT LOOT F1 - never
 *  Chain Lightning on a sword or Earthshaker on a bow: lootRarity.js powerFits). */
export const imprintChoices = (item) => (item?.rarity === 'rare'
  ? allLegendaries().filter((r) => recordFitsGroup(r, item) && foundDay('legendary', r.id) != null && powerFits(item, powerOf(r.id)))
  : []);
/** Why a Rare may not take that record's power now, or null: 'off', 'not' (not a Rare), 'unknown', 'worn', 'imprinted',
 *  'unfound' (a record the codex has not, of another group, or with no power), 'shards', 'gold'. */
export function imprintRefusal(item, recordId, player) {
  if (!lootRarityOn()) return 'off';
  if (item?.rarity !== 'rare') return 'not';
  if (!itemIsIdentified(item)) return 'unknown';
  if (isEquipped(item)) return 'worn';
  if (typeof item.imprint === 'string') return 'imprinted';
  if (!imprintChoices(item).some((r) => r.id === recordId)) return 'unfound';
  if (shardsHeld(player?.items) < IMPRINT_PRICE.shards) return 'shards';
  if (totalGoldAmount(player) < IMPRINT_PRICE.gold) return 'gold';
  return null;
}
/** THE IMPRINT, MADE: paid, the power taken. Answers `{ ok: true }` or `{ ok: false, reason }` with nothing taken. */
export function imprintPiece(item, recordId, player) {
  if (!player || !Array.isArray(player.items) || !player.items.includes(item)) return { ok: false, reason: 'gone' };
  const why = imprintRefusal(item, recordId, player);
  if (why) return { ok: false, reason: why };
  spendShards(player.items, IMPRINT_PRICE.shards);
  deductGold(player, IMPRINT_PRICE.gold);
  item.imprint = recordId;
  return { ok: true };
}

/** Tests only: the codex emptied (and the backfill flag down). */
export function _resetCodexForTests() { _codex = empty(); _backfill = false; }
