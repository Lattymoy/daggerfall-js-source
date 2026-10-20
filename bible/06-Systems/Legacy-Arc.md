# THE LEGACY ARC (LEGACY, opened 2026-10-05)

Mac: "So this is actually my DFU mod that I want to integrate ... 1. How to integrate this into online. Allowing
players to choose the perma-death model OR somehow a persistant model ... 2. Fixing any and all current bugs ...
3. ... World Influence. Impact the world of Daggerfall with the actions of your family bloodline. Surnames, Marriage,
Children. Live through the world of Daggerfall, passing down your legacy, and continuing your adventures through your
bloodline. Heirlooms/Death Quest. Upon your current characters death, have a chance to drop a gear item deemed an
heirloom. These heirlooms, along with your characters remains can be acquired by completing the death quest on your
descendant." Then: "Go all in with this and make it the best that it can be, all included UI elements should recieve a
enhanced plus overall. And while I do want the permadeath option, I also want an option that isn't permadeath (not
sure how to handle this)".

**Project Legacy** (0.4.1, GUID `a3cbfd81-bd91-485c-a3bc-171251ef7ac8`) is Mac's own Daggerfall Unity mod, written
with Ghð§† and Positronico. It is vendored in `vendor/project-legacy/` - the manifest, the settings, the DLL byte for
byte and its IL dump; NOT its seven pictures, which are cuts of the classic UI's own stone panels (Port-Doctrine:
renders of game data are game data) - and read off the DLL's IL (decompiled to C# by ILSpy 8.2 for reading; the
citations below are the DLL's types and members, `Project_Legacy.SaveCharacterManager.SaveCurrentCharacter`). The
author is the port's owner, so the permission line is his own.

## 1. What the mod does (read off the IL)

- **The family record** (`Project_Legacy_Data`, `CharacterData`, `StatsData`, `SkillsData`): every character the line
  has had - id, generation, name, race, class, sex, face, level, alive, the bag and the worn kit, gold, the career's
  primary/major/minor skills, the parents' and the children's ids, a world anchor - with their eight stats and
  thirty-five skills in two parallel lists keyed by id. Saved through `IHasModSaveData`.
- **The first record** is written at the first save (`SaveLoadManager_OnSave` -> `SaveCurrentCharacter(firstTime)`),
  with a roll of random siblings (`CreateRandomSiblings`: probability and count from the settings).
- **A death** (`HandlePlayerDeath`, on `PlayerDeath.OnPlayerDeath`): a 50% roll (or always, by the setting) for a
  descendant. None: "You died without a descendant", and DFU's own death proceeds. One: the dead are recorded,
  the bag emptied, a new character rolled onto the same entity (`CreateCharacter(willBeThePlayer)`: a name - the
  dead parent's own surname 90% of the time (the paternal line's only when they carry none; a sibling, the father's -
  `RandomizeCharacterData` IL_355c-3594, AUDIT LEGACY III F1 corrected this line), the "lore surname change" otherwise -
  race 70% the parent's, a random
  class, stats the mean of three d100, skills the least of three d100, a random weapon, clothes, armour pieces,
  sundries and 50-1500 gold split 60/40 into a letter of credit), siblings rolled for it, and the player teleported
  to one of forty hard-coded world coordinates and revived after a second under five seconds of god mode.
- **The family tree** (`FamilyLegacyWindow`, the G key or a two-key chord): every generation from the root down,
  couples on a "married" branch (an "Unknown" partner when the line records none), children hung under the couple,
  the root's own siblings beside it; the wheel zooms, the right button drags. A double-click on a portrait opens
  **the card** (`FamilyLegacyInformationPanel`): the face, the eight stats, the career's skills with their values.
- **Switching** (the card double-clicked, then Yes): to a LIVING sibling - the current character's stats, skills,
  kit and gold written back to their record and their place kept as an anchor, the sibling's poured onto the entity,
  and the player teleported to the sibling's anchor (or a random one of the forty, the first time).
