// MAC7 (Mac, 2026-09-12: "Bug. 1. Morrowind doesnt show the player
// holding their weapon/attacking. It shows the full sprite and
// animations but no weapons", then "Do bow hold, spell casting and
// arrows on bow"). #1 THE PEER'S WEAPON AND SWING, #2 THE BOW'S HOLD,
// THE CAST AND THE ARROW. A peer's Morrowind body (MWBODY1) was built
// with the weapon the look carries, but the rig's weapon is sheathed
// until someone calls setSheathed(false), swings only on
// attack(strike), holds a bow only on attack's `hold`, takes an arrow
// only through setWeapon's ammo bit, stands in the spell stance only
// through readySpell and casts only on castSpell - the doors weaponRig
// opens for the player's own rig - and nothing of any travelled: the
// wire's pose was position, look angles and a move bit. THE ARM
// EXECUTES: the pose carries the drawn flag (wd, 2 while a bow is held
// at full draw), the swing count (an) and the swing's WeaponStates
// index (as, POSE_STRIKES), the arrow bit (am), the spell stance (sr),
// the cast count (cn) and the cast's range (cr) at both ends, clamped,
// and a pose from before them reads sheathed, unswung, unarrowed and
// uncast; a draw, a swing, an arrow, a stance or a cast is a change the
// session sends at once; the eased pose carries them whole; the rig
// counts every strike it starts before its own Morrowind gate and every
// cast at the one door both lanes come through, and the host reads
// them into the pose; a peer's body draws while the sender's is drawn,
// swings once per count and never the count it was born with, holds a
// bow while the sender holds, takes the arrow when the bit says so,
// stands in the spell stance, casts once per count, and releases every
// frame the sender is not holding, as the player's own rig does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validPose, parseClient, POSE_STRIKES, POSE_CAST_RANGES } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { poseChanged, lerpPose } from '../src/net/online.js';
import { STATE_INDEX } from '../src/combat/fpsWeapon.js';
import { TARGET_TYPES } from '../src/systems/spellcast.js';
import { PeerBodies } from '../src/net/peerBodies.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ARM0 = { wd: 0, an: 0, as: 0, am: 0, sr: 0, cn: 0, cr: 0 };

