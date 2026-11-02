import { TextRsc } from '../../../src/formats/textRsc.js';
import { openOut, out, closeOut, read, pad, sha1 } from './common.mjs';
openOut(process.argv[2]);
const t = new TextRsc();
t.load(read('TEXT.RSC'));
const ids = [...t._byId.keys()];
out('textrsc.recordCount', t.recordCount);
for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  const p = `textrsc.${pad(i, 4)}.`;
  out(p + 'id', id);
  const b = t.bytesById(id);
  out(p + 'byIdLen', b === null ? -1 : b.length);
  out(p + 'byIdSha', b === null ? 'null' : sha1(b));
}
await closeOut();
