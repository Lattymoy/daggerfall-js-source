# AUDIT 65 fix-lane rules (every lane)

You are a FIX LANE in AUDIT 65 of /home/user/daggerfall-js-source (a 1:1 JS port of Daggerfall Unity; DFU reference at tools/parity/dfu/Assets/Scripts). Read bible/Home.md lines 1-130 first (cites are claims; RETIRING A FLAG DELETES THE SENTENCE; a pin must fail; test the shape the producer mints; ONE DFU MEMBER, ONE EXPORT; THE FOUR HOSTS RULE).

WORKTREE: `git worktree add <path> -b <branch> HEAD` with the path and branch named in your brief; do everything inside it; never touch the main checkout. Commit there when done (message in your brief; body names files; end with the two attribution lines below). Do not push.

THE BRIEF IS THE REFUTERS' CORRECTIONS: the finder's text is context; where a refuter corrected the fix, the correction is law. Read the verdict files named in your brief before editing.

RULES:
- Re-verify every line number at HEAD before editing (files moved since the finders read them).
- Minimal diffs; cite the C# line on the changed line as the tree does.
- Pins: mutation-check every new/changed pin (apply the named mutant, see red, restore, see green) and report each result.
- Existing pins that encode the old shape must be REWRITTEN to the new law, never deleted or skipped.
- bible/03-Testing/Testing.md: per-file rows must equal `^test(` counts for files you touched (run `node --test test/manifest.test.js`); do NOT edit the `Suite:` line - report the test delta you introduced.
- Run: `npm run lint`, the touched test files, `node --test test/citedrift.test.js test/manifest.test.js test/audit18_bible_docs.test.js`, then the full `npm test` once. Report totals.
- Do NOT edit Port-Ledger/Port-Status/Home/Audit-65.md - report what the record should say (3-6 lines per finding, including any Ledger A row or struck sentence).
- Never spell a model name in the commit.

Commit footer:
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C7SvRjrnsDoSwxQSGzfpoR

RETURN: commit hash, diff stat, per-pin mutation results, test delta (files + counts), lint/full-suite result, and the record text per finding. Leave the worktree in place.

WORKTREE ENVIRONMENT: a fresh worktree has no node_modules and no DFU clone. Before running anything: `ln -s /home/user/daggerfall-js-source/node_modules node_modules` and run tests with `DFU_PATH=/home/user/daggerfall-js-source/tools/parity/dfu` in the environment so citedrift's DFU-backed pins run. test/tdz.test.js and test/verifydeploy.test.js fail in a worktree without the symlink - that is the environment, not your change.

## Merging main under an open audit (added at the round-one integration)
- Do NOT normalise-then-map with citeShift: two mapped sides are two bases in one tree.
- Merge with --no-commit, resolve conflicts, then ONCE: `node tools/citeMerge.mjs origin/main <our-head> --apply` (report first without --apply). Read the held list by content.
- Then: hand cites the mappers cannot see, regenOpenFlags, Suite restamp, lint, doc gates, full suite, commit.
