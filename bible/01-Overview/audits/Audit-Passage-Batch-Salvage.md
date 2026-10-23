# AUDIT PASSAGE + BATCH-SALVAGE - passage under sail, the pack's batch salvage, 2026-10-19

Mac: *"Audit this"*, of PASSAGE (`03-World/Passage.md`) and BATCH-SALVAGE (`06-Systems/Loot-Arc.md`) at `b554daef8`
(the change from `391473073`). Four cold lanes read a frozen copy of it: A, the passage's law and its host half (the
real planner, the real `createPassageHost`); B, the passage across the game - the cabins, the Fleet, boarding, the
quay's other presses, online (the real Come Sail Away runtime, the real naval host and pool, two rooms); C, the batch
salvage (a fake pack driven by its own presses, and mutants over it); D, the record and the pins (every bible gate,
the recorded mutants re-run and eleven of its own written against what the docs claim).

Every finding was re-run before it was fixed, and each fix is pinned by a test that goes red on the audited code.
Mutation-proven: `tools/mutants/passage.json` (93: 91 dead, 2 recorded equivalent - 49 records new with the audit) and
`tools/mutants/batchsalvage.json` (25, all dead - 12 new).

## Lane A - the passage's law and its host

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | Bug | **A booked voyage was walked.** The planner prices a road step at 1 and a sea step at 1.2-1.5, and Basic Roads' path is the default: from her helm, the cheapest way to a port on a coast road was to come ashore at once and walk it. The fare was paid, her ship let go, and the passenger set down at the quay they paid to leave. | `travelViewRouteTo`'s `voyage`: the planner (`travelRoute.js` `sea.voyage`) brings her ashore only within VOYAGE_LANDFALL_PX (SEA-LANES' ROADSTEAD_PX) of the port, a plan with no sea step is refused ("Her master knows no way there by sea from here.") and everything is put back; her master lists no port that near. Pinned on the real planner (`passage.test.js`). |
| A2 | Bug | **The passage ended on her own deck.** "Off her" was 20 m from her root, and "aboard" read the deck only while grounded: a Small Ship's bow is 21.9 m from it, a Carrack's 26.1 m and her helm 19.5 m. One jump on the forecastle laid her up under the player at sea. | Off her past PASSAGE_LEAVE_M beyond her hull's own reach (`hullReach`), for PASSAGE_OFF_S (1.5 s) together; nothing is judged through a world's move. |
| A3 | Risk | **A fight spent her master's tries.** A try was counted before the journey's gate, and a foe near is that gate's refusal - a fight longer than a minute and he stood down for good, saying the refusal every 20 s. | The gate asked quietly first; a refusal spends no try. |
| A4 | Risk | **Her master's clock was the host's.** A quickload mid-voyage onto another booked boat found his tries spent and his words said: he never sailed on. | The clock is her boat's (`clockOf`); a new boat finds him fresh, the first try after PASSAGE_FIRST_S. |
| A5 | Risk | **Her hold came ashore before her lay-up could refuse.** With another player aboard, the lay-up waits - but the hold was already in the pack and the word never came. The stand-in runtime moved no hold, so the order's mutant passed. | Laid up first (Come Sail Away moves her hold under her number), then the hold into the pack and the word; the stand-in models the real hold and passengers. RECORDED: `addItem` takes no weight, so a full hold can overload the pack - the player's own goods, as before. |
| A6 | Nit | **A record that reads as nothing laid her up under the player** the moment they stepped from her helm. | A bad record sails nowhere and ends only when the player is off her. |
| A7 | Risk | **A refusal at the booking put back less than it took.** The helm dismounted a rider for good, and a route that threw after the journey began left it live, aimed at the removed boat. | The rider remounted, the journey cleared, the "no way" said - all of it or none of it. |

## Lane B - the passage across the game

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | Bug | **The DFU bank ship's cabin moved into her, and was lost.** With no other candidate, the booked boat was the one `bankCabinCandidates` found: the furnished cabin linked to her number and went with her when she sailed on. | `bankCabinCandidates` skips a booked boat (`passageaudit.test.js`, the real runtime). |
| B2 | Bug | **A boarding from her ended the passage.** A boarding puts the player on the enemy's deck 13-16 m off her: her boat was laid up mid-fight and the player left on the prize at sea. | Aboard counts the naval host's `boatInPlay`; nothing is judged through a world's move (A2). |
| B3 | Risk | **A crewed warship for 25 gold.** Three resumes and her master stood down; the passenger could steer her anywhere - fights, prizes, past the Veil - for good. | He never gives her up while a passenger stands aboard (PASSAGE_SLOW after PASSAGE_RESUMES fail); a journey begun to anywhere but her port is stopped ("Her master holds his course for Sentinel.") and he sails on. RECORDED: between his tries (at most 60 s) the passenger may still steer her by hand. |
| B4 | Risk | **What was put in her sailing cabin was lost.** The boat menu offered a cabin under her number; it was orphaned when she sailed on. | `hasSailingCabin` is false for a booked boat. |
| B5 | Risk | **Online, only the player who stands the port could book.** A peer's copy of a harbour ship carries no errand on the wire. | Moored is also a copy lying still at a known harbour's berth (`mooredAt`); she is taken over at the booking. Her letting go was no departure on the wire - the player who stood the port next stood her at her berth again the same day, bookable twice, and one who took the port while her copy faded took her over - first RECORDED, then fixed the same day at the owner's word ("So its not seen by other players?" - "Yes"): her seed rides the naval word (`q`, NAVAL_WIRE_GONE, said on by every reader); her copy fades out, and no player stands her, takes her over or keeps her (`passagesea.test.js`, two players' rooms; nine mutants). |
| B6 | Risk | **Activate was taken from the whole quay.** Any spot 18 m off her with the look within 60 degrees: the townsfolk's talk, doors, wagons and the gathering's nodes lost the press. | The look's ray must strike HER HULL within PASSAGE_RAY_M (8 m); my own ship's gangway stays the first press. RECORDED: a person on the ray between the player and her side, within the 8 m, still loses the press to her - the activation's ladder is pinned and was not reordered. |
| B7 | Nit | **A Carrack booked under the Classic handling never sailed** (OWS2 refuses her) while the hint kept offering her. | The naval host's `passageCrosses` (`tvSeaCrosses`): a hull this helm cannot cross a sea in is offered no passage. |
| B8 | - | Host rules: see D-M1. | - |

