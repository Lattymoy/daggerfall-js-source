// The pure half of tools/extract-enemy-basics.mjs, so the SAME code
// that regenerates src/characters/enemyBasics.js can be re-run inside
// a test and diffed against the checked-in module.
//
// AUDIT 24 (wave 23) split this out. The generator asserted C3 parity
// when a human ran it and nothing ran it in CI, so a column the
// extraction never looked at - SoulPts, on 32 of the 62 entries -
// was invisible from both sides: absent from the port, and absent
// from every pin, because every pin read the port. THE GATE MUST
// RE-EXTRACT FROM THE SOURCE.

const MATERIALS = { None: -1, Iron: 0, Steel: 1, Silver: 2, Elven: 3, Dwarven: 4, Mithril: 5, Adamantium: 6, Ebony: 7, Orcish: 8, Daedric: 9 };

/** The Enemies[] initialiser block, source text. Shared so a gate can
 *  scan the SAME region the extraction reads.
 *
 *  AUDIT 24 (wave 23): the `=== -1` guard is load-bearing and the
 *  first draft of the gate dropped it. `// Custom enemies` is not in
 *  the vendored tree, so `indexOf('};', -1)` searched from ZERO and
 *  answered a brace 18k characters BEFORE the table - a backwards
 *  slice, an empty string, and a "no dropped columns" verdict that
 *  had scanned nothing at all. A PIN THAT SCANS AN EMPTY STRING
 *  PASSES EVERYTHING. */
export function sliceEnemyTable(src) {
  const tableStart = src.indexOf('static MobileEnemy[] Enemies = new MobileEnemy[]');
  if (tableStart < 0) throw new Error('EnemyBasics.cs: Enemies[] table not found');
  const custom = src.indexOf('// Custom enemies', tableStart);
  const tableEnd = src.indexOf('};', custom === -1 ? tableStart : custom);
  if (tableEnd <= tableStart) throw new Error('EnemyBasics.cs: Enemies[] table end not found');
  return src.slice(tableStart, tableEnd);
}

/** Extract the ENEMY_BASICS table from EnemyBasics.cs + SoundClips.cs
 *  source text. Pure: no filesystem, no imports of the port. */
