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

## S2 correction (2026-07-07, live-console root fix)

The S2 treasure loop iterated the RAW `blocks` PARAMETER - the
BlocksFile reader - instead of `dungeon.blocks`, the placed-block
array every sibling consumer uses. With real ARENA2 the boot threw
`TypeError: t is not iterable` inside buildDungeonContext and
BLACK-SCREENED the deploy; headless tests pin the pure loot math
and never walk this scene loop, the build is shape-blind, and the
field names (originX/originZ/layout.markers) matched the RIGHT
structure - the binding was wrong, not the shape, which is exactly
why nothing caught it. Rooted by mapping Mac's minified stack (Gs =
buildDungeonContext, `t` = the third param) back through the
deterministic bundle to the one `for..of` over that param.
Headless boot re-verified clean post-fix. LESSON, recorded: scene
loops over build parameters are invisible to the whole gate -
live-console + bundle mapping is the diagnostic that works.

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
slice. (AUDIT 18: the racial resistance/immunity/low-tolerance/
critical-weakness block and the three biography resist mods now ride
the same function, at DFU's exact positions - SpellHasFlags included,
element-independent Paralysis clause and all.)
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

## S9 (cast ranges II - touch, around-caster, explosions): SHIPPED

The last two cast ranges land and rangeType 4 becomes what it is:
ByTouch (1) picks the NEAREST LIVE foe whose mid-capsule sits within
melee reach (2.25 + 0.25, the WeaponManager shape) with a real LOS
raycast - the cast SPENDS on a whiff (classic wastes it);
AreaAroundCaster (3) sweeps every live foe within the verbatim
Missile.ExplosionRadius 4.0 of the caster; and rangeType-4 impacts
now EXPLODE - an indiscriminate OverlapSphere at the impact point
hitting every live foe in the radius AND the player when close
enough (trap fireballs splash; your own fireball can burn you at
your feet). SingleTargetAtRange (2) keeps direct-only. The pure
targeting (pickTouchTarget, sweepFoes) lives in spellcast.js and is
pinned; the FLAGGED ranges note retires - all five TARGET_TYPES are
live.

## S10 (spell casting costs): SHIPPED

The record-cost interim RETIRES: systems/spellcost.js carries
CalculateTotalEffectCosts verbatim - per-effect component gold =
trunc(offset + A*starting + B*trunc(increase/per)) with magnitude
AVERAGED ((baseMin+baseMax)/2, (plusMin+plusMax)/2); per-effect
spellpoints = gold x (110 - the caster's skill IN THAT EFFECT'S
MAGIC SKILL) / 400; unknown families cost the zero-component fudge
MakeEffectCosts(60,100,160); target multipliers on the SUMS
(CasterOnly/ByTouch x1.0, Single x1.5, AroundCaster x2.0, AtRange
x2.5, float-mul int-cast); spellpoint floor 5. The six shipped
effects carry their classes' own factors (DamageHealth 20/28 mag,
Continuous 28/8 dur + 40/28 mag, Heal 20/28 mag, Slowfall 20/100
dur, WaterWalking 20/8 dur, ChameleonNormal 20/80 dur) under their
magic skills (Destruction/Restoration/Alteration/Thaumaturgy/
Illusion). CONSUMERS: the cast gate, the HUD readied line, and the
spellbook all show/spend the LIVE skill-scaled cost - a Destruction
novice pays more for the same Shock than a master, who bottoms at
the floor.

## S11 (save/load - the player snapshot): SHIPPED

DFU's own save system is a JSON serialization of live state - the
faithful port shape. systems/save.js: snapshotPlayer captures the
entity (fields, stats, skills + uses, career data, items, known
spells BY INDEX re-resolved against SPELLS.STD on load, active
effects) plus the scene extras (position, the classic clock, the
readied spell); restorePlayer round-trips it all with DEEP copies
(pinned immune to source mutation) behind a VERSIONED envelope that
refuses mismatches loudly; localStorage backend with corrupt-JSON
null. F9 quicksave / F12 quickload (the DFU defaults) ride the input
map; QUICKLOAD PIERCES OVERLAYS (the death screen's 'F12 load' hint
must be true - pinned; F9 stays gated) and rising from a save clears
the death screen, retiring the reload-only path. Hosts pass a
position applier through routeKey (they own the player). WORLD
state (foes, loot piles, action states, doors) is FLAGGED - dungeons
re-derive from location; the world snapshot pends its slice.

## S12 (the world snapshot): SHIPPED

The S11 flag closes for dungeons: quicksave now carries a WORLD
section - foes by SPAWN ORDER (marker order is deterministic per
location rebuild: health, dead, position, yaw, carried items), loot
piles by index (remaining items), action objects by their stable
keys ({state, t, activationCount} - movers recompute their matrix
from state+t on the next tick, so those two ARE the mover). The
envelope gains world + locationKey (additive, v1 stands); restore
applies the world ONLY when the snapshot's locationKey matches the
live dungeon (dungeon:<locationId>) - a different dungeon loads the
player and says so (cross-location travel-on-load pends). Restored
dead foes spawn their corpses. Doors ride the action list (their
state/t IS the door).

## S13 (effect library III - the SpellPoints/magicka family): SHIPPED

The magicka analog of the Health effects (S7), ported verbatim from
DFU's MagicAndEffects/Effects. Three effects on the same instant/
active shapes the Health family uses:
- **HealSpellPoints** (classic type 10, subType 9 - "Restore Power";
  DFU Restoration/HealSpellPoints): self, instant, SupportMagnitude.
  MagicRound calls IncreaseMagicka(magnitude) - our restoreMagicka
  sink, clamped to maxMagicka by the caller. out.magickaHealed.
- **DamageSpellPoints** (ClassicKey MakeClassicKey(4, 2); DFU
  Destruction/DamageSpellPoints): single-target-other, instant,
  MagicSkill Destruction, MagnitudeCosts(20, 28), already in the S10
  cost table - but only since AUDIT 18. This line used to assert the
  pair was carried when it was not: EFFECT_COST_TABLE had no `4,2` key
  (nor `1,2` for ContinuousDamageSpellPoints, DurationCosts(40, 8) +
  MagnitudeCosts(40, 28)), and the 20/28 pair the claim was reading
  belongs to `4,0` DamageHealth. With no key, effectCost fell through to
  the zero-component fudge, so every spell carrying these effects was
  priced wrong. Both rows landed at AUDIT 18. MagicRound calls DamageMagickaFromSource(magnitude);
  ours scales by the saving throw exactly like DamageHealth and sinks
  through drainMagicka (floors at 0). out.magickaDrained.
- **ContinuousDamageSpellPoints** (ClassicKey MakeClassicKey(1, 2);
  DFU Destruction/ContinuousDamageSpellPoints): joins target
  .activeEffects as kind 'continuousDamageSpellPoints', and the round
  ticker drains magicka each round, re-rolling the magnitude AND the
  saving throw FRESH every round (F10, as EntityEffect.GetMagnitude ->
  ModifyEffectAmount does - it is not a once-rolled percent).

