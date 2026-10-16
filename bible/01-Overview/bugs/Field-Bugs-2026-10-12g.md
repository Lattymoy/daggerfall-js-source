# FIELD BUGS 2026-10-12g - eight threads from the bug-reports channel

Eight Discord threads from 2026-10-12, handed over as screenshots, read on the code as it stands at main's `ee8cee56`.
All eight are changed here. Three are reasoned from the code without the player's data (no ARENA2 in the container);
each says what it could not see and what the reporter is asked.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Starter quests keep breaking" - "Quests that spawn enemies inside of shops like the rat quests from the fighters guild keep spawning nothing. It seems like it works if it spawns them in a residence, but not in shops?" (sabb) | DFU's interior placement is a ring just outside the view with 5 m + 1.25 m clear and nothing else; a shop's counter and shelves leave it none, so the wave waits forever | fixed, a departure (SHOP-RATS) |
| 2 | "Controls resetting" - "I bound Ready or sheathe weapon to Right Click and Swing weapon to Left Click (with mouse activate unbound), but every time I restart the game, Swing Weapon resets to None and Left Click goes to mouse activate"; Save Controls "doesn't work" (Tetriandoch) | the save was sound; MAC-D1's boot repair gave Activate (mouse) its default, Left Click, by a binding that steals, and wrote it back | fixed (KEEP-CLICK) |
| 3 | "Housing items lost in storage" - "a lot of lagging and my housing decorations didnt load ... the boxes i had put all my legendaries and rares along with some potions was gone, i relogged and checked but it stayed empty" (Madmanex) | a house's own chest was its record's index in the room's list - a placement that did not stand moved every record after it and dropped the last; what a decor piece the service no longer has held was kept out of reach | two ways closed (HOLD-KEPT); the reporter's own path not seen - questions, and a recovery for the owner |
| 4 | "'Open a Chest' quest doesn't record the town you need to go to" - "The town is mentioned in the first message you get ... but not in the text in the quest list, and it doesn't show up as a quest location on the map either" (Harlander) | N0B00Y16's local pawnshop taken in another town by NEAR-SITE, where the town mods took the city's away; DFU's `local` is always this town, so its log says "a local merchant" | fixed, NEAR-SITE's own departure widened (QUEST-TOWN) |
| 5 | "Im doing less dmg with the Rose gauntlets then I do without them" - "2nd Hit only 50% since last update ... 80-90dmg per crit now instead of the 100-130 ... from Place 11 in Gate without them to 26 with the biggest Hand to hand Upgrade" (Shortstori) | BAL7's half is right; the second blow went through the struck foe's record in the player's door, and the Gate's Warden is no host's foe record - at the Gate Open Hand struck once. The per-crit drop is BAL6's curse made the beast's alone | fixed (OPEN-HAND); the crits answered |
| 6 | "Motherlodes don't show up on compass" - "In the announce text it says to look for the motherlode on your compass but it doesn't come up at all unless its only from a certain distance?" (SaberGGaming) | the warning said "Look for it on your compass" before anything stood to mark; a finder was told the same; the far mark was Mining's copper under every vein in reach | fixed (LODE-MARK) |
| 7 | "Wall missing through window" - "I should be looking at the outside wall there. taken at The Savage Goat in Fontbridge" (æther) | the view out discarded everything inside the entered building's model box and a quarter metre round it - its own other wing, a second model of it, a neighbour's wall against it | fixed (PANE-CLIP) |
| 8 | "Keep turning invisible, horses and any MW models" - "models are disappearing including myself ... when i reload it shows my MW models for a second but then disappears"; "my character, enemy and npc sometimes (often) turn invisible, restarting the client seems to fix it for some minutes" (Beppi, Deserere; five more) | the concealed peers' 3D horses opened the renderer's one body batch and flushed it only if one drew: a horse out of view left it open, and every later body pass joined it | fixed (BATCH-SHUT) |

Not a report: the "Controls resetting" thread's "P.S. Mages are horribly weaker than all other classes" (and "mages are
completly broken" beside it) is a balance view, not a defect a change here could pin. BAL9 (`05-Combat/Balance-Arc.md`
section 15) is the same day's pass on Destruction; nothing is changed for it here.

## SHOP-RATS: a shop's quest foes are placed (1)

