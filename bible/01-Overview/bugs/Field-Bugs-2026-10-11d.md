# FIELD BUGS 2026-10-11d - four Discord feedback threads

Four threads from the Discord's feature feedback, handed over as screenshots with the owner's word: "Make the best
decisions". All four are done.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Can't see any boss ground attack overlays with heavy snow" - "I have been hit 5 times and died twice with zero warning or feedback while fighting revenants outdoors in heavy snow, all due to invisible attack indications (ranged AoE circle)"; then "I would have just turned off the deep snow in the options but nobody in any chat has been able to tell me how to do this or if it is even possible" (beardtonguev1) | a foe's telegraph lay 0.06 m over the bare ground, and Snowfall's deep snow - 0.4 to 0.8 m of it in the wild, drawn first and depth-written - buried it | fixed (SNOW-TELL); the switch was there all along (below) |
| 2 | "letter of credit during trade" - "Cant see how much a letter of credit is worth when trading directly with players", a screenshot of two letters in the pack's list, each "0.10kg" (Khaz) | TRADE-LOC (2026-10-10) said the worth in the detail a click opens and the row's hover - a phone has no hover, and two letters in a list could not be told apart | done (TRADE-LOC II) |
| 3 | "Many ore veins look the same." - "Copper/lodestone/moonstone/ebony and others all have the same basic texture so its very hard to tell the difference when looking for them" (SaberGGaming) | DFU shares two pictures among eight metals and PROF2 lent the new ores Lodestone's, untinted - PROF0 4.8 said "tinted per ore" and it never was | done (VEIN-WASH) |
| 4 | "Arbitrary mining conditions to 'unlock' higher nodes." - "Why is this a thing? Also how are we supposed to tell if higher tier veins have been unlocked in an area?" and "add something to the overworld map like 'this area is known for X ore'" (SaberGGaming) | the witnessed world's law, said on the Mining page alone; no surface said what a place's veins hold or whether its ground is witnessed | done (ORE-MAP); the law kept (below) |

## SNOW-TELL: a foe's telegraph lies over the deep snow (1)

The report's revenant is a rank-2 caster's signature, the pyre (`ai/blowShapes.js` BLOW.pyre, `systems/revenant/revenantFeud.js`
drawSignature): a 2.2 m disc at the player's feet, telegraphed by the foes' ground pass (`render/foeTelegraph.js`,
TACT4) - one flat quad 0.06 m (BLOW_LIFT) over the ground its blow was fitted to (`ai/foeBlows.js` fitBlowToGround,
the collider's ray), depth-tested and never depth-written. The colliders know no snow. Snowfall
(`03-World/Snowfall.md`) stands a real displaced surface 0.4 to 0.8 m over that same ground in the wild (0.2 to 0.4 m in
a town), drawn BEFORE the ground and writing depth, so outdoors in winter every foe's telegraph - every shape, not the
pyre alone - and the player's own technique marks (TECH1, the same pass) lay under opaque snow. No dial saved it: the
mod's depths stop at 0.1 m, still over 0.06.

The mark lies over the snow now. The renderer keeps the frame's snow height - `beginFrame` clears it, each tier
`drawSnow` draws raises it to `render/snowfallGlsl.js` snowSurfaceRise of that tier's uniforms (snowResolve's highest
answer: the deeper of the wild's and the settlement's depth, a road's berm over it, the 8 mm surface offset; the caps,
the path, the slope's multiplier and the tracks only lessen it) - and `drawFoeTelegraphs` hands it to the pass, which
lies its quads `telegraphLift(snowRise)` = BLOW_LIFT plus it over the fitted ground. Where the snow is shallower than
its deepest - a trodden track, a road, a town's lesser depth - the mark stands that much over the snow, seen; it is
never under it. A frame that draws no snow lifts nothing: the travel view, an interior, a dungeon, summer. THE FOUR
HOSTS: `scenes/world.js` and `scenes/exterior.js` draw the snow (before their telegraphs, pinned) and are wired through
the renderer; `scenes/worldModes.js` (interiors) and `scenes/dungeonContext.js` draw none, and their marks lie as they
always lay. The world boss's court pass (`render/gate/gateTelegraph.js`) is not touched: the court is the gate's own realm,
where no snow falls.

THE SWITCH THE PLAYER LOOKED FOR is there, and was: Settings > Graphics > "Sky, water & weather" > "Snowfall by
demifiend000" (FT9's row; `ui/settings/settingsMap.js`), and the settings' search finds it under "deep snow" - the row's note
begins "Deep snow on the winter ground". The patch notes say where it is. A second "Snowfall" on the Overhauls card is
the winter ground's TEXTURE pack (SNOWFALL1's sibling, ENVIRONMENT_PACK_MODS) and changes no depth - the likelier source
of "nobody could tell me". Renaming either is the owner's call (Mac named the mods' rows by their authors, FT9).

Pinned by `test/render/fb1011_snowtell.test.js` (4: the rise law over the runtime's own uniforms at the mod's defaults and its
deepest dial; the pass's uLift with and without snow through a fake GL; the renderer's clear, record and hand-off; both
snowy hosts' order and the other two hosts' absence of snow); `tools/mutants/fb1011_snowtell.json`.
`test/scenes/audittact.test.js`'s AUDIT TACT D9 pin moved (PIN MOVED: the snow's height handed beside the fog).

## TRADE-LOC II: a letter of credit says its worth on its row (2)

