# Collections

The Collections page on the Holdings rail lists every title, aura, Aura Armory piece, profile icon, glyph, appearance,
codex find, card, trophy, fish, tune and Annals page in the game, which ones the player holds, and how each is had,
even if it cannot be had now. It shows for every player.

## How it works

**Parts** (`src/ui/collectionsPage.js` `COLLECTION_PARTS`), a switch of tiles at the top, in order: Titles, Auras, Aura
Armory, Icons, Glyphs (the account's wardrobe); Appearances, Codex, Cards, Trophies, Fish, Tunes (the character's); and
Annals (the account's). The Codex shows while Loot rarity is on, Cards while a Card Binder is carried
(`collectionParts`). Each tile shows its name, its count ("3 / 52") and a meter; a count the page cannot know is a
dash. The page opens on Titles; a landing may name any part by id.

**A wardrobe part** (`src/ui/collections/wardrobePart.js` `drawWardrobePart`) reads top to bottom:
- the account's line: held on every character, reading, sign in, a refusal with **Try again**, or the guest line;
- the festival's line while the Witches' Festival is open and the kind has its pieces;
- the filters All, Held, Not held and Obtainable (`AVAIL_NOW`); Held and Not held only once the account is read;
- rows grouped by source, each group with its count. A row is the thing's picture, its name, whose it is (Worn, Held;
  Shown or Hidden for a glyph) and its availability tag. A thing not held is dimmed.
- a row opened shows *How to get it*, *Availability*, *Comes with* (a press that opens the paired piece in its part)
  and, held and signed in, **Wear / Take off** (Show / Hide for a glyph).

**The account.** What is held is the service's word, read once a menu visit through the same account flow the
account card uses (`src/ui/enhanced/enhancedMenu.js` `newAccountFlow`, `src/ui/accountFlow.js`). The read starts after
the draw that asked. Leaving the page and returning asks nothing; a new visit or the account card closing reads again.
Wear uses the flow's own presses (`equip`, `wearAura`, `wearIcon`, `toggleGlyph`, `wearArmory`), so the name over the
head and the aura learn it as they do from the card. A waiting press is `aria-disabled`, never `disabled`, so focus
stays.

**The catalogue** (`src/ui/collections/wardrobeCatalogue.js`). Every key of the vocabularies has one entry: its
source, availability, how it is had, an aura's look, what comes with it, and its scope where it is a character's.
Sources are listed from what play earns first to what no play earns (`WARDROBE_SOURCES`). Availabilities
(`WARDROBE_AVAIL`, tags in `AVAIL_TAG`): open, chance, ranked, seasonal or offseason, patron, dormant, auto, staff,
bestowed, closed, retired, shop, store, pass and daily.

- The seats' glyphs are a character's (`scope: 'character'`): signed onto each member's token at sign-in, never into
  the account's wardrobe. They read "Per character", are never dimmed and are left out of every count.
- High Master is the one `via` entry: it follows Chapter Master's holding and is never worn from here.

**Other parts.** Appearances (`src/ui/collections/appearancesPart.js`) lists every look a piece can be drawn as, opens
on Held, and groups by kind head to foot (see `04-Characters/Wardrobe.md`). Trophies, Fish and Tunes
(`src/ui/collections/gatheredPart.js`) read the character's gathered log (`src/systems/hunt/gatheredLog.js`) and the
music box (`src/systems/musicBox.js`). Annals lists the thirty pages, kept ones from the account read.

**Dress.** Every surface is a role of `src/ui/enhanced/enhancedFrame.js` `FRAME_ROLES`; the part's own sheet
(`WARDROBE_PART_CSS`) writes geometry and word colors only. The Stone theme has its own sheet (`WARDROBE_THEME_CSS`) so
painted names sit on a dark plate.

## Rules

- Collections lists every title, aura, icon and the like, says how each is found even when it cannot be had now, and
  is a proper overhaul of the page (the owner).
- The service decides what is held (`server-account/src/titles.js`); the catalogue says it. A number the client also
  holds (Broker prices, festival wares, the Arena's floor) is read, not copied. A number only the service holds is
  written in the catalogue and `test/ui/collections2.test.js` holds it to the service's table.
- The catalogue's entries match the vocabularies both ways; a new title fails the suite until it says how it is had.
- `test/ui/collections2.test.js` reads `PATREON_TIERS`, `CHAPTER_TITLES`, `FESTIVAL_OPEN`, `QUESTLINES_OPEN` and
  `SEATS_OPEN` from `server-account/wrangler.toml`; turning one fails the suite until the catalogue says what changed.
- The words name no player: a title made for one person says it was granted by name, never to whom.
- A horse's coats are not a part: the stable keeps the horses a character has now, not the coats it has owned.

## Code and tests

- `src/ui/collectionsPage.js` - parts, tiles, routing
- `src/ui/collections/wardrobeCatalogue.js` - sources, availabilities, entries
- `src/ui/collections/wardrobePart.js` - the wardrobe parts and Wear
- `src/ui/collections/appearancesPart.js`, `src/ui/collections/gatheredPart.js` - the character's parts
- `test/ui/collections2.test.js` - catalogue against vocabularies, service tables and config; the page
- `test/ui/appearances_part.test.js`, `test/systems/appearances_audit.test.js` - Appearances
- `test/systems/huntersmark_trophies.test.js` - the gathered log and its parts
- `tools/collectionsProbe.mjs` - the page in Chromium at desktop and phone, signed in and out

## Open

- An aura's picture is a ring in its colors, not the aura itself; a preview in the round is not built.
- Title and aura names are English everywhere while glyph and icon names are translated. Which way to go is a
  whole-game decision.
- Arrow keys do not move among tiles, filters or rows, and the pad's step skips rows scrolled out of view.
- The Holdings rail's labels are still English.
- A guild holding a palace and a crown wears the crown's title over Warden's; the page does not say so.
