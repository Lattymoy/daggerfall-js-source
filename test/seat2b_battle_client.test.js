// SEAT2b part two (b) (2026-10-01, Mac: "Finish the seats"; "Let's pick up 482"): THE WORKS IN BATTLE ON THE CLIENT -
// the field's frame folded with its Gatehouse, Ram and Walls; the HUD's works line and the Throne's rule; a defender's
// wave the Walls' quicker; the session's work to strike (an attacker the Gatehouse, a defender the Ram), its point and
// its blow; the breach and a Ram's end said once; the host's swing at a work (bible/11-Multiplayer/Seats-Arc.md 6.2,
// 19; src/net/siegeLink.js, src/net/siegeSession.js, src/ui/siegeHud.js, src/scenes/world.js). `06-Systems/
// Online-Arc.md` SEAT2b part two (b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';
import { foldSiege, siegeWorksLine, siegeBarLines, siegeSelfLines, siegeHudModel, SIEGE_STATE_EMPTY } from '../src/net/siegeLink.js';
import { createSiegeSession, SIEGE_SESSION_TEXT } from '../src/net/siegeSession.js';
import { createSiegeHud } from '../src/ui/siegeHud.js';
import { siegeRoomKey, siegeNextWave, SIEGE_UNITS_PER_M } from '../src/net/siegeRef.js';

const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const T = 1_800_000_000_000;
const SH = { name: 'The Silver Hand', tag: 'SH' }, EO = { name: 'Ebon Oath', tag: 'EO' };
const F = { k: 'f', b: [[1, 0, 0], [1, 0, 0], [1, 0, 0], [2, 0, 0]], th: 0, s: T, e: T + 2_700_000, n: [2, 1, 0] };
const battle = { seat: 'Wayrest', kind: 'siege', tier: 'crown', attacker: EO, defender: SH };

test('SEAT2b part two (b) THE WORKS FOLDED AND SAID: the frame\'s Gatehouse, Ram and Walls kept (none: none); the works\' line - the gate\'s vitality or its breach, the Ram\'s and its charge, the camp behind it, the Walls; the Throne\'s rule names the gate and opens only on its breach (mutants: the fold; each word; the bar)', () => {
  let s = foldSiege(SIEGE_STATE_EMPTY, { ...F, g: [29995, 30000], r: [4480, 4500, 9, 1], w: 2 }, T);
  assert.deepEqual([s.gate, s.ram, s.walls], [[29995, 30000], [4480, 4500, 9, 1], 2]);
  assert.equal(siegeWorksLine(s), 'GATEHOUSE 29,995 / 30,000    RAM 4,480 / 4,500  9/10 s - 1 more in the camp    WALLS 2');
  assert.match(siegeBarLines(s, battle, T)[1], /THRONE 0% \(3 of 4 \+ the Gatehouse\)$/, 'three of four held, the gate standing: not OPEN');
  s = foldSiege(s, { ...F, g: [12000, 30000], r: [0, 0, 0, 1] }, T + 1000);
  assert.equal(siegeWorksLine(s), 'GATEHOUSE 12,000 / 30,000    RAM coming at the next wave - 1 more in the camp');
  s = foldSiege(s, { ...F, g: [0, 30000], r: [3000, 4500, 0, 0] }, T + 2000);
  assert.equal(siegeWorksLine(s), 'GATEHOUSE BREACHED', 'a breached gate: no Ram to speak of');
  assert.match(siegeBarLines(s, battle, T)[1], /THRONE OPEN 0% \(3 of 4 \+ the Gatehouse\)$/);
  s = foldSiege(s, F, T + 3000);
  assert.deepEqual([s.gate, s.ram, s.walls, siegeWorksLine(s)], [null, null, 0, '']);
  assert.match(siegeBarLines(s, battle, T)[1], /THRONE OPEN 0% \(3 of 4\)$/, 'no gate: the banners alone');
  assert.equal(siegeHudModel(foldSiege(s, { ...F, w: 1 }, T), battle, 'me', T).works, 'WALLS 1');
});

test('SEAT2b part two (b) A DEFENDER\'S WAVE AND THE HUD\'S LINE: a fallen defender waits the Walls\' quicker wave, an attacker the tier\'s; the HUD draws the works\' line only where there is one (mutants: the side\'s wave; the line shown; hidden)', () => {
  const s = foldSiege(foldSiege(SIEGE_STATE_EMPTY, { ...F, w: 3 }, T), { k: 'st', f: [['def-0001', 0, 300, 1, 2], ['att-0001', 0, 300, 1, 1]] }, T);
  const fell = { ...s, fellAt: { 'def-0001': T, 'att-0001': T } };
  const secs = (id) => Number(/next wave in (\d+) s/.exec(siegeSelfLines(fell, id, T, { tier: 'crown' })[1])[1]);
  assert.equal(secs('def-0001'), Math.ceil((siegeNextWave(T, 30000 - 9000) - T) / 1000));
  assert.equal(secs('att-0001'), Math.ceil((siegeNextWave(T, 30000) - T) / 1000));
  const hud = createSiegeHud(document);
  hud.update(siegeHudModel(foldSiege(SIEGE_STATE_EMPTY, { ...F, g: [100, 20000] }, T), battle, 'me', T));
  const works = byClass(hud.node, 'sg-works')[0];
  assert.deepEqual([works.textContent, works.style.display], ['GATEHOUSE 100 / 20,000', '']);
  hud.update(siegeHudModel(foldSiege(SIEGE_STATE_EMPTY, F, T), battle, 'me', T));
  assert.equal(works.style.display, 'none');
  hud.destroy();
});

