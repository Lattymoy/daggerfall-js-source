# The Witches' Festival (WITCH1)

THE PORT'S OWN (2026-10-20), the first live event. Asked: *"With Halloween on the horizon. I think its fair to develop our
first live event. Daggerfall lore style"* - a thing a home's owner sets outside to give treats from, a new treat that foes
and activities drop, a vendor outside every tavern with seasonal wares (an armor set, a weapon, a title, an aura, a
profile icon, cards), every town decorated in its own way, running until a week after Halloween.

Daggerfall keeps the day itself: the 13th of Frostfall, "known throughout Tamriel as the Witches' Festival when the forces
of sorcery and religion clash" (TEXT.RSC 8392, holiday 43), and Tales and Tallows on the 3rd of Hearthfire, when "the
dead do walk tonight" (8387, holiday 38). DFU has holidays and no live events: everything here is Ledger A (THE WITCHES'
FESTIVAL).

## The days

- **20 October to 7 November 2026**, on the real calendar (UTC) - `src/net/festivalLaw.js` `FESTIVALS`, a row a year.
  Outside them nothing is found or sold; a bowl's cakes can still be taken in, and every count is kept.
- **The nights the dead walk** - the sky's 13 Frostfall and 3 Hearthfire (`FESTIVAL_NIGHTS`; a sky's day is a real hour,
  so in 2026 20 Oct 11:00, 2 Nov 19:00 and 4 Nov 11:00 UTC), and the festival's own night, **31 October**, its whole UTC
  day (`FESTIVALS` `eveFromMs`/`eveToMs`, `festivalEve`): every find gives twice (`deadWalk` - twice, never four times).
  The chat says so once a night, while finds are asked.
- The economy is online and a registered account's (a guest's cakes would be a cleared browser's to lose). The towns'
  dressing and the Wyrd Sisters stand by the device's calendar, online or not.
- `FESTIVAL_OPEN` in `server-account/wrangler.toml` (`off`, `dev`, `on`) shuts the finds, the sales, the set-outs, the
  fills and the takes; a bowl can always be taken in, and a town then shows each caller its own offerings alone. The
  client reads the switch off the service's answers (`open`) and says why it does not play: `offline`, `guest` (a guest is
  told to link an account) or `closed` (`festivalShut`). What the service last said is its account's alone: another
  account signed in reads every count unknown until its own answer (`festivalState`), and a count no answer has said is
  unknown, never a known nought.

## Soul Cakes

