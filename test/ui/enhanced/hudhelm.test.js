// HUD-HELM (2026-10-15, Mac: "Yes, same branch" - the helm panel registered as the saddle panel was, HUD-SADDLE;
// bible/01-Overview/bugs/Field-Bugs-2026-10-14-riding-panel.md): THE HELM PANEL IS A HUD PIECE. Come Sail Away's helm panel
// (ui/enhanced/enhancedHelm.js, CSA-L) is the saddle panel's twin - a whole-screen layer, its bar under the compass - and stood
// outside HUD-MOVE's list as the saddle did, so Alt+U could not move it, size it or turn it off. The bar is a piece now,
// placed when it is built, with a preview of itself while nobody is at a helm; and the sea's target card (ui/naval/navalHud.js)
// stands under the bar wherever it is moved - its head the bar's foot, its centre the bar's - and comes back to the
// compass's foot when the bar is turned off. Driven over test/hudPage.mjs's page with the real sweep and the real panel,
// and the card through drawNavalHud on the naval suites' document.
import { byClass } from '../../chargenDom.mjs';   // the naval suites' document (installed at its load) - the card's
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUD_PIECES, HUD_LAYOUT_CSS, HUD_LOCK_PREF, sweepHudLayout, tickHudLayout, setHudLocked } from '../../../src/ui/hud/hudLayout.js';
import { drawEnhancedHelm, hideEnhancedHelm, buildHelmPreview, helmButtons, enhancedHelmBar, ENHANCED_HELM_ID } from '../../../src/ui/enhanced/enhancedHelm.js';
import { drawNavalHud, destroyNavalHud, cardCentreUnder, NAVAL_CARD_GAP, NAVAL_CARD_W } from '../../../src/ui/naval/navalHud.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { fakePage, withHudPage, childOf } from '../../hudPage.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const withPage = (layout, fn) => withHudPage(layout, fn, { teardown: hideEnhancedHelm });
/** A helm as helmPanelState hands it the panel: a two-masted hull, sails up, the dial at one. */
const H = (o = {}) => ({
  hull: 1, hasSails: true, sailsUp: true, squareToggle: false, squareUp: false, hasSquare: false, squareOnly: false, manualTrim: true,
  light: true, timeDial: true, timeScale: 1, timeScaleIndex: 0, timeScaleMax: 3, orders: false, inIrons: false, way: 2, ...o,
});
const atHelm = (doc, o) => drawEnhancedHelm({ helm: H(o) }, {}, { doc });
const barOf = (root) => childOf(root, 'helmpanel-bar');

test('HUD-HELM THE PIECE: the helm panel\'s bar is a HUD-MOVE piece, and a panel built at the wheel stands where the player put it - moved, sized or turned off - from its first frame (mutants: no piece; the build\'s placing dropped)', async () => {
  const piece = HUD_PIECES.find((p) => p.id === 'helm');
  assert.deepEqual({ ...piece }, { id: 'helm', sel: '.helmpanel .helmpanel-bar', name: 'Helm panel', ghost: 'helm' });
  assert.ok(HUD_LAYOUT_CSS.includes('.helmpanel .helmpanel-bar[data-hm],'), 'the editor\'s sheet moves and scales it');
  await withPage({ helm: { x: -300, y: 410, s: 1.25 } }, (doc) => {
    const root = atHelm(doc);
    assert.equal(root.id, ENHANCED_HELM_ID);
    const bar = barOf(root);
    assert.equal(bar.attrs['data-hm'], 'helm');
    assert.deepEqual([bar.style.props['--hmx'], bar.style.props['--hmy'], bar.style.props['--hms']], ['-300px', '410px', '1.25'], 'at the saved place and size the moment it is built');
    atHelm(doc, { sailsUp: false, way: 0 });
    assert.deepEqual([bar.style.props['--hmx'], bar.style.props['--hmy']], ['-300px', '410px'], 'its own painting never writes the piece\'s place');
  });
  await withPage({ helm: { off: true } }, (doc) => {
    assert.ok(barOf(atHelm(doc)).hasAttribute('data-hm-off'), 'turned off: off the screen in play from its first frame');
  });
});

