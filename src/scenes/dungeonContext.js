// Shared dungeon build for scene transitions (P5): lay a location's
// dungeon out against a HOST scene's caches and return everything the
// host needs to render and crawl it. Semantics match the standalone
// dungeon scene (M6/R6/R7/R11/P2) with one mechanical difference: the
// per-dungeon texture table is applied as a DRAW-TIME texRemap instead
// of rewriting submesh archives at model build - the host's mesh cache
// serves exteriors too and must stay untouched. UVs therefore keep
// original-archive sizes while pixels come from the table archive,
// which is exactly the dungeon convention already on record.

import { layoutDungeon } from '../world/dungeonLayout.js';
import { applyTextureTable } from '../world/dungeonTextures.js';
import { collectDungeonLights } from '../world/dungeonLights.js';
import { CityLightAnimator, MINUTES_PER_DAY } from '../world/worldClock.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { MobileUnit } from '../characters/mobileUnit.js';   // C11: classic sprite monsters
import { dfMeshToModel, GLOBAL_SCALE } from '../world/meshReader.js';
import { RDB_SIDE } from '../world/rdbLayout.js';
import { EFFECT_ACTION_FLAGS, COLLISION_TIMEOUT_S, classifyPlacementAction, lookAtLockText } from '../world/actionSystem.js';
import { TextRsc } from '../formats/textRsc.js';
import { ActionTextBox, ActionInputBox } from '../ui/actionText.js';
import { playerEntity, surfacePlayer } from '../characters/playerEntity.js';
import { addItem, removeOne } from '../systems/inventory.js';
import { worldAabb } from '../player/activate.js';
import { createWeaponRig, envAttack } from '../combat/weaponRig.js';   // C10: the shared FP-weapon surface
import { equipItem } from '../systems/equip.js';   // AUDIT 17e F17
import { loadHud, drawHud, hudScale as hudScaleFor } from '../ui/hud.js';
import { drawText, makeFont, measureText } from '../ui/text.js';
import { HudText } from '../ui/hudText.js';
import { OneShotLatch } from '../ui/input.js';
import { FntFile } from '../formats/fntFile.js';
import { ImgFile } from '../formats/imgFile.js';
import { createWeapon } from '../combat/enemyEquipment.js';
import { createCharacter, applyCharacter, startingSpells, CLASS_CAREERS } from '../systems/chargen.js';
import { loadCareers, finishChargen, applyHeadlessChargen } from '../systems/chargenSession.js';   // S3c/U9: one career loader
import { assignStartingGear } from '../systems/startingGear.js';   // S3d
import { ChargenFlow } from '../ui/chargen.js';
import { LevelUpScreen, CharSheet, preloadCharSheetArt } from '../ui/charsheet.js';
import { InventoryWindow, SpellbookWindow, DeathScreen, knownSpells } from '../ui/inventory.js';
import { tallySkill, skillValue, SKILLS, WEAPON_SKILL, SKILL_NAMES } from '../systems/skills.js';
import { FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE, CAPSULE_HEIGHT } from '../player/motor.js';
import { raiseSkills, applyLevelUp } from '../systems/advancement.js';
import { spendPoolLowest } from '../systems/chargen.js';
import { readSpellsStd } from '../formats/spellsStd.js';
import { readMagicDef } from '../formats/magicDef.js';
import { ClassFile } from '../formats/classFile.js';
import { fetchBytes } from './shared.js';
import {
  missileArchive, MISSILE_SPEED, MISSILE_COLLIDER_RADIUS,
  MISSILE_LIFESPAN_S, isDamageHealthEffect,
  EXPLOSION_RADIUS, pickTouchTarget, sweepFoes,
} from '../systems/spellcast.js';
import { applySpell, tickActiveEffects, hasActiveEffect, entityIsParalyzed, maxFatigue, isInvisible, isBlending, isAShade } from '../systems/effects.js';
import { FATIGUE_LOSS, maxBreath } from '../systems/statMods.js';
import { updateDiseases, onMonsterHit, SPIDER_TOUCH_SPELL_INDEX } from '../systems/diseases.js';
import { updatePoisons, inflictPoison, rollEnemyWeaponPoison } from '../systems/poisons.js';
import { exhaustionOutcome, EXHAUSTED_IN_WATER, healthRecoveryRate, fatigueRecoveryRate, spellPointRecoveryRate, hasSpecialAbility, SPECIAL_ABILITY } from '../systems/rest.js';
import { REST_TEXT } from '../systems/restSession.js';
import { RestWindow } from '../ui/restWindow.js';
import { AmbientEffects, DUNGEON_AMBIENT_WAITS } from '../systems/ambientEffects.js';
import { dice100, enemyWeightClassicUnits, weaponKnockbackSpeed, KB_UNIT } from '../combat/formulas.js';   // C15: + knockback
import { assignEnemySpells, SPELL_CAST_SOUND } from '../systems/enemySpells.js';
import { calculateCastCost } from '../systems/spellcost.js';
import { snapshotPlayer, restorePlayer, writeQuicksave, readQuicksave } from '../systems/save.js';
import { audio } from '../systems/audio.js';
import { createAnimalAmbience } from '../systems/animalAmbience.js';   // A4: the shared PlayRandomlyIfPlayerNear pass
import {
  SOUND, hitSoundFor,
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
import { ENEMY_BASICS } from '../characters/enemyBasics.js';



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
  audio.init(fetchBytes);
  audio.attachGestureResume();
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
    const cpu = cpuModels.get(id);
    for (const sm of cpu.subMeshes ?? []) {
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
      await ensureRemap(d.modelIdNum);
      // Chain key + own action record + the starting lock (audit
      // 2026-08-16 + P10: chained doors were unreachable and locks
      // had no state to gate on; the P10 player-toggle lock gate now
      // reads currentLockValue).
      const o = actions.addDoor(cpuModels.get(d.modelIdNum), matrix, {
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
      { EnemyAI, withinYaw, isBackFacing }, { EnemyAttack }, { makeEnemyEntity, loadMonsterCareer }, { EnemyCaster }] = await Promise.all([
      import('./shared.js'), import('../characters/engineRig.js'),
      import('../characters/raceCharacter.js'),
      import('../characters/enemyMotor.js'), import('../characters/enemyAttack.js'),
      import('../characters/enemyEntity.js'), import('../characters/enemyCasting.js'),
    ]);
    const bodyImg = new ImgFile();
    bodyImg.load(await fetchBytes('BODY00I0.IMG'), 'BODY00I0.IMG', palette);
    const formulas = await import('../combat/formulas.js');
    const equip = await import('../combat/enemyEquipment.js');
    const { REACTIONS, sampleClip } = await import('../characters/anims.js');

    foeDeps = {
      REACTIONS, sampleClip,
      isBackFacing,
      chooseEnemyWeapon: formulas.chooseEnemyWeapon,
      generateItems: generateLootItems,   // the static import (audit 06e: the dynamic pair was double-sourcing)
      assignEnemyEquipment: equip.assignEnemyEquipment,
      equipmentVariantFor: equip.equipmentVariantFor,
      equipmentItems: equip.equipmentItems,   // G3: equipment -> droppable corpse loot

      calculateAttackDamage: formulas.calculateAttackDamage,
      meleeHitConnects: formulas.meleeHitConnects,
      MELEE_HIT_YAW_DEG: formulas.MELEE_HIT_YAW_DEG,
      withinYaw,
      fetchBytes,
      createCharacterRig: engineRig.createCharacterRig,
      bodyRamps: engineRig.deriveClassicRamps(palette, bodyImg.getDFBitmap()),
      buildRaceCharacter, floorLanding, EnemyAI, EnemyAttack, makeEnemyEntity, loadMonsterCareer, EnemyCaster, ClassFile, playerEntity,   // floorLanding/playerEntity/ClassFile/fetchBytes/generateItems ride the STATIC imports (audits 06c-06e)
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
  for (const e of enemies) {
    const basics = ENEMY_BASICS[e.mobileType];
    if (!basics) continue;
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
      entity.items = D.generateItems(basics.lootTableKey ?? '-', { level: D.playerEntity.level, gender: e.gender });
      // E4b: SetEnemyEquipment verbatim - loadout + the per-part
      // armor-value pass (init 100, subtract, class clamp 60);
      // the right-hand weapon feeds the attack path.
      const variant = D.equipmentVariantFor(entity.careerIndex, entity.isClass);
      if (variant !== null) {
        const eq = D.assignEnemyEquipment(entity, variant, D.playerEntity.level);
        entity.armorValues = eq.armorValues;
        entity.weapon = eq.rightHand;
        // S19b: ItemHelper's poisoned-weapon roll rides the spawn -
        // class enemies + Orc/Centaur/OrcSergeant, 5% (Assassin 60%)
        if (entity.weapon) {
          const pt = rollEnemyWeaponPoison(e.mobileType, D.playerEntity.level);
          if (pt != null) entity.weapon.poisonType = pt;
        }
        // G3 parity fix: DFU adds every equipped piece to the
        // entity's items (AssignEnemyStartingEquipment) - class-foe
        // corpses dropped only table loot, never their equipment.
        entity.items.push(...D.equipmentItems(eq));
      }
      const ai = new D.EnemyAI(collider, pos, yawDeg * Math.PI / 180, {
        liveSpeed: entity.liveSpeed,
        seesThroughInvisibility: basics.seesThroughInvisibility ?? false,   // P13: the illusion-gate exemption
      });
      const attack = new D.EnemyAttack({ liveSpeed: entity.liveSpeed, playerLevel: D.playerEntity.level, reflexes: D.playerEntity.reflexes });
      // Combat bows: an equipped bow makes the foe an archer - the
      // attack starts from SIGHT and the strike looses an arrow.
      attack.rangedAttack = !!entity.weapon && WEAPON_SKILL[entity.weapon.name] === SKILLS.Archery;
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
      continue;
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
      entity.items = D.generateItems(basics.lootTableKey ?? '-', { level: D.playerEntity.level, gender: e.gender });
      // C12: the behaviour motors - flying/spectral pursue in 3D at
      // the face with no gravity, aquatic ride WaterMove against the
      // block water surface (beached = frozen, verbatim).
      const ai = new D.EnemyAI(collider, pos, yawDeg * Math.PI / 180, {
        liveSpeed: entity.liveSpeed,
        seesThroughInvisibility: basics.seesThroughInvisibility ?? false,
        behaviour, mobileId: e.mobileType, waterSurfaceY: waterSurfaceYAt,
      });
      const attack = new D.EnemyAttack({ liveSpeed: entity.liveSpeed, playerLevel: D.playerEntity.level, reflexes: D.playerEntity.reflexes });
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
       const archive = e.gender === 'female' ? basics.femaleTexture : basics.maleTexture;
       const key = `${archive}_0`;
       if (!flatGroups.has(key)) flatGroups.set(key, []);
       flatGroups.get(key).push([e.x, e.y, e.z]);
     }
      continue;
    }
    const archive = e.gender === 'female' ? basics.femaleTexture : basics.maleTexture;
    const key = `${archive}_0`;
    if (!flatGroups.has(key)) flatGroups.set(key, []);
    flatGroups.get(key).push([e.x, e.y, e.z]);
  }

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
    spellsByIndex = new Map(readSpellsStd(await fetchBytes('SPELLS.STD')).map((sp) => [sp.index, sp]));
    // S4c: MAGIC.DEF registers the magic-item templates - a
    // module-level registry, correct for the single active context
    // (each dungeon build re-sets it); the loot MI category is live
    // from here (absent -> stays flagged-skip).
    setMagicItemTemplates(readMagicDef(await fetchBytes('MAGIC.DEF')));
  } catch { /* data absent: casts + MI no-op, loudly flagged */ }
  // U6: the TEXT.RSC database goes LIVE for the action text boxes
  // (the reader shipped with the U-series; the hudText note's
  // "database FLAGGED" narrows to the skill/loot message ids).
  let textRsc = null;
  try {
    textRsc = new TextRsc().load(await fetchBytes('TEXT.RSC'));
  } catch { console.warn('[text] TEXT.RSC unavailable; action text boxes no-op'); }
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
  const hudText = new HudText();   // U5: classic popup messages
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
  const clickCast = new OneShotLatch();   // classic click-to-cast: armed by readying
  let pendingClickCast = false;
  let lastPlayerFeet = null;   // S11: the save position
  let debugHud = false;   // F8 diagnostics
  let _motorState = '';
  let _mouseState = 'no events';
  let _inputState = '';
  const _activity = { running: false, swimming: false, movingLessThanHalfSpeed: true };   // P11 fatigue state; P13 sneak state
  const _sharedStealth = { minute: -1 };   // P13: PlayerEntity.TimeOfLastStealthCheck - one Stealth tally per classic minute across ALL foes
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
  const _restDeps = {
    advanceMinutes: (n) => { classicMinutes += n; },   // the round loop catches the magic rounds up
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
  function hurtPlayer(dmg) {
    if (dmg <= 0) return;
    playerEntity.health = Math.max(0, playerEntity.health - dmg);
    surfacePlayer();
    if (playerEntity.health === 0 && !(activeOverlay instanceof DeathScreen)) {
      activeOverlay = new DeathScreen();
    }
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
  // drained strength lowers the ceiling). INTERIM (loud): the
  // S20: SetFatigue's exhaustion event - hitting 0 with health left
  // raises OnExhausted (once; the popup guard mirrors DFU's
  // displayingExhaustedPopup so rapid drains - the Somnalius case -
  // never stack collapses).
  let _exhaustedShowing = false;
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
      classicMinutes += 60;   // RaiseTime(1 hour) - the round loop catches up the magic rounds
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
  const playerCaster = () => ({ entity: playerEntity, sinks: playerSinks });
  if (!playerEntity.chargenDone) {
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
      chargenFlow = new ChargenFlow(await loadCareers(fetchBytes));
      activeOverlay = chargenFlow;
    }
  }


  // U1: the classic HUD (vitals bottom-left, compass bottom-right) -
  // surfaces the Systems stats every frame; art-gated like all data.
  function chargenInputFallback() {
    // no font art: the flow cannot render - fall back to the headless
    // roll (loud) so the game remains playable without ARENA2 UI art.
    console.warn('[chargen] FONT art unavailable; falling back to the headless roll');
    const r = { career: chargenFlow.career, careerIndex: chargenFlow.classIndex };
    createCharacter(playerEntity, r.career, r.careerIndex);
    // AUDIT 17f: the font-less fallback skipped the spellbook that
    // both the flow and ?class=N fill in.
    playerEntity.spells = startingSpells(r.careerIndex, spellsByIndex);
    assignStartingGear(playerEntity, { classIndex: r.careerIndex });   // S3d: the headless path gets the real kit too
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
    const from = [origin[0], origin[1] + 40 * GLOBAL_SCALE, origin[2]];
    // Audit 2026-08-16e F2: trap bundles are CASTERLESS - DFU's
    // CalculateCasterLevel(null) = 1 for magnitude, duration AND
    // chance (the pre-audit shape fell back to the player's level).
    missiles.push({ spell, casterLevel: 1, pos: from, dir: null, age: 0, batch: null });
  }

  // S5: player casting - the readied spell is ?spell=N or the FIRST
  // ranged damage spell in the file (deterministic, no magic index;
  // the spellbook UI pends). Cost = the record's classic cost field,
  // FLAGGED: DFU recomputes per-effect via the cost tables (that
  // slice replaces this). Range types beyond 2/4 (missile) are
  // FLAGGED to the effect library (caster-only buffs, touch, areas).
  let readiedSpell = null;
  if (spellsByIndex) {
    if (Number.isInteger(opts.playerSpell)) readiedSpell = spellsByIndex.get(opts.playerSpell) ?? null;
    if (!readiedSpell) {
      for (const sp of spellsByIndex.values()) {
        if ((sp.rangeType === 2 || sp.rangeType === 4) && sp.effects.some(isDamageHealthEffect)) { readiedSpell = sp; break; }
      }
    }
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
  function castEnemySpell(f, spell, noSpellPointCost = false) {
    // S19: SetReadySpell(spell, true) - the spider-touch rider casts
    // free; ordinary decisions spend the S10 cost (floored at 0).
    if (!noSpellPointCost) {
      const cost = calculateCastCost(spell, f.entity).sp;
      f.entity.magicka = Math.max(0, (f.entity.magicka ?? 0) - cost);
    }
    const from = [f.ai.feet[0], f.ai.feet[1] + 1.2, f.ai.feet[2]];
    f._castPending = true;   // C14: the sprite Spell one-shot (ChangeEnemyState(Spell) at the cast decision)
    audio.play3d(SPELL_CAST_SOUND[spell.element] ?? SPELL_CAST_SOUND[4], from, 1, { maxDistance: 16 });
    if (spell.rangeType === 0) {
      applySpell(spell, f.entity.level, f.entity, foeSinks(f), Math.random, { entity: f.entity, sinks: foeSinks(f) });
      return;
    }
    missiles.push({ spell, casterLevel: f.entity.level, casterFoe: f, pos: from, dir: null, age: 0, batch: null, fromPlayer: false });
  }
  async function ensureArrowModel(m) {
    if (m.draw !== null) return;
    m.draw = false;
    const gpu = await getGpuMesh(99800);
    if (!gpu) return;
    m.draw = { gpu, object: { matrix: null } };
    dynamicDraws.push(m.draw);
  }
  function arrowMatrix(m) {
    const yaw = Math.atan2(m.dir[0], m.dir[2]) * 180 / Math.PI;
    const pitch = Math.asin(-Math.max(-1, Math.min(1, m.dir[1]))) * 180 / Math.PI;
    return trs(m.pos[0], m.pos[1], m.pos[2], pitch, yaw, 0);
  }
  /** Every spell landing ON THE PLAYER rides this: the S19 Paralyze
   *  awakeAlert ("You are paralyzed.", once per new instance) fires
   *  for player hosts only, exactly like DFU's StartParalyzation. */
  function applySpellToPlayer(spell, casterLevel, caster = null) {
    const r = applySpell(spell, casterLevel, playerEntity, playerSinks, Math.random, caster);
    if (r.paralyzed) hudText.add('You are paralyzed.');
    // S19c: AssignBundle's failure messages, player hosts only -
    // CasterOnly chance fails say "Spell effect failed.", external
    // contact fails and full saves say "Save versus spell made."
    if (r.chanceFailed) hudText.add(spell.rangeType === 0 ? 'Spell effect failed.' : 'Save versus spell made.');
    if (r.saved) hudText.add('Save versus spell made.');
    return r;
  }
  // Cast ranges II: the rangeType-4 EXPLOSION - indiscriminate sweep
  // (OverlapSphere at impact): every live foe within the radius, and
  // the player when close enough.
  function explodeAt(pos, spell, casterLevel, playerFeet, caster = null) {
    for (const t of sweepFoes(pos, EXPLOSION_RADIUS, foes)) {
      applySpell(spell, casterLevel, t.entity, foeSinks(t), Math.random, caster);
    }
    if (playerFeet) {
      const d = Math.hypot(playerFeet[0] - pos[0], playerFeet[1] + 0.9 - pos[1], playerFeet[2] - pos[2]);
      if (d <= EXPLOSION_RADIUS) applySpellToPlayer(spell, casterLevel, caster);
    }
  }

  function playerCastInput(eye, dir) {
    const sp = readiedSpell;
    if (!sp) return false;
    const cost = calculateCastCost(sp, playerEntity).sp;   // S10: the per-effect skill-scaled cost (the record-cost interim retires)
    if ((playerEntity.magicka ?? 0) < cost) return false;   // classic refuses without the points
    if (sp.rangeType === 0) {
      // S7: CasterOnly applies to SELF (Balyna's Balm heals) - no
      // missile; the cost spends here.
      playerEntity.magicka -= cost;
      const r = applySpellToPlayer(sp, playerEntity.level, playerCaster());
      if (r.healed > 0) hudText.add(`You are healed ${r.healed} points.`);
      surfacePlayer();
      return true;
    }
    if (sp.rangeType === 1) {
      // ByTouch: CastReadySpell aborts BEFORE spending when no target
      // sits in touch range (verbatim - the S9 'spends on a whiff'
      // rule was wrong and dies here).
      const t = pickTouchTarget(eye, foes, 2.25 + 0.25, (c, d) => {
        const l = d || 1, dx = (c[0] - eye[0]) / l, dy = (c[1] - eye[1]) / l, dz = (c[2] - eye[2]) / l;
        const hit = collider.raycast(eye, [dx, dy, dz], d);
        return !Number.isFinite(hit) || hit >= d - 1e-3;
      });
      if (!t) return false;
      playerEntity.magicka -= cost;
      surfacePlayer();
      applySpell(sp, playerEntity.level, t.entity, foeSinks(t), Math.random, playerCaster());
      return true;
    }
    if (sp.rangeType === 3) {
      // AreaAroundCaster: every live foe within the explosion radius.
      playerEntity.magicka -= cost;
      surfacePlayer();
      for (const t of sweepFoes(eye, EXPLOSION_RADIUS, foes)) {
        applySpell(sp, playerEntity.level, t.entity, foeSinks(t), Math.random, playerCaster());
      }
      return true;
    }
    if (sp.rangeType !== 2 && sp.rangeType !== 4) return false;
    playerEntity.magicka -= cost;
    surfacePlayer();
    missiles.push({ spell: sp, pos: [eye[0], eye[1], eye[2]], dir: [...dir], age: 0, batch: null, fromPlayer: true });
    return true;
  }

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
        const items = generateLootItems(lootKey, { level: playerEntity.level, gender: 'male' });
        lootPiles.push({ pos: [m.x + b.originX, m.y, m.z + b.originZ], record, items, batch: null });
      }
    }
  }

  const billboardBatches = [];
  for (const [key, centers] of flatGroups) {
    const [archive, record] = key.split('_').map(Number);
    // Flats keep their original archives (the table remaps walls);
    // RDB AddFlat pivots at the raw position - shift to base-centered.
    const t = await getTexture(archive);
    if (!t || record >= t.recordCount) continue;
    uploadRecord(archive, record);
    const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
    const based = centers.map(([x, y, z]) => [x, y - size.h / 2, z]);
    billboardBatches.push(renderer.createBillboardBatch(archive, record, size, based));
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
    spellArmed: () => clickCast.armed || pendingClickCast,
  });
  const playerWeapon = weaponRig.playerWeapon;   // the dungeon-side combat consumers read it
  if (opts.playerWeapon === 'bow') {
    // Combat bows: ?weapon=bow readies a plain Short Bow (template
    // 129; the inventory/equip UI pends - the INTERIM dagger note
    // stands for melee).
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
    uploadRecord(ct.archive, ct.record);
    const size = scaledBillboardSize(t.getSize(ct.record), t.getScale(ct.record));
    // The billboard shader BOTTOM-anchors (position = base): the old
    // +h/2 was a center-anchor holdover and floated every corpse by
    // half its height (C11 audit 08-17; the static-flat path shifts
    // DOWN for the same reason).
    const batch = renderer.createBillboardBatch(ct.archive, ct.record, size, [[p[0], p[1], p[2]]]);
    corpses.push(batch);
    billboardBatches.push(batch);   // hosts draw + destroy() frees
  }
  function playerAttackInput(dx, dy, held) {   // host mouse events buffer here
    if (playerWeapon.sheathed) return;   // WeaponManager verbatim: no attack processing while sheathed (audit 2026-08-17)
    if (held && clickCast.consume()) { pendingClickCast = true; return; }   // the armed click casts, no swing
    weaponRig.attackInput(dx, dy, held);
  }
  function resolvePlayerHit(eye, inViewFn, playerFeet, lookDir) {
    // Verbatim WeaponEnvDamage FIRST (audit 2026-08-16: nothing ever
    // sent the Attack trigger and doors could not be bashed) - the
    // shared envAttack (C10 fold): a bashed door CONSUMES the swing,
    // Receive(Attack) lets it continue, geometry occludes.
    if (lookDir && envAttack(actions, collider, eye, lookDir, Math.random)) return;
    // C10 FOLLOW-UP (live mobile crash, 2026-08-17): the weapon now
    // exists WITHOUT foes, so a swing's hit frame reaches here with
    // foeDeps null (no ?foes, or the async foe deps still loading) -
    // the env attack above already ran; nothing remains to resolve.
    // Pre-fold this path was unreachable foe-less (playerWeapon was
    // foes-gated), which is why no probe ever caught it.
    if (!foeDeps) return;
    // E3d: backstab facing per foe, verbatim IsBackFacing (records
    // 3/4 of the 8-orientation wheel); the chance = the player's
    // Backstabbing skill (flat interim). TallySkill pends Systems.
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
    for (const { foe, damage } of playerWeapon.resolveHit(live, playerEntity, canSee, Math.random, (f) => f._backFacing ? skillValue(playerEntity, SKILLS.Backstabbing) : 0)) {
      // TallySkill (E3c flag clears): the attack skill counts a use
      // per resolved swing, per WeaponManager.MeleeDamage.
      tallySkill(playerEntity, WEAPON_SKILL[playerWeapon.weapon.name] ?? SKILLS.HandToHand);
      if (damage <= 0) {
        // WeaponManager: a resolved swing that deals nothing plays
        // Hit2 barehanded / Parry6 armed (strikingWeapon test).
        const armed = (WEAPON_SKILL[playerWeapon.weapon?.name] ?? SKILLS.HandToHand) !== SKILLS.HandToHand;
        audio.playOneShot(armed ? SOUND.Parry6 : SOUND.Hit2);
        continue;
      }
      // EnemySounds.PlayHitSound at the struck foe, weapon-aware
      audio.play3d(hitSoundFor(playerWeapon.weapon), foe.ai.feet, 1.1, { maxDistance: 16 });   // rides the foe's source shape
      damageFoe(foe, damage, playerFeet, lookDir);   // C15: the attack ray knocks back; rigs also stagger (HurtFront/Back)
    }
  }
  // S3b: the classic clock for skill-raise checks - dt * TimeScale
  // (DFU default 12) in minutes; RaiseSkills gates itself at 360.
  let classicMinutes = 0;
  async function ensureMissileBatch(m) {
    if (m.batch !== null) return;
    m.batch = false;   // in-flight guard
    const archive = missileArchive(m.spell.element);
    const t = await getTexture(archive);
    if (!t) return;
    uploadRecord(archive, 0);
    const size = scaledBillboardSize(t.getSize(0), t.getScale(0));
    m.firePos = [...m.pos];
    m.batch = renderer.createBillboardBatch(archive, 0, size, [[m.firePos[0], m.firePos[1], m.firePos[2]]]);
    billboardBatches.push(m.batch);
  }
  function retireMissile(m) {
    if (m.draw && m.draw.object) {
      const di = dynamicDraws.indexOf(m.draw);
      if (di >= 0) dynamicDraws.splice(di, 1);
    }
    if (m.batch) {
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
      if (Number.isFinite(hitWall) && hitWall <= step + MISSILE_COLLIDER_RADIUS) { retireMissile(m); continue; }
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
              const dmg = foeDeps ? foeDeps.calculateAttackDamage(playerEntity, f.entity, { weapon: m.weapon }) : 0;
              if (dmg > 0) damageFoe(f, dmg, null, m.dir);   // C15: arrows knock along their flight
              addItem(f.entity.items, { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 });   // BowDamage verbatim: the arrow is recoverable from the target
              retireMissile(m);
              break;
            }
          }
        } else if (playerFeet) {
          const dx2 = target[0] - m.pos[0], dy2 = target[1] - m.pos[1], dz2 = target[2] - m.pos[2];
          if (Math.hypot(dx2, dy2, dz2) <= MISSILE_COLLIDER_RADIUS + 0.45) {
            const shooter = m.shooterFoe;
            const dmg = foeDeps && shooter ? foeDeps.calculateAttackDamage(shooter.entity, playerEntity, {
              targetGroup: null, weapon: m.weapon,
              onInflictPoison: (att, tgt, pt) => inflictPoison(playerEntity, pt, false, { currentMinute: Math.floor(classicMinutes) }),   // S19b: poisoned arrows
            }) : 0;
            hurtPlayer(dmg);
            addItem(playerEntity.items, { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 });
            surfacePlayer();
            retireMissile(m);
          }
        }
        continue;
      }
      if (m.fromPlayer) {
        // S5: player missiles seek foes (mid-capsule contact).
        for (const f of foes) {
          if (f.dead) continue;
          const fx = f.ai.feet[0] - m.pos[0], fy = f.ai.feet[1] + 0.9 - m.pos[1], fz = f.ai.feet[2] - m.pos[2];
          if (Math.hypot(fx, fy, fz) <= MISSILE_COLLIDER_RADIUS + 0.45) {
            if (m.spell.rangeType === 4) explodeAt(m.pos, m.spell, playerEntity.level, playerFeet, playerCaster());
            else applySpell(m.spell, playerEntity.level, f.entity, foeSinks(f), Math.random, playerCaster());
            retireMissile(m);
            break;
          }
        }
        continue;
      }
      const dx = target[0] - m.pos[0], dy = target[1] - m.pos[1], dz = target[2] - m.pos[2];
      if (Math.hypot(dx, dy, dz) <= MISSILE_COLLIDER_RADIUS + 0.45) {   // missile radius + player capsule radius
        // S16: enemy missiles carry their caster (level + the
        // transfer heal-back pair); trap casts stay casterless (DFU
        // action casters are null) on the S4b player-level shape.
        const mCaster = m.casterFoe ? { entity: m.casterFoe.entity, sinks: foeSinks(m.casterFoe) } : null;
        if (m.spell.rangeType === 4) explodeAt(m.pos, m.spell, m.casterLevel ?? playerEntity.level, playerFeet, mCaster);
        else applySpellToPlayer(m.spell, m.casterLevel ?? playerEntity.level, mCaster);
        retireMissile(m);
      }
    }
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
      })),
      piles: lootPiles.map((p) => ({ items: p.items.map((it) => ({ ...it })) })),
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
      if (sf.dead && !f.dead) { f.dead = true; spawnCorpse(f); }
    });
    w.piles?.forEach((sp, i) => { if (lootPiles[i]) lootPiles[i].items = sp.items.map((it) => ({ ...it })); });
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
    foe.entity.health -= damage;
    if (foe.entity.health <= 0) {
      foe.dead = true;
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
      const reKnockOk = foe.ai.knockbackSpeed <= 5 / KB_UNIT && isClass;
      if (reKnockOk || (!isClass && mobileWeight > 0)) {
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
  function resolveFoeMelee(f, playerFeet) {
    const hdx = playerFeet[0] - f.ai.feet[0], hdz = playerFeet[2] - f.ai.feet[2];
    if (!foeDeps.meleeHitConnects(f.ai._dist, f.ai.inSight, foeDeps.withinYaw(f.ai.yaw, hdx, hdz, foeDeps.MELEE_HIT_YAW_DEG))) return;
    // E4b: weapon vs weaponless per the DFU rule (EnemyAttack also
    // drops the weapon if the target is metal-immune to it - the
    // player has no minMetalToHit, so that gate is inert)
    const wpn = foeDeps.chooseEnemyWeapon(f.entity.weapon, ENEMY_BASICS[f.mobileType]);
    // AUDIT 2026-08-17c: every resolved enemy attack on the player
    // tallies Dodging (EnemyAttack, before the damage branch) - it
    // was never tallied since C8.
    tallySkill(foeDeps.playerEntity, SKILLS.Dodging, 1);
    // S18: the special-attack rider seam - monster weaponless hits
    // run OnMonsterHit per hit (disease/paralysis/fatigue)
    const dmg = foeDeps.calculateAttackDamage(f.entity, foeDeps.playerEntity, {
      targetGroup: null, weapon: wpn,
      onMonsterHit: (att, tgt, hit) => onMonsterHit(att, tgt, hit, {
        currentDay: Math.floor(classicMinutes / MINUTES_PER_DAY), sinks: playerSinks,
        castParalyze: () => {   // S19: spider/scorpion free-cast Spider Touch (66)
          const sp = spellsByIndex?.get(SPIDER_TOUCH_SPELL_INDEX);
          if (sp) castEnemySpell(f, sp, true);
        },
      }),
      // S19b: a damaging poisoned-weapon hit infects (and the
      // formulas clear the weapon's poison)
      onInflictPoison: (att, tgt, pt) => inflictPoison(foeDeps.playerEntity, pt, false, { currentMinute: Math.floor(classicMinutes) }),
    });
    if (dmg > 0) audio.playOneShot(hitSoundFor(wpn), 1.1);   // the player takes the hit (PlayerFootsteps families)
    hurtPlayer(dmg);
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
  // P12: breath/drowning (PlayerEntity.FixedUpdate on the classic
  // update cadence). Submerged = the controller CENTER (feet + 0.9)
  // + 76*GlobalScale - 0.95 below the block water surface (the head-
  // under threshold; the swim toggle uses 50). While submerged
  // without WaterBreathing: a fresh dive fills currentBreath
  // (DeepBreath = MaxBreath - guild bonuses pend guilds), every 19th
  // classic update drains 1 (the Argonian coin-flip refund pends
  // race selection), and 0 breath is SetHealth(0) - drowned.
  // Surfacing zeroes the counter.
  let _breathTimer = 0, _breathTally = 0;
  function breathTick(dt, playerFeet) {
    _breathTimer += dt;
    while (_breathTimer >= CLASSIC_UPDATE_INTERVAL) {
      _breathTimer -= CLASSIC_UPDATE_INTERVAL;
      const surf = waterSurfaceYAt(playerFeet[0], playerFeet[2]);
      const submerged = surf != null && playerFeet[1] + 0.9 + 76 * 0.025 - 0.95 < surf;
      if (submerged && !hasActiveEffect(playerEntity, 'waterBreathing')) {
        if (!playerEntity.currentBreath) playerEntity.currentBreath = maxBreath(playerEntity);
        if (_breathTally > 18) {
          --playerEntity.currentBreath;
          _breathTally = 0;
        } else {
          ++_breathTally;
        }
        if (playerEntity.currentBreath <= 0) {
          playerEntity.currentBreath = 0;
          hurtPlayer(playerEntity.health);   // SetHealth(0): drowned
        }
      } else {
        playerEntity.currentBreath = 0;
      }
    }
  }
  // A3: the dungeon scene ambience (the scene's Dungeon object runs
  // 5/28) - the 14 one-shots "somewhere around" + the classic-cadence
  // water sounds. Castle-block detection (doNotPlayInCastle) pends.
  const sceneAmbience = new AmbientEffects(DUNGEON_AMBIENT_WAITS);
  sceneAmbience.setPreset('dungeon');
  function drawFoes(dt, canvas, proj, view, eye, playerFeet, moveHeld = false) {
    _weaponCanvas = canvas;   // C10: the rig's late canvas (gesture dim + the overlay draw)
    const _mobileBatches = [];   // C11: the frame's live sprite-mobile quads
    if (playerFeet) lastPlayerFeet = [...playerFeet];
    if (activeOverlay?.isRestWindow) activeOverlay.tickRest(dt);   // U7: the rest clock (the world runs on below - foes can break it)
    if (playerFeet) {
      breathTick(dt, playerFeet);
      const _surf = waterSurfaceYAt(playerFeet[0], playerFeet[2]);
      sceneAmbience.update(dt, {
        playerPos: [playerFeet[0], playerFeet[1] + 0.9, playerFeet[2]],   // the controller center (DFU transform.position)
        waterSurfaceY: _surf,
        submerged: _surf != null && playerFeet[1] + 0.9 + 76 * 0.025 - 0.95 < _surf,
      });
    }
    if (pendingClickCast) {
      pendingClickCast = false;
      playerCastInput(eye, [-view[2], -view[6], -view[10]]);   // classic: the readied spell fires on the click
    }
    // P13: the shared stealth senses context (EnemySenses' player-
    // side reads). S21: all three illusion branches are LIVE -
    // invisible always blocks (the 13 seers exempt), blending 8%
    // see-through, shade 4% - each folding normal + true powers
    // (DaggerfallEntity.IsInvisible/IsBlending/IsAShade, verbatim).
    // sharedStealthMinute = PlayerEntity.TimeOfLastStealthCheck: the
    // Stealth tally fires once per classic minute ACROSS all foes.
    const _senses = {
      gameMinutes: Math.floor(classicMinutes),
      playerStealth: skillValue(playerEntity, SKILLS.Stealth),
      movingLessThanHalfSpeed: _activity.movingLessThanHalfSpeed ?? true,
      playerBlending: isBlending(playerEntity),
      playerInvisible: isInvisible(playerEntity),
      playerShade: isAShade(playerEntity),
      sharedStealth: _sharedStealth,
      tallyStealth: () => tallySkill(playerEntity, SKILLS.Stealth),
    };
    const _prevMinute = Math.floor(classicMinutes);
    classicMinutes += (dt * 12) / 60;
    for (let r = _prevMinute; r < Math.floor(classicMinutes); r++) {
      // S7: one magic round per classic minute (the broker's cadence).
      // S18: diseases update FIRST so an ending disease's final day
      // lands and the same round's tick removes the expired entry
      // (DFU removes at the end of the same DoMagicRound). The classic
      // day = elapsed classic minutes / 1440 (r + 1 = the minute this
      // round completes); day 0 of an infection is incubation.
      updateDiseases(playerEntity, Math.floor((r + 1) / MINUTES_PER_DAY), playerSinks, Math.random,
        (msg) => hudText.add(msg));
      // S19b: the poison minute tick (r + 1 = the classic minute this
      // round completes); foes tick too - poisons are not player-only
      updatePoisons(playerEntity, r + 1, playerSinks, Math.random, (msg) => hudText.add(msg));
      tickActiveEffects(playerEntity, playerSinks);
      for (const f of foes) {
        if (f.dead) continue;
        updatePoisons(f.entity, r + 1, foeSinks(f), Math.random);
        tickActiveEffects(f.entity, foeSinks(f));
      }
    }
    // P11: per-game-minute fatigue loss (PlayerEntity verbatim):
    // default 11; running 88; swimming 44 on a FAILED roll vs the
    // LIVE Swimming skill (success stays default) + the Swimming
    // tally. S20 parity fix: DFU applies the loss ONCE per
    // minute-CHANGE (`lastGameMinutes != gameMinutes` guards a single
    // DecreaseFatigue - no loop over elapsed minutes), so a
    // multi-minute jump (the collapse hour, rest) costs one minute's
    // fatigue - the pre-S20 shape drained every caught-up round.
    // Athleticism multiplier pends the career advantage flags (1.0,
    // flagged); the Argonian exemption pends race selection.
    if (Math.floor(classicMinutes) !== _prevMinute) {
      let loss = FATIGUE_LOSS.Default;
      if (_activity.running) loss = FATIGUE_LOSS.Running;
      else if (_activity.swimming) {
        if (!dice100(skillValue(playerEntity, SKILLS.Swimming))) loss = FATIGUE_LOSS.Swimming;   // Dice100.FailedRoll
        tallySkill(playerEntity, SKILLS.Swimming);
      }
      drainFatigue(loss);
    }
    const raised = raiseSkills(playerEntity, classicMinutes, Math.random, () => {
      // U3: the level-up screen replaces the headless auto-apply
      hudText.add('You have gained a level!');
      if (!activeOverlay) activeOverlay = new LevelUpScreen(playerEntity);
    });
    for (const id of raised) hudText.add(`Your ${SKILL_NAMES[id]} skill has improved.`);   // classic phrasing; TEXT.RSC pends
    collisionTriggers(dt, playerFeet, moveHeld);
    updateMissiles(dt, playerFeet);
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
        if (ev !== 'hit' || !playerFeet) continue;
        if (WEAPON_SKILL[playerWeapon.weapon.name] === SKILLS.Archery) {
          // Combat bows: the strike frame LOOSES an arrow along the
          // look instead of the melee arc (WeaponManager verbatim
          // shape); the weapon skill tallies the same.
          const lookDir = [-view[2], -view[6], -view[10]];   // the view-matrix forward this file already uses for the viewmodel
          if (!removeOne(playerEntity.items, 131)) continue;   // one Arrow per loose, verbatim (the arrow guard normally pre-sheathes at zero)
          fireArrow(eye, lookDir, playerWeapon.weapon, true);
          tallySkill(playerEntity, SKILLS.Archery);
          continue;
        }
        resolvePlayerHit(eye, inView, playerFeet, [-view[2], -view[6], -view[10]]);
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
      // A1 EnemySounds verbatim: the wait counter ALWAYS steps; the
      // sound fires only inside AttractRadius 16. Delay re-rolls
      // Range(3, 9+1); 20% move / 80% bark; humans stay silent.
      if (!f.entity.isClass) {
        const bx = ENEMY_BASICS[f.mobileType];
        if (bx?.barkSound != null) {
          f._attractWait ??= 3 + Math.floor(Math.random() * 7);
          f._attractT = (f._attractT ?? 0) + dt;
          const pp = playerFeet || eye;
          const adx = pp[0] - f.ai.feet[0], ady = pp[1] - f.ai.feet[1], adz = pp[2] - f.ai.feet[2];
          if (f._attractT > f._attractWait && (adx * adx + ady * ady + adz * adz) < 16 * 16) {
            audio.play3d(Math.random() > 0.8 ? bx.moveSound : bx.barkSound, [f.ai.feet[0], f.ai.feet[1] + 1, f.ai.feet[2]], 1, { maxDistance: 16 });
            f._attractWait = 3 + Math.floor(Math.random() * 7);
            f._attractT = 0;
          }
        }
      }
      f.events = _fParalyzed ? [] : f.attack.update(dt, f.ai, playerFeet || eye);   // E2b: verbatim attack decision on the shared machine (S19: paralysis returns early)
      // C11 audit 08-17: the attack START edge (machine Idle -> swing
      // this frame) - MeleeAnimation fires ChangeEnemyState + the
      // attack sound ONCE at the start, not at the hit frame, and not
      // gated on the hit later connecting. A LEVEL signal replayed the
      // sprite sequence inside one swing (the machine outlasts it).
      const _mstate = f.attack.machine.state;
      const _strikeEdge = _mstate !== 'Idle' && (f._prevMState ?? 'Idle') === 'Idle';
      f._prevMState = _mstate;
      if (_strikeEdge && !f.entity.isClass) {
        const sx = ENEMY_BASICS[f.mobileType];
        // PlayAttackSound: half the time, humans stay silent
        if (sx?.attackSound != null && Math.random() <= 0.5) {
          audio.play3d(sx.attackSound, [f.ai.feet[0], f.ai.feet[1] + 1, f.ai.feet[2]], 1, { maxDistance: 16 });
        }
      }
      // S16: the casting decision rides beside the attack machine
      // (DoRangedAttack's spell branch + DoTouchSpell); the decision
      // casts INSTANTLY. RESIDUAL (honest): DFU casters also hold at
      // range and strafe (Enhanced AI) or stand off - our motor keeps
      // the C8 pursuit; the foe casts while closing.
      if (playerFeet && f.caster && !_fParalyzed) {
        const dec = f.caster.update(dt, f.ai, f.attack, playerFeet, playerEntity);
        if (dec) castEnemySpell(f, dec.spell);
      }
      // E3b: the machine's hit frame resolves against the player -
      // EnemyAttack.MeleeDamage verbatim: gate 0.25 / MeleeDistance +
      // 35.156deg, then CalculateAttackDamage (class hand-to-hand;
      // equipment E4). Player-as-target group is null (vampirism only
      // in DFU). HUD pends the UI arc: health surfaces on __player.
      if (playerFeet && f.events.includes('hit')) {
        if (f.attack.rangedAttack) {
          // C17: sprite archers loose on their -1 shoot marker
          // (below); the machine's hit frame stays the DECISION
          // clock only. (ON ICE with the rig path: the machine-frame
          // loose for rig archers.)
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
        if (!_fParalyzed || !f._mout) {
          f._mout = f.mobile.update(dt, {
            moving: f.ai.moving,
            striking: _strikeEdge && !f.attack.rangedAttack,   // the START edge (paralysis eats it - FreezeAnims blocks ChangeEnemyState, verbatim)
            rangedStriking: _strikeEdge && !!f.attack.rangedAttack,   // C17: archers draw records 20-24
            hurting: f.ai.hurtKnock,   // C15: the knockback threshold IS the hurt anim (KnockbackMovement)
            casting: !!f._castPending,   // C14: the cast decision's edge (Spell one-shot)
          }, f.ai.yaw, f.ai.feet, eye);
          f._castPending = false;
          // C17: the ranged -1 (shootArrow) looses the arrow at the
          // player - the machine's hit event no longer fires it for
          // sprite archers.
          if (playerFeet && f.mobile.shootFrame) {
            const from = [f.ai.feet[0], f.ai.feet[1] + 1.2, f.ai.feet[2]];
            const d = [playerFeet[0] - from[0], playerFeet[1] + 0.9 - from[1], playerFeet[2] - from[2]];
            const l = Math.hypot(...d) || 1;
            fireArrow(from, [d[0] / l, d[1] / l, d[2] / l], f.entity.weapon, false, f);
          }
          // C16: the -1 damage marker IS the damage moment
          // (AnimateEnemy doMeleeDamage -> MeleeDamage) - paralysis
          // never reaches here (FreezeAnims "prevents the attack
          // from triggering", verbatim).
          if (playerFeet && f.mobile.hitFrame) resolveFoeMelee(f, playerFeet);
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
    if (_mobileBatches.length) {
      renderer.drawBillboards(_mobileBatches,
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
    drawHud(renderer, canvas, hudArt, playerEntity, heading01);
    hudText.tick(dt);
    if (hudFont) hudText.draw(renderer, canvas, hudFont, hudScaleFor(canvas.width, canvas.height));
    if (hudFont && !activeOverlay && typeof document !== 'undefined' && !document.pointerLockElement) {
      // The lock-lost gap (Mac's F8 readout: 'lock NO' was the whole
      // dead-look mystery): the browser drops pointer lock on every
      // Escape and re-engages only on a click - and the game said
      // NOTHING. Now it says.
      const s3 = hudScaleFor(canvas.width, canvas.height);
      const msg = 'CLICK TO LOOK';
      drawText(renderer, hudFont, msg, (canvas.width - measureText(hudFont.fnt, msg) * s3) / 2, canvas.height / 2 - 30 * s3, s3, [1, 0.9, 0.4, 1]);
    }
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
    if (hudFont && readiedSpell) {
      // U2a's first consumer: the readied spell + cost, classic text
      // above the vitals (the spellbook window replaces this in U4).
      const s = hudScaleFor(canvas.width, canvas.height);
      drawText(renderer, hudFont, `${readiedSpell.name} (${calculateCastCost(readiedSpell, playerEntity).sp})`, 10 * s, canvas.height - 60 * s, s, [0.9, 0.9, 0.75, 1]);
    }
  }

  return {
    drawList,
    dynamicDraws,
    actions,
    collider,
    texRemap,
    billboardBatches,
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
    // C10: the rig's clickAttack carries the sheathed gate the inline
    // version missed - a touch tap while sheathed no longer swings
    // (WeaponManager: no attack processing while sheathed).
    playerClickAttack: weaponRig.clickAttack,
    playerCastInput,   // S5: C key in the hosts
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
    // S11: quicksave/quickload (F9/F12). WORLD state (foes, piles,
    // actions) is FLAGGED - the player snapshot only.
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
      // the whole 1024-unit spawn band. ROUTED leg: DFU also raises
      // PlayerEntity.SetEnemyAlert(true) here - no alert state exists
      // in this port yet (its consumers, fast travel among them, pend).
      if (_restDeps.enemiesNearby()) {
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
    // drain reads. Athleticism multiplier pends the career advantage
    // flags (1.0, flagged).
    reportActivity({ running = false, swimming = false, jumped = false, movingLessThanHalfSpeed = true, fell = 0 } = {}) {
      if (swimming && !_activity.swimming) audio.playOneShot(SOUND.SplashLarge);   // PlayLargeSplash on entry
      _activity.running = running;
      _activity.swimming = swimming;
      _activity.movingLessThanHalfSpeed = movingLessThanHalfSpeed;   // P13: IsMovingLessThanHalfSpeed (the motor computes it)
      if (jumped) {
        drainFatigue(FATIGUE_LOSS.Jumping);
        tallySkill(playerEntity, SKILLS.Jumping);
      }
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
        position: lastPlayerFeet, classicMinutes,
        readiedSpellIndex: readiedSpell?.index ?? null,
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
      classicMinutes = extras.classicMinutes ?? classicMinutes;
      readiedSpell = extras.readiedSpellIndex != null ? spellsByIndex?.get(extras.readiedSpellIndex) ?? null : null;
      if (extras.world && extras.locationKey === _locationKey) applyWorld(extras.world);
      else if (extras.world) hudText.add('(different dungeon - world state left as built)');   // cross-location travel-on-load pends
      if (extras.position && extras.locationKey === _locationKey && setPlayerPos) setPlayerPos(extras.position);
      surfacePlayer();
      if (activeOverlay instanceof DeathScreen) activeOverlay = null;   // rising from a save beats the reload
      hudText.add('Game loaded.');
    },
    // U3: ONE overlay seam (chargen, level-up, char sheet) - hosts
    // pause gameplay while any overlay is active.
    get uiOverlayActive() { return !!activeOverlay; },
    overlayInput(action) {
      if (!activeOverlay) return;
      activeOverlay.input(action);
      if (activeOverlay.done) {
        if (activeOverlay === chargenFlow) {
          // AUDIT 17f / ONE DFU MEMBER, ONE EXPORT: this hand-inlined
          // applyCharacter + startingSpells + AssignStartingGear was
          // the SECOND copy of finishChargen - the exact duplication
          // systems/chargenSession.js was extracted to end, re-grown
          // one slice later. The shared function owns the sequence;
          // only the readied-spell pick is this host's business.
          finishChargen(playerEntity, chargenFlow.result(), spellsByIndex);
          if (playerEntity.spells.length && !readiedSpell) readiedSpell = playerEntity.spells[0];
          chargenFlow = null;
        }
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
      activeOverlay = new CharSheet(playerEntity);
    },
    toggleInventory() {
      if (activeOverlay) return;
      activeOverlay = new InventoryWindow(playerEntity, {
        // AUDIT 17e F17: route through the real equip table - the rig
        // now binds slots[RightHand] every frame, so a direct assignment
        // here would be overwritten. One equip model in every host.
        equip: (item) => { equipItem(playerEntity, item); hudText.add(`${item.name} equipped.`); },
      });
    },
    toggleSpellbook() {
      if (activeOverlay) return;
      activeOverlay = new SpellbookWindow(knownSpells(playerEntity, spellsByIndex), playerEntity, {
        ready: (sp) => { readiedSpell = sp; clickCast.arm(); hudText.add(`${sp.name} readied.`); },   // classic: the next attack-click CASTS
        castCost: (sp) => calculateCastCost(sp, playerEntity).sp,
      });
    },
    // S2 pickup: piles + dead foes' corpses as activation targets;
    // takeLoot transfers into the player entity and removes the flat.
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
        targets.push({ key: `corpse:${i}`, aabb: { min: [p[0] - 0.5, p[1], p[2] - 0.5], max: [p[0] + 0.5, p[1] + 0.6, p[2] + 0.5] } });
      });
      return targets;
    },
    takeLoot(key) {
      const [kind, iStr] = key.split(':');
      const i = Number(iStr);
      let source = null;
      if (kind === 'loot') {
        const p = lootPiles[i];
        if (!p || !p.batch) return 0;
        source = p.items;
        const bi = billboardBatches.indexOf(p.batch);
        if (bi >= 0) billboardBatches.splice(bi, 1);
        renderer.destroyBillboardBatch(p.batch);
        p.batch = null;
      } else if (kind === 'corpse') {
        const f = foes[i];
        if (!f?.dead) return 0;
        source = f.entity.items;
      }
      if (!source) return 0;
      let n = 0;
      playerEntity.items = playerEntity.items || [];
      for (const item of source) { addItem(playerEntity.items, item); n++; }
      source.length = 0;
      surfacePlayer();
      if (n > 0) hudText.add(n === 1 ? 'You take 1 item.' : `You take ${n} items.`);   // TEXT.RSC pends
      return n;
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
    },
  };
}
