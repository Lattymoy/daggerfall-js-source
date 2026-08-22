// Shared dungeon build for scene transitions (P5): lay a location's
// dungeon out against a HOST scene's caches and return everything the
// host needs to render and crawl it. Semantics match the standalone
// dungeon scene (M6/R6/R7/R11/P2) with one mechanical difference: the
// per-dungeon texture table is applied as a DRAW-TIME texRemap instead
// of rewriting submesh archives at model build - the host's mesh cache
// serves exteriors too and must stay untouched. UVs therefore keep
// original-archive sizes while pixels come from the table archive,
// which is exactly the dungeon convention already on record.

import { FlatAnimator, armFlatAnim, MISSILE_FPS } from '../render/flatAnimation.js';   // FA1: the flats that move
import { layoutDungeon } from '../world/dungeonLayout.js';
import { applyTextureTable } from '../world/dungeonTextures.js';
import { collectDungeonLights } from '../world/dungeonLights.js';
import { CityLightAnimator, MINUTES_PER_DAY } from '../world/worldClock.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { MobileUnit } from '../characters/mobileUnit.js';   // C11: classic sprite monsters
import { dfMeshToModel, GLOBAL_SCALE } from '../world/meshReader.js';
import { RDB_SIDE } from '../world/rdbLayout.js';
import { EFFECT_ACTION_FLAGS, COLLISION_TIMEOUT_S, DOOR_VERB_FLAGS, classifyPlacementAction, lookAtLockText } from '../world/actionSystem.js';
import { TextRsc } from '../formats/textRsc.js';
import { ActionTextBox, ActionInputBox } from '../ui/actionText.js';
import { playerEntity, surfacePlayer, hurtPlayer as hurtEntity, setDeathPresenter } from '../characters/playerEntity.js';
import { addItem, removeOne } from '../systems/inventory.js';
import { worldAabb } from '../player/activate.js';
import { createWeaponRig, envAttack } from '../combat/weaponRig.js';   // C10: the shared FP-weapon surface
// U26: this host's own equip hook is retired - the native inventory
// window owns equipping, the career gate (S23) and the paperdoll, so
// the duplicate pair here had nothing left to serve. AUDIT 17e F17's
// point stands and is now made in ONE place instead of two.
import { loadHud, drawHud, hudScale as hudScaleFor } from '../ui/hud.js';
import { drawText, makeFont } from '../ui/text.js';
import { HudText } from '../ui/hudText.js';
import { OneShotLatch } from '../ui/input.js';
import { FntFile } from '../formats/fntFile.js';
import { ImgFile } from '../formats/imgFile.js';
import { createWeapon } from '../combat/enemyEquipment.js';
import { SWING_MODS } from '../combat/playerWeapon.js';   // CalculateSwingModifiers, read live at the arrow's impact
import {
  equipEnemy, hasBowAttack, attackSkillOf, isBowWeapon, backstabChanceOf,
  tallySwingSkills, zeroDamageHitSound, SWING_WEAPON_FATIGUE_LOSS,
  CORPSE_ACTIVATION_DISTANCE,
  enemyMissSound, enemyAttackVoice, enemyPainVoice, playerAttackGrunt,   // C2-slice (combat-9/17)
  tickEnemySound, playEnemyClip,   // AUDIT 24 (wave 41): EnemySounds through the host's devices
  tryLanguagePacification,         // AUDIT 24 (wave 42): EnemySenses:504-527
} from './hostCombat.js';   // AUDIT 18: the laws every host must share
import { createCharacter, CLASS_CAREERS } from '../systems/chargen.js';
import { createChargenFlow, finishChargen, applyHeadlessChargen, applyCreationExtras } from '../systems/chargenSession.js';   // S3c/U9 + 17i: one construction seam
import { preloadChargenArt, stopConstellationAnim } from '../ui/chargenArt.js';   // U10
import { preloadMessageBoxArt } from '../ui/messageBox.js';   // U11
import { ChargenFlow } from '../ui/chargen.js';
import { LevelUpScreen, CharSheet, preloadCharSheetArt } from '../ui/charsheet.js';
import { charSheetHooks } from '../ui/charSheetNav.js';   // U32: the sheet's four navigation buttons
import { SpellbookWindow, DeathScreen, knownSpells } from '../ui/inventory.js';
// U26: the dungeon finally gets the SAME inventory window the exterior
// hosts have had since U8d - tabs, paperdoll, the real info panel and
// point-and-click Use. The keyed InventoryWindow it used until now is
// retired from this host.
import { NativeInventoryWindow, preloadInventoryArt, WAGON_ACCESS_DISTANCE } from '../ui/nativeInventory.js';
import { preloadPaperDollForEntity } from '../ui/paperDoll.js';   // U26: the doll the keyed window never had
import { createDroppedLoot } from './droppedLoot.js';   // U8e, mounted here at U26
import { createPlayerMagic } from './hostMagic.js';   // M3: the ONE cast engine
import { tallySkill, skillValue, SKILLS, SKILL_NAMES } from '../systems/skills.js';
import { FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE, CAPSULE_HEIGHT } from '../player/motor.js';
import { applyLevelUp } from '../systems/advancement.js';
import { tickPlayerMinutes, claimMagicRounds, runMagicRoundsFor } from '../systems/worldTick.js';   // AUDIT 18: the player tick every host shares
import { spendPoolLowest } from '../systems/chargen.js';
import { readSpellsStd } from '../formats/spellsStd.js';
import { readMagicDef } from '../formats/magicDef.js';
import { ClassFile } from '../formats/classFile.js';
import { fetchBytes, ensureAudio, raiseAtRestEnd, endRunToTitleMenu, sensesContext } from './shared.js';
import { makeOpenBookHook, preloadBookArt } from '../ui/bookReader.js';   // B1
import { worldMinutes, setWorldMinutes } from '../systems/worldTick.js';
import {
  missileArchive, MISSILE_SPEED, MISSILE_COLLIDER_RADIUS,
  MISSILE_LIFESPAN_S,
  EXPLOSION_RADIUS, pickTouchTarget, sweepFoes,
} from '../systems/spellcast.js';
import { silenceBlocksCast, SILENCED_TEXT } from '../systems/mysticism.js';   // S27
import { applySpell, hasActiveEffect, entityIsParalyzed, maxFatigue } from '../systems/effects.js';
import { FATIGUE_LOSS, liveStat, killIfAnyLiveStatZero } from '../systems/statMods.js';
import { breathStep } from '../systems/breath.js';
import { updateDiseases, onMonsterHit, SPIDER_TOUCH_SPELL_INDEX } from '../systems/diseases.js';
import { inflictPoison } from '../systems/poisons.js';
import { exhaustionOutcome, EXHAUSTED_IN_WATER, healthRecoveryRate, fatigueRecoveryRate, spellPointRecoveryRate, hasSpecialAbility, SPECIAL_ABILITY } from '../systems/rest.js';
import { REST_TEXT } from '../systems/restSession.js';
import { intermittentEnemySpawn, setEnemyAlert } from '../systems/encounters.js';   // E-slice
import { RestWindow } from '../ui/restWindow.js';
import { AmbientEffects, DUNGEON_AMBIENT_WAITS } from '../systems/ambientEffects.js';
import { dice100, enemyWeightClassicUnits, weaponKnockbackSpeed, weaponKnockbackApplies, KB_UNIT } from '../combat/formulas.js';   // C15: + knockback
import { assignEnemySpells, SPELL_CAST_SOUND } from '../systems/enemySpells.js';
import { calculateCastCost, effectSchool, EFFECT_COST_TABLE } from '../systems/spellcost.js';
import { snapshotPlayer, restorePlayer, writeQuicksave, readQuicksave } from '../systems/save.js';
import { dungeonKey } from '../systems/songManager.js';
import { audio } from '../systems/audio.js';
import { createAnimalAmbience } from '../systems/animalAmbience.js';   // A4: the shared PlayRandomlyIfPlayerNear pass
import {
  SOUND, hitSoundFor, swingSoundFor,
  TORCH_ARCHIVE, TORCH_RECORDS, TORCH_MAX_DISTANCE, TORCH_VOLUME,
  ANIMALS_ARCHIVE, ANIMAL_SOUND_BY_RECORD,
} from '../systems/soundClips.js';
import { CLASSIC_UPDATE_INTERVAL } from '../characters/weaponStates.js';
import { BUILD_TAG } from '../buildTag.js';
import {
  generateItems as generateLootItems, setMagicItemTemplates,
  RANDOM_TREASURE_ARCHIVE, RANDOM_TREASURE_ICONS,
  RANDOM_TREASURE_MARKER_RECORD, DUNGEON_LOOT_KEYS,
} from '../systems/loot.js';
import { floorLanding } from '../player/enterExit.js';
import { trs, multiply } from '../world/mat4.js';
import { Collider } from '../player/collider.js';
import { ActionSystem } from '../world/actionSystem.js';
import { collectDungeonEnemies } from '../characters/dungeonEnemies.js';
import { ENEMY_BASICS, enemyDisplayName } from '../characters/enemyBasics.js';
import { createHitEffects, bloodCentre } from './hitEffects.js';   // AUDIT 24 (wave 39): EnemyBlood.ShowBloodSplash
import { EnemySoundSource } from '../characters/enemySounds.js';   // AUDIT 24 (wave 41): EnemySounds.cs, one home
import { flashPlayerDamage } from '../ui/damageFlash.js';   // AUDIT 24 (wave 39): ShowPlayerDamage



/**
 * @param deps {{renderer, arch, getGpuMesh, cpuModels, getTexture, uploadRecord}}
 * @param dfLocation location with a dungeon
 * @param blocks BlocksFile
 * @param climateBaseType ClimateBases value for the table remap
 */
