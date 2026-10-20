# PLAIN WORDS - every system says what it is, on the screen it is used from (PLAIN-UI, 2026-10-12)

The port's own. Four online and Enhanced surfaces that worked and did not explain themselves - the Notice Board's Seat
tab, the Chapters on its Work tab, Project Legacy's Family tab, and the talk panel's missing relationship - each made to
say what it is, what its words mean and what the reader can do next, in larger type. No mechanic moved: every number
on these pages is read off the law that enforces it.

## Asked

A player (2026-10-12): "For the online guild system. The seat page on the notice board is extremely vague. Its tiny,
doesnt explain anything and is extremely hard to understand. Same issues with the project legacy system. Where's the UI
for relationship in the talk window? How can you reliably track people? Sam see issue with the new guild chapter
systems. Theres just so many systems that dont explain what they are and its extremely convoluted."

## 1. What a player met (FACT, 2026-10-12, at 5cbf50e8)

- **The Seat tab** (`src/ui/seatTab.js`): its panels' text 13px and their names 12px, in the pixel face. Its one
  explanation, "How the seat war works", stood FOLDED under the Charter, the week, the battle, the standings, your guild,
  the holder's orders and the works - below the first screen at 1280x800, so a reader met "Muster", "Reckoning",
  "Turning", "Right of Siege", "defence", "Standing", "Tithe", "Edict" and "influence" before anything said what one was,
  and most of those words were defined nowhere on the tab at all (the guide and the lines used them; AUDIT PLAIN-UI R1). `11-Multiplayer/Guilds-Made-Plain.md` section 1 held this
  tab "already plain"; the player's word is the record that it was not.
