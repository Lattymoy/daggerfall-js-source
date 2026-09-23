// ALLY-CAST (2026-09-23, Mac: "Can we implement the use of spells on players? For example healing and other buffs?
// ... some sort of ally targeting system" - "Do it"): A SPELL CAST ON A PARTY MATE. The law on a table
// (systems/allyCast.js), the wire's projection and parse (validCastData, the `cast` frame), the relay's cast arm
// over the fake room (routed to the one socket `to` names, junk at my own id, nothing outside a place room), the
// magic host's release arm driven as itself (a CasterOnly Heal read off a friend leaves as a touch on them; a
// damage spell never does; a refused door falls through to the ordinary arm), and the world.js seams by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ALLY_CAST_TYPES, ALLY_TOUCH_REACH, ALLY_RANGE_REACH, allyEffect, allyCastable, allyCastSpell, allyReachFor, allyCastFrame,
  allyCastCasterLine, allyCastTargetLine, allyCastPlaqueLine,
} from '../src/systems/allyCast.js';
import { SOCIAL_REACH } from '../src/player/socialPick.js';
import {
  validCastData, parseClient, CAST_FRAME_MAX, CAST_LEVEL_MAX, CAST_SETTING_MAX, CAST_HZ_MAX, CAST_ROOM_HZ_MAX, RELAY_VERSION, castGate, castInGate,
} from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { calculateCastCost } from '../src/systems/spellcost.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const fx = (type, subType = 0, mag = 20) => ({
  type, subType,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1,
});
const EMPTY = { type: -1, subType: -1 };
const HEAL = fx(10, 8);          // Heal Health
const DAMAGE = fx(4, 0);         // Damage Health
const FORTIFY = fx(9, 0, 10);    // Fortify Strength
const spellOf = (rangeType, effects, name = 'Balyna\'s Balm') => ({ name, index: 90, element: 4, rangeType, effects });

// ─── THE LAW ────────────────────────────────────────────────────────────────────────────────────────────────────

test('ALLY-CAST: a spell is castable on an ally when every real effect is a beneficial family - a Heal + Damage is not a gift, and an empty spell is nothing', () => {
  assert.equal(allyCastable(spellOf(0, [HEAL, EMPTY, EMPTY])), true);
  assert.equal(allyCastable(spellOf(1, [HEAL, FORTIFY, EMPTY])), true);
  assert.equal(allyCastable(spellOf(1, [HEAL, DAMAGE, EMPTY])), false, 'one harmful effect and the whole spell goes the ordinary way');
  assert.equal(allyCastable(spellOf(0, [DAMAGE])), false);
  assert.equal(allyCastable(spellOf(0, [EMPTY, EMPTY, EMPTY])), false);
  assert.equal(allyCastable(null), false);
  for (const t of [0, 1, 2, 4, 5, 6, 7, 11, 12, 16, 17, 19, 29, 33, 34, 40, 43]) assert.equal(ALLY_CAST_TYPES.has(t), false, `type ${t} is never a gift`);
  for (const t of [3, 8, 9, 10, 13, 14, 15, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31, 35, 39, 44]) assert.equal(ALLY_CAST_TYPES.has(t), true, `type ${t} is`);
  assert.equal(allyEffect(fx(11, 8)), false, 'Transfer Health drains the target to heal the caster: not a gift');
  assert.equal(allyEffect(EMPTY), false);
});

test('ALLY-CAST: the receiver keeps the beneficial subset alone - a crafted Damage Health beside a Heal lands nothing harmful, and nothing beneficial means nothing at all', () => {
  const kept = allyCastSpell({ name: 'Trick', element: 0, rangeType: 1, effects: [DAMAGE, HEAL, fx(0, 255)] });
  assert.deepEqual(kept.effects, [HEAL], 'the Heal alone; the Damage and the Paralyze are dropped');
  assert.equal(kept.name, 'Trick'); assert.equal(kept.rangeType, 1, 'carried as sent: the target\'s own saving throw scales an external touch');
  assert.equal(kept.custom, true);
  assert.equal(allyCastSpell({ name: 'X', element: 0, rangeType: 1, effects: [DAMAGE] }), null);
  assert.equal(allyCastSpell({ effects: [] }), null);
  assert.equal(allyCastSpell(null), null);
});