`src/scenes/quest/questFoeHost.js` placeRoomQuestFoe, roomMarkerSpot, ROOM_RING_MISSES, ROOM_NEAR_RING;
`src/scenes/worldModes.js` tryPlaceInteriorQuestFoe.

FOUND. The Fighters Guild's rat quests are M0B00Y15 ("Hunt for Giant Rodents") and M0C00Y14 ("A Rat Infestation"):
`Place _house_ local random` - Quests-Places' `random` (`0, -1, 0`) is any valid building, shops among them - and
`create foe ... every 2 minutes 7 times` once the player is at the house. Neither places its foe at a marker. CreateFoe's
interior arm is DFU's PlaceFoeBuildingInterior, which is PlaceFoeFreely alone ("Always place foes around player rather
than use spawn points"): a bearing at the field of view plus up to four degrees, left or right, at least 5 m clear plus
1.25 m of separation, a floor under it and a clear 0.65 m sphere - and nothing else, every tick, for ever. Over the real
Collider in synthetic rooms (a scratch trace, not kept): an empty 8 x 8 m room places 16% of tries, an 8 x 9 m shop with a
counter and wall shelves 2.8% on the customer's side, and none at all at the counter facing the keeper; a hall, doorway
and room shaped like a residence 20.6%. One pending foe that never places holds `spawnInProgress`, so no later wave
starts, and the encounter event the pending wave raises each tick breaks every rest in the shop. Nothing on the path
reads the building's type: a house fails too where its room is small or cluttered. DFU behaves the same (the thread's
own reply says so).

FIXED. The ring is tried first, every tick, as DFU tries it; a room where it places is DFU's to the spot. A pending foe
it has missed ROOM_RING_MISSES (30) times - three seconds of the machine's ten ticks - takes a ring at half the least
distance (2.5 m) that does not mind the view (the spawner's own `lineOfSightCheck: false`), then the room's own markers
(enter, rest, quest and treasure), the farthest within the ring's 20 m with a floor under it and a clear test point, the
ring's own height over the floor. A DEPARTURE (Port-Ledger). test/scenes/quest/fb1012g_shoprats.test.js (4); interiorfoes' pin of the
arm moved (PIN MOVED).

## KEEP-CLICK: the boot's repair takes only a free key (2)

`src/systems/inputActions.js` repairUnloseableBindings.

FOUND. Confirm and Save Controls write the file correctly (Mouse0 Swing, Mouse1 Ready, Activate (mouse) in
`removedPrimaryActions`). Every load then runs MAC-D1's repair (2026-09-21): an unloseable action that answers no key
gets its default. Activate (mouse) - `ActivateCenterObject`, unloseable - had none, and its default is Left Click; the
repair bound it through SetBinding, which takes a code from whoever holds it, and saved the result. Swing came back on
its pad button alone (the pane reads None), and in two more boots Ready lost Right Click to Swing and went back to Z:
the player's layout gone, the very stranding the repair exists to stop. Reproduced through the real controls pane's
functions and `loadOrCreateBindings` over a stubbed store.

FIXED. The repair fills a default only where no action holds it - DFU's own autofill law (TestSetBinding). A swing
cleared with Right Click free still goes back on it. A player who clears Activate (mouse) and gives Left Click away
keeps the layout; the E key's Interact still activates, but a readied spell is cast by Activate (mouse), so that player
casts with whatever key they give it. test/systems/fb1012g_keepclick.test.js (2); a Port-Ledger row for MAC-D1, which had none.

## HOLD-KEPT: a home's storage is never laid on the wrong chest or kept out of reach (3)

`src/scenes/chestRecords.js` chestIdentity, matchChests, CHEST_MATCH_REACH; `src/scenes/worldModes.js`
currentSceneState, restoreInteriorScene, decorSetDownHeld, loadHomeDecor's stand; `src/scenes/decor/decorRoom.js`
takeUnserved.

FOUND. What a placed storage piece holds lives in the owner's save, keyed by the piece's id; the pieces live on the
account service. A refused, empty or partial decor list stands nothing and keeps the contents (traced, a scratch run).
Two ways the contents did go:
- A house's own chests (`container:<i>` in the room's scene record) were matched by INDEX. A placement whose model did
  not stand is skipped (interiorContext.js), every chest after it moves down one, the restore laid each record on the
  next chest along, and the last record - no chest at its index - was dropped; the next save or checkpoint wrote the
  room without it. A legendary in the last chest was gone.
