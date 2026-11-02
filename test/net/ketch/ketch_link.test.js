// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 10): WHAT THE PAGE HOLDS OF ITS SHIP - a whole voyage's
// frames (the director's own, through the wire's projection) folded by the link: its state matching the room's at the
// end, every turn said once, MY PLACE IN THE BRIDGE'S FIGHT (counted in only by the room's answer), my `in` due and
// retried, a refusal kept, the whole bridge's blows owed and paid, who carries; nothing before a whole state.
// tools/mutants/ketch_link.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKetchLink, foldKetch, KT_EMPTY, KT_LINK_TEXT, KT_IN_RETRY_MS, ktWholeBridge, ktBodyAt } from '../../../src/net/ketch/ketchLink.js';
import { KT_STAGE } from '../../../src/net/ketch/ketchLaw.js';
import { KT_WORDS } from '../../../src/systems/ketch/ketchWords.js';
import { validKetchOut } from '../../../src/net/wire.js';
import { sailWhole, T0 } from './ketchSim.mjs';

const ME = 'mem0';
/** The page of `me`: every frame of the voyage it would hear (its own `to` frames and everyone's), through the wire. */
function hear(frames, me = ME, upTo = Infinity) {
  let clock = T0;
  const said = [];
  const link = createKetchLink({ now: () => clock, say: (t) => said.push(t), me: () => me });
  for (const f of frames) {
    if (f.now > upTo) break;
    if (f.to != null && f.to !== me) continue;
    const { now, to: _to, ...x } = f;
    clock = now;
    link.word(validKetchOut(x));
  }
  return { link, said, clock: () => clock };
}
const whole = sailWhole(4);

test('KETCH THE LINK FOLDS A WHOLE VOYAGE: at its end the page holds what the room holds - the stage (the cabin), the crew, the cells, the Warden\'s fight fallen with its top and count, every construct down (mutants: a stage word unfolded; the fall unfolded; a body\'s fall unfolded)', () => {
  const { V } = whole, { link } = hear(whole.frames);
  const s = link.state();
  assert.equal(s.n, V.n);
  assert.equal(s.sg, KT_STAGE.vault);
  assert.deepEqual(s.crew.map((c) => c[0]), V.crew);
  assert.deepEqual(s.fell, { at: V.fell.at, top: V.fell.top, n: V.fell.n });
  assert.ok(s.ws?.fell, 'the fight fallen');
  assert.ok(s.bodies.every((B) => !(B.h > 0)), 'nothing standing');
  assert.equal(s.cl.bk, V.cells.banked, 'the engine\'s cells');
  assert.deepEqual(s.cl.ca, [], 'nobody carries');
  assert.equal(s.br.by, V.bridge.by);
});

test('KETCH THE TURNS SAID ONCE EACH, as they happen: the three waves, the hatch and the Wardens, their waking, the hold and the engine\'s appetite, each cell set, the engine fed, the bridge reached by name, the Discord, a resonator true, the Last Note, the song, the forks, the stun, the fall (mutants: a wave said twice; the engine\'s appetite unsaid; the fall unsaid)', () => {
  const { said, link } = hear(whole.frames);
  const count = (t) => said.filter((x) => x === t).length;
  for (const f of whole.frames.filter((x) => x.k === 'wave')) { const { now: _n, ...x } = f; link.word(validKetchOut(x)); }   // heard again (a rejoin's replay): said once still
  for (const w of [1, 2, 3]) assert.equal(count(KT_LINK_TEXT.wave[w]), 1, `wave ${w}`);
  for (const t of [KT_WORDS.hatchOpen, KT_LINK_TEXT.wardens, KT_LINK_TEXT.woke, KT_WORDS.holdOpen, KT_LINK_TEXT.engine(whole.V.cells.need), KT_WORDS.engineFed, KT_LINK_TEXT.bridge(whole.V.bridge.by), KT_LINK_TEXT.discord, KT_LINK_TEXT.lastNote])
    assert.equal(count(t), 1, t);
  assert.equal(said.filter((x) => /sets a cell in the engine/.test(x)).length, whole.V.cells.need, 'each cell set');
  assert.deepEqual(said.filter((x) => /sets a cell in the engine/.test(x)).map((x) => Number(/\((\d+) of (\d+)\)/.exec(x)[1])), Array.from({ length: whole.V.cells.need }, (_, i) => i + 1), 'counted one to the last (AUDIT KETCH L3-3)');
  assert.ok(said.includes(KT_LINK_TEXT.retuned(0)), 'the last resonator');
  assert.ok(said.includes(KT_LINK_TEXT.song) && said.includes(KT_LINK_TEXT.stunned));
  assert.ok(said.some((x) => /breaks the last fork/.test(x)));
  assert.equal(count(KT_LINK_TEXT.fell(whole.V.fell.top)), 1);
  const w1 = whole.frames.find((f) => f.k === 'wave' && f.w === 1), early = hear(whole.frames, ME, w1.now);
  { const { now: _n, ...x } = w1; early.link.word(validKetchOut(x)); }
  assert.equal(early.said.filter((x) => x === KT_LINK_TEXT.wave[1]).length, 1, 'a wave heard twice while fresh: said once');
  assert.ok(said.indexOf(KT_LINK_TEXT.wave[1]) < said.indexOf(KT_WORDS.hatchOpen) && said.indexOf(KT_WORDS.engineFed) < said.indexOf(KT_LINK_TEXT.discord), 'in their order');
});

