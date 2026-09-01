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
import { lycanthropeAttackVoice } from '../systems/lycanthropy.js';   // V4: the beast's attack voice
import { copyEffectEntry } from '../systems/save.js';   // AUDIT 26 F216: the caster-stripping effect copy, one home
import { EnemyAI, isBackFacing, withinYaw } from '../characters/enemyMotor.js';
import { runTargetMachine, isPlayerTarget, resetAllyTeamOnPlayerAttack, PLAYER_TARGET } from '../characters/enemyTargets.js';   // MT-ii
import { FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE } from '../player/motor.js';   // CH3: the shared fall formula
import { SOUND } from '../systems/soundClips.js';   // CH3: the FallDamage clip
import { EnemyCaster, castEnemySpell, hasRangedSpell } from '../characters/enemyCasting.js';   // X3: the shared decision + the ONE cast executor
import { assignEnemySpells, SPELL_CAST_SOUND } from '../systems/enemySpells.js';   // X3
import { applySpell, maxFatigue, entityIsParalyzed, applyEnemyMotorEffectFlags, concealmentFlags, isMagicallyConcealed } from '../systems/effects.js';   // X3: self-casts land through the effect spine   // A5: the enemy Levitate arm, the foe-target concealment closure + EntityConcealmentBehaviour's visual
import { calculateCastCost } from '../systems/spellcost.js';   // X3: costs priced off the player (magic-15 note)
import { silenceBlocksCast, attemptSoulTrap, SOUL_TRAP_TEXT, fillEmptyTrap } from '../systems/mysticism.js';   // X3: the enemy silence gate; X5: the soul trap's kill intercept
import { isAzurasStarEquipped } from '../systems/artifactEffects.js';   // V3: the Star's kill capture
import { EnemyAttack } from '../characters/enemyAttack.js';
import { makeEnemyEntity, loadMonsterCareer } from '../characters/enemyEntity.js';
import { MobileUnit, MOBILE_DAEDRA_SEDUCER, SeducerTransformBehaviour } from '../characters/mobileUnit.js';   // A5: the Seducer transform pair + its trigger
import { ClassFile } from '../formats/classFile.js';
import { equipEnemy, hasBowAttack, backstabChanceOf, zeroDamageHitSound, enemyMissSound, enemyAttackVoice, enemyPainVoice, playerAttackGrunt, tickEnemySound, playEnemyClip, tryLanguagePacification, applyDamageToNonPlayer } from './hostCombat.js';   // C2-slice (combat-9/17); MT-ii: the foe-vs-foe payload
import { generateItems as generateLootItems, addEnemyLootExtras } from '../systems/loot.js';   // AUDIT 24 (wave 43)
import { calculateAttackDamage, meleeHitConnects, MELEE_HIT_YAW_DEG, chooseEnemyWeapon, enemyWeightClassicUnits, weaponKnockbackSpeed, weaponKnockbackApplies, enemyLanguageSkill, calculateEnemyPacification } from '../combat/formulas.js';   // AUDIT 24 (wave 42): pacification
import { tallySkill, SKILLS } from '../systems/skills.js';
import { liveStat } from '../systems/statMods.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { rand } from '../formats/dfRandom.js';
import { setEnemyAlert } from '../systems/encounters.js';
import { inflictPoison } from '../systems/poisons.js';
import { onMonsterHit, SPIDER_TOUCH_SPELL_INDEX } from '../systems/diseases.js';   // AUDIT 24 (wave 30): the monster special-attack rider, above ground
import { MINUTES_PER_DAY } from '../systems/worldTick.js';
import { mintCorpseMarker, playBodyFall, corpseLootTargets, takeCorpseLoot, sayEnemyDied } from './corpseMarker.js';
import { bloodCentre } from './hitEffects.js';   // AUDIT 24 (wave 39): EnemyBlood.ShowBloodSplash
import { addItem } from '../systems/inventory.js';   // AR1: BowDamage's recoverable arrow, in the TARGET's items
import { EnemySoundSource, acuteHearingMultiplier } from '../characters/enemySounds.js';   // AUDIT 24 (wave 41): EnemySounds.cs, one home
import { flashPlayerDamage } from '../ui/damageFlash.js';   // AUDIT 24 (wave 39): ShowPlayerDamage   // AUDIT 24 (wave 38): EnemyDeath's one home
import { bindQuestFoeHost } from './questFoeHost.js';   // B1: quest foes ride this pool

