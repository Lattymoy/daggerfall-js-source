// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 12): THE KETCH ON THE SCREEN - the voyage's tracker and the
// Tonal Warden's bar read off the page's own fold of a whole voyage (net/ketch/ketchLink.js, the director's frames): each
// stage's line and what it asks, the cell in my hands, the crew, the clock burning to her weighing anchor and her turn
// west; the bar's phases, ward, resonators, the Keel-Song with its forks, the stun and the fall; the node updated, never
// rebuilt, hidden with the HUD. tools/mutants/ketch_hud.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ketchHudModel, wardenBarModel, drawKetchHud, destroyKetchHud, KT_HUD_TEXT, KT_BAR_TEXT, KT_HUD_LOW_MS, KT_HUD_PULSE_MS } from '../../src/ui/ketch/ketchHud.js';
import { createKetchLink } from '../../src/net/ketch/ketchLink.js';
import { KT_STAGE, ketchVoyageOf } from '../../src/net/ketch/ketchLaw.js';
import { KW_PHASE_AT } from '../../src/net/ketch/ketchWarden.js';
import { ketchStageName, ketchPhaseName } from '../../src/systems/ketch/ketchWords.js';
import { validKetchOut } from '../../src/net/wire.js';
import { sailWhole, T0 } from '../net/ketch/ketchSim.mjs';

const whole = sailWhole(4);
/** The page's state at the moment the first frame `pick` says (inclusive), and that moment. */
function at(pick) {
  let clock = T0;
  const link = createKetchLink({ now: () => clock, me: () => 'mem0' });
  for (const f of whole.frames) {
    if (f.to != null && f.to !== 'mem0') continue;
    const { now, to: _t, ...x } = f;
    clock = now;
    link.word(validKetchOut(x));
    if (pick(f)) break;
  }
  return { s: link.state(), now: clock, link };
}

test('KETCH THE TRACKER, STAGE BY STAGE: the Watch waiting then its wave and what stands; the Gallery\'s Wardens asleep; the engine\'s cells set of its need and the cradles charged; the Sailwalk; the bridge; the Discord\'s resonators; the Last Note\'s forks; the cabin open (mutants: the wave unsaid; the cells\' count the cradles\'; the forks uncounted)', () => {
  const first = at(() => true);
  assert.deepEqual([ketchHudModel(first.s, first.now).title, ketchHudModel(first.s, first.now).line], [ketchStageName(KT_STAGE.watch), KT_HUD_TEXT.waiting]);
  const w1 = at((f) => f.k === 'wave' && f.w === 1);
  const m1 = ketchHudModel(w1.s, w1.now);
  assert.equal(m1.line, KT_HUD_TEXT.wave(1));
  assert.equal(m1.sub, KT_HUD_TEXT.standing(6), 'a crew of four: six spheres');
  let wardens = 0;
  const g = at((f) => f.k === 'nb' && f.b[1] === 3 && ++wardens === 2);
  const mg = ketchHudModel(g.s, g.now);
  assert.deepEqual([mg.line, mg.sub, mg.tally], [KT_HUD_TEXT.gallery, KT_HUD_TEXT.wardens(2), KT_HUD_TEXT.asleep]);
  const e = at((f) => f.k === 'cl' && f.bk === 1);
  const me = ketchHudModel(e.s, e.now);
  assert.equal(me.line, KT_HUD_TEXT.engine);
  assert.equal(me.sub, KT_HUD_TEXT.cells(1, whole.V.cells.need));
  assert.match(me.tally, /^Cradles charged: \d of 6/);
  const sw = at((f) => f.k === 'sg' && f.sg === KT_STAGE.sailwalk);
  assert.equal(ketchHudModel(sw.s, sw.now).line, KT_HUD_TEXT.sailwalk);
  const br = at((f) => f.k === 'sg' && f.sg === KT_STAGE.bridge);
  assert.deepEqual([ketchHudModel(br.s, br.now).line, ketchHudModel(br.s, br.now).sub], [KT_HUD_TEXT.bridge, KT_HUD_TEXT.lineUp]);
  const d = at((f) => f.k === 'rs' && f.rs.filter((v) => v === 1).length === 1);
  assert.deepEqual([ketchHudModel(d.s, d.now).line, ketchHudModel(d.s, d.now).sub], [KT_HUD_TEXT.discord, KT_HUD_TEXT.resonators(1)]);
  const fk = at((f) => f.k === 'fk');
  const mf = ketchHudModel(fk.s, fk.now);
  assert.equal(mf.line, KT_HUD_TEXT.lastNote);
  assert.equal(mf.sub, KT_HUD_TEXT.forks(fk.s.ws.fk.c.length));
  const end = at(() => false);
  assert.deepEqual([ketchHudModel(end.s, end.now).line, ketchHudModel(end.s, end.now).sub], [KT_HUD_TEXT.vault, KT_HUD_TEXT.vaultSub]);
  assert.equal(ketchHudModel(null, T0), null, 'no ship heard: nothing');
});

