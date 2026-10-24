// WB13c (2026-10-01, Mac: "just overall bring more AAA grade polish to what is already developed"): THE HUD - his bar
// honed (the trailing segment, the ward a state, callouts that come and go with a line to the landing, Dagon's plate and
// MOVE, the phase marks spent, his name and his epithet on lines of their own, the foot's chips, FELLED and the fade),
// the phone layouts, the party's frames kept clear, the classic face loaded by the gate's own screens (bible/11-Multiplayer/
// World-Bosses.md section 20, WB13c). The map's tap for a finger is pinned with the map's card (test/ui/eventtip.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATTACKS, PHASE_AT } from '../../../src/net/gate/gateBrain.js';
import { GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import {
  bossBarModel, drawGateBossBar, destroyGateBossBar, BOSS_BAR_TEXT, BOSS_BAR_CSS, FELL_HOLD_MS, FELL_FADE_MS, CALLOUT_OUT_MS, INTRO_MS,
  FLASH_MS, WRATH_NEAR_MS,
} from '../../../src/ui/gate/gateBossBar.js';
import { MARKS_CARD_CSS, aspectCss, drawGateMarksCard, destroyGateMarksCard, marksCardModel } from '../../../src/ui/gate/gateMarksView.js';
import { DAMAGE_CHART_CSS, CHART_IN_MS, CHART_ROW_STEP_MS, CHART_FILL_MS, DAMAGE_CHART_ROWS, DAMAGE_CHART_DELAY_MS, damageChartModel, drawGateDamageChart, destroyGateDamageChart } from '../../../src/ui/gate/gateDamageChart.js';
import { drawGateBanner, destroyGateBanner } from '../../../src/ui/gate/gateBanner.js';
import { drawGateGround, destroyGateGround, groundViewModel } from '../../../src/ui/gate/gateGroundView.js';
import { GHOST_HOLD, GHOST_RATE } from '../../../src/ui/barLoss.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000;
const BOSS = { name: 'Valkynaz Ruhn', title: 'Warden of the Burning Gate' };
const state = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 9, boss: 'ruhn', phase: 1, hp: 1000, max: 1000, fighters: 3, wrathAt: T0 + 3_600_000, ...over });
const blow = (A, at, over = {}) => ({ i: 1, a: A.id, at, x: 0, z: 0, yw: 0, tg: [], ...over });

/** A document that keeps what is made of it - the bar's own pins' shape. */
function fakeDoc() {
  const made = [], heads = [];
  const node = (tag) => { const n = { tag, style: {}, className: '', textContent: '', innerHTML: '', id: '', children: [], append(...c) { this.children.push(...c); }, remove() { this.gone = true; }, setAttribute() {} }; made.push(n); return n; };
  const doc = { createElement: node, body: node('body'), head: { append: (s) => heads.push(s) }, getElementById: (id) => heads.find((s) => s.id === id) ?? null };
  return { made, heads, doc };
}
/** The bar's parts by class, from a drawn root. */
function barParts(doc) {
  const root = doc.body.children.find((c) => c.className.startsWith('wb-boss-bar'));
  const [name, sub, track, marks, callout, foot] = root.children;
  const [ghost, fill, ...rest] = track.children;
  return { root, name, sub, track, marks, callout, foot, ghost, fill, ticks: rest.slice(0, PHASE_AT.length), text: callout.children[0], move: callout.children[1], line: callout.children[2] };
}

