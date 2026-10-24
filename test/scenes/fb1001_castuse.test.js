// FIELD BUGS 2026-10-01 - #bug-reports, "'Cast when used' items don't work in dungeons": "I enchanted a bracer to cast
// Ice Storm when used, it works fine in the overworld, but as soon as I enter a dungeon, the spell doesn't activate."
// Another player: "only a fireball enchantment on the scarab". And: "they work in other interiors like shops and
// guilds, just not dungeons, where you'd be using them the most."
//
// TWO ENGINES, ONE CTX. The session's one enchant ctx (world.js / exterior.js setDefaultEnchantCtx) cast through the
// HOST's engine - and that engine is the live one above ground and indoors only (worldModes takes it for the interior
// arm). Underground the dungeon context builds and drives its OWN (dungeonContext.js createPlayerMagic: its
// playerAttackInput eats the click, its frame calls firePending), and the hosted dungeon mounts no ctx of its own
// (`enchantCtx: false`). So a Cast When Used spell that is not CasterOnly - Ice Storm, Fireball, any touch, bolt or
// area - was readied as a free ready on the street's engine, which never runs in a dungeon: the click swung the
// weapon, the item still lost 10 condition, and the spell sat stranded until the first click back outside fired it.
// Now the ctx asks for the LIVE engine (shared.js liveCastEngine) and the dungeon hands its own (`castEngine`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { createEnchantCtx } from '../../src/scenes/hostEnchant.js';
import * as shared from '../../src/scenes/shared.js';   // liveCastEngine, by namespace: absent before the fix, it fails as an assertion
import { setDefaultEnchantCtx, ENCHANTMENT_TYPES, DURABILITY_LOSS_ON_USE } from '../../src/systems/enchantments.js';
import { useItem } from '../../src/systems/useItem.js';
import { ITEM_GROUPS } from '../../src/characters/equipRules.js';
import '../../src/systems/effects.js';   // the cast doors register at its tail

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const fx = (type, subType) => ({ type, subType, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
  magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 });
const SPELLS = new Map([
  [20, { index: 20, name: 'Ice Storm', element: 1, rangeType: 4, effects: [fx(4, 0)] }],
  [14, { index: 14, name: 'Fireball', element: 0, rangeType: 4, effects: [fx(4, 0)] }],
  [16, { index: 16, name: 'Ice Bolt', element: 1, rangeType: 2, effects: [fx(4, 0)] }],
  [64, { index: 64, name: 'Heal', element: 4, rangeType: 0, effects: [fx(10, 8)] }],
]);
const castWhenUsed = (param) => ({ name: 'Bracer', templateIndex: 135, group: ITEM_GROUPS.Jewellery, currentCondition: 100, maxCondition: 100,
  enchantments: [{ type: ENCHANTMENT_TYPES.CastWhenUsed, param }] });

/** The world host as it stands: its own engine (the street's and every building's) and the dungeon context's, over
 *  one player; the one ctx mounted as world.js mounts it; the click and the frame go to the engine of the live mode
 *  (world.js's exterior frame, worldModes' interior arm, dungeonContext's playerAttackInput + frame). */
function host() {
  const player = { isPlayer: true, level: 5, health: 20, maxHealth: 100, magicka: 0, maxMagicka: 100, fatigue: 100, items: [], activeEffects: [],
    skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {} };
  const sinks = { hurt() {}, heal: (n) => { player.health = Math.min(player.maxHealth, player.health + n); }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} };
  const engine = (said) => createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity }, playerEntity: player, playerSinks: sinks, say: (l) => said.push(l), surfacePlayer() {},
    foes: () => [], foeSinks: () => sinks, absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.99,
  });
  const streetSaid = [], dungeonSaid = [];
  const street = engine(streetSaid);
  const dungeon = engine(dungeonSaid);
  const modes = { mode: 'exterior', dungeonCtx: null };
  setDefaultEnchantCtx(createEnchantCtx({
    playerEntity: player, spellsByIndex: () => SPELLS, now: () => 0, sinks,
    magic: () => shared.liveCastEngine(modes.mode, modes.dungeonCtx, street),   // world.js's mount
  }));
  const enter = (mode) => { modes.mode = mode; modes.dungeonCtx = mode === 'dungeon' ? { castEngine: dungeon } : modes.dungeonCtx; };
  const liveEngine = () => (modes.mode === 'dungeon' ? dungeon : street);
  const click = () => { const m = liveEngine(); m.interceptAttack(true); return m.firePending([0, 1, 0], [0, 0, 1]); };
  return { player, street, dungeon, streetSaid, dungeonSaid, enter, click, liveEngine };
}
const use = (h, it) => useItem(it, h.player.items, { entity: h.player, isEnchanted: () => true });