- **The Chapters** (the Work tab's cards, `src/ui/noticeWindow.js` `chapterCard`): every line 12px; no word on what a
  chapter is or how one joins, what Merit and Strength are and how they move, the bands' thresholds, the chairs (ranks 8
  and 9), the Season's events or a patron. The tenure and the one-chapter-a-week rule were said only when they refused
  the reader (the cap stood in the Merit line's "150 of 600"; AUDIT PLAIN-UI R1).
- **The Family tab** (`src/ui/familyPages.js`): the tree's names 11px, the card's chips 10px, its facts 12px. Nothing on
  it explained Arkay's toll, the Elder, the Succession, what an heir inherits, the heirloom and the remains, marriage and
  children, or the tree's own marks. The tutorial's two sentences (`src/systems/tutorialCatalogue.js` `legacy`) fire once,
  when an heir first takes over; the chargen tiles are seen once.
- **Relationships**: a living resident's regard (`src/systems/livingWorld/relations.js`, -100 to +100) was shown in
  the Chronicle's People page alone (`peoplePage`, in words, no number) - in the talk window, nothing. A friend's
  greeting and an enemy's refusal were the only signs at the moment of talking.
- **Tracking people**: nothing tracks a person the player chooses. FACT, what exists: the talk's Where is > People and
  its map mark (quest people in the same town only - `src/systems/topicTree.js`); the quest tracker, marks and compass
  (a quest's place, once it is on the map); the escort faces; the Chronicle's People page (home town and days since last
  seen - never where they are now: residents walk a day's plan, `src/systems/livingWorld/dayPlan.js`); a party's members
  on the world map (`src/ui/partyMapMarks.js`, each at the map pixel they stand in now); the friends list (online or last online, no place);
  the chat roster and name tags (no place); hand-set waypoints.

## 2. What changed

- **PLAIN-UI a, the Seat tab.** Under the Charter, before any number, three panels: WHAT THIS IS - the seat in two
  sentences (`seatAbout`) and THE READER'S NEXT STEP from where they stand (`seatNextStep`: no guild - where to join or
  found one; a guild not pledged here - pledge it, or ask an Officer or the Guildmaster, or wait for the next Muster;
  pledged elsewhere; a guild at its regions' most; not yet counted; an account bound to another guild; the holder; one
  who earns); HOW THE SEAT WAR WORKS, moved up from the foot, OPEN for a reader whose guild has no pledge in the region
  and folded for one whose has (`seatGuideOpen`); and WORDS ON THIS BOARD (`seatWords`), folded: every name the tab
  uses beside its meaning - Charter, Influence, Muster/Reckoning/Turning, Pledge, Defence, Right of Siege, Tourney,
  Standing, Tithe, Edict, Tribute, Sellsword, the Works, Fealty and Pacts, Season and Tide - its numbers
  `net/townSeatLaw.js`'s own (`CLAIM_THRESHOLD` by tier, `CONTESTED_MARGIN`, `STANDING_START`, `STANDING_UNREST`,
  `UNREST_BONUS`, `TITHE_CAP`, `TRIBUTE_MARKS_PER_INFLUENCE`, `SEAT_LEGACY_SHARE`, `SEAT_PLEDGE_REGIONS_MAX`). All three
  stand for a reader the standings refused or have not reached yet too (the next step alone waits on them). Where the
  step is to pledge here (`seatMayPledgeHere`), the pledge's own lever stands beside it, through the window's one door;
  a pledge elsewhere names its seat, and a deadline says the time left (AUDIT PLAIN-UI U2). A fold is
  the board's `boardFold`: the reader's press on its line is their choice, kept across the tab's redraws - never the
  `toggle` event, which a browser fires for an `open` the draw set as well (AUDIT PLAIN-UI C1, C4); its line is a
  finger's 44px with a ring of its own (U3).
- **PLAIN-UI b, the Chapters.** HOW CHAPTERS WORK over the Work tab's chapter cards (`chapterGuide`, `CHAPTER_GUIDE_TITLE`
  in `src/ui/noticeWindow.js`), where the region keeps a chapter: what a chapter is and how one belongs to it, Merit,
  Strength (the week's mark, the fall back toward 50, a week with none, the Failing band's fall, the Rivalry's swing,
  the Season's end), the bands, the chairs, the Season and the patron - every number `net/npcChapterLaw.js`'s
  (`MERIT_WRIT`, `MERIT_RECEIPT`, `MERIT_TENURE_S`, `MERIT_CAP_WEEK`, `STRENGTH_START`, `STRENGTH_MIN`, `STRENGTH_MAX`,
  `STRENGTH_TARGET`, `STRENGTH_STEP_MAX`, `STRENGTH_SHORT`, `STRENGTH_IDLE`, `CHAPTER_FAILING_FALL`,
  `CHAPTER_FAILING_MEETS`, `CHAPTER_EVENT_EFFECTS`, `CHAPTER_BANDS`, `SEAT_RANK`, `CHAPTER_SEATS`, `SEAT_TENURE_S`,
  `SEAT_ACCOUNT_AGE_S`, `SEAT_MERIT_WEEKS`, `CHAPTER_EVENTS`, `CHAPTER_PATRON_MIN`, `CHAPTER_PATRON_BAND`). Open for a
  reader with no Merit yet in any of the region's chapters, folded for one with some - the service sends a Merit row for
  every membership, none earned and a week's wait included (`server-account/src/npcMerit.js` `meritAsks`; AUDIT
  PLAIN-UI T3). The guide stands where the cards do - on every board since CHAPTERS-ON (2026-10-12, `server-account/wrangler.toml`
  `CHAPTERS_OPEN = "on"`; `01-Overview/bugs/Field-Bugs-2026-10-12.md`), which met this arc at its merge.
- **PLAIN-UI c, the Family tab.** A fourth page on its rail, HOW IT WORKS (`FAMILY_PAGE_SECTIONS` `guide`,
  `drawGuidePage`, drawn by `src/ui/enhanced/enhancedMenu.js` `pauseFamily`): `familyGuide(model, tollShare)` - the house; death in
  the house's own model (both, before one is founded), its toll the Features tile's (`legacySettings().tollShare`); who
  carries on; what carries on - the estate to whoever takes the line, the blood and the hearth to a newborn alone, at
  birth (`BLOOD_MAX`, `HEARTH_MAX`, `ESTATE_SHARE`, `ESTATE_MAX`; AUDIT PLAIN-UI W2); heirlooms and remains
  (`systems/legacy/heirloom.js`); marriage and children (`systems/legacy/marriage.js`, `FRIEND_AT`); playing another
  member; and the tree's marks. The tree carries a way to it ("New to the family? How it works", U8). Its type a step
  larger: names 12px on up to two lines with the whole name on hover (U6), marks 13px, chips 12px, the card's facts,
  kin and words 14px, its heading 18px; the card 268px beside the tree, as it was, so the tree keeps its plates (U7).