test('WB13c the bar\'s model: the callout\'s line its wind-up\'s share (full once it lands, none for a stun), Dagon\'s Wrath and Reckoning on a plate, MOVE only for his own blow on my feet; the phase marks spent; the Wrath\'s last minute; FELLED held, then faded (mutants: MOVE for any blow; the plate for his own fire; the fade at once)', () => {
  const at = T0 + 800;   // half the Ground Slam's 1600 ms wind-up to come
  const m = bossBarModel(state({ atk: blow(ATTACKS.slam, at) }), T0, BOSS);
  assert.deepEqual([m.callout.text, m.callout.t, m.callout.dagon, m.callout.move], ['Ground Slam', 0.5, false, false]);
  assert.equal(bossBarModel(state({ atk: blow(ATTACKS.slam, at) }), at + 50, BOSS).callout.t, 1, 'landing: the line full');
  assert.equal(bossBarModel(state({ atk: blow(ATTACKS.slam, at) }), T0, BOSS, 'Ground Slam').callout.move, true, 'his blow named the one on my feet');
  assert.equal(bossBarModel(state({ atk: blow(ATTACKS.slam, at) }), T0, BOSS, 'Bite').callout.move, false, 'a host\'s blow on my feet is not his');
  const wrath = bossBarModel(state({ phase: 3, atk: blow(ATTACKS.wrath, T0 + 3000) }), T0, BOSS);
  assert.equal(wrath.callout.dagon, true, 'Dagon\'s Wrath on his plate');
  const reckon = bossBarModel(state({ phase: 3, atk: blow(ATTACKS.reckon, T0 + 12_000), cx: { c: [[3, 3, 5], [-3, 3, 0]] } }), T0, BOSS);
  assert.deepEqual([reckon.callout.text, reckon.callout.dagon, reckon.callout.move], [BOSS_BAR_TEXT.reckon("Dagon's Reckoning", 1, 2, 12), true, false]);
  assert.ok(reckon.callout.t > 0 && reckon.callout.t < 1);
  const meteor = bossBarModel(state({ phase: 2, atk: blow(ATTACKS.meteor, T0 + 1400) }), T0, BOSS);
  assert.equal(meteor.callout.dagon, false, 'his own fire is his');
  const stun = bossBarModel(state({ phase: 3, stunUntil: T0 + 4200 }), T0, BOSS);
  assert.deepEqual([stun.callout.text, stun.callout.t], [BOSS_BAR_TEXT.stunned(5), null], 'a stun has no landing');
  // the phase marks he has passed
  assert.deepEqual(bossBarModel(state({ phase: 1 }), T0, BOSS).spent, [false, false]);
  assert.deepEqual(bossBarModel(state({ phase: 2 }), T0, BOSS).spent, [true, false]);
  assert.deepEqual(bossBarModel(state({ phase: 3 }), T0, BOSS).spent, [true, true]);
  // the Wrath's countdown, and its last minute
  assert.equal(bossBarModel(state({ wrathAt: T0 + WRATH_NEAR_MS + 1000 }), T0, BOSS).wrathNear, false);
  assert.equal(bossBarModel(state({ wrathAt: T0 + WRATH_NEAR_MS }), T0, BOSS).wrathNear, true);
  assert.equal(bossBarModel(state({ wrathAt: T0 + 30_000, wrath: { at: T0 } }), T0, BOSS).wrathNear, false, 'the Wrath come: no countdown');
  // FELLED, held, then the bar fades - the damage chart has the court
  assert.equal(BOSS_BAR_TEXT.fallen, 'Felled');
  const fell = (since) => bossBarModel(state({ hp: 0, fell: { at: T0, top: [], n: 3 } }), T0 + since, BOSS).alpha;
  assert.deepEqual([fell(0), fell(FELL_HOLD_MS), fell(FELL_HOLD_MS + FELL_FADE_MS / 2), fell(FELL_HOLD_MS + FELL_FADE_MS)], [1, 1, 0.5, 0]);
  assert.equal(bossBarModel(state({ hp: 0, fell: { at: T0, top: [], n: 3 } }), T0, BOSS, 'Ground Slam').callout, null, 'nothing called over his body');
  assert.ok(DAMAGE_CHART_DELAY_MS >= FELL_HOLD_MS && DAMAGE_CHART_DELAY_MS <= FELL_HOLD_MS + FELL_FADE_MS, 'the chart comes as the bar goes');
});

