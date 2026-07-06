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
  const actions = new ActionSystem(collider);
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
    const [{ ImgFile }, shared, engineRig, { buildRaceCharacter }, { floorLanding },
      { EnemyAI, withinYaw }, { EnemyAttack }, { makeEnemyEntity }, { ClassFile }, { playerEntity }] = await Promise.all([
      import('../formats/imgFile.js'), import('./shared.js'), import('../characters/engineRig.js'),
      import('../characters/raceCharacter.js'), import('../player/enterExit.js'),
      import('../characters/enemyMotor.js'), import('../characters/enemyAttack.js'),
      import('../characters/enemyEntity.js'), import('../formats/classFile.js'),
      import('../characters/playerEntity.js'),
    ]);
    const bodyImg = new ImgFile();
    bodyImg.load(await shared.fetchBytes('BODY00I0.IMG'), 'BODY00I0.IMG', palette);
    const formulas = await import('../combat/formulas.js');
    foeDeps = {
      calculateAttackDamage: formulas.calculateAttackDamage,
      meleeHitConnects: formulas.meleeHitConnects,
      MELEE_HIT_YAW_DEG: formulas.MELEE_HIT_YAW_DEG,
      withinYaw,
      fetchBytes: shared.fetchBytes,
      createCharacterRig: engineRig.createCharacterRig,
      bodyRamps: engineRig.deriveClassicRamps(palette, bodyImg.getDFBitmap()),
      buildRaceCharacter, floorLanding, EnemyAI, EnemyAttack, makeEnemyEntity, ClassFile, playerEntity,
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
      const ai = new D.EnemyAI(collider, pos, yawDeg * Math.PI / 180, { liveSpeed: entity.liveSpeed });
      const attack = new D.EnemyAttack({ liveSpeed: entity.liveSpeed, playerLevel: D.playerEntity.level, reflexes: D.playerEntity.reflexes });
      foes.push({ rig, ai, attack, entity, mobileType: e.mobileType, gender: e.gender });
      continue;
    }
    const archive = e.gender === 'female' ? basics.femaleTexture : basics.maleTexture;
    const key = `${archive}_0`;
    if (!flatGroups.has(key)) flatGroups.set(key, []);
    flatGroups.get(key).push([e.x, e.y, e.z]);
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
  function drawFoes(dt, canvas, proj, view, eye, playerFeet) {
    for (const f of foes) {
      f.ai.update(dt, playerFeet || eye);   // E2: classic senses + pursuit; eye fallback keeps probes alive without a player
      f.events = f.attack.update(dt, f.ai, playerFeet || eye);   // E2b: verbatim attack decision on the shared machine
      // E3b: the machine's hit frame resolves against the player -
      // EnemyAttack.MeleeDamage verbatim: gate 0.25 / MeleeDistance +
      // 35.156deg, then CalculateAttackDamage (class hand-to-hand;
      // equipment E4). Player-as-target group is null (vampirism only
      // in DFU). HUD pends the UI arc: health surfaces on __player.
      if (playerFeet && f.events.includes('hit')) {
        const pf = playerFeet;
        const hdx = pf[0] - f.ai.feet[0], hdz = pf[2] - f.ai.feet[2];
        if (foeDeps.meleeHitConnects(f.ai._dist, f.ai.inSight, foeDeps.withinYaw(f.ai.yaw, hdx, hdz, foeDeps.MELEE_HIT_YAW_DEG))) {
          const dmg = foeDeps.calculateAttackDamage(f.entity, foeDeps.playerEntity, { targetGroup: null });
          if (dmg > 0) {
            foeDeps.playerEntity.health = Math.max(0, foeDeps.playerEntity.health - dmg);
            window.__player = foeDeps.playerEntity;
          }
        }
      }
      f.rig.setGait(f.ai.moving ? 1 : 3);   // WALK while pursuing, IDLE sway at rest
      f.rig.setPose(f.attack.pose());       // strike clips over the gait; null clears
      f.rig.update(dt);
      const s = f.rig.scale, p = f.ai.feet;
      const mat = trs(p[0], p[1] - f.rig.liveFootY * s, p[2], 0, f.ai.yaw * 180 / Math.PI, 0, s, s, s);   // live support point, same grounding rule as the player rig
      _drawSprite(renderer, canvas, f.rig, mat, proj, view, eye);
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
    textureTable: dungeon.textureTable,
    exitDoors,
    colliderTris,
    destroy() {
      for (const b of billboardBatches) renderer.destroyBatch(b);
    },
  };
}
