// AUDIT WATCH-KIT (2026-10-01, Mac: "Just want to audit this to make sure it's perfection") - lens M: the magic of
// COMPANION-KIT (PR #502, my healing and buffs reaching my crew companions), with lens U's U2(a) (his whole through a
// door) and lens D's safety net over the same code. Every finding was re-run before its fix and is pinned here by a
// test that fails on the code as it stood, over the real modules (companionkit.test.js's rig, ALLY-CAST's seams, the
// real companion layer and party):
//
//   WK-M1  a gift has no caster (scenes/hostMagic.js giveToCompanion): his Spell Reflection bounced my heal onto me
//   WK-M2  CastReadySpell's touch gate admits him by the release frame's own pick (castInput)
//   WK-M3  his spells ride with him through every change of place (scenes/crewAshore.js)
//   WK-M4  Light, Detect and Comprehend Languages are the player's alone (systems/allyCast.js companionCastable)
//   WK-M5  the safety net's three holes and its false equivalent (the records in tools/mutants/companionkit.json)
//   WK-M6  a man knocked out is no mark
//   WK-M9  the ready's arms in the click's own order
//   WK-U2  his whole rides with him (crewAshore.js)
//   WK-D   lens D's fresh mutants over the same code - each an untested behaviour, pinned
//
// Mutation-proven: tools/mutants/auditwatchkit_magic.json, and companionkit.json's four.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { createCrewAshore } from '../../src/scenes/crewAshore.js';
import { createCompanions } from '../../src/systems/naval/crewCompanions.js';
import * as ac from '../../src/systems/allyCast.js';
import { PRESS_BUTTON_TO_FIRE_SPELL } from '../../src/systems/mysticism.js';
import { applySpell, hasActiveEffect } from '../../src/systems/effects.js';
import { damageShieldPool } from '../../src/characters/playerEntity.js';
import { composePartyFx } from '../../src/net/partyBuffs.js';
import { EYE_HEIGHT } from '../../src/player/motor.js';
import { TOUCH_SPHERE_CAST_RADIUS } from '../../src/systems/spellcast.js';

const { ALLY_TOUCH_REACH, ALLY_RANGE_REACH, ALLY_ARMED_LINE, COMPANION_ARMED_LINE } = ac;

const fx = (type, subType = 0, mag = 20, dur = 0, chance = 100, levelMag = 0) => ({
  type, subType,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: levelMag, magnitudeLevelHigh: levelMag, magnitudePerLevel: 1,
  durationBase: dur, durationMod: 0, durationPerLevel: 1, chanceBase: chance, chanceMod: 0, chancePerLevel: 1,
});
const EMPTY = { type: -1, subType: -1 };
const HEAL = fx(10, 8);                      // Heal Health, 20
const DAMAGE = fx(4, 0);                     // Damage Health
const FORTIFY = fx(9, 0, 10, 10);            // Fortify Strength, ten rounds
const REGEN = fx(18, 255, 5, 30);            // Regenerate, thirty rounds
const SHIELD = fx(35, 255, 15, 5);           // Shield, a pool of 15
const REFLECT = fx(21, 255, 0, 10, 50);      // Spell Reflection, half the time, ten rounds
const LIGHT = fx(15, 255, 0, 20);
const DETECT = fx(39, 0, 0, 20);             // Detect Magic
const COMPREHEND = fx(44, 255, 0, 20);
const PARALYZE = fx(0, 255, 0, 10);
const spellOf = (rangeType, effects, name = 'Balyna\'s Balm') => ({ name, index: 90, element: 4, rangeType, effects, icon: 7 });

