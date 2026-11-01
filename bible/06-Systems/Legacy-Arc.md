# Project Legacy

Families and bloodlines. A character belongs to a house; at a final death the line passes to a living member or a newborn
heir, who inherits a little of the parent's blood and practice, a share of the estate, sometimes an heirloom, and a
quest to recover the fallen's remains. Members court and wed townsfolk or other players, have children, live in the
family's houses, and are talked of in the towns. A house is either Bloodline (permadeath) or Enduring (a death costs
years). It is a port of **Project Legacy** 0.4.1, Mac's own DFU mod (written with Ghð§† and Positronico), vendored in
`vendor/project-legacy/` and read off its IL, with its bugs corrected at the root. The player meets it at character creation (the
model's question), in the pause window's **Family** tab, at a death's Succession window, and in the world.

## How it works

**The family record** (`src/systems/legacy/family.js`). A family is its own record: the line's surname, its model, and
a person for every member, played or not (identity, career, blood and hearth, parents, children, spouses, birth,
death, and once played their `characterId` and last stats and skills). It lives in app storage
(`src/systems/legacy/store.js`) and as a copy in every member's save. The store answers world facts (who lived, who
died, Arkay's toll, who is played, the remains); a save answers what its character was given. A write never loses a
death the store holds (`mergeFacts`). Each member is their own character with their own save; a member is played by
being loaded, or born when first played.

**The heir is born** through the one construction seam a new character uses (`src/systems/chargenSession.js`
`finishChargen`), so every derived field is minted fresh. The heir is born at the family's seat (the first town its
founder stood in, or a house the player made the family home), else the nearest town to the fall; past the Bay too
(`src/scenes/bootStartHost.js` `farStartOf`). The birth stands only once its first save lands.

**Inheritance** (`src/systems/legacy/legacyLaw.js`).
- *Career*: half the time the parent's (`CAREER_INHERIT_CHANCE`), else one of DFU's eighteen.
- *Race*: 70% the parent's (`RACE_INHERIT_CHANCE`), else the other parent's or any.
- *Name*: the line's surname 90% of the time (`SURNAME_KEEP_CHANCE`); otherwise a new surname founds a cadet branch.
- *The blood*: DFU's own stat roll, then each stat plus up to `BLOOD_MAX` (3) from a great parent.
- *The hearth*: DFU's own skill roll, then each of the parent's primary and major skills plus up to `HEARTH_MAX` (3).
- *The estate*: a quarter of the gold the dead carried (`ESTATE_SHARE`), at most `ESTATE_MAX` (9,900), as a letter of
  credit; DFU's starting kit for the career.
- *Siblings*: rolled at a birth by the settings (default up to 2, 50%), played only when switched to.
- *Standing*: a child starts with a quarter of the parent's legal and faction standing and half of each resident's
  regard (`src/systems/legacy/influence.js`).

**The two models**, chosen at the founder's chargen and fixed for the house.
- **Bloodline**: a death is final. The player chooses who carries on - any living member of the blood, or a newborn heir
  of the fallen (if the heir answer, rolled once at birth or "Always", allows). With none, the line ends and is kept in
  the Hall of Ancestors.
- **Enduring**: a death costs years. Every member has a span by race (`src/systems/legacy/age.js` `SPANS`: 80 to 200),
  is born at a quarter of it and is an elder at three quarters. A death is Arkay's toll: the player rises at the nearest
  temple, town or graveyard, older by a share of the span (`TOLL_SHARES`: Light 4%, Standard 6%, Heavy 10%). Years also
  pass as they live. Once the span is spent the next death is the last, and the mantle passes as in Bloodline. A member
  with vampirism or lycanthropy in the blood pays no toll. An elder may pass the mantle and retire to the family home.
- **Casual** (online only, `src/systems/legacy/casual.js`): no house, and a death that costs nothing (no tenth of the
  purse, nothing to a revenant). The open zone keeps its own law.

**Heirlooms and the death quest** (`src/systems/legacy/heirloom.js`). At a final death the fallen's most valuable worn
weapon or armour may become an heirloom (the **Legacy.Heirloom Chance** setting in Bloodline; always for an Enduring
elder). It carries the family's name and grows each generation it comes home (`HEIRLOOM_GEN_MAX` 5: +5% damage or +2
armour a generation). The remains (template `REMAINS_TEMPLATE` 1810) lie where the fallen fell with the heirloom and a
tenth of their purse (at most 2,500). "The Bones of <name>" is the heir's quest, naming the place and the revenant that
slew them, which hunts the heir. Carried to a temple or the family's seat and laid to rest, the fallen give a blessing:
+`BLESSING_POINTS` to their highest skill, at most `BLESSING_SKILL_MAX` (+9) on any one skill.

**Marriage and children** (`src/systems/legacy/marriage.js`). A member courts a Living World resident whose regard is
Friend (40) through the talk window's Courtship rows and court deeds (compliment, gift, embrace, kiss -
`src/systems/legacy/courtDeeds.js`). The wedding is asked at the door of the temple in the betrothed's town; the spouse
may take the house's name. A wed member has a child with a `CHILD_CHANCE` (25%) every `CHILD_DAYS` (30) of their own
clock, at most `CHILDREN_MAX` (6) with each spouse; a child is a minor, never played, but may take the mantle. Two
players' realm characters can wed in one temple from the Inspect card's **Propose marriage**; a child of their union is
of the house that bore them and appears on both trees (`src/systems/legacy/unionKin.js`).

