# Revenants

A revenant is a special foe that killed the player, or broke and got away, and comes back later under a name of its
own, stronger, with better loot, and tells the player it remembers. Beaten, it kneels, and the player kills it for a
trophy or spares it as a sworn companion. This is the game's own system; Daggerfall has none. Its memory, weakness,
band, lair and loyalty are on `12-Enhanced-AI/Feud-Arc.md`.

## How it works

**Who can rise.** A special foe (an elite, a champion, or a revenant already) of level 3 or more, never the city watch,
an ally, a quest's foe or an event's own foe (`revenantCandidate`). Only a foe carrying the Unquiet mark rises: one
special foe in four, drawn by hash on the foe's id and shown in its title ("Unquiet Elite Orc";
`src/systems/revenant/unquietMark.js`). No mark is drawn while three revenants hunt the player. With the Loot rarity
row off, nothing here happens; online, a character under Renown 10 has none.

**Two deeds make one.**
- **Slew**: its blow, or the harm it last landed (a spell, a lingering effect, a poisoned weapon), takes the player's
  last health (`src/systems/harmMark.js`). A death Stendarr's mercy undoes makes no revenant.
- **Fled**: under its flee line for the first time it rolls to run, at twice its walk (2.5 for a marked foe), for 8 s.
  A marked foe breaks at 35% health on one roll in two; a young revenant (under rank 2) at 35% on four in five; an older
  one at 20% on 35%. Out of reach at the end, it escapes. Run down within 12 m, it is cornered and fights to the end.

**What it becomes.** A record per character: a given name from DFU's name banks (drawn on DFRandom seeded by its id,
the shared seed restored), an epithet by its deed, a rank 1 to 5 that rises with every deed, a personality and an
ambition (vengeance, mastery or plunder). At most three hunt the player at once.

**Its return.** It is due two to four days later on the character's own clock (sooner for vengeance). A due revenant
takes 40% of open-world encounter rolls, one out at a time, highest rank first. It stands with its old glow and trait,
then +40% health, +15% blows and, for a class foe, +3 levels a rank. Within 25 m and in sight it taunts once, naming
its last deed and the player; a beast bares its teeth. Gone unfought (outrun, a load), it comes again in six hours.
Between returns it heals one wound every five days, and a revenant of mastery trains against the player's habits.

**Its drop**, over its kind's own loot: gold of level x rank x 15-40, a Magic piece half the time, a Rare at 15% plus
10% a rank (always from rank 3), a Legendary at 3% plus 3% a rank (`REVENANT_LOOT`).

**Beaten, it yields.** The blow that would kill one of the player's revenants leaves it kneeling at 1 health. The player
chooses in the loot window:
- **Kill**: an execution (a burst of blood, the body burning away in embers) and a pile with everything it carried and
  a trophy weapon of its kind bearing its name, at a random rarity (`revenantTrophy.js`). Its record closes for good.
- **Spare**: it rises into a portal and is sworn to the player for good, fighting beside them as a crew companion
  does (`revenantCompanions.js`). Up to six are kept; companions arrive and leave through a violet portal.

**The sworn.** A sworn revenant wears gear the player gives it in ten slots (`revenantGear.js`). Its weapon is a melee
one, Dagger to War Axe or Roleplay & Realism: Items' Light Flail and Archer's Axe while that mod registers them
(`meleeWeapon`), never a bow: a foe's archery is its kind's. It may carry one of six arts born with it (35% of
revenants: mending, warding, warcry, siphon, barrage, nova; `revenantArts.js`), may be sent on a timed errand to any of
Tamriel's provinces to bring back loot, materials or gold (`revenantErrands.js`), and grows its own sky of stars to
level 20 (`revenantStars.js`, drawn in the sky window).

**Keeping.** The record lives in the save's per-mod slot `Revenant` and in app storage `dagger.revenant.<characterId>`
(an offline death saves nothing, and a death is what makes one), merged per record by revision. The page keeps the
newest 12 slain; older ones become tombstones (at most 200) so an older save never raises them.

**Online.** A revenant is its character's own. A returning one streams like any foe the player owns, with its name on
the wire (`src/net/wire.js` `validFoeRecord`, at most 64 characters). Another player's revenants are puppets, hidden
with their owner when the crowd setting leaves that player undrawn.

## Rules

- **Kill or spare, in the loot window** (Mac); a kill shows its own execution and drops a named trophy weapon (Mac);
  spare makes a companion on the crew's companion layer, in limited slots (Mac).
- **Flight first** (Mac): a revenant grows mainly by getting away, not by the player's death
  (`src/systems/revenant/revenant.js` `REVENANT_FLEE_HEALTH_YOUNG`, `REVENANT_FLEE_CHANCE_YOUNG`).
- **The Renown gate** (the owner): online, revenants wait for Renown 10; offline unchanged (`REVENANT_MIN_RENOWN`).
  Return chance 40% (`REVENANT_RETURN_CHANCE`).
- **Harder, rarer, more flight** (the owner): the mark (`UNQUIET_MARK`), three at most (`REVENANT_MAX`), two to four
  days, the rank's weight (`REVENANT_HEALTH_PER_RANK`, `REVENANT_DAMAGE_PER_RANK`, `REVENANT_LEVEL_PER_RANK`).
- **Gear, arts, errands and stars must be balanced** (the owner).
- **Names**: the system and everything in it are called revenants (Mac).
- An event's own foe (a Starfall master, a staff event's boss, a rite's faithful) never rises (`unquietMark.js`
  `isEventFoe`).

## Daggerfall Unity

DFU has no revenants. The pieces it lends are DFU's own: the name banks (`NameHelper`), DFRandom, the elite and
champion foes it stands on, and the encounter roll it takes a share of. Every rule above is a departure.

## Code and tests

- `src/systems/revenant/revenant.js` - the record, its deeds, return, drop and keeping
- `src/systems/revenant/unquietMark.js`, `revenantUnquiet.js` - the mark, ambitions, wounds, the hunt
- `src/systems/revenant/revenantFate.js`, `revenantTrophy.js`, `revenantCompanions.js` - yield, kill, spare
- `src/systems/revenant/revenantGear.js`, `revenantArts.js`, `revenantErrands.js`, `revenantStars.js` - the sworn
- `src/systems/revenant/revenantFeud.js`, `revenantVoice.js`, `revenantPersonality.js` - memory and voice
- `test/systems/revenant.test.js` - the record and its deeds
- `test/systems/revenant/rvngear.test.js`, `test/net/smithrri.test.js` - the sworn's gear, the mod's two weapons in it
- `test/systems/rvn11c_betray.test.js` - betrayal; the FEUD tests are listed on `12-Enhanced-AI/Feud-Arc.md`
