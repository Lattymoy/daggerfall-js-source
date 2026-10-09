// AUDIT SD IV, SD26 (2026-10-08, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md "AUDIT SD IV"): WHAT
// THE PLAYER READS, AUDITED A FOURTH TIME - the text lens's findings, each reproduced and pinned here: the fight's turns
// on the card where its bar stands (T1).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSdBeats, SD_BEAT_TEXT, SD_BEAT_LAST_MS } from '../src/scenes/sdArenaRead.js';
import { titleCardModel } from '../src/ui/gateTitleCard.js';
import { sdBarNear, remnantBarModel, SD_BAR_CSS } from '../src/ui/sdRemnantBar.js';
import { SD_ARENA, orreryOf } from '../src/net/sdBrain.js';
import { createSdVoice, SD_VOICE_RANK, SD_VOICE_READ_MS, SD_VOICE_WAIT_MS } from '../src/scenes/sdVoice.js';
import { SD_BLOWS_TEXT } from '../src/scenes/sdRemnantBlows.js';
import { sdCollapseLine, createSdHost } from '../src/scenes/sdHost.js';
import { SD_COLLAPSE_MS, sdFirst, sdRise, sdFind, SD_LIFETIME_MS } from '../src/net/sdLaw.js';
import { SD_SPOILS_TEXT } from '../src/systems/sdSpoils.js';
import { SD_HOME_TEXT } from '../src/scenes/sdEnd.js';
import { SD_REM_SINK_MS } from '../src/scenes/sdRemnant.js';
import { SD_RECEIPT_WAIT_MS } from '../src/scenes/sdSpoils.js';
import { courtSaySeconds } from '../src/scenes/gateCourt.js';
import { MidScreenText } from '../src/ui/midScreenText.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { MARKS_CARD_CSS } from '../src/ui/gateMarksView.js';
import { DAMAGE_CHART_CSS } from '../src/ui/gateDamageChart.js';
import { drawGateBossBar, destroyGateBossBar, BOSS_BAR_CSS } from '../src/ui/gateBossBar.js';
import { ONLINE_DRESS_CSS } from '../src/ui/enhancedPlusStyle.js';
import { SD_BLOWS, SD_BODY } from '../src/net/sdRemnant.js';
import { sdMarksLine, sdHourLine, SD_HOUR_LEFT_MS } from '../src/systems/sdOmen.js';
import { sdMarksOf, sdEndingOf } from '../src/net/sdMarks.js';
import { SD_MARK_TIPS } from '../src/ui/sdMarksView.js';
import { sdCities, sdTemplates } from '../src/systems/sdSite.js';
import { scanGatePixels } from '../src/systems/gateSite.js';
import { LOCATION_TYPES, CLIMATES } from '../src/formats/mapsFile.js';
import { isMainStoryDungeon } from '../src/world/dungeonTextures.js';
import { createSdHall, SD_HALL_TEXT } from '../src/scenes/sdHall.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = read('src/scenes/world.js');
const T0 = 1_800_000_000_000;
/** A slot whose Hollow keeps Sentinel's Ending. */
const SLOT_SENTINEL = Array.from({ length: 216 }, (_, i) => i + 1).find((k) => sdEndingOf(sdMarksOf(k))?.id === 'sentinel');

/** world.js's own sdFightFrame over a fight, a player and a card the test holds. */
function fightHost() {
  const at = W.indexOf('\n  const sdFightFrame = () => {');
  const text = W.slice(at + 1, W.indexOf('\n  };\n', at) + 5);
  const st = { t: T0, x: SD_ARENA.x, z: SD_ARENA.z, s: { fi: 2, ph: 1, op: T0 - 60_000, ou: 0, su: 0, h: 1000, m: 1000, rem: null, ec: null, clk: null, cx: null, fell: null, lost: 0, ends: T0 + 9e6 } };
  const cards = [];
  const env = {
    modes: { sdRealmSlot: () => 3 }, sdFightLink: { leave() {}, state: () => st.s, now: () => st.t }, _sdReceipts: new Map(), sdReceiptsLeft() {},
    sdSpoilsBurst: { leave() {}, frame() {} }, sdBlows: { leave() {}, frame() {} }, sdFx: { leave() {}, frame() {} }, saveSoon: { changed() {} },
    player: { pos: [0, 0, 0] }, playerEntity: { health: 10, maxHealth: 10 }, sdDungeonToRealm: () => [st.x, 0, st.z], sdBarNear,
    remnantBarModel: () => ({ bar: true }), drawGateBossBar() {}, gamePaused: () => false, townTalk: { hudHidden: false },
    sdRemVoice: { leave() {}, frame() {} }, cam: { yaw: 0 }, SD_ARENA, sdPerilAt: () => null, sdGroundModel: () => null,
    sdBeats: createSdBeats(), titleCardModel, drawGateGround() {}, drawSdTitleCard: (m) => cards.push(m ? m : null),
    sdMarksCardModel: () => null, sdMarksOf: () => null, drawGateMarksCard() {}, performance: { now: () => 0 }, gateVeil: { busy: false },
  };
  const frame = new Function(...Object.keys(env), `let _sdHall = null, _sdFightHeld = false, _sdBarUp = false, _sdGroundUp = false, _sdCardUp = false, _sdMarksSince = null, _sdMarksUp = false, _sdPassesWarm = true;\n${text}\nreturn sdFightFrame;`)(...Object.values(env));
  return { st, cards, step: (ms = 16) => { st.t += ms; frame(); }, shown: () => cards.filter(Boolean).map((m) => m.main) };
}

