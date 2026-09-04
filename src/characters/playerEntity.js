// The shared player entity (E3a/E3b; chargen S3 mutates it in
// place). These initial values are the PRE-CHARGEN state only:
// createCharacter (systems/chargen) rolls the real career the first
// time a chargen-running context boots, and every host runs it
// through systems/chargenSession.js - dungeonContext.js:1664,
// world.js:1340, exterior.js:981 and applyHeadlessChargen for the
// test room (AUDIT 23).
//
// NOT A GAP (recorded): the stand-ins below - flat skills 30,
// maxHealth 50, the fatigue they imply - are DFU's own pre-chargen
// shape rather than pending work. CharacterDocument.cs:70-90
// SetDefaultValues (its own comment: some default values for testing
// during development) hands a Breton/male/Mage entity the same
// all-100 armorValues table, and SetupPlayerFromCharacterDocument
// replaces the lot. Matching the NUMBERS would mean reading Mage's
// CLASS00.CFG off the Arena2 path (DaggerfallEntity.cs:907-915
// GetClassCareerTemplate), which a module-level literal cannot await
// - and nothing reads these once chargen resolves. armor 0 until
// player equipment. LiveSpeed lives in PlayerMotor stats.
import { SKILL_COUNT, SKILLS_RECENTLY_RAISED_WORDS } from '../systems/skills.js';

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
  maxHealth: 50,    // the header's stand-in; chargen rolls career HP
  health: 50,
  armor: 0,      // legacy scalar fallback (armorValues wins in the to-hit)
  // U8h: the 7-part armor table (CharacterDocument: 100 each = no
  // armor; equip subtracts material*5 - the classic law makes an
  // UNARMORED player far easier to hit than the old armor:0 scalar)
  armorValues: [100, 100, 100, 100, 100, 100, 100],
  skills: 30,       // the header's stand-in, and a HANDLED shape: permanentSkillValue (skills.js:72) returns a numeric `skills` whole, so no reader ever indexes it
  stats: { strength: 50, agility: 50, luck: 50 },
  fatigue: 3200,    // (Str 50 + End 0) x 64 over the stand-in stats above - maxFatigue's own arithmetic (statMods.js:130), no dropped term; applyCharacter re-derives it from the rolled stats (S15)
  items: [],        // the inventory (S2); gold rides as a Currency stack
  // THE ONE CONSTRUCTION SEAM, sixth occurrence (U24). DFU's
  // PlayerEntity is constructed WITH its skill-use counters, and
  // TallySkill writes them unconditionally; this literal had none, so
  // `if (!entity.skillUses) return` silently swallowed EVERY tally on
  // a pre-chargen entity - guild training took the gold and taught
  // nothing, and raiseSkills had nothing to read. Found by the U24
  // live probe.
  skillUses: new Array(SKILL_COUNT).fill(0),
  // A4, the same seam once more: DFU's PlayerEntity is constructed
  // with `new uint[2]` here too (PlayerEntity.cs:76) and both
  // accessors INDEX into it - Get reads a word, Set ORs into one - so
  // the field can never legitimately be absent (PlayerEntity.cs:70).
  // PlayerEntity.skillsRecentlyRaised (:70) - the uint[2] the char
  // sheet highlights from. Constructed here for the same reason
  // skillUses is: DFU's entity is built WITH it, and the save lane
  // reads the field by this name.
  skillsRecentlyRaised: new Array(SKILLS_RECENTLY_RAISED_WORDS).fill(0),

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

// AUDIT 26 F117: GuildManager.AvoidDeath, consulted by SetHealth at
// the zero crossing (PlayerEntity.cs:1205-1211). The hook is the
// host's - it closes over the live submersion state Temple.AvoidDeath
// reads globally, rolls the rank-in-fifty, and speaks the HUD line
// (DFU shows it from INSIDE Temple.AvoidDeath, the consulted side).
// Answering true cancels the death; the 10% restore below is
// SetHealth's own consequence and stays on the door.
let _avoidDeathHook = null;

/** Register the live host's avoid-death consult. Same idiom as the
 *  presenter above: returns the previous hook. */
export function setAvoidDeathHook(fn) {
  const prev = _avoidDeathHook;
  _avoidDeathHook = fn ?? null;
  return prev;
}

/** THE damage door. Every path that can take player health goes through here.
 *  Returns true when this blow killed. */
/** X1: consume `dmg` from any live Shield pool and answer what is
 *  left. Emptying the pool ENDS the effect at once (ResignAsIncumbent
 *  + RoundsRemaining = 0), and exactly zeroing it still busts it. */
export function damageShieldPool(entity, dmg) {
  for (const a of entity?.activeEffects ?? []) {
    if (a.kind !== 'shield' || a.ended) continue;
    if (!(a.shieldRemaining > 0)) continue;   // a busted pool absorbs nothing
    a.shieldRemaining -= dmg;
    if (a.shieldRemaining <= 0) {
      const overflow = Math.abs(a.shieldRemaining);
      a.shieldRemaining = 0;
      a.ended = true;
      a.roundsRemaining = 0;
      return overflow;   // only the excess gets through
    }
    return 0;            // fully absorbed
  }
  return dmg;
}

export function hurtPlayer(entity, dmg, { bypassShield = false } = {}) {
  if (!(dmg > 0)) return false;
  // X1: THE SHIELD POOL (Shield.cs DamageShield :78-98) sits in front
  // of the health subtraction, on the ONE door every damage source
  // already comes through. All-or-overflow per hit: a hit no larger
  // than the pool is reduced to ZERO, and the hit that empties it
  // passes only its excess. Returns the damage that survives.
  //
  // REVIEW FIX - bypassShield is the SetHealth(0) door. DFU's
  // drowning and lethal-exhaustion collapse SET health to zero rather
  // than dealing damage, so no shield stands between the player and
  // them; routing them through this one door (which the port does, so
  // the death presenter fires once) meant a Shield made drowning
  // survivable. The callers that mean "kill, do not damage" say so.
  if (!bypassShield) {
    dmg = damageShieldPool(entity, dmg);
    if (!(dmg > 0)) return false;
  }
  const wasAlive = (entity.health ?? 0) > 0;
  entity.health = Math.max(0, entity.health - dmg);
  surfacePlayer();
  // The TRANSITION, not the state. Firing on every call that finds health at
  // zero means an effect still ticking after the killing round re-presents the
  // screen once per round - the dungeon's version hid that behind an
  // `instanceof DeathScreen` guard in its presenter, which made the guard
  // load-bearing and every future presenter's problem.
  if (wasAlive && entity.health === 0) {
    // F117: `(int)(MaxHealth * 0.1f)` - SetHealth restores a tenth
    // instead of raising OnDeath when a guild answers AvoidDeath.
    // Consulted on the TRANSITION only, like the presenter: once dead,
    // further damage cannot resurrect the question.
    if (_avoidDeathHook?.(entity)) {
      entity.health = Math.trunc((entity.maxHealth ?? 0) * 0.1);
      surfacePlayer();
      return false;
    }
    _deathPresenter?.(entity);
    return true;
  }
  return false;
}
