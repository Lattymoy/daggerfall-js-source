# UI-CALM - the quiet pass (2026-10-14)

> Enhanced Plus and DFO Grimoire. The sheet is `ui/uiCalmStyle.js` (laid after Plus's by `ui/enhanced/enhancedStyle.js`
> injectEnhancedStyle); the behaviour lives in the modules named under each point. Pinned by `test/ui/enhanced/uicalm.test.js`
> and `tools/mutants/uicalm.json`.

## The report

A player, in six points, asking that the UI come before more systems: "It's confusing, hurts immersion, and gives new
players a terrible first impression ... The original Daggerfall is immersive despite its age. These modern-looking
panels full of text constantly pull me out of that world."

1. **Main menu** - "The first screen should just have ONLINE and OFFLINE, with Online first. Continue, New Game and Load
   Game belong under Offline. I've seen people create characters thinking they're playing online, only to discover later
   that they're offline."
2. **Character creation** - "look like placeholders made of text and buttons."
3. **Menus** - "cluttered, ugly, and lack visual hierarchy. Why are horse coat colors huge buttons instead of a selector?
   Why do they take up more space than the horse stats?"
4. **Readability** - "Text is often barely readable. Font and size settings aren't a solution ... The default should look
   right."
5. **Gameplay UI** - "Why is there a huge, unmovable panel showing horse/cart info at the top of my screen? ... Put that
   info in a separate menu. I like the temperature indicator, but it would fit better in the bottom-left corner."
6. **Too much on screen** - "Not everything needs to be visible constantly. Show information when it's relevant."

## What changed

### 1. The front door asks which world first (`ui/enhanced/enhancedMenu.js` drawDoors)

- The enhanced front door's first screen is two doors, **ONLINE** first, then **OFFLINE**, each with a line saying what
  lies behind it; **Settings** and **Overhauls** (`HOME_LINKS`) are plaques in the foot's box (see 7).
- **Offline** opens the offline doors - Continue, New Game, Load Game, the Test Room (`HOME_OFFLINE`) - and a way
  **Back**. A pane one of them opened backs out to them (Escape, the wordmark); Escape on them backs out to the two
  questions. Every visit opens on the two questions. Settings and Overhauls back out to the level they were opened
  from, as Tutorials does (AUDIT UICALM-FIRM1 L3 N1).
- A double click is one door's: its second click is no door's (`doorBtn`), where it had opened Load Game, drawn under
  the pointer by the first (AUDIT UICALM-FIRM1 L3 M2). Escape puts the keyboard back on the door it came from - Offline,
  or the section's own door (`focusDoor`; L3 L1).
- The shell's rail stands in the same order: Online first, Offline's four under their word (`.railgroup`). On a phone
  the word takes a row of its own, never a door's slot (L3 L4), and DFO Grimoire's phone rail is its page, its word
  the deep red whole (L3 M8: the rail had stood on the dark under the page's ink, "Main menu" at 1.29:1).
- DFO Grimoire writes the two questions on the book's two leaves - *The Realm* (Online) and *Thine Own Tale* (Offline) -
  and the offline doors on the left leaf with the Test Room and the way back on the right; on a narrow or a short
  screen (the book wants 561px of height - its fixed type ran "Thine Own Tale" into "Offline" at 932x430; AUDIT
  UICALM-FIRM1 L3 M1) or over the map, one page held up, in the page's ink.
- The classic skin's door keeps its one list (Begin, Online, ...): `twoQuestionDoor` is the enhanced boot rail's alone.

### 2. Character creation shows the class before it is read about (`ui/enhanced/enhancedChargen.js`)

- The class list stands in Daggerfall's three ways - Magic, Stealth, Combat (`CLASS_WAYS`, its manual's mages, thieves
  and warriors) - each under its head; each row says the two attributes the class leans on (`leadingAttributes`). A
  class's way is found by its career's own key, never its shown name, so a translation pack keeps the heads (AUDIT
  UICALM-FIRM1 L3 M3).
- The card beside it is the class's profile from its own CLASS*.CFG numbers: eight attribute bars, its primary and
  major skills, its hit points a level as the roll gives them ("3-6 a level, more with Endurance" - half the career's to
  all of it, `hitPointsPerLevelUp`; "up to N" undersold it, L3 L2) - before TEXT.RSC's description is asked for.
  "Play as an Acrobat", "an Archer" (L3 N2).
- **Begin your life** is the action bar's primary, at its far end, where every stage's way on stands; Start over stands
  beside Back (see 7). On a phone the bar wraps and the way on keeps no floor, so its three presses keep the screen
  (L3 M4).

### 3. Menus with a hierarchy (`ui/holdingsPages.js`, the pause window)

