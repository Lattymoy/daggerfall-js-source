// STAR6 (bible/11-Multiplayer/Starfall.md section 8): WHAT A PLAYER SEES AND HEARS SAID - every line the Starfall says
// held to WB13b's style; the tracker's reading through a star's life; the map's cards; the Timers window's rows through
// the window's own law; the master's bar on the gate's; and the tracker's plate, made once and written only where it
// changed. tools/mutants/star6.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heldBy, STAR_REGION_TEXT, STAR_AT_TEXT, STAR_CARD_TEXT } from '../../../src/systems/starfall/starWords.js';
import { STAR_MASTERS } from '../../../src/systems/starfall/starCoven.js';
import { starTrackerModel, starMapMarks, starTimerRows, starHeldKey, starHeldLine, starPhaseLine, clockText, STAR_WARN_MS } from '../../../src/systems/starfall/starfallClient.js';
import { starTimes, starNightAt, STAR_LIGHT, STAR_LOW_LIGHT, STAR_CIRCLE_AT, P_GATHER, P_WAVE, P_BREATH, P_MASTER, P_HELD, P_LOST } from '../../../src/net/starfall/starfallLaw.js';
import { HEART_STAR, witchesNight } from '../../../src/systems/starfall/starfallNight.js';
import { STAR_COVENS, covenWitches } from '../../../src/systems/starfall/starfallCovens.js';
import { eventTimerRows } from '../../../src/systems/eventTimers.js';
import { TIMER_KINDS } from '../../../src/ui/enhanced/enhancedTimers.js';
import { starBarModel, STAR_BAR_FELL_HOLD_MS, STAR_BAR_FELL_FADE_MS } from '../../../src/ui/starfall/starBar.js';
import { drawStarTracker, destroyStarTracker, STAR_TRACKER_KEYS, isStarTrackerSelector, STAR_TRACKER_CSS, STAR_TRACKER_HEIGHT_VAR, STAR_TRACKER_GAP } from '../../../src/ui/starfall/starTracker.js';
import { STAR_VIOLET_CSS } from '../../../src/ui/starfall/starMapMark.js';
import { readRaidMarks } from '../../../src/ui/eventMapMarks.js';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
const FESTIVAL_FROM_MS = FESTIVALS[0].fromMs;   // the Witches' Festival's first day, the Starfall's own (net/festivalLaw.js)

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const N = starNightAt(FESTIVAL_FROM_MS) + 30;
const COVEN = STAR_COVENS[0];
const site = (k, over = {}) => ({ n: N, k, px: 300 + k * 7, py: 200, near: 'Gothway Garden', coven: COVEN, ...over });

/** Every line the Starfall says, with plain words in. */
function lines() {
  const out = [];
  const add = (where, v) => out.push([where, v]);
  const W = 'The Daggerfall Witches';
  add('region.omen', STAR_REGION_TEXT.omen('Gothway Garden', W));
  add('region.omenHeart', STAR_REGION_TEXT.omenHeart('Gothway Garden', W));
  add('region.fell', STAR_REGION_TEXT.fell('Gothway Garden'));
  add('region.held', STAR_REGION_TEXT.held('Gothway Garden', [], 0));
  add('region.heldBy', STAR_REGION_TEXT.held('Gothway Garden', ['Ann', 'Bran'], 4));
  for (let w = 1; w <= 4; w++) add(`at.wave${w}`, STAR_AT_TEXT.wave(w));
  for (const k of ['breath', 'low', 'held', 'heldHeart', 'lost', 'dawn']) add(`at.${k}`, STAR_AT_TEXT[k]());
  for (const her of [true, false]) add(`at.broken.${her}`, STAR_AT_TEXT.circleBroken(her));
  for (const m of Object.values(STAR_MASTERS)) { add(`master.${m.id}.name`, m.name()); add(`master.${m.id}.call`, m.call()); add(`master.${m.id}.circle`, m.circle()); }   // AUDIT STAR W1: each master's circle its own line
  const C = STAR_CARD_TEXT;
  for (const [k, v] of Object.entries({
    name: C.name(false), heart: C.name(true), near: C.near('Gothway Garden'), wave: C.wave(2, 4), waits: C.waits(), gathers: C.gathers(),
    breath: C.breath(), held: C.held(), heldBy: C.heldBy(['Ann'], 3), lost: C.lost(), light: C.light(), left: C.left('4:07'),
    falls: C.falls('21:00'), falling: C.falling(), master: C.master(false), masterHeart: C.master(true), circle1: C.circle(1, true),
    circle3: C.circle(3, false), defenders: C.defenders(5), legend: C.legend(), takes: C.takes(), comes: C.comes(false),
    comesHeart: C.comes(true), rite: C.rite(W), warded: C.warded(), felled: C.felled(),   // AUDIT STAR U3: the bar's own words
  })) add(`card.${k}`, v);
  return out;
}

