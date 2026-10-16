# AUDIT NAV2 - the sea's second pass, read end to end, 2026-09-30

Mac: *"Let's do a deep comprehensive audit on everything developed thus far"*, of the naval arc's second pass as PR
#467 carried it: SEA-PEACE, HELM-KEYS, DECK-FIELD, HELM-WAY, DECK-WALK and SHIPMATES, LIVING CREW (slice D), and the
three merges of main that carried them (`03-World/Naval-Combat.md`, `03-World/Come-Sail-Away.md`; Port-Ledger A).
Seven lenses read it against its own pages on the arc's own harnesses - the captains, the helm, the deck, friend and
foe, the living crew, online and the seams, the frame's cost - and the merges were checked hunk by hunk (every side's
normalized lines counted three ways: nothing lost).

Every finding below was re-run on its probe before it was fixed, and pinned by a test that fails on the code as the
second pass shipped it: `test/systems/naval/auditnav2_online.test.js` (8), `auditnav2_boarding` (7), `auditnav2_captains` (17, 19 as
the runner counts them), `auditnav2_helm` (9), `auditnav2_combat` (6), `auditnav2_deck` (12) and `auditnav2_crew` (26)
- 85 pins. Mutation-proven: `tools/mutants/auditnav2_*.json`, 213 records, all dead. Each fix carries an
`AUDIT NAV2 F<n>` comment. Six fixers worked in parallel on files of their own and were merged here; F43 and F62 were
found and fixed at those merges. The relay law holds: nothing in `server/src`, `src/net` or `src/world/mat4.js` moved,
and the naval word's two new keys are ones an older build's door passes and reads nothing of.

## Fixed

### Online and the seams

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F1 | High | **A captain's temper was her stander's alone.** Warm Ashes' raiders and a hand-launched pirate are made BOLD by the host, but a peer's copy and an heir re-read her seed's temper - WARY. The peer got no "Sail ho!", could rest and travel while she closed to board them, and an heir's copy sailed off. | The naval word's `k` key: each ship's captain - her temper, her mode, the ship she struck to (`navalWire.js`); a reader takes them (`navalHost.js applyWord`). |
| F2 | Low | **A peer's boat was sized at a full crew.** The stander sized another player's crewless boat as crewed while the peer sized herself single-handed (3,300 against 2,357 under the old product), so a wary pirate took on one screen what she left on the other. | The word's `m` key: the owner's boat - her crew, her battle, her hull. `peerPowerOf` sizes her as `myPowerOf` does, on F25's measure. |
| F3 | Medium | **A peer's copy of a ship in a fight had her crew at peace.** The word carried no mode, and a peer's own boat in a fight was always at peace too. | Her captain's mode in `k`; the boat's battle in `m`; `naval.peerBoat` hands both to the crews' frame. |
| F4 | Medium | **A rider on another player's boat was ashore.** SEA-PEACE's aboard counted only a boat of one's own or a sea ship's deck, so a pirate closing on the boat was no threat to her rider: rest, travel and the time scale stayed open under fire. | The contact half: `meContact` sizes the rider as the boat she rides (`deps.aboardPeer`); the aboard half with F36. |
| F5 | Low | **A prize lost her victor at a handover.** Only the stander knew whom she struck to, so an heir's navy sailed off and the prize lay struck for good. | Her victor in `k`; `releaseOwner` links an adopted prize to her adopted victor. |
| F7 | Low | **A boarding that left with its boarder left her unboardable.** Adoption never cleared the word's `boarded`: her crew was held for good. | `adopt` clears `boarded`. |
| F10 | Low | **The watch's stop could fire mid-sea-fight.** REP1's box (no Escape) opened at a helm under a pirate's guns. | Mac: "Not in a sea fight" - the stop waits while a hostile ship is near a player aboard or a boarding is on (`world.js`, `06-Systems/Standing-Arc.md`). |
| F12 | Medium | **A boarding's bodies were one client's, and the page said otherwise.** They stood PLACED, and a placed foe never rides the foes frame, so the room never saw the fight on her deck, and the crew's `cw` (DECK-WALK's "Online") named no body on a deck. | Mac: "Share it now" - they stand `loose` on the frame: her men as foes, my hands as the reader's shipmates; no foe handover names an heir for a body on a deck. |
| F13 | Low | **A won prize's men came back over open water.** A save after "Leave her" carried the yielded men at deck height, and a load stood them in the air. | `transient` - no save carries a boarding's body. |

