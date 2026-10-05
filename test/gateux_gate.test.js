// GATE-UX (2026-10-01, Mac: "1. In the oblivion boss gate, move the modifer panel that shows away from center of the
// screen, it's obstructive 2. Remove the text below each boss health bar that shows phase details 3. Loot at the end can
// still be walked over and picked up 4. Develop a detailed damage chart after the boss kill, showing and ranking
// everyone's damage"): THE COURT, LESS IN THE WAY AND MORE TO READ. The marks' card to the side (ui/gateMarksView.js);
// the bar's foot without its phase line (ui/gateBossBar.js); the spoils taken by the press alone (scenes/spoilsPool.js -
// the walk-over's own pins moved with it: wb5, wb9f, wbx); and THE DAMAGE CHART - counted by the relay's brain
// (net/gateBrain.js damageChart), carried with the kill (net/wire.js `dm`, relay world136), folded (net/gateLink.js) and
// drawn to the side once he has fallen (ui/gateDamageChart.js, scenes/gateCourt.js). Design:
// bible/11-Multiplayer/World-Bosses.md section 16.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MARKS_CARD_CSS } from '../src/ui/gateMarksView.js';
import { BOSS_BAR_CSS, BOSS_BAR_TOP, bossBarModel, drawGateBossBar, destroyGateBossBar, BOSS_BAR_TEXT } from '../src/ui/gateBossBar.js';
import { PHASE_NAMES, newFight, joinFight, applyHit, applyCrystalHit, stepBrain, stateOf, damageChart, topDealers, DAMAGE_CHART_MAX, HIT_KINDS, COURTS, GATE_FIGHTERS_MAX, ATTACKS } from '../src/net/gateBrain.js';
import { validGateOut, GATE_CHART_MAX, GATE_TOP_MAX, RELAY_VERSION } from '../src/net/wire.js';
import { foldGate, createGateLink, GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import {
  damageChartModel, drawGateDamageChart, destroyGateDamageChart, chartNumber, chartShare,
  DAMAGE_CHART_DELAY_MS, DAMAGE_CHART_MS, DAMAGE_CHART_FADE_MS, DAMAGE_CHART_ROWS, DAMAGE_CHART_TEXT, DAMAGE_CHART_CSS,
} from '../src/ui/gateDamageChart.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000;
const BOSS = { name: 'Valkynaz Ruhn', title: 'Warden of the Burning Gate' };

/** A document of plain objects: nodes that remember what was written to them (test/wb9a_gate_marks_seen.test.js's). */
function fakeDoc() {
  const made = [];
  const node = (tag) => {
    const n = { tag, style: {}, className: '', textContent: '', children: [], attrs: {}, append(...c) { this.children.push(...c); }, remove() { this.gone = true; }, setAttribute(k, v) { this.attrs[k] = v; } };
    made.push(n);
    return n;
  };
  const styles = [];
  return { made, styles, doc: { createElement: node, body: node('body'), head: { append: (s) => styles.push(s) }, getElementById: (id) => styles.find((s) => s.id === id) ?? null } };
}
/** A fight of `n` challengers at level 10, its first court, the opening over and every purse deep. */
function fightOf(n = 3) {
  const f = newFight(9, T0, T0 + 3_600_000, 'ruhn');
  for (let i = 0; i < n; i++) assert.ok(joinFight(f, `s${i + 1}`, `P${i + 1}`, 10, T0, true));
  f.shieldUntil = 0;
  for (const p of Object.values(f.players)) { p.bucket = 1e9; p.rate = 4; }
  return f;
}
const C1 = COURTS[0];
const near = { x: C1[0] + 2, z: C1[1] + 2 };
/** A blow landed whole: the purse and the rate refilled first, so the caps never decide it here. */
function blow(f, sub, d, t) { const p = f.players[sub]; p.bucket = 1e9; p.rate = 4; return applyHit(f, sub, d, HIT_KINDS.Spell, near, t); }

// ═══ 1. THE MARKS' CARD, TO THE SIDE ═══════════════════════════════════════════════════════════════════════════════

test('GATE-UX 1 the marks\' card as a fighter steps in stands low on the right, never over the middle of the screen; by the gate it keeps its own side place (mutants: the card centred again; the gate\'s place moved)', () => {
  const arrive = /\.wb-marks-card\.wb-marks-arrive \{([^}]*)\}/.exec(MARKS_CARD_CSS)?.[1];
  assert.ok(arrive, 'the arrive mode has its own place');
  assert.match(arrive, /right: 18px;/);
  assert.match(arrive, /bottom: max\(96px, 14vh\);/);
  assert.doesNotMatch(arrive, /left: 50%|translateX\(-50%\)|top:/, 'not centred, not hung from the top');
  assert.match(MARKS_CARD_CSS, /\.wb-marks-card\.wb-marks-gate \{ right: 18px; top: 104px; width: 340px; \}/, 'by the gate: as it was');
  assert.match(read('src/ui/enhancedPlusStyle.js'), /body \.wb-marks-card \{/, 'Plus dresses it, and places it nowhere else');
  assert.doesNotMatch(/body \.wb-marks-card \{[^}]*\}/.exec(read('src/ui/enhancedPlusStyle.js'))[0], /left:|top:|transform:/);
});

