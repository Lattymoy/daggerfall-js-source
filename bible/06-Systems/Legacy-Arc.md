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
byte, its IL dump and the seven pictures - and read off the DLL's IL (decompiled to C# by ILSpy 8.2 for reading; the
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
  father's line's surname 90% of the time, the "lore surname change" otherwise - race 70% the parent's, a random
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
| D1 | Migrating a save older than 0.0.3 throws on an empty list | the loop reads `CharacterData` before its null check | the port's record has one version and its own reader (no DFU save is read) |
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
| S3 | A switch is free fast travel, even mid-fight | the anchor teleport | a switch is a save and a load; a fight refuses it (`legacySwitchRefusal`) |
| S4 | Yes pops three windows: the box, the card, and whatever was under the tree | `PopWindow` inside the switch plus two closes and a pop | one close, the overlay slot's |
| U1 | The wheel zooms about the corner and reads the wheel under other windows | no re-centre after the rebuild; `Input.mouseScrollDelta` read raw | zoom about the pointer, inside the window's own handler |
| U2 | The dead and the living, the one played and the rest, look the same | `P_DEAD`/`P_ACTIVE` frames are never drawn | the living, the dead, the played one and the heir each drawn so |
| U3 | Skill labels read "HandToHand", "CriticalStrike" | `Enum.GetName` | `SKILL_NAMES` |
| U4 | The card reads its character before its null check | Setup is lazy and the data is sent after the push | the card is built with its person |
| U5 | A second tree window shares the first's root | `static FamilyNode root` | the layout is a pure function of the record |

## 3. ONE FAMILY, MANY CHARACTERS - how the mod's model lands on the port's

DFU's mod keeps the line inside ONE save: the heir and every sibling are the same `PlayerEntity` with other numbers
poured in. The port's characters are each their own (`characterId`, CHARID1): their own saves, their own world clock,
their own quests and regard (Living World decision 6). Pouring one into another is exactly what produced B1, B2 and
S1. So in the port:

- **A family is its own record**, `legacy/family.js`: the line's surname, its model (section 6), and a PERSON for
  every member - played or not - with their identity, their eight stats and thirty-five skills as last known, their
  career and its skill groups, their parents, children and spouse, their birth and death, and once played their
  `characterId`. Ids are minted from the record's own counter.
- **Where it lives.** Offline: in app storage under `dagger.legacy.family.<familyId>` - the family outlives any one
  save - and as a copy in every member's save (`modData.ProjectLegacy`), the newer by `rev` winning on load, so a
  save carried to another machine brings its family. Online: on the account service (section 9), the save's copy a
  courtesy.
- **A person is played by being loaded.** Switching to a member who has been played loads their newest save; to one
  who never has, boots them BORN (section 4). The member left keeps their place in their own save, which is what the
  mod's anchor was reaching for (D7, S3).

## 4. THE HEIR IS BORN

A new member enters play through the same door a new character does - `chargenSession.applyHeadlessChargen`, which
now takes a person's identity and rolled values (`{ person }`) and runs the whole construction seam: the career from
its CLASS*.CFG, `applyCharacter`'s derived health, magicka, fatigue, tallies and level-up anchor, the starting spells,
DFU's starting kit, the faction store and the region bootstrap, the leveling system. Nothing of the dead rides along
but what section 5 hands down.