test('CAST-USE: the report - an Ice Storm bracer and a Fireball scarab, used in a dungeon, ready on the dungeon\'s engine and fire on the click; on the street and in a shop as ever (mutants: the host mounts its own engine; the dungeon hands none)', () => {
  try {
    for (const mode of ['exterior', 'interior', 'dungeon']) {
      for (const param of [20, 14, 16]) {
        const h = host();
        h.enter(mode);
        const it = castWhenUsed(param);
        use(h, it);
        assert.equal(h.liveEngine().spellArmed(), true, `${SPELLS.get(param).name} armed in the ${mode}'s live engine`);
        assert.equal(h.click(), true, `and the ${mode} click fires it`);
        assert.equal(h.liveEngine().missileCount(), 1, 'one missile in flight where the player stands');
        assert.equal(h.street.readied() ?? h.dungeon.readied(), null, 'no ready left stranded on either engine');
        assert.equal(it.currentCondition, 100 - DURABILITY_LOSS_ON_USE, 'the use wears the item once, as ever');
      }
    }
  } finally { setDefaultEnchantCtx(null); }
});

test('CAST-USE: nothing used underground goes off on the next click outside (the stranded free ready)', () => {
  try {
    const h = host();
    h.enter('dungeon');
    use(h, castWhenUsed(20));
    h.click();
    h.enter('exterior');
    assert.equal(h.street.spellArmed(), false, 'the street engine holds nothing');
    assert.equal(h.click(), false, 'and the first street click swings rather than casting a storm');
  } finally { setDefaultEnchantCtx(null); }
});

test('CAST-USE: a CasterOnly item lands underground through the dungeon\'s own engine - its line on the dungeon\'s HUD', () => {
  try {
    const h = host();
    h.enter('dungeon');
    use(h, castWhenUsed(64));
    assert.equal(h.player.health, 40, 'the Heal landed (it always did - the player is one entity)');
    assert.ok(h.dungeonSaid.includes('You are healed 20 points.'), 'said where the player is');
    assert.equal(h.streetSaid.length, 0, 'not on the street\'s channel');
  } finally { setDefaultEnchantCtx(null); }
});

test('CAST-USE: liveCastEngine - the dungeon\'s engine underground, the host\'s everywhere else; a context left from a descent never leaks, none mid-transition is the host\'s', () => {
  assert.equal(typeof shared.liveCastEngine, 'function');
  const own = {}, dEng = {};
  assert.equal(shared.liveCastEngine('dungeon', { castEngine: dEng }, own), dEng);
  assert.equal(shared.liveCastEngine('interior', { castEngine: dEng }, own), own);
  assert.equal(shared.liveCastEngine('exterior', { castEngine: dEng }, own), own);
  assert.equal(shared.liveCastEngine('dungeon', null, own), own);
});

test('CAST-USE the hosts (sweep): both outer hosts mount the LIVE engine, the dungeon hands its own; the split it answers stands', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(f);
    const mount = s.slice(s.indexOf('setDefaultEnchantCtx(createEnchantCtx({'));
    assert.match(mount.slice(0, 3000), /\n\s+magic: \(\) => liveCastEngine\(_mode\(\), modes\?\.dungeonCtx \?\? null, magic\),/, `${f}: the ctx asks for the live engine`);
    // ...because this host's own engine fires only above ground (the frame) - underground the click is the dungeon's
    assert.match(s, /if \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior'\) \{\n[^\n]*\n\s+magic\.firePending\(/, `${f}: its engine's frame runs in exterior mode alone`);
  }
  assert.match(src('src/scenes/dungeonContext.js'), /\n\s+castEngine: magic,/, 'the dungeon context hands its engine');
  const M = src('src/scenes/worldModes.js');
  assert.match(M, /\n\s+enchantCtx: false,/, 'the hosted dungeon still mounts no ctx of its own');
  assert.match(M, /\(mode === 'dungeon' && dungeonCtx\) \? dungeonCtx\.playerAttackInput/, 'and its click goes to the dungeon\'s engine');
});
