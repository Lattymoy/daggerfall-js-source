import { TextRsc } from '../../../src/formats/textRsc.js';
import { openOut, out, closeOut, read, pad, S } from './common.mjs';
openOut(process.argv[2]);
const t = new TextRsc();
t.load(read('TEXT.RSC'));
const ids = [...t._byId.keys()];
for (let i = 0; i < ids.length; i++) {
  const txt = t.plainText(ids[i]).join('').replace(/\n/g, '');
  out(`textrsc.${pad(i, 4)}.textcat`, S(txt));
}
await closeOut();
