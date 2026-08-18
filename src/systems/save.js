// Save/load (Systems S11). DFU's own save system is a JSON
// serialization of live state (SerializablePlayer et al.) - the
// faithful port shape. This slice: THE PLAYER snapshot - entity
// (stats, skills, uses, health/magicka, level sums, career by
// index + data), items, known spells (by SPELLS.STD index),
// active effects, the classic clock, and position. WORLD state
// (foes, loot piles, action states, doors) is FLAGGED - dungeons
// re-derive from their location on load; the world snapshot pends
// its slice. Versioned envelope; a mismatch refuses loudly.

import { rebuildEquipState } from './equip.js';   // AUDIT 17e C1
import { goldStack } from './inventory.js';   // AUDIT 17f

export const SAVE_VERSION = 1;
export const QUICKSAVE_KEY = 'dagger.quicksave';

const ENTITY_FIELDS = [
  'name', 'gender', 'race', 'raceId', 'faceIndex',   // S3c/U9: the identity rides the save
  'careerIndex', 'level', 'reflexes',
  'health', 'maxHealth', 'magicka', 'maxMagicka', 'fatigue',
  'currentBreath',   // P12 (SerializablePlayer carries it; missing = 0/surfaced on old saves)
  'startingLevelUpSkillSum', 'currentLevelUpSkillSum',
  'readyToLevelUp', 'pendingLevel', 'chargenDone',
  // AUDIT 17h F1: the six BIOGRAPHY modifiers, which DFU persists
  // one-for-one (SerializablePlayer.cs:136-141, :305-310). Without
  // them a load reset every biography answer's lasting effect.
  'biographyResistDiseaseMod', 'biographyResistMagicMod', 'biographyAvoidHitMod',
  'biographyResistPoisonMod', 'biographyFatigueMod', 'biographyReactionMod',
];

/** AUDIT 17h F1: the ELEVEN social-group reputations DFU writes out
 *  field by field (SerializablePlayer.cs:152-162) and the matching
 *  reaction modifiers. Nothing persisted these, so a quicksave/load
 *  reset the player's standing with every social group to zero -
 *  which getReactionToPlayer reads on EVERY greeting, and which the
 *  biography, the T3f tone tallies and the G2 court sentences all
 *  write to. The port has never carried them; the biography made the
 *  gap load-bearing from the first minute of a new character. */
const REP_ARRAYS = ['sGroupReputations', 'reactionMods'];

/** Deep-copy one activeEffects entry: permanent drain entries carry
 *  no effect record (S15); disease entries carry the accumulating
 *  per-stat statMods map (S18) - both nested objects must detach or
 *  the snapshot mutates with the live entity. */
const copyEffectEntry = (a) => {
  const c = { ...a };
  if (a.effect) c.effect = { ...a.effect };
  if (a.statMods) c.statMods = { ...a.statMods };
  return c;
};

/** A plain-object snapshot of the player + scene extras. */
export function snapshotPlayer(entity, { position = null, classicMinutes = 0, readiedSpellIndex = null, world = null, locationKey = null } = {}) {
  const snap = { v: SAVE_VERSION, position, classicMinutes, readiedSpellIndex, world, locationKey };
  for (const k of ENTITY_FIELDS) snap[k] = entity[k];
  snap.stats = { ...entity.stats };
  // AUDIT 17e: pre-chargen the entity carries a flat NUMBER here
  // (playerEntity's INTERIM skills: 30) - spreading it threw.
  snap.skills = Array.isArray(entity.skills) ? [...entity.skills] : entity.skills;
  snap.skillUses = [...(entity.skillUses ?? [])];
  snap.career = entity.career ? { ...entity.career } : null;   // plain CFG data
  snap.items = (entity.items ?? []).map((it) => ({ ...it }));
  snap.spells = (entity.spells ?? []).map((sp) => sp.index);   // resolve against SPELLS.STD on load
  snap.activeEffects = (entity.activeEffects ?? []).map(copyEffectEntry);
  for (const k of REP_ARRAYS) snap[k] = entity[k] ? [...entity[k]] : null;
  // the biography's faction-rep deltas wait here for the faction slice
  snap.pendingFactionRep = (entity.pendingFactionRep ?? []).map((r) => ({ ...r }));
  snap.backStory = [...(entity.backStory ?? [])];
  return snap;
}