- The Stable card puts the care first (its words, bond, breath, Feed and the apple), the four stats under a small head,
  and the LOOK last - one line ("Black horse with socks.") and a small **Change look** press. Opened, the coats and a
  wagon's paints are **swatches** (`LOOK_SWATCHES` - the one worn ringed and named), the patterns and the legs a
  **stepper** (‹ Solid ›). No choice of coat is a press the size of a door any more.
- The pause window's six tabs stand on one row where the window is wide (System had wrapped onto a row of its own).

### 4. Readable by default (`ui/uiCalmStyle.js`)

- The quiet ink (`--dim`) a step lighter under Plus: #b9b2a1 for #9a9486.
- A type floor of 12px for every word a player must read - the Settings screen's chips, segments, counts and tags, the
  Overhauls cards' labels, the tutorials' "new", the pack's shelf and empty-slot words (the empty slot's word was
  #333c47 on the dark; now 4:1). The Stable card's words go from 11px grey to 14px. The Settings screen's All off and
  Reset, the walk's pool heads and a phone's map names were left at 11px by the first pass (AUDIT UICALM-FIRM1 L3 L3).
- Every colour the sheet says is Plus's alone (`P`, `:root:not([data-plus-dress="grimoire"])`): DFO Grimoire inks every
  sheet into its own pages' colours, and a colour said for the dark ground would be inked onto the paper. The class
  card's bars had stood for both - their dark and amber on the Grimoire's page - and are now each dress's own, the
  Grimoire's in its ink and red (AUDIT UICALM-FIRM1 L5 L3; uicalm's pin reads the sheet rule by rule).

### 5. The gameplay HUD

- **The saddle panel stands when it is wanted, and low** (`ui/enhanced/enhancedSaddle.js` saddleShown). The whole panel when its
  key puts it up (F2, see 7 - the second pass's law, which replaced the first pass's "while the mouse is free": the
  code reads the key and the choice, never the mouse - AUDIT UICALM-FIRM1 L4 M7) or the choice is Always; away, one line
  when something needs the rider (`saddleAlert`/`saddleNote`: winded, short of breath, hungry, a wagon rickety or failing,
  a load past its limit, with its own meter), and the horse's name with how to call the panel for the first six seconds
  in the saddle (`SADDLE_HELLO_MS`). A finger has no free mouse: a small plate with the name, a tap from the panel. It
  is a block in the bottom-right corner, lifted over the vitals and the hotbar only where it would cover them
  (`placeBar`; a finger's under the compass's band, `placeTouch` - AUDIT UICALM-FIRM1 L4 M2), never across the compass
  and the sky; F2 puts it up and away (see 7), its press kept with the choice it was made under (L4 M1). The
  Stable page is its separate menu, every word of it there. The player's choice is the Horse care row's part
  **Saddle panel**: When needed (default), Always (STEED-UI's), Off.
- **The temperature stands in the bottom-left corner** - the quick block's caption, its first word beside the mode's
  (`ui/enhanced/enhancedHud.js`), still a HUD piece of its own (`ui/hud/hudLayout.js` 'temp', inside 'quick'). Comfortable it says
  the glyph and the number alone; felt or costing, its word and its scale too. TEMP-UI's fit off the compass's end
  (`fitTemp`: beside, compact, hung, aside) is retired with the place it measured.

### 6. Information when it is relevant

- **The Calm HUD** (`features.js` 'calm-hud', `hudCalm`, on): the health, fatigue and magicka bars fade away while all
  three are full and no foe is targeted, after `VITALS_REST_S` (4 s), and come back at the first point lost or spent;
  never while the HUD is being arranged.
- The saddle panel and the temperature above follow the same law.

### 7. The second pass - the walk, the door's foot and the Settings screen polished

A player, after the first pass: "here back to main menu is missing and iam not a fan of those dotted lines", "the horse
riding menue would be great in a blocky form in the bottom right and we need a keybind to make it appear and
disappear", "start over looks missplaced and when i randomly [click] around in the class selection i hear drums all the
time", then "it looks in general cheap - letters overlapping, dotted line everywhere, the highlighting of words is bad,
the summary board looks cut off ... massively polish all this and do the same for enhanced ui plus AND settings".

- **The way home** is the shell rail's first row, *Main menu* (*Back* at pause), its arrow before it.
- **No dotted rule anywhere in DFO Grimoire** (`ui/grimoireDress.js`): every dotted border is drawn whole, and a
  heading's rule is one plain line of the page's brown (`RULE_UNDER`) - the spellbook stroke with its dotted ends is
  no longer laid. No word wears a rule under it when the pointer is on it.
- **The saddle panel is a block in the bottom-right corner** (`ui/enhanced/enhancedSaddle.js` `.saddlepanel-bar`, 300px, its
  meters a grid and its presses two to a row), lifted over the hotbar or the vitals only where it would cover them. It
  goes up and away on its own key, **F2** (`SaddlePanel` in `systems/inputActions.js`, rebindable in Controls; the hosts'
  saddle frame reads it - `scenes/saddleHost.js` `toggle`), and the choice is kept (`saddlePanelOpen`). The hello names
  the key.
- **Start over stands in the action bar** beside Back (`stageSecondary`), Begin your life at its far end - not on the
  review's card.
- **Reading a class is quiet** (`classCalm`, laid by `muteConstellation`): a double click is two on the SAME row (a quick
  click on one class and then another is browsing), and the drums sound when the class is chosen (the confirm's Yes),
  not each time a class is read. The classic screen keeps DFU's time-alone double click and its drums on the pick.
- **The map's names are plates over the map** (`mapPane`, `untangleLabels`): said in map units inside the picture, a
  name was as tall as DFO Grimoire's whole sizes made it (16 units - three times the map's scale) and High Rock ran
  into Hammerfell. Each name is now a small plate in the screen's pixels at its province's label point, and names that
  would touch are moved apart up and down (never across), the Imperial Province's - which no one can choose - first and
  alone. The land and its name light together, whichever the pointer is on (`.hot`); the chosen one is the red plate
  (Grimoire) or the brass one (Plus). The plates are laid again whenever one grows - a dress's face that arrives late
  widened them after the first lay, and they touched and left the map (AUDIT UICALM-FIRM1 L3 M6).
- **A confirm card scrolls its words and keeps its presses** (`.dcard.confirm .dscroll`): TEXT.RSC's longest ran past
  the card's foot and took "Play as ..." with it. The class's description flows as the race's does (a blank line is
  the paragraph's end). On a phone the sheet it rides in bounds it, so the presses stand on the screen (AUDIT
  UICALM-FIRM1 L3 M7).
