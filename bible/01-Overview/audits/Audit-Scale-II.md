# AUDIT SCALE II - the Scale arc past 2,000, audited before the merge, 2026-10-11

Mac: *"Lets do an audit on everything. Ensure perfection"*, of pull request #757 - every slice of THE PLAN PAST 2,000
(`11-Multiplayer/Scale-Arc.md`): SCALE4e, SCALE2c, SCALE4f (both parts), SCALE4g, SCALE4h, SCALE5b, SCALE5c (both parts)
and SCALE5d (both parts). Seven lenses over a frozen snapshot of the pushed head (`e729cea7`, a detached worktree; the
base `d9a3ced2` beside it), the tree not touched while they read (Home.md, 17l):

- **L, live in real workerd** (this session's own): the relay and the account service of the head stood up by wrangler
  4.149, driven by raw sockets, the account probe and the load harness;
- **A, the account service** (acct112); **R1, SCALE5b's relay half** (the second wire, the hygiene, the settings, the
  referee word); **R2, SCALE5c** (the hub and the region channels split, the bus); **R3, SCALE5d** (layers, a gate's
  court and its copies); **C, the client's halves**; **D, the record, the pins, the mutants and the measurements** - six
  independent adversarial reviewers, each told to reproduce every finding (a script against the real modules, or a run)
  before reporting it, and to say what it found sound.

Every finding below was reproduced on the snapshot. Every fix is pinned by a test that fails on the code as it stood
(`test/auditscale2_*.test.js`, run against a scratch copy of `e729cea7`), except where a row says the law already held
and its pin is proven by its mutant instead. Each fix carries an `AUDIT SCALE II <ID>` comment. Mutation-proven:
`tools/mutants/auditscale2_*.json`; every older record a fix moved was re-aimed by content and killed again.

## The live lane (L)

