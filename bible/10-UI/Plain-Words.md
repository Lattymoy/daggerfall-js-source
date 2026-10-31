# Plain words

Every system says what it is, on the screen it is used from, in plain words. This page holds the rules for the game's
descriptions and guides, and the guides that explain the Notice Board's Seat tab, the Chapters, Project Legacy's
Family tab and a resident's regard on the talk panel. The voice and spelling rules are in `10-UI/Voice.md`.

## How it works

**The Seat tab** (`src/ui/seatTab.js`). Under the Charter, before any number: WHAT THIS IS (`seatAbout`) and the
reader's next step from where they stand (`seatNextStep`: no guild, a guild not pledged here, pledged elsewhere, the
holder, and so on), with the pledge lever beside it where the step is to pledge here (`seatMayPledgeHere`). Then HOW
THE SEAT WAR WORKS, open for a reader whose guild has no pledge in the region (`seatGuideOpen`), and WORDS ON THIS
BOARD (`seatWords`), every term the tab uses with its meaning. Folds are the board's `boardFold`: the reader's choice
is kept across redraws.

**The Chapters** (`src/ui/noticeWindow.js` `chapterGuide`). HOW CHAPTERS WORK stands over the Work tab's chapter cards:
what a chapter is, Merit, Strength, the bands, the chairs, the Season and the patron. It is open for a reader with no
Merit yet in the region's chapters, folded otherwise.

**The Family tab** (`src/ui/familyPages.js`). A HOW IT WORKS page (`familyGuide`, `drawGuidePage`): the house, death
and its toll, who carries on, what carries on, heirlooms and remains, marriage and children, and the tree's marks. The
tree links to it ("New to the family? How it works").

**Regard on the talk panel** (`src/ui/enhanced/enhancedTalk.js`). A living resident's regard shows under their name:
the standing in the Chronicle's words (`STANDING_NAMES`: Friend, Known, Enemy, Hostile), a bar from -100 to +100 and
the signed number. A press on it says what the number is and what moves it. An Enemy or Hostile resident refuses
before any panel opens, and the refusal says where they stand ("Mara turns away from you. (Enemy, -52)"). The words
are `regardBadge` (`src/systems/livingWorld/people.js`); each body's own door supplies its card (`regardCard` on the
town, indoors and road doors). `src/scenes/world.js` words it and `src/scenes/townTalk.js` hands it to the panel as a
hook, so the panel imports no conversation law. The fixed-city bench runs no living world, so it shows none.

## Rules

- What a system is comes before its numbers; a surface says what it is and what the reader can do next.
- A word the screen uses is defined on that screen, folded if need be.
- Every number in a guide or word list is read from the constant that enforces it, never typed
  (`src/net/townSeatLaw.js`, `src/net/npcChapterLaw.js`, the legacy modules).
- A guide is open for a reader new to its system and folded for one who is in it; the reader's own choice then holds.
- A finger has no hover: what a hover explains, a press explains too.
- The screen speaks to the player: no slice code, file name, module, "port" or developer voice; a description says
  what a thing does and what to do with it, once.
- No AI-like prose and no over-explaining: the event, then what to do, then stop; no dash asides; numbers as
  numerals; every fact a player needs is kept (the owner).
- The mods' own setting descriptions are rewritten plainly (`src/systems/modSettings.js`); the vendored
  `modsettings.json` files are untouched, and each settings test holds a `PLAIN` map of the rewritten keys while every
  other key must equal its author's text. A key that does nothing here says "Has no effect".
- Credits say what each mod or library does for the player and keep every author, mod, version and license.

Left as written: Daggerfall's and DFU's own text and names; in-world voice (taunts, omens, greetings, letters); the
Code of Conduct, whose wording is versioned (`CONDUCT_VERSION`); machine-read text (command syntax, save words,
console lines, errors); label-value lines; the mods' own runtime messages.

## Code and tests

- `src/ui/seatTab.js` - the Seat tab's guides and word list
- `src/ui/noticeWindow.js` - the Chapters guide and `boardFold`
- `src/ui/familyPages.js` - the Family guide
- `src/systems/livingWorld/people.js` - `regardBadge`, `STANDING_NAMES`
- `test/systems/legacy/plainui.test.js` - next steps, guides and their numbers, the regard badge, the board's type
- `test/ui/audit_plainui.test.js` - folds, regard doors, touch presses
- `test/systems/l10n4_hardcoded.test.js` - hard-coded player strings may only fall
- `tools/noticeBoardProbe.mjs` - photographs the two guides unfolded at desktop and phone sizes

## Open

- The classic talk window draws DFU's own layout, so regard shows on the classic skin only in a greeting or a refusal.
- DFU's own walkers and static NPCs keep no regard and get no badge.
- On large screens the board stays 1040 px wide, so its type is smaller against the screen. A window-size setting is
  the owner's call.
- Tracking a chosen person is a design call not yet made. Today a party shows its members on the world map, and the
  Chronicle's People page shows a resident's home town and when last seen.
