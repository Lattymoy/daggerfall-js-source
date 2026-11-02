// FIELD BUGS 2026-10-17e - ORRERY-SIGHT (bible/01-Overview/bugs/Field-Bugs-2026-10-17e.md; Mac, 2026-10-17: "The Elite Breach
// is still broken", over #general - TheHalfinStream: "so fun doing puzzles when you can't see", an Athenaeum's Orrery at
// "Stones true: 0 of 6 - fray 25"): AN ATHENAEUM'S ORRERY READ ON THE SCREEN. ORRERY-HEIGHT put the handles in reach and the
// turns landed (the fray counted 25 of them), but the Spire drew a gold disc a stone and said nothing else - no stone's name,
// no hour, no riddle - so the true hours could not be known and the lock could only be guessed at. Pinned here:
//   THE DRAW - the client's Orrery (systems/eliteGates/spireOrrery.js spireOrreryOf) is the relay's own (net/eliteGates/egBrain.js,
//     the Athenaeum's stand) - its gearing, start, true hours and riddles - with The Fraying in force or not;
//   THE REACH - the room takes a turn from within EG_STONE_REACH_M of the stone and not past it, and the client sends from
//     within and says "Stand closer to the stone." from past it (it sent, and the turn was dropped without a word);
//   THE SCREEN - the HUD's riddles (ui/eliteGates/egSpireHud.js), the words over each stone (scenes/eliteGates/egFight.js - its name
//     and its hour, as the room last said them, a turn moving them) and the handle's plaque (scenes/eliteGates/egSpan.js).
// Every fixture is the producers' own: the halls from the law at the build's law (egHallOf, egCirclePlan), the breach from
// the director (egBreachNew, egEnter, egStep, egWord), its words through the wire (validEgOut) and the fold (foldEg).
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCirclePlan, egFirstHallOf, egCircleOfHall, EG_SEALED_MS, EG_DECREE_BY_KEY } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egWord, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egFightState, EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { EG_OBJ } from '../../../src/net/eliteGates/egLords.js';
import { validEgOut } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { sdHourShown, SD_FRAY_MAX } from '../../../src/net/superDungeon/sdBrain.js';
import { spireOrreryOf, spireStoneWords, spireRiddleLines, EG_STONE_REACH_M } from '../../../src/systems/eliteGates/spireOrrery.js';
import { registerSpireObjs } from '../../../src/systems/eliteGates/spireKit.js';
import { egSpireHudModel, egSigilHtml } from '../../../src/ui/eliteGates/egSpireHud.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { createEgSpan } from '../../../src/scenes/eliteGates/egSpan.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { SD_HALL_TEXT } from '../../../src/scenes/superDungeon/sdHall.js';
import { egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { lookAt, perspective, mirrorProjectionX, UP_Y } from '../../../src/world/mat4.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };

/** The first `n` Athenaeums the build's law lays (seeds 1-60, circles 2-24): `{ seed, h }` each. */
function athenaeums(n) {
  const out = [];
  for (let seed = 1; seed <= 60 && out.length < n; seed++) for (let c = 2; c <= 24 && out.length < n; c++) {
    const k = egCirclePlan(seed, c).findIndex((p) => p.kind === 'athenaeum');
    if (k >= 0) out.push({ seed, h: egFirstHallOf(c) + k });
  }
  assert.equal(out.length, n, 'enough Athenaeums laid');
  return out;
}
/** A company of two on breach `seed` woken in hall `h` (its decrees `dc`), each on the arrival plate: the breach, the hall,
 *  a beat of the director, the folded state a member's screen holds. */
function woken(seed, h, dc = []) {
  const rng = seeded(seed);
  const co = [['acct-0', 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.pr = ''; B.dc = dc;
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const beat = () => { now += 250; return egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); };
  for (let k = 0; k < 400 && B.sg !== 'trial'; k++) beat();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  assert.equal(spec.kind, 'athenaeum');
  const fold = () => { const { k: _k, ...st } = egStateOf(B, now); return foldEg(foldEg(EG_STATE_EMPTY, wire({ k: 'st', ...st }), now), wire(egFightState(B.F, now)), now); };
  return { B, spec, rng, now: () => now, tick: (ms) => (now += ms), fold };
}
const drawOf = (o) => ({ order: [...o.order], gear: o.gear.map((g) => [...g]), start: [...o.start], truth: [...o.truth], riddles: o.riddles.map((r) => ({ ...r })) });

test('ORRERY-SIGHT (FIELD BUGS 2026-10-17e) THE DRAW: the client\'s Orrery of an Athenaeum is the relay\'s own - its gearing, its start, its true hours and its six riddles, hall for hall - and The Fraying in force changes the relay\'s fray, never the draw (mutants: the slot\'s salt; the Spire\'s turns range left out)', () => {
  for (const { seed, h } of athenaeums(6)) {
    const { B, spec } = woken(seed, h);
    assert.ok(B.F.orrery, `seed ${seed} hall ${h}: the relay drew its Orrery`);
    assert.deepEqual(drawOf(spireOrreryOf(seed, spec)), drawOf(B.F.orrery), `seed ${seed} hall ${h}: the client draws the relay's`);
    assert.equal(spireRiddleLines(spireOrreryOf(seed, spec)).length, 6);
  }
  // The Fraying in force: the relay's fray its own, the draw the same
  const [{ seed, h }] = athenaeums(1);
  const F = woken(seed, h, [[EG_DECREE_BY_KEY.fraying.id, 1]]);
  assert.ok(F.B.F.orrery.fray < SD_FRAY_MAX, `The Fraying shortens the relay's fray (${F.B.F.orrery.fray})`);
  assert.deepEqual(drawOf(spireOrreryOf(seed, F.spec)), drawOf(F.B.F.orrery), 'the draw the relay\'s under The Fraying');
  // and only an Athenaeum has one
  assert.equal(spireOrreryOf(seed, egHallOf(seed, egFirstHallOf(2), 0)), null);
});

test('ORRERY-SIGHT (FIELD BUGS 2026-10-17e) THE REACH: the room turns a stone for a member within EG_STONE_REACH_M of it in plan and drops the turn past it; the client sends from within and says "Stand closer to the stone." from past it, sending nothing (mutants: the client\'s reach longer than the room\'s; shorter)', () => {
  const [{ seed, h }] = athenaeums(1);
  const W = woken(seed, h);
  const q = W.spec.spots.stone[2];
  const pz = (d) => { W.tick(1000); return egWord(W.B, 'acct-0', { k: 'pz', i: 2, a: 1 }, { sx: W.spec.x0 + q.x + d, z: q.z }, W.now(), W.rng); };
  assert.equal(pz(EG_STONE_REACH_M + 0.05).length, 0, 'past the reach: the turn dropped');
  assert.equal(W.B.F.turns, 0);
  assert.equal(pz(EG_STONE_REACH_M - 0.05).filter((f) => f.k === 'pz').length, 1, 'within it: the turn taken');
  assert.equal(W.B.F.turns, 1);
  // the client, from either side of the same line
  const sent = [], said = [];
  const E = W.fold();
  const player = { pos: [0, 0, 0], height: 1.8, grounded: true, collider: { move: () => {} } };
  const modes = { mode: 'dungeon', egHallBreach: () => W.B.b, egHallCircle: () => 1, egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, sendEg: (k, f = {}) => { sent.push({ k, ...f }); return true; } };
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => 'acct-0', guest: () => false, keys: async () => ({ ok: false }) }, now: () => W.now(), entity, player, cam: { pos: [0, 0, 0] },
    say: (t) => said.push(t), mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [] });
  client.word(wire(egStateOf(W.B, W.now())));
  assert.equal(E.h, h);
  const y = Number.isFinite(q.y) ? q.y / 100 : 0;
  player.pos = egToDungeon(W.spec, q.x + EG_STONE_REACH_M + 0.05, y, q.z);
  assert.equal(client.act(`egstone:${h}:2:f`), true);
  assert.deepEqual(sent, [], 'from past the reach nothing is sent');
  assert.equal(said.at(-1), SD_HALL_TEXT.closer, 'and the member is told');
  player.pos = egToDungeon(W.spec, q.x - EG_STONE_REACH_M + 0.05, y, q.z);
  assert.equal(client.act(`egstone:${h}:2:b`), true);
  assert.deepEqual(sent, [{ k: 'pz', i: 2, a: -1 }], 'from within it the turn is sent');
});