test('SD26 THE FIGHT\'S TURNS ON THE CARD WHERE ITS BAR STANDS (T1): AUDIT SD II L6 F15 says the fight\'s turns only to whoever stands where its bar stands, its fall to the whole Hour - and SD15\'s title card took every turn to the whole realm: a fighter\'s friend mid-jump on the Crumble had "The Dragon Break - Fell Gold and Silver within 15 seconds of each other" over the platforming, the voice having just kept it from them. The wake, the Break and the Last Moment are drawn near the arena alone; the last minute (AUDIT SD III A10) and the fall stand for the whole Hour; the beats still follow the fight far off, so a turn passed there is never drawn late on reaching it (mutants: the turns to the whole Hour; the last minute withheld; the fall withheld)', () => {
  // on the Crumble: the Dragon Break turns - nothing drawn
  const h = fightHost();
  h.st.x = 0; h.st.z = 190;
  assert.equal(sdBarNear(h.st.x, h.st.z), false, 'the Crumble is past the bar\'s reach');
  h.step(); h.step();
  h.st.s = { ...h.st.s, ph: 2 }; h.step();
  for (let i = 0; i < 40; i++) h.step(100);
  assert.deepEqual(h.shown(), [], 'the Break is the arena\'s');
  // walking in after its card's span: the turn passed far off is not drawn late
  h.st.x = SD_ARENA.x; h.st.z = SD_ARENA.z; h.step();
  assert.deepEqual(h.shown(), [], 'a turn passed far off, never drawn late');
  // at the arena: the Last Moment drawn
  h.st.s = { ...h.st.s, ph: 3 }; h.step();
  assert.deepEqual(h.shown(), [SD_BEAT_TEXT.moment.main], 'the Last Moment, at its arena');
  // the last minute and the fall: the whole Hour's, in the hall
  const w = fightHost();
  w.st.x = 0; w.st.z = 42;
  w.step(); w.step();
  w.st.s = { ...w.st.s, ends: w.st.t + SD_BEAT_LAST_MS - 100 }; w.step();
  assert.equal(w.shown().at(-1), SD_BEAT_TEXT.last.main, 'the last minute');
  for (let i = 0; i < 40; i++) w.step(100);
  w.st.s = { ...w.st.s, fell: { at: w.st.t, top: [], n: 1 } }; w.step();
  assert.equal(w.shown().at(-1), SD_BEAT_TEXT.fell.main, 'its fall');
});