export function extractEnemyBasics(src, soundClipsSrc) {
  const SOUNDCLIPS = Object.fromEntries(
    [...soundClipsSrc.matchAll(/^\s*(\w+) = (\d+),/gm)].map((m) => [m[1], Number(m[2])]));
  const field = (b, k) => { const m = b.match(new RegExp(`\\b${k} = ([^,\\n]+),`)); return m ? m[1].trim() : null; };
  const num = (v) => (v === null ? null : Number(v));
  // An anim-frame element is a C# CONSTANT EXPRESSION, not a literal:
  // EnemyBasics.cs:1066 has a missing comma, so the Orc Warlord's
  // PrimaryAttackAnimFrames3 element `4 -1` is the binary expression
  // 4 - 1 = 3 (a DFU typo the compiler evaluates - reproduced, not
  // corrected). Bare Number('4 -1') is NaN, which JSON-serialises to
  // null; sum the whitespace-separated signed terms instead, and hard
  // fail on anything that is not an integer so a future regeneration
  // can never silently emit null again.
  function animFrame(s, id, key) {
    const v = s.trim().split(/\s+/).map(Number).reduce((a, b) => a + b, 0);
    if (!Number.isInteger(v)) throw new Error(`ASSERT FAIL: enemy ${id} ${key} element "${s.trim()}" -> ${v}`);
    return v;
  }

  const table = sliceEnemyTable(src);
  const blocks = table.split('new MobileEnemy()').slice(1);

  const out = {};
  for (const b of blocks) {
    const id = num(field(b, 'ID'));
    if (id === null) continue;
    // Stub entries (e.g. 39 Horse, "unused") carry only an ID; C# struct
    // defaults apply: textures 0, Behaviour General (first member),
    // Affinity None, MinMetalToHit 0 (default(enum)) - matches what C3
    // emitted for them.
    const e = {
      maleTexture: num(field(b, 'MaleTexture')) ?? 0,
      femaleTexture: num(field(b, 'FemaleTexture')) ?? 0,
      behaviour: (field(b, 'Behaviour') || 'MobileBehaviour.General').replace('MobileBehaviour.', ''),
      affinity: (field(b, 'Affinity') || 'MobileAffinity.None').replace('MobileAffinity.', ''),
    };
    const corpse = b.match(/CorpseTexture = CorpseTexture\((\d+),\s*(\d+)\)/);
    if (corpse) e.corpseTexture = { archive: Number(corpse[1]), record: Number(corpse[2]) };
    const mm = field(b, 'MinMetalToHit');
    e.minMetalToHit = mm ? MATERIALS[mm.replace('WeaponMaterialTypes.', '')] : 0;   // absent -> C# default(enum) = 0
    // AUDIT 24 (wave 23): SoulPts is on the struct
    // (DaggerfallUnityStructs.cs:216, "Number of enchantment points in a
    // trapped soul of this enemy") and 32 of the 62 entries set it. The
    // extraction dropped the whole column, so ItemBuilder.cs:303's
    // `newItem.value = 5000 + mobileEnemy.SoulPts` and :626's
    // enchantment value had no data to read on this side.
    for (const k of ['MinDamage', 'MaxDamage', 'MinDamage2', 'MaxDamage2', 'MinDamage3', 'MaxDamage3', 'MinHealth', 'MaxHealth', 'Level', 'ArmorValue', 'Weight', 'MapChance', 'SoulPts', 'BloodIndex', 'ChanceForAttack2', 'ChanceForAttack3', 'ChanceForAttack4', 'ChanceForAttack5']) {
      const v = num(field(b, k));
      if (v !== null) e[k[0].toLowerCase() + k.slice(1)] = v;
    }
    // C11 mobile sprites: HasIdle + the attack frame SEQUENCES (the -1
    // entry is the damage marker) with the chance-rolled variants 2-5.
    if (/HasIdle = true/.test(b)) e.hasIdle = true;
    // C14: the Spell anim state - HasSpellAnimation routes to records
    // 20-24 (RangedAttack1Anims); everyone else casts over the primary
    // records. Orc Shaman (21) is the only true-anim monster.
    if (/HasSpellAnimation = true/.test(b)) e.hasSpellAnimation = true;
    // C17: class-enemy archer anims (records 20-24 with the -1 shoot marker)
    if (/HasRangedAttack1 = true/.test(b)) e.hasRangedAttack1 = true;
    if (/HasRangedAttack2 = true/.test(b)) e.hasRangedAttack2 = true;
    for (const k of ['PrimaryAttackAnimFrames', 'PrimaryAttackAnimFrames2', 'PrimaryAttackAnimFrames3', 'PrimaryAttackAnimFrames4', 'PrimaryAttackAnimFrames5', 'SpellAnimFrames', 'RangedAttackAnimFrames', 'SeducerTransform1Frames', 'SeducerTransform2Frames']) {
      const m = b.match(new RegExp(`\\b${k} = new int\\[\\] \\{([^}]+)\\}`));
      if (m) e[k[0].toLowerCase() + k.slice(1)] = m[1].split(',').map((s) => animFrame(s, id, k));
    }
    // AUDIT 24 characters-0: an entry that omits Team takes the STRUCT
    // default, and MobileTeams' zero member is PlayerEnemy
    // (DaggerfallUnityEnums.cs:262-264) - not "none". Only the Horse
    // (ID 39, `new MobileEnemy() { ID = 39, }`) leaves it out.
    const team = field(b, 'Team');
    e.team = team ? team.replace('MobileTeams.', '') : 'PlayerEnemy';
    const loot = b.match(/LootTableKey = "(.)"/);
    if (loot) e.lootTableKey = loot[1];
    if (/CanOpenDoors = true/.test(b)) e.canOpenDoors = true;
    // AUDIT 18: ParrySounds ("plays parry sounds when attacks against
    // this enemy miss", DaggerfallUnityStructs.cs:208) was dropped by
    // the E3a extraction; it is the gate WeaponManager.cs:609-615 and
    // EnemyAttack.cs:371-373 read on a zero-damage hit.
    if (/ParrySounds = true/.test(b)) e.parrySounds = true;
    if (/CastsMagic = true/.test(b)) e.castsMagic = true;
    if (/SeesThroughInvisibility = true/.test(b)) e.seesThroughInvisibility = true;   // P13: the illusion-gate exemption
    // AUDIT 24 (wave 23): five more columns the extraction never
    // looked at, all with real DFU consumers. NoShadow gates the
    // shadow caster and GlowColor the point light
    // (SetupDemoEnemy.cs:137-148); HasSeducerTransform1/2 select the
    // Lamia/Seducer transform anim sets (DaggerfallMobileUnit.cs:850);
    // PrefersRanged is the AI's own preference flag
    // (DaggerfallUnityStructs.cs:190). FLAGGED: the port has no
    // consumer for any of them yet - they are DATA now, so the gate
    // can see them and the slice that needs them will find them here.
    if (/NoShadow = true/.test(b)) e.noShadow = true;
    if (/HasSeducerTransform1 = true/.test(b)) e.hasSeducerTransform1 = true;
    if (/HasSeducerTransform2 = true/.test(b)) e.hasSeducerTransform2 = true;
    if (/PrefersRanged = true/.test(b)) e.prefersRanged = true;
    if (/PrefersNoise = true/.test(b)) e.prefersNoise = true;
    // `GlowColor = new Color(18, 68, 88) * 0.1f` - Unity's Color
    // operator* scales every channel INCLUDING alpha, and the
    // constructor's 3-arg overload leaves a = 1, so the product's
    // alpha is the scalar. Stored as the four post-multiply channels.
    const glow = b.match(/GlowColor = new Color\(([^)]*)\)\s*\*\s*([\d.]+)f/);
    if (glow) {
      const [r, g, bl] = glow[1].split(',').map((v) => Number(v.trim()));
      const k = Number(glow[2]);
      e.glowColor = { r: r * k, g: g * k, b: bl * k, a: k };
    }
    // A1: the sound columns (MoveSound/BarkSound/AttackSound) -
    // (int)SoundClips.X resolved to DAGGER.SND indices via SoundClips.cs
    for (const k of ['MoveSound', 'BarkSound', 'AttackSound']) {
      const f = b.match(new RegExp(k + String.raw` = \(int\)SoundClips\.(\w+)`));
      if (f && SOUNDCLIPS[f[1]] !== undefined) e[k[0].toLowerCase() + k.slice(1)] = SOUNDCLIPS[f[1]];
    }
    out[String(id)] = e;
  }
  return out;
}
