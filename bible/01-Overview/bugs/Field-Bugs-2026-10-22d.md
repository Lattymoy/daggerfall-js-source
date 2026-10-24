# FIELD BUGS 2026-10-22d - a gift's two Shields, a 5 GB tab, ships that surge, a lair with no door, and the quest marks

Five threads from the Discord's #bug-reports, handed over as phone screenshots with no word beside them: PauloHF's
"[Glitch] Overpowered spells", Foretold's "Memory Leak" (Xuurath, iamamitten and Mona Polca beneath it), Dahazed's "huge
amount of lag and ship warping during sea boss fight", fogs' "Revenant lair is inaccessible" (on Zenako's behalf), and
Stoned Jesus' "Quest tracking stopped working in overworld and dungeon maps". Read on main's `c7e5395cc`, with the
freeware's data (`tools/fetch-data.sh`) wherever the map, the blocks or the models decide, and Daggerfall Unity's
`Assets/Scripts` (the parity sparse clone) for the spell law. Every system changed here is the port's own - the gift
between players (ALLY-CAST), the revenants (RVN7), the peers' boats (CSA-K) and their art (LAYERED-PEERS) - so no DFU
member moves; the one place the port's spell law stands apart from DFU's (one bundle's like-kind effects merge) had no
Ledger row, and has one now (Port-Ledger section A, AUDIT FB1022d A3). Where DFU behaves otherwise it is said below.
Named 22d: main's 22, 22b and 22c were taken first. Then audited (the owner: "Audot this"): five cold lanes, every finding
fixed, pinned or answered - AUDIT FB1022d, at the foot. The pins are `fb1022d_*` (26 tests in five files), the mutants
`tools/mutants/fb1022d.json` (64: 63 dead, 1 equivalent as recorded).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "a shield with 6002 strength, 1600 duration, and AoE (not mine). And yes, both shields work" - the buff's card: "Absorbs 2829 more damage." over "Absorbs 3001 more damage." in one bundle, Mega Shield | A party mate's spell carrying one effect twice stood it twice: the tags that keep a mate's bundle apart from mine are stamped at the bundle's tail, so the gift's second Shield read its own first one as somebody else's. The magnitude itself is the law's: 1 + 100 a level at the gift's level 30 | GIFT-ONE |
| 2 | "an instance out of 7 that is leaking 5gb of ram"; "massive memory leak on desktop app"; "started ... about 2 days ago" | Measured in the real game, without peers: the Snowfall blanket kept every map pixel left behind (SNOW-HOLD, fixed by #1106 on 2026-10-21 - a journey's heap grew 1.18 to 1.94 GB over 38 map columns on the tree before it, and stays flat on main). Beside it: every armour outfit another player was seen in stood for the session - not measured in a session with peers | PEER-ART; SNOW-HOLD already on main |
| 3 | "the boss fight turns into dodging friendly ships while they randomly speed up / warp in front of you"; "couldn't do thing from all the lag" | Another player's boat was led 0.6 s past her word and then held; a crowded cell's relay carries only her full frames (every 2 s), so she stood still 1.4 s and then ran 17 m in a fifth of a second | SEA-GLIDE; the relay's share and the fight's frame named, not changed |
| 4 | "the Revenant lair designated on the Revenants page is inaccessible ... The Stuvam Graveyard, south of Ceriburea ... approximate coordinates 565, 427" | 28 graveyards MAPS.BSA flags with a dungeon lay a block (GRVEAS10, GRVEAS36) that places no dungeon-entrance door; a lair could be one. The Stuvam Graveyard (Alik'r Desert, pixel 565,427) is | LAIR-DOOR |
| 5 | "Quest tracking worked yesterday in overworld map and dungeon map now it just straight up doesnt show up anymore" | Not reproduced. Nothing on the chain the marks are drawn by changed between the day before and the report's hour; the audit found world.js's wrapper dropping the look's word (E8, fixed) - a cost, not the loss | asked of the player |

## GIFT-ONE (1) - `06-Systems/Online-Arc.md` AUDIT ALLY-CAST

THE SPELL. The card's two lines are two live Shield entries in one bundle named Mega Shield. "Not mine": a gift (a party
mate's cast, or a stranger's under SPELL-GIFT), which the receiver applies as a self-cast at the caster's level, clamped
to 30 on the wire (`net/wire.js` CAST_LEVEL_MAX). Shield's magnitude is DFU's (BaseEntityEffect.GetMagnitude,
`EntityEffect.cs:800-801`): base 1..1 plus 100..100 every 1 level = 3,001 at level 30 - the spell maker's spinners at
their tops (`systems/spell/spellMaker.js` SPINNER_RANGES, EffectSettingsEditorWindow's SetRange), and 2,829 is the first
pool after 172 points of blows (the first live pool soaks first, `characters/playerEntity.js` damageShieldPool). The
duration, 40 + 52 a level = 1,600 rounds, is in range too. So the numbers are the law's at level 30; what is not is TWO
pools.

WHY TWO. AUDIT ALLY-CAST C2 keeps a mate's bundle beside mine: the incumbent law (`systems/effects.js` applySpell's
`findInc`) reads `bundleAlly` and `bundleDuel` on every entry, and those are stamped on the cast's entries at the
bundle's TAIL, after its loop. A gift carrying Shield twice pushed its first entry, untagged; the second asked for an
incumbent with `bundleAlly === true`, found none, and pushed another. Three Shields, three pools; a Fortify Strength twice,
two stacked. The caster's own cast of the same record had always merged into one (its entries untagged match its own
`false`). Not a crafted frame - an honest Mega Shield, made at the spell maker and cast as an area blast on a party.

FIXED: an entry the cast itself pushed is the cast's own, read without its tag - known by WHO it is, not where it stands
(AUDIT FB1022d A1: `prior`, the list before the cast; as first shipped, by index past the list's length, and a Cure in
the same gift rebuilds the list under the cast, sliding its own first Shield below that index). One pool a gift, as one a
cast; a mate's bundle still stands beside mine. DFU, for the record: its AssignBundle adds the instanced bundle to the
manager only after its loop (`EntityEffectManager.cs:615`), so two like-kind effects of ONE bundle both become
incumbents there - but only the first Shield ever absorbs: DaggerfallEntity.DecreaseHealth asks FindIncumbentEffect<Shield>
(`DaggerfallEntity.cs:322`), which answers the first Shield in the list, spent or not (`EntityEffectManager.cs:668-680`),
so DFU's own Mega Shield absorbs 3,001, as the port's one pool does (AUDIT FB1022d A2; the record had said "both shields
work" was DFU's behaviour). A Fortify twice is twice in DFU and once here - the port's own law, now Ledger A's row.

THE BOSSES. "Maybe it's because some players have found glitches" - a Shield takes nothing from a boss. A world boss's
damage is held by the relay to a bucket per player (`11-Multiplayer/World-Bosses.md` section 5, "the damage a player
may deal"), so no spell, crafted or not, kills one faster than that bucket lets it.

PINS. `test/systems/fb1022d_giftone.test.js` (3), over the spell maker's record, the caster's frame, the wire's
projection, the receiver's gift and the receiver's own door (hostMagic applySpellToPlayer, as world.js online.onCast calls
it): Mega Shield's gift is one pool of 3,001 and the report's 172-point blow leaves 2,829 with nothing behind it; three
Shields one pool; Fortify twice one; mine beside a mate's (C2); and a Cure in the gift over a spider's Paralyze, in
either order, still one pool tagged the mate's - and a weak gift so cast never swallows my own Shield after it (A1).
No duel pin: nothing has passed `duelCast` since INT8 sent a duel's spells to the referee (world.js duelSpellOut), so
the duel arm is a shape no producer mints (A4). The pin on the incumbent line (`allycast.test.js`) and its mutant record
(`tools/mutants/allycast.json` AAC-effects-gift-merges-with-mine) moved with it.

## PEER-ART (2), and the memory - `04-Characters/Layered-Gearing.md` Online

MEASURED (a session-local probe over the real game in Chromium, the freeware's data, the draw calls stubbed, the JS heap
read after a forced collection; the figures stand here, the probe was not committed). A warp journey west from
Knightstale, the same on two trees:

| Tree | The heap as the journey crosses map columns |
|---|---|
| main just before #1106 (`f49e6aad9`) | 1,176 -> 1,407 -> 1,675 -> 1,941 MB from pixel column 942 to 904 (38 columns, ~20 MB a column); the renderer's resident set reached 4.0 GB |
| main (`c7e5395cc`) | 1,178 -> 1,309 -> 1,316 -> 1,268 -> 1,286 -> 1,313 MB over 67 columns - flat |

The growth fits SNOW-HOLD (FIELD BUGS 2026-10-21b, merged 2026-10-21 17:44 EDT): the Snowfall blanket queued every pixel
the traveller left behind and drained it only while its tier was not recentring - never on the move - each queued tile
holding its pixel's whole entry (~2 MB a pixel, ~22 MB a column crossed, ~1.5 GB an hour at a gallop). WHAT THE PROBE DID
NOT SETTLE (AUDIT FB1022d D5): the two trees are 21 first-parent merges apart (the #1106 merge itself, `70797d323`, was
not probed), so the comparison is not isolated; it ran with no other player in sight, so PEER-ART's share was not
measured; and a JS heap is not the GPU process, which may be the "instance" Task Manager shows. "About 2 days ago" fits
PRECIP (#1053, 2026-10-19), which ran the Snowfall wherever snow lies within some ten pixels in any season, with the
online sky's calendar into Evening Star on 2026-10-22 - and fits LAYERED-PEERS and LAYERED-GEAR-ON (2026-10-19) as well.
The reporter's build is not known. A player on a build from before #1106 still has SNOW-HOLD. Idle in a town the heap
grew 1.3 MB in some 1,900 frames (the blanket filling to its 49 tiles and stopping); 240 pixels built and destroyed left
42 MB alive, the weather's own state.

FIXED HERE: THE PEERS' ART STORE. `net/peer/peerRiders.js` createEotbArt kept every sprite's decoded pictures (`pixels`)
for the session and let a texture go only for a rider's horse look (COATS1). Since LAYERED-PEERS (2026-10-19) every other
player on foot is a walker in the armour they wear - some 55 sprites of their own outfit - so every outfit met online
stood for good: ~4.1 MB of decoded pixels and 55 uploads each, none ever let go (120 outfits kept 497 MB, headless). An
outfit is a look now (`spriteLookOf`: `LA:<body>:<combo>:<pieces>`, a horse's coat as before), let go with every texture
of it once more than RIDER_LOOKS_KEPT stand and it has stood undrawn RIDER_LOOK_IDLE_MS - by the store's once-a-frame
sweep, after every layer drew (`sweep`, from the riders' `settle`), never one drawn this frame or the last (AUDIT FB1022d
D1: as first shipped the eviction ran inside the draw, so after a 2 s hitch every look still to be drawn that frame read
idle, and a crowd of 30 outfits lost 29 for five frames and decoded 232 sprites again; D2: and every draw past twelve
looks copied and sorted them all, 80 us a frame at 30 walkers). The decoded pictures are the RIDER_PIXELS_KEPT (64)
sprites most recently asked (a mirror asked soon after its sprite shares its decode). MY OWN BODY lets its last outfit go
(D4, `player/eyeOfTheBeholder/eotbBody.js` releaseOutfits): armour put on or off, the body changed or the skin off, the
last outfit's textures and decoded strips go once the new one is up (a strip still decoding is not put back when it
lands), the frames a cloaked outfit shares under its plain code kept - LAYERED-GEAR-ON makes the worn-armour body the
default, so every piece put on was a new outfit kept for the session. ONE CACHE, TWO STORES: the renderer keeps a texture
by its archive and record alone, and my own body's store uploads under the same keys - an outfit or a horse's look can be
mine and a peer's at once, so a look one store let go took the other's texture from under it, and that store, believing
it up, drew from nothing (COATS1's horse looks could already do it). Each store now asks the renderer's cache whether its
texture still stands before it trusts it (`renderer.textures.has`, the hosts' own test before a frame's upload), for any
key, and uploads it again from the pictures it kept - one frame unseen, where before it was unseen until the look changed.

THE BOUNDS NOW (D6): the peers' decoded pictures, 64 sprites (~5 MB at ~75 KB each); their textures, the looks on screen
plus RIDER_LOOKS_KEPT (12) idle, some 55 textures a look; my own body, one outfit (and the frames its cloak shares). A
crowd turning costs more decodes than before (mirrors no longer share across a crowd: 960 to 600 over a minute of 30
walkers), flat, not a thrash.

PINS. `test/net/peer/fb1022d_peerart.test.js` (7): the look; the outfit let go and one drawn kept; the pictures kept,
and the bound itself (one asked 63 sprites since shares its decode, 64 since does not); both stores over one cache - a
worn-armour sprite and a horse's look in the peers' store, my body in its armour and in a class skin, driven as the world
host drives it; a crowd of 30 outfits through the world host's frame (riders, walkers, the riders' settle) at 60 fps
through a 2.5 s hitch - none let go, none decoded again, one missed the hitch's frame stands, two who pass by go alone,
a crowd gone goes down to the bound and not before; my body's outfit changed (released once the new is up, never before;
the cloak's plain frames kept; the skin off lets every outfit go); and an outfit let go while its strips decode keeps
none. `coats1_horsecoats.test.js` (PIN MOVED: a frame swept) and `prww1_werewolf.test.js`'s fake renderer (it records its
uploads, as the renderer does) moved with it.

READ AND LEFT (bounded, or not measured): the Snowpack's lattice points (`systems/weather/snowpack.js` `points`, ~9.5 MB a
thousand pixels walked, bounded by the map); the Enemy Expansion's HD pictures through the pinned upload (#1067, up to
~0.5 GB as each kind is met, bounded); `remotePlayers` and `peerBodies` caches (both before 2026-10-19; `_dolls` already
kept in insertion order). Read and cleared: OW-HORIZON's far ring, OW-HITCH's ground sets, the SHADER-STALL program map,
NPC-MARKS, NODE-GLINT, GATE-MIX, the DEX placeholders, the Starfall, the grass rim, TRADE-VIRT; and the caches the merge
of main brought (`saidTo` 64, `mine` 8, `seen` 64, `due` SEA_WRECK_KEPT_MAX, `_days` 4, `shut` by ship). The baseline is
high on its own: the heap after a collection at a boot into the world is 1.18 GB (121 pixels at ~3.3 MB).

## SEA-GLIDE (3) - `03-World/Come-Sail-Away.md` Sailing together

THE SEA BOSS is SERPENT1's Sethrakul (`11-Multiplayer/Sea-Serpent.md`); the "friendly ships" are the other players' boats,
drawn from the `sa` word on their foes frames (`scenes/comeSailAway/comeSailAwayPeers.js`): a delta every 200 ms, a full
frame every 2 s (`net/online.js` FOES_MS, FOES_FULL_MS). CSA-K led a word's way 0.6 s past its arrival and then held the
boat, and eased onto the next word at 12 a second. Where the room's fan passes its budget the relay drops the deltas and
keeps the full frames (FOES-FIRST) - a sea fight's crowd is such a room - so a boat at 12 m/s stood still 1.4 s of every
2 and then ran the 17 m to her next word in a fifth of a second. Over the real pool and module, a boat at 12 m/s drawn at
60 fps:

| Words | CSA-K (0.6 s, the ease) | SEA-GLIDE as it stands |
|---|---|---|
| full frames alone, each up to 300 ms late | fastest 195 m/s, 70% of frames stopped, p99 19 m off | fastest 14.6 m/s, slowest 9.4, none stopped, p99 3.1 m |
| full frames alone, each held up to 1.5 s (FOES-HOLD) | 195 m/s, 70% stopped, 32 m | 15.3 m/s, none stopped, 13.9 m (her way times the hold) |
| every delta, 40-250 ms late | 40 m/s, 4% stopped, 3.2 m | 13.9 m/s, none stopped, 1.8 m |
| circling at 10, 20 or -15 degrees a second, full frames alone | - | p99 1.8 m (led straight, as first shipped: 12 m at 10, 20 m at 20) |
| she stops dead 0.1 s after a full frame, full frames alone | overshoot up to 7.2 m, eased back | led on to her stop's word (~24 m past where she stopped), glided back at 3.3 m/s at most, never snapped, her passenger on the one hull (as first shipped: past her 20 m snap, teleported back at 1,458 m/s for a frame, the passenger left on a still copy) |

FIXED: CSA_PEER_LEAD_MAX is two full frames' spacing (4 s; at the sea's own 2.5 - navalHost.js PREDICT_MAX_S - a full
frame held for its turn still stalled 1% of frames), and under way what the word says she is off by is taken up at a
bounded catch of the sea's PUPPET-GLIDE shape (`glideToward`: 1 a second, never faster than 0.3 m/s plus a quarter of
her way - `scenes/naval/navalHost.js` PUPPET_CATCH, the fix for "Ai ships move very janky and quick", FIELD BUGS
2026-10-02d; the puppets' share is a tenth, sized for a relay's jitter, and a quarter takes up a hitch's, a bumper's or a
stop's metres in 4-7 s, not 10-15 - AUDIT FB1022d C3). AUDIT FB1022d: she is led along her turn's ARC (`wayOver`, C2 -
led straight, a boat circling at 10 degrees a second stood 12 m off her track, her hull 19 degrees off it); and the way she
was led at stands until what she is off by is under CSA_PEER_LED_SETTLE_M (1 m, C1): her snap, her glide back and the
realign's pairing of a hull with a passenger aboard are judged by it, not by her word at rest. A boat lying still eases
onto her word as before; past the snap she snaps, under way too. Pinned on the real pool and module
(`test/scenes/fb1022d_seaglide.test.js`, 6): the numbers; the take; the report's fight (never stopped, never past her way
and the catch, within 4 m of her place, within her way times the hold where the full frames are held); the stop (no
snap, the passenger kept, back on her word); the circles; a teleport under way snaps, a slow boat glides, and a boat
that stopped and settled is at rest again (a 25 m step of hers snaps). `csa_together.test.js` and AUDIT SHIPS A7's pin
(`auditships_sail.test.js`) moved - A7's hitch now outlasts the lead (CSA_PEER_LEAD_MAX + 2 s) and she is held to her
way plus a metre at its end once she has converged (C5: as first moved it was loosened to her snap).

