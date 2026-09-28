# FIELD BUGS 2026-09-26 — sixteen from play, the questing ones first

Mac, with a list from play and the Discord: *"Questing bugs - higher
priority i have[n't] quested as much due to alot of new updates im trying to
test new things fast as ur doing them lol"*

1. *"Shared Quest did not match copy bug - affect player quality of life"*
2. *"Cant see quest on f5 menu but can on tab menu"*
3. *"Enhanced plus cant buy house - (lostmyleg prob sent you stuff)"*
4. *"when resting in a dungeon it spawns enemys that are out of sync with
   others"*
5. *"Weapons when swapped into left hand dont work showing fists - id say
   remove the ability when in morrowind since its not visible"*
6. *"weapons dont show in houses properly - image attached below"* (the
   image did not arrive)
7. *"No ui to put items in storage on boat - problem for enhanced and
   enhanced + (lostmyleg send stuff to u already)"*
8. *"Remove bought houses decor - the base game decor isnt easy to decorate
   around when u want more in depth house"*
9. *"Cant set down armor in house - Would be awesome to display armor as well
   so people can run shop and show collection already have a awesome
   collection"*
10. *"Somepeople cant see the gate spawn not sure but got reports of this"* -
    "No oblivion portal to enter :("
11. *"someone is stuck in the ocean"* - "You can get stuck in the ocean"
12. *"Wereform needs fixed - Wereform uses daggetfall paperdoll when others
    see you tranform. You dont see your self transform less your in paperdoll
    style (morrowind models need their vampire/werewolf forms)"*
13. *"do vampires have a negative??? seems they have no negative aspect bug or
    feature??? instead of constant damage taken they should get reduced stats
    in day and get the bonus at night"*
14. *"Bow is still double shooting arrows"*
15. *"Shop keepers are lamp posts - make only a hand full of them"*
16. *"Guard the guild quest (mages guild) - wait time for this should be alot
    shorter"*

LostMyLeg's material for 3 and 7 did not reach this session; both were
traced from the code alone.

## SHARE-COPY: every quest share was refused (report 1)

Not some quests: EVERY quest, since AUDIT DROPS A1 (2026-09-22,
`06-Systems/Online-Arc.md`). A1 stopped trusting a partner's envelope by
holding it against the receiver's OWN parse of the quest by name - every
task's symbol and action types in order, every resource's symbol and type.
Two kinds of task take their symbol from the UID counter at parse
(`task.js _readTaskHeader`, DFU's own `NextUID`): the headless startup task,
which every quest has, and each `until _x_ performed:` block. The number is
wherever the parsing machine's counter stood, so no two parses agree on it -
the sender's `2` against the receiver's `4` - and the receiver read "received
a quest that did not match your own copy". A1's fixture declared neither kind
of task, so its pins passed. Measured over the vendored corpus: 265 of 265
refused before, 0 after.

Behind it stood a second refusal the first hid. The shape parse ran over the
RECEIVER'S world: a `local` Place throws for a receiver in the wilderness or
in a town without that building, a questor binds to whoever the receiver last
clicked, and the receiver read "do not know this quest". The shape of a quest
is its script's. `parseQuestShape` parses headless now
(`parseQuestForLists`'s `headless`, the world seam nulled - the Person,
Place and Foe set-ups keep their own headless charter), and the world's half -
the sites, the NPCs, their homes - comes from the sender's envelope, as a save
file's does.

`shapeMismatch` (systems/questShare.js) matches a minted task by its TYPE and
its place in the order, a persist-until by the symbol it watches; the
sender's number is kept (the restore keys the task by it, as a load does), so
it must be a number and no two tasks may share a name. A Person's set-up over
the sender's world mints its home (`_<person>_home_`, person.js
`_assignHomeTown`), which the headless parse never makes: the envelope may
carry one per declared Person, and it must be a Place. Everything A1 refused
is still refused - pinned beside the new allowances.

`test/sharecopy.test.js` (4): the corpus, generatively; the real producer (a
quest taken from a questor in town, received by a party member in the
wilderness with the sender's sites, then resynced); the shape parse never
reading the receiver's world; A1's guard over the minted tasks and the homes.
`tools/mutants/sharecopy.json` 11, 11 dead; `auditdrops.json`'s
resource-set mutant re-aimed by content (9, 9 dead).

## F5-QUESTS: F5's pause window had no quests (report 2)

On the enhanced skin F5 opens the pause window on its Stats page (PX27) -
the same window Tab's dial opens through the host's pause door, and the
same window Escape opens on System. Two doors built it, and F5's door
handed it the sheet's four buttons and nothing else. So on F5's copy the
Quests tab said "The journal is not wired into this place yet" while
Tab's listed every quest; its Save and Load panes said there was no door;
its Exit did nothing (the page's `onAction` answered Resume alone). THE
ONE CONSTRUCTION SEAM (Home.md, AUDIT 17i) by another road: one object,
two constructors, and the second forgot.

Each host's pause bag is one arm now, spread by its pause door and handed
to its sheet builder as `pause` (`ui/charSheetDoor.js`); the page spreads
it under the sheet's own four doors. The act and the slot seams moved out
of the pause overlay into `pauseMenuAct` and `pauseMenuHooks`
(`ui/pauseDoor.js`), which both doors use. THE FOUR HOSTS: world.js and
exterior.js - `pauseDoorHooks`; dungeonContext.js - `pauseHooks(setPlayerPos)`,
with F5 now carrying routeKey's position applier into the sheet as Escape
carries it into the pause door (`ui/input.js`), so the page's Load places
the player; worldModes.js (a building) borrows the world host's builder,
so a building's F5 page wears the world host's bag - every seam the
enhanced window reads (the quests, the saves, the relock, the exit) is
the same there.

`test/f5quests.test.js` (4); `tools/mutants/f5quests.json` 11, 11 dead.
Ten older pins re-aimed to where their laws live now; the cites the moved lines shifted, moved (the CD4-gated struck rows by hand).

## GUARD-ONLINE: Guard the Guild's watch starts when you arrive (report 16) - Mac's call

DISC25-C (2026-09-25) found it and left it for Mac: N0B10Y03's thieves come
`daily from 00:00 to 03:00` while the player is in the Mages Guild, and it
pays only once that window is shut again. Online the world clock is the
shared one - a game day is two real hours and a rest moves no world time -
so the window came round once in two hours. Asked, Mac chose: online only,
the watch starts about a minute after you arrive and lasts one game hour
(five real minutes).

`systems/quest/onlineGuard.js` holds the law and the one table row;
`DailyFrom.checkTrigger` takes the arrival's window when the quest seam says
the clock is shared (`sharedClock`, wired from both bridge hosts). Ten game
minutes after the player is first in the watched Place (the script's own
`_magesguild_`) the window opens, and it stands one game hour. Leaving after
it shuts and coming back opens a new watch - a watch missed is not a quest
lost - but a player who stays in the hall stays on a shut window, so the
questor pays. The arrival is saved with the action. Offline, and every other
`daily from` quest online, keeps DFU's window. Port-Ledger section A,
GUARD-ONLINE.

`test/guardonline.test.js` (4); `tools/mutants/guardonline.json` 10, 10 dead.

## LAMP-KEEPER: the keepers that were lamp posts (report 15)

Not a count - a picture. Roleplay & Realism's variant keepers (RR2) stand a
shop or tavern keeper on archive 197 by the building's quality, and register
the mod's seven 197 sprites LAZY (nothing fetched at install). A lazy record
is decoded only when something asks for it - the icon doors ask - and
`getTexture`'s archive preload skips lazy entries by design (AUDIT-DW F1).
The interior person's stand never asked, so its upload drew the CLASSIC
TEXTURE.197 record in the mod's place. Archive 197 is "Kludge Town", and its
record 6 is a street lamp, which the mod's own XML scale (3 x 0.8) stretches
into a keeper's frame: every 182_2 keeper of a shop or tavern of quality 13
and up stood as a lamp post, and a click on it opened the shop - which read
as "lamp posts are shopkeepers". The other variant records (0-5) drew their
classic 197 pictures too, which are people and so passed unnoticed.

The stand asks for its draw record's replacement before the upload
(`scenes/interiorContext.js` standPerson). No keeper is removed: each draws
the mod's picture now.

`test/lampkeeper.test.js` (3); `tools/mutants/lampkeeper.json` 2, 2 dead.

## SHIP-STORE: the player's own storage takes things in again (report 7)

MAC-M2 B (2026-09-16, Mac: "Remove the gold and pack buttons from the looting
menu") made the enhanced skins' loot session take-only: the pile's frame
alone, and no way back to the pack. Right for a body or a stranger's shelf.
But the player's OWN storage opens through that same session - the ship's
chest (HouseContainers' "not distinguishing between ships"), an owned
house's cupboards, a placed storage piece (DECOR1c) - so every one of them
was a box that could only be emptied, on Enhanced and Enhanced Plus alike
(Plus ports the same pack). The classic skin was never affected, and DFU
opens that window two-way (PlayerActivate.cs:902-925).

The host says `loot.storage` for the player's own (`scenes/worldModes.js`:
an owned cupboard - `openLoot` without private property - and an owner's
placed piece); that session opens beside the pack, its side titled
Storage, with a Store verb (`ui/enhancedInventory.js`). A body, a
stranger's cupboard and a closed shop's shelf keep MAC-M2 B's frame.

`test/shipstore.test.js` (3); `tools/mutants/shipstore.json` 6, 6 dead.

## WEAPON-MOUNT: a hung weapon is its own picture again (report 6)

The image did not arrive; this was traced from the code and proved in real
GL. DECOR2c hangs a weapon or a shield on the blood marks' decal pass, as its
pack picture under a white tint. Both of that pass's programs read a texel's
red as a film's thickness and paint the tint through it (BLOOD3) - the
classic `vColor.rgb * exp(...)`, the lane's albedo from the tint with a
meniscus relief off the same red. So a hung sword came out a pale lit
silhouette of itself, its colours thrown away. `tools/bloodProbe.mjs` shows
it: a green picture drawn as a mark comes back 255,255,255 on the classic
set, 201,197,190 on the lane.

A mount is a picture now. `renderer.drawDecalPicture` is the same pass with
its switch on for that one draw (`uPicture`), and both programs then take the
texel as the colour: the classic straight, the lane decoded as every lane
texel is, with no film and no relief. The room's mounts and the placement
ghost use it (`scenes/decorRoom.js`, `scenes/decorTool.js`); the blood marks
never do. The probe's WEAPON-MOUNT rows: green comes back green on both sets
(54,250,76 classic; 36,169,50 lane).

If the image showed something else - a mount in the wrong place, or missing
- that is still open; this is the one defect the code shows.

`test/weaponmount.test.js` (4); `tools/mutants/weaponmount.json` 8, 8 dead.

## HOME-OFFER: a house for sale asks at its door in any mode (report 3)

HOME1 made a house's offer, and its owner's menu, answer only an Info-mode
press. Nothing on the enhanced skins says so: the interaction mode is a
drawn word, and the default is Grab (PlayerActivate.cs:70). The bank tells
an online player "a home is bought at its own front door", so they pressed
the door in Grab and walked in, on Enhanced and Enhanced Plus alike. The
houses were buyable all along; outside Info the door never asked.

The offer asks in any mode but Steal now (a thief is not shopping), once a
session per house: a No goes on through the door, as it always did, and
that house asks no more unless it is pressed in Info, which always asks
(`systems/onlineHomes.js` homeDoorPrompt; `scenes/worldModes.js` remembers
the No). The owner's menu stays Info's, since an owner's press is the way
in.

`test/homeoffer.test.js` (5); `tools/mutants/homeoffer.json` 12, 12 dead.
`test/home1.test.js`'s wiring pin re-aimed.

## ARMOR-MOUNT: armour goes on display (report 9)

DECOR2c hung a weapon or one of the four shields, and armour never stands
as a thing in a room (DECOR2a: weapons and armour are mounted) - so a
cuirass, a helm or a pair of boots had no way into a room at all. Every
piece of armour hangs now, as a shield does (`net/decorLaw.js`
decorIsMount): its pack picture, the owner's body's, flat on the wall or
table it is set on, free, and back to the pack whole when taken down. The
room draws it through WEAPON-MOUNT's picture door, so it wears its own
colours and its material's dye. Worn armour stays in the pack, as a worn
blade does - take it off first.

A client from before this change reads a hung cuirass as a standing
picture turned to the eye; it hangs for everyone once they update.

`test/armormount.test.js` (4); `tools/mutants/armormount.json` 3, 3 dead.
`test/decor2c.test.js` re-aimed (a cuirass hangs), and its "any armour
hung" record dropped - that is the law now.

## VAMP-DAY: a vampire's day is its weak hours, not a burn (report 13) - Mac's call

Both, in a way. Daggerfall's vampire has three costs: the sun burns 12
every 4th round outside by day, holy ground burns the same, and an unfed
vampire cannot rest. The port had all three, and the +20 to seven stats
and +30 to the skills at every hour, so outside a dungeon by night there
was nothing to feel. Mac asked for a trade: "instead of constant damage
taken they should get reduced stats in day and get the bonus at night"
(asked, "Day -20 / night +20").

The sun burns a vampire no more. The curse's +20 is the night's; from
06:00 to 18:00 by the clock, wherever the vampire stands, the same stats
are 20 down (`systems/vampirism.js` vampireStatMod). A live stat of 0
kills, so the day's penalty stops at a live 1 against the stat without
it - a luck of 15 reads 1 by day, never 0 (`systems/statMods.js`). The
character sheet no longer lists damage from sunlight. The skills' +30,
holy ground, the feeding, the travel rules (no fast travel by day,
arriving by night) and a career's own Damage from Sunlight stay as they
were. A save's curse burns no more from its next round.

A Port-Ledger section A row (VAMP-DAY). `test/vampday.test.js` (5);
`tools/mutants/vampday.json` 9, 9 dead. Three older pins re-aimed
(passivespecials x2, disc10_vampire V1 - onto a sun-cursed career).

## BOW-VOICE: one loose, one sound (report 14)

ARROW2 (2026-09-23) took the second arrow out of the picture - the sprite
bow's nocked frame standing on screen while the shaft flew. The second
SHOT that was left is a sound. A bow's loose is FPSWeapon's own frame-4
PlaySwingSound: the machine's `bowSound`, which every host plays as
ArrowShoot. The Weapon Widget - on by default - played ArrowShoot again at
its clone's release. On the sprite bow the two landed a tick apart. Under
the Morrowind arm the machine's is held for the arm's release key
(MW-D42d, so the twang rides the arrow) while the clone's went at the
click - every shot heard twice, the draw's length apart, the first twang
with no arrow. Counted on the real rig and widget: two ArrowShoots a shot
(frames 3 and 4 on the sprite; at the click and at the release under the
arm).

The clone's bow release is silent now - a duplicate of the original's
loose, which the port runs once, beside the five the page already lists
(`combat/weaponWidget.js`, `05-Combat/Weapon-Widget.md`). One shot is one
twang, with its arrow, on the sprite and under the arm, drawback on or
off. The clone's melee swing keeps its voice.

`test/bowvoice.test.js`; `tools/mutants/bowvoice.json` 3, 3 dead.
`test/ww1_weaponwidget.test.js`'s bow pin re-aimed (the clone looses in
silence).

## MW-HAND: under the Morrowind arm, never an empty hand (report 5) - Mac's call

The same words came in once before, and LH1 (the quickslot swap follows
the hand in use) fixed the swap's half. The other half was the equip
itself: DFU lets the hand in use be an empty one - H to a bare left hand is
fists, by design, and the sprite shows which hand is up. The Morrowind arm
draws one weapon and no second hand, so a dagger equipped in the left hand
with the right empty, or an H to an empty left, showed fists and nothing
said why.

Asked, Mac chose "Never on an empty hand": while the Morrowind arm is
built, the hand in use follows the weapons (right, else left), and H moves
only between two held weapons. Bare hands and a shield alone still fight
with fists. The classic sprite lane keeps DFU's ToggleHand whole
(`combat/playerWeapon.js` followHeldHand, `combat/weaponRig.js`;
`02-Formats/Morrowind-Rules.md` MW-HAND).

`test/mwhand.test.js` (4); `tools/mutants/mwhand.json` 6, 6 dead.

## OCEAN-STUCK: a heavy swimmer is lifted out at the coast (report 11)

No detail came with the report, so this is the one way to be stuck for
good that the code shows. LevitateMotor's first arm (DFU's, AUDIT 26
F027) drags a swimmer carrying more than 62.5 kg down and takes the float
keys away ("You are carrying too much to stay afloat."). Iliac Puddle No
More's only way out of the sea, the shore exit, asks for a SURFACE
swimmer. So the weight sank the player to the carved floor, and at the
coast that floor meets the carve's wall - metres of it - with nothing to
lift them. Most players drown and respawn; an Argonian, who breathes
forever there, stays. Reproduced in `test/dwd_swim.test.js`'s harness: the
swimmer stood at the wall's foot, pushing, indefinitely.

The exit now takes a swimmer the weight holds under, from wherever it
stands (`scenes/deepWatersPlayer.js`): push at the coast and it lifts you
onto the shore. A light swimmer is unchanged - it swims up to leave, as
the mod asks. If the report was something else (a cliff coast with no
walkable landing, a boat), it is still open, and the reporter's place
and load would settle it.

A departure from the mod, recorded in its Port-Ledger row and
`03-World/Deep-Waters.md`. `test/oceanstuck.test.js` (3);
`tools/mutants/oceanstuck.json` 3, 3 dead. `dwd.json`'s load-grace record
re-aimed.

## BEAST-PEER: the others see the beast at the change (report 12, the peers' half)

*"Wereform uses daggerfall paperdoll when others see you transform"*. On
another player's screen a peer in beast form stands as Eye Of The
Beholder's lycanthrope (`net/peerRiders.js`, PR-WW1) or, until that art is
up, the beast's enemy sprite (`net/remotePlayers.js`, DISC12). Both load at
first sight - which is the moment of the change - and until the sprite was
built, the branch fell through to the peer's HUMAN paperdoll. So every
transformation showed the person first, on every screen, and a peer whose
sprite could not be built stayed the person.

A beast is never the person now: while its art loads it draws nothing for
those frames, and the doll it wore as a person goes with the change
(`net/remotePlayers.js`). A person is untouched.

`test/beastpeer.test.js` (3); `tools/mutants/beastpeer.json` 3, 3 dead.
The local half (a Morrowind-lane player seeing their own change) is below.

## GATE-SEEN: the gate is seen from afar, and every client rolls the same spot (report 10)

Two causes in the code, and two things that are the design:

- **The beacon needed built ground.** The gate, beacon included, stood only
  on a terrain pixel already streamed in, and the streamed grid is the Land
  View Distance's. The omen names a town 2 to 4 pixels from the gate, so
  from the town a player on a short view (the classic default is 3; 1 and 2
  stream less) saw nothing at all - "found by looking up" was false for
  them. A gate on a pixel not built yet now stands its BEACON alone, on the
  ground the pixel will be built from (the terrain sampler's own kernel over
  WOODS.WLD, `scenes/world.js` gateGroundAt): no stone, collider, light or
  door until the pixel is built (`scenes/gatePool.js`,
  `render/gatePass.js`).
- **Two clients could roll two spots.** The site scan read every location
  row, and Replace Game Artwork appends a mod's locations on the clients
  that have it on - Roleplay & Realism's Northrock Fort. Its neighbourhood
  was barred on some clients and not others, the region's suitable list
  changed length, and on the days that region drew the gate, `pixels[roll %
  length]` stood it in two places. The scan reads the game's own rows now,
  as HUB1 does (`systems/gateSite.js`).
- **By design:** the gate lets people in only while open (20:00-22:00
  game time - ten real minutes of each two-hour day), and a kill collapses it
  on every screen, so a late arrival after a quick kill finds nothing until
  the next day. A relay older than world113 answers "The gate will not
  open to you yet."

`test/gateseen.test.js` (6); `tools/mutants/gateseen.json` 10, 10 dead.
Three older records re-aimed (wb2 x2, auditwb_world).

## BEAST-SELF: a Morrowind-lane player sees their own change (report 12, the local half)

The Morrowind rig has no werewolf body. A Morrowind-lane player who
transformed kept their human arms (the claws resolve to no Morrowind
weapon, so bare fists) and their human third-person body - only a player
in the classic sprite lane saw the beast on themselves.

While the curse holds the player in the beast, the Morrowind arm and body
stand aside (`combat/fpArm.js` setStandIn, set by the weapon rig): first
person is the classic claws, third person Eye Of The Beholder's
lycanthrope - the same beast the others now see (BEAST-PEER). The camera
carries its person across the change and pulls out from the head. Turning
back brings the Morrowind arm straight back (it was never torn down).
`02-Formats/Morrowind-Rules.md` BEAST-SELF.

Vampires: Daggerfall's vampire changes only the face (the classic HUD and
paper doll wear it); the Morrowind head is still the person's - not done.

`test/beastself.test.js` (3); `tools/mutants/beastself.json` 9, 9 dead.

SHADOW-FANG (the merge): with Bloodmoon attached the Morrowind rig has a
werewolf of its own (WEREWOLF1, `04-Characters/Werewolf-Body.md`), so the
stand-aside is asked of the form - aside while the wolf builds, is
refused, or the curse is the boar's; the standing wolf draws.
`test/fparm.test.js`'s MW-D8 pin re-aimed (the eighth term).

## REST-SYNC: a dungeon rest's encounter is the room's (report 4) - Mac's call

A rest's encounter (IntermittentEnemySpawn) was stood past the layout's
run, and every foe past that run is its player's own: in no stream frame,
and blind to every other player (ONLINE-DUNGEON-FOES, Online-Arc). So the
rester fought a foe nobody else could see, and it hunted nobody else.
Asked, Mac chose "Sync them into the room".

The room already has one simulation - the host's (WORLD2) - so the
encounter is the HOST's, SHARED (`scenes/dungeonContext.js`):

- The host stands its own rest's encounter shared, numbered by the room
  (`_encId`). A joiner's rest ASKS the host (an act frame, `rs`: the
  species, the band, the sight test, the feet, the facing); the host stands
  it by the joiner's feet - one ask a player every 20 s, the band at most
  64, the species a foe, the feet inside the dungeon's reach. The joiner's
  rest breaks at the hour's check, as DFU's does. An ask the wire refuses
  stands nothing and breaks nothing.