// ═══ 2. THE BAR'S FOOT WITHOUT ITS PHASE LINE ══════════════════════════════════════════════════════════════════════

test('GATE-UX 2 under his health no phase is said - the foot says the court\'s fighters, the next Reckoning and the Wrath as before; a turn is still said over the screen as it comes (mutants: the phase line back in the foot; the fighters lost with it)', () => {
  const s = { ...GATE_STATE_EMPTY, day: 9, boss: 'ruhn', phase: 2, hp: 500, max: 1000, fighters: 3, wrathAt: T0 + 3_600_000 };
  const m = bossBarModel(s, T0, BOSS);
  assert.equal('phaseName' in m, false);
  assert.equal(BOSS_BAR_TEXT.phase, undefined);
  const { doc } = fakeDoc();
  destroyGateBossBar();
  drawGateBossBar(m, { doc });
  const root = doc.body.children[0];
  const foot = root.children.find((c) => c.className === 'wb-boss-foot');
  const said = () => foot.children.filter((c) => c.style.display !== 'none').map((c) => c.textContent);   // WB13c: a chip each
  assert.deepEqual(said(), [BOSS_BAR_TEXT.fighters(3)], 'the fighters alone');
  for (const n of PHASE_NAMES) assert.equal(foot.children.some((c) => c.textContent.includes(n)), false, `"${n}" not said under his health`);
  const late = bossBarModel({ ...s, phase: 3, rk: T0 + 42_000, wrathAt: T0 + 61_000 }, T0, BOSS);
  drawGateBossBar(late, { doc });
  assert.deepEqual(said(), [BOSS_BAR_TEXT.fighters(3), BOSS_BAR_TEXT.reckonIn('0:42'), BOSS_BAR_TEXT.wrathIn('1:01')], 'the countdowns kept');
  destroyGateBossBar();
  assert.match(read('src/scenes/gateCourt.js'), /const c = courtPhaseCard\(s\.phase\); if \(c\) beat = \{ kind: 'phase', at: t, until: t \+ TITLE_HOLD_MS, \.\.\.c \};/, 'the turn shown as it comes (WB13e: its card)');
  assert.equal(BOSS_BAR_TOP, '58px');
  assert.match(BOSS_BAR_CSS, /\.wb-boss-foot \{/);
});

// ═══ 3. THE SPOILS BY THE PRESS ALONE (the walk-over's pins: wb5, wb9f, wbx) ═══════════════════════════════════════

test('GATE-UX 3 the pool asks for no feet and takes nothing underfoot; the host hands it none; the press is its one hand (mutants: the walk-over back; the host still wiring feet)', () => {
  const pool = read('src/scenes/spoilsPool.js');
  assert.doesNotMatch(pool, /export const SPOILS_TAKE_|const f0 = feet\(\)|feet = \(\) => null|takeOne\(f\);\n\s*\}\);\n\s*\},/);
  assert.match(pool, /pick\(key\) \{ const f = pieceAt\(key\); if \(!f\) return false; takeOne\(f\); return true; \}/);
  const w = read('src/scenes/world.js');
  const made = /const spoilsPool = createSpoilsPool\(\{[\s\S]*?\n {2}\}\);/.exec(w)?.[0];
  assert.ok(made);
  assert.doesNotMatch(made, /feet:/, 'the host hands the pool no feet');
  assert.match(w, /takeSpoil: \(key\) => !!spoilsPool\?\.pick\(key\),/, 'the press reaches it');
});

// ═══ 4. THE DAMAGE CHART ═══════════════════════════════════════════════════════════════════════════════════════════

