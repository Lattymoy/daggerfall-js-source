# AUDIT CAPTAIN'S SEA (2026-10-11) - the naval update, audited before it merges

The owner, of the naval update (PR #781: CAPT-CREW, CAPT-LOG, CAPT-PAY, CAPT-MARQUE, CAPT-WATERS, SPYGLASS,
CAPT-BOARD, CAPT-TRADE, CAPT-CHARTS - `03-World/Captains-Sea.md` - and the Eltheric Ocean's ETHER-SEA, ETHER-PLACES,
ETHER-PORTS, ETHER-SHIPS, ETHER-LEGENDS, ETHER-CROSSING, ETHER-CHART, ETHER-LIGHT - `03-World/Eltheric-Ocean.md`):
**"Lets do a comprehensive audit, enaure this is insanely detailed and perfection. No exceptions"**. This page is the
findings, each with its verdict. What the audit changed is written into the two record pages' sections as they now
stand, each change under its finding's id (AUDIT CAPTAIN'S SEA S1 and on), and the code says the same at every site.

## How it was run

Nine lenses, each a cold adversarial reader of the PR at 4aec81c85 (the base it branched from: 118313d436), told to
reproduce every finding - a probe script and its saved output - before reporting it, and to cite the code by its text.
179 probes in all.

| Lane | Over | How |
|---|---|---|
| C - the crew | CAPT-CREW: the roster, the posts and their worth, the First Mate's hands, the Fleet page's crew | 16 probes over the sea harness (`test/navalSea.mjs`): a companion's post at sea, the deck's set against the worth's, sign-ons in and out of a harbour, the boarding's hands |
| G - the Eltheric ground | ETHER-SEA's law and the composed reader, the far ring, the landforms, the Overworld's view, the switches | 21 probes: the ring built at the Veil over a world of land, the landforms' climate read at isles, the Overworld's water law lifted and run, every switch's game |
| X - the crossing and the chart | ETHER-CROSSING, ETHER-CHART | 19 probes: world.js's crossing text cut from the file and run over stand-ins (an hour of checks, a load between ask and answer, a failed landfall); the chart window driven by pointer, finger, wheel and key |
| D - traffic, law and legends | ETHER-SHIPS, ETHER-LEGENDS, CAPT-WATERS, the strands, online | 24 probes: strands sailed in and out of, prizes past the Veil, two captains in one haunt, the wire both ways, a legend's terrors at sea |
| L - the ledger, the save, online | CAPT-LOG, CAPT-PAY, CAPT-MARQUE, the ledger's record, offline copies | 18 probes: a pirate charged twice, two exchanges in one day, hostile saves, the lanes' clocks, the page's meter |
| H - the record's honesty | every claim of the two pages and of #781's patch notes; every pin's force | 13 probes: each claim against the code that does it; each pin asked whether it could fail |
| S - the spyglass | SPYGLASS: the glass, its window, its card, the tags, knowledge, false colours, the pad and the finger | 21 probes: the glass through doors, loads and videos; the touch corner and the d-pad; night, land, fades; the head held and given back |
| P - the isles' places | ETHER-PLACES, ETHER-PORTS in the world: harbours, rises, teleports, quests, houses, the Fleet | 21 probes, MAPS.BSA read from the player's own data (ARENA2_PATH): every port's harbour sounded through the kernel, the havens' filter over the game's rows, the world's doors past the Veil |
| B - the board, the exchange, the charts | CAPT-BOARD, CAPT-TRADE, CAPT-CHARTS | 26 probes, each run again against a clean `git archive 4aec81c85` with identical output: shuttles between exchanges, bounty quarries, charts read twice, a pack too full, a hold too heavy |

**THE TREE MOVED UNDER THREE LANES** - Home.md's DO NOT FIX WHILE THE VERIFIER IS READING was broken. The crew's
fixes (C1-C8) and the first strand fix (D1) were made in the working tree while the S, P and B lanes were still reading
it, and each of the three said so in its report. None of their findings rests on it: S's probes sail uncrewed boats
and read nothing the crew's edits touched (`test/systems/naval/spyglass.test.js` passed 16 of 16 beside them); B ran every probe
again against the clean archive of 4aec81c85, with identical output; P's findings are in places no crew or strand edit
reached. Every finding was then re-verified against the fixed tree by its own pin, below - but the next audit of a
working tree hands its lanes a snapshot.

**WHAT THEY FOUND.** 159 findings, 24 of them one finding met by two lenses (written `= C9` and so on): 135 in all.
Five reached the player as a broken promise or a hole in the game - a save made past the Veil threw on load under
the classic skin (G2), a wild isle's strand floated its casks again on every return, the Eltheric goods without end
(D1), no Eltheric port had a harbour, so no quay stood at any port of the sea (H1), the Fleet's Summon and Send away
carried a ship across the Veil in a moment (P5), and a General Store paid more for a good than the quay that makes it
asked (B2). The rest: a crew's worth lost at sea, a spyglass that saw through land and night and carried into cabins,
a crossing question that never came back, legends launched twice online, a bounty's quarry that came back whole, the
ledger's day kept for one exchange, words wrong, and a record that promised what the code did not do. The runs that
checked the fixes found eight more (lane V): one a player meets, the chart's tutorial page (V8); the rest a pin or the
record.

## Findings

