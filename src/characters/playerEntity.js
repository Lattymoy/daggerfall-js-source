// The shared player entity (E3a/E3b; chargen S3 mutates it in
// place). These initial values are the PRE-CHARGEN state only:
// createCharacter (systems/chargen) rolls the real career the first
// time a chargen-running context boots (dungeons today; the chargen
// UI later fronts it everywhere). INTERIM until then, loudly: flat
// skills 30 and maxHealth 50. armor 0 until player equipment.
// LiveSpeed lives in PlayerMotor stats.
import { SKILL_COUNT } from '../systems/skills.js';

export const playerEntity = {
  isPlayer: true,
  // S3c/U9: the identity chargen writes; the paperdoll and the race
  // art tables read it. Breton/male/0 until chargen runs.
  race: 'Breton',
  raceId: 1,
  faceIndex: 0,
  gender: 'male',
  level: 1,
  reflexes: 2,      // 0 VeryHigh .. 4 VeryLow; 2 = Average (classic default)
  maxHealth: 50,    // INTERIM until chargen rolls career HP
  health: 50,
  armor: 0,      // legacy scalar fallback (armorValues wins in the to-hit)
  // U8h: the 7-part armor table (CharacterDocument: 100 each = no
  // armor; equip subtracts material*5 - the classic law makes an
  // UNARMORED player far easier to hit than the old armor:0 scalar)
  armorValues: [100, 100, 100, 100, 100, 100, 100],
  skills: 30,       // INTERIM flat skills until chargen
  stats: { strength: 50, agility: 50, luck: 50 },
  fatigue: 3200,    // (Str 50 + End 0) x 64 pre-chargen (INTERIM stats above); applyCharacter re-derives from the rolled stats (S15)
  items: [],        // the inventory (S2); gold rides as a Currency stack
  // THE ONE CONSTRUCTION SEAM, sixth occurrence (U24). DFU's
  // PlayerEntity is constructed WITH its skill-use counters, and
  // TallySkill writes them unconditionally; this literal had none, so
  // `if (!entity.skillUses) return` silently swallowed EVERY tally on
  // a pre-chargen entity - guild training took the gold and taught
  // nothing, and raiseSkills had nothing to read. Found by the U24
  // live probe.
  skillUses: new Array(SKILL_COUNT).fill(0),
};

/** Debug/probe surface: one place writes window.__player (audit
 *  2026-07-06b collapsed seven scattered assignments). */
export function surfacePlayer() {
  if (typeof window !== 'undefined') window.__playerEntity = playerEntity;
}

// ── AUDIT 21 (hosts lane, F6): THE ONE DAMAGE DOOR ───────────────────
//
// DYING OUTSIDE A DUNGEON DID NOTHING AT ALL. A city guard beat you to 0 HP
// in the street and the game carried on - you kept walking, kept swinging,
// and the guards kept hitting a corpse. Same for a fatal fall outdoors or in
// a building, and same for disease and poison damage off the ticker.
//
// The dungeon had ONE damage door that minted the death screen
// (dungeonContext's hurtPlayer). Every other path wrote `entity.health =
// Math.max(0, ...)` inline and checked nothing: guard damage in world.js and
// exterior.js, fall damage in shared.js's applyFallLanding, and the ticker's
// own `hurt` sink. Four writers, one of which remembered.
//
// So the check moves to where the write happens, and the PRESENTER is
// registered by whichever host is live - the same shape AUDIT 21 F2 gave the
// world clock, and for the same reason: there is one player, so there is one
// death. A host that mounts registers; nothing else has to remember anything.
let _deathPresenter = null;

/** Register the live host's death presenter. Returns the previous one, so a
 *  host that mounts another (worldModes mounting a dungeon) can restore it. */
export function setDeathPresenter(fn) {
  const prev = _deathPresenter;
  _deathPresenter = fn ?? null;
  return prev;
}

/** THE damage door. Every path that can take player health goes through here.
 *  Returns true when this blow killed. */
export function hurtPlayer(entity, dmg) {
  if (!(dmg > 0)) return false;
  const wasAlive = (entity.health ?? 0) > 0;
  entity.health = Math.max(0, entity.health - dmg);
  surfacePlayer();
  // The TRANSITION, not the state. Firing on every call that finds health at
  // zero means an effect still ticking after the killing round re-presents the
  // screen once per round - the dungeon's version hid that behind an
  // `instanceof DeathScreen` guard in its presenter, which made the guard
  // load-bearing and every future presenter's problem.
  if (wasAlive && entity.health === 0) {
    _deathPresenter?.(entity);
    return true;
  }
  return false;
}
