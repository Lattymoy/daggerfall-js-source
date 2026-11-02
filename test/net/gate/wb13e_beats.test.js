// WB13e (2026-10-01, Mac: "just overall bring more AAA grade polish to what is already developed"): THE BEATS - his wake
// (the relay's `op`: a roar, a flare and his name as the opening ends), a phase's turn as a card held until he lands with
// his roar after the bound's bark, his fall as an event (a burst, the court's light white, a shake, a column of embers,
// his body sinking and left on the floor, the spoils after it under a card), the Wrath said and seen, his low health
// sputtering, a Meteor or a Leap aimed at me stung, and the court's lines standing for their length
// (bible/11-Multiplayer/World-Bosses.md section 20, WB13e).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATTACKS, OPENING_MS, PHASE_NAMES, newFight, stateOf, windupOf } from '../../../src/net/gate/gateBrain.js';
import { GATE_STATE_EMPTY, foldGate } from '../../../src/net/gate/gateLink.js';
import { validGateOut } from '../../../src/net/wire.js';
import {
  bossAct, bossGlow, BOSS_CUES, GLOW_RANGE, FALL_MS, THUD_AT_MS, FALL_SINK_M, CORPSE_SCALE, WAKE_LEAD_MS, WAKE_FLARE_MS, LOW_HEALTH, sputter, emberColor,
} from '../../../src/world/gate/gateBoss.js';
import { courtToDungeon } from '../../../src/world/gate/gateArena.js';
import {
  createGateCourt, courtPhaseCard, courtSaySeconds, COURT_READ_S, COURT_WRATH_TEXT, WRATH_WARN_AT_MS, ROAR_AFTER_MS, SPEW_AT_MS, FALL_CARD_MS,
  FALL_FLASH_MS, FALL_SHAKE, COLUMN_BURSTS, COLUMN_STEP_MS, WAKE_LATE_MS, SPUTTER_EVERY_MS, WRATH_LIGHT_RANGE,
} from '../../../src/scenes/gate/gateCourt.js';
import { titleCardModel, drawGateTitleCard, destroyGateTitleCard, TITLE_IN_MS, TITLE_OUT_MS, TITLE_HOLD_MS, TITLE_CARD_CSS } from '../../../src/ui/gate/gateTitleCard.js';
import { bossBarModel, drawGateBossBar, destroyGateBossBar, BOSS_BAR_TEXT, BOSS_BAR_CSS } from '../../../src/ui/gate/gateBossBar.js';
import { destroyGateMarksCard } from '../../../src/ui/gate/gateMarksView.js';
import { destroyGateGround } from '../../../src/ui/gate/gateGroundView.js';
import { FX_KINDS } from '../../../src/render/gate/gateFx.js';
import { profileOf } from '../../../src/net/gate/gateBrain.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const BOSS = { name: 'Valkynaz Ruhn', title: 'Warden of the Burning Gate' };
const W = (key, over = {}) => ({ i: 1, a: ATTACKS[key].id, at: 10000, x: 0, z: 0, yw: 0, tg: [], ...over });
const state = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 900, max: 1000, fighters: 3, wrathAt: 10_000_000, ...over });
const clean = () => { destroyGateBossBar(); destroyGateMarksCard(); destroyGateGround(); destroyGateTitleCard(); };

