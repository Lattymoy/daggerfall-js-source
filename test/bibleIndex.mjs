// THE BIBLE'S INDEX, DERIVED - the shared home behind every gate that
// asks "does the index say X".
//
// HARD5 (2026-09-15). `bible/Home.md` was 291 KB: the architecture, the
// postmortems, the policy, the changelog and the project index in one
// file. Two sections were 254 KB of that - `## Active arcs` (172 KB in
// 89 lines, an index whose entries had grown into essays) and
// `## Audits` (82 KB) - and they now live on their own pages.
//
// THE HAZARD A SPLIT CREATES, and why this module exists. Gates that
// asked "does Home.md name X" were really asking "does THE INDEX name
// X", and the split broke four of them while the index stayed complete.
// Worse is the other direction: a `doesNotMatch(home, ...)` pin - the
// shape several of these use to say "this stale claim is gone" - goes
// VACUOUSLY TRUE the moment its subject moves to another page, and
// passes for the wrong reason for ever after. Nothing goes red. Nobody
// finds out.
//
// So the index is DERIVED, not enumerated: Home.md, plus every page
// Home.md's own section stubs hand off to. A delegate cannot join in
// silence - it has to be written into Home.md to count - and a stub
// naming a page that does not exist throws here rather than quietly
// shrinking what the gates read.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** The stub Home.md writes where a section used to be. */
export const DELEGATE = /^Moved to `([^`]+\.md)`/gm;

/** Home.md and every page it hands a section off to. */
export function indexPages() {
  const out = ['bible/Home.md'];
  for (const m of read('bible/Home.md').matchAll(DELEGATE)) {
    const p = `bible/${m[1]}`;
    if (!existsSync(join(root, p))) throw new Error(`Home.md hands a section to ${p}, which does not exist`);
    out.push(p);
  }
  return out;
}

/** Those pages as ONE text - what "the index says" means. */
export const indexText = () => indexPages().map(read).join('\n');