### Boarding

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F19 | Low | **Boarders thrown back struck her by the wrong line.** HELM-WAY's unmanned strike took her on the crew line at 95% and burning, and the hull line (NAV-R's share, her fires out) never ran. | `winBoarding`: her hull first, then her crew gone over the rail. |
| F32 | Medium | **Bodies stood on each other, and on the player.** On a short deck the rail answered one cell again and again and the dealer went round, so hands stood on her men and on the player (AUDIT NAV1 B10 undone). | Every body a spot of its own, BODY_GAP clear of every other and of the landing and the player's feet; a deck stands no more than it holds. The deck half: F32 below. |
| F37 | Low | **A raid's waves were not over the rail first.** One shuffle of the rail's spots and the deck's put two of the first eight at the rail. | The rail's dealt before the deck's, each shuffled in its own (`placeQuestFoe`). |
| F43 | Medium | **Warm Ashes' raid on a crewed deck left the crew wandering among the raiders.** The fight took the Galley's four hands off her deck and fielded none, and her other four walked, talked and sang among the raiders. | The raid's own `_ally_` are the crew (NAV1 B2's law), so the world's crews' frame holds the living crew off that deck till it ends (`hold`). Found as a request to stand hands in a raid; re-scoped at the merge. |
| F44 | Medium | **Her men stood as someone else.** A man thrown back and boarded again stood as the muster's next class - an Archer as a Rogue. | Each man of hers his own class where he stood. |
| F49 | Low | **A fallen hand came back.** The fight's losses touched no crew, and the crew stood whole again. | A hand who falls is his CREW_PER_HAND off the boat's crew when the fight ends. |