test('KETCH THE TRACKER\'S FOOT: the cell in my hands and how to let it go; the crew of eight; the clock to her weighing anchor, burning red in its last five minutes, and to her turn west after, pulsing in the last minute (mutants: the carry line always; the clock never low)', () => {
  const s = at(() => true).s, v = ketchVoyageOf(s.n);
  const m = ketchHudModel(s, v.at + 3600_000, { carrying: true });
  assert.equal(m.carry, KT_HUD_TEXT.carry);
  assert.equal(ketchHudModel(s, v.at + 1).carry, '');
  assert.equal(m.crew, KT_HUD_TEXT.crew(4));
  assert.equal(KT_HUD_TEXT.crew(4), 'Crew: 4 of 8', 'the places taken, never "aboard" (AUDIT KETCH L3-8)');
  assert.match(m.clock, /^She weighs anchor in /);
  assert.equal(m.low, false);
  assert.equal(ketchHudModel(s, v.departAt - KT_HUD_LOW_MS + 1).low, true);
  const late = ketchHudModel(s, v.endAt - KT_HUD_PULSE_MS + 1);
  assert.match(late.clock, /^She leaves the sky in /, 'the voyage\'s end in its own words (AUDIT KETCH L3-9)');
  assert.deepEqual([late.low, late.pulse], [true, true]);
});

test('KETCH THE WARDEN\'S BAR: asleep, its turn counted; its phases\' marks at 65% and 35%, spent as they pass; warded out of tune with its resonators counted; the Keel-Song named with its forks standing and its seconds; reeling; felled and fading; nothing for a lost fight (mutants: the ward unsaid; the song uncounted; the marks moved)', () => {
  const wf = at((f) => f.k === 'ws' && f.me === 1);
  const b0 = wardenBarModel(wf.s.ws, wf.now);
  assert.equal(b0.name, KT_BAR_TEXT.name);
  assert.deepEqual(b0.marks, [...KW_PHASE_AT]);
  assert.match(b0.callout.text, /^It turns from the helm - \d+s$/);
  assert.equal(b0.warded, true);
  const d = at((f) => f.k === 'rs' && f.rs.every((v) => v === 0));
  const bd = wardenBarModel(d.s.ws, d.now + 3000);
  assert.deepEqual([bd.title, bd.wardedText, bd.host], [ketchPhaseName(2), KT_BAR_TEXT.warded, KT_BAR_TEXT.resonators(0)]);
  assert.deepEqual(bd.spent, [true, false]);
  const fk = at((f) => f.k === 'fk');
  const bs = wardenBarModel(fk.s.ws, fk.now + 10);
  assert.match(bs.callout.text, new RegExp(`^The Keel-Song - ${fk.s.ws.fk.c.length} of ${fk.s.ws.fk.c.length} forks - \\d+s$`));
  assert.equal(bs.hostNear, true);
  const st = at((f) => f.k === 'stun');
  const bt = wardenBarModel(st.s.ws, st.now + 10);
  assert.match(bt.callout.text, /^Reeling - \d+s$/);
  const end = at(() => false);
  const bf = wardenBarModel(end.s.ws, end.now);
  assert.deepEqual([bf.fallen, bf.frac, bf.callout], [true, 0, null]);
  assert.equal(wardenBarModel({ ...end.s.ws, fell: null, lost: end.now }, end.now), null);
  assert.equal(wardenBarModel(null, end.now), null);
});

