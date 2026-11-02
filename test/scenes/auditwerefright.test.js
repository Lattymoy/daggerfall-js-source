// AUDIT WERE-FRIGHT (2026-09-30, Mac: "Audit this") - PR #459's WERE-FRIGHT and MW-BRIG3, audited in six lenses: the
// arrest flow and its laws, the watch pool, the enemy motor, the hosts' seams (online and every input path to the
// box), MW-BRIG3's fit, and the records. Each pin here failed on the code before its fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createArrestFlow } from '../../src/scenes/arrestFlow.js';
import { CRIMES } from '../../src/systems/court.js';
import { LYCANTHROPY_TYPES } from '../../src/systems/infection.js';
import { EnemyAI } from '../../src/characters/enemy/enemyMotor.js';
import { Collider } from '../../src/player/collider.js';
import { createCityGuards, GUARD_MOBILE_TYPE } from '../../src/scenes/cityGuards.js';

const src = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const curse = (isTransformed = true) => ({ kind: 'racialOverride', racial: 'lycanthropy', infectionType: LYCANTHROPY_TYPES.Werewolf, isTransformed });
const mkWanted = (over = {}) => ({
  name: 'Mack', level: 10, health: 30, maxHealth: 40, fatigue: 0, maxFatigue: 100, magicka: 0, maxMagicka: 20,
  stats: { endurance: 50, strength: 50, willpower: 50, personality: 50 },
  crimeCommitted: CRIMES.Murder, legalRep: {}, items: [], skills: 30,
  haveShownSurrenderDialogue: false, arrested: false, activeEffects: [curse()], ...over,
});
function mkFlow(player, { roll = 0.99 } = {}) {
  const slot = { win: null };
  const talk = { texts: () => null, showOverlay(win) { if (slot.win && slot.win !== win) slot.win.dispose?.(); slot.win = win; } };
  const said = []; const heard = []; let fled = 0;
  const flow = createArrestFlow({
    townTalk: talk, playerEntity: player, regionIndex: 17, rolls: () => roll,
    advanceDays: () => {}, advanceMinutes: () => {}, guildRankOf: () => null,
    clearEnemies: () => {}, positionPlayerAtLocationEntrance: () => {},
    say: (l) => said.push(l), playSound: (c) => heard.push(c), watchFlees: () => { fled++; return 1; },
  });
  return { flow, slot, said, heard, fled: () => fled };
}

// ── F1 (the hosts' seams) ────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT WERE-FRIGHT F1: every host that keeps a building\'s watch sends it running - exterior.js ran its street alone', () => {
  // Both exterior hosts build the mode machine (createWorldModes), and so a watch that can be called into a building
  // (worldModes' interiorGuards, ROAD-B). A roar that works forgets the crime; a building's watch left standing - the
  // player a beast, GUARD1's fourth clause - kept striking a beast with no crime left to halt it for.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(host);
    assert.ok(s.includes('createWorldModes('), `${host} keeps a building's watch`);
    const flow = s.slice(s.indexOf('createArrestFlow({'), s.indexOf('createArrestFlow({') + 4000);
    const door = flow.match(/watchFlees: \(\) => ([^\n]*),/);
    assert.ok(door, `${host}: the roar's door`);
    assert.match(door[1], /cityGuards\.frighten\(/, `${host}: the street's watch`);
    assert.match(door[1], /modes\?\.frightenWatch\?\.\(\)/, `${host}: and the building's`);
  }
  assert.match(src('src/scenes/worldModes.js'), /frightenWatch: \(\) => interiorGuards\?\.frighten\(player\.pos\) \?\? 0,/);
});

// ── F2 (the arrest flow) ─────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT WERE-FRIGHT F2: a roar is a beast\'s - asked as a beast and answered as a man, F frightens no one and forgets nothing', () => {
  // Online the world runs under the box (WORLD5), so the change can end while it stands - the mirror of the man's
  // question answered as a beast (WERE-FRIGHT, arrestFlow's Y arm). The roll used to run whatever the form: a MAN's
  // crime written to None through the setter (outside beast form that write is real) and the watch routed by a roar
  // nobody heard. Mac's rule is the form's: "human form surrenders as before" - a man has no roar, and fights.
  const player = mkWanted();
  const f = mkFlow(player, { roll: 0 });   // a roar would work
  let landed = 0;
  f.flow.onGuardHit(6, () => { landed++; }, { guardLevel: 10 });
  const box = f.slot.win;
  assert.deepEqual(box.options.map((o) => o.code), ['KeyF', 'KeyN'], 'asked as a beast');
  player.activeEffects[0].isTransformed = false;   // the change ends under the box
  box.input('KeyF');
  assert.equal(player.crimeCommitted, CRIMES.Murder, 'the man\'s crime stands');
  assert.equal(f.fled(), 0, 'no watch routed');
  assert.deepEqual([f.heard, f.said], [[], []], 'no roar, no line');
  assert.equal(landed, 1, 'he fights - the withheld blow lands, as N lands it');
  assert.equal(f.flow.inCourt(), false, 'and the question is over');
  f.flow.dispose();
});

