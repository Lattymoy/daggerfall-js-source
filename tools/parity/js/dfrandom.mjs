import { srand, rand, randomRange, randomRangeInclusive } from '../../../src/formats/dfRandom.js';
import { openOut, out, closeOut, pad } from './common.mjs';

openOut(process.argv[2]);
const seeds = [0, 1, 12345, 0xdeadbeef, 987654321];
for (const s of seeds) {
  srand(s);
  for (let i = 0; i < 10000; i++) out(`dfrandom.rand.${s >>> 0}.${pad(i, 5)}`, rand());
}
srand(42);
for (let i = 0; i < 5000; i++) out(`dfrandom.rr.${pad(i, 5)}`, randomRange(0, 100));
srand(42);
for (let i = 0; i < 5000; i++) out(`dfrandom.rri.${pad(i, 5)}`, randomRangeInclusive(-50, 50));
srand(7);
// DFU has a single-arg random_range(max) == rand() % max; the port exposes only
// the two-arg form, which is arithmetically identical for min = 0.
for (let i = 0; i < 5000; i++) out(`dfrandom.rr1.${pad(i, 5)}`, randomRange(0, 1000));
await closeOut();
