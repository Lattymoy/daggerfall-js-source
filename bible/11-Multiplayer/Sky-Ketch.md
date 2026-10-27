# The Sky-Ketch - a Rourken airship over Daggerfall, and its raid (KETCH)

> Design page and record. Written 2026-10-24 with the code, as built; its live run's findings are section 15. The code's
> comments cite this page by section number; where the page and a pin disagree, the pin is what runs.

## What the owner asked for

The owner, 2026-10-24: *"A new quest line and world event that takes you to the skies with proper lore. A proper dwarven
airship flies in once a week over the skies of daggerfall, and you, along with other players venture into it in a raid
like format. Adapting aspects from all the raid like mechanics and details we have developed this far and implement a
new mechanic where players have to pick up an item and bank it to progress. The ending should be a proper dweamer boss,
there should be platforming. Really go all out for this. Imagine navigating the ketch of destiny? Different rooms with
different encounters. A chance to drop both guns with a gilded version of each gun."* Then: *"Make the dwarven event 8
player"*. And of the guns: *"Reduce the drop rate of gilded weapons across the board and ensure any gun drop is rare,
only found within this activity"* (`06-Systems/Gilded.md` section 10).

So, as decided here:

- **Online only, on the real clock.** The Ketch is a fact about the shared world, like the gate and the Hour: she comes
  every ten real hours (KETCH-EVERY, below - she first came every real Saturday at 00:00 UTC), never by the online
  calendar, which runs twelve game days a real day, so no line names a day of Tamriel's week (AUDIT KETCH L5-3). The
  relay runs each crew's ship and signs each earner's receipt, and the account service pays each voyage's share.
  Offline there is no Ketch.