const MAGICKA = 100000;
const EYE = [0, 0.9, 0], AHEAD = [0, 0, 1], BACK = [0, 0, -1];
const mkPlayer = () => ({
  isPlayer: true, level: 4, health: 20, maxHealth: 50, maxMagicka: MAGICKA, magicka: MAGICKA,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [],
});
/** My companion Hilda (companionkit.test.js's), `at` her feet. */
const hilda = (at = [0, 0, 2], over = {}) => ({
  companion: '42:Hilda', shipmate: true, dead: false,
  entity: { name: 'Hilda', health: 10, maxHealth: 60, magicka: 0, maxMagicka: 0, fatigue: 100, maxFatigue: 100, level: 3, activeEffects: [],
    stats: { strength: 50, intelligence: 40, willpower: 40, agility: 50, endurance: 50, personality: 40, speed: 50, luck: 40 }, skills: new Array(40).fill(30), career: {}, team: 'PlayerAlly' },
  ai: { feet: [...at], height: 1.8 }, ...over,
});
/** The cast engine (companionkit.test.js's rig): `bodies` my companions here (a list, or the seam itself). */
function rig(player, bodies, { rolls = () => 0.99, extra = {} } = {}) {
  const said = [];
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal(n) { player.health = Math.min(player.maxHealth, player.health + n); }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => said.push(l) },
    say: (l) => said.push(l), surfacePlayer() {},
    foes: () => [],
    foeSinks: (f, fromPlayer) => ({ fromPlayer, hurt(n) { f.entity.health -= n; f.hurtBy = fromPlayer; }, heal(n) { f.healBy = fromPlayer; f.entity.health = Math.min(f.entity.maxHealth, f.entity.health + n); }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls, startCastAnim: null,
    companionBodies: typeof bodies === 'function' ? bodies : () => bodies,
    ...extra,
  });
  magic.firePending(EYE, AHEAD);
  return { magic, said };
}
/** The missiles flown out, a frame at a time (MISSILE_LIFESPAN_S is eight seconds). */
const fly = (magic) => { for (let i = 0; i < 600 && magic.missileCount(); i++) magic.update(1 / 60, [0, 0, 0], AHEAD); };
const casts = (said) => said.filter((l) => l.startsWith('You cast'));

/** The companion layer over places as the pools are (crewcompanions.test.js's): a live list a body stands in (`has`), a
 *  remove that marks it dead, a sweep that empties the list and marks nobody (the street's clearLive). */
function placeOf(key, maxHealth = 60) {
  const pool = { key, live: [] };
  pool.spawn = (mobile, feet) => {
    const rec = hilda(feet);
    delete rec.companion;
    rec.entity.health = rec.entity.maxHealth = maxHealth;   // each place rolls his class's pool afresh
    pool.live.push(rec);
    return Promise.resolve(rec);
  };
  pool.remove = (rec) => { rec.dead = true; pool.live = pool.live.filter((r) => r !== rec); };
  pool.has = (rec) => pool.live.includes(rec);
  pool.sweep = () => { pool.live.length = 0; };
  return pool;
}
const settle = () => new Promise((r) => setImmediate(r));
function shore(party) {
  const state = { place: null };
  const layer = createCrewAshore({ party: () => party, place: () => state.place, leader: () => ({ feet: [0, 0, 0], yaw: 0, grounded: true }), now: () => 0 });
  return { state, layer, stand: async () => { layer.frame(); await settle(); layer.frame(); } };
}
const hand = (name) => ({ name, role: 'Bosun', mobile: 2, gender: 'female' });

// ── WK-M1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-M1 (major): A GIFT HAS NO CASTER - my companion wearing a Spell Reflection I gave him never bounces my next gift back at me: on a roll his ward would reflect, a Heal lands on him whole and a Heal + Fortify on him alone - nothing of either on me, nothing of mine tagged an ally\'s (ALLY-CAST\'s receiver\'s own call: world.js hands its door no caster)', () => {
  const p = mkPlayer(), h = hilda();
  const { magic, said } = rig(p, [h], { rolls: () => 0.3 });   // 30 under his ward's 50: a reflection, were the incoming chain run
  magic.readySpell(spellOf(0, [REFLECT, EMPTY, EMPTY], 'Mirror Ward'));
  magic.castInput(EYE, AHEAD);
  assert.ok(h.entity.activeEffects.some((a) => a.kind === 'spellReflection' && !a.ended && a.bundleAlly === true), 'his ward, my gift');
  magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY], 'Heal'));
  magic.castInput(EYE, AHEAD);
  assert.equal(h.entity.health, 30, 'healed whole');
  assert.equal(p.health, 20, 'never bounced onto me');
  magic.readySpell(spellOf(0, [HEAL, FORTIFY, EMPTY], 'Bear Balm'));
  magic.castInput(EYE, AHEAD);
  assert.equal(h.entity.health, 50);
  assert.ok(h.entity.activeEffects.some((a) => a.kind === 'fortifyAttribute' && !a.ended && a.bundleAlly === true), 'his Fortify, an ally\'s bundle');
  assert.equal(p.health, 20);
  assert.deepEqual(p.activeEffects, [], 'nothing of either gift on me');
  assert.deepEqual(casts(said), ['You cast Mirror Ward on Hilda.', 'You cast Heal on Hilda.', 'You cast Bear Balm on Hilda.']);
});

