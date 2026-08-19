# The mutation / pin-vacuity audit (AUDIT 18)

Mutates ported logic one character at a time and checks whether the suite
notices. It answers the only question that matters about a pin: **does it fail
when the code is wrong?**

At AUDIT 18, against the then-688-test suite: **631 mutations run, 281
survived — a mutation score of 55.3%.** 29.9% of `src/` lines were executed by
no test at all, only 24 of 179 parity-surface tables were pinned whole, and the
four scene hosts (3,906 lines of DFU-cited behaviour) had **zero** execution
coverage. That measurement is what directed the rest of the audit.

**The 55.3% figure predates the audit's 221 new pins and is now stale. Re-run
it before trusting any number in this file.**

## Run it

```sh
# from a scratch git worktree, never the main checkout - this MUTATES src/
ARENA2_PATH=/path/to/arena2 node cover.mjs      # per-test line coverage first
ARENA2_PATH=/path/to/arena2 bash run_rounds.sh  # the campaign
node report.mjs                                 # summarise the .jsonl logs
```

Work in a disposable worktree. The driver reverts each mutation before the
next, but a crash mid-round leaves `src/` dirty.

| File | What |
|---|---|
| `cover.mjs` | exact per-test line coverage via `NODE_V8_COVERAGE`, innermost-range-wins |
| `mutate.mjs` | the engine: masks strings/comments/regex, generates NUM / REL / LOGIC / BOOL / NOT / MATH / CLAMP / SHIFT mutants, `node --check`s each, runs **only the tests whose coverage includes that line**, reverts, logs JSONL |
| `confirm.mjs` | re-applies a named mutant against the **whole** suite — use it before believing any survivor |
| `report.mjs` | the tallies, by operator and by directory |
| `deadassert.mjs` | assertions that never execute |
| `assertcount.mjs`, `graph.mjs`, `buildsample.mjs` | supporting counts |

The coverage subset is sound: a test that never executes line L cannot be
affected by mutating L. Module-level lines execute at import, so they are in
the subset. It was validated at AUDIT 18 by re-running a random sample of 12
automated survivors against the full suite — 12/12 still survived.

## Equivalent mutants

Some survivors are unfalsifiable by construction, not test holes: a `SAVE_VERSION`
bump that writer and reader both consume; a `Math.trunc` whose input is always
integral on shipping data; an initialiser overwritten before use. Hand-check
before reporting. At AUDIT 18 that removed ~10% of candidates.

## The operators that matter most here

`MATH` (`trunc`/`floor`/`round`/`ceil`) and `SHIFT` (`>>`/`>>>`) scored **44%**
and **20%** — the worst two, and precisely the semantics this port exists to
reproduce, since they stand in for C# `(int)` casts and 32-bit integer maths.
A survivor there is worth more attention than a survivor anywhere else.
