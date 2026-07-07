# Systems-Arc (ACTIVE)

Phase 6 of the plan: quests, magic, items, guilds - split as needed.
Opened 2026-07-06 after Combat's core shipped via C8. The routed rows
(Ledger C) and the Home ledger's interims define the near queue; the
readers/world/entity layers everything here needs are COMPLETE.

## S1 (items/loot foundation): SHIPPED

src/systems/loot.js ports LootTables.cs + the ItemBuilder
CreateRandom* pick rules verbatim:
- The 21-key LootChanceMatrix table exact (incl the source's
  Chronicles-vs-FALL.EXE notes: B is plants in the EXE; tables I+ are
  off-by-one vs Chronicles).
- GenerateRandomLoot flow: gold Range(Min, Max+1) x level; WP/AM/CL/
  BK/RL halving loops on Dice100 (a 0% category keeps classic's 1/100
  chance); ingredients with the FALL.EXE level split - C1/C2/P1/P2
  scale by level, C3/M1/M2 flat.
- Pick rules: weapons uniform over 19 slots with slot 18 = arrows
  (stack Range(1,21), material 0); armor uniform over the 11 pieces
  incl shields + RandomArmorMaterial; ingredients/religious uniform
  over their ItemGroups index lists (brace-bounded extraction from
  ItemEnums.cs - a first grep bled across enum boundaries, caught by
  overlap inspection); books = template 277 + variant Range(0,4);
  clothing by gender group.
- DFU's Random.InitState(items.GetHashCode()) reseed is an arbitrary
  hash with no determinism value - our uniform roll slots match the
  role (the approved engine-PRNG stance).
- INTERIM (loud): MI magic items SKIPPED until the magic arc (loot
  under-generates that category); clothing carries group/index/
  variant only (dressing = UI arc).
Enemy entities generate items at spawn per SetEnemyCareer order;
corpses carry them. OPEN: corpse pickup (Player activation seam),
dungeon treasure piles + interior containers consume this next.

## S2 (inventory + pickup + dungeon treasure): SHIPPED

src/systems/inventory.js: the verbatim stackable rule ("only
ingredients, potions, gold pieces, oil and arrows... equipped,
enchanted and quest items never" - potions/oil covered the day their
groups exist), AddItem merge-vs-append (group + template + material
identity), weapon weight x material/4 through the single-sourced
multiplier table (armor material weight FLAGGED to S2b), transferAll.
playerEntity carries items[].

Dungeon treasure (the Ledger C row): random markers (editor 199.19)
roll an icon from the verbatim 20-entry table on archive 216 and
generate by LootTables.GenerateLoot's dungeon-type -> key table (19
types, K/N/M/Q/U/D/L/F/S); fixed 216 flats keep their record with the
same generation. Piles ground via floorLanding, render as PER-PILE
billboard batches, and pickup removes the pile through the renderer's
new destroyBillboardBatch (review catch: an optional-chained call to
a method that didn't exist would have silently leaked the GL
objects). Activation: lootTargets() exposes piles + lootable corpses;
takeLoot transfers into the player through AddItem; routed in BOTH
dungeon hosts ahead of the exit/action paths. Transfer feedback
message + inventory UI pend the UI arc; interior containers pend
S2b; the DFU icon-roll Random slot stays a uniform roll per the
approved stance.

## S2b (containers + exact weights): SHIPPED

Armor/weapon weight is now CalculateWeightForMaterial VERBATIM -
quarter-kg quantized with Unity's half-to-even Round (an iron and a
daedric dagger BOTH weigh 0.5 kg: Round(2.5) banks to 2; the earlier
'x multiplier / 4' shorthand diverged and its ratio test pinned the
shorthand - both replaced with truth pins). Leather rides the
Erisceres Round(INT(w*4)/2)/4; chain's x2 is a VALUE rule, weight
unchanged. House containers: the verbatim predicate (modelId/100 ==
418 or modelId-41000 in the 13-index list; TextureRecord = id % 100)
lives PURE in systems/containers.js; interiors collect matching
furniture as private, EMPTY containers, activation opens them through
the shared inventory synchronously (review catch: the first handler
nested dynamic imports and completed a tick after returning). Shop
shelves (27-index list), owned-house, and bookshelves pend their
slices; open-feedback pends the UI arc.