// ── WK-M2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-M2: THE TOUCH GATE ADMITS HIM AS THE RELEASE DOES - a ByTouch heal aimed level from my eye (EYE_HEIGHT) at his face, where the touch\'s sphere (meeting him at his centre point alone) passes over him, is let through CastReadySpell\'s gate by the release frame\'s own pick: spent once and given him; aimed past his shoulder - neither the touch nor the pick on him - it is refused there, nothing spent, still in hand', () => {
  const eye = [0, EYE_HEIGHT, 0];
  assert.ok(EYE_HEIGHT - 0.9 > TOUCH_SPHERE_CAST_RADIUS + 0.45, 'this aim passes his centre point beyond the touch\'s own reach');
  const p = mkPlayer(), h = hilda([0, 0, 2]);
  const { magic, said } = rig(p, [h]);
  magic.firePending(eye, AHEAD);
  const sp = spellOf(1, [HEAL, EMPTY, EMPTY], 'Healing Touch');
  magic.readySpell(sp);
  assert.equal(magic.castInput(eye, AHEAD), true, 'through the gate');
  assert.equal(h.entity.health, 30, 'given him');
  assert.ok(p.magicka < MAGICKA, 'spent');
  assert.equal(said.at(-1), 'You cast Healing Touch on Hilda.');
  assert.equal(magic.readied(), null);
  const p2 = mkPlayer(), h2 = hilda([1.2, 0, 2]);
  const r2 = rig(p2, [h2]);
  r2.magic.firePending(eye, AHEAD);
  r2.magic.readySpell(sp);
  assert.equal(r2.magic.castInput(eye, AHEAD), false, 'refused before the spend (CastReadySpell :411-421)');
  assert.equal(p2.magicka, MAGICKA, 'nothing spent');
  assert.equal(r2.magic.readied(), sp, 'still in hand');
  assert.equal(h2.entity.health, 10);
});