NAMED, NOT CHANGED (each its own decision):
- THE RELAY'S SHARE. A moving boat's word lives in the deltas the budget drops first - her stop's word too, so a boat
  that stops sails on to the next full frame. Over the real Room with the wire's own frames (a probe of this session's,
  not committed): ~1.4 KB frames reach every listener up to 20 ships, 74% at 24, 47% at 30 - a cliff, not a slope. A
  floor for `sa` (a few words a second an owner, its change key first) or the boat on the pose stream would make the
  full frame its worst case, not its only one. A relay change, with its deploy.
- THE CLOCK. No boat word carries the sender's time, so a word's lateness is drawn as distance; OWNER-CLOCK's `tm` rides
  the foes frame and only the foes' puppets read it (`net/ownerClock.js`). Leading a boat on it is the next step.
- THE BUMPERS (SERPENT4, `scenes/naval/navalHost.js` withBumpers): in the serpent's waters my ship is pushed off every
  peer hull as it is drawn, up to 30 m/s - a hull drawn wrong was a real shove. With SEA-GLIDE she is drawn within a few
  metres sailing straight or circling, and up to her way times the lateness off while her words are held or she stops.
- THE HEADING (C4): her heading is still corrected at CSA_PEER_TURN_RATE (12) with no bound - when she reverses her turn
  a deck point 12 m forward moves at 105-117 m/s for a moment (CSA-K's law gave 222). Not a regression; a whip a
  passenger feels.
- THE FRAME. The world host clamps a frame's dt at 0.1 s: below 10 fps a peer's boat moves slower than her word's way
  says, and a slow client's world runs in slow motion while the others' ships do not; `systems/naval/navalShots.js` tests
  every ball against every hull and rig box (N^2 as ships and volleys grow); BOAT-FAR's far law begins at 600 m and the
  fight's ring is 420 m, so every boat of it is walked and skinned. The fight's frame was never profiled (Sea-Serpent.md
  section 16 says so); "I couldn't do a thing from all the lag" on a Ryzen 9 and an RX 7900 XT wants that profile.

## LAIR-DOOR (4) - `12-Enhanced-AI/Feud-Arc.md` 18.1

THE PLACE. The Stuvam Graveyard is the Alik'r Desert's location 108 at map pixel (565, 427) - the report's coordinates to
the pixel - six pixels south of Ceriburea, a Graveyard (type 12) with `hasDungeon`. Its one block is GRVEAS36.RMB, and no
model it places carries a dungeon-entrance door (DFU's door law, `world/meshReader.js` subMeshDoorType: archive 56, or
331 past its stone record) - so in the port, as in DFU (PlayerEnterExit goes down only by such a door), nobody walks
down into it. Its crypt is a static model, as the report says. (A start, a quest's `transfer pc inside`, a respawn, a
Recall or a vampire's cemetery wake can still set a player inside one - CRUX1's doorless `startInDungeon` arm,
`dungeonStartDoorFor` - but none of them is a way the player chooses: AUDIT FB1022d B7.)

THE WORLD. Every location MAPS.BSA flags with a dungeon, its blocks laid as the pixel build lays them and every model's
mesh read: the 1,500 labyrinths, 843 keeps and 1,112 ruins all place a door; 28 of the 774 graveyards do not, every one
on GRVEAS10 (15) or GRVEAS36 (13), the same 28 on the enhanced layout (re-derived from the raw submeshes by the audit).
No vendored world-data pack replaces any dungeon row or any of the 134 dungeon blocks. A revenant's lair was one of the
boards' ring's named dungeons (RVN7a), so any of the 28 could be marked on the page and the map as a hunt nobody can
finish.

FIXED: the world host's door (`scenes/lairHost.js` createLairDoor, out of bootWorld) offers only the ring's dungeons the
player can go down into - measured on the place as the pixel build lays it, a place and a model each read once a session,
a place the host cannot lay or whose models the archive lacks left a lair as before; the ring is laid only when it is
read (B6/E10: the mend asks `enterable` and `nearest` alone). A kept lair the host says nobody can enter is chosen again
at the next deed in the open world (`revenantFeud.js` lairAfter, `lairEnterable`); one already held is moved by every
reader of a lair - the page, the map's circle, the hunt, the rumours, and a deed before it reads the lair (B3) -
(`revenant.js` mendRevenantLairs) to the enterable dungeon nearest it within LAIR_MEND_PX (20 px on the larger axis, the
rumour's reach in number; the rumour's own is a circle), known as it was known; with none, it roams unheard of - and a
Dread, which never comes on the road, keeps its lair rather than nowhere (B4). The mend waits for the character's mirror
and asks a record again when its lair moves (B1: run on a load's first quest tick, before the mirror was read in, it
moved the save's copy, the mirror's newer one put the old lair back, and the session never asked again). The Stuvam
Graveyard is the one of the 28 whose own ring holds no other dungeon (nothing stands within 13 px of it): its revenant
goes to Morarker's Nest, 14 px south - in Dak'fron, so the towns that tell of it are Dak'fron's, not the Alik'r's (B7).
Every other of the 28 has one in its ring, and every one of the 28 has an enterable den within 20 px.

PINS. `test/systems/revenant/fb1022d_lairdoor.test.js` (9): the blocks' law; the door (the ring filtered, the regions, the
nearest, a place laid and a model read once, the unjudged kept); the lair after a deed; the mend (moved and known, asked
once a record and pixel, roams with none, asked again where the host cannot say); the wiring by source; on the player's
data the 28, the Stuvam Graveyard among them and never offered from Ceriburea, each with a den within LAIR_MEND_PX; the
load's order (B1); the deed's mend and the Dread (B3, B4); and the reach, the skin's key, the name's cut and the lazy ring
with no data (B5, B6). `rvn7a_lair.test.js`'s two wiring pins and four `tools/mutants/rvn7a.json` records
(RVN7a-kept-moved, -world-unwired, -world-regionless, -door-shut), and two of `rvn7c.json` (RVN7c-marks-switch,
-rows-switch), moved with the door.

