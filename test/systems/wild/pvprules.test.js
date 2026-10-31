// PVP-RULES (bible/11-Multiplayer/PvP-Rework.md): a flagged fighter's limits in the open zone - no Levitate and a free
// fall from it, the PvE buffs ended and refused, no rest, the pace and the jump capped; Paralyze and the rest never
// between players, and a beast's change no flag.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PVP_LIMITS, PVP_SELF_BARRED, setPvpLimitedSource, pvpLimited, pvpLevitateBarred, notePvpGround, pvpFallSpared, takePvpHeldTaken,
  pvpSpellRefusal, stripPvpBuffs } from '../../../src/systems/wild/pvpRules.js';
import { createPvpRulesHost, PVP_RULES_POLL_MS } from '../../../src/scenes/pvpRulesHost.js';
import { rideBarred } from '../../../src/player/mountRig.js';
import { PlayerMotor, runSpeed, walkSpeed, FIXED_DT, moveCapNow, registerMoveCap } from '../../../src/player/motor.js';
import { Collider } from '../../../src/player/collider.js';
import { TRANSPORT_MODES, setCanRunOverride } from '../../../src/systems/transport.js';
import { ATHLETICISM_MULTIPLIER } from '../../../src/systems/skills.js';
import { levitateWarded } from '../../../src/characters/playerEntity.js';
import { applyFallLanding, playerFallDamage } from '../../../src/scenes/shared.js';
import { getPreventedRestMessage } from '../../../src/systems/rest/restSession.js';
import { pvpFirstEffect, pvpCastFrame } from '../../../src/combat/siegeCombat.js';

afterEach(() => { setPvpLimitedSource(null); registerMoveCap('pvpRules', null); });
const flagged = (v = true) => setPvpLimitedSource(() => v);

test('PVP-RULES THE CAPS ARE AN UNBUFFED BEST: Speed 100 and Running 100 run, Jumping 100 with Athleticism (mutants: the run cap off its formula; the jump cap with the Jump spell)', () => {
  assert.equal(PVP_LIMITS.mps, Math.round(runSpeed(100, 100) * 100) / 100);
  assert.equal(PVP_LIMITS.jump, 1 + 0.5 + ATHLETICISM_MULTIPLIER);
  assert.ok(walkSpeed(100) < PVP_LIMITS.mps, 'a walk is never capped');
});

test('PVP-RULES THE MOTOR UNDER THE CAPS: a buffed run is held to the cap while flagged and free unflagged; the walk and a gallop as they were; the jump boost capped (mutants: the cap unread; a gallop capped; the jump uncapped)', () => {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const motor = (over = {}) => {
    const col = new Collider(() => 0);
    col.addMesh('floor', [-400, 0, -400, 400, 0, -400, 400, 0, 400, -400, 0, 400], [0, 1, 2, 0, 2, 3], I);
    const m = new PlayerMotor(col, { speed: 150, running: 200, swimming: 30 }, { jumpBoost: () => 2.2 });
    m.spawn(0, 0.05, 0);
    Object.assign(m, over);
    return m;
  };
  const speedOf = (input, over) => {
    const m = motor(over);
    for (let f = 0; f < 10; f++) m.update(FIXED_DT, { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false, ...input }, 0);
    return m.speed;
  };
  setCanRunOverride(() => true);
  createPvpRulesHost({ on: () => true }, {}, { activeEffects: [] }, () => {}, { zone: () => true, every: null });
  assert.ok(Math.abs(speedOf({ run: true }) - PVP_LIMITS.mps) < 1e-9, 'the run at the cap');
  assert.ok(Math.abs(speedOf({}) - walkSpeed(150)) < 1e-9, 'the walk as it was');
  assert.ok(speedOf({ run: true }, { transportMode: TRANSPORT_MODES.Horse }) > PVP_LIMITS.mps, 'a gallop is the horse\'s');
  assert.equal(motor()._jumpBoostNow(), PVP_LIMITS.jump);
  assert.deepEqual(moveCapNow(), { mps: PVP_LIMITS.mps, jump: PVP_LIMITS.jump });
  setPvpLimitedSource(() => false);
  assert.ok(Math.abs(speedOf({ run: true }) - runSpeed(150, 200)) < 1e-9, 'unflagged: the run free');
  assert.equal(motor()._jumpBoostNow(), 2.2);
  setCanRunOverride(null);
});

test('PVP-RULES NO LEVITATE, AND ITS FALL IS FREE: the ward holds a running Levitate while flagged, its first hold spares the next landing once, the ground spends it, and the flag down owes it again (mutants: the ward unread; the spare never armed; the spare re-armed each frame; the ground not spending it)', () => {
  assert.equal(levitateWarded(), false);
  flagged();
  assert.equal(levitateWarded(), true);
  assert.equal(pvpFallSpared(), true);
  const hurt = [];
  applyFallLanding({}, 30, { hurt: (n) => hurt.push(n) });
  assert.deepEqual(hurt, [], 'the landing costs nothing');
  assert.equal(pvpFallSpared(), false, 'and is spent');
  assert.equal(pvpLevitateBarred(), true);
  assert.equal(pvpFallSpared(), false, 'a ring held down spares no later fall');
  applyFallLanding({}, 30, { hurt: (n) => hurt.push(n) });
  assert.equal(hurt.length, 1, 'a later fall bills');
  notePvpGround(false, false);
  flagged();
  pvpLevitateBarred();
  assert.equal(playerFallDamage({}, 30), 0, 'the dungeon\'s bill is spared too');
  notePvpGround(true, true);
  assert.equal(pvpFallSpared(), false, 'the ground spends it');
  flagged(false);
  assert.equal(levitateWarded(), false);
});