test('SD26 THE KILL READ WHOLE, THE WAY HOME WITH IT (T2): L6 F2 read the fall, the floor\'s word and the collapse\'s first readout each whole - and the way home\'s rising, said SD_REM_SINK_MS after the fall, cut the readout 0.5 s into its 3.7 (its count, and where the way home is, the next count a minute off); for one who earned nothing the no-spoils note, due the same instant, cut the readout and was cut by the rising in the same frame, never drawn. A line cut goes back to the head of its rank, its wait begun anew; one cut with under SD_VOICE_READ_MS left was read. Replayed in world.js\'s frame order (the spoils before the way home), the fall word heard 16 ms to 1.2 s late: every line stands its whole length once, the readout within its life (mutants: a cut line lost; a cut line queued behind its rank; a line nearly read said again; the thread\'s replaced word back)', () => {
  const fell = SD_BLOWS_TEXT.fell, readout = sdCollapseLine(SD_COLLAPSE_MS, { hour: true, first: true });
  const whole = (shown, text) => shown.some((x, k) => x.text === text && (k === shown.length - 1 || shown[k + 1].at > x.at + x.secs * 1000 - SD_VOICE_READ_MS));
  const kill = (L, earned) => {
    let t = 0;
    const shown = [];
    const v = createSdVoice({ show: (text, secs) => shown.push({ text, secs, at: t }), now: () => t });
    const events = [[L, () => v.say(fell)], [L + 152, () => v.say(readout, SD_VOICE_RANK.readout)]];
    if (earned) events.push([Math.max(L, 1200), () => v.say(SD_SPOILS_TEXT.spilled, SD_VOICE_RANK.note)]);
    else events.push([SD_RECEIPT_WAIT_MS, () => v.say(SD_SPOILS_TEXT.none, SD_VOICE_RANK.note)]);
    events.push([SD_REM_SINK_MS, () => v.say(SD_HOME_TEXT.rises)]);   // modes.frame, after the fight's frame
    for (; t <= 20_000; t += 16) { for (const [at, say] of events) if (at > t - 16 && at <= t) say(); v.frame(); }
    return shown;
  };
  for (const L of [16, 250, 900]) {
    const shown = kill(L, true);
    for (const text of [fell, SD_SPOILS_TEXT.spilled, readout, SD_HOME_TEXT.rises]) assert.ok(whole(shown, text), `L ${L} ms: "${text}" read whole - ${JSON.stringify(shown.map((x) => [x.text.slice(0, 16), x.at]))}`);
  }
  for (const L of [16, 250]) {
    const shown = kill(L, false);
    for (const text of [fell, readout, SD_SPOILS_TEXT.none, SD_HOME_TEXT.rises]) assert.ok(whole(shown, text), `no spoils, L ${L} ms: "${text}" read whole - ${JSON.stringify(shown.map((x) => [x.text.slice(0, 16), x.at]))}`);
  }
  assert.equal(SD_REM_SINK_MS, SD_RECEIPT_WAIT_MS, 'the two due the same instant - the case the voice must hold');
  // a line nearly read is not said again; a thread's line its newer word replaced is not put back
  const r = [];
  let t = 0;
  const v = createSdVoice({ show: (text) => r.push(text), now: () => t, seconds: () => 2 });
  v.say('A note.', SD_VOICE_RANK.note);
  t = 2000 - SD_VOICE_READ_MS + 50; v.say('A turn.');
  t = 2000 - SD_VOICE_READ_MS + 60; v.say('A count.', SD_VOICE_RANK.note, 'k');
  t = 2000 - SD_VOICE_READ_MS + 70; v.frame();
  for (t = 5000; t < 20_000; t += 16) v.frame();
  assert.deepEqual(r, ['A note.', 'A turn.', 'A count.'], 'the note had under a second left: read');
  const h = [];
  const w = createSdVoice({ show: (text) => h.push(text), now: () => t, seconds: () => 2 });
  t = 0; w.say('Ann breaks a Heart. 4 remain.', SD_VOICE_RANK.note, 'hearts');
  t = 100; w.say('A turn.');
  t = 200; w.say('Bran breaks a Heart. 3 remain.', SD_VOICE_RANK.note, 'hearts');
  for (t = 300; t < 20_000; t += 16) w.frame();
  assert.deepEqual(h, ['Ann breaks a Heart. 4 remain.', 'A turn.', 'Bran breaks a Heart. 3 remain.'], 'the thread said anew, its cut word never back');
  const u = [];
  const x = createSdVoice({ show: (text) => u.push(text), now: () => t, seconds: () => 2 });
  t = 0; x.say('Ann breaks a Heart. 4 remain.', SD_VOICE_RANK.note, 'hearts');
  t = 100; x.say('The Reset lands!', SD_VOICE_RANK.turn, 'hearts');
  for (t = 200; t < 20_000; t += 16) x.frame();
  assert.deepEqual(u, ['Ann breaks a Heart. 4 remain.', 'The Reset lands!'], 'its own thread\'s more urgent word: the older never back');
  // the cut line at the HEAD of its rank - said before the one of its rank that waited behind it
  const o = [];
  const y = createSdVoice({ show: (text) => o.push(text), now: () => t, seconds: () => 2 });
  t = 0; y.say('First note.', SD_VOICE_RANK.note);
  t = 100; y.say('Second note.', SD_VOICE_RANK.note);
  t = 200; y.say('A turn.');
  for (t = 300; t < 20_000; t += 16) y.frame();
  assert.deepEqual(o, ['First note.', 'A turn.', 'First note.', 'Second note.']);
});