- The encounters ride the layout's own foes frame (`x`, by the room's
  number; `xf` on a full frame that lists them all), inside the room the
  layout leaves under FOES_FRAME_MAX - the standing first, and a frame
  that sheds one never says it lists them whole. A joiner stands each as a
  puppet from its first record (never a body it did not see standing) and
  takes it down when a full frame no longer lists it (the host forgets one
  Destroy()ed).
- A joiner's blow, poison or zero blow goes to the host by the room's
  number (`xs` on the hit); the host's copy hunts every player, is weighed
  by who fights it (PSCALE1), and hands over with the seat.
- Its body is the room's container, `enc:<id>` on every client (each
  client's pool index differs): the first opener's list is the room's, as
  a layout body's is (WORLD4) - one kill, one loot.

Offline nothing changes. A quest's foe and a summon stay their player's
own (ONLINE-DUNGEON-FOES still stands for them).

`test/restsync.test.js` (10); `tools/mutants/restsync.json` 37, 37 dead.
Re-aimed: the WORLD2/WORLD3 dungeon-host pins (`world2`, `world3`,
`world4`, `world8`, `auditworld3`, `auditworld4`, `auditworld34`,
`auditfoes`, `auditrenown1`, `elitepscale`, `world6biiie`,
`auditworld6biiie`, `encounters`, `encounterplace`, `discord5`), the
harnesses that mount the changed code (`audit68_dungeonctx`,
`auditpscale1` and `seatheal` - `isRoomFoe` and the room's list), and five
mutant records by content (`auditpscale1`, `discord5`, `elitepscale`,
`pscale1` x2), each re-run dead. The room's number is `_encId`, never a
`_sh*` field: PERF-EXT10 reads every `_sh*` write as the renderer's own
shadow memory on a billboard batch.

## BASE-HIDE: the room's own furniture, taken out (report 8)

A bought room kept every piece Daggerfall furnished it with: the
decorator placed more (DECOR1), but nothing of the room's own could go,
and the base furniture was hard to decorate around.

A room its owner may furnish - an online home (anyone's: every visitor
stands the room its owner cleared), the player's house, the ship - now
stands its own furniture PIECE BY PIECE (`scenes/interiorContext.js`,
`scenes/decorBase.js`): each prop model its own draw (never the merge)
and collider bucket, each flat its own batch and light. The ladder and
the mill's machinery are the building's workings and stay. Every other
room is built as before. A piece is named by the layout
(`m<placement>:<model>`, `f<flat>:<archive>.<record>` - the same room
names the same pieces on every visit and every client).

The decorator's panel has a fourth tab, "Built in (N)": the room's own
pieces, nearest first, each "In the room" or "Taken out" and how far it
stands; a piece chosen is taken out or put back, and "Take all out" /
"Put all back" do the room at once. Free. A piece taken out goes whole -
nothing drawn, nothing to walk into, no light, no target (a cupboard, a
shelf or a bed). A piece that holds anything is never taken out.

The list of what is out: offline the room's scene (the save), online the
account service's (migration 0015 `home_hidden`, written whole by the
owner, read by every visitor; `acct12` -
`06-Systems/Accounts-And-Cloud-Saves-Arc.md` BASE-HIDE). A sale brings
the furniture back: offline the scene's list is cleared, online the
home's row goes with it.