// ── WK-M3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-M3: HIS SPELLS RIDE WITH HIM - a gift on my companion (Fortify, Regenerate and a Shield, through the engine) and a foe\'s Paralyze stand on his next body through a door with no place between a while (the helm, a door in flight) - the same entries at the rounds he left with, his card the same - and through a sweep (a fast travel\'s clear) as they are by then (a ward given him in the shop with them); the Shield a blow busted stays behind; sent back aboard and taken again he has none; the party\'s save carries his health, not his spells', async () => {
  const party = createCompanions();
  party.take(42, hand('Hilda'), 0);
  const { state, layer, stand } = shore(party);
  const street = placeOf('street'), shop = placeOf('shop');
  state.place = street;
  await stand();
  const body = street.live[0];
  assert.deepEqual(layer.bodies(), [body]);
  // the gift through the engine - he stands behind me, so I turn round
  const p = mkPlayer();
  const { magic, said } = rig(p, () => layer.bodies());
  magic.firePending(EYE, BACK);
  magic.readySpell(spellOf(0, [FORTIFY, REGEN, SHIELD], 'Troll Blood'));
  magic.castInput(EYE, BACK);
  assert.equal(said.at(-1), 'You cast Troll Blood on Hilda.');
  const noSinks = { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} };
  applySpell({ name: 'Web', element: 4, rangeType: 1, effects: [PARALYZE] }, 5, body.entity, noSinks, () => 0.99, { entity: { name: 'Spider', activeEffects: [] } }, {});
  damageShieldPool(body.entity, 20);   // a blow past his Shield's 15: it ends
  const live = body.entity.activeEffects.filter((a) => !a.ended);
  assert.deepEqual(live.map((a) => a.kind).sort(), ['fortifyAttribute', 'paralyze', 'regenerate']);
  assert.ok(body.entity.activeEffects.some((a) => a.kind === 'shield' && a.ended), 'the Shield busted');
  const card = composePartyFx(body.entity), rounds = live.map((a) => a.roundsRemaining);
  assert.ok(card.length >= 2, 'a buff and a debuff on his card');
  // a door, nowhere to stand a while between
  state.place = null;
  layer.frame();
  assert.equal(street.live.length, 0, 'lifted out of the street');
  state.place = shop;
  await stand();
  const inside = shop.live[0];
  assert.ok(inside && inside !== body, 'a fresh body');
  assert.deepEqual(inside.entity.activeEffects, live, 'his spells as he left');
  assert.ok(inside.entity.activeEffects.every((a, i) => a === live[i]), 'the same entries');
  assert.deepEqual(inside.entity.activeEffects.map((a) => a.roundsRemaining), rounds);
  assert.deepEqual(composePartyFx(inside.entity), card, 'his card the same');
  // a ward given him in the shop, and then a sweep: the place empties its list and marks nobody (AUDIT CC-A1) - he
  // stands again with his spells as they are NOW, never as he came through the door
  magic.readySpell(spellOf(0, [SHIELD, EMPTY, EMPTY], 'Ward'));
  magic.castInput(EYE, BACK);
  const now = inside.entity.activeEffects.filter((a) => !a.ended);
  assert.deepEqual(now.map((a) => a.kind), [...live.map((a) => a.kind), 'shield'], 'the ward on him');
  shop.sweep();
  await stand();
  const again = shop.live[0];
  assert.ok(again && again !== inside, 'stood again');
  assert.deepEqual(again.entity.activeEffects, now, 'through the sweep, as they are now');
  // sent back aboard and taken again: a new turn ashore, none of them
  party.sendBack(42, 'Hilda');
  layer.frame();
  party.take(42, hand('Hilda'), 0);
  await stand();
  assert.notEqual(shop.live.at(-1), again);
  assert.deepEqual(shop.live.at(-1).entity.activeEffects, [], 'a new turn ashore');
  // the save keeps his health and his pack - no spells (a load stands him as it always did)
  const snap = JSON.parse(JSON.stringify(party.snapshot()));
  assert.deepEqual(Object.keys(snap.party[0]).sort(), ['boat', 'gender', 'health', 'items', 'maxHealth', 'mobile', 'name', 'role']);
});

// ── WK-U2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-U2 (major): HIS WHOLE RIDES WITH HIM - each place rolls his class\'s pool afresh, and he stands in the next as he left the last: hurt to 30 of 60 on the street, 30 of 60 in a place rolling 40 and in one rolling 80 (as a share he was 20 of 40, then 40 of 80 - his card read a blow and a heal); healed whole, whole at his own 60 where the place rolls 80; a hand never stood takes the place\'s roll; a save\'s health past his whole stands whole, one under a point stands at 1', async () => {
  const party = createCompanions();
  party.take(42, hand('Hilda'), 0);
  const { state, layer, stand } = shore(party);
  const at = (place) => { const e = place.live.at(-1).entity; return [e.health, e.maxHealth]; };
  const street = placeOf('street', 60);
  state.place = street;
  await stand();
  assert.deepEqual(at(street), [60, 60], 'never stood: the place\'s roll');
  street.live[0].entity.health = 30;
  layer.frame();
  const shop = placeOf('shop', 40);
  state.place = shop;
  await stand();
  assert.deepEqual(at(shop), [30, 60], 'into a smaller roll: his own whole, hurt as he left');
  const cellar = placeOf('cellar', 80);
  state.place = cellar;
  await stand();
  assert.deepEqual(at(cellar), [30, 60], 'into a larger one: the same');
  cellar.live[0].entity.health = 60;
  layer.frame();
  const yard = placeOf('yard', 80);
  state.place = yard;
  await stand();
  assert.deepEqual(at(yard), [60, 60], 'whole: at his own 60, never the place\'s 80');
  const saved = createCompanions({ party: [
    { boat: 42, name: 'Olaf', role: 'Cook', mobile: 2, health: 90, maxHealth: 60 },
    { boat: 42, name: 'Bram', role: 'Cook', mobile: 2, health: 0.5, maxHealth: 60 },
  ] });
  const s2 = shore(saved);
  const dock = placeOf('dock', 40);
  s2.state.place = dock;
  await s2.stand();
  assert.deepEqual(dock.live.map((r) => [r.entity.name, r.entity.health, r.entity.maxHealth]), [['Olaf', 60, 60], ['Bram', 1, 60]], 'never past his whole, never at nothing');
});