test('ORRERY-SIGHT (FIELD BUGS 2026-10-17e) THE SCREEN: in an Athenaeum\'s trial the HUD lists its six riddles under the objective; over each stone stand its name and the hour its hand shows, as the room last said them - a turn moves them; the handle\'s plaque names the stone and its hour (mutants: the riddles unread; every label one stone\'s hour; the plaque\'s hour unread)', () => {
  const [{ seed, h }] = athenaeums(1);
  const W = woken(seed, h);
  const o = W.B.F.orrery;
  let E = W.fold();
  // THE HUD: the riddles, a line each, the objective and its count beside them as before
  const hud = egSpireHudModel(E, 'acct-0', W.now());
  assert.equal(hud.objective, 'Turn the Orrery true.');
  assert.match(hud.progress, /^Stones true: \d of 6 - fray 0$/);
  assert.deepEqual(hud.riddles.split('\n'), o.riddles.map((r) => r.text), 'the six riddles, the relay\'s');
  assert.equal(egSpireHudModel({ ...E, sg: 'rest' }, 'acct-0', W.now()).riddles, '', 'outside the trial, none');
  // THE WORDS OVER EACH STONE: the camera at the court's middle, turned to each stone in turn
  const stones = E.fight.bodies.filter((b) => b.role === EG_ROLE.obj && b.k === EG_OBJ.stone);
  assert.equal(stones.length, 6, 'six stones in the room\'s word');
  const sight = (st) => {
    const out = {};
    const fight = createEgFight({ link: { state: () => E, now: () => W.now() }, now: () => W.now(), player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0', strike: () => {},
      feet: () => egToDungeon(W.spec, W.spec.fight.x, 0, W.spec.fight.z), peerAt: () => null });
    fight.frame();
    for (const [j, q] of W.spec.spots.stone.entries()) {
      const y = Number.isFinite(q.y) ? q.y / 100 : 0, at = egToDungeon(W.spec, q.x, y, q.z), eye = egToDungeon(W.spec, W.spec.fight.x, y + 1.6, W.spec.fight.z);
      fight.drawPass(mirrorProjectionX(perspective(1.2, 16 / 9, 0.1, 500)), lookAt(eye, at, UP_Y), eye, 1);
      const b = stones.find((x) => x.pt === j), sg = fight.sigils().find((x) => x.key === `orr${b.i}`);
      assert.ok(sg && sg.marks[0].sigil === 'stone', `stone ${j}: words over it (${JSON.stringify(fight.sigils())})`);
      out[j] = sg.marks[0].text;
    }
    fight.leave?.();
    assert.deepEqual(out, Object.fromEntries(st.map((hr, j) => [j, spireStoneWords(j, hr)])), 'each stone its own name and hour');
    return out;
  };
  const before = sight(o.start);
  assert.equal(before[0], `Daggerfall - ${sdHourShown(o.start[0])}`);
  // a turn: the room's word moves the hours over every stone it geared
  const turn = egWord(W.B, 'acct-0', { k: 'pz', i: 4, a: 1 }, { sx: W.spec.x0 + W.spec.spots.stone[4].x, z: W.spec.spots.stone[4].z }, W.now(), W.rng).find((f) => f.k === 'pz');
  assert.ok(turn, 'the turn taken');
  E = foldEg(E, wire(turn), W.now());
  assert.deepEqual(E.fight.pg.st, turn.st);
  const after = sight(turn.st);
  assert.notEqual(after[4], before[4], 'the turned stone\'s hour moved over it');
  assert.equal(egSigilHtml({ sigil: 'stone', text: 'The Underking - <12>' }), '<span class="eg-sig eg-sig-stone"><b>The Underking - &#60;12&#62;</b></span>', 'its words, escaped');
  // THE HANDLE'S PLAQUE: the stone's name and sign, the hour the room said, the turn
  const span = createEgSpan({ seed, c: egCircleOfHall(h) });
  registerSpireObjs(() => ({ h, objs: [], orr: turn.st }));
  try {
    for (const j of [0, 4, 5]) {
      const p = span.hoverName(`egstone:${h}:${j}:f`);
      assert.deepEqual(p.subs, [SD_HALL_TEXT.hour(turn.st[j]), 'Turn it forward an hour'], `stone ${j}: its hour and the turn`);
    }
    assert.equal(span.hoverName(`egstone:${h}:4:b`).title, 'The Underking - the crown of bone');
  } finally { registerSpireObjs(null); }
  // no word from the room yet: the plaque names the stone and the turn alone
  assert.deepEqual(span.hoverName(`egstone:${h}:1:b`).subs, ['Turn it back an hour']);
});