test('MAC7: the wire - POSE_STRIKES is DFU\'s WeaponStates order (fpsWeapon\'s own index) and POSE_CAST_RANGES the TargetTypes\' count, one home at both ends; the pose carries the arm\'s seven clamped, a pose from before them reads sheathed, unswung, unarrowed and uncast; a draw, a swing, an arrow, a stance or a cast is a change; the eased pose carries them whole', () => {
  for (const [name, i] of Object.entries(STATE_INDEX)) assert.equal(POSE_STRIKES[i], name, `${name} at ${i}: the WeaponStates order`);
  assert.equal(POSE_STRIKES.length, Object.keys(STATE_INDEX).length);
  assert.equal(POSE_CAST_RANGES, TARGET_TYPES.length, 'the TargetTypes: CasterOnly, ByTouch, SingleTargetAtRange, AreaAroundCaster, AreaAtRange');
  assert.equal(relay.POSE_STRIKES, POSE_STRIKES, 'the same object at both ends'); assert.equal(relay.POSE_CAST_RANGES, POSE_CAST_RANGES);
  const base = { x: 1, y: 2, z: 3, yaw: 0.5, pitch: 0.1 };
  assert.deepEqual(validPose({ ...base, mv: 1 }), { ...base, mv: 1, ...ARM0 }, 'a pose from before the arm: sheathed, unswung, unarrowed, uncast');
  assert.deepEqual(validPose({ ...base, mv: 2, wd: 1, an: 17, as: 3, am: 1, sr: 1, cn: 4, cr: 2 }), { ...base, mv: 2, wd: 1, an: 17, as: 3, am: 1, sr: 1, cn: 4, cr: 2 });
  assert.equal(validPose({ ...base, wd: 'yes' }).wd, 1, 'a truthy wd is drawn'); assert.equal(validPose({ ...base, wd: 0 }).wd, 0);
  assert.equal(validPose({ ...base, wd: 2 }).wd, 2, 'MAC7 #2: 2 is the bow at full draw'); assert.equal(validPose({ ...base, wd: 3 }).wd, 1, 'anything else truthy: drawn');
  assert.equal(validPose({ ...base, an: 70000 }).an, 65535, 'the count clamped to the wire\'s width'); assert.equal(validPose({ ...base, an: -3 }).an, 0);
  assert.equal(validPose({ ...base, an: 4.7 }).an, 4, 'whole'); assert.equal(validPose({ ...base, an: 'x' }).an, 0);
  assert.equal(validPose({ ...base, as: 99 }).as, POSE_STRIKES.length - 1, 'the kind clamped to the list'); assert.equal(validPose({ ...base, as: NaN }).as, 0);
  assert.equal(validPose({ ...base, am: 'arrows' }).am, 1); assert.equal(validPose({ ...base, sr: {} }).sr, 1);
  assert.equal(validPose({ ...base, cn: 1e9 }).cn, 65535); assert.equal(validPose({ ...base, cr: 9 }).cr, POSE_CAST_RANGES - 1, 'the range clamped to the TargetTypes'); assert.equal(validPose({ ...base, cr: -1 }).cr, 0);
  const full = { ...base, mv: 0, wd: 2, an: 2, as: 6, am: 1, sr: 0, cn: 1, cr: 1 };
  assert.deepEqual(parseClient(JSON.stringify({ t: 'pose', p: full }), { hasHello: true }), { t: 'pose', p: full }, 'through the frame');
  const a = { ...base, mv: 1, ...ARM0 };
  assert.equal(poseChanged(a, { ...a }), false);
  assert.equal(poseChanged(a, { ...a, wd: 1 }), true, 'a draw goes out at once');
  assert.equal(poseChanged(a, { ...a, an: 1 }), true, 'a swing goes out at once');
  assert.equal(poseChanged(a, { ...a, as: 3 }), false, 'the kind alone is no swing - the count is');
  assert.equal(poseChanged(a, { ...a, am: 1 }), true, 'MAC7 #2: the arrow'); assert.equal(poseChanged(a, { ...a, sr: 1 }), true, 'the spell stance');
  assert.equal(poseChanged(a, { ...a, cn: 1 }), true, 'the cast'); assert.equal(poseChanged(a, { ...a, cr: 3 }), false, 'the range alone is no cast - the count is');
  const eased = lerpPose({ ...a, x: 0 }, { ...a, x: 10, wd: 2, an: 5, as: 2, am: 1, sr: 1, cn: 3, cr: 4 }, 0.5);
  assert.equal(eased.x, 5, 'the position eases');
  assert.deepEqual([eased.wd, eased.an, eased.as, eased.am, eased.sr, eased.cn, eased.cr], [2, 5, 2, 1, 1, 3, 4], 'the arm\'s seven ride whole');
  const old = lerpPose({ ...base, mv: 0 }, { ...base, mv: 1 }, 1);
  assert.deepEqual([old.wd, old.an, old.as, old.am, old.sr, old.cn, old.cr], [0, 0, 0, 0, 0, 0, 0], 'a peer from before the arm: never undefined');
});

/** MWBODY1's fake rig with the arm's doors recorded. */
function rigFactory(log, { attackThrows = false } = {}) {
  return () => {
    const r = { cam: null, mode: 'first', updates: [], sheathed: [], attacks: [], casts: [], weapons: [], spell: [], releases: 0, unloaded: false,
      attach(renderer, cam) { r.cam = cam; },
      async build(opts) { r.opts = opts; log.builds++; return { ok: true }; },
      canThirdPerson: () => true,
      setViewMode(m) { r.mode = m; return true; },
      thirdActive: () => r.mode === 'third' && r.updates.length > 0,
      update(dt) { r.updates.push(dt); },
      drawThird() { return r.thirdActive(); },
      unload() { r.unloaded = true; },
      raceHeightScale: () => 1,
      setSheathed(v) { if (r.sheathed.at(-1) === v) return false; r.sheathed.push(v); return true; },
      attack(strike, { hold = false } = {}) { if (attackThrows) throw new Error('no such clip'); r.attacks.push(hold ? `${strike}+hold` : strike); return 'chop'; },
      release() { r.releases++; return false; },
      setWeapon(item, { hasAmmo = false } = {}) { r.weapons.push([item?.templateIndex ?? null, hasAmmo]); return true; },
      readySpell(v) { if (r.spell.at(-1) === v) return false; r.spell.push(v); return true; },
      castSpell(rangeType) { r.casts.push(rangeType); return true; },
    };
    log.rigs.push(r);
    return r;
  };
}
const shown = (x, arm = {}) => ({ x, y: 0, z: -10, yaw: 0, pitch: 0, mv: 0, ...ARM0, ...arm });
const BOW = { templateIndex: 4, group: 'Weapons', material: 1, equipSlot: EQUIP_SLOTS.RightHand };
const peer = (id, s, items = [BOW]) => ({ id, name: id, look: { race: 'Nord', gender: 'male', faceIndex: 0, items }, shown: s });
const toScene = (p) => [p.x, p.y, p.z];
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

