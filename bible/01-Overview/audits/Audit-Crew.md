# AUDIT CREW - the named crew, the repairs at sea and the companions ashore, 2026-10-01

Mac: *"Audit everything"*, of the work of PR #487 (SHIP-CREW, SEA-REPAIR - merged) and PR #493 (CREW-COMPANIONS - open)
(`03-World/Naval-Combat.md` SHIP-CREW and CREW-COMPANIONS). Six lenses read it on the arc's own harnesses: the
companion layer's runtime through doors, sweeps and loads; combat, the AI and every road by which a companion can die;
online; the crew's logic and economy; the UI and the wiring against the patch notes; and the tests' own honesty, with
67 fresh mutants thrown at the new code (63 survived - each an untested behaviour, now pinned or removed).

Four calls were Mac's (2026-10-01): carpenter's stores **"Priced per hull, no port use"**; companions online **"Full
co-op combat now"**; grog **"Once per port day"**; and at the helm **"Back on deck while sailing"**.

Every finding was re-run before it was fixed and is pinned by a test that fails on the code as it stood:
`test/systems/naval/auditcrew.test.js` (CC-A layer, CC-B combat, CC-D crew, CC-E co-op, CC-F the safety net), with the moved pins in
`crewcompanions`, `shipcrew`, `deckwalk`, `wod3_spawner`, `world2`, `world6bii`, `auditworld6bii`, `renown1`,
`respawn1`, `questparty3c` and `audit24_lifetimes` each carrying a `PIN MOVED` note. Mutation-proven:
`tools/mutants/auditcrew.json` (87 mutants, all dead), and every older record the fixes moved re-aimed and killed again. Each
fix carries an `AUDIT CC-` comment. The relay law holds: nothing under `server/src` or `src/net` changed - the co-op
words ride fields the wire already passes through.

