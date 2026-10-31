// DRAGON3 (bible/11-Multiplayer/Dwarven-Dragon.md sections 3, 6, 7 and 9): THE DWARVEN DRAGON ON THIS SCREEN, in Node over fakes -
// scenes/dragonHost.js with the real link (net/dragon/dragonLink.js) fed the wire's own projections: the `in` within its
// reach and its pace, the sighting once, a blow judged once on my feet through my saving throw, my blows out one at a time
// and none through its ward, a swing only while it stands grounded, the bar's MOVE, the fall and its remains, its body drawn
// at its plan's place, and the world host's wiring by source. tools/mutants/dragon3.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDragonHost, DRAGON_TARGET, DRAGON_IN_RESEND_MS, DRAGON_IN_RETRY_MS, DRAGON_HIT_GAP_MS, DRAGON_NOTICE_WAIT_MS, DRAGON_SCALE, REMAINS_WASH } from '../../src/scenes/dragonHost.js';
import { installDwarvenDragon } from '../../src/characters/dwarvenDragon.js';
import { createDragonLink } from '../../src/net/dragon/dragonLink.js';
import { isDragonOmen, dragonTimes, DRAGON_BRAIN_V, pixelCentreNative, DRAGON_REMAINS_MS } from '../../src/net/dragon/dragonLaw.js';
/** DRAGON-HIDDEN: a watch's omen under the tests' seed, as its cell would tell it. */
const om = (w, s = 0x5eed1234) => ({ w, s });
import { orbitLeg, lineLeg, fallLeg, planAt } from '../../src/net/dragon/dragonBody.js';
import { DRAGON_ADMIT_R, DRAGON_BLOW } from '../../src/net/dragon/dragonBrain.js';
import { HIT_KINDS } from '../../src/net/gate/gateBrain.js';
import { strikeDamage, savedShare } from '../../src/net/gate/gateStrike.js';
import { validDragonOut, cellRoomOfWire } from '../../src/net/wire.js';
import { hostText } from '../hostText.mjs';

installDwarvenDragon({ fetchBytes: async () => new Uint8Array(0) });   // its row, as the game's boot registers it (scenes/shared.js)
let W = 500_000;
while (!isDragonOmen(om(W))) W++;
const TT = dragonTimes(om(W));
const SITE = { w: W, lane: 0, px: 205, py: 214, ...pixelCentreNative(205, 214), near: 'Here' };
const CELL = cellRoomOfWire(SITE.sx, SITE.sz);
const M = 40;   // the scene's metre in native units (the fakes' scene is the native world over 40)
/** A screen at `t0` with my feet `me` metres east and north of the site. */
function screen(t0, me = [0, -200], o = {}) {
  const S = { t: t0, me, sent: [], mid: [], said: [], hurt: [], played: [], ready: true, P: { health: 100, maxHealth: 200, level: 20 } };
  const link = createDragonLink({ now: () => S.t, site: () => S.host.site(), say: (c) => S.host.refused(c) });
  S.link = link;
  S.host = createDragonHost({
    now: () => S.t, link, sites: { of: (o) => (o.w === W ? SITE : null) },
    online: { ready: () => S.ready, send: (w, cell) => { S.sent.push({ ...w, cell }); return true; } },
    local: (nx, nz) => [nx / M, nz / M], native: (x, z) => [x * M, z * M],
    ground: () => 0, feet: () => [SITE.sx / M + S.me[0], 0, SITE.sz / M + S.me[1]], eye: () => [SITE.sx / M + S.me[0], 1.6, SITE.sz / M + S.me[1]], level: () => 20,
    player: () => S.P, hurt: (n, el) => S.hurt.push([n, el]), save: () => 50, mid: (x) => S.mid.push(x), say: (x) => S.said.push(x),
    audio: { play3d: (clip, p) => S.played.push([clip, p]) }, ...o,
  });
  S.word = (w) => link.word(validDragonOut({ t: 'dragon', w: W, sx: SITE.sx, sz: SITE.sz, ...w }));
  S.st = (x = {}) => S.word({ k: 'st', b: 0, ph: 1, h: 1000, m: 1000, md: 0, mu: 0, sh: 0, legs: [orbitLeg(TT.landAt, 0, 0, 55, 0, 1, 30)], blows: [], n: 1, lv: TT.leaveAt, op: 0, fell: null, gone: null, ...x });
  S.run = (ms, step = 50) => { let r; for (let k = 0; k < ms; k += step) { r = S.host.frame(); S.t += step; } return r; };
  /** As the cell says it: a whole state every five seconds (DRAGON_STATE_SEND_MS). */
  S.heard = (ms, x = {}) => { for (let k = 0; k < ms; k += 5000) { S.st(x); S.run(Math.min(5000, ms - k)); } };
  S.host.omen(om(W));   // DRAGON-HIDDEN: its cell's answer to the `ask`
  S.host.frame();   // the site found: the link folds its words from here
  return S;
}
const ins = (S) => S.sent.filter((w) => w.k === 'in');
const hits = (S) => S.sent.filter((w) => w.k === 'hit');

