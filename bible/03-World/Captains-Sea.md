# The Captain's Sea - reasons to sail (CAPT-CREW, CAPT-LOG, CAPT-PAY, CAPT-MARQUE, CAPT-WATERS, SPYGLASS, CAPT-BOARD, CAPT-TRADE, CAPT-CHARTS, 2026-10-11; CREW-TRADE, 2026-10-23)

The owner, 2026-10-11: *"I want to talk about enhancing the naval experience and polishing it more, making it rewarding
and giving a reason to players to experience it"* - and then: *"I want you to make the decisions and completely make
this as detailed as possible, providing depth without overcomplicating systems. This is your baby ... On top of this,
2 things to add. 1. Removing observable names from ships and instead implementing a spyglass option where you can aim
and view to observe other ships, their allegiance, cargo, etc. 2. A brand new open sea map that allows you to traverse
to the etheric sea."* The Eltheric Ocean is its own page (`03-World/Eltheric-Ocean.md`); this one is the Iliac Bay's.

The pre-merge audit (AUDIT CAPTAIN'S SEA, the owner: "Lets do a comprehensive audit, enaure this is insanely detailed
and perfection. No exceptions") is `01-Overview/audits/Audit-Captains-Sea.md`: its fixes stand in the sections below, each
under its finding's id.

**THE PORT'S OWN.** Daggerfall has no sea fight (`03-World/Naval-Combat.md`), and nothing here is transcribed: no DFU
law stands behind a crew's veterancy, a captain's standing with a crown, a letter of marque or a spyglass. Where the
game has a law it is used - a hold is still the DFU loot tables' roll (only its rarity tier moves), Piracy is still
`Crimes.Piracy` through LowerRepForCrime, gold is still gold pieces - and the departure is Port-Ledger section A's
CAPTAIN'S SEA row.

**THE SHAPE.** Before this, the sea fight was a fight and a hold: a ship sunk was a ship sunk, a boarding beaten off
was nothing, the open water was the coast's twin, a ship's name floated over her at seven hundred metres, and nothing
a captain did added up. Now:

- **HER CREW GROWS WITH HER** (CAPT-CREW): every hand's fights and boardings rank him, and the six posts aboard - a
  Gunner, a Carpenter, a Lookout, a Cook, a Bosun, a First Mate - each do one thing more the longer their holder has
  served.
- **A CAPTAIN HAS A NAME TO MAKE** (CAPT-LOG, CAPT-PAY, CAPT-MARQUE): a log of what she has done and a STANDING with
  each crown, ranked Unsworn to Admiral, the ranks' perks the harbours' to give; a boarding repelled pays; a letter of
  marque makes a rival crown's ships prizes in the signer's eyes (the rival still names it piracy).
- **THE DEEP IS WORTH THE RISK** (CAPT-WATERS): far from every port the pirates are more, bolder and bigger, and every
  hold and cask is richer.
- **A SAIL IS A STRANGER TILL SHE IS MADE OUT** (SPYGLASS): no name over an unknown hull; the eye, a Lookout, her own
  guns or the captain's glass tell her - and a pirate may fly false colours.
- **EVERY PORT HAS WORK** (CAPT-BOARD): the harbourmaster's board - bounties on named pirates, hunts, cargoes to carry,
  wrecks to salvage, the Admiralty's survey through the glass - and the letters a rank buys.
- **A HOLD IS WORTH FILLING** (CAPT-TRADE): goods bought cheap where they are made and sold dear where they are wanted,
  and the Eltheric Ocean's three wanted everywhere.
- **A PIRATE'S PAPERS** (CAPT-CHARTS): a treasure chart, now and then, to a cache sunk off the coast.

## The slices

| slice | what | modules |
|---|---|---|
| CAPT-CREW | A HAND'S SERVICE AND HIS POST'S WORTH: fights and twice the boardings rank a hand Green, Seasoned (4), Veteran (12), an Old Salt (30); each post's best holder aboard does its thing by his rank; seasoned hires | `systems/naval/shipCrew.js` (`serviceOf`, `VETERANCY`, `veteranOf`, `POST_WORTH`, `postsOf`, `crewWorth`, `NO_WORTH`, `postWords`, `sync`'s `service` and `prior`, `roleOf`, `tick`'s `wear`), `scenes/naval/navalHost.js` (`crewStep`'s worth, `ashoreNames`, `muster`, `myHands`, the seams), `scenes/fleetHost.js` (`handsOf`), `ui/fleetPage.js` (`handService`), `scenes/world.js` (the CSA refit's way, `seasonedHires`) |
| CAPT-LOG | THE CAPTAIN'S LOG AND STANDING: leagues sailed, the deepest water, ships sunk, taken and beaten off by trade, prizes and plunder, contracts; a standing with each crown and its rank; the Captain page | `systems/naval/captainLedger.js`, `scenes/naval/navalHost.js` (`chargePlayer`'s deed and regard, `notePlunder`, `sailed`), `ui/captainPage.js`, `ui/enhanced/enhancedMenu.js` (the Holdings tab), `scenes/world.js` (the ledger, its save) |
| CAPT-PAY | THE DEAD ENDS PAID: a pirate boarding beaten off is the law's to reward (`PIRATE_REWARD.repelled`) and the log's; a raid's flagship repelled has the law's reward of its quest alone; a pirate beaten off and then taken or sunk is ended once | `systems/naval/navalLaw.js`, `scenes/naval/navalHost.js` (`winBoarding`'s repel) |
| CAPT-MARQUE | A LETTER OF MARQUE: a crown's letter makes a rival crown's lawful ships - merchantmen and navies - its prizes for its term: no grievance of the signer's, no witnesses of the signer's navy, standing with the signer for each; the rival still names it Piracy (its crime, its notoriety, its regard lost); striking the signer's own ship tears it up | `systems/naval/captainLedger.js` (`marque`, `setMarque`, `tearMarque`, `MARQUE_STANDING`), `systems/naval/navalShips.js` (`flagOf`), `scenes/naval/navalHost.js` (`chargePlayer`, the witness) |
| CAPT-WATERS | THE DEEP WATERS: DEEP_PX map pixels and more from every port - pirates DEEP_PIRATE_K as likely, the trade DEEP_TRADE_K, classes DEEP_LEVEL levels up, a pirate bold DEEP_BOLD of the time, holds and casks DEEP_TIER tiers richer; the plate says the deep | `systems/naval/navalDirector.js` (`watersOf`, `factionWeights`), `systems/naval/navalAI.js` (`temperOf`'s `bold`), `systems/naval/navalShots.js` (a cask's `deep`), `scenes/naval/navalHost.js`, `ui/naval/navalHud.js`, `scenes/world.js` (`navalPortPx`) |
| CAPT-BOARD | THE HARBOURMASTER'S BOARD: five kinds of contract a port posts a day, held on the captain's clock, their sites stood at sea; the letter of marque and the Admiralty's carrack for sale; a rank's favours at the yard, among the hands and in the relief | `systems/naval/harbourBoard.js`, `scenes/harbourOffice.js`, `systems/naval/captainLedger.js` (the contracts), `scenes/naval/navalHost.js` (THE SITES, the events), `systems/naval/navalYard.js` (`discount`), `systems/naval/navalDirector.js` (`reliefSure`), `ui/naval/navalYardWindow.js` (the Harbourmaster tab), `scenes/world.js` (the office, the ports, a site's point) |
| CAPT-TRADE | THE EXCHANGE: eleven goods, a crown's ports' makes and wants and a port's own twist, a day's drift, the exchange's spread and a day's stock; the goods as items in a hold | `systems/naval/tradeGoods.js`, `scenes/harbourOffice.js` (`exchange`), `ui/naval/navalYardWindow.js` (the Exchange tab), `systems/item/itemLaw.js` |
| CREW-TRADE | CREW AT THE EXCHANGE (2026-10-23): a port's stand to sailors, a man priced as a good, signed on to the ship at the quay and off her by the head, a gold under the shipwright's man at most | `systems/naval/tradeGoods.js` (`CREW`, `crewStandOf`, `exchangeOf`'s `crew`), `systems/naval/crewTrade.js`, `scenes/naval/crewDeal.js`, `scenes/naval/navalHost.js` (yardModel's `crewDeal`), `scenes/harbourOffice.js` (`buyCrew`, `sellCrew`), `ui/naval/navalYardWindow.js` (the crew row), `scenes/world.js` (`navalOpenYard`) |
| CAPT-CHARTS | TREASURE CHARTS: a chart among a pirate's papers, read and marked, its cache floated and raised | `systems/naval/treasureCharts.js`, `scenes/harbourOffice.js`, `scenes/naval/navalHost.js` (`pickCache`), `scenes/world.js` (the chart's use), `ui/captainPage.js` |
| SPYGLASS | WHAT A CAPTAIN KNOWS OF A SHIP, AND THE GLASS: her hull at any range, her colours and name by the eye, a Lookout, the glass or her guns, the rest through the glass close; no tag on an unknown hull; false colours; the Spyglass action, its lens and its window | `systems/naval/shipKnowledge.js`, `scenes/naval/navalHost.js` (`knowStep`, `glass`, `glassCardOf`, the tags, cards, hails and cries), `ui/spyglassView.js`, `ui/naval/navalHud.js` (the plate's Glass), `player/mwView.js` (`mwViewHoldFirst`), `systems/inputActions.js`, `ui/touch/touchButtons.js`, `ui/plus/plusPadBinds.js`, `ui/plus/plusPad.js`, `scenes/world.js` (`spyglassStep`, `spyglassWheel`, the lens) |

THE FOUR HOSTS (Home.md; AUDIT CAPTAIN'S SEA H12 - the slices named none): the sea, its ships and every seam here are
`scenes/world.js`'s - the streaming exterior's, where the sea is. `scenes/exterior.js` (the bench) stands no sea and no
ship: FLAGGED, nothing wired. `scenes/worldModes.js` (a building) and `scenes/dungeonContext.js` (a dungeon) own no sea:
FLAGGED - the glass comes down at their doors (`navalTransition`'s `lowerGlass` - S1), the Captain page and the Fleet's
are the pause menu's in any of them, and the ledger's save is the world's slot whichever host is in play.

## CAPT-CREW - a hand's service and his post's worth

A hand's SERVICE is his fights and twice his boardings (`shipCrew.js serviceOf` - a boarding is the fight that counts
most), and the service a SEASONED HIRE brought aboard (`prior`, kept apart and saved - AUDIT CAPTAIN'S SEA C8: it was
written as four fights he never won with her); `VETERANCY` ranks it Green, Seasoned at 4, Veteran at 12, an Old Salt at
30. His line on the crew card says so from Seasoned up (`crewCard`); the Fleet page's crew panel says his rank at every
rank, Green too (`ui/fleetPage.js handService`: rank, deeds, what his post does - AUDIT CAPTAIN'S SEA C9).

THE POSTS (`POST_WORTH`): each of the six roles does one thing, by the BEST holder aboard (`postsOf`), a Green holder's
`base` and `per` more a rank. A hand ashore with me as a companion works none - and none is ashore while I sail: her
posts' worth, the hand who answers for her, her card and her deck read the host's one set (`navalHost.js ashoreNames`
- AUDIT CAPTAIN'S SEA C1: the worth read the party's raw roll, and a companion's post was worth nothing at sea while he
stood it on her deck); the Fleet page says such a hand "ashore with you" and names the post's holder among those aboard
(C2). The roster DEALS the posts by `roleOf`: her First Mate first, a Bard his calling, then the post of ROLES held by
the fewest (every post once, then a second holder of each) - a hand who joins fills the post a fallen or reassigned hand
left (AUDIT CAPTAIN'S SEA C7: it was dealt by count, a third Bosun while her Cook's post stood empty). A small crew is
dealt the first posts - a Bosun, a Gunner, a Carpenter - so a galleon names her Lookout and her Cook on the Fleet page
(its Crew panel says so):

| post | worth | Green -> Old Salt | where it is read |
|---|---|---|---|
| Gunner | the guns' reload, shorter | 4% -> 13% | the gun deck's `reloadScale` (`navalHost.js myBoatState`) |
| Carpenter | the mending and the repairs, faster | 15% -> 45% | `repairStep`, `fieldMend` |
| Lookout | the lookout's reach, further | 10% -> 40% | the hail's range (`hailSails`), SPYGLASS's glass and his own call (`deckEye`) - the glass's far reach past DESPAWN_BEYOND finds only a ship a fight keeps in the sea (AUDIT CAPTAIN'S SEA C6) |
| Cook | the sea's wear on spirits, slower | 25% -> 100% | `tick`'s `wear` |
| Bosun | way under sail | 1% -> 4% | Come Sail Away's Rigging read (`world.js` the CSA runtime's `refit` folds `naval.postsWay` into `speed`) - never the helm's own `wayScale`, which a captain reads too |
| First Mate | hands over a boarding's rail | +1 a Veteran, +2 an Old Salt | `myHands` (the boarding's cap moves with him - never past the hands her crew has the men for and the spirits' one: AUDIT CAPTAIN'S SEA C5, a Small Ship's six men stood four and the phantoms' falls took her real crew) |

`crewWorth` reads them all once a frame onto the boat's state (`crewStep`); a boat with no crew aboard reads
`NO_WORTH`; a wear that is no number reads none (C10). A SEASONED HIRE (`sync(roster, { service })`, SEASONED_HIRE of
`prior`, capped at an Old Salt's) is a Commodore's perk in that crown's HARBOUR (`world.js seasonedHires`: the port the
captain lies at, never the waters she sails - AUDIT CAPTAIN'S SEA C4: men pressed at sea came Seasoned), read wherever
her roster is mustered - the deck's and the Fleet page's alike (`navalHost.js muster` - C3: a laid-up ship's hands signed
on Green).

## CAPT-LOG - the captain's log and her standing

`systems/naval/captainLedger.js createCaptainLedger` - saved under its own vendor, `Captain` v1
(`registerModSaveData`; SAVE_VERSION is never bumped), and shown on the HOLDINGS window's Captain tab
(`ui/captainPage.js`, beside the Fleet's - wherever there are ships to captain: AUDIT CAPTAIN'S SEA L15, it stood from a
new character's first pause with Come Sail Away off and the Fleet hidden).

THE LOG: leagues sailed at a helm (`sailed`, LEAGUE_M a league - a frame's way, never a jump: a step over 100 km is
refused), the deepest waters sailed, ships sunk and taken by trade (`LOG_TRADES`: pirate, merchant, navy, and the
Eltheric Ocean's two) and boarders beaten off (one count, not by trade - H16), the richest prize (not every prize's
worth), the plunder hauled (`navalTransfer.js navalLootWorth` - gold pieces at their count, the rest at its value: a
hold's own items each counted once as they leave it, by Take all or by hand - AUDIT CAPTAIN'S SEA L12: the captain's
own things put in and taken out again were counted every pass), the contracts done by kind (`LOG_CONTRACTS`). `logLines` says it in a captain's words, one of a thing
"1 pirate" (L11).

STANDING: a number with each of the three crowns, CROWN_STANDING_MIN to CROWN_STANDING_MAX. A DEED (`deed(act, cls, { crown,
marque })`) is the law's own act on the Bay's ships - `DEED_STANDING` for a pirate sunk, taken or beaten off, times
her class's cargo size, with the crown whose waters it was in; PIRACY (`PIRACY_STANDING`: firing on, sinking or
boarding a lawful ship) costs it; a LEGEND sunk is LEGEND_STANDING with every crown. `CROWN_RANKS`: Unsworn, Sworn Captain
(15), Privateer (50), Commodore (120), Admiral (250); a rank won or lost is said mid-screen once (`takeRankChanges`) -
kept back till the centred label is at rest, the crowns that named the same rank the same way in one line (`world.js
captainSay`, `captainSayFlush` - AUDIT CAPTAIN'S SEA L9: "The Terror of Ykalon is yours!" and a legend's end, said in
the same breath, wiped the promotion before it showed). The page's meter runs from the rank's floor - below nothing,
the standing itself - and says what the next rank still wants (`standingMeter` - L5: -99 read "15 to Sworn Captain").
A save's record is cleaned field by field (L8): a contract and a chart once by id, a contract's purse, regard, need and
count within what a board posts, the leagues and a letter's end bounded, a crown's name read as its own key only.

THE PERKS (`RANK_PERKS`, `perksOf(rank, notoriety)`): the shipwright's repairs and powder at a discount (his stores and
grog are what they cost), the contracts' pay, the harbour's contract offers more, a letter of marque to buy, the
Admiralty carrack, seasoned hires, and the crown's relief that always answers (AUDIT CAPTAIN'S SEA L16: "sooner") - and
NONE of them while the crown's notoriety against her stands at PERKS_REFUSED_AT or more: its harbours keep no favours
for her then (its navy hunts at NAVY_HUNTS, twice it - L10: the windows said "its navy hunts you" at the first).

## CAPT-PAY - the dead ends paid

A boarding beaten off was nothing: the boarders died and the sea went on. `winBoarding`'s repel now charges the law
(`chargePlayer('repel', ...)` - `navalLaw.js lawOf`'s `repel` act, `PIRATE_REWARD.repelled`: the legal and the
knightly factions' regard, a flagship's reward for a flagship; no gold) and the log, the deed's standing with it. A
raid's FLAGSHIP repelled has the law's reward of its quest (`questPays`): the law's reward is not paid twice; the
crown's regard is the ledger's, paid once (the quest pays none - AUDIT CAPTAIN'S SEA L13). A pirate beaten off is ended
then: taken or sunk after (she lies struck and crewless alongside), her end is logged and paid no second time - no
second reward, no second regard (`chargePlayer`'s `paid` - L1).

## CAPT-MARQUE - a letter of marque

`captainLedger.js marque(now)` - a crown's letter, `{ crown, until }` on the captain's own clock (`playerTicker
ownMinutes`, never the world's: a session closed is no day of the letter's). While it holds, a lawful ship - a
merchantman or a navy's - flying a RIVAL crown's colours (`navalShips.js flagOf`: a merchantman's home port's crown
FLAG_HOME_SHARE of the time, else a crown drawn off her seed) is the signer's prize (`chargePlayer`'s `under`): no
grievance of the signer's, the signer's navy no witness (`provoke` spares a navy whose flag is the signer's),
MARQUE_STANDING with the signer. The RIVAL still names it Piracy - its crime, its notoriety and the act's standing lost
with it (AUDIT CAPTAIN'S SEA L14/D16: the page and the notes said "no crime"). Striking a ship of the signer's own
tears the letter up, said mid-screen. The harbourmaster sells it (CAPT-BOARD below).

## CAPT-WATERS - the deep waters

`navalDirector.js watersOf({ nearPort, portPx })`: COASTAL within a port's reach (SEA-EASE's own), DEEP at DEEP_PX map
pixels and more from every map port (`world.js navalPortPx` - the Chebyshev distance to the nearest of every map
port's pixel, asked once a pixel), OPEN between; a distance nobody measured is no deep. In the deep the director's
weights draw a pirate DEEP_PIRATE_K as likely and the trade DEEP_TRADE_K (`factionWeights`; a port's waters keep their
peace whatever), classes DEEP_LEVEL levels over the captain's own, and its spawns carry `deep` - a pair met there too
(AUDIT CAPTAIN'S SEA D9: an encounter's two were never the deep's), and the mark rides the wire (`navalWire.js`'s `d` and
`e` - D8: a peer's copy of a deep ship, and a peer's haul of a deep cask, were open water's): a deep pirate is bold
DEEP_BOLD of the time on the same draw that makes a coast's bold at BOLD_SHARE (`temperOf`'s `bold`), and her hold, her
casks hauled and her casks stowed are rolled DEEP_TIER rarity tiers up. The helm plate says "X waters, deep".

## SPYGLASS - what a captain knows of a ship, and the glass

**WHAT I KNOW** (`systems/naval/shipKnowledge.js`): each ship in my sea carries `known`, `KNOW.hull` to
`KNOW.studied`, raised by `knowledgeOf` each frame (`navalHost.js knowStep`) and never lowered while she is in the sea:

- **KNOW.hull** - what the eye sees at any range: her kind ("a galleon"), her way, her smoke. She wears NO TAG and
  gives NO CARD - not the look's, not the laid guns' (GLASS-SPOT, below): a sail on the sea, unnamed and unranged, till
  she is made out; the glass's own card under the reticle is "Unknown galleon", nothing of her stance or where she is
  bound. The lookout's hail names her kind ("Sail ho! A sloop on the starboard beam!") and the crew
  calls her so (`calledName`).
- **KNOW.colours** - her colours, name and trade: by the naked eye within NAKED_EYE_M (by night a dark ship's within
  NAKED_EYE_DARK_M), a LOOKOUT aboard within LOOKOUT_ID_M times his worth (he calls it: "Lookout: A sloop flying
  Wayrest's merchant colours!", and from the bow), the glass held on her GLASS_STUDY_S within GLASS_FAR_M times the
  Lookout's worth, her GUNS OUT ON ME (run out at my side, or her flashes) at any range, or a crown's relief come to my
  aid. Her tag stands now (SHIP-TAGS' own), her card names her.
- **KNOW.studied** - her guns, hands, hurts and hold, her captain's name, a bounty on her: the glass held
  GLASS_STUDY_NEAR_S within GLASS_NEAR_M - or she strikes, is boarded or is taken.

By night the glass and a Lookout see no farther than `shipWatch.js nightSight` lets a lookout: a lit ship to
NIGHT_LIT_SIGHT, a dark one to NIGHT_DARK_SIGHT. GLASS_FAR_M stands inside `navalDirector.js DESPAWN_BEYOND`: a sail the
glass can find is one the sea still holds - with a Lookout's worth its far reach passes DESPAWN_BEYOND, and there finds
only a ship a fight keeps in the sea (AUDIT CAPTAIN'S SEA C6). Knowledge is each player's own - never on the wire. The
compass marks a ship by it too (`compassShips` - S4): an unknown hull's, and false colours', no red.

**FALSE COLOURS** (`falseFlagOf`): DECEIT_SHARE of the WARY pirates - never a bold one (she has no need to hide), a
flagship, Warm Ashes' raiders (bold) or a hand-launched foe (`plain`) - fly a crown's merchant colours, the crown drawn
on DECEIT_SALT's stream off her seed, the same on every client. Read from afar she is THE TRADER SHE PASSES FOR
(`navalHost.js disguiseOf` - AUDIT CAPTAIN'S SEA S5: "A merchantman of Wayrest", named and lined like no real ship, was
the tell): the merchant of her own hull (`merchantOfHull`), named off her own seed as that trader would be and lined as
that trader's class, flying the false crown's colours - past the Veil the Isles' names and colours, as every trader
there (D5); her tag and card that trader's, friendly, bound nowhere; a merchantman's pennant at her masthead
(`poseShip`'s colours `false`); no lookout hails her. The glass held close sees through her (`KNOW.studied`: "False
colours! The Black Gull is a pirate." - said only where she is seen, the glass on her, the eye or the Lookout - "Too many
gunports for a trader" on the card) and she is a pirate to me from then. Going for her prey she RUNS UP THE BLACK FLAG
(`blackFlag`): said where her flag is seen - the trader she passed for by name while her colours held ("False colours!
The Patient Tide runs up the black flag!"), her own name once seen through, her kind if unknown ("A sloop runs up the
black flag!") - S21; the black at her masthead. Her guns tell her colours only run out ON ME, or her boarders on my deck
(S7: a pirate at a merchantman 1.2 km off was made out by it).

**THE GLASS** - the `Spyglass` action (`inputActions.js`: appended; a port row; in Come Sail Away's group and its
`MOD_ACTIONS` - live while the ships are; a DEFAULT SHARE on K beside Travel Options' `FollowPaths`, and seated on a free
K where a key file moved the road's follow off it - AUDIT CAPTAIN'S SEA S14). One press raises it, the next lowers it
(`world.js spyglassStep`), ABOARD only (`naval.aboard` - at a helm, on a deck, mine, another player's or the sea's: a
deck has no road, and `travelFollowPressed` is never read aboard). A finger's Glass and a d-pad's Spyglass are the
host's own door (`glassDoorPress`), never K (S2: they followed the road ashore). Down at once ashore, under a window or
a pause, under the travel view, with a broadside laid, on a death's screen - and at every door, load and move of the
world and under a video (`navalClear`'s `lowerGlass` - S1/S15: carried into a cabin, its lens slowed the look indoors).
While it is up:

- the view is the HEAD's (`player/mwView.js mwViewHoldFirst`: a third-person body put into the head and handed back as
  it stood - the travel view taken under it reads the body the player stood in, a door's own head kept, a save records
  the body not the borrowed head (S8/S9); the perspective key refused meanwhile; the travel view's own hold wins);
- the LENS narrows to its magnification (`ui/spyglassView.js glassFov` - the field's tangent over it - at the frame's
  projection, the sky and the far ring alike; eased over GLASS_EASE_S); the spawners keep the wide lens, so nothing
  they place pops into the view the glass comes down from; and it FOCUSES PAST THE SHIP I STAND ABOARD (GLASS-CLEAR,
  below): her masts, sails and hands out of the view;
- the LOOK is slowed by it (`glassLookScale` - the mouse's, the finger's, the pad's and the keyboard's: S13);
- the WHEEL turns it, x2, x4, x8 (`spyglassWheel`, the glass's before the camera's); a pad's look-stick click
  (`GLASS_PAD_ZOOM`) and a finger's Magnify at the window's foot turn it round (`nextGlassZoom` - S3/S16); it opens at
  the magnification it was last turned to, GLASS_ZOOM at first (S23);
- the naval host makes out the ship it HOLDS (`navalHost.js glass`: `glassHolds` - the look within her extent as she
  lies to it, her length abeam and her beam bow-on, at her range, or the reticle's RETICLE_DEG at the magnification,
  never past the tube's own field (S19); the nearest to the centre; only a ship an eye could find - by night within what
  the night lets the glass see of her, never one behind the land (`deps.sightBlocked`), never one half faded out of the
  sea (S6); a ship the glass leaves is begun afresh) and the WINDOW (`drawSpyglass`) draws the tube, the reticle and her
  card under it over the world's strip - its centre the crosshair's over the docked bar (S10) - (`shipKnowledge.js
  glassCard`: her name in her tone, an unknown hull's never red (S11), her line, her rows as far as she is made out -
  her hold as it rides, her waters' tiers and an emptied prize's none (S20) - the study's bar while it fills, and how
  close the next lesson wants her); its foot says the magnification and the presses. The helm's card names no unknown
  hull at all (GLASS-SPOT, below - where S24 had shown her no bars: her hurts no more read than her colours).

A finger has the touch corner's Glass (`touchButtons.js`) and, at a helm, the plate's own Glass over the Brace
(`navalHud.js navalTouchGlass`, brass while the glass is up), and the window's own Magnify and Lower wherever it is up
(`spyglassTaps` - S16); a pad has a bindings row and a d-pad choice (`plusPadBinds.js`, `plusPad.js`) - at a helm the
d-pad press given the glass is the glass's, the helm's gesture on it yielding, its prompts saying so (`glassHelmPrompts`
- S3). Controls.md has the row.

## GLASS-SPOT and GLASS-CLEAR - nothing spotted before the glass; the ship out of its way (2026-10-11)

The owner: "You can spot ships before you even decide to use the spyglass and the ship blocks your view most of the
time when using your spyglass". `test/systems/naval/glassclear.test.js` (9), `tools/mutants/glassclear.json` (41, all dead).

**GLASS-SPOT - A SAIL NOT MADE OUT GIVES NO CARD** (`navalHost.js targetCard`). The helm's target card named every hull
within 900 m the look passed over - "Unknown two-master", her range, her way - so a ship was spotted, and ranged, at a
glance: past the naked eye's reach, by night, in the fog, before any glass was raised. Now a hull at `KNOW.hull` gives
none: the look's card passes her by, and a broadside laid on her shows no card at all - never the card of a ship made
out that the look runs on to past her. She is a sail on the sea till the eye (NAKED_EYE_M), a Lookout, the glass or her
own guns make her out; then her card is hers. The card's own rows for an unknown hull (`targetCardOf`'s `made`, and
`shownName`'s "Unknown galleon") are kept as the knowledge law's belt-and-braces: the tags skip her, and the card's one
other caller, the board card on foot, names only a ship struck or a prize, which `knowStep` makes out to the full the
frame she strikes (the four records on them - SPY-H-card-stance-shown, SPY-H-card-faction-shown, SPY-H-name-unknown,
ACS-S24-card-gate - are recorded `equivalent` for it).

**GLASS-CLEAR - THE GLASS FOCUSES PAST HER** (`ui/spyglassView.js glassNear`, `glassClearDepth`, `glassEyeOverSea`;
`navalHost.js ownExtent`; `world.js spyglassStep`). Raised at a helm the view is the head's, behind her own masts, sails,
wheel and hands - and through a glass at x4 the nearest of them filled it: from the galleon's helm her own parts covered
a fifth of the glass's circle abeam and all of it toward the bow. A glass shows nothing nearer than it is focused, so as
its lens comes on the world's NEAR PLANE stands out from the eye's own GLASS_NEAR_MIN (0.2 m) to just past the ship I
stand aboard:

- **her box** (`ownExtent`): the ship my feet are aboard - my deck (`boatInPlay`: at her helm, or on foot), a sea
  ship's I stand on, or another player's I ride - as ONE box in her own frame, heeling and pitching with her: every rigid
  mesh of her hull and rig (`sparsOf` - kept OWN_SPARS_S, 0.5 s: it walks every mesh of hers, most of a millisecond on
  the galley's 136; another ship's taken at once) and her set canvas where its booms swing it, each frame (`rigBoxesOf`
  - it billows past the spars). Null aboard none.
- **her depth** (`glassClearDepth`): how deep along the look that box reaches into the glass's view - the square about
  its circle, the reticle's `field` - each face cut to the view's four sides and its deepest point taken: her far side
  abeam, her bow ahead.
- **the focus** (`glassNear`): her depth and GLASS_CLEAR_PAD (0.5 m), eased in with the lens, never past GLASS_NEAR_MAX
  (120 m) - and NEVER SO FAR THAT THE SEA AT THE VIEW'S FOOT IS CUT, which would open a hole in it: where the view's lower
  edge meets the sea (GLASS_SEA_MARGIN, 0.6 m, over its level for the swell; over the ground there where a shore stands
  higher, `glassEyeOverSea` along the look's bearing, `heightAt`), its depth along the look, GLASS_SEA_SHARE (0.85) of
  it. Aboard nothing, with the lens off, or the ships switched off: the eye's own.

Because the focus stops at HER, every ship beyond her stays in the glass - and is held by it - however close: a merchant
45 m off the galleon's beam lies wholly past a focus of 8 m. `naval.glass` holds no ship nearer than the focus (she is
not drawn in it). No tag, no crew bar or line, and no player's name stands over what the focus cut away (`world.js
glassCuts` - her own hands on my deck would float in the glass). The sky and clouds are drawn at the far plane, the
shadow cascades about the eye and nothing reads the near plane but the frame's own matrix, so the deeper near costs
nothing else; the sea is drawn under every hull (the hull's WaterMask never draws), so where her deck is cut away the
sea shows.

WHAT IT CANNOT CLEAR: where the sea holds the focus short of her. From the x4 glass, looking level along her own deck,
that is only the Large Galley's long bow (93 m of her, her helm 82 m abaft her stem): the focus stops at the sea's 63 m,
and her bow past it stays in view. A lower glass (x2) or a look lowered toward her deck brings the sea's foot nearer -
the Carrack's, the Large Boat's and the galleon's forward deck then stay in the glass too. Every other hull and bearing,
at x4 and x8, looking level or above: nothing of her past the focus (test/systems/naval/glassclear.test.js walks each hull's parts on
twelve bearings at x4, level and raised).

## CAPT-BOARD - the harbourmaster's board

A port's harbourmaster (the shipwright's window's HARBOURMASTER tab, at the helm lying to his quay - the yard's own
door; the Fleet page's yard is the shipwright's alone - AUDIT CAPTAIN'S SEA B3: a ship laid up a port away took goods
in and sold them out where she never sailed) posts `harbourBoard.js BOARD_OFFERS` contracts a day, and a rank's
`offers` more, drawn off the port's key and the WORLD's day on BOARD_SALT's stream: the same board for every client, a
new one as the world's day turns at midnight (H20), an offer taken gone from it for the day (its place never refilled).
The kinds, each ending in something the sea already does:

| kind | what | done when | purse |
|---|---|---|---|
| bounty | a named pirate - her class one of the two strongest within two levels of the captain's (`bountyClass`; the flagship from level 12), her name her seed's - last seen SITE_PX map pixels off the port in open water (`siteFor`: every neighbour of her pixel sea, on the square ring, in from the drawn distance and then out past it (B6), eight ways round) | she is sunk or taken by the captain's hand (`advance`'s `end` with her `bounty` id); gone down by another hand, void (`lost` - B4) | PAY_BASE.bounty times her size, and her waters' distance |
| hunt | CONTRACT_NEED.hunt pirate ships ended in the crown's waters | sunk or taken there, any of them (a boarding beaten off is no end) | PAY_BASE.hunt each |
| delivery | a cargo to another port DELIVERY_PX_MIN or more off that the sea bears on (`deliveryPort` - PORT-TOWNS, below; within SEA_RING, BERTH-RING), its term DELIVERY_DAYS_BASE and a day a DELIVERY_PX_DAY pixels | the boat that took it on lies to that port's quay; wrecked, it is lost; held for a place that is no such port, void (`unported`) | PAY_BASE.delivery a pixel and its start |
| salvage | a merchantman gone down SITE_PX off the port - CONTRACT_NEED.salvage casks of her cargo | each cask hauled out of the sea where she went down | PAY_BASE.salvage a cask, and the distance |
| survey | the Admiralty's measure of the crown's shipping - CONTRACT_NEED.survey ships studied through the glass in its waters | each ship the glass studies (`KNOW.studied` by the glass, never a ship struck), each ship once - her seed kept on the contract (`seen` - L6: a harbour's ship stood again was counted again) | PAY_BASE.survey each |

Every purse is its kind's base times the captain's level (PAY_LEVEL a level) and the rank's `pay` - a bounty's and a
salvage's distance (PAY_SITE_PX a pixel) added after - to the nearest five (`payOf` - AUDIT CAPTAIN'S SEA B17). A deed
moves ONE contract (`contractEvent` - B7): a bounty's own quarry hers, else the soonest due of those it would move
(three hunts of a crown were all done by the same three kills); a berth and a wreck are every delivery's in that hold.
A contract runs on the captain's own clock (CONTRACTS_MAX at once - `captainLedger.js holdContract`); done, it pays and its crown's
regard rises by its `standing`, its kind and its purse in the log; failed (a term out - the world asks every two
seconds - or a cargo lost) STANDING_FAILED; given up from the tab, STANDING_ABANDONED. The HUD says each one come
further ("Clear Wayrest's waters: 2 of 3 pirate ships ended"), the screen's middle each done or failed.

THE PORTS (PORT-TOWNS, `01-Overview/bugs/Field-Bugs-2026-10-13c.md`; the owner: "Even the port quests sending you to non port
places"). The board's ports - the port a captain lies at (`world.js navalPortHere`, the nearest within a map pixel - within SEA_RING since BERTH-RING, below), a
cargo's, a treasure chart's - are the TOWNS among Travel Options' harbours (`world.js navalPortList`, `portPlaces.js
isPortTownType`) that the open sea bears on (`portSites.js seaBears` - INLAND-PORTS, `01-Overview/bugs/Field-Bugs-2026-10-14-inland-ports.md`):
the towns that stand the port's places, 106 on the real map. The table is every place a ship may put
in at - MAPS.BSA's 343 flagged locations and Hazelnut's extras - and 223 of its 378 are tombs, farms, inns, temples,
manors, graveyards and ruins, which the board read as ports with harbourmasters until then. A cargo went only to a port
with the sea beside it - its own map pixel or one of the eight about it (`harbourBoard.js deliveryPort`, `net/fortLaw.js
coastalAt`), the berth's reach then: 101 of the 106, each answering to its own name from a sea pixel beside it - never to
Daggerfall, Sentinel and Wayrest, two pixels off it (BERTH-RING, below, made the reach SEA_RING). A capital inland is no port of the board's at all (36 of the 39
the byte's 0x10 marks have no open sea within two pixels), nor is a town by a lake inland (INLAND-PORTS: the twelve
that took a cargo until then). A cargo already held for a place that is no such port is void at the office's tick, no
regard lost, and said ("Contract void - ... No ship can make port there.").

A PORT'S WATERS ARE THE PORT LAW'S RING (FB1020c BERTH-RING, 2026-10-20 - the field: the tutorial's *"sail from one
harbor too another"* never registered). The berth - a boat of mine at her helm, slow, no hostile ship near, in a port's
waters (`navalHost.js siteStep`, `yardHere`) - is what a delivery, the questlines' `port-reached` (the harbour office:
a berth at another port a quarter league under sail after the port she last lay still in - VOYAGE-HOLD,
`01-Overview/bugs/Field-Bugs-2026-10-21b.md` - "Under Sail", "The Packet Lanes") and the
shipwright all ask; and a port's waters were a map pixel about the captain's (`navalPortHere`, and a place the port's
data flags within one, `navalNearPort`). The shore DFU's kernel builds lies past it at twelve of the 106: no water a
Small Ship lies in within a pixel of Daggerfall, Wayrest, Holwych, Ripmore, Isfakabi, Pencart, Aldbrugh, Gallocart,
Wilderham, Longwich End, Longmore Field or Wartale - no voyage into or out of one counted, no cargo for one could be
delivered, no shipwright stood there. Within SEA_RING - the open sea's reach that makes a town a port
(`portSites.js seaBears`) - every one of the 106 has it. So the port lain at is the nearest board port within SEA_RING
(`portSites.js:"export function boardPortAt(ports, x, y) {"` - by the crow's flight since VOYAGE-HOLD: by the ring's
squares a tie went to the list's first, and Pencart's every pixel of water tied Longham's), handed whether or not a flagged place is within a
pixel (`world.js:"nearPort, port: navalPortHere(), waters:"`); the berth, the shipwright and the crew's port read the two
through one question (`navalHost.js:"const inPortWaters = () => { const w = where(); return !!(w.nearPort || w.port); };"`);
and a cargo goes to a port the sea bears on within SEA_RING (`harbourBoard.js:"export const deliveryPort = (p, seaAt) => !!p && seaBears(p.px, p.py, seaAt);"`)
- all 106 now, Daggerfall, Sentinel and Wayrest among them. Left at its pixel, asked another question: `navalNearPort`'s
other readers, the sea's traffic (`navalDirector.js factionWeights`, SEA-EASE's port weights) and its waters
(CAPT-WATERS `watersOf`'s coastal) - who sails near a port, not whether she lies in one - and the quays' own port
(`world.js navalHarbourNear`: the harbour it sounds stays in the book wherever she sails). The first berth of a log
still only marks where she lies, unsaid (the office's law). `test/systems/naval/fb1020c_berthring.test.js` (the voyage on the
real naval host and office; the twelve on ARENA2), `tools/mutants/fb1020c_berthring.json`.

THE SITES (`navalHost.js siteStep`, SITE_CHECK_S apart, aboard): a held bounty's quarry is stood when the captain sails
within SITE_REACH_PX map pixels of her waters - at the world's open water in her pixel (`world.js navalSitePoint`), else
SITE_AHEAD_M off the captain toward it (on her seed's bearing where the world names no point) - her class, her seed
(her name the board's), bold and flying no false colours; stood again if the sea lets her go out of sight before she
is ended; gone down by another hand - no blow of the captain's charged her end - never again: her bounty is void, said,
no regard lost (`quarryGone` - AUDIT CAPTAIN'S SEA B4: she came back whole and her casks floated anew each time). A held
salvage's casks float there (SITE_CASK_LIFE each, its own lot - `SITE_LOT`), again if they sank unhauled, each on open
water (D2). A boat of mine lying to a port's quay at her helm is the berth a delivery asks after. A site lies past the
map's edge only where the land beyond the Bay stands (B10: with it off nothing streams there), and never on a lake
inland: the office's sea is the open sea (`world.js:"seaAt: openSea,"` - the map's water that reaches its border, the
continent's past it; INLAND-PORTS, `01-Overview/bugs/Field-Bugs-2026-10-14-inland-ports.md`, Mac: "Fix harbour seaAt too").

THE LETTERS: a crown's LETTER OF MARQUE (CAPT-MARQUE above) for MARQUE_PRICE, MARQUE_DAYS of the captain's clock, to its
Privateers, one crown's at a time (`marqueOffer`); THE ADMIRALTY'S CARRACK - the one Carrack the Bay sells, Come Sail
Away's shelves never carrying one - at ADMIRALTY_OFF off her price, to its Commodores (`admiraltyOffer`), her title to
the Fleet's book at that port (`systems/fleet.js titleDeed`, a `mintDeed` of hull 4).

A RANK'S FAVOURS AT SEA (`harbourOffice.js perksHere` - the waters' crown's, none while its notoriety against the captain
stands at PERKS_REFUSED_AT): the shipwright's repairs and powder less the rank's `yard` (`navalYard.js yardOffer`'s
`discount`, never past YARD_DISCOUNT_MAX - the window's bill and its press in whole gold a row, B15); hands signed on in
the crown's harbour come SEASONED_HIRE's service (`world.js seasonedHires`, `perksAt` the port's crown - C4); and an
Admiral's crown always sends its relief (`navalDirector.js reliefSpawn`'s `reliefSure` - the stream's draw taken either
way).

## CAPT-TRADE - the exchange

The shipwright's window's EXCHANGE tab (`harbourOffice.js exchange`): `tradeGoods.js GOODS` - eight of the Bay (wine,
grain, wool, iron, spices, silk, silver, ivory) and the Eltheric Ocean's three (ether-amber, starglass, voidsilk). Each
crown's ports MAKE some and WANT others (`CROWN_TRADE`), every port twisting its crown's trade by one good of its own
off its key (`portTrade`); the Eltheric Ocean's goods are wanted in every port of the Bay and made only on its isles, and
(ISLE-TRADE, 2026-10-17, `03-World/Naval-Refit.md`) each isle makes one good of the Bay of its own (`isleGood`). A
good's price is its base times MADE_K where made, WANT_K where wanted (EXOTIC_K for the other sea's), drifting within
PRICE_DRIFT a day - the same for every client on the world's day (`priceOf`); the exchange sells SPREAD over it and buys SPREAD
under it, and deals only so much of a good a day (`DAY_STOCK`: plenty of what it makes, little of what it wants - and it is
glutted soon with what it makes itself). The captain's dealing at every exchange dealt with that day is kept
(`captainLedger.js dealtAt`, `deal` - DEALT_PORTS_MAX; AUDIT CAPTAIN'S SEA B1: the last one's alone was kept, and one
deal at the next port over filled the first's stock again the same day). Bought goods go into the hold of the boat at
the quay (Come Sail Away's cargo: their weight is on her way) - never past her room: the exchange reads Come Sail Away's
own reckoning (`cargoRoom`: she slows past her threshold and lies dead in the water at twice it), says the kg she still
carries before she would, and caps a purchase there (B11); sold, out of it; a sale's gold in the log. The other sea's
goods a port never sells read "not sold here", and are listed where the captain may sail for them or carries some
(`etherGoods` - B16); an isle's own good of the Bay is no other sea's good there - it is sold, and listed on either skin
(ISLE-TRADE).

The goods are ITEMS of the port's own (DECLARED): custom templates from GOODS_TEMPLATE (1331), stackable, the row's
weight and base - and no shop buys them: the exchange alone deals in them (`shopStock.js shopBuysItem` - AUDIT
CAPTAIN'S SEA B2: a General Store paid more for a tusk than the quay that makes it asked, a money loop with no voyage);
`systems/item/itemLaw.js` imports the module, as the
carpenter's stores' - and the chart's - so the account service's Worker bundles them and what they read (the board,
the ships' table, the hash), and its deploy's path filter names each (`.github/workflows/account-deploy.yml`, ACC4's
walk). A port's key hashes on the wire's FNV-1a (net/wire.js `hashKey`, the board's re-export - one home).

SEA-TRADE (2026-10-18, Mac: "Ensure the sea trade routes plug into this system also"; `06-Systems/Town-Economy-Arc.md`
section 8): online, the exchange is its port TOWN'S - `exchangeOf`'s `town`, the town economy's asking factor on what it
sells and its paying factor (never above the ask) on what it pays, so a Booming port's goods are cheaper and a Destitute
one's dearer and the spread only widens; the tab says the port's band. A good bought carries what it cost and the
counter's mark (LAW-3; no patron takes it). Each dealing is told to the town economy and, vouched by the Watch tick that
stood the captain at the port, counts in its players' share; a port town's packet lanes lift its Prosperity. Offline,
and on an isle past the Veil, the exchange is as above.

## CREW-TRADE - crew at the exchange (2026-10-23)

The owner, 2026-10-23: "If you could, please add crew as a resource that can be sold and traded." Asked how, the owner
chose the exchange alone ("Exchange good only": crew bought and sold at the port exchange straight into and out of the
ship at the quay, priced per port like the other goods - no trade between players), a headcount ("Headcount only": a
named hand's record never travels with him) and a port's own price ("Port price, varies").

CREW is a row of the exchange that is no item (`tradeGoods.js CREW` - a man, CREW_BASE 15 gold: half the shipwright's
REPAIR_PRICE.crew, pinned equal, since the item law's graph, which the account service reads, does not carry the sea's).
A port has SAILORS TO SPARE, is SHORT OF THEM, or neither - a third of the Bay's ports each by the draw (31, 41 and 34 of
the board's 106 - AUDIT CREW-TRADE P12), off its key on its own scrambled draw (`crewStandOf`, isleGood's way) - and every
isle of the Veil is short of them. A man is priced as a good (`priceOf`: MADE_K where men are to spare, WANT_K where they are short - a man of either
sea's own, never EXOTIC_K - drifting within PRICE_DRIFT a day), bought and sold at the exchange's SPREAD (the captain's
stars and, online, the port town's factors as a good's) and dealt at DAY_STOCK's day (`exchangeOf`'s `crew`: the row
first; without it every other row as it was). The Exchange tab lists it first for a crewed ship at the quay
(`harbourOffice.js exchange`): whether the port has sailors to spare, is short of them or neither, a man's two prices and
how many today, her crew aboard against her whole and, where none may leave her, why (AUDIT CREW-TRADE O1), and Buy 1,
Buy 10, Sell 1, Sell 10 (`navalYardWindow.js exchangeText` - R2: crew sells ten at a time as it buys; one Sell all took a
Small Ship from 13 men to 1), Buy greyed where the exchange signs nobody more on today or the purse cannot pay a man
(R3) - all of it, its notes and its refusals in the player's language, the gold a number in the language's own figures
(O2, O3: it came as English, "90 gold", inside every language's sentence). A Rowboat or a Large Boat carries no crew and
lists none; nor does a booked passage's boat (`passage.js charterRecord` - AUDIT CREW-TRADE E1: her crew are her
master's, a fresh full crew every booking, and three bookings sold 1,466 gold of them), and a press there says so.

WHAT A MAN FETCHES (`crewTrade.js crewPayMost`, `crewRowOf`): a gold under what the shipwright asks for one at most - his
own price for a hand (`navalYard.js yardOffer`'s crew row) at this captain's rank's discount (`harbourOffice.js
perksHere`, where the shipwright reads it) - or men hired at the yard would sell at the exchange for something, as often
as its day allows. The cap holds a short port's price at a high rank; everywhere else the port's own price stands. Where
sailors are to spare the exchange signs men on at well under the yard's price, so it is the cheaper way to fill her
there; where they are short, a captain carrying more men than she needs sells them dear.

SIGNED ON (`scenes/naval/crewDeal.js signOn`, `harbourOffice.js buyCrew`): as many as the exchange signs on today and the
purse pays for, her crew raised to her whole at most (`navalDamage.js muster` - no blow, no fire put out, a wreck a
wreck), her new hands named by her roster's own sync (`navalHost.js crewHands`: a Commodore's harbour's come Seasoned, as
every sign-on) and named in the note, as the shipwright's hire names them (AUDIT CREW-TRADE H3), no loss on her
spirits' books (`lastCrew`). SIGNED OFF (`signOff`, `sellCrew`): as many as may leave her (`crewTrade.js crewSpare`)
and the exchange takes today - never her last man (crewHall.js releasePlan's law), never a named hand of the player's
shore party nor so many that her deck stands no named hand aboard beside them (the party's own words, H2: at the helm
the party stands on her deck, its places kept for the shore), and none of a ship that came into the realm through
customs (`fleet.js fleetCrossed` - RESTORE's "Keep all, can't sell": her men are an offline save's; men may still sign
on to her). Her named hands past what her deck then stands are paid off the crew hall's way, the least worth losing
first (`crewTrade.js signOffOrder` - AUDIT CREW-TRADE H1: a plain Deckhand before a post's holder, her First Mate last of
all, the deck's own before a crew hall's recruit, the less service before the more, of the rest the last to join; the
roster's tail went first, and the tail is where a hall's recruit stands - one Sell 1 paid off a Veteran First Mate
signed on for 1,120 gold, his post and his lift, for one man's price and unsaid), each named in the note (a hall's
recruit takes the spirits he lifted with him - `shipCrew.js release`, AUDIT SHIPYARDS L2-4), and nobody is said fallen. Never in a fight. Each dealing is the ledger's day's (`captainLedger.js deal`, id
`crew`), a sale's gold the log's `traded`, and online each is told to the town economy, as a good's is.

Not a DFU member - Daggerfall has no ships, and Come Sail Away's crew is a count its shipwright refills. A man is never
an item: never in a pack or a hold, never at a shop, a stall, the market or a trade between players. A prize's pressed
men (navalPlunder.js `press`) are hers like any others, and sell like any others: men won in a fight are worth their
port's price - though the press makes good PRESS_SHARE of HER losses, not the prize's men, so a crew sold down before a
fight is pressed back whatever the prize had aboard (AUDIT CREW-TRADE E2, put to the owner: about 300-400 gold a prize;
the press's law is the naval arc's, unchanged here). WIRING (HOST-SPLIT): the naval host hands her state, its roster's sync and its crew companions to
`crewDealOf` as the yard's model's `crewDeal` (one entry in createNavalHost's yardModel); the world hands the Exchange
tab that model itself (`world.js navalOpenYard`), four logical lines out of bootWorld where it had built a second object
of three of the model's fields. THE FOUR HOSTS: the sea is `scenes/world.js`'s; `scenes/exterior.js` (the bench),
`scenes/worldModes.js` (a building) and `scenes/dungeonContext.js` (a dungeon) stand no exchange - FLAGGED, nothing wired.

## CAPT-CHARTS - treasure charts

A pirate the captain ends - sunk or taken - carries a TREASURE CHART among her papers CHART_CHANCE of the time (more in
the deep waters, a flagship's oftener), by her seed (`treasureCharts.js chartAboard`): given to the boat in play and
said ("Among her captain's papers: a treasure chart!"). The chart is an item of the port's own (CHART_TEMPLATE,
Daggerfall's parchment picture, its seed its `message`). USED (`world.js`'s use handler), it is READ: its cache is a
port of the Bay off its seed and open water CHART_PX off it (`chartSite` - the port drawn again on the chart's stream,
CHART_PORT_TRIES, while the one drawn has no open water: AUDIT CAPTAIN'S SEA B6, one chart in five was a dud for good),
marked on the captain's charts (CHARTS_MAX, never one twice) and the chart spent; a cache raised is remembered
(CHARTS_RAISED_KEEP) and its chart, read again, marks nothing (B8). Sailed to, the cache's chest floats up beside the
ship (the sites' `cache`); hauled aboard (`navalHost.js pickCache`) it pays CACHE_LOTS of a strongbox's lots and
CACHE_GOLD - and the log's `maps`; a pack that cannot carry them is overladen, said, never let go (B9 - a chart fished
out of a wreck the same). The Captain page lists the charts marked.

## Tests and mutants

`test/systems/naval/captcrew.test.js` (`tools/mutants/captcrew.json`), `test/systems/naval/captlog.test.js` (`tools/mutants/captlog.json`),
`test/systems/naval/captwaters.test.js` (`tools/mutants/captwaters.json`), `test/systems/naval/spyglass.test.js` (`tools/mutants/spyglass.json`),
`test/systems/naval/captboard.test.js` (`tools/mutants/captboard.json`), `test/systems/naval/capttrade.test.js` (`tools/mutants/capttrade.json`) -
every mutant dead; AUDIT CAPTAIN'S SEA's own in `test/systems/naval/auditcaptsea.test.js` (68 tests;
`tools/mutants/auditcaptsea.json`, 331 records; `01-Overview/audits/Audit-Captains-Sea.md`, which names the 47 suites its fixes
moved and those main's merges moved). The suites whose pins moved with the slices say so where they moved (PIN MOVED):
the crew card's line, the Holdings tabs, the tags and the hails now knowing a ship first (`test/navalSea.mjs knowAll`),
the action tables, the lens, the sky's and the far ring's lens narrowed with the world's (`test/player/climb4.test.js`,
`test/systems/hudlarge.test.js` E5), the wheel's rung for the glass (`test/scenes/audit24_wave37.test.js`). The harbour office's day is
a reader of the event clock, named in `test/fixtures/time1_census.json`.

CREW-TRADE: `test/systems/naval/crewtrade.test.js` (10 tests; `tools/mutants/crewtrade.json`, 41 records, all dead). Its pins
moved say so (PIN MOVED): the Exchange tab handed the yard's model itself (`test/systems/naval/capttrade.test.js` "the
exchange's tab", `test/systems/naval/auditcaptsea.test.js` B9/B11/B13); two records re-aimed by content (ACS-B11-world-room,
HOST-SPLIT-a-ceiling-under-its-host - bootWorld's ceiling down by the four logical lines it took out).

AUDIT CREW-TRADE (2026-10-24, `01-Overview/audits/Audit-Crew-Trade.md`): five cold lanes on a frozen snapshot; every
finding fixed and pinned in `test/systems/naval/auditcrewtrade.test.js` (10 tests; `tools/mutants/auditcrewtrade.json`,
43 records, all dead), the quay rig shared in `test/systems/naval/crewQuay.mjs`; the pins they moved say so (PIN MOVED),
and the recorded list re-aimed by content (still 41, all dead).

GLASS-SPOT and GLASS-CLEAR: `test/systems/naval/glassclear.test.js` (9 tests; `tools/mutants/glassclear.json`, 41 records, all
dead). Their pins moved say so (PIN MOVED): the look's card on an unknown hull (`test/systems/naval/spyglass.test.js` "at sea, the
eye", `test/systems/naval/auditcaptsea.test.js` S24), the frame's lens and the glass's hold now taking the focus (`test/systems/naval/spyglass.test.js`
"the world", `test/scenes/dwf_audit.test.js` E5-1/E5-4), `lowerGlass` putting it back (`test/systems/naval/auditcaptsea.test.js` S1/S15), and the players' names' sight test
(`test/net/name1_bubbles.test.js`); three records re-aimed by content (NAV1H-the-card-by-the-look-alone,
SPY-W-lens-unnarrowed, NAME1-host-sight-test-dropped) and four recorded `equivalent` (above).
