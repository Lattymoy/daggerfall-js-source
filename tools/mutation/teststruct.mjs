// Static structure scan of test/*.test.js: per test() block, count assertion
// call sites and how many sit inside a conditional / loop (i.e. can be skipped).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TEST = path.join(ROOT, 'test');
const out = [];

for (const f of fs.readdirSync(TEST).filter(x => x.endsWith('.test.js')).sort()) {
  const text = fs.readFileSync(path.join(TEST, f), 'utf8');
  const lines = text.split('\n');
  // find top-level test( calls
  const re = /^(\s*)(?:await\s+)?test\(/gm;
  let m;
  const starts = [];
  while ((m = re.exec(text))) starts.push(m.index);
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const e = i + 1 < starts.length ? starts[i + 1] : text.length;
    const body = text.slice(s, e);
    const startLine = text.slice(0, s).split('\n').length;
    const nameM = body.match(/test\(\s*(['"`])((?:\\.|(?!\1).)*)\1/);
    const name = nameM ? nameM[2] : '?';
    // assertion sites
    const asserts = [...body.matchAll(/\bassert\s*[.(]/g)];
    // depth-aware: is each assert inside an if/for/while/&&-guard?
    let guarded = 0;
    for (const a of asserts) {
      const before = body.slice(0, a.index);
      // count unclosed if/for/while blocks: crude — look at the enclosing line prefix
      const lineStart = before.lastIndexOf('\n') + 1;
      const linePrefix = body.slice(lineStart, a.index);
      if (/^\s*(if|for|while)\s*\(.*\)\s*$/.test(linePrefix.trimEnd()) ||
          /\b(if|for|while)\s*\([^)]*\)\s*(\{\s*)?$/.test(linePrefix)) guarded++;
      else {
        // inside an open block opened by if/for/while whose brace is still unclosed
        let depth = 0; const stack = [];
        for (let k = before.length - 1, d = 0; k >= 0; k--) {
          const ch = before[k];
          if (ch === '}') d++;
          else if (ch === '{') { if (d === 0) { stack.push(k); break; } d--; }
        }
        if (stack.length) {
          const bi = stack[0];
          const ls = before.lastIndexOf('\n', bi) + 1;
          const head = before.slice(ls, bi);
          if (/\b(if|for|while)\s*\(/.test(head)) guarded++;
        }
        void depth;
      }
    }
    out.push({ file: f, line: startLine, name, asserts: asserts.length, guarded });
  }
  void lines;
}
out.sort((a, b) => a.asserts - b.asserts);
console.log('total test() blocks:', out.length);
console.log('--- tests with <=2 assertion sites ---');
for (const r of out.filter(r => r.asserts <= 2)) console.log(`${r.asserts}a/${r.guarded}g  ${r.file}:${r.line}  ${r.name.slice(0, 90)}`);
console.log('--- tests where EVERY assertion site is inside if/for/while ---');
for (const r of out.filter(r => r.asserts > 0 && r.guarded === r.asserts)) console.log(`${r.asserts}a  ${r.file}:${r.line}  ${r.name.slice(0, 90)}`);
fs.writeFileSync(path.join(ROOT, '.mutaudit', 'teststruct.json'), JSON.stringify(out, null, 1));
