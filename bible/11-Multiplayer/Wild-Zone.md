# The Open Zone - Cyrodiil (WW-C2; the Wrothgarian Mountains, WILD1)

WW-C2 (2026-10-24, `03-World/World-Wide.md` WW-C), the owner: "Cyrodil becomes the new open PvP area with the
wrothgarian mountain area being retired in favor of this. Cryodil will be home to all abundent resources and everything
else from the wrothgarian zone." The zone below is Cyrodiil's now - every law of it, its rings, its halls, its giants,
its strangers, its death and its remains - and section 25 says what moved and how. The Wrothgarian Mountains are
Daggerfall's own again. Where a section below names the mountains, the region 16 or the cut, it is the record of the
zone as WILD1 built it (the owner's words above are WILD1's).

2026-10-07. The owner:

> Wrothgarian mountains need to be turned into a open pvp zone where ppl when killed cant get looted all of the
> items they have, except campfires, torches, potions etc. And players can choose 1 item of the equipped ones the
> killed player has by clicking the dead body (which opens their inventory in simple form next to the player who
> loots the killed ones inventory) the body disappears in 2 minutes and with it the player can only then respawn.
> The zone needs to be marked on the map players cant see each others near and in that zone. Mobs are 4x stronger
> (even elites and champions) and drop 100% better loot. Same goes for dungeons. When a player dies by mobs he has to
> wait 2mins till respawn and drops the loot he has in his bags not except campfires, torches, potions etc, (you dont
> drop your equipped stuff) no carts allowed in this area.

Asked four things, the owner answered: a player's death at another's hand drops the bags too ("2") and "the players
can take the cart in to the zone and it also loses all loot in it. when the players respawns in a town near the zone
the cart comes with him, make sure it doesnt stuck the player when he spawns and other players"; what a death drops
"lay around for 10 minutes and are marked for you to get them back and other players can take em"; on the maps "only
parties and guilds can see each other"; and "100% better" is "twice gold and twice the dropchance for rarity items
and double drops". Then: "make sure the high risk area is marked with a highquality fog of war on the world map and
red lines around it, make sure the ui for it (like looting others) is enhanced plus and grimoireui conform".

The same morning, WILD2 and WILD3:

> also give the zone 4 levels from the outerside to the inside 25% of the zone are 25% more loot when you go in deeper
> 50% more loot then 75 and when youre in the middle 25% 100% more loot this needs to be also shown on the world map
> when clicking on this zone it opens its own extremely well made map same layout as the worldmap only wrothgarian
> mountain enlarged with its higher tiered loot zones i just explained and so on. Also fast traveling via carriage
> inside the zone costs 2,5k gold and has a 10minute cold down. you cant fast travel out and into the zone. Same for
> all other fast travel options except the overworld map. Giants you meet there are also 4 times bigger(not in
> dungeons only outside). i hope there are giants to meet :D ... Youre also slower in this zone max 20x in the wilds
> and 40x on the roads and when other players are near you they are counted as enemies bright red and its called
> stranger when you near them Like 600m away. and when youre near them like 200m it slows you down like normal
> enemies. And no player nameplates should be visible in the zone except the ones out of your party and guild.