test('ALLY-CAST: the reach by range type, the frame the caster sends, and the three lines', () => {
  assert.equal(allyReachFor(0), ALLY_TOUCH_REACH); assert.equal(allyReachFor(1), ALLY_TOUCH_REACH);
  assert.equal(allyReachFor(2), ALLY_RANGE_REACH);
  assert.equal(allyReachFor(3), null, 'an area around the caster is never redirected'); assert.equal(allyReachFor(4), null); assert.equal(allyReachFor(9), null);
  assert.equal(ALLY_TOUCH_REACH, SOCIAL_REACH, 'the F key\'s own reach: a distance the player already knows');
  assert.ok(ALLY_RANGE_REACH > ALLY_TOUCH_REACH);
  const f = allyCastFrame(spellOf(0, [HEAL, EMPTY, EMPTY]), 7, 'peer-0002');
  assert.deepEqual(f, { to: 'peer-0002', level: 7, spell: { name: 'Balyna\'s Balm', element: 4, rangeType: 1, effects: [HEAL] } }, 'a CasterOnly leaves as a TOUCH, the empty slots stay home');
  assert.equal(allyCastFrame(spellOf(2, [HEAL]), 0.5, 'p').level, 1, 'a level floors at one');
  assert.equal(allyCastFrame(spellOf(2, [HEAL]), 12, 'p').spell.rangeType, 2, 'a ranged cast keeps its type');
  assert.equal(allyCastCasterLine('Heal', 'Bran'), 'You cast Heal on Bran.');
  assert.equal(allyCastTargetLine('Cyl', 'Shield'), 'Cyl casts Shield on you.');
  assert.equal(allyCastPlaqueLine('Heal', 'Bran'), 'Cast Heal on Bran');
  assert.equal(allyCastCasterLine('', 'Bran'), 'You cast a spell on Bran.');
});

// ─── THE WIRE ───────────────────────────────────────────────────────────────────────────────────────────────────

const GOOD = { to: 'peer-0002', level: 5, spell: { name: 'Heal', element: 4, rangeType: 1, effects: [HEAL] } };

test('ALLY-CAST wire (world96): validCastData projects a bounded spell record and refuses the whole frame otherwise; parseClient carries the `cast` frame after a hello and inside the cap', () => {
  assert.equal(RELAY_VERSION, 'world96');
  const d = validCastData(GOOD);
  assert.deepEqual(d, GOOD, 'a whole frame, every component an integer in bounds');
  assert.equal(validCastData({ ...GOOD, to: 'x' }), null, 'an id is an id');
  assert.equal(validCastData({ ...GOOD, level: 0 }), null); assert.equal(validCastData({ ...GOOD, level: CAST_LEVEL_MAX + 1 }), null); assert.equal(validCastData({ ...GOOD, level: 2.5 }), null);
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, element: 5 } }), null);
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, rangeType: 7 } }), null);
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, effects: [] } }), null, 'no effect is no spell');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, effects: [HEAL, HEAL, HEAL, HEAL] } }), null, 'four effects: the classic record has three slots');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, effects: [fx(99)] } }), null, 'an effect type past the registry');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, effects: [EMPTY] } }), null, 'an empty slot never rides the wire');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, effects: [{ ...HEAL, magnitudeBaseHigh: CAST_SETTING_MAX + 1 }] } }), null, 'a component past the bound');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, effects: [{ ...HEAL, durationBase: -1 }] } }), null);
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, effects: [{ type: 10, subType: 8 }] } }).spell.effects[0].magnitudeBaseLow, 0, 'a missing component reads zero');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, name: '  Heal\u0000 me  ' + 'x'.repeat(80) } }).spell.name.length <= 32, true, 'a label, bounded');
  assert.equal(validCastData(null), null); assert.equal(validCastData([]), null);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'cast', data: GOOD }), { hasHello: true }), { t: 'cast', data: GOOD });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'cast', data: GOOD }), { hasHello: false }), { error: 'cast before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'cast', data: { ...GOOD, level: 0 } }), { hasHello: true }), { error: 'bad cast' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'cast', data: { ...GOOD, spell: { ...GOOD.spell, name: 'x'.repeat(CAST_FRAME_MAX) } } }), { hasHello: true }), { error: 'frame too large' });
  // the gates: a sender's own casts and the frames coming in, both token buckets under their rates
  let g = { pass: true, bucket: null };
  for (let i = 0; i < CAST_HZ_MAX; i++) { g = castGate(g.bucket, 1000); assert.equal(g.pass, true); }
  assert.equal(castGate(g.bucket, 1000).pass, false, 'the fifth cast in the same second waits');
  assert.equal(castInGate(null, 1000).pass, true);
  assert.ok(CAST_ROOM_HZ_MAX >= CAST_HZ_MAX * 2, 'the funnel onto one destination admits a few casters at once');
});

// ─── THE RELAY ──────────────────────────────────────────────────────────────────────────────────────────────────

