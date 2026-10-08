// WB8c (2026-09-28, Mac: "continue to refine and add detail to his encounters") - THE WARDEN'S MARKS, ON EVERY SCREEN.
//
// The relay says a fight's marks (`md`, WB8b) and every screen fights and draws them: a struck player's machine judges
// his blows at their marked reach and takes them through the saving throw of his aspect's element; the ground his
// landings leave is his aspect's and Scarring's; he stands as large as Colossal makes him, glows and sounds in his
// aspect's colours and voice; his bar says his epithet and his trials, each attack by his aspect's name. The court says
// his marks as a fighter steps through, his feeding on the fallen, each phase's turn in his aspect's words; the omen,
// the map's card and the Discord herald name tonight's marks before the gate opens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ATTACKS, BOSS_R, BOSS_H, POOLS, SCAR_POOLS, COURT_CENTRE, fightProfile, BASE_PROFILE, windupOf } from '../src/net/gateBrain.js';
import { inAttack, strikeVerdict, landingPools, blowOf, savedShare, chargeStrikes } from '../src/net/gateStrike.js';
import { gateModsOf, marksLine, gateTimes } from '../src/net/gateLaw.js';
import { gateAspectOf } from '../src/net/gateMods.js';
import { foldGate, GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import {
  attackColor, poolColor, emberColor, bossGlow, bossCue, ASPECT_COLORS, ATTACK_COLORS, POOL_COLOR, EMBER_COLOR, BOSS_CUES, ASPECT_CUE_IDS, THUNDER_ROLL,
} from '../src/world/gateBoss.js';
import { telegraphShape, markShape, BOSS_MARK_R } from '../src/render/gateTelegraph.js';
import { bossBarModel, drawGateBossBar, destroyGateBossBar } from '../src/ui/gateBossBar.js';
import { aspectCss } from '../src/ui/gateMarksView.js';   // WB13c: his epithet's colour on the bar
import { createGateCourt, COURT_STRIKE_TEXT, COURT_MARKS_TEXT, courtPhaseCard, MARK_COLOR, FED_LATE_MS } from '../src/scenes/gateCourt.js';
import { courtToDungeon } from '../src/world/gateArena.js';
import { gateTip } from '../src/systems/gateOmen.js';
import { omenPost } from '../src/net/gateHerald.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = (key, over = {}) => ({ i: 1, a: ATTACKS[key].id, at: 10000, x: 0, z: 0, yw: 0, tg: [], ...over });
const state = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 900, max: 1000, fighters: 3, wrathAt: 10_000_000, ...over });
const P = (...md) => fightProfile(md);

/** A court driven by hand (the WB4 suite's harness): the throw it was asked for is kept, with its element. */
function court({ feet = [0, 0, 0], health = 100, maxHealth = 100, save = 100 } = {}) {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const struck = [], said = [], sounds = [], saves = [];
  const me = { health, maxHealth };
  const c = createGateCourt({
    renderer: null, gl: null, audio: { play3d: (clip, p, v, o) => sounds.push(['clip', clip, o]), play3dId: (id, p, v, o) => sounds.push(['id', id, o]) },
    link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20),
    feet: () => (feet ? courtToDungeon(feet[0], 0, feet[2]) : null), player: () => me,
    save: (e, el) => { saves.push(el); return save; },
    strike: (dmg, how) => { struck.push([dmg, how]); me.health -= dmg; }, say: (t) => said.push(t),
  });
  return { c, link, clock, struck, said, sounds, saves, me };
}
const tick = async (h, t, st) => { if (st) h.link.st = st; h.clock.t = t; h.c.frame(); await new Promise((r) => setImmediate(r)); };

// ═══ THE STRIKE, UNDER HIS MARKS ══════════════════════════════════════════════════════════════════════════════════