## Lane C - the batch salvage

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | Bug | **The thirteen whole languages had none of the 50 new rows**: l10n1b and l10n6b red, CI's `verify` with them, and both pages said the drafts were made. | Drafted in-session for all thirteen and merged (`tools/l10nInSession.mjs`; recorded as `claude-in-session`), the audit's five new rows with them. |
| C2 | Bug | **All junk swept in a junk-marked Legendary**, an Exalted one too (`junkable` takes any weapon, armour or jewellery), hidden past the question's six names. | `sweepSpares`: no sweep takes a Legendary; chosen by hand it breaks. |
| C3 | Risk | **While choosing, the other gestures still acted on a ticked piece**: the menu (right-click, long-press, pad Y) offered Wear and Drop, pad X wore it, a drag carried it, Stash all stood. | While choosing, the menu and pad X tick, no drag starts, Stash all is not offered. |
| C4 | Nit | **A row kept its tick after its piece stopped qualifying** (locked from the menu): the rows were drawn before the choice was pruned. | Pruned at the head of the render. |
| C5 | Risk | **The question was never driven by a test** (the fake document's listeners were a no-op): seven mutants survived - Y answering Keep, the kept count unsaid, no prune at the asking, no "and n more", no pair guard, a later refusal unpruned, `picked` kept. | The question driven by its keys (Y, N, Enter, Escape) on real listeners; a piece locked after the asking ("1 would not break and was kept"); a piece the world takes before the asking, uncounted; more than six names; Yes pressed with `detail: 2`. `picked` is never set while the pack chooses (a press ticks), so its clearing went. |
| C6 | Nit | **English words**: the question's Salvage and Keep buttons. | Through `t()`. RECORDED: `lockedText`, SALVAGE_GEMS, SALVAGE_CLASSIC and `shardsText`'s English plural are the single-piece salvage's words (LOOT9, LOCK1), before this change. |
| C7 | Nit | **Under the Plus face the sigil rune (z-index 2) covered the tick.** | `.salv-mark` z-index 3. RECORDED: traced from the CSS, not seen in a browser. |

## Lane D - the record and the pins

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D-H1 | Bug | The thirteen languages. | C1. |
| D-H2 | Bug | The voyage walked. | A1. |
| D-M1 | Risk | **The naval host grew** (HOST-SPLIT): `createNavalHost` 3,710 to 3,754 code lines - the ship at her berth, her word, her boat and her letting go in the host's own scope, inside the ceiling's room for a fix. | Moved to `scenes/naval/passageBerths.js` (`createPassageBerths`), the host keeping five lines of wiring: 3,715. |
| D-M2 | Bug | A sweep took a Legendary. | C2. |
| D-M3 | Risk | **Eleven claimed behaviours no test pinned** (each mutant survived): my gangway first, the helm word once, the fare deducted, a packet, a prize, the hull list at the berth, another player's ship taken over, no passage at a helm, a second booking at Yes, the six names, the press giving way to her own helm's ray; two titles claimed more ("at a helm", "a packet"); another player aboard holding the end. | A test and a record for each (`AUDIT-PASSAGE-D-*`, B5's, C5's), the titles made true. |
| D-L1 | Nit | Titles and records drifted: two mutants named with no record, two records named in no title, two records whose names said another mutant. | Every record named in its test's title, each name its mutant's. |
| D-L2 | Doc | "After PASSAGE_FIRST_S" held only for a host meeting her boat fresh, never after a booking. | Said so; the clock is her boat's (A4). |
| D-L3 | Risk | The hold word lost while she waits. | A5. |
| D-L4 | Doc | A departure not named: DFU's ship is free to a player who owns one (`hasShip`). | Named in Passage.md: a passage on another's ship is paid whatever ships the passenger owns. |
| D-L5 | Nit | English buttons. | C6. |

## Checked and sound

The fare against `calculateTripCost` and its floor; the ports' order and the port stood at; Yes re-checking the purse
(coins and letters) and paying through `deductGold`; a stale ship's "She has cast off."; the windows pausing the game
so nothing moves under the list; `StopSailing` before the lay-up, the lent ship handed back; interiors never measured
against her; the Fleet, the shipyard and the packing all keyed on records she has none of; fast travel and Recall from
her helm; her crew's companions and deck camps; the save's `Charter` round trip; her berth's pose. `salvageMany`'s
order and a doubled piece; the Exalted and gem-set exclusions; mount and unmount; Escape's order; the backdrop under a
press outside; virtual and remote rows. The bible's gates, the host ceilings, the cites, no patch-notes file.

## Not fixed

- **B6** a person on the ray within 8 m of her side loses the press to her.
- **B3** a passenger may steer her by hand between her master's tries. [FIXED by PASSAGE-HANDS, FIELD BUGS 2026-10-21d: her rudder, oars, sails, trim and lantern answer her master's hand alone, the panel a passenger's card - `01-Overview/bugs/Field-Bugs-2026-10-21d.md`.]
- **A5** a hold brought ashore takes no weight.
- **C6** the single-piece salvage's English refusals (LOOT9, LOCK1).
- **C7** the tick's layer under the Plus face, unseen in a browser.
