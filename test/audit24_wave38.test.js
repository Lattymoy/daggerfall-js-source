// AUDIT 24, wave 38: the exterior death surface.
// EnemyDeath.CompleteDeath runs for EVERY enemy in DFU and does four
// things the port's two above-ground pools did not: it asks the motor
// for the ground under the body (GameObjectHelper:817), it plays
// BodyFall (:126-129), it makes a LOOTABLE corpse marker (:96-123),
// and it hands that marker to PlayerActivate's CorpseMarker arm. The
// encounter pool rolled its loot table at spawn, equipped the foe,
// drew a corpse - and exported no way to open it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  mintCorpseMarker, playBodyFall, corpseLootTargets, takeCorpseLoot, sayEnemyDied, ARROW_TEMPLATE_INDEX,
} from '../src/scenes/corpseMarker.js';
import { CORPSE_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { goldStack } from '../src/systems/inventory.js';
import { goldAmount } from '../src/systems/court.js';
import { SOUND } from '../src/systems/soundClips.js';
import { KB_UNIT, enemyWeightClassicUnits, weaponKnockbackSpeed, weaponKnockbackApplies } from '../src/combat/formulas.js';
import { ENEMY_BASICS, ENEMY_NAMES, enemyDisplayName } from '../src/characters/enemyBasics.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const GHOST = 18, WRAITH = 23;

/** A renderer/texture rig thin enough to see exactly what was minted. */
function rig({ floorY = null } = {}) {
  const made = [];
  return {
    made,
    renderer: {
      createBillboardBatch: (archive, record, size, centres) => {
        const b = { archive, record, size, centres, frame: null };
        made.push(b); return b;
      },
      destroyBillboardBatch: () => {},
    },
    getTexture: async () => ({
      recordCount: 8,
      getSize: () => ({ width: 64, height: 100 }),
      getScale: () => ({ width: 0, height: 0 }),
    }),
    uploadRecordFrame: () => {},
    // floorLanding casts DOWN and snaps to the surface it finds.
    collider: floorY === null ? null : {
      raycast: (o, d) => (d[1] < 0 ? o[1] - floorY : Infinity),
      heightAt: () => floorY,
    },
  };
}

test('audit24 wave38: the corpse lands on the GROUND, not where the flyer died', async () => {
  // GameObjectHelper.CreateLootableCorpseMarker:817 -
  //     Vector3 position = enemyMotor.FindGroundPosition();
  // Both exterior pools passed the foe's last feet straight through, so
  // a bat or a harpy killed on the wing left its body in mid-air.
  const r = rig({ floorY: 0 });
  const c = await mintCorpseMarker({
    renderer: r.renderer, getTexture: r.getTexture, uploadRecordFrame: r.uploadRecordFrame,
    collider: r.collider, corpseTexture: { archive: 405, record: 1 }, feet: [10, 12, -4],
  });
  assert.ok(c, 'a marker was minted');
  assert.equal(c.pos[1], 0, 'dropped to the floor twelve metres below');
  assert.deepEqual([c.pos[0], c.pos[2]], [10, -4], 'and stayed under where it died');
  assert.equal(c.archive, 405);
  assert.equal(c.record, 1);
  assert.equal(c.batch.frame, 0, 'FA1: a BARE record plus a frame field');
  assert.equal(c.batch.record, 1, 'the record must not carry the frame itself');
  // the recenter params travel with it (AUDIT 17e F23)
  for (const k of ['batch', 'archive', 'record', 'size', 'pos']) assert.ok(k in c, k);

  // no collider (a host or rig without one) leaves the position alone
  // rather than inventing a floor
  const bare = rig();
  const c2 = await mintCorpseMarker({
    renderer: bare.renderer, getTexture: bare.getTexture, uploadRecordFrame: bare.uploadRecordFrame,
    collider: null, corpseTexture: { archive: 405, record: 1 }, feet: [1, 9, 2],
  });
  assert.deepEqual(c2.pos, [1, 9, 2]);
});

test('AUDIT 39: a recenter DURING the corpse mint moves the body with the world', async () => {
  // AUDIT 17e F23 / THE FOUR HOSTS RULE. The mint baked `pos` from
  // `feet` BEFORE `await getTexture(archive)` - a cold TEXTURE.###
  // read that spans frames on a first kill of a type - and the record
  // joins `corpseBatches` only in the caller's `.then`, so offsetAll
  // (the only thing that shifts a corpse) could reach neither the
  // record nor the position. A recenter in that window left the body
  // AND its loot AABB a whole map pixel (819.2) from the kill.
  //
  // The pools shift `ai.feet` IN PLACE, so reading it after the warm
  // is what makes the mint follow the world.
  const r = rig({ floorY: 0 });
  let land;
  const feet = [10, 0, -4];                       // the pool's live array
  const c = mintCorpseMarker({
    renderer: r.renderer,
    getTexture: () => new Promise((res) => { land = () => res({ recordCount: 8, getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }) }); }),
    uploadRecordFrame: r.uploadRecordFrame,
    collider: r.collider, corpseTexture: { archive: 405, record: 1 }, feet,
  });
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(r.made.length, 0, 'nothing is baked while the archive warms');
  feet[0] -= 819.2;                               // the floating origin recenters
  land();
  const marker = await c;
  assert.deepEqual(marker.pos, [10 - 819.2, 0, -4], 'the body stands where the foe now does');
  assert.deepEqual(r.made[0].centres[0], [10 - 819.2, 0, -4], 'and the STATIC_DRAW batch was baked there');
});