test('WB13c the bar drawn: his name alone, his epithet beneath in his aspect\'s colour (the Warden unmarked: his title); the trailing segment held GHOST_HOLD, then drained at GHOST_RATE by the fight\'s clock; the marks a sign and a name each; the foot a chip each, the Wrath\'s pulsing in its last minute (mutants: the ghost on the fill; the epithet uncoloured; the Wrath never near)', () => {
  const { doc } = fakeDoc();
  destroyGateBossBar();
  const md = ['rime', 'colossal', 'echoing'];
  drawGateBossBar(bossBarModel(state({ md, hp: 900 }), T0, BOSS), { doc });
  const p = barParts(doc);
  assert.deepEqual([p.name.textContent, p.sub.textContent, p.sub.style.color], ['Valkynaz Ruhn', 'The Rime-Wrought', aspectCss('rime')]);
  assert.deepEqual(p.marks.children.map((c) => c.children.length), [1, 1, 1], 'a sign and a name - the card says what each does');
  assert.deepEqual([p.fill.style.width, p.ghost.style.width], ['90.0%', '90.0%']);
  // a blow: the fill drops at once, the segment holds where he was
  drawGateBossBar(bossBarModel(state({ md, hp: 600 }), T0 + 100, BOSS), { doc });
  assert.deepEqual([p.fill.style.width, p.ghost.style.width], ['60.0%', '90.0%']);
  let t = T0 + 100;
  const frame = () => drawGateBossBar(bossBarModel(state({ md, hp: 600 }), (t += 100), BOSS), { doc });   // ten frames a second
  while (t + 100 < T0 + 100 + GHOST_HOLD * 1000) frame();
  assert.equal(p.ghost.style.width, '90.0%', 'held');
  frame(); frame();   // the hold spent, then a frame's drain
  assert.equal(p.ghost.style.width, `${(90 - GHOST_RATE * 0.1).toFixed(1)}%`, 'then drained');
  for (let i = 0; i < 10; i++) drawGateBossBar(bossBarModel(state({ md, hp: 600 }), (t += 100), BOSS), { doc });
  assert.equal(p.ghost.style.width, '60.0%', 'to the fill');
  assert.match(BOSS_BAR_CSS, /\.wb-boss-fill \{[^}]*transition: width 250ms cubic-bezier\(\.2,\.7,\.3,1\)/, 'the drain smooth, never 180 ms steps');
  // the Warden unmarked: his title under his name
  drawGateBossBar(bossBarModel(state({ hp: 600 }), t, BOSS), { doc });
  assert.deepEqual([p.sub.textContent, p.sub.style.color, p.marks.style.display], [BOSS.title, '', 'none']);
  // the foot's chips: the fighters, his host, the next Reckoning, the Wrath - the Wrath's pulsing under a minute
  const tags = () => p.foot.children.map((c) => (c.style.display === 'none' ? '' : c.textContent));
  drawGateBossBar(bossBarModel(state({ phase: 3, rk: t + 42_000, wrathAt: t + 61_000 }), t, BOSS), { doc });
  assert.deepEqual(tags(), [BOSS_BAR_TEXT.fighters(3), '', BOSS_BAR_TEXT.reckonIn('0:42'), BOSS_BAR_TEXT.wrathIn('1:01')]);
  assert.equal(p.foot.children[3].className, 'wb-boss-tag wb-boss-wrath');
  drawGateBossBar(bossBarModel(state({ phase: 3, rk: t + 42_000, wrathAt: t + 59_000 }), t, BOSS), { doc });
  assert.equal(p.foot.children[3].className, 'wb-boss-tag wb-boss-wrath near');
  assert.match(BOSS_BAR_CSS, /\.wb-boss-foot \{[^}]*font-variant-numeric: lining-nums tabular-nums;/, 'the countdowns never jitter');
  destroyGateBossBar();
});

