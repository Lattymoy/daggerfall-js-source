import { REGION_NAMES, REGION_RACES, REGION_TEMPLES } from '../../../src/formats/mapsFile.js';
import { getNameBankOfRegion } from '../../../src/characters/nameHelper.js';
import { openOut, out, closeOut, pad, S } from './common.mjs';
openOut(process.argv[2]);
out('tbl.regionNames.count', REGION_NAMES.length);
REGION_NAMES.forEach((n, i) => out(`tbl.regionNames.${pad(i, 2)}`, S(n)));
out('tbl.regionRaces.count', REGION_RACES.length);
REGION_RACES.forEach((n, i) => out(`tbl.regionRaces.${pad(i, 2)}`, n));
out('tbl.regionTemples.count', REGION_TEMPLES.length);
REGION_TEMPLES.forEach((n, i) => out(`tbl.regionTemples.${pad(i, 2)}`, n));
if (typeof getNameBankOfRegion === 'function') {
  for (let i = 0; i < REGION_NAMES.length; i++) out(`tbl.nameBank.${pad(i, 2)}`, getNameBankOfRegion(i));
  out('tbl.nameBank.minus1', getNameBankOfRegion(-1));
}
await closeOut();