READ AS: the centre's "+100%" is the flat "twice" of WILD1 - the heart pays what the whole zone paid, the outer rings
less; the foes are four times as strong in every ring (and, since PVPDUNGEONS, a ring's own share more - section 2).

This is the second door through Multiplayer.md's "It is not PvP" - the first is the duel (DUEL1). Not a DFU member:
Daggerfall Unity has no other players. Ledger A (ONLINE).

THE LATER PASSES (2026-10-08). The patch the owner uploaded as THE WROTHGARIAN ZONE (merged in one relay version,
world177) carries a day of further asks on top of WILD1-WILD3, each tagged in its code with the owner's words. The
zone's own are told in sections 1-11 where they changed what those sections said, and in sections 12-20 where they
are new: the halls (PVPDUNGEONS), the Greater Giants (ZONE-GIANTS and its passes), the zone's other laws, /unstuck
(PVPUNSTUCK), the maps' later ink, the mountains walkable everywhere (MOUNTAINS WALKABLE) and the test build's switch
(TESTBUILD). The asks that rode in with it but are not the zone's are section 21.

PVP-EASE (2026-10-26). The owner: "Overhauling the open PvP to be a bit more palatable, being able to insure gear on
death. Make it where you cant lose your wagon/horse or anything stored on death. And just overall making the experience
more palatable while retaining its punishment". Asked, the owner chose: insurance that KEEPS the piece and is spent by
the death ("Kept, policy spent") at "20% of worth"; "Wagon + companions' packs" as the storage no death takes (the horse
and the wagon themselves never dropped - `WILD_NEVER_GROUPS`' Transportation); and, of the softenings offered, the
"Repeat-kill shield" and the "Entry/rise grace" (not the bag's drop capped). Four slices, one change: STORE-KEEPS
(section 4 - the cart and the packs storage), WILD-INSURE (section 4b), REPEAT-SHIELD (section 4c) and ZONE-GRACE
(section 3b). What still punishes: the bag's drop, a tenth of the purse and of each letter, the killer's one worn piece,
the two minutes down and the rise outside the zone.

PVP-REWARD and PVP-NO-TENTH (2026-10-29, `PvP-Rework.md`) took the bag's drop and the tenths away. A player kill takes
one worn piece, else one policy's gold, else its last roll: a tenth of the coin and letters together, the purse first,
for the killer alone (`wildDropLaw.js:"export function takeWildLastRoll"`). No gold lies in the remains for anyone,
so WILD GOLD and LETTERS-TENTH in section 4 are history at a player kill.

AUDIT PVP-EASE (2026-10-26, the owner: "Can we audit this"; `01-Overview/audits/Audit-PvP-Ease.md`): four cold lanes
read the change: 21 reported, 16 defects. All 16 are fixed. Four of them were the owner's to call, and the owner chose:
- a COMBAT LOCK on storing for a minute after a player's blow (section 4, STORE-KEEPS - the storage had made the drop
  optional);
- a policy spent "Only when it saved the piece" (section 4b);
- "Any take ends passage" (section 3b);
- "Yes, every rise" (section 3b).
The rest are fixed in place: the shield measured between the kills (4c), stale policies lapsing (4b), safe passage held
across cells and wakes and kept by ships' guns (3b), the game's book read for the joined character (4b), and the words.

## 1. What the zone is

WW-C2: CYRODIIL, WHOLE - every map pixel the world's grid puts in the Imperial Province (`world/worldWide/worldGrid.js`
theatreAt, theatre 9; region 70, `WILD_REGION`, `wildZone.js:"export const WILD_REGION"`), and every
place on it. Its mask is `systems/wild/cyrodiilZone.js` (`cyrodiilZone.js:"export function cyrodiilMask"`): ZONE-LINE
(section 27), a map pixel is the zone's exactly when the world's grid puts it in the province or it lies in water the
province encloses - the province's own law to the pixel, its border the player's own traced picture (a picture unit
some fifteen to eighteen pixels), so every client with the same files cuts the same zone; kept while the trace and the
fit stand. The mask keeps it on a grid of `CYRODIIL_CELL_PX` (4) pixel cells on one lattice over the world, each cell its
sixteen pixels as bits, a cell inside where its middle pixel is (the rings' depth, the halls and the giants run on
those cells), and the maps draw one line for it and for the province (`cyrodiilZone.js:"export function zoneLineOf"`). `buildWildMask`
(`wildZone.js:"export function buildWildMask"`) lays any zone on such a grid - its origin, its cell - and every law
that takes or answers a place takes and answers world map pixels (section 25). NEAR it is within `WILD_NEAR_PX` (6)
map pixels of its edge (two cells). ONLINE ALONE: offline the province is the world's own (the death penalty's law). The
law is `src/systems/wild/wildZone.js` (a leaf: the region test, the mask and its edge, the numbers, the live flag the
pools read at a spawn, and the death screen's state); the world host sets the flag each frame (`wildFrame`,
`world.js:"const wildFrame ="`) from the ring of the pixel under the player (`world.js:"const here = seaRing > 0"`;
ETHER-WILD, section 24, the sea past Veilhaven's peace beside it), and says the crossing. A dungeon reads its own map
pixel (`dungeonContext.js:"const _wildDungeon"`).

WILD1's zone (2026-10-07 to WW-C2) was the owner's CUT of the Wrothgarian Mountains: the politic map's region 16 inside
a polygon of the region's box (ZONE-CUT, ZONE-CUT2), Wrothgaria and two pixels about it kept out by moving the whole west
border east (WILD-KEEPOUT, WILD-KEEPOUT2), read off the map files by `wildMaskOf`. All of it retired with the zone.

## 2. Foes and loot

- WILD2: THE RINGS. A pixel's depth is its chamfer distance from the zone's edge (`buildWildMask`'s `depth`), over the
  deepest pixel's; the outer quarter of that depth is ring I (the Foothills, +25%), then II (the Passes, +50%), III
  (the High Crags, +75%) and the heart, IV (+100%) - `WILD_RING_LOOT`, `wildRingAt`. Everything below is at the ring's
  multiplier (`wildRingLoot`): a street foe takes the ring the player stands in at its spawn (`wildRing`, the world
  host's each frame), a dungeon the ring of its own map pixel (`wildRingAtPlace`, over the mask the world host
  registers - every client of the room alike). Crossing a ring is said ("Deeper - The Passes: +50% loot.") and the
  HUD's zone tile names it.
- A foe of the zone stands four times its health and hits four times as hard - over whatever it already is (an elite,
  a champion, a revenant), so "even elites and champions" (`applyWildFoe`,
  `wildZone.js:"export function applyWildFoe"`) - and, since PVPDUNGEONS (the owner: "With the tier, enemies also get
  stronger on top of what they are in the zone based on the tier percentage"), its ring's multiplier more on both
  (`wildTierMult`): x5 in the foothills to x8 in the heart. A street puppet scales its blows alone; its maximum is its
  owner's word. A dungeon's foes scale on every client alike (the dungeon's own region and pixel, read once at the
  build), so the room's maximum agrees.
- THE PACKS (PVPDUNGEONS, the owner: "4x more enemies per pack that can attack you on the world map"): in the zone the
  encounter cap is `WILD_PACK_MULT` (4) times `MAX_ACTIVE_ENCOUNTER_FOES`
  (`exteriorFoes.js:"export const WILD_PACK_MULT"` `encounterCap`), a camp's members are allowed it, and an Overworld
  band born on a zone pixel is four times its size (`world.js:"gameMinutes: b.night"`, `wildBornHere` - the mask every
  client builds alike, so a band's size is the same everywhere).
- Its loot at its ring's multiplier: every category's chance (`lootDropMult`) and the rarity ladder's odds
  (`lootQualityMult`) through `wildLootOpts` - the doors spawnEnemyLoot already has, whose chain is untouched - its
  gold after the chain (hostCombat.js `wildLootAfter`) and a plain foe's cap as much wider (foeLootCap.js, by
  `wildRing`). A dungeon's treasure pile rolls its ring's share of a SECOND roll through its one home (`wildPileMore`:
  the heart's always, the foothills' one time in four) - so its drops, its gold and its odds of a rare piece are the
  ring's on average.

## 3. The fights

Two players standing in the zone may strike each other - never KIN: a member of my party or one under its truce, my
duel's opponent, or - MAC'S DECISION (2026-10-14, "Guildmates are friends") - a member of my guild - in the
open country but never in the streets of a city, a town or a village (ZONE-SAFE, section 26) and, since PVPDUNGEON (2026-10-08, the owner: "players should be able to attack each other in dungeons
too in the pvp zone"), in its dungeons (`wildCan`, `world.js:"const wildCan = (streets"`) - in its dungeons only since
AUDIT FB1018 L3-5 (`01-Overview/audits/Audit-Field-Bugs-2026-10-18.md`): wildFair had asked whether the PEER's pose
stands in the zone, and a dungeon's pose is the dungeon's own frame, which the map reads as its corner pixel, so every
peer underground was refused. In a dungeon a room's peer is fair by the place now (the place is the zone: wildCan's
`wildHere`, the door's pixel). THE RELAY REFEREES EVERY BLOW
(INT9, 2026-10-09, `06-Systems/Integrity-Arc.md` section 5; `src/net/wild/wildRef.js`): my own cell's socket says I stand in
the zone where it fights (`zone` - its audit: never a halo's, again at each crossing and every `WILD_ZONE_KEEP_MS`; never
in a settlement's streets, ZONE-SAFE) and a blow lands only
where both fighters said so in the same cell, as a share of the player's own health (SHARED-HEALTH, `06-Systems/Integrity-Arc.md` section 5; the bar kept at
the hub as I cross, whole again away `WILD_REF.awayMs`), every strike and spell a number the striker's own sheet rolled, judged on the weapon its look holds and the
arms its token signs, the reach from the places the relay believes; the referee's word (`wref`) says what landed, and
a fall. There is no floor - a blow can kill. AUDIT FOE-KEEPS E2 (the owner, 2026-10-24, asked: "Credit the last
player"): A DEATH THE REFEREE DID NOT SEE - a foe's, a fall's, the sea's - within `WILD_REF.creditMs` (10 s, pinned equal
to `WILD_KILL_CREDIT_MS`) of a fair player's blow is that player's kill: my own cell's socket says I left the zone dying
(`zone` 0 with `dd`, `world.js:"setWildZone?.(wildCan() ? 1 : wildCan(true)"`) and the relay makes
the fall as a blow's (`wildRef.js:"export function wildCredit"`, `server/src/index.js:"async _wildCredit(st, a, now)"`) -
said to the room, signed after the killer's pick or at once where no body is searched, and taken as any kill is. Since
FOE-KEEPS a death to a foe drops nothing, so a player losing a fight denied its winner everything by dying to a foe, a
fall or the sea first (lane E: brought to 28 of 320 by 18 blows, a fall and nothing dropped). The worn pick waits on the
first dead frame's offer, so a credited kill takes the bag and the tenths (STORE-KEEPS: the cart and the companions'
packs too, until it), never a worn piece. A relay before world254 drops `dd` and credits nobody. Kin is one law at both ends (`wildRef.js:"export function wildKin"`): the
referee asks it of every blow and cast, a duel's two and one guild read off the two sockets' verified guilds, the party
and its truce asked of the hub only when neither is (`server/src/index.js:"const kin = wildKin({ duel: duelKin, guilds: [a.gi, tb.gi] })"`),
and every client door asks it of its targets, a guild by the tags the relay stamps - a tag is one guild's alone
(`world.js:"if (wildKin({ party: !!social?.isPartyPeer(peerId)"`). Outdoors the melee arm, the arrows and the cast
engine's marks reach fair players through the duel's own arms (each falls through to the zone when no duel or battle
stands) - never one whose shown pose stands in a settlement's streets, and none at all while I stand in them (ZONE-SAFE). Underground the dungeon's own swing takes a fair player in reach, in view and in sight before any foe
(`dungeonContext.js:"function resolvePlayerHit"` resolvePlayerHit, over the host's `wildBodies`/`wildStrike`), and its
cast engine's marks are the fair players (`wildSpellMarks`/`wildSpellOut`) - asked at the cast since RPT1026-FIGHTS
HALL-SPELLS (2026-10-26: the seam had been chosen at the build, the world host hands every dungeon the arena's door, and
no spell met a player underground until then; `06-Systems/Integrity-Arc.md` INT10); no arrow is aimed at a player there. The
striker whose blow felled a fighter is its killer (the referee's word). Inside buildings
there is no player fighting: the zone's danger there is its foes.

ZONE-WATCH (2026-10-08, the owner: "attacking other players in cities will call the guards"): my blow or my spell on a
player in a town of the zone is Assault, the watch's own crime - set and answered (`zoneWatchCall`,
`world.js:"const zoneWatchCall"`) at most once each ten seconds, so a fight keeps the watch called without a storm of
posts. ZONE-SAFE (section 26) took its cities: no blow is struck in a city's, a town's or a village's streets, so the
towns it answers are DFU's other four (`nearbyObjects.js:"export const TOWN_LOCATION_TYPES"`) - a farm, a manor, an inn,
a temple - outdoors (its door's roof arm retired: no blow is struck under a roof either). And the watch is ten times as strong there (the owner: "Guards in the cities are 10x times as strong"):
`ZONE_WATCH_SCALE` (`wildZone.js:"export const ZONE_WATCH_SCALE"`) through the street host's `guardScale`
(`world.js:"guardScale: () =>"`) - a watchman's health and every blow it lands (`cityGuards.js:"the zone's watch"`).

## 3b. Safe passage (ZONE-GRACE)

ZONE-GRACE (2026-10-26, PVP-EASE above; the owner chose "Entry/rise grace"): FOR SIXTY SECONDS AFTER A FIGHTER ENTERS THE
ZONE (never on a rise since PVP-DEATH, `PvP-Rework.md`), NO PLAYER'S BLOW OR CAST LANDS ON IT, and its own blow or cast on a player ends it at once
(`WILD_GRACE`, `wildRef.js:"export const WILD_GRACE"`). It is the referee's, like every other law of the fight: a blow on a
fighter under it is refused (`wildBlow`'s `grace`), and a striker under it loses it as its blow is judged
(`graceEnded`). AN ENTRY GRANTS IT ONLY TO ONE AWAY AND QUIET: away from the zone `WILD_GRACE.awayMs` (30 s) and in no
fight - a blow it landed or took - for `WILD_GRACE.fightMs` (60 s), so a step over the edge and back is no way out of a
fight (`wildRef.js:"ZONE-GRACE: an entry"`). A CELL CROSSED IS NO
ENTRY, NOR A ROOM WOKEN FROM ITS SLEEP (AUDIT PVP-EASE L3-1, L3-2, L3-5 - `01-Overview/audits/Audit-PvP-Ease.md`): the hub
keeps each fighter's carry (`wildCarry`) - its last fight (`fa`), whether it stands in the zone by the last room's word
(`in`), when it left (`at`), the passage it has left (`gr`, none once ended) and a death the referee did not keep (`dd`) -
and the next room's fighter is made with it (`takeCarry`): one the hub holds `in` the zone is never away, and its fight
is a minute's whatever the carry's age. The relay puts it as a fighter comes and goes (an entry, a leave, its socket
gone - `_wildLeaveCarry`), at a death, when a passage ends (its blow, its take) and at a landed blow on it (its bar); the
hub drops a leave said by a room the fighter has already left for another (`lr`, the room that said it - never `rk`,
a foes frame's raid word, which the relay reads nowhere). Before the audit
the carry was put for a struck fighter alone and read within the mend's half minute: a striker, a fighter under passage
and a walker were granted a fresh minute at every cell they crossed, and every keepalive into a woken cell. A RISE NO LONGER
grants it (PVP-DEATH, `PvP-Rework.md`, over AUDIT PVP-EASE L3-6's "Yes, every rise"): neither a fallen standing again
after `WILD_REF.riseMs` nor a death the referee did not keep - a foe's, said `died` on its way out (`wildZone`'s `died`,
carried as `dd` to the town's cell) - rising inside, at its ring's town (section 4). A TAKE ENDS IT (AUDIT PVP-EASE L3-4, the owner: "Any take ends passage"): taking from a remains - one's own or
another's - ends the taker's passage as its blow does (`wildGraceTaken`, `_wildGraceTake`), so the rise's minute is no
untouchable run back to the body. SHIPS' GUNS KEEP IT (AUDIT PVP-EASE L3-3): a ship whose captain is under it takes no
shot (`seaRef.js` `seaShot`'s `grace`), a captain's own shot ends its passage, and a gunfight is a fight for both, for an
entry's ask.

The relay says it (`server/src/index.js:"_wildGraceSay(a, ms) {"`): a passage begun or carried in, to the room
(`wref` `grace`, the fighter's id and the ms it has left), ended by its own blow (`ms` 0), and a blow it kept off to the
striker alone (`n` 1, `_wildGraceBlow`) - new Room methods, `_message` untouched. The wire takes the word
(`wire.js:"export const WILD_GRACE_MS_MAX"`, pinned equal), and the game says it to its player
(`systems/wild/wildGrace.js`): mine begun, once (a crossing's carried word is not said again), mine ended - by my blow or
run out on the zone's frame - and a blow of mine kept off a stranger, once in `WILD_GRACE_SAY_MS`; out of the zone it
forgets what it heard and says nothing (AUDIT PVP-EASE L3-7: "Other players can attack you" came a minute after a step
out, where none can). world270 (world269 on its branch). Not a DFU member: Daggerfall Unity has no other players.

## 4. A death in the zone

PVP-REWARD (2026-10-29) replaced the bag drop and the killer's pick below: a kill gives one random uninsured worn
piece, or one policy's gold, or its last roll (`PvP-Rework.md` PVP-REWARD).

PVP-WORDS (2026-10-29): the player's words say the same. Entering, "If another player kills you, they may take one
uninsured worn piece, or gold." (`wildZone.js:"'You enter {zone"`);
the chips, "A player's kill may cost uninsured gear or gold."; the sea's the same (`etherWild.js:"export const ETHER_WILD_TEXT"`);
the legend, "nothing drops" (`wildZoneMap.js:"export const ZONE_RULES"`); the tutorial's page names all three rolls
(`tutorialCatalogue.js:"t('tutorials.wildZone.body2'"`). A foe's death drops nothing and pays the usual death penalty
at the rise (`world.js:"const goldLost = wildKilled ||"`), so its screen says "Nothing dropped. You pay the usual death
penalty." (`wildZone.js:"deathKept: () =>"`).

FOE-KEEPS (2026-10-24, the owner: "I feel like the eltheric sea can be too punishing. I dont want people to lose
everything they have. Espcially the fact you can lose your spellbook? Ridiculous"; asked, the owner chose "Only PvP
deaths drop", "The usual tenth" and "Both zones"): ONLY A DEATH AT ANOTHER PLAYER'S HAND DROPS ANYTHING, in the
mountains and on the open sea (section 24) alike. A death to a foe - a monster, a ship, the sea itself - drops nothing:
the fallen keeps the bag, the cart, the companions' packs and every worn piece, and pays the usual death's tenth of the
purse at the rise, as a death outside the zone does (DEATH-PENALTY; `world.js:"wildKilled = wildDeathKill()"`).
The first dead frame asks no drop (`world.js:"const wildDeathBegin"`), the fallen's tab asks one only against the
relay's signed fall (`wildDropHost.js:"const key = readWildReceipt(rc)?.r;"`), and the account service refuses a foe's fall,
nothing moved (`foe`, `server-account/src/wild.js:"if (body?.receipt === undefined)"`) - so a tab from before the word takes
nothing either - and, its own rise skipping the usual tenth at any death in the zone, pays nothing until it reloads
(AUDIT FOE-KEEPS L2, H3, P5, E4: left - a deploy's window, the gain the player's); a foe's fall the service took before the
word is answered as it was taken. The death screen says so
(`wildZone.js:"deathKept: () =>"`), and the zone's words say what a player's kill takes, never any death
(`WILD_TEXT.enter`, `chipTip`, the sea's `ETHER_WILD_TEXT`, the zone map's `ZONE_RULES`, the tutorial's page). A kill's
gold share is a tenth (WILD GOLD, below), where it was half. The spellbook was never the zone's to take: KEPT below
names it, and the decor law's kept-back list holds it too (`test/systems/wild/foekeeps.test.js`). Not a DFU member:
Daggerfall Unity has no other players, and no zone.

Either death, at the first dead frame, while the room is still the player's (`wildDeathBegin`,
`world.js:"const wildDeathBegin"`):

- KEPT: potions, light sources, the camp's kit and fire, food and water, the rest consumables, ammunition, bandages -
  and everything that never changes hands (a quest's item, a summoned or bound piece, a boat's deed or parts, the
  Materials Bag, a vehicle, a deed, the spellbook). KEEP-WALLET (2026-10-09, the owner: "the wallet shouldnt drop in
  the zone"): the wallet, and the Deadlands Embers and Welkynd Shards it holds, stay with the fallen - the wallet is an
  organizer, its pieces lie in the pack itself, so the rule names each (`isWalletItem`, `walletHolds`;
  `wildDropLaw.js:"if (isWalletItem(item) || walletHolds(item))"`). `src/systems/wild/wildDropLaw.js` (INT9:
  the law's home, a leaf the account Worker bundles; `src/systems/wild/wildDeath.js` re-exports it).
- THE KILL IS THE REFEREE'S WORD (AUDIT FOE-KEEPS H1, with L1, P1, E5 and H2): a death is a kill when the referee says I
  fell at a player's hand - whenever that word is heard, before my first dead frame or after it, or a take against my
  receipt lands (`wildZone.js:"export function wildDeathAtHand"`, `wildDeathKill`, `wildFallHeard`, the fall kept there
  beside the kill it makes). It was the killer's NAME at the first dead frame from a fall heard in the last 15 s: a
  hidden tab hears its socket and runs no frame, and a foe's blow can kill me on my own machine while a player's in flight
  reaches the referee first - a kill read as a foe's took the kill's tenth into the remains and the usual tenth again at
  the rise (200 of 1,000 where the rule is 100), under "You keep what you carry". The rise and a Resurrect read the kill
  (`world.js:"wildKilled = wildDeathKill()"`; a Resurrect after a kill spares nothing it did not), and a death whose
  first dead frame found no room rises out of the zone as a kill's does.
- DROPPED, AT ANOTHER PLAYER'S HAND ALONE (FOE-KEEPS, above): every other thing in the bag - never the cart's nor a
  companion's (STORE-KEEPS, below), never a piece a policy keeps (WILD-INSURE, section 4b) - into the
  room's remains (section 5). INT9: TAKEN OFF THE RECORD BY THE ACCOUNT SERVICE (`server-account/src/wild.js`,
  `/v1/wild/fall`), never handed over by the fallen's game:
  the fallen's tab asks as an act on its record (checkpointed as it will rise; the law
  `wildDropLaw.js:"export function takeWildDeath"` the service's alone - the killer's piece, the gold, then the drop by
  worth), against the relay's signed fall at a player's hand (FOE-KEEPS: a foe's asks none), naming the room its remains
  lie in; the service answers the records it took, what the record lost (the tab takes out exactly that -
  `wildDropLaw.js:"export function wildTakeTook"`) and its `remains` order over them for that room, the same order each
  asking, good its minute; and the tab deposits them on it - the room keeps nothing else (INT9's audit: each valuable
  piece under a fresh id, the id it had the fallen's own copy). WILD GOLD: and a tenth of the gold - `WILD_GOLD_LOSS` (0.1,
  FOE-KEEPS: the usual death's share, pinned equal to `DEATH_GOLD_FRACTION`; it was 0.5) of the purse (STORE-KEEPS: the
  cart's gold stack paid its tenth beside it, until it), as ONE pile record in the same remains
  (`takeWildGold`, `wildDropLaw.js:"export function takeWildGold"`),
  for anyone to take; the usual death penalty is not taken on top (`world.js:"const goldLost ="`). LETTERS-DROP (the
  owner: "letter of credits should be dropped"): a letter of credit is the one piece the wallet holds that the death
  takes, as it takes the purse's coin - into the same remains at its whole value, unless a quest's or one the trade
  refuses (`wildDropLaw.js:"=== 'MiscItems' && item.templateIndex"`) - answered ahead
  of the decor's kept-back list, which names the letter too. AUDIT FOE-KEEPS LETTERS-TENTH (the owner, asked whether a
  kill takes a letter whole, a tenth of its worth or none: "Your choice" - LETTERS-DROP's "letter of credits should be
  dropped" and FOE-KEEPS' "I dont want people to lose everything they have" both kept): a kill takes a TENTH OF EACH
  LETTER'S WORTH into the same gold pile and the letter stays (`wildDropLaw.js:"export const WILD_FALL_LETTERS"`,
  `gold.letters` by its id; a 50,000 letter cost 50,000 at a kill where the same gold as coin cost 5,000) - a quest's, one
  the ledger keeps and one worth under ten pay nothing; the death screen says it
  (`wildZone.js:"deathLettersTenth:"`). The fallen's own ask carries the word (`letters` 1, wildFallWords) and a
  seizure takes the tenth; a tab from before the word is answered as before - its letters whole - since its game would
  never lower one. BURNT-SAID (FIELD BUGS 2026-10-18b,
  `01-Overview/bugs/Field-Bugs-2026-10-18b.md`): the death screen names the letters a death took by their worth
  (`wildZone.js:"deathLetters: (n, gold)"`), and a held record's drop - taken and laid nowhere (Integrity-Arc, Lane
  1's freeze) - is said as lost, where it was said as nothing at all (`wildZone.js:"deathBurnt: (n) =>"`).
- STORE-KEEPS (2026-10-26, PVP-EASE above; the owner: "Make it where you cant lose your wagon/horse or anything stored on
  death"; asked, "Wagon + companions' packs"): THE CART AND EVERY COMPANION'S PACK ARE STORAGE, AND NO DEATH TAKES THEM -
  neither a piece nor a share of their coin, wherever the wagon stands and whoever stands at the side (`takeWildDeath`:
  the bag, the purse and the letters' tenth alone). The horse and the wagon themselves never dropped (Transportation is
  one of `WILD_NEVER_GROUPS`). It retired two laws, kept here as their record:
  - CART-AWAY (FIELD BUGS 2026-10-15d; Mac, 2026-10-15: "if its parked outside the zone nothing should be lost") took the
    cart's cargo and a tenth of its coin while the wagon was WITH the fallen - driven, beside them, following or parked
    on the zone's ground - on the fallen tab's word that it was away (`cart` 0, `systems/wild/wildCart.js`, removed) held to
    its record's mode (`wildCartMayBeAway`, removed). The service reads no `cart` word now; a tab from before it still
    says one, and nothing reads it.
  - COMPANION-DROP (FIELD BUGS 2026-10-19f; the owner, 2026-10-19: "Bag drops; no send-off in zone") dropped a crew hand's
    pack ashore and the sworn one at the side's pack and kit with the bag, and so kept them at the side: no send-off from
    inside the zone, nothing given as kit to a sworn one waiting outside, and one knocked out there handing what it
    carried into the player's own pack (`heldAtSide`, `packStaysAshore`, `leaveRefusal`, `leftWithYou` and the three
    `WILD_TEXT.companion*` words, all removed). With nothing of theirs to drop, a companion comes and goes in the zone as
    anywhere - a hand knocked out there gives his pack to her hold, a sworn one rests with its pack and kit - and the
    zone still stands one sworn one at the side (PVPDUNGEONS, `wildSwornAtSide`). The service's refusal of a pack's take
    to a tab that did not say `packs` 1 went with it: no take of a pack is made. The lists at the side stay named
    (`wildPacks`, `WILD_PACK`) for the one reader left: a fall taken before STORE-KEEPS and asked again is answered its
    first take, and the fallen's game takes a pack's piece out of that pack alone (`wildTakeTook`).

  The two doors COMPANION-DROP left open for the owner close with it: a piece stowed in a ship's hold from inside the
  zone (CARGO-ANYWHERE) and a boat's hold on the zone's water are storage too.
  THE COMBAT LOCK (AUDIT PVP-EASE L2-1, the owner chose "Combat lock"): storage no death takes, open from anywhere in the
  zone, made the drop optional - a fighter at 1 HP moved its bag, its purse and its letters into the cart and a kill cost
  it one worn piece at most. FOR `WILD_STORE_LOCK_MS` (60 s) AFTER A PLAYER'S BLOW - given or taken, a sword's, a spell's
  or a ship's gun's - NOTHING MAY BE STORED: the wagon, a companion's pack, a ship's hold, a chest (any list the host marks
  `storage`), gold dropped into any of them and a sworn one's kit (`wildStoreLock.js:"export function wildStoreRefusal"` - a leaf of its own, as the account Worker bundles the inventory's law,
  asked by `systems/inventorySession.js` `storeRefusalOf` for both inventories' every store, dry run and gold drop -
  `itemTransfer.js` `planStore` and `planDropGold`'s `store` refusal - and by `revenantCompanions.js` `giveSwornGear`).
  A fall at another's hand locks it a minute past the pick, so a Resurrect inside it stores nothing before the take.
  Taking out is never locked. A blow is the referee's landed `hp` word, mine or on me (`world.js` `wildHpIn`), and a
  hull word, my ship's or my broadside's (`scenes/naval/seaBroadsides.js`). It is the page's own law, as INT9's lane-2
  limits say (section 22): a modified client stores as it likes.
- WORN: kept on a death to a foe. At another player's hand, in the open country (a cell room), the killer may take
  ONE worn piece - never one a policy keeps (WILD-INSURE, section 4b: offered as any, a pick of it lands on nothing and
  spends its policy - AUDIT PVP-EASE L2-2): the fallen's
  game shows the list (`worn`, under the fall's id), the killer's body window picks
  (`pick`, INT9: to the relay, in the room that refereed the fall, within `WILD_REF.pickMs`, naming what the offer
  showed there), and the relay signs the fall with it. MAC'S DECISION (2026-10-14, "Yes, build it" - THE TWO-PHASE
  HANDOFF): the fallen loses that piece only once the killer has it. The service takes it off the fallen's record INTO
  ESCROW (`server-account/src/wild.js`, `wild_escrow`, in the fall's own batch - its ledger key the service's), where the
  fallen's tab says its room signs collects (`collect` 1, online.js `wildCollectAt` over `relaySupportsWildCollect`); its
  order says so (`we`), and the remains list the piece as their killer's alone. The killer's game asks the room for it
  the moment the room says the remains, and the room answers no record - it signs the killer's COLLECT
  (`wildReceipt.js:"export async function mintWildCollect"`, `g1`: the remains' id, the killer, the realm character its
  socket plays), once, and says the same collect each time it is asked (`wildLaw.js:"export function collectAsk"`). The
  killer's tab carries it to the service as an act on its own record (`/v1/wild/collect`, wildCollect): the piece into
  that record and the escrow ended, one batch guarded to the one row - only then is it the killer's, and it arrives in
  the service's answer, carried, never in a slot (`wildEscrowHost.js:"const wildCollected = (d) =>"`). NOBODY COLLECTING by the
  remains' latest end (`until`: the order's minute and `WILD_REMAINS_MS`, WILD_ESCROW_HOLD_S) and a collect signed at
  that moment spent (`WILD_COLLECT_TTL_S`, `escrowBackAt`), the fallen's own tab takes it back into its record
  (`/v1/wild/reclaim`, wildReclaim) - watched on the zone's frame (`wildEscrowHost.js:"const wildEscrowFrame = () =>"`), and a
  game closed meanwhile asks the service at its next play (`/v1/wild/escrows`). The piece is in the fallen's record, the
  escrow, or one record - never two, never none; an end asked twice moves nothing twice. What the fallen sees: the
  death screen says the piece is held until the killer collects it and comes back otherwise (`WILD_TEXT.deathHeld`), a
  line says when (`heldNote`), and its return or its collection is said (`heldBack`, `heldTaken`). A record the judge
  holds keeps the piece outright: it could never reach its killer. A tab whose room does not sign collects (an older
  relay) is the room's old take: the piece off the record into the remains, the killer's alone (section 5).
  While the body lies the fallen's socket stays in the
  room, so the signed fall reaches them; a fallen that lets `WILD_FALL_GRACE_S` (30 s) go by is seized by its killer
  (the record moved where it stands, its lease cleared). WILD-REJOIN (FIELD BUGS 2026-10-25h): a fall signed while its
  fallen had no socket in the room - its game closed on the death screen - says so (`g` 1,
  `wildReceipt.js:"export const wildFallGraceS"`), and its killer carries it at once: no tab of the fallen's is there to
  take the drop first. A death at a player's hand underground drops the bag and the
  gold's tenth as a kill in the open does, and offers no worn piece; a death to a foe there drops nothing (FOE-KEEPS).
- THE DEATH CHECKPOINT. A dead character is never the realm's save; its drop's act checkpoints it AS IT WILL RISE (one
  health, where it fell) before the service is asked, and again after, without what it dropped
  (`wildDeathCheckpoint`).
- A DEATH IN A HALL (HALL-CROWS, the owner: "i dont see the crows circleling around the dungeon where i died on the
  zone map"): always locks the hall for the hour and sets the crows over it, whether or not the pack had anything to
  drop (`world.js:"if (modes?.mode === 'dungeon' && _wdunInside)"`; section 13).
- THE WAIT: the death screen holds `WILD_DEATH_HOLD_S` (10 s, DEATH-10; 60 s at PVP-RISE, 120 s before); Enter
  rises at once (PvP-Rework.md DEATH-10); the killer's body lies the minute.
- A GAME CLOSED ON THE DEATH SCREEN (WILD-REJOIN, FIELD BUGS 2026-10-25h, a player's report: "if you die in the
  wilderness and alt f4 before you are looted you wont be able to be looted by who killed you. you can also skip the
  death timer this way"): the fall is the referee's, and the referee keeps the fighter down its 10 s
  (`WILD_REF.riseMs`) - in its room, and by the hub's carry in any other. The record the game comes back to is the save
  from before the fall (a dead character is never saved), so a page that comes back alive and says it stands in the
  zone is told it is still down (`wref` `down`, `wildRef.js:"export function wildDownWord"`): the time left and, from
  the room that refereed the fall, where the body lies. It lies down again for the rest of the wait
  (`systems/wild/wildRejoin.js`, the death's `served` seconds off the screen's hold), a kill, its body where the fall
  was, so the receipt it is owed - said after the `down` word - lays its drop there; nothing is offered again. The death's
  subscribers are not told it twice (`playerEntity.js:"export function presentHeardDeath"`: Project Legacy decided it on
  the page that closed). A page that saw its own death in the zone inside `WILD_REJOIN_KNOWN_MS` (on the screen, risen,
  raised by a party's Resurrect) takes no `down` word, and the referee says none inside `WILD_DOWN_SAY_MIN_MS` of the
  rise. DECIDED (2026-10-25, asked with the fix and answered "with your recommended defaults"): the page serves the time
  LEFT, never a fresh two minutes; the killer keeps the whole pick window when the fallen leaves before it picks.
- THE RISE: at another player's hand, the nearest town or temple outside the zone and its band (`wildRiseSite`,
  `world.js:"const wildRiseSite"`, over `wildDeath.js:"export function wildRisePicks"`). AUDIT FOE-KEEPS E1 (the owner,
  2026-10-24, asked: "Rise inside the zone"): a death to a foe, which drops nothing since FOE-KEEPS, rises INSIDE the
  zone - the nearest town or temple in the ring it fell in, else anywhere inside, else outside as a kill does: its rise
  outside had made dying the zone's free way out, where fast travel out is refused and the walk out from the heart is an
  hour and more (lane E: 39.5 px at the median, 65 real minutes on a horse at the pace cap). Either - except a death in one of the zone's dungeons (PVPDUNGEONS, the owner: "Dying in a
  dungeon respawns you in city near the dungeon"), which rises in the city nearest it, in the mountains too, so the
  way back to the remains is a run and not a journey. The team is called to follow whatever Follow Fast Travel says
  (`forceNextFastTravel`, spent by the journey's `handlePreFastTravel`/`handlePostFastTravel` pair - a waiting team is
  called first), the player stood clear of every other body and facing open ground for the team behind
  (`wildSpawnSpot`).

## 4b. Insured gear (WILD-INSURE)

WILD-INSURE (2026-10-26, PVP-EASE above; the owner: "being able to insure gear on death"; asked, "Kept, policy spent" at
"20% of worth"): A POLICY ON A PIECE OF GEAR KEEPS IT FROM A KILL IN THE ZONE, AND THE KILL SPENDS IT. The law is one leaf
both ends read (`src/systems/wild/wildInsureLaw.js`):

- WHAT MAY BE INSURED: a piece the ledger follows (`ledgerKeyOf` - Magic tier and up, a DFU magic item or artifact, a
  crafted piece: the policy names it by that key, as the ledger does) that a death could take (`wildCanLose`), carried
  in the pack or worn. Never a letter of credit (coin, which pays its tenth), never a piece kept anyway.
- ITS PREMIUM: a fifth of the piece's worth (`itemWorth`, the judge's measure), rounded up - `WILD_INSURE_DIVISOR` -
  paid as every realm act pays (`payFromSave`: the purse, its letters, the bank). Five deaths' premiums buy it again.
- WRITTEN BY THE ACCOUNT SERVICE, NEVER THE RECORD (`server-account/src/wildInsure.js`, `/v1/wild/insure`; migration
  0181, `wild_insurance`): a policy a game could write onto its own piece is one it never paid for. The premium comes off
  the record where its tab says it stands and the rows are written in the same batch (each guarded - `mustChange`), or
  neither lands; a piece under a policy in force, a non-gear piece, a piece not carried and a premium the record cannot pay
  are refused, nothing moved. A character holds `WILD_INSURE_MAX` (32) at once, `WILD_INSURE_ASK_MAX` (8) an ask - and
  (AUDIT PVP-EASE L1-2) only policies on pieces the record still holds count: one whose piece is nowhere in the record
  any more (sold, traded, salvaged, dropped before it was in force - `wildPolicyHeld`, its key anywhere in the record, so
  a piece in the cart keeps its policy) LAPSES at the next insure, in its batch (`state` 'lapsed'). Before, such
  policies stood for good, and thirty-two of them shut the door. The premium is the realm's price - a sink, burnt
  (`int2_judge.test.js`'s SINKS). `/v1/wild/policies` lists them for its tab.
- IN FORCE `WILD_INSURE_SETTLE_S` (120 s) AFTER IT IS WRITTEN, against the fall's own signing (the receipt's `i`): the
  killer has `WILD_REF.pickMs` to pick and the fall is signed after it, so a policy written on the death screen keeps from
  nothing (`wildPolicyInForce`). The game writes one only outside the zone (`insureInZone`), where the walk in is longer.
- AT A KILL (`server-account/src/wild.js:"const insured = pvpInsuredFor"`; PVP-REWARD since, `PvP-Rework.md`):
  a piece under a policy in force is kept as a piece the ledger bars is - never taken by the killer's pick, never
  dropped, never asked of the ledger - and (AUDIT PVP-EASE L1-3, L2-2, the owner: "Only when it saved the piece") A
  POLICY IS SPENT ONLY WHEN IT SAVED ITS PIECE: the worn piece the killer picked, or a bag piece the drop would have
  carried into the remains - takeWildDeath's `saved`, a dry run of the same law without the policies on the very save
  it takes from (`wildDropLaw.js:"function wildSaved"`), spent in the fall's own batch (`spent_r`, `spent_at`). A
  policy on a worn piece no pick named, in a hall that searches no body, or past the remains' bound stays in force.
  Before the audit every policy on a piece the fallen carried or wore was spent at any kill - a hall death burnt a fifth
  of every insured worn piece's worth for nothing. PVP-REWARD retired the killer's offer and pick
  (`world.js:"// PVP-REWARD: no worn offer - the account service rolls the killer's piece (systems/wild/pvpReward.js)"`),
  so no fight waits on a book the page read late or never. The answer names
  the keys kept (`insured`); the fallen's game forgets those policies and its death screen says how many pieces insurance
  kept (`WILD_TEXT.deathInsured`). A death to a foe takes nothing and spends nothing (FOE-KEEPS); nor does a shielded
  kill (section 4c).
- THE GAME (`net/wild/wildInsureBook.js`): the JOINED realm character's policies (`realmSession.id` - AUDIT PVP-EASE L4-1:
  it read at boot for the id `characterIdOf` mints before the save loads, the service answered `body`, and the book was
  empty for good), read at boot and again by the card when stale (`lineOf` asks `fresh`, `WILD_POLICIES_STALE_MS`) and
  judged on the shared clock (L4-5); written as the record's act with the wallet reserved first (the Firmament respec's
  way - a refusal gives back exactly what it took), and a write that landed with its answer lost read back (L4-4). The
  pack's card says a piece is insured and when its policy takes effect (`lineOf`, the green `insuredline`) and offers
  Insure (its premium) beside the piece's own acts - the Enhanced Plus pack's card and its right-click menu
  (`ui/enhanced/enhancedInventory.js`), which reads the book through a leaf of its own (`net/wild/wildInsureSlot.js`:
  loading the pack never loads the item law's registration with it - AUDIT SET D6's honest pieces were judged by it).

### INSURE-ALL: every piece of gear, at its price

INSURE-ALL (2026-10-29, the owner: "make sure all equpiment cost even old ones"; reported with it: "there no cost to
insure rares that are fully enchanted"). EVERY PIECE OF GEAR A KILL COULD TAKE MAY BE INSURED - a weapon, armour, a
shield, jewellery, clothing (`WILD_GEAR_GROUPS`), plain or of any tier, found before the ledger or after - at a fifth of
its worth. Before, a policy needed a ledger key, so a plain piece was never insurable and showed no price. Never a
stack, a bound or quest piece, a letter of credit, or a piece `wildCanLose` refuses. A classic save's piece and a
sigil's bound piece are never taken, so need none.

A POLICY NAMES ITS PIECE BY `insureKeyOf` (`src/systems/wild/wildInsureLaw.js:"export function insureKeyOf"`):
its ledger key, or a plain piece's own id. The book mints that id when the piece is insured
(`wildInsureBook.js:"const key = wildInsureKey"`) and the act's first
checkpoint carries it to the record. No ledger reads it: `ledgerKeyOf` answers null for a plain piece whatever it
carries, so the judge, the wealth and the trade lock see the record as before (`insureall.test.js` judges it both ways).

A FORGED OR COPIED ID BUYS NOTHING MORE THAN THE PLAYER'S OWN PIECE. Policies are the character's own rows. The service
refuses a key two pieces in the pack carry (`server-account/src/wildInsure.js:"const piece = named.length"`),
and at a fall a key two of the fallen's pieces carry keeps neither (`wildInsuredBy`'s `among`). Every reader that names
a policy's piece reads this key: the book's card, the service's insure, the fall's keep and spend
(`takeWildDeath`'s `saved`, through the predicate's own `keyOf`), the kill's roll and its policy pick
(`pvpReward.js`), and `wildPolicyHeld`. The ledger's own readers - the bar, the escrow, the remains' new ids - keep
`ledgerKeyOf`.

THE ITEM MAKER'S GOLD IS IN THE PREMIUM (`wildMakerGold`). The maker writes no `value` (`applyEnchantments`, the port of
DFU's `SetEnchantments`, writes none), so a Rare enchanted to its full points priced as it was found: insurable on both ends, at the same price
headless, but cheap for what it cost. The premium now adds the gold its maker-laid powers cost - each row at the
catalogue's cost (never the row's own `enchantCost`), times `GOLD_PER_ENCHANTMENT_POINT`, a side effect at none, the
ladder's own row at none (it is in the Rare's worth already). A DEPARTURE from the brief, which asked `itemWorth` to
count it: `itemWorth` is the judge's wealth measure (`WEALTH_VERSION`), and moving it would move every wealth reading.
acct217; no migration, no relay change. Deploy the account service before the site.

Pins: `test/systems/wild/insureall.test.js`, `tools/mutants/insureall.json`.

## 4c. The same hand twice (REPEAT-SHIELD)

REPEAT-SHIELD (2026-10-26, PVP-EASE above; the owner chose the "Repeat-kill shield"): A KILL BY THE SAME HAND INSIDE HALF
AN HOUR TAKES NOTHING. A fall whose killer felled the same character within `WILD_REPEAT_S` (30 min, any fall the service
wrote - so a killer camping a rise keeps the shield up for as long as they camp) - measured between the KILLS, each
fall's receipt signing (`ki`, AUDIT PVP-EASE L1-1), on either side: by when each was carried, a killer who held a second
kill's receipt (good for an hour) until the first's row was half an hour old took it whole - takes no worn piece, no bag and no
gold, spends no policy and moves no record (`server-account/src/wild.js:"async function wildShielded"`); it is written as a
fall all the same (`tk.shield`, its sea kill's bounties with it - a bounty is its setter's gold, never the fallen's) and
answered `shield`, so the death screen says it (`WILD_TEXT.deathShield`). Another hand takes as ever. Read by migration
0181's `idx_wild_falls_pair` (`char_id`, `killer`, `ki`). A fall carried before `ki` (and a foe's) shields nothing.

## 5. The remains

The room's object keeps them (`src/net/wild/wildLaw.js`, server `_wild*`): each remains its records and its owner, for
`WILD_REMAINS_MS` (`wire.js:"export const WILD_REMAINS_MS"` - twelve minutes since PVPDUNGEONS: the owner's ten to get
back to them AFTER the two minutes' wait, since the despawn does not wait for the rise), at most
`WILD_REMAINS_ITEMS_MAX` records and `WILD_ROOM_REMAINS_MAX` remains a room. The first `take` of a record wins it; the
record goes to its taker alone (`got`) and the room hears what left (`rm`). On a player's side
(`src/net/wild/wildRemains.js`) each remains is an ordinary ground pile in the pool of the host they stand in - the
street's, a building's, a dungeon's - so it is drawn, aimed at and opened with the very loot window every pile opens
with. A take the window makes is lifted back out of the pack at once and asked of the room; the room's record arrives
with `got` (a take of coin, WILD GOLD's, out of the purse it went to). Nothing can be put on remains (`noStore`, the
capacity door). MY remains wear their own red line of light (`WILD_MINE_MARK`) and a pulsing mark on the world map
with the minutes left.

- WHOSE, AND BY WHAT NAME (WILD-REMAINS-LOSS, `01-Overview/bugs/Field-Bugs-2026-10-25h.md`): a remains is the fallen's
  by its order's account (`os`) and named for the fallen by its order's `wnm` (the name the fallen wears), whoever laid it - a seizure is
  laid by the killer, whose socket's name and peer had made it "Traveller" and the killer's own
  (`wildRemains.js:"export const remainsMine"`). The room checks a deposit's order with its verifying key loaded
  first: a room woken from hibernation since its last hello refused every deposit, and the drop the service had taken
  lay nowhere. A game knows its own account in the zone by the hub's word, else by its signed-in session's
  (`wildSelf.js:"export const wildSelf = "`, WILD-HUBLESS): a game the hub had not seated never took its own drop, and
  the fallen rose holding what its killer's seizure had put in the remains.

- NOT A FRIEND'S (PVPDUNGEONS, the owner: "Party/guildmembers cant pick it up"): a fallen's remains are theirs and
  their foes', never their party's or their guild's. The room refuses the take
  (`server/src/index.js:"a fallen's remains are theirs and their"`) - a guildmate read off the sockets' own verified
  guilds (the remains keep the fallen's `gi` - INT9's audit: the service's order's `wg`, whoever carries it), a party member asked of the hub (`_wdunKinOf`,
  `server/src/index.js:"async _wdunKinOf"`, over `WDUN_INTERNAL_KIN`, kept a minute a pair, the stalest pair let go first past 512 - never the whole cache; a hub that does not answer is kin, kept `WDUN_KIN_SILENT_MS`) - and a member's game
  never seeds the pile at all (`canTake`, `world.js:"canTake: (rec) =>"` and `wildRemains.js:"if (!canTake(rec))"`).
  PVP-LOOT (FIELD BUGS 2026-10-14, "Equipped items Disappear after looting in PvP zone"): the DROP's law, never the
  killer's worn piece. The record the service's order names (`wk`, `wi`) is its killer's whoever the fallen's guild or
  party counts them (`wildLaw.js:"export const remainsNamedFor"`), and the room asks the friend law only of a record it
  names for nobody (`server/src/index.js:"if (rec && !remainsNamedFor(rec, d.i) && rec.os"`); a piece in escrow is a
  collect, which the friend law never reads (section 4). The room had refused a killer who was the fallen's guildmate the
  piece the service had already taken off the fallen's record, and it lay there for nobody
  (`01-Overview/bugs/Field-Bugs-2026-10-14.md` PVP-LOOT). Guildmates are kin since (section 3), so the named piece meets the
  friend law only where a party or a guild was joined between the fall and the take, or the hub is silent at it.
- BESIDE THE BODY (PVPFIX, the owner: "place the pile next to the body not on top of it"): the pile stands a fixed
  step to the side of where they fell, the same on every client (`wildRemains.js:"- on top it was hidden"`) - on top
  it was inside the body and could not be aimed at.
- KEPT THROUGH A CRASH (WILD-KEEP, FIELD BUGS 2026-10-09c, "Stuff pvp zone": "my game crashed before I could retrieve
  it. When I logged back in, my gear was no longer visible on the map"). The room holds the pile its twelve minutes
  whatever the client does; the client's one record of it (`world.js:"let _wildMine = null;"` - where it lies, the room,
  its end, the hall) lived in memory, so a game crashed or closed came back with the world map's pulsing mark gone, the
  pile not known for mine by its record, and a hall's lock refusing the hall my pile is my way back into (section 13).
  It is kept on the device beside WILD-WAYPOINT's flag now, for the character that fell (`systems/wild/wildRemainsWaypoint.js`
  keepMine / keptMine / forgetMine, its own key: a flag removed by hand keeps it), read back once by the zone's frame and
  forgotten at its end or at the room's "gone". CLIENT-ONLY; NOT DONE, and the owner's: a record the account keeps (a
  second device, a cleared storage), a clock that waits for a disconnected owner, and a relay log of a fall's records
  that a lost pile could be granted back from - today nothing keeps them past the twelve minutes. Pinned by
  `test/systems/wild/fb1009c_wildkeep.test.js`; `tools/mutants/fb1009c_wildkeep.json` (7, all dead).
- THE GOLD PILE (FIELD BUGS 2026-10-20h, "the PvP remains and gold pile", `01-Overview/bugs/Field-Bugs-2026-10-20h.md`).
  REMAINS-GOLD: the pile's one coin record is minted by its count, to the item law's one count
  (`wildRemains.js:"const mintOne = (/** @type {any} */ r)"`). The game's mint is the stranger's projection, whose stack bound is the wire's 65,535,
  so a death that dropped more gold than that showed it to nobody, and the gold stayed in the room until the remains
  went. REMAINS-TAKE: a pile shows what the room holds, less the takes of mine still waiting on an answer
  (`wildRemains.js:"const follow = (rec, i)"`). A take of part of a stack, such as the gold a pack has no room for, was taken off
  the taker's pile twice, and a room word heard between the window's take and the frame set the count over that take,
  so the taker kept coin the room still held. A word now waits for the window's take to be asked first
  (`wildRemains.js:"const settle = (rec)"`). Pinned by `test/net/fb1020h_remains.test.js`; `tools/mutants/fb1020h_remains.json`
  (10, all dead).

## 6. The maps

- WILD2: THE RINGS ON THE WORLD MAP: three thin dashed lines inside the red one where each deeper ring begins
  (`wildRingChains`, smoothed - section 18) - the lines alone since PVPDUNGEONS (the owner: "The 25%,50,75,100% marker
  shown on the world map when not clicking on the zone have to be removed",
  `wildZoneMap.js:"25%,50,75,100% marker shown"`): the zone map and its legend name each ring and its bonus.
  `ui/wild/wildZoneMap.js` paintWildRings.
- WILD2: THE ZONE MAP. A press on the zone on the world map - anything there since ZONE-ZOOM (section 18) - or the
  key's "Zone map" button holds the world sheet to the Wrothgarian Mountains (`_openZoneMap`): the same paper, ink and
  marks, the view fitted to the zone in the room the legend leaves (`zoneMapView`, the clamp `zoneMapLimits` - never
  back out to the bay), the rest of the bay sunk under a wash, each ring laid in its tone as a light wash (ZONEINK2,
  section 18 - the rings' plaques it had are gone), its places named as the zoom comes in, and a legend panel
  (`buildZoneLegend`, enhancedStyle.js `.hmwild`) - the rings with their swatches, where I stand, the zone's laws
  (`ZONE_RULES`, `wildZoneMap.js:"export const ZONE_RULES"`), Begin journey when a destination is picked, the names'
  switch, and the way back (its button, or Escape). The classic page (GrimoireUI) draws each ring's tone in its fog
  and a dark line where a deeper ring begins, and a key of the four in the page's lower left (`_drawWildKey`).

- THE WORLD MAP (enhanced, `src/ui/heldMap.js`): the zone under a drifting fog, built once on its own canvas
  (`src/ui/wild/wildMapInk.js` - the feathered mask times three octaves of value noise, in ash and dried blood) and drawn
  between the land and the marks, so a town in it still reads; its edge a red line over a dark halo, dashed brighter
  past the far band, never drawn along the map's own upper edge where the map ends; a key row "Open PvP zone". Over
  it since the later passes: the day's halls, the crows, my locks, the Greater Giants' skulls, and the border alight
  under the pointer (sections 12-18).
- THE CLASSIC MAP (`src/ui/travel/travelMapWindow.js`): WILD1's dithered fog and red rim over the province map and the
  Wrothgarian Mountains' page (CLASSIC-CUT, the picker's region laid over the map's) - RETIRED with the mountains' zone
  (WW-C2): Cyrodiil lies past the Bay, on no page of the classic map; the held map's continent draws it.
- WHO IS SEEN: in or near the zone only my party and my guild (`wildHidesPlayer`) - on the world map and the
  Overworld alike; and a player with no guild sends no region mark there at all.

## 7. The HUD and the windows

- A crossed-blades glyph (`STATUS_GLYPHS.wild`) stands first on the status widget while the player is in the zone, on
  the enhanced skin and on the classic row (`hudActiveSpells.js`), and the crossing is said mid-screen. In a
  settlement's streets it is named "Safe zone" (ZONE-SAFE, section 26), and its tip says the streets' peace; elsewhere
  the tip says where the peace is.
- WILD-LINE-HOLD (2026-10-08, the owner: "the warning message for the zone doesnt stay long enough right now only a
  part of a second"): the mid-screen label counts GAME seconds and the zone is crossed at a journey's pace - at x20
  its 1.5 s were 75 ms. A crossing's line (and a ring's, and CROW-NEWS's) is held `WILD_LINE_HOLD_MS` (7 s,
  `world.js:"const WILD_LINE_HOLD_MS"`) of REAL time: put back whenever the label has gone blank, so a later message
  of its own still shows.
- The body's window is the pack in choose-one - the reward tray both skins already draw (Enhanced Plus, and the
  classic window GrimoireUI re-dresses) - titled with the fallen's name.
- The death screen says the killer's claim, what was left behind and the wait, on both faces.

## 8. The wire and the deploy

Relay `world177` (`RELAY_VERSION`, `wire.js:"export const RELAY_VERSION ="`): THE WROTHGARIAN ZONE's one version,
renumbered past main's SUPER-DUNGEONS (world176) - its parts written on their branch as world175 (WILD1) and world176
(PVPDUNGEONS) before ZONE-GIANTS joined them. Two frames:

- `{t:'wild', data}` (`validWildData`), from a hello'd socket in a PLACE room (a cell or a world room), gated on
  `WILD_RELAY_MIN` (177, `wire.js:"export const WILD_RELAY_MIN"`): the blows, a fallen's gear, a remains' deposit and
  its takes (section 3-5). INT9 (world185, `WILD_REF_RELAY_MIN`): the zone word (`zone`), the blows refereed and routed
  to nobody, the killer's `pick` the room's, a deposit carrying the service's order on every chunk; `gave` and
  `result` retired. The referee's own frame `{t:'wref', k}` (`validWildRefOut`): `hp`, `fell`, `rc` (the signed fall).
  WILD-REJOIN (world260 - world258 on its branch, renumbered past KETCH-LONGER and ASK-LONGER at the merges - account acct191, acct186 on its branch): `down` (`ms`, and `r` with `p` from the fall's own room - section 4), said
  before the receipts a socket is owed; an older client drops the kind. A fall receipt signed with its fallen gone from
  the room carries `g` 1. Deploy the account service first (an older one holds a `g` fall's killer to the grace - the
  killer's tab then asks again past it, `wildSeizeHost.js:"a?.error === 'grace'"`), then the relay, then the site.
  PVP-LOOT (world205 - world201 on its branch, one bump past main's world201 and world202 at the merge, and world203 on the integration, renumbered past main's world203 and world204 at the merge of main): the room's take asks the friend law of the drop's records alone (section 5); a guildmate is kin
  at the referee (section 3); and the two-phase handoff (section 4) - the order's `we`
  (`identityToken.js:"if (c.we !== undefined && c.we !== 1)"`), the room's `cr` word to the killer
  (`validWildOut`, the collect `g1`, `WILD_COLLECT_MAX`), `WILD_COLLECT_RELAY_MIN` (205; 201 on its branch and 203 on the integration, and main's world201 to world204 hand the record) for a tab to ask the escrow - an
  older client drops `cr`, so it never takes the room's copy of a piece in escrow. Deploy the relay first, then the
  account service (acct136: `wild_escrow`, migration 0118 - acct133 and 0113 on its branch, acct134 and 0115 on the integration; `/v1/wild/collect`, `/v1/wild/reclaim`, `/v1/wild/escrows`),
  then the site.
- `{t:'wdun', k, ...}` (`validWdunIn`/`validWdunOut`, `wire.js:"export function validWdunIn"` and
  `wire.js:"export function validWdunOut"`), to the social hub alone, from a socket whose social hello named its
  verified account, gated on `WDUN_RELAY_MIN` and `WDUN_GIANTS_RELAY_MIN` (177,
  `wire.js:"export const WDUN_RELAY_MIN"`), `WDUN_FRAME_MAX` 160 bytes, `WDUN_HZ_MAX` 2 a second. In: `hi`,
  `in`/`out`/`here`/`die` with a hall `h` (`"px,py"`), `gk` a giant `g` (0-7). Out: `st` (the day, the relay's clock,
  my locks, the crows, the giants down), `ok`/`no` (an entry's answer, its epoch or the lock's time left), `lk` (my
  new lock), `cr` (the crows, and `who` - the account whose death set them), `gd` (the giants down). Sections 12-15.
- Three internal doors between the relay's objects: `WDUN_INTERNAL_RESET` (the hub wipes a hall's world room,
  `wire.js:"export const WDUN_INTERNAL_RESET"`), `WDUN_INTERNAL_KIN` (a place room asks the hub whether two accounts
  share a party, `wire.js:"export const WDUN_INTERNAL_KIN"`) and `WDUN_INTERNAL_GONE` (a place room says a fallen's
  remains are gone, `wire.js:"export const WDUN_INTERNAL_GONE"`).
- And one field on the foe stream: `gg` (`wire.js:"if (r.gg !== undefined)"`), the Greater Giant a foe record is
  (0-7) - section 15.

`src/net/wild/wildLaw.js` joins the relay's bundle (the remains' law and the halls' record, `wdun*`). Deploy the relay
first, then the site. A client on an older relay plays the mountains as they were - the zone is not raised there at
all (`wildFrame` reads `online.wildOk`), and no `wdun` word is sent to a hub that would close the socket on it
(`online.wdunOk`, `online.wdunGiantsOk`).

CART-AWAY (2026-10-15, section 4) is one field on the account service's `/v1/wild/fall` body, `cart` (0 the wagon away,
1 with them) - no relay frame and no migration. A service from before it ignores the word and a tab from before it says
none: either way the cart is taken as it was, so the two deploy in either order.

COMPANION-DROP (2026-10-19, section 4) is the Worker's leaf (`src/systems/wild/wildDropLaw.js`, already on
`account-deploy.yml`'s list), one field of its answer, `gold.packs`, and one of the fallen's ask, `packs` (1: its game
reads the packs - AUDIT FB1019f B2) - no relay frame, no migration: an ACCOUNT DEPLOY (acct163), which the merge runs.
A tab from before it - one left open across the deploy, or the desktop app's own bundled game until it updates - says
no `packs`, and its take read every `took` piece not the cart's as the bag's and no pack's coin: handed a take of a
companion's pack, it stripped a piece of the bag bearing his piece's marks and kept his piece and his coin where the
record had dropped them (the coin twice at its next checkpoint). So the service refuses such a tab a take of the packs,
nothing moved, in the old build's word (`not-found`); a take that touches no pack is taken for it as ever. Its fall at
another's hand is taken whole by its killer's seizure past the grace; its death to a foe drops nothing at all
(FOE-KEEPS, section 4). A service from before it never takes a pack and never reads the word, so the two deploy in either order.

PVP-EASE (2026-10-26, sections 3b, 4, 4b and 4c) is one relay frame and an account deploy with a migration. STORE-KEEPS
moves no wire: the service stops taking the cart and the packs and reads neither word (`cart`, `packs`), which every tab
from before it still sends; this game stops saying `cart`. WILD-INSURE is migration 0181 (`wild_insurance`, and
REPEAT-SHIELD's `idx_wild_falls_pair`), two routes (`/v1/wild/insure`, `/v1/wild/policies`), a new leaf on
`account-deploy.yml`'s list (`src/systems/wild/wildInsureLaw.js`) and the fall answer's `insured` and `shield` - acct196,
the migration applied before the Worker that reads it, as the deploy runs them. A tab from before it reads neither field
and takes out exactly what the service took (nothing of an insured piece, nothing at all under the shield). ZONE-GRACE is
the relay's (world270): the referee's law and a `wref` kind, `grace`; a client from before it drops the word it does not
know. The account service and the relay deploy in either order. (Numbered world269, acct195 and migration 0176 on its
branch; renumbered past the TESA fold's at its fold into #1184, and the migration to 0181 past LOCKPICK's 0176 when the
fold merged main.)

## 9. The journeys (WILD3, PVPTIERS)

`wildJourney` (`wildZone.js:"export function wildJourney"`): a fast journey never goes into or out of the zone; one
that starts and ends inside it may go once every WILD_TRAVEL_COOLDOWN_MS (ten minutes, `playerEntity.wildTravelAt`),
in coin, for the fee of the TIER IT LANDS IN (PVPTIERS: `WILD_TRAVEL_FEES`,
`wildZone.js:"export const WILD_TRAVEL_FEES"` - 2,500 gold into the foothills, 5,000 the passes, 10,000 the high
crags, 15,000 the heart; WILD3's flat `WILD_TRAVEL_FEE`, the owner's "2,5k", is the foothills' now). Asked at every
fast door - the travel map's journey and the carriage drivers' and the ships' and a party's to its leader
(`fastTravelTo`) - through `wildTravelGate` (`world.js:"const wildTravelGate"`, said when refused) and
`wildTravelPaid`. The Overworld map's journeys are walked, never asked.

- NO TELEPORT (PVPDUNGEONS, the owner: "Teleport to leader etc and of any kind into, in the zone should not be
  possible (except the carriage inside of tiers ofc)"): Recall (but to an anchor in the same interior), the guild's
  teleport and the party's teleport to its leader neither leave from, land in nor go about inside the zone but at a
  settlement (WILD-CITY-PORT, section 28) (`wildTeleportRefused`, `world.js:"const wildTeleportRefused"`); the zone's own
  roads between its tiers (the journey above) are the one way about the rest. WILD3 had let a teleport that started and
  ended inside go for the fee.
- PVPJOURNEY (AUDIT STARTS U4: a press on a quest's diamond inside the zone is a destination too, as a hall's is - the
  zone map's card is down, and its pick had shown nothing): a journey picked on the zone map is always Cautiously, by land, at inns - no choices (`_forceZoneOpts`,
  `heldMap.js:"_forceZoneOpts(o)"`); a press on the zone map's ground or on a place is a destination, and the legend's
  Begin journey starts it.

## 10. The pace (WILD3)

In the zone the travel dials run under a cap (systems/travel/travelPace.js `setPaceZoneCap`, `WILD_PACE_CAP`): at most x20
off the road and x40 on it. A cap, never a write - the player's choice comes back the moment they leave. A stranger
near holds the journey slower still (STRANGER-PACE, section 11).

## 11. Giants and strangers (WILD3)

- GIANTS: WILD3 stood a Giant (MobileTypes 16) for one wanderer roll in WILD_GIANT_CHANCE (15%) in the zone's open
  country. ZONE-GIANTS retired the roll (the owner: "dont use the 15% anymore"): a Giant the tables roll there is
  passed by (`world.js:"if (hit.mobileType === WILD_GIANT)"`), and the zone's giants are its eight Greater Giants
  (section 15). `WILD_GIANT_CHANCE` and PVPGIANT's `WILD_GIANT_MAX` (`wildZone.js:"export const WILD_GIANT_MAX"`) are
  no longer read. WILD3's size stands: a giant of the zone stands WILD_GIANT_SIZE (four) times its size, its body too
  (`wildGiantSize`) - never a dungeon's.
- STRANGERS: every other player in the zone outside my party and my guild (`wildStrangersFrame`,
  `world.js:"const wildStrangersFrame"`, four times a second). Marked on the Overworld in an enemy's bright red as
  "Stranger" within `WILD_STRANGER_SEE_M` (1,500 m, `wildZone.js:"export const WILD_STRANGER_SEE_M"` - STRANGER-SEE,
  2026-10-08, the owner: "make strangers visible at 1,5km"); their coming said within WILD_STRANGER_M (600 m, as WILD3
  had it); within WILD_STRANGER_SLOW_M (200 m) they hold a journey as any foe does (`journeyThreats`); and over their
  heads on the Overworld a red "Stranger" with none of their badges (`wildNameMask`, `world.js:"const wildNameMask"`).
  In 3D their own name shows (PVPNEAR; PVP-SEEN, 2026-10-30). A concealed or invisible flagged player shows its
  skull and bar, no name (`pvpFlagHost.js:"barKept: (id) =>"`).
- STRANGER-PACE (PVPNEAR, the owner: "near a stranger 300m 10x, 200m 5x speed", then: "10x 600m 5x 300 3x 200m and
  1x 100m"): the nearest stranger sets the journey's pace whatever the foe dial says - x10 within 600 m, x5 within
  300, x3 within 200, x1 within 100 (`journeyThreatCap`, `world.js:"function journeyThreatCap"`, its `strangerRate`).
- 3D AT 100 M (PVPNEAR, the owner: "when 70m near the stranger it also auto puts both in 3d mode"): each client
  brings its own Overworld view down when a stranger is within 100 m - the code's distance, not the 70 m asked
  (`wildStrangersFrame`).
- THE MARK AS A FOE'S (PVPNEAR): a stranger's Overworld mark is an enemy's (`tvEnemyMarkKey`,
  `world.js:"const tvEnemyMarkKey"`): a press on it is a journey straight at them, and the one attacked holds the
  journey no slower. STRANGER-HELM (the owner: "a stranger should have a knights helmet in the same art as the dots"):
  the mark is a great helm in the dots' own art - the stranger's red, the dots' black edge
  (`travelViewHud.js:"STRANGER-HELM: a"`). STRANGER-LINE (the owner: "Stranger nearby looks totaly missplaced"): the
  journey box says "stranger near" in red in the ground line's own place while a stranger holds the journey
  (`enhancedTravelControl.js:"in the time box itself"`).

## 12. The halls (PVPDUNGEONS)

2026-10-08. The owner:

> Tier 1 has 10 dungeons evenly split in the tier 1 zone so you can reach a dungeon doesnt matter from where you
> approach the zone - Tier 2 8, tier 3 6, tier 4 4. All dungeons that are set are elite dungeons. Those dungeons
> positions change every 24h realtime hours and are shown on the map and zone map.

Then "as centered as possible not on the border to the other tier... dont override towns or other POIS.",
"Cemeteries cannot be zone dungeons!", and of the rules that follow, "THOSE HAVE TO WORK!".

- SPAWNED, NOT CHOSEN: every real dungeon inside the zone is SEALED ("The way in is sealed. Only the halls marked on
  the map are open today.", `wildDungeonGate`, `world.js:"const wildDungeonGate"`, asked by the interior door,
  `worldModes.js:"(host.wildDungeonGate && !(await host.wildDungeonGate(hit, fromLoad)))"`), and the wandering spawner
  stands none there (`spawnStandHost.js:"{ const _wm = cyrodiilMask();"`). A hall is a clone of a real dungeon on an EMPTY pixel -
  never a place's, never beside one, never the sea (WW-C2: `zoneHallsHost.js:"const free = (x, y) =>"` - the
  registry's places - AUDIT TESA II P7/Z7: TESA's past the Bay among them, and the countryside's and the lairs' rolls
  beside them - the continent's own ground whatever the land switch) - so a tier always has its count wherever
  its places are. `src/systems/wild/wildDungeons.js`, pure: the mask, a pixel test and a day
  in, the halls out.
- WHERE: `WILD_DUNGEONS_PER_RING` (10, 8, 6, 4 - `wildDungeons.js:"export const WILD_DUNGEONS_PER_RING"`). Each
  pixel's distance to another ring's or the outside (`wildRingBorderDistance`,
  `wildDungeons.js:"export function wildRingBorderDistance"`) puts the candidates in the ring's middle band (the
  deepest that still holds three candidates a hall); among them a farthest-point walk spreads the halls
  `WILD_HALL_SPACING` (3) pixels apart at least, each next one of the best few by the day's own roll - eased (two
  pixels, one, the whole ring) before the tier is ever short of its count (`wildHallPicks`,
  `wildDungeons.js:"export function wildHallPicks"`).
- THE COST (WILD-FREE, 2026-10-11 - a player's load captured from the installed client: entering the world froze it
  14.5 s, 8.1 s of them the day's first picks, asked by the nearest dungeon's list). `wildHallFree` is the host's
  dearest pixel test - its last word the spawns' plateau (`spawnedDungeons.js:"export function spawnPlateauFloor"`, a
  heightmap kernel summed for a pixel) - and the picks asked it of every pixel of every ring before they cut the band:
  12,564 asks over the real zone (the player's ARENA2, its box 164 x 107), where the band reads 2,628. They ask it now
  where an answer is read, once a pixel (`isFree`): the deepest level holding a free pixel (the old reduce's `maxBd`),
  the band and its lowerings, the whole ring when the band is short. Every client stands the same halls, so nothing
  moves - each step reads the free pixels it read, in the scan's order. Measured over the real zone in node 22: the
  first day 19.2 s -> 4.0 s, the same 28 halls on each of 60 days to the byte; a later day was ~12 ms on both (the
  plateau keeps its answers per pixel). FOUND READING IT: two arms of the law never decide - the two-pixel band (read
  only when the band is short, and by then it IS the band, the floor already lowered to 2) and the whole ring's passes
  (the band's one-pixel pass fills the count whenever the band holds it; a band that does not was the whole ring
  already). They stand verbatim; their mutants are recorded equivalent (`tools/mutants/wildfree.json`).
- WHEN: by the DAY - `wdunDay`, the relay's clock (`WDUN_DAY_MS`, `wire.js:"export const WDUN_DAY_MS"`; the hub's `st`
  carries it, and the client keeps the skew), never a client's own: every player sees the same halls (`wildActiveNow`,
  `world.js:"const wildActiveNow"`). A day gone, its halls leave the index (the one I stand in stays until I leave
  it). With no hub to ask, the day falls back to this machine's clock.
- WHAT: `wildHallStand` (WW-C2: `zoneHallsHost.js:"const standOf = (mask, px, py) =>"`, over the mask it is handed) stands the day's hall in the index - a clone of a template
  (picked by `WDUN_SALT` 7, `wire.js:"export const WDUN_SALT"`) on the halls' own lane of map ids (WW-C2: `WDUN_WORLD_LANE`, a world pixel's key under it - `spawnedHallMapId`), never a
  graveyard's (LocationTypes 12) nor a cemetery's dungeon type (`wildHallTemplateOk`,
  `wildDungeons.js:"export const wildHallTemplateOk"`), named "Elite <template> (x,y)", always ELITE, its tier on it
  (`wildHall`); the host marks the dungeon elite with its ring and its epoch at the door (`wildDungeonElite`,
  `wildHallRing`, `wildHallEpoch`).
- ITS FOES (the owner: "THE DUNGEONS IN THE ZONE HAVE TO HAVE ONLY HIGH TIER ENEMIES! NO RATS/BATS OR OTHER LOWTIER
  ENEMIES!"): every monster of the template's tables outside `WILD_HALL_FOES`
  (`wildDungeons.js:"export const WILD_HALL_FOES"`) is swapped for one of its ring's - the deeper, the worse, the
  heart's Daedra Lords and Ancient Liches - a pure pick by the hall's id and the foe's index (`wildHallFoes`,
  `wildDungeons.js:"export function wildHallFoes"`; `dungeonContext.js:"PVPDUNGEONS: a hall of"`); a water marker
  keeps a water foe (Dreugh, Lamia); the human classes stand at the player's level as ever. Then the elite dungeon's
  scaling, the zone's four times and the ring's share (section 2).
- ON THE MAPS: the halls are place rows of their own (`wildHallSummaries`, `world.js:"const wildHallSummaries"`) - an
  arched door in its frame, the dungeon's footprint, in `HALL_INK`'s oxblood (`inkMap.js:"export const HALL_INK"`) -
  marked for everyone in the zone, explored or not, on the world map and the zone map; a new day re-marks the sheet.

## 13. The hub's record of the halls (PVPDUNGEONS)

What no client may decide the social hub keeps (`server/src/index.js` `_wdun*`, `_wdunWord` at
`server/src/index.js:"async _wdunWord(ws, acct, m, now, a = null)"`), in one small record (`WDUN_KEY`,
`wildLaw.js:"export const WDUN_KEY"` - `{ locks, piles, inside, empty, crows, eps, giants }`), read once a wake and
pruned as it is read (`wdunPrune`, `wildLaw.js:"export function wdunPrune"`). The law is pure (`src/net/wild/wildLaw.js`
wdun*); the hub reads, calls it and writes.

- THE LOCK: an account that leaves a hall - walks out, is unstuck, falls - may not go in again for `WDUN_LOCK_MS` (an
  hour, `wdunLeave`, `wildLaw.js:"export function wdunLeave"`), UNLESS its own remains still lie in that hall: the way
  back to them (`wdunEnter`, `wildLaw.js:"export function wdunEnter"`; `piles`). The client asks at the door and
  awaits the hub's `ok`/`no` (four seconds, then its own memory); HALL-LOCK: its own memory of the lock (set as it
  leaves, `wdunLeft`, `world.js:"const wdunLeft ="`) answers first, so a hub that never heard my way out (a word lost
  on a closed socket) cannot open the door again - and TESTBUILD's god mode, which walks into a sealed door, keeps a
  hall's lock (the owner: "i can still leave and reenter the dungeon as much as i want in the zone").
- WHO IS INSIDE: a heartbeat every `WDUN_HERE_MS` (a minute, `wdunFrame`, `world.js:"const wdunFrame ="`); one silent
  `WDUN_STALE_MS` (three minutes) has left at its last word.
- THE RESET: a hall that has stood empty `WDUN_RESET_MS` (twenty minutes) is wiped as the next account comes in - its
  world room's stored foes and loot forgotten (`_wdunWipe`, `server/src/index.js:"async _wdunWipe(h)"`; the room
  refuses while anyone stands in it, `server/src/index.js:"async _wdunResetInternal"`; AUDIT SCALE II R3-9: every layer of it
  at once, SCALE5d - anyone standing in any layer holds the wipe) - and its EPOCH moves on: every
  client keys the hall's chests by it (`searchLocationKey`, `dungeonContext.js:"function searchLocationKey"`), so a
  reset fills them again for everyone. The halls keep WORLD8's respawn for the rest - half an hour since RESPAWN-30 (DUNGEON-RESPAWN, section 21).
- THE CROWS: a death in a hall (`wdunDie`, `wildLaw.js:"export function wdunDie"`) sets crows over it until the last
  remains in it go (`wdunGone`, `wildLaw.js:"export function wdunGone"`, told by the place room over
  `WDUN_INTERNAL_GONE`), said to everyone online (`cr`). On both maps three small black birds circle each such hall
  (`paintWildCrows`, `wildMapInk.js:"export function paintWildCrows"` - THE CROWS, the owner: "use the first ones we
  had thats enough"). CROW-NEWS (the owner: "Players should get a message about the crows when a player dies"): crows
  over a hall that had none are told to everyone in the zone - "Crows gather over <hall> in <tier> - someone has
  fallen there." on the screen and in the chat (`crowsSay`, `world.js:"const crowsSay ="`) - never to the fallen nor
  the fallen's party (`cr`'s `who`, `wdunWord`, `world.js:"const wdunWord ="`).
- HALL-LOCK MARK (the owner: "It should also show locked dungeons for you with a tiny lock symbol next to it"): a
  padlock beside each hall my lock still shuts, on both maps (`paintWildLocks`,
  `wildMapInk.js:"export function paintWildLocks"`) - none while my own remains lie in it.
- THE HELLO: `wdunState` (`wildLaw.js:"export function wdunState"`) - the day, my locks, the crows, the giants down -
  at the hub's hello (again every ten minutes, and on a new link). The record is bounded (`WDUN_ACCTS_MAX` accounts
  with locks; an empty hall's stamp and an epoch let go after a day and two).

## 14. Journeys to a hall

A hall is no row of the map files (it is spawned, by the day), so every door that reads a place by its row missed it:

- HALL-JOURNEY (the owner: "when i want to travel there with begin journey nothing happens"): the Overworld's place
  summary is the hall's own, always known (`tvPlaceSummary`, `mapPlacesHost.js:"const tvPlaceSummary"`), so it walks to its
  door as to any place's.
- HALL-ARRIVE (the owner: "when i arrive at the Dungeon it shows this thats wrong" - the journey ran on at the door):
  the journey's arrival rect is read off the hall's spawned location (`world.js:"i arrive at the Dungeon"`).
  HALL-ARRIVE2 ("sometimes this still happens make sure this can never happen to appear this travel bar up there"): a
  watch on every journey to a hall, whichever door began it - at its door (its pixel, its ground grown by 40 m) or
  underground the journey is over, the bar closed and the clock back to one, "You have arrived." (`hallArrivalWatch`,
  `world.js:"const hallArrivalWatch"`).
- HALL-HERE (the owner: "happens only when youre already on the dungeon and press begin journey on the pixel where you
  are"): a journey to the hall I stand at is no journey - "You are already there."
  (`world.js:"only when youre already"`).
- HALL-PLATE (the owner: "it also shows as town right now too in white fonts"): on the Overworld a hall wears the
  dungeons' plate alone, never a place's as well (`world.js:"if (!summary || summary.loc?.wildHall)"`).

## 15. The Greater Giants (ZONE-GIANTS)

2026-10-08. The owner: "can you always spawn 2 giants per tier and make em show on the map where they wander around?
dont use the 15% anymore if this is possible" - then "Name the giant Greater Giant which spawns 10 normal gants when
half health", "everyone in the zone should see the same ... that the big giant is a Greater Giant".

- EIGHT, ALWAYS: `WILD_GIANTS_PER_RING` (2) a tier (`wildGiants.js:"export const WILD_GIANTS_PER_RING"`). Each WANDERS
  a pure walk of the relay's clock and the mask (`wildGiantsAt`, `wildGiants.js:"export function wildGiantsAt"`;
  `src/systems/wild/wildGiants.js`): a day's HOME, a free pixel of its own tier (the second of a tier kept apart from the
  first), and legs of `WILD_GIANT_LEG_MS` (twenty minutes) between waypoints within `WILD_GIANT_ROAM_PX` (5) of it
  (`waypointOf`, `wildGiants.js:"function waypointOf"`), each giant's legs out of step with the others'. So every
  client sees every giant in the same place, walking the same way.
- GIANT-FIELDS (the owner: "make sure the giants dont spawn on top of mounts only in a free field"): a tier's walkable
  pixels are the lower half of its free ones by the height map (`WILD_GIANT_LOW_SHARE`,
  `wildGiants.js:"export const WILD_GIANT_LOW_SHARE"`), and a giant stood in the world stands on the flattest open
  spot within 160 m of its place - no slope over ~22 degrees, no crest, never the water, never outside the zone
  (`giantFieldSpot`, `world.js:"const giantFieldSpot"`).
- GIANT-ROCK (RPT1026-MISC, 2026-10-26, a private report, the second sighting: giants standing inside the rocks): the field was the
  height map's alone, and the mountains' rocks (World of Daggerfall's landform pieces, a mesh each in the world collider)
  stand on flat ground as often as not - a Greater Giant, four times a man, and the ten its call brings were stood inside
  them. A spot is asked of the collider now: refused where a solid's face lies within `GIANT_CLEAR_R` (2.5 m) of the
  giant's lower body (`GIANT_CLEAR_LIFT`, 3 m over its feet - the collider's open-space test, `sphereOverlaps`, as a foe
  placed freely is), or where that body is inside a solid whose faces are all farther off (`insideSolid` - a rock scaled
  up holds a giant with no face near) - `wildGiants.js:"export function giantGroundBlocked"`, asked by `giantFieldSpot`
  and by the call's ring (`world.js:"const greaterGiantCall"`). Pinned by `test/systems/wild/rpt1026_misc_giants.test.js`
  (2, the real Collider with a rock filed as the pixel build files one); `tools/mutants/rpt1026_misc.json` (3).
- GIANT-LEASH (the owner: "giant should not be able to walk out of the zone"): every waypoint is one it can walk to in
  a straight line inside the zone (GIANT-LEASH2 - a bay in the border is walked round, never across), a line that cuts
  the edge holds it at the nearer waypoint, and a giant stood in the world that steps over the edge is put back where
  it last stood inside (`giantLeashFrame`, `world.js:"const giantLeashFrame"`). GIANT-RETREAT (the owner: "when
  players try to leash out the giants out of the zone into the non zone area make the giant leash back 200m into the
  zone, as soon as the player steps out of the zone", then: "The giant should heal then yes"): the moment I step out,
  every giant stood here drops me and walks `GIANT_RETREAT_M` (200 m, `world.js:"const GIANT_RETREAT_M"`) back in -
  the deepest of sixteen ways whose whole line stays inside (`giantRetreatGoal`,
  `world.js:"const giantRetreatGoal"`) - and is whole again when it gets there; pressed at the border while I stay
  out, it turns back again every ten seconds.
- STOOD ONCE FOR ALL (GREATER-GIANT ONE-FOR-ALL): each half second outdoors in the zone, a giant whose walk has come
  within `WILD_GIANT_STAND_M` (320 m) of me stands on the ground - by the lowest peer id among the players as near,
  every client asking the same question of the same peers, and never one already streamed to me (`wildGiantsFrame`,
  `world.js:"const wildGiantsFrame"`). Its puppets carry `gg` on the foe stream
  (`exteriorFoes.js:"if (!onWatch && Number.isInteger(f.entity?.zoneGiant))"`), so every client stands it at its size
  and its name; one handed to me as an heir is mine.
- WHAT IT IS: a "Greater Giant" (`GREATER_GIANT_NAME`, `wildZone.js:"export const GREATER_GIANT_NAME"`;
  `foeTitle.js:"if (entity?.wildGiant)"`), four times its size (WILD3), the zone's four times and its tier's share,
  then PVPGIANT's `WILD_GIANT_HEALTH_MULT` (10) on its health and `WILD_GIANT_DAMAGE_MULT` (4) on its blows
  (`exteriorFoes.js:"if (wild && mobileType === WILD_GIANT && zoneGiant != null && !puppet)"`), and twice an elite's
  drop (`exteriorFoes.js:"if (entity.wildGiant)"`). At half its health (`GREATER_GIANT_CALL_AT`), once a life, it
  calls `GREATER_GIANT_CALL` (10) giants of the ordinary kind - the zone's four times, never an elite or a champion -
  in a ring 10 to 18 m about it, each on the zone's own ground, on the fight at once; the ground shakes and it is said
  (`greaterGiantCall`, `world.js:"const greaterGiantCall"`).
- ITS DEATH IS THE HUB'S: a stood giant that falls is told (`gk`); the hub keeps it down `WDUN_GIANT_DOWN_MS` (half an
  hour, `wdunGiantDie`, `wildLaw.js:"export function wdunGiantDie"` - a second report moves nothing) for everyone,
  says so to everyone online (`gd`), and it walks again for everyone at once from wherever its path has got to.
- GIANT-FALL (the owner: "when a giant dies players in the zone get a screen shake and a message popup which they have
  to click away when not in a fight that a giant has fallen. Then the giant skull is crossed"): to everyone in the
  zone the ground shakes, the chat says which tier, and a Plus box with one OK - held while I fight, shown the moment
  the fight ends (`giantFell`, `world.js:"const giantFell ="`; `giantNoticeFrame`,
  `world.js:"const giantNoticeFrame"`; `DecisionBoxWindow`'s `ok`).
- ON THE MAPS (ZONE-GIANTS, the owner: "show the giants as skulls high quality pixel ones please and dont use the same
  method those circly around them look cheap"): each giant a pixel skull where it walks, on both maps, under the
  waypoints (a flag set on one stands over it), its embers burning bright while it stands in my world
  (`paintWildGiants`, `wildMapInk.js:"export function paintWildGiants"`; `wildGiantMarks`,
  `world.js:"const wildGiantMarks"` - a stood one at its body's own place); eleven by ten since GIANT-SKULL2 (the
  owner: "make the skulls a bit smaller", `wildMapInk.js:"the skulls a bit"`); a fallen one crossed out in red where
  it fell until it walks again. On the Overworld a Greater Giant stood near is marked "Giant", as the enemy it is
  (PVPGIANT, `travelViewMarks.js:"PVPGIANT: the zone's"`).

## 16. The zone's other laws (PVPDUNGEONS)

- NO BANKS (the owner: "Players cant use banks in zone and cant buy houses"): the bank's door says "There are no banks
  in the mountains." (`wildNoBank`, `world.js:"wildNoBank: () =>"`; `worldModes.js:"if (host.wildNoBank?.())"`). The
  houses' half is retired: ZONE-HOMES (section 29) sells a house anywhere in the zone.
- NO WORLD EVENTS (the owner: "Do not spawn world events in the PVP zone!"): the Oblivion Gate never takes region 16
  (`gateRegions`, `gateSite.js:"export const gateRegions"`) and every client drops its towns from the day's raids
  alike (`raidingParties.js:"state.raids = raidsForDay"`) - the whole region, cut or not.
- NO REVENANTS (the owner: "No elite or any monster in the zone can be a revenant", then "Only 1 revenant allowed to
  summon in the zone"): a foe of the zone or a Greater Giant is never a revenant's candidate
  (`revenant.js:"if (entity.wildFoe || entity.wildGiant)"`), none returns and no lair stands while I am in the zone,
  and only `WILD_REVENANTS_MAX` (1, `wildLeaf.js:"export const WILD_REVENANTS_MAX"` - COMPANION-DROP: its home the
  drop's law, which drops what that one carries, section 4) sworn revenant walks at my side there - the rest wait
  outside it.
- NO TELEPORT into, out of or inside the zone (section 9), and no /unstuck outdoors there (section 17).

## 17. /unstuck (PVPUNSTUCK)

2026-10-08, the owner: "3 m forward wont help, to the next town will". The chat's `/unstuck`
(`world.js:"PVPUNSTUCK: outside"`):

- OUTSIDE THE ZONE: at once, once every `UNSTUCK_COOLDOWN_MS` (30 minutes, `world.js:"const UNSTUCK_COOLDOWN_MS"`).
  Indoors and underground it is the door out, as before; OUTDOORS it is now the walk to the nearest town - arrived at
  as the guild's teleport arrives, never asked of the zone's travel law, and never a town in the zone or its band
  (`unstuckOutdoors`, `world.js:"const unstuckOutdoors"`).
- IN THE ZONE: refused outdoors ("/unstuck does not work outdoors in the mountains."); in its buildings and dungeons
  after a five-minute wait (`UNSTUCK_WAIT_MS`) under a bar with a Cancel - a second `/unstuck` or `/unstuck cancel`
  cancels too, a death ends it - once every `UNSTUCK_COOLDOWN_ZONE_MS` (an hour,
  `world.js:"const UNSTUCK_COOLDOWN_ZONE_MS"`; `unstuckBegin`, `world.js:"const unstuckBegin"`). Refused, at the start
  and again at the end, while a stranger is within `UNSTUCK_ENEMY_M` (600 m).
- ITS WORDS: the chat's list says both ways out and the cancel ("/unstuck - out by the door you came in, or outdoors
  to the nearest town (/unstuck cancel stops a wait)"), and a line with anything else after it is refused as "/unstuck
  takes nothing after it but cancel." (`hostMisuseText`, `chatCommands.js:"export const hostMisuseText"`).

## 18. The maps, later

- SMOOTHZONE (the owner: "the zone how it is cut out right now smooth it better"): the rings' contours, and the edge of
  a zone of whole cells, are drawn as a pen would - resampled, relaxed toward their neighbours, corner-cut
  (`smoothContour`, `wildZoneMap.js:"export function smoothContour"`), and a wide soft shadow lies under the red line.
  ZONE-LINE (section 27): a zone kept to the pixel - Cyrodiil's - is drawn on its own line, never smoothed off it
  (`wildZoneMap.js:"export const zoneLine"`), and the fog is clipped by that line.
- ZONEINK2 (the owner: "The tier colors when zoomed in on the zone map are overwriting the map too much make it look
  waaaay more high quality and take care of the performance"): the tiers are a WASH - `TIER_WASH`
  (`wildZoneMap.js:"export const TIER_WASH"`), a light pigment each laid with `multiply`, so the sheet's relief, roads
  and grain read through, drawn ONCE a mask into a canvas of its own (`tierWash`); a frame is one drawImage and the
  tiers' thin lines. The rings' plaques are gone from the zone map (its legend names each). And "dont show all
  location names from the beginning when you zoom in": the cities are named at the zone map's fit, the towns from
  `ZONE_NAMES_TOWNS` (1.5, `wildZoneMap.js:"export const ZONE_NAMES_TOWNS"`) of it, every other place from
  `ZONE_NAMES_ALL` (2.2); the legend's "Hide place names" turns them off.
- TIER-SWATCH (the owner: "the tiered colors in the legend look way too similiar", then "change the tier colors
  accordingly to the map in the legend"): four pigments apart - sand, amber, madder rose, plum, each deeper than the
  last - and the legend's swatch is the tier AS THE MAP SHOWS IT, its wash and its shade multiplied on the parchment
  (`tierSwatch`, `wildZoneMap.js:"export function tierSwatch"`).
- ZONE-FIRST (the owner: "when iam in the zone and press V it should open the zone map", then "when you press V in the
  zone it should also center to you same on the world map"): standing in the zone (not underground), the map opens on
  the zone map centred on me, and its World map button opens the world map centred on me
  (`heldMap.js:"iam in the zone and"`).
- ZONE-ZOOM (the owner: "when you click a town or any other POI in the zone out from the world map it dosent zoom you
  in it should always zoom you into the zone map doesnt matter what you click there"): on the world map ANY press
  inside the zone - a town, a hall, a quest's mark, bare ground - opens the zone map first
  (`heldMap.js:"you click a town"`).
- LEGEND-FIT (the owner: "now i have to scroll down in the legend for begin journy make it so that i dont have to do
  that"): the legend's laws scroll in their own box; its foot - Begin journey first - is always in view
  (`wildZoneMap.js:"i have to scroll"`).
- THE BORDER ALIGHT (PVPDUNGEONS, the owner: "the border only burns when you hover over it on the world map not when
  youre already zoomed in on the zone"): a fire of square pixels along the red line while the pointer is on the zone,
  on the world map alone (`paintWildFlames`, `wildMapInk.js:"export function paintWildFlames"`; `_flamesUp`,
  `heldMap.js:"_flamesUp() { return"`). The crows, the giants and the flames redraw the overlay alone, and only while
  something moves.
- FINDME (the owner's screenshot: a full-width red cross): a "Find me" button left of Close - the view glides to my
  pixel and a red cross blinks over it for three seconds (`_findMe`, `heldMap.js:"_findMe() {"`), on the world map and
  the zone map. Not the zone's alone.
  FINDME-TOWN (2026-10-19, a player's private report): and on the town's and the dungeon's sheets, each finding the
  player in its own space, the cross the window's own (`10-UI/Enhanced-Maps-Arc.md` FINDME-TOWN).
  FIND-FIRST (FIELD BUGS 2026-10-10, the Discord: "make 'Find me' the standard functionality on the world map when I
  first open it"): the player's own world map opens as this press (`01-Overview/bugs/Field-Bugs-2026-10-10.md`).

## 19. The mountains walkable (MOUNTAINS WALKABLE)

The Overworld's on-foot mountain rule is gone, everywhere: `openStepBlocked` answers false for every step
(`travelRoute.js:"export function openStepBlocked"`), and the planner's ground refuses no open step and calls no pixel
a peak (`travelRoute.js:"const openBlocked"`), so "The mountains cannot be crossed on foot." never fires. This retires
OW-MOUNTAINS (2026-09-28, Mac: "You shouldnt be able to navigate mountains" - the Mountain climate and a steep rise
refused, `06-Systems/Travel-View.md`) and the World of Daggerfall massifs OW-WOD-PATH made peaks: the host still hands
the planner its rock table (`tvWodRocks`, `world.js:"function tvWodRocks"`, which says the Wrothgarian Mountains'
on-foot rule outside the zone is removed - the patch had for a while let only roads and tracks be walked in region 16
outside the cut), and the planner no longer reads it. Offline too: the law is the planner's, not the zone's. The
words that promised the old rule say the new one: First Person Travel's roads switch is "planned by land"
(`modSettings.js:"'GeneralOptions.FirstPersonTravelFollowsRoads':"`) and the Overworld's Free path is "straight across
country" (`travelPathMode.js:"tipFree: 'Walk straight"`), neither "round the mountains" any more.

## 20. The test build (TESTBUILD)

`TEST_GODMODE` (`world.js:"const TEST_GODMODE"`), false as merged. True, every player is given the staff's /god, /fly,
/heal and /tp (`isStaffT`), and god mode lifts the zone's travel law (`wildTravelGate` free, `wildTeleportRefused`
never), makes a map journey instant (a teleport, from anywhere to anywhere), takes /unstuck at once with no cooldown,
and walks into a sealed door - but never past a hall's hour (section 13). `/godmode` is `/god` for the staff either
way (`world.js:"const staffCmd ="`).

## 21. Riding along (the same merge, outside the zone)

The patch carried the owner's other asks of the same day. Each is the whole game's, online and off unless it says so;
each is a line here, findable by its tag.

- DUNGEON-RESPAWN (the owner: "normal dungeons outside the zone 20mins respawn timer (which timer doesnt reset when
  someone was in and left) for everything and the same for elite dungeons 40 mins respawn timer for everything"):
  WORLD8's respawn (`06-Systems/Online-Arc.md`: a dead foe and an emptied container each back on their OWN clock from
  when it fell or was emptied) at the dungeon's own pace - a normal dungeon twenty minutes, an elite one forty; the
  zone's halls and a Super dungeon keep WORLD8's `RESPAWN_MS` - half an hour since RESPAWN-30 (2026-10-14, Mac: "Reduce
  dungeon cooldown from 1 hour to 30 minutes" - "I meant the chest and foe respawn"; it was the hour) (`dungeonRespawnMs`,
  `dungeonRespawn.js:"export const dungeonRespawnMs"`; `dungeonContext.js:"const _respawnMs"`). Online alone, as
  WORLD8 is.
- HEAL-CURSE (the owner: "Add a button to the temple services under heal disease named heal curse it removes being a
  werewolv and vampire and also removes their positive effects/negative effects and buffs ofc."): the Cure Disease
  priest's second row (key H), under Cure Disease - a row lower where LOOT16's Lift Curse stands - on both skins
  (`guildServiceWindow.js:"HEAL-CURSE: the temple's second row, under its"`, enhancedPorts.js): vampirism and
  lycanthropy cured through DFU's own CureVampirism and CureLycanthropy, and either still in the blood ended with the
  turn it counted toward (`healCurseLift`, `healCurse.js:"export function healCurseLift"`) - every gift and weakness with it -
  for `HEAL_CURSE_BASE` (12,000, `healCurse.js:"export const HEAL_CURSE_BASE"`) through the region's price adjustment
  and the temple's quality (`healCursePrice`, `healCurse.js:"export function healCursePrice"`), a Yes/No box
  (`healCurseBox`, `worldModes.js:"function healCurseBox"`). `src/systems/healCurse.js`.
- REST-WARN (the owner: "Poison/Disease warning on rest, there should be one for when you attempt to rest"): a rest
  begun while a poison or a plain disease works asks first - "You are poisoned." / "Resting will not cure it." / "Rest
  anyway?" (`restAilmentLines`, `restWarning.js:"export function restAilmentLines"`; `src/systems/rest/restWarning.js`),
  the rest window opening on its Yes once the box has left the slot (`world.js:"const bed = _restFromBed, restNow = ()"` - AUDIT RPT1026 L3: with the bed's press read as the toggle runs). Wired in all
  four hosts' rests - the street's, the interior's, the dungeon's and the fixed city's (world.js, worldModes.js,
  dungeonContext.js, exterior.js; the last left out by the patch and wired after it, 2026-10-08, THE FOUR HOSTS RULE -
  `test/systems/pvpdungeons_game.test.js` sweeps all four). REST-WARN2 (the owner: "those are not enhanced
  plus ui button and window"): THE DECISION BOX (`DecisionBoxWindow`,
  `decisionBox.js:"export class DecisionBoxWindow"`; `src/ui/decisionBox.js`) - DFU's message box with its YesNo
  buttons, drawn as the Plus decision dialog under the enhanced skin and DFU's parchment on the classic; Y / N, Return
  is No. GIANT-FALL uses its one-button `ok` face.
- STATS-RESIST (the owner: "Resistances on the stat screen please"): the Stats page's Resistances - each of the seven
  harms' chance to be turned away (`RESIST_ROWS`, `statsCard.js:"export const RESIST_ROWS"`): any Resist effect
  running first, then the saving throw's own chance before its roll (`savingChance`,
  `spellcast.js:"export function savingChance"` - savingThrow's whole law but the dice, so the page and the throw
  never disagree).
- SHOP-HOVER (the owner: "hovering over items in all shops shows the same it does in your inventory"): the pack's own
  hover card over both lists of the shop counter (`showItemHover`,
  `enhancedInventory.js:"export function showItemHover"`), the same comparison against what is worn. SHOP-SIDES (the
  owner: "tooltip of hovering on item in your inventory should be on the left side of shop window and what the shop
  has on the right"): the card stands outside the window, mine to its left, the shelf's to its right. TRADE-STEADY
  (the owner: "when you click on an item a bar with info appears.... its super annoying when you try to sell the
  buttom items cause clicking them causes the bar to appear over them"): the detail strip's room is always kept under
  the lists, so a click never moves the row under the pointer
  (`enhancedTrade.js:"you click on an item a bar with info appears.... its super annoying"`).
- THE HANDS. SWAP-HANDS (the owner: "the game should also let you swap out left and right hand in the inventory (right
  now you have to put both in the inventory again and requip it)"): the two hands' pieces trade by the equip table's
  own hand law - a shield never leaves the left, a right-only or two-handed weapon never the right, one piece crosses
  to an empty hand - one equip act (`canSwapHands`, `equip.js:"export function canSwapHands"`). HAND-DRAG (the owner:
  "dragging and dropping the left hand weapon to the right hand one or when empty should be possible in the
  inventory"): a hand's own panel is a drop target (`handIntent`, `enhancedInventory.js:"function handIntent"`).
  HANDS-COMPARE (the owner: "Damage comparison should now show left and right hand in the item info when hovering"): a
  weapon's card sets it against each hand's (`armourCard.js:"comparison should now show left"`).
- HAND-DROP (FIELD BUGS 2026-10-29, #feature-feedback: "Dragging a weapon from the inventory to the L-Hand slot pushes
  the weapon that was previously there to the right hand and unequips what was your main weapon"): a pack piece dropped
  on a hand's panel goes in that hand and takes off only that hand's piece, in one equip act (`equipItem`'s `hand`,
  `equip.js:"export function mayHold"`; `enhancedInventory.js:"function dropOnHand"`). The drop had worn it where DFU's
  table puts it - the first open hand, else the right - and then traded the hands. A hand that cannot hold the piece
  refuses it on its panel: a two-hander on the left, a shield on the right. A piece put in the left hand takes a held
  two-hander off, as a shield does in DFU. A held piece dragged to the other hand still trades places (SWAP-HANDS).
  Pinned by `offhanddrop.test.js`; `tools/mutants/offhanddrop.json`.
- TRACK-ONLY (the owner: "When you dont track a quest it should never appear on the screen! right now when i dont
  track the main quest it still is shown tracked."): the quest on screen - the card, the compass's mark, the map's
  filled diamond - is the TRACKED one and nothing else (`shown`, `questTracker.js:"shown() {"`); the journal still
  opens on the quest it follows (`06-Systems/Quest-Guide-Arc.md` WHICH QUEST).
- RARE-REAGENTS (the owner: "please add Unicorn horn, Basilisk eye and a Pearl. I couldn't find any of those on any
  Alchemist shop"): every Alchemist's counter shelf always carries one Basilisk Eye, Unicorn Horn and Pearl, minted
  and priced as every row is (`ALCHEMIST_ALWAYS`, `shopStock.js:"export const ALCHEMIST_ALWAYS"`).
- GOTHWAY-BOARDS (the owner: "is it possible to put a bounty board on each site of gothway gardens so newbies have a
  direction!"), GOTHWAY-NORTH ("place them to the north on the border of the town so new player coming from privateers
  hold can see them") and GOTHWAY-LIFT ("the boards are in the ground"): Gothway Garden stands two bounty boards at
  its north entrance, one each side of the road in from Privateer's Hold, a few paces inside the border, facing
  north - the road read off the town's own walk grid (`gothwayNorthSpots`), stood in the town's build each with its foot
  on the ground and counted a bounty board always (`boardSplitOf`). NOTICE-PANEL (2026-10-29, the owner: "remove the
  notice board prop from all cities") took them with every town's board: Gothway Garden's Bounty Board is on its town
  panel now (`01-Overview/bugs/Field-Bugs-2026-10-29g.md`).
- PVPFIX (the owner: "Undeniable Access/lockpicking should actually work on locked crates"): an armed Open spell fires
  on the next lock touched, a crate's as a door's, and the pick is tried in Grab mode too
  (`dungeonContext.js:"Access/lockpicking"`).
- KEEP-SPELLBOOK (the owner: "a player dropped his spellbook apparently"; the hotfix of the same day): the character's
  spellbook (MiscItems 132, not a quest's - `isKeptSpellbook`, `itemTransfer.js:"export const isKeptSpellbook"`) leaves
  the pack for nowhere but the character's own wagon. The store ladder refuses it everywhere else - the ground, a pile,
  a body, a chest, a companion's pack - in its own words, "Your spellbook never leaves you." (`REFUSAL.spellbook`,
  `itemTransfer.js:"if (isKeptSpellbook(item) && !usingWagon)"`), and so does the shift-drop, ahead of a lock's
  "unlock it first" (`shiftDropRefusal`, `physicalItems.js:": isKeptSpellbook"`).
  Neither counter puts it up for Sell or Sell Magic (`nativeTrade.js:"&& isKeptSpellbook(item)) {"`;
  `enhancedTrade.js:"if (selling() && isKeptSpellbook(item)) {"`, and the enhanced counter quotes it no price - its
  `saleRefused`). A death in the zone already kept it (section 4, `wildCanLose`). The player trade's table
  (`tradePack.js` `tradeRefusal`) is untouched: the hotfix closed the ground, the containers and the counters.

## 21b. A party left is no fight for ten minutes (PARTY-TRUCE, FIELD BUGS 2026-10-09b)

The Discord's "you can be teleported into a pvp zone and killed": a stranger invited a new player to his party, led the
party's walk into the mountains and killed them there, and their pack lay on the ground. Nothing was broken - each
door worked - but the doors made a trap: a party mate is never fair (`wildFair`), a kick or a leave ends a party in
the instant, and the walk in (the one door into the zone no journey's gate asks, section 9) never named the zone.

- A player who leaves my party, or whose party I leave, is no fight for `WILD_PARTY_TRUCE_MS` (ten minutes, a walk
  out), both ways (`wildZone.js` `createPartyTruce`, read in `wildFair` beside the party; the zone frame reads
  `social.partyPeers()` each frame and says `WILD_TEXT.truce` in the zone). Each client reads its own party, and INT9's
  referee asks the hub (which keeps the party a record left, `partyWas`, the truce's ten minutes) of every blow, so a
  doctored attacker gains nothing.
- A party's walk that ends in the zone or within its band says so in its question (`world.js` `wildWalkRow`,
  `WILD_TEXT.walkInto`), between the leader's line and "Travel with them?".
- Not done, and the owner's to decide: a floor for new players (a level, a Renown, a first entry acknowledged). A
  guild's members fight nobody of their own guild here (Mac, 2026-10-14, "Guildmates are friends" - section 3).

Pinned by `test/systems/wild/fb1009b_partytruce.test.js` and `test/systems/travel/tv8_party_walk.test.js`; `tools/mutants/fb1009b_partytruce.json`.

## 22. Known limits

- INT9: a modified client can opt out of the zone's fights (never say `zone`) - it fights nobody and drops nothing to a
  player - and a death to a foe is the client's own word (FOE-KEEPS: one that drops nothing); it cannot opt into another's fight, keep a drop the relay's
  fall names (its killer seizes it), or deposit anything the service did not take. A fight across a cell's seam waits
  for one of the two to cross (a fighter's bar is its own cell's), and the rest of lane 2's limits are
  `06-Systems/Integrity-Arc.md` section 5's.
- WILD-REJOIN (section 4): the `down` word answers a socket's zone word, which a page says only standing in the zone
  where it fights (`wildCan`). A page that closed on the death screen and comes back outside the zone, or inside one of
  its buildings, is told nothing until it steps into the zone: it skips the rest of the wait there. The hub keeps the
  carry in memory alone, so a hub restarted inside the two minutes forgets the fall in every other room. A fallen whose
  socket dropped for a moment just as its fall was signed is counted gone (`g` 1): its killer seizes at once, the
  record's lease cleared, and its tab rejoins.
- The maps' hiding is the receiving client's; a guildless player's own mark is never sent in the zone.
- No player fighting inside the zone's buildings; underground no arrow is aimed at a player and no worn piece is
  claimed.
- The halls' day, locks and crows are the hub's: with no hub (an older relay, a lost socket) a client stands the
  halls by its own clock and keeps its own session's locks, and hears no one else's crows.
- ZONE-SAFE (section 26): the relay has no map, so a settlement's peace is each fighter's own word - a modified client
  that says it stands in the zone from a settlement's streets can strike out of them at one who said so, and the honest
  clients' doors, reading its pose in the streets, strike nobody back. The defender's own word protects the defender
  always.

- PARTY-TRUCE (FIELD BUGS 2026-10-09b) is held in memory: a player who reloads forgets the truces they stood in, and
  the hub's record holds them for the referee (INT9).
- A piece in escrow comes back only when its fallen plays again (its tab takes it back - there is no clock that moves a
  record nobody plays); until then it is the escrow's, in no record. A fallen character deleted or dead for good while
  one is held has no record to take it back into, and it stays the escrow's.
- WILD-INSURE (section 4b): a policy names its piece by its key (INSURE-ALL: a plain piece by an id of its own), and
  a policy follows its piece only while this character's record holds it - one traded away lapses at the next insure
  (AUDIT PVP-EASE L1-2), and one traded away and back before it finds its policy as it left it. The classic face's pack
  (the native window) offers no Insure act; the Enhanced Plus pack and its right-click menu do. The card's line is the
  game's read of the policies (at boot, again when the card asks after ten minutes - AUDIT PVP-EASE L4-1): one written on
  another device shows there on the next read, and the service's answer at a fall is the truth either way - the killer's
  offer reads no policy (L2-2).
- REPEAT-SHIELD (section 4c): the fallen's game still shows its worn offer to a repeat killer at the first dead frame (it
  does not know the shield until the service answers), so that killer's pick lands on nothing. The shield is the
  killer's account's: one killer on two accounts is two hands.
- ZONE-GRACE (section 3b): safe passage keeps off players' blows, casts and ships' guns (AUDIT PVP-EASE L3-3) - a foe's
  are its own. The hub keeps the carry in memory alone (4,096 fighters), so a hub restarted forgets every carry: the next
  room a fighter stands in after it reads none, and grants a passage to one that has been away and quiet as far as it
  knows. A relay from before world270 grants none, and a client from before it hears the words as a kind it does not
  know - its blows are refused without a line.
- THE COMBAT LOCK (STORE-KEEPS, AUDIT PVP-EASE L2-1) is the page's: the window refuses the store, and a modified client
  stores as it likes, as it may opt out of the zone's fights (INT9, above). The service takes from the record it judged,
  and storage is in that record - a lock the service kept would need the relay's word on every fighter's last blow.

## 23. What the suite caught (WILD-SUITE, 2026-10-08)

The zone landed without a run of the suite. Four of what it caught were the source's, fixed there:

- THE HALLS STAND FROM ABOVE THE FIRST BUILD (BOOT-TDZ2). The boot's first pixel build asks `spawnedDungeonAt`, and
  in the zone that is a hall's stand - which, with its day, its picks and its templates, was declared fifteen thousand
  lines below the build: on an online boot on a hall's pixel each read was a dead zone, the builder's `try` swallowed
  it and no hall stood. They are built above the builder now (WW-C2: scenes/zoneHallsHost.js, made at
  world.js:"const zoneHalls = createZoneHalls("), handed the mask the builder just read; play's callers keep the
  session's (`wildActiveNow`, `wildHallStand`).
- THE HALL'S GATE WAITS INSIDE THE DOOR'S (AUDIT 68 X3). The hub's word on my lock (up to four seconds) was awaited
  before the transition gate, so a teleport, a Recall or a load inside it did not stale the door; it is asked inside
  the gated build now, and the build re-validated after it (worldModes.js:"the world moved during the hub's word").
- `/unstuck`'s bar stands at the HUD's z 30, not 9999 - over the asset picker (MWFIX 1); the Heal Curse hotkey plays
  the hotkey arm's one click, not a second of its own (AUDIT 26 D1); and the temple's blood curse is `bearsCurse` /
  `healCurseLift`, not the item curse's `isCursed` / `liftCurse` (AUDIT 24, one name one home).

## 24. The open sea past the Veil (ETHER-WILD, 2026-10-21)

The owner: "implement open pvp for this zone specifficaly and implement some of the wrothgarian mountain open pvp aspects
into the procedural Islands" - of the Eltheric Ocean. The zone stands on a second ground: every pixel of the sea's box
but Veilhaven's peace (the Veil, twelve pixels about Veilhaven, and her rows east of her to the Veil - the way home,
AUDIT SEA VENTURES C2), its four depth bands the four rings - the Shallows
I, the Reaches II, the Deep Aether III, the Abyss IV, at `WILD_RING_LOOT` as the mountains' are. The law is
`src/systems/wild/etherWild.js`; its record, and what the sea keeps its own, is `03-World/Eltheric-Ocean.md` ETHER-WILD.

- THE ONE FLAG. `wildFrame` asks the sea beside the mountains (`world.js:"const seaRing = _onlineWorldSession()"`,
  online, past a relay that raises the zone, with the sea standing) and sets the flag with its GROUND
  (`setWildHere(on, ring, kind)`, `wildZoneKind` - 'wroth' or 'ether'): every law of sections 2-11 reads the flag and
  so stands at sea unchanged - the fights and the referee, the foes and their loot by the ring, the packs, the death's
  drop, the remains and the worn pick, the wait, the strangers and the maps' hiding, the zone watch in a freeport's
  streets, no teleport - and since PVP-EASE (2026-10-26) safe passage, insurance and the repeat shield. An isle's ruin is the zone's by its band at its own pixel
  (`wildRingAtPlace`, now `etherWild.js`'s, read by `dungeonContext.js:"const _wildRingRaw = isOnlinePage()"`).
- ITS WORDS are its ground's: `registerZoneWords` (the sea's, registered by its own module so this leaf imports nothing
  of it), `zoneWord`, `zoneName`, `zoneRingName` - the crossing of the zone and of a ring, the HUD tile and its tip, a
  and the death's wait (the death keeps the ground
  it fell on, `setWildDeath`'s `kind`). A word the sea does not say its own way is `WILD_TEXT`'s. AUDIT SEA VENTURES C3,
  C6, C7: the sea says its own of every word the zone's law asks at sea - a party's walk into it, `/unstuck` outdoors,
  a second revenant, a party left, a drop answered after the rise (by the room the fall was in), and the zone gone while
  still past the peace (`quiet`, never "Veilhaven's peace" where she is not); the mountains' `/unstuck` and one-revenant
  words go through the text core (`wild.zone.*`).
- WHAT THE SEA KEEPS ITS OWN: no pace cap (its leagues are its price; STRANGER-PACE still holds a journey); the rise at
  the nearest freeport however far, never the Bay's maps' nearest town (`wildRiseSite`'s first line - AUDIT SEA VENTURES
  C5/F2: past 60 px it rose at Veilhaven); no giants. As the mountains', the linked bank cabin is a teleport refused
  (C1); a wagon on the open sea's ground was with its owner at a death there (C4) until STORE-KEEPS made every cart
  storage. Eltheric-Ocean.md ETHER-WILD names each.
- ITS HALLS ARE THE DAY'S VAULTS OF THE DEEP (SEA-VAULTS, 2026-10-22): four ruin isles of the Deep Aether and three of the
  Abyss a day keep section 13's door - the hub's lock, the way back, the reset and its epoch, the crows - keyed
  `"e<cx>,<cy>"` (`wdunHall` reads both forms; `wdunRoomKey` a room lane of its own, `SEA_VAULT_LANE` - AUDIT SEA
  VENTURES D7, D8: the isle place's own room was its plain ruin's too), world246. The hub's wipe reaches every size a
  hall is laid at, the mountains' halls with them (`_wdunWipe` over `DUNGEON_ROOM_TAGS` - A5). The open sea keeps no
  instance, as the mountains keep none (`seaRoomCell`). Eltheric-Ocean.md SEA-VAULTS.
- ETHER-WILD ITSELF MOVED NO WIRE AND NO DEPLOY: the relay's zone word reads no map - two sockets that both say zone 1
  are refereed wherever they stand, in the peace too (AUDIT SEA VENTURES A9), as on the mountains' edge - and at
  ETHER-WILD the account service's fall read none. The sea's later slices move both (world246; migrations 0146-0148 -
  SEA-BOUNTY's fall reads the sea's box at the service; AUDIT SEA VENTURES F9). A client from before it never says it
  stands in the zone at sea - section 22's first limit.

Pinned by `test/systems/wild/etherwild.test.js`; `tools/mutants/etherwild.json` (35, all dead). SEA-VAULTS:
`test/systems/sea/seavaults.test.js`; `tools/mutants/seavaults.json` (49, all dead). AUDIT SEA VENTURES
(`01-Overview/audits/Audit-Sea-Ventures.md`): `test/systems/sea/auditsea.test.js`; `tools/mutants/auditsea.json`.

## 25. Cyrodiil (WW-C2, 2026-10-24)

The owner: "Cyrodil becomes the new open PvP area with the wrothgarian mountain area being retired in favor of this.
Cryodil will be home to all abundent resources and everything else from the wrothgarian zone." Record:
`03-World/World-Wide.md` WW-C2; the province's resources are WW-C1's (Cyrodiil every province's richness and ore).

- THE ZONE (section 1): the Imperial Province whole, `systems/wild/cyrodiilZone.js` - on the freeware's own picture
  86,152 cells of four inside, 1,379,288 map pixels to the pixel (ZONE-LINE: 1,337,260 the province's land and 42,028
  the water it encloses; the authored rings, which stand in offline where no trace is, 2,003,007), where the mountains'
  cut was some twelve thousand pixels. WHAT IT ENCLOSES IS ITS OWN (AUDIT TESA II
  Z4, `wildZone.js:"export function fillEnclosed"`): the painting's waters within the province - Lake Rumare round the
  Imperial City's isle, the Niben - are the zone's, so the rings run from its outer side alone (the Imperial City stands
  in The Heart; as holes, their shores were the zone's edge and put it in The Borderlands) and a lake is no door (a
  journey from it or to it crossed no line, and its water was nobody's fight). NIBEN-SEA (2026-10-26,
  `03-World/Tamriel.md`): joined to the Topal Bay down the Niben they are enclosed no more, so THE PROVINCE'S OWN WATER is
  the zone's (`cyrodiilZone.js:"export function provinceWaterAt"`: a water pixel with the province's land its nearest on
  both sides of a row or a column, the Waterfront canal's too) - the river's last reach, between Elsweyr's banks, is not. ONLINE, THE TRACE'S ALONE (AUDIT TESA II
  Z8): no zone until the trace lands, and none where it never does - the authored rings' Cyrodiil is 56% of the two
  shapes' union apart from the trace's, and such a client, saying no zone, is in nobody's fight and nobody in its.
  In a dungeon too (`scenes/dungeonContext.js`): NO MASK IS NO ZONE - the mountains' fallback stood a maskless dungeon of
  the zone's region the heart's, so a Cyrodiil dungeon on an untraced client played as the zone's (four times its foes,
  twice its loot) while the zone's door seal stood open; it reads the zone's own mask where none is registered yet
  (`etherWild.js` wildRingAtPlace's `mask`). THE FOUR HOSTS: `scenes/world.js` (the frame, the halls, the rise - every
  reader of the mask copes with none) and `scenes/dungeonContext.js` wired; `scenes/worldModes.js` reads the zone through the
  world host's seams (`wildNoBank`, `wildNoHouse`, `wildDungeonGate`), nothing of its own; `scenes/exterior.js`, offline, stands no zone. The mask's laws are the WILD laws
  on a grid with an origin and a cell (`wildZone.js:"export const maskCellOf"`, `maskWorld`, `ringOfCell`,
  `maskWorldBox`): every law that takes or answers a place takes and answers world map pixels; a mask of cell 1 at
  (0, 0) is a map's own pixels, the pins' plain shapes. `WILD_NAME` is "Cyrodiil" (no article: the zone's sentences
  bring none, the Eltheric Ocean's name carries its own), the rings The Borderlands, The Wilds, The Heartlands and The
  Heart, the kind `cyrodiil`.
- THE HALLS (section 12): `scenes/zoneHallsHost.js`, out of bootWorld (41 logical lines; the ceiling lowered). The
  ground a hall asks is the CONTINENT'S OWN whatever the player's land switch - TAMRIEL2's ground heights and the
  province's climate, as the gates' wet ground reads them - so a client streaming the Bay alone picks the same halls as
  one walking the continent; a place's pixel and its neighbours the world's registry's. A province's tier is tens of
  thousands of cells, so the picks ask the ground of a band, a level or the ring each thinned by the day to
  `WILD_HALL_POOL_MAX` (240) - the law with the thinning off is WILD-FREE's to the hall (`test/systems/wild/
  wildfree.test.js`). A hall stands on its cell's middle pixel; its key is that world pixel's `"x,y"` and its room the
  halls' own lane of map ids - `WDUN_WORLD_LANE` (0xF) in the high four bits over the world's pixel key
  (`wire.js:"export const WDUN_WORLD_LANE = 0xf;"`; the Bay's `WDUN_SALT` lane named a Bay pixel in twenty bits);
  `WDUN_WORLD_RELAY_MIN` - the world-wide relay's one number (`wire.js:"export const WORLD_WIDE_RELAY_MIN"`, 255 on
  WORLD-WIDE's branch; AUDIT TESA II Z2) - a client says a hall's word only to a hub that reads one. A hall's summary on the held
  map carries its own pixel (`overworldModel.js:"export const summaryPixel"` - an id's `y * 1000 + x` names a Bay
  pixel alone).
- THE GIANTS (section 15): their ground asked lazily - a home is the lowest free cell of eight its day draws, a
  waypoint the low half of the cells about the home (GIANT-FIELDS, the home's own ground's where it was the tier's) -
  never every cell of a tier (WILD-DRY's freeze, at a province's size).
- THE MAPS (sections 6, 18): the held map paints the zone's fog, red line and rings OVER the continent's ink (they were
  under the Bay's marks), and the zone map always on the continent whatever the switch; the inks are laid on the world
  at a few canvas pixels a cell, a province's wash held to its pixel budget. The classic map's zone layer retired.
  AUDIT TESA II (2026-10-25, `03-World/Arena-Provinces.md` MAP-LINES): the day's halls are inked OVER the fog (M4 - as
  the Bay's own marks they had gone under it); offline, where the map draws the zone and none of its laws runs, the key,
  a press on the zone and the zone map's legend say so (M5, `heldMap.js:"_zoneLaws() {"`); and the legend's travel law is
  Cyrodiil's - no fast travel or carriage reaches it or runs inside it - where the Wrothgarian zone's said its carriages
  ran every ten minutes and its journeys went from the zone map (`wildZoneMap.js:"export function zoneRules"`).
- THE PIXEL PAST THE BAY: a world point's map pixel is FLOORED (`streamingWorld.js:"x: Math.floor(worldX / NATIVE_PIXEL)"`,
  `mapsFile.js` worldCoordToMapPixel, the wire's `mapPixelOfWire` and `cellRoomOfWire`, the serpent's
  `sitePixelOfNative`) - DFU's truncation to the bit on the Bay, where every coordinate is non-negative; past the
  Bay's west and south edges truncation named the next pixel toward the Bay, and a player standing on one of Cyrodiil's
  halls read the pixel north of it.
- NO WORLD EVENT IN THE ZONE: a theatre's gate never opens in Cyrodiil's areas (`theatreGateSite.js` theatreGateAreas -
  Cyrodiil's lane stands no gate); the raids' towns of region 70 are dropped as region 16's were. The Wrothgarian
  Mountains are an ordinary region again: the Bay's gate may open there, and the Daughters of Wroth work the Starfall's
  rite again (thirteen covens - `starfallCovens.js`).
- NO TELEPORT ACROSS ITS LINE (AUDIT TESA II Z5): a Portal Stone's portal is a teleport like the guild's and Recall
  (PVPDUNGEONS' "of any kind") - never opened in the zone, never to a place in it, never stepped through into, out of or
  inside it, but at a settlement (section 28; `06-Systems/Portal-Stone.md`, The holds).
- KNOWN LIMITS (recorded on main; AUDIT TESA II re-read it on TESA's branch, 2026-10-25): on main Cyrodiil held no
  towns, dungeons or roads. Folded into TESA it stands its own (TESA's cities, towns, villages, the countryside, the
  lairs and the roads past the Bay) - and two sentences here were false there. "Every hall, rise and map read here takes
  them when they do": the rise read MAPS.BSA's rows alone (`nearestSafeLocationAnywhere`), so every death in the zone -
  a foe's in its ring too - rose at a Bay town 876 pixels and more away; AUDIT TESA II P3 (Z3): it reads the one law of
  the nearest town of the world (`systems/deathRespawn.js` nearestSafePlace over the registry, TESA's places on it -
  `scenes/tamrielPlacesHost.js` nearestTownOf), a foe's death rising at a town of Cyrodiil in its ring, a kill's at the
  nearest town outside the zone. And the halls stood nowhere: past the Bay the world host's build asked TESA's places
  first and never the zone's stand (AUDIT TESA II P1, Z1: `scenes/world.js` _locationToBuild asks the day's hall first,
  `zoneHallsHost.js` standIn), and their ground kept off the registry's places alone, none of them past the Bay (P7, Z7:
  TESA's places registered, the countryside's and the lairs' rolls asked beside them, `standsToo`; a hall never stands
  over a place it did not make). The zone's carriages still have no road to run between its towns. A player reaches
  Cyrodiil only with the land beyond the Bay on (TAMRIEL2's switch); the zone is the same for every client either way - online, every client with the trace landed
  (AUDIT TESA II Z8).

## 26. Safe streets (ZONE-SAFE, 2026-10-25)

The owner: "Btw with the pvp changes. All cities should be considered safe zones" - and, asked which places, "Every
settlement". In the open zone - Cyrodiil, and the open sea past Veilhaven's peace - no player's blow or spell lands on
one who stands in the streets of a city, a town or a village, and none struck from there lands on anyone: the Imperial
City, the city-states, Arena's towns and villages past the Bay, the countryside's hamlets and villages, an isle's port
town. The open country, the roads, the dungeons (a city's own too) and the zone's halls are the zone's as they were.

- THE LAW, ONE HOME (`systems/wild/zoneSafe.js`, `zoneSafe.js:"export function settledAt"`): Daggerfall Unity's location
  test over the place a point stands on - the location its OWN map pixel stands in the world host's index (the Bay's
  rows; past the Bay TESA's places as their pixels stand them), of a settlement's kind, and the point within that
  location's footprint widened one city block (PlayerGPS.PlayerLocationRectCheck, `PlayerGPS.cs:668-716`;
  `streamingWorld.js:"export function isInLocationRect"`). The kinds are the three DFU names towns -
  `zoneSafe.js:"export const SETTLEMENT_TYPES"`: TownCity, TownHamlet, TownVillage. DEPARTURE (Ledger A, ZONE-SAFE):
  DFU's IsPlayerInTown (`PlayerGPS.cs:504-527`) counts four more for its rest and its watch - HomeFarms, HomeWealthy,
  Tavern, ReligionTemple - and they are no settlement: a farmstead, a manor, a roadside inn and a temple each stand alone
  in the open country, in Cyrodiil's roll too (`tamrielCountry.js:"export const COUNTRY_TYPES"`), so as towns they
  would stand a refuge on every road. They keep the zone's watch (section 3, ZONE-WATCH). A lair, a graveyard, a coven, a cult's
  shrine and a poor home are neither.
- MY WORD (`world.js:"const wildCan = (streets"`): outdoors in a settlement's streets I may fight no one, so my word on the
  zone to the referee is 0 (INT9 - `world.js:"setWildZone?.(wildCan() ? 1 : wildCan(true)"`) and
  the referee, which lands a blow only where both fighters said they stand in the zone
  (`wildRef.js:"export function wildBlow"`), refuses every blow and cast into the streets and out of them. A fighter who steps into the streets is
  away from the zone as the referee reads it: whole again `WILD_REF.awayMs` later. THE RELAY IS UNCHANGED (no wire, no
  relay version): it has no map, and the defender's own word protects the defender (section 22's known limits).
  Now 2 there: a villain is fair from them (PvP-Rework.md PVP-SAFE-HIT).
- EVERY DOOR (`world.js:"const wildFair = (peerId) => {"`): no body whose shown pose stands in a settlement's streets is
  fair, so the melee arm, the arrows and the cast engine's marks pass it by; underground the zone fights as it did - a
  body's pose there is the dungeon's own frame, never a street.
- THE WORDS (`zoneSafe.js:"export const ZONE_SAFE_TEXT"`, through the text core, every language): the streets entered in
  the zone are said ("You are in the streets of a city, town or village: a safe zone. ...") and left ("You leave the safe
  streets. ..."), mid-screen and held as a crossing is (`wildSay`); leaving the zone from the streets says the zone's own
  line alone, and a building keeps the word I had (no player fights under a roof, so a door is no crossing). The HUD's
  zone tile reads "Safe zone" there; the zone's tip, the zone map's laws and the world map's key say where the peace is.
- THE FOUR HOSTS: `scenes/world.js` WIRED (the word, the doors, the frame, the tile); `scenes/dungeonContext.js` NOT
  WIRED on purpose - the dungeons stay the zone's, and its swing and casts read the world host's `wildBodies` and
  `wildStrike`, so its fair players are the doors' own; `scenes/worldModes.js` NOT WIRED - no player fights in a building
  (wildCan's outdoors arm); `scenes/exterior.js`, offline, stands no zone. bootWorld three logical lines shorter (the
  crossing's three sayings one `wildSay`, a dead line of the frame gone).
- NO COMBAT TIMER: the streets are peace the moment one stands in them, as the owner said - a fighter losing a fight in
  the open may run for a town's gate. One who reaches the streets alive and falls there to a foe is nobody's kill:
  FOE-KEEPS E2's credit rides the word that leaves the zone dying (`dd`), and the word said at the streets' edge was
  said alive.

Pins: `test/systems/wild/zonesafe.test.js` - the law over synthetic places on the Bay, in Cyrodiil and west of the Bay,
over every MAPS.BSA row and TESA's clones of them; the referee; the host's doors and frame and tile run as they stand;
the watch; the words in German - `tools/mutants/zonesafe.json` (25, all dead).

## 27. The zone is the province, to the pixel (ZONE-LINE, 2026-10-26)

The owner: "Also ensure the pvp border outlines cyrodil perfectly, currently it doesnt".

- WHERE THEY PARTED (measured on the freeware's picture, its fit 589, 883.5 at 15.5 map pixels a picture pixel): the zone
  was a grid of four-pixel cells, a cell whole where its middle pixel was the province's (WW-C2) - 9,012 map pixels of
  Cyrodiil's box apart from the province's own law (`worldGrid.js:"export function theatreAt"`, with the water it
  encloses): 4,078 of the zone's past the province, 4,934 of the province's outside the zone, its edge a 3.3 km
  staircase up to 2.8 pixels off the province's. Its red line was that staircase smoothed (SMOOTHZONE), up to 3.7 pixels
  off the law; and the province's own line on the held map (REGION-LINES 2, `ui/tamrielInk.js` tracedChains) was the
  picture smoothed another way (TAMRIEL4's corner cut), up to 12 pixels off the law at a corner - the red line and the
  province's line up to 11 pixels apart, 1.9 on the mean: two shapes, neither of them the law. The law is the trace's:
  theatreAt reads the picture at a pixel's middle, a picture pixel 15.5 map pixels a side, and the ground past the Bay
  stands on the same picture (`tamrielGround.js:"export function authoredHeightByte"`) - the province's own edge, the
  coast and the borders alike, is a staircase of 12.7 km steps.
- THE ZONE TO THE PIXEL (`wildZone.js:"function pixelBits"`; `buildWildMask`'s `pixelIn`): each cell keeps its sixteen
  pixels as bits, and every ask of a place - `wildInside`, `wildRingAt`, a fast journey and its fee, a hall's, a
  dungeon's (`etherWild.js` wildRingAtPlace), the frame's word to the referee - reads its own pixel's bit. THE
  PRE-TEST: the law is asked at every cell's middle, and a cell whose eight neighbours' middles all answer as its own is
  that answer whole; every pixel of the rest is asked - exact for a law constant over squares wider than two cells (a
  picture pixel is fifteen map pixels and more a side, FIT_PPUS): 5,584 cells asked a pixel at a time, 1,733 of them
  holding both. What the zone encloses is filled at the pixel (Z4's law: a pixel's sides alone a way out). After: 0
  pixels apart - 1,379,288 the zone's - and on the authored shape (offline, untraced) 0 apart too.
- THE CELLS STAND: a cell is inside where its middle pixel is, as before - all 214,928 cells and their depth as they
  were on the freeware's picture - so the rings, the halls' picks and the giants' tiers stand where they stood. A zone
  pixel of a cell whose middle is out is the edge's ring (The Borderlands); a pixel past the line is in no ring,
  whatever its cell. The hiding band and the box take every cell the zone touches. A giant's walk and its leash ask the
  pixel under it too (`wildGiants.js:"const giantIn = (mask, cx, cy)"`): a cell whose middle is the province's may hold a pixel or two
  past the line, and a giant walked them: on the freeware's picture 68 of 691,200 places over thirty days (30 s apart)
  stood past it, none now; 4,121 of those places moved, a giant's walk by the border (every client's alike).
- ONE LINE (`cyrodiilZone.js:"export function zoneLineOf"`): Cyrodiil's outline on the traced picture - its land and the
  water it encloses, against the rest - laid on the world. The red line, the fog's cut and the zone map's outer ring
  and wash draw it unsmoothed (`wildZoneMap.js:"export const zoneLine"`), and the province's own ink draws it in place
  of its own there: `tracedChains` keeps no border with Cyrodiil on one side (`keeps`), leaves Cyrodiil's open coast to
  the line (`cutCoast` - in a square of four pixel middles the line crosses, the coast is the pixels' own sides from the
  picture's corner, so a lake's shore stays and a neighbour's coast ends on the line's corner), and lays the line's
  coast runs among its coast and its border runs among its borders. Measured: every point of the red line on the
  province's ink (0 apart), and a map pixel the zone's exactly when its middle lies inside the line - 0 of the box's
  3,489,830 apart (the line is the picture's own edge; a pixel's staircase lies within half a pixel of it).
- THE REFEREE is unchanged (`wildRef.js:"export function wildBlow"`): a blow lands where both fighters said they stand
  in the zone, and each says so by the pixel's law now (`world.js:"const here = seaRing > 0"`). No wire, no relay
  version.
- THE FOUR HOSTS: `scenes/world.js` (the frame's word, the halls, the rise, the maps) reads the law through the mask,
  nothing of its own changed; `scenes/dungeonContext.js` reads a dungeon's pixel through `wildRingAtPlace`, the same law;
  `scenes/worldModes.js` reads the zone through the world host's seams; `scenes/exterior.js`, offline, stands no zone.
  No host grew.
- RECORDED: the mask's build asks the law 89,344 times more and walks the outside to the pixel - 202 ms against the
  cells' 118, the best of five on a shared machine under load, once a picture. Cyrodiil's outline on the held map is
  the law's staircase now, where every other province's line keeps TAMRIEL4's smoothing: the province is the picture's
  pixel (theatreAt, the ground), and drawn smoothed it was a line no law followed. Whether the province's own law should
  become the smoothed outline - the ground, the regions and the zone with it - is the province's arc's call
  (`03-World/Tamriel.md`), not the zone's. The line is the picture's alone: theatreAt answers the Bay's own rectangle
  before the picture, and Cyrodiil's box lies 38 pixels east of it.
- SMOOTH-LAND (2026-10-26, `03-World/Tamriel.md` SMOOTH-LAND; the owner: "Whatever is most detailed") made that call:
  the province's own law is the smoothed outline now - theatreAt, the ground, the regions and the zone with it - and the
  zone's line is the law's own (`cyrodiilZone.js:"export function zoneLineOf"`): the law's line pieces (`world/tamriel/
  tamrielLines.js` lawLines) whose two pixels the zone parts, each a coast or a border by what lies past the zone. No
  `keeps`, no `cutCoast`: the held map's ink leaves the zone's pieces to it by their keys, so a neighbour's coast and
  border end where the law's three labels meet, on the line. The mask is built as before, a pixel at a time from
  theatreAt (280 ms on this machine); its line is made the first time a map asks it (200 ms, the law's lines shared with
  the held map). Measured on the freeware's picture: a map pixel the zone's exactly when its middle lies inside the red
  line, 0 of the box's 3,486,060 apart; no zone pixel on another province's land.

Pins: `test/systems/wild/zoneline.test.js` (5 - the pixel's law over 81 offsets of a picture-like law and at the grid's
edge; the cells as they stood, the edge's ring, a journey by the pixel; the giants and the halls inside to the pixel; the
province's ink the zone's line on a small picture; the whole of it on the player's own picture) - `tools/mutants/
zoneline.json` (28, all dead; SMOOTH-LAND re-aimed eight and retired two - 26). PINS MOVED: `test/world/worldWide/wwc2_zone.test.js` (every pixel the province's own;
the edge on the pixels' corners, a ring's line on the cells'), `test/world/tamriel3.test.js` (the ink's coast: the
continent's in two pieces ending on the Imperial Province's corners, and the zone's two shores - seven chains, four
before). Mutant records re-aimed by content: `wwc2.json` (2), `audittesa2z.json` (1), `tamriel3.json` (2), all dead.

## 28. Teleports at the settlements (WILD-CITY-PORT, 2026-10-28)

The field, after TESA's release: players could not teleport to the Imperial City. The owner: "Even with the open pvp,
players should be able to teleport in and out of the cities". Three doors refused it: the zone's teleport law, the
journey's law a teleport also passed, and the teleport map's press.

- THE LAW, ZONE-SAFE'S HOME (`zoneSafe.js:"export function zonePortFree"`): a teleport passes the zone where each end is
  none, outside it, or a settlement's - section 26's every settlement (`zoneSafe.js:"export const isSettlement"`). The
  end it lands at is the place the world host stands on its pixel
  (`spawnStandHost.js:"function _locationToBuild(px, py)"`): a capital's slice, a TESA city, town or village, a
  countryside hamlet. Where I stand: outdoors, a settlement's
  streets (settledAt, so a hamlet's own pixel past its streets is the open country); indoors, a building of one; in a
  dungeon, never - it stays the zone's. The rest of the zone keeps PVPDUNGEONS' law, said in words that name the open
  ends ("In Cyrodiil you can teleport only to or from a city, town or village. Walk or ride its roads.").
- EVERY TELEPORT TAKES IT: the guild's (`teleportTo`), Recall, a Portal Stone's door, pick and step, a party's journey to
  its leader and the linked bank cabin all ask `world.js:"const wildTeleportRefused"`. A teleport is no journey
  (`pastBayTravel.js:"export function teleportJourney"`): the zone's journey law - its in and out, its ten minutes, its
  fare - is the journeys' alone, so a teleport between two settlements in the zone costs nothing more.
- THE MAP: online, ZONE-ZOOM opened the zone map at any press inside the zone, the teleport map's too, so the guild's map
  and a stone's never picked a city there. On the teleport map a city in the zone is a portal's end now
  (`heldMap.js:"_portalCityAt(sx, sy) {"`); its bare land still opens the zone map.
- WHY THE SETTLEMENTS: a teleport into the zone lands in streets no player fights in, so an arrival is never a kill
  (section 21b's report), and one out of it leaves from where no fight reaches - no more of an escape than the run to a
  town's gate section 26 allows. Past the Veil nothing moves: the Veil refuses every teleport across it.
- THE FOUR HOSTS: `scenes/world.js` WIRED (the law asked where the zone's refusal stood; bootWorld's length unchanged);
  `scenes/worldModes.js` and `scenes/dungeonContext.js` NOT WIRED - a building's and a dungeon's teleports are the world
  host's own; `scenes/exterior.js`, offline, stands no zone.
- WHERE IT LANDS (AUDIT TAMRIEL-WIDE E1, 2026-10-28): a Recall, a party's jump to its leader and a ship's cabin land
  at a point, not at a city - the arriving end is that point in a settlement's streets (`systems/wild/zoneSafe.js`
  landsSettled, settledAt's own law over a pixel not built), so a Mark beside a village's walls is the open country. A
  guild's and a stone's pick land at the city, and keep the pixel's test. Unflagged, a stone asks none (PVP-FLAG; III
  F1/M2).
- KNOWN LIMIT: the refusal's words are English alone, as they were (`test/systems/l10n4_hardcoded.test.js` counts them).

Pins: `test/systems/wild/wildcityport.test.js` (the law over every kind of place, the streets, a building, a dungeon),
`test/systems/portalbay_stone.test.js` (WILD-CITY-PORT: every teleport over the Imperial City's own slices),
`test/ui/audittesa2m_window.test.js` (the teleport map's press) - `tools/mutants/wildcityport.json` (7, all dead). PINS
MOVED: the refusal's words (`portal1_stone.test.js`, `portalbay_stone.test.js`), the press's source (`tesa2_arena.test.js`);
mutant records re-aimed by content: `portalbay.json` (3), `audittesa2m.json` (1), `tesa2.json` (1), all dead.

## 29. Houses for sale in the zone (ZONE-HOMES, 2026-10-28)

The owner: "Imperial City houses still cannot be purchased". IC-HOMES (`06-Systems/Economy-Arc.md`) gave the city's
houses a price, but PVPDUNGEONS refused every house in the zone - Cyrodiil whole, the Imperial City in The Heart - so the
door offered **Buy it** and the press refused it. A first pass sold a settlement's house alone and an audit refused every
isle town's; the owner: "You made it where you cant buy a house in the ocean or in the open country. Why?" - "I did not
ask for that".

- THE LAW: the zone refuses no house. The `wildNoHouse` seam is gone from `world.js` and the buy
  (`worldModes.js:"async function buyHomeAt(bd, price) {"`) asks nothing of the zone - in Cyrodiil's cities and its open
  country, and on the sea past Veilhaven's peace alike. Banks stay refused in the zone (section 16).
- THE ISLES: an isle town's house is for sale online as any town's (`onlineHomes.js:"export const homePurchasable"`). The
  bank's list still names none and a Betony deed still owns none (`03-World/Eltheric-Ocean.md` P9).
- THE FOUR HOSTS: `scenes/world.js` (the seam removed) and `scenes/worldModes.js` (the buy's line removed) WIRED;
  `scenes/dungeonContext.js` has no house door; `scenes/exterior.js`, offline, stands no zone.

Pins: `test/systems/wild/zonehomes.test.js` - `tools/mutants/zonehomes.json` (2, all dead).

## Pins

`test/systems/wild1_zone.test.js`, `test/net/wild1_wire.test.js`, `test/net/wild1_fight.test.js`, `test/systems/wild2_rings.test.js`,
`test/systems/pvpdungeons_game.test.js` (the halls' placement and foes, HEAL-CURSE, REST-WARN, SWAP-HANDS, GOTHWAY-BOARDS,
ZONE-GIANTS' walks and the hub's giants, GIANT-FIELDS, GIANT-LEASH, CROW-NEWS, DUNGEON-RESPAWN, GREATER-GIANT,
WILD-KEEPOUT, KEEP-SPELLBOOK - `tools/mutants/keepspellbook.json`, 9, all dead), `test/net/pvpdungeons_hub.test.js` (the `wdun` wire, the lock, the way back, the reset, the crows, the
relay's hub and no friend's take); the host seams of section 23 in `test/scenes/bootorder.test.js`,
`test/scenes/audit68_worldmodes.test.js`, `test/systems/automap/mapkeep.test.js`, `test/scenes/mwattach.test.js`, `test/ui/audit26_uiwindows.test.js`
and `test/systems/talk/audit24_onehome.test.js`; `tools/mutants/wildsuite.json`; LETTERS-DROP and KEEP-WALLET in
`test/systems/wild1_zone.test.js`, `tools/mutants/keepwallet.json`. INT9 (the zone refereed, a death's drop taken off the record):
`test/net/int9_wild_ref.test.js`, `tools/mutants/int_lane2.json` (`06-Systems/Integrity-Arc.md` section 5). PVP-LOOT (the
killer's worn piece theirs whoever the fallen's guild or party counts them, end to end over the game's own pieces):
`test/systems/fb1014_pvploot.test.js`, `tools/mutants/fb1014_pvploot.json`. Mac's two decisions of 2026-10-14 - guildmates kin,
the two-phase handoff - end to end through the real relay room, account service and clients:
`test/systems/fb1014_pvpescrow.test.js`, `tools/mutants/fb1014_pvpescrow.json`. STORE-KEEPS (the cart and the companions'
packs never taken - PIN MOVED from CART-AWAY's and COMPANION-DROP's pins, in their own files: through the real drop law, the
real Horse Cart and Cargo runtime's records in every way a wagon stands, the real naval host's party, the real feud's
sworn and the real account service): `test/systems/fb1015_cartaway.test.js`, `test/systems/fb1019f_companiondrop.test.js`,
`tools/mutants/storekeeps.json`. WILD-INSURE and REPEAT-SHIELD (the law, the real account service, the book and the words):
`test/systems/wild/wildinsure.test.js`, `tools/mutants/wildinsure.json`. ZONE-GRACE (the law, the real relay room, the wire
and the client's words): `test/net/zonegrace.test.js`, `tools/mutants/zonegrace.json`. FOE-KEEPS (a death to a foe drops
nothing; a kill's tenth): `test/systems/wild/foekeeps.test.js`, int9's FOE-KEEPS THE SERVICE, `tools/mutants/foekeeps.json`. ZONE-SAFE (a
settlement's streets are peace, section 26): `test/systems/wild/zonesafe.test.js`, `tools/mutants/zonesafe.json`.
AUDIT FOE-KEEPS (`01-Overview/audits/Audit-Foe-Keeps.md`): `test/systems/wild/auditfoekeeps.test.js`,
`test/net/auditfoekeeps_relay.test.js`, `tools/mutants/auditfoekeeps.json`. ZONE-LINE (the zone the province to the pixel, one line drawn for both - section 27):
`test/systems/wild/zoneline.test.js`, `tools/mutants/zoneline.json`. WILD-REJOIN (`01-Overview/bugs/Field-Bugs-2026-10-25h.md`):
`test/systems/wild/wildrejoin.test.js`, int9's WILD-REJOIN THE SERVICE, `tools/mutants/wildrejoin.json` (22, all dead).

WILD-REMAINS-LOSS (`01-Overview/bugs/Field-Bugs-2026-10-25h.md`): `test/net/wildremainsloss.test.js`,
`tools/mutants/wildremainsloss.json` (9, all dead); WILD-HUBLESS `test/net/wildself.test.js`,
`tools/mutants/wildself.json` (2, all dead).
