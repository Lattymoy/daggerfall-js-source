// WAVE D - D8-dungeon-host. Four open sites the closeout re-triage
// judged closable, each pinned by what DIES when the change is reverted:
//
//  1. the dungeon host was a FOURTH BODY of the player-arrow law and is
//     now a fourth CALLER (combat/arrowFlight.js);
//  2. a MOVE-flag acting FLAT tweens, where it used to relay;
//  3. the enchant ctx is MOUNTED by both hosts that owe it, off one
//     shared body (scenes/hostEnchant.js);
//  4. the dungeon host runs chargen through createChargenWindow, the
//     one construction seam, rather than holding the raw flow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ActionSystem } from '../src/world/actionSystem.js';
import { ACTION_FLAGS } from '../src/world/rdbLayout.js';
import { createEnchantCtx, standLooseFoe, LOOSE_FOE_PLACE_ATTEMPTS } from '../src/scenes/hostEnchant.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const DC = src('src/scenes/dungeonContext.js');

// Collider stub tracking bucket lifecycle - an action FLAT must never
// mint one (DFU's box is `isTrigger = true`).
function stubCollider() {
  const buckets = new Set();
  return {
    buckets,
    addMesh: (key) => buckets.add(key),
    removeBucket: (key) => buckets.delete(key),
    raycast: () => Infinity,
  };
}
const flatBox = (x, y, z, h = 1) => ({ min: [x - 0.5, y - h / 2, z - 0.5], max: [x + 0.5, y + h / 2, z + 0.5] });

// ── 1. the fourth caller ──────────────────────────────────────────

test('wave D: the player-arrow law has FOUR CALLERS and one body', () => {
  // AUDIT 39 (#64) flagged it as "four bodies, not four callers", and
  // the divergence it warned of had already happened: the dungeon copy
  // splashed at the arrow tip, the bug AUDIT 39r/R16 fixed in the
  // shared one. (The splash POSITION is pinned behaviourally in
  // test/audit26_combat.test.js's F052.)
  const callers = ['src/scenes/world.js', 'src/scenes/exterior.js',
    'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js'];
  for (const f of callers) {
    const s = src(f);
    assert.match(s, /import \{[^}]*playerArrowHitFoe[^}]*\} from '[^']*arrowFlight\.js'/,
      `${f} imports the shared law`);
    assert.match(s, /playerArrowHitFoe\(m, [ft], \{/, `${f} calls it`);
  }
  // ...and the dungeon host prices no shot of its own any more: no
  // SWING_MODS read, no calculateAttackDamage on the arrow arm.
  assert.equal(/SWING_MODS/.test(DC), false, 'the fourth body is gone, import and all');
  const arm = DC.slice(DC.indexOf('if (m.fromPlayer) {'), DC.indexOf('} else if (m.aimFoe'));
  assert.equal(/calculateAttackDamage/.test(arm), false, 'and its damage door with it');
  // the four options the shared law cannot work without
  assert.match(arm, /playerEntity, playerWeapon, playerFeet,/);
  assert.match(arm, /dealDamage: \(t, d\) => damageFoe\(t, d, lastPlayerFeet, m\.dir\),/,
    'the pool\'s own damage door, carrying the knockback origin and the flight direction');
});

// ── 2. the MOVE-flag flat moves ───────────────────────────────────

test('wave D: a move-flag FLAT tweens, and never becomes a solid', () => {
  const c = stubCollider();
  const a = new ActionSystem(c);
  const moved = [];
  a.onFlatMoved = (o) => moved.push([...o.offset]);
  // PositiveY: RDBLayout.AddAction sets ActionDuration = 50 itself
  // (:1026-1033), so the tween runs 50/20 = 2.5s even though
  // AddActionFlatHelper handed it a duration of 0.
  const flat = a.addMoveFlat(0, 11, {
    actionFlag: ACTION_FLAGS.PositiveY, index: 0, magnitude: 8, axisRaw: 1,
    duration: 50, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 2, z: 0 },
    nextObject: -1, triggerFlag: 0x02,
  }, [4, 1, 9], flatBox(4, 1, 9, 2));
  assert.equal(flat.kind, 'moveFlat', 'a move-flag flat is a MOVER, not a relay');
  assert.equal(flat.isFlat, true);

  a.activate(flat.key);
  assert.equal(flat.state, 'forward');
  a.update(1.25);                       // half of 2.5s
  assert.ok(Math.abs(flat.offset[1] - 1) < 1e-6, 'linear, halfway up');
  assert.ok(Math.abs(flat.pos[1] - 2) < 1e-6, 'the live world position is origin + offset');
  // the trigger box TRAVELS - DFU adds a BoxCollider to the flat's own
  // transform, so the thing you can look at moves with it
  assert.ok(Math.abs(flat.aabb.min[1] - 1) < 1e-6);
  assert.ok(Math.abs(flat.aabb.max[1] - 3) < 1e-6);
  assert.ok(moved.length > 0 && Math.abs(moved.at(-1)[1] - 1) < 1e-6, 'the host is told where it got to');
  a.update(2);
  assert.equal(flat.state, 'end');
  assert.ok(Math.abs(flat.offset[1] - 2) < 1e-6, 'and stops at the full translation');
  // never solid, at any point of the tween: `col.isTrigger = true`
  assert.equal(c.buckets.size, 0, 'a flat mints no collider bucket');
  assert.equal(flat.frameDelta, null, 'and is not a moving platform');
});

