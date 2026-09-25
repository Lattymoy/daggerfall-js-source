# AUDIT 68 - THE WHOLE-TREE SWEEP, 2026-09-24

Mac: *"I want to do a deep comprehensive audit across the entirety of the
codebase, making bug fixes, refactoring where needed and overall doing
some major housekeeping. This is not a 1:1 complete parity audit and is to
ensure our codebase is better than it is today... No band aids."*

**PARTIAL, by circumstance.** The account's session limit stopped every
agent at about 03:52 UTC and the run resumed at 10:17; Mac then asked for
the audit to wrap at what had landed. What is on the branch is verified
and green; what is not is listed at the end, with where its drafts are.

## The method

- **Find.** 53 lanes: 45 file slices of `src/`, `server/`,
  `server-account/`, `app/` and `scripts/` (~9K lines each, read whole),
  and 8 cross-cutting lanes - dead modules and exports (X1), repo
  housekeeping (X2), resource lifetimes (X3), duplication (X4), dev tools
  (X5), suite health (X6), async hygiene (X7), security (X8).
- **Verify.** One adversarial verifier per lane, reading a snapshot, told
  to refute and to reproduce. 352 findings judged before the limit: about
  300 confirmed, 54 refuted.
- **Fix.** One fixer per file-disjoint cluster in its own worktree, each
  behavioural fix pinned in `test/audit68_<cluster>.test.js` and each pin
  run against the base to prove it fails there (A PIN MUST FAIL).
  Clusters whose verification was lost to the limit were fixed by agents
  told to verify each finding themselves first and to skip on thin
  evidence.
- **Integrate.** Cherry-picks in checkpoints; each checkpoint ran
  `tools/citeShift.mjs --apply` against the previous one, hand-mapped the
  struck and next-line cites citedrift CD4/CD8 gate, and passed lint,
  types, the whole suite (with `DFU_PATH` set, so the parity pins ran)
  and the build before it was pushed.
- **Review.** A four-lane hostile review of the integrated diff before
  merge (below).

## The one paid first

**X5 - citeShift skipped `world.js`.** The tool read each target's base
copy through execFileSync's default 1 MiB buffer; `world.js` crossed
1 MiB with the COMM merge, the read threw ENOBUFS, and a catch meant for
new files swallowed it - no cite into the tree's largest file would ever
move, and the run still said "0 to move". Fixed before the fix wave, since
every cluster leaned on the tool (`test/audit68_citeshift.test.js`). Main's CITE-BUF found and
fixed the same bug the same day; the merge keeps main's `GIT_MAX_BUFFER`
and both pins.

## What landed, by cluster

- **formats_c** - a truncated stored UnityFS block refused rather than
  zero-filled; a worker's reader error is the answer, not a dead worker;
  SPELLS.STD and TEXT.RSC walks single-sourced.
- **combat_c** - the rig no longer swings (or lands hits) while sheathed,
  equipping or behind a readied spell; the shield's material, sheet key
  and parry ring (it played at volume 0); a held shot flushed, not
  dropped; per-frame rig singletons re-bound; dead Thunderlock state.
- **backend** - the relay asks a hello for its token before writing
  anything (a tokenless hello planted a secret that locked the owner out
  and replaced live sockets); idle accounts behind a dead party pointer
  swept; an owner registry's word expires; hit bytes and say/mute metered
  per sender; register, recover and the save-slot bound compare-and-set;
  the old password on a change rides the login throttle; bodies capped as
  they arrive. Relay `world105` (`world103` on the branch; main's `world103`
  and `world104` landed first).
- **exterior** - the dropped-pile quick take returned out of `frame()` and
  froze the game (exterior and world; main's QL-FRAME1 paid it too, and the
  merge keeps main's shape with this branch's release on a take); a foe could die twice; pursuit
  memory moved with a recentre; a hit effect's failed warm leaked; the
  encounter cap raced.
- **dungeonctx** - a dead foe takes no second death; missiles and a
  retyped foe's corpse survive a load no more; a removed foe is not
  lootable; the exhaustion box latch; an archer's hit frame; dead rig
  deps, exports and 25 unused imports.
- **combat_bf** - Roleplay & Realism's archery read under the wrong vendor
  key, so it never ran under PCAAO; the Morrowind rig's mid-build queue
  dropped the latest request, its failed swaps rejected unhandled every
  frame, its generation memos never let go; MW face ids by case, first-
  person skins over third-person, 15-bit and grey TGA; KeyGroup sampling
  single-sourced in `formats/mwKeys.js`.
- **worldjs** - a door in the second copy of a repeated block opened the
  first copy's building; disembarking restored the wrong height; a load
  during a fast-travel arrival ran two teleports; a failed road network
  crashed every pixel build; a foe's spell was billed as the player's.
- **net** - halo sockets leaked and a halo's error wedged the primary
  session; a confirmed trade could be cancelled while the peer committed
  (goods destroyed); inbound quest frames gated; emote `$` patterns.
- **enemies** - the enhanced motor routed stacked floors at y = 0; one nav
  bake pipeline instead of three; surface-height queries on a grid; the
  strike edge and the melee level read live.
- **repo** - the release legs wait for the gate job; tags at the built
  commit; the dev server's EISDIR crash; lint reaches test/, tools/,
  scripts/, app/; `npm test` runs only `*.test.js`; SRI on the three.js
  pages; `archive-sheet.html` registered.
- **player** - live EOTB settings; a NaN look at dt 0; the lock-on
  target; cached boxes and sprite counts; an allocation-free collider.
- **systems_f** - an online death load revived before the restore; a
  renamed spell renamed the shared one; quickslot disarm; reverb HF decay.