test('ALLY-CAST relay: the cast arm routes a frame to the one socket `to` names, stamped with the sender; a frame at my own id is junk and one in the hub room goes nowhere', async () => {
  const r = fakeRoom('world:3,12');
  const a = r.connect(), b = r.connect(), c = r.connect();
  await r.hello(a, 'peer-0001'); await r.hello(b, 'peer-0002'); await r.hello(c, 'peer-0003');
  const sentTo = (ws) => ws.sent.filter((m) => m.t === 'cast');
  await r.raw(a, JSON.stringify({ t: 'cast', data: GOOD }));
  assert.deepEqual(sentTo(b), [{ t: 'cast', id: 'peer-0001', data: GOOD }], 'b, and b alone, with a\'s id on it');
  assert.equal(sentTo(c).length, 0); assert.equal(sentTo(a).length, 0);
  const junkBefore = a.att.drops ?? 0;
  await r.raw(a, JSON.stringify({ t: 'cast', data: { ...GOOD, to: 'peer-0001' } }));
  assert.equal(sentTo(a).length, 0, 'a cast at myself delivers nothing');
  assert.ok((a.att.drops ?? 0) >= junkBefore, 'and is counted as junk, never delivered');
  await r.raw(a, JSON.stringify({ t: 'cast', data: { ...GOOD, to: 'peer-9999' } }));
  assert.equal(sentTo(b).length, 1, 'a peer that is gone: nothing sent, nothing struck');
  // outside a place room the arm is closed
  const hub = fakeRoom('chat:world');
  const h1 = hub.connect(), h2 = hub.connect();
  await hub.hello(h1, 'peer-0001'); await hub.hello(h2, 'peer-0002');
  await hub.raw(h1, JSON.stringify({ t: 'cast', data: GOOD }));
  assert.equal(sentTo(h2).length, 0, 'the hub is no place to stand and cast');
});

// ─── THE MAGIC HOST, DRIVEN ─────────────────────────────────────────────────────────────────────────────────────

const mkPlayer = (over = {}) => ({
  isPlayer: true, level: 4, health: 20, maxHealth: 50, maxMagicka: 500, magicka: 500,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [], ...over,
});
function magicRig(player, { ally = null, door = () => true } = {}) {
  const world = { said: [], frames: [], picks: [] };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal(n) { player.health = Math.min(player.maxHealth, player.health + n); }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => world.said.push(l) },
    say: (l) => world.said.push(l),
    surfacePlayer() {},
    foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99,
    startCastAnim: null,
    allyTarget: (eye, dir, reach) => { world.picks.push({ eye, dir, reach }); return ally; },
    castAtAlly: (id, frame) => { const ok = door(); if (ok) world.frames.push({ id, frame }); return ok; },
  });
  return { magic, world };
}
const BRAN = { id: 'peer-0002', name: 'Bran' };

test('ALLY-CAST host: a CasterOnly Heal readied with a party mate under the crosshair leaves as a touch on them - the magicka spent, the caster told, and NOT healed themselves', () => {
  const player = mkPlayer();
  const sp = spellOf(0, [HEAL, EMPTY, EMPTY]);
  const cost = calculateCastCost(sp, player).sp;
  const { magic, world } = magicRig(player, { ally: BRAN });
  magic.readySpell(sp);   // CasterOnly casts at the ready (EntityEffectManager: SetReadySpell's instant arm)
  assert.equal(world.frames.length, 1, 'one frame left');
  assert.deepEqual(world.frames[0], { id: 'peer-0002', frame: { to: 'peer-0002', level: 4, spell: { name: sp.name, element: 4, rangeType: 1, effects: [HEAL] } } });
  assert.equal(world.picks[0].reach, ALLY_TOUCH_REACH, 'looked for within touch reach');
  assert.equal(player.health, 20, 'the caster is not healed: the spell went to Bran');
  assert.equal(player.magicka, 500 - cost, 'and paid for it as any cast');
  assert.ok(world.said.includes('You cast Balyna\'s Balm on Bran.'));
  assert.equal(magic.readied(), null, 'the ready is spent');
});

test('ALLY-CAST host: with nobody under the crosshair the CasterOnly Heal heals the caster as it always did; a door that refuses falls through the same way', () => {
  const player = mkPlayer();
  const { magic, world } = magicRig(player, { ally: null });
  magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY]));
  assert.equal(world.frames.length, 0); assert.equal(player.health, 40, 'healed 20');
  const p2 = mkPlayer();
  const r2 = magicRig(p2, { ally: BRAN, door: () => false });
  r2.magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY]));
  assert.equal(r2.world.frames.length, 0, 'the link refused (a socket gone, the gate)');
  assert.equal(p2.health, 40, '...so the spell did what it always did');
});