test('DRAGON3 host: THE `in` - said to its site\'s cell within DRAGON_ADMIT_R once it has come down, with the watch, the brain\'s law, my level and the site; again soon while unanswered, every twenty seconds once heard; never from past its reach, nor before it lands (mutants: said from anywhere; said every frame)', () => {
  const early = screen(TT.landAt - 5000, [0, -100]);
  early.run(4000);
  assert.equal(ins(early).length, 0, 'before it lands');
  const far = screen(TT.landAt + 1000, [0, -(DRAGON_ADMIT_R + 50)]);
  far.run(5000);
  assert.equal(ins(far).length, 0, 'past its reach');
  const S = screen(TT.landAt + 1000, [0, -100]);
  assert.deepEqual(ins(S)[0], { k: 'in', w: W, bv: DRAGON_BRAIN_V, lv: 20, sx: SITE.sx, sz: SITE.sz, cell: CELL });
  S.run(DRAGON_IN_RETRY_MS + 100);
  assert.equal(ins(S).length, 2, 'again while unanswered');
  S.heard(DRAGON_IN_RESEND_MS - 1000);
  assert.equal(ins(S).length, 2, 'heard: not again soon');
  S.heard(2000);
  assert.equal(ins(S).length, 3, 'and again after DRAGON_IN_RESEND_MS');
});

test('DRAGON3 host: THE SIGHTING - said once a watch within 1.5 km of a roosting dragon, with the way to it, once it has been in sight DRAGON_NOTICE_WAIT_MS; never for one its cell says slain in that wait (mutants: said at once; said each frame)', () => {
  const S = screen(TT.landAt + 1000, [0, -1400]);
  S.run(DRAGON_NOTICE_WAIT_MS - 500);
  assert.equal(S.mid.length, 0, 'not yet');
  S.run(10_000);
  assert.equal(S.mid.filter((x) => /circles in the sky to the north/.test(x)).length, 1, S.mid.join(' | '));
  const D = screen(TT.landAt + 1000, [0, -1400]);
  D.run(2000);
  D.st({ fell: { at: D.t - 30_000, top: [], n: 1 }, legs: [fallLeg({ x: 0, z: 0, a: 30, yw: 0 }, D.t - 30_000)] });   // slain before this screen came
  D.run(10_000);
  assert.equal(D.mid.length, 0, D.mid.join(' | '));
});

