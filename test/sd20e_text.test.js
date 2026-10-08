// AUDIT SD III, SD20e (2026-10-08, Mac: "a deep comprehensive audit over everything, ensuring absolute polish and
// perfection"; bible/11-Multiplayer/Super-Dungeons.md "AUDIT SD III"): WHAT THE PLAYER READS - the text and the HUD
// lens's findings, each reproduced and pinned here: the door's banner on a phone and in the Hour's brass (T1, T3), the
// title card clear of the Remnant's bar (T2), the Hour's card on the Plus skin (T4), the Echo's callout standing still
// (T5), one count of time (T6), the ring's card on the held map (T7), the Dragon's two names and its window's one form
// (T9, T14), the Hour's word for its fall (T10), the marks' line, the rumour and the omen said plainly (T11-T13), the
// player's word for an Abyss Dungeon (T15), the Features rows (T16), the readouts under the veil (T18) and a region
// said as a region (T19).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawGateBanner, destroyGateBanner, GATE_BANNER_CSS, SD_BANNER_BRASS } from '../src/ui/gateBanner.js';
import { sdBannerText, sdMarksLine, sdHourLine, SD_ENDING_RUMOR } from '../src/systems/sdOmen.js';
import { sdFirst, sdRise, sdFind, sdFell, sdWhere, sdFoundLine, SD_CAST_OUT_LINE, SD_COLLAPSE_MS } from '../src/net/sdLaw.js';
import { SD_TITLE_CSS } from '../src/ui/sdTitleCard.js';
import { GROUND_VIEW_CSS, PERIL_ARROW_R, PERIL_ARROW_R_LOW } from '../src/ui/gateGroundView.js';
import { drawGateMarksCard, destroyGateMarksCard } from '../src/ui/gateMarksView.js';
import { sdMarksCardModel, SD_MARK_TIPS, SD_MARKS_ARRIVE_MS } from '../src/ui/sdMarksView.js';
import { remnantBarModel, SD_BAR_TEXT } from '../src/ui/sdRemnantBar.js';
import { drawGateBossBar, destroyGateBossBar, BOSS_BAR_TEXT } from '../src/ui/gateBossBar.js';
import { SD_PHASE_NAMES, SD_ECHO_PAIR_MS } from '../src/net/sdRemnant.js';
import { SD_ENDINGS, SD_OMENS, sdMarksOf } from '../src/net/sdMarks.js';
import { SD_FIGHT_TEXT } from '../src/net/sdFightLink.js';
import { sdBreakSub } from '../src/scenes/sdArenaRead.js';
import { sdRiftCount, SD_COUNT_TEXT } from '../src/world/sdDungeon.js';
import { timerText } from '../src/systems/eventTimers.js';
import { sdCollapseLine, sdFadeReadout } from '../src/scenes/sdHost.js';
import { SD_HOME_TEXT } from '../src/scenes/sdEnd.js';
import { SD_REALM_TEXT } from '../src/world/sdRealm.js';
import { FEATURES } from '../src/systems/features.js';
import { HeldMapWindow } from '../src/ui/heldMap.js';
import { toPaper, GATE_RING_MIN_PX } from '../src/ui/inkMap.js';
import { CLIMATES, LOCATION_TYPES, getMapPixelID } from '../src/formats/mapsFile.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = read('src/scenes/world.js');
const T0 = 1_800_000_000_000, M = 60_000, H = 3_600_000;
const MK = ['blades', 'quickened', 'hardened'];

/** A document of plain objects that keeps what is made of it (test/wb13c_hud.test.js's shape). */
function fakeDoc() {
  const heads = [];
  const node = (tag) => ({ tag, style: {}, className: '', textContent: '', innerHTML: '', id: '', children: [], append(...c) { this.children.push(...c); }, remove() { this.gone = true; }, setAttribute() {} });
  return { heads, doc: { createElement: node, body: node('body'), head: { append: (s) => heads.push(s) }, getElementById: (id) => heads.find((s) => s.id === id) ?? null } };
}

// ── T1, T3: the door's banner ─────────────────────────────────────────

