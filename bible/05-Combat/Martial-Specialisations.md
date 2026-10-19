# Martial Specialisations - a fighter is the weapons they master (MARTIAL)

> Design page and record (2026-10-17). The arc shipped whole, in one pull request, beside BAL10 (`Balance-Arc.md`
> section 16), by the owner's choice; its parts are the parts of this page. Where the page and the code disagree, the
> code's own headers (`src/systems/martialPaths.js`, `src/systems/martialPowers.js`, `src/systems/weaponMastery.js`) and
> the pins are what runs.

## 1. What was asked

The owner, 2026-10-17:

> *"So. we've properly balanced mages, added a specialization tree and added the firmament system. I want to do the
> same for other weapon types/classes."*

The mages' three were BAL9 (Destruction's channels, `Balance-Arc.md` section 15), SCHOOLS (the fifteen arcane paths and
every school past 100, `06-Systems/Arcane-Specialisations.md`) and FIRM1 (the Firmament, `06-Systems/Firmament.md`).
Measured first (section 2), then four questions put to the owner, and the owner chose:

- **The skills:** *the six weapon skills* - Long Blade, Short Blade, Axe, Blunt Weapon, Archery, Hand-to-Hand: fifteen
  pairs, as the six schools make fifteen. A rogue's set (Backstabbing, Critical Strike, Dodging, Stealth, Lockpicking,
  Pickpocket) is a later arc of its own (section 9).
- **The signature:** *a technique on the technique key, when free* - the path's signature answers the Weapon Technique
  key whenever the weapon in hand is one of its pair's and carries no technique line of its own; a loot line on the
  weapon wins. No new key: every letter and digit is already bound (`systems/inputActions.js`, TECH1's own note).
- **Both paths:** *yes, one of each* - a spellsword who masters two schools and two weapons holds an arcane path and a
  martial path together; the masteries they need come from the one 2 / 2 / 1 (`masterSkills.js` MASTERY_SLOTS).
- **The balance pass:** *all four* - every weapon past 100 in its own dimension (section 4); the fists' missing blow
  modifiers, the short blades' handling and the Firmament's weapon notables (BAL10, `Balance-Arc.md` section 16).

## 2. What was measured - what a mastered weapon bought

Read through the real code before anything changed:

1. **Past 100 a weapon skill bought its to-hit alone.** Under the default core (the Physical Combat overhaul,
   `combat/pcaao.js`, forced whole online) the skill enters one term, `ceil(skill * 1.5)` to hit; under DFU's
   (`combat/formulas.js` calculateAttackDamage) `skill` to hit. Both clamp the chance at 97. Damage, swing speed and aim
   read no weapon skill at all (`characters/weaponStates.js` swingFrameSeconds reads Speed, Strength and the weapon's
   weight and handling). So a Long Blade mastered to 200 (effective 140) struck no harder and, against most foes, no
   more often than at 100 - while every point of it raised the foes (`skillSoftcap.js` combatEdge).
2. **Hand-to-Hand alone kept paying.** Its damage is read off the skill (`formulas.js` handToHandMinDamage /
   MaxDamage): 11-21 at 100, 15-29 at effective 140 - about 37% more a blow before Strength and the crit.
3. **The families stood apart raw.** Damage a second at Strength 80, Speed 70 (steel, the mean roll, before hit, crit
   and armour; Roleplay & Realism: Items' weapon tables and swing law, both on by default): a Dagger 7.8, a Shortsword
   8.7, a Longsword 12.6, a Claymore 15.5, a Battle Axe 11.0, a War Axe 15.2, a Mace 11.0, a Warhammer 15.7, a Long Bow
   9.0-10.2, the fists 19.8 at Hand-to-Hand 85. The Short Blade was the slowest family per second: DFU draws the Tanto,
   the Shortsword and the Wakizashi as long blades, and the swing law's handling keys the sprite
   (`weaponStates.js` SWING_HANDLING), so only the Dagger came round quickly.
4. **No blow modifier ever reached a fist.** Both cores ran the port's blow modifiers (`entityMods.js` weaponBlowMods -
   the sigil, the sets, the loot powers, the Firmament) on a weapon's blow and never on a bare hand's, so the
   Firmament's fist stars (Pankration's +8%, Iron Knuckles' +5%, a sign's small stars) did nothing in play.