test('PVP-RULES THE SPELLS REFUSED UNDER THE FLAG: Levitate at any range, a PvE buff on myself; Shield, a buff at touch and a Damage cast; nothing unflagged; the one cast engine asks (mutants: the engine unasked; Levitate let through; a self buff let through; Shield refused; a touch buff refused)', () => {
  const sp = (type, rangeType = 0) => ({ rangeType, effects: [{ type, subType: 255 }] });
  flagged();
  assert.ok(pvpSpellRefusal(sp(14)) && pvpSpellRefusal(sp(14, 2)));
  for (const t of PVP_SELF_BARRED) assert.ok(pvpSpellRefusal(sp(t)), `type ${t}`);
  assert.equal(pvpSpellRefusal(sp(35)), null, 'Shield is the fight\'s');
  assert.equal(pvpSpellRefusal(sp(9, 1)), null, 'at touch');
  assert.equal(pvpSpellRefusal(sp(4, 2)), null);
  assert.equal(pvpSpellRefusal(sp(14), false), null);
  flagged(false);
  assert.equal(pvpSpellRefusal(sp(14)), null);
  assert.match(readFileSync('src/scenes/hostMagic.js', 'utf8'), /\?\? sandSpellRefusal\(sp\) \?\? pvpSpellRefusal\(sp\);/, 'every host\'s one cast engine asks');
});

test('PVP-RULES THE BUFFS END: the flag going up ends every PvE buff (a potion\'s, a Shield) and arms the spare for a Levitate; after it my own casts and a mate\'s gifts but Shield go; a worn item\'s buff goes each poll (the owner: "Item buff no"); a worn item\'s utility, a curse, a harm, a duel\'s and a utility stay (mutants: the edge read as later; a worn item kept; a worn utility stripped; a curse stripped; a potion\'s stripped after the edge)', () => {
  const fx = () => [
    { kind: 'fortifyAttribute', bundleSelfCast: true }, { kind: 'shield', bundleSelfCast: true }, { kind: 'jumping' },
    { kind: 'chameleonNormal', heldItem: {} }, { kind: 'fortifyAttribute', permanent: true, bundleSelfCast: true }, { kind: 'continuousDamage' },
    { kind: 'elementalResistance', bundleDuel: true }, { kind: 'waterBreathing', bundleSelfCast: true },
    { kind: 'invisNormal', bundleAlly: true }, { kind: 'levitate' }, { kind: 'waterBreathing', heldItem: {} },
  ];
  flagged();
  const a = { activeEffects: fx() };
  assert.equal(stripPvpBuffs(a, true), 6);
  assert.deepEqual(a.activeEffects.map((e) => e.kind), ['fortifyAttribute', 'continuousDamage', 'elementalResistance', 'waterBreathing', 'waterBreathing']);
  assert.equal(takePvpHeldTaken(), true, 'a worn buff taken is owed back');
  assert.equal(takePvpHeldTaken(), false);
  assert.equal(pvpFallSpared(), true, 'a Levitate ended spares its fall');
  const b = { activeEffects: fx() };
  assert.equal(stripPvpBuffs(b, false), 4);
  assert.deepEqual(b.activeEffects.map((e) => e.kind), ['shield', 'jumping', 'fortifyAttribute', 'continuousDamage', 'elementalResistance', 'waterBreathing', 'waterBreathing']);
});

test('PVP-RULES THE HOST: held only flagged in the zone; the rest window refused then; the flag going up says the buffs end once; the poll at a quarter second (mutants: the zone unread; the rest unrefused; the line said each poll)', () => {
  let on = false, zone = true, every = 0;
  const said = [], motor = { grounded: true }, entity = { activeEffects: [] };
  const h = createPvpRulesHost({ on: () => on }, motor, entity, (l) => said.push(l), { zone: () => zone, every: (_f, ms) => { every = ms; } });
  assert.equal(every, PVP_RULES_POLL_MS);
  assert.equal(PVP_RULES_POLL_MS, 250);
  assert.equal(getPreventedRestMessage(), null);
  on = true;
  assert.equal(pvpLimited(), true);
  assert.match(getPreventedRestMessage(), /rest/);
  zone = false;
  assert.equal(pvpLimited(), false, 'outside the zone the flag holds nothing');
  assert.equal(getPreventedRestMessage(), null);
  zone = true;
  entity.activeEffects = [{ kind: 'fortifyAttribute', bundleSelfCast: true }];
  h.tick();
  h.tick();
  assert.equal(said.length, 1);
  assert.deepEqual(entity.activeEffects, []);
  assert.equal(h.flag.on(), true);
});

