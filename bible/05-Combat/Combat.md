# Combat

**Core scope SHIPPED via Characters C8** (the phase plan named
"FormulaHelper, weapons, enemy AI" - all three landed inside the
enemy-rigs arc; full records live in 04-Characters/Characters-Arc.md):
- FormulaHelper port: src/combat/formulas.js (to-hit chain, damage
  paths, backstab, materials, body parts - verbatim, roll-injectable).
- Weapons: the shared weaponStates machine (player + enemies), player
  melee (src/combat/playerWeapon.js), enemy equipment + per-part armor
  (src/combat/enemyEquipment.js).
- Enemy AI: senses/pursuit (enemyMotor), attacks (enemyAttack), the
  entity layer (enemyEntity + CLASS*.CFG + MONSTER.BSA careers).

**Shipped here (routed rows):**
- RDB effect actions Hurt21-25 / Poison / DrainMagicka
  (src/world/actionSystem.js EFFECT_ACTION_FLAGS): Hurt21 fires every
  20th activation with the verbatim exclusive Range * level; Hurt22-25
  every activation (IsFlat ? Magnitude : AxisRaw) * level; Poison is
  DFU's OWN empty delegate, preserved; DrainMagicka is an INTERIM
  no-op until the magicka stat (Systems). Traps damage the shared
  player entity with or without ?foes.

**Remaining (queue):**
- CastSpell action flag: SHIPPED via Systems S4b (trap-spell missiles
  + the classic damage family through the verbatim saving throw; the
  wider effect library remains Systems work).
- Bows in-world: SHIPPED. Arrows ride the S5 missile system as
  weapon-carrying missiles (element None) rendered as the oriented
  99800 model through dynamicDraws; the player's bow (?weapon=bow,
  Short Bow template 129 - the equip UI pends) looses on the strike
  frame along the view-matrix forward and tallies Archery; enemy
  archers (equipped-bow foes) attack from SIGHT (the melee-distance
  gate is melee's) and loose at the player; hits resolve through
  calculateAttackDamage with the bow BOTH directions, and a landed
  arrow adds ONE recoverable Arrow to the TARGET'S items (BowDamage's
  classic charm). Crouch pass-over pends.
- Trigger-on-collision: SHIPPED. DaggerfallAction.Receive's verbatim
  trigger gate lands in the action system (TRIGGER_GATE: each RDB
  TriggerFlag's accepted types; chains always valid; undefined flags
  never fire; player activation is now the typed Direct trigger -
  fixture movers gained real lever flags); effect objects carry their
  placement AABB and a per-frame pass fires WalkOn/WalkInto with the
  component's exact semantics - 0.12s per-object timeout, only while
  the player actively moves HORIZONTALLY (classic ignores up/down/
  jump), contact beneath -> WalkOn; movers carry their AT-REST bounds and
  trigger only while parked (audit 06f closed the step-on-platform
  gap). The Combat build queue is EMPTY;
  remaining Combat-adjacent work lives in Systems (effect library)
  and UI.
- Systems-shared interims tracked in the Home ledger: TallySkill,
  proficiency/racial mods, poisoned weapons, stealth checks.

## The FP weapon: the TRUE classic method (design pivot 2026-08-17, Mac-directed)

The voxel FP viewmodel (C8 E3d + the 2026-08-16 framing fix) is ON
ICE, not deleted: Mac's call is the Daggerfall method 1:1 with the
true art. combat/fpsWeapon.js is the live path - WEAPON*.CIF frames
(WEAPO1xx enchanted variants included) through the shared CifRciFile
reader, ItemHelper's template-index -> WeaponType mapping, the metal
dye over palette band 0x70-0x7F (dyes.js tables), and FPSWeapon's
320x200 screen-space alignment verbatim. The DFU-verbatim swing
STATE MACHINE (weaponStates.js), the hit resolution, drag-to-swing,
the touch attack button, and the audio seams are all untouched - only
the render swapped. S19's ShowWeapons(false)-while-paralyzed gate
carried through the pivot.

THE ICED SURFACE stays whole for a reversible thaw: characterSprite's
drawFirstPersonViewmodel, anims' ATTACKS_FP sweeps, PlayerWeapon's
pose() with its units pins, and tools/fpProbe.mjs - each annotated ON
ICE at the site. tools/fpsWeaponProbe.mjs is the live path's standing
probe (real ARENA2 CIFs headless; zero coverage in any state is the
failure class the voxel path shipped for six weeks). Gallery:
public/visual-changes/combat-fp/classic-weapon/. Departures at the
module head: no FlipHorizontal (right-hand only until a settings
surface), weaponOffsetHeight 0 (no large HUD yet). Follow-up rollout:
the exterior/interior hosts (the voxel path was dungeon-only too).
