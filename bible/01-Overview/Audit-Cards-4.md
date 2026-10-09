# AUDIT CARDS-4 (2026-10-08) - the gold tables, CARDS6 and CARDS-TIDY

Mac: **"2 and 3"** - #2 this audit, #3 CARDS6's two "Not yet"s (the top-up and gold owed elsewhere,
`11-Multiplayer/Tavern-Cards.md` section 24), built after it in the same code. The arc is on Tavern-Cards; this page is
the audit of sections 22-23 (CARDS-TIDY and CARDS6, AUDIT CARDS-3 on `Audit-Cards-3.md` before them).

## How it was run

Five lanes, each an adversarial reader of a FROZEN snapshot (a git worktree at a75c49e3c - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING), each told to reproduce every finding with a script before it reported it:

| Lane | Over | How |
|---|---|---|
| A | the service's escrow and the signed words (`server-account/src/cards.js`, `net/identityToken.js` stake orders, `net/cardReceipt.js`) | the real Worker over SQLite with the real relay Room sharing its keys; every kind and signature crossed with every other |
| B | the relay and the pure table | 8.3M random operations on the pure table (9 seeds, about 290k hands, 240k receipts) checking that stakes in = receipts + stacks + pot after every one; 400k end to end on the fake room with real orders (hellos, drops, ghosts, wakes, voids, acks, looks); then two words at once |
| C | the device (`net/cardStakes.js`, the worldModes card block, online.js) | the real account Worker, a real realm session and `realmGoldAct`, the real `accountCards` door with faults injected; the host's card block sliced and run against the real relay |
| D | CARDS-TIDY and the record | 97k frames of offline cloths and 931k of relay-fed ones tracked card by card; 12,000 random state pairs through the delta law; reconnects and far tables against a fake relay that sends deltas by `_holdemSend`'s law; the doc against the code; 68 candidate mutants |
| E | all three parties at once | about 14,000 gold evenings (24 runs x 600) with lost answers, lost frames, drops and same-id reconnects, tabs closed, rooms left for good, wakes, clocks past every TTL, two tabs, character switches - counting gold CREATED and STRANDED. The lane was cut off by an API error before its report; its repros on disk were read and each run again |