## The quest marks (5) - not reproduced

THE CHAIN. The Overworld's quest marks (OW-QUEST, `scenes/travelViewMarks.js`) and the held map's (GUIDE5) are
`ui/quest/questMarks.js` questMapMarks over the tracker's last look (`ui/quest/questTracker.js` `views`), fed by the quest
bridge's tick (`scenes/quest/questBridge.js` news: `lens.look`), under the Quest marks switch on the enhanced skin; a
place's pixel is the travel map's own (`ui/travel/travelMapWindow.js` placePixelMemo). A dungeon's map marks a quest only
under the Quest guidance switch's Exact tier (GUIDE8, `scenes/worldModes.js` dungeonQuestMarksHere) - the Journal tier,
the default, never marks inside a dungeon - so a player who saw marks in a dungeon yesterday had Exact on.

WHAT WAS READ. Every change to main between the evening before (`4bba28c6c`) and the report's hour (to #1130): nothing
in questMarks.js, questTracker.js, questGuidance.js, questLens.js, questRail.js, questBridge.js, travelViewMarks.js's
quest block, the automap's quest sheet, uiPrefs or uiSkin; the online lane forces neither switch. MAP-PAN (#1016) baked
the held world sheet's place marks into a layer - the quest diamonds stay on the overlay, painted every frame after it.
NPC-MARKS (#1121) reads quest people and writes nothing of a quest. The travel map's pixels for quest places read true
on the player's MAPS.BSA, regions interleaved. The quest-mark suites (guide1, 2, 3, 4, 5 and 8, owquest, sd20g's delve:
66 tests, 104 with audit_guide; the bridge driven with real quests) pass on main.