test('WB8c the strike law under a profile: Colossal\'s slam reaches 8.5 and his cone and his charge hold his larger body; each blow\'s element and name are his aspect\'s, any element\'s saving throw answers it, Vengeful\'s weight in its share and base; the Wrath answered by nothing (mutants: the old reach; the element unread; the throw fire\'s alone)', () => {
  const C = P('burning', 'colossal');
  const slam = W('slam');
  assert.equal(inAttack(slam, 0, 8), false, 'unmarked: 8 m off his feet is clear');
  assert.equal(inAttack(slam, 0, 8, C), true, 'Colossal: inside his slam');
  assert.equal(strikeVerdict(slam, 0, 8, 10000, -Infinity, C), 'hit');
  const cleave = W('cleave', { yw: 0 });
  assert.equal(inAttack(cleave, 0, -2.1), false, 'behind him, past his old body');
  assert.equal(inAttack(cleave, 0, -2.1, C), true, 'inside his larger body the cone always holds');
  const charge = W('charge', { tg: [[0, 20]] });
  assert.equal(inAttack(charge, 2.1, 10), false); assert.equal(inAttack(charge, 2.1, 10, C), true, 'the lane as wide as his body');
  assert.equal(chargeStrikes(charge, 2.1, 10, 10000 + ATTACKS.charge.active, 10000, C), true);
  const R = P('rime', 'vengeful');
  assert.deepEqual(blowOf(W('hellfire'), R), { pct: ATTACKS.hellfire.pct * 1.25, base: ATTACKS.hellfire.base * 1.25, el: 'frost', name: 'Rimefall', saved: true });
  assert.deepEqual(blowOf(W('cleave'), R), { pct: ATTACKS.cleave.pct * 1.25, base: ATTACKS.cleave.base * 1.25, el: null, name: 'Cleave', saved: false });
  assert.deepEqual(blowOf(W('spokes'), P('storm')), { pct: ATTACKS.spokes.pct, base: ATTACKS.spokes.base, el: 'shock', name: 'Spokes of Storm', saved: true });
  assert.equal(blowOf(W('wrath'), P('venom')).saved, false, 'Dagon\'s Wrath is answered by nothing');
  assert.equal(blowOf(W('wrath'), P('venom')).el, 'fire');
  assert.deepEqual(blowOf(W('nova')), blowOf(W('nova'), BASE_PROFILE), 'unmarked, the attack\'s own');
  assert.equal(savedShare(41, 50), 20);
});

test('WB8c the ground under his marks: his aspect\'s element on every pool; Scarring\'s under his slam (at his feet) and his leap (where it lands), all ground half again as long; Vengeful\'s bite heavier (mutants: no scar; the scar at the wrong spot; the span unscaled)', () => {
  const S = P('venom', 'scarring');
  assert.deepEqual(landingPools(W('slam', { x: 3, z: -2 }), S), [{ x: 3, z: -2, r: SCAR_POOLS.slam.r, from: 10000, until: 10000 + SCAR_POOLS.slam.ms * 1.5, pct: SCAR_POOLS.slam.pct, base: SCAR_POOLS.slam.base, el: 'poison' }]);
  assert.deepEqual(landingPools(W('leap', { tg: [[5, 5]] }), S).map((p) => [p.x, p.z, p.r, p.until - p.from]), [[5, 5, SCAR_POOLS.leap.r, SCAR_POOLS.leap.ms * 1.5]]);
  assert.deepEqual(landingPools(W('slam')), [], 'no scar unmarked');
  assert.equal(landingPools(W('meteor', { tg: [[1, 1]] }), S)[0].until - 10000, POOLS.meteor.ms * 1.5);
  assert.equal(landingPools(W('meteor', { tg: [[1, 1]] }))[0].el, 'fire', 'the Burning Warden\'s ground burns');
  assert.equal(landingPools(W('hellfire', { tg: [[1, 1]] }), P('rime'))[0].el, 'frost');
  assert.equal(landingPools(W('hellfire', { tg: [[1, 1]] }), P('burning', 'vengeful'))[0].pct, POOLS.hellfire.pct * 1.25);
});

// ═══ THE COURT, UNDER HIS MARKS ══════════════════════════════════════════════════════════════════════════════════

