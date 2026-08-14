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
import { CityLightAnimator } from '../world/worldClock.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { dfMeshToModel, GLOBAL_SCALE } from '../world/meshReader.js';
import { RDB_SIDE, MOVE_ACTION_FLAGS } from '../world/rdbLayout.js';
import { EFFECT_ACTION_FLAGS, COLLISION_TIMEOUT_S } from '../world/actionSystem.js';
import { playerEntity, surfacePlayer } from '../characters/playerEntity.js';
import { addItem } from '../systems/inventory.js';
import { worldAabb } from '../player/activate.js';
import { loadHud, drawHud, hudScale as hudScaleFor } from '../ui/hud.js';
import { drawText, makeFont, measureText } from '../ui/text.js';
import { HudText } from '../ui/hudText.js';
import { OneShotLatch } from '../ui/input.js';
import { FntFile } from '../formats/fntFile.js';
import { ImgFile } from '../formats/imgFile.js';
import { createWeapon } from '../combat/enemyEquipment.js';
import { createCharacter, applyCharacter, startingSpells, CLASS_CAREERS } from '../systems/chargen.js';
import { ChargenFlow } from '../ui/chargen.js';
import { LevelUpScreen, CharSheet } from '../ui/charsheet.js';
import { InventoryWindow, SpellbookWindow, DeathScreen, knownSpells } from '../ui/inventory.js';
import { tallySkill, skillValue, SKILLS, WEAPON_SKILL, SKILL_NAMES } from '../systems/skills.js';
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
import { applySpell, tickActiveEffects, hasActiveEffect } from '../systems/effects.js';
import { calculateCastCost } from '../systems/spellcost.js';
import { snapshotPlayer, restorePlayer, writeQuicksave, readQuicksave } from '../systems/save.js';
import { audio } from '../systems/audio.js';
import { SOUND, swingSoundFor, hitSoundFor } from '../systems/soundClips.js';
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
  const { renderer, arch, getGpuMesh, cpuModels, getTexture, uploadRecord, palette } = deps;

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

  for (const b of dungeon.blocks) {
    const originMatrix = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const p of b.layout.placements) {
      const matrix = multiply(originMatrix, p.matrix);
      const gpu = await getGpuMesh(p.modelIdNum);
      if (!gpu) continue;
      await ensureRemap(p.modelIdNum);
      const cpu = cpuModels.get(p.modelIdNum);
      if (p.action && MOVE_ACTION_FLAGS.has(p.action.actionFlag)) {
        const o = actions.addAction(p.position, cpu, matrix, p.action);
        // Audit 06f: movers carry their AT-REST bounds so step-on
        // platforms (classic Collision01 elevators) collision-trigger;
        // the pass only tests movers while parked at 'start', where
        // the static AABB is truthful.
        o.aabb = worldAabb(cpu.positions, matrix);
        o.restOnlyTrigger = true;
        dynamicDraws.push({ gpu, object: o });
        continue;
      }
      if (p.action && EFFECT_ACTION_FLAGS.has(p.action.actionFlag)) {
        // Hurt/Poison/DrainMagicka/CastSpell: chain-participating
        // logic object; the model stays static (draw + collider
        // below). Origin = the placement translation (CastSpell
        // fires missiles from here, +40*GlobalScale up, verbatim).
        const eo = actions.addEffect(p.position, p.action, [matrix[12], matrix[13], matrix[14]]);
        eo.aabb = worldAabb(cpu.positions, matrix);   // collision triggers test against this
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
      const o = actions.addDoor(cpuModels.get(d.modelIdNum), matrix);
      dynamicDraws.push({ gpu, object: o });
    }
    for (const f of b.layout.flats) {
      const key = `${f.archive}_${f.record}`;
      if (!flatGroups.has(key)) flatGroups.set(key, []);
      flatGroups.get(key).push([f.x + b.originX, f.y, f.z + b.originZ]);
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
      { EnemyAI, withinYaw, isBackFacing }, { EnemyAttack }, { makeEnemyEntity }] = await Promise.all([
      import('./shared.js'), import('../characters/engineRig.js'),
      import('../characters/raceCharacter.js'),
      import('../characters/enemyMotor.js'), import('../characters/enemyAttack.js'),
      import('../characters/enemyEntity.js'),
    ]);
    const bodyImg = new ImgFile();
    bodyImg.load(await fetchBytes('BODY00I0.IMG'), 'BODY00I0.IMG', palette);
    const formulas = await import('../combat/formulas.js');
    const equip = await import('../combat/enemyEquipment.js');
    const { PlayerWeapon } = await import('../combat/playerWeapon.js');
    const { REACTIONS, sampleClip } = await import('../characters/anims.js');
    const { drawFirstPersonViewmodel } = await import('../render/characterSprite.js');
    const { EYE_HEIGHT } = await import('../player/motor.js');
    foeDeps = {
      PlayerWeapon, REACTIONS, sampleClip,
      isBackFacing, drawFirstPersonViewmodel, EYE_HEIGHT,
      chooseEnemyWeapon: formulas.chooseEnemyWeapon,
      generateItems: generateLootItems,   // the static import (audit 06e: the dynamic pair was double-sourcing)
      assignEnemyEquipment: equip.assignEnemyEquipment,
      equipmentVariantFor: equip.equipmentVariantFor,
      calculateAttackDamage: formulas.calculateAttackDamage,
      meleeHitConnects: formulas.meleeHitConnects,
      MELEE_HIT_YAW_DEG: formulas.MELEE_HIT_YAW_DEG,
      withinYaw,
      fetchBytes,
      createCharacterRig: engineRig.createCharacterRig,
      bodyRamps: engineRig.deriveClassicRamps(palette, bodyImg.getDFBitmap()),
      buildRaceCharacter, floorLanding, EnemyAI, EnemyAttack, makeEnemyEntity, ClassFile, playerEntity,   // floorLanding/playerEntity/ClassFile/fetchBytes/generateItems ride the STATIC imports (audits 06c-06e)
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
    if (foeDeps && e.mobileType > 43) {
     try {
      const D = foeDeps;
      const rig = D.createCharacterRig(renderer, D.buildRaceCharacter('Human', D.bodyRamps, { tone: e.mobileType % 4, hairTone: e.mobileType % 3 }));
      rig.setGait(3);   // standing sway (IDLE)
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
      }
      const ai = new D.EnemyAI(collider, pos, yawDeg * Math.PI / 180, { liveSpeed: entity.liveSpeed });
      const attack = new D.EnemyAttack({ liveSpeed: entity.liveSpeed, playerLevel: D.playerEntity.level, reflexes: D.playerEntity.reflexes });
      // Combat bows: an equipped bow makes the foe an archer - the
      // attack starts from SIGHT and the strike looses an arrow.
      attack.rangedAttack = !!entity.weapon && WEAPON_SKILL[entity.weapon.name] === SKILLS.Archery;
      foes.push({ rig, ai, attack, entity, mobileType: e.mobileType, gender: e.gender });
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

  let chargenFlow = null;
  let activeOverlay = null;
  const hudText = new HudText();   // U5: classic popup messages
  const clickCast = new OneShotLatch();   // classic click-to-cast: armed by readying
  let pendingClickCast = false;
  let lastPlayerFeet = null;   // S11: the save position
  let debugHud = false;   // F8 diagnostics
  let _motorState = '';
  let _mouseState = 'no events';
  let _inputState = '';
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
  // S13 magicka sinks (parallel to heal/hurt): the SpellPoints effect
  // family drives these. IncreaseMagicka clamps to maxMagicka;
  // DecreaseMagicka floors at 0. Both surface for the HUD/F8 readout.
  function restoreMagicka(n) {
    if (n <= 0) return;
    playerEntity.magicka = Math.min(playerEntity.maxMagicka ?? 0, (playerEntity.magicka ?? 0) + n);
    surfacePlayer();
  }
  function drainMagicka(n) {
    if (n <= 0) return;
    playerEntity.magicka = Math.max(0, (playerEntity.magicka ?? 0) - n);
    surfacePlayer();
  }
  const foeDrainMagicka = (ent) => (n) => { if (n > 0) ent.magicka = Math.max(0, (ent.magicka ?? 0) - n); };
  const foeRestoreMagicka = (ent) => (n) => { if (n > 0) ent.magicka = Math.min(ent.maxMagicka ?? Infinity, (ent.magicka ?? 0) + n); };
  if (!playerEntity.chargenDone) {
    if (Number.isInteger(opts.playerClass)) {
      // ?class=N: the headless skip path (rolls + the loud policy)
      const cf = new ClassFile();
      cf.load(await fetchBytes(`CLASS${String(opts.playerClass).padStart(2, '0')}.CFG`));
      createCharacter(playerEntity, cf.career, opts.playerClass);
      playerEntity.spells = startingSpells(opts.playerClass, spellsByIndex);
      console.log(`[chargen] ${CLASS_CAREERS[opts.playerClass]}: HP ${playerEntity.maxHealth}, spells ${playerEntity.spells.length}`);
    } else {
      // U2b: the real flow - all 18 careers load; the host routes
      // input and draws the overlay until done, then applies the
      // HAND-distributed result. The Warrior-16 default is GONE.
      const careers = [];
      for (let i = 0; i < CLASS_CAREERS.length; i++) {
        const cf = new ClassFile();
        cf.load(await fetchBytes(`CLASS${String(i).padStart(2, '0')}.CFG`));
        careers.push({ name: cf.career.name || CLASS_CAREERS[i], career: cf.career });
      }
      chargenFlow = new ChargenFlow(careers);
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
    missiles.push({ spell, pos: from, dir: null, age: 0, batch: null });
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
  // Cast ranges II: the rangeType-4 EXPLOSION - indiscriminate sweep
  // (OverlapSphere at impact): every live foe within the radius, and
  // the player when close enough.
  function explodeAt(pos, spell, casterLevel, playerFeet) {
    for (const t of sweepFoes(pos, EXPLOSION_RADIUS, foes)) {
      applySpell(spell, casterLevel, t.entity, { hurt: (n) => damageFoe(t, n), heal: () => {}, drainMagicka: foeDrainMagicka(t.entity), restoreMagicka: foeRestoreMagicka(t.entity) });
    }
    if (playerFeet) {
      const d = Math.hypot(playerFeet[0] - pos[0], playerFeet[1] + 0.9 - pos[1], playerFeet[2] - pos[2]);
      if (d <= EXPLOSION_RADIUS) applySpell(spell, casterLevel, playerEntity, { hurt: hurtPlayer, heal: healPlayer, restoreMagicka, drainMagicka });
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
      const r = applySpell(sp, playerEntity.level, playerEntity, { hurt: hurtPlayer, heal: healPlayer, restoreMagicka, drainMagicka });
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
      applySpell(sp, playerEntity.level, t.entity, { hurt: (n) => damageFoe(t, n), heal: (n) => { t.entity.health = Math.min(t.entity.maxHealth ?? Infinity, t.entity.health + n); }, drainMagicka: foeDrainMagicka(t.entity), restoreMagicka: foeRestoreMagicka(t.entity) });
      return true;
    }
    if (sp.rangeType === 3) {
      // AreaAroundCaster: every live foe within the explosion radius.
      playerEntity.magicka -= cost;
      surfacePlayer();
      for (const t of sweepFoes(eye, EXPLOSION_RADIUS, foes)) {
        applySpell(sp, playerEntity.level, t.entity, { hurt: (n) => damageFoe(t, n), heal: () => {}, drainMagicka: foeDrainMagicka(t.entity), restoreMagicka: foeRestoreMagicka(t.entity) });
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
  let _drawSprite = null;
  async function _loadSprite() {
    if (!_drawSprite) _drawSprite = (await import('../render/characterSprite.js')).drawCharacterSprite;
  }
  if (foes.length) await _loadSprite();
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
    pile.batch = renderer.createBillboardBatch(RANDOM_TREASURE_ARCHIVE, pile.record, size, [[g[0], g[1] + size.h / 2, g[2]]]);
    billboardBatches.push(pile.batch);
  }

  // C8 E3c: the player's weapon rides the SHARED machine; the host
  // feeds gesture deltas (attackInput) and the hit frame resolves
  // here against the foes - reach/view/LOS verbatim, damage through
  // the full chain, reactions on the shipped clips, death -> the
  // extracted corpse flat replaces the rig.
  const playerWeapon = foes.length ? new foeDeps.PlayerWeapon({}) : null;
  if (playerWeapon && opts.playerWeapon === 'bow') {
    // Combat bows: ?weapon=bow readies a plain Short Bow (template
    // 129; the inventory/equip UI pends - the INTERIM dagger note
    // stands for melee).
    playerWeapon.weapon = { name: 'Short Bow', ...createWeapon(129, 0) };
  }
  // E3d: the player's own body as the FP viewmodel - same authored
  // rig, fpMelee1H base + the dedicated FP sweeps on the machine.
  const viewmodelRig = playerWeapon ? foeDeps.createCharacterRig(renderer, foeDeps.buildRaceCharacter('Human', foeDeps.bodyRamps)) : null;
  let _atkDx = 0, _atkDy = 0, _atkHeld = false;   // event deltas, consumed once per frame
  const corpses = [];
  async function spawnCorpse(f) {
    const ct = ENEMY_BASICS[f.mobileType]?.corpseTexture;
    const p = f.ai.feet;
    if (!ct) return;
    const t = await getTexture(ct.archive);
    if (!t || ct.record >= t.recordCount) return;
    uploadRecord(ct.archive, ct.record);
    const size = scaledBillboardSize(t.getSize(ct.record), t.getScale(ct.record));
    const batch = renderer.createBillboardBatch(ct.archive, ct.record, size, [[p[0], p[1] + size.h / 2, p[2]]]);
    corpses.push(batch);
    billboardBatches.push(batch);   // hosts draw + destroy() frees
  }
  function playerAttackInput(dx, dy, held) {   // host mouse events buffer here
    if (held && clickCast.consume()) { pendingClickCast = true; return; }   // the armed click casts, no swing
    _atkDx += dx; _atkDy += dy; _atkHeld = held;
  }
  function resolvePlayerHit(eye, inViewFn, playerFeet) {
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
    const { playerEntity } = foeDeps;
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
      audio.play3d(hitSoundFor(playerWeapon.weapon), foe.ai.feet, 1.1);
      damageFoe(foe, damage, playerFeet);   // stagger AWAY from the hit: player in front -> HurtFront
    }
  }
  // S3b: the classic clock for skill-raise checks - dt * TimeScale
  // (DFU default 12) in minutes; RaiseSkills gates itself at 360.
  let classicMinutes = 0;
  let _prevWeaponState = null;   // A1: swing-sound edge detect
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
              if (dmg > 0) damageFoe(f, dmg);
              addItem(f.entity.items, { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 });   // BowDamage verbatim: the arrow is recoverable from the target
              retireMissile(m);
              break;
            }
          }
        } else if (playerFeet) {
          const dx2 = target[0] - m.pos[0], dy2 = target[1] - m.pos[1], dz2 = target[2] - m.pos[2];
          if (Math.hypot(dx2, dy2, dz2) <= MISSILE_COLLIDER_RADIUS + 0.45) {
            const shooter = m.shooterFoe;
            const dmg = foeDeps && shooter ? foeDeps.calculateAttackDamage(shooter.entity, playerEntity, { targetGroup: null, weapon: m.weapon }) : 0;
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
            if (m.spell.rangeType === 4) explodeAt(m.pos, m.spell, playerEntity.level, playerFeet);
            else applySpell(m.spell, playerEntity.level, f.entity, {
              hurt: (n) => damageFoe(f, n),
              heal: (n) => { f.entity.health = Math.min(f.entity.maxHealth ?? Infinity, f.entity.health + n); },
              drainMagicka: foeDrainMagicka(f.entity),
              restoreMagicka: foeRestoreMagicka(f.entity),
            });
            retireMissile(m);
            break;
          }
        }
        continue;
      }
      const dx = target[0] - m.pos[0], dy = target[1] - m.pos[1], dz = target[2] - m.pos[2];
      if (Math.hypot(dx, dy, dz) <= MISSILE_COLLIDER_RADIUS + 0.45) {   // missile radius + player capsule radius
        if (m.spell.rangeType === 4) explodeAt(m.pos, m.spell, m.casterLevel ?? playerEntity.level, playerFeet);
        else applySpell(m.spell, playerEntity.level, playerEntity, { hurt: hurtPlayer, heal: healPlayer, restoreMagicka, drainMagicka });
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
    });
  }

  // Shared foe-damage path: melee and spells kill through the same
  // door (corpse + reaction). Factored in S5 so missiles do not grow
  // a second death path.
  function damageFoe(foe, damage, playerFeet = null) {
    foe.entity.health -= damage;
    if (foe.entity.health <= 0) {
      foe.dead = true;
      spawnCorpse(foe);
      return;
    }
    if (playerFeet && foeDeps) {
      const hdx = playerFeet[0] - foe.ai.feet[0], hdz = playerFeet[2] - foe.ai.feet[2];
      const front = foeDeps.withinYaw(foe.ai.yaw, hdx, hdz, 90);
      foe.reaction = { clip: foeDeps.REACTIONS[front ? 'HurtFront' : 'HurtBack'], t: 0 };
    }
  }

  // Combat collision triggers (the last Combat-queue row):
  // DaggerfallActionCollision verbatim shape - per-object 0.12s
  // timeout, fires only while the player ACTIVELY MOVES horizontally
  // (up/down/jump don't trigger in classic), contact beneath the
  // player -> WalkOn else WalkInto (the Collision01 standing-raycast
  // refinement folds into the beneath test at our capsule scale).
  let _prevTriggerFeet = null;
  function collisionTriggers(dt, playerFeet) {
    if (!playerFeet) return;
    const moved = _prevTriggerFeet
      ? Math.hypot(playerFeet[0] - _prevTriggerFeet[0], playerFeet[2] - _prevTriggerFeet[2]) > 1e-4
      : false;
    _prevTriggerFeet = [...playerFeet];
    if (!moved) return;
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

  function drawFoes(dt, canvas, proj, view, eye, playerFeet) {
    if (playerFeet) lastPlayerFeet = [...playerFeet];
    if (pendingClickCast) {
      pendingClickCast = false;
      playerCastInput(eye, [-view[2], -view[6], -view[10]]);   // classic: the readied spell fires on the click
    }
    const _sightScale = hasActiveEffect(playerEntity, 'chameleonNormal') ? 0.5 : 1;   // S8 concealment
    const _prevMinute = Math.floor(classicMinutes);
    classicMinutes += (dt * 12) / 60;
    for (let r = _prevMinute; r < Math.floor(classicMinutes); r++) {
      // S7: one magic round per classic minute (the broker's cadence)
      tickActiveEffects(playerEntity, { hurt: hurtPlayer, heal: healPlayer, restoreMagicka, drainMagicka });
      for (const f of foes) if (!f.dead) tickActiveEffects(f.entity, { hurt: (n) => damageFoe(f, n), heal: () => {}, drainMagicka: foeDrainMagicka(f.entity), restoreMagicka: foeRestoreMagicka(f.entity) });
    }
    const raised = raiseSkills(playerEntity, classicMinutes, Math.random, () => {
      // U3: the level-up screen replaces the headless auto-apply
      hudText.add('You have gained a level!');
      if (!activeOverlay) activeOverlay = new LevelUpScreen(playerEntity);
    });
    for (const id of raised) hudText.add(`Your ${SKILL_NAMES[id]} skill has improved.`);   // classic phrasing; TEXT.RSC pends
    collisionTriggers(dt, playerFeet);
    updateMissiles(dt, playerFeet);
    if (playerWeapon) {
      playerWeapon.gesture(_atkDx, _atkDy, _atkHeld, dt, Math.max(canvas.clientWidth, canvas.clientHeight));
      _atkDx = 0; _atkDy = 0;
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
      const _wpnState = playerWeapon.machine.state;
      if (_wpnState !== _prevWeaponState) {
        // FPSWeapon plays SwingWeaponSound at swing start: the
        // machine ENTERING a Strike* state is that moment here.
        if (_wpnState && _wpnState.startsWith('Strike')) audio.playOneShot(swingSoundFor(playerWeapon.weapon), 1.1);
        _prevWeaponState = _wpnState;
      }
      for (const ev of playerWeapon.update(dt)) {
        if (ev !== 'hit' || !playerFeet) continue;
        if (WEAPON_SKILL[playerWeapon.weapon.name] === SKILLS.Archery) {
          // Combat bows: the strike frame LOOSES an arrow along the
          // look instead of the melee arc (WeaponManager verbatim
          // shape); the weapon skill tallies the same.
          const lookDir = [-view[2], -view[6], -view[10]];   // the view-matrix forward this file already uses for the viewmodel
          fireArrow(eye, lookDir, playerWeapon.weapon, true);
          tallySkill(playerEntity, SKILLS.Archery);
          continue;
        }
        resolvePlayerHit(eye, inView, playerFeet);
      }
    }
    for (const f of foes) {
      if (f.dead) continue;
      f.ai.update(dt, playerFeet || eye, _sightScale);   // E2 senses + pursuit; S8: chameleon halves sight
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
            audio.play3d(Math.random() > 0.8 ? bx.moveSound : bx.barkSound, [f.ai.feet[0], f.ai.feet[1] + 1, f.ai.feet[2]]);
            f._attractWait = 3 + Math.floor(Math.random() * 7);
            f._attractT = 0;
          }
        }
      }
      f.events = f.attack.update(dt, f.ai, playerFeet || eye);   // E2b: verbatim attack decision on the shared machine
      // E3b: the machine's hit frame resolves against the player -
      // EnemyAttack.MeleeDamage verbatim: gate 0.25 / MeleeDistance +
      // 35.156deg, then CalculateAttackDamage (class hand-to-hand;
      // equipment E4). Player-as-target group is null (vampirism only
      // in DFU). HUD pends the UI arc: health surfaces on __player.
      if (playerFeet && f.events.includes('hit')) {
        if (f.attack.rangedAttack) {
          // Enemy archer: the strike frame LOOSES an arrow at the
          // player (ShootBow verbatim shape) - flight + BowDamage
          // resolve in updateMissiles.
          const from = [f.ai.feet[0], f.ai.feet[1] + 1.2, f.ai.feet[2]];
          const d = [playerFeet[0] - from[0], playerFeet[1] + 0.9 - from[1], playerFeet[2] - from[2]];
          const l = Math.hypot(...d) || 1;
          fireArrow(from, [d[0] / l, d[1] / l, d[2] / l], f.entity.weapon, false, f);
          continue;
        }
        const pf = playerFeet;
        const hdx = pf[0] - f.ai.feet[0], hdz = pf[2] - f.ai.feet[2];
        if (foeDeps.meleeHitConnects(f.ai._dist, f.ai.inSight, foeDeps.withinYaw(f.ai.yaw, hdx, hdz, foeDeps.MELEE_HIT_YAW_DEG))) {
          // E4b: weapon vs weaponless per the DFU rule (EnemyAttack
          // also drops the weapon if the target is metal-immune to it
          // - the player has no minMetalToHit, so that gate is inert)
          const wpn = foeDeps.chooseEnemyWeapon(f.entity.weapon, ENEMY_BASICS[f.mobileType]);
          // PlayAttackSound: half the time, humans stay silent
          const bx = ENEMY_BASICS[f.mobileType];
          if (!f.entity.isClass && bx?.attackSound != null && Math.random() <= 0.5) {
            audio.play3d(bx.attackSound, [f.ai.feet[0], f.ai.feet[1] + 1, f.ai.feet[2]]);
          }
          const dmg = foeDeps.calculateAttackDamage(f.entity, foeDeps.playerEntity, { targetGroup: null, weapon: wpn });
          if (dmg > 0) audio.playOneShot(hitSoundFor(wpn), 1.1);   // the player takes the hit (PlayerFootsteps families)
          hurtPlayer(dmg);
        }
      }
      f.rig.setGait(f.ai.moving ? 1 : 3);   // WALK while pursuing, IDLE sway at rest
      let pose = f.attack.pose();
      if (f.reaction) {                     // a hit stagger overrides the strike
        f.reaction.t += dt;
        const R = f.reaction.clip;
        if (f.reaction.t >= R.dur) f.reaction = null;
        else pose = foeDeps.sampleClip(R, f.reaction.t / R.dur);
      }
      f.rig.setPose(pose);
      f.rig.update(dt);
      const s = f.rig.scale, p = f.ai.feet;
      const mat = trs(p[0], p[1] - f.rig.liveFootY * s, p[2], 0, f.ai.yaw * 180 / Math.PI, 0, s, s, s);   // live support point, same grounding rule as the player rig
      _drawSprite(renderer, canvas, f.rig, mat, proj, view, eye);
    }
    if (viewmodelRig && playerFeet) {
      // LAST: the FP overlay composites over the whole frame
      // (classic draws the weapon over everything). Camera yaw/pitch
      // derive from the view matrix's back row.
      const fw = [-view[2], -view[6], -view[10]];
      const vYaw = Math.atan2(fw[0], fw[2]);
      const vPitch = Math.asin(Math.max(-1, Math.min(1, fw[1])));
      viewmodelRig.setPose(playerWeapon.pose());
      viewmodelRig.update(dt);
      foeDeps.drawFirstPersonViewmodel(renderer, canvas, viewmodelRig, playerFeet, vYaw, vPitch, foeDeps.EYE_HEIGHT);
    }
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
    get playerFallScale() { return hasActiveEffect(playerEntity, 'slowfall') ? 0.15 : 1; },   // S8: hosts feed their motor
    // S11: quicksave/quickload (F9/F12). WORLD state (foes, piles,
    // actions) is FLAGGED - the player snapshot only.
    toggleDebugHud() { debugHud = !debugHud; },
    reportMotor(grounded, velY, yaw) { _motorState = `g:${grounded ? 1 : 0} vy:${velY.toFixed(1)} yaw:${yaw.toFixed(2)}`; },
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
          const r = chargenFlow.result();
          applyCharacter(playerEntity, r.career, r.careerIndex, r);
          playerEntity.spells = startingSpells(r.careerIndex, spellsByIndex);   // S6: the spellbook interim retires
          if (playerEntity.spells.length && !readiedSpell) readiedSpell = playerEntity.spells[0];
          chargenFlow = null;
        }
        surfacePlayer();
        activeOverlay = null;
      }
    },
    drawOverlay(canvas) {
      if (!activeOverlay) return;
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
      activeOverlay = new CharSheet(playerEntity);
    },
    toggleInventory() {
      if (activeOverlay) return;
      activeOverlay = new InventoryWindow(playerEntity, {
        equip: (item) => { if (playerWeapon) { playerWeapon.weapon = item; hudText.add(`${item.name} equipped.`); } },
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
    },
  };
}