/** The voice into DFU's own label, ticked as hud.js ticks it - only with no window up - and what the player reads. */
function labelled() {
  let t = 0, cover = false;
  const label = new MidScreenText(), sets = [];
  const read = [];   // each line written: [text, ms it stood in sight]
  const v = createSdVoice({ show: (text, secs) => { sets.push({ text, t, cover }); read.push([text, 0]); label.set(text, secs); }, now: () => t, covered: () => cover });
  const step = (ms = 16) => {
    t += ms;
    if (!cover) label.tick(ms / 1000);
    v.frame();
    if (!cover && label.text) read.at(-1)[1] += ms;
  };
  return { v, sets, read, step, to: (ms) => { while (t < ms) step(); }, cover: (c) => { cover = c; }, at: () => t, label };
}

test('SD26 THE HOUR\'S VOICE STANDS STILL UNDER A WINDOW (T3): DFU\'s label is ticked only with no window up (hud.js) and not drawn at all under one that stops the game - and the voice ran on, on the page\'s clock: each line taken as read as its seconds passed, the next written over the hidden one, so at the kill with the pack open the player met only "The way home stands open.", and a 0:30 readout said under a window stood after it with fifteen seconds left. Covered (world.js sdVoiceCovered: the dungeon slot\'s window), nothing is written; the line standing and the turns\' and notes\' waits stand still with the label; a readout whose moment passes under it is let go; a turn said under it cuts what stood (mutants: the window unread; the standing line\'s clock run on; the turns\' waits aged; a readout kept past its moment; the turn under it queued; a line written under it)', () => {
  const fell = SD_BLOWS_TEXT.fell, readout = sdCollapseLine(SD_COLLAPSE_MS, { hour: true, first: true });
  // the kill, the pack opened 0.3 s in and closed at 20 s
  const a = labelled();
  a.v.say(fell);
  a.to(152); a.v.say(readout, SD_VOICE_RANK.readout);
  a.to(300); a.cover(true);
  a.to(1208); a.v.say(SD_SPOILS_TEXT.spilled, SD_VOICE_RANK.note);
  a.to(4000); a.v.say(SD_HOME_TEXT.rises);
  a.to(20_000);
  assert.deepEqual(a.sets.filter((x) => x.cover), [], 'nothing written under the window');
  a.cover(false); a.to(40_000);
  const secs = (text) => courtSaySeconds(text) * 1000;
  assert.deepEqual(a.read.map((r) => r[0]), [fell, SD_HOME_TEXT.rises, SD_SPOILS_TEXT.spilled], 'what the player read: the fall, then the way home, then the floor\'s word - the readout\'s moment passed under the window');
  for (const [text, ms] of a.read) assert.ok(ms >= secs(text) - 40, `"${text}" stood its ${secs(text)} ms in sight (${ms})`);
  // a readout said under a window, closed 15 s on: never shown with its stale count
  const b = labelled();
  b.cover(true); b.step();
  b.v.say('The Hour collapses in 0:30.', SD_VOICE_RANK.readout);
  b.to(15_000); b.cover(false); b.to(30_000);
  assert.deepEqual(b.read, [], 'its moment passed: let go');
  assert.deepEqual(b.sets, []);
  // a turn said under a long window: still read after it (its wait stood still)
  const c = labelled();
  c.cover(true); c.step();
  c.v.say(SD_HOME_TEXT.rises);
  c.to(SD_VOICE_WAIT_MS[SD_VOICE_RANK.turn] * 2); c.cover(false); c.to(SD_VOICE_WAIT_MS[SD_VOICE_RANK.turn] * 2 + 3000);
  assert.deepEqual(c.read.map((r) => r[0]), [SD_HOME_TEXT.rises]);
  // a readout standing as the window came up, a turn said under it: on its closing the turn, the readout after it whole
  const d = labelled();
  d.v.say(readout, SD_VOICE_RANK.readout); d.step(); d.to(500);
  d.cover(true); d.to(1000); d.v.say(SD_BEAT_TEXT.moment.main); d.to(3000);
  d.cover(false); d.to(20_000);
  assert.deepEqual(d.read.map((r) => r[0]), [readout, SD_BEAT_TEXT.moment.main, readout]);
  assert.ok(d.read[2][1] >= secs(readout) - 40, 'the readout read whole after');
  // the host's cover, from its own text: the dungeon slot's window, or a window that stops the game
  const line = W.match(/\n {2}const sdVoiceCovered = [^\n]*\n/)[0];
  const coveredBy = (ctx) => new Function('modes', `${line}return sdVoiceCovered();`)({ dungeonCtx: ctx });
  assert.equal(coveredBy({ overlayWindow: () => null, uiOverlayActive: false }), false, 'no window: the voice speaks');
  assert.equal(coveredBy({ overlayWindow: () => ({}), uiOverlayActive: false }), true, 'a window up');
  assert.equal(coveredBy({ overlayWindow: () => null, uiOverlayActive: true }), true, 'the game stopped');
  assert.equal(new Function('modes', `${line}return sdVoiceCovered();`)(undefined), false, 'before the mode machine stands');
});

