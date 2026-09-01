// IF - THE INTERIOR FOE POOL. A building interior is the one place in
// the port that could hold no enemy at all; three FLAGGED sites named
// that gap. This slice mounts a pool in the interior host and retires
// all three.
//
// THE DECIDING FACT, established from the C# before a line was
// written: a building interior carries NO STATIC ENEMIES in DFU. Its
// whole marker vocabulary is Rest/Enter/Treasure/LadderBottom/
// LadderTop (DaggerfallInterior.cs:63-70) and its layout chain mints
// none. So this pool is not a spawner - it is a HOME, for the things
// that DO put an enemy in a building: a quest's CreateFoe, and the
// Daedra summoning window's refusal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dfuFile } from './dfuRoot.mjs';   // PY1: DFU_PATH, then the in-tree sparse clone

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WM = rd('src/scenes/worldModes.js');
const XF = rd('src/scenes/exteriorFoes.js');
const DFU_INTERIOR = dfuFile('Assets/Scripts/Internal/DaggerfallInterior.cs');

test('IF GATE: DFU building interiors carry NO enemy marker - the fact the slice is built on', (t) => {
  if (!existsSync(DFU_INTERIOR)) { t.diagnostic('DFU clone absent - the enum gate skipped'); return; }
  const cs = readFileSync(DFU_INTERIOR, 'utf8');
  const body = cs.match(/enum InteriorMarkerTypes\s*\{([^}]+)\}/)[1];
  const names = body.split(',').map((x) => x.trim().split('=')[0].trim()).filter(Boolean);
  assert.deepEqual(names, ['Rest', 'Enter', 'Treasure', 'LadderBottom', 'LadderTop'],
    'the WHOLE interior marker vocabulary - no enemy marker exists to read');
  // and the port says so where it mounts the pool, so the next reader
  // does not go looking for an interior spawn table that is not there
  assert.match(WM, /A building interior carries NO STATIC\n\s+\* ENEMIES in DFU/);
});

