// CARDS-PLUS (2026-10-13, bible/11-Multiplayer/Tavern-Cards.md section 38; the owner: "Lets improve the illiac bay
// minigame visuals and ensure the general card UI uses enhanced plus and our fonts. Currently it doesnt"): THE CARD UI IN
// THE STONE-AND-BRASS KIT AND THE GAME'S FACE, AND ILIAC HAND'S TABLE MADE TO READ AS A GAME.
//
// The roles (ui/enhanced/enhancedFrame.js FRAME_ROLES) name the two table panels and the Collections page's controls; the panels'
// own sheets write the pixel face on their roots and no serif; on the classic skin a panel lays the kit cut to the panels
// and asks for the face; every class word either panel paints - read off the REAL painters over every phase - is styled
// by no rule from outside them in any sheet the game injects (test/sheetRules.mjs, HUD-CLASS's own reader); Iliac Hand's
// model says who holds each holding, the room left each side, the end and the line's tone; its painted panel draws the
// track, the gems, the backs, the plates, the empty places, the hand at its tile size, the verdict, the fold and a log a
// line a sentence; the binder's face copy; the Collections sheets leave the paint to the kit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRAME_ROLES, FRAME_CSS, frameCss } from '../../src/ui/enhanced/enhancedFrame.js';
import { PLUS_CSS, STONE_DIM, STONE_WORD, STONE_RED } from '../../src/ui/enhanced/enhancedPlusStyle.js';
import { PIXEL_FONT_CSS, PIXELIFY_FIVE_FACE } from '../../src/ui/pixelifyFive.js';
import { cardPanelChromeCss, cardKitCss, dressCardPanel, isCardPanelSelector, CARD_KIT_STYLE_ID } from '../../src/ui/card/cardPanelKit.js';
import { kitCss, G, SMALL_WINDOWS } from '../../src/ui/grimoireDress.js';
import { createCardTableHud, cardHudModel, CARD_TABLE_CSS } from '../../src/ui/card/cardTableHud.js';
import { createIliacTableHud, iliacHudModel, holdingLead, iliacOutcome, VERDICT_WORDS, stagedRefusal, ILIAC_TABLE_CSS, ILIAC_HAND_CARD_H, ILIAC_LANE_CARD_H, ILIAC_PLACE_CARD_H } from '../../src/ui/iliacTableHud.js';
import { createGambitTableHud, GAMBIT_TABLE_CSS } from '../../src/ui/gambitTableHud.js';
import { cardCanvas, cardCanvasCopy, _clearCardFacesForTests, CARD_BINDER_CSS } from '../../src/ui/card/cardBinderPage.js';
import { COLLECTION_PAGE_CSS } from '../../src/ui/collectionsPage.js';
import { ILIAC_TILE_MAX_H } from '../../src/render/iliacCardFaces.js';
import { STARTER_DECK, cardById } from '../../src/net/iliac/iliacCards.js';
import { newGame, commit, reveal, iliacView, legalPlays, ILIAC_HAND_MAX, ILIAC_MAGICKA_MAX, ILIAC_ROOM, ILIAC_TURNS } from '../../src/net/iliac/iliacHand.js';
import { IliacTableSession } from '../../src/systems/iliac/iliacTableSession.js';
import { patronDeck, patronPlays, seededUnit } from '../../src/systems/iliac/iliacPatrons.js';
import { CardTableSession } from '../../src/systems/card/cardTableSession.js';
import { setPref, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import * as tm from '../../src/systems/textManager.js';
import { uiSheetRules, collisions } from '../sheetRules.mjs';
import { fakeDoc, all, text } from '../decorFakes.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const src32 = (seed) => { const u = seededUnit(seed); return () => Math.floor(u() * 4294967296); };
const every = (n, out = []) => { out.push(n); for (const c of n.children ?? []) every(c, out); return out; };
const classesIn = (n) => new Set(every(n).flatMap((x) => String(x.className ?? '').split(/\s+/).filter(Boolean)));
/** A sheet as rules: each rule's selectors and its body, comments out. */
const rules = (css) => [...css.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sels: m[1].split(',').map((s) => s.trim()), body: m[2] }));

/** A page whose canvases paint: each canvas a recording 2D context (its scale, what it is drawn from). */
function paintingDoc() {
  const doc = fakeDoc();
  const make = doc.createElement;
  doc.createElement = (tag) => {
    const n = make(tag);
    // AUDIT CARDS-PLUS E4: a box's scroll height as a page lays it - a line a child, 16px each (the log's own law)
    Object.defineProperty(n, 'scrollHeight', { get: () => (n.children?.length ?? 0) * 16, configurable: true });
    if (tag === 'canvas') {
      n.ownerDocument = doc;   // the binder's cache keys its faces by their page
      n.log = { scale: [], drawn: [], at: [] };
      n.getContext = () => new Proxy({}, {
        get(_, k) {
          if (k === 'measureText') return (t) => ({ width: String(t).length * 5 });
          if (k === 'scale') return (x, y) => n.log.scale.push([x, y]);
          if (k === 'drawImage') return (src, ...where) => { n.log.drawn.push(src); n.log.at.push(where); };   // E7: and where
          return () => {};
        },
        set() { return true; },
      });
    }
    return n;
  };
  return doc;
}

/** A real Iliac turn: the session's view, a play staged and another picked (magicka to spare, so both are lawful). */
function iliacTurn(seed = 31) {
  const s = new IliacTableSession({ player: { id: 'you', name: 'Ves', deck: STARTER_DECK.slice() }, patron: { id: 'regular:2', name: 'Ana', temper: 'tight', grade: 1, deck: patronDeck(3, 'tight', 1) }, rand32: src32(seed), now: 0 });
  s.state.players[0].magicka = 10;
  const v = s.view();
  const plays = legalPlays(s.state, 0);
  const staged = plays.slice(0, 1);
  const pick = plays.find((p) => p.card !== staged[0].card && stagedRefusal(v, [...staged, p]) === null)?.card ?? null;
  return { s, v, staged, pick };
}

/** A whole game played out between two tempers (`turns` turns committed and revealed). */
function played(turns, seed = 7) {
  const st = newGame({ decks: [STARTER_DECK.slice(), STARTER_DECK.slice()], rand32: src32(seed) });
  const unit = seededUnit(seed + 1);
  for (let t = 1; t <= turns; t++) { for (const pl of [0, 1]) commit(st, pl, patronPlays(st, pl, pl ? 'loose' : 'tight', 1, unit)); reveal(st); }
  return st;
}