test('KETCH MY PLACE IN THE BRIDGE\'S FIGHT: my `in` due only at the bridge, again only after KT_IN_RETRY_MS unanswered; joined only when the room answers it with `me`; another\'s answer never mine; out at the fall (mutants: joined without the room\'s word; the `in` said every frame; still in after the fall)', () => {
  const wfAt = whole.frames.find((f) => f.k === 'wf').now;
  const before = hear(whole.frames, ME, wfAt - 1);
  const t = before.clock();
  assert.equal(before.link.state().sg, KT_STAGE.bridge);
  assert.equal(before.link.inDue(t), true);
  before.link.sentIn(t);
  assert.equal(before.link.inDue(t + KT_IN_RETRY_MS - 1), false, 'waiting on its answer');
  assert.equal(before.link.inDue(t + KT_IN_RETRY_MS), true, 'said again');
  assert.equal(before.link.joined(), false);
  const mid = hear(whole.frames, ME, wfAt);
  assert.equal(mid.link.joined(), true, 'the room\'s answer: in');
  const other = hear(whole.frames.map((f) => (f.to === ME ? { ...f, to: 'mem9' } : f)), ME, wfAt + 12_000);   // the room's whole states of the fight heard too - none says `me`
  assert.equal(other.link.joined(), false, 'another\'s answer is not mine');
  const end = hear(whole.frames);
  assert.equal(end.link.joined(), false, 'fallen: out');
  assert.equal(end.link.inDue(end.clock() + 60_000), false, 'nothing to join');
  const early = hear(whole.frames, ME, T0 + 1000);
  assert.equal(early.link.inDue(T0 + 1000), false, 'the Watch: no bridge');
});

test('KETCH A REFUSAL KEPT: an older game\'s `no` said and kept for good - no `in` again; the voyage gone said (mutants: the older game\'s refusal forgotten)', () => {
  const wfAt = whole.frames.find((f) => f.k === 'wf').now;
  const p = hear(whole.frames, ME, wfAt - 1);
  p.link.word({ k: 'no', m: 2 });
  assert.equal(p.said.at(-1), KT_LINK_TEXT.no[2]);
  assert.equal(p.link.inDue(p.clock() + 10 * KT_IN_RETRY_MS), false);
  p.link.word({ k: 'no', m: 0 });
  assert.equal(p.said.at(-1), KT_LINK_TEXT.no[0]);
});

test('KETCH THE WHOLE BRIDGE\'S BLOWS OWED: while I am in the fight its Discord and its Keel-Song are owed my verdict, each once, and paid away; never the blows of one body; a song broken known (mutants: a body\'s blow owed; a paid blow owed again)', () => {
  const firstDiscord = whole.frames.find((f) => f.k === 'bl' && ktWholeBridge(f.b));
  assert.ok(firstDiscord);
  const p = hear(whole.frames, ME, firstDiscord.now);
  const owed = p.link.owed();
  assert.ok(owed.length >= 1 && owed.every(ktWholeBridge));
  assert.equal(new Set(owed.map((b) => b.i)).size, owed.length, 'each once');
  p.link.paid(owed[0].i);
  assert.ok(!p.link.owed().some((b) => b.i === owed[0].i));
  const stun = whole.frames.find((f) => f.k === 'stun');
  const q = hear(whole.frames, ME, stun.now);
  const songs = whole.frames.filter((f) => f.k === 'fk' && f.now <= stun.now);
  assert.equal(q.link.songBroken(songs.at(-1).i), true);
});

test('KETCH WHO CARRIES, and a word before any whole state changes nothing; a body read on its walk; off the ship, all forgotten (mutants: a carrier unread; a voyage begun on a fragment)', () => {
  const pick = whole.frames.find((f) => f.k === 'cl' && f.ca.some((c) => c[0] === ME));
  const p = hear(whole.frames, ME, pick.now);
  assert.equal(p.link.carrying(), true);
  assert.ok(p.link.carriers().includes(ME));
  assert.equal(foldKetch(KT_EMPTY, validKetchOut({ k: 'wave', w: 1, at: T0 }), T0), KT_EMPTY);
  const st = validKetchOut({ k: 'st', n: 1, sg: 0, sga: T0, cr: [['mem0', 'P0']], bd: [[100, 0, 0, 0, 30, 0, 36, 36, 1, T0]], mv: [], bl: [], wv: 1, cl: { k: 'cl', cr: [1, 1, 1, 1, 1, 1], br: [1, 1], lo: [], ca: [], bk: 0, nd: 0, sk: [0, 0, 0, 0, 0, 0, 0] }, br: null, ws: null, fell: null });
  const dn = foldKetch(foldKetch(KT_EMPTY, st, T0), validKetchOut({ k: 'dn', o: 100, n: 'P0', at: T0 + 5 }), T0 + 5);
  assert.deepEqual([dn.bodies[0].h, dn.bodies[0].down], [0, T0 + 5], 'a body\'s fall folded on its own word, no health word with it');
  const B = { x: 0, z: 0, mv: { x: 0, z: 0, tx: 0, tz: 10, v: 2, at: T0 } };
  assert.deepEqual(ktBodyAt(B, T0 + 2000), [0, 4]);
  assert.deepEqual(ktBodyAt(B, T0 + 60_000), [0, 10], 'never past its goal');
  p.link.leave();
  assert.equal(p.link.state(), KT_EMPTY);
  assert.equal(p.link.carrying(), false);
});