test('MAC7 #1: a peer\'s body draws while the sender\'s weapon is drawn and sheathes when it is not, swings ONCE per count with the wire\'s strike, never the count it was born with and never sheathed, and releases every frame; a rig whose attack throws stands down like any other throw', async () => {
  const log = { builds: 0, rigs: [] };
  const warned = [];
  const pb = new PeerBodies({ renderer: {}, createRig: rigFactory(log), now: () => 1000, warn: (m) => warned.push(m) });
  const near = [0, 0, 0];
  const p = peer('p1', shown(3, { wd: 0, an: 5, as: 1 }));   // born mid-count: a late joiner sees an old count
  pb.sync([p], toScene, 0.016, near); await settle();
  pb.sync([p], toScene, 0.016, near);
  const r = log.rigs[0];
  assert.equal(r.mode, 'third'); assert.equal(r.updates.length, 1);
  assert.deepEqual(r.sheathed, [true], 'the sender\'s weapon is sheathed: so is the body\'s');
  assert.deepEqual(r.attacks, [], 'the count the body was born with is no swing');
  assert.equal(r.releases, 1, 'release every frame, as weaponRig gives its own rig');
  p.shown = shown(3, { wd: 1, an: 5, as: 1 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.sheathed, [true, false], 'drawn: the body draws'); assert.deepEqual(r.attacks, [], 'and does not swing for it');
  p.shown = shown(3, { wd: 1, an: 6, as: 3 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.attacks, ['StrikeLeft'], 'the count moved: one swing, the wire\'s kind');
  pb.sync([p], toScene, 0.016, near); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.attacks, ['StrikeLeft'], 'the same count again: no second swing');
  p.shown = shown(3, { wd: 1, an: 7, as: 99 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.attacks, ['StrikeLeft', 'StrikeDown'], 'a kind past the list falls to StrikeDown (the wire clamps first; the body never throws on it)');
  p.shown = shown(3, { wd: 0, an: 8, as: 1 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.sheathed, [true, false, true], 'sheathed again');
  assert.deepEqual(r.attacks, ['StrikeLeft', 'StrikeDown'], 'a count that moved while sheathed is no swing');
  assert.equal(r.releases, 7);
  p.shown = shown(3, { wd: 1, an: 8, as: 1 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.attacks, ['StrikeLeft', 'StrikeDown'], 'and drawing again does not replay it');
  // the throw law (AUDIT MWBODY A1): the arm's doors are inside the same guard as update
  const log2 = { builds: 0, rigs: [] };
  const pb2 = new PeerBodies({ renderer: {}, createRig: rigFactory(log2, { attackThrows: true }), now: () => 1000, warn: (m) => warned.push(m) });
  const q = peer('q1', shown(3, { wd: 1, an: 1 }));
  pb2.sync([q], toScene, 0.016, near); await settle(); pb2.sync([q], toScene, 0.016, near);
  assert.equal(pb2.has('q1'), true);
  q.shown = shown(3, { wd: 1, an: 2 }); pb2.sync([q], toScene, 0.016, near);
  assert.equal(pb2.has('q1'), false, 'a rig whose attack threw stands down');
  assert.ok(warned.some((m) => /update threw: no such clip/.test(m)), 'and says why once');
});

test('MAC7 #2: the bow\'s hold - a swing that arrives with wd 2 is the draw, held, and release waits while the sender holds; the arrow - setWeapon with the wire\'s ammo bit, once per change, the body\'s own weapon, never for a body with no weapon; the spell stance - readySpell off the bit, a boolean compare; the cast - once per count with the wire\'s range, never the count the body was born with', async () => {
  const log = { builds: 0, rigs: [] };
  const pb = new PeerBodies({ renderer: {}, createRig: rigFactory(log), now: () => 1000 });
  const near = [0, 0, 0];
  const p = peer('p1', shown(3, { wd: 1, an: 1, am: 0, sr: 0, cn: 3, cr: 2 }));   // born mid-count: an old cast
  pb.sync([p], toScene, 0.016, near); await settle();
  pb.sync([p], toScene, 0.016, near);
  const r = log.rigs[0];
  assert.equal(r.opts.weapon?.templateIndex, 4, 'built with the look\'s bow'); assert.equal(r.opts.hasAmmo, false, 'and no arrow (the look carries no inventory)');
  assert.deepEqual(r.weapons, [[4, false]], 'the ammo bit is read once the body stands: none');
  assert.deepEqual(r.spell, [false]); assert.deepEqual(r.casts, [], 'the count the body was born with is no cast');
  // the arrow
  p.shown = shown(3, { wd: 1, an: 1, am: 1, cn: 3, cr: 2 }); pb.sync([p], toScene, 0.016, near); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.weapons, [[4, false], [4, true]], 'the arrow arrives: setWeapon once with the ammo bit, not once a frame');
  p.shown = shown(3, { wd: 1, an: 1, am: 0, cn: 3, cr: 2 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.weapons, [[4, false], [4, true], [4, false]], 'the last arrow spent: gone from the bow');
  // the hold
  p.shown = shown(3, { wd: 2, an: 2, as: 6, cn: 3, cr: 2 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.attacks, ['StrikeUp+hold'], 'the draw: StrikeUp, held');
  const rel = r.releases;
  pb.sync([p], toScene, 0.016, near); pb.sync([p], toScene, 0.016, near);
  assert.equal(r.releases, rel, 'held: no release while the sender holds');
  p.shown = shown(3, { wd: 1, an: 3, as: 1, cn: 3, cr: 2 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.attacks, ['StrikeUp+hold'], 'the shot is the LOOSE: release plays it and no strike is queued for the count (AUDIT WORLD C3/C4: a queued StrikeDown shot again once the arm came back)');
  assert.equal(r.releases, rel + 1, 'and release runs again');
  p.shown = shown(3, { wd: 2, an: 4, as: 6, cn: 3, cr: 2 }); pb.sync([p], toScene, 0.016, near);
  p.shown = shown(3, { wd: 1, an: 4, as: 6, cn: 3, cr: 2 }); pb.sync([p], toScene, 0.016, near);
  assert.equal(r.releases, rel + 2, 'a draw let down without a shot (the undraw) releases too, as the player\'s own rig does');
  // the spell stance and the cast
  p.shown = shown(3, { wd: 1, an: 4, sr: 1, cn: 3, cr: 2 }); pb.sync([p], toScene, 0.016, near); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.spell, [false, true], 'the stance up, once');
  p.shown = shown(3, { wd: 1, an: 4, sr: 1, cn: 4, cr: 1 }); pb.sync([p], toScene, 0.016, near); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.casts, [1], 'the count moved: one cast, the wire\'s range (ByTouch)');
  p.shown = shown(3, { wd: 1, an: 4, sr: 1, cn: 5, cr: 0 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.casts, [1, 0], 'and the next (CasterOnly)');
  p.shown = shown(3, { wd: 1, an: 4, sr: 0, cn: 5, cr: 0 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.spell, [false, true, false], 'the stance down');
  // no weapon: no arrow door
  const log2 = { builds: 0, rigs: [] };
  const pb2 = new PeerBodies({ renderer: {}, createRig: rigFactory(log2), now: () => 1000 });
  const q = peer('q1', shown(3, { wd: 1, am: 1 }), []);
  pb2.sync([q], toScene, 0.016, near); await settle(); pb2.sync([q], toScene, 0.016, near); pb2.sync([q], toScene, 0.016, near);
  assert.deepEqual(log2.rigs[0].weapons, [], 'a body with nothing in hand is handed no arrow');
});

test('MAC7: the hosts by source - weaponRig counts every strike it starts before the Morrowind arm\'s gate and every cast at castSpellAnim, and exposes both; world.js reads the sheath, the bow\'s hold off the machine, the swing, the arrow, the spell stance and the cast into every pose it sends; peerBodies drives the rig\'s doors inside the update guard and withholds release while the sender holds', () => {
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /const swing = \{ n: 0, strike: 'StrikeDown' \};(?:\s*\/\*\*[\s\S]*?\*\/)?\s*const cast = \{ n: 0, rangeType: 2 \};\s*function fpAttack\(strike\) \{\s*swing\.n = \(swing\.n \+ 1\) & 0xffff; swing\.strike = strike;\s*if \(!fpArm\.ready\(\)\) return;/, 'the strike counted before the arm\'s own gate: a classic-skin player swings too');
  assert.match(rig, /castSpellAnim: \(rangeType, element, onRelease = null\) => \{\s*cast\.n = \(cast\.n \+ 1\) & 0xffff; cast\.rangeType = rangeType \| 0;[^\n]*\n\s*fpArm\.castSpell\(rangeType\);/, 'the cast counted at the one door both lanes come through');
  assert.match(rig, /\n    swing,   \/\/ MAC7 #1/); assert.match(rig, /\n    cast,    \/\/ MAC7 #2/);
  assert.equal((rig.match(/fpAttack\(strike\)/g) ?? []).length, 3, 'the one counter sits under both strike doors (the click and the gesture)');
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ POSE_STRIKES, isWorldRoom \} from '\.\.\/net\/wire\.js';/);
  assert.match(w, /import \{ hasDaggerfallArrows \} from '\.\.\/combat\/fpArm\.js';/, 'the arrow read weaponRig\'s own per-frame read takes');
  assert.match(w, /const live = modes\?\.liveArm\?\.\(\) \?\? null;\s*const rig = live\?\.rig \?\? weaponRig;\s*const wm = rig\.playerWeapon\.machine;\s*const arm = \{\s*mv,\s*wd: rig\.playerWeapon\.sheathed \? 0 : \(wm\?\.isBow && wm\.state === 'StrikeUp' \? 2 : 1\),\s*an: rig\.swing\.n, as: Math\.max\(0, POSE_STRIKES\.indexOf\(rig\.swing\.strike\)\),\s*am: hasDaggerfallArrows\(playerEntity\.items\) \? 1 : 0, sr: \(live \? live\.armed : magic\.spellArmed\(\)\) \? 1 : 0,\s*cn: rig\.cast\.n, cr: rig\.cast\.rangeType \| 0,\s*\};/, 'the arm\'s seven off the MODE\'s rig (AUDIT WORLD C1: world.js\'s own is never stepped indoors or underground), the entity and the mode\'s spell seam');
  assert.equal((w.match(/\{ \.\.\.pose, \.\.\.arm \}/g) ?? []).length, 2, 'into the hello and every pose');
  assert.doesNotMatch(w, /\{ \.\.\.pose, mv \}/);
  const pb = rd('src/net/peerBodies.js');
  assert.match(pb, /try \{\s*this\._arm\(b, peer\.shown\);\s*b\.rig\.update\(dt\);\s*\} catch \(e\) \{ this\._fail\(b, `update threw: \$\{e\?\.message \?\? e\}`\); \}/, 'the arm inside the update guard (AUDIT MWBODY A1)');
  assert.match(pb, /b\.rig\.setSheathed\?\.\(!drawn\);/);
  assert.match(pb, /if \(b\.weapon && b\.ammo !== am && \(b\.rig\.upperBodyReady\?\.\(\) \?\? true\) && b\.rig\.setWeapon\?\.\(b\.weapon, \{ hasAmmo: !!am \}\) !== false\) b\.ammo = am;/, 'the arrow through setWeapon, once per change - when the arm is quiet and only as the rig took it (AUDIT WORLD C5/C6)');
  assert.match(pb, /b\.rig\.readySpell\?\.\(!!shown\.sr\);/);
  assert.match(pb, /if \(an !== b\.swing\) \{\s*b\.swing = an;\s*if \(b\.held\) \{[\s\S]*?\} else \{[\s\S]*?b\.pending = drawn \? \{ strike: POSE_STRIKES\[shown\.as \| 0\] \?\? 'StrikeDown', hold: shown\.wd === 2, left: PENDING_FRAMES \} : null;\s*\}\s*\}\s*if \(b\.pending && b\.pending\.left-- > 0\) \{\s*if \(b\.rig\.attack\?\.\(b\.pending\.strike, \{ hold: b\.pending\.hold \}\)\) \{ b\.held = b\.pending\.hold; b\.pending = null; \}\s*\} else b\.pending = null;/);
  assert.match(pb, /if \(cn !== b\.cast\) \{ b\.cast = cn; b\.rig\.castSpell\?\.\(shown\.cr \| 0\); \}/);
  assert.match(pb, /if \(shown\.wd !== 2\) \{ b\.rig\.release\?\.\(\); b\.held = false; \}/, 'release withheld while the sender holds - weaponRig\'s own StrikeUp gate - and the hold forgotten with it (AUDIT WORLD C4)');
  assert.match(pb, /const opts = this\._buildOpts\(look\); b\.weapon = opts\.weapon \?\? null; res = await b\.rig\.build\(opts\);/, 'the body keeps its weapon for the arrow door');
});