test('CARDS-PLUS the kit names the card UI: both table panels a carved window, a seat and a holding its panels, their presses the kit\'s buttons (the deal, the check and the call, the commit and the next game in brass; Iliac Hand\'s concession edged in blood), the setup\'s choices tiles, the board, the hand and the season\'s board wells, the pot and a holding\'s power chips, their header bands, their logs under a rule - each with a leading body (their sheets land after the kit) - and the Collections page\'s switch, filters, chips, codex rows, decks and deck name; the Plus sheet carries each, the classic cut every panel\'s (the Collections page is the enhanced menu\'s alone), and every Plus colour re-says the winner\'s ground its panel ground outweighs (mutants: a role dropped; the cut short of a role; the winner\'s ground left to Slate)', () => {
  const want = {
    window: ['body .dfcards', 'body .dfiliac'],
    panel: ['body .dfcards .seat', 'body .dfiliac .hold', '.px-sys .binder-deck'],
    button: ['body .dfcards button', 'body .dfcards .fold', 'body .dfiliac button', 'body .dfiliac .fold'],
    primary: ['body .dfcards button[data-kind="primary"]', 'body .dfiliac button[data-kind="primary"]'],
    warn: ['body .dfiliac button[data-kind="warn"]'],
    tile: ['body .dfiliac .opt', '.px-sys .coll-part', '.px-sys .binder-filter', '.px-sys .binder-chip'],
    chip: ['body .dfcards .pot', 'body .dfiliac .pw'],
    well: ['body .dfcards .board', 'body .dfiliac .tray', 'body .dfiliac .season', '.px-sys .binder-edit input'],
    input: ['.px-sys .binder-edit input'],
    header: ['body .dfcards .tablehead', 'body .dfiliac .tablehead'],
    ruleTop: ['body .dfcards .log', 'body .dfiliac .log'],
    listRow: ['.px-sys .codex-line'],
  };
  for (const [role, sels] of Object.entries(want)) for (const s of sels) assert.ok(FRAME_ROLES[role].includes(s), `${role}: ${s}`);
  const panelSels = Object.values(FRAME_ROLES).flat().filter(isCardPanelSelector);
  assert.ok(panelSels.length >= 20 && panelSels.every((s) => s.startsWith('body ')), 'every panel selector outweighs the panels\' own later sheets');
  assert.ok(PLUS_CSS.includes(FRAME_CSS), 'the kit rides the Plus sheet');
  const kit = rules(FRAME_CSS);
  const ruleOf = (sel, prop) => kit.find((r) => r.sels.includes(sel) && r.body.includes(prop));
  assert.ok(ruleOf('body .dfiliac', 'border-image:') && ruleOf('body .dfcards', 'border-image:'), 'the carved frame');
  assert.ok(ruleOf('body .dfiliac button[data-kind="warn"]', 'border-color: #e0584a'), 'the concession in blood');
  assert.ok(ruleOf('body .dfiliac .opt[aria-pressed="true"]', 'border-color: #f3cf86'), 'a chosen tile in brass');
  assert.ok(ruleOf('.px-sys .codex-line.on', 'box-shadow'), 'an opened codex row marked as the list marks one');
  assert.ok(kit.some((r) => r.sels.includes(':root[data-plus-theme="stone"] body .dfiliac .hold') && /background-color/.test(r.body)), 'each Plus colour grounds them too');
  // AUDIT CARDS-PLUS E10: the classic skin's cut carries every panel selector the kit names (it is the panels' dress there)
  const cutSels = new Set(rules(cardKitCss()).flatMap((r) => r.sels));
  for (const sel of panelSels) assert.ok(cutSels.has(sel), `the classic cut carries ${sel}`);
  // AUDIT CARDS-PLUS B7: a theme's panel ground outweighs the seat's own state, so each re-says the winner's after it
  const plus = rules(PLUS_CSS);
  for (const theme of ['stone', 'iron', 'ember', 'forest', 'night']) {
    const ground = plus.findIndex((r) => r.sels.includes(`:root[data-plus-theme="${theme}"] body .dfcards .seat`) && /background-color/.test(r.body));
    const won = plus.findIndex((r) => r.sels.includes(`:root[data-plus-theme="${theme}"] body .dfcards .seat.won`) && /background-color: rgba\(84,62,22,0\.85\)/.test(r.body));
    assert.ok(ground >= 0 && won > ground, `${theme}: the winner's ground said after the seat's`);
  }
});

