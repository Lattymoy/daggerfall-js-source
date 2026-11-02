// The one "am I the program?" test for every tool and bake script
// (AUDIT 68). A module a test imports for one function must not run its
// CLI body on import - BLOOD1b's lesson: a bake that rewrote src/ while
// parallel test workers imported it. Compared as REAL paths, because
// import.meta.url is percent-encoded and symlink-resolved and
// process.argv[1] is neither: the string comparisons this replaces were
// false under a path with a space, through a symlinked checkout and on
// Windows, and the tool exited 0 having done nothing.
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** True when the module at `url` (pass `import.meta.url`) is the script
 *  node was asked to run; false under an import, `-e` or the REPL. */
export function isMain(url) {
  const argv1 = process.argv[1];
  if (!argv1 || !existsSync(argv1)) return false;
  return realpathSync(argv1) === realpathSync(fileURLToPath(url));
}