test('AUDIT 39: a pool that prunes keys its corpses by a stable id, not by the array index', () => {
  // cityGuards splices walk-aways out of `guards` now, so an index is
  // no longer a name: the body at index 1 when the target list was
  // built is a different body once anything ahead of it leaves. Pools
  // that never splice (exteriorFoes) keep the index, which is what the
  // default is for.
  const bodies = [{ corpse: true, id: 7 }, { corpse: true, id: 9 }];
  const byId = corpseLootTargets(bodies, 'guardCorpse', { isCorpse: () => true, feetOf: () => [0, 0, 0], idOf: (e) => e.id });
  assert.deepEqual(byId.map((t) => t.key), ['guardCorpse:7', 'guardCorpse:9']);
  bodies.shift();   // the walk-away ahead of it is pruned
  assert.deepEqual(corpseLootTargets(bodies, 'guardCorpse', { isCorpse: () => true, feetOf: () => [0, 0, 0], idOf: (e) => e.id })
    .map((t) => t.key), ['guardCorpse:9'], 'the surviving body keeps its name');
  const byIndex = corpseLootTargets(bodies, 'foeCorpse', { isCorpse: () => true, feetOf: () => [0, 0, 0] });
  assert.deepEqual(byIndex.map((t) => t.key), ['foeCorpse:0'], 'no idOf, the index stands');
});

test('audit24 wave38: the SL2 guard, and the two ways a mint declines', async () => {
  const r = rig({ floorY: 0 });
  const base = {
    renderer: r.renderer, getTexture: r.getTexture, uploadRecordFrame: r.uploadRecordFrame,
    collider: r.collider, feet: [0, 0, 0],
  };
  // a backward load can resurrect the foe inside the await; a corpse
  // must never mint for a live one
  assert.equal(await mintCorpseMarker({ ...base, corpseTexture: { archive: 405, record: 1 }, stillDead: () => false }), null);
  assert.equal(r.made.length, 0, 'and nothing was built');
  // no corpse texture at all (the table leaves some rows without one)
  assert.equal(await mintCorpseMarker({ ...base, corpseTexture: null }), null);
  // a record past the end of the archive
  assert.equal(await mintCorpseMarker({ ...base, corpseTexture: { archive: 405, record: 99 } }), null);
  assert.equal(r.made.length, 0);
});