test('SD26 THE MESSAGE LINE OVER THE CARDS (T4): the marks card as I arrive (gateMarksView.js, z 31) and the kill\'s damage chart (gateDamageChart.js, z 31) stand in a corner that reaches the line\'s band (`.hudmid`, z 4) on a phone held upright, on one held sideways and on a laptop with the party up - and SD-ALONE\'s "Your companions cannot follow you through the Rift.", said as the card begins, stood under it unread, as did the collapse\'s first readout and the way home\'s word under the chart. While either stands the line stands over it, wherever the player moved it; with neither it keeps its place under every window (mutants: the line under the card; the line under the chart; the line between)', () => {
  const zOf = (css, sel) => Number(new RegExp(`(?:^|\\n)\\${sel} \\{[^}]*?z-index: (\\d+)`).exec(css)?.[1]);
  const line = zOf(ENHANCED_CSS, '.hudmid'), card = zOf(MARKS_CARD_CSS, '.wb-marks-card'), chart = zOf(DAMAGE_CHART_CSS, '.wb-dmg-chart');
  assert.ok(line < 5 && card > line && chart > line, `at rest the line is the HUD's (${line}), under the cards (${card}, ${chart}) and every window`);
  for (const [css, cls, z] of [[MARKS_CARD_CSS, 'wb-marks-card', card], [DAMAGE_CHART_CSS, 'wb-dmg-chart', chart]]) {
    const up = new RegExp(`body:has\\(\\.${cls}:not\\(\\[style\\*="display: none"\\]\\)\\) \\.hudmid \\{ z-index: (\\d+); \\}`).exec(css);
    assert.ok(up && Number(up[1]) > z, `.${cls} standing: the line over it (${up?.[1]} over ${z})`);
  }
  // the selector's word is the cards' own hide
  for (const f of ['src/ui/gateMarksView.js', 'src/ui/gateDamageChart.js']) assert.match(read(f), /root\.style\.display = want \? '' : 'none';/, f);
});

