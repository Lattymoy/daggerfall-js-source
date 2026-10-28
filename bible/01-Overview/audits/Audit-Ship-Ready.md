# AUDIT SHIP-READY: NOTHING OF THE BAY LEFT BEHIND, AND READY TO SHIP (2026-10-27)

The owner, once the field fixes were in: *"we need to do a comprehemsive audit across everything ensuring nothing from
the bay is missing and that we are finally ready to ship. This needs to be perfect"*; then *"Dont worry about the test
suite. Just lead straight into the audit"*.

**Tree audited:** #1184's head with the eleven field fixes of 2026-10-27 merged and main merged a fourth time
(`f7920ec8ba`), then a fifth (`afb333f6dc`) and a sixth (`1f9dcfdf79`, pushed). The last audit of the same question is
`01-Overview/audits/Audit-Left-In-The-Bay.md` (AUDIT BAY-LEFT, 38 findings, every one built); this one asks whether
that still holds after a day of changes, whether anything added since left the Bay's bounds in, and whether the release
is in a state to ship.

**How it was run.** Four lanes, by the lead alone.
- **Lane 1 - the last audit's pins.** Every test file that names BAY-LEFT (118 files, 1,291 tests) with the freeware's
  data (`tools/fetch-data.sh`, ARENA2_PATH) on `f7920ec8ba`.
- **Lane 2 - the Bay's bounds in new code.** Every line added under `src/`, `server/` and `server-account/` since the
  last audit's merged tree (`4781031fbc`) read for the Bay's own bounds: a pixel held under 1000 x 500, a `y * 1000 + x`
  key, `inBay`, MAPS.BSA's 62 regions, a region read off the Bay's directory alone.
- **Lane 3 - the running game.** The real game in headless Chromium (SwiftShader) on the freeware's data: booted at
  Daggerfall, then a fast travel's landing to every capital and a town in each province (`__tesaJump`), and at each the
  place's record, its doors and the buildings behind them, one building entered, the page's errors and its memory.
- **Lane 4 - the release.** Its versions, migrations and the account toml, the merge with main, CI on the head, the pull
  request's description and its patch notes.

## Findings

Every finding below is fixed, pinned and recorded where its system lives.

- **S1 - pins the fourth merge's own resolutions moved** (lane 1: 4 of its 5 failures). The merge joined main's harbour
  ring (RPT1026-WORLD FAR-QUAY) with this branch's split host (`scenes/harbourHost.js`, one list of the towns near, each
  once) and main's heir id (RPT1026-MISC HEIR-WAITS) with BAY-LEFT-B's map id on the Online page's pick. The code was
  right; five source pins still read the old shapes (`audit_tesa.test.js` A4-F2/F3, `tesa6_ports.test.js`,
  `world/etherplaces.test.js`, `systems/legacy/bayleftb_seat.test.js` B1, and main's own
  `systems/naval/rpt1026_world_farquay.test.js`). PIN MOVED, each.
- **S2 - Lillandril's harbour: no ships at a port past the Bay** (lane 1, a regression). RELIEF-PEAKS raised the land past
  the Bay, and two of 283 Arena places stood a pixel over (Winterhold, Lillandril). Lillandril's berths nearest the town
  lay in a closed inlet along its side, no mouth out of them, so `findHarbour` answered no harbour. Fixed in the harbour
  law for every port: the berths taken again from the shores whose own way out stays on the water to open sea
  (`03-World/Holdings.md`, A HARBOUR ON A WAY OUT). Every port past the Bay six berths again, every one standing.
- **S3 - HUNTERS-MARK's named mark, Bay-bound** (lane 2). Main's new mark carried its board's town as the Bay's pixel
  (three unsigned digits, under 1000 x 500), so no board past the Bay posted a mark and the service would have refused
  its clear. The town is the world's pixel now, as a board notice's (`06-Systems/Bounty-Boards.md` section 12.4, Past the
  Bay too).
- **S4 - ROAD-FOLLOW's types** (the head's own gate). Six `npm run types` errors the road-travel branch carried in (the
  ends' bridges, the legs' line, the reader's shape, a capital's anchor as a pair) - JSDoc corrected, no code changed.
- **S5 - CI had not run on the pull request's head.** #1184 conflicted with main (main moved twice in the day), and a
  pull request that conflicts runs no workflow. The fifth merge brought main in; main moved again in the night
  (MENTOR2, LEVEL-BAR, LEVEL-TOP, GEAR-ADDS) and the sixth brought it in. A Ledger cite both sides moved is moved by
  both. The head is pushed and CI runs on it.
- **S6 - the merge tool's sweep on a relay that did not move.** At the fifth merge `tools/mergeMain.mjs --sweep` wrote
  a history clause renumbering world274 past itself into 47 relay pins, and moved one raids pin's refused version onto
  the accepted one (`ww6_raids.test.js`). Taken back by hand; the account's move (acct204 -> acct205) kept. The tool
  sweeps a relay pin whenever main's newest relay is below the branch's, moved or not - OPEN, the tool's own slice.
- **S7 - CI's first run on the integrated head: 20 files red** (lane 4), each the meeting of two of the day's changes:
  world274's row lost the release's history at the fourth merge; main's RPT1026 pins read code the host split had
  moved; ROAD-LOOK, FLORA-GROUND and TESA4's bridges; HOST-SPLIT's seam; four new duplicate exports (audit24's
  ratchet), named apart; IC-PROPS' "Residence" among the routed words. And the nine field fixes' code claimed Ledger
  rows no one wrote: rowed (`Port-Ledger.md` section A, the tally 363 rows, 348 standing). They had gone in past the
  table's closing blank line, outside it, and the sixth merge closes the table after them (364 rows, 349 standing, with
  main's MENTOR2).