test('STAR6 THE STYLE, WB13b\'s law over every line: each a string with words in it; no dash aside; no "X, not Y"; no colon gloss; at most one exclamation; numbers as numerals; no line explains itself (mutants: a line of the old style)', () => {
  const all = lines();
  assert.ok(all.length > 50, `${all.length} lines`);
  const bad = [];
  for (const [where, s] of all) {
    if (typeof s !== 'string' || s.length < 3) { bad.push(`${where}: no words - ${s}`); continue; }
    if (/\S - \S/.test(s)) bad.push(`${where}: a dash aside - ${s}`);
    if (/, not \w/.test(s)) bad.push(`${where}: "X, not Y" - ${s}`);
    if (/[a-z]: [a-z]/i.test(s.replace(/\b\d{1,2}:\d{2}\b/g, ''))) bad.push(`${where}: a colon gloss - ${s}`);
    if ((s.match(/!/g) ?? []).length > 1) bad.push(`${where}: more than one exclamation - ${s}`);
    if (/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(s)) bad.push(`${where}: a number in words - ${s}`);
    if (/\b(you can|you will|in order to|make sure|note that|remember to|this means)\b/i.test(s)) bad.push(`${where}: explains itself - ${s}`);
    if (/\{|\}/.test(s)) bad.push(`${where}: an unfilled argument - ${s}`);
  }
  assert.deepEqual(bad, []);
  // the shapes the design's table says (bible/11-Multiplayer/Starfall.md section 8)
  assert.equal(STAR_REGION_TEXT.omen('Gothway Garden', 'The Daggerfall Witches'), 'A star is falling toward Gothway Garden. The Daggerfall Witches are at their rite.');
  assert.equal(STAR_REGION_TEXT.fell('Gothway Garden'), 'A star has fallen near Gothway Garden.');
  assert.equal(STAR_REGION_TEXT.held('Gothway Garden', ['Ann', 'Bran'], 4), 'The star near Gothway Garden is held by Ann, Bran and 2 others.');
  assert.equal(STAR_MASTERS.mother.circle(), 'The Coven Mother calls her circle. Break it!');   // PIN MOVED (AUDIT STAR W1): the master's own line, never a name dropped into a shared one
  assert.equal(STAR_AT_TEXT.circleBroken(false), 'Its circle is broken.');
  assert.equal(STAR_CARD_TEXT.circle(2, true), '2 of her circle stand');
  assert.equal(STAR_CARD_TEXT.circle(1, false), '1 of its circle stands');
});

test('STAR6 WHO HELD IT: the first few by name and how many more - no one named, a count; one, the name; a list joined with "and" (mutants: the count, the join)', () => {
  assert.equal(heldBy([], 0), '');
  assert.equal(heldBy(null, 0), '');
  assert.equal(heldBy([], 1), '1 defender');
  assert.equal(heldBy([], 5), '5 defenders');
  assert.equal(heldBy(['Ann'], 1), 'Ann');
  assert.equal(heldBy(['Ann'], 0), 'Ann', 'a count under the names is the names');
  assert.equal(heldBy(['Ann', 'Bran'], 2), 'Ann and Bran');
  assert.equal(heldBy(['Ann', 'Bran', 'Cy'], 3), 'Ann, Bran and Cy');
  assert.equal(heldBy(['Ann'], 2), 'Ann and 1 other');
  assert.equal(heldBy(['Ann', 'Bran', 'Cy'], 9), 'Ann, Bran, Cy and 6 others');
  assert.equal(heldBy(['Ann', '', 7, 'Bran'], 2), 'Ann and Bran', 'only names');
});

