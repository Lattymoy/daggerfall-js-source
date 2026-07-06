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

## Queue
- S2: inventory core (stacks, equip table generalized from E4b,
  weight) + corpse pickup + dungeon treasure piles (Ledger row) +
  interior containers.
- S3: character creation (the real PlayerEntity - clears the
  maxHealth/skills/stats interims; TallySkill, proficiency/racial
  mods unlock).
- S4: magic foundation (spell records, CastSpell action flag,
  DrainMagicka real, MI loot unlocks).
- Later: quests, guilds, shops, dialog, calendar deep-wiring,
  save format.
