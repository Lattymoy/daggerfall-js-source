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
