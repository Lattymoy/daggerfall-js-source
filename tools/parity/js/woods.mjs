import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../../../src/formats/woodsFile.js';
import { openOut, out, closeOut, read, pad, sha1 } from './common.mjs';

openOut(process.argv[2]);
const w = new WoodsFile();
const ok = w.load(read('WOODS.WLD'));
if (!ok) { out('woods.load', 'FAIL'); }
else {
  out('woods.mapWidth', MAP_WIDTH);
  out('woods.mapHeight', MAP_HEIGHT);
  // GetHeightMapDFBitmap
  out('woods.heightMap.w', MAP_WIDTH);
  out('woods.heightMap.h', MAP_HEIGHT);
  out('woods.heightMap.sha', sha1(w.heightMapBuffer));
  const all = new Uint8Array(1000 * 500);
  let k = 0;
  for (let y = 0; y < 500; y++) for (let x = 0; x < 1000; x++) all[k++] = w.getHeightMapValue(x, y);
  out('woods.getHeightMapValue.sha', sha1(all));
  for (let y = 0; y < 500; y += 37)
    for (let x = 0; x < 1000; x += 53)
      out(`woods.hv.${pad(x, 4)}.${pad(y, 4)}`, w.getHeightMapValue(x, y));
  // GetLargeHeightMapValuesRange - C# flattens [x,y] as x-major; mirror that.
  for (let y = 3; y < 500; y += 61) {
    for (let x = 7; x < 1000; x += 71) {
      const dim = 4, side = dim * 3;
      const rng = w.getLargeHeightMapValuesRange(x, y, dim);
      const flat = new Uint8Array(side * side);
      let j = 0;
      for (let a = 0; a < side; a++) for (let b = 0; b < side; b++) flat[j++] = rng[b * side + a];
      out(`woods.lhr.${pad(x, 4)}.${pad(y, 4)}.dim`, side + 'x' + side);
      out(`woods.lhr.${pad(x, 4)}.${pad(y, 4)}.sha`, sha1(flat));
    }
  }
  for (let y = 11; y < 500; y += 83)
    for (let x = 13; x < 1000; x += 97)
      out(`woods.hr.${pad(x, 4)}.${pad(y, 4)}.sha`, sha1(w.getHeightMapValuesRange1Dim(x, y, 5)));
  for (let y = 5; y < 500; y += 113) {
    for (let x = 9; x < 1000; x += 131) {
      const rng = w.getLargeMapData(x, y);
      const flat = new Uint8Array(25);
      let j = 0;
      for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) flat[j++] = rng[a][b];
      out(`woods.lmd.${pad(x, 4)}.${pad(y, 4)}.dim`, '5x5');
      out(`woods.lmd.${pad(x, 4)}.${pad(y, 4)}.sha`, sha1(flat));
    }
  }
}
await closeOut();