- **One party, one ship.** A crew is a party - eight at most, the party's own bound (`net/wire.js` PARTY_MAX) - and each
  crew boards its own copy of her (an instance, `11-Multiplayer/Instances.md`'s law): the captain's ship, the captain's
  party aboard. A member rides back up to the ship it was taken into, whoever leads the party since (AUDIT KETCH L1-6,
  `ketchShipChoice` - the room's `st` naming it keeps the ship on the device; its door saying it is not of that crew
  forgets it).
- **Rooms, each its own fight.** Six stages in the order a crew takes them (section 4): the Boarding Watch, the Gallery
  of Hammers, the Starved Engine, the Sailwalk, the Tonal Warden, the Ketchmaster's Cabin.
- **The new mechanic is the cells** (section 6): the engine eats aether cells a crew carries to it by hand - slowed, its
  weapon put up, a blow knocking the cell loose - and the Warden's Discord is put right the same way.
- **The platforming is the Hour's own course law** (the Sailwalk, section 3), outboard over the open sky.
- **The Dwemer boss** is the Tonal Warden (section 7), the Brass Remnant's fight rung for rung.
- **The guns are found here alone** (section 9): the Dwarven Thunderlock and the Dwarven Pistolet, and a Gilded version
  of each, in the hold's share.

Daggerfall has no airship, no other players and no raid, so none of this is a DFU member. Its Ledger A row is KETCH.

## 1. The lore - canon, and the port's own

**Canon** (the player's own data and the series): the **Rourken**, the Dwemer clan that would not join the Chimer
against the Nords, threw **Volendrung**, the Hammer of Might, and built their new home where it fell; the Dwemer
**vanished, every one, in a day** (the Battle of Red Mountain), and their constructs kept at their tasks - Morrowind's
ruins are kept by them still; **aetherium**, the Dwemer's blue crystal, mined and fought over; the **Numidium**, the Brass
God, raised by Tiber Septim and broken, its pieces lost about the Iliac Bay - the Daggerfall of 3E 417 is a game of the
Brass God's pieces.

**The port's own**, each said as such where it is said: the **Mzunthar**, a Rourken sky-ketch of tonal brass that never
landed after its masters went, flown by its steersman, the **Tonal Warden**, on the course it was last given - over the
Iliac Bay, a week round; its **anchor-lift**, let down to the fields east of Daggerfall while it keeps station;
**Imrah Bel-Tavir**, an antiquarian of Sentinel who wants to know what brought her down (section 13); and her reading
that the ship's **lodestone**, tuned to great masses of Dwemer brass, answers the Numidium's pieces - hers, never the
canon's word. Her two books (`systems/portBooks.js`): *The Ketch That Never Lands* (419) and *Rourken Thunder* (418,
on the guns - `05-Combat/Dwarven-Thunderlock.md` GUN-LORE).

## 2. The voyage on the clock, and the Ketch in the sky

**The law** (`net/ketch/ketchLaw.js`): voyage 0 arrives **2026-10-25 at 00:00 UTC** (`KT_EPOCH_MS`) and every voyage
**ten hours** on (`KT_EVERY_MS`). She is **sighted** an hour before (`KT_SIGHT_MS`), **keeps station** seven hours
(`KT_STATION_MS`), then **weighs anchor**: the crews aboard have forty-five minutes more (`KT_LAST_MS` - twenty before
AUDIT KETCH II L5-1, shorter than a KETCH-LONGER voyage), and then she is gone for an hour and a quarter before she is
sighted again. Ten hours does not divide the day, so her arrivals walk
round the clock: 00:00, 10:00 and 20:00 UTC on the first day, then 06:00, 16:00 and 02:00, and so on through every
time zone's evening.

**KETCH-EVERY** (the owner, 2026-10-24: *"Can we make this happen every 10 hours. First one to spawn after this goes
live"*): she came every real Saturday at 00:00 UTC for a day and a half (`KT_WEEK_MS`), and comes every ten hours now.
Voyage 0 is the first after she goes live (nothing of her was deployed before it). The share is still once a voyage
(`ketch_voyages`' key, voyage and account), so a hand can earn about seventeen a week where it earned one; the hold's
rates (section 9) are unchanged. A receipt still keeps a week (`KT_RECEIPT_TTL_S`). The words on every screen say
"every ten hours", drafted again in every language, and her book says she comes round "every fifth day" (ten real hours
are five days of the online calendar). `ketchVoyageAt(now)` names the voyage and its phase - away, sighted, docked, departing - each instant's edge
on the later side. A crew **boards** only while she keeps station (`ketchBoards`); her ships **hold** their crews from
her arrival to her going (`ketchHolds`).

**In the sky** (`scenes/ketch/ketchSky.js`), on the clock alone so every screen sees one ship in one place: sighted,
she comes in from the east six kilometres out and ninety metres over her station, slowing, bow west, and turns to her
station's heading (bow south) over the sighting's last share; at station she hangs still **700 m east and 140 m south of
Daggerfall's centre, 260 m over the fields** (`world/ketch/ketchModel.js` KT_STATION, KT_GROUND), and lets her
anchor-lift down on its chain over forty seconds; weighing anchor, she draws it up, turns west over a minute, and goes,
gaining way and height, over the city and out of sight. Her mesh is the made level's own, drawn in the exterior's world
pass; she stands to the world's collider while she keeps station (a body levitated up finds her hull), never while she
moves. A body that stands in the lowered cage **KT_BOARD_HOLD_MS** (2.5 s) rides it up, counted down on the screen; one
set down by the way down (or a fall) must step out of it first.

**On the map and the clock:** her ring on the held map and the ink map (`ui/ketch/ketchMapMark.js`, the gate's ring in
her blue `#7cc4ff`, "The Sky-Ketch"), and her rows on the Timers (`systems/eventTimers.js`, kind `ketch`: sighted,
arrives, keeps station, weighs anchor - "Over Daggerfall").

## 3. The deck plan - and the ship as built

**The frame** is the deck's (`net/ketch/ketchDeck.js`): metres, y up, x across (starboard -x, port +x: the engine is left-handed, so facing the bow, -z, the right hand is -x - AUDIT KETCH
L4-12), z along the keel from the bow; into the dungeon host's frame by the Shattered Hour's own move (`realmToDungeon`), so the Hour's Steps lay the
Sailwalk unchanged.

| Part | Where | What |
|---|---|---|
| The Anchor Deck | y 0, z 0-14 | where the anchor-lift sets a crew down (KT_ARRIVE), and its way down |
| The waist | y 0, z 14-62 | the Boarding Watch; capstans and hatch covers to fight round; the quarter wall aft |
| The gun deck | y -6, z 52-128 | the Gallery of Hammers (six rows, three lanes), two steam lanes, the Wardens' landing |
| The hold | y -12, z 52-132 | the Starved Engine fore, six cradles aft, three arc-coils between, four spider vents |
| The mast-lift | a brass tower at the waist's port quarter | the hold to the main top (y 16); it runs once the engine is fed |
| The main top and its yard | y 16 | the yard out to the Sailwalk's first top; the bosun's line's post |
| The Sailwalk | outboard to port, x 24 | six drifting spars, the beating plates and a riser, seven rotten planks stepping down |
| The bridge | y 0, a disc r 24 about z 200 | the Tonal Warden; a core (r 15) that never falls, an outer ring in eight sections |
| The cabin | behind the helm | the Ketchmaster's chest, and the stern lift down |

**The Sailwalk** is the Hour's and the Spire's one course law (`net/eliteGates/egSpanLaw.js` courseOf): its steps' sizes
the Hour's own (pinned equal), every gap within the envelope (2.4 m to 3.2 m), the riser climbed straight off the plate
before it, every step down under DFU's fall damage (5 m, `player/motor.js` FALL_DAMAGE_THRESHOLD); a fall into the sky is
caught by the nets and cast back to the span's top for 15% of the body's health. **The bosun's line**, once the bridge is
unbarred, runs from the main top down to the gangway and sets its rider down past the Rotten Rigging's gust, facing the
bridge (`KT_LINE_LAND`), its chain drawn on the rider's own path (AUDIT KETCH L4-6). The checkpoints hang on three chains
each from **the jackstay**, a brass spar over the Sailwalk's line between the main mast's vane-spar and the mizzen's
(`KT_JACKSTAY`, AUDIT KETCH L4-13).

**The ship as built** (`world/ketch/ketchModel.js`, `world/ketch/ketchKit.js`, `world/ketch/ketchArt.js` - its own art
on the pseudo archive KT_ARCHIVE): the hull, two masts and their stays, the engine house, every deck, stair and rail,
lamps on every deck, the hatches' grates and the cabin's doors (parts the host moves), the bridge's eight sections each
its own mesh and collider, the resonators' pylons, **the lodestone** on the console behind the helm (blue and brass,
turning on its own - `KT_LODESTONE`, the line's stone made true, AUDIT KETCH L5-7), the land below and Daggerfall off the
starboard beam in the haze. AUDIT KETCH made her walk true (L4-1..L4-14): the bridge's outer rail open over the
gangway's foot and the cabin's door, the nets cut out, every ceiling over a barred room solid, the shaft's collar netted,
the guns' carriages solid and out of the hammer lanes, every spawn and spot clear of what stands on its floor. The made
level stands in the dungeon host (`world/ketch/ketchShip.js` - a made location, its one block file), as the Hour does.

## 4. The stages - the director

One crew's ship is one room (`kt:<voyage in 8 hex>.<captain's digest in 16>`), its voyage the pure director's
(`net/ketch/ketchBrain.js`): the moment and a [0,1) source in, frames out, so a test runs a voyage whole. ONE HAND AND
ONE PURSE a member for everything it strikes (the gate's `spendBlow`, `spendPurse`).

1. **The Boarding Watch.** Five waves (`KT_WATCH_WAVES`, KETCH-LONGER) - spheres; spheres and sentries; more of both;
   the sentries' wall; the Watch-Captain with spheres and a sentry (`watchWave`, by the crew aboard - counted by its
   kept places, AUDIT KETCH II L1-3; each Sentry its own post of six, L1-7) - each rising three seconds after the last is down, the first when a member steps into the waist
   (or twelve seconds after the first boarded). The waist's floor runs over the Anchor Deck too: the Watch goes at a crew
   wherever it stands on the open deck. The last down: the hatch opens.
2. **The Gallery of Hammers.** Its hammers and steam lanes run on the shared clock (`hazardsBetween` - each hammer
   slams once a cycle, its row's lanes a second apart, so one lane of every row stands clear two seconds in three); the
   two **Hammer Wardens** stand at their posts until a member comes past z 98 or strikes one. Both down: the hold opens.
3. **The Starved Engine** (section 6). Fed: the hold is cleared and the mast-lift runs.
4. **The Sailwalk.** The first member on the gangway or the bridge unbars the bridge, by name.
5. **The Tonal Warden** (section 7).
6. **The Ketchmaster's Cabin.** The Warden's fall opens it: each earner's share waits at the chest (section 9).

## 5. The constructs

The Rourken's brass crew (`net/ketch/ketchConstructs.js`), run by the relay as the gate's host and the Spire's legion
are: **the Dwarven Sphere** (a lunge down a lane, a spark about itself), **the Dwarven Sentry** (a crossbow-turret that
keeps its range - a bolt, a volley at three), **the Dwarven Spider** (the hold's vermin, quick to a carrier - its sting
knocks a cell loose), **the Hammer Warden** (a hammer ahead, a sweep, a steam lane), **the Watch-Captain** (a stomp and the
Tonal Wave rolling out of it - jumped - a cleave, a steam lane). Every blow a full shape stamp (`egBlowOf`) held at the
wind-up floor. Health: `hpS` seconds of the crew's mean reference damage, the Wardens and the Captain a share a member.
A body walks round what stands on its floor (the waist's cover, the mast-lift's tower and the main mast). A blow on one
is believed only risen, by the hand, from its storey, and a swing within reach; a sleeping Warden struck wakes.

## 6. The Starved Engine - the cells (the new mechanic)

The engine eats **aether cells**: five, and one more for every two aboard or part of two, up to its seven sockets
(`engineNeeds` - six for one or two, seven from three; KETCH-LONGER). A member takes a
charged cell from one of six cradles (`pick`), carries it through the arc-coils to the engine and sets it in one of
its seven sockets (`bank`).

- **The burden** (`scenes/ketch/ketchClient.js`, `player/motor.js` registerFootSpeedMod - a departure: Daggerfall carries
  nothing in its hands): a carrier walks at 0.72 of its pace, its weapon put up; readying one lets the cell go.
- **Knocked loose:** a carrier struck by any blow (its own machine's verdict, `hurt`; the relay's census; an arc-coil on
  its trail), fallen, or who lets go (`drop`) drops the cell where it stands; it lies fifteen seconds for any member to
  take up, then bleeds out. A cell carried off the hold's floor (up the stair) is gone with it.
- A cradle charges again twenty-eight seconds after its cell is taken; spiders pour from the vents two at a time every
  six seconds, at most five and the crew alive at once, at carriers first (KETCH-LONGER), walking round the engine and its
  sockets, the lift's tower, the cradles and the arc-coils' posts (AUDIT KETCH II L4-8).
- The Warden's Discord is put right the same way, with the bridge's own two cradles (section 7).

## 7. The Tonal Warden

What the Rourken left at the helm (`net/ketch/ketchWarden.js`): a construct twice a man's height in tonal brass, a
tuning-fork's tines for a crown - the Brass Remnant's fight rung for rung, on the boss seam (`KETCH_SEAM`). Each fighter
brings 600 s of its reference damage to its health (`KW_TTK_S`, KETCH-LONGER); the crew's eight seats; a fight no living
fighter has stood on the bridge for two minutes is lost (`KW_LOST_MS` - thirty seconds before AUDIT KETCH II L5-4, which
no solo who fell was back inside; the Warden whole at its helm again, the next `in` a fresh fight).

1. **The Steersman** (100% to 65%): the Keel-Strike (a lane 26 m down its facing), the Steam Lash (a cone of fire), the
   Tonal Ring (a disc, then the wave to 20 m - jumped).
2. **The Discord** (65% to 35%): warded while any of the bridge's four resonators is false; every thirty seconds the
   Discord (a quarter of everyone's health); two Sentries climb onto the bridge. A resonator is put right with a cell
   from the bridge's cradles; all four true break the ward and stun it ten seconds, struck half again as hard.
3. **The Last Note** (35% to 0): the Keel-Song every forty-five seconds while tuning-forks rise on the core (three and one
   for each two living, seven at most): every one broken stuns it; one standing and it lands (70% of everyone's health)
   and heals it. The outer ring gives way - two sections at a time shudder three seconds and fall away for seven.

Twenty-two minutes after its wake (`KW_ENDS_MS`, KETCH-LONGER) **the Ketch turns west** - ninety-nine hundredths of everyone's health every two
seconds (`KW_END_PCT` 0.99; AUDIT KETCH L5-9: the page said nine tenths).

## 8. The ship's blows judged where the client cannot skip them

`net/ketch/ketchJudge.js`, net/bossRef.js's law rung for rung: a body struck only BODY_MARGIN deep in a stamp before and
after the landing, on the blow's own storey; a blow with a span also catches a pose inside it while it lasts - and **a
lane crossed while it lasts**: an arc-coil's lane is narrower than the margin (no pose stands deep in it), so two poses
either side of its line, both sent inside its live span, are the crossing (a crossing straddling its waking is not
counted - the carrier's favour). Plain blows count against the body's share; every blow of any kind knocks a carrier's
cell loose (the Tonal Wave, jumped, never). The Warden's own are its fight's (`judgeWarden`).

## 9. The Ketchmaster's hold - the receipt, the week's share, the spoils, the guns

**The receipt** (`net/ketch/ketchReceipt.js`, `y1`): the relay's signature on the fall for each earner - its voyage, the
crew's ship, the account, a seed, how it was earned, the level - never another boss's. Unsigned (a keyless relay) the
page reads it and the service declines it; the hold pays nothing off it.

**The week's share** (`server-account/src/ketch.js` claimKetch, migration 0166, `/v1/ketch/claim`): one row a (voyage,
account). The first receipt of a voyage takes its share; the same ship again from the device that claimed it (its claim id,
`cid` - AUDIT KETCH L2-1) is the same kill (`claimed`, its share still that device's to roll), and from any other device
pays nothing; another crew's ship that voyage is answered `taken` - she pays no hand twice a week. The device carries its
receipts (`net/ketch/ketchClaims.js`) until they settle, and the hub keeps each earner's for its life and hands it at
every hello (`ktrc:`, AUDIT KETCH L1-2), so an earner off the ship at the fall is paid too. A share the service pays is
written to the device at once (`scenes/ketch/ketchShares.js`, AUDIT KETCH L2-2, L2-5) until the pool holds it. The voyages sailed show on the account card
and the Inspect card (`ketchRecordOf`, `ui/profileWindow.js` profileRecordLines - the one door that laid the stars there
too, which STAR7 had laid on the card's view alone).

**The spoils** (`systems/ketch/ketchSpoils.js`), rolled off the receipt's seed: gold 450 a level (a fifth either way); a
Legendary piece a quarter of the time (else Rare) and one Rare or better; the foundry's **20 to 40 Pellets** always (the
one door that pays shot by the score - `PELLETS-SCARCE`); **the Dwarven Thunderlock one share in ten, the Dwarven
Pistolet one in eight**, each its own draw - no other door mints either; and last of all the Ketch's two Gilded guns,
**Volendrung's Echo** (a gilded Thunderlock - Hammerfall) and **the Ketchmaster's Word** (a gilded Pistolet - Broadside),
one in a hundred each (`06-Systems/Gilded.md` section 10). They spill from the cabin's chest into the Ketch's own spoils pool (its keys, its words, its spent marks - AUDIT KETCH
L2-3); a share paid off the ship is granted to the pack, and what lies on the cabin's floor at leaving is gathered into
it - no mailbox (L2-4).

## 10. The relay and the wire

**The room** (`server/src/index.js`, `_kt*`): the Worker mints a ship's room only while its voyage holds its crews; the
door (`ketchAdmits`) takes the captain, the captain's party by the hub's word, staff, a member coming back - never a ninth
(staff neither: the wire's crew is eight, AUDIT KETCH L1-4; a full ship is watched by a hidden spectator, who takes no place),
a full ship freeing the place of a member gone from the captain's party and from the ship KT_PLACE_KEEP_MS with no part in
the Warden's fight (AUDIT KETCH L1-5, `idlePlaces`, `_ktFreePlace` - never the captain's, never on a hub that does not answer),
never a stranger, never a newcomer while she weighs anchor; the ship told whole at the hello and its receipt again; the
voyage kept to storage; its beat every BRAIN_TICK_MS while a member stands aboard; past her crews' last minutes every
socket told and closed. Every pose stamped (`pAt`) so the census reads its age.

**The step law** (AUDIT KETCH L1-7, `ketchBrain.js` `ktLeastMs`): the relay believes no member faster than the fastest
build runs (`KT_FAST_RUN_MPS`, the Elite Gates' `EG_FAST_RUN_MPS` pinned equal; a carrier at `KT_CARRY_PACE` of it, the
page's own pace), less `KT_STEP_SLACK` and a body's breadth - a time bound, the Elite Gates' crossing law's. A cell is set
no sooner after its pick than its straight walk would take; the bridge unbars to a member on the gangway no sooner than the
mast-lift's rise and the Sailwalk's least crossing after the engine is fed (`KT_SAILWALK_LEAST_MS`), nor sooner than that
crossing after it was last seen at the main top (`KT_CROSS_LEAST_MS`). A legitimate crew is never refused; a warp waits
what a run would take. A ranged blow keeps the gate's law (a storey, no range) - the Hour's and the gate's own.

**The words** (`net/wire.js`, from `world253` - `KT_RELAY_MIN`): one frame type, `kt`, in a ship's room alone - a member's
`in` (with its game's brain number), `hit`, `pick`, `bank`, `drop`, `hurt` and its body's word; the room's thirty kinds,
each projected (`validKetchOut`), on a bucket of its own. **The link** (`net/ketch/ketchLink.js`) folds them into the
page's ship, says each turn once, keeps the member's place in the bridge's fight (counted in only by the room's answer)
and the whole bridge's blows owed. **The herald's settings** `ktRole` and `ktThread` ride the relay settings
(`net/relayCfg.js`, world253's).

## 11. The ship on this screen

`scenes/ketch/ketchDeckHost.js` stands her in the dungeon host and routes the six combat seams to the ship while one
stands (the Spire's way); `scenes/ketch/ketchFight.js` draws the constructs, their blows' telegraphs, the Warden, its
forks and sections; `scenes/ketch/ketchClient.js` holds the world's half - the sky, boarding, the link, the claims, the
burden, the bosun's line, the presses aboard (`kt:` targets: a cradle, a cell lying loose, a socket, a resonator, the line,
the way down, the stern lift, the chest), the cast-back, and **a death aboard is a fall**: the death save (`kt-fall`)
wakes the body in the fields under her at a sliver of health - no death penalty. **Raise before the fall** (AUDIT
WORLD-EVENTS L1-4, 2026-10-25; the owner, asked what "Resurrect allowed" means aboard: "Raise before the fall"): a death
aboard - the save's or the count's (`bd`) - with a crewmate on the ship lies DOWN where it fell for `KT_DOWN_MS` (60 s,
`net/ketch/ketchBrain.js`) first: the body held there (`characters/playerEntity.js registerPlayerHold`, the hosts'
paralysis gate), no blow reaching it, dying on every screen (`net/online.js poseDown`), a cell carried let go. A crewmate's
Resurrect at it (`rz`, `net/raiseWord.js`; `ketchRaise`: the caster alive aboard, within `KT_REZ_REACH_M` of the body,
inside the window - the brain marks where each member lies off the room's own poses, `p.lay`) stands it there at
`KT_REZ_PCT` (Resurrect's 30%, pinned equal), a new life on the relay's count (`rez`, named to the crew). Past the window,
THE FALL as ever. Pins: `test/net/eliteGates/auditwe_down.test.js` (THE SKY-KETCH, and THE PAGES). Her look: her own lighting by the hour
- her night never darker than the world's outside it (DFU's exterior night floor 0.25) - the air's fog above and the
lamps' below.

**The made level's rules** (`systems/madeLevel.js`, `ketch`): no save, no rest, no map, no Mark or Recall, no portal
stone, no companions, regeneration held (EVENT-RULES, `Elite-Gates.md` section 24), no levitation or slow fall, no
flight, no run-leap, Resurrect a raise before the fall (above), no avoid-death, no unstuck; a death a fall, its penalty
none. No tier label over her deck (`world/dungeon/dungeonLabel.js`
madeDungeon - nor over an Elite Breach's hall, which no list named before).

## 12. The Ketch on the screen

`ui/ketch/ketchHud.js`: **the voyage's tracker** - the ship's name, the stage and what it asks (the Watch's wave and what
stands; the Wardens asleep; the cells set of the engine's need and the cradles charged; the Sailwalk and the line; the
Discord's resonators; the Last Note's forks; the cabin), the cell in my hands, the crew of eight, and the clock to her
weighing anchor and her turn west; and **the Tonal Warden's bar** - the gate's boss bar in the Hour's brass, cut at its two
turns, the ward, the blow it winds up, the Keel-Song with its forks, the stun and the fall. A first-use tutorial page,
`sky-ketch` (`systems/tutorialCatalogue.js`).

**Every line in the player's language (L10N4).** The page's words of the voyage go through the text core when they are
read, never at import, so a language chosen after the game loaded is the one shown: `systems/ketch/ketchWords.js` holds
the voyage's turns, the made level's refusals, the stages', the Warden's phases' and blows', and the constructs' names (the
page names a blow or a kind by its KEY - the relay keeps no name of its own for a kind) and the map card's line;
each file that says a line routes it the same way (`ketchLink` KT_LINK_TEXT, `ketchHud`, `ketchClient`, `ketchSky`,
`ketchClaims`, `ketchSpoils`, `ketchMapMark`, the Timers' row in `systems/eventTimers.js`, the tutorial page). The relay
sets no locale, so it keeps English of its own and the page reads it back: the door's four refusals
(`net/ketch/ketchLaw.js` KT_TEXT.refuse - `ketchRefusal` turns each into the player's words, key for key), the blows'
`nm` on the wire (never said by the Ketch's page), and the herald's Discord cards (the channel's English, as every herald
post is). A refusal's number on the wire (`KT_NO_WORDS`: gone, over, older) is said by the link in the player's words. The
two port books stay English as On the Burning Doors does: a port book is BOK bytes read whole, and no language holds a
-LOC book for one (`ui/bookDoor.js`). Every routed line is in the catalog (`locales/en/Port_Strings.csv`) and drafted for
all 25 languages; `test/systems/l10n4_hardcoded.test.js` counts what stays English, each with its reason.

## 13. The questline - the Sky-Ketch

`skyKetch` (`systems/questlines/qlLines.js`; tier 4, level 12, online, an account), given by Imrah Bel-Tavir:

1. **The Ketch That Never Lands** (QLSK01) - her letter and book 419; ride the anchor-lift up (`ketch-boarded`).
2. **The Starved Engine** (QLSK02) - set a cell of your own in the engine or a resonator (`ketch-cell-banked 1`: every
   hand of a crew of eight can - AUDIT KETCH L5-4); her book 418.
3. **The Tonal Warden** (QLSK03) - witnessed: the Warden felled, its receipt counted (`warden-felled`; the service's
   `ketch` witness, `ketch_voyages`) - and the line's title, **Skyfarer**.
4. **What the Lodestone Answers** (QLSK04) - the Numidium reading; who is told: the Mages Guild (Bel-Tavir's Tuning-Charm,
   the Guild's standing) or no one (the Steersman's Hammer).

A book is handed by `get item`, never `give pc` - a give is a quest's pay (`qlLayer.js` reward): QLSK01's with its letter
(`have _letter_ set _book_`), QLSK02's at her table (AUDIT KETCH L5-2). No line names a day of Tamriel's week - she keeps
the real one (section 2, L5-3) - and the lore promises nothing the game does not do (L5-7, L5-8): the lodestone stands at
her helm; the charm's hum is Imrah's tale and the hammer's metal the roll's; the Brass God pulled her once before.

## 14. The herald

`net/ketch/ketchHerald.js`: three cards a voyage on the clock alone - **sighted** (pinging the Ketch's role, else the
gate's), **arrived** and **weighing anchor** (quiet) - each owed once in its window and let go past it, in her family's
card (`net/herald/heraldCard.js` `ketch`, her blue) and her own thread when the operator names one (`KT_DISCORD_ROLE`,
`KT_DISCORD_THREAD`, `server/wrangler.toml`). The hub's alarm beats it (`_ktHeraldBeat`).

## 15. The live run, and what it found (2026-10-24)

The real relay and account service in workerd (`tools/loadHarness.mjs` standServices) and the real game online in
headless Chromium, voyage 0 docked: the Ketch over the fields, boarded through the lift into `kt:00000000.<digest>`, the
Watch, the Gallery, the engine fed, the bridge unbarred, the Tonal Warden felled solo in 9.4 minutes (its Discord, its
forks, its sections) and its receipt handed. The first run's relay held no signing key, so its receipt went out
unsigned; THE SECOND RUN (the same day, a throwaway gate pair in both Workers' env, as the account deploy mints one) took
the rest of the road: boarded, the Watch broken in 24 s, the Wardens in 7, the engine fed in 58, the bridge unbarred, the
Warden felled solo in 208 s (the Discord's four resonators, the Last Note's three forks, the stun, the sections), its
receipt SIGNED (an 86-character Ed25519 signature), claimed at `/v1/ketch/claim` (the account's `ketch.sailed` 1), the
chest offering "Open your share", and the share thrown across the cabin floor - a Legendary, a Rare, 37 Pellets and 526
gold - with the tracker and the Warden's bar drawn through the text core. A fall to the Watch's first wave before the
driver ran woke the body in the fields, as the made level's death says. What the runs and the tests written beside it found, each fixed and pinned:

| Found | Fixed | Pinned by |
|---|---|---|
| `kt` words closed the socket - the client parser knew no `kt` | `parseClient`'s `kt` arm | `ketch_relay.test.js` |
| the census lost every member 25 s after its hello - a ship's pose never stamped | `pAt` for a ship's room | `ketch_relay.test.js` |
| `/v1/ketch/claim` missing from the service's routes (404) | `ROUTES` | `ketch_claim.test.js` |
| a construct's first blow (index 0) never held to its recovery | `B.atk != null` | `ketch_constructs.test.js` |
| an arc-coil's lane narrower than the margin: never judged on the trail | the crossing rule (section 8) | `ketch_constructs.test.js` |
| a crew on the Anchor Deck out of the Watch's reach | the waist's floor over it | `ketch_constructs.test.js` |
| "Regular Dungeon, Small" over her deck | `madeDungeon` | `ketch_model.test.js` |
| her deck black at night (ambient 0.1) | the world's own night floor | the live run; `ketch_deck_host.test.js` (AUDIT KETCH L5-9) |
| Hammerfall's brief past the card's row | shortened | `ketch_gilded.test.js` |
| the Skyfarer's colour 32 from the Chaptermaster's | `#58d8ff` | `ql12_claim.test.js` |

**The tests:** `test/net/ketch/` (`ketch_law`, `ketch_deck`, `ketch_brain` - a voyage run whole through `ketchSim.mjs`,
every frame through the wire - `ketch_warden`, `ketch_constructs`, `ketch_link`, `ketch_herald`, `ketch_relay`,
`ketch_online`), `test/server/ketch_claim.test.js`, `test/systems/ketch/` (`ketch_spoils`, `ketch_gilded`, `ketch_words`),
`test/systems/questlines/ketch_lines.test.js`, `test/scenes/` (`ketch_sky`, `ketch_client`, `ketch_shares`,
`ketch_deck_host`, `ketch_fight`), `test/ui/ketch_hud.test.js`, `test/world/` (`ketch_model`, `ketch_walk` - the real ship
on a real Collider and PlayerMotor). **The mutants:** `tools/mutants/ketch_*.json`, eighteen lists, 297 records: 295 dead
and two recorded equivalent (`KTB-the-cells-said-every-beat` - every caller says the cells only after it moved them, so
the word's dedupe guard is never the branch taken; `KTF-the-late-landing-judged` - the verdict refuses a stale blow the
frame's window would have).

**AUDIT KETCH** (2026-10-24, the owner: "Its time to be a deep audit on this and ensure absolute perfection";
`01-Overview/audits/Audit-Ketch.md`): five cold lanes on a frozen snapshot - the relay and its law, the rewards and the
account service, the page, the ship in the world, the record and its words - 67 reported, 62 defects, every one fixed and
pinned red on the code as it stood but L2-10 (left with its reason): the Engine's spiders killable past six minutes, the
fallen earner's receipt kept at the hub, a share paid one device once, the Keel-Song counted, a ninth never aboard, a
quitter's place freed, the step law, the Ketch's own spoils, her walk true end to end, the line's pay and words, the real
week named.

## 16. KETCH-LOOK - the polish, as shipped

The owner, 2026-10-24: *"After this audit is done and finalized, the goal is going to be to do a deep polish ohase of
every element, like weve done in the past with other world events, enhancing the ambience, the detail and everything to
be a AAA experience. This even needs to surpass what weve done with the abyss dungeon"*. The plan is
`Sky-Ketch-Look.md` (four directors' sets synthesized; the owner's four calls ruled; slices KL0-KL22); this records what
shipped of it, slice by slice, and wins where the two differ. No law moves: no file the relay bundles changes and no relay
version moves.

| slice | what shipped |
|---|---|
| KL0 | THE FLASH LAW, THE CASTERS, THE LAB'S EYES. The hold's arc-coils swapped their four bolt frames 16.7 times a second (`ketchDeckHost.js`, a frame each 60 ms) - a flicker past `TELEGRAPH_THROB_MAX_HZ` (3 Hz): a coil now holds one bolt through each strike and changes it between strikes (`world/ketch/ketchPose.js` `hazardStrike`, `hazardPhase`). A warned section of the bridge's ring shook at 6.9 Hz (a sine of now / 23 ms): it lurches at `KT_SECTION_LURCH_HZ` 1.5, under the heartbeat ceiling of 2.5. Nothing that moves casts: the mast-lift's cage never records a shadow, and a section casts only whole and still - from its warning to its return it moves, and every lamp's cube near it was rebuilt each frame. THE LAB (`ketch.html`): its cameras and knobs in a pure module (`src/tools/ketchLabViews.js` `KT_LAB_VIEWS`, `ketchLabKnobs`), every eye pinned clear of the ship's colliders and over a floor; `top-out` (the main top's ring outside the shaft, looking out along the yard); `?grey`, `?lite` (the Steps' phone tier), `?bill` (the ship's GL draws, meshes, shadow casters and how many MOVED, lights, its CPU - on the page and `window.__lab.bill()`), the world's sky over her by default (`render/enhancedSky.js`, drawn after the opaque level as the dungeon arm's `host.drawSky` is; `?sky=0` off, `?weather=`), `&secAt=` (the sections' fall on the shared clock, so a probe watches one run). `tools/ketchLabProbe.mjs` (frame-synced on `window.__frame`): `value` (every view at four hours, its display luma - the ladder measured), `flash` (a live arc sampled at 60 Hz for 4 s: at most 3 transitions a second - 1 in 4 s; red on the code before KL0, 14 in 4 s), `shadow` (the lift riding and the sections falling: no moving caster - red on the code before KL0, 1 and 3 moving casters) |
| KL1 | THE LIGHT BY THE HOUR AND THE ZONE. **No lamp aboard lit anything**: every lamp's glass stood in the ship's one mesh, which casts, so each lamp's cube shadow map recorded its own glass round its light - the hold's floor under a lamp at eight times its colour read as the dark between them, and the waist's at dusk at a floor mean of 0.02. The lamps are now a mesh of their own the deck draws casting nothing (`world/ketch/ketchModel.js` `buildKetchShip` `lamps`). **Her light** (`world/ketch/ketchAtmos.js` `KT_HOURS`, `ketchHourLight`): a row an hour of her open decks (dawn, day, dusk, night) and one a room (below decks, the cabin), walked by the world's daylight between night and day - whole day once it passes `KT_DAY_FULL` (0.4) of its noon, 07:00 to 17:00; the plan walked it by the daylight itself, which left the morning a grey between the rows - then toward dawn's or dusk's row over its window. The trilight: a floor the row's ambient, a wall four fifths of it, a ceiling and her belly the deck's bounce (0.35 of the sun and the moon), warm below. The sun's colour by its elevation (the day's above 12 degrees, a gold at 3, a red at the horizon), its share up with it over its first 6 degrees and never from under the horizon. By night the moons' key off the world's own moon term (`render/enhancedSky.js` `moonlightTerm` over the sky's clock and the weather's word - a new, set or clouded moon gives none; `scenes/ketch/ketchDeckHost.js` `ketchMoonNow`, made once a sky minute). The haze by the hour (the day's 0.0016, not 0.0028). The lane's grade by the zone; the cabin its hour's at seven tenths; below decks the warm close air (`KT_BELOW_FOG` [0.16, 0.12, 0.08], not the dark brown its far end went black in). `ketchApplyLook` puts it on the renderer every frame, the grade on the lane alone, and the lamps of the zone the eye stands in burn at that zone's gain - departing from the plan's gains on the measure: dawn and dusk 1.8 (the plan 1.0 and 1.2), night 1.6 (1.4), below decks 1.4 (1.0), the cabin 2.0 (1.0), the day 0.6. **Her sky on the hour**: a made level that draws the world's sky runs no exterior frame, so her sky stood at the minute she was boarded while her light turned under it (online, twelve game hours a real one) - the drawSky door hands its draw the clocks (`scenes/shared.js` `draw`, `retime`: the street's last `use` again on the clocks now; the Arena's floor's sky with it). **The lamps** (`ketchLampSpots`, 49 - the plan's 48 and one): the gallery's ten wall lamps became one under each hammer row's middle housing, clear of its head's stroke, and the way-on lamp at the Watch hatch's stair's foot (the plan's six left the corridor's fore 16 m at p50 0.035); the landing's four hang over its floor either side of the hold's hatch (on its walls, p50 0.072); the hold's twelve became one over each cradle, two down its middle (the middle cradle row's own place is the hold's stair: a body's head on it at y -6.45) and one over the arcs' aisle, and a ring of four round the engine; every lamp below hangs from its ceiling on a rod, the hold's 4.9 m over the floor (at 4 m a pool by the lift's door burned to p95 0.28); the waist's and the main top's lamps moved out of the nets their glass stood a centimetre into. **The ladder's numbers** (`world/ketch/ketchLook.js` `KT_LADDER`, with the light meanings `KT_MEANING` pinned to their homes) judged by `ketchLabProbe.mjs value` (every view at 05:30, 07:00, 12:00, 18:30, 19:30 and 02:00, one page, its eye settled - `?eye`, `window.__lab.hour`), on the lane: below decks p50 0.12 (gallery, landing), 0.14 (hold), 0.08 (engine) at every hour, their floors' p95 0.13-0.25; her decks' floor at dawn and dusk p50 0.11-0.19 (waist, arrive, bridge), at night mean 0.11-0.19; the cabin p50 0.17-0.19. OWED to later slices, measured and named: the noon floors (waist p95 0.41, mean 0.23; arrive 0.41; bridge 0.41; the helm's 0.56, and 0.43 at 07:00) - her bronze tread is KL2's to repaint as Dwemer steel, the darker metal under a fight; the helm's floor at dusk (p50 0.06) - the bridge's iron fight floor, KL2's and the bridge's own floor light's; the lift's frame (p50 0.073) - the dead shaft behind its gate, until the gate's lamp (LAMP, "the way on is open") rides the states (KL3). The classic set (`lane=off`), measured the same: the open decks at night meet it (floor mean 0.09-0.11), at noon not (p95 0.48-0.50); below decks p50 0.055-0.076, the open decks at dawn and dusk p50 0.07-0.095 and the cabin by night 0.07-0.09 fall short - the set has no eye to open and a lamp's falloff is the classic (1 - d/r)^2, so its light is KL2's to set beside the lane's, over her new metal (whose steel stands two to five times her old iron's albedo and moves every number here). |
| KL2 | HER METAL. **Daggerfall's index space**: every texel of every record a step of her ramps (`world/ketch/ketchLook.js` `KT_PAL`: Dwarven, rubbed, glint, burnished, rust, copper, verdigris, Dwemer steel, Dwemer stone, aether, ember, lamp, gilt, cloud, the land's), an ART_PAL index beside its colour (`world/superDungeon/sdPixelKit.js` `quantizeIndexed`; the Hour's `quantize` untouched); each record `{ albedo, emission, index }`, drawn in the port's fallback colours and resolved through the player's own palette at upload (`world/ketch/ketchArt.js` `resolveKetchArt` - a lit texel keeps its glow's share of its new colour; `scenes/ketch/ketchDeckHost.js` `ketchPaletteRgb` reads ART_PAL.COL off the game's data seam once and `ensureKetchArt` puts her up again through it, never back). The indices are code: her Dwarven METAL_TABLES.Dwarven's own steps, her steel the darkest greys under METAL_TABLES.Iron's; the fallbacks the port's own - 92 indices, one colour each, every one within 23.7 of its entry and none the file's bytes, taken from her old ramps and the Hour's where one stood within 24, painted fresh where none did. **The repaint, in Daggerfall's grain** (big bevelled panels framed and riveted, faces mottled in six-texel blotches - never the single-texel noise that read as cloth): the decks Dwemer steel plate in courses along the keel, framed by a dark joint and a Dwarven strip, quiet rivets and half the tread's relief (no glint); the hull Dwarven plate in courses a metre tall, lapped and riveted, butt joints staggered, verdigris weeping below the laps; the trim and rails Dwarven, rubbed along the top; the machinery steel in bolted panels with a little oil under the bolts; the hold's walls the plates' backs under a Dwarven stringer a metre (`inner`, a new record - its outside's strakes between the ribs read as bookshelves); Dwemer stone warm sand ashlar under a Dwarven string course every metre; the vanes pierced Dwarven leaf (cut out with the nets, `KT_CUTOUT_RECS`); the nets Dwarven cord in its darker steps, one 1.5 m diamond a picture (`KT_NET_M` - the 1 m mesh as bright as the sky read as a chain-link fence); the Hour's orange brass gone from her. **The Tonal Warden, until its own sheets (KL15)**: the Iron Atronach dyed Dwarven the Daggerfall way - DFU's ChangeDye with the Dwarven table over its 0x70 metal band and the Ketch's table over its darkest greys (`scenes/ketch/ketchFight.js` `ktWardenDye`, `KT_WARDEN_DARKS`), at upload from the player's own TEXTURE.291 under a key of its own; its multiply wash retired. **Her light on her new metal** (KL1's debts, measured again): the decks' plates lightest at the steel's step 3 - their bevel's lit edge and the tread's crests (step 4 stood at the floor's p95 over the noon rung on every open deck, 0.31-0.32); the noon sky's fill [0.52, 0.54, 0.58] and the sun's share 0.8 (`world/ketch/ketchShip.js` `KT_LIGHT` - [0.56, 0.58, 0.62] and 0.85 before: the shade under her rails a little deeper); below decks' lamps 1.5; and the classic set's light beside the lane's - the set has no eye to open and its lamps fall off as (1 - d/r)^2, so each row carries gains of its own (`world/ketch/ketchAtmos.js` `KT_HOURS` `classic`, `scenes/ketch/ketchDeckHost.js` `ketchFrameLook`: dawn and dusk 1.9, the day 0.85, the night 1.1, below decks 1.6, the cabin its hour's light at 1.2 and its lamps at 3.8). **The ladder's numbers** (`ketchLabProbe.mjs value` with `?arena2` - her art through the player's own ART_PAL - every view at six hours): on the lane 109 of 114 - below decks p50 0.087-0.144 (the engine 0.087), their floors' p95 0.10-0.20; her decks' floor at noon p95 0.295-0.296, mean 0.19-0.20, at 07:00 p95 0.20-0.22, at dawn and dusk p50 0.10-0.18, at night mean 0.09-0.15; the cabin p50 0.16-0.19; the lift's frame p50 0.099 (KL1's 0.073, owed to KL3, met by her new metal). On the classic set 110 of 114 - below decks p50 0.086-0.130, floors' p95 0.11-0.18; her decks' floor at noon p95 0.27-0.28, at dawn and dusk p50 0.11-0.14, at night mean 0.064-0.10; the cabin p50 0.16-0.32. OWED, measured and named: the helm's floor, the bridge's core - at noon its brass inlay (the fork ring's two circles and twelve rays, the gilt sigil) stands at p95 0.37 on the lane and 0.35 on the classic set (the rung 0.30), by dusk and night its steel unlit (the lane p50 0.05, mean 0.04-0.05; the classic set p50 0.09, mean 0.054 at 19:30) - the core's floor and its own light are KL11's (its seams lit, `ktBridgeGlow`, the console's lamps; the contrast probe on the core's floor), as KL1 named its dusk. |
| KL3 | ONE LAW AND THE PLUMBING. **One law** (`world/ketch/ketchStates.js` `ketchStatesOf`): one kept record of her state every pass, board, sound and line will read - her three states (asleep until the engine is fed, awake from its waking, singing while the Warden's fight lives, awake after its fall), the cradles' fills, the sockets, each loose cell's time left, the appetite (banked over need), the waking's age, the lift's round and gates, each hammer's draw-up and the lanes' and coils' wind-ups, the spiders' next pour, the Watch's wave and its gap, the ring's sections warned, gone and returning, the resonators, the Discord's mark, the song and its forks, the stun from its first frame, the turn, the end, the fall - each from the link's folded word or the shared clock, nothing built a frame. **The PVS** (`KT_PVS`, `pvsGroupsAt`): the deck's part draws each carry a group - the gun deck's hammers, the hold's cradles, sockets, arcs and its gate, the top gate aloft, the bridge's sections, resonators, forks, doors, cradles and lodestone - and the pose writes `culled` on every group the eye's zone cannot see (the dungeon loop's own flag: no draw, no shadow's record), the zone held 4 m past the edge it began at and both sides' groups within 6 m of every opening; the static ship, her lamps, the land, the cage, the hatches (a shut leaf is a ceiling below and a floor above), the loose and carried cells and the bosun's line carry none and are never culled. Measured (`ketchLabProbe.mjs bill`, the voyage at its fight): the ship's GL draws 189 from every zone before, now 74 at the waist, 92 in the gallery and the hold, 136 on the bridge and in the cabin - each pinned as its ceiling (`src/tools/ketchLabViews.js` `KT_LAB_BILL`); shadow casters 10 to 2 at the waist. The Steps' `cull(on)` and their ride's word (`scenes/superDungeon/sdSteps.js` - their draws culled and their ghosts unasked out of sight, their law riding on; the Hour never gives the word); the lab gives it from the camera; the game's Steps take it with KL12's one term in `buildDungeonContext` (`ketchSailwalkDeps`), the plan's only door to their making - OWED to KL12, named. **The gauges** (`render/ketch/ktGaugePass.js`, no sites yet): every instrument aboard in one instanced draw - the dial (time left, its needle falling through 270 degrees to its red pin), the glass (a level, filling from its foot), the lamps (a count, lit from the left), the ring (a share, clockwise from the top), the pulse (a flow) - posterized on each face's own texel grid, its meaning riding its kind; `ktGaugeAt` the fragment's twin, read through the shader's own text. **The classic set's halos**: the deck's lamps and lit things nearest the eye haloed through the Hour's `render/superDungeon/sdHalo.js` (a lamp's 0.9 m at 0.35 of its light, a lit thing's by its reach), handed by the deck host to the fight's late pass on the classic set and none on the lane, whose bloom is its own. On the way, **the ship's late pass was never fogged**: it was handed her look's fog record (`mode: 'exp'`, no range, no eye) where a pass reads the renderer's - the telegraphs and the spoils' lines drew unfogged; it takes the renderer's own now. **The lab's fake link** (`src/tools/ketchLabLink.js`): the voyage as her room would say it, made of the relay's own pieces (the Warden's brain's fight and `wardenStateOf`'s word; its blows made of the same shapes its beat makes them of - `labBlow`, held byte for byte to the brain's own keel, lash and ring by its test, since a lab may not edit a relay file: every byte of one is a deploy), projected by `validKetchOut` and folded by `foldKetch`; its knobs `?stage`, `?cr`, `?br`, `?bk`, `?nd`, `?lo`, `?carry`, `?wv` and `?fight=` (asleep, wake, keel, lash, ring, wave, discord, tuned, song, landed, broken, stun, sections, west, fell) with `&age`, `&wt`, `&rs`, `&da`, `&su`, `&st`, `&forks`, `&sec`, `&left` (KL0's `?sec&secAt` and `?forks` still standing their fights); `?gauges` a card of every kind at five shares and the four meanings. |

Pins (KL0): `test/scenes/ketch_deck_host.test.js` (one bolt a strike; nothing that moves casts; the lurch under the flash
law), `test/world/ketch/ketch_lab.test.js` (the eyes in open air; `top-out`; the knobs read). Mutants:
`tools/mutants/ketch_look_lab.json` (9, all dead). THE FOUR HOSTS (KL0): `scenes/worldModes.js` - the deck host it
constructs changed inside its own module, no host line; `scenes/world.js`, `scenes/dungeonContext.js`,
`scenes/exterior.js` - FLAGGED, nothing of KL0 passes through them.

Pins (KL1): `test/world/ketch/ketch_atmos.test.js` (the lights their homes' own; the rows at their hours; no hour steps;
the sun by its elevation, never from under the horizon; the trilight; below decks and the cabin; nothing built a frame),
`test/world/ketch_model.test.js` (the 49 lamps where they mean something, clear of every collider and every head, their
own mesh), `test/scenes/ketch_deck_host.test.js` (the look on the renderer: the grade on the lane alone, the moons' key,
the zones' gains; the sky on the hour off the street), `test/scenes/hotfix1003f_session_button.test.js` (the drawSky
door's pin moved to its clocks). Mutants: `tools/mutants/ketch_look_light.json` (27, all dead); `ketch_model.json`'s
night re-aimed at the night row. THE FOUR HOSTS (KL1): `scenes/world.js` - the drawSky door's draw takes the clocks, three
terms in its own line (`bootWorld` 36,369 of 36,369); `scenes/worldModes.js` - no line: the deck host reads its moon and
applies its look inside its own module (11,040 of 11,040); `scenes/dungeonContext.js`, `scenes/exterior.js` - FLAGGED,
nothing of KL1 passes through them.

Pins (KL2): `test/world/ketch/kt_look_palette.test.js` (new - the contract's own law; every texel a step; through the player's
palette; the kit's indexed quantize; the net a diamond a cell; against ART_PAL itself where ARENA2_PATH stands; the hold without
bookshelves; the palette asked once), `test/scenes/ketch_deck_host.test.js` (the cutouts' PIN MOVED to the net and the vanes; her art
through the player's palette at upload; the classic set carries the eye), `test/scenes/ketch_fight.test.js` (the Warden dyed
Dwarven at upload, its darks the Ketch's), `test/world/ketch/ketch_lab.test.js` (`?arena2`). Mutants: `tools/mutants/ketch_look_metal.json`
(19, all dead). THE FOUR HOSTS (KL2): `scenes/world.js`, `scenes/worldModes.js`, `scenes/dungeonContext.js`, `scenes/exterior.js` -
FLAGGED, nothing of KL2 passes through them: her art goes up through the deck host's own module (`ketchArtUp`), the dye through the
fight's own upload.

Pins (KL3): `test/world/ketch/ketch_states.test.js` (new - her three states over a voyage run whole through `ketchSim.mjs`; the
cells and the engine as the room says them; the song; the clock's own; one kept record; the PVS - each zone its view's groups,
held at its edge, both sides at an opening), `test/render/ketch/kt_gauge_pass.test.js` (new - the fragment its twin at every point;
each kind at its shares; twelve floats, the meaning riding the kind), `test/scenes/ketch_steps_cull.test.js` (new - the Steps' cull),
`test/scenes/ketch_deck_host.test.js` (the PVS on the deck; the classic set's halos), `test/scenes/ketch_fight.test.js` (the late
pass draws them), `test/world/ketch/ketch_lab.test.js` (the fake link, every fight and knob; the bill's ceilings),
`test/render/firstuse.test.js` (the gauges' program on its list); `sd7b_steps`, `sd25_steps` unchanged. Mutants:
`tools/mutants/ketch_look_law.json` (37, all dead). THE FOUR HOSTS (KL3): `scenes/worldModes.js` - one entry out of the late pass's
call (`host.drawKtFight`'s `fog`), 11,040 -> 11,039 and its ceiling with it; `scenes/world.js`, `scenes/dungeonContext.js`,
`scenes/exterior.js` - FLAGGED, nothing of KL3 passes through them (the Steps' word waits on KL12's term, above).

## 17. AUDIT SHIP - the last audit before she ships (2026-10-24)

The owner, of shipping: *"Lets do an an audit on everything we have. Then we can ship"*. Three readers went over the
event, the guns and loot, and the KETCH-LOOK slices. Every finding below was traced to a real caller first, then fixed and
pinned, each with a mutant checked dead by hand (the owner asked for no long sweeps).

- **1. The kept ship is the party's.** `scenes/ketch/ketchClient.js` `ketchShipKept` keeps the party it was boarded with,
  and `ketchShipChoice` answers it only to that same party. A member who changed parties boards the new captain's ship.
- **2. Her alarm alone wakes her.** In `server/src/index.js` `_ktTick`, a room evicted with nobody aboard reads its key off
  the voyage's own record (`KT_VOYAGE_KEY`). A room that never held one reads once (`_ktNone`).
- **3. The step law lies with the cell.** A cell let go (`dropCell`) keeps where and when it was first taken up (`ox`,
  `oz`, `oa`), and taking it up again carries them. A cradle's cell let go by its socket and taken up again banks no sooner
  than one carried from the cradle. Before it, pick, drop and pick reset the law's clock: the bank came in 200 ms.
- **4. One swing, one sequence.** `scenes/ketch/ketchFight.js` numbers a blow as the gate's `blowQ` does: the bodies it
  meets in a frame share the number, and a body met again or the next frame gets a new one. Before it, every body took a
  number of its own, and the relay's hand (`spendBlow`) was spent once a body.
- **5. The gallery wedges on no late beat.** The hold opens once no warden stands, down or already taken off
  (`KT_DOWN_KEEP_MS`), so a beat more than 3 s late after the last fall no longer wedges the voyage.
- **6. The fall's empty hands are said.** The Warden's fall says the cells (`cellsFrame`) once every hand is emptied.
- **7. The frames in their order.** `_ktFan` says the frames for everyone that came before a frame for one member first,
  so a fight begun (`wf`) reaches the joiner before its own `ws`.
- **C1. A door leaves only what it drops.** `server-account/src/lostSpoils.js` `lostLeftBy` refuses guns, the Sky-Ketch's
  alone (`Gilded.md` section 10), and any Gilded but the door's own: an Hour's the Hourlock, a gate's the Oath, a Redoubt
  none (`LOST_GILDED`). Before it, a Brass Remnant kill could mail 32 of Volendrung's Echo through the Lost and Found.
- **C2. Loot rarity off still drops the Pellet** (`Dwarven-Thunderlock.md`, PELLETS-SCARCE).
- **A1. Her palette reaches the GPU.** `ensureKetchArt` lets her fallback pictures go (`releaseTexture`,
  `evictEmissionTexture`) before her palette's go up. The renderer's cache answers a held key with the picture it holds,
  so before this she never wore ART_PAL. A wrong-size palette file now reads as none.
- **A2, A3. The PVS hides nothing in sight.** `pvsGroupsAt` draws the zone the eye stands in alongside a held view, so
  stepping out of the lift's tower into the hold keeps the hold drawn. The Watch hatch reaches `KT_PVS_HATCH_M` (14 m), so
  the gallery's hammers are seen down its stair from the waist. The hold's steps are a kept list, built once.
- **A4. Her lamps outside.** `scenes/ketch/ketchSky.js` builds, draws and frees `lamps` with her mesh. KL1 had moved them
  out of it, and from Daggerfall she showed no lit lamp.
- **A5. A halo is never brighter than its glass.** `ketchHalosInto` holds a lamp's halo at its own colour: it dims with
  its zone's gain but never exceeds the glass, since the classic set's gain is for the light, not the bloom.
- **A6. A moonless night bounces nothing.** `ketchFrameLook` takes the moons' part of the ground's bounce down with their
  key (`k0`, `m`).
- **A7. The retimed sky drops the street's feet.** `shared.js` `retime` hands no `pos`, because it was the player's live
  array: on the ship it held the made level's coordinates, and the clouds' field jumped at boarding.

**Not taken: the renderer's per-frame trilight.** `setAmbientTrilight` copies the trilight into a fresh object on each
set. The finding is real (two 3-float arrays a frame on the ship), but `renderer.js`'s LA-COST key reads that object's
identity as its change ("replaced on every set, never written in place"). Writing it in place would trade 24 bytes a frame
for a stale key, so it stands.

Pins: `test/net/ketch/ketch_brain.test.js` (the gallery's late beat; a cell let go and taken up again),
`test/net/ketch/ketch_relay.test.js` (the frames in their order), `test/scenes/ketch_client.test.js` (the kept ship's
party), `test/scenes/ketch_fight.test.js` (one swing, one sequence), `test/server/lostspoils_service.test.js` (a door
leaves only what it drops), `test/systems/pelletsscarce.test.js` (the switch off), `test/scenes/ketch_deck_host.test.js`
(her palette through a cache that keeps what it holds; the hatch's reach; the night's bounce and the halos' cap; the
retimed sky's feet), `test/world/ketch/ketch_states.test.js` (the held view and the zone), and `test/scenes/ketch_sky.test.js`
(her lamps outside). PIN MOVED: `ketch_deck_host.test.js` (the hatch's reach, the retime's `pos`), `ketch_sky.test.js` (the
draw count), `loot21_stones.test.js` (the switch off), and `relayversion.test.js` (world255 re-hashed in place, NOT YET
DEPLOYED). Mutants: `ketch_brain.json` (+2, one re-aimed), `ketch_relay.json` (+1), `ketch_fight.json` (+1),
`ketch_look_law.json` (+7, two re-aimed), `lostspoils.json` (+2, one re-aimed), `pelletsscarce.json` (+1), and re-aimed
by content `ketch_client.json` (1) and `ketch_look_light.json` (2) - the 22 each run once and dead.

## 18. KETCH-FIX - the invisible panels and the stuck share (2026-10-25)

The owner, from players: *"The invisable panels cam fuck up players and that loot gets stuck inside the chest at the
end"*.

**How they were found.** A reachability audit on the real ship: every part posed at each stage, the real Collider, and
a flood fill of the space a body occupies. The fill walks, jumps (with a running jump's carry), falls and climbs as
DFU's climbing does, seeded at every deck a ride reaches. Every collider face it touches is then checked from the
side the body stands on: does a drawn face show it there (culling is on, so a face shows from its front alone)? A
pinned check follows each fix. The one real-motor run that started it: on the bridge, a running jump at the fore rail
(0.95 m, no net) cleared it, passed through the engine house's aft wall and fell through the ship, past −43 m and on.

**Found and fixed:**
- **The engine house** (`world/ketch/ketchModel.js`) was drawn only, and its walls are seen from outside alone. Its
  walls, eaves and roof are solid now. Every invisible floor and wall a body found began in it:
  - its floor, which is the top of the gun deck's ceiling and was never drawn;
  - the hull's void past its floor;
  - the quarter wall's back, which a body climbed onto the waist's lid.
- **The deck between the house and the bridge** was never laid, so the hull's dark lay open under the fore rail. It is
  laid now (`ketchAftDeck`), solid, and its edge is the disc's own rim. The strips beside the house were drawn only;
  they are solid now and end at the house's aft wall.
- **Her sides below her deck** were drawn only. A body down her side passed through into the void between the gun
  deck's walls and the hull, and stood on the hold ceiling's undrawn top. That spot was recorded as its last ground, so
  every cast-back returned it there. Every run of the outline is now solid below the deck, in its own plane
  (`hullRunSolid`). The one exception is the bow's run, where the anchor-lift's cage rises.
- **The stairs' undersides.** The Watch hatch's stair and the hold's walked a slope that is solid from both faces but
  drawn from above alone, so under each stair there was an invisible ceiling. The kit's stairs now draw the underside
  (`soffitRec`).
- **The waist's lid** stays. It is the unseen ceiling at 7 m that stops anyone climbing out over the nets or the
  quarter wall, and its edge is the nets' top cord. From above, though, it was an invisible floor in the air. A body
  standing on it is now cast back as the nets cast it, with the same cost and line (`scenes/ketch/ketchDeckHost.js`
  `ketchOnLid`). The mast-lift's shaft is excepted, since its cage rides through that height.
- **The share stuck in the chest.** The chest threw its share from its middle, 0.6 m up, which is inside its own solid
  box (0 to 0.8). Every piece's first ray met the box's inside, and the run reproduced 80 of 80 pieces at rest in the
  chest. It now throws from its mouth, a metre out from its front and above its lid (`ketchChestMouth`). The throw is
  also kept to the cabin's floor (`KT_SPOILS_KEEP`, the Hour's keep law), between the chest and the door and clear of
  the stern lift's ring.

**Left as they are:**
- The rails' and nets' panels. Their bars and nets are drawn on them, so they are a railing's collision, not invisible
  walls.
- The stairs' slope under their treads.
- The lid's underside, which only a body climbing to the nets' top cord meets.

**Pins:** `test/world/ketch_panels.test.js` (5): the house and the aft deck on the real motor (three running jumps over
the fore rail, all stopped at the house's wall, none under her deck), the strips; her sides from outside, and the bow
open alone; the stairs' undersides; the lid's cast-back and its shaft; the share flown over the real collider from six
places to stand at six seeds, all on the cabin's floor and out of the chest, the door and the lift, and the keep
handed to the pool. `tools/mutants/ketch_panels.json`: 10, each run once and dead.

## 19. KETCH-PELLETS and KETCH-LONGER - more shot, a longer and harder raid (2026-10-25)

The owner: *"We need more aquireable sources of deeamer pellets"*, and from players: *"the raid is too short and too
easy"*. The owner picked from the options: the constructs drop Pellets; about fifteen minutes solo and twenty for a crew.

**Her constructs drop Pellets** (`systems/ketch/ketchSpoils.js` `KT_CONSTRUCT_PELLETS`, `ketchConstructPellets`). Every
construct downed lays a pile where it fell, on the dungeon's own dropped loot, for each hand aboard. Each screen gets
its own pile, as the share does. The amounts:
- a Sphere 2 to 4;
- a Sentry 3 to 5;
- a Hammer Warden 8 to 12;
- the Watch-Captain 10 to 15;
- the Tonal Warden 15 to 25;
- a vent spider one, at a 35% chance.

A body drops once, only on a fresh fall (`scenes/ketch/ketchFight.js` `fell`). A voyage's construct Pellets stop at
`KT_CONSTRUCT_PELLETS_MAX` (90), so nobody farms the vents. With no deck to lay them on, they go into the pack. This adds
to the chest's 20 to 40 a share.

**The raid retuned** (`RELAY_VERSION` world258 - world257 on its branch, renumbered past STAFF-EVENT BOSS at the merge). The live run went in about six minutes solo: the Watch in 24 s, the
Wardens in 7, the engine in 58, the Warden in 208.
- **The Boarding Watch:** five waves (`KT_WATCH_WAVES`, `net/ketch/ketchLaw.js`, the brain's and the HUD's one number),
  each fuller than before: spheres; spheres and sentries; more of both; the sentries' wall; the Watch-Captain with
  spheres and a sentry. The wire takes a wave to five, and the HUD says "wave {w} of {n}". A new line covers waves
  three and four, drafted in every language.
- **The constructs:** health about two and a half times (`hpS`: a Sphere 16, a Sentry 24, a spider 5, a Hammer Warden
  72, the Captain 100), and every blow a third again as hard (`p` ×1.35).
- **The Starved Engine:** it eats five cells and one for each two aboard, up to its seven sockets (`engineNeeds`). Its
  cradles charge in 28 s (20 before), and its spiders come every 6 s (9 before), five and the crew at once (three and
  the crew before).
- **The Tonal Warden:** a fighter's share is 600 s of reference damage (`KW_TTK_S`, 300 before). Its Keel-Strike,
  Steam Lash and Tonal Ring hit a quarter harder. The Ketch turns west at twenty-two minutes (`KW_ENDS_MS`, fourteen
  before), because the fight is twice as long.

**PIN MOVED:** `ketch_brain.test.js` (the numbers, the Watch's five waves), `ketch_deck.test.js` (the engine's appetite),
`ketch_warden.test.js` (the share and the end), `ketch_hud.test.js` (the first wave's spheres), `relayversion.test.js`
(world258). Re-aimed by content: `ketch_brain.json` (2), `ketch_deck.json` (1), `ketch_warden.json` (1), each run once
and dead.

## 20. AUDIT KETCH II - the raid read cold again (2026-10-26)

The owner: *"Can you audit the airship raid. Its a buggy mess"*. Five cold lanes read main as it stood
(`01-Overview/audits/Audit-Ketch-II.md`): the relay, the page, the rewards, the ship in the world, and the voyage run whole
at every crew size. They reported 36 findings, 30 defects once duplicates were merged. 26 are fixed, each pinned red on the
code as it stood, with a mutant (`tools/mutants/ketch_audit2.json`, 33, all dead). Two are left with their reasons. The
solo's time against the design's fifteen minutes is the owner's to set.

**The two that broke the raid came from the slices after AUDIT KETCH.** "Raise before the fall" hung the sky's branch on
`!aboard`, so she was never drawn over Daggerfall, nobody boarded, a fall woke at 1 HP and the next death aboard never fell.
KETCH-FIX shut her hull's bottom, so a fall from a section of the ring landed in her belly, short of the void.

**What changed:**
- **Boarding and the fall.** The page drives her sky off the ship again (L2-1).
- **The hull.** Her bilge and bottom are drawn only again, so a fall from a section reaches the void and is cast back to
  the core (L4-1).
- **The tracker.** The whole-state word carries the Watch's fourth and fifth waves (L2-2).
- **The body's word.** The page tells the room its health the whole voyage, not only in the Warden's fight (L2-3).
- **The lid and the roof.** Both always stand a body somewhere: where it stood on the main top, or its span's checkpoint
  off the Sailwalk. The engine house's roof is the sky's, so the Sailwalk can no longer be skipped over it (L2-4, L4-2).
- **The Pellets.** The construct cap is her voyage's, kept on the device. The bosses pay their own. Nothing is laid for a
  body the ship took off (`sw`), and a pile lies where its body fell, on the floor (L3-1 to L3-5).
- **The Watch.** It keeps inside the bow (`KT_BOW`, L4-4). A Sentry shoots when chased (L1-6), and each Sentry has its own
  post (L1-7).
- **The crew's count.** A construct's health and the engine's need come from the crew's kept places, not from who posed
  last (L1-3).
- **The clock.** Her crews have forty-five minutes after she weighs anchor (L5-1). A fight is lost after two minutes
  empty (L5-4).
- **The receipts.** A fall's receipts are told to the hub before her record goes (L1-4).
- **Smaller fixes:** the gust blows on the course's line alone (L4-6); the bulwark meets the disc (L4-7); the flywheel
  stands clear of the sockets, solid (L4-9); the hold's owed word is said again (L3-6); a raised member is alive at once
  (L1-5); the lab says five waves (L5-6).
- **The health bar.** After the audit, the owner asked about health bars on her constructs: the target bar now marks a
  host body struck and reads the relay's word of its health. This holds for every event's host bodies: the gate's, the
  Spire's, the Hour's and hers (STAND-IN-BAR).

Relay world266 (world265 on its branch, renumbered past GATE-COURTS' at the merge), NOT YET DEPLOYED.

## 21. KETCH-WORDS - the raid's words, plain (2026-10-26)

The owner: *"Please rework the texts of the raid and the books/quest. Remove the "her" mentions and make it not ai-like
and non overexplanstory"*.

The ship is "it" now, never "she", everywhere a player reads about it. The text was cut down: shorter lines, no
explaining a mechanic twice, no lore padding.

- **The raid's lines** (`systems/ketch/ketchWords.js`, `net/ketch/ketchLink.js`, `net/ketch/ketchClaims.js`,
  `scenes/ketch/ketchClient.js`, `scenes/ketch/ketchSky.js`, `systems/ketch/ketchSpoils.js`, `ui/ketch/ketchHud.js`,
  `systems/eventTimers.js`, `systems/tutorialCatalogue.js`, `systems/questlines/qlLines.js`): 51 lines rewritten.
  Their keys and arguments are unchanged, and every language is drafted again from the new English.
- **The questline** (`systems/questlines/quests/QLSK01.txt` to `QLSK04.txt`): every message rewritten, the same
  messages under the same numbers. Imrah keeps her own "she"; the ship has none. The lore stands: the Rourken and
  Volendrung, the lodestone and what it follows, the Numidium's pieces, the two rewards.
- **The books** (`systems/portBooks.js`): *Rourken Thunder* and *The Ketch That Never Lands* rewritten in plainer prose.
  The Ketch book no longer says the ship keeps station "a day and a half" (KETCH-EVERY made it seven hours, every ten).
- **The herald's Discord cards** (`net/ketch/ketchHerald.js`): the three posts reworded. Relay world267, NOT YET
  DEPLOYED.

**Not changed:** the relay's own English refusals (`net/ketch/ketchLaw.js` `KT_TEXT.refuse`). The page reads them back
word for word (`ketchRefusal`), and one of them forgets a kept ship (`ketchClient.js`), so they are wire words.
Changing them before the relay is deployed would break both. Players see the page's own `KT_REFUSE_WORDS`, rewritten
above.

PIN MOVED: `ketch_hud` (the clock's words), `l10n4_hardcoded` (the books' count, 57 -> 56), and every `RELAY_VERSION`
pin (world267).