test('STAR6 THE TRACKER\'S READING: the star\'s name (the Heart-Star its own), its town, its coven; waiting until the cell speaks, then each phase by its words and the master by name; the light from the ledger, low at a quarter; the time to its deadline; held or lost, the light and the clock settled (mutants: a phase, the low edge, held from the hub)', () => {
  const s = site(1), T = starTimes(N, 1), t = T.fallAt + 60_000;
  const led = (p, over = {}) => ({ p, w: 2, lt: 80, b: 1, ...over });
  const m0 = starTrackerModel(s, null, t, 'The Coven Mother');
  assert.equal(m0.title, 'Fallen Star');
  assert.equal(m0.near, 'Near Gothway Garden');
  assert.equal(m0.coven, covenWitches(COVEN));
  assert.ok(m0.coven.length > 3);
  assert.equal(m0.phase, 'The coven waits');
  assert.equal(m0.light, 1, 'full before the cell speaks');
  assert.equal(m0.left, `${clockText(T.endAt - t)} left`);
  assert.equal(m0.low, false);
  assert.equal(starTrackerModel(s, led(P_GATHER), t, 'X').phase, 'The coven gathers');
  assert.equal(starTrackerModel(s, led(P_WAVE), t, 'X').phase, 'Wave 2 of 4');
  assert.equal(starTrackerModel(s, led(P_BREATH), t, 'X').phase, 'The coven draws breath');
  assert.equal(starTrackerModel(s, led(P_MASTER), t, 'The Coven Mother').phase, 'The Coven Mother');
  assert.equal(starTrackerModel(s, led(P_WAVE, { lt: 40 }), t, 'X').light, 40 / STAR_LIGHT);
  assert.equal(starTrackerModel(s, led(P_WAVE, { lt: STAR_LOW_LIGHT }), t, 'X').low, true);
  assert.equal(starTrackerModel(s, led(P_WAVE, { lt: STAR_LOW_LIGHT + 1 }), t, 'X').low, false);
  const held = starTrackerModel(s, led(P_HELD, { lt: 30 }), t, 'X');
  assert.deepEqual([held.phase, held.light, held.left, held.held, held.low], ['Held', 30 / STAR_LIGHT, '', true, false]);
  const byHub = starTrackerModel(s, led(P_MASTER, { lt: 10 }), t, 'X', true);
  assert.deepEqual([byHub.phase, byHub.held, byHub.low], ['Held', true, false], 'the hub\'s word holds it');
  const lost = starTrackerModel(s, led(P_LOST, { lt: 0 }), t, 'X');
  assert.deepEqual([lost.phase, lost.light, lost.left, lost.held], ['Lost', 0, '', false]);
  assert.equal(clockText(-5), '0:00');
  assert.equal(clockText(61_001), '1:02');
  // the Heart-Star: the Witches' Festival's night's last
  let hn = N;
  while (!witchesNight(hn)) hn++;
  assert.equal(starTrackerModel(site(HEART_STAR, { n: hn }), null, starTimes(hn, HEART_STAR).fallAt, 'X').title, 'Heart-Star');
  assert.equal(starTrackerModel(site(HEART_STAR, { n: hn }), null, starTimes(hn, HEART_STAR).fallAt, 'X').heart, true);
  assert.equal(starPhaseLine(null, 'X'), 'The coven waits');
});

test('STAR6 THE MAP\'S CARDS: each of the night\'s stars from its omen until it is gone - falling at its time, falling, how it stands, held by its defenders, lost; on its own pixel, named by its town; the held map\'s reader takes every card (mutants: a phase\'s card, the omen\'s edge, the hold\'s names)', () => {
  const sites = [site(0), site(1), site(2)];
  const T = sites.map((s) => starTimes(s.n, s.k));
  const at = (t, o) => starMapMarks(sites, t, { localTime: () => '21:00', ...o });
  assert.deepEqual(at(T[0].omenAt - 1), [], 'none before its omen');
  const omen = at(T[0].omenAt);
  assert.equal(omen.length, 1);
  assert.deepEqual(omen[0].tip.lines, ['Near Gothway Garden', omen[0].tip.lines[1], 'Falls at 21:00']);
  assert.equal(omen[0].label, 'Fallen Star, Gothway Garden');
  assert.equal(omen[0].key, starHeldKey(N, 0, sites[0].px, sites[0].py));
  assert.deepEqual([omen[0].px, omen[0].py], [sites[0].px, sites[0].py]);
  assert.equal(at(T[0].streakAt)[0].tip.lines[2], 'Falling');
  const led = new Map([[starHeldKey(N, 0, sites[0].px, sites[0].py), { p: P_WAVE, w: 3, b: 1 }]]);
  assert.equal(at(T[0].fallAt + 1000, { led })[0].tip.lines[2], 'Wave 3 of 4');
  assert.equal(at(T[0].fallAt + 1000)[0].tip.lines[2], 'The coven waits');
  const held = new Map([[starHeldKey(N, 0, sites[0].px, sites[0].py), { top: ['Ann', 'Bran'], c: 2 }]]);
  assert.equal(at(T[0].fallAt + 1000, { held })[0].tip.lines[2], 'Held by Ann and Bran');
  assert.equal(at(T[0].endAt)[0].tip.lines[2], 'Lost', 'past its deadline unheld');
  assert.equal(at(T[0].endAt, { held })[0].tip.lines[2], 'Held by Ann and Bran', 'held stays held');
  assert.deepEqual(at(T[0].goneAt).map((m) => m.key).includes(starHeldKey(N, 0, sites[0].px, sites[0].py)), false, 'gone');
  const read = readRaidMarks(() => at(T[2].fallAt + 1000), { width: 1000, height: 500 });
  assert.equal(read.length, at(T[2].fallAt + 1000).length, 'the held map reads every card');
  assert.ok(read.every((m) => m.tip && m.tip.lines.length === 3));
});

