// Save/load (Systems S11). DFU's own save system is a JSON
// serialization of live state (SerializablePlayer et al.) - the
// faithful port shape. This slice: THE PLAYER snapshot - entity
// (stats, skills, uses, health/magicka, level sums, career by
// index + data), items, known spells (by SPELLS.STD index),
// active effects, the classic clock, and position. WORLD state
// (foes, loot piles, action states, doors) is FLAGGED - dungeons
// re-derive from their location on load; the world snapshot pends
// its slice. Versioned envelope; a mismatch refuses loudly.

export const SAVE_VERSION = 1;
export const QUICKSAVE_KEY = 'dagger.quicksave';

const ENTITY_FIELDS = [
  'name', 'gender', 'careerIndex', 'level', 'reflexes',
  'health', 'maxHealth', 'magicka', 'maxMagicka',
  'startingLevelUpSkillSum', 'currentLevelUpSkillSum',
  'readyToLevelUp', 'pendingLevel', 'chargenDone',
];

/** A plain-object snapshot of the player + scene extras. */
export function snapshotPlayer(entity, { position = null, classicMinutes = 0, readiedSpellIndex = null, world = null, locationKey = null } = {}) {
  const snap = { v: SAVE_VERSION, position, classicMinutes, readiedSpellIndex, world, locationKey };
  for (const k of ENTITY_FIELDS) snap[k] = entity[k];
  snap.stats = { ...entity.stats };
  snap.skills = [...(entity.skills ?? [])];
  snap.skillUses = [...(entity.skillUses ?? [])];
  snap.career = entity.career ? { ...entity.career } : null;   // plain CFG data
  snap.items = (entity.items ?? []).map((it) => ({ ...it }));
  snap.spells = (entity.spells ?? []).map((sp) => sp.index);   // resolve against SPELLS.STD on load
  snap.activeEffects = (entity.activeEffects ?? []).map((a) => ({ ...a, effect: { ...a.effect } }));
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
  entity.skills = [...snap.skills];
  entity.skillUses = [...snap.skillUses];
  entity.career = snap.career ? { ...snap.career } : entity.career;
  entity.items = snap.items.map((it) => ({ ...it }));
  entity.activeEffects = snap.activeEffects.map((a) => ({ ...a, effect: { ...a.effect } }));
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
