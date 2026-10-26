# AUDIT HIDDEN-UNCOUNTED (2026-10-25) - a hidden staff member in no online count, audited cold

The owner, of HIDDEN-UNCOUNTED (`06-Systems/Chat-Roster-And-Names.md`, the answer to *"Invisible players dont count
towards the online count"*): **"Audit this"**. This page is the findings, each with its verdict. What the audit changed
is written into the records as they now stand (`06-Systems/Chat-Roster-And-Names.md` HIDDEN-UNCOUNTED,
`11-Multiplayer/Guild-Overhaul.md` GUILD-SEEN), each change under its finding's id, and the code says the same at every
site.

## How it was run

Three lanes, each a cold adversarial reader of HIDDEN-UNCOUNTED at a2c40c60c, told to reproduce every finding - a probe
and its saved output - before reporting it, to cite the code by its text, and to fix nothing. Each read its own FROZEN
SNAPSHOT (a detached worktree of a2c40c60c - lane P's its own, since its mutants write the files they judge), never the
working tree, so Home.md's DO NOT FIX WHILE THE VERIFIER IS READING held while the findings already in were fixed in the
tree. Every finding below was reproduced again in the working tree before a line changed: each fix's pin fails on
a2c40c60c's code and passes on the fix.

| Lane | Over | How |
|---|---|---|
| L - the session's mark and the counts over the real relay | `hidden` through every hello (first, reconnect, the rehello swap, a halo promoted, Hide me's relink, a late or refused token, a leave); the welcome's, a join's, a leave's and the hub's `n` on hub shards, the bus, a woken shard and region shards; every visible player's count | node probes over the real relay (test/fakeRoom.mjs), its count timers fired and its closes handed to the game; 15,000 visible sources against the parent's roster |
| C - the client's faces and the hosts | every reader of `rosterRows` and the own row, every chat tab's source, a flip of Hide me mid-session, every other face a count or a presence is shown on, `placedRosterSource` against the literal it replaced, the four hosts | node probes over the real relay and session; the real `chatPanel.js` in Chromium at 1280 and 375 px, 22 screenshots |
| P - the pins and the record | every added and moved assertion, `hiddenuncounted.json` and 17 mutants of its own, the three re-aimed records, every claim of the record and the commit, the gates, flakiness alone, beside the heavy e2e files and under load | `tools/mutate.mjs` on its own snapshot; the bible gates |

**WHAT THEY FOUND.** 19 findings and notes in three lanes, several met by more than one lane (L1 = C2; L4 = C N4 = P1;
L5a = C3's bible line = P2). One was a design question put to the owner, who answered it: "Last seen when hid" (C1).
Every finding is fixed, pinned and named below, or left and said.

## L - the session's mark and the counts

- **L1 MEDIUM - a hidden screen read one FEWER than every visible one after a join on another shard.** The hub's count
  (`{t:'n'}`) was kept only past the link's own shard's peers `+ 1` - a seat a hidden socket never has - so a count one
  past them was thrown away and the screen fell back to its rows until the next who-answer (up to HUB_WHO_MS). FIXED:
  `online.js` `_seatN`, none while hidden, in that rule. The welcome's own rule keeps its `+ 1`: the welcome's `n`
  counts its joiner, a hidden one too (the relay's `others.length + 1`). Pinned over the real relay with no who-answer
  between (`hiddenuncounted.test.js`, AUDIT L1 = C2, L2), HU-AUDIT-L1-*.
- **L2 LOW, older than the change - a count of nobody was never taken**, so a hidden screen kept the last number it
  held (2) a minute after everyone left. FIXED: the same rule's floor is `_seatN`. HU-AUDIT-L2-the-hub-counts-floor-at-one.
- **L3 LOW - the mark was read once, at the primary's own hello**, so a halo promoted at a crossing (no new socket, no
  new hello) kept the old socket's mark while the relay held the promoted one by another token. FIXED: `hidden` is a
  getter over the socket that stands for the room NOW - its own hello's token (`_helloTok`), decoded once a token -
  which answers for a rehello's swap, a promotion and a leave alike. Pinned both ways (AUDIT L3),
  HU-AUDIT-L3-the-mark-read-once.
- **L4 NOTE - the pins never switched a session from hidden to shown**, and the harness never handed the game a close
  the relay made. FIXED: Hide me and Show myself mid-session through the real `relinkGame`, 3 then 2 then 3 (AUDIT L4,
  C N4), HU-AUDIT-L4-the-mark-sticks-once-hidden; the harness hands the game the relay's closes and fires each room's
  HUB_COUNT_MS count (`sayCounts`).
- **L5 NOTE - the record said three things that are not so.** (a) "a tokenless hello ... is counted": the relay
  refuses it (`server/src/index.js:"if (!m.tok) return { error: 'sign in to play online' };"`). (b) "a build from before the
  shards": a build that mints hidden tokens says `hs` and is moved to a shard; a hidden link reaches the bus only when
  its shard twice failed to open. (c) "reads that `n` only when the welcome's list was cut": on a shard the bus has told,
  the client reads the bus's `n` whenever it is past its own peers plus one. FIXED: the record rewritten (below, P5).
- Checked and sound: no visible player's count or roster moved (15,000 sources, 0 differ); no relay or wire byte, so no
  RELAY_VERSION; the relay sets `hid` on a verified `hd === 1` alone, the test `tokenHidden` reads; every relay walk
  leaves a hidden socket out; a relay that ignored `hd` would still give an equal count; `othersHere` reads no wrong
  zero (a hidden link's `trav` is dropped at the relay); staffMap and staffHook read no counts.

## C - the client's faces and the hosts

- **C1 MEDIUM, older than the change - the guild's "N online" counted a hidden staff member, in their own view and in
  every guildmate's**: the Members page read each member's play beat, which their game knocks as any does, and the
  reader's own row read online always. PUT TO THE OWNER: "Last seen when hid". FIXED: while Hide me holds - the mint's
  own test, LAPSED_SQL's, for an account the role lists name - the member reads as last online the moment they hid
  (`server-account/src/staffHidden.js` hiddenSince: the first hidden token of the run, one staff session's, after the
  latest Show myself, ordered by the log's ids), in every member's view (`guilds.js` viewOf, asked of a Hide me account
  alone); the reader's own row is marked `hidden`, said of that row alone, so their own "N online" leaves them out
  (`guildBook.js` guildMemberOnline). The beat itself goes on: the seat, Renown and the play clock read it.
  `staffHidden.js` is loaded where it is asked, never at `guilds.js`'s load - a static import closed realm.js ->
  guilds.js -> staffHidden.js -> staff.js -> market.js -> realm.js before realm.js had run. ACCOUNT_VERSION acct183
  (`service.js`, `wrangler.toml`; acct182 on its branch, renumbered past STAFF-EVENT's acct182 at the merge), every pin
  and mutant record moved by content. Pinned over the real Worker
  (`test/server/hiddenuncounted_guild.test.js`), HU-AUDIT-C1-*.
- **C2 LOW** = L1. FIXED.
- **C3 LOW - a link before its hello, or one whose mint was late or refused, lists its own row while Hide me is on.**
  LEFT, SAID: such a link is held by no relay - counted by nobody - and shows its own row as any player not connected
  does; the mark is now the socket's the relay holds (L3), never a switch the relay does not hold. Its bible line (the
  tokenless hello "counted") is L5a's, FIXED.
- **C N1 NOTE - the client reads `hd` off the token's body** without the relay's word. LEFT, SAID: the relay sets `hid`
  on the same strict test after verifying the token, and a relay that ignored it would count an equal number (lane L's
  probe).
- **C N2 NOTE - "my own row is in `base` already"** stood false while hidden. FIXED: the comment says the hub's search
  names neither its asker nor a hidden socket.
- **C N3 NOTE, older than the change - at a phone's width the roster column, and its count, are never drawn.** LEFT:
  the chat's own layout, not this change.
- **C N4 NOTE** = L4. FIXED.
- Checked and sound: the flip over the real relay and the real `relinkGame` - no stale own row, the PERF-ON3 answer a
  new array at each flip and the same one while nothing moves; the real panel in Chromium, every tab's heading and
  rows, the search's "1 of 5"; every tab's source carries the mark (World the session itself; Region, Trade, LFG and a
  language's through `placedRosterSource`; Party, Guild and Nearby composed); `placedRosterSource` equal to the old
  literal for a visible link, field by field; no other host builds a roster source or a chat panel; no other face shows
  a hidden member's own count or presence.

## P - the pins and the record

- **P1 MEDIUM - "the mark follows the switch" was claimed and not pinned**: a mark that sticks once hidden, and a
  session reading hidden before any hello, both survived. FIXED: the flip (L4) and "a session that has said no hello is
  hidden from nobody", HU-AUDIT-L4-*, HU-AUDIT-P1-a-session-with-no-hello-reads-hidden.
- **P2 LOW** = L5a. FIXED.
- **P3 LOW - the World tab's e2e never read the relay's count**, though its message said so: the shards' count timer
  never ran in the harness. FIXED: the harness fires it (`sayCounts`), and the pin asserts every link's `roomCount` is
  the hub's.
- **P4 LOW - `placedRosterSource`'s `title` and `gt` were unpinned** - my own badge and tag on the Region tab. FIXED:
  the source's every field, HU-AUDIT-P4-*.
- **P5 LOW - the "Left as it is" paragraph was loose**: (a) and (c) as L5; (b) the shard's own count wins whenever it
  holds the hub's whole visible count; (c) Trade, LFG and a language's channel are not sharded, and count a hidden
  joiner as the bus does; (d) INVIS-NET does take a concealed player off the Nearby list and the F key's plaque. FIXED:
  the paragraph says where a hidden screen reads one too many (the joiner in the welcome's `n` AND a cut list) and one
  too few (the bus's count exactly one past its own shard's at the welcome), and INVIS-NET as it is.
- **P6 NOTE - no Active-Arcs line, and the Party and Guild sources' JSDoc said "a list of one"**, false while hidden.
  FIXED: both.
- **P7 NOTE - four survivors equivalent for every real token** (the body's base64url swap and padding, `!hidden` for
  `hidden !== true`, the length cap). No action: equivalent, as the lane showed (400 minted tokens).
- Checked and sound: every added mutant dead; the re-aimed records each still on one site and its law; the `until`
  loops bounded polls with separate assertions (a failing run costs about 2 s); 25 of 25 runs alone, 5 of 5 beside the
  heavy e2e files at four at once, 3 of 3 under load; the gates; the record's other pages rightly untouched (no
  DFU member for the Ledger, no new page but this one).

## Found on the way, outside this change

- **FOUNDER5's cloud-save pin went red on 2026-10-25 on its own** (`test/server/founder5.test.js`, "FOUNDER5 the live
  link, a cloud save"): its "late" guest is dated `OLD_CUT + 30 * DAY` - 2026-10-25 00:00Z - to stand for a first play
  LATER than the account it links, and from today that instant is earlier than the account the pin registers, so the
  link it says never happens does. Red on a2c40c60c's parent too. FIXED ON MAIN the same day, as this page proposed
  (the guest dated a month past the pin's own clock), and merged in here before this audit's merge.

## Found after the merge

- **The World tab's pin waited for the count alone** (2026-10-25, red now and then in CI's `verify` shards on pull
  requests that touch none of this): the `[true, false]` pin's `until` asked each screen's count, then asserted the
  staff game's rows, `['Alpha']` for `['Alpha', 'Beta']`. The count moves on the hub's `n` each HUB_COUNT_MS; the other
  shards' rows move only on the next who-answer, asked at most each HUB_WHO_MS. A hello the relay verifies late (the
  token's Ed25519 is real work, outside the fake clock) is counted a who-answer before it is listed. The game is right:
  the list lags its count by one who-answer at most (SCALE5c). Reproduced by holding Beta's mint 30 ms. FIXED: the wait
  also asks that every list is as long as its count.

## Pins

`test/net/hiddenuncounted.test.js` (8, over the real relay), `test/server/hiddenuncounted_guild.test.js` (1, over the
real Worker), `test/net/scale5c.test.js`'s wiring pin. `tools/mutants/hiddenuncounted.json` - **24 mutations, 24 dead**.
Re-aimed by content: `acc3c.json`, `guild1c.json`, `guild1.json`, `guildseen.json` (4) and `scale5c.json` (2) - 9 of 9
dead; the account version's ten records, moved to acct183 - 10 of 10 dead.