// ── F3 (the watch pool and the motor) ───────────────────────────────────────────────────────────────────────────
const quad = new Uint32Array([0, 1, 2, 0, 2, 3]);
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function field() {
  const c = new Collider(() => -1000);
  c.addMesh('floor', new Float32Array([-80, 0, -80, 80, 0, -80, 80, 0, 80, -80, 0, 80]), quad, I4);
  return c;
}
test('AUDIT WERE-FRIGHT F3: a routed watchman is not a pacified one - struck as he runs, he turns nobody, and stays a target', () => {
  // flee() used to clear isHostile. IsHostile false is DFU's PASSIVE foe (a pacified one, a castle's guard before the
  // castle turns): striking one is MakeEnemiesHostile over the area (DaggerfallEntityBehaviour.cs:255-258, the pool's
  // makeAreaHostile), and MeleeAttackFriendlyProtection spares one from a swing's box pass. A watchman running from a
  // beast is neither - he takes no target (the run's own law), so he strikes no one; he stays hostile.
  const ai = new EnemyAI(field(), [0, 0, 2], Math.PI, { liveSpeed: 50 });
  ai.flee([0, 0, 0], 3);
  assert.equal(ai.isHostile, true, 'the run takes his target, not his hostility');
  assert.equal(ai.target, null);
  const c = field();
  let turned = 0;
  const stubTex = { getFrameCount: () => 1, getSize: () => ({ width: 1, height: 1 }), getScale: () => ({ width: 0, height: 0 }) };
  const pool = createCityGuards({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: c, fetchBytes: () => new Promise(() => {}), getTexture: async () => stubTex,
    uploadRecordFrame: () => {}, currentMinute: () => 0,
    playerEntity: mkWanted({ crimeCommitted: 0 }), audio: null, onPlayerHurt: () => {}, rand: () => 0.9,
    makeAreaHostile: () => { turned++; },
  });
  const g = {
    id: 1, dead: false, defender: false, batch: {}, mobileType: GUARD_MOBILE_TYPE, _swingSeq: 0, _mout: null, archive: 399, tex: stubTex,
    entity: { health: 40, maxHealth: 40, level: 10, activeEffects: [], items: [], stats: { speed: 50 } },
    mobile: { update: () => ({ record: 0, frame: 0, flip: false }), doMeleeDamage: false },
    ai: new EnemyAI(c, [0, 0, 1.5], Math.PI, { liveSpeed: 50 }),
    attack: { machine: { state: 'Idle' }, swingSeq: 0, update() {} }, sounds: { tick: () => null }, concealment: () => 0,
  };
  pool.guards.push(g);
  assert.equal(pool.frighten([0, 0, 0]), 1);
  pool.handleAttackFromPlayer(g, [0, 0, 0]);
  assert.equal(turned, 0, 'a blow on a routed watchman turns no one else in the area');
  assert.equal(pool.anyWatchStanding(), false, 'and he is still not the watch standing');
});

// ── F4 (the arrest flow, met by the merge of #464) ──────────────────────────────────────────────────────────────────
test('AUDIT WERE-FRIGHT F4: the watch\'s stop (REP1, merged in) walks no beast into court - "come quietly" is no answer a beast has', () => {
  // REP1's stop (scenes/standingHost.js) challenges a known criminal on sight and never a transformed one - the beast is
  // nobody's face. Online the world runs under its box (WORLD5), so the change can come while it stands, and S reached
  // surrenderToChallenge, which wrote the Conspiracy, charged it and carried the beast into court: the surrender the
  // beast has not got (WERE-FRIGHT), by the door the merge brought in. The stop lapses instead, as it never began.
  const beast = mkWanted({ crimeCommitted: 0, legalRep: { 17: 5 } });
  const f = mkFlow(beast);
  assert.equal(f.flow.surrenderToChallenge(), false, 'no surrender taken');
  assert.equal(beast.arrested, false, 'no beast is tried');
  assert.equal(beast.crimeCommitted, 0, 'no Conspiracy written for it');
  assert.equal(beast.haveShownSurrenderDialogue, false, 'nothing asked');
  assert.equal(beast.chargedCrime ?? null, null, 'nothing charged');
  f.flow.dispose();
  // a man still comes quietly, as REP1 built it
  const man = mkWanted({ crimeCommitted: 0, legalRep: { 17: 5 }, activeEffects: [curse(false)] });
  const m = mkFlow(man);
  assert.equal(m.flow.surrenderToChallenge(), true);
  assert.equal(man.arrested, true);
  m.flow.abandon(); m.flow.dispose();
});
