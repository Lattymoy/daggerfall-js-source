// THE HOST ENCHANT CONTEXT - one body, mounted by every host that can
// hold an enchanted item.
//
// systems/enchantments.js keeps ONE ctx per session
// (setDefaultEnchantCtx, the port-singleton idiom - DFU's arms read
// GameManager singletons the same way) and every payload folds it under
// any per-call ctx. FS1 recorded for several waves that the standalone
// ?dungeon host mounted NOTHING: setDefaultEnchantCtx had exactly one
// caller in the tree, scenes/world.js, so in that host CastWhenUsed's
// assign and its click-to-cast ready, the vampiric-drain and affinity
// scans and SoulBound's break release all optional-chained into
// silence - the AUDIT 24 seam shape exactly, a ported law that
// evaporates with a green suite.
//
// The flag also said the mount was "~90 lines of live plumbing and none
// of it is host-portable by copy". The first half was true and the
// second was not: what is host-specific is the POOLS and the WINDOWS,
// which are already parameters everywhere else in this tree. So the ctx
// body lives here and each host hands in its own doors - which is also
// the only way the two mounts can be held to the same law, since a
// copied mount diverges the first time an arm grows.
//
// What is deliberately NOT a parameter: the seams that are already
// singletons in the port (playerInSunlight/playerInHolyPlace, which
// route by LIVE mode; worldMinutes; the settings store). A host that
// passed those in would be re-answering a question the port answers
// once.
import { applySpell } from '../systems/effects.js';
import { playerInSunlight, playerInHolyPlace } from '../systems/passiveSpecials.js';   // V2c: the two E1 conditional flags
import { worldMinutes } from '../systems/worldTick.js';
import { getBool } from '../systems/settings.js';
import { seasonValue, SEASONS, dateFromClassicMinutes, lunarPhasesFromMinutes, LUNAR_PHASES } from '../systems/gameDate.js';
import { placeFoeFreely } from '../systems/quest/sceneMount.js';   // B1: CreateFoe's raycast ring
import { placeFoeEnv, entityOccupancy } from './questFoeHost.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';

/** The law REFUSES a spot DFU would have rejected - no floor under it,
 *  something already there, too close to the wall the ray found - and
 *  DFU's spawner simply tries again next frame. This retries the same
 *  way. The budget is the port's own call: DFU leaves a MonoBehaviour
 *  running for free, and a spawn that cannot find a spot in a sealed
 *  corridor must not spin here. */
export const LOOSE_FOE_PLACE_ATTEMPTS = 12;

/** SD1: stand a loose foe - SoulBound's break release, the Sanguine
 *  Rose's Daedroth - through DFU's OWN placement law.
 *
 *  Both arms used to drop the foe at the player's feet plus a fixed
 *  (+2, +1, 0): inside the player in a corridor, inside the wall
 *  against one. placeFoeFreely is the same law the quest foe arm
 *  stands its foes through - one home.
 *
 *  minDistance 4, not placeFoeFreely's own 5: CreateFoeSpawner's
 *  defaults (GameObjectHelper.cs:1314) are the spawner FIELDS both
 *  enchantment callers get, and PlaceFoeFreely is handed those rather
 *  than its own signature defaults.
 *
 *  `spawn(mobileType, pos, { yawRad, allied })` is the host's own pool
 *  door - the placement is shared, the pool never is. */
export function standLooseFoe({ collider, feet, yawRad, fovDegrees, foes, spawn },
  mobileType, { allied = false, lineOfSightCheck = true } = {}) {
  if (!feet || !collider || !spawn) return null;
  const env = placeFoeEnv({
    collider,
    // origin at the controller centre, as tryPlaceFoe has it - DFU
    // casts from PlayerObject.transform.position, not the feet
    playerFeet: [feet[0], feet[1] + 0.9, feet[2]],
    playerYawRad: yawRad,
    fovDegrees,
    isOccupied: entityOccupancy((f) => f.ai?.feet, () => foes, feet),
  });
  let spot = null;
  for (let i = 0; i < LOOSE_FOE_PLACE_ATTEMPTS && !spot; i++) {
    spot = placeFoeFreely(env, { minDistance: 4, maxDistance: 20, lineOfSightCheck });
  }
  if (!spot) return null;
  // FinalizeFoe (FoeSpawner.cs:210-226): a FLYING foe lifts 1.5 from
  // the test point; walkers land through the pool's own chain.
  const fly = (ENEMY_BASICS[mobileType]?.behaviour ?? 'General') === 'Flying';
  const pos = [spot.x, fly ? spot.y + 1.5 : spot.y, spot.z];
  const yaw = Math.atan2(feet[0] - spot.x, feet[2] - spot.z);   // LookAt player
  return Promise.resolve(spawn(mobileType, pos, { yawRad: yaw, allied })).catch(() => null);
}

