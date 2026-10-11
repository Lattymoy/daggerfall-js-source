# Horse Barding

BARD1 (2026-10-11). The owner: "can you do sprite armor for the 2d sprites and 3d armor for the horse". Asked what it
should do, "Look + light trade-off"; asked which kinds, all four - leather, chain and plate barding and a cloth
caparison. Not a DFU member: Daggerfall's horse wears nothing. Ledger A (BARD1).

## What a horse wears

Two fields on DFU's one Horse item (`systems/itemFields.js`, on the Horse alone - `systems/itemLaw.js`'s `horse`
finding): `horseBarding` (1 leather, 2 chain, 3 plate; absent, none) and `horseCaparison` (1..8, one of
`CAPARISON_COLOURS` - crimson, azure, forest, gold, sable, ivory, purple, orange; absent, none). They are the horse's
gear, so they go with it to a buyer (not a `RECEIVER_MARKS` mark, as its bond and its food's clock are).

## What it does

`systems/horseBarding.js`, read by `systems/upkeepRuntime.js` and `systems/steedCare.js`:

| | Leather | Chain | Plate | Caparison |
|---|---|---|---|---|
| Rider armour astride (`BARDING_ARMOR`, every part) | +2 | +4 | +6 | - |
| Burden (`BARDING_LOAD`, `CAPARISON_LOAD`) | 0.03 | 0.06 | 0.10 | 0.01 |
| Speed lost at Strength 50 | 2% | 4% | 7% | 1% (with the barding's) |
| Gallop spend (`bardingBreath`, 1 + 3 x the burden) | +9% | +18% | +30% | +3% |

- THE RIDER'S ARMOUR. The port's horses take no blow of their own, so the barding protects whoever rides: astride
  (the transport `Horse`), every one of the rider's seven parts is the barding's points the better armoured - an
  entity fold (`upkeepRuntime.js` `horse-barding`, `entityMods.js` `armorParts`, read by the hit formula). The upkeep's
  frame (`tick`) says who rides and on what (`setAstride`), and the rider's mods are re-summed only when the points move
  - mounting, dismounting, or a fitting while astride.
- THE PACE. `bardingPace(worn, strength)` = 1 - burden x (1.2 - Strength / 100): the ride's pace (`rideScale`) times
  it, horse care on (the horse's own Strength) or off (Strength 50). A strong horse carries it lighter.
- THE BREATH. With horse care on, the gallop's spend (`stepBreath`'s `burden`) is the barding's `bardingBreath`.

## How it is had

Four items (`systems/upkeepItemRows.js` `BARDING_ITEM`, the upkeep block's 1712-1715, rarity 20 - no shelf or loot
table rolls them): Leather Barding (15 kg, 400), Chain Barding (40 kg, 1200), Plate Barding (60 kg, 3000) and a
Caparison (6 kg, 250). The Stable sells them (`systems/merchantYards.js` `yardStock`, `BARDING_ORDER`) - offline at
once, online only once `BARDING_ITEMS_ONLINE` is on (REST6: a release ships the templates first, so no older client meets
an item it cannot read).

THE FITTING is the Stable page's (`ui/holdingsPages.js`, the ridden horse's card, under its look): a Barding row
(None, Leather, Chain, Plate) and a Caparison row (None and the eight colours), the choices the pack cannot fit shown but
not offered, and the costs in a line under them (`bardingEffects`). `fitBarding` takes the kind's item out of the pack
and puts the old kind's back into it, so a fitting loses nothing; `fitCaparison` takes a cloth for a bare horse, dyes a
fitted one again free, and puts it back into the pack when taken off. A barding fitted is the horse's weight, not the
pack's.

## How it is drawn

What a horse wears rides its LOOK (`systems/horseCoats.js`): the look's code takes two high digits over COATS1's hide -
`code = hide + 6881280 x (barding + 4 x caparison)`, `HORSE_LOOK_CODE_MAX` 247726079 - so every picture keyed by the
look (the pool's, the riding sprite's, Eye Of The Beholder's, a peer's, a parked team's) is drawn in it with no new
key, and the wire says it as it says the coat (`net/wire.js` `HORSE_LOOK_MAX`, world196). A bare horse's look and code
are COATS1's exactly. An older client reads a barded code as past its law: a bay, never a wrong horse.

- THE SPRITES. `recolorHorse` paints over the hide after its dye (`bardingPixel`), shaded by the hide's own light over
  its region's: the barding above the knees (`BARDING_KNEE`, 0.45 of the hide's height from the hooves) - plate in
  lames with a seam, a lit edge and rivets, chain a mail dither, leather quilted with stitches and brass studs, its
  head bare (`LEATHER_HEAD`); the caparison a skirt over the barrel (`CAPARISON_BAND`) with a gold hem (sable on a gold
  cloth), the armour showing above it. The riding sprite (its head and neck alone) takes the barding from its lower
  edge and no skirt. The tack is never painted - it is not the hide.
- THE 3D HORSE. `world/horseModel.js` `bardingShells`: the body's own triangles where each piece lies (the barrel above
  the knees with the chest's front; the neck; the chanfron - the head's and the jaw's skin over the muzzle's top, the
  ears bare), pushed out along their normals by its thickness and skinned as the hide under them, appended to the one
  stream after the cards. `world/horseRig.js` shows each horse's worn shells and hides the rest, in pictures made once
  (`bardingTexels`, `caparisonTexels` - tiling, the caparison's height its skirt to its hem), and dyes the hide's
  picture by the hide's code alone (`horseHideCode`), so a barded horse shares its hide's picture with the bare.

## The four hosts

`scenes/world.js` and `scenes/exterior.js` hand the upkeep its rider (`createUpkeep`'s `rider`), which arms them
astride; the Stable page's acts are the shared provider's (`stableProviderFor`), and the paint and the shells ride the
look wherever a horse is drawn. `scenes/worldModes.js` (interiors) and `scenes/dungeonContext.js` (dungeons) stand no
transport - a building or a dungeon puts the rider on foot - and are named, not wired; the Stable's counter that sells
the barding is `worldModes.js`'s `openYardCounter`, over `yardStock`.

Pinned: `test/bard1_barding.test.js`; mutants `tools/mutants/bard1.json`.
