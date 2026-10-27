# THE FIX: no system left behind in the Bay - shared brief for every work package (read it whole)

The owner, after the audit: **"Every single thing here needs to be addressed. No exceptions. Dont return until this is
completed in full."** The audit's record is
`/tmp/claude-0/-home-user-daggerfall-js-source/dae0405a-f226-582d-9131-f2490d1f38e5/scratchpad/audit/Audit-Left-In-The-Bay.md`
(read it - your package's items are named there by number and lane id). Each lane's probes, which reproduce the
findings on the real code, are under `.../scratchpad/audit/<A|B|C|D|E|F>/` - reuse them to show each defect before and
gone after. Where an item was "the owner's call", the owner's answer is now in: every item is built. Your package brief
below states the decision taken for each such call; build that, record it as the owner's call taken
("Every single thing here needs to be addressed. No exceptions.", 2026-10-26).

## Where you work
- You are in an ISOLATED GIT WORKTREE on your own branch, made from commit e77eadc58f (PR #1321's head with its base
  merged). Work, test and commit THERE. Never touch the main checkout at /home/user/daggerfall-js-source (read-only to
  you), never push, never use GitHub, never contact anything external.
- First: if `node_modules` is missing in your worktree, `ln -s /home/user/daggerfall-js-source/node_modules node_modules`.
- The freeware Daggerfall data is at `/home/claude/dfdata/arena2` - set `ARENA2_PATH=/home/claude/dfdata/arena2` for
  every test run; the ARENA2 halves of the tests are the real proof past the Bay.
- Other packages run in parallel on their own worktrees (the list is at the end). Do not fix their items. If your fix
  truly needs a change in their area, make the smallest change and name it in your report.

## The repo's laws (CLAUDE.md and bible/Home.md "Process" bind every change - read both, and bible/01-Overview/Port-Doctrine.md's Scope)
- **HOST-SPLIT - the hosts do not grow.** `bootWorld` (src/scenes/world.js), `createWorldModes`, `createNavalHost`
  stand at their ceilings with ZERO room (test/scenes/hostceiling.test.js counts LOGICAL lines: statements and object
  entries; layout is free). Any line you add inside them fails the suite. The way: first MOVE the block you are about to
  change out of the host, verbatim, with `node tools/hostMove.mjs <host file> --group <members> --to src/scenes/<yourModule>.js --name create<YourModule>`
  (plan first, then `--write`; read its header) in a commit of its own, LOWER that host's ceiling to the new count in
  hostceiling.test.js with a note (the second test there requires it), and then make your change in the moved module.
  In-place edits of an existing line in a host are fine. New behaviour goes in a module the host wires
  (src/scenes/fishHost.js is the shape); on the relay, in a Room method of its own, never in `_message`.
  `node tools/hostScope.mjs <host>` maps what a block reads and writes. Name all FOUR hosts in your record where you wire
  a seam (Home.md THE FOUR HOSTS RULE: exterior.js, world.js, worldModes.js, dungeonContext.js - each wired or flagged).
- **A CITE NAMES WHAT IT POINTS AT.** In the bible, a cite into our code is an anchor (`world.js:"const x = () =>"`),
  never a line number; `npm run cites -- --apply` converts numbers, `npm run cites -- --check` must pass.
- **A PIN MUST FAIL.** Every fix gets a test that fails without it (prefer exact deepEqual over inequalities), built
  from the real producer (TEST THE SHAPE THE PRODUCER MINTS). Then a mutants list `tools/mutants/<your-slice>.json`
  (format: tools/mutate.mjs's header) naming each law you wrote; run `node tools/mutate.mjs --jobs 2 tools/mutants/<yours>.json`
  - every one dead (a survivor means a missing pin: add it). `test/tooling/mutantdrift.test.js` must pass: re-aim, BY
  CONTENT, any older record your change moved (and run those re-aimed records - all dead).
- **Moving someone else's pin:** only when your change is meant to move it, with a `// PIN MOVED (<YOUR-SLICE>): why`
  note beside it.
- **Player-facing text** goes through the localization layer like its neighbours (`t()`/localizedText and the
  Port_Strings tables) and every complete locale is filled in - read bible/06-Systems/Localization-Arc.md L10N4 (the
  ratchet) and copy what the nearest recent slice did; the L10N tests must pass.
- **The bible.** Each slice writes its record where its system's doc lives (a `## <SLICE> - ...` section: what stood,
  what it is now, the decisions taken, Pins, Mutants, PIN MOVED list), a row in bible/01-Overview/Port-Ledger.md when it
  departs from DFU, and a line in bible/01-Overview/Active-Arcs.md. Fix the stale doc lines of your area that the audit
  lists. Scripted doc edits must assert their needle matched (Home.md). The bible gates must pass:
  test/bible/manifest.test.js, test/bible/audit18_bible_docs.test.js, test/tooling/citeanchor.test.js,
  test/scenes/citedrift.test.js, test/systems/ledger.test.js.
- **The wire.** Relay `world270` (src/net/wire.js RELAY_VERSION) and account `acct196` (server-account/src/service.js
  ACCOUNT_VERSION) are NOT YET DEPLOYED: fold your relay/account changes into them ("re-hashed in place"). Do NOT edit the
  LAW hash rows in test/net/relayversion.test.js and do NOT edit the RELAY_VERSION / ACCOUNT_VERSION lines or their long
  comments - the lead re-hashes and writes those notes once, at integration (relayversion.test.js will fail in your
  worktree if you touched the relay graph; that one failure is expected - say so in your report). A relay change goes in
  a Room method of its own. A module newly bundled into the account Worker must join `.github/workflows/account-deploy.yml`'s
  path filter (test/server/accountdeploy.test.js, test/server/discord_setup.test.js). Both ends of a law must agree
  (the client's and the relay's/account's).
- **Patch notes** never go in a file (test/tooling/rel4_release.test.js); put yours in your report. LOOT-GATE: never
  publish the loot level gate's numbers. Discord is code (server-account/src/discord*.js) - never ask for tokens.
- **No band aids** (World-Wide.md decision 6): move the system's own law - its key, its walk, its slot - never a clamp
  beside it; the Bay's answer to every moved law is pinned unchanged (byte for byte where it can be).
- Keep the Bay's behaviour unchanged unless the item says otherwise, and pin that it is.

## Checks before you finish (all must pass in your worktree; say what you ran and the counts)
1. `npm run lint`, `npm run types`, `npm run cites -- --check`.
2. Your new and moved test files, with ARENA2_PATH set.
3. The tests your change can move: `node tools/testChanged.mjs --list --base e77eadc58f` lists them; if that is most of
   the suite (a change to world.js does that), run every test file that imports or names a module you changed
   (`git grep -l` the module names under test/), plus test/render/boot2.test.js, test/world/tamriel2.test.js
   (TAMRIEL2-WORKER), test/tree/moduleload_smoke.test.js, test/scenes/hostceiling.test.js. Run them in parallel:
   `node --test --test-concurrency=2 <files>` (the machine is shared with eight other packages: keep to 2).
4. The bible gates above and test/tooling/mutantdrift.test.js; your mutants all dead.

## Commit and report
- Commit on your worktree's branch in small, honest commits (the repo's message style - `git log` - is
  `<SLICE>: <what>` with a body), each ending with these two lines:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01CdRPvy8ef9zJfSezAJpAim`
  No model names anywhere in commits, code or docs.
- Your final message is the only thing the lead sees. Give: your branch name and every commit SHA; per item - what was
  done, the files, the pins, the mutants (counts, all dead), the before/after probe numbers; the decisions you took;
  every shared hotspot you touched (src/net/wire.js, server/src/index.js, server-account/src/*, world.js/worldModes.js
  lines, hostceiling.test.js numbers, locales/*, bible/03-World/World-Wide.md, Port-Ledger.md, Active-Arcs.md,
  account-deploy.yml, migrations); whether you touched the relay graph or the account service (and what the version
  notes should say); the checks you ran with their pass/fail counts; your patch-note lines for players (plain words, what
  a player notices); and anything NOT done - which should be nothing. If something is truly impossible, say exactly why
  and what you did instead. Do not stop early: the owner said not to return until it is done in full.

## The packages (for reference; yours is in your prompt)
- WP1 Gates in every province + the Sky-Ketch in every province (A2, A2b, A2c, A4).
- WP2 WW5: Starfall's covens and the Hollows in every province (item 26).
- WP3 WW6: raids and staff town events past the Bay (item 27).
- WP4 Dungeons: the build hole (A1), online spawned dungeons and Elite past the Bay (A3), Ocean Holes pits past the
  Bay, the Overworld's dungeons past the Bay (C4), the bounty boards' quarry by the land's own fauna.
- WP5 Quests, talk and houses: Legacy heirs past the Bay (B1), %di (B3), Where-is (B4), map reveals (B5/C8), scrying
  (B6), %lp (B7), house sales in Arena towns and the countryside.
- WP6 Province courts and people: the factions past the Bay (item 33) and the vampire-clan guard.
- WP7 Maps and travel UI: held-map marks (C1), waypoints (C2), places by summary / passages / far plates / quest press
  (C3), the Find box (C9), Travel Options' roads (C10), held-map gaps (C11), Come Sail Away's map (C12), the building
  discovery key (C7/E2).
- WP8 Sea, ports, market and seats: harbourmasters past the Bay (C5), the capitals' harbours (C6), the market's hubs
  (B2/E1), the Bounty edict past the Bay (B8/E3), staff /town audit (E4), weather born at sea (D4).
- WP9 The ground: the landforms' site pull past the Bay (D1), road trouble's fauna (D2), the Snowfall mod past the Bay
  (D3), landformLiftAt past the Bay (D5).
- The lead: this PR's own defects (F1 the Imperial City's bake stall, F2 TS9 past the Bay, F3 TS10's key), the stale
  doc lines in no package's area, the relay/account version notes, the integration and the full suite.