## The companion layer (`scenes/crewAshore.js`, `world.js companionPlace`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | Blocker | **A fast travel, a Recall, a passage or a respawn on the street lost the party.** The street's `clearLive` empties its list and marks nobody dead, and its key never changed: both bodies orphaned, never stood again. | Each place answers `has(body)`; a body no longer in its place's list stands again behind the player. |
| A2 | Minor | **A door healed a companion** - his health carried as a number, each place rolling his class's pool afresh. | Carried as a share of the whole. |
| A3 | Minor | **The catch-up chased a leader in the air**, stood bodies at his height to fall, billed falls from the ledge left, and threw the swept spot's height away. | Height counts only while the leader stands on a floor; the body resumes as a puppet handed back (`resumeLive`); the sweep's own height. |
| A4 | - | A turned team (any blow's reset) left a companion a stranger for good. | The layer puts him back on the player's side every frame. |
| A5 | Major | **The last hand home never stood on her deck again; one home of two walked it unseen.** | My boats always pass a set (empty, never null); a hand home stands with his sprite. |
| A6 | Major | **The bars froze over a dungeon window** (the overlay's early return). | Drawn (covered) there too. |
| A7 | Minor | Two companions took two of the street's eight encounter slots. | Not counted. |
| A8 | Major | **A dungeon quickload could write another foe's record onto a companion** (the save patches by number). | A quickload lifts the party first. |
| A9-A10 | Nit | A boat with no deed number listed a dead Companions row; the layer knocked, stood and caught up under a pause; a peer's companions had no bar indoors. | No row; held by a pause; the place's own list. |

## Combat and the AI (`enemyMotor.js`, `enhancedMotor.js`, `enemyTargets.js`, both pools)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | Blocker | **A player's arrow past a companion underground turned him for good** - and the two then fought each other. The attack door that reverts an ally ran though the blow did not. | Both pools' attack door passes a companion by; the dungeon's shaft flies past him. |
| B2 | - | A companion's side read from his team (which a blow can reset). | Keyed on what he is: never the player, never an ally. |
| B3 | Major | **A struck companion froze at the leash** - its attacker, his secondary target, pinned back each tick. | Past the leash he is *returning*: every target dropped, the secondary too, until he is home. |
| B4 | Major | **He ran out at a foe standing off (an archer at 30 m), or stood idle 15 m out holding one never seen.** | No foe beyond the leader's leash; a target he cannot pursue leaves him following. |
| B5 | Minor | The route to one goal walked toward the other a moment. | Dropped as he turns from one to the other. |
| B6 | Minor | **A thrown torch indoors or underground turned and burned him; the watch left a monster fighting him.** | Passes him by; his fight is the town's. |
| B7 | Minor | Companions and a quest's foes ignored each other. | They fight. |

Checked and holding: every death road (falls, rounds, drains, Disintegrate, traps) reaches the knock-out arm; every
removal (the cull past the catch-up, clears, dispels) stands him again.

## The crew and the repairs (`shipCrew.js`, `navalYard.js`, `navalHost.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | Major | **Ten stores (250 gold) made a wrecked Small Ship whole that the yard asks ~6000 for - in the harbour beside it.** | A store is `STORE_POINTS` of work at `STORE_YARD_SHARE` (70%) of the yard's price; the yard stocks a hold to what her wreck takes; repairs at sea refuse in port. |
| D2 | Minor | A crewed boat with every hand lost held a repair order that did nothing. | Her captain at the work alone. |
| D3 | Minor | The standing order was lost on a load. | Saved (and the grog's day). |
| D4 | Minor | A boarding's dead spent the next fight's loss cap; a NaN loss loaded as no spirits; a long step's decay drained a point a frame. | Losses lapse `LOSSES_WINDOW_S` after the last; a NaN refused; a long step spent at once. |
| D5 | Minor | Grog spammed spirits to the top; an item put back in a prize's hold and taken again was +3 a time. | One round a port day; a prize's hold cheered once. |
| D6 | Minor | The deck's sprites came off a seed that moves with the session - "Hilda, Bard" over a male Warrior. | Each place the class and sex of the hand named there. |
| D7 | Minor | A knock after a load was lost (the boat not yet stood). | It lands on her saved crew. |
| D8 | Nit | The hint ignored a standing repair order; the card listed hands ashore as aboard; a First Mate ashore still answered from the deck. | Said; marked; the next hand answers. |

## Co-op (Mac: "Full co-op combat now")

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E1 | Major | **Companions fought only bodies their own client simulates**: a joiner's swung at the room's foes for nothing and took nothing; on the street they ignored a partner's foes; indoors their blows vanished. | A companion's blow on another client's foe goes to its owner as an ally's (`al`, `ac`: the foe turns on him); a foe's blow on another's companion goes to the companion's owner (`fb`, `sf`). The frames name each owner's companions (`cp`); the other clients' bodies join the hunt. |
| E2 | Major | **The host's companions underground were invisible** - the room saw its foes fight the air. | A companion rides the room's own lane, stood by everyone as an ally. |
| E3 | Minor | A lifted companion stood on others' screens to the next full frame. | The next frame is whole. |
| E4 | Minor | A ship another stands that struck to my guns never cheered my crew. | It does. |

Not done, said: a puppet's record names no companion as its target (the wire's record law), so another's foe fighting
my companion shows its swing at him only on the owner's screen; my moored boat's word still sizes her deck whole while
hands walk ashore (only a boat in play speaks, and then they are aboard). The crew's orders are reached at the helm by
the Plus panel's button or the boat's menu - not by a pad gesture.

## The safety net (CC-F)

The new code's untested behaviour, found by mutation: the host's companion API (press, send back, prune, the away set,
the knock's words), the follow brain's guards (paralysis, a pause, a knock-back, no leader, the detour), the grog's and
the provisions' numbers (which were pinned against themselves), the party's small print (hours, a save's role and sex),
the layer's (the place's sweep, the clamp, a late stand, the clear), the crew's (lines, the card, the clamps, the
clocks, an order not theirs), the deck's away (talk ended, a taken hand), and the world's wiring. All pinned; the one
dead export (`isCompanion`) removed; a pin made optional (`shipcrew`'s dispatch) made exact again.