// ── WK-M4 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-M4: LIGHT, DETECT AND COMPREHEND LANGUAGES ARE READ OFF THE PLAYER ALONE - with my companion under the crosshair or near, each fires on the spot on ME (lit, detecting, comprehending): nothing armed, nothing on him, nothing said of him; a Heal beside a Light is his - armed, given, healed, and no Light on him (the gift stripped) nor anything on me; the law on its table', () => {
  for (const [name, eff, kind] of [['Light', LIGHT, 'light'], ['Detect Magic', DETECT, 'detectMagic'], ['Comprehend Languages', COMPREHEND, 'comprehendLanguages']]) {
    for (const at of [[0, 0, 2], [3, 0, 1]]) {   // under the crosshair; near
      const p = mkPlayer(), h = hilda(at);
      const { magic, said } = rig(p, [h]);
      magic.readySpell(spellOf(0, [eff, EMPTY, EMPTY], name));
      assert.equal(magic.readied(), null, `${name} with him at ${at}: fired on the spot, never armed for him`);
      assert.ok(hasActiveEffect(p, kind), `${name}: on me`);
      assert.deepEqual(h.entity.activeEffects, [], `${name}: nothing on him`);
      assert.ok(!said.includes(COMPANION_ARMED_LINE) && !said.some((l) => l.endsWith(' on Hilda.')), said.join(' | '));
    }
  }
  const p = mkPlayer(), h = hilda();
  const { magic, said } = rig(p, [h]);
  const dawn = spellOf(0, [HEAL, LIGHT, EMPTY], 'Dawn Balm');
  magic.readySpell(dawn);
  assert.equal(magic.readied(), dawn, 'armed: a gift he can use');
  magic.castInput(EYE, AHEAD);
  assert.equal(h.entity.health, 30, 'healed');
  assert.ok(!hasActiveEffect(h.entity, 'light'), 'no Light on him - stripped from the gift');
  assert.equal(p.health, 20);
  assert.ok(!hasActiveEffect(p, 'light'), 'nor on me - the spell was his');
  assert.equal(said.at(-1), 'You cast Dawn Balm on Hilda.');
  assert.deepEqual([...(ac.COMPANION_UNREAD_TYPES ?? [])].sort((a, b) => a - b), [15, 39, 44]);
  assert.equal(ac.companionCastable?.(spellOf(0, [LIGHT, DETECT, EMPTY])), false, 'nothing he can use');
  assert.equal(ac.companionCastable?.(spellOf(0, [HEAL, LIGHT, EMPTY])), true, 'something he can use, nothing that harms');
  assert.equal(ac.companionCastable?.(spellOf(0, [HEAL, DAMAGE, EMPTY])), false, 'never a mixed spell');
  assert.deepEqual(ac.allyCastSpell({ name: 'x', effects: [HEAL, LIGHT, COMPREHEND] }, { companion: true })?.effects.map((e) => e.type), [10], 'his gift: what he can use');
  assert.equal(ac.allyCastSpell({ name: 'x', effects: [LIGHT] }, { companion: true }), null);
  assert.deepEqual(ac.allyCastSpell({ name: 'x', effects: [HEAL, LIGHT, COMPREHEND] }).effects.map((e) => e.type), [10, 15, 44], 'a mate\'s keeps all three - his own client reads them');
});