test('HUD-HELM THE PREVIEW: with the editor open and nobody at a helm a preview of the panel stands - its own buttons, named a preview, its bar the piece, its holds its own - leaves whole for the real one and at the lock, and stands at a finger\'s place on a touch device (mutants: no ghost; the preview mounted as the live panel; the preview never a finger\'s)', async () => {
  await withPage(null, async (doc) => {
    setPref(HUD_LOCK_PREF, false);
    tickHudLayout(doc, 0);
    const ghosts = () => doc.querySelectorAll('.helmpanel[data-hm-ghost="helm"]');
    for (let i = 0; i < 200 && !ghosts().length; i++) { sweepHudLayout(doc); await new Promise((r) => setTimeout(r, 5)); }   // the previews' hosts load on first need
    assert.equal(ghosts().length, 1, 'one preview');
    const g = ghosts()[0], bar = barOf(g);
    assert.ok(bar.hasAttribute('data-hm-edit') && bar.attrs['data-hm'] === 'helm', 'its bar is the piece the drags move');
    assert.equal(bar.querySelector('.helmpanel-name').textContent, 'At the helm (preview)');
    assert.deepEqual(bar.querySelectorAll('.helmpanel-btn').map((b) => b.attrs['data-act']), ['sails', 'light', 'slower', 'normal', 'faster', 'position', 'leave'], 'the helm\'s own buttons for a boat at the wheel');
    assert.equal(doc.getElementById(ENHANCED_HELM_ID), null, 'the live panel\'s slot stays empty');
    assert.equal(enhancedHelmBar(), null);
    const real = barOf(atHelm(doc));
    assert.equal(ghosts().length, 0, 'the real panel takes its place');
    assert.equal(g.parentElement, null, 'the whole stand-in leaves');
    assert.ok(real.hasAttribute('data-hm-edit'));
    hideEnhancedHelm();
    sweepHudLayout(doc);
    assert.equal(ghosts().length, 1);
    setHudLocked(true);
    assert.equal(ghosts().length, 0, 'locked: no preview');
  });
  const p = buildHelmPreview(fakePage());
  assert.deepEqual([p.className, p.parentElement, p.id], ['helmpanel', null, '']);
  const phone = fakePage();
  phone.defaultView.location = { search: '?touch=on' };
  assert.equal(buildHelmPreview(phone).className, 'helmpanel touch');
  assert.deepEqual(helmButtons(H({ sailsUp: false, light: false, manualTrim: false })).map((b) => b.act), ['sails', 'light', 'slower', 'normal', 'faster', 'position', 'leave'], 'the preview\'s set is the live law\'s for its state');
});

test('HUD-HELM THE CARD UNDER THE BAR: the sea\'s target card stands under the helm panel\'s bar wherever it is moved - its head the bar\'s foot and a gap, its centre the bar\'s, held on the screen - and back at the compass\'s foot when the bar is turned off; the host still hands it the bar it drew (mutants: the card centred on the screen; the card kept on the screen unread; a hidden bar still read)', () => {
  // the centre: the bar's own, held so the card at its scale stays on the screen
  assert.equal(NAVAL_CARD_W, 400);
  assert.equal(cardCentreUnder({ left: 100, width: 500 }, 1920, 1), 350);
  assert.equal(cardCentreUnder({ left: 0, width: 100 }, 1920, 1.5), 300, 'a bar at the left edge: the card\'s half at 1.5 from the edge');
  assert.equal(cardCentreUnder({ left: 1800, width: 120 }, 1920, 1), 1720, 'and at the right');
  assert.equal(cardCentreUnder({ left: 0, width: 100 }, 400, 1), 172, '86% of a narrow screen is the card\'s most');
  assert.equal(cardCentreUnder({ left: 10, width: 20 }, 0, 1), 20, 'no screen known: the bar\'s centre');
  // the card itself, on a screen with the column's room
  const model = {
    ship: { name: 'Small Ship', hull: 0.8, sail: 0.5, crew: 0.9, fire: false, wrecked: false, braced: false }, armed: true, aiming: false, aim: null, board: null, boarding: null,
    target: { name: 'The Red Wake', captain: 'Irna Vosk', classLine: 'Pirate Brigantine', faction: 'pirate', hull: 0.3, sail: 0.75, state: 'afloat', boarded: false, distance: 142, hostile: true, box: undefined },
    batteries: [], notoriety: { crown: 'Wayrest', value: 55, level: 2 },
  };
  const had = [globalThis.innerWidth, globalThis.innerHeight];
  globalThis.innerWidth = 1920; globalThis.innerHeight = 1080;
  try {
    destroyNavalHud();
    const rect = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top });
    const bar = (r, visibility = 'visible') => ({ getBoundingClientRect: () => r, ownerDocument: { defaultView: { getComputedStyle: () => ({ visibility }) } } });
    const draw = (under) => drawNavalHud(model, { keys: {}, scale: 1, under });
    draw(bar(rect(493, 66, 1427, 141)));
    const card = byClass(globalThis.document.body, 'dfnaval-card')[0];
    assert.deepEqual([card.style.top, card.style.left], [`${141 + NAVAL_CARD_GAP}px`, '960px'], 'the bar where the sheet stands it: the screen\'s centre, which is the bar\'s');
    draw(bar(rect(80, 120, 520, 200)));
    assert.deepEqual([card.style.top, card.style.left], [`${200 + NAVAL_CARD_GAP}px`, '300px'], 'moved down and left: under its foot, on its centre');
    draw(bar(rect(0, 66, 120, 141)));
    assert.equal(card.style.left, '200px', 'at the edge: the card (400 wide at 1) held on the screen');
    draw(bar(rect(80, 120, 520, 200), 'hidden'));
    assert.deepEqual([card.style.top, card.style.left], ['', ''], 'turned off in play: the card at the compass\'s foot, as with no helm');
    draw(null);
    assert.deepEqual([card.style.top, card.style.left], ['', ''], 'no helm: the sheet places it');
  } finally {
    destroyNavalHud();
    [globalThis.innerWidth, globalThis.innerHeight] = had;
  }
  assert.match(rd('src/scenes/world.js'), /scale: enhancedHudScale\(\),\n\s+under: enhancedHelmBar\(\),/, 'the host hands the card the bar it drew');
});

