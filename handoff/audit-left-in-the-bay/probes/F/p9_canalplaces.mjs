// NIBEN-SEA / RUMARE-WATER: does any place past the Bay stand on the water the PR made (the canal, the opened Niben course, the basin)?
import { setup, imp } from './setup.mjs';
await setup({ maps: false });
const { arenaPixels } = await imp('src/world/arenaPlaces.js');
const { canalAt, waterfrontCanal, provinceKeyAt } = await imp('src/world/tamriel/tamrielLand.js');
const { tamrielHeightByte } = await imp('src/world/tamriel/tamrielGround.js');
const { bayToPicture } = await imp('src/world/tamriel/tamrielFrame.js');
const { nibenCells } = await imp('src/ui/tamrielTrace.js');
const { capitalOnPixel } = await imp('src/world/tamrielCapitals.js');
console.log('canal', waterfrontCanal());
const px = arenaPixels();
const niben = new Set(nibenCells().map(([x, y]) => `${x},${y}`));
let n = 0, wet = 0;
for (const [key, p] of px.byPixel) {
  const [x, y] = key.split(',').map(Number); n++;
  const [qx, qy] = bayToPicture(x + 0.5, y + 0.5);
  const onCanal = canalAt(x, y), onNiben = niben.has(`${Math.floor(qx)},${Math.floor(qy)}`), byte = tamrielHeightByte(x, y), key2 = provinceKeyAt(qx, qy);
  if (onCanal || onNiben || byte === 0 || key2 == null) { wet++; if (wet <= 15) console.log('place on water?', key, p?.name ?? p?.place?.name ?? '', { onCanal, onNiben, byte, province: key2, capital: !!capitalOnPixel(x, y) }); }
}
console.log('places', n, 'on water', wet);