test('WB8c the court\'s strikes: his frost through MY frost throw - the host asked for the element - and a full resist said in its own word; his rime underfoot bites through the same throw; the strike door told the element (mutants: the throw asked for fire; the word fire\'s)', async () => {
  destroyGateBossBar();
  const md = ['rime', 'scarring'];
  const h = court({ feet: [1, 0, 1], maxHealth: 200, health: 200, save: 50 });
  await tick(h, 13000, state({ md, atk: W('hellfire', { i: 7, at: 13001, tg: [[1, 1]] }), phase: 2 }));
  await tick(h, 13001);
  assert.deepEqual(h.struck, [[44, { fire: false, el: 'frost', name: 'Rimefall' }]], 'WB9e: 40% of 200 and its 9, halved by my frost throw');
  assert.ok(h.saves.includes('frost'), 'the throw asked for is frost');
  // the rime it left: a step in, a tick, a bite - frost again
  await tick(h, 13001 + 1000); await tick(h, 13001 + 2001);
  assert.deepEqual(h.struck.at(-1)[1], { fire: false, el: 'frost', name: 'rime' }, 'the ground his aspect lays');
  const r = court({ feet: [1, 0, 1], save: 0 });
  await tick(r, 13000, state({ md: ['storm'], atk: W('hellfire', { i: 7, at: 13001, tg: [[1, 1]] }), phase: 2 }));
  await tick(r, 13001);
  assert.deepEqual(r.struck, []);
  assert.ok(r.said.includes(COURT_STRIKE_TEXT.resisted('Stormfall')));
  assert.equal(COURT_STRIKE_TEXT.resisted('Stormfall'), 'Stormfall resisted.', 'WB13b: the blow by its name under his aspect, and stop');
  assert.equal(COURT_STRIKE_TEXT.resisted('Hellfire'), 'Hellfire resisted.');
  assert.equal(COURT_STRIKE_TEXT.resisted('Venom Nova'), 'Venom Nova resisted.');
  assert.equal(COURT_STRIKE_TEXT.resisted('Frost Nova'), 'Frost Nova resisted.');
  // Colossal: his slam reaches me 8 m off
  const c = court({ feet: [0, 0, 8], maxHealth: 100 });
  await tick(c, 9000, state({ md: ['burning', 'colossal'], atk: W('slam', { i: 9 }) }));
  await tick(c, 10001);
  assert.equal(c.struck.length, 1, 'the colossus\'s slam');
  // Scarring: the slam's landing lays its scar at his feet, on this screen
  const sc = court({ feet: [0, 0, 20] });
  await tick(sc, 9000, state({ md: ['venom', 'scarring'], atk: W('slam', { i: 9, x: 2, z: -3 }) }));
  await tick(sc, 10001);
  assert.deepEqual(sc.c.state().pools.map((p) => [p.x, p.z, p.r, p.el]), [[2, -3, SCAR_POOLS.slam.r, 'poison']]);
  const un = court({ feet: [0, 0, 20] });
  await tick(un, 9000, state({ atk: W('slam', { i: 9 }) })); await tick(un, 10001);
  assert.deepEqual(un.c.state().pools, [], 'no scar unmarked');
  destroyGateBossBar();
});