test('DRAGON3 host: A BLOW ON MY FEET LANDS ONCE - a plain one\'s share of my maximum health, an element\'s through my saving throw; one off my feet never; one landed while I was dead is not judged later (mutants: judged again; the throw skipped; the shape unread)', () => {
  const S = screen(TT.landAt + 1000, [10, 10]);
  S.st();
  S.word({ k: 'atk', i: 1, a: DRAGON_BLOW.rain.id, at: S.t + 800, wu: 2200, s: [['d', 10, 10, 4], ['d', 40, 40, 4]] });
  S.word({ k: 'atk', i: 2, a: DRAGON_BLOW.volley.id, at: S.t + 900, wu: 2000, s: [['d', 9, 11, 4]] });
  S.word({ k: 'atk', i: 3, a: DRAGON_BLOW.crash.id, at: S.t + 1000, wu: 2200, s: [['d', -30, -30, 9]] });
  S.run(3000);
  assert.deepEqual(S.hurt, [[strikeDamage(DRAGON_BLOW.rain.p, 200), null], [savedShare(strikeDamage(DRAGON_BLOW.volley.p, 200), 50), 'shock']]);
  const D = screen(TT.landAt + 1000, [10, 10]);
  D.st();
  D.P.health = 0;
  D.word({ k: 'atk', i: 1, a: DRAGON_BLOW.rain.id, at: D.t + 500, wu: 2200, s: [['d', 10, 10, 4]] });
  D.run(550);
  D.P.health = 100;   // back on my feet within its landing's late span
  D.run(1000);
  assert.equal(D.hurt.length, 0, 'the dead are not struck later');
});

test('DRAGON3 host: MY BLOWS ON IT - a shaft on its body is the dragon\'s door and nothing else\'s; a swing reaches it only while it stands GROUNDED, and goes out a word at a time, DRAGON_HIT_GAP_MS apart; nothing through its ward (mutants: a swing on it aloft; the ward unread; the words unpaced)', () => {
  const S = screen(TT.landAt + 1000, [0, -6]);
  S.st();
  S.run(100);
  assert.equal(S.host.arrow({ weapon: null }, { id: 'serpent:3' }), false, 'not its body');
  assert.ok(S.host.boxes(null).some((b) => b.id === DRAGON_TARGET), 'its body in the shots\' field');
  const weapon = { strikingWeapon: null, resolveHit: (foes, _p, canSee) => foes.filter((f) => canSee(f).dist <= 3).map((foe) => ({ foe, damage: 40 })) };
  const eye = [SITE.sx / M, 1.6, SITE.sz / M - 6];
  S.st({ md: 0, legs: [lineLeg(S.t - 100, 0, [0, 0, 0], [0, 0, 0], 0)] });   // on the ground, its mode already the air's (a Takeoff Gust's wind-up)
  S.run(50);
  assert.equal(S.host.swing(weapon, eye, [0, 0, 1]), false, 'its mode aloft: no swing reaches it, as the cell would refuse it');
  S.st({ md: 1, mu: S.t + 12_000, legs: [lineLeg(S.t - 100, 0, [0, 0, 0], [0, 0, 0], 0)] });
  S.word({ k: 'md', m: 1, at: S.t - 100, until: S.t + 12_000 });
  S.run(50);
  assert.equal(S.host.swing(weapon, eye, [0, 0, 1]), true, 'grounded within reach');
  assert.equal(S.host.swing(weapon, eye, [0, 0, 1]), true);
  S.run(150);
  assert.deepEqual(hits(S).map((h) => [h.d, h.r, h.cell]), [[40, HIT_KINDS.Melee, CELL]], 'one word, however many frames');
  S.run(DRAGON_HIT_GAP_MS + 50);
  assert.equal(hits(S).length, 2, 'the next after its gap');
  S.word({ k: 'ph', n: 2, until: S.t + 3000 });
  S.run(50);
  S.host.swing(weapon, eye, [0, 0, 1]);
  S.run(DRAGON_HIT_GAP_MS * 3);
  assert.equal(hits(S).length, 2, 'its ward turns it');
});