## S3 (character creation): SHIPPED

src/systems/chargen.js ports the chargen core verbatim: StatsRollout
(career base attribute + Range(0,11) each; bonus pool Range(6,15)),
SkillsRollout (35 defaults Range(3,7); primary 28 / major 18 / minor
13, each + Range(0,4); +6 distributable per group), RollMaxHealth
level 1 = 25 + hpPerLevel, per-level-up Range(hp/2, hp inclusive) +
the endurance modifier floor(END/10)-5, floored at 1 (classic's
frame-counter DFRandom reseed is arbitrary; uniform slot, approved
stance). The SKILLS enum (35), CLASS_CAREERS (18), and the verbatim
weapon -> skill mapping live here; skillValue() reads BOTH entity
shapes - enemies keep the SetEnemyCareer flat number byte-identical
(the whole suite passed untouched through the formula switch), the
player carries the rolled 35-array. Formulas now consume REAL
skills: the attack's chanceToHitMod is the weapon's skill (or
HandToHand), Dodging/CriticalStrike/Backstabbing are their own
lookups. TallySkill lands (skillUses counters; the E3c flag clears)
- advancement thresholds are the follow-on. Boot: dungeonContext
rolls the character once from CLASS{nn}.CFG - ?class=0..17 or the
INTERIM default Warrior (16, loud); the pool-spend policy
(lowest-first, loud) holds the slot until the chargen UI. The
maxHealth-50 / flat-skills-30 / stats-50s interims are GONE.

## S3b (skill advancement + leveling): SHIPPED

systems/advancement.js completes the TallySkill story verbatim:
usesNeeded = floor(skillValue x skillMult x careerAdvMult x
1.04^level x 2/5) + 1 over the 35-entry GetAdvancementMultiplier
table; the reflexes modifier is the source's exact bit math
(0x10000 - ((reflexes-2) << 13), applied as (uses x mod) >> 16); the
360-classic-minute gate; raises reset uses, cap at 100 and at 95
while a primary is mastered; levelUpSkillSum = primaries + majors -
lowest major + highest minor, anchored at chargen; CheckForLevelUp =
floor((current - starting + 28)/15). HEADLESS INTERIM (loud): the
level-up applies immediately (HP roll + the 4..6 BonusPool by the
lowest-first policy) - DFU routes through the char sheet (UI arc).
TWO SOURCE-FIDELITY CATCHES: (1) the CFG AdvancementMultiplier is
16.16 FIXED-POINT rounded to two decimals (DFCareer:585) - the
reader stored the raw u32, a latent bug now converted at the reader
with the raw kept for parity; (2) TallySkill's 20000 clamp is
load-bearing - it is what keeps the (uses x reflexesMod) >> 16 shift
inside int32 in C# AND JS; the clamp is now verbatim in tallySkill
(the test's own overflow found it). The classic clock (dt x
TimeScale 12) ticks in the dungeon frame; raiseSkills gates itself.

## S4a (magic foundation I - spells file + magicka): SHIPPED

