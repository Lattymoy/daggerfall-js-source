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
  jump), contact beneath -> WalkOn. The Combat build queue is EMPTY;
  remaining Combat-adjacent work lives in Systems (effect library)
  and UI.
- Systems-shared interims tracked in the Home ledger: TallySkill,
  proficiency/racial mods, poisoned weapons, stealth checks.