test('GATE-UX 4 the brain counts each fighter\'s part: the blows that landed on him and the heaviest, what went into the crystals apart, and each fall once - a fall again only after standing up alive (mutants: a refused blow counted; a fall every beat it lies; the crystals not split out)', () => {
  const f = fightOf(2);
  assert.deepEqual(['cxd', 'hits', 'best', 'falls', 'down'].map((k) => f.players.s1[k]), [0, 0, 0, 0, false], 'a newcomer starts at nothing');
  assert.equal(blow(f, 's1', 30, T0 + 1000), 30);
  assert.equal(blow(f, 's1', 80, T0 + 2000), 80);
  assert.equal(blow(f, 's1', 12, T0 + 3000), 12);
  assert.equal(applyHit(f, 's1', 50, HIT_KINDS.Spell, null, T0 + 4000), 0, 'a blow with no pose is refused');
  assert.deepEqual([f.players.s1.hits, f.players.s1.best, f.players.s1.dealt], [3, 80, 122], 'three landed, the heaviest 80');
  // the crystals: counted as dealt, and apart
  const g = fightOf(1);
  g.atk = { i: 5, a: ATTACKS.reckon.id, at: T0 + 30_000, x: C1[0], z: C1[1], yw: 0, tg: [] };   // a Reckoning winding up
  g.cx = { i: 5, m: 1000, c: [{ x: near.x, z: near.z, h: 1000 }] };
  applyCrystalHit(g, 's1', 0, 40, HIT_KINDS.Spell, near, T0 + 1000);
  assert.deepEqual([g.players.s1.cxd, g.players.s1.dealt, g.players.s1.hits], [40, 40, 0], 'a crystal is dealt, not a blow on him');
  // the falls: once a fall, however many beats it lies; again after standing up
  const h = fightOf(1);
  const at = (dead) => [{ sub: 's1', x: near.x, z: near.z, dead }];
  let t = T0;
  for (const dead of [false, true, true, true, false, false, true, true]) stepBrain(h, (t += 250), at(dead), () => 0.5);
  assert.equal(h.players.s1.falls, 2);
  // a fight checkpointed before the chart reads its missing counts as none
  const old = fightOf(1);
  for (const k of ['cxd', 'hits', 'best', 'falls', 'down']) delete old.players.s1[k];
  assert.equal(blow(old, 's1', 7, T0 + 1000), 7);
  assert.deepEqual([old.players.s1.hits, old.players.s1.best], [1, 7]);
  stepBrain(old, T0 + 2000, at(true), () => 0.5);
  assert.equal(old.players.s1.falls, 1);
});