test('WB8c the court\'s words: his marks said as I step through (his aspect\'s own line and his trials) - once an entry, never to a court whose Warden has gone, never for an unmarked one; his feeding on a fallen challenger, by name, heard live; each phase\'s turn in his aspect\'s words (mutants: said every frame; a stale feeding said; the fire\'s words under the rime)', async () => {
  destroyGateBossBar();
  const md = ['rime', 'colossal', 'echoing'];
  const h = court();
  await tick(h, 1000, state({ md }));
  await tick(h, 1100, state({ md }));
  assert.deepEqual(h.said, [], 'WB13b: nothing said on stepping in - the marks\' card stands at that moment');
  assert.equal(h.c.state().marksAt, 1000, 'the card stands from the step - its moment held, never moved by the next frame (it would never go)');
  assert.ok(!('arrive' in COURT_MARKS_TEXT));
  const plain = court();
  await tick(plain, 1000, state({}));
  assert.deepEqual(plain.said, [], 'an unmarked Warden (an older relay\'s) says nothing new');
  // feeding
  await tick(h, 2000, state({ md, fed: { ns: ['Ann'], at: 1999 } }));
  await tick(h, 2100, state({ md, fed: { ns: ['Ann'], at: 1999 } }));
  assert.equal(h.said.filter((s) => s === COURT_MARKS_TEXT.fed('Valkynaz Ruhn', ['Ann'])).length, 1, 'said once');
  assert.equal(COURT_MARKS_TEXT.fed('Valkynaz Ruhn', ['Ann']), 'Valkynaz Ruhn feeds on Ann\'s soul.');
  assert.equal(COURT_MARKS_TEXT.fed('Valkynaz Ruhn', []), 'Valkynaz Ruhn feeds on a fallen challenger\'s soul.');
  // AUDIT PRE-MERGE 0929 W1-3: a beat's feedings, every name
  assert.equal(COURT_MARKS_TEXT.fed('Valkynaz Ruhn', ['Ann', 'Bran']), 'Valkynaz Ruhn feeds on the souls of Ann and Bran.');
  assert.equal(COURT_MARKS_TEXT.fed('Valkynaz Ruhn', ['Ann', 'Bran', 'Cyrus']), 'Valkynaz Ruhn feeds on the souls of Ann, Bran and Cyrus.');
  await tick(h, 3000, state({ md, fed: { ns: ['Bran', 'Cyrus'], at: 2999 } }));
  assert.ok(h.said.includes('Valkynaz Ruhn feeds on the souls of Bran and Cyrus.'), 'both of a beat\'s fallen named');
  const stale = court();
  await tick(stale, 9000, state({ md, fed: { ns: ['Ann'], at: 1999 } }));
  assert.ok(!stale.said.some((s) => s.includes('feeds on')), 'a feeding long past, heard on entering, is not news');
  // AUDIT PRE-MERGE 0929 W2-3: and a feeding long past is not news AFTER one that was - a tab hidden through Bob's fall
  // said it, and growled, a minute late
  const hidden = court();
  await tick(hidden, 2000, state({ md, fed: { ns: ['Ann'], at: 1999 } }));
  assert.equal(hidden.said.filter((s) => s.includes('feeds on')).length, 1);
  await tick(hidden, 62000, state({ md, fed: { ns: ['Bob'], at: 12000 } }));
  assert.ok(!hidden.said.some((s) => s.includes('Bob')), 'a feeding 50 s old said as news');
  assert.ok(FED_LATE_MS >= 1000 && FED_LATE_MS <= 5000);
  // the turns - WB13e: a card, its one order the same under every aspect (WB9b/c: each turn crosses to the next court)
  assert.deepEqual(courtPhaseCard(2), { kicker: 'II', main: 'The Burning Court', sub: 'Follow him over the walkway.' });
  assert.deepEqual(courtPhaseCard(3), { kicker: 'III', main: 'Dagon\'s Champion', sub: 'Follow him to the last court.' });
  await tick(h, 3000, state({ md, phase: 2 }));
  assert.equal(h.c.state().beat.main, 'The Burning Court', 'shown as it comes');
  assert.ok(!h.said.some((s) => s.includes('Burning Court')), 'nothing said beside it');
  destroyGateBossBar();
});

test('WB8c the court\'s body under his marks: Colossal\'s larger body for my blows (the relay measures from the same), his mark about it and in his aspect\'s ember, his ground in his aspect\'s colour (mutants: the old body handed on; the Burning ember under the rime)', async () => {
  destroyGateBossBar();
  const h = court();
  await tick(h, 1000, state({ md: ['venom', 'colossal'] }));
  const t = h.c.target();
  assert.equal(t.radius, BOSS_R * 1.25); assert.equal(t.height, BOSS_H * 1.25);
  const m = h.c.state().mark;
  assert.equal(m.body, BOSS_R * 1.25); assert.equal(m.r, BOSS_R * 1.25 + (BOSS_MARK_R - BOSS_R));
  assert.deepEqual(m.color, EMBER_COLOR === emberColor(fightProfile(['venom'])) ? MARK_COLOR : ASPECT_COLORS.venom.ember.map((c) => Math.min(1, c * 1.1)));
  const b = court();
  await tick(b, 1000, state({}));
  assert.equal(b.c.target().radius, BOSS_R);
  assert.equal(b.c.state().mark.color, MARK_COLOR, 'the Burning Warden\'s own');
  destroyGateBossBar();
});

