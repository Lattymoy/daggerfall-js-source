# AUDIT KETCH - the Sky-Ketch Mzunthar read cold, 2026-10-24

The owner: *"Its time to be a deep audit on this and ensure absolute perfection"*, of the branch's whole slice - the
Pistolet's sprite, the guns' lore, Pellets off the shelves, the weekly Dwarven airship raid and its questline, the
gilded drops lowered and the guns only aboard her, eight to a crew (`11-Multiplayer/Sky-Ketch.md`; Port-Ledger A,
KETCH). Five cold lanes read a frozen snapshot (`cd888989e`, the slice `501aaacee..cd888989e`, 16 commits) and were
given the owner's asks and the files, never the record's conclusions:

| Lane | Read | Found |
|---|---|---|
| L1 | the relay, the voyage's law, anti-cheat (the real Room over `test/fakeRoom.mjs`) | 13 - 2 BLOCKER, 5 MAJOR, 6 MINOR |
| L2 | rewards, the account service, items, drop rates | 10 - 1 BLOCKER, 3 MAJOR, 6 MINOR |
| L3 | the page: the client, the hosts, the made level | 16 - 1 BLOCKER, 3 MAJOR, 12 MINOR |
| L4 | the ship in the world: geometry, colliders, platforming, the sky (the real ship on a real Collider and PlayerMotor) | 16 - 6 MAJOR, 10 MINOR |
| L5 | the record, the lore, the words, the 25 languages, the process | 12 - 1 BLOCKER, 2 MAJOR, 9 MINOR |

