import { parseBiog } from '../../../src/formats/biogFile.js';
import { openOut, out, closeOut, read, files, pad, S } from './common.mjs';
openOut(process.argv[2]);
for (const name of files(/^BIOG.*\.TXT$/)) {
  const classIndex = Number.parseInt(name.slice(4, 6), 10);
  const text = new TextDecoder().decode(read(name));
  const p0 = `biog.${name}.`;
  let r;
  try { r = parseBiog(text, classIndex); } catch (e) { out(p0 + 'error', S(e.constructor.name)); continue; }
  out(p0 + 'backstoryId', r.backstoryId);
  for (let q = 0; q < 12; q++) {
    const p = `${p0}q${pad(q, 2)}.`;
    const qq = r.questions[q];
    if (!qq) { out(p + 'null', 1); continue; }
    out(p + 'text0', S(qq.text[0]));
    out(p + 'text1', S(qq.text[1]));
    out(p + 'answers', qq.answers.length);
    for (let a = 0; a < qq.answers.length; a++) {
      const pa = `${p}a${pad(a, 2)}.`;
      out(pa + 'text', S(qq.answers[a].text));
      out(pa + 'effects', qq.answers[a].effects.length);
      for (let e = 0; e < qq.answers[a].effects.length; e++)
        out(`${pa}e${pad(e, 2)}`, S(qq.answers[a].effects[e]));
    }
  }
}
await closeOut();
