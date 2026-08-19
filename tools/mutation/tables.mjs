// Which exported verbatim TABLES (frozen objects / array literals) are pinned
// whole by a deepEqual, which only by spot checks, which not at all?
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const srcFiles = [];
(function w(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) w(p); else if (e.name.endsWith('.js')) srcFiles.push(p);
  }
})(path.join(ROOT, 'src'));

const testText = fs.readdirSync(path.join(ROOT, 'test'))
  .filter(f => f.endsWith('.test.js'))
  .map(f => [f, fs.readFileSync(path.join(ROOT, 'test', f), 'utf8')]);

const rows = [];
for (const abs of srcFiles) {
  const rel = path.relative(ROOT, abs);
  const text = fs.readFileSync(abs, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^export const ([A-Z][A-Z0-9_]*)\s*=\s*(Object\.freeze\(|\[|new Set\(|\{)/);
    if (!m) continue;
    const name = m[1];
    // size: count numeric literals until the declaration closes (brace balance)
    let depth = 0, j = i, body = '';
    do { body += lines[j] + '\n'; for (const ch of lines[j]) { if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--; } j++; } while (depth > 0 && j < lines.length && j - i < 400);
    const nums = (body.match(/(?<![A-Za-z0-9_$.])\d+/g) || []).length;
    if (nums < 4) continue;                     // not a data table
    let deep = 0, spot = 0, mentioned = 0;
    for (const [, t] of testText) {
      if (!t.includes(name)) continue;
      mentioned++;
      // WHOLE-table pin only: the bare export (or a spread/Object.values/entries of
      // it) is one side of a deepEqual. `deepEqual(TABLE.C, {...})` is a spot check.
      const dre = new RegExp(
        `deep(?:Strict)?Equal\\(\\s*(?:\\[\\s*\\.\\.\\.\\s*)?(?:Object\\.(?:values|entries|keys)\\(\\s*)?${name}\\s*[,)\\]]`
        + `|deep(?:Strict)?Equal\\([\\s\\S]{0,200}?,\\s*(?:\\[\\s*\\.\\.\\.\\s*)?${name}\\s*[,)\\]]`, 'g');
      deep += (t.match(dre) || []).length;
      spot += (t.match(new RegExp(`${name}\\s*[[.]`, 'g')) || []).length;
    }
    rows.push({ rel, name, line: i + 1, nums, deep, spot, mentioned });
  }
}
rows.sort((a, b) => b.nums - a.nums);
const unpinned = rows.filter(r => r.deep === 0);
console.log(`data tables found: ${rows.length}   with a whole-table deepEqual pin: ${rows.filter(r => r.deep > 0).length}   without: ${unpinned.length}`);
console.log(`  of the unpinned, never mentioned in any test at all: ${unpinned.filter(r => r.mentioned === 0).length}`);
console.log('\n-- 40 largest tables with NO whole-table deepEqual --');
for (const r of unpinned.slice(0, 40)) {
  console.log(`${String(r.nums).padStart(5)} nums  ${r.mentioned ? (r.spot ? 'spot-checked ' : 'named only   ') : 'NEVER IN TEST'}  ${r.rel}:${r.line} ${r.name}`);
}
fs.writeFileSync(path.join(ROOT, '.mutaudit', 'tables.json'), JSON.stringify(rows, null, 1));