test('HUD-HELM THE FOUR HOSTS: the panel has one builder, and it places itself - world.js, the only host with a sea to sail, draws it; exterior.js, worldModes.js and dungeonContext.js draw none (mutant: the build\'s placing dropped)', () => {
  const helm = rd('src/ui/enhanced/enhancedHelm.js');
  assert.match(helm, /import \{ placeHudPieces \} from '\.\.\/hud\/hudPlacer\.js';/);
  assert.doesNotMatch(helm, /from '(?:\.\.?\/)+(?:[\w-]+\/)*hudLayout\.js'/, 'through the leaf');   // AUDIT TIDY TOOL-1: at any depth
  assert.match(helm, /doc\.body\.append\(host\);\n {4}placeHudPieces\(doc\);/, 'placed the moment it is put on the page');
  assert.match(rd('src/scenes/world.js'), /import \{ drawEnhancedHelm, hideEnhancedHelm, enhancedHelmMounted, enhancedHelmBar,/);
  for (const host of ['exterior.js', 'worldModes.js', 'dungeonContext.js']) assert.ok(!rd(`src/scenes/${host}`).includes('drawEnhancedHelm('), `${host}: draws no helm`);
});

test('HUD-HELM THE HUD STAYS LIGHT: the editor\'s preview reaches the panel\'s module, so the panel reads the helm keys and the hull names from their leaves (systems/comeSailAway/comeSailAwayActions.js, comeSailAwayHulls.js) - never from the sea\'s law or the boat, which would carry the quest machine onto the HUD (AUDIT GUIDE O6) - and the sea reads the one table back (mutants: the keys or the names read from the sea\'s module or the boat)', async () => {
  const from = [...rd('src/ui/enhanced/enhancedHelm.js').matchAll(/^import [^;]*? from '([^']+)';/gm)].map((m) => m[1]);
  assert.ok(from.includes('../../systems/comeSailAway/comeSailAwayActions.js') && from.includes('../../systems/comeSailAway/comeSailAwayHulls.js'), 'the two leaves');
  for (const heavy of ['comeSailAway.js', 'comeSailAwayBoat.js']) assert.ok(!from.some((s) => s.endsWith(`/comeSailAway/${heavy}`)), `the panel reads nothing from ${heavy}`);   // AUDIT TIDY TOOL-1: at any depth
  assert.equal(/^import /m.test(rd('src/systems/comeSailAway/comeSailAwayActions.js')), false, 'the keys\' table a leaf');
  const [leaf, sea] = await Promise.all([import('../../../src/systems/comeSailAway/comeSailAwayActions.js'), import('../../../src/systems/comeSailAway/comeSailAway.js')]);
  assert.equal(sea.BOAT_ACTIONS, leaf.BOAT_ACTIONS, 'one table: the sea re-exports the leaf\'s');
});