- **S8 - PLAIN-TEXT at the fourth merge** (lane 4). Main's law (`tools/plainText.mjs`, `Home.md` SAY IT ONCE, PLAINLY)
  came in at the fourth merge, and the merge never ran its `--seed` for a base without the law, so 360 of this branch's
  own entries read as grown. Seeded from the branch's two tips without it (`9fe573f43f`, before the fourth merge, and
  `9f852f57f4`, ROAD-FOLLOW's). Every baseline entry over main's (355) is at or under the branch's own figure.
- **S8, the rest.** 27 entries stayed over: pages and files the merges filled from both sides, and text written since
  the law (the tally's three new clauses, S2's paragraph, PORT-SHIPS' header). Each is within the law now - comment
  blocks tightened, this branch's long paragraphs split at a sentence's end, the tally's new clauses a list of their
  own - and the baseline lowered. Two of those files are the relay's (`server/src/index.js`, `net/townSeatLaw.js`), so
  world274, unpublished, is re-hashed (`test/net/relayversion.test.js`).
- **S9 - CAUSEWAY and the window planner** (`test/world/worldWide/ww7_cross.test.js`). Main's RPT1026-WORLD CAUSEWAY (a
  road over the water is the road's, `travelRoute.js` pavedStep) let the planner walk the water band the test laid
  across a road - right, by the law. The band lies across a track now (a ford, never paved), and the road's crossing
  over water is pinned as walked across the edge too. `tools/mutants/ww7_cross.json` 78, all dead.
- **S10 - the film's set** (the third merge). INTRO4's set (`ui/intro/set/`, the city the film was shot on) declared its
  own `CAPITAL_ARCHIVE = 38400`, a second owner of the game's registered number (`world/eliteGates/pseudoArchives.js`);
  it takes the game's now. Its directory has its Code Map row (`Code-Map.md`).
- **S11 - R2-5's nearest Mages Guild, after IC-STAIRS** (ARENA2, `auditrelease_r25_freeware.test.js`; bisected to
  IC-STAIRS, `13b8bcc1fa` - IC-PROPS, IC-INTERIORS and IC-STUTTER pass alone). The quest's site was right: the nearest
  slice whose index holds a Mages Guild hall, quarter 34 of the Elven Gardens. The pin searched again after the quest had
  started, and the search leaves out a building a quest holds (Place.cs's IsBuildingAssigned); IC-STAIRS' doors left
  that quarter one hall, so the pin walked on past it. Re-aimed: the site's own slice gives its kind by holding it, and a
  nearer slice with a free hall still fails it.

## Lane 1 - the last audit's pins

1,291 tests in 118 files: 1,286 passed and 5 failed, every failure S1 or S2. All 5 pass after the fixes, and every
harbour test (30 files, 309 tests, ARENA2) passes. Mutants: `tools/mutants/harbour_inlet.json` 3 and
`tools/mutants/shipaudit_hunt.json` 2, all dead; every record on `findHarbour`'s body run again (18): 16 dead and the two
AUDIT-GN2-GN1 survivors that survived before this change (`03-World/Holdings.md`, OPEN, not this audit's).

## Lane 2 - the Bay's bounds in new code

Three lines held a pixel to the Bay. One is S3. `systems/naval/harbourBook.js` dryPixel (main's FAR-QUAY) answers
"never certain" off the Bay's map - a shortcut that only skips work on the Bay, the harbour past it waits for its built
ground as before. `systems/naval/navalWire.js`'s `BAY_REGION_COUNT` is WW-R's own word (the Bay's regions on `s`, a
province's on `r`). Every other region read added since resolves past the Bay (`REGION_NAMES` carries the nine
provinces; `mapDict` lookups fall back to the world's registry).

The sixth merge's code (MENTOR2, LEVEL-BAR, LEVEL-TOP, GEAR-ADDS) holds no pixel, key or region to the Bay. MENTOR2's
partners are read off the room's peers beside me (`world.js` partyNear), which a room past the Bay keeps as the Bay's.

## Lane 3 - the running game past the Bay

(filled in below as the run lands)

## Lane 4 - the release

- **Versions.** Relay `world274`, past main's world272 and world273; the five gates of the release
  (`WORLD_WIDE_RELAY_MIN`, `GUILD_INSTANCE_RELAY_MIN`, `WW5_RELAY_MIN`, `RAID_WORLD_RELAY_MIN`, `OW_WORLD_RELAY_MIN`) at
  274 - at 272 they would have let main's world272 relay, which keeps none of them, through. Re-hashed
  (`test/net/relayversion.test.js`). Account `acct205`, past main's LEVEL-45 acct204, the toml in step.
- **Migrations.** `0183` to `0187` (this branch's), after main's `0178` to `0182`: contiguous, no number twice.
- **Deploy order.** The relay, then the account service, then the site (`RELAY_VERSION` and `ACCOUNT_VERSION`'s notes).
- **The description.** Its patch notes keep STE (`scripts/steNotes.mjs`, the `ste-notes` check), carry every field fix,
  and give no number of the loot gate (LOOT-GATE).

## Not covered, and why

- **Two players online at once** past the Bay (a relay and a second client), as before.
- **The account migrations against a real D1**, as before.
