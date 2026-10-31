# AUDIT RPT1026 - FIELD BUGS 2026-10-26r read cold, 2026-10-27

The owner: *"Audit this"*, of pull request #1332 - FIELD BUGS 2026-10-26r (`bugs/Field-Bugs-2026-10-26r.md`), the 293
private reports of 10-18 to 10-26 read to their roots and 100 of them fixed in twelve lanes. Thirteen cold lanes read the
batch at its head `2dc8f31a2`, one for each fixing lane and one for the record and the integration, each in its own
worktree, each given its lane's commits and files and one brief (what to hunt, how to prove it, how to pin it), never a
conclusion; each finding was proven on the real code - a probe, or a test that fails at the head - before it was reported.

| Lane | Read | Found |
|---|---|---|
| A | SECNET: recovery against a concurrent change and sign-in, the block's stamp, the act's welcome, the stalled line (the real account service over its migrations; the real relay Room bridged to the real session, the line held both ways) | 5 |
| B | CHESTGOLD and CARDBANK: the shared chest's settle law and both skins' windows (the account worker over SQLite and the realm session over it, a settle's answer dropped; the classic window and the enhanced pack over the chest's own spec, items from their minters) | 6 |
| C | LEDGERLAW: the craft record's hand-over, staff's excuse, the own mends, the stolen tag (the real Worker over node:sqlite: a sword made at the anvil, sold, traded, listed, checkpointed past the grace, held and cleared) | 6 |
| D | MARKET: the arrivals, the collect's repeat, the holds' and the walls' words, the trader's look (the account Worker with R2, the realm session, 465 minted rare and legendary pieces listed and received, an old service faked) | 4 |
| E | FIGHTS: the bosses' shares, the halls' spells, the unveiling blow, the party's soul traps, the dungeon's windows (the Hour and the Ketch as real relay Rooms, the real weapon rig, the cast engine over two pools) | 4 |
| F | PROGRESS: mastery's practice, the wards, the bare summons, Identify, the souls, Cast When Used, the journey's training (a made character through the skill law and the save, the one cast engine, the item maker, the Skull of Corruption off MAGIC.DEF) | 7 |
| G | ITEMS: the counter's held lot, the loot pile's words, the rarity piece kept, the capped foes frame (both trade counters, the save and the realm judge, the room loot for three clients, the foes frame for a host and a joiner) | 6 |
| H | QUESTS: abandon, the crowd, the No, the zone, the arena, the catalogue, the bounty (DFU's own scripts through the real machine, bridge and questlines; the pause window's Quests tab; MAPS.BSA and the zone's mask) | 5 |
| I | EVENTS: the Ketch's owed blows, the Spire, the voices, the gate's way, the Orrery, the crowd's kin (the real voyage; the realm's own Orrery judge against one to eight griefers; the audio engine over the crowd's own producer) | 2 |
| J | WORLD: the boats, the traffic, the dark room, the wagon, the banners, the rain, the causeway, the low face, the far quays, the decorator (the interior build, five towns raycast through the real collider, the naval host, BLOCKS.BSA's 9,005 rooms) | 3 |
| K | CLIENT: the sparks, the Dismiss, the Weir face, the frame ceiling, the peers' shake, pointer capture, the lost graphics (the find with the host's own door, main.js's crash handler, the cast engine, the frame pacer, a sweep of `src/`) | 5 |
| L | MISC: the screens, the phones, the bed, the heir, the giants, the cast (the Bank and the talk window in Chromium at ten sizes, both ways up; the bed through the real interior host) | 6 |
| M | the record and the integration: every row against its section, every ALREADY FIXED's commit, the merge of main, the version bumps and migration 0178, the locales, every line the batch added and every line its commits added, the patch notes bullet by bullet | 9 |

68 found. Every defect is fixed or its record corrected; each fix in code carries an `AUDIT RPT1026 <id>` comment and is
pinned by a test that fails on the code as it stood (`test/**/audit_rpt1026_*.test.js`, 21 files), with mutants the
pins kill in `tools/mutants/audit_rpt1026_*.json` (130 records, all dead). The batch's own `rpt1026_*.json` lists were
run again over the merged branch with them.

The one that mattered most was B1: **the shared chest's window let anyone with a home duplicate.** The batch routed the
classic window's commit through the chest's own copy of the pack and refused the wagon, the bag and the floor from it,
but a Use, a Salvage or a Dismantle worked on that copy alone - a potion drunk off the chest's list stayed in the chest, a
rare blade salvaged kept the blade and paid its shards - on any shared chest, the owner's own shared with nobody, on both
skins. Then the batch's own regressions: a seller who kept a piece they sold could win it back through an accomplice's
trade (C1 - the hand-over moved the record whoever gave the piece); a piece staff had cleared, moved through a vault for
one checkpoint, held its owner again with a strike (C2); a guest's kept hold locked an owner out of their own chest for
good (B2); a fight on a stalled line still closed the socket for good (A1); the Orrery's fix let one griefer stop a team
that had learned the puzzle (I1); a No made a choice in three questline quests (H1); a purchase pressed while a sweep ran
never arrived (D1); a self-cast absorb at a full pool killed its caster (F3 - #286, which the batch had answered AS
DESIGNED). On phones, the Bank's keypad entry opened behind the Bank (L1) and the sideways talk window broke under 720 px
(L2). And the record's own tally was not its rows' (M1), and the tree still carried report wording in places (M2).

## What the audit moved

- **Verdicts.** #277 FIXED to NEEDS DATA (G2: an elite dungeon is online, where magic repairs are on, so RARE-KEPT's door
  never broke anything there); #286 AS DESIGNED to FIXED (F3); the head's tally counted from the rows (M1, M3). The
  record counts 103 fixed, 67 already fixed, 46 as designed, 26 not reproduced, 38 needing data, 10 staff, 3 withdrawn.
- **The services.** ACCOUNT_VERSION acct198 (undeployed; acct197 until main's FIELD BUGS 2026-10-26d took that number)
  carries the audit's account changes - A3, B2, B3, C1, C2, C5, and the shared law it bundles under F1 and F3; no new
  migration (0178's own words only). RELAY_VERSION is world272 - main's CHAT-POST took world270 and its MASTER-THREE
  world271 while the batch waited, and the batch renumbered past both - and carries I1's `sdBrain.js` and F1's
  `masterSkills.js`; SLAM8's row is the merged graph's hash. The lanes' own notes below name the numbers they read.
- **The patch notes** (the pull request's description): the last section.

Each lane below: what it read and drove, then its findings, then what it suspects and what it found sound.

## A - SECNET

Lane A read RPT1026-SECNET (`276481e9d`) at the batch head `2dc8f31a2`: RECOVERY HOLDS (104), BLOCK STAMP (107), ACT
WAITS (102), LINE-STALL (91), the shared session fake's ping answer, and the lane's verdicts on 232, 236 and 91. The
readers drove the real account service over the real migrations, with a database that holds one request between two of
its statements while another runs whole. They drove the real relay Room (`test/fakeRoom.mjs`, real tokens) bridged to the
real `OnlineSession`, with the line held both ways and the runtime's ping answer in front of the room, and the real
`createChatSafetyHost` over the session. They read it as an attacker and as an honest player on a bad line would.

Five found: A1, A3 and A5 fixed in code, and A2 and A4 fixed in the record. Each fix carries an `AUDIT RPT1026 <id>`
comment. Each is pinned by a test that fails on the head, with mutants in `tools/mutants/audit_rpt1026_secnet.json` (5,
all dead).
`tools/mutants/rpt1026_secnet.json` was judged again whole: 34 dead, 1 recorded equivalent (A2).

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| A1 | **A fight on a stalled line still struck out.** LINE-STALL held a stalled line's poses and foes streams, but a blow spends the relay's POSE meter (`server/src/index.js`, the hit arm's `_meter`). At the session's own blow rate (HIT_HZ_MAX 10, which a quick fighter among several foes reaches, `net/hitPend.js`'s header) a held fight handed the line 20 frames a second on that meter. A cell fight held 15 s handed it 89 poses and 150 blows, and the relay closed the socket "too many poses", CLOSE_POLICY, terminal. That is the report's symptom, on the commonest honest path after walking. | `sendHit` refuses on a stalled line (`_stalled`), on both the cell route and the world room's. A refused blow waits in its queue, which ages it out after 2 s, the queue's own law. The fight's burst before the stall is known is about 100 poses and 110 blows, under the 220 strike-out. | `test/net/audit_rpt1026_secnet.test.js` A1: a fight through the real Room held 30 s from the moment the line was last heard (the socket stands, and a blow after the answer reaches the foe's owner); a world room's blow at the host on a dead line; the arithmetic with the blows. Mutants AUDIT-RPT1026-A1-blow-never-held, -stall-wait-doubled (the walk-only arithmetic let LINE_STALL_MS double) |
| A2 | **The block's fallback to "the account the room's roster said" has no producer.** A place room's welcome roster (`rosterFor`) and its joins never name an account (MOD1). Driven through the real Room, both peers stood in the session carry `sub` null. So against a relay before the stamp, a player who blocks anyone hears no trade or page from anyone, a sender who is not blocked included. The record and the code comment said the roster's account stands in. RPT1026-SECNET's pin case and its mutant (client-roster-never-asked) stood on a hand-built welcome naming each peer's account (TEST THE SHAPE THE PRODUCER MINTS). | No behaviour change. The record (BLOCK STAMP, its PINS), `Chat-Safety-Arc.md` section 2 and the `_directedIn` comment now say what happens. The hand-built case is gone (PIN MOVED). The mutant is recorded `equivalent` with its why, and the fallback is kept as a belt for a roster that names one. | `test/net/audit_rpt1026_secnet.test.js` A2 (the real Room's roster and join; a request with no account held back from every sender while anyone is blocked, heard while nobody is; the relay's stamped frame asked by its account) |
| A3 | **Of two recoveries, the first one's sign-out deleted the second one's session.** The first recovery (one of the set's codes) was held at its sign-out of every device while the second (another code) ran whole and was answered 200 with a session. The first sign-out, by the account's id alone, then deleted that session, so the owner was answered "in" and was signed out at once. RECOVERY HOLDS guarded the recovery's INSERT (the first hears `codes-moved`) and missed its DELETE. | The recovery's sign-out stands on the password it wrote (`... AND EXISTS (SELECT 1 FROM players WHERE id = ? AND password = ?)`), the law the change's sign-out already keeps. Every device from before the second recovery is gone by the second's own sign-out, and nothing since stands on any password but the second's. `acc1c.json` ACC1c-11 is re-aimed by content. | `test/server/audit_rpt1026_secnet_acct.test.js` A3 (the race, and a recovery alone still signing out every device). Mutant AUDIT-RPT1026-A3-recovery-signout-by-id |
| A4 | Record: LINE-STALL's arc text listed "a blow" among the events "far under their own meters", and its proof said "with ACT WAITS, every policy refusal a bad line could draw from an honest page is closed". A blow is on the pose meter (A1). The other own-meter streams were not judged (S1). | `Online-Arc.md` LINE-STALL and the record's LINE-STALL section rewritten: the blows held, the arithmetic with them, and the claim narrowed to a walk, a host's streams and a fight. | the docs, beside A1's pins |
| A5 | **ACT WAITS left two sends that skip the welcome after a rehello.** The record says the other world-room senders wait on "a flag reset at the hello (`host` for the world and the hit ...)". An AURA-LIVE rehello (an aura or a name chosen, `scenes/world.js` auraFrame and nameAsFrame) does not reset `host`. Its replacement socket stands for the room from its hello on (`_promote`), its host kept from the welcome before. At the owner's instance, with the member's yes gone stale and the hub slow, the member's blow at the owner's foe went down the replacement ahead of its welcome. The room refused it "hit before hello", CLOSE_POLICY, terminal: report 102's symptom by its sibling path. A member who hosts sent the room's memory the same way ("world before hello"). | `sendHit`'s world-room path and `sendWorld` ask the socket's welcome. A refused blow waits in its queue. The memory goes again after the welcome, because `worldPublish`'s key holds `online.welcomes`. | `test/net/audit_rpt1026_secnet.test.js` A5 (through the real Room with the hub held, a rehello: the blow, and as host the memory, wait, go after the welcome, and the socket stands). Mutants AUDIT-RPT1026-A5-world-blow-unwelcomed, -memory-unwelcomed |

### Suspected (A)

- **S1: the other own-meter streams on a held line.** These are not held: a boss court's gate frames (GATE_HZ_MAX 28 at
  home, DROP_STRIKES_MAX strikes), a duel's blows (DUEL_HZ_MAX 10), the open zone's words (WILD_HZ_MAX 12), and a
  channel's chat lines (CHAT_STRIKES_MAX 20, on a link with no presence and so no deaf ping). A page that sends at its home
  rate for (cap + strikes) / rate seconds of one stall would strike out. What would prove it: the per-second rate an honest
  fighter's page really sends of each, recorded through the real host. Then, at that rate, a held-line run through the
  real Room.
- **S2: a stall in one direction only is never known.** The deaf ping fires only on a socket that has heard nothing for
  PING_MS. A socket whose peers' frames keep arriving while its own upstream is held never pings, so it is never
  stalled, and its poses and blows burst as before. What would prove it: a capture of a lossy uplink with a live downlink.
  The fix would ask the line every PING_MS while it says poses, whatever it has heard.
- **S3: the relay token's mint reads a replica.** `/v1/auth/token` is in REPLICA_ROUTES. A replica that has not yet heard
  the recovery's sign-out still finds the thief's session and mints a token, good for MAX_TTL_S. An open relay socket is
  never closed by a recovery: only a ban and a mute are pushed (`pushLaw`). The record's SEEN, NOT CHANGED names only the
  hot routes' pass. What would prove it: D1's replica lag measured against a recovery, and `resolveSession` driven on a
  stale replica.

### Read and found sound (A)

- `changePassword`: the write on the password it checked and its own session, the refusal `bad-login`, and the sign-out
  only while the password is its own. Every order of a change against a recovery, a sign-out everywhere and a second
  change was driven. An honest change that races its own account's first rehash is refused once, and a retry lands.
- `login`: the rehash on the hash it verified, the session on the hash held, and the row asked again once. A thief's
  sign-in under way at the recovery opens nothing, and two honest sign-ins at once both get in.
- `openSession`'s guard and `/v1/auth/session`'s 401 `auth`: a device signed out admits nobody, by recovery or by "sign
  out everywhere". An old client reads 401 as signed out, which it is.
- `recover`'s session on its own password (`codes-moved`), and the rate and ban doors unchanged.
- The relay's `_directedFrame`: the account comes from the verified token alone, and a modified client's `sub` is never
  read. An old client checks the stamped account too. The trade fan-out past TRADE_FRAME_MAX meets only INBOUND_FRAME_MAX.
- `hears(null)` is reached from `_directedIn` alone (ChatLog and SocialState ask only for a string).
- ACT WAITS: `sendAct` on `welcomed`. A refused door stays in `_actPend` and `actFlush` sends it every frame after the
  welcome. A rest's ask that is refused is asked again at the next hour. `sendDuel`'s bout room, `sendWild` and
  `sendHit`'s cell loop each wait. With A5, every other world-room sender at an instance waits for the welcome, or for a
  flag that a hello or a rehello's promotion resets (`ownOk`, `grantMode`). The readers checked each one.
- LINE-STALL's ear: heard at the open and at every frame, asked at the first unanswered ping, and the halos' pings on
  their own clock. The auto-response is set in every Room's constructor, the only class a socket reaches, and there is no
  node relay. A tab in the background cannot fall into a false stall, because the ask starts the clock.
- The shared fake (`test/fakeSocket.mjs`): it answers only the runtime's exact ping, and the pong reaches no handler but
  `stats.received`. The PIN MOVED pins were read again. halothin feeds its own cell pongs so its subject, the halos' own
  clock, stands. No other test leans on a silent line.
- Verdicts. #232 ALREADY FIXED is right: `594830855` reached main in #1280 (`34584a5c0`, 22:12 UTC on 10-25), after the
  report's 06:04. #236 NOT REPRODUCED is right as traced: the dungeon teleporter is a motor warp, and a dungeon's room is
  named by its identity, not by the place under the player. #91 FIXED was partial for a fight (A1), and is complete with
  it for a walk, a host and a fight (S1 open).

The relay's bundle is unchanged (`test/net/relayversion.test.js` green). The account service changed
(`server-account/src/accounts.js` `recover`). No migration is needed, and no player-facing words were added.

Branch its branch, commits `2f9c8c0dd` and `da2221a88` on the batch head `2dc8f31a2`.

The A5 pin was made deterministic in `da2221a88`. It had failed 4 of 12 parallel runs because its hub stub counted every
ask the room made of the hub. LEASE1's ask for the relay's settings, made off the member's earlier frame and still in
flight under load, was counted as the rehello's party ask, so the wait ended before the replacement was promoted. The
cause was in the test alone. The pin now counts only the party ask, mints its tokens before, and waits on the room's
own reading of each frame instead of on time. It passed 24 and 36 parallel runs of the pin and 16 of the whole file.
Its mutants still die.

## B - CHESTGOLD

Read the lane's seven commits (`586e66c43`, `05de3e52f`, `52dcf96f4`, `f71b08fc6`, `0baa82c00`, `4aec9ed12`,
`fc4f07125`) and the code as it stands at the head, and drove the real producers: the account worker over SQLite
(`decorUse` - list, hold, settle, set), the realm session itself over it (`createRealmSession` + `realmIo`, its checkpoint
the realm's PUT, `realmGoldAct` as the host runs it, a settle's answer dropped on the way back), the host's door
(`bindDecorHouseFrom`), the classic window (`NativeInventoryWindow`) and the enhanced pack (`mountEnhancedInventory` over
invdrag's DOM) over the chest's own spec with the host's doors under it, items from their minters (`createPotion`,
`createWeapon` + `applyRarity`, `brokerStock`, `welkyndShards`, `sigilStone`, `goldStack`), and `calculateTradePrice` over
the Orcish greaves. The batch's 36 mutants were re-run at the head: all dead.

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| B1 | **critical - a chest window's other acts duplicated, with no wait and no friend.** The window's pack is its copy until the close (`draft`), and the chest's list the window's until the settle; the batch closed the wagon, the bag and the floor, and left every other act that takes a piece out of a list. A Use (a potion drunk, a meal eaten) off the pack or off the chest's own list took it out of that list alone - the character's pack, or the chest's bin, kept it; a Salvage, the batch salvage and a Dismantle kept the piece and put the shards / embers onto the stack the pack shares (`addItem` merges into the shared object). Probed: the potion drunk and still in the pack and in the record; the chest's potion drunk and still in the bin; a rare blade salvaged, kept, and the saved shards 4 -> 7. Every opening of a chest the player shares - their own, shared with nobody, counts. Both skins. | `inventorySession.js` chestActRefusal / CHEST_ACT_REFUSAL ("Shut the chest before you do that.", `inventory.store.chestAct`, 25 languages); the classic `_use`, the enhanced `use`, `askSalvage`, `askSalvageMany`, `askDismantle` refuse in a window over a store that settles its own pieces. Ledger A row narrowed (UseItem refused there). | `audit_rpt1026_chestgold.test.js` B1 x2 (classic: both lists, and a window over anything else still drinks; enhanced: Use, Salvage, Dismantle, Batch salvage pressed on the real card) |
| B2 | **major - a guest who kept the hold shut the owner out for good.** RPT1026-CHESTGOLD refused the owner's access change under another's live hold, and made a hold keepable for as long as its window asks (`op: 'hold'`). A client asking every 170 s kept it for half an hour and more (probed: 12 keeps over 34 minutes, the owner's Private and the owner's own open `decor-busy` every time); with goods in the bin the chest could not be removed (`decor-holds`) nor the house sold (`home-holds`). The batch had taken away the owner's one remedy (revoking the guest). | moveChest's guard removed - the owner always may (`decorAccess.js` header's own law). What it guarded holds without it: a window of this build pays its purse only with a landed settle, a settle the change shut is refused (`decor-shut`) and moves nothing, the pour takes only the bin it read. An older window's Private trigger is now its run-out's twin (LEFT AS IT IS). | `audit_rpt1026_chestgold.test.js` B2 (ten keeps, the owner's Private lands, the guest's keep refused after, its close moves nothing, the piece the owner's once); PIN MOVED in `rpt1026_chestgold.test.js` |
| B3 | **minor - a settle whose answer was lost was never read as landed.** decorSettle asked access and its hold before the record (AUDIT REALM L1-F2), and the landed batch had released the hold: the retry answered `decor-busy`, the window said someone else was using the chest, the purse went unpaid, and the next checkpoint found the record one on and ended the session (the join read the right record - no gold lost or made). The record's "or a lost answer's record moved one step" was false for this act. | `realmActFirst` at the top of decorSettle: a retry one on is `seq`, read as this settle landed. | `audit_rpt1026_chestgold.test.js` B3 (the real realm session; the answer dropped once) |
| B4 | **minor - a piece taken this window was worn from the pack.** The batch stopped an Equip-mode take wearing; a Remove and then an Equip (classic) or Wear (enhanced) did it anyway. After a refused close the doll wore a piece the chest still held and the pack never had (a ghost until the next load). | chestActRefusal's `wear` arm: a piece the character's pack does not hold is refused; the character's own still wears. | `audit_rpt1026_chestgold.test.js` B4 (both skins; the own piece worn) |
| B5 | **major - a map read itself out of the window's lists.** TransferItem's map arm (reveal and consume) ran on a take off the chest and a put into it: the reveal happened and the map stayed in the bin (or the pack). Probed: revealed, bin still holding it. Refusing it would have shut maps in shared chests for good. | Over such a store a map moves as a piece both ways (read from the pack once shut) - the four map arms skip the interception there. Ledger A narrowed. | `audit_rpt1026_chestgold.test.js` B5 (classic take and put, enhanced take and Store) |
| B6 | record - the record quoted a report's own word for its sum (245, twice). | Paraphrased. | - |

Mutants: `tools/mutants/audit_rpt1026_chestgold.json`, 17 records, all dead; the batch's `CHESTGOLD-svc-pour-under-guest`
retired (B2's record is its inverse), its other 35 re-run with the fixes in: all dead (52 of 52). Each of the six new
pins fails at `2dc8f31a2` for its own reason (the refusal absent, the piece worn, the map read, the owner `decor-busy`,
the purse 1,000 not 1,250). PINS MOVED: `rpt1026_chestgold.test.js` (the owner's Private under a guest's window lands);
`enhancedInventory.test.js` and `audit26_economy.test.js` (the map arms' source text). Checked: lint, types, the seven
bible gates (73 pass), and the 233 test files that import or name the files changed (2,510 tests, 0 fail).

Not covered by B1, and harmless: hanging an unlit lantern at the belt in a chest window sets the flag and then has its
light refused (the light toggle is a Use).

### Suspected (B)

- S1. An honest guest's window open longer than 180 s with no move in the last stretch still closes `decor-lapsed`
  (keepHeld runs only on a move, never on a timer or at the close). Not a loss - the close moves nothing and says so - but
  a long read of a full chest undoes its moves. Proven by: a window that moves at 0 s and closes at 200 s.
- S2. CARDBANK's words reach the player only from an answered claim: a cash-out whose answer is lost ends the session,
  and the claim after the join is the service's `repeat`, which says nothing - that stake comes home silently, as the
  report's did. Proven by: a claim whose first answer is dropped, then a rejoin and a second claim.
- S3. The bank half of 245: the trace is credible (no door multiplies an account), but the house bought "without the
  money" is most simply the bank's sum being spent; only the service's rows prove where the sum came from.

### Read and found sound (B)

- The pile law (`itemTransfer.js` pileCoins): a chest's pile lands as a pile in both windows; every other list keeps
  DFU's gold arm. Mutants re-run, dead.
- decorSettle's `purse`: refused when not a safe non-negative integer, refused when it is not the bin's count as it stands
  (takes and cuts), paid in the settle's own batch by `creditSave` (witnessed, INT5); unsaid, the old law - nothing paid.
  A modified client gets no more than the bin holds.
- keepHold / holdLost: only a live hold of the same player and character is kept; a lapsed one answers `decor-lapsed`,
  another's `decor-busy`; the window stops moving once told.
- moveChest's as-read pour: each row deleted as read (uid and text, `mustChange`), a row added since refuses the batch -
  a guest's settle on either side of the pour cannot be in two places.
- The put-back law (a piece taken and put back undoes its take; a cut rejoins its stack) and the part-of-a-put law.
- The classic window's `_held` routing, its Equip-mode take, its shut gold field; both skins' wagon / bag ladders and the
  chest's `dropRefusal` (now beside B1's law).
- Old client against the new service (no `hold`, no `purse`: answered as before, `decor-lapsed` falls to the generic
  words); new client against the old service (`hold` answered `bad-decor` and ignored; the purse paid by `apply`, the
  next checkpoint carries it).
- CARDBANK: `claim(say)` at both host claims, said once per paid receipt, never for a repeat; the Empire's one account
  (`realmWallet.bank`), so "the Bank of the Empire" is true; the 25 drafts keep `{gold, number}`.
- 133 AS DESIGNED: Greaves base 80 x 3 x 256 = 61,440; the online counter pays 6,215 to 14,955 for a plain pair across
  quality 1-20 and Mercantile 5-100 - 23,000 is a graded or enchanted pair.
- 58 AS DESIGNED: 129,000 coins weigh 322.5 kg; MaxEncumbrance is Strength x 1.5 (150 kg at 100), so it is a letter;
  "Deposit letters" exists on both skins' bank.
- 12 ALREADY FIXED (TRADE-WRAP, 0.0.249 after the report's 0.0.235): the counter's price is a float division; no int32
  step stands on a sale's gold. 28 ALREADY FIXED: the same report, answered in 2026-10-18b.
- No host grew; no report quoted (but B6) and no player named in the lane's files.

Branch its branch, commit `18b12742d` on `2dc8f31a2`. Relay bundle untouched. Account service changed (`server-account/src/decorAccess.js`:
moveChest, decorSettle) - deploy it with the client; no migration.

## C - LEDGERLAW

Read at `2dc8f31a2` (the batch head) - the lane's five commits and the code as it stands - and fixed (`ccbb25c7c` C1-C3 and C5, `1e75ff51f` C4 and C6): the account service driven through
the real Worker over node:sqlite with every migration applied (`test/accountDb.mjs`, `test/realmSeat.mjs`) - a sword made
at the real anvil (`profBook.js` craft, `mintPieces`), sold on the market's piece route for Drakes and for gold, traded
through `/v1/realm/trade`, listed from the pack and collected (`/v1/market/list|buy|collect`), checkpointed through
`PUT /v1/realm/:id/data` past `DUPE_GRACE_S`, held and cleared through `/v1/mod/realm-clear`; the own mends through the
real kit, wear and smith (`repairKitUse`, `lowerCondition`, `repairWhole`, `repairJobsAt`) and every write of a piece's
condition in `src/` grepped; the stolen mark through the theft's own law (`takenFromKeeping`), a real `TradeSession` and
the real player-trade window over the trade pins' fake DOM.

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| C1 | **A seller that kept a piece it sold won it back with one service move** (major, a regression of the batch). `ledgerMoves` wrote `products.handed_to` on every move of a crafted piece into a record, whoever gave it. A piece-route sale (a Drakes or gold buy, an auction won, a commission filled) lets the ledger's row go and mints the buyer's piece at its pack, so a seller whose modified client kept the piece holds the row first; one realm trade of it to an accomplice, one listing of it from the pack an accomplice bought and collected (or, by the same escrow route, a vault's round trip) named the accomplice the craft's record, and past the grace the BUYER's claim was the copy - Bea's piece locked, Zed's kept, Mac paid. INT19 had given it to the buyer. Read on the same statement (not driven): a griefer's forged copy, taken up while its owner set the piece down, was the record after one vault round trip. | The hand-over moves the record only from the account it names: `from` (the trade's other side, `realmTrade.js`) or the account the escrow row names (read before the insert takes the row) - `ledger.js:"AND COALESCE(handed_to, owner)"`. The report's own steps, the market's pack route, the hand-back and the fill read as before. LEFT OPEN narrowed in the record and the arc: a hand-to-hand move moves no record, and neither does a service move by the holder it gave. | `test/server/audit_rpt1026_ledgerlaw.test.js` C1 (3: the trade to an accomplice, the listing collected by one, either side of a trade handing on) - fails at the head, passes with the fix |
| C2 | **A piece staff excused held its holder again, with a strike, after one checkpoint without it** (major, a regression of the batch). The batch ended EVERY excuse at a clean checkpoint, so an item-law finding staff judged wrong was lost the moment the piece sat in a vault, a listing or a trade for one checkpoint - taken back, held and struck. The record said "a finding of pieces alone keeps its signature as every excuse was". | The clean checkpoint ends only an excuse of the character law's values (`verdict.js` verdictWrite, `instr(law_excused, '\|')`); a piece's stands, as every excuse did before the batch. | `audit_rpt1026_ledgerlaw.test.js` C2 (a condition-past-its-most longsword cleared, put away, taken back: no hold, no strike; a purse's excuse still ends) - fails at the head |
| C3 | The clear's words and the record said what the code does not (record). `realmReview.mjs` USAGE: "a change, or a clean checkpoint, ends it" - a change ends nothing: a checkpoint back at the state staff read is excused again (driven: -8M cleared, 9e15 held, -8M unheld). The record: "a finding's change of value is no new strike" - the state leaving an excuse is a strike; and a pre-deploy excuse re-held at the same purse is a strike, unsaid. | USAGE and the tool's header say it: any other state holds again; a clean checkpoint ends a character finding's excuse, a piece's stands. The record's EXCUSE-VALUES and Integrity-Arc say the strike and the return. | `audit_rpt1026_ledgerlaw.test.js` C3 (the words) |
| C4 | **A stolen piece another player held out in a trade read like any other** (minor, a sibling path STOLEN-SAID left). The theft rides the realm trade's wire (`itemFields.js` `stolen`), and the window two players trade in named it nowhere - its buyer takes the court's risk and a counter that destroys it, as on the market. | The other player's offered row says "Stolen" and its strip the card's line (`ui/enhanced/enhancedPlayerTrade.js`; the window keeps its own face over either skin). The batch's two keys, no new words. | `test/ui/audit_rpt1026_ledgerlaw_trade.test.js` C4 - fails at the head |
| C5 | **A state whose values passed the cut was excused for any value past it** (minor: staff must clear an absurd state). `lawValuesOf` cut the values at 1,000 characters and each at 40, silently, and the sort puts every bank finding ahead of the purse: eighty bank accounts below nothing ahead of a purse of -8,000,000 read the same string as with 9e15, and after a clear 9e15 passed on the real Worker. | A cut is marked (`judge.js:"export const LAW_VALUES_CUT"`) and `lawExcused` names no cut state: staff mend it (PURSE-MEND, STAFF-SET-BANK). Held, never struck for it. | `audit_rpt1026_ledgerlaw.test.js` C5 (pure and on the Worker) - fails at the head |
| C6 | The record and Standing-Arc cited the trader's look at `vendorHost.js` vendorItemStats; a later merge moved it to `systems/item/itemLook.js` itemLookRows (record). | Both say where it is. | - |

Every fix carries an `AUDIT RPT1026 Cn` comment. Mutants: `tools/mutants/audit_rpt1026_ledgerlaw.json` - 10, all dead; four
records the fixes moved re-aimed by content (`rpt1026_ledgerlaw.json` the clean checkpoint's end, the value's cut and the
excuse's compare; `fb1025i_daedraheart.json` the trade row's quest word); the batch's 24 run again, all dead, and every
other record on a file this lane changed (143, from `int_audit`, `autohold`, `int2`, `realm4`, `tradevirt` and the rest),
all dead. PIN MOVED: `fb1011_tradeloc` TRADE-LOC II reads the trade row's stolen word. Services: the account service
changed (`ledger.js`, `realmTrade.js`, `verdict.js`, `judge.js`; comments in `review.js` and migration 0178's header) - no
new migration, no version bump; the relay's bundle is untouched. No new words (the batch's `stolen.tag` and
`stolen.card`; `l10nExtract` moves nothing), so no drafts are owed.

Run: lint, types, the bible gates and `hostceiling` green; `test:changed` against the batch head (492 files): 4,104 of
4,106 - `fb1009_yardfoot` fails the same way at the batch head (2,842 houses' steps read inside, not this lane's) and
`staffpanel1`'s signed-second pin read 301 s under the run's load and passes alone. The vault's round trip in C1 is
the listing's escrow route (the same statement), not driven separately.

### Suspected (C)

- **S1 - the clear excuses the values of the last judgement, which no finding shows when they moved while held.** A held
  character's checkpoint on the same signature writes no finding (`verdict.js` - `rising` is false while held), so a
  modified client held at -8,000,000 that checkpoints 9e15 next leaves the findings list naming -8,000,000, and staff's
  Unfreeze excuses 9e15 (`review.js` clear reads `law_v` off the row). The findings answer does carry the record's purse
  (`character.purse`), so it turns on what staff read. What would prove it: the Staff Panel's profile drawn over that row -
  if it shows the finding's values and not the purse, write a finding when the values move while held, or let the clear
  name the values it excuses and refuse one that moved.
- **S2 - the owner's exemption hands a buyer's piece to its maker in a window.** `ledgerStep` never upholds against the
  owner holding the piece, so a buyer whose checkpoint shows the piece gone (set on the ground, sold to a counter) while
  its maker's written-back copy still claims it moves the row to the maker for good. Recorded now in LEFT OPEN; what would
  prove it matters: how often a realm trade's buyer checkpoints without the piece inside `DUPE_GRACE_S` of the maker's claim
  (a vault or a listing clears the claim, so only a peer channel or a counter opens it).

### Read and found sound (C)

- CRAFT-HANDED, the report's own path: the trade writes the hand-over, the maker's written-back sword is the claimant's
  copy, the buyer passes it on; the MARKET-ANY collect, the hand-back to the owner, the sale's and the fill's clear all
  read right (the batch's four pins pass under C1's rule). A `products` row from before reads `handed_to` NULL, its owner's
  as before; migration 0178 is numbered past 0177 and nothing pins its text.
- EXCUSE-VALUES' core: `lawValuesOf`, `lawExcuseOf`, the clear's SQL, `lawStands` and `rising` read the excuse one way; a
  pre-deploy excuse of pieces stands and one of a character finding holds again (now said with its strike).
- MEND-SPENT: every rise of a found piece's condition spends first - the kit, the Repairs Objects ring and the Varla Stone
  through `creditOwnMend(it, was)`, the counter's and the keyed InstantRepairs arms and the finished job through
  `repairWhole`; no other write of `currentCondition` in `src/` raises a found piece (mints, repools and tempers scale the
  mark with it). It is the client's law, as the found mark is; a modified client was never bound by it (the budget's).
- STOLEN-SAID: the Goods row and bar, the trader's rows, its look and the Vendor page read the mark the real Worker's
  listing kept; an auction takes Masterworks alone, and no theft arm marks a crafted piece.
- #8 and #13, ALREADY FIXED (SIDE-ONCE): on main with #1124 (2026-10-22), after both reports' build 0.0.235;
  `fb1019f_sideonce.test.js` 4/4, Health Leech left out with its settings taken. The service still counting a modified
  client's stacked rows is recorded as the owner's.
- #3, AS DESIGNED: AUDIT PROF10 J2, Mac's "Item maker can add to it" (Professions-Arc), the kept rows costed in
  enchantDecision; the record says what to tell the player.
- #290, NEEDS DATA: a trade's receipt and a collect push the piece (`giveTradeGoods`), the room's word drops only an
  incoming copy (`withoutCarried`), `stowedKeysOf` only reads; no path removes a carried King's Mark. The record's list of
  what to read is the right one.
- Hosts: no host touched; `worldModes.js`'s two arms stay net zero.

## D - MARKET

Read at the batch head `2dc8f31a2`: the three MARKET commits (`994b5f3e5`, `cc571e32d`, `88f4e7fa0`) and the code as it
stands after the merge (PACK-PICK's `itemLook.js` included), against the record's RPT1026-MARKET section. Driven on the
real producers: the account Worker over node:sqlite with every migration and R2 (`test/accountDb.mjs`,
`test/realmSeat.mjs`), the real realm session and realmGoldAct, `createMarketGoods` over packs the loot producer minted
(465 rare and legendary pieces listed and received in a probe), the market book over the real account door, the vendor
host's stall, and the sweep's clock by hand; an old service (the road route answering 404) faked at the fetch. The batch's
40 MARKET mutants re-run: all dead.

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| D1 | **A press's `soon` asked while a sweep was under way was thrown away.** `after()` cancels the clock and sets its own, and the sweep under way had read its road before the press - so a buy whose own collect did not land said "It is on its way to your pack and will reach it on its own", and nothing came this session (the next join, stall or press collected it). Probe: road in flight, `soon()`, road answered - nothing due. Major (the reported symptom, on the bad connection that makes the press's collect fail). | `marketArrivals.js` `poked`: a `soon` during a sweep is kept and swept for ARRIVALS_SOON_MS after that sweep ends, unless the market is shut (Home.md ASYNC NEVER DROPS). | `test/net/audit_rpt1026_market.test.js` D1 (over the real Worker: the service reads the road, Tom buys, the press pokes, the road is heard - a sweep still due, and it collects the piece into the pack and the record once) and D1 clock; fail at the head |
| D2 | **A clock ahead of the service's polled the road every 5 s for a courier's whole road.** The wait is `arrivesAt - now + ARRIVALS_LATE_MS`, floored at 5 s, on the client's clock; a piece the service still has on the road and this clock has past waits 5 s, again and again, never counted as a try. Probe: an hour ahead and a fifteen-minute courier - 181 road reads (each the service's settle reads and the road's). Minor (load, no loss). | A piece past its arrival and the slack by this clock while the service's read just said it is on the road waits ARRIVALS_AGAIN_MS; a clock on time keeps the 5 s slack. | `audit_rpt1026_market.test.js` D2 (16 reads over the courier; the slack kept for a piece that came due as the sweep ran); fails at the head |
| D3 | **A take-back kept unanswered lost its piece to the settle that landed it.** A cancel whose every quick try failed is kept; the next settle (the stall's opening sweep) asks it again and it lands - but the road that sweep read was read before, the cancels loop collected nothing, and the clock set nothing: the piece left the stall and sat on the service, in nobody's pack, until another settle. VENDOR-LOST collected a kept buy's delivery on its answer; a kept cancel's was never collected. Minor (the next stall or join brings it; it looks like a piece that vanished as it came off the market). | `marketBook.js` settle: a kept cancel's answer that names a delivery is collected there (`collectGood(dn, 'returned')`, said as come back); `market-gone` there is another door's collect and is said as nothing. | `audit_rpt1026_market.test.js` D3 (through the vendor host's stall: the take-back kept, the stall opened again, the piece in the pack and the record once, said as come back; fails at the head) and D3 `market-gone` |
| D4 | Record: STORES-SAID's module (`ui/storesWalled.js`), its pin's header (`rpt1026_market_walled.test.js`) and the arc page (`Online-Arc.md`) quoted #242's own words, in translation, inside quote marks. | Paraphrased; no report's words remain in the lane's files. | - |

Mutants: `tools/mutants/audit_rpt1026_market.json`, 8 records, all dead (D1 the poke never kept, never swept for, swept
for under a shut market; D2 the overdue wait the slack's, the slack taken for a clock ahead; D3 the delivery uncollected,
said as a purchase, `market-gone` said). Re-aimed by content, its line having moved under D1: `rpt1026_market.json`
RPT1026-MARKET-ARRIVE-soon-left-uncounted (judged again, dead). With the fixes in, `audit_rpt1026_market.json`,
`rpt1026_market.json`, `fb1025_vendorlost.json` and `fb1001_market.json` re-run together: 129 dead, 1 equivalent as
recorded, none survived (`SCRATCH/audit/D_mut.txt`). Record: the RPT1026-MARKET ARRIVE section of `Field-Bugs-2026-10-26r.md` carries
an AUDIT RPT1026 paragraph, and `Online-Arc.md`'s HOME-VENDOR entry a sentence. No new player-facing words (no drafts
owed). The client alone: the relay's bundle, the account service and the migrations are unchanged; no host grew.

### Suspected (D)

- S1. A realm trade whose commit falls in the second a sweep's collect holds the session is refused `busy`
  (`realmSaves.js` transact; `settleRealmTradeHalf`): nothing moves and it is said, but the trade fails at a moment the
  player did not choose. Proof: a session holding a collect's transact, then the trade's half - and a live trace of trades
  refused `busy` beside a sweep. Not fixed (a design trade of any background realm act).
- S2. A road answer heard after a press's own collect landed (its service read made between the buy and the collect,
  its answer slow) puts the collected delivery back on `state.road`; the settle asks it again, `market-gone`, and at a
  stall that refusal is said over a piece that is in the pack. Proof: a fetch-ordered real-Worker test with the road's
  read between the buy and the collect and its answer after the collect's. Not fixed (narrow; the timer path only retries).
- S3. The road reads at most 50 item deliveries an account, oldest first (`market.js` roadReads), so an alt with 50 or
  more uncollected returns arrived earlier hides a played character's purchases from the sweep and the Market tab until
  the alt collects. Proof: a Worker test with 51 returns for one character and a purchase for another. Pre-batch; not fixed.

### Read and found sound (D)

- ONE COLLECT A DELIVERY: the collect is one realm act, guarded `collected = 0` and mustChange; a second rid is
  `market-gone`; the book's acts run one at a time and a settle waits; never received twice on any path traced.
- The wrong character: the sweep and the settle take only `x.character === me`; the service refuses `market-other-character`
  and moves only `character`'s record under its lease.
- COLLECT-LANDED (service and book): `oneOn` is asked under the lease, only with a delivery this rid collected; one on with
  none is `seq`; the batch's catch answers the first asking that landed while the retry ran; a repeat naming no sequence
  still abandons. A modified client gains nothing it could not do to its own pack. Old service ignores `landed`, old client
  sends none.
- `/v1/market/road`: registered account and its own account's road only, the market's shut checked, the per-account rate
  in front; not a replica route. Against an old service (404 `not-found`) the new client's sweep asks once, settles what
  the book holds, and sets no clock (probe).
- The gate: `checkpointGateOpen` (spawned, online, no duel) and a seen page; offline play builds no book and starts no
  clock; a duel or the boot waits. A death: realmCheckpoint refuses then and a collect moves the last landed record; the
  tombstone, a Resurrect and the online respawn all read or write past it with the piece in record and pack - nothing lost.
  A trade in flight holds the session, so the sweep is `busy` and asks again.
- The press's words: "on its way" exactly when the press's own collect did not land; `market-gone` keeps "Bought"; a
  refusal of the buy is the buy's own word.
- The pack's words: the service mints `why` 'bought' and 'returned' only, so the settle's mapping is whole.
- The delete's words cover REALM_MARKET_OPEN_SQL (listings, auctions, bids, orders, commissions, loads, deliveries, takings).
- HOLD-SAID: every `trade-held` a route returns is the actor's own hold (a held seller's listing is `market-gone`), so
  saying the standing hold is right; `/bug` is a host command; placeholders match English in the thirteen languages.
- STORES-SAID: the walls said are the service's SQL - a silver listing own and bought, a gold listing own and gold,
  the guild Stores WRIT_ORIGINS; loose walled everywhere but a station.
- PACK-PICK's `itemLookRows`: the stolen line reaches the trader's look through `vendorItemStats` (the LEDGERLAW pin drives
  the host). The Market's List form card draws no `stolen` - the seller's own piece; noted, not a defect.
- #92 NEEDS DATA: the trace stands (a refused buy gives back what it took; a landed one leaves a delivery or the piece in
  the record), and the one cause it did not name - a receive that refuses a piece the List form offered, abandoning the
  session - does not occur: 465 rare and legendary pieces of the loot producer listed and received, none refused.
- #242 AS DESIGNED: the walls are the rule, and since STORES-SAID the List form and the guild Stores say them.
- #181 ALREADY FIXED: `72b3b41d9` (SELL-SHOWN, 2026-10-25) is on main and the head, after the report's update; the
  enhanced footer's yellow figure is `lotPrice`, the keeper's own offer.
- The four hosts and HOST-SPLIT: one host entry (`checkpointGateOpen`), the Collect moved out; `hostceiling.test.js` green.

## E - FIGHTS

Read at `2dc8f31a2` (the batch head) with the freeware's data: the lane's three commits (`5e8530111`, `828511f52`,
`7723c43b9`) and the code as it stands, driven on the real producers - the Remnant, its Echoes and Hearts, the gate's
Warden and the Tonal Warden and its forks through their own modules; the Hour's realm and the Ketch's ship as real relay
Rooms (`test/fakeRoom.mjs`, a crewmate gone quiet striking a risen construct); the real weapon rig (`createWeaponRig`) and
technique key (`stepTechnique`) under the dungeon's own door; the real cast engine (`createPlayerMagic`) over two street
pools for the soul traps; the real `siegeSpellNumbers` with a concealed caster; the lane's 31 mutants run again (31
dead). The world-hosted dungeon itself (`buildDungeonContext`) cannot stand in Node - its seams were read on the source
and run as the host writes them.

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| E1 | **WINDOW-ONLINE let the weapon technique fire from under a dungeon window online.** Online the dungeon frame now runs under a living player's window - drawFoes, and with it the dungeon's weapon rig and the technique key it steps. AUDIT TECH1 holds that key under a window by its door's `blocked` (the street's is `gamePaused()`); the dungeon's door had none, because its rig had never stepped under one of its windows (Weapon-Techniques.md said so). The key's default, Mouse3, reaches the held keys under any window: on the real rig with the dungeon's door, the press under the window started the Whirlwind (`swing.n` 0 -> 1, its 10 s wait begun). | `dungeonContext.js:"blocked: dungeonPaused,"` - the context's own pause holds the key, the aim and the clock, as the street's does (net zero host lines: its `drainFatigue` entry is the function itself). | `test/scenes/audit_rpt1026_fights.test.js` (the door's entry as the host writes it, on the real rig: nothing under the window, the technique with it down); fails at the head (mutant E1-dungeon-door-holds-nothing is the head's door) |
| E2 | Record: (233)'s AS DESIGNED said the defender's Willpower save applies, as the report supposed. The spell is counted on the neutral stand-in (`DUEL_STAND_IN`: every attribute at 50, no race), and the referee (`wildRef.js` refereeCast) reads no save: the defender's sheet is never read. | The record's (233) section, and what to tell the player (Willpower does not apply between players either). | - |
| E3 | Pins: RETIRED-BLOW's Ketch relay law (a word aboard judged from a pose no older than `KT_POSE_FRESH_MS`) was pinned by its source text alone, where the real Room runs under `fakeRoom.mjs`. | Driven: a crewmate posing lands on a risen construct of the Watch; gone quiet past `KT_POSE_FRESH_MS` (alice keeping the census) its blow lands nothing; posing again, it lands. | `test/net/ketch/audit_rpt1026_fights_ketch.test.js`; mutants E3-ketch-word-pose-never-ages and E3-...-ages-by-the-hello, dead |
| E4 | Record: HALL-SPELLS closes 275 for a caster only. Underground no arrow meets a player (Wild-Zone.md section 22, Known limits: the dungeon's missile lane meets the arena's rival and the relay's bodies, `world.js` wildArrowTargets is the street's alone) - so an archer in the halls still cannot hurt a fighter who can hurt them until both are on the surface, 275's own shape. | The record's HALL-SPELLS section: WHAT IS LEFT, and what to tell the player (a spell or a swing reaches a player in the zone's dungeons, an arrow does not yet). | - |

Mutants: `tools/mutants/audit_rpt1026_fights.json`, 4 records, 4 dead. The lane's `rpt1026_fights.json` re-run: 31 dead.
PIN MOVED: `test/scenes/tech1_hosts.test.js` reads the dungeon's fatigue door as the function handed whole (`drainFatigue,`,
the line E1's `blocked` took); `tools/mutants/tech1.json`'s 22 records on that test re-run: 22 dead.

Committed on its branch as `cc8ad99fd` (on `2dc8f31a2`). Green: lint, types, the bible gates
(manifest, citeanchor, citedrift, mutantdrift, audit18_bible_docs, ledger, hostceiling - `buildDungeonContext` 8,434
logical lines, as at the head), relayversion, and the 907 test files that name `dungeonContext.js`, the touched docs or
the touched modules (one failure on the first run, tech1_hosts' pin, moved above).

### Suspected (E)

- **S1 - an honest fighter on a stalled line can lose Hour/Ketch blows.** RPT1026-SECNET's `_poseHeld` holds a stalled
  socket's poses (one a HEARTBEAT_MS) but never its fight words (`sendSdBlow`, `sendKetch*`), so a STANDING fighter's blow
  struck after the stall is detected travels ahead of any fresh pose; delivered past 25 s after its last pose's arrival
  the relay now drops it (the swing's own `an` pose, which normally precedes it, is the one held). Needs a stall of about
  20 s or more. To prove it: drive `online.js` over a fake socket marked stalled - `sendPose` held, `sendSdBlow` sent -
  into the realm Room of `rpt1026_fights.test.js`. Not fixed: a blow 20 s late is a dubious blow, and the cure (a pose
  sent ahead of a fight word on a stalled line) is SECNET's to weigh.
- **S2 - the technique key under the OUTER host's window over a dungeon** (pre-existing, offline too, not the batch's):
  `worldModes.js`'s dungeon arm holds only on the context's own pause, so under the street slot's window (`townTalk`:
  Recall's prompt) drawFoes and the rig run, and `blocked: dungeonPaused` does not see that slot. To prove: E1's test with
  `opts.breathHeld` up and the context's pause down. The cure is `blocked: () => !!opts.breathHeld?.() || dungeonPaused()`
  (one logical line in `buildDungeonContext`, which this audit was not to grow).
- **S3 - a revenant executed with a peer's trap on it fills the RUNNER's gem.** `exteriorFoes.js` executionDone (and the
  dungeon's twin) roll `attemptSoulTrap(f.entity, ...)` without asking `peerSoulTrapOf`, so a trap a party member laid on
  it (by a strike since STRIKE-SHARED, by a cast since TRAP-TO-OWNER) is rolled against the runner's pack and its caster
  is never named. To prove: the trap test's two street pools with a revenant of the runner's that yields, a peer's cast
  trap ridden to it before it kneels, and the runner's execution.
- **S4 - the drowning twin of 240** (a design call): online a window holds the breath (AUDIT 27h S1, the street's law too)
  while the character's rounds tick, so a paralysed swimmer can wait the paralysis out under the inventory without
  drowning - the foes now act on them. To prove: the breath and the round on one window, `dungeonContext.js`'s
  `breathTick` beside `tickPlayerMinutes`. The owner's to weigh against WINFOE1's "only your own input/camera pause".

### Read and found sound (E)

- RETIRED-BLOW: `sighted` in applyRemnantHit, applyEchoHit, applyHeartHit, the gate's applyHit and the Tonal Warden's
  two arms sits after every refusal and before the purse; retire and restore both move the whole at the fraction it
  stands at, so a retire-restore-retire cycle moves no fraction and buys nothing (checked through phase floors and the
  Echoes' rescale - a dead Echo's half moves to the living one, and with both down the break's pool is nought at the
  floor fraction); the gate's census has no pose age (a socket in the court is seen), so its blow-restore is the whole
  cure there; an `in` from a stale pose still restores a share (its pose is read unaged) but earns nothing (`stoodMs` is
  the census's) - an idle in-arena fighter's grief, no farm.
- The relay's stale-pose law: `pAt` is stamped on every passed pose of an Hour or Ketch socket (lazy writes lose at most
  ATTACH_LAZY_MS); a standing page heartbeats every 20 s in both rooms (neither is `aloneQuiet`) and a swing or cast is a
  pose at once (`poseChanged`'s `an`, `cn`, `wd`), so an honest line keeps every blow; the Ketch's other words with a
  stale pose read as the dead's (`alive` false) - no new door.
- HALL-SPELLS: both doors asked at the cast; the standalone dungeon's answer none (`duelMarksFor` skips a null mark);
  every world-hosted dungeon outside the zone gets no marks (`wildCan`).
- STRIKE-UNVEILS: the four rolls hand the player; a spell between players unveils its caster through the stand-in's
  count (probed: Chameleon, Invisibility and Shadow of the normal power each end on a counted bolt); the arena's
  rival is struck with the real player entity; `withoutFirmament` keeps `_mods` alone, so nothing restores a broken veil.
- TRAP-TO-OWNER: the trap rides ahead of the damage on one socket (it is laid before a lethal blow lands); `_trapSent`
  latches one roll per sending; a strike whose whole record the wire refuses still sends its trap alone; the runner's
  own trap on a peer's kill fills the runner's gem and no Star of anyone's; the Star is no second soul.
- WINDOW-ONLINE: offline identical (`sharedClockOn` is the `?online` page's); the death screen holds and a dead page
  leaves its room at once (D12, PDEATH-FOES), so no dead host freezes a party; a hidden tab's host loses the seat after
  FOES_STALE_MS (SEAT-LIVE); the touch layer's swipe and the modal mousedown are gated under a window; the Hour's Steps
  carry under a window as before; the rest window still breaks on enemies near.
- (106) AS DESIGNED: the pages now agree with the code (Super-Dungeons section 10, Elite-Gates 13.2, 19e, `egLords.js`).
- (48), (55), (34) ALREADY FIXED: BOSS-DOT, STAND-IN-WHOLE and DUEL-BAR stand at the head as cited, and Field-Bugs-2026-
  10-19f read reports 1-56, these three among them (this clone is shallow - 121 first-parent commits - so the update
  numbers themselves could not be walked).
- (119) AS DESIGNED: the save by the spell's element, the Magic default and the golems' immunities stand as cited.
- (293) NEEDS DATA: no further veto found; the cures for the two live causes it names stand (WINDOW-ONLINE, SEAT-LIVE).

No change to the relay's bundle (`server/src/index.js` and its imports) nor to the account service; no migration; no
player-facing words.

## F - PROGRESS

Read at the batch head `2dc8f31a2` (commits `998cdb1e1`, `f3bf010ab`), with the freeware's data. Every claim was driven
through the producers the game runs: a chargen'd character's skills through `tallySkill`, `masterSkill`, `setMasterSkills`
and `raiseSkills` and back through `snapshotPlayer`/`restorePlayer`; the one cast engine (`createPlayerMagic`) readied,
pressed, released and its Area at Range missile flown into a wall at the caster's feet; the item maker's own
`applyEnchantments` minting the hotbar's pieces and the real `hotbarPress`; the Skull of Corruption off DFU's MAGIC.DEF
used through the payload door over the real enchant ctx and the street's real pool on MONSTER.BSA, its save and load
through `snapshotWorld`/`restoreWorld`, the death's food through the survival handler every game installs. The batch's
33 mutants were re-run (31 dead, 2 equivalent as recorded); the end-to-end summon pin was mutated by hand.

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| F1 | **minor - PRACTICE-KEPT dropped practice the player earned.** Past 100 a mastered skill's counter holds the tough-foe uses its last rest has not banked; Master Skills switched off and on again before a rest dropped them all (119 uses of a level-30 foe's blows in the probe) under the switch's own line, "Your progress is kept". | The switch off notes each mastered skill's counter at the cap (`masterSkills.js` holdMasterPractice, `entity.masterPracticeHeld`, saved by `save.js`); the switch on drops the counter as the batch does and gives the noted uses back (returnMasterPractice). | `test/scenes/audit_rpt1026_progress.test.js` F1 (the counter back, the bank after a rest equal to a twin that never switched; the note through a save made while off) |
| F2 | **minor - JEWEL-USED: a hotbar piece that could no longer be put on.** Any piece carrying Cast When Used became a used slot - a Warlock's Ring, a Lord's Mail, a made amulet of Lightning and Water Walking, a Cast When Used cuirass - and a slot saved as worn asked the piece and cast it too. | A piece whose wearing is worth something too (its armour, or a power's row beside the Cast When Used - never a side effect's cost, a bound soul or Feather Weight) keeps its worn slot; the press puts it on, and casts once it is on (`quickslots.js` wornForMore). A piece of Cast When Used and no worn power is cast unworn, as the batch has it. | F2 (the amulet put on, then cast and left on; the cuirass put on; a ring of Cast When Used, Feather Weight and a side effect cast unworn, its old worn slot too; a Cast When Held amulet on, then off) |
| F3 | **major - the absorption report's AS DESIGNED was wrong.** DFU prices the absorb "as if the target cast the spell", the same price for a self-absorb, so at a full pool a cast makes room for its own price and its absorb fits. The port's cast is priced with its modifiers, the absorb without: through the real engine an absorber's own blast at a full pool, 42 points, is drunk; at 30% off it costs 29, asks room for 42, and hurts for 24 - a rested caster died to their own spell, and spending first "worked" because it made the room. | A self-cast asks room for, and drinks, the lesser of its price and what its release spent (`absorption.js` tryAbsorption's `paid`, from `effects.js` applySpell when caster and target are one); the half it refunds is never a profit; anyone else's spell asks DFU's whole price. Port-Ledger A row. | F3 (the blast at 0% and 30% off; a CasterOnly blast at 60% off after a dearer cast leaves the pool lower; my discounted blast on another absorber still needs room for its whole price) |
| F4 | **minor - SUMMON-BARE's "left for the owner" item, proven and closed.** A summon the street or a building saved alive was re-minted unmarked on a load: the Skull's copy of a Grizzly Bear, saved and loaded, died with three pieces of meat on its body (a card the same way). | The saved record carries the mark and the restore re-marks the foe (`foeLootCap.js` savedSummon, restoredSummon, over two existing statements of `exteriorFoes.js` createExteriorFoes - no logical line added). | F4 (the copy's meat thrown away at its death; saved alive, loaded, still a summon, bare, its death leaving nothing; the plain bear beside it a bear's body) |
| F5 | **record - a claimed path no producer takes.** The record, Online-Arc and Systems-Arc said a summon handed to its heir streams on as one; both `heirOf`s in world.js refuse a PlayerAlly (Online-Arc's own line above it says a summon is handed to nobody), and the peer-summon pin names its heir by hand. | The three pages say so. | - |
| F6 | **record (pins) - SUMMON-BARE's death's finds were pinned by a hand-built entity only.** `rpt1026_progress_summon.test.js`'s end-to-end test passed with capFoeLoot's summon line deleted (no death handler laid a find on the copy); only its `{ summoned: true, items: [...] }` literal killed the mutant. | F4's test lays a real handler's meat on the Skull's copy and asserts it emptied (mutant `AUDIT-RPT1026-F4-death-finds-kept`, dead). | F4 |
| F7 | **record - Port-Status lost the batch's five Ledger rows.** Its section 3 sentence named RPT1026-PROGRESS's five at the batch's commit; the head's sentence (after a merge) counted them in its 344 and named them nowhere. | Named again, beside F3's row (345). | `citedrift.test.js` CD1 (the tally) |

Pins: `test/scenes/audit_rpt1026_progress.test.js`, 7 tests, all 7 failing at `2dc8f31a2` and passing with the fixes.
Mutants: `tools/mutants/audit_rpt1026_progress.json`, 21, all dead. Re-aimed by content (their lines moved): four
records in `rpt1026_progress.json`, two in `set2.json`, two in `ui2.json` - the three lists re-run whole (92 dead, 2
equivalent as recorded); the one that then survived, `RPT1026-PROGRESS-hotbar-held-used` (a Cast When Held piece read
as used - now asked of a worn piece only), is killed by F2's on-then-off press, its record naming the new test.
Ran green: lint, types, the bible gates (manifest, citeanchor, citedrift, mutantdrift, audit18_bible_docs, ledger,
hostceiling) and relayversion, `npm run cites -- --check`, every test file that names a changed module (817 files,
3 skipped) and every test that reads a page this lane edited (147 more). The Ledger row moved the cites below it:
`tools/citeShift.mjs --apply` for 19, Port-Status section 2's identifiers and its tally by hand (CD3); that page's
sentence had also lost the batch's five rows at a merge - restored.

### Suspected (F)

- S1 (minor, not fixed). PRACTICE-KEPT drops plain practice only at `masterSkill` and at the offline switch. Master
  Skills is also "in force" the moment `_online` turns true (`masterSkillsActive`, set each frame by world.js's
  partyFrame) - so if an offline character, its mastered skill past 100 practised whole with the switch off, could ever be
  played online, that counter would be banked unasked. Not traced to a door: no code found that makes an offline save a
  realm character (the account service holds those). It would be proven by such a door; the fix would be the same
  drop at the first online frame.
- S2 (record, outside the lane's fixes). The dungeon's save restores foes by index in place (`collectWorld` skips
  companions and puppets), so a companion standing before a loose stand shifts the indices and a load can lay one foe's
  record on another - a summon's empty list on a plain foe, or the reverse (its mark stays on the entity, so no farm).
  Would be proven by a save with a companion and a summon in one dungeon, loaded in the same room.

### Read and found sound (F)

- PRACTICE-KEPT's mastery arm: a skill mastered at 100 holds only plain uses; the bank (`skillProgress`) and the tough-foe
  fraction are untouched; online the switch cannot move.
- WARD-BEST: one best-of reader for three kinds; an ended entry read by nobody; a player's own recast merges into one entry
  (the incumbent's chance stands, DFU's), so the best-of changes nothing for one's own stacked spells; a power's merge
  takes the larger as before.
- SUMMON-BARE: the stand's `.then(summonedBody)` lands on a microtask before any frame; every host's stand answers the foe
  (street, building, dungeon loose stand); the Soul Bound release is a hostile foe a new soul pays for; the dungeon's
  `sm` word rides each record of each frame and a pending build keeps it; a peer cannot strike my ally (applyOwnHit).
- IDENTIFY-SPENT: every arm that lands Identify on the player carries the release's token (CasterOnly, an area of gifts,
  a reflection back); an item's or a trap's cast spends nothing and gets nothing - DFU's own TODO; no honest path loses
  a refund it paid for.
- SOUL-HELD: the live read and the law's refusal agree; the picker cannot lay one soul twice (the primary list hides a
  laid Soul Bound, the shortcut excludes it); the window's pack is the one the bind consumes.
- FLOW-SEEN: the chip only for the Blademaster awake, never in a duel (awakeMartialId), its seconds as the other chips'.
- JOURNEY-REAL: the tick's dt is `dt * travelScale`, so `dt / timeScale()` is the real second; x1 and the indoor hosts
  unchanged; past 100 MOVE-REAL's credit cap bounds each use.
- GOLDSMITH-SAID: words only; the service's record already minted Gold's points and worth (professionLaw.js rides the
  account bundle, which `acct197` already moves).
- The verdicts: #45/#46 (the reporter's numbers give +2 through `levelUpSkillSum`, each skill's quarter floored); #154
  (the specialization reads the trained skill); #125 (the bar is Renown); #251 (Divine Grace through the one damage
  door, its exceptions listed); #261 (a set at its lowest piece's stage; the armour half needs data); #59 (DFU's 12-hour
  training gate on the character's clock); #61 (DFU's PerformFastTravel raises skills at the 6-hour gate); #75 (DFU's
  OnExhausted); #235 (fixed by the reporter's own later build, by their word); #33/#109 (CHAIN-SEEN in main's tree, the
  colour and the strike's visual requests). #286 was not sound - F3.

Bundles: `src/systems/masterSkills.js` rides the relay's bundle (FOE-BOUNDS) - the undeployed `world270` row is re-hashed
in place (`test/net/relayversion.test.js`, `bcfc3969...` to `fe5aef84...`; a lane that also moves the bundle re-hashes it
again at the merge), no version moves. The account service's bundle carries masterSkills.js,
effects.js and absorption.js - its `acct197` is undeployed and already moved for the batch. No migration. No host grows
(createExteriorFoes 3,073 logical lines before and after). No player-facing words.

## G - ITEMS

Read cold at `2dc8f31a2`: the lane's six commits and the record's Items section, then the code as it stands. Driven: both
real trade counters (the classic canvas window's slots and keys, the enhanced view over a DOM shim) over a made character's
pack, the ladder's Legendary with its realm id, the save (`snapshotPlayer`/`restorePlayer`) and the realm judge's own
`ledgerPieces`; the real payload dispatcher under the host's own enchant ctx (`createEnchantCtx`) on an offline and an
`?online` page with a stored Off; the room loot module (`createRoomLoot`) for three clients; the dungeon context's own
foes-frame statements mounted for a host and a joiner, a death through its own corpse door (`spawnCorpse`); and the
batch's mutants plus three of my own aimed at its claims (two lived - G5 and an equivalent release, below).

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| G1 | **BODY-CAP still lost one new body in ten.** Past the cap the frame named the bodies in the room's numbering, oldest first, so the body the cap shed was the one that had just fallen. Its death rode a delta alone; when the frame after the death was the full one (FOES_FULL_MS / FOES_MS: one in ten), the joiner's puppet still stood, went as "a standing puppet the frame does not name", and the death's record that followed named an encounter the joiner no longer held - "a body never seen standing" stands nothing. The report's symptom, in the very room the fix was for. | The bodies go newest dead first (`dungeonContext.js` foesFrame's sort, spawnCorpse's `_diedAt`): the cap sheds an old body every joiner has held dead and keeps. One expression; no host growth. Comment at the room's forget sweep corrected (a capped frame takes down a standing puppet alone). `restsync.json`'s RESTSYNC-bodies-before-the-standing re-aimed by content. | `test/net/audit_rpt1026_items.test.js` (fails at the head: the fallen foe is gone from the joiner); mutants G1 x2 |
| G2 | **#277's FIXED verdict does not hold** (record). The report's dungeon was an elite one - a spawned dungeon, which stands on an online page alone (`world.js` spawnedDungeonAt) - and online the room forces Allow Magic Repairs on, which the host's mounted ctx reads: the door RARE-KEPT closed kept every enchanted piece there already, Legendary or DFU's own. The lane's own #257 row says as much. RARE-KEPT is an offline hardening (a player's own Off). | #277 re-read NEEDS DATA (the character's saves around the break); the counts 99 FIXED / 37 NEEDS DATA; the RARE-KEPT section, Combat.md, Port-Ledger A and Active-Arcs say so. | `test/systems/audit_rpt1026_items_kept.test.js` (online, a stored Off, DFU's own magic axe struck to its break through the host's ctx is kept; offline it is consumed); mutants G2 x2 |
| G3 | **#257: "No fight by that name was found"** (record) - the Sky Ketch's Tonal Warden stands at the ship's helm (`ketchDeck.js` KT_WARDEN_HOME), and a death aboard is a fall with no death penalty. NEEDS DATA stands. | The row names the fight. | - |
| G4 | **HELD-OUT's four hosts: "a dungeon or the open world opens none"** (record) - the Identify SPELL opens a counter in the street, underground (`worldModes.js` openIdentifyWindow, either slot) and in the standalone dungeon (`dungeonContext.js` openIdentifySpellWindow). The hold rides the window, so all of them hold their lot. | The record's FOUR HOSTS says so. | - |
| G5 | **HELD-OUT's "a piece already back in the pack is written once" had no pin that could fail** (pin): every pin asked after the counter closed and let go, and a mutant reading the held lot without the pack lived through them all. | Pinned over a counter handed a selection of the pack (the classic counter's own F102 shape: the staged piece still in the pack), its save and its load. | `test/systems/audit_rpt1026_items_heldout.test.js`; mutant G5 |
| G6 | **BODY-CAP's "older build" pin sends `xf` 3** (pin) - a word no build says; it holds the unknown word to nothing taken down, not an older build's reading. | The pin's words and the record say what it holds. | - |

All five new mutants in `tools/mutants/audit_rpt1026_items.json` are dead, and the lane's twenty in `rpt1026_items.json`.

### Suspected (G)

- **#265's cause.** BODY-CAP's cap is reached only by 33 rest ambushes in one host's visit (a broken rest stands the only
  shared encounter - `restEncounter`, one foe), which a report of bodies vanishing in general does not suggest. The
  likelier common cause is #137's: the Morrowind lane's body at death (the flat hidden under it, the body not drawn). What
  would prove it: the reporter's skin and Morrowind folder, and a run of that lane with Morrowind's own files.
- **XF_STANDING with more than 32 standing** says "whole for the standing" when the cap cut standing ones too; a joiner
  then takes their puppets down (as `xf` 1 did before). Needs 33 interrupted rests with nothing killed - unreachable in
  play; a frame whose last named record stands would have to say no `xf` at all.
- **A forgotten body past the cap stays on a joiner** until a frame is whole again (a capped frame keeps every dead
  puppet). The host forgets a body only on a load's cut or a rebuild, neither of which an online host runs past the cap
  in play; recorded at the site.
- **The lapse line in the honest case.** A lapsed claim is said again and may still be granted (OUTDOOR-LOOT D-2.1), so
  "the item is back where it was" can be followed by the piece arriving in the pack. Wording only.
- **Pre-existing, not the batch's: one peer's word locks a pile for the host.** A live peer's word with the room's terms
  and another signature marks the container unreadable on the receiving client, the host included, until a readable word
  lands - an older build's joiner, or a hostile one, locks every pile it touches for the host. LOOT-SKEW only changed its
  words. Proof: a hostile word through `landRoomWord` on the host's module.
- **The skew line for a stale memory.** A non-host reading the room's MEMORY on another build's chain (an earlier visit's)
  is told "another player here" is on another version; the host restarts such a container, so it lasts until that word
  arrives.

### Read and found sound (G)

- HELD-OUT (#280, #281, #213): both counters hold `staged` from their mount and release it after the clear on every exit
  (Escape, the mode's close, a host's dispose, the enhanced door's close and unmount); a Buy's basket never reaches
  `staged`, nor does a quick sale, Sell junk stages through the counter's own law; a sale empties `staged` as it pays; the
  road counter's refusal hands the goods back synchronously; a load closes every counter first (DUPE-LOAD's
  closeWindowsForLoad, discardBeneath disposes), so a load never meets a held lot; offline no key reaches a save under a
  counter; the realm's put carries the lot with its key. No path writes a staged lot twice, no stall uses a counter (the
  home vendor is the market's), and a load returns it once.
- The release removed from the classic counter's close survives every pin - equivalent: the released counter's `staged`
  is empty by then, so a leaked hold reads nothing.
- RARE-KEPT's own law: a stamped piece breaks, is said, comes off the doll and stays; a broken piece cannot be worn
  (`isBrokenItem`), a repair kit mends it (no magic gate), and its sale price is DFU's (condition unread) as any broken
  piece's.
- LOOT-SKEW (#142, #264): the skew mark is set only on the live-peer or non-host-memory mismatch and cleared by M2's two
  doors; the press reads it; the lapse says once, at ROOM_CLAIM_TIMEOUT_MS.
- RE-ENTRY (#89, ALREADY FIXED: CHAMP-BASE) - the four walks and their mutants hold; DEX-CORPSE (#137, NEEDS DATA) - the
  classic lane's corpse is carried, sized and uploaded.
- #222 (AS DESIGNED, the withdrawal says a revenant took it), #132 (HelmAndShieldMaterialDisplay "0"), #289 (ANY-GOODS
  20de263c1 after the report's build, an ancestor of the head), #47 (19f row 19, DISENCHANT-SAID), #22 and #140
  (spendCampNight, feedFire's three nights, packCamp), #65 (lootThemes' Harpy, professionLaw's hide), #177 (no path takes
  Portal Stones at a login; restackStones folds Sigil Stones alone), #173 (nothing to trace).

No relay bundle change, no account-service change, no migration. The one host edit (`dungeonContext.js`) is an expression
and a comment; `hostceiling.test.js` holds.

## H - QUESTS

Read the lane's three commits (dc92ae58a, bee143405, 782678fee) and the code as it stands at the batch head 2dc8f31a2,
on the freeware's data: DFU's own scripts through the real parser, machine, bridge and questlines layer (N0B00Y09,
$CUREWER, 80C0XY00, M0B11Y18, B0B81Y02 The Lost Artifact paid with its journal taken back, N0B00Y17), the pause window's
real Quests tab on the minimal DOM (stamped and not, a hidden quest under Show hidden), the real MAPS.BSA and the open
zone's mask (every dungeon and every `permanent` quest place inside it), the account service over node:sqlite for the
arena's receipt, and every mutant list that names a file the lane moved (the lane's 29, six of my own probes, and the
records whose site the lane's insertions moved under them).

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| H1 | **major** - NO-GIVES-BACK forgot a No the questlines read. Three of its four Nos are answers the sheets take as the player's choice: N0B00Y09's `_nononono_` ("Keep it for the Guild", the `refused` ending: Mages Guild +3, Dark Brotherhood -3), $CUREWER's `_S.15_` (the `spared` ending), 80C0XY00's `_school_` (the kept secret). Cleared a tick after the No, N0B00Y09 settled `loyal` (+2, nothing to the Brotherhood) under a journal that still said the research was kept for the Guild (a later Yes left the choice saying Guild while the outcome said sold), and $CUREWER's refusal ended as `failed` (a failure) - with the questlines on, the default and forced online | `noAsksAgain.js` `sheetReadTasks`: a stamped quest's No that its sheet reads (a choice's `sets`, an objective's or an outcome's task) is DFU's again, asked once. M0B11Y18's queen (the report; her sheet reads nothing of `_S.20_`) still asks again; unstamped, all four do | `test/systems/quest/audit_rpt1026_quests.test.js` H1 (3): the stamped and unstamped census over DFU's corpus, N0B00Y09 refused through the real bridge (`refused`, `[[40,3],[108,-3]]`; off: asked again), $CUREWER `spared` - red at the head |
| H2 | **minor** - On the classic skin the questor's close said "you can abandon it from the Quests tab of the pause menu"; the classic pause (DFU's OPTN00I0) has no tabs - AUDIT QUESTLINES UI-6's own defect, new words of this batch | `questBridge.js` questorBusyRows picks the words by skin (UI-6's way: Controls, then Escape, then Quests), `quest.offer.questorBusyAbandonClassic` drafted in the thirteen whole languages | H2 (1): enhanced, classic, classic in French - red at the head |
| H3 | **record** - #212's NEEDS DATA said "likely a character below level 5". S0000999 gives Lhotun's letter on `_S.45_: when _S.14_ and _S.15_` (standing at least 0, level 5 done) and starts S0000001 on `_S.40_: when _S.00_ and _S.14_ and _S.15_`: a player holding the letter has both. What stands between is `_S.00_`, `when Prince_Lhotun is available` - his own click while no running quest holds a Person of his faction (WhenNpcIsAvailable) | The row says what to read: the running quests holding a Person of faction 382, and whether S0000001 parsed after his click | - |
| H4 | **minor (pins)** - four of the batch's laws survived a one-character mutation: the "Nothing is written" note drawn on a stamped row that has objectives; givesBackNo's toted item; its named-once rule; besideSpot's second ring (1.6 boxes) | Pinned | H4 (3): The Lost Artifact itself, stamped and not, through the real bridge and the Quests tab; givesBackNo over the queen's own lines with another item and a second reader; besideSpot with the first ring full - each mutant dead |
| H5 | **minor (pins)** - givesBackNo, inserted between clearingNo and asksOnAClick, took QA3L-NO-ASKS-clearer-named-twice's text: at the head the record mutated givesBackNo's return and SURVIVED, and clearingNo's named-once rule was checked by nothing (the lane re-aimed four lists, not `questaudit3_life.json`) | Re-aimed by content onto clearingNo's return (dead); `RPT1026-QUESTS-ABANDON-ALWAYS-close-row-dropped` re-aimed to H2's row (dead) | `tools/mutants/questaudit3_life.json`, `tools/mutants/rpt1026_quests.json` |

Mutants: `tools/mutants/audit_rpt1026_quests.json`, 10, all dead. The lane's 29 judged again: all dead.

### Suspected (H)

- **S1 - a beside spot's billboard can sit half in a wall.** besideSpot holds the line from the marker to the spot's
  CENTRE clear (`wall < d`), not its half-width past it: a wall 0.05 m beyond the spot stands half the billboard inside it,
  seen from the side. The pick box's front half stays clickable. What would prove it: a real tavern of BLOCKS.BSA whose
  single spawn marker stands within 1.1-1.6 boxes of a wall, two quests' Persons stood there through worldModes'
  standQuestFlatIn over the real interior collider, and the stood spot's distance to the wall against half its width.
- **S2 - K0C00Y05's sheet reads the inert No NO-ASKS-AGAIN clears (FB1013e, before this batch).** Its branch "leave"
  sets `_no_` and its `decide` objective is done on `_no_`: a first No latches "Leave _child_ where the child is" and a
  later Yes (the re-ask's purpose) takes the child home under that choice. The outcome is read off other tasks, so only the
  journal's choice is wrong. What would prove it: K0C00Y05 stamped through the bridge, No then Yes, rowOf's choices
  against its outcome. Not this batch's change; H1's law does not touch an inert No (the soft-lock it was made for).
- **S3 - a kept ladder receipt the service cannot settle holds the Herald for its week.** A mendable refusal
  (`signature`, `future`, `clock`) keeps the receipt (arenaClaims.js), and ARENA-ORDER now refuses every Fight while it is
  kept - the same block askTicket made on the floor before (AUDIT ARENA-LADDER 2), only earlier. What would prove a
  player hits it: a relay key the account service lacks, or clock skew between the two, in the services' logs.

### Read and found sound (H)

- ABANDON-ALWAYS: `holdsQuestorDoor` is the door's own scan (a click-bound questor Person); no main-story step, raid or
  the world's own quest gains an Abandon (no S0000 script names a `group Questor`; `PROTECTED_QUESTS` and the raid refusal
  stand); the real B0B81Y02 paid and unwritten is a row with Abandon, stamped and not; a hidden quest under Show hidden
  keeps its text, Track, Abandon and Unhide (#161 stands NOT REPRODUCED).
- QUEST-CROWD: the stands are the room's own list, cleared on leaving; drawn order is the fill's (`batch` set synchronously
  after the texture's await); the floor, ledge and table rules hold.
- QUEST-ZONE: `sharedClock` is online's signal from boot; the quest maps' mask equals the gate's (`wildMaskOf` of the same
  MAPS reader); on the real data no main-story dungeon and no `permanent` place of any quest pack stands inside the zone;
  offline the draw is DFU's.
- ARENA-ORDER: the guard precedes the floor, its flush is coalesced, every claim answer carries `ladder`, so the next press
  asks the moved climb; no Fight is refused that askTicket would have let through.
- CATALOG-READ: the reading step opens on the item carried, latches, and is done on `_S.15_`/`_S.16_`; on `_S.02_` it is a
  harmless step (the page logs 1024). BOUNTY-WAY: the clue is keyed by the group's stage and said again after a load; the
  tutorial's words match the code (the last kill pays, the region's law +2).
- Verdicts re-read: #1 (N0C00Y10-13 end `give pc nothing`; stamped, their gear is paid), #19, #20, #40 (People factions
  are zero-based after FactionFile's own `region--`, as DFU's), #44, #54, #141, #148, #165, #166-168 and #182 (QUEST-FIRST
  is on main, `70d9210c4`, and QUEST-ELSEWHERE says it before the choice), #175, #176 (the town seat's Charter line),
  #256, #262 - each stands. #212 corrected (H3).

Branch its branch, commit `787c22cdd`. No change to the relay's bundle (`server/src/index.js` and its imports) or the
account service; no migration.

## I - EVENTS

Lane I read `1b9d46c1e` (RPT1026-EVENTS) and the code as it stands at `2dc8f31a2`, with the real producers driven: the real
voyage (`ketchSim.mjs`) heard by the real link and judged by the real fight, including a Discord whose last resonator rang
true in its wind-up; the realm's own Orrery judge (`orreryJudge`, `orreryRightsSnapped` as `_sdTurn` applies them) over a team
that learned the gearing by turning, against one to eight griefer accounts, under four laws; the real engine
(`AudioEngine`) over a recording context with the crowd's own producer (`RemotePlayers._syncAttackSound`) and the player's
own (`playPlayerVoice`, `playerPainVoice`); the gate, arch and star pools' frames and the portal and cart pools' frame
order; the lane's 40 mutants (39 dead, one recorded equivalent) and the bible gates. Two defects, both fixed.

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| I1 | **ORRERY-HANDS made the Orrery unsolvable for a team that had learned it, against a single griefer.** Held hands hold each other: a held hand waits while ANY other has turned in the company's minute, so the first held hand to turn keeps the thread while it turns. The old law's snap freed every hand; counted for the Hollow, nothing did. A team of three that spent its six apiece learning the gearing (each long turn mended - the road no longer than they found it), then one griefer account turning the long way: over the realm's own judge the Concord came in 0 of 24 slots (the old law: 24 of 24), and 0 of 24 for two to eight griefers. The lane's contest only ever had a team that never lengthened the road. | A hand told to wait while every hand it waits behind is held too is marked (`sdBrain.js` `orreryWaited`, called by `orreryJudge` as it refuses) and the snap begins its count again (`orreryRightsSnapped`); a hand held out by a free hand's turns keeps its count, so the lane's contest stands (K 4, 5, 8: every slot). The learned team now reaches the Concord in every slot against 1, 2, 4 and 8 griefer accounts. The relay's bundle changed (`sdBrain.js`): RELAY_VERSION owed. | `test/net/superDungeon/audit_rpt1026_events.test.js` (2: the learned team's contest through `orreryJudge`, the mark's law and the judge marking); `tools/mutants/audit_rpt1026_events.json` I1 (5, dead - `mark-never-set` is the head's law and kills the contest) |
| I2 | **VOICE-CAP silenced the player's own sounds in a crowd, and its record said the opposite.** Audio.md, the record and the pin say a flat shot always finds a voice; the pin's crowd was built by hand at volume 1, refDistance 2. The crowd's own producer plays a peer's swing at 1.1 through `PEER_SOUND_PROFILE`, whole inside six metres - louder at the ear than the blow that lands on me (`PLAYER_HIT_VOLUME` 1), my pain cry (1) and my steps (`FOOTSTEP_VOLUME` 0.7). Probe: forty peers swinging within 4 m filled the 32 voices, and the hit on me, the cry, the step and my hit on a foe two metres off were all refused; a flat shot that did sound was the quietest voice, so the next near swing (or my own next sound) stole it. | Two ranks in the law (`audio.js` `voiceRoom`): a flat one-shot (`playOneShot` - the page's own, at the ear) always plays, the quietest positional voice stolen for it (the quietest flat one only when every voice is flat); a positional shot never steals a flat voice (`_voiceKeep` marks a voice with no panner flat). Positional shots keep the lane's law. Audio.md, the record and Ledger A's VOICE-CAP row say so. | `test/systems/audit_rpt1026_events_audio.test.js` (2: forty peers through the real `_syncAttackSound`, then the hit, the real `playPlayerVoice` cry and the step each sounding, a crowd's swing stolen for each and never one of mine, a far peer still refused; the law's two ranks) - both fail on the head's `audio.js`; `tools/mutants/audit_rpt1026_events.json` I2 (6, dead) |

Re-aimed by content (the text they named moved with the fixes, every one dead): `rpt1026_events.json`
ORRERY-HANDS-counts-begun-again and ORRERY-HANDS-nets-kept, `sd11b.json` SD11b-L7H2-the-rights-unasked, `egz_sound.json`
EGZ-audio-scope-unread. No host grew (hostceiling green); no translation owed (no new player-facing words). The relay's
bundle changed (`src/net/superDungeon/sdBrain.js`, and a comment in `server/src/index.js`): `test/net/relayversion.test.js`
fails until RELAY_VERSION is bumped (owed, not taken here, as briefed); the account service did not change; no migration.
Checked: `npm run lint`, `npm run types`, the bible gates and hostceiling (77 with my two pins), the 186 test files that
import or name `audio.js`, `sdBrain.js`, `voiceRoom` or `orreryJudge` (1,822 tests: 1,814 pass, 7 skipped, the one owed
relay-version failure), my 11 mutants and the 29 others aimed at the two changed modules (all dead).

### Suspected (I)

- **A Discord already winding up when the last resonator rings true still lands.** Probe (`probesI/ketchWard.mjs`): the ward
  broke at +264.5 s and the Discord due at +266.8 s landed on me, a quarter of my health. The relay keeps it too: `retune`
  drops only the Warden's own blows (`b.o !== KW_ID || b.at <= now`), and a clock blow is `o: 0` (`clockBlow`), so both the
  room and the page land it. Sky-Ketch.md section 7 does not say either way. Report 228 says the wipe came "even if" the
  cores were set; KETCH-OWED's repeat explains most of it. What would prove a defect: the owner's word that the ward's fall
  calls off a Discord in flight - then `retune` and `foldKetch`'s `ward` case drop a whole-bridge clock landing after it, and
  the link's `owed` list with them.
- **Guests are one turner for the whole Hollow.** Since ORRERY-HANDS, one guest's six long turns hold every guest while a
  registered account turns, until the Hollow ends (before, until the snap). I1's mark frees them when only held hands kept
  them out. What would prove a harm: a realm's guest share and their refusals (`w`) in the relay's counters.
- **My own blow's hit on a foe is positional** (`play3d` at the foe, inverse from 1 m): two metres off it reaches the ear at
  0.55, below a crowd's swing, and I2 does not rank it with the page's own. Unity would have played it from the enemy's
  source too. What would prove a harm: a crowd's live voices at a real breach (how many are louder than 0.55).
- **#220's hold** counts a member within 3 m of the engine on the ground's plane (`egBrain.js` deepway chamber 2) from the
  room's poses; a stale or another hall's pose would stop it. Not reproduced here; the breach's id and the room's poses
  would prove it.

### Read and found sound (I)

- KETCH-OWED: `paidKeys` by fight and number, trimmed to 64, cleared with a new fight and `leave()` (only on boarding and
  unboarding - `ketchClient.js`), so a `ws` state word re-delivering a landed blow owes it no more; the songs' broken check
  still runs after `paid`. The real voyage lands each Discord once at a quarter of the pool. (The second pin's title says a
  new fight's blow of the same number is owed; nothing asserts it - true by the key, and the lane recorded the clear as
  equivalent.)
- SPIRE-SPOILS: the real host's `spoilTargets`/`spoilName` read `floorPool()`, the Hour's pool while `egHallBreach` stands;
  the press is the dungeon dispatcher's `spoil` rung (`worldModes.js` `host.takeSpoil`); a swap (`egSwapCircle`) never
  stands the circle again, so no provider doubles.
- SPIRE-CATCHUP: `E.end`, `home` and `forsaken` return before the step; a witness's body is held through it; the rest is
  the one stage left out (its next circle is the build). A player who left is never stepped in: `walkOut`'s exit runs at
  the next frame's top, and the step's frame returns on `E.end` or `home` first.
- VOICE-CAP (besides I2): the PEERFX1 observer runs before the bound, so a blow on me is still told to the room; `play3dVoice`
  answering null is handled by its one caller (`gatherSounds.js`); every one-shot's chain is let go at `onended`, a steal's
  stop included; loops and the Windfall `source()` are uncounted.
- GATE-WAY: every point is the scene's (the gate's `gateSceneXZ`, the arch's `egArchSceneAt`, the star's pixel and spot, a
  portal's `toScene(native)`, a wagon's `retarget`), and the gate and star pools frame before `portalGates.tick` in the
  world frame, so a recentre cannot match a portal 819 m off; one pool of each kind; the Elite call's portal is never said on
  the wire, so `eventGround: false` opens no way round; arches stand only from hub-signed calls near their opener; a hidden
  wagon offers no press target and its riders keep their true seats. A Portal Stone refused near a gate spends nothing and
  says why. Report 287's "blocked" is the drawing (PR-WAGON1 stands no peer's wagon in my collider).
- ORRERY-HANDS names: `sdHallNamed` reads `online.peers`, the realm room's whole roster, concealed or not; the five new
  strings' placeholders and plurals are intact in all 24 languages; nothing says which way a turn went.
- CROWD-KIN: `_pupMine` does not depend on the cut (`peersNear` is not crowd-cut), so a cut player's revenant that turns on
  me is drawn; `foeAabb`'s only readers are the plaque's sweep and the press; an arena puppet's owner is a constant no cut
  holds; `rt` names a band only under a revenant.
- The verdicts: #216-218's KETCH-FIX (`6fa55aa46`, 10-25 01:55 UTC) and #138/#162/#196's STAR-CLEAR (`f7898a91f`, 10-24
  16:01 UTC) are on main and after their reports; #27's anchor (`egBrain.js:"if (g.i && !egBodyById(F, g.i)) { g.done = 1;"`)
  stands; LAIR-DOOR, LAIR-REACH, LAIR-HOME, LAIR-WALK, GAUNTLET-SLAIN and GAUNTLET-PLATES are on their records; #207's
  LOST-SPOILS shipped 10-22, before the report; #228's quest half is QLSK03's witnessed claim; #238's Vestige families each
  have every name and line, and pt-BR carries every `eg.` string English does (the names are English in both - a screenshot
  would say what was missing).
- The rules: no host grew; no line-number cite; no report quoted or player named in the lane's tree; Ledger A rows for
  VOICE-CAP, GATE-WAY, ORRERY-HANDS and CROWD-KIN stand (I1 and I2 narrowed them).

## J - WORLD

Read at the batch head `2dc8f31a2`, the lane's five commits (`cd300369b`, `32c77274a`, `ccc6f21cd`, `6b40a6578`,
`9deb856c9`) and the code as it stands, on the freeware's data (`ARENA2_PATH=/home/claude/dfdata/arena2`). Driven: the
real interior build (`interiorContext.js` buildInteriorContext) over the caravan's own block and an unlit room, the real
decor room and base (`decorRoom.js`, `decorBase.js`), Wildertown, Chesterwark, Daggerfall, Wayrest and Sentinel laid out
under the town packs with every building's models raycast through the real collider, the real naval host over Come Sail
Away's pool (`test/navalSea.mjs`), BLOCKS.BSA's 9,005 room records censused for their lamps, the lane's 44 mutants
(44 dead) and my own. Three findings, all fixed in `17b3886ef`; every pin below fails at the head (J3's is a guard, see its row).

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| J1 | **DARK-ROOM read the room's LIVE light list.** `roomAmbient` was handed `interiorCtx.lights`, which a home's placed lamp joins (`decorRoom.js` roomLights) and a lamp its owner takes out leaves (`decorBase.js` hide). One candle set down in a room Daggerfall left unlit put the whole room back to 0.18 - dark but for the candle (2 of the 97 houses for sale, 78 House3 rooms and 2 guild halls lay no lamp); and the caravan's lantern taken out by its owner (WAGONS2-BASE) lit the caravan at the ambient-only 0.8 - a lit room made bright by putting its lamp out. The record's own "a home's placed lamps among them" was the defect. | Both interior hosts hand `roomAmbient` the lamps the room was BUILT with (`interiorContext.js` `roomLamps`, frozen at the build): nothing a player does in a room moves the level it is lit at. Record, Port-Ledger A DARK-ROOM and Rendering-Arc R8 made true. | `test/scenes/audit_rpt1026_world.test.js` J1 (the caravan's block through the real build, its lantern taken out and put back; an unlit room with a lamp placed through the real decor room; both hosts by source - the behaviour test reads the host's own argument off its statement). PIN MOVED: `rpt1026_world_darkroom.test.js` by-source, `windows1_view.test.js`, `time1.json` and `rpt1026_world.json` DARK-ROOM-host-unwired records. Mutants J1 (3) dead. |
| J2 | **BANNER-WALL's "every door's cloths on their walls" was the box asked twice.** The pin's `onTheBox` is the law's own test, and its frames took the first model's box where the pixel build unions every model's (`pixelBuild.js` homeFrames). Asked of the building's own faces through the real collider, a cloth still hung before no wall wherever a door stands on a vestibule or in a porch with the facade stepped back beside it (ARCH3D 326, 339, 249, 324, 702 and more): 19 of Wildertown's 364 doors, 29 of Daggerfall's, 29 of Chesterwark's, 14 of Sentinel's. The fix took ~85% of the floating cloths (124 -> 19 in Wildertown), not all. | The pixel build hands each frame its models (`parts`); `hallBannerAnchors` hangs a cloth only where a face of them stands behind both its ends, at its lower edge and its middle, within `BANNER_WALL_BEHIND_M` (1.2 m) of the door's plane (`hallBanners.js` wallBehind, memoised per frame); a frame without models (a castle gate, a test's) asks the box alone, as before. Wildertown: 240 pairs, 124 singles, no door left bare. Record and Online-Arc made true. | `audit_rpt1026_world.test.js` J2 (Wildertown under the packs: every hung cloth met by the real collider's ray against its own building; the law; the build's `parts` by source). PIN MOVED: `fb1009_yardfoot.test.js` and `fb1012b_yardline.test.js` (the frame's line), and the FB1009 (2), YARD-LINE and RPT1026-BANNER-WALL-both-hung records re-aimed (dead). Mutants J2 (6) dead. |
| J3 | **The sea-brake guard asked nothing of the fight it is named for** ("a navy cutter alongside fighting a pirate"): it asserted only that both ships were at sea, so a cutter that never engaged passed it. (Driven: they do engage - the guard's answer stands.) | The guard asserts the cutter and the pirate are engaged with each other. | `rpt1026_world_seabrake.test.js` (a guard: passes at the head, as it should; the mutant shows the new line is the only one that notices). Mutant AUDIT-RPT1026-J3-the-cutter-stands-off dead. |

No host grew: `createWorldModes` the same statement (11,025 of 11,025), `bootWorld` untouched; `pixelBuild.js`,
`hallBanners.js`, `interiorContext.js` are modules. PERF7's runaway guard on the pixel build's model loop held at 3,959
of 4,000 characters (the J2 comment kept short for it). No relay or account-service file changed, no migration, no
player-facing words (no l10n owed).

### Suspected (J)

- **S1 (pre-existing, UNSTUCK-OUT's law, now WAGON-OUT's too)**: `openGroundNear`'s `dry: floor >= tvSeaY()` counts a floor
  EQUAL to the sea's level as dry. Where Deep Waters does not carve, the open sea's floor is the ocean's clamped elevation -
  possibly the surface itself, give or take a float. Proof: `heightAt` over open sea against `tvSeaY()` on the real
  streaming world with Deep Waters off; if equal, a landing ring can stand the player on the sea.
- **S2 (WAGON-OUT's record)**: "a palisade" - `heldInSolid` asks parity inside a CLOSED solid; a single-skinned wall holds
  nothing, so a caravan backed to one lands its owner on the far side of it. Proof: the closedness of the town packs'
  palisade models, through the real door as `rpt1026_world_wagonout.test.js` drives it.
- **S3 (DARK-ROOM, look)**: an unlit room at 0.8 also takes Improved Interior Lighting's fireplace lights and a LAMP-KEEPER
  keeper, neither in the room's lamps; and on the Enhanced Lighting lane 0.8 is ~0.6 linear under INTERIOR-DIM's eye,
  brighter than any lamped room's ambient. Judged only by a render of such a room on the lane.
- **S4 (GUILD1d, not this batch)**: a cloth's top (BANNER_TOP_M 3.5 m) stands over a small house's eave - the ray at the
  top finds no wall on ~100 of Wildertown's 623 cloths while their lower edges hang on the wall. A render would judge it.
- **S5 (#208's verdict)**: `legacyHost.js` play() loads a member's own newest save when they have one, so a character made
  from the menu and switched to opens where it was made (Daggerfall) - AS DESIGNED rather than NOT REPRODUCED. Proof: the
  account's family and how its characters were made.
- Not this lane: `test/world/fb1009_yardfoot.test.js`'s ARENA2-only test 6 (desert towns' doors, "a point 2 m inside
  every door is still the house": 2,842 are not) fails at the batch head itself - CI skips it without ARENA2.

### Read and found sound (J)

- **LOOP-AWAKE**: every `setBoatActive` caller is gated on `activeSelf`, so `awake` is never overwritten by a second hide;
  a placement's PlaySlow plays synchronously (startCoroutine), so a boat hidden at once still wakes its slow loop; under
  way the fast loop alone comes back.
- **TRAFFIC-REAL**: `realClock` is `dt / timeScale()`, advanced only unpaused; the director's sub-steps spend the frame's
  real seconds once; a reset forgets the last read; the rolls at x60 measured once per SPAWN_EVERY of real time.
- **WAGON-OUT**: the landing asked only when held; my wagon's box excluded by `sphereOverlaps`; the visit path shares it.
- **RAIN-EYE**: `wxEye = mwv.eye` in every frame; the return values and the underwater gate unchanged.
- **CAUSEWAY**: the paved step only where the sea would refuse it; the boat layer launches nowhere on a causeway, a track
  still fords.
- **STAND-THROUGH**: the head's line asked only for the 0.9 m rise (no rise standing); the climb's, the swim's and the
  mantle's stands go through the same arm; no refusal where the sphere sweep already cleared.
- **FAR-QUAY**: `dryPixel`'s lower bound holds (ground noise never negative; landforms keep every height over the knee over
  it); `harbourKnown`'s pixel law is `csaPixelAt`'s; the book sounds each port near; the ether isle path unchanged.
- **CONFIRM-REREAD / CONFIRM-ONCE**: the reread compares through the same `decorPieceOf` the room was stood with; a changed
  room is the service's own `decor-rev`; `keeping` is let go in `finally` on every exit; the caravan's local path guarded.
- **DECOR-VERBS**: the folded frame only for the decorator's keys while it browses; the yard's namer is ungated already;
  the hosts never read `worldHoverFrame`'s return.
- **The rules**: d4d32cdbc paraphrased every report phrase the lane's commits had quoted (4-gram check of the head's
  files against the inbox: none left); no player named; no line-number cite added; the lane's 44 mutants all dead.
- **The verdicts**: #14, #17, #30, #49, #51, #53 (the 30-minute cooldown is `UNSTUCK_COOLDOWN_MS`), #60, #72 (DECOR-CLEAR's
  gate takes a piece placed round the body too), #77-79, #88, #126, #158 - the records cited exist and cover them; #69
  ACCOUNT-HOMES merged 2026-10-23 (#653); #201, #205 (5dfc764b6, 10-24 23:54 after the report's 12:30), #273 (SIGN-PASS
  e2d83ca56, a sign's hanging parts passed by the body) all on main after the reports; #272 the Bookroom is a Library name
  (`buildingNames.js` LibraryStoresB) and IsShop leaves libraries out; #37 TV2's governor; #169, #170, #139 the rules
  named; #193, #274 the guard (now asking its fight, J3); #6, #15, #86, #93, #122, #136, #270 left as recorded.

## K - CLIENT

Read: the lane's eight commits (`3baf01508` .. `9a09a47ad`, and the paraphrase pass `d4d32cdbc`) and the code as it stands
at the head, against the inbox's reports. Driven on the real modules: the find (`registerEgFind` with the world host's
own door and throw, the real death door `raiseEnemyDeath`, the real take `takeOneInto`, the real restack), main.js's own
`crashOverlay`/`crashDismiss`/context-loss handler over a DOM shim that keeps an element's rules, the one cast engine
(`createPlayerMagic`: a peer's `spellVisual`, my own `castInput`, an event's `skyFire`), the menu's own row through
`portPool` and a pressed button, the real frame pacer (`installFramePacer` on a lifted page), the held map's stage
through the pad's own `domPointer`, and a sweep of `src/` for captures. Every mutant of the lane re-run (27, dead at the head) and
twelve of my own aimed at its claims (four survived: three are K3, the fourth the share's default for a stored value that
is no number - a defensive branch, not a finding). The verdicts re-checked against the releases (`Update 0.0.n`
publish times) and the merges that carried each cited fix.

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| K1 | **A Weir Key face left in one dungeon was still counted in the next.** "Out of the dungeon" was read only when an answer landed (every ten minutes), and the find's door said only *in a dungeon*: out of one and into the next - or into the same one, which the world's modes build anew at every entry - before an answer landed outside, the face of the visit before stayed "lying" on a body its context took with it. Every restack there held the pack a key short of the balance for each such face, none of them anywhere to take up, until an answer landed outside again (probe: balance 1, pack 0, lying 1). A find answered after the player left could also throw its face onto the body left behind and count it where it landed. | A face is kept against the VISIT it was thrown in: the world host's door is `egFindPlace` (the dungeon's tier and its context), a face of another visit is folded as one away is (`weirKey.js` weirKeysLying), and a late answer puts its key in the pack. The world's `tierNow:` entry rewritten in place as `placeNow:` - no host line added. | `test/scenes/audit_rpt1026_client.test.js` K1 (5: the door and its wiring; out and in with no answer outside - the whole balance; a find of the next dungeon still counted and taken up; a late answer; a face laid while away). Fails on the head (pack 0, lying 1). PIN MOVED: `egeco_hosts.test.js` reads `placeNow`; `egeco_relay.json` EGECO3-the-key-not-thrown and -PL-key-on-the-copy re-aimed by content (dead); `rpt1026_client.json` RPT1026-WEIR-away-not-folded names K1's pin too (the visit's fold made it survive its own pins alone; dead with K1's fifth) |
| K2 | **The lost graphics context's report carried the new Dismiss.** That report is the one the game does not run on past - nothing draws again on the page, and the report is its click-to-reload. Dismissed, a dead picture was left with nothing on it to say how to get back. | The report is kept: `crashDismiss` puts no button on a kept report, and the loss takes off the one a report already up had (`main.js` `_kept`). Every other report keeps its Dismiss. | `audit_rpt1026_client.test.js` K2 (2: the lost context's report has no button, nor after a later throw, and still reloads; a report already up loses its button at the loss, a plain one keeps it). Fails on the head |
| K3 | **PEER-SHAKE's pins held two of its claims by nothing**: an event's sky fire (drawn, no caster) keeping its whole kick - a mutant giving it the peers' share survived - and the Motion row's own values - Full 0.75, Half 0.25, Off 0.1 all survived (the row was only read for its place in the map). | Pins only (the code is right). | `audit_rpt1026_client.test.js` K3 (2: the engine's own `skyFire` at the share Off kicks whole; the menu's own row, pressed Half->Off->Full->Half, writes 0, 1, 0.5 and the engine kicks none, my own bolt's whole kick, half) |
| K4 | **Record: #82's row said "no build named"**. The report carries its build (0.0.281, as every report does - REL8), was sent minutes after #81 by the same reporter, and ties itself to #81 in its own words; #81 is OW-HITCH's case. | The row reads it with #81: if the drop is #81's, OW-HITCH took it out; what stays still needs data. | the record (`Field-Bugs-2026-10-26r.md` row 82) |
| K5 | **Record: PAD-CAPTURE's "the four that caught their own refusal"** - there are six (four captures and two releases, in five files); and the door's own comment said a missing element answers false, where it answers true (and the lane's pin asserts true). | The record and the comment say what the code does. | the record; `src/ui/pointerCapture.js` |

Mutants: `tools/mutants/audit_rpt1026_client.json` (11, all dead - K1 5, K2 2, K3 4). The service bundles are not touched
(no `server/`, no `server-account/` file); no migration; no new player-facing words (no drafts owed).

### Suspected (K)

- **K1's other door: a body gone while the player stays.** Within one visit, a body can leave with its face still in its
  list: the stream's un-death or the hour's respawn (`setFoeDead(f, false)` / `retypeFoe`), a rest encounter the host
  stops listing (`dropSharedFoe`, BODY-CAP's shed), the joiner's copy re-patched off the wire (`patchFoe` assigns a new
  `f.entity.items`). Each would leave the face counted - the pack a key short - until the player leaves the dungeon (now
  folded at the next answer, K1). What would prove it: an elite killed on this client, then one of those doors run on
  the real dungeon context before the take-up, then a restack. A fix would keep the body's entity with the face and count
  it only while `entity.items` is still its list and its foe still has a corpse.
- **A Dismiss over a dead loop.** A throw out of a host's own frame stops that loop (world.js re-arms at the frame's foot -
  OFFERING-RAY's record: "the game stopped"); its report now has a Dismiss over a frozen picture, and the reason is gone
  from the screen (it stays in the console). Whether such a report may be dismissed is the owner's call; what would
  decide it at the press is `frameClock.js` framesBegun (no frame begun since the report went up: the game stopped).
- **#85: the browser's own context limit.** The lane's NEEDS DATA stands, but one cause was not named: Chromium loses the
  OLDEST WebGL context when a page passes its limit (16), and the gate's veil makes a context at the step into a gate.
  The page holds few (the game's, the veil's, the ink's, the intro's, the POI decode's), so it is unlikely; a console
  line "Too many active WebGL contexts" in the reporter's log would prove it.
- **The Frame Rate Cap tip in twelve languages names Off in the language** (Aus, Désactivé...), while the row's value
  reads `Off` in English (settingsLaw.js fmtNumber) - the setting's own label was kept English for that reason, its
  value was not. A reader's eye on the screen would decide it.

### Read and found sound (K)

- SPARKS: `sparks(t)` is called only from the window's own rAF `frame(t)` - one clock; a burst's first frame stamps it,
  its ring never under its radius. Every other `arc` in the window reads no clock.
- DISMISS (any other report): the button after the text, its click stopped, put back after a second throw's text.
- WEIR-FACE: the restack, the take-up through `takeOneInto`, the load's fold clearing the lying list, the room's body
  (no face), the dispose; `egClient.js`'s rust line never fires on a pack the faces keep short.
- The Weir Key card's line: the card's own key (`eg.key.shared`), off `EG_TEXT`, so the relay's bundle is untouched.
- LIFTED-CEILING: the ceiling is set only by `installFramePacer`, which runs only where the shell lifted the wait
  (`daggerShell.framesLifted`, true only with the VSync-off switches) - a browser and the app with VSync on read Off as
  no cap; `_resetFrameCap` is a test seam alone; the counter's pace line reads `cap 300`. A 360 Hz screen with VSync off
  and the cap Off now draws 300 - the row's own top, the named departure (Port-Ledger A, FPS-CAP1).
- PEER-SHAKE: `spellVisual` is reached only from `peerCastVisuals` (players), so a foe's missile, the relay's bodies'
  and my own keep their whole kick; a peer's touch lands no kick; the Spire's quiet company returns before any.
- The recoil's label: English-only labels, no stale "On Damage" anywhere but the record's history.
- PAD-CAPTURE: every capture and release in `src/` (outside the labs) goes through the door or a try on its line; the
  held map's four arms set their state before the capture, so a refused press still lands; the swallowed errors are
  the capture's own refusals (NotFoundError, InvalidStateError), nothing a caller reads.
- GL-SAID: the words name both causes; the GL-LEAK release paths unchanged.
- Verdicts: #9, #41 KEY-FACE (19f read at 0.0.265, after 0.0.235 and 0.0.251); #2, #97, #146, #186, #243 FIRM-RETRY
  `98930c243`, on main in #1280 (merged 22:12 UTC 10-25, Update 0.0.410 - after 0.0.392, #243's build); #114-116
  OFFERING-RAY, released in Update 0.0.299 (23:00 UTC 10-20) after their 0.0.296; #81 OW-HITCH `e394529e8` on main in
  #1139 (10-22); #160 LEVEL-EVEN (10-19, after 0.0.241); #134 (FIRM-MAX lifts the ceiling; the share floored and one
  +15 budget), #155, #129 (a held item's work is the magic round's; the pacification roll an edge) read as the record
  says; #52, #147, #188, #164 (the one `os.tmpdir()` write is Windows' registry probe), #184, #260 need data as it says.

## L - MISC

Read at `2dc8f31a2` (the batch head) with the freeware's data: the lane's eleven commits and the code as it stands,
driven on the real producers - the two phone screens mounted alone in Playwright's Chromium over Vite's dev server (the
real Bank window, its port view and the touch layer at 390 x 844 and 844 x 390; the real enhanced talk panel at ten
sizes, desk to phone, both ways up); the bed through the real interior host (the mode machine over a stub host, a house
stood by `restoreInterior`, a bed pressed with and without a poison); the dial, the HUD lines, the rumor mill, the
escort faces, the giant's ground, the cast pace and the Fighter Mage's sheets through the lane's own pins and mutants
(31, re-run: 31 dead) and mutants of my own; the ten ALREADY FIXED, ten AS DESIGNED and fifteen NOT REPRODUCED / NEEDS
DATA rows traced against the code and the records they cite.

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| L1 | **TOUCH-FIELD's entry stood under the Bank it typed for.** The field's press raised and focused the touch layer's entry - as the layer's child, one stacking context at z-index 5, under the ported window's host (`.port-host`, z-index 13, the whole screen). In Chromium at 390 x 844 and 844 x 390 the topmost thing at the entry's centre was the Bank's own stat row and columns: the digits a finger typed showed nowhere until the keyboard's Enter sent them. | The entry is the page's own (`document.body`), at `TOUCH_ENTRY_Z` (39) over the windows a typed field stands in, under the asset picker; the layer's dispose takes it. Re-probed: the topmost thing at its centre, and 250 typed there is the Bank's 250 on Enter. | `test/ui/audit_rpt1026_l.test.js` L1 (fails on the head); `audit62_touch.test.js` AUDIT FONT F6 (pin moved: the field where it stands now) |
| L2 | **TALK-SIDEWAYS left a phone narrower than 720 pixels unusable on its side.** The fix's sizes were all wider than the phone rule's 720 px; under it (640 x 360, a 360-wide phone on its side; an iPhone SE's 667 x 375 and 568 x 320) the rule still stacked the head and the foot into two rows each, and the two columns put the categories in 40% of the width. Measured: the topic list 66 px at 640 x 360 and 26 px at 568 x 320 (under one row); Work cut at the panel's edge at 640 and wholly off the screen at 568. | Under 500 px high the head and the foot are one row each and the categories shrink to their strip (`enhancedStyle.js`). Re-probed: the list 152, 167 and 112 px, every press the topmost thing at its centre, no label overflowing; 844 x 390, 740 x 360, 915 x 412, upright and desktop measured unchanged. | `test/ui/audit_rpt1026_l.test.js` L2 (fails on the head) |
| L3 | **BED-PRESS-INDOOR's press was over before a rest that asks first.** `_restFromBed` stands for the press alone (`restFromInteriorBed`'s `finally`); poisoned or diseased, REST-WARN asks first and the window opens on the box's Yes. Driven through the real interior host: a bed pressed - a bed's rest; the same bed pressed while poisoned, answered Yes - `rough`. The street's ship bed (world.js) had the same gap. | The press is the window's: `createRestWindow`'s second argument is DaggerfallRestWindow's `ignoreAllocatedBed`, passed by a bed's press alone (BedActivation's `true`); the door marks the bag `bedPressed` for the open, where `setResting` and `restAct` read the place and the point (`restDoor.js`, `shared.js`). world.js's ship bed hands its press through the door, read as the toggle runs (no logical line added; createWorldModes untouched, at its ceiling). | `test/scenes/audit_rpt1026_l_bed.test.js` (2; the host test fails on the head); `partyrest1.test.js`, `surv4_rest.test.js`, `restlodging.test.js`, `pvpdungeons_game.test.js` (pins moved), Wild-Zone.md's REST-WARN anchor moved; `auditdrops.json` AD-D1 and `surv4.json` SURV4-the-kind-is-read-every-hour re-aimed by content |
| L4 | Rules: HEIR-WAITS' pin named its fallen with the report's own character's surname, race and sex. | A name of the test's own. | - |
| L5 | Record: JOURNEY-TRAMPLE's FOUR HOSTS said world.js alone runs the riding contacts; exterior.js runs them too (AUDIT-RR F15) - it stands no journey, so nothing changes there. | The record says so. | - |
| L6 | Record: HEIR-WAITS said the door makes the newborn "as the Succession makes one ... at the fall's own minute"; the in-world Succession bears its newborn at its choice's minute (`succeed`, `deps.now()`), a breath after the fall. The door's fall-minute is a fair choice; the line now says it is the door's. | The record and the pin's message say so. | - |

Mutants: `tools/mutants/audit_rpt1026_l.json`, 14 records, 14 dead. The lane's `rpt1026_misc.json` re-run: 31 dead.
Re-aimed and re-run: `auditdrops.json` AD-D1, `surv4.json` SURV4-the-kind-is-read-every-hour (both dead).

### Suspected (L)

- **S1 - the HUD lines on a slow phone (#191).** TOAST-STALL ends the stall a repeated back line made; a second cause
  the lane did not name: the world host clamps a frame's dt at 0.1 s (`world.js`, `Math.min(0.1, ...)`), so below
  10 fps the HUD's clock - every row's second and its slide - runs slow by the same factor. To prove it: the report's
  phone's frame rate (the HUD's own frame counter at the time); not changed - the clamp is every timer's law.
- **S2 - TOUCH-FIELD on an iPhone.** The amount's entry asks for the number pad (`inputMode = 'numeric'`), and iOS's
  number pad has no Return key; the entry sends on Enter or the nav row's ✓, and that ✓ stands under the ported window
  (z-index 5 against 13 - measured; at 390 px wide it also starts 16 px off the screen's left edge). On an iPhone an
  amount typed would have no way to be sent. To prove it: an iPhone in Safari at the Bank. The cure would be the entry's
  own send (its own ✓ beside it, or the text sent on the keyboard's Done).
- **S3 - the return to the title in #110.** HEIR-WAITS gives the waiting house a door; why the page went back to the
  title before the heir was picked was not traced. To prove it: the client's console at the fall (the death screen's
  reset and the realm tombstone's answer).
- **S4 - the notice board's cap (#253).** The count is live notes on every board (`board.js` liveCount, expired notes
  excluded), and the refusal says only "You have 3 notes up already" - nothing says they may stand on another town's
  board, so a player who saw their own board empty had nowhere to look. To prove it: the account's board rows.

### Read and found sound (L)

- **TAB-REPEAT** - the stack's listener returns on a repeat after swallowing it; no window on the stack acts on a held
  QuickDial key, the host ladders swallow repeats too, and the dial's own close still answers the next press.
- **TOAST-STALL** - a repeat behind other rows is dropped, the lone row still refreshed; mutating the guard to `> 2`
  stalls the second-to-last row and the pin dies.
- **RUMOR-ORPHAN** - removeQuest is the only door a quest leaves the machine by (clearState aside, which a load's sweep
  follows); a restarted quest's tombstone rumor goes with its old uid; a tombstoned quest's words still expand during
  its week.
- **FACE-ORPHAN** - one bridge per page (world.js, exterior.js), restored before the faces at a load; a shelved quest
  stays in the machine, so its faces are hidden by QUEST-SHELF-FACES and never dropped.
- **TOUCH-NO-LOCK** - `requestLook` is the one door (no other `requestPointerLock` in `src/`); a touchscreen laptop and
  an iPad with a trackpad answer fine + hover and still lock.
- **CONFIRM-SHEET** - every other `confirming = null` clears the sheet with it or is overwritten by the next ask; a
  chained ask after a Yes reopens the sheet; on a wide screen `.open` moves nothing.
- **JOURNEY-TRAMPLE** - every journey that drives the motor is under `rideOnTheRoad` (the Overworld's view and its
  keys' walk, a Travel Options autopilot, a party's walk); a Travel Options panel without an autopilot runs at x1,
  steered; a carriage is fast travel. Pinned by source (rr2_realism's precedent).
- **HEIR-WAITS** - the newborn is offered exactly where `fallOutcome` offers it (the heir answer, the Descendants dial,
  a retired elder), an ended line has no pending fall, and the take refuses a fall that may not raise one; the
  placeholders match in all 26 languages.
- **GIANT-ROCK** - a pixel is in `built` (so its heights finite) only after its World of Daggerfall pieces are filed in
  the collider, so the spot is never asked of a half-built pixel; `insideSolid` reads a line straight up, which holds an
  open-bottomed rock; both doors ask.
- **CAST-PACE** - the arm is paced to `castReleaseS(rate)`, frame 5 of the classic hands at the same rate, and the spell
  leaves on that frame for either look; `castBusy` reads the classic lane alone, so the spam rate is the same too; the
  damage is not read anywhere near it.
- **SPELL-SHORT** - the record scale multiplies the XML's, where ACRO-SHORT's replaced it: the one class record with a
  scale stands on the default XML scale 1, so its size is unchanged (checked over every class skin).
- **The verdicts** - the ALREADY FIXED rows' records exist on main and on builds after the reports' (HORSE-WAKE's
  commits on 10-25 after #234's report); FOE-KEEPS leaves nothing to lose to a foe in the zone (#24). The AS DESIGNED
  rows hold on the code: #285's line is the Broker's Steal-mode reply (`sigilBrokerPool.js` activate), #239's cure ends
  every poison entry (`cureAllOfKind`) so the warned poison was a later one, #149's sentence raises the crime's own
  standing (RaiseReputationForDoingSentence's port). NEEDS DATA: #253 (above, S4) and #258 (NUDE-DECOR swaps a person
  placed in a home; a home's other pieces need its rows) checked on the service and the decor, as named.

Branch its branch, commit `ec9ecabd3` (on `2dc8f31a2`). No change to the relay bundle or the account
service; no migration; no new player-facing words (no drafts owed). Gates: lint, types, the bible gates and hostceiling
green; 2,842 tests of the files that import or name what changed run (two more pins moved - restlodging, pvpdungeons_game - then green); mutants: the
audit's 14 dead, the lane's 31 dead, 55 older records over the changed files dead, AD-D1 and SURV4 re-aimed and dead.
Probes: `SCRATCH/auditL/` (fieldProbe.mjs, talkProbe.mjs, their logs and screenshots).

## M - RECORD

Read at the batch head `2dc8f31a2` with the freeware's data: the record page row by row against its sections (a parser
of every table row, 287 rows for 293 reports), every ALREADY FIXED's cited sha against main and against the report's own
build (`merge-base --is-ancestor` where the shallow clone holds the build, the send time where it does not), the merge
`d04e0e214` by `git show --remerge-diff` (every conflict's resolution against both sides), the bump `2dc8f31a2` (the
relay's and the account worker's import graphs walked by `test/importGraph.mjs` against the batch's diff, the 63 moved
pin files run, 744 green), migration 0178 against every `law_v`/`handed_to` read and write in `server-account/src`, the
locales through `tools/translate.mjs`'s own checkDraft and hash over main's and the head's tables, every line the batch
added (`git diff 56eb3cb15 2dc8f31a2`, all paths) and every line each of its 77 commits added, scanned for a report's
5- and 6-word runs, its quoted spans and every reporter's handle and character name (a scanner of the lane's own,
`histscan.py`, `textscan.py`), and every bullet of the PR's notes against its section and its code, then `steNotes.mjs`.

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| M1 | **The record's tally is not its rows'.** The head says 100 / 68 / 48 / 27 / 36 / 11 / 3; the rows say 103 FIXED (RPT1026-WORLD's second pass made #200, #244 and #252 fixes after the count was taken), 67 / 47 / 26. Active-Arcs and the PR body repeat the stale count. | The head's table is the rows' (103 / 67 / 47 / 26 / 37 / 10 / 3 with M3), and says how #245's two rows count once and how an "Answer the player" row reads; Active-Arcs' line; the PR body. | `test/bible/audit_rpt1026_m.test.js` (fails on `2dc8f31a2`: the tally); `tools/mutants/audit_rpt1026_m.json` M1 x3, dead |
| M2 | **The final tree still quotes reports** (major, privacy): #188's subject verbatim as its row's title; #181's own phrase for the figure; #245's word for the sum (twice) and a word it put in quotes; #203's verb; #74's wording of its refusal (twice); #146's and #52's words in the CLIENT sections; an eight-word run of #106's in FIGHTS; #260's sentence; #224's account of what happened in `cardStakes.js` and its test; #105's proposed-fix wording in the acct197 note; #96's phrase in the record and its test. The PR body says "the final tree carries none". | Each paraphrased (record, `src/net/card/cardStakes.js`, `test/net/card/rpt1026_chestgold_cards.test.js`, `server-account/src/service.js`'s acct197 note, `test/scenes/rpt1026_client_peershake.test.js`). Re-scanned: what still matches is the game's own text or our docs' words a reporter quoted. | Not pinnable in a public repo (the reports are private); a scanner of the lane's own over the record: clean |
| M3 | Three rows' verdicts are not their sections': #261's Done says "Staff: see below", its section NEEDS DATA; #23 says staff, its section (with its twin #76) needs data; #244 is FIXED (DECOR-VERBS) and still listed under WORLD's "Not fixed here". | #261 NEEDS DATA (below); #23 needs data / staff; the #244 bullet struck. | M1's test (the tally reads every row); mutant M1-a-row-says-another-verdict, dead |
| M4 | An ALREADY FIXED names the wrong pull request: SIDE-ONCE "on main with #1124" (#1124 is the staff panel's first step; SIDE-ONCE is 19f's, #1054, merged 2026-10-20 13:06 UTC); FIGHTS' three AF say "on main since `6f841c054` (the oldest commit in this clone)" - the shallow clone's edge, not a record. | Both name #1054 and its merge time. | - (record) |
| M5 | The integration's "xf named" (d65aca5c0) is green, not right: BODY-CAP's third reader, applySharedRecords, still tests `full === 2`; the record quotes the joiner's pre-naming line. A change to `XF_STANDING`'s value would have the host say one kind and its joiners hear another - the report's symptom back. | `full === XF_STANDING` (`AUDIT RPT1026 M5` at the site); the record's BODY-CAP text; `rpt1026_items.json` BODY-CAP-bodies-taken-down re-aimed (list re-run: 20 dead). No logical line added. | `test/net/audit_rpt1026_m_xf.test.js` (the frame and the joiner mounted from the module with the kind moved off 2; fails on `2dc8f31a2`); mutant M5, dead |
| M6 | The acct197 bump wrote over acct196's history line (WOVEN-PAYS) instead of moving it down, as every bump before kept its predecessor's. | Restored under acct197 (comment only; no version moves). wire.js's world269 line is lost the same way and cannot be put back without moving world270's hash - the LAW table keeps world269's row. | - (record) |
| M7 | world270's LAW row says "nothing the wire carries moved"; BLOCK STAMP's `_directedFrame` adds `sub` to every trade and page frame the relay routes. | The row's note says so (`test/net/relayversion.test.js`, comment only, the hash unmoved); wire.js's own line keeps the claim - its bytes are the row's. | `relayversion.test.js` green |
| M8 | **The branch's history publishes report wording** (major, privacy; OPEN - the owner's): ~20 of the 77 commits added verbatim report sentences in code comments, tests and Ledger rows (e.g. `cd300369b`, `0d1fe0498`, `994b5f3e5`, `dc92ae58a`, `70f5f1cf0`, `145709832`, `3baf01508`, `ca897b874`, `52dcf96f4`, `93786a959`), all paraphrased by `d4d32cdbc`. The PR body's remedy, a squash merge, keeps them off main but not off the public pull request: its commits stay readable on GitHub. | Not fixable without a push. The fix is the owner's: replace the PR branch with one rewritten commit (force-push) before merging, and ask GitHub to purge the old commits' cached views. The fixed PR body no longer advertises it. | - |
| M9 | The PR notes: the count (100); "the Battle Spire ... again" (it is the Battlespire, and the spoils were never pickable there); "the other bosses that share their health" (only the Gate's Warden and the Tonal Warden moved); Chameleon, Invisibility and Shadow "end" (the Normal forms alone; True stands); the heir bullet (only where the Bloodline rules allow a newborn); "pitch black" (no STE word). Missing fixes: FLOW-SEEN, JEWEL-USED, GOLDSMITH-SAID. | `SCRATCH/audit/RECORD.pr_body.fixed.md`; `steNotes.mjs` clean. | - |

### Suspected (M)

- S1: the account worker bundles thirteen shared files the batch changed (`enchantments.js` RARE-KEPT, `foundMark.js`
  MEND-SPENT, `effects.js`, `enchanting.js`, `realmTradeLaw.js`, `itemIds.js` ...) that the acct197 note does not name.
  Whether the service's item law reads a changed function (`stampedTier`, `spendOwnMends`) would be proven by tracing
  `judge.js`/`itemLaw.js`'s imports to them and running the item-law pins against main's copies. The lanes' business.
- S2: CI fetches no ARENA2, so every corpus pin the batch added (SUMMON-BARE's MONSTER.BSA pin among them, now reading
  the environment alone - 17n) skips in `verify`. A CI log of the `rpt1026_progress_summon` file would show it.
- S3: 136 of the 293 reports' builds lie past the shallow clone's edge (119 first-parent commits), so their ALREADY
  FIXED verdicts were checked by send time, not ancestry; a full clone would prove each.

### Read and found sound (M)

- Migration 0178: `products.handed_to` and `realm_characters.law_v`, TEXT both; `JUDGE_COLUMNS` reads `law_v`, verdictWrite binds it as ?23 (the 23 placeholders counted), `review.js` clear, `staffPlayers.js` CHARS_SQL and lawStands read it; `handed_to` written by ledgerMoves, cleared by pieceSoldSteps and the writ fill; the deploy's `migrations apply` runs it; MIGRATION-PREFIX green; no 0176 left but as history.
- The bumps: the relay graph's changed files are exactly RETIRED-BLOW's, BLOCK STAMP's, ORRERY-HANDS' and masterSkills.js (egLords.js a comment); world270's hash resolves (relayversion green); every acct196/world269 pin moved, none stale; the 63 pin files and 744 tests green.
- The locales: 39 added and 4 changed English keys in all 13 whole languages, each draft's placeholders the English's (checkDraft), each meta's `en`/`tr` the hashes, `by` claude-in-session; no person's row on main in any language, none written over; the partial languages hold only the moved refusals, redrafted.
- The merge's resolutions: Port-Ledger kept both sides' rows; every line cite main's lines carried (Port-Status, citedrift, faceuvresidue, probehygiene, prepare.sh, motor.js, passiveSpecials.js, the ROADS row's Roads.md:197) points where main's did; UI.md 429 and Systems.md 823 are the trees' counts; itemLook.js carries the stolen line and its mutant followed it; vendorTab.js kept both imports.
- The census rows, the 17n path (arena1Data's convention), the migration renumber and the crew pin (`[,;]` matches the statement): right.
- ALREADY FIXED: all 20 cited shas exist on main; where the build is in the clone, no cited fix is in it; every named fix has its record.
- Every report 1-293 has a row; #245 alone has two (its two halves), now said.
- The STE check passes on the body as it stood and as fixed.

No version bump. The relay's bundle is unchanged (no file of its graph touched). The account service: `service.js`
comments only (M2, M6) - no law moved, no migration.

## Found at the integration

Merging the thirteen branches, and main twice, turned up what no one lane could see:

- **Two pins that passed by the clock's luck.** The A5 pin (a rehello waiting for its welcome) failed 4 runs in 12
  started together: its hub stub counted and held a settings call LEASE1 makes on a member's earlier frame, so its wait
  ended before the rehello was asked. Lane A fixed the test - it holds the party ask alone, mints the tokens before the
  clock is touched, and waits on the room's own reading - and 36 runs in parallel were green. ARENA-ORDER's pin (the
  batch's own, RPT1026-QUESTS) waited a count of 40 timer turns for the service's SQLite and crypto answers and read the
  claim a step early on a loaded machine; it waits on the calls in flight now (16 runs in parallel green, its two mutants
  dead).
- **Main took the batch's version numbers twice.** CHAT-POST took world270 and merged with its own check red (eight
  tests: its chat source pins and mutant records, `createWorldModes` two logical lines over its ceiling, a chat line at
  10 px) - those eight fail the same on main alone and are left to their fix there, said once on the pull request; then
  FIELD BUGS 2026-10-26d took world271 and acct197. The batch's pins moved to world272 and acct198, and Port-Status's
  section-2 Ledger rows were re-aimed by their rows' own text (six rows of this batch now stand above them).
- **A merge resolution that dropped a line.** Lane G's Active-Arcs conflict was first taken whole from the lane's side,
  and the hunk held main's 10-26c line beside the batch's; it was put back in the next commit.

## For the owner

- **B2's trade-off.** The batch refused an owner's access change while a guest held the chest. Lane B found a guest's
  kept hold locked the owner out for good - 34 minutes, every Private and every open refused, the chest unmovable and
  the house unsellable while goods were in it - and lifted the refusal. Nothing is lost for this build's clients (the
  purse pays only when the settle lands, a settle the change shut moves nothing, the pour takes only what it read). A
  client from before this build has the Private route's duplication again - it kept the three-minute route the batch
  left open, so no new hole opens - and the patch note that said the owner could no longer change the access while a
  guest had the chest open is withdrawn.
- **M8, the branch's history.** About twenty of the batch's commits added report sentences word for word in code
  comments, tests and Ledger rows; `d4d32cdbc` paraphrased every one, and no line of the tree carries one. A squash merge
  keeps them off main, but the pull request's own commits stay readable on GitHub. Taking them off needs the branch
  replaced by one rewritten commit (a force-push) before the merge, and GitHub asked to purge the old commits' cached
  views - the owner's call; it was not done here.
- **The design calls among the suspected** (each with what would prove it, in its lane): E's S4 (online, a window holds
  the breath while the rounds tick, so a paralysed swimmer can wait the paralysis out in the inventory); I's Discord (a
  Discord winding up when the ward breaks still lands); K's Dismiss over a stopped loop; L's iPhone keypad (no Return key,
  and the touch layer's check under the Bank window); C's S1 (the clear excuses the newest values, which staff may not
  have read).

## Patch notes corrected

Lane M read every bullet of the pull request's notes against its section and its code. Corrected: the count (100, now
103); the Battlespire's name, and its Redoubt's spoils could never be picked up before (not "again"); "the other
bosses" (only the Gate Warden and the Tonal Warden share their health that way); Chameleon, Invisibility and Shadow end
in their Normal forms alone; the newborn heir only where the Bloodline rules allow one; "pitch black", no STE word; and
three fixes that had no bullet (FLOW-SEEN, JEWEL-USED, GOLDSMITH-SAID). The audit's own lines were added - the chest
window's Use, Salvage and Dismantle, the map moved as an item there, the blows held on a stalled line, two recoveries at
once, the stolen word in a player trade, the technique key under an online window, the Master Skills switch, a worn
piece's Cast When Used, a self-cast absorb at a full pool, a summon saved and loaded, a No in a questline quest, the
classic skin's way to abandon, the player's own sounds, a lamp set down in a dark room, the banners, a Weir Key after
another dungeon, the lost-graphics report, the Bank's keypad entry, the talk window on a small phone held sideways and a
bed's rest after a warning - and the owner's access bullet withdrawn (B2).