TRADE-LOC (`10-UI/Overhauls.md`, 2026-10-10) put a letter's worth in the trade window's detail strip and in its row's
hover title. The report's screenshot is a build before it (its detail strip reads "0.10 kg" alone) - but its case
stands on the build after: two letters in one list are told apart only by clicking each, and on a phone there is no
hover. The row says it now: `ui/enhanced/enhancedPlayerTrade.js` row's sub-line leads with `letterWorthLine` ("Worth 12,500
gold"), on the pack's list, my offer and theirs - the one row builder all three draw through. And the pack's own card
(`ui/enhanced/enhancedInventory.js` infoCard - the pack's, every shop's and the trade's hover card) says it as its headline pair,
Worth, under the damage and the armour a letter never has: `systems/walletItem.js` letterWorthGold, the figure
letterWorthLine now says after its word (one law, one home). DFU's classic Info box already said it (TEXT.RSC 1007's
`%wth`). The wire was never the fault: the letter's `value` survives the trade's clamp, pinned by TRADE-LOC.

Pinned by `test/systems/fb1011_tradeloc.test.js` (2); `tools/mutants/fb1011_tradeloc.json`; `tools/mutants/trade_info.json`'s
TRADE-LOC-read-off-template re-aimed by content (PIN MOVED: the figure is letterWorthGold's).

## VEIN-WASH: every ore on a shared picture wears its own wash (3)

DFU's metals (TEXTURE.254) are five pictures of their own - Mercury 61, Gold 62, Iron 63, Tin 64, Sulphur 67 - and two
shared: Lead, Silver and Platinum on 65; Copper, Lodestone (and Brass, never mined) on 66. PROF2 lent all six new ores
Lodestone's 66 and drew a vein as its metal's picture alone, so eight ores stood as one lump - PROF0 4.8's own table
says "DFU Lodestone, tinted per ore", and the world flats never were (the Stores' icons were, by DFU's dye).

`scenes/mineHost.js` ORE_WASH: each ore on a shared picture but its first wears a wash of its own, through ARENA5's
batch wash (`render/renderer.js` uBatchTint, both lanes - a colour multiplied into the lit flat after both maps): Copper
orange, Silver cold white, Platinum pale gold, Moonstone moonlit blue, Dwarven Scrap brass, Mithril sea-green,
Adamantium violet, Ebony near-black, Orichalcum orc-green. Lead and Lodestone keep DFU's own colours, as do the five with
pictures of their own; a boulder's loose stone is Lodestone's lump as it is. The colours are the port's own (the nodes
are no DFU member). `mineWash` hands the flats their wash (a Motherlode its ore's); `scenes/gatherHost.js` stands each
wash as its own batch (the group's key is record, scale and wash) on the open ground, and sets it on the dungeon's own
batch underground. The glow and the compass keep mining's one colour - they say which profession, not which ore.

Pinned by `test/scenes/fb1011_veinwash.test.js` (3: no two mined ores look alike over every picture; a confirmed Daggerfall
woodland's Moonstone and Lodestone, one picture, stood as two batches each in its own colours; an unwitnessed
dungeon's Silver in Silver's wash); `tools/mutants/fb1011_veinwash.json`.

## ORE-MAP: the held map says what a place's ore is, and whether its ground is witnessed (4)

THE LAW IS KEPT, and the card says it. A pixel's rarer veins - Gold, Platinum, Mithril, Ebony and a kingdom's own ore
(UNWITNESSED-ORE, `Field-Bugs-2026-10-09e.md`) - stand only on ground three accounts a week old have gathered on
(`06-Systems/Professions-Arc.md` section 6, the witnessed world). It is not arbitrary: the servers carry no game data
(Port-Doctrine), so a client says what climate and region a pixel is and nothing checks it but other players' word
(`11-Multiplayer/Seats-Arc.md` 3.2) - the rule is what keeps a modified client from naming every pixel a mountain of
Ebony. What was missing is the reading of it: nothing but the Mining page's one paragraph said it, and nothing said it
for a place.

`ui/oreMapTip.js` oreMapTip is the card: "Ore here", then the pixel's veins (`net/nodeLaw.js` VEIN_TABLES by its
climate), its dungeons' deep veins (dungeonVeinTable), its kingdom's own ore (regionSignature - "Daggerfall's own ore:
Moonstone"; a Free Land's by its region's name), and its ground: "Witnessed ground: all its veins can stand here";
"Not yet witnessed: no Gold or Ebony here yet" with the rule under it; where the state is not yet heard, what waits on
the witnesses and the rule; on ground whose table holds nothing over Silver and no kingdom's ore, "No vein here waits
on witnesses". The held map's bare ground answers with it (`ui/heldMap.js` _hoverLabel, under the province's name; a
place keeps its own answer), online, the professions open (`scenes/world.js` oreMapAt, the map's `oreAt` - offline
the map is DFU's and says nothing of ore). The ground's state is the book's (`net/profBook.js` pixel); one not heard
today is asked ONCE a page, after the pointer has rested 400 ms on it, through the gathering host's new askPixels -
which stands again any pixel of its own the answer moved, as its own ask does (the book would otherwise hear a streamed
pixel first for the map and the ground's ask never want it: it would stand on the morning's word all day) - and the
card is asked again when the word comes. The Mining page's ground line ends by pointing at the map. The classic DFU
travel window is untouched (THE NATIVE-WINDOW RULE: DFU has no such card).

Pinned by `test/ui/fb1011_oremap.test.js` (3: the report's case and its kin card for card; over every vein climate and
every region the card is the law's own - its veins, its kingdom's ore, every card whole on the map, and an ore it holds
back never standing on thirty unwitnessed days; the world host's wiring and the gathering host's ask standing a
witnessed pixel's Moonstone at once); `test/ui/heldmap.test.js`'s ORE-MAP window test (1); `tools/mutants/fb1011_oremap.json`.