test('STAR6 THE TIMERS WINDOW\'S ROWS: a fallen star still undecided counts down to its deadline; the next to fall counts down to its landing, its coven always and its town (and its pixel) from STAR_WARN_MS before it falls (EVENTS1 - it had been from its omen); a star held or lost leaves the window; the Heart-Star by its name; the window takes them as its own kind (mutants: the omen\'s edge, the decided test, the soonest)', () => {
  const sites = [site(0), site(1), site(2)];
  const T = sites.map((s) => starTimes(s.n, s.k));
  const before = starTimerRows(sites, T[0].fallAt - STAR_WARN_MS - 1);
  assert.equal(before.length, 1);
  assert.deepEqual({ ...before[0], detail: null }, { id: `star:${N}.0`, kind: 'star', title: 'A star falls', where: null, detail: null, live: false, at: T[0].fallAt, until: null }, 'no town and no pixel before the warning');
  assert.match(before[0].detail, / are at their rite$/);
  // EVENTS1: named STAR_WARN_MS before its fall - well before its omen - with its pixel for the event board's way
  assert.ok(T[0].fallAt - STAR_WARN_MS < T[0].omenAt);
  const warned = starTimerRows(sites, T[0].fallAt - STAR_WARN_MS)[0];
  assert.deepEqual([warned.where, warned.px, warned.py], ['Near Gothway Garden', sites[0].px, sites[0].py], 'its town and its pixel once warned');
  const during = starTimerRows(sites, T[0].fallAt + 1000);
  assert.deepEqual(during.map((r) => [r.id, r.live, r.at]), [[`star:${N}.0`, true, T[0].endAt], [`star:${N}.1`, false, T[1].fallAt]]);
  assert.deepEqual([during[0].title, during[0].where, during[0].detail, during[0].until, during[0].px, during[0].py], ['Fallen Star', 'Near Gothway Garden', 'The coven takes it when this runs out', T[0].endAt, sites[0].px, sites[0].py]);
  const decided = (key) => key === starHeldKey(N, 0, sites[0].px, sites[0].py);
  assert.deepEqual(starTimerRows(sites, T[0].fallAt + 1000, decided).map((r) => r.id), [`star:${N}.1`], 'held or lost: gone from the window');
  assert.deepEqual(starTimerRows(sites, T[2].endAt), [], 'the night\'s last decided by the clock, none to fall');
  assert.deepEqual(starTimerRows([sites[2], sites[1]], T[0].fallAt + 1000).at(-1).id, `star:${N}.1`, 'the soonest, whatever the order');
  let hn = N;
  while (!witchesNight(hn)) hn++;
  const heart = site(HEART_STAR, { n: hn });
  assert.equal(starTimerRows([heart], starTimes(hn, HEART_STAR).fallAt - 1)[0].title, 'The Heart-Star falls');
  assert.equal(starTimerRows([heart], starTimes(hn, HEART_STAR).fallAt + 1)[0].title, 'Heart-Star');
  // the window's own law takes them, and nothing malformed
  const now = T[0].fallAt + 1000;
  const rows = eventTimerRows({ now, stars: [...during, { kind: 'star', id: 'x', at: NaN }, { kind: 'gate', id: 'y', at: now + 5 }, null] });
  assert.deepEqual(rows.filter((r) => r.kind === 'star').map((r) => r.id), [`star:${N}.0`, `star:${N}.1`]);
  assert.ok(!rows.some((r) => r.id === 'y'), 'only the star\'s kind');
  assert.equal(rows.findIndex((r) => r.id === `star:${N}.0`) < rows.findIndex((r) => !r.live), true, 'live first');
  assert.ok(TIMER_KINDS.includes('star'));
  assert.match(read('src/ui/enhanced/enhancedStyle.js'), /\.px-timerswin \.tm-star \{ --tm-kind: \$\{STAR_VIOLET_CSS\}; \}/);
});

