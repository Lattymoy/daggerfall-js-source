# AUDIT FB1031 - FIELD FEEDBACK 2026-10-31 read cold, 2026-10-31

The owner: *"Audit this"*, of FIELD FEEDBACK 2026-10-31 (`../bugs/Field-Bugs-2026-10-31.md`). Cold lanes read each
slice in a frozen worktree, given its commits and the players' words, never its authors' conclusions. Every finding was
reproduced with a probe on the real code and the freeware's data before it was reported, and its fix was pinned by a
test that fails on the code as it stood. Each fix in code carries an `AUDIT FB1031 <id>` comment. Mutants:
`tools/mutants/fb1031_benchstores.json`, `fb1031_craftbound.json`, `fb1031_light.json`, `fb1031_yard.json`,
`fb1031_foes.json`, `fb1031_witness.json`, all dead. The second read (II, below): `fb1031ii.json`,
`fb1031ii_cover.json`, `fb1031ii_fire.json`, all dead. The third (III): `fb1031iii.json`, all dead.

| Lane | Read | Found |
|---|---|---|
| PACK | STORES-AT-BENCH and PACK-SORT: every station, every store a Sort is offered on, every list whose order is state | 5 |
| LIGHT | WINDOW-NIGHT and RED-MOUNTAIN-SEEN: both lighting lanes, every fog row and Land View | 4 |
| YARD | YARD-WALLS: every house in BLOCKS.BSA, the service, mixed versions | 8 |
| FOES | TRUNK-FOES and BAND-NEAR: every nature record, every flight, the band's stand | 7 |
| CRAFT | SMITH-RRI, BUTCHER-STORES, DAEDRIC-RARE: the made pieces, mixed builds, every Daedric source | 4 |
| BOUND | BOUND-DESTROY: every Aetheric set by its producer, the service route, both skins | 5 |
| WITNESS | WITNESS-MAP: every view of the Bay, the service's reads, a province and the sea past the Bay | 7 |

## PACK

**P1.** A forge's press lands on the Anvil, the second station worked there; the bar's own put-in repainted it over the
Forge, out of view. The landing is kept (`profPages.js` `_stores.benchAt`). **P2.** A reset left the bench's last
answer, and one that came while the player followed Your Stores read on neither page; it is the Stores page's too.
**P3.** STORES-AT-BENCH had no mutant record. **P4.** The ridden horse is the pack's first, and Sort ordered priced
Stable horses by value, so it changed the horse ridden; horses now tie (`packSort.js`). **P5.** The new strings were not
in the catalog; they are, drafted in the thirteen complete languages.

## LIGHT

**L1.** A pane's glow fell to the night's gain in one capture at 17:49, eleven minutes before the room's own night; Day
only went out whole. Both ease over the sun's first 0.15 of height (`windowLight.js` wlDayShare). **L2.** Under weather
the far views stood wholly in fog, a seam at a near Land View (54% of the ground still seen at Land View 1 in a
sprinkle); they fog by the weather's own law (`horizonHaze.js`). **L3.** The record overclaimed: at night in rain the
fog is the sky's colour and the cone is not seen. **L4.** The fog colour flipped to grey at the rain's density; it
eases in (Port-Ledger, THE GREY EASES IN). OPEN: DFU's grey at night in snow and ash, the owner's call.

## YARD

**Y1.** Above 4 m a piece had to stand on or against its house, but the law read the house's box: open ground inside it
took a free piece to the roof in 4,309 of 6,016 houses. It reads the house's ground, roofs and faces; 44 remain, each
under a roof or against a face. **Y2.** A Duplicate of a lantern on a -z wall, and a flipped picture moved onto a wall,
hung upside down. **Y3.** The catalog (with P5). **Y4, OPEN.** The service knows no lots, so a crafted client can
stand a free piece to 8 m. **Y5.** Imperial City courts keep 4 m: each stands 0.3 m off its house. **Y6.** The service
stored a crafted hung tree; neither end takes one (acct239). **Y7, Y8.** The record's mixed versions and measures.

## FOES

**F1.** A ray opened a cover proxy whole when a struck body stood in it, and the clamps leave bodies inside wide
flats' cover (35 nature records) and young trees' crowns: a foe pressed behind a rock was shot through it, and the
player was hit behind one. A ray with an end in a proxy now hides only where it crosses the proxy's middle inside it, either end alike
(`cover.js`; AUDIT FB1031 II K1 made it so for a crown lifted off the ground): in front is struck, behind is hidden both
ways. **F2, F3.** Each flight lists only what it may strike, duels and companions included.
**F4.** A foe on a trunk's middle line stood there for good; it steps round. **F5.** A record named a navmesh the
street has not. **F6.** Three unpinned laws. **B1.** A band met head-on stood mid-screen; it stands outside the view.

## CRAFT

**C1.** A Stores-butchery row asked again by an older build named the meat, which that build mints: Stores and bag
both. The repeat names it none. **C2, OPEN.** The gate Warden's Ruhn's Regalia (Daedric) falls on a sixth of its kills;
the owner's call (III X1 adds its ordinary pieces and main's Delve vault). **C3.** A sworn revenant refused a made Light Flail or Archer's Axe.
**C4.** FIRST-BUDGET's figures. Unconfirmed: an older build cannot mint a new recipe bought at the market, as for any
recipe ever added.

## BOUND

**D1.** A lost let-go kept its id for good: five cakes found again and destroyed replayed it, said Destroyed, and moved
nothing. A count heard since makes a new ask. **D2.** The catalog (with P5). **D3.** The let-go's hourly budget
pinned. **D4.** The record: the classic wagon takes gear. **D5.** A priced ware the realm locked still dismantled for
Embers, which AUTO-HOLD had shut for salvage; it is refused, and destroyed for nothing. The account deploy's path filter
names `itemBound.js` since.