// ═══ THE LOOK ════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB8c the look and the voice: his elemental blows, his ground and his ember in his aspect\'s colours - his weight\'s own and Dagon\'s Wrath untouched; his glow at his own chest; his elemental cues in his element\'s cast and, landing, the storm\'s thunder - the burning cues as they were (mutants: a blade turned blue; the Wrath recoloured; the voice unchanged under the rime)', () => {
  for (const id of ['rime', 'storm', 'venom']) {
    const Q = fightProfile([id]);
    for (const k of ['hellfire', 'nova', 'meteor', 'spokes']) assert.deepEqual(attackColor(ATTACKS[k], Q), ASPECT_COLORS[id][k], `${id} ${k}`);
    for (const k of ['cleave', 'slam', 'charge', 'leap', 'wrath']) assert.equal(attackColor(ATTACKS[k], Q), ATTACK_COLORS[k], `${id} ${k}: his own`);
    assert.deepEqual(poolColor(Q), ASPECT_COLORS[id].pool); assert.deepEqual(emberColor(Q), ASPECT_COLORS[id].ember);
    assert.equal(bossCue('windup', ATTACKS.nova, Q).id, ASPECT_CUE_IDS[id]);
    assert.equal(bossCue('windup', ATTACKS.nova, Q).pitch, BOSS_CUES.windup.nova.pitch, 'the burning cue\'s own pitch');
    assert.equal(bossCue('land', ATTACKS.wrath, Q), BOSS_CUES.land.wrath, 'Dagon\'s Wrath is Dagon\'s');
    assert.equal(bossCue('windup', ATTACKS.cleave, Q), BOSS_CUES.windup.cleave, 'his blade\'s bark');
  }
  assert.equal(bossCue('land', ATTACKS.meteor, fightProfile(['storm'])).clip, THUNDER_ROLL, 'the storm lands in thunder');
  for (const k of Object.keys(ATTACKS)) { assert.equal(attackColor(ATTACKS[k], BASE_PROFILE), ATTACK_COLORS[k]); assert.equal(bossCue('windup', ATTACKS[k], BASE_PROFILE), BOSS_CUES.windup[k]); }
  assert.equal(poolColor(BASE_PROFILE), POOL_COLOR); assert.equal(emberColor(BASE_PROFILE), EMBER_COLOR);
  const g = bossGlow(state({ md: ['rime', 'colossal'] }), 5000);
  assert.ok(Math.abs(g.y - courtToDungeon(0, BOSS_H * 1.25 * 0.55, 0)[1]) < 1e-9, 'at the colossus\'s chest');
  assert.deepEqual(g.color, ASPECT_COLORS.rime.ember.map((c) => c * 0.45));
  const w = bossGlow(state({ md: ['rime'], atk: W('nova', { at: 6000 }) }), 6000);
  assert.deepEqual(w.color, ASPECT_COLORS.rime.nova.map((c) => c * 2.4), 'a landing flares in his aspect\'s colour');
});

