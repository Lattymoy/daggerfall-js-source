# The Battle Pass - Season One: Dwemer's Breach (STOREFRONT)

> Design page and record (2026-10-29), beside `06-Systems/Storefront.md`. Where the page and the code disagree, the
> code's headers and the pins are what runs. Not a DFU member: Daggerfall Unity has no seasons, accounts or passes
> (Port-Ledger section A, STOREFRONT).

## 1. What was asked

The owner, 2026-10-29, with a developer's notes from the Discord: *"Battle Pass should not be just a Battle Pass. It
should be thematic Battle Pass like a 'Dwemer's breach'. And the whole world should change a little in relation to this.
Like new dwemer enemies, new boss, new weapon"*; *"Battle Pass is the MOST profitable but at the same time MOST DANGEROUS
in terms of outflow of players"*; *"booster to boost your BP progression. Maybe run a test BP for a 2 months (like 10
November to 10 Jan) ... and divide the Battle Pass into 3 stages (20 days each)"*.

The pass card: a Premium Pass at $29.99 with a fifty-level track, and a Deluxe at $49.99 with everything in Premium and
its own rewards unlocked at once.

## 2. The season

**Dwemer's Breach**, 10 November 2026 to the end of 8 January 2027, UTC: sixty days in three stages of twenty
(`src/net/battlePassLaw.js` PASS_SEASONS). The Bay shakes; old Rourken works under High Rock and Hammerfell crack open to the
sky, and brass comes up out of them.

| Stage | Days | Levels open | The world |
| --- | --- | --- | --- |
| I. The Tremor | 10 Nov - 29 Nov | 1-17 | the ground shakes; two Brass Fissures open in each region's wilds; Spheres and Iron Golems climb out |
| II. The Brass Halls | 30 Nov - 19 Dec | 18-34 | three Fissures a region; Steam Centurions walk with them |
| III. The Heart Wakes | 20 Dec - 8 Jan | 35-50 | each region's Heart Fissure wakes the Brass Colossus |

A level past the open stage's top is banked: its experience is kept and counts the day the next stage opens. So a player
who plays hard is never more than a stage ahead of one who plays a little, and every stage is news for both.

## 3. The track

Fifty levels of 1,000 experience each. **The free track** is every registered account's. **The premium track** opens
with the Premium Pass or the Deluxe; a premium reward reached before the purchase is given at once. Every reward is the
account's for good, on every character, held from the level reached - read off the row at every ask (ACC3's law), never
a letter to claim.

| Level | Free | Premium |
| --- | --- | --- |
| 1 | Centurion Helm (portrait) | Aetherium Shard (portrait) |
| 5 | | Tonal Fork (glyph) |
| 10 | Brassbound (title) | Dwemer Lexicon (portrait) |
| 15 | | Tonal Architect (title) |
| 20 | Dwemer Cog (glyph) | Brass Spider (portrait) |
| 25 | | Tonal Shatter (kill effect) |
| 30 | Dwarven Sphere (portrait) | Brass Colossus (portrait) |
| 35 | | Brasswright (title) |
| 40 | Tremor-Born (title) | Brass Gate (portal skin) |
| 45 | | Gearheart (portrait) |
| 50 | Numidium (portrait) | Aetherium Coil (aura), Heart-Waker (title) |

**The Deluxe Pass** gives the premium track, five levels at once, and its own three: the Gilded Coil (an aura), the
Brass Automaton (a mount look) and Echo of Numidium (a title on an animated brass plate).

## 4. Experience

The account service holds each account's season experience (`players.pass_s1`, migration 0193) and decides every find
(`server-account/src/battlePass.js`), as it decides a Soul Cake: the page asks with a deed's source, the service answers.