test('STAR6 THE MASTER\'S BAR: the gate\'s bar in the star\'s theme - its name and title (the Heart-Star\'s its own), its health, its circle\'s two calls as marks spent as it falls past them, warded and the circle counted while it stands, the defenders; fallen, it holds and fades (mutants: the marks, the ward, the fade)', () => {
  assert.equal(starBarModel(null, 0), null);
  const b = { name: 'The Coven Mother', heart: false, hp: 500, max: 1000, circle: 3, her: true, defenders: 4, fellAt: null };
  const m = starBarModel(b, 0);
  assert.equal(m.theme, 'star');
  assert.equal(m.ringCss, STAR_VIOLET_CSS);
  assert.equal(m.title, 'Master of the Fallen Star');
  assert.equal(starBarModel({ ...b, heart: true }, 0).title, 'Heart of the Web');
  assert.equal(m.frac, 0.5);
  assert.deepEqual(m.marks, [...STAR_CIRCLE_AT]);
  assert.deepEqual(m.spent, [true, false]);
  assert.deepEqual(starBarModel({ ...b, hp: 200 }, 0).spent, [true, true]);
  assert.deepEqual(starBarModel({ ...b, hp: 900 }, 0).spent, [false, false]);
  assert.equal(m.warded, true);
  assert.deepEqual([m.wardedText, m.fallenText], ['Warded', 'Felled'], 'AUDIT STAR U3: its own words, through the text core - the gate\'s were English alone');
  assert.deepEqual([m.wardedText, m.fallenText], [STAR_CARD_TEXT.warded(), STAR_CARD_TEXT.felled()]);
  assert.match(read('src/ui/gate/gateBossBar.js'), /model\.warded \? model\.wardedText \?\? BOSS_BAR_TEXT\.warded/, 'the bar says the model\'s ward');
  assert.equal(m.host, '3 of her circle stand');
  assert.equal(m.fightersLine, '4 defenders');
  const open = starBarModel({ ...b, circle: 0 }, 0);
  assert.deepEqual([open.warded, open.host], [false, null]);
  assert.equal(starBarModel({ ...b, hp: 100 }, 0).low, true);
  const fell = starBarModel({ ...b, fellAt: 1000 }, 1000 + STAR_BAR_FELL_HOLD_MS);
  assert.deepEqual([fell.fallen, fell.frac, fell.warded, fell.alpha, fell.low], [true, 0, false, 1, false]);
  assert.equal(starBarModel({ ...b, fellAt: 1000 }, 1000 + STAR_BAR_FELL_HOLD_MS + STAR_BAR_FELL_FADE_MS / 2).alpha, 0.5);
  assert.equal(starBarModel({ ...b, fellAt: 1000 }, 1000 + STAR_BAR_FELL_HOLD_MS + STAR_BAR_FELL_FADE_MS).alpha, 0);
  assert.equal(starBarModel({ ...b, max: 0 }, 0).frac, 1);
  assert.match(read('src/ui/gate/gateBossBar.js'), /\.wb-boss-bar\.star/, 'the bar dressed in the star\'s theme');
});

/** A page the tracker writes into: its nodes, their text and style, and how often each was written. */
function trackerDoc() {
  const writes = { text: 0, cls: 0, width: 0 };
  const node = (tag) => {
    const n = { tag, children: [], style: {}, attrs: {}, _cls: '', _text: '', parent: null };
    Object.defineProperty(n, 'className', { get: () => n._cls, set: (v) => { n._cls = v; writes.cls++; } });
    Object.defineProperty(n, 'textContent', { get: () => n._text, set: (v) => { n._text = v; writes.text++; } });
    n.style = new Proxy({}, { set: (o, k, v) => { o[k] = v; if (k === 'width') writes.width++; return true; } });
    n.append = (...c) => { for (const x of c) { x.parent = n; n.children.push(x); } };
    n.setAttribute = (k, v) => { n.attrs[k] = v; };
    n.remove = () => { if (n.parent) n.parent.children = n.parent.children.filter((x) => x !== n); };
    return n;
  };
  const doc = { head: node('head'), body: node('body'), byId: new Map(), writes };
  doc.createElement = (tag) => node(tag);
  doc.getElementById = (id) => doc.head.children.find((n) => n.id === id) ?? null;
  return doc;
}
const all = (n, out = []) => { out.push(n); for (const c of n.children) all(c, out); return out; };

