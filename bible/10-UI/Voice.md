# The game's voice - how DFO's own text is written (VOICE1, 2026-10-18)

> "almost every description and information text that got added ... we need consistent daggerfall jagon in how it
> describes thing, skills, tutorials, how something works and alot more. The stats numbers comparisons and statpage is
> fine as is" - Dudey

Text the player reads (tutorials, item cards, skill and specialization descriptions, profession pages, messages on the
screen) should sound like the classic game's own: its quest texts (`vendor/dfu-quests/Quests/`) and its system
messages. Numbers, stat lines and comparisons are left as they are.

## What the classic text sounds like

From the classic quests and messages already in the tree:

- "You have not rented a room here." / "Your time for this room has expired."
- "It is illegal to camp in or near a city. Continue?"
- "A house here in town is infested by giant rodents. The wife claims they are rats, the husband claims they are bats.
  Either way, they want them gone." (`M0B00Y15`)
- "Bring it back to me within =traveltime_ days and I'll consider the job done." (`N0C00Y13`)

Whole sentences, ordinary words, said the way a person would say them. Dry humor where a character speaks; none in
instructions.

## Rules

1. Write complete, plain sentences in the second person: "You cannot rest with enemies nearby."
2. Use the game's own words: health, fatigue, magicka, gold, skill, level, attribute, reputation, standing, rank,
   guild, temple, knightly order, letter of credit, dungeon, spellbook, the item maker, the potion maker, saving
   throw, and the spell effects by their names (Shield, Chameleon, Spell Resistance).
3. No modern game or computer words in the player's text: not HUD, cooldown, stack, buff, debuff, proc, reroll, boss,
   tier ladder, XP, loot table, respawn. Say what happens instead: "can be used again after 5 minutes", "remakes one
   power", "its master", "experience". Names of the interface the player can see (hotbar, Settings > Features, the
   Overworld button) stay as they are labelled.
4. No mannered or poetic compression. Objects do not act like people ("a tool just tells you"), nights do not "sleep as
   a bed", ground is not "witnessed by your word". Say it the plain way: "Tonight you will sleep as well as in a bed."
5. No dash asides ("- finish there first"). Make a second sentence.
6. Effect descriptions state the effect, the amount and how long: "Heals you for {pct}% of the damage dealt." Not
   "{pct}% of what it lands heals you."
7. A tutorial page never names the old game or its capital (`src/systems/tutorialCatalogue.js` header); the voice is
   the old game's, the name is DFO.
8. American spelling throughout DFO's own text: armor, color, honor, harbor, center, meter, defense, gray,
   specialization, traveled, jeweler, catalog. Text quoted from the classic game or from Daggerfall Unity keeps
   its own spelling (the quests, the books, the monster names such as Sabretooth Tiger, the mods' setting names),
   and so do code names, save keys and ICU placeholders (`{metres}` stays as the translations have it).

## What is left as it was

- The classic game's and Daggerfall Unity's own text: anything found in `vendor/` and anything whose comment cites
  DFU as its source.
- Spoken lines (townsfolk, crews, revenants mid-fight, wedding vows, the herald's jokes). People talk in dashes
  and half-sentences; that is how they speak, not an aside in an instruction.
- Book and riddle texts written as in-world documents (`portBooks.js`, `egAnnals.js`, the searchables' verses).
- Key prompts in the classic dialog boxes ("J - join us", "Y - buy it", "Esc - never mind"): that is the classic
  box's own layout.
- Stat lines, numbers and comparisons, as asked.
- Developer and diagnostic messages (`[livery] ...`, `[arena] ...`, chat command syntax, staff commands).
- Interface names the player sees in a menu (HUD layout, Settings > Features, the Overworld button).

## Done so far

- VOICE1 (2026-10-18), the first batch: the 71 tutorial pages (`src/systems/tutorialCatalogue.js`), the profession
  how-to pages (`src/ui/professions/profPages.js`), the specialization texts (`src/systems/arcanePaths.js`), the rest
  and survival items' messages and card lines (`src/systems/rest/restItems.js`).
- VOICE2 (2026-10-18): American spelling across DFO's own text (285 strings), then the rest of the player's text
  (862 strings in 201 files): messages and refusals, item and power lines, the revenant and companion pages, guild,
  notice board, seat and siege texts, naval, arena, card table and travel texts, and the crafting experience lines.
  Dash asides became second sentences; XP became experience in sentences, a crafting or seat tier a grade, an arena
  or card-table tier a rank, a "stack" a count of times. Progress bars and their numbers ("1,234 / 5,510 XP") are
  stat lines and stay as they were.
- At the merge onto main (2026-10-19, LAYERED-GEAR's pull request): main's lines written after VOICE2 was cut, where
  they sat beside its lines, were brought into the same voice - American spelling in the strings main added (center,
  harbor, Jeweler, specialization, the Specializations rail), and the crafter's-limit lines of FIELD BUGS 2026-10-18f
  (`src/ui/craftXpWords.js`: "No Smithing experience: ...", "(+0 Smithing experience. Smithing is at Master)"), which
  shared a box with VOICE2's "60 Smithing experience". One VOICE2 change was undone: Travel Options' help lines are
  the mod's own words (`travelOptionsText.js`, TO1) and keep "travelling".
- At PLAIN-SWEEP's merge (2026-10-20, `10-UI/Plain-Words.md` section 6.7): the two passes had rewritten many of the
  same lines. Each was written once to both rule sets - the sweep's shorter line, in this page's words and spelling, or
  this pass's line where it was as plain - and the sweep's own lines that merged without a conflict were brought into
  this voice (American spelling in the mod settings' descriptions and the credits, which the sweep rewrote in the
  game's own words; "stacks", "reroll" and "adds" said as what happens).

The English catalog (`locales/en/Port_Strings.csv`) follows the source. Every VOICE2 change keeps the meaning of the
line it replaced, so the languages keep their translations: each machine row's record was moved to the new English
(a person's row is never touched). A line whose meaning changes later is drafted again with
`tools/l10nInSession.mjs`.
