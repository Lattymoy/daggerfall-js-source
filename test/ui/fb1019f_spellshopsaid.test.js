// SPELLSHOP-SAID (FIELD BUGS 2026-10-19f, two players' private reports: at the Mages Guild's spell shop, Buy did
// nothing - no confirmation, no gold spent). Buy refused - no spellbook in the pack, or not the gold - with DFU's
// click-anywhere box (DaggerfallSpellBookWindow.BuyButton_OnMouseClick, DaggerfallUI.MessageBox), and under Enhanced
// Plus the spell shop is the classic SpellbookWindow inside the port (SHOP-PLUS), whose classic draw runs onto a
// renderer that paints nothing: the refusal was laid out as parchment onto nothing. And it stayed up, unseen: the
// port's dismiss asked `win.box`, which the book does not keep, so the next press (Leave) went to putting it away.
//
// Driven through the real port (enhancedPorts.js spellShop over SpellbookWindow in buy mode) on the repo's DOM
// (test/chargenDom.mjs), the refusal records read through the real TEXT.RSC reader, and the shelf's spell the real
// producer's (resurrectionSpell).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../chargenDom.mjs';
import { _setDrawWatchdogForTests } from '../../src/ui/drawWatchdog.js';
import { SpellbookWindow, NO_SPELLBOOK_TEXT_ID, spellEffects } from '../../src/ui/spellbookWindow.js';
import { enhancedWindow } from '../../src/ui/enhanced/enhancedPorts.js';
import { destroyEnhancedNotice, enhancedNoticeKeys, noticeFrame, noticeRelease, noticeShown, NOTICE_HINT } from '../../src/ui/enhanced/enhancedNotice.js';
import { closeEnhancedDialog } from '../../src/ui/enhanced/enhancedDialog.js';
import { MB_BUTTONS } from '../../src/ui/messageBox.js';
import { GuildServiceWindow, _setGuildServiceArtForTests } from '../../src/ui/guildServiceWindow.js';
import { CovenWindow, _setCovenArtForTests } from '../../src/ui/covenWindow.js';
import { SPELLBOOK_TEMPLATE_INDEX } from '../../src/systems/spell/spellMaker.js';
import { NOT_ENOUGH_GOLD_ID } from '../../src/systems/guild/guildServiceActions.js';
import { portEffectDescription } from '../../src/systems/spell/spellEffects.js';
import { resurrectionSpell } from '../../src/systems/resurrect.js';
import { TextRsc, encodeRscRecord } from '../../src/formats/textRsc.js';
import { setPref, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';

_setDrawWatchdogForTests({ raf: null });   // chargenDom's requestAnimationFrame runs its callback at once; the ticker would never stop
const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

/** A TEXT.RSC in memory, in the file's own layout - the reader the host's rows(id) is (townTalk.lines). The records'
 *  words are stand-ins; what is pinned is that the record read is the one the box shows. */
function rsc(records) {
  const ids = Object.keys(records).map(Number);
  const bodies = ids.map((id) => encodeRscRecord(records[id]));
  const bytes = new Uint8Array(2 + ids.length * 6 + bodies.reduce((n, b) => n + b.length, 0));
  const v = new DataView(bytes.buffer);
  v.setUint16(0, (ids.length + 1) * 6, true);
  let o = 2, off = 2 + ids.length * 6;
  ids.forEach((id, i) => { v.setUint16(o, id, true); v.setUint32(o + 2, off, true); o += 6; bytes.set(bodies[i], off); off += bodies[i].length; });
  const r = new TextRsc();
  r.load(bytes, { table: null });
  return r;
}
const TEXT = rsc({ [NO_SPELLBOOK_TEXT_ID]: ['[no book] You will need a spellbook.'], [NOT_ENOUGH_GOLD_ID]: ['[no gold] You cannot afford that.'], 260: ['That will be %a gold.'] });
const rows = (id) => TEXT.variantLinesById(id, () => 0);

const font = { tex: 'font', glyph: () => null, fnt: { fixedHeight: 6, fixedWidth: 4, glyphWidth: () => 4 } };
const renderer = { canvas: { width: 1280, height: 720 }, uploadTexture: () => 'tex', releaseTexture() {}, drawScreenQuad() {}, drawScreenQuadRun() {} };
const all = (n, out = []) => { for (const c of n.children ?? []) { out.push(c); all(c, out); } return out; };
const byClass = (cls) => all(document.body).filter((n) => String(n.className).split(/\s+/).includes(cls));

/** The shop as the host builds it (worldModes guildServiceSpellbook): the book in buy mode, ported. */
function shop({ book = true, gold = 50000 } = {}) {
  const entity = { name: 'Test Player', goldPieces: gold, items: book ? [{ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX }] : [], spells: [] };
  let closed = 0;
  const raw = new SpellbookWindow({
    spells: () => entity.spells, entity, castCost: () => 10, offered: () => [resurrectionSpell()],
    buildingQuality: () => 12, priceFactor: () => 1, shopName: () => 'Mages Guild',
    skills: () => ({ mercantile: 40, personality: 50 }), classicMinutes: () => 0, rows, onClose: () => { closed++; },
  }, { buyMode: true });
  const w = enhancedWindow(raw, 'spellShop');
  const host = () => byClass('port-host')[0] ?? null;
  const draw = () => w.draw(renderer, renderer.canvas, font);
  /** A press as the browser hands the port's one click listener: `target` is the node under the pointer - a button
   *  of the view, or (null) the window's own ground. */
  const press = (target) => {
    const ev = { target: { closest: (sel) => (sel === '[data-a]' && target?.dataset?.a != null ? target : null) }, stopPropagation() {}, preventDefault() {} };
    for (const f of host().listeners.click ?? []) f(ev);
  };
  return { raw, w, entity, draw, press, button: (re) => button(host(), re), closed: () => closed };
}
/** A button of the port's view by its label (a key chip, where it has one, is a span of its own beside it). */
const button = (root, re) => all(root).find((n) => n.tagName === 'BUTTON' && n.children.some((c) => c.className === 'port-btnlabel' && re.test(c.textContent))) ?? null;
const noticeTexts = () => byClass('notice-row').map((n) => n.textContent);
function reset() { destroyEnhancedNotice(); closeEnhancedDialog(); document.body.children = []; }

test('SPELLSHOP-SAID: under the port, Buy with no spellbook says so - the record as the notice, no parchment - the next click takes it down and nothing under it acts, and Leave then leaves', () => {
  reset();
  const s = shop({ book: false });
  s.draw();
  s.press(s.button(/^Buy/));
  assert.equal(s.raw.top, 'noSpellbook', 'the window\'s own ladder refused');
  assert.deepEqual(enhancedNoticeKeys(), [], 'the panel is the next draw\'s');
  s.draw();
  assert.deepEqual(noticeTexts(), ['[no book] You will need a spellbook.'], 'mutants: the refusal drawn onto the quiet renderer, nothing in the DOM');
  assert.deepEqual(enhancedNoticeKeys(), [s.raw._noticeKey], 'one panel, the window\'s own');
  assert.deepEqual(byClass('notice-hint').map((n) => n.textContent), [NOTICE_HINT], 'ClickAnywhereToClose, said the enhanced way');
  assert.equal(s.raw._box, null, 'no parchment laid out under the panel');
  assert.equal(noticeShown(s.raw), true);
  // the next press - Leave - is the notice's: put away, and the shop stays
  s.press(s.button(/Leave/));
  assert.equal(s.raw.top, null, 'mutants: the port blind to the book\'s box - the notice stood through the press');
  assert.equal(s.raw.done, false, 'nothing under the notice acted');
  assert.equal(s.closed(), 0);
  s.draw();
  assert.deepEqual(enhancedNoticeKeys(), [], 'the box cleared: its panel leaves on the next draw');
  assert.equal(noticeShown(s.raw), false);
  s.press(s.button(/Leave/));
  assert.equal(s.raw.done, true, 'mutants: a released panel still taking the click - Leave answered by a notice that is gone');
  assert.equal(s.closed(), 1);
  reset();
});

test('SPELLSHOP-SAID: under the port, Buy without the gold says so; a click anywhere on the window puts it away; nothing is bought and no gold spent', () => {
  reset();
  const s = shop({ gold: 1 });
  s.draw();
  s.press(s.button(/^Buy/));
  assert.equal(s.raw.top, 'notEnoughGold');
  s.draw();
  assert.deepEqual(noticeTexts(), ['[no gold] You cannot afford that.'], 'mutants: the no-gold refusal not handed to the panel');
  s.draw(); s.draw();
  assert.deepEqual(noticeTexts(), ['[no gold] You cannot afford that.'], 'BOX1 still holds: the record read once, the panel painted in place');
  s.press(null);   // the window's own ground, no button under the pointer
  assert.equal(s.raw.top, null, 'a click anywhere');
  s.draw();
  assert.deepEqual(enhancedNoticeKeys(), []);
  assert.equal(s.entity.goldPieces, 1, 'no gold spent');
  assert.deepEqual(s.entity.spells, [], 'nothing bought');
  // a key puts it away too (the host routes keys to the window as it always has)
  s.press(s.button(/^Buy/));
  s.draw();
  assert.equal(enhancedNoticeKeys().length, 1);
  s.w.input('Space');
  assert.equal(s.raw.top, null);
  s.draw();
  assert.deepEqual(enhancedNoticeKeys(), []);
  reset();
});

test('SPELLSHOP-SAID: an effect\'s description (the chosen spell\'s "What it does") is the notice too - it stood unseen the same way', () => {
  reset();
  const s = shop();
  s.draw();
  const sp = resurrectionSpell();
  const e = spellEffects(sp)[0];
  const words = portEffectDescription(`${e.type},${e.subType & 0xff}`);
  assert.ok(words?.length, 'the port\'s own effect carries its own words');
  s.press(all(document.body).find((n) => n.tagName === 'BUTTON' && n.title === 'What it does'));
  assert.equal(s.raw.top, 'note');
  s.draw();
  assert.deepEqual(noticeTexts(), [...words], 'mutants: a note not handed to the panel');
  s.press(null);
  s.draw();
  assert.deepEqual(enhancedNoticeKeys(), []);
  assert.equal(s.raw.done, false);
  reset();
});

test('SPELLSHOP-SAID: the haggle\'s Yes/No stays a decision - the enhanced dialog, never the notice, and a click on the window does not put it away', () => {
  reset();
  const s = shop();
  s.draw();
  s.press(s.button(/^Buy/));
  assert.equal(s.raw.top, 'trade');
  s.draw();
  assert.deepEqual(enhancedNoticeKeys(), [], 'mutants: the decision handed to the panel');
  assert.equal(byClass('dlg-shell').length, 1, 'mutants: the Yes/No laid out with no buttons - no dialog');
  assert.equal(byClass('dlg-btn').length, 2);
  s.press(null);
  assert.equal(s.raw.top, 'trade', 'a decision is answered, not dismissed');
  // ...and answered: the dialog's Yes replays a click at the laid-out box's Yes (enhancedDialog.js press)
  const price = s.raw.tradePrice();
  const [bx, by, bw, bh] = s.raw._box.buttons.find((b) => b.button === MB_BUTTONS.Yes).rect;
  s.w.click(bx + bw / 2, by + bh / 2);
  assert.deepEqual(s.entity.spells.map((sp) => sp.name), ['Resurrection'], 'mutants: the window\'s click deaf to its own Yes');
  assert.equal(s.entity.goldPieces, 50000 - price);
  assert.equal(s.raw.done, true);
  reset();
});

test('SPELLSHOP-SAID: the window\'s close takes its panel with it; the classic skin keeps its parchment and mints nothing', () => {
  reset();
  const s = shop({ book: false });
  s.draw();
  s.press(s.button(/^Buy/));
  s.draw();
  assert.equal(enhancedNoticeKeys().length, 1);
  s.raw._close();
  assert.deepEqual(enhancedNoticeKeys(), [], 'mutants: _close not releasing - the host drops the window and never draws it again');
  reset();
  // the classic skin: not ported, the box is the parchment
  setPref('skin', 'classic');
  try {
    const c = shop({ book: false });
    assert.equal(c.w, c.raw, 'the classic skin is the classic window, byte for byte');
    c.raw.buyButton();
    c.draw();
    assert.deepEqual(c.raw._box.rows.map((r) => r.text), ['[no book] You will need a spellbook.'], 'mutants: the classic parchment gone');
    assert.equal(c.raw._noticeKey, undefined, 'no panel minted on the classic skin');
  } finally { resetPrefs(); }
  reset();
});

// ── THE SWEEP: every other window under the port that raises a click-anywhere box ───────────────────────────────────
// The bank, the potion maker, the item maker and the spell maker keep theirs in `box`, which the port's dismiss read.
// The guild's and the coven's is `top` (their queue's head): drawn as the notice since ENH-NOTICE2, never seen by the
// dismiss - a click on the window's ground did nothing, and a row that calls the window's own method (Heal Curse,
// Reforge) acted under the notice. The dismiss asks the notice seam now, whatever field holds the box.
const IMG = { tex: 't', w: 130, h: 51 };
function ported(win, kind) {
  const w = enhancedWindow(win, kind);
  const host = () => byClass('port-host')[0];
  return {
    w, draw: () => w.draw(renderer, renderer.canvas, font),
    press: (target = null) => {
      for (const f of host().listeners.click ?? []) f({ target: { closest: (sel) => (sel === '[data-a]' && target?.dataset?.a != null ? target : null) }, stopPropagation() {}, preventDefault() {} });
    },
    button: (re) => button(host(), re),
  };
}
test('SPELLSHOP-SAID sweep: the guild\'s and the coven\'s notices take the first click on the window under the port', () => {
  reset();
  _setGuildServiceArtForTests({ base: IMG, member: IMG });
  _setCovenArtForTests({ base: IMG });
  try {
    let healed = 0;
    const g = new GuildServiceWindow({ member: () => true, service: () => 'Training', rows: () => [], steps: () => [],
      onService: () => ({ rows: [{ text: 'You must wait.', center: true }] }), healCurse: () => { healed++; return null; }, onClose: () => {} });
    const p = ported(g, 'guild');
    g._service();   // the service refused: a box on the window (DFU keeps the popup open, :314-328)
    p.draw();
    assert.deepEqual(noticeTexts(), ['You must wait.']);
    p.press(p.button(/Heal Curse/i));   // a row that calls the window's own method, not its click
    assert.equal(g.top, null, 'mutants: the dismiss asking `win.box` - the guild\'s notice never took the click');
    assert.equal(healed, 0, 'nothing under the notice acted');
    p.draw();
    assert.deepEqual(enhancedNoticeKeys(), []);
    reset();
    const c = new CovenWindow({ rows: () => [], onSummon: () => ({ rows: [{ text: 'You do not have the gold.', center: true }] }), onTalk: () => {}, onClose: () => {} });
    const q = ported(c, 'coven');
    c._summon();
    q.draw();
    assert.deepEqual(noticeTexts(), ['You do not have the gold.']);
    q.press();
    assert.equal(c.top, null);
    assert.equal(c.done, false);
  } finally { _setGuildServiceArtForTests(null); _setCovenArtForTests(null); reset(); }
});

test('SPELLSHOP-SAID: noticeShown is the owner\'s panel - up while it stands, never for an owner that drew none, gone with the release', () => {
  reset();
  const o = {};
  assert.equal(noticeShown(o), false);
  assert.equal(noticeShown(null), false);
  assert.equal(noticeFrame(o, ['x']), true);
  assert.equal(noticeShown(o), true);
  assert.equal(noticeShown({ _noticeKey: 'box-never' }), false, 'mutants: a key alone taken for a panel');
  noticeRelease(o);
  assert.equal(noticeShown(o), false);
  noticeFrame(o, ['y']);
  noticeFrame(o, null);
  assert.equal(noticeShown(o), false, 'null releases');
  reset();
  // the port asks it, and asks nothing else
  const port = rd('src/ui/enhanced/enhancedPort.js');
  assert.match(port, /if \(noticeShown\(win\)\) \{ win\.click\?\.\(-1, -1\); return; \}\n\s*if \(!b \|\| b\.disabled\) return;/);
  assert.doesNotMatch(port, /win\.box/);
});