67 reported, five the same defect seen from two lanes (L3-1 = L1-2, L3-4 = L1-6, L3-12 = L2-3, L4-15 = L3-15, L5-6 =
L2-6): 62 defects. Every one was re-run on its lane's probe against the head before it was fixed, and each fix is pinned
by a test that fails on the code as it stood, with a mutant in `tools/mutants/ketch_*.json` that the pin kills. Each fix
in code carries an `AUDIT KETCH L<lane>-<n>` comment (L5-10 and L5-12 moved a test's reasons and two languages' rows,
which carry none). Two were found in the fixing and are below with their lanes (L4-6's
drawn line, L5-9's untested fight). One finding is left, with its reason (L2-10).

## Fixed - the relay (L1)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L1-1 | BLOCKER | **The Engine locked six minutes in.** Construct ids ran up from 100 and met the Warden's forks at 200-215: a spider numbered 200 was routed to the Warden's fight and took no blow, and every spider after it. | `KT_BODY_ID0` 1000, above every fork. | `ketch_brain.test.js` (a ten-minute engine run strikes every spider) |
| L1-2 | BLOCKER | **An earner off the ship at the fall lost its receipt** - handed only to sockets aboard, and the hub kept none (every other event's receipts are kept at the hub). | The Hour's law: the ship tells the hub each earner's receipt at the fall (`_ktTellHub`, retried), the hub keeps it for its life (`ktrc:`, `KT_INTERNAL_RC`), hands it at once and at every hello, forgets it on the page's `spent`, sweeps it expired. | `ketch_relay`, `ketch_online`, `ketch_brain`; `auditwbx2`, `scale2b` (the hub's routes, pins moved) |
| L1-3 | MAJOR | **The Keel-Song never counted** - the relay judges before it steps, and the step cleared the forks at the song's landing. | The step marks the song's blow sung when it lands unbroken (`sg`); the judge counts it. | `ketch_warden.test.js` |
| L1-4 | MAJOR | **Staff past a full ship broke every page's state frame** - a ninth crew the wire refuses. | Staff are never the ninth: a full ship is watched by a hidden spectator. | `ketch_law.test.js` |
| L1-5 | MAJOR | **A quitter kept its place for the voyage.** | A full ship frees the place of a member gone from the captain's party and from the ship `KT_PLACE_KEEP_MS` with no part in the Warden's fight (`idlePlaces`, `_ktFreePlace`) - never the captain's, never on a hub that does not answer. | `ketch_brain`, `ketch_relay` |
| L1-6 | MAJOR | **A lead change sent a rider to an empty ship.** | The page keeps the ship its state frame named for the voyage (`ketchShipChoice`, `KT_SHIP_KEY`), forgotten when that door says it is not of the crew. | `ketch_client.test.js` |
| L1-7 | MAJOR | **The relay believed any pose** - a modified page banked a cell a moment after its pick, or unbarred the bridge from the hold. | The step law: a cell is set no sooner than its carry takes at the fastest run's carry pace (`ktLeastMs`, `KT_CARRY_PACE`); the bridge unbars no sooner than the mast-lift's rise and the Sailwalk's least crossing (`KT_SAILWALK_LEAST_MS`, `KT_CROSS_LEAST_MS`). | `ketch_brain.test.js`, `ketchSim.mjs` |
| L1-8 | MINOR | A fork's damage never counted as dealt. | `applyForkHit` adds it. | `ketch_warden` |
| L1-9 | MINOR | A stage change was saved at the next checkpoint. | Saved at once. | `ketch_relay` |
| L1-10 | MINOR | A refused word forced a whole-voyage write, up to 16 a second. | A word the brain refuses writes nothing. | `ketch_relay` |
| L1-11 | MINOR | Her record never deleted; the beat never rested. | Deleted at her end; the beat rests once the fall is said or nobody is aboard. | `ketch_relay` |
| L1-12 | MINOR | A receipt's body measure mixed the voyage's record with the fight's. | Read from the fight's own figures (`fightBodyOf`). | `ketch_brain` |
| L1-13 | MINOR | A song on an empty bridge raised forks at 0 hp - unbreakable, a heal. | Forks at the fight's fighters' measure. | `ketch_warden` |

## Fixed - the rewards (L2)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L2-1 | BLOCKER | **One share paid again on every other browser and device** (and on the same one once 32 other spoils passed through the shared pool): the service answered a repeat claim `share: true` from any device. | The device mints a claim id per receipt (`cid`, migration 0166); the service pays a `claimed` share only to the claim id that wrote the row. | `test/server/ketch_claim.test.js` |
| L2-2 | MAJOR | **A share waiting in the chest lived in memory alone** - a crash or reload lost it. | A paid share is written to the device at once (`scenes/ketch/ketchShares.js`) until the pool holds it; recovered at the next stand-up. | `ketch_shares.test.js` |
| L2-3 | MAJOR | **The Ketch's spoils ran through the Hour's pool** - its keys, its words ("the spoils of the Last Moment"), its spent marks; a test pinned the opposite. | Its own pool, keys, bound and gathered word (`KT_SPOILS_GATHERED`). | `ketch_spoils`, `sd9e_spoils`, `wb9f_gate_spoils` (pins moved) |
| L2-4 | MAJOR | **Cabin leftovers promised to the mailbox, then refused** (the service keeps no kill of a ship's). | No mailbox: leaving gathers them into the pack. | `ketch_spoils` |
| L2-5 | MINOR | Two shares paid in one flush: the first overwritten. | Two are two (`ketchShares.js`). | `ketch_shares` |
| L2-6 | MINOR | QLSK03's act said only on `recorded` - a retry answered `claimed` paid and never said it (= L5-6). | Said on the first answer that pays this device's own share, kept before it is said. | `ketch_claim` |
| L2-7 | MINOR | A guest told "not recorded to a name" just after it was recorded and paid. | The line is gone, in every language. | `ketch_claim` |
| L2-8 | MINOR | The Ketch receipt's version was the Watch's `k1`. | `y1`, pinned unlike every other relay-signed word. | `ketch_claim` |
| L2-9 | MINOR | The budget's fill ran after the claim's batch (the pattern AUDIT STARFALL B3 retired). | Inside the batch, held to its row. | `ketch_claim` |

## Fixed - the page (L3)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L3-1 | BLOCKER | = L1-2, from the page: the fallen earner off the ship never heard its receipt. | The page hears it from the hub and says its share spent (`sendKetchSpent`). | as L1-2 |
| L3-2 | MAJOR | **A refused ride up the lift counted down forever.** | Asked once; a refusal leaves the body to step out and in again (`needOut`). | `ketch_sky.test.js` |
| L3-3 | MAJOR | **Every "sets a cell in the engine (k of n)" was one behind.** | Counted as the cell it is. | `ketch_link.test.js` |
| L3-4 | MAJOR | = L1-6. | | as L1-6 |
| L3-5 | MINOR | A press reached further than the relay takes, and the relay said nothing. | Sent only from where the room takes it; further, the page says it is too far. | `ketch_client` |
| L3-6 | MINOR | "You let go of the aether cell" said when the word never left. | Said only when it left. | `ketch_client` |
| L3-7 | MINOR | The bosun's line set its rider down facing the bow. | Facing the bridge (`KT_LINE_LAND.yaw`). | `ketch_deck` |
| L3-8 | MINOR | "Crew aboard: n of 8" counted every account ever taken in. | "Crew: n of 8" - the places taken. | `ketch_hud` |
| L3-9 | MINOR | Two contradicting "turns west" clocks while she weighs anchor. | One; the Warden's bar counts to whichever end comes first. | `ketch_hud` |
| L3-10 | MINOR | The held map's card kept the countdown it opened with. | Its key carries the tip's when-line. | `ketch_hud` |
| L3-11 | MINOR | A `busy` door left the player on an empty ship, nothing said. | A ship never heard walks the player down with the door's word. | `ketch_client` |
| L3-12 | MINOR | = L2-3. | | as L2-3 |
| L3-13 | MINOR | No save asked once the ship's spoils went into the pack. | Asked. | `ketch_shares` |
| L3-14 | MINOR | A cell carried off its deck said "lets go"; the dead cage's hold gate stood open. | Said lost; the gate shut while the lift is dead (`ketchShaftGates`). | `ketch_model` |
| L3-15 | MINOR | One part's failed mesh made `pose()` throw every frame (= L4-15). | Posed, never drawn. | `ketch_deck_host` |
| L3-16 | MINOR | The ship's hot paths allocated about 60 KB a frame. | Written in place - about 6 KB. | `ketch_deck_host` |

## Fixed - the ship in the world (L4)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L4-1 | MAJOR | **The bridge's outer rail ran the whole way round** - a wall across the gangway's foot and the cabin's door. | Open over both (`KT_RAIL_GAPS`, `railRuns`); stopped at the rail everywhere else. | `ketch_walk.test.js` (the real motor) |
| L4-2 | MAJOR | **Every net drew as a solid wall** - uploaded without its cutout. | `KT_CUTOUT_RECS`, uploaded `{ cutout: true }`. | `ketch_deck_host` |
| L4-3 | MAJOR | **DFU's classic climb went over the gallery's wall into the barred hold, and over the cabin's** - the ceilings were drawn only. | Solid, the hold's with its shaft open. | `ketch_walk` |
| L4-4 | MAJOR | **A running jump over the mast-lift's 1.1 m collar dropped 24 m down the shaft.** | Netted to the main top's `KT_HIGH_NET`, its gate the net's height. | `ketch_walk` (every build's jump, held at the top) |
| L4-5 | MAJOR | **The Rotten Rigging's breath streaks drew 7-15 m off the course** - the gust's warning missing. | Laid about the course's x. | `ketch_deck` |
| L4-6 | MAJOR | **The bosun's line set its rider in the gust, facing the open edge.** Found in the fixing: its path was moved to the landing and its chain was not - the rider left it 1.9 m short. | Set down at `KT_LINE_LAND`, past the band, facing the bridge; the chain drawn on the rider's own path (`bosunLineAt`). | `ketch_deck`, `ketch_model` |
| L4-7 | MINOR | Both stairs lit with the open sky partway down. | Inside the hull with the feet under the deck is below decks. | `ketch_deck_host` |
| L4-8 | MINOR | The record said the cage's roof could not be stood on; it can (59 degrees). | The record corrected: a body that lands on it stands, and rides it as the floor's riders do. | the record |
| L4-9 | MINOR | The parked cage's floor and the hold's coplanar - fighting. | The cage's floor `KT_CAGE_LIFT_M` over its zero. | `ketch_model` |
| L4-10 | MINOR | A Watch spot in the lift's tower, a bridge spawn in a cradle, the Warden's home in the helm's pedestal. | Every spot and spawn clear of its floor's obstacles by its body's breadth (`clearOf`; the pedestal, the cradles and the landing's guns in `KT_OBSTACLES`); `KT_WARDEN_HOME` before the helm. | `ketch_brain` |
| L4-11 | MINOR | The ten gun carriages had no collider, and stood across the outer hammer lanes. | Run in against the wall (`KT_GUN_DEPTH`), solid; the lanes clear. | `ketch_walk` |
| L4-12 | MINOR | Port and starboard swapped in the records (the engine is left-handed: facing the bow, -z, the right hand is -x). | +x port, -x starboard, in the code's records and the arc page. | the record |
| L4-13 | MINOR | The checkpoints' chains ended in the empty sky. | They hang from `KT_JACKSTAY`, a spar over the Sailwalk's line between the masts' vane-spars (the mizzen's reaching to the line). | `ketch_model` |
| L4-14 | MINOR | The gangway's sill lay square to the deck, in the air before its slanted head. | Along the head (`ketchGangwaySill`). | `ketch_model` |
| L4-15 | MINOR | = L3-15. | | as L3-15 |
| L4-16 | MINOR | The lab's collider view left every part out. | Each part's hit at its pose. | `ketch_deck_host` |

## Fixed - the record, the lore, the words (L5)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L5-1 | BLOCKER | **The Pistolet's prototype page no longer loaded, and the build failed on it** - a renamed crop. | The page imports the lab's names; the page pin reads its import list against the lab's exports. | `pistoledge.test.js` |
| L5-2 | MAJOR | **QLSK01's courier showed "Imrah counts gold into your hand" at the letter** and marked the step paid; QLSK02's table showed its pay box twice - a book given by `give pc`, which is a quest's pay (`qlLayer.js` reward). | The books by `get item` - QLSK01's as its letter is in the pack (`have _letter_ set _book_`, QLIW02's shape), QLSK02's at her table; `give pc _gold_` the only pay. | `ketch_lines.test.js` (on the real bridge) |
| L5-3 | MAJOR | **"Every Loredas" was false on the game's own calendar** - she keeps the real Saturday; the online calendar runs twelve game days a real day (voyage 0 lands on Middas). | No quest, book or screen names a day of Tamriel's week. The screens say Saturday at 00:00 UTC, in all 25 languages; the book says she keeps a week of her own, twelve of ours long. | `ketch_lines`, `gunlore` (pin moved) |
| L5-4 | MINOR | QLSK02's three cells a hand: a crew of eight could not all meet it (a voyage banks seven in the engine and four at the resonators). | One cell, in the engine or a resonator; the words say both. | `ketch_lines` |
| L5-5 | MINOR | "A fall from her decks wakes you in the fields below" - a fall is cast back; and the nets' line said "the last top" for every fall. | The nets haul you back aboard; only death wakes you below. | `ketch_lines` |
| L5-6 | MINOR | = L2-6. | | as L2-6 |
| L5-7 | MINOR | **The lore promised what the game does not do**: the Word's constructs lowering their arms (and the book's "I believe all of that"); the lodestone at the helm, which the ship did not have; the charm that hums when she is near (a plain amulet); the hammer "of Dwemer brass" (its metal the roll's). | The lodestone made true: blue and brass on the console behind the helm, turning on its own (`KT_LODESTONE`, the deck host turns it). The Word gave her master's last order; the charm hummed once in Imrah's hand; the hammer is a war hammer. | `ketch_lines`, `ketch_model`, `ketch_deck_host` |
| L5-8 | MINOR | **The lore contradicted itself**: the Sovereign's pistolet era "nor wet its powder" (a Dwemer gun holds none); the Echo "for the Ketch's master" (the book and its drop make it the Warden's); "She closed the Burning Doors" (the player did); "for three thousand years nothing big enough" (the Brass God walked five hundred years before). | "Nor stilled its coil"; gilded for the steersman bound to her helm; Ysolde wrote the book on the Doors; the Brass God pulled her once before and was broken before she could follow. | `ketch_lines` |
| L5-9 | MINOR | **The arc page's numbers and pins**: the turn west "nine tenths" (0.99); the engine "one for each two aboard" (four for one); "each fixed and pinned", the night's ambient pinned by the live run alone. Found in the fixing: `scenes/ketch/ketchFight.js` had no test and no mutant. | The page's numbers made the code's; her night held to DFU's exterior floor by a test; the fight pinned - a blow once on its storey, a hammer once a slam, the Wave jumped, a late landing never judged, the whole bridge's on the bridge alone, the broken song skipped. | `ketch_deck_host`, `ketch_fight.test.js` |
| L5-10 | MINOR | Two L10N ratchet reasons misstated what their counts are. | Each says its strings. | `l10n4_hardcoded` |
| L5-11 | MINOR | The patch notes' draft overclaimed (every line translated, the fall, the line's question, "1 in 100 at either", the account gate, Loredas). | Rewritten; they ride the pull request's description, never a committed file (CLAUDE.md). | the pull request |
| L5-12 | MINOR | Chinese called the crew's leader and the Ketchmaster both 船长 / 船長; German counted voyages in two phrases. | 领队 / 領隊 for the leader; "Gesegelte Fahrten" on both. | `ketch_lines` |

## Left, recorded

- **L2-10** - offline with the Loot rarity ladder off, no Pellet is found. Left: the ladder off is DFU's own loot, and the
  port adds no find of any kind there (`gem1_sockets` "off nothing", `loot21` "off: nothing"); DFU has no gun, and offline
  the Test Room is a gun's only door and gives 30 Pellets with it.
- **L1-7, the ranged blows** keep the gate's law: a storey check and no range or line of sight, as every made level's.
- **L1-2, boarding while she weighs anchor** was not opened: the receipts are kept at the hub instead, so nobody needs
  to board to be paid.
- **L4-3, the decks aft of the quarter wall** stay non-solid overhead: the quarter wall holds, and no climb reaches them.
- **L4-4, a fast build holding jump** under the net meets the 7 m post at its corner - no fall, no defect.
- **L5-7, the charm and the hammer** were reworded, not made true: the sheet's named piece is a base the roll makes at
  the player's level (`qlRewards.js` baseOf), and a charm that hums would be a new mechanic nobody asked for.

## The mutants

`tools/mutants/ketch_*.json`: eighteen lists, 297 records - 295 dead and two recorded equivalent
(`KTB-the-cells-said-every-beat`: every caller says the cells only after it moved them; `KTF-the-late-landing-judged`:
the verdict refuses a stale blow the frame's window would have).

## Where the record moved

`11-Multiplayer/Sky-Ketch.md` (sections 2, 3, 6, 7, 10, 13 and 15), `06-Systems/Gilded.md` (the Ketch's two's lore),
`01-Overview/Port-Ledger.md` (KETCH), `01-Overview/Active-Arcs.md` and `01-Overview/Audit-Log.md`.
