import fs from 'node:fs';
const f = process.argv[2];
const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
let last = null;
for (const l of lines) {
  let j; try { j = JSON.parse(l); } catch { continue; }
  const m = j.message ?? j;
  if ((j.type === 'assistant' || m.role === 'assistant') && Array.isArray(m.content)) {
    const txt = m.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    if (txt.trim()) last = txt;
  }
}
process.stdout.write(last ?? '(no assistant text found)');