- While a home's record is held back for another layout of its town (WD3), the room's storage reads empty. A box taken
  away then deletes the piece on the service; its real contents stay in the record under an id no piece will ever stand
  for again - kept, and out of reach for good.

FIXED. A chest's record carries which chest it is - its model and where it stands in the building's frame - and the
restore matches by that (within half a metre), then a record written before by its index, onto a chest no record named.
A record no chest of this visit stands for sets what it held down at the player's feet as a pile of the room's floor,
said ("What a chest here held, where no chest stands now, was set down at your feet."), as the arena's crate already
was. When the owner's decor list stands (never while the record is held back for another layout), what a piece the
service no longer has held - by the service's whole list, read by this build or not - is set down at the owner's feet
and said. test/scenes/fb1012g_holdkept.test.js (4); arena2_move's pin of the crate arm moved (PIN MOVED).

NOT SEEN. Which path took this reporter's things. HOME-WIPE (`01-Overview/bugs/Field-Bugs-2026-10-07.md`, fixed 2026-10-07)
emptied a home the arena moved, under the same overload; an older desktop build still carries it. The reporter is asked:
which town (Daggerfall city?), web or desktop and which update, the house's own chests or placed boxes (did the boxes
still stand?), anything removed or moved while it looked empty, and any town layout mod. RECOVERY is the owner's: the
realm keeps `clean_obj` (the last checkpoint judged clean) beside `obj` and `prev`; `tools/realmReview.mjs` reads the
character's - if it predates the loss, the items can be read out of it and given back by server post
(`tools/sendServerPost.mjs`), or the character rolled back whole (`/v1/mod/realm-rollback`).

## QUEST-TOWN: a site taken in another town is on the map and in the quest list (4)

`src/systems/quest/place.js` `siteDetails.nearSite` (the first seat's NEAR-SITE and the re-seat's);
`src/systems/quest/machine.js` revealNearSites; `src/ui/quest/questLens.js` entryTarget, movedSiteOf.

FOUND. "Open a Chest" is N0B00Y16: `Place _shop_ local pawnshop`, `place npc _merchant_ at _shop_`; the town is named only
in the offer (`__shop_`, "The best locksmiths in ..."), and the log entry (`log 1020 step 0`) names two persons, "a local
merchant". In DFU a local site is always the town the quest is given in, and its travel map draws no quest marker. The
port's NEAR-SITE (QUEST-AUDIT II) takes a local site in the nearest town that has one where the town mods took the kind
away - Beautiful Cities drops a city's only pawnshop, and it is on by default online. After the move the lens's target
was null (the entry names no Place): no where-line, no diamond, no compass mark, no find-place box; and the town was
never discovered.

FIXED. A site NEAR-SITE seats in another town is marked `nearSite` (and so saved). The quest's start discovers its town
on the travel map, RevealLocation's own door (a refused offer reveals nothing). An entry that names no place but names a
person standing at such a site (`place npc ... at`) points at it in the enhanced faces, its town and region named: the
quest list and the tracker say "Gothhead in ... province", the map's diamond and the compass have it. A site in the
quest's own town is DFU's, unmarked and unrevealed; the classic logbook's box keeps DFU's GetLastPlaceMentionedInMessage.
Pinned in test/systems/quest/qa2_nearsite.test.js over the real quest text (QUEST-TOWN).

## OPEN-HAND: the Rose's second blow reaches the Gate's Warden (5)

`src/systems/playerDoor.js` oweFoe, takeOwed; `src/systems/loot/lootPowers.js` again; `src/scenes/dungeonContext.js`
landOnBoss, landOnCrystal, landOnHost, landOnRival.

FOUND. The Gauntlets of the Rose (`gauntlets-of-the-rose`, Open Hand: `share: 50`) strike a bare-handed blow again for
half - BAL7, and it halves only the second blow. The second blow lands through `again()`: the struck foe's record in the
player's door, then its pool's door. The Gate's Warden is no host's foe record - the relay runs him, and a blow of mine on
him goes out as one claim (`landOnBoss`) - so `again()` found nothing and Open Hand dropped, silently. His crystals, his
host, the Remnant and Many Endings' echo the same. A traced Hand-to-Hand expert (scratch, the real formula): +64% a swing
in a dungeon with the Rose, +9% at the Gate (its +25 Hand-to-Hand alone).

