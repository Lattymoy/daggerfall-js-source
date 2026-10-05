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
  record (`pending`). A SAVE answers what its character was given: the estate and the bequest paid, the remains opened,
  taken or laid to rest (`legacyHost.js mergeFamily`) - a reload rewinds those with the bag they went into. A save of a
  dead or retired member is THE PAST: refused for as long as it stands, the line's Succession or its living offered.
  AUDIT LEGACY II: a WRITE never loses a fact the store holds - a copy not ahead of the store's (another tab's, an older
  save's) takes the store's facts in first, deaths only ever added (`store.js storeFamily`/`mergeFacts`, A4), and a
  write the storage refuses is said and tried again at every tick (P1). A record with no person for the character
  played is not theirs and is let go (H1). Online (LEGACY7, not built) the account service will hold the lineage
  (section 9).
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
person rather than loaded (A2/B1). Until the heir lands, the page that chose acts for no one (A1). The
heir is born in a TOWN: the family's seat - the first town its founder stands in - else the nearest town to where the
parent fell (B11's root, a coordinate pair that is no place, gone).

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
  capped at 9,900 (`ESTATE_MAX`: the online birth's liquid ceiling, `REALM_BIRTH_WEALTH_MAX` 10,000, less the starting
  purse - AUDIT LEGACY H7; AUDIT LEGACY II F1 corrected this line) - paid as a letter of credit.
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
answer allows - rolled at their birth, or "Always" on the Mods pane at the death). No member, no heir: THE LINE ENDS - the
family is closed as extinct and kept in the Hall of Ancestors (the Family tab's third page), and the next character
founds a new one. The heirloom roll is the port's own Legacy.Heirloom Chance (50% by default; the mod has no
heirlooms - section 7) and the remains always lie where the fallen fell.

**ENDURING (not permadeath) - the answer to "somehow a persistent model".** A death is not final, but it is not free:
it costs YEARS. Every member has an age and a span (THE SPAN: Breton, Nord 90, Redguard 80, Khajiit, Argonian 85,
Wood Elf 150, Dark Elf 180, High Elf 200), born at a quarter of it. A death in Enduring is ARKAY'S TOLL: the player
rises as the online respawn rises (D-ONLINE1 - the nearest temple, town or graveyard) - offline too, with no purse
taken and no revenant's theft (the offline arm keeps the toll alone - AUDIT LEGACY II F5 corrected this line),
where the classic death would end the run - and the member is older by 6% of their span (the Mods pane: Light 4%,
Standard 6%, Heavy 10%). The years also pass as they live (the character's own clock, LIVED1: 360 days a year). At
three quarters of the span the card names them an ELDER and the HUD says so once. When the span is spent, the next death
is the last: they die of their years, and the mantle passes exactly as in Bloodline - so an Enduring line still turns,
at its own pace, roughly a dozen deaths a generation. And at any time an Elder may PASS THE MANTLE from the family
window: they retire to the family's seat (alive, kept on the tree, no longer played) and the player chooses an heir.
The heirloom in Enduring is the elder's to hand down - always one: a retiring elder's BEQUEST (their best worn piece,
paid to whoever takes the mantle, no quest), a fallen elder's lying with their remains (section 7).

**Offline with Project Legacy off** nothing changes: DFU's death and its title menu. **Online without a family** (a
character made before this arc): the character is founded into an Enduring family at its next load, which changes
nothing about its death but the toll - a player never wakes into permadeath they did not choose. **Online until LEGACY7**
(AUDIT LEGACY B4): a house is Enduring (the question shows Bloodline shut), an offline Bloodline played online dies the
room's death, a spent Enduring life rises at the last breath, and no Succession is answered - permadeath has no
authority online until the realm keeps the lineage and its tombstone (section 9).

## 7. HEIRLOOMS AND THE DEATH QUEST