test('WB13c the ward a state - a class, the fill dimmed under it - and its failing flashed for FLASH_MS.wardBreak, once, by the fight\'s clock (the HUD shown again never plays it twice); never at his fall (mutants: the flash held; a flash at his fall)', () => {
  const { doc } = fakeDoc();
  destroyGateBossBar();
  drawGateBossBar(bossBarModel(state({ shieldUntil: T0 + 5000 }), T0, BOSS), { doc });
  const p = barParts(doc);
  assert.equal(p.root.className, 'wb-boss-bar warded intro');
  assert.equal(p.text.textContent, BOSS_BAR_TEXT.warded);
  assert.match(BOSS_BAR_CSS, /\.wb-boss-bar\.warded \.wb-boss-fill \{ filter: saturate\(0\.45\) brightness\(0\.8\); \}/);
  assert.match(BOSS_BAR_CSS, /\.wb-boss-ward \{[^}]*opacity: 0; transform: scale\(1\.04\); transition: opacity 160ms ease-out, transform 160ms ease-out; \}/);
  drawGateBossBar(bossBarModel(state({ shieldUntil: T0 + 5000 }), T0 + INTRO_MS + 1, BOSS), { doc });
  assert.equal(p.root.className, 'wb-boss-bar warded', 'the first showing over');
  drawGateBossBar(bossBarModel(state({ shieldUntil: T0 + 5000 }), T0 + 5000, BOSS), { doc });
  assert.equal(p.root.className, 'wb-boss-bar wbreak', 'it fails');
  drawGateBossBar(bossBarModel(state({ shieldUntil: T0 + 5000 }), T0 + 5000 + FLASH_MS.wardBreak, BOSS), { doc });
  assert.equal(p.root.className, 'wb-boss-bar', 'the flash dropped');
  // his fall takes the ward with it: no flash
  drawGateBossBar(bossBarModel(state({ shieldUntil: T0 + 99_000 }), T0 + 6000, BOSS), { doc });
  drawGateBossBar(bossBarModel(state({ shieldUntil: T0 + 99_000, hp: 0, fell: { at: T0 + 6100, top: [], n: 3 } }), T0 + 6100, BOSS), { doc });
  assert.equal(p.root.className, 'wb-boss-bar');
  assert.equal(p.text.textContent, BOSS_BAR_TEXT.fallen);
  destroyGateBossBar();
});