THE LOOK THE GAME RUNS (AUDIT FB1022d E8). The lens asks the walk for no window rows (`bridge.questLog({ windows: false
})`, AUDIT QUESTLINES LAW-11), and world.js's BOUNTY1 wrapper - the bounties, the revenant hunts and the death quests laid
on the walk - took no argument, so every look at 10 Hz walked the questlines' and the ladders' rows too. Nothing in the
window makes those rows throw; the wrapper hands the word on now (`test/scenes/fb1022d_questlook.test.js`, world.js's own
text run).

ONE THING THAT WOULD DO IT: a look that throws on every tick from a load. The bridge tries again each tick and says so
once a session - `[quest herald] the lens could not look (...)` in the console (`newsWarned`); a throw mid-session keeps
the last good look (the marks stand, stale) and the next good look puts them right (E9: the record had said the tracker
"hears nothing more that session"). So the marks vanish only where every look since the load has thrown; a later failure
prints nothing. Nothing found makes the look throw on main.

## Asked of the players

- The overpowered spell: nothing to ask - the gift is fixed; a level-30 caster's one Shield of 3,001 is the law's.
- The memory: the update number the game shows (REL8) - before 2026-10-21's #1106 or after;
  whether it grows standing in a town or only on a journey, on foot or on a horse, online with others in sight or alone;
  which process in Task Manager grows (the renderer, or the GPU process); and the `crash.log` RENDERER-GONE writes beside
  the saves.