formats/spellsStd.js is the verbatim SPELLS.STD reader: 89-byte
(0x59) records, 3 effects of {type, subType} where subType is ALWAYS
read - the source's `if (type == 0xFF) continue` can never be true
(C# promotes sbyte -1 to int -1, not 255) and the record arithmetic
(6+1+1+2+4+9+9+15+25+1+1+15 = 89) proves the layout; the dead branch
is documented, not reproduced. Element/range/cost, the three
duration/chance/magnitude triples, 25-byte name, icon, index; records
with all effect types -1 are gated out per ReadSpellsFile. MAGICKA:
the career bitfield decode ((flags & 0x1C00) >> 8 -> x3.00/2.00/
1.75/1.50/1.00/0.50) + FormulaHelper.SpellPoints = floor(INT x mult)
roll at chargen (maxMagicka/magicka on the entity). DRAINMAGICKA is
REAL (the last effect-action interim clears): verbatim max(1,
IsFlat ? Magnitude : AxisRaw) off current magicka, 0-floored, wired
through the dungeon sink. Remaining for S4: spell EFFECTS (casting,
CastSpell action, targeting, the effect implementations) and magic
ITEMS (MI loot unlock) - S4b+.

## S4b (magic foundation II - trap spells): SHIPPED

The Combat-queue CastSpell row unblocks. systems/spellcast.js:
FormulaHelper.SavingThrow verbatim (career tolerance precedence
Resistant > Immune > LowTolerance > CriticalWeakness over the CFG
flag bytes; DFU's own mixed-tolerance departure preserved; immunity
>= 100 -> 0; MagicResist = floor(WIL/10); the 5..95 clamp; DF
Chronicles proration within 20 of a failed roll), the
EntityEffect.GetMagnitude roll (base + plus x floor(casterLevel /
perLevel), per-0 guarded), missile constants (speed 25, radius 0.45,
life 8s, the sequential 375-379 element archives), and the resolved
CLASSIC DAMAGE FAMILY - Damage Health (4,0) + Continuous (1,0)
applied instant; every other effect FLAGGED to the effect-library
slice. Racial saving flags + biography mods pend their slices.
ACTION: CastSpell joins the effect flags with the verbatim
45.454546 cooldown tick, firing (spell Index, object origin) through
a proper constructor sink. SCENE: SPELLS.STD loads once per context
(absent -> loud no-op); missiles fly at the player's mid-capsule
(direction locked at fire, +40*GlobalScale origin lift), collide
with the level via raycast, retire at lifespan, and hit at
missile+capsule radius -> resolveSpellVsPlayer -> health. REVIEW
CATCHES: the first flight loop rebuilt the billboard batch EVERY
FRAME (the exact thrash class the engine audit killed - now one
batch riding the origin uniform, zero churn); drawFoes was
foes-gated in BOTH hosts so trap spells were dead in empty dungeons
- hosts now call unconditionally (internally gated); a stray
textureFiles reference removed with the churn path.

## S4c (magic foundation III - magic items): SHIPPED

formats/magicDef.js is the verbatim MAGIC.DEF reader: i32 count,
62-byte records (index = the record's STREAM POSITION per the
source's own identity key; 32-byte name; type 0 Regular / 1-2
Artifact; group; groupIndex; 10 x {type s8, param s8} enchantments
with -1 unfilled; uses i16; value i32; material u8). loot.js:
setMagicItemTemplates registry (set once at context build after
MAGIC.DEF loads alongside SPELLS.STD; absent -> the MI category
stays flagged-skip) + CreateRegularMagicItem VERBATIM - filter to
type 0, uniform pick, the group byte routes through the exact
tables (0 -> {Armor 2, Weapons 3, Mens 6, Religious 10, Womens 12,
Gems 14, Jewellery 25}; 1 -> {2,3,6,12,25}; 2 -> Weapons), the
"No arrows as enchanted items" re-roll, the magic name replacing the
base item's, enchantments carried raw (-1 slots filtered), condition
= uses. Gems [0..7] and Jewellery [133..140] joined ITEM_GROUPS
(both verified against the real template table - classic templates
OPEN with the gems). Item VALUE from enchantment costs is FLAGGED to
the economy slice (shops). The MI halving loop is LIVE - loot no
longer under-generates.

## S5 (effect library I - player casting): SHIPPED

The player spends magicka. spellcast.js: TARGET_TYPES verbatim
(ClassicTargetIndexToTargetType: CasterOnly/ByTouch/
SingleTargetAtRange/AreaAroundCaster/AreaAtRange) and the resolver
GENERALIZED to resolveSpellVsTarget - one function for player and
foes alike (both carry career flag bytes + stats; caster level =
entity level per CalculateCasterLevel; no alias kept). SCENE: the
readied spell is ?spell=N or the FIRST ranged damage spell in
SPELLS.STD (deterministic, no magic index; the spellbook UI pends);
playerCastInput gates on magicka >= the record's classic cost field
(FLAGGED: the DFU per-effect cost tables replace this in the cost
slice), spends, and fires a player missile from the eye along the
look; player missiles seek FOES (mid-capsule contact) and resolve
through the same saving throw - a fire-immune career shrugs a
fireball, test-pinned. Melee and spells now kill through ONE
damageFoe door (corpse + reaction factored - missiles did not grow
a second death path). Range types 0/1/3 FLAGGED to the library
(buffs, touch, areas). INPUT: C casts in both hosts (the input map
pends the UI arc); ?spell plumbed through all four hosts. REVIEW
CATCHES: my first host edit left the keydown listener unclosed
(node --check caught it); cam.forward() was an API I invented -
both hosts derive the look vector the way they already do.

## S6 (starting spells): SHIPPED

The spellbook interim retires: STARTING_SPELL_SETS carries the
verbatim StartingSpells asset (classes 0..6 only, per
SetStartingSpells' own gate - Mage/Sorcerer share a set, Bard gets
Slowfalling alone; >6 have none); startingSpells() resolves the
SpellIDs against the loaded SPELLS.STD map, skipping missing records
LOUDLY (the source's own error path). BOTH chargen paths grant (the
U2b flow and the ?class headless skip); the first known spell
auto-readies after the flow. ORDER FIX at root: the ?class grant ran
29 lines before SPELLS.STD loaded - the whole S4b data-load block
moved ABOVE its consumers (data before use, truthful ordering). The
custom-class Spellsword rule pends custom classes.

## S7 (effect library I - the spine): SHIPPED

systems/effects.js: one magic ROUND = one CLASSIC MINUTE (the
broker's own catch-up cadence; our S3b clock feeds it - the scene
ticks every whole minute crossed for the player AND every live foe);
duration = DurationBase + DurationPlus x floor(level/per), straight
arithmetic per the source (no roll, per-0 guarded). applySpell is
THE ONE DOOR - resolveSpellVsTarget retired at root, every caller
and test migrated: HealHealth (10,8) instant heal through a heal
sink (the caller owns the max clamp - healPlayer joins hurtPlayer);
DamageHealth (4,0) instant as before; ContinuousDamageHealth (1,0)
UPGRADED from the S4b instant interim to a real active effect - the
save rolls ONCE at application and its percent scales EVERY round's
fresh magnitude roll (GetMagnitude computes per MagicRound,
verbatim); expiry at 0; failed saves never join. CASTER-ONLY
(rangeType 0) casts apply to SELF - Balyna's Balm heals the Healer
who starts with it; ByTouch and the areas stay FLAGGED. Other effect
families skip counted (the library grows one family at a time).

## S8 (effect library II - the starting-set buffs): SHIPPED

BUFF_KINDS carries the classic keys verbatim - Slowfall (25,255),
WaterWalking (31,255), ChameleonNormal (23,0) - so the starting
spellbooks WORK: incumbent self-effects tracked by kind on
activeEffects, a re-cast RENEWS to the fresh duration (not stacked,
pinned), expiry clears the hasActiveEffect query. CONSUMERS THREADED
(no globals - the first cut's function-property hook was killed for
the same smell audits keep burying): slowfall scales the player
motor's gravity (fallScale 0.15, fed per frame by BOTH hosts from a
context getter - the scene has no motor binding, review-caught as a
phantom reference); chameleonNormal HALVES foe sight radius,
threaded canSeeTarget -> senses.update -> the scene's per-frame
scale. waterWalking tracks but its consumer is FLAGGED (swimming
pends). Buffs land without saves (self-casts; hostile-cast buffs are
nonsensical).

## Queue
- Magic remainder: the effect library (non-damage spell effects,
  casting by the player, magic rounds), enchantment economy/value.
- Later: quests, guilds, shops, dialog, calendar deep-wiring,
  save format.