The boot: `?legacyborn=<personId>&region=<r>&loc=<l>` - the pending birth is held in session storage
(`legacy/handoff.js`), the boot's chargen arm builds the person instead of opening the wizard, and the family's record
is the new game's `ProjectLegacy` save data. The heir is born in a TOWN: the family's seat - the town of the founder's
first save - else the nearest town to where the parent fell (B11's root, a coordinate pair that is no place, gone).

## 5. INHERITANCE - the blood and the hearth

- **Career.** Half the time the parent's career (custom careers included - the career rides the person); otherwise
  one of DFU's eighteen, uniformly (B5).
- **Race.** 70% the parent's; else the other parent's if there is one (section 8), else uniform over the eight (B4).
- **Sex** even; **face** uniform over the race's ten (B6).
- **Name.** A first name from the race's bank (`nameHelper.firstName`); the FAMILY's surname 90% of the time - and
  "a lore surname change" otherwise, the mod's own line, a new surname from the bank which then becomes theirs and
  their children's. A Redguard bank mints no surname; a Redguard heir still carries the family's.
- **Stats.** DFU's own roll for the career (`rollStats` and its bonus pool spent lowest-first) - then THE BLOOD: each
  stat `+ clamp(round((parent's - 50) / 10), 0, 3)`. A great parent gives a little; a poor one takes nothing.
- **Skills.** DFU's own roll (`rollSkills`) - then THE HEARTH: each of the parent's primary and major skills
  `+ clamp(floor(parent's / 20), 0, 3)`. What the parent practised, the child grew up seeing.
- **Kit and purse.** DFU's starting kit for the career; and THE ESTATE: a quarter of the gold the dead carried,
  capped at 10,000 (the online birth's liquid ceiling, `REALM_BIRTH_WEALTH_MAX`) - paid as a letter of credit.
- **Siblings.** A birth rolls the new member's siblings: with the setting's probability, one to the setting's maximum
  (defaults 50%, 2 - B14), each a record of their own drawn by the same law from the same parent. A sibling is
  played only when switched to, and is born then (B8).
- **The heir answer** (B12): "Random descendants" rolls ONCE, at a person's birth, whether an heir will come forward
  for them, and keeps it (`person.heir`); "Always" sets it true. A line with a living member never needs the roll -
  any living adult kin can take the mantle.

## 6. THE TWO MODELS - Bloodline and Enduring

Chosen per family at its founding, by the founder's chargen question (offline and online alike), and shown on every
member's card and over their name online. A family cannot change model: the permanence is the point of one and the
safety of the other.

**BLOODLINE (permadeath).** A death is final. The fallen is recorded dead (cause, place, date) and the mantle passes:
the player chooses who carries the line on - any living adult member, or a newborn heir of the fallen (when the heir
answer allows). No member, no heir: THE LINE ENDS - the family is closed as extinct, its tree kept in the Hall of
Ancestors (the menu's Legacy pane), and the next character founds a new one. The heirloom roll is the mod's 50% here
(section 7) and the remains always lie where the fallen fell.

**ENDURING (not permadeath) - the answer to "somehow a persistent model".** A death is not final, but it is not free:
it costs YEARS. Every member has an age and a span (THE SPAN: Breton, Nord 90, Redguard 80, Khajiit, Argonian 85,
Wood Elf 150, Dark Elf 180, High Elf 200), born at a quarter of it. A death in Enduring is ARKAY'S TOLL: the player
rises as the online respawn rises (D-ONLINE1 - the nearest temple, town or graveyard, the death's purse) - offline too,
where the classic death would end the run - and the member is older by 6% of their span (the Mods pane: Light 4%,
Standard 6%, Heavy 10%). The years also pass as they live (the character's own clock, LIVED1: 360 days a year). At
three quarters of the span the card names them an ELDER and the HUD says so once. When the span is spent, the next death
is the last: they die of their years, and the mantle passes exactly as in Bloodline - so an Enduring line still turns,
at its own pace, roughly a dozen deaths a generation. And at any time an Elder may PASS THE MANTLE from the family
window: they retire to the family's seat (alive, kept on the tree, no longer played) and the player chooses an heir.
The heirloom in Enduring is the retiring or the fallen elder's to hand down (section 7) - always one, no quest, or the
quest when they died of their years away from home.

**Offline with Project Legacy off** nothing changes: DFU's death and its title menu. **Online without a family** (a
character made before this arc): the character is founded into an Enduring family at its next load, which changes
nothing about its death but the toll - a player never wakes into permadeath they did not choose.

## 7. HEIRLOOMS AND THE DEATH QUEST

- **The heirloom roll** at a final death: 50% (the Mods pane; Bloodline) or certain (an Enduring elder's last death or
  retirement). The piece is the most valuable weapon or armour the fallen WORE (value, then condition), never a quest
  item, a Legendary of the gate's set or a bound item. It is marked `heirloom: { of, gen, line }` and its name
  carries the family: "Hlaalu's Steel Longsword". A piece already an heirloom is always the one chosen - an heirloom
  is handed down, not found again.
- **The heirloom grows.** Each generation that carries it home adds one to its power (`heirloom.gen`, at most 5): a
  weapon `+gen` to hit and damage, armour `+gen` to its armour value (riding `itemMods` as the Loot arc's affixes
  ride it). A five-generation heirloom is the line's own Legendary.
- **The remains** lie where the fallen fell - in a dungeon, at their last position on its floor (LW6b's `restAt` and
  `layRemains`, the same pile); in the open or a town, at their last position on the ground; in a building, at its
  door outside. The pile carries the heirloom, the fallen's REMAINS (a keepsake-kind item: "The remains of Ysolde
  Hlaalu", LW6c's template shape) and a part of their purse.
- **The death quest**, "The Bones of <name>", is the heir's from their first day: the journal names where, the Quest
  Guide's tracker follows it (GUIDE4) and the marks point at it (GUIDE5). If a revenant or a champion slew the fallen,
  it is THE KILLER STILL STANDS - it waits by the remains as a revenant (Revenants' own record, "Slew"), and must be
  faced. Taking the remains completes the first half; the second is to lay them to rest at any temple (talk: "Lay
  <name> to rest"), or at the family's seat.
- **The rest.** Laid to rest, the fallen's BLESSING: +3 to the fallen's highest skill for the heir (capped by
  DFU's skill cap), the heirloom attuned (its generation counted), and the tree's portrait of the fallen marked at
  peace. Unclaimed remains lie for good (they are the family's, not the world's); a Bloodline heir carries one death
  quest per fallen.

## 8. MARRIAGE, CHILDREN AND SURNAMES

- **Courting** a Living World resident: an adult whose regard of the player is FRIEND (`FRIEND_AT`, 40) and who is not
  wed. The enhanced talk's "Court" adds affection once a day (by Personality and Etiquette, like a word's tone); at
  100 the resident will hear a proposal. A proposal accepted, the two are WED at the temple of the resident's town,
  through its priest's talk ("We wish to be wed"). The spouse
  is a person in the family (`kind: 'resident'`, the resident's id - their name, face and trade are the census's
  forever) and keeps their day; if the player owns a home in their town (Holdings), the spouse's home becomes it.
- **Online**, two players' characters may wed: both in the same temple, both asking the priest, the service records
  the union (each family names the other's member as spouse).
- **Children.** A wed member has a child with a 25% chance each thirty days of their own clock while the spouse lives,
  at most six; the child's race is either parent's, the rest by section 5 from both parents (the blood the better of
  the two, the hearth the played parent's). Children are minors and not played; at a succession any child may take
  the mantle - they come of age in the telling (section 10's departure).
- **Surnames.** The family's surname is the founder's (their name's last word, or "of <seat>" when they have none). A
  spouse takes it if the player wishes (the proposal asks); children always carry it - except for the mod's lore
  change, which founds a cadet branch under the new name on the same tree.

## 9. ONLINE

- **The model is the family's**, chosen at the founder's online chargen. Enduring is the default; Bloodline is marked
  on the online roster and over the player's name (a small skull beside the house name).
- **The service holds the line** (`server-account/src/legacy.js`, migration `0042_legacy.sql`): a `lineages` row per
  family (owner, surname, model, the family's record, its `rev`), and on each realm character its `lineage_id`, its
  `person_id` and `dead_at`. The family's record is read with the roster and written with a checkpoint (`rev` checked);
  the save's copy is ignored online.
- **A Bloodline death is a tombstone.** The client's death sends `POST /v1/realm/die`; the service stamps `dead_at`,
  and from then refuses that character's join and checkpoint: an older save cannot be reloaded past a death, which is
  the whole of permadeath's authority. The tombstone frees the character's roster slot (the dead do not count against
  `REALM_CHARACTERS_MAX`); its name, level and family stay readable in the Hall.
- **The heir's birth** is `realmCreate` with `{ lineage, person }`: the service checks the person is a living member
  of the caller's lineage not already played, and the first save is held to the birth law as every birth is (level 1,
  liquid wealth at most 10,000 - the estate fits under it by construction, section 5).
- **Enduring online** is today's respawn with the toll added; nothing new is asked of the service but the record.

## 10. WORLD INFLUENCE

- **House standing.** The family carries, per region, the sum of its members' deeds there: DFU's regional reputation
  and the Living World's regard events, folded into one number (`legacy/influence.js`). An heir is BORN with a part of
  the line's standing: a quarter of each regional reputation and faction standing the parent held, and the Living World
  regard of the parent's friends and enemies at half (relations' `inherit`) - "your mother saved my son".
- **The towns talk of the family** (LW6d's news): a member's death, a laying to rest, a wedding and a birth are news in
  the family's seat and the town where they happened, for days - by name and by house.
- **The killer is remembered.** A revenant that ended a member is the line's enemy: it hunts their heir (Feud's own
  `hunt`), and the death quest names it.
- **A house name online**: "<name> of House <surname>" on the roster card, the inspect card and over the head (the
  generation in Roman numerals after a member's name when two share it - "Ysolde Hlaalu II").

**Departure (recorded):** "they come of age in the telling" - a child takes the mantle as an adult with no clock
jump; online the clock is the world's and cannot be moved, and offline a jump would desynchronise every member's own
save from the family's dates. The years are the family's fiction, the world's clock its own.

## 11. THE UI (Enhanced Plus, and the classic skin's own)

- **The Family window** (G, KB1 action `LegacyFamily`): on Enhanced Plus `ui/legacyWindow.js` in the house's carved
  frame - the TREE (generations as rows, couples joined, children hung beneath, the living, the dead, the one played,
  the elders and the heir each drawn as such, pan and zoom about the pointer), THE CARD (face, age and span, the eight
  stats, the career's skills by name, the deeds, the heirloom, Switch / Pass the mantle), THE HOUSE (surname, model,
  generations, standing by region, the heirlooms, the open death quests). On the classic skin the mod's own window,
  1:1 off its IL, in its own art (`PJLFTBG`, `PJLFTFrame`, `PJLFT`, `PJLFTPN`, `PJLFTPNP`, `PJLFTPNSKP`), with U1-U5
  fixed.
- **The Succession** (at a final death or a passing of the mantle): the enhanced death screen's own second page - the
  fallen's line, then the living who may carry it, then "A newborn heir" - one press; the classic skin the mod's own
  message box text over a list.
- **The model's question** at the founder's chargen (both skins), beside the leveling system's.
- **The HUD**: the age and the elder's word on the character sheet; Arkay's toll in the respawn's own box.
- **The Hall of Ancestors**: the menu's Legacy pane - every family, living and ended, its tree read-only.

## 12. The slices

| Slice | What |
|---|---|
| LEGACY1 | vendored; the family record and its store; the save data; inheritance; the heir born through the seam; Bloodline's death and succession offline; the switch; the settings, the Features row and the key |
| LEGACY2 | Enduring: the span, the toll, the offline respawn, the elder, passing the mantle; the model's chargen question |
| LEGACY3 | the Family window (Enhanced Plus) and the classic window 1:1; the Succession page; the Hall |
| LEGACY4 | heirlooms, the remains, the death quest, the rest and the blessing |
| LEGACY5 | courting, marriage, children, surnames' cadet branches |
| LEGACY6 | world influence: the inherited standing and regard, the towns' talk, the killer remembered |
| LEGACY7 | online: the service's lineage, the tombstone, the heir's realm birth, the house name, two players wed |