test('SEAT2b part two (b) THE SESSION\'S WORK: an attacker strikes the standing Gatehouse, a defender the Ram before it - a spectator, a breached gate or no Ram nothing; the point is the Throne\'s off the field this game derived; the blow leaves only for the work this fighter may strike; the breach and a Ram\'s end said once (mutants: each side; the breach; the point; the blow\'s gate; the words)', async () => {
  const sent = [], said = [];
  const online = { id: 'me-00001', room: null, status: 'open', mintSiegePass: null, sendSiege: (f) => { sent.push(f); return true; } };
  let side = 'attack';
  const pass = async () => ({ ok: true, pass: 'v1.p.q', side, week: 20, window: Math.floor((T + 7_200_000) / 1000) });
  const M = SIEGE_UNITS_PER_M;
  const sf = [[0, 40], [40, 0], [-40, 0], [0, -20], [0, -40], [0, 80], [0, -60]].map(([x, z]) => [x * M, z * M]);
  const make = async (sd) => {
    side = sd;
    const ses = createSiegeSession({ online, pass, nowMs: () => T, say: (t) => said.push(t), relayOk: () => true });
    ses.enter({ key: 5023, name: 'Wayrest' }, { kind: 'siege', tier: 'crown' }, sf);
    await Promise.resolve(); await Promise.resolve();
    return ses;
  };
  const att = await make('attack');
  const room = siegeRoomKey(5023, 20);
  assert.equal(att.workTarget(), null, 'nothing heard: no work');
  att.onSiege({ ...F, g: [30000, 30000], r: [4500, 4500, 0, 1] }, room);
  assert.equal(att.workTarget(), 'gh');
  assert.deepEqual(att.workPoint(), [0, -40 * M], 'the Throne\'s point - a crown\'s fifth');
  assert.equal(att.workBlow('gh', { w: 123, m: 9, d: 30, r: 0 }), true);
  assert.equal(att.workBlow('rm', { w: 123, m: 9, d: 30, r: 0 }), false, 'not its own Ram');
  assert.deepEqual(sent, [{ k: 'blow', to: 'gh', w: 123, m: 9, d: 30, r: 0 }]);
  att.onSiege({ ...F, g: [12000, 30000], r: [0, 0, 0, 1] }, room);
  assert.deepEqual(said.slice(-1), [SIEGE_SESSION_TEXT.ramDown]);
  att.onSiege({ ...F, g: [12000, 30000], r: [0, 0, 0, 1] }, room);
  assert.equal(said.filter((t) => t === SIEGE_SESSION_TEXT.ramDown).length, 1, 'said once');
  att.onSiege({ ...F, g: [0, 30000] }, room);
  assert.deepEqual(said.slice(-1), [SIEGE_SESSION_TEXT.breach('Wayrest')]);
  assert.equal(att.workTarget(), null, 'breached: nothing to batter');
  const def = await make('defend');
  def.onSiege({ ...F, g: [30000, 30000], r: [4500, 4500, 0, 1] }, room);
  assert.equal(def.workTarget(), 'rm');
  def.onSiege({ ...F, g: [30000, 30000], r: [0, 0, 0, 1] }, room);
  assert.equal(def.workTarget(), null, 'no Ram standing');
  const eye = await make('watch');
  eye.onSiege({ ...F, g: [30000, 30000], r: [4500, 4500, 0, 1] }, room);
  assert.deepEqual([eye.workTarget(), eye.workBlow('gh', { w: 1, m: 0, d: 1, r: 0 })], [null, false]);
  assert.equal(SIEGE_SESSION_TEXT.breach('Wayrest'), 'The Gatehouse of Wayrest is breached.');
});

test('SEAT2b part two (b) THE HOST\'S SWING AT A WORK: a swing that finds no foe falls to the work in reach - the Gatehouse\'s or the Ram\'s body about the Throne\'s point - rolled as a blow on a foe, sent as the work\'s (mutants: the fall-through; the reach; the roll; the send)', () => {
  assert.match(W, /if \(!foes\.length\) return \(battle === siegeSession && siegeWorkHit\(\)\) \|\| wildMeleeHit\(eye, inViewFn\);/);   // WILD1: past the work, a fair player of the open zone
  assert.match(W, /if \(!best\) return battle === siegeSession && siegeWorkHit\(\);/);
  assert.match(W, /const siegeWorkHit = \(\) => \{\n\s+const to = siegeSession\?\.workTarget\?\.\(\) \?\? null;\n\s+const at = to \? siegeSession\.workPoint\(\) : null;/);
  assert.match(W, /if \(Math\.hypot\(me\[0\] - at\[0\], me\[2\] - at\[1\]\) \/ SIEGE_UNITS_PER_M > SIEGE_REACH\.melee \+ size\) return false;/);
  assert.match(W, /const size = to === SIEGE_WORK_IDS\.gate \? SIEGE_GATEHOUSE\.sizeM : SIEGE_RAM\.sizeM;/);
  assert.match(W, /siegeSession\.workBlow\(to, \{ w: weapon \? weapon\.templateIndex : -1, m: held\?\.material \?\? 0, d: r\.dmg, r: siegeBlowKind\('melee'\) \}\);/);
});