FIXED. A follow-up on a body no foe record holds is owed, by the body (a WeakMap), and the dungeon host's claim takes it
before the ward is read: the Warden's, a crystal's, one of his host's - one frame, one blow token, the relay's caps
deciding what lands. A player's claim drops it (BAL8: the referee's blow alone). Many Endings' echo rides the same door;
the sets' reach powers still never reach him (AUDIT SET P-L9). test/systems/fb1012g_openhand.test.js (2); four source pins moved
(wb4b_gate_blows, wb9c_gate_reckoning, wb11_gate_host, arena4b_blows).

ANSWERED. "80-90 a crit instead of 100-130" is not the gauntlets: the first blow is never weaker with them, in either
form. It fits BAL6 (the same update): a lycanthrope's curse - +40 to the four attributes, +30 Hand-to-Hand and Critical
Strike - is the beast's alone now, so a werewolf fighting in human form lost it (traced: 97 a crit before, 83 after). A
werewolf who wore Daedric or Ebony gauntlets and took a Rose on a leather or chain base also gives up their metal on the
claws (BAL6-GAUNTLETS: the claws take the Gloves piece's own metal, +6 and +4). Loot-Arc's line on Open Hand says "for
half" now.

## LODE-MARK: a Motherlode is on the compass from its warning, in its own colour (6)

`src/net/motherlodeBook.js` markedAll, the warning's and the rising's gate; `src/ui/nodeMarks.js` MOTHERLODE_MARK_CSS,
nodeMarkCss, nodeMarkRgb; `src/scenes/world.js` motherlodeMarks, professionMarks.

FOUND. There is no range cull: a risen lode is marked from anywhere. But the one line that says "Look for it on your
compass" is the warning, ten minutes ahead (a Sense's thirty), and the compass held risen lodes alone; the rising's
line says nothing of it. An account whose Motherlode today is found sees none, yet was told of the others. And the far
mark was Mining's copper at full strength, drawn first and so under up to sixteen veins and boulders within 150 m - on
the vein-rich ground Motherlodes rise on, one more copper triangle. Near (400 m) the heap's own mark and glow show: the
reporter's "only from a certain distance".

FIXED. The compass marks every lode the warning has told of until it rises, then while it stands - never once spent,
gone or the day's find made; the warning and the rising are never said to an account whose Motherlode today is found.
The far mark is its own aqua (`#00e5c8`, clear of every other mark by more than the 75 the nodes keep - a Fisher's blue,
the nearest, by 113) and is drawn over the near nodes. test/net/fb1012g_lodemark.test.js (3); three source pins moved
(prof2b_client, nodemarks, auditsilver_client).

## PANE-CLIP: the view out draws only what stands past the glass (7)

`src/render/realWindows.js` RW_MAIN_DERIVS, the shader block's `uPaneDepth`/`uPaneOn`, VIEW_PANE_VS/FS, VIEW_PANE_UNIT,
VIEW_PANES_MAX; `src/render/renderer.js` _rwWatch, takeGlassRect, _rwDrawPanes, _rwPaneProgram, outsideViewFrame,
_rwEnsureTarget, releaseOutsideView; `src/scenes/world.js` and `src/scenes/exterior.js` outsideView;
`src/scenes/worldModes.js` the view out's call.

FOUND. RW1's view out draws the street through an interior's glass. It left out the building the player stands in by its
model's world box grown a quarter metre - and the discard was per fragment, for every mesh in the pass: an L- or U-shaped
model's other wing (inside its own box), a second model of the building, a neighbour's wall flush against it or within
the quarter metre. Daggerfall's shells are single-sided and back-face culled, so once a neighbour's near face was gone
the rest of it was seen from behind and it vanished whole. The window showed the street where a wall stands. The probe's
own shell (two outward quads round the eye) never needed the box: back-face culling hides it.

FIXED. The interior frame's watch keeps each glass and cutout sub-mesh it measures (its VAO, its range, its matrix; at
most 256). The view out draws them first, depth alone, under its own cropped lens into a depth texture of its own, and
the mesh shaders discard a street fragment at or before that depth (`texelFetch` on unit 22, on in that pass alone; the
sampler back on unit 0 after). The building's own walls seen from inside are back faces; those between the eye and a pane
(a room that reaches past its shell) are before the glass. A pane whose mesh was let go since is passed over. The box,
its pad and both hosts' `outsideViewClip` are gone. Proven on SwiftShader (`tools/realWindowsProbe.mjs`, its new
`inside-wing` shot: a wall of the building past the glass, red, and one before it, green): HEAD's box shows 0 of the red,
the pane clip 35,208 pixels of it; the green 0 either way; every other shot's numbers are HEAD's.
test/render/fb1012g_paneclip.test.js (3); windows1_view V4 and V10 and the RW1 mutant re-aimed.

