# The PvP rework

The owner's rework of every fight between players (2026-10-28): a duel, the Wild Zone and a siege. Daggerfall Unity has
no PvP, so all of it is a departure; the overhaul's armour (`pcaao.js:"export function pcaaoPartKept("`) is the one
reference it reads. It ships in stages; this page holds what is built.

## Stage 1: the fight's numbers (relay world280)

- **PVP-HEALTH.** The referee's pool is the player's real maximum health, reported on the `vit` frame (`x`) and held to
  `refereeHealthShare.js:"export const PVP_HEALTH_MAX = 3000;"`. In a fight a rising maximum adds no health.
- **PVP-HIT** (the owner: "so let cap at 45%", "so its 3 hits"; the triangle's 34%, still three hits). One blow or cast
  takes at most 34% of the whole (`siegeRef.js:"export const PVP_HIT = Object.freeze({ share: 0.34 });"`). BAL8's 180 in 5 s is retired; the swing law
  and `siegeRef.js:"export const PVP_CASTS = Object.freeze({ max: 19, windowMs: 10_000 });"` pace a fight.
- **PVP-HEAL.** For 30 s after a player's blow, all heals together restore 25% of the whole a 15 s, plus 1% for each 20
  Restoration past 100, to 35%. A duel heals under that cap; a siege still blocks heals by report.
- **PVP-SCALE.** A player's blow scales with the weapon's climb and gear percent (`wp`), and skill reads to 1,000.
- **PVP-SPELLS.** A spell at a player uses its first effect: Damage or Drain, or a heal.

## PVP-GUARD: armour against a player's blow

The striker rolls against a neutral stand-in, so the struck player reports what its armour lets through: the overhaul's
row for each kind of blow (edged, blunt, unarmed), its condition and the natural resistance, averaged over the body
parts as a blow picks them, a shield's block left out (`pvpGuard.js:"export function pvpArmorKept("`). The report
carries the three shares (`g`); the referee holds each to 10..150 and takes that share of the blow before PVP-HIT's cap
(`refereeHealthShare.js:"export function guardedBlow("`). Bare at 50s is 100; Daedric plate keeps 34, 40 and 30, and 14,
20 and 10 at 100s. The client is trusted for its own armour as it is for its health share. Guard powers (loot, sets,
the sky) are not read yet.

## PVP-WARD: resistances against a player's spell

A cast carries its spell's element (`el`, DFU's 0-4: fire, frost, poison, shock, magic;
`siegeCombat.js:"export const pvpSpellElement = (sp) =>"`). The struck player reports, per element, what its Resist
effects let through, then its own saving throw - race, Willpower and gear, as a monster's spell meets it - summed over
the dice (`spellcast.js:"export function savingLands("`; `pvpGuard.js:"export function pvpWardKept("`, the report's
`w`). The caster's stand-in rolls no save. The referee holds each share to at least 15 - the owner's "85% resist", immunity included - and
takes it before PVP-HIT's cap (`refereeHealthShare.js:"export function wardedCast("`).

## PVP-TRIANGLE: archer over mage, mage over warrior, warrior over archer

The owner's triangle (2026-10-29: "tune it to 55% win", "just barely"), from a sim of the PvE overhaul's builds and gear
by level, its bow on the swing law, with players landing 30-50% of their attacks: the favoured side wins 42-67% at
levels 30-45. A player's arrow at a player is 1.28x, a harmful spell 0.96x; from level 40, as the last gear tiers land,
1.67x and 0.81x (`pvpTriangle.js:"export const PVP_TRIANGLE = Object.freeze("`). A live Shield spell on a player is
reported (`sh`, `pvpGuard.js:"export const pvpShielded = (entity) =>"`), and the referee takes 25% off a swing and 35%
off a shaft (`refereeHealthShare.js:"export const PVP_SHIELD = Object.freeze("`) - the plan's "Shields max 25%". Aim and
movement decide the rest; staff fights tune these numbers.


## PVP-BUFFS: a buff runs a minute in a fight

The plan's "buffs last 1 min": each frame a refereed fight may hold the player (the health mirror's `active`), a spell
effect it cast for itself is cut to `pvpBuffs.js:"export const PVP_BUFF_ROUNDS = 12;"` magic rounds - a round is a game
minute, five seconds at DFU's 12x. A worn item's effect (`heldItem`) and a foe's harm are left whole
(`pvpBuffs.js:"export function capPvpBuffs("`). A departure: DFU has no PvP.