- **The walk's page** (`uiCalmStyle.js` CHARGEN_CSS): on a desk a stage's column is at most 760px with its card beside
  it at the column's top (the map's stage takes the wider column); the card's column has no ground of its own; the class
  profile's eight bars start at one edge (one grid, not eight). Two choices (sex, how to choose a class) are cards one
  sees are pressable - DFO Grimoire's are leaves of its parchment in the frame, the chosen one red with a red line
  inside; the bar's presses are plates; no doubled shadows under the words.
- **The walk's panels are windows** (a player: "scroll bars, the windows look cheap and just placed in with no quality
  border, the selected skill also doesn't look good"): under Plus the list, the skills' page and the card wear the
  windows' carved frame and ground (`enhancedFrame.js` `WINDOW_FRAME`); under DFO Grimoire the wood list wears the
  pack's frame. One scroll - the stage's - and none on a list that fits (sized to its rows it rounded a pixel over its
  own box and drew a bar beside eight rows); a needed one is thin, in the frame's colours. The chosen row is a lit bar at
  its edge and a warmer ground, its name lit - not a box drawn round the row and its presses. A way on that waits ("18
  left to spend") reads, not greyed to nothing: an ink of its own under Plus, 0.85 of the page's under the Grimoire
  (AUDIT UICALM-FIRM1 L3 M5 - the first pass's opacity over the disabled grey read at 1.46:1).
- **The front door's foot**: Settings and Overhauls are plaques in the foot's box beside Screenshots and About
  (`appendPxFoot`), so the book's two leaves hold the two questions and nothing else. The foot says its height
  (`--px-foot-h`, measured) and the stage ends there: the two plaques wrapped the foot past the stage's fixed reserve,
  and a tap on Offline, Load or Back opened Settings (AUDIT UICALM-FIRM1 L3 H1). A phone's and a short screen's
  plaques share one wrapped row; every plaque in the player's language (Tutorials and Screenshots were English; L3 N3).
- **The Settings screen reads as one list** (`SETTINGS_CSS`): a Features row and a plain row are the same line; the tags
  under a name are words ("Enhanced · DFU Classic"), not boxed capitals; the card beside the list stands clear of the
  screen's top.
- **The Firmament says why a read failed** (`ui/firmamentWindow.js` `readFailText`, `net/firmament/firmamentBook.js`
  `state.status`): a refused `/v1/firmament/state` had left the purses at their empty defaults - "0 of 0", Renown 1 - as
  if that were the answer (a test server whose account service had not been deployed with the Firmament, or whose
  migration 0114 (written as 0113) was not applied, showed a Renown 5 character no stars). It names a 404 (no Firmament on that service),
  a closed switch, no session, no word, or the status.

## Not done here

The windows still behind the classic art (the spellbook, the travel map, the journal) and the online character list's
cards were not redrawn in this pass; the type floor reaches them where they share the skin's classes.