test('DRAGON3 host: THE BAR - its name, health and mode; MOVE when the blow it winds up holds my feet, none when it does not (mutants: MOVE never)', () => {
  const S = screen(TT.landAt + 1000, [10, 10]);
  S.st({ h: 400 });
  S.word({ k: 'atk', i: 1, a: DRAGON_BLOW.breath.id, at: S.t + 1500, wu: 1800, s: [['c', 10, 0, 0, 20, 70]] });
  S.run(100);
  const b = S.host.bar();
  assert.deepEqual([b.name, b.hp, b.max, b.grounded, b.atk.key, b.atk.aimed], ['The Dwarven Dragon', 400, 1000, false, 'breath', true]);
  S.me = [60, 60];
  S.run(50);
  assert.equal(S.host.bar().atk.aimed, false);
});

test('DRAGON3 host: THE FALL - it falls where it was, said once; it lies deactivated (its idle frame, its remains\' wash) until DRAGON_REMAINS_MS from its fall, then it is gone; it is no enemy near once slain (mutants: the remains never; it lies for ever)', async () => {
  const made = [];
  const renderer = { createBillboardBatch: (a, rkey, size) => { const b = { a, rkey, size }; made.push(b); return b; }, destroyBillboardBatch: () => {}, textures: new Set() };
  const tex = { getFrameCount: () => 8, getSize: () => ({ width: 471, height: 262 }), getScale: () => ({ width: 0, height: 0 }) };
  const S = screen(TT.landAt + 60_000, [0, -40], { renderer, getTexture: async () => tex, uploadRecordFrame: () => {} });
  await new Promise((done) => setImmediate(done));   // its sprite's texture come
  S.st();
  S.run(200);
  assert.ok(made.length === 1 && made[0].a === 1800, 'its body drawn from its own pictures');
  assert.equal(S.host.near(), true, 'in its fight, near');
  const at = planAt([orbitLeg(TT.landAt, 0, 0, 55, 0, 1, 30)], S.t);
  S.word({ k: 'mv', legs: [fallLeg(at, S.t)] });
  S.word({ k: 'fell', at: S.t, top: ['Ama'], n: 2 });
  S.run(4000);
  assert.equal(S.mid.filter((x) => /falls from the sky/.test(x)).length, 1);
  assert.equal(S.host._live().act, 'remains');
  assert.equal(made[0]?.tint ?? null, REMAINS_WASH);
  assert.equal(S.host.near(), false);
  assert.ok(Math.abs(made[0].size.h) > 0 && DRAGON_SCALE > 1);
  S.t += DRAGON_REMAINS_MS;
  S.run(100);
  assert.equal(S.host._live().mine, false, 'gone once its remains have lain their time');
});

