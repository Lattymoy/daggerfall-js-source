# Collections - every title, aura, icon and glyph, and how each is had (COLLECTIONS-II)

> Design page and record (2026-10-22). Where the page and the code disagree, the code's own headers
> (`src/ui/collectionsPage.js`, `src/ui/collections/wardrobeCatalogue.js`, `src/ui/collections/wardrobePart.js`) and the
> pins (`test/ui/collections2.test.js`) are what runs. Not a DFU member: Daggerfall Unity has no accounts, so nothing
> here departs from it (Port-Ledger section A, COLLECTIONS-II). Audited the same day - `01-Overview/audits/Audit-Collections-II.md`;
> this page is the record as fixed.

## 1. What was asked

The owner, 2026-10-22:

> *"So with the introduction of a lot of titles, auras, profile icons, etc I think its time we introduce these elements
> to the collections tab, along with telling how they are found, even if they arent currently able to be obtained. This
> needs to be a proper overhaul to the collections ui"*

The Collections page (`11-Multiplayer/Tavern-Cards.md` section 26, COLLECTIONS) was the Holdings rail's last entry: a
Codex | Cards switch, shown only while Loot rarity made Legendaries or the character carried a Card Binder. The account's
titles, auras, profile icons and glyphs were seen only on the account card's Wardrobe, and only the ones held - a player
had no way to see what else exists or how it is had.

## 2. The page now

The Collections page shows for every player (`collectionsPageShown`), in six parts, a switch of tiles at the top:

| Part | What it lists | Whose |
| --- | --- | --- |
| Titles | every title of the vocabulary (`TITLES`) | the account's |
| Auras | every aura (`AURAS`) | the account's |
| Icons | every profile icon (`ICONS`) | the account's |
| Glyphs | every glyph (`GLYPHS`) | the account's - the seats' four the character's (section 3) |
| Codex | LOOT10's codex, as before - shown while Loot rarity is on | the character's |
| Cards | the Card Binder's collection and decks, as before - shown while a binder is carried | the character's |

Each tile is its part's name over its count (`3 / 52`) and the kit's meter of it, so the page opens on how much of
everything is collected. A count the page cannot know - the account not read, nobody signed in - is a dash, and its meter
empty. The page opens on Titles; a landing names any part by its id (`collections`, `titles`, `auras`, `icons`, `glyphs`,
`codex`, `cards` - `enhancedMenu.js` mountEnhancedMenu, `COLLECTION_PARTS`), and a part not shown falls back to Titles.

A wardrobe part (`drawWardrobePart`) reads, top to bottom:

- **The account's line** - "Held by your account, on every character." while the read is back; "Reading your account…"
  while it is not; for nobody signed in "Sign in from your profile…", after the flow's own sentence where a refusal
  signed the player out ("Your session has ended…"); where the read failed, the flow's refusal and a **Try again** press
  (`coll-retry`, the flow's `start`); for a guest "A guest account keeps none of these but the sprout: add a username
  from your profile to earn them." (every grant asks a registered account). While a Wear is out it adds "Asking your
  account…", and after it the flow's last word ("Wearing Gatebreaker.", a refusal) - on the part of the kind it was
  about alone, never carried to another part.
- **The festival's line** while the Witches' Festival is open and the kind has any of its pieces: "The Witches' Festival
  is on until {date}: its pieces can be had now." (the date the festival's own, `net/festivalLaw.js` FESTIVALS, in the
  player's language's own form - English writes "November 7").
- **The filters** - All, Held, Not held, Obtainable (what a player can act on now: `AVAIL_NOW`). Held and Not held only
  where the account is read (unread, Held found nothing and Not held listed everything); a filter chosen falls back to
  All when the read goes.
- **The rows, grouped by where they come from**, each group under its divider with its own count, of the whole group
  whatever the filter ("The Elite Breach - 1/13"; a dash for the held while unread; the source's name alone for a group
  the account keeps none of - the seats' glyphs). A row is the thing's picture (an aura's ring in its colours, an icon's
  drawing, a glyph's mark; a title's picture is its word, painted as it is over a head - `ui/playerBadge.js` titlePaint,
  an aura's in its title's paint as the account card paints it, on a plate as wide as its letters so a gradient shows
  whole), its name, whose it is where the account holds it (Worn, Held; Shown, Hidden for a glyph; Per character for a
  seat's glyph) and whether it can be had (the availability's tag). A thing not held is its row's dimmed word (0.8 - at
  0.55 most names read under 3:1); an opened row's word is never dimmed.
