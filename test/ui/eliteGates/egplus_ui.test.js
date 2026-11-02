// EG-PLUS (2026-10-19, the owner: "We also need to improve the elite breach UI as its not enhanced plus UI standard";
// bible/11-Multiplayer/Elite-Gates.md section 31, EG-PLUS): the Elite Breach's windows in the stone-and-brass kit. The kit names
// every breach surface by role, the breach's own sheets write geometry and words and no paint of their own and no serif;
// the classic skin lays the kit cut to the breach's selectors; the panel, the boards and the start window are drawn as
// breach windows (a header band, sections, tiles, chips, a dock) by their real painters, and the start window's choice is
// made ONCE, its slot emptied before anyone is told.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRAME_ROLES, frameCss } from '../../../src/ui/enhanced/enhancedFrame.js';
import { PIXEL_FONT_CSS } from '../../../src/ui/pixelifyFive.js';
import { EG_CHROME_CSS, EG_KIT_STYLE_ID, EG_CHROME_STYLE_ID, egKitCss, isEgKitSelector, dressEgKit } from '../../../src/ui/eliteGates/egKit.js';
import { EG_HUD_CSS, drawEgPanel, destroyEgHud, egAskText, EG_PANEL_TEXT } from '../../../src/ui/eliteGates/egHud.js';
import { EG_BOARD_CSS, egBoardView, createEgBoardPanel } from '../../../src/ui/eliteGates/egBoardWindow.js';
import { EG_START_CSS, EG_START_TEXT, EG_WAGER_FAMILIES, egStartModel, openEgStartPanel, egStartPanelDoors } from '../../../src/ui/eliteGates/egStartPanel.js';
import { openEgStartWindow } from '../../../src/ui/eliteGates/egStartWindow.js';
import { EG_SPIRE_CSS } from '../../../src/ui/eliteGates/egSpireHud.js';
import { EG_PRES_TEXT } from '../../../src/ui/eliteGates/egBeats.js';
import { EG_TEXT, EG_DECREES } from '../../../src/net/eliteGates/egLaw.js';
import { EG_RESPITE_STEP_MS } from '../../../src/net/eliteGates/egBrain.js';
import { setPref, _resetForTests as resetPrefs } from '../../../src/systems/uiPrefs.js';
import { fakeDoc, all, text } from '../../decorFakes.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** A sheet as rules: each rule's selectors and its body. */
const rules = (css) => [...String(css).replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({ sels: m[1].split(',').map((s) => s.trim()), body: m[2] }));
const on = (n) => /\bon\b/.test(n.className);
const tiles = (root) => all(root, 'eg-k-tile');

