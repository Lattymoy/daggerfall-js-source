# AUDIT 39 - the comprehensive parity/bug audit, 2026-09-01

The largest audit this repo has run, and the first one orchestrated as
agent fleets end to end. Three fleets: a 32-lane finder sweep over every
subsystem (528 agents counting its verifiers), a 21-group fix wave in
isolated worktrees, and an 8-lane adversarial review of the fixes
themselves. Every lane's model was the big one, every finding was
adversarially verified before a fix was written, and no code moved while
a verifier was reading - the 17l law, held this time.

## The method

**Find.** 32 lanes, each owning a slice of `src/` and the matching
reference surface (`/home/user/openmw/dfu` for Daggerfall Unity C#,
the OpenMW clone for the mw* modules): 3 formats lanes, 2 world, 4
scene-host, 2 render, player, combat, 2 characters, 9 systems, 5 UI,
and the three cross-cutting sweeps this repo has learned to trust -
dangling-seam shapes (the Ledger's six-times bug class), async/lifecycle
/leaks, and tests/pins/docs coherence. Each lane returned at most 8
staked findings (the tail recorded in an overflow note, never dropped
silently) plus a ported/partial/missing status for its slice.

**Verify.** Every finding got 2-3 refuters with distinct lenses - code
truth, reference truth (read the C# the finder cited), reachability and
intent (is it deliberate, gated, FLAGGED, or already adjudicated?).
Survival needed two CONFIRMED votes.

**The count.** 183 findings judged, 172 confirmed, 11 killed. The
killed list is the audit's precision working: refuters killed findings
whose premise misread JS truthiness, whose "missing guard" was an
explicit FLAGGED record, and whose "dead seam" was recorded staging.
After folding six cross-lane duplicates: **166 canonical findings -
2 critical, 52 high (net of dupes), 69 medium, 49 low; 80 parity,
74 bug, 13 docs, 4 perf, 1 regression.**

## What was broken (the shape of it)

The port-status synthesis (Port-Status-2026-09.md) says it best: the
LAW is at or near 1:1 - two dozen large reference tables diff
byte-exact, several lanes found the port reproducing DFU's own bugs -
and essentially every defect was **a correct, complete law whose caller
does not deliver it**. The headline confirmed findings:

- **Money leaked both ways** (the two criticals): the trade window
  staged a SELECTION, not a move, so one item could be staged and paid
  for N times; and every mint outside the shop shelf omitted
  `value = basePrice`, so looted gear sold for 0 gold and was consumed.
- **A bow was cosmetic above ground**: both `arrowFlight` impact arms
  gated on `m.enemy`, and no non-dungeon host resolved a player arrow.
- **Levitate killed you**: no `CancelMovement` on the levitate/swim
  mode edges, so the fall it broke was billed on touchdown.
- **Region identity froze at boot**: arrest, court, fines and legal rep
  filed against the starting region on the one host that fast-travels.
- **Death above ground died after one dungeon**: the dungeon context
  took three process-global seams and returned one on destroy.
- **The Thieves Guild and Dark Brotherhood could never be joined**: the
  quest-end membership grant was unported.
- **The default (enhanced) skin was not the ported surface**: two of
  its window doors threw on almost any keypress, five classic HUD
  components sat below its early return (killing CameraRecoiler
  everywhere), two chargen stages had no view, and an unscoped
  stylesheet leaked onto the classic skin.
- **Saves lost live state and duplicated the world**: `snapshotPlayer`
  dropped three shipped features whose restore arms then CLEARED them,
  `transportMode` was unpersisted, faction ally/enemy/ruler columns
  were discarded, and no `CleanupUntrackedObjects` counterpart meant a
  quickload stacked the save's foes on top of the live fight.
- **Every male PC was addressed "Ma'am"**: the one production macro
  context omitted five reads its own handlers make.

## The fix wave

21 groups, one isolated git worktree each, file-disjoint by
construction, each landing one commit with tests and deliberately-moved
pins. **166/166 fixed, zero recorded-open.** Integration squash-merged
the 21 commits; five conflicts crossed in the big hosts and every
resolution is a semantic union (recorded in the integration commit).
Four pins moved at integration, each with its reason in the test.
The suite grew ~230 tests over the two rounds: 5335 tests across 545 files.

## The review of the fixes

The wave itself was then audited: 8 adversarial lanes over the
integrated 202-file diff, each armed with the original manifests and
the groups' own reports, hunting four things - law fidelity vs the C#,
regressions in adjacent unchanged code, pins that pass with the fix
reverted, and the house seam class in the NEW seams the wave added.
43 findings, 39 confirmed by refuters, 4 killed. The headline catches,
every one a defect IN the fixes:

- **A merge collision cemented by its own pin**: #21's region getter
  and #99's severePunishment write landed in separate worktrees; the
  write kept indexing `regionConditions` with the raw parameter - a
  function in the streaming host, so the banishment/execution bits
  silently no-oped - and the wave's own pin asserted the broken
  spelling. Three lanes found it independently.
- **The third host**: the paralysis gate was wired to world.js and
  exterior.js and not to worldModes' interior arm - in the same file
  whose foe pool the wave had just taught to cast Spider Touch. The
  seam class, one round deep.
- **`clearLive` was not `CleanupUntrackedObjects`**: an in-flight
  async spawn survived the teleport sweep and landed in the new world.
  Four lanes converged on the same missing generation token.
- **A sign error vs the reference**: the ported auto-emissive arm
  ADDED emission on top of full lighting where DFU's shaders subtract
  the albedo under the mask - a lit flat at ~2.3x brightness.
- **A confirm that confirmed too much**: the new enhanced spellbook
  delete prompt closed the whole book on both answers, and the classic
  window carried the same misreading.
- **AutoRun bound to a button the hosts cannot see**: the new latch
  read a `keys` set that only ever holds keyboard codes, while its one
  default binding is Mouse2.

A second 7-group worktree round fixed the confirmed set; the killed
four are preserved with their refutations beside round one's eleven.

## The tail

Each finder lane recorded an overflow of below-the-line observations -
~58KB of edge cases, mostly unreachable-on-real-data robustness deltas
(a truncated CIF desyncing differently than C#, guards DFU has that no
corpus file exercises). Preserved verbatim in the session record; none
of it is load-bearing for play, and the next audit should start by
re-reading it rather than re-finding it.

## Lessons

1. **The fleet scales the method without changing it.** The house
   pattern (adversarial lanes, verify before fix, pins moved with their
   reasons, one gate) survived a 550-agent execution intact. What made
   it safe: file-disjoint fix groups, worktree isolation, and the
   verifier/fixer sequencing law.
2. **The killed list is the quality bar.** 11 of 183 findings died in
   verification, several of them plausible enough that an unverified
   audit would have "fixed" behavior that was correct or deliberate.
3. **The seam class is structural, not incidental.** 26 of 32 lanes
   found instances of the caller-does-not-deliver shape. The port's
   testing style (unit tests on law modules, text pins on hosts) proves
   laws and cannot prove wiring; the fix wave added host-wiring tests
   (audit39_*.test.js) that pin the seams themselves.
4. **A container restart mid-fleet loses nothing if the work commits.**
   The fix fleet's 21 worktrees shared the main object store; 18
   groups' commits and reports survived a restart, and the workflow's
   journal replayed them on resume. Commit early in agent lanes.
