// EM1 - THE TAB STRIP AND THE SLOT (2026-09-21, Mac: "adding a tab
// toggle on the map itself").
//
// The strip is INKED on the parchment in paper coordinates rather than
// laid over it as DOM, because paper coordinates are the only space
// that survives MAP3's hands lane - so these pins hold the geometry and
// the hit test in paper pixels, and hold that the strip does not move
// with the view under it.
//
// The slot's two laws: a sheet this place does not offer cannot be put
// up (Mac's sentence, enforced at ONE door rather than at each caller),
// and each sheet keeps its own pan and zoom while the player is on
// another - a slot that forgets makes the tabs cost something to press.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STRIP, sheetTitle, stripScale, stripFont, stripLayout, stripHit, paintStrip, createSheetSlot,
} from '../src/ui/mapStrip.js';
import { MAP_CONTEXTS, MAP_SHEETS, sheetsFor } from '../src/systems/mapTabs.js';
import { PEN, HALO_PEN, NAME_FACE } from '../src/ui/inkMap.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');

/** A canvas that writes down what it was asked to do, and measures a
 *  word the way a real one would to within a hair - enough that the
 *  layout's arithmetic is exercised against a measurer it did not
 *  choose. */
function recorder() {
  const calls = [];
  const state = { font: '', fillStyle: '', strokeStyle: '', lineWidth: 0, lineJoin: '', textAlign: '', textBaseline: '' };
  const ctx = {
    ...state,
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    strokeText(t, x, y) { calls.push(['strokeText', t, x, y, ctx.strokeStyle, ctx.lineWidth]); },
    fillText(t, x, y) { calls.push(['fillText', t, x, y, ctx.fillStyle]); },
    beginPath() { calls.push(['beginPath']); },
    moveTo(x, y) { calls.push(['moveTo', x, y]); },
    lineTo(x, y) { calls.push(['lineTo', x, y, ctx.strokeStyle, ctx.lineWidth]); },
    stroke() { calls.push(['stroke']); },
  };
  return { ctx, calls };
}

test('EM1: the strip names what this place offers and nothing else - a crypt advertises no door Mac closed', () => {
  for (const context of MAP_CONTEXTS) {
    const offer = sheetsFor(context);
    const lay = stripLayout({ context, ids: offer, live: offer[0] }, { paperW: 520 });
    assert.deepEqual(lay.tabs.map((t) => t.sheet), [...offer],
      `${context}'s strip is not its offer, in its order`);
    // and every tab carries a NAME, never a raw sheet id
    for (const t of lay.tabs) {
      assert.ok(t.title && t.title !== t.sheet, `${context}/${t.sheet} shows its id`);
      assert.equal(t.title, sheetTitle(t.sheet, context));
    }
  }
  // the automap's own name is the CONTEXT's, because a shop's plan is
  // not a dungeon's
  assert.equal(sheetTitle('automap', 'dungeon'), 'Dungeon');
  assert.equal(sheetTitle('automap', 'building'), 'Interior');
  assert.equal(sheetTitle('town', 'town'), 'Town');
  assert.equal(sheetTitle('world', 'wilderness'), 'The Bay');
  // one offered sheet is still a strip - it reads as the sheet's name,
  // which is what a drawn map has at its head
  assert.equal(stripLayout({ context: 'dungeon', ids: sheetsFor('dungeon'), live: 'automap' }, {}).tabs.length, 1);
});

test('EM1: the tabs are laid left to right in paper pixels, each clear of the last', () => {
  const measure = (t, f) => t.length * f * 0.5;
  const lay = stripLayout({ context: 'town', ids: sheetsFor('town'), live: 'town' }, { paperW: 520, measure });
  assert.equal(lay.tabs.length, 2);
  const [a, b] = lay.tabs;
  assert.equal(a.x, STRIP.padX * lay.scale, 'the first tab starts at the paper pad');
  assert.equal(a.y, STRIP.padY * lay.scale);
  assert.equal(b.y, a.y, 'the tabs share a baseline');
  assert.equal(Math.round((b.x - (a.x + a.w)) * 1e6) / 1e6, Math.round(STRIP.gap * lay.scale * 1e6) / 1e6,
    'the gap is the gap');
  assert.equal(a.w, measure(a.title, lay.fontPx), 'a tab is as wide as its own word');
  // and the strip's own height leaves the ink room under the pad
  assert.ok(lay.h > a.y + a.h - 1e-9);
});