test('WB8c the ground drawn and the bar: the telegraph shows Colossal\'s slam at its reach and his body, in his aspect\'s colour; his mark about his own body; the bar says his epithet under his name (WB13c), his trials under it, and each attack by his aspect\'s name in its colour (mutants: the old reach drawn; the Burning name under the storm)', () => {
  const C = fightProfile(['storm', 'colossal', 'grudge']);
  const sh = telegraphShape(W('slam', { at: 11000 }), 1, 10000, C);
  assert.equal(sh.r, 8.5); assert.equal(sh.body, BOSS_R * 1.25);
  assert.equal(telegraphShape(W('slam', { at: 11000 }), 1, 10000).r, ATTACKS.slam.r);
  assert.deepEqual(telegraphShape(W('hellfire', { at: 11000, tg: [[1, 1]] }), 2, 10000, C).color, ASPECT_COLORS.storm.hellfire);
  assert.equal(telegraphShape(W('charge', { at: 11000, tg: [[0, 20]] }), 1, 10000, C).halfW, BOSS_R * 1.25);
  assert.equal(markShape([0, 0], 0, [1, 1, 1]).r, BOSS_MARK_R, 'his mark about his old body, unmarked');
  const boss = { name: 'Valkynaz Ruhn', title: 'Warden of the Burning Gate' };
  const m = bossBarModel(state({ md: ['storm', 'colossal', 'grudge'], atk: W('meteor', { at: 12000 }), phase: 2 }), 10000, boss);
  assert.equal(m.epithet, 'the Storm-Crowned'); assert.equal(m.trials, 'Colossal - Grudge-Bearer');
  assert.deepEqual({ text: m.callout.text, color: m.callout.color }, { text: 'Thunderbolt of Oblivion', color: `rgb(${ASPECT_COLORS.storm.meteor.map((c) => Math.round(c * 255)).join(', ')})` });
  const u = bossBarModel(state({ atk: W('meteor', { at: 12000 }), phase: 2 }), 10000, boss);
  assert.equal(u.epithet, ''); assert.equal(u.trials, ''); assert.equal(u.callout.text, 'Meteor of Oblivion');
  // the node: his name with his epithet; WB9a: his marks under his health, a chip each (the row hidden when he bears none)
  const made = [];
  const node = (tag) => { const n = { tag, style: {}, className: '', textContent: '', children: [], append(...c) { this.children.push(...c); }, remove() {} }; made.push(n); return n; };
  const doc = { createElement: node, body: node('body'), head: { append() {} }, getElementById: () => null };
  destroyGateBossBar();
  drawGateBossBar(m, { doc });
  const root = doc.body.children[0];
  assert.equal(root.children[0].textContent, 'Valkynaz Ruhn', 'WB13c: his name on its own line');
  const sub = root.children[1];
  assert.deepEqual([sub.textContent, sub.style.color], ['The Storm-Crowned', aspectCss('storm')], 'WB13c: his epithet beneath it, in his aspect\'s colour');
  const row = root.children[3];
  assert.equal(row.className, 'wb-boss-marks');
  assert.deepEqual(row.children.map((c) => c.children[0].children[1].textContent), ['Storm-Crowned', 'Colossal', 'Grudge-Bearer']);
  drawGateBossBar(u, { doc });
  assert.deepEqual([root.children[0].textContent, sub.textContent, sub.style.color], ['Valkynaz Ruhn', 'Warden of the Burning Gate', ''], 'unmarked, his title there');
  assert.equal(row.style.display, 'none');
  destroyGateBossBar();
});

// ═══ THE WORD BEFORE THE GATE ════════════════════════════════════════════════════════════════════════════════════

test('WB8c tonight\'s marks before the gate opens: the chat\'s line (his aspect\'s omen, each trial by name and in words), the map\'s card while he stands (his epithet and his trials), the Discord omen in the tables\' words alone (mutants: the card without them; a trial unsaid)', () => {
  const day = 112;   // WB11a: the nine-trial rotation moved the Rime-Wrought, Colossal and Unyielding from day 3 to day 112
  assert.deepEqual(gateModsOf(day), ['rime', 'colossal', 'unyielding']);
  assert.equal(marksLine({ boss: 'Valkynaz Ruhn', md: gateModsOf(day) }), 'Valkynaz Ruhn comes the Rime-Wrought tonight, Colossal and Unyielding.', 'WB13b: by name - the card says what each does');
  assert.equal(marksLine({ boss: 'Valkynaz Ruhn', md: ['storm'] }), 'Valkynaz Ruhn comes the Storm-Crowned tonight.');
  assert.equal(marksLine({ boss: 'Valkynaz Ruhn', md: ['venom', 'grudge', 'echoing', 'legion'] }), 'Valkynaz Ruhn comes the Venom-Blooded tonight, Grudge-Bearer, Echoing and Legion-Lord.');
  const c = { site: { place: 'Copperham, Wrothgarian Mountains' }, phase: 'open', t: { day } };
  assert.deepEqual(gateTip(c, { to: 'seal', ms: 60_000 }), { title: 'Dagon\'s Breach', lines: ['Near Copperham, Wrothgarian Mountains', 'Open - seals in 1:00', 'Valkynaz Ruhn, Warden of the Burning Gate', 'The Rime-Wrought - Colossal, Unyielding'] });
  assert.deepEqual(gateTip(c, null, 123).lines.at(-1), 'Valkynaz Ruhn has fallen', 'no marks once he has fallen');
  const post = omenPost({ day }).content;
  assert.ok(post.endsWith('. The faithful work their rite nearby. Kill their Summoner before the breach opens. Valkynaz Ruhn comes **the Rime-Wrought** tonight, Colossal and Unyielding.'), post);   // WB12d: the rite, a line
  assert.ok(post.length < 2000);
  assert.ok(gateTimes(day).omenAt < gateTimes(day).openAt);
});