test('wave D: a flat Translation is INSTANT - AddActionFlatHelper hands AddAction duration 0', () => {
  // RDBLayout.cs:915 `float duration = 0.0f;` for description "FLT",
  // and the Translation/Rotation cases (:998-1017) never set
  // ActionDuration - only the six PositiveX..NegativeZ flags do. So an
  // iTween with time 0 fires its oncomplete SetState on the spot.
  const a = new ActionSystem(stubCollider());
  const flat = a.addMoveFlat(0, 4, {
    actionFlag: ACTION_FLAGS.Translation, index: 0, magnitude: 40, axisRaw: 2,
    duration: 0, rotation: { x: 0, y: 0, z: 0 }, translation: { x: -1, y: 0, z: 0 },
    nextObject: -1, triggerFlag: 0x02,
  }, [0, 0, 0], null);
  a.activate(flat.key);
  assert.equal(flat.state, 'end', 'no tween to run');
  assert.deepEqual([...flat.offset], [-1, 0, 0]);
  // ...and the cycle still flips back, as DaggerfallAction's does
  a.activate(flat.key);
  assert.equal(flat.state, 'start');
  assert.deepEqual([...flat.offset], [-0, 0, 0]);
});

test('wave D: the CHAIN a move-flag flat used to be kept for still runs through it', () => {
  // The reason the port relayed these at all: DFU's Play() cascades
  // ActivateNext before the delegate runs, so a link through a move
  // flag must stay in the graph or everything downstream dies.
  const a = new ActionSystem(stubCollider());
  const sink = a.addRelay(0, 20, { actionFlag: ACTION_FLAGS.Activate, index: 0, axisRaw: 0, nextObject: -1, triggerFlag: 0x02 });
  const flat = a.addMoveFlat(0, 10, {
    actionFlag: ACTION_FLAGS.PositiveZ, index: 0, magnitude: 8, axisRaw: 1,
    duration: 50, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 0, z: -1 },
    nextObject: 20, triggerFlag: 0x02,
  }, [0, 0, 0], null);
  a.activate(flat.key);
  assert.equal(sink.activationCount, 1, 'the next object was cascaded');
  assert.equal(flat.state, 'forward');
});

test('wave D: a move-flag flat SAVES and settles like the model beside it', () => {
  // AddAction attaches SerializableActionObject to a flat exactly as it
  // does to a model (RDBLayout.cs:970-973), so the record persists.
  const a = new ActionSystem(stubCollider());
  const flat = a.addMoveFlat(0, 3, {
    actionFlag: ACTION_FLAGS.NegativeY, index: 0, magnitude: 8, axisRaw: 1,
    duration: 50, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: -3, z: 0 },
    nextObject: -1, triggerFlag: 0x02,
  }, [2, 6, 2], flatBox(2, 6, 2, 1));
  const rec = a.collectSaveData().find((r) => r.key === flat.key);
  assert.ok(rec && rec.state === 'start');
  a.restoreSaveData([{ key: flat.key, state: 'end', t: 1 }]);
  assert.equal(flat.state, 'end');
  assert.ok(Math.abs(flat.pos[1] - 3) < 1e-6, 'the restored pose is settled, not left at the base');
  assert.ok(Math.abs(flat.aabb.max[1] - 3.5) < 1e-6, 'and the trigger box came with it');
});

