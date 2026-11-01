# Boss Traits

A hard foe's own rules: elite foes, raid leaders and relay bosses can be warded, resist an element or a kind of
weapon, curb how much one blow takes, grow wrathful, or turn blows back. The difficulty sits on the foe, where it can
be read and answered, rather than in taking the player's tools away. The player sees the traits in the foe's title and
under its name in the target frame.

## How it works

- **The traits** (`BOSS_TRAITS`, `src/systems/bossTraits.js`):

  | Trait | Rule | Answer |
  | --- | --- | --- |
  | Warded | a ward of 30% of its maximum health (`WARD_SHARE`) takes every blow first; 10 s after the last blow (`WARD_REGROW_S`) it regrows over 4 s (`WARD_REFILL_S`) | keep hitting |
  | Flameproof, Frostproof, Venomproof, Stormproof, Spellproof | a spell of its element lands a quarter (`RESIST_SHARE`) | change the spell |
  | Blade-turning | a blade or an arrow lands half (`WEAPON_RESIST_SHARE`) | a blunt weapon or fists |
  | Stoneskinned | a blunt weapon or a fist lands half | a blade |
  | Curbing | no blow takes more than 5% of its health (`CURB_SHARE`) | many quick blows, many fighters |
  | Wrathful | 75 s after a player's first blow (`WRATH_AFTER_S`) it hits 1.6 times as hard (`WRATH_X`); a fight no player struck for 30 s resets (`WRATH_COOL_S`) | finish it fast |
  | Thorned | a fifth of every weapon blow that lands comes back at the striker (`THORN_SHARE`) | spells, or a healer |

- **Two halves.** A trait that needs the striker's weapon or spell (the resistances) or hurts the striker (thorns) is
  answered on the striker's machine (`bossStrike`), before a blow on a puppet goes to its owner. A trait that keeps state
  (ward, curb, wrath) is answered on the owner's (`bossTake`), for a player's blows only. Companions', the watch's and
  other foes' blows take no striker's half.
- **The clock** is the game's (`tickBossClock`), so a pause holds the ward's regrowth and the wrath.
- **Who carries them.** Elite foes one trait (`promoteEliteFoe`, `src/systems/eliteFoes.js`; in a dungeon from the
  pick's seeded stream, so every client agrees). Raid leaders and named bounty marks two. The relay bosses (the Gate's
  lord, the Remnant, the Spire's lords, the Valkynaz) carry only striker's traits, one element proof and one of
  Blade-turning, Stoneskinned or Thorned, seeded by the boss's name (`relayBossTraits`). Never Warded, Curbing or
  Wrathful there: their wards and caps are the relay's.
- **Hosts.** `damageFoe` in `src/scenes/exteriorFoes.js` (street, wilds, interiors) and `src/scenes/dungeonContext.js`
  call both halves through `src/scenes/foeTraitsHost.js`; spells on relay stand-ins go through
  `src/scenes/gate/standInSpell.js`.
- **Seen.** The title (`src/systems/foeTitle.js`) leads with the first trait's word ("Warded Elite Orc"); the target
  frame lists every trait's word with its rule on hover, and draws the ward over the health. Each trait's rule is told
  once a session the first time it is met (`bossTraitsTaught`).
- **On the wire** (`validFoeRecord`, `src/net/wire.js`): `bt` the trait mask, `bw` wrathful, `bv` the ward's share, `rl` a
  raid leader. A puppet takes them only as an elite, so a forged mask on a plain foe stands nothing.

## Rules

- Bosses are shielded, resistant and power-curbing for difficulty, on raid leaders, elite foes and relay bosses (the
  owner). Regeneration in world events is given back, held, rather than removed.
- The two weapon resistances never stand together. At most one trait an elite, two a leader, three for the season's
  Brass Colossus (`BOSS_TRAITS_MOST`).
- A kill (Disintegrate, a whole-health strike), a fall or a set to zero health is no blow: no trait touches it.
- The mask is append-only.

## Daggerfall Unity

DFU's foes resist only by their career's tolerance flags (`FormulaHelper.SavingThrow`, `DFCareer`), which stand beside
these. The traits are the port's own departure.

## Code and tests

- `src/systems/bossTraits.js` - the law
- `src/scenes/foeTraitsHost.js` - the hosts' calls and the wire
- `src/systems/foeTitle.js` - the title
- `test/systems/bosstraits.test.js` - each trait, the halves, the mask, the roll, the words
- `test/scenes/bosstraits_hosts.test.js`, `test/scenes/auditwe_traits.test.js` - the doors through the real pool

## Open

- The Sky-Ketch's Tonal Warden carries no traits: its health and blows are the ship's room's
  (`src/scenes/ketch/ketchFight.js`, FLAGGED).