test('EG-PLUS THE KIT NAMES THE BREACH: its windows a carved window, the tracker and a section a panel, a press a button (Open the breach and a recap\'s Close in brass), a choice a tile, a readout a chip (the Spire HUD\'s too), the head, a section\'s head, the dock, the foot, a board\'s line and its tabs - each with a leading body; the classic skin\'s cut carries only the breach\'s rules (mutants: a role forgotten; the cut laid whole)', () => {
  const want = {
    window: ['body .eg-win'], panel: ['body .eg-hud', 'body .eg-k-sec'],
    button: ['body .eg-k-btn', 'body .eg-k-x', 'body .eg-spire.enhanced .eg-fold', 'body .eg-spire.enhanced .eg-touch button'],
    primary: ['body .eg-k-btn[data-kind="primary"]'], tile: ['body .eg-k-tile'], chip: ['body .eg-k-chip', 'body .eg-spire.enhanced .eg-chip'],
    header: ['body .eg-k-head'], headerRule: ['body .eg-k-sechead'], footer: ['body .eg-k-dock'], ruleTop: ['body .eg-k-foot'],
    listRow: ['body .eg-k-row'], tabs: ['body .eg-k-tab'],
  };
  for (const [role, sels] of Object.entries(want)) for (const s of sels) assert.ok(FRAME_ROLES[role].includes(s), `${role}: ${s}`);
  const cut = egKitCss();
  const sels = rules(cut).flatMap((r) => r.sels).filter((s) => s && !/^(from|to|\d+%)$/.test(s));
  assert.ok(sels.length > 20 && sels.every(isEgKitSelector), 'only the breach\'s rules');
  assert.ok(cut.length < frameCss().length && rules(cut).length * 2 < rules(frameCss()).length, 'a cut, not the kit');
  assert.match(cut, /body \.eg-win \{\n {2}border-image:/, 'the carved frame');
});

test('EG-PLUS GEOMETRY AND WORDS ONLY: the chrome and every breach sheet paint no surface the kit paints (no ground, no edge colour, no shadow, no round corner on a role) and write no serif - Cormorant and Georgia were the breach\'s own look; the chrome wears the game\'s face (mutants: a ground on a press; the serif back on the panel)', () => {
  // (a tab is words on the band - its rule clears the button's own ground, and the kit paints the one shown)
  const ROLE = /^\.(eg-win|eg-hud|eg-k-(sec|head|sechead|btn|x|tile|chip|row|dock|foot))$/;
  for (const [name, css] of Object.entries({ EG_CHROME_CSS, EG_HUD_CSS, EG_BOARD_CSS, EG_START_CSS })) {
    assert.doesNotMatch(css, /Cormorant|Georgia|serif/, `${name}: no serif`);
    for (const r of rules(css)) {
      for (const s of r.sels) {
        if (!ROLE.test(s)) continue;
        assert.doesNotMatch(r.body, /(^|[\s;])(background(-color)?|border-color|box-shadow|border-radius):/, `${name} ${s}: the kit paints it`);
      }
    }
  }
  assert.ok(EG_CHROME_CSS.includes(PIXEL_FONT_CSS) && EG_HUD_CSS.includes(PIXEL_FONT_CSS), 'the game\'s face on the windows and the tracker');
  // the Spire HUD on Enhanced Plus: its chips, its decrees press and its touch buttons are the kit's to paint
  const enh = rules(EG_SPIRE_CSS).filter((r) => r.sels.some((s) => /^\.eg-spire\.enhanced \.(eg-chip|eg-fold|eg-touch button)$/.test(s)));
  assert.ok(enh.length >= 2);
  for (const r of enh) assert.doesNotMatch(r.body, /background|border-color|box-shadow/, `${r.sels.join(', ')}: the kit's`);
});

test('EG-PLUS THE CLASSIC SKIN: a breach window lays the chrome on every skin, and on the classic skin the kit cut to the breach - once - and asks for the face; on Enhanced Plus no cut (the Plus sheet carries the kit) (mutants: the cut never laid; laid on Plus)', () => {
  const kits = (doc) => doc.head.children.filter((c) => c.id === EG_KIT_STYLE_ID);
  const chrome = (doc) => doc.head.children.filter((c) => c.id === EG_CHROME_STYLE_ID);
  resetPrefs();
  try {
    setPref('skin', 'classic');
    const doc = fakeDoc();
    assert.equal(dressEgKit(doc), true);
    assert.equal(dressEgKit(doc), false, 'once a page');
    assert.deepEqual([kits(doc).length, chrome(doc).length], [1, 1]);
    assert.equal(kits(doc)[0].textContent, egKitCss());
    setPref('skin', 'enhanced');
    const plus = fakeDoc();
    assert.equal(dressEgKit(plus), false);
    assert.deepEqual([kits(plus).length, chrome(plus).length], [0, 1], 'the chrome alone on Plus');
  } finally { resetPrefs(); }
});

test('EG-PLUS THE BREACH\'S PANEL: a breach window - its head says what it shows (a Vestige to choose, the company\'s word, the breach over) with the keys and the Surplus as chips; each card a tile with its key, its line, its capstone and its Accord; a decree\'s choice tiles with what each decree does; a yes-or-no its presses, the one I took pressed; each choice\'s seconds a chip; the rule of the vote said once; the keys in the foot (mutants: the decree\'s lines dropped; my vote unmarked; the seconds out of their chip)', () => {
  const ask = (q, o, left, mine = null) => ({ q, ...egAskText(q, o), left, mine, tally: [] });
  assert.deepEqual(egAskText('dec:ground', [10, 11]), { title: 'The next circle\'s ground decree', line: '', opts: [EG_DECREES[10].name, EG_DECREES[11].name], lines: [EG_DECREES[10].line, EG_DECREES[11].line] });
  assert.equal(egAskText('respite', [0, 1]).line, `The rest runs ${EG_RESPITE_STEP_MS / 60_000} minutes longer and the count holds.`);
  assert.equal(egAskText('bargain', [0, 1]).title, 'Dagon\'s Bargain', 'a title, and what it costs on its own line');
  const doc = fakeDoc();
  destroyEgHud();
  drawEgPanel({
    offer: { n: 1, surplus: 2, cards: [{ key: 1, card: 3, name: 'Searing Edge I', line: 'Burns.', completes: '', accord: '' }, { key: 2, card: 9, name: 'Stoneskin II', line: 'Less.', completes: 'Completes Stone: Rooted.', accord: 'Takes an Accord with Mira\'s Kindled Steel.' }] },
    asks: [ask('dec:ground', [10, 11], 8000, 1), ask('respite', [0, 1], 6500)],
  }, { doc });
  const panel = doc.body.children.at(-1);
  assert.ok(/\beg-panel\b/.test(panel.className) && /\beg-win\b/.test(panel.className), 'a breach window');
  assert.equal(all(panel, 'eg-k-title')[0].textContent, EG_PANEL_TEXT.offer);
  assert.deepEqual(all(all(panel, 'eg-k-head')[0], 'eg-k-chip').map((c) => c.textContent), [`${EG_PANEL_TEXT.keys} 1-2`, EG_PANEL_TEXT.surplus(2)]);
  const cards = tiles(panel).slice(0, 2);
  assert.deepEqual(cards.map((c) => all(c, 'eg-k-key')[0].textContent), ['1', '2']);
  assert.deepEqual(all(cards[1], 'eg-k-tline').map((n) => n.textContent), ['Less.', 'Completes Stone: Rooted.', 'Takes an Accord with Mira\'s Kindled Steel.']);
  const decrees = tiles(panel).slice(2);
  assert.deepEqual(decrees.map((d) => all(d, 'eg-k-tline')[0].textContent), [EG_DECREES[10].line, EG_DECREES[11].line], 'what each decree does');
  assert.deepEqual(decrees.map(on), [false, true], 'my vote taken');
  assert.equal(decrees[1].attrs['aria-pressed'], 'true');
  const seconds = all(panel, 'eg-k-chip').filter((c) => c.attrs['data-left'] != null);
  assert.deepEqual(seconds.map((c) => [c.attrs['data-left'], c.textContent]), [['dec:ground', '8s'], ['respite', '7s']]);
  assert.ok(all(panel, 'eg-k-line').some((n) => n.textContent === EG_PANEL_TEXT.majority), 'the vote\'s rule');
  assert.equal(all(panel, 'eg-k-foot')[0].textContent, EG_PANEL_TEXT.noteKeys);
  assert.deepEqual(all(panel, 'eg-votes')[0].children.map((b) => b.textContent), ['No', 'Yes']);
  // the company's word alone: its own head; the recap: the breach over, its Close in brass on the dock
  destroyEgHud();
  drawEgPanel({ offer: null, asks: [ask('ready', [0, 1], 4000)] }, { doc, touch: true });
  assert.equal(all(doc.body.children.at(-1), 'eg-k-title')[0].textContent, EG_PANEL_TEXT.word);
  destroyEgHud();
  const recap = { b: 'x', title: 'Hall 9', time: '12:00', why: 'last', whyText: 'The last word.', depth: { h: 9, rd: 1, band: 'The Broken Galleries' }, strip: [{ c: 1, glyphs: ['Y'], lord: 'Grath', falls: 1 }],
    members: [{ numeral: 'I', name: 'Mac', falls: 1, recall: 'spent', left: 'fallen', share: null, healed: null }], vestiges: [], capstones: [], accords: [], opened: 0, board: 'The Depths: 2nd', circles: [], company: '' };
  drawEgPanel(null, { doc, recap, words: EG_PRES_TEXT });
  const R = doc.body.children.at(-1);
  assert.equal(all(R, 'eg-k-title')[0].textContent, EG_PRES_TEXT.recapHead);
  assert.deepEqual(all(R, 'eg-k-sechead').map((h) => text(h)), [EG_PANEL_TEXT.circles, EG_PANEL_TEXT.company]);
  const close = all(all(R, 'eg-k-dock')[0], 'eg-close')[0];
  assert.equal(close.attrs['data-kind'], 'primary', 'what the recap is for, in brass');
  destroyEgHud();
});

test('EG-PLUS THE BOARDS: a row its parts - a rank, who, where (the hall and its band, the Proclamation), the time - the Unfallen and the reader as chips, the reader\'s row brass; the Depths\' row its start and its Wager; the last runs no rank; reading, a refusal and an empty board a line; the season a chip on the head; the tabs a tablist (mutants: the reader unmarked; the band dropped; the runs oldest first)', () => {
  const B = { season: { n: 3, day: 12 }, descent: { alone: { rows: [{ rank: 1, names: ['Mara', 'Ann'], h: 47, t: 6252, flame: true, pr: 'Tide of Ash' }, { rank: 2, names: ['Mac'], h: 38, t: 5400, you: true }], pinned: null } },
    depths: { rows: [{ rank: 1, name: 'Dare', h: 80, ew: 4, wg: [0, 4] }], pinned: { rank: 18, name: 'Mac', h: 22, you: true } }, deepest: { rows: [] }, proclamation: { name: 'Tide of Ash', line: '' }, best: null };
  const v = egBoardView(B, 'alone');
  assert.deepEqual(v.rows[0], { rank: '1.', who: 'Mara, Ann', sub: 'Hall 47 - The Soul Cairn - Tide of Ash', val: '1:44:12', flame: true, you: false });
  assert.equal(v.rows[1].you, true);
  assert.equal(v.season, 'Season 3, day 12.');
  assert.deepEqual(v.foot, ['This week\'s Proclamation: Tide of Ash', 'Your best: no descent yet this season.']);
  const d = egBoardView(B, 'depths');
  assert.deepEqual([d.rows[0].who, d.rows[0].sub, d.rows[0].val], ['Dare', `From Redoubt 4 - ${EG_TEXT.wager(`${EG_DECREES[0].name}, ${EG_DECREES[4].name}`)}`, 'Hall 80']);
  assert.equal(d.pinned.you, true);
  assert.equal(egBoardView(B, 'deepest').note, 'No Redoubt has been taken yet.');
  assert.equal(egBoardView(null, 'alone').note, 'Reading the boards...');
  const runs = egBoardView(null, 'runs', { runs: [{ title: 'Hall 2', time: '0:30', whyText: 'A wipe.', at: Date.UTC(2026, 9, 1) }, { title: 'Hall 9', time: '1:00', whyText: 'You walk home.', at: Date.UTC(2026, 9, 2) }] });
  assert.deepEqual(runs.rows.map((r) => [r.rank, r.who, r.sub]), [['', 'Hall 9', '2026-10-02 - You walk home.'], ['', 'Hall 2', '2026-10-01 - A wipe.']], 'newest first');
  const doc = Object.assign(fakeDoc(), { defaultView: { addEventListener() {}, removeEventListener() {} } });
  const P = createEgBoardPanel({ doc, onTab: () => {}, onClose: () => {} });
  P.render(B, 'alone');
  assert.ok(/\beg-win\b/.test(P.root.className));
  const rows = all(P.root, 'eg-k-row');
  assert.deepEqual(rows.map(on), [false, true], 'the reader\'s row brass');
  assert.deepEqual(all(rows[0], 'eg-k-chip').map((c) => c.textContent), ['unfallen']);
  assert.deepEqual(all(rows[1], 'eg-k-chip').map((c) => c.textContent), ['you']);
  assert.equal(all(all(P.root, 'eg-k-head')[0], 'eg-k-chip')[0].textContent, 'Season 3, day 12.');
  const tabs = all(P.root, 'eg-k-tab');
  assert.equal(all(P.root, 'eg-k-tabs')[0].attrs.role, 'tablist');
  assert.deepEqual(tabs.filter(on).map((x) => x.attrs['data-tab']), ['alone']);
  assert.equal(tabs[0].attrs['aria-selected'], 'true');
  P.destroy();
});

/** The start window over a fake slot, its doors recorded. */
function startPanel(o = {}) {
  const doc = Object.assign(fakeDoc(), { defaultView: { addEventListener() {}, removeEventListener() {} } });
  const slot = [], log = [];
  const w = openEgStartPanel({
    doc, keys: 3, me: 'a', members: [{ sub: 'a', name: 'Mac' }, { sub: 'b', name: 'Mira' }], starts: { a: [12, 8, 0], b: [8, 0] }, rehearsal: true, questDue: false,
    mount: (x) => { if (slot.length) return false; slot.push(x); log.push('mount'); return true; }, unmount: (x) => { const i = slot.indexOf(x); if (i >= 0) slot.splice(i, 1); log.push('unmount'); },
    ask: (lines, yes, no, gone) => { log.push(['ask', lines]); o.answer?.(yes, no, gone); }, onChoose: (c) => log.push(['choose', c, slot.length]), onCancel: () => log.push(['cancel', slot.length]), board: o.board ?? null, ...o.extra,
  });
  const root = () => doc.body.children.filter((c) => !c.removed && /\beg-start\b/.test(c.className)).at(-1) ?? null;
  return { w, doc, slot, log, root };
}
const press = (root, cls) => all(root, cls)[0].fire('click');

test('EG-PLUS THE START WINDOW\'S MODEL: each start the opener may make, deepest first and Hall 1 last - its name and band, each member\'s mark and who cannot make it; no key, no start; the Wager by family, every decree once, the held marked (mutants: Hall 1 dropped; a member\'s mark misread; a family missing)', () => {
  const m = egStartModel({ keys: 2, me: 'a', members: [{ sub: 'a', name: 'Mac' }, { sub: 'b', name: 'Mira' }], starts: { a: [12, 8], b: [8] }, wager: [10] });
  assert.deepEqual(m.starts.map((s) => [s.name, s.marks.map((k) => k.can), s.missing]), [['Redoubt 12', [true, false], ['Mira']], ['Redoubt 8', [true, true], []], [EG_TEXT.startHall, [true, true], []]]);
  assert.equal(m.starts[2].band, 'The Broken Galleries');
  assert.deepEqual(egStartModel({ keys: 0, me: 'a', members: [], starts: {} }).starts, [], 'no key: no start to stake');
  assert.deepEqual(m.families.map((f) => f.fam), EG_WAGER_FAMILIES);
  assert.deepEqual(m.families.flatMap((f) => f.decrees.map((d) => d.id)).sort((x, y) => x - y), EG_DECREES.map((d) => d.id), 'every decree, once');
  assert.deepEqual(m.families.flatMap((f) => f.decrees).filter((d) => d.held).map((d) => d.id), [10]);
  assert.deepEqual(egStartModel({ keys: 1, me: 'a', members: [{ sub: 'a', name: 'Mac' }], starts: { a: [5, 0] } }).starts[0].marks, [], 'alone: no marks');
});

test('EG-PLUS THE START WINDOW: in the slot while it stands; a start taken is brass and Open the breach stakes it with the Wager, ONCE, out of the slot first; Open before a start says so on the dock; a start a member cannot make asks once - yes goes, no comes back with the start still taken, the box put away cancels; the Rehearsal; the Wager folded, opened, a decree taken and a family\'s second refused on the dock; the boards step out and back; Cancel and a window put in its place cancel once; a slot that refuses it cancels on the next tick, nothing staked (mutants: chosen twice; the slot told after; the ask skipped; the fold stuck)', async () => {
  // a plain start
  let S = startPanel();
  assert.equal(S.slot.length, 1, 'in the slot');
  assert.equal(all(S.root(), 'eg-k-title')[0].textContent, EG_TEXT.name);
  assert.equal(all(S.root(), 'eg-go')[0].attrs['aria-disabled'], 'true', 'no start taken yet');
  press(S.root(), 'eg-go');
  assert.ok(all(all(S.root(), 'eg-k-dock')[0], 'eg-k-line').some((n) => n.textContent === EG_START_TEXT.pickFirst), 'said where the eye is');
  tiles(S.root()).find((x) => x.attrs['data-ew'] === '8').fire('click');
  assert.deepEqual(tiles(S.root()).filter(on).map((x) => x.attrs['data-ew']), ['8']);
  const go = all(S.root(), 'eg-go')[0];
  go.fire('click'); go.fire('click');
  assert.deepEqual(S.log.filter((x) => x[0] === 'choose'), [['choose', { ew: 8, wg: [], rh: false }, 0]], 'once, the slot empty when told');
  assert.equal(S.root(), null, 'off the page');
  // a start Mira cannot make: asked once - no brings it back with the start still taken, yes goes
  let answer = 'no';
  S = startPanel({ answer: (yes, no) => (answer === 'no' ? no() : yes()) });
  tiles(S.root()).find((x) => x.attrs['data-ew'] === '12').fire('click');
  press(S.root(), 'eg-go');
  assert.deepEqual(S.log.filter((x) => x[0] === 'ask'), [['ask', [EG_TEXT.without('Mira')]]]);
  assert.equal(S.slot.length, 1, 'no: the window back in the slot');
  assert.deepEqual(tiles(S.root()).filter(on).map((x) => x.attrs['data-ew']), ['12'], 'the start still taken');
  answer = 'yes';
  press(S.root(), 'eg-go');
  assert.deepEqual(S.log.at(-1), ['choose', { ew: 12, wg: [], rh: false }, 0]);
  // the box put away unanswered cancels
  S = startPanel({ answer: (yes, no, gone) => gone() });
  tiles(S.root()).find((x) => x.attrs['data-ew'] === '12').fire('click');
  press(S.root(), 'eg-go');
  assert.deepEqual(S.log.filter((x) => x[0] === 'cancel'), [['cancel', 0]]);
  // the Rehearsal
  S = startPanel();
  press(S.root(), 'eg-rehearse');
  assert.deepEqual(S.log.at(-1), ['choose', { ew: 0, wg: [], rh: true }, 0]);
  // the Wager: folded, opened, a decree taken, a family's second refused, then staked with the start
  S = startPanel();
  assert.equal(all(S.root(), 'eg-k-tile').filter((x) => x.attrs['data-decree'] != null).length, 0, 'folded');
  const fold = () => all(S.root(), 'eg-k-sechead').flatMap((h) => all(h, 'eg-k-btn'))[0];
  assert.equal(fold().textContent, EG_START_TEXT.wagerShow);
  fold().fire('click');
  assert.equal(fold().attrs['aria-expanded'], 'true');
  const decree = (id) => tiles(S.root()).find((x) => x.attrs['data-decree'] === String(id));
  decree(9).fire('click');
  assert.equal(decree(9).attrs['aria-pressed'], 'true');
  decree(10).fire('click');
  assert.ok(all(all(S.root(), 'eg-k-dock')[0], 'eg-k-line').some((n) => n.textContent === EG_TEXT.wagerFamily), 'one decree of a family');
  fold().fire('click');
  assert.equal(fold().attrs['aria-expanded'], 'true', 'a Wager holding a decree stays open');
  tiles(S.root()).find((x) => x.attrs['data-ew'] === '0').fire('click');
  press(S.root(), 'eg-go');
  assert.deepEqual(S.log.at(-1), ['choose', { ew: 0, wg: [9], rh: false }, 0]);
  // the boards: out of the slot, and back once they close
  let closeBoards = null;
  S = startPanel({ board: (back) => { closeBoards = back; return {}; } });
  press(S.root(), 'eg-boards');
  assert.deepEqual([S.slot.length, S.root()], [0, null], 'out of the slot for the boards');
  closeBoards(); closeBoards();
  assert.equal(S.slot.length, 1, 'back, once');
  // Cancel, and a window put in its slot, cancel once
  S = startPanel();
  const cancel = all(S.root(), 'eg-cancel')[0];
  cancel.fire('click'); cancel.fire('click');
  assert.deepEqual(S.log.filter((x) => x[0] === 'cancel'), [['cancel', 0]]);
  S = startPanel();
  const occupant = S.slot[0];
  S.slot.length = 0; occupant.dispose(); occupant.dispose();
  assert.deepEqual(S.log.filter((x) => x[0] === 'cancel'), [['cancel', 0]], 'put out of its slot: cancelled, once');
  // a slot that refuses it
  const doc = fakeDoc();
  const told = [];
  const refused = openEgStartPanel({ doc, keys: 1, me: 'a', members: [], starts: {}, mount: () => false, unmount: () => {}, ask: () => {}, onChoose: () => told.push('choose'), onCancel: () => told.push('cancel') });
  assert.equal(told.length, 0);
  await Promise.resolve();
  assert.deepEqual(told, ['cancel']);
  assert.equal(refused.state().done, true);
});

test('EG-PLUS THE DOORS: the host hands the panel\'s doors on Enhanced Plus alone, and openEgStartWindow opens the panel in the list\'s place - the list where the panel cannot open; the doors give up a finished window still in the slot first (mutants: the panel never opened; the list opened beside it)', () => {
  const W = rd('src/scenes/world.js');
  assert.match(W, /\n {4}panel: isEnhancedPlus\(\) \? egStartPanelDoors\(\{ slot: egWindowSlot \}\) : null,/);
  const lists = [];
  const base = { keys: 1, me: 'a', members: [], starts: { a: [0] }, openList: (l) => { lists.push(l); return {}; }, closeList: () => {}, ask: () => {}, onChoose: () => {} };
  const doc = Object.assign(fakeDoc(), { defaultView: { addEventListener() {}, removeEventListener() {} } });
  const slot = { held: [], top() { return this.held.at(-1) ?? null; }, mount(w) { this.held.push(w); return true; }, close(w) { this.held = this.held.filter((x) => x !== w); } };
  slot.held.push({ done: true });
  const w = openEgStartWindow({ ...base, panel: egStartPanelDoors({ slot, doc }) });
  assert.equal(lists.length, 0, 'no list beside it');
  assert.equal(slot.held.length, 1, 'the finished window given up first');
  assert.equal(slot.held[0].isChoiceWindow, true);
  w.close();
  openEgStartWindow({ ...base, panel: { open: () => null } });
  assert.equal(lists.length, 1, 'the list where the panel cannot open');
});