test('DRAGON3 world: the host\'s wiring - its sites, link and host made online; the session\'s word to its link, my fall by its count; its body in the shots\' and missiles\' fields beside the serpent\'s; a grounded swing after the duel\'s; an enemy near; its flats and its telegraphs on the street; its frame and its away (mutants: each wire cut)', () => {
  const w = hostText('src/scenes/world.js');
  for (const wired of [
    "online.onDragon = (w) => { if (w?.k === 'bd') bossCountFell(!!dragonSky?.near()); else dragonSky?.word(w); };",   // PIN MOVED (AUDIT DRAGON): the sky's own word door
    'boxMarks: () => dragonBoxesWith(dragonSky, serpentHost?.handBoxes?.() ?? null),',
    'castAtBox: (sp, q, caster) => dragonSky?.cast(sp, q, caster) ?? serpentSpell.cast(sp, q, caster),',
    'boxTargets: dragonBoxesWith(dragonSky, serpentHost?.handBoxes?.() ?? null),',
    'onPlayerArrowHitBox: (m, t) => dragonSky?.arrow(m, t) || serpentArrowOn(m, t),',
    '|| !!dragonSky?.swing(weaponRig.playerWeapon, cam.pos, lookFwd, makeInView(proj, view, multiply))) {',
    'const navalHostileNear = () => !!naval?.hostileNear() || !!dragonSky?.near();',
    "if (dragonSky && _mode() === 'exterior') livePersonBatches.push(...dragonSky.batches());",
    "if (dragonSky && _mode() === 'exterior') { try { dragonSky.drawMarks(); }",
    'dragonSky?.onlineFrame();', 'dragonSky?.away(!onlineOn);',   // PIN MOVED (AUDIT DRAGON): its frame and away the sky's (createDragonSky)
    "dragonSky = params.has('online') ? createDragonSky({", 'bayScan: () => { warmGateScan(); return _gateScan; }, theatres: () => theatreGates,',
    "street: () => (modes?.mode ?? 'exterior') === 'exterior' && playerSpawned, barBlocked: () => _serpentBarUp, barHidden: () => gamePaused() || !!townTalk.hudHidden, drawBar: drawGateBossBar,",
  ]) assert.ok(w.includes(wired), wired);
  const o = readFileSync('src/net/online.js', 'utf8');
  assert.match(o, /if \(primary\) this\.dragonOk = relaySupportsDragon\(relayV\);/);
  assert.match(o, /if \(r && \(isSocialRoom\(room\) \? r\.k === 'rcpt' : isCellRoom\(room\) \|\| r\.k === 'omen'\)\) this\._deliver\('dragon', \(\) => this\.onDragon\?\.\(r, room\)\);/);   // PIN MOVED (AUDIT DRAGON-HIDDEN B1): and an omen from any room
  assert.match(o, /const w = validDragonIn\(word\);\n\s+const ask = w\?\.k === 'ask';\n\s+if \(!w \|\| \(ask \? [^\n]+ : !this\.dragonReady\(cell\)\)\) return false;/);   // PIN MOVED (AUDIT DRAGON-HIDDEN B1): an ask down my primary
});

test('AUDIT DRAGON the sky made whole (HOST-SPLIT): its online frame ticks its claims, runs its fight on the street alone (leaving it off the street), draws its bar unless another boss\'s is up, and its away puts the bar away; bootWorld keeps none of its state (mutants: the bar over the serpent\'s; the bar left up; the fight off the street)', async () => {
  const { createDragonSky } = await import('../../src/scenes/dragonHost.js');
  const drawn = [];
  let street = true, blocked = false, fight = true;
  const calls = { tick: 0, frame: 0, leave: [] };
  const fake = { tick: () => calls.tick++, frame: () => { calls.frame++; return fight; }, leave: (o) => calls.leave.push(!!o), bar: () => ({ name: 'D', title: '', hp: 0.5, max: 1, ph: 1, md: 0, fell: null, gone: null, atk: null, n: 1, mu: 0, lv: 0, t: 0 }) };
  const sky = createDragonSky({ bayScan: () => null, theatres: () => [], street: () => street, barBlocked: () => blocked, drawBar: (m) => drawn.push(m ? 'bar' : null), now: () => 0, makeHost: () => fake });
  sky.onlineFrame();
  assert.deepEqual([calls.tick, calls.frame, drawn], [1, 1, ['bar']], 'on the street: ticked, fought, its bar drawn');
  blocked = true; sky.onlineFrame();
  assert.deepEqual(drawn, ['bar'], 'the serpent\'s bar up: none drawn over it');
  blocked = false; street = false; sky.onlineFrame();
  assert.deepEqual([calls.frame, calls.leave, drawn.at(-1)], [2, [false], null], 'off the street: left, its bar put away');
  street = true; sky.onlineFrame(); sky.away(true);
  assert.deepEqual([drawn.at(-1), calls.leave.at(-1)], [null, true], 'away: the bar put away, offline its fight forgotten');
  const w = hostText('src/scenes/world.js');
  assert.ok(!w.includes('_dragonBarUp') && !w.includes('const dragonFrame') && !w.includes('createDragonLink('), 'the world host holds none of its state');
});