5. **The Firmament's Axe and Blunt Weapon were the thinnest.** One skill notable each, both in the Warrior's sign; the
   Long Blade and the fist one each; the bow and the short blade two or three across their signs.

So the one permanent, scarce choice a fighter makes - which weapons to master - bought a to-hit already at its clamp and
nothing a player could see. That is where the identity goes.

## 3. MARTIAL1 - the path (the law)

`src/systems/martialPaths.js` - a leaf the runner, the save, the sheets and the powers read; the arcane law's shape
(`arcanePaths.js`), one for one.

- **Who.** A player with Master Skills in force (online always; offline the switch - SOFTCAP3) and at least two of the
  six weapon skills mastered. A class that can never master two of them never meets a path (`martialPossible`, by
  `masterSkills.js` masterableCount - the ones mastered and as many more as each career group's 2/2/1 slots leave; the
  Growth tab's guide says so in its headline, and the Master Skills page draws no specialisation line for it - GROWTH2,
  AUDIT GROWTH LANE5-6). AUDIT MARTIAL L4 L3: it counted the career's weapon skills alone, so two that were both minor
  skills - one minor slot between them - showed the card for good; the arcane `pathPossible` the same, and both now read
  the slots - and the guide counts each path's pair the same way (AUDIT GROWTH LANE1-1). SKILL-SWAP (2026-10-19,
  `10-UI/Growth.md` section 11): such a class can now change one unmastered class skill for a weapon skill, for gold, and
  a line under the guide's headline says so where one swap would open a path (AUDIT SUGGESTIONS-1019 L5-1).