- **formats_a** - ARCH3D no longer copies 26 MB to patch 2 KB; DFRandom
  and DXT5 off BigInt; binary-search key segments; one BuildingData reader.
- **chars_bc, scenes_ab, systems_a, tools, render_a, render_b, quest,
  worldmodes, systems_d** - their commit bodies carry the item lists (the
  tail frame and arachnid mirror; the guard's second death and the loose-
  foe reservations; indoor rain retried; bakes that never write on import
  and the cite and mutant tools' edge cases; billboard re-keying and
  texture release by minted keys; shared-quest items and the macro
  replacer; door builds serial and cancellable through
  `scenes/transitionGate.js`; one equip act and one weight law).

Plus the desktop shell on **Electron 42** (folds in PR #338; all 16 shell
probes green).

Tallied from the reports that survived: 193 fixed, 8 partial, 5 skipped
with reasons, over 16 clusters; six more clusters' reports were lost to
the limit and their commits are the record.

## The pre-merge review

Four hostile lanes read the integrated diff (scenes; combat, characters,
AI, player, world; systems, net, UI, the Workers and the shell; formats,
render, tools and CI). Eleven findings, all paid; the pins are
`test/audit68_review.test.js` and additions to the exterior, worldmodes
and backend pin files, each run against the unfixed code first.

- **High - the relay's hit bytes (a merge of two lanes' intents).** X8
  moved the hit arm's byte budget from the room to each SENDER, which
  reopened the very flood C3 was written against: N sockets, each its own
  256 KiB/s, into one destination. The budget is the DESTINATION's now,
  beside the destination's frame funnel - a flood aimed at one socket
  spends that socket's bytes and no one else's. `world103` (now `world105`) re-recorded in
  place (never deployed).
- **Medium - the encounter cap caught spawner squads.** S20's in-flight
  count applied to CreateFoeSpawner stands too, so a summoning punishment
  or RR's expulsion squad stood in one loop was cut at eight; a `loose`
  stand is not the encounter cap's (all three pools' stand closures).
- **Medium - a published door build did not stale the doors queued
  behind it.** The transition gate serialized builds but only `abort()`
  moved its generation; a build that PUBLISHES is a world move too
  (`transitionGate.run`), and a request behind a FAILED build still runs.
- **Medium - round provenance stopped at one host.** S19 taught the
  dungeon's foe sink to read a round's `{ fromPlayer }`; the other three
  hosts ignored it and `subscribeFoePools` built every round's sinks as
  the player's. All four read the tick now, and a round is nobody's blow
  unless it says so.
- **Low** - a dead/alive/dead flap left a drawn body unlootable (the flag
  rises at the death, not the mint); an unstood interior person's FlatAnim
  outlived its batch; four cites into project-final's `main.js` that the
  cite tool had moved as if they were this repo's; a stale hydrate comment;
  two stale renderer cites the checkpoints had not caught. One weak-pin
  note was examined and left: the `_heldHit` guards in `switchHand` /
  `readyWeapon` are unreachable under the classic timings (the bow
  cooldown always outlives the hold), and remain as a harmless second
  wall.

## The merge with main

Main moved 52 commits while the sweep ran (DISC16-DISC20, KB1, the
contributor drop, TITLE-N). 311 conflict hunks: 279 differed only in cite
numbers and were taken from main and mapped by `tools/citeMerge.mjs`; the
rest were resolved by hand. Three were the same bug paid twice - the
quick take (QL-FRAME1), the online dead load (DISC19-C) and citeShift's
buffer (CITE-BUF) - and main's shape was kept. `citeMerge` keeps this
branch's `ambiguousBare` across main's both-sides map, and main's
friendly-spells pin, which had commented out its own `POSE_CAST_ELEMENTS`
assert, asserts it again. Main's grass fog (DISC20-A) had pasted a tenth copy of
`fogFactorAt`; it takes `render/fogGlsl.js`'s now, S17's one home.

## Not done

- **Never audited:** S39-S41 and S43-S45 (`src/ui` from enhancedChunk to
  worldPlaque, most of the enhanced skin) and S46-S47 (`src/world`).
- **Found, verified, never fixed:** combat_a (S07), the suite-health lane
  (X6, 12 items), ui_misc, and the broad dedupe/dead-code sweep (about 50
  cross-module items, X1/X4 chief among them).
- **Found, unverified, never fixed:** systems_b/c/e/i, ui_a/b/f, labs.
- **Drafts on side branches, unreviewed:** `audit68/survival_u`,
  `audit68/systems_misc`, `audit68/systems_h`.
- **For Mac:** `deploy.yml` still rebuilds the month-old
  exact-face-atlas side branch into the production origin (X2).

## Lessons

- **A limit is a lane.** Sixteen concurrent agents spent the account's
  window in about seventy minutes and every agent failed at once. Size the
  fleet to the window, and push each green checkpoint as it lands.
- **The struck-cite gate outruns the tool.** citeShift holds struck cites
  by convention, but CD4 gates some of them, and it cannot see a
  continuation on the next line; every checkpoint needed the same hand
  mapping through the diff. That mapping belongs in the tool.
- **Another repo's file is not this repo's file.** The cite tool matched
  `main.js:315` in a paragraph about project-final's `main.js` as a cite
  into `src/main.js` and moved it. A cite qualified by another repository
  needs to be held, and the tool cannot yet tell.
- **Cherry-picked new text keeps its worktree's numbers.** A comment a
  fixer wrote cites lines as they stood in its worktree, and the
  integration shift maps from the checkpoint base - so a new cite can land
  wrong without a test noticing.