/** A court driven by hand (test/ui/gate/wb13d_blows.test.js's): its sounds, words, shakes and batches heard. */
function court({ feet = [0, 0, 6], sprite = true } = {}) {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const sounds = [], said = [], batches = [], shakes = [], destroyed = [];
  const tex = { archive: 286, recordCount: 64, getFrameCount: () => 5, getSize: () => ({ width: 60, height: 30 }), getScale: () => ({ width: 0, height: 0 }) };
  const renderer = {
    textures: new Set(),
    createBillboardBatch: (archive, record, size) => { const b = { archive, record, size, bounds: new Float32Array([0, 0, 0, 1]) }; batches.push(b); return b; },
    destroyBillboardBatch: (b) => destroyed.push(b),
  };
  const c = createGateCourt({
    renderer, gl: null, audio: { play3d: (clip, p, v, o) => sounds.push(['clip', clip, o.pitch, p]), play3dId: (id, p, v, o) => sounds.push(['id', id, o.pitch, p]) },
    getTexture: async (a) => (sprite ? { ...tex, archive: a } : null), uploadRecordFrame: () => {},
    link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20), feet: () => courtToDungeon(feet[0], 0, feet[2]), player: () => ({ health: 100, maxHealth: 100 }),
    say: (t) => said.push(t), shake: (k) => shakes.push(k),
  });
  return { c, link, clock, sounds, said, batches, shakes, destroyed };
}
const tick = async (h, t, st) => { if (st) h.link.st = st; h.clock.t = t; h.c.frame(); await new Promise((r) => setImmediate(r)); };
const roars = (h) => h.sounds.filter((s) => s[1] === BOSS_CUES.roar.clip && s[2] === BOSS_CUES.roar.pitch).length;

test('WB13e his wake: the relay says the opening\'s end (`op`, through the wire and the fold); WAKE_LEAD_MS before it his roar, his flare and his name - title, name, epithet - over the court; never for a screen come late, nor from an older relay (mutants: no wake; the wake for a late screen; the flare never)', async () => {
  clean();
  const f = newFight(700, 50_000, 10_000_000, 'ruhn', ['rime', 'colossal', 'echoing']);
  const st = stateOf(f);
  assert.equal(st.op, 50_000 + OPENING_MS);
  assert.equal(validGateOut(st).op, st.op, 'the wire carries it');
  assert.equal(validGateOut({ ...st, op: -5 }), null, 'never a bad one');
  assert.equal(validGateOut({ ...st, op: undefined }).op, 0, 'an older relay says none');
  assert.equal(foldGate(GATE_STATE_EMPTY, validGateOut(st), 1).openUntil, st.op, 'the fold keeps it');
  const op = 20_000;
  const h = court();
  await tick(h, 12_000, state({ openUntil: op, md: ['rime', 'colossal', 'echoing'] }));
  await tick(h, op - WAKE_LEAD_MS - 1);
  assert.equal(roars(h), 0, 'not before');
  await tick(h, op - WAKE_LEAD_MS);
  assert.equal(roars(h), 1, 'his roar');
  const beat = h.c.state().beat;
  assert.deepEqual([beat.kind, beat.kicker, beat.main, beat.sub, beat.until - beat.at], ['wake', BOSS.title, BOSS.name, 'The Rime-Wrought', TITLE_HOLD_MS]);
  await tick(h, op);
  assert.equal(roars(h), 1, 'once');
  const lit = (t) => bossGlow(state({ openUntil: op }), t);
  assert.ok(lit(op - WAKE_LEAD_MS + WAKE_FLARE_MS / 2).color[0] > lit(op + WAKE_FLARE_MS).color[0] * 3, 'his ember flares, then settles');
  assert.equal(lit(op - WAKE_LEAD_MS + WAKE_FLARE_MS / 2).range, GLOW_RANGE.landing);
  const late = court();
  await tick(late, op + WAKE_LATE_MS, state({ openUntil: op }));
  assert.equal(roars(late), 0, 'a screen come late: no wake');
  assert.equal(late.c.state().beat, null);
  const old = court();
  await tick(old, op, state());
  assert.equal(roars(old), 0, 'an older relay: none');
});

