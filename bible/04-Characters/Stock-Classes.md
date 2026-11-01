# Stock Classes

The eighteen premade classes offered at character creation are DFU's (CLASS00..17.CFG), with their primary, major and
minor skills re-chosen so every class is useful from the first level. Everything else each file gives the class stays.
The player meets it in both chargen skins' class list and in each class's description.

## How it works

- `reviseStockCareer` (`src/systems/stockClasses.js`) copies the file's career and puts in the revision's skill lists
  (`STOCK_CLASS_REVISIONS`) and, for the Burglar, its armour. The reader (`src/formats/classFile.js`) still reads every
  byte as DFU does.
- It is applied where careers are loaded for chargen (`loadCareers` in `src/systems/chargenSession.js`), so both skins'
  wizards, the class questions, legacy births and the headless `?class=N` character all get it.
- `reviseClassDescription` rewrites each class's TEXT.RSC description (records 2100+n) to list the revised primaries
  and majors, in the player's language, keeping the record's own lead-in and closing question. Both skins apply it
  (`classDescriptionLines` in `src/ui/chargenArt.js`, `attachChargenText` in `src/ui/enhanced/enhancedChargen.js`).
- A custom class's biography quiz is matched (`classAffinityIndex`, `src/systems/customClass.js`) against the revised
  lists, the ones the player was shown.

## Rules

The owner asked for the premade classes to be more useful. Four rules choose the lists:

1. A class can fight from the first level: a primary or major in a weapon its career allows, or in Destruction.
2. A movement skill (Jumping, Running, Swimming, Climbing) is a primary or major only where it is the class: the
   Acrobat's Jumping and Running, the Burglar's Climbing, the Monk's and the Barbarian's Running.
3. No language skill takes a group slot; languages are still learnt as miscellaneous skills.
4. A pure fighter's primaries are two weapons and Critical Strike, which rolls on every attack
   (`skillsToHit`, `src/combat/formulas.js`) and trains on every connecting swing.

The Burglar is forbidden chain and plate, where its file forbids leather and chain.

Unchanged: attributes, hit points a level, the advancement multiplier, magery, advantages and disadvantages, every
other equipment restriction, class foes (which read their own file), saved characters (which keep their career), and
starting kit and spells (chosen by class index).

## The lists

Primary; major; minor. **Bold** marks a skill that differs from the file.

| # | Class | Primary | Major | Minor |
|---|---|---|---|---|
| 0 | Mage | **Destruction**, Alteration, Mysticism | Illusion, **Thaumaturgy**, Restoration | Medical, Short Blade, Blunt Weapon, Dodging, **Etiquette, Mercantile** |
| 1 | Spellsword | Long Blade, **Restoration, Alteration** | **Axe, Blunt Weapon**, Destruction | **Illusion**, Thaumaturgy, Mysticism, Short Blade, **Dodging**, Archery |
| 2 | Battlemage | Destruction, Long Blade, Axe | Thaumaturgy, Alteration, **Restoration** | Illusion, Mysticism, **Dodging**, Archery, Short Blade, Blunt Weapon |
| 3 | Sorcerer | **Destruction**, Mysticism, Alteration | **Thaumaturgy**, Illusion, **Blunt Weapon** | **Restoration**, Short Blade, Dodging, Medical, **Mercantile, Streetwise** |
| 4 | Healer | Restoration, Medical, Dodging | **Blunt Weapon**, Alteration, Mysticism | **Thaumaturgy, Destruction**, Illusion, Etiquette, Streetwise, Short Blade |
| 5 | Nightblade | Illusion, Stealth, **Short Blade** | **Destruction, Backstabbing, Dodging** | Alteration, **Thaumaturgy**, Critical Strike, **Lockpicking**, Restoration, **Mysticism** |
| 6 | Bard | Etiquette, Streetwise, **Short Blade** | **Illusion, Mercantile**, Stealth | **Pickpocket**, Lockpicking, Alteration, Restoration, Destruction, Archery |
| 7 | Burglar | Lockpicking, Stealth, **Short Blade** | **Climbing, Backstabbing**, Dodging | Critical Strike, Pickpocket, **Mercantile**, Streetwise, **Archery**, Running |
| 8 | Rogue | Long Blade, Stealth, Dodging | Pickpocket, Backstabbing, Streetwise | Critical Strike, **Short Blade**, Lockpicking, **Archery**, Blunt Weapon, Running |
| 9 | Acrobat | Dodging, Jumping, **Short Blade** | **Running, Archery**, Stealth | **Climbing, Hand-to-Hand**, Critical Strike, Backstabbing, Pickpocket, Swimming |
| 10 | Thief | Pickpocket, Stealth, Short Blade | Backstabbing, Lockpicking, **Dodging** | Critical Strike, **Climbing**, Running, Streetwise, Mercantile, **Archery** |
| 11 | Assassin | **Short Blade**, Critical Strike, Stealth | **Backstabbing**, Long Blade, **Archery** | Dodging, Lockpicking, Climbing, Pickpocket, **Streetwise, Blunt Weapon** |
| 12 | Monk | Hand-to-Hand, Critical Strike, Dodging | Medical, Blunt Weapon, **Running** | Archery, Short Blade, **Stealth**, Jumping, Climbing, **Swimming** |
| 13 | Archer | Archery, Dodging, **Critical Strike** | **Short Blade, Long Blade, Stealth** | **Axe, Blunt Weapon, Hand-to-Hand**, Running, Climbing, Swimming |
| 14 | Ranger | **Archery**, Long Blade, **Stealth** | **Axe**, Critical Strike, **Dodging** | **Climbing, Swimming**, Running, **Medical**, Short Blade, Blunt Weapon |
| 15 | Barbarian | Axe, Blunt Weapon, **Critical Strike** | **Long Blade, Dodging**, Running | Medical, Climbing, **Jumping, Swimming**, Archery, **Hand-to-Hand** |
| 16 | Warrior | Long Blade, Axe, **Critical Strike** | **Blunt Weapon**, Archery, **Dodging** | **Short Blade, Hand-to-Hand**, Medical, Climbing, Running, Swimming |
| 17 | Knight | Long Blade, Blunt Weapon, Etiquette | Axe, **Critical Strike, Medical** | **Archery, Short Blade**, Dodging, **Mercantile, Running**, Swimming |

## Daggerfall Unity

DFU's `CreateCharClassSelect` hands each career as the file has it. The revision is a departure in chargen only; the
custom class's biography match scores against the revised lists where DFU's `BiogFile.GetClassAffinityIndex` scores
against the files.

## Code and tests

- `src/systems/stockClasses.js` - revisions, `reviseStockCareer`, `reviseClassDescription`
- `test/systems/stockclasses.test.js` - the lists by the four rules, the Burglar's armour, both description seams, the
  reader untouched
