# AUDIT BILL (2026-10-24) - BILL1, the bill's fixes, audited cold

Mac, of BILL1 (`11-Multiplayer/Bill-Arc.md`, the answer to the month's Cloudflare bill): **"Audit this"**. This page is
the findings, each with its verdict. What the audit changed is written into Bill-Arc.md's sections as they now stand,
each change under its finding's id, and the code says the same at every site.

## How it was run

Four lanes, each a cold adversarial reader of BILL1 at 7db984fac (its commits da9e7c344 and 53426ac4e and the merge of
main that renumbered it), told to verify every finding - a probe, a query or a mutant and its output - before reporting
it, to cite the code by its text, and to fix nothing. They read a FROZEN SNAPSHOT (a detached worktree of 7db984fac),
never the working tree, so Home.md's DO NOT FIX WHILE THE VERIFIER IS READING held; the fixes were made in a second
worktree, and every finding was checked again there before a line changed. A fifth read, the author's own, re-asked the
live analytics behind the page's figures.

| Lane | Over | How |
|---|---|---|
| A - the relay | a region's channel keeping its links (hubShards.js REGION_BUS_KEEP, busSpills, linkShardOf; the relay's hop; world.js channelLinkRoom): every region feature on a bus's own sockets, mixed buses, the count, older builds and relays, the hub | the real relay over the fake rooms, a mixed-bus experiment, mutants on a scratch copy |
| B - the account service | `+column` against the expression index, the writ board's gate | node:sqlite over every migration: affinity cases, the plans of every statement the service sent in seven suites, rows visited counted a subquery, mutants |
| C - the client's homes | `mayHold`, `everyWhole`, the build's guard | probes over the real registry, every way a town comes to hold a home, the paint's path, mutants |
| D - the record and the pins | Bill-Arc.md and its index lines, the two version bumps and the merge's renumbering, every mutant record, the pins, the hosts | the bible gates, the version pins, `tools/mutate.mjs` on a `git archive` copy, a recount of the page's figures |

**WHAT THEY FOUND.** No HIGH. One MEDIUM in the change (C1 = D1) and one MEDIUM older than it (B1), LOW and NOTE
findings for the rest. Every one is fixed and pinned, or left and said.

## Lane A - the relay

- **A1 LOW - the count of the channel's own sockets was not pinned.** Counting the ShardSockets too (`this._all().size`,
  or `getWebSockets().length + this._vsocks.size`) passed every pin, and would hop every arrival at a region that once
  spilled. FIXED: scale5c's BILL1 pin keeps a ShardSocket on the bus and takes it under the bound by its own sockets;
  both mutants recorded and dead.
- **A2 LOW - a crowded region's arrivals pass its channel's one hello gate** (50 a second) before being told their
  shard, where four shards' gates took them. LEFT, SAID (Bill-Arc.md section 2, what is given up): a reload wave at the
  start region's evening waits a few seconds for Region chat; a link's reconnect goes to its shard directly.
- **A3 NOTE - a link told its shard stays on it** as the region thins. LEFT, SAID (the same list): a region once crowded
  keeps its occupied shards awake for whoever stays.
- **A4 NOTE - the count is every socket of the channel's, said hello or not.** LEFT, SAID: it never lets the channel
  overshoot or refuse; ~200 silent sockets on a quiet channel cost, nothing breaks.
- **A5 NOTE - the hub's bus built its sockets' array for a count it never reads.** FIXED with A6: the count is taken of a
  region's channel alone.
- **A6 NOTE - the rule sat inline in `_message`** (CLAUDE.md: a Room method of its own, never `_message`). FIXED:
  `_busHops`, the line in `_message` a call; SCALE5c's mutant on that line re-aimed and dead. world256 re-hashed in place
  (undeployed).
- Sound, checked: the hub's path unchanged; no hop loop; a mixed bus runs region lines, travellers' marks, the census,
  the Region tab's `find`, counts, leases, freezes, mutes and paces over both kinds of socket; older builds, older
  relays and the `_shardMiss` fallback; nothing wakes every region shard.

## Lane B - the account service

- **B1 MEDIUM, older than BILL1 - a piece's maker walked the crafter's every craft.** eligibleHere's and pieceOkSql's
  `EXISTS (... prof_crafts WHERE player = ? AND (provenance = ... OR provenance2 = ...))` searched an index of the player
  alone; with the decor searched, this was the statements' cost for a heavy crafter (500,500 rows a read in the lane's
  probe). FIXED: migration 0167 (two indexes), the OR asked as one EXISTS a column in both files (indexes alone did not
  move the planner); a plan pin and four mutants, dead; three older mutant records re-aimed by content.
- **B2 LOW - the board's gate was pinned for neither list nor its open test** (`[...asked]`, `[...mine]` and the gate
  without `c.state === 'open'` survived). FIXED: a commission cut from `asked` by its LIMIT and kept in `mine`, its
  mirror, and a closed one; three mutants, dead.