- **A row opened whole** - its name on top in its paint (every kind's - after a jump its row may be out of view), an
  aura's look in a sentence, *How to get it*, *Availability* in a sentence, whose it is (said only where the account is
  read), and in a foot across the box, centred: *Comes with* (each thing granted beside it, a press that opens it in its
  own part with the filter back to All, the row scrolled to and the keyboard on it - Kynbane's Beaconlight, the Aegis of
  Oblivion's ward and glyph) and - held, signed in - **Wear / Take off** (Show / Hide for a glyph). A row opened near the
  pane's foot brings its box into view (the journal's questReveal's law).

## 3. The catalogue (`src/ui/collections/wardrobeCatalogue.js`)

Every key of the four vocabularies has one entry: its **source**, its **availability**, its words of **how**, an aura's
**look**, and what comes **with** it, and where it is a character's and not the account's, its **scope**. A pin holds the
entries to the vocabularies both ways, so a title added to `identityToken.js` TITLES fails the suite until it says how it
is had, and holds every entry's source and availability to a literal map of this table (`CATALOGUE` in the test).

**Sources**, in the page's order - what play earns first, what no play can earn last: the Elite Breach, the Abyss
Dungeons, the Sea Serpent, the Sigil Broker, Questlines, the Witches' Festival, the Seats, the Guild Chapters, the Arena
and the Card Tables, Around the Bay (I Love Lamp), Your Account (Founder, the sprout), Patrons, the Game's Staff,
Bestowed by Name.

**Availabilities** - the owner's "even if they arent currently able to be obtained", said on every row:

| Availability | Tag | Who |
| --- | --- | --- |
| open | Obtainable | the Spire's honours, the seats' (Crowned and Keeper from Season 1 on - Season 0, the beta, crowns no one: `townSeatLaw.js` seasonTitles), the Broker's, the questlines', I Love Lamp, the Grand Champion |
| chance | By chance | the Brass Remnant's (one in 4, one in 8) and the Sea Serpent's (one in 20, one in 50, on a claim whose own fire dealt a real share of its ship's) |
| ranked | Ranked | held while on top of a board: Arena Champion and its laurel, Iliac Champion, Grandmaster (each with the board's floor - 10 rated bouts or ranked games against 5 different opponents); Spire Champion its own line - held through the whole season after the one it was earned in |
| seasonal / offseason | Seasonal / Out of season | the Witches' Festival's: Witchwarden, Hearthkeeper, Witchfire, the four icons, and Starwarden (the Thirteenth of Frostfall runs with the Starfall) - read against the festival's dates when drawn |
| patron | Patron reward | the Patreon tiers a pledge maps (`PATREON_TIERS`): Disciple, Herald, Hierophant ("- or be granted it by name": the name lists) |
| dormant | Not yet available | given out by nothing yet: Apostle (no tier maps it - "Apostle still has no tier", Accounts-And-Cloud-Saves-Arc), the five chapter titles (the service's `CHAPTER_TITLES` is off) |
| auto | Automatic | the sprout - given to every new account for two weeks, never earned |
| staff | Staff only | Developer, Dungeon Master, the Seraph Wings, the developer's, moderator's and Dungeon Master's glyphs |
| bestowed | Bestowed | the titles made for one player and their auras and glyphs (Shadow Fang, Penitent, Aegis of Oblivion, Primarch, Crystal Fist, WikiMaid, Nirnroot Sage - NIRNROOT-SAGE, 2026-10-26) |
| closed | Closed | Founder - every registered account that first played by noon UTC on 25 September 2026 (`FOUNDER_UNTIL`), or granted it by name; a guest from before then earns it by registering, and a character from before then brought onto the account counts too (`founderLink.js`) |
| retired | No longer obtainable | Hour's First and The First Hour, First of the Spire and Firstlight |

**The seats' glyphs are a character's** (`scope: 'character'`): the tower and the three crowns are signed onto each
member's token at sign-in (`server-account/src/seatTurning.js`, from `townSeatLaw.js` seatGlyphsOf), never into the account's wardrobe - so their rows
say "Per character", are never dimmed as not held, are left out of every count and out of Not held, and opened say "It
shows beside the name of each member of such a guild, on that character - your account does not keep it." Warden and
Protector say the guildmaster's character wears them.

The words name **no player**: a title made for one person says "Made for one player and granted to them by name", never
whose - the page is read by everyone, and a handle in it would go stale the day a grant moved.

**THE SERVICE DECIDES; THE CATALOGUE SAYS IT.** What is held is `server-account/src/titles.js` (titlesHeld, aurasHeld,
iconsHeld, glyphsOf). Where a number is the client's too it is read, not copied: the Broker's prices (`insignia.js`
INSIGNIA), the Wyrd Sister's (`festivalLaw.js` FESTIVAL_WARES), the Hearth's counts (HEARTHKEEPER_GIVEN, SOULCAKE_TAKEN),
the Arena's floor (`arenaLaw.js` ARENA_CHAMPION_MIN_BOUTS, ARENA_CHAMPION_MIN_FOES), a questline's name, giver and level
or the line it follows (`systems/questlines/qlLines.js`, the line found by `net/questlineClaims.js` QL_SERVICE_LINES).
Where it is the service's alone - a roll's odds, the Redoubt an honour asks, the Spire's champions, the card tables'
floors - it is written in the catalogue and `test/ui/collections2.test.js` holds each entry's own text to the service's
own table (`sds.js` SD_TITLE_CHANCE, `serpents.js` SERPENT_AURA_CHANCE, `egHonours.js` EG_REDOUBT_HONOURS,
EG_CHAMPIONS_TOP, `iliac.js` and `gambit.js` the champions' floors, `FOUNDER_UNTIL`, `seasonTitles` on Season 0,
egHonourBitsOf on a member's own fall, `festival.js` counting the cakes others take, `serpents.js` rolling on a dealing
claim alone), and what comes with what to TIER_GLYPH, TIER_AURA, DEVELOPER_AURA, HOURS_FIRST_AURA, EG_FIRST_AURA and
EG_HONOUR_AURA, both ways and every pair. Five switches of the service's config are read from
`server-account/wrangler.toml` by the pin: PATREON_TIERS (a tier mapped is a pledge's, a Patreon title unmapped is
dormant), CHAPTER_TITLES (the chapters' five dormant while it is not "on"), and FESTIVAL_OPEN, QUESTLINES_OPEN and
SEATS_OPEN (each "on", as the rows that say those pieces can be had assume). Turning any fails the suite until the
catalogue says what changed.

**High Master** is the one `via`: the service never holds it - it signs it in a Chapter Master's place while the chapter
stands Ascendant (`server-account/src/index.js`, the mint) - so its row follows Chapter Master's holding ("With Chapter
Master"), is never worn from here, and is not counted.

## 4. The account, read and worn

What is held is the service's word, asked once a menu visit: the page is handed a constructor (`kit.account`) - the same
one the account card is built by, `enhancedMenu.js` newAccountFlow (Home.md, THE ONE CONSTRUCTION SEAM) - and reads the
wardrobe of `/v1/account` through it (`ui/accountFlow.js` start). The flow is built once a visit, its read begun
**after** the draw that asked (a read's first word repaints, and a repaint inside a draw rebuilds the page under it), its
every change a repaint while it is still the visit's. Leaving the page and coming back asks nothing
(`disarmCollectionsPage` lets the cards' part go, never the read - a press's answer landing after a new read was lost); a
new visit (`resetCollectionsPage`) lets it go - its later answers repaint nothing - and the account card closing asks
again (`rereadCollectionsAccount`: a wear, a sign-out or another account there), at once while the page's flow is idle,
else once its press in flight is answered (Home.md, ASYNC NEVER DROPS).

Wear is the flow's own press - `equip`, `wearAura`, `wearIcon`, `toggleGlyph` - so the service answers, the answer
replaces the wardrobe, and the name over the head, the fire at the feet and the portrait well learn it as they do from
the card (`adoptIdentity`). The press is never `disabled` while it waits (a disabled button cannot take the focus back,
and the keyboard and the pad fell to the page's body): it says so (`aria-disabled`, dimmed), and a press while one is
out does nothing. The account card is unchanged. Two slips fixed on the way: the flow's note after wearing a title said
the title's key ("Wearing gatebreaker.") - it says its name now, as the aura's and the icon's always did; and the
service's glyph and icon doors answered a thinner wardrobe than the title's - the arena's, Iliac Hand's, The King's
Gambit's and the Spire's honours missing (`arena.js` ARENA_HONOUR_PATHS), and the glyph's without a Charter's and a
chapter's titles - so a Show or a profile icon worn here dropped a champion's title and laurel from the answer the flow
takes whole (AUDIT COLLECTIONS-II, acct171 - acct169 on its branch, renumbered past CRAFT-PAYS and PISTOLET at the merge).

A host with no flow to give (a lab, a pin) lists the catalogue and holds nothing.

## 5. Dressed by the kit

Every new surface is a role of `ui/enhanced/enhancedFrame.js` FRAME_ROLES: the part tiles (as before), the filters, a
"comes with" press and Try again are tiles, a row a list line, a row opened (and an opened Codex row) a panel, a tag a
chip, Wear the kit's button. The page's sheet (`WARDROBE_PART_CSS`) writes geometry and the words' colours alone - a pin
holds it to no ground and no edge colour of its own, CARDS-PLUS's law for the page. The tiles fit six on a line at 1280
(`minmax(84px, 1fr)`), their meters 8px tall (at 5px empty and partial read alike).

**The Stone theme** has its own sheet (`WARDROBE_THEME_CSS`, every rule under `:root[data-plus-theme="stone"]`): its
grey ground took the painted names (Kynbane's red at 1.2:1) and the page's dim words, so each name sits on a dark plate
as wide as its letters - the one ground the page writes, never on a role the kit paints - and the words are the theme's
bone, as the Holdings pages say theirs (`ui/holdingsPages.js`, `ui/companionRoster.js`). **The Grimoire dress** inks
every colour of a painted word as it inks its sheets (`ui/grimoireDress.js` inkColour) - its ink sheet never reaches a
paint written on the word itself.

## 6. Seen

`tools/collectionsProbe.mjs` (Chromium, the dev server, the enhanced pause opened onto Collections over the front door,
`/v1/account` answered by the probe, `COLL_LANG` for another language) asserts, at 1280 and on a 390 phone, signed in and
signed out: the tiles and the titles' count (a dash unread); the Held filter listing what is held, and absent unread; a
row opened whole and its press; the pad's step down from the opened row reaching that press (`plusPad.js`
spatialStep); Take off pressed from the keyboard, answered, the row's tag gone and the keyboard still on the press; a
"comes with" landing its row in the Auras part, in view and focused; nothing wider than the pane; no page error. The
frames go to a scratch directory, never the tree. Run after the audit's fixes: 34 of 34 in English and in German.

## 7. Not done

- The pictures are signs: an aura's ring is drawn in its colours (AURA_PAINT, the account card's), never the aura itself
  (`render/auraRing.js` draws that, in the world) - so Beaconlight's ring is Kynbane's red while its look says gold-white
  motes. A preview in the round is its own slice.
- Title and aura names are English everywhere (`playerBadge.js` TITLE_TEXT, AURA_TEXT - the name over a head is the same
  in every language), while a glyph's label and an icon's name are translated; the page draws each as the game does
  elsewhere, so a German "Glyphe: Schattenfang" sits beside the title "Shadow Fang". Making names one or the other is a
  decision for the whole game, not this page.
- The menu's arrow keys move nothing among tiles, filters or rows, and the pad's step skips what is scrolled out of
  view (the right stick scrolls) - the whole menu's behaviour, not this page's.
- The Holdings rail's own labels (COLLECTION_PAGE_SECTIONS: "Revenants", "Collections") are still English - older than
  this page.
- High Master follows Chapter Master's holding whatever the chapter's band; it is dormant while CHAPTER_TITLES is off,
  and is to be said exactly when that switch turns. A guild holding a palace and a crown wears the crown's title over
  Warden's (`townSeatLaw.js` seatTitleOf); the page does not say so.
- Other things a player gathers - the Annals of 3E 398's pages, the fish caught, a horse's coats - could each be a
  part of their own; none was asked for here.

## 8. The audit's changes to older records

- **AUDIT HOLDINGS C6 retired.** An empty Holdings rail said "Nothing here to hold" - with the Collections page every
  player's the rail is never empty, so the branch is gone (`enhancedMenu.js`) and its record AH-C6 with it; the
  standalone dungeon's Holdings opens on Collections (`01-Overview/audits/Audit-Holdings.md` C6).
- **AC5-D-C07 retired.** AUDIT CARDS-5's law that the switch is drawn only over more than one part: four parts always
  show, the switch is unconditional, and `C2-the-switch-never-drawn` pins it (`01-Overview/audits/Audit-Cards-5.md`).
- **The Codex's words** go through the text core now (`coll.codex.*` - its dividers, a set's count, "Unfound", the day
  found): the page is every player's, and its Codex part was English under a translated tile.
- **The Unfallen** is the member who never fell, as built - the Elite-Gates record says a company with no fall
  (`11-Multiplayer/Elite-Gates.md` section 19 carries the note); the page says what is built, and which is meant is the
  owner's.

The mutants: `tools/mutants/collections2.json` (78 records, all dead), the re-aimed records of `auditcards5.json`,
`cardsplus.json`, and the account version's own (`bal9`, `br5`, `crafthold`, `fb1004d_knight_house`, `gatekeys`,
`hackedgold`, `nameas`, `tech1`, `wb14g`), all dead.
