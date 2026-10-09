// REL8 (2026-10-09, Mac: "Let's officially start numbering updates beginning with 0.0.1") - THE UPDATE NUMBER.
//
// Every merge to main cuts a release (REL3) and deploys the site; each is a player's UPDATE, numbered
// MAJOR.MINOR.PATCH. MAJOR.MINOR is the line (scripts/updateLine.mjs, by hand). PATCH is DERIVED, never bumped: the
// first-parent commit on main whose diff last changed the line is the line's update 1, and each first-parent commit
// after it the next - so it needs no file touched per merge (no two branches conflict on it), it is the same number
// on every machine that has the history, and it reads 1 for the merge that brought the line, whatever merged first.
//
// It is NOT the installer's version. The desktop updater compares installer versions (REL3's app-v0.1.<count>) and
// never takes a lower one, so the installers keep theirs and the update number rides beside it: stamped into the
// build (scripts/buildTag.mjs -> src/buildTag.js UPDATE), named on the release, shown in the game and the launcher.
//
// A clone with no history (CI's depth-1 checkout) cannot derive it and says so (null) rather than counting from
// where its history was cut; the release's legs are TOLD it (DFO_UPDATE) by the job that derived it.
//
//   node scripts/updateNumber.mjs [<commit>]   prints the number at <commit> (HEAD), or nothing
import { execFileSync } from 'node:child_process';
import { isMain } from '../tools/lib/isMain.mjs';

/** The line's file, as committed. */
export const UPDATE_LINE_FILE = 'scripts/updateLine.mjs';
/** The line's declaration, as its diff is searched for (git log -G: a regex over a commit's changed lines). */
export const UPDATE_LINE_DIFF_RE = '^export const UPDATE_LINE = ';
/** The line's value, read off the committed file. */
export const UPDATE_LINE_RE = /^export const UPDATE_LINE = '(\d+\.\d+)';$/m;
/** An update number: three whole numbers, nothing else (it is written into a release's name and a module). */
export const UPDATE_RE = /^\d+\.\d+\.\d+$/;
/** The environment's word for the number, for a build whose clone has no history to derive it from. */
export const UPDATE_ENV = 'DFO_UPDATE';

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/**
 * The update number at `at`, or null where it cannot be known (a shallow clone, no line, no git). The environment's
 * DFO_UPDATE, when set, is the answer - a number, or null for anything that is not one.
 * @param {{ at?: string, env?: Record<string, string|undefined>, cwd?: string, run?: (args: string[]) => string }} [opts]
 * @returns {string|null}
 */
export function updateNumber({ at = 'HEAD', env = process.env, cwd = process.cwd(), run = (args) => git(args, cwd) } = {}) {
  const told = String(env?.[UPDATE_ENV] ?? '').trim();
  if (told) return UPDATE_RE.test(told) ? told : null;
  try {
    if (run(['rev-parse', '--is-shallow-repository']) === 'true') return null;   // its count would start where the clone was cut
    const line = UPDATE_LINE_RE.exec(run(['show', `${at}:${UPDATE_LINE_FILE}`]))?.[1];
    if (!line) return null;
    // a merge's diff is its first parent's - the merge that brought the line is the commit on main that changed it
    const since = run(['log', '--first-parent', '--diff-merges=first-parent', '--no-patch', '-1', '--format=%H', `-G${UPDATE_LINE_DIFF_RE}`, at, '--', UPDATE_LINE_FILE]);
    if (!/^[0-9a-f]{40,64}$/.test(since)) return null;   // a commit's name, or nothing - never a line of some other output
    const count = (rev) => Number(run(['rev-list', '--count', '--first-parent', rev]));
    const patch = count(at) - count(since) + 1;
    return Number.isSafeInteger(patch) && patch >= 1 ? `${line}.${patch}` : null;
  } catch {
    return null;
  }
}

if (isMain(import.meta.url)) {
  const n = updateNumber({ at: process.argv[2] || 'HEAD' });
  if (n) process.stdout.write(`${n}\n`);
}