Severity: HIGH a crash, a lost save or a hole without end; MED a wrong result a player meets; LOW an edge, a risk, a
cost; NOTE a word or a nit; DOC the record alone. Every FIXED is pinned in `test/systems/naval/auditcaptsea.test.js` (the finding's
own id in its test's title) or in the suite its verdict names, and where it changed code it has a mutant in
`tools/mutants/auditcaptsea.json` (ACS-<id>-...); a word in the record, and D18's dead reckoning taken out, have none.

### C - the crew

| # | Sev | Finding | Verdict |
|---|---|---|---|
| C1 | MED | The posts' worth read the party's raw roll (`companions.awayOf`): a companion back on her deck while the captain sailed worked his post for nothing - her canvas, her guns, her lookout as if he were ashore | FIXED: one set of a boat's hands ashore (`ashoreNames`: none while I sail) read by her worth, her First Mate, her card and the deck - executed: a Bosun taken ashore works her canvas at her helm and not off it |
| C2 | LOW | The Fleet page named a companion at the captain's side as his post's holder, with his post's worth | FIXED: the page says "ashore with you" and names the holder among those aboard |
| C3 | MED | The Fleet page's muster (`crewHands`) signed hands on with no service - an Admiralty Carrack's crew Green where a Commodore's harbour signs on Seasoned | FIXED: one `muster` for the deck and the page, asking where they sign on |
| C4 | LOW | Prisoners pressed at sea signed on Seasoned in a Commodore's crown's waters | FIXED: Seasoned hires in a harbour of a crown that favours the captain (`seasonedHires`), never at sea |
| C5 | MED | The First Mate's hands over the rail were drawn past the men she had: a Small Ship of six men stood three or four allies, and the phantoms' falls took her real crew, her First Mate with them | FIXED: capped at her crew's hands (CREW_PER_HAND) and the spirits' one - executed over six, twenty-four and sixty men |
| C6 | DOC | The page let the Lookout's worth carry the glass's far reach past DESPAWN_BEYOND | FIXED in the record: only a ship a fight keeps in the sea stands out there |
| C7 | LOW | A hand who joined was dealt a post by count: a third Bosun while her Cook's post stood empty | FIXED: the post held by the fewest, a whole roster dealt as it always was - executed |
| C8 | NOTE | A Seasoned hire was told as four fights won with her | FIXED: his service brought aboard kept apart (`prior`), never told as her fights (`test/systems/naval/captcrew.test.js`) |
| C9 | DOC | The page said the Fleet's crew panel shows a rank only from Seasoned | FIXED in the record: Green too |
| C10 | NOTE | A wear that was no number (NaN) stopped the sea's clock on her spirits for good | FIXED: a NaN wear reads none |
| C11 | LOW | The posts' worth was pinned by its text alone | FIXED: the Gunner's reload, the Carpenter's mending and the Cook's wear executed at sea against the same crew with the post struck off |

### G - the Eltheric ground

| # | Sev | Finding | Verdict |
|---|---|---|---|
| G1 | MED | The law answered its sea four pixels round the box; the far ring reads 48 and drifts 12 more, so at the Veil with the land beyond the Bay off it drew the Bay's clamped row 0 as a ridge on the way home | FIXED: ETHER_MARGIN 64 - the ring's whole reach from a ship in the box (radius, drift, a normal's neighbour, the cliffs' fade); the ring built at the Veil over a world of land is all sea |
| G2 | HIGH | A save made past the Veil threw on load under the classic skin and `?ether=off` - the start menu's Load said "boot failed" | FIXED: THE SWITCH SPLIT - the sea stands in every game (its ground, places, ships and the way home), the crossing out is the enhanced skin's and online's; `?ether=off` the kill door, and a pixel the world does not stream lands at the way home (past the Veil) or the Bay's nearest, said once it stands (`_streamedLanding`) |
| G3 | MED | The landforms shaped every isle by the Bay's corner pixel (999, 0) clamped from the table | FIXED: a node in the sea's law wears its isle's own climate's land - executed over the hills well above the knee (the first pin compared hills of nothing, under the knee: corrected in this audit) |
| G4 | LOW | `climatePast` turned the Bay edge's ring green with the land beyond the Bay off | FIXED: the continent's climate wherever it stands, the sea's in its law, else the edge's clamp |
| G5 | MED | The Overworld's water law read every isle as water with the land beyond the Bay off, and its plates stood at the sea's height under their silhouettes | FIXED: the composed ground answers its own law (`etherLaw`) to both - executed |
| G6 | LOW | The far ring faded an isle's cliffs at the clamped corner's pixel past the map (a fade of 1: every isle its whole lift on the horizon) | FIXED: faded at the node's own pixel, off the bytes read once into a grid padded by the fade's reach - executed against the clamped |
| G7 | LOW | Open Eltheric water read as a claimed province (politic 147): Raiding Parties announced Betony's raids to a captain at sea | FIXED: no province past the Veil (`regionIndex` -1) |
| G8 | NOTE | World of Daggerfall's pick scanned its whole list for every Eltheric pixel (1.35 ms a pixel, thrown away) | FIXED: its pick the Bay's alone (`onTheBay`) |
| G9 | NOTE | The continent's ring tint depended on the sea's switch | FIXED with G4 |
| G10 | DOC | The margin's reach against the cliffs' fade unsaid | FIXED in the record with G1 |
| G11 | DOC | "Two places share a name about one time in fifty" | FIXED in the record: one time in twenty, measured |
| G12 | NOTE | `compassPoint(0, 0)` said "south" and (0, -0) "north"; a haunt under the port was "some 1 leagues south" | FIXED: no point for no offset; "hereabouts" under half a league; "1 league" (D21) |
| G13 | DOC | "Unbounded in law" | FIXED in the record: past the margin the law answers nothing |
| G14 | NOTE | Masser's key was not leaned past the Veil (it lit land, sea and hulls in the Bay's colour) | FIXED: leaned as the sun's |

