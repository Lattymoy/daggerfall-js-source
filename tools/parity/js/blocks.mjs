import { BlocksFile, BLOCK_TYPES } from '../../../src/formats/blocksFile.js';
import { openOut, out, closeOut, read, pad, S, sha1, BW } from './common.mjs';

openOut(process.argv[2]);
const bf = new BlocksFile();
if (!bf.load(read('BLOCKS.BSA'))) { out('blocks.load', 'FAIL'); }
else {
  bf.autoDiscard = true;
  out('blocks.count', bf.count);
  for (let i = 0; i < bf.count; i++) {
    const p = `blk.${pad(i, 5)}.`;
    out(p + 'name', S(bf.getBlockName(i)));
    out(p + 'type', bf.getBlockType(i));
    const b = bf.getBlock(i);
    if (b === null) { out(p + 'index', -999); continue; }
    out(p + 'index', b.index);
    out(p + 'bname', S(b.name));
    out(p + 'btype', b.type);
    if (b.type === BLOCK_TYPES.Rmb) dumpRmb(p, b);
    else if (b.type === BLOCK_TYPES.Rdb) dumpRdb(p, b);
    else if (b.type === BLOCK_TYPES.Rdi) out(p + 'rdi.sha', sha1(b.rdiBlock.data));
  }
}

