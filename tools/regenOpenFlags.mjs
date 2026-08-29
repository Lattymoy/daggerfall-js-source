#!/usr/bin/env node
// Regenerate bible/Home.md's "Open flags" list from the FLAGGED/INTERIM sites
// in src/.
//
// AUDIT 21: Testing.md has claimed for three audits that this list is
// "regenerated mechanically", and NO SUCH TOOL EXISTED. That is why the list
// rots on every host edit - three separate audits have spent time hand-patching
// line numbers, and every one of those patches was a chance to point a citation
// at the wrong line. The claim is now true.
//
//   node tools/regenOpenFlags.mjs          # rewrite the list in place
//   node tools/regenOpenFlags.mjs --check  # exit 1 if it would change
//
// The list's contract, which test/audit18_bible_docs.test.js enforces:
//   - one entry per FLAGGED/INTERIM line under src/, both ways, exactly -
//     except a marker that is part of an identifier or sits inside a quoted
//     span, neither of which is a flag (IN1);
//   - each entry reads `- \`src/path:LINE\` - <the source line, trimmed,
//     with a leading "// " removed>`.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flagLines } from './flagSites.mjs';   // IN1: the one definition of an open-flag site

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOME = join(root, 'bible/Home.md');
const HEADING = '## Open flags';

function walk(dir, ext, out = []) {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, ext, out);
    else if (name.endsWith(ext)) out.push(rel);
  }
  return out;
}

/** The exact text an entry quotes for a source line. */
const quoteFor = (line) => line.trim().replace(/^\/\/\s*/, '');

const entries = [];
for (const f of walk('src', '.js').sort()) {
  const src = readFileSync(join(root, f), 'utf8');
  const lines = src.split('\n');
  // IN1: the rule lives in tools/flagSites.mjs, which the AUDIT 18
  // guard imports too - two copies of it is two rules the day one moves.
  for (const n of flagLines(src)) entries.push(`- \`${f}:${n}\` - ${quoteFor(lines[n - 1])}`);
}

const home = readFileSync(HOME, 'utf8');
const at = home.indexOf(HEADING);
if (at < 0) { console.error(`${HEADING} not found in bible/Home.md`); process.exit(2); }

// The list runs from the heading to the next heading of the same or higher
// level; prose between the heading and the first entry is preserved.
const after = home.slice(at + HEADING.length);
const endRel = after.search(/\n#{1,2} /);
const body = endRel < 0 ? after : after.slice(0, endRel);
const tail = endRel < 0 ? '' : after.slice(endRel);

const bodyLines = body.split('\n');
const firstEntry = bodyLines.findIndex((l) => /^- `src\//.test(l));
if (firstEntry < 0) { console.error('no open-flag entries found under the heading'); process.exit(2); }
const preamble = bodyLines.slice(0, firstEntry);
const trailing = bodyLines.slice(firstEntry).filter((l) => l.trim() && !/^- `src\//.test(l));

const rebuilt = home.slice(0, at) + HEADING
  + [...preamble, ...entries, '', ...trailing].join('\n').replace(/\n{3,}/g, '\n\n')
  + (tail || '\n');

if (process.argv.includes('--check')) {
  if (rebuilt !== home) {
    console.error('bible/Home.md open-flags list is STALE - run: node tools/regenOpenFlags.mjs');
    process.exit(1);
  }
  console.log(`open flags: ${entries.length} entries, up to date`);
  process.exit(0);
}

writeFileSync(HOME, rebuilt);
console.log(`open flags: rewrote ${entries.length} entries into bible/Home.md`);
