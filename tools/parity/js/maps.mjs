import { MapsFile, getWorldClimateSettings, mapPixelToLongitudeLatitude,
  longitudeLatitudeToMapPixel, mapPixelToWorldCoord, worldCoordToMapPixel,
  getMapPixelID } from '../../../src/formats/mapsFile.js';
import { openOut, out, closeOut, read, pad, S, sha1 } from './common.mjs';

openOut(process.argv[2]);
const mf = new MapsFile();
if (!mf.load(read('MAPS.BSA'), read('CLIMATE.PAK'), read('POLITIC.PAK'))) { out('maps.load', 'FAIL'); }
else {
  mf.autoDiscard = true;
  out('maps.regionCount', mf.regionCount);
  for (let r = 0; r < mf.regionCount; r++) {
    const pr = `maps.r${pad(r, 2)}.`;
    out(pr + 'name', S(mf.getRegionName(r)));
    const region = mf.getRegion(r);
    if (region === null) { out(pr + 'locationCount', -999); continue; }
    out(pr + 'locationCount', region.locationCount);
    out(pr + 'regionName', S(region.name));
    out(pr + 'mapNames', region.mapNames === null ? -1 : region.mapNames.length);
    out(pr + 'mapTable', region.mapTable === null ? -1 : region.mapTable.length);
    if (region.mapNames) for (let i = 0; i < region.mapNames.length; i++)
      out(`${pr}mn.${pad(i, 4)}`, S(region.mapNames[i]));
    if (region.mapTable) for (let i = 0; i < region.mapTable.length; i++) {
      const t = region.mapTable[i];
      const q = `${pr}mt.${pad(i, 4)}.`;
      out(q + 'mapId', t.mapId);
      out(q + 'lat', t.latitude);
      out(q + 'lon', t.longitude);
      out(q + 'locType', t.locationType);
      out(q + 'dunType', t.dungeonType);
      out(q + 'discovered', t.discovered);
      out(q + 'key', t.key);
    }
    for (let i = 0; i < region.locationCount; i++) {
      const loc = mf.getLocation(r, i);
      const q = `${pr}loc.${pad(i, 4)}.`;
      out(q + 'loaded', loc ? loc.loaded : false);
      if (!loc || !loc.loaded) continue;
      out(q + 'name', S(loc.name));
      out(q + 'regionName', S(loc.regionName));
      out(q + 'hasDungeon', loc.hasDungeon);
      out(q + 'politic', loc.politic);
      out(q + 'regionIndex', loc.regionIndex);
      out(q + 'locationIndex', loc.locationIndex);
      out(q + 'climate.worldClimate', loc.climate.worldClimate);
      out(q + 'climate.type', loc.climate.climateType);
      out(q + 'climate.natureSet', loc.climate.natureSet);
      out(q + 'climate.groundArchive', loc.climate.groundArchive);
      out(q + 'climate.natureArchive', loc.climate.natureArchive);
      out(q + 'climate.skyBase', loc.climate.skyBase);
      out(q + 'climate.people', loc.climate.people);
      out(q + 'climate.names', loc.climate.names);
      out(q + 'mt.mapId', loc.mapTableData.mapId);
      out(q + 'mt.lat', loc.mapTableData.latitude);
      out(q + 'mt.lon', loc.mapTableData.longitude);
      out(q + 'mt.locType', loc.mapTableData.locationType);
      out(q + 'mt.dunType', loc.mapTableData.dungeonType);
      out(q + 'mt.key', loc.mapTableData.key);
      const eh = loc.exterior.recordElement.header;
      out(q + 'ext.x', eh.x); out(q + 'ext.y', eh.y);
      out(q + 'ext.isExterior', eh.isExterior);
      out(q + 'ext.locationId', eh.locationId);
      out(q + 'ext.isInterior', eh.isInterior);
      out(q + 'ext.exteriorLocationId', eh.exteriorLocationId);
      out(q + 'ext.locationName', S(eh.locationName));
      out(q + 'ext.buildingCount', loc.exterior.buildingCount);
      if (loc.exterior.buildings) for (let b = 0; b < loc.exterior.buildings.length; b++) {
        const bd = loc.exterior.buildings[b];
        const qb = `${q}ext.bld.${pad(b, 3)}.`;
        out(qb + 'nameSeed', bd.nameSeed);
        out(qb + 'factionId', bd.factionId);
        out(qb + 'sector', bd.sector);
        out(qb + 'locationId', bd.locationId);
        out(qb + 'buildingType', bd.buildingType);
        out(qb + 'quality', bd.quality);
      }
      const ed = loc.exterior.exteriorData;
      out(q + 'ed.anotherName', S(ed.anotherName));
      out(q + 'ed.mapId', ed.mapId);
      out(q + 'ed.locationId', ed.locationId);
      out(q + 'ed.width', ed.width);
      out(q + 'ed.height', ed.height);
      out(q + 'ed.portTown', ed.portTownAndUnknown);
      out(q + 'ed.blockNames', ed.blockNames === null || ed.blockNames === undefined ? -1 : ed.blockNames.length);
      if (ed.blockNames) for (let b = 0; b < ed.blockNames.length; b++)
        out(`${q}ed.bn.${pad(b, 3)}`, S(ed.blockNames[b]));
      for (let yy = 0; yy < ed.height; yy++)
        for (let xx = 0; xx < ed.width; xx++)
          out(`${q}rmbName.${pad(xx, 2)}.${pad(yy, 2)}`, S(mf.getRmbBlockName(loc, xx, yy)));
      if (loc.hasDungeon) {
        const dh = loc.dungeon.recordElement.header;
        out(q + 'dun.x', dh.x); out(q + 'dun.y', dh.y);
        out(q + 'dun.locationId', dh.locationId);
        out(q + 'dun.exteriorLocationId', dh.exteriorLocationId);
        out(q + 'dun.locationName', S(dh.locationName));
        out(q + 'dun.blockCount', loc.dungeon.header.blockCount);
        if (loc.dungeon.blocks) for (let b = 0; b < loc.dungeon.blocks.length; b++) {
          const db = loc.dungeon.blocks[b];
          const qd = `${q}dun.blk.${pad(b, 3)}.`;
          out(qd + 'x', db.x); out(qd + 'z', db.z);
          out(qd + 'start', db.isStartingBlock);
          out(qd + 'name', S(db.blockName));
          out(qd + 'water', db.waterLevel);
          out(qd + 'castle', db.castleBlock);
        }
      }
    }
    mf.discardRegion(r);
  }
  const climate = new Uint8Array(1000 * 500);
  const politic = new Uint8Array(1000 * 500);
  let k = 0;
  for (let y = 0; y < 500; y++) for (let x = 0; x < 1000; x++) {
    climate[k] = mf.getClimateIndex(x, y) & 0xff;
    politic[k] = mf.getPoliticIndex(x, y) & 0xff;
    k++;
  }
  out('maps.climateIndex.sha', sha1(climate));
  out('maps.politicIndex.sha', sha1(politic));
  for (let wc = 0; wc <= 512; wc++) {
    const cs = getWorldClimateSettings(wc);
    const q = `maps.wcs.${pad(wc, 3)}.`;
    out(q + 'worldClimate', cs.worldClimate);
    out(q + 'type', cs.climateType);
    out(q + 'natureSet', cs.natureSet);
    out(q + 'groundArchive', cs.groundArchive);
    out(q + 'natureArchive', cs.natureArchive);
    out(q + 'skyBase', cs.skyBase);
    out(q + 'people', cs.people);
    out(q + 'names', cs.names);
  }
  for (let y = 0; y < 500; y += 17) for (let x = 0; x < 1000; x += 19) {
    const ll = mapPixelToLongitudeLatitude(x, y);
    const back = longitudeLatitudeToMapPixel(ll.x, ll.y);
    const wc = mapPixelToWorldCoord(x, y);
    const mp = worldCoordToMapPixel(wc.x, wc.y);
    const q = `maps.conv.${pad(x, 4)}.${pad(y, 4)}.`;
    out(q + 'lon', ll.x); out(q + 'lat', ll.y);
    out(q + 'backX', back.x); out(q + 'backY', back.y);
    out(q + 'wx', wc.x); out(q + 'wz', wc.y);
    out(q + 'mx', mp.x); out(q + 'my', mp.y);
    out(q + 'pixelId', getMapPixelID(x, y));
  }
}
await closeOut();