/**
 * The ctx object setDefaultEnchantCtx takes. Every door a host must
 * answer is a parameter; everything a host cannot answer differently
 * (the calendar, the lunar phases, the settings flag, the sunlight and
 * holy-place seams) is resolved here.
 *
 * @param playerEntity      the one player
 * @param spellsByIndex     () => Map(record index -> SPELLS.STD record)
 * @param now               () => classic minutes (the payload clocks)
 * @param sinks             { hurt, heal } - the payload's own two doors
 * @param playerSpellSinks  the FULL player bundle, for a REFLECTED cast
 * @param say               (line) => the host's text channel
 * @param magic             the host's player-magic engine (M3)
 * @param foes              () => the live foe pool
 * @param foeSinks          (foe) => that foe's sinks
 * @param feet              () => the player's feet
 * @param standLooseFoe     (mobileType, { allied, lineOfSightCheck })
 * @param messageBox        (textId) => a TEXT.RSC popup
 * @param openCharacterSheet () => push the sheet
 * @param replaceFoe        (targetEntity, mobileType) => the Wabbajack
 * @param isResting         () => bool (CastWhenHeld's degrade rate)
 */
export function createEnchantCtx({
  playerEntity,
  spellsByIndex,
  now,
  sinks,
  playerSpellSinks = null,
  say = null,
  magic,
  foes = () => [],
  foeSinks = () => ({}),
  feet = () => [0, 0, 0],
  standLooseFoe: standFoe = null,
  messageBox = null,
  openCharacterSheet = null,
  replaceFoe = null,
  isResting = () => !!playerEntity?.isResting,
  rolls = Math.random,
} = {}) {
  return {
    spellsByIndex,
    now,
    sinks,
    // AUDIT 39: HealthLeech.cs:86-89 bills the WEARER on every strike
    // (8) and every use (16) of a WheneverUsed leech, not only on the
    // magic round - and worldTick's per-round ctx was the only mount
    // in the tree that carried hurtSelf, so the -4000-point drawback
    // cost the player nothing at the two doors that spend it.
    hurtSelf: (n) => { if (n > 0) sinks?.hurt?.(n); },
    say,
    // S40: CastWhenHeld.cs:135 - a held enchantment degrades at 60 per
    // round while the player is resting and 4 otherwise. The rest
    // window raises the flag on OPEN, so it is live the moment the
    // rest page is up.
    isResting,
    // V2c: the E1 conditional arms' two flags (RepairsObjects' sun
    // gate, the affinity/curse place gates). Both read seams the mode
    // machine registers, so they route by LIVE mode in every host.
    inSunlight: () => playerInSunlight(),
    inHolyPlace: () => playerInHolyPlace(),
    applySpellToSelf: (record) => magic.castByItemSelf(record),
    setReadySpell: (record) => magic.readySpell(record, { free: true }),
    applySpellToTarget: (record, attacker, target) => {
      // X11: the caster travels WITH ITS SINKS. Spell Reflection sends
      // the bundle back at whoever cast it, and a caster with no sinks
      // would have the reflected damage land nowhere - silently, which
      // is the worst way for it to be wrong.
      const af = attacker && attacker !== playerEntity
        ? foes().find((x) => x.entity === attacker) : null;
      const casterOf = () => {
        if (!attacker) return null;
        if (attacker === playerEntity) return { entity: playerEntity, sinks: playerSpellSinks ?? sinks };
        return af ? { entity: attacker, sinks: foeSinks(af) } : { entity: attacker };
      };
      if (target === playerEntity) { magic.applySpellToPlayer(record, attacker?.level ?? 1, casterOf()); return; }
      const f = foes().find((x) => !x.dead && x.entity === target);
      if (!f) return;
      const caster = casterOf();
      const r = applySpell(record, attacker?.level ?? 1, target, foeSinks(f), rolls, caster);
      // The same re-target hostMagic does for the cast paths - this
      // door is the enchantment path's equivalent seam.
      if (r.reflected && caster?.entity) {
        if (caster.entity === playerEntity) magic.applySpellToPlayer(record, attacker?.level ?? 1, caster, { reflectedCount: 1 });
        else applySpell(record, attacker?.level ?? 1, caster.entity, caster.sinks ?? {}, rolls, caster, { reflectedCount: 1 });
      }
    },
    nearbyFoes: (range) => {
      const pf = feet();
      return foes().filter((f) => !f.dead && f.ai
        && Math.hypot(f.ai.feet[0] - pf[0], f.ai.feet[1] - pf[1], f.ai.feet[2] - pf[2]) <= range)
        // V3: distance rides along - the Skull of Corruption clones
        // the NEAREST enemy; the field is additive, no reader broke
        .map((f) => ({
          mobileType: f.mobileType ?? f.entity?.mobileType ?? 128,
          distance: Math.hypot(f.ai.feet[0] - pf[0], f.ai.feet[1] - pf[1], f.ai.feet[2] - pf[2]),
          // MT-ii: the LIVE team - both summons filter their scan on
          // `Team != MobileTeams.PlayerAlly` before counting company
          // (SanguineRoseEffect.cs:47-48, SkullOfCorruptionEffect
          // .cs:47-48), so your own standing summons never count.
          team: f.entity?.team ?? 'PlayerEnemy',
          hurt: (n) => foeSinks(f).hurt?.(n),
        }));
    },
    // SD1: the two SPAWN arms - SoulBound's break release and the
    // Sanguine Rose's Daedroth. They differ exactly as DFU has them
    // differ: SoulBound passes lineOfSightCheck FALSE (SoulBound.cs:100
    // - a released soul may appear in front of you), the Sanguine Rose
    // takes the default TRUE and allied TRUE (SanguineRoseEffect.cs:56).
    spawnFoe: (mobileType) => { standFoe?.(mobileType, { lineOfSightCheck: false }); },
    spawnAlliedFoe: (mobileType) => { standFoe?.(mobileType, { allied: true }); },
    // V3: the artifact doors. messageBox is Azura's TEXT.RSC popup,
    // openCharacterSheet the Oghma's sheet push, replaceFoe the
    // Wabbajack's transform over the host's own pool.
    messageBox,
    openCharacterSheet,
    replaceFoe,
    // R1: the AllowMagicRepairs seam - RepairsObjects' enchanted-item
    // skip and the break-consumption arm both read it.
    get allowMagicRepairs() { return getBool('Controls', 'AllowMagicRepairs'); },
    // W1: the season seam - ExtraSpellPts' seasonal conditions compare
    // against its OWN param order (DuringWinter=0..DuringFall=3,
    // ExtraSpellPts.cs:184-189), not the calendar enum (Fall=0..
    // Winter=3) - the map is the two ends swapped.
    season: () => {
      const s = seasonValue(dateFromClassicMinutes(worldMinutes()));
      return s === SEASONS.Winter ? 0 : s === SEASONS.Fall ? 3 : s;
    },
    // V2c: the moon arms, off V2a's lunar law. ExtraSpellPts'
    // IsFullMoon/IsHalfMoon/IsNewMoon (:133-154) each answer true when
    // EITHER moon shows the phase; half counts both the waxing and
    // waning half. Params 4/5/6 = Full/Half/New (:190-192).
    moonPhase: (param) => {
      const { masser, secunda } = lunarPhasesFromMinutes(worldMinutes());
      const either = (...phases) => phases.includes(masser) || phases.includes(secunda);
      if (param === 4) return either(LUNAR_PHASES.Full);
      if (param === 5) return either(LUNAR_PHASES.HalfWax, LUNAR_PHASES.HalfWane);
      if (param === 6) return either(LUNAR_PHASES.New);
      return false;
    },
  };
}