// The port's allocation-owner guards (classic self-limits through the
// 144-minute cadence; these keep a long session bounded).
export const MAX_ACTIVE_ENCOUNTER_FOES = 8;
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

  const activeCount = () => foes.filter((f) => !f.dead).length;

  /** One encounter foe at a world position - the dungeon load chain's
   *  shape, host-owned. B1 opts: a QUEST foe rides the same chain -
   *  `gender` forces the Foe resource's own humanoid gender (else the
   *  pool's 0.5 roll stands), `yaw` faces the spawn (CreateFoe's
   *  LookAt player, :328), `questBehaviour` binds the
   *  QuestResourceBehaviour host at the stand. A quest foe is exempt
   *  from the encounter self-limit: DFU's CreateFoe spawns
   *  unconditionally, and the cap is the port's own encounter bound,
   *  not a law. */
  async function spawnFoe(mobileType, pos, { gender: forcedGender = null, yaw = null, questBehaviour = null, allied = false } = {}) {
    if (!questBehaviour && activeCount() >= MAX_ACTIVE_ENCOUNTER_FOES) return null;
    const basics = ENEMY_BASICS[mobileType];
    if (!basics || !basics.maleTexture) return null;
    const pending = { feet: [pos[0], pos[1] + 0.1, pos[2]] };   // AUDIT 39: shifted by offsetAll until the record lands
    spawning.push(pending);
    const gen = epoch;   // AUDIT-39r: the world this foe is being built for
    try {
      const isClass = mobileType >= 128;
      const career = isClass
        ? (() => { const cf = new ClassFile(); return fetchBytes(`CLASS${String(mobileType - 128).padStart(2, '0')}.CFG`).then((b) => { cf.load(b); return cf.career; }); })()
        : loadMonsterCareer(mobileType, fetchBytes);
      const entity = makeEnemyEntity(mobileType, basics, await career, playerEntity.level);
      // MT-ii: an ALLIED summon (Sanguine Rose / Skull of Corruption).
      // SetupDemoEnemy.cs:85-86 overwrites the MobileEnemy STRUCT COPY
      // before SetEnemy, and EnemyEntity.cs:316 seeds Entity.Team from
      // that copy - so BOTH per-instance fields turn, and the shared
      // frozen basics row (the STATIC table the ally-revert reads)
      // does not. Getting that wrong would ally every foe of the type.
      if (allied) { entity.team = 'PlayerAlly'; entity.mobileTeam = 'PlayerAlly'; }
      entity.items = generateLootItems(basics.lootTableKey ?? '-', { level: playerEntity.level, gender: playerEntity.gender });
      equipEnemy(entity, mobileType, playerEntity.level);
      addEnemyLootExtras(entity.items, basics, rolls);   // AUDIT 24 (wave 43): EnemyEntity.cs:388-397, after the equipment as DFU has it
      // NT2 (F210): GetTextureArchive's gender arm - a DFRandom draw off
      // the shared stream (Ledger A: a DFRandom site never rides the
      // injectable roll), humans only; monsters read the male texture.
      const gender = MobileUnit.resolveGender(forcedGender ?? 'unspecified', basics);
      const behaviour = basics.behaviour ?? 'General';
      const ai = new EnemyAI(collider, pending.feet, yaw ?? rolls() * Math.PI * 2, {
        liveSpeed: () => liveStat(entity, 'speed'),   // AUDIT 39: EnemyMotor.cs:432 re-reads LiveSpeed per FixedUpdate
        seesThroughInvisibility: basics.seesThroughInvisibility ?? false,
        behaviour, mobileId: mobileType,
        playerInside: false,   // the exterior despawn band (EnemySenses.cs:269)
        // wave 35: DoRangedAttack's band - a shooter inside 6..51.2 with
        // the target in sight stands off instead of closing.
        hasBowAttack: hasBowAttack(basics),
        canCastRangedSpell: () => hasRangedSpell(entity),
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
      if (sbi) assignEnemySpells(entity, sbi);
      const caster = entity.spells?.length ? new EnemyCaster(entity, rolls) : null;
      const archive = gender === 'female' ? basics.femaleTexture : basics.maleTexture;
      const tex = await getTexture(archive);
      // AUDIT-39r: a sweep crossed this spawn - the world it was built
      // for is gone, and pushing it now would land a departure-point
      // foe in the destination pixel beside restoreWorld's copies.
      // Nothing is allocated yet, so dropping the record is the whole
      // cancel; the caller already reads null as "no foe stood".
      if (gen !== epoch) return null;
      const mobile = new MobileUnit(mobileType, basics, (rec) => tex.getFrameCount(rec), Math.random, gender);
      const batch = renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]);
      const f = { mobile, ai, attack, entity, caster, batch, tex, archive, mobileType, gender, dead: false, _encounter: true, _prevMState: 'Idle', _mout: null,
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
      if (f.dead) return;
      releaseFoeBatch(f);
      f.dead = true;
      f.questBehaviour?.notifyDestroyed();
    },
    zeroFoeHealth: (f) => { if (!f.dead) damageFoe(f, f.entity.health, null, null); },
    spellsByIndex: () => spellsByIndex?.(),
    foeSinks: (f) => foeSinks(f),
    rolls,
  };

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
      noSpellPointCost, playerEntity, playerFeet,
      applySpell, foeSinks, calculateCastCost, silenceBlocksCast,
      playCastSound: (element, from) => audio?.play3d?.(SPELL_CAST_SOUND[element] ?? SPELL_CAST_SOUND[4], from, 1, { maxDistance: 16 }),
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
  function damageFoe(f, damage, playerFeet, knockDir = null, { fromPlayer = true } = {}) {
    markFoeStruck(f, { fromPlayer });   // PX30: the enhanced HUD's target frame
    if (fromPlayer && f.ai) {
      // ROAD-B: DaggerfallEntityBehaviour.cs:255-258 sits BEFORE the
      // call below and is a different law - the whole area turns, this
      // one foe additionally learns where the blow came from. The
      // `!isHostile` read must precede the walk, which flips this foe
      // too.
      if (!f.ai.isHostile) makeAreaHostile?.();
      f.ai.makeEnemyHostileToAttacker?.(PLAYER_TARGET, playerFeet ?? null);   // wave 36: seeded with where the attack came from
      resetAllyTeamOnPlayerAttack(f.ai, f.entity, f.mobileType);
    }
    f.entity.health -= damage;
    if (f.entity.health <= 0) {
      // X5: the SOUL TRAP intercept, where EnemyEntity.SetHealth's
      // override sits (:157-177) - before the death, every source alike.
      const trap = attemptSoulTrap(f.entity, f.mobileType, playerEntity.items, Math.random());
      if (trap.alert) say?.(SOUL_TRAP_TEXT[trap.alert]);
      if (!trap.allowDeath) { f.entity.health = 1; return; }
      // V3: the equipped AZURA'S STAR takes every slain MONSTER's soul
      // (DaggerfallEntityBehaviour.cs:240-247); after the trap, so a
      // trap-filled Star is no longer empty; classes have no soul.
      if (f.mobileType < 128 && isAzurasStarEquipped(playerEntity)
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
      if (isPlayerTarget(f.ai?.target) && f.ai?.detected) setEnemyAlert(playerEntity, false);
      sayEnemyDied(say, f.mobileType);   // EnemyDeath:79-83, the kill notice
      // AUDIT 24 (wave 38): EnemyDeath.CompleteDeath, through the one
      // home. This pool minted the marker inline at f.ai.feet - so a
      // flying encounter foe left its corpse hanging in the air where
      // it died, where DFU drops it at FindGroundPosition (:817) - and
      // nothing ever played BodyFall (:126-129).
      // TrackLooseObject runs INSIDE CreateEnemyCorpseMarker, so the
      // pixel is read at the death, not when the texture lands.
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
        fallbackSize: scaledBillboardSize(f.tex.getSize(0), f.tex.getScale(0)),
        stillDead: () => f.dead,
      }).then((c) => {
        if (!c) return;
        // AUDIT-39r: the sweep took this pool's world while the marker
        // was still loading its art. Its pixelKey would be the
        // departure pixel, which the teleport has already torn down -
        // so collectPixel could never reach the batch again and it
        // would draw at the departure position for the session.
        if (_corpseGen !== epoch) { renderer.destroyBillboardBatch(c.batch); return; }
        f.corpseMarker = c;   // the loot seam reads the GROUND position from here
        // TrackLooseObject's stamp: the streamer's pixel at the death,
        // not the corpse's own position.
        c.pixelKey = f.corpsePixelKey = _corpsePixel;
        corpseBatches.push(c);
        playBodyFall(audio, c.pos);
      }).catch(() => {});
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
      targeting: (ai, pf, cdt) => runTargetMachine(f, senses.candidates(), pf, cdt, {
        playerEntity: senses.playerEntity ?? null,
      }),
    };
  }
  /** The feet the ATTACK and CAST components must aim at: DFU's
   *  components read senses.Target, not the player (EnemyAttack.cs:
   *  199-209). Unarmed, or with the player selected, this is the
   *  player's own feet and nothing changes. */
  function _targetFeet(f, playerFeet) {
    const t = f.ai.target;
    if (t == null) return f.ai._armedTargeting ? null : playerFeet;
    return isPlayerTarget(t) ? playerFeet : t.ai.feet;
  }

  function update(dt, playerFeet, eye, senses = {}) {
    for (const f of foes) {
      // B1: the QuestResourceBehaviour drives every frame the object
      // lives (Unity Update on the component) - BEFORE the dead skip,
      // because the kill credit lands on the update AFTER health hit
      // zero (the injured-check return holds death to the next tick),
      // and a corpse's component still runs in DFU.
      f.questBehaviour?.update();
      if (f.dead) continue;
      // AUDIT 24 (wave 32): PARALYSIS. This pool passed the literal `false`
      // for the motor's paralyzed argument and ran the attack machine
      // unconditionally, so a paralysed encounter foe kept walking and kept
      // swinging - and, until wave 32 gave the pool its magic rounds, the
      // paralysis never expired either. EnemyMotor.HandleParalysis
      // (:247-260) drops CanAct, and EnemyAttack returns at the top of both
      // its Update (:91-94) and its FixedUpdate (:55-57).
      const _fParalyzed = entityIsParalyzed(f.entity);   // S22: the FreeAction read-time fold
      applyEnemyMotorEffectFlags(f.ai, f.entity);   // A5: Levitate.SetEnemyMotor's IsLevitating, folded from the effect's presence
      f.ai.update(dt, playerFeet, _armed(f, senses), _fParalyzed);
      // MT-ii: the foe now aims at whatever it SELECTED - the player
      // (the only candidate in an unarmed host) or another enemy.
      const _tgt = _targetFeet(f, playerFeet);
      // CH3 (characters-8): a past-threshold landing bills the fall
      // formula through the pool's damage door - no knockback.
      if (f.ai.landedFall > 0 && !f.dead) {
        const fdmg = Math.trunc(FALL_HP_PER_METRE * (f.ai.landedFall - FALL_DAMAGE_THRESHOLD));
        f.ai.landedFall = 0;
        if (fdmg > 0) {
          audio?.play3d?.(SOUND.FallDamage, [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]], 1, { maxDistance: 16 });
          // EnemyMotor.cs:1404-1407 - index 0, at `transform.position`.
          // Its comment says "falling enemies bleed at the center",
          // but transform.position on a CharacterController IS the
          // base; the centre is `+ controller.center`, which this line
          // does not add. The feet are what DFU passes, so the feet are
          // what the port passes.
          hitEffects?.showBloodSplash(0, [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]]);
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
      if (_playerDist > ENCOUNTER_CULL_DISTANCE && !f.ai.detected) {
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
      if (isPlayerTarget(f.ai.target) && f.ai.inSight && f.ai.detected) setEnemyAlert(playerEntity, true, currentMinute());
      f.mobile.frameSpeedDivisor = Math.max(1, Math.trunc((f.entity.stats?.speed ?? 50) / Math.max(8, liveStat(f.entity, 'speed'))));
      if (!_fParalyzed && _tgt) f.attack.update(dt, f.ai, _tgt);   // MT-ii: at the SELECTED target (:199-209)
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
      const _castTargetEntity = isPlayerTarget(f.ai.target) || !f.ai._armedTargeting
        ? playerEntity : (f.ai.target?.entity ?? playerEntity);
      if (_tgt && f.caster && !_fParalyzed && f.ai.isHostile) {
        const dec = f.caster.update(dt, f.ai, f.attack, _tgt, _castTargetEntity);
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
      // PlayAttackSound at the START of the swing, as the dungeon does
      // (MeleeAnimation fires it once on the edge, not at the hit).
      if (strikeEdge) playEnemyClip(audio, f.sounds.attack(), f.ai.feet, acuteHearingMultiplier(playerEntity));   // CF1: acute hearing
      // A5 - DaedraSeducerMobileBehaviour.Update (the dungeon pool's
      // law, one spelling): a MonoBehaviour Update that runs BEFORE
      // the anim step consumes the state it raises, keyed on
      // `enemySenses.Target == PlayerEntityBehaviour`.
      f.seducer?.update(dt, isPlayerTarget(f.ai.target) || !f.ai._armedTargeting);
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
          const fwpn = chooseEnemyWeapon(f.entity.weapon, ENEMY_BASICS[f.mobileType]);
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
            });
          } else {
            audio?.play3d?.(enemyMissSound(fwpn), [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16 });
          }
          const fv = enemyAttackVoice(f);   // :216-226 fires whatever the target
          if (fv && fv.clip >= 0) audio?.play3d?.(fv.clip, [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16 });
          continue;   // the player arm below is the ELSE
        }
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
        if (v && v.clip >= 0) audio?.play3d?.(v.clip, mid, 1, { maxDistance: 16 });
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
        const from = [f.ai.feet[0], f.ai.feet[1] + 1.2, f.ai.feet[2]];
        const d = [_tgt[0] - from[0], _tgt[1] + 0.9 - from[1], _tgt[2] - from[2]];
        const l = Math.hypot(...d) || 1;
        onArrow(from, [d[0] / l, d[1] / l, d[2] / l], f);
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
      const c = [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]];
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
    if (grunt && grunt.clip >= 0) audio?.playOneShot?.(grunt.clip, 1);
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
        if (pain && pain.clip >= 0) audio?.play3d?.(pain.clip, [foe.ai.feet[0], foe.ai.feet[1] + 0.9, foe.ai.feet[2]], 1, { maxDistance: 16 });
        damageFoe(foe, damage, playerFeet, lookDir);
      } else {
        const snd = zeroDamageHitSound({
          weapon: playerWeapon.weapon, arrowHit: false,
          parrySounds: !!ENEMY_BASICS[foe.mobileType]?.parrySounds, roll: rolls(),
        });
        if (snd?.at === 'enemy') audio?.play3d?.(snd.sound, foe.ai.feet, 1.1, { maxDistance: 16 });
        else if (snd) audio?.playOneShot?.(snd.sound, 1.1);
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
      isCorpse: (f) => !!f.corpse && !!f.entity,
      // the GROUND position the marker landed on, not where the foe
      // died - a flyer's body is metres below its last feet.
      feetOf: (f) => f.corpseMarker?.pos ?? f.ai?.feet ?? null,
    });
  }
  function takeLoot(key, say2 = () => {}) {
    return takeCorpseLoot(foes[Number(key.split(':')[1])], playerEntity, say2);
  }

  /** Live sprite + corpse batches for the draw - the guard shape:
   *  record/size/origin mutate per frame, frames upload lazily. */
  function batches() {
    const out = [];
    for (const f of foes) {
      if (f.dead || !f._mout) continue;
      // A5 - EntityConcealmentBehaviour.Update/MakeConcealed
      // (:36-43, :56-62): "Handles magical concealment for entities
      // other than player". A non-player entity whose
      // IsMagicallyConcealed is true has its renderer DISABLED - any
      // of the six flags, normal or true power. The entity keeps
      // acting, it simply is not drawn. (The player's own concealment
      // has no visual: DFU never disables the first-person view.)
      if (isMagicallyConcealed(f.entity)) continue;
      const o = f._mout;
      const rkey = `${o.record}#${o.frame}`;
      if (!renderer.textures.has(`${f.archive}_${rkey}`)) uploadRecordFrame(f.archive, o.record, o.frame);
      const sz = scaledBillboardSize(f.tex.getSize(o.record), f.tex.getScale(o.record));
      f.batch.record = rkey;
      f.batch.size = { w: o.flip ? -sz.w : sz.w, h: sz.h };
      f.batch.origin = f.ai.feet;
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
    return foes.filter((f) => !f.dead).map((f) => {
      const wc = toNative(f.ai.feet);
      return {
        mobileType: f.mobileType, gender: f.gender,
        nativeX: wc.x, nativeZ: wc.z, y: f.ai.feet[1], yaw: f.ai.yaw,
        health: f.entity.health, maxHealth: f.entity.maxHealth,
        magicka: f.entity.magicka ?? 0, fatigue: f.entity.fatigue ?? 0,
        items: (f.entity.items ?? []).map((it) => ({ ...it })),
        activeEffects: (f.entity.activeEffects ?? []).map(copyEffectEntry),
        hostile: f.ai.isHostile !== false, encountered: !!f.ai.hasEncounteredPlayer,
      };
    });
  }
  /** The restore half: re-mint through the pool's ONE spawn chain,
   *  then overlay the saved truth - SerializableEnemy's own shape
   *  (rebuild, then SetHealth/SetMagicka/... per record). Async, as
   *  the mint is; the caller does not wait on the art. */
  function restoreWorld(saved, fromNative, yOffset = 0) {
    for (const sf of saved ?? []) {
      const [lx, lz] = fromNative(sf.nativeX, sf.nativeZ);
      spawnFoe(sf.mobileType, [lx, sf.y + yOffset, lz], { gender: sf.gender }).then((f) => {
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
    if (!f || f.dead || !target) return;
    const dir = [...m.dir];
    applyDamageToNonPlayer(f, target, {
      weapon: m.weapon, direction: dir, bowAttack: true, rolls, calculateAttackDamage,
      dealDamage: (t, d) => (t.hurtFromFoe ? t.hurtFromFoe(d, dir) : damageFoe(t, d, null, dir)),
      audio, hitEffects,
    });
    if (target.entity?.items) {
      addItem(target.entity.items, { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 });
    }
  }

  return { foes, spawnFoe, damageFoe, update, resolvePlayerHit, batches, offsetAll, activeCount, lootTargets, takeLoot, snapshotWorld, restoreWorld, destroy,
    /** AUDIT 39: CleanupUntrackedObjects' enemy half (StreamingWorld.cs
     *  :1624-1635), which a teleport reaches too through
     *  ClearStreamingWorld -> CollectLooseObjects(true) (:993-998) -
     *  loose enemies survive neither a load nor a fast travel.
     *  collectPixel frees only CORPSES, so a quickload used to spawn
     *  the save's copies on top of the live fight. The teardown above
     *  is exactly that destroy and it is idempotent and reusable; this
     *  is the name the world host's teleport asks for it by. */
    clearLive: destroy,
    collectPixel, arrowHitFoe, removeFoe: questPoolOps.removeFoe };
}
