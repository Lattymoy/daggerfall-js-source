// WARDEN-STRIKE (FIELD BUGS 2026-09-29g, ! OG: "Magic enchantments on strike from weapons broke. Doesn't work at all").
// On the Oblivion Gate's Warden it did not. AUDIT WBX F2 routed a Cast When Strikes spell on his stand-in
// (`spareGear`) to the court's own spell door through the enchant ctx's `bossSpell` - and only the DUNGEON context's
// mount passes it, a mount the hosted route never runs (worldModes builds the court with `enchantCtx: false`; the
// outer host's mount is the live one). The world host's and the fixed-city host's mounts passed none, so in the real
// game the spell went nowhere. They route it to the live court now (`modes.dungeonCtx.spellOnBoss`).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setDefaultEnchantCtx, ENCHANTMENT_TYPES as T, PAYLOAD, doItemEnchantmentPayloads } from '../../src/systems/enchantments.js';
import { createEnchantCtx } from '../../src/scenes/hostEnchant.js';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
/** The host's own `bossSpell` line, lifted off its source and run over the modes it is handed. */
const hostBossSpell = (file, modes) => {
  const m = /\n {6}bossSpell: ([^\n]*?),   \/\/ WARDEN-STRIKE/.exec(read(file));
  assert.ok(m, `${file} hands its enchant ctx a bossSpell`);
  return new Function('modes', `return (${m[1]});`)(modes);
};

const FIRE = { index: 7, name: 'Wizard\'s Fire', rangeType: 1, element: 0, effects: [] };
const player = { isPlayer: true, level: 20, skills: new Array(40).fill(100), stats: { strength: 100, agility: 100, luck: 100, speed: 50 }, items: [], activeEffects: [], health: 100, maxHealth: 100 };
const blade = () => ({ name: 'Saber', templateIndex: 117, material: 0, group: 'Weapons', currentCondition: 1000, maxCondition: 1000, enchantments: [{ type: T.CastWhenStrikes, param: 7 }] });
const warden = { spareGear: true, isPlayer: false, level: 30, stats: {}, skills: new Array(40).fill(1), activeEffects: [], health: 1000, maxHealth: 1000 };

/** A Cast When Strikes spell on the Warden under `file`'s own mount: to the live court's door, and with none, nowhere. */
function strikesTheWarden(file) {
  {
    const met = [];
    const modes = { dungeonCtx: { spellOnBoss: (r) => { met.push(r); return true; } } };
    const foeCasts = [];
    const magic = { applySpellToFoe: (r) => foeCasts.push(r), applySpellToPlayer: () => {} };
    setDefaultEnchantCtx(createEnchantCtx({ playerEntity: player, spellsByIndex: () => new Map([[7, FIRE]]), now: () => 0, sinks: {}, magic, foes: () => [], foeSinks: () => ({}), bossSpell: hostBossSpell(file, modes) }));
    try {
      doItemEnchantmentPayloads(PAYLOAD.Strikes, blade(), { entity: player, target: warden, damage: 12 });
      assert.deepEqual([met.map((r) => r.name), foeCasts.length], [['Wizard\'s Fire'], 0], 'the spell met him by his own door');
      modes.dungeonCtx = null;   // above ground: no court
      doItemEnchantmentPayloads(PAYLOAD.Strikes, blade(), { entity: player, target: warden, damage: 12 });
      assert.equal(met.length, 1, 'nowhere, and no throw');
    } finally { setDefaultEnchantCtx(null); }
  }
}

test('WARDEN-STRIKE: the world host\'s enchant ctx takes a Cast When Strikes spell on the Warden to the live court\'s spell door - and outside a dungeon, nowhere, without a throw (mutant: the host\'s bossSpell dropped)', () => strikesTheWarden('src/scenes/world.js'));

test('WARDEN-STRIKE: the fixed-city host\'s (?town) enchant ctx the same (mutant: its bossSpell swallowing the spell)', () => strikesTheWarden('src/scenes/exterior.js'));

test('WARDEN-STRIKE: the premise - the hosted court mounts no ctx of its own, and hands its spell door to the outer host (mutants: the door not on the api; opened outside a court)', () => {
  assert.match(read('src/scenes/worldModes.js'), /\n\s*enchantCtx: false,/, 'hosted, the dungeon context mounts none');
  const d = read('src/scenes/dungeonContext.js');
  assert.match(d, /const api = \{\n(?:\s*\/\/[^\n]*\n)*\s*spellOnBoss: \(record, target = null\) => \(opts\.gateBoss \? spellOnStandIn\(record, target\) : false\),/, 'the api carries the door, shut outside a court (AUDIT WB11 W1: by the stand-in it met)');
});