- The ships: how many players were in the fight; whether the warping boats were Come Sail Away boats or the sea's ships;
  the client's frame rate in it (the FPS counter).
- The quest marks: online or offline; the skin (Enhanced Plus or Classic), and in Settings -> Features the Quest marks
  switch and the Quest guidance tier; whether the quest card still shows and the journal's Track still answers; whether
  the quest's place is on their map; the update number; whether the marks were gone from the moment they loaded or went
  later in a session; and, if the console can be opened after a reload, any `[quest herald]` line.

## Found on the way, not fixed here

- QUESTS CAN NAME THE 28. `systems/quest/place.js` `_isDungeonType` takes graveyards as DFU's Place does, so a quest's
  remote dungeon can be one of the 28 graveyards nobody enters - DFU behaves the same. Not the report's.
- SPAWNED DUNGEONS CAN CLONE THE 28 (AUDIT FB1022d B2). Online, `world/spawnedDungeons.js` spawnTemplates answers all 4,229
  dungeons, the 28 doorless graveyards among them, and `_spawnCloneAt` clones the template's exterior - so about 0.66% of
  spawned dungeons would stand with no way in (the template list is proved; a doorless spawn was not stood in a session).
  `wildHallTemplateOk` already leaves graveyards out of the wild halls. The spawns' template law is SPAWN's own slice: a
  door filter there, by the same test as lairHost.js's.
