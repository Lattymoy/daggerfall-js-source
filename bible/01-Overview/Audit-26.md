# AUDIT 26 - THE FULL-TREE PARITY AND BUG AUDIT (2026-08-26)

Mac asked for "a comprehensive bug/parity audit on the entirety of the
codebase ensuring we're 1 to 1 and bug free with Daggerfall Unity".
This page is the record.

AUDIT 24 was the last parity sweep. It read the 161 modules that cited a
C# original and closed 54 findings, then reopened for twenty-seven more
waves. AUDIT 25 asked the other question - what has never been ported at
all - and closed its seven blockers the same day. Since then the tree has
roughly doubled and a twenty-five-slice sprint landed in three days
(2026-08-23..25) that no audit had ever read. This audit reads the whole
of `src/` - 379 modules, 119,105 lines - against the whole of Daggerfall
Unity, and it is the first one to do so with the DFU source actually in
the container.

## The sweep

A real DFU checkout (`Interkarma/daggerfall-unity` at `81e89e9`, 928
non-Editor `.cs` files) was cloned, and `src/` was split into 38 chunks
by subsystem and theme, each with a lens telling its surveyor what the
doctrine allows: byte-exact for the format readers, wiring lenses for
the host layer, the native-window rule for the UI, classic-AI paths only
for the enemies, and departure-aware lenses for the voxel characters,
the WebGL2 renderer and the FM synth. Five cross-cutting sweeps ran
beside them - ported-but-never-called laws, four-hosts seam diffs,
shared-LCG draw discipline, allocation lifecycle, and the save envelope -
seeded where useful by a scripted scan (1,598 exports with no consumer
outside their own module, judged by hand rather than reported raw).

    43 surveyors   223 claims   218 confirmed   5 refuted
    67 bug   89 parity   62 nit

Every claim carried both sides - the C# member and the port site, read by
the surveyor personally - and every one went to adversarial verification
told to refute by default.

**The verification ran in two tiers, and the page says so plainly.** The
first 33 claims got two independent full-strength refuters each, one
attacking the C# reading and one assuming the port already handled it
(the AUDIT 24 shape). That is expensive, and at that burn rate the
remaining 190 would not have finished, so they were verified in batches
by a cheaper model - still refute-by-default, still reading both sides,
six claims to an agent. To check that the cheap tier was not rubber-
stamping, eight of its confirmations (five bug, three parity) were re-
refuted at full strength: **8 of 8 upheld**, every decisive line
independently reproduced. The low kill rate is the surveyors' evidence
discipline, not soft verification - but it is a two-tier result and
should be read as one.

Baseline at the sweep: `npm test` 3,382 tests, 0 fail, 180 skipped;
`npx eslint src/` clean. ARENA2 is not in this container, so every
corpus-gated test skipped and **no claim here was re-verified against
real game data** - the readings rest on the C# and on `src/`.

## The verdict

**The engine is sound and the laws are mostly right. What this audit
found is a tree where the LAW is ported and the WIRE is missing** - and
a test suite that had pinned the port instead of the source.

~~four separate times~~ **That count was four when this page was
written and it did not stop there.** Every wave of the fix campaign
that corrected a law seemed to find the pin that had been guarding it,
and by the end the tally ran to several times four - source-text
regexes that died on a rename and proved nothing, one that matched a
COMMENT, one that had gone quietly FALSE by searching for a string the
code no longer contained, several that asserted the buggy value
outright, and one that selected HUD bars by quad index and would have
broken silently the moment a bar was added. The number is left
uncorrected above rather than restated, because a page that keeps
score of its own lesson is more useful than a page with a tidy figure
in it.

The single sharpest finding is the oldest shape in this project's
history. `collectExteriorNpcs` ports RMBLayout's non-zero-FactionID rule
faithfully, is pinned against the corpus, and **had zero production
callers** - its only importer a test. No street NPC anywhere in the game
could be talked to or activated, and the Ledger had been carrying the
row admitting it since AUDIT 18. That is "a ported function with no
caller is a comment", four audits running.

## The seven that a player would have hit first

**1. No street NPC could be clicked (F019/F190).** Above. Closed; the
exterior overload of `SetLayoutData` is why it was more than a call site.

**2. Outdoor rest was dead code in both hosts (F055/F202/F203).**
`hudCtx` declared `toggleRest` TWICE in one object literal in `world.js`
and `exterior.js`. The later key won, so the complete wiring - the quest
tick, the rest-end text, `AreEnemiesNearby` - was unreachable and a
crippled twin ran. Six findings, one root cause.

**3. The enemy alert never decayed underground (F204).** The 8-hour decay
is part of the PLAYER tick (`PlayerEntity.cs:380-384`); the dungeon hosts
have no ticker. An alert raised once stayed raised for the session.

**4. A rewound load duplicated the dungeon (F218).** `applyWorld`
restored the snapshot's foes and never destroyed the live ones past it,
so every `CreateFoe` the rewind replayed spawned a second copy.

**5. Corpses accumulated without bound (F212).** An exterior corpse is a
loose object that dies with its map pixel (`StreamingWorld.cs:1040-1052`).
The port's batches were never culled, freed, or cleared on teleport.

**6. The inventory's Remove gesture cast your readied spell (F205).**
Every host gated the RMB press on "no window up"; none gated the release.

**7. A drawn dialog button was not a button (F152).** The settings dialog
ran `onYes` for a click anywhere, so tapping Cancel - or "Keep It" on the
ShowOptionsAtStart lock-out - executed the affirmative, and no pointer
path could decline.

## What the fix campaign learned