- **The choice.** Any pair of the player's mastered weapon skills names one path (section 5); with three mastered, the
  player picks among their pairs. `entity.martialPath` holds the path's id. **Held until given up for 200,000 gold**
  (SPEC-RESET, `10-UI/Growth.md` section 10) - nothing else undoes it; a mastery is never undone. Asked ONCE on the first quiet pass after the second weapon is mastered (`scenes/shared.js`
  raisePlayerSkills - after a mastery's own box and after the arcane path's ask, one box a pass; one path open is asked
  about, several are named and sent to the skill screen - AUDIT SCHOOLS L4 M1's law). The box asks "Martial
  specialisation: {name}?" - never the arcane ask's own "Specialise as {name}?" (AUDIT MARTIAL L4 L4: a spellsword
  holding an arcane path read the second ask as replacing the first) - and Yes says one short line, "Martial
  specialisation chosen: {name}." (AUDIT MARTIAL L4 M1: the classic sheet's notice and the HUD draw it unwrapped in 312
  px, and the technique's sentence ran past the screen in every language; the arcane line's spell sentence the same,
  shortened with it). Any time after, on the skill screen:
  classic, the W row under the Specialisation row on each skill page (the sheet takes raw codes; S is the arcane row's);
  enhanced, the Master Skills page's Martial Specialisation card under the arcane one, the door's count beside Master
  Skills. GROWTH2 (2026-10-17, `10-UI/Growth.md` section 5) moved both cards to the pause window's Growth tab: a guide
  to all fifteen paths, open or not - each one's state on this character, what opens it, its passive, its signature
  technique by each of its weapons (cooldown, fatigue) with its rider, how the technique key wields it, and Choose
  through this law; the classic sheet's W row stands whenever the class can meet a path and opens the same guide
  (GROWTH4).
- **Held and awake.** A path is HELD (`martialHeld`) by my own player entity (never a peer's stand-in) with Master Skills
  in force and both its skills mastered - what answers the technique key with its signature (a technique rides the
  formula, whose skills mentoring already lowers, as a loot line's does). It is AWAKE (`martialAwake`), and its passive
  and rider act, while it is held and I am not mentoring - and the powers add no refereed fight (`sigil.js`
  sigilDueling) and not the beast (`isInBeastForm` - BAL6 balanced the curse on its own claws; the runner's own word,
  "the beast knows no technique").
- **Never at a player.** A technique never meets a player's body (TECH law 3: neither resolution weighs one), every blow
  modifier, strike and rider here refuses a player target and the Warden's ward, and a duel's blow at me passes my
  damage door without asking the port. What is MINE rather than a blow's is not refused (AUDIT MARTIAL L3 F4, L2 F8 -
  KEPT, section 9): Light Step's and Windborne's attributes and the swing's pace ride a siege's and the Wild Zone's PvP
  sheet as the Sigil Sets' do; only a duel and an arena bout (sigilDueling) put them to sleep.

## 4. MARTIAL2 - the weapons past 100

`src/systems/weaponMastery.js`. BAL9b's law, *the skill past 100 is its potency*, for every weapon whose formula stops
paying at 100: online, each effective point of a weapon skill's CLIMB past 100 (`skillSoftcap.js` climbedSkill - the
climb the foes' edge reads, so the climb that raises them is the climb that pays) is worth, to effective 140 at 200:

| weapon | past 100 | x at 200 | where it lands |
| --- | --- | --- | --- |
| Long Blade | every blow 1% harder | x1.4 | the WEAPON BLOW modifier |
| Archery | every arrow 1% harder - the Thunderlock's shot too, scored on Archery | x1.4 | the WEAPON BLOW modifier |
| Axe | a blow at a foe under half its health 2% harder: the axe finishes | x1.8 there | the WEAPON BLOW modifier |
| Blunt Weapon | a blow at a foe at half its health or more 2% harder: the hammer opens | x1.8 there | the WEAPON BLOW modifier |
| Short Blade | every swing 1% quicker | x1.4 the swings | the SWING PACE (new, below) |
| Hand-to-Hand | nothing more - its formula reads the climb in its damage | (x1.37 a blow) | - |

The two halves of a fight read as one: a foe killed from full health by blows of one size takes its first half at x1
and its second at x1.8 (the Axe), x1.29 over the fight - so the heavy two-handers, which lead the six raw, climb a little
less than the sword does. ON A BODY THE RELAY RUNS the line is the relay's word: the Warden, his crystals and host, the
Remnant, its Echoes and Hearts, the Elite Gates' court and the sea serpent are stand-ins whose health is a placeholder
nothing here empties (`world/gate/gateBoss.js` bossStandIn, marked `relayHealth`; AUDIT MARTIAL L3 F2 / L2 F1: read as
full, the hammer took its x1.8 on every blow of a boss fight and the axe never its own). FIELD BUGS 2026-10-18f
RELAY-SHARE: each stand-in carries its owner's reader of the relay's word of that body's health - the share its bar
draws - and the one share law (`combat/healthShare.js` healthShare) reads it, so each half pays its own there too; the
halves' mean, x1.4, the sword's own, stands only where no word is heard. Gutting Lunge reads the same law, as the
loot's execute does, and its second blow there is owed to the blow's claim (AUDIT MARTIAL had kept it "never fires on a
body the relay runs"). Headsman's Chop reads it too (AUDIT FB1018f L3-5: `combat/technique/techniqueBlow.js` kept a
share of its own and read the placeholder as whole - x1.20 on a lord at a fifth, for its x2.00). The arcane Blood Boil reads it too, but its second burn has no record to land on at a stand-in
(the dungeon context's `tellStandIn` tells the riders no foe), so it burns nothing there.

**THE SWING PACE** (`characters/weaponStates.js` registerSwingPaceMod) - named modifiers `fn(ctx, w) -> percent`, as
CAST-SPEED's rate (`castSpeed.js`): the swing's frame time is divided by 1 + their sum, at most `SWING_PACE_MOST` 50%,
never under the swing law's floor (`SWING_FRAME_MIN`: no swing quicker than 0.45 s). Read at the one door every swing's
frame time passes (`getMeleeWeaponAnimTime`), over whichever law answered - the port's, Roleplay & Realism's or its
Items' - so all three arms are paced alike; asked only for a wielder the port knows (`ctx.entity`), with the swing
reader's answer where the frame's law has read it (`combat/swingLaw.js` readSwing, which now names the swing's
`family`) - else a modifier reads the weapon itself, and only once it may pay: the Short Blade's asks its climb first,
then the swing's family alone (`swingLaw.js` swingFamily - AUDIT MARTIAL L2 F3: the reader built a record for every
swing frame of every wielder on a mod's arm). At Speed 100 a dagger already swings near the floor, so the Short Blade's
pace there is less than x1.4 (recorded, section 9).

Online alone, as BAL9b and SCHOOLS2: offline the game is Daggerfall's. MY blow at a foe - never a player, never the
Warden's ward, never in a refereed fight, never while mentoring, never the beast's claws.

## 5. MARTIAL3/4 - the fifteen paths

Each path: a PASSIVE while awake, and a SIGNATURE TECHNIQUE with a RIDER - what the technique does past its blow, only
when its own path's holder strikes with it awake. A form for each of the pair's families: a pair with Archery shoots
with a bow and strikes with its other weapon; the forms share one cooldown.

| path | skills | passive | signature technique (its forms) | rider |
| --- | --- | --- | --- | --- |
| Blademaster | Long Blade + Short Blade | **Flowing Steel**: each blow or arrow that lands builds a stack for 4 s, 3% more damage a stack, at most 5 (a whole blow: an off-hand one counts its share, the loot's Flow's law - AUDIT MARTIAL L1 L2) | **Thousand Cuts** - dash 5 m striking every foe passed, x1.0 | every foe it strikes is cut again for half |
| Warblade | Long Blade + Axe | **War Rhythm**: a kill quickens the swings 15% for 10 s | **Rallying Cleave** - every foe within 80 degrees either side of the look (a 160-degree sweep), x1.1 | from the press, blows and arrows land 15% harder for 8 s |
| Vanguard | Long Blade + Blunt Weapon | **Iron Discipline**: foes' blows land 10% lighter (whole points, the fraction carried) | **Judgement** - leap up to 8 m onto a foe, every foe within 2.5 m, x1.3 | each foe struck restores 4% of my health, from 3 at most |
| Ranger | Long Blade + Archery | **Hunter's Instinct**: blows and arrows strike beasts 20% harder (the loot's one foe group - a class foe is a man) | **Mark of the Hunt** - bow: a shot through 3 foes, x1.2; blade: a pounce up to 8 m, x1.3 | each foe struck is marked 12 s: my blows and arrows at it 20% harder |
| Skirmisher (id `bladedancer`) | Long Blade + Hand-to-Hand | **Dancer's Step**: one foe blow in 10 misses (a blow evasion, asked before any modifier) | **Cyclone** - every foe within 3 m around, x1.0 | from the press, the swings quicken 20% for 6 s |
| Bloodletter | Short Blade + Axe | **Bloodlust**: each kill restores 5% of my health | **Gutting Lunge** - dash 5 m striking every foe passed, x1.2 | a foe already under 25% of its health takes the blow again |
| Cutthroat | Short Blade + Blunt Weapon | **Cheap Shot**: blows and arrows at a foe that has not noticed me 25% harder | **Blackjack** - one heavy blow at the nearest foe before me, +30 to hit, x1.4 | a foe that had not noticed me takes it twice |
| Assassin | Short Blade + Archery | **Opening Strike**: my first landed blow or arrow at each foe 30% harder | **Vanishing Strike** - bow: one heavy shot, x1.6; blade: a dash behind a foe, x1.3 | when it lands I fade: Chameleon, 4 rounds (once a press) |
| Shadowdancer | Short Blade + Hand-to-Hand | **Light Step**: +10 Agility, +15 Dodging | **Phantom Strike** - a dash behind a foe up to 8 m, x1.2 | from the press, for 6 s one foe blow in 3 misses |
| Juggernaut | Axe + Blunt Weapon | **Stand Firm**: a hurt that crosses 30% of my health heals 20% of it; ready again after 3 minutes | **Earthsplitter** - every foe within 3.5 m around, x1.0 | from the press, for 10 s foes' blows land 25% lighter |
| Woodsman | Axe + Archery | **Tireless**: each kill restores 15% of my fatigue | **Felling Strike** - bow: 5 arrows rain on a spot, x0.6 each; axe: a leap up to 8 m, x1.3 | each foe it fells (the kill's own word, within the loot's 1-second felling bound) restores 10% of my health |
| Berserker | Axe + Hand-to-Hand | **Frenzy**: below half my health, blows and arrows 20% harder and swings 10% quicker | **Savage Whirl** - every foe within 3 m around, x1.2 | from the press, for 8 s, 10% of what every blow I land took heals me |
| Crusader | Blunt Weapon + Archery | **Purge**: blows and arrows at undead and daedra 20% harder | **Hallowed Strike** - bow: a shot through 3 foes, x1.2; mace: one heavy blow, +25 to hit, x1.5 | undead and daedra it strikes take half again |
| Brawler | Blunt Weapon + Hand-to-Hand | **Grit**: each magic round, 1% of my health and 2% of my fatigue back | **Knockout** - one heavy blow at the nearest foe before me, +30 to hit, x1.6 | for 8 s the foe it strikes hits me 30% lighter |
| Strider (id `windrunner`) | Archery + Hand-to-Hand | **Windborne**: +10 Speed, +15 Running, +15 Jumping | **Windstrike** - bow: 6 arrows rain on a spot, x0.5 each; fists: a flying kick up to 7 m, from the air too, x1.2 | each foe struck restores 5% of my fatigue, from 3 foes at most (foes, never shafts) |

Every percent a path lays on a blow is at most `MARTIAL_BLOW_MOST` 40 together (the Ranger's beast and mark are the
most any path reaches); a heal never passes its maximum (`playerHeal.js` healMine); a rider's second blow goes through the
host's own door (`playerDoor.js` hurtFoe - its pool, a kill mine), and on a body the relay runs it is owed to the claim
its blow sends (`oweFoe`, the loot's `again` law), its number shown either way. Stand Firm answers a hurt that CROSSES its line, never a death a death
save turned aside (`saved` - the Vigil's and Absolution's rule).

AUDIT MARTIAL changed the table where the code and the words parted:
- **Nothing guesses what the pool's door leaves** (L1 M1). The riders are told before the pool's own door lands the
  blow, and the door may land less (a party's toughness, the foe's Shield, a bout's floor). Felling Strike's heal is
  the kill's word now (`martialKill`, within `lootPowers.js` TOLL_REFUND_S of its landing - the Undertow's law, AUDIT
  WORLD-REWARDS B2); Gutting Lunge reads the foe's health before the blow ("already under"); Thousand Cuts, Blackjack and
  Hallowed Strike's second blows go as the loot's `again` does, the door deciding - a corpse takes no blow
  (`exteriorFoes.js` and `dungeonContext.js` damageFoe, AUDIT 68 S19/S20).
- **A window opens as the press goes** (L1 L3, L1 L7). Rallying Cleave's, Cyclone's, Phantom Strike's, Earthsplitter's
  and Savage Whirl's windows are told by the press (`techniqueBlow.js` registerTechniqueUsedListener, from the runner's
  `pay`), so a sweep's every foe and a whiff share them; told at a landing, a cleave's second foe took its +15% and its
  first did not.
- **"At most three foes" counts foes** (L1 L1 / L2 F6 / L5 M5): a volley's shafts on one foe are one.
- **No rider answers a foe no kill counts** (L1 L5) - the City Watch, my own summon (`neverCounts`).
- **The two new names** (L4 N2): the Bladedancer is the Skirmisher and the Windrunner the Strider - the Firmament had a
  Blade Dancer notable and a Wind Runner keystone first. The ids stand (a save's). The numbers are a first cut, every one in one table
(`MARTIAL_NUMBERS`; the forms' in the forms' table), pinned literally, so a balance pass moves one number and one pin.

## 6. The signature techniques

- **Forms, not lines.** Each is the roster's own shape (`combat/technique/techniqueRoster.js` TECHNIQUES - a mechanic
  the runner already performs: rain, pierce, leap, dash, swing; its multiplier on DFU's own CalculateAttackDamage, its
  fatigue, its cooldown), with three words of the port's own: `path`, `families` and `fx` (the roster technique whose
  feel it wears, `techniqueFx.js` TECH_FX). They stand OUTSIDE the roster, so no loot door draws one, the item law reads
  no line naming one (`lootRarity.js` validAffix) and the account service's law is untouched.
- **The key.** `combat/techniques.js` techniqueInHand: the weapon's own line first; with none, my HELD path's form for
  the family in hand (`martialPaths.js` signatureFor - the bare hand Hand-to-Hand's, whatever gloves are worn; a
  gauntlets' own line still wins bare-handed). Never the beast's claws, never the Thunderlock (a gun is no bow's), never a
  weapon outside the pair. A signature needs no loot ladder (Loot-II law 6 sleeps a FOUND line; a path's signature is
  none) - the refusal and the HUD chip both say so; and a found line asleep leaves the key FREE, so with the ladder off a
  held path's signature answers it on a lined weapon too (AUDIT MARTIAL L4 L6: the line refused the key with the ladder's
  words, and the words promised the signature). Its value is none: a signature is its base, as a line's power is its
  own. The runner's English status lines name it in English (each form's `en` - AUDIT MARTIAL L4 N1); the chip names it
  in the player's language, kept a text revision (`textManager.js` textRevision - AUDIT MARTIAL L1 L6 / L2 F2: the
  name's getter built the path's six lines a frame).
