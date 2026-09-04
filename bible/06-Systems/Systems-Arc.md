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
activeEffects, a re-cast STACKS rounds onto the incumbent (the F12
correction superseded this record's original 'renews, not stacked'
claim - AUDIT 23 annotates it here), expiry clears the hasActiveEffect
query. CONSUMERS THREADED
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
  profile (max 16). AUDIT 58: those five numbers are DAGGER.SND record
  IDs, not record indices - EntityEffectManager.cs:44-48 names every
  one of them `...SoundID` and PlayCastSound spends them through
  `PlayOneShot((uint)castSoundID)` (:1958), the UINT overload
  (DaggerfallAudioSource.cs:232-238), which resolves the id through
  SoundReader.GetSoundIndex first. Every consumer goes through the
  engine's `playOneShotId` / `play3dId`; spent as indices they rang
  StormLightningThunder and SwingMediumPitch2 instead of the cast.
  Then CasterOnly self-assigns through the foe's
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

INTERIM loud: books carry the template price (classic prices each
BOOK FILE); restocking pends the shared calendar. (AUDIT 39 F106
struck two clauses from this list because they had SHIPPED and the
list still swore they had not - the MagicItems stock, F130, and the
Alchemist's 25% recipe roll, F129. A pend list that names closed work
is worse than no list: Home.md pins these lines mechanically, so the
false clause was certified, and it is what kept the ungated MagicItems
arm from being read as the bug it was.)

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
(CalculateTradePrice's selling branch is ported, and AUDIT 58 gave it
the numeric anchors it had never had - it carried only inequalities, so
its 51*dp and 179*dm coefficients both mutated freely); shop
OPEN HOURS pend (shelves answer at any hour); Library/Guild/Temple
bookshelves + owned-house storage pend; restock pends the calendar.

Probed live (tools/shopProbe.mjs, RETIRED at ROAD-E E8 - its drive
lives on in tools/nativeTradeProbe.mjs): door 37 = "The
Adventurer's Book Dealer" (Bookseller, quality 6) -> enter -> 4
shelves -> browse "1 - Book (2950 gold)" x3 -> Digit1 buys: gold
20000 -> 17050, the item in the entity, the window re-lists 2.

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

