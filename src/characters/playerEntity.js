// The shared player entity (E3a/E3b; chargen S3 mutates it in
// place). These initial values are the PRE-CHARGEN state only:
// createCharacter (systems/chargen) rolls the real career the first
// time a chargen-running context boots, and every host runs it
// through systems/chargenSession.js - dungeonContext.js:2276,
// world.js:4011, exterior.js:1391 and applyHeadlessChargen for the
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
import { SOCIAL_GROUP_COUNT } from '../formats/factionFile.js';   // AUDIT 65 SL-4: PlayerEntity.cs:128's socialGroupCount = 11

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
  fatigue: 3200,    // (Str 50 + End 0) x 64 over the stand-in stats above - maxFatigue's own arithmetic (statMods.js:169), no dropped term; applyCharacter re-derives it from the rolled stats (S15)
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
  // AUDIT 65 SL-4, the same seam a third time: PlayerEntity.cs:129's
  // `int[] reactionMods = new int[socialGroupCount]` is a FIELD
  // INITIALIZER, and PlayerEntity.Reset() (:794-819) does not clear
  // it - DFU's live array exists from construction and nothing ever
  // serializes it ("do not serialize, set by live effects"). While
  // the envelope carried the member, the restore minted it; SL-4
  // took the member back out, so the ABSENT state became reachable
  // after a boot load or a classic import and the eleven-wide
  // guarantee AUDIT 63 F6 bought had to come from the constructor
  // instead. The three `??=` mints downstream (enchantments.js:680
  // and :825, artifactEffects.js:151) and talk.js's
  // ensureReactionState stay as the belt to this brace.
  reactionMods: new Array(SOCIAL_GROUP_COUNT).fill(0),

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

/**
 * ARREST-SHIELD (2026-09-22, Revverie: "when guards come to arrest you
 * and you go to trial, you still can die which happened to me (idk if
 * a guard continue to aggro me or if it was a bandit of sorts) ... the
 * game crashed when that happened ... just froze and I had to kill
 * it"): THE ONE DAMAGE DOOR TAKES A VETO.
 *
 * The arrest flow already withheld a GUARD's blow while a trial is up
 * online (scenes/arrestFlow.js onGuardHit), and its own note says why:
 * "the player can still be standing in the street". Online the court
 * sequence cannot pause the world - WORLD5 makes the clock the
 * room's - so the boxes are read standing in the open. But the guard
 * arm is the only arm there was, and a town's foes hunt every player
 * in the cell (WORLD6b-ii). A bandit's blow, a spell, a fall, drowning:
 * none of them was a guard, so none of them was withheld, and dying
 * inside the court sequence is a death screen fighting a modal trial
 * for the same window. That is the freeze.
 *
 * The veto sits in FRONT of the shield pool and in front of the
 * bypassShield door both, because "you are in a trial" outranks even
 * DFU's SetHealth(0) collapses - drowning during your own sentencing
 * is exactly as wrong as the bandit was. It is a READ: it withholds a
 * blow, it never queues one, which is the law onGuardHit already
 * states ("every guard swing that landed WHILE the box was up is
 * simply never delivered, not queued for later").
 *
 * One veto, registered by the flow that owns the question - a second
 * copy of "am I in a trial" is a second chance to disagree with the
 * first.
 */
let _damageVeto = null;
export function registerPlayerDamageVeto(fn) { _damageVeto = typeof fn === 'function' ? fn : null; }
/** For a caller that needs to know a blow would be withheld before it
 *  spends anything on delivering one. */
export const playerDamageWithheld = () => { try { return !!_damageVeto?.(); } catch { return false; } };

/** DUEL1: THE DUEL'S WORD THAT ITS PLAYER FELL, registered by the host that runs the duel (scenes/world.js - the duel
 *  law's `fell`) and reached through `duelSpare`, the `spare` every duel-sourced blow passes (the opponent's strike, the
 *  instant half of their spell, and its damage over time off the one ticker every host shares). One registration, as
 *  the damage veto's: a second copy of "am I in a duel" is a second chance to disagree. */
let _duelFell = null;
export function registerDuelFell(fn) { _duelFell = typeof fn === 'function' ? fn : null; }
export const duelSpare = (entity) => { _duelFell?.(entity); };

