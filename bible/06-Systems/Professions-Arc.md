# Professions

Online play has ten life skills: five that gather (Mining, Logging, Herbalism, Hunting, Fishing) and five that craft
(Smithing, Building, Outfitting, Provisioning, Enchanting). The player gathers at nodes in the world with Foraging's
tools, refines and crafts at stations in town shops, homes and guild halls, and trades on the Notice Board's market in
Marks, the server's own currency (shown to the player as silver). Offline play has none of it.

## How it works

**Tracks and ranks.** Each track runs rank 0 to 100 on 10 x rank squared XP (Novice 0, Apprentice 25, Journeyman 50,
Expert 75, Master 100). Seven material tiers open at ranks 0, 10, 25, 40, 55, 70 and 90. A harvest gives 15 XP a tier,
half again for a clean act, a quarter for a node more than two tiers below the rank's top. Most crafts give 20 XP a tier
on the same quarter rule; the first make of each pattern at each tier pays the track's own first-make share
(`FIRST_MAKE_SHARE`). A character may take at most two crafts above Journeyman. There is no daily cap on gathering;
each node is worked once a character a UTC day.

**Disciplines.** The five crafts hold eight disciplines: Smithing (smithing, jewelcrafting), Building (carpentry,
masonry), Outfitting, Provisioning (alchemy, cooking) and Enchanting. A recipe raises its craft's track.

