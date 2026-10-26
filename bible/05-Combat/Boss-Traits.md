# Boss traits - a hard foe's own rules (BOSS-TRAITS, 2026-10-25)

> The owner, 2026-10-25: "A lot of people are unhappy with the world event restrictions including the regen not working.
> Id like solutions to this alongside possibly implementing boss types that might be shielded, have resistances, curb
> power, etc for more artifical difficulty." Asked where the traits should stand: "Raid leaders", "Elite foes" and
> "Relay bosses".

The world events had made their fights hard by taking the player's ways away - regeneration first (WBX6). EVENT-RULES
gives regeneration back, held (`06-Systems/Systems.md`'s made levels, `systems/courtRules.js`), and these traits put
the difficulty where it can be read and answered: on the foe. Daggerfall Unity has nothing like them - DFU's foes
resist by their career's flags alone (`FormulaHelper.SavingThrow`, `DFCareer` tolerance flags), which stand as they
are beside these. A departure: Ledger A (BOSS-TRAITS).

The law is `src/systems/bossTraits.js`, pure but for the language.

## 1. The traits

| Trait | Its word | Its rule | Its answer |
|---|---|---|---|
| `warded` | Warded | a ward of 30% of its maximum health as it stands (`WARD_SHARE` - a share, so a host's later scaling scales it: AUDIT WORLD-EVENTS L2-4) takes every blow first; 10 s of the game's time after the last blow that touched it (`WARD_REGROW_S`) it grows back whole over 4 s (`WARD_REFILL_S`) | keep hitting it |
| `flameproof`, `frostproof`, `venomproof`, `stormproof`, `spellproof` | Flameproof ... Spellproof | a spell of its element lands a quarter of itself (`RESIST_SHARE`) | change the spell |
| `bladeturning` | Blade-turning | a blade or an arrow lands half (`WEAPON_RESIST_SHARE`) | a blunt weapon, or your fists |
| `stoneskin` | Stoneskinned | a blunt weapon or a fist lands half | a blade |
| `curbing` | Curbing | no blow takes more than 5% of its health (`CURB_SHARE`) - the power curb: a big hit is curbed, the fight is many blows | many quick blows, many fighters |
| `wrathful` | Wrathful | 75 s of the game's time after a PLAYER's first blow on it (`WRATH_AFTER_S`) it hits 1.6 times as hard (`WRATH_X`), said once - turned on its own tick, struck or not; a fight no player has struck for 30 s (`WRATH_COOL_S`) is over and its clock starts again (AUDIT WORLD-EVENTS L2-5) | kill it first |
| `thorned` | Thorned | a fifth of every weapon blow that lands on it (`THORN_SHARE`) comes back at its striker | spells, or a healer |

The two weapon resistances never stand together (`rollBossTraits`; a mask off the wire is trimmed as it is read -
`bossTraitsOfMask`: one trait an elite, two a raid's leader, never the pair, AUDIT WORLD-EVENTS L2-11). A kill (a
Disintegrate, a Razor's whole-health strike - AUDIT PSCALE1 DOORS-1) is no blow, nor is a fall or a SetHealth(0) (AUDIT
WORLD-EVENTS L2-5, L2-10): no trait touches them.

The traits' clock is the game's (`tickBossClock`, `bossClockS`): each pool's frame ticks it with its own frame time, so a
pause holds the ward's regrowth and the wrath (AUDIT WORLD-EVENTS L2-5 - it ran on the wall clock).

## 2. Where each trait is answered

A trait that needs the striker's weapon or spell (the resistances) or hurts the striker (the thorns) is answered on the
STRIKER's machine - `bossStrike`, before a blow on a puppet goes to its owner. A trait that keeps state (the ward, the
curb on what is left, the wrath's clock) is answered on the OWNER's - `bossTake`, where the foe's health is, and for a
player's BLOWS alone (`blow`, `mine`). A foe of my own is both. So a peer's blow on my foe is resisted on the peer's
machine (its weapon is there) and warded and curbed on mine. The traits answer THE PLAYER's blows (AUDIT WORLD-EVENTS
L2-12): a companion's, a watchman's or another foe's blow takes no striker's half - a departure of degree, written here.

A spell keeps its element to the owner (AUDIT WORLD-EVENTS L2-1 - a peer's strike spell and its reflection lost it); a
relay boss's damage-over-time rounds and Open Hand's owed blows are resisted as the blow they follow (L2-2, L6-6); and the
floating number of a resisted blow is retold as what landed, tagged Resisted (`ui/hitNumbers.js retellHit`, L2-13).

| Host | Wired |
|---|---|
| `scenes/world.js` | the world host stands no traited foe of its own - every street, wild and interior foe is `exteriorFoes.js`'s pool, wired there; it wires the pool and the traits' save (`exteriorFoes` record) and nothing more |
| `scenes/exteriorFoes.js` (the street, the wilds, the interiors' pool) | `damageFoe`: the striker's half (`scenes/foeTraitsHost.js strikeTraits`) before the puppet's divert, the owner's half before the shield pool (beside STAR5's circle ward), the wrath and the ward's break said; the record's `bt`, `bw`, `bv`, `rl` and their share of its change key; an adopted foe's ward stood; the traits saved and restored (AUDIT WORLD-EVENTS L2-9) |
| `scenes/dungeonContext.js` | `damageFoe`: the same two halves; the record's fields through `scenes/foeTraitsHost.js` (`traitWire`, `readTraitWire`, `traitsAuthority`, `traitsFrame` - HOST-SPLIT: the host calls, the module holds); its own lane's elites seeded and their puppets elite (L2-3); the relay bosses' stand-ins (`gateBossBody`, `swingOnBoss`, a shaft's `dealDamage`) and the Spire's lords (`hostLordTraits`, L5-4) |
| `scenes/gate/standInSpell.js` | a spell on a stand-in, and each of its rounds: its element resisted before its number goes |
| `scenes/worldModes.js` | the interiors' pool is `exteriorFoes.js`'s own and wired there; the host itself needed nothing |
| `scenes/exterior.js` | the fixed-city bench stands the same pool - wired through it |

## 3. Who carries traits

- **Elite foes** (`systems/eliteFoes.js` `promoteEliteFoe`): one trait each. In the open world the foe's owner draws it
  (THE ENGINE-PRNG RULE's Math.random) and the foe's record carries it to every puppet (`bt`, below); in a dungeon the
  pick's own seeded stream draws it (`pickDungeonElites` - the dungeon's location id and the foe's index), so every
  client stands the same elite with the same trait.
- **Raid leaders** (RAID5's assault, `03-World/Raiding-Parties.md`): an elite with two traits - those two alone, never an
  elite's own draw beside them - the last foe of the raid, and an elite's loot at its fall (AUDIT WORLD-EVENTS L2-6).
- **The relay bosses** - the Oblivion Gate's lord, the Shattered Hour's Remnant, the Spire's lords and the Valkynaz
  (every body the dungeon host's `gateBossBody` stands, and the Spire's lords through its host-body seam): their health is
  the relay's, so they carry the striker's traits only - one element's proof and one answer to a blow (Blade-turning,
  Stoneskinned or Thorned - `RELAY_BOSS_BLOW_TRAITS`), drawn off a stream seeded by the boss's own name and kind
  (`relayBossTraits`, AUDIT WORLD-EVENTS L2-14 - any two of eight drew two proofs a third of the time), the same on every
  machine. They are never Warded, Curbing or Wrathful: their wards, phases and caps are the relay's, unchanged. The traits
  are said once when the fight is met ("Valkynaz Ruhn: Flameproof, Thorned.").
- The Sky-Ketch's Warden is fought through its own deck host (`scenes/ketch/ketchFight.js`): FLAGGED in
  `scenes/ketch/ketchFight.js`, no traits yet.

## 4. Seen

- **The title** (`systems/foeTitle.js`, a leaf): the first trait's word with the rest, composed in the player's language
  (`bossTraits.title` - "{trait} {name}", AUDIT WORLD-EVENTS L5-12) - "Warded Elite Orc" - stamped on the entity as
  `bossTitle` when the traits are given, so the leaf reads a string. The target frame's own title leaves it out (its
  traits stand under the name already).
- **The target frame** (`ui/hud/hudFoeTarget.js` `foeTarget`, `ui/enhanced/enhancedHud.js`): every trait's word under
  the name, each trait's rule on hovering it (AUDIT WORLD-EVENTS L5-6), and a ward's fill over the health while it stands -
  a puppet's as its owner holds it (`bv`).
- **Taught once** (`bossTraitsTaught`): the first time this player meets a trait its rule is said ("Warded: a ward takes
  every blow first ..."), once a session.

## 5. On the wire

`net/wire.js validFoeRecord`: `bt` the traits as a mask over `BOSS_TRAITS` (append only - `FOE_TRAITS_MAX`, pinned
equal to `BOSS_TRAIT_MASK_MAX`), `bw` 1 while wrathful, `bv` the ward's share standing (0-100, AUDIT WORLD-EVENTS L2-7)
and `rl` 1 for a raid's leader (its size and its name at every reader - RAID5) - `bw` and `bv` in the record's change key
in both pools, so a blow the ward took is sent (it moved no health). A puppet takes them only as an elite (its `z`), so a
forged mask stands nothing on a plain foe. The relay reads none (it counts a foes frame's records and nothing else) - its
version moves because `wire.js` is in its bundle.

## 6. Pins

`test/systems/bosstraits.test.js` (the law: each trait run, the halves, the mask, the roll, the words);
`test/scenes/bosstraits_hosts.test.js` (the doors, by source and run through the real pool); `tools/mutants/bosstraits.json`;
the audit's: `test/scenes/auditwe_traits.test.js`, `tools/mutants/auditwe_traits.json` (`01-Overview/audits/Audit-World-Events.md`).