All 67 bug-severity findings are fixed, pinned, and green: **3,472 tests,
0 fail, 188 corpus-gated skips, eslint clean**, across twelve waves and
14 new pin files. Each pin was mutation-checked by reintroducing its bug
and watching it fail.

**A PIN THAT RESTATES THE PORT IS NOT A PIN - AND THIS AUDIT FOUND FOUR
MORE.** AUDIT 24 closed on that lesson; it recurred here in every form:

- Four rest pins were SOURCE-TEXT REGEXES matching the deleted twin's
  literal text, so removing the defect killed them. One had also gone
  quietly FALSE on its own - comparing `indexOf` against a string the
  hosts no longer contained, passing on the miss.
- The G5 teleport pin matched a COMMENT: it grepped raw source for
  `openTeleportMap` in the mapless hosts, and a wave added prose naming
  that symbol. It reads comment-stripped source now, with a self-check
  that the stripper still leaves real code intact.
- `enchanting.test.js` pinned the port's enchantment cap of ten. DFU
  applies **eleven** - `SetEnchantments` adds the row and only then tests
  `if (++count > maxEnchantments) break;` (`:1324-1325`), so the tenth
  pass leaves count at 10, `10 > 10` is false, an eleventh goes on, and
  then it breaks - **against its own doc-comment three lines up saying
  ten**. The code is the law. `MAX_ENCHANTMENTS` stays 10 byte-exact
  because the picker buttons test `== 10`; the off-by-one belongs in the
  loop, where DFU put it.
- An `audit24` voice pin asserted `cries(world.js) === 2` - a claim about
  how many foe pools a host holds, not about the law - and went red on a
  host that had just become more faithful.

**AND THE STRUCTURAL CAUSE OF THE WORST DEFECT WAS A LINT RULE.** A
duplicate key in an object literal silently wins and kills the earlier
one, and `eslint.config.js` enabled essentially only `no-undef`, so
`no-dupe-keys` was OFF. Turning it on found two more live sites beyond
the three already known. Each was then resolved on its own DFU law
rather than by keeping whichever key came last. `no-dupe-keys`,
`no-dupe-class-members` and `no-unsafe-negation` are errors now, and the
pin pipes a fixture through the REAL config via `eslint --stdin`,
because a rule present in a config file is not proof that it fires.

Two waves died mid-work to an API limit and re-ran. The resumed agents
recognised their own earlier edits, made no redundant change, and
supplied the missing pins instead - which is the behaviour the fix brief
asked for and worth recording as a thing that worked.

## What is NOT fixed, and where it lives

**~~The 89 parity and 62 nit findings are 117 new rows in Port-Ledger
section C.~~ THE 89 PARITY FINDINGS WERE FIXED TOO (2026-08-26), in nine
waves after this page was first written; only the 62 nits remain as
rows.** This paragraph is corrected rather than rewritten because the
page is the audit's record and the change of plan is part of it: the
parity tier was recorded as a standing gap list, then closed, and the
rows were struck centrally afterwards - 46 struck outright, 18 NARROWED
with what remains stated, 2 kept with corrected wording.

Every finding id is still greppable in section C. Five findings got no
new row because an existing row already claimed them; those rows were
updated instead. One row was struck on arrival (a parallel commit fixed
it four minutes after the list was cut).

**THREE CLOSURE NOTES WERE REFUSED WHEN THE ROWS WERE STRUCK**, and two
of them were false against the tree - a wave reporting its own area as
still open when a sibling wave had closed it, and a wave reporting a
host seam unwired that every host had carried since I4. Both rows now
record the stale claim so it cannot be re-filed. A third refusal was a
wave that could not see a concurrent wave had already closed the same
gates. The lesson is the one this page opens with, turned on the audit
itself: **a finding is a claim about a tree that keeps moving, and it
has to be re-read against the tree before it is acted on.**

**One AUDIT 26 finding refuted an existing Ledger row.** The row claiming
the outdoor rain loop keeps playing indoors "because it is DFU" is wrong:
`WeatherAmbientEffects` is a child of `ExteriorParent` and dies with
`DisableAllParents` (`PlayerEnterExit.cs:1037-1050`). Struck, with the
evidence.

Deliberately not fixed, and recorded as such:

- **F194 - the coven summoning.** The port's existing flag turns out to
  be ACCURATE rather than stale: summoning runs in interior mode and
  `scenes/interior.js` has no foe pool to spawn into. A Ledger row beats
  a forced fix.
- **The F019 residue**: `SetupIndividualStaticNPC` is not wired, because
  exterior blocks lay out before the quest bridge exists and click time
  is the wrong moment - the away arm's `SetActive(false)` must remove the
  billboard AT layout.
- **`IdentifyItem` and the item maker's clock** were investigated; the
  first was real and fixed, the second REFUSED - the stamp is read inside
  the effect off a global singleton, and passing a clock from the window
  would invent a parameter DFU has not got.

## Caveats, stated plainly

- **No real-data verification was possible.** ARENA2 is not in this
  container; 188 corpus-gated tests skip. Every claim rests on the C#
  and on `src/`, not on a run of the game.
- **Verification was two-tier** (above). The 8-of-8 spot audit is
  evidence, not proof, that the cheap tier held.
- **The refuters saw claims, not the whole survey.** A unit a surveyor
  wrongly passed over was not systematically re-checked, so the numbers
  lean, if anything, optimistic.
- **"Fixed" means the law now matches the C# and a mutation-checked pin
  says so.** It does not mean the surrounding system is complete - the
  Ledger's own rows remain the map of what is missing.
- **The line numbers in the new Ledger rows are the audit's own read.**
  Several host files moved by hundreds of lines during the fix campaign;
  the named DFU member is the durable half of every citation.
