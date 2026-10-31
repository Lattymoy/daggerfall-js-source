// WG2-TOWNS (bible/03-World/World-2-Canon.md, "Buildings and settlements"): a World 2.0 town's doors entered against the
// freeware (the player's own BLOCKS.BSA and ARCH3D, ARENA2_PATH - tools/fetch-data.sh): each kind of building's block read
// through the world-data door as the build reads it, its subrecord's interior made from Daggerfall's kit with the cast of a
// donor of its role's pool, laid by the interior's own layout - its street door where the exterior's is, its keeper in.
// Mutation-checked (tools/mutants/wg2towns.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readBake, BAKE_DIR } from '../../../tools/wg2Bake.mjs';
import { decodeBake } from '../../../src/world/gen2/bakeCodec.js';
import { gen2Install } from '../../../src/world/gen2/gen2Ground.js';
import * as W from '../../../src/formats/worldData/worldDataReplacement.js';
import { BlocksFile } from '../../../src/formats/blocksFile.js';
import { Arch3dFile } from '../../../src/formats/arch3dFile.js';
import { dfMeshToModel, GLOBAL_SCALE } from '../../../src/world/meshReader.js';
import { layoutInterior, INTERIOR_MARKER } from '../../../src/world/interior/interiorLayout.js';
import { KIT_PIECE } from '../../../src/world/interior/fabricInteriorKit.js';
import { FABRIC_DONORS } from '../../../src/world/imperialFabricBuildings.js';
import * as T from '../../../src/world/settle2/settle2Towns.js';
import * as Bk from '../../../src/world/settle2/settle2Blocks.js';

const ARENA2 = process.env.ARENA2_PATH;
const skip = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - the interiors against the freeware skipped' : false;
/** Each role's pool (settle2Blocks.js), as the services read them: a tavern's taproom, a shop's counter, a god's temple. */
const POOL = Object.freeze({ tavern: 'tavern', shop: 'general', temple: 'temple', smith: 'weaponsmith', bank: 'bank', barracks: 'house1' });

test('WG2-TOWNS INTERIORS: every kind of a town\'s building entered through the world-data door - its interior made, of a donor of its role\'s pool (a home\'s by its floor), its cast that donor\'s own; laid by the interior\'s layout with its street door at the building\'s door and its people in (mutants: a role\'s pool, the cast\'s record, the plan\'s frame)', { skip }, () => {
  const bytes = (n) => new Uint8Array(readFileSync(`${ARENA2}/${n}`));
  const bf = new BlocksFile(); bf.load(bytes('BLOCKS.BSA'));
  const af = new Arch3dFile(); af.load(bytes('ARCH3D.BSA'));
  const models = new Map();
  const getModel = (id) => { if (!models.has(id)) { const k = af.getRecordIndex(id); models.set(id, k >= 0 ? dfMeshToModel(af.getMesh(k), () => ({ width: 64, height: 64 })) : null); } return models.get(id); };
  const bakes = ['hammerfell-test', 'blackmarsh-test'].map((id) => readBake(`${BAKE_DIR}/${id}.wg2.gz`));
  gen2Install(bakes, decodeBake(bakes[0]).header.fit);
  W.installWorldDataReplacement(); W.bindWorldDataBlocks(bf); Bk.installSettle2();
  const seen = new Map();
  for (const at of T.settle2Towns()) Bk.settle2TownRecords(at).forEach((r, i) => { const k = r.role === 'house' ? `house:${r.pool}` : r.role; if (!seen.has(k)) seen.set(k, [at, r, at.town.buildings[i]]); });
  assert.ok(['tavern', 'shop', 'temple', 'smith', 'bank', 'barracks', 'house:house3', 'house:house2'].every((k) => seen.has(k)), [...seen.keys()].join());
  for (const [k, [at, r, b]] of seen) {
    const [bx, by, rec] = b.slot, block = bf.getBlockByName(T.settle2BlockName(at.town.ordinal, bx, by));
    assert.equal(block.index, T.settle2BlockIndex(at.town.ordinal, bx, by), `${k}: the door's block`);
    const sub = block.rmbBlock.subRecords[rec], made = sub.interior, donor = FABRIC_DONORS[r.donor];
    assert.ok(made.made && sub.interior === made, `${k}: a made interior, the same while kept`);
    assert.equal(donor.pool, POOL[b.role] ?? Bk.settle2PoolOf('house', b.footprint[0] * b.footprint[1]), `${k}: its pool`);
    assert.deepEqual(made.cast, bf.getBlockByName(donor.block).rmbBlock.subRecords[donor.record].interior, `${k}: its donor's cast`);
    const lay = layoutInterior(block, block.index, rec, getModel);
    assert.ok(lay.placements.length > 20 && lay.markers.some((m) => m.type === INTERIOR_MARKER.ENTER), `${k}: laid, with its way in`);
    // the street door: the kit's exit wall's door face at the frame's origin (the building's door), facing out (-z)
    const exit = lay.placements.find((p) => p.modelIdNum % 100 === KIT_PIECE.exit % 100 && Math.floor(p.modelIdNum / 1000) === 3 && getModel(p.modelIdNum)?.doors?.length);
    const face = getModel(exit.modelIdNum).doors[0], M = exit.matrix, c = { x: (face.vert0.x + face.vert2.x) / 2, z: (face.vert0.z + face.vert2.z) / 2 };
    const x = M[0] * c.x + M[8] * c.z + M[12], z = M[2] * c.x + M[10] * c.z + M[14];
    assert.ok(Math.hypot(x, z) < 0.6, `${k}: its street door at the building's door (${x.toFixed(2)}, ${z.toFixed(2)})`);
    // its rooms its footprint: across its front to its width and in to its depth, a cell's half past them at most
    const floors = lay.placements.filter((p) => p.modelIdNum >= KIT_PIECE.floor && p.modelIdNum < KIT_PIECE.floor + 900 && p.modelIdNum % 100 === 0);
    const across = Math.max(...floors.map((p) => Math.abs(p.matrix[12]))), deep = Math.max(...floors.map((p) => p.matrix[14]));
    assert.ok(across <= b.footprint[0] / 2 + 1.7 && deep <= b.footprint[1] + 1.7 && deep >= b.footprint[1] - 3.3, `${k}: its rooms ${across.toFixed(1)} across and ${deep.toFixed(1)} in, for ${b.footprint}`);
    if (['tavern', 'shop', 'smith', 'bank', 'temple'].includes(k)) assert.ok(made.blockPeopleRecords.length > 0, `${k}: its keeper in`);
    assert.ok(Math.abs(made.block3dObjectRecords[0].yPos) < 4096 && GLOBAL_SCALE > 0);
  }
});