### The captains

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F8 | Low | **The guns a navy hears were left behind by the world.** The reports were neither moved by a floating-origin shift nor emptied by a transition: a navy steered for a phantom. | `offsetAll` moves them; `clear()` empties them. |
| F21 | Medium | **The stern chase caught only a runner dead on the line and faster than half the pursuer's pace.** A cutter first fired on a runner at 0.45 of her pace at 91.8 s; 8 degrees off the line, one chaser volley in 90 s; a chase that lost ground and closed again was given up at 151 s. | A quarry in flight run down at any pace; the bend closes by CHASE_MARGIN of her pace; the chasers steer for their own lead (`chaserLead`); the lead laid abeam only when it will be in reach, and held; the gain measured against the farthest mark of the last CHASE_GIVE_UP_S. |
| F22 | Medium | **No way round land.** A prize behind a spit was circled for ever, and a boat lying still 30 m behind one was never boarded in 600 s while the brig held her broadsides - a refuge a player could use. | The berth sounded (one on land swapped for the open side); a way round by one sounded waypoint (`routeTo`); a boarding that gains nothing in CHASE_GIVE_UP_S given up, the prize spared. 24 of 24 approaches round the spit grapple. |
| F23 | Medium | **Two ships struck to each other lay so for ever.** The struck kept her target, and the engaged rule never asked the taker's state. | A ship that strikes or sinks fights no one; a mode counts as engaged only afloat. |
| F24 | Medium | **Galleys fought low hulls from inside their own guns' dead zone.** A war galley on a wary sloop lay 1439 s of 2400 inside it; a corsair galley fired no volley at a Large Boat in 300 s. | `layMin`: a battery's dead zone per target hull (a galley's great guns 91 m on a Large Boat, her broadside 57); her stem turned only where the great guns strike, her range never inside, the range opened inside the broadside's. |
| F25 | Medium | **FIGHTING POWER picked the wrong winner of half the navy-pirate duels.** It counted the hull a salvo takes and never the men, while every hurt kills men and, since HELM-WAY, a ship with no hands strikes. | Mac: "Model crew losses" - the measure, and the odds: the time each ship needs to make the other strike, by hull or by men, each ball at the other's size (`strikeTime`, `odds`, `hitShare`). The duels bear it out (below). |
| F26 | Low | **A galley's ram sank a prize outright.** | One captain's ram on another's sound ship stops at the strike. |
| F27 | Low | **A fleeing quarry was let go mid-chase while her pursuer was kept.** | Any ship an engaged ship targets is in the fight. |
| F28 | Low | **The captains' way was not the player's for heavy hulls.** The Carrack gained way at half the player's rate; the galley lost it at twice. | `HULL_BUILDS.sailWay` scales the captains' rates as the player's hull's. |
| F29 | Low | **Over the side or ashore, the boat mended through her fight.** The mending's quiet asked the player's hostile, not the boat's. | The lens's answer, adopted: the quiet measured from the boat (`hostileNearBoat`). |
| F30 | Low | **A merchantman took prizes.** | Mac: "No, they sail on" - only navies and pirates take a prize. |

### The helm

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F14 | Medium | **Flipping Ship handling mid-voyage froze a Carrack for good.** The hold was re-weighed only at the helm's start and each magic round, so the next round set it to nought: 10.81 m/s and 7.14 deg/s for ever. | The handling taken once a helm, at StartSailing, till she is let go; the Features row says so. |
| F15 | Medium | **The in-irons tell never fired with the mod's default waves.** It read her velocity with the sea's current in it. | Her way through the water (`MoveVectorCurrent`). |
| F16 | Medium | **The Overworld's sea crossing refused the Carrack**, which the responsive helm sails. | Accepted under the responsive handling. |
| F17 | Low | **A journey's helm said "Sails up/down" and took the arrows' sail.** | Under the travel view the panel is covered and the sail keys stand down. |
| F18 | Low | **The in-irons advice assumed the classic rudder.** Under the responsive helm the helm alone brings her 40 degrees off the wind in about 10 s. | Its own advice under the responsive helm. |
| F20 | Low | **helmWay.js's figures did not reproduce like for like.** | Re-measured at 1/60 s, the speeds named (`03-World/Come-Sail-Away.md`). |
| F31 | Medium | **The readout said "E: hold fire" and E grappled.** Interact went to the activation ladder, whose naval arm grappled a struck ship in reach with the guns laid; the release then fired a six-ball broadside into her. | `useEdge` first in the frame's gate; the ladder's board refuses while the guns are laid. |

### Friend and foe

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F54 | High | **A failed pickpocket on one of the player's own hands turned him - and he stayed a shipmate.** The steal's failure ran only the motor half of DFU's MakeEnemyHostileToAttacker: he beat the player (4 strikes for 22 hp) while every blow of the player's passed through him (20 swings, none landed). | A shipmate is no mark: the steal refuses him, and a town's defender; any other ally a failure makes fair game (the ally revert runs). |
| F55 | Medium | **A worn drain turned the crew.** Vampiric Effect at range drained every foe within 2.25 m through the foe sink as a player's attack: a shipmate beside the player was drained and turned, and a prize's yielded men un-surrendered. | The drain passes the spared and hurts as DFU's writes health, no attack; `damageFoe` refuses a player's blow on a shipmate. |
| F56 | Low | **A crewman's area spell struck the player and his mates.** Its caster named no foe, so the blast knew no crew. | The caster wrapper names its foe. |

### The deck

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F4 | Medium | The aboard half of F4: another player's boat under the player's feet was not aboard. | `aboardShip` asks the ridden boat (`deps.aboardPeer`). |
| F11 | Medium | **The dead neither rode her nor went down with her.** The leash dropped the dead from the deck's bodies, so the carry never moved them: after a fight she sailed off from under her dead, who hung over open water. | The carry moves the dead; they are taken off when her hull leaves the pool. |
| F32 | Medium | **Small hulls had no deck to fight on.** The inset against the Large Boat's thwarts ate 18 of her waist's 30 cells: 12 cells, and the Rowboat 4. The Pirate Sloop and the Coasting Trader are Large Boats. | No inset against a bench (DECK_BENCH), none that would cost half her deck: the Large Boat 18 cells, the Rowboat 13; the rail's points distinct. |
| F33 | Medium | **Deck points stood on top of her structure.** The ray fell from 3 m, over the 1.7 m headroom the bake guarantees: 26 of the Carrack's 515 cells set points 2.1-2.7 m up on her bow structure. | The ray from under the headroom. |
| F34 | Medium | **Raised decks were out of every boarder's reach.** One level a cell cut the Small Ship's forecastle stair at 8.55, and the leash dragged a body on her forecastle 2.5 m down: a player there could not be reached. | Every floor at her main deck or over it, joined at the motors' step; her other pieces (poop, cabins, under the forecastle) baked beside the open deck, each body kept on its piece. |
| F36 | Low | **A quay near a moored hull's end was aboard.** The hull's box grown a metre read 332 m2 round a Small Ship as aboard, one point 19.6 m from her hull: the hunt, a bounty's trail and a band's chase stood down on a quay. | Aboard is a floor of hers within DECK_REACH_M (`deck.under`). |
| F38 | Low | **A quay over a shallow-water tile splashed.** | Shallow tiles are water under a model too. |
| F39 | Low | **The deck bake skipped classic-model colliders** (the Large Galley's helm model baked as open deck). | Their colliders baked as the world's. |
| F57 | High | **A Large Boat's rig was baked mid-voyage.** The deck was keyed by rig as well as hull, and only rig 0 was baked at the load: the first sight of a rig-3 Coasting Trader cost a 7-15 ms frame. | One deck a hull, baked at the load; the rigs' colliders proven equal. |
| F58 | Medium | **Every stand and boarding paid for its spots again.** The Large Galley's `spots(24)` cost 1.3 ms and 3.7 MB; a deck's main level was sorted and a hull's flats walked at every crew's first sight. | Spots made once a count; the main level once a deck; the flats once a rig. |
| F60 | Low | **Aboard built a hull box for every ship, every call** - 3.34 us and 11 KB against main's 0.14 us. | A ship far off is never asked. |
| F61 | Low | **The walk's heuristic used `Math.hypot`, and its comment called the corner cut linear.** | `Math.sqrt` (1.6x); the comment says quadratic. |

### The living crew

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F6 | Medium | **A re-keyed ship stood two crews, then none.** A room's hand-over keeps her hull under a new key: the new crew read flats the old one had down, the old one's stand-down switched them back on beside the crew, and they stayed down once she left. A hold let go never stood her again. | Her crew moves to her new key; the rest stand down before any stands; a hold let go stands her whole. |
| F9 | Medium | **Owner and room saw two crews for one boat.** The owner seeded by the deed's uid and counted her hurt crew in battle; the room seeded by the key and counted a whole crew at peace. | Seeded `${whose}:${which}` on both sides (the owner's place among his word's boats); a reader counts her crew and her battle off her owner's word. |
| F35 | Low | **A station taken into a fight popped 7 m.** Her captain at the Small Ship's wheel was answered at his post on the poop, and the leash snapped him onto her main deck. | A man taken is answered with his feet on her deck. |
| F40 | Medium | **Nobody reached the rail.** The grapple's 2.2 s was the whole muster: at a repel's start 0 of 2 of my walkers were ready, at my boarding 1 of her 4; the rail was dealt by roster index (190.9 m of walks a muster on the galley). | The muster is called at boarding range (a ship closing to board, a struck ship a boarding could take now, within CREW_MUSTER_M), to the side the other will lie, dealt fore to aft by where the men stand; the stations keep their posts. CREW-MUSTER (FIELD BUGS 2026-10-14, "Crew Attacking Me"; Mac's call, 2026-10-14: "Both"): a struck ship's muster is the boarding's own reach - at the helm `boardable`/`boardingGap` (in BOARD_RANGE, the helm's way under BOARD_SPEED), on foot `footReach` (`navalHost.js:"  function boardingGap(boat, e,"`) - so a helm too fast to board her musters nobody (a repel thrown back left her struck alongside, and every man of mine stood at the rail for as long as the player sat at the helm, and never off it); and a muster's words are its side of the boarding (`crewLife.js:"  board: Object.freeze(["`, `crewLife.js:"  repel: Object.freeze(["`, the host's `way`, the grapple by its kind): the crew going over cries the boarding's, the crew boarded the repel's - one list cried "Here they come!" and "Nobody sets foot on our deck!" at nobody but the player. |
| F41 | Medium | **Two men stood in one sprite for up to 110.8 s.** A spot was free of where men stood, not where they walked to; a talk begun on one point talked in place. | No spot within reach of anyone's walk's end; a stand-off to talk; a walker lets one earlier in the roster by. |
| F42 | Medium | **A crew never grew back, and never emptied.** `sync` only trimmed, and `trim` never took her first man. | A mending restores her count (never the men a fight took); every hand down stands nobody. |
| F45 | Low | **A ship going down swapped her living crew for the mod's flats.** | She keeps them to the end. |
| F46 | Low | **The crew's mood ignored the fight.** 5 to 13 talk lines under the guns a run, and 2856 frames of chanty and "Gold, lads" after she struck. | The guns end every talk; a struck or sinking crew is quiet. |
| F47 | Low | **The chanty's edges.** The next song began 0.03 s after its leader was taken; a verse was said over his own talk. | A dropped song waits CHANTY_S; the leader takes no talk while he sings. |
| F48 | Low | **The walks' edges.** A walk to a talk or to the muster waited on the player 23-29 s; a first leg crossed a hole. | Every walk gives up after CREW_BLOCKED_S; a walk starts along the deck's own line. |
| F50 | Low | **A concealed owner's crew wore their own faces.** | His look on his crew's batches. |
| F51 | Low | **"A Bard among them to lead the song" held for half the player's Small Ships.** | Second in line: among any crew of two or more. |
| F52 | Low | **With the arc off, the living crew still replaced the mod's flats.** | Gated on the arc. |
| F53 | Low | **Under a window the ships stood still and their crews walked and sang on.** | The crews' clock held with the sea's. |
| F59 | Low | **About 550 bytes of garbage a crewman a frame.** | A sprite's size written through; the texture key the uploader's, memoised; one motion object a host. |
| F62 | Low | **At the merge: the muster reached the raised decks F34 made.** Dealt along the whole deck, it stood the Small Ship's foremost man on her forecastle's top row, 0.68 m to port in a starboard muster; her port rail at her stern answered 2.82 m to starboard. | `deck.rail` never answers past her centreline, and at a level when asked; the muster lines her main deck's rail (`mainLevel`, beside the deck now). |

## F25 - the duels, before and after

Eight duels a matchup, the navy's wins and the pirate's (the harness's eight geometries):

| matchup | the old product's favourite | before | the odds (navy) | after |
|---|---|---|---|---|
| cutter v sloop | cutter | 2/6 (wrong) | 0.95 | 4/4 |
| cutter v brig | cutter | 6/2 | 1.11 | 8/0 |
| cutter v corsair galley | corsair | 8/0 (wrong) | 1.47 | 8/0 |
| cutter v flagship | flagship | 0/8 | 0.70 | 0/8 |
| war galley v sloop | galley | 1/7 (wrong) | 0 (the sloop's: no end) | 1/7 |
| war galley v brig | galley | 5/3 | 0.89 | 5/3 |
| war galley v corsair galley | galley | 7/1 | 1.18 | 5/3 |
| war galley v flagship | galley | 0/8 (wrong) | 0.56 | 0/8 |

Wherever the odds lean WARY_ODDS or better, the favourite wins six of eight; no side wins six of eight that the odds
do not lean to; every duel is fought to a strike. The before column was measured at 60 frames a second, the after at
the pin's 0.1 s.

## Mac's calls

1. **Duel balance: "Model crew losses"** - F25, above.
2. **The watch at sea: "Not in a sea fight"** - F10.
3. **Online boarding: "Share it now"** - F12.
4. **Merchants: "No, they sail on"** - F30.

## Checked and sound

- **The merges.** Each of the second pass's merges of main, and each fixer's merge here, was counted three ways on
  normalized lines: no hunk of either side lost.
- **The relay.** No change to the relay, the net layer or `mat4.js`; the word's new keys `k` and `m` are passed and
  unread by an older build's door (it counts `s` and `p` by their fields), and a newer door reads a longer entry's
  first fields.
- **The classic helm is the mod.** Classic handling reproduces Come Sail Away's IL; the helm is frame-rate independent;
  the arrow keys' shares and conflicts, the heave-to and the handling online are as their pages say.
- **The steady frame.** The crews' frame costs 0.18-0.19 ms at the median (0.32-0.39 at the 95th), the host's 1.95-2.0
  ms - main's.

## Not fixed

- **The helm**: the Ship handling taken at the helm is not in the save (a load takes the row's again); the pad's d-pad
  under the travel view; a journey with the view down; `test/systems/naval/helmway.test.js`'s comment.
- **The crew**: `MobileUnit.update` still answers a new object each call (PERF-TOWN1's per-unit row would end it; its
  settings read is shared with the town's loop, kept live on purpose); `comeSailAwayPeers.js` stamps `peerKey` at
  build and `realign` can move a boat to another slot without restamping, so after an owner's boat list reorders a
  reader's seed can drift from the owner's; a Large Galley boarded at the helm after about 4 s in reach has 3 of 8
  walkers ready (her rail places spread over 68 m).
- **Friend and foe**: a crewman's missile flies past the player but meets no pirate - an enemy's missile meets the
  player alone. No crewman casts today.
- **The deck**: `navalHost.js`'s header does not name the `aboardPeer` door; a walker could pass his own height to
  `deck.heightAt`.
- **The captains**: Mac's bar read literally - the favourite six of eight in every matchup - cannot hold where the
  matchup is even (0.95, 0.89 and 1.18 are 4/4, 5/3 and 5/3). A war galley still loses to a sloop 1/7 - the sloop
  fights at 55 m, inside the galley's dead zones: class balance, not captaincy. A war galley cannot lie at a berth
  beside a spit, so she gives the boarding up and spares the prize. Under the odds no wary pirate takes a player's
  Large Boat (a sloop's odds 0.21, a brig's 0.55: the swivels' two men a ball); the bold still come.
- **Four older survivors**: `navaudit_captains.json`'s NAV1-the-tacks-carry-dropped, NAV1-no-pay-off and
  NAV1-never-warped, and `navaudit_guns.json`'s NAV1G-no-bear-free, survive on the second pass as it shipped too -
  AUDIT NAV1's, not this audit's.

## PIN MOVED

`nav_g_online` (the word's two new fields), `auditrep` F3 (the sea's arms after the foot fight's), `deepshare` (the
deck's arm), `livingcrew` (each man his own class; a captain taken at the deck point nearest his post; a sinking ship
listed struck; the frame's clock under a pause), `disc19` (the same call), `csa_sailing` (in irons with the waves on),
`deckfield` and `prof1_client` (the frame's gate), `ows2_crossing` (the Carrack crosses), `csa_together` (the panel's
cover), `renown1` (`damageFoe`'s guard), `deckwalk` (THE REAL HULLS' spot tolerance), `seapeace` (the measure and the
odds) and `navaudit_captains` (M12 past CHASE_GIVE_UP_S) - each marked in its own line with its law intact. At the
merges: `auditnav2_online`'s F2 compares the measures whole and its F4 stands on the odds' one wary prize among the
player's hulls; `auditnav2_crew`'s repel asks every walker of mine ready, and its first-leg walk runs twelve seeds.
Other lists' records re-aimed by content at the new text, all dead.

Not verified in a browser.