test('CARDS-PLUS the face: every card panel\'s sheet (Hold\'em\'s, Iliac Hand\'s, The King\'s Gambit\'s - KG3) sets the game\'s pixel face - the trio, its five - on its root, and every press, slider and field takes it; no serif of their own anywhere in any of their modules; the chrome is one home - a fixed panel bounded by the screen\'s height and scrolling inside it, its touch presses 44px, its dim words and its reds lifted on Stone\'s light ground (mutants: Georgia back on the root; a press left in the browser\'s face; the Stone words unset; a field in the browser\'s face; the height unbounded; the touch press short; the Stone red unset)', () => {
  for (const [name, css, root] of [['Hold\'em', CARD_TABLE_CSS, '.dfcards'], ['Iliac Hand', ILIAC_TABLE_CSS, '.dfiliac'], ['The King\'s Gambit', GAMBIT_TABLE_CSS, '.dfgambit']]) {
    assert.ok(css.startsWith(`\n${PIXELIFY_FIVE_FACE}`), `${name}: the five first`);
    const chrome = cardPanelChromeCss(root);
    assert.ok(css.includes(chrome), `${name}: the shared chrome, as built`);
    const r = rules(chrome);
    const rootRule = r.find((x) => x.sels.length === 1 && x.sels[0] === root);
    assert.ok(rootRule && rootRule.body.includes(PIXEL_FONT_CSS), `${name}: the face's trio on the root`);
    assert.ok(r.some((x) => x.sels.includes(`${root} button`) && /(^|;)\s*font: inherit;/.test(x.body)), `${name}: a press takes the face (a control keeps the browser's own unless told)`);
    assert.ok(r.some((x) => x.sels.includes(`:root[data-plus-theme="stone"] ${root}`) && x.body.includes(`--cp-dim: ${STONE_DIM};`) && x.body.includes(`--cp-word: ${STONE_WORD};`)), `${name}: Stone's dim words`);
    // AUDIT CARDS-PLUS B11: a field and a slider take the face as a press does
    assert.ok(r.some((x) => x.sels.includes(`${root} input`) && /(^|;)\s*font: inherit;/.test(x.body)), `${name}: a field takes the face`);
    // AUDIT CARDS-PLUS B2/C4: fixed over the world, bounded by the screen's height, scrolling inside it (the title and
    // the fold stood off a landscape phone's top)
    assert.ok(rootRule.body.includes('position: fixed;') && rootRule.body.includes('max-height: calc(100vh - 36px);') && rootRule.body.includes('overflow: auto;'), `${name}: on the screen whatever it holds`);
    assert.doesNotMatch(css.replace(chrome, ''), /max-height:calc\(100vh/, `${name}: one home for the bound`);
    // AUDIT CARDS-PLUS E5: the coarse-pointer law's 44px
    assert.match(chrome, new RegExp(`@media \\(pointer: coarse\\) \\{ ${root.replace('.', '\\.')} button, ${root.replace('.', '\\.')} \\.fold \\{ min-height: 44px; \\} ${root.replace('.', '\\.')} \\.fold \\{ width: 44px; \\} \\}`), `${name}: a touch press 44px`);
    // AUDIT CARDS-PLUS B3: and its reds - Stone's light ground took the blood words under AA
    assert.ok(rootRule.body.includes('--cp-red: #ff9a8a;') && r.some((x) => x.sels.includes(`:root[data-plus-theme="stone"] ${root}`) && x.body.includes(`--cp-red: ${STONE_RED};`)), `${name}: Stone's reds`);
    assert.doesNotMatch(css, /Georgia|serif/, `${name}: no serif of its own`);
  }
  for (const f of ['src/ui/card/cardTableHud.js', 'src/ui/iliacTableHud.js', 'src/ui/gambitTableHud.js', 'src/ui/card/cardPanelKit.js']) assert.doesNotMatch(read(f).replace(/^\s*\/\/.*$/gm, ''), /Georgia/, f);
});

test('CARDS-PLUS the classic skin: a panel lays the kit cut to the card panels (once, whichever panel comes first - each alone on its own page, and all three in either order: Hold\'em, Iliac Hand and since KG3 The King\'s Gambit) and asks for the game\'s face; on Enhanced Plus it lays no cut - the Plus sheet carries the kit - and asks for the face itself (mutants: the cut never laid; the cut laid whole; the face never asked for; Iliac Hand never dressing; Hold\'em never dressing; The King\'s Gambit never dressing)', () => {
  const cut = cardKitCss();
  const sels = rules(cut).flatMap((r) => r.sels).filter((s) => s && !/^(from|to|\d+%)$/.test(s));
  // under half the kit's rules: the third panel's own roles (its list rows, its meter's fill, its sections' heads) joined
  // the cut with KG3 - the cut laid whole is the mutant this weighs
  assert.ok(cut.length < frameCss().length && rules(cut).length * 2 < rules(frameCss()).length, 'a cut, not the kit');
  assert.ok(sels.length > 40 && sels.every(isCardPanelSelector), 'only the panels\' rules');
  assert.match(cut, /body \.dfcards,\nbody \.dfiliac,\nbody \.dfgambit \{\n {2}border-image:/, 'the carved frame');
  assert.match(cut, /body \.dfiliac button\[data-kind="warn"\],\nbody \.dfgambit button\[data-kind="warn"\] \{ border-color: #e0584a/, 'the blood edge');
  const holdem = (doc) => createCardTableHud({ onPress: () => {}, doc });
  const iliac = (doc) => createIliacTableHud({ onPress: () => {}, doc });
  const gambit = (doc) => createGambitTableHud({ onPress: () => {}, doc });
  const kitsOf = (doc) => doc.head.children.filter((c) => c.id === CARD_KIT_STYLE_ID);
  const facesOf = (doc) => doc.head.children.filter((c) => c.id === 'dagger-enhanced-fonts' && c.tag === 'link');
  resetPrefs();
  try {
    setPref('skin', 'classic');
    // AUDIT CARDS-PLUS E1: each panel ALONE on its own page dresses itself - Hold'em laid both before, so Iliac Hand's own
    // call was never read; then both, in either order
    for (const open of [[holdem], [iliac], [gambit], [holdem, iliac], [iliac, holdem], [holdem, iliac, gambit], [gambit, iliac, holdem]]) {
      const doc = fakeDoc();
      for (const make of open) make(doc);
      const kits = kitsOf(doc);
      assert.equal(kits.length, 1, `the cut, once (${open.map((f) => f.name).join(', ')})`);
      assert.equal(kits[0].textContent, cut);
      assert.equal(facesOf(doc).length, 1, `the face asked for, once (${open.map((f) => f.name).join(', ')})`);
    }
    setPref('skin', 'enhanced');
    for (const make of [holdem, iliac, gambit]) {
      const plus = fakeDoc();
      make(plus);
      assert.equal(kitsOf(plus).length, 0, `Plus: the kit is the Plus sheet's (${make.name})`);
      assert.equal(facesOf(plus).length, 1, `the face on every skin, by the panel's own call (${make.name})`);
    }
    assert.equal(dressCardPanel(fakeDoc()), false, 'Plus lays no cut');
  } finally { resetPrefs(); }
});

test('CARDS-PLUS the words are their own: every class either panel paints - read off the real painters over every phase (Iliac Hand\'s setup with every choice and box, a turn with a card staged and one picked, its end; Hold\'em\'s buy-in, a hand under way, the fold) - is styled by no rule from outside the panels in any sheet the game injects - every state too: the other player committed, your own face-down card, a drawn end, and Hold\'em\'s seats yours, to act, folded, all in, gone, out of the hand and the winner\'s; given the enhanced sheet\'s bare .card, .row, .note and .side back, the law finds them (mutants: the little card .card again; the duel\'s .side; a lane .row)', async () => {
  const words = new Set();
  const take = (root) => { for (const w of classesIn(root)) words.add(w); };
  for (const doc of [fakeDoc(), paintingDoc()]) {
    const ih = createIliacTableHud({ onPress: () => {}, doc });
    ih.render(iliacHudModel({ phase: 'setup', packPrice: 30, online: { rankedOn: true, rankedOk: false, rankedWhy: 'A guest has no realm character.', board: { season: { n: 1, day: 2 }, rows: [] } }, setup: { decks: [{ name: 'A' }, { name: 'B', word: 'x' }], foes: [], deck: 0, foe: null } }));
    take(ih.root);
    ih.render(iliacHudModel({ phase: 'setup', setup: { decks: [{ name: 'A' }], foes: [{ name: 'Ana', temper: 'tight' }, { name: 'Bors', temper: 'loose', paid: true }], deck: 0, foe: 1, forKeeps: true, keepsOk: true }, why: 'No.' }));
    take(ih.root);
    for (const w of ['tablehead', 'tabletitle', 'tableacts', 'fold', 'msg']) assert.equal(all(ih.root, w).length, 1, `Iliac Hand's own ${w}`);
    const { v, staged, pick } = iliacTurn();
    ih.render(iliacHudModel({ phase: 'playing', view: v, staged, pick, log: ['Turn 1.'] }));
    take(ih.root);
    const end = played(6);
    for (const viewer of [0, 1]) { ih.render(iliacHudModel({ phase: 'over', view: { ...iliacView(end, viewer), names: ['A', 'B'] }, end: null, log: ['x'] })); take(ih.root); }
    ih.render(iliacHudModel({ phase: 'over', view: null, end: 'void' })); take(ih.root);
    all(ih.root, 'fold')[0].fire('click'); take(ih.root);
    const ch = createCardTableHud({ onPress: () => {}, doc });
    ch.render(cardHudModel({ phase: 'buyin', buyIn: { min: 100, max: 500 }, stakes: { sb: 5, bb: 10 }, refused: 'No.', iliac: true, packPrice: 30, gold: true }));
    take(ch.root);
    for (const w of ['tablehead', 'tabletitle', 'tablenote', 'tableacts', 'fold', 'msg']) assert.equal(all(ch.root, w).length, 1, `Hold'em's own ${w}`);
    const s = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: [{ id: 'p0', name: 'Ana', temper: 'tight', stack: 500 }, { id: 'p1', name: 'Bors', temper: 'loose', stack: 500 }], stakes: { sb: 5, bb: 10 }, rand32: src32(4), now: 0 });
    s.tick(0);
    ch.render(cardHudModel({ phase: 'playing', view: s.view(), legal: s.legal(), stakes: { sb: 5, bb: 10 }, log: ['You sit down.'] }));
    take(ch.root);
    all(ch.root, 'fold')[0].fire('click'); take(ch.root);
    // AUDIT CARDS-PLUS E10: the states the sweep never reached - the other player committed, a face-down card of your own,
    // a drawn end; Hold'em's seats gone, out of the hand, folded, all in, to act, and the winner's at a showdown
    const vc = structuredClone(iliacTurn().v);
    vc.players[1].committed = true;
    const unit = STARTER_DECK.find((id) => cardById(id)?.kind === 'unit');
    vc.holdings[0].sides[0] = [{ uid: 9001, id: unit, power: 1, mod: 0, down: true }];
    ih.render(iliacHudModel({ phase: 'playing', view: vc })); take(ih.root);
    const drawn = iliacView(played(6), 0);
    drawn.result = { ...drawn.result, winner: null };
    ih.render(iliacHudModel({ phase: 'over', view: drawn })); take(ih.root);
    const hs = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: ['Ana', 'Bors', 'Cael', 'Dun'].map((n, i) => ({ id: `p${i}`, name: n, temper: ['loose', 'tight', 'bluffer'][i % 3], stack: 400 })), stakes: { sb: 5, bb: 10 }, rand32: src32(9), now: 0 });
    let mid = null, shown = false;
    for (let now = 0; now <= 600000 && !(shown && !hs.view().hand); now += 50) {
      hs.tick(now);
      const l = hs.legal();
      if (!mid && hs.view().hand) mid = structuredClone(hs.view());
      if (l) hs.playerAct(l.check ? { type: 'check' } : { type: 'call' }, now);
      for (const e of hs.drain()) if (e.t === 'showdown') shown = true;
    }
    ch.render(cardHudModel({ phase: 'playing', view: hs.view(), legal: null, stakes: { sb: 5, bb: 10 } })); take(ch.root);
    mid.seats[1].gone = true;
    mid.seats.push({ ...mid.seats[2], name: 'Late' });   // a chair filled after the deal: out of this hand
    mid.hand.seats[2].folded = true;
    mid.hand.seats[3].allIn = true;
    mid.hand.toAct = 4;
    ch.render(cardHudModel({ phase: 'playing', view: mid, legal: null, stakes: { sb: 5, bb: 10 } })); take(ch.root);
  }
  for (const w of ['dfcards', 'dfiliac', 'tablehead', 'tabletitle', 'tableacts', 'msg', 'log', 'fold', 'card-face', 'painted', 'seat', 'board', 'pot', 'opt', 'optname', 'opttemper', 'optword', 'season', 'box', 'ilbar', 'track', 'pip', 'gem', 'foe', 'mb', 'hold', 'holdhead', 'holdart', 'holdname', 'holdrule', 'lane', 'slot', 'duel', 'duelside', 'pw', 'tray', 'ic', 'p', 'verdict', 'collapsed',
    'foestate', 'down', 'drawn', 'duelpart', 'duelto', 'you', 'gone', 'out', 'folded', 'all-in', 'to-act', 'won']) assert.ok(words.has(w), `the painters wrote ${w} (the sweep reads what they paint)`);
  for (const w of ['card', 'row', 'note', 'head', 'side', 'acts']) assert.equal(words.has(w), false, `the bare '${w}' - the enhanced sheet's component`);
  const { rules: all_ } = await uiSheetRules();
  const own = new Set(['dfcards', 'dfiliac']);
  assert.deepEqual(collisions(all_, words, own), [], 'a rule from outside the panels styles a class they write');
  const back = collisions(all_, new Set([...words, 'card', 'row', 'note', 'side']), own);
  for (const w of ['card', 'row', 'note', 'side']) assert.ok(back.some((c) => c.includes(`ENHANCED_CSS .${w} {`)), `the law bites on the bare .${w}: ${back.join(' | ').slice(0, 300)}`);
});