Probed live (tools/shopProbe.mjs, retired - see above): the
bookseller round trip - buy a Book at 3062, S, sell it back at
2904 (the merchant's margin), gold 20000 -> 16938 -> 19842, the
item off then back on the shelf.

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
nor the state yet; the STATE alone is injectable (ctx-threaded) - the
effect-based source has no hook in tryAbsorption at all (AUDIT 23
magic-16 corrected the 'both are injectable' claim). The career
branch is the live one.

The career branches read `inside` and `day` - darkness is
inside-OR-night, light is outside-AND-day - which is the same law
rest.js's RapidHealing already uses, and DFU takes both from the
PLAYER for every entity ("everything is where the player is",
:1305). The dungeon host passes `inside: true` because a dungeon is;
the exterior spell paths shipped at S30 - their absorbCtx answers
`inside` by mode and `day` off the one clock, so the InLight and
InDarkness careers finally read a live sky.

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

## G3 - guild services: what rank BUYS

2026-08-19. G1 and G2 built membership and rank; this is what rank is
FOR. Law only - the windows that spend it are their own slice.

**The service NPC table is copied from DFU's SWITCH, not inferred from
its enum names**, and that is the whole reason to be careful with it.
The 61 GuildNpcServices members are named `PREFIX_ServiceName`, so
deriving the mapping from the suffix is the obvious shortcut - and it
is wrong in exactly three places: MG_BuySpells maps to
BuySpellsMages (not BuySpells), KO_Smith to ReceiveArmor and
KO_Seneschal to ReceiveHouse. Extracted mechanically, checked 61
against 61 with no member missing a case, and the three disagreements
are pinned by name. DFU's own comment explains why the table exists at
all: it "duplicates data from faction.txt mainly because guild flags
are not consistent".

**-1 IN THE TEMPLE SERVICE TABLE DOES NOT MEAN "NEVER"** - and G2's
comment said it did. CanAccessService tests `serviceRank <= rank`, so
a -1 column PASSES at every rank. It reads as "never offered" only
because the temple has no NPC for that service, so the question is
never asked: the rank gate and the OFFER are two different things.
The same -1 never matches GetPromotionMsgId's `== rank`, since ranks
run 0..9. Both behaviours pinned, and G2's comment corrected.

**The money formulas truncate before they multiply.**
`(((10 + rank) << 8) / 10 * reward) >> 8` is C# int arithmetic: the
/10 truncates FIRST, so a rank-3 Fighters Guild reward on 1000 gold is
1296 and not 1300, and a rank-9 repair is 97 and not 100. Pinned on
those exact values, because a "cleaner" reward * (10+rank) / 10 passes
a spot check at rank 0 and drifts everywhere else.

Training: the cap is a flat 50 and no guild overrides it; the price is
(member 100 / non-member 400) x the player's LEVEL, so it scales with
the character rather than the skill, and rank does not discount it. A
KNIGHTLY ORDER TRAINS NOTHING - KnightlyOrder.cs returns null outright.
A TEMPLE TRAINS NON-MEMBERS where a guild does not.

The training list is not the guild-skill list the rank law reads - but
not uniformly, and that was measured after a pin asserting it always
differs failed. FIVE divines train a wider set than they rank on;
Kynareth, Mara and Zenithar use the same list for both.

Two benefits worth naming. The Mages Guild's free magicka recharge is
gated on Career.NoRegenSpellPoints - the perk exists FOR the Sorcerer,
and reads the same career flag U20b writes. And a knightly order's
free tavern rooms come at rank 4 OR at any rank inside the order's own
region: a knight is a local somebody at home.

Only Arkay discounts curing; only the Fighters Guild alters rewards
and repair costs; only a temple has a library, at its own rank.

13 mutations run, 13 killed.

## S26 - MYSTICISM: the effect library's empty school

2026-08-19. The other five schools stood at 96%, 96%, 75%, 50% and 22%
when this landed. Mysticism was 0 of 10, and the reason is structural:
NOT ONE of its ten effects supports MAGNITUDE. They do not fit the
"roll a magnitude and apply it" ladder applySpell grew around - they
open doors, destroy nearby enemies, gag a caster, fill a soul gem.
Each is its own payload, so the school got its own module.

All ten classic keys are checked against the same DFU extraction the
coverage measurement uses: 10 of 10.

**Open and Lock are asymmetric, and that is the law.** Open is an
ARMED effect - the chance rolls at CAST, the caster is told "Ready to
open.", and the payload waits for them to activate a door. It yields a
lock only to a caster whose LEVEL REACHES its value ("unlocks chest or
door to lock-level of caster"), and a door it fails to beat stays shut.
An item cast, and the Skeleton's Key, skip the roll entirely - and the
Key ignores the level rule too, so it opens even a magical lock. LOCK
has no level test at all: it simply imposes the caster's own level,
and refuses an already-locked door rather than deepening it. A level-9
caster cannot strengthen a level-3 lock.

**Dispel Undead and Daedra DESTROY, they do not kill.** DFU's own
comment: "just like classic, dispel simply destroys serializable enemy
object in scene - target is not killed and will drop no loot. This can
break quests if used carelessly." Ported as such, with the chance
rolled PER TARGET rather than once for the group.

**Soul Trap fills Azura's Star first**, wherever it sits in the pack -
the reusable artifact takes the soul before any ordinary gem - and
azurasStarOnly refuses to fall back at all.

**Silence** blocks a cast that COSTS spell points and only that: DFU
guards with `!noSpellPointCost && SilenceCheck()`, so an item cast or a
free effect fires through a silence. DFU checks it in two places, at
READY and at CAST, and both clear the readied spell.

FLAGGED, by name, per THE FOUR HOSTS RULE: nothing here is wired into
a host. Silence needs the readied-spell gate and Open/Lock need the
door-activation path in ALL FOUR of scenes/exterior.js, scenes/world.js,
scenes/worldModes.js and scenes/dungeonContext.js. The predicates are
the shape those hosts will call; none is called today.

Three effects also own a WINDOW in DFU - Dispel Magic picks a bundle,
Create Item picks an item, Teleport picks and recalls an anchor - and
those are the UI arc's. Where the law stands without its window it is
stated: Dispel Magic's validity rule is a pure predicate over the
caster's live bundles (a Spell or a HeldMagicItem, showing an icon -
never a disease or a poison).

12 mutations run, 12 killed.

## S27 - Mysticism reaches a host: SILENCE, and the four-host truth

2026-08-19. S26 landed the ten laws and flagged the wiring. This wires
Silence, and the flag it retires turned out to be hiding a fact about
the port rather than a to-do.

**SILENCE IS LIVE, in both of DFU's gates.** SilenceCheck runs when a
spell is READIED and again when it is CAST, and BOTH clear the readied
spell - so a silence landing mid-aim disarms you rather than waiting
for the click. Both are wired in dungeonContext: the spellbook's
`ready` hook refuses outright, and playerCastInput refuses and clears.
Every cast on that path costs spell points, so DFU's
`!noSpellPointCost` arm is always true here and is recorded rather
than re-derived.

**THE FOUR HOSTS, and why three of them are empty.** The rule wants
all four named:
  - dungeonContext.js  WIRED - it owns readiedSpell and playerCastInput.
  - exterior.js        no cast path at all.
  - world.js           no cast path at all.
  - worldModes.js      no cast path of its own; it MOUNTS
    interiorContext and dungeonContext, so a dungeon cast reaches the
    wired gate through it.

That is not three hosts forgetting something. SPELLCASTING IN THIS
PORT IS DUNGEON-ONLY: readiedSpell, applySpell and the spellbook live
in dungeonContext and nowhere else, so there is no exterior or
interior cast for a silence to block. A source sweep pins it BOTH
ways - the gate is present in the casting host, and absent from the
other three because they cast nothing. If an exterior host ever grows
a cast path the sweep fails and sends its author to the gate.
(S30: it fired exactly as designed - the exterior hosts grew THE
cast path, the author was sent here, and the sweep was inverted:
it now pins every host onto the ONE engine, whose two gates carry
this record's silence law for all four.)

**Open and Lock are still not wired, and the record now names their
seams** rather than saying "pending". Their payload is an ARMED effect
that has to survive between the cast and the next door the player
touches, which needs a slot on the entity's active effects; the door
end hangs off world/actionSystem.js's `activate(key)` - the single
activation point, where `toggleDoor(o, true)` already runs - in the
two contexts that own an ActionSystem, dungeonContext.js and
interiorContext.js. Neither exterior host owns doors. A pin holds that
claim honest: it fails the moment either context calls triggerOpen or
triggerLock without the record being updated.

These hosts have no execution coverage in node - AUDIT 19 found a
crash that 990 tests could not see - so the seam is pinned by READING
them, the same idiom audit17e uses for its four-host rules.

4 mutations run, 4 killed.

## S28 - THE CALENDAR: the port finally knows what day it is

`src/systems/gameDate.js`, 1:1 from `Utility/DaggerfallDateTime.cs`.
`test/gamedate.test.js`, 9 tests.

**This landed because a UI slice tripped over its absence.** The port has
had a clock since the beginning - `worldTick.js`'s `classicMinutes` - and
no DATE. A surprising number of DFU's laws are written in DAYS rather
than minutes: the guild rank gate is 28 days between changes, shop
opening hours are a clock hour, the magic-item stock rotates on a
day seed, quest timers are due-dates. U23 wired the guild service popup,
whose OnPush calls `UpdateRank`, which takes `{ year, dayOfYear }`.
Inventing one would have made the 28-day gate fiction, so the calendar
is ported instead. `Guild.daySinceZero` now DERIVES the day of year the
way DFU's property does rather than reading a field a caller invented.

**Daggerfall's calendar is fixed 30-day months**, twelve of them, so
every date is exact integer arithmetic with no leap rules. The two
constants that are not obvious are `classicEpochInSeconds`
(12,566,016,000 - the offset between DFU's own year-zero seconds and the
minute counter classic saves keep) and `classicGameStartTime` (523,530
minutes). The second is pinned against DFU's own docstring: it is 13:30
on the 4th of Morning Star, 3E405, and the port reproduces that to the
minute.

**Two start dates exist in DFU and they disagree.** The class's field
defaults are year 405 month 5 day 0 hour 12; `SetClassicGameStartTime`
is the date above. Both ship here, because collapsing them would lose a
real distinction - a fresh `DaggerfallDateTime` is not a new game.

**The season boundary is DFU's own admitted approximation**, kept
verbatim: "Daggerfall seems to roll over seasons part way through final
month. Using clean month boundaries here for simplicity." The port must
not be more accurate than the thing it is a port of, so the twelve-entry
table is pinned as written, Evening Star wrapping to Winter included.

**Names came out of the localization tables**, the same source U23 used
for the rank titles: `dayNames`, `monthNames`, `birthSignNames`,
`seasonNames`. `GetLocalizedTextList` splits on newlines only, which is
why "Rain's Hand" and "Sun's Dusk" are one entry each.

FLAGGED, and routed to a sky slice: the two lunar phase getters. Nothing
in the port reads a moon, and DFU's own comment says that logic mirrors
the Enhanced Sky mod rather than classic. `RaiseTime`'s carry chain is
absent by design - this module is pure functions over an absolute minute
count, so there is no mutable clock to carry.

NOTED, not fixed: the port keeps TWO independent `classicMinutes`
counters, one in `scenes/shared.js`'s ticker and one in
`dungeonContext.js`. DFU has a single WorldTime. Ledger C.

## U23 (systems half) - StaticNPCClick and the guild popup's law

`src/systems/guildServiceFlow.js`, from
`DaggerfallGuildServicePopupWindow.cs` and the routing block of
`PlayerActivate.StaticNPCClick`. `test/guildserviceflow.test.js`, 15
tests. The window half is recorded in the UI arc.

The split is the one G3 already made: `guildServices.js` holds WHICH
service an NPC offers and WHO may use it; this file holds what CLICKING
that NPC does. All of it is headless, so the window is only geometry and
hit rects.

**The routing is a five-way branch** on the NPC's faction record and the
BUILDING's: guild service, merchant social group, witches coven,
everything else talks - and a faction id that does not resolve talks
before reaching the table at all. Two escapes in the guild arm are
bug-numbered in DFU's own comments and are ported verbatim, because both
are the difference between a service menu and a conversation:

- **t=1238** - a holy-order NPC standing in a building that is not a
  divine's falls back to talk. `Temple.IsDivine` is the NARROW test (one
  of the eight halls), not `GetDivine`'s parent walk.
- **t=2037** - the Thieves Guild spymaster in a building with no faction
  at all falls back to talk, and carries a flag saying it is the
  spymaster, which is the third `TalkToStaticNPC` argument.

**Setup's member flag decides one thing** - whether a Join Guild button
exists - and it is FORCED true for the Dark Brotherhood and for
GeneralPopulace. That second one looks like a mismatch and is not: the
Thieves Guild's guild group IS GeneralPopulace. DFU's comment says why:
"should never find em until a member".

**The two refusals are different messages** and the distinction matters.
A member of too low a rank gets TEXT.RSC 3100 ("I can only help persons
of a certain rank"); a non-member gets a plain string ("My services are
reserved for members only"). One says come back senior, the other says
join first.

**OnPush's order is load-bearing**: the heal lands BEFORE its box and the
sorceror recharge AFTER, damaged attributes ASK before curing, and the
rank step carries `UpdateRank`'s own text id rather than a recomputed
one. `HasDamagedAttributes` and `CureAllAttributes` are asked of the
port's `activeEffects` contributions rather than of per-effect statMods
arrays the port does not have; a POSITIVE mod (a drug's fortify) is not
damage and survives the cure.

**THE ONE CONSTRUCTION SEAM, fifth occurrence.** The live probe opened
the join box and threw on `store.dict`: DFU's PlayerEntity is
CONSTRUCTED with its FactionData, and the port's pre-chargen INTERIM
entity is not, so any host reached without chargen hands every
reputation reader a null. `factionRep.ensureFactionRep` is the
idempotent front door, and it refuses to invent a store without
FACTION.TXT rather than pretending the reputation is zero.

## S29 - HOLIDAYS, and U24's law half

`src/systems/holidays.js` from FormulaHelper.GetHolidayId (:1819-1852)
and DFLocation.Holidays; `src/systems/guildServiceActions.js` from the
three guild-service window classes. `test/holidays.test.js` (6) and
`test/guildserviceactions.test.js` (16).

**Holidays landed because the temple charges for them.** Three of the
53 - South Winds Prayer, First Harvest, Second Harvest - cure disease
FREE, and North Winds Festival halves the price, so without the tables
a temple takes full price on days classic does not. Both tables are 53
rows and the loop covers all of them, which is what makes the enum's
54th member (Old_Life_Festival, marked "Not used" in DFU's own source)
unreachable. The `dayOfYear <= 355` gate means the last five days of
the year are never a holiday, and the tables end exactly at 355, so the
gate is inclusive of its own last row.

**The three services, and the three things each gets wrong if hurried.**

- **Training** has a 720-minute cooldown, and it is a DIFFERENCE
  against `TimeOfLastSkillTraining`, not a time of day. It costs three
  hours of clock AND `DefaultFatigueLoss * 180` of fatigue - the second
  is not a double charge: DFU's per-minute drain fires once across a
  jump, so the session's fatigue has to be charged explicitly. The
  gates run in an order that matters: gold BEFORE the skill picker
  opens, the skill cap BEFORE payment is taken. `Random.Range(10, 20 +
  1)` is inclusive of 20.
- **Donation**'s chance is `(2 * amount / max(rep, 1)) + 1` with C#
  integer division truncating before the +1, over the ABSOLUTE
  reputation - a temple that hates you is exactly as hard to impress as
  one that loves you. The change does NOT propagate, and DFU says why:
  "Does not propagate in classic". A donation larger than the purse
  buys nothing at all - not a partial gift.
- **Cure disease** is 250 per disease through the guild's discount
  (Arkay's members only), the building's quality, the holiday halving
  and then bargaining. `CalculateCost` is called with TWO arguments, so
  the regional price adjustment stays neutral: curing costs the same in
  every province. The haggle message is three SHIFT bands, `>> 1` and
  `- (>> 2)`, which truncate.

FLAGGED: `numberOfDiseases` is DFU's count PLUS ONE when the player is
turning into a vampire or werebeast. The port has no such timer, so
`becomingVampireOrWerebeast` is an argument that is false everywhere
today and correct the moment that arc lands.

**THE ONE CONSTRUCTION SEAM, sixth occurrence.** The live probe trained
a skill, took the gold, and tallied nothing: `characters/playerEntity.js`
had no `skillUses` array, so `TallySkill`'s defensive
`if (!entity.skillUses) return` swallowed every tally on a pre-chargen
entity - and `raiseSkills` had nothing to read either. DFU's
PlayerEntity is constructed with its counters. The literal carries them
now.

**Two shared members were extracted rather than duplicated**:
`effects.cureAllOfKind` (with the three named wrappers DFU exposes), so
the temple's cure and a Cure Disease spell are one implementation; and
`diseases.diseaseCount`, which is money here rather than decoration.
`shared.createPlayerTicker.advance(minutes)` is DaggerfallDateTime's
RaiseTime for the hosts: it runs the SAME per-minute tick over the
jump, so a three-hour training session owes the world its magic rounds,
disease days and skill-advancement passes.

## S30 - SPELLCASTING ABOVE GROUND: the one engine and the whole book

2026-08-20. The AUDIT 23 hosts-2 priority row said a Mage cannot cast
in town. The fix is not three copies of the dungeon's stack - it is
scenes/hostMagic.js, the dungeon's audited casting stack EXTRACTED
verbatim behind injected deps, and then every host mounted on it. ONE
DFU MEMBER, ONE EXPORT at host scale: readySpell's two gates, the four
range arms, the school tallies + cast sound, the absorb refund cap,
applySpellToPlayer's message arms, explodeAt, and the player missiles
(flight, wall explode with the AreaAtRange impact arm, foe seek,
billboard batches, and PRUNING - retired missiles now leave the list,
a leak the old host-local loop tolerated). Saving throws roll through
an injectable `rolls` slot (ENGINE-PRNG RULE).

**One engine per PAGE, not per mode.** exterior.js and world.js each
mount one engine whose deps are mode-FACADES: the collider raycast
follows the door (modes.interiorCollider when inside), foes() answers
the live guards only in exterior mode, and absorbCtx() answers
`{inside, day}` from the mode and the one clock - so S24's InLight and
InDarkness careers finally read a real sky, and a spell readied in the
street stays readied through a tavern door. worldModes' interior arm
drives the same engine through the host bag; dungeonContext swapped
its local stack for the engine and DELETED it (121 lines), keeping
only enemy missiles and both sides' arrows host-side - different DFU
owners - which land through the engine's explodeAt/applySpellToPlayer.
Guards take spell damage through cityGuards' ONE damage door, so a
killing bolt raises the corpse and the Murder record exactly like a
sword.

**The classic input chain, everywhere.** Backspace opens the book
(DFU's default), Enter readies; readying a CasterOnly spell casts
INSTANTLY at ready; a ranged ready ARMS the click latch, and the
attack click casts instead of swinging - interceptAttack consumes the
latch in every host's attack path, firePending fires on the next
frame with the live eye. KeyC stays the port's direct-cast key
(flagged as ours in ui/input.js). The readied spell rides the dungeon
save as its SPELLS.STD index, so book reorders cannot corrupt it.

**The spellbook manages itself now (ui-native-2).** d deletes behind
the classic YesNo - the vampire/lycanthrope tags refuse BEFORE the
prompt ("no way to get them back"; inert until a curse mints a tagged
spell, but the gate is DeleteButton_OnMouseClick's law) - u/j swap
with the CURSOR FOLLOWING the moved spell, s sorts alpha first and by
point cost when the sequence did not change (SortSpellsConfirm's
SequenceEqual arm; the cost key is the window's castCost, which is
DFU's null-caster cost because FormulaHelper resolves a null caster
to the player). Every mutation is IN PLACE on entity.spells, so the
save envelope's index array carries membership and order. ~~RESIDUE on
the ledger row: Rename (needs per-entity spell copies + name
persistence), the prompt PROSE (keys cited, values pending a classic
string source), and the window's OpenBook/PageTurn sounds.~~ The
sounds landed with this slice; UI's U42 moved all of these laws onto
the CLASSIC window (SPBK00I0.IMG) and closed Rename with them, so the
keys here are the classic L/U/S/D bindings now and the residue is the
prompt PROSE alone.

**Verification.** 11 engine pins run the laws behaviorally
(hostmagic.test.js); 5 wiring pins sweep every host's mount, click
seam, frame drive, facades and save seam (hostmagic_wiring.test.js);
5 spellbook pins ran delete/swap/sort against the keyed window
(inventoryui.test.js, DELETED at U42 - the laws are re-pinned against
the classic window in spellbookwindow.test.js); S27's dungeon-only sweep INVERTED into the
four-hosts-one-engine sweep. 5 mutations run, 5 killed. And because
these hosts have no node coverage, tools/castProbe.mjs drives the
LIVE pages frame-synced: the sort in a real book, the instant
ready-cast, the click-to-cast whiff aborting BEFORE the spend with
the latch consumed, a missile's spawn/flight/lifespan retirement
with no leak, a real door transition with the book carried inside,
and the dungeon regression - exterior, world and dungeon all green
with zero page errors. The probe surfaced one truth the first draft
got wrong: no classic starting set carries a missile spell (the
Mage's book is utility + touch), so the flight leg readies the
cheapest flier off the file - the same interim list an empty book
shows.

## S31 - FAST TRAVEL: the Iliac opens up

2026-08-20. The F-slice. The world host could stream the whole bay
but the only way across it was walking. systems/travel.js now
carries TravelTimeCalculator.cs verbatim: the classic longest-axis
stepper (the increment compares with >, kept exactly), per-pixel
climate through CLIMATE_INDICES and the terrain movement modifiers,
ocean at 51 by ship / 255 without, the 102*transport>>8 fixed-point
chain (foot/horse/cart 256/128/192), camping's 300/256 multiplier -
inns are FASTER - and reckless as exactly the >>1 halving. The trip
cost keeps DFU's negative-nights guard (absent from classic) and
prices a rented ship at 25 per started 24 ocean pixels. The arrival
clamps are pure minute math: a sun-averse traveler arriving by day
is pushed to dusk with the minute kept; cautious night arrivals
land at 7:10 through the literal 31-hour next-day form.

The WINDOW (ui/travelMap.js) compresses DaggerfallTravelMapWindow +
TravelPopUp into the keyed native idiom: a classic prefix-match
typeahead over the whole map directory - buildTravelIndex walks
every exterior location into name/region/pixel/type - replaces the
region-map click surface (the TRAV art window is the residue row's
head), the popup's three toggle pairs ride c/r, i/t, s with the
popup's defaults, and Enter travels behind enoughGoldCheck.

The ARRIVAL (world.js) is performFastTravel's order verbatim:
deduct, teleport - tear down every built pixel and RE-INIT the
streamer at the destination, which is the streamer's own verbatim
ResetStreamingWorld, then build the destination pixel and spawn at
its center height - cautious full health/fatigue restore with
magicka honoring NoRegenSpellPoints, RaiseTime through the ONE
clock (the U24 advance runs the same tick, so magic rounds and
disease days catch up inside the jump, exactly the promise that
record made to future callers), then the clamps off the landed
clock.

Probed LIVE end to end: V in Daggerfall city, the nearest real
destination typed into the real window, two Enters - The Gathering
of Evelyna, 208 minutes (exactly 2 moves x 104, the inn-mode
woodlands fixed point), 5 gold for the one inn stay, the player
landed on the destination pixel, zero page errors. 8 pins across
travel.test.js (the exact fixed-point chain per mode, the cost
boundaries, the clamps at their edges, and the real-map
Daggerfall-to-Wayrest ordering with the exact reckless halving) and
travelmap.test.js (the typeahead, the toggles, the gold gate, the
host's arrival-order sweep). 3 mutations run, 3 killed. The residue
- the TRAV art, the exterior arms, transport ownership, the
sun-averse producers, spawn prevention - is ONE ledger row.

### S31 addendum (U41, 2026-08-24): the WINDOW paragraph above is
history. `ui/travelMap.js` is DELETED and the keyed typeahead with
it: the classic art window ships in `ui/travelMapWindow.js` +
`ui/travelPopUp.js` (UI-Arc's U41), so the region-map click surface,
the location dots, the find box and the popup's own art are all
real. The LAW half of this slice is untouched - `systems/travel.js`
still owns the calculator, the cost and the clamps, and world.js's
arrival is still performFastTravel's order. What moved is who calls
it: the popup hands the host the same `(pick, opts, computed)` the
keyed window did.

## S32 - RANDOM ENCOUNTERS: the dungeon dark answers back

2026-08-20. The E-slice; entity-14's spawner half. The 45 encounter
tables are BAKED from RandomEncounters.cs - 20 mobile ids each, 0-18
by dungeon type, 19 underwater, 20-37 by climate x location-rect x
day/night, 38 unused (the C# carries it), 39-44 by building type;
the extraction strips the commented-out "DF Unity version" Cemetery
that a naive regex swallows. ChooseRandomEnemy verbatim: the table
pick (a town by day spawns NOTHING; unknown climates spawn nothing),
then the classic level band - roll <= 80 reads [level-3, level+3],
81..95 opens [0, level+1], 96+ opens [0, level+2] under level 6 and
the whole list above, with the floor snapping to [0,5] and the
ceiling to [14,19] - and DFU's short-list guard (not classic) kept
for table edits.

IntermittentEnemySpawn as a PURE decision: the 144-minute cadence
((minutes/12) % 12 == 0 - twelve open minutes in every 144, pinned
against the %6 mutant at minute 72), town-rect NIGHT at 1/24,
wilderness 1/36 by day and 1/24 by night (the day window 360..1080
inclusive), the dungeon arm at 1/36 ONLY while resting AND under an
active enemy alert (RollRandomSpawn_Dungeon returns 1 otherwise),
and the classic minimum distances 8/10/10.

THE ENEMY ALERT exists now - the state toggleRest's routed leg had
named since 2026-08-16f: a foe with the player IN SIGHT raises it
every update (EnemySenses:533-535), opening rest with enemies
nearby raises it (DaggerfallUI:650-655 - the routed leg closed),
killing the foe that targets the player clears it (EnemyDeath:
132-136; survivors re-raise next update), and it decays past 8
hours (PlayerEntity.Update:380-384, strict >). It lives on the
entity, one flag for every consumer.

The DUNGEON REST arm is live end to end: the rest session's
advanceMinutes runs the catch-up loop across the advanced minutes
(PlayerEntity.Update:486-492) and breaks on the first spawn; the
spawn mints a REAL foe through buildFoeAt - the load loop's body,
extracted so runtime spawns ride the same chain (entity, loot,
equipment, AI, attack, sprite) - at the classic 8 units, eight
compass points floor-landed nearest-first; the session's hourly
enemy check then breaks the rest, which is DFU's own flow. The
above-ground arms are pure and pinned but their SPAWNER needs the
exterior mobile-foe mount - the residue row's head.

5 pins (the tables against the C# rows, the pick + band verbatim,
the cadence/rolls/decision, the alert laws, the host sweep); 3
mutations run, 3 killed. The dungeon boots and fights clean.

## S33 - THE ABOVE-GROUND QUICKSAVE: the overworld keeps your place

2026-08-20. The P-slice; the AUDIT 18 dungeon-only-save row narrows.
The world host binds the classic F9/F11 (InputManager.SetupDefaults)
to the dungeon's own envelope - snapshotPlayer already carried the
entity, items, spells, conditions, faction rep and the T4 discovery
store - plus the world half this host needed: the map pixel and the
NATIVE Daggerfall world coordinates with the compensation-free
height, because a local scene position dies at the first
floating-origin recenter. The streamer grew localFromWorld, the
exact inverse of worldCoords under the CURRENT origin/compensation
(pinned through a recentered state - the zero-compensation fixture
let the mutation live). The load teleports through the travel
core (_teleportToPixel, the F-slice extraction shared) and lands on
the exact native spot; the encounter anchor resets across a load
(DFU's LoadInProgress parity - no spawn catch-up for time that never
passed). One classic slot, the dungeon's key: a save from the other
side restores the CHARACTER and says where it was; travel-on-load
pends on both sides with the dungeon's own note.

Probed live: F9 at (409.6, 379.1, 818.2), a 60-unit warp across a
pixel boundary, F11 - the exact position, pixel, clock and gold
back, through a full world teardown and rebuild, zero page errors.
2 pins (the envelope + inverse round-trip incl. compensation, the
host sweep with the load-time guards); 3 mutations run, 3 killed.
Still out: REST above ground and the single-location exterior
page's arm (the narrowed row keeps both).

## S34 - FOUR SMALL LAWS: the L-slice sweeps the ledger's little rows

2026-08-20. Four AUDIT 23 rows closed in one pass - two fixes, one
port, one refutation - plus the quest machine's sourcing fork raised
as a DECIDE row.

entity-7 REFUTED: the "60x magic rounds over a rest" finding misread
TickRest. DFU's rest catch-up raises one round per game MINUTE
through the broker's loop under a 2880-minute cap, and the port's
worldTick already runs the identical loop under the identical
MAX_CATCHUP_ROUNDS = 2880 (pinned since audit21_core). The row was
the bug; nothing in src/ moved.

entity-9 SHIPPED: applyLevelUp was `level = calculated` - a
multi-threshold rest paid out in one jump. Now it is Level++, one
step per acknowledgment, and checkForLevelUp (its own export at
last) sits UNCONDITIONALLY at raiseSkills' tail exactly where
RaiseSkills has it - so the overshoot re-offers on the NEXT
360-minute check with no new skill raise needed, and converges
quietly at par. pendingLevel survives as the banner's convenience,
always level+1.

items-9 SHIPPED, premise corrected: DFU has NO over-encumbrance
speed penalty (PlayerSpeedChanger never reads CarriedWeight) - like
classic it REFUSES the pickup. canHoldAmount ports the GP-unit
integer arithmetic (kg x 400 rounded; remaining capacity int-divided
by the unit weight), _pickRemote gates both take modes through it -
refuse-with-the-box at zero fit, split-take exactly what fits on a
partial stack (the DFU split popup's DEFAULT Enter; the free-entry
field stays INTERIM), whole transfer otherwise - and itemWeight now
routes through the named effectiveUnitWeightInKg member.

combat-16 SHIPPED: the minMetalToHit refusal in calculateAttackDamage
speaks through the say seam for the PLAYER only (enemies fail
silently, per the source's attacker gate); prose ours, key cited.

4 new pins (littlelaws) + the three old jump-law pins rewritten to
the one-step law with the re-offer and convergence arms; 5 mutations
run, 5 killed (the jump, the gated tail check, float division, the
gate bypass, the always-say). The quest DECIDE row records the fork:
the engine source is fully in the snapshot, its .txt quest inputs
are NOT, and ARENA2's QBN/QRC binaries are a format DFU never
parses - vendor the upstream pack, write a classic reader, or defer.

## S35 - MAGIC FIDELITY: the L2-slice trues up the effect system's fine grain

2026-08-20. Seven AUDIT 23 magic rows closed in one pass - the last
open rows in the magic family.

magic-3: the buff family (silence, the concealments, freeAction, the
alteration buffs) landed unconditionally; now the landing runs the
assign loop's exact gate order. The incumbent stack happens INSIDE
Start, so it lands before the chance and save gates and survives
both - the verbatim quirk the paralyze arm already carried. The
OnCast chance rolls for SILENCE alone (the only buff class that
supports chance; every other sets duration only), and a NEW
non-CasterOnly instance saves against the ENTIRE effect, since no
buff carries a magnitude to scale.

magic-7: ByTouch was a nearest-in-any-direction 2.5 radius pick -
you could touch a foe behind your shoulder. Now it is the 0.25
sphere-cast pushed 3.0 ALONG THE AIM: closest point on the aim
segment against each live foe's mid-capsule plus the 0.45 body the
missile test uses, FIRST hit along the ray wins, walls block.

magic-8/9: the trap CastSpell arms - a CasterOnly trap spell readies
ON THE PLAYER FOR FREE through the engine's new readiedFree state
(the silence gate and the cost both bypass, exactly as the source
gates them on noSpellPointCost; the absorption refund cap stays
unbound at zero cost); a ByTouch trap payload retargets to
SingleTargetAtRange; a casterless AoC no-ops loudly. An ENEMY
AreaAroundCaster no longer flies - it explodes at the caster on the
spot with the caster itself EXCLUDED, other foes in the radius
included.

magic-10/11/12: the paralysis hard-immunity gate grew the manager's
career/racial arms (career Immune, the Resistant-first precedence
quirk, the player racial bit with the Low/CriticalWeakness career
override) beside the FreeAction flag; the magic-only families -
heal/cure/fortify/transfer/concealment/regenerate among the ported
kinds - now SAVE AS MAGIC whatever element the bundle rode in on
(a fire spell's concealment is stopped by magic immunity and sails
past fire immunity); and the drain/transfer incumbency runs the
EXISTING incumbent's like-kind test, so a DRAIN claims an incoming
Transfer of its stat (roll stacked, caster still healed) and a
Transfer never claims a plain Drain.

5 new pins (magicfidelity) + the ranges pin rewritten to the aim law
+ the magic-14 needle repinned to the grown signature; 6 mutations
run, 6 killed (one first-draft mutant survived by accidentally
keeping the ray distance - rewritten to the true old radius law and
killed). Suite 1432 across 188, green both modes.

## S36 - THE BACKWARD REWIND: a load is the saved truth, not a merge

SL2-slice (2026-08-20), closing AUDIT 23 save-load-2. The dungeon
world snapshot (S12) reconciled only as-built-to-saved: applyWorld
could KILL a live foe the save recorded dead, but a foe killed AFTER
the save stayed dead on a backward mid-session load - and a pile
emptied after the save kept its emptied state (no flat, no target)
when the save said it still held its treasure. The reference has no
merge at all: DFU's load REBUILDS the location fresh and overlays
the saved truth per LoadID - SerializableEnemy.RestoreSaveData SETS
health (:176) and disables only data.isDead (:200-203);
SerializableLootContainer.RestoreSaveData removes an empty-in-save
container (:158-160, RemoveLootContainer - which for marker piles is
SetActive(false), :852-864). A rebuild-then-restore leaves NO trace
of anything that happened after the save.

The port patches the live scene in place, so the rewind is explicit:

- **Foes**: beside the forward kill arm, the backward arm - save
  says alive + live says dead -> `f.dead = false` and the corpse
  flat leaves (spliced from BOTH owner lists - corpses and the draw
  list - GL freed, the foe key nulled). spawnCorpse now keys its
  batch to the foe (`f.corpseBatch`) and re-checks `f.dead` AFTER
  the texture await: a backward load can resurrect the foe while the
  corpse texture warms, and a corpse must never mint for a live foe.
  Health/items/position were already restored unconditionally above
  both arms - the full-restore law's easy half.
- **Piles**: items restore both ways (that half stood), and the FLAT
  now follows them exactly where a rebuild-then-restore lands:
  emptied-in-save -> the flat leaves the draw list and frees
  (RemoveLootContainer on restore); refilled-by-rewind -> the
  rebuild's own mint returns at the build-time size (p.half) with
  the pile's OWN record, never rerolled. A pile the build never
  mounted (record out of range - no half) stays unmounted.
- droppedLoot.restorePiles (save-load-4) and the actions restore
  were already full-overwrite - untouched.

RESIDUE: the port's foe record carries no isHostile/
hasEncounteredPlayer halves (SerializableEnemy saves both at
:113-114/:182-183); senses persistence rides the senses row's own
verify pass.

Mutations: 4 run, 4 killed (the resurrect arm deleted; the corpse
batch leaked on resurrect; the pile re-mint arm deleted; the
mid-warm race guard deleted).

Pins: test/sl2rewind.test.js x3 (the resurrect arm - both splices,
the GL free, the key clear, health-before-reconciliation; the
flat-follows-items pair - the empty teardown and the re-mint gated
on the build-time size with the unrerolled record; the spawnCorpse
key + the after-await race guard).

## S37 - THE GUILD MAP REVEALS: promotion pays in places

G8-slice (2026-08-20), closing AUDIT 23 guilds-8. The route note
said it whole: TG rank-6/8 and DB every-promotion side effects -
DiscoverRandomLocation map reveals + notebook notes.

- **DiscoverRandomLocation** (PlayerGPS.cs:892-910) verbatim, as
  the T4 discovery store's LOCATION half: candidates are the
  current region's map-TABLE rows with the baked Discovered flag
  false AND not already in the runtime store (keyed MapId &
  0xfffff exactly as HasDiscoveredLocation masks, :875-882); a
  uniform injectable pick (Ledger A) is discovered and returned;
  a picked-clean region returns null ("there's nothing to find").
- **The ThievesGuild gate** (ThievesGuild.cs:100-103): ranks 6/8
  return PromotionMap1Id/PromotionMap2Id (5228/5229) when the
  reveal SUCCEEDS, the plain 5235 otherwise - the ternary ported
  as data (promotionReveal.mapIds) consumed in promotionTextId.
  Ranks 2/4 never touch the reveal (pinned).
- **The DarkBrotherhood quirk** (DarkBrotherhood.cs:105-110): the
  reveal fires on EVERY promotion BEFORE the rank switch - an
  even-rank promotion takes the default message and still
  discovers a location. promotionReveal.always, verbatim.
- **The threading**: promotionTextId/textIdFor/updateRank grew a
  ctx; onPushEffects hands { revealLocation }; the interior host
  threads host.revealLocation; the world host builds the seam over
  the CURRENT pixel's region off the map TABLE (mapId + the baked
  flag + names - no full location reads).
- **The envelope**: snapshotDiscovery emits { buildings, locations }
  now; restore accepts the pre-G8 FLAT building map (locationIds
  carry a colon, so the `buildings` key can never collide). The
  T4 envelope pin repinned to the evolved shape + the legacy arm.

FOUND ON THE WAY (a new ledger row): the port's travel map searches
the WHOLE directory - DFU draws a dungeon only when Discovered, so
every hidden dungeon is reachable before anything reveals it. The
G8 store is the read half; the filter + the arrival/quest reveal
writers are the row.

RESIDUE: the notebook note (readMapTG/readMapDB with %map) pends a
notebook surface; the reveal logs loudly meanwhile.

Mutations: 4 run, 4 killed (the store exclusion dropped - re-picks;
the TG gate dropped - dry regions claim maps; the DB unconditional
arm dropped; the locations half dropped from the envelope).

Pins: test/guildreveal.test.js x4 (the candidate filter/pick/
picked-clean-null + the envelope round trip; the TG 6/8 gate with
the dry fall-through and the 2/4 no-reveal spy; the DB
three-promotions-three-reveals; the host-to-law threading sweep).

## S38 - RECALL: the Teleport effect anchors and returns

TP-slice (2026-08-20). The (43,255) Teleport effect - Mysticism,
self-only - had no port; the S26/S27 effect sweep left it as the
one classic spell whose whole body is HOST machinery. Teleport.cs
whole, minus the cross-host arm (flagged loud):

- **The effect** assigns NOTHING: Start prompts (:63-68). The
  port's arm in applySpell raises `out.teleport` on a CasterOnly
  arrival only (TargetFlags_Self, :52 - a ranged arrival is
  dropped), and the rest of the bundle still processes. The engine
  (hostMagic) routes every player arrival through the new
  onTeleport dep - :88-90's player gate, structurally.
- **The prompt** (:81-98): the 4000 anchor/teleport box as a
  ChoiceWindow - A sets the anchor, T teleports, Escape cancels
  (AllowCancel is DFU's own QoL note). Prose ours, keys
  teleportOrSetAnchor/achorMustBeSet [sic] cited.
- **The anchor** (:100-117): the S33 native shape - map pixel +
  world coordinates + the compensation-free height - stored on
  playerEntity.anchorPosition exactly where DFU moved it (:35),
  riding the save envelope (pre-TP saves restore null).
- **The teleport** (:119-164): no anchor says 4001; a cast INSIDE
  an interior/dungeon mode leaves it first through worldModes'
  new forceExitToExterior (the exit cores minus the landing -
  :151's TransitionDungeonExteriorImmediate), then the quickload
  warp lands at the anchor and CONSUMES it - :133 and :255 both
  null AnchorPosition on arrival, so a re-anchor is needed each
  time, verbatim. Recall OUT of a dungeon to a town anchor - the
  classic use - works.
- **The residue, loud**: an anchor set INSIDE an interior/dungeon
  (the cross-host return trip) pends - the anchor stores its mode
  and a mismatched recall says so; the standalone ?exterior and
  ?dungeon hosts say their interim line. wa-4's castle hack keeps
  waiting on exactly that arm (its row notes it).

Mutations: 4 run, 4 killed (the self-only gate dropped; the anchor
surviving arrival; the mode exit dropped; the anchor falling out of
the envelope).

Pins: test/teleport.test.js x3 (the marker on self-casts only with
the bundle still processing; the envelope round trip + the pre-TP
null; the seam sweep - the engine route, both prompt arms, the
4001 refusal, the consume, the forced exit's mode+collider, the
loud interim arms).

### The TP night's flake hunt (X4): the encounter pool's player-side RNG

The recurring one-failure suite flake (six sightings, always green
on re-run) was finally captured in a logged run: the guards' parry
pin counted a surprise SECOND sound. Root cause: the C2 20% attack
grunt at cityGuards' hit frame called playerAttackGrunt WITHOUT its
rolls seam - bare Math.random inside a deterministic test (the
ENGINE-PRNG RULE broken at the call site). Threading each pool's
seam killed it: 0 failures in 30 runs.

The sweep of the other grunt sites then found THREE REAL BUGS in
exteriorFoes' player-vs-encounter-foe arm, shipped at X2:

- resolveHit's rolls param took DFRandom's `rand` - a [0,32767]
  INTEGER - where the damage chain draws 0..1 uniforms. dice100
  (floor(roll*100) < chance) is true only on the exact zero draw,
  so THE PLAYER COULD HIT AN ENCOUNTER FOE ROUGHLY ONCE IN 32768
  SWINGS. (The X2/X3 probes exercised enemy arrows and casts;
  no probe ever swung at an encounter foe - the gap that let it
  live.)
- the parry pick fed the same integer into Random.Range(0,9)'s
  0..1 contract - the clip id overflowed the sound table;
- the zero-damage arm passed zeroDamageHitSound's WHOLE {sound,
  at} object into playOneShot as a clip id, and never played the
  at-the-enemy parry via play3d (cityGuards consumes it right -
  the copy drifted).

All three fixed to the pool's uniform `rolls` + the guards' exact
consumption shape; DFRandom's rand stays where the classic byte
draws belong (the enemy attack machine). Pinned in
exteriorfoes.test.js X4 (2 more mutations killed); the 30-run soak
stands as the flake's tombstone.

## P1 - THE SCENE CACHE AND THE PERMANENT SET (2026-08-24)

SerializableStateManager's scene half, and the shared blocker three
slices had each flagged on their own: the tavern's rented room
"keeps its interior loaded across a save" (U39), and both of banking's
deeds do the same for a bought house and a bought ship (B1).

**The port had no scene cache at all.** Every interior was rebuilt from
the block data on entry, so anything the player changed inside one was
gone the moment they stepped out: a sword dropped in a shop never
existed, an emptied shelf restocked, an opened door re-closed.

**The two-tier model** is the whole design. The CACHE is keyed by scene
NAME and holds what the player changed - written on the way out,
read on the way back in. The PERMANENT SET is a list of names whose
cache entries survive `ClearSceneCache`; everything else is dropped
when the world moves on, which is exactly what makes an ordinary shop
forget and a rented room remember.

**Three things worth naming.** Restoring CONSUMES: the entry is
deleted as it is handed back, so the cache is a hand-off rather than a
store. A new game clears both the cache and the permanent set; a world
move clears only the ordinary. And the permanent clear STRIPS THE
CORPSES - a body left in your own house does not survive the world
moving on though the chest beside it does, which is DFU's own "sans
corpses" comment made into a filter.

**The scene names are the key**, so they are pinned character for
character: `DaggerfallInterior [MapID=%d, BuildingKey=%d]` and
`DaggerfallWorld [mapX=%d, mapY=%d]`. A reformatting is a silent cache
miss, not an error.

**One flag retired outright.** `rentRoom` now names the scene it holds
and the expiry sweep releases it - the landlord clears the room, which
the port had nowhere to say until the set existed. The house deed's
own `AddPermanentScene` still waits on the building directory; the
ship's two scenes name themselves and are ready.

Pins: 10 in `scenecache.test.js` plus two in `tavern.test.js` for the
retired flag. 12 mutations, 12 dead. Live:
`tools/sceneCacheProbe.mjs` walks into a real bookshop, takes an item
off a shelf, leaves, comes back and reads the shelf at 2 where a
restock would say 3 - the discriminating half, because the first draft
of that probe compared 3 with 3 and would have passed on a shelf that
simply re-stocked.

## G4 - THE GUILD STORE ARM (2026-08-24)

Four of the eleven remaining guild-service destinations were FLAGGED
nulls that needed almost no new law: U40 built every trade-window mode
and X6 proved the shelf pattern, so `Identify`, `SellMagicItems`,
`BuyPotions` and `BuyMagicItems` were destination strings and a shelf
minter. What made the slice worth taking is what wiring them forced.

**THE FLAG THAT HAD NEVER HAD A CALLER.** `openTradeWindow` passed
`guildFactionId: null` with a FLAGGED comment since U40, which meant
`buyHolidayHalvesPrice`'s Mages Guild clause — Tales and Tallow
halving the price of anything bought **at** the Mages Guild — could
never be satisfied by any caller in the port. A guild service opening
the trade window is exactly the case that supplies one. A high-street
shop still passes null, because a shop belongs to no guild, and the
mirror clause (Merchants Festival halves *outside* a guild only) reads
the same field from the other side.

**THE VALUE SUM M4 UNBLOCKED.** `createRegularMagicItem` had carried
its own flag since S4c — *"a magic item still sells at its mundane
base until the enchantment cost sum is ported"* — and M4's catalogue
was that sum's missing half. `legacyEnchantmentValue` is
ItemBuilder's closing walk, and three things about it are worth
keeping:

- **The bound is the enum's own order.** `type < ItemDeteriorates`,
  and ItemDeteriorates is 16 with every drawback above it — so a
  legacy item's value counts its powers and nothing else, the same
  shape M3's `GetTotalGoldCost` takes for a hand-made one, written as
  a comparison rather than a list.
- **SoulBound is the one drawback under that bound**, and it scores
  `+SoulPts` off the enemy table where the item maker charges the
  catalogue's negative. A Daedra Lord is −8000 to make and +800000 to
  buy. DFU's own comment beside the line: *"Not sure about this.
  Should be negative? Needs to be tested."*
- **The three `CastWhen*` are priced twice over, differently.** Here
  it is ten times the SPELLS.STD record's casting cost; at the item
  maker it is the flat `classicSpellCosts` table. The same enchantment
  is worth one thing bought and another made.

**A BUG THE REAL DATA CAUGHT.** ItemBuilder routes five effects
through an array indexed by TYPE, ignoring the stored param. Four of
them mint at ClassicParam −1, so "ignore the param" and "read the
single cost" are the same thing — and I wrote it as a read at −1.
EnhancesSkill is the fifth and is not like that: one flat cost across
all thirty-five skills, with a real skill id in the param, so reading
it at −1 answers null and free-prices the item. On the shipping
MAGIC.DEF exactly one record has that shape — *%it of Venom Spitting*,
a single EnhancesSkill slot at param 7 — and it priced at zero until
the lookup moved to *the first param the effect mints*, which is right
for all five because a flat cost is flat.

**AND A FOUR-HOSTS GAP THE PROBE SURFACED.** The magic registries were
set only in the dungeon host's boot, so any magic item minted from an
exterior host — shop loot, a city corpse, and now this shelf — found
no templates at all and was silently skipped. The guild shelf is what
made it visible: it came back holding a spellbook and nothing else.
Both registries now load through one `loadMagicRegistries` in
`scenes/shared.js`, which all four hosts call; AUDIT 18's two-catch
rule and the first-wins duplicate-index law moved with it, and the
pins that guarded them in dungeonContext follow the law to its new
home rather than being retired.

**THE SHELVES.** `GetMerchantMagicItems` is one function serving two
services, which is why this is one function here too: both loops are
`i <= numOfItems` (inclusive), the seed is the day, stock arrives
already identified, a spellbook closes the magic run, and the gem run
rides along on the magic shelf whenever the guild also sells gems —
**after** the magic run, so the Buy Magic Items gems and the Buy
Soulgems gems differ on the same day at the same guild from the same
seed. The potion shelf is `quality + 1` and burns a draw DFU throws
away: `CreateRandomPotion` never reads the `Range(1, 5)` stackSize its
caller computes, but the draw still advances the stream.

**PROBED LIVE** (`tools/guildStoreProbe.mjs`), through the real
guild-service dispatcher: all four arms reach the trade window; the
Mages Guild's faction id (40) arrives in the price context; the magic
shelf stocks from the real MAGIC.DEF at enchantment-derived prices
(1530, 1200, 1020, 1200, 1040) with the spellbook closing it; a
member's shelf carries gems `25,empty,empty,empty,empty` where the Buy
Soulgems shelf the same day carries `28,empty,empty,empty,empty`;
Identify and SellMagic open with no shelf and the player's own pack;
and with the clock moved to day 243 the price context holds holiday 38
**and** a Mages Guild id at once, which is the first time both halves
of that clause have ever been present.

Pins: 8 in `guildstore.test.js`. 11 mutations, 10 dead, 1 recorded
equivalent — DFU's explicit `type != None` test guards a C# array
index that would throw, where the port's lookup degrades to null, so
dropping it is observable in DFU and not here.

## G6 - THE KNIGHTLY GIFTS AND THE SPYMASTER (2026-08-24)

Two more FLAGGED service destinations, and the last two that need no
window of their own. Four guild services remain after this, one of
them genuinely blocked.

**THE ARMOUR IS ONCE PER RANK, and the bookkeeping is a bitfield.**
`armorMask = ArmorFlagStart << rank`, with `ArmorFlagStart` 4, so the
house owns bit 1 and the ten ranks own bits 2 through 11. A counter
would not do: **a promotion re-opens a gift the previous rank
closed**, and claiming the new rank leaves the old rank's bit
standing. The membership grew a `flags` column, which rides the save
through the shallow clone that was already there — and a membership
saved before this slice reads as *nothing* claimed rather than
everything.

**THE MATERIAL IS THE RANK, through integer arithmetic on the enum's
own values.** `ArmorMaterialTypes.Iron + rank`, and Iron is `0x0200`
with the nine metals above it filling `0x0201`–`0x0209`. Ten ranks map
onto ten metals exactly. Leather, Chain and Chain2 sit *below* Iron
and the gift can never reach them, however low the rank.

**FOUR TO SEVEN PIECES — NEVER THREE.** `for (int i = Range(3, 7); i
>= 0; i--)` draws 3..6 and then runs `i + 1` times. The low bound is
the one that matters: a straight port of "Range(3,7) pieces" offers
three, which the player never sees. Same family as the shop shelves'
inclusive loops. The pieces are Cuirass through Boots *inclusive*,
seven body slots and no shield.

**AND THE GIFT IS CLAIMED BY TAKING.** DFU hands the list to the
inventory window in choose-one mode and sets the rank's flag *from the
take callback*, so closing the window without taking leaves the flag
clear and the armour claimable later. Declining costs nothing. The
port's native inventory grew that mode: the reward list becomes the
remote side, nothing of the player's can go *into* a pile they are
only choosing from, and the take closes the window and fires the
claim. The window is built by the **host** through a new
`makeInventory(extra)` door — one builder per host, so the service
gets that host's own dependency list rather than a second one
assembled from scratch.

**The Spymaster** is a greeting rather than a service: a random
TEXT.RSC 402 variant, click-anywhere to close, and the *dismissal*
hands the player to the NPC's own talk window with `isSpyMaster` true.
That is the same door the popup's Talk button opens, so the two now
share one `talkToStaticNpcHere({ isSpyMaster })` and the only thing
that differs between them is the flag. The pin that guarded the old
shape follows the law to the new one and gets stronger.

**A DEFECT THE PROBE FOUND.** Both of these arms answer a message
**box** rather than a window — the smith's refusal and the Spymaster's
greeting — and the caller mounted whatever came back. A box landed in
the overlay slot and the next frame asked a plain object to draw
itself: `interiorOverlay.draw is not a function`. Unreachable before
this slice, because no arm had ever returned a box. The caller now
hands a box back to the popup that asked for it, and the pin checks
that the test comes *before* the mount — where it would otherwise
never run.

**PROBED LIVE** (`tools/knightlyGiftProbe.mjs`), in a real building
with a rank-4 Order of the Candle membership: the smith offers five
Dwarven pieces (Iron + 4 = 516, and the count inside 4..7); a click on
the player's own gear does not reach the pile; taking one puts exactly
one piece in the real pack, sets flags to 64 (`4 << 4`) and closes the
window itself; and asking again offers no second pile.

Pins: 8 in `knightlygifts.test.js`. 7 mutations, 7 dead.

## V1 - THE INFECTION HALF: three days to stop being human (2026-08-24)

`VampirismInfection.cs` and `LycanthropyInfection.cs`, whole. The two
diseases that do not wear off — they end by replacing the player's
race — plus the producer that mints them and the tick that runs them.
Audit-25 listed vampirism and lycanthropy among the systems at zero,
and this is the half that runs before the player turns.

**THEY ARE DISEASES, and that is the whole trick of the port.** DFU
gives each a `DiseaseData` of all zeroes at `0xFF` days of symptoms —
its own comment reads *"Permanent no-effect disease, will manage
custom lifecycle"* — so the disease machinery carries the infection
(the daily tick, the temple's count, Cure Disease) while the effect
does the counting of days itself. The port already had every one of
those, so an infection is an `activeEffects` entry with `kind:
'disease'` and nothing structurally new. What it is *not* is a disease
with a row: `classicDiseaseType = Diseases.None`, and `UpdateDisease`
is overridden and **does not call base**. Without that arm the daily
damage walk reads `DISEASE_DATA[null]` and throws on the first day —
so `diseases.js` skips an infection and `worldTick` runs it instead.

**THE LIFECYCLE IS TWO GATES, AND BOTH ARE OFF BY ONE.** `daysPast >
0` schedules the warning dream — one *full* day, not the day of the
bite. `daysPast > 3` turns the player — the **fourth** day, whatever
DFU's own comment ("after 3 days have passed") reads like. And the
second gate also requires the dream to have been **played**, not
merely scheduled: the flag comes off the modal video's `OnClose`, so a
dream left open holds the infection at that gate for ever. A year
later, still nothing.

**THE TWO DEPLOYMENTS DIFFER IN WHO FIRES THEM.** Lycanthropy turns in
the tick, at the gate. Vampirism schedules a *second* video there — a
fake death — and turns on **its** close, so the tick's job for
vampirism ends at pushing the window. Which means the port has to keep
the close callback rather than folding it into the next tick: DFU's
`fakeDeathVideoPlayed` is set when the window is *pushed*, so a player
who never dismisses the death video is a vampire who never arrives.
Named `deathScheduled` here, because that is what it holds.

**THE CANCELS.** An existing racial override cancels the incoming
infection outright — you cannot catch lycanthropy as a vampire. The
same strain twice ends the *duplicate*, so a second bite does not buy
three more days. And the two lycanthropy strains cancel each other —
the **opposing** one only, so a vampirism infection does not bar a
werewolf bite and a player can be four days from two different fates
at once. A `live.length` test reads the same from the call site and is
wrong; the pin catches it.

**GETVAMPIRECLAN DEFAULTS TO LYREZI, NOT NONE.** The region's Province
faction carries a `vam` column naming the clan that holds it, and the
enum's values *are* those faction ids, so DFU's nine-arm switch is an
identity read plus a membership test. The tail is the part worth
having: *"The Lyrezi are the default like in classic."* `None` is a
value the enum has and this function never returns — a region with no
Province record still turns you. The clan is read from where the bite
happened, not from where the player is standing when they turn (DFU's
own note: *"Think classic uses current region at time of turning, this
will use current region at time of infection"*).

**THE CLOCK RAISE IS SIGNED.** `(2 * SecondsPerWeek) + (DuskHour + 1 -
Hour) * 3600`. Turning at 22:00 gives `18 + 1 - 22 = -3` hours, so the
arrival is three hours *before* the fortnight mark rather than after
it — and that is the point: every turn lands at 19:00 whatever hour it
began, so a new vampire never wakes in daylight. An `abs()` or a clamp
passes a "roughly two weeks" pin and dies against all 24 start hours.

**THE PRODUCER WAS SITTING THERE, ROUTED.** `OnMonsterHit`'s three
special-infection arms had been comments reading *ROUTED* since S18 —
the roll was consumed and nothing happened, and a pin asserted the
player was left untouched. All three mint real infections now. The
Werewolf and Wereboar cases were **split**, because DFU gives each its
own switch arm with the Nymph between them and each mints its own
strain; sharing one case was harmless only while both went nowhere.
`DiseaseEffect.Start`'s gate is reached through `base.Start` before
either records anything, so a **level-1 player cannot be turned** any
more than they can catch plague.

**AND THE PRICE THE TEMPLE CHARGES WAS ALREADY RIGHT** — which
corrects the Ledger row that opened this arc. That row said the
cure-disease count is short by one until a vampirism timer lands, and
that the arc "lands by filling one parameter". `GetDiseaseCount`
counts every bundle of type Disease, and an infection **is** one, so a
DFU-native infection was already counted the moment it existed.
`TimeToBecomeVampireOrWerebeast` is read from a classic `.SAV`
character record and is set by nothing else in DFU: its `+1` prices an
*imported* character who carries the timer without carrying the
effect. This port has no classic-save reader, so the parameter stays
false and the count is correct through the disease it already is.
`EndDisease` is the turn's last line, so a cure bought a minute before
the turn works and a minute after has nothing to cure.

**ONE HOME FOR THE TICK, ONE SEAM FOR THE HOSTS.** The lifecycle runs
in `worldTick`'s magic round beside the disease pass — the same
`DoMagicRound` over the same bundles in DFU — so every host that feeds
the tick gets the dream and the turn without a line in a frame body.
The three things only a host can supply (the video player, the clock
raise, the popup) arrive through `scenes/shared.js`'s
`wireInfectionVideos`, registered once per host boot in **all four**.
Unregistered, the null object still runs the lifecycle: a video that
cannot be played counts as watched, so a node test and a headless
probe both reach the turn.

**THE VIDEOS ARE REAL.** `ANIM0002.VID` (the lycanthropy dream) and
`ANIM0004.VID` (the vampire dream) joined the download diet under
`dataSource.js`'s own rule — *"wire a video, and the pin makes you
feed it"* — and the fake death reuses `ANIM0012.VID`, already there
for D1. All three play with `EndOnAnyKey` **false**, as DFU sets them:
they cannot be skipped.

**THE ONE-HOME GUARD EARNED ITS KEEP TWICE.** `DUSK_HOUR` and
`SECONDS_PER_WEEK` are both `DaggerfallDateTime` members, and both
already existed — in `world/worldClock.js` and `systems/quest/
machine.js`, neither of which ports `DaggerfallDateTime`. They now
live in `systems/gameDate.js`, which does, with re-exports left behind.

**PROBED LIVE** (`tools/infectionProbe.mjs`) in a real town at 22:00:
the level-1 character the probe boots is refused; at level 5 the bite
mints an entry the temple counts as one disease; one day later
`ANIM0004.VID` is fetched from the live diet and **decodes** (the
probe reads the player's own `played` result); on day 3 nothing has
happened; on day 4 the fake death plays and the turn lands a real clan
faction id read off region 17, with the disease count back to zero and
a following werewolf bite refused.

**FLAGGED, and it is the rest of the system (V2):** the racial
override itself — `VampirismEffect` and `LycanthropyEffect` on the
`RacialOverrideEffect` spine, the sun damage, the blood hunger, the
transformation, the cemetery respawn, the clan's spells, and the guild
swap `guilds.js` has carried `membershipsFor(store, hasVampirism)` for
since G1. The turn lands `entity.racialOverridePending`, which is
V2's producer and already bars a second infection.

**AND THE SAVE CARRIES BOTH HALVES.** The infection rides
`activeEffects` like any disease, region index included, because
`copyEffectEntry` spreads whole entries. But the moment it *deploys*
the disease is over and `racialOverridePending` is the only record
left — so a save between the turn and V2's racial override came back
human, and catchable. It is a named field in the envelope now, both
directions.

Pins: 16 in `infection.test.js`, plus the rewritten `OnMonsterHit`
row in `diseases.test.js`. 18 mutations, 18 dead.

## S39 / U44 - DRINK IT AND SOMETHING HAPPENS (2026-08-24)

`src/systems/potions.js` (the twenty recipes widened, plus
DrinkPotion's bundle) + `src/systems/effects.js` (the one effect with
no classic key) + `src/systems/useItem.js` + `src/ui/nativeInventory.js`
+ the four hosts. `test/potions.test.js` (+5),
`test/useitem.test.js` (+1), `test/nativeinventory.test.js` (+1).

**The game was lying.** `useItem`'s potion arm removed the bottle
from the pack and answered `pending`, and the window printed "You
drink the potion." over an entity nothing had touched. The map arm
did the same: removed the map, printed "You study the map.", revealed
nothing. Both had been that way for the whole of the item arc, and
both are the worst kind of gap - not a missing feature a player can
see is missing, but a claimed outcome that never happened.

**DrinkPotion, verbatim.** `EntityEffectManager.DrinkPotion`
(`:903-947`) builds an `EffectBundleSettings` of `BundleTypes.Potion`
and `TargetTypes.CasterOnly` whose effects are the recipe's primary
followed by its secondaries, and then assigns it with
`BypassSavingThrows | BypassChance`. The detail worth naming: all of
those effects share **one** `potionRecipe.Settings` struct (`:914-930`),
not a copy each - so purification's Heal-Health and Invisibility
inherit cureDisease's chance and magnitude rather than their own
defaults. A per-effect copy would look identical until someone read
the numbers.

**The data, and the two ways to get it wrong.** Every row was lifted
from the fifteen effect classes that call `new PotionRecipe(...)`:

- **The enum order.** `ElementalResistance` registers its four in the
  order Fire / Frost / **Shock** / **Poison** (`:142-145`), but the
  variant index is `DFCareer.Elements`, where DiseaseOrPoison is 2 and
  Shock is 3. So resistShock is `8,3` and resistPoison `8,2` - the
  two are crossed relative to the source order, and the pin names
  that specifically.
- **The field names.** DFU's `EffectSettings` and the classic record
  use different names for the same slots, and DFU's own converter
  (`EntityEffectBroker.cs:952-976`) is the mapping: `ChancePlus` is
  `chanceMod`, `MagnitudeBaseMin/Max` are `magnitudeBaseLow/High`, and
  `MagnitudePlusMin/Max` are `magnitudeLevelBase/LevelHigh`. A
  recipe's `settings` names only what differs from
  `DefaultEffectSettings`, which is all eleven fields at 1 - so
  orcStrength's explicitly-written `1, 1` base is *the default* and
  goes unnamed, while its `14, 14` plus does not.

**The one effect with no classic key.** `Heal-SpellPoints` is
registered PotionMaker-only, with no `MagicSkill` and no spell-book
description (`HealSpellPoints.cs:21-30`), and sets no `ClassicKey` at
all. No SPELLS.STD row can name it - which is precisely what
`effects.js:246-252` recorded when S15 undid an earlier mis-mapping of
`(10,9)` onto it, and why the sink list has read *"restoreMagicka
returns with potions"* ever since. It returns here. A potion bundle
is not a spell record: DFU builds one from `EffectEntry(effect.Key,
settings)` - a STRING key - and the classic pair is only how a
SPELLS.STD row reaches an effect. So this one travels under its DFU
key with `type: -1`, and the apply loop lets a keyed entry past the
sentinel that skips the reader's empty slots. Its magnitude carries
**no** multiplier where its fatigue sibling has the x64
(`HealSpellPoints.cs:62-64`).

**And the map.** `RecordLocationFromMap` (`:1819-1846`) is
`DiscoverRandomLocation`, then record 499 on success and `readMapFail`
when the region is exhausted - and `RemoveItem` sits OUTSIDE the
try/catch, so the map is spent either way. The reveal is the host's,
because only a host with a region index can walk one: `?world` has
`revealLocation`, already the seam behind the two guild map reveals,
and DFU's own note key for the item is `readMap`. `?town` and
`?dungeon` name the hook `null` on purpose rather than omitting it -
the construction sweep should see a decision - and the arm reads that
null and leaves the map unread rather than eating it for nothing.

Pins: 5 in `potions.test.js`, 1 each in `useitem.test.js` and
`nativeinventory.test.js`. 20 mutations, 20 dead. The first pass left
three alive, all the same shape: the HOST supplied a hook and nothing
checked that the WINDOW forwarded it into the law - which is silent,
because the arm then falls back to the very `pending` line this slice
removed.

FLAGGED: the potion's own message. DFU shows no box for a drink at
all - the effect speaks for itself - and the port's window still
prints its `pending` line for an unknown recipe, which is right, but
`USE_PENDING.potion` is now reachable only through a bottle whose
recipe key names nothing. The cast SOUND is DrinkPotion's
`GetCastSoundID(ElementTypes.Magic)`; DFU gates it on
`IsPlayerEntity`, and the port's engine is the player's, so the gate
is structural rather than written.

## S40 - A BED YOU CAN SLEEP IN (2026-08-25)

`src/systems/restSession.js` (CanRest, `restOpenGate`,
`interiorRestPlace`, CheckRent, the illegal-rest confirm) +
`src/ui/restWindow.js` (the gate on the buttons that own it, MoveToBed,
the IsResting lifecycle) + `src/scenes/shared.js`
(`restVitals`/`restFullyHealed`/`createRestDeps` - the rested hour, one
home) + `src/formats/mapsFile.js` (`isTownLocationType`) +
`src/systems/encounters.js` (`areEnemiesNearby`) + `src/player/motor.js`
(`startRestGroundedCheck`) + `src/systems/worldTick.js` (the
`!isResting` fatigue gate) + `src/scenes/townTalk.js` (`closeOverlay`)
+ `src/systems/settings.js` (IllegalRestWarning goes live) +
`src/systems/tavern.js` (a flag retired) + all four hosts.
`test/restlodging.test.js` (new, 51).

**Rest was a dungeon feature.** `toggleRest` existed in exactly one
host. Outside a dungeon the R key did nothing, so a character above
ground could not heal, could not pass an hour, and could not sleep off
a disease - and the tavern, which has sold rooms since U39, sold a bed
`tavern.js` itself described as "stored here and read by nobody". The
window and the session machine were both already built and correct.
What was missing was the arm that decides WHERE.

**`alreadyWarned` does not mean what it looks like.** `CanRest(bool
alreadyWarned)` (`:542-599`) returns `alreadyWarned` from its
in-town-outdoors branch, which reads like "the second press works".
It is not. The producer is `Settings.IllegalRestWarning`: with it on
(its shipped value) the WHILE and HEALED buttons raise a Yes/No box
**before** calling `CanRest` at all (`:645-657`, `:671-683`), and only
that Yes arm passes `true`. With it off, `DoRestForAWhile(false)` runs
straight into the refusal - so camping in a town is not merely
discouraged, it is **impossible**, and pressing R again changes
nothing. The first draft of this slice wrote the "second press rests"
reading into the source comment and the test; reading the two button
handlers is what corrected it.

What does not depend on the setting: `CrimeCommitted = Vagrancy` and
`SpawnCityGuards(true)` fire on **both** paths (`:559-561`). Being
turned away still puts the watch on the street. That is the quirk
worth keeping, and it is pinned on both branches.

**LOITER is not rest.** `LoiterButton_OnMouseClick` (`:693-706`) never
calls `CanRest` and never calls `MoveToBed`. Loitering three hours in
the middle of a city is free and legal. Only the two REST buttons
carry the gate, so the gate lives on them and not on the window's
open, which is where a "tidier" port would put it and would then have
made loitering a crime.

**The claim ladder, inside.** A building is somewhere the player may
sleep only through one of three claims, tested in DFU's order. First,
is the interior a **permanent scene** - the set the port built at P1
and which `rentRoom` has been naming since U39. If it is: a Ship or a
`DaggerfallBankManager.IsHouseOwned` house rests outright, and
otherwise the rental record decides, with the bed relinked **by
index** into `FindMarkers(Rest)` because "building positions are not
stable" (DFU's own comment - a terrain mod moves them). Second, guild
hall privileges - `GetGuild(factionID).CanRest()`, **excluding
taverns**, and that exclusion is load-bearing rather than cosmetic:
every tavern in the data carries the fighters-guild faction, so
without it one Fighters Guild membership sleeps free in every inn in
the Bay. Third, `haveNotRentedRoom`.

Two guards in the port's `canRest` are **ours** and are named as
deviations rather than smoothed over: DFU dereferences `room` without
a null check and indexes `restMarkers[bedIndex]` without a length
check, and would throw on a permanent scene with no rental or an
interior with no Rest marker. Neither shape is reachable in DFU's own
data - only `RentRoom` adds a non-owned permanent scene - so this is a
crash the port declines to reproduce, not a rule it bends.

**"In town" was wrong everywhere.** `PlayerGPS.IsPlayerInTown`
(`:504-527`) counts **seven** location types. The port's one
implementation read `locationType <= 2`, which is City / Hamlet /
Village and silently drops HomeFarms, HomeWealthy, the standalone
Tavern and ReligionTemple - and it never tested `mustBeOutside` at
all, so "in town, outdoors" was true while standing in a shop. That
predicate is not S40's: the quest machine reads it too
(`machine.cs:134`), and every rule keyed on it exempted those four
settlement types. The type list now has one home
(`isTownLocationType`), and the strict variant has one closure per
outdoor host that the quest bridge shares.

The two flags of `IsPlayerInTown` are also two different questions,
and CanRest asks both: `IsPlayerInTown(true, true)` for the camping
arm and the bare `IsPlayerInTown()` - type only, no rect, no inside
test - for the building arm. The interior host cannot answer the
second (it does not know the location), so it asks its outer host
through an `inTownLocation` seam, which both outdoor hosts supply.

**One home for the rested hour.** `TickRest`'s vitals half and
`IsPlayerFullyHealed` lived inside the dungeon host, privately,
because it was the only host that could rest. Three hosts needed them
the moment this slice landed, so they moved to `shared.js` as
`restVitals` / `restFullyHealed`, with `createRestDeps` composing the
five closures every host owes the window. The dungeon keeps its own
`advanceMinutes` - `IntermittentEnemySpawn`'s catch-up loop is a
dungeon law and belongs there. `CalculateHealthRecoveryRate`'s
`day`/`inside` flags are now LIVE outdoors rather than the fixed
`false, true` the dungeon hard-codes, which is the one place
RapidHealing InLight differs.

**THE REVIEW ROUND FOUND THE HALF THIS SLICE HAD SKIPPED.** Five
adversarial readers over the C# and the diff, each finding refuted by
default; four survived, and two were whole behaviours rather than
details.

**The OPEN GATE is scene-free.** `DaggerfallUI.cs:651-687` is the
`dfuiOpenRestWindow` handler, and three refusals stand between the
Rest action and the window ever being pushed: `AreEnemiesNearby(true)`
raises the enemy alert and shows TEXT.RSC 354; swimming or a failed
`StartRestGroundedCheck` shows 355; and then the prevented-rest /
offer / racial-override chain, which is FLAGGED. DFU raises all of it
from ONE message handler with no scene test at all. The port had it
written out inside `dungeonContext.toggleRest`, because that is where
rest lived - so the three hosts this slice gave a Rest key would have
let the player lie down with a foe at their back, swimming, or
mid-levitation. It is `restOpenGate` now, and all four hosts run it
before they build a window.

**`remainingHoursRented` was a dead output.** `CanRest` computes it
and the port carried it back and then read it nowhere. What that drops
is `CheckRent` (`:441-448`), run from `TickRest` every rested hour:
the rental counts DOWN, and the hour it reaches zero ends the rest -
with `EndRest`'s own first arm (`:480-486`), which outranks both "You
wake up." and "You are healed.", says "Your time for this room has
expired." (a STRING, `Internal_Strings :358`, with no TEXT.RSC record),
and calls `RemoveExpiredRentedRooms` as it prints. Two details are
easy to lose: `-1` returns BEFORE the decrement, so an unrented rest is
never billed; and DFU writes `finished |= CheckRent()`, so the
decrement runs even on the hour the mode itself finishes.

**"Is any guard alive" is not AreEnemiesNearby.** Both outdoor hosts'
first-draft `enemiesNearby` asked `cityGuards.activeCount() > 0`,
copied from this host's exhaustion arm. For exhaustion that is rough;
for rest it is a different rule, because guards persist until the
crime clears - one spawned across town would block sleep forever.
`GameManager.AreEnemiesNearby` (`:684-730`) walks the foes and, in its
RESTING form, SKIPS an unaware one past 12 units entirely. That is the
whole point of the flag, and it now has a home in `encounters.js` that
all three foe-bearing hosts read.

**AND A SECOND ROUND FOUND FIVE MORE**, of which the worst was a wire
this slice cut with its own hand. `createRestDeps` destructured a
CLOSED option list and returned a CLOSED literal, so the
`onRentExpired` closure the interior host handed it was dropped on the
floor and `RemoveExpiredRentedRooms` never ran - while the pin beside
it, which matched the SOURCE TEXT of the host, passed. That is the
whole lesson of the round: a wire is pinned by running current through
it, not by reading the label. The composition spreads what it does not
name now, and the pin builds its deps THROUGH `createRestDeps` and
drives a refusal end to end.

The same round retired the last of the dungeon's private
composition: it kept a second body of the five closures
`createRestDeps` produces, semantically identical today and free to
drift tomorrow. It reads the shared one now and keeps only
`advanceMinutes`.

**`grounded` is not StartRestGroundedCheck.** `PlayerMotor.cs:184-194`
returns true when grounded, and OTHERWISE casts a ray of
`height / 2 + 0.2` - DFU's own comment says why: "Collision fix for
when player is levitating but feet are 'close enough' to ground to
rest". The dungeon host had that ray written out and the three new
hosts passed the raw motor flag, so the same levitating character
could sleep below ground and was refused TEXT.RSC 355 in a shop, a
street and a field. It lives in `motor.js` beside the constant it
derives from.

**Two routing seams.** `AbortRestForEnemySpawn` reached the two slots
`worldModes` owns and not the OUTER host's, which is where an outdoor
rest window lives - and outdoors is exactly where a quest `CreateFoe`
wave lands beside a sleeping player. In DFU the subscription is on the
WINDOW (`OnPush :264`, `OnPop :275`), so it follows the window; the
comment claiming so was written before the third slot was routed.
And `worldModes.pointerdown` routed the large HUD's panels in EVERY
mode, `interiorKeyCtx` included, while `mode` starts at 'exterior' and
both outdoor hosts call it FIRST - so a REST panel click above ground
mounted the interior window into a slot the frame never draws. That
one predates S40 and was invisible only because `interiorKeyCtx` had
no `toggleRest` for `routeAction`'s `?.()` to find.

**And the review's last find was in the review's own work.** The
`restVitals` pin ran its fixture with `career: {}`, and with no
RapidHealing flag `CalculateHealthRecoveryRate` returns the same
number for all four `day`/`inside` combinations - so the pin that
existed to prove those flags reach the formula proved nothing, and a
mutant hardcoding them inside `restVitals`, or dropping them from
`createRestDeps`' `tickVitals`, passed. RapidHealing InLight is the
one place they differ (+100 instead of +60, and only outdoors by
daylight); InDarkness is its exact complement, so the pin asks both
and a swapped pair fails from either side.

**Six drifted C# citations and one vacuous assertion**, from the
citation lens - the failure mode this project has hit in every slice
that cites line numbers. `Update` is `:185-229` not `:183-227`;
`IsPlayerFullyHealed` is `:524-537`; the vitals half is `TickVitals`
at `:509-522`, not the `:229-299` that names no vitals code at all;
`ConfirmIllegalRestUntilHealed` is `:684-691`; CanRest's second arm
opens at `:563`; and the Vagrancy citation started one line AFTER the
line that registers the crime. The vacuous one is worth naming: the
pin that checks the Rest arm sits inside the ladder's guard compared
two `indexOf` results raw, so an arm hoisted ABOVE the guard would
give `-1` and pass - the exact escape it existed to catch.

**The citation sweep was the lesson, not the citations.** Round four
fixed drifted citations one string at a time and left a third copy of
the Vagrancy range in `world.js` untouched - which is exactly how this
failure mode survives a review. A MECHANICAL sweep over all 63 C#
citations in the slice (extract, resolve the file, print the real
lines, read them) then found two more that no reader would have
caught: a bare `(:655)` in three hosts, which means
`DaggerfallUI.cs:655` but resolves against those blocks' other
`DaggerfallRestWindow` numbers to `DoRestForAWhile(false)`; and a
PORT-INTERNAL citation, `dungeon.js (:385-396)`, which drift had
turned into the footsteps block. Both are now spelled out or named
rather than numbered. And the sweep, being diff-scoped, then missed five MORE in comment
blocks the slice never edited but now owns - a `WhileButton /
HealedButton (:641-690)` that opens on a blank line and closes inside
a third member, a `StopRestButton (:713-718)` that is the head of the
KEYBOARD handler while the mouse one is :708-712, the prompt clamp
cited at its parse GUARD (:745-748) instead of the clamp itself
(:749-752), and a second `Update (:183-227)` twin in dungeonContext.
The final check is content-addressed rather than eyeballed: 48
citations, each asserted to CONTAIN the member it names and to open
and close on a non-blank line. The lesson holds either way - one grep
per range beats one careful reader, and the grep has to cover whole
files, not just the diff.

**The entity flag nobody was writing.** `OnPush` raises
`playerEntity.IsResting` (`:266-268`) and DFU's own comment says what
for: "used for random enemy spawning and influences CastWhenHeld
durability loss". The port HAS that consumer - `enchantments.js` picks
`HELD_DEGRADE_RATE_RESTING` (60) over `HELD_DEGRADE_RATE` (4), a 15x
difference in how fast a held enchantment eats its item - and nothing
had ever fed it, because rest lived in the one host whose enchant ctx
is FLAGGED unmounted. `world.js` said so out loud: "isResting stays
absent above ground (no rest window here yet)". This slice put one
there, which made the sentence false and the gap reachable in the same
commit.

The flag is raised on OPEN, not on the first rested hour - standing in
the window deciding already costs a held enchantment - and cleared on
every one of the window's five exits plus `dispose()`, through a
single `_close()`. That door is the point: a flag raised on open and
cleared on four of five exits is worse than no flag, because it leaves
the player permanently "resting" and burning items 15x for the rest of
the session. `IsLoitering` rides the same lifecycle (`:789` / `:285`);
DFU has no consumer for it either, and it is carried so a later reader
finds it right rather than because anything reads it now.

**Three more from the same lens, and one of them is visible.**
`ShowStatus` (`:317-346`) picks a different NUMBER and a different
background per mode: hours PAST for FullRest, hours REMAINING for
TimedRest and Loiter. The port printed hours-past for all three, so a
timed rest counted UP on screen where classic counts DOWN. The
backgrounds stay FLAGGED pending art; the number is not a presentation
choice. Then the OnEncounter latch: it lived on the SESSION, which
does not exist while the player is still on the selection page, so a
quest `CreateFoe` wave landing in that window was lost - DFU sets the
flag on the WINDOW in `OnPush` and never resets it, so it fires on the
first `TickRest` after a mode IS picked. And `endEarly` hardcoded "You
wake up." for a FullRest, where `EndRest` picks
`IsPlayerFullyHealed() ? healed : wakeUp` at the moment it runs.

Three OnPop behaviours are FLAGGED rather than ported, each because it
belongs to another arc: `OnSleepEnd` (`:288-289`), whose one consumer
drains `itemsPendingReroll` - a set the port fills and drains INLINE
in the magic round, which S40's own `advanceMinutes` runs through the
sleep, so the same items reroll on the same clock at a different
moment; `UpdateNpcPresence` (`:277-280`), which the port has no
NPC-presence pass for at all; and `RaiseOnSleepTickEvent`, which has
no consumer in DFU's own tree either.

**And three from the window's LIFECYCLE rather than its laws, one of
them a level lost outright.** `RestFinishedPopup_OnClose` is
`PopToHUD(); RaiseSkills();` (`:728-732`) IN THAT ORDER, and the port
ran them the other way round. Every host guards its `onLevelUp` with
"only if the overlay slot is free" - and at the moment `RaiseSkills`
ran, the slot still held the finishing rest window. So a level crossed
during a long sleep never showed its screen: `advancement.js` took its
headless arm and dumped every attribute point into the LOWEST stats.
That is AUDIT 21 hosts F3's defect arriving by a second door, and the
fix is DFU's own order - the window vacates the slot first, through
the identity-guarded `onClose` idiom this port already uses, with
`townTalk` growing the `closeOverlay` door it never had.

Second: `RestWindow` had no `click`, and `townTalk.pointerdown` bails
on any overlay without one - after which both outdoor hosts fall
through to `requestLook` and grab pointer lock UNDER the open window,
spinning the camera behind the rest panel. The two modal hosts refuse
exactly that, and the seam they refuse through is the presence of the
method. It has one now, and it does what DFU's message boxes do.

Third: `worldModes`' interior seam ticked the window and never drained
`done` - the one seam of four without the drain, which the other three
carry and two call not optional in so many words. `RestWindow` sets
`done` from inside `tick()` on the death path, so that window stayed
painted over the world.

**And the flag had a third reader the slice talked itself out of.**
The comment S40 wrote beside `IsResting` said "its one consumer is
CastWhenHeld's degrade rate". There are three, and DFU's own comment
at `:266-267` already names two - "random enemy spawning AND
CastWhenHeld durability loss". The third is
`PlayerEntity.cs:417-418`: `if (!isResting) DecreaseFatigue(amount);`.
The port had no such gate, so it charged 66 fatigue an HOUR through
every rest - measured, not inferred. Worse for LOITER, which by DFU's
own law calls no `tickVitals` at all: nothing was restoring it, so a
long enough loiter walked the player toward exhaustion while they
stood about. The dungeon host was accidentally exempt, its rest
advance never routing through the ticker; the three hosts this slice
gave rest to were not.

The gate is narrow on purpose: the JUMPING drain is C#'s `:427`,
outside the per-minute block and ungated, and the Swimming tally at
`:414` runs BEFORE the gate. A false sentence in a comment is what
licensed the omission, which is the argument for the rule that
comments must be true stated about as plainly as it gets.

**The last lens ran its own mutations, and found nine.** Not against
the code - against the PINS. Every one was this slice's testing at
fault, and the pattern is the one that has recurred all the way
through: a pin that reads a thing instead of running it. The worst
was the interior host's place bag, pinned entirely by regexes over its
own source inside a closure - so flipping `insideBuilding` to false
there bypassed the whole lodging economy (every interior rests free,
no room, no bed, no rent countdown) with the full suite green. The bag
is a law in `restSession.js` now, `interiorRestPlace`, and the pin
runs it; the host reads the law instead of rebuilding the shape.

The other eight: `restVitals`' three `Math.min` clamps, exercised by
no fixture - and dropping them is not cosmetic, because
`restFullyHealed` uses `===`, so one point of overshoot makes the
equality unreachable and a Rest-Until-Healed NEVER TERMINATES;
`_isPlayerInTownStrict`, the input the whole camping-crime arm keys
on, unpinned in both outdoor hosts with an anti-regression guard that
was CASE-MISMATCHED (`locationType()` against the real
`_musicLocationType()`) and so could never fire; `exterior.js`'s foe
POOL unpinned, where the watch is the ONLY pool, so an empty one means
sleeping through a beating; the fatigue rate pinned only `> 0`, so any
constant passed; the loiter fixture typing 2 against a 3-hour cap,
leaving the refusal branch inert; the empty-entry no-op and the
2-digit/99-hour field cap with no test in the repo at all; the gate's
refusal MESSAGE pinned leaving `restOpenGate` and never arriving at a
host; and `areEnemiesNearby`'s `_dist ?? Infinity` fallback never
taken.

**And two last ones in the code.** All FOUR of `EndRest`'s arms
attach `OnClose` (`:461-462`, `:468-469`, `:482-483`, `:489-490`,
`:496-497`) - the DEATH arm included, since DFU's death path sets
`youNeverAwaken` and calls `EndRest`, whose box closes into
`PopToHUD(); RaiseSkills();`. The port skipped the raise on death and
on a missing endLines, so a poison that killed the sleeper cost a
whole night's advancement as well as the life. The death screen still
owns the MESSAGE - that deviation is named and stands - but not the
raise. And `CanRest`'s refusal (`:594-596`) is the ONE
EndRest-adjacent path DFU leaves without an `OnClose`, so it must stay
silent; the pin holds the pair apart.

Second: the dungeon was the one host of four without the PopToHUD
door the previous round gave the other three. Three of four is how
this rule keeps being broken, and it is why the rule is written down.

**And the sub-tick was ported at half its purpose.** `TickRest`
`:376-379` is two calls inside one sub-tick - `RaiseTime` and then
`QuestMachine.Instance.Tick()` - and DFU's own comment two lines above
says the ten-minute granularity exists FOR the second one: "This
allows quest machine to have more time resolution while still counting
off rest in hourly increments." The port took the clock half and left
the quest half, and every host gates its ordinary `questBridge.tick`
on "no overlay up" - so a rested night ran ZERO quest ticks. That is
precisely the shape AUDIT 24 wave 30 found for the MAGIC-ROUND half of
the same freeze and fixed only there. It is the session's law, not a
host's: DFU calls the machine directly, bypassing
`QuestMachine.Update`'s real-time pacing, so the port calls the
unpaced door too.

**And the hours prompt was the port's law, not DFU's.** Both prompts
prefill the field with `"0"` (`:619`, `:700`) and cap it at EIGHT
characters (`:621`, `:702`). So Enter on an untouched prompt parses
and starts a 0-hour rest, and the unparseable no-op is reachable only
once the player has EMPTIED the field. The port started the field
empty at two digits and its comment called that "the 99-hour cap by
construction" - which was wrong twice over: it made DFU's actual
99-hour arm (TEXT.RSC 26, `:753-757`) unreachable, and it would have
let a 100-hour rest through the day anyone widened the field. Both are
DFU's now.

**And the PopToHUD fix introduced a crash of its own.** `RestWindow`
became the first window in this port that clears the host's overlay
slot from INSIDE its own `input()` - and every host drain re-reads
that slot afterwards and dereferenced it unguarded
(`activeOverlay.done`, `overlay.done`). So the very key that closes
the rest window threw a TypeError in three of the four hosts. It was
reproduced before being fixed, all five drains are optional-chained
now, and it is pinned both by driving the shape and by asserting no
unguarded drain is left anywhere in the tree - because the next window
that closes itself will find the same seam.

The same hazard sits one step further on in `worldModes`, which ticks,
drains and then DRAWS: a tick that cleared the slot left
`else if (_shopFont) interiorOverlay.draw(...)` reading null, so dying
mid-rest inside a building crashed the frame loop. That seam captures
the window for the tick and the drain and then paints whatever is in
the slot NOW - which covers an emptied slot and a handed-on one at
once, with no branch a test cannot reach.

**THE MERGE, and the one gap porting the quest tick opened.** Three
lanes shipped this in a day - V5, U48 and S40 - and the reconciliation
kept the union rather than a winner; the Port-Ledger row lists it
law by law. What is worth recording HERE is the gap that only existed
after the merge. `TickRest` checks `uiManager.TopWindow != this`
TWICE: once before the sub-tick (`:362-365`) and again after it
(`:397-400`), with its own comment saying why - "Checking for second
time as quest tick above can perfectly align with rest ending". The
second check is about the quest tick, which this merge finally ported,
so it became reachable in the same change.

DFU PAUSES the rest and resumes it. A single overlay slot cannot
stack, so the port cannot pause - the incoming window REPLACES the
rest, and that is FLAGGED as the approximation it is. What it must not
do is replace it SILENTLY: `_close()` would never run, `IsResting`
would stay raised for the rest of the session, and with it gone would
go every per-minute fatigue drain while held enchantments ate their
items at 60 a round instead of 4. `mountInterior` disposes what it
replaces now - the shape `townTalk.showOverlay` has always had - and
the quest box goes through it rather than assigning the slot raw.

FLAGGED, the other half of the same C#: `TickRest` also re-checks
`GameManager.GetPreventedRestMessage()` TWICE mid-rest - once before
the sub-tick (`:357-360`) and again at the hour boundary (`:409-412`)
- and each returns true, ending the rest with that message. The port
asks the registry only at the OPEN gate (`restDecision`), so something
that STARTS preventing rest while the player sleeps does not wake
them: they sleep through to the mode's own finish line. No lane had
this. It needs a `preventedMessage()` dep on the session and a feed
from each host, so it is named here rather than smuggled in.

Pins: 52 in `restlodging.test.js`, two of them END TO END - every law
in this slice driven together through one host-shaped deps bag, from
the key press to the wake. That is the closest thing to a live probe a
machine with no ARENA2 data can run, and it is here because a slice
whose parts each pass and whose whole was never run is exactly what a
probe catches. 106 mutations, 106 dead. The first
pass left four alive and all four were the same failure of nerve: a
pin that named a thing instead of exercising it. The host pins matched
`act === 'Rest'`, which survives `if (false && act === 'Rest')`, so
they now match the whole guard including its body; the bed-index range
was pinned at 9-of-4 and not at 4-of-4, so `<` and `<=` were
indistinguishable; and `restFullyHealed` was only ever asked about a
character with everything full, so dropping the fatigue clause changed
no answer. The town-type set is pinned against the seven names and the
nine non-towns, and both outdoor hosts are pinned to read the law
rather than a literal.

**The clock had one caller.** `RestWindow`'s per-frame method was
`tickRest`, and `dungeonContext.tickOverlay` was the only thing in the
tree that called it - because the dungeon was the only host that could
open the window. Every host drives `tick(dt)` on whatever is in its
overlay slot (`townTalk.frame:572` for the two outdoor hosts,
`worldModes:2502` for the interior one), so the moment rest reached
them their windows would have sat on "Hours passed: 0" until Escape.
That is the same defect AUDIT D-C1 records for the interior death
sequence and the dungeon's own `tickOverlay` comment records for the
rest clock's earlier home - a clock wired to one seam in a
four-seam tree. `tick` is now the method, `tickRest` an alias, and the
dungeon's special case is gone because calling both would rest at
double speed.

**MoveToBed is two statements, not one.** `:601-609` sets
`transform.position` and then calls `FixStanding(0.4f, 0.4f)`. The
first draft here wrote the spawn and dropped the snap, which is
exactly the failure the dungeon host's start-marker comment already
records - a marker in tight geometry leaves the capsule inside the
collider and the player wedges, feet reading below the marker while
the numbers jitter and net travel stays zero. `floorLanding` is this
port's FixStanding; the bed goes through it like every other marker
landing in the tree.

**U45 arrived mid-merge, and it fits.** The two outdoor hosts' key
ladders became `hudCtx` while this slice was in flight - one object
the ladder AND the large HUD's eleven panels both read, so a click on
the bar and a press of the bound key reach the same door. The Rest
arm moved into it, which means the large HUD's rest panel
(`hudLarge.js:152`, `action: 'Rest'`) now has a destination in every
host: it had been posting an action nothing above ground answered.
`routeAction`'s own `case 'Rest': ctx.toggleRest?.()` already carried
the interior host.

FLAGGED: `DaggerfallBankManager.IsHouseOwned` reads DFU's default for
a player who has bought nothing, because the bank's house ledger is
unported - so the owned-house arm is correct and unreachable until the
bank slice buys one. The **live probe** for this slice is owed with
U41/U42's: no ARENA2 data on this machine, so the rented-room round
trip (rent a room, walk out, walk back, sleep in the bed the rental
minted) has been driven only in node.

## S41 - THE DAY CHANGE HAD NO HOME (2026-08-25)

`src/systems/worldTick.js` (`runDayChange`, and the call from
`tickPlayerMinutes` that gives it to all four hosts) +
`src/systems/shopStock.js` (`updateRegionalPrices`, `REGION_COUNT`,
the two clamp bounds, a flag retired) + `src/systems/weatherSim.js`
(`rollClimateWeathersForDay`, `tickWeather` rebuilt as the drain,
`_lastDay` deleted) + `src/systems/save.js` (the restore stamp moved
into `restoreWeather`, and `lastGameMinutes` re-anchored) +
`src/scenes/world.js` + `src/scenes/exterior.js` (comments only - the
mechanism under them changed). `test/daychange.test.js` (new, 19);
`test/weathersim.test.js` grew one.

**Four members, and the port ran one of them.** DFU's
`PlayerEntity.Update` closes each frame with a date check
(`:441-450`):

    uint lastDay = lastGameMinutes / 1440;
    uint currentDay = gameMinutes / 1440;
    int daysPast = (int)(currentDay - lastDay);
    if (daysPast > 0)
    {
        FormulaHelper.UpdateRegionalPrices(ref regionData, daysPast);
        WeatherManager.SetClimateWeathers();
        WeatherManager.UpdateWeatherFromClimateArray = true;
        RemoveExpiredRentedRooms();
        LoanChecker.CheckOverdueLoans(lastGameMinutes);
    }

Three of those four were already in the port as correct, tested laws.
None of them had a caller on a day boundary. That is the shape this
slice is about: the bug was not in any member, it was in the absence
of the block that runs them.

**`CheckOverdueLoans` had no caller anywhere in `src/`.** Not a wrong
one - none. `grep` found the export, `banking.test.js`, and nothing
else. So every line of B1's loan law worked and none of it could ever
fire: borrow, the 10% that rides from the instant of the loan, the
6/3/1-month reminder crossings, `OverdueLoan`'s account raid, the
`LoanDefault` reputation hit. A character could borrow the maximum in
all sixty-two regions and never owe a thing, because nothing in the
game advanced a loan toward its due date. This is the second time a
whole ported subsystem has been found with the wiring missing rather
than the law, and both times the unit tests were green - a test
proves the member, and only a caller proves the game has it.

**Every shop price in the world was frozen at its boot roll.**
`UpdateRegionalPrices` (`FormulaHelper.cs:2053-2089`) was not ported
at all. `regionPriceAdjustment` rolled 750..1250 once per region and
that number then stood for the life of the character: a region that
rolled 780 sold at 78% forever and one that rolled 1240 at 124%, and
no amount of play could move either. The merchants' faction power -
the whole point of the formula - had no consumer in the port. The
walk is mean-reverting and the sign is the part worth reading twice:

    chance = (merchantsPower - regionPower) / 5
             + 50 - (adjustment - 1000) / 25

A HIGH adjustment lowers `chance`, and `chance` is the probability of
the 51/50 RISE, so an expensive region gets likelier to fall the
more expensive it is. At the 4000 ceiling `chance` is -70 and the
region falls on every step no matter what the dice say. Both
divisions can go negative and both are C# integer division, so both
are `Math.trunc`; `Math.floor` is wrong in each, and the pins prove
it at the exact roll value that separates them rather than at a
convenient one.

**Two markers for one day change is one marker too many.** The
weather member had been ported - `tickWeather` - with its own private
`_lastDay` and its own `daysPast > 0` guard, fused to the apply and
called from the exterior frame. That is not where DFU splits it.
`PlayerEntity` ROLLS the six zones and raises
`updateWeatherFromClimateArray`; `WeatherManager.Update` DRAINS that
flag (`:146-156` -> `:406-415`) and returns early while the player is
inside. The roll runs wherever the player is; only the apply waits
for daylight. Fused and hung off an exterior frame, the port rolled
the zones ZERO times for any day boundary crossed underground: ten
days in a dungeon came back out to one catch-up roll where DFU had
rolled ten. Splitting it also removed the marker: the day is
`PlayerEntity.lastGameMinutes`' business now, and that marker
re-anchors on restore (`SerializablePlayer.cs:339`), which is a
better version of the day stamp `restoreWeather` used to take.

**The rented-room sweep is the merge's deferred finding, shipped.**
The three-lane rest merge found `RemoveExpiredRentedRooms` missing
from the day change in all three lanes and wrote it down rather than
folding it in, because it belongs to the world tick's day boundary
and not to rest. It ran in exactly two places - a tavern window
opening, and a rest ENDING on an already-expired room - so a rental
that ran out while the player was asleep in a dungeon was never
collected, and its interior stayed a permanent scene for the rest of
the session.

**Nothing had to be threaded from a host.** Every input the block
needs is already on the entity: `rentedRooms`, `bankAccounts`,
`regionPrices`, `factionRep`, `sceneCache`. So `runDayChange` takes
the entity and the two clock values `tickPlayerMinutes` already has
in scope, and all four hosts get the law without a line of host code
- which is the whole point, because the FOUR HOSTS RULE exists
because a line a host has to remember is a line a host forgets.

**The block sits after the fatigue band, and that is not cosmetic.**
DFU draws the swimming roll at `:412` and the first price roll at
`:446`. The port's tick had already reordered the normalize loop
ahead of the fatigue band (those two share no generator, so it is
free), but a day block placed before the swim roll would shift every
draw after it. There is a pin that watches which caller gets which
value out of a scripted two-element sequence.

**The gate could not be pinned on the thing it gates.** The first
draft tested `daysPast > 0` by asserting the prices had not moved on
a same-day tick - and `updateRegionalPrices` returns immediately at
`times = 0`, so relaxing the gate to `>= 0` changed nothing
observable and the mutation lived. The room sweep takes no day count,
so it is the member that can tell the two apart; the pin moved onto
it. 19 mutations, 19 killed.

**And a marker the restore never re-anchored.** `SerializablePlayer`
sets `entity.LastGameMinutes` to the restored world time on every load
(`:338-339`), which is precisely why the field is not in the save
envelope - and `worldTick.js` has cited that line as the reason since
AUDIT 23, while the line itself was never ported. So the marker just
carried over from whatever the session was doing before the load. That
was survivable when the only reader was the reputation-normalise loop.
It stopped being survivable the moment this slice hung the day block
off the same gap: a load into a session sitting behind the save's
clock would have drifted a year of prices and re-run a loan check over
months the saved game had already played through. One line, ported.
This is the second time in this file a comment has been found citing a
C# line the port does not contain, and both times the comment read as
proof that the work was done.

**And the re-entrancy this slice made reachable.** DFU crosses a
calendar boundary exactly once because it cannot do otherwise:
`PlayerEntity.cs:368-371` THROWS when `gameMinutes < lastGameMinutes`,
so the marker can never end a frame ahead of the clock. Its exhaustion
collapse is a bare `RaiseTime(1 * SecondsPerHour)` (`:2429`) that
returns; `Update` is not re-entered.

The port's hosts implement that same RaiseTime as
`playerTicker.advance(60)` (`exterior.js:721`, `world.js:627`), fired
from inside `sinks.drainFatigue` - so it re-enters `tickPlayerMinutes`
from inside that function's own fatigue band. The nested tick wrote the
marker an hour ahead, the outer frame's own `setWorldMinutes` then
reset the world clock BELOW it, and the next frame pulled the marker
back down - so the same midnight was crossed, and processed, TWICE.
Measured: one collapse at 23:30 drifted the region price 1000 -> 980 ->
960 for a single day change, rolled the six climate zones twice, and
ran the room sweep and the loan check twice each.

Nothing was exposed to this before S41. The only reader of that marker
was the 112-day reputation-normalise loop, where a repeat is invisible,
and the one day-change law the port did have - the weather roll -
carried its own monotonic module marker, which is exactly the
`_lastDay` this slice deleted. Hanging all four members off the shared
marker is what turned a latent host quirk into four wrong laws.

The marker is monotonic now. That is DFU's invariant restated, not a
liberty: DFU asserts it with a throw, and the port cannot, because it
has a caller DFU does not. The genuine backward move - a load - does
not come through here at all, because `save.js` re-anchors explicitly.
FOUND AND NOT FIXED, because it is the host's and not this slice's: the
outer frame's write-back also DISCARDS the collapse's hour, so the port
recovers the vitals of a rested hour without spending it.

**And one ordering inversion against the C#.** DFU runs the day block
(`:441-450`) and THEN the per-minute normalise loop (`:453-477`); the
port had that loop hoisted to the top of `tickPlayerMinutes`. It costs
the roll stream nothing - neither the loop nor `normalizeReputations`
draws - which is why it had never mattered. It is not free for STATE:
the day block's loan arm calls `LowerRepForCrime`
(`LoanChecker.cs:70`), so DFU lands the fresh -10 legal hit and decays
it by one in the same tick, while the hoisted order decayed an old
value first and applied the hit after. Same inversion on the faction
channel the People half writes. Every 112-day boundary IS a day
boundary (161280 = 112 x 1440), so this needed no coincidence beyond a
loan coming due that day.

The loop moved below the day block, and the
`preventNormalizingReputations` clear came down with it - the loop
READS that flag and DFU clears it at the tail (`:528-530`), so moving
one without the other would have left the prison-skip shield reading an
already-cleared flag and dying silently.

Pins: `test/daychange.test.js` (21) covers each member against its
C# and, separately, the wiring - a year-long jump through
`tickPlayerMinutes` that drifts the prices, collects an expired
rental and defaults a loan in one tick.

FLAGGED: `UpdateRegionalPrices` also drives the `PricesHigh` /
`PricesLow` region CONDITION FLAGS (`FormulaHelper.cs:2075-2087`).
The port has no `RegionDataFlags` store at all - the whole
`RegionPowerAndConditionsUpdate` arc (`PlayerEntity.cs:1626-2115`) is
unported and nothing reads those flags - so writing them here would
be a store with no reader; they come with that arc. Recorded, not
flagged: DFU fills all 62 price adjustments at `StartGameBehaviour`
and this walk therefore draws no init rolls, while the port's lazy
`regionPriceAdjustment` materialises stragglers on the first drift of
a session - the same distribution, a different position in the
stream. And the **live probe** is owed with S40/U41/U42's: no ARENA2
data on this machine, so a year of game time has been driven only in
node.

## M-EXT / M-FM / M-TEX - THE ASSET INJECTION ARC (2026-08-25)

The whole arc came out of a request to hear better music, and the
useful part is where it refused to go.

**THE LINE, FIRST, BECAUSE EVERY SLICE HERE SITS ON IT.** Daggerfall's
game data is freeware and not redistributable; `scenes/dataSource.js`
has said so since it was written, and the picker says it to every
player. The same is true, more strongly, of a third party's remake
pack. So nothing in this arc bundles audio or art: the player points at
their own folder and it is stored in their own browser. "Open source"
does not change that - a licence covers the code its author wrote, not
music they did not, which is why Daggerfall Unity is MIT and still
makes every user supply their own game files. The architecture already
knew this; the arc only had to not break it.

**THE PATTERN, ESTABLISHED ONCE AND REUSED TWICE.** DFU's
`Utility/AssetInjection` layer reads loose files from
`StreamingAssets`, gated on `Settings.AssetInjection`, and asks for a
replacement BEFORE it reaches its own data. `systems/musicReplacement.js`
ports that shape - index by name, check the gate INSIDE the lookup,
answer bytes or nothing, let the caller read nothing as "use the
classic" - and `systems/textureReplacement.js` is deliberately the same
shape one domain over. A second domain that invented its own would be a
second thing to learn and a second thing to get wrong.

**THE SETUP WIN CAME FROM READING DFU'S NAMING, NOT INVENTING ONE.**
`SoundReplacement` asks for `song.ToString()` over a `SongFiles` enum
whose members are `song_` + the archive record, lowercased; texture
names come from `GetName` as `{archive:000}_{record}-{frame}`. So a
pack built for Daggerfall Unity is ALREADY named correctly for this
port. Accepting those forms turned "hand-rename a hundred files" into
"point at the folder you downloaded" - the single largest usability
change in the arc, and it cost one regex once the source was read.
The `song_` strip is safe because the archive says so: an ARENA2-gated
corpus pin walks all 131 records and proves none begins with `SONG_`,
because a record that did would point its replacement at a DIFFERENT
song and the failure would be a wrong track playing, which no unit
fixture can notice.

**THE TWO DOMAINS DIVERGE ON ONE THING, AND IT IS THE INTERESTING
ONE.** Music can commit and arrive late: `playSong` returns true, the
decode lands a beat later, and a song is a continuous thing. A texture
cannot - `uploadRecord` is synchronous and runs off the draw path, so a
late arrival is a visible pop or a missing wall. Textures therefore
decode AHEAD, in `getTexture()`, where there is already an await and
the result is already cached per archive, and before the archive is
published or a draw could beat them. Same law, different physics.

**THREE FINDINGS THE WORK TURNED UP THAT WERE NOT THE WORK.**

`Audio/AlternateMusic` reached nothing. Every FM playlist had been
ported since A5 with its DFU quirks intact, `outdoorPlaylist` and
`playlistFor` branched on `fm`, `SongManager` took it, and
`createMusicDirector` accepted and forwarded it - while all three hosts
called it with no arguments. The read went into the factory, not the
call sites: three call sites are three chances to forget and one read
is none.

The settings screen's two input paths disagreed. `onYes` is the house
idiom five other windows use, and the MOUSE path honoured it while the
KEYBOARD path had no branch for it. Nothing set it on a settings dialog
until this arc, so it was latent - the first dialog to carry an action
would have worked on click and done nothing on Enter.

And a false green, which is the one to remember. Pinning a tool's label
map meant importing it from a test, and the tool did its work at the
top level and called `process.exit` - so the import KILLED THE RUNNER
after the first test. The file reported `# tests 1 / # fail 0` and
looked healthy while ten of its eleven tests never ran. Neither the
manifest guard nor the pass line could catch that: both count tests in
the SOURCE, not tests that executed. The only signal was the total.
Any module with top-level side effects can truncate the suite, and
green means nothing while one is being imported.

STILL OUT: `WorldDataReplacement` (JSON regions, locations, blocks,
buildings), and the `.dfmod` bridge. A `.dfmod` is a Unity AssetBundle -
binary, Unity-version-locked, holding serialized Unity objects and
often compiled C# - so running one is out permanently and always was;
what is reachable is an OFFLINE unpacker that turns an asset-only mod
into loose files this layer already reads. Not attempted yet for one
reason worth recording: there is no `.dfmod` on this machine to test
against, and a binary parser written against a remembered spec and
shipped unverified is the exact shape this project's pins exist to
prevent.

## S42 - THE REGION CONDITION STORE (2026-08-25)

`src/systems/regionConditions.js` (new: the flags enum, the group map,
both duration tables, `turnOnConditionFlag` / `turnOffConditionFlag`,
`resetWarDataForRegion`, the store and its save halves) +
`src/systems/shopStock.js` (S41's flagged half ships; `REGION_COUNT`
moves to its one home) + `src/systems/worldTick.js` (the store rides
the day block) + `src/systems/save.js` (the envelope).
`test/regionconditions.test.js` (new, 13).

**A store two shipped writers were already waiting on.** S41 ported
`FormulaHelper.UpdateRegionalPrices` and had to FLAG its
PricesHigh/PricesLow half with a plain reason: the port had no
`RegionDataFlags` store at all, so writing those flags would have been
a store with no reader. The whole `RegionPowerAndConditionsUpdate` arc
(`PlayerEntity.cs:1626-2115`) has the same dependency - a war, a
famine, a plague or a crime wave has nowhere to land without it. This
slice builds the store and closes S41's flag; the arc itself is next.

**One record, split three ways, and that is recorded.** DFU's
`RegionDataRecord` (`:1575-1585`) carries `LegalRep` and
`PriceAdjustment` alongside the condition arrays. The port already has
both, in their own homes and with their own shipped laws - `court.js`
owns `player.legalRep[region]`, `shopStock.js` owns
`entity.regionPrices[region]`. Folding them in here would rewrite two
working systems for a field-layout parity no behaviour depends on, so
this module owns the CONDITION half and the other two keep theirs. The
three together are DFU's record, and the split is written down rather
than left for the next reader to discover.

**THE THREE WIDTHS DISAGREE.** This is the part worth reading twice:

    the enum          30 members (0..29)
    Values / Flags    29 wide    (:2194, :2199)
    valuesMin / Max   26 wide    (:2142-2143)
    Flags2            14 wide    (:2203)

So `Condition29` has no `Values` or `Flags` slot, `Condition26..29`
have no duration entry, and `TurnOnConditionFlag` on any of them would
read past two arrays and throw in C#. The group-clear loop's `i < 29`
(`:2148`) tracks the FLAGS width rather than the enum's, so it never
touches index 29 either. All of it is unreachable, because nothing in
DFU sets those four - and the port keeps every width exactly as it
found it. A tidied width is a different program, and the next reader
who "fixes" one of these needs the C# in front of them, not a comment
saying the arrays agree.

**The group gate is the mechanism, not a guard.** `TurnOnConditionFlag`
clears the other flags in a group only `if (Flags2[group])` (`:2146`) -
the GROUP flag, not the flag being set. That is what lets
`WarBeginning` replace `WarOngoing` without either knowing the other
exists: one region, one war state. It also has a consequence worth
pinning rather than smoothing, because `TurnOffConditionFlag` clears
the whole group: turn one condition off and its siblings stay LIT while
the group reads unlit, so the next `turnOn` finds the gate down and
does not clear them. DFU's shape, and observable.

**S41's flag is retired, and the boundaries are inclusive.** The three
price arms land now (`FormulaHelper.cs:2075-2087`), with the asymmetry
DFU has: the normal band clears BOTH flags on every single step, while
the two extremes only ever light their own. Both band boundaries
survived their first mutation round because every fixture straddled
them - 4000, 1000 and 250 say nothing about 2000 and 500 themselves.
The shipped pins land exactly ON the edge: 2041 falls to exactly 2000,
491 rises to exactly 500.

Pins: `test/regionconditions.test.js` (13). 15 mutations, 15 killed;
the first round left the two boundary mutations alive and both are
covered now. Every one of the 16 C# citations was checked by opening
the range and confirming it contains the member named - four were wrong
on the first pass and are corrected.

FLAGGED: this is the store, not the simulation. Nothing yet WRITES a
war, famine, plague, witch burning or crime wave into it - that is
`RegionPowerAndConditionsUpdate` itself, which also needs
`PersistentFactionData`'s alliance mutators
(`GetNumberOfCommonAlliesAndEnemies`, `EndFactionAllies` and their
siblings), none of which the port has. `InitializeRegionData`'s twelve
bootstrap update passes (`:2214-2217`) are deliberately absent for the
same reason: they call the member this slice does not port.

## S43 - THE FACTION POWERS START MOVING (2026-08-25)

`src/systems/regionPower.js` (new: `isFactionValidForRumorMill`,
`factionPowerStep`, `regionPowerUpdate`) + `src/systems/worldTick.js`
(the 7-day and 38-day arms of the entity update's minute loop) +
`src/scenes/world.js` (the rumour mill parked on the entity).
`test/regionpower.test.js` (new, 10).

**Nothing in the port had ever changed a faction's power.** Every
faction sat at its FACTION.TXT value for the life of the character.
That is not a cosmetic gap: S41's `UpdateRegionalPrices` tilts a
region's prices by The Merchants' power against that region's own
Province faction, so its entire tug-of-war term - the reason the
formula exists - was a constant. The merchants could never gain ground
on anybody, and no region's economy could drift for any reason but its
own dice.

**And `RefreshRumorMill` had no caller either.** It is the member's
first line (`:1630`), it drops rumours past their `timeLimit`, and
`grep` found it in `rumorMill.js` and `rumormill.test.js` and nowhere
else in `src/`. That is the third law this month found ported, tested
and unreachable - after `CheckOverdueLoans` and the day block itself.
The mill is parked on the entity now (`playerEntity.rumorMill`), the
way `sceneCache` and `bankAccounts` already are, which is what lets the
tick reach it without a line of host wiring.

**The walk.** For every Province, Group or Subgroup that is not one of
DFU's thirteen exclusions:

    chance = parentPower/10 + alliesPower/10 + rulerPowerBonus
             - enemiesPower/10

A FAILED roll costs a point of power, a passed one gains it, and then -
separately - a faction any of whose CHILDREN outrank it gains one more.
Three details that are easy to lose, and all three needed a pin that
could actually see them:

  - the `parent != 0` gate is a REAL gate. Dropping it survives a
    dictionary with no faction 0, because the lookup misses and
    contributes 0 either way; it only stops being equivalent when
    something IS keyed at 0. The pin puts a faction there.
  - the parent lookup at `:1664` discards its success flag - no `if` -
    so a parent id the dictionary does not hold yields C#'s zero struct
    and a mod of 0, rather than skipping the term.
  - the children comparison reads `power` AFTER the roll has landed,
    and it is STRICTLY greater. A child exactly level with the
    post-roll power earns nothing, which every fixture but the last one
    straddled.

**The two cadences, and the minute they collide.** DFU calls this
member from two arms of the same loop: `:462` every 7 days with
`updateConditions` false, and `:469` every 38 days with it true - and
the true call runs the power half TOO. So the powers move on both
cadences, and on the 266-day minute divisible by both (lcm(10080,
54720) = 383040) two separate `if`s each call a member that always
walks the powers, so it fires twice. Reproduced, and pinned.

DFU's own note on that second arm is worth keeping: classic ran the
conditions version only when BOTH intervals aligned - every 266 days -
and DFU says "I'm pretty sure it was supposed to be every 38 days" and
changed it. A DFU deviation from classic, inherited deliberately
because this port is 1:1 with DFU and DFU says why.

Pins: `test/regionpower.test.js` (10). 15 mutations, 15 killed - the
first round left the parent gate and the children comparison alive.
All 12 C# citations content-verified; six were wrong on the first pass.

FLAGGED: the CONDITIONS half of this member is still unported - the war
state machine, famine, plague, persecuted temple, crime wave, witch
burnings and the new-ruler roll. It needs `PersistentFactionData`'s
alliance mutators (`GetNumberOfCommonAlliesAndEnemies`,
`EndFactionAllies`, `EndFactionRivalries` and siblings), none of which
the port has, and it writes into S42's store. `StartRacialOverrideQuest`
rides the same two arms and is unported with it, as is
`InitializeRegionData`'s twelve-pass bootstrap.

## S44 - THE FACTION RELATION MUTATORS (2026-08-25)

`src/systems/factionRelations.js` (new: the border table, the four
relation questions, the four mutators, the war predicate, the two ruler
members) + `src/scenes/world.js` (a stub retired).
`test/factionrelations.test.js` (new, 14).

**The set S43 had to flag.** `RegionPowerAndConditionsUpdate`'s
conditions body ends and starts alliances and rivalries and decides who
may go to war with whom, entirely through
`PersistentFactionData.cs:530-880`. Twelve of those fourteen members had
no port at all. This slice is them, and nothing else - the state machine
that calls them is still to come.

**A stub retired on the way.** `isFaction2RelatedToFaction1` has been a
hook in `world.js` answering a hardcoded `false` since the talk arc
(`// the faction-relation walk rides TK-v`), so `answerPipeline`'s
faction-relation gate could never fire once. The real member is here and
the hook calls it. That is the fourth law this session found ported or
declared and then unreachable, after `CheckOverdueLoans`,
`RefreshRumorMill` and the day block.

**THE ZERO QUIRK.** `GetNumberOfCommonAlliesAndEnemies` compares three
ally slots against three, and three enemy slots against three, with no
`!= 0` guard - and an empty slot is 0. So two factions with no allies
and no enemies at all score EIGHTEEN, not zero. It is not a rounding
detail: the count feeds `(powerSum + count * 3) / 5 + 70` in the
alliance-ending roll, so eighteen moves that chance about ten points
against nothing. DFU counts them; the port counts them.

DFU's own comment on that member is worth keeping too - classic compared
faction2's allies against faction1's ALLIES' allies, DFU calls that
"contradictory" and rewrote it as the plainer shared-count. The port
takes DFU's version, because DFU's version is what the game runs.

**The border table was not typed.** 62 rows of 11 - 682 bytes - pulled
out of the C# by a script and then diffed against it cell for cell. A
table with one wrong cell is worse than no table, and 682 hand-typed
bytes is exactly where a wrong cell hides. Its padding zeros compare
like any other entry, so region 0 reads as a neighbour of every
short-rowed region; pinned as the quirk it is rather than guarded away.

**The struct write-back is load-bearing in one reachable case.** C#
reads two struct COPIES, mutates them, and writes both back. The port's
dictionary holds OBJECTS, so an in-place mutation would differ in
exactly one place: `id1 === id2`, where C# has two independent copies
and the second write-back clobbers the first. `startFactionAllies(d, 1,
2, 1)` sets `ally3` on one copy and `ally1` on the other, and C# keeps
only `ally1`. Reproduced with a copy-and-write-back helper, and pinned.

**Two pins that could not see their own law.** `SetNewRulerData`'s bonus
was asserted as `>= 20 && <= 70`, which cannot see the `+ 20` go missing
because 0..50 lands inside it; and its name seed was compared against
another run of itself, which cannot see the two `rand()` draws swap.
Both mutations survived the first round. They are pinned to exact values
off a seeded DFRandom now.

Pins: `test/factionrelations.test.js` (14). 15 mutations, 14 killed and
one RECORDED EQUIVALENT rather than waved through: the shared-ancestor
arm's two `id !=` guards only ever block a case the ancestor and
descendant arms have already answered, because reaching that state needs
a walk step that returns 1 or 3 first. Ported because it is in the C#,
and the argument is written into the test beside it. All 14 citations
content-verified, clean on the first pass.

FLAGGED: still no caller. These are the conditions body's tools and the
conditions body is not ported - the war state machine, famine, plague,
persecuted temple, crime wave, witch burnings and the new-ruler roll.
`setNewRulerData`, `setRulerType`, the four mutators and the war
predicate are exercised by their pins and by nothing in `src/` yet,
which is a gap this arc closes in its next slice and not a defect to be
discovered later.

## AUDIO AUDIT - the music "just seemed off", and it was (2026-08-25)

Reported by ear, confirmed by measurement, and all three findings were
in the VOICE BANK rather than the data path. That distinction is the
first useful thing the audit produced: `hmiFile.js` decodes MIDI.BSA
byte-exactly and `songManager.js` carries DFU's tables verbatim, so
nothing here is a parity bug against DFU - the bank is Ledger A, ours,
and it was ours that was wrong.

**THE DRUM MAP STOPPED AT NOTE 51.** `percussionSpec` resolves by
NEAREST NEIGHBOUR, so every key above the table's last entry answered
as the ride cymbal. In isolation the table looked reasonable; against
the real archive it was catastrophic, because **Daggerfall's percussion
is hand drums and bells, not a rock kit** - tambourine 3,364 hits,
jingle bell 2,561, congas 3,874, claves 919, agogo 650, every one of
them above 51. Twenty-five of the thirty drum notes in use, over 14,000
hits, played one wash of cymbal. The entire rhythm section of the
soundtrack was a monotone.

Only real data could show this, which is why the measurement is kept as
an ARENA2-gated pin rather than thrown away: the archive's own notes
must land on as many distinct sounds as there are notes.

`drop` came out of the same fix and is not merely a longer list. The
tone path ramps pitch down over the decay, and a falling pitch is what
makes a drum read as a drum - it is also what stops a triangle,
cowbell, claves or agogo reading as itself. Struck metal and wood hold
pitch; skinned hand drums fall a little; the kit keeps the full octave
it always had.

**ARTICULATION BEATS FAMILY.** `fmSpec` resolves a voice with
`program >> 3`, which is a fair base - GM groups mostly by timbre - but
it collapses pairs whose articulation is opposite, and articulation is
what the ear names an instrument by. A harp and a timpani both sat in
`strings` and came out BOWED: one is plucked and rings, the other is
struck and thuds, and neither is bowed. Eight programs the archive
actually plays now override their family, and only where the family is
wrong about HOW the note is made rather than merely about its colour.

**THE SUSTAIN PEDAL WAS DROPPED ENTIRELY** - 593 CC64 events - and it
is the ONLY ignored controller that changes what is heard. CC123 and
CC121 matter to a MIDI device that must be told to stop; this scheduler
cannot hang a note, because an HMI note-on carries its own duration and
the voice is given an explicit stop time. The pedal is computed from
the whole event list rather than a live flag, because a note scheduled
now may need to ring past the end of the lookahead window.

**TWO MUTANTS PROVED THE FIX HAD DEAD CODE.**
`Math.max(durationTicks, up - startTick)` can never pick its first
argument: the guard `end < up` already means the second is larger. It
was removed rather than left looking like a safeguard, and the
never-shortens pin was re-aimed at the case that actually reaches the
decision - the first draft used a note so long it returned early and
proved nothing. A third mutant showed every pedal fixture was made of
CC64 events, so none of them could tell whether the controller number
was checked at all; the archive sends 60,920 CC7s and 54,851 CC10s, and
without that check every one of them would press the pedal.

**CLEARED WITH EVIDENCE**, recorded so nobody re-chases them: zero
tempo meta events across all 131 songs, so the constant
`secondsPerTick` and the comment claiming it are both honest; CC105's
2,572 events are exactly 1,286 ones and 1,286 zeros against an archive
of 1,286 tracks, making it a per-track HMI marker rather than music;
no RPN 0,0 anywhere, so the hardcoded two-semitone bend range is right;
and CC10 does reach a real StereoPanner.

STILL OUT, and honestly the ceiling on all of this: oscillators are the
least good-sounding answer available, kept because they ship nothing
and ask for nothing. The bank stays behind `voiceSpec` and
`percussionSpec` precisely so an SF2 or sample set replaces it without
touching the scheduler - and now that M-EXT exists, a player-supplied
soundfont is the obvious next slice.

## V2a - THE LYCANTHROPY CURSE: the racial override V1 was ramping into (2026-08-27)

V1 ended at `entity.racialOverridePending` and said so; V2a consumes
it. `systems/lycanthropy.js` is `LycanthropyEffect.cs` + `MorphSelf.cs`
whole, on the shape V1 established: the curse is an activeEffects
ENTRY (kind `racialOverride`) rather than a class instance, so the
save envelope carries its whole CustomSaveData_v1 state for free and
the marker `entity.racialOverride` is REBUILT from the entry on
restore, never trusted from the envelope.

THE TURN COMPLETES IN ITS OWN ROUND. worldTick's one pump runs
infection -> consume -> fold, so the round that deploys the pending
marker ends with the curse live: CureAll ends the old life's effects,
the disease gate and infectionAccepted read the marker (a lycanthrope
catches nothing, for ever), and the free spell lands - SPELLS.STD
record 92, the '!' stripped, tag 'lycanthrope', custom:true. THE U42
SEAM MEETS ITS PRODUCER: the spellbook's free-cast and delete-refusal
laws have keyed on that tag since U42 with nothing minting it - the
exact `{enchanted: true}` no-producer shape AUDIT 17e recorded - and
the pin now drives the real spell through the shipped window laws.
The tag pair's HOME moved to the producer (the window re-exports).

THE MOONS ARE REAL NOW. `gameDate.js` grew DFU's `GetLunarPhase`
verbatim - the 32-day ratio over (dayOfYear + year*360 + offset),
Massar 3 / Secunda -1, the band ladder in the source's own order
(ratio 16 is New only because the == tests run first) - and EITHER
moon full forces the change through `MorphSelf(force)` with the dream
line. That also un-FLAGs the enchantment ctx's moonPhase seam's data
half. Two fixture lessons are recorded in the test: year-0 dates are
NEGATIVE classic minutes (the epoch is year 397), and day 0 of year 0
is a secunda full moon - the first fixture transformed its own test
subject a round early and the failure was the law working.

THE ADVANTAGES RIDE THE LIVE CHANNELS: +40 Str/Agi/End/Spd and +30 on
the seven skills as the entry's own maps, re-applied every round
exactly as the constant pass does, read by ONE added arm each in
liveStat and skillValue. MinMetalToHit is iron untransformed, silver
in beast form - ordered AFTER the forced change inside the round so
silver never lags the moon by a round (DFU's per-frame constant pass
has no such lag to avoid). The urge: a classic month without an
innocent's blood and the health ceiling falls 24/day to the floor of
4, blood clamped down at the fold's cadence (recorded; DFU clamps
continuously through CurrentMaxHealth); a dead civilian or
Knight_CityWatch resets satiation; the Ring of Hircine
(SpecialArtifactEffect param 3, either ring slot) masters the moon,
the urge and the once-a-day gate alike. The cure: morph back, full
RAW heal, RaiseTime(60) pinned as ONE MINUTE - sixty seconds, the
unit a hasty read would multiply by sixty - and the tagged spells go.

MORPH SELF GOES LIVE - the last inert catalog row, closed by building
the consumer it was durable for. The arm rides applySpellToPlayer's
ctx in the ONE cast engine; THE FOUR HOSTS: world, exterior and the
dungeon context hand their clocks to createPlayerMagic, and worldModes
BORROWS the outer host's engine by construction - all four named in
the pin.

FLAGGED, each loudly: VampirismEffect (V2b - a vampirism pending
stands unconsumed); the host-facing suppressions (inventory/talk/
crime/population while transformed), the werecreature claws, sounds
and the WOLF00I0/WERE0*I0 art; the $CUREWER quest; the cemetery
respawn; PassiveSpecials and the artifact payloads.

Pins: 12 in `test/lycanthropy.test.js`, the walk from the moons to the
save round-trip, every figure DFU's own constant.

## V2b - THE VAMPIRISM CURSE: the other override, and the gates go live (2026-08-27)

`VampirismEffect.cs` on V2a's exact shape - the curse as an
activeEffects entry, the marker rebuilt on restore, the advantages
through the same one-arm channels. The vampire's asymmetries are the
slice's spine, each pinned against the werewolf's: +20 on SEVEN stats
(Willpower, Personality and Luck join; Intelligence belongs to the
Anthotis alone), +30 on six skills with Swimming pointedly absent,
silver-to-be-hit and paralysis immunity ALWAYS - there is no
untransformed vampire - and FEEDING IS FIGHTING: OnWeaponHitEntity's
whole body is UpdateSatiation, no innocence test, where the werewolf
must hunt the innocent.

THE HOOK IS REGISTERED, NOT IMPORTED. OnWeaponHitEntity lands at
combat/formulas' one-home tail (where OnMonsterHit and the Strikes
payloads already ride), but formulas cannot import the curses - they
import effects.js, which imports formulas' own dice100 - so the tail
calls a registered hook and worldTick, which every host loads,
registers it. The setEnchantmentHooks precedent, one module over.

THE GATES WENT LIVE ACROSS THE HOSTS. restDecision's
racialOverrideBlocks parameter - shipped dead in S40 - now feeds from
racialRestBlock in ALL FOUR hosts, and the blocked arm SPEAKS (the
unfed vampire's TEXT.RSC 36 box; the S40 sweep that pinned the silent
return advances with it). CheckFastTravel lands where DFU calls it -
the travel map's own door (DaggerfallUI.cs:625) - and the arrival
clamp's sunAverse parameter, wired dead since the F-slice with its
comment promising "vampirism rides its arc", is finally live: a
sun-damaged override arrives at dusk.

THE CLANS ARE REAL: eight spell tables (the base Levitate/Charm
Mortal/Calm Humanoid plus each clan's own, Selenu's three resists to
Montalion's Recall), granted under the 'vampire' tag the spellbook
has honored since U42, and the cure stamps PreviousVampireClan - the
clan outlives the curse, as DFU's reputations expect.

FLAGGED, each loudly: the sun/holy DAMAGE itself (PassiveSpecials
needs the IsPlayerInSunlight seam - V2c, and the entry already
carries sunDamage/holyDamage for it), the quests, the guild swap, the
cemetery respawn, the art and voices, the artifact payloads.

Pins: 9 in `test/vampirism.test.js`; the S40 rest sweeps and the
round-order sweep advance.

## V2c - PASSIVE SPECIALS + THE SUNLIGHT SEAM: one key, three doors (2026-08-27)

`PassiveSpecialsEffect.cs` whole, in `systems/passiveSpecials.js`, and
the two PlayerEnterExit flags it and the E1 enchant arms had been
idling on. The laws are small and verbatim: IsPlayerInSunlight =
IsDay && !IsPlayerInside && !InPrison (:371 - no weather term);
IsPlayerInHolyPlace = a Temple-type building or the Fighter Trainers'
faction 849 (:1424-1431, DFU's own quirky pair); regen 1 per 4th
round by RegenerationFlags (Always / InDarkness = night-or-dungeon /
InLight / InWater = the motor's swimming flag); 12 sun and 12 holy
damage per 4th round off the career bit OR the racial override's
compound-race flag; Light/Darkness Powered Magery writing -33% of
RawMaxMagicka or the -10000000 unable constant.

THE SEAM IS REGISTERED BY THE MODE MACHINE. worldModes owns mode and
interiorBuilding for BOTH town pages - world.js and exterior.js each
build it at boot - so the one registration there answers all three
modes, routed by LIVE mode (the death-presenter lesson). The dungeon
context registers its own on build and RESTORES the displaced host in
destroy() - setPassiveSpecialsHost answers the previous registration
for exactly this - so a town dungeon hands the seam back at the door.
inPrison stays an absent member: the port serves a sentence as a
clock move (arrestFlow), never as a live scene.

THE MODIFIER IS A SUM, AND RAW IS READ WITH THE MODIFIER ZEROED.
ChangeMaxMagickaModifier accumulates from every producer; the port
has two - the enchant fold's ExtraSpellPts and this magery pass - so
the pass runs in worldTick's round AFTER the fold and writes
`_enchantMods.maxMagicka + magery` into the one field
defineLiveMaxMagicka reads. RawMaxMagicka is never recovered by
subtracting the modifier back out: the accessor FLOORS at 0 and a
plain headless maxMagicka is not modifier-inclusive, so the pass
zeroes the modifier for the read (the pin that fails on the
subtraction shape is the enchant-fold SUM).

THE E1 RESIDUE TRIPLE CLOSED AT THE ONE MOUNT. world.js's enchant ctx
now answers inSunlight/inHolyPlace off this seam and moonPhase(param)
off V2a's lunar law - ExtraSpellPts' IsFullMoon/IsHalfMoon/IsNewMoon,
either moon, half counting both wax and wane - so RegensHealth,
ItemDeteriorates, UserTakesDamage and the moon-conditioned
ExtraSpellPts arms are live.

FLAGGED, each loudly: the transformed suppressions/claws/sounds/art
both curses' hosts owe, the quests, the guild swap, the cemetery
respawn, the artifact payloads; the dungeon host's enchant ctx mount.

Pins: 11 in `test/passivespecials.test.js` - the two flags through
the seam, the career reads off parseCareerData's own bitfields, all
four regen flags, both burns (career arm and override arm), the
magery SUM and the unable write's stability on the live accessor, the
vampire burning through runMagicRoundsFor, and the four-hosts sweep.

## V2d - THE CURSE QUESTS: the starts, the pool, and the cure that sweeps (2026-08-27)

The three quests the V-arc had been carrying as flags - $CUREWER,
$CUREVAM and the vampire initiation P0A01L00 whose
hasStartedInitialVampireQuest latch V2b minted dead - all start now,
on DFU's own clock. `systems/racialQuests.js` is
PlayerEntity.StartRacialOverrideQuest (:540-545) plus each curse's
StartQuest override, and the cadence is the ENTITY UPDATE's minute
walk, not the magic round: every 38 days (54720 - the same minute the
region-conditions update fires on, which is why the call rides beside
regionPowerUpdate; the "unported" sentence that stood there is gone)
the non-cure roll, every 84 days (120960, the walk's new fourth arm)
the cure roll.

THE ROLLS ARE EACH CURSE'S OWN, kept odd where DFU is odd: the
werewolf rolls (1,100)<30 for $CUREWER and NEVER starts a second
instance (FindQuests first - and FindQuests counts TOMBSTONED
instances, the C# default both call sites take); the vampire's cure
roll is (10,100)<30 - the 10 floor is DFU's own line - with no
re-offer check at all; the vampire's non-cure arm starts P0A01L00 on
its first 50% hit and latches hasStartedInitialVampireQuest ON THE
CURSE ENTRY (so it rides the save for free), then serves the clan's
own line from the guild pool: GetGuildQuest(Vampires, Member,
clanFactionId, rep, LEVEL) - the clan IS the faction id (the
VAMPIRE_CLANS values are 150-158) and the player's level sits in the
rank seat, DFU's own call. The vendored pack has carried all 21
Vampires-group sources since Q4; QuestList-Classic routes them.

THE MACHINE IS HOST-OWNED, so the module is a leaf with a registered
host (the passiveSpecials shape, setRacialQuestHost answering the
displaced host): world.js registers it beside its createQuestBridge
mount with the machine's own doors - startQuestByName,
startQuestImmediate, the quests map filtered two ways (FindQuests
keeps tombstones, the P0 sweep walks active only, GetAllActiveQuests'
law), and the clan pool read.

AND THE CURES CLOSE THE LOOP, both ways. CureVampirism tombstones
EVERY active P0* quest - the whole clan line leaves with the curse,
while $CUREVAM ends itself - and CureLycanthropy tombstones every
$CUREWER; both sweeps ride the cure functions' own tails.
CurePcDisease's `cure vampirism` / `cure lycanthropy` arms - parsed
and pinned since Q3, wired to nothing - now reach the real cures
through the bridge ctx (endVampirism/endLycanthropy), with the
RaiseTime(60) minute as the bare clock move. A cure bought from the
quest is finally a cure.

FLAGGED, each loudly: the transformed suppressions/claws/sounds/art
(host work), the cemetery respawn, the guild swap, the artifact
payloads.

Pins: 7 in `test/racialquests.test.js` - the headless charter, both
curses' rolls with the odd floor pinned to its verbatim range, the
latch, the clan-pool ask shape, the no-second-$CUREWER law against a
tombstoned instance, both tombstone sweeps off the real cures, the
two cadence arms driven through the REAL tickPlayerMinutes across
their boundaries (and not between them), and the world host's mount
laws.

## V2e - THE GUILD-BOOK SWAP + THE CEMETERY: the store adopted, the grave dug (2026-08-27)

Two host halves of the vampire, one slice. THE STORE WAS ALREADY
BUILT - AUDIT 21 F9 shipped newMembershipStore/membershipsFor with
"retrofitting a second book later would mean touching every call
site" written on it - and this slice touched every call site:
guilds.js's new activeMemberships is GuildManager.Memberships
(:109-112) verbatim, the ACTIVE book picked PER READ by the player's
live vampirism (never a swap-on-transition, so effect state and book
cannot desync; the vampirism test is the marker read itself, because
importing the curse module would be a cycle). worldModes' seven
sites, world.js's three, breath.js's deep-breath read and
npcSession's dep all route through it; a vampire's join lands in the
vampire book, the mortal ranks hide rather than vanish, and the cure
reads them back. The SAVE carries both books deep-copied
(GetMembershipData(bool vampire), :313-320), a pre-V2e plain-object
snap restores as the plain book it was, and activeMemberships
migrates a legacy book IN PLACE as the mortal book - so an old save
with a live curse cannot read the wrong one.

AND THE NEW VAMPIRE WAKES AT A GRAVE. DeployFullBlownVampirism's
transfer (:164-175) rides a new transferToCemetery member on the
infection host, called between the clock raise and the "death is not
eternal" popup - DFU's own order. The pick is pure law in
infection.js (GetRandomCemetery :194-217: the region mapTable's
dungeonType-18 rows, one picked uniformly; null-never-throw where DFU
throws on a cemeteryless region). The ARM is the world host's alone -
the same single-location reality that makes travel's V world-host
only - implemented over the same pixel teleport fast travel takes,
with _lastEncMinutes stamped for the PreventEnemySpawns parity
("intentionally not spawning enemies, for this time the PLAYER is the
monster"). worldModes' infection re-registration FORWARDS the outer
host's arm rather than dropping it - the re-registration shadowing
that V2c's death-presenter lesson predicted. RECORDED DIVERGENCE:
DFU's RespawnPlayer lands the player INSIDE the crypt; the port has
no door-less dungeon entry, so the vampire wakes at the cemetery's
exterior with the crypt door in front of them, and interior/dungeon
modes skip loudly where DFU tears the scene down.

FLAGGED, each loudly: the transformed suppressions/claws/sounds/
paperdoll+head art (host work), the artifact payloads.

Pins: 7 in `test/guildswap.test.js` - the per-read pick across curse
and cure with both books persisting, the in-place legacy migration,
the save round-trip with copy-isolation proven by mutation, both
clear laws, the cemetery pick's boundaries, the deploy's
raise-transfer-popup order with the werewolf's quiet deploy beside
it, and the host wiring greppable including the re-registration
forward.

## V3 - THE DAEDRIC ARTIFACT PAYLOADS: nine classes, one row (2026-08-27)

The last enchantment type the dispatcher answered with the
unknown-key abort. `systems/artifactEffects.js` is the nine
Effects/Special/* classes as a sub-registry keyed by the
enchantment's PARAM - the artifact subtype, exactly how
GetCombinedEnchantmentSettings keys a Special row - mounted as ONE
registry row (type 26) whose hooks route by param; a subtype with no
class (Volendrung and the rest carry ordinary enchantments only)
idles rather than aborting, which is stock DFU's own behavior for a
missing class.

THE LAWS, each verbatim: Azura's Star releases its soul on Use (TEXT
32, or 20 for an empty Star) and - the HELD half - takes EVERY slain
monster's soul while equipped, at both host death sites through
fillEmptyTrap's azurasStarOnly arm X5 built (always successful while
the Star is empty, class enemies excluded - the EnemyMonster gate).
The Masque of Clavicus adds LivePersonality/5 to every social group's
reaction mod each round, riding the same array the fold clears. The
Razor deals the target's WHOLE health behind a failed magic save and
pays the same in condition. The Mace of Molag Bal drains magicka up
to the strike's damage with any overflow above the wielder's max
RAISING max (the increase folds into mods.maxMagicka, so it sums with
ExtraSpellPts and V2c's magery through the one modifier), takes 1d6
strength from a dry target, and resets both twelve game minutes after
the last strike - its state an activeEffects entry (kind 'artifact')
the save carries free and liveStat reads through one added arm
(RECORDED: DFU also moves the strength MAX; the port clamps at 100).
The Oghma Infinium sets both level flags, opens the sheet, and is
consumed; advancement's new oghma arm grants the fixed 30-point pool
with NO Level++ and no health raise, both flags clearing together.
The Wabbajack rerolls a struck creature from its own seventeen-entry
table, never the same type, once per creature, through the world
host's replaceFoe door - the old foe leaves through removeFoe, the
new type spawns at its feet with the damage carried over, and a live
quest foe is left alone. The Ring of Namira reflects an enemy's
strike on the player by the attacker's TEAM (the six animal teams
nothing, Daedra half, Undead double, the rest full; the ring pays the
reflection in condition), dispatched where DFU dispatches it -
CalculateAttackDamage's tail - through a second registered hook
beside the racial one. The Rose and the Skull gate on an enemy inside
12 and speak the fail line; their ALLIED summon door
(spawnAlliedFoe) is FLAGGED unmounted - the port has no ally/team
combat - so the arm idles loudly until the team system exists.

AND THE ENUM WENT HOME. ENCHANTMENT_TYPES is FallExe's
(ItemsFile.cs:111-141); it moved to formats/magicDef.js - the file
that reads the records carrying it - with enchantments.js
re-exporting, because the artifact registry sits under the
enchantment system in the graph and importing the enum through its
consumer would close a cycle.

Pins: 9 in `test/artifacts.test.js`, every one through the REAL
dispatcher or the real hook site - the abort's end proven by a known
row running PAST a Special row, the Star's release pair and both
death-site reads, the Masque's sweep, the Razor both sides of the
save, the Mace's drain/overflow/strength/decay walk with the fold
sum, the Oghma end to end into applyLevelUp, both summons' gates with
the unmounted door pinned ABSENT, the Wabbajack's forced reroll and
latch with the world door's three laws, and Namira's four team arms
plus the no-ring null.

## V4 - THE BEAST IN TOWN: the transformed host laws (2026-08-27)

LycanthropyEffect's transformed members, the host half the curse had
been running without. The gates are lycanthropy.js's - the
racialRestBlock shape, { text } or null, live only while
isTransformed - and the two refusal lines are Internal_Strings
380/381 READ VERBATIM from the sparse clone, widened to
Assets/Localization for the purpose: "You cannot access the inventory
while shapechanged..." (the ellipsis is the string's own) and "You
get no response."

WHERE EACH LANDS: talk at townTalk's B7 one-window-opener, so the
mobile path, the static-NPC click and the guild TALK button all
refuse at once; inventory at world/exterior's toggleInventory and
INSIDE the dungeon's openInventory, loot included. CRIME through a
new court.js setCrimeCommitted - PlayerEntity.CrimeCommitted's own
setter (:2345-2355), which every scene write now routes through
(talk.js's pickpocket write gates inline: court imports talk, so the
one setter would close a cycle). POPULATION through a suppressSpawns
gate on TownPopulation's PROMOTE arm alone (PopulationManager
:174-191): pending walkers hold, the ones already out keep walking -
the streets empty around the beast, DFU's own shape.

AND THE CLAWS ARE REAL. The Werecreature rig - WEAPON11.CIF, the
animation set, the unarmed machine - had shipped with the FPS weapon
work and nothing ever selected it; the rig's per-frame worn-weapon
sync now consults racialFpsWeapon and binds the WERECLAWS_ITEM marker
the moment of the morph, whatever the hand slot holds: silent draw
(DrawWeaponSound None), SwingHighPitch, hand-to-hand rules. The
attack VOICES ride beside the player grunt at all three hit sites:
10% the attack cry ELSE 20% the bark - two separate Dice100 rolls,
strain-keyed (werewolf 144/143, wereboar 159/158).

FLAGGED, each loudly: the transformed paperdoll body and the vampire
art/voices, the 4-20s real-time move-sound loop, the allied-spawn
door.

Pins: 6 in `test/beastform.test.js` - the gates' transformed-only
walk through the REAL morph and cure, the crime setter both sides
with every scene write proven routed, the promote-arm hold, the claws
end to end (marker -> type -> swing sound -> rig consult -> silent
draw), the voice's two-separate-rolls law with both strains and all
four clip ids, and the door sweep.

## V5 - THE FACE OF THE CURSE: the art laws and the vampire's voice (2026-08-27)

Both curses' remaining art members, and the V-arc closes against
Effects/Special/*. The three art laws ride vampirism.js as ONE switch
(it already imports lycanthropy, and DFU's consumers ask the one
racial override): racialOverrideHeadArt - the wolf and boar heads
(WERE01I0/WERE00I0) transformed only, and the vampire's clanless
VAMP00I0.CIF face ALWAYS, females records 0-7 and males 8-15 keyed by
BirthRaceTemplate.ID - 1 (entity.race stays the birth race; the curse
only ever overrode the NAME); racialPaperDollBackground - the beast's
full-body art transformed, the vampire's crypt SCBG08I0 whatever the
location context, all under the one 8,7,110x184 sub-rect law the
SCBGs share; racialSuppressPaperDollBodyAndItems - the transformed
panel is the background ALONE (PaperDollRenderer:165 skips cloaks,
body, head and items wholesale, and the click mask empties with
them).

THE CONSUMERS ORDER THE OVERRIDE FIRST, as DFU does at all three of
its sites: paperDoll's compose picks the override background, skips
the suppressed layers, and blits the vampire head over the racial
one (the override art rides its own small cache beside the
identity-keyed set - a morph flips it mid-session); hudLarge's head
loader runs the override before headArchiveFor, and the head's
identity KEY carries the override string, so the morph and the cure
swap the face on the next frame - DFU's null-and-re-read, spelled as
a key change. The retiring hudLarge flag had named this exact hook
since the C-slice.

AND THE VAMPIRE SPEAKS. GetCustomRaceGenderAttackSoundData rides
INSIDE playerAttackGrunt's clip pick, at GetRaceGenderAttackSound's
own slot (DaggerfallEntity:979-988): the 20% fire chance stays the
caller's, the override picks the CLIP - 20% the bark else the attack
cry, by gender (199/200 female, 205/206 male), never silence once it
fires. The werewolf's voices stay V4's OnWeaponHitEntity pair, which
is DFU's own asymmetry.

FLAGGED: the 4-20s real-time move-sound loop while transformed (the
one remaining LycanthropyEffect member), the allied-spawn door.

Pins: 4 in `test/curseart.test.js` - the head switch across morph and
cure with the birth-race law pinned against the name override, the
background/suppression walk for all three states, the voice's
always-a-clip law with the verbatim ids and the fire/pick split, and
the three consumers' override-first order.

## H4 - THE PICTURE OF THE HOUSE: the purchase preview goes live (2026-08-27)

The last piece of the bank purchase flow, and the ledger's own
recommended-next row. DaggerfallBankPurchasePopUp's 104x91 display
panel renders the selected building's own ARCH3D model, rotating one
NEGATIVE degree per 0.02 seconds of real time (:68, :163-178) - and
now the port's does too, split along the seam the two halves already
suggested: the WINDOW owns the rotation clock (a real-time
accumulator in tick(dt), so any frame pacing spins at DFU's rate) and
the camera law (Display3dModelSelection :245 - houses from (0,3,-20),
near 0.7 far 100, Unity's default 60-degree lens; the ships arm's
(0,12,shipCameraDist) pairs now sit in banking.js beside the model
ids they pair with, for the day a ships list exists), and the HOST
owns the GL: worldModes' drawBankModelPreview is the automap's
second-beginFrame precedent cut down to a panel - scissor BEFORE
beginFrame so its CLEAR touches only the display rect, viewport AFTER
it (beginFrame sets the full one), the ONE mirror on the projection
(mat4's law - this pass culls), the model spun by the window's yaw
through trs, the mesh through the pipeline's own async getGpuMesh
(the panel stays empty for the frames the load takes - DFU's own
first-frame gap), and the clear color borrowed and returned.

SelectNone shows an empty panel, exactly as DFU starts (:298); the
result box is never painted over; the rect travels in CANVAS pixels
because that is the scissor's frame. Fog and lighting overrides
self-heal - every mode's frame body re-sets both before its own
beginFrame. RECORDED: DFU climate-swaps the preview's textures and
lights with a 0.4 directional + hard shadows; the port draws the base
textures under the collapsed-ambient idiom the automap records.

Pins: 4 in `test/bankpreview.test.js` - the popup's own constants
with the ship pairs, the negative-degree clock across mixed frame
pacing (values off the 0.02 boundary: the accumulator is float math),
the window's gate-and-order laws, and the host pass's bracket order
with both states restored.

## G7b - THE PRINCE ON FILM: the summoning videos (2026-08-27)

The board's item two, and G7's recorded residue. A successful
summoning now plays the prince's own .FLC - sixteen films, one per
Daedra, the names the DAEDRA table has carried since G7 - through
`ui/daedraSummonedWindow.js`, which is DaggerfallDaedraSummonedWindow
whole: the film fullscreen at 320x200 and LOOPING (FLCPlayer.Loop's
default - the reader is F1's FlcFile and F2a's FlcPlayer, built for
the chargen constellations and reused untouched), the quest offer
read over the bottom in FOUR-LINE chunks (TextLinesPerChunk 4 - DFU
steps tokens by eight, the port flattens to lines first and steps
four; one law, two spellings, recorded), a click or any key turning
the page, and the LAST chunk answering to Yes/No alone.

THE WINDOW IS PRESENTATION; THE MACHINE IS REAL. It consumes the
offer flow's own STEP ({ kind:'offer', prompt, respond }) - the same
machinery the ServiceFlowWindow boxes wrap - so Yes runs
startQuestImmediate and the accept message, No runs the rumor and
topic sweeps and the refusal, and the answer's message reads through
the same chunks before the last click closes (one close, however
many keys land on the tail). The refusal ALSO owes 3-5 daedra at
8..64 units (:86-87, the window's own spawn, distinct from the quest
popup's 1-3): that rides a spawnRefusalFoes door FLAGGED unmounted -
the interior foe pool's standing gap, the same seam the coven
failure records.

THE HOST MOUNTS ONE CONSUMER of the step: worldModes fetches the
film on a successful summons and mounts the window when the FLC
reads; an unreadable or unfetchable film falls back to the box chain
- never traps, and never two respond() paths for one offer. The FLC
texture rides the chargen release-then-upload law and the drain's
bare dispose() releases the last frame.

Pins: 5 in `test/daedrasummonwindow.test.js` - the token pairing,
the chunk walk with the last-offer-page click doing NOTHING (DFU
waits on Yes/No), Yes through the real respond with paging-not-
re-responding pinned past the answer, No's flagged spawn and the
empty-popup immediate close, and the sixteen distinct films with the
host's one-consumer order and fallback greps.

## CR1 - THE COURT GUILD RESCUES (2026-08-28)

The arm court.js's header FLAGGED to the guilds arc since the court
shipped: DaggerfallCourtWindow.cs:177-221. After the penalty math and
BEFORE the plead box, a member's guild may intervene - assault or
murder (crimeType 3/4) through the Dark Brotherhood (faction 108),
a thieving crime (crimeType <=2 or 11, pickpocketing) through the
Thieves Guild (faction 42). The gate is `guild.Rank >=
Random.Range(0, 20)` - an ENGINE-PRNG injectable roll drawn ONLY for
a member, because C#'s IsMember() stands outside the Range call and
the port keeps that stream discipline (pinned: a non-member consumes
nothing). The rescued exit is the acquittal's own trio (:191-193):
FillVitalSigns, RaiseReputationForDoingSentence, release - a rescued
player never pleads. The release box carries TEXT.RSC 550 (courtTextTG)
or 551 (courtTextDB) through the court macro pass.

`guildRescue` is pure in systems/court.js; arrestFlow's default
`guildRankOf` is the same guildOfFaction/membershipOf read the quest
world's getGuild makes, over townTalk's faction tree - so the arms go
live the day the Thieves Guild or Dark Brotherhood is joinable, and
answer null (no rescue) until then, exactly as an IsMember() false
does. The court header's FLAGGED clause is retired.

Pins: 3 in `test/courtrescue.test.js`. Campaign: 7 mutants, 7 killed.

## ES2 - THE EQUIP SOUND (2026-08-28)

equip.js's header FLAGGED it since U8f. DFU rings a per-item clip at
EquipItem's own moment (ItemEquipTable.cs:144-146,
DaggerfallUI.PlayOneShot(item.GetEquipSound())), BEFORE
StartEquippedItem - and the port does now:

- `getEquipSound(item)` is DaggerfallUnityItem.cs:820-841 verbatim:
  clothing 381, jewellery/gems 383; armor splits shield-or-Helm to
  plate (419) FIRST, then the EXACT material - Leather (0x0000) 417,
  Chain (0x0100) 418, with Chain2 (0x0103) falling to plate on C#'s
  own `==` - else plate; weapons by template (axes 415, long blades
  378, two-handed 379, short blades 377, flail 414, mace/hammer 413,
  staff 380, bows 416); everything else SoundClips.None (null, rings
  nothing).
- The sink registers inside `audio.ensure` - every host's boot passes
  through it, so no host can forget the wire (the FOUR HOSTS RULE's
  structural arm; DaggerfallUI.PlayOneShot is a global reach in C#
  for the same reason).
- The RESTORE path stays silent: rebuildEquipState refills slots
  directly and never enters equipItem - the port's shape of DFU's
  playEquipSounds=false load arm, pinned.

Pins: 4 in `test/equipsounds.test.js`. Campaign: 7 mutants, 7 killed.

## EF1 - THE EFFECT LIBRARY MEASURED: no gap, and 255 phantom keys (2026-08-28)

`applySpell`'s last line, `out.skipped++`, carried the sentence "the
library grows one family at a time" from the port's first magic slice
until this one. It was picked as the next slice on the strength of that
sentence - the biggest remaining gameplay gap. It is not a gap at all,
and finding that out took three attempts, two of which were wrong in
ways worth keeping:

- **The wrong instrument.** The first measurement asked
  `effectActiveIdentity` which families it could name, and answered "65
  reached, 17 skipped". That function is the ACTIVE-ENTRY classifier:
  an instant family handled inline legitimately has no active identity,
  so Open, SpellAbsorption, CreateItem and fourteen others were being
  counted absent while sitting in the file. Every one of the 17 turned
  up in a grep of the port. **A proxy is not the measurement.**
- **The incomplete corpus.** The second asked the real counter, but
  against a key set built by grepping `MakeClassicKey(g, s)` for
  literals - 82 keys. DFU has 91. ElementalResistance.cs:194 and
  PacifyEffect.cs:111 build theirs from a loop variable
  (`MakeClassicKey(8, (byte)variantIndex)` over the five
  DFCareer.Elements, `MakeClassicKey(33, (byte)variantIndex)` over the
  four EnemyGroups), and a grep for literals cannot see nine real
  families. **Zero gaps against the wrong corpus is not zero gaps.**
- **The one-sided question.** Against the full 91 the counter answers
  zero, honestly - the library is complete. But "is any key missing?"
  was the wrong question to stop at, and asking the other direction
  found the defect: sweeping all 65,536 classic keys through the real
  dispatcher, the port answered **346**. The 255 extras were group 43,
  subgroups 0-254.

The defect: the Teleport arm read `e.type === 43` and never its
subgroup, where DFU keys the class `MakeClassicKey(43, 255)`
(Teleport.cs:51). Every other arm in the file tests
`classicSub(e) === 255`; this one had lost it, while its own comment
still read "(43,255)". No classic spell reached it - records store "no
subgroup" as the signed byte -1, which `classicSub` masks to 255 - so
the fix changes no shipping behaviour. It is still the same defect as a
missing family, pointing the other way: the library's one job is to
answer exactly DFU's keys, and answering 255 that DFU does not define
fails that as squarely as answering none.

The FLAGGED sentence is retired; the line it sat on stays, now as the
honest answer to a key DFU has no class for.

**A coverage claim must be measured from both sides.** "No key is
missing" was TRUE on the broken code and would have passed forever.

Pins: 4 in `test/effectcoverage.test.js` - two ungated (the
discriminating-counter control, and the group-43 subgroup law, which
catches the defect with no checkout present), two regenerating DFU's
whole key set from the effect classes. Campaign: 5 mutants, 5 killed,
including one that drops a single loop-keyed variant (8,4) and one that
over-reaches a DIFFERENT family, so the sweep is proven to generalise
past the case it was written for.

## EF1c - THE SENTENCES THE LIBRARY OUTGREW (2026-08-28)

EF1 retired the flag on `applySpell`'s skip counter. EF1b found the
same claim four lines from the top of the same file. This is the rest
of them: four sentences across two more modules that deferred work to
"the effect-library slice", every one checked by RUNNING the thing it
described.

- `dungeonContext.js` said trap spells resolve "the classic
  damage-health family... other effects FLAGGED to the effect-library
  slice". M3 moved this host's missiles onto the shared cast engine, so
  a landed bolt goes `explodeAt` / `applySpellToPlayer` -> `applySpell`:
  a paralysis or drain trap has been landing whole for a long time.
- `spellcast.js`'s header declared a SCOPE - "the RESOLVED effect
  family is classic Damage Health... every other effect in a trap spell
  is SKIPPED with a flag" - for a module that resolves no effects at
  all. It owns the saving throw, the magnitude roll and the missile
  constants. A scope note describing a NEIGHBOUR's old shape is worse
  than none: it reads as current and nothing local contradicts it.
- `spellcast.js` called ElementalResistance a family "the effect
  library has not reached, so nothing can raise one yet" - written
  directly above `elementalResistanceChance`, the function that sums
  the entries it declared could not exist. Casting 8,0 raises Fire to
  100 and leaves Frost at 0. Two neighbours, opposite claims, and only
  one of them runs.
- `spellcast.js` called continuous damage "instant application - the
  rounds system pends". It enters `activeEffects` as a
  `continuousDamage` entry and re-rolls its magnitude every round.

None of the four changed behaviour; all four were the port lying to its
next reader about where its own edges are - which is the more expensive
kind of wrong, because it sends someone to build what is already built.

**A CLAIM USUALLY HAS MORE THAN ONE HOME.** EF1 fixed the line it was
looking at. Grep the claim, not the line.

Pins: 3 appended to `test/effectcoverage.test.js` (one subject, one
row) - the resistance law per element, the continuous-damage round
tick, and a SOURCE SWEEP so a fifth sentence cannot land. Campaign: 4
applicable mutants, 4 killed - and the sweep's design is the campaign's
doing. Its first shape matched per line and flagged EF1c's own
corrections, which quote the retired wording across line breaks; its
second exempted any comment block naming EF1c, and a mutant pasting a
BRAND-NEW "other effects pend the effect-library slice" into that same
block SURVIVED. The shipped sweep strips quoted spans and reads what is
left, so a correction may quote the old sentence and an assertion is
still caught. **An exemption wide enough to cover the fix is wide
enough to hide the next defect.**

## CG2 - THE CRIME-GUILD TALLY: how the invitation is earned (2026-08-28)

G2 pinned that neither the Thieves Guild nor the Dark Brotherhood can
be joined by asking - `DaggerfallGuild`'s join arm throws
`NotImplementedException` for both, because classic INVITES you. CG1
never asked where the invitation comes from. This is it.

`TallyCrimeGuildRequirements` (PlayerEntity.cs:1271-1299): every theft
counts one toward ten, every murder counts toward fifteen - a murdered
civilian weighing **five** where a killed watchman weighs **one**, so
three dead townsfolk arm the Brotherhood against fifteen dead guards.
Crossing either threshold stamps a clock 4320 classic minutes (three
days) out. `HandleStartingCrimeGuildQuests` (:1503-1522), called from
the tail of `PlayerEntity.Update`'s per-minute block at :531, delivers
the letter when that clock runs down **and the player is outside**, then
parks the tally at `InviteSent` (100) so it can never fire twice.

**THE READER SHIPPED AND THE CONSUMER NEVER DID** - the third slice in
a row with that shape, after EW1's weight term and FD1's water
exemption. `formats/characterRecord.js` has parsed all four fields since
the .SAV work (0x211, 0x21f, 0x222) and `systems/classicSave.js`
imports every one onto the entity, so a player importing a classic save
at nine thefts arrived carrying a tally nothing in the port would ever
read again. Four live crime sites named the missing call in their own
comments.

Wired at all four: the killed watchman (`cityGuards`, weight 1), the
murdered civilian (`cityGuards`, weight 5), the pinched purse
(`talk.js` - only the arm that actually took gold, as DFU's call sits
inside that branch), and the picked exterior lock (`worldModes`, before
the success text as in C#). The shop-shelf and trade-window thefts stay
recorded rather than wired: those windows have no crime path yet.

Three things the port's own shape forced, each pinned:

- **`?? 0` is load-bearing, not defensive noise.** The port mints
  player entities lazily - `systems/save.js` reads every persistent
  field with its own `?? 0` - so a fresh character reaches the tally
  with these UNDEFINED where PlayerEntity.cs:90-93 declares them zero.
  DFU's gate ported literally as `=== 0` reads false against undefined
  and would have frozen the tally for every new game, leaving the guild
  reachable only from a classic import. Caught while writing it; it is
  the campaign's first mutant now.
- **The three effects are atomic, so an unwired host does nothing.**
  DFU parks the tally, clears the clock and starts the quest as one
  act. A port that did the first two with no quest machine mounted
  would mark the player permanently invited to a guild whose initiation
  never ran - strictly worse than waiting. With no registered host the
  letter simply stays pending.
- **The four fields join the save.** AUDIT 18 F3's lesson exactly:
  nobody steals ten times in one sitting, so a tally that resets on load
  makes the guild unreachable by any player who saves.

`crimeGuilds.js` is a LEAF on purpose, and the two faction ids moved
into it from `court.js`, which now re-exports them: `talk.js` needs them
for the pickpocket tally and cannot import `court.js`, because
`court.js` imports `talk.js` - a cycle its own pickpocket comment names.

Pins: 10 in `test/crimeguilds.test.js`. Campaign: 12 mutants, 12
killed - **after three survived the first run, all three for the same
reason EW1 recorded a slice ago.** The delay pin asserted
`NOW + CRIME_GUILD_LETTER_DELAY_MINUTES` and the InviteSent pin asserted
`=== INVITE_SENT`, so both moved with the constants they were meant to
guard; the `inside` default had no arm at all, because every assertion
passed it explicitly. They assert 4320 and 100 as literals now, and the
omitted-`inside` case has its own arm. **Writing down "a pin that
computes its expectation the way the code does is not a pin" did not
stop me doing it again the next slice** - which is the argument for the
campaign, not for the note.

## TP1 - THE FAST-TRAVEL GUILD DISCOUNT + RAISESKILLS ON ARRIVAL (2026-08-29)

`travelPopUp.js` flagged four things as "idling loudly". Two of them
had stopped idling on anything:

- **`GuildManager.FastTravel` (:284)**, flagged "no guild perk seam".
  The seam is `activeMemberships`, which G2 shipped. `GuildManager`
  folds every membership through its guild's own `FastTravel`
  (:380-386), `Guild.FastTravel` is the identity (:241-244), and
  exactly one guild in the game overrides it: the Temple of **Akatosh**,
  god of time, returning `(int)(((95f - rank) / 100) * duration)`. A
  rank-0 initiate travels in 95% of the time, a rank-9 Patriarch in 86%.
- **`RaiseSkills` on arrival (:380)**. AUDIT 23 established that
  `PlayerEntity.Update` runs NO advancement and that DFU calls
  `RaiseSkills` from exactly two window-closings - rest, which shipped,
  and this one. `shared.js`'s own doc named this site as *"the other
  site, unported"*.

**The discount lands BETWEEN `CalculateTravelTime` and
`CalculateTripCost`** (DaggerfallTravelPopUp.cs:281-296), so Akatosh's
blessing cuts the FARE as well as the days. That ordering is the whole
reason the port's flag sat on the line it did, and putting the discount
after the cost is the plausible wrong wiring - the campaign's seventh
mutant.

`raiseAtRestEnd` became **`raisePlayerSkills`**, DFU's own member name.
The old name was true while rest was its only caller and became a small
lie the moment travel used it; a name that misleads the next reader is
the same defect as a stale comment, and this run has now found four of
those.

The two flags that genuinely still idled at TP1 - the HUD
smash-to-black fade and EXIT's key-up deferral - stayed named, and a
pin asserted they stayed named, so this slice could not be read as
having closed the whole row. **WAVE D's D4 closed both** and inverted
that pin: the fade is `src/ui/fadeLayer.js` (FadeBehaviour.cs whole)
fired from `ui/travelPopUp.js` on the frame the counter empties, the
deferral is travelPopUp's KeyDown-arms / KeyUp-pops
`isCloseWindowDeferred` over the travelMapWindow keyup seam, and
`test/travelguild.test.js` now asserts neither flag survives in that
header.

Pins: 6 in `test/travelguild.test.js`. Campaign: 9 mutants, 9 killed
after two survived the first run, and the two survivors were different
in kind:

- **`break` after the discount survived every behavioural arm, and
  always would.** Only one guild has the perk and all eight temples
  share the HolyOrder slot, so no reachable membership book holds two -
  the mutant is behaviourally EQUIVALENT under real data. What it
  breaks is the contract `GuildManager.FastTravel` states: thread the
  duration through *every* membership. The pin now guards that contract
  explicitly rather than pretending an observable exists.
- **Wrapping the arrival raise in `if (false)` survived**, because the
  pin looked for the call as a substring. That is PY1's lesson in
  another costume - *a pin that greps for a call does not test that the
  call runs*. It matches the statement at its line start and
  indentation now.

## FS1 - THE STALE-FLAG SWEEP: a delegation is checkable (2026-08-29)

Six times in one run a flag's blocker shipped and the sentence stayed:
EF1b, EF1c, CQ1b, TP1, RP1 - and then four at once in `world.js`.
CQ1b's answer was a per-slice second-home pin, and it works, but only
on the claim a slice is *about*. The population it cannot reach is
every flag no slice is currently looking at, which is all of them.

FS1's answer is to pin the one form of staleness that is
**mechanically decidable**. A flag reading *"FLAGGED in `<file>.js`"*
is not making a judgement call - it is **delegating**, and a
delegation can be checked: the named file must carry a flag. That is
the whole law, and it is deliberately narrow. *"FLAGGED with the
palace blocks"* delegates to an **arc**, which is the board's to hold
and not a file's; a guard that guessed at those would be measuring
prose, and the narrow law is the one that can be true.

Four sentences retired, each verified dead against the tree:

- **the record-22 delegation.** `world.js` sent the reader to a flag
  in `systems/healthStatus.js` saying the status text pends its macro
  producers. ST1 shipped `statusInfoRows` **into that file** and
  IM1/MH1 landed the producers - and the stale sentence sat *one line
  above* ST1's own correction.
- **"Routing F5/F6 into interiors is its own arc".** U43 shipped it:
  `worldModes`' interior arm routes the whole `ui/input.js` table over
  `interiorKeyCtx`, and U43's own comment says in as many words that
  F5, F6, L, N and R "all died the moment you stepped through a shop
  door" *before* it. **This one had a second home in `exterior.js`,
  found by FS1's own second-home pin on its first run** - in a host
  that builds no interior to step into, so the sentence was
  second-hand there in the first place, which is how it outlived the
  arc twice over.
- **"melee strike frames resolve to nothing"** - written before
  G1/G4/X. Forty lines below it a swing resolves against live guards,
  then encounter foes, then wandering civilians.
- **"targets pend the RMB animal/exterior-foe arc"** - written before
  AR1. The `arrows.update` call directly above hands `foeTargets`
  both live pools.

The last two shared a comment with a clause that is **still true**
(the open world really has no action objects in melee reach; static
building doors are the E-enter seam, not bashables). **A sentence with
one true clause keeps its false ones alive** - and a mutant deleting
the true clause along with the false ones is in the campaign, because
over-retiring is the equal and opposite failure.

**And one delegation pointed at a flag nobody had ever written.**
`world.js:1374` said the dungeon-mode enchant ctx was "FLAGGED there
with the rest of its enchant wiring" in `dungeonContext.js`. It was
not. `setDefaultEnchantCtx` had exactly **one** caller in the tree, so
the standalone `?dungeon` host ran every arm that needs a host
against no ctx at all - CastWhenUsed's CasterOnly assign and its
click-to-cast ready, the vampiric-drain and affinity scans, SoulBound's
break release. Every one is optional-chained, so it was **silent**:
the AUDIT 24 seam shape exactly, a ported law evaporating with a green
suite. This is the worse of the two failures - the work is real, and
the ledger could not see it. The flag went to the file that owed the
mount, and the pin asserted its load-bearing claim (one caller,
`world.js`) so that a second host mounting the ctx would retire the
flag **by failing**.

**WAVE D closed it, and the pin failed exactly as designed.** The flag
also said the mount was "~90 lines of live plumbing - spell-reflection
re-targeting, per-foe sinks, the say sink - and none of it is
host-portable by copy". The plumbing was real; *not portable* was not.
Every host-specific term in it - the pools, the sinks, the text
channel, the two windows, the spawn door - was already a closure over a
host binding, which is a **parameter** everywhere else in this tree. So
the body moved to `scenes/hostEnchant.js` and each host hands in its
own doors, which is also the only way the two mounts can be held to one
law: a copied mount diverges the first time an arm grows. What is
deliberately *not* a parameter is the set of seams the port already
answers once - `playerInSunlight`/`playerInHolyPlace` (which route by
live mode), `worldMinutes`, the settings store.

The one thing the mount needed that a copy would not have: a **gate**.
`setDefaultEnchantCtx` is a session singleton and EC1 had already
routed `world.js`'s mount into this context through `modes.dungeonCtx`
whenever the live mode is dungeon - so an unconditional second mount
would simply overwrite that one the moment `worldModes` builds a
dungeon, last writer wins, silently. `opts.enchantCtx !== false` is the
`chargen: false` shape exactly: **an outer host already owns it.**

Pins: 7 in `test/flagsweep.test.js`. Campaign: 16 mutants, 16 killed.
One design note from writing it: the population pin (*the guard
measures at least two delegations*) is not decoration. Comments wrap,
so the path routinely lands a line or two below the words -
`dungeonContext`'s `restWindow.js` delegation does exactly that - and
the first single-line regex read the tree as nearly empty and passed.
**A guard over an empty population is a green light that means
nothing.**

### What FS1 did NOT do: the ledger count is inflated

`tools/regenOpenFlags.mjs` greps `FLAGGED|INTERIM` per line, and
ALL-CAPS `INTERIM` is used two ways in the tree: as the marker, and as
an ordinary noun for a thing that already shipped. `skills.js` says the
+10% "used to be INTERIM 0"; `itemInfo.js` says U8e "shipped an INTERIM
info panel" that was then replaced; `playerEntity.js`'s pre-chargen
INTERIM entity is *referred to* from six other files. Of 47 INTERIM
lines a substantial share are mentions or past-tense retirements, so
the count Mac reads overstates the open work.

That is a real finding and FS1 does not fix it, because the fix is a
classification of 47 sentences one at a time and not a regex - and
half-doing it would leave the count wrong in a new way. It goes on the
board as its own slice.

## EC1 - THE ENCHANT CTX READS THE LIVE FOE POOL (2026-08-29)

`world.js`'s enchant mount answered `[]` for its foe pool in **every
mode but exterior** - which is the mode the player does not fight in.

DFU has no scene gate here at all. `PlayerGPS.UpdateNearbyObjects`
(`PlayerGPS.cs:747-777`) walks
`ActiveGameObjectDatabase.GetActiveEnemyBehaviours()`, every active
enemy in the scene; and `CastWhenStrikes` does not look a foe up at
all (`CastWhenStrikes.cs:105`) - it assigns the bundle straight to the
entity behaviour the strike already handed it. The port's lookup
exists **only** because it needs the foe RECORD to reach that foe's
damage and heal sinks. The gate was never DFU's.

What the gate cost, in the streaming host, inside a dungeon: a
CastWhenStrikes weapon found no record for the foe it had just struck
and returned, so **paralysis, Wizard's Fire and the other ten classic
strike spells did nothing**; the vampiric drain and both artifact
affinity scans saw an empty room. Nothing threw and nothing was
logged - the enchantment simply had no effect where the fighting is.

And it really was the only ctx in play: **no host passes an
`enchantCtx` at the strike site** (`formulas.js:465` defaults it
`null`), so `mergeCtx` folds this one mount under every dispatch, in
every mode. FS1 had just found the other half of the same hole - the
standalone `?dungeon` host mounts no ctx at all - and that half is
still open, now narrowed to exactly what remains true.

**Detect was already right, and checking that mattered.** The obvious
reading is that the same gate blinds Detect Enemy in a dungeon. It
does not: each host draws its own HUD off its own feed, and
`dungeonContext` has always had one holding that host's foes and
piles. Widening the shared getter *without looking* would have been a
fix aimed at a bug that was not there.

**One change, two consumers.** `world.js`'s own detect feed has two
readers and both are exterior arms - this frame's HUD markers, and
`onDispel`, which removes what it dispels through
`exteriorFoes.removeFoe`. So the feed keeps an explicit
`exteriorFoePool()` rather than following the widened getter; widening
the shared one would have handed dungeon records to the exterior
pool's remover.

**The two spawn arms refuse rather than misroute.** SoulBound's break
release and the Sanguine Rose stand a foe through
`exteriorFoes.spawnFoe`, which puts it in the *streaming world*. Fired
from inside a dungeon that is a foe alive, ticking and invisible, in a
world the player is not in. They now refuse in dungeon mode, FLAGGED:
the dungeon spawner is `spawnQuestFoe`, and it binds a quest
*behaviour* to what it stands, which a released soul has not - the
behaviour-free door needs splitting out before this can route.
Refusing is the honest answer meanwhile.

The law lives in `shared.js` as two small functions rather than inline
in the host, because it is exact and worth testing on its own: which
pool is live, and whose sinks a record from it must go through.

Pins: 9 in `test/enchantpool.test.js`, most of them behavioural
against the extracted law rather than source sweeps. Campaign: 18
mutants, 18 killed - after two survivors, both of which were mine:

- one mutant was **behaviourally equivalent** (a dungeon with no ctx
  fell through to `return []` either way). Replaced with one that
  really differs - the no-ctx dungeon borrowing the exterior pool -
  which the "must not consult the exterior thunk" pin kills.
- the other called a bluff in my own code. `liveEnchantFoeSinks` took
  the MODE as well as the pool, and dropping the mode term SURVIVED -
  because no record is ever in both pools, so the term could not
  change an answer. The term is gone. **An unfalsifiable term is not
  caution; it is a second law that no test is holding**, and the
  campaign is what tells the two apart.

## SD1 - THE LOOSE FOE STANDS WHERE DFU STANDS IT (2026-08-29)

SoulBound's break release and the Sanguine Rose's Daedroth are the two
enchantments that put a foe in the world. Both dropped it at the
player's feet plus a fixed `(+2, +1, 0)` - inside the player in a
corridor, inside the wall against one - and EC1 had just made them
refuse underground rather than stand it in the streaming world the
player was not in.

**The law they needed was already in the tree, and this slice started
by writing a second copy of it.** B1 ported
`FoeSpawner.PlaceFoeFreely` for the quest foe arm - the whole raycast
ring, the surface-angle separation, the floor probe, the overlap
refusal - and `world.js`'s own `tryPlaceFoe` twenty lines away stands
its foes through it. A fresh `systems/foeSpawner.js` was written and
deleted before it was committed, found only because the new call site
sat near the old one. This is the ONE HOME law's own failure mode, and
FS1 named it a slice earlier: *a stale claim is expensive because it
sends someone to build what is already built.* Nothing about the flags
sent me here - I simply did not look first.

**What was genuinely missing is DFU's other rotation arm.**
`PlaceFoeFreely` (:141-155) has two: `LineOfSightCheck` true tries to
spawn just outside the player's field of view; false takes any bearing
in the circle - DFU's own comment is *"Don't care about player's field
of view (e.g. at rest)"*. Only the first was ported. It is not a corner
case: **SoulBound passes false** (`SoulBound.cs:100`), so a released
soul is allowed to appear in front of you, which is the whole character
of the effect. The Sanguine Rose takes the default true, and allied
(`SanguineRoseEffect.cs:56`). The two arms now differ exactly as their
DFU callers differ, and nothing else about the law changed.

Three details the wiring had to get right, each its own mutant:

- **`minDistance` is 4, not 5.** `PlaceFoeFreely`'s signature says 5,
  but it is always handed the *spawner's fields*, and
  `CreateFoeSpawner`'s defaults (`GameObjectHelper.cs:1314`) are 4/20.
  The band has to be passed or the enchantment callers silently get
  the wrong one.
- **The dungeon is raycast against the DUNGEON's geometry.** The ring
  is a collider query; running it against the exterior collider from
  inside a dungeon answers about a world the player is not in.
- **The occupancy term reads EC1's live pool**, so a dungeon foe
  blocks a dungeon spawn - the two slices compose rather than each
  knowing half the answer.

`dungeonContext` gains the behaviour-free door EC1 flagged for:
`spawnLooseFoe` is `spawnQuestFoe` minus the `bindQuestFoeHost` call,
and `spawnQuestFoe` is now built on it rather than being a second copy
of the build chain. It carries MT-ii's allied law, the same two lines
`exteriorFoes` has: both per-instance fields turn and the shared frozen
basics row does not.

Interiors still refuse. That is EC1's answer and still the honest one -
there is no foe pool there to stand anything in.

The retry is the port's own call. DFU's spawner is a MonoBehaviour that
costs nothing to leave running, so it retries every frame for ever; a
bounded 12 attempts is here because a spawn that cannot find a spot in
a sealed corridor must not spin. Pinned as a bound, so removing it
fails.

Pins: 9 in `test/loosefoespawn.test.js`, the placement ones behavioural
against scripted rolls. Campaign: 25 mutants, 25 killed. Two of the
first-run failures were mine and worth recording: **the side coin is
`> 0.5 ? -angle : +angle`**, so the high roll is the MINUS side and my
first two expectations were simply backwards - the code was right. And
**EC1's own pin went red**, correctly: it asserted the refusal SD1
retired. Its law did not change - never stand a foe in a world the
player is not in - so it now holds the interior refusal, which is the
part that survives.

A THIRD pin went red at `npm run check`, after the campaign was already
green: MT-ii's summon pin in `artifacts.test.js` quoted the literal
`exteriorFoes.spawnFoe(mobileType, [pf[0] + 2, ...], { allied: true })`
- the fixed offset - so it failed for a change that strengthened
exactly what it was defending. Re-anchored on the law (the door is
mounted, and it carries `allied` into whichever live pool stands the
foe), which is F041's own precedent, and `artifacts.test.js` joined the
campaign so the new anchor is mutation-checked too. **A slice's
campaign only covers the suites it runs; the full check is what finds
the pin in the next room.**

## IN1 - THE HARVEST COUNTED QUOTATIONS AND IDENTIFIERS AS FLAGS (2026-08-29)

FS1 recorded that the open-flags count is inflated and deliberately did
not fix it, because most of the inflation is prose. IN1 is the part
that is not prose.

`tools/regenOpenFlags.mjs` grepped `/FLAGGED|INTERIM/` per line, so two
kinds of line that are not open work sat on the board:

- **an identifier that starts with the token.** `INTERIM_WEAPON` is a
  frozen export; its declaration, its default parameter and every
  mention of it by name were all listed as open flags.
- **a quotation.** A correction that says what it retired has to write
  the retired words down - and writing them down put the flag straight
  back on the board. **The tree had already grown a workaround for
  this**: `dungeonContext` quoted a retired flag with the token
  deliberately lower-cased and said so in the comment, adding that this
  is "how eleven retirement notes are already sitting there". That is
  EF1c's lesson leaking out of the pins and into the ledger, so the fix
  is EF1c's own rule - strip quoted spans, then look. The quote is
  verbatim again, and the count it asserted is gone: nothing measured
  it, and I could not measure it either (see below).

**The strip has to be whole-file, and then bounded.** Comments wrap,
and the quotation that forced the workaround wraps: the opening `"` and
the token on one line, the closing `"` on the next, so a per-line strip
sees an unpaired quote and strips nothing. But prose quotes do not
always pair - a comment quoting DFU can close a quotation opened many
lines above - so a generous span mis-pairs and blanks whatever sits
between two unrelated quotes. **A 400-character bound did exactly that
on the first run and swallowed `talkMacros`' GetValue flag, an open
one.** The span is capped at two newlines now, which reaches a wrapped
quotation and cannot reach across a paragraph.

**The failure direction is the design.** Missing a quotation leaves a
retired flag listed, which a reader can see and dismiss; blanking an
open flag hides real work, which nobody sees at all. The bound is
chosen to fail the first way.

**One home, and the guard proved why.** The rule now lives in
`tools/flagSites.mjs`; the tool and `test/audit18_bible_docs.test.js`
both import it. They had carried a copy each - and the guard went red
the moment the tool learned the new rule, which is precisely what two
copies buys. 165 sites -> 155.

### What IN1 refused to do

The rest of FS1's inflation is the past-tense case: a block that
mentions a flag in order to say it is **gone**. I wrote a heuristic for
it and it over-matched badly - it flagged
`guildServiceWindow`'s "FLAGGED: DFU binds each button to a
DaggerfallShortcut hotkey" and a dozen more like it, open flags whose
blocks merely carry a paragraph of history. That is not a rule, it is a
guess with a number attached.

So it stays open, and the tool's own comment says so. **A wrong count is
worse than a known-incomplete one** - and asserting one is exactly what
the sentence IN1 just deleted was doing.

Pins: 8 in `test/flagsites.test.js`. Campaign: 12 mutants, 12 killed -
including the unbounded span that swallowed a real flag, pinned with
the `talkMacros` shape that caught it.

## RE1 - THE RANDOM ENCOUNTER STANDS WHERE DFU STANDS IT (2026-08-29)

Every random-spawn arm in `PlayerEntity` goes out through
`GameObjectHelper.CreateFoeSpawner`, which is
`FoeSpawner.PlaceFoeFreely`: a bearing chosen against the field of
view, backed off whatever the ray hits by a separation the surface
angle decides, on a floor found below, in space nothing already
occupies.

Both port hosts instead walked **eight compass points** at
`minDistance` and took the first with ground under it. That is three
wrongs at once:

- the foe arrives **due north** of the player unless north is blocked -
  the loop starts at bearing 0 and breaks on the first hit;
- it can stand **inside a wall**: nothing tested the space, only the
  ground beneath it;
- it can **share a spot** with a foe already standing there.

SD1 made the law consumable from a host and added the arm this needed.
RE1 carries the call sites' arguments as data, because **the three
encounter arms do not pass the same things**:

| arm | min | max | LOS |
|---|---|---|---|
| location night (`PlayerEntity.cs:574`) | 10 | 20 | true |
| wilderness (`:594`) | 10 | 20 | true |
| **dungeon rest (`:610`)** | 8 | 20 | **false** |
| SpawnCityGuards (`:687`) | 12.8 | 51.2 | true |

The maximum is `CreateFoeSpawner`'s own default wherever the call site
does not pass one, which is why it is 20 three times and not
`PlaceFoeFreely`'s signature 5.

**The dungeon arm alone clears the line-of-sight check, and it is the
one a player feels.** Set, the foe is placed just outside your view -
you hear it before you see it. Cleared, it takes any bearing in the
circle, and DFU's own comment says why: *"Don't care about player's
field of view (e.g. at rest)"*. A monster that finds you asleep in a
dungeon is allowed to be standing over you when you wake. The port had
no such distinction to lose, because it had no bearing law at all.

`SpawnCityGuards` is carried in the table and **not wired**. The port
stands guards through the street-person pool - `cityGuards`'
`spawnGuardAt` takes a person's own position and facing - which is a
different placement problem from this ring. The row exists so the table
is the whole call-site list and a reader can see what is not wired,
rather than the row quietly not being there.

Pins: 6 in `test/encounterplace.test.js`. Campaign: 22 mutants, 22
killed, after one survivor: the dungeon host's **flier lift** had no
pin, though the exterior one did. FinalizeFoe raises a flying foe 1.5
above the test point, and a bat woken at rest was standing on the floor
with nothing to say so.

## LM1 - THE TRANSFORMED MOVE SOUND, AND WHAT THE LEDGER HAD LEFT (2026-08-29)

Asked what was next in the ledger, the honest answer turned out to be
"almost nothing, and three of its headline claims are stale". The
re-sweep is recorded in the ledger itself; this is the one row that was
genuinely open, and the slice that closed it.

`LycanthropyEffect.cs:201-211` + `:586-604`: while transformed, and
only while transformed, a real-time timer counts down; on expiry the
beast makes its move noise and the timer re-arms to a fresh
`Random.Range(4, 20)` seconds. It is what makes walking around as a
werewolf sound like anything - the port had the attack voices (V4) and
the wereclaws (V5) and nothing in between.

Three details are load-bearing and each has its own mutant:

- **The timer is armed at three places, and never lazily on the first
  frame.** `InitMoveSoundTimer` is called at the curse in `Start`
  (`:67`), after every fire (`:209`), and inside `MorphSelf`'s own
  `if (!isTransformed)` transform branch (`:521`), right after the
  compound-race name swap. So a morph into beast form starts a **fresh**
  4-20s. AUDIT 39 corrected this bullet: it used to name the curse as
  the only arming site, on the strength of a note in `lycanthropy.js`
  that read the C# as re-arming only there.
- **The wait is real time**, `Time.deltaTime` inside ConstantEffect, so
  a rested night queues no howls and time-scaled travel does not
  either.
- **The fire test is `< 0`, not `<= 0`.** A timer landing exactly on
  zero waits one more frame. That is not pedantry: it is what the
  arithmetic of a 20-second wait at a 0.5-second frame actually does,
  and my own expectation was wrong about it before the code was.

The whole block sits inside DFU's `if (isTransformed)`, so an
untransformed lycanthrope does not tick the timer down at all: the wait
**pauses** while the beast is away. But returning is a `MorphSelf`, and
that re-arms (`:521`) - so the paused remainder is **replaced**, never
resumed. Ticked by
all four hosts; in `worldModes` the arm sits deliberately outside the
`if (magic)` block, because the beast makes its noise whether or not a
cast engine was built.

Pins: 8 in `test/lycanmove.test.js`. Campaign: 18 mutants, 18 killed -
after one survivor that was **the mutant's fault, not the pin's**, and
is worth writing down:

**AN AMBIGUOUS MUTATION ANCHOR MUTATES THE WRONG CODE.** The gate
mutant anchored on `if (!entry?.isTransformed) return null;` -
`lycanthropy.js` has two of those lines, and the harness's
`replace(old, new, 1)` took the first, which belongs to
`lycanthropeAttackVoice`. The campaign then reported SURVIVED about a
function this slice does not cover, and the pin it was supposedly
testing was fine all along. Applying the same edit by hand with `sed`
(no count limit) failed the pin immediately, which is what exposed it.
A "survivor" is a claim about a specific edit; if the anchor is not
unique, it is a claim about a different edit than the one you wrote.

## DT1 — the Detect scan's loot pool was short in three of four hosts (2026-08-29)

`PlayerGPS.UpdateNearbyObjects` (:747, :765-776) has exactly one loot
walk:

    foreach (DaggerfallLoot loot in ActiveGameObjectDatabase.GetActiveLoot())

No scene gate, no kind gate, no item test. `GetLootFlags` (:822-836)
then sets the Treasure bit iff `loot.Items.Count > 0`, so an empty
container is **in** the list and merely unlit — a different thing from
being absent, and the distinction matters because the port's
*activation* walks legitimately do filter on items.

The port had four hosts each deciding for itself which of its own loot
kinds counted:

| host | fed to the Detect scan |
|---|---|
| `world.js` / `exterior.js` | dropped piles + corpses — right, since FX1 (F207) |
| `dungeonContext.js` | the RDB piles **alone** |
| `worldModes.js` interior | **nothing at all** |

So FX1's own finding — *"UpdateNearbyObjects walks EVERY active
DaggerfallLoot with no scene gate"* — survived untouched in the two
hosts where Detect Treasure is actually cast. Underground the spell
missed the corpse you had just made and the sack you had just dropped,
both of which that host's own `lootTargets()` has walked since U26.
Indoors all three Detect spells were blind, because the feed was handed
neither pool.

**The interior half had a reason written beside it, and the reason was
false.** The comment said "both pools are empty until interior loot
containers ship". Containers shipped at S2b and shelves at E2 —
`DaggerfallInterior.AddFurnitureAction` (:780-841) is the DFU member,
hanging a `DaggerfallLoot` on shop shelves at :796-801 and house
containers at :829-838 — and the foe pool shipped at IF. The sentence
had been outlived three times over and was still being read as a reason
not to wire anything.

The fix is one exported walk, `shared.js`'s `nearbyLootRecords`, that
each host names its own kinds to, so "every active loot container" is
one sentence again rather than four opinions. Two adapters go with it:
`containerNearbyRecord` (a furniture model's position is its matrix
translation, which is what `loot.transform.position` reads) and
`corpseNearbyRecords`, which absorbs the inline walk the two outdoor
hosts had each written out.

**An unbrowsed shelf contributes nothing, and that is DFU's answer
rather than a port limit.** `AddFurnitureAction` adds the component
empty; `PlayerActivate.cs:881-886` stocks it on *first access*. So
`Items.Count > 0` is false until the player has opened it and
`GetLootFlags` withholds the bit. The port's `items: null` is that same
un-stocked state and maps to a count of zero — present in the list,
unlit, exactly like DFU's.

The two foe pools spell the same fact differently — `corpse` beside
`corpseMarker` in `exteriorFoes`, `corpseBatch` in the dungeon — and a
foe that died with neither is the cull's "gone, no corpse" arm, which
mints no `CorpseMarker` in DFU either. The walk reads both spellings
and says so, rather than renaming a field across two pools to make one
predicate read prettier.

**Four false sentences retired from `worldModes.js` on the way**, found
by the same sweep and each verified against the tree before deletion:
the interior detect claim above; "there is nowhere to cash one yet" on
the letter of credit, which B2 answered with `DepositAll_LOC`
(`banking.js:461`, the window's own :377-389); "the BANKING arm stays
FLAGGED below", written nine lines above the live banking arm; and
"every other arm is FLAGGED by name in
`guildServiceFlow.SERVICE_DESTINATION`" after DR2 closed the last of
the twenty — 20 rows, 0 nulls, checked by running it.

**Found and NOT taken, recorded at the seam:** a pile the player drops
*indoors* is still missing, because the interior host mints no ground
pile of its own — `mintRewardPile` falls interior drops through to the
world host, whose `dropFeet` reads the exterior player and collider. In
DFU that drop is a `DaggerfallLoot` in the interior scene like any
other. The fix is an interior `droppedLoot` pool, not a line in the
feed; when it lands it joins `piles` and nothing else changes.

Pins: 10 in `test/detectindoors.test.js`. Campaign: 16 mutants, 16
killed — among them the F207 regression itself (drop `foes` from
world.js's call and the pin fires), which is the point of moving a
twice-written walk into one home. `test/nearbyobjects.test.js`'s FX1
pin was re-anchored on the law rather than the literal (F041's
precedent): it had quoted the inline corpse map that no longer exists
anywhere, and what it asserts is unchanged.

**THE LESSON, and it is FS1's with a sharper edge: A REASON NOT TO WIRE
SOMETHING NEEDS RE-READING EVERY TIME ITS DEPENDENCIES LAND.** "Both
pools are empty" was true the day it was written. Three slices then
filled both pools, and none of them came back to this line, because
none of them were *about* this line. A flag that names what it waits
for can be swept when that thing ships; a flag that merely asserts a
present-tense fact — *is* empty, *has* nothing, *cannot* yet — has no
trigger at all, and goes on being read as a decision long after it
stopped being one. Prefer the form that names the dependency.

## ID1 — an item dropped indoors landed outside (2026-08-29)

DT1 routed this and did not take it. Reading the DFU member made it
larger than the detect gap that found it.

`GameObjectHelper.CreateDroppedLootContainer` (:716-775) picks the
container's **parent by context**:

    if (GameManager.Instance.IsPlayerInside)
        if (IsPlayerInsideDungeon) parent = playerEnterExit.Dungeon.transform;
        else                       parent = playerEnterExit.Interior.transform;
    else                           parent = StreamingTarget.transform;

and only the outdoor arm enrols the container in the streaming world's
bookkeeping:

    if (!GameManager.Instance.IsPlayerInside)
        GameManager.Instance.StreamingWorld.TrackLooseObject(loot.gameObject, true);

The port had two of those three arms. `dungeonContext` mounts its own
pool; `world.js` and `exterior.js` mount the streaming one; the
**interior arm of `worldModes` mounted none**. So every inventory window
this host opened came from `host.makeInventory`, whose `onDrop` is the
world host's — dropping at `dropFeet()`, which reads the *exterior*
player and raycasts the *exterior* collider, and stamping the pile with
the map pixel that IS the port's `TrackLooseObject`.

Three things followed from one missing pool:

1. the item did not land where it was dropped;
2. it could not be picked back up — the interior's E-ray had no pile
   targets at all;
3. it was enrolled in P2's out-of-range collection sweep, which DFU
   never runs on an interior container, so walking far enough
   **destroyed it**.

`GivePc.cs:168` mints through the same member, so the quest reward pile
had the identical three arms and the identical missing one.

ID1 mounts the interior pool from the same `createDroppedLoot` factory
the other two hosts use, on this host's collider, and gives it
everything a pool needs to be real rather than merely present: the drop
(at `FindGroundPosition` on the interior collider, with **no pixel key**
— that argument is `TrackLooseObject`), the E-ray target and its
activation arm on the dungeon's own `droppedLoot:` key vocabulary, the
flat animation and draw, the CacheScene/RestoreCachedScene halves so
walking out of a shop and back in does not empty the floor, both
teardowns, and the Detect feed's `piles` — which closes the row DT1
opened.

**One door, one law.** Rather than patch `onDrop` into five call sites,
every inventory window this host opens now goes through
`interiorInventory`, which folds in the drop pool and the
emptied-container free (`DaggerfallInventoryWindow.cs:697-722` mints and
removes at the *window*, not at the last item). The caller's own
`onClose` is **composed**, not overwritten: `...extra` last would have
silently dropped the free, and that is the third mutant in the campaign.

Pins: 10 in `test/interiordrop.test.js`, five of them behavioural
against the real pool with only the GL stubbed. The sharpest is the
`TrackLooseObject` gate itself — a keyless drop survives `collectPixel`
where a keyed one is swept, which is the whole bug in two lines.

Four pins elsewhere were re-anchored on the law rather than the literal
(F041): audit26 F066, HC1's owner-access arm, U43's mount table, and
RW1's mode split — whose claim genuinely **narrowed**, because
"everyone else falls through" is the exterior alone now.

Campaign: 16 mutants, 16 killed — after five survivors that were **all
the pins' fault**, and each is worth keeping:

- a source pin that quoted the raycast line but not what fed `p0`, so
  dropping at the origin survived;
- a cache pin that watched the pile list being **built** and never
  checked that the scene state **returned** it;
- a fixture whose icon roll was **constant**, so a restore that rerolled
  could not be told from one that kept — the roll advances now;
- no pin at all on the interior detect feed's own `piles`;
- an anchor that matched twice, caught by the harness's uniqueness
  check for the third time this run.

**THE LESSON: A POOL THAT EXISTS IN THREE HOSTS IS A LAW; THE FOURTH
HOST'S ABSENCE IS NOT A DEFAULT, IT IS A DECISION NOBODY MADE.** The
FOUR HOSTS RULE has always been read as "name all four" — and the
interior arm here was not named at all, in either direction. Nothing
said "the interior has no ground pile" and nothing said it should; the
window simply came from the outer host, and the outer host's handler was
about somewhere else. A seam inherited from a parent is the one shape
the rule cannot see, because there is nothing missing to point at.

## PT1 — stealing had no consequence (2026-08-29)

Two flags stood in `worldModes`' interior arm, both routed to "the
crime arc": the shop-shelf stealing roll beside `SetShopShelfStealing`,
and the theft basket behind `loot.houseOwned`. FS1's question — *has
the blocker shipped?* — answers yes on every one they named:
`TallyCrimeGuildRequirements` at CG2, `SpawnCityGuards` at G1, the crime
table and V4's SuppressCrime setter, `TallySkill` since the start. What
was left was the two laws themselves.

**And they are not one law.** The shop-shelf flag promised "the
shoplifting ROLL and its crime tally". DFU's shop-shelf arm has no roll:

    // DaggerfallInventoryWindow.cs:681-687, at the window's own teardown
    if (shopShelfStealing && remoteItems.Count < lootTargetStartCount)
        playerEntity.TallyCrimeGuildRequirements(true, 1);

A count comparison against the shelf as it stood when the window opened,
a Thieves Guild tally if it shrank, and nothing else. No chance, no
guards, no crime record — robbing a closed shop earns you credit with
the Thieves Guild and no trouble at all, which is classic's own answer.

The roll belongs to the *other* arm, `AttemptPrivatePropertyTheft`
(:1848-1863, reached from :2277-2281):

    TallyCrimeGuildRequirements(true, 1);
    weightAndNumItems = (int)basket.GetWeight() + basket.Count;
    chance = CalculateShopliftingChance(player, buildingQuality, weightAndNumItems);
    if (!Dice100.FailedRoll(chance)) { CrimeCommitted = Theft; SpawnCityGuards(true); }
    else                             { TallySkill(Pickpocket, 1); }

The tally is the member's first line and does not wait for the roll. The
guards come for you in someone's house; they do not come for a shelf.
`loot.houseOwned` (:919) is set in the *stranger* branch alone, so
`isPrivateProperty` is exactly "rifling furniture that is not yours" —
your own house or ship opens the same window with the flag off.

**The basket, and why the port does not need one.** DFU accumulates
`theftBasket` as the player clicks — added on a take, removed on a
put-back — because the window must *weigh* what was taken. The set it
ends up holding is exactly "present when the window opened, absent when
it closed", so a snapshot diff answers the same question from the same
two facts. Putting one of your own items *into* the container doesn't
enter it either way.

The `(int)GetWeight() + Count` truncation is load-bearing and pinned as
such: three 1.25 kg trinkets give 6, one 12.5 kg breastplate gives 13.
A pocketful of small things is caught by its count; one heavy thing by
both.

Pins: 10 in `test/theft.test.js`. Campaign: 18 mutants, 18 killed —
including every *term's direction* in the chance formula, not merely its
presence, because a formula pin that only proves a term exists is the
proxy problem in miniature.

**THE NEAR-MISS, and it is SD1's exactly.** The slice set out to give
`Dice100.FailedRoll` one home: the tree had
`Math.floor(rolls() * 100) >= chance` written out inline in three places,
each commented with the member's name. I wrote a fourth export —
`dice100FailedRoll` — and put it in `formulas.js` one screen below
`dice100`, which has been there since T3a and *is* the same member
(`!dice100(chance, roll)` is `FailedRoll`). Reading the neighbouring
pickpocket call site is what caught it, the same way SD1's duplicate
module was caught: **the fix for "this member has too many homes" is the
one place you must not add a home without looking.** The three sites now
route through the export that already existed.

A pin sweeps for the hand-written comparison so it cannot come back —
with the **comment bodies stripped first**, because `theft.js`'s own
header quotes the expression it retired and the raw sweep read the
quotation as a fourth copy. That is IN1's finding arriving in a
different arc, and it took the same shape both times.

Four pins elsewhere were re-anchored. Two of them were reaching a
**fixed character count** into an arm this slice grew — `slice(0, 2000)`
and `slice(0, ownedLatch + 200)` — which is a bet on how long a piece of
code stays. Both now assert by index ordering, which is what they meant.

## BG1 — the building greeting: what kind of shop, and who lives here (2026-08-29)

Open a shop door in classic and it tells you what you have walked into
— *"Incense and soft music soothe your nerves"* for a fine one, *"Rusty
relics lie wherever they were last tossed"* for a hovel. Open a
stranger's front door and someone greets you. The port did neither:
every door in Daggerfall opened onto silence.

`PlayerActivate.cs:585-628` and `PresentShopQuality` (:1332-1391).

**The gate is two variables answering different questions** (:517-518):

    var isBrokenIn = isBash;                      // bashing IS breaking in
    if (!buildingUnlocked && !isBash && HandleOpenEffectOnExteriorDoor(...))
        buildingUnlocked = isBrokenIn = true;     // the Open SPELL sets BOTH
    ... a successful PICK sets isBrokenIn ALONE, never buildingUnlocked

    if (buildingUnlocked && House1..House4 && !TG && !DB && !IsHouseOwned)
    {
        if (!isBrokenIn) mb = MessageBox(GetRandomText(256));
    }
    else mb = PresentShopQuality(building);

which gives four reachable answers:

| how you got in | what you hear |
|---|---|
| walked in during open hours | the householder's greeting, or the shop's quality |
| the **Open spell** | nothing at all — `buildingUnlocked` true so the else-arm never runs, `isBrokenIn` true so the greeting doesn't either |
| **picked** the lock | `buildingUnlocked` stayed false, so the else-arm runs: a shop states its quality even to a burglar; a house says nothing |
| your own house, TG, DB | the else-arm, and the same null |

The port's `opened` was already exactly DFU's `buildingUnlocked`; what
it lacked was `isBrokenIn`, which is now written where DFU writes it —
raised by the Open spell *with* `opened`, raised alone by the pick.

**The box defers the door** (:617-623): when a greeting is shown the
interior transition waits for it to close, which is why the law answers
a *decision* and the host performs it. The HUD arm (:1379-1386) speaks
and does not defer.

`ShopQualityPresentation` and `ShopQualityHUDDelay` were already in the
store with DFU's own vendored defaults — they only needed a reader, so
the slice flips one from `stored` to `live` rather than inventing a key.
The read lives in the law, because that is where DFU reads it: the
switch is inside `PresentShopQuality`, not in the door arm that calls
it. `buildingGreetingsEnabled` is a static field defaulted true, not a
settings key, and is a named constant here for the same reason.

Pins: 12 in `test/buildinggreeting.test.js`. Campaign: 20 mutants, 20
killed — after two survivors, **both real gaps in the pins**:

- no test covered a **locked** building at all, so `buildingUnlocked`
  could be replaced with `true` and nothing noticed;
- the **nesting** mutant — rewriting `if (!isBrokenIn) mb = …` as a
  fall-through — is behaviourally equivalent for every input the host
  can produce, because a house is never a shop and the fall-through
  lands on the same null. The pin now states the *contract* the nesting
  protects (once the house branch is taken the shop arm is unreachable,
  for any arguments) rather than an observable it does not have.

And a drafted pin failed against the faithful port and was **the
draft's** error: I expected a magicked *shop* to be silenced too. It is
not — a shop fails the House1..House4 test whatever `isBrokenIn` says,
so the else-arm runs and the quality is stated. `isBrokenIn` gates the
greeting alone.

**The bash flag narrowed rather than closing.** The old sentence
bundled three things — the two bash arms, their crimes, and the house
greeting — behind "no weapon-vs-static-door path exists yet". The
greeting had nothing to do with bashing and has shipped. What is left is
precisely DFU's `isBash`: `PlayerActivate` reached from a *weapon swing*
rather than the activation ray, and outdoors this port has no such input
(`envAttack` runs against an action-object list, and an exterior static
door is not one). So the flag now says what is missing — the **input**,
not the six lines of roll, and not the crime road, which CG2 and PT1
already built. `isBrokenIn` is written starting from the `isBash` that
does not exist yet, so the day that input lands the arms drop in beside
it.

**THE LESSON: A FLAG THAT NAMES THREE THINGS IS THREE FLAGS, AND THE
CHEAPEST OF THEM IS HOLDING THE OTHERS HOSTAGE.** The greeting sat
unbuilt behind a blocker it never had, because it shared a sentence with
two arms that genuinely needed one. FS1 taught that a flag's blocker
should be re-read when its dependencies land; BG1 adds that a flag
covering more than one claim should be *split* when it is written, or
the first reader to check the hardest claim will file the whole thing as
blocked.

## TR - THE TRANSPORT ARC (2026-08-31, open)

Mac: "let's work on the horses and carts". The port has carried the CART
as an inventory fact since the W-slice - the wagon's 750kg, the
dungeon-exit prompt, the transfer guards - and the HORSE as an item
nobody could sit on. `motor.js:517` passed `riding: false` into the
climbing gate with the note "the transport arc pends", and
`DaggerfallTransportWindow` is the last of DFU's 60 real windows the
port does not have (UI-Arc.md's table).

DFU's arc, and how it splits:

| Slice | What | State |
|---|---|---|
| **TR1** | TransportManager's MODE half + every law that reads it | **CLOSED** |
| **TR2** | the riding sprite and its audio | **CLOSED** |
| **TR3** | the transport window, and the ride made real in the world host | **CLOSED** |
| **TR4** | the ship: board and disembark | **CLOSED** |

### TR1 CLOSED: the mode

`systems/transport.js` is TransportManager's mode half - the four modes,
`horseItemIndexes` seeded with Transportation.Horse, HasHorse/HasCart,
ToggleMount (mounted dismounts; on foot the HORSE is preferred and the
cart is the fallback; with neither the mode is UNCHANGED, because there
is no else arm) and the transition dismount (building and dungeon
interiors only - DFU has no arm for LEAVING one, so you walk out on
foot).

Everything that reads the mode was already waiting for it:
`PlayerSpeedChanger`'s two ride bases (dfRideBase walk+225, dfCartBase
walk+100, neither taking walkSpeed's drag term), GetRunSpeed's riding
arm - **a canter has no run base of its own**, it is the ride speed
times the Running multiplier - CanRunUnlessRiding, PlayerEntity's
"no Running tally from a saddle", ClimbingMotor's "no climbing from a
saddle", and HeadBobber's Horse style, which AUDIT 28 W10 ported and
then passed `riding: false` into. The motor carries `transportMode` and
answers `riding`; the hosts pass it on.

One DFU order kept rather than tidied: GetBaseSpeed tests CROUCH before
riding, so a crouched rider takes the crouch base. It cannot happen in
DFU (PlayerHeightChanger refuses to crouch while mounted, which is TR2's
neighbour) but the order is the law and the port keeps it.

**Nothing mounts yet** - TR3 owns the door. TR1 is the system under it,
and every one of its laws is live the moment a mode is set.

### TR2 CLOSED: the sprite and the audio

`formats/cfaFile.js` is CfaFile whole - the FIFTH classic image format
the port reads, after IMG, CIF/RCI, TEXTURE and GFX. One record, N
frames of one size, RLE end-to-end behind a 14-byte header. One
arithmetic quirk is kept verbatim and pinned as such: the run length is
measured in COMPRESSED widths while the buffer is UNCOMPRESSED-sized,
so where the two differ DFU stops short and the tail stays zero. The
shipped files agree, and a "fix" would be a guess about art nobody in
this container can open.

`systems/riding.js` is the Update and OnGUI halves, pure: the 0.125s
frame clock wrapping 3 to 0 and RESETTING (not pausing) while you
stand, the loop that stops 0.2s after you do so a step-pause-step does
not chop the clop, the clop that swaps on the half-speed EDGE rather
than the state, the volume halved below half speed, the 1.2 running
pitch (which TR1 makes unreachable while mounted - DFU has the same
dead branch), the neigh at 1..4s on mounting and 2..39s after, firing
for a CART too and at a standstill because its block sits outside both
forks. The draw rect is bottom-centre at ScaleFactorX 0.8 on the
200-line scale.

Three sound ids joined the roster at DFU's numbers: HorseClop 97,
HorseAndCart 104, HorseClop2 298.

### TR3 CLOSED: the window, and the ride

`ui/transportWindow.js` is DaggerfallTransportWindow whole - the last
of DFU's 60 real windows the port did not have. Four rows and an exit
on MOVE00I0; the three disabled rows are SUB-RECTS of a second image,
MOVE01I0, whose sheet is declared 122x36, which is why the disabled
rects sit at (-4,-4) from the button rects: they are sheet coordinates,
not panel ones. Ownership is read once at Setup; foot is always
enabled; a disabled row is a dead button that eats its click.

The door is `dfuiOpenTransportWindow` (:690-700) on the T key, which
`input.js` had routed to `ctx.openTransport` with no host implementing
it - the same dangling door UI1 found. Grounded only, and AIRBORNE IS
SILENTLY IGNORED: no message, no window.

**You can ride now.** The world host picks a mode, loads the mount's
CFA, ticks TR2's animator on the frame and draws the sprite under the
HUD. The riding loop needed a real audio channel - `audio.setLoop`,
a named loop with live volume and pitch, which is what Unity's
`ridingAudioSource` field is; the first cut of this slice
optional-chained into a method that did not exist, and that is the same
lie UI1 had just been written to fix.

### THE PARITY AUDIT (2026-08-31, Mac: "a deep comprehensive parity audit on all of this")

TR1-TR3 re-read against TransportManager, PlayerSpeedChanger,
PlayerMotor and PlayerHeightChanger. Four findings, ALL FOUR against
this arc's own work, all fixed here:

- **F-E1** OnGUI (:293) refuses to draw at all while the game is
  paused - `!GameManager.IsGamePaused` sits in the same condition as
  the Repaint test. An open window HIDES the mount; the first cut
  froze the frame and kept drawing it.
- **F-E2** `IsMovingLessThanHalfSpeed`'s else arm compares
  `GetBaseSpeed()/2`, and TR1 made GetBaseSpeed return the RIDE base.
  The port's line said "both DFU branches collapse to walk/2 here",
  which was TRUE UNTIL TR1 SHIPPED AND FALSE AFTER. The case that
  separates them is a SNEAKING rider: he lands between the two lines,
  and under the old one he lost the half-speed stealth benefit DFU
  gives him. TR2's clop swap and volume halving key off the same flag.
- **F-E3** PlayerHeightChanger has DoMount/DoDismount actions of its
  own (:159-170, :287-320): `controllerRideHeight` is 2.6 - "a horse
  plus seated rider (1.6m + 1m)" - against 1.8 standing, so a rider's
  eye sits at 2.51 and his CAPSULE is the horse's, which is what he
  clears and bumps. Mounting rises over timerMedium, dismounting falls
  over timerFast, and mounting CLEARS the crouch (:306) - the very law
  that makes GetBaseSpeed's crouch-before-riding order unreachable,
  which TR1 had already recorded and then not implemented.
- **F-E4** ApplyInputSpeedAdjustment's SNEAK arm subtracts from
  whatever GetBaseSpeed returned, ride base included. TR1's first cut
  put the ride arm BESIDE the sneak instead of under it, so a sneaking
  rider trotted.

The shape is the one every self-audit in AUDIT 28 found: the
transcription of each DFU function was right, and the seams between
them were where the faults lived - three of these four are a law that
was correct before TR1 and that TR1 silently invalidated.

### TR5 CLOSED: the tail, and two dangling doors of this arc's own

TR1 ported `dismountOnTransition` and nothing called it: you could ride
into a shop and stay mounted. TR3 exported `CANNOT_CHANGE_INDOORS` and
nothing said it: the T key indoors did nothing at all. Both are the
shape this session found three times in older code - a live seam that
claims a feature - and then left twice in its own. Fixed: the two DFU
transitions dismount through one helper, both interior hosts refuse
with the line, and the mode change is ONE place (U53) that the T-key
pick and the interior dismount both take, so the mount's art is dropped
on every change rather than only on the pick.

### TR4 CLOSED: the ship, and THE ARC WITH IT

It was smaller than scoped: the OWNERSHIP half needed nothing, because
the bank arc has carried ShipType, the prices, the two map-pixel coords
and `ownedShip` since H3 - TR4 is simply its first reader. What was
missing is that "Ship" is not a mode you travel IN (DFU's own comment
on the enum): it is a TELEPORT that lands back on Foot, with
`boardShipPosition` as the whole of its state. Boarding remembers where
you were and lands at a RandomStartMarker; disembarking returns to the
remembered spot with NO reposition and forgets it; and IsOnShip is a
remembered boarding AND standing on the ship's own pixel, so a player
who boards, saves and loads elsewhere is not aboard - DFU's behaviour,
kept.

FOUND WHILE LANDING IT: SerializablePlayer (:180, :425) persists the
boarding memory and the port did not. A save taken at sea loaded with
IsOnShip false, so the next disembark would BOARD again and overwrite
where the player actually was. `save.js` carries it now; an older
envelope restores null, which is the never-boarded state rather than a
broken one.

The terrain-sampler check (:373-379) has no counterpart - the port has
one sampler and no version, so the fallback it guards can never fire.
Recorded, not invented.

### THE SECOND PARITY AUDIT (2026-08-31)

TR2 and TR4 re-read against TransportManager's audio and ship arms.
Two findings and one REFUTATION:

- **F-F1** `shipTransition` answers a `reposition` and the host inferred
  the landing from `restore` instead of reading it - two encodings of
  one decision, free to drift. The host reads it now. Recorded with it:
  StreamingWorld's RandomStartMarker is `PositionPlayerToLocation`,
  which falls back to the TERRAIN ORIGIN when the pixel carries no
  location (:1437-1447) - the ship coords are open sea, so the fallback
  is the arm that runs and the port's default landing stands in for it.
  FLAGGED for the first session with ARENA2: confirm (2,2) and (5,5)
  carry no location.
- **F-F3** DFU's `ridingAudioSource` is `loop = false` (:190) and Update
  only calls `Play()` when it is not already playing (:273-276) - so
  assigning `.clip` mid-clop takes effect when the CURRENT one ENDS.
  TR2 used a true-loop source and restarted it on the swap, chopping
  the hoofbeat in half. `audio.setLoop` is DFU's shape now: one
  non-looping source re-armed on `ended`, reading `want` each time.
- **REFUTED: `Settings.SoundVolume`.** DFU multiplies by it at every
  riding call site (:197, :271, :282) and the port passes 1 - which is
  CORRECT here: the SETT-slice applies SoundVolume once on the master
  bus every source connects through, so multiplying again would
  double-scale it. Not a finding.

**THE TRANSPORT ARC IS CLOSED.** TR1 mode, TR2 sprite and audio, TR3
window, TR4 ship, TR5 tail - and with TR3, all sixty of DFU's real
windows are ported.

(2026-08-31, after closing: MW-D42 hangs an ENHANCED-SKIN 3D horse
beside the sprite - the player's own Pegas Horse Ranch data, read at
runtime through the MW lane, never bundled. The arc stays closed: the
sprite is still the 1:1 lane and every classic path is byte-identical;
two pins moved by exactly the lines the swap needed (tr3's ride-loop
clip, tr5's mode-door tail), both recorded in their tests. The whole
story lives in Morrowind-Rules MW-D40..42. 2026-09-03: MW-D50 vendors
the mod's horse with the author's consent - vendor/pegas-horse/ - so
the enhanced ride has it out of the box, the player's own attach
ranking ahead; nothing on the classic lane moved, no pin moved.)

## TSR - THE TEST ROOM (2026-08-31, Mac's ask)

Mac: "a menu option that leads to a sort of test environment where I
can pick a prebuilt character and loot armor, weapons, etc." There is
no DFU original - this is a port tool - but it SHIPS, and until AUDIT
39 its entire record in the bible was one Testing.md row, which is how
a shipped systems module ends up unfindable.

THE IDS, corrected here. The room shipped as TR1-TR3 on the day the
transport arc above closed TR1-TR5, so two arcs claimed the same three
ids and a grep for "TR2" answered with the riding sprite AND the
gender bug. The room is **TSR** from now on (renumbered in
`test/testroom.test.js` and Testing.md's row); the transport arc keeps
TR. Source comments in `ui/enhancedMenu.js` and `combat/weaponRig.js`
still carry the old spelling, which this paragraph exists to catch.

**TSR1 - ONE HOME.** `systems/testRoom.js` holds all three parts: the
six prebuilt characters, the armory they walk in with, and the seeding
that turns a preset into a live entity. The presets exercise the axes
the body pipelines actually branch on - both sexes, human and elf and
BOTH beast races, a real `faceIndex` - because a second copy of a
preset in any door is how two rooms drift apart. The armory is TOTAL
where it claims to be: one of every weapon type in steel (each its own
Morrowind animation class and attach bone), every armor slot with all
four shields, the material spread that changes the Morrowind record,
a 60-arrow quiver so the bow draws loaded, and the SEX'S OWN clothing
templates. Every row mints through the game's own constructors
(`createWeapon`, `mintCondition`, the arrow arm's classic zero) -
never a second item table.

**WHAT THE ROOM IS NOT: a new scene.** It boots the same streaming
world every other door boots, through the same headless-chargen seam
`?class=` has used since AUDIT 17f. The room is a CHARACTER and a
PACK, not a place - the point is to see the real rigs wearing real
equipment through the real equip table, and a bespoke scene would be
testing itself.

**TSR2 - THE !!GENDER BUG, found building the room.** Gender is the
string 'male'/'female' everywhere in this port, so the pause card's
`female: !!playerEntity.gender` was TRUE FOR EVERYONE: every Morrowind
build asked for the female skeleton and body columns, half-masked by
the male-record fallback fills. The arms-build opts now live in one
home (`weaponRig.armBuildOptsOf`) that the card and the room both ride,
and the pin requires the string compare - a `!!` dies on 'male'.

**TSR3 - THREE DOORS, ONE HOME.** The pane iterates `TEST_PRESETS` and
fires `test:<id>`; `main.js` sets that param on this choice and DELETES
it on every other (F12's law - New Game must not re-enter the room);
the world boot resolves the preset BEFORE branching, so an unknown id
falls through to the wizard rather than guessing, and builds the arms
only when Morrowind data is attached.

**TSR4 - RIDE OUT (2026-09-03, Mac: "an option that spawns you into
the outside world with a mount to test").** The ride is a SPAWN on top
of a preset, not a seventh character: `TEST_RIDE` names the baseline
Nord Warrior, and `testEntryById` is the one door the boot resolves a
`test=` id through - a preset answers `{preset, ride:false}`, `ride`
answers the baseline with `ride:true`, an unknown id still answers
null before the branch. The pane's card fires the SAME `test:<id>`
choice family, so main.js's F12 law is untouched. Three things the
host owes the ride, each borrowed rather than built: the HORSE is
`seedTestMount` - the general store's own mint (`mintCondition` over
the template's name, the shelf's base value), once, so the T window,
the travel card and the pack all answer `hasHorse` as for a bought
one; the LANDING is the fast-travel arrival's own edge law
(`locationLandingFor` with no start markers = `positionPlayerToLocation`'s
outside point, EXTRA_DISTANCE past the chosen wall, facing in, floored
the arrival's way with ARRIVAL_REACH/LIFT); the MOUNT is U53's ONE
transport door, so the classic CFA sprite and the enhanced saddle
(MW-D42, the vendored horse of MW-D50) come up exactly as a T-key
mount brings them. THE ORDER IS THE POINT: the horse lands with the
armory in the async boot, but the landing and the mount are DEFERRED
to the frame loop's spawn gate (`rideOutWanted`) - whichever of the
character and the start pixel comes second fires it - so the ride can
never re-land a player who has no floor yet, and never reads the
arrival constants before the boot has declared them. A pixel with no
location keeps the centre landing and still mounts. Pins in
`testroom.test.js` (TSR4).

## ROAD-G G1 - THE TWO ARTIFACT PAYLOADS THAT WERE REFUSED AT A POOL (2026-09-04)

Two of V3's nine payloads carried a refusal that was never about the
payload. **The Wabbajack** could not transform a city watchman, because
`createCityGuards` exposed no removal door - and in the STREET the arm
handed a struck watchman to the ENCOUNTER pool's `removeFoe`. That was
not a leak (the remover never looks a record up in `foes`, so it tore
the watchman down exactly as `removeGuard` does); it was the wrong
OWNER, with an encounter-pool `notifyDestroyed()` reaching a record
that carries no quest behaviour. **SoulBound's break release and the
Sanguine Rose's Daedroth**
could not be stood inside a building, on a premise ("interiors have no
foe pool") that had died the day `interiorFoes.spawnFoe` went live.

Both are shipped: `cityGuards.removeGuard` is
WabbajackEffect.cs:86's `SetActive(false)`, both hosts route the
transform by POOL MEMBERSHIP through it (the re-stand stays the
encounter pool's - `careerIDs` is seventeen monsters and no watch,
:24-44), and `worldModes.standInteriorLooseFoe` is
CreateFoe.PlaceFoeBuildingInterior (CreateFoe.cs:219-233), reached by
both hosts that mount the mode machine. The finding, the C# and the
pool-side laws are recorded in Characters-Arc's ROAD-G G1 section;
pinned in `test/roadg_pools.test.js` and the rewritten EC1 pins in
`test/enchantpool.test.js`.