/** Restore a snapshot onto the live entity. Returns the scene
 *  extras { position, classicMinutes, readiedSpellIndex } or null
 *  on a version mismatch (loud). */
export function restorePlayer(entity, snap, spellsByIndex = null) {
  if (!snap || snap.v !== SAVE_VERSION) {
    console.warn(`[save] version mismatch (got ${snap?.v}, want ${SAVE_VERSION}); refusing`);
    return null;
  }
  for (const k of ENTITY_FIELDS) entity[k] = snap[k];
  entity.stats = { ...snap.stats };
  // Pre-S15 saves carry no fatigue: default to rested (MaxFatigue =
  // (Str + End) x 64) - the additive-field shape DFU's serializer
  // gives missing members, so the envelope version holds at 1.
  if (entity.fatigue == null) entity.fatigue = ((snap.stats?.strength ?? 0) + (snap.stats?.endurance ?? 0)) * 64;
  entity.skills = Array.isArray(snap.skills) ? [...snap.skills] : snap.skills;   // AUDIT 17e: pre-chargen skills is a flat number
  entity.skillUses = [...snap.skillUses];
  entity.career = snap.career ? { ...snap.career } : entity.career;
  entity.items = snap.items.map((it) => ({ ...it }));
  // AUDIT 17f: a Currency stack saved before gold gained its template
  // index carries none, and stacksWith compares templateIndex - a
  // restored save would grow a SECOND gold stack the next time gold
  // was added, and goldAmount only ever finds the first. The
  // additive-field upgrade DFU's serializer gives missing members.
  for (const it of entity.items) {
    if (it.group === 'Currency' && it.templateIndex == null) Object.assign(it, goldStack(it.stackCount ?? 0));
  }
  // AUDIT 17e C1: the equip table + armor values are DERIVED state -
  // rebuild them from the freshly restored items (SerializablePlayer
  // .cs:301, :355-368). Must run AFTER items are replaced, or the
  // table relinks to the discarded objects.
  rebuildEquipState(entity);
  entity.activeEffects = snap.activeEffects.map(copyEffectEntry);
  // Missing on a pre-17h save: leave whatever the entity carries (a
  // fresh entity starts every group at zero, which is classic's own
  // starting state), the additive-field shape DFU's serializer gives.
  for (const k of REP_ARRAYS) if (snap[k]) entity[k] = [...snap[k]];
  if (snap.pendingFactionRep) entity.pendingFactionRep = snap.pendingFactionRep.map((r) => ({ ...r }));
  if (snap.backStory) entity.backStory = [...snap.backStory];
  entity.spells = spellsByIndex
    ? snap.spells.map((i) => spellsByIndex.get(i)).filter(Boolean)
    : [];
  return { position: snap.position, classicMinutes: snap.classicMinutes, readiedSpellIndex: snap.readiedSpellIndex, world: snap.world ?? null, locationKey: snap.locationKey ?? null };
}

/** localStorage backend (absent in headless - callers gate).
 *  setItem THROWS on real browsers - QuotaExceededError when storage
 *  is full, or a SecurityError under private-browsing modes that
 *  disable storage. An unguarded throw here propagates through the F9
 *  handler and kills the frame (the same unguarded-browser-API class
 *  as the bare requestPointerLock crash). Return false on failure so
 *  the caller reports "save failed" instead of crashing. */
export function writeQuicksave(snap, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(QUICKSAVE_KEY, JSON.stringify(snap));
    return true;
  } catch (err) {
    console.warn('[save] quicksave write failed:', err?.name ?? err);
    return false;
  }
}
export function readQuicksave(storage = globalThis.localStorage) {
  if (!storage) return null;
  const raw = storage.getItem(QUICKSAVE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { console.warn('[save] corrupt quicksave'); return null; }
}