test('wave D: the dungeon host mints a move-flag flat its OWN batch and keeps it out of the group', () => {
  // A member of a grouped billboard batch cannot be moved on its own,
  // which is the whole of why this stayed INTERIM.
  assert.match(DC, /\} else if \(MOVE_ACTION_FLAGS\.has\(action\.actionFlag\)\) \{\n\s*const o = actions\.addMoveFlat\(ns, position, action, \[x, y, z\], aabb\);/,
    'the registration forks to the mover before the relay arm');
  assert.match(DC, /if \(!\(f\.action && MOVE_ACTION_FLAGS\.has\(f\.action\.actionFlag\)\)\) \{\n\s*if \(!flatGroups\.has\(key\)\)/,
    'and the flat leaves the shared group');
  assert.match(DC, /moveFlatBatches\.set\(o\.key, batch\)/, 'each gets a single-flat batch');
  assert.match(DC, /actions\.onFlatMoved = \(o\) => \{/, 'and rides the batch origin uniform, as the missiles do');
  // an acting MARKER has no billboard in this port at all - it must not
  // be handed one
  assert.match(DC, /m\.archive \?\? 199, m\.record, false\);/, 'markers register undrawn');
  assert.match(DC, /if \(!mf\.drawn\) continue;/);
  // the INTERIM sentence is retired where it stood
  assert.equal(/no mesh to tween here, so it relays/.test(DC), false);
});

// ── 3. the enchant ctx, one body, two hosts ───────────────────────

test('wave D: the shared enchant ctx answers the arms that were silent in the dungeon', () => {
  const hurts = [];
  const cast = [];
  const stood = [];
  const foes = [
    { mobileType: 4, ai: { feet: [3, 0, 0] }, entity: { team: 'PlayerEnemy' } },
    { mobileType: 7, ai: { feet: [30, 0, 0] }, entity: { team: 'PlayerEnemy' } },
    { mobileType: 9, ai: { feet: [1, 0, 0] }, entity: { team: 'PlayerAlly' } },
  ];
  const player = { isPlayer: true, level: 3, isResting: true };
  const ctx = createEnchantCtx({
    playerEntity: player,
    spellsByIndex: () => new Map(),
    now: () => 1234,
    sinks: { hurt: (n) => hurts.push(n), heal: () => {} },
    say: () => {},
    magic: { castByItemSelf: (r) => cast.push(['self', r]), readySpell: (r, o) => cast.push(['ready', r, o]), applySpellToPlayer: () => {} },
    foes: () => foes,
    foeSinks: (f) => ({ hurt: (n) => hurts.push([f.mobileType, n]) }),
    feet: () => [0, 0, 0],
    standLooseFoe: (mt, o) => stood.push([mt, o]),
  });
  // HealthLeech's drawback door (AUDIT 39 #84)
  ctx.hurtSelf(16);
  ctx.hurtSelf(0);
  assert.deepEqual(hurts, [16], 'billed once, and never for zero');
  // CastWhenUsed's two arms (:335-336)
  ctx.applySpellToSelf('R');
  ctx.setReadySpell('R');
  assert.deepEqual(cast, [['self', 'R'], ['ready', 'R', { free: true }]],
    'the CasterOnly assign and the free click-to-cast ready');
  // the affinity/summon scan: in range, with the live team and distance
  const near = ctx.nearbyFoes(10);
  assert.deepEqual(near.map((n) => n.mobileType), [4, 9], 'the far one is out of range');
  assert.deepEqual(near.map((n) => n.team), ['PlayerEnemy', 'PlayerAlly'],
    'the LIVE team rides along - a standing summon must not count as company');
  assert.equal(near[1].distance, 1);
  near[0].hurt(5);
  assert.deepEqual(hurts.at(-1), [4, 5], 'and the drain goes through the host\'s own per-foe sinks');
  // SoulBound vs the Sanguine Rose, exactly as their DFU callers differ
  ctx.spawnFoe(12);
  ctx.spawnAlliedFoe(13);
  assert.deepEqual(stood, [[12, { lineOfSightCheck: false }], [13, { allied: true }]]);
  // S40: the rest flag reaches CastWhenHeld's degrade rate
  assert.equal(ctx.isResting(), true);
  player.isResting = false;
  assert.equal(ctx.isResting(), false, 'read LIVE, never latched at mount');
});

test('wave D: standLooseFoe refuses rather than standing a foe nowhere', () => {
  // The never-traps law at the seam both hosts hand their own halves
  // to: a host with no feet yet (pre-spawn) must get null, not a throw.
  assert.equal(standLooseFoe({ collider: null, feet: [0, 0, 0], foes: [], spawn: () => 1 }, 5), null);
  assert.equal(standLooseFoe({ collider: {}, feet: null, foes: [], spawn: () => 1 }, 5), null);
  assert.equal(standLooseFoe({ collider: {}, feet: [0, 0, 0], foes: [], spawn: null }, 5), null);
  assert.equal(LOOSE_FOE_PLACE_ATTEMPTS, 12);
});

test('wave D: the dungeon host hands the ctx its OWN doors', () => {
  const mount = DC.slice(DC.indexOf('if (opts.enchantCtx !== false) {'), DC.indexOf('// AUDIT 24: `chargen: false`'));
  assert.match(mount, /foes: \(\) => foes,/);
  assert.match(mount, /foeSinks,/);
  assert.match(mount, /feet: \(\) => lastPlayerFeet \?\? \[0, 0, 0\],/);
  assert.match(mount, /say: \(l\) => hudText\.add\(l\),/);
  // the two WINDOWS this host owns - the plaque stack and its ONE sheet
  assert.match(mount, /pushDungeonWindow\(new ActionTextBox\(lines\)\)/,
    'Azura\'s box goes through PushWindow, so an open window does not swallow it');
  assert.match(mount, /openCharacterSheet: \(\) => api\.toggleCharSheet\(\),/,
    'the Oghma opens this host\'s one sheet construction, not a second bag');
  // the Wabbajack over this host's own pool, with DFU's quest guard.
  //
  // AUDIT 58 (review): the BODY moved out of this literal onto the api,
  // and the mount takes it by name. It had to: this literal is mounted
  // only on the STANDALONE route (`enchantCtx: false` from worldModes),
  // so on the hosted route world.js's mount was the session singleton
  // and a dungeon record reaching its replaceFoe had nowhere but the
  // street pool to go - removed by a remover that owns neither its
  // billboard nor its death chain, re-stood outdoors. One body, both
  // routes, and world.js asks pool membership which one to call.
  assert.match(mount, /replaceFoe: replaceFoeInPool,/);
  assert.match(DC, /function replaceFoeInPool\(targetEntity, mobileType\) \{/);
  assert.match(DC, /replaceFoe: replaceFoeInPool,   \/\/ AUDIT 58/,
    'and the api carries it, so the hosted route can reach this pool at all');
  const body = DC.slice(DC.indexOf('function replaceFoeInPool('), DC.indexOf('// FS1 (wave D): the mount itself.'));
  assert.match(body, /if \(f\.questBehaviour && !f\.questBehaviour\.isFoeDead\) return;/);
  assert.match(body, /questPoolOps\.removeFoe\(f\);/);
  assert.match(body, /nf\.entity\.health -= missing;/);
  assert.equal(/exteriorFoes|cityGuards/.test(body), false, 'over this host\'s OWN pool, and no other');
});

// ── 4. chargen through the one construction seam ──────────────────

test('wave D: the dungeon host holds the chargen WINDOW, not the raw flow', () => {
  assert.match(DC, /chargenWindow = createChargenWindow\(chargenFlow, \{/);
  assert.match(DC, /activeOverlay = chargenWindow;/);
  // every slot comparison moved with it - a site left on the FLOW would
  // compare the slot against an object that is never in it
  assert.equal(/activeOverlay === chargenFlow/.test(DC), false);
  assert.ok((DC.match(/activeOverlay === chargenWindow/g) ?? []).length >= 3);
  // the flow itself is still the 17i probe surface
  assert.match(DC, /chargenFlow: \(\) => chargenFlow,/);
  // ONE application. The window fires onDone itself, so a host arm that
  // also called finishChargenHere applied the character twice - once
  // per key, since the overlay seams each re-check `done`.
  assert.equal(/if \(activeOverlay === chargenWindow\) finishChargenHere\(\)/.test(DC), false);
  assert.equal((DC.match(/finishChargenHere\(/g) ?? []).length, 2,
    'the definition and the window\'s onDone - nothing else');
  assert.match(DC, /onDone: \(r\) => finishChargenHere\(r\),/);
  assert.match(DC, /onCancel: \(\) => location\.reload\(\),/);
});

test('wave D: routing chargen through the window stops the DOUBLE letterbox', () => {
  // The window reports isChoiceWindow, and this host's native draw arm
  // hands a native window the REAL canvas with no screen offset -
  // which is what drawChargenNative's own nativeMetrics(canvas) needs.
  // Holding the raw flow took the other arm: a virtual canvas AND an
  // offset, so the classic screens were letterboxed twice (AUDIT 19
  // F2's defect) while the art measured itself off the fake canvas.
  const cs = src('src/systems/chargenSession.js');
  assert.match(cs, /isChoiceWindow: true,/);
  assert.match(cs, /draw\(renderer, canvas, font, scale = hudScale\) \{ flow\.draw\(renderer, canvas, font, scale\); \},/,
    'and the host\'s own letterbox scale is honoured rather than dropped for the constructed default');
  assert.match(DC, /if \(activeOverlay\.isChoiceWindow\) \{\n\s*activeOverlay\.draw\(renderer, canvas, hudFont, hudScaleFor\(canvas\.width, canvas\.height\)\);/);
});
