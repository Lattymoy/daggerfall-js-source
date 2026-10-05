# FIELD BUGS 2026-10-04f - a witches' book that sets the watch on you; an assassin's mark who is never there

The Discord's #bug-reports thread "Bugged Quests", handed over as a screenshot: two quests, each reported as broken.
Neither is: both run DFU's own scripts as written. The first is answered here. The second gets a line on the plaque
(the owner, asked: "Do it"), pinned by tests that fail on the code before it and mutation-checked
(`tools/mutants/fb1004f.json`, 8, all dead). Nothing here was seen in a browser: this container has no ARENA2, so every
claim is the real parser's and machine's, driven over `test/fb1004dTowns.mjs`'s region and a real foe pool.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Izex: "The quest, A Rare Tome ... has you talk to a man about a book. I talked to him and he said he would report me to the guards and I had a -30 to my reputation and now I get hunted." | Q0C00Y08 as DFU ships it: the book is stolen, and the script says so | answered |
| 2 | "The quest The Assassin ... has you track down and kill Rodyn Buckingston. I am at his location, he doesn't spawn. I double checked with multiple NPCs on his location as well." | A0C00Y08 as DFU ships it: walking in hides the named man and stands a peaceful class foe on his marker - the kill the quest counts - which nothing names as his | QUEST-FOE-LINE |

## A Rare Tome (1) - answered, DFU's own

`vendor/dfu-quests/Quests/Q0C00Y08.txt`, the Glenmoril Witches' quest. Clicking the contact runs `_S.04_`: `get item
_book_`, `say 1011` ("Awright, %pcf, here's the book. Just watch yourself. The guards are combing ___contact_ for that
thing."), `have _book_ set _S.05_`. And `_S.05_` is the whole of what the player met: `create foe _guard_ every 20
minutes 20 times with 50% success msg 1012` (a Knight, "Stop! Thief!") and `legal repute -30`. The port runs both as
DFU does - `LegalRepute` (`src/systems/quest/actions.js`, the current region's LegalRep through the court's
`changeLegalRep`) once, and `CreateFoe` every twenty game minutes - so the Knights come until twenty waves are spent
or the quest ends: handing the book to the witches (`toting _book_ and _qgiver_ clicked`) ends it, and so does its
clock `_queston_` (run out with the book in hand, message 1013 makes it the player's for good). The -30 stays: below -10 the watch knows the
face (REP1, `src/systems/standing.js` `KNOWN_CRIMINAL_BELOW`) and stops the player in that region, two game hours
between stops. It mends by REP4's ways - a point back every seven days, five at a temple's penance (200 gold, then
400, 600, 800: four bring a -30 to -10, where the watch stops knowing it), two for a bounty contract. Nothing changed.

## QUEST-FOE-LINE (2)

`src/systems/questFoeLine.js` (`questFoeLine`, `questFoeSubs`, `QUEST_FOE_PREFIX`); the three live-foe namers that
hand it - `src/scenes/exteriorFoes.js` `liveHoverName` (the street's, for both above-ground hosts, and the pool every
building's foes stand in), `src/scenes/worldModes.js`'s interior arm and `src/scenes/dungeonContext.js`'s.

The trace, over the real parser and machine (`test/fb1004f_questfoe.test.js`): A0C00Y08 places `_darkb_` - the man the
journal names - at `_place_`, a building of the quest's town, and `pc at _place_ set _S.11_`. Walking in, the first
tick runs `_S.11_`: `hide npc _darkb_` (he goes) and `pick one of _S.01_ _S.02_
_S.03_ _S.04_`, each of which is `restrain foe` and `place foe` of one of an Archer, a Bard, a Rogue or a Spellsword.
The place foe is Place.AssignQuestResource's hot-place: the foe takes the very marker chosen for him and stands
through the interior adapter's `standFoe` into the room's foe pool, at peace (`restrain foe` -> setNonHostile). It is
the kill `killed 1 _rogue_` counts. The read-only lane that walked the live path found no host that drops it - the
mint before the layout, the hot-place mode-aware in both above-ground hosts, a quest foe outside the caps and the
elite and champion rolls, nothing that culls a peaceful foe indoors, the walk standing it again on a re-entry while
`killCount < spawnCount`, the save's own record bringing it back with its link. What the player saw was a "Rogue"
standing quietly where Rodyn Buckingston was said to be, and the plaque calling it "Rogue": its career's word
(worldTooltips.js `liveEntityName`), the foe's own random name in no message of this quest, and the rumour (message
1033) still saying the man "is usually at" the place.

So a quest's foe at peace says whose it is. Under its name the enhanced plaque carries one line, "Quest: " and the
quest's title as every journal face cuts it (`ui/questRail.js` `questTitleOf`) - "Rogue / Quest: The Assassin". The
line is read off the foe's own QuestResourceBehaviour (every pool's record carries it, `scenes/questFoeHost.js`
`bindQuestFoeHost`) and never kept, and the machine is only asked: the quest that stood it, the resource a Foe of it,
the journal holding an entry (Quest.GetLogMessages, empty once the quest has ended too - the Quest Guide's second law,
NOTHING THE JOURNAL HAS NOT SAID), and a display name. A hostile foe is named nowhere on the plaque still (HOVER-PLAIN),
so the line rides the peaceful ones: the restrained marks, a calmed foe, a beaten revenant of a quest. All twenty-six
quests of the corpus that restrain a foe carry a DisplayName; the twenty-eight with none say nothing.

The four hosts: `scenes/worldModes.js` (interior) and `scenes/dungeonContext.js` (dungeon) wired at their live-foe
arms; `scenes/world.js` and `scenes/exterior.js` name their live foes through the pool's own `liveHoverName`, wired.
`scenes/cityGuards.js`'s arm is not: no quest stands a watchman (a quest's `create foe` and `place foe` stand into the
foe pools). The classic skins' panel draws a pile's rows and nothing else (`ui/classicLootPanel.js` `drawLootPanel`),
so the line is the enhanced plaque's alone; and the plaque is not drawn on a touch screen (`ui/worldPlaque.js`
`worldPlaqueOn`), so a phone sees no line - the tap-anchored plaque is that surface's own later slice.

Pins `test/fb1004f_questfoe.test.js` (3): the trace (the man hidden, one Rogue at peace on his marker, the pool's hover
`{ title: 'Rogue', subs: ['Quest: The Assassin'] }`, the plaque's frame, a quest person no line, and the kill firing
`_S.07_`); the law (a kind label cut, no line before the journal or after the quest, none for a nameless quest, a
hostile foe unnamed, a plain foe's frame unchanged); the hosts (the interior and dungeon arms, the street hosts through
the pool, the watch none, the classic panel refusing a name frame). `test/loot7check.test.js` and
`test/revenant_audit.test.js` hold the street's and the dungeon's "- beaten" cue with the line beside it. Ledger A:
QUEST-FOE-LINE.
