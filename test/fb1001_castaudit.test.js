// AUDIT 2026-10-01 part five (Mac: "audit this") - CAST-USE, on the real engines (two createPlayerMagic, the street's and
// the dungeon's, over one player), the real createEnchantCtx mounted through liveCastEngine, the real useItem:
//   CU1 a ready held when the mode flips was still on the other engine - one taken down the stairs (a touch ready lets the
//      dungeon door through) fired at the first click back outside, one held at the way out died with the dungeon's
//      engine, the item's condition spent and no spell cast;
//   CU2 the dungeon's ready line priced an item's free ready at the spell's full price ("Ice Storm (150)", the click
//      spending 0);
//   CU3 Cast When Strikes underground goes through the dungeon's engine both ways - true, and unpinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { createEnchantCtx } from '../src/scenes/hostEnchant.js';
import * as shared from '../src/scenes/shared.js';
import { setDefaultEnchantCtx, ENCHANTMENT_TYPES, doItemEnchantmentPayloads, PAYLOAD } from '../src/systems/enchantments.js';
import { useItem } from '../src/systems/useItem.js';
import '../src/systems/effects.js';   // the cast doors register at its tail

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const fx = (type, subType) => ({ type, subType, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
  magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 });
const SPELLS = new Map([
  [20, { index: 20, name: 'Ice Storm', element: 1, rangeType: 4, effects: [fx(4, 0)] }],
  [31, { index: 31, name: 'Shock', element: 3, rangeType: 1, effects: [fx(4, 0)] }],
]);
const item = (type, param) => ({ name: 'Bracer', templateIndex: 135, group: 'Jewellery', currentCondition: 100, maxCondition: 100, enchantments: [{ type, param }] });
function host({ foes = [] } = {}) {
  const player = { isPlayer: true, level: 5, health: 50, maxHealth: 100, magicka: 100, maxMagicka: 100, fatigue: 100, items: [], activeEffects: [],
    skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {} };
  const sinks = { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} };
  const engine = () => createPlayerMagic({ renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} }, getTexture: async () => null, uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity }, playerEntity: player, playerSinks: sinks, say() {}, surfacePlayer() {},
    foes: () => [], foeSinks: () => sinks, absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.99 });
  const street = engine(), dungeon = engine();
  const modes = { mode: 'exterior', dungeonCtx: null };
  setDefaultEnchantCtx(createEnchantCtx({ playerEntity: player, spellsByIndex: () => SPELLS, now: () => 0, sinks,
    foes: () => foes, foeSinks: () => sinks, magic: () => shared.liveCastEngine(modes.mode, modes.dungeonCtx, street) }));
  return { player, street, dungeon, modes };
}

test('AUDIT CAST-USE CU1: a ready taken across a mode flip goes with the player - free and at its stored price (worldModes hands it at each flip)', () => {
  try {
    const h = host();
    useItem(item(ENCHANTMENT_TYPES.CastWhenUsed, 31), h.player.items, { entity: h.player, isEnchanted: () => true });
    assert.equal(h.street.readied()?.name, 'Shock');
    assert.equal(typeof h.street.handReadyTo, 'function', 'the engine can hand its ready on');
    h.street.handReadyTo(h.dungeon);
    assert.equal(h.street.readied(), null, 'nothing left behind on the street');
    assert.equal(h.dungeon.readied()?.name, 'Shock', 'armed underground');
    assert.equal(h.dungeon.readiedCost(), 0, 'still the item\'s free ready');
    // and free where it fires: an Ice Storm carried down costs nothing at the click (its 150 would be refused at 100 magicka)
    useItem(item(ENCHANTMENT_TYPES.CastWhenUsed, 20), h.player.items, { entity: h.player, isEnchanted: () => true });
    h.dungeon.takeReady({});   // the Shock's ready set aside
    h.street.handReadyTo(h.dungeon);
    const mk = h.player.magicka;
    h.player.isSilenced = true;   // a free ready passes the silence gate (SilenceCheck is gated on its cost) - a paid one would not
    h.dungeon.interceptAttack(true);
    assert.equal(h.dungeon.firePending([0, 1, 0], [0, 0, 1]), true, 'the click casts it');
    assert.equal(h.dungeon.missileCount(), 1);
    assert.equal(h.player.magicka, mk, 'and spends no magicka, silenced or not - still the item\'s');
    h.player.isSilenced = false;
    const M = src('src/scenes/worldModes.js');
    const enter = M.slice(M.indexOf("setMode('dungeon');"), M.indexOf("setMode('dungeon');") + 1200);
    assert.match(enter, /magic\?\.handReadyTo\?\.\(ctx\.castEngine\);/, 'down: handed as the mode flips');
    assert.match(M, /\n\s+enchantCtx: false,\n\s+outerCastEngine: \(\) => magic,/, 'the hosted dungeon is told where a ready goes on the way out');
    assert.match(src('src/scenes/dungeonContext.js'), /magic\.handReadyTo\(opts\.outerCastEngine\?\.\(\) \?\? null\);[^\n]*\n\s+magic\.destroy\(\);/, 'up (the door, a Recall, a load): handed before the engine dies');
  } finally { setDefaultEnchantCtx(null); }
});

test('AUDIT CAST-USE CU2: the dungeon\'s ready line prices a free ready at what the click spends (0), a paid one at its stored price', () => {
  try {
    const h = host();
    h.modes.mode = 'dungeon'; h.modes.dungeonCtx = { castEngine: h.dungeon };
    useItem(item(ENCHANTMENT_TYPES.CastWhenUsed, 20), h.player.items, { entity: h.player, isEnchanted: () => true });
    assert.equal(typeof h.dungeon.readiedCost, 'function');
    assert.equal(h.dungeon.readiedCost(), 0);
    assert.match(src('src/scenes/dungeonContext.js'), /\$\{shownSpellName\(magic\.readied\(\)\)\} \(\$\{magic\.readiedCost\(\)\}\)/);
  } finally { setDefaultEnchantCtx(null); }
});

test('AUDIT CAST-USE CU3: Cast When Strikes underground lands through the dungeon\'s engine - on a foe, and on the player (mutants: either door on the mount-time engine)', () => {
  try {
    const foe = { entity: { level: 3, health: 50, maxHealth: 50, activeEffects: [], items: [] }, ai: { feet: [0, 0, 0], isHostile: true } };
    const h = host({ foes: [foe] });
    h.modes.mode = 'dungeon'; h.modes.dungeonCtx = { castEngine: h.dungeon };
    const calls = { street: [], dungeon: [] };
    for (const k of ['street', 'dungeon']) for (const door of ['applySpellToFoe', 'applySpellToPlayer']) {
      const real = h[k][door]; h[k][door] = (...a) => { calls[k].push(door); return real(...a); };
    }
    const blade = item(ENCHANTMENT_TYPES.CastWhenStrikes, 20);
    doItemEnchantmentPayloads(PAYLOAD.Strikes, blade, { entity: h.player, target: foe.entity, damage: 5 });
    doItemEnchantmentPayloads(PAYLOAD.Strikes, blade, { entity: foe.entity, target: h.player, damage: 5 });
    assert.deepEqual(calls.dungeon, ['applySpellToFoe', 'applySpellToPlayer']);
    assert.deepEqual(calls.street, []);
  } finally { setDefaultEnchantCtx(null); }
});
