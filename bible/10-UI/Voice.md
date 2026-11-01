# The game's voice

How DFO's own player text is written: tutorials, item cards, skill and specialization texts, profession pages,
refusals and messages on the screen. It should sound like the classic game's quest texts (`vendor/dfu-quests/Quests/`)
and system messages. Numbers, stat lines and comparisons are left as they are.

## How it works

The classic text is whole sentences in ordinary words, said the way a person would say them: "You have not rented a
room here.", "It is illegal to camp in or near a city. Continue?". Dry humor belongs to a character who speaks, never
to an instruction.

The English catalog (`locales/en/Port_Strings.csv`) follows the source. A rewrite that keeps a line's meaning moves
each machine-translated row to the new English, so the other languages keep their translations; a row a person
translated is never touched. A line whose meaning changes is drafted again with `tools/l10nInSession.mjs`.

## Rules

- Consistent Daggerfall wording in every description and how-to text; stat pages and number comparisons stay as they
  are (Dudey).
- Complete, plain sentences in the second person: "You cannot rest with enemies nearby."
- The game's own words: health, fatigue, magicka, gold, skill, level, attribute, reputation, standing, rank, guild,
  temple, knightly order, letter of credit, spellbook, the item maker, the potion maker, saving throw, and spell
  effects by their names.
- No modern game words in player text: not HUD, cooldown, stack, buff, debuff, proc, reroll, boss, XP, loot table,
  respawn. Say what happens: "can be used again after 5 minutes", "experience". Interface names the player can see
  (hotbar, Settings > Features, the Overworld button) keep their labels.
- No poetic compression and no objects acting like people. No dash asides: make a second sentence.
- An effect line states the effect, the amount and how long: "Heals you for {pct}% of the damage dealt."
- A tutorial page never names the old game or its capital (`src/systems/tutorialCatalogue.js` header). Tutorial
  pages are short and plain, at most three points (Mac).
- American spelling in DFO's own text: armor, color, honor, harbor, center, gray, specialization, traveled. Quoted
  classic or Daggerfall Unity text keeps its spelling, and so do code names, save keys and ICU placeholders.
- Say it once (PLAIN-TEXT, the owner): at most 40 words a string and 25 a sentence, no padding words
  (`tools/plainText.mjs` `PADDING`). Longer help goes on a page or in a fold the player opens.

## Left as it is

- Text from `vendor/` and any line whose comment cites Daggerfall Unity as its source.
- Spoken lines (townsfolk, crews, revenants, the herald). People talk in dashes and half-sentences.
- In-world documents: `src/systems/portBooks.js`, `src/net/eliteGates/egAnnals.js`, searchable verses.
- Key prompts in the classic dialog boxes ("Y - buy it", "Esc - never mind").
- Travel Options' help lines, which are the mod's own words (`src/systems/travel/travelOptionsText.js`).
- Developer and diagnostic messages and chat command syntax.

## Code and tests

- `src/systems/tutorialCatalogue.js` - the tutorial pages and the rules a page keeps
- `src/ui/craftXpWords.js` - the crafting experience lines
- `tools/plainText.mjs` - the PLAIN-TEXT limits and padding list
- `test/tooling/plaintext.test.js` - holds strings, comments and the bible to those limits
