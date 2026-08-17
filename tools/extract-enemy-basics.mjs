// Regenerate src/characters/enemyBasics.js from DFU's EnemyBasics.cs
// Enemies table (MIT, Daggerfall Workshop). C3 extracted the visual
// fields; E3a re-extracts with the combat/entity fields. HARD RULE:
// the three C3 fields must come out byte-identical for every existing
// key - asserted below against the current module before writing.
// Usage: node tools/extract-enemy-basics.mjs /path/to/EnemyBasics.cs
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const src = readFileSync(process.argv[2], 'utf8');
// SoundClips.cs rides next to EnemyBasics.cs's tree (Assets/Scripts/SoundClips.cs)
import { dirname, join } from 'node:path';
const scPath = process.argv[3] || join(dirname(process.argv[2]), '..', 'SoundClips.cs');
const SOUNDCLIPS = Object.fromEntries(
  [...readFileSync(scPath, 'utf8').matchAll(/^\s*(\w+) = (\d+),/gm)].map((m) => [m[1], Number(m[2])]));
const tableStart = src.indexOf('static MobileEnemy[] Enemies = new MobileEnemy[]');
const tableEnd = src.indexOf('};', src.indexOf('// Custom enemies', tableStart) === -1 ? tableStart : src.indexOf('// Custom enemies', tableStart));
const table = src.slice(tableStart, tableEnd);
const blocks = table.split('new MobileEnemy()').slice(1);

const MATERIALS = { None: -1, Iron: 0, Steel: 1, Silver: 2, Elven: 3, Dwarven: 4, Mithril: 5, Adamantium: 6, Ebony: 7, Orcish: 8, Daedric: 9 };
const field = (b, k) => { const m = b.match(new RegExp(`\\b${k} = ([^,\\n]+),`)); return m ? m[1].trim() : null; };
const num = (v) => (v === null ? null : Number(v));

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
  for (const k of ['MinDamage', 'MaxDamage', 'MinDamage2', 'MaxDamage2', 'MinDamage3', 'MaxDamage3', 'MinHealth', 'MaxHealth', 'Level', 'ArmorValue', 'Weight', 'MapChance', 'ChanceForAttack2', 'ChanceForAttack3', 'ChanceForAttack4', 'ChanceForAttack5']) {
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
  for (const k of ['PrimaryAttackAnimFrames', 'PrimaryAttackAnimFrames2', 'PrimaryAttackAnimFrames3', 'PrimaryAttackAnimFrames4', 'PrimaryAttackAnimFrames5', 'SpellAnimFrames', 'RangedAttackAnimFrames']) {
    const m = b.match(new RegExp(`\\b${k} = new int\\[\\] \\{([^}]+)\\}`));
    if (m) e[k[0].toLowerCase() + k.slice(1)] = m[1].split(',').map((s) => Number(s.trim()));
  }
  const team = field(b, 'Team');
  if (team) e.team = team.replace('MobileTeams.', '');
  const loot = b.match(/LootTableKey = "(.)"/);
  if (loot) e.lootTableKey = loot[1];
  if (/CanOpenDoors = true/.test(b)) e.canOpenDoors = true;
  if (/CastsMagic = true/.test(b)) e.castsMagic = true;
  if (/SeesThroughInvisibility = true/.test(b)) e.seesThroughInvisibility = true;   // P13: the illusion-gate exemption
  // A1: the sound columns (MoveSound/BarkSound/AttackSound) -
  // (int)SoundClips.X resolved to DAGGER.SND indices via SoundClips.cs
  for (const k of ['MoveSound', 'BarkSound', 'AttackSound']) {
    const f = b.match(new RegExp(k + String.raw` = \(int\)SoundClips\.(\w+)`));
    if (f && SOUNDCLIPS[f[1]] !== undefined) e[k[0].toLowerCase() + k.slice(1)] = SOUNDCLIPS[f[1]];
  }
  out[String(id)] = e;
}

// Assert C3 parity before writing
const cur = (await import(pathToFileURL(new URL('../src/characters/enemyBasics.js', import.meta.url).pathname))).ENEMY_BASICS;
for (const [k, v] of Object.entries(cur)) {
  const n = out[k];
  if (!n) throw new Error(`ASSERT FAIL: key ${k} missing from re-extraction`);
  for (const f of ['maleTexture', 'femaleTexture', 'behaviour']) {
    if (n[f] !== v[f]) throw new Error(`ASSERT FAIL: ${k}.${f}: ${v[f]} -> ${n[f]}`);
  }
}
console.log(`ASSERT: C3 parity holds for ${Object.keys(cur).length} keys; re-extracted ${Object.keys(out).length}`);

const body = JSON.stringify(out, null, 1).replace(/"([a-zA-Z][a-zA-Z0-9]*)":/g, "'$1':").replace(/"/g, "'");
writeFileSync(new URL('../src/characters/enemyBasics.js', import.meta.url),
`// Enemy visual/behaviour/entity basics (Characters C3, re-extracted
// E3a with combat fields). Generated from DFU's EnemyBasics.cs
// Enemies table (MIT, Daggerfall Workshop): textures + Behaviour
// (C3, byte-identical parity asserted at generation) + affinity,
// corpse texture, MinMetalToHit (material index, None=-1), monster
// damage pairs 1-3 + health/level/armor, team, loot key, flags.
// Class entries (128+) carry no health/level/damage - those come
// from the career (CLASS*.CFG) + FormulaHelper, per SetEnemyCareer.
// Do not hand-edit; regenerate: node tools/extract-enemy-basics.mjs
export const ENEMY_BASICS = Object.freeze(${body});
`);
console.log('written');