// ═══ THE FOLD AND THE SEAMS ══════════════════════════════════════════════════════════════════════════════════════

test('WB8c the fold: a state says his marks; a feeding moves his health and names the fed; a state of the same fight keeps the feeding heard, another fight\'s forgets it (mutants: the marks dropped; the feeding lost at the next state)', () => {
  const st = { k: 'st', d: 9, b: 'ruhn', ph: 1, h: 50, m: 100, x: 0, z: 0, yw: 0, mv: null, atk: null, sh: 0, wr: 5, n: 1, fell: null, wrath: null, md: ['venom', 'soulhungry'] };
  let s = foldGate(GATE_STATE_EMPTY, st, 1);
  assert.deepEqual(s.md, ['venom', 'soulhungry']); assert.equal(s.fed, null);
  s = foldGate(s, { k: 'fed', ns: ['Bran'], h: 53, m: 100, at: 77 }, 2);
  assert.deepEqual([s.hp, s.max, s.fed], [53, 100, { ns: ['Bran'], at: 77 }]);
  s = foldGate(s, { ...st, h: 53 }, 3);
  assert.deepEqual(s.fed, { ns: ['Bran'], at: 77 }, 'the same fight keeps what was heard');
  assert.equal(foldGate(s, { ...st, d: 10 }, 4).fed, null, 'another fight forgets it');
  assert.equal(foldGate(GATE_STATE_EMPTY, { k: 'fed', ns: ['Bran'], h: 1, m: 2, at: 3 }, 5), GATE_STATE_EMPTY, 'nothing but a whole state starts a fight');
  assert.equal(foldGate(GATE_STATE_EMPTY, { ...st, md: null }, 1).md, null);
});

test('WB8c the seams, by source: the relay births each fight on the day\'s marks; the world host asks the court\'s throw for any element; the dungeon context lands his frost, lightning and venom unflashed in each element\'s cast; the court judges, burns, cues, draws and bars under the fight\'s profile (mutants: each seam removed)', () => {
  const relay = read('server/src/index.js');
  assert.match(relay, /newFight\(day, now, gateTimes\(day\)\.wrathAt, gateBossOf\(day\)\.id, gateModsOf\(day\)\)/);
  const w = read('src/scenes/world.js');
  assert.match(w, /save: \(e, el = 'fire'\) => \{ const w = GATE_SAVES\[el\] \?\? GATE_SAVES\.fire; return savingThrow\(w\[0\], w\[1\], e\); \},/);
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /const GATE_STRIKE_CAST = Object\.freeze\(\{ frost: SPELL_CAST_SOUND\[1\], poison: SPELL_CAST_SOUND\[2\], shock: SPELL_CAST_SOUND\[3\], magic: SPELL_CAST_SOUND\[4\] \}\);/);   // SD18b (PIN MOVED): the Underking's magic beside them
  const gc = read('src/scenes/gateCourt.js');
  assert.match(gc, /const P = profileOf\(s\);   \/\/ WB8b: the fight's marks, as law/);
  assert.match(gc, /judge\(s, t, P\);/); assert.match(gc, /burn\(s, t, P\);/); assert.match(gc, /cue\(s, t, P\);/); assert.match(gc, /drawBody\(s, t, P\);/);
  assert.match(gc, /shape = s\.fell \? null : telegraphShape\(s\.atk, s\.phase, t, P\);/);
  assert.match(gc, /poolDraw = pools\.length \? poolShapes\(pools, t, poolColor\(P\), TELEGRAPH_STYLE\[P\.el\] \?\? TELEGRAPH_STYLE\.fire\) : NONE;/);   // WB9e: in his ground's own grain
  assert.match(gc, /const w = sz\.w \* body\.scale \* P\.size, h = sz\.h \* body\.scale \* P\.size;/);
  assert.match(read('src/ui/enhancedPlusStyle.js'), /body \.wb-boss-marks \{/);   // WB9a: the marks' row under his health, dressed where the trials' line was
  assert.ok(windupOf(ATTACKS.meteor, 2) > 0 && COURT_CENTRE.length === 3);
});
