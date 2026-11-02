// HOST-SPLIT 2 (2026-10-15, bible/01-Overview/Host-Split.md) - THE PINS READ THE HOST WHOLE.
// The suite reads the hosts as text: 1,444 test files read world.js, and a pin that quotes a line of bootWorld goes
// red the moment tools/hostMove.mjs moves that line into a module the host constructs, though the host does what it
// did. The pilot moved 22 such files by hand for 229 lines; buildPixelNow's 1,237 lines broke 130. So a pin that reads
// a host reads it WHOLE: the host's file, then every module moved out of it - found by the header the tool writes, so
// the next slice's module joins without anyone listing it. The seam (test/tooling/hostseam.test.js) proves the host
// constructs each one; this lets the pins that quote the code keep quoting it wherever it now lives.
// AUDIT HOST-SPLIT 2, the second read: and a NEGATIVE reads it so too - a pin that finds nothing in a host's file finds
// nothing when code leaves it, and never fails; read alone, the file is not the host.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HEADER = /^\/\/ HOST-SPLIT: moved verbatim out of (\S+)'s \w+ /;

/** Each folder's moved modules, read once: module -> the host it came out of (a sweep reads thousands of files). */
const folders = new Map();
function movedIn(dir) {
  if (!folders.has(dir)) {
    const out = new Map();
    for (const n of readdirSync(join(ROOT, dir)).filter((x) => x.endsWith('.js')).sort()) {
      const p = `${dir}/${n}`;
      const host = HEADER.exec(readFileSync(join(ROOT, p), 'utf8').slice(0, 200))?.[1];
      if (host) out.set(p, host);
    }
    folders.set(dir, out);
  }
  return folders.get(dir);
}

/** The modules tools/hostMove.mjs moved out of `rel` (repo-relative), in file-name order. */
export function movedOutOf(rel) {
  return [...movedIn(dirname(rel).replace(/\\/g, '/'))].filter(([, host]) => host === rel).map(([p]) => p);
}

/** The host a module was moved out of (repo-relative), or null for any file the tool did not write. */
export function hostOf(rel) {
  return movedIn(dirname(rel).replace(/\\/g, '/')).get(rel) ?? null;
}

/** A source file's text - a host's WHOLE: its own file, then each module moved out of it. Any other file as it is. */
export function hostText(rel) {
  const own = readFileSync(join(ROOT, rel), 'utf8');
  const moved = movedOutOf(rel);
  return moved.length ? [own, ...moved.map((p) => readFileSync(join(ROOT, p), 'utf8'))].join('\n') : own;
}