PLUMBING: magicka already existed (chargen sets maxMagicka/magicka via
spellPoints(INT, multiplier); casting spends it). This slice adds the
sinks: restoreMagicka/drainMagicka on the player (clamp to maxMagicka
/ floor 0, surface for HUD+F8) and per-foe magicka sink factories
(foeDrainMagicka/foeRestoreMagicka) bound to the foe entity, wired
into ALL nine applySpell/tickActiveEffects call sites (player-cast,
explosion, foe-cast-at-player, foe-cast-at-foe, missile hits, and both
round tickers). Foe magicka mutates correctly though foe AI does not
yet gate on it (flagged - AI magicka-gating is a later behaviour).

3 tests: instant magicka gain, saving-throw-scaled drain, continuous
drain joining actives + per-round tick. Suite 285/72.

## S14 (effect library IV - the attribute stat-mod layer + Fortify): SHIPPED

The FortifyAttribute family, and the stat-mod INFRASTRUCTURE it needs -
the foundational piece for every attribute effect (Fortify now, Drain/
Transfer next). Ported verbatim from DFU:
- **The stat-mod layer** (src/systems/statMods.js, STANDALONE - no
  imports, to avoid a formulas <- spellcast <- effects cycle): DFU
  keeps a per-attribute statMods array separate from base stats
  (ChangeStatMod: statMods[stat] += magnitude), and the value a
  consumer reads is base + the active mods. Ours mirrors that with
  liveStat(entity, statName) = base + sum of active fortify mods on
  that stat. STAT_KEYS_ORDER is DFCareer.Stats order (0 Strength .. 7
  Luck), matching chargen exactly, so the classic subType IS the stat
  index.
- **FortifyAttribute** (classic type 9, subType = stat index 0..7 -
  all eight in ONE handler; keys verified 9,0 Str through 9,7 Luck):
  an IncumbentEffect that pushes a temporary additive stat mod onto
  activeEffects for the rolled duration. A re-cast of the SAME stat
  RENEWS the duration (AddState); a different stat stacks as its own
  entry. The round ticker's universal countdown expires it and
  liveStat returns to base - no per-round action.
- **CONSUMERS FRONTED**: the combat formulas (statsToHit reads
  liveStat for luck+agility; the damage bonus reads liveStat strength)
  and advancement (HP-per-level reads liveStat endurance) now read the
  LIVE stat, never the raw base - so a fortify actually raises hit
  chance / damage / HP gain, and expiry restores it. Verified
  byte-identical for unmodded entities (all 285 prior tests held,
  including every combat + advancement pin).

2 tests: the fortify lifecycle (apply -> liveStat reflects the mod ->
incumbent renews not stacks -> expiry restores base) and a fortified
agility raising statsToHit through the real formula. Suite 287/72.

NEXT in this family: DrainAttribute (persistent, accumulating - DFU
IncreaseMagnitude on re-cast, PlayerAggro) and Transfer (drain caster,
fortify target). HealAttribute (cures attribute DAMAGE from drains)
follows once Drain lands.

## S15 (effect library V - drains, transfers, fatigue, regenerate + the save-gate fix): SHIPPED

The rest of the classic attribute/vitals effect surface on the S14
layer, plus TWO parity fixes found against the DFU source while
porting. Verbatim from DrainEffect/TransferEffect/HealEffect/
HealFatigue/DamageFatigue/ContinuousDamageFatigue/Regenerate +
EntityEffectManager.HealAttribute + DaggerfallEntity fatigue:

- **PARITY FIX - the (10,9) key**: S13 had mapped classic (10,9) to
  HealSpellPoints. In DFU that ClassicKey belongs to HEAL FATIGUE;
  Heal-SpellPoints is a potion-only effect with NO classic key (no
  classic spell restores magicka). (10,9) now heals fatigue x64 and
  the restoreMagicka door left with it (a magicka-restore sink returns
  when potions/absorption ship). The seven S13 pins that certified the
  wrong key were rewritten - a pin certifies what it pins, again.
- **PARITY FIX - the GetMagnitude save gate**: DFU applies
  ModifyEffectAmount (the saving throw) to a magnitude ONLY when
  ParentBundle.targetType != CasterOnly, and rolls magnitude BEFORE
  the save. The pre-S15 shape saved damage always (even self-cast) and
  heals never, in save-then-magnitude order. Every family now rides
  one effectMagnitude() helper with the verbatim gate + order;
  continuous entries carry saveScaled so per-round rolls stay gated.
- **The fatigue stat** (DaggerfallEntity verbatim): FatigueMultiplier
  = 64; MaxFatigue = (LiveStrength + LiveEndurance) x 64, derived LIVE
  (statMods.maxFatigue - a fortified/drained strength moves the
  ceiling); currentFatigue = entity.fatigue, initialized to max at
  chargen (applyCharacter) and enemy creation (makeEnemyEntity), the
  pre-chargen INTERIM literal on playerEntity. Joins the save envelope
  (ENTITY_FIELDS; pre-S15 saves default to rested on restore - the
  additive-member shape DFU's serializer gives missing fields, version
  holds at 1). The classic HUD fatigue bar now draws current/max (the
  FLAGGED-full site retires). INTERIM loud in dungeonContext: the
  exhaustion consumer (classic collapse at 0) pends; running/resting
  drain/recovery pend their systems.
- **Drain{Attribute}** (7, 0..7): permanent-until-healed negative stat
  mod. Incumbent by STAT (settings-blind); Become/AddState each roll a
  fresh magnitude ONTO the incumbent total; IncreaseMagnitude clamps
  so the stat never falls below 1 relative to its PERMANENT value (no
  invisible healing debt); liveStat subtracts. Ticks neither count
  down nor act (forcedRoundsRemaining = 1 forever); the only exit is
  healed-to-zero (ended -> removed next pass).
- **Heal{Attribute}** (10, 0..7): instant manager.HealAttribute walk -
  heals drain/transfer damage in list order until the amount spends,
  clamps at the base (never fortifies), Ends a drain it zeroes.
- **Transfer family** (11): Transfer{Attribute} (0..7) = the drain
  shape on the target (its OWN incumbent family - a Drain is never
  like-kind for a Transfer) + the caster's drained stat healed by the
  PRE-CLAMP roll (lastMagnitudeIncreaseAmount). TransferHealth (11,8)
  hurts target/heals caster instantly; TransferFatigue (11,9) x64 both
  directions. All three REQUIRE a caster in DFU (MagicRound returns
  early) - applySpell grew an optional caster = { entity, sinks }
  argument; without one TransferHealth/Fatigue no-op entirely and the
  attribute steal drains without the heal-back, verbatim.
- **Fatigue damage family**: DamageFatigue (4,1) instant,
  ContinuousDamageFatigue (1,1) per-round (settings-blind incumbent),
  both x64 through the drainFatigue sink (assignMultiplier: true).
- **Regenerate** (18, 255): IncreaseHealth(GetMagnitude) every round
  for the duration, magnitude rolled fresh per round; IsLikeKind =
  Regenerate AND CompareSettings, so same-settings re-casts stack
  rounds and different-settings instances coexist.
- **Scene seam**: dungeonContext consolidated its seven inline sink
  objects into playerSinks/foeSinks(f) (fatigue sinks joined; the
  explosion path's heal no-op for foes was a shortcut - foes now heal
  from area heals as DFU bundles do), and every player-cast path
  passes the caster pair so transfers work. Trap casts pass no caster
  (DFU action casters are null). PlayerAggro on drain/transfer/damage
  is scene-side and rides the existing foe damage/awareness path;
  RESIDUAL (honest): a pure drain (no damage) does not yet aggro a
  passive foe.