test('SD26 THE MESSAGE LINE ITS OWN WIDTH, ON THE SCREEN AT EVERY HUD SCALE (T5): `.hudmid` is fixed at left 50% with no width, so it shrank to the half of the screen right of it and its 86vw cap never held - a 390 px phone wrapped every line at 195 px, the Hour\'s longest into four rows over the ground\'s warning (enhancedHelm.js\'s bar had the same cause). Its width is its content\'s, to the cap - and the cap is divided by the HUD scale, which grows the box after it is laid out: the cap alone put a scale-2 line off both sides (in headless Chromium: 27-363 px on a 390 px phone and 300-980 on a 1280 px screen at every scale 0.5-2). The prison\'s line, never scaled, keeps the cap whole (mutants: the half-screen squeeze; the cap unscaled; the prison\'s cap scaled)', () => {
  const rule = (sel) => new RegExp(`\\n${sel.replace(/\./g, '\\.')} \\{([^}]*)\\}`).exec(ENHANCED_CSS)?.[1] ?? '';
  const mid = rule('.hudmid'), prison = rule('.hudmid.hudprison');
  assert.match(mid, /transform: translateX\(-50%\) scale\(var\(--hud-scale, 1\)\);/, 'grown by the HUD scale after layout');
  assert.match(mid, /left: 50%;/);
  assert.match(mid, /width: max-content; max-width: calc\(min\(680px, 86vw\) \/ var\(--hud-scale, 1\)\);/, 'its content\'s width, to the cap over the scale');
  assert.doesNotMatch(prison, /scale\(/, 'the prison\'s line is never scaled');
  assert.match(prison, /max-width: min\(680px, 86vw\);/, 'so its cap is whole');
});

/** A document the bar is drawn into (wb9a's). */
function fakeDoc() {
  const node = (tag) => {
    const n = { tag, style: {}, className: '', textContent: '', children: [], append(...c) { this.children.push(...c); }, remove() { this.gone = true; }, setAttribute() {} };
    let html = '';
    Object.defineProperty(n, 'innerHTML', { get: () => html, set: (v) => { html = v; } });
    return n;
  };
  const styles = [];
  return { doc: { createElement: node, body: node('body'), head: { append: (s) => styles.push(s) }, getElementById: (id) => styles.find((s) => s.id === id) ?? null } };
}

test('SD26 THE REMNANT\'S BAR IN ITS OWN COLOURS (T6): SD20e T3 took Dagon\'s red and the gate\'s orange off the Hour\'s banner and card, and the bar kept both - the Reset and the End on Dagon\'s pulsing blood-red plate in the gate\'s cream, the omens\' signs on its row the gate\'s orange beside the card\'s brass, its last minute pulsing the gate\'s red. On the brass bar the call stands on a brass plate in its own colour (the Mantella\'s green, the End\'s red) over both skins\' dagon rules; the omens\' signs are the card\'s brass, written again when one node turns from the gate\'s fight to the Hour\'s; the last minute pulses brass; the gate keeps its own (mutants: the Hour on Dagon\'s plate; the call in the gate\'s cream; the omens the gate\'s orange; the look unread by the row; the last minute the gate\'s red)', () => {
  const NOW = 1_800_000_000_000;
  const s = { fi: 2, ph: 3, op: NOW - 600_000, ou: 0, su: 0, h: 300, m: 1000, rem: { x: 0, z: 0, yw: 0, mv: null, atk: { k: 'atk', b: SD_BODY.remnant, i: 7, a: SD_BLOWS.reset.id, at: NOW + 4000, x: 0, z: 0, yw: 0, tg: [] } }, ec: null, clk: null, cx: { i: 7, m: 500, c: [[6, 0, 100], [-6, 0, 100], [0, 6, 100]] }, fell: null, lost: 0, ends: NOW + 9e6, mk: ['blades', 'quickened', 'hardened'] };
  const m = remnantBarModel(s, NOW);
  assert.equal(m.theme, 'brass'); assert.ok(m.callout.dagon); assert.equal(m.callout.color, SD_BAR_CSS.reset);
  const { doc } = fakeDoc();
  destroyGateBossBar();
  drawGateBossBar(m, { doc });
  const root = doc.body.children[0];
  assert.match(root.className, /\bbrass\b/);
  const find = (n, cls) => (n.className?.split?.(' ').includes(cls) ? n : n.children?.map((c) => find(c, cls)).find(Boolean) ?? null);
  const callout = find(root, 'wb-boss-callout');
  assert.match(callout.className, /\bdagon\b/); assert.equal(callout.style.color, SD_BAR_CSS.reset, 'the call\'s own colour on its node');
  // its plate: the brass, the call's colour inherited - over the classic sheet's and the Plus skin's dagon rules
  const brass = /\n\.wb-boss-bar\.brass \.wb-boss-callout\.dagon \.wb-boss-callout-text \{([^}]*)\}/.exec(BOSS_BAR_CSS)?.[1] ?? '';
  assert.match(brass, /color: inherit;/, 'the call\'s own colour, not the gate\'s cream');
  assert.match(brass, /animation-name: wb-brass-plate;/, 'its own plate');
  const plate = /@keyframes wb-brass-plate \{ from \{ background: rgba\((\d+),(\d+),(\d+)[^}]*\} to \{ background: rgba\((\d+),(\d+),(\d+)/.exec(BOSS_BAR_CSS);
  assert.ok(plate && Number(plate[1]) - Number(plate[3]) < 2.5 * (Number(plate[2]) - Number(plate[3])) && Number(plate[4]) - Number(plate[6]) < 2.5 * (Number(plate[5]) - Number(plate[6])), 'brass, never blood');
  const classes = (sel) => (sel.match(/\.[\w-]+/g) ?? []).length;
  const plus = /\n(body \.wb-boss-callout\.dagon \.wb-boss-callout-text) \{/.exec(ONLINE_DRESS_CSS)?.[1];
  assert.ok(plus && classes('.wb-boss-bar.brass .wb-boss-callout.dagon .wb-boss-callout-text') > classes(plus), 'over the Plus skin\'s cream');
  // the omens' signs in the card's brass; the same marks under the gate's look, the gate's orange
  const row = find(root, 'wb-boss-marks');
  const signs = () => row.children.map((c) => c.children[0].children[0].style.color);
  assert.deepEqual(signs().slice(1), ['#e8c060', '#e8c060'], 'the omens the Hour\'s brass');
  drawGateBossBar({ ...m, theme: undefined }, { doc });
  assert.deepEqual(signs().slice(1), ['#ffb27a', '#ffb27a'], 'one node, the gate\'s look: its own orange again');
  destroyGateBossBar();
  // its last minute: brass
  assert.match(BOSS_BAR_CSS, /\n\.wb-boss-bar\.brass \.wb-boss-wrath\.near \{[^}]*animation-name: wb-brass-near;[^}]*\}/);
  assert.match(BOSS_BAR_CSS, /\n\.wb-boss-wrath\.near \{[^}]*animation: wb-wrath-near /, 'the gate\'s own still red');
});

// ── the host's chat (sd19_presence's small world: Copperham and The Old Maze) ─────────────────────────────────────
const place = (region, index, px, py, type, { name, w = 1, h = 1, buildings = 0, blocks = 0 } = {}) => ({
  name, regionIndex: region, locationIndex: index, hasDungeon: blocks > 0,
  mapTableData: { mapId: py * 1000 + px, locationType: type, longitude: 0, latitude: 0 },
  exterior: { exteriorData: { width: w, height: h, locationId: py * 1000 + px }, buildingCount: buildings },
  ...(blocks ? { dungeon: { blocks: Array.from({ length: blocks }, (_, i) => ({ blockName: `${i % 3 ? 'N' : 'B'}0000${i}.RDB`, x: i, z: 0, isStartingBlock: !i })), recordElement: { header: { locationId: py * 1000 + px } } } } : {}),
});
function smallWorld(places) {
  const regions = [0, 1].map(() => ({ mapTable: [], mapNames: [] }));
  for (const p of places) { regions[p.regionIndex].mapTable[p.locationIndex] = { mapId: p.mapTableData.mapId, locationType: p.mapTableData.locationType }; regions[p.regionIndex].mapNames[p.locationIndex] = p.name; }
  return { regionCount: 2, getRegion: (r) => regions[r], getClimateIndex: (x) => (x < 100 ? CLIMATES.Ocean : 231), getPoliticIndex: (x) => (x < 100 ? 0 : 128 + (x < 500 ? 0 : 1)), getRegionIndexAt: (x) => (x < 500 ? 0 : 1) };
}

test('SD26 A HOLLOW FOUND IN ITS LAST HOUR IS FOUND BEFORE IT FADES (T7): the host\'s frame said SD19\'s last-hour line before the finds it owed (heard() only queues a find; the frame says it) - a Hollow found with forty minutes left was "will fade within the hour" in chat before anyone heard it was found. The find, then its marks, then its last hour, on one frame (mutants: the hour before the find)', () => {
  const M = 60_000;
  const CITY = place(0, 0, 300, 200, LOCATION_TYPES.TownCity, { name: 'Copperham', w: 3, h: 3, buildings: 80 });
  const LAB = place(0, 1, 450, 400, LOCATION_TYPES.DungeonLabyrinth, { name: 'The Old Maze', blocks: 14 });
  const SCAN = scanGatePixels(smallWorld([CITY, LAB]), { heightAt: () => 90 });
  const s = { clock: T0, lines: [] };
  const host = createSdHost({
    now: () => s.clock, scan: () => SCAN, warmScan() {}, cities: (r) => sdCities([CITY], r, { regionNameOf: () => 'Nowhere' }),
    templates: () => sdTemplates([LAB], isMainStoryDungeon), where: () => ({ regionIndex: 0, regionName: 'Alik\'r Desert' }),
    stand() {}, unstand() {}, inside: () => false, door: () => null, feet: () => null, sendFound: () => true,
    say: (text) => s.lines.push(text), regionName: () => 'Alik\'r Desert',
  });
  const risen = sdRise(sdFirst(T0 - SD_LIFETIME_MS - 20 * M), T0 - SD_LIFETIME_MS + 40 * M, 0);   // rose 47 h 20 m ago
  host.heard({ k: 'ev', ...risen }); host.frame();
  assert.deepEqual(s.lines, [], 'only risen: no news');
  s.clock += 1000;
  const found = sdFind(risen, s.clock, 'Mara');
  assert.ok(found.until - s.clock < SD_HOUR_LEFT_MS, 'found in its last hour');
  host.heard({ k: 'ev', ...found }); host.frame();
  const name = host.hollow().loc.name;
  assert.equal(s.lines.length, 3);
  assert.match(s.lines[0], /^Mara has found an Abyss Dungeon near Copperham/, 'the find first');
  assert.deepEqual(s.lines.slice(1), [sdMarksLine({ name, s: found.s }), sdHourLine({ name, near: 'Copperham' })], 'then its marks, then its last hour');
});

test('SD26 THE STONE\'S PLAQUE NEVER OFFERS A TURN THE CONCORD REFUSES (T8): once the Concord holds a press on a handle only says "The Concord holds. The stones will not turn again." - and every handle\'s plaque still read "Turn it forward" / "Turn it back" (Online-Arc A5: the plaque never promises what the click would not do). Before it, the handle\'s way; after it, its hour still and that the Concord holds - a word that arrives with it already held the same (mutants: the turn offered after the Concord)', () => {
  const said = [], o = orreryOf(7);
  const hall = createSdHall({ s: 7, say: (t) => said.push(t), now: () => 0 });
  hall.frame(0.016, null, { s: 7, st: [...o.start], lit: 0, f: 0 });
  assert.deepEqual(hall.hoverName('sdstone:0:f').subs, [SD_HALL_TEXT.hour(o.start[0]), SD_HALL_TEXT.forward]);
  assert.equal(hall.hoverName('sdstone:3:b').subs[1], SD_HALL_TEXT.back);
  const truth = o.start.map((h, i) => (h + i) % 12);
  hall.frame(0.016, null, { s: 7, st: truth, lit: 6, f: 0, ok: true });
  assert.ok(hall.concord);
  for (const k of ['sdstone:0:f', 'sdstone:0:b', 'sdstone:5:f']) {
    const i = Number(k.split(':')[1]);
    assert.deepEqual(hall.hoverName(k).subs, [SD_HALL_TEXT.hour(truth[i]), SD_HALL_TEXT.held], `${k}: its hour, and that the Concord holds`);
  }
  assert.equal(hall.press('sdstone:0:f'), true);
  assert.equal(said.at(-1), SD_HALL_TEXT.still, 'the press says why');
  assert.ok(SD_HALL_TEXT.still.startsWith(SD_HALL_TEXT.held), 'the plaque\'s row the press\'s own first words');
  // a hall first heard with the Concord held: the same
  const late = createSdHall({ s: 7, now: () => 0 });
  late.frame(0.016, null, { s: 7, st: truth, lit: 6, f: 0, ok: true });
  assert.equal(late.hoverName('sdstone:2:b').subs[1], SD_HALL_TEXT.held);
});

test('SD26 WB13B\'S WORDS OVER THE LINES SINCE SD11 (T9): L6 F21 made WB13b\'s wording law "a law over every line the arc says" - no dash aside, no colon gloss, no "X, not Y", nothing shouted - and its pin (sd11d arcLines) never read a line added after it: the marks line said with every find hung its signature between dashes ("the Ending of Sentinel - Sunfall - under ..."), and three of the card\'s tips broke it ("Jump its Stomp\'s ring - it reaches the rim.", "... three quarters round - keep a pillar near.", "Move at the word, not the fill."). The signature is the Ending\'s own between commas, the tips said plainly, and sd11d reads them all now (mutants: the marks line dashed; each tip as it was)', () => {
  const rule = (s) => [/\S - \S/.test(s) && 'a dash aside', /[a-z]: [a-z]/i.test(s.replace(/\b\d{1,2}:\d{2}\b/g, '')) && 'a colon gloss', /, not \w/.test(s) && '"X, not Y"', /\b[A-Z]{3,}\b/.test(s) && 'shouted'].filter(Boolean);
  for (let s = 1; s <= 216; s++) {
    const line = sdMarksLine({ name: 'The Stopped Bell', s }), E = sdEndingOf(sdMarksOf(s));
    assert.deepEqual(rule(line), [], `slot ${s}: ${line}`);
    assert.ok(line.startsWith(`The Stopped Bell keeps the Ending of ${E.stone}, its ${E.sig.replace(/^The /, '')}, under the `), line);
  }
  assert.equal(sdMarksLine({ name: 'The Stopped Bell', s: SLOT_SENTINEL }).split(', under')[0], 'The Stopped Bell keeps the Ending of Sentinel, its Sunfall');
  for (const [k, v] of Object.entries(SD_MARK_TIPS)) assert.deepEqual(rule(v), [], `tip ${k}: ${v}`);
  assert.deepEqual([SD_MARK_TIPS.daggerfall, SD_MARK_TIPS.wayrest, SD_MARK_TIPS.quickened], ['Its Stomp\'s ring reaches the rim. Jump it.', 'Its Hand reaches three quarters round. Keep a pillar near.', 'Move at the word, before the fill.']);
  // and the law's own pin reads them, with the last hour's, the turn's wait and the claim's words
  assert.match(read('test/sd11d_words.test.js'), /add\(`marks\.\$\{E\.id\}`, sdMarksLine\([\s\S]{0,400}walk\('tip', SD_MARK_TIPS\);\n {2}return out;/);
});
