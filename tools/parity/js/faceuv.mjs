import fs from 'node:fs';
import { computeFaceUVCoordinates } from '../../../src/formats/faceUVTool.js';
import { openOut, out, closeOut, pad } from './common.mjs';

openOut(process.argv[2]);
const corpus = fs.readFileSync(process.env.FACEUV_CORPUS, 'utf8').split('\n');
let caseIndex = 0;
for (const line of corpus) {
  if (!line.length) continue;
  const parts = line.split(' ');
  const n = +parts[0];
  const pin = [];
  let idx = 1;
  for (let i = 0; i < n; i++) {
    pin.push({
      x: +parts[idx++], y: +parts[idx++], z: +parts[idx++],
      nx: +parts[idx++], ny: +parts[idx++], nz: +parts[idx++],
      u: +parts[idx++], v: +parts[idx++],
    });
  }
  const pout = new Array(24);
  let ok = false;
  try { ok = computeFaceUVCoordinates(pin, pout); } catch (e) { ok = false; }
  const p = `faceuv.${pad(caseIndex, 5)}.`;
  out(p + 'ok', ok);
  if (ok) {
    for (let i = 0; i < n; i++) {
      out(`${p}${pad(i, 2)}.u`, pout[i].u);
      out(`${p}${pad(i, 2)}.v`, pout[i].v);
    }
  }
  caseIndex++;
}
out('faceuv.cases', caseIndex);
await closeOut();