test('WB13c the callout comes in and goes: a fresh one runs its entrance (a countdown ticking is the same callout), its line filled to its wind-up\'s share; a gone one keeps its words, its plate and its line for CALLOUT_OUT_MS while it fades, then clears; MOVE by its name while his blow is on my feet (mutants: cleared at once; the entrance on every tick; MOVE never shown)', () => {
  const { doc } = fakeDoc();
  destroyGateBossBar();
  const at = T0 + 800;
  drawGateBossBar(bossBarModel(state({ atk: blow(ATTACKS.slam, at) }), T0, BOSS, 'Ground Slam'), { doc });
  const p = barParts(doc);
  assert.deepEqual([p.text.textContent, p.callout.className, p.line.style.transform], ['Ground Slam', 'wb-boss-callout cin aimed', 'scaleX(0.5)']);
  assert.equal(p.move.textContent, BOSS_BAR_TEXT.move);
  drawGateBossBar(bossBarModel(state({ atk: blow(ATTACKS.slam, at) }), T0 + FLASH_MS.callIn, BOSS), { doc });
  assert.deepEqual([p.callout.className, p.line.style.transform], ['wb-boss-callout', 'scaleX(0.6)'], 'its entrance over; I stepped off it');
  drawGateBossBar(bossBarModel(state({ atk: blow(ATTACKS.slam, at) }), at + 50, BOSS), { doc });
  assert.equal(p.line.style.transform, 'scaleX(1)', 'landing: the line full');
  // over: the words held while they fade
  const over = at + ATTACKS.slam.active;
  drawGateBossBar(bossBarModel(state({ atk: blow(ATTACKS.slam, at) }), over, BOSS), { doc });
  assert.deepEqual([p.text.textContent, p.callout.className, p.line.style.transform], ['Ground Slam', 'wb-boss-callout cout', 'scaleX(1)']);
  drawGateBossBar(bossBarModel(state({ atk: blow(ATTACKS.slam, at) }), over + CALLOUT_OUT_MS - 1, BOSS), { doc });
  assert.equal(p.text.textContent, 'Ground Slam', 'held while it fades');
  drawGateBossBar(bossBarModel(state({ atk: blow(ATTACKS.slam, at) }), over + CALLOUT_OUT_MS, BOSS), { doc });
  assert.deepEqual([p.text.textContent, p.callout.className, p.line.style.transform], ['', 'wb-boss-callout', 'scaleX(0)']);
  // the Reckoning's countdown ticks without coming in again; it stands on Dagon's plate
  const rk = (now) => bossBarModel(state({ phase: 3, atk: blow(ATTACKS.reckon, T0 + 30_000), cx: { c: [[3, 3, 5]] } }), now, BOSS);
  drawGateBossBar(rk(T0 + 10_000), { doc });
  assert.equal(p.callout.className, 'wb-boss-callout cin dagon');
  drawGateBossBar(rk(T0 + 10_000 + FLASH_MS.callIn), { doc });
  drawGateBossBar(rk(T0 + 11_000), { doc });
  assert.deepEqual([p.text.textContent, p.callout.className], [BOSS_BAR_TEXT.reckon("Dagon's Reckoning", 1, 1, 19), 'wb-boss-callout dagon']);
  assert.match(BOSS_BAR_CSS, /\.wb-boss-callout\.dagon \.wb-boss-callout-text \{[^}]*background: rgba\(130,10,10,0\.88\);[^}]*animation: wb-dagon-plate 250ms ease-in-out infinite alternate; \}/, 'a red plate at 2 Hz');
  assert.match(BOSS_BAR_CSS, /\.wb-boss-callout\.aimed \.wb-boss-move \{ display: inline-block;/);
  destroyGateBossBar();
});

test('WB13c the phase marks: one crossed flashes for FLASH_MS.spent and stays dim; one spent before this screen saw the bar never flashes (mutants: every spent mark flashing for ever; the flash on a late joiner\'s marks)', () => {
  const { doc } = fakeDoc();
  destroyGateBossBar();
  drawGateBossBar(bossBarModel(state({ phase: 2 }), T0, BOSS), { doc });
  const p = barParts(doc);
  assert.deepEqual(p.ticks.map((k) => k.className), ['wb-boss-mark spent', 'wb-boss-mark'], 'spent before I came: dim, no flash');
  drawGateBossBar(bossBarModel(state({ phase: 3 }), T0 + 100, BOSS), { doc });
  assert.deepEqual(p.ticks.map((k) => k.className), ['wb-boss-mark spent', 'wb-boss-mark spent now'], 'the one crossed flashes');
  drawGateBossBar(bossBarModel(state({ phase: 3 }), T0 + 100 + FLASH_MS.spent, BOSS), { doc });
  assert.deepEqual(p.ticks.map((k) => k.className), ['wb-boss-mark spent', 'wb-boss-mark spent']);
  assert.match(BOSS_BAR_CSS, /\.wb-boss-mark\.spent \{ opacity: 0\.35; \}\n\.wb-boss-mark\.spent\.now \{ animation: wb-mark-spent 400ms ease-out; \}/);
  destroyGateBossBar();
});

