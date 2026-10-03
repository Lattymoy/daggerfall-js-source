#!/usr/bin/env node
// REST3 PROBE (2026-10-03, bible/06-Systems/Rest-Arc.md section 4 and 13): where the dungeon's own campfires stand, on
// the real game files. The law is world/dungeonFires.js and its rays are colliderFireProbe - the ones the dungeon host
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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { loadData, RECORD_DUNGEONS } from './climbDungeonProbe.mjs';
import { layoutDungeon } from '../src/world/dungeonLayout.js';
import { Collider } from '../src/player/collider.js';
import { trs, multiply } from '../src/world/mat4.js';
import { classifyPlacementAction } from '../src/world/actionSystem.js';
import { TextureFile, texName } from '../src/formats/textureFile.js';
import { classicBillboardSize } from '../src/world/rmbFlats.js';
import { fireCandidates, landCandidates, enemyMarks, colliderFireProbe, placeDungeonFires, dungeonFireCount, isBorderBlock, fireLayoutInputs } from '../src/world/dungeonFires.js';
import { isHearthFlat } from '../src/systems/survival/hearth.js';

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

/** One dungeon's report. `sizeOf` as layoutHearths'. */
export function probeFires(col, blocks, { elite = false, seed = 0, sizeOf } = {}) {
  const probe = colliderFireProbe(col);
  const { doors, existing } = fireLayoutInputs(blocks, layoutHearths(blocks, sizeOf));
  const inner = blocks.filter((b) => !isBorderBlock(b.name)).length;
  const cands = fireCandidates(blocks);
  const valid = landCandidates(cands, { probe, doors, enemies: enemyMarks(blocks) });
  const fires = placeDungeonFires({ blocks, probe, doors, existing, seed, elite });
  return { inner, candidates: cands.length, valid: valid.length, braziers: existing.length, wanted: dungeonFireCount(inner, elite), fires };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const all = argv.includes('--all');
  const arena2 = process.env.ARENA2_PATH;
  if (!arena2) { console.error('ARENA2_PATH is not set'); process.exit(2); }
  const data = loadData(arena2);
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
    const { blocks } = layoutDungeon(loc, data.blocks, data.getModel);
    const col = hostFireCollider(blocks, data.getModel);
    const r = probeFires(col, blocks, { seed: loc?.dungeon?.recordElement?.header?.locationId ?? 0, sizeOf });
    if (r.fires.length < r.wanted) short++;
    console.log(`${region} / ${name}: blocks ${r.inner}, candidates ${r.candidates}, valid ${r.valid}, braziers ${r.braziers}, fires ${r.fires.length} of ${r.wanted}${r.fires.length < r.wanted ? ' (short)' : ''}`);
    for (const p of r.fires) console.log(`  [${p.map((v) => v.toFixed(1)).join(', ')}]`);
  }
  if (list.length > 1) console.log(`${list.length} dungeons, ${short} short of the count`);
}