- **NOT shipped, still skipped loudly**: the Cure family (3, 0..2) -
  disease/poison/paralysis do not exist yet; routed in Ledger C with
  their systems.

6 net tests (effects 8 -> 14; two spellcast pins re-derived for the
verbatim magnitude-then-save order). Suite 301/74, ARENA2 corpus
green 301/301 BEFORE commit (the 08-14 lesson).

## S16 (enemy spellcasting - audit F15 closed): SHIPPED

The Ledger C row from the 08-13 parity audit. Verbatim from DFU
EnemyEntity.cs + EnemyMotor.cs (classic AI) + EntityEffectManager:

- **Data** (src/systems/enemySpells.js): the thirteen monster spell
  lists byte-for-byte (Imp/Ghost/OrcShaman/Wraith/FrostDaedra/
  FireDaedra/Daedroth/Vampire/Seducer/VampireAncient/DaedraLord/Lich/
  AncientLich, keyed by MonsterCareers id) and EnemyClassSpells
  (7 buckets, indexed min(6, level/3) C#-int-division, verbatim
  order). SetEnemySpells: MaxMagicka = 10 x level + 100 ("enemies
  don't follow same rule as player"), magicka full, the six magic
  skills forced to 80 (a new skillOverrides pin layer over the flat
  career fill - skillValue consults it first), spells resolved from
  SPELLS.STD by classic index with missing records skipped loudly.
  assignEnemySpells = the SetEnemyCareer tail: monsters take their
  list; class enemies gate on the ENEMY_BASICS CastsMagic flag.
- **AI** (src/characters/enemyCasting.js): the classic (non-Enhanced)
  decision shape. DoTouchSpell: sight + melee reach (+ rate of
  approach) + the SHARED melee timer at 0; a touch cast RESETS that
  timer; classic AI counts ByTouch AND CasterOnly as touch picks.
  DoRangedAttack spell branch: the 6..51.2m band
  (min/maxRangedDistance), sight + 22.5deg yaw, Random.value < 1/40
  per classic update, bow foes short-circuit to the bow branch.
  Selection (CanCast*Spell): magicka > 0, a uniform pick over the
  range class, then the EffectsAlreadyOnTarget veto - ported in
  effects.js over our active-entry kinds (per-stat identity for the
  stat families, instants never count as present, one absent effect
  makes the spell castable). DFU's clear-path probe rides the senses'
  LOS (inSight).
- **Casting** (dungeonContext): "enemies always cast ready spell
  instantly once queued" - the decision spends the S10 cost
  (DecreaseMagicka floors at 0; DFU casts even when cost > pool),
  plays the element cast sound (EntityEffectManager constants: fire
  352, cold 353, poison 350, shock 351, magic 349 - element-indexed
  in enemySpells.SPELL_CAST_SOUND) from the caster at the enemy 3D
  profile (max 16), then CasterOnly self-assigns through the foe's
  own sinks and everything else looses a missile on the shared
  trap-missile shape (aimed at the player mid-capsule at fire time).
  Enemy missiles carry casterLevel + the caster pair, so an enemy
  Transfer heals the FOE and magnitudes ride the foe's level; trap
  missiles stay casterless on the S4b shape.
- **RESIDUAL (honest)**: live casters today are CLASS enemies
  (monsters 0-42 still spawn as billboards - their lists ship and go
  live with them); enemy missiles resolve against the player only
  (foe-vs-foe friendly fire pends the missile target sweep); DFU's
  stand-off/strafe movement for casters pends the motor (ours keeps
  the C8 pursuit - the foe casts while closing); enemy magicka/spells
  re-derive on world-snapshot load (spent magicka not persisted -
  the save.js world FLAGGED class).

5 tests (enemyspells.test.js). Suite 306/75, ARENA2 corpus 306/306
green pre-commit.

## S18 (diseases + OnMonsterHit riders): SHIPPED

The Ledger C row from the 08-13 audit (F2's flagged interim closed).
Verbatim from DFU DiseaseEffect.cs + FormulaHelper.cs
OnMonsterHit/InflictDisease/FatigueDamage:

- **Data** (src/systems/diseases.js): the 17-row DiseaseData table
  byte-exact (8 stat multiplier columns + HEA/FAT/SPL + the daily
  damage span + days-of-symptoms span; only Caliron's Curse, Blood
  Rot and Wizard Fever are finite at 3-18 days - everything else is
  0xff permanent-until-cured), the Diseases enum 0-16, the 0xff/0xfe
  permanent/completed markers, the A/B/C transmission lists.
- **Lifecycle**: a disease is a PERMANENT activeEffects entry
  ({ kind: 'disease' }) owning its own clock - UpdateDisease runs
  every magic round but acts per elapsed CLASSIC DAY (classic
  minutes / 1440; the infection day is incubation). Each elapsed day
  rolls Range(minDamage, maxDamage+1) ONCE and applies the row as a
  multiplier matrix: stat columns accumulate a negative statMods map
  (liveStat consumes it; maxFatigue follows), HEA hurts, FAT/SPL
  drain - FAT in RAW units (DFU calls DecreaseFatigue WITHOUT
  assignMultiplier - a disease day costs points, not x64,
  bug-for-bug). daysPast > 1 catches up day by day (rest/travel).
  A finite disease's final day lands damage, then EndDisease
  completes it; the mods lift when the tick removes the entry (DFU
  shape). "You feel somewhat bad." rides an onAlert seam to the HUD
  every symptomatic round-with-days. Heal{Attribute}'s manager walk
  (effects.healAttributeDamage) now heals disease statMods too,
  clamped at 0 - WITHOUT ending the disease (base
  HealAttributeDamage; only drains override to expire), so a healed
  stat falls again next day, verbatim.
- **Infection** (InflictDisease): player-only, the classic level-1
  immunity (no rolls consumed), a FULL saving-throw save (== 0,
  Disease flag) resists outright, then a uniform list pick assigned
  BypassSavingThrows; Start refuses non-players and level < 2, and
  AddState means the same disease can never be caught twice.
- **OnMonsterHit** (the rider table, wired per LANDED hit at the
  FormulaHelper.cs:662 site - calculateAttackDamage grew an
  onMonsterHit seam fired inside the monster multi-attack loop
  BEFORE the hit damage sums; dungeonContext passes the closure with
  the classic day + playerSinks, covering both hosts since worldModes
  delegates combat here): rat 5% listB, giant bat 2% listB, zombie 2%
  listC, mummy 5% listC, vampire/ancient Range(0,100f) <= 0.6 ->
  vampirism ROUTED else <= 2.0 -> plague, nymph/lamia FatigueDamage
  (2 pts fatigue x64 per health damage - the DF Chronicles rule DFU
  chose), werewolf/wereboar specialInfectionChance -> lycanthropy
  ROUTED (rolls consumed verbatim so sequences match).
- **Persistence**: snapshot/restore deep-copies the statMods map
  (save.js copyEffectEntry) - the S15 conditional-spread shape
  generalized.
- **NOT shipped, still FLAGGED loudly**: spider/giant scorpion cast
  classic spell 66 (Paralyze) on hit - pends the Paralyze effect
  (S19 with poisons + the Cure family); the health-status box that
  surfaces contractedMessageRecord (TEXT.RSC 100 + type) pends its
  UI slice; vampirism/lycanthropy remain routed lines.

12 tests (diseases.test.js). Suite 339/79, ARENA2 corpus 339/339
green pre-commit.

## S19a (Paralyze + the spider rider): SHIPPED

Verbatim from DFU Paralyze.cs + EntityEffectManager.AssignBundle +
the IsParalyzed consumer gates. Also bagged en route: the classic
subType BYTE-CAST parity fix (its own commit - real records read
0xFF as -1 and the 255-keyed doors never fired; see effects.js
classicSub).

- **Effect** (effects.js): isParalyze (0, 255) - duration + CHANCE,
  no magnitude; presence of a { kind: 'paralyze' } entry IS the
  paralysis (ConstantEffect's IsParalyzed, queried via
  hasActiveEffect). ChanceValue = base + plus x floor(level/per), NO
  min-1 clamp (unlike duration). AssignBundle's exact gate order
  ported: the chance rolls ALWAYS (SetChanceSuccess in Start); an
  incumbent re-cast stacks its rounds INSIDE Start (AddState) BEFORE
  the chance and saving-throw gates - so a re-cast always stacks,
  chance/save notwithstanding (verbatim quirk, pinned); a NEW
  instance needs the chance, then non-CasterOnly no-magnitude
  effects save against the ENTIRE effect on a FULL save (flags =
  Paralysis | element). "You are paralyzed." (youAreParalyzed) fires
  once per new instance on player hosts via applySpellToPlayer.
  Spellcost gains the (0,255) row (duration 28/100 + chance 28/100,
  Alteration).
- **The rider closed** (diseases.js): spider/giant scorpion
  free-cast classic spell 66 ("Spider Touch", ByTouch) at a
  not-yet-paralyzed target - FindIncumbentEffect<Paralyze> == null
  gate inline, SetReadySpell noSpellPointCost=true through the
  scene's castParalyze closure (castEnemySpell grew the free-cast
  arg; the touch cast rides the S16 point-blank missile shape).
- **Consumers** (the verbatim gate set): player - FrictionMotor
  cancels ALL movement input (falling/platforms continue),
  AcrobatMotor cancels jump, LevitateMotor cancels levitate movement
  (input zeroed in BOTH hosts - dungeon.js and worldModes.js, the
  standing host rule), WeaponManager hides weapons + holds the
  machine; casting is NOT gated (DFU has no IsParalyzed check in the
  casting path); look stays live. Foes - EnemyMotor (CanAct false +
  FreezeAnims: senses/pursuit stop, the rig holds its frame) and
  EnemyAttack (no decisions, no damage frame); EnemySounds barks
  stay ungated, verbatim. FreeAction's IsImmuneToParalysis pends its
  effect; god mode pends.

3 net tests (effects 15, diseases 13, spellcost pins). Suite 341/79,
ARENA2 corpus 341/341 green pre-commit.

## S19b (poisons): SHIPPED

Verbatim from PoisonEffect.cs + FormulaHelper.InflictPoison +
ItemHelper's poisoned-weapon roll:

- **Data** (src/systems/poisons.js): the Poisons enum (128-139; 0-7
  weapon poisons, 8-11 drugs - Indulcet/Sursum/Quaesto Vil/
  Aegrotat), the four Start timing tables byte-exact
  (MinMinutesToPoison/Max/MinRounds/MaxRounds - Arsenic burns 20-1000
  minutes, Moonseed strikes instantly).
- **Lifecycle**: a poison is a PERMANENT activeEffects entry over
  CLASSIC MINUTES (the disease's clock is days): Start rolls both
  Range(min, max+1) spans (an incumbent same-poison AddState no-op
  still consumes the discarded instance's rolls, sequences match);
  UpdatePoison catches up one IncrementPoisonEffects per elapsed
  minute; Waiting counts down and ticks its FIRST active minute at
  0; each active minute runs the per-variant switch IN CALL ORDER -
  health/magicka raw, fatigue x64 (DecreaseFatigue/IncreaseFatigue
  assignMultiplier true), signed statMods (drugs push POSITIVE mods:
  Indulcet +luck, Sursum +strength) - alerts the player host, and
  counts down to Complete. Complete keeps the entry and its negative
  mods ALIVE: each round strips a drug's positive mods ONCE (the
  crash), then expires only when every attribute mod healed to >= 0
  ("outcome identical to just curing directly"). liveStat/
  healAttributeDamage grew the 'poison' signed-map branch (heal
  never cures directly).
- **Infection** (InflictPoison): career Poison tolerance Immune
  vetoes (DFU's check, ported over classic's ignore-AI-immunity);
  racial immunity pends race selection; bypassResistance OR a
  non-zero save (Poison flag) infects targets above level 1 (rats
  stay immune). ANY entity can be poisoned - foes tick their
  poisons in the classic-minute loop alongside the player.
- **Weapon poisons**: the ItemHelper spawn roll (player level > 1,
  class enemies + Orc/Centaur/OrcSergeant, 5% - Assassin 60%,
  Range(128, 136)) rides enemy equipment assignment;
  CalculateAttackDamage's weapon branch inflicts ONCE on a damaging
  hit and clears the blade (the onInflictPoison seam, after
  backstab, verbatim placement) - wired at both enemy-vs-player
  sites (melee + arrows). RESIDUAL (honest): the player-vs-foe seam
  pends a player-obtainable poisoned weapon (loot/apothecary never
  set poisonType yet); the RDB Poison ACTION (0x1a) is a VERBATIM
  NO-OP - DFU's own delegate body is empty, already ported as such.
- **Sinks**: restoreMagicka joined playerSinks/foeSinks (Aegrotat's
  IncreaseMagicka, max-clamped).

7 tests (poisons.test.js). Suite 348/80, ARENA2 corpus 348/348
green pre-commit.

## S19c (the Cure family): SHIPPED

Verbatim from CureDisease/CurePoison/CureParalyzation.cs +
EntityEffectManager. Cure-Disease (3,0), Cure-Poison (3,1),
Cure-Paralyzation (3,2): chance-only INSTANT effects through the
same AssignBundle gate order as Paralyze - the chance rolls always;
a fail skips with the failure message ("Spell effect failed." for
CasterOnly on the player, "Save versus spell made." otherwise -
applySpellToPlayer surfaces both, plus the full-save refusal);
non-CasterOnly no-magnitude effects save against the ENTIRE effect
on a FULL save; then the initial MagicRound cures. CureAllDiseases/
CureAllPoisons are RemoveBundle IMMEDIATELY - the entries and their
statMods lift at once (a cure restores drained-by-disease stats NOW,
while true Drain{Attribute} entries survive untouched);
CureParalyzation is EndIncumbentEffect<Paralyze> - the paralysis
lifts instantly. Spellcost rows: (3,0)/(3,1) chance 8/100, (3,2)
chance 20/140, Restoration. The old spellcast fixture that used
(3,0) as an unported key moved to Create Item (2,255).

This closes the S19 group (Paralyze + poisons + cures) - the S15
"cure family pends" flag is gone from the effects.js header.

1 net test (effects 16) + cost pins. Suite 349/80, ARENA2 corpus
349/349 green pre-commit.

## Queue
- Magic remainder: enchantment economy/value; FreeAction /
  Create Item / the rest of the classic library (grows one family
  at a time).
- ~~Fatigue consumers~~ SHIPPED (P11 drains, S20 collapse + the
  per-hour rates); the rest UI itself pends (shares the S20 rates).
- Later: quests, guilds, shops, dialog, calendar deep-wiring,
  save format.

## S20 (exhaustion collapse + rest recovery rates): SHIPPED

The fatigue consumers - the S15/S18/S19 drains now have
consequences. Verbatim from FormulaHelper's rest rates +
DaggerfallEntity.SetFatigue + PlayerEntity's OnExhausted handler:

- **The rates** (src/systems/rest.js, per hour of rest): health =
  max(floor(HealingRateModifier(liveEND) + (liveMedical + add) x
  maxHealth / 1000), 1) with add 60 -> 100 for RapidHealing Always /
  InLight (day AND outside) / InDarkness (otherwise);
  HealingRateModifier = floor(END/10) - 5 (DFU deliberately skips
  classic's negative-modifier bug; so do we); fatigue =
  max(floor(maxFatigue/8), 1) in stored x64 units; spell points =
  max(floor(maxMagicka/8), 1), zeroed by the NoRegenSpellPoints
  career ability (the SpecialAbilityFlags low-byte decode joins as
  hasSpecialAbility - the adrenaline-rush F-flag's family). The rest
  UI pends and shares these when it arrives.
- **The exhaustion event**: SetFatigue raising OnExhausted at 0 with
  health left - the drainFatigue sink fires the collapse once (the
  popup guard mirrors displayingExhaustedPopup: rapid drains, the
  Somnalius case, never stack boxes; it clears with the overlay).
  Outcome: NO enemies nearby (a foe actively seeing the player or
  inside the classic spawn band - the P13 senses fields feed
  AreEnemiesNearby's exact test) and dry feet -> the clock advances
  one hour (60 classic minutes; the round loop catches up the magic
  rounds, as DFU's broker does under RaiseTime), each pool recovers
  one hour's rate, Medical tallies, TEXT.RSC 1071 shows
  click-to-close; enemies nearby (1072) or swimming (the watery-
  grave line) -> SetHealth(0), the fatal collapse.
- **Parity fix en route**: DFU applies the per-minute fatigue loss
  ONCE per minute-CHANGE (a single DecreaseFatigue behind
  lastGameMinutes != gameMinutes - no loop over elapsed minutes);
  the P11 shape drained every caught-up round, overcharging
  multi-minute jumps. The loss now sits outside the round loop -
  ordinary play is identical, the collapse hour costs one minute's
  11.

2 tests (rest.test.js). Suite 363/82, ARENA2 corpus pre-commit.

## S21 (2026-08-17): the concealment family SHIPPED

Invisibility (13,0 normal / 13,1 true), Shadow (24,0 / 24,1), and
Chameleon TRUE (23,1) join the S8 normal - the P13 illusion gate's
inert invisible/shade branches go LIVE. Verbatim from
ConcealmentEffect + DaggerfallEntity + EnemySenses:

- The classic keys land as buff kinds through the generic branch;
  the Illusion duration costs verbatim (Invis 40/120 normal, 60/140
  true; Shadow 20/80 + 40/120; Chameleon true 40/120; skill 24).
- IsInvisible/IsBlending/IsAShade FOLD normal + true powers for
  detection (the split is preserved in the kinds - future
  IsMagicallyConcealed*Power consumers read it).
- The senses feed: playerInvisible/playerShade/playerBlending all
  live from the helpers - invisible always blocks detection (the 13
  sees-through monsters exempt), blending 8% see-through per classic
  update, shade 4%, unconcealed rolls nothing (P13's lazy-rolls law
  unchanged).
- Start messages once on NEW incumbency (ConcealmentEffect
  awakeAlert): "You are invisible." / "You are blending." / "You are
  a shade." through the new playerSinks.say seam; a stacking re-cast
  (AddState, the F12 semantics already verbatim) stays silent.
- With P15 sneak, full illusion-stealth play is live: sneak-move
  past foes under any concealment, the gate + StealthCheck deciding.

RESIDUALS (honest): foe-side concealment is CASTABLE (the generic
branch lands kinds on any entity) but has no consumer - the player-
facing render never conceals foes (EntityConcealmentBehaviour's
visuals pend the render arc); the DFU shader/material presentation
of the PLAYER's own concealment (first person - N/A) and town NPC
reactions (MobilePersonMotor won't stop to chat with the invisible)
pend their arcs; potion routes pend potions.

## S22 (2026-08-17): FreeAction - the paralysis counter SHIPPED

The library grows its next family, picked for live relevance:
spiders/scorpions paralyze the player TODAY (S19a + the Spider Touch
rider) and the only counter was a Cure instant. Verbatim
FreeAction.cs + DaggerfallEntity + EntityEffectManager:

- (26,255), Restoration, DurationCosts (20,8), an IncumbentEffect
  whose re-cast STACKS rounds (AddState) - it rides the generic
  BUFF_KINDS branch (the S21 shape; no start message, DFU has none).
- THE READ-TIME FOLD (DaggerfallEntity.IsParalyzed, verbatim):
  IsParalyzed = !IsImmuneToParalysis && isParalyzed. Casting
  FreeAction over a live paralysis frees the entity NOW without
  curing the bundle - it keeps ticking underneath and RESUMES if
  FreeAction expires while rounds remain (pinned end to end).
  entityIsParalyzed() is the new consumer surface; the three
  dungeonContext paralysis reads (player gate, foe freeze, the
  motor-gate callback) swapped onto it.
- THE ASSIGNBUNDLE DROP (EntityEffectManager.cs:496): an incoming
  Paralyze effect is dropped BEFORE Start when the target is
  hard-immune - silently: no AddState stack, no chance roll, no
  failure message (a throwing-roll test proves the sequence).
- FLAGGED: career hard-immunity (Career.Paralysis == Immune) and the
  racial template flags pend the career tolerance decode -
  FreeAction is the only live immunity source today. Potion
  properties pend the potion system.

Suite 415/91 (freeaction.test.js x3: key/cost/stacking incl. the
sbyte spelling, the silent drop, the read-time fold + resume).

## E1 (2026-08-17): THE SHOP FOUNDATION - templates, stock, cost SHIPPED

The economy arc opens on the T3c/G-series groundwork (every named
building carries its type/quality/name through the pool merge). This
slice is the NODE-PURE foundation; the interior shelf mount + the
buy/sell windows are E2.

- ITEM TEMPLATES (systems/itemTemplates.js over the GENERATED
  itemTemplatesData.js): DFU's ItemTemplates.txt baked whole - 288
  rows of [index, name, basePrice, rarity, weight, hitPoints] - plus
  the per-ItemGroup template-index arrays extracted from the C# item
  enums (the enum VALUES are template indices; ItemHelper.
  GetEnumArray/GetItemTemplate as templateFor/groupTemplates). The
  ItemBuilder VALUE laws ride itemBaseValue: weapons and plate =
  basePrice * 3 * [1,2,4,...,512][material], chain doubles, leather
  and everything else the flat basePrice.
- THE STOCK LAW (systems/shopStock.js, StockShopShelf verbatim):
  the eight DaggerfallLootDataTables (group, chance) pair tables;
  per template, stock requires rarity <= shop quality and a Dice100
  under chance*5*(21-rarity)/100; books ride the quality ladder
  ((q+3)/5 with the >=4 step-down, +1, NO dice gate); general
  stores always shelve a Horse + Small Cart; clothing swaps to the
  player's gender; Furniture/UselessItems1 skip. RMBLayout.IsShop
  (the nine storefronts) and the shelf MODEL set (41000+i, the
  27-index list from DaggerfallInterior) ship here for E2's mount.
- THE COST LAW (CalculateCost verbatim): clamp >=1, the regional
  adjustment (value*adj/1000, floor 1), then 2*(cost*(q-10)/100 +
  cost) in C# integer math. Regional prices initialize
  Random.Range(0,501)+750 per region (lazily, engine-PRNG in DFU
  too) - the daily UpdateRegionalPrices drift is FLAGGED to the
  calendar/economy sim.

INTERIM loud: MagicItems stock SKIPPED (the loot MI interim); the
Alchemist's 25% potion recipe pends recipes; books carry the
template price (classic prices each BOOK FILE); restocking pends
the shared calendar.

Suite 448/98 (shopstock.test.js x3: the table + enum-mapping +
material-value pins, the stock law incl. the rarity gate / gender
swap / horse+cart / both book-ladder branches, CalculateCost incl.
the toward-zero truncation and the sticky 750..1250 region band).

## E2 (2026-08-17): THE SHELF MOUNT - browse and buy in shops SHIPPED

The E1 laws go live in the interior mode (worldModes - both exterior
hosts' door path):

- THE IDENTITY SEAM: hosts pass buildingDataForDoor - one entered
  door resolves through the T3c pool merge (talkTopics.
  buildingDataForDoor: block-instance + subrecord + MakeBuildingKey)
  to type/quality/seed/faction + the directory NAME by buildingKey;
  the world host resolves door positions in the pixel's LOCATION
  frame. tryEnter stamps interiorBuilding; exit clears it.
- SHELVES: interiorContext collects the 27-model shelf set in DFU's
  AddFurnitureAction chain order - shelf-set FIRST, so a shelf-set
  model in a plain house is NOTHING (the else-chain never reaches
  the house check). PARITY FIX ON THE WAY: 41035/41037 sit in BOTH
  sets and had been S2b house containers everywhere.
- THE BROWSE/BUY WINDOW: E on a shelf in an IsShop building stocks
  it lazily (StockShopShelf per shelf) and opens a keyed ChoiceWindow
  - the shop's NAME, the player's gold, up to 8 items per page with
  LIVE prices (CalculateTradePrice over CalculateCost over the
  region band, Mercantile + Personality in the fixed-point math),
  N pagination, digit-buys (gold deducts, the item lands in the
  player entity, the list re-shows), a can't-afford box. The overlay
  holds the motor and owns the keys (the townTalk chain law); FONT
  0003 loads lazily on shop entry; font-less never traps.
- THE FRAME COUNTER FIX: modal frames now advance the shot-mode
  __frame counter - the hosts' early return had FROZEN __frame
  inside interiors/dungeons and every probe frame-sync starved.

FLAGGED loud: selling + the offer/counteroffer haggle UI pend
(CalculateTradePrice's selling branch is ported + pinned); shop
OPEN HOURS pend (shelves answer at any hour); Library/Guild/Temple
bookshelves + owned-house storage pend; restock pends the calendar.

Probed live (tools/shopProbe.mjs): door 37 = "The Adventurer's Book
Dealer" (Bookseller, quality 6) -> enter -> 4 shelves -> browse
"1 - Book (2950 gold)" x3 -> Digit1 buys: gold 20000 -> 17050, the
item in the entity, the window re-lists 2.

Suite 449/98 (the CalculateTradePrice fixed-point pin).

## E3 (2026-08-17): SELLING - the trade circuit closes SHIPPED

The shelf window gains the SELL mode (DaggerfallTradeWindow's
selling path):

- storeBuysItemType verbatim as SHOP_BUYS_GROUPS - the item groups
  each storefront takes (Bookseller Books only, WeaponSmith
  Armor+Weapons, the PawnShop's 10-group sweep, the Alchemist's 9
  ingredient groups...). S on the buy window lists the player's
  matching items; a shop whose table is empty never offers the key.
- The offer: CalculateCost(value)*stackCount through the SELLING
  branch of CalculateTradePrice (DFU's declared-but-unused condition
  parameter documented). Digit-sells pay addGold, the item leaves
  the entity and lands ON THE OPEN SHELF (DFU's remoteItems - you
  can buy it back), the list re-shows; B flips back to buy.
- Mercantile tallies ONCE PER COMPLETED TRADE - buy and sell alike
  (DFU's OnTrade tally; E2's buys had missed it).

FLAGGED loud: the offer/counteroffer haggle UI pends (fixed prices,
both directions now); letters of credit (the >maxGold overflow)
pend banking; Repair/Identify/SellMagic window modes pend their
systems.

Probed live (tools/shopProbe.mjs, extended): the bookseller round
trip - buy a Book at 3062, S, sell it back at 2904 (the merchant's
margin), gold 20000 -> 16938 -> 19842, the item off then back on
the shelf.

Suite 450/98 (the storeBuysItemType pin).

## S23 - the career equip restrictions

2026-08-19. AUDIT 17n catalogued which U20b advantage picks nothing
reads, and listed the four Forbidden categories plus Expertise In among
the inert twelve. Framing it as a custom-class gap understated it
badly: those picks write `weaponArmorShieldsBitfield` and
`forbiddenMaterialsFlags`, and SEVENTEEN OF THE EIGHTEEN CLASSIC
CLASSES carry values in those fields already. The port had never
enforced one of them. A Mage could wear plate, carry a tower shield and
swing an axe; a Monk could wear full plate; only the Warrior was
correct, and only because the Warrior forbids nothing.

DaggerfallInventoryWindow.EquipItem (:1343-1381) is the whole law, and
WHERE it sits is half of it: DFU hangs the check on the inventory
WINDOW, not on ItemEquipTable.EquipItem, so AssignStartingGear equips
straight past it. A restricted class really can START in gear it could
never put back on after taking it off. Ported at the same seam,
deliberately, and pinned there.

The port's ARMOR_MATERIAL values ARE DFU's raw nativeMaterialValue
(0x0000 leather / 0x0100 chain / 0x0200+ plate), so DFU's `>> 8` and
`& 0xFF` expressions carry over unchanged rather than needing a
translation layer. Shields index from the Buckler template; weapons
carry the FLAT 0..9 material index instead of the packed armor value.

TWO verbatim quirks. The armor MATERIAL test is gated on
`(nativeMaterialValue >> 8) == 2` - plate only - which BITES on Chain2:
its 0x0103 shares a low byte with Elven's 0x0203, so without the gate a
career forbidding elven would refuse a chain piece that has nothing to
do with elven metal. And GetWeaponSkillUsed returns Skills.None = -1
for a template it does not name (:938); -1 masks against every bit, so
any weapon-group item outside the sixteen named weapons reads as
forbidden to a career with any forbidden proficiency at all.

GetWeaponSkillUsed itself is mapped across the port's existing
WEAPON_SKILL partition rather than minting a second weapon table
(ONE DFU MEMBER, ONE EXPORT) - DFU switches on template index, the port
already single-sources the same partition by name.

FLAGGED loud, and honestly: DFU pops TEXT.RSC 1068 on a
ClickAnywhereToClose parchment box. The inventory surface has no
TEXT.RSC source and no message frame of its own yet, so the refusal
shows on the same interim popup the info panel uses, carrying the
record number. THE REFUSAL ITSELF is verbatim - the item does not
equip, which is the half that changes play.

Pins (test/equiprestrictions.test.js, 7), mutation-proven - dropping
the plate-only gate, letting shields fall into the armor branch,
turning the -1 default into 0, or reading forbiddenArmors from the
wrong bits each fail their own. One mutation is EQUIVALENT and recorded
as such: masking a weapon's material with 0xff changes nothing, because
weapon materials are 0..9 already.

Probed live (tools/equipRestrictionProbe.mjs): the U8g equip probe's
own loadout, offered to a MAGE instead of the Warrior it was written
for. The Iron Cuirass is refused and says why; a Dagger goes on. The
probe's first draft used a Longsword as the "allowed" weapon and was
rightly refused - the Mage forbids long blades too - and that correction
is now a pin.

What this turns on: five of AUDIT 17n's twelve inert U20b picks
(Expertise In still writes only the expert half, which no formula reads
yet), and the classic restrictions for all seventeen affected classes.

## S24 - spell absorption

2026-08-19. `spellAbsorptionFlags` had zero consumers, which AUDIT 17n
catalogued as one of U20b's inert picks. It is worse than that in one
specific place: the SORCERER ships absorb = Always ALONGSIDE
NoRegenSpellPoints, and NoRegenSpellPoints was already live. The class
was paying its entire classic cost - no spell point regeneration at all
- and receiving none of the benefit it is traded for. Strictly worse
than every other class, since the trade only makes sense as a pair.

EntityEffectManager.TryAbsorption (:1160-1200) in DFU's own order:

DESTRUCTION ONLY (:1168-1172), and DFU's comment says why - absorption
is tested against EVERY incoming effect, so without the school gate a
benign self-heal would be swallowed. The port already single-sources
the school partition in the cost table, so `effectSchool` reads it
rather than minting a second map.

The cost is computed AS IF THE TARGET CAST IT (:1177), which matters
only for another entity's spell and agrees trivially for a self-cast.
GetEffectCastingCost carries the target multiplier and DFU's floor of
5, which DFU spells out as the guard that stops an absorb from
DRAINING the pool it is meant to fill.

The target must have ROOM: `cost > (max - current)` refuses
(:1180-1184). This is the throttle on the whole trait - an absorber at
full magicka absorbs nothing and takes the spell like anyone else, and
the probe shows exactly that.

Then the sources in order: the Spell Absorption EFFECT, the CAREER
flag, and a persistent absorb state. The port has neither the effect
nor the state yet, so both are injectable and FLAGGED; the career
branch is the live one.

The career branches read `inside` and `day` - darkness is
inside-OR-night, light is outside-AND-day - which is the same law
rest.js's RapidHealing already uses, and DFU takes both from the
PLAYER for every entity ("everything is where the player is",
:1305). The dungeon host passes `inside: true` because a dungeon is;
the exterior spell paths are FLAGGED with their own hosts.

An absorbed effect is SKIPPED, not reduced - DFU `continue`s past it,
so no damage is dealt at all. The tally is credited after the loop with
one cap: a SELF-cast cannot refund more than it cost, because
absorption is counted per effect and can otherwise exceed the spell's
own price. That cap deliberately does NOT apply to another entity's
spell.

FLAGGED: DFU pulls "Spell was absorbed." from the localised string
table; this surface has no text source, so the literal stands.

Pins (test/absorption.test.js, 9), each mutation-proven - removing the
Destruction gate, the headroom check, the cost floor, the skip, or the
self-cast cap, or inverting the darkness branch, each fails its own.
The headroom law is pinned at the boundary in both directions: exactly
enough room absorbs, one point short refuses.

Probed live (tools/absorptionProbe.mjs) as a Sorcerer, through the
host's own applySpellToPlayer - the same function the foe-cast and
missile-impact sites call. 133 spell points absorbed and zero damage
taken; then with a full pool the same bolt lands for 20. The probe's
first draft asserted on HEALTH in the full-pool case and was wrong to -
whether an unabsorbed bolt deals damage rides the saving throw, which
is a different system's dice.

## S25 - the faction reputation store

2026-08-19. The board said Guilds next. Reading DFU's Guild.cs first
line of rank law said otherwise:

    public virtual int GetReputation(PlayerEntity playerEntity)
    { return playerEntity.FactionData.GetReputation(GetFactionId()); }

Guild rank IS faction reputation, and the port had no per-faction
reputation at all. It had two OTHER reputation channels - the regional
LegalRep the court runs on, and the social-group array the talk
reaction reads - and neither is this one. So Guilds could not be built
on what was there; this is the floor underneath it.

Two sites were already parked waiting, which is how you know it was
the real prerequisite rather than a detour. `biography.js` parses `rf`
answers correctly - 136 of them across the files, the second most
common command in the biography data - and had nowhere to put one, so
it pushed {id, amount} onto the entity and moved on. `court.js` ran
the legal half of a crime and left DFU's halved People-faction delta
as a comment. Both drain here.

**The store** (systems/factionRep.js, PersistentFactionData.cs's
reputation/flag/power half): the player's live clone of FACTION.TXT.
get/set/change, the flags, power, and ZeroAllReputations.

**The propagation law** is the whole slice. A propagating change is
not a write, it is a walk: allies take +amount/2 and enemies
-amount/2 first and flat; then a knightly order pays itself and hands
a propagating change to Generic Knightly Order (DFU adds that second
call deliberately - its comment calls classic's omission of the
generic children an assumed bug); everything else walks UP to its root
- treating the Dark Brotherhood as a root although it has a parent -
and propagates back DOWN, full amount for the origin, any root parent
and the six guild QUESTORS, half for everyone else. If the ROOT is
type God, Generic Temple takes a propagating change too.

TERMINATION IS DATA, NOT STRUCTURE, and that is pinned. Step 4
re-enters with propagate=true, so the walk only ends because Generic
Temple's own type is 9 rather than God; the knightly branch only ends
because 844's ggroup is 17 rather than 9. DFU has no cycle guard and
neither do we. The corpus test asserts both facts about the data and
then runs a propagating change through all 366 factions, BOUNDED, so a
mutation that breaks termination fails an assert instead of hanging
the suite.

`amount / 2` is C# int division - it truncates TOWARD ZERO, so -5/2 is
-2 and not -3. Every halving here is Math.trunc. An odd crime loss
therefore rounds toward the player by a point, and that is pinned on
Trespassing, whose loss is 5.

**What a crime now costs.** Murder in Daggerfall: the legal channel
takes the whole 20 as before, and the People of Daggerfall take 10 -
but People has no allies and no children, so the interesting half is
the walk UP. Daggerfall itself takes 10 as a root parent, and King
Gothryd, Queen Aubk-i and the Royal Guard take 5 each. Fourteen
factions move where one moved before.

**The seam.** FACTION.TXT loads in createChargenFlow - THE ONE
CONSTRUCTION SEAM - and rides the FLOW into flow.result(), so
finishChargen builds the store without any host unpacking a new return
value. That shape was chosen because dungeonContext takes `.flow` off
that call and drops everything else, which is exactly the omission the
17i rule exists to defeat. Attaching is the LAST thing finishChargen
does: applyBiographyEffects is what parks the deltas, so attaching
earlier would build the store and drain nothing. A missing FACTION.TXT
degrades - the deltas stay parked, loudly - rather than failing a
character build.

DEPARTURE (Ledger A): the store CLONES each faction record. DFU
assigns the reader's dictionary straight across because C#
FactionData is a struct; JS objects are references, so assigning
across would let one character's crimes follow the next character into
a fresh game.

Two findings from the pass, both from the probe rather than the tests.
The live probe caught `zeroAllReputations` walking
`player.regionData[i].legalRep` - DFU's field name, which nothing in
this port mints; court.js keeps legal rep as `player.legalRep` keyed
by region index. The unit test had passed because it hand-built DFU's
shape to match the wrong implementation - TEST THE SHAPE THE PRODUCER
MINTS, failed and then fixed by letting changeLegalRep mint it. And a
mutation run caught the clamp pin asserting against MIN_POWER rather
than DFU's literal 1, so mutating the constant moved the expectation
with it - vacuous, exactly what A PIN MUST FAIL is for.

18 mutations run, 18 killed.

## G1 - the guild foundation: membership and RANK

2026-08-19, on S25's store the same day. Guild.cs's reputation half is
one line - `GetReputation(player) => player.FactionData.GetReputation
(GetFactionId())` - so with the faction store in place the rank law
ports straight across.

**Rank is RECOMPUTED, not stored.** CalculateNewRank walks ten rank
rows and stops at the first the player fails, returning the row BEFORE
it (`return --r`), so failing row 0 lands at -1 and is expulsion. Each
row wants reputation >= its bar, at least ONE guild skill at the high
bar, and TWO skills counting the lower one - and the `else if` is
load-bearing: a skill that cleared HIGH is not also counted LOW, so
"two skills, one of them high" cannot be satisfied by one skill
counted twice. Skills are read PERMANENT, so a Fortify Skill effect
cannot buy a promotion.

**The 28-day gate** runs on DAYS SINCE ZERO - year * 360 + dayOfYear -
so it survives a year boundary, and every rank change resets it.

**EXPULSION REMOVES THE MEMBERSHIP.** The first cut mutated a
passed-in record and left removal to the caller; a mutation run caught
it, because that lets the port hold a state DFU never has - a keyed
membership sitting at rank -1, which hasJoined (which tests the KEY)
would answer true for. updateRank now takes the memberships map and
calls leaveGuild itself, exactly where DFU calls RemoveMembership.
With that fixed the map never holds a negative rank, which makes
hasJoined-by-key and by-rank equivalent - reported as an equivalent
mutation rather than dressed up as a kill.

**The guild group is DATA.** GetGuildGroup reads the faction record's
ggroup rather than hardcoding one per subclass, and it carries DFU's
one hardcoded exception: faction 510, THE MERCHANTS, really does ship
ggroup 11 (FightersGuild) in FACTION.TXT - verified on the corpus - so
without the exception every shop would answer as a Fighters Guild
hall. The Thieves Guild is likewise not a group of its own: it is
GeneralPopulace (4), the overload DFU's enum comments.

FLAGGED loud - THE RANK TITLES. DFU reads them from its own
localization tables through the %lev macro. Those tables are DFU's
restatement of the classic strings; they are not in ARENA2 and not in
the sparse clone, so they are NOT INVENTED HERE - the NATIVE-WINDOW
RULE applies to text as much as to geometry. getTitle returns the
player's name, which is DFU's own non-member return, and the titles
land with the window that needs them. The RANK is correct and
available; only its NAME is missing.

Four guilds carry data: Fighters (41), Mages (40), Thieves (42), Dark
Brotherhood (108), each with its guild-skill list and its own TEXT.RSC
message ids, all four ids verified against the real FACTION.TXT.
Temple and KnightlyOrder are absent on purpose - both are
variant-keyed (eight divines, ten orders) and land with the join flow
that has to pick a variant. Services (training, healing, spell and
item making) are their own slice.

19 mutations run, 17 killed, 2 measured EQUIVALENT and reported as
such: DFU's `rep < 0` early return in CalculateNewRank (redundant
because rankReqReputation[0] is 0 - the loop breaks at row 0 anyway;
confirmed identical over 1809 cases, kept because it is DFU's line),
and hasJoined's key-vs-rank test after the expulsion fix.

## G2 - the variant-keyed guilds and the join decision

2026-08-19. G1 carried the four guilds that are ONE guild each. Temple
and KnightlyOrder are not: joining "the Temple" means joining
Akatosh's or Arkay's. Both produce a guild record shaped exactly like
G1's, so the rank law consumes them without knowing they are variants
- pinned by running a Stendarr temple and a Candle order through
calculateNewRank unchanged.

**The enum value IS the faction id** in both (Temple.cs says so in a
comment), so the tables are 18 faction ids and every one is checked
against the real FACTION.TXT: all eight divines are type God with
EXACTLY ONE CHILD - their templar order - and all ten orders are
ggroup 9. That God/child shape is also why S25's propagation needed a
God branch at all.

**GetDivine takes the hall OR the order.** It accepts a divine's own
faction id or a TEMPLAR ORDER's, resolving the latter through its
parent, so walking into the Order of Arkay answers Arkay. GetOrder
does NOT walk - pinned by asking it for an order's parent and
requiring null.

DEPARTURE: DFU throws ArgumentOutOfRangeException from both when
nothing matches, and GuildManager.GetGuild catches that exact type
with the comment "Catch erroneous faction data entries. (e.g. #91)" -
so the throw is EXPECTED traffic, not an error. The port returns null:
same control flow, without an exception on a routine path a scene host
would have to guard.

**Temple data is per divine, knightly data is not.** Each divine has
its own guild skills (7 to 12 of them), its own welcome and promotion
records, and its own service ranks; the ten orders share one skill
list and one message set and differ only by faction. The templeData
RankData row is ported WHOLE - the ten SERVICE columns have no reader
until the services slice, but splitting one DFU table across two
slices is how a table drifts. Verbatim oddities pinned rather than
tidied: Arkay's blessing id is 0, Julianos alone welcomes on 6610 and
alone sells magic items, Kynareth alone sells spells, and Zenithar's
faction is named "Zen" in the shipped file.

**THE THIEVES GUILD AND THE DARK BROTHERHOOD CANNOT BE ASKED.** Both
throw NotImplementedException from TokensIneligible and TokensEligible
- they are joined by INVITATION, through a quest, and have no walk-in
application at all. That is a law, so it is named (INVITATION_ONLY)
rather than left for a caller to discover as a crash: joinDecision
returns null for them, and they carry no eligibility record to show.

**The refusal reason is not cosmetic.** A negative reputation is
refused FOR reputation and anything else for skill, on two different
TEXT.RSC records - a player refused for the wrong reason has been told
to fix the wrong thing. Pinned that the two records differ, and that
the decision agrees with isEligibleToJoin across the whole grid.

10 mutations run, 10 killed.
