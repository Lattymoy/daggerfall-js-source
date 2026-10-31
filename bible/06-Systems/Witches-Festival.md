# The Witches' Festival

The first live event, the game's own: from 20 October to 7 November 2026 (UTC), foes and activities drop Soul Cakes;
a Wyrd Sister beside every tavern sells seasonal wares for them; home owners set out Hearth Offerings that other
players take a cake from; every town is dressed in its own people's way; and the Starfall and its questline run. The
player meets it in every town street and at every kill. Daggerfall keeps the day itself: the 13th of Frostfall, the
Witches' Festival (holiday 43), and Tales and Tallows on the 3rd of Hearthfire (holiday 38).

## How it works

**The days** (`src/net/festivalLaw.js` `FESTIVALS`, a row a year). Outside them nothing is found or sold; a bowl can
still be taken in, and every count is kept. On the nights the dead walk, every find gives twice: the sky's 13 Frostfall
and 3 Hearthfire (`FESTIVAL_NIGHTS`; a sky day is a real hour), and the whole UTC day of 31 October (`festivalEve`).
The economy is online and a registered account's; the towns' dressing and the Wyrd Sisters stand by the device's
calendar, online or not. The switch is `FESTIVAL_OPEN` in `server-account/wrangler.toml` (`off`, `dev`, `on`); it is
`on`.

**Soul Cakes.** The account service holds the count (`players.fest_cakes`); the pack's Soul Cakes (template 2000) are
its face, restacked on every answer, bound, pack-only and worth nothing to a shop. A find is asked by its source and
decided by the service's die (`server-account/src/festival.js` `findFestival`):

| Source | Chance | Cakes |
|---|---|---|
| a foe | 25% | 1 |
| undead or daedra | 50% | 1 |
| an elite foe or champion | 100% | 2 |
| gathering, making, loot | 20-30% | 1 |
| a tavern game won, a world event, a quest done, a bounty paid | 100% | 2 |
| the sea | 50% | 2 |
| the endgame (a breach closed, a Redoubt, the Serpent, a star held) | 100% | 4 |

A kill counts only for the player's own blow, once a body, never the watch or an ally. One deed asks one find. A day
takes at most 1,500 asks and 120 cakes an account (`FIND_ASKS_PER_DAY`, `FIND_CAKES_PER_DAY`); the page says when the
day's cakes are spent and when more can be found.

**The Wyrd Sister** (`src/ui/wyrdWindow.js`). A Glenmoril witch beside a tavern's door, young woman and crone in turn.
Her window sells for cakes:

| Part | Wares |
|---|---|
| Insignia | the Witchwarden title (60), the Witchfire aura (150), three profile icons (40 each); the Hearthkeeper and Starwarden titles and the Soul Cake icon are earned |
| The Wyrd's Raiment | eight armour pieces (40, the cuirass 50) and the Witchmoon Athame (60) |
| The Iliac Hand | five festival cards (20 each) and King Lysandus' Spectre (45) |
| Hearth Offering | the bowl (5) |

Insignia belong to the account, bought once. A sale is one guarded update under the client's request id, so asking
twice is one sale; a lost answer is kept on the save and asked again by the same id. Raiment pieces are bound.

**Profile icons** (`src/ui/profileIcons.js`) are worn in the portrait in place of the face: the menu corner, the account
card and another player's Inspect card. The icon is signed into the identity token (`pi`), so no client can claim one.

**The Wyrd's Raiment** (`src/systems/aetheric.js` `WYRD_SET_PIECES`), an Aetheric leather set of nine: 2 pieces,
Wyrd-Sight (Willpower and magic resistance); 4, Tallow-Ward (damage to undead, Daedra and atronachs); 6, Soul Harvest
(a kill heals health and magicka).

**Hearth Offerings.** The bowl is the account's (`players.fest_bowls`). Set out at the door of a home the account owns,
never a guild hall. The owner fills it with up to 10 cakes a press, 60 at most; anyone else takes one cake an offering
a day; the owner can take it in any time, even after the festival. Offerings stand at their doors as a carved pumpkin
on a stool under a lantern, lit at dusk (`src/scenes/witchesHost.js`). Every move is one database batch decided against
the rows as they stand.

**The towns dressed** (`src/world/witchesDecor.js` `WITCH_KITS`). Five kits by climate and people: Breton (turnip
lanterns, straw effigies), Redguard (standing candles, bowls of fire), Highland (pole torches, bonfires, horned skulls),
Fen (ward-staves) and Haunted (skull candles, bones). Daggerfall's own light and bone flats stand beside three painted
for the festival (`src/world/festivalArt.js`). Each piece stands on the town's dry ground with a clear line to its door,
the same on every machine.

**The Starfall and The Thirteenth of Frostfall.** Stars fall only on the festival's days (`11-Multiplayer/Starfall.md`);
a star held is an endgame find. A Wyrd Sister hands over Morwen's letter, which starts the questline; its end pays the
Starwarden title and 30 Soul Cakes once an account (`QL_STARWARDEN_CAKES`).

## Rules

- **A Daggerfall-lore live event for Halloween**: a home's treat bowl, a treat that drops, a vendor at every tavern with
  an armour set, a weapon, a title, an aura, a profile icon and cards, every town dressed its own way, until a week after
  Halloween.
- **The service holds every count**; a forged client finds no more than an honest one.
- A Wyrd Sister's window opened is never a find.

## Daggerfall Unity

DFU has holidays (`TEXT.RSC` 8387, 8392) and no live events. Everything here is the game's own; the witch's picture is
DFU's own "mysterious woman" flat (FLATS.CFG 179.2), and the decor uses DFU's light and bone flats.

## Code and tests

- `src/net/festivalLaw.js` - the days, nights, caps and words both ends read
- `server-account/src/festival.js` - finds, sales, offerings
- `src/systems/festival/` - the client: finds, sales, the two items, foes
- `src/scenes/witchesHost.js`, `src/world/witchesDecor.js`, `src/world/festivalArt.js` - streets and dressing
- `src/ui/wyrdWindow.js`, `src/ui/profileIcons.js` - the window and icons
- `test/server/witch1_festival.test.js`, `test/systems/festival/witch1_client.test.js`,
  `test/world/witch1_decor.test.js`, `test/scenes/witch1_host.test.js`