test('STAR6 THE TRACKER\'S PLATE: made once, its parts in their order, each written only when what it says changes; its classes held, low and the Heart-Star\'s; the light as a fill, named; the phase alone spoken; hidden and shown without a rebuild; taken down whole; its classic rules cut to it alone (mutants: the write guard, a class, the fill, the live region)', () => {
  destroyStarTracker();
  const doc = trackerDoc();
  const model = { title: 'Fallen Star', near: 'Near Gothway Garden', coven: 'The Daggerfall Witches', phase: 'Wave 1 of 4', light: 0.8, low: false, left: '14:00 left', heart: false, held: false };
  drawStarTracker(null, { doc });
  assert.equal(doc.body.children.length, 0, 'nothing made for nothing');
  drawStarTracker(model, { doc });
  const root = doc.body.children[0];
  assert.equal(root.className, 'star-hud on');   // PIN MOVED (AUDIT STAR U1): `on` while it stands - the party list steps under it
  assert.deepEqual(root.children.map((c) => c.className), ['star-hud-title', 'star-hud-near', 'star-hud-coven', 'star-hud-phase', 'star-hud-light', 'star-hud-left']);
  assert.deepEqual(STAR_TRACKER_KEYS.map((k) => root.children.find((c) => c.className === `star-hud-${k}`).textContent), [model.title, model.near, model.coven, model.phase, model.left]);
  const fill = all(root).find((n) => n.className === 'star-hud-fill');
  assert.equal(fill.style.width, '80%');
  // AUDIT STAR W7: the bar named, its light; U2: the phase alone is live - on the whole plate the countdown was read out
  // every second
  assert.equal(all(root).find((n) => n.className === 'star-hud-gauge').textContent, STAR_CARD_TEXT.light());
  assert.deepEqual(all(root).filter((n) => n.attrs['aria-live']).map((n) => [n.className, n.attrs['aria-live']]), [['star-hud-phase', 'polite']]);
  const w0 = { ...doc.writes };
  drawStarTracker({ ...model }, { doc });
  assert.deepEqual(doc.writes, w0, 'the same reading writes nothing');
  drawStarTracker({ ...model, left: '13:59 left' }, { doc });
  assert.equal(doc.writes.text, w0.text + 1, 'one part changed, one write');
  drawStarTracker({ ...model, low: true, heart: true }, { doc });
  assert.equal(root.className, 'star-hud on heart low');
  drawStarTracker({ ...model, held: true, light: 0.3 }, { doc });
  assert.equal(root.className, 'star-hud on held');
  assert.equal(fill.style.width, '30%');
  drawStarTracker(model, { doc, hidden: true });
  assert.equal(root.style.display, 'none');
  assert.equal(root.className, 'star-hud', 'hidden: the party list\'s own line again');
  drawStarTracker(model, { doc });
  assert.equal(root.style.display, '');
  assert.equal(root.className, 'star-hud on');
  assert.equal(doc.body.children.length, 1, 'never rebuilt');
  assert.ok(doc.head.children.some((n) => n.id === 'dagger-star-tracker-style'));
  destroyStarTracker();
  assert.equal(doc.body.children.length, 0, 'taken down');
  assert.equal(isStarTrackerSelector('body .star-hud'), true);
  assert.equal(isStarTrackerSelector('.star-hud-title'), false, 'the kit dresses the plate, never its parts');
  assert.equal(isStarTrackerSelector('.star-hudson'), false);
  assert.equal(isStarTrackerSelector('.wb-boss-bar'), false);
});

