# Arcane Specialisations - a mage is the schools they master (SCHOOLS)

> Design page and record (2026-10-13). The arc shipped whole, in one pull request, by the owner's choice; its five slices
> are the five parts of this page. Where the page and the code disagree, the code's own header (`src/systems/
> arcanePaths.js`, `src/systems/arcanePowers.js`) and the pins are what runs.

## 1. What was asked

A player on the Patreon chat (DoubleDutchess, 2026-10-13), through the owner:

> *"One thing I've found with making mage characters recently, is that they all kind of end up the same. I'd love
> changes that gave mages more of an identity, based on the school of magic they are specialised in. Unfortunately,
> this is undermined by how easy it is to become a master in all schools. One thing that might be worth exploring is
> specialisation based on the two master skills you pick. That way there's 21 possible combinations of master magic
> school per character. If some advanced spells or specialisations could be tied to those combinations, it would allow
> for some interesting character diversity. Restoration and Mysticism could be the requirements for a Necromancer
> sub-class for instance, giving access to some spicy new spells."*

Measured first (section 2), then four questions put to the owner, and the owner chose:

- **The pair:** *chosen once* - once two schools are mastered, the player picks one pair of their mastered schools, and
  the choice is permanent, like a mastery.
- **What it grants:** *signature spells, a passive, and the school perks* - each of the fifteen pairs a signature
  spell sold only to it and a passive of its own; and every mastered school pays past 100 in its own way, not in price
  alone (BAL9's open "other schools" call). Fifteen pairs and six schools: the post's twenty-one.
- **Below 100:** *as it is* - identity comes from what is mastered and specialised; reaching 100 everywhere stays.
- **Scope:** *everything at once* - all fifteen and all six in one pull request.

Its sibling for the weapons is `05-Combat/Martial-Specialisations.md` (MARTIAL, 2026-10-17): fifteen martial paths from the
six weapon skills, held beside an arcane path (the owner: "Yes, one of each").

Six schools make fifteen pairs (6 choose 2), not twenty-one; with the six schools' own perks past 100 the count is the
post's twenty-one, and that is how this page reads it.

## 2. What was measured - why every mage ended up the same

Three facts, each in the code before this arc:

1. **Every school reaches 100, on any mage.** Below 100 skills rise as DFU's (`systems/advancement.js`), and online
   Master Skills lifts DFU's 95 lock (`masterSkills.js` SOFTCAP3), so nothing stops a mage at 95 in the schools they did
   not master. The Mages Guild trains all six to 50 (`guildServices.js` trainingMax). Reaching 100 in all six is a
   matter of casting.
2. **A mastered school bought one thing: its price.** Five masteries (2 primary, 2 major, 1 minor - SOFTCAP4) let a
   school climb past 100, and past 100 the climb priced the school's spells cheaper (SPELL-COST-PAST) and raised the
   foes (`skillSoftcap.js` combatEdge). Only Destruction's climb did anything else (BAL9b, its damage). Balance-Arc
   section 15 says it outright: *"a school's read in nothing but its price"*, and left the other five as a call of
   their own.
3. **No spell belonged to anyone.** The Mages Guild's shelf sells every SPELLS.STD record to every customer
   (`worldModes.js` BuySpells), and the spell maker makes any three effects for anyone. No spell, power or title read a
   player's schools.

So the one permanent, scarce choice a mage makes - which schools to master - changed a price and nothing a player
could see or play. That is where the identity goes.

## 3. SCHOOLS1 - the path (the law)

`src/systems/arcanePaths.js` - a leaf the price, the judge and the powers all read.

- **Who.** A player with Master Skills in force (online always; offline the switch - SOFTCAP3) and at least two of
  the six schools mastered. A school can only be mastered as a career skill, so a class whose career holds fewer than
  two of the six never meets a path - the masteries' own law (`pathPossible`; AUDIT SCHOOLS L4 8: the enhanced page
  shows such a class nothing to choose - since GROWTH2 the Growth tab's guide says so in its headline and the Master
  Skills page draws no specialisation line for it, AUDIT GROWTH LANE5-6). AUDIT MARTIAL L4 L3 (found on the sibling, fixed in both): the
  count is of what the 2/2/1 slots can still master (`masterSkills.js` masterableCount) - two schools that were both
  minor skills share one slot, and the card showed for good. And Yes says one short line, "Specialisation chosen:
  {name}." (AUDIT MARTIAL L4 M1: the spell's sentence ran the line past the classic screen's 312 px; where the spell is
  sold is the card's and the OK box's own line, `schools.sheet.sold`).
- **The choice.** Any pair of the player's mastered schools names one path (section 5); with three or more mastered,
  the player picks among their pairs. `entity.arcanePath` holds the path's id. **Held until given up for 200,000 gold**
  (SPEC-RESET, `10-UI/Growth.md` section 10) - nothing else undoes it; a mastery is never undone. Asked ONCE on the first quiet pass after the second school is mastered (the mastery box's
  own door, `scenes/shared.js` raisePlayerSkills - after the mastery choices, never over them, one box a pass): ONE
  path open is asked about in a Yes/No box; SEVERAL are named in an OK box that sends the player to the skill screen,
  where each is offered (AUDIT SCHOOLS L4 M1 - a permanent Yes on whichever stood first in the table was no choice).
  Any time after, on the skill screen: classic, the S row under the Master Skills row on each skill page (S asks about
  an open path; No, then S, the next - the plate stays behind the box so the key it names reaches it, AUDIT SCHOOLS
  L4 H1; a chosen path's S says what it is); enhanced, the Master Skills page's Specialisation card (each path with its
  two schools, the door's count beside Master Skills). GROWTH2 (2026-10-17, `10-UI/Growth.md` section 5) moved the card
  to the pause window's Growth tab: a guide to all fifteen paths, open or not - each one's state on this character,
  what opens it, its passive, its signature spell read as the spellbook reads it, and Choose through this law; Master
  Skills keeps one line and a door to it, and the classic sheet's S row stands whenever the class can meet a path and
  opens the same guide (GROWTH4). The one ask's No names the Growth tab on the enhanced skin.
- **Held and awake.** A path is HELD (`pathHeld`) by my own player entity (never a peer's stand-in) with Master Skills
  in force and both its schools mastered - what its signature spell is priced, taught and sold by (section 6). It is
  AWAKE (`pathAwake`), and its powers act, while it is held and I am not mentoring (SOFTCAP2 reads no climb either) -
  and its powers add no refereed fight in progress (`arcanePowers.js` awakePathId reads `sigil.js` sigilDueling, the
  one word every loot power and set power sleeps on; the law cannot import it - sigil.js's graph reaches back into
  `spellcost.js`, which reads the law). Mentoring takes the powers and leaves the price: through `pathAwake` a
  mentored Necromancer's Siphon Life priced and trained as the Destruction they never chose, 9 magicka becoming 105 on
  joining a lower party (AUDIT SCHOOLS L2 F5); mentoring's own law already lowers the schools' values and their climb.
  Offline with the switch off, the path is neither and its signature spell casts as the plain bundle it is - nothing
  is lost, as Master Skills keeps a skill past 100 while off.
- **Never at a player.** A rider or passive that strikes reaches foes only (`ownSpellAt`, BAL9's gate); a signature
  spell cast at a duel opponent or given to a party mate lands as its plain classic bundle. SKILL-SWAP (2026-10-19, `10-UI/Growth.md` section 11):
  such a class can now change one unmastered class skill for a school, for gold, and a line under the guide's headline says so where one swap would open a path (AUDIT SUGGESTIONS-1019 L5-1).

## 4. SCHOOLS2 - the schools past 100

BAL9b's law, *the school past 100 is its potency*, for every school: online, each effective point of a school's CLIMB
past 100 (`skillSoftcap.js` climbedSkill - the climb the foes' edge reads, so the climb that raises them is the climb
that pays) is 1% more of what that school does, to x1.4 at 200 (effective 140). `spellPower.js` schoolPotency, now
per school. Each school pays in its own dimension:

| school | past 100, x1.4 at 200 | where it lands |
| --- | --- | --- |
| Destruction | the damage of Damage Health and Continuous Damage Health at a foe | BAL9b, unchanged (`effects.js` casterDamageScaled) |
| Restoration | the healing of Heal Health and Regenerate on myself | the heal arm, and a Regenerate's every round, read live (AUDIT SCHOOLS L2 F3: fixed at the cast, a Regenerate cast before a duel or a mentoring kept it through both) |
| Alteration | the strength of a Shield on myself | the Shield arm's pool |
| Illusion | the duration of Invisibility, Chameleon and Shadow on myself | the concealment arm's rounds |
| Mysticism | the chance of Silence, Dispel Undead/Daedra and Soul Trap at a foe | each chance, at most 100 |
| Thaumaturgy | the chance of Spell Reflection and Spell Resistance on myself | the chance the buff holds, at most 100 |

Online alone, as BAL9b: offline, DFU's price term already pays a school past 100 (to nothing at 110), and the offline
game is Daggerfall's (Field-Bugs-2026-10-12c's For Mac stands). None while mentoring; none in a refereed fight; a heal,
shield, concealment or ward only on MY OWN entity (a party mate's gift lands on their client, and an ally's bundle never
merges with mine - ALLY-CAST C2); a chance only at a foe I cast at. A spell's school is the effect's own, except a
signature spell's (section 6). Never a WORN item's bundle (a Cast When Held effect keeps what it landed with until the
item's reroll, past a duel's start and a mentoring alike - AUDIT SCHOOLS L2 F2), and never my own spell a foe turned
back at me (L2 F9); an item's one-shot Cast When Used spell is my cast and takes it, as BAL9's damage procs do.
Comprehend Languages is no ward: its chance reads no school.

## 5. SCHOOLS3/4 - the fifteen paths

Each path: a PASSIVE while awake, and a SIGNATURE SPELL with a RIDER - what the spell does past its classic bundle, only
when its own path's holder casts it awake. A round is a magic round (a classic minute, five real seconds online).

| path | schools | passive | signature spell | rider |
| --- | --- | --- | --- | --- |
| Battlemage | Alteration + Destruction | **Spellsteel**: while my Shield holds, my damage spells strike 15% harder | **Aegis Bolt** - Damage Health 10-18 + 2-3 a level, shock, at range | a Shield on me of twice what it landed (at most a fifth of my health), 8 rounds |
| Trickster | Alteration + Illusion | **Slip Away**: a hurt that takes me below a third of my health turns me Invisible for 5 rounds; ready again after 2 minutes | **Fleeting Hold** - Paralyze, 2 + 1 a 4 levels rounds, chance 35 + 2 a 2 levels, at range | when it takes hold, I fade: Chameleon, 6 rounds |
| Riftwalker | Alteration + Mysticism | **Between Moments**: my casting hands move 20% faster | **Rift Lance** - Damage Health 8-16 + 2-3 a level, magic, at range | every other foe within 4 m of the one struck takes a third of what it landed, as the spell's element |
| Warden | Alteration + Restoration | **Steadfast**: while my Shield holds, 1% of my health back each round | **Living Aegis** - Shield 10-20 + 2-3 a level for 8 + 1 a 2 levels rounds, and Heal Health 8-14 + 1-2 a level, on myself | for 30 seconds, foes' blows land 20% lighter on me (whole points, the fraction carried - AUDIT SCHOOLS L1 M2) |
| Wardwright | Alteration + Thaumaturgy | **Attuned Wards**: my Alteration and Thaumaturgy spells cost 20% less magicka | **Prismatic Ward** - Resist Fire, Frost and Shock, 10 + 2 a 2 levels rounds, chance 25 + 2 a 2 levels, on myself | for 30 seconds, a Destruction spell that strikes me is absorbed 40% of the time, while my magicka has room for it (DFU's own second gate) |
| Shadowcaster | Destruction + Illusion | **Unseen Strike**: while I am invisible, chameleon or shaded, my damage spells strike 25% harder | **Shadow Bolt** - Damage Health 8-16 + 2-3 a level, magic, at range | when it lands, shadow wraps me: Shadow, 3 rounds |
| Spellbreaker | Destruction + Mysticism | **Sunder**: my damage spells meet saving throws 10 lower | **Unravel** - Damage Health 8-14 + 2-3 a level and Silence 3 + 1 a 4 levels rounds (chance 30 + 2 a 2 levels), magic, at range | when it lands, a third of its magicka comes back |
| Bloodmage | Destruction + Restoration | **Sanguine Tide**: my damage spells strike 1% harder for every 2% of my health missing, at most 25% | **Blood Boil** - Damage Health 10-18 + 2-3 a level, fire, at range | a foe it leaves under 30% of its health boils again for as much |
| Elementalist | Destruction + Thaumaturgy | **Conflux**: each cast of mine that lands damage on a foe builds one stack for 10 seconds (an area spell over five foes, one - AUDIT SCHOOLS L1 L1), 3% more spell damage a stack, at most 5 | **Chain Lightning** - Damage Health 10-18 + 2-3 a level, shock, at range | arcs to the two nearest other foes within 8 m for half of what it landed, as shock (none on a foe immune to it, half on one that resists) |
| Seer | Illusion + Mysticism | **Foresight**: one foe blow in eight is foreseen and lands nothing - asked before any damage modifier, so a set's charge is never spent on it (AUDIT SCHOOLS L1 M3) | **Psychic Lance** - Damage Health 8-14 + 2-3 a level, magic, at range | the foe it strikes is laid open: for 12 seconds my damage spells at it meet its saving throw 20 lower |
| Lightbringer | Illusion + Restoration | **Dawn's Ward**: my damage spells strike undead and daedra 20% harder (the loot's one foe group - a class foe is a man, AUDIT SCHOOLS L1 H2) | **Dawnbolt** - Damage Health 8-16 + 2-3 a level, magic, at range | a fifth of what it lands heals me, and undead and daedra burn again for half |
| Enchanter | Illusion + Thaumaturgy | **Glamour**: +10 Personality, +15 Etiquette and +15 Streetwise | **Beguile** - Pacify Humanoid and Charm, chance 30 + 2 a 2 levels, at range | a foe it calms (hostile before it, and one a Pacify may sway) returns its whole cost in magicka (AUDIT SCHOOLS L1 M5) |
| Necromancer | Mysticism + Restoration | **Death's Due**: each foe I kill returns 5% of my health and 5% of my magicka | **Siphon Life** - Damage Health 8-16 + 2-3 a level, magic, at range | half of what it lands heals me |
| Soulbinder | Mysticism + Thaumaturgy | **Soul Well**: each foe I kill returns 10% of my magicka, 20% if my Soul Trap held it | **Soul Lance** - Soul Trap 6 + 1 a 2 levels rounds (chance 40 + 2 a 2 levels) and Damage Health 6-12 + 2-3 a level, magic, at range | a quarter of what it lands comes back as magicka |
| Hierophant | Restoration + Thaumaturgy | **Absolution**: a hurt that takes me below 30% of my health heals a quarter of my health; ready again after 3 minutes | **Sanctify** - Heal Health 12-20 + 2-4 a level, Cure Poison and Cure Disease, on myself | a ward: Spell Resistance 30%, 6 rounds |

Slip Away and Absolution answer a hurt that CROSSES their line (one already under it crosses nothing) and never a
death a death save turned aside (`saved` - the Vigil's and Shed Skin's own rule, AUDIT 625 P1; AUDIT SCHOOLS L1 M4).
WHAT A RIDER LANDED is what the foe could lose - never a bolt's overkill on a 3-point rat (AUDIT SCHOOLS L1 M6) - and a
refund is of what the cast really took (the cast's token, below). The arcs keep the loot's one reach law (`lootPowers.js`
near: never an ally or a foe at peace, never one a storey off, never one behind a wall - AUDIT SCHOOLS L1 H1) and
the loot's element share. A rider's bundle on me (Aegis Bolt's Shield, Fleeting Hold's Chameleon, Shadow Bolt's Shadow,
Sanctify's ward) is a POWER'S (the door's `castOnPlayer` with `power`, `effects.js` powerCast): it merges with my own
like-kind effect as DFU's incumbents merge - one entry a kind, every reader DFU's first match (X11) - but where either
side of the merge is a power's, the Shield's pool and a ward's chance take the LARGER (AUDIT SCHOOLS L1 M1, L2 F1: by
the recast law alone my own 6-point Shield swallowed every Aegis Bolt after it, and a rider's 40 capped my own 140
cast after it). Between two casts of my own, DFU's law stands.

The numbers sit inside the ladders the loot keeps: every percent onto a damage spell adds to the loot's own
(`spellPower.js` spellPowerMult sums every registered modifier), the loot's capped at `SPELL_POWER_MOST` 50 on its own
and a path's at most 25; no heal or magicka a path gives ever passes its maximum (`playerHeal.js` healMine, manaMine);
a rider's blow on another foe goes through the host's own door (`playerDoor.js` hurtFoe - its pool, a kill mine), and
the Bloodmage's and Lightbringer's second burn is a blow of mine, never one paid back (`paidBack` is for a foe's own
blow turned on it).

## 6. The signature spells

- **Records.** Each is a ready-made spell record (`signatureSpells.js` signatureSpell, from `arcanePaths.js`'s data),
  the classic SPELLS.STD shape with three effect slots, carrying `path: <id>` and an index of its own (-46101 to
  -46115, pinned literally with every slot's numbers - a bought copy carries its index for good, AUDIT SCHOOLS L3 F5,
  L5 H5). Ready-made, never craftable: the spell maker does not offer its rider, and a record without its path's holder
  is the plain bundle. Saved whole, as every made spell is (`save.js` - `custom`). Its name is minted in ENGLISH, its
  canonical name as a SPELLS.STD record's is, and shown in the player's language (`loot.js` shownSpellName, by its
  index band; a name the player gave it stays theirs) - minted in the buyer's language, a Russian or Korean name
  crossed the wire's printable-ASCII label as nothing, and a language switch left a book naming a spell the shelf named
  otherwise (AUDIT SCHOOLS L4 4).
- **The ready-made bands are nobody's to mint** (`spellMaker.js` READY_MADE_INDEX_CEILING, -45000): Resurrection's
  -45001, Shared Cartography's -46001 and the signature band stand at or below it, and a made spell's index never does:
  a restore steps the maker's next index past made spells alone (AUDIT SCHOOLS L3 F4: a book holding Shared
  Cartography minted the hundredth made spell at Aegis Bolt's index, and the quickslots, keyed by index, showed one).
- **The shelf.** The Mages Guild's (and a temple's) Buy Spells offers its own path's signature spell to a holder whose
  path is HELD (section 3 - mentoring too) - offline and online, at the shelf's own price. Nobody else is offered it.
- **Cast in the path's schools.** A signature spell is priced and taught by its path's two schools (`spellcost.js`
  castSchool, read by calculateCastCost and `scenes/hostMagic.js` tallyCastSkills): an effect of one of the pair stays
  its own school's; any other effect (Siphon Life's Damage Health is Destruction's) prices and teaches as the stronger
  of the pair - so a Necromancer's Siphon Life is cheap at Restoration 150, and casting it trains the Necromancer's
  schools, not a Destruction they never chose. Its school past 100 (section 4) reads the same school. Held, it is cast
  in the pair, mentoring or not; with the path not held (Master Skills off, a school unmastered), every effect is its
  own school's again.
- **On the wire.** Every signature effect is a classic key (0..44), three slots at most, so a cast frame and a duel
  frame carry it as they carry any spell (`net/wire.js` castSpellOf) - and land it without its rider.

## 7. SCHOOLS5 - the judge

`server-account/src/judge.js` characterFindings, a new code `path`: a save's `arcanePath`, when it carries one, must be
a path whose two schools are both in its `masteredSkills` (a mastery is only made at 100, and is never undone - the
judge reads no skill's value, which can fall after its mastery) - what GRANTS a path's powers. A signature spell is NOT
judged (AUDIT SCHOOLS L3 F2): one without its path is the plain bundle the spell maker could make (no rider, its own
schools), so flagging it protected nothing - and it froze the trade of an honest player whose save an older build had
carried (that build saves made spells whole and writes no `arcanePath`). That same save keeps its path: a restore of a
save with no `arcanePath` key whose book's signature spells name ONE path, both its schools mastered, gives that path
back, already asked (`save.js`, `arcanePaths.js` pathWitnessed) - a choice an older build dropped, never a
respecialisation door; a newer save's own `null` is a choice of none and restores none. Since AUDIT SPEC-RESET L2-1 the
career carries an arcane mirror as it does a martial one - the path, or none, written on every save - and a carried save
that keeps it is read by the mirror, never the book: SPEC-RESET leaves a path given up's signature spell in the book, and
the witness had handed the path back with its 200,000 still spent. An honest save can never break
the check (nothing writes the field but the choice and that witness, and both refuse what this refuses), so it costs
no honest player a frozen trade. The masteries
themselves are not judged here: a save from before SOFTCAP4 can hold a skill past 100 with no mastery listed, and the
judge's verdict freezes trade - judging that is a call of its own (section 9). `arcanePaths.js` joins the account
Worker's deploy filter; the service's version moves to `acct130` (acct127 on the branch, renumbered past HOMES-SHED,
BUSY-GATE and CRAFT-PROCS at the merge of main).

## 8. The seams, and the four hosts

- `systems/arcanePaths.js` - the law: the fifteen, every number they name (`PATH_NUMBERS`), their words, the choice,
  awake, castSchool's pair, the judge's finding. A leaf (`masterSkills.js`, `skills.js` and `textManager.js` alone), so
  the price and the judge read it with no cycle. `systems/signatureSpells.js` builds the records with the spell maker's
  own builder.
- `systems/arcanePowers.js` - what the paths DO, registered at import through the seams the sets and the loot opened:
  `spellPower.js` (power, pierce, and a new LANDED listener - `registerSpellLandedListener`, told by the cast engine
  when MY spell lands), `spellcost.js` (cost), `castSpeed.js`, `entityMods.js` (the fold), `playerEntity.js` (damage
  modifier, hurt listener, and a new BLOW EVASION - `registerPlayerBlowEvasion`, asked of a foe's blow before any
  modifier: Foresight's), `playerKills.js`, `worldTick.js` (the round), `absorption.js`. The arcs read `lootPowers.js`'s
  reach law, foe group and element share (one home each).
- `systems/effects.js` - the schools past 100 (section 4), each through `spellPower.js` schoolPotency.
- `scenes/hostMagic.js` - THE ONE CAST ENGINE every host casts through, so all four hosts are wired by it:
  `scenes/exterior.js`, `scenes/world.js`, `scenes/worldModes.js` (interiors) and `scenes/dungeonContext.js`
  (dungeons). It tells the landed listeners (`applySpellToFoe` for my spell at a foe, `applySpellToPlayer` for my own
  cast on me - with `took`, what the target could lose, and `cast`, the cast's TOKEN: `{ cost }`, minted at the release
  and carried by every landing of that one cast, a missile's, each foe an area sweeps, the court's boss) and tallies by
  castSchool. The relay's stand-ins tell them too (`scenes/gate/standInSpell.js` tellStandIn - the Burning Court's Warden,
  its crystals, its host; its createSerpentSpell - the serpent's hide), with no foe record: the relay holds
  the body (AUDIT SCHOOLS L2 F4). `arcanePowers.js` is imported by `scenes/hostMagic.js` itself, so every page that
  builds the engine has the paths' powers - the standalone dungeon page had their price and none of their powers
  (AUDIT SCHOOLS L2 F8).
- `scenes/worldModes.js` - the shelf (section 6).
- `scenes/shared.js` - the ask; `ui/charsheet.js` and `ui/enhanced/enhancedCharSheet.js` / `ui/enhanced/enhancedMenu.js` - the choice.
- `systems/save/save.js` - `arcanePath` and `pathPrompted`.

## 9. Departures, and what is recorded rather than built

- **Port-only, all of it.** Daggerfall has no specialisation, signature spells or school perks; Port-Ledger A records
  the arc.
- **The masteries are not judged online** (section 7) - recorded, the owner's call: holding a pre-SOFTCAP4 save's
  skills past 100 against a mastery list it never had would freeze honest players' trade.
- **A respecialisation costs 200,000 gold** (SPEC-RESET, 2026-10-18 - the owner's call this page left open:
  `10-UI/Growth.md` section 10). The path is given up and chosen again among the pairs the masteries open; a mastery
  is still permanent.
- **Offline the schools past 100 stay Daggerfall's** (section 4) - the paths themselves work offline with the switch on.
- **The numbers are a first cut.** Every one is a constant in `arcanePaths.js` (`PATH_NUMBERS`, and the signature
  records' slots in `PATH_ROWS`), named and pinned on both sides of its line (`test/systems/audit_schools.test.js`), so a
  balance pass moves one number and one pin.
- **Recorded by the audit, not changed** (`01-Overview/audits/Audit-Schools.md`):
  - The powers' memory (recoveries, Conflux, the guard and ward windows, the Seer's marks) is the session's, as the
    sets' and the loot's: it outlives a character switch by its windows' seconds (L1 L3).
  - "No refereed fight" is `sigil.js` sigilDueling - a duel and arena PvP. In a siege or the Wild Zone the price and
    speed passives act, as the loot's Focus does; the opponents' blows there land on the referee's bar, never
    `hurtPlayer`, so no defensive passive reaches them (L1 L4).
  - A Cast When Strikes proc is "my spell" (BAL9's word): it builds its own Conflux stack (L1 L1).
  - A Regenerate restored from a save keeps its school and no caster, so its rounds take no climb past 100 until it
    is cast again - the damage over time's own behaviour after a reload.
  - The classic S row stands on DFU's `CharacterSheetSpellbook` key; the port's classic sheet does not wire that key
    today, and once it does the row moves (L4 7).
  - The masteries themselves are not judged (above; L3 F3).

## 10. Pinned

`test/systems/schools_arcane.test.js` (11) - the law (the fifteen pairs whole and distinct, the choice and its refusals,
permanence, held, awake and asleep), the save's round trip, the shelf, the price and the tally by the path's schools,
the six schools past 100 through the real `applySpell`, every rider through the real cast engine's landing doors,
every passive through its own seam, and the judge's finding. The shelf's wiring (`worldModes.js`) and the tally's
(`hostMagic.js` tallyCastSkills) are pinned by their text, beside the executed price and shelf.
`test/systems/audit_schools.test.js` (28) - the audit's (`01-Overview/audits/Audit-Schools.md`), by execution through the producers
that mint the shapes in play: the real cast engine's release, missiles and doors (`createPlayerMagic` - its cast
token, its area sweep, its own door to me), real foes (`makeEnemyEntity` over `enemyBasics.js`: the class foes a
Lightbringer once read as undead), the save, the magic round (`runMagicRoundsFor` - Steadfast at its seam), the
mentoring producer (`refreshMentor`), the one ask (`raisePlayerSkills`), the classic sheet (`CharSheet`, its S row
drawn and pressed) and the enhanced pause window (`mountEnhancedMenu`, driven); every number on both sides of its line
and every window just before its end and just after; the signature records pinned literally. The relay's stand-ins
are pinned by their text (they live inside the page builders).

Mutants: `tools/mutants/schools.json` (65 - the arc's; twelve re-aimed by content after the audit, one the audit's
equivalent as recorded) and `tools/mutants/audit_schools.json` (95 - the audit's), every one dead but the one
recorded equivalent. PIN MOVED: `dropsaudit`'s damage-over-time round (it reads the school its rounds are cast in);
by content `bal9.json`'s two and `dropsaudit.json`'s two records the same lines moved; `spellbookwindow`'s shelf
(`offered:` reads `signatureOffers`) and `serpentset`'s `playerHeal.js` import (`manaMine` beside `healMine`); the
account service's version pins to acct130 in the nineteen suites and their records (acct127 until the merge of
main that brought acct128 and acct129). And the audit's
(PIN MOVED (AUDIT SCHOOLS)): the cast's wrapper and token in `serpent4`, `wb11_gate_host`, `wb9c_gate_reckoning`,
`wb4b_gate_blows` (four), `auditwbx`, `audit24_scenes` and `x3casting`; the door's `castOnPlayer` and its `power` word in
`set2_seams`; by content `wb4b.json`'s three, `fb1001_regen.json`'s three
(the Regenerate entry's school and caster) and `stackcap.json`'s two (the ward arm's merge).

Every word a player reads goes through the text core (`t()`, the keys under `schools.` and `pause.master.spec.`),
drafted into the thirteen whole languages (`tools/l10nInSession.mjs`, each glossary given the new terms - and the
audit's: "skill screen", the sheet's Specialise row, "hurt" as any damage). A signature spell's record carries its
English name and is shown in the player's language (section 6).