- **What it leaves out, and what the port does not keep** (AUDIT LEGACY F8): the heir keeps the dead's WHOLE purse
  (`ClearInventory` clears items, `AddGold` adds - IL_50f3-50fa; the port's estate is a quarter, section 5); Max
  Siblings 0 with a non-zero probability still makes ONE sibling (`Random.Range(1, 0 + 1)`, IL_5195-5199 - the port makes
  none: zero means zero); the family tree's second-key chord and its "Unknown" partner on a married branch are not
  kept (one key, the registry's - Ledger A; a branch with no recorded partner draws none).

## 2. The bugs (every one fixed in the port; the root, not the symptom)

The fix column names the law in this arc that removes the cause.

| # | Bug | Root | Fixed by |
|---|---|---|---|
| B1 | An heir keeps the dead's max health, level-up sums and skill tallies - a level-1 heir with 300 health levels at once or never | the heir is poured onto the dead's entity field by field; MaxHealth, StartingLevelUpSkillSum, CurrentLevelUpSkillSum and SkillUses are never touched | THE HEIR IS BORN, not poured (section 4): one construction seam, `chargen.applyCharacter`, which mints every derived field |
| B2 | An heir keeps the spellbook, diseases, vampirism, lycanthropy, crimes, quests | same root | same law - a new character in the same world |
| B3 | Nothing is inherited: stats are a 3d100 mean, skills a 3d100 minimum, the class random and its skills re-rolled apart from it ("a Knight whose primaries are Alchemy and Swimming") | the mod never reads the parent | INHERITANCE (section 5): DFU's own chargen roll for the heir's career, then the blood and the hearth on top |
| B4 | Race is inherited 100% of the time; the 70% roll never fails | `val2 = val` is assigned at the lookup, before the roll | the race law reads the roll |
| B5 | Mage is never picked, and the class roll can pick None (null career, a crash) | `Enum.GetValues(ClassCareers)` sorts by UNSIGNED value, so None (-1) is last; `Random.Range(1, Length)` skips Mage at 0 and can land on None | the career is drawn from the eighteen by index |
| B6 | The heir wears the dead's face index | `FaceIndex` is rolled for siblings only | every person is born with a face |
| B7 | A level-1 heir may get Daedric armour, a ship's deed, a blank magic item, a blank book, a stack of two paintings | materials uniform over every `ArmorMaterialTypes`; deeds and template-only items in the sundries table; `stackCount` set on unstackables | the kit is DFU's own (`assignStartingEquipment`) - section 5 |
| B8 | A sibling's kit is drawn by the PLAYER's gender, race and class | the kit functions read `GameManager.Instance.PlayerEntity` | a sibling is a record until played, and born through the seam when played |
| B9 | A shield ends every further armour roll | `!isShield` gates each part | (the kit is DFU's) |
| B10 | A bow with no arrows | - | (the kit is DFU's) |
| B11 | The heir lands in the sea | `Teleport` takes X from one random place and Z from another; a failed ground ray re-rolls rather than searching near | THE HEIR IS BORN IN A TOWN (section 4): a named location, through the boot's own `?region=&loc=` start |
| B12 | "Random descendants" re-rolls on every death and ignores the saved answer | `HandlePlayerDeath` rolls `hasDescendants` afresh | the answer is rolled ONCE per person at birth and kept on the record (`heir`) |
| B13 | A death without an heir records nothing - the dead stay "alive" on the tree | the record is only written on the heir branch | every death is written before the heir is asked for |
| B14 | Siblings never appear on a fresh install | both sibling settings ship at 0 | the defaults are 2 and 50% |
| D1 | Migrating a save older than 0.0.3 throws on a NULL list | the loop enumerates `CharacterData` (IL_07ff-0804) before its null check (IL_0846) | the port's record has one version and its own reader (no DFU save is read) |
| D2 | Migrating a 0.4.0 save writes the gold onto a character that is not loaded yet | `MigrateData` runs before `RestoreSaveData` assigns `currentCharacterData` | (same) |
| D3 | A migrated generation is the largest ID | `Max(c => c.ID)` | generation is the parent's plus one, always |
| D4 | A save with records but no current character mints a second ID 1 | `firstTime ? 1 : next` | ids come from the record's own counter, never a constant |
| D5 | Generation disagrees between a character and its stats and skills | written in three places by two rules | one person record carries all three |
| D6 | A Fortify, a ring or a curse is made permanent on the heir and on every switch | stats and skills are read LIVE (`GetLive*Value`) and written PERMANENT | the record keeps the permanent values (`entity.stats`, `entity.skills`) |
| D7 | A switched-to sibling's anchor is (0,0) until they switch away | `hasAnchor = true` with no coordinates | a person's place is their last save's, read from their own save |
| D8 | A two-handed weapon may be recorded twice | one clone per equip slot it fills | the record keeps no kit - a played person's kit is their own save's |
| D9 | The tree starts at the first save, not at the character's birth | `OnSave` writes the first record | the founder is written at birth (and at the first load of an older save) |
| S1 | A switch carries the old character's max health, effects and spells | B1's root | THE ONE FAMILY, MANY CHARACTERS (section 3) |
| S2 | A custom class switches to the current character's career | the lookup by name misses and nothing else runs | a person is played from their own save, which carries their career |
| S3 | A switch is free fast travel, even mid-fight | the anchor teleport | a switch is a save and a load; a fight refuses it (`legacyHost.js switchRefusal`) |
| S4 | Yes pops three windows: the box, the card, and whatever was under the tree | `PopWindow` inside the switch plus two closes and a pop | one close, the overlay slot's |
| S5 | "Random descendants" chosen after "Always" keeps answering Always until the game restarts | `LoadSettings` only ever SETS `alwaysHaveDescendants` (IL_03ff-0404) and never clears it (AUDIT LEGACY II F12 found it) | the setting is read at the moment it matters (`systems/legacy/settings.js legacySettings`) |
| U1 | The wheel zooms about the corner and reads the wheel under other windows | no re-centre after the rebuild; `Input.mouseScrollDelta` read raw | zoom about the pointer, inside the window's own handler |
| U2 | The dead and the living, the one played and the rest, look the same | `P_DEAD`/`P_ACTIVE` frames are never drawn | the dead and the played one marked on their plates; the card's chips name the living, the dead, the elder, the heir answer ("Has an heir") and the remains' state |
| U3 | Skill labels read "HandToHand", "CriticalStrike" | `Enum.GetName` | `SKILL_NAMES` |
| U4 | The card reads its character before its null check | Setup is lazy and the data is sent after the push | the card is built with its person |
| U5 | A second tree window shares the first's root | `static FamilyNode root` | the layout is a pure function of the record |

## 3. ONE FAMILY, MANY CHARACTERS - how the mod's model lands on the port's

DFU's mod keeps the line inside ONE save: the heir and every sibling are the same `PlayerEntity` with other numbers
poured in. The port's characters are each their own (`characterId`, CHARID1): their own saves, their own world clock,
their own quests and regard (Living World decision 6). Pouring one into another is exactly what produced B1, B2 and
S1. So in the port:

- **A family is its own record**, `legacy/family.js`: the line's surname, its model (section 6), and a PERSON for
  every member - played or not - with their identity, their career and its skill groups, their blood and hearth
  (section 5), their parents, children and spouse, their birth and death, and once played their `characterId` and their
  eight stats and thirty-five skills as last played (a member never played has none yet: they are rolled at their birth,
  section 4). Ids are minted from the record's own counter.
- **Where it lives - two authorities** (AUDIT LEGACY's root). In app storage under `dagger.legacy.family.<familyId>` -
  the family outlives any one save - and as a copy in every member's save (`modData.ProjectLegacy`). THE STORE answers
  the world's facts: who lived, who died, Arkay's toll, who is played, which remains exist - a death is decided at the
  death door (`characters/playerEntity.js setDeathListener`) and no reload undoes it; a fall's Succession waits on the
  record (`pending`). REZ-BLOODLINE (below): online the realm HOLDS the fall the door wrote while a party's Resurrect can
  still raise the fallen, and its yes takes the death back on every copy (the REVIVE stamp). A SAVE answers what its character was given: the estate and the bequest paid, the remains opened,
  taken or laid to rest (`legacyHost.js mergeFamily`) - a reload rewinds those with the bag they went into. A save of a
  dead or retired member is THE PAST: refused for as long as it stands, the line's waiting Succession offered, else the
  one who carries the line now (AUDIT LEGACY III F12 corrected this line: never "its living").
  AUDIT LEGACY II: a WRITE never loses a fact the store holds - a copy not ahead of the store's (another tab's, an older
  save's) takes the store's facts in first, deaths only ever added (`store.js storeFamily`/`mergeFacts`, A4), and a
  write the storage refuses is said and tried again at every tick (P1). A record with no person for the character
  played is not theirs and is let go (H1). Online (LEGACY7) the account service holds the lineage, the device's store
  its cache (section 9).
- **The fixed city keeps DFU's death** (FLAGGED, `scenes/world.js`): `?exterior`, a dev route, streams no world for an
  heir to be born into.
- **A person is played by being loaded.** Switching to a member who has been played loads their newest save; to one
  who never has, boots them BORN (section 4). The member left keeps their place in their own save, which is what the
  mod's anchor was reaching for (D7, S3).

## 4. THE HEIR IS BORN

A new member enters play through the same door a new character does - `chargenSession.finishChargen`, THE ONE
CONSTRUCTION SEAM, over a result built from the person (`legacyHost.bornResult`: their career from its CLASS*.CFG or a
custom one whole, DFU's own roll for it, the blood and the hearth on top, their identity and their parent's leveling
system) - `applyCharacter`'s derived health, magicka, fatigue, tallies and level-up anchor, the starting spells, DFU's
starting kit, the faction store and the region bootstrap. Nothing of the dead rides along but what section 5 hands down.

The boot: `?world&legacyborn=<personId>&region=<r>&loc=<l>` (the world host's scene door, so the front door never clears
it) - the pending birth is held in session storage (`legacy/store.js leaveBirth`/`readBirth`), the boot's chargen arm
builds the person instead of opening the wizard, and the family's record is the new game's `ProjectLegacy` save data.
The born member is SAVED at once (the mod's `SaveCurrentCharacter(firstTime)`): the handoff is answered then, and the
page's address becomes that save's load. A birth that cannot be made goes back to the menu, said - the line waits.
AUDIT LEGACY II: the birth STANDS ONLY WITH ITS SAVE - its character id, the fall it answers (settled as the heir
lands, never at the Succession's choice - B1) and the estate are undone if that first save is refused, and the reload
bears them again (A2); a member whose character id no save holds (their saves deleted) is born again from their
person rather than loaded (A2/B1). Until the heir lands, the page that chose acts for no one (A1) - and the page BEARING
them offers the Succession to nobody: it is the fall's answer, and a save writes only the person who is the character in
the world (FB1012d HEIR-CLONE, `01-Overview/bugs/Field-Bugs-2026-10-12d.md`: online the birth waits on the realm with the
world running, the waiting fall's window rose over the newborn, and a press wrote the newborn over their sibling). The
heir is born in a PLACE: the family's seat - the first town its founder stands in, or the town or the home of the
house's own (a farm, a manor - FB1012d SEAT-HOME) the player moved it to (FAMILY-SEAT, section 11) - else the nearest
town to where the parent fell (B11's root, a coordinate pair that is no place, gone). A birth answered from the Online
page starts there too, never at the classic start (FB1012d BIRTH-START).

## 5. INHERITANCE - the blood and the hearth

- **Career.** Half the time the parent's career (custom careers included - the career rides the person); otherwise
  one of DFU's eighteen, uniformly (B5).
- **Race.** 70% the parent's; else the other parent's if there is one (section 8), else uniform over the eight (B4).
- **Sex** even; **face** uniform over the race's ten (B6).
- **Name.** A first name from the race's bank (`nameHelper.firstName`); the LINE's surname 90% of the time - the
  parent's own, the house's or a cadet branch's (AUDIT LEGACY III A5/F1: the house's came back on every cadet's child) -
  and "a lore surname change" otherwise, the mod's own line, a new surname from the bank which then becomes theirs and
  their children's: a cadet branch, said when it is founded. A Redguard bank mints no surname; a Redguard heir still
  carries the line's. A child of a house not named yet carries none, and takes the house's name with it (A7: each took a
  random surname of their race's, which the house's name never reached).
- **Stats.** DFU's own roll for the career (`rollStats` and its bonus pool spent lowest-first) - then THE BLOOD: each
  stat `+ clamp(round((parent's - 50) / 10), 0, 3)`. A great parent gives a little; a poor one takes nothing.
- **Skills.** DFU's own roll (`rollSkills`) - then THE HEARTH: each of the parent's primary and major skills
  `+ clamp(floor(parent's / 20), 0, 3)`. What the parent practised, the child grew up seeing.
- **Kit and purse.** DFU's starting kit for the career; and THE ESTATE: a quarter of the gold the dead carried,
  capped at 9,900 (`ESTATE_MAX`: the online birth's liquid ceiling, `REALM_BIRTH_WEALTH_MAX` 10,000, less the starting
  purse - AUDIT LEGACY H7; AUDIT LEGACY II F1 corrected this line) - paid as a letter of credit.
- **Siblings.** A birth rolls the new member's siblings: with the setting's probability, one to the setting's maximum
  (defaults 50%, 2 - B14), each a record of their own drawn by the same law from the same parent. A sibling is
  played only when switched to, and is born then (B8).
- **The heir answer** (B12): "Random descendants" rolls ONCE, at a person's birth, whether an heir will come forward
  for them, and keeps it (`person.heir`); "Always" sets it true. A line with a living member never needs the roll -
  any living member of the blood can take the mantle (AUDIT LEGACY III F14: a minor too - they come of age in the telling).

## 6. THE TWO MODELS - Bloodline and Enduring

Chosen per family at its founding, by the founder's chargen question (offline and online alike), and named on the
House page, the Stats page's sheet and the Hall - online, a Bloodline's skull over its members' names (AUDIT LEGACY III
F15: the card never names it). A family cannot change model: the permanence is the point of one and the
safety of the other.

**BLOODLINE (permadeath).** A death is final. The fallen is recorded dead (cause, place, date) and the mantle passes:
the player chooses who carries the line on - any living member of the blood, or a newborn heir of the fallen (when the heir
answer allows - rolled at their birth, or "Always" in its Features tile at the death). No member, no heir: THE LINE ENDS - the
family is closed as extinct and kept in the Hall of Ancestors (the Family tab's third page), and the next character
founds a new one. The heirloom roll is the port's own Legacy.Heirloom Chance (50% by default; the mod has no
heirlooms - section 7) and the remains always lie where the fallen fell.

**ENDURING (not permadeath) - the answer to "somehow a persistent model".** A death is not final, but it is not free:
it costs YEARS. Every member has an age and a span (THE SPAN: Breton, Nord 90, Redguard 80, Khajiit, Argonian 85,
Wood Elf 150, Dark Elf 180, High Elf 200), born at a quarter of it. A death in Enduring is ARKAY'S TOLL: the player
rises as the online respawn rises (D-ONLINE1 - the nearest temple, town or graveyard) - offline too, with no
revenant's theft (AUDIT LEGACY II F5 corrected this line; BAL4, 2026-10-10, `05-Combat/Balance-Arc.md` section 6: and
the online respawn's tenth of the purse, stated on a death screen that says Rise - it was the toll alone),
where the classic death would end the run - and the member is older by 6% of their span (its Features tile: Light 4%,
Standard 6%, Heavy 10%). The years also pass as they live (the character's own clock, LIVED1: 360 days a year). At
three quarters of the span the card names them an ELDER and the HUD says so, once a load. When the span is spent, the next death
is the last: they die of their years, and the mantle passes exactly as in Bloodline - so an Enduring line still turns,
at its own pace, roughly a dozen deaths a generation. AGELESS-CURSE (2026-10-09, the owner: "can you exclude vampires
and werewolves of this please?"): a member with the curse in the blood at the death - a vampire, a werewolf or a
wereboar, the curse taken (`liveVampirism`, `liveLycanthropy`), not one still incubating - pays no toll and always
rises, their span spent or not, and the rise says so ("The curse in Ysolde's blood keeps Arkay at bay. No years are
taken." - `payToll`'s `ageless`, `age.js:"if (ageless) return { final: false"`; asked at the door,
`legacyHost.js:"const cursed = !!(deps.entity"`). Their own clock still ages them. Cured, the toll is theirs again
from the next death - a spent member cured dies of their years at it. The sheet's "your next death is your last"
(section 11) is still said to a spent member while the curse holds. And at any time an Elder may PASS THE MANTLE from the family
window: they retire to keep the house (alive, at the family home - AUDIT LEGACY III F11d: never "to the seat" - kept
on the tree, no longer played) and the player chooses an heir.
The heirloom in Enduring is the elder's to hand down - always one: a retiring elder's BEQUEST (their best worn piece,
paid to whoever takes the mantle, no quest), a fallen elder's lying with their remains (section 7).

**Offline with Project Legacy off** nothing changes: DFU's death and its title menu. **Online without a family** - a
character made before the question was put online, made with the mod off, or copied in from the offline lane: it is
NEVER founded (LEGACY-CHOICE, below - it was founded into an Enduring family at its next load until then, AUDIT
LEGACY B4's law: a player never wakes into permadeath they did not choose, and now into no house they did not choose).
It plays without a house, the realm's own death; a new character founds one. **Online until LEGACY7**
(AUDIT LEGACY B4) a house was Enduring, an offline Bloodline played online died the room's death, and no Succession was
answered - permadeath had no authority there. LEGACY7 gave it one, the realm's tombstone (section 9): online is the
line's own law now, Bloodline open at the founder's chargen.

**LEGACY-CHOICE - the popup online, and who is founded** (2026-10-06, Mac: "I want to add a enhanced plus UI popup for
online when creating a character. Perma Death, the regular option, or the option that skips the liniage system
entirely. Current characters already created start without this system and requires a new game"; built:
`ui/legacy/legacyModelChoice.js`, `ui/levelingChoice.js`, `scenes/legacyHost.js found`, `systems/chargenSession.js
finishChargen`, `test/systems/legacychoice.test.js`, `tools/mutants/legacychoice.json`):
- ONLINE THE QUESTION HAS THREE ANSWERS - Enduring (the regular one, first: Enter without reading never costs a
  character), Bloodline (permadeath), and NO LINEAGE (`family.js NO_LINEAGE`): no house and no heirs, the realm's own
  death. On Enhanced Plus it is the popup - the Plus window, the three side by side as stone tiles tagged Not
  permadeath, Permadeath and Classic (the leveling question's word for the game as it always was), keys 1, 2 and 3,
  up and down each a direction; on the classic skin the same three stacked by their own heights within the 200.
  Offline it keeps its two: the mod's own switch in Features does the third for every character there.
- LEGACY-POINTER (FIELD 2026-10-06, Mac: "moving the mouse up and down switches between the options instead of letting
  you hover and select"): WHILE THE POPUP IS UP ITS TILES OWN THE POINTER. Every host hands the slot's occupant each
  mousemove from a listener on the WINDOW (world.js, exterior.js, worldModes.js, dungeon.js - the dungeon context's
  `overlayHover` is the fourth host's door), so the screen's canvas seam (`LevelingChoiceScreen.hover`/`click`) fired
  over the popup too and moved the choice by the classic face's ROWS, which the popup does not draw - its tiles stand
  side by side. The screen now notes the face it drew last frame (`_faced`, ui/yesNoBox.js's `_carded`) and its canvas
  seam stands down under the popup; the tiles' own pointerenter and click are the pointer. The leveling question wears
  the same screen and had the same fault. Clicks were never wrong: the popup's shell (`.px-home`, fixed, inset 0)
  covers the canvas, so no canvas press reached it.
- THE ANSWER IS THE CHARACTER'S (`entity.legacyChoice`, saved beside the leveling answer): one who answered no lineage
  founds no house - at their birth or at any load, in either lane (a copy keeps it).
- ONLINE A HOUSE IS FOUNDED AT A CHARACTER'S BIRTH ALONE: the boot's own call (`afterBoot`, `atLoad`) founds nobody
  online - a character loaded with no house plays without one, for good. A character whose house the store or the
  realm knows is found, as ever; a birth no question was put to (the headless door) founds online's safe Enduring.
  Offline an older character is founded at its first load into its own answer, else its Features tile's (D9).
- The Family tab says why there is no house: the character chose none, or (online) a house is founded only when a
  character is made - make a new character to found one.

## 7. HEIRLOOMS AND THE DEATH QUEST

- **The heirloom roll** at a final death: 50% (its Features tile; Bloodline) or certain (an Enduring elder's last death or
  retirement). The piece is the most valuable weapon or armour the fallen WORE (value, then condition), never a quest
  item, an Aetheric or artifact piece, or a sigil's. It is marked `heirloom: { line, house, of, from, gen, base }` and its name
  carries the family: "Hlaalu's Steel Longsword". A piece already an heirloom is always the one chosen - an heirloom
  is handed down, not found again.
- **The heirloom grows.** Each generation that carries it home adds one to its power (`heirloom.gen`, at most 5): a
  weapon +5% damage a generation (the weapon-damage seam, `registerWeaponDamageMod`), armour +2 a generation on the
  parts it covers (the entity fold, `registerEntityFold`, as the Loot arc's affixes ride it) - at five, +25% and +10.
- **The remains** lie where the fallen fell: in a dungeon, within six paces of their last position on its floor; in the
  open, within sixty metres of where they fell; a death in a building, anywhere on its town's pixel in the street. With
  them: their bones ("The remains of Ysolde Hlaalu", the port's own item, template 1810), the heirloom and a tenth of
  their purse (at most 2,500 gold). They are a LIST THE RECORD OWNS, opened as a container where they lie - the
  inventory window over it, in any mode (`openLootList`), by itself once a visit and never in a fight (the body below is
  pressed as any body, a fight included - DFU's loot window pauses the world): what the heir leaves stays
  with them, and nothing is ever laid in the world twice (AUDIT LEGACY H1). AND THEY ARE SEEN THERE (FB1013d
  REMAINS-STAND, `01-Overview/bugs/Field-Bugs-2026-10-13d.md`: H1 had taken the pile's picture with the pile, and in Castle
  Wayrest's halls an heir walked past a six-pace spot nothing marked): a body - their own picture, a line of light over
  it - stands where they lie, on the floor under the fallen's last position underground (in their own dungeon: its row,
  its pixel, its own key and the size it was built at - a made dungeon is no table row, the Undercroft wears its city's,
  and another size is another layout: AUDIT FB1013d O1 and B1, `01-Overview/audits/Audit-FB1013d.md`) and at the spot outdoors
  (at the height they stood), in the pool of the host the heir stands in; its list is the record's own
  (`scenes/legacyRemainsStand.js`), so it is pressed as any body and no save carries it. A death in a dungeon built
  whole - an instance (`11-Multiplayer/Instances.md`), or a quest's dungeon entered whole - lies in the dungeon whole,
  which the public room of a dungeon the world lays smaller never is, and another player's instance admits only its
  owner's party: so where the line's remains lie whole and the public room is laid smaller, the death quest's place is
  "a dungeon with your quest", and its door offers the heir an instance of their own - the dungeon whole, Daggerfall's
  own blocks in every build, which stands them where they fell (HEIR-WHOLE, FIELD BUGS 2026-10-19f,
  `01-Overview/bugs/Field-Bugs-2026-10-19f.md`; `systems/instancePlaces.js` remainsWholeAt). A death in the public room
  lies in the public room, laid smaller or whole, as it always did. A death in a building keeps the street's law and
  stands none. "Never in a fight" is the place the heir stands in (LIVE-FIGHT: the street's pools,
  frozen underground, kept it shut on the spot), and a duel or a hostile ship in reach is a fight there too (AUDIT
  FB1013d B3, the rest refusal's own reads). The bones are always somewhere - in the list or in the heir's keeping (the
  pack, the wagon or the Materials Bag); gone from both (sold, dropped, or carried off by a claimant now dead or retired),
  they lie again where the fallen fell; put back into the list, they lie there again, the claim kept (AUDIT FB1013d A1,
  A3).
- **The death quest**, "The Bones of <name>", is the heir's from their first day: the journal names where and the
  killer, the Quest Guide's tracker follows it (GUIDE4) and the marks point at it (GUIDE5). THE KILLER REMEMBERED - the
  revenant that slew the fallen (Revenants' own record, "Slew") hunts the heir, and the journal names it by its own name
  (LEGACY6, section 10). Taking the bones completes the first half; the second is to carry them into any
  temple or to the family's seat, where the player is asked "Lay <name> to rest here?".
- **The rest.** Laid to rest, the fallen's BLESSING: +3 to the fallen's highest skill for the heir - at most +9 on
  any one skill however many are laid to rest (`BLESSING_SKILL_MAX`: a long line is honoured, never a build) - the
  heirloom attuned (its generation counted), and the tree's card of the fallen marked "At peace" (else "Lies
  unclaimed" or "Carried home"). Unclaimed remains lie for good (they are the family's, not the world's). Every final
  death leaves remains and its quest, wherever it happened - but one: a member struck down by the one played (section
  10b) leaves no remains and no quest (AUDIT LEGACY II F3 recorded the exception), nor does one a beast kills in the
  street (the merge of main's #630: theirs is a death of the record, not a fall of the one played). A rest lays what was left with the
  remains to rest with them (AUDIT LEGACY II P6: a rested row keeps no lists).
- **The claim (AUDIT LEGACY II).** A list is CLAIMED by the member who changes it (opened and left as it lies, it is
  nobody's - H5); the claim is the store's, a world fact, and a rewind of the claimant's own save restores the list
  with their bag but never drops the claim (H2); another member's save never rewinds a list it did not claim (A3).
  A claim lapses when its claimant dies or retires, and the list then lies as they LEFT it (A3). Another member's log
  names whose search it is. The bones go back into their own list or stay in the character's keeping - the pack, the
  wagon, the bag - and into no chest, pile or ground (H4).
- **The load's repairs reach what the line hands down (ITEM-WALK B, 2026-10-07).** A bequest reaches its heir at birth
  with no load, and the remains open where they lie, from the line's record, which may be the device's copy rather than
  a save's (`mergeFamily`). The load's one-time item repairs (`systems/save/save.js` repairItemLists: DISC21-A, WEAPON-POOL,
  DISC29-B, WB12a, RARITY-WEAR) run on each bequest piece as it is paid (`payEstateOf`), and on a remains list as it
  opens, before its claim's mark is taken, so opening it still claims nothing. A save's copy of the record is walked
  at every load besides (`heldItemLists`). `05-Combat/Physical-Combat-Overhaul.md` ITEM-WALK.

## 8. MARRIAGE, CHILDREN AND SURNAMES

*Built: LEGACY5. The law is `systems/legacy/marriage.js`; the host's half `scenes/legacyHost.js` (`topicRows`,
`weddingStep`, `childrenStep`, `residentDied`, `holdsResident`, the spouses in `residentsOf`); the talk's rows
`scenes/townTalk.js` (`legacyTopics`); the wiring `scenes/world.js`; pinned in `test/systems/legacy/legacy5_marriage.test.js`,
mutation-proven in `tools/mutants/legacy5.json`. Two players' characters wed online: LEGACY7 part three (section 9).*

- **Courting** a Living World townsperson of a household (the census's `h` roll - never one of the watch, a traveller
  on the roads, a visitor or one of the line; every census resident is an adult): one whose regard of the one played is
  FRIEND (`FRIEND_AT`, 40), or one already courted. Their talk's Tell me about page opens with Project Legacy's own
  rows, on both skins (`townTalk.js legacyTopics`, answered by the host - never the engine's pipeline): "Courtship"
  once a day of the one played's own clock - affection by Personality and Etiquette and the question's tone, on a roll
  (`courtGain`; TONE-TASTE, 2026-10-15: the tone as the resident took it - kindly +3, ill a loss of 3, never below
  nothing, `06-Systems/Living-World.md` TONE-TASTE) - then, at 100, "Marriage": a proposal, taken. The courtship keeps the resident as they are (name,
  sex, race, face, town) - their identity is for life, so the wedding needs no town loaded (AUDIT LEGACY III A4/P2: the
  record's reader kept only the name and the town, and every wedding after a load made a male Breton with no face).
  Nobody of the house is courted, nor one another member is betrothed to (A1: two members wed one townsperson - one
  census id, two spouses); the first wedding ends every member's courtship of them.
- **The wedding** is asked at the door of the temple of the betrothed's town, once a visit (the rest's shape -
  section 7): "Be wed to <name> here, before the gods?", and then "Will <name> take the name <house>?". **Departure
  (recorded):** the design said through the priest's talk ("We wish to be wed"); the temple's priest is DFU's static
  NPC, whose talk is the engine's, and a question at the temple's door is the shape the rest already wears.
- **The spouse** is a person of the house (`kind: 'resident'`, their census id, their own name and face for life -
  the talk window's CommonFaces record their census gave them, on the tree and the meeting's card alike: AUDIT LEGACY
  III P17, `systems/legacy/facePose.js` -
  `mapId` the town they live in). They stand in the world as the census's own resident - their outfit, job and day -
  of the line's household now (`household`), at home in a house of the line's in their town when there is one, else
  in their own; their census place is the line's for good, living or dead (`holdsResident`; `world.js holderOf`).
  Unlike the members, they stand whether or not "Family In World" is on: they are the town's people either way. Met,
  they greet the one played as their spouse; they are never played, never carry the mantle (`successors`). Struck
  down, they die in the record (section 10b's law). A courted resident who dies ends the courtship, said.
- **Children.** A wed member has a child with a 25% chance each thirty days of their own clock while the spouse lives
  (one roll however many months one jump passes; a union heard while they were away counts from their first played day -
  AUDIT LEGACY III P6), at most six with each spouse; the child's race is either parent's, the rest by section 5 from both parents (`addChild` reads the
  spouse). A child is a MINOR: not played (the switch says so), but any child may take the mantle at a succession -
  they come of age in the telling (section 10's departure); a minor taking the mantle is a minor no longer.
- **Surnames.** The family's surname is the founder's (their name's last word, or "of <seat>" when they have none). A
  spouse takes it if the player answers yes at the wedding; children carry their parent's line - the house's, or a
  cadet branch's: the mod's lore change founds one under the new name on the same tree, and its children carry it on
  (section 5's naming; AUDIT LEGACY III A5/F1 - they came back under the house's name).
  **LEGACY-NAME (2026-10-06):** "of <seat>" was applied at the founding alone, and a new character founds in Privateer's
  Hold, where no town stands - its seat came at the first town and the house stayed nameless for good ("The House of "
  on every page, no house under the name online, siblings with no surname). A nameless house is named when its seat is
  noted, or when a copy that knows the seat merges in, the members of the blood with it - a spouse keeps their own
  (`family.js nameAtSeat`; the host's tick, `store.js mergeFacts`) - and the HUD says so ("Your house takes its seat's
  name: the house of Sentinel."). A seat's house says itself once - "The House of
  Sentinel", never "of of" (`systems/legacy/houseName.js houseWord`, the pages' `houseTitle`, the host's, the Succession's, the
  heirloom's, the wedding's and the towns' words) - and a member born "Tlist of Sentinel" keeps "of Sentinel" whole when
  played (`surnameOf`/`givenOf`). The towns' news names a member by their FIRST name (`meetups.js` fills `{who}` with
  `firstNameOf`, since LW4), so its "{who} {house}" read "Tlist Sentinel" for a house named for its seat, and says
  "{who}" now. **AUDIT LEGACY III A16/F2 corrected this line:** it said the news doubled a surname ("Ysolde Hlaalu
  Hlaalu, gone."), which no town ever said.
  Pinned in `test/systems/legacy/legacyname.test.js`, mutation-proven in `tools/mutants/legacyname.json`.

## 9. ONLINE

*LEGACY7 - built: the line, the tombstone, the member's birth and the house name (`server-account/src/legacy.js`,
migration `0084_legacy.sql`, acct87; `systems/legacy/realmLine.js`; `test/server/legacy7_service.test.js`,
`test/systems/legacy/legacy7_online.test.js`, `tools/mutants/legacy7.json`), and two players wed (part three: `net/wedSession.js`, the
`wed` frame of world174 (world172 on its branch, renumbered past main's WATCH-FIX and SERPENT3 at the merge),
`server-account/src/legacy.js` realmWed; `test/systems/legacy/legacy7_wed.test.js`, `tools/mutants/legacy7wed.json`).*

- **The model is the family's**, chosen at the founder's online chargen - Bloodline open online (AUDIT LEGACY B4 shut it
  while a permadeath had no authority there; the tombstone is that authority), said on its card: "Online, the realm
  holds the line: on every device."
- **The service holds the line** (`lineages`: an account's family by its own id - its surname, its model for good, its
  record and `rev`). A write lands only on the stored rev it was made from (`base` - AUDIT LEGACY III A2: past the stored
  rev alone, a device that touched its copy three times wrote over a death another device had written); a stale one is
  answered with the stored record, which the client merges its facts into (`store.js mergeFacts`: a death only ever added) and writes again, one past both. Every
  online boot reads the account's lines into the device's store before any save is restored (a death another device
  wrote stands there) - asked at the join beside the account's roster and read behind the boot, waited for where
  Project Legacy's host is made (BOOT-OVERLAP in `07-Rendering/Performance-Priority.md`) - and each write of the device's is followed by the realm's (`realmLine.js push`); a switch, a
  succession and a birth wait for it (`flush`) before the page goes.
- **A Bloodline death is a tombstone** (`POST /v1/realm/die`, under the playing session's lease - `realmSaves.js` session
  `die`): the service stamps `dead_at` and drops the lease, and from then refuses the character's join (`dead`, 410),
  checkpoint and trade, and the relay's door (`realmCharacterHeld`): an older save cannot be reloaded past a death, which
  is the whole of permadeath's authority. An Enduring line's last death (its span spent) and an elder's retirement are
  tombstones too - a member never played again. A tombstone ACTS IN NOTHING (AUDIT LEGACY III O12): the service's one
  door refuses every body naming one of the account's tombstones (`dead`, 410) before any route - its professions, its
  Stores (a request naming the fallen had withdrawn them into the heir's pack), the market, Renown, the guilds; the
  token's mint alone is no act, and mints it no realm character (`rc` 0). The tombstone frees the roster slot
  (`REALM_CHARACTERS_MAX` counts the living) and leaves the roster; the family's record keeps them (the Hall). The page stays for the Succession; the
  heir's boot waits on the realm's word (a tombstone refused is said - "The realm did not hear of this death yet" -
  and asked again before anyone carries on). REZ-BLOODLINE (below): the door's tombstone carries a HOLD - dead at once,
  the lease that fell kept aside - so a party's Resurrect inside its window can take the death back (`/v1/realm/raise`).
- **A member's birth** is `realmCreate` with `{ lineage, person }`: the service checks the person is a living member of
  the caller's own line (never dead, retired, wed in or a minor) that no realm character has played (`lineage-played`;
  a unique index behind it), and names them on the row for good. A birth whose first save never landed is taken up
  again - the same row, a new lease. The first save is held to the birth law as every birth is (level 1, liquid wealth
  at most 10,000 - the estate fits under it by construction, section 5); the host's `onBorn` waits on it (the birth
  stands only with its save, AUDIT LEGACY II A2). A member already played is joined as any realm character is.
- **The founder** is born the same way: the line written to the realm, then the character made as its first person,
  and the realm's id rebound into the record (`legacyHost.rebind`). **A bug found here, fixed at its root:** before
  LEGACY7 an online founder kept the client's id in the record while the realm named the character anew, so its saves
  were refused into the record and its next load founded a second house.
- **Enduring online** is the offline law: the toll, the rise, the elder's mantle.
- **A house name online** (LEGACY7 part two, `net/houseLaw.js`; world174, acct87; `test/net/legacy7_house.test.js`,
  `tools/mutants/legacy7house.json`): the account service reads a realm character's house off its line and signs it
  into the identity token beside the guild's tag - `hn` the surname, `hc` the member's given name, `hb` a Bloodline,
  `hg` the generation's numeral from the second of a name ("Ysolde II") - through the name filter (the house is shown
  to everyone, as an account's name is), never for a tombstone, and left unsaid rather than past the token's bound
  (`TOKEN_MAX_CHARS`). The relay stamps it on every row beside the Renown (`badged`), and one line is drawn under the
  name over the head, on the inspect card and on the roster's tile: "☠ Ysolde II of House Hlaalu" (the skull a
  Bloodline's; a seat's house - "of Sentinel" - reads as itself). **Departure (recorded):** the name over the head
  online is the account's, so the member's given name rides the house's line rather than replacing it.
- **Two players wed** (LEGACY7 part three - the design's "both in the same temple, both asking the priest, the service
  records the union (each family names the other's member as spouse)"). Two players, each a realm character of a house
  (alive, of the blood, of age, wed to nobody, no Succession waiting, out of a fight), standing in one temple: one
  presses **Propose marriage** on the other's Inspect card; the other's Yes/No box asks ("Ysolde, ☠ Ysolde II of House
  Hlaalu, asks for your hand, here before the gods. Be wed?"). The handshake is one directed frame, `wed` (`net/wire.js`
  validWedData: `ask`, `yes`, `no` with its reason, `done`), routed as a duel's to the one player it names in a place
  room, the sender's VERIFIED account and realm character stamped on it by the relay (`sub`, and `sc` off the token's
  `ci`). **The union is the account service's** (`POST /v1/realm/wed`, `realm_unions`): each side posts its HALF of one
  wedding under its playing lease, naming the other's account AND CHARACTER as the relay stamped them - the asked side
  first, then its yes, then the asker's half - and only both halves, each naming the other character for character,
  make it (AUDIT LEGACY III O1: the account alone let the other side post as another of its characters after the yes); a
  half is written once and is nobody's word after five minutes from it (`WED_HALF_LIFE_S`; O3: a re-post refreshed it),
  it is TAKEN BACK whenever its player is told the wedding did not happen (`withdraw`; the union answered when it stood
  first), and an account is in one wedding at a time (a second half takes its first back). So no frame
  makes a union: a crafted yes with no half behind it makes nothing. The service keeps each side's CARD as it stood at
  the wedding (the realm name, the house through the name filter, the person's sex, race and face off their own line),
  and each house records the other's member from it as the spouse (`marriage.js wedPlayer`, `kind: 'player'`, `realm`
  the union): their own name and house for life - the union names them, it does not take them in, so no name is asked -
  never played here, never carrying the mantle, never standing in this house's world (they walk their own). Children
  come on the member's own clock while they live, as with any spouse - each house raises its own. **The union ends**
  with either's death (a tombstone, `died` - a member struck down in the street too: the line's write that first
  carries the death tombstones them, AUDIT LEGACY III W2) or delete (`gone`), said by whose; an elder's retirement keeps it (the
  tombstone says `retired`: they live on, wed). Each online boot, and every ten minutes after, reads the account's
  unions (`/v1/realm/unions`, `legacyHost.unionsHeard`): a wedding made while this device was away is recorded, and the
  other's death or departure reaches the house ("Word reaches you: Iszara Dres is dead.") - the member may wed again.
  A wedding is a fact as a death is when two copies of the line merge (`store.js mergeFacts`).
  **Departures (recorded):** the design's "both asking the priest" is the Inspect card's proposal and the other's
  prompt, inside a temple - the priest is DFU's static NPC, as section 8 says; and each house raises its own children
  of the union (two records, two clocks - the realm keeps no shared child). A player read it as a bug ("Only one of us
  could actually see the heirs" - FIELD BUGS 2026-10-12b): the children on both trees, seen through the marriage, is
  planned there (UNION-CHILDREN), the owner's call.

## 10. WORLD INFLUENCE

*LEGACY6's - built (`systems/legacy/influence.js`; `test/systems/livingWorld/legacy6_influence.test.js`, `tools/mutants/legacy6.json`).*

- **What a member leaves.** At every save (and at their death) the one played's STANDING is written on their person
  (`memberStanding`): their legal reputation in every region, their faction standings (the forty furthest from nothing)
  and the Living World's regard of the residents who know them (the sixty strongest, at least ten either way).
- **The birth's share.** A child born of them (an heir of the newborn choice, or a child of a marriage played at last)
  starts with a QUARTER of what the parent held over the child's own start - a region's law (written straight, held to
  DFU's bounds; no crime's word is said for it) and each faction's standing (flat, never walked to its allies) - and
  HALF of each resident's regard (`relations.js inherit`: no word counted for it) - "your mother saved my son", and a
  grudge is half a grudge. A new game's fresh relations, landing after the birth, take the share again
  (`legacyHost.seedRegards`, the Living World's `newGame`). A member never saved since LEGACY6 hands down nothing.
- **The towns talk of the family.** A member's death (one struck down by the one played too - AUDIT LEGACY III A13), a
  laying to rest, a wedding and a birth (of a newborn: A9 - an adult played for the first time is no birth) are NEWS
  (`family.news`, a fact of the store - merged, never unheard; the newest 24), stamped by the towns' own minute and told
  for seven days FROM WHEN THE ONE PLAYED HEARD IT (`influence.js hearNews`, their own clock - AUDIT LEGACY III A8:
  offline every member keeps their own clock, and a parent's death lay in a born heir's future, told as fresh two
  hundred days on) in the town where it happened and in the family's seat, in the house's own words (`lines.js KIN_NEWS`: "Did you hear?
  Ysolde of House Hlaalu is dead."), beside the road's and the deeds' (`livingTown.js familyNews`).
- **The killer is remembered.** A fall answered by an heir reads the fallen's own revenant mirror for the foe whose kill
  fell as they did (`revenant.js killerOf`), and hands it to the heir (`inheritRevenant`): in their list and their
  mirror, due one to three days on - it HUNTS them as any revenant returns, by Feud's own return roll. The record
  (`died.by`), the death quest ("It was Grushnak the Butcher that struck them down.") and the House page ("fell to
  Grushnak the Butcher" - AUDIT LEGACY III F6) name it.
- **A house name online**: LEGACY7 part two (section 9).

**Departure (recorded):** the arc's first plan folded the house's standing into one number per region; what was built
is the parent's own, handed to the child born of them - a house has no standing the law could read apart from the
person standing in it, and a sibling (of no parent the line played) starts as any new character does.

**Departure (recorded):** "they come of age in the telling" - a child takes the mantle as an adult with no clock
jump; online the clock is the world's and cannot be moved, and offline a jump would desynchronise every member's own
save from the family's dates. The years are the family's fiction, the world's clock its own.

## 10b. THE BLOODLINE IN THE WORLD (LEGACY-HOME)

*Built: LEGACY-HOME. The law is `systems/legacy/household.js`; the host's half `scenes/legacyHost.js` (`residentsOf`,
`kinOfResident`, `kinSlain`, `kinKilled`, `isFamilyHouse`, `markHome`); the wiring `scenes/world.js`; pinned in
`test/systems/legacyhome.test.js`, mutation-proven in `tools/mutants/legacyhome.json`.*

Mac (2026-10-05): "I think your bloodline should be visible when not playing, and if a house is owned should live in the
house ... With the ability to switch by interacting with them or by using the ui. Really trying to flesh this out since
itll be default on but can be toggled off." His three answers decided the open questions: with no house, members live in
the family seat as townsfolk; with several houses, one is the FAMILY HOME; and members keep a Living World day rather
than standing still.

- **Who stands in the world** (`homeOf`). A living member of the blood who is not the one played - never played, or
  played and PARKED (`parked`: their newest save was made in one of the family's houses, written by the save itself and
  by nothing else - AUDIT LEGACY II A7: a rise or a failed switch wrote it), or retired. A member whose save stands anywhere else (a dungeon, the road, another town's street) is
  on their own journey: not in the world, and their card says so. What is seen and what is saved are one thing: Play as
  a member standing in a house and their own save takes them up in that house. The one played never stands beside
  themselves. A spouse wed in from the town stands with them (LEGACY5, section 8); a spouse from another player's house
  never stands in this world (LEGACY7 part three, section 9).
- **Where they live.** THE FAMILY'S HOUSES are every house a member holds (`family.houses`, each row its holder's - a
  deed is the character's own, `systems/banking.js`, so the rows are the one played's `houses`, a deed that stands,
  learned with the SAVE that holds it and at a load - AUDIT LEGACY II A6: an unsaved purchase or sale moved the line;
  another member's rows are kept, and every row keeps its place - A5: rebuilt, "the first house" changed with whoever
  was played). A dead member's house stays the line's until whoever carries the line takes it up (PERMADEATH-HOUSES,
  section 10c). THE FAMILY HOME is the one marked on the House page, else the one
  in the family's seat, else the first (`familyHome`). A parked member lives in the house their save was made in; the
  never-played and the retired in the family home. With NO house, the members live in the family's seat town as its
  townsfolk, in a residence of the town LENT to the line (`LivingTown.homeFor`, the same house for the same family -
  House1-House6 with a door; a town with none to lend stands nobody). The seat learns its town's map id the next time
  the line stands in it.
- **Their day** (`residentOf`). Each is a resident of their town in the census's own shape (`systems/livingWorld/
  census.js`), added beside the census through `LivingTown`'s `extraPeople` (one list while nothing of the family
  changes, so the town keeps its day by it): the homemaker's day (`dayPlan.js` - asleep at home by night, the market
  and the town by day), found in the street and in the house (LW8's rooms). A HOUSE OF THE FAMILY'S holds the line and
  no one else (the census's people of that building are not shown inside it, the one played's own house included); every
  other room of the player's own stays empty, as AUDIT-E1 has it.
- **How they are drawn.** IN THEIR OWN BODY (LEGACY7 part four, `world/familyBodies.js`; `test/systems/legacy/legacy7_body.test.js`,
  `tools/mutants/legacy7body.json`), as the design asked: a member whose newest save wrote down their LOOK - what they
  wore, the hello's own recipe (`family.js memberLook`: race, sex, face, class, the worn kit's doll fields; written at
  every write of the one played, dropped at a death) - is drawn in the street and in a room as an online peer is drawn
  on this screen: a Morrowind body where this client stands those (the enhanced lane with the data), else their class's
  sprite or their paperdoll as the 'Other players' card says - by layers of the line's own (`net/remotePlayers.js`,
  `net/peer/peerBodies.js`), with no sound: a townsperson's steps are the town's. The street's walker and the room's seat
  stay their talk target; only the picture moves. A member never played has no look and wears the town's outfit - DFU's
  walkers have three tables (Breton, Nord, Redguard), and the member's race picks the nearer (the elves and the Bretons
  the Breton, the beast folk the Redguard), the same one every day. **Departure (recorded):** the look keeps no Eye Of
  The Beholder set (`eo`) - that is how a player chose to be seen online, not how the house remembers its own. In the
  talk window they wear THEIR OWN FACE: the chargen head they were made with (`raceArt(race, sex).heads`, record
  `face`; `ui/native/nativeTalk.js` takes a FACE*.CIF as the portrait's archive).
- **Talking to them.** The talk door meets them first (`townTalk.js` `livingTalk.kin`, after the refusals and the
  household's moment): the Succession's window with one card (`ui/legacy/legacyDoor.js` `createKinOverlay`) - what they are to
  the one played ("Your sister.", `kinLine`), their greeting by kinship ("Mother! You're home.", `kinGreeting`) and how
  the house fares, then **Play as <name>**, **Talk** (the town's own conversation, their head in the window) and
  **Goodbye** (Escape). Play as is the Family tab's switch - saved where they stand first (in a house of the line, the
  one played is parked there and stays standing in it); a member never played is BORN in the town they were met in, one
  played loads their own save (met at a home of the house's own off a town's map - a farm - born there: FB1012d
  SEAT-HOME). It is refused on the card, with its reason, mid-fight, while the Succession waits
  (AUDIT LEGACY III F13/W7: "online" was dropped from this list - the Online bullet below has it open), and for a retired elder ("has passed the mantle on, and keeps the house now").
- **Struck down.** One of the line killed by the one played (the town's one-hit civilian, LW7) dies IN THE RECORD -
  `died` with cause `slain` and by whose hand, a world fact, the store's (AUDIT LEGACY's first authority) - said on the
  HUD, and stands no more; never a death in the town's lives (`livingDeadAt`/`livingSlay` pass them to the host).
- **Killed in the street** (PROJECT LEGACY'S MERGE OF MAIN'S #630: WATCH-PROTECTS lets a beast hunt the town's people,
  and its first landed blow kills). One of the line a beast kills dies IN THE RECORD the same way - `died` with cause
  `fell`, by no hand of the house (`kinKilled`), the store's, the towns' news, said on the HUD - and never takes the
  census's turn (`livingKilled` passes them to the host first: a turn of the lives' named a census place not theirs,
  and the record, alive still, stood them again with the next day's people). A townsperson killed so ends their
  courtship, as one struck down does. Neither death lays remains or a quest: those are the one played's (section 4).
- **Online** (LEGACY7 part five, `test/systems/legacy/legacy7_homes.test.js`, `tools/mutants/legacy7homes.json`): the realm keeps the
  line, so a realm character's ONLINE HOMES (HOME1, `systems/online/onlineHomes.js` - a home is a realm character's) are its
  houses, learned with the save as a deed is offline: the world reads this realm character's rows of the account's
  homes (`/v1/homes/mine`, each named by its town) at the boot and after each home of mine is bought, sold or changed
  (the registry's `onWrote`), and hands them to the house; a list not read yet learns nothing and drops nothing. So the
  line lives in its online homes as offline in its deeds - parked there, the family home among them - seen by this
  player alone (the Living World is each client's own). **AUDIT LEGACY II F2/B4 moved by its own slice:** that audit
  found the realm's homes learned against the arc's word that they were the account service's, and shut them out; the
  realm holding the line is what makes them the line's. Play as is open online - a member is a realm character of their
  own. A character copied between the lanes (the
  realm's customs, Copy to offline) is a new character of no house: both doors drop the record (AUDIT LEGACY II H1).
- **The Living World.** The line stands only in the Living World's towns (AUDIT LEGACY II B5): with it off (the classic
  screens, or the Features row), nobody of the line stands anywhere, the card says no home, and the House page says
  why. Each is their OWN household (`household`, AUDIT LEGACY II B2): a census house lent to the line shares no kin, no
  grief and no keepsake with its census people; a resident whose home changes is planned again at once (B3); the same
  resident objects stand while nothing they are made of changes (P3: a save no longer dressed them all anew).
- **The switch.** "Family In World" (Project Legacy's settings, `Legacy.Family In World`, on the tile), on by default;
  off, the family lives in the Family tab alone, and its houses' rooms are the census's again.
- **The House page** lists the homes - each house, whose deed, the family home marked, "Make this the family home" on
  the others - and the card says where each member lives ("At the family home in Sentinel", "In their own house",
  "In Gothway Garden, among its townsfolk", "On their own journey").

## 10c. THE HOUSE OF THE DEAD (PERMADEATH-HOUSES)

*Built: PERMADEATH-HOUSES (2026-10-09). The law is `systems/legacy/household.js` (`deedsDue`, `syncHouses`' `taken`,
`heldByDead`); the host's half `scenes/legacyHost.js` (`takeDeeds`); the world's `scenes/world.js` (`legacyInheritHouse`);
the scene handed on `systems/sceneCache.js` (`graftPermanentScene`); online `server-account/src/homes.js` (`inheritHome`,
`/v1/homes/inherit`, acct98 - acct97 on its branch, renumbered past SERVER-POST and HOURS-FIRST at the merge). Pinned in `test/systems/legacy/permadeath_houses.test.js`, mutation-proven in
`tools/mutants/permadeathhouses.json` (30, all dead).*

The owner (2026-10-09): "now all that needs to be looked at is what happens to houses owned by dead permadeath
characters and I can go back to playing my family". Asked, he chose **the heir inherits**: the deed is the estate's, as
the gold is.

**What it was.** A deed is the character's own (`banking.js`), so a fallen member's stayed in a save the line refuses to
play (THE PAST, section 3). Their row stood on in `family.houses`, so the line lived on in the house - often the family
home - while the one carrying the line held no deed to it: its door locked at night, no bed of theirs, no cupboard. Online
the tombstone kept its home for good (HOME1's exclusive registry, `afterTomb` touching no home): a building out of the
world, locked to its own family.

**The law.**
- **A HOUSE WHOSE HOLDER IS DEAD IS DUE TO WHOEVER CARRIES THE LINE** (`deedsDue`): the Succession's heir once they land
  (a newborn or a living member), or the one played when one of the line dies in the street (`kinSlain`, `kinKilled` - a
  parked member's house). A living holder's house is theirs; a RETIRED elder keeps theirs (section 6 - "keeps the house"),
  and the service refuses one as the client never asks it. Nothing is taken while the Succession waits, by the past played
  back, or on a page the line has left (the tick's own guards); and never at the birth - online the first save is held to
  a newborn's purse (`realm.js firstSaveRefusal`), so the first tick after the birth takes it up.
- **THE DEEDS A MEMBER DIES HOLDING** are the live ones: the fall syncs them before it records the death (`onDeath`), as the
  estate reads the live purse - a house bought since the last save is the line's, and the gold it cost left the estate
  with it. An Enduring member who rises keeps their house; one who dies of their years leaves it, as a fall does.
- **TAKEN WITH THE SAVE** (`deedsTaken`, the save's word as `estatePaid` is - `mergeFamily`, and a member's own save field
  in `store.js MEMBER_SAVE_FIELDS`): the world hands the house over (below), the taker's `deedsTaken` names it, and the
  next save that holds it makes the row theirs - in its own place (AUDIT LEGACY II A5), naming who left it (`from`; the
  House page: "Tlist Hlaalu's deed, left by Ysolde Hlaalu"). Taken and sold before that save, the row goes. A save that never
  took it (an older one loaded) hands it back to the dead, and it is taken up again, as an estate is paid again; so a
  reload never loses the house and never gives it twice. Meanwhile the row is the dead's: the family lives on in it, and
  the House page reads "The late Ysolde Hlaalu's deed - it passes to whoever carries the line".
- **ONE A REGION** (DaggerfallBankManager's `houses[regionIndex]`): a taker who already holds another house in that
  region cannot hold two, so the inherited one WAITS - said once a page ("... waits for you - you keep a house in that
  region already, and the bank deeds one a region. Sell yours there to take it up."), taken up the first tick the slot is
  free. **Departure (recorded):** offered as "sold into the estate", it waits instead - DFU prices a house off its
  building's model (`housePrice(meshRadius)`), which only its own town's directory can read, and a waiting house is not
  lost: the family still lives in it and the player chooses which to keep.

**Handed over** (`deps.inheritHouse(row, fallen)` - `'given'`, `'waits'`, `'gone'`, or still asked):
- **Offline** - Daggerfall's own deed (`allocateHouseToPlayer`: the slot, "<heir>'s residence" on the map, the notebook's
  deed) in the layout the fallen's deed named it in (WD3 - the row carries `layout`), and THE HOUSE AS ITS OWNER LEFT IT:
  its scene and its other layouts' visits out of the fallen's own newest save (`loadSlot`; the save's cache holds the live
  interior when they saved inside it), permanent, sans corpses (`graftPermanentScene`) - the chests, the placed pieces,
  the things set out, the furniture taken out. A slot already holding that very building is given as it stands (the
  heir's own world's furnishing kept).
- **Online** - the account service moves the home (`inheritHome`): a LIVING realm character of the fallen's line
  (`lineage_id`), the fallen a tombstone that FELL, the same account, never a guild's hall; one UPDATE naming the fallen
  as the holder, so two takers race to one answer. Everything the row owns moves with it - its pieces, its rooms and rent,
  its entry, its sale (its `paid` - the deed's share comes back to the heir's record if they sell). Its cupboards are the
  fallen's realm record's (HOME1: the owner's storage is the owner's save), read through `/v1/realm/<id>/data` (a
  tombstone's record is read, never written) and grafted under the home's scene. A Knightly Order's house the realm held
  (KNIGHT-HOUSE's deed row) is Daggerfall's bank deed as well: one a region, and the deed and its house scene given as
  offline. A home the fallen sold after their last save reached the line is `'gone'` and leaves the line's houses.

## 11. THE UI (Enhanced Plus)

- **The Family tab** of the pause window (Mac: "implement it into the pause menu as a new tab"; KB1 action
  `LegacyFamily`, the keypad's slash), drawn while Project Legacy is on, on either skin (the pause window is the
  enhanced one; Ledger A row (9)) - `ui/familyPages.js`, four pages on the rail (the fourth, **How it works** - the
  family's whole law in words - PLAIN-UI's, 2026-10-12, at this page's foot):
  - **The tree**: generations as rows, couples joined - every spouse a member has had beside them, the earlier on the
    left, each marriage's children hung beneath it (AUDIT LEGACY III A14/U4) - and stacked under its card by the pane's
    width, never the window's (U3); the dead and the one played marked on
    their plates; pan by dragging, zoom about the pointer or with the tools (top right), centre on the one played; a
    plate pressed opens **the card** - face, age and span, Arkay's toll, the blood and the hearth, the eight stats and
    the career's skills by name once played, parents, spouse, siblings and children as links, its chips (played,
    fallen, died of years, at peace / lies unclaimed / carried home, retired, elder, has an heir, not yet played) and
    the acts: Play as (a switch: saved first, never mid-fight; online, through the realm - LEGACY7) and, for an elder, Pass the
    mantle - each refused on the card before the press, with its reason.
  - **The house**: its model, its seat, its generations, the living and the fallen of the blood (how, where and by whom
    each fell; a spouse among the house's dead said wed in - AUDIT LEGACY III A15/U9/F6), and
    (LEGACY-HOME) its homes, the family home among them, the player's to choose (section 10b). FAMILY-SEAT (FIELD BUGS
    2026-10-07b, `01-Overview/bugs/Field-Bugs-2026-10-07b.md`; afjiz: "the option in the enhanced ui to reset your family
    seat to a town your currently in"): the seat noted at the first town - a road crossed, a journey's way - moves, two
    presses as a switch is, to the town the one played stands in (its streets or a building of it, never a dungeon
    under it; never while a Succession waits): `Make <town> the family seat` (`scenes/legacyHost.js` familySeatHere,
    moveFamilySeat). FB1012d SEAT-HOME (`01-Overview/bugs/Field-Bugs-2026-10-12d.md`; "the house (admittedly a tiny hovel on
    a farm) purchased and made the seat of the house ... was not where the heir ended up spawning"): or to a place where
    the house holds a home of its own - a farm, a manor (`placeHere`, by the place's map id against the line's houses). The heirs are born there, the fallen laid to rest there, the house's news told there, and a house
    with no home lives there; the house keeps its name. A moved seat carries when (`seat.at`, the wall clock - after the
    stamp of the seat it moves), and the later move stands in every merge, whichever copy is the newer
    (`systems/legacy/store.js` mergeFacts, `scenes/legacyHost.js` mergeFamily) - the newer copy by rev kept its own seat,
    so a stale tab's write carried the old one back over the move. The name stays the house's in every merge: a copy
    that never learned it takes it from the copy that holds it (`systems/legacy/family.js` nameHouse) - never names
    itself for a moved seat. Where the move is not offered, the page says where it is. (AUDIT FB1007b S1-S5, T3:
    `01-Overview/audits/Audit-FB1007b.md`.)
  - **The Hall of Ancestors**: every house founded on this machine, living and ended, with its generations and counts.
- **The Succession** (at a final death, a passing of the mantle, or a save of the past loaded): its own window
  (`ui/legacy/legacySuccession.js`, `ui/legacy/legacyDoor.js`), the death's own screen while it stands - the fallen's line, then the
  living who may carry it, then "A child of <name>" - one press; the keyboard and the pad walk it; Escape answers
  nothing (a death must be answered).
- **The model's question** at the founder's chargen, after the leveling system's, on its screen (both skins): Enduring
  first, the toll a death will charge said; Bloodline open online, its last line saying the realm holds the line on every
  device (LEGACY7 - AUDIT LEGACY B4 had shut it while a permadeath had no authority there).
- **The HUD**: the founding, the seat, the elder's word once, Arkay's toll at a rise, the estate and the bequest, the
  remains found, carried and laid to rest.
- **The character sheet** (LEGACY-SHEET - the arc's first plan, "the age and the elder's word on the character sheet",
  which AUDIT LEGACY F2 found never built): the pause window's Stats page, its Character section, draws the one played's
  house off their own card (`ui/familyPages.js sheetHouse`, `ui/enhanced/enhancedMenu.js statsCharacter`) - the model and the
  generation, and in an Enduring house the age against the span, Arkay's toll and the elder's word ("An elder of the
  house: the mantle may pass from you on the Family tab."; "Your span is spent: your next death is your last."). One line
  of age (`ageWord`) is the card's and the sheet's, so they never disagree. The classic skin's F5 sheet is DFU's own art
  with no slot for it; the pause window carries it in either skin. Pinned in `test/systems/legacy/legacysheet.test.js`, mutation-proven
  in `tools/mutants/legacysheet.json`.
- **Not built** (recorded): the mod's classic 1:1 window in its own art (its pictures are the classic UI's own cuts,
  section 1; Ledger row (9): every skin draws the Enhanced Plus tab), a house's standing by region apart from its
  members' (section 10's departure).

## 12. The slices

| Slice | What | Status |
|---|---|---|
| LEGACY1 | vendored; the family record and its store; the save data; inheritance; the heir born through the seam; Bloodline's death and succession offline; the switch; the settings, the Features row and the key | built |
| LEGACY2 | Enduring: the span, the toll, the offline respawn, the elder, passing the mantle; the model's chargen question | built |
| LEGACY3 | the Family tab (Enhanced Plus); the Succession; the Hall | built |
| LEGACY4 | heirlooms, the remains, the death quest, the rest and the blessing | built |
| AUDIT LEGACY | the five-lens audit of LEGACY1-4 (`01-Overview/audits/Audit-Legacy.md`) - the two authorities, the death at the door | built |
| LEGACY5 | courting, marriage, children, surnames' cadet branches | built |
| LEGACY6 | world influence: the inherited standing and regard, the towns' talk, the killer remembered | built |
| LEGACY7 | online: the service's lineage, the tombstone, the heir's realm birth, the house name; two players wed (part three); the line in its own body (part four) and in its online homes (part five) | built |
| LEGACY-SHEET | the house on the character sheet: the model, the generation, an Enduring house's age, toll and elder's word (section 11) | built |
| LEGACY-NAME | a house founded nameless named at its seat; a seat's house said once; the news's doubled surname (section 8) | built |
| FAMILY-SEAT | the seat moved from the House page to the town the one played stands in; the later move stands in every merge, and the house's name with it (section 11; `01-Overview/bugs/Field-Bugs-2026-10-07b.md`, `01-Overview/audits/Audit-FB1007b.md`) | built, audited |
| FB1012d | HEIR-CLONE (the page bearing an heir offers no Succession; a save writes only the one in the world), SEAT-HOME (the seat moved to a home of the house's own - a farm), BIRTH-START (the Online page's birth in its seat); UNION-CHILDREN planned (sections 4, 9, 10b, 11; `01-Overview/bugs/Field-Bugs-2026-10-12d.md`) | built |
| LEGACY-CHOICE | the popup online: Enduring, Bloodline or no lineage at chargen, kept on the character; online a house founded at a birth alone - a character loaded with no house plays without one (section 6) | built |
| AGELESS-CURSE | the cursed pay no toll: a vampire, a werewolf or a wereboar in an Enduring house rises from every death with no years taken, the span spent or not; cured, the toll again (section 6) | built |
| LEGACY-HOME | the bloodline in the world: the family home, the seat's townsfolk, their day, Play as by talking (section 10b) | built |
| AUDIT LEGACY II | the six-lens audit of LEGACY1-4 and LEGACY-HOME (`01-Overview/audits/Audit-Legacy-II.md`) | built |
| AUDIT LEGACY III | the six-lens audit of the whole arc, server side too (`01-Overview/audits/Audit-Legacy-III.md`) - character-bound weddings, the line's own route bound, the write made from what it read, two copies' persons kept apart, the news on the reader's clock | built |
| FB1013d | REMAINS-STAND (the remains seen where they lie: a body over the record's own list), LIVE-FIGHT (the remains' fight is the place the heir stands in); ESTATE-WIDER planned - the wagon and the bank's balance, the owner's call (section 7; `01-Overview/bugs/Field-Bugs-2026-10-13d.md`) | built |
| AUDIT FB1013d | the three-lane audit of REMAINS-STAND and LIVE-FIGHT (`01-Overview/audits/Audit-FB1013d.md`) - the fallen's dungeon by its row, its pixel, its own key and the size it was built at; the height the death's to ask; a duel and a hostile ship a fight; a claim lapsed at the stand lays its bones at once; a load lets the bodies go and the tick waits out a world moved; the bones put back lie again | built |
| REVIVE | a death taken back by the operator, and it holds: the `revived` stamp every copy and the realm's write honour; the "Realm revive" run (Time Travel read, guarded writes) - for TheHalfinStream, Mac: "Full revive" (section REVIVE) | built |
| REZ-BLOODLINE | a friend's Resurrect saves a Bloodline character: online the door writes the death and the realm holds it (its tombstone's hold) while a Resurrect can raise it - the realm's yes takes it back on every copy; the window closes at the reset, its end, a load or the page going (a killed tab: the realm's minute); closed, the body stays down and the caster is told; AUDIT R1-R3 (section REZ-BLOODLINE; `01-Overview/bugs/Field-Bugs-2026-10-16b.md`) | built |
| HEIR-WHOLE | the remains of a death in an instance reached: they lie in the dungeon whole, and where the world lays its public room smaller the death quest's place is "a dungeon with your quest" - its door offers the heir an instance of their own, one room a death while they lie, which stands them where they fell; public-room remains as they were (section 7; `11-Multiplayer/Instances.md` section 4; `01-Overview/bugs/Field-Bugs-2026-10-19f.md`) | built |

## WED-GATE - a character who may wed, weds (FIELD BUGS 2026-10-08)

Sahh: *"Characters that have chosen Enduring or Bloodlines as the Project Legacy option cannot seem to marry each
other"* - two of either model, in a party or not, at a temple of theirs or not: Propose marriage grey every time. The
world host's `wedCan` (`scenes/world.js`) read the house's answer as `legacyHost?.wedRefusal() ?? 'house'`, and
`wedRefusal` answers NULL when the one played may wed - so `??` turned every "may" into "no house": the button grey with
"Only a character of a house (Project Legacy) can wed in the realm.", and the same `can` refused every proposal sent,
answered every one received `no` and refused every Yes (net/wedSession.js). Since LEGACY7 part three's first line; AUDIT
LEGACY III's prefix (never lying dead) kept it. Now `legacyHost ? legacyHost.wedRefusal() : 'house'` - 'house' only
with no house host. The model (Enduring or Bloodlines) was never read by either gate, the realm's included. THE FOUR
HOSTS: the wedding is the world host's alone (`scenes/exterior.js`, `scenes/worldModes.js` and
`scenes/dungeonContext.js` carry no realm session). `test/systems/legacy/legacy7_wed.test.js` runs `wedCan` out of its own text (the
null is null, each refusal the house's own, the dead, a death, a relay that cannot carry it, offline);
`tools/mutants/legacy7wed.json` FB1008-wed-the-null-read-as-no-house, dead. Its standing survivor
LEGACY7W-partner-dead-or-lineless survives on main as well - not this change's, recorded for its arc.

## PLAIN-UI - How it works (2026-10-12)

The Family tab's fourth page, HOW IT WORKS (`src/ui/familyPages.js` `familyGuide`, `drawGuidePage`): the house, death in the house's own model and its toll, who carries on, what carries on (the estate to whoever takes the line; the blood and the hearth a newborn's, at birth), heirlooms and remains, marriage and children, playing another, and the tree's marks - every number the law's own - and the tab's type a step larger. AUDIT PLAIN-UI (`01-Overview/audits/Audit-Plain-UI.md`) set its words against `family.js`, `heirloom.js`, `marriage.js` and `scenes/legacyHost.js`. A player: "Same issues with the project legacy system." The record: `10-UI/Plain-Words.md`.

## REVIVE - a death taken back, and it holds (2026-10-14, acct132)

Mac, of TheHalfinStream's Enduring elder - who died of her years in Castle Wayrest on 2026-10-13 while the remains bug
(`01-Overview/bugs/Field-Bugs-2026-10-13d.md` REMAINS-STAND) hid what she lay with: *"I want to roll back this specific
account"*; of three ways offered, *"Undo the death"*; told a plain undo would not stick, *"Full revive"*.

WHY A PLAIN UNDO DOES NOT STICK. A death is a fact every copy of a line keeps (`store.js` mergeFacts: "a death is only
ever added"), and every device that played the line holds a copy - its store, every member's save. Clear the death from
the realm's copy alone and the first stale copy to meet it adds it back; the realm's write (`legacy.js` putLineage) then
entombs her again (entombLineDead). So a death taken back is a fact of its own, carried the same way.

THE LAW (`src/systems/legacy/revived.js`, pure, the client's and the service's): the person is stamped `revived:
[diedAt]` - the `died.at` of each death taken back - and every copy that meets the stamp drops THAT death and what it
laid: her `died`, the remains row (`of` her, `at` it) and the Succession it left waiting (`pending`, `fallenId` her,
`at` it). A later death is another `at`, and stands. Three doors hear it: `store.js` mergeFacts (whichever copy carries
the stamp), `legacyHost.js` mergeFamily (the save against the store, when the store is the base) and
`server-account/src/legacy.js` putLineage, which takes the STORED copy's stamps into every copy sent before it is shaped,
compared or entombed - so a device that never heard of the revival writes no death and entombs nobody. `family.js`
readFamily keeps the stamp. No migration: the stamp rides the record, and putLineage already read it.

THE OPERATOR'S RUN (`tools/reviveRealmCharacter.mjs`, `.github/workflows/realm-revive.yml` "Realm revive"), by hand,
a dry run by default, its inputs as environment, RESTORE C's Time Travel pattern (`realm-restore.yml`): the fallen
found first (her death in the window 2026-10-12T12Z-2026-10-14T12Z, or the `character` named), nothing held until
then; the account service held for maintenance (~1 minute); the present bookmarked and counted; D1 rewound to two
minutes before the death and read (her seat, her homes, the pieces she held, her unions); the present ALWAYS put back,
proven by its counts; what stands now read and planned; the plan written only with `apply` on; the hold lifted, never
over a rewound database. What it writes, each statement guarded on the row as the plan read it (a second run writes
nothing twice; a run cut short is planned again):

- the tombstone (`realm_characters.dead_at`, `dead_why`) cleared, only over the death the plan read and only while the
  roster has room - her save, the last checkpoint before the death, is hers again with everything she carried;
- the line's record stamped and her death dropped, the house rows her heir took up hers again (`from` back to `by`),
  its rev moved `REV_MARGIN` (100) past every copy's, written only at the rev it read;
- the homes her heir inherited (`homes.char_id`) hers again, where her heir still holds them (`keep_homes` leaves them);
- her guild seat put back as she held it - HELD when she was the master and another was made master at her death, or
  the guild is gone or full (`keep_guild` leaves it);
- the ledger: the pieces she held that her heir holds now hers again, the heir's copies known copies (`item_dupes`) -
  else her first checkpoint claims them and the heir's proves them copies charged to her; what nobody holds her
  checkpoints register again; what another account holds is HELD;
- her union with another player's character REPORTED, never reopened - their house heard she died.

Her heir stays, a living member, theirs to keep or delete from the Online door. Her years stay spent: an Enduring
elder's next death is final, as it was. `test/systems/legacy/revive.test.js` (9) runs it over a real death on the real Worker's
service - the plan applied and run again, a stale device's write after it, the held cases, the tombstone guard, the
workflow's shape; `tools/mutants/revive.json` (30) all dead.

UNVERIFIED until the dry run reads production: whether she played online at all (offline, nothing here applies - her
device's own store holds the death), whether she held a guild seat or a union, and that Time Travel still reaches
2026-10-13 (thirty days on the Paid plan, seven on the Free one).

REVIVE-MODE (2026-10-14, the first run). Mac ran "Realm revive" for TheHalfinStream with `keep_homes` and `apply` on.
It found her (`r72ba7934a8847d28597a`, read two minutes before her death, 2026-10-13T03:21:42Z), held the service,
rewound, read, put the present back (proven by its counts) and failed at the plan: the tool chose its mode by asking
whether `--find` was ANYWHERE in its words, before asking `--plan` - and the plan's own line carries `--find
<found.json>`, so it ran as a find and read a facts file the line never named ("The "path" argument must be ... Received
null"). Nothing was written; the hold lifted; acct132 answered. The mode is now the first word alone, and
`test/systems/legacy/revive.test.js` runs the tool's `--find` and `--plan` as the workflow's own lines write them (mutant
REV-the-mode-any-word, dead). The run is to be made again.

REVIVE-SIZE (2026-10-14, Mac: "are you sure it works"). Read against what the first run found - her line at rev 307, a
guild seat, three homes, 101 ledger pieces, a union - the plan wrote the line's WHOLE record into one statement, and a
record may be 128 KiB (LINEAGE_MAX_BYTES) where D1 refuses a statement past 100 KB. The record is now an EDIT IN PLACE
(`recordEdit`: SQLite's json_set/json_remove over the stored text - the people changed, set whole by index; the remains
rows dropped, by index, the last first; the Succession; the house rows changed; the rev), proven before it is answered
(the same edit made in the tool must give the law's record exactly, else the line is held). The line is written BEFORE
the tombstone, so a write cut between them leaves her dead under a stamped line - run again - never alive under a line
whose next write entombs her. And a plan with any statement past STATEMENT_MAX_BYTES writes NOTHING. Checked with it:
nothing deletes a fallen character's saves (no cron touches realm_characters or the bucket; a tombstone only refuses
writes) and the game never checkpoints a dead character, so the save the revival hands back is her last before the death.

## REZ-BLOODLINE - a friend's Resurrect saves a Bloodline character (FIELD BUGS 2026-10-16b)

THE REPORT ("Bloodline Resurrection."): *"I was testing with a friend, he dies and I cast resurrection. It works for a
moment then he disappears and remains dead."* The screenshot: "...of Gothway Garden has Fallen - You died without a
descendant. There is no one left of the house of Gothway Garden. The line ends here, and its tree is kept in the Hall of
Ancestors."

FOUND. AUDIT LEGACY A1/B3 (`01-Overview/audits/Audit-Legacy.md`) decided a death AT THE DOOR so an F11 or a closed tab could not
undo it - and online, since LEGACY7, the door wrote everything a Bloodline fall writes: the death on the record, the
remains, the Succession waiting (`family.pending`), and the realm's tombstone (`POST /v1/realm/die`: `dead_at` stamped,
the lease dropped). RESURRECT1's rise (`world.js` resurrectInPlace: the heal, the death screen closed in place) touched
none of it - "it works for a moment". Within a second the slow step (`legacyHost.js` tick) let its latch go and answered
the Succession still waiting on the record; the world host opened it over the living body - no member, no heir: the
line ended. Only the operator's REVIVE (above) could take it back.

THE DECISION (2026-10-16): a resurrection from an ally SAVES a Bloodline character. THE LAW (`scenes/legacyHost.js`
onDeath, `writeDeath`, `decideDeath`, `raise`, `takeBack`, `raisable`, `pageGone`; `server-account/src/legacy.js`
realmDie's `hold`, `realmRaise`, `settleHolds`) - as the slice's audit left it (AUDIT, below):

- **The door WRITES the death, online as offline** (`legacyHost.js:"writeDeath(h, { hold: online });"`): the death on the
  record, the remains, the Succession waiting, the device's store and the realm's copy of the line behind it, and the
  realm's tombstone asked with its HOLD (`legacyHost.js:"entomb({ hold });"`). THE REALM HOLDS THE DEATH, never the page:
  `realmDie` with `hold` stamps `dead_at` at once - from there no door joins, checkpoints or trades the character - and
  keeps the lease that fell aside (`realm_characters.rez_lease`, migration 0122) for a Resurrect, what a tombstone takes
  with it (the union ended, the guild seat handed on, the pieces let go - afterTomb) waiting on the window's close. A
  line's write that first carries the fall of a character in play holds it the same way (entombLineDead: the line can
  land before the tombstone). A page killed under its death screen, or a join from another device, escapes nothing.
- **The window** is `REZ_HOLD_S` (`systems/legacy/revived.js`, 150 s: the longest an online death screen stands - the
  body's minute, the open zone's two - and half a minute; one number at both doors, `REZ_HOLD_MS` on the page). It
  CLOSES at the first of: the player going on (the death screen's reset - Enter or its count - `deathOutcome`); its end
  (the slow step); the page going (pagehide - `pageGone`, by keepalive, AHEAD of the realm's leave; the session is the
  dead's so the leave sends nothing); a load or a new game over it (`adopt`, `newGame`: F11, the pause's Load, a
  same-dungeon load); a body up that no Resurrect raised. Closing tells the realm (`realmDie` without `hold` - what a
  tombstone takes goes now) and the house's towns (the death's news, told once it stands). A window no page closes - a
  killed tab - the realm's minute closes (`cron.js` `rez-holds`, `legacy.js:"export async function settleHolds({ db, nowS, budget = () => true }) {"`).
- **A party's Resurrect inside the window asks the realm** (`legacyHost.js:"function raise(rez = null) {"`, asked by the
  fallen's own frame before it rises - `world.js:"if (rez && legacyHost?.raise(rez) !== false)"`), and the body stays
  down until it answers: `POST /v1/realm/raise` (`legacy.js:"export async function realmRaise({ db, nowS }, playerId, { id, lease, diedAt }) {"`)
  takes the death back only of a character of the account's own line, under the lease that fell, inside the window,
  with no other of the account's characters in play since (ONE-SEAT), once. Its yes clears the tombstone, hands the lease
  back (the session plays on at its own sequence: nothing was checkpointed over the dead) and stamps the line's copy
  with the death taken back - the REVIVE law (`revived.js`, section REVIVE): the person stamped `revived: [diedAt]`, and
  every copy that meets the stamp drops the death with its remains and its Succession. The page takes it back the same
  way (`legacyHost.js:"function takeBack(h) {"`), gives back what recordDeath took off them (their look, the news they
  heard), and rises on the next frame - on the call the realm let go (`raised`) though the caster's pose has stopped
  carrying it. A call the realm never heard (offline) is said ("The realm did not hear the call that would raise you")
  and the next call asks again; a refusal is said ("The realm will not let you rise. Your death stands.") and closes the
  window. The player going on while the realm answers rises by the host's own respawn, and the answer is the death's: a
  yes leaves the line as it was, a no offers the Succession. A death after one taken back is a death of its own, its
  minute past the stamped one (the stamp knows a death by its minute). An Enduring member's toll is taken at the door
  too, and a Resurrect gives the door's years back at once - the page's own (no tombstone stands for a rise); a copy that
  took another's toll in since keeps it (mergeFacts holds the greater).
- **Closed, the body stays down.** The fallen's frame refuses the call (no living body, then the line's end), and their
  party pose says so (`fg`, net/wire.js validPartyPose - relay world212), so the caster is refused BEFORE a point is
  spent, in the fallen's name: "Ysolde has fallen for good. No spell will raise them now."
  (`hostMagic.js:"if (fallen?.gone) { say(RESURRECT_TEXT.forGood(fallen.name)); return false; }"`; the release and a
  caster-only Resurrect's readying say it too). A relay before world212 drops the field (world208, world209, world210 and world212
  are other branches' relays): the caster spends, and the fallen's client refuses the call as ever.
- **Offline nothing changes**: no party can raise them - the door decides, A1/B3 as recorded. **The Hour** keeps its
  one life (SD-ONELIFE: no Resurrect there), so a death in it is closed at its screen's reset.

DEPARTURE (named in `01-Overview/audits/Audit-Legacy.md` at A1/B3's law): online a fall is the realm's at the door and stays
raisable for its window; offline the door decides, as recorded.

AUDIT (2026-10-16, the slice's own audit - `01-Overview/bugs/Field-Bugs-2026-10-16b.md` REZ-BLOODLINE AUDIT):
- R1 (BLOCKER) - the slice HELD the online death in the dying page's memory, unwritten, until the window closed: a tab
  killed with no pagehide (a crash, the task manager, a phone discarding a background tab - and a hidden tab runs no
  frames, so the slow step never closed it) or a join from another device during the hold (the join took the lease, and
  the dying tab's keepalive tombstone was refused under it) escaped a Bloodline permadeath and an Enduring toll -
  reopening AUDIT LEGACY A1/B3. FIXED as above: the door writes it and the realm holds it; the Resurrect is the realm's
  to take back.
- R2 - below ten frames a second the open zone's death screen counted the frames' clamped time while the hold ran on the
  wall clock: the window closed (a Resurrect refused "fallen for good") with the screen still saying "RISING IN 15".
  FIXED: an online death screen counts the wall clock (`deathScreen.js:"if (this.online) this.clock = Math.max(this.clock, (Number(this._wall()) - this._fellAt) / 1000 || 0);"`),
  never behind the frames' own count.
- R3 - this section said "relay world208": the relay that carries `fg` is world212 (world208, world209 and world210
  went to other branches) - corrected above.

THE FOUR HOSTS: `scenes/world.js` WIRED, on lines it had (bootWorld stands at its ceiling): the death screen's frame asks
the rise (and rises on the call the realm let go), the party pose carries `fg`, the caster's pick reads it, the tombstone
carries `keepalive` and `hold` and the raise rides beside it, the page's going asks Project Legacy first.
`scenes/worldModes.js` and `scenes/dungeonContext.js` hold their death screens in the mode's slot - the same world.js
frame hears the Resurrect under them (`modes?.deathUp?.()`), their resets ask `legacyDeathReset` through
`onlineRespawn`, and their screens are the same `DeathScreen` (the wall clock's): wired through world.js.
`scenes/exterior.js`, the fixed city, has no Project Legacy (section 3's FLAG) - unchanged. Pinned by
`test/systems/legacy/fb1016b_rezbloodline.test.js` (5, over the real death door, host, realm session and the line's realm copy on the
real account Worker and its minute's clock, party wire, caster's cast, death screen and world.js's own statements);
`tools/mutants/fb1016b_rezbloodline.json` (all dead - the record's count in the Field Bugs section).