test('IF: the pool is the ONE factory, mounted with the interior collider - not a fourth copy', () => {
  assert.match(WM, /import \{ createExteriorFoes \} from '\.\/exteriorFoes\.js';/,
    'the exterior host\'s own factory');
  assert.match(WM, /createExteriorFoes\(\{\n\s+renderer, collider: ctx\.collider,/,
    'mounted over THIS interior\'s collider');
  // the factory was always host-agnostic: it takes its collider as a
  // parameter and never spawned an encounter of its own
  assert.match(XF, /export function createExteriorFoes\(\{ renderer, collider,/);
  // and the two arms it does carry for the exterior are answered
  // honestly rather than left to misfire
  assert.match(WM, /currentPixelKey: \(\) => null,/, 'a host whose corpses never stream out of range');
  // HE1 CLOSED THIS. The line asserted an absence that was recorded
  // rather than silent - which was the right shape for the absence and
  // the wrong thing to keep once the pool existed. The other three
  // hosts have mounted it since AUDIT 24 wave 39; this one does now.
  assert.match(WM, /hitEffects: interiorHitEffects,/, 'the blood pool, as the other three hosts have');
  assert.doesNotMatch(WM, /hitEffects: null,/, 'and the recorded absence is deleted, not annotated');
});

test('IF: the pool lives exactly as long as the interior, and hands its batches back', () => {
  // EVERY ALLOCATION HAS AN OWNER. Until a SECOND host mounted this
  // factory its owner was the process - the exterior host outlives the
  // session - so nothing ever had to free its batches. An interior
  // pool is minted per building, so without a teardown every door you
  // left leaked a batch per foe plus every corpse on the floor.
  assert.match(XF, /function destroy\(\) \{\n\s+for \(const f of foes\) releaseFoeBatch\(f\);/);
  assert.match(XF, /for \(const c of corpseBatches\) renderer\.destroyBillboardBatch\(c\.batch\);/);
  assert.match(XF, /corpseBatches\.length = 0;\n\s+foes\.length = 0;/, 'and the lists empty, so a stale handle draws nothing');
  assert.match(XF, /restoreWorld, destroy,/, 'exported');
  // minted at the mount...
  assert.match(WM, /interiorFoes = makeInteriorFoes\(ctx\);/);
  // ...and dropped at BOTH teardown doors (the questFlats double-free
  // lesson: this host has two exits, not one)
  assert.equal((WM.match(/interiorFoes\?\.destroy\?\.\(\);/g) ?? []).length, 2,
    'both exit doors free the pool - tryExit and forceExitTo');
});

test('IF: CreateFoe\'s interior arm is the dungeon arm with one term changed', () => {
  // PlaceFoeBuildingInterior (CreateFoe.cs:220-234) does NOT use
  // interior spawn points: it calls PlaceFoeFreely, and says why.
  assert.match(WM, /if \(mode === 'interior'\) return tryPlaceInteriorQuestFoe\(handle\);/);
  const arm = WM.slice(WM.indexOf('function tryPlaceInteriorQuestFoe'));
  const body = arm.slice(0, arm.indexOf('\n  }\n') + 4);
  assert.match(body, /collider: interiorCtx\.collider,/, 'the ONE term that differs from the dungeon arm');
  assert.match(body, /placeFoeFreely\(env\)/, 'the same placement law');
  assert.match(body, /if \(!interiorCtx \|\| !interiorFoes\) return false;/, 'false = retry next machine tick, verbatim');
  assert.match(body, /_fly \? spot\.y \+ 1\.5 : spot\.y/, 'FinalizeFoe lifts a FLYING foe 1.5 (:341-359)');
  assert.match(body, /Math\.atan2\(feet\[0\] - spot\.x, feet\[2\] - spot\.z\)/, 'LookAt player (:328)');
  assert.match(body, /questBehaviour: handle\.behaviour,/, 'and the resource behaviour binds at the stand');
  // the flag sentence is DELETED, not merely contradicted
  assert.ok(!WM.includes('this host has no interior enemy pool'), 'retiring a flag deletes the sentence');
});

test('IF: enemiesNearby is ONE scan over this host\'s own database, at all three consumers', () => {
  assert.match(WM, /const interiorEnemiesNearby = \(opts = \{\}\) => \(interiorFoes \? areEnemiesNearby\(interiorFoes\.foes, opts\) : false\);/);
  // rest (S40's resting variant), the rest-window's decision, and the
  // exhaustion collapse - each was a literal `false`
  assert.match(WM, /enemiesNearby: \(\) => interiorEnemiesNearby\(\{ resting: true \}\)/, 'the rest deps');
  assert.match(WM, /enemiesNearby: interiorEnemiesNearby\(\{ resting: true \}\)/, 'restDecision');
  assert.match(WM, /enemiesNearby: interiorEnemiesNearby\(\)/, 'the exhaustion collapse');
  assert.ok(!WM.includes('enemiesNearby: () => false'), 'no literal survives');
  assert.ok(!WM.includes('this host mounts no foe pool'), 'and neither does its sentence');
  // an interior with no pool minted still answers false - because
  // there is nothing there, not because it cannot look
  assert.match(WM, /interiorFoes \? areEnemiesNearby/);
});

test('IF: the summoning refusal\'s punishment is real, through one door both callers can use', () => {
  // DaggerfallDaedraSummonedWindow.cs:125 and
  // DaggerfallQuestPopupWindow.cs:257 are the same CreateFoeSpawner
  // call with different numbers, so one port door takes both.
  assert.match(WM, /function spawnDaedricPunishment\(\{ count, minDistance, maxDistance/);
  assert.match(WM, /DAEDRIC_FOES\[Math\.floor\(rolls\(\) \* DAEDRIC_FOES\.length\)\]/, 'daedricFoes[Range(0,5)]');
  assert.match(WM, /placeFoeFreely\(env, \{ minDistance, maxDistance \}\)/, 'the spawner ends in the placement ring');
  assert.match(WM, /minDistance: 8, maxDistance: 64,/, 'the refusal\'s own band (:125)');
  assert.match(WM, /spawnRefusalFoes: \(\) => spawnDaedricPunishment\(\{/, 'and the window\'s door is mounted');
  assert.ok(!WM.includes('the interior has no foe pool (FLAGGED)'), 'the flag sentence is gone');
  // and the COVEN failure - the same call with its own numbers - is
  // loosed through the same door (the pin that found this site)
  assert.match(WM, /minDistance: 4, maxDistance: 64,/, 'the coven band (:257)');
  assert.match(WM, /COVEN_FAIL_FOE_COUNT/, 'Range(1,4), beside the refusal\'s own');
  assert.ok(!WM.includes('a coven failure owes you daedra'), 'and its flag is gone too');
  const win = rd('src/ui/daedraSummonedWindow.js');
  assert.ok(!win.includes("FLAGGED: the daedric punishment"), 'and the window\'s own flag with it');
});

test('IF: an interior swing can now MEET an enemy - the tally and the no-enemy sound follow the hit', () => {
  // WeaponManager.cs:419-436. The old comment was right about a world
  // with no interior pool ("trains nothing, which is what DFU does on
  // a miss") and wrong the moment one exists: a quest foe standing in
  // a building is not a miss.
  // AUDIT 39 (#34) MOVED THIS ANCHOR: the rig's machine is gated on
  // overlayHeld now (a swing in flight must not land its hit frame
  // under an open window), so the loop header carries the gate.
  const swing = WM.slice(WM.indexOf('for (const ev of (overlayHeld ? [] : interiorWeapon.frame(dt)))'));
  const body = swing.slice(0, swing.indexOf('interiorWeapon.draw();'));
  assert.match(body, /interiorFoes\?\.resolvePlayerHit\(interiorWeapon\.playerWeapon/, 'the pool is asked FIRST');
  assert.match(body, /tallySwingSkills\(playerEntity, interiorWeapon\.playerWeapon\.weapon\);\n\s+continue;/,
    'a connecting swing trains, and does not fall through to the action objects');
  const hitIdx = body.indexOf('resolvePlayerHit');
  const envIdx = body.indexOf('envAttack(');
  assert.ok(hitIdx > 0 && envIdx > hitIdx, 'the action objects are the ELSE');
  // the stale CLAIM is gone - "envAttack hits the interior's ACTION
  // objects, not an enemy, so there is no hitEnemy to gate the tally
  // on". (The new comment quotes that sentence to say why it is
  // retired, which is the record working, not the claim surviving.)
  assert.ok(!body.includes('not an enemy, so there is no hitEnemy'), 'the stale claim is deleted');
  assert.match(body, /stopped being true/, 'and its retirement is written where it stood');
});

test('IF: the pool is ARMED for targeting like every other pool, over its own database', () => {
  assert.match(WM, /candidates: \(\) => interiorFoes\.foes\.filter\(\(f\) => !f\.dead\)/,
    'the interior\'s active-enemy database is the pool itself');
  assert.match(WM, /interiorFoes\.update\(overlayHeld \? 0 : dt, player\.pos, cam\.pos, sensesContext\(/,
    'through the ONE senses builder');
  assert.match(WM, /const _foeBatches = interiorFoes\.batches\(\);/, 'and its billboards ride the host\'s draw');
});

test('IF: quest foes stand from BUILDING MARKERS too - DFU\'s second path into an interior', () => {
  // AddQuestResourceObjects at LAYOUT time (PlayerEnterExit.cs:797-800)
  // and on Place.cs's hot-place (:508-521) is a DIFFERENT path from
  // CreateFoe's TryPlacement, and the Q4-v adapter's standFoe was
  // absent for one stated reason - "the INTERIOR enemy host" - which
  // this slice built. (Found by the scout sweep AFTER the first
  // commit: the flag was worded differently enough to survive the
  // grep that found the other four.)
  assert.match(WM, /standFoe: \(\{ foe, gender, position, behaviour \}\) => \{\n\s+if \(!interiorCtx \|\| !interiorFoes\) return null;/);
  assert.match(WM, /interiorFoes\.spawnFoe\(foe\.foeType, interiorCtx\.parentPt\(position\.x, position\.y, position\.z\)/,
    'parented exactly as this host\'s own flats are');
  assert.match(WM, /gender, questBehaviour: behaviour,/, 'and the resource behaviour binds at the stand');
  // the behaviour joins the scene walk and leaves with the teardown,
  // the dungeon adapter's own shape
  assert.match(WM, /for \(const b of interiorFoeStands\) out\.push\(b\);/);
  assert.match(WM, /questFlats = \[\];\n\s+interiorFoeStands = \[\];/);
  assert.ok(!WM.includes('this adapter\'s standFoe stays'), 'the fifth flag sentence is gone');
});

// ── CV1 (2026-08-27): the punishment wave's NUMBERS, verified against
// the C# and pinned as values rather than names. The F194 ledger row
// still called the coven failure a non-fix ("no interior foe pool");
// the IF slice had shipped the pool AND both doors under it - the row
// was stale, and this re-sweep is its close.
test('CV1: the punishment wave carries DFU\'s exact numbers and picks ONE type per wave', async () => {
  const { DAEDRIC_FOES } = await import('../src/systems/daedraSummoning.js');
  const { REFUSAL_FOE_COUNT, COVEN_FAIL_FOE_COUNT } = await import('../src/ui/daedraSummonedWindow.js');
  // daedricFoes (DaggerfallQuestPopupWindow.cs:70-72), ORDER AND ALL -
  // the Range(0,5) draw indexes this array, so a reorder changes which
  // prince answers a given roll.
  assert.deepEqual([...DAEDRIC_FOES],
    ['DaedraLord', 'DaedraSeducer', 'Daedroth', 'FireDaedra', 'FrostDaedra']);
  // Range(3, 6) = 3..5 (the refusal, DaggerfallDaedraSummonedWindow
  // .cs:125); Range(1, 4) = 1..3 (the coven failure, :257).
  assert.deepEqual([...REFUSAL_FOE_COUNT], [3, 5]);
  assert.deepEqual([...COVEN_FAIL_FOE_COUNT], [1, 3]);
  const WM = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  // ONE type per wave: the draw sits OUTSIDE the count loop, exactly
  // as the C# passes one foeType and a SpawnCount to one spawner.
  const at = WM.indexOf('function spawnDaedricPunishment');
  const body = WM.slice(at, WM.indexOf('return stood;', at));
  assert.ok(body.indexOf('DAEDRIC_FOES[') < body.indexOf('for (let i = 0; i < count; i++)'),
    'the type is drawn once, before the loop - a per-foe draw is a different wave');
  // The two distance rings, verbatim: refusal 8..64, coven 4..64.
  assert.match(WM, /minDistance: 8, maxDistance: 64,/);
  assert.match(WM, /minDistance: 4, maxDistance: 64,/);
  // Both counts are inclusive-range draws off their constants.
  assert.match(WM, /REFUSAL_FOE_COUNT\[0\] \+ Math\.floor\(Math\.random\(\) \* \(REFUSAL_FOE_COUNT\[1\] \+ 1 - REFUSAL_FOE_COUNT\[0\]\)\)/);
  assert.match(WM, /COVEN_FAIL_FOE_COUNT\[0\] \+ Math\.floor\(Math\.random\(\) \* \(COVEN_FAIL_FOE_COUNT\[1\] \+ 1 - COVEN_FAIL_FOE_COUNT\[0\]\)\)/);
});