test('WB13e a phase\'s turn: its card (numeral, name, one order) held until the bound lands, nothing said beside it, and his roar ROAR_AFTER_MS after the turn - the bound\'s bark first (mutants: the roar over the bark; the card gone before he lands)', async () => {
  clean();
  const h = court();
  await tick(h, 1000, state({ phase: 1 }));
  await tick(h, 2000, state({ phase: 2 }));
  const b = h.c.state().beat;
  assert.deepEqual([b.kind, b.kicker, b.main, b.sub], ['phase', 'II', PHASE_NAMES[1], 'Follow him over the walkway.']);
  assert.equal(roars(h), 0, 'not over the bark');
  await tick(h, 2000 + ROAR_AFTER_MS);
  assert.equal(roars(h), 1, 'then his roar');
  const cross = W('cross', { i: 2, at: 2100 + windupOf(ATTACKS.cross, 2), tg: [[0, 0]], to: 1 });
  await tick(h, 2100, state({ phase: 2, atk: cross }));
  assert.ok(h.c.state().beat.until >= cross.at + ATTACKS.cross.active, 'its order kept until he lands');
  assert.ok(!h.said.length, 'nothing said under the card');
  await tick(h, 20_000, state({ phase: 3 }));
  assert.deepEqual([h.c.state().beat.kicker, h.c.state().beat.main], ['III', PHASE_NAMES[2]], 'the last turn its own');
  assert.deepEqual(courtPhaseCard(3), { kicker: 'III', main: PHASE_NAMES[2], sub: 'Follow him to the last court.' });
  assert.equal(courtPhaseCard(1), null);
});