// ── SET2: THE PORT'S OWN SAY OVER A BLOW ON THE PLAYER ──────────────
// Sigil sets (bible/11-Multiplayer/Sigil-Sets.md) have three things to say about damage the player takes, and this is
// the ONE door every source comes through (a foe's blow, a spell, a fall, a poison's round), so they are said here, each
// a named registry like the entity folds' (a name re-registered replaces, `null` removes):
//   - a DAMAGE MODIFIER: `fn(entity, dmg) -> dmg`, over the damage before the shield pool (Malacath's Unbroken halves);
//   - a DEATH SAVE: `fn(entity, dmg) -> boolean`, asked when the damage would take a live player to zero - one that
//     answers true leaves them at 1 instead, before the guild's avoid-death is asked (Malacath's Unbroken itself);
//   - a HURT LISTENER: `fn(entity, { dmg, before, after })`, told after the damage lands (Ruhn's Wrath of the Warden).
// NONE of them is asked on a SetHealth(0) door (`bypassShield`: drowning and the exhaustion collapse mean death, not
// damage) or on a duel's own blow (`spare`: the duel's floor is its law), and a veto or a shield that takes the whole
// blow leaves them all untold.
const _damageMods = new Map();
const _deathSaves = new Map();
const _hurtListeners = new Map();
const namedRegistry = (map) => (name, fn) => { if (typeof fn === 'function') map.set(name, fn); else map.delete(name); };
export const registerPlayerDamageMod = namedRegistry(_damageMods);
export const registerPlayerDeathSave = namedRegistry(_deathSaves);
export const registerPlayerHurtListener = namedRegistry(_hurtListeners);
// AUDIT FINAL F10: THE DOOR OPENS - a DOOR-OPEN LISTENER, `fn(entity)`, told FIRST on every call, before the veto (a
// SetHealth(0) door and a duel's too): each call is one hurt's word, so a foe's blow its door never landed - the veto, a
// halving to nothing, a Shield that took it whole, or a party's weighing that called no door at all
// (playerBlowCameToNothing) - leaves no mark for the next hurt, a spell's or a fall's, to be read as that blow.
const _doorOpen = new Map();
export const registerPlayerDoorOpen = namedRegistry(_doorOpen);
function tellDoorOpen(entity) {
  for (const fn of _doorOpen.values()) { try { fn(entity); } catch { /* a set is not the blow's problem */ } }
}
/** A foe's blow at me came to nothing before any door was called (a shared foe's, weighed to nothing for the party
 *  beside me - partyScale.js partyFoeHits): the door's word on it all the same. */
export function playerBlowCameToNothing(entity) { tellDoorOpen(entity); }
/** The damage through every registered modifier, in registration order - a modifier that throws is skipped. */
export function playerDamageMods(entity, dmg) {
  let d = dmg;
  for (const fn of _damageMods.values()) {
    try { const n = fn(entity, d); if (Number.isFinite(n)) d = Math.max(0, n); } catch { /* a set is not the blow's problem */ }
  }
  return d;
}
/** Does any registered death save take this blow? The first that answers true, in registration order. */
function playerDeathSaved(entity, dmg) {
  for (const fn of _deathSaves.values()) { try { if (fn(entity, dmg) === true) return true; } catch { /* as above */ } }
  return false;
}
function tellHurt(entity, dmg, before, after) {
  for (const fn of _hurtListeners.values()) { try { fn(entity, { dmg, before, after }); } catch { /* as above */ } }
}

/**
 * DUEL1: `spare` - A DUEL'S BLOW NEVER KILLS. Mac: "Loser drops to 1HP". A blow that would take a live player to zero
 * leaves them at ONE instead, and `spare(entity)` is told (the duel's law: the side that falls says so and has lost);
 * the avoid-death hook and the death presenter are never reached, because nobody died. Only the duel's own doors pass
 * it (a strike resolved from the opponent, the opponent's spell and its damage over time); anything else - a wolf in
 * the ring - kills as it always has.
 */
export function hurtPlayer(entity, dmg, { bypassShield = false, spare = null } = {}) {
  tellDoorOpen(entity);   // AUDIT FINAL F10: first - whatever the door says below, this call is its word
  if (playerDamageWithheld()) return false;   // ARREST-SHIELD: before the shield pool AND before the SetHealth(0) door
  if (!(dmg > 0)) return false;
  const portSays = !bypassShield && !spare;   // SET2: never on a SetHealth(0) door, never on a duel's blow
  if (portSays) {
    dmg = playerDamageMods(entity, dmg);
    if (!(dmg > 0)) return false;
  }
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
  if (spare && wasAlive && entity.health - dmg < 1) {
    entity.health = 1;
    surfacePlayer();
    try { spare(entity); } catch { /* the duel's word is not the blow's problem */ }
    return false;
  }
  // SET2: THE DEATH SAVE - damage that would take a live player to zero is asked of the registered saves first; one
  // that takes it leaves them at 1, and the blow is told as what it did (the health it took, down to 1).
  if (portSays && wasAlive && entity.health - dmg < 1 && playerDeathSaved(entity, dmg)) {
    const was = entity.health;
    entity.health = 1;
    surfacePlayer();
    tellHurt(entity, was - 1, was, 1);
    return false;
  }
  const before = entity.health;
  entity.health = Math.max(0, entity.health - dmg);
  surfacePlayer();
  if (portSays) tellHurt(entity, dmg, before, entity.health);
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