Every finding was reproduced again on the LIVE tree before its fix, and pinned after it.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| C1 / E1 | CRITICAL | A stake asked again after a lost answer (`recover`) held nothing from the purse: the first ask never reached the service, the session ended, the join read the record; the second ask took the gold off the record, and the act's closing checkpoint wrote the purse back over it. Voided or stood, the stake was paid twice - on purpose by blocking one request, or by a bad link (E: +326,169 gold over six runs) | FIXED: asked again, a stake the service takes then is paid from the purse in the act's `apply` (a repeat, which the record paid before the join, is not) |
| A2 / B1 | HIGH | One order shown in two rooms: the wrong room spent it and handed it back whole ('refused') while the right room still seated it - each room remembers only its own spends. A refund plus a seat's chips: gold created, without bound | FIXED: another room's order is left unspent with nothing handed back ('stake elsewhere'); its own room voids it. This room's order at another table or stakes is still spent and handed back |
| A1 / E5 | HIGH | A repeat of a held stake's request was a FRESH order (a new minute to sit on; a void the relay had forgotten its spend for): sat or voided again once the room swept its marker | FIXED: the repeat is minted at the stake's own instant - the same order |
| B2 | HIGH | The table read before a stake order's await (crypto opens the object's input gate): two staked first sits each built a table and the second replaced the first; a staked sit racing the last stand sat in a table already deleted. A spent stake with no seat and no receipt (the concurrent fuzz: every seed) | FIXED: the table read again after the stake's check |
| C2 / E4 | HIGH | `recover` let a kept request go on any answer that was not `unknown` - including the session's own `offline` (a checkpoint not landed: never asked), `busy` (another realm act holding) and a lost session. A stake that had landed was held for good with no order to void | FIXED: let go only on the service's own refusals (`cardStakeRefused`) |
| C3 | HIGH | A receipt the storage would not keep was acked anyway - the room forgot it, the device had nothing | FIXED: acked only once read back as kept |
| C4 / E3 | HIGH | Once seated, the book forgot whose stake it was: a cash-out heard while another character of the account played was filed to that one, acked, refused 'cards-other-character' for ever | FIXED: a sat stake is kept (`seated` marks it); the receipt takes its character and region from it; one the device never staked is the account's until the service says whose |
| C5 | MED | A gold sit refused for the table's kind, or a new socket's sit after the old seat was cashed out ('stake spent'), left the chair pending and the sit said every 1.5 s for good | FIXED: the stake's and the table kind's words lose the pending chair |
| C6 | MED | A stake never sat was voided only in its own room, and only within a week; past it 'stake too old', unread - held for good; dead stakes evicted live ones past the device's bound | FIXED: the void reaches a receipt's life (`HOLDEM_STAKE_VOID_S = CARD_RECEIPT_TTL_S`); past the bound a sat stake goes first and a receipt never (the newest is not kept, so not acked); a request the device cannot keep is never asked; what nothing can bring home is let go. Gold owed in another room is said on a visit (section 24) |
| A3 | MED | Nothing ends a held stake but its receipt, and a receipt claimed after 30 days was refused 'expired' and dropped; a character deleted freely with stakes held | FIXED: a receipt pays whenever it is brought (its row spends it once); `deleteRealm` refuses 'cards-held'. RECORDED: a stake whose receipt is never brought stays held - section 23's own account |
| A4 / A5 | MED | The cards route never said WHY a receipt was refused, so the device dropped every receipt refused on its signature (a key rotating) or its clock ('future') | FIXED: `why` on the wire; the device lets go only a receipt refused for what it IS (`CARD_RECEIPT_DEAD`) |
| E6 | MED | A cash-out's repeat was answered before where the record stands: a landed claim whose answer was lost read as ok with no move, the device's sequence one behind | FIXED: where the record stands asked first |
| E2 | MED | `claim`'s latch was let go in the promise's own `finally` - a round with nothing to await ran it before `??=` assigned, and the tab claimed nothing again | FIXED: let go after it is set |
| B3 | MED | A relay with the identity key and no gate key seated stakes and minted unsigned receipts the service never pays | FIXED: no stake seated or voided without a key to sign its receipt ('stakes closed') |
| B4 | MED | The cash-out queue was spliced before any receipt was minted; one storage write that threw lost the rest, and the next save deleted the table | FIXED: each off the queue only once signed and kept; a table is never forgotten with one unsigned |
| D1 | MED | A socket that missed frames (a new socket in the same room; a frame dropped) laid deltas over a stale table: a new hand never told the cloth, the panel mapping another hand's seats | FIXED: a table's room frames are numbered (`n`); a delta is laid only on the frame just before it, else the table is asked for whole |
| D2 | MED | Every delta from a table across the room asked for it whole, and the whole was dropped as not near - again at each change; a visit asked for every table | FIXED: only a near table's; a visit asks the near ones (and one at least - its look hands over what the room owes) |
| D3 | LOW-MED | The approach look had no slack: a player at the line asked again at each crossing | FIXED: forgotten past the watch's own slack |
| D4 | LOW-MED | A watch of the table a realm character sat at stayed open through the buy-in, frozen, then took the room's changes over a stale table | FIXED: the watch closed at the sit |
| D5 | LOW | At a new hand the last pile jumped to the new dealer's place and refilled in one frame, the gathered cards still flying into it | FIXED: the pile goes with the gathered cards as it lay; the new deck lies once they land |
| D6 | LOW | `validHoldemOut` passed malformed table shapes (`handSeats: null` threw in the catch-up) | FIXED: the hand's shape checked (`handShapeOk`) |
| C7 | LOW | A stake the session never asked was said as "your stake will be settled" | FIXED: a lost answer (`unknown`) said as one, the rest "try again" |
| C8 | LOW | A receipt heard while a claim ran waited for the next | FIXED: the claim rounds again |
| A6 | LOW | A zero receipt whose settle failed answered paid | FIXED: said as failed |
| A7 | LOW | The cash-out banked into the region the client named | FIXED: the region it was staked from (`card_stakes.region`). Online every region's bank is the Empire's account, so no gold moved; the record is the law's |
| B5, B6 | LOW | An account's 17th owed receipt evicted the oldest; `cashout:` keys never swept; the `cstake:` sweep unpaged; the doc said "a week's worth" | FIXED: `HOLDEM_OWED_MAX` 64 (each a stake of at least 20 big blinds); the sweep pages and forgets dead cash-outs; the doc says a receipt's life |
| B7 | LOW (design) | A staked player all in who drops while another seat must act is folded out of turn and forfeits the stack - no all-in protection | RECORDED: the law's fold for a leaver, as offline; conserved |
| D7, D8 | LOW | Doc drift: "a week's worth"; Online-Arc had no CARDS-TIDY paragraph; Active-Arcs still listed CARDS6 open; the Port-Ledger row's title stopped at CARDS3b | FIXED |
| M | - | Lane A 14, lane B 19 (and four equivalent), lane C 13, lane D 44 candidate mutants survived the slices' tests | FIXED: `test/auditcards4_client`, `_pins`, `_tidy`, and new tests in `cards5_client`, `cards3b_hand`, `cards6_relay`, `cards6_service`; `tools/mutants/auditcards4.json` holds every fix's and every survivor's record - three equivalent, recorded with why |

## The merge

`git merge-tree` of the snapshot against main (lane E): main has moved about 6,500 commits; 49 files conflict - the
relay (`server/src/index.js`), `net/wire.js` (the RELAY_VERSION chain), `scenes/world.js`, `scenes/worldModes.js`, seven
bible pages (Active-Arcs, Page-Index, Port-Ledger, Online-Arc, Systems, Testing, UI), 37 test files (most of them pins of
the relay's version) and `tools/mutants/soc1.json`. The merge is its own step, main's side taken for every cite-only
conflict (CLAUDE.md).

## Pins

`test/auditcards4_client.test.js` 7, `test/auditcards4_pins.test.js` 7, `test/auditcards4_tidy.test.js` 6; added to
`test/cards6_relay.test.js` (B2, B3, B4, the void's reach), `test/cards6_service.test.js` (A1-A7, E6),
`test/cards6_client.test.js` (C4), `test/cards5_client.test.js` (D2, D3, the looks), `test/cards3b_hand.test.js` (D5),
`test/auditcards3_pins.test.js` (D1). `tools/mutants/auditcards4.json`.
