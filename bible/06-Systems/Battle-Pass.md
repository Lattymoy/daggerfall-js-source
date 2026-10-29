# The Battle Pass - Season One: Dwemer's Breach (STOREFRONT)

> Design page and record (2026-10-29), beside `06-Systems/Storefront.md`. Where the page and the code disagree, the
> code's headers and the pins are what runs. Not a DFU member: Daggerfall Unity has no seasons, accounts or passes
> (Port-Ledger section A, STOREFRONT).

## 1. What was asked

The owner, 2026-10-29, with a developer's notes from the Discord: *"Battle Pass should not be just a Battle Pass. It
should be thematic Battle Pass like a 'Dwemer's breach'. And the whole world should change a little in relation to this.
Like new dwemer enemies, new boss, new weapon"*; *"Battle Pass is the MOST profitable but at the same time MOST DANGEROUS
in terms of outflow of players"*; *"Some theme, some trailer, a new cool weapon or set of armour, unique pet, unique
skin. And of course - booster to boost your BP progression. Maybe run a test BP for a 2 months (like 10 November to 10
Jan) and come up with an idea, furnish the world with appropriate decorations or effects, enemies and dungeons, and
divide the Battle Pass into 3 stages (20 days each)"*. The pass card: a Premium Pass at $29.99 with a fifty-level track,
and a Deluxe at $49.99 with everything in Premium and its own rewards unlocked at once.

## 2. The season

**Dwemer's Breach**, 10 November 2026 to the end of 8 January 2027, UTC: sixty days in three stages of twenty
(`src/net/battlePassLaw.js` PASS_SEASONS). The Bay shakes; old Rourken works under High Rock and Hammerfell crack open to the
sky, and brass comes up out of them.

| Stage | Days | Levels open | The world |
| --- | --- | --- | --- |
| I. The Tremor | 10 Nov - 29 Nov | 1-17 | the ground shakes; Brass Fissures open in the wilds; Spheres and brass Spiders climb out |
| II. The Brass Halls | 30 Nov - 19 Dec | 18-34 | more Fissures; Steam Centurions walk with them |
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

The account service holds each account's season experience (`players.pass_s1`, migration 0192) and decides every find
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

- **The tremor.** Every hour on the shared clock the ground shakes for every player in the open world at once: a rumble,
  the camera's shake, dust off the walls, and a line in the chat. The shakes grow by the stage.
- **Brass Fissures.** A few to each region, in the wilds and off the roads, the same places on every machine (seeded by
  the region and the stage): a crack in the ground venting steam, its lip glowing aetherium blue by night, brass wreckage
  round it - cogs, a split pipe, a fallen pillar - and a hum as you near. Marked on the map while their stage is open.
- **The constructs.** Round an open Fissure the Rourken's works walk: the Dwarven Sphere and the brass Spider from the
  first stage, the Steam Centurion from the second - Daggerfall Enemy Expansion's own constructs (Ketch's KT_LOOKS) on
  the surface. Each is a find of 40.
- **The Brass Colossus.** From the third stage each region's Heart Fissure wakes a Steam Centurion grown to a giant's
  size, washed in brass, a boss with its own traits. Its fall drops **the Resonant Maul**.
- **The Resonant Maul.** A Dwarven warhammer of the Legendary rung with one power, sideways and inside THE CEILING HOLDS:
  Resonance, its blows on a construct a share harder - the Wyrd's Raiment's Tallow-Ward, for brass instead of the dead.

## 7. The window

The shop's first section is the pass: the season's name and its stage, the days left, the level and the bar to the next,
the fifty levels in two rows (free above, premium below) with each reward drawn in its own paint, the stage's
challenges with their counts, and the pass's three buys and three boosters. A level reached is said once on the screen
with its rewards.