## WITNESS

**W1.** The reader asked six of up to 35 regions in view: 55% of the land in a 1080p view was never asked. **W3.** The
map's ask was said to cost no scan; past the board's 10-minute keep, and on any empty region, it scanned the witness
rows on the primary. **W4.** A province is one region past the Bay, and the sea there is region 0, so the 8,192-pixel
cap cut them north first, unsaid. All three by one change: the day's confirmed ground is laid once as 64-pixel tiles,
keyed by the world pixel (`witnessTiles.js`, migration 0207, acct241), and the map reads every tile in view by its key
from a replica.

**W2.** The wash was painted on every pulse and pan frame (49,152 pixels, 84 ms); it is a kept bitmap,
a pan frame's blit 1-2 ms. **W5, W7.** The pins: a real sea pixel past the Bay, the switch's save and redraw. **W6.** A
pixel a harvest confirmed stayed unwashed till the next day; it shows at once.

## II - the second read

The fixes above read cold again, in four lanes (AUDIT FB1031 II). Written up by AUDIT FB1031 III W2, which found them
in the commits and the code only.

**K - the cover.** **K1.** An end of a line inside a cover proxy, either end alike, hides only where the line crosses
the middle inside it (`ai/cover.js` rayUpright): 1,656 one-way sight pairs round six young trees became none. **K2.**
F1's two-way pin samples a lifted crown. **K3.** A foe's side step off the ground is refused, the push alone then
(`foeSpacing.js`). **K4.** The dungeon's shaft names the relay's bodies, and the bolts DEX5's corpse prefabs. **K5.**
F2's unpinned laws pinned. **K6.** The band's edge is the horizontal half-view plus the pack's spread
(`travelBands.js` bandStandBearing): 32:9 had stood 94% of bands with a member in view. Mutants `fb1031ii_cover.json`.

**G - the light.** **G1.** Red Mountain's lava, plume and the Ghostfence's light were dropped under every weather row
that leaves the sky clear; they are drawn, fogged by the row's own law (`redMountainFire.js`). Mutants
`fb1031ii_fire.json`. **G2-G4.** Real-Windows' night glow, the far ring and Weather-Arc's 77, true.

**T - the map's wash.** **T1.** The wash's bitmap (9 MB at 4K) outlived the window; it is let go with it
(`heldMap.js` _dropWash). **T2.** A pan asked at the map's 4 Hz poll and spent the account's door rate; a landing
waits a second (PROF_GROUND_ASK_GAP_MS). **T3-T5.** The kept image's clear, the far band's reason and the laying
statement's size, pinned and true.

**R - bound and Broker.** **R1, R4.** A ware the realm locked offered a Dismantle that refused, and the batch salvage
sent it to the Broker; it offers Destroy alone. **R2.** D1's in-flight guard was one flag for every let-go; each is
kept apart. **R3.** The merge's migration and version notes, true. **R5, R8.** Revenants' and Sigil-Sets' sentences.
**R6.** The gather line is English to its head, so its Stores tail stays English until the line is translated whole.
**R7.** The salvage verb in five languages, Korean's Keep. **R9.** Pinned. Mutants `fb1031ii.json` (with T1-T3).

## III - everything, after the merge (2026-10-31, Mac: "Audit everything")

The branch read cold a third time at 50cc2cee3, after main was merged in and CANOPY-SEE added: five lanes - the world
slices, the item and service slices, the merge's renumbering, what main's work does to the branch's, and CANOPY-SEE
(its findings in `../../06-Systems/Travel-View.md` AUDIT CANOPY-SEE). Pins `test/characters/fb1031iii_band.test.js`,
`test/ui/fb1031iii_items.test.js`, `test/ui/fb1031iii_bench_l10n.test.js` and `test/net/butcherstores.test.js` III I1.

**W1.** B1 and K6 measured the view from the feet; in third person the eye stands up to 11.4 m behind them, and at 21:9
zoomed out 96% of bands stood a member in view. The edge turns out by the law of sines from the eye drawn
(`travelBands.js` bandStandBearing `backM`, the renderer's eye handed in `world.js` bandStand's call in place).
**W2.** Lane II was in the commits only; it is written above. **W3.** Scale-Arc's WITNESS-TILES row said acct236.

**I1.** C1 named no meat to an older build asking again, but the race's own repeat still did: two tabs on one kept
harvest minted it twice. Both repeats go through `repeatAnswer` (`professions.js`). **I2.** The bench bar's Put
everything in, its busy word and its answer line were English in every language; they are the catalog's, in the
thirteen. **I3.** A maker's mark sorted a Masterwork after its plain twin, so Sort moved the swap slot to the plain one;
each quickslot kind keeps its order (`packSort.js`). **I4.** Destroy on a face stack a festival answer restacked closed
the card and said nothing; it says the piece moved. Also: the field record's DAEDRIC-RARE line said Ebony below level 20,
where the ramp's own metals stand.

**X1.** C2 called the Regalia the largest Daedric source; the Warden's ordinary pieces pass it from level 30, and main's
Delve vault is another (`../../06-Systems/Unleveled-Loot.md`). Main's Portal Book, music box, raids and creatures met
every branch law soundly.


**M1.** The merge's renumbering held in every version line, pin, mutant record and migration; its one slip was W3.
BOUND-DESTROY's history in `service.js` said main ran to migration 0203; main then ended at 0202, and 0203 was
BUTCHER-STORES'. Not the branch's: `test/world/fb1002_audit.test.js` test 9 fails on main as here, from before the
merge.