test('EM1: the strip scales with the SHEET, bounded at both ends', () => {
  assert.equal(stripScale(STRIP.refPaper), 1, 'the reference paper is 1:1');
  assert.ok(stripScale(STRIP.refPaper * 2) > 1);
  assert.ok(stripScale(STRIP.refPaper / 2) < 1);
  // a tiny window must still be hittable, a huge one must not letter
  // the tabs like a headline
  assert.equal(stripScale(1), STRIP.scaleMin);
  assert.equal(stripScale(1e6), STRIP.scaleMax);
  assert.equal(stripScale(0), STRIP.scaleMin === 1 ? 1 : stripScale(STRIP.refPaper),
    'a paper of zero falls back to the reference rather than to zero');
  // the face is the SHEET's own, so a tab reads as part of the map
  assert.ok(stripFont(520).includes(NAME_FACE));
  assert.match(stripFont(520), /^\d+px /);
});

test('EM1: the hit test takes a paper point, and grows the word for a thumb', () => {
  const lay = stripLayout({ context: 'town', ids: sheetsFor('town'), live: 'town' }, { paperW: 520, measure: (t, f) => t.length * f * 0.5 });
  const [a, b] = lay.tabs;
  assert.equal(stripHit(lay, a.x + a.w / 2, a.y + a.h / 2), 'town');
  assert.equal(stripHit(lay, b.x + b.w / 2, b.y + b.h / 2), 'world');
  // the ink's own box is a thin target: the grab band is real on every side
  const g = STRIP.grab * lay.scale;
  assert.equal(stripHit(lay, a.x - g * 0.5, a.y - g * 0.5), 'town');
  assert.equal(stripHit(lay, a.x + a.w + g * 0.5, a.y + a.h + g * 0.5), 'town');
  // ...and bounded
  assert.equal(stripHit(lay, a.x - g * 3, a.y), null);
  assert.equal(stripHit(lay, a.x, a.y + a.h + g * 3), null, 'the map below the strip is the MAP');
  // the gap between two tabs belongs to whichever word reaches it
  assert.equal(stripHit(lay, 1e6, 1e6), null);
  assert.equal(stripHit(null, 0, 0), null, 'no layout is not a throw');
  assert.equal(stripHit({ tabs: [] }, 0, 0), null);
});

test('EM1: the strip is inked in the map own pen - haloed, the live tab ruled, the rest soft', () => {
  const { ctx, calls } = recorder();
  const lay = stripLayout({ context: 'town', ids: sheetsFor('town'), live: 'world' }, { paperW: 520, measure: (t, f) => t.length * f * 0.5 });
  paintStrip(ctx, lay);
  const halo = calls.filter((c) => c[0] === 'strokeText');
  const ink = calls.filter((c) => c[0] === 'fillText');
  assert.equal(halo.length, 2, 'every tab is haloed first (MAP-FIELD6), or it tangles with the parchment');
  assert.equal(ink.length, 2);
  for (const h of halo) {
    assert.equal(h[4], PEN.halo);
    assert.equal(h[5], 2 * HALO_PEN, 'the halo stands out HALO_PEN on each side');
  }
  // the halo goes DOWN before the ink it carries, per word
  assert.ok(calls.indexOf(halo[0]) < calls.indexOf(ink[0]));
  // 'Town' is not live here, 'The Bay' is
  const byTitle = Object.fromEntries(ink.map((c) => [c[1], c[4]]));
  assert.equal(byTitle['The Bay'], PEN.name, 'the live tab is the pen at full weight');
  assert.equal(byTitle.Town, PEN.soft, 'a tab you are not reading is drawn like a border');
  // exactly ONE rule, under the live tab
  const rules = calls.filter((c) => c[0] === 'lineTo');
  assert.equal(rules.length, 1);
  const live = lay.tabs.find((t) => t.live);
  assert.equal(rules[0][1], live.x + live.w, 'the rule spans the live word');
  assert.equal(rules[0][3], PEN.line);
  // and the painter is guarded the way every painter in this lane is
  assert.doesNotThrow(() => paintStrip(null, lay));
  assert.doesNotThrow(() => paintStrip(ctx, null));
  assert.doesNotThrow(() => paintStrip(ctx, { tabs: [] }));
});