function dumpMisc3d(p, arr) {
  out(p + 'count', arr === null || arr === undefined ? -1 : arr.length);
  if (!arr) return;
  for (let i = 0; i < arr.length; i++) {
    const q = `${p}${pad(i, 3)}.`;
    out(q + 'modelId', S(arr[i].modelId));
    out(q + 'modelIdNum', arr[i].modelIdNum);
    out(q + 'objectType', arr[i].objectType);
    out(q + 'x', arr[i].xPos); out(q + 'y', arr[i].yPos); out(q + 'z', arr[i].zPos);
    out(q + 'xr', arr[i].xRotation); out(q + 'yr', arr[i].yRotation); out(q + 'zr', arr[i].zRotation);
  }
}
function dumpMiscFlat(p, arr) {
  out(p + 'count', arr === null || arr === undefined ? -1 : arr.length);
  if (!arr) return;
  for (let i = 0; i < arr.length; i++) {
    const q = `${p}${pad(i, 3)}.`;
    out(q + 'x', arr[i].xPos); out(q + 'y', arr[i].yPos); out(q + 'z', arr[i].zPos);
    out(q + 'arch', arr[i].textureArchive); out(q + 'rec', arr[i].textureRecord);
    out(q + 'faction', arr[i].factionID); out(q + 'flags', arr[i].flags);
  }
}
function dumpRmbBlockData(p, d) {
  out(p + 'n3d', d.header.num3dObjectRecords);
  out(p + 'nflat', d.header.numFlatObjectRecords);
  out(p + 'ns3', d.header.numSection3Records);
  out(p + 'nppl', d.header.numPeopleRecords);
  out(p + 'ndoor', d.header.numDoorRecords);
  dumpMisc3d(p + 'm3d.', d.block3dObjectRecords);
  dumpMiscFlat(p + 'flat.', d.blockFlatObjectRecords);
  const s3 = d.blockSection3Records;
  out(p + 's3.count', s3 === null || s3 === undefined ? -1 : s3.length);
  if (s3) for (let i = 0; i < s3.length; i++) {
    const q = `${p}s3.${pad(i, 3)}.`;
    out(q + 'x', s3[i].xPos); out(q + 'y', s3[i].yPos); out(q + 'z', s3[i].zPos);
  }
  const pl = d.blockPeopleRecords;
  out(p + 'ppl.count', pl === null || pl === undefined ? -1 : pl.length);
  if (pl) for (let i = 0; i < pl.length; i++) {
    const q = `${p}ppl.${pad(i, 3)}.`;
    out(q + 'x', pl[i].xPos); out(q + 'y', pl[i].yPos); out(q + 'z', pl[i].zPos);
    out(q + 'arch', pl[i].textureArchive); out(q + 'rec', pl[i].textureRecord);
    out(q + 'faction', pl[i].factionID); out(q + 'flags', pl[i].flags);
  }
  const dr = d.blockDoorRecords;
  out(p + 'door.count', dr === null || dr === undefined ? -1 : dr.length);
  if (dr) for (let i = 0; i < dr.length; i++) {
    const q = `${p}door.${pad(i, 3)}.`;
    out(q + 'x', dr[i].xPos); out(q + 'y', dr[i].yPos); out(q + 'z', dr[i].zPos);
    out(q + 'yr', dr[i].yRotation); out(q + 'openr', dr[i].openRotation);
    out(q + 'modelIndex', dr[i].doorModelIndex);
  }
}
function dumpRmb(p, b) {
  const f = b.rmbBlock.fldHeader;
  out(p + 'rmb.numBlockData', f.numBlockDataRecords);
  out(p + 'rmb.numMisc3d', f.numMisc3dObjectRecords);
  out(p + 'rmb.numMiscFlat', f.numMiscFlatObjectRecords);
  out(p + 'rmb.fldName', S(f.name));
  out(p + 'rmb.otherNames', f.otherNames === null || f.otherNames === undefined ? -1 : f.otherNames.length);
  if (f.otherNames) for (let i = 0; i < f.otherNames.length; i++)
    out(`${p}rmb.otherName.${pad(i, 2)}`, S(f.otherNames[i]));
  out(p + 'rmb.autoMap.sha', sha1(f.autoMapData));
  if (f.blockPositions) for (let i = 0; i < f.blockPositions.length; i++) {
    const q = `${p}rmb.pos.${pad(i, 2)}.`;
    out(q + 'x', f.blockPositions[i].xPos);
    out(q + 'z', f.blockPositions[i].zPos);
    out(q + 'yr', f.blockPositions[i].yRotation);
  }
  if (f.buildingDataList) for (let i = 0; i < f.buildingDataList.length; i++) {
    const bd = f.buildingDataList[i];
    const q = `${p}rmb.bld.${pad(i, 2)}.`;
    out(q + 'nameSeed', bd.nameSeed);
    out(q + 'factionId', bd.factionId);
    out(q + 'sector', bd.sector);
    out(q + 'locationId', bd.locationId);
    out(q + 'buildingType', bd.buildingType);
    out(q + 'quality', bd.quality);
  }
  if (f.blockDataSizes) for (let i = 0; i < f.blockDataSizes.length; i++)
    out(`${p}rmb.dataSize.${pad(i, 2)}`, f.blockDataSizes[i]);
  out(p + 'rmb.gnd.header.sha', sha1(f.groundData.header));
  if (f.groundData.groundTiles) {
    const bw = new BW();
    const d0 = f.groundData.groundTiles.length, d1 = f.groundData.groundTiles[0].length;
    out(p + 'rmb.gnd.tiles.dim', d0 + 'x' + d1);
    for (let y = 0; y < d1; y++) for (let x = 0; x < d0; x++) {
      const t = f.groundData.groundTiles[x][y];
      bw.u8(t.tileBitfield); bw.i32(t.textureRecord); bw.bool(t.isRotated); bw.bool(t.isFlipped);
    }
    out(p + 'rmb.gnd.tiles.sha', sha1(bw.bytes()));
  }
  if (f.groundData.groundScenery) {
    const bw = new BW();
    const d0 = f.groundData.groundScenery.length, d1 = f.groundData.groundScenery[0].length;
    out(p + 'rmb.gnd.scen.dim', d0 + 'x' + d1);
    for (let y = 0; y < d1; y++) for (let x = 0; x < d0; x++)
      bw.i32(f.groundData.groundScenery[x][y].textureRecord);
    out(p + 'rmb.gnd.scen.sha', sha1(bw.bytes()));
  }
  const subs = b.rmbBlock.subRecords;
  out(p + 'rmb.subRecords', subs === null || subs === undefined ? -1 : subs.length);
  if (subs) for (let i = 0; i < subs.length; i++) {
    const q = `${p}rmb.sub.${pad(i, 2)}.`;
    out(q + 'x', subs[i].xPos); out(q + 'z', subs[i].zPos); out(q + 'yr', subs[i].yRotation);
    dumpRmbBlockData(q + 'ext.', subs[i].exterior);
    dumpRmbBlockData(q + 'int.', subs[i].interior);
  }
  dumpMisc3d(p + 'rmb.misc3d.', b.rmbBlock.misc3dObjectRecords);
  dumpMiscFlat(p + 'rmb.miscFlat.', b.rmbBlock.miscFlatObjectRecords);
}
function dumpAction(q, a) {
  out(q + 'axis', a.axis);
  out(q + 'duration', a.duration);
  out(q + 'magnitude', a.magnitude);
  out(q + 'nextOffset', a.nextObjectOffset);
  out(q + 'prevOffset', a.previousObjectOffset);
  out(q + 'nextIndex', a.nextObjectIndex);
  out(q + 'flags', a.flags);
}
function dumpRdb(p, b) {
  const mrl = b.rdbBlock.modelReferenceList;
  out(p + 'rdb.models', mrl === null || mrl === undefined ? -1 : mrl.length);
  if (mrl) for (let i = 0; i < mrl.length; i++) {
    const q = `${p}rdb.mdl.${pad(i, 3)}.`;
    out(q + 'id', S(mrl[i].modelId));
    out(q + 'idNum', mrl[i].modelIdNum);
    out(q + 'desc', S(mrl[i].description));
  }
  const roots = b.rdbBlock.objectRootList;
  out(p + 'rdb.roots', roots === null || roots === undefined ? -1 : roots.length);
  if (roots) for (let r = 0; r < roots.length; r++) {
    const objs = roots[r].rdbObjects;
    out(`${p}rdb.root.${pad(r, 2)}.count`, objs === null || objs === undefined ? -1 : objs.length);
    if (!objs) continue;
    for (let i = 0; i < objs.length; i++) {
      const q = `${p}rdb.root.${pad(r, 2)}.${pad(i, 3)}.`;
      out(q + 'index', objs[i].index);
      out(q + 'x', objs[i].xPos); out(q + 'y', objs[i].yPos); out(q + 'z', objs[i].zPos);
      out(q + 'type', objs[i].type);
      if (objs[i].type === 1) {  // Model
        const m = objs[i].resources.modelResource;
        out(q + 'm.xr', m.xRotation); out(q + 'm.yr', m.yRotation); out(q + 'm.zr', m.zRotation);
        out(q + 'm.modelIndex', m.modelIndex);
        out(q + 'm.trigLock', m.triggerFlagStartingLock);
        out(q + 'm.sound', m.soundIndex);
        dumpAction(q + 'm.act.', m.actionResource);
      } else if (objs[i].type === 2) {  // Light
        const l = objs[i].resources.lightResource;
        out(q + 'l.u1', l.unknown1); out(q + 'l.u2', l.unknown2); out(q + 'l.radius', l.radius);
      } else if (objs[i].type === 3) {  // Flat
        const fl = objs[i].resources.flatResource;
        out(q + 'f.arch', fl.textureArchive); out(q + 'f.rec', fl.textureRecord);
        out(q + 'f.flags', fl.flags); out(q + 'f.magnitude', fl.magnitude);
        out(q + 'f.sound', fl.soundIndex); out(q + 'f.factionOrMobile', fl.factionOrMobileId);
        out(q + 'f.nextOffset', fl.nextObjectOffset); out(q + 'f.action', fl.action);
      }
    }
  }
}
await closeOut();