- **B3 NOTE - `+column` and `column` part for a `pv` that is a JSON number spelling a provenance.** LEFT, SAID: no writer
  makes one (decorPieceOf), and where one stood the new spelling agrees with every bound-value check that guards the
  act itself.
- Sound, checked: every statement of the three families plans SEARCH (each captured from seven suites and planned);
  idx_home_decor_pv is the schema's only expression index; the board's answer is the same in every case traced.

## Lane C - the client's homes

- **C1 LOW (= D1 MEDIUM, the record's half) - a town the build was turned from stayed unasked when a word named a home
  in it**, so a hall made there since, or the account's own home bought on another device, was not drawn until the walk
  in or the pixel's next rebuild - wider than what Bill-Arc.md said was given up. FIXED: `mayHold` keeps the towns it
  turned the build from, and a word naming one asks it at once; Bill-Arc.md and Online-Arc.md HOME-LOOK say so.
- **C2 LOW - a read landing after a word, taken before it, wiped the word's town** (the boot read's wait run out, the
  hub's welcome first). QUEST-HOME's own race; BILL1 had added a cost to it. FIXED for BILL1's part: a town a word has
  named stays one the build asks. LEFT, SAID: `homeStands` keeps QUEST-HOME's race as it was.
- **C3 LOW - a mutant survived: any answer counted**, not one that named a home. FIXED: pinned and recorded.
- **C4 NOTE - the gate's ask was said to be held by fb1014_questhome.test.js**, which asks a town by hand; it is
  home1.test.js's ("the town asked on arrival"). FIXED in Bill-Arc.md and the pin file's header.
- **C5 NOTE - "whole" is the client's HOME_KEYS_MAX against the service's.** LEFT, SAID: a shared constant, never moved;
  a raised one reads as not whole (safe), and lowering it is its own change to make whole-safe.
- **C6 NOTE - homeYards.js asks `/v1/homes/yards` of every built town within reach.** LEFT, SAID (Bill-Arc.md section
  3, not taken): `mayHold` is the guard when that route is taken up.

## Lane D - the record and the pins

- **D1 MEDIUM** - C1's record. FIXED with it.
- **D2 LOW - the ten account-version mutant records lost BILL1's note at the merge** (their `old` moved, their note
  began at KETCH). FIXED: each note opens with BILL1's.
- **D3 LOW** - C4. FIXED with it.
- **D4 LOW - Bill-Arc.md undercounted the moved pins** (four, in two files, not two in one). FIXED: section 4 names each.
- **D5 LOW - four records still told the region's old path**: Scale-Arc.md SCALE5c part two's client, world.js's
  comments over channelLinkRoom and at the region's join, hubShards.js part two's docblock. FIXED, each with a BILL1
  note; world256 re-hashed in place.
- **D6 LOW - the page said the 20 s heartbeat keeps a room awake**; wire.js RELAY-H1 says it was set to leave
  hibernation its gaps. FIXED: moving poses and the room's own streams (FOES_FULL_MS among them) are named.
- **D7 NOTE - the figures did not all agree.** The rooms' kinds sum to 9,526 h of windows against 8,904 h billed; "~145
  of the 371" mixed the two; R2's 578,004 puts are about $2.60 of the line's $4.50. FIXED: shares said as shares (~136,
  ~120 the regions'), the R2 line says what is not accounted for.
- **D8 NOTE - "past" the bound where the code spills at it.** FIXED: wire.js's world256 line and Scale-Arc.md say "once
  it holds".
- **D9 NOTE - two mutant notes run together or missing.** FIXED.
- **D10 NOTE - some pins read the source** (the decor's spelling, the build's guard, the page's `linkShardOf`). LEFT,
  SAID: each has a behaviour pin beside it but the page's, whose law `linkShardOf`'s own pin holds.
- **D11 NOTE - two commit messages say more than the code** (da9e7c344: "a town that holds one" for one that may;
  53426ac4e: 842 dated to 2026-10-23, of 2026-10-18). LEFT, SAID: pushed history is not rewritten; this is the record.
- **D12 NOTE, not BILL1's - main's KETCH row in relayversion's LAW has no unpublished-branch line.** LEFT, SAID: KETCH's.
- Sound, checked: the cites resolve; every code fact the page names is the snapshot's; both version bumps follow the
  earlier ones, no current pin on an old number, no historical row rewritten; the hosts' logical lines unchanged
  (bootWorld 36,387, `_message` 1,744, createPixelBuild 1,614); no patch-notes file.

## The author's own read

- **E1 NOTE - "17 objects awake 24 hours sent under a thousand frames"**: 17 were awake over 20 hours, 6 the whole day.
  FIXED in Bill-Arc.md section 2.

## After

`tools/mutants/bill1.json` holds twenty-seven, all dead, and the records re-aimed by content (craftwrits.json two,
audit31.json one, scale5c.json two - the hop's line, and the region's join, whose comment D5 moved) die as before. The gates, the version pins and the touched suites pass.