test('CARDS-PLUS Iliac Hand\'s model: who holds each holding as the board stands - the greater power, a tie nobody, the result\'s own word once decided, read from either seat; the room each side has left (a staged unit takes a place, a staged spell none); the end as its player\'s (won, lost, drawn, no contest - none for a watcher); the line\'s tone; the presses\' kinds (mutants: a tie held; the result unread; a staged spell taking a place; a watcher\'s end; the tone of a committed turn; the concession quiet)', () => {
  const view = (viewer, power, result = null) => ({ viewer, holdings: [{ power }], result });
  assert.deepEqual([view(0, [5, 8]), view(1, [5, 8]), view(0, [4, 4]), view(-1, [3, 1])].map((x) => holdingLead(x, 0)), ['theirs', 'mine', null, 'mine']);
  assert.equal(holdingLead(view(0, [9, 1], { held: [1] }), 0), 'theirs', 'decided: the result\'s word, not the view\'s power');
  assert.equal(holdingLead(view(1, [9, 1], { held: [1] }), 0), 'mine');
  assert.equal(holdingLead(view(0, [9, 1], { held: [null] }), 0), null, 'a tie at the end is nobody\'s');
  const r = (winner) => ({ result: { winner }, viewer: 0 });
  assert.deepEqual([iliacOutcome(r(0)), iliacOutcome(r(1)), iliacOutcome(r(null)), iliacOutcome({ ...r(0), viewer: -1 }), iliacOutcome(null, 'left'), iliacOutcome(null, 'won-left'), iliacOutcome(null, 'void'), iliacOutcome({ viewer: 0 })],
    ['won', 'lost', 'drawn', null, 'lost', 'won', 'void', null]);
  assert.deepEqual(VERDICT_WORDS, { won: 'Victory', lost: 'Defeat', drawn: 'A draw', void: 'No contest' });
  // the room: a unit staged takes its place, a spell none
  const { s, v } = iliacTurn();
  const hand = v.players[0].hand;
  const lawful = (kind) => legalPlays(s.state, 0).find((p) => cardById(hand[p.card].id).kind === kind && stagedRefusal(v, [p]) === null);
  const unit = lawful('unit');
  assert.ok(unit, 'a unit to stage');
  const m = iliacHudModel({ phase: 'playing', view: v, staged: [unit] });
  m.holdings.forEach((hd, h) => {
    const mineAt = v.holdings[h].sides[0].length, theirsAt = v.holdings[h].sides[1].length;
    assert.deepEqual(hd.open, [v.holdings[h].room - mineAt - (h === unit.holding ? 1 : 0), v.holdings[h].room - theirsAt], `holding ${h}'s room`);
    assert.equal(hd.lead, holdingLead(v, h));
  });
  const spell = lawful('spell');
  if (spell) assert.deepEqual(iliacHudModel({ phase: 'playing', view: v, staged: [spell] }).holdings[spell.holding].open[0], v.holdings[spell.holding].room - v.holdings[spell.holding].sides[0].length, 'a staged spell takes no place');
  else {
    // the starter deck dealt this seed no spell to the hand: stage one by hand, the rules' own shape
    const sp = STARTER_DECK.find((id) => cardById(id).kind === 'spell');
    const vv = { ...v, players: v.players.map((p, i) => (i ? p : { ...p, hand: [{ uid: 900, id: sp }, ...p.hand] })) };
    assert.equal(iliacHudModel({ phase: 'playing', view: vv, staged: [{ card: 0, holding: 0 }] }).holdings[0].open[0], vv.holdings[0].room - vv.holdings[0].sides[0].length, 'a staged spell takes no place');
  }
  // the tone and the presses' kinds
  assert.equal(m.tone, 'turn');
  assert.deepEqual(m.actions.map((a) => [a.id, a.kind ?? null]), [['commit', 'primary'], ['clear', null], ['stand', 'quiet']]);
  const keeps = iliacHudModel({ phase: 'playing', view: { ...v, forKeeps: true }, staged: [] });
  assert.equal(keeps.actions.at(-1).label, 'Concede and stand');
  assert.equal(keeps.actions.at(-1).kind, 'warn', 'a concession costs the card staked');
  const committed = { ...v, players: v.players.map((p, i) => (i ? p : { ...p, committed: true })) };
  assert.equal(iliacHudModel({ phase: 'playing', view: committed }).tone, 'wait');
  assert.equal(iliacHudModel({ phase: 'playing', view: v, why: 'No.' }).tone, 'warn');
  assert.equal(iliacHudModel({ phase: 'playing', view: v, online: { watching: true } }).tone, 'wait');
  const end = played(6);
  const over = iliacHudModel({ phase: 'over', view: iliacView(end, 0) });
  assert.equal(over.outcome, iliacOutcome(iliacView(end, 0)));
  assert.equal(over.tone, over.outcome === 'won' || over.outcome === 'lost' ? over.outcome : null);
  assert.deepEqual(over.actions.map((a) => [a.id, a.kind ?? null]), [['again', 'primary'], ['holdem', null], ['stand', 'quiet']]);
  const setup = iliacHudModel({ phase: 'setup', setup: { decks: [{ name: 'A' }], foes: [{ name: 'Ana', temper: 'tight' }], deck: 0, foe: 0 } });
  assert.deepEqual([setup.tone, setup.actions[0].kind, setup.actions.at(-1).kind], [null, 'primary', 'quiet']);
  assert.equal(iliacHudModel({ phase: 'setup', setup: { decks: [{ name: 'B', word: 'x' }], foes: [], deck: 0 } }).tone, 'warn', 'no deck to play');
  assert.equal(iliacHudModel({ phase: 'setup', online: { busy: true }, setup: { decks: [{ name: 'A' }], foes: [], deck: 0 } }).tone, 'wait', 'the realm vouching');
  assert.equal(iliacHudModel({ phase: 'playing', view: null, online: { watching: true } }).spectator, true);
  assert.equal(m.spectator, false);
});

