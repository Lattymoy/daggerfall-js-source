# AUDIT CREW-TRADE (2026-10-24) - crew at the exchange, audited cold

The owner, of CREW-TRADE (`03-World/Captains-Sea.md` CREW-TRADE, the answer to *"If you could, please add crew as a
resource that can be sold and traded"*): **"Audit this"**. This page is the findings, each with its verdict. What the
audit changed is written into the record's section as it now stands, each change under its finding's id (AUDIT
CREW-TRADE H1 and on), and the code says the same at every site.

## How it was run

Five lanes, each a cold adversarial reader of the change at 5f4f04bef (CREW-TRADE's three commits and its merge of main
over 501aaacee), told to reproduce every finding - a probe and its saved output - before reporting it, to cite the code
by its text, and to fix nothing. They read FROZEN SNAPSHOTS (detached worktrees of 5f4f04bef - lane P its own, since
its mutants write the files they judge), never the working tree, so Home.md's DO NOT FIX WHILE THE VERIFIER IS READING
held while the findings already in were fixed in the tree. Every finding below was reproduced again by hand in the
working tree before a line changed.

| Lane | Over | How |
|---|---|---|
| E - the economy | every loop of gold or men: the shipwright at every rank's discount, the crew hall, a ship bought and sold back, the Admiralty's carrack, a prize's press, a booked passage, the stars and the town's factors, the day's stock and its eviction, a route between ports | node probes over the real sea fight and the real harbour office; the real board's 106 ports on ARENA2 |
| H - her crew | the roster, posts and the First Mate, worth, spirits, the HUD's lines, the shore party, a wreck and a fire, fractions, a refit, a save and a load, the Fleet page's yard, every crewed hull | node probes over the real naval host (`test/navalSea.mjs`) |
| O - the office, the window, online, the realm | the window in Chromium at 1280 and 375 px, every caller of the exchange and the yard's model, every language's rows, the town economy's vouching, the account service, customs, the wire | the real window over the real host and office; jsdom and Chromium; the relay's word |
| P - the pins and the record | the tests' every assertion, 36 mutants of its own, the recorded and re-aimed records, the bible's every number and name, the gates | `tools/mutate.mjs` on its own snapshot; the bible gates and the L10N tests |
| R - the real game | the streaming world in Chromium on ARENA2, then the real window over the real host where the world would not serve | `?world&shot&play`, frame-synced on `__frame` |

**WHAT THEY FOUND.** 38 findings in five lanes - one met by two lanes (R1 = O1), so 37 defects and notes. Every one is
fixed, pinned and named below, or left and said. Lane R did not reach a quay in the live world (below, R6).

## E - the economy

- **E1 HIGH - a booked passage's crew was sold at the quay.** A passage's boat (`passageBerths.js` charter: "Her hands
  are her boat's (a fresh state, every hand aboard)") stands at the quay with the passenger at her helm, and Activate
  opens the shipwright's window there; the exchange signed off 23 of her 24 and the next booking's boat had every hand
  again - three bookings, 1,466 gold net of the fares, about 650 gold a port-day. FIXED: `crewDeal.js stands` reads the
  boat's charter (`passage.js charterRecord`); the exchange lists no crew for her and a press there is refused, before
  any other refusal, in so many words ("Her crew are her master's. You only booked passage."). Pinned
  (`auditcrewtrade.test.js` E1), ACT-E1-charter-unread, ACT-E1-charter-row-listed, ACT-E1-fight-before-charter.
- **E2 MEDIUM - the press is sized by the captor's losses, not the prize's men.** `navalPlunder.js` choiceEffect:
  "if (choice === 'press') return { crew: Math.ceil((mine.maxCrew - mine.crew) * PRESS_SHARE) };" - a crew sold down
  before a fight is pressed back whatever the prize had aboard (a Merchant Galleon with none left: 14 men), and the
  pressed men sell: about 300-400 gold a prize, the captor fighting at one man (reload x1.77). LEFT, PUT TO THE OWNER:
  the press is the naval arc's law (Black Flag's), it predates the exchange, and a prize is a fight won; capping it at
  the prize's own survivors changes a combat choice the owner designed. Recorded in the section.
- **E3 NOTE - ship flips pay offline at high skills, before any crew.** `shipyards.js shipWorth` reads the deed's price
  where `shipBuyPrice` haggled it; a Small Ship nets +2,344 from skill 60, the Admiralty's carrack breaks even at 50
  (+609 with her crew sold). Online every flip loses. Outside CREW-TRADE: LEFT, said here for the shipyards' arc.
- **E4 NOTE - a crew route is sane beside the goods.** Over the real 106 ports (31 with men to spare, 41 short, 34
  neither): 266 gold a Small Ship's voyage on average, 335-493 a Carrack's, against 1,777 for all the goods on the same
  routes; crew weighs nothing, so it rides beside a hold. No action.
- **E5 NOTE - the ask has no cap.** In a Destitute town short of sailors the exchange sells a man for 28-35 where the
  shipwright asks 30 - a poor deal shown beside the better one. LEFT: no gold made, the market's own price.
- **E6 NOTE - the ledger's eviction refills a port's taking after 64 other ports in a day.** Unreachable (106 ports,
  leagues apart; a rest does the same). No action.

## H - her crew

- **H1 MEDIUM - one Sell 1 paid off a paid-for Veteran First Mate, his post and his lift, unsaid.** A headcount sale
  released the roster's tail, and a crew hall's recruit always joins at the tail (`shipCrew.js enlist`): a Veteran First
  Mate signed on for 1,120 gold left for one man's price, her post went empty for good (`roleOf` deals the First Mate at
  the roster's head alone) and the note named nobody. FIXED: `crewTrade.js signOffOrder` - never one of the shore party;
  a plain Deckhand before a post's holder (a Bard's calling his post), her First Mate last of all; the deck's own before
  a hall's recruit; the less service before the more; of the rest the last to join - and the note names each hand who
  leaves. With the shore party never signed off, `crewSpare` counts the party, not its last hand's roster place, and
  keeps one named hand aboard beside it. Pinned (`auditcrewtrade.test.js` H1 - the order's every rung, the veteran over
  the real sea; `crewtrade.test.js`'s three pins it moved say PIN MOVED), ACT-H1-* (nine records).
- **H2 LOW - at the helm a sale refused for a hand "ashore with you" whom her card shows on deck.** At the helm the
  party stands on her deck (AUDIT CC-A5), its places kept for the shore. FIXED: the party's own words ("X is in your
  shore party. Send them back aboard first."). Pinned, ACT-H2-hall-words.
- **H3 LOW - men signed on at the exchange named nobody, where the shipwright's hire names each.** FIXED: `signOn`
  answers the hands who joined and the note names them. Pinned, ACT-H3-joined-unsaid, ACT-H3-joined-none.
- **H4 NOTE - a fractional crew reads "23.5 of 24".** Unreachable: every blow, fire, press and hire moves her crew by
  whole men. No action.
- **H5 NOTE - a yard's model held past a load deals over the state the load threw away.** Closed in the game: the
  quickload closes every window first (world.js `closeWindowsForLoad`, DUPE-LOAD), and the yard's own presses share the
  same capture. No action.
- **H6 NOTE - the Fleet page's yard model carries a `crewDeal` it never uses** (its exchange is the quay's alone,
  AUDIT CAPTAIN'S SEA B3). Harmless.

## O - the office, the window, online and the realm

- **O1 LOW (= R1) - a greyed Sell never said why** (customs, the shore party, her last man - the words reached only a
  press, and a greyed press never presses). FIXED: the row carries `why`, said beside the aboard line while Sell is
  greyed and the exchange still takes men. Pinned (`auditcrewtrade.test.js` O1), ACT-O1-why-unshown, ACT-O1-why-uncarried.
- **O2 LOW - `{gold}` arrived in every language as an English string** ("90 gold", en-US grouping: "1,368 gold" reads as
  a decimal in German). FIXED: the gold a number (`{gold, number} gold` - the house's pattern), its word the language's
  own. Pinned (O2/O3 - the note in German, its figures German), ACT-O2-gold-a-string.
- **O3 LOW - the crew row and its refusals were half English in every other language.** FIXED: the row's title, its
  stand (a port that is neither too - R4), its two prices and counts, and the last-man and fight refusals are the
  crew's own keys (`sea.crew.*` - 23 strings in all, drafted in-session for every language, `tools/l10nInSession.mjs`,
  recorded as the machine's). The posts' names (Gunner, Bosun) stay as the whole game says them. Pinned (O2/O3 - no
  English left in German), ACT-O3-title-english, ACT-O3-prices-english, ACT-O3-last-man-english.
- **O4 NOTE - Buy pressed with a short purse or in a fight answers with a warning, as the goods' rows do.** The purse
  half is now greyed (R3); the fight half stays a press that says why. No further action.
- **O5 NOTE - the realm.** Nothing on the service reads a ship's crew; a forged count is clamped to her whole on load and
  is worth one port's day at most, the client's word as at any counter; a ship come through customs sells none of her
  men; a sale survives a save and a load. No action.

## P - the pins and the record

Lane P wrote 36 mutants of its own: 8 died, 7 were equivalent (the release loop already trims the roster; every yard
price is whole or a half; the ship at the quay is the one in play; a boat in play always has a hold; the draw's salt and
hash spread the same; the world's wiring is killed by the moved pins), and 21 showed laws nothing pinned. Every one is
pinned now and stands in `tools/mutants/auditcrewtrade.json` aimed at today's code - nineteen as ACT-P*, P3's as
ACT-H1-party-not-counted and P11's 'neither' as ACT-R4-neither-unsaid.

- **P1 HIGH - the money for men asked but not moved was unpinned** (a Buy 10 with room for three could pay for ten, a
  Sell all credit and log the men asked for). FIXED in the pins: the purse, the day's dealing, the log's trade and the
  note for the men that moved.
- **P2 MEDIUM - whether the purse can pay was pinned only at nothing.** Pinned: a purse a gold short of four men signs on
  three, never four at the price the captain is paid.
- **P3 MEDIUM - the shore party's place was pinned for one hand ashore only** (two walk ashore at once). Closed with H1:
  the party counted, pinned at one and at two.
- **P4 MEDIUM - the row's stars and the town's factors were unpinned**, at the law and at the office. Pinned at every
  rank, port and factor, and at the office with stars and a Destitute town.
- **P5 MEDIUM - "online each is told to the town economy" was unpinned.** Pinned: a buy and a sell each told.
- **P6, P7 MEDIUM - "named quietly" and "nobody said fallen" could not fail:** the test synced the roster itself before
  reading it. Pinned off her own roster, the sea run before anything else syncs her.
- **P8 LOW - "no fire put out, a wreck a wreck" was unpinned for the exchange.** Pinned: a burning wreck takes men and
  stays both.
- **P9 LOW - the presses' stock halves were unpinned.** Pinned: Buy greyed with none to sign on, Sell with none wanted.
- **P10 LOW - the isle law rested on one key.** Pinned over forty keys that draw otherwise in the Bay.
- **P11 LOW - two wording survivors.** Pinned: the last man's words with a hand ashore; a port that is neither says so.
- **P12 NOTE - "a third each" holds by the draw, not exactly** (31/41/34 of the real 106), and "a plain hash bunches
  neighbours" does not show on the real ports. FIXED in the record: the section says the real counts and drops the
  claim.
- **P13 NOTE - test 3's discounts skipped a rank's 0.15.** FIXED: it walks every rank's own favour and the yard's
  ceiling.
- **P14 NOTE - the world's wiring is pinned by its text.** The moved pins kill its mutant; the behaviour is pinned through
  the yard's model over the real host. No action.

## R - the real game

- **R1 = O1.**
- **R2 LOW - one Sell all took a Small Ship from 13 men to 1, unasked.** FIXED: the crew row sells ten at a time as it
  buys (Buy 1, Buy 10, Sell 1, Sell 10); the goods' rows keep Sell all. Pinned (R2), ACT-R2-sell-all-on-crew.
- **R3 LOW - Buy lit with a purse that cannot pay a man.** FIXED for crew: greyed under a man's price. The goods' rows
  are as they were (O4). Pinned (P9/R3), ACT-R3-purse-unread.
- **R4 LOW - "the contracts of 1 crew", and a port that is neither said nothing.** FIXED: "Signed on 1 man", "Signed off
  12 men" (an ICU plural), and "Sailors to be had here: the usual price". Pinned, ACT-R4-neither-unsaid.
- **R5 LOW - at 390 px the four presses stack one a line and the crew row fills the list's box.** LEFT: the yard
  window's phone layout is every row's (the goods' too) - the naval windows' own pass, not the crew's.
- **R6 NOTE - the live world reached no quay.** A Small Ship deed given and laid up, the Fleet's Summon found no berth at
  Daggerfall or Wayrest (`navalHost.js freeBerth`), and the sea pixel at Wayrest never built in 265 frames - so the lane
  mounted the real window over the real host in Chromium (presses clicked, both widths, four ports). Two 404s in the
  live boot predate any naval act. The live quay stays UNPROVEN here.
- **R7 NOTE - the Fleet page agreed with the yard after every press** (its data, `fleetStatus`; the page itself not
  rendered). No action.

## The tests and the mutants

`test/systems/naval/auditcrewtrade.test.js` - 10 tests; `tools/mutants/auditcrewtrade.json` - 43 records, all dead. The
quay rig is `test/systems/naval/crewQuay.mjs`, shared with `test/systems/naval/crewtrade.test.js` (10 tests; its
`tools/mutants/crewtrade.json` re-aimed by content, still 41, all dead). The neighbouring lists re-run after the fixes:
`capttrade`, `isletrade`, `captaintree`, `townecon4`, `auditrefit2` and the exchange's and the window's records of
`auditcaptsea`.
