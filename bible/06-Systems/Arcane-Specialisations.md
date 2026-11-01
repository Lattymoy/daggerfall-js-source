# Arcane Specialisations

A mage is the schools they master. Once two of the six magic schools are mastered, the player chooses one pair as an
arcane path: fifteen paths, each with a passive and a signature spell only its holder can buy. Past 100, every school
also pays in its own way. The player meets it in the mastery box, on the skill screen, in the pause window's Growth tab
and at the Mages Guild's spell shelf. The weapons' sibling is `05-Combat/Martial-Specialisations.md`.

## How it works

**Who.** A player with Master Skills in force (online always; offline by its switch) and at least two of the six
schools mastered. A school can only be mastered as a career skill, so a class whose career holds fewer than two schools
never meets a path (`pathPossible`); a skill swap can open one.

**The choice** (`src/systems/arcanePaths.js`). Any pair of mastered schools names one path; with three or more mastered,
the player picks among their pairs. The game asks once, on the first quiet pass after the second mastery: a Yes/No box
for one open path, or an OK box pointing to the skill screen for several. After that, the Growth tab lists all fifteen
with their state, what opens each, its passive and its signature spell. The choice holds until given up for 200,000
gold (`SPEC_RESET_GOLD`, `src/systems/specReset.js`); a mastery is never undone.

**Held and awake.** A path is held by the player's own entity with Master Skills in force and both schools mastered;
that prices, teaches and sells its spell. It is awake, and its powers act, while held and not in a refereed fight
(duel or arena). While mentoring, its numbers act at the mentor's power scale. Powers never strike a player: a signature
spell cast at a duel opponent or given to a party mate lands as its plain bundle.

**The schools past 100** (online only). Each point of a school's climb past 100 is 1% more of what that school does, to
x1.4 at 200 (`src/systems/spell/spellPower.js` `schoolPotency`):

| School | What grows |
|---|---|
| Destruction | damage of Damage Health and Continuous Damage Health at a foe |
| Restoration | Heal Health and Regenerate on the player |
| Alteration | Shield strength on the player |
| Illusion | duration of Invisibility, Chameleon and Shadow on the player |
| Mysticism | chance of Silence, Dispel Undead/Daedra and Soul Trap at a foe |
| Thaumaturgy | chance of Spell Reflection and Spell Resistance on the player |

**The fifteen paths.** Each has a passive while awake and a signature spell whose rider acts only for its own holder:

| Path | Schools | Passive | Signature spell |
|---|---|---|---|
| Battlemage | Alteration + Destruction | Spellsteel: damage spells +15% while a Shield holds | Aegis Bolt |
| Trickster | Alteration + Illusion | Slip Away: invisible when hurt below a third | Fleeting Hold |
| Riftwalker | Alteration + Mysticism | Between Moments: casting 20% faster | Rift Lance |
| Warden | Alteration + Restoration | Steadfast: 1% health a round while shielded | Living Aegis |
| Wardwright | Alteration + Thaumaturgy | Attuned Wards: those schools' spells 20% cheaper | Prismatic Ward |
| Shadowcaster | Destruction + Illusion | Unseen Strike: damage spells +25% while hidden | Shadow Bolt |
| Spellbreaker | Destruction + Mysticism | Sunder: foes' saving throws 10 lower | Unravel |
| Bloodmage | Destruction + Restoration | Sanguine Tide: more damage as health falls, to +25% | Blood Boil |
| Elementalist | Destruction + Thaumaturgy | Conflux: stacking spell damage, to +15% | Chain Lightning |
| Seer | Illusion + Mysticism | Foresight: one foe blow in eight lands nothing | Psychic Lance |
| Lightbringer | Illusion + Restoration | Dawn's Ward: +20% against undead and daedra | Dawnbolt |
| Enchanter | Illusion + Thaumaturgy | Glamour: +10 Personality, +15 Etiquette and Streetwise | Beguile |
| Necromancer | Mysticism + Restoration | Death's Due: a kill returns 5% health and magicka | Siphon Life |
| Soulbinder | Mysticism + Thaumaturgy | Soul Well: a kill returns 10% magicka, 20% if soul-trapped | Soul Lance |
| Hierophant | Restoration + Thaumaturgy | Absolution: a quarter health back when hurt below 30% | Sanctify |

Every number is a constant in `PATH_NUMBERS`, and every spell's slots in `PATH_ROWS`.

**The signature spells** (`src/systems/signatureSpells.js`). Ready-made spell records in the classic shape, three effect
slots, indexes -46101 to -46115, never craftable. The Mages Guild's (and a temple's) Buy Spells offers a path's spell
only to its holder, at the shelf's price. Held, it is priced and taught by its path's two schools (`spellcost.js`
`castSchool`), so casting it trains the pair. On the wire it travels as any spell and lands without its rider.

**The judge** (`server-account/src/judge.js` `characterFindings`, code `path`). A save's `arcanePath` must name a path
whose two schools are both in its `masteredSkills`. Signature spells are not judged.

## Rules

- **The pair is chosen once, among mastered schools** (the owner); reset costs 200,000 gold (the owner).
- **Signature spells, a passive, and school perks past 100** (the owner); **below 100, schools stay as they are**
  (the owner).
- **One arcane path beside one martial path** (the owner).
- **The masteries themselves are not judged online** (the owner): a save from before masteries existed can hold skills
  past 100 with no mastery listed.
- **Offline, schools past 100 stay Daggerfall's**; the paths work offline with Master Skills on.
- A path's percent onto damage spells sums with the loot's (the loot's own capped at 50, a path's at most 25); no path
  heal or magicka passes its maximum.

## Daggerfall Unity

DFU has no specialisations, signature spells or school perks. Every school reaches 100 on any mage, the Mages Guild
sells every SPELLS.STD record to everyone, and the spell maker makes any three effects. All of this is the game's own,
built so a mage's mastered schools change what they play, not only a price.

## Code and tests

- `src/systems/arcanePaths.js` - the paths, their numbers and words, the choice, held and awake, the judge's check
- `src/systems/arcanePowers.js` - what the paths do, through the spell power, cost, cast speed and hurt seams
- `src/systems/signatureSpells.js` - the signature spell records
- `src/systems/effects.js`, `src/systems/spell/spellPower.js` - the schools past 100
- `src/scenes/hostMagic.js` - the one cast engine every host uses
- `server-account/src/judge.js` - the path finding
- `test/systems/audit_schools.test.js` - every number on both sides of its line

## Open

- The numbers are a first cut, each one constant and one pin.
- Powers' memory (recoveries, stacks, windows) belongs to the session and outlives a character switch by its seconds.
- In a siege or the Wild Zone, opponents' blows land on the referee's bar, so no defensive passive reaches them.
- The classic skill sheet's S row waits on DFU's spellbook key, which the classic sheet does not wire yet.