### X - the crossing and the chart

| # | Sev | Finding | Verdict |
|---|---|---|---|
| X1 | MED | A refusal (an enemy near, a guest aboard) marked the way asked: the question never came back while she stayed in those waters | FIXED: said once a stay of waters, asked as soon as the deck is clear; said again in waters come back to - executed over the crossing's own text |
| X2 | MED | Yes answered a stale question: after a load it sailed the loaded helm out from wherever it stood and kept that as the way out; `crossedFrom` took any pixel | FIXED: Yes is the question as it stands now (the same helm, waters, no enemy or passenger, the world still), else said and asked afresh; the box taken back at a load or a jump; no way out in the sea's own law, from the ledger or a save |
| X3 | LOW | A party member's helm could be asked through the arrival's wait | FIXED: never while the world is moved (`worldMoveBusy`, `_partyArrivalPending`) |
| X4 | LOW | CROSS_X stood inside the Bay's mouth | FIXED: 230, west of the line from Daggerfall's coast to Myrkwasa's |
| X5 | LOW | A chart bought past the charts' room took gold for nothing | FIXED: as many isles as there is room for; full, none sold |
| X6 | MED | The chart had no pinch, no zoom under a finger or a pad and no note for a tap | FIXED: a pinch, its own buttons (-, +, Ship), a tap names an isle |
| X7 | LOW | A drag stuck past a lost press | FIXED: the mouse's first button alone; ended however its press ends |
| X8 | LOW | The travel map's key did not shut the chart; M was hard-coded | FIXED: the key that opened it shuts it, by binding |
| X9 | LOW | A crossing that failed left the helm let go and the captain where the jump stopped | FIXED: back where she set out - her hull, her helm, the way out as it was - executed |
| X10 | NOTE | A rumour's row carried a stray " - " | FIXED |
| X11 | NOTE | Building the yard's model heard every legend | FIXED: heard where the harbourmaster's tab is shown |
| X12 | NOTE | The bands' names on the wrong side of their lines; the Shallows unnamed | FIXED: each on its deeper side, the Shallows by the Veil |
| X13 | NOTE | A haunt was drawn a circle; it is a square | FIXED |
| X14 | NOTE | The chart's names lettered over each other | FIXED: placed ports first, none over another - executed (a port's lettering the same as on a chart of its ports alone) |
| X15 | NOTE | The chart stood over the Bay after a load or a jump | FIXED: shut with the world it charts |
| X16 | NOTE | The chart's ship pointed where the captain looked | FIXED: her bow's heading at her helm |
| X17 | NOTE | "Land ho! the Sepulchre of ..." - a sentence begun in lower case | FIXED |
| X18 | NOTE | The wheel stepped a whole zoom an event (a trackpad's brush) | FIXED: a step each CHART_WHEEL_STEP of its travel |
| X19 | DOC | The zoom's pivot, the view's clamp, SIGHT_PX, the passengers' line, the heading | FIXED in the record |

### D - traffic, law and legends

| # | Sev | Finding | Verdict |
|---|---|---|---|
| D1 | HIGH | A strand's casks floated again on every return to its reach - the Eltheric goods without end | FIXED: never while her casks float; bare from its first cask hauled (a later one never pushes it on) - executed |
| D2 | MED | A strand's haul floated 700 m off on no bearing of the isle's, some casks on its beach; a swimmer "hauled a cask aboard" | FIXED: alongside the boat that pulled in for it, every cask on water; a swimmer's to his pack, said so |
| D3 | MED | An Eltheric prize's papers washed the captain's notoriety in the nearest Bay capital's waters | FIXED: no crown's law past the Veil - burned, they wash nothing |
| D4 | MED | A freeport's quay rolled the Bay's navy share: crown cutters moored past the Veil | FIXED: the isles' traders |
| D5 | MED | A disguised corsair past the Veil flew a Bay crown's false colours (with S5) | FIXED: the Isles' colours and an Isles name |
| D6 | MED | Online, a peer's copy of a legend paid her purse again and pushed her rise back (= L3) | FIXED: paid only while she sails by this captain's own ledger |
| D7 | MED | Online, two captains apart in one haunt each launched her | FIXED: none launched while any legend sails at any range and any stander's; two copies met, the stander law's claim holds her |
| D8 | MED | `deep` never rode the wire: a peer's haul from a deep ship was two tiers poorer | FIXED: the `d` and `e` keys, both ways; a peer's copy and cask the deep's |
| D9 | MED | A pair met in the deep waters was never the deep's | FIXED: DEEP_LEVEL up and launched `deep`, as a single ship there is |
| D10 | MED | The Ninefold Hunger's terror ("hands who board, and board again") did nothing | FIXED: her first wave thrown back, half her hands come over again; the second beaten as any pirate - executed |
| D11 | MED | LEGEND_RELOAD_K had no reader: the Pale Regent's gunnery did nothing | FIXED: her guns load the quicker |
| D12 | LOW | Online, the captain who stands another's copy of a legend never heard her come | FIXED: every captain whose sea she comes into hears it, once while she is in it |
| D13 | LOW | The veil did not shorten the lookout's hail | FIXED: hailed at the veil's share of the reach |
| D14 | DOC | "One legend at sea at a time" - the Wake's and the Queen's haunts overlap | FIXED with D7 |
| D15 | DOC | "Her hold the richest at sea" - a flagship's strongbox beat it | FIXED: a legend's last LEGEND_STRONGBOXES (2) lots her captain's strongboxes |
| D16 | DOC | The letter of marque: the rival still calls it piracy, and it covers the rival's navy | FIXED in the record and the Captain page's words (= L14, H4) |
| D17 | LOW | The Lantern-Eater stayed after dawn | FIXED: day come, she sails out of the world once no fight holds her |
| D18 | NOTE | The haunt's legend was reckoned every frame and read nowhere | FIXED: gone |
| D19 | NOTE | In the Veil the plate said "The Shallows, 0 leagues past the Veil" | FIXED: "The Veil" |
| D20 | NOTE | Sixteen names a trade moored two ships of one harbour under one name | FIXED: two words of each trade's own, 256 a trade |
| D21 | NOTE | "1 leagues" | FIXED with G12 |

### L - the ledger, the save, online

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L1 | MED | A pirate whose boarders were thrown back was paid again when taken or sunk after: the law's reward and the crown's regard twice | FIXED: ended then - logged after, never paid again |
| L2 | MED | The day's dealing was kept for one exchange: one deal at the next port over filled the first's stock again (= B1) | FIXED: every exchange dealt with that day kept (DEALT_PORTS_MAX), another day's let go, an older save's one port read |
| L3 | MED | = D6 | |
| L4 | MED | A copy taken offline or brought online kept the Captain's days on the other clock: a legend sunk for months "gone down today", a strand bare as long | FIXED: the legends', strands' and dealing's days moved by the days between the clocks, both ways |
| L5 | LOW | The Captain page's meter for a standing below nothing said "15 to Sworn Captain" over an empty bar | FIXED: from the standing itself, its label what the next rank still wants |
| L6 | LOW | The Admiralty's survey counted a harbour's ship stood again (= S12, B5) | FIXED: each ship once by her seed, kept on the contract through a save |
| L7 | LOW | = X5 | |
| L8 | LOW | A hostile save: twin contracts and charts paid twice, a purse of -9999, absurd counts, `regard('constructor')` | FIXED: once each, every count within what a board posts, only a crown's own names |
| L9 | NOTE | A rank won or lost was wiped by the next line said | FIXED: kept back till the centred label is at rest; the crowns naming one rank the same way in one line; a load says none of the game it left |
| L10 | NOTE | "Its navy hunts you" at a quarter of the notoriety its navy hunts at | FIXED: "no favours ... while your notoriety stands so high" |
| L11 | NOTE | "1 pirates", "2 bounty" | FIXED |
| L12 | NOTE | The captain's own things put in a prize's hold and taken out again counted as plunder each pass | FIXED: a hold's own plunder counted once each as it leaves her |
| L13 | DOC | A raid flagship's standing is still paid (the page said the quest alone) | FIXED in the record |
| L14 | DOC | = D16 | |
| L15 | DOC | "The Captain tab stands with the Fleet's" - it stood from a new character's first pause | FIXED in the record |
| L16 | DOC | RANK_PERKS' `salute`, flag options, the relief "sooner", "beating off pays" (no gold) | FIXED in the record and the code (no `salute`) |

### H - the record's honesty

| # | Sev | Finding | Verdict |
|---|---|---|---|
| H1 | HIGH | No Eltheric port had a harbour: a port isle of two kilometres put the water past any harbour's reach (420 m), so no quay stood at any port of the sea, Veilhaven's included (= P2) | FIXED: A PORT IS A TOWN ON A SMALL ISLE - its land the four bytes round its town's pixel's middle (`landCentre`), its shore ETHER_PORT_SHORE_M about the town, its harbour sounded ETHER_HARBOUR_REACH (900 m) through the kernel's own ground - executed over seven ports, both turns of the widest towns cloned |
| H2 | MED | = D9 | |
| H3 | DOC | = D2 (and the cache "beside the ship") | FIXED with D2; the cache's words in the record |
| H4 | DOC | = D16 | |
| H5 | LOW | An unknown hull's card showed her hull and sail bars (= S24) | FIXED: no bars till she is made out - since GLASS-SPOT (`03-World/Captains-Sea.md`), no card at all |
| H6 | DOC | = L15 | |
| H7 | LOW | `test/systems/naval/ethership.test.js` held a tautology, and the nearest-haunt rule went unpinned (its mutant survived) | FIXED: both pinned |
| H8 | LOW | `test/systems/naval/capttrade.test.js`: `assert.ok(priceOf)` always true; the 'wants' margin's check never ran (= B12) | FIXED |
| H9 | LOW | The seams the pages promise unpinned: the office's clock, the yard's discount, sure relief, the sites' water, the isles charted as sighted, the richest prize, the plunder of a cask and a cache | FIXED: each held - executed where it stands up, by source in the world |
| H10 | MED | = D11 | |
| H11 | MED | = X1 | |
| H12 | DOC | THE FOUR HOSTS RULE named on neither slice page | FIXED in the record: both pages name the four hosts |
| H13 | NOTE | Comments cited `scenes/etherCrossing.js`, a `refused(way)` and RANK_PERKS' `salute` - none of them there | FIXED |
| H14 | DOC | = C9 | |
| H15 | DOC | = L16 | |
| H16 | DOC | The log's description: every prize's worth, the repelled by trade, the standing paid | FIXED in the record |
| H17 | DOC | = X19 | |
| H18 | DOC | = G13 (and "days of real time") | FIXED in the record with G13 |
| H19 | DOC | Veilhaven's "Land ho!" example cannot appear (it is charted at the crossing) | FIXED in the record |
| H20 | DOC | The board turns at midnight, not dawn; a bounty's quarry is one of the two strongest | FIXED in the record |
| H21 | LOW | The keyboard's look was not slowed by the glass (= S13) | FIXED: as the mouse's is |
| H22 | NOTE | `test/scenes/dwf_audit.test.js`'s message and comment false while the glass is up | FIXED |
| H23 | DOC | = C6 | |
| H24 | LOW | `test/systems/naval/captboard.test.js` compared `hashKey` with itself; CONTRACT_NEED's draws only range-checked | FIXED: the board's hash against the wire's one home; the needs drawn |

### S - the spyglass

| # | Sev | Finding | Verdict |
|---|---|---|---|
| S1 | MED | The glass was carried through a door into a cabin: up indoors, its lens slowing the look, the wheel eaten, the head held | FIXED: never up while a door builds or the world is moved; down at every door, load and move (`lowerGlass`, navalClear's) |
| S2 | MED | The touch corner's Glass and a d-pad's Spyglass pressed K - the road's follow too: the "Spyglass (aboard)" button followed the road ashore | FIXED: a share's action by the host's own door, never its key - executed through the touch layer and the pad |
| S3 | MED | The d-pad's Spyglass was dead at a helm (Plus); no zoom under a pad or a finger; the foot said K to a pad player | FIXED: the glass's press at the helm too (the helm's prompts say so), the look stick's click its magnification, a finger's Magnify and Lower, the foot naming the pad's presses - executed |
| S4 | MED | The compass marked an unknown hull, false colours and a veiled ship by their true stance | FIXED: by what I know - executed (a provoked trader under false colours a merchantman's mark till her black flag) |
| S5 | MED | The disguise was a tell ("A merchantman of X", "Merchantman"); past the Veil a Bay crown's colours (= D5) | FIXED: the merchant of her own hull, named off her seed as that trader is, lined as that class |
| S6 | MED | The glass held ships no eye could find: by night at any range, behind land, half faded out of the sea | FIXED: the night's sight, the world's own sight cache (`glassSight`), the fade - executed |
| S7 | LOW | "Her guns out on me" was coded as out on anyone: a pirate at a merchantman 1.2 km off was made out by it | FIXED: on me - her target mine, or her boarders on my deck |
| S8 | LOW | The head hold's release was a blind toggle: the travel view and the map left the wrong perspective | FIXED: the view's hold hands the glass's back first; a door's own POV and the map keep the head; a load and a new game forget it - executed |
| S9 | LOW | A save under the glass recorded the head it borrowed | FIXED: the player's own camera - executed |
| S10 | LOW | Over the docked large HUD the reticle was not on the aim | FIXED: the window is the world's strip, every length a share of its shorter side |
| S11 | NOTE | An unknown hull's card title red | FIXED |
| S12 | LOW | = L6 | |
| S13 | LOW | = H21 | |
| S14 | LOW | A key file whose road follow left K (Travel Options' O) loaded with no glass key at all | FIXED: the glass seated on the free K - never over the player's own unbinding, K shared or free |
| S15 | LOW | A video left the glass frozen over it | FIXED: down under a video |
| S16 | LOW | Off the helm a finger had no press to lower the glass | FIXED: Magnify and Lower at its foot wherever it is up, each read once, none kept while it is down |
| S17 | NOTE | The glass and the tags on one z-index | FIXED: the world's labels under the glass, the glass under the HUD |
| S18 | NOTE | "About 1 hands" | FIXED: "a hand", "a hand or two"; the redundant floor of five dropped in this audit (an equivalent mutant: the arms before it round to five) |
| S19 | NOTE | The glass held a ship outside its own field (by her half length, unclamped) | FIXED: by her extent as she lies to the look, never past its circle - executed |
| S20 | NOTE | The card's Hold read her class's cargo, not her hold | FIXED: as it rides - her waters' tiers, an emptied prize's none |
| S21 | NOTE | The black flag's words wrong once seen through; "is a pirate" said for one struck unseen | FIXED |
| S22 | NOTE | The small ship's hull called a galleon while her class line said Brigantine or Cutter | FIXED: a two-master |
| S23 | DOC | The magnification kept between raises unsaid | FIXED in the record |
| S24 | DOC | = H5 | |
| S25 | DOC | = C6 | |

### P - the isles' places

| # | Sev | Finding | Verdict |
|---|---|---|---|
| P1 | MED | The havens' filter (villages and cities of six to sixteen blocks) is always empty over MAPS.BSA (its villages are 2 or 4 blocks, its cities 30 and more): Veilhaven fell back to a 2x2 village, and the page and its pin invented the rest | FIXED: the game's hamlets of six to twelve blocks (1,069 rows) - pinned against the player's own data (ARENA2_PATH), the widest of them inside the 4x3 an isle was measured dry for |
| P2 | HIGH | = H1 | |
| P3 | MED | Online: an isle's ruins leaked into the spawns' templates - a session that stood ruins past the Veil cloned other templates than its party on every Bay pixel | FIXED: never an isle's place |
| P4 | MED | A death past the Veil rose at Betony's temple a crossing away (the ship and her hold left behind); vampirism's cemetery the same | FIXED: the nearest port isle's town (ETHER_RISE_PX, else Veilhaven); no Bay cemetery there |
| P5 | HIGH | The Fleet's Summon and Send away carried a ship across the Veil in a moment; the nearest port was named from the Bay | FIXED: never across the Veil (`veilApart`), laid up she keeps her side through a save, past the Veil the nearest port the sea's - executed |
| P6 | LOW | Recall, a guild's teleport, a portal stone and a party's journey to its leader crossed the Veil | FIXED: refused at every door (`veilRefused`) - executed |
| P7 | HIGH | = G2 (and the online wake ungated by the sea's switch) | FIXED with G2: the wake lands where the world stands |
| P8 | MED | A quest site in an isle town carried the region "the Eltheric Isles": RevealLocation threw (a guild's house job removed on its first tick) and topic gates failed | FIXED: found in the index it stands in, by its region's own name |
| P9 | LOW | House ownership keyed (region 19, building key): one Betony house owned the same key in every isle town | FIXED: no deed past the Veil, no house sold there (`houseOwnedAt`, the one reading of the law) |
| P10 | NOTE | A ruin kept its template's port byte; with Travel Options on an isle's port was no port for the ship | FIXED: by its own kind |
| P11 | DOC | = G11 | |
| P12 | DOC | The exterior's `mapId` and its record's header kept the template's ids | FIXED: every id the isle's place's |

### B - the board, the exchange, the charts

| # | Sev | Finding | Verdict |
|---|---|---|---|
| B1 | MED | = L2 | |
| B2 | HIGH | A General Store paid more for a good than the quay that makes it asked - a money loop with no voyage | FIXED: no shop buys the exchange's goods |
| B3 | MED | The Fleet page's yard hung the harbourmaster's and the exchange's tabs on a ship laid up anywhere: goods taken in and sold where she never sailed | FIXED: on a ship lying to the quay at her helm alone |
| B4 | MED | A bounty's quarry gone down by another hand came back whole, her casks afloat anew each time | FIXED: never stood again; her bounty void, said, no regard lost - executed |
| B5 | LOW | = L6 | |
| B6 | MED | About one chart in five was a dud for good (its port had no water for a cache; the site walk went only inward) | FIXED: the port drawn again (CHART_PORT_TRIES), the walk outward past the drawn reach |
| B7 | LOW | One deed moved every matching contract held: three hunts of a crown done by the same three kills | FIXED: one contract a deed - a bounty's own quarry hers, else the soonest due |
| B8 | LOW | A raised cache was forgotten: the same chart, read again, paid again | FIXED: the raised kept (CHARTS_RAISED_KEEP); read again it marks nothing |
| B9 | LOW | A cache's or a chart's things the pack could not carry went down unsaid | FIXED: kept in an overladen pack, said |
| B10 | LOW | Sites and caches drawn past the map's edge, where nothing streams with the land beyond the Bay off | FIXED: only where the land past the Bay stands |
| B11 | LOW | The exchange sold a hold to a standstill unsaid | FIXED: a purchase capped at her room before she would lie dead in the water, the room said - off Come Sail Away's own reckoning (`cargoRoom`) |
| B12 | LOW | = H8 (and the item sweep never minted goods or charts) | FIXED: the sweep mints both (`test/systems/item/int1_itemlaw.test.js`, `test/honestItems.mjs`) |
| B13 | NOTE | "1 hours left" | FIXED |
| B14 | NOTE | "a Admiral" | FIXED |
| B15 | NOTE | The discount's words; a purse of the bill could not pay for her whole | FIXED: named for what it covers; each row in whole gold |
| B16 | NOTE | "None to buy today" for a good never sold there; the other sea's goods listed with the crossing out not the game's | FIXED: "not sold here"; listed where the captain may sail for them or carries some |
| B17 | DOC | The pay's formula, the dealing's keeping, the shops at base, the site's bearing, the item sweep's row | FIXED in the record |

### V - what the runs over the fixed and merged tree found

The lanes read 4aec81c85; these came out of the runs that checked their fixes - the whole suite over the tree merged
with main, CI on each head, every test that reads the player's data run with it (ARENA2_PATH), and the touched mutation
lists (What stands). Only V8 reaches a player; the rest are each a pin or the record.

| # | Sev | Finding | Verdict |
|---|---|---|---|
| V1 | LOW | G2's word, said once the player stands, stood inside the arrival's statements that `partyBoatTeleportFix` runs over stand-ins of its own: nine of its tests threw on `_unstreamedLanding` | FIXED: the word below them, after `questBridge?.onInitWorld()` - the arrival's statements main's again, line for line (ACS-V1-word-in-the-arrival) |
| V2 | LOW | At the merge: main's SEA-TOWN HUDS pin (`fb1011c_seatown`) runs world.js's `navalHud` over stand-ins, and the plate is handed the glass's state - no glass stood in its scope | FIXED: PIN MOVED, the glass in its scope, asked down and up (ACS-MERGE-plate-glass-unhanded) |
| V3 | LOW | CW-host-temper (`captwaters`) gave no verdict: ETHER-SEA put an `else if` after the line it deletes, so the mutant has not parsed since - at 4aec81c85 too, where the slice's list was taken for all dead | FIXED: re-aimed by content - the deep arm `if (false)`, the chain kept - dead |
| V4 | LOW | SEA-rim-unkept (`ethersea`) died at 4aec81c85 and survived the fixes: H1 gave a port a fall of 1 (0.8 before), whose land's tail past its rim is below nothing and clamps to 0 without the rim, and every "past the rim" pin read Veilhaven | FIXED: the rim asked of a wild isle too, whose fall of 1.5 leaves NaN there without it (`test/world/ethersea.test.js`); the record dead |
| V5 | LOW | FIELD-CSA2's retail-data test threw "etherSea is not defined" from ETHER-PORTS on: it mounts world.js's `csaIsPortTown`, which asks an isle's port first - and it runs only with the player's data, so CI skips it | FIXED: PIN MOVED, the mount handed the sea, its law and an isle's port that answers every pixel, and the open Bay asked - a Bay pixel that asked the sea's ports would read a port; 6 of 6 with the data (ACS-V5-bay-asks-the-sea) |
| V6 | NOTE | At the merge: F212 (`audit26_dungeonfoes`) reads the teleport's first 7,800 characters for its teardown - the needle stood at 7,664 on main and 7,756 on this branch, 7,939 merged | FIXED: PIN MOVED, 8,100 |
| V7 | DOC | Port-Status counted this branch's two Ledger rows in section A's tally (302) and never named them | FIXED at the third merge: 303 rows, 288 standing - BR5's the 301st, this branch's the 302nd and 303rd |
| V8 | LOW | The chart of the Eltheric Ocean popped the sea fight's tutorial page the first time it opened - the windows' door read every window but the yard's as the sea fight's; at the merge of SHIPYARDS, main's door would have read it as the yard's | FIXED: the chart pops no page (`test/systems/shipyards1_found.test.js`, ACS-V8-the-chart-pops-a-page); main's record of the door re-aimed by content, dead |

## Pins moved

The fixes moved pins in 47 suites, each with its note (PIN MOVED, AUDIT CAPTAIN'S SEA and the finding): the crew's
(`auditcrew` C1, `captcrew` C1/C5/C8), the glass's (`spyglass`, `deckwalk`, `livingcrew`, `navaudit_presentation`,
`navaudit_helm`, `seapeace`, `name1_bubbles`, `mwcamera`, `fixf_keybinds`, `fb1004e_padarrange`, `tv1_travel_view`,
`auditwb_world`, `audit39_dungeonshared`, `dwf_audit`), the ground's and the places' (`ethersea`, `etherplaces`,
`moonlight`, `raid1_raidingParties`, `audit_wod_branch`, `gateclear`, `travelmap`, `portal1_stone`, `auditrr2`,
`seat2b_peace_client`, `auditholdings`, `sealanes`), P9's one reading of the deed (`houses`, `home1`, `decor1`,
`fb1001_rent`, `fb1007_hallfolk`, `housecontainers`, `lwfix6_rooms`, `restlodging`, `uxb1n_containerplaque`, `world6`,
`auditworld6a`), the crossing's (`ethercross`, `harbourbook`), the ledger's and the board's (`captlog`, `captboard`,
`capttrade`, `int1_itemlaw`, `honestItems.mjs`), and `ethership` (H7). Three declarations the audit added - WHEEL_STEP,
TAP_PX and CONTRACT_PAY_MAX - named what other modules already declared (`mwCamera.js`, `touchGestures.js`,
`writLaw.js`; `audit24_onehome`), so they and their siblings were renamed: the chart's CHART_WHEEL_STEP, CHART_TAP_PX
and CHART_PINCH_STEP, the board's BOARD_PAY_MAX and BOARD_STANDING_MAX. G2's landing moved into its own helper
(`_streamedLanding`), so the teleport's resets keep their place first (AUDIT 39 #62, CLIMB-ARC F6, F212's window). The
runs over the fixed and merged tree moved three more, each its finding in lane V: `fb1011c_seatown` (V2), `field_csa2`
(V5) and F212's window in `audit26_dungeonfoes` (V6); and `ethersea` asks its rim of a wild isle (V4). G2's word moved
instead of a pin (V1). At the merge of SHIPYARDS: `shipyards1` (a hall's recruit no service kept apart, `prior` 0 -
SHIPYARDS' record his deeds, C8's `prior` a sign-on's alone), `shipyards1_found` (the chart's door pops no page, V8) and
U41's window in `travelmap` (both sides' 12,800 and 13,000, the last needle at 12,879 merged).

## Mutants

- `tools/mutants/auditcaptsea.json` - 331 records, one or more a finding (lane V's ACS-V1-word-in-the-arrival,
  ACS-MERGE-plate-glass-unhanded, ACS-V5-bay-asks-the-sea and ACS-V8-the-chart-pops-a-page among them): all dead but
  four equivalent as recorded, each with its why - X2-yes-sailing (a helm let go is a helm `CurrentBoat` no longer
  names), X4-mouth-host (the law asks the mouth again), D17-fight (a ship in a fight is never let fade), B4-mine-not (a
  quarry of mine is done before she is dropped). Every survivor of the first runs was a pin that could not fail, made
  one that can: the compass's disguise (S4: a provoked trader), the player's own unbinding with K still shared (S14),
  the havens' bounds (P1: literal, the game's own sizes), the ports' lettering (X14: against a chart of its ports
  alone), the host's ashore set (C1), a new day's dealing (B1), the mid-rank meter (L5), the exotic's refusal and the
  world's switch (B16), the void's word (B4), the room handed from the yard to the exchange (B11), a strand bare from
  its first cask (D1); and S18's floor of five, and the swimmer's give line's `swim ? null :`, were arms no input
  reaches - dropped. ACS-P1-types is killed against the player's own data (ARENA2_PATH), the havens' filter run over
  MAPS.BSA's rows.
- 93 records in 35 lists named source the fixes rewrote (`test/tooling/mutantdrift.test.js` holds every record to its text):
  each re-aimed BY CONTENT to the code as it stands, the same law mutated - all dead but one, which survives on the base
  as well (What stands).
- CW-host-temper (`captwaters`) had given no verdict since ETHER-SEA: re-aimed BY CONTENT, dead (V3). SEA-rim-unkept
  (`ethersea`), weakened by H1's port fall, is dead again against the rim's new pin (V4).
- The lists touching every file the fixes changed were run over the fixed tree: see What stands.

## What stands

- THE TOUCHED RUN. Every mutation record of every list that names a file the fixes changed - 7,762 records across main's
  five merges, run with the player's own data (ARENA2_PATH) so its pins run too. Six chunks ran over the heads as the
  merges and lane V's fixes came (8cf4a1804, 91adbd916, 1c740918d, 589fce136, eb60441ad), and the seven records the
  fifth merge brought at cb55f109e; there no touched record is left without a verdict. In all: 7,711 dead, 27 equivalent
  as recorded, 2 without a verdict and 22 survivors. The two without a verdict were V3 (CW-host-temper, re-aimed) and
  V5's record (FIELD-CSA2-host-reads-the-drawn-ground, its test mended): both dead now. One survivor was this PR's,
  SEA-rim-unkept (V4): mended, dead.
- The other 21 survive without this PR. Twenty survive at the base (118313d436), and at 4aec81c85 and main wherever
  their text stands: ACC1d-14-the-chat-link-sends-no-token, AD28Q-J-host-no-party-word, the four AUDIT-GN2-GN1 (the
  berths sounded for the carrack alone, the shallowest keel sounding them, the galleon not among the berthers, sounded
  in the berth hulls' own water), AUDIT-GN2-RG4-a-root-bone-read-as-canvas, AUDIT-LANDFORMS-III-A2-ridged-off-centre,
  the two AUDITLIVED1B, AUDIT-NAV2-F25-the-low-hull-unholed, AUDIT-SHIPS-A5-the-gain-on-every-coast, CSAL-pad-bare-dpad,
  NAV-B-her-colours-struck, four NAVP (the sink's lift dropped, skinned sails counted, the spars' lift, the sails lowest
  first), ONESEAT-hidden-tab-lingers and PERF-ON2-the-peers-are-submitted-uncut-again. NAVP-animators-walked-every-frame
  dies at the base and at 4aec81c85 and survives at main: main's SEA-TOWN CACHE keeps `boatAnimators`' list itself, so
  the naval host's `??=` is belt and braces there. RECORDED: none of this PR's to mend - each is its own slice's to
  answer.
- The first pass, made while the fixes were under way over the lists naming the files the PR itself changed (3,913 of
  6,784 records), found sixteen survivors, every one surviving at the base: the seven of those above it reached, and
  AUDIT625-D3-a-range-the-tools-cannot-read, the two AUDIT-REALM-L1F3, C8-builder-past-held, the four
  CLIMBDOWN-45-degree and NAV-A-the-far-ship-first, whose files the fixes never touched.
- THE PLAYER'S DATA. Every test that reads ARENA2_PATH (149 files, which CI skips) was run with the player's own data:
  1,651 tests - 1,642 pass, 7 skip for data past ARENA2 (the Arena mod's files, real classic saves, the distance bake,
  Morrowind's), and two fail: the vendored-patch sha256 pins IT1 and WD1, which fail identically at main and at the base
  with this copy of the data (its WALLAA08.RMB rebuilds to another hash than the author's) - the copy's, not this PR's.
  The run found V5.
- THE SUITE. The whole suite over the merged head - 26,271 tests, 10 failures: two pins, V1 and V2, mended. CI's
  `verify` is green on eb60441ad; every red head before it was mended on the next push (V6 at the third merge).
- Not verified here: the glass, the chart and the isles in a real browser; a crossing end to end in a running world; two
  captains online past the Veil.
