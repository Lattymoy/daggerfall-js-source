// EXTERIOR ENCOUNTER FOES (X-slice). The mount S32's above-ground
// spawn arms needed: a host-owned pool of REAL foes above ground -
// the same shared pieces the dungeon and the city watch already run
// (EnemyAI senses/pursuit vs the exterior collider, the EnemyAttack
// cadence with the C-slice archer band, MobileUnit classic sprites,
// makeEnemyEntity/equipEnemy/loot, CalculateAttackDamage both ways,
// corpses) - minus the guard-specific crime machinery. cityGuards
// stays the WATCH's home; this pool is everything else the tables
// can mint (monsters 0-42 and class enemies 128+).
//
// RESIDUE (the S32 row): exterior enemy ARCHERY and CASTING pend
// their missile seams - encounter foes fight melee (rangedAttack
// stays false so the C-slice fallback makes them close), and the
// 13 fixed-list casters do not cast up here yet.

import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { markFoeStruck } from '../ui/hudFoeTarget.js';   // PX30
import { damageShieldPool } from '../characters/playerEntity.js';   // AUDIT 58: DecreaseHealth's shield hook is the BASE class's (DaggerfallEntity.cs:313-328)
import { lycanthropeAttackVoice } from '../systems/lycanthropy.js';   // V4: the beast's attack voice
import { copyEffectEntry } from '../systems/save.js';   // AUDIT 26 F216: the caster-stripping effect copy, one home
import { EnemyAI, isBackFacing, withinYaw } from '../characters/enemyMotor.js';
import { runTargetMachine, isPlayerTarget, isLocalPlayerTarget, isPeerTarget, resetAllyTeamOnPlayerAttack, PLAYER_TARGET, targetAimPoint, enemyArrowOrigin, enemyTransformPoint, arrowAimDirection } from '../characters/enemyTargets.js';   // WORLD6b-ii: the local player told from a peer, the peer told from a foe   // MT-ii   // ROAD-H H1/H1b: the ONE arrow loose point and the crouch dip
import { FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE, CAPSULE_HEIGHT } from '../player/motor.js';   // CH3: the shared fall formula
import { SOUND, hitSoundFor, ENEMY_HIT_VOLUME } from '../systems/soundClips.js';   // CH3: the FallDamage clip; WORLD6b: a peer's blow rung at the owner
import { EnemyCaster, castEnemySpell, hasMagickaToCast } from '../characters/enemyCasting.js';   // X3: the shared decision + the ONE cast executor
import { assignEnemySpells, SPELL_CAST_SOUND } from '../systems/enemySpells.js';   // X3
import { applySpell, maxFatigue, entityIsParalyzed, applyEnemyMotorEffectFlags, concealmentFlags } from '../systems/effects.js';   // X3: self-casts land through the effect spine   // A5: the enemy Levitate arm, the foe-target concealment closure + EntityConcealmentBehaviour's visual
import { calculateCastCost } from '../systems/spellcost.js';   // X3: costs priced off the player (magic-15 note)
import { silenceBlocksCast, attemptSoulTrap, SOUL_TRAP_TEXT, fillEmptyTrap } from '../systems/mysticism.js';   // X3: the enemy silence gate; X5: the soul trap's kill intercept
import { isAzurasStarEquipped } from '../systems/artifactEffects.js';   // V3: the Star's kill capture
import { EnemyAttack } from '../characters/enemyAttack.js';
import { makeEnemyEntity, loadMonsterCareer } from '../characters/enemyEntity.js';
import { MobileUnit, MOBILE_DAEDRA_SEDUCER, SeducerTransformBehaviour } from '../characters/mobileUnit.js';   // A5: the Seducer transform pair + its trigger
import { ClassFile } from '../formats/classFile.js';
import { equipEnemy, hasBowAttack, backstabChanceOf, zeroDamageHitSound, enemyMissSound, enemyAttackVoice, enemyPainVoice, playerAttackGrunt, tickEnemySound, playEnemyClip, tryLanguagePacification, applyDamageToNonPlayer } from './hostCombat.js';   // C2-slice (combat-9/17); MT-ii: the foe-vs-foe payload
import { generateItems as generateLootItems, addEnemyLootExtras } from '../systems/loot.js';   // AUDIT 24 (wave 43)
import { calculateAttackDamage, meleeHitConnects, MELEE_HIT_YAW_DEG, chooseEnemyWeapon, dropWeaponIfTargetImmune, enemyWeightClassicUnits, weaponKnockbackSpeed, weaponKnockbackApplies, enemyLanguageSkill, calculateEnemyPacification } from '../combat/formulas.js';   // AUDIT 24 (wave 42): pacification
import { tallySkill, SKILLS } from '../systems/skills.js';
import { liveStat } from '../systems/statMods.js';
import { billboardSize, mobileBillboardSize } from '../world/rmbFlats.js';
import { enemyControllerHeight, idleSpriteHeight, spriteOriginY } from '../characters/enemyAnchor.js';   // INCIDENT 2026-09-04 (ceiling bats)
import { rand } from '../formats/dfRandom.js';
import { setEnemyAlert } from '../systems/encounters.js';
import { inflictPoison } from '../systems/poisons.js';
import { onMonsterHit, SPIDER_TOUCH_SPELL_INDEX } from '../systems/diseases.js';   // AUDIT 24 (wave 30): the monster special-attack rider, above ground
import { MINUTES_PER_DAY } from '../systems/worldTick.js';
import { validFoeRecord, CELL_PUPPETS_MAX, POSE_BOUND, POSE_Y_BOUND, tokenGate } from '../net/wire.js';
import { createWeapon } from '../combat/enemyEquipment.js';   // AUDIT WORLD6b-ii B2: a puppet's weapon is its owner's word, rebuilt from the descriptor   // AUDIT WORLD6b B3/C2: a cell's record projected and its puppets capped, the wire's law
import { mintCorpseMarker, playBodyFall, corpseLootTargets, takeCorpseLoot, sayEnemyDied, raiseEnemyDeath } from './corpseMarker.js';
import { bloodCentre } from './hitEffects.js';   // AUDIT 24 (wave 39): EnemyBlood.ShowBloodSplash
import { addItem } from '../systems/inventory.js';   // AR1: BowDamage's recoverable arrow, in the TARGET's items
import { EnemySoundSource, acuteHearingMultiplier } from '../characters/enemySounds.js';   // AUDIT 24 (wave 41): EnemySounds.cs, one home
import { flashPlayerDamage } from '../ui/damageFlash.js';   // AUDIT 24 (wave 39): ShowPlayerDamage   // AUDIT 24 (wave 38): EnemyDeath's one home
import { bindQuestFoeHost } from './questFoeHost.js';   // B1: quest foes ride this pool
import { combatVisualsOn, foeDraw, markConcealedHit } from '../systems/combatVisuals.js';   // ECV1: what the enhanced skin draws for a concealed foe

// The port's allocation-owner guards (classic self-limits through the
// 144-minute cadence; these keep a long session bounded).
export const MAX_ACTIVE_ENCOUNTER_FOES = 8;
// WORLD6b: the puppet's ease (the stream's interval), its snap distance and its stillness, WORLD2's own numbers
const PUPPET_EASE_S = 0.2;
const PUPPET_SNAP = 3;
const PUPPET_STILL = 0.02;
const GENDER_BIT = ['male', 'female'];
// AUDIT WORLD6b-ii B1/C1: A PUPPET'S BLOW AT ME IS BOUNDED. A cell has no host seat: every peer streams, and a hostile
// one can stream eight Daedra at my feet, facing me, naming me, striking every frame. Per puppet the mobile's own
// attack state already bounds a streamed strike to one blow per attack animation (a strike edge mid-swing is
// ignored, MobileUnit.update); per OWNER the blows are budgeted - PUPPET_BLOWS_PER_S a second, the honest maximum
// of a full pool of foes at their fastest cadence - and a puppet that LEAPT (moved faster than PUPPET_LEAP times its
// species' own speed since its last record) lands nothing until it has walked: an honest foe cannot teleport to me.
const PUPPET_BLOWS_PER_S = 6;
const PUPPET_LEAP = 3;
const PUPPET_LEAP_SLACK = 2;   // the stream's x bit, decoded (no roll - the owner's word; WORLD3's spelling)
export const ENCOUNTER_CULL_DISTANCE = 120;

