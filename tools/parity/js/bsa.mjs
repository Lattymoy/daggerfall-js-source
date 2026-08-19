import { BsaFile } from '../../../src/formats/bsaFile.js';
import { openOut, out, closeOut, read, files, S, pad } from './common.mjs';

openOut(process.argv[2]);
const names = [...files(/\.BSA$/), ...files(/\.SND$/)].sort();
for (const name of names) {
  const bsa = new BsaFile(read(name));
  out(`bsa.${name}.count`, bsa.count);
  out(`bsa.${name}.dirType`, bsa.directoryType);
  for (let i = 0; i < bsa.count; i++) {
    const p = `bsa.${name}.${pad(i, 5)}.`;
    out(p + 'name', S(bsa.getRecordName(i)));
    out(p + 'id', bsa.getRecordId(i));
    out(p + 'size', bsa.getRecordLength(i));
    out(p + 'pos', bsa.getRecordPosition(i));
  }
}
await closeOut();
