# Characters

The people and monsters of the world, and how bodies are drawn and dressed: the data layer from Daggerfall's files,
the enemy port, the Morrowind bodies the port stands actors in when Morrowind's data is attached, the port's own
models for them, and the cosmetic systems worn on a body. Combat itself is in `05-Combat/`.

## Pages

- `Characters-Arc.md` - People and Foes: standing people, names, dungeon foes, the foe hosts, teams and targets
- `Region-Names.md` - names by culture and region across Tamriel
- `Stock-Classes.md` - the premade classes' revised skill lists
- `Enemy-Expansion.md` - Daggerfall Enemy Expansion, ported, and MUDEX
- `Meaner-Monsters.md` - Meaner Monsters, ported
- `Morrowind-NPCs.md` - every actor in a Morrowind body: lanes, budget, wardrobe, creatures, marks
- `Body-Motion.md` - the Morrowind body's own gait, carry and blows in third person
- `Werewolf-Body.md` - Bloodmoon's werewolf and the Shadow Fang skin
- `Head-Portraits.md` - faces drawn as the Morrowind head
- `Own-Heads.md` - the port's own Breton heads, for players
- `Steel-Plate.md` - the port's own armour: steel plate, ebony plate, brigandine
- `Cloak.md` - the port's own cloak, its fits, and the cape switch
- `Townsfolk-Outfits.md` - each walker sprite's own outfit
- `Layered-Gearing.md` - the sprite body in the armour and weapon it wears
- `Wardrobe.md` - collected looks for gear (transmog)
- `Aura-Armory.md` - cosmetic effects worn on the body's parts

## Rules

- DFU's look is the baseline for every actor; Morrowind bodies stand only with Morrowind's data attached, and fall
  back to DFU's billboard.
- Morrowind's and Bloodmoon's files are the player's own and never ship; the port's own models ship under
  `src/assets/mw/` (`src/systems/ownMwAssets.js`).