test('EM1: the strip does not pan or zoom with the map under it', () => {
  // The point of the strip being INK is that it is the one ink the
  // view does not carry: the map slides under the tabs and the tabs
  // stay put. Held three ways.
  //
  // By SIGNATURE: there is no view to hand in. stripLayout takes the
  // context, the live sheet and the paper; stripHit takes a layout and
  // a paper point; paintStrip takes a context and a layout.
  const body = (name) => {
    const text = src('src/ui/mapStrip.js');
    const at = text.indexOf(`export function ${name}(`);
    assert.ok(at >= 0, `mapStrip.js lost ${name}`);
    let i = text.indexOf('{', at), depth = 0, end = i;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) { end = i; break; }
    }
    return text.slice(at, end + 1);
  };
  for (const name of ['stripLayout', 'stripHit', 'paintStrip']) {
    assert.doesNotMatch(body(name), /\bview\b/, `${name} consults a view - the strip would swim`);
    assert.doesNotMatch(body(name), /toPaper|toMap|zoomAt|clampView/, `${name} reaches for the view transforms`);
  }
  // By VALUE: the same arguments, the same strip, every time.
  assert.deepEqual(stripLayout({ context: 'town', ids: sheetsFor('town'), live: 'town' }, { paperW: 520 }), stripLayout({ context: 'town', ids: sheetsFor('town'), live: 'town' }, { paperW: 520 }));
  // And the painter never moves the canvas under itself - it is handed
  // a context already in paper space and leaves it there, which is also
  // what lets the world map's own ink be painted in the same pass.
  const { ctx, calls } = recorder();
  ctx.setTransform = () => calls.push(['setTransform']);
  ctx.translate = () => calls.push(['translate']);
  ctx.scale = () => calls.push(['scale']);
  paintStrip(ctx, stripLayout({ context: 'town', ids: sheetsFor('town'), live: 'world' }, { paperW: 520 }));
  assert.deepEqual(calls.filter((c) => ['setTransform', 'translate', 'scale'].includes(c[0])), []);
  assert.equal(calls[0][0], 'save', 'the painter leaves the context as it found it');
  assert.equal(calls[calls.length - 1][0], 'restore');
  // ...and it is genuinely pure: no DOM, no host. Asked of the CODE,
  // with the prose stripped first - this file's own header says the
  // word "window" often enough to fool a bare regex, and a pin that
  // reads comments is a pin that fails on a rewrite.
  const code = src('src/ui/mapStrip.js')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.doesNotMatch(code, /\bdocument\b|\bglobalThis\b|\bwindow\s*\./);
});

test('EM1: the slot refuses a sheet this place does not offer, at ONE door', () => {
  const crypt = createSheetSlot({ context: 'dungeon' });
  assert.equal(crypt.live, 'automap');
  assert.deepEqual([...crypt.ids], ['automap']);
  assert.equal(crypt.toggles, false, 'one sheet is a title, not a toggle');
  assert.equal(crypt.select('world'), false, 'Mac: no world map from a dungeon');
  assert.equal(crypt.live, 'automap', 'a refused select leaves the live sheet alone');
  assert.equal(crypt.select('town'), false);
  assert.equal(crypt.select('automap'), false, 'selecting the live sheet is no move');
  assert.equal(crypt.cycle(1), false, 'and there is nowhere to cycle to');

  const town = createSheetSlot({ context: 'town' });
  assert.equal(town.live, 'town');
  assert.equal(town.toggles, true);
  assert.equal(town.select('world'), true);
  assert.equal(town.live, 'world');
  assert.equal(town.select('automap'), false, 'the streets offer no crypt plan');
  assert.equal(town.live, 'world');
});

test('EM1: the slot opens on the sheet it was asked for when the place offers it', () => {
  // the TravelMap key's ask, honoured in a town and dropped in a crypt
  assert.equal(createSheetSlot({ context: 'town', wanted: 'world' }).live, 'world');
  assert.equal(createSheetSlot({ context: 'dungeon', wanted: 'world' }).live, 'automap');
  assert.equal(createSheetSlot({ context: 'town' }).live, 'town');
  assert.equal(createSheetSlot().live, 'world', 'no context at all is the wilderness');
});

test('EM1: the toggle walks the offer and wraps, in strip order, both ways', () => {
  const slot = createSheetSlot({ context: 'town' });
  assert.equal(slot.live, 'town');
  assert.equal(slot.cycle(1), true); assert.equal(slot.live, 'world');
  assert.equal(slot.cycle(1), true); assert.equal(slot.live, 'town', 'the toggle wraps');
  assert.equal(slot.cycle(-1), true); assert.equal(slot.live, 'world', 'and goes back');
  assert.equal(slot.cycle(-1), true); assert.equal(slot.live, 'town');
  // the order the toggle walks is the STRIP's, which is MAP_SHEETS'
  const order = [];
  for (let i = 0; i < 4; i++) { order.push(slot.live); slot.cycle(1); }
  assert.deepEqual(order, ['town', 'world', 'town', 'world']);
  const strip = MAP_SHEETS.filter((s) => slot.ids.includes(s));
  assert.deepEqual([...slot.ids], strip);
});