test('GATE-UX 4 the chart at the kill: every fighter with a part, most dealt first (ties by the earlier to join - topDealers\' own order), whole numbers, at most DAMAGE_CHART_MAX rows; on the fall, the court\'s word and the state (mutants: unranked; a fighter with no part listed; the chart missing from the state)', () => {
  const f = fightOf(4);
  joinFight(f, 'idle', 'Idle', 10, T0, true);   // joined and did nothing - no part, no row
  f.players.s2.stoodMs = 5000;   // stood and dealt nothing: a part
  blow(f, 's3', 20.4, T0 + 1000);
  blow(f, 's1', 60, T0 + 1500);
  blow(f, 's4', 60, T0 + 2000);   // ties s1 - s1 joined first
  f.players.s4.falls = 2;
  f.hp = 15;
  assert.equal(blow(f, 's3', 40, T0 + 3000), 15, 'the last blow takes what is left');
  assert.ok(f.fell, 'he has fallen');
  const dm = f.fell.dm;
  assert.deepEqual(dm.map((r) => r.n), ['P1', 'P4', 'P3', 'P2'], 'ranked, the idle left out');
  assert.deepEqual(dm[0], { n: 'P1', l: 10, d: 60, x: 0, h: 1, b: 60, f: 0 });
  assert.deepEqual(dm[2], { n: 'P3', l: 10, d: 35, x: 0, h: 2, b: 20, f: 0 }, 'whole numbers - 20.4 + 15 says 35, its best 20');
  assert.equal(dm[1].f, 2);
  assert.deepEqual(dm[3], { n: 'P2', l: 10, d: 0, x: 0, h: 0, b: 0, f: 0 });
  assert.deepEqual(f.fell.top, topDealers(f, 3));
  assert.deepEqual(stateOf(f).fell, { at: f.fell.at, top: f.fell.top, n: f.fell.n, dm }, 'a late door and a reconnect are told it');
  assert.deepEqual(damageChart(f), dm, 'one law');
  // the cap
  const big = newFight(9, T0, T0 + 3_600_000, 'ruhn');
  for (let i = 0; i < DAMAGE_CHART_MAX + 8; i++) { joinFight(big, `b${i}`, `B${i}`, 10, T0, true); big.players[`b${i}`].dealt = 1000 - i; }
  const rows = damageChart(big);
  assert.equal(rows.length, DAMAGE_CHART_MAX);
  assert.equal(rows[0].n, 'B0'); assert.equal(rows.at(-1).n, `B${DAMAGE_CHART_MAX - 1}`);
  assert.equal(DAMAGE_CHART_MAX, GATE_CHART_MAX, 'the wire\'s bound is the brain\'s');
  assert.ok(GATE_CHART_MAX <= GATE_FIGHTERS_MAX && GATE_CHART_MAX > GATE_TOP_MAX);
  // the relay fans it with the kill, and tells the hub the names alone
  const relay = read('server/src/index.js');
  assert.match(relay, /this\._gateFan\(\[\{ k: 'fell', at: f\.fell\.at, top: f\.fell\.top, n: f\.fell\.n, \.\.\.\(f\.fell\.dm \? \{ dm: f\.fell\.dm \} : \{\}\) \}\]\);/);
  assert.match(relay, /_gateTellHub\(\{ d: f\.day, at: f\.fell\.at, top: f\.fell\.top, n: f\.fell\.n, rc:/, 'the hub\'s word carries no chart');
  assert.equal(RELAY_VERSION, 'world170');   // FEUD moved it on last (world170: the foe record's wind-ups, staggers and blow classes and a revenant's adaptations, weakness, last stand, band follower, blows and signature - TELL8, AUDIT TELL, RVN13 and FEUD WIRE, world162-world165 on its branch, renumbered past main's world169 at its merge); AUDIT ARENA-LADDER moved it on (world169: the arena ladder audit - elite champions, telegraphed blows, a judging floor and the attempt ticket - world167 on its branch, renumbered past SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (world168: the Seraph Wings join the aura vocabulary of the token - a relay before it refuses the token of a developer wearing them); SHADOW-CLOAK moved it on (world167: the Holo Shadow Cloak joins the token's aura vocabulary - a relay before it refuses SirMcMobdon's token once they wear it; world165 on its branch, renumbered past SERPENT1 and SERPENT2 at the merges); SERPENT2 moved it on (world166: the serpent herald - a serpent site word to the hub, its bells and its kill posted to Discord); SERPENT1 moved it on (world165: the serpent frame - a sea serpent fight in the cell of its site; world162 on its branch, renumbered past PRIMARCH (world162) and SUNBABY1 (world163), then PARTY-LEAD (world164), at the merges); PARTY-LEAD moved it on (world164: the hub's party.lead act - a leader hands the lead to a member); SUNBABY1 moved it on (world163: the hub's live events gain the sun baby's word - LIVE_EVENTS, no frame changes shape); PRIMARCH moved it on (world162: the Primarch's title and glyph and the Golden Radiance's aura join the token's vocabulary - a relay before it refuses GA00250's token); GUILD2 moved it on (world161: no wire change - the guild and heraldry laws moved under the relay); AEGIS moved it on (world160: the Aegis of Oblivion's title and glyph and the Oblivion Ward's aura join the token's vocabulary - a relay before it refuses Sureme's token); ARENA4 moved it on (world155: the arena rooms - the hall queue, the refereed bouts, the stands - and the arena titles and laurel on the token - world142 on its branch, renumbered past main's FRIENDS-SYNC, ELITE FOES, the Seats arc, WB12, GLYPH-WEAR, REVENANT-WIRE and BROKER-CAGE (world142-world154) at the merge); BROKER-CAGE moved it on (world154: the rite word says every one of the faithful fell, and the hub says the Broker cage open); REVENANT-WIRE moved it on (world153: the foe record carries a revenant's name, nm, and a beaten one's kneel, burning and oath, yd/ex/sp); GLYPH-WEAR moved it on (world152); WB12 moved it on (world151: Dagon's Breach - its words in the omen's lines and the herald's posts, the faithful's rite - main's CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and the Seats arc took world141-world150 first); before it SEAT2b part two (b) moved it on (world150: the works in battle); SEASON1 part two, the banner ribbon moved it on (world149: the banner ribbon - the Seats arc's six relays renumbered past main's HERALD, LOOT7, WB11 and CLIMB5 (world138-world141) at the merge); CROWN1 part two moved it on (world148: the Royal Tourney); SEAT2a moved it on (world147: the siege battle); PVP-REF moved it on (world146: the refereed siege room), SEAT1c (world145) and SEAT1b (world144) before it - the Seats arc's, past main's; ELITE FOES moved it on (world143: the foe record carries an elite foe, z, so a puppet stands as one); before it FRIENDS-SYNC moved it on (world142: the hub account is the signed-in player - the token subject - and a browser profile list is merged into it once); before it CLIMB5 and CLIMB6 moved it on (world141: the pose's climb - `cl`, `cw` and a move's `ck`, `cy`, `cd`); before it WB11 moved it on (world140: the Legion-Lord's host, and the chart row's `a`; GATE-HEAL's `heal` and a chart row's `hl` with it - main's HERALD and LOOT7 took world138 and world139 first); before it LOOT7 moved it on (world139: the street foe record field `cp`, a champion trait - HERALD took world138 first); before it HERALD moved it on (world138: `herald` joins the titles and glyphs a token carries, the Patreon tier between Disciple and Hierophant); before it KEPT-KILL moved it on (world137: the party pose field `qk`); GATE-UX's chart rides from world136
});

test('GATE-UX 4 the chart on the wire: each row a name and its whole numbers, most dealt first, at most GATE_CHART_MAX; names cleaned; anything malformed is no chart - and never costs the kill its word (mutants: a junk chart taken; the fall dropped with a bad chart)', () => {
  const row = (n, d, o = {}) => ({ n, l: 10, d, x: 0, h: 3, b: Math.min(d, 9), f: 0, ...o });
  const dm = [row('Ann', 300, { x: 40 }), row('Bran', 120), row('Cy', 0, { h: 0, b: 0, f: 2 })];
  const fell = validGateOut({ k: 'fell', at: T0, top: ['Ann', 'Bran'], n: 3, dm });
  assert.deepEqual(fell, { k: 'fell', at: T0, top: ['Ann', 'Bran'], n: 3, dm });
  assert.deepEqual(validGateOut({ k: 'fell', at: T0, top: [], n: 1 }), { k: 'fell', at: T0, top: [], n: 1 }, 'no chart: the fall as it always was');
  assert.equal(validGateOut({ k: 'fell', at: T0, top: [], n: 3, dm: [row('A\u0007nn', 5)] }).dm[0].n, 'Ann', 'a name cleaned as every name is');
  for (const [why, bad] of [
    ['unranked', [row('A', 10), row('B', 20)]],
    ['too many', Array.from({ length: GATE_CHART_MAX + 1 }, (_, i) => row(`N${i}`, 1000 - i))],
    ['a fraction', [row('A', 10.5)]],
    ['the crystals past the whole', [row('A', 10, { x: 11 })]],
    ['a best past the whole', [row('A', 10, { b: 11 })]],
    ['no name', [{ ...row('A', 10), n: 5 }]],
    ['a level of nothing', [row('A', 10, { l: 0 })]],
    ['a negative fall', [row('A', 10, { f: -1 })]],
    ['not a list', { 0: row('A', 10) }],
  ]) {
    const out = validGateOut({ k: 'fell', at: T0, top: ['A'], n: 2, dm: bad });
    assert.ok(out, `${why}: the fall kept`);
    assert.equal('dm' in out, false, `${why}: no chart`);
  }
  assert.equal(validGateOut({ k: 'fell', at: T0, top: [], n: 2, dm: [] }).dm.length, 0, 'an empty chart is a chart of no one');
  // the state's fall carries it too
  const st = { k: 'st', d: 9, b: 'ruhn', ph: 3, h: 0, m: 1000, x: 0, z: 0, yw: 0, mv: null, atk: null, sh: 0, wr: T0 + 3_600_000, n: 3, fell: { at: T0, top: ['Ann'], n: 3, dm }, wrath: null };
  assert.deepEqual(validGateOut(st).fell, { at: T0, top: ['Ann'], n: 3, dm });
});

test('GATE-UX 4 the fold keeps the chart with the fall - and takes it from the court\'s word when the hub\'s chartless echo came first; another day\'s word is not this fight\'s (mutants: the chart dropped in the fold; the echo\'s nothing kept over the court\'s chart)', () => {
  const dm = [{ n: 'Ann', l: 10, d: 300, x: 0, h: 3, b: 120, f: 0 }];
  const s = { ...GATE_STATE_EMPTY, day: 9, boss: 'ruhn', hp: 10, max: 1000 };
  const a = foldGate(s, { k: 'fell', at: T0, top: ['Ann'], n: 1, dm }, T0, () => [0, 0]);
  assert.deepEqual(a.fell, { at: T0, top: ['Ann'], n: 1, dm });
  const echo = foldGate(s, { k: 'fell', d: 9, at: T0, top: ['Ann'], n: 1 }, T0, () => [0, 0]);
  assert.equal(echo.fell.dm, undefined);
  const after = foldGate(echo, { k: 'fell', at: T0, top: ['Ann'], n: 1, dm }, T0 + 5, () => [0, 0]);
  assert.deepEqual(after.fell.dm, dm, 'the court\'s chart, after the hub\'s word');
  assert.equal(foldGate(a, { k: 'fell', d: 9, at: T0, top: ['Ann'], n: 1 }, T0 + 9, () => [0, 0]).fell.dm, dm, 'an echo never takes it away');
  assert.equal(foldGate(s, { k: 'fell', d: 8, at: T0, top: [], n: 1, dm }, T0, () => [0, 0]).fell, null, 'another day\'s kill');
  const link = createGateLink({ now: () => T0 });
  link.word({ k: 'st', d: 9, b: 'ruhn', ph: 3, h: 0, m: 1000, x: 0, z: 0, yw: 0, mv: null, atk: null, sh: 0, wr: T0 + 3_600_000, n: 1, fell: { at: T0, top: ['Ann'], n: 1, dm }, wrath: null, md: null, ct: 0, xa: [], cx: null, su: 0, rk: 0 });
  assert.deepEqual(link.state().fell.dm, dm, 'a whole state brings it');
});

const DM = (n, o = {}) => Array.from({ length: n }, (_, i) => ({ n: `P${i + 1}`, l: 10 + i, d: (n - i) * 1000, x: i === 0 ? 400 : 0, h: 20 - i, b: 900 - i, f: i % 3, ...o }));

test('GATE-UX 4 the chart\'s clock: from DAMAGE_CHART_DELAY_MS after the fall was seen, DAMAGE_CHART_MS long, in over a quarter second and out over its last DAMAGE_CHART_FADE_MS; none without a chart (mutants: over the fall itself; for ever; no fade)', () => {
  const fell = { at: 0, top: [], n: 3, dm: DM(3) };
  assert.equal(damageChartModel(null, { since: 0, now: 5000 }), null);
  assert.equal(damageChartModel({ ...fell, dm: [] }, { since: 0, now: 5000 }), null, 'a chart of no one shows nothing');
  assert.equal(damageChartModel({ at: 0, top: ['A'], n: 1 }, { since: 0, now: 5000 }), null, 'an older relay\'s fall: nothing');
  assert.equal(damageChartModel(fell, { since: 1000, now: 1000 + DAMAGE_CHART_DELAY_MS - 1 }), null, 'his fall first');
  assert.equal(damageChartModel(fell, { since: 1000, now: 1000 + DAMAGE_CHART_DELAY_MS + 125 }).alpha, 0.5);
  assert.equal(damageChartModel(fell, { since: 1000, now: 1000 + DAMAGE_CHART_DELAY_MS + 10_000 }).alpha, 1);
  assert.equal(damageChartModel(fell, { since: 1000, now: 1000 + DAMAGE_CHART_DELAY_MS + DAMAGE_CHART_MS - DAMAGE_CHART_FADE_MS / 2 }).alpha, 0.5);
  assert.equal(damageChartModel(fell, { since: 1000, now: 1000 + DAMAGE_CHART_DELAY_MS + DAMAGE_CHART_MS }), null, 'gone');
  assert.ok(DAMAGE_CHART_MS >= 30_000, 'long enough to read the court\'s every row');
});

test('GATE-UX 4 the chart\'s rows: ranked as the relay ranked them, each bar against the most dealt, each share of the whole, the numbers grouped; my row marked in words; under the first DAMAGE_CHART_ROWS my own at my rank, and the rest counted (mutants: the bar against the whole; my row lost past the tenth; the count off by mine)', () => {
  const base = { since: 0, now: DAMAGE_CHART_DELAY_MS + 5000 };
  const three = damageChartModel({ at: 0, top: [], n: 3, dm: DM(3) }, { ...base, boss: BOSS.name, me: 'p2' });
  assert.equal(three.title, DAMAGE_CHART_TEXT.title);
  assert.equal(three.sub, `${BOSS.name} has fallen - 3 challengers`);
  assert.deepEqual(three.rows.map((r) => [r.rank, r.name, r.damage, r.frac, r.share]), [[1, 'P1', '3,000', 1, '50%'], [2, 'P2', '2,000', 2 / 3, '33%'], [3, 'P3', '1,000', 1 / 3, '17%']]);
  assert.deepEqual([three.rows[0].level, three.rows[0].crystals, three.rows[0].blows, three.rows[0].best, three.rows[2].falls], ['Lv 10', '400', '20', '900', '2']);
  assert.deepEqual(three.rows.map((r) => r.mine), [false, true, false], 'mine by my name, any case');
  assert.equal(three.mine, null); assert.equal(three.more, '');
  assert.deepEqual(three.head, ['#', 'Challenger', 'Damage', 'Share', 'Blows', 'Best', 'Crystals', 'Falls']);
  // a big court: my row under the first ten at my rank; the rest counted
  const big = damageChartModel({ at: 0, top: [], n: 40, dm: DM(GATE_CHART_MAX) }, { ...base, me: 'P17' });
  assert.equal(big.rows.length, DAMAGE_CHART_ROWS);
  assert.deepEqual([big.mine.rank, big.mine.name, big.mine.mine], [17, 'P17', true]);
  assert.equal(big.more, DAMAGE_CHART_TEXT.more(40 - DAMAGE_CHART_ROWS - 1));
  const notMe = damageChartModel({ at: 0, top: [], n: 12, dm: DM(12) }, { ...base, me: 'Nobody' });
  assert.equal(notMe.mine, null); assert.equal(notMe.more, DAMAGE_CHART_TEXT.more(2));
  assert.equal(damageChartModel({ at: 0, top: [], n: 1, dm: DM(1) }, base).sub, 'The Warden has fallen - 1 challenger');
  // the words of a number
  assert.deepEqual([0, 7, 999, 1000, 1234567, -3, NaN, 12.6].map(chartNumber), ['0', '7', '999', '1,000', '1,234,567', '0', '0', '13']);
  assert.deepEqual([chartShare(1, 3), chartShare(1, 400), chartShare(0, 10), chartShare(5, 0), chartShare(10, 10)], ['33%', '<1%', '0%', '0%', '100%']);
  // a chart of nothing dealt: every bar empty, no division by nothing
  const none = damageChartModel({ at: 0, top: [], n: 2, dm: DM(2, { d: 0, x: 0, b: 0 }) }, base);
  assert.deepEqual(none.rows.map((r) => [r.frac, r.share]), [[0, '0%'], [0, '0%']]);
});

test('GATE-UX 4 the chart\'s node: made once, its rows written when the chart changes (never a frame), my row ringed and said, hidden with the HUD; to the side, never the middle; its sheet once and dressed under Plus (mutants: rebuilt; centred; a class undressed)', () => {
  const { made, styles, doc } = fakeDoc();
  destroyGateDamageChart();
  drawGateDamageChart(null, { doc });
  assert.equal(made.length, 1, 'nothing made for nothing');
  const m = damageChartModel({ at: 0, top: [], n: 14, dm: DM(14) }, { since: 0, now: DAMAGE_CHART_DELAY_MS + 3000, boss: BOSS.name, me: 'P12' });
  drawGateDamageChart(m, { doc });
  const count = made.length;
  const root = doc.body.children[0];
  assert.equal(root.className, 'wb-dmg-chart');
  assert.equal(root.attrs['aria-hidden'], 'true');
  const [title, sub, head, ...rest] = root.children;
  assert.equal(title.textContent, 'Damage Dealt');
  assert.equal(sub.textContent, `${BOSS.name} has fallen - 14 challengers`);
  assert.deepEqual(head.children.map((c) => c.textContent), [...DAMAGE_CHART_TEXT.head, '', ''], 'WB11c: and the host\'s cell, empty (and hidden) outside a Legion-Lord\'s court; GATE-HEAL: and the healed\'s, in a court nobody healed in');
  const rows = rest.slice(0, DAMAGE_CHART_ROWS), [gap, mine, more] = rest.slice(DAMAGE_CHART_ROWS);
  const cells = (r) => r.children.map((c, i) => (i === 1 ? c.children[0].children.map((x) => x.textContent).join('|') : c.textContent));
  assert.deepEqual(cells(rows[0]), ['1', 'P1|Lv 10|', '14,000', '13%', '20', '900', '400', '0', '', '']);
  assert.equal(rows[0].children[1].children[1].children[0].style.width, '100.0%', 'the most dealt fills its bar');
  assert.equal(rows[1].children[1].children[1].children[0].style.width, `${((13 / 14) * 100).toFixed(1)}%`);
  assert.equal(gap.style.display, '');
  assert.deepEqual(cells(mine), ['12', 'P12|Lv 21|(you)', '3,000', '3%', '9', '889', '0', '2', '', '']);
  assert.equal(mine.className, 'wb-dmg-row wb-dmg-mine');
  assert.equal(more.textContent, DAMAGE_CHART_TEXT.more(14 - DAMAGE_CHART_ROWS - 1));
  const before = rows.map((r) => r.children[2].textContent);
  rows[0].children[2].textContent = 'scribbled';
  drawGateDamageChart({ ...m, alpha: 0.4 }, { doc });
  assert.equal(made.length, count, 'updated, not rebuilt');
  assert.equal(rows[0].children[2].textContent, 'scribbled', 'the same chart is not written again');
  assert.equal(root.style.opacity, '0.4');
  // a short chart hides the rows it has no one for, and the gap and the count
  const short = damageChartModel({ at: 0, top: [], n: 2, dm: DM(2) }, { since: 0, now: DAMAGE_CHART_DELAY_MS + 3000, me: 'P1' });
  drawGateDamageChart(short, { doc });
  assert.deepEqual(rows.map((r) => r.style.display), ['', '', ...Array(DAMAGE_CHART_ROWS - 2).fill('none')]);
  assert.equal(rows[0].className, 'wb-dmg-row wb-dmg-mine');
  assert.deepEqual([gap.style.display, mine.style.display, more.style.display], ['none', 'none', 'none']);
  void before;
  drawGateDamageChart(short, { doc, hidden: true });
  assert.equal(root.style.display, 'none');
  drawGateDamageChart(short, { doc });
  assert.equal(root.style.display, '');
  assert.equal(styles.filter((s) => s.textContent === DAMAGE_CHART_CSS).length, 1, 'the sheet, once');
  destroyGateDamageChart();
  assert.equal(root.gone, true);
  // the place: to the side, the marks' card's own
  const box = /\.wb-dmg-chart \{([^}]*)\}/.exec(DAMAGE_CHART_CSS)[1];
  assert.match(box, /right: 18px; bottom: max\(96px, 14vh\);/);
  assert.match(box, /pointer-events: none;/, 'a readout: no click');
  assert.doesNotMatch(box, /left: 50%|translateX/);
  const plus = read('src/ui/enhancedPlusStyle.js');
  for (const c of ['wb-dmg-chart', 'wb-dmg-title', 'wb-dmg-sub', 'wb-dmg-head', 'wb-dmg-name', 'wb-dmg-lv', 'wb-dmg-you', 'wb-dmg-num', 'wb-dmg-track', 'wb-dmg-fill', 'wb-dmg-mine', 'wb-dmg-more']) {
    assert.match(DAMAGE_CHART_CSS, new RegExp(`\\.${c} \\{`), c);
    assert.match(plus, new RegExp(`body \\.${c}\\b`), `${c} is dressed under Plus`);
  }
});

test('GATE-UX 4 the seams: the court draws the chart once he has fallen - from when this screen saw it, with my name, hidden with the HUD and under the step\'s fire - and puts it away as I leave; the host hands it my name on the relay and hides it with a held frame (mutants: the chart never drawn; drawn over the veil; left up after the court)', () => {
  const c = read('src/scenes/gateCourt.js');
  assert.match(c, /if \(s\.fell && chartAt === null\) chartAt = t;\n\s*drawGateDamageChart\(chartAt !== null \? damageChartModel\(s\.fell, \{ boss: bossOf\(s\)\.name, me: me\(\), since: chartAt, now: t \}\) : null, \{ hidden: hudHidden\(\) \|\| veiled\(\) \}\);/);
  assert.match(c, /marksSaid = false; fedHeard = null; marksAt = null; chartAt = null;/, 'a new fight (or none) forgets it');
  assert.match(c, /drawGateMarksCard\(null\);   \/\/ WB9a\n\s*drawGateDamageChart\(null\);/, 'gone as I leave');
  const w = read('src/scenes/world.js');
  assert.match(w, /me: \(\) => online\?\.name \?\? null,/);
  assert.match(w, /drawGateMarksCard\(null\); drawGateDamageChart\(null\); drawGateGround\(null\);/);
});