test('WB13c a fight gone resets the bar - the next fight\'s comes up with its own entrance and none of the last one\'s words (FELLED never carried over); the HUD\'s own hide keeps it (mutants: the old callout left in the node; no entrance the second time)', () => {
  const { doc } = fakeDoc();
  destroyGateBossBar();
  drawGateBossBar(bossBarModel(state({ hp: 0, fell: { at: T0, top: [], n: 3 } }), T0, BOSS), { doc });
  const p = barParts(doc);
  assert.equal(p.text.textContent, 'Felled');
  drawGateBossBar(bossBarModel(state(), T0 + 100, BOSS), { doc, hidden: true });
  assert.equal(p.root.style.display, 'none');
  drawGateBossBar(null, { doc });
  assert.equal(p.text.textContent, '', 'the last fight\'s words gone');
  drawGateBossBar(bossBarModel(state({ day: 10 }), T0 + 90_000, BOSS), { doc });
  assert.deepEqual([p.root.style.display, p.root.className, p.text.textContent, p.fill.style.width, p.ghost.style.width], ['', 'wb-boss-bar intro', '', '100.0%', '100.0%']);
  assert.match(BOSS_BAR_CSS, /\.wb-boss-bar\.intro \.wb-boss-fill \{ animation: wb-fill-in 700ms cubic-bezier\(\.2,\.7,\.3,1\); \}/);
  destroyGateBossBar();
});

test('WB13c the court: the bar never over the step\'s fire, and the blow on my feet handed to it by name (mutants: the bar over the veil; MOVE never asked)', () => {
  const c = read('src/scenes/gate/gateCourt.js');
  assert.match(c, /const peril = alive \? perilAt\(s, t, P, fp\[0\] - COURT_CENTRE\[0\], fp\[2\] - COURT_CENTRE\[2\], yaw\(\)\) : null;\n[^\n]*\n[^\n]*\n\s*const onMe = peril && pF \? \(pF\.now && !peril\.now \? pF : peril\) : peril \?\? pF;\n\s*drawGateBossBar\(bossBarModel\(s, t, bossOf\(s\), onMe\?\.name \?\? null, \{ flame: F, flameMine: [^}]*\}\), \{ hidden: hudHidden\(\) \|\| veiled\(\) \}\);/);   // PIN MOVED (WB14d): his blow on my feet, or his Flame's
  assert.match(c, /drawGateGround\(groundViewModel\(\{ inside: inFire, ground: groundName, color: groundColor, biteAt, biteColor, now: t, peril: order \?\? onMe, blindAt: arsenal\.blindAt\(\) \}\), \{ hidden: hudHidden\(\) \}\);/, 'the same peril the ground says');
});

