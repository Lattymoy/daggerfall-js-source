# AUDIT 26 fix-wave brief (binding)

You are fixing confirmed audit findings in **project-dagger** (`/home/user/project-dagger`),
a 1:1 JS port of Daggerfall. Source of truth: `/home/user/interkarma/daggerfall-unity`
(Assets/Scripts, commit 81e89e9). Each finding you receive was confirmed by adversarial
verification and carries both-sides evidence. ARENA2 data is NOT available (corpus-gated
tests skip; that is normal).

## Per finding, in order

1. **Re-read both sides yourself** (the finding's cited C# and JS). You are the last
   guard: if your own reading says the finding is wrong or already fixed, SKIP it and
   say exactly why - do not "fix" a non-bug. If the true fix differs from the finding's
   framing, fix what the C# actually does.
2. **Implement the minimal faithful fix.** Translate the DFU law verbatim; keep original
   constants byte-exact; do not restructure surrounding code; do not widen scope. Match
   the file's existing comment idiom - comments cite the DFU source (file:line + what the
   law is), never the audit or the fix history.
3. **House rules that bind every edit:**
   - ONE DFU MEMBER, ONE EXPORT: before adding a law, grep src/ for its name AND its
     constants; if it exists elsewhere, import it - never a second literal.
   - THE FOUR HOSTS: a seam wired into one host (scenes/exterior.js, world.js,
     worldModes.js, dungeonContext.js - plus interior.js / dungeon.js where relevant)
     must be wired or explicitly N/A in ALL of them; say which in your report.
   - ASYNC NEVER DROPS; every allocation has an owner; a frame-gating function returns
     the same type from every exit.
4. **Pin it.** Every fix gets a test (extend the existing test file for that area, or a
   new `test/audit26_<wave>.test.js`). A PIN MUST FAIL: pin the DFU law (prefer deepEqual
   against DFU literals over inequalities), and MUTATION-CHECK it - temporarily reintroduce
   the bug, run the test, watch it fail, restore the fix, watch it pass. Report the pin
   name and that the mutation check was done. If an EXISTING pin asserted the buggy
   behavior (several findings name one), CORRECT it - a pin that restates the port
   instead of the source is not a pin.
5. **Validate:** run the test files you touched plus the area's existing tests
   (`node --test test/<files>`), and `npx eslint` on every file you changed. Everything
   green before you finish.

## Constraints

- Do NOT run the full suite (the orchestrator does that between waves).
- Do NOT commit, push, or touch git.
- Do NOT edit bible/ or .audit26/.
- If two findings in your wave collide on the same lines, fix them together coherently.

## Report (your final message)

One line per finding: `<id> | FIXED (files, pin, mutation-checked) or SKIPPED (reason)`.
Then any cross-wave hazards you noticed (a seam another wave will touch).