**Specialisations.** At rank 50 and rank 100 a track takes one choice (a merged craft offers its disciplines' four).
A new choice is free and immediate for a day after it is made; after that a change costs 1,000 Marks, takes effect at
once and locks the track's next paid change for seven days. Two choices (Couturier, Saddler) are shown but not yet
choosable.

**Nodes.** Which nodes stand on a map pixel today is a hash of the pixel and the UTC day, so every client sees the same
herb patches, veins, boulders, trees, fishing schools and bodies. The service rolls every yield. It holds no map: it
learns a pixel's climate and region from clients, and a pixel is confirmed once three accounts at least a week old
agree. On unconfirmed ground herbs and trees stay at tier 2 and veins at tier 3, and a region's signature ore waits for
witnesses. Each province past the Bay is rich in some node kinds and may stand its own ore; Cyrodiil is rich in all
(`src/net/provinceNodes.js`).

**The acts.** Every harvest is played, and a clean act yields and pays more within a fixed bound:

| Profession | Tool | Act |
|---|---|---|
| Herbalism | Sickle, Basket | hold steady in a window; the Basket's glints for food |
| Mining, quarrying | Pick-Axe | strike glinting points on the vein; the vein cracks in stages |
| Logging | Wood-Axe | swing as a closing ring meets its band |
| Hunting | Skinning Knife | trace the cut along a body the player's own blow felled |
| Fishing | Fishing-Net | throw, wait, pull in the tug window |

Each station has its own act too: heat at the anvil, plane at the workbench, stitch at the loom, chisel at the mason's
bench, facet at the jeweller's bench, the pan at a fire.

**Motherlodes.** Three tier-6 veins rise each UTC day on confirmed ground (mountains and deserts first), one in each
third of the day. Each stands two hours or until 20 characters have struck it; each striker gets ore and 10 Marks, once an account a
day. Warnings come 10 minutes ahead (30 with Motherlode Sense).

**Where materials go.** A harvest lands in the Materials Bag, else the pack, as an ordinary item. The service counts
what it handed out, and only counted units can go into the **Stores**, a per-character inventory the account service
keeps (5,000 of a material at most). A station draws from the Stores, the bag and the pack. A unit the service never
counted is **loose**: a station may use it, but nothing made from it reaches a writ, guild Stores or the market.

**Stations.** A station is a shop counter (paid in gold), a station placed in the player's home or guild hall (free),
or a caravan's station for its visitor:

| Station | Shop | Work |
|---|---|---|
| Forge, anvil | Weaponsmith, Armorer | smelt, burn charcoal, smith, temper |
| Jeweller's bench | Pawn Shop, Gem Store | jewellery |
| Workbench | Furniture Store | saw planks, staves, bows, arrows, furniture |
| Loom | Clothing Store | cure, weave, spin, leather, garments, temper |
| Mason's bench | General Store | cut, mortar, stone decor |
| Alchemy | Alchemist, Mages Guild hall | brew, transmute |
| Enchanting | Mages Guild hall | disenchant, reforge |
| Fire | any hearth or campfire | dishes |

**Crafting.** The station lists patterns (Longsword, Cuirass, Ring...) and the player picks the material from what is
held. If an input is missing, the station plans the refining chain from what is held and runs those works first
(`chainPlan`), never down a tier. A craft rolls a quality (Crude, Standard, Fine, Superior, Masterwork) by the margin of
rank over recipe; a clean act, a matching rank-50 choice, and Warforged, Heartwood or Hardened Leather each add a step.
Superior is Magic and Masterwork is Rare in Loot Rarity. A crafted piece carries a provenance id the service signed.

**Temper and reforge.** Tempering raises a piece of Rare or below one quality step, up to Superior, for half its
recipe's materials. Reforging (Enchanting 50) replaces one property of a Magic or Rare piece for 2 or 5 Arcane Essence,
doubled for each earlier reforge of that piece.

**A Master's work.** A Master may make one Legendary piece a UTC day of a wearable kind. The crafter chooses its three
lines (at most one that procs); the service rolls their values inside the Legendary band. It spends the recipe's goods
plus 2 Heartwood, 3 Pearls and 10 Arcane Essence.

**Marks.** Only the account service holds Marks, and it mints them only for acts a server witnessed: Court writs,
crafting writs, gate, raid, serpent, Elite Breach and fallen-star receipts (together at most 150 a day), Siege
Honours, guild deeds, Motherlodes. Two small faucets are capped by the day instead of witnessed: a find while gathering
and a find in loot. A Bank of the Empire counter buys Marks at 8 gold each, 300 a day; gold never buys Marks.

**The Notice Board.** Every rumour board in a town is one board for that town. It holds up to 30 player notes and 20
server notices. An account may have three notes pinned (1, 3 or 7 days); three reports from established accounts hide
a note until a moderator decides. The board also opens the Work tab and the Market.

**Writs.** Court writs ask a region's materials from the Stores and pay Marks (units x value x 1.2), XP and Renown,
three an account a day. Crafting writs ask potions, dishes or Repair Kits the character made, from the guild that
would want them, three an account a day. Guild writs and commissions move Marks a guild or player already holds,
standing seven days.

**The Market.** A listing is a Stores material or a crafted piece, in Marks (or a realm character's gold, walled off
from anything that earns Marks), for 72 hours on every board. A buyer in the listing's region takes it at once;
elsewhere the courier's fee is paid by the road between region hubs. Buy orders stand seven days. A sale pays 5% tax.
Masterworks may go to a 24-hour auction (5% least raise; a bid in the last two minutes adds two). Every province past
the Bay has a market hub: its capital, else its largest city (`src/systems/region/marketHubs.js`).

**Seeing nodes.** Nodes near the player show on the compass in their profession's colour. In the world they glint, show
an outline, or both, by the Resource highlights setting.

## Rules

- **Online only; DFU's makers untouched** (Mac). The potion maker, spellmaker and item maker stay Daggerfall's; offline
  play earns nothing toward a profession.
- **Daggerfall's items first** (Mac). A material or product is DFU's own template wherever DFU has one; new templates
  only in the reserved range 600-699, registered by `src/systems/professions/profTemplates.js`. The tools are
  Foraging's; the Skinning Knife (603) is the one tool added.
- **The Stores are the server's.** Only the service's own harvests, crafts, purchases, writ returns, counters and
  spoils enter them; a pack item the service never counted never does (`src/net/bagLaw.js`).
- **The nodes are the clock's; yields are the service's** (`src/net/nodeLaw.js` `NODE_SALT`).
- **The hands do the work** (Mac): every harvest and craft is an act the player plays.
- **Crafting does not retire loot** (Mac): a craft reaches Rare (Masterwork), a Master's work Legendary; Aetheric,
  Artifact and Sigil pieces are never craftable (`src/net/masterLaw.js`).
- **Marks, not gold** (Mac): everything priced between players is in Marks, and gold never buys Marks
  (`src/net/marksLaw.js` `MARKS_BANK`).
- **No day's cap on life skills** (Mac). Two bounds stand against a modified client: four unconfirmed dungeon veins an
  account a day (`DEEP_UNCONFIRMED_PER_DAY`) and Hunting's rare hides (`HIGH_HIDES_PER_DAY`).
- **A perk is tried before it is kept** (the owner): the day's free trial and the seven-day lock (`RESPEC`,
  `SPEC_TRIAL_S`).
