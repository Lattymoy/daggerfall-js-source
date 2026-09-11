import { farFlatVisible } from '/home/user/daggerfall-js-source/src/world/flatDistance.js';
const N = 1000 * 60 * 10; // 10 seconds' worth of the finder's "thousand a frame" at 60Hz
global.gc?.();
const before = process.memoryUsage().heapUsed;
let t0 = process.hrtime.bigint();
let acc = 0;
for (let i = 0; i < N; i++) if (farFlatVisible({ ring: i & 3, height: (i % 7) * 0.5, animated: (i & 15) === 0 })) acc++;
let t1 = process.hrtime.bigint();
const after = process.memoryUsage().heapUsed;
console.log('object form: ', Number(t1 - t0) / 1e6, 'ms for', N, 'calls; heapDelta', ((after - before) / 1e6).toFixed(2), 'MB; acc', acc);
console.log('per-frame cost at 1000 calls/frame:', (Number(t1 - t0) / 1e6) / (N / 1000), 'ms');