**Sound, live:** the relay boots in workerd (world192 on `/health` - AUDIT-ACC F2's class of break absent); a gate's
court took 256 signed sockets and the Worker walked the 257th and 258th into `gate:689#1` (welcome `ly: 1`, its crowd its
own), a copy's fighter's `in` joined the one fight (`st` through its copy, two fighters), the boss's four blows heard
alike in the court and both copy sockets; a cell's 257th socket walked into its layer 1, an ask for layer 3 landed there,
an ask for the full place walked on, a layer's pose heard by its layer-mate and never the place's crowd, nor the
place's in the layer; the account probe 46/46 over a migrated local D1 (the token's mint on a D1 session, the metrics'
wrapping in workerd's own D1); and the load harness's storm (60 bots, the relay restarted under them) on the second wire
end to end - 14.3 frames a bot-second in (102.2 on the first wire), 10.0 KB (22.1), 1,090,572 poses heard (1,097,128),
pose ages p50/p95/p99 54/78/94 ms (20/62/135: the batch's 50 ms), every bot back in its cell in 16.5 s.

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| L1 | High | **The description said the merge "runs no relay deploy" and world192 is "one announced drop, by hand".** `.github/workflows/relay-deploy.yml` deploys on every push to main whose RELAY_VERSION is not the live relay's (a siege's blackout aside): the merge IS the drop. | FIXED: the description, the record (SCALE5b, SCALE5c, the plan's deploys) and Active-Arcs say the merge drops every player once. |
| L2 | Medium | **The load harness could not boot the account service** - `tools/loadAccountEntry.mjs` exported only `default` while `wrangler.toml` binds ADMIT-LINE's AdmitGate (on main since #766). | FIXED: the entry exports every Durable Object class the service's own does; pinned against wrangler.toml. |
| L3 | Medium | The harness's setup made each guest in one POST and threw on ADMIT-LINE's `queue` - a fleet past the line's burst failed. | FIXED: it waits the told `wait` and asks again, as a player does. |
| L4 | High (design) | **ADMIT-LINE's line holds the token's mint at 5 a second** (burst 25): a relay deploy's reconnect is a mint a player, so the last of N online is minted at about (N - 25) / 5 s - 95 s at 500, 395 s at 2,000, half an hour at the arc's 10,000 - whatever SCALE2c spreads. And the minter read `queue` as a failure (2 s doubling to a minute), not the line's own `wait`. | FIXED, the client's half (L4a): a `queue` answer holds the next mint the line's own `wait`, never doubled. THE LINE'S RATE IS MAC'S (ADMIT-LINE was his own ask): raise ADMIT_RATE for a mint, or let a session already signed in pass the line. Recorded in SCALE2c. |
| L5 | Medium | **The arc's own harness measured neither SCALE5b nor SCALE2c**: its sessions offered no `w2` and each its own wave, and its tally read `{"t":"pose"` alone (live: 1,097,128 `pose` frames, no `poses`). | FIXED: one wave a bot, the second wire (a knob for the first), `poses` and `fb` read. The live figures above are its. |

## Lane A - the account service

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| A-1 = D-2 | High | **The mint ran from the tab's bookmark** - but no write route answers one, so a mint after the tab's own realm join could read a replica from before it: `rc` 0 (the relay's door word, which the client takes as final, the token reused a minute), or a lease since moved still signed `rc 1`. SCALE4d's own comment named the case; the record called it kept. | FIXED: the mint always starts at the primary (`PRIMARY_FIRST_ROUTES`). |
| A-2 | Medium | **A Sigil Broker sale whose answer was lost read itself back off a replica from before it**: the client handed the Sigil Stones back while the service kept the sale. | FIXED: a call that is no bookmark read forgets the page's bookmark as it goes and as it is answered, the realm's and the cloud saves' writes too - a tab's reads ride a replica only between its own writes. |
| A-3 | Medium | **The heartbeat's metrics read its body whole, unbounded, before any session** (AUDIT 68 X8 undone): a 64 MiB stranger's POST cost 325 MiB of the isolate. | FIXED: the parts are the route's word on the body it read, capped and behind the session. |
| A-4 | Low | A revoked session minted on a lagging replica. | FIXED for the mint by A-1 (401). The bookmark reads may answer it while a replica lags - seconds, recorded (SCALE4h, Revocation). |
| A-5 | Low | The day's Motherlodes could be picked off a stale replica and kept all day. | FIXED: picked on the primary. |
| A-6 = C-7 | Low | A service rolled back to acct111 (whose preflight refuses the header) failed every call of an open tab until it reloaded. | FIXED: offline, a body that never came, and a bookmark read answered with none forget it. |
| A-N1 to A-N4 | Nit | SCALE4d's doc off `replicaDb`; comments naming the folded reads; renown_char's rename (and prof9, prof10, prof12's); SCALE4f's "every minute" beside SCALE4h's coalescing. | FIXED. |

Sound, as reproduced: `realmMintFacts` the four reads it replaced over 60,000 random row states (0 differ); `mintMemberOf`
and its three consumers by keys and NULLs; the metrics' wrapping (each method on the real statement, a batch its real
statements, `first()` through `all()` the same query); the 503 a status alone; SCALE4e's retry (each migration file
atomic with its ledger row, 330 s over six asks); `last_seen` read finer than an hour by nothing; the hour's `room` at
every edge; acct112 everywhere; the deploy's path filter over the account Worker's whole import graph (249 files).

## Lane R1 - SCALE5b's relay half

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| R1-1 | Medium | A hello's welcome overwrote the cell's word of its referees (`_rfSaid`), so a referee that began before the next pose was never said to the halos already there - HALO-THIN went on thinning into a cell that judged them, for as long as a Wild zone fight lasts. | FIXED: the welcome tells its own socket alone; a moved word is said at a hello too. |
| R1-2 | Medium | Every boss beat awaited the hub for the settings - a slow hub froze a fight up to 5 s once a minute (AUDIT WB12d's rule: the hub is never awaited by a beat). | FIXED: asked, never awaited; the answer is the next beat's. |
| R1-3 | Medium | `slimPose` wrote a pitch the relay admits (past ~1.8e304) as `null`, which every second-wire reader refused - a modified client moved unseen on the second wire while the referees counted its hits. | FIXED: a value whose rounding overflows is kept. |
| R1-4 | Low | A relay setting was stored unvalidated and said to be in force (a pasted role mention: the herald pinged nobody; a bossBody missing `perS`: enforcement off). | FIXED: the hub takes a setting only as its consumers read it, and refuses one in words. |
| R1-5 = R3-12 | Low | `double13` ("refused `room full`") counted every layer the walk passed. | FIXED: the walk's last refusal alone (`x-df-last`). |
| R1-6 | Nit | "Byte for byte" (but for a cell's welcome's `rf`); RELAY_VERSION's comment named HALO_POSE_MS, gone; `double16` counts `own` frames too. | FIXED: the record and the comments. |
| R1-7 | Medium | **A shard kept a frame by its first key**, and JSON's last duplicate wins: `{"t":"pose","t":"chat",...}` ran as a line under the shard's own law - past a mute the bus applied, to every shard-mate. | FIXED: a kept frame parsed as anything but a hello, a ping or a pose goes to the bus as it came. |

## Lane R2 - SCALE5c

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| R2-1 | **Critical** | **Any account could take a shard player's peer id on the bus and close the player out of the game**: a hello on `chat:world` (a build from before the shards) naming the id with its own secret passed - a shard's hello kept the id's secret on the shard alone - and replaced the player's ShardSocket, its real socket closed `replaced` (taken by the client as for good); the same on a region's bus. Base refused it `id taken`. | FIXED: a shard's hello hands up the id's secret; the bus asks and keeps it as the hub always did. |
| R2-2 | High | A stranger on ANOTHER shard held the id beside the player; acts addressed by peer (a friend's request, an invite) went to the older holder. | FIXED: as R2-1 - refused `id taken` by the bus, the shard closing it. |
| R2-3 = C-1 = D-1 | High | The new client said `find` (the Guild tab every frame it is drawn, `/find`) to a relay without the shards, which closed the hub link `unknown message` - terminal, again and again. | FIXED (client): `findOk` from the relay's version. |
| R2-4 = R3-2 | High | A woken shard (or copy) forgot its own name: its sockets' frames waited for its alarm (a minute), and a last socket closing on a woken instance never handed its leave up (the player online for good). | FIXED: the name kept in its storage (HUB_KEY_KEY) and read back; the alarm kept while anything is owed. And (found re-running it) a woken shard said its own few as the hub's count in a leave: no count then, and every answer of the bus carries the hub's. |
| R2-5 | High | **A mute or a guild's removal did not hold for a shard's link**: the bus applied them to a ShardSocket in its memory alone; a reconnect on a token minted before, or the bus's own wake, put the player back. | FIXED: the bus applies its orders over a shard's hello, and tells the shard the law it changes (SHARD_LAW_KEYS), so a hello said again is the bus's word. |
| R2-6 | High | A woken bus dropped the first frame of every socket and every silent shard heard nothing it fanned until its sync, the count low meanwhile. | FIXED: a woken bus asks every shard it has heard from (VHUBS_KEY) to say its sockets now (HUB_INTERNAL_RESYNC); a frame it could not run is handed again behind its socket's hello. |
| R2-7 | Medium | One lost hand-up or delivery was lost for good - a world line, a hello's words; a close the bus decided never reached the shard, the link open and mute. | FIXED: every batch numbered under its sender's instance; one that did not land goes again as it was (a not-ok answer is a miss), one that landed twice runs once; a close a shard never heard is said again at its sync. |
| R2-8 | Medium | A reconnect was said as a leave and a join when a delivery for its old socket crossed it. | FIXED: a socket whose replacement or close is owed the bus is not reported gone. |
| R2-9 | Medium | A shard reset with no close said left its ShardSockets on the bus for good (online to friends, in the count). | FIXED: a shard silent HUB_SILENT_MS (three syncs) has its sockets let go. |
| R2-10 = C-2 | Medium | The client's fall back to the bus never fired in a browser (an error before the close). | FIXED (client). |
| R2-11 | Medium | "Never past the hub's largest frame" bounded a frame: one hand-up could be 32 MiB, a shard's queue unbounded. | FIXED: HUB_BATCH_BYTES (1 MiB) a hand-up, HUB_UP_QUEUE_BYTES (8 MiB) owed. |
| R2-12 | Low | One account's tab on the bus and another on a shard, one peer id: both seated. | FIXED: the newer replaces the older, as the hub's hello does. |
| R2-13 | Low | HUB_BATCH_MAX's doc said "either way". | FIXED: the doc. |

## Lane R3 - SCALE5d

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| R3-1 | **Critical** | **A court's copy ran a fight of its own** for any gate word not beginning with the exact bytes `{"t":"gate"` (another key order): one fighter's share of the boss, never beating back - killed alone in 96 s, its kill a receipt and the hub's `fell` to everyone online while the court's fight stood. | FIXED: a copy hands up the frames PARSED as gate words, written again `t` first, and never runs one (`courtHands` retired). |
| R3-3 | Medium | `?ly=k` gave anyone a private empty layer of any cell, building or dungeon; a serpent's fight split across layers (a layer's kill told the hub `fell`). | FIXED: an asked layer is the page's only while someone stands in it; no serpent, raid ledger, rite, overworld ledger or card table in a layer - every event is the place's; a layer's void of a card stake is spent by its place (`HOLDEM_INTERNAL_VOID`), which also closed an order seated in the place and voided in a layer, paid twice. |
| R3-4 | Medium | A mate's layer was asked in a NEIGHBOURING cell. | FIXED (client): its own cell alone. |
| R3-5 | Medium | A copy's hand-up had no gate and a 64 KiB cap where the court's door refuses past 16 KiB. | FIXED with R3-1: a copy's gate word is metered on the copy's own `gateGate` and capped as any frame there. |
| R3-6 | Medium | A woken court closed every copy watcher `the gate is sealed`. | FIXED: a hello said again is judged by the clock. |
| R3-7 | Low | `{"t":"gate","t":"chat",...}` crossed from a copy to the court's crowd. | FIXED with R3-1; and a court junks anything but a gate word from a copy's socket. |
| R3-8 | Low | A team parked in a layer was never dropped (a ghost wagon for 72 h). | FIXED: the registry keeps the layer. |
| R3-9 | Low | The hub's zone-hall wipe reached the place alone. | FIXED: every layer. |
| R3-10 | Low | A badge said again (AURA-LIVE) left the player's layer. | FIXED (client). |
| R3-11 | Low | A court hello whose judgement threw was held unjudged. | FIXED: judged before it is held; a throw is `busy`. |

## Lane C - the client

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| C-3 | Medium | A capped answer arriving just after the hour turned marked the NEW hour spent - every XP of it lost. | FIXED: the cap counts for the hour its report was sent in. |
| C-4 | Low | A held report crossed the hour into the next one's window: a player just under the bound lost XP. | FIXED: soon in the hour's last RENOWN_REPORT_MS. |
| C-5 | Low | The page's last word sent one region's pending. | FIXED: every region's, the held report last (a page restored from the back-forward cache sends it again as a repeat). |
| C-6 | Low | The hub's everyone-online and guild-online lists were never cleared. | FIXED. |
| C-7 | Low | The bookmark outlived a service that stopped saying one (a rollback): every call refused by its preflight. | FIXED (with A-6). |
| C-8 | Nit | THE FOUR HOSTS unnamed. | FIXED: named below. |
| C-2b | Medium | (found fixing C-2) **No page in a browser formed a reconnect wave**: an unclean close's `error` overwrote the status the drop was read from. | FIXED: the status as it was before the error. |

THE FOUR HOSTS (Home.md 17e), for every seam these slices wired: `scenes/world.js` holds the online session, its
links, the page's wave, the foes' quiet frame, the Renown tracker and the party's layer - wired. `scenes/exterior.js`
(the fixed city), `scenes/worldModes.js` (interiors) and `scenes/dungeonContext.js` (dungeons) open no session, link,
wave or tracker of their own (none of these seams appears in them): an interior and a dungeon run inside world.js's
session, whose rooms they are; the fixed city plays offline.

## Lane D - the record, the pins and the measurements

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| D-1 = C-1, D-2 = A-1 | High | As those rows. | FIXED there. |
| D-3 | Medium | A patch note said a party joins its leader's copy in a building or dungeon; only in the open air. | FIXED: the note. |
| D-4 | Medium | After the shards, SCALE2c's "costs no player a welcome" was the hub's arithmetic before them. | FIXED: the record weighs the shards and ADMIT-LINE's line (see L4). |
| D-5 | Medium | Two records marked equivalent are killed by pins that exist (wb12d's T-relay-hello-word-in-every-room, legacy7's dead-held-at-the-door). | FIXED: their killers named, `equivalent` dropped. |
| D-6 | Medium | hubShardBench's single samples: "flat to 10,000", a last hello against an average one. | FIXED: the record reads its sends, and its times as one run's. |
| D-7 | Medium | Unpinned laws a mutant changed: a socket that never opened is no drop; WAVE_SPREAD_MAX_MS; a ShardSocket greeted once; a hand-up's count bound. | PINNED. |
| D-8 | Low | Numbers the notes state with no pin (POSE_BATCH_MS, ROSTER_BATCH_MS, HUB_WHO_MS, HUB_SYNC_MS, HUB_BATCH_MS, HUB_UP_HZ_MAX); scale4h's fighter hour passing with its rise rule gone. | PINNED. |
| D-9 | Low | Figures that did not reproduce (the 5,000 row, 5,368 sends, the Season row, "about 4 statements", "five seconds later"); the bench's "tool copied in". | FIXED: the record says what the tools say. |
| D-10 | Low | Stale deploy and version text (acct106, acct108, world190, "one announced deploy each", "looks by hash" built). | FIXED. |
| D-11 | Nit | "Byte for byte" is frames, not bytes; "no longer than before"; "read copies near you". | FIXED: the record and the notes. |

## What it left, said

- **L4, the sign-in line's rate for a reconnect's mint** - Mac's (above).
- **A-4's read window** - a closed session's secret answered by the bookmark reads while a replica lags; its tokens
  still die within five minutes and the mint refuses it at once.
- **Layers, by design:** a party in a crowded building or dungeon is not held to one layer (the open air's party law
  alone); layers never merge back; a lone player's reconnect whose old socket the runtime has let go lands in the place
  (R3-3's empty-layer rule); a Wild zone fall's remains are its layer's; staff teleport reaches the place's crowd.
- **R2-13's other half:** the bus's batch to a shard is what it said that shard in HUB_BATCH_MS, uncapped - bounded by
  what the bus says, never by a client.
- **accountClient.js's "ONE DOOR TO THE SERVICE" doc** stands apart from `call` (SCALE4g's block between them): attached,
  its `@returns` would narrow `call`'s type for every reader of `why` and `seq`.
- **Considered, not reproduced** (the lanes' own): a woken court's census missing a copy's fighters until its resync
  (now one call, R2-6); a forged future bookmark (D1's refusal shape unknowable offline); a vid collision (the same id in
  one millisecond on one shard); batch poisoning (6,000 fuzzed frames through a shard never threw out of the bus); the
  first world192 drop's hop through the bus for every page (one token, no second mint).

## The pins and the mutants

| File | Tests | Mutants |
|---|---|---|
| `test/server/auditscale2_acct.test.js` - the account service, its doors, the load harness | 11 | `auditscale2_acct.json` 42, all dead |
| `test/net/auditscale2_bus.test.js` - the bus and its shards, a court and its copies | 12 | `auditscale2_bus.json` 45: 44 dead, 1 equivalent as recorded (a gate word handed up as parsed: parseClient writes every frame `t` first) |
| `test/net/auditscale2_client.test.js` - the client | 13 | `auditscale2_client.json` 38, all dead |
| `test/net/auditscale2_relay.test.js` - SCALE5b's and SCALE5d's relay halves | 12 | `auditscale2_relay.json` 44, all dead |

Every fix's pin was red on a scratch copy of `e729cea7`, but the number pins (D-8's) and D-7's, which hold laws that
already held - each proven by its mutants instead. PIN MOVED, each a pin that read a line a fix moved: scale5c (a woken
bus asks every shard, so it holds two; the find line; the relay's per-URL word), scale5d_court (`courtHands` retired),
scale2b (the calls between rooms 21 -> 23, 17 -> 19 on ROOM_CALL_MS: the resync and a layer's void), scale4g (the
bookmark forgotten by a secretless call), scale4h (the heartbeat's parts; the fighter's hour exact; the host's `soon`),
scale5b (the beat's ask never awaited), renown_char, prof9, prof10, prof12 (the acct112 history), relayversion
(world192 re-hashed over the merged tree). Re-aimed by content, every one dead: scale5c (nine), scale5a (two), rosterg,
soc1, scale5d_court (four - one retired with `courtHands`), scale5b (five), scale5d, hccpark (two), scale4g, scale4h
(three), auditcards6_d, marketaudit2, auditsilver, cards (two). D-5's two (wb12d's T-relay-hello-word-in-every-room,
legacy7's dead-held-at-the-door) no longer equivalent: their killers named.