// ── WK-M5 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-M5: THE SAFETY NET\'S THREE HOLES AND ITS FALSE EQUIVALENT - a beneficial bolt fired at my companion past ALLY_RANGE_REACH flies, strikes his body and is given him once (not sent as a mate\'s frame, not flown through him); an AreaAtRange heal fired at him bursts on him and he stands in it, once, with me 8 m off out of it; a touch 0.65 m off his axis - outside the crosshair\'s pick (PERSON_RADIUS + 0.15), inside the touch\'s own sphere - is given him by the touch\'s own arm, nothing thrown', () => {
  {
    const p = mkPlayer(), h = hilda([0, 0, 30]);
    const { magic, said } = rig(p, [h]);
    assert.ok(30 > ALLY_RANGE_REACH);
    magic.readySpell(spellOf(2, [HEAL, EMPTY, EMPTY], 'Healing Bolt'));
    magic.castInput(EYE, AHEAD);
    assert.equal(magic.missileCount(), 1, 'past the crosshair\'s reach: it flies');
    assert.equal(h.entity.health, 10);
    fly(magic);
    assert.equal(magic.missileCount(), 0);
    assert.equal(h.entity.health, 30, 'struck and given him');
    assert.equal(h.healBy, false, 'through his sinks as no blow of mine');
    assert.deepEqual(casts(said), ['You cast Healing Bolt on Hilda.']);
  }
  {
    const p = mkPlayer(), h = hilda([0, 0, 8]);
    const { magic, said } = rig(p, [h]);
    magic.readySpell(spellOf(4, [HEAL, EMPTY, EMPTY], 'Healing Burst'));
    magic.castInput(EYE, AHEAD);
    assert.equal(magic.missileCount(), 1);
    fly(magic);
    assert.equal(h.entity.health, 30, 'in the burst, once');
    // PIN MOVED (the merge with FIELD BUGS 2026-10-01 part four, AREA-CASTER - Mac: "Include the caster"): a spell of
    // gifts lands on its caster at the cast wherever it bursts - out of the burst, and given it as its caster, once
    assert.equal(p.health, 40, 'me 8 m off: out of the burst, given it as its caster');
    assert.deepEqual(casts(said), ['You cast Healing Burst on Hilda.']);
  }
  {
    const p = mkPlayer(), h = hilda([0.65, 0, 2]);
    const { magic, said } = rig(p, [h]);
    magic.readySpell(spellOf(1, [HEAL, EMPTY, EMPTY], 'Healing Touch'));
    assert.doesNotThrow(() => magic.castInput(EYE, AHEAD));
    assert.equal(h.entity.health, 30, 'given him by the touch');
    assert.equal(said.at(-1), 'You cast Healing Touch on Hilda.');
  }
});

// ── WK-M6 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-M6: A MAN KNOCKED OUT IS NO MARK - held at 1 and marked by his pool\'s death arm, he stands to the layer\'s next frame only to be carried aboard: a CasterOnly heal with him under the crosshair fires on me; a ByTouch heal at him is refused at the gate, nothing spent; a blast and a bolt pass him by', () => {
  const ko = (at) => { const h = hilda(at, { _knockedOut: true }); h.entity.health = 1; return h; };
  {
    const p = mkPlayer(), h = ko([0, 0, 2]);
    const { magic } = rig(p, [h]);
    magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY], 'Heal'));
    assert.equal(magic.readied(), null, 'nobody to arm for');
    assert.equal(p.health, 40, 'on me');
    assert.equal(h.entity.health, 1);
  }
  {
    const p = mkPlayer(), h = ko([0, 0, 2]);
    const { magic } = rig(p, [h]);
    const sp = spellOf(1, [HEAL, EMPTY, EMPTY], 'Healing Touch');
    magic.readySpell(sp);
    assert.equal(magic.castInput(EYE, AHEAD), false, 'refused at the gate');
    assert.equal(p.magicka, MAGICKA, 'nothing spent');
    assert.equal(magic.readied(), sp);
    assert.equal(h.entity.health, 1);
  }
  {
    const p = mkPlayer(), h = ko([2, 0, -1]);
    const { magic } = rig(p, [h]);
    magic.readySpell(spellOf(3, [HEAL, EMPTY, EMPTY], 'Healing Circle'));
    magic.castInput(EYE, AHEAD);
    assert.equal(h.entity.health, 1, 'the blast passes him by');
  }
  {
    const p = mkPlayer(), h = ko([0, 0, 10]);
    const { magic } = rig(p, [h]);
    magic.readySpell(spellOf(2, [HEAL, EMPTY, EMPTY], 'Healing Bolt'));
    magic.castInput(EYE, AHEAD);
    fly(magic);
    assert.equal(h.entity.health, 1, 'the bolt flies through him');
  }
});