NOT SEEN. The Savage Goat's shape - one L-shaped model or two models side by side - needs the data; either is drawn now.
The reporter is asked to look again.

## BATCH-SHUT: a concealed peer's horse never leaves the body batch open (8)

`src/scenes/horseCartPool.js` drawVeiled3d; `src/render/renderer.js` beginFrame.

FOUND. Every Morrowind body's picture (the player's own third-person body, every NPC's, foe's, peer's and 3D horse's)
is queued into the renderer's one character batch between a pass's begin and its flush. A batch opened inside an open
one joins it, and its flush only steps the depth down (AUDIT MW-NPC II). `drawVeiled3d` (AUDIT COATS3D A5, #791, merged
2026-10-11) drew a concealed peer's 3D horses after the opaque world: it opened the batch for a horse and flushed only if
one drew - a horse out of view (behind the camera) left the batch open, and one out of view before one in view opened it
twice and flushed once. From then on every body pass joined the stale batch, its flush drew nothing, and its queue grew
a body a frame: no Morrowind body drew until a reload. Re-attaching the files rebuilds the bodies, not the renderer's
batch; first-person hands draw on their own call. The trigger: an online peer under Invisibility, Chameleon or Shade with a
Horse Cart and Cargo horse or team in the pool, Morrowind on. Reproduced through the real batch doors, drawRigSpriteBox,
the horse rig and the pool (GL stubbed).

FIXED. Opened once, flushed in a `finally`. And a frame's start shuts any batch a pass left open (said once on the
console): one frame's pictures lost, never the session's. test/render/fb1012g_batchshut.test.js (3).

NOT SEEN. A solo player reaching this (it needs a concealed peer): the code read finds no other open batch, and every
other caller begins and flushes in a `finally`. Should it happen alone, the console's "a character batch was left open"
line says so.

## THE FOUR HOSTS

- SHOP-RATS: worldModes.js (interiors) wired; dungeonContext.js and the street's hosts (world.js, exterior.js) keep DFU's
  ring - open ground and corridors place.
- PANE-CLIP: world.js and exterior.js hand a street with no box; worldModes.js calls it; dungeonContext.js draws no view
  out (FLAGGED there already: a dungeon has no window to the street).
- OPEN-HAND: dungeonContext.js wired (the court, the Hour and the sand are its); world.js, exterior.js and worldModes.js
  hold no relay-run body - a follow-up there lands through the door as ever.
- LODE-MARK: world.js wired; exterior.js (the bench) runs no Motherlode; the dungeon and building hosts draw no far mark.
- HOLD-KEPT: worldModes.js wired (a building's scene); the other three stand no house chest.
- BATCH-SHUT: horseCartPool's drawVeiled3d runs from world.js and exterior.js; the renderer's frame start covers all four.
- KEEP-CLICK and QUEST-TOWN: no host seam (the input store's load; the quest machine).

## Pins

test/fb1012g_keepclick (2), fb1012g_batchshut (3), fb1012g_paneclip (3), fb1012g_shoprats (4), fb1012g_holdkept (4),
fb1012g_lodemark (3), fb1012g_openhand (2); qa2_nearsite's QUEST-TOWN (1). `tools/mutants/fieldbugs1012g.json`: 49, all
dead (KEEP-CLICK 2, BATCH-SHUT 3, PANE-CLIP 8, SHOP-RATS 9, HOLD-KEPT 10, LODE-MARK 8, QUEST-TOWN 4, OPEN-HAND 5); three
survived the first run and their tests were made to see them (a chest of another model where a record's stood; a lode
warned before a find heard from elsewhere; the town named before the map has it). `tools/mutants/windows1.json`'s
RW1-box-left-on re-aimed as PANE-CLIP-left-on, dead; ten records of other arcs whose lines these changes touched
re-aimed by content (arena4b_blows 1, audit1003_wd 1, audit_guide 1, guide1 4, qa2_audit 2, qa2_nearsite 1), all dead.
Pins moved where they encoded the old behaviour (PIN MOVED notes).
