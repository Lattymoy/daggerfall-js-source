// FIELD BUGS 2026-10-18d TWIN-REKINDLE (bible/01-Overview/bugs/Field-Bugs-2026-10-18d.md; Boar, #bug-reports, "Big
// bugs of the spires", item 6: "I killed fire daedra and he ressurected without timer ... Then I killed Ice and was
// prompted to kill Fire within 15 seconds. Problem is, he was intangible. Spells and melee just passed through him, however
// he still could use skills and do damage, his lifebar was about 15%"). The director stands a Sapper for the Court's first
// lord standing (net/eliteGates/egBrain.js, the escort's `s.lordGoal = L0.i`) and it walks to that lord's BODY; a Twin lies a
// body after its first fall (its pair's window), so the Sapper walked on and fed the corpse: 2% of its health a feeding
// and its fall's flag still on. On the relay a lord with health is a lord (egLordsOf), so it walked and threw its blows; on
// every screen a lord with its fall's flag lies fallen and no blow of mine meets it (scenes/eliteGates/egFight.js, the body
// my blows meet is never one `fellAt`), while the lord's bar showed its health (ui/eliteGates/egSpireHud.js egLordBars); and
// the pair's raise, which lifts only a mate at nought, never came. Felling Isk then opened the window over the fed Vael, and
// the fight could not be won. Each pin EXECUTES the director (egBreachNew, egEnter, egStep, egBlow - the real escort's
// Sapper, the real pair law) on the current spec law's Twin Lords (seed 1, hall 35), and folds every frame it says through
// the wire's validator into the client's own state (net/eliteGates/egLink.js foldEg) as a screen does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow } from '../../../src/net/eliteGates/egBrain.js';
import { egLordsAwake, EG_TWIN_ONE_MS } from '../../../src/net/eliteGates/egLords.js';
import { EG_FL, EG_ROLE, EG_GONE, egHas } from '../../../src/net/eliteGates/egBodies.js';
import { HIT_KINDS, SAP_HEAL } from '../../../src/net/gate/gateBrain.js';
import { validEgOut } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { egLordBars } from '../../../src/ui/eliteGates/egSpireHud.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };

/**
 * A company of one at the Twin Lords' Court (seed 1, hall 35), woken in its ring: `step` beats the director (every frame kept,
 * each folded into the client's state `E()`), `at` stands the member on a body's floor, `strike` lands a blow on a body from
 * beside it, `twins` Vael (part 0) and Isk (part 1).
 */