| Source | Experience |
| --- | --- |
| a foe my blow killed; the dead and the summoned | 12; 15 |
| an elite or a champion | 60 |
| a Dwemer construct (the season's) | 40 |
| gathering; making; the loot's laws | 8; 12; 10 |
| a tavern game won; the sea | 50; 40 |
| a world event; a quest done; a bounty paid | 120; 150; 150 |
| the endgame (a breach closed, a Redoubt, the Serpent, a star held) | 300 |

A UTC day takes 2,000 experience before a booster's share and 2,000 asks. **The challenges**, five a stage, count their
deeds while their stage is open and pay once, beside the day's bound: 6,800 in the first stage, 8,500 in the second,
10,000 in the third. A steady hour a day reaches level 50 by the season's end without a booster.

## 5. Boosters

The developer's "booster to boost your BP progression", sold as the sheet's three EXP Booster prices. A booster is the
season's: its share of every find's experience for the rest of it, and levels at once. The highest held counts, never
their sum. The share is on top of the day's bound, so it speeds every player.

| Booster | Price | Share | At once |
| --- | --- | --- | --- |
| Cog Booster | $4.99 | +25% | - |
| Tonal Booster | $12.99 | +50% | 3 levels |
| Heart Booster | $24.99 | +100% | 8 levels |

## 6. The world

`src/scenes/seasonHost.js`, on the bindings the world host shares with the Starfall's host; its law is
`src/systems/pass/seasonWorld.js`. Online alone, as the season is.

- **The tremor.** The first six seconds of every hour on the shared clock, in the open world: the camera kicked every
  350 ms under the player's own shake cap, swelling and dying away, harder each stage (1.5, 2.5, 4 - a gun's shot is 3);
  a rumble (`fx-season-tremor`), dust and grit shaken up about the feet, and the stage's line in the event board's news,
  a kind of its own (`season`, news alone, as the festival's).
- **Brass Fissures.** Two to each Bay region in the first stage, three in the second and third, on pixels the Oblivion
  Gate's scan finds suitable (land, no place near, a town close), drawn by hash from the season, the stage and the
  region, four pixels apart: every machine finds the same. A fissure gives way to the day's gate on its pixel or beside
  it. World of Daggerfall's rock keeps 26 m off it, and the grass off its scorch. On the map each is a brass cog crossed
  by a blue crack, a Heart Fissure's larger and ringed, its card naming its town and what waits there.
- **A fissure, built** (`world/fissureModel.js`, its art `fissureArt.js`, pseudo-archive 38341): a scorched oval
  on the land, the crack's black depths with the aetherium's blue in them, short cracks off it, slabs of earth heaved up
  along both lips; round it a toothed cog past each end and one off the south lip, a split copper pipe, and a fallen
  brass pillar with its capital - the Sky-Ketch's metals. The slabs and wreckage are solid. Its three vents breathe
  steam, its blue lights the ground, and its hum (`fx-season-hum`) is heard beside it.
- **The constructs.** Each fissure's camp is Daggerfall Enemy Expansion's: the Centurion Sphere (289), the Iron Golem
  (270) and, from the second stage, the Steam Centurion (290) - Ketch's KT_LOOKS, on the surface. The first player
  within 90 m springs it on the camp law (`px,py:brass.<stage>.<k>`, reader-checked - no relay change); every other
  screen sees the owner's. One woken wakes the camp. Each is a find of 40. Cleared, a fissure is quiet for that
  character twenty minutes.
- **The Brass Colossus.** In the third stage each region's first fissure is its Heart Fissure: two Spheres and a Golem,
  and at the middle a Steam Centurion made a raid leader (half again its size, an elite's health and blows, its name),
  three times that health, and Warded, Stormproof and Blade-turning - bring a hammer. Every screen names it by its site
  (`.h`); its bar stands while it is near. A character whose blow landed on it takes **the Resonant Maul** when it
  falls, once a UTC day.
- **The Resonant Maul** (`src/systems/pass/resonantMaul.js`). A Dwarven warhammer of the Legendary rung: +30% damage, +12
  Strength, +25 Blunt Weapon, Resist Shock while held, and Resonance - +40% against the season's constructs, a bane under
  Dragonsbane's 50, inside THE CEILING HOLDS. **Unrolled**: lawful wherever the item law reads it (the account service's
  judge included), but no warhammer's roll lands on it, so every seeded roll draws from the pool it drew from before.

**Departures from the first draft.** Daggerfall Enemy Expansion has no brass spider (271 is the Blood Spider; the Ketch's
spider is a classic mobile tinted, and the surface has no tint), so the first stage's second construct is the Iron Golem.
The Colossus is not washed in brass for the same reason: its size, name, traits and bar say what it is.

## 7. The window

The shop's first section is the pass: the season's name and its stage, the days left, the level and the bar to the next,
the fifty levels in two rows (free above, premium below) with each reward drawn in its own paint, the stage's
challenges with their counts, and the pass's three buys and three boosters. A level reached is said once on the screen
with its rewards.