- **The heirloom roll** at a final death: 50% (the Mods pane; Bloodline) or certain (an Enduring elder's last death or
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
  inventory window over it, in any mode (`openLootList`) - once a visit, never in a fight: what the heir leaves stays
  with them, and nothing is ever laid in the world twice (AUDIT LEGACY H1). The bones are always somewhere - in the list
  or in the heir's keeping (the pack, the wagon or the Materials Bag); gone from both (sold, dropped), they lie again
  where the fallen fell.
- **The death quest**, "The Bones of <name>", is the heir's from their first day: the journal names where and the
  killer, the Quest Guide's tracker follows it (GUIDE4) and the marks point at it (GUIDE5). THE KILLER STILL STANDS - a
  revenant or champion that slew the fallen waiting by the remains (Revenants' own record, "Slew") - is LEGACY6's, with
  the world's memory of the house. Taking the bones completes the first half; the second is to carry them into any
  temple or to the family's seat, where the player is asked "Lay <name> to rest here?".
- **The rest.** Laid to rest, the fallen's BLESSING: +3 to the fallen's highest skill for the heir - at most +9 on
  any one skill however many are laid to rest (`BLESSING_SKILL_MAX`: a long line is honoured, never a build) - the
  heirloom attuned (its generation counted), and the tree's card of the fallen marked "At peace" (else "Lies
  unclaimed" or "Carried home"). Unclaimed remains lie for good (they are the family's, not the world's). Every final
  death leaves remains and its quest, wherever it happened - but one: a member struck down by the one played (section
  10b) leaves no remains and no quest (AUDIT LEGACY II F3 recorded the exception). A rest lays what was left with the
  remains to rest with them (AUDIT LEGACY II P6: a rested row keeps no lists).
- **The claim (AUDIT LEGACY II).** A list is CLAIMED by the member who changes it (opened and left as it lies, it is
  nobody's - H5); the claim is the store's, a world fact, and a rewind of the claimant's own save restores the list
  with their bag but never drops the claim (H2); another member's save never rewinds a list it did not claim (A3).
  A claim lapses when its claimant dies or retires, and the list then lies as they LEFT it (A3). Another member's log
  names whose search it is. The bones go back into their own list or stay in the character's keeping - the pack, the
  wagon, the bag - and into no chest, pile or ground (H4).

## 8. MARRIAGE, CHILDREN AND SURNAMES

*Built: LEGACY5. The law is `systems/legacy/marriage.js`; the host's half `scenes/legacyHost.js` (`topicRows`,
`weddingStep`, `childrenStep`, `residentDied`, `holdsResident`, the spouses in `residentsOf`); the talk's rows
`scenes/townTalk.js` (`legacyTopics`); the wiring `scenes/world.js`; pinned in `test/legacy5_marriage.test.js`,
mutation-proven in `tools/mutants/legacy5.json`. Two players' characters wed online is LEGACY7's (section 9).*

- **Courting** a Living World townsperson of a household (the census's `h` roll - never one of the watch, a traveller
  on the roads, a visitor or one of the line; every census resident is an adult): one whose regard of the one played is
  FRIEND (`FRIEND_AT`, 40), or one already courted. Their talk's Tell me about page opens with Project Legacy's own
  rows, on both skins (`townTalk.js legacyTopics`, answered by the host - never the engine's pipeline): "Courtship"
  once a day of the one played's own clock - affection by Personality and Etiquette and the question's tone, on a roll
  (`courtGain`) - then, at 100, "Marriage": a proposal, taken. The courtship keeps the resident as they are (name,
  sex, race, face, town) - their identity is for life, so the wedding needs no town loaded.
- **The wedding** is asked at the door of the temple of the betrothed's town, once a visit (the rest's shape -
  section 7): "Be wed to <name> here, before the gods?", and then "Will <name> take the name <house>?". **Departure
  (recorded):** the design said through the priest's talk ("We wish to be wed"); the temple's priest is DFU's static
  NPC, whose talk is the engine's, and a question at the temple's door is the shape the rest already wears.
- **The spouse** is a person of the house (`kind: 'resident'`, their census id, their own name and face for life,
  `mapId` the town they live in). They stand in the world as the census's own resident - their outfit, job and day -
  of the line's household now (`household`), at home in a house of the line's in their town when there is one, else
  in their own; their census place is the line's for good, living or dead (`holdsResident`; `world.js holderOf`).
  Unlike the members, they stand whether or not "Family In World" is on: they are the town's people either way. Met,
  they greet the one played as their spouse; they are never played, never carry the mantle (`successors`). Struck
  down, they die in the record (section 10b's law). A courted resident who dies ends the courtship, said.
- **Children.** A wed member has a child with a 25% chance each thirty days of their own clock while the spouse lives,
  at most six; the child's race is either parent's, the rest by section 5 from both parents (`addChild` reads the
  spouse). A child is a MINOR: not played (the switch says so), but any child may take the mantle at a succession -
  they come of age in the telling (section 10's departure); a minor taking the mantle is a minor no longer.
- **Surnames.** The family's surname is the founder's (their name's last word, or "of <seat>" when they have none). A
  spouse takes it if the player answers yes at the wedding; children always carry it - except for the mod's lore
  change, which founds a cadet branch under the new name on the same tree (section 5's naming).

## 9. ONLINE

*LEGACY7's - NOT BUILT yet: the design this section states is the plan, in the present tense of the slice that builds it.*

- **The model is the family's**, chosen at the founder's online chargen. Enduring is the default; Bloodline is marked
  on the online roster and over the player's name (a small skull beside the house name).
- **The service holds the line** (`server-account/src/legacy.js`, migration `0083_legacy.sql`): a `lineages` row per
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

*LEGACY6's - NOT BUILT yet: the design this section states is the plan, in the present tense of the slice that builds it.*

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

## 10b. THE BLOODLINE IN THE WORLD (LEGACY-HOME)

*Built: LEGACY-HOME. The law is `systems/legacy/household.js`; the host's half `scenes/legacyHost.js` (`residentsOf`,
`kinOfResident`, `kinSlain`, `isFamilyHouse`, `markHome`); the wiring `scenes/world.js`; pinned in
`test/legacyhome.test.js`, mutation-proven in `tools/mutants/legacyhome.json`.*

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
  themselves. LEGACY5's spouses join them when LEGACY5 builds marriage.
- **Where they live.** THE FAMILY'S HOUSES are every house a member holds (`family.houses`, each row its holder's - a
  deed is the character's own, `systems/banking.js`, so the rows are the one played's `houses`, a deed that stands,
  learned with the SAVE that holds it and at a load - AUDIT LEGACY II A6: an unsaved purchase or sale moved the line;
  another member's rows are kept, and every row keeps its place - A5: rebuilt, "the first house" changed with whoever
  was played). THE FAMILY HOME is the one marked on the House page, else the one
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
- **How they are drawn.** In the street, in the town's own outfits - DFU's walkers have three tables (Breton, Nord,
  Redguard) and every townsperson of Daggerfall wears one; the member's race picks the nearer table (the elves and the
  Bretons the Breton, the beast folk the Redguard), the same one every day. **Departure (recorded):** the design asked for
  their own race and kit, the way an online peer is drawn; the street's walkers are the census's billboards, and a peer's
  composite body is the realm's renderer - that is LEGACY7's to bring, with the realm. In the talk window they wear
  THEIR OWN FACE: the chargen head they were made with (`raceArt(race, sex).heads`, record `face`; `ui/nativeTalk.js`
  takes a FACE*.CIF as the portrait's archive).
- **Talking to them.** The talk door meets them first (`townTalk.js` `livingTalk.kin`, after the refusals and the
  household's moment): the Succession's window with one card (`ui/legacyDoor.js` `createKinOverlay`) - what they are to
  the one played ("Your sister.", `kinLine`), their greeting by kinship ("Mother! You're home.", `kinGreeting`) and how
  the house fares, then **Play as <name>**, **Talk** (the town's own conversation, their head in the window) and
  **Goodbye** (Escape). Play as is the Family tab's switch - saved where they stand first (in a house of the line, the
  one played is parked there and stays standing in it); a member never played is BORN in the town they were met in, one
  played loads their own save. It is refused on the card, with its reason, mid-fight, online, while the Succession
  waits, and for a retired elder ("has passed the mantle on, and keeps the house now").
- **Struck down.** One of the line killed by the one played (the town's one-hit civilian, LW7) dies IN THE RECORD -
  `died` with cause `slain` and by whose hand, a world fact, the store's (AUDIT LEGACY's first authority) - said on the
  HUD, and stands no more; never a death in the town's lives (`livingDeadAt`/`livingSlay` pass them to the host).
- **Online** (until LEGACY7): the realm's homes are the account service's (`systems/onlineHomes.js`), not yet the line's
  (AUDIT LEGACY II F2/B4: the host learns no house online), so online the family stands in its seat's town; they are
  this player's own residents, seen by them alone; Play as is refused online. A character copied between the lanes (the
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

## 11. THE UI (Enhanced Plus)

- **The Family tab** of the pause window (Mac: "implement it into the pause menu as a new tab"; KB1 action
  `LegacyFamily`, the keypad's slash), drawn while Project Legacy is on, on either skin (the pause window is the
  enhanced one; Ledger A row (9)) - `ui/familyPages.js`, three pages on the rail:
  - **The tree**: generations as rows, couples joined, children hung beneath; the dead and the one played marked on
    their plates; pan by dragging, zoom about the pointer or with the tools (top right), centre on the one played; a
    plate pressed opens **the card** - face, age and span, Arkay's toll, the blood and the hearth, the eight stats and
    the career's skills by name once played, parents, spouse, siblings and children as links, its chips (played,
    fallen, died of years, at peace / lies unclaimed / carried home, retired, elder, has an heir, not yet played) and
    the acts: Play as (a switch: saved first, never mid-fight, never online until LEGACY7) and, for an elder, Pass the
    mantle - each refused on the card before the press, with its reason.
  - **The house**: its model, its seat, its generations, the living and the fallen (how and where each fell), and
    (LEGACY-HOME) its homes, the family home among them, the player's to choose (section 10b).
  - **The Hall of Ancestors**: every house founded on this machine, living and ended, with its generations and counts.
- **The Succession** (at a final death, a passing of the mantle, or a save of the past loaded): its own window
  (`ui/legacySuccession.js`, `ui/legacyDoor.js`), the death's own screen while it stands - the fallen's line, then the
  living who may carry it, then "A child of <name>" - one press; the keyboard and the pad walk it; Escape answers
  nothing (a death must be answered).
- **The model's question** at the founder's chargen, after the leveling system's, on its screen (both skins): Enduring
  first, the toll a death will charge said, Bloodline shown shut online.
- **The HUD**: the founding, the seat, the elder's word once, Arkay's toll at a rise, the estate and the bequest, the
  remains found, carried and laid to rest.
- **Not built** (recorded): the mod's classic 1:1 window in its own art (its pictures are the classic UI's own cuts,
  section 1), an age on the character sheet, a house's standing by region (LEGACY6).

## 12. The slices

| Slice | What | Status |
|---|---|---|
| LEGACY1 | vendored; the family record and its store; the save data; inheritance; the heir born through the seam; Bloodline's death and succession offline; the switch; the settings, the Features row and the key | built |
| LEGACY2 | Enduring: the span, the toll, the offline respawn, the elder, passing the mantle; the model's chargen question | built |
| LEGACY3 | the Family tab (Enhanced Plus); the Succession; the Hall | built |
| LEGACY4 | heirlooms, the remains, the death quest, the rest and the blessing | built |
| AUDIT LEGACY | the five-lens audit of LEGACY1-4 (`01-Overview/Audit-Legacy.md`) - the two authorities, the death at the door | built |
| LEGACY5 | courting, marriage, children, surnames' cadet branches | built |
| LEGACY6 | world influence: the inherited standing and regard, the towns' talk, the killer remembered | not built |
| LEGACY7 | online: the service's lineage, the tombstone, the heir's realm birth, the house name, two players wed | not built |
| LEGACY-HOME | the bloodline in the world: the family home, the seat's townsfolk, their day, Play as by talking (section 10b) | built |