- **PLAIN-UI d, the regard on the talk panel.** The enhanced talk panel (`src/ui/enhanced/enhancedTalk.js`, ET1) shows a living
  resident's regard under their name: the standing in the Chronicle's own words (`STANDING_NAMES`: Friend, Known, Enemy,
  Hostile), a bar from -100 to +100 with its middle marked, and the number signed. A press on it says, in a line across
  the panel's head, what the number is and what moves it (a finger has no hover; the `title` says the same to a mouse;
  a "?" after the number says it can be pressed, U10). An Enemy or a Hostile resident refuses before any panel opens,
  so the refusal itself says where they stand - "Mara turns away from you. (Enemy, -52)" (U11).
  The words are `regardBadge` (`src/systems/livingWorld/people.js`), off `src/systems/livingWorld/relations.js`'
  thresholds, the number taken toward nought as the standing reads it (AUDIT PLAIN-UI W6: a regard of 39.5 is Known
  +39, never +40). The card is the body's own door's - a body's `living.town` is the door it was minted with
  (`src/world/travellerSprites.js`): the street's `LivingTown.regardCard`, a resident at home `_livingIndoorsDoor`'s,
  a road's or a diver's `_livingRoadsDoor`'s (`src/scenes/livingWorld/livingRoads.js` `regardCard`, a company's word its head's),
  each on the day its `refuses()` reads (AUDIT PLAIN-UI C2: the street's alone shipped first). The host words it
  (`src/scenes/world.js` `livingTalk.regard`) and `src/scenes/townTalk.js` hands it to the panel as a hook for the
  resident the conversation is with (`_toneTarget`) and nobody else - so the panel keeps ET1's law of importing no
  conversation law.
- **PLAIN-UI e, the board's type.** The Notice Board's panels 15px (were 13), their names 14px (12), the Seat tab's lines
  15px, the Charter's head 17px, the phase strip 13px, the standings and the battle 15px, the Chronicle 14px, the
  chapters' lines and the Merit line 14px (12), the day's writ count 15px.

THE FOUR HOSTS (Home.md, 17e) for the regard hook: `src/scenes/world.js` WIRED (its `livingTalk`, and the indoor and
road doors' cards); the interiors (`src/scenes/worldModes.js`) and the dungeon (`src/scenes/dungeonContext.js`) build no
`townTalk` of their own and talk through world.js's one, so a resident met at home or a diver met below carries the
badge through their own door's card (a static NPC is no resident: none) - AUDIT PLAIN-UI C2 corrected this paragraph,
which said they did before their doors had a card; `src/scenes/exterior.js`, the single-town bench, builds its own
`townTalk` with no `livingTalk` - it runs no living world, so no one there has a regard to show.

## 3. The laws

1. **WHAT IT IS BEFORE ITS NUMBERS.** A surface says what it is and what the reader can do there before the figures it
   is made of.
2. **A WORD THE SCREEN USES IS SAID ON THE SCREEN.** Every name a tab prints is defined on that tab - folded, but there.
3. **THE NUMBERS ARE THE LAW'S.** Every figure in a guide or a word list is interpolated from the constant that enforces
   it, never typed - so a rule's change reaches its explanation (the mutants in `tools/mutants/plainui.json` type them).
4. **OPEN FOR THE NEW, FOLDED FOR THE PRACTISED.** A guide stands open for a reader not yet in the system it explains
   and folded for one who is; once the reader folds or opens it, their choice holds.
5. **A FINGER HAS NO HOVER.** What a hover explains, a press explains too.

## 4. Not done, and why

- **The classic talk face** draws DFU's TALK01I0 on DFU's rects (THE NATIVE-WINDOW RULE, Home.md): there is no rect to
  cite for a regard, so the badge is the enhanced panel's alone. The People page is the enhanced Chronicle's too
  (on the classic skin the Chronicle door opens DFU's journal and history), so on the classic skin regard is shown
  nowhere but in a resident's greeting and an enemy's refusal (AUDIT PLAIN-UI R1) - OPEN, as the classic skin's own
  call.
- **DFU's own walkers and static NPCs** keep no regard (their reaction is DFU's faction law): no badge for them.
- **Bigger screens** (AUDIT PLAIN-UI U1) are OPEN: the board stays 1040px wide, so at 1440p its 15px type is smaller
  against the screen than the old 13px was at 1080p. The candidate is an Interface size row on MAP-SCALE's rule
  (`src/ui/map/mapScale.js`: Auto the screen's height over 1080, 1 to 2) laid over the board, the pause window and the talk
  panel - a new setting across windows, the owner's call. The pixel face's B, C and 2 reading as G, O and 8 (U5) - a player
  may write every enhanced word in a plain face since TEXT-FONT (`src/ui/textFont.js`: Sans, Monospace, Dyslexic or
  their own), which met this arc at its merge; the pixel face's own glyphs stay OPEN - and the phone header's row for
  Close (U4) are older than PLAIN-UI and OPEN with it.
- **Tracking a person** is OPEN - a design call, not a gap in words. What a player can do today is section 1's list:
  the reliable way to keep track of another player is a party (where they stand, on the world map); of a resident, the
  Chronicle's People page (their home town, when last seen). The candidates, for the owner's call: a Track on a People
  card that marks the resident's home on their town's map, and their building for the hour where their town is loaded
  (the day's plan already places them); and a friend's town on the friends list (a privacy choice the friend would make).

## 5. Proof

- `test/systems/legacy/plainui.test.js` (8): the next step's every arm; the guide's open and its kept fold; the word list and its
  numbers by tier; How chapters work over the cards, open, folded and absent, its numbers; the Family page's model,
  toll, numbers, rail and dispatch; the regard badge's words, bar and names, the panel's read of its hook; the town's
  card and the hook's wiring; the board's type. PINS MOVED: `test/ui/board_ui.test.js`'s Seat tab (the panels' order),
  `test/ui/audit657_board.test.js`'s D4 (its reader pledged in the region, so the guide's kept fold is pinned from the
  folded side) and `test/systems/livingWorld/lw2_livingTown.test.js`'s talk doors (the regard beside them); their three mutant records
  (`audit657.json`, `board_ui.json`, `lw2.json`) re-aimed by content and dead again.
- `tools/mutants/plainui.json`: 20 mutants, 20 dead (four re-aimed by content at AUDIT PLAIN-UI).
- AUDIT PLAIN-UI (`01-Overview/audits/Audit-Plain-UI.md`): `test/ui/audit_plainui.test.js` (11), `tools/mutants/audit_plainui.json`
  31 mutants, 31 dead.
- `tools/noticeBoardProbe.mjs` photographs the two guides unfolded (`work-guide`, `seat-guide`) beside its other shots,
  desktop and phone - every tab inside the viewport, nothing spilling sideways.

## 6. PLAIN-SWEEP - the whole game's words, said plainly (2026-10-19)

The owner: *"I wanna do a comprehensive sweep of text/descriptions that are not palatable or proper descriptions. Renove
overexplaining text and replace it with proper palatable descriptions for ease of understanding. Absolutely no AI like
text."*

### 6.1 What a player met (FACT, at da3bb0d5c)

Sections 1 to 5 made four surfaces explain themselves. Across the rest of the game the words had grown the other way:
the house's own record voice on the screen. A setting's description ran to a paragraph and ended in its slice's code
(*"INERT here: Animated Water is not in the port, so the mod's own waves always draw (CSA-J)."*); the About pane's credits
named modules and slices (*"Ported 1:1 from the shipped 1.5.2 (characters/meanerMonsters.js); both lanes, under its own
switch in Settings."*); a Features card explained what it was not (*"This is not Daggerfall Unity's "Smarter Enemies"
setting, which the port does not run."*); refusals hung a second clause off a dash (*"The ship can't carry any more. Any
heavier and it couldn't move."*, *"Your goods changed - the trade is off."*); guides said each rule twice; and the mods'
own setting descriptions were shown as their authors typed them, defaults and typos included (*"If Player Footsteps
Should Make A Sound || Default = True"*, *"underwate"*).

### 6.2 The rules the sweep held every string to

WB13b's (`11-Multiplayer/World-Bosses.md`): the event, then what to do, and stop; no "X, not Y"; no dash asides (" - "
only between a label and its value); orders short; numbers as numerals. And the owner's: no developer talk on screen
(no slice codes, file names, "ported 1:1", "the port", "INERT", "the law", "the relay"); no AI-sounding prose (no em
dashes, no "seamless", "immersive", "elevate", "delve", no hype, no rhythm-of-three padding); plain everyday words over the
house's phrasing ("a press" is a click or a tap; "the reader" is you); every fact a player needs kept; credits keep every
author, mod, version and licence they name.

### 6.3 What changed

Thirteen lanes read every string a player sees - the keyed catalog's 5,288 and the code's hard-coded prose - in
mod settings, Features and tutorials, the enhanced interface and menus, the credits and the account service's refusals,
the online game's chat, social panel, party, realm and safety words, the living world, Revenants and Legacy, the
professions and the Notice Board's guides, ships, the sea and the card tables, the Elite Breach's and the gates' law,
combat, loot and sigils, the scene hosts and the points of interest, the systems, and the remaining windows. Words
only: no logic moved, no ICU argument was added or dropped, no hard-coded literal was split.

- 277 source files; 823 catalog keys (791 rewritten, 32 new - the Elite Breach's windows, `11-Multiplayer/Elite-Gates.md`
  section 31 EG-PLUS) and several thousand hard-coded lines.
- **The mods' own setting descriptions** (`src/systems/modSettings.js`) are said plainly too - a DEPARTURE from the
  1:1-era rule that the pane shows nothing its author did not write (AUDIT 61, a test's own words, not the owner's;
  SCOPE1 governs). About 250 lines changed; the vendored `modsettings.json` files are untouched, and each settings test
  holds a `PLAIN` map of the rewritten keys - every key not in it must still equal its author's text. Five keys that do
  nothing here now say "Has no effect" (Dynamic Skies' particle cap, Travel Options' real grass, Snowfall's three loader
  keys, Immersive Footsteps' two logging keys).
- **The credits** say what each mod or library does for the player and keep its whole attribution. Two claims were
  corrected on the way: Roleplay & Realism's later modules were listed as coming in later slices and ship already; Eye
  of the Beholder's attack and death animations, footsteps and cart were listed as missing and are in its vendor record.
- **Terms**: the King's Gambit's *Least stake* is *Minimum stake* everywhere it is said (`11-Multiplayer/Kings-Gambit.md`
  14.4 kept true).
- **Translations**: the 823 keys drafted again in every language that holds them, in-session through
  `tools/l10nInSession.mjs` (the thirteen whole languages all 823; the languages still drafting the rows they had).
- **The relay** carries player-facing lines in its bundle (the Elite Breach's law, the arena's, the duel's, the
  serpent's, the name filter's, the staff commands'): `world227`, words only (`test/net/relayversion.test.js`;
  world224 on its branch, renumbered past LAYERED-GEAR and VOICE2's world224, GAUNTLET-SLAIN's world225 and
  LORD-SHARES' world226 at the merges of main).

### 6.4 Left alone, and why

- Daggerfall's and Daggerfall Unity's own text (TEXT.RSC, quests, books, DFU's console help and native windows), item,
  monster and place names.
- In-world voice: a lord's taunt, an omen, a resident's greeting, a rumour, a bark, a probation letter.
- The Code of Conduct (`net.conduct.*`): its wording is versioned (CONDUCT_VERSION), and a change would ask every player
  to agree again.
- Machine-read text: chat command syntax, protocol and save words, console lines, thrown errors.
- Label-value lines (*"Crippled - make port for a shipwright"*, *"Recovering - 3 hours"*), which WB13b keeps.
- The mods' own runtime messages (the Foraging mod's *"You cannot chop wood in a settlement!"*, Immersive Footsteps'
  warning box), which are their authors' game text rather than this game's descriptions of them.

### 6.5 The law added

6. **THE SCREEN SPEAKS TO THE PLAYER.** No slice code, file name, module, "port" or record voice reaches a player; a
   description says what a thing does and what to do with it, once.

### 6.6 Proof

The pins that held the old words were moved to the new ones exactly - never loosened (363 test files); the mutant
records whose `old` quoted a changed line were re-aimed by content (114 files) and `test/tooling/mutantdrift.test.js`
finds every one; `test/systems/l10n4_hardcoded.test.js`'s counts fell where a line was routed or merged and rose
nowhere; `node tools/l10nExtract.mjs --check` is in step; the bible's prose quotes of changed lines were kept true where
they describe the game as it is (dated records keep their history). The whole suite, run once with every lane in: 31,265 tests, the seven pins it found still on old words moved and green.

### 6.7 At the merge of main: the sweep meets VOICE2 (2026-10-20)

While the sweep was out, main merged VOICE1/VOICE2 (`10-UI/Voice.md`): a voice pass over 862 strings in 201 files, and
American spelling across the game's own text. The two passes had rewritten many of the same lines, and the merge met
746 conflicting hunks in 400 files. Each line was written once, to both rule sets: Voice.md's (whole sentences, the
game's own words, no HUD, cooldown, stack, reroll, boss or XP in a sentence, no dash asides, American spelling) and
section 6.2's (short, the event and then what to do, no developer talk).

- **Source** (433 hunks, 172 files): counted per string, 360 kept the sweep's line, 122 took main's and 119 are a blend -
  the sweep's shorter line with main's spelling and words (armor, harbor, experience for XP, a grade for a crafting
  tier, lesser foes for adds). Where main changed a fact, main's fact stands. Where the sweep cut a clause as
  over-explaining and main had only re-voiced it, the cut stands. The one hunk with code in it (LAYERED-GEAR's Skin
  card) keeps main's code whole; no key or ICU argument differed.
- **Facts checked against the code on the way**: a card pack holds exactly one card of rare or better (`cardSources.js`;
  the sweep's "at least one" was wrong); a guild's daily chapter cap is for all quests together (main's "each quest" was
  wrong); Masonry and Alchemy offer two choices at rank 100, so "a choice", never "the choice"; a party's travel vote is
  called off when its leader moves, and only the leader is told; the market's bid line keeps U13's wording ("the next
  time you look"), which the sweep had broken.
- **The sweep's own lines that merged without a conflict** were brought into the same voice, as main did with its own at
  its last merge: 71 lines changed (the mod settings' descriptions and the credits, which are this game's words now, in
  American spelling; "stacks" said as a count of times; "reroll" said as what happens - *draw new cards*, *remake*; the
  Shelf's "adds" as lesser foes) and 18 left - a mod setting's key, a variable read as a word, a label-value dash. Lines
  neither pass wrote stay as they were, the mods' own words among them (Voice.md: *"the mods' setting names"*, Travel
  Options' *"travelling"*).
- **Tests** (270 hunks, 181 files; 52 hunks in 46 mutant files): every expectation follows the settled source; no check
  dropped. Four of main's checks that could no longer fail (`/not practised/` after the spelling pass) now read
  *practiced* and guard the line again.
- **Translations**: the languages took main's tables, then the sweep's rows came back wherever they were drafted for the
  English the catalog now holds (11,653 rows). A line whose English changed only in spelling kept its row and moved its
  record (826 rows, VOICE2's own rule); the 50 keys whose meaning moved at the merge were drafted again in every
  language that holds them.
- **The relay**: `world227` (the sweep's world224, renumbered past LAYERED-GEAR and VOICE2's world224 and, at later
  merges of main, GAUNTLET-SLAIN's world225 and LORD-SHARES' world226), words only.