test('SD20e THE DOOR\'S BANNER (T1, T3): its name and its state, what it is left to the card beside it - a long name no longer runs it off both sides of a phone, for it wraps inside the screen; and an Abyss Dungeon\'s door stands in the Hour\'s brass, outlined on the Plus skin as the gate\'s is, never Dagon\'s red (mutants: "an Abyss Dungeon" back in the banner; nowrap back; the brass never put on, or never taken off)', () => {
  const found = sdFind(sdRise(sdFirst(T0 - 20 * M), T0 - 10 * M, 0), T0, 'Mara');
  const long = 'The Hollow Under Glenpoint Foothills';
  assert.equal(sdBannerText(long, found, T0), `${long} - fades in ${timerText(found.until - T0)}`);
  assert.equal(sdBannerText('', found, T0), `An Abyss Dungeon - fades in ${timerText(found.until - T0)}`, 'nameless: what it is, once');
  assert.doesNotMatch(GATE_BANNER_CSS, /nowrap/, 'it wraps');
  assert.match(GATE_BANNER_CSS, /width: max-content; max-width: calc\(100vw - 32px\); text-align: center;/, 'inside the screen, a 16px gutter each side');
  assert.match(GATE_BANNER_CSS, new RegExp(`\\.wb-gate-banner\\.sd-brass \\{ color: ${SD_BANNER_BRASS};`));
  assert.match(read('src/ui/enhancedPlusStyle.js'), /body \.wb-gate-banner \{ \$\{PIXEL_FONT_CSS\} font-size: 14px; letter-spacing: 0\.14em; text-shadow: \$\{OUTLINED\}; \}\nbody \.wb-gate-banner\.sd-brass \{ text-shadow: \$\{OUTLINED\}; \}/, 'the Plus skin\'s outline over the brass glow too');
  const { doc } = fakeDoc();
  destroyGateBanner();
  drawGateBanner('The Stopped Bell - fades in 1d 22h', { look: 'brass', doc });
  const node = doc.body.children.find((c) => c.className.startsWith('wb-gate-banner'));
  assert.equal(node.className, 'wb-gate-banner sd-brass');
  drawGateBanner('Dagon\'s Breach - opens in 4:00', { doc });
  assert.equal(node.className, 'wb-gate-banner', 'the gate\'s own again');
  drawGateBanner('The Stopped Bell - fades in 1d 22h', { look: 'brass', doc });
  assert.equal(node.className, 'wb-gate-banner sd-brass');
  destroyGateBanner();
  assert.match(W, /drawGateBanner\(_gateBannerWish \?\? sb\?\.text \?\? null, \{ hidden, look: _gateBannerWish == null && sb \? 'brass' : 'gate' \}\);/, 'the world: brass for a Hollow\'s door alone');
});

test('SD20e THE HOUR\'S CARD IN ITS BRASS (T3): the marks card a fighter steps in to - and the one at a Hollow\'s door - wears the Hour\'s brass and its omens\' signs in it; the gate\'s card keeps its red (mutants: the look unmodelled; the class unput; the omens\' signs red)', () => {
  const m = sdMarksCardModel(MK, { since: 0, now: 1000 });
  assert.equal(m.look, 'brass');
  assert.equal(sdMarksCardModel(MK, { mode: 'gate' }).look, 'brass', 'at its door too');
  const { doc } = fakeDoc();
  destroyGateMarksCard();
  drawGateMarksCard(m, { doc });
  const root = doc.body.children.find((c) => c.className.startsWith('wb-marks-card'));
  assert.equal(root.className, 'wb-marks-card wb-marks-arrive sd-brass');
  const icons = root.children.slice(2).map((r) => r.children[0].style.color);
  assert.deepEqual(icons.slice(1), ['#e8c060', '#e8c060'], 'its omens\' signs in its brass');
  drawGateMarksCard({ ...m, look: undefined, key: 'gate' }, { doc });
  assert.equal(root.className, 'wb-marks-card wb-marks-arrive', 'a card with no look is the gate\'s');
  assert.deepEqual(root.children.slice(3).map((r) => r.children[0].style.color), ['#ffb27a', '#ffb27a'], 'its trials in the gate\'s own');
  destroyGateMarksCard();
});