test('PVP-RULES NO SADDLE (the owner: "No horse u demoibt", "Demount"): flagged in the zone a rider is set on foot each poll and the saddle refused; off the flag a worn buff taken is recast; the PvP bar\'s spells and buffs are the flag\'s own (mutants: the kit stripped; the kit refused; the bar unasked; the rider kept; the recast unasked)', () => {
  let on = true, zone = true;
  const said = [], motor = { grounded: true, transportMode: TRANSPORT_MODES.Horse }, entity = { activeEffects: [{ kind: 'chameleonNormal', heldItem: { equipSlot: 1 } }], items: [] };
  const h = createPvpRulesHost({ on: () => on }, motor, entity, (l) => said.push(l), { zone: () => zone, every: null });
  assert.match(rideBarred(), /ride/);
  h.tick();
  assert.ok(said.some((l) => /ride/.test(l)), 'the rider is told');
  assert.deepEqual(entity.activeEffects, [], 'the worn Chameleon goes');
  entity.activeEffects = [{ kind: 'fortifyAttribute', bundleSelfCast: true, bundleKit: true }, { kind: 'spellReflection', bundleSelfCast: true }];
  h.tick();
  assert.deepEqual(entity.activeEffects.map((e) => e.kind), ['fortifyAttribute'], 'PVP-KIT: the PvP bar\'s buff stays, a buff of my own goes');
  assert.equal(pvpSpellRefusal({ rangeType: 0, pvpKit: 'fortify', effects: [{ type: 9 }] }), null, 'PVP-KIT: the bar\'s Fortify is cast');
  assert.match(pvpSpellRefusal({ rangeType: 0, effects: [{ type: 9 }] }), /yourself/);
  assert.match(readFileSync('src/systems/effects.js', 'utf8'), /if \(spell\?\.pvpKit != null\) list\[i\]\.bundleKit = true;/, 'a bar spell\'s entry is marked');
  assert.match(readFileSync('src/player/mountRig.js', 'utf8'), /function setMode\(mode\) \{\n\s+if \(mode === TRANSPORT_MODES\.Dragon[^\n]*\n\s+if \(refused\(mode\)\) return;/, 'the one place the mode changes refuses the saddle');   // PIN MOVED (DRAGON5): after the held dragon's check
  assert.match(readFileSync('src/player/mountRig.js', 'utf8'), /const refused = \(mode\) => \{ const barred = isRiding\(mode\) \? rideBarred\(\) : null; if \(barred\) _rideSay\?\.\(barred\); return !!barred; \};/, 'a saddle asks the bar and says its line');
  assert.match(readFileSync('src/scenes/pvpRulesHost.js', 'utf8'), /if \(isRiding\(motor\?\.transportMode\)\) \{\n\s*rideFoot\(\);/);
  on = false;
  assert.equal(rideBarred(), null, 'off the flag a saddle is free');
  h.tick();
  assert.match(readFileSync('src/scenes/pvpRulesHost.js', 'utf8'), /\} else if \(takePvpHeldTaken\(\)\) restartHeldEnchantments\(entity\);/);
  assert.equal(takePvpHeldTaken(), false, 'the recast took what was owed');
});

test('PVP-RULES NO HOLD BETWEEN PLAYERS (PVP-SPELLS): a cast at a player lands only its first effect, and only Damage or a Heal Health - Paralyze, Silence, a damage over time and a Drain never; the referee\'s frame carries numbers, no effect (mutants: Paralyze let through; a second effect read)', () => {
  const sp = (...effects) => ({ effects });
  for (const type of [0, 1, 7, 19, 5]) assert.equal(pvpFirstEffect(sp({ type, subType: 255 })), null, `type ${type}`);
  assert.equal(pvpFirstEffect(sp({ type: 0, subType: 255 }, { type: 4, subType: 0 })), null, 'a Paralyze first, nothing');
  assert.equal(pvpFirstEffect(sp({ type: 4, subType: 0 }, { type: 0, subType: 255 })).type, 4, 'a Damage first, the Damage alone');
  assert.equal(pvpFirstEffect(sp({ type: 10, subType: 8 })).type, 10);
  assert.deepEqual(Object.keys(pvpCastFrame([0, 0, 0], 10, sp({ type: 4 }))).sort(), ['d', 'el', 'p']);
});

test('PVP-RULES A BEAST\'S CHANGE RAISES NO FLAG: the flag is sent from the flag host\'s own set alone, and the lycanthropy and vampirism laws never name it (mutants: none - the scan is its own guard)', () => {
  const files = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk('src');
  const senders = files.filter((p) => /\.setWildFlag\b/.test(readFileSync(p, 'utf8')));
  assert.deepEqual(senders.map((p) => p.replaceAll('\\', '/')), ['src/scenes/pvpFlagHost.js']);
  for (const f of ['src/systems/lycanthropy.js', 'src/systems/vampirism.js']) assert.doesNotMatch(readFileSync(f, 'utf8'), /pvpFlag|setWildFlag|wildFlag/);
});