The festival's treat and its coin. THE ACCOUNT SERVICE HOLDS THE COUNT (`players.fest_cakes`), as it holds a Weir Key's
(`systems/eliteGates/weirKey.js`'s model): the pack's Soul Cakes are its face, restacked on every answer, a refusal's too
(`systems/festival/soulCake.js` `restackSoulCakes`). Bound, stacked, worth nothing to a shop, PACK-ONLY - never the
wagon's or a chest's, and one a save holds anywhere else is folded away at load (`foldStrayFaces`, KEY-FACE's law)
(template 2000; ITEM_LAW_VERSION 8).

A FIND is asked by its source and decided by the service's own die (`server-account/src/festival.js` `findFestival`):

| Source | Chance | Cakes |
|---|---|---|
| a foe (`foe`) | 25% | 1 |
| the dead, the summoned (`undead`, `daedra`) | 50% | 1 |
| an elite foe or a champion (`elite`) | 100% | 2 |
| gathering, making, the loot's laws (`gather`, `make`, `loot`) | 20-30% | 1 |
| a tavern game won (`tavern`), a world event, a quest done, a bounty paid (`world`) | 100% | 2 |
| the sea (`sea`) | 50% | 2 |
| the endgame (`endgame`: a breach closed, a Redoubt, the Serpent...) | 100% | 4 |

Every find lands in the pack (a face on a body is one the count cannot see). A day takes at most `FIND_ASKS_PER_DAY`
(1,500) asks and `FIND_CAKES_PER_DAY` (120) cakes - a forged client finds no more than an honest one who played all day.
A kill is my own blow's (`systems/playerKills.js` - every pool tells it: the street's, a dungeon's room bodies, a foe
another machine runs), once a body, never the watch or an ally. Acts are `systems/questlines/qlActs.js`'s, heard through
`hearActs`: ONE DEED, ONE FIND - the acts one receipt says together (a breach closed with its rite broken, a Valkynaz's
Redoubt, the Heart-Star held with its star) ask once, and an elite foe's act never beside its kill's. A find whose ask never reached the service was a die
never rolled: nothing is kept to ask again.

## The Wyrd Sister

A witch of the Glenmoril Wyrd stands beside a tavern's door wherever one side of it is clear (FLATS.CFG's "mysterious
woman", 179.2 - the covens' own, dressed, her glamour and all: the young woman and the crone in turn, as Daggerfall's
covens show her; her own picture under the Morrowind people too), named by her office. A press opens her window
(`ui/wyrdWindow.js`, the Broker's house): the cakes held, the festival's last day, why it cannot trade here (offline, a
guest, shut - said at its head before a press asks it), and four parts, an earned row's count `?` until heard; a row
pressed shows its card beside the list (on a phone, brought into view), and the window looks again every
`WYRD_WATCH_MS` at what no answer says (the relay back, a night come).

| Part | Ware | Cakes |
|---|---|---|
| Insignia | the **Witchwarden** title | 60 |
| | the **Witchfire** aura (green fire, seven tallow candles) | 150 |
| | profile icons: **Tallow Skull**, **Twin Moons**, **Wyrd Cauldron** | 40 each |
| | the **Hearthkeeper** title - earned, 25 cakes given from your offerings | - |
| | the **Starwarden** title - earned on The Thirteenth of Frostfall, the Festival's questline; shown, never sold (AUDIT STAR8 T3) | - |
| | the **Soul Cake** icon - earned, 10 cakes taken from others' offerings | - |
| The Wyrd's Raiment | eight armour pieces | 40 (the cuirass 50) |
| | **The Witchmoon Athame**, its weapon | 60 |
| The Iliac Hand | Warlock, Thaumaturge, Glenmoril Witch, Demonologist, Tales and Tallows | 20 each |
| | **King Lysandus' Spectre** (Legendary) | 45 |
| Hearth Offering | the bowl to set out at a home's door | 5 |

Insignia are the account's, bought once and kept, worn from the window or the account card. A sale is one guarded
UPDATE under the client's request id (`fest_sales`): asked twice it is one sale. A lost answer - no line, the service's
fault, a sign-out - is kept on the save under the account that made it (`WitchesFestival`) and asked again at the next
refresh by the same id; one ask of a sale is in flight at a time, and only the answer to the sale still pending mints
(`SALE_FINAL` - `ware`, `rid`, `owned`, `cakes`, `closed`, `rate` - alone let it go). A Raiment piece is BOUND to its
buyer, as the Sigil Broker's are.

### A profile icon

A new kind of wardrobe piece: a picture worn in the portrait in place of the character's face - the menu's corner mark,
the account card and another player's Inspect card (`ui/profileIcons.js`, drawn in code). Signed into the token as `pi`
(`net/identityToken.js` `ICONS`; `mintToken` signs it only while one is worn), so no client can claim one it does not
hold; the relay carries it to the room, and the stored session keeps it for this device's own mark.

### The Wyrd's Raiment

An Aetheric set of nine (`systems/aetheric.js` `WYRD_SET_PIECES`, Legendary at least) - hood, mantles, cuirass,
gloves, greaves, boots, the Hearth-Ward shield and the Athame. LEATHER, a witch's and a caster's (the Athame Elven): the
Mage, the Sorcerer, the Nightblade and their kind wear eight of the nine (never the shield), and every class but the
Burglar, the Monk and the Knight reaches Soul Harvest. Bound. Never a drop.

- **2 - Wyrd-Sight:** +2-6 Willpower, +5-15% magic resistance.
- **4 - Tallow-Ward:** +10-30% weapon damage to the undead, the Daedra and the atronachs.
- **6 - Soul Harvest:** a kill heals 8-20% of health and magicka; it recovers in 40 to 20 seconds, by the set's power.

### The cards

Six festival cards (`net/iliac/iliacCards.js`), never in a pack or a drop: the Warlock (reveal: +1 magicka next turn),
the Thaumaturge (ongoing: your mages here +1 power), the Glenmoril Witch (rare; reveal: the weakest enemy here becomes a
Rat), the Demonologist (rare; reveal: two Imps), Tales and Tallows (a spell: a Ghost here) and King Lysandus' Spectre
(legendary; reveal: enemy units lose 1 power). Two new emblems, the witch and the candle.

## Hearth Offerings

The owner's treat bowl. THE BOWL IS THE ACCOUNT'S, as its cakes (`players.fest_bowls`): bought, it is counted; the pack's
Hearth Offerings are its face (`restackHearthOfferings`). **Set out:** use a Hearth Offering standing at the door of a home
the playing character owns (never a guild's hall), at the spot the build kept by it (`There is no room for it by this
door.` where it kept none) - one of the account's bowls spent. **Fill:** up to 10 cakes from your count a press, at most
60 in the bowl. **Take:** anyone else takes one cake an offering a day - never from their own account's. **Take in:** any
time, under any switch, even after the festival; the bowl and its cakes come back.

The town underfoot is asked for its offerings every 60 seconds and after every move (`scenes/witchesHost.js`) - while the
festival is live there, or while one of the account's own stands in it; never a guest's (`/v1/festival/town` is a hot
read: a session pass, a replica's, shed under an overload as a town's homes are). Each stands at its door where the build
kept its spot clear (`world/witchesDecor.js` `homes` - a dressed town keeps no other), its tallow lantern lit at dusk with
the town's; offline, or another account signed in, every pixel's come down. One whose home its character no longer owns
stands nowhere, and its bowl and its cakes go back to its account.

Every move is one `db.batch` whose statements decide it against the rows as they stand in its own transaction
(`server-account/src/festival.js`): no count is read in one request and written in another - a home changed hands, its old
owner's bowl is credited from its own row; a take credits the owner it read, at a home that owner still owns.

**From play - OFFERING-RAY (FIELD BUGS 2026-10-20e).** Each offering is a target in the street's one ray, its box the
ray's `{ min, max }` with the pixel's translation on each corner (`player/activate.js` `RayBox`, which the offerings'
list is typed with). It shipped as the batch's culling box, a 6-array the ray cannot read, and the pick tests every
entrant's box before it races them, so every press in a street where an offering stood crashed the game - at a body, a
person or a door alike - and the plaque named nothing there. Read to its root in
`01-Overview/bugs/Field-Bugs-2026-10-20e.md`.

## The towns dressed

Each town in its own people's way (`world/witchesDecor.js` `WITCH_KITS`, `witchCulture` - by the town's climate and its
region's people):

| Kit | Where | At the tavern's door | Beside it | Temples | Houses |
|---|---|---|---|---|---|
| Breton | High Rock | turnip lanterns | a straw effigy between turnips | standing candles | turnips, skull candles |
| Redguard | Hammerfell (its jungle coast too, Sentinel's own) and every desert | standing candles | a bowl of fire, skull candles | pole torches | standing candles |
| Highland | the mountains and the wooded hills | pole torches | a bonfire, an effigy, a horned skull | pole torches | skulls on stakes, turnips |
| Fen | every swamp; a Breton region's rainforest | ward-staves | a bowl of fire between ward-staves | standing candles | ward-staves, skull candles |
| Haunted | the Haunted Woodlands | skull candles | an effigy, a pile of skulls, a skull on a stake | standing candles | turnips, skulls, ribcages |

Daggerfall's own flats (TEXTURE.210's lights, 100's bones) beside three painted for the festival
(`world/festivalArt.js`: the turnip lantern, the straw effigy, the ward-staff). A house's step piece is chosen by its town
and its key - the same houses on every machine. A spot is taken only on the town's ground (inside its blocks, off the water
family DFU's people never walk - `dryGround`), where no wall stands between it and the door, where nothing stands under it
above the street (a house's plinth or its steps, lower than the rays across - looked down on at its middle and at its edge
nearest the door), and a pace from every flat and person the town already stands. A door faces where its own normal says (the build keeps it beside the door's corners -
a door on its box's middle line once faced into its building, one in seven). The dressing breathes between buildings
(PERF7 - `witchesDressingBreathing`). The pieces are logged with the block's own flats
(`scenes/pixelBuild.js`): they batch, stand solid, light the street at night (a fire is a hearth) and keep through a
season's re-skin.

## The Starfall and The Thirteenth of Frostfall

The festival's world event and its questline (`11-Multiplayer/Starfall.md`, STAR0-STAR8), folded into this release:
each real hour one of the Bay's covens pulls three stars down into its region's wilds, and the players at one hold it
against four waves and their master. The stars fall on THESE days - `net/starfall/starfallLaw.js` `starfallRuns` is
`festivalOpen` - and a held star is the act `star-held` (the endgame family), so it is a find like a breach closed: the
endgame's four cakes, twice on the nights the dead walk. The Heart-Star falls on the sky's 13th of Frostfall, the
festival's own day; held, it is `heart-star-held` beside its `star-held`, said in one turn - one deed, one find. The
questline's giver, Morwen, is of the Glenmoril Wyrd, the Wyrd Sisters' own coven, and the line
is tied to the festival's own parts (AUDIT STAR8, `11-Multiplayer/Starfall.md` section 7):

- **A Wyrd Sister hands over Morwen's letter.** Her window opened is the act `wyrd-met` (`scenes/witchesHost.js` shop),
  which The Thirteenth of Frostfall's first step waits on; a star held before any Sister is met brings Morwen's raven
  instead. The act is never a find (`festivalClient.js` ACT_NOT_FOUND): a press at her door is no Soul Cake.
- **The Heart-Star** is Three Stars' optional objective - held, the step's greater pay and Morwen's Heart-Star Ring.
- **The Wyrd know the Starwarden**: the line's title stands in her window's insignia, beside Hearthkeeper.

### The Starwarden's purse

The Thirteenth of Frostfall pays its title, Starwarden, on QLTF03's witnessed end - and, in the same write, 30 Soul Cakes
(`QL_STARWARDEN_CAKES`, `src/net/festivalLaw.js`) onto `players.fest_cakes`
(`server-account/src/questlines.js:"export const QL_PURSES = Object.freeze({ thirteenthFrostfall: QL_STARWARDEN_CAKES });"`).
The title's own UPDATE carries it, so the title row's guard is the purse's: once an account, never on a re-claim (which
answers the title held). Only while the festival is open for the account at the claim's clock - its days
(`festivalOpen`) and its switch (`festivalOpenFor`) - and never to a guest (a guest's end is refused before the batch).
The answer says `purse`, the cakes paid; the page hears it at the questlines' door
(`src/scenes/quest/questlineHost.js:"export function hearPurse(answer, { say = (line) => festivalDoors().say(line), refresh = refreshFestival } = {}) {"`):
"+30 Soul Cakes", said as a find is, and the account's count read again through the festival's own door
(`refreshFestival`), which restacks the pack's Soul Cakes to it. A purse whose answer was lost is on the count all the
same, and the pack's face follows at the festival's next answer.

## The four hosts

`scenes/world.js` WIRED (`createWitchesHost`: its frame, the offerings' targets and names; the Soul Harvest's sound);
`scenes/worldModes.js` WIRED (the street's ray: a Wyrd Sister's press, an offering's); `scenes/exterior.js` stands none (the
?exterior bench builds its own street and runs no account service: no festival there); `scenes/dungeonContext.js` stands
no street (a dungeon's kills and acts find as anywhere).

## Files

- Law, both ends: `src/net/festivalLaw.js`; holidays `src/systems/holidayTables.js` (a leaf, out of `holidays.js`).
- Service: `server-account/src/festival.js`, `server-account/migrations/0140_festival.sql`; the wardrobe in
  `server-account/src/titles.js`; routes `/v1/festival/*`, `/v1/account/icon`.
- Client: `src/systems/festival/` (`festivalClient.js` the finds, the sales, the wearing, the moves; `soulCake.js` the two
  items; `festivalWords.js` the shared words - the window's are `ui/wyrdWindow.js`'s, the street's `scenes/witchesHost.js`
  `OFFERING_TEXT`; `festivalFoes.js`; `festivalRows.js`).
- Streets: `src/scenes/witchesHost.js`, `src/world/witchesDecor.js`, `src/world/festivalArt.js`.
- Window: `src/ui/wyrdDoor.js`, `src/ui/wyrdWindow.js`; icons `src/ui/profileIcons.js`; the aura in
  `src/render/auraRing.js` (`witchfire`).
- Versions: RELAY_VERSION world235, ACCOUNT_VERSION acct165, migration 0140 (world231, acct162 and 0134 on the branch, renumbered past main's at the merges).

Tests: `test/systems/festival/` and `test/server/witch1_festival.test.js`.