- **Resource highlights are the player's choice** (the owner): Glint, Outline or Both (`src/systems/features.js`
  `resource-highlights`).
- The switch is `PROFESSIONS_OPEN` in `server-account/wrangler.toml` (`off`, `dev`, `on`); it is `on`.

## Daggerfall Unity

DFU has no crafting skill, no gathering and no player market. Its three makers (`DaggerfallPotionMakerWindow`,
`DaggerfallSpellMakerWindow`, `DaggerfallItemMakerWindow`) are kept as they are, and Alchemy and Enchanting are layers
beside them online. The professions are this game's own: online play needed a skill path the service can witness.

## Code and tests

- `src/net/professionLaw.js` - tracks, ranks, tiers, specialisations, materials, works, Court writs
- `src/net/recipeLaw.js` - every recipe, quality, craft XP, first makes, station acts
- `src/net/nodeLaw.js`, `src/net/provinceNodes.js` - nodes, yields, the witnessed world, province richness
- `src/net/chainLaw.js`, `src/net/temperLaw.js`, `src/net/masterLaw.js` - the chain, temper and reforge, a Master's work
- `src/net/marksLaw.js`, `src/net/boardLaw.js`, `src/net/marketLaw.js` - Marks, the board, the market and auctions
- `src/net/writLaw.js`, `src/net/craftWritLaw.js` - guild writs and commissions, crafting writs
- `src/net/motherlodeLaw.js`, `src/net/trophyLaw.js`, `src/net/bagLaw.js` - Motherlodes, trophies, carried counts
- `src/systems/herbAct.js`, `src/systems/mineAct.js`, `src/systems/chopAct.js`, `src/systems/traceAct.js`,
  `src/systems/fishAct.js` - the gathering acts
- `src/scenes/gatherHost.js`, `src/ui/professions/profPages.js`, `src/ui/professions/craftHall.js` - gathering in the
  world, the station pages, the Crafting page
- `src/ui/nodeMarks.js`, `src/render/nodeGlint.js` - compass marks and the glint
- `server-account/src/professions.js`, `server-account/src/market.js`, `server-account/src/marks.js` - the service
- `test/net/prof1_service.test.js` .. `test/net/prof12_service.test.js` - each profession's law and service
- `test/net/craft1_chain.test.js` .. `test/net/craft5_consumables.test.js` - the chain, patterns, five crafts, temper,
  consumables
- `test/net/masterart_law.test.js`, `test/net/perktrial.test.js`, `test/net/craftwrits_law.test.js`,
  `test/net/prof2b_motherlode.test.js`, `test/net/marks1.test.js`, `test/net/notice1.test.js`
- `test/scenes/nodemarks.test.js`, `test/scenes/nodeglint.test.js`, `test/ui/professions/crafthall.test.js`

## Open

- Couturier (two-colour dyes) and Saddler (a wagon upgrade) wait for their systems and cannot be chosen.