// ── WK-M9 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-M9: THE READY SAYS WHERE THE CLICK WILL LAND - a party mate under the crosshair and my companion near: DFU\'s line alone (never "Aim at your companion..."), and the click is the mate\'s; a mate near and my companion near, nobody under the crosshair: the mate\'s near line; my companion under the crosshair and a mate near: DFU\'s line alone, and the click is his', () => {
  const bran = { id: 'bran', name: 'Bran', feet: [-3, 0, 1], height: 1.8 };
  {
    const p = mkPlayer(), h = hilda([3, 0, 1]), sent = [];
    const { magic, said } = rig(p, [h], { extra: { allyTarget: () => ({ id: 'bran', name: 'Bran', distance: 2 }), castAtAlly: (id) => { sent.push(id); return true; } } });
    magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY], 'Heal'));
    assert.deepEqual(said, [PRESS_BUTTON_TO_FIRE_SPELL], 'the crosshair\'s arm');
    magic.castInput(EYE, AHEAD);
    assert.deepEqual(sent, ['bran']);
    assert.equal(said.at(-1), 'You cast Heal on Bran.');
    assert.equal(h.entity.health, 10);
  }
  {
    const p = mkPlayer(), h = hilda([3, 0, 1]);
    const { magic, said } = rig(p, [h], { extra: { allyTarget: () => null, castAtAlly: () => true, allyMarks: () => [bran] } });
    magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY], 'Heal'));
    assert.deepEqual(said, [PRESS_BUTTON_TO_FIRE_SPELL, ALLY_ARMED_LINE], 'the mate\'s near line');
  }
  {
    const p = mkPlayer(), h = hilda([0, 0, 2]), sent = [];
    const { magic, said } = rig(p, [h], { extra: { allyTarget: () => null, castAtAlly: (id) => { sent.push(id); return true; }, allyMarks: () => [bran] } });
    magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY], 'Heal'));
    assert.deepEqual(said, [PRESS_BUTTON_TO_FIRE_SPELL], 'his crosshair arm before the mate\'s near one');
    magic.castInput(EYE, AHEAD);
    assert.equal(h.entity.health, 30);
    assert.deepEqual(sent, []);
  }
});

// ── WK-D: lens D's safety net ─────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-D: THE CROSSHAIR\'S PICK ON HIM, EDGE BY EDGE - a CasterOnly heal armed near him is his only where the aim passes within PERSON_RADIUS + 0.15 of his axis (0.55 m his, 0.65 m mine), between his feet and his crown (a lob over his head, a level aim under his ledge: mine), within the cast\'s touch reach (6 m off: mine), and the nearer of two in line takes it', () => {
  const click = (bodies, eye = EYE, dir = AHEAD) => {
    const p = mkPlayer();
    const { magic } = rig(p, bodies);
    magic.firePending(eye, dir);
    magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY], 'Heal'));
    assert.notEqual(magic.readied(), null, 'armed near him');
    magic.castInput(eye, dir);
    return p;
  };
  const his = (h, p, why) => { assert.equal(h.entity.health, 30, why); assert.equal(p.health, 20, why); };
  const mine = (h, p, why) => { assert.equal(h.entity.health, 10, why); assert.equal(p.health, 40, why); };
  let h = hilda([0.55, 0, 2]);
  his(h, click([h]), '0.55 m off his axis');
  h = hilda([0.65, 0, 2]);
  mine(h, click([h]), '0.65 m off his axis');
  h = hilda([0, 0, 2]);
  mine(h, click([h], [0, EYE_HEIGHT, 0], [0, 0.6, 1]), 'a lob over his head');
  h = hilda([0, 3, 2]);
  mine(h, click([h], [0, EYE_HEIGHT, 0], AHEAD), 'a level aim under his ledge');
  assert.ok(ALLY_TOUCH_REACH < 6);
  h = hilda([0, 0, 6]);
  mine(h, click([h]), 'beyond the touch reach');
  const near = hilda([0, 0, 2]), far = hilda([0, 0, 3], { companion: '42:Olaf' });
  far.entity.name = 'Olaf';
  const p = click([near, far]);
  assert.deepEqual([near.entity.health, far.entity.health, p.health], [30, 10, 20], 'the nearer of two');
});