- THE DOOR'S FIRST ASK (B6, E10). `enterable` lays a place and reads its models the first time it is asked: 8-41 ms in
  node for a held lair and its `nearest`, once a pixel a session, on the first look of the page, the map or the quest
  tick, or at a deed. The ring is no longer laid for the mend; warming the memo off the frame is a later step.
- AUDIT-SHIPS-A5-the-gain-on-every-coast (`tools/mutants/auditships_sail.json`) survives on main as it does here; so do
  ARENA-LADDER-2-revenant-gate (`arenaladder.json`) and HORSEFACE-the-placing-paints-minus-one (`fb1004e.json`), run
  against main's `a61d01901` - their own slices' pins, not this one's.

## AUDIT FB1022d (2026-10-22) - the slice, read cold

The owner: "Audot this". Five lanes, each a cold reader of the merged tree (`e80d6f798`) in its own scratch copy - the
repo untouched while they read (DO NOT FIX WHILE THE VERIFIER IS READING) - each told to prove a finding by a repro over
the real code before reporting it: A the gift (GIFT-ONE), B the lair (LAIR-DOOR), C the boats (SEA-GLIDE), D the art
store and the memory (PEER-ART), E the record and the process, then the quest marks from scratch. Every finding was
reproduced by its lane's own script before it was acted on; every fix is pinned, each pin failing on the code before it.
The mutants after it: `fb1022d.json`'s 64 (34 of them the audit's) 63 dead and 1 equivalent as recorded; and every
other list's records on the six files the audit touched beside world.js (whose one line, E8, has its own mutant) - 770 of them, from 98 lists - 766 dead, 2 equivalent as
recorded, 2 surviving that survive on main as well (Found on the way).