**The bloodline in the world** (`src/systems/legacy/household.js`). Living members not being played stand as residents
of their town, in their own looks, at the family's houses or their own, with a homemaker's day. Talking to one offers
**Play as <name>**. One struck down by the player, or killed by a beast in the street, dies in the record. "Family In
World" (on by default) turns this off. The towns talk of the family's deaths, rests, weddings and births for seven days.

**The house of the dead.** A house whose holder dies passes to whoever carries the line (`deedsDue`), one a region as
the bank deeds them; offline as Daggerfall's own deed with the house as left, online by the account service
(`server-account/src/homes.js` `inheritHome`).

**Online.** The account service holds each line (`lineages`, written only on the stored revision it was made from). A
Bloodline death is a tombstone (`/v1/realm/die`): the service refuses the character's join, checkpoint and trade, so an
older save cannot undo a death. The realm holds a fall for `REZ_HOLD_S` (90 s) so a party's Resurrect can take it
back (`/v1/realm/raise`); after that the body stays down. Enduring online is the offline law. A new character founds a
house only by answering the model's question; one made before it plays with no house.

**The UI** (`src/ui/familyPages.js`). The Family tab's pages: the tree (generations, couples and their children, the
dead and the played marked), the house (model, seat, members, homes), the Hall of Ancestors, and How it works. The
Succession window (`src/ui/legacy/legacySuccession.js`) must be answered. The Stats page shows the house, the
generation, and in an Enduring house the age against the span.

## Rules

- Integrate Project Legacy online with a choice of a permadeath model and a non-permadeath one; fix every bug; families,
  surnames, marriage, children, heirlooms and the death quest influence the world (Mac).
- Online, character creation offers Enduring, Bloodline and Casual in an Enhanced Plus popup; characters made before it
  start without the system (Mac).
- Casual: no death and no lineage (the owner).
- Vampires and werewolves pay no Enduring toll (the owner).
- The family lives in the world as a bloodline; the Family tab is in the pause window (Mac).
- A player never wakes into permadeath they did not choose.
- A switch to another member is a save and a load; a fight refuses it.
- Offline with Project Legacy off, DFU's death stands. The fixed-city bench (`?exterior`) keeps DFU's death (FLAGGED).

## Daggerfall Unity

Project Legacy is a DFU mod; DFU itself has no families. The mod's bugs, corrected at the root: the heir does not
inherit the dead's derived fields, spells, diseases, curses, crimes or quests (born through the seam); inheritance reads
the parent; the 70% race roll works; Mage is pickable and None is not; the heir has its own face; the kit is DFU's own;
the heir is born in a town, not the sea; the heir answer is rolled once; every death is recorded; siblings default on;
stats and skills are recorded permanent, not live.

Departures: the heir takes a quarter of the purse, not all of it;
zero siblings means none; the tree's two-key chord and "Unknown" partner are not kept; the mod's classic window art is
not drawn (every skin uses the Enhanced Plus tab); heirlooms, the death quest, Enduring, marriage and the house's place
in the world are the port's own.

## Code and tests

- `src/systems/legacy/` - the family, store, inheritance law, age, heirlooms, marriage, household, influence, casual
- `src/scenes/legacyHost.js` - the host's half: deaths, births, the Succession, homes, the realm
- `src/ui/familyPages.js`, `src/ui/legacy/` - the Family tab and the Succession
- `server-account/src/legacy.js`, `server-account/src/homes.js` - lines, tombstones, raises, inherited homes
- `test/systems/legacy1_family.test.js`, `test/systems/legacy3_familytab.test.js`, `test/systems/legacychoice.test.js`,
  `test/systems/legacyhome.test.js` - the record, the tab, the choice, the bloodline in the world
- `test/systems/legacy/legacy4_heirloom.test.js`, `test/systems/legacy/legacy5_marriage.test.js` - heirlooms and
  marriage
- `test/systems/legacy/legacy7_online.test.js`, `test/systems/legacy/legacy7_wed.test.js`,
  `test/systems/legacy/legacy7_body.test.js`, `test/systems/legacy/legacy7_homes.test.js`,
  `test/server/legacy7_service.test.js`, `test/net/legacy7_house.test.js` - online
- `test/systems/livingWorld/legacy6_influence.test.js` - world influence
- `test/systems/legacy/permadeath_houses.test.js` - the house of the dead
- `test/systems/legacy/revive.test.js`, `test/systems/legacy/fb1016b_rezbloodline.test.js` - revival
- `test/systems/legacy/casuallife.test.js`, `test/systems/legacy/fb1029_union.test.js`,
  `test/systems/legacy/fb1026d_courtdeeds.test.js`, `test/systems/legacy/bayleftb_seat.test.js` - Casual, unions, court
  deeds, seats past the Bay
- `test/systems/legacy/auditlegacy.test.js`, `test/systems/legacy/auditlegacy2.test.js`,
  `test/systems/legacy/auditlegacy3.test.js` - the audits

## Open

- A house's standing by region apart from its members' is not built; the parent's own standing is handed down instead.
- A child comes of age only in the telling: a minor may take the mantle with no clock.