test('ALLY-CAST host: a ByTouch buff goes to the mate in touch reach and a ranged one to the mate in range reach; a damage spell and an area spell never look for one', () => {
  const player = mkPlayer();
  const { magic, world } = magicRig(player, { ally: BRAN });
  magic.readySpell(spellOf(1, [FORTIFY, EMPTY, EMPTY], 'Strength'));
  assert.equal(magic.castInput([0, 0.9, 0], [0, 0, 1]), true);
  assert.equal(world.frames.length, 1); assert.equal(world.frames[0].frame.spell.rangeType, 1); assert.equal(world.picks.at(-1).reach, ALLY_TOUCH_REACH);
  magic.readySpell(spellOf(2, [HEAL, EMPTY, EMPTY], 'Far Balm'));
  magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.equal(world.frames.length, 2); assert.equal(world.frames[1].frame.spell.rangeType, 2, 'a ranged cast keeps its type'); assert.equal(world.picks.at(-1).reach, ALLY_RANGE_REACH);
  assert.equal(magic.missileCount(), 0, 'no missile flew: the cast went straight to Bran');
  const picks = world.picks.length;
  magic.readySpell(spellOf(2, [DAMAGE, EMPTY, EMPTY], 'Fireball'));
  magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.equal(world.picks.length, picks, 'a damage spell never asks for an ally');
  assert.equal(magic.missileCount(), 1, '...and flies as before');
  magic.readySpell(spellOf(3, [HEAL, EMPTY, EMPTY], 'Aura'));
  magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.equal(world.picks.length, picks, 'an area around the caster is never redirected');
  assert.equal(world.frames.length, 2);
});

// ─── THE HOST'S SEAMS, BY SOURCE ────────────────────────────────────────────────────────────────────────────────

test('ALLY-CAST by source: world.js picks the party mate with the F key\'s own ray and reach, sends through the link, applies a received cast only from a party member and only its beneficial subset through the player door, and the plaque says where a readied spell will land; the link and the relay carry the frame', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /allyTarget: \(eye, dir, reach\) => \{\s*\n\s*if \(!social\?\.party \|\| !online\) return null;\s*\n\s*const hit = pickPeerInFront\(eye \?\? cam\.pos, dir \?\? socialFwd\(\), peersNear\(\), reach, rayPersonDistance\);\s*\n\s*if \(!hit \|\| !social\.isPartyPeer\(hit\.peer\.id\) \|\| !online\.reachesPeer\?\.\(hit\.peer\.id\)\) return null;/, 'the F key\'s pick, a party member, reachable');
  assert.match(w, /castAtAlly: \(id, frame\) => !!online\?\.sendCast\?\.\(frame\),/);
  assert.match(w, /online\.onCast = \(id, d\) => \{\s*\n\s*if \(!social\?\.isPartyPeer\(id\)\) return;\s*\n\s*if \(playerEntity\.health <= 0 \|\| modes\?\.deathUp\?\.\(\)\) return;\s*\n\s*const spell = allyCastSpell\(d\?\.spell\);\s*\n\s*if \(!spell\) return;[\s\S]{0,300}?const r = magic\.applySpellToPlayer\(spell, d\.level, null\);/, 'the receiver decides: the party alone, the living alone, the beneficial subset alone, through the one player door');
  assert.match(w, /const cast = sp && social\?\.isPartyPeer\(id\) && allyCastable\(sp\) \? allyCastPlaqueLine\(sp\.name, name\) : null;\s*\n\s*return \{ title: marks \? `\$\{name\} \$\{marks\}` : name, subs: \[cast, prompt\]\.filter\(Boolean\) \};/, 'the plaque\'s line');
  const o = rd('src/net/online.js');
  assert.match(o, /sendCast\(data\) \{\s*\n\s*const d = validCastData\(data\);\s*\n\s*if \(!d \|\| d\.to === this\.id\) return false;/, 'the link projects its own frame first');
  assert.match(o, /const d = validCastData\(m\.data\);\s*\n\s*if \(d && d\.to === this\.id\) this\._deliver\('cast', \(\) => this\.onCast\?\.\(m\.id, d\)\);/, '...and delivers only what is addressed to me');
  const h = rd('src/scenes/hostMagic.js');
  assert.match(h, /const ally = allyReach !== null && allyCastable\(sp\) \? allyTarget\?\.\(eye, dir, allyReach\) \?\? null : null;\s*\n\s*if \(ally && castAtAlly\?\.\(ally\.id, allyCastFrame\(sp, playerEntity\.level, ally\.id\)\)\) \{/, 'the release frame asks before the four range arms');
  const relay = rd('server/src/index.js');
  assert.match(relay, /if \(m\.t === 'cast'\) \{[\s\S]{0,900}?a = this\._meterCast\(ws, a, now\); if \(!a\) return;\s*\n\s*if \(isChatRoom\(a\.key\) \|\| isSocialRoom\(a\.key\)\) return;/, 'its own meter, a place room alone');
});