test('KETCH THE TRACKER\'S NODE: made on the first word, updated never rebuilt, hidden with nothing to say or with the HUD (mutants: rebuilt each frame; shown with the HUD hidden)', () => {
  destroyKetchHud();
  let made = 0;
  const el = () => ({ className: '', style: {}, textContent: '', children: [], append(c) { this.children.push(c); }, remove() {} });
  const doc = { createElement: () => { made++; return el(); }, getElementById: () => null, head: el(), body: el() };
  const s = at(() => true);
  drawKetchHud(ketchHudModel(s.s, s.now), { doc });
  const once = made;
  assert.ok(once > 0);
  drawKetchHud(ketchHudModel(s.s, s.now + 1000), { doc });
  assert.equal(made, once, 'updated, never rebuilt');
  const node = doc.body.children[0];
  assert.equal(node.className, 'kt-hud');
  assert.equal(node.children[2].textContent, KT_HUD_TEXT.waiting);
  drawKetchHud(ketchHudModel(s.s, s.now), { doc, hidden: true });
  assert.equal(node.style.display, 'none');
  drawKetchHud(null, { doc });
  assert.equal(node.style.display, 'none');
  drawKetchHud(ketchHudModel(s.s, s.now), { doc });
  assert.equal(node.style.display, '');
  destroyKetchHud();
});

test('KETCH ONE END ON THE BAR: the fight\'s own west turning when it comes first, the voyage\'s end in its own words when that does - never two clocks named alike (AUDIT KETCH L3-9; mutants: the voyage\'s end unread)', () => {
  const ws = { fi: 1, m: 100, h: 50, op: 0, ph: 1, ends: 10 * 60_000, n: 2, bl: [] };
  const fight = wardenBarModel(ws, 7 * 60_000, 60 * 60_000);
  assert.match(fight.wrath, /^The Ketch turns west in /);
  const voyage = wardenBarModel(ws, 6 * 60_000, 8 * 60_000);
  assert.match(voyage.wrath, /^She leaves the sky in /);
  assert.equal(voyage.wrathNear, false);
  assert.equal(wardenBarModel(ws, 7 * 60_000 + 59_500, 8 * 60_000).wrathNear, true, 'its last minute');
  assert.equal(wardenBarModel(ws, 0, Infinity).wrath, null, 'far off: no clock');
});

test('KETCH THE HELD MAP\'S CARD COUNTS DOWN: the mark\'s key carries its card\'s words, so the held map repaints as her when-line moves - the same ring, the same label, a minute on (AUDIT KETCH L3-10; mutants: the card left out of the key)', async () => {
  const { readGateMark, gateMarkKey } = await import('../../src/ui/gate/gateMapMark.js');
  const mark = (line) => readGateMark(() => ({ day: 1, cx: 10.5, cy: 10.5, r: 1.6, label: 'The Sky-Ketch Mzunthar', phase: 'docked', tip: { title: 'The Sky-Ketch Mzunthar', lines: ['Keeping station over the fields', line] } }), { width: 100, height: 100 });
  const a = mark('over Daggerfall, 5h 2m left'), b = mark('over Daggerfall, 5h 1m left');
  assert.notEqual(gateMarkKey(a), gateMarkKey(b));
  assert.equal(gateMarkKey(a), gateMarkKey(mark('over Daggerfall, 5h 2m left')), 'and nothing new, no repaint');
});
