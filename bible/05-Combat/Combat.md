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
- CastSpell action flag + magic damage: blocked on the Systems magic
  arc.
- Bows in-world (the machine + clips exist; arrows/missiles need the
  projectile pass) - queued.
- Trigger-on-collision for WalkInto/WalkOn traps: pends a collider
  touch-event seam (chains + direct activation work today).
- Systems-shared interims tracked in the Home ledger: TallySkill,
  proficiency/racial mods, poisoned weapons, stealth checks.
