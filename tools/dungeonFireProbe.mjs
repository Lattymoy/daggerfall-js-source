#!/usr/bin/env node
// REST3 PROBE (2026-10-03, bible/06-Systems/Rest-Arc.md section 4 and 13): where the dungeon's own campfires stand, on
// the real game files. The law is world/dungeon/dungeonFires.js and its rays are colliderFireProbe - the ones the dungeon host
// casts. Gated on the game data, as every real-data check is:
//
//   ARENA2_PATH=/path/to/arena2 node tools/dungeonFireProbe.mjs "Daggerfall" "Castle Kingwing"
//   ARENA2_PATH=/path/to/arena2 node tools/dungeonFireProbe.mjs --all          the record dungeons (climbDungeonProbe's list)
//
// Each line: the dungeon, its non-border blocks, the candidates, the valid ones, the fires placed (and the count the
// law wanted), and each fire's position. A dungeon that stands fewer than it wanted is said so - the candidates ran out
// of room 80 m apart, which is the law, not a fault.
//
// AUDIT REST-PARTY C6: THE PROBE SAYS WHAT THE GAME STANDS - it could not, three ways. It read the layout's fires at
// their CENTRE where the host reads their foot (half the flat's height lower: a different storey band, a different
// spread); it kept clear of every door face the layout lists where the host keeps clear of the DungeonExit ones alone;
// and it borrowed climbDungeonProbe's collider, which puts the movers and the action doors in the 'dungeon' bucket the
// floor ray now asks for by name (C4). The doors and the fires are now the law's own reading (fireLayoutInputs, the one
// the host hands), the fires' feet are measured off TEXTURE.210 as the host measures them, and the collider below hangs
// each mover, special door and action door in a bucket of its own, in the host's order.
//
// AUDIT REST II F6: AND IT READS THE MODELS THE HOST READS. The host builds its collider from patchSeams(id, mesh)
// (scenes/dataPipeline.js, DUNGEON-SEAMS - the holes in Daggerfall's own stairs and ceilings closed), and this tool took
// climbDungeonProbe's raw ARCH3D meshes: a patched stair's foot stood 5 cm off where the game has it, the very margin
// of the law's level ring. Its models are hostModelReader's now. Every count it prints is the law's own single call
// (dungeonFires.js dungeonFirePlan), so the report cannot read the candidates another way.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { loadData, RECORD_DUNGEONS } from './climbDungeonProbe.mjs';
import { layoutDungeon } from '../src/world/dungeon/dungeonLayout.js';
import { Collider } from '../src/player/collider.js';
import { trs, multiply } from '../src/world/mat4.js';
import { classifyPlacementAction } from '../src/world/actionSystem.js';
import { TextureFile, texName } from '../src/formats/textureFile.js';
import { classicBillboardSize } from '../src/world/rmbFlats.js';
import { dfMeshToModel } from '../src/world/meshReader.js';
import { patchSeams } from '../src/world/arch3dSeams.js';
import { colliderFireProbe, dungeonFirePlan, layoutFireCount, isBorderBlock, fireLayoutInputs } from '../src/world/dungeon/dungeonFires.js';
import { isHearthFlat } from '../src/systems/survival/hearth.js';

/**
 * AUDIT REST II F6: the models as the host reads them - patchSeams before dfMeshToModel, as scenes/dataPipeline.js's
 * model upload does - from an Arch3dFile (`arch`: getRecordIndex, getMesh); a model the archive lacks is null, as the
 * host's. The texture sizes the collider never reads (a model's uv alone).
 */
export function hostModelReader(arch) {
  const cache = new Map();
  return (id) => {
    if (!cache.has(id)) {
      const index = arch.getRecordIndex(id);
      cache.set(id, index === -1 ? null : dfMeshToModel(patchSeams(id, arch.getMesh(index)), () => ({ width: 1, height: 1 })));
    }
    return cache.get(id);
  };
}

/**
 * AUDIT REST-PARTY C6: the dungeon's collider in the HOST'S buckets (scenes/dungeonContext.js, the block loop): every
 * placed model in 'dungeon' but a mover's and a special door's (actionSystem addAction / addSpecialDoor, keyed
 * `act:<block>:<position>`), then the block's enabled action doors (addDoor, the same key) - block by block, in that
 * order, so a tie between two buckets falls as the host's does. A model `getModel` cannot answer is skipped, as the host
 * skips one its ARCH3D lacks.
 */