// ── T2, T4: the title card on a phone and on the Plus skin ───────────

test('SD20e THE TITLE CARD CLEAR OF THE BAR (T2, T4): on a phone held upright the Hour\'s card stands under the Remnant\'s bar and its foot (at 30% it sat on the foot\'s chips); held sideways there is no room for both, so the foot\'s chips step aside while a beat stands; the way out\'s chevron rides a smaller ring there (at 72 it stood on the bar\'s plate); and the Plus skin dresses the card in the HUD\'s face (mutants: each old number back; the foot never stepping aside)', () => {
  assert.match(SD_TITLE_CSS, /@media \(max-width: 640px\) \{ \.sd-title-card \{ top: 40%; \}/);
  assert.match(SD_TITLE_CSS, /@media \(max-height: 480px\) \{ \.sd-title-card \{ top: 46%; \}/);
  assert.match(SD_TITLE_CSS, /@media \(max-height: 480px\) \{ body:has\(\.sd-title-card\.on:not\(\[style\*="display: none"\]\)\) \.wb-boss-foot \{ display: none; \} \}/);
  assert.ok(PERIL_ARROW_R_LOW < PERIL_ARROW_R && PERIL_ARROW_R_LOW === 36);
  assert.match(GROUND_VIEW_CSS, new RegExp(`@media \\(max-height: 480px\\) \\{ \\.wb-ground-arrow svg \\{ top: ${-PERIL_ARROW_R_LOW - 14}px; \\} \\}`));
  const plus = read('src/ui/enhancedPlusStyle.js');
  for (const part of ['card', 'kicker', 'main', 'rule', 'sub']) assert.match(plus, new RegExp(`body \\.sd-title-${part} \\{`), `the Plus skin's ${part}`);
  assert.match(plus, /body \.sd-title-card \{ \$\{PIXEL_FONT_CSS\}/, 'in the HUD\'s face');
});

// ── T5, T10: the bar ───────────────────────────────────────────────────

const NOW = T0 + 10 * M;
const fight = (o = {}) => ({ fi: 1, ph: 1, h: 900, m: 1000, op: 0, ou: 0, su: 0, rem: { atk: null }, ec: null, cx: null, clk: null, ends: NOW + 10 * M, ended: null, n: 3, rk: 0, fell: null, lost: null, ...o });

test('SD20e THE ECHO\'S CALLOUT STANDS STILL, AND THE HOUR\'S FALL IS ITS OWN WORD (T5, T10): a fallen Echo\'s callout says its count after the dash, as every countdown the bar calls - its head the same each second, so the bar never brings it in afresh (it read "Gold rises in 12s", a new line each second); the Remnant fallen, the bar says "Undone", the Hour\'s word; the gate\'s bar still "Felled" (mutants: the count in the head; the gate\'s word on the Hour)', () => {
  const ec = (dn) => [{ h: 0, m: 5000, up: 0, dn, atk: null, x: 0, z: 0 }, { h: 2250, m: 5000, up: 0, dn: 0, atk: null, x: 0, z: 0 }];
  const heads = [0, 1000, 2000].map((t) => remnantBarModel(fight({ ph: 2, ec: ec(NOW - 3000) }), NOW + t).callout.text);
  assert.deepEqual(heads, ['Gold rises - 12s', 'Gold rises - 11s', 'Gold rises - 10s']);
  assert.equal(new Set(heads.map((h) => h.split(' - ')[0])).size, 1, 'one head');
  assert.equal(SD_BAR_TEXT.rises(1, 3), 'Silver rises - 3s');
  const fallen = remnantBarModel(fight({ h: 0, fell: { at: NOW - 500, top: 'Mara', n: 2 } }), NOW);
  assert.equal(fallen.fallenText, 'Undone');
  const { doc } = fakeDoc();
  destroyGateBossBar();
  drawGateBossBar(fallen, { doc });
  const root = doc.body.children.find((c) => c.className.startsWith('wb-boss-bar'));
  assert.equal(root.children[4].children[0].textContent, 'Undone', 'drawn');
  drawGateBossBar({ ...fallen, fallenText: undefined }, { doc });
  assert.equal(root.children[4].children[0].textContent, BOSS_BAR_TEXT.fallen, 'a bar with no word of its own: the gate\'s');
  assert.equal(BOSS_BAR_TEXT.fallen, 'Felled');
  destroyGateBossBar();
});

// ── T6: one count of time ──────────────────────────────────────────────

test('SD20e ONE COUNT OF TIME (T6): the Rift\'s plaque counts in the Timers\' own words - a day and its hours far off, the hours by the second within the day - as its banner, its card and the Timers row do; it counted "46h 12m" beside their "1d 22h" (mutants: a count of its own)', () => {
  const r = sdRise(sdFirst(T0 - 3 * H), T0 - 10 * M, 0);
  for (const left of [47 * H, 46.2 * H, 24 * H, 23.5 * H, H + 1, H, 59 * M, 12 * M + 4000, 2500, 300]) {
    assert.equal(sdRiftCount(r, r.s, r.until - left), SD_COUNT_TEXT.fades(timerText(left)), `${left} ms left`);
  }
  assert.equal(sdRiftCount(r, r.s, r.until - 46.2 * H), 'Fades in 1d 22h');
  const k = sdFell(sdFind(r, T0, 'Mara'), T0 + 2 * M, { top: 'Mara', n: 2 });
  assert.equal(sdRiftCount(k, k.s, k.fellAt + 29_000), SD_COUNT_TEXT.collapses(timerText(SD_COLLAPSE_MS - 29_000)));
  assert.doesNotMatch(read('src/world/sdDungeon.js'), /sdLongCount|countdownText/, 'no second count');
});

// ── T7: the ring's card on the held map ──────────────────────────────

function withDocument(fn) {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; }, addEventListener() {}, removeEventListener() {},
      setPointerCapture() {}, querySelectorAll: () => [], set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  globalThis.document = { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
  try { return fn(); } finally { delete globalThis.document; }
}

test('SD20e THE RING\'S OWN CENTRE IS A PLACE ON THE MAP (T7): an Abyss Dungeon stands two pixels out from its city, and at a far zoom the city\'s mark took its whole ring - its card unreachable. The ring answers where its centre is nearer the pointer than the mark is, and all it is drawn over (at least GATE_RING_MIN_PX on the paper); the city still answers on its own mark (mutants: the mark first; the ring\'s reach its map radius alone)', () => {
  _resetForTests(); globalThis.location = { search: '?skin=enhanced' };
  withDocument(() => {
    const town = { id: getMapPixelID(4, 4), mapID: 1, regionIndex: 17, mapIndex: 0, locationType: LOCATION_TYPES.TownCity, discovered: true };
    const ring = { day: 4, cx: 6.5, cy: 4.5, r: 1.25, label: 'The Stopped Bell - fades in 1d 22h', phase: 'found', tip: { title: 'The Stopped Bell, an Abyss Dungeon', lines: ['Near Copperham'] } };
    const win = new HeldMapWindow({
      getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => CLIMATES.Woodlands,
      woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
      gold: () => 10000, goldPieces: () => 10000, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
      sd: () => ring, mapDict: new Map([[town.id, town]]),
      maps: { regionCount: 18, getRegion: () => ({ mapNames: ['Copperham'] }), getPoliticIndex: () => 128 + 17 },
    });
    win.tick(0);
    win._layout(); win._view = { ox: 0, oy: 0, scale: 4 }; win._goal = { ...win._view };   // a far zoom: the two 8 px apart
    win._phase = 'map';
    const [rx, ry] = toPaper(win._view, ring.cx, ring.cy), [tx, ty] = toPaper(win._view, 4.5, 4.5);
    assert.ok(Math.hypot(rx - tx, ry - ty) < 16, 'the city\'s mark reaches the ring\'s centre');
    const onCore = win._hoverLabel(rx, ry);
    assert.equal(onCore.label, ring.label, 'its centre: the ring');
    assert.equal(onCore.tip?.title, ring.tip.title, 'and its card');
    assert.match(win._hoverLabel(tx, ty).label, /Copperham/, 'the city on its own mark');
    assert.match(win._hoverLabel(rx - 5, ry).label, /Copperham/, 'nearer the city than the centre: the city');
    // the ring's reach is what the paper draws: 1.25 map pixels is 5 px at this zoom, drawn as GATE_RING_MIN_PX
    assert.equal(GATE_RING_MIN_PX, 10);
    assert.equal(win._gateAt(rx, ry + 8)?.label, ring.label, 'inside the drawn ring, past its map radius');
    assert.equal(win._gateAt(rx, ry + 11), null, 'past the drawn ring');
    assert.equal(win._hoverLabel(rx + 8, ry).label, ring.label, 'beside it, off the city\'s reach: the ring');
    assert.equal(win._hoverLabel(rx + 6, ry + 14)?.label, 'Daggerfall', 'past the drawn ring, nothing near: the province');
    win.dispose();
  });
  delete globalThis.location;
});

// ── T9, T14: the Dragon's names and its window ───────────────────────

test('SD20e THE DRAGON\'S TWO NAMES AND ITS WINDOW\'S ONE FORM (T9, T14): no Ending\'s signature is a phase\'s name an apostrophe apart (the Blades\' "The Dragon\'s Break" stood beside the phase "The Dragon Break") - the Blades\' is the Dragon\'s Haste; and the window the Echoes must fall in is said one way wherever it is said - the beat, the turn\'s line, the omen and its tip - by the fight\'s own (mutants: the old signature; the window in another form; a fixed fifteen under the Blades)', () => {
  const norm = (s) => s.toLowerCase().replace(/['’]s\b/g, '').replace(/[^a-z]/g, '');
  const phases = new Set(SD_PHASE_NAMES.map(norm));
  for (const E of SD_ENDINGS) assert.ok(!phases.has(norm(E.sig)), `${E.id}: ${E.sig} is no phase's name`);
  assert.equal(SD_ENDINGS.find((E) => E.id === 'blades').sig, 'The Dragon\'s Haste');
  const form = /Fell Gold and Silver within (\d+|ten) seconds of each other/;
  assert.equal(sdBreakSub(10_000), 'Fell Gold and Silver within 10 seconds of each other');
  assert.equal(SD_FIGHT_TEXT.dragonBreak(10_000), 'The Dragon Break! Fell Gold and Silver within 10 seconds of each other.');
  assert.equal(SD_FIGHT_TEXT.dragonBreak(SD_ECHO_PAIR_MS), 'The Dragon Break! Fell Gold and Silver within 15 seconds of each other.');
  assert.match(SD_MARK_TIPS.blades, form);
  assert.match(SD_ENDINGS.find((E) => E.id === 'blades').text, /within ten seconds of each other/);
  assert.match(read('src/net/sdFightLink.js'), /SD_FIGHT_TEXT\.dragonBreak\(sdProfileOf\(state\)\.pairMs\)/, 'the turn\'s line by the fight\'s own window');
});

// ── T11, T12, T13: the lines said plainly ─────────────────────────────

test('SD20e THE LINES SAID PLAINLY (T11, T12, T13): every Hollow\'s marks line keeps its articles small inside it ("under the Quickened Gears", never "under The Quickened Gears"); the Underking\'s rumour says what the dead turn toward; no omen\'s words hang on a dash (mutants: the capitals back; "toward it"; the Restless omen garbled)', () => {
  for (let s = 1; s <= 216; s++) {
    const line = sdMarksLine({ name: 'The Stopped Bell', s });
    if (line) assert.doesNotMatch(line.slice(1), /\bThe /, `slot ${s}: ${line}`);
  }
  assert.ok(sdMarksOf(1));
  assert.equal(SD_ENDING_RUMOR.underking, 'the dead in their barrows turn their heads toward the walls');
  for (const [k, v] of Object.entries(SD_ENDING_RUMOR)) assert.doesNotMatch(v, /\bit$/, `${k}: no dangling "it"`);
  for (const O of SD_OMENS) assert.doesNotMatch(O.text, / - /, `${O.id}: said plainly`);
  assert.equal(SD_OMENS.find((O) => O.id === 'restless').text, 'Each Mantella Pulse climbs twice as fast, to three quarters of your health at most.');
});

// ── T15, T19: the player's word, and where ───────────────────────────

test('SD20e THE PLAYER\'S WORD FOR IT (T15): every line the Hour and its Hollow say to the player names it as the player knows it - the Abyss Dungeon (ABYSS-NAME), never the code\'s Hollow - the way home, the death, the cast-out, the collapse and the fade; and its unbeaten end fades, as its banner, ring and Timers say (mutants: "the Hollow" back in any of them)', () => {
  const lines = [
    ...Object.values(SD_HOME_TEXT), ...Object.values(SD_REALM_TEXT), SD_CAST_OUT_LINE,
    sdCollapseLine(SD_COLLAPSE_MS, { first: true }), sdCollapseLine(60_000), sdFadeReadout(30_000), sdFadeReadout(30_000, { hour: true }),
    SD_COUNT_TEXT.fades('1d 22h'), SD_COUNT_TEXT.collapses('2:31'),
  ].filter((x) => typeof x === 'string');
  assert.ok(lines.length >= 14);
  for (const l of lines) assert.doesNotMatch(l, /\bHollow\b/, l);
  assert.equal(SD_HOME_TEXT.to, 'To the Abyss Dungeon\'s door');
  assert.equal(SD_REALM_TEXT.wayBack, 'To the Abyss Dungeon');
  assert.equal(sdFadeReadout(30_000), 'The Abyss Dungeon fades in 0:30.');
  assert.equal(sdFadeReadout(30_000, { hour: true }), 'The Hour closes in 0:30.', 'the Hour closes as its Hollow fades');
});

test('SD20e A REGION SAID AS A REGION (T19): where no city is known, the find and the last hour name the region as a region - "in the Alik\'r Desert region" (it read "near Alik\'r Desert", the region\'s bare name after "near"); a city by its name; neither, the Bay (mutants: the region after "near"; the region unsaid)', () => {
  assert.equal(sdWhere('Copperham', 'Alik\'r Desert'), 'near Copperham', 'a city first');
  assert.equal(sdWhere('', 'Alik\'r Desert'), 'in the Alik\'r Desert region');
  assert.equal(sdWhere('', ''), 'near the Iliac Bay');
  assert.equal(sdWhere(), 'near the Iliac Bay');
  assert.equal(sdFoundLine({ who: 'Mara', region: 'Dragontail Mountains' }), 'Mara has found an Abyss Dungeon in the Dragontail Mountains region!');
  assert.equal(sdHourLine({ name: 'The Stopped Bell', region: 'Dragontail Mountains' }), 'The Stopped Bell in the Dragontail Mountains region will fade within the hour.');
  const H2 = read('src/scenes/sdHost.js');
  assert.match(H2, /const near = h\?\.site\?\.cityName \|\| '', region = regionName\(o\.rec\.r\) \|\| '';/);
  assert.match(H2, /sdHourLine\(\{ name: hh\?\.loc\?\.name, near: hh\?\.site\?\.cityName \|\| '', region: regionName\(rec\.r\) \|\| '' \}\)/);
});

// ── T16: the Features rows ─────────────────────────────────────────────

test('SD20e THE FEATURES ROWS SAID PLAINLY (T16): the size rows say which wins in a sentence that reads ("Smaller dungeons wins when both are on, this over medium" read as a slip); the world-sizes row says a quest keeps its size, as the medium row does; the look round is asked by selecting Info mode, again or not; a lever\'s own label says its way (mutants: each old wording back)', () => {
  const row = (id) => FEATURES.find((f) => f.id === id);
  const all = FEATURES.map((f) => f.note).join('\n');
  assert.doesNotMatch(all, /Smaller dungeons wins|this over medium|switching to Info mode|its World Tooltips label/);
  assert.match(row('medium-dungeons').note, /If Smaller dungeons is on too, it wins\./);
  assert.match(row('world-dungeon-sizes').note, /If Smaller dungeons is on too, it wins; this row wins over Medium dungeons\. A quest keeps the size it was set up at\./);
  assert.match(row('dungeon-sense').note, /^In a dungeon, selecting Info mode makes/);
  assert.match(row('dungeon-echoes').note, /a lever’s World Tooltips label says which way it works\.$/);
});

// ── T18: the Hour's readouts under the veil ──────────────────────────

test('SD20e THE HOUR\'S READOUTS WAIT FOR THE VEIL (T18), run from the world host\'s own text: while the veil stands over a step into the Hour, the bar is hidden and the marks card has not begun - its nine seconds start as the veil opens (they ran out under it, the card met half gone); the court\'s readouts hide the same way (mutants: the card\'s clock under the veil; the bar shown under it)', () => {
  const at = W.indexOf('\n  const sdFightFrame = () => {');
  const text = W.slice(at + 1, W.indexOf('\n  };\n', at) + 5);
  let clock = 0;
  const veil = { busy: true }, drawn = [], bars = [];
  const env = {
    modes: { sdRealmSlot: () => 3 }, sdFightLink: { leave() {}, state: () => ({}), now: () => 0 }, _sdReceipts: new Map(), sdReceiptsLeft() {},
    sdSpoilsBurst: { leave() {}, frame() {} }, sdBlows: { leave() {}, frame() {} }, sdFx: { leave() {}, frame() {} }, saveSoon: { changed() {} },
    player: { pos: [0, 0, 0] }, playerEntity: { health: 10, maxHealth: 10 }, sdDungeonToRealm: () => [0, 0, 0], sdBarNear: () => true,
    remnantBarModel: () => ({ bar: true }), drawGateBossBar: (m, o) => bars.push(!!o?.hidden), gamePaused: () => false, townTalk: { hudHidden: false },
    sdRemVoice: { leave() {}, frame() {} }, cam: { yaw: 0 }, SD_ARENA: { x: 0, z: 0 }, sdPerilAt: () => null, sdGroundModel: () => null,
    sdBeats: { frame: () => null, leave() {} }, titleCardModel: () => null, drawGateGround() {}, drawSdTitleCard() {},
    sdMarksCardModel, sdMarksOf: () => MK, drawGateMarksCard: (m, o) => drawn.push({ m, hidden: !!o?.hidden }), performance: { now: () => clock },
    gateVeil: veil,
  };
  const frame = new Function(...Object.keys(env), `let _sdHall = null, _sdFightHeld = false, _sdBarUp = false, _sdGroundUp = false, _sdCardUp = false, _sdMarksSince = null, _sdMarksUp = false, _sdPassesWarm = true;\n${text}\nreturn sdFightFrame;`)(...Object.values(env));
  for (; clock < 5000; clock += 250) frame();
  assert.deepEqual(drawn, [], 'under the veil: no card begun');
  assert.ok(bars.length && bars.every((h) => h), 'the bar hidden under the veil');
  veil.busy = false;
  frame();
  assert.deepEqual(drawn.at(-1), { m: sdMarksCardModel(MK, { since: 5000, now: 5000 }), hidden: false }, 'the card begins as the veil opens');
  assert.equal(bars.at(-1), false, 'the bar shown');
  clock = 5000 + 125; frame();
  assert.equal(drawn.at(-1).m.alpha, 0.5, 'coming up, an eighth of a second in');
  clock = 5000 + SD_MARKS_ARRIVE_MS - 1; frame();
  assert.ok(drawn.at(-1).m, 'its whole nine seconds');
  clock = 5000 + SD_MARKS_ARRIVE_MS; frame();
  assert.equal(drawn.at(-1).m, null, 'then gone');
  assert.match(read('src/scenes/gateCourt.js'), /drawGateMarksCard\([^\n]*\{ hidden: hudHidden\(\) \|\| veiled\(\) \}\);/, 'the court\'s card hides under it the same way');
});
