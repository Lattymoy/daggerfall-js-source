# AUDIT 62 (it ran as 61; main's other lane published that number first) - THE DELTA SINCE AUDIT 58, 2026-09-07

The question: AUDIT 58 closed on 2026-09-03 with the whole tree read.
Since then this branch and main between them landed some fifteen
thousand lines of `src/` - Dynamic Skies (DS1), Seasons of the Iliac Bay
(SIB1), touch input (TI1), the enhanced AI arc (EA1-EA4 and AUDIT 59),
the two dungeon-defect rounds the owner reported and their review
(PR #55, #57, #58), the fixed-city catch-up loop (PR #59), Wave G's UI
windows and the render-pipeline changes under the seams incident. None
of that had been audited as a DELTA: each piece was reviewed on its own
branch against its own reference, and nobody had asked what the pieces
do to each other. This audit read the delta whole, by ten lenses chosen
for the fault shapes this port keeps producing.

**Ten finder lenses, 51 findings judged by two Opus skeptics each, 39
confirmed and 12 refuted. One solo batch and six fix lanes in isolated
worktrees, each lane followed by its own adversarial reviewer and a
fixup round: 20 review findings, all applied. Nothing here has been seen
in a browser; the container carries no ARENA2.**

## On the number

This audit ran under the working label **AUDIT 61** for its whole life -
every comment, pin, test title, Testing.md row and arc-page section it
wrote said 61 - because 61 was the next free number on this branch when
its finder fleet opened. It was not free for long: main's other lane
published `Audit-61.md` (THE TWO MODS, 1:1 ON MAIN, PR #61) while this
audit's lanes were still fixing. The same collision `Audit-58.md`
records for 54, and `Audit-52.md`/`Audit-53.md` for 49.

The renumber is a rename only: **every tag this branch wrote now reads
AUDIT 62** - comments, pins, the four `audit62_*.test.js` files, the
Testing.md rows, the arc-page sections. Main's `Audit-61.md` is untouched
and is the one this record sits beside. The navmesh digest pin
(`test/enhancedAI.test.js`) was re-pinned once, because the renumber
touched the comments inside the body it hashes; the body's code did not
change.

## Why the audit took this shape

The delta is not one system. It is a mod (DS1), a mod (SIB1), an input
layer (TI1), a departure (the enhanced AI), three rounds of reference
law on the enemy motor (the transform/capsule split), two hosts' worth
of encounter machinery, a handful of UI windows and the texture upload
path. A lens per SYSTEM would have re-read what each branch's own review
already read. So the lenses were chosen for fault SHAPES that cut across
systems:

| # | Lens | What it read | Judged | Confirmed |
|---|---|---|---|---|
| 1 | enhanced-ai | the navmesh under real dungeon geometry (stacked floors), the routed motor against the classic law it defers to, the bake cache, the digest pin | 5 | 4 |
| 2 | dynamic-skies | DS1's hosts and runtime for callers the port never wired, and departures the record does not list | 4 | 1 |
| 3 | seasons | SIB1's refresh seam and month-turn wiring against the DLL's IL | 3 | 2 |
| 4 | touch-input | the touch layer's every verb executed against the SHIPPED gate, not the layer's own e2e stub | 6 | 5 |
| 5 | hosts | the two walkable outdoor hosts and the mode machine both mount, for clauses of `PlayerEntity.Update` that one host has and the other lacks | 6 | 6 |
| 6 | foes-motor | the transform/capsule split (PR #55/#57/#58) at every site it did NOT reach | 7 | 7 |
| 7 | ui-windows | the (-1,-1) hover sentinel against every scroll bar the ROAD-G G4 review did not sweep | 2 | 2 |
| 8 | render-pipeline | the texture upload convention against every new door that uploads | 2 | 2 |
| 9 | missing-caller | exported seams with no caller in `src/`, and ladders one host carries that another lacks | 3 | 2 |
| 10 | pins | mutation runs against the delta's own pins: which laws survive their reverting mutant | 13 | 8 |

Every finding went to two adversarial verifiers prompted to REFUTE it
with the reference open; a finding survived only if both upheld it, and
each verifier's corrections to the finder's proposed fix were carried
into the lane brief (several fixes below are NOT the finder's proposal -
the corrections are noted where they mattered). The first verify pass
was killed at 94 agents by the session limit; it resumed from its
journal after the reset with every agent pinned to Opus (Mac: "ensure
any agents are opus and not fable"). 120 agents in the audit fleet; 18
in the fix fleet (six lanes, six reviewers, six fixups: 3.1 million
tokens, 1,332 tool calls, two and a half hours wall-clock at two lanes
abreast on a four-core box).

## What was broken

The detail lives on the arc pages, each under a dated "AUDIT 62 F<n>"
heading; this is the map. Finding numbers are the audit's (F1-F38 as
the lanes tagged them; C0-C38 in the fleet's own ledger).

### The enhanced AI (`bible/12-Enhanced-AI/Enhanced-AI-Arc.md`)

- **F1 - the navmesh could not hold a stacked dungeon** (`ai/navmesh.js`,
  HIGH). `buildPolyMesh` welded vertices by (x,z) alone. A Daggerfall
  dungeon stacks floors by construction - a mezzanine, a bridge, a hall
  under an upper corridor - and wherever two walkable spans overlapped in
  xz their vertices welded to one id, the shared edges gained three or
  four owners, `linkPolyNeighbours` refused them, and the mesh fragmented
  on BOTH levels: `findPath` answered null and the motor fell back to
  classic in exactly the geometry the switch was built for. The fix is
  Recast's own `rcBuildPolyMesh` addVertex law (a two-voxel height
  tolerance, same-region welds always accepted), the lattice cut's
  INTERPOLATED height rather than the ring endpoint's, vertex heights
  carried through the bake (stride 3), a level-aware `locatePoly`, and
  the corridor-level waypoint heights the solver already implied. This
  is the first change to the body project-final's navmesh was pinned
  byte-identical to; the arc page and the header comment say so, and the
  digest pin now hashes the body instead of restating three lines of it
  (F3). The batch-1 commit is `802bd5e`.
- **F1 (the motor half) - the routed final leg aimed at the target's
  feet** (`ai/enhancedMotor.js`, `characters/enemyMotor.js`). Since PR
  #55 the classic `GetDestination` builds its destination in TRANSFORM
  space (the target's centre, a face bump for flyers and swimmers, the
  grounded foe's controller-height correction); the enhanced route's
  last waypoint still took the predicted position's raw feet - a bat
  0.9 m low, and at floor level never climbing again. One `_aimY` law
  now, on `EnemyAI`, that BOTH arms call, so the two cannot drift apart
  again (which is how this one happened: PR #55 changed one and not the
  other). Two pins that had been tautologies against the port's own line
  now sweep a bat, a rat and an orc against a real classic `EnemyAI` of
  the same shape.
- **F2 - the bake cache was never versioned past the anchor-y fix**
  (`ai/navClient.js`). `NAV_BAKE_VERSION` had been 1 since the cache was
  born, through a fix that changed every bake's output for the same
  input; and the key carried no anchor, so a bake from the wrong
  component was served forever per dungeon. Version 2, and the anchor's
  cell in the key. (The verifiers cut the finder's second proposal -
  "bake with anchors at every foe spawn so the key can stay anchor-free"
  - as answering a different question.)
- **F38 - the ARENA2 pin reported a pass it never earned**
  (`test/enhancedAI.test.js`). Its body was `assert.ok(true)` behind a
  gate that never checked the path existed. It skips without the
  archives and reports TODO with them, asserting nothing either way, with
  the body it owes written out beside it. The real bake waits on ARENA2.

### Seasons and the render pipeline (`bible/07-Rendering/Seasons-Iliac-Bay.md`, `bible/07-Rendering/Render-Arc.md`)

- **F26 - every seasonal flat was uploaded upside-down** (HIGH,
  `systems/seasonsIliacBayAssets.js`). The bundle reader hands PNG
  raster order (top row first); the port's texture path uploads
  `getColor32` order (bottom-up), which every classic archive comes in.
  SIB1's door handed the reader's order straight through, so every
  managed flat - every tree, every bush, every season - stood on its
  head. Fixed at the door (`toColor32Order` on both arms, bundle and
  loose PNG), with a pin that drives a real flip through the real
  upload. The review round corrected `decodeTexture2D`'s docstring,
  which had claimed the opposite contract for its only consumer.
- **F4 - `RefreshLoadedNatureBatches`' archive filter was never
  applied** (`scenes/world.js`). The refresh seam tore the whole grid
  down whenever any pixel stood on an older install, where DFU
  re-applies only batches whose archive the mod manages. The one-line
  filter, pinned. (The per-key refinement both verifiers named as
  larger is recorded, not built.)
- **F27 - the `#opaque` cache-key rationale cited a DFU law that does
  not exist** (`render/renderer.js`). The comment now says what the key
  is for; main's PR #61 reshaped the same line at the same time and its
  superset (a `variant` override) is what stands.
- **F5, F36 - two SIB1 pins that could not fail**: the month-turn pin
  matched the member's body rather than its caller, and "slot 0 holds
  record 1" could not tell record 1 from an existing record 0. Both are
  caller-shaped or discriminating now.

### Touch input (`bible/10-UI/UI-Arc.md`, the TI1 sections)

- **F6 - a tap could never fire the activation on a real device**
  (HIGH). The three combat hosts arm a 0.3 s click delay on every
  `pointerdown` that does not hold the pointer lock - and a finger can
  never hold it - so every finger-down opened a window in which the
  activation gate consumed the tap's release edge. Executed against the
  shipped gate: an 80, 120, 150, 200 or 250 ms tap activated nothing.
  The layer's own e2e pin could not see it because it stepped the gate
  in whole seconds. One clause at each host: not for touch pointers.
- **F7 - the touch look and attack hooks walked past the pause gate**
  the mouse arms obey; a drag on an open inventory was a swipe that
  loosed a readied spell into the world, and a look banked under a
  window swung the camera on close. Gated as `InputManager` gates them.
- **F8 - the touch layer hardcoded the default key codes** instead of
  reading the bindings registry, so a rebind in the controls window was
  invisible to it. It asks now. The review round found that dropping the
  synthesized `Mouse0` had left `worldModes`' own activate gate with no
  route to the tap - a tap activated nothing in any interior or
  world-hosted dungeon - and closed that fourth host, along with a
  modal frame that rendered down the finger and a pin that hung instead
  of failing.
- **F9, F10, F16** - the mode-cycle button flipped the interaction mode
  under an open window (the keyboard route refuses); the dial was drawn
  on the classic skin where Tab opens nothing; and the lock-on had no arm
  in `worldModes`' dungeon and interior ladders, so a street lock rode
  through a shop door and kept steering. All four hosts carry it.

### The hosts and encounters (`bible/04-Characters/Characters-Arc.md`, `bible/07-Rendering/Dynamic-Skies.md`)

- **F11 - PR #59's "the catch-up loop runs in every mode" was
  unreachable indoors** (HIGH). Both hosts rang `runEncounterTick` BELOW
  the modal frame that consumes every interior and dungeon frame, and
  the interior rest rang no tick, so `_lastEncMinutes` froze at the
  door while the one world clock ran: an eight-hour tavern sleep was
  banked and replayed at the door as 480 EXTERIOR minutes - the exact
  defect the comment claimed closed. `createWorldModes` takes an
  `encounterTick` dep now, rung once per modal frame and from the
  interior rest, and the NPC-guard conversion sweep that had to move with
  it is gated to the exterior (DFU's population is inactive inside; the
  hoisted loop would have turned street townsfolk into watchmen while
  the player stood in a shop). The review round found the sweep's
  once-per-Update latch pin had been split to make room for a comment,
  and made it one regex again over both hosts.
- **F12 - Wabbajack on a watchman could erase him**: the guard was
  removed through the guard pool and re-stood through the encounter
  pool, whose cap could refuse. A `replacing` option, slot-neutral by
  construction, as `WabbajackEffect.cs` is.
- **F13, F14, F15, F22** - the ?exterior host minted its watch without
  the enter/exit latches (a quest `spawncityguards` in a dungeon rang
  2-5 Knight_CityWatch onto the exterior collider at dungeon-local feet);
  the street pool survived indoors as a stale list metres from the
  indoor player; `world.js`'s quest placement tested occupancy against
  the encounter pool alone and could stand a quest foe inside a
  watchman; and the interior pools wore the OUTDOOR spawn band
  (`playerInside: false` hard-coded), so a foe a storey above the
  player was "spawned in classic" with no vertical test. Each is one
  clause of `PlayerEntity.cs` or `EnemySenses.cs` the other host or the
  other pool already had.
- **F29 - `DynamicSkies.setInside` had no caller**: the mod's
  `InteriorTransitionEvent` teardown never ran, so a lightning flash
  rolled a moment before a door froze with its routine intact and paid
  out the rest of its burst on the first frame back outside. This one
  landed TWICE: main's PR #61 wired the same door with a `skyInside`
  latch while the lane ran. At integration the lane's latch was dropped
  for main's, and the lane's pin now holds the two edge POSITIONS
  (inside the modal block; above `sky.use`), which is the law.

### The foes and the motor (`bible/04-Characters/Characters-Arc.md`)

- **F17 - one yDiff, one distance.** `_classicSenses` handed
  `wouldBeSpawnedInClassic` a transform-space distance (PR #57) and a
  FEET-space yDiff; `EnemySenses.cs:288-290` takes both from the
  transforms and the pair is one Pythagorean identity. The error was
  exactly `centreOffset - playerHeight/2` - enough to flip the row-0
  vertical band for a bat perched 2.6-3.2 m up.
- **F18, F37 - the unpinned half of PR #57**: three of the review's four
  transform-space laws had no test that died when reverted (the hearing
  cast's offsets sat at their defaults in every caller). Pinned through
  the live path with a capture-raycast collider.
- **F19, F20 - blood at the transform.** The foe-vs-foe splash was at
  `feet + height/8` where DFU is `transform.position + center` and THEN
  `+ height/8`; four sites (three fall-damage splashes, the player-arrow
  splash) passed bare feet where DFU passes the enemy transform, which
  is the idle sprite's centre. An orc mauling a bear bled it at the
  shins.
- **F21 - the aim, the blast and the contact.** The enemy missile's
  foe-vs-foe arm aimed at the capsule centre, exploded AreaAroundCaster
  at a hardcoded `feet + 0.9`, and loosed from a hardcoded `feet + 1.2`;
  all three are the caster's or target's transform in
  `DaggerfallMissile.cs`. Moving the aim REQUIRED moving the contact
  test with it - a point-sphere at the capsule centre would have made a
  tall flyer permanently unhittable - so it is a capsule test now. The
  review round then found the capsule was 0.9 m too tall (the segment
  was the capsule's SURFACE, `feet..feet+h`, not its axis
  `feet+r..feet+h-r`; a bolt into the floor under a rat hit it), that
  only the FOE arm of the aim had been converted (a crouched player
  stayed a 1.8 m target to every enemy missile), that the exterior
  archer aimed at the player's half-capsule whoever it struck, and that
  `runTargetMachine`'s out-of-band player LOS had no pin. One body of
  the aim law now (`enemyTargets.targetAimPoint`), both pools call it,
  and the player's own capsule is swept as the foe's is.
- **F23 - the player is a live capsule.** `_targetHeight()` answered 1.8
  and `_targetCentreOffset()` 0.9 for the player unconditionally; DFU
  reads the component, and `PlayerHeightChanger` gives it 0.9 crouched,
  2.6 mounted, 0.30 swimming. Crouched, the port aimed its sight ray at
  `feet + 1.50` where DFU aims at `feet + 0.75`, so ducking behind low
  cover never broke line of sight. `sensesContext` carries the live
  height from all four hosts.

### UI windows and the dynamic-skies pins (`bible/10-UI/UI-Arc.md`, `bible/07-Rendering/Dynamic-Skies.md`)

- **F24, F25 - the sentinel sweep's missing two drags.** The bank
  purchase window's and the list picker's scroll bars dragged off the
  hosts' fabricated (-1,-1) hover sentinel - the price list flung to
  row 0 - the same shape the ROAD-G G4 review guarded in three windows
  and did not find in these two. Guarded, and the G4 drive covers all
  five drag machines; the review round corrected every "all three" the
  record still carried and widened the CD8c pin to reject the phrase.
- **F30-F35 - six DS1 pins that restated the port**: the timescale
  factor multiplied by the imported constant (so 0.0833 -> 0.08 survived
  the suite), the two lightning roll thresholds never driven at their
  boundary, three of eight lunar phases pinned, the phase-offset ladder
  pinned nowhere near its 22/23 and 28/29 edges, Secunda's OneWane arm
  never exercised, and a fog-cadence pin that pinned nothing. Every
  value matched the mod as it ships - no shipped behaviour was wrong -
  but each mutation had left the whole suite green. All six now die
  under their mutant, with `BLBSkybox.cs`' line as the law.

### The record

- `bible/09-Testing/Testing.md` gained rows for `audit62_enhancedai`
  (4), `audit62_touch` (14 after the review round), `audit62_hosts` (13)
  and `audit62_foes` (10), and every touched row's description was
  extended; `dynamicSkies.test.js` is 21 pins and `seasonsIliacBay` 17.
- `bible/12-Enhanced-AI/Enhanced-AI-Arc.md` no longer states the law F1
  falsified (the review round found a third copy in Testing.md and
  retracted it).

## Integrating onto a moved main

Main took PR #61 (the two mods) and PR #62 (ECV1, Enhanced Combat
Visuals) while the lanes ran - 98 files. The merge conflicted in 23
files, 31 hunks: 24 were cite-number-only and resolved to this branch
(the remap below re-resolves them anyway); the seven substantive ones
were the renderer's cache key (main's superset kept), the two hosts' sky
edges (main's kept, see F29), the seasons generation stamp (both sides
kept - main's "read the generation where the lookups read it" AND this
audit's archive filter, in the arc page, the test and the code), the
ARENA2 pin (this audit's honest skip), and Testing.md rows (union).

The cites. Six lanes, each numbering cites against ITS OWN tree, squashed
onto one branch and then merged with a main that had renumbered the same
hosts: a line's cite was right only relative to the tree that wrote it.
The remap was done by PROVENANCE - each line of every cite-bearing file
classified by which tree it exists in verbatim (the base `802bd5e`, one
of the six lane tips, main, or the pre-merge squash), and its cites
mapped from that tree's line numbers to the merged tree's by diff
offsets with content matching inside changed hunks. 333 cites moved.
The five the mapper could not place (a slash-pair `world.js:A/B`, two
Ledger row numbers, a wrapped `(:NNNN)` in `chargenSession.js`, a
literal in a citedrift regex) were set by content, and the CD4 table's
51 entries were re-resolved by content in a pass that also corrected one
of its own mis-resolutions (the relaxed match had landed on the wrong
Ledger row). Every citedrift, Ledger, Status, landing, manifest, hudlarge
and doctrine pin is green on the merged tree.

## What was refuted, and why

Twelve findings did not survive two skeptics with the reference open.
They are recorded because the next finder will raise them again.

- **DS1 `setInside` has no caller** (dynamic-skies lens) - refuted on
  the grounds that the listener flags are unobservable, and then
  RE-RAISED by the missing-caller lens with the flash as its evidence
  and confirmed as F29. The first verdict was right about the flags and
  wrong about the fix's worth; the record keeps both.
- **The `_CloudTopColorBoost` uniform pin covers the location list, not
  the upload** - the pin dies under the mutation that reverts the
  defect it was written for (a missing location FETCH); the finder had
  inverted which half was the fix.
- **Per-frame string allocation in the sky pass** - true, and not a
  defect under this audit's rules (no behavioural, reference or pin
  consequence).
- **The port's sun strobe runs beside the mod's LightningFlash** - a
  gated enhanced-lane departure already recorded; the classic path is
  clean.
- **SIB1's only switch is in the Enhanced menu, unreachable from the
  classic skin** - the classic launcher's settings window draws a SKIN
  button in its footer on every layout.
- **The tap's lock-on arm inverts DFU's nearest-hit order** - the arm
  is a Ledger-A recorded departure confined to the touch lane and cannot
  run on the classic activation path.
- **G5's OnPop re-position reaches only player-dropped piles** -
  unobservable: `droppedItems` can never be non-empty while a
  non-player-owned loot target is open, in DFU or the port.
- **HOLD_MS and CHEST_FRACTION are restated in their own pins** - the
  mutants survive, and the premise was wrong: those two are the port's
  own touch constants with no reference value to pin against.
- **The waypoint-advance reach is driven only ON the corner** -
  confirmed as a gap, refuted as a finding: the proposed fix fails
  against the correct code (the `<=` is Recast's, and the lane's F1 pin
  drives the edge now).
- **AUDIT 59 F2's character-offset windows will rot** - true and out
  of scope: the pin truncates 20% of the function it slices, which is
  a pin-quality note for the next enhanced-AI round, not a port defect.
- **The lightning listener's teardown after an interior visit departs
  from the mod without a QUIRK note** - `InteriorTransitionEvent` already
  nulls the handle under Thunder; the non-Thunder arm is symmetric.
- **`DynamicSkiesRenderer.fillColor` is written and never read** - a
  byte copy of `clearColor`, symmetric with the pass it models,
  violating no reference law.

## What was left, and by whose decision

- **F38's real bake** - Privateer's Hold through `dungeonContext`'s
  loader, baked from its collider at the entry marker, the path across
  the first hall asserted. Needs ARENA2; the container has none. The
  body it owes is written out beside the skip.
- **The two enemy ARROW origins** (`dungeonContext.js`,
  `exteriorFoes.js`, `feet + 1.2`). `GetAimPosition`'s arrow arm is
  `transform.position + forward * 0.6 + height / 3`, and the pools do not
  carry the caster's forward vector at the loose seam. A fix with its own
  reference read; the aim POINT those arrows fly at is fixed (F21).
- **`DaggerfallMissile.cs:583-585`** - an arrow at a CROUCHING player
  dips its aim by 0.05. Found while verifying F21, not in the findings;
  needs an `IsCrouching` signal distinct from the live height (a 0.9
  controller is also the swim case).
- **`hostMagic.explodeAt`'s `playerFeet + 0.9`** for the AoE distance to
  the player - `DoAreaOfEffect` is an `OverlapSphere` against colliders,
  a different law from the aim/contact one this round settled.
- **The per-key seasons refresh** (F4's larger form) and the
  `dataPipeline.js` decodedTexture swap the finder folded into F26 (a
  pre-delta defect of its own: the swap passes `undefined` and throws,
  orientation is not its only problem).
- **The touch layer on hardware.** Everything in lens 4 was executed
  against the shipped modules under a stub document or read against the
  C# reference; `tools/touchProbe.mjs` is the browser probe that would
  confirm it and was not run.
- **`world.js`'s second, unreachable `act === 'Rest'` arm** (two
  byte-identical arms in the same block, the second dead). The cite
  names the one that fires; deleting the duplicate shifts every cite into
  the ladder and belongs to a residue sweep.
- **Two lane observations outside the findings**: the touch mode button
  calls a hook rather than synthesizing a key (its BEHAVIOUR is correct
  after F9); a button and a stick axis bound to the same code can lift
  each other's press (a self-conflicting rebind the controls window
  permits, identical before this change).

## What this audit could not do

Nothing here has been seen in a browser, and five of the fixes are
render- or device-adjacent: the seasonal flats' orientation (F26), the
enhanced route under Privateer's Hold's stacked halls (F1), a tap on a
phone (F6-F8), a thunderstorm walked through a door (F29), and an enemy
bolt at a crouched player (F21). Those are the surfaces that want the
owner's eyes on the live site first.

## The cost

The audit fleet: 120 agents (ten finders, two verifiers per finding, the
re-run after the limit). The fix fleet: 18 agents, 3.1 million tokens,
1,332 tool calls. Integration onto the moved main was solo: 31 conflict
hunks, the provenance remap, six hand-set cites, the F29 reconciliation,
the renumber. Gate at the merge: 6,623 tests, 0 failures, 221 skipped
(the ARENA2 and browser gates), `eslint` clean, the vite build green.

## Lessons

- **A squash of six lanes is a seventh tree.** Each lane's cites were
  right for its own worktree and wrong for the squash; mapping cites by
  diff offsets from the squash would have carried every lane's offset
  error forward, and did, once, before the provenance pass replaced it.
  The next integration starts from the per-tree mapper.
- **A number is not free until the record is merged.** Two audits took
  61 on one day, on two branches. Claim the number by publishing the
  record's stub on main first, or expect to renumber.
- **The verifiers' corrections are the brief.** Three of the lanes'
  fixes differ from the finder's proposal (F1's `_aimY` helper, F2's
  anchor in the key rather than a union bake, F5's caller-shaped pin
  without the behavioural extension) because a skeptic read the
  reference more carefully than the finder. The lane briefs carried the
  corrections verbatim, and the lanes' own notes record where the two
  skeptics disagreed and which reading won.
- **The same fix, twice, is a merge decision, not a conflict.** F29
  and main's DS1 wiring were the same law in two shapes. Keeping main's
  and re-pointing the lane's pin at the POSITIONS the law needs cost
  less than either side's text, and the pin is stronger for it.
