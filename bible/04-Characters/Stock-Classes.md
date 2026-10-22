# The stock classes, revised (CLASS-USE)

2026-10-21, the owner: "Can you update the premade classes to be more useful?"

The eighteen classes the class list offers are DFU's: CreateCharClassSelect (:59-61) loads CLASS00..17.CFG and hands
the player each career as the file has it. Several of those careers spend their skill groups on skills that do little
for the character. CLASS-USE keeps every class's identity and everything else the file gives it, and re-chooses its
primary, major and minor skills by four rules. It also fixes one equipment field. Code: `src/systems/stockClasses.js`.
Pins: `test/systems/stockclasses.test.js`. Mutants: `tools/mutants/classuse.json` (17, all dead with ARENA2; 15 without it, as CI runs - the two left are
the classic skin's art load and the copied restrictions' check against the files, which need the files).

## What was wrong

Read from the shipped CLASS*.CFG:

- **The Barbarian's three majors were Jumping, Running and Swimming.** Its primaries were Blunt Weapon, Long Blade and
  Axe, of which it swings one, so a Barbarian carried four skills it could not use in a fight among its six best.
- **The Acrobat's primaries were Jumping, Dodging and Running**, with Hand-to-Hand its only fighting skill above a
  minor.
- **The Mage and the Sorcerer had identical lists**, with Destruction only a major and two minors spent on Dragonish and
  Daedric. The Sorcerer cannot regenerate magicka and had no weapon above a minor.
- **The Healer's only weapons were minors** (Short Blade, Hand-to-Hand, Blunt Weapon), and its majors were three more
  schools.
- **The Archer's second primary was Hand-to-Hand**, with Axe and Blunt Weapon as majors - for a class that fights at
  range.
- **The Warrior, the Barbarian and the Spellsword had three melee weapons as primaries.** A character swings one, so two
  of its three best skills sat idle.
- **The Ranger spent a primary on Climbing and a minor on Spriggan**; the Monk a major on Swimming; the Bard a major and
  the Knight a minor on Hand-to-Hand.
- **CLASS07.CFG forbids the Burglar leather and chain armour and allows plate.** Its armour bits read 3 (leather and
  chain), where the Mage, the Battlemage, the Nightblade and the Thief read 6 (chain and plate). A burglar could climb a wall in plate and
  not in leather.

## The four rules

1. **A class can fight from the first level:** a primary or major in a weapon its career allows, or in Destruction.
2. **A movement skill (Jumping, Running, Swimming, Climbing) holds a primary or major only where it is the class:** the
   Acrobat's Jumping and Running, the Burglar's Climbing, the Monk's Running, the Barbarian's Running. The others are
   minors, where they still train simply by moving.
3. **No language skill takes a group slot.** Every language is still learnt, as a miscellaneous skill.
4. **A pure fighter's primaries are two weapons and Critical Strike**, which serves whichever weapon it carries: it
   rolls on every attack's chance to hit (`combat/formulas.js` `skillsToHit`) and trains on every connecting swing
   (`scenes/hostCombat.js` `tallySwingSkills`). With three weapon primaries a fighter trained one of them; now its
   weapon and Critical Strike both rise from the same swings, so its level sum (all three primaries count) moves
   faster, not slower, though Critical Strike's own advancement multiplier is 8 to a weapon's 2.

## The revised lists

Primaries; majors; minors. **Bold** marks what changed from the file.

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

The Burglar is forbidden chain and plate instead of leather and chain; its shields and weapons are the file's.

## What did not change

- **Everything else in the career:** attributes, hit points a level, the advancement multiplier, magery, every
  advantage and disadvantage, and every other equipment restriction. The change is to which skills a class trains, not
  to how strong it is, so its multiplier (which prices its advantages) stays right.
- **The reader.** `formats/classFile.js` still reads every byte as DFU does (Port-Doctrine, Scope: readers stay exact);
  the revision is a copy made over its career, and the real-data pin asserts CLASS15.CFG still reads Jumping, Running
  and Swimming.
- **Class enemies.** `characters/enemy/enemyEntity.js` reads its own CLASSnn.CFG for a class foe, and a foe's skills
  come from its level, not its lists.
- **Characters already made.** `systems/save/save.js` keeps the career whole, so a saved character keeps the lists it
  was made with. A player who wants a revised class skill can use SKILL-SWAP.
- **Starting kit and spells.** Both are chosen by class index (`startingGear.js`, `chargen.js` `startingSpells`), not
  by skills.

## Where it is applied

- `systems/chargenSession.js:"career: reviseStockCareer(i, cf.career)"` - `loadCareers`, the list both skins'
  wizards read. The class questions resolve to an index into that list, and legacy births read it (`legacyHost.js`
  `bornResult`), so both get the revision too.
- **A custom class's biography follows the revised classes.** The builder's `classAffinityIndex`
  (`systems/customClass.js`, BiogFile.GetClassAffinityIndex :519-558) picks the biography quiz of the stock class whose
  twelve skills the custom class shares most, and it scores against that same list - so against the revised lists,
  where DFU scores against the files. A departure, and the intended one: the custom class is matched to the classes
  the player was shown.
- `systems/chargenSession.js:"const career = reviseStockCareer(classIndex, cf.career);"` - the headless `?class=N`
  character.
- **The description says the class it describes.** Each TEXT.RSC 2100+n record names the class's six primary and major
  skills. `reviseClassDescription` rewrites that list from the revision - primaries, then majors - keeping the record's
  own words up to the colon and its last row (the "Do you wish" question), and never a row wider than the record's
  widest. The lead-in shares the primaries' row when it fits. The skill names are the player's language's
  (`SKILL_NAMES`) and the two rows' joins are `t('chargen.class.skills.primary')` and `'chargen.class.skills.major'`,
  so a translated TEXT.RSC is rewritten in its own language. It is applied at both skins' seams: `ui/chargenArt.js` `classDescriptionLines`
  (classic) and `ui/enhanced/enhancedChargen.js` `attachChargenText` (enhanced). A record with no colon before its last row
  is shown as it is, with one warning. Both seams are pinned; the classic one through `preloadChargenArt` over the
  real files, so it runs where ARENA2 is.
- **The Roleplay & Realism kit** (`roleplayRealismItems/rriKits.js`, when the mod is on) gives items for each primary
  and major skill, so it follows the revision. Checked over every class: apart from the Acrobat's arrows (below) it hands
  no class a weapon or armour the class may not equip that it did not hand before, and it no longer hands the Burglar
  a helm it could not wear. The Acrobat's Archery brings arrows, which DFU's equip check reads as forbidden to any class with a weapon restriction
  (`equip.js` `weaponProficiencyFlag`, its -1 quirk); arrows are shot from the pack, never equipped, so the Acrobat
  shoots.
- **The armour field's place** (`ARMOR_BITS_SHIFT`, `systems/specialAdvantages.js`) has one home: the builder's write,
  the decode, `equip.js`'s read and this revision all read it.
- **The description box keeps its size.** Measured in the classic box's own fonts (FONT0003, FONT0004), no revised
  row is wider in pixels than its record's widest, and no record is longer than the eight rows the Sorcerer's already
  has.