test('CARDS-PLUS Iliac Hand\'s painted panel: the turn a track of six and the magicka its gems (the staged spend dimmed), the other\'s backs - neither past the rules\' own ceilings, a garbled count said and never drawn - each holding under its own painted location card with its lanes\' empty places and the duel\'s holder lit, the hand in its tray painted by the binder\'s own canvas at its CSS size - the painter\'s tile face, never twice it - a fresh copy for each place, the verdict at the end, the fold kept across repaints (the table\'s words away, the line and the presses kept), the log a line a sentence scrolled to its newest, each press wearing its kind - the brass, the quiet, the concession\'s blood (mutants: the hand painted twice its size; the empty places gone; the log one run; the fold forgotten; the verdict unsaid; the copy left blank; the gems past the magicka\'s ceiling; the gems or the backs uncapped; the number ahead never lit; the wrong side lit; the plate\'s lead dropped; the leads\' colours swapped; the presses\' kinds unpainted; the log left at its top; the fold putting away the presses or keeping the log)', () => {
  _clearCardFacesForTests();
  const doc = paintingDoc();
  const hud = createIliacTableHud({ onPress: () => {}, doc });
  const { v, staged, pick } = iliacTurn();
  const m = iliacHudModel({ phase: 'playing', view: v, staged, pick, log: ['The holdings: a, b, c.', 'Turn 1.', 'Ana commits.'] });
  hud.render(m);
  const pips = all(hud.root, 'pip');
  assert.equal(pips.length, m.turns);
  assert.deepEqual(pips.map((p) => p.className), ['pip now', 'pip', 'pip', 'pip', 'pip', 'pip'], 'turn one of six');
  const gems = all(hud.root, 'gem');
  assert.equal(gems.length, m.me.magicka);
  assert.equal(gems.filter((g) => g.className === 'gem lit').length, m.me.magicka - m.me.spend);
  assert.ok(m.me.spend > 0 && gems.filter((g) => g.className === 'gem spent').length === m.me.spend, 'the staged spend dimmed');
  assert.equal(all(hud.root, 'mb').length, m.them.hand, 'the other\'s hand as its backs');
  const holds = all(hud.root, 'hold');
  assert.equal(holds.length, 3);
  holds.forEach((box, h) => {
    const hd = m.holdings[h];
    const art = all(box, 'holdart')[0].children[0];
    assert.equal(art.height, ILIAC_PLACE_CARD_H, 'its own location card, at its size');
    assert.ok(art.log.drawn.length === 1, 'painted from the binder\'s face');
    const [theirs, mine] = all(box, 'lane');
    assert.equal(all(theirs, 'slot').length, hd.open[1], 'the other side\'s empty places');
    assert.equal(all(mine, 'slot').length, hd.open[0], 'yours');
    assert.equal(all(mine, 'staged').length, hd.staged.length);
    const pw = all(box, 'pw');
    assert.deepEqual(pw.map((p) => p.className.includes('ahead')), [hd.lead === 'mine', hd.lead === 'theirs'], 'the holder lit');
    assert.equal(box.className.includes(`lead-${hd.lead}`), !!hd.lead);
  });
  const tray = all(hud.root, 'tray')[0];
  const cards = all(tray, 'ic');
  assert.equal(cards.length, v.players[0].hand.length);
  for (const c of cards) {
    const cv = c.children[0];
    assert.equal(cv.height, ILIAC_HAND_CARD_H, 'painted at its CSS size (the pixel ratio 1 here)');
    assert.ok(cv.height <= ILIAC_TILE_MAX_H, 'the painter\'s tile face');
    assert.equal(cv.log.drawn.length, 1, 'a fresh copy of the one painting');
  }
  assert.equal(new Set(cards.map((c) => c.children[0])).size, cards.length, 'each place its own node');
  assert.ok(ILIAC_LANE_CARD_H <= ILIAC_TILE_MAX_H && ILIAC_PLACE_CARD_H <= ILIAC_TILE_MAX_H);
  assert.equal(all(tray, 'picked').length, pick == null ? 0 : 1);
  const log = all(hud.root, 'log')[0];
  assert.deepEqual(log.children.map((n) => n.textContent), ['The holdings: a, b, c.', 'Turn 1.', 'Ana commits.'], 'a line a sentence, the newest last');
  assert.ok(log.scrollHeight > 0 && log.scrollTop === log.scrollHeight, 'AUDIT CARDS-PLUS E4: scrolled to the newest');
  // AUDIT CARDS-PLUS E3: each press wears its kind - the brass the commit is, the quiet stand at the row's end; a game for
  // keeps makes the stand a concession, in blood
  const press = (root, id) => every(root).find((n) => n.getAttribute?.('data-focus') === `act-${id}`);
  assert.deepEqual([press(hud.root, 'commit').dataset.kind, press(hud.root, 'clear').dataset.kind, press(hud.root, 'stand').dataset.kind], ['primary', undefined, 'quiet']);
  hud.render(iliacHudModel({ phase: 'playing', view: { ...v, forKeeps: true }, staged, pick }));
  assert.equal(press(hud.root, 'stand').dataset.kind, 'warn', 'the concession in blood');
  hud.render(m);
  // a count past the rules' ceilings (a garbled relay's) is said in the count and never grows the row
  hud.render({ ...m, me: { ...m.me, magicka: 99, spend: 0 }, them: { ...m.them, hand: 99 } });
  assert.equal(all(hud.root, 'gem').length, ILIAC_MAGICKA_MAX, 'the gems the magicka\'s ceiling at most');
  assert.equal(all(hud.root, 'mb').length, ILIAC_HAND_MAX, 'the backs a hand\'s most at most');
  assert.ok(text(hud.root).includes('99/99') && text(hud.root).includes('99 in hand'), 'the number itself said');
  hud.render(m);
  // the fold: the game's words away, the line and the presses kept, and kept across a repaint
  const fold = all(hud.root, 'fold')[0];
  assert.equal(fold.getAttribute('aria-expanded'), 'true');
  fold.fire('click');
  assert.equal(hud.root.className, 'dfiliac collapsed');
  hud.render({ ...m, message: 'x', log: ['y'] });
  assert.equal(hud.root.className, 'dfiliac collapsed', 'kept across a repaint');
  assert.equal(all(hud.root, 'fold')[0].getAttribute('aria-expanded'), 'false');
  assert.equal(all(hud.root, 'fold')[0].getAttribute('data-focus'), 'fold', 'the keyboard\'s, as every control of the panel');
  // AUDIT CARDS-PLUS D5: the fold says what it does to the panel - its tooltip and its name to a screen reader, both
  // panels' alike (its name was the glyph)
  assert.equal(all(hud.root, 'fold')[0].getAttribute('aria-label'), 'Expand the panel');
  assert.equal(all(hud.root, 'fold')[0].title, 'Expand the panel');
  const holdem = createCardTableHud({ onPress: () => {}, doc: paintingDoc() });
  holdem.render(cardHudModel({ phase: 'buyin', buyIn: { min: 100, max: 500 }, stakes: { sb: 5, bb: 10 } }));
  const hf = all(holdem.root, 'fold')[0];
  assert.deepEqual([hf.title, hf.getAttribute('aria-label'), hf.getAttribute('aria-expanded')], ['Collapse the panel', 'Collapse the panel', 'true']);
  hf.fire('click');
  assert.deepEqual([hf.title, hf.getAttribute('aria-label'), hf.getAttribute('aria-expanded')], ['Expand the panel', 'Expand the panel', 'false']);
  holdem.destroy();
  assert.match(ILIAC_TABLE_CSS, /\.dfiliac\.collapsed \.ilbody\{display:none\}/);
  // AUDIT CARDS-PLUS E6: the fold puts away the table's words and keeps the line and the presses - each panel's rules
  for (const [css, root, away] of [[ILIAC_TABLE_CSS, '.dfiliac', ['.ilbody', '.tablenote', '.log']], [CARD_TABLE_CSS, '.dfcards', ['.seats', '.board', '.tablenote', '.log']]]) {
    const folded = rules(css).filter((r) => r.sels.some((x) => x.startsWith(`${root}.collapsed `)));
    for (const w of away) assert.ok(folded.some((r) => r.sels.includes(`${root}.collapsed ${w}`) && /display: ?none/.test(r.body)), `${root}: the fold puts ${w} away`);
    for (const w of ['.msg', '.tableacts', 'button']) assert.ok(!folded.some((r) => r.sels.some((x) => x.includes(w))), `${root}: the fold keeps ${w}`);
  }
  all(hud.root, 'fold')[0].fire('keydown', { key: 'Enter' });
  assert.equal(hud.root.className, 'dfiliac');
  // the end: its verdict, the line's tone
  const end = played(6);
  const over = iliacHudModel({ phase: 'over', view: iliacView(end, 0) });
  hud.render(over);
  const verdict = all(hud.root, 'verdict')[0];
  assert.ok(over.outcome && verdict, 'a decided game says so');
  assert.equal(verdict.textContent, VERDICT_WORDS[over.outcome]);
  assert.equal(verdict.className, `verdict ${over.outcome}`);
  assert.equal(all(hud.root, 'msg')[0].className, over.tone ? `msg ${over.tone}` : 'msg');
  assert.deepEqual(all(hud.root, 'pip').map((p) => p.className), Array(6).fill('pip past'), 'every turn played');
  // AUDIT CARDS-PLUS E2: the holder lit, on a board where each side holds something (turn one's empty board lit nothing,
  // so the checks above could not bite)
  const leads = over.holdings.map((x) => x.lead);
  assert.ok(leads.includes('mine') && leads.includes('theirs'), 'each side holds a holding here');
  all(hud.root, 'hold').forEach((box, h) => {
    const lead = over.holdings[h].lead;
    assert.deepEqual(all(box, 'pw').map((p) => p.className.includes('ahead')), [lead === 'mine', lead === 'theirs'], `holding ${h}: the holder's number lit`);
    assert.equal(box.className.includes(`lead-${lead}`), !!lead, `holding ${h}: its plate says who holds it`);
  });
  assert.match(ILIAC_TABLE_CSS, /body \.dfiliac \.hold\.lead-mine\{border-top-color:#f3cf86\}/, 'yours in brass');
  assert.match(ILIAC_TABLE_CSS, /body \.dfiliac \.hold\.lead-theirs\{border-top-color:#e0584a\}/, 'theirs in blood');
  assert.match(ILIAC_TABLE_CSS, /body \.dfiliac \.pw\.ahead\{border-color:#f3cf86 /, 'the number ahead in brass');
  hud.destroy();
  // E3: Hold'em's presses wear theirs - the deal in brass, the stand quiet
  const ch = createCardTableHud({ onPress: () => {}, doc: paintingDoc() });
  ch.render(cardHudModel({ phase: 'buyin', buyIn: { min: 100, max: 500 }, stakes: { sb: 5, bb: 10 } }));
  const kinds = all(ch.root, 'tableacts')[0].children.map((b) => b.dataset.kind ?? null);
  assert.ok(kinds.includes('primary') && kinds[kinds.length - 1] === 'quiet', `the deal in brass, the stand quiet at the end (${kinds})`);
  ch.destroy();
});

test('CARDS-PLUS the words the panel\'s look added are the player\'s language\'s (L10N4, bible/06-Systems/Localization-Arc.md): routed through the text core and read when they are shown - the verdict, the fold, the setup\'s heads and boxes, the track (the magicka by DFU\'s own key), the other player\'s line and state, the empty tray - from the real French table; English byte for byte until French is chosen, and again after (mutants: the verdict\'s words read once, at load; a head left in English; the magicka a port key)', () => {
  tm._resetTextManagerForTests();
  try {
    const { v } = iliacTurn();
    const play = iliacHudModel({ phase: 'playing', view: v });
    const models = [
      iliacHudModel({ phase: 'setup', setup: { decks: [{ name: 'Starter' }], foes: [{ name: 'Ana', temper: 'tight', paid: true }], deck: 0, foe: 0, forKeeps: false, keepsOk: true } }),
      iliacHudModel({ phase: 'setup', online: { rankedOk: true }, setup: { decks: [{ name: 'Starter' }], foes: [], deck: 0 } }),
      { ...play, them: { ...play.them, committed: true }, hand: [] },
      iliacHudModel({ phase: 'over', view: iliacView(played(6), 0) }),
    ];
    // a panel drawn anew for each (a language changes only at the front door, never under an open table)
    const shown = () => models.map((m) => {
      const hud = createIliacTableHud({ onPress: () => {}, doc: paintingDoc() });
      hud.render(m);
      const out = { words: text(hud.root), fold: all(hud.root, 'fold')[0].title, verdict: all(hud.root, 'verdict')[0]?.textContent ?? null };
      hud.destroy();
      return out;
    });
    const en = shown();
    for (const w of ['Your deck', 'Play against', 'has paid a card tonight', 'Play for a card', 'The loser pays one from their deck', 'Ranked', 'Counts on the season board. Uses your realm character\'s cards.', 'Turn', 'Magicka', 'Committed', 'No cards in hand.']) {
      assert.ok(en.some((x) => x.words.includes(w)), `the English: ${w}`);
    }
    assert.equal(en[0].fold, 'Collapse the panel', 'AUDIT CARDS-PLUS D5: what the fold does to the panel');
    assert.equal(en[3].verdict, { won: 'Victory', lost: 'Defeat', drawn: 'A draw', void: 'No contest' }[models[3].outcome]);
    const fr = Object.fromEntries(tm.parseStringTableCsv(read('locales/fr/Port_Strings.csv')));
    tm.patchLocaleTable('fr', 'Port_Strings', Object.entries(fr));
    tm.patchLocaleTable('fr', 'Internal_Strings', [['magicka', 'Magie']]);   // a pack's DFU row (none is committed)
    assert.deepEqual(shown(), en, 'English stands until French is chosen');
    tm.setLocale('fr');
    const said = shown();
    const keys = ['cards.iliac.setup.deck', 'cards.iliac.setup.against', 'cards.iliac.setup.paid', 'cards.iliac.setup.keeps', 'cards.iliac.setup.keepsWhy', 'cards.iliac.setup.ranked', 'cards.iliac.setup.rankedWhy', 'cards.iliac.track.turn', 'cards.iliac.foe.committed', 'cards.iliac.hand.empty'];
    for (const k of keys) {
      assert.ok(fr[k], `the French table has ${k}`);
      assert.ok(said.some((x) => x.words.includes(fr[k])), `${k} said in French: ${fr[k]}`);
    }
    assert.ok(said[2].words.includes('Magie') && !said[2].words.includes('Magicka'), 'the magicka by DFU\'s own key');
    assert.ok(said[2].words.includes(fr['cards.iliac.foe.counts'].replace('{hand}', String(play.them.hand)).replace('{deck}', String(play.them.deck))), 'the other player\'s line, its counts in the French pattern');
    assert.equal(said[3].verdict, fr[`cards.iliac.verdict.${models[3].outcome}`], 'the verdict in French');
    // AUDIT CARDS-PLUS E8: every verdict, not the one the seed's game ends on
    for (const k of ['won', 'lost', 'drawn', 'void']) assert.equal(VERDICT_WORDS[k], fr[`cards.iliac.verdict.${k}`], `${k} in French`);
    assert.equal(said[0].fold, fr['cards.table.fold.hide']);
    for (const w of ['Your deck', 'Play against', 'No cards in hand.', 'Committed']) assert.ok(!said.some((x) => x.words.includes(w)), `no English left: ${w}`);
    tm.setLocale('en');
    assert.deepEqual(shown(), en, 'English again, byte for byte');
    assert.deepEqual(['won', 'lost', 'drawn', 'void'].map((k) => VERDICT_WORDS[k]), ['Victory', 'Defeat', 'A draw', 'No contest']);
  } finally { tm._resetTextManagerForTests(); }
});

/** A page that keeps the keyboard as a browser does: a node takes focus unless it stands in a folded panel's body
 *  (display:none there - its focus() a no-op). */
function focusingDoc() {
  const doc = paintingDoc();
  doc.activeElement = doc.body;
  const make = doc.createElement;
  doc.createElement = (tag) => {
    const n = make(tag);
    n.contains = (x) => every(n).includes(x);
    n.focus = () => {
      const panel = doc.body.children.find((c) => String(c.className).split(' ').includes('dfiliac'));
      const folded = panel && String(panel.className).split(' ').includes('collapsed');
      const inBody = folded && all(panel, 'ilbody').some((b) => b === n || every(b).includes(n));
      if (!inBody) doc.activeElement = n;
    };
    return n;
  };
  return doc;
}

test('AUDIT CARDS-PLUS lane A: a relay\'s garbled turns and room grow no row past the rules\' ceilings; no turn, other player or board before a game is dealt; an ended game lights the turns it reached; a watcher has no verdict and no yours-or-theirs plate; your own face-down card veiled; the keyboard lands only where it can stay, and Space on the panel never reaches the game (mutants: the pips uncapped; the places uncapped; the undealt drawn; the refocus blind; the root passing Space; the whole track lit; the watcher\'s verdict; the watcher\'s plates; the face-down card unveiled)', () => {
  _clearCardFacesForTests();
  const paint = (m, doc = paintingDoc()) => { const hud = createIliacTableHud({ onPress: () => {}, doc }); hud.render(m); return hud; };
  // A1: a relay's garbled numbers
  const { v } = iliacTurn();
  const garbled = { ...v, turns: 5000, holdings: v.holdings.map((h) => ({ ...h, room: 5000 })) };
  const g = paint(iliacHudModel({ phase: 'playing', view: garbled }));
  assert.equal(all(g.root, 'pip').length, ILIAC_TURNS, 'the track the game\'s turns at most');
  for (const lane of all(g.root, 'lane')) assert.ok(all(lane, 'slot').length <= ILIAC_ROOM, 'a lane\'s empty places its room at most');
  assert.equal(all(g.root, 'slot').length, garbled.holdings.length * 2 * ILIAC_ROOM, 'every side at its cap (5,000 places open on each)');
  // A3: online, no game on the cloth yet - the wait said, nothing drawn as if a game stood
  for (const online of [{ waiting: true }, { seating: true }, {}]) {
    const m = iliacHudModel({ phase: 'playing', view: null, online });
    assert.equal(m.dealt, false);
    const r = paint(m).root;
    for (const cls of ['track', 'foe', 'hold', 'tray']) assert.equal(all(r, cls).length, 0, `no ${cls} before the deal (${JSON.stringify(online)})`);
    assert.ok(all(r, 'msg')[0].textContent.length > 0, 'the wait said');
  }
  assert.equal(iliacHudModel({ phase: 'playing', view: v }).dealt, true);
  // A5: a game conceded on turn 2 - two of six
  const early = iliacView(played(1), 0);
  assert.equal(early.turn, 2);
  const e = paint(iliacHudModel({ phase: 'over', view: early, end: 'won-left' })).root;
  assert.deepEqual(all(e, 'pip').map((p) => p.className), ['pip past', 'pip past', 'pip', 'pip', 'pip', 'pip']);
  assert.equal(all(e, 'track')[0].children[2].textContent, '2/6');
  // A6, A7: a watcher
  const w = iliacView(played(6), -1);
  assert.equal(iliacOutcome(w, 'void'), null, 'a watcher\'s end is the players\'');
  assert.equal(iliacOutcome(iliacView(played(6), 0), 'void'), 'void', 'a player\'s no contest');
  const wr = paint(iliacHudModel({ phase: 'over', view: w, end: 'void', online: { watching: true } })).root;
  assert.equal(all(wr, 'verdict').length, 0);
  assert.ok([0, 1, 2].some((h) => holdingLead(w, h)), 'someone leads somewhere (the plates have a lead to drop)');
  assert.ok(all(wr, 'hold').every((b) => !/lead-/.test(b.className)), 'no yours-or-theirs edge for a watcher');
  assert.ok(all(wr, 'pw').some((p) => p.className.includes('ahead')), 'the duel still lights the leading number');
  // the owner's face-down card: its face for them, under a veil (its text never runs; the other sees its back); the
  // other player's face-down card: a back, no veil (nothing of it is the viewer's to know)
  const unit = STARTER_DECK.find((id) => cardById(id)?.kind === 'unit');
  const fd = structuredClone(v);
  fd.holdings[0].sides[0] = [{ uid: 9001, id: unit, power: cardById(unit).power, mod: 0, down: true }];
  fd.holdings[0].sides[1] = [{ uid: 9002, down: true }];
  const fr = paint(iliacHudModel({ phase: 'playing', view: fd })).root;
  const [theirLane, myLane] = all(all(fr, 'hold')[0], 'lane');
  assert.deepEqual([all(myLane, 'down').length, all(theirLane, 'down').length], [1, 0], 'the owner\'s veiled, the other\'s a back');
  assert.match(ILIAC_TABLE_CSS, /\.dfiliac \.ic\.down::after\{content:''/);
  // A4: Clear pressed from the keyboard in a folded panel - the control gone, the first card hidden: the panel holds the
  // keyboard, never the page; and Space on the panel stops there
  const doc = focusingDoc();
  const { staged } = iliacTurn();
  const hud = createIliacTableHud({ onPress: () => {}, doc });
  hud.render(iliacHudModel({ phase: 'playing', view: v, staged }));
  all(hud.root, 'fold')[0].fire('click');
  const clear = every(hud.root).find((n) => n.getAttribute?.('data-focus') === 'act-clear');
  clear.focus();
  assert.equal(doc.activeElement, clear);
  hud.render(iliacHudModel({ phase: 'playing', view: v, staged: [] }));
  assert.equal(doc.activeElement, hud.root, 'the keyboard on the panel, never the page\'s body');
  for (const key of [' ', 'Enter', 'Tab']) {
    let stopped = false;
    hud.root.fire('keydown', { key, stopPropagation() { stopped = true; } });
    assert.ok(stopped, `${JSON.stringify(key)} on the panel is the panel's`);
  }
  let passed = true;
  hud.root.fire('keydown', { key: 'w', stopPropagation() { passed = false; } });
  assert.ok(passed, 'a walking key still reaches the game');
  hud.destroy();
});

test('AUDIT CARDS-PLUS lanes B and C: every look keeps the panels\' marks - the DFO Grimoire dress re-says each in its own colours (yours and for you its chosen green, theirs the pack\'s red, a lead a bar inside the plate, the power ahead gold leaf on its wood, a card\'s power badge as printed, an empty place a hollow, the keyboard a red ring, a short card red) and draws a tile\'s marks above its box; a warn press answers the pointer; the panels are small windows; a target is a ring outside its plate, so the lead\'s edge stands; a disabled choice takes no pointer; the keyboard on a staged card shows; the board wraps its pot; no edge carries a colour of the panels\' own; a watcher has no tray, a drawn end no tone (mutants: a twin dropped; the tile\'s mark beneath the fill; the warn deaf; the frame off the screen; the target over the lead; the disabled choice pressable; the staged focus hidden; the pot unwrapped; a shorthand edge back)', () => {
  const dress = rules(kitCss());
  const twin = (sel, re) => dress.some((r) => r.sels.includes(`${G} ${sel}`) && re.test(r.body));
  // B1 (C1, B7's dress half): the card tables' marks, re-said by the dress
  assert.ok(twin('body .dfcards .seat.you', /border-color: #1d5530 !important/), 'your seat');
  assert.ok(twin('body .dfcards .seat.to-act', /box-shadow: inset 0 0 0 2px #8e1a10/), 'the one to act');
  assert.ok(twin('body .dfcards .seat.won', /border-color: #1d5530 !important; box-shadow: inset 0 0 0 100vmax/), 'the winner');
  assert.ok(twin('body .dfiliac .hold.lead-mine', /box-shadow: inset 0 3px 0 #1d5530/) && twin('body .dfiliac .hold.lead-theirs', /box-shadow: inset 0 3px 0 #8e1a10/), 'who holds it, a bar inside');
  assert.ok(twin('body .dfiliac .hold.target', /outline: 3px solid #1d5530 !important/), 'a target, a ring outside');
  assert.ok(twin('body .dfiliac .pw.ahead', /border-color: #d8b04a !important; color: #f4e04c !important/), 'the power ahead');
  assert.ok(twin('body .dfiliac .ic .p.up', /background: #2f7a43 !important/) && twin('body .dfiliac .ic .p.down', /background: #4a1a12 !important/), 'a power raised and lowered, as printed');
  assert.ok(twin('body .dfiliac .slot', /box-shadow: inset 0 0 0 1px/), 'an empty place');
  assert.ok(twin('body .dfcards [tabindex="0"]:focus-visible', /outline: 2px solid #8e1a10 !important/) && twin('body .dfiliac [tabindex="0"]:focus-visible', /outline: 2px solid #8e1a10 !important/), 'the keyboard');
  assert.ok(twin('.px-sys .binder-chip.short', /outline: 2px solid #ff8a6a/), 'a short card (C2)');
  assert.ok(twin('body .dfiliac .holdname', /color: #2b1a0c !important/), 'a holding\'s name in the ink');
  // C2: a tile's marks above the cubby's fill - an outline, never an inset shadow the fill paints over
  const tileOn = dress.find((r) => r.sels.includes(`${G} .px-sys .binder-filter.on`));
  assert.ok(tileOn && /outline: 2px solid #d8b04a/.test(tileOn.body) && !/inset/.test(tileOn.body), `a chosen tile's mark above its box: ${tileOn?.body}`);
  // the warn press answers the pointer and the keyboard (its own red outweighed the hover's)
  assert.ok(dress.some((r) => r.sels.includes(`${G} body .dfiliac button[data-kind="warn"]:hover:not(:disabled)`) && /color: #b52418 !important/.test(r.body)), 'a concession under the pointer');
  // B4: small windows - the torn page's frame stays on the screen
  assert.ok(SMALL_WINDOWS.includes('body .dfcards') && SMALL_WINDOWS.includes('body .dfiliac'));
  // B5: a target is a ring outside the plate, so the plate's top edge still says who holds it
  const il = rules(ILIAC_TABLE_CSS);
  const target = il.find((r) => r.sels.includes('body .dfiliac .hold.target'));
  assert.ok(target && /box-shadow:[^;]*0 0 0 3px #f3cf86/.test(target.body) && !/border/.test(target.body), `the target a ring: ${target?.body}`);
  // B8, B9
  assert.match(ILIAC_TABLE_CSS, /\.dfiliac \.opt\.off\{[^}]*pointer-events:none/, 'a choice that cannot be made takes no pointer');
  assert.match(ILIAC_TABLE_CSS, /\.dfiliac \.ic\.staged:focus-visible\{outline-style:solid/, 'the keyboard on a staged card');
  // C3: the board wraps its pot; no edge in either panel's sheet or the chrome carries a colour of its own (the shorthand
  // painted the pot's brass over the kit's chip)
  assert.match(CARD_TABLE_CSS, /\.dfcards \.board\{display:flex;flex-wrap:wrap;/);
  const roleSurfaces = Object.values(FRAME_ROLES).flat().filter(isCardPanelSelector).map((x) => x.replace(/^body /, ''));
  for (const [name, css] of [['Hold\'em', CARD_TABLE_CSS], ['Iliac Hand', ILIAC_TABLE_CSS]]) {
    for (const r of rules(css.replace(/\/\*[\s\S]*?\*\//g, ''))) {
      if (!r.sels.some((x) => roleSurfaces.includes(x) || /^\.card-panel-root|^\.(dfcards|dfiliac)( (button|\.fold|\.tablehead|\.log))?$/.test(x))) continue;
      assert.doesNotMatch(r.body, /border(-(top|right|bottom|left))?: ?\d+px solid/, `${name}: ${r.sels.join(', ')} - an edge of a kit surface is a width and a style`);
    }
  }
  // E12: a watcher holds no tray; a drawn end has no tone (it is neither yours nor theirs)
  const w = iliacView(played(6), -1);
  const wr = createIliacTableHud({ onPress: () => {}, doc: paintingDoc() });
  wr.render(iliacHudModel({ phase: 'over', view: w, online: { watching: true } }));
  assert.equal(all(wr.root, 'tray').length, 0, 'no tray for a watcher');
  const drawn = iliacView(played(6), 0);
  drawn.result = { ...drawn.result, winner: null };
  const dm = iliacHudModel({ phase: 'over', view: drawn });
  assert.deepEqual([dm.outcome, dm.tone], ['drawn', null]);
});

test('CARDS-PLUS the binder\'s face, copied: a fresh canvas holding the cached painting, at the same device size, laid whole at its corner - at a pixel ratio of 1 and of 2 - one card in two places, two nodes (mutants: the copy left blank; the copy drawn askew)', () => {
  _clearCardFacesForTests();
  const doc = paintingDoc();
  const rat = cardById('rat');
  const src = cardCanvas(doc, rat, 46);
  const a = cardCanvasCopy(doc, rat, 46), b = cardCanvasCopy(doc, rat, 46);
  assert.notEqual(a, b);
  for (const c of [a, b]) {
    assert.deepEqual([c.width, c.height], [src.width, src.height]);
    assert.equal(c.log.drawn.length, 1, 'the painting drawn into it');
  }
  assert.deepEqual(src.log.scale[0], [1, 1], 'painted at the screen\'s ratio (1 here)');
  for (const c of [a, b]) assert.equal(c.log.drawn[0], src, 'from the one cached painting');
  for (const c of [a, b]) assert.deepEqual(c.log.at[0], [0, 0], 'AUDIT CARDS-PLUS E7: laid whole, at its corner');
  // E7: and on a screen of twice the pixels - painted at twice its size in device pixels, the copy the same
  const had = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
  try {
    Object.defineProperty(globalThis, 'devicePixelRatio', { value: 2, configurable: true, writable: true });
    _clearCardFacesForTests();
    const src2 = cardCanvas(doc, rat, 46), c2 = cardCanvasCopy(doc, rat, 46);
    assert.deepEqual(src2.log.scale[0], [2, 2], 'painted at the screen\'s ratio');
    assert.deepEqual([src2.height, c2.width, c2.height], [92, src2.width, src2.height], 'twice the pixels, the copy the same');
    assert.deepEqual(c2.log.at[0], [0, 0]);
  } finally {
    if (had) Object.defineProperty(globalThis, 'devicePixelRatio', had); else delete globalThis.devicePixelRatio;
    _clearCardFacesForTests();
  }
});

test('CARDS-PLUS the Collections page leaves the paint to the kit: its switch, the binder\'s filters, chips, decks and the deck\'s name give the roles a 2px edge and no colour or ground of their own over it, the codex row a line - the sentence "dressed by the kit\'s roles" true at last (mutants: the switch\'s own ground back; a chip\'s own border colour; a filter on a 1px line)', () => {
  const css = rules(`${COLLECTION_PAGE_CSS}\n${CARD_BINDER_CSS}`);
  const body = (sel) => css.filter((r) => r.sels.includes(sel)).map((r) => r.body).join(';');
  for (const sel of ['.px-sys .coll-part', '.px-sys .binder-filter', '.px-sys .binder-chip', '.px-sys .binder-deck']) {
    const b = body(sel);
    assert.match(b, /border-width: 2px; border-style: solid;/, `${sel}: the kit's edge`);
    assert.doesNotMatch(b, /background|border-color|border: \d/, `${sel}: no paint over the kit's`);
  }
  assert.match(body('.px-sys .codex-line'), /border-width: 0 0 1px; border-style: solid;/, 'a line');
  assert.doesNotMatch(body('.px-sys .codex-line'), /background/);
  assert.match(body('.px-sys .binder-edit input'), /border-width: 2px; border-style: solid;/);
  assert.match(body('.px-sys .binder-chip.short'), /border-color: #d0604f/, 'a card the binder is short of keeps its red edge over the kit');
  // AUDIT CARDS-PLUS E12: a chosen filter says it in its word; its edge and ground are the kit's tile .on
  assert.doesNotMatch(body('.px-sys .binder-filter.on'), /background|border/, 'a chosen filter\'s paint is the kit\'s');
});