test('WB13c the screens on phones: the bar lower on a portrait phone; on a landscape one his marks\' row gone and the bar high, clear of the crosshair; the card at the foot on the left and the chart on the left under the menu\'s button, never off the screen, the chart narrow; beside the party\'s frames where the screen holds both (mutants: the landscape rules lost; the chart\'s fold never on a landscape phone; the party covered)', () => {
  const block = (css, q) => { const i = css.indexOf(`@media ${q} {`); assert.ok(i >= 0, q); return css.slice(i, css.indexOf('\n}', i)); };
  assert.match(block(BOSS_BAR_CSS, '(max-width: 640px)'), /\.wb-boss-bar \{ top: 72px; \}/);
  const land = block(BOSS_BAR_CSS, '(max-height: 480px)');
  assert.match(land, /\.wb-boss-bar \{ top: 44px; \}/);
  assert.match(land, /\.wb-boss-marks \{ display: none !important; \}/);
  const cardLand = block(MARKS_CARD_CSS, '(max-height: 480px)');
  assert.match(cardLand, /\.wb-marks-card\.wb-marks-arrive, \.wb-marks-card\.wb-marks-gate \{ left: 8px; right: auto; top: auto; bottom: 8px; width: min\(340px, 42vw\);\s*max-height: calc\(100vh - 16px\); overflow: hidden;/);
  assert.match(cardLand, /\.wb-marks-tip \{ display: none; \}/);
  const chartLand = DAMAGE_CHART_CSS.slice(DAMAGE_CHART_CSS.lastIndexOf('@media (max-height: 480px) {'));
  assert.match(chartLand, /\.wb-dmg-chart \{ left: 8px; right: auto; top: 72px; bottom: auto; max-height: calc\(100vh - 80px\); overflow: hidden;/);
  assert.match(DAMAGE_CHART_CSS, /@media \(max-width: 640px\), \(max-height: 480px\) \{\n {2}\.wb-dmg-chart \{ width: 340px; \}/, 'a phone held sideways gets the narrow grid');
  assert.match(DAMAGE_CHART_CSS, /\.wb-dmg-chart\.wb-dmg-healed, \.wb-dmg-chart\.wb-dmg-hosted\.wb-dmg-healed \{ width: 340px; \}/, 'every chart narrow');
  // the party's frames: stepped beside on a wide screen; on a phone held upright, the card and the chart go up
  const PARTY = 'body:has(.dfparty:not([style*="display: none"]))';
  assert.ok(block(MARKS_CARD_CSS, '(min-width: 900px)').includes(`${PARTY} .wb-marks-card { right: 220px; }`));
  assert.ok(block(DAMAGE_CHART_CSS, '(min-width: 900px)').includes(`${PARTY} .wb-dmg-chart { right: 220px; }`));
  assert.ok(block(MARKS_CARD_CSS, '(max-width: 560px)').includes(`${PARTY} .wb-marks-card.wb-marks-arrive { top: 200px; bottom: auto; }`));
  assert.ok(block(DAMAGE_CHART_CSS, '(max-width: 560px)').includes(`${PARTY} .wb-dmg-chart { top: 72px; bottom: auto; }`));
  assert.match(read('src/ui/partyPanel.js'), /root\.style\.display = 'none';/, 'the frames hide by their inline display - what the offsets read');
  // Blows and Best fold away under 1000px
  const mid = block(DAMAGE_CHART_CSS, '(max-width: 1000px)');
  assert.match(mid, /\.wb-dmg-row > \.wb-dmg-blows, \.wb-dmg-row > \.wb-dmg-best \{ display: none; \}/);
  assert.match(mid, /\.wb-dmg-row \{ grid-template-columns: 20px minmax\(0, 1fr\) 60px 46px 62px 42px; \}/);
  assert.ok(DAMAGE_CHART_CSS.indexOf('(max-width: 1000px)') < DAMAGE_CHART_CSS.indexOf('(max-width: 640px), (max-height: 480px)'), 'the narrower fold after it, so it wins');
});

test('WB13c the chart comes in row by row - CHART_ROW_STEP_MS apart, each bar growing over CHART_FILL_MS - for its first CHART_IN_MS only (a class dropped after, so the HUD shown again never plays it twice) (mutants: the entrance for ever; all rows at once)', () => {
  const dm = Array.from({ length: 4 }, (_, i) => ({ n: `P${i}`, l: 10, d: 1000 - i * 100, x: 0, h: 3, b: 50, f: 0 }));
  const at = (ms) => damageChartModel({ at: 1, top: [], n: 4, dm }, { since: 0, now: DAMAGE_CHART_DELAY_MS + ms });
  assert.deepEqual([at(0).entering, at(CHART_IN_MS - 1).entering, at(CHART_IN_MS).entering], [true, true, false]);
  assert.equal(CHART_IN_MS, (DAMAGE_CHART_ROWS + 3) * CHART_ROW_STEP_MS + CHART_FILL_MS);
  const { doc } = fakeDoc();
  destroyGateDamageChart();
  drawGateDamageChart(at(10), { doc });
  const root = doc.body.children[0];
  assert.equal(root.className, 'wb-dmg-chart wb-dmg-in');
  drawGateDamageChart(at(CHART_IN_MS), { doc });
  assert.equal(root.className, 'wb-dmg-chart');
  assert.match(DAMAGE_CHART_CSS, /\.wb-dmg-in > :nth-child\(4\), \.wb-dmg-in > :nth-child\(4\) \.wb-dmg-fill \{ animation-delay: 0ms; \}\n\.wb-dmg-in > :nth-child\(5\), \.wb-dmg-in > :nth-child\(5\) \.wb-dmg-fill \{ animation-delay: 40ms; \}/);
  assert.match(DAMAGE_CHART_CSS, /\.wb-dmg-in \.wb-dmg-fill \{ transform-origin: left center; animation: wb-dmg-fill-in 600ms cubic-bezier\(\.2,\.7,\.3,1\) both; \}/);
  assert.match(DAMAGE_CHART_CSS, /font-variant-numeric: lining-nums tabular-nums;/, 'the classic face\'s figures line up');
  destroyGateDamageChart();
});

test('WB13c the classic face is loaded by the gate\'s own screens - each asks for the skin\'s one fonts sheet as it is first built (Cormorant came only if another window had asked); the classic small words larger; Plus dresses the ground\'s warning (mutants: a screen that never asks; the tips small and slanted)', () => {
  const { heads, doc } = fakeDoc();
  const link = () => heads.filter((h) => h.id === 'dagger-enhanced-fonts');
  destroyGateBossBar(); destroyGateMarksCard(); destroyGateDamageChart(); destroyGateBanner(); destroyGateGround();
  drawGateBanner('Dagon\'s Breach - opens in 3:12', { doc });
  assert.equal(link().length, 1, 'the banner');
  for (const [draw, kill] of [
    [() => drawGateBossBar(bossBarModel(state(), T0, BOSS), { doc }), destroyGateBossBar],
    [() => drawGateMarksCard(marksCardModel(['burning', 'colossal', 'echoing'], BOSS, { mode: 'gate' }), { doc }), destroyGateMarksCard],
    [() => drawGateDamageChart(damageChartModel({ at: 1, top: [], n: 1, dm: [{ n: 'A', l: 1, d: 5, x: 0, h: 1, b: 5, f: 0 }] }, { since: 0, now: DAMAGE_CHART_DELAY_MS + 9000 }), { doc }), destroyGateDamageChart],
    [() => drawGateGround(groundViewModel({ inside: true, ground: 'Burning ground', color: [1, 0.4, 0.1], now: 0 }), { doc }), destroyGateGround],
  ]) {
    heads.length = 0;
    draw();
    assert.equal(link().length, 1, String(draw));
    assert.match(link()[0].href, /family=Cormorant/);
    kill();
  }
  destroyGateBanner();
  // TIDY2: the gate's screens in its folder
  for (const f of ['gateBossBar', 'gateMarksView', 'gateDamageChart', 'gateBanner', 'gateGroundView']) {
    assert.match(read(`src/ui/gate/${f}.js`), /if \(doc\.head\) injectEnhancedFonts\(doc\);/, f);
  }
  assert.match(MARKS_CARD_CSS, /\.wb-marks-text \{ font-size: 13px; opacity: 0\.92; \}\n\.wb-marks-tip \{ font-size: 13px; opacity: 0\.85; color: #e9c9a6; \}/);
  const plus = read('src/ui/enhanced/enhancedPlusStyle.js');
  assert.match(plus, /body \.wb-ground-warn \{ \$\{PIXEL_FONT_CSS\} font-size: 16px;[\s\S]{0,120}background: rgba\(5,6,8,0\.55\);/);   // FONT3: the reading weight, not 400
  assert.match(plus, /body \.wb-boss-ward \{ inset: -5px; border-color: #ffe9a8;/, 'the ward a lit cage, apart from the frame\'s brass');
  assert.match(plus, /body \.wb-boss-track \{ margin: 7px 0 6px;/, 'room for the cage above and below');
});