test('audit24 wave38: BodyFall plays at the corpse, on every death', () => {
  // EnemyDeath.cs:126-129 - PlayClipAtPoint(SoundClips.BodyFall,
  // loot.transform.position, 1f). Unconditional: no pool in the port
  // played it, and it is the sound a kill makes.
  assert.equal(SOUND.BodyFall, 15, 'SoundClips.cs:45');
  const heard = [];
  playBodyFall({ play3d: (clip, at, vol, opts) => heard.push({ clip, at, vol, opts }) }, [3, 0, 4]);
  assert.equal(heard.length, 1);
  assert.equal(heard[0].clip, SOUND.BodyFall);
  assert.deepEqual(heard[0].at, [3, 0, 4], 'at the CORPSE position, not the last feet');
  // a host with no audio must not throw on a kill
  assert.doesNotThrow(() => playBodyFall(null, [0, 0, 0]));
  assert.doesNotThrow(() => playBodyFall({}, [0, 0, 0]));

  // and both pools route their death through it
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) {
    assert.match(rd(f), /playBodyFall\(audio, c\.pos\)/, `${f} plays it at the minted position`);
    assert.match(rd(f), /mintCorpseMarker\(\{/, `${f} mints through the one home`);
  }
});

test('audit24 wave38: PlayerActivate\'s CorpseMarker arm - empty, arrows, and the rest', () => {
  const say = [];
  const player = { items: [] };
  const s = (l) => say.push(l);

  // :942-947 - an empty body is TOLD to you and the container is
  // disabled. The watch pool used to skip empty corpses silently, so
  // the line could not be reached at all.
  const empty = { corpse: true, entity: { items: [] } };
  assert.equal(takeCorpseLoot(empty, player, s), 0);
  assert.deepEqual(say, ['The body has no treasure.']);
  assert.equal(empty.corpseDisabled, true, 'DisableEmptyCorpseContainer');
  assert.equal(corpseLootTargets([empty], 'k', { isCorpse: () => true, feetOf: () => [0, 0, 0] }).length, 0,
    'and it stops being a target');
  assert.equal(takeCorpseLoot(empty, player, s), 0, 'a disabled corpse takes nothing');
  assert.equal(say.length, 1, 'and says nothing more');

  // :948-952 - one item and it is arrows: collected whole, no window.
  // Killing anything with a bow leaves exactly this, because the
  // landed arrow joins the target's inventory.
  say.length = 0;
  const arrows = { corpse: true, entity: { items: [{ group: 'Weapons', templateIndex: ARROW_TEMPLATE_INDEX, stackCount: 7 }] } };
  assert.equal(ARROW_TEMPLATE_INDEX, 131);
  assert.equal(takeCorpseLoot(arrows, player, s), 1);
  assert.deepEqual(say, ['You collect the arrows.']);
  assert.equal(player.items.length, 1);
  assert.equal(player.items[0].stackCount, 7, 'the whole stack');
  // NOT disabled: DFU disables on the activation that FINDS it empty,
  // which is the NEXT one - so the player still gets told.
  assert.notEqual(arrows.corpseDisabled, true);
  assert.equal(corpseLootTargets([arrows], 'k', { isCorpse: () => true, feetOf: () => [0, 0, 0] }).length, 1);

  // anything else hands its items over
  say.length = 0;
  player.items = [];
  const body = { corpse: true, entity: { items: [{ name: 'a', templateIndex: 1 }, { name: 'b', templateIndex: 2 }] } };
  assert.equal(takeCorpseLoot(body, player, s), 2);
  assert.deepEqual(say, ['You take 2 items.']);
  assert.equal(player.items.length, 2);
  assert.equal(body.entity.items.length, 0, 'the body is emptied');
  assert.notEqual(body.corpseDisabled, true, 'still activatable - the empty line is owed');
  // ...and the next activation is the one that closes it
  say.length = 0;
  assert.equal(takeCorpseLoot(body, player, s), 0);
  assert.deepEqual(say, ['The body has no treasure.']);
  assert.equal(body.corpseDisabled, true);

  // one item that is NOT arrows takes the general arm
  say.length = 0;
  player.items = [];
  assert.equal(takeCorpseLoot({ corpse: true, entity: { items: [{ templateIndex: 120 }] } }, player, s), 1);
  assert.deepEqual(say, ['You take 1 item.']);

  // E4's GOLD DOOR, on the bulk take. DoTransferItem's first statement
  // (DaggerfallInventoryWindow.cs:1562-1571) spends a Currency pile
  // bound for PlayerEntity.Items into the counter and never adds it to
  // the list; DFU reaches it because :957 opens the window over the
  // corpse. The port's bulk take is the residue this file records, so
  // the door is spelled in takeCorpseLoot - without it a corpse's
  // loot-table gold (loot.js:169) lands in the pack, where
  // court.goldAmount cannot see it and it is unspendable forever.
  say.length = 0;
  player.items = [];
  player.goldPieces = 50;
  const rich = { corpse: true, entity: { items: [goldStack(500), { name: 'Dagger', templateIndex: 111 }] } };
  assert.equal(takeCorpseLoot(rich, player, s), 2, 'the pile still counts toward the line');
  assert.deepEqual(say, ['You take 2 items.']);
  assert.equal(player.items.some((it) => it.group === 'Currency'), false,
    'the player\'s collection can NEVER hold Currency (inventory.js:48-56)');
  assert.equal(player.items.length, 1);
  assert.equal(player.goldPieces, 550, 'playerEntity.GoldPieces += item.stackCount');
  assert.equal(goldAmount(player), 550, 'and it is spendable');
});

test('audit24 wave38: the kill notice, and the name table that was out of reach', () => {
  // EnemyDeath.cs:79-83 - every kill pops "%s just died.", and no pool
  // in the port ever said it.
  const said = [];
  assert.equal(sayEnemyDied((l) => said.push(l), 18), 'Ghost just died.');
  assert.deepEqual(said, ['Ghost just died.']);
  assert.equal(sayEnemyDied((l) => said.push(l), 146), 'City Watch just died.', 'the class index law: 43 + id - 128');
  assert.equal(sayEnemyDied((l) => said.push(l), 0), 'Rat just died.');
  // a type with no name says nothing rather than "undefined just died."
  said.length = 0;
  assert.equal(sayEnemyDied((l) => said.push(l), 9999), null);
  assert.deepEqual(said, []);
  assert.doesNotThrow(() => sayEnemyDied(null, 0), 'a host with no say seam');

  // GetLocalizedEnemyName's index law, both halves
  assert.equal(ENEMY_NAMES.length, 62);
  assert.equal(enemyDisplayName(42), 'Lamia', 'the last monster');
  assert.equal(enemyDisplayName(128), 'Mage', 'the first class enemy');
  assert.equal(enemyDisplayName(146), 'City Watch', 'the last');

  // ONE HOME: the table moved to the leaf that holds the rows, and
  // quest/foe.js re-exports the SAME object rather than keeping a copy.
  assert.doesNotMatch(rd('src/systems/quest/foe.js'), /^export const ENEMY_NAMES = Object\.freeze\(\[/m,
    'no second copy of the name list');
  assert.match(rd('src/systems/quest/foe.js'), /export \{ ENEMY_NAMES, isClassEnemyId \} from '\.\.\/\.\.\/characters\/enemyBasics\.js'/);

  // and the reason it had to move: no row has ever carried a `name`,
  // so the dungeon's pacification line called everything "The enemy".
  assert.equal(Object.values(ENEMY_BASICS).filter((r) => r.name !== undefined).length, 0,
    'ENEMY_BASICS rows have no name field');
  // AUDIT 24 (wave 42): the line moved into hostCombat's shared
  // pacification, which is where all three pools reach it now.
  const hc = rd('src/scenes/hostCombat.js');
  assert.match(hc, /enemyDisplayName\(mobileType\) \?\? 'The enemy'/);
  assert.doesNotMatch(rd('src/scenes/dungeonContext.js'), /ENEMY_BASICS\[f\.mobileType\]\?\.name/, 'the field that never existed');

  // both pools announce their kills
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) {
    assert.match(rd(f), /sayEnemyDied\(/, `${f} announces the kill`);
  }
});

test('audit24 wave38: the encounter pool exports the seam, and the host asks BOTH pools', () => {
  const src = rd('src/scenes/exteriorFoes.js');
  // The pin is about the loot SEAM being exported, not about the
  // export list being frozen - X9 added removeFoe beside it for the
  // creature dispel. Check the members this test is actually about.
  const ret = src.slice(src.lastIndexOf('return {'));
  for (const member of ['foes', 'spawnFoe', 'damageFoe', 'lootTargets', 'takeLoot']) {
    assert.ok(new RegExp(`\\b${member}\\b`).test(ret), `${member} is exported`);
  }
  assert.match(src, /corpseLootTargets\(foes, 'foeCorpse'/);
  // the target sits at the GROUND position the marker landed on
  assert.match(src, /feetOf: \(f\) => f\.corpseMarker\?\.pos \?\? f\.ai\?\.feet \?\? null/);
  assert.match(rd('src/scenes/cityGuards.js'), /feetOf: \(g\) => g\.corpseMarker\?\.pos \?\? g\.ai\?\.feet \?\? null/);

  // ONE pick over BOTH pools: the nearest body wins, not the pool the
  // host happens to ask first.
  const w = rd('src/scenes/world.js');
  assert.match(w, /const corpseTargets = \[\.\.\.cityGuards\.lootTargets\(\), \.\.\.exteriorFoes\.lootTargets\(\)\]/);
  assert.match(w, /pickActivatable\(cam\.pos, useFwd, corpseTargets, collider\)/);
  assert.match(w, /lootKey\.startsWith\('foeCorpse:'\) \? exteriorFoes : cityGuards/);
  assert.doesNotMatch(w, /pickActivatable\(cam\.pos, useFwd, cityGuards\.lootTargets\(\), collider\)/,
    'the watch-only pick is gone');

  // the target reach is the corpse one, everywhere it is built
  const t = corpseLootTargets([{ corpse: true }], 'foeCorpse', { isCorpse: () => true, feetOf: () => [2, 3, 4] });
  assert.equal(t[0].distance, CORPSE_ACTIVATION_DISTANCE);
  assert.deepEqual(t[0].aabb.min, [1.5, 3, 3.5]);
  assert.deepEqual(t[0].aabb.max, [2.5, 3.6, 4.5]);
});

test('audit24 wave38: the knockback gate, with the Weight arm C# actually writes', () => {
  // WeaponManager.cs:578-581
  //     if (KnockbackSpeed <= (5 / ratio) && EntityType == EnemyClass
  //         || MobileEnemy.Weight > 0)
  // `&&` binds tighter than `||`. The encounter pool had only the
  // first HALF of the first arm - no isClass, no Weight - which broke
  // it at both ends.
  // all three pools ask the ONE gate now
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js', 'src/scenes/dungeonContext.js']) {
    assert.match(rd(f), /weaponKnockbackApplies\(/, `${f} asks the shared gate`);
    assert.doesNotMatch(rd(f), /knockbackSpeed <= 5 \/ KB_UNIT/, `${f} does not re-derive it`);
  }

  // END ONE: a weighted monster re-knocks on EVERY hit. The pool's old
  // gate was the first arm alone, so the second hit inside one shove
  // did nothing - the first had already pushed the speed over the
  // threshold. The two gates are written out and made to disagree.
  const threshold = 5 / KB_UNIT;
  const shipped = (speed, isClass, weight) => weaponKnockbackApplies(speed, isClass, weight);
  const wasWritten = (speed) => speed <= threshold;           // the pool's old line, verbatim
  const w80 = enemyWeightClassicUnits(false, 'male', 80);
  const afterOneHit = weaponKnockbackSpeed(10, w80);
  assert.ok(afterOneHit > threshold, `one hit leaves the speed at ${afterOneHit.toFixed(2)}, over ${threshold.toFixed(2)}`);
  assert.equal(wasWritten(afterOneHit), false, 'the old gate refused the next hit');
  assert.equal(shipped(afterOneHit, false, 80), true, 'DFU knocks it again - Weight > 0, no question asked');
  // and the gates agree where they should: a fresh weighted monster
  assert.equal(wasWritten(0), true);
  assert.equal(shipped(0, false, 80), true);
  // a class enemy mid-shove is refused by BOTH - that arm was right
  assert.equal(shipped(afterOneHit, true, 0), false, 'a class enemy waits for the shove to decay');
  assert.equal(shipped(0, true, 0), true, 'and re-knocks once it has');

  // END TWO: the two Weight-0 rows. DFU's gate spares them precisely
  // BECAUSE the formula cannot take a zero weight - (10d/0) * (2d-2d)
  // is Infinity times zero.
  for (const id of [GHOST, WRAITH]) {
    assert.equal(ENEMY_BASICS[id].weight ?? 0, 0, `mobile ${id} is a Weight-0 spectral`);
  }
  const zeroes = Object.keys(ENEMY_BASICS).map(Number).filter((i) => i < 128 && (ENEMY_BASICS[i].weight ?? 0) === 0 && ENEMY_BASICS[i].corpseTexture);
  assert.deepEqual(zeroes.sort((a, b) => a - b), [GHOST, WRAITH], 'and they are the only two');
  const poisoned = weaponKnockbackSpeed(10, 0);
  assert.ok(Number.isNaN(poisoned), 'the formula returns NaN for them');
  // and the NaN was not merely cosmetic: it never leaves. The old gate
  // is a comparison against it, and every comparison with a NaN is
  // false - so the field could never be written again either.
  assert.equal(poisoned > 0, false, 'the motor never knocks');
  assert.equal(wasWritten(poisoned), false, 'and no later hit could ever set the field again');
  // the shipped gate never lets the formula see the zero at all
  assert.equal(shipped(0, false, 0), false, 'a fresh Weight-0 spectral: refused');
  assert.equal(shipped(poisoned, false, 0), false, 'and refused after, so no NaN is ever minted');
  // the fix is the gate, not a clamp inside the formula: DFU's formula
  // is allowed to be undefined at zero because DFU never calls it there
  assert.equal(typeof weaponKnockbackSpeed(10, 1), 'number');
});