export function createExteriorFoes({ renderer, collider, fetchBytes, getTexture, uploadRecordFrame,
  playerEntity, audio, onPlayerHurt, currentMinute, say = null, rolls = Math.random,
  playerSinks = null,   // AUDIT 24 (wave 30): the player's damage/drain doors - the nymph and lamia riders need drainFatigue
  onArrow = null,   // X2-slice: the host's arrow seam - (from, dir, foe) at the shoot frame
  spellsByIndex = null,   // X3-slice: () => the SPELLS.STD map (null until loaded) - casters need it
  hitEffects = null,   // AUDIT 24 (wave 39): the host's one blood/effect pool
  playerWeaponSheathed = () => false,   // AUDIT 24 (wave 42): CalculateEnemyPacification's -25 / +10 arm
  // GameObjectHelper.CreateEnemyCorpseMarker (:836-839): a corpse
  // dropped OUTSIDE is handed to StreamingWorld.TrackLooseObject,
  // which stamps it with the streamer's CURRENT map pixel (:462-476)
  // so CollectLooseObjects can find it again. A host with no streamed
  // pixels (exterior.js stands in one location that never leaves
  // range) passes nothing and its corpses are never collected, which
  // is what DFU does with a pixel that stays in range.
  currentPixelKey = () => null,
  // ROAD-B: GameManager.MakeEnemiesHostile over the HOST's whole
  // area, not this pool alone - DaggerfallEntityBehaviour.cs:255-258
  // fires it when a NON-hostile foe is struck, and DFU's
  // ActiveGameObjectDatabase is one database for the scene. A host
  // that owns several pools (the watch and the encounters share a
  // street) hands in the union; absent, striking a passive foe turns
  // only that foe, which is the pre-wiring shape.
  makeAreaHostile = null,
  // AUDIT 62 F22: EnemySenses.cs:267 reads PlayerEnterExit.IsPlayerInside
  // - the GENERIC inside flag (PlayerEnterExit.cs:111-113), true in a
  // BUILDING interior as well as a dungeon - and :269-286 takes the flat
  // exterior band (classicSpawnDespawnExterior, 102.4m, no Y term) only
  // when it is false. This pool is mounted over a building interior by
  // worldModes.makeInteriorFoes, where the literal `false` put every
  // interior foe on the outdoor band: a foe two storeys up was "spawned
  // in classic" where DFU's row-0 band (XZ 25.6m, Y +3.2m) denies it.
  // The default keeps the street pools (world.js, exterior.js) unchanged.
  playerInside = false,
  // AUDIT 63 F42 (review round): EnemyMotor.ObstacleCheck's
  // `GetComponent<DaggerfallActionDoor>()` arm (EnemyMotor.cs:1158-1171).
  // The arm is not dungeon-scoped in DFU and neither is its host here:
  // DaggerfallInterior.AddActionDoors builds every building swing door
  // off Option_InteriorDoorPrefab and takes the component straight off
  // it (Internal/DaggerfallInterior.cs:1277-1281), so a BUILDING
  // INTERIOR is full of action doors. worldModes.makeInteriorFoes
  // mounts this pool over exactly that collider and had no dep to give,
  // so every closed interior door stayed `obstacleDetected` and the foe
  // detoured around it instead of walking at it, never recording the
  // door. The STREET mounts (world.js, exterior.js) pass nothing and
  // keep the `() => false` fallback, which is correct there.
  isActionDoor = null,
  magicHooks = null }) {  // X3-slice: { explodeAt, fireMissile } - the host's spell release seams
  const foes = [];        // { mobile, ai, attack, entity, batch, tex, archive, mobileType, dead, _encounter: true }
  const corpseBatches = [];
  // AUDIT 39 / THE FOUR HOSTS RULE: an IN-FLIGHT spawn's feet. spawnFoe
  // crosses two real awaits (the career file, a cold texture archive)
  // before its record joins `foes`, and offsetAll can only shift what
  // the pool already holds - so a recenter inside that window left the
  // new foe a map pixel (819.2) from the encounter. The position rides
  // here until the record exists; `feet` is repointed at the AI's own
  // array as soon as there is one, because EnemyAI COPIES the position
  // it is handed.
  const spawning = [];    // { feet }
  // AUDIT-39r: THE SWEEP'S EPOCH. clearLive below is
  // CleanupUntrackedObjects, but emptying an array cannot reach work
  // that is still crossing an await - a spawn or a corpse mint in
  // flight when a fast travel or a quickload sweeps resolves
  // AFTERWARDS and pushes a record built for the world that just went
  // away, at its departure coordinates. DFU instantiates enemies and
  // corpse markers synchronously, so it has no such window and needs
  // no token; the port does. Everything that lands late compares the
  // epoch it started in against this and hands its GL objects back
  // instead of joining the new world.
  let epoch = 0;
  // WORLD6b (Mac, 2026-09-14: "Continue"): A FOE IS ITS SPAWNER'S. Online, in a cell, every foe this pool spawns is
  // mine and streams to the cell; every foe a peer streams stands here as a PUPPET (`f.puppet` the owner's id, `f.seq`
  // the owner's number for it) that follows the stream, draws and sounds, and lands no blow of its own; a blow on a
  // puppet goes to its owner as a hit. The world host installs the net (setNet) with the two frames' converters.
  let _nextSeq = 1, _nextUid = 1;
  let _net = null;              // { room, onPeerHit, toWire, toScene, now, staleMs }
  let _foesSeq = 0;             // my frames out, numbered
  // AUDIT WORLD6b B4/C3: an OWNER's record - the last frame number applied (a stale frame is not the world), when it
  // arrived (an owner whose stream has died is swept after staleMs), and the build generation (a build the clear or
  // the prune overtook ends on arrival, B6). The record is the owner's PRESENCE's: it goes when the owner does, so a
  // reload (which keeps the id and numbers from one again) is heard
  const _owners = new Map();
  let _ownerGen = 0;
  const _pupPending = new Map();   // owner:seq -> the latest record for a puppet being built (B13: it lands when the build does)
  const _pupIndex = new Map();     // owner:seq -> the standing puppet (B16)
  // WORLD6b-ii (Mac, 2026-09-14: "Continue"): THE FOE HUNTS EVERY PLAYER IN THE CELL - WORLD3's law for the dungeon
  // host's foes, per owner. The peers ride MY foes' target machine as candidates minted off the pose stream (one
  // identity per id, so the machine's reference compares hold); my frame's record carries the target (`g`: '.' me,
  // an id a peer, '' none); a PUPPET whose streamed target is ME resolves its owner's foe's melee frame and shaft
  // here, with my own reach and my own stats (the owner decided the swing, I decide the hit), and at another the
  // swing's clip and a shaft that pays nothing; MY foe's blow at a peer is the peer's to resolve (the swing's voice
  // alone here). A peer's hit on my foe carries the striker's feet and the blow's direction, so the foe turns on
  // the striker and the shove goes the way the blow went. Casts stay the owner's own: a foe whose target is a peer
  // does not cast (6b-iii).
  const _peerCands = new Map();   // id -> { isPlayer, isPeer, id, feet, height, health }
  let _peerFrame = 0, _peerRead = -1;

  const activeCount = () => foes.filter((f) => !f.dead && !f.puppet).length;   // WORLD6b: a puppet is its owner's, not this cap's

  /** One encounter foe at a world position - the dungeon load chain's
   *  shape, host-owned. B1 opts: a QUEST foe rides the same chain -
   *  `gender` forces the Foe resource's own humanoid gender (else the
   *  pool's 0.5 roll stands), `yaw` faces the spawn (CreateFoe's
   *  LookAt player, :328), `questBehaviour` binds the
   *  QuestResourceBehaviour host at the stand. A quest foe is exempt
   *  from the encounter self-limit: DFU's CreateFoe spawns
   *  unconditionally, and the cap is the port's own encounter bound,
   *  not a law.
   *
   *  AUDIT 62 F12: `replacing` is the second exemption, and it is the
   *  same argument. WabbajackEffect.cs:86-88 is
   *  `targetEntity.gameObject.SetActive(false)` followed by an
   *  unconditional `GameObjectHelper.CreateEnemy(...)` - one entity
   *  destroyed, one minted in its place, so the transform is
   *  slot-NEUTRAL by construction and cannot grow the pool. The struck
   *  entity is often a WATCHMAN, whose removal frees a slot in the
   *  guard pool and none here, so without the exemption a Wabbajack
   *  strike on a full street simply erased him and stood nothing -
   *  worse than either the reference or the refusal it replaced. */
  async function spawnFoe(mobileType, pos, { gender: forcedGender = null, yaw = null, questBehaviour = null, allied = false, feetGiven = false, replacing = false, puppet = null, seq = null, level = null } = {}) {
    if (!questBehaviour && !replacing && !puppet && activeCount() >= MAX_ACTIVE_ENCOUNTER_FOES) return null;   // WORLD6b: a puppet is not this cap's
    const basics = ENEMY_BASICS[mobileType];
    if (!basics || !basics.maleTexture) return null;
    const pending = { feet: [pos[0], pos[1] + (feetGiven ? 0 : 0.1), pos[2]] };   // AUDIT 39: shifted by offsetAll until the record lands. REVIEW 2026-09-05: a restore hands back the exact saved feet (SerializableEnemy.cs:196) - a flyer never grounds, so the walker's lift would climb 0.1 per load
    spawning.push(pending);
    const gen = epoch;   // AUDIT-39r: the world this foe is being built for
    try {
      const isClass = mobileType >= 128;
      const career = isClass
        ? (() => { const cf = new ClassFile(); return fetchBytes(`CLASS${String(mobileType - 128).padStart(2, '0')}.CFG`).then((b) => { cf.load(b); return cf.career; }); })()
        : loadMonsterCareer(mobileType, fetchBytes);
      const entity = makeEnemyEntity(mobileType, basics, await career, level ?? playerEntity.level);   // AUDIT WORLD6b-ii B2: a puppet at its OWNER's foe's level, not mine
      // MT-ii: an ALLIED summon (Sanguine Rose / Skull of Corruption).
      // SetupDemoEnemy.cs:85-86 overwrites the MobileEnemy STRUCT COPY
      // before SetEnemy, and EnemyEntity.cs:316 seeds Entity.Team from
      // that copy - so BOTH per-instance fields turn, and the shared
      // frozen basics row (the STATIC table the ally-revert reads)
      // does not. Getting that wrong would ally every foe of the type.
      if (allied) { entity.team = 'PlayerAlly'; entity.mobileTeam = 'PlayerAlly'; }
      // AUDIT WORLD6b B14: a PUPPET carries no loot of this player's (its body is its owner's - recorded), wears no
      // kit of its own and casts nothing, so its stand rolls no table and draws nothing off the injectable roll or
      // the shared stream: what my neighbours stream must not move my own dice
      if (puppet) entity.items = [];
      else {
        entity.items = generateLootItems(basics.lootTableKey ?? '-', { level: playerEntity.level, gender: playerEntity.gender });
        equipEnemy(entity, mobileType, playerEntity.level);
        addEnemyLootExtras(entity.items, basics, rolls);   // AUDIT 24 (wave 43): EnemyEntity.cs:388-397, after the equipment as DFU has it
      }
      // NT2 (F210): GetTextureArchive's gender arm - a DFRandom draw off
      // the shared stream (Ledger A: a DFRandom site never rides the
      // injectable roll), humans only; monsters read the male texture.
      const gender = MobileUnit.resolveGender(forcedGender ?? 'unspecified', basics);
      const behaviour = basics.behaviour ?? 'General';
      const archive = gender === 'female' ? basics.femaleTexture : basics.maleTexture;
      const tex = await getTexture(archive);
      // AUDIT-39r: a sweep crossed this spawn - the world it was built
      // for is gone, and pushing it now would land a departure-point
      // foe in the destination pixel beside restoreWorld's copies.
      // Nothing is allocated yet, so dropping the record is the whole
      // cancel; the caller already reads null as "no foe stood".
      if (gen !== epoch) return null;
      // INCIDENT 2026-09-04 (ceiling bats): the texture is fetched
      // BEFORE the AI stands because the capsule height reads the idle
      // sprite (SetupDemoEnemy.cs:103-115), and a FLYER's spawn point
      // is its sprite CENTRE (FinalizeFoe's +1.5 lifts the transform,
      // CreateFoe.cs:341-359; CreateEnemy skips the ground align for
      // Flying, GameObjectHelper.cs:1227) - the motor keeps FEET.
      const idleH = idleSpriteHeight(tex);
      // REVIEW 2026-09-05: a DELTA on the live pending array (offsetAll may
      // have recentred it during the awaits), taking the walker's +0.1
      // lift back with it; `feetGiven` is the restore's word that `pos`
      // already IS feet (SerializableEnemy restores the position it
      // wrote - no FinalizeFoe, no drop).
      if (behaviour === 'Flying' && !feetGiven) pending.feet[1] -= idleH / 2 + 0.1;
      const ai = new EnemyAI(collider, pending.feet, yaw ?? rolls() * Math.PI * 2, {
        liveSpeed: () => liveStat(entity, 'speed'),   // AUDIT 39: EnemyMotor.cs:432 re-reads LiveSpeed per FixedUpdate
        seesThroughInvisibility: basics.seesThroughInvisibility ?? false,
        behaviour, mobileId: mobileType,
        height: enemyControllerHeight(idleH, behaviour),   // INCIDENT 2026-09-04: SetupDemoEnemy.cs:103-115
        centreOffset: idleH / 2,   // REVIEW 2026-09-05: transform.position = the sprite centre
        playerInside,   // EnemySenses.cs:267-269 - the host's PlayerEnterExit.IsPlayerInside picks the band
        isActionDoor,   // AUDIT 63 F42: ObstacleCheck's DaggerfallActionDoor arm (EnemyMotor.cs:1158-1171)
        // wave 35: DoRangedAttack's band - a shooter inside 6..51.2 with
        // the target in sight stands off instead of closing.
        hasBowAttack: hasBowAttack(basics),
        canCastRangedSpell: () => caster?.canCastRangedSpell() ?? false,   // D9: SelectedSpell, from the caster stood below
        hasMagickaToCast: () => hasMagickaToCast(entity),   // GetDestination's own term (:539-540)
      });
      pending.feet = ai.feet;   // AUDIT 39: the AI's copy is the live array from here
      const attack = new EnemyAttack({ liveSpeed: () => liveStat(entity, 'speed'), playerLevel: playerEntity.level, reflexes: playerEntity.reflexes, rolls });   // AUDIT 39: EnemyAttack.cs:69-72, ditto
      // X2-slice: the arrow seam exists (the host's onArrow) - bow
      // foes read the SAME ranged-flags law the dungeon build does,
      // and the C-slice 6..51.2 band drives them above ground.
      attack.rangedAttack = hasBowAttack(basics);
      // X3-slice: the S16 spell lists ride the same assignment the
      // dungeon build runs; a listed caster gets the shared decision
      // driver. No SPELLS.STD yet (the map loads async) = no lists,
      // exactly like a degraded dungeon boot.
      const sbi = spellsByIndex?.();
      if (sbi && !puppet) assignEnemySpells(entity, sbi);   // AUDIT WORLD6b B14
      const caster = entity.spells?.length ? new EnemyCaster(entity, rolls) : null;
      const mobile = new MobileUnit(mobileType, basics, (rec) => tex.getFrameCount(rec), Math.random, gender);
      const batch = renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]);
      const f = { mobile, ai, attack, entity, caster, batch, tex, archive, mobileType, gender, idleH, dead: false, _encounter: true, _prevMState: 'Idle', _mout: null,
        sounds: new EnemySoundSource(mobileType, rolls) };   // AUDIT 24 (wave 41): this pool made no sound at all
      // MT-ii: THE RECORD IS THE CANDIDATE. getTargets reads `ai` and
      // `entity` off it, and its identity IS the target handle (the
      // `c === self` skip and the mutual-target write both rely on
      // one stable object per foe, exactly as DFU's behaviour
      // reference does). The two quest halves are LIVE GETTERS, never
      // frozen booleans: bindQuestFoeHost runs after this line, and
      // ChangeFoeInfighting flips IsAttackableByAI mid-quest.
      // A5 adds `concealment`: the closure the illusion gate has read
      // since MT-i and nothing ever built. BlockedByIllusionEffect
      // (EnemySenses.cs:658-683) reads `target.Entity.IsInvisible /
      // IsBlending / IsAShade` for WHATEVER it is looking at - the
      // player or another enemy - and ConcealmentEffect writes the
      // flag entity-blind (:63), so a Shadow cast on a rat hides that
      // rat from the guard hunting it.
      Object.defineProperties(f, {
        isQuestFoe: { get: () => !!f.questBehaviour, enumerable: false },
        questAttackable: { get: () => !!f.questBehaviour?.isAttackableByAI, enumerable: false },
        concealment: { value: () => concealmentFlags(f.entity), enumerable: false },
      });
      // MT-ii: the cross-pool damage door (the guard pool's twin) - a
      // striker in the OTHER pool reaches this foe's death chain
      // through its own candidate handle, with no attacker feet, so
      // the player-attack arm never runs for a monster's blow.
      // `fromPlayer: false` - ANOTHER ENEMY's blow is not the player's
      // (DaggerfallEntityBehaviour.cs:203). Without it a monster
      // mauling a foe would re-hostile that foe toward the PLAYER and
      // revert a struck ally's team, both for a blow the player never
      // struck. (The audit lane's F041 pin caught exactly this on the
      // merge - the two laws meet here.)
      f.hurtFromFoe = (dmg, dir) => damageFoe(f, dmg, null, dir ?? null, { fromPlayer: false });
      // A5 - SetupDemoEnemy.cs:191-195: "Add special behaviour for
      // Daedra Seducer mobiles", gated on the mobile ID and nothing
      // else. RandomEncounters lists the seducer in five outdoor
      // tables, so this pool stands them too.
      if (mobileType === MOBILE_DAEDRA_SEDUCER) f.seducer = new SeducerTransformBehaviour(mobile, entity);
      f.seq = seq ?? _nextSeq++;   // WORLD6b: mine numbered from one, a puppet's its owner's number
      f.puppet = puppet ?? null;
      f.uid = _nextUid++;   // AUDIT WORLD6b B15: the corpse loot's stable key (an index names another body once anything ahead is spliced)
      if (f.puppet) _pupIndex.set(`${f.puppet}:${f.seq}`, f);
      foes.push(f);
      // B1: the quest resource behaviour couples at the stand - the
      // activation moment, where Unity runs the deferred Start.
      if (questBehaviour) bindQuestFoeHost(f, questBehaviour, questPoolOps);
      return f;
    } catch (err) {
      console.error(`[encounter] mobileType ${mobileType} failed to spawn:`, err?.message ?? err);
      return null;
    } finally {
      // The hand-off is synchronous with `foes.push`, so there is no
      // frame in which the spawn is in neither list.
      const i = spawning.indexOf(pending);
      if (i >= 0) spawning.splice(i, 1);
    }
  }

  /** B1: the quest behaviour's pool surface (the questFoeHost
   *  contract). zeroFoeHealth routes the DeathTrigger zeroing through
   *  the one damage door so corpse, loot, alert and the kill notice
   *  all run; removeFoe is Destroy(gameObject) - the isHidden
   *  teardown - gone with no corpse, the cull's own shape. */
  const questPoolOps = {
    removeFoe: (f) => {
      if (f.dead || f.puppet) return;   // AUDIT WORLD6b B9: a peer's foe is not mine to remove (a dispel, a Wabbajack, a clear leave it to its owner's stream)
      releaseFoeBatch(f);
      f.dead = true;
      f.questBehaviour?.notifyDestroyed();
    },
    // AUDIT 58: the SetHealth(0) door, not a damage source - like
    // hurtPlayer's bypassShield it must not be mitigated.
    zeroFoeHealth: (f) => { if (!f.dead && !f.puppet) damageFoe(f, f.entity.health, null, null, { bypassShield: true }); },   // AUDIT WORLD6b B9
    spellsByIndex: () => spellsByIndex?.(),
    foeSinks: (f) => foeSinks(f),
    rolls,
  };

  /** EnemyDeath.CompleteDeath's corpse, through the one home - the fallen foe's body on the ground (AUDIT 24 wave 38),
   *  tracked to the streamer's pixel at the death; WORLD6b: a puppet's body too, where its owner's stream let it fall. */
  function mintCorpse(f) {
  const _corpsePixel = currentPixelKey();
  const _corpseGen = epoch;   // AUDIT-39r: the world this body falls in
  mintCorpseMarker({
    renderer, getTexture, uploadRecordFrame, collider,
    // A5 - EnemyDeath.cs:86-92 reads `mobile.Enemy.CorpseTexture`,
    // the per-mobile STRUCT COPY: SetSpecialTransformationCompleted
    // swaps the seducer's unwinged corpse (400/6) for the winged
    // one (400/5), which the static row cannot carry.
    corpseTexture: f.mobile?.basics?.corpseTexture ?? ENEMY_BASICS[f.mobileType]?.corpseTexture,
    feet: f.ai.feet,
    fallbackSize: billboardSize(f.tex, 0),
    stillDead: () => f.dead,
  }).then((c) => {
    if (!c) return;
    // AUDIT-39r: the sweep took this pool's world while the marker
    // was still loading its art. Its pixelKey would be the
    // departure pixel, which the teleport has already torn down -
    // so collectPixel could never reach the batch again and it
    // would draw at the departure position for the session.
    // AUDIT WORLD6b B7: and a record that ENDED while the art loaded (a puppet swept by the prune or the room change)
    // takes its body with it - the marker landed in corpseBatches owned by nothing
    if (_corpseGen !== epoch || f._gone) { renderer.destroyBillboardBatch(c.batch); return; }
    f.corpseMarker = c;   // the loot seam reads the GROUND position from here
    // TrackLooseObject's stamp: the streamer's pixel at the death,
    // not the corpse's own position.
    c.pixelKey = f.corpsePixelKey = _corpsePixel;
    corpseBatches.push(c);
    playBodyFall(audio, c.pos);
  }).catch(() => {});
  }

  /** The one damage door: corpse + loot on death (no crime - these
   *  are monsters and brigands, not the watch). */
  /** X3-slice: the per-foe sinks the cast executor feeds (the
   *  dungeon's foeSinks shape - self-casts heal/buff through these). */
  const foeSinks = (f) => ({
    hurt: (n) => damageFoe(f, n, null, null),
    heal: (n) => { f.entity.health = Math.min(f.entity.maxHealth ?? Infinity, f.entity.health + n); },
    drainMagicka: (n) => { if (n > 0) f.entity.magicka = Math.max(0, (f.entity.magicka ?? 0) - n); },
    restoreMagicka: (n) => { if (n > 0) f.entity.magicka = Math.min(f.entity.maxMagicka ?? Infinity, (f.entity.magicka ?? 0) + n); },
    drainFatigue: (n) => { if (n > 0) f.entity.fatigue = Math.max(0, (f.entity.fatigue ?? 0) - n); },
    restoreFatigue: (n) => { if (n > 0) f.entity.fatigue = Math.min(maxFatigue(f.entity), (f.entity.fatigue ?? 0) + n); },
  });

  /** X3-slice: this pool's binding of the ONE shared cast executor
   *  (characters/enemyCasting.js), the dungeon host's shape. Both
   *  callers go through here - the S16 casting decision and wave 30's
   *  spider/scorpion paralyze rider - so the deps are written once. */
  function castSpellFrom(f, spell, playerFeet, noSpellPointCost = false) {
    castEnemySpell(f, spell, {
      noSpellPointCost, playerEntity, playerFeet, playerHeight: _lastPlayerHeight,   // ROAD-H H2: the AreaAroundCaster blast is an OverlapSphere against the player's CAPSULE
      applySpell, foeSinks, calculateCastCost, silenceBlocksCast,
      // AUDIT 58: play3dId - SPELL_CAST_SOUND is ID space (EntityEffectManager.cs:44-48)
      playCastSound: (element, from) => audio?.play3dId?.(SPELL_CAST_SOUND[element] ?? SPELL_CAST_SOUND[4], from, 1, { maxDistance: 16 }),
      hitEffects,   // AUDIT 24 (wave 44): ShowMagicSparkles on the caster
      explodeAt: magicHooks?.explodeAt,
      fireMissile: magicHooks?.fireMissile,
      rolls,
    });
  }

  /** Free a foe's live billboard batch once nothing will draw it. */
  function releaseFoeBatch(f) {
    if (!f.batch) return;
    renderer.destroyBillboardBatch(f.batch);
    f.batch = null;
  }

  /** AUDIT 26 F035/F041: `fromPlayer` is this door's provenance flag.
   *  DFU flips hostility inside HandleAttackFromSource's player gate
   *  (DaggerfallEntityBehaviour.cs:203, :250-261) while
   *  EnemyMotor.ApplyFallDamage calls DecreaseHealth alone
   *  (:1398-1401), so a language-pacified foe that takes fall damage
   *  must not turn on the player with no player action. Defaults
   *  TRUE: every player blow and spell is unchanged.
   *
   *  MT-ii: and INSIDE that gate the whole of
   *  MakeEnemyHostileToAttacker (EnemyMotor.cs:186-214), not the
   *  hostility raise alone - the target-reassign guard fires on EVERY
   *  player hit (it was a no-op before MT, when there was no target to
   *  reassign), and the player arm additionally reverts a struck
   *  former ally to its species (:204-213). resetAllyTeamOnPlayerAttack
   *  raises IsHostile itself, so a headless stub ai still stands up. */
  /** AUDIT 58: HandleAttackFromSource's PLAYER ARM, lifted out of the
   *  damage door - DFU runs it for every swing that CONNECTED, damage
   *  or none. WeaponManager.WeaponDamage's `damage > 0` fork closes at
   *  :615 and :627/:630 (`DecreaseHealth(damage)` then
   *  `HandleAttackFromSource(PlayerEntityBehaviour)`) run
   *  unconditionally after it, so a swing that lost the to-hit roll
   *  still wakes a pacified foe and, through :255-258, its whole area.
   *  This pool skipped the door entirely at zero damage. */
  /** AUDIT WORLD6b-ii B4: THE ONE DOOR for a connecting swing or shaft of mine that landed no damage (WeaponManager.cs
   *  :630 runs for every connect) - a foe of mine wakes (handleAttackFromPlayer); a PUPPET's owner hears a zero blow
   *  (AUDIT WORLD2 B13) unless a damaging one already went this frame, and no area of mine wakes for it. */
  function attackFromPlayer(f, playerFeet = null) {
    if (!f) return;
    if (f.puppet) { if (f._divertFrame !== _peerFrame) damageFoe(f, 0, playerFeet, null); return; }
    handleAttackFromPlayer(f, playerFeet);
  }
  function handleAttackFromPlayer(f, playerFeet = null, peer = false, peerId = null) {
    if (!f?.ai) return;
    // ROAD-B: DaggerfallEntityBehaviour.cs:255-258 sits BEFORE the
    // call below and is a different law - the whole area turns, this
    // one foe additionally learns where the blow came from. The
    // `!isHostile` read must precede the walk, which flips this foe
    // too.
    // WORLD6b (AUDIT WORLD2 B9/C4's law, the dungeon's): a PEER's blow turns the struck foe alone - the area's wake
    // and the charmed ally's revert are this player's own attack; the foe turns on this player, its owner, at the
    // last feet it knew (the striker's feet are not on the hit - recorded)
    if (!peer && !f.ai.isHostile) makeAreaHostile?.();
    // WORLD6b-ii: a peer's blow turns the foe on the PEER - its candidate, at the striker's feet the hit carried.
    // AUDIT WORLD6b-ii A3: a peer's blow NEVER names me as its attacker - a striker with no candidate here (a pose
    // hiccup, out of range) fell through to PLAYER_TARGET and my pacified foe woke on ME at the striker's feet; now
    // the foe is woken with the remembered position alone and the next machine pass picks its target
    const _striker = peer ? peerCandidate(peerId) : PLAYER_TARGET;
    if (_striker) f.ai.makeEnemyHostileToAttacker?.(_striker, playerFeet ?? null);   // wave 36: seeded with where the attack came from
    else f.ai.makeHostileToPlayer?.(undefined, null);   // B5: and no feet of a stranger's seed my foe
    if (!peer) resetAllyTeamOnPlayerAttack(f.ai, f.entity, f.mobileType);
  }

  function damageFoe(f, damage, playerFeet, knockDir = null, { fromPlayer = true, bypassShield = false, kind = 'melee', peer = false, peerId = null } = {}) {
    // WORLD6b: a PEER's blow (applyHit) is the dungeon door's law (WORLD2): no HUD mark and no reveal of this
    // player's - the striker's own rang at the striker
    if (!peer) {
      markFoeStruck(f, { fromPlayer });   // PX30: the enhanced HUD's target frame
      if (damage > 0) markConcealedHit(f, _ecvT);   // ECV1: a hit on an unseen foe flashes it
    }
    // WORLD6b: a PUPPET takes no damage here - the blow goes to its owner as a hit (the owner's door applies it and
    // the owner's next frame says so); the striker's own ring, blood and pain played before this door, as ever
    if (f.puppet) {
      // AUDIT WORLD6b B1: THE DIVERT HAS THE DUNGEON DOOR'S PROVENANCE GATE - only this PLAYER's own blow goes to the
      // owner; a fall, another foe's maul, a poison round, a blow relayed here are not mine to report (the owner's
      // simulation has its own), and every one went to the owner as MY blow until now (AUDIT WORLD2 B7 re-opened).
      // A7: the blow is keyed to the cell as the frame is, so the owner refuses another room's
      // WORLD6b-ii: the striker's feet (p, in the world frame) and the blow's direction (d) ride the hit - the owner's foe
      // turns on ME and the shove goes the way the blow went (WORLD3's spelling for the dungeon's hit)
      const _pAt = playerFeet && _net?.toWire ? _net.toWire(playerFeet) : null;
      if (fromPlayer && !peer) f._divertFrame = _peerFrame;
      if (fromPlayer && !peer) _net?.onPeerHit?.({ to: f.puppet, k: _net.room?.() ?? null, i: f.seq, dmg: Math.max(0, Math.round(Number(damage) || 0)), kind,
        ...(_pAt ? { p: [q2(_pAt[0]), q2(_pAt[1]), q2(_pAt[2])] } : {}),
        ...(knockDir ? { d: [q3(knockDir[0]), q3(knockDir[1]), q3(knockDir[2])] } : {}) });
      return;
    }
    if (fromPlayer && f.ai) {
      handleAttackFromPlayer(f, playerFeet, peer, peerId);
    }
    // AUDIT 58: THE SHIELD POOL, on the FOE door as well as the
    // player's. DFU's hook is inside the ABSTRACT BASE's
    // DecreaseHealth (DaggerfallEntity.cs:313-328 - "Allow an active
    // shield effect to mitigate incoming damage from all sources"), so
    // every entity absorbs alike; Shield's AllowedTargets is
    // TargetFlags_All (Shield.cs:35), and the port's own applySpell
    // really does push the pool onto a foe (systems/effects.js, kind
    // 'shield'). Only the player's door consumed it, so a Shield cast
    // on a foe was carried and never read. The pool is consulted at
    // the SUBTRACTION only: DFU's knockback reads the RAW damage and
    // runs BEFORE DecreaseHealth (WeaponManager.cs:576-596, :627), and
    // HandleAttackFromSource runs after it unconditionally (:630), so
    // a fully absorbed blow still knocks back and still turns the foe.
    const healthDamage = bypassShield ? damage : damageShieldPool(f.entity, damage);
    f.entity.health -= healthDamage;
    if (f.entity.health <= 0) {
      // X5: the SOUL TRAP intercept, where EnemyEntity.SetHealth's
      // override sits (:157-177) - before the death, every source alike.
      // AUDIT WORLD6b B2 (AUDIT WORLD2 B9's law, the dungeon's): a PEER's killing blow reads no gem of mine and fills
      // no Star of mine, and speaks no kill notice of mine - the kill is the peer's
      const trap = peer ? { allowDeath: true } : attemptSoulTrap(f.entity, f.mobileType, playerEntity.items, Math.random());
      if (trap.alert) say?.(SOUL_TRAP_TEXT[trap.alert]);
      if (!trap.allowDeath) { f.entity.health = 1; return; }
      // V3: the equipped AZURA'S STAR takes every slain MONSTER's soul
      // (DaggerfallEntityBehaviour.cs:240-247); after the trap, so a
      // trap-filled Star is no longer empty; classes have no soul.
      if (!peer && f.mobileType < 128 && isAzurasStarEquipped(playerEntity)
        && fillEmptyTrap(playerEntity.items, f.mobileType, { azurasStarOnly: true })) {
        say?.(SOUL_TRAP_TEXT.trapSuccess);
      }
      f.dead = true;
      f.corpse = true;
      // the LIVE batch is finished the moment the foe is - batches()
      // skips every dead foe, and the corpse draws from its own batch
      // below. AUDIT 24: this one was never freed either, and unlike
      // the cull the record STAYS in `foes` (the tail splice spares
      // corpses), so the batch was unreachable and undead at once.
      releaseFoeBatch(f);
      // EnemyDeath:131-136 gates the clear on `senses.Target ==
      // PlayerEntityBehaviour` too - a foe killed while fighting
      // ANOTHER foe never touches the player's alert (MT-ii).
      if (isLocalPlayerTarget(f.ai?.target) && f.ai?.detected) setEnemyAlert(playerEntity, false);   // WORLD6b-ii: mine, not a peer's (AUDIT WORLD3 C3)
      if (!peer) sayEnemyDied(say, f.mobileType);   // EnemyDeath:79-83, the kill notice - mine alone (AUDIT WORLD6b B2)
      raiseEnemyDeath(f.entity);   // UL1: OnEnemyDeath (:139) - the corpse's items are the entity's
      // AUDIT 24 (wave 38): EnemyDeath.CompleteDeath, through the one
      // home. This pool minted the marker inline at f.ai.feet - so a
      // flying encounter foe left its corpse hanging in the air where
      // it died, where DFU drops it at FindGroundPosition (:817) - and
      // nothing ever played BodyFall (:126-129).
      // TrackLooseObject runs INSIDE CreateEnemyCorpseMarker, so the
      // pixel is read at the death, not when the texture lands.
      mintCorpse(f);   // WORLD6b: one home for the body, a puppet's too
      return;
    }
    // C15 knockback, WeaponManager.cs:578-581. AUDIT 24 (wave 38): this
    // pool carried only the re-knock half of the gate. C# writes
    //     if (speed <= 5/ratio && EntityType == EnemyClass || Weight > 0)
    // and `&&` binds tighter than `||`, so a monster with any weight
    // re-knocks on EVERY hit while a class enemy must wait for the
    // current shove to decay. Dropping the Weight arm cost both ends:
    // a weighted monster could not be chain-knocked (the second hit
    // inside one shove found speed above the threshold and did
    // nothing), and Ghost (18) and Wraith (23) - the only two rows in
    // the table at Weight 0, which is precisely why DFU's gate spares
    // them - reached the formula and got (10d/0) * (2d - 2d), an
    // Infinity times a zero: NaN. That NaN then sat in knockbackSpeed
    // for the life of the foe, and every later `NaN <= threshold`
    // being false meant it could never be knocked again either.
    const isClass = f.mobileType >= 128;
    const mobileWeight = ENEMY_BASICS[f.mobileType]?.weight ?? 0;
    if (knockDir && weaponKnockbackApplies(f.ai.knockbackSpeed, isClass, mobileWeight)) {
      // EW1: the foe's own kit is half of DFU's weight
      const w = enemyWeightClassicUnits(isClass, f.gender, mobileWeight, f.entity?.items);
      f.ai.knockbackSpeed = weaponKnockbackSpeed(damage, w);
      f.ai.knockbackDir = [knockDir[0], knockDir[1], knockDir[2]];
    }
  }

  /** The per-frame loop - the guard loop minus the crime arms, plus
   *  the distance cull and the sight alert raise. */
  /** MT-ii: one foe's armed senses context. The motor hands its
   *  targeting closure only (ai, playerFeet, dt), but runTargetMachine
   *  needs the CANDIDATE, so the binding happens here where the record
   *  is in hand. No `candidates` in the context = the legacy
   *  player-only path, untouched. */
  function _armed(f, senses) {
    if (!senses?.candidates) return senses;
    return {
      ...senses,
      targeting: (ai, pf, cdt) => runTargetMachine(f, [...senses.candidates(), PLAYER_TARGET, ...peerCandidates()], pf, cdt, {   // WORLD6b-ii: the peers are MY foes' candidates; AUDIT WORLD6b-ii A5: after ME (a peer never beats me on a tie), A9: a puppet never steps here
        playerEntity: senses.playerEntity ?? null,
        playerHeight: senses.playerHeight,   // AUDIT 62 F23: GetTargets measures the player at its LIVE capsule too
      }),
    };
  }
  /** WORLD6b-ii: the peers in my cell as target candidates (WORLD3) - read once a frame off the net, each a stable
   *  identity; a peer gone is dead to the machine (health 0, targetHealth's read) and dropped. */
  function peerCandidates() {
    if (_peerRead === _peerFrame) return [..._peerCands.values()];
    _peerRead = _peerFrame;
    const list = _net?.peers?.() ?? null;
    if (!list) { for (const c of _peerCands.values()) c.health = 0; _peerCands.clear(); return []; }
    const seen = new Set();
    for (const q of list) {
      if (!q || typeof q.id !== 'string' || !Array.isArray(q.feet) || q.feet.length !== 3 || !q.feet.every(Number.isFinite)) continue;
      seen.add(q.id);
      let c = _peerCands.get(q.id);
      if (!c) { c = { isPlayer: true, isPeer: true, id: q.id, feet: [0, 0, 0], height: CAPSULE_HEIGHT, health: 1 }; _peerCands.set(q.id, c); }
      c.feet[0] = q.feet[0]; c.feet[1] = q.feet[1]; c.feet[2] = q.feet[2];
      c.height = Number.isFinite(q.height) && q.height > 0 ? q.height : CAPSULE_HEIGHT;
      c.health = 1;
    }
    for (const [id, c] of _peerCands) if (!seen.has(id)) { c.health = 0; _peerCands.delete(id); }
    return [..._peerCands.values()];
  }
  const peerCandidate = (id) => { peerCandidates(); return (typeof id === 'string' && _peerCands.get(id)) || null; };
  /** The feet the ATTACK and CAST components must aim at: DFU's
   *  components read senses.Target, not the player (EnemyAttack.cs:
   *  199-209). Unarmed, or with the player selected, this is the
   *  player's own feet and nothing changes. */
  function _targetFeet(f, playerFeet) {
    const t = f.ai.target;
    if (t == null) return f.ai._armedTargeting ? null : playerFeet;
    return isLocalPlayerTarget(t) ? playerFeet : (isPeerTarget(t) ? t.feet : t.ai.feet);   // WORLD6b-ii: a peer at its own feet
  }
  /** AUDIT 62 F21 (review): the aim point, through the ONE law in
   *  enemyTargets.targetAimPoint (DaggerfallMissile.cs:571-581 ->
   *  EnemySenses.cs:453). This pool's arrow lifted the target's feet
   *  by a flat 0.9 - the PLAYER's standing half-capsule, applied to
   *  whoever was struck. `_targetFeet`'s null (the armed-but-targetless foe)
   *  carries through as a null aim, and the loose is gated on `_tgt`
   *  anyway. */
  function _targetAim(f, playerFeet, playerHeight) {
    return _targetFeet(f, playerFeet) ? targetAimPoint(f.ai.target, playerFeet, playerHeight) : null;
  }

  let _ecvT = 0, _lastPlayerHeight = CAPSULE_HEIGHT;   // ECV1: the pool's clock (seconds), for the shimmer and the hit reveal   // ROAD-H H2: the LIVE player capsule the last tick carried - the AreaAroundCaster blast measures its OverlapSphere against it (DaggerfallMissile.cs:481)
  /** The foe's melee frame AT THE PLAYER - the player arm of MeleeDamage (EnemyAttack.cs:150-175): the reach and the
   *  yaw cone, Dodging tallied, the roll, the riders, the hurt and the flash, the whiff and the voice. One home for
   *  my own foe's blow and, since WORLD6b-ii, a puppet's whose owner's foe is striking me. */
  function resolveFoeMeleeVsPlayer(f, playerFeet) {
    const hdx = playerFeet[0] - f.ai.feet[0], hdz = playerFeet[2] - f.ai.feet[2];
    const wpn = chooseEnemyWeapon(f.entity.weapon, ENEMY_BASICS[f.mobileType]);
    const mid = [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]];
    if (meleeHitConnects(f.ai._dist, f.ai.inSight, withinYaw(f.ai.yaw, hdx, hdz, MELEE_HIT_YAW_DEG))) {
      tallySkill(playerEntity, SKILLS.Dodging, 1);
      const dmg = calculateAttackDamage(f.entity, playerEntity, {
        weapon: wpn,
        // AUDIT 24 (wave 30): THE SPECIAL-ATTACK RIDER, which this
        // pool never passed. FormulaHelper's monster branch calls
        // OnMonsterHit on every hit that lands damage
        // (FormulaHelper.cs:660-662), and it is the ONLY door to
        // rat/bat/zombie/mummy disease, spider and giant scorpion
        // paralysis, and the nymph/lamia fatigue drain. The
        // dungeon host has passed it since S18; above ground the
        // whole table was inert, so no exterior encounter could
        // infect, paralyse or drain the player - the encounter
        // tables mint rats, giant bats, spiders, scorpions,
        // zombies, mummies, nymphs and lamias by day and by
        // night. (The arrow and city-watch paths correctly do NOT
        // pass it: DFU calls it only in the weaponless MONSTER
        // arm, never for a weapon hit or an EnemyClass attacker.)
        onMonsterHit: (att, tgt, hit) => onMonsterHit(att, tgt, hit, {
          currentDay: Math.floor(currentMinute() / MINUTES_PER_DAY), sinks: playerSinks, rolls,
          castParalyze: () => {   // S19: the spider/scorpion free-cast of classic spell 66
            const sp = spellsByIndex?.()?.get(SPIDER_TOUCH_SPELL_INDEX);
            if (sp) castSpellFrom(f, sp, playerFeet, true);
          },
        }),
        onInflictPoison: (att, tgt, pt) => inflictPoison(playerEntity, pt, false, { currentMinute: Math.floor(currentMinute()) }),
        say,
      });
      // AUDIT 24 (wave 39): EnemyAttack.cs:406 -
      // `PlayerObject.SendMessage("RemoveHealth", damage)` - which
      // is ShowPlayerDamage.Flash's trigger. An enemy's BLOW
      // flashes the screen; the poison it carries does not.
      if (dmg > 0) { onPlayerHurt?.(dmg, wpn); flashPlayerDamage(); }
      // C2-slice (combat-9): a connected attack that LOST the
      // roll rings the miss sound (ApplyDamageToPlayer's else)
      else audio?.play3d?.(enemyMissSound(wpn), mid, 1, { maxDistance: 16 });
    } else {
      // C2-slice (combat-9): the out-of-reach whiff rings too
      audio?.play3d?.(enemyMissSound(wpn), mid, 1, { maxDistance: 16 });
    }
    // C2-slice (combat-17): the 20% enemy-class attack voice at
    // the damage frame, whatever the outcome.
    const v = enemyAttackVoice(f);
    if (v && v.clip >= 0) audio?.play3d?.(v.clip, mid, 1, { maxDistance: 16, pitch: 1 + v.pitchLift });   // AUDIT 58: EnemySounds.cs:172-175
  }

  function update(dt, playerFeet, eye, senses = {}) {
    _ecvT += dt; _lastPlayerHeight = senses.playerHeight ?? CAPSULE_HEIGHT;   // ROAD-H H2: the live capsule this tick, for the AoC blast the cast seam fires
    _peerFrame++;   // WORLD6b-ii: the peers are read once a frame
    for (const f of foes) {
      // B1: the QuestResourceBehaviour drives every frame the object
      // lives (Unity Update on the component) - BEFORE the dead skip,
      // because the kill credit lands on the update AFTER health hit
      // zero (the injured-check return holds death to the next tick),
      // and a corpse's component still runs in DFU.
      f.questBehaviour?.update();
      if (f.dead) continue;
      // WORLD6b: a PUPPET - posed by its owner's stream (the feet eased toward the streamed feet, a far jump snapped, the
      // yaw set), the walk while the streamed feet move, the hurt one-shot after a health drop, the strike edge once
      // per streamed count; it draws and sounds like any foe and lands no blow of its own (its owner's foe lands
      // those, on its owner - a foe hunting a peer is the next slice's)
      if (f.puppet) {
        const edge = puppetStep(f, dt);
        f._mout = f.mobile.update(dt, { moving: f.ai.moving, striking: edge && !f.attack.firedRanged, rangedStriking: edge && !!f.attack.firedRanged, hurting: f.ai.hurtKnock, casting: false }, f.ai.yaw, f.ai.feet, eye);
        if (edge) playEnemyClip(audio, f.sounds.attack(), f.ai.feet, acuteHearingMultiplier(playerEntity));
        // WORLD6b-ii (AUDIT WORLD2 B4's shape): observation, not decision - the blow at me reads inSight and _dist off the
        // streamed pose. AUDIT WORLD6b-ii A6/B8: the latch tells the truth the stream carries (a puppet hunting another
        // peer is no enemy that has detected ME - the rest gate reads it), and the senses run for a puppet at me alone
        f.ai.targetIsLocalPlayer = f._pupMine;
        if (f._pupMine) {
          f.ai._senses?.(playerFeet, null);
          if (f.ai.inSight && f.ai.detected) setEnemyAlert(playerEntity, true, currentMinute());   // B6: a peer's foe beating on me is an enemy alert of mine (the rest, the trip, the roll)
        }
        tickEnemySound(f.sounds, f.ai.feet, playerFeet, dt, { audio, collider, hearing: acuteHearingMultiplier(playerEntity) });
        // WORLD6b-ii: a puppet lands no blow of its own (WORLD2) - unless the blow is at ME, and a shaft at anyone flies
        if (!f._pupMine) f.mobile.doMeleeDamage = false;   // WORLD2 dropped unconsumed: a puppet lands no blow of its own
        if (f._pupTarget == null) f.mobile.shootArrow = false;   // WORLD2 dropped unconsumed: a puppet lands no blow of its own
        const _pupParalyzed = entityIsParalyzed(f.entity);
        if (f._pupMine && !_pupParalyzed && f.mobile.doMeleeDamage) {   // its owner's foe's blow at ME, my reach and my stats
          f.mobile.doMeleeDamage = false;
          // AUDIT WORLD6b-ii B1/C1: bounded - the owner's blow budget, and no blow from a puppet that leapt to me
          const o = _owners.get(f.puppet);
          const budget = tokenGate(o?.blows ?? null, _now(), PUPPET_BLOWS_PER_S);
          if (o) o.blows = budget.bucket;
          if (budget.pass && !f._pup?.leap) resolveFoeMeleeVsPlayer(f, playerFeet);
        }
        else if (f._pupTarget != null && !_pupParalyzed && f.mobile.shootArrow && onArrow) {
          f.mobile.shootArrow = false;
          const _at = f._pupMine ? PLAYER_TARGET : peerCandidate(f._pupTarget);
          if (_at) {   // a target I cannot see: no shaft
            const from = enemyArrowOrigin(f.ai);
            const aim = targetAimPoint(_at, playerFeet, senses.playerHeight ?? CAPSULE_HEIGHT);
            const dir = arrowAimDirection(enemyTransformPoint(f.ai), aim, { targetIsPlayer: f._pupMine, playerCrouching: !!senses.playerCrouching });
            onArrow(from, dir, f, f._pupMine ? null : _at);   // at a peer: a shaft that pays nothing (the flight lands only on the foe it names); the loose rings at the host's seam (AUDIT WORLD6b-ii B7)
          }
        }
        continue;
      }
      // AUDIT 24 (wave 32): PARALYSIS. This pool passed the literal `false`
      // for the motor's paralyzed argument and ran the attack machine
      // unconditionally, so a paralysed encounter foe kept walking and kept
      // swinging - and, until wave 32 gave the pool its magic rounds, the
      // paralysis never expired either. EnemyMotor.HandleParalysis
      // (:247-260) drops CanAct, and EnemyAttack returns at the top of both
      // its Update (:91-94) and its FixedUpdate (:55-57).
      const _fParalyzed = entityIsParalyzed(f.entity);   // S22: the FreeAction read-time fold
      applyEnemyMotorEffectFlags(f.ai, f.entity);   // A5: Levitate.SetEnemyMotor's IsLevitating, folded from the effect's presence
      // ROAD-U: MobileUnit.OneShotPauseActionsWhilePlaying, read where
      // DFU's components read it - the transforming Seducer takes no
      // action at all (EnemyMotor.cs:464-466 + :267-269,
      // EnemyAttack.cs:59-61), not merely no anim intent.
      const _fPaused = !!(f.mobile?.isPlayingOneShot() && f.mobile.oneShotPauseActionsWhilePlaying());
      f.ai.update(dt, playerFeet, _armed(f, senses), _fParalyzed, _fPaused);
      // MT-ii: the foe now aims at whatever it SELECTED - the player
      // (the only candidate in an unarmed host) or another enemy.
      const _tgt = _targetFeet(f, playerFeet);
      // CH3 (characters-8): a past-threshold landing bills the fall
      // formula through the pool's damage door - no knockback.
      // AUDIT 62 F20: EnemyMotor.cs:1403-1406 splashes at bare
      // `transform.position`, and a DFU enemy's transform is the
      // idle sprite's CENTRE, not the capsule base - the prefab
      // centres the controller on it (m_Center 0) and
      // SetupDemoEnemy.cs:98-115 moves only controller.center
      // (GameObjectHelper.cs:360 confirms: height * 0.52f). That is
      // `centreOffset`, which _centre() answers. The FallDamage
      // clip keeps the FEET: :1409 rings it at FindGroundPosition().
      if (f.ai.landedFall > 0 && !f.dead) {
        const fdmg = Math.trunc(FALL_HP_PER_METRE * (f.ai.landedFall - FALL_DAMAGE_THRESHOLD));
        f.ai.landedFall = 0;
        if (fdmg > 0) {
          audio?.play3d?.(SOUND.FallDamage, [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]], 1, { maxDistance: 16 });
          // AUDIT 62 F20: the TRANSFORM (feet + centreOffset), per the note above.
          hitEffects?.showBloodSplash(0, f.ai._centre());
          damageFoe(f, fdmg, null, null, { fromPlayer: false });   // F041: a fall is nobody's attack
        }
      }
      // out of relevance (fresh senses, so a just-spawned foe's
      // Infinity placeholder never culls): gone, no corpse.
      // AUDIT 24 (the seven-slice sweep): EVERY ALLOCATION HAS AN
      // OWNER. The tail splice below drops a culled foe - and with it
      // the only reference to its billboard batch, a VAO and two GL
      // buffers, which nothing freed. Encounters respawn on a timer
      // forever, so this bled for the whole session.
      // MT-ii: the cull measures to the PLAYER, always. `f.ai._dist`
      // is the distance to the SELECTED TARGET once the pool is armed
      // (EnemySenses keeps distanceToPlayer and distanceToTarget as
      // two fields, :372-375 vs :424-427, and this is the
      // distanceToPlayer one). Reading _dist here would make two foes
      // brawling 2m apart uncullable however far the player walked -
      // the encounter pool respawns forever, so that leaks.
      const _playerDist = Math.hypot(playerFeet[0] - f.ai.feet[0], playerFeet[1] - f.ai.feet[1], playerFeet[2] - f.ai.feet[2]);
      // AUDIT WORLD6b-ii A2: `detected` is of ITS target since the hunt - a foe that walked off with a peer is culled by MY
      // relevance (AUDIT WORLD3 C3's own latch), or eight of them held the pool full for the session
      if (_playerDist > ENCOUNTER_CULL_DISTANCE && !(f.ai.detected && f.ai.targetIsLocalPlayer !== false)) {
        releaseFoeBatch(f);
        f.dead = true;
        f.questBehaviour?.notifyDestroyed();   // B1: Destroy(gameObject) - the resource uncouples
        continue;
      }
      // EnemySenses:531-535 - `if (Target == PlayerEntityBehaviour &&
      // TargetInSight)`. MT-ii: the target==player term was
      // unobservable while every foe targeted the player and is not
      // now: two orcs fighting each other must not hold the player's
      // alert state up (the source's own comment: "Any enemies
      // actively targeting player will continue to raise alert").
      if (isLocalPlayerTarget(f.ai.target) && f.ai.inSight && f.ai.detected) setEnemyAlert(playerEntity, true, currentMinute());   // WORLD6b-ii: mine, not a peer's
      f.mobile.frameSpeedDivisor = Math.max(1, Math.trunc((f.entity.stats?.speed ?? 50) / Math.max(8, liveStat(f.entity, 'speed'))));
      if (!_fParalyzed && _tgt) f.attack.update(dt, f.ai, _tgt, _fPaused);   // MT-ii: at the SELECTED target (:199-209)
      // X3-slice: the S16 casting decision rides beside the attack
      // machine, the dungeon's exact shape - the decision casts
      // INSTANTLY through the ONE shared executor.
      f._castPending = false;
      // MT-ii: the caster aims at the SELECTED target too, and the
      // spell releases where it aimed - otherwise a foe duelling
      // another foe would hurl its fireballs at the player. The
      // ENTITY the decision reads is still the player's for a player
      // target; a foe target hands its own (the decision reads the
      // target's live effects for its school picks).
      const _castTargetEntity = isLocalPlayerTarget(f.ai.target) || !f.ai._armedTargeting
        ? playerEntity : (f.ai.target?.entity ?? null);   // AUDIT WORLD6b-ii A9: a peer's effects are not mine to read (the cast at a peer is suppressed, 6b-iii's)
      // ROAD-U: DoRangedAttack's spell branch and DoTouchSpell both sit
      // BELOW TakeAction's pause return (EnemyMotor.cs:466), so a
      // transforming Seducer casts nothing either.
      if (_tgt && f.caster && !_fParalyzed && !_fPaused && f.ai.isHostile) {
        // WORLD6b-ii: no cast at a peer (the cast at a peer is 6b-iii's) - AUDIT WORLD6b-ii A1: the tick still runs, SUPPRESSED,
        // so the pick clears on its own cadence and the motor's stand-off band lets go (gated off, the foe stood rooted)
        const dec = f.caster.update(dt, f.ai, f.attack, _tgt, _castTargetEntity, { suppress: isPeerTarget(f.ai.target) });
        if (dec) {
          castSpellFrom(f, dec.spell, _tgt);
        }
      }
      // AUDIT 24 (wave 42): EnemySenses:504-527 - the first-encounter
      // language roll, which only the dungeon ran. An Orc that speaks
      // Orcish is as talkable-down in a field as in a crypt.
      tryLanguagePacification(f.ai, f.entity, f.mobileType, playerEntity, {
        sheathed: playerWeaponSheathed(),
        enemyLanguageSkill, calculateEnemyPacification,
        say: say ?? (() => {}),
      });
      // AUDIT 24 (wave 41): EnemySounds.FixedUpdate - the attract
      // cadence this pool never had. The counter steps every frame and
      // the sound fires only inside the 16m radius.
      tickEnemySound(f.sounds, f.ai.feet, playerFeet, dt, { audio, collider, hearing: acuteHearingMultiplier(playerEntity) });
      const mstate = f.attack.machine.state;
      const strikeEdge = mstate !== 'Idle' && (f._prevMState ?? 'Idle') === 'Idle';
      f._prevMState = mstate;
      if (strikeEdge) f._atkA = ((((f._atkA | 0) >> 1) + 1) << 1) | (f.attack.firedRanged ? 1 : 0);   // WORLD6b: the attack count on the wire, the ranged bit low (WORLD2's spelling)
      // PlayAttackSound at the START of the swing, as the dungeon does
      // (MeleeAnimation fires it once on the edge, not at the hit).
      if (strikeEdge) playEnemyClip(audio, f.sounds.attack(), f.ai.feet, acuteHearingMultiplier(playerEntity));   // CF1: acute hearing
      // A5 - DaedraSeducerMobileBehaviour.Update (the dungeon pool's
      // law, one spelling): a MonoBehaviour Update that runs BEFORE
      // the anim step consumes the state it raises, keyed on
      // `enemySenses.Target == PlayerEntityBehaviour`.
      f.seducer?.update(dt, isLocalPlayerTarget(f.ai.target) || !f.ai._armedTargeting);   // AUDIT WORLD6b-ii A4: DFU's trigger is Target == PlayerEntityBehaviour - ME, not a peer
      // EnemyMotor.CanFly (:837-845) reads mobile.Enemy.Behaviour LIVE
      // - "This can change in the case of a transformed Seducer".
      if (f.seducer) f.ai.flies = f.mobile.basics.behaviour === 'Flying' || f.mobile.basics.behaviour === 'Spectral';
      f._mout = f.mobile.update(dt, {
        moving: f.ai.moving,
        striking: strikeEdge && !f.attack.firedRanged,
        rangedStriking: strikeEdge && !!f.attack.firedRanged,
        hurting: f.ai.hurtKnock,
        casting: !!f._castPending,
      }, f.ai.yaw, f.ai.feet, eye);
      // X2-slice: the ranged -1 marker looses a REAL arrow through
      // the host's seam, aimed at the player mid-capsule at fire
      // time (the dungeon's shootArrow arm shape).
      // MELEE FIRST, arrow as the ELSE-IF: EnemyAttack.Update is
      // `if (DoMeleeDamage) {...} else if (ShootArrow) {...}` (:97-105).
      // (Found by the wave-35 re-read.)
      if (!_fParalyzed && f.mobile.doMeleeDamage && _tgt) {
        f.mobile.doMeleeDamage = false;
        // MT-ii: MeleeDamage's TWO-ARM SPLIT (EnemyAttack.cs:199-209)
        // - `if (Target == PlayerEntityBehaviour) ApplyDamageToPlayer
        // else ApplyDamageToNonPlayer(weapon, transform.forward)`.
        // Everything below this branch is the player arm, unchanged;
        // the foe arm is the shared payload in hostCombat.js.
        const _foeTarget = f.ai._armedTargeting && f.ai.target && !isPlayerTarget(f.ai.target)
          ? f.ai.target : null;
        if (_foeTarget) {
          const fdx = _tgt[0] - f.ai.feet[0], fdz = _tgt[2] - f.ai.feet[2];
          // EnemyAttack.cs:191-194, the step before the reach fork: a
          // metal-immune FOE target nulls the weapon and the striker
          // falls through to its hand-to-hand attack.
          const fwpn = chooseEnemyWeapon(dropWeaponIfTargetImmune(f.entity.weapon, _foeTarget.entity), ENEMY_BASICS[f.mobileType]);
          const ffwd = [Math.sin(f.ai.yaw), 0, Math.cos(f.ai.yaw)];   // transform.forward (:208)
          if (meleeHitConnects(f.ai._dist, f.ai.inSight, withinYaw(f.ai.yaw, fdx, fdz, MELEE_HIT_YAW_DEG))) {
            applyDamageToNonPlayer(f, _foeTarget, {
              weapon: fwpn, direction: ffwd, rolls,
              calculateAttackDamage,
              // the TARGET's own pool owns its death chain: an
              // encounter foe routes to damageFoe, a watchman to the
              // guard pool's door (the host wires that through the
              // candidate's `hurtFromFoe`, the `_encounter` split
              // world.js already uses for spell sinks).
              dealDamage: (t, d) => (t.hurtFromFoe ? t.hurtFromFoe(d, ffwd) : damageFoe(t, d, null, ffwd)),
              audio, hitEffects,
              // AUDIT 58: FormulaHelper.cs:691-696 has NO player gate -
              // a poisoned foe blade doses the foe it strikes. Without
              // the hook the formula still cleared the dose.
              onInflictPoison: (att, tgt, pt) => inflictPoison(tgt, pt, false, { currentMinute: Math.floor(currentMinute()) }),
              say,   // C-slice: equipment breaks speak (ItemBreaks pops for any owner)
            });
          } else {
            audio?.play3d?.(enemyMissSound(fwpn), [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16 });
          }
          const fv = enemyAttackVoice(f);   // :216-226 fires whatever the target
          if (fv && fv.clip >= 0) audio?.play3d?.(fv.clip, [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16, pitch: 1 + fv.pitchLift });   // AUDIT 58: EnemySounds.cs:172-175
        }
        // AUDIT WORLD6b-ii A7: an if/else, not a `continue` - the melee block sits at the loop's end today, and a
        // `continue` there would silently skip anything appended after it
        else if (isPeerTarget(f.ai.target)) {          const pv = enemyAttackVoice(f);
          if (pv && pv.clip >= 0) audio?.play3d?.(pv.clip, [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16, pitch: 1 + pv.pitchLift });
        }
        else resolveFoeMeleeVsPlayer(f, playerFeet);
      }
      // ...and the damage frames are gated too (wave 32). EnemyAttack.Update
      // returns at the top while paralysed (:91-94), so MeleeDamage and
      // BowDamage never run - the animation may still be mid-swing, but
      // nothing lands. The dungeon host gets this by suppressing the whole
      // mobile update; this pool resolves off the mobile's own frames, so it
      // needs the gate written out.
      else if (!_fParalyzed && f.mobile.shootArrow && _tgt && onArrow) {
        f.mobile.shootArrow = false;
        // MT-ii: the shaft flies at the SELECTED target - BowDamage
        // carries the same two-arm split as MeleeDamage (:134-148).
        // AR1 closed the impact half: arrows.update tests every live
        // foe but the shooter, and arrowHitFoe below runs BowDamage's
        // non-player arm, so an arrow loosed at another foe LANDS.
        // ROAD-H H1/H1b: the loose point and the aim direction, through the ONE law in enemyTargets, so this pool and the dungeon's cannot drift apart the way their aim points had.
        const from = enemyArrowOrigin(f.ai);   // ROAD-H H1: GetAimPosition's ENEMY ARROW arm - the caster's TRANSFORM plus forward*0.6 plus height/3 (DaggerfallMissile.cs:528-539), through the ONE law in enemyTargets so this pool and the dungeon's cannot drift apart the way their aim points had. `feet + 1.2` was a guess in the player's scale with no forward lean at all
        const aim = _targetAim(f, playerFeet, senses.playerHeight ?? CAPSULE_HEIGHT);
        const _at = f.ai.target ?? PLAYER_TARGET, _atPlayer = isLocalPlayerTarget(_at);   // ROAD-H tail (review): BowDamage's two arms, decided once here - the aim, the dip, and the shaft's own memory; WORLD6b-ii: a peer's arm is the foe's (a shaft that pays nothing here) of whom it was loosed at
        const dir = arrowAimDirection(enemyTransformPoint(f.ai), aim, { targetIsPlayer: _atPlayer, playerCrouching: !!senses.playerCrouching });   // ROAD-H H1b: the DIRECTION is measured from the BARE transform (:581), not from that offset origin, and a shot at a CROUCHING player dips 0.05 after the normalise (:583-585) - only at the player, and only on the latched crouch STATE
        onArrow(from, dir, f, _atPlayer ? null : _at);   // ROAD-H tail (review): the foe target rides the shaft (aimFoe) - AssignBowDamageToTarget's `targetEntities[0] == senses.Target` gate (DaggerfallMissile.cs:669) is what the flight reads at contact
      }
      // the -1 damage marker vs the player (C16)
    }
    for (let i = foes.length - 1; i >= 0; i--) if (foes[i].dead && !foes[i].corpse) foes.splice(i, 1);
  }

  /** The player's melee against the pool - cityGuards' shape. */
  function resolvePlayerHit(playerWeapon, eye, lookDir, playerFeet, inViewFn, onHitSound) {
    const live = foes.filter((f) => !f.dead);
    if (!live.length) return false;
    const canSee = (f) => {
      const c = [f.ai.feet[0], f.ai.feet[1] + (f.ai.height ?? CAPSULE_HEIGHT) / 2, f.ai.feet[2]];   // REVIEW 2026-09-05: the foe's own capsule centre
      const dx = c[0] - eye[0], dy = c[1] - eye[1], dz = c[2] - eye[2];
      const dist = Math.hypot(dx, dy, dz);
      const l = dist || 1;
      const hit = collider.raycast(eye, [dx / l, dy / l, dz / l], dist);
      return { dist, inView: inViewFn ? inViewFn(c) : false, losClear: !Number.isFinite(hit) || hit >= dist - 1e-3 };
    };
    let any = false;
    // C2-slice (combat-17): the player's 20% attack grunt, once per
    // hit frame (this path is melee-only, never a bow).
    const grunt = playerAttackGrunt(playerEntity, false, rolls);   // ENGINE-PRNG RULE: the pool's uniform seam
    if (grunt && grunt.clip >= 0) audio?.playOneShot?.(grunt.clip, 1, 1 + grunt.pitchLift);   // AUDIT 58: FPSWeapon.cs:316-319's lift
    { const v = lycanthropeAttackVoice(playerEntity, rolls); if (v != null) audio?.playOneShot?.(v, 1); }   // V4: OnWeaponHitEntity's transformed voice (10% attack / 20% bark)
    for (const { foe, damage } of playerWeapon.resolveHit(live, playerEntity, canSee, rolls,
      (f) => backstabChanceOf(playerEntity, isBackFacing(f.ai.yaw, f.ai.feet, eye)), say,
      (f, pt) => inflictPoison(f.entity, pt, false, { currentMinute: Math.floor(currentMinute()) }))) {   // C2-slice (combat-11)
      any = true;
      if (damage > 0) {
        onHitSound?.(foe);
        // WeaponManager.cs:569-573 - the splash sits right beside the
        // hit sound, and takes the struck foe's OWN BloodIndex, which
        // is why the six rows DFU marks bleed differently. DFU has a
        // raycast impactPosition here; this pool resolves melee by yaw
        // cone and distance, so the body centre (DFU's own formula at
        // its no-raycast site, EnemyAttack.cs:326-328) stands in.
        hitEffects?.showBloodSplash(ENEMY_BASICS[foe.mobileType]?.bloodIndex ?? 0,
          bloodCentre(foe.ai.feet, foe.ai.height));
        // C2-slice (combat-17): the struck class foe cries out 40%
        const pain = enemyPainVoice(foe, damage);
        if (pain && pain.clip >= 0) audio?.play3d?.(pain.clip, [foe.ai.feet[0], foe.ai.feet[1] + 0.9, foe.ai.feet[2]], 1, { maxDistance: 16, pitch: 1 + pain.pitchLift });   // AUDIT 58: EnemySounds.cs:172-175
        damageFoe(foe, damage, playerFeet, lookDir);
      } else {
        const snd = zeroDamageHitSound({
          weapon: playerWeapon.weapon, arrowHit: false,
          parrySounds: !!ENEMY_BASICS[foe.mobileType]?.parrySounds, roll: rolls(),
        });
        if (snd?.at === 'enemy') audio?.play3d?.(snd.sound, foe.ai.feet, 1.1, { maxDistance: 16 });
        else if (snd) audio?.playOneShot?.(snd.sound, 1.1);
        // AUDIT 58: WeaponManager.cs:630 runs after the damage fork
        // closes (:615) - a connecting swing enrages what it touched
        // even at zero damage. Only the aggro half: :627's
        // DecreaseHealth(0) is a no-op and the knockback/hurt sit
        // inside DFU's own `damage > 0` arm.
        // AUDIT WORLD6b B10: a PUPPET's zero-damage connect goes through the one door (AUDIT WORLD2 B13: a zero blow
        // is a blow, the owner's foe turns) - the local wake is a stream-driven body's
        attackFromPlayer(foe, playerFeet);
      }
    }
    return any;
  }

  // AUDIT 24 (wave 38): the corpses this pool has always minted were
  // never reachable. spawnFoe rolls the loot table into entity.items
  // and equipEnemy hangs gear on the foe; damageFoe drew a corpse and
  // stopped there, and the pool exported no activation seam - so every
  // encounter kill's loot existed, was drawn, and could not be opened.
  // The watch has had this since G3; it is the same shape, and now the
  // same code (PlayerActivate's CorpseMarker arm lives in
  // corpseMarker.js for both).
  function lootTargets() {
    return corpseLootTargets(foes, 'foeCorpse', {
      isCorpse: (f) => !!f.corpse && !!f.entity && !f.puppet,   // WORLD6b: a puppet's body carries its owner's loot, not here (recorded)
      idOf: (f) => (f.uid ??= _nextUid++),   // AUDIT WORLD6b B15: stable across the puppets' splices, where an index is not (AUDIT 39's law, the watch's shape)
      // the GROUND position the marker landed on, not where the foe
      // died - a flyer's body is metres below its last feet.
      feetOf: (f) => f.corpseMarker?.pos ?? f.ai?.feet ?? null,
    });
  }
  function takeLoot(key, say2 = () => {}) {
    const uid = Number(key.split(':')[1]);
    return takeCorpseLoot(foes.find((f) => f.uid === uid), playerEntity, say2);   // AUDIT WORLD6b B15: by the stable key
  }

  /** Live sprite + corpse batches for the draw - the guard shape:
   *  record/size/origin mutate per frame, frames upload lazily. */
  function batches() {
    const out = [];
    const ecvOn = combatVisualsOn();   // ECV1: once per frame
    for (const f of foes) {
      if (f.dead || !f._mout) continue;
      // A5 - EntityConcealmentBehaviour.Update/MakeConcealed
      // (:36-43, :56-62): "Handles magical concealment for entities
      // other than player". A non-player entity whose
      // IsMagicallyConcealed is true has its renderer DISABLED - any
      // of the six flags, normal or true power. The entity keeps
      // acting, it simply is not drawn. (The player's own concealment
      // has no visual: DFU never disables the first-person view.)
      // ECV1: on the enhanced skin with the switch on, drawn concealed
      // instead (systems/combatVisuals.js; see dungeonContext.js).
      const ecv = foeDraw(f, ecvOn, _ecvT);
      if (ecv.kind === 'hidden') continue;
      f.batch.conceal = ecv.kind === 'conceal' ? ecv.visual : null;
      const o = f._mout;
      const rkey = `${o.record}#${o.frame}`;
      if (!renderer.textures.has(`${f.archive}_${rkey}`)) uploadRecordFrame(f.archive, o.record, o.frame);
      const sz = mobileBillboardSize(f.tex, o.record);   // AUDIT MM1: a mobile unit's record cache carries the xml scale
      f.batch.record = rkey;
      f.batch.size = { w: o.flip ? -sz.w : sz.w, h: sz.h };
      // INCIDENT 2026-09-04: a flyer or swimmer keeps its CENTRE across
      // records (DaggerfallMobileUnit.cs:407-410); a walker its feet.
      const _bh = f.mobile.basics.behaviour ?? 'General';
      if ((_bh === 'Flying' || _bh === 'Aquatic') && f.idleH !== undefined) {
        const org = f._origin ?? (f._origin = [0, 0, 0]);
        org[0] = f.ai.feet[0]; org[1] = spriteOriginY(f.ai.feet[1], f.idleH, sz.h, _bh); org[2] = f.ai.feet[2];
        f.batch.origin = org;
      } else f.batch.origin = f.ai.feet;
      out.push(f.batch);
    }
    return [...out, ...corpseBatches.map((c) => c.batch)];
  }

  /** CollectLooseObjects (StreamingWorld.cs:1040-1052), the corpse
   *  half: a tracked loose object whose map pixel leaves the streamed
   *  range is DESTROYED - object and record both - and ClearStreaming-
   *  World (:993, from InitWorld :584) collects ALL of them, which is
   *  every teleport and fast travel. Corpse markers are loose objects
   *  (GameObjectHelper.cs:836-839); the port had ported this law for
   *  player-dropped piles (droppedLoot.collectPixel) and not for
   *  corpses, so every kill left a VAO, two GL buffers and an array
   *  entry drawn every frame for the rest of the session.
   *
   *  Clearing `corpse` is the Destroy: batches() stops drawing it,
   *  lootTargets stops probing it, and update()'s tail splice - which
   *  spares corpses - finally prunes the record. */
  function collectPixel(pixelKey) {
    for (let i = corpseBatches.length - 1; i >= 0; i--) {
      if (corpseBatches[i].pixelKey !== pixelKey) continue;
      renderer.destroyBillboardBatch(corpseBatches[i].batch);
      corpseBatches.splice(i, 1);
    }
    for (const f of foes) {
      if (!f.corpse || f.corpsePixelKey !== pixelKey) continue;
      f.corpse = false;
      f.corpseMarker = null;
    }
  }

  /**
   * IF: TEARDOWN. Every allocation has an owner, and until a SECOND
   * host mounted this factory the pool's owner was the process: the
   * exterior host lives as long as the session, so nothing ever had
   * to hand its batches back. An INTERIOR pool is minted per building
   * and dropped on leaving (DFU's OnTransitionExterior tears the
   * interior's enemies down the same way), so without this every door
   * you walked out of leaked one billboard batch per foe standing in
   * it, plus every corpse batch on the floor.
   *
   * Idempotent, and it leaves the record list empty so a caller that
   * keeps the handle by mistake draws nothing rather than drawing
   * freed GL objects.
   */
  function destroy() {
    // AUDIT-39r: the epoch turns FIRST, so anything already in flight
    // (a spawn between its two awaits, a corpse marker waiting on its
    // texture) resolves into a world it can see it does not belong to.
    epoch++;
    for (const f of foes) releaseFoeBatch(f);
    for (const c of corpseBatches) renderer.destroyBillboardBatch(c.batch);
    corpseBatches.length = 0;
    foes.length = 0;
    _owners.clear(); _pupPending.clear(); _pupIndex.clear();   // AUDIT WORLD6b C10: the teardown ends the owners' records too
  }

  /** AUDIT 17e F23: the floating-origin recenter shifts everything. */
  function offsetAll(offset) {
    for (const f of foes) {
      if (!f.ai) continue;
      f.ai.feet[0] += offset[0]; f.ai.feet[1] += offset[1]; f.ai.feet[2] += offset[2];
    }
    // AUDIT 39: the spawns still crossing their awaits move too.
    for (const s of spawning) { s.feet[0] += offset[0]; s.feet[1] += offset[1]; s.feet[2] += offset[2]; }
    for (const c of corpseBatches) {
      c.pos[0] += offset[0]; c.pos[1] += offset[1]; c.pos[2] += offset[2];
      renderer.destroyBatch(c.batch);
      c.batch = renderer.createBillboardBatch(c.archive, c.record, c.size, [c.pos]);
      c.batch.frame = 0;   // FA1 slice 3: a REBUILT batch is a new object - it needs the frame too
    }
  }

  // X9: removeFoe is exported because the creature DISPEL needs the
  // same Destroy(gameObject) the cull and the quest teardown use -
  // gone with no corpse, no loot and no death, which is exactly
  // what DFU's dispel does and why it can break quests.
  /** AUDIT 26 F216: the pool's half of the SAVE ENVELOPE. DFU's
   *  SaveData_v1 carries enemyData for every registered live enemy
   *  wherever the player stands (:865, restored :1006); this pool was
   *  saved NOWHERE, so a quickload during a wilderness ambush - with
   *  the spawn catch-up suppressed across the load - despawned every
   *  attacker: a free escape from any outdoor fight. Positions ride in
   *  NATIVES via `toNative` with the compensation shed by the caller,
   *  the pile envelope's exact law. Dead foes stay out: the exterior
   *  teardown loses corpses on any teleport already, and DFU's own
   *  restore disables a dead record rather than re-minting it. */
  function snapshotWorld(toNative) {
    return foes.filter((f) => !f.dead && !f.puppet).map((f) => {   // WORLD6b: a puppet is its owner's, never this save's
      const wc = toNative(f.ai.feet);
      return {
        mobileType: f.mobileType, gender: f.gender,
        nativeX: wc.x, nativeZ: wc.z, y: f.ai.feet[1], yaw: f.ai.yaw,
        health: f.entity.health, maxHealth: f.entity.maxHealth,
        magicka: f.entity.magicka ?? 0, fatigue: f.entity.fatigue ?? 0,
        items: (f.entity.items ?? []).map((it) => ({ ...it })),
        activeEffects: (f.entity.activeEffects ?? []).map(copyEffectEntry),
        hostile: f.ai.isHostile !== false, encountered: !!f.ai.hasEncounteredPlayer,
        // AUDIT 63 F26: the TEAM, both halves. SerializableEnemy.cs:125
        // `data.team = (int)entity.Team + 1;` (the live EnemyEntity's
        // team) and :121 `data.alliedToPlayer = mobileEnemy.Enemy.Team
        // == MobileTeams.PlayerAlly;` (the per-mobile MobileEnemy
        // STRUCT COPY, which the port spells `entity.mobileTeam`). The
        // pool re-mints through spawnFoe, so without these a Sanguine
        // Rose / Skull of Corruption ally - or any `change foe team`
        // rewrite - came back on its species' static row and turned on
        // the player, with MeleeAttackFriendlyProtection gone with it.
        team: f.entity.team, mobileTeam: f.entity.mobileTeam,
        // AUDIT 63 F29: WabbajackActive (:124, restored :172) - the
        // once-per-creature latch WabbajackEffect.cs:69 refuses on.
        // Re-minting cleared it, so a load re-armed the artifact
        // against a creature it had already scrambled.
        wabbajackActive: !!f.entity.wabbajackActive,
        // AUDIT 63 F27: MobileUnit.SpecialTransformationCompleted
        // (:126, restored :225-228 THROUGH THE SETTER). A Seducer that
        // had already spread its wings came back unwinged - walking
        // where it should fly, the unwinged corpse row, the idle/spell
        // tables back, infighting suppression lost and the one-shot
        // clip able to play a second time.
        specialTransformationCompleted: !!f.mobile?.specialTransformationCompleted,
        // AUDIT 63 F24: the QUEST LINK. SerializableEnemy.cs:116
        // `data.questSpawn = enemy.QuestSpawn;` and :129-133
        // `data.questResource = questResourceBehaviour.GetSaveData();`,
        // restored at :205-218 (re-add the behaviour, RestoreSaveData,
        // and drop it again when the record names no quest). Without
        // it a restored quest foe stands and fights but ticks no task
        // - which is why the interior host's restore below can only
        // suppress the marker walk (GameObjectHelper.cs:1073-1076)
        // once the link travels. Null for an ordinary foe.
        questResource: f.questBehaviour?.getSaveData?.() ?? null,
      };
    });
  }
  /** The restore half: re-mint through the pool's ONE spawn chain,
   *  then overlay the saved truth - SerializableEnemy's own shape
   *  (rebuild, then SetHealth/SetMagicka/... per record). Async, as
   *  the mint is; the caller does not wait on the art. */
  function restoreWorld(saved, fromNative, yOffset = 0, { reviveQuestBehaviour = null } = {}) {
    for (const sf of saved ?? []) {
      const [lx, lz] = fromNative(sf.nativeX, sf.nativeZ);
      // AUDIT 63 F24: SerializableEnemy.cs:205-218 - a saved
      // questSpawn gets its QuestResourceBehaviour back BEFORE the
      // enemy goes live, and a record whose questUID/targetSymbol are
      // empty is left plain (:213-217). The revival needs the quest
      // machine, which this pool has no dep on, so the caller that
      // owns one hands it in; a host without one restores plain foes.
      const questBehaviour = (sf.questResource && reviveQuestBehaviour)
        ? (reviveQuestBehaviour(sf.questResource) ?? null) : null;
      spawnFoe(sf.mobileType, [lx, sf.y + yOffset, lz], { gender: sf.gender, feetGiven: true, questBehaviour }).then((f) => {   // REVIEW 2026-09-05: the snapshot holds FEET - a flyer must not take the centre drop twice
        if (!f) return;
        f.ai.yaw = sf.yaw ?? f.ai.yaw;
        f.entity.maxHealth = sf.maxHealth ?? f.entity.maxHealth;
        f.entity.health = Math.min(sf.health ?? f.entity.health, f.entity.maxHealth);
        if (sf.magicka != null) f.entity.magicka = sf.magicka;
        if (sf.fatigue != null) f.entity.fatigue = sf.fatigue;
        if (sf.items) f.entity.items = sf.items.map((it) => ({ ...it }));
        if (sf.activeEffects) f.entity.activeEffects = sf.activeEffects.map((a) => ({ ...a }));
        if (sf.hostile != null) f.ai.isHostile = !!sf.hostile;
        if (sf.encountered != null) f.ai.hasEncounteredPlayer = !!sf.encountered;
        // AUDIT 63 F26: the two team fields, assigned rather than
        // routed through spawnFoe's `allied` boolean - DFU restores
        // them independently (:157's alliedToPlayer re-seeds the
        // struct copy, :179-181 sets entity.Team to ANY of the twelve
        // MobileTeams, which `change foe X team 5` can produce) and a
        // single boolean cannot carry that. Presence-gated, DFU's own
        // `if (team > 0)` back-compat sentinel (:180).
        if (sf.team != null) f.entity.team = sf.team;
        if (sf.mobileTeam != null) f.entity.mobileTeam = sf.mobileTeam;
        // AUDIT 63 F29: :172's straight assignment, both ways - the
        // record is a boolean from now on, so a BACKWARD load clears a
        // latch raised after the save exactly as the C# does. Only a
        // pre-fix save (no key) leaves the fresh entity's default.
        if (sf.wabbajackActive != null) f.entity.wabbajackActive = !!sf.wabbajackActive;
        // AUDIT 63 F27: :227's SetSpecialTransformationCompleted - the
        // SETTER, never a raw assignment, because the setter is what
        // rewrites the per-mobile basics copy (Flying, the 400/5
        // corpse, no idle, the 0-3 spell frames; Base/MobileUnit.cs
        // :208-224). ai.flies needs no fixup - the pool re-reads
        // basics.behaviour every tick, DFU's live CanFly read.
        if (sf.specialTransformationCompleted && f.mobile) f.mobile.setSpecialTransformationCompleted();
      }).catch((e) => console.error('[encounter] restore failed:', e?.message ?? e));
    }
  }
  /** AR1: BowDamage's non-player arm (EnemyAttack.cs:134-148 with
   *  :303's bowAttack=true) - the host's arrow update calls this when
   *  an enemy shaft contacts a foe. Same shared payload as the melee
   *  foe arm above; the target's own pool owns its death chain
   *  through hurtFromFoe. The arrow is recoverable from the TARGET
   *  (:146-148 - senses.Target.Entity.Items.AddItem), damage or not. */
  function arrowHitFoe(m, target) {
    const f = m.shooterFoe;
    if (!f || f.dead || !target || target.puppet) return;   // AUDIT WORLD6b B8: a foe's shaft into a PUPPET is a ghost hit - nobody's
    const dir = [...m.dir];
    applyDamageToNonPlayer(f, target, {
      weapon: m.weapon, direction: dir, bowAttack: true, rolls, calculateAttackDamage,
      dealDamage: (t, d) => (t.hurtFromFoe ? t.hurtFromFoe(d, dir) : damageFoe(t, d, null, dir)),
      audio, hitEffects,
      // AUDIT 58: the poisoned SHAFT doses its foe mark too - the
      // clear at FormulaHelper.cs:695 fires with or without a hook.
      onInflictPoison: (att, tgt, pt) => inflictPoison(tgt, pt, false, { currentMinute: Math.floor(currentMinute()) }),
      say,   // C-slice: equipment breaks speak (ItemBreaks pops for any owner)
    });
    if (target.entity?.items) {
      addItem(target.entity.items, { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 });
    }
  }

  // ---- WORLD6b: the cell's stream ----------------------------------------------------------------------------
  const q2 = (v) => Math.round(v * 100) / 100;
  const q3 = (v) => Math.round(v * 1000) / 1000;
  /** The world host installs the net: room() (the cell the socket is in), selfId() and peers() (WORLD6b-ii: whose blow a
   *  streamed target names, and MY foes' peer candidates), now() and staleMs (C3), onPeerHit(hit) (a blow on a
   *  puppet, to its owner), toWire(feet) -> the world frame's [x, y, z], toScene([x, y, z]) -> this scene's feet. */
  function setNet(net) { _net = net ?? null; }
  const _now = () => (_net?.now ? _net.now() : Date.now());
  /** My foes out - every one of MINE whose streamed state changed since its last frame (every one when full, so a
   *  dropped frame heals and a foe I culled is missed from the roll and so removed at the peers). A quest's foe is
   *  the quest owner's alone (Multiplayer.md's first lock) and never rides. The record is WORLD2's: i my number for
   *  it, t the species, x the gender bit, f the feet in the world frame, y the yaw, h the health, d dead, a the attack
   *  count with the ranged bit low, m moving. */
  function foesFrame(full = false) {
    if (!_net?.toWire) return null;
    const out = [];
    for (const f of foes) {
      if (f.puppet || f.isQuestFoe || (f.dead && !f.corpse)) continue;
      const w = _net.toWire(f.ai.feet);
      if (!w) continue;
      // WORLD6b-ii: g the target - '.' me, an id a peer, '' none (WORLD3's spelling)
      const _t = f.ai.target, g = _t?.isPeer ? _t.id : (_t == null ? '' : (_t.isPlayer ? '.' : ''));   // AUDIT WORLD6b-ii A8: no target is '' (none) - '.' was the word for a foe that had not stepped yet, and it latched the puppet hostile
      // AUDIT WORLD6b-ii B2/B3: the attacker's terms - its level and its right-hand weapon - so a puppet's blow is this foe's
      const wpn = f.entity.weapon, wd = wpn && Number.isInteger(wpn.templateIndex) ? [wpn.templateIndex, wpn.material | 0] : null;
      const r = { i: f.seq, t: f.mobileType, x: f.gender === 'female' ? 1 : 0, f: [q2(w[0]), q2(w[1]), q2(w[2])], y: q3(f.ai.yaw), h: f.entity.health, d: f.dead ? 1 : 0, a: f._atkA | 0, m: f.ai.moving ? 1 : 0, g, l: f.entity.level | 0, w: wd };
      const key = `${r.f[0]},${r.f[1]},${r.f[2]},${r.y},${r.h},${r.d},${r.a},${r.m},${r.g},${r.l},${wd ? wd.join('/') : '-'}`;
      if (!full && f._sentKey === key) continue;
      f._sentKey = key;
      out.push(r);
    }
    if (!out.length && !full) return null;
    return { n: ++_foesSeq, k: _net.room?.() ?? null, full: full ? 1 : 0, f: out };
  }
  /** The owner's record (AUDIT WORLD6b B4/C3), minted on its first frame. */
  function ownerOf(from) { let o = _owners.get(from); if (!o) { o = { n: -1, at: _now(), gen: ++_ownerGen }; _owners.set(from, o); } return o; }
  const pupKey = (from, i) => `${from}:${i}`;
  /** The puppets standing or building for an owner - the cap's count (B3). */
  function livePuppetsOf(from) {
    let n = 0;
    for (const f of _pupIndex.values()) if (f.puppet === from && !f.dead) n++;
    for (const k of _pupPending.keys()) if (k.startsWith(from + ':')) n++;
    return n;
  }
  /** A peer's foes in - each record PROJECTED (validFoeRecord, AUDIT WORLD6b C2: refused whole otherwise) onto its
   *  puppet; a record for a foe I have no puppet of standing one through the pool's ONE spawn chain (at the streamed
   *  feet, the streamed species and gender; never a corpse I never saw; at most CELL_PUPPETS_MAX live per owner,
   *  B3); a record whose species disagrees, or that says a dead puppet lives, ends the old puppet and stands anew
   *  (B11/B12); a record for a puppet still building is the word that lands when the build does (B13); a full frame
   *  removing every puppet of that owner it no longer names; a frame older than the owner's last, or from another
   *  cell, is not the world. */
  function applyFoes(from, data) {
    if (!_net?.toScene || typeof from !== 'string' || !from || !data || !Array.isArray(data.f)) return false;
    if (data.k != null && _net.room && data.k !== _net.room()) return false;
    const o = ownerOf(from);
    if (Number.isFinite(data.n)) { if (data.n <= o.n) return false; o.n = data.n; }
    o.at = _now();
    const seen = new Set();
    for (const raw of data.f) {
      const r = validFoeRecord(raw);
      if (!r) continue;
      seen.add(r.i);
      const key = pupKey(from, r.i);
      const f = _pupIndex.get(key) ?? null;
      if (f) {
        if ((r.t !== undefined && r.t !== f.mobileType) || (r.d === 0 && f.dead) || (r.l !== undefined && f.mobileType >= 128 && r.l !== (f.entity.level | 0))) removePuppet(f);   // AUDIT WORLD6b-ii B2: a CLASS foe's level is its owner's word (its skills and health are built from it) - a monster's is its species' (makeEnemyEntity), whatever the record says
        else { applyPuppetRecord(f, r); continue; }
      }
      if (_pupPending.has(key)) { _pupPending.set(key, r); continue; }
      if (r.d === 1 || r.t === undefined || !ENEMY_BASICS[r.t] || !r.f) continue;
      if (livePuppetsOf(from) >= CELL_PUPPETS_MAX) continue;
      const feet = _net.toScene(r.f);
      if (!feet) continue;
      _pupPending.set(key, r);
      const gen = o.gen;
      spawnFoe(r.t, feet, { puppet: from, seq: r.i, gender: GENDER_BIT[r.x === 1 ? 1 : 0], feetGiven: true, yaw: r.y ?? null, level: r.l ?? null })
        .then((nf) => {
          if (!nf) return;
          const owner = _owners.get(from);
          if (!owner || owner.gen !== gen) { removePuppet(nf); return; }   // B6: a build the clear or the prune overtook is a ghost - it ends on arrival
          applyPuppetRecord(nf, _pupPending.get(key) ?? r);
        })
        .catch(() => {})
        .finally(() => _pupPending.delete(key));
    }
    if (data.full === 1) for (const f of [..._pupIndex.values()]) if (f.puppet === from && !seen.has(f.seq)) removePuppet(f);
    return true;
  }
  /** One streamed record onto its puppet: the target pose - kept in the WORLD frame and converted every step (AUDIT
   *  WORLD6b C1: the floating origin moves this scene's frame under a cached target, so a standing puppet snapped a
   *  map pixel away at every crossing; a peer's pose is converted every frame for the same reason, AUDIT ONLINE D5),
   *  the health (a drop is the hurt one-shot), the attack once per count (a joiner latches the count it arrives with
   *  and replays nothing), death through the puppet's own fall. */
  function applyPuppetRecord(f, r) {
    const p = f._pup ?? (f._pup = { wire: null, yaw: f.ai.yaw, moving: false, hurt: false, strike: null, a: null, target: null, at: _now(), leap: false });
    if (r.f) {
      // AUDIT WORLD6b-ii C1: a LEAP - farther since the last record than PUPPET_LEAP times the species' own speed could
      // carry it (plus a slack) - lands no blow until the next record walks it; a dropped frame's catch-up is inside the law
      const now = _now(), elapsed = Math.max(0.2, (now - p.at) / 1000);
      if (p.wire) { const d = Math.hypot(r.f[0] - p.wire[0], r.f[1] - p.wire[1], r.f[2] - p.wire[2]); p.leap = d > (f.ai.speed ?? 0) * PUPPET_LEAP * elapsed + PUPPET_LEAP_SLACK; }
      p.at = now;
      p.wire = r.f;
    }
    if (r.w !== undefined) {   // B2: the owner's weapon, rebuilt from the descriptor (no dice: the stack roll is fixed)
      const cur = f.entity.weapon;
      if (r.w === null) { if (cur) f.entity.weapon = null; }
      else if (!cur || cur.templateIndex !== r.w[0] || (cur.material | 0) !== r.w[1]) f.entity.weapon = createWeapon(r.w[0], r.w[1], () => 0.5);
    }
    if (r.g !== undefined) p.target = r.g;   // WORLD6b-ii: whose blow this puppet's is
    if (r.y !== undefined) p.yaw = r.y;
    if (r.m !== undefined) p.moving = r.m === 1;
    if (r.h !== undefined) { if (r.h < f.entity.health) p.hurt = true; f.entity.health = r.h; }
    if (r.a !== undefined) { if (p.a != null && r.a !== p.a) p.strike = (r.a & 1) ? 'ranged' : 'melee'; p.a = r.a; }
    if (r.d === 1 && !f.dead) { const t = p.wire ? _net.toScene(p.wire) : null; if (t) { f.ai.feet[0] = t[0]; f.ai.feet[1] = t[1]; f.ai.feet[2] = t[2]; } puppetDie(f); }
  }
  /** One puppet frame: the eased pose (toward the streamed feet in THIS frame's coordinates), the walk, the hurt, the
   *  strike edge; the mobile's damage latches are the caller's to drop (a puppet lands no blow). */
  function puppetStep(f, dt) {
    const p = f._pup;
    let edge = false;
    f._pupTarget = null; f._pupMine = false;
    if (!p) { f.ai.moving = false; f.ai.hurtKnock = false; return false; }
    // WORLD6b-ii (WORLD3's law): whose blow this puppet's is - the streamed target ('.' its owner, an id a peer, ''
    // none), and whether it is ME: then the mobile's damage frame and its shoot marker are mine to resolve
    f._pupTarget = p.target === '.' ? f.puppet : (p.target || null);
    const me = _net?.selfId?.() ?? null;
    f._pupMine = f._pupTarget != null && me != null && f._pupTarget === me && peerCandidate(f.puppet) != null;   // AUDIT WORLD6b-ii C2: and its OWNER is a peer the hunt sees (visible: a pose, in range, inside the timeout) - one liveness for the hunt and the blow
    if (f._pupTarget != null && f.ai.isHostile === false) f.ai.isHostile = true;   // B9: a guard - this pool never pacifies a puppet; the dungeon's castle guard is the case
    const feet = f.ai.feet, t = p.wire ? _net.toScene(p.wire) : null;
    let d2 = 0;
    if (t) {
      const dx = t[0] - feet[0], dy = t[1] - feet[1], dz = t[2] - feet[2];
      d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > PUPPET_SNAP * PUPPET_SNAP) { feet[0] = t[0]; feet[1] = t[1]; feet[2] = t[2]; }
      else { const k = Math.min(1, dt / PUPPET_EASE_S); feet[0] += dx * k; feet[1] += dy * k; feet[2] += dz * k; }
    }
    f.ai.yaw = p.yaw;
    f.ai.moving = p.moving || d2 > PUPPET_STILL * PUPPET_STILL;
    f.ai.hurtKnock = p.hurt; p.hurt = false;
    if (p.strike != null) { edge = true; if (f.attack) f.attack.firedRanged = p.strike === 'ranged'; p.strike = null; }
    return edge;
  }
  /** A puppet's death: the body where its owner's stream let it fall, no loot of this player's, no kill notice, no
   *  alert - the owner's world says those to the owner. */
  function puppetDie(f) {
    if (f.dead) return;
    if (f._pupMine && f.ai?.detected) setEnemyAlert(playerEntity, false);   // AUDIT WORLD6b-ii B6: its owner's foe was on me; the alert clears as a foe of mine would (survivors re-raise it)
    f.dead = true;
    f.corpse = true;
    releaseFoeBatch(f);
    mintCorpse(f);
  }
  /** A puppet gone: its owner's roll no longer names it, its owner left the cell or went quiet, or the room changed.
   *  AUDIT WORLD6b B5/B7: the record ENDS here - spliced out of the roll (a flag left it standing for the next frame,
   *  where the owner's next record re-adopted the corpse-less dead and stood nothing), its body with it, a body still
   *  loading refused on arrival (`_gone`). */
  function removePuppet(f) {
    f._gone = true;
    if (f._pupMine && !f.dead && f.ai?.detected) setEnemyAlert(playerEntity, false);   // B6
    releaseFoeBatch(f);
    if (f.corpseMarker) { const i = corpseBatches.indexOf(f.corpseMarker); if (i >= 0) { renderer.destroyBillboardBatch(corpseBatches[i].batch); corpseBatches.splice(i, 1); } }
    f.dead = true; f.corpse = false; f.corpseMarker = null;
    _pupIndex.delete(pupKey(f.puppet, f.seq));
    const i = foes.indexOf(f); if (i >= 0) foes.splice(i, 1);
  }
  /** A peer's blow on MY foe, through the one damage door with the peer's number and kind (the striker's feet
   *  unknown to it: the aggro turns toward me, its owner - recorded); keyed to the cell as the frame is (AUDIT
   *  WORLD6b A7). */
  function applyHit(from, data) {
    if (!data || typeof data !== 'object') return false;
    if (data.k != null && _net?.room && data.k !== _net.room()) return false;
    const f = foes.find((x) => !x.puppet && x.seq === (data.i | 0));
    const dmg = Number(data.dmg);
    if (!f || f.dead || !Number.isFinite(dmg) || dmg < 0 || dmg > 10000) return false;
    const kind = data.kind === 'arrow' || data.kind === 'spell' ? data.kind : 'melee';
    // WORLD6b-ii: the striker's feet (p, the world frame - bounded as a pose is, then this scene's) and the blow's
    // direction (d, a spell knocks nothing, verbatim). AUDIT WORLD3 F2's law: a direction is a UNIT vector or it is
    // nothing, a position outside the pose's bounds is nothing
    const v3 = (v) => (Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? [v[0], v[1], v[2]] : null);
    const unit = (v) => { const u = v3(v); if (!u) return null; const L = Math.hypot(u[0], u[1], u[2]); return L > 1e-6 && L < 1e6 ? [u[0] / L, u[1] / L, u[2] / L] : null; };
    const pw = v3(data.p);
    const at = pw && Math.abs(pw[0]) <= POSE_BOUND && Math.abs(pw[2]) <= POSE_BOUND && Math.abs(pw[1]) <= POSE_Y_BOUND && _net?.toScene ? _net.toScene(pw) : null;
    const dir = kind === 'spell' ? null : unit(data.d);
    // AUDIT WORLD2 B8/C4's law: the blow is seen and heard at the owner too - the hit's ring, the blood, the pain
    if (dmg > 0) {
      audio?.play3d?.(hitSoundFor(null), f.ai.feet, ENEMY_HIT_VOLUME, { maxDistance: 16 });
      hitEffects?.showBloodSplash(ENEMY_BASICS[f.mobileType]?.bloodIndex ?? 0, bloodCentre(f.ai.feet, f.ai.height));
      const pain = enemyPainVoice(f, dmg);
      if (pain && pain.clip >= 0) audio?.play3d?.(pain.clip, [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16, pitch: 1 + pain.pitchLift });
    }
    damageFoe(f, dmg, at, dir, { fromPlayer: true, kind, peer: true, peerId: from });
    return true;
  }
  /** The owners gone from the cell (the session's peer map no longer holds them) or gone quiet (no frame in staleMs,
   *  AUDIT WORLD6b C3) - their puppets swept and their records ended, so a returning owner numbers from one again (B4). */
  function pruneOwners(alive, now = _now()) {
    for (const [from, o] of [..._owners]) {
      if (alive.has(from) && !(_net?.staleMs > 0 && now - o.at > _net.staleMs)) continue;
      for (const f of [..._pupIndex.values()]) if (f.puppet === from) removePuppet(f);
      _owners.delete(from);
    }
  }
  /** A room change: every puppet is the old cell's, every owner's record too. */
  function clearPuppets() {
    for (const f of [..._pupIndex.values()]) removePuppet(f);
    _owners.clear();
    _pupPending.clear();
  }

  return { foes, spawnFoe, damageFoe, handleAttackFromPlayer, attackFromPlayer, update, resolvePlayerHit, batches, offsetAll, activeCount, lootTargets, takeLoot, snapshotWorld, restoreWorld, destroy,
    /** AUDIT 39: CleanupUntrackedObjects' enemy half (StreamingWorld.cs
     *  :1624-1635), which a teleport reaches too through
     *  ClearStreamingWorld -> CollectLooseObjects(true) (:993-998) -
     *  loose enemies survive neither a load nor a fast travel.
     *  collectPixel frees only CORPSES, so a quickload used to spawn
     *  the save's copies on top of the live fight. The teardown above
     *  is exactly that destroy and it is idempotent and reusable; this
     *  is the name the world host's teleport asks for it by. */
    clearLive: destroy,
    collectPixel, arrowHitFoe, removeFoe: questPoolOps.removeFoe,
    // WORLD6b: the cell's stream - the net installed, my foes out, a peer's in, a peer's blow in, the puppets pruned
    setNet, foesFrame, applyFoes, applyHit, pruneOwners, clearPuppets };
}