export async function buildDungeonContext(deps, dfLocation, blocks, climateBaseType, opts = {}) {
  const { renderer, arch, getGpuMesh, cpuModels, getTexture, uploadRecord, uploadRecordFrame, palette } = deps;

  // Layout needs synchronous models (doors/exit extraction); a unit-size
  // pre-pass mirrors the standalone scene.
  const preModels = new Map();
  const getModelPre = (id) => {
    if (!preModels.has(id)) {
      const index = arch.getRecordIndex(id);
      if (index === -1) throw new Error(`model not found: ${id}`);
      preModels.set(id, dfMeshToModel(arch.getMesh(index), () => ({ width: 1, height: 1 })));
    }
    return preModels.get(id);
  };

  const dungeon = layoutDungeon(dfLocation, blocks, getModelPre);
  const remap = (archive) => applyTextureTable(archive, dungeon.textureTable, climateBaseType);

  const drawList = [];
  const dynamicDraws = [];
  const collider = new Collider(() => -Infinity);
  // Effect actions (Hurt traps) damage the shared player entity;
  // health floors at 0 (death screen: UI arc). Traps work with or
  // without ?foes - the entity import is static.
  const actions = new ActionSystem(collider, {
    damagePlayer: hurtPlayer,
    castSpell: (index, origin) => { _pendingCasts.push({ index, origin }); },   // consumed once spells load
    drainMagicka: (n) => {
      playerEntity.magicka = Math.max(0, (playerEntity.magicka ?? 0) - n);
      surfacePlayer();
    },
    playerLevel: () => playerEntity.level,
  });
  // A1: sound. DAGGER.SND loads through the data seam; the context
  // starts on the first gesture (mobile discipline). Dungeon doors
  // ride the DFU dungeon clips (DaggerfallActionDoor's RDB shape).
  // AUDIT 19 F1(doctrine): this host called audio.ensure and music.ensure
  // DIRECTLY, not through the shared seam - so the F6 pin's own
  // justification ("a host physically cannot take one and miss the
  // other") was false here, and deleting the music bootstrap left a
  // ?dungeon boot permanently silent while the whole suite passed. It
  // takes the seam now, like the other three hosts, and the pin requires
  // it of every host rather than asserting it of the seam alone.
  const _audioUp = ensureAudio(fetchBytes);   // AUDIT 18 F6: sound + music, one idempotent bootstrap
  // AUDIT 19 F4 (critical): the music start USED to sit right here and
  // read `classicMinutes` - a `let` declared ~1000 lines and THIRTY awaits
  // later. The promise resolved DURING one of those awaits, so every
  // dungeon boot threw a TDZ ReferenceError and painted the crash overlay.
  // It now starts at the end of this function, where every binding exists.
  // A `.then` registered early is not "later"; it is "as soon as the first
  // await yields".
  actions.onDoorState = (o, opening) => {
    const m = o.matrix;
    audio.play3d(opening ? SOUND.DungeonDoorOpen : SOUND.DungeonDoorClose, [m[12], m[13], m[14]]);
  };
  const texRemap = new Map();
  const flatGroups = new Map();
  const lights = [];
  const waterQuads = [];
  const exitDoors = [];
  let colliderTris = 0;

  const ensureRemap = async (id) => {
    // NEVER TRAPS: cpuModels is written only on getGpuMesh's SUCCESS
    // path, so a model id this ARCH3D lacks arrives here as undefined.
    // `?? []` guards the VALUE and not the RECEIVER - this was safe at
    // its placement call site only because `if (!gpu) continue` runs
    // one line before it, and the action-door arm below had no such
    // guard, so a missing door model threw here at LOAD.
    const cpu = cpuModels.get(id);
    for (const sm of cpu?.subMeshes ?? []) {
      const swapped = remap(sm.textureArchive);
      if (swapped === sm.textureArchive) continue;
      const key = `${sm.textureArchive}_${sm.textureRecord}`;
      if (texRemap.has(key)) continue;
      const t = await getTexture(swapped);
      if (sm.textureRecord >= t.recordCount) continue;
      uploadRecord(swapped, sm.textureRecord);
      texRemap.set(key, `${swapped}_${sm.textureRecord}`);
    }
  };

  // One registration path for acting FLATS (audit 2026-08-16: flat and
  // marker actions were never registered - classic flat levers/trigger
  // zones were dead). The box brackets the billboard the way DFU's
  // AddAction BoxCollider brackets the flat; effects keep their verbatim
  // origin; a move-flag flat has no mesh to tween here, so it relays -
  // the chain lives, the motion is INTERIM (loud) until flats can tween.
  const registerFlatAction = async (ns, position, action, x, y, z, archive, record) => {
    let aabb = null;
    const t = await getTexture(archive);
    if (t && record < t.recordCount) {
      const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
      aabb = {
        min: [x - size.w / 2, y - size.h / 2, z - size.w / 2],
        max: [x + size.w / 2, y + size.h / 2, z + size.w / 2],
      };
    }
    if (EFFECT_ACTION_FLAGS.has(action.actionFlag)) {
      const eo = actions.addEffect(ns, position, action, [x, y, z]);
      if (aabb) eo.aabb = aabb;
    } else {
      actions.addRelay(ns, position, action, aabb, [x, y, z]);
    }
  };

  // P10: teleport destinations resolve through a per-block-instance
  // position index (destinations are usually actionless editor flats
  // that live in no other runtime structure). Keys are `${ns}:${pos}`
  // where ns = the block INSTANCE index - positions are block-local
  // byte offsets and 3108/4232 dungeons repeat blocks (the same ns
  // that namespaces every chain key).
  const positionIndex = new Map();
  const torches = [];         // A2: { pos, handle } - looping Burning sources gated by range
  const ambientAnimals = [];  // A2: { pos, sound } - random-cadence barks (A4: consumed by the shared module)
  const animalAmbience = createAnimalAmbience(audio, () => ambientAnimals);
  for (const [bi, b] of dungeon.blocks.entries()) {
    const originMatrix = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const [pos, e] of b.layout.objectPositions) {
      positionIndex.set(`${bi}:${pos}`, { pos: [e.x + b.originX, e.y, e.z + b.originZ], yawDeg: e.yawDeg });
    }
    for (const p of b.layout.placements) {
      const matrix = multiply(originMatrix, p.matrix);
      const gpu = await getGpuMesh(p.modelIdNum);
      if (!gpu) continue;
      await ensureRemap(p.modelIdNum);
      const cpu = cpuModels.get(p.modelIdNum);
      if (p.action) {
        // Verbatim AddActionModelHelper classification (audit
        // 2026-08-16: only move/effect registered before - every
        // chain through a Teleport/Activate/verb/text object died,
        // and lever-driven stone doors never swung).
        const cls = classifyPlacementAction(p.action.actionFlag, false);
        if (cls === 'move') {
          const o = actions.addAction(bi, p.position, cpu, matrix, p.action);
          // Audit 06f: movers carry their AT-REST bounds so step-on
          // platforms (classic Collision01 elevators) collision-trigger;
          // the pass only tests movers while parked at 'start', where
          // the static AABB is truthful.
          o.aabb = worldAabb(cpu.positions, matrix);
          o.restOnlyTrigger = true;
          dynamicDraws.push({ gpu, object: o });
          continue;
        }
        if (cls === 'specialDoor') {
          // DaggerfallActionDoorSpecial: OpenDoor (or CloseDoor on a
          // non-door) turns a plain model into a hinged special door -
          // own bucket, swings on the chain or the player's hand.
          const o = actions.addSpecialDoor(bi, p.position, cpu, matrix, p.action);
          dynamicDraws.push({ gpu, object: o });
          continue;
        }
        if (cls === 'effect') {
          // Hurt/Poison/DrainMagicka/CastSpell: chain-participating
          // logic object; the model stays static (draw + collider
          // below). Origin = the placement translation (CastSpell
          // fires missiles from here, +40*GlobalScale up, verbatim).
          const eo = actions.addEffect(bi, p.position, p.action, [matrix[12], matrix[13], matrix[14]]);
          eo.aabb = worldAabb(cpu.positions, matrix);   // collision triggers test against this
        } else {
          // Relay: the delegate is routed (Teleport/text) or a
          // verbatim no-op; the CHAIN through it must live, and its
          // collider makes it a Direct/Attack/collision target.
          actions.addRelay(bi, p.position, p.action, worldAabb(cpu.positions, matrix), [matrix[12], matrix[13], matrix[14]]);
        }
      }
      drawList.push({ mesh: gpu, matrix });
      collider.addMesh('dungeon', cpu.positions, cpu.indices, matrix);
      colliderTris += cpu.indices.length / 3;
    }
    for (const d of b.layout.actionDoors) {
      if (d.disabled) continue;
      const matrix = multiply(originMatrix, d.matrix);
      const gpu = await getGpuMesh(d.modelIdNum);
      // THE FOURTH SEAM. The placement loop fifty lines above has
      // `if (!gpu) continue`; this arm did not, and a door model
      // absent from the player's ARCH3D trapped it three ways over -
      // ensureRemap's undefined receiver, then addDoor's cpu.positions,
      // and then a {gpu: null} entry the frame loop draws unguarded.
      const cpu = cpuModels.get(d.modelIdNum);
      if (!gpu || !cpu) {
        console.warn(`[dungeon] action-door model ${d.modelIdNum} is not in this ARCH3D - the door is skipped`);
        continue;
      }
      await ensureRemap(d.modelIdNum);
      // Chain key + own action record + the starting lock (audit
      // 2026-08-16 + P10: chained doors were unreachable and locks
      // had no state to gate on; the P10 player-toggle lock gate now
      // reads currentLockValue).
      const o = actions.addDoor(cpu, matrix, {
        ns: bi, positionKey: d.position, action: d.action, startingLockValue: d.startingLockValue,
      });
      dynamicDraws.push({ gpu, object: o });
    }
    for (const f of b.layout.flats) {
      const key = `${f.archive}_${f.record}`;
      if (!flatGroups.has(key)) flatGroups.set(key, []);
      flatGroups.get(key).push([f.x + b.originX, f.y, f.z + b.originZ]);
      // A2 ambient sources: burning torches (RDBLayout.IsTorchFlat,
      // 210/{0,1,6,16..20}) loop within 5; animal flats (201) bark on
      // the classic random cadence within 19.2.
      if (f.archive === TORCH_ARCHIVE && TORCH_RECORDS.has(f.record)) {
        torches.push({ pos: [f.x + b.originX, f.y, f.z + b.originZ], handle: null });
      } else if (f.archive === ANIMALS_ARCHIVE && ANIMAL_SOUND_BY_RECORD[f.record] != null) {
        ambientAnimals.push({ pos: [f.x + b.originX, f.y, f.z + b.originZ], sound: ANIMAL_SOUND_BY_RECORD[f.record] });
      }
      if (f.action) await registerFlatAction(bi, f.position, f.action, f.x + b.originX, f.y, f.z + b.originZ, f.archive, f.record);
    }
    for (const m of b.layout.markers) {
      // Acting markers join the runtime too (DFU AddActionFlatHelper
      // runs for EVERY flat with action > 0, editor flats included).
      // Records 15/16 are SetActive(false) in DFU - Receive early-outs
      // on inactive objects, so their actions are inert; preserved by
      // skipping them (audit 2026-08-16).
      if (!m.action || m.record === 15 || m.record === 16) continue;
      await registerFlatAction(bi, m.position, m.action, m.x + b.originX, m.y, m.z + b.originZ, m.archive ?? 199, m.record);
    }
    for (const l of collectDungeonLights(b.dfBlock)) {
      lights.push({ x: l.x + b.originX, y: l.y, z: l.z + b.originZ, range: l.range });
    }
    if (b.layout.waterLevel !== 10000) {
      waterQuads.push({
        x: b.originX, z: b.originZ, size: RDB_SIDE,
        y: -b.layout.waterLevel * GLOBAL_SCALE,
      });
    }
    for (const door of b.layout.exitDoors) {
      // Exit-door matrices are model-local under the block origin.
      exitDoors.push({ ...door, matrix: multiply(originMatrix, door.matrix) });
    }
  }

  // Enemies (C3): the classic selection over this dungeon's markers -
  // fixed (record 16) + random (record 15, LocationId-seeded tables).
  // Classic billboards join the flat batches (RDB raw-pivot rule);
  // gender picks the archive; record 0 is the standing frame (no AI -
  // Characters C5 rigs replace these).
  const enemies = collectDungeonEnemies(
    dungeon.blocks.map((b) => ({
      markers: b.layout.markers, waterLevel: b.layout.waterLevel,
      originX: b.originX, originZ: b.originZ,
    })),
    {
      locationId: dfLocation.dungeon.recordElement.header.locationId,
      dungeonType: dfLocation.mapTableData.dungeonType,
      playerLevel: playerEntity.level,   // ChooseRandomEnemyType bands on the LIVE level (wired audit 2026-08-16; was stuck at the default 1)
    });
  // C8 E1 (?foes): CLASS enemies (mobileType > 43, human morphology)
  // spawn as canonical rigs instead of their C3 billboards - one rig
  // per enemy (individual animation state), floor-snapped through the
  // dungeon collider (the FixStanding counterpart), IDLE gait, fixed
  // deterministic facing. Monsters (0-42) stay billboards until their
  // morphologies are authored (E4, rewrite/ bench). Flag off = C3
  // verbatim, untouched.
  const foes = [];
  let foeDeps = null;
  if (opts.foes && palette) {
   try {
    // One import + one BODY00I0 fetch for the whole context; every
    // per-enemy dependency lives here (a fetchBytes reference inside
    // the loop once pointed at a name only in THIS block's scope -
    // caught in review, hoisted).
    const [shared, engineRig, { buildRaceCharacter },
      { EnemyAI, withinYaw, isBackFacing, openDoorsStep }, { EnemyAttack }, { makeEnemyEntity, loadMonsterCareer }, { EnemyCaster, castEnemySpell: castShared, hasRangedSpell }] = await Promise.all([
      import('./shared.js'), import('../characters/engineRig.js'),
      import('../characters/raceCharacter.js'),
      import('../characters/enemyMotor.js'), import('../characters/enemyAttack.js'),
      import('../characters/enemyEntity.js'), import('../characters/enemyCasting.js'),
    ]);
    const bodyImg = new ImgFile();
    bodyImg.load(await fetchBytes('BODY00I0.IMG'), 'BODY00I0.IMG', palette);
    const formulas = await import('../combat/formulas.js');
    const { REACTIONS, sampleClip } = await import('../characters/anims.js');

    foeDeps = {
      REACTIONS, sampleClip,
      isBackFacing,
      chooseEnemyWeapon: formulas.chooseEnemyWeapon,
      generateItems: generateLootItems,   // the static import (audit 06e: the dynamic pair was double-sourcing)

      calculateAttackDamage: formulas.calculateAttackDamage,
      openDoorsStep,   // C-slice: EnemyMotor.OpenDoors
      enemyLanguageSkill: formulas.enemyLanguageSkill,           // C-slice: pacification
      calculateEnemyPacification: formulas.calculateEnemyPacification,
      meleeHitConnects: formulas.meleeHitConnects,
      MELEE_HIT_YAW_DEG: formulas.MELEE_HIT_YAW_DEG,
      withinYaw,
      fetchBytes,
      createCharacterRig: engineRig.createCharacterRig,
      bodyRamps: engineRig.deriveClassicRamps(palette, bodyImg.getDFBitmap()),
      buildRaceCharacter, floorLanding, EnemyAI, EnemyAttack, makeEnemyEntity, loadMonsterCareer, EnemyCaster, ClassFile, playerEntity,   // floorLanding/playerEntity/ClassFile/fetchBytes/generateItems ride the STATIC imports (audits 06c-06e)
      castEnemySpell: castShared,   // X3: the ONE cast executor (characters/enemyCasting.js)
      hasRangedSpell,   // wave 35: the selection-free half of CanCastRangedSpell, for the stand-off band
    };
   } catch (err) {
     // The foe SUBSYSTEM failing to initialize (a dynamic import, the
     // BODY00I0 fetch, the ramp derive) must not black-screen the
     // level: degrade to a foe-less dungeon, loudly. foeDeps stays
     // null; the class branch is skipped, monsters still billboard.
     console.error('[foes] subsystem init failed; dungeon builds without class enemies:', err?.message ?? err);
     foeDeps = null;
   }
  }
  /** One foe from a spawn record { mobileType, gender, x, y, z,
   *  spawnDistanceType } - the load loop's body, extracted so the
   *  E-slice encounter spawner can mint foes at runtime (a rest
   *  interruption builds through the SAME chain: entity, loot,
   *  equipment, AI, attack, sprite). Load-time flat fallbacks stay
   *  inside; a runtime caller passes fallbackFlat = false. */
  /** ObstacleCheck's DaggerfallActionDoor arm (EnemyMotor.cs:1167-1176):
   *  a door in the way is NOT an obstacle, it is a door - the foe walks
   *  at it and OpenDoors deals with it. The AI holds collider bucket
   *  KEYS and this host owns the registry that turns one into an action
   *  object, which is the same resolution the OpenDoors arm below
   *  already does with senses.LastKnownDoor. */
  const isActionDoor = (key) => {
    if (key == null) return false;
    const o = actions?.objects.get(key);
    return !!o && DOOR_VERB_FLAGS.has(o.actionFlag);
  };
  async function buildFoeAt(e, fallbackFlat = true) {
    const basics = ENEMY_BASICS[e.mobileType];
    if (!basics) return;
    // C17 THE HUMANOID PIVOT: class enemies (128+) render as classic
    // sprite mobiles too - the voxel foe rig goes ON ICE with the
    // voxel FP weapon (Mac's classic-visuals direction). The entity
    // build below (career/equipment/poison/archer) is UNCHANGED.
    if (foeDeps && e.mobileType > 43 && basics.maleTexture) {
     try {
      const D = foeDeps;
      const pos = D.floorLanding(collider, [e.x, e.y + 0.2, e.z]);
      const yawDeg = ((e.mobileType * 73 + Math.round(e.x + e.z)) % 8) * 45;   // deterministic facing, no engine PRNG (Ledger A rule)
      // E3a: the real entity - career from CLASS{ID-128}.CFG, level =
      // player level, HP/skills/LiveSpeed verbatim (SetEnemyCareer)
      const careerIndex = e.mobileType - 128;
      const cf = new D.ClassFile();
      cf.load(await D.fetchBytes(`CLASS${String(careerIndex).padStart(2, '0')}.CFG`));
      const entity = D.makeEnemyEntity(e.mobileType, basics, cf.career, D.playerEntity.level);
      // S1: GenerateItems(LootTableKey) per SetEnemyCareer order -
      // the loot rides the entity; corpses carry it on death (pickup
      // pends Player activation, flagged in the arc).
      // AUDIT 18: LootTables.cs:212/:229/:237 pass the PLAYER's gender
      // and race into CreateRandomArmor/MagicItem/Clothing, not the
      // dead enemy's - the level in the same call is already the
      // player's, and this argument was the odd one out.
      entity.items = D.generateItems(basics.lootTableKey ?? '-', { level: D.playerEntity.level, gender: D.playerEntity.gender });
      // E4b: SetEnemyEquipment verbatim - loadout + the per-part
      // armor-value pass (init 100, subtract, class clamp 60);
      // the right-hand weapon feeds the attack path. AUDIT 18: the
      // whole block moved to hostCombat.equipEnemy so the monster
      // branch and the city watch run the same chain.
      equipEnemy(entity, e.mobileType, D.playerEntity.level);
      const ai = new D.EnemyAI(collider, pos, yawDeg * Math.PI / 180, {
        liveSpeed: entity.liveSpeed,
        seesThroughInvisibility: basics.seesThroughInvisibility ?? false,   // P13: the illusion-gate exemption
        spawnDistanceType: e.spawnDistanceType ?? 0,   // AUDIT 23 (characters-7): EnemySenses.cs:231 - the marker's band row
        isActionDoor,   // wave 34: ObstacleCheck's DaggerfallActionDoor arm
        // wave 35: DoRangedAttack's band - a shooter inside 6..51.2 with
        // the target in sight does NOT pursue (EnemyMotor.cs:468-470,
        // :610 `return true`), it stands off and turns to face.
        hasBowAttack: hasBowAttack(basics),
        canCastRangedSpell: () => foeDeps.hasRangedSpell(entity),
      });
      const attack = new D.EnemyAttack({ liveSpeed: entity.liveSpeed, playerLevel: D.playerEntity.level, reflexes: D.playerEntity.reflexes });
      // Combat bows: EnemyMotor.cs:131-137 reads the MobileEnemy
      // FLAGS, with zero inventory involvement (AUDIT 18 - minting
      // this from an equipped bow meant no enemy could ever fire one,
      // because AssignEnemyStartingEquipment never rolls a bow).
      attack.rangedAttack = hasBowAttack(basics);
      const archive = e.gender === 'female' ? basics.femaleTexture : basics.maleTexture;
      const t = await getTexture(archive);
      const mobile = new MobileUnit(e.mobileType, basics, (rec) => t.getFrameCount(rec), Math.random, e.gender);
      const batch = renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]);
      foes.push({ mobile, mobileArchive: archive, mobileTex: t, batch, ai, attack, entity, mobileType: e.mobileType, gender: e.gender });
     } catch (err) {
       // One foe failing to build (a missing CLASS*.CFG, a rig or
       // equipment error on a specific mobile type) MUST NOT abort
       // buildDungeonContext and black-screen the whole dungeon -
       // the class-foe block was unguarded on the critical build
       // path, and with ?foes a single bad enemy took the level
       // down with no signal. Skip the foe, keep the dungeon.
       console.error(`[foe] mobileType ${e.mobileType} failed to build; skipping this enemy:`, err?.message ?? err);
     }
      return;
    }
    // C11 THE MONSTER PIVOT: monster types (0-42) become REAL foes -
    // the same EnemyAI/senses/stealth, EnemyAttack cadence, entity
    // (ENEMY{nnn}.CFG career + basics HP/level/armor, E4a), loot,
    // S16 fixed spell lists, S18 OnMonsterHit riders, and corpses -
    // rendered as classic ANIMATED sprite mobiles (MobileUnit: the
    // DFU orientation/anim laws over the real TEXTURE archive).
    if (foeDeps && e.mobileType <= 42 && basics.maleTexture) {
     try {
      const D = foeDeps;
      const archive = e.gender === 'female' ? basics.femaleTexture : basics.maleTexture;
      const t = await getTexture(archive);
      // C12: flyers (CanFly = Flying|Spectral) hover at the spawn
      // marker - no floor landing; walkers and swimmers ground (a
      // fish lands on its pool bed and swims up on pursuit).
      const behaviour = basics.behaviour ?? 'General';
      const canFly = behaviour === 'Flying' || behaviour === 'Spectral';
      const pos = canFly ? [e.x, e.y, e.z] : D.floorLanding(collider, [e.x, e.y + 0.2, e.z]);
      const yawDeg = ((e.mobileType * 73 + Math.round(e.x + e.z)) % 8) * 45;   // deterministic facing (Ledger A rule)
      const career = await D.loadMonsterCareer(e.mobileType, D.fetchBytes);
      const entity = D.makeEnemyEntity(e.mobileType, basics, career, D.playerEntity.level);
      entity.items = D.generateItems(basics.lootTableKey ?? '-', { level: D.playerEntity.level, gender: D.playerEntity.gender });
      // AUDIT 18: EnemyEntity.cs:330-347 runs the equipment chain BY
      // careerIndex before the class arm, so Orc(7)/OrcShaman(21),
      // Centaur(8)/OrcSergeant(12) and OrcWarlord(24) are equipped
      // too. The monster branch went straight from GenerateItems to
      // the AI, so five equipment-using monsters spawned naked - no
      // weapon, no armorValues, no equipment on the corpse.
      equipEnemy(entity, e.mobileType, D.playerEntity.level);
      // C12: the behaviour motors - flying/spectral pursue in 3D at
      // the face with no gravity, aquatic ride WaterMove against the
      // block water surface (beached = frozen, verbatim).
      const ai = new D.EnemyAI(collider, pos, yawDeg * Math.PI / 180, {
        liveSpeed: entity.liveSpeed,
        seesThroughInvisibility: basics.seesThroughInvisibility ?? false,
        behaviour, mobileId: e.mobileType, waterSurfaceY: waterSurfaceYAt,
        spawnDistanceType: e.spawnDistanceType ?? 0,   // AUDIT 23 (characters-7)
        isActionDoor,   // wave 34: ObstacleCheck's DaggerfallActionDoor arm
        // wave 35: DoRangedAttack's band - a shooter inside 6..51.2 with
        // the target in sight does NOT pursue (EnemyMotor.cs:468-470,
        // :610 `return true`), it stands off and turns to face.
        hasBowAttack: hasBowAttack(basics),
        canCastRangedSpell: () => foeDeps.hasRangedSpell(entity),
      });
      const attack = new D.EnemyAttack({ liveSpeed: entity.liveSpeed, playerLevel: D.playerEntity.level, reflexes: D.playerEntity.reflexes });
      // The same EnemyMotor.cs:131-137 flag test the class branch
      // runs - false for all 43 monsters today, but it must not stay
      // undefined (the archer draw/loose path reads it every frame).
      attack.rangedAttack = hasBowAttack(basics);
      const mobile = new MobileUnit(e.mobileType, basics, (rec) => t.getFrameCount(rec), Math.random, e.gender);
      // One live billboard batch per foe: record/size/origin mutate
      // per frame (the batch geometry is a unit quad; size is a
      // uniform, origin a live translation - zero rebuilds).
      const batch = renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]);
      foes.push({ mobile, mobileArchive: archive, mobileTex: t, batch, ai, attack, entity, mobileType: e.mobileType, gender: e.gender });
     } catch (err) {
       // Same guard as the class branch: one bad monster must not
       // take the dungeon down - fall back to the static flat.
       console.error(`[foe] monster ${e.mobileType} failed to build; static flat fallback:`, err?.message ?? err);
       if (fallbackFlat) {
         const archive = e.gender === 'female' ? basics.femaleTexture : basics.maleTexture;
         const key = `${archive}_0`;
         if (!flatGroups.has(key)) flatGroups.set(key, []);
         flatGroups.get(key).push([e.x, e.y, e.z]);
       }
     }
      return;
    }
    if (!fallbackFlat) return;
    const archive = e.gender === 'female' ? basics.femaleTexture : basics.maleTexture;
    const key = `${archive}_0`;
    if (!flatGroups.has(key)) flatGroups.set(key, []);
    flatGroups.get(key).push([e.x, e.y, e.z]);
  }
  for (const e of enemies) await buildFoeAt(e);

  // S3: the REAL player entity - chargen rolls from a CLASS*.CFG
  // career before anything consumes the player. Career = ?class= (an
  // index into the 18 careers) or the INTERIM default Warrior (16,
  // loud - the chargen UI replaces the default and the pool policy).
  // S4b: trap spells - SPELLS.STD by index; CastSpell actions queue
  // missiles that fly at the player (speed 25, radius 0.45, life 8s,
  // element billboards 375-379). Resolution: the classic
  // damage-health family through the verbatim saving throw; other
  // effects FLAGGED to the effect-library slice.
  const _pendingCasts = [];
  const missiles = [];
  let spellsByIndex = null;
  try {
    // AUDIT 18: SPELLS.STD carries DUPLICATE indices and DFU keeps the
    // FIRST (SpellRecord's `if (!map.ContainsKey(index)) map.Add(...)`
    // shape) - a straight `new Map(entries)` keeps the LAST, so
    // classic spell 58 readied Holy Touch (rangeType 1) where DFU
    // readies Holy Word (rangeType 3).
    const _byIndex = new Map();
    for (const sp of readSpellsStd(await fetchBytes('SPELLS.STD'))) {
      if (!_byIndex.has(sp.index)) _byIndex.set(sp.index, sp);
    }
    spellsByIndex = _byIndex;
  } catch { /* data absent: casts no-op, loudly flagged */ }
  try {
    // S4c: MAGIC.DEF registers the magic-item templates - a
    // module-level registry, correct for the single active context
    // (each dungeon build re-sets it); the loot MI category is live
    // from here (absent -> stays flagged-skip). AUDIT 18: its own try
    // block - it shared one with the SPELLS.STD fold, so a bad
    // MAGIC.DEF silently nulled the whole spell table too.
    setMagicItemTemplates(readMagicDef(await fetchBytes('MAGIC.DEF')));
  } catch { /* data absent: the loot MI category stays flagged-skip */ }
  // U6: the TEXT.RSC database goes LIVE for the action text boxes
  // (the reader shipped with the U-series; the hudText note's
  // "database FLAGGED" narrows to the skill/loot message ids).
  let textRsc = null;
  try {
    textRsc = new TextRsc().load(await fetchBytes('TEXT.RSC'));
  } catch { console.warn('[text] TEXT.RSC unavailable; action text boxes no-op'); }
  // AUDIT 17g F1: the parchment frame warms HERE, beside the records
  // it frames. U11 wired it inside toggleCharSheet() - the comment
  // even said "for the action boxes" - so a dungeon trigger that
  // popped a ShowText box drew the FLAT fallback unless the player had
  // pressed F5 at some point first. Nothing failed loudly; the box
  // just quietly wasn't classic.
  preloadMessageBoxArt({ renderer, fetchBytes, palette });
  // S16: enemy spell lists ride SPELLS.STD (loaded just above, after
  // the foe build) - SetEnemyCareer's assignment tail per live foe:
  // class enemies with CastsMagic take EnemyClassSpells[min(6,
  // level/3)] (monsters' fixed lists ship in the same table and go
  // live when monsters leave their billboards). A caster foe gets an
  // EnemyCaster driving the classic decide-and-release shape.
  if (spellsByIndex && foeDeps) {
    for (const f of foes) {
      assignEnemySpells(f.entity, spellsByIndex);
      if (f.entity.spells?.length) f.caster = new foeDeps.EnemyCaster(f.entity);
    }
  }

  let chargenFlow = null;
  let activeOverlay = null;

  // ── U26: THE NATIVE INVENTORY IN THE DUNGEON ─────────────────────
  // This host kept ui/inventory.js's keyed window while the exterior
  // hosts moved to the classic one at U8d, so a dungeon had no tabs,
  // no paperdoll, no real info panel and - after U25 - no Use mode
  // either, which is where a torch is actually lit. It was the last
  // host without it.
  //
  // What the swap needed, and why it was a slice rather than an edit:
  //  - a GROUND PILE for Remove-mode drops. droppedLoot is written
  //    host-agnostically (renderer + getTexture + uploadRecordFrame)
  //    and simply had never been mounted here, so items dropped in a
  //    dungeon had nowhere to land.
  //  - RAW KEY CODES. routeKey handed every overlay an ACTION
  //    ('back'/'confirm'/'up'), which is the keyed windows'
  //    vocabulary and cannot express F6, a mode button or a digit.
  //    ui/input.js now passes the code through for a native window,
  //    exactly as townTalk's seam has since G2.
  const droppedLoot = createDroppedLoot({ renderer, getTexture, uploadRecordFrame });
  preloadInventoryArt({ renderer, fetchBytes, palette });
  // U26: the PAPERDOLL too. The exterior hosts have warmed it since
  // U8f; this one never did, because its keyed window had no doll to
  // draw - so the native window opened here with an empty panel until
  // the art was asked for.
  // ...and this host is the one that can pass a NON-TOWN context:
  // CONTEXT_BG maps 'dungeon' to SCBG07I0, which is the backdrop
  // classic shows behind the doll underground. The town hosts have
  // only ever asked for SCBG04I0, so the constant existed with no
  // caller until now.
  preloadBookArt({ renderer, fetchBytes, palette });   // B1: BOOK00I0 warms at boot
  preloadPaperDollForEntity({ renderer, fetchBytes, palette, getTexture }, playerEntity, 'dungeon')
    .catch(() => console.warn('[paperdoll] art unavailable in this dungeon'));

  /** One builder for every way this host opens the window - the bare
   *  F6 press and each loot target - so a hook cannot reach one and
   *  miss the others (THE ONE CONSTRUCTION SEAM, which U25's sweep
   *  found four instances of in the exterior hosts). */
  // B1 + AUDIT B-C2: the fetch is ASYNC, so by the time it resolves
  // the player may have opened something else - the reader takes the
  // slot only if it is still free (never clobbers a live window).
  const openBookHook = makeOpenBookHook({ fetchBytes, showReader: (w) => { if (!activeOverlay) activeOverlay = w; } });
  function openInventory(lootItems, onEmptied = null) {
    return new NativeInventoryWindow({
      openBook: openBookHook,   // B1: the use-mode book arm
      items: () => (playerEntity.items ??= []),
      wagonItems: () => (playerEntity.wagonItems ??= []),   // W-slice
      // W-slice: CheckWagonAccess's dungeon arm - the wagon is
      // reachable only within 5 units of an EXIT door
      // (DungeonWagonAccessProximityCheck :1099-1116; the classic
      // "your cart waits at the entrance" rule).
      dungeon: {
        inside: true,
        nearExit: () => !!lastPlayerFeet && exitDoors.some((d) => {
          const p = [d.matrix[12], d.matrix[13], d.matrix[14]];
          return Math.hypot(p[0] - lastPlayerFeet[0], p[1] - lastPlayerFeet[1], p[2] - lastPlayerFeet[2]) <= WAGON_ACCESS_DISTANCE;
        }),
      },
      entity: playerEntity,
      icons: { getTexture, uploadRecord, textures: renderer.textures },
      rows: (id) => textRsc?.variantLinesById(id) ?? [],   // AUDIT 22 F2
      nowMinute: () => Math.floor(worldMinutes()),   // AUDIT 21 F2: the one clock
      loot: lootItems ? { items: () => lootItems } : undefined,
      // lastPlayerFeet is written by the frame loop; a drop before the
      // first frame has nowhere to land, and DFU's own container mint
      // is at the player's position - so no feet, no pile, loudly.
      onDrop: (items) => (lastPlayerFeet
        ? droppedLoot.dropPile(items, [...lastPlayerFeet])
        : console.warn('[loot] dropped before the first frame; no ground position yet')),
      onClose: () => { onEmptied?.(); droppedLoot.releaseEmptied(); surfacePlayer(); },
    });
  }

  const hudText = new HudText();   // U5: classic popup messages
  // wave 22: this host has a HudText of its own, so it needs the same
  // notebook sink PopupText.AddText carries (:123).
  hudText.onMessage = (t) => opts.hudMessageSink?.(t);
  // P10 action seams: teleport destination resolution (the scene
  // installs onTeleport to warp its motor) + the classic look-at-lock
  // text on a refused locked door (LookAtInteriorLock, chance-tiered
  // over the LIVE lockpicking skill).
  actions.resolvePosition = (ns, key) => positionIndex.get(`${ns}:${key}`) ?? null;
  actions.onLockedDoor = (o) => hudText.add(lookAtLockText(o.currentLockValue, playerEntity.level, skillValue(playerEntity, SKILLS.Lockpicking)));
  // A2: DaggerfallAction.Play's sound - the RDB soundIndex fires from
  // the object on every Play (the default min1/max500 3D profile;
  // movers speak from their live matrix, effect objects from origin).
  actions.onActionSound = (o) => {
    const p = o.origin ?? (o.matrix ? [o.matrix[12], o.matrix[13], o.matrix[14]] : null);
    if (p) audio.play3d(o.index, p);
  };
  // AttemptBash's PlayerDoorBash (clip 7) from the door - the A1 seam
  // family (2026-08-16 audit: the hook existed unwired since the bash
  // slice routed it to Audio; A2's engine closes it).
  actions.onDoorBash = (o) => audio.play3d(SOUND.PlayerDoorBash, [o.matrix[12], o.matrix[13], o.matrix[14]]);
  // U6: the text-action seams. ShowText/ShowTextWithInput open modal
  // boxes on the overlay seam (the world holds); DoorText rides the
  // HUD popup (AddHUDText 2.0s); the trespass check maps to our foes,
  // which are already hostile-on-sight (MakeEnemiesHostile's passive
  // teams pend the faction model - logged loudly).
  const rscLines = (id) => {
    const v = textRsc?.plainText(id);
    return v?.length ? v[0].split('\n').filter((l) => l.length) : null;
  };
  actions.onShowText = (id) => {
    const lines = rscLines(id);
    if (!lines) return console.warn(`[action] ShowText ${id}: TEXT.RSC record unavailable`);
    if (!activeOverlay) activeOverlay = new ActionTextBox(lines);
  };
  actions.onShowTextInput = (id, submit) => {
    const lines = rscLines(id);
    if (!lines) return console.warn(`[action] ShowTextWithInput ${id}: TEXT.RSC record unavailable`);
    if (!activeOverlay) activeOverlay = new ActionInputBox(lines, submit);
  };
  actions.onDoorText = (id) => {
    const lines = rscLines(id);
    if (!lines) return console.error(`[action] bad DoorTextID requested: ${id}`);   // DFU throws; we log loudly
    for (const l of lines) hudText.add(l);
  };
  actions.onTrespass = () => console.warn('[action] trespass check fired (MakeEnemiesHostile) - foes are hostile-on-sight; passive teams pend the faction model');
  let lastPlayerFeet = null;   // S11: the save position
  let debugHud = false;   // F8 diagnostics
  let _motorState = '';
  let _mouseState = 'no events';
  let _inputState = '';
  const _activity = { running: false, swimming: false, jumped: false, movingLessThanHalfSpeed: true };   // P11 fatigue state; P13 sneak state; C6 jump edge
  let _grounded = true;   // U7: the rest gate reads the motor's live grounded flag
  // U7: the rest session's scene seams. tickVitals = one rested hour
  // (the S20 rates + the Medical tally, clamped); enemiesNearby is
  // the RESTING AreEnemiesNearby variant - an aware foe at any
  // spawn-band range, an unaware one only within the 12-unit resting
  // distance; fullyHealed follows IsPlayerFullyHealed (magicka full
  // OR a NoRegenSpellPoints career).
  const _restFullyHealed = () =>
    playerEntity.health === playerEntity.maxHealth &&
    (playerEntity.fatigue ?? 0) === maxFatigue(playerEntity) &&
    ((playerEntity.magicka ?? 0) === (playerEntity.maxMagicka ?? 0) || hasSpecialAbility(playerEntity.career, SPECIAL_ABILITY.NoRegenSpellPoints));
  // U3: the level-up screen replaces the headless auto-apply (shared
  // by the rest-end raise and any future travel arm).
  const _onLevelUp = () => {
    hudText.add('You have gained a level!');
    if (!activeOverlay) activeOverlay = new LevelUpScreen(playerEntity);
  };
  // E-slice: a rest-interruption ENCOUNTER - one foe minted through
  // the same chain as the load loop, at the classic minimum distance
  // from the player (CreateFoeSpawner's placement compressed to the
  // eight compass points, floor-landed, nearest workable first).
  async function _spawnEncounter({ mobileType, minDistance }) {
    const feet = lastPlayerFeet;
    if (!feet || !foeDeps) return;
    const basics = ENEMY_BASICS[mobileType];
    if (!basics) return;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const x = feet[0] + Math.sin(a) * minDistance;
      const z = feet[2] + Math.cos(a) * minDistance;
      const landed = foeDeps.floorLanding(collider, [x, feet[1] + 1.5, z]);
      if (!landed || Math.abs(landed[1] - feet[1]) > 6) continue;
      const gender = basics.femaleTexture && Math.random() < 0.5 ? 'female' : 'male';
      await buildFoeAt({ mobileType, gender, x: landed[0], y: landed[1], z: landed[2], spawnDistanceType: 0 }, false);
      return;
    }
  }
  const _restDeps = {
    advanceMinutes: (n) => {
      // E-slice: IntermittentEnemySpawn's catch-up loop across the
      // advanced minutes (PlayerEntity.Update:486-492) - resting in
      // a dungeon under an active enemy alert can spawn ONE foe; the
      // hourly enemy check then breaks the rest, DFU's own flow.
      const start = Math.floor(classicMinutesRef.value);
      classicMinutesRef.value += n;
      // AUDIT 24 (wave 30) - THE BROKER RUNS UNDER THE REST WINDOW.
      // The old line here said "the round loop catches the magic
      // rounds up", and it does not: dungeon.js returns at the
      // overlay gate (:385-396) before this host's frame body, so
      // through a whole rested night nothing ticked a disease, a
      // poison or an active effect - and the marker then fired the
      // entire backlog in ONE burst on the first frame after the
      // window closed, after tickVitals had already healed every
      // hour of it. In DFU the broker's Update runs under
      // Time.timeScale = 0 and interleaves, minute by minute, with
      // TickRest's hourly heal; a poison can kill you in your sleep
      // and the rest ends "You never awaken."
      const _w = claimMagicRounds(start, classicMinutesRef.value);
      runMagicRoundsFor(playerEntity, _w.from, _w.to, { sinks: playerSinks, say: (msg) => hudText.add(msg) });
      // ...and the FOE half of the same broker event. OnNewMagicRound
      // is global - every EntityEffectManager in the scene subscribes
      // - so a foe's poisons and effects age through the rest too.
      // The frame body's own foe loop anchors on the clock at the top
      // of THIS frame, so these minutes were not merely late for the
      // foes, they were lost.
      for (const f of foes) {
        if (f.dead) continue;
        runMagicRoundsFor(f.entity, _w.from, _w.to, { sinks: foeSinks(f) });
      }
      for (let l = 0; l < n; l++) {
        const hit = intermittentEnemySpawn({
          gameMinutes: start + l + 1, inside: true, inDungeon: true, isResting: true,
          enemyAlertActive: !!playerEntity.enemyAlertActive,
          dungeonType: dfLocation.mapTableData.dungeonType,
          playerLevel: playerEntity.level,
        });
        if (hit) { _spawnEncounter(hit); break; }
      }
    },
    // AUDIT 23 (entity-1): the rest-finished close raises skills - the
    // per-minute tick no longer does (DaggerfallRestWindow.cs:731).
    onRestFinished: () => raiseAtRestEnd(playerEntity, {
      say: (msg) => hudText.add(msg), onLevelUp: _onLevelUp,
    }),
    tickVitals: () => {
      playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + healthRecoveryRate(playerEntity, { day: false, inside: true }));
      playerEntity.fatigue = Math.min(maxFatigue(playerEntity), (playerEntity.fatigue ?? 0) + fatigueRecoveryRate(maxFatigue(playerEntity)));
      playerEntity.magicka = Math.min(playerEntity.maxMagicka ?? Infinity, (playerEntity.magicka ?? 0) + spellPointRecoveryRate(playerEntity));
      tallySkill(playerEntity, SKILLS.Medical);
      surfacePlayer();
      return _restFullyHealed();
    },
    fullyHealed: _restFullyHealed,
    enemiesNearby: () => foes.some((f) => {
      if (f.dead) return false;
      const seen = f.ai.detected && f.ai.inSight;
      return seen || (f.ai.wouldBeSpawned && f.ai._dist <= 12);
    }),
    dead: () => playerEntity.health <= 0,
    vitals: () => ({
      health: playerEntity.health, maxHealth: playerEntity.maxHealth,
      fatigue: Math.round((playerEntity.fatigue ?? 0) / 64), magicka: playerEntity.magicka ?? 0,
    }),
    endLines: (id) => rscLines(id),
  };
  // U4: the ONE player-damage door - every source (traps, melee,
  // arrows, spell missiles) lands here; death opens the overlay.
  function healPlayer(n) {
    if (n <= 0) return;
    playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + n);
    surfacePlayer();
  }
  // AUDIT 21 (hosts lane, F6): this host's arm is now the PRESENTER on the one
  // shared damage door, not a second door of its own. It was the only one of
  // the four writers that checked for death, which is exactly why the other
  // three could go on writing health raw and nobody noticed.
  setDeathPresenter(() => {
    if (!(activeOverlay instanceof DeathScreen)) activeOverlay = new DeathScreen({ onReset: () => endRunToTitleMenu(renderer) });   // D1
  });
  function hurtPlayer(dmg) {
    hurtEntity(playerEntity, dmg);
  }
  // S13 magicka sink (parallel to heal/hurt): the SpellPoints damage
  // family drives it. DecreaseMagicka floors at 0; surfaces for the
  // HUD/F8 readout. (The S13 restoreMagicka door left with the S15
  // (10,9) parity fix - that classic key is HEAL FATIGUE; DFU's
  // Heal-SpellPoints is potion-only with no classic key, so no spell
  // reaches a magicka-restore sink until potions/absorption ship.)
  function drainMagicka(n) {
    if (n <= 0) return;
    playerEntity.magicka = Math.max(0, (playerEntity.magicka ?? 0) - n);
    surfacePlayer();
  }
  // S15 fatigue sinks: RAW fatigue points (the effect door applies the
  // x64). SetFatigue clamps 0..MaxFatigue (max derived LIVE - a
  // drained strength lowers the ceiling).
  // S20: SetFatigue's exhaustion event - hitting 0 with health left
  // raises OnExhausted (once; the popup guard mirrors DFU's
  // displayingExhaustedPopup so rapid drains - the Somnalius case -
  // never stack collapses).
  let _exhaustedShowing = false;
  /** PlayerEntity.cs:396-400: 1.0, or 0.9 with the Athleticism career
   *  advantage (0.8 needs the Improved Athleticism enchantment, which
   *  the port has no source for). */
  const fatigueLossMultiplier = () =>
    (hasSpecialAbility(playerEntity.career, SPECIAL_ABILITY.Athleticism) ? 0.9 : 1.0);
  function drainFatigue(n) {
    if (n <= 0) return;
    playerEntity.fatigue = Math.max(0, (playerEntity.fatigue ?? 0) - n);
    surfacePlayer();
    if (playerEntity.fatigue <= 0 && playerEntity.health > 0 && !_exhaustedShowing) onExhausted();
  }
  /** PlayerEntity's OnExhausted handler: no enemies nearby (a foe
   *  actively seeing the player, or one inside the classic spawn
   *  band - the P13 senses fields) and dry feet = one rest hour (the
   *  clock advances 60 classic minutes, each pool recovers one
   *  hour's rate, Medical tallies); near enemies or swimming = the
   *  collapse KILLS. The text box is click-anywhere-to-close and
   *  holds the motor like every overlay. */
  function onExhausted() {
    const enemiesNearby = foes.some((f) => !f.dead && ((f.ai.detected && f.ai.inSight) || f.ai.wouldBeSpawned));
    const out = exhaustionOutcome({
      enemiesNearby, swimming: _activity.swimming, entity: playerEntity,
      day: false, inside: true,   // a dungeon rest: inside, no daylight (the InLight case pends exteriors with the rest UI)
    });
    const lines = out.inWater ? [EXHAUSTED_IN_WATER] : rscLines(out.textId);
    if (!activeOverlay && lines) { activeOverlay = new ActionTextBox(lines); _exhaustedShowing = true; }
    if (out.kind === 'rest') {
      classicMinutesRef.value += 60;   // RaiseTime(1 hour) - the round loop catches up the magic rounds
      playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + out.health);
      playerEntity.fatigue = Math.min(maxFatigue(playerEntity), (playerEntity.fatigue ?? 0) + out.fatigue);
      playerEntity.magicka = Math.min(playerEntity.maxMagicka ?? Infinity, (playerEntity.magicka ?? 0) + out.magicka);
      tallySkill(playerEntity, SKILLS.Medical);
      surfacePlayer();
    } else {
      playerEntity.health = 0;   // SetHealth(0): the fatal collapse
      surfacePlayer();
    }
  }
  function restoreFatigue(n) {
    if (n <= 0) return;
    playerEntity.fatigue = Math.min(maxFatigue(playerEntity), (playerEntity.fatigue ?? 0) + n);
    surfacePlayer();
  }
  const foeDrainMagicka = (ent) => (n) => { if (n > 0) ent.magicka = Math.max(0, (ent.magicka ?? 0) - n); };
  // The per-entity sink bundles the effect door consumes (S15 - one
  // definition; every applySpell/tick call site rides these).
  function restoreMagicka(n) {   // S19b: IncreaseMagicka (Aegrotat) - clamped at max
    if (n <= 0) return;
    playerEntity.magicka = Math.min(playerEntity.maxMagicka ?? Infinity, (playerEntity.magicka ?? 0) + n);
    surfacePlayer();
  }
  const playerSinks = { hurt: hurtPlayer, heal: healPlayer, drainMagicka, drainFatigue, restoreFatigue, restoreMagicka, say: (l) => hudText.add(l) };   // S21: concealment start messages
  const foeSinks = (f) => ({
    hurt: (n) => damageFoe(f, n),
    heal: (n) => { f.entity.health = Math.min(f.entity.maxHealth ?? Infinity, f.entity.health + n); },
    drainMagicka: foeDrainMagicka(f.entity),
    restoreMagicka: (n) => { if (n > 0) f.entity.magicka = Math.min(f.entity.maxMagicka ?? Infinity, (f.entity.magicka ?? 0) + n); },
    drainFatigue: (n) => { if (n > 0) f.entity.fatigue = Math.max(0, (f.entity.fatigue ?? 0) - n); },
    restoreFatigue: (n) => { if (n > 0) f.entity.fatigue = Math.min(maxFatigue(f.entity), (f.entity.fatigue ?? 0) + n); },
  });
  // M3: THE ONE CAST ENGINE. dungeonContext's audited player-cast stack
  // moved to scenes/hostMagic.js (M1) and every host now consumes the
  // same implementation - this host's enemy missiles and arrows stay
  // below and reuse the engine's explodeAt/applySpellToPlayer. The
  // absorb context is the dungeon constant (inside, no daylight).
  const magic = createPlayerMagic({
    // hudText.add, not `say?.()`. There is no `say` in this scope — the
    // optional-call syntax made an undefined identifier look like a
    // guarded one, so it read as safe and was a ReferenceError waiting
    // for the first Recall cast in a standalone dungeon. Every other
    // line in this file speaks through hudText, including the one four
    // below it.
    onTeleport: () => hudText.add('(Recall pends in the standalone dungeon - the anchor machinery lives in the streaming ?world host)'),   // TP-slice INTERIM
    renderer, audio, getTexture, uploadRecord, uploadRecordFrame,
    collider,
    playerEntity, playerSinks,
    say: (l) => hudText.add(l),
    surfacePlayer,
    foes: () => foes,
    foeSinks,
    absorbCtx: () => ({ inside: true, day: false }),
  });
  // AUDIT 24: `chargen: false` says an OUTER host already owns the
  // wizard - worldModes passes it, the standalone dungeon scene does
  // not. Without it the classic start ran two wizards at once.
  if (!playerEntity.chargenDone && opts.chargen !== false) {
    if (Number.isInteger(opts.playerClass)) {
      // AUDIT 17f: the shared headless skip. This copy minted a
      // character with an EMPTY bag - no clothes, no weapon, no gold -
      // because S3d landed the kit on the flow and the font-less
      // fallback and missed this third path.
      await applyHeadlessChargen(playerEntity, opts.playerClass, { fetchBytes, spellsByIndex });
    } else {
      // U2b: the real flow - all 18 careers load; the host routes
      // input and draws the overlay until done, then applies the
      // HAND-distributed result. The Warrior-16 default is GONE.
      // S3c/U9 / ONE DFU MEMBER, ONE EXPORT: the career load lived
      // here AND (once the exterior hosts gained chargen) would have
      // been copied there. Both use systems/chargenSession.js.
      // U10 / THE FOUR HOSTS RULE: the classic screens warm here too -
      // the dungeon host runs the same flow, and an unwarmed art set
      // would silently leave it on the interim text panels.
      await preloadChargenArt({ renderer, fetchBytes, palette });
      // AUDIT 17i: this host no longer CONSTRUCTS a flow. It built its
      // own by hand while the exterior hosts went through the shared
      // session, and so structurally missed every dependency the flow
      // grew - the starting spellbook (17f), the starting kit (17f)
      // and the biography (17h). One seam mints it for everyone.
      chargenFlow = (await createChargenFlow(fetchBytes)).flow;
      activeOverlay = chargenFlow;
    }
  }


  // U1: the classic HUD (vitals bottom-left, compass bottom-right) -
  // surfaces the Systems stats every frame; art-gated like all data.
  /** AUDIT 17f / ONE DFU MEMBER, ONE EXPORT: the completion the KEY
   *  seam and the U14 POINTER seam share. It was already the second
   *  copy of finishChargen once; it is not going to become a third. */
  function finishChargenHere() {
    finishChargen(playerEntity, chargenFlow.result(), spellsByIndex);
    chargenFlow = null;
  }

  function chargenInputFallback() {
    // no font art: the flow cannot render - fall back to the headless
    // roll (loud) so the game remains playable without ARENA2 UI art.
    console.warn('[chargen] FONT art unavailable; falling back to the headless roll');
    // U20a follow-up / THE ONE SEAM: this path had hand-rolled its
    // own apply code, so every field the flow grew had to be
    // remembered here too - 17f caught it for the spellbook, and it
    // had ALREADY regrown for U20a's isCustom and custom
    // reputations. The career and the class index are the fallback's
    // own (the roll is headless), everything else rides the shared
    // applyCreationExtras that finishChargen uses.
    const r = {
      career: chargenFlow.career, careerIndex: chargenFlow.classIndex,
      isCustom: chargenFlow.isCustom, customReps: chargenFlow.customReps,
    };
    createCharacter(playerEntity, r.career, r.careerIndex);
    applyCreationExtras(playerEntity, r, spellsByIndex);
    surfacePlayer();
    chargenFlow = null;
  }
  const hudArt = await loadHud({ fetchBytes, ImgFile, palette, renderer });
  let hudFont = null;
  try {
    hudFont = makeFont(renderer, new FntFile().load(await fetchBytes('FONT0003.FNT')), 'FONT0003');
  } catch { console.warn('[hud] FONT0003.FNT unavailable; HUD text disabled'); }
  function fireCast(index, origin) {
    const spell = spellsByIndex?.get(index);
    if (!spell || !origin) { if (!spellsByIndex) console.warn('[spellcast] SPELLS.STD unavailable; CastSpell no-op'); return; }
    // L2-slice (AUDIT 23 magic-8) - DaggerfallAction.CastSpell
    // (:497-518): a CasterOnly trap spell is READIED ON THE PLAYER
    // FOR FREE (SetReadySpell(index, true)) - no missile at all.
    if (spell.rangeType === 0) { magic.readySpell(spell, { free: true }); return; }
    // L2-slice (magic-9): a trap AreaAroundCaster payload rides a
    // missile with NO caster, and the missile's AoC arm requires one
    // (DaggerfallMissile.cs:279-282) - the classic no-op, loudly.
    if (spell.rangeType === 3) { console.warn('[spellcast] trap AreaAroundCaster has no caster; verbatim no-op'); return; }
    const from = [origin[0], origin[1] + 40 * GLOBAL_SCALE, origin[2]];
    // Audit 2026-08-16e F2: trap bundles are CASTERLESS - DFU's
    // CalculateCasterLevel(null) = 1 for magnitude, duration AND
    // chance (the pre-audit shape fell back to the player's level).
    // L2-slice (magic-8): a ByTouch trap payload RETARGETS to
    // SingleTargetAtRange (:512-517) - the touch flies to its mark.
    const payload = spell.rangeType === 1 ? { ...spell, rangeType: 2 } : spell;
    missiles.push({ spell: payload, casterLevel: 1, pos: from, dir: null, age: 0, batch: null });
  }

  // S5: player casting - ?spell=N readies a SPELLS.STD entry for the
  // probes (castProbe passes it explicitly); otherwise NOTHING is
  // readied until the spellbook does it (toggleSpellbook's ready()).
  // The old fallthrough that readied the first ranged damage spell in
  // the file - Wizard's Fire, index 7 - for EVERY character was an S5
  // debug leftover: DFU's SetReadySpell fires only from explicit
  // selection, never automatically. The cost comes from
  // calculateCastCost's per-effect tables, and rangeTypes 0/1/3 are
  // handled beside 2/4 below.
  if (spellsByIndex && Number.isInteger(opts.playerSpell)) {
    magic.setReadiedByIndex(opts.playerSpell, spellsByIndex);
  }
  // Combat bows (via S5 missiles): arrows are missiles carrying a
  // WEAPON instead of a spell - element None, model 99800 oriented
  // along flight (DFU ShootBow / WeaponManager verbatim shape). On a
  // landed enemy arrow, ONE recoverable Arrow joins the TARGET'S
  // items (BowDamage's classic charm). Crouch pass-over pends.
  function fireArrow(from, dir, weapon, fromPlayer, shooterFoe = null) {
    missiles.push({ arrow: true, weapon, fromPlayer, shooterFoe, pos: [...from], dir: [...dir], age: 0, batch: null, draw: null });
  }
  // S16: the enemy cast - "enemies always cast ready spell instantly
  // once queued" (EntityEffectManager.Update): spend the S10 cost
  // (DecreaseMagicka floors at 0 - DFU casts even when the cost
  // exceeds the pool; selection only gates magicka > 0), play the
  // element cast sound from the caster (EnemyCastReadySpell), then
  // CasterOnly assigns to SELF and everything else looses a missile
  // that aims at the player mid-capsule at fire time (the shared
  // trap-missile shape). RESIDUAL (honest): enemy missiles resolve
  // against the player only - foe-vs-foe friendly fire pends the
  // missile seam's target sweep.
  // X3-slice: the cast EXECUTOR is the shared castEnemySpellShared
  // (characters/enemyCasting.js) - one release for both foe pools;
  // this host binds its deps once. The magic-15 silence gate, the
  // player-priced cost, the magic-9 AoC arm and the missile shape
  // all live in the shared member now.
  function castEnemySpell(f, spell, noSpellPointCost = false) {
    if (!foeDeps?.castEnemySpell) return;   // the foe subsystem degraded (its loud boot warning already fired)
    foeDeps.castEnemySpell(f, spell, {
      noSpellPointCost, playerEntity, playerFeet: lastPlayerFeet,
      applySpell, foeSinks, calculateCastCost, silenceBlocksCast,
      playCastSound: (element, from) => audio.play3d(SPELL_CAST_SOUND[element] ?? SPELL_CAST_SOUND[4], from, 1, { maxDistance: 16 }),
      explodeAt: magic.explodeAt,
      fireMissile: (from, spell2, casterLevel, foe) =>
        missiles.push({ spell: spell2, casterLevel, casterFoe: foe, pos: from, dir: null, age: 0, batch: null, fromPlayer: false }),
    });
  }
  async function ensureArrowModel(m) {
    if (m.draw !== null) return;
    m.draw = false;
    const gpu = await getGpuMesh(99800);
    // THE CRASH FROM THE FIELD (2026-08-21). This used to push
    // `{ gpu, object: { matrix: null } }` and leave the matrix for the
    // NEXT updateMissiles pass to fill. But the push lands in a
    // MICROTASK - this is async and its one caller does not await it -
    // and both hosts draw dynamicDraws BEFORE they call drawFoes
    // (dungeon.js:365 against :391; worldModes.js:951 against :959).
    // So the very next frame drew the arrow with a NULL matrix, and
    // `uniformMatrix4fv(uModel, false, null)` throws - Float32List is
    // a non-nullable WebIDL union. Firing a bow killed the frame loop,
    // one frame later, with a stack of drawMesh and its caller and
    // nothing else. The matrix is built HERE, so an entry in the list
    // is always drawable.
    //
    // The dead check is the other half: a point-blank hit retires the
    // arrow while this await is still pending, and retireMissile's
    // splice has already run and found nothing - so the microtask
    // would push an ORPHAN that updateMissiles skips for ever
    // (`if (m.dead) continue`), leaving a null-matrix entry that threw
    // on EVERY frame rather than one. Its sibling in arrowFlight.js
    // has had this check all along.
    if (!gpu || m.dead) return;
    m.draw = { gpu, object: { matrix: arrowMatrix(m) } };
    dynamicDraws.push(m.draw);
  }
  function arrowMatrix(m) {
    const yaw = Math.atan2(m.dir[0], m.dir[2]) * 180 / Math.PI;
    const pitch = Math.asin(-Math.max(-1, Math.min(1, m.dir[1]))) * 180 / Math.PI;
    return trs(m.pos[0], m.pos[1], m.pos[2], pitch, yaw, 0);
  }
  // M3: applySpellToPlayer / explodeAt / tallyCastSkills / the four
  // cast arms live in the ONE engine (scenes/hostMagic.js); the enemy
  // half below calls magic.explodeAt / magic.applySpellToPlayer.
  // S2: treasure piles - random markers (199.19) roll an icon +
  // generate by the dungeon-type key; fixed 216 flats keep their
  // record. Per-pile single batches so pickup can remove one pile.
  const lootPiles = [];
  {
    const lootKey = DUNGEON_LOOT_KEYS[dfLocation.mapTableData.dungeonType] ?? '-';
    for (const b of dungeon.blocks) {   // the PLACED blocks (layout + origins) - NOT the BlocksFile reader parameter (the S2 black-screen bug: 't is not iterable' at boot with real data)
      for (const m of b.layout.markers) {
        const isRandom = !m.archive && m.record === RANDOM_TREASURE_MARKER_RECORD;
        const isFixed = m.archive === RANDOM_TREASURE_ARCHIVE;
        if (!isRandom && !isFixed) continue;
        const record = isFixed ? m.record : RANDOM_TREASURE_ICONS[Math.floor(Math.random() * RANDOM_TREASURE_ICONS.length)];
        const items = generateLootItems(lootKey, { level: playerEntity.level, gender: playerEntity.gender });   // AUDIT 23 (items-1): LootTables.cs:229/:237 pass the PLAYER's gender
        lootPiles.push({ pos: [m.x + b.originX, m.y, m.z + b.originZ], record, items, batch: null });
      }
    }
  }

  const flatAnims = new FlatAnimator();   // FA1
  const billboardBatches = [];
  // AUDIT 24 (wave 39): the blood pool registers into the SAME
  // persistent draw list the missile impact uses (:1395/:1404), so a
  // splash appears and disappears the way an impact flash does.
  const hitEffects = createHitEffects({
    renderer, getTexture, uploadRecordFrame,
    onSpawn: (b) => billboardBatches.push(b),
    onRetire: (b) => { const i = billboardBatches.indexOf(b); if (i >= 0) billboardBatches.splice(i, 1); },
  });
  for (const [key, centers] of flatGroups) {
    const [archive, record] = key.split('_').map(Number);
    // Flats keep their original archives (the table remaps walls);
    // RDB AddFlat pivots at the raw position - shift to base-centered.
    const t = await getTexture(archive);
    if (!t || record >= t.recordCount) continue;
    uploadRecord(archive, record);
    const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
    const based = centers.map(([x, y, z]) => [x, y - size.h / 2, z]);
    const batch = renderer.createBillboardBatch(archive, record, size, based);
    armFlatAnim(batch, t, archive, record, flatAnims, uploadRecordFrame);
    billboardBatches.push(batch);
  }

  const flicker = new CityLightAnimator(lights.length, lights.map((l) => l.range));

  // C8 E1: per-frame foes pass - advance each rig on the canonical
  // runtime and composite through the SHARED pixelize pass. Owned by
  // the context so both hosts (modal dungeon frame, standalone scene)
  // call one implementation.
  // ON ICE (C17): the voxel foe-rig sprite pass - every foe renders
  // as a classic mobile now; the loader stays for a reversible thaw.
  let _drawSprite = null;
  async function _loadSprite() {
    if (!_drawSprite) _drawSprite = (await import('../render/characterSprite.js')).drawCharacterSprite;
  }
  if (foes.some((f) => f.rig)) await _loadSprite();
  // S2: one billboard batch per treasure pile (removable on pickup);
  // grounded like corpses (AlignBillboardToGround semantics).
  for (const pile of lootPiles) {
    const t = await getTexture(RANDOM_TREASURE_ARCHIVE);
    if (!t || pile.record >= t.recordCount) continue;
    uploadRecord(RANDOM_TREASURE_ARCHIVE, pile.record);
    const size = scaledBillboardSize(t.getSize(pile.record), t.getScale(pile.record));
    const g = floorLanding(collider, [pile.pos[0], pile.pos[1] + 0.2, pile.pos[2]]);
    pile.pos = g;
    pile.half = [size.w / 2, size.h / 2];
    // Bottom-anchored shader: the base IS the ground point (the +h/2
    // center-anchor holdover floated piles - C11 audit 08-17).
    pile.batch = renderer.createBillboardBatch(RANDOM_TREASURE_ARCHIVE, pile.record, size, [[g[0], g[1], g[2]]]);
    // FA1 slice 2: the SAME rule decides, and the data answers. DFU
    // gives every billboard the one AnimateBillboard loop and lets
    // frameCount settle it - a single-frame treasure pile arms nothing
    // and costs nothing, and a record that does carry frames moves.
    armFlatAnim(pile.batch, t, RANDOM_TREASURE_ARCHIVE, pile.record, flatAnims, uploadRecordFrame);
    billboardBatches.push(pile.batch);
  }

  // C8 E3c: the player's weapon rides the SHARED machine; the host
  // feeds gesture deltas (attackInput) and the hit frame resolves
  // here against the foes - reach/view/LOS verbatim, damage through
  // the full chain, reactions on the shipped clips, death -> the
  // extracted corpse flat replaces the rig.
  // The TRUE classic FP weapon (design pivot 2026-08-17), now the
  // SHARED host rig (C10 fold - combat/weaponRig.js owns the art
  // cache, the ShowWeapons legs, ToggleSheath + DrawWeapon 78, the
  // zero-arrow bow guard, the gesture buffer, and the swing-sound
  // edge; the audited laws moved verbatim). The weapon exists even
  // with NO foes now - host parity with the other rig mounts, and it
  // un-gates the listener/ambient pass below, which the old
  // foes-only playerWeapon had silently disabled in foe-less
  // dungeons. spellArmed = the HasReadySpell / IsPlayingAnim leg.
  let _weaponCanvas = null;   // the context sees a canvas only per drawFoes call
  const weaponRig = createWeaponRig({
    renderer, canvas: () => _weaponCanvas, fetchBytes, palette, audio, entity: playerEntity,
    bindWorn: opts.playerWeapon !== 'bow',   // AUDIT 17e F17: the ?weapon=bow debug flag keeps its scripted weapon
    say: (l) => hudText.add(l),
    spellArmed: () => magic.spellArmed(),
  });
  const playerWeapon = weaponRig.playerWeapon;   // the dungeon-side combat consumers read it
  if (opts.playerWeapon === 'bow') {
    // Combat bows: ?weapon=bow readies a plain Short Bow (template
    // 129) for scripted demos - the native inventory/equip UI shipped
    // at U8e/U8g (AUDIT 23 retired the stale 'pends' note).
    playerWeapon.weapon = { name: 'Short Bow', ...createWeapon(129, 0) };   // scripted demo: the rig's worn bind is off for this context (see createWeaponRig bindWorn)
  }
  const corpses = [];
  async function spawnCorpse(f) {
    const ct = ENEMY_BASICS[f.mobileType]?.corpseTexture;
    // C12: a flyer dies mid-air - the corpse lands on the floor
    // below (AlignBillboardToGround semantics for every corpse).
    const p = floorLanding(collider, [f.ai.feet[0], f.ai.feet[1] + 0.1, f.ai.feet[2]]);
    if (!ct) return;
    const t = await getTexture(ct.archive);
    if (!t || ct.record >= t.recordCount) return;
    // SL2 (save-load-2): a backward load can RESURRECT this foe while
    // the texture warms - a corpse must never mint for a live foe.
    if (!f.dead) return;
    uploadRecord(ct.archive, ct.record);
    const size = scaledBillboardSize(t.getSize(ct.record), t.getScale(ct.record));
    // The billboard shader BOTTOM-anchors (position = base): the old
    // +h/2 was a center-anchor holdover and floated every corpse by
    // half its height (C11 audit 08-17; the static-flat path shifts
    // DOWN for the same reason).
    const batch = renderer.createBillboardBatch(ct.archive, ct.record, size, [[p[0], p[1], p[2]]]);
    // Same rule, same seam: a corpse record is single-frame in classic
    // so this arms nothing today, but DFU gives corpses the same
    // billboard and lets the data decide, and so does this.
    armFlatAnim(batch, t, ct.archive, ct.record, flatAnims, uploadRecordFrame);
    f.corpseBatch = batch;   // SL2: the rewind frees a corpse BY ITS FOE
    corpses.push(batch);
    billboardBatches.push(batch);   // hosts draw + destroy() frees
  }
  function playerAttackInput(dx, dy, held) {   // host mouse events buffer here
    if (playerWeapon.sheathed) return;   // WeaponManager verbatim: no attack processing while sheathed (audit 2026-08-17)
    if (magic.interceptAttack(held)) return;   // the armed click casts, no swing
    weaponRig.attackInput(dx, dy, held);
  }
  function resolvePlayerHit(eye, inViewFn, playerFeet, lookDir) {
    // AUDIT 23 (combat-14): entity colliders resolve FIRST
    // (WeaponManager.cs:1048-1056 foreach over hitColliders);
    // WeaponEnvDamage runs only in the no-entity fallback (:1057-1064
    // "if no hits were detected from bounds check") - env-first let a
    // door in reach eat the swing over the foe standing at it. The
    // C10-fold rules stand: a bashed door consumes the swing,
    // Receive(Attack) lets it continue, geometry occludes - and the
    // foe-less contexts (mobile, foe deps still loading - the
    // 2026-08-17 live crash) fall straight to the fallback below.
    if (!foeDeps) return lookDir ? (envAttack(actions, collider, eye, lookDir, Math.random), false) : false;
    // E3d: backstab facing per foe, verbatim IsBackFacing (records
    // 3/4 of the 8-orientation wheel); the chance = the player's
    // Backstabbing skill, tallied inside CalculateBackstabChance
    // (FormulaHelper.cs:975-990 - the tally was ported nowhere).
    for (const f of foes) if (!f.dead) f._backFacing = foeDeps.isBackFacing(f.ai.yaw, f.ai.feet, playerFeet);
    const live = foes.filter((f) => !f.dead);
    const canSee = (f) => {
      const c = [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]];   // foe center (mid-capsule)
      const dx = c[0] - eye[0], dy = c[1] - eye[1], dz = c[2] - eye[2];
      const dist = Math.hypot(dx, dy, dz);
      const l = dist || 1;
      const hit = collider.raycast(eye, [dx / l, dy / l, dz / l], dist);
      return { dist, inView: inViewFn(c), losClear: !Number.isFinite(hit) || hit >= dist - 1e-3 };
    };
    // (the module-level playerEntity import IS foeDeps.playerEntity -
    // the old shadowing destructure was the null read that crashed)
    let hitEnemy = false;
    // C2-slice (combat-17): the player's 20% attack grunt fires once
    // per hit frame, never for a bow (this path is melee-only).
    const grunt = playerAttackGrunt(playerEntity, false, Math.random);   // explicit: this path's resolveHit rides Math.random too (no injected seam here)
    if (grunt && grunt.clip >= 0) audio.playOneShot(grunt.clip, 1);
    for (const { foe, damage } of playerWeapon.resolveHit(live, playerEntity, canSee, Math.random, (f) => backstabChanceOf(playerEntity, !!f._backFacing), (l) => hudText.add(l),
      (f, pt) => inflictPoison(f.entity, pt, false, { currentMinute: Math.floor(classicMinutesRef.value) }))) {   // C2-slice (combat-11): the player's poisoned blade infects its victim
      // WeaponDamage returns true for a CONNECTING swing even at zero
      // damage (WeaponManager.cs:617-637 falls through to
      // DecreaseHealth/HandleAttackFromSource and returns true), so
      // hitEnemy - and with it the skill tallies at :423-435 - is set
      // before the damage branch.
      hitEnemy = true;
      if (damage <= 0) {
        // WeaponManager.cs:609-615, the zero-damage arm. The old code
        // played :483's WALL pair (Hit2/Parry6), a branch DFU's own
        // comment marks "not in classic".
        const snd = zeroDamageHitSound({
          weapon: playerWeapon.weapon, arrowHit: false,
          parrySounds: !!ENEMY_BASICS[foe.mobileType]?.parrySounds, roll: Math.random(),
        });
        if (snd?.at === 'enemy') audio.play3d(snd.sound, foe.ai.feet, 1.1, { maxDistance: 16 });
        else if (snd) audio.playOneShot(snd.sound, 1.1);
        continue;
      }
      // EnemySounds.PlayHitSound at the struck foe, weapon-aware
      audio.play3d(hitSoundFor(playerWeapon.weapon), foe.ai.feet, 1.1, { maxDistance: 16 });   // rides the foe's source shape
      // WeaponManager.cs:569-573 - the splash sits right beside the hit
      // sound and takes the struck foe's OWN BloodIndex. DFU has a
      // raycast impactPosition here; the port resolves melee by yaw
      // cone and distance, so the body centre (DFU's own no-raycast
      // formula, EnemyAttack.cs:326-328) stands in.
      hitEffects?.showBloodSplash(ENEMY_BASICS[foe.mobileType]?.bloodIndex ?? 0,
        bloodCentre(foe.ai.feet, foe.ai.height));
      // C2-slice (combat-17): a damaged CLASS foe cries out 40% of
      // the time (heavyDamage = a quarter of max health in one hit).
      const pain = enemyPainVoice(foe, damage);
      if (pain && pain.clip >= 0) audio.play3d(pain.clip, [foe.ai.feet[0], foe.ai.feet[1] + 0.9, foe.ai.feet[2]], 1, { maxDistance: 16 });
      damageFoe(foe, damage, playerFeet, lookDir);   // C15: the attack ray knocks back; rigs also stagger (HurtFront/Back)
    }
    // combat-14: the no-entity fallback - only a swing that connected
    // with NO foe may bash the environment.
    if (!hitEnemy && lookDir) envAttack(actions, collider, eye, lookDir, Math.random);
    return hitEnemy;
  }
  // S3b: the classic clock for skill-raise checks - dt * TimeScale
  // (DFU default 12) in minutes; RaiseSkills gates itself at 360.
  // AUDIT 21 F2: a READ-THROUGH on the one world clock. This used to be a
  // private accumulator per built context, so every dungeon entry started
  // the day count over - which made a disease caught underground get
  // LONGER each time you walked out, and re-fired SongManager's "a new day
  // re-picks" on every crawl.
  const classicMinutesRef = {
    get value() { return worldMinutes(); },
    set value(v) { setWorldMinutes(v); },
  };
  async function ensureMissileBatch(m) {
    if (m.batch !== null) return;
    m.batch = false;   // in-flight guard
    const archive = missileArchive(m.spell.element);
    const t = await getTexture(archive);
    if (!t) return;
    // The arrow's bug, twice more: this is async and `m.batch = false`
    // is the in-flight guard, so a missile that retires while its
    // texture warms leaves retireMissile's splice nothing to find -
    // and then the microtask pushes a batch for a DEAD missile that
    // nothing ever removes, drawn at its fire position for the rest of
    // the scene. Check before publishing.
    if (m.dead) { m.batch = null; return; }
    uploadRecord(archive, 0);
    const size = scaledBillboardSize(t.getSize(0), t.getScale(0));
    m.firePos = [...m.pos];
    m.batch = renderer.createBillboardBatch(archive, 0, size, [[m.firePos[0], m.firePos[1], m.firePos[2]]]);
    // FA1 slice 2: the missile flat ANIMATES while it flies -
    // DaggerfallMissile.cs:605 sets BillboardFramesPerSecond (5) on the
    // billboard it makes at :601. Frozen on frame 0, a fireball was a
    // photograph of a fireball.
    armFlatAnim(m.batch, t, archive, 0, flatAnims, uploadRecordFrame, { fps: MISSILE_FPS });
    billboardBatches.push(m.batch);
  }
  function retireMissile(m) {
    if (m.draw && m.draw.object) {
      const di = dynamicDraws.indexOf(m.draw);
      if (di >= 0) dynamicDraws.splice(di, 1);
    }
    if (m.batch) {
      flatAnims.remove(m.batch);   // FA1: a destroyed batch must not keep a clock
      const bi = billboardBatches.indexOf(m.batch);
      if (bi >= 0) billboardBatches.splice(bi, 1);
      renderer.destroyBillboardBatch(m.batch);
    }
    m.dead = true;
  }
  function updateMissiles(dt, playerFeet) {
    while (_pendingCasts.length) { const c = _pendingCasts.shift(); fireCast(c.index, c.origin); }
    if (!missiles.length || !playerFeet) return;
    const target = [playerFeet[0], playerFeet[1] + 0.9, playerFeet[2]];   // mid-capsule, as enemy melee aims
    for (const m of missiles) {
      if (m.dead) continue;
      if (!m.arrow) ensureMissileBatch(m);   // arrows render as the 99800 model, not an element billboard
      if (!m.dir) {   // verbatim: normalized (player - object), locked at fire time
        const d = [target[0] - m.pos[0], target[1] - m.pos[1], target[2] - m.pos[2]];
        const l = Math.hypot(...d) || 1;
        m.dir = [d[0] / l, d[1] / l, d[2] / l];
      }
      m.age += dt;
      if (m.age > MISSILE_LIFESPAN_S) { retireMissile(m); continue; }
      const step = MISSILE_SPEED * dt;
      const hitWall = collider.raycast(m.pos, m.dir, step + MISSILE_COLLIDER_RADIUS);
      if (Number.isFinite(hitWall) && hitWall <= step + MISSILE_COLLIDER_RADIUS) {
        // AUDIT 23 (magic-2) - DaggerfallMissile.cs:399-402 DoCollision:
        // an AreaAtRange payload explodes AT THE IMPACT POINT whatever
        // was struck; the port retired wall hits with no payload.
        if (m.spell?.rangeType === 4) {
          const impact = [m.pos[0] + m.dir[0] * hitWall, m.pos[1] + m.dir[1] * hitWall, m.pos[2] + m.dir[2] * hitWall];
          const wCaster = m.casterFoe ? { entity: m.casterFoe.entity, sinks: foeSinks(m.casterFoe) } : null;
          magic.explodeAt(impact, m.spell, m.casterLevel ?? playerEntity.level, playerFeet, wCaster);
        }
        retireMissile(m);
        continue;
      }
      m.pos[0] += m.dir[0] * step; m.pos[1] += m.dir[1] * step; m.pos[2] += m.dir[2] * step;
      // The batch was built ONCE at the fire position; flight rides
      // the batch's origin uniform (zero GL churn - the same thrash
      // class the engine audit killed stays killed).
      if (!m.arrow && m.batch) m.batch.origin = [m.pos[0] - m.firePos[0], m.pos[1] - m.firePos[1], m.pos[2] - m.firePos[2]];
      if (m.arrow) {
        ensureArrowModel(m);
        if (m.draw && m.draw.object) m.draw.object.matrix = arrowMatrix(m);
        if (m.fromPlayer) {
          for (const f of foes) {
            if (f.dead) continue;
            const fx = f.ai.feet[0] - m.pos[0], fy = f.ai.feet[1] + 0.9 - m.pos[1], fz = f.ai.feet[2] - m.pos[2];
            if (Math.hypot(fx, fy, fz) <= MISSILE_COLLIDER_RADIUS + 0.45) {
              // AUDIT 18: an arrow hit runs the SAME
              // FormulaHelper.CalculateAttackDamage the melee swing
              // does (WeaponManager.cs:547) - `attacker == player`, so
              // the swing modifiers, the backstab chance and the
              // enemy-type modifier all apply. The port passed the
              // weapon alone, so every shot lost the target group, the
              // swing mods and any chance of a backstab.
              const _swing = SWING_MODS[playerWeapon.machine.state] ?? { damage: 0, toHit: 0 };
              const _back = foeDeps ? foeDeps.isBackFacing(f.ai.yaw, f.ai.feet, playerFeet) : false;
              const dmg = foeDeps ? foeDeps.calculateAttackDamage(playerEntity, f.entity, {
                weapon: m.weapon,
                // AUDIT 18: the group is no longer passed in - calculateAttackDamage
                // derives it from the TARGET ENTITY, verbatim to
                // GetBonusOrPenaltyByEnemyType (FormulaHelper.cs:1037-1052).
                damageMod: _swing.damage, toHitMod: _swing.toHit,
                backstabChance: backstabChanceOf(playerEntity, _back),
                onInflictPoison: (att, tgt, pt) => inflictPoison(f.entity, pt, false, { currentMinute: Math.floor(classicMinutesRef.value) }),   // C2-slice (combat-11): a poisoned arrow doses ITS mark
                say: (l) => hudText.add(l),   // C-slice: equipment breaks speak
              }) : 0;
              if (dmg > 0) {
                // C2-slice (combat-17): the arrow-struck class foe cries out too
                const pain = enemyPainVoice(f, dmg);
                if (pain && pain.clip >= 0) audio.play3d(pain.clip, [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16 });
                damageFoe(f, dmg, null, m.dir);   // C15: arrows knock along their flight
              }
              addItem(f.entity.items, { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 });   // BowDamage verbatim: the arrow is recoverable from the target
              retireMissile(m);
              break;
            }
          }
        } else if (playerFeet) {
          const dx2 = target[0] - m.pos[0], dy2 = target[1] - m.pos[1], dz2 = target[2] - m.pos[2];
          if (Math.hypot(dx2, dy2, dz2) <= MISSILE_COLLIDER_RADIUS + 0.45) {
            const shooter = m.shooterFoe;
            // C2-slice (AUDIT 23 combat-10): an arrow reaching the
            // player rides the same ApplyDamageToPlayer the melee
            // swing does (BowDamage :141) - so the Dodging tally
            // fires here too, hit roll or no.
            tallySkill(playerEntity, SKILLS.Dodging, 1);
            const dmg = foeDeps && shooter ? foeDeps.calculateAttackDamage(shooter.entity, playerEntity, {
              weapon: m.weapon,   // AUDIT 18: target group derived from the entity (isPlayer -> Humanoid)
              onInflictPoison: (att, tgt, pt) => inflictPoison(playerEntity, pt, false, { currentMinute: Math.floor(classicMinutesRef.value) }),   // S19b: poisoned arrows
              say: (l) => hudText.add(l),   // C-slice
            }) : 0;
            hurtPlayer(dmg);
            addItem(playerEntity.items, { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 });
            surfacePlayer();
            retireMissile(m);
          }
        }
        continue;
      }
      // M3: player SPELL missiles fly in the engine now; this loop
      // carries enemy spells (and, upstream, both sides' arrows).
      const dx = target[0] - m.pos[0], dy = target[1] - m.pos[1], dz = target[2] - m.pos[2];
      if (Math.hypot(dx, dy, dz) <= MISSILE_COLLIDER_RADIUS + 0.45) {   // missile radius + player capsule radius
        // S16: enemy missiles carry their caster (level + the
        // transfer heal-back pair); trap casts stay casterless (DFU
        // action casters are null) on the S4b player-level shape.
        const mCaster = m.casterFoe ? { entity: m.casterFoe.entity, sinks: foeSinks(m.casterFoe) } : null;
        if (m.spell.rangeType === 4) magic.explodeAt(m.pos, m.spell, m.casterLevel ?? playerEntity.level, playerFeet, mCaster);
        else magic.applySpellToPlayer(m.spell, m.casterLevel ?? playerEntity.level, mCaster);
        retireMissile(m);
      }
    }
    // AUDIT 24 (the seven-slice sweep): EVERY ALLOCATION HAS AN OWNER,
    // and so does every LIST ENTRY. retireMissile frees the batch and
    // sets m.dead, but nothing removed the entry - so `missiles` grew
    // for the whole dungeon session and this loop walked every corpse
    // of every arrow and trap bolt, every frame, for ever. hostMagic
    // has had exactly this line all along (:318-320); the dungeon's
    // sibling loop never got it. Safe against the in-flight batch
    // microtask, which publishes only `if (!gpu || m.dead) return`
    // against the object it closed over, not against this list.
    for (let i = missiles.length - 1; i >= 0; i--) if (missiles[i].dead) missiles.splice(i, 1);
  }

  // S12: the dungeon world snapshot. Foes persist by SPAWN ORDER
  // (marker order is deterministic per location rebuild); piles by
  // index; action objects by their stable keys. Movers recompute
  // their matrix from {state, t} on the next tick, so those two plus
  // activationCount ARE the mover.
  const _locationKey = `dungeon:${dfLocation?.dungeon?.recordElement?.header?.locationId ?? 'probe'}`;
  function collectWorld() {
    return {
      foes: foes.map((f) => ({
        health: f.entity.health, dead: !!f.dead,
        feet: [...f.ai.feet], yaw: f.ai.yaw,
        items: (f.entity.items ?? []).map((it) => ({ ...it })),
        // CH4 (the senses verify pass): SerializableEnemy carries
        // isHostile + hasEncounteredPlayer (:113-114, restored at
        // :182-183) and currentMagicka (:112/:178 - a discharged
        // caster must not refill on load). The port's halves.
        hostile: f.ai.isHostile !== false,
        encountered: !!f.ai.hasEncounteredPlayer,
        magicka: f.entity.magicka ?? 0,
      })),
      piles: lootPiles.map((p) => ({ items: p.items.map((it) => ({ ...it })) })),
      // AUDIT 23 (save-load-4): player-dropped piles are containers in
      // DFU's save (LootContainerData_v1) - without them a boot load
      // vanished drops and a backward load duplicated them.
      droppedLoot: droppedLoot._piles.map((p) => ({
        pos: [...p.pos], record: p.record, items: p.items.map((it) => ({ ...it })),
      })),
      actions: [...actions.objects.values()].map((o) => ({
        key: o.key, state: o.state, t: o.t ?? 0,
        activationCount: o.activationCount ?? 0,
        ...(o.kind === 'door' ? { lock: o.currentLockValue } : {}),   // P10: door locks persist
      })),
    };
  }
  function applyWorld(w) {
    w.foes?.forEach((sf, i) => {
      const f = foes[i];
      if (!f) return;
      f.entity.health = sf.health;
      f.entity.items = sf.items.map((it) => ({ ...it }));
      f.ai.feet[0] = sf.feet[0]; f.ai.feet[1] = sf.feet[1]; f.ai.feet[2] = sf.feet[2];
      f.ai.yaw = sf.yaw;
      // CH4: the senses/resource halves restore when the save carries
      // them (:182-183 motor.IsHostile / senses.HasEncounteredPlayer,
      // :178 SetMagicka); saves from before CH4 leave the live state.
      if (sf.hostile != null) f.ai.isHostile = !!sf.hostile;
      if (sf.encountered != null) f.ai.hasEncounteredPlayer = !!sf.encountered;
      if (sf.magicka != null) f.entity.magicka = sf.magicka;
      if (sf.dead && !f.dead) { f.dead = true; spawnCorpse(f); }
      // SL2 (AUDIT 23 save-load-2): the BACKWARD rewind. DFU's load
      // REBUILDS the location and RestoreSaveData SETS the saved
      // truth per LoadID (SerializableEnemy.cs:176 SetHealth; only
      // data.isDead disables, :200-203) - a foe killed AFTER the
      // save stands alive again and its corpse container, absent
      // from the save, leaves with the rebuild. The port patches in
      // place: un-kill and free the corpse flat by its foe.
      else if (!sf.dead && f.dead) {
        f.dead = false;
        if (f.corpseBatch) {
          const ci = corpses.indexOf(f.corpseBatch); if (ci >= 0) corpses.splice(ci, 1);
          const bi = billboardBatches.indexOf(f.corpseBatch); if (bi >= 0) billboardBatches.splice(bi, 1);
          renderer.destroyBillboardBatch(f.corpseBatch);
          f.corpseBatch = null;
        }
      }
    });
    // SL2: pile items rewind BOTH ways and the flat FOLLOWS the
    // items, exactly where a rebuild-then-restore lands: an
    // emptied-in-save pile loses its flat (SerializableLootContainer
    // .cs:158-160 - Items.Count == 0 -> RemoveLootContainer on
    // restore) and a refilled-by-rewind pile gets the rebuild's own
    // mint back (p.half is the build-time size; a pile the build
    // never mounted stays unmounted).
    w.piles?.forEach((sp, i) => {
      const p = lootPiles[i];
      if (!p) return;
      p.items = sp.items.map((it) => ({ ...it }));
      if (!p.items.length && p.batch) {
        const bi = billboardBatches.indexOf(p.batch); if (bi >= 0) billboardBatches.splice(bi, 1);
        renderer.destroyBillboardBatch(p.batch);
        p.batch = null;
      } else if (p.items.length && !p.batch && p.half) {
        p.batch = renderer.createBillboardBatch(RANDOM_TREASURE_ARCHIVE, p.record, { w: p.half[0] * 2, h: p.half[1] * 2 }, [[p.pos[0], p.pos[1], p.pos[2]]]);
        billboardBatches.push(p.batch);
      }
    });
    droppedLoot.restorePiles(w.droppedLoot);   // AUDIT 23: absent list clears, per rebuild-from-save
    w.actions?.forEach((sa) => {
      const o = actions.objects.get(sa.key);
      if (!o) return;
      o.state = sa.state;
      o.t = sa.t;
      o.activationCount = sa.activationCount;
      if (o.kind === 'door' && sa.lock != null) o.currentLockValue = sa.lock;   // P10
      actions.syncRestored(o);   // P10: matrix + collider bucket settle (an open door no longer restores solid-and-closed)
    });
  }

  // Shared foe-damage path: melee and spells kill through the same
  // door (corpse + reaction). Factored in S5 so missiles do not grow
  // a second death path.
  function damageFoe(foe, damage, playerFeet = null, knockDir = null) {
    // C-slice: MakeEnemyHostileToAttacker - damaging a PACIFIED foe
    // re-hostiles it (and pre-loads the pursuit, the G1 shape).
    if (foe.ai && !foe.ai.isHostile) { foe.ai.isHostile = true; foe.ai.makeHostileToPlayer?.(undefined, lastPlayerFeet); }   // wave 36: seeded with where the attack came from
    foe.entity.health -= damage;
    if (foe.entity.health <= 0) {
      foe.dead = true;
      // E-slice: EnemyDeath:132-136 - the targeting foe's death
      // clears the alert (survivors re-raise it next update).
      if (foe.ai?.detected) setEnemyAlert(playerEntity, false);
      spawnCorpse(foe);
      return;
    }
    // C15 knockback (WeaponManager.WeaponDamage): WEAPON hits carry
    // the attack ray (melee = the look ray, arrows = flight) - spell
    // damage passes no ray and knocks nothing, verbatim. The gate:
    // monsters need MobileEnemy.Weight > 0 (weight-0 spectrals -
    // ghosts/wraiths - take NO knockback), class enemies re-knock
    // only once the current shove decays under the hurt threshold.
    // The sprite Hurt anim now rides the motor's knockback threshold
    // (KnockbackMovement), not the hit itself - damage without
    // knockback plays no hurt, as DFU.
    if (knockDir && foe.ai) {
      const isClass = !!foe.entity.isClass;
      const mobileWeight = ENEMY_BASICS[foe.mobileType]?.weight ?? 0;
      // WeaponManager.cs:578-581, verbatim precedence: `&&` binds
      // tighter than `||`, so the gate is
      // (speed <= 5/ratio && isEnemyClass) || Weight > 0. AUDIT 24 (the
      // seven-slice sweep): the port had `!isClass &&` on the second
      // arm, which C# does not write. It is a no-op on today's data -
      // every class row leaves Weight at its struct 0 - but it is not
      // what the source says, and the day a class row carries a weight
      // the two would part.
      // AUDIT 24 (wave 38): through the shared gate now - this was the
      // only pool that had the precedence right, and one home means the
      // other two cannot drift away from it again.
      if (weaponKnockbackApplies(foe.ai.knockbackSpeed, isClass, mobileWeight)) {
        const w = enemyWeightClassicUnits(isClass, foe.gender, mobileWeight);
        foe.ai.knockbackSpeed = weaponKnockbackSpeed(damage, w);
        foe.ai.knockbackDir = [knockDir[0], knockDir[1], knockDir[2]];
      }
    }
    if (foe.mobile) return;
    if (playerFeet && foeDeps) {
      const hdx = playerFeet[0] - foe.ai.feet[0], hdz = playerFeet[2] - foe.ai.feet[2];
      const front = foeDeps.withinYaw(foe.ai.yaw, hdx, hdz, 90);
      foe.reaction = { clip: foeDeps.REACTIONS[front ? 'HurtFront' : 'HurtBack'], t: 0 };
    }
  }


  // C16: EnemyAttack.MeleeDamage - one resolution for both damage
  // clocks (the rigs' machine hit frame, the mobiles' -1 sequence
  // marker). Gate 0.25 / MeleeDistance + 35.156deg, then
  // CalculateAttackDamage with the S18/S19b riders.
  /** C2-slice (combat-17): the 20% enemy-class attack voice at the
   *  melee damage frame, whatever the outcome (MeleeDamage's tail). */
  function foeAttackVoice(f) {
    const v = enemyAttackVoice(f);
    if (v && v.clip >= 0) audio.play3d(v.clip, [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16 });
  }

  function resolveFoeMelee(f, playerFeet) {
    const hdx = playerFeet[0] - f.ai.feet[0], hdz = playerFeet[2] - f.ai.feet[2];
    // E4b: weapon vs weaponless per the DFU rule (EnemyAttack also
    // drops the weapon if the target is metal-immune to it - the
    // player has no minMetalToHit, so that gate is inert)
    const wpn = foeDeps.chooseEnemyWeapon(f.entity.weapon, ENEMY_BASICS[f.mobileType]);
    if (!foeDeps.meleeHitConnects(f.ai._dist, f.ai.inSight, foeDeps.withinYaw(f.ai.yaw, hdx, hdz, foeDeps.MELEE_HIT_YAW_DEG))) {
      // C2-slice (combat-9): the out-of-reach whiff RINGS - the
      // else arm of MeleeDamage's reach fork plays the miss sound,
      // and the attack-voice roll still runs after the fork.
      audio.play3d(enemyMissSound(wpn), [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16 });
      foeAttackVoice(f);
      return;
    }
    // AUDIT 2026-08-17c: every resolved enemy attack on the player
    // tallies Dodging (EnemyAttack, before the damage branch) - it
    // was never tallied since C8.
    tallySkill(foeDeps.playerEntity, SKILLS.Dodging, 1);
    // S18: the special-attack rider seam - monster weaponless hits
    // run OnMonsterHit per hit (disease/paralysis/fatigue)
    const dmg = foeDeps.calculateAttackDamage(f.entity, foeDeps.playerEntity, {
      weapon: wpn,   // AUDIT 18: target group derived from the entity (isPlayer -> Humanoid)
      onMonsterHit: (att, tgt, hit) => onMonsterHit(att, tgt, hit, {
        currentDay: Math.floor(classicMinutesRef.value / MINUTES_PER_DAY), sinks: playerSinks,
        castParalyze: () => {   // S19: spider/scorpion free-cast Spider Touch (66)
          const sp = spellsByIndex?.get(SPIDER_TOUCH_SPELL_INDEX);
          if (sp) castEnemySpell(f, sp, true);
        },
      }),
      // S19b: a damaging poisoned-weapon hit infects (and the
      // formulas clear the weapon's poison)
      onInflictPoison: (att, tgt, pt) => inflictPoison(foeDeps.playerEntity, pt, false, { currentMinute: Math.floor(classicMinutesRef.value) }),
      say: (l) => hudText.add(l),   // C-slice: equipment breaks speak
    });
    if (dmg > 0) audio.playOneShot(hitSoundFor(wpn), 1.1);   // the player takes the hit (PlayerFootsteps families)
    // C2-slice (combat-9): a connected attack that LOST the roll
    // rings the miss sound too (ApplyDamageToPlayer's else arm).
    else audio.play3d(enemyMissSound(wpn), [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16 });
    hurtPlayer(dmg);
    // AUDIT 24 (wave 39): EnemyAttack.cs:406 sends RemoveHealth, which
    // is what ShowPlayerDamage listens to. Guarded on a LANDED blow -
    // DFU's SendDamageToPlayer is only reached from the hit arm.
    if (dmg > 0) flashPlayerDamage();
    foeAttackVoice(f);   // C2-slice (combat-17): after the fork, hit or miss
  }

  // Combat collision triggers (the last Combat-queue row):
  // DaggerfallActionCollision verbatim shape - per-object 0.12s
  // timeout, fires only while the player ACTIVELY MOVES horizontally
  // (up/down/jump don't trigger in classic), contact beneath the
  // player -> WalkOn else WalkInto (the Collision01 standing-raycast
  // refinement folds into the beneath test at our capsule scale).
  function collisionTriggers(dt, playerFeet, moveHeld) {
    if (!playerFeet) return;
    // Verbatim DaggerfallActionCollision: fires only while a MOVE
    // action is HELD (up/down/jump excluded) - not on position delta.
    // The delta gate (audit 2026-08-16) missed the classic case of a
    // player pushing INTO a blocking WalkInto object: the collider
    // cancels the motion, the delta is zero, and the trigger never
    // fired. Input-held is the source's rule and covers it.
    if (!moveHeld) return;
    const R = 0.45, H = 1.8;   // the player capsule
    for (const o of actions.objects.values()) {
      if (!o.aabb) continue;
      if (o.restOnlyTrigger && o.state !== 'start') continue;   // a mover in flight: bounds stale, and classic triggers on the step, not the ride
      o._colTimer = (o._colTimer ?? COLLISION_TIMEOUT_S) + dt;
      if (o._colTimer < COLLISION_TIMEOUT_S) continue;
      const a = o.aabb;
      const overlapXZ = playerFeet[0] + R > a.min[0] && playerFeet[0] - R < a.max[0]
        && playerFeet[2] + R > a.min[2] && playerFeet[2] - R < a.max[2];
      if (!overlapXZ) continue;
      const overlapY = playerFeet[1] + H > a.min[1] && playerFeet[1] < a.max[1] + 0.15;
      if (!overlapY) continue;
      const standingOn = playerFeet[1] >= a.max[1] - 0.15;
      actions.receive(o, standingOn ? 'WalkOn' : 'WalkInto');
      o._colTimer = 0;
    }
  }

  // P11: the current block's water surface (world y) - the swim
  // toggle rule reads it (PlayerEnterExit blockWaterLevel); P12's
  // drowning tick reads it too.
  function waterSurfaceYAt(x, z) {
    for (const b of dungeon.blocks) {
      if (x >= b.originX && x < b.originX + RDB_SIDE && z >= b.originZ && z < b.originZ + RDB_SIDE) {
        return b.layout.waterLevel === 10000 ? null : -b.layout.waterLevel * GLOBAL_SCALE;
      }
    }
    return null;
  }
  /** AUDIT 21 (music lane, F3): IsPlayerInsideDungeonCastle.
   *
   *      isPlayerInsideDungeonCastle = playerDungeonBlockData.CastleBlock;
   *  (PlayerEnterExit.cs:338), read by SongManager.cs:450-457 for the Castle
   *  playlist (GPALAC/FPALAC) and by AmbientEffectsPlayer.cs:291-299 for
   *  doNotPlayInCastle.
   *
   *  Both call sites hardcoded `insideDungeonCastle: false`, so MUSIC_ENV.Castle
   *  was unreachable and CASTLE_SONGS was a dead constant - and `deps.inCastle`
   *  was READ by ambientEffects and WRITTEN by nobody, so the one-shot
   *  suppression was inert too. The flag blamed "no castle-block detection
   *  yet", and rdbLayout has computed castleBlock verbatim
   *  (DaggerfallBillboard.cs:227) on every block all along - test/dungeon.test.js
   *  already pins that five real castle blocks exist in the archive.
   *
   *  Same block lookup as the water surface above, because it is the same
   *  question: which RDB block is the player standing in. */
  function castleBlockAt(x, z) {
    for (const b of dungeon.blocks) {
      if (x >= b.originX && x < b.originX + RDB_SIDE && z >= b.originZ && z < b.originZ + RDB_SIDE) {
        return Boolean(b.layout.castleBlock);
      }
    }
    return false;
  }
  // P12/P18: breath/drowning (PlayerEntity.FixedUpdate on the classic
  // update cadence). Submerged = the controller CENTER (feet + 0.9)
  // + 76*GlobalScale - 0.95 below the block water surface (the head-
  // under threshold; the swim toggle uses 50). The clause itself -
  // the DeepBreath guild refill, the 19th-update drain with the
  // Argonian coin refund, drowning at 0, surfacing zeroing - is
  // systems/breath.js breathStep (P18); this host owns the cadence,
  // the geometry, and the SetHealth(0).
  let _breathTimer = 0;
  const _breathState = { tally: 0 };
  // AUDIT 24 player: `player.transform.position.y` in
  // PlayerEnterExit.cs:382/:407 is the LIVE capsule's centre, and a
  // swimmer is force-crouched to 0.9 - so the half-height rides in
  // from the host rather than being hardcoded at the standing 0.9.
  function breathTick(dt, playerFeet, playerHeight = CAPSULE_HEIGHT) {
    _breathTimer += dt;
    while (_breathTimer >= CLASSIC_UPDATE_INTERVAL) {
      _breathTimer -= CLASSIC_UPDATE_INTERVAL;
      const surf = waterSurfaceYAt(playerFeet[0], playerFeet[2]);
      const submerged = surf != null && playerFeet[1] + playerHeight / 2 + 76 * 0.025 - 0.95 < surf;
      if (breathStep(playerEntity, submerged, _breathState) === 'drowned') {
        hurtPlayer(playerEntity.health);   // SetHealth(0): drowned
      }
    }
  }
  // A3: the dungeon scene ambience (the scene's Dungeon object runs
  // 5/28) - the 14 one-shots "somewhere around" + the classic-cadence
  // water sounds. Castle-block detection (doNotPlayInCastle) pends.
  const sceneAmbience = new AmbientEffects(DUNGEON_AMBIENT_WAITS);
  sceneAmbience.setPreset('dungeon');
  function drawFoes(dt, canvas, proj, view, eye, playerFeet, moveHeld = false, playerHeight = CAPSULE_HEIGHT) {
    _weaponCanvas = canvas;   // C10: the rig's late canvas (gesture dim + the overlay draw)
    const _mobileBatches = [];   // C11: the frame's live sprite-mobile quads
    if (playerFeet) lastPlayerFeet = [...playerFeet];
    // AUDIT 18 F5: the rest clock USED to tick here, which made it
    // unreachable - drawFoes only runs when NO overlay is up, and the
    // rest window IS an overlay. It ticks from tickOverlay now, called
    // by the hosts' overlay branch. Left as a marker so the seam is
    // not re-added to the wrong side of the gate.
    if (playerFeet) {
      breathTick(dt, playerFeet, playerHeight);
      const _surf = waterSurfaceYAt(playerFeet[0], playerFeet[2]);
      sceneAmbience.update(dt, {
        playerPos: [playerFeet[0], playerFeet[1] + playerHeight / 2, playerFeet[2]],   // the controller center (DFU transform.position)
        waterSurfaceY: _surf,
        submerged: _surf != null && playerFeet[1] + playerHeight / 2 + 76 * 0.025 - 0.95 < _surf,
        // AUDIT 21 (music lane, F3): doNotPlayInCastle
        // (AmbientEffectsPlayer.cs:291-299). ambientEffects READ deps.inCastle
        // and nothing in src/ ever WROTE it, so the suppression was inert and
        // a castle kept dripping and moaning. Same block lookup as the water.
        inCastle: castleBlockAt(playerFeet[0], playerFeet[2]),
      });
    }
    magic.firePending(eye, [-view[2], -view[6], -view[10]]);   // classic: the readied spell fires on the click
    // P13: the shared stealth senses context (EnemySenses' player-
    // side reads). S21: all three illusion branches are LIVE -
    // invisible always blocks (the 13 seers exempt), blending 8%
    // see-through, shade 4% - each folding normal + true powers
    // (DaggerfallEntity.IsInvisible/IsBlending/IsAShade, verbatim).
    // sharedStealthMinute = PlayerEntity.TimeOfLastStealthCheck: the
    // Stealth tally fires once per classic minute ACROSS all foes.
    // AUDIT 24 (wave 36): ONE BUILDER, in scenes/shared.js - the three
    // exterior call sites passed `{ playerInvisible }` alone, and the
    // difference between the two objects was three live bugs above
    // ground. The shared-stealth box moved onto the player entity with
    // it, which is where PlayerEntity.TimeOfLastStealthCheck lives.
    const _senses = sensesContext(playerEntity, classicMinutesRef.value, _activity);
    // AUDIT 18: the PLAYER half of this tick moved to systems/worldTick.js
    // and is now called by every host - it used to run only here, so a
    // character who stayed above ground never aged an effect, never
    // progressed a disease, never drained fatigue and NEVER GAINED A
    // LEVEL. The FOE half stays here: it walks this host's foe list.
    const _tick = tickPlayerMinutes({
      entity: playerEntity,
      classicMinutes: classicMinutesRef.value,
      dt,
      sinks: playerSinks,
      activity: _activity,
      fatigueMultiplier: fatigueLossMultiplier(),
      rolls: Math.random,
      say: (msg) => hudText.add(msg),
    });
    classicMinutesRef.value = _tick.classicMinutes;
    // AUDIT 24 (wave 32): the FOE half of the same broker event, on the
    // window the tick CLAIMED - one raise, every manager. This loop used to
    // run [floor(clock at frame start), floor(clock now)) off its own
    // arithmetic, so it had neither the broker's catch-up nor its 2880 cap:
    // any minute added by someone else (the rest window, a court sentence)
    // was simply lost for the foes, and diseases never ran on them at all.
    for (const f of foes) {
      if (f.dead) continue;
      runMagicRoundsFor(f.entity, _tick.magicRoundWindow.from, _tick.magicRoundWindow.to, { sinks: foeSinks(f) });
    }
    // AUDIT 24 (wave 31): every entity has an EntityEffectManager, so the
    // stat-zero kill is a FOE law too - a drained-to-zero Strength kills
    // the thing you drained. Off the frame's dt, not the minute loop.
    for (const f of foes) if (!f.dead) killIfAnyLiveStatZero(f.entity, foeSinks(f), dt);
    collisionTriggers(dt, playerFeet, moveHeld);
    updateMissiles(dt, playerFeet);
    magic.update(dt, playerFeet);   // M3: player spell missiles fly in the engine
    // S19: WeaponManager's paralysis gate - weapons hide and the
    // machine holds while paralyzed (casting is NOT gated, verbatim:
    // DFU has no IsParalyzed check in the casting path).
    const _pParalyzed = entityIsParalyzed(playerEntity);   // S22: the FreeAction read-time fold
    {
      // WeaponManager.IsPositionInCameraView: project through the
      // live proj*view, inside NDC with positive w
      const pv = multiply(proj, view);
      const inView = ([x, y, z]) => {
        const w = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
        if (w <= 0) return false;
        const nx = (pv[0] * x + pv[4] * y + pv[8] * z + pv[12]) / w;
        const ny = (pv[1] * x + pv[5] * y + pv[9] * z + pv[13]) / w;
        return nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1;
      };
      audio.setListener(eye, [-view[2], -view[6], -view[10]]);   // A1: the camera is the ears
      // A2 ambient pass. Torches: LoopIfPlayerNear - the looping
      // Burning source exists only while the player is within 5
      // (linear rolloff, volume 0.7); out of range it stops and
      // frees the node. Animals: PlayRandomlyIfPlayerNear - per
      // CLASSIC UPDATE in range, DFRandom.rand() <= 100 barks.
      for (const t of torches) {
        const tdx = eye[0] - t.pos[0], tdy = eye[1] - t.pos[1], tdz = eye[2] - t.pos[2];
        const inRange = tdx * tdx + tdy * tdy + tdz * tdz <= TORCH_MAX_DISTANCE * TORCH_MAX_DISTANCE;
        if (inRange && !t.handle) t.handle = audio.loop3d(SOUND.Burning, t.pos, TORCH_VOLUME, { maxDistance: TORCH_MAX_DISTANCE });
        else if (!inRange && t.handle) { t.handle.stop(); t.handle = null; }
      }
      animalAmbience.update(dt, eye);   // A4 fold: the shared PlayRandomlyIfPlayerNear pass (was inline A2)
      // C10: the rig owns the gesture consume, the swing-sound edge,
      // and the machine step (paralysis holds all three, S19).
      for (const ev of weaponRig.frame(dt, { paralyzed: _pParalyzed })) {
        // AUDIT 23 (combat-2) - WeaponManager.cs:376-380: the bow's
        // swing sound is ArrowShoot at frame 4 of the release.
        if (ev === 'bowSound') { audio.playOneShot(SOUND.ArrowShoot, 1.1); continue; }
        if (ev !== 'hit' || !playerFeet) continue;
        // AUDIT 17k / Mac's report: null weapon = fists, never a bow
        // (the ?. is load-bearing - this raw deref threw on EVERY
        // bare-handed strike frame, the fist crash)
        // AUDIT 17k / Mac's report: null weapon = fists, never a bow
        // (the ?. is load-bearing). AUDIT 18: the test now reads the
        // TEMPLATE, not the display name - an enchanted Long Bow is
        // renamed by createRegularMagicItem and stopped being a bow.
        if (isBowWeapon(playerWeapon.weapon)) {
          // Combat bows: the strike frame LOOSES an arrow along the
          // look instead of the melee arc (WeaponManager verbatim
          // shape).
          const lookDir = [-view[2], -view[6], -view[10]];   // the view-matrix forward this file already uses for the viewmodel
          if (!removeOne(playerEntity.items, 131)) continue;   // one Arrow per loose, verbatim (the arrow guard normally pre-sheathes at zero)
          fireArrow(eye, lookDir, playerWeapon.weapon, true);
          // WeaponManager.cs:419-436, in DFU's order: the swing costs
          // fatigue whatever it hits, and a BOW always takes the tally
          // arm (`!hitEnemy && WeaponType != Bow` is false for a bow),
          // so Archery AND CriticalStrike count a use per loose.
          drainFatigue(SWING_WEAPON_FATIGUE_LOSS);
          tallySwingSkills(playerEntity, playerWeapon.weapon);
          continue;
        }
        const hitEnemy = resolvePlayerHit(eye, inView, playerFeet, [-view[2], -view[6], -view[10]]);
        // "// Fatigue loss" - unconditional, then the tally arm only
        // when the swing connected. swingWeaponFatigueLoss (11) was
        // ported as a constant and applied by nobody, and
        // CriticalStrike was tallied nowhere in the port at all.
        drainFatigue(SWING_WEAPON_FATIGUE_LOSS);
        if (hitEnemy) tallySwingSkills(playerEntity, playerWeapon.weapon);
        // AUDIT 23 (C9) - WeaponManager.cs:423-424: the swing sound
        // fires at the HIT FRAME of a swing that hit no enemy (never
        // at strike entry, where the rig used to play it).
        else audio.playOneShot(swingSoundFor(playerWeapon.weapon), 1.1);
      }
    }
    for (const f of foes) {
      if (f.dead) continue;
      // S19: a paralyzed foe freezes - EnemyMotor (CanAct = false,
      // FreezeAnims) stops senses/pursuit and EnemyAttack returns
      // (no decisions, no damage frame). EnemySounds is NOT gated
      // in DFU, so the bark pass below still runs.
      const _fParalyzed = entityIsParalyzed(f.entity);   // S22: the FreeAction read-time fold
      // C12: paralysis now flows THROUGH the motor (DFU CanAct=false +
      // flyerFalls) - senses keep running, decisions stop, paralyzed
      // FLYERS fall out of the air, swimmers freeze.
      f.ai.update(dt, playerFeet || eye, _senses, _fParalyzed);   // E2 senses + pursuit; P13: the stealth context
      // CH3 (characters-8): a past-threshold landing bills the
      // player's fall formula - trunc(5 x (drop - 5)) - through the
      // pool's damage door (no knockback), ringing FallDamage at the
      // foe. The blood splash rides damageFoe's own art.
      if (f.ai.landedFall > 0 && !f.dead) {
        const dmg = Math.trunc(FALL_HP_PER_METRE * (f.ai.landedFall - FALL_DAMAGE_THRESHOLD));
        f.ai.landedFall = 0;
        if (dmg > 0) {
          audio.play3d(SOUND.FallDamage, [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]], 1, { maxDistance: 16 });
          // EnemyMotor.cs:1404-1407 - index 0 at `transform.position`,
          // which on a CharacterController is the BASE. Its comment
          // says "falling enemies bleed at the center"; the line does
          // not add controller.center, so the feet are what DFU passes.
          hitEffects?.showBloodSplash(0, [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]]);
          damageFoe(f, dmg, null, null);
        }
      }
      // E-slice: EnemySenses:533-535 - a foe with the player IN SIGHT
      // raises the enemy alert every update (the dungeon rest roll
      // reads it; an 8-hour decay lowers it).
      if (f.ai.inSight && f.ai.detected && !f.dead) setEnemyAlert(playerEntity, true, classicMinutesRef.value);
      // C-slice (AUDIT 23 characters-3): EnemyMotor.OpenDoors - a
      // CanOpenDoors foe whose sight ray to the player is blocked by
      // an action DOOR opens it when unlocked and within 2m. The
      // senses recorded the blocking bucket key; only a door-flagged
      // action object counts (walls block sight with the level key).
      if (!_fParalyzed && foeDeps && f.ai.doorKey != null && ENEMY_BASICS[f.mobileType]?.canOpenDoors) {
        const _door = actions?.objects.get(f.ai.doorKey);
        if (_door && DOOR_VERB_FLAGS.has(_door.actionFlag)) {
          foeDeps.openDoorsStep(f.ai.feet, true, {
            state: _door.state, currentLockValue: _door.currentLockValue,
            center: [_door.matrix[12], _door.matrix[13], _door.matrix[14]],
          }, () => actions.toggleDoor(_door));
        }
      }
      // C-slice (AUDIT 23 characters-2): the FIRST-encounter language
      // check (EnemySenses:504-528). A known tongue rolls
      // CalculateEnemyPacification with the sheathed state; success
      // stands the foe down (IsHostile false) and tallies the skill
      // by 3 (DFU's BCHG over classic's 1); a FAILED roll still
      // tallies 1 for the monster tongues - "using" the language -
      // but not for Etiquette/Streetwise. languagePacified's prose is
      // ours (the string table is not in the snapshot; key cited).
      // AUDIT 24 (wave 42): through the one home. This was the tree's
      // only consumer of justEncountered, though the motor raises it
      // for every pool - so no monster and no watchman above ground
      // was ever talked down.
      if (foeDeps) {
        tryLanguagePacification(f.ai, f.entity, f.mobileType, playerEntity, {
          sheathed: playerWeapon.sheathed,
          enemyLanguageSkill: foeDeps.enemyLanguageSkill,
          calculateEnemyPacification: foeDeps.calculateEnemyPacification,
          say: (l) => hudText.add(l),
        });
      }
      // A1 EnemySounds. AUDIT 24 (wave 41): this was the tree's ONLY
      // copy, written inline here, and it had drifted three ways - its
      // mute gate was `!entity.isClass` where DFU carves the city
      // watch out (:222), it never ran SetVolumeScale so a bark came
      // through a dungeon wall at full volume, and it played on an
      // INVERSE rolloff where DFU pins linear to the attract radius.
      // One home now, and the two exterior pools (which had nothing at
      // all) ask the same object the same way.
      f.sounds ??= new EnemySoundSource(f.mobileType);
      tickEnemySound(f.sounds, f.ai.feet, playerFeet || eye, dt, { audio, collider });
      // AUDIT 23 (characters-11) - EnemyAttack.cs:70-77: the divisor
      // mints every update from PermanentSpeed / max(8, LiveSpeed).
      f.mobile.frameSpeedDivisor = Math.max(1, Math.trunc((f.entity.stats?.speed ?? 50) / Math.max(8, liveStat(f.entity, 'speed'))));
      // E2b: verbatim attack decision on the shared machine. S19:
      // paralysis returns early, and that is DFU's own gate
      // (EnemyAttack.cs:55-56 `DisableAI || IsParalyzed`).
      // AUDIT 24 (the re-read): a PACIFIED foe is NOT a second gate
      // here - EnemyAttack.FixedUpdate has no hostility test at all, so
      // it still burns its DFRandom byte every classic tick. What stops
      // it swinging is the senses' target drop, which now reads blind
      // in the motor. Skipping the component was a law left with the
      // host, and it desynced the shared stream.
      f.events = _fParalyzed ? [] : f.attack.update(dt, f.ai, playerFeet || eye);
      // C11 audit 08-17: the attack START edge (machine Idle -> swing
      // this frame) - MeleeAnimation fires ChangeEnemyState + the
      // attack sound ONCE at the start, not at the hit frame, and not
      // gated on the hit later connecting. A LEVEL signal replayed the
      // sprite sequence inside one swing (the machine outlasts it).
      const _mstate = f.attack.machine.state;
      const _strikeEdge = _mstate !== 'Idle' && (f._prevMState ?? 'Idle') === 'Idle';
      f._prevMState = _mstate;
      // PlayAttackSound (:100-113) - half the time, humans silent
      // except the watch, at whatever volumeScale the last attract
      // sound left behind. Through the one home (AUDIT 24 wave 41):
      // this arm's own `!f.entity.isClass` gate was the same drift.
      if (_strikeEdge) {
        f.sounds ??= new EnemySoundSource(f.mobileType);
        playEnemyClip(audio, f.sounds.attack(), f.ai.feet);
      }
      // S16: the casting decision rides beside the attack machine
      // (DoRangedAttack's spell branch + DoTouchSpell); the decision
      // casts INSTANTLY. RESIDUAL (honest): DFU casters also hold at
      // range and strafe (Enhanced AI) or stand off - our motor keeps
      // the C8 pursuit; the foe casts while closing.
      if (playerFeet && f.caster && !_fParalyzed && f.ai.isHostile) {
        const dec = f.caster.update(dt, f.ai, f.attack, playerFeet, playerEntity);
        if (dec) castEnemySpell(f, dec.spell);
      }
      // E3b: the machine's hit frame resolves against the player -
      // EnemyAttack.MeleeDamage verbatim: gate 0.25 / MeleeDistance +
      // 35.156deg, then CalculateAttackDamage (class hand-to-hand;
      // equipment E4). The player is the Humanoid group
      // (GetBonusOrPenaltyByEnemyType's PlayerEntity arm - the Undead
      // half needs vampirism, which the port does not have).
      // HUD pends the UI arc: health surfaces on __player.
      if (playerFeet && f.events.includes('hit')) {
        if (f.attack.firedRanged) {
          // C17: sprite archers loose on their -1 shoot marker
          // (below); the machine's hit frame stays the DECISION
          // clock only. (ON ICE with the rig path: the machine-frame
          // loose for rig archers.) C-slice: keyed on the SWING that
          // fired - a bow foe inside 6m swings MELEE (DoRangedAttack's
          // fallback) and lands damage here like anyone.
          continue;
        }
        // C16: the machine's hit frame is the RIGS' damage clock;
        // sprite mobiles land damage on their -1 sequence markers
        // below (doMeleeDamage, verbatim - the Frost Daedra's base
        // sequence strikes TWICE per swing).
        if (!f.mobile) resolveFoeMelee(f, playerFeet);
      }
      if (f.mobile) {
        // C11: the sprite mobile. Paralysis freezes the anim clock
        // (FreezeAnims - the cached output redraws); otherwise the
        // unit consumes the frame's intent: attack while the shared
        // machine swings, hurt on the damage trigger, move/idle by
        // pursuit. The frame texture uploads lazily per record#frame.
        // AUDIT 24 (wave 33): NO ANIMATION FREEZE. This used to skip the
        // whole mobile update while paralysed and redraw the cached
        // output, on the strength of EnemyMotor.HandleParalysis's
        // `mobile.FreezeAnims = true` - but :259 sets it back to false on
        // the line after the closing brace, with nothing reading it in
        // between and no other writer in the tree, so a paralysed enemy's
        // animation is NEVER frozen in DFU. UpdateToIdleOrMoveAnim runs
        // after the `if (CanAct)` gate and puts a stationary one into
        // Idle, which keeps playing; UpdateOrientation has no FreezeAnims
        // check at all, so the sprite keeps turning to face the player
        // too - and the port's cache froze the FACING as well as the
        // frame. What stops the blow is EnemyAttack's early return, which
        // is the consume-and-clear below.
        {
          f._mout = f.mobile.update(dt, {
            moving: f.ai.moving,
            striking: _strikeEdge && !f.attack.firedRanged,   // the START edge (paralysis eats it - the attack machine above is gated, so ChangeEnemyState never fires: EnemyAttack.Update's early return, NOT FreezeAnims - wave 33)
            rangedStriking: _strikeEdge && !!f.attack.firedRanged,   // C17: archers draw records 20-24 - keyed per SWING (the in-band bow shot), not per foe
            hurting: f.ai.hurtKnock,   // C15: the knockback threshold IS the hurt anim (KnockbackMovement)
            casting: !!f._castPending,   // C14: the cast decision's edge (Spell one-shot)
          }, f.ai.yaw, f.ai.feet, eye);
          f._castPending = false;
          // C17: the ranged -1 (shootArrow) looses the arrow at the
          // player - the machine's hit event no longer fires it for
          // sprite archers.
          // C16: the -1 damage marker IS the damage moment (AnimateEnemy
          // doMeleeDamage -> MeleeDamage). Paralysis does not reach it
          // because EnemyAttack.Update returns at the top (:91-94) - and
          // because that return happens BEFORE the clear at :100, the
          // latch survives and the blow lands on the first unparalysed
          // frame. (The comment here used to credit FreezeAnims, which
          // is a dead store - wave 33.)
          //
          // MELEE FIRST, and the arrow as the ELSE-IF: DFU's
          // EnemyAttack.Update is `if (mobile.DoMeleeDamage) {...} else
          // if (mobile.ShootArrow) {...}` (:97-105). Wave 33 wrote two
          // independent ifs in arrow-first order, so a foe that had
          // latched both would loose an arrow AND land a blow in one
          // frame, and would prefer the arrow. (Found by the wave-35
          // re-read.)
          if (playerFeet && !_fParalyzed && f.mobile.doMeleeDamage) { f.mobile.doMeleeDamage = false; resolveFoeMelee(f, playerFeet); }
          else if (playerFeet && !_fParalyzed && f.mobile.shootArrow) {
            f.mobile.shootArrow = false;
            const from = [f.ai.feet[0], f.ai.feet[1] + 1.2, f.ai.feet[2]];
            const d = [playerFeet[0] - from[0], playerFeet[1] + 0.9 - from[1], playerFeet[2] - from[2]];
            const l = Math.hypot(...d) || 1;
            fireArrow(from, [d[0] / l, d[1] / l, d[2] / l], f.entity.weapon, false, f);
            audio.play3d(SOUND.ArrowShoot, from, 1, { maxDistance: 16 });   // C2-slice (combat-9): the loose rings from the archer (EnemyAttack Update)
          }
        }
        const out = f._mout;
        const rkey = `${out.record}#${out.frame}`;
        if (!renderer.textures.has(`${f.mobileArchive}_${rkey}`)) uploadRecordFrame(f.mobileArchive, out.record, out.frame);
        const sz = scaledBillboardSize(f.mobileTex.getSize(out.record), f.mobileTex.getScale(out.record));
        // C17: the texture-475 female casting records read too small
        // from the files - DFU post-scales 20-24 by 1.35 (OrientEnemy).
        if (f.mobileArchive === 475 && out.record >= 20 && out.record <= 24) { sz.w *= 1.35; sz.h *= 1.35; }
        f.batch.record = rkey;
        f.batch.size = { w: out.flip ? -sz.w : sz.w, h: sz.h };   // negative width = FlipLeftRight (UVs ride the corners)
        f.batch.origin = f.ai.feet;   // the billboard shader bottom-anchors
        _mobileBatches.push(f.batch);
        continue;
      }
      if (!f.rig) continue;   // ON ICE (C17): the rig path below draws nothing - every live foe is a mobile
      if (!_fParalyzed) {   // S19 FreezeAnims: the rig holds its live frame
        f.rig.setGait(f.ai.moving ? 1 : 3);   // WALK while pursuing, IDLE sway at rest
        let pose = f.attack.pose();
        if (f.reaction) {                     // a hit stagger overrides the strike
          f.reaction.t += dt;
          const R = f.reaction.clip;
          if (f.reaction.t >= R.dur) f.reaction = null;
          else pose = foeDeps.sampleClip(R, f.reaction.t);   // seconds, not phase (units bug, audit 2026-08-16: staggers cut at a third)
        }
        f.rig.setPose(pose);
        f.rig.update(dt);
      }
      const s = f.rig.scale, p = f.ai.feet;
      const mat = trs(p[0], p[1] - f.rig.liveFootY * s, p[2], 0, f.ai.yaw * 180 / Math.PI, 0, s, s, s);   // live support point, same grounding rule as the player rig
      _drawSprite(renderer, canvas, f.rig, mat, proj, view, eye);
    }
    // C11: the sprite mobiles draw as one billboard pass. The right
    // axis is the NEGATED view row - the same (cos yaw, 0, -sin yaw)
    // axis every host passes for its static flats. That axis carries
    // the engine's screen-mirror convention (our right-handed lookAt
    // shows world +x on screen-right where Unity shows -x; the flats'
    // axis bakes the compensating mirror in), so DFU's verbatim
    // FlipLeftRight booleans land in the same frame as everything
    // else. Ground-truthed against raw record art: skeletal warrior
    // 270/17 renders unmirrored (facing its walk direction) with this
    // axis, mirrored (moonwalking) with the raw view row.
    // U26: the player's own dropped piles ride the SAME pass as the
    // sprite mobiles - they are billboards at a world position with
    // no animation, exactly like a corpse.
    droppedLoot.tickFlats(dt);   // FA1 slice 3
    const _dropBatches = droppedLoot.batches();
    const _spellBatches = magic.batches();   // M3: player spell missiles
    if (_mobileBatches.length || _dropBatches.length || _spellBatches.length) {
      renderer.drawBillboards([..._mobileBatches, ..._dropBatches, ..._spellBatches],
        new Float32Array([-view[0], -view[4], -view[8]]), new Float32Array([0, 1, 0]));
    }
    // LAST before the HUD: the classic weapon overlay composites over
    // the whole frame (DaggerfallUI draws it under the HUD). The rig
    // runs the bow-arrow guard and the ShowWeapons legs; S19
    // paralysis rides the same call (C10 fold).
    if (playerFeet) weaponRig.draw({ paralyzed: _pParalyzed });
    // U1: HUD last (over the viewmodel), heading from the view
    // forward this file already derives (0 = +z, wrapped 0..1).
    const hfw = [-view[2], -view[10]];
    const heading01 = ((Math.atan2(hfw[0], hfw[1]) / (Math.PI * 2)) % 1 + 1) % 1;
    drawHud(renderer, canvas, hudArt, playerEntity, heading01, dt);
    hudText.tick(dt);
    if (hudFont) hudText.draw(renderer, canvas, hudFont, hudScaleFor(canvas.width, canvas.height));
    // The CLICK TO LOOK banner retired with click-to-look itself: the
    // hosts re-engage a dropped lock on the next gesture (DFU shape),
    // so an unlocked frame is transient, not a mode to advertise.
    // The F8 'lock' debug line below keeps the diagnostic.
    if (debugHud && hudFont) {
      // F8 diagnostics: every live-play unknown, on screen.
      const s2 = hudScaleFor(canvas.width, canvas.height);
      const feet = lastPlayerFeet ? lastPlayerFeet.map((v) => v.toFixed(2)).join(',') : 'null';
      const lines = [
        `build ${BUILD_TAG}`,
        `feet ${feet}  ${_motorState}`,
        `enter ${this.enterMarker ? [this.enterMarker.x, this.enterMarker.y, this.enterMarker.z].map((v) => v.toFixed(2)).join(',') : 'none'}  start ${this.startMarker ? [this.startMarker.x, this.startMarker.y, this.startMarker.z].map((v) => v.toFixed(2)).join(',') : 'none'}`,
        `overlay ${activeOverlay ? activeOverlay.constructor.name : 'none'}  chargenDone ${!!playerEntity.chargenDone}`,
        `lock ${typeof document !== 'undefined' && document.pointerLockElement ? 'yes' : 'NO'}  class ${playerEntity.careerIndex ?? '?'} ${playerEntity.career?.name ?? ''}`,
        `hp ${playerEntity.health}/${playerEntity.maxHealth}  mp ${playerEntity.magicka}/${playerEntity.maxMagicka}`,
        `mouse ${_mouseState}`,
        `input ${_inputState}`,
      ];
      lines.forEach((t, i) => drawText(renderer, hudFont, t, 4 * s2, (4 + i * 9) * s2, s2, [0.4, 1, 0.5, 1]));
    }
    if (hudFont && magic.readied()) {
      // U2a's first consumer: the readied spell + cost, classic text
      // above the vitals (the spellbook window replaces this in U4).
      const s = hudScaleFor(canvas.width, canvas.height);
      drawText(renderer, hudFont, `${magic.readied().name} (${calculateCastCost(magic.readied(), playerEntity).sp})`, 10 * s, canvas.height - 60 * s, s, [0.9, 0.9, 0.75, 1]);
    }
  }

  // Music is NOT started here any more (AUDIT 19's 1:1 pass): the
  // SongManager decides when a song changes, from a context the host feeds
  // it every frame. What this context owes it is the SEED, above.

  return {
    // AUDIT 19 / 1:1: SelectCurrentSong's dungeon arm seeds DFRandom with
    // the dungeon record header's Unknown2 XOR the region byte
    // (SongManager.cs:346-358). An earlier pass flagged this as
    // "unavailable" - it is not. mapsFile parses unknown2 onto the same
    // header this host already reads locationId from, and DFU casts it to
    // ushort, so the low 16 bits are the field. Verified over the real
    // archive: 4,232 dungeons, 3,769 distinct keys, near-uniform across
    // the 15-song list.
    /** The host's cumulative clock, for the music context's gameDays. */
    get classicMinutes() { return classicMinutesRef.value; },
    /** AUDIT 21 (music lane, F3): IsPlayerInsideDungeonCastle, live off the
     *  block the player is standing in - the Castle playlist and
     *  doNotPlayInCastle both had it hardcoded false. */
    get inCastle() { return lastPlayerFeet ? castleBlockAt(lastPlayerFeet[0], lastPlayerFeet[2]) : false; },
    musicSeed: dungeonKey(
      (dfLocation?.dungeon?.recordElement?.header?.unknown2 ?? 0) & 0xffff,
      dfLocation?.regionIndex ?? 0),
    drawList,
    dynamicDraws,
    actions,
    collider,
    texRemap,
    billboardBatches,
    flatAnims,   // FA1: the host ticks the flats it draws
    hitEffects,  // AUDIT 24 (wave 39): and the blood splashes it draws
    lights,
    flicker,
    waterQuads,
    startMarker: dungeon.startMarker,
    enterMarker: dungeon.enterMarker,
    blockCount: dungeon.blocks.length,
    enemies,
    foes,
    drawFoes,
    playerAttackInput,
    toggleSheath: weaponRig.toggleSheath,
    // S24 probe seam: drive a real spell record onto the player
    // through the host's own absorption path (the same function the
    // foe-cast and missile-impact sites call).
    applySpellToPlayer: magic.applySpellToPlayer,
    // C10: the rig's clickAttack carries the sheathed gate the inline
    // version missed - a touch tap while sheathed no longer swings
    // (WeaponManager: no attack processing while sheathed).
    playerClickAttack: weaponRig.clickAttack,
    playerCastInput: magic.castInput,   // S5: C key in the hosts
    /** Verbatim MovePlayerToMarker + FixStanding: the start marker
     *  + up * (height 1.8 * 0.6), then the instant floor snap. ONE
     *  source - both hosts spawn through this (the standalone's raw
     *  marker spawn put the EYE at the marker, feet under the floor:
     *  Mac spawned wedged in the under-geometry shaft). */
    startSpawn() {
      // Verbatim PlayerEnterExit.StartDungeonInterior with
      // preferEnterMarker=true (the default on dungeon entry): the
      // ENTER marker wins, StartMarker is the fallback. We were using
      // StartMarker unconditionally - a DIFFERENT point that in
      // Privateer's Hold sits in tight geometry, so the collider
      // shoved the capsule off-marker into a wall and it wedged
      // (Mac: feet 26.10 vs marker 28.38, 'stuck in a hole' while
      // the numbers jitter but net travel stays ~0).
      const m = this.enterMarker ?? this.startMarker;
      if (!m) return [0, 2, 0];
      return floorLanding(collider, [m.x, m.y + 1.08, m.z]);
    },
    get playerSlowFalling() { return hasActiveEffect(playerEntity, 'slowfall'); },   // S8: hosts feed their motor (P14: the -105 * dt constant-speed law lives in the motor)
    toggleDebugHud() { debugHud = !debugHud; },
    reportMotor(grounded, velY, yaw) { _grounded = grounded; _motorState = `g:${grounded ? 1 : 0} vy:${velY.toFixed(1)} yaw:${yaw.toFixed(2)}`; },
    // U7: the rest key. Pre-rest gates (the classic order): enemies
    // nearby -> TEXT.RSC 354; swimming or airborne -> 355 "You
    // cannot rest now."; else the rest window opens. A second press
    // routes through the overlay as 'back' (ends a running rest).
    toggleRest() {
      if (activeOverlay) return;
      // Audit 2026-08-16f: the PRE-gate uses AreEnemiesNearby(true) -
      // the RESTING variant (an unaware foe blocks only within 12
      // units), same as the hourly break check. The first cut used
      // the strict variant and refused rest with any unaware foe in
      // the whole 1024-unit spawn band. E-slice: the alert state
      // exists now and IS raised below - the old routed leg closed.
      if (_restDeps.enemiesNearby()) {
        // E-slice: the ROUTED leg closes - DFU raises the alert here
        // (DaggerfallUI:650-655), which is what arms the dungeon
        // rest-encounter roll.
        setEnemyAlert(playerEntity, true, classicMinutesRef.value);
        const lines = rscLines(REST_TEXT.enemiesNearby);
        if (lines) activeOverlay = new ActionTextBox(lines);
        return;
      }
      // StartRestGroundedCheck verbatim: grounded passes at once;
      // otherwise a short downward ray from the controller center,
      // height/2 + 0.2 (= floor within 0.2 below the feet) lets a
      // near-ground levitator rest. Derived from CAPSULE_HEIGHT so
      // the geometry cannot drift from the motor's (review 16f).
      const feet = lastPlayerFeet;
      const nearFloor = _grounded || (feet
        && Number.isFinite(collider.raycast(
          [feet[0], feet[1] + CAPSULE_HEIGHT / 2, feet[2]], [0, -1, 0], CAPSULE_HEIGHT / 2 + 0.2)));
      if (_activity.swimming || !nearFloor) {
        const lines = rscLines(REST_TEXT.cannotRestNow);
        if (lines) activeOverlay = new ActionTextBox(lines);
        return;
      }
      activeOverlay = new RestWindow(_restDeps);
    },
    // P11: the current block's water surface (world y) - the swim
    // toggle rule reads it (PlayerEnterExit blockWaterLevel).
    waterSurfaceYAt,
    // P11: the motor-mode effect consumers (Levitate 14,255; the S8
    // waterWalking flag lands its swimmer).
    playerLevitating: () => hasActiveEffect(playerEntity, 'levitate'),
    playerWaterWalking: () => hasActiveEffect(playerEntity, 'waterWalking'),
    playerParalyzed: () => entityIsParalyzed(playerEntity),   // S19 gates + the S22 FreeAction fold

    // P11: per-frame activity feed - the splash on the swim edge, the
    // jump fatigue/tally (PlayerEntity: 11 x multiplier + Jumping
    // tally once per jump), and the state the per-minute fatigue
    // drain reads.
    reportActivity({ running = false, swimming = false, jumped = false, movingLessThanHalfSpeed = true, fell = 0 } = {}) {
      if (swimming && !_activity.swimming) audio.playOneShot(SOUND.SplashLarge);   // PlayLargeSplash on entry
      _activity.running = running;
      _activity.swimming = swimming;
      _activity.movingLessThanHalfSpeed = movingLessThanHalfSpeed;   // P13: IsMovingLessThanHalfSpeed (the motor computes it)
      // AUDIT 23 (C6): the jump drain+tally moved into tickPlayerMinutes
      // (PlayerEntity.cs:425-430 is the entity update) - the edge rides
      // the activity so every host shares the one law.
      _activity.jumped = jumped;
      // P14 fall landing (CheckFallingDamage + PlayerHealth verbatim):
      // damage = trunc(5 * (distance - 5)) past the threshold with the
      // fall-damage sound; a 2.5..5 drop is the hard-fall alert only.
      // No water exemption HERE - DFU's is outdoor-tile-only
      // (StreamingWorld.PlayerTileMapIndex == 0), so a dungeon-water
      // landing that grounds bills like ground, bug-for-bug. The
      // ShowPlayerDamage screen flash pends the HUD arc (flagged).
      if (fell > FALL_DAMAGE_THRESHOLD) {
        hurtPlayer(Math.trunc(FALL_HP_PER_METRE * (fell - FALL_DAMAGE_THRESHOLD)));
        audio.playOneShot(SOUND.FallDamage);
      } else if (fell > FALL_DAMAGE_THRESHOLD / 2) {
        audio.playOneShot(SOUND.FallHard);
      }
    },
    reportMouse(dx, dy, locked) { _mouseState = `dx:${dx} dy:${dy} lock:${locked ? 'Y' : 'N'}`; },
    reportInput(keys, pitch) { _inputState = `keys:${keys} pitch:${pitch.toFixed(2)}`; },
    quickSave() {
      const snap = snapshotPlayer(playerEntity, {
        position: lastPlayerFeet, classicMinutes: classicMinutesRef.value,
        readiedSpellIndex: magic.readiedIndex(),
        locationKey: _locationKey,
        world: collectWorld(),
      });
      if (writeQuicksave(snap)) hudText.add('Game saved.');
      else hudText.add('Save failed (storage full or disabled).');   // never silent - the write can fail on real browsers
    },
    quickLoad(setPlayerPos) {
      const snap = readQuicksave();
      if (!snap) { hudText.add('No saved game.'); return; }
      const extras = restorePlayer(playerEntity, snap, spellsByIndex);
      if (!extras) { hudText.add('Save version mismatch.'); return; }
      classicMinutesRef.value = extras.classicMinutes ?? classicMinutesRef.value;
      magic.setReadiedByIndex(extras.readiedSpellIndex ?? null, spellsByIndex);
      if (extras.world && extras.locationKey === _locationKey) applyWorld(extras.world);
      else if (extras.world) hudText.add('(different dungeon - world state left as built)');   // cross-location travel-on-load pends
      if (extras.position && extras.locationKey === _locationKey && setPlayerPos) setPlayerPos(extras.position);
      surfacePlayer();
      // A loaded game supersedes whatever pre-game overlay is up.
      // AUDIT 19 F7 (critical): only DeathScreen was cleared, so the
      // menu's LOAD GAME restored the character and then left the
      // CHARGEN WIZARD sitting on top of it - and playing through the
      // wizard runs finishChargen, overwriting the character that was
      // just loaded. The context mounts chargen at build time
      // (dungeonContext.js:772) and dungeon.js calls quickLoad after,
      // so the wizard is ALWAYS up on this path.
      // NOTE: activeOverlay is cleared but chargenFlow is NOT nulled.
      // Four later sites test `activeOverlay === chargenFlow`, and with
      // both null that comparison is TRUE - which would fire
      // finishChargen on the very character the load just restored.
      // AUDIT F2-I2: quickLoad drops the wizard by clearing the slot and
      // deliberately keeps chargenFlow, so the flow can never reach its
      // own exit arm again - a constellation still playing would latch
      // the module's active index and its texture for ever. The host
      // releases it, since the host is what tore the overlay down.
      if (activeOverlay === chargenFlow) stopConstellationAnim();
      if (activeOverlay instanceof DeathScreen || activeOverlay === chargenFlow) activeOverlay = null;
      hudText.add('Game loaded.');
    },
    // U3: ONE overlay seam (chargen, level-up, char sheet) - hosts
    // pause gameplay while any overlay is active.
    get uiOverlayActive() { return !!activeOverlay; },
    overlayWindow: () => activeOverlay,   // U26 probe surface
    dropped: () => droppedLoot._piles,
    /** AUDIT 18 F5: the overlay's own clock. DFU runs
     *  DaggerfallRestWindow.Update every frame the window is topmost
     *  (DaggerfallRestWindow.cs:183-227), and TickRest reads
     *  Time.realtimeSinceStartup, so PauseWhileOpen's timeScale = 0
     *  does not stop it. The port had the tick inside drawFoes, which
     *  the hosts SKIP whenever an overlay is up - so U7's rest never
     *  advanced an hour in either host that mounts a dungeon: the
     *  window sat on "Hours passed: 0" until Escape.
     *  The done-drain is not optional here: RestWindow._end() sets
     *  done on the death path and on a missing endLines, and until
     *  now only overlayInput/overlayClick cleared activeOverlay, so a
     *  rest that ended itself would latch a dead window on screen. */
    tickOverlay(dt) {
      if (!activeOverlay) return;
      activeOverlay.tick?.(dt);   // D1: the death sequence's clock
      if (activeOverlay.isRestWindow) activeOverlay.tickRest(dt);
      // ui-chargen-4: backing out of the race screen cancels the
      // wizard - DFU unwinds the UI stack to the start screen
      // (RaceSelectWindow_OnClose :299-302). The port's front door is
      // the boot flow, so the unwind is a reload: the bare URL lands
      // back on title -> main menu; a dev-scene URL re-offers the
      // wizard fresh (SetRaceSelectWindow Resets on re-entry).
      if (activeOverlay === chargenFlow && chargenFlow?.cancelled) { location.reload(); return; }
      if (activeOverlay.done) {
        if (activeOverlay === chargenFlow) finishChargenHere();
        surfacePlayer();
        activeOverlay = null;
      }
    },
    chargenFlow: () => chargenFlow,   // AUDIT 17i probe surface
    /** U14: the POINTER half of the overlay seam. This host routed
     *  every click to requestPointerLock and nothing else, so chargen
     *  here was keyboard-only while the exterior hosts had been
     *  clickable since U8b. Takes NATIVE (320x200) coords like
     *  townTalk's seam does, and reports whether it consumed the
     *  click so the caller can withhold the pointer lock. */
    overlayClick(vx, vy) {
      // U26: a native window exposes `click`, the keyed ones
      // `clickNative`. Both route here.
      if (!activeOverlay?.clickNative && !activeOverlay?.click) return false;
      if (activeOverlay.clickNative) activeOverlay.clickNative(vx, vy);
      else activeOverlay.click(vx, vy);
      if (activeOverlay.done) {
        if (activeOverlay === chargenFlow) { finishChargenHere(); }
        surfacePlayer();
        activeOverlay = null;
      }
      return true;
    },
    /** The wheel seam (U-scroll): scroll never closes a window, so no
     *  done check. */
    overlayWheel(dir) { activeOverlay?.wheel?.(dir); },
    /** U26: ui/input.js asks this before mapping a key to an action -
     *  a native window keys off raw codes. */
    get overlayIsNative() { return !!activeOverlay?.isChoiceWindow; },
    overlayInput(action, e = null) {
      if (!activeOverlay) return;
      activeOverlay.input(action, e);
      if (activeOverlay.done) {
        if (activeOverlay === chargenFlow) finishChargenHere();
        surfacePlayer();
        activeOverlay = null;
      }
    },
    drawOverlay(canvas) {
      if (!activeOverlay) { _exhaustedShowing = false; return; }   // S20: the popup guard clears with the box (OnClose)
      if (!hudFont) {
        // Font-less: overlays cannot render. Chargen falls back to
        // the headless roll; a pending level-up applies headlessly;
        // anything else just closes. All loud.
        if (activeOverlay === chargenFlow) { chargenInputFallback(); }
        else if (activeOverlay instanceof LevelUpScreen) {
          console.warn('[levelup] FONT art unavailable; applying headlessly');
          applyLevelUp(playerEntity, (st, pool) => spendPoolLowest(st, Object.keys(st), pool));
          surfacePlayer();
        }
        activeOverlay = null;
        return;
      }
      // U26: a NATIVE window letterboxes ITSELF - nativeMetrics reads
      // the real canvas and returns its own integer scale and offset,
      // which is how townTalk has driven these since U8b. Handing it
      // the virtual canvas AND a screen offset applies the letterbox
      // twice: its opaque backdrop then covers only the virtual rect
      // and the dimmed world shows through the bars, which is AUDIT
      // 19 F2's defect for the seventh time. So a native window gets
      // the real canvas and no offset.
      if (activeOverlay.isChoiceWindow) {
        activeOverlay.draw(renderer, canvas, hudFont, hudScaleFor(canvas.width, canvas.height));
        return;
      }
      // Letterbox seam (2026-08-14): overlays lay out on a virtual
      // 320x200*s screen, centered on the real canvas. Full-canvas
      // dim first (the overlay's own backdrop then panels the box);
      // the offset MUST reset even if an overlay draw throws.
      const s = hudScaleFor(canvas.width, canvas.height);
      const vw = 320 * s, vh = 200 * s;
      renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [0.02, 0.02, 0.02, 0.6]);
      renderer.setScreenOffset((canvas.width - vw) / 2, (canvas.height - vh) / 2);
      try {
        activeOverlay.draw(renderer, { width: vw, height: vh }, hudFont, s);
      } finally {
        renderer.setScreenOffset(0, 0);
      }
    },
    toggleCharSheet() {
      if (activeOverlay) return;
      preloadCharSheetArt({ renderer, fetchBytes, palette });   // U8a: lazy - ready by the next open at worst
      // U32: the sheet's navigation buttons. This host has no quest
      // bridge, so charSheetHooks withholds the logbook and the sheet
      // says so - rather than opening an empty book and implying the
      // player has no quests when it simply cannot see them here.
      activeOverlay = new CharSheet(playerEntity, charSheetHooks({
        entity: playerEntity,
        artDeps: { renderer, fetchBytes, palette },
        inventory: () => openInventory(null),
        spellbook: () => (spellsByIndex
          ? new SpellbookWindow(knownSpells(playerEntity, spellsByIndex), playerEntity, {
            ready: (sp) => magic.readySpell(sp),
            castCost: (sp) => calculateCastCost(sp, playerEntity).sp,
          })
          : null),
      }));
    },
    toggleInventory() {
      if (activeOverlay) return;
      activeOverlay = openInventory(null);
    },
    toggleSpellbook() {
      if (activeOverlay) return;
      activeOverlay = new SpellbookWindow(knownSpells(playerEntity, spellsByIndex), playerEntity, {
        // M3: the ready laws (silence gate, cost-at-ready, instant
        // CasterOnly, the click latch) live in the ONE engine.
        ready: (sp) => magic.readySpell(sp),
        castCost: (sp) => calculateCastCost(sp, playerEntity).sp,
      });
    },
    // S2 pickup: piles + dead foes' corpses as activation targets;
    // U26: activating one now OPENS THE INVENTORY with the pile as the
    // remote target, which is what PlayerActivate does - the old
    // takeLoot vacuumed everything in one keypress.
    lootTargets() {
      const targets = [];
      lootPiles.forEach((p, i) => {
        if (!p.batch) return;
        const [hx, hy] = p.half;
        targets.push({ key: `loot:${i}`, aabb: { min: [p.pos[0] - hx, p.pos[1], p.pos[2] - hx], max: [p.pos[0] + hx, p.pos[1] + hy * 2, p.pos[2] + hx] } });
      });
      foes.forEach((f, i) => {
        if (!f.dead || !f.entity?.items?.length) return;
        const p = f.ai.feet;
        // PlayerActivate.cs:85/:938 - a corpse has its OWN reach,
        // CorpseActivationDistance = 150 * GlobalScale = 3.75, not the
        // 128-unit default the loot piles use.
        targets.push({ key: `corpse:${i}`, aabb: { min: [p[0] - 0.5, p[1], p[2] - 0.5], max: [p[0] + 0.5, p[1] + 0.6, p[2] + 0.5] }, distance: CORPSE_ACTIVATION_DISTANCE });
      });
      targets.push(...droppedLoot.lootTargets());   // U26: the player's own drops
      return targets;
    },
    /** U26: PlayerActivate's loot handling, verbatim in shape - the
     *  container becomes the inventory window's REMOTE TARGET and the
     *  player takes what they want, rather than the whole pile
     *  teleporting into the pack on one keypress. Returns the number
     *  of items the target holds, so the caller's "did anything
     *  happen" test still reads. */
    takeLoot(key) {
      const [kind, iStr] = key.split(':');
      const i = Number(iStr);
      let source = null;
      let onEmptied = null;
      if (kind === 'loot') {
        const p = lootPiles[i];
        if (!p || !p.batch) return 0;
        source = p.items;
        // The RDB pile's flat leaves when the window CLOSES on an
        // emptied container, not the instant the last item moves -
        // the same law droppedLoot.releaseEmptied ports.
        onEmptied = () => {
          if (p.items.length || !p.batch) return;
          const bi = billboardBatches.indexOf(p.batch);
          if (bi >= 0) billboardBatches.splice(bi, 1);
          renderer.destroyBillboardBatch(p.batch);
          p.batch = null;
        };
      } else if (kind === 'corpse') {
        const f = foes[i];
        if (!f?.dead) return 0;
        source = f.entity.items;
      } else if (kind.startsWith('droppedLoot')) {
        source = droppedLoot.pileFor(key)?.items ?? null;
      }
      if (!source) return 0;
      if (activeOverlay) return source.length;
      activeOverlay = openInventory(source, onEmptied);
      return source.length;
    },
    textureTable: dungeon.textureTable,
    exitDoors,
    colliderTris,
    destroy() {
      for (const b of billboardBatches) renderer.destroyBatch(b);
      // AUDIT 17e F29 / EVERY ALLOCATION HAS AN OWNER: foes and
      // corpses each own a live billboard batch that is NOT in
      // billboardBatches (that list is the static layout art), so
      // every dungeon enter/exit cycle leaked one VAO + buffers per
      // sprite. Missiles in flight own one too.
      for (const f of foes) if (f.batch) renderer.destroyBillboardBatch(f.batch);
      for (const c of corpses) if (c) renderer.destroyBillboardBatch(c);
      for (const m of missiles) if (m.batch) renderer.destroyBillboardBatch(m.batch);
      for (const t of torches) { t.handle?.stop(); t.handle = null; }   // A2: free looping sources
      // U26 / EVERY ALLOCATION HAS AN OWNER: the dropped piles own a
      // billboard batch each and leave with the dungeon.
      for (const p of droppedLoot._piles) if (p.batch) renderer.destroyBillboardBatch(p.batch);
      droppedLoot._piles.length = 0;
    },
  };
}