test('AUDIT WK-D: A BLAST\'S GIFT IS ONE LINE, AND A GIFT IS CAST AT MY LEVEL - an AreaAroundCaster heal reaching two companions says one line naming both; a heal that grows with the caster\'s level lands on him as it lands on me (level 4: 25 points, never level 1\'s 10)', () => {
  const p = mkPlayer(), a = hilda([2, 0, -1]), b = hilda([-1, 0, 1], { companion: '42:Olaf' });
  b.entity.name = 'Olaf';
  const { magic, said } = rig(p, [a, b]);
  magic.readySpell(spellOf(3, [HEAL, EMPTY, EMPTY], 'Healing Circle'));
  magic.castInput(EYE, AHEAD);
  assert.deepEqual([a.entity.health, b.entity.health], [30, 30]);
  assert.deepEqual(casts(said), ['You cast Healing Circle on Hilda and Olaf.']);
  const grows = spellOf(0, [fx(10, 8, 5, 0, 100, 5), EMPTY, EMPTY], 'Growing Balm');   // 5, and 5 a level
  const p2 = mkPlayer(), h = hilda();
  const r2 = rig(p2, [h]);
  r2.magic.readySpell(grows);
  r2.magic.castInput(EYE, AHEAD);
  assert.equal(h.entity.health, 10 + 5 + 5 * p2.level, 'at my level');
  const p3 = mkPlayer();
  rig(p3, []).magic.readySpell(grows);   // nobody near: on me, on the spot
  assert.equal(p3.health - 20, h.entity.health - 10, 'as it lands on me');
});

test('AUDIT WK-D: A BODY ALREADY GONE, AND A SEAM THAT THROWS - a companion his pool has removed (dead, the layer not yet past him) is no mark: a CasterOnly heal with him under the crosshair fires on me; a host whose companions seam throws casts as before, nothing thrown', () => {
  const p = mkPlayer(), gone = hilda([0, 0, 2], { dead: true });
  const { magic } = rig(p, [gone]);
  magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY], 'Heal'));
  assert.equal(magic.readied(), null, 'nobody to arm for');
  assert.equal(p.health, 40);
  assert.equal(gone.entity.health, 10);
  const p2 = mkPlayer();
  const r2 = rig(p2, () => { throw new Error('the host\'s seam'); });
  assert.doesNotThrow(() => r2.magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY], 'Heal')));
  assert.equal(p2.health, 40, 'the ordinary instant cast');
  const p3 = mkPlayer();
  const r3 = rig(p3, () => { throw new Error('the host\'s seam'); });
  r3.magic.readySpell(spellOf(1, [HEAL, EMPTY, EMPTY], 'Healing Touch'));
  assert.doesNotThrow(() => r3.magic.castInput(EYE, AHEAD));
  assert.equal(p3.magicka, MAGICKA, 'nobody in touch reach: refused, nothing spent');
});

test('AUDIT WK-D: HIS PACK THROUGH A CODEC THAT FAILS - a load whose codec throws, or answers no list, gives him an empty pack (a live list, never null); a save whose codec throws saves an empty one; neither throws out of the party', () => {
  const rec = { party: [{ boat: 7, name: 'A', role: 'Bosun', mobile: 2, items: [{ name: 'Rope' }] }] };
  const throwsIn = createCompanions(rec, { serialize: (x) => x, deserialize: () => { throw new Error('a bad pack'); } });
  assert.deepEqual(throwsIn.packOf(7, 'A'), [], 'a codec that throws');
  const noList = createCompanions(rec, { serialize: (x) => x, deserialize: () => null });
  assert.deepEqual(noList.packOf(7, 'A'), [], 'a codec that answers no list');
  noList.packOf(7, 'A').push({ name: 'Torch' });
  assert.equal(noList.packOf(7, 'A').length, 1, 'the live list');
  const out = createCompanions(null, { serialize: () => { throw new Error('a bad pack'); }, deserialize: (d) => d });
  out.take(7, { name: 'B', role: 'Cook', mobile: 2, gender: 'male' }, 0);
  out.packOf(7, 'B').push({ name: 'Lamp' });
  let snap = null;
  assert.doesNotThrow(() => { snap = out.snapshot(); });
  assert.deepEqual(snap.party[0].items, [], 'saved empty');
});