Not done: the building's automap still draws a piece taken out (the map
is built once, at the door). A guest already standing in an online home
sees the owner's change on their next visit, as with every placed piece.

`test/basehide.test.js` (7); `tools/mutants/basehide.json` 29, 29 dead.
Re-aimed: the room's scene state (`decor2a`, `interiordrop`,
`terrainscale1`, `scenecache`), PERF6's merge pin, the static-NPC hook's
place before the flats loop (`audit24_scenes`), the panel's tabs
(`decor1e`), the service's schema, read and version (`accountworker`,
`decor1`, `duel_record`, `mail1`, `renown1`, `wb5b_gate_claim`), and the
`terrainscale1.json` record by content; every mutant record in the
changed hunks re-run, 42 dead.

## GOLD-DROP: gold drops, and goes into the player's own storage (later the same day)

A player, relayed by Mac: *"Gold isnt able to be put in a container"*,
*"Cant put gold in containers"*, *"Can't drop gold at all"*. On the
default skin (Enhanced, Plus) the Gold button lived on the remote
window's bar alone. That window is built for the ground only once
something lies on it (PX19c), so F6 over bare ground had no Gold control
anywhere; and in any session the host opened it was gated off
(MAC-M2 B), which caught the player's own storage too - the ship's chest,
an owned house's cupboards, a placed chest - though SHIP-STORE had opened
those beside the pack for items. The classic and Grimoire skins were
never affected (`nativeInventory.js` keeps DFU's button and hotkey).

The button is the pack's now, where DFU keeps it
(`DaggerfallInventoryWindow.cs:47`): on the footer beside the purse,
named for where the gold goes - *Drop gold* over the ground, *Store gold*
into the player's own storage, *Stow gold* into the wagon - and its field
floating over the footer. The law behind it was already right and is unchanged
(`itemTransfer.js planDropGold`, the stack minted and merged into the
remote list, taken back into the purse). A body's tray still never
offers it. `10-UI/UI-Arc.md` MAC-M2 B; `test/golddrop.test.js` (5),
`tools/mutants/golddrop.json`.

Not done, said plainly: an ONLINE dungeon chest refuses any stack over
65,535 on every peer (`loot.js LOOT_STACK_MAX`), and the senders do not
check stack size, so a larger gold stack stored there on the classic skin
would be refused by the room. The enhanced pack cannot reach that (a
chest that is not the player's own is take-only); the classic one can,
as it could before this.

## DECOR-SHELL: a placed piece stays in the room (later the same day)

A player, relayed by Mac: *"decor they go poof"*, *"They are there / But
its model disappearing / Placing models is different then the ones
after"*. The pieces stood, and were drawn - where the eye could not see
them. The decorator's free camera flew through walls, floor and ceiling,
and from outside a room is an open dollhouse (its faces are one-sided):
a piece set on the ceiling's top or behind a wall looked placed from up
there and was gone from the body's eye. The flight now stops short of
every face and slides along it; a model aimed at a ceiling hangs from it
(its top at the face) instead of standing on top of it; an online home's
decorator waits for the room's list, which used to stand the room over a
piece placed before it landed; and a model that would not load is asked
again rather than remembered as nothing. `06-Systems/Online-Arc.md`
DECOR-SHELL; `test/decorshell.test.js` (5), `tools/mutants/decorshell.json`.

Not reproduced in a browser (no player's save here); the causes are the
code's own, each pinned over a real collider room. The ghost and the
placed piece were already the same mesh, matrix and texture remap; what
still differs is light - the renderer's sixteen nearest lamps are chosen
from the camera, which flies while placing, and a placed piece's shadow
joins the lamps' cached ones after a moment where the ghost's is redrawn
every frame.


## DUNGEON-SEAMS: the holes in the stairs and the curved ceilings, closed (later the same day)

A player, relayed by Mac: *"if you look around stairs and curved cellings
in dungeons, you can spot holes leading into void, sometimes you can even
see other rooms through those holes"*. The holes were Daggerfall's own -
DFU shows them too: stair treads that stop a unit or two short of their
walls (four, at one flight's end), a vaulted ceiling and a round room's
ceiling that stop short of the corridors they meet, posts that float a
unit or two off the floor. The port now
moves those corners where the pipeline builds each model (32 models, 25 of
them ones XJDHDR's DFU fix pack replaces); measured over every dungeon
block of the game, the slits fall from 38,885 to 7,215 and the ruled
models' from 31,263 to 69, and all but twelve of the 31,453 moved corners
land on a face. `07-Rendering/Rendering.md` DUNGEON-SEAMS,
`01-Overview/Port-Ledger.md`; `test/dungeonseams.test.js` (9),
`tools/mutants/dungeonseams.json`.

Not done, said plainly: the 7,146 slits left are on models no rule
touches, and the census cannot tell a hole into the void from a gap in
front of a wall; four models XJDHDR closes (58045, 60110, 70809, 74009)
are not ruled here. Seen by eye in four dungeons, not in a player's save.
The classic lane has the patch too - whether it should keep DFU's holes is
Mac's call.