function twinsCourt() {
  const seed = 1, h = 35, rng = seeded(seed), co = [['acct-0', 'Boar', 1]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Boar', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  B.pr = '';
  let now = T0 + EG_SEALED_MS + 100;
  egEnter(B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(seed, h, 0);
  assert.equal(spec.lord, 'twins', 'hall 35 of seed 1 is the Twin Lords\' Court');
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 30 * 60_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  let pos = { sub: 'acct-0', sx: spec.x0 + spec.arrive.x, z: spec.arrive.z };
  let E = EG_STATE_EMPTY;
  const frames = [];
  const fold = (o) => { for (const f of o) { frames.push({ ...f, now }); const w = validEgOut({ t: 'eg', ...f }); if (w) E = foldEg(E, w, now); } return o; };
  const step = (ms = 250) => { now += ms; return fold(egStep(B, now, [{ ...pos, dead: false, at: now }], rng)); };
  const at = (b, dx = 1.5) => { pos = { sub: 'acct-0', sx: spec.x0 + b.x + dx, z: b.z, y: b.y }; };
  let q = 1;
  const strike = (b, d) => { at(b); now += 50; return fold(egBlow(B, 'acct-0', { k: 'hit', i: b.i, q: q++, d, r: HIT_KINDS.Melee }, { sx: spec.x0 + b.x + 1.5, y: b.y, z: b.z }, now)); };
  for (let k = 0; k < 120 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', 'the hall woke');
  pos = { sub: 'acct-0', sx: spec.x0 + spec.ring.x, z: spec.ring.z };
  for (let k = 0; k < 40 && !egLordsAwake(B.F); k++) step();
  assert.ok(egLordsAwake(B.F), 'the Twins woke');
  const [vael, isk] = B.F.bodies.filter((b) => b.role === EG_ROLE.lord);
  assert.deepEqual([vael.pt, isk.pt, B.F.mem.pair.ms], [0, 1, EG_TWIN_ONE_MS], 'Vael and Isk, under one court\'s window');
  return { B, frames, step, at, strike, vael, isk, E: () => E, now: () => now };
}
/** Beat until the director stands a Sapper for lord `L` (the escort's, every EG_ESCORT_EVERY_MS); answers it. */
function sapperFor(C, L) {
  for (let k = 0; k < 4 * 60 && !C.B.F.bodies.some((b) => b.lordGoal === L.i); k++) C.step();
  const s = C.B.F.bodies.find((b) => b.lordGoal === L.i);
  assert.ok(s, 'a Sapper walks to its lord');
  return s;
}
/** The client's body `i` and whether my blows meet it (egFight.js drawBody's own test: standing, unfallen, no friend, not
 *  vanished). */
function onScreen(E, i) {
  const b = E.fight.bodies.find((x) => x.i === i);
  return { b, meets: !!b && !b.fellAt && b.hp > 0 && (b.fl & (EG_FL.friend | EG_FL.hidden)) === 0 };
}

test('FB1018D TWIN-REKINDLE: a Sapper stood for a Twin before its fall burns out against the body - the fallen Twin is never fed, throws no blow, shows no bar and lies until its window raises it at half, when every screen\'s blows meet it again; Isk\'s fall then opens a window over a Vael that can be struck (mutants: a fallen lord fed; a corpse at nought fed)', () => {
  const C = twinsCourt(), { vael, isk } = C;
  C.at(isk, 20);
  const sap = sapperFor(C, vael);
  const fedBefore = C.B.F.mem.fed ?? 0;
  // Vael felled where he stands while his Sapper walks
  vael.ward = 0; vael.fl &= ~EG_FL.ward; vael.hp = 1;
  C.strike(vael, 500);
  const fellAt = C.now();
  assert.ok(!(vael.hp > 0) && egHas(vael, EG_FL.fell), 'Vael fell');
  assert.ok(C.frames.some((f) => f.k === 'esay' && f.w === 'twinfell'), 'the window opened');
  // the window's length runs out with the Sapper's walk inside it
  const gone = [], blows = [];
  let raisedAt = 0, lay = 0;
  while (!raisedAt && C.now() - fellAt < EG_TWIN_ONE_MS + 2000) {
    C.at(isk, 20);
    for (const f of C.step()) {
      if (f.k === 'edie' && f.is.includes(sap.i)) gone.push(f.w);
      if (f.k === 'eb' && f.o === vael.i) blows.push(f.nm);
      if (f.k === 'esay' && f.w === 'twinraised') raisedAt = C.now();
    }
    if (!raisedAt && gone.length) {
      lay++;
      // while he lies: nought on the relay, his fall's flag on, no bar on the screen and no blow of mine meets him
      assert.ok(!(vael.hp > 0) && egHas(vael, EG_FL.fell), `Vael still lies after his Sapper reached him (hp ${vael.hp})`);
      assert.deepEqual(egLordBars(C.E()).map((b) => b.name), ['Isk of the Frost Clan'], 'the bar is Isk\'s alone');
      assert.equal(onScreen(C.E(), vael.i).meets, false);
    }
  }
  assert.ok(lay > 4 * 4, `he lay on after his Sapper reached him (${lay} beats)`);
  assert.deepEqual(gone, [EG_GONE.crumbled], 'the Sapper burnt out against the body');
  assert.equal(C.B.F.mem.fed ?? 0, fedBefore, 'no feeding spent on a corpse');
  assert.ok(!C.frames.some((f) => f.k === 'esay' && f.w === 'sapperfed' && f.now >= fellAt), 'no "A Sapper reaches its lord and heals it"');
  assert.deepEqual(blows, [], 'a fallen Twin throws no blow');
  // the pair's law, whole: raised at half at the window's end, and every screen's blows meet it again
  assert.ok(raisedAt - fellAt > EG_TWIN_ONE_MS && raisedAt - fellAt <= EG_TWIN_ONE_MS + 250, `raised by the window (${raisedAt - fellAt} ms)`);
  assert.equal(vael.hp, Math.round(vael.max / 2), 'at half');
  assert.ok(!egHas(vael, EG_FL.fell), 'his fall\'s flag off');
  for (let k = 0; k < 4; k++) C.step();
  assert.equal(onScreen(C.E(), vael.i).meets, true, 'my blows meet the raised Twin');
  // Isk falls: the window opens over a Vael standing - and struck, he takes the blow
  isk.ward = 0; isk.fl &= ~EG_FL.ward; isk.hp = 1;
  C.strike(isk, 500);
  assert.ok(C.frames.some((f) => f.k === 'esay' && f.w === 'twinfell' && f.n === 'Isk of the Frost Clan'), 'Isk\'s fall opened the window');
  vael.ward = 0; vael.fl &= ~EG_FL.ward;
  const hp0 = vael.hp;
  C.strike(vael, 300);
  assert.ok(vael.hp < hp0, 'Vael takes the blow');
  assert.equal(onScreen(C.E(), vael.i).meets, true);
});

test('FB1018D TWIN-REKINDLE: a Sapper still heals a lord STANDING - the gate\'s 2% when it reaches him, its feeding counted and said, gone as fed (mutant: no lord fed)', () => {
  const C = twinsCourt(), { vael, isk } = C;
  vael.hp = vael.max * 0.8;
  C.at(isk, 20);
  const sap = sapperFor(C, vael);
  let w = null, hp0 = vael.hp, fed = false;
  for (let k = 0; k < 4 * 30 && w == null; k++) {
    hp0 = vael.hp;
    C.at(isk, 20);
    for (const f of C.step()) { if (f.k === 'edie' && f.is.includes(sap.i)) w = f.w; if (f.k === 'esay' && f.w === 'sapperfed') fed = true; }
  }
  assert.equal(w, EG_GONE.fed, 'gone into its lord');
  assert.ok(fed, 'said');
  assert.equal(C.B.F.mem.fed, 1, 'its feeding counted');
  assert.ok(Math.abs(vael.hp - Math.min(vael.max, hp0 + vael.max * SAP_HEAL)) < 1e-6, `healed the gate's ${SAP_HEAL * 100}% (${hp0} -> ${vael.hp})`);
});
