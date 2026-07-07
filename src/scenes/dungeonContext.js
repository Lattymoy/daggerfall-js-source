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
import { EFFECT_ACTION_FLAGS } from '../world/actionSystem.js';
import { playerEntity, surfacePlayer } from '../characters/playerEntity.js';
import { addItem } from '../systems/inventory.js';
import { createWeapon } from '../combat/enemyEquipment.js';
import { createCharacter, CLASS_CAREERS } from '../systems/chargen.js';
import { tallySkill, skillValue, SKILLS, WEAPON_SKILL } from '../systems/skills.js';
import { raiseSkills } from '../systems/advancement.js';
import { readSpellsStd } from '../formats/spellsStd.js';
import { readMagicDef } from '../formats/magicDef.js';
import { ClassFile } from '../formats/classFile.js';
import { fetchBytes } from './shared.js';
import {
  resolveSpellVsTarget, missileArchive, MISSILE_SPEED,
  MISSILE_COLLIDER_RADIUS, MISSILE_LIFESPAN_S, isDamageHealthEffect,
} from '../systems/spellcast.js';
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
    damagePlayer: (dmg) => {
      if (dmg <= 0) return;
      playerEntity.health = Math.max(0, playerEntity.health - dmg);
            surfacePlayer();
    },
    castSpell: (index, origin) => { _pendingCasts.push({ index, origin }); },   // consumed once spells load
    drainMagicka: (n) => {
      playerEntity.magicka = Math.max(0, (playerEntity.magicka ?? 0) - n);
      surfacePlayer();
    },
    playerLevel: () => playerEntity.level,
  });
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
        dynamicDraws.push({ gpu, object: o });
        continue;
      }
      if (p.action && EFFECT_ACTION_FLAGS.has(p.action.actionFlag)) {
        // Hurt/Poison/DrainMagicka/CastSpell: chain-participating
        // logic object; the model stays static (draw + collider
        // below). Origin = the placement translation (CastSpell
        // fires missiles from here, +40*GlobalScale up, verbatim).
        actions.addEffect(p.position, p.action, [matrix[12], matrix[13], matrix[14]]);
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
    // One import + one BODY00I0 fetch for the whole context; every
    // per-enemy dependency lives here (a fetchBytes reference inside
    // the loop once pointed at a name only in THIS block's scope -
    // caught in review, hoisted).
    const [{ ImgFile }, shared, engineRig, { buildRaceCharacter },
      { EnemyAI, withinYaw, isBackFacing }, { EnemyAttack }, { makeEnemyEntity }] = await Promise.all([
      import('../formats/imgFile.js'), import('./shared.js'), import('../characters/engineRig.js'),
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
  }
  for (const e of enemies) {
    const basics = ENEMY_BASICS[e.mobileType];
    if (!basics) continue;
    if (foeDeps && e.mobileType > 43) {
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
      attack.rangedAttack = SKILLS && entity.weapon && WEAPON_SKILL[entity.weapon.name] === SKILLS.Archery;
      foes.push({ rig, ai, attack, entity, mobileType: e.mobileType, gender: e.gender });
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
  if (!playerEntity.chargenDone) {
    const careerIndex = Number.isInteger(opts.playerClass) ? opts.playerClass : 16;
    const cf = new ClassFile();
    cf.load(await fetchBytes(`CLASS${String(careerIndex).padStart(2, '0')}.CFG`));
    createCharacter(playerEntity, cf.career, careerIndex);
    console.log(`[chargen] ${CLASS_CAREERS[careerIndex]}: HP ${playerEntity.maxHealth}, STR ${playerEntity.stats.strength}`);
  }

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
  function playerCastInput(eye, dir) {
    const sp = readiedSpell;
    if (!sp) return false;
    const cost = sp.cost;
    if ((playerEntity.magicka ?? 0) < cost) return false;   // classic refuses without the points
    if (sp.rangeType !== 2 && sp.rangeType !== 4) return false;   // FLAGGED: non-missile ranges pend the library
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
    for (const b of blocks) {
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
      if (damage <= 0) continue;
      damageFoe(foe, damage, playerFeet);   // stagger AWAY from the hit: player in front -> HurtFront
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
            if (dmg > 0) { playerEntity.health = Math.max(0, playerEntity.health - dmg); }
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
            const dmg = resolveSpellVsTarget(m.spell, playerEntity.level, f.entity);
            if (dmg > 0) damageFoe(f, dmg);
            retireMissile(m);
            break;
          }
        }
        continue;
      }
      const dx = target[0] - m.pos[0], dy = target[1] - m.pos[1], dz = target[2] - m.pos[2];
      if (Math.hypot(dx, dy, dz) <= MISSILE_COLLIDER_RADIUS + 0.45) {   // missile radius + player capsule radius
        const dmg = resolveSpellVsTarget(m.spell, playerEntity.level, playerEntity);
        if (dmg > 0) {
          playerEntity.health = Math.max(0, playerEntity.health - dmg);
          surfacePlayer();
        }
        retireMissile(m);
      }
    }
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

  function drawFoes(dt, canvas, proj, view, eye, playerFeet) {
    classicMinutes += (dt * 12) / 60;
    raiseSkills(playerEntity, classicMinutes);
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
      f.ai.update(dt, playerFeet || eye);   // E2: classic senses + pursuit; eye fallback keeps probes alive without a player
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
          const dmg = foeDeps.calculateAttackDamage(f.entity, foeDeps.playerEntity, { targetGroup: null, weapon: wpn });
          if (dmg > 0) {
            foeDeps.playerEntity.health = Math.max(0, foeDeps.playerEntity.health - dmg);
          surfacePlayer();
          }
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
    blockCount: dungeon.blocks.length,
    enemies,
    foes,
    drawFoes,
    playerAttackInput,
    playerCastInput,   // S5: C key in the hosts
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
