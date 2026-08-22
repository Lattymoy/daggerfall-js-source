// AUDIT 23 fix pins, wave 3: the magic cluster.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSpellsStd, SPELL_RECORD_SIZE } from '../src/formats/spellsStd.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dcSrc = () => readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
const hmSrc = () => readFileSync(join(root, 'src/scenes/hostMagic.js'), 'utf8');   // M3: the cast laws' one home

/** One synthetic 89-byte SPELLS.STD record. */
const record = ({ index, e0type, e0sub }) => {
  const b = new Uint8Array(SPELL_RECORD_SIZE);
  const v = new DataView(b.buffer);
  v.setInt8(0, e0type); v.setInt8(1, e0sub);
  v.setInt8(2, -1); v.setInt8(3, -1); v.setInt8(4, -1); v.setInt8(5, -1);
  b[73] = index;
  return b;
};

test('AUDIT 23 magic-1: the classic Free Action patch - spell 10 (3,2) reads as (26,-1)', () => {
  // EntityEffectBroker.cs:892-900: "Fix bad Free Action spell data
  // from SPELLS.STD at runtime" - index 10, effect 0 only, and only
  // when the bytes really say Cure Paralyzation.
  const bytes = new Uint8Array(3 * SPELL_RECORD_SIZE);
  bytes.set(record({ index: 10, e0type: 3, e0sub: 2 }), 0);
  bytes.set(record({ index: 11, e0type: 3, e0sub: 2 }), SPELL_RECORD_SIZE);      // another spell with the same bytes: untouched
  bytes.set(record({ index: 10, e0type: 5, e0sub: 1 }), 2 * SPELL_RECORD_SIZE); // index 10 with DIFFERENT bytes: untouched
  const spells = readSpellsStd(bytes);
  assert.equal(spells[0].effects[0].type, 26);
  assert.equal(spells[0].effects[0].subType, -1);
  assert.deepEqual([spells[1].effects[0].type, spells[1].effects[0].subType], [3, 2]);
  assert.deepEqual([spells[2].effects[0].type, spells[2].effects[0].subType], [5, 1]);
});

test('AUDIT 23 magic-1: the real SPELLS.STD spell 10 is Free Action after the patch', (t) => {
  if (!process.env.ARENA2_PATH) return t.skip('ARENA2_PATH not set');
  const spells = readSpellsStd(new Uint8Array(readFileSync(join(process.env.ARENA2_PATH, 'SPELLS.STD'))));
  const ten = spells.find((s) => s.index === 10);
  assert.equal(ten.name, 'Free Action');
  assert.equal(ten.effects[0].type, 26);
  assert.equal(ten.effects[0].subType, -1);
});

test('AUDIT 23 magic-2: a wall hit explodes an AreaAtRange payload at the impact point', () => {
  // DaggerfallMissile.cs:399-402 DoCollision - the port retired wall
  // hits with no payload. The wall branch now carries the explode arm.
  const src = dcSrc();
  const i = src.indexOf('const hitWall = collider.raycast');
  assert.ok(i > 0);
  const branch = src.slice(i, src.indexOf('m.pos[0] += m.dir[0] * step', i));
  assert.ok(branch.includes("m.spell?.rangeType === 4"), 'the wall branch tests AreaAtRange');
  assert.ok(branch.includes('explodeAt(impact'), 'and explodes at the impact point');
  assert.ok(branch.includes('m.pos[0] + m.dir[0] * hitWall'), 'impact = pos + dir * hit distance');
});

test('AUDIT 23 magic-4: every spending cast arm tallies the effect schools', () => {
  // EntityEffectManager.cs:2106-2108 + TallyPlayerReadySpellEffectSkills
  // (:1964-1978): the four playerCastInput arms that spend all tally.
  const src = hmSrc();   // M3: the arms live in the engine
  // AUDIT 24 scenes moved the CasterOnly arm's lastCastCost stamp below
  // its payload (EntityEffectManager.cs:2117 vs :2138), so the tally is
  // matched on its own - it is what this pin is about.
  const spends = src.match(/playerEntity\.magicka -= cost;\n(?:\s*lastCastCost = cost;\n)?\s*tallyCastSkills\(sp\);/g) ?? [];
  assert.equal(spends.length, 4, 'CasterOnly, ByTouch, AreaAroundCaster and the missile arm all tally');
  assert.equal((src.match(/lastCastCost = cost;/g) ?? []).length, 4, 'and all four still record the cost');
  // the tally gates on the cost table (DFU's effect != null), not the
  // priced-as-Destruction default
  assert.ok(/function tallyCastSkills\(sp\) \{[\s\S]*?EFFECT_COST_TABLE\[`\$\{e\.type\},\$\{e\.subType & 0xff\}`\]/.test(src));
});

test('AUDIT 23 magic-5: the self-cast absorb cap sees the wrapper and the spent cost', () => {
  // EntityEffectManager.cs:600-604. The unit half (cap math on the
  // {entity, sinks} wrapper) is pinned in absorption.test.js; this
  // pins the WIRING - the cost reaches the ctx at all.
  const src = hmSrc();   // M3
  assert.ok(src.includes('lastCastCost = cost;'), 'player casts record the spent cost');
  assert.ok(/selfCastCost: lastCastCost/.test(src), 'applySpellToPlayer forwards it as ctx.selfCastCost');
  const fx = readFileSync(join(root, 'src/systems/effects.js'), 'utf8');
  assert.ok(fx.includes('caster?.entity === target'), 'the cap compares the wrapper ENTITY to the target');
});

test('AUDIT 23 magic-14: readying enforces the cost and CasterOnly casts instantly', () => {
  // EntityEffectManager.cs:337-343 (youDontHaveTheSpellPoints at
  // ready) and :350-351 (instantCast for CasterOnly).
  const src = hmSrc();   // M3: the ready laws live in the engine
  // L2-slice: the signature grew the { free } option (magic-8), so
  // the needle pins the prefix.
  const i = src.indexOf('function readySpell(sp');
  const arm = src.slice(i, src.indexOf('\n  }\n', i));
  assert.ok(arm.includes("say(\"You don't have the spell points.\")"), 'the classic refusal line at ready');
  assert.ok(arm.includes('if (sp.rangeType === 0) { castInput(null, null); return; }'), 'CasterOnly fires on ready, no click latch');
  assert.ok(arm.indexOf('calculateCastCost') < arm.indexOf('readiedSpell = sp;'), 'the cost gate sits before the assignment');
});

test('AUDIT 23 magic-15: a silenced enemy cannot spend a cast; the free rider bypasses', () => {
  // EntityEffectManager.cs:315 - SetReadySpell's SilenceCheck runs for
  // enemies, gated on !noSpellPointCost exactly like the cost.
  // X3: the executor is SHARED (characters/enemyCasting.js) - the
  // gate law lives there; both hosts bind it.
  const src = readFileSync(join(root, 'src/characters/enemyCasting.js'), 'utf8');
  const i = src.indexOf('export function castEnemySpell');
  const fn = src.slice(i);
  assert.ok(fn.includes('if (!noSpellPointCost && silenceBlocksCast(f.entity)) return false;'));
  assert.ok(fn.indexOf('silenceBlocksCast') < fn.indexOf('magicka'), 'the gate sits before the spend');
});