test('AUDIT STAR U1 THE COLUMN: the plate stands under the quest card by the height the card publishes, on the party list\'s line where there is none (a touch screen\'s too), and under the master\'s bar where the two share the width; it publishes its bottom as the card does - its height and the gap where a page cannot say where it stands, nothing hidden or gone - and the party list steps under the lower of the two while it stands (mutants: the card\'s height unread, the party unstepped, the bottom unpublished)', () => {
  const css = STAR_TRACKER_CSS.replace(/\s+/g, ' ');
  assert.match(css, /\.star-hud \{ --star-floor: 0px; position: fixed; right: calc\(8px \+ env\(safe-area-inset-right, 0px\)\); top: max\(var\(--star-floor\), calc\(92px \+ var\(--dfquest-h, 0px\) \+ env\(safe-area-inset-top, 0px\)\)\);/);
  assert.match(css, /\.star-hud\.touch \{ top: max\(var\(--star-floor\), calc\(76px \+ var\(--dfquest-h, 0px\)/);
  assert.match(css, /@media \(max-width: 1100px\) \{ \.star-hud \{ --star-floor: 24%; \} body:has\(\.wb-boss-bar\.star:not\(\[style\*="display: none"\]\)\) \.star-hud \{ --star-floor: max\(24%, 162px\); \}/, 'under the compass, the foe\'s frame and the master\'s bar where they share the width');
  assert.match(css, /@media \(max-width: 640px\) \{ [^}]*\} body:has\(\.wb-boss-bar\.star[^)]*\)\) \.star-hud \{ --star-floor: max\(16%, 176px\); \}/, 'a phone: under the bar at its 72');
  assert.match(css, /@media \(max-width: 1000px\) \{ body:has\(\.wb-boss-bar\.star:not\(\[style\*="display: none"\]\)\):has\(\.star-hud\.on\) \.qtrack \{ visibility: hidden; \} \}/, 'the quest card steps aside while the master\'s bar stands over its corner');
  assert.match(css, /body:has\(\.star-hud\.on\) \.dfparty \{ top: calc\(92px \+ max\(var\(--dfquest-h, 0px\), var\(--dfstar-h, 0px\)\)/);
  assert.match(css, /body:has\(\.star-hud\.on\) \.dfparty\.touch \{ top: calc\(76px \+ max\(var\(--dfquest-h, 0px\), var\(--dfstar-h, 0px\)\)/);
  assert.equal(STAR_TRACKER_HEIGHT_VAR, '--dfstar-h');
  destroyStarTracker();
  const doc = trackerDoc();
  const vars = {};
  doc.documentElement = { style: { setProperty: (k, v) => { vars[k] = v; }, getPropertyValue: (k) => vars[k] ?? '' } };
  const model = { title: 'Fallen Star', near: 'Near Gothway Garden', coven: 'The Daggerfall Witches', phase: 'Wave 1 of 4', light: 0.8, low: false, left: '14:00 left', heart: false, held: false };
  drawStarTracker(model, { doc });
  const root = doc.body.children[0];
  assert.equal(vars[STAR_TRACKER_HEIGHT_VAR], '0px', 'a page that cannot say its height: nothing to step under');
  root.offsetHeight = 120;
  drawStarTracker({ ...model, left: '13:59 left' }, { doc });
  assert.equal(vars[STAR_TRACKER_HEIGHT_VAR], `${120 + STAR_TRACKER_GAP}px`, 'its height and the gap');
  root.getBoundingClientRect = () => ({ top: 200, bottom: 330 });
  vars['--dfquest-h'] = '60px';
  drawStarTracker({ ...model, left: '13:59 left' }, { doc });
  assert.equal(vars[STAR_TRACKER_HEIGHT_VAR], `${330 - 92 + STAR_TRACKER_GAP}px`, 'the card above it grew: measured again, its bottom against the party list\'s line');
  drawStarTracker(null, { doc });
  assert.equal(vars[STAR_TRACKER_HEIGHT_VAR], '0px', 'hidden: the party list\'s line back');
  drawStarTracker(model, { doc });
  assert.equal(vars[STAR_TRACKER_HEIGHT_VAR], `${330 - 92 + STAR_TRACKER_GAP}px`);
  destroyStarTracker();
});

test('STAR6 THE REGION HEARS A HOLD where this screen found the night\'s stars, its town named; elsewhere nothing (mutants: the site guard)', () => {
  assert.equal(starHeldLine(site(1), ['Ann'], 1), 'The star near Gothway Garden is held by Ann.');
  assert.equal(starHeldLine(null, ['Ann'], 1), null);
  assert.equal(starHeldLine(site(1), [], 0), 'The star near Gothway Garden is held.');
});