test('WB13e the card: in over TITLE_IN_MS, out over TITLE_OUT_MS; one node written when its beat changes; under the step\'s fire and with the HUD it hides; above the crosshair, clear of his bar (mutants: never fading; the card over the veil)', () => {
  const beat = { kind: 'phase', at: 1000, until: 1000 + TITLE_HOLD_MS, kicker: 'II', main: 'The Burning Court', sub: 'Follow him over the walkway.' };
  assert.equal(titleCardModel(beat, 999), null);
  assert.equal(titleCardModel(beat, 1000 + TITLE_IN_MS / 2).alpha, 0.5);
  assert.equal(titleCardModel(beat, 1000 + TITLE_IN_MS).alpha, 1);
  assert.equal(titleCardModel(beat, beat.until - TITLE_OUT_MS / 2).alpha, 0.5);
  assert.equal(titleCardModel(beat, beat.until), null);
  const made = [];
  const node = (tag) => { const n = { tag, style: {}, className: '', textContent: '', children: [], append(...c) { this.children.push(...c); }, remove() {}, setAttribute() {} }; made.push(n); return n; };
  const heads = [];
  const doc = { createElement: node, body: node('body'), head: { append: (s) => heads.push(s) }, getElementById: (id) => heads.find((s) => s.id === id) ?? null };
  destroyGateTitleCard();
  drawGateTitleCard(titleCardModel(beat, 1500), { doc });
  const root = doc.body.children[0];
  assert.deepEqual(root.children.map((c) => c.textContent), ['II', 'The Burning Court', '', 'Follow him over the walkway.']);
  const n = made.length;
  drawGateTitleCard(titleCardModel(beat, 1600), { doc });
  assert.equal(made.length, n, 'updated, not rebuilt');
  drawGateTitleCard(titleCardModel(beat, 1600), { doc, hidden: true });
  assert.equal(root.style.display, 'none');
  destroyGateTitleCard();
  assert.match(read('src/scenes/gate/gateCourt.js'), /drawGateTitleCard\(titleCardModel\(beat, t\), \{ hidden: hudHidden\(\) \|\| veiled\(\) \}\);/);
  assert.match(TITLE_CARD_CSS, /\.wb-title-card \{ position: fixed; left: 50%; top: 34%;/);
  assert.match(TITLE_CARD_CSS, /pointer-events: none;/);
});

test('WB13e his fall, an event: at the kill a burst of Dagon\'s size, the court\'s light white for FALL_FLASH_MS and a shake of FALL_SHAKE; as his body meets the floor a column of embers, and he sinks FALL_SINK_M into the stone; his corpse left at CORPSE_SCALE; the spoils after his body, under the card (Felled); a screen come late sees his body and nothing played again (mutants: the spoils before the thud; no column; no corpse; the burst for a late screen)', async () => {
  clean();
  assert.ok(SPEW_AT_MS > THUD_AT_MS, 'the spoils after his body meets the floor');
  const h = court();
  const fell = { at: 30_000, top: [], n: 3 };
  await tick(h, 29_000, state());
  await tick(h, 29_016);
  await tick(h, 30_000, state({ hp: 0, fell }));
  assert.deepEqual(h.shakes, [FALL_SHAKE]);
  const burst = h.c.state().bursts.find((b) => b.kind === FX_KINDS.dagon);
  assert.ok(burst, 'a burst of Dagon\'s size');
  h.clock.t = 30_000 + FALL_FLASH_MS / 2;
  assert.ok(h.c.lights().some((l) => l.range === 40 && Math.abs(l.color[0] - 2) < 1e-9), 'the court\'s light white, half way');
  // the column as his body meets the floor
  for (let k = 0; k < COLUMN_BURSTS; k++) await tick(h, 30_000 + THUD_AT_MS + k * COLUMN_STEP_MS);
  assert.equal(h.c.state().bursts.filter((b) => b.kind === FX_KINDS.embers).length, COLUMN_BURSTS);
  // he sinks
  assert.equal(bossAct(state({ fell }), 30_000 + THUD_AT_MS).sink, 0);
  assert.equal(bossAct(state({ fell }), 30_000 + FALL_MS - 1).sink > FALL_SINK_M * 0.99, true);
  const body = h.batches.find((x) => x.archive !== 400);
  await tick(h, 30_000 + FALL_MS - 50);
  assert.ok(body.origin[1] < courtToDungeon(0, 0, 0)[1] - FALL_SINK_M * 0.9, 'into the stone');
  // the card over his spoils
  await tick(h, 30_000 + SPEW_AT_MS);
  const b = h.c.state().beat;
  assert.deepEqual([b.kind, b.kicker, b.main, b.until - b.at], ['fall', BOSS.name, BOSS_BAR_TEXT.fallen, FALL_CARD_MS]);
  // his body left on the floor
  await tick(h, 30_000 + FALL_MS);
  await tick(h, 30_000 + FALL_MS + 16);
  const corpse = h.batches.find((x) => x.archive === 400);
  assert.ok(corpse, 'his corpse, his mobile\'s own');
  assert.ok(h.c.batches().includes(corpse));
  assert.ok(Math.abs(corpse.size.w - (60 / 40) * CORPSE_SCALE) < 0.6, `three times its own: ${corpse.size.w}`);
  h.c.leave();
  assert.ok(h.destroyed.includes(corpse), 'put away with the court');
  // a screen come late
  const late = court();
  await tick(late, 90_000, state({ hp: 0, fell }));
  await tick(late, 90_016);
  assert.deepEqual(late.shakes, []);
  assert.equal(late.c.state().bursts.length, 0, 'nothing played again');
  assert.equal(late.c.state().beat, null);
  assert.ok(late.batches.some((x) => x.archive === 400), 'his body there');
});

test('WB13e the Wrath said and seen: a minute out (while it is news) and as it gathers; his court reddening over its wind-up, then white as it lands (mutants: never said; said late; the court never red)', async () => {
  clean();
  const h = court();
  const wrathAt = 200_000;
  await tick(h, wrathAt - WRATH_WARN_AT_MS - 1, state({ wrathAt }));
  assert.ok(!h.said.includes(COURT_WRATH_TEXT.minute));
  await tick(h, wrathAt - WRATH_WARN_AT_MS);
  await tick(h, wrathAt - WRATH_WARN_AT_MS + 100);
  assert.equal(h.said.filter((s) => s === COURT_WRATH_TEXT.minute).length, 1, 'once');
  const late = court();
  await tick(late, wrathAt - 20_000, state({ wrathAt }));
  assert.ok(!late.said.includes(COURT_WRATH_TEXT.minute), 'a minute out, not twenty seconds');
  const w = windupOf(ATTACKS.wrath, 3), atk = W('wrath', { i: 9, at: wrathAt });
  await tick(h, wrathAt - w, state({ wrathAt, phase: 3, atk }));
  assert.equal(h.said.filter((s) => s === COURT_WRATH_TEXT.windup).length, 1, 'as it gathers');
  const red = (t) => { h.clock.t = t; return h.c.lights().find((l) => l.range === WRATH_LIGHT_RANGE); };
  assert.ok(red(wrathAt - w / 2).color[0] > red(wrathAt - w * 0.9).color[0], 'reddening');
  assert.ok(red(wrathAt - w / 2).color[0] > red(wrathAt - w / 2).color[2] * 10, 'red');
  const white = red(wrathAt + 10);
  assert.ok(white.color[2] > 3, 'then white');
  assert.equal(red(wrathAt + FALL_FLASH_MS + 10), undefined);
});

test('WB13e under LOW_HEALTH: his ember sputters - stepped, never steady - and sheds a spark every SPUTTER_EVERY_MS; the bar pulses (mutants: a steady ember; sparks every frame; the bar never pulsing)', async () => {
  clean();
  const low = state({ hp: 80 }), P = profileOf(low), e = emberColor(P);
  const vals = new Set();
  for (let t = 0; t < 2000; t += 90) vals.add(Math.round(bossGlow(low, t).color[0] / e[0] * 1000));
  assert.ok(vals.size > 5, 'it sputters');
  for (let t = 0; t < 2000; t += 45) { const k = sputter(t); assert.ok(k >= 0.2 && k <= 1, `${k}`); }
  assert.deepEqual(bossGlow(state({ hp: 200 }), 500).color, e.map((c) => c * 0.45), 'over it: steady');
  const h = court();
  await tick(h, 1000, low);
  await tick(h, 1016); await tick(h, 1200); await tick(h, 1499);
  assert.equal(h.c.state().bursts.filter((b) => b.kind === FX_KINDS.sputter).length, 1, 'one spark in its half second');
  await tick(h, 1000 + SPUTTER_EVERY_MS);
  assert.equal(h.c.state().bursts.filter((b) => b.kind === FX_KINDS.sputter).length, 2);
  assert.equal(bossBarModel(low, 1000, BOSS).low, true);
  assert.equal(bossBarModel(state({ hp: 101 }), 1000, BOSS).low, false);
  assert.equal(bossBarModel(state({ hp: 0, fell: { at: 1, top: [], n: 1 } }), 1000, BOSS).low, false, 'not over his fall');
  assert.equal(LOW_HEALTH, 0.1);
  assert.match(BOSS_BAR_CSS, /\.wb-boss-bar\.low \.wb-boss-fill \{ animation: wb-low 650ms ease-in-out infinite alternate; \}/);
});

test('WB13e aimed at me: a Meteor or a Leap called on the ground I stand on says so at its word with a sting, once; not one called elsewhere (mutants: no sting; a sting for every meteor)', async () => {
  clean();
  const h = court({ feet: [3, 0, 3] });
  await tick(h, 5000, state({ phase: 2, atk: W('meteor', { i: 3, at: 8000, tg: [[3, 3]] }) }));
  await tick(h, 5100);
  const stings = () => h.sounds.filter((s) => s[1] === BOSS_CUES.sting.clip && s[2] === BOSS_CUES.sting.pitch);
  assert.equal(stings().length, 1, 'once, at its word');
  assert.deepEqual(stings()[0][3], courtToDungeon(3, 0, 3), 'at my feet');
  await tick(h, 9000, state({ phase: 2, atk: W('meteor', { i: 4, at: 12000, tg: [[-15, -15]] }) }));
  assert.equal(stings().length, 1, 'one called elsewhere: none');
  await tick(h, 13000, state({ phase: 2, atk: W('leap', { i: 5, at: 15000, tg: [[3, 4]] }) }));
  assert.equal(stings().length, 2, 'a Leap too');
});

test('WB13e a line over the middle of the screen stands for its length - its words at 3.5 a second, between COURT_READ_S (mutants: the label\'s 1.5 s for everything)', () => {
  assert.equal(courtSaySeconds('Imps rise from the fire!'), COURT_READ_S[0]);
  assert.equal(courtSaySeconds(Array(14).fill('word').join(' ')), 4);
  assert.equal(courtSaySeconds(Array(60).fill('word').join(' ')), COURT_READ_S[1]);
  assert.match(read('src/scenes/world.js'), /say: \(text\) => setMidScreenText\(text, courtSaySeconds\(text\)\),   \/\/ WB13e/);
});