- **One cooldown a path.** The runner's cooldown slots grow one a path (`sig:<path>`), shared by its forms - a Ranger's
  shot and pounce are one clock, whichever weapon is in hand; no loot technique's clock moves.
- **The rider.** A new listener on the two resolutions every host shares (`technique/techniqueBlow.js`
  registerTechniqueLandedListener, told by `playerWeapon.js` resolveHit and `arrowFlight.js` playerArrowHitFoe once for
  each foe a technique's blow reached, before the pool's own door lands it), with a `use` token every blow and shaft of
  one press carries (`techniques.js` execute), so "three foes at most" and "once a press" count a press - its distinct
  foes (AUDIT MARTIAL L1 L1). A press is told too, as its price is paid (`registerTechniqueUsedListener`), for the
  windows (section 5). A shaft into the sea serpent's hide is weighed by its form and told as a foe's is
  (`arrowFlight.js` shaftOnRelayBody, the follow-ups it owes riding the hand's one claim - AUDIT MARTIAL L2 F5, AUDIT
  SCHOOLS L2 F4's spell for the shaft).

## 7. No judge's finding

SCHOOLS5 gave the account service's judge a `path` finding. A martial path has none, on purpose: a path acts only with
both its masteries held, which the client reads at every ask (`martialHeld`), and the judge reads no mastery (the
Arcane page's section 7: a pre-SOFTCAP4 save can hold a skill past 100 unmastered, and the verdict freezes trade). A
forged `martialPath` without its masteries grants nothing; one with forged masteries passes a finding as easily. A
finding would move the service's version through thirty-three pinned files and stop nothing. The save carries the
field (`systems/save/save.js` martialPath, martialPrompted; an id no table holds restores as none).

AUDIT MARTIAL L3 F5 - OPEN, the owner's (SCHOOLS L3 F3's question, which MARTIAL2 makes pay on every weapon): a forged
save listing every weapon skill mastered at 200 judges clean and takes every weapon's past-100 bonus in PvE (never a
player: every PvP strike is the referee's stub). A judge check that the masteries obey their own 2/2/1 law would cap a
forgery at the honest most, not stop it, and move the account version.

AUDIT MARTIAL L3 F1: an OLDER build drops `martialPath` (a key it never knew), and the new build, finding none, asked
again - a second choice of a permanent one. The save writes a MIRROR into the one record every build carries whole
(`career.martialMirror`, `{ path, of }` - the character's id beside it, so an heir's inherited custom career gives
nothing), read back, already asked, only from a save with no `martialPath` key at all; the live career never holds it.

## 8. The seams, and the four hosts

- `systems/martialPaths.js` - the law: the fifteen, every number (`MARTIAL_NUMBERS`), the forms (`SIGNATURE_TECHNIQUES`),
  their words, the choice, held and awake, the signature in hand.
- `systems/weaponMastery.js` - the weapons past 100 (section 4), registered at import.
- `systems/martialPowers.js` - what the paths DO, registered at import through the seams the sets, the loot and the
  arcane paths opened: the weapon blow, the strike listener, the swing pace, the damage modifier, the blow evasion, the
  hurt listener, the kill listener, the magic round, the entity fold and the technique-landed listener. It imports
  `weaponMastery.js`, so every page that has one has the other.
- `combat/weapon/weaponRig.js` - THE ONE RIG every host builds, so all four are wired by it: `scenes/exterior.js`,
  `scenes/world.js`, `scenes/worldModes.js` (interiors) and `scenes/dungeonContext.js` (dungeons). It imports
  `martialPowers.js`; the technique runner it steps (`combat/techniques.js`) is every host's; the riders hear the swing's
  and the shaft's shared resolutions.
- `combat/techniques.js` - the signature in hand, the cooldown slots, the ladder's gate, the `use` token, the press told.
- `combat/technique/techniqueBlow.js` - the landing's and the press's listeners; `combat/arrowFlight.js` shaftOnRelayBody.
- `characters/weaponStates.js` - the swing pace; `combat/swingLaw.js` - the swing's family.
- `scenes/shared.js` - the ask; `ui/charsheet.js` (the classic rows) and `ui/growth/specGuide.js` - the choice (GROWTH2:
  the Growth tab's guide reads both families; the Master Skills cards and `specCard` are gone - `10-UI/Growth.md`).
- `systems/save/save.js` - `martialPath` and `martialPrompted`.

## 9. Departures, and what is recorded rather than built

- **Port-only, all of it.** Daggerfall has no specialisation and no weapon perk past 100; Port-Ledger A records the arc.
- **A respecialisation costs 200,000 gold**, as an arcane path's does (SPEC-RESET, `10-UI/Growth.md` section 10); a
  mastery is still permanent.
- **Offline the weapons past 100 stay Daggerfall's** (section 4); the paths themselves work offline with the switch on.
- **The Short Blade's pace meets the swing law's floor** at the top of Speed: a dagger at Speed 100 swings at 0.107 s a
  frame, and the floor is 0.09 - x1.19 there, x1.4 at Speed 87 and below. The floor is SWING-LAW's ("swing speed is
  insane"); it is not moved for one skill.
- **The rogue's set** (Backstabbing, Critical Strike, Dodging, Stealth, Lockpicking, Pickpocket - fifteen pairs more) and
  **spellsword hybrids** (one weapon and one school) were offered and left for later arcs.
- **The beast** takes no path power, no weapon past 100 and no fist modifier: BAL6's claws stand as balanced.
- **The Firmament's weapon keystones** were asked as notables: no star was added (a new star moves the sky's layout, its
  keys' hash and every shared build code); stats moved on six notables instead (BAL10, `Balance-Arc.md` section 16).
- **The pace is laid over a mod's own answer** (AUDIT MARTIAL L5 N2): `getMeleeWeaponAnimTime` divides what Roleplay &
  Realism's `TryGetOverride` arm answered, so the mods' arms are paced as the port's - a departure from DFU's override
  contract (an override's answer is final there), taken so no arm escapes the pace.

Recorded by AUDIT MARTIAL, not changed:
- **The powers' memory outlives a character switch** by its windows' seconds (Stand Firm's recovery the longest), and a
  reload starts every power ready - the sets', the loot's and the arcane paths' shared pattern (AUDIT SCHOOLS L1 L3).
- **Open PvP** (a siege, the Wild Zone - no refereed fight): the paths' attributes and the swing's pace are mine, as the
  sets' are (L3 F4 / L2 F8; AUDIT SCHOOLS L1 L4 kept the same). FIRM1 alone takes the sky off a PvP sheet.
- **Found here, outside the arc, left for their own arcs:** the Firmament's `hpRegen`, the loot's `regen` and the arcane
  Steadfast regrow health in the courts whose law bars regeneration (`courtRules.js` regenBarred - Grit now reads it, L3
  F3); the loot's own leech counts the overkill Savage Whirl's no longer does (L1 L4).

## 10. Pinned

`test/systems/martial_paths.test.js` (11) - the law (the fifteen pairs whole, every form its own path's and family's,
none a loot technique, every number literal), the choice and its refusals, held and awake, an arcane and a martial path
together, the save's round trip; the signature in hand through the real runner (a line wins, the bare hand, gloves with
and without a line, the claws, the Thunderlock, a path not held, the ladder off, the shared cooldown of a real press);
every weapon past 100 through the real blow registry on both sides of its line, and asleep offline, mentoring, in a duel,
as the beast, at a player or the Warden; the short blades' handling in all three swing arms and the pace with its cap
and floor; the fists' modifiers in both cores and never the claws; every passive through its seam (the damage door and
the evasion through the real `hurtPlayer`); every rider through the landing door and the door told by the real
`resolveHit` and `playerArrowHitFoe`; the Firmament's notables; the hosts' wiring by source.

AUDIT MARTIAL (`01-Overview/audits/Audit-Martial.md`): `test/systems/audit_martial.test.js` (35) - every finding it
fixed, by execution through the producers (the runner's own press, real foes, the save, the magic round, both cores'
outer calls, both mods' arms, the Stats page, the relay's stand-in, the shaft's door, the sheet, the one ask, the
enhanced pause window), every line on both sides and every window at its end; `tools/mutants/audit_martial.json` (112).
PIN MOVED (AUDIT MARTIAL) in this file's: the riders' windows told by the press, Felling Strike's kill, Gutting Lunge at
24 and 25 before the blow, a pre-arc save with no mirror, the four skill notables' kept stats, the estimate's word, the
ask's title, the ladder-off signature; and `schools_arcane`'s chosen line.

Mutants: `tools/mutants/martial.json` (119 - the arc's and BAL10's), every one dead but one recorded equivalent (a
fall's evasion: the damage door asks an evasion only of a foe's blow, so the check is belt-and-braces, as the arcane
Foresight's is). PIN MOVED: `swinglaw` and `audit0929_swing` (the reader names the swing's `family` and `shortBlade`; both
mods' arms hand the short blade's handling on), `audit_schools` L5 H3 (the arcane card found by its title - its Brute's five weapon
skills now meet the martial card beside it), `audit_uicalm_firm1` (the Templar's Mace, Battlemage's Focus's spellPower
4 the same). Re-aimed by content, every one still dead: `audit0929_swing`'s RR weight, three of `audit_schools`'
(the door's count, Choose, the card for no schools - now `specCard`'s), `auditclaws`' card metal, four of `swinglaw`'s
(both mods' arms), two of `tech1`'s (the ladder, the shot's speed) and four of `techfx1`'s (the leap's cue, the run's
start, the chip's list).

Every word a player reads goes through the text core (`t()`, the keys under `martial.` and `pause.master.martial.`),
drafted into the thirteen whole languages (`tools/l10nInSession.mjs`).