test('EM1: each sheet keeps its own pan and zoom - the tabs cost nothing to press', () => {
  const slot = createSheetSlot({ context: 'town' });
  const streets = { ox: 40, oy: 12, scale: 3 };
  assert.equal(slot.viewOf('town'), null, 'a sheet never looked at rests where the window puts it');
  slot.select('world', streets);
  assert.deepEqual(slot.viewOf('town'), streets, 'the outgoing sheet is remembered on the way out');
  assert.equal(slot.viewOf('world'), null);
  const bay = { ox: 300, oy: 200, scale: 1.5 };
  slot.select('town', bay);
  assert.deepEqual(slot.viewOf('world'), bay);
  assert.deepEqual(slot.viewOf('town'), streets, 'and the returning sheet is where it was left');
  // the remembered view is a COPY: the window goes on editing its own
  // view object in place (clampView returns fresh, _nudge does not)
  streets.ox = -999;
  assert.equal(slot.viewOf('town').ox, 40);
  slot.remember('town', { ox: 1, oy: 2, scale: 9 });
  assert.deepEqual(slot.viewOf('town'), { ox: 1, oy: 2, scale: 9 });
  slot.forget('town');
  assert.equal(slot.viewOf('town'), null);
  // A REFUSED SELECT REMEMBERS NOTHING - the player never left, so
  // nothing was left behind. Asked of the LIVE sheet's own slot, which
  // is the one a remember-before-refuse would write to (the first draft
  // of this pin asked about the sheet being selected, which such a bug
  // never touches, and a mutant walked straight past it).
  assert.equal(slot.live, 'town');
  assert.equal(slot.viewOf('town'), null, 'forgotten just above');
  assert.equal(slot.select('automap', { ox: 7, oy: 7, scale: 7 }), false);
  assert.equal(slot.viewOf('town'), null, 'a refusal wrote the live sheet a view it never left');
  assert.equal(slot.live, 'town');
  // ...and the same for a select of the sheet already up: pressing the
  // live tab is not a departure either
  slot.remember('town', { ox: 5, oy: 5, scale: 5 });
  assert.equal(slot.select('town', { ox: 8, oy: 8, scale: 8 }), false);
  assert.deepEqual(slot.viewOf('town'), { ox: 5, oy: 5, scale: 5 });
});

test('EM1: the strip offers nothing this WINDOW cannot ink, which is the arc mid-flight gate', () => {
  // A tab that inks nothing is worse than no tab. Until EM3 and EM4
  // hand over the automap and town sheets, a window built with the
  // world sheet alone must say so rather than opening a blank page.
  const onlyWorld = { has: ['world'] };
  const town = createSheetSlot({ context: 'town', ...onlyWorld });
  assert.deepEqual([...town.ids], ['world'], 'the town tab is not offered by a window that cannot draw one');
  assert.equal(town.live, 'world');
  assert.equal(town.toggles, false);
  assert.equal(town.empty, false);
  assert.equal(town.select('town'), false, 'and it cannot be selected round the back either');
  assert.deepEqual(stripLayout(town, { paperW: 520 }).tabs.map((t) => t.sheet), ['world'],
    'the strip is the SLOT, so it cannot offer what the slot does not');

  // a crypt, to a window that holds only the world sheet, offers nothing
  const crypt = createSheetSlot({ context: 'dungeon', ...onlyWorld });
  assert.equal(crypt.empty, true, 'the host asks BEFORE it opens - a blank sheet is a bug report');
  assert.equal(crypt.live, null);
  assert.deepEqual([...crypt.ids], []);
  assert.equal(crypt.cycle(1), false);
  assert.deepEqual(stripLayout(crypt, { paperW: 520 }).tabs, []);
  assert.equal(stripHit(stripLayout(crypt, {}), 0, 0), null);

  // with every sheet in hand the narrowing does nothing at all - the
  // gate lifts itself when EM3 and EM4 land
  for (const context of MAP_CONTEXTS) {
    const all = createSheetSlot({ context, has: MAP_SHEETS });
    assert.deepEqual([...all.ids], [...sheetsFor(context)], `${context} lost a sheet to the narrowing`);
    assert.equal(all.empty, false);
  }
  // an ask the window cannot ink falls to the first sheet it can
  assert.equal(createSheetSlot({ context: 'town', wanted: 'town', has: ['world'] }).live, 'world');
  assert.equal(createSheetSlot({ context: 'town', wanted: 'world', has: ['town'] }).live, 'town');
});