export function hostFireCollider(blocks, getModel) {
  const col = new Collider(() => -Infinity);
  let loose = 0;
  (blocks ?? []).forEach((b, bi) => {
    const om = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const p of b.layout.placements ?? []) {
      const m = getModel(p.modelIdNum);
      if (!m) continue;
      const cls = p.action ? classifyPlacementAction(p.action.actionFlag, false) : null;
      col.addMesh(cls === 'move' || cls === 'specialDoor' ? `act:${bi}:${p.position}` : 'dungeon', m.positions, m.indices, multiply(om, p.matrix));
    }
    for (const d of b.layout.actionDoors ?? []) {
      if (d.disabled) continue;
      const m = getModel(d.modelIdNum);
      if (!m) continue;
      col.addMesh(d.position != null ? `act:${bi}:${d.position}` : `door:${loose++}`, m.positions, m.indices, multiply(om, d.matrix));
    }
  });
  return col;
}

/**
 * AUDIT REST-PARTY C6: the layout's fires as the host's `dungeonHearths` rows - every hearth flat (HEARTH1's
 * isHearthFlat) at the block's origin, its `foot` half the billboard's height under its centre. `sizeOf(archive, record)`
 * answers the record's CLASSIC size (the host's lawFoot - AUDIT REST-PARTY C7: never a texture mod's), or null where the
 * archive has no such record (the row then has no foot, as there).
 */
export function layoutHearths(blocks, sizeOf = () => null) {
  return (blocks ?? []).flatMap((b) => (b.layout.flats ?? []).filter((f) => isHearthFlat(f.archive, f.record)).map((f) => {
    const size = sizeOf(f.archive, f.record);
    return { x: f.x + b.originX, y: f.y, z: f.z + b.originZ, foot: size ? f.y - size.h / 2 : undefined, w: size?.w, h: size?.h };
  }));
}

/** One dungeon's report. `sizeOf` as layoutHearths'. AUDIT REST II: the law's one call reports it all - the candidates,
 *  the landed ones, the fires and the layout fire taken for the entrance's (F5); a palace wants none (F2). */
export function probeFires(col, blocks, { elite = false, seed = 0, sizeOf } = {}) {
  const probe = colliderFireProbe(col);
  const { doors, existing } = fireLayoutInputs(blocks, layoutHearths(blocks, sizeOf));
  const plan = dungeonFirePlan({ blocks, probe, doors, existing, seed, elite });
  const inner = blocks.filter((b) => !isBorderBlock(b.name)).length;
  return { inner, candidates: plan.candidates, valid: plan.valid, braziers: existing.length, wanted: layoutFireCount(blocks, elite), fires: plan.fires, doorFire: plan.doorFire };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const all = argv.includes('--all');
  const arena2 = process.env.ARENA2_PATH;
  if (!arena2) { console.error('ARENA2_PATH is not set'); process.exit(2); }
  const data = loadData(arena2);
  const getModel = hostModelReader(data.arch);   // AUDIT REST II F6: the host's models, seams patched
  const textures = new Map();
  const sizeOf = (archive, record) => {   // the host's: getTexture(archive), then the classic size where the record is there
    if (!textures.has(archive)) {
      const t = new TextureFile();
      let ok = false;
      try { ok = t.load(new Uint8Array(readFileSync(join(arena2, texName(archive)))), texName(archive)); } catch { ok = false; }
      textures.set(archive, ok ? t : null);
    }
    const t = textures.get(archive);
    return t && record < t.recordCount ? classicBillboardSize(t, record) : null;   // AUDIT REST-PARTY C7: the law's height is the classic record's (dungeonContext's lawFoot)
  };
  const list = all ? RECORD_DUNGEONS : [[argv[0], argv[1]]];
  let short = 0;
  for (const [region, name] of list) {
    const loc = data.maps.getLocationByName(region, name);
    const { blocks } = layoutDungeon(loc, data.blocks, getModel);
    const col = hostFireCollider(blocks, getModel);
    const r = probeFires(col, blocks, { seed: loc?.dungeon?.recordElement?.header?.locationId ?? 0, sizeOf });
    const stood = r.fires.length + (r.doorFire ? 1 : 0);   // C5: a brazier taken for the entrance's counts toward N
    if (stood < r.wanted) short++;
    console.log(`${region} / ${name}: blocks ${r.inner}, candidates ${r.candidates}, valid ${r.valid}, braziers ${r.braziers}, fires ${r.fires.length}${r.doorFire ? ' and the door\'s brazier' : ''} of ${r.wanted}${stood < r.wanted ? ' (short)' : ''}`);
    if (r.doorFire) console.log(`  [${r.doorFire.map((v) => v.toFixed(1)).join(', ')}] the layout's, the entrance's`);
    for (const p of r.fires) console.log(`  [${p.map((v) => v.toFixed(1)).join(', ')}]`);
  }
  if (list.length > 1) console.log(`${list.length} dungeons, ${short} short of the count`);
}