| # | Sev | Finding | Disposition |
|---|---|---|---|
| A1 | should-fix | The cast's own entries known by index: a Cure in the gift rebuilds the list (`cureAllOfKind`), the cast's first Shield slid below the index - [Shield, Cure, Shield] over a spider's Paralyze stood two pools of 3,001; the slid entry missed the tail's tags too, so a weak gift's pool swallowed my own Shield after it (C2's bug) | FIXED: by identity (`prior`); the held-item pin and the tail stamp over `ownEntries()`; pinned, both orders and the weak gift |
| A2 | doc | "Both shields work" is not DFU's behaviour: DecreaseHealth's FindIncumbentEffect<Shield> answers the first Shield, spent or not | FIXED in the record (GIFT-ONE) |
| A3 | nit | One bundle's like-kind effects merging is a departure from DFU with no Ledger row (Fortify twice is twice in DFU) | FIXED: Port-Ledger section A row |
| A4 | nit | Nothing passes `duelCast` since INT8; the duel pin pinned a shape no producer mints | FIXED: the pin dropped, the record says the arm is dead |
| A5 | tests | The behaviour pins could not tell the index from near rewrites (`a.bundleId == null`, findLast) | FIXED by A1's pin (by-index dead); `a.bundleId == null` recorded equivalent - no producer leaves a mergeable kind untagged |
| B1 | should-fix | The mend run before the character's mirror (a load's first quest tick comes before the encounter tick's ensureMirror) is undone by the mirror's merge and never asked again that session | FIXED: no mend before the mirror; asked by record and pixel (a WeakMap - a record the mirror's merge or a load makes is asked afresh); pinned in the load's own order |
| B2 | should-fix (own slice) | Spawned dungeons clone the 28 doorless graveyards | NAMED (Found on the way) |
| B3 | nit | A deed before any reader re-picked the lair and dropped it unheard; the readers move it known | FIXED: the deed mends first; pinned |
| B4 | nit | A Dread mended to nothing would be stranded (never on the road, never at home, holding the one Dread slot) | FIXED: a Dread keeps its lair when no den is in reach; pinned (not reachable on the game's data) |
| B5 | tests | Survivors: the reach 12 (only the data-gated pin read it), the save dropped, the trail kept, the memo's skin, the name's cut | FIXED: each pinned without the data; mutants dead |
| B6 | nit | The first ask of a pixel is a synchronous 22-41 ms | FIXED in part (the ring lazy); the rest NAMED |
| B7 | doc | "Nobody enters them" overstated; the rumours' region changes; the reaches differ in shape | FIXED in the record, Feud-Arc 18.1 |
| C1 | should-fix | A stop between two full frames ran 24 m on, past her snap: teleported back, a passenger left on a still copy of her hull | FIXED: the led way stands until settled - the snap, the glide back and the realign's pairing by it; pinned |
| C2 | should-fix | Led straight for 4 s, a circling boat stood 12-20 m off her track, her hull 19-44 degrees off it | FIXED: led along the arc (`wayOver`); pinned at 10, 20 and -15 degrees a second, and the arc's sense |
| C3 | should-fix | PUPPET-GLIDE's tenth took 10-15 s to take up a hitch's, a bumper's or a stop's metres - and the drawn hull is the bumpers' and the shots' | FIXED: a quarter (4-7 s, at most 1.27 times her way); pinned |
| C4 | nit | Her heading corrected at 12 with no bound - a reversal whips a deck point at 105-117 m/s | NAMED (not a regression: CSA-K's 222) |
| C5 | tests | A7's end check loosened to her snap; a teleport under way and a slow boat unpinned | FIXED: A7 held to v + 1 m once converged; both pinned |
| C6 | doc | The stop row, "within metres", the module's head, csa_together's comment, the Testing-Rows row | FIXED, each |
| C7 | nit | `glideToward` built four arrays a boat a frame; `sceneWay` ran twice | FIXED: the level's ease inline, the pose's way kept |
| D1 | should-fix | Eviction inside the draw, on the wall clock: after any 2 s gap a crowd's on-screen outfits went (29 of 30 unseen five frames, 232 decoded again) | FIXED: once a frame after every layer (`sweep`), never a look drawn this frame or the last; pinned through the world host's frame |
| D2 | nit | Past twelve looks every draw copied and sorted them all (80 us a frame at 30 walkers, 191 scavenges to 18) | FIXED by D1's sweep (copies only when one is to go) |
| D3 | tests | Survivors: no idle filter, the horse look between the stores, the bound of 64, the recheck limited to worn armour | FIXED: the crowd, the hitch, the passers, the bound, the horse and a class skin across the stores pinned; mutants dead |
| D4 | should-fix | My own body kept every outfit it wore (textures and decoded strips) - LAYERED-GEAR-ON made it the default | FIXED: releaseOutfits, once the new outfit is up; pinned, the in-flight strip too |
| D5 | doc | SNOW-HOLD's attribution plausible, not isolated; the table's columns; no peers, no GPU | FIXED in the record (the probe's limits stated) |
| D6 | doc | The bounds unstated; a crowd's extra decodes | FIXED in the record |
| E1 | - | The gates, the mutants, the counts, the data and the constants hold | - |
| E2 | nit | Mutant counts: four rvn7a records moved, not five; rvn7c's two and csa_close's one unnamed | FIXED in the record |
| E3 | nit | "83 tests" | FIXED: 66, 104 with audit_guide |
| E4 | nit | `EntityEffect.cs:799-800` | FIXED: `:800-801` |
| E5 | should-fix | Docs that now read false: Revenants.md section 23, Feud-Arc 18.1's "a lair moved", Online-Arc's "capped at 0.6 s", Come-Sail-Away's "eased the rest of the way" | FIXED, each (the retired sentence deleted) |
| E6 | nit | No Ledger row moves - but GIFT-ONE extends an unrecorded departure | FIXED with A3 |
| E7 | nit | The Active-Arcs line not at the top | FIXED |
| E8 | should-fix | world.js's quest log wrapper dropped the lens's `{ windows: false }` | FIXED; pinned over world.js's own text |
| E9 | should-fix | The record's account of a failing look (it retries; only the warning is once) | FIXED in the record and the question asked |
| E10 | nit | The mend laid every held lair's ring on the first look | FIXED with B6 |
