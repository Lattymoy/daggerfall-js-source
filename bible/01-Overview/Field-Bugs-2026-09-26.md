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
