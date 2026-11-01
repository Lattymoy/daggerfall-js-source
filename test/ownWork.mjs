// OWN-WORK1 (2026-10-31): the keys bible/01-Overview/Own-Work.md records as retired from vendor/ - the rows of its
// "Retired from vendor/" table. Shared by the registry gate and the provenance gate (credits.test.js).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OWN_WORK = 'bible/01-Overview/Own-Work.md';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The retired keys, read from the page's table (or from `page`, a test's own text). */
export function retiredKeys(page = readFileSync(join(ROOT, OWN_WORK), 'utf8')) {
  const at = page.indexOf('\n## Retired from vendor/');
  const end = page.indexOf('\n## ', at + 1);
  const body = at < 0 ? '' : page.slice(at, end < 0 ? undefined : end);
  return new Set([...body.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]));
}

