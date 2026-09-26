// FRAME1: THE STONE-AND-BRASS KIT - one construction for every enhanced
// surface, built out of the vitals bars' language (VB2).
//
// WHY A KIT. The enhanced skin grew one screen at a time, and each
// screen typed its own frame: `2px solid rgba(125,116,96,0.55)` in
// twenty-five places, `0.35` in fourteen, `#7d7460` in six, grounds
// between 0.38 and 0.96 alpha. Every one of them was right on its day
// and together they read as thin and slightly different everywhere.
// Here a surface is given a ROLE, and the role - not the screen - says
// how it is built and how it answers a press:
//
//   window   a whole floating window: carved stone frame with brass
//            corner fittings, a solid ground, a hard drop shadow
//   panel    a box inside a window (a card, a notice): a stone bevel
//            and an engraved inner line
//   button   something you press: raised bevel, a lit top band and a
//            drop - it goes brass on hover, sinks when pressed
//   primary  the one press a screen is for: the button, in brass
//   tile     a pickable cell in a dense grid: the button without the
//            drop, so a grid of fifty does not turn into noise
//   chip     a small readout that is never pressed (HUD effects, tags)
//   well     something sunk INTO the surface: inputs, portraits, meters
//   header   the band that names a window: lit ground, groove beneath
//   footer   the band a window's actions stand on: groove above
//   rule     a row's underline, engraved rather than printed
//
// THE LAW THIS OBEYS. It changes paint and never geometry: no border
// WIDTH, padding or size is written here, so every probe that measured
// a box before measures the same box after (the quickslot diamond's
// clearance line, the level-up bands, the pack's tile rows). Frames
// that reach outside a box do it with border-image-outset and shadows,
// which take no space.
//
// HOW IT CASCADES. The sheet is appended LAST to ENHANCED_CSS, and each
// selector keeps its own specificity (a plain list, never :is(), which
// would lift a whole list to its heaviest member). So at equal weight
// the kit wins, and a screen's own heavier state rule (.hud-eff.expiring,
// .shell .row.on) still wins over it. The states the kit OWNS - hover,
// focus, pressed, on, disabled - it writes for every selector in the
// role, which is what makes them the same everywhere.
//
// TO DRESS A NEW SCREEN: add its selector to the role it plays below.

/** The palette, named for what it is. Light falls from the top left. */
export const FRAME_TONES = {
  outline: '#050608',
  stoneHi: '#c2b79a', stoneLit: '#9a9079', stoneMid: '#7a7260', stoneLo: '#5a5446',
  stoneDim: '#3a352a', stoneDark: '#25221b',
  brassHi: '#f3cf86', brass: '#c08a3e', brassLo: '#7a5424', brassDark: '#3d2a12',
  ground: 'rgba(12,14,18,0.93)', groundPanel: 'rgba(15,17,22,0.92)',
  groundButton: '#1c1f26', groundButtonHi: '#262a33', groundChip: 'rgba(12,14,18,0.84)',
  gold: 'rgb(243,239,44)', groove: 'rgba(163,152,128,0.26)',
};
const T = FRAME_TONES;
/** TOAST2: how long a HUD line takes to fade out (ui/enhancedNotice.js removes it after this). */
export const TOAST_FADE_MS = 700;

/** Which selectors play which role. Selectors are the screens' own, one
 *  per entry, exactly as their rules write them. */
export const FRAME_ROLES = {
  window: ['.dlg-win', '.px-win', '.pack-win', '.loot-win', '.px-about', '.px-profile', '.hmbox',
    // PLUS8: the journey's bar (ui/enhancedTravelControl.js) - carved stone, brass fittings, the theme's ground
    '.travelpanel-bar'],
  // the talk panel is a .px-win whose own ground rule outweighs .px-win's
  windowGround: ['.talk-shell .talk-panel'],
  panel: ['.port-host .port-card', '.pack-shell .packdetail .card', '.pack-shell .card', '.hmcard', '.px-sys .card', '.px-sys .dcard',
    '.shell .card', '.shell .dcard', '.notice', '.inputbox', '.lv-note', '.cr-shell .cr-entry',
    '.cr-shell .cr-sharebox', '.shell .ft-rail', '.pack-shell .transport .tplaque', '.shell .look-panel',
    // PLUS3: the trade counter's item-detail readout and the trade/tavern confirm boxes - the same
    // "box inside a window" role every other .card already plays, just under a shell of their own
    '.trade-shell .trade-detail', '.trade-shell .sb-ask .card', '.tavern-shell .sb-ask .card',
    // PLUS4: the shop's own two columns - "On the shelf" and the basket beside it - never carried a
    // box at all (packcol's base rule sets a flat background and nothing else); one selector catches
    // both, since the remote column is `.packcol.packremote` too. Paint only: packcol's own border
    // (below, in enhancedTrade's stylesheet) gives the kit a line to colour.
    // PLUS6: the shop's two columns moved to the WELL role - sunk into the window, not a raised box in it
    // NOTE: the crosshair's world plaque (.wplaque, .wplaque-stats) is deliberately NOT in this
    // role - it is a see-through readout over the game world, not a box inside a window, and a
    // theme must keep it translucent rather than paint it solid (see the dedicated rule below).
    // the online lane's own sheets are injected after this one, so their
    // selectors carry a leading body to outweigh them
    'body .dfsocial', 'body .dfprofile-card', 'body .dfchat-box',
    // PLUS7: the inventory's hover card and right-click menu
    '.inv-tip > .card', '.inv-menu', '.inv-info > .card', '.pbind > .card'],   // PLUS10: and the Info box; PADPLUS10: the bindings window
  // panels that carry a brass edge on the left as their own mark
  panelAccent: ['.notice', '.inputbox'],
  button: ['.port-host .port-btn', '.inv-info .act', '.pbind .act', '.px-sys .act', '.shell .act', '.px-win .card .act', '.pack-shell .act', '.px-setwrap .act',
    '.px-setwrap .step', '.shell .step', '.wizard .bigbtn', '.wizard .reflexbtn', '.lv-pick .lv-arrow',
    '.lv-pick .lv-press', '.shell .look-arrow', '.cr-shell .cr-rm', '.px-winclose', '.talk-head .act', '.talk-say .act',
    'body .dfsocial-btn', 'body .dfsocial-close', 'body .dfprofile-close', '.dlg-shell .dlg-btn',
    // PLUS3: the trade counter and the tavern panel (and the merchant/repair popup, which shares
    // .tavern-shell) never picked up a scoped role - their `.act` buttons fell through to the bare
    // base rule (flat outline, no bevel), which is the "still looks native" the shelf and the
    // four-button menu were reported in
    '.trade-shell .act', '.tavern-shell .act',
    // PLUS4: the spellbook and the chronicle - their OWN acts (Close in sb-top, Ready/Rename/
    // Delete/hotbar in sb-acts) were only ever named in the LAYOUT arrays below (ACTION_ROWS/
    // ACTION_BUTTONS: centring, minimum width) and never in this paint role, so the buttons sat
    // centred and evenly sized but flat-outlined - the Close button the spellbook was reported with
    '.sb-shell .act', '.cr-shell .act',
    // PLUS6: the shop's category tabs are buttons now (the examples' stone buttons), the chosen one brass
    '.trade-shell .packtab',
    // PLUS8: the journey bar's Map / Camp / Exit and the time stepper's two presses
    '.travelpanel-act', '.travelpanel-step'],
  primary: ['.lv-ok', '.hmroot .act'],
  tile: ['.port-host .port-tile', '.port-host .port-iconcell', '.pack-shell .itemrow', '.pack-shell .equipped .wornrow', '.pack-shell .wornsock', '.wizard .racegrid button',
    '.wizard .facegrid button', '.shell .ft-tile', '.shell .ft-seg', '.shell .ft-mchip', '.shell .ft-tile-more',   // FT18: a condensed tile's parts toggle
    '.sb-shell .sb-chip', '.cr-shell .sb-chip', '.piletab',
    // PLUS3: the shop's shelf rows and the tavern's food & drink rows - the same `.itemrow` the pack
    // wears as a tile, under the trade/tavern shells that role list never named
    // PLUS6: the shop's shelf rows and the tavern's dishes left this role - they are the lines of a list (listRow below)
    // PLUS4: the held map's own pair of options (Speed/Passage/Rest) - a pickable cell in a row of
    // two, same as any other tile; its OWN .on state keeps its brass mark (below), not the kit's
    '.hmpick'],
  chip: ['.hud-eff', '.hud-need', '.hud-qspell', '.hud-qstag', '.hud-readied', '.lv-note-key',
    '.shell .subbtn .count', '.hb .hb-caption'],
  well: ['.trade-shell .packcol', '.shell .ft-search', '.shell .ft-tile-drawer',   // FT18: the Features search and a tile's opened drawer
    '.port-host .port-field', '.port-host .port-canvas', '.port-host .port-picture img', '.port-host .port-pictureword', '.wizard .namebox', '.sb-shell .sb-rename input', '.cr-shell .cr-compose input', '.hmsearch input',
    '.talk-face', '.pack-shell .figure-doll', '.pack-shell .wornmap-doll.noart', '.shell .look-pic',
    '.shell .dcard code', '.px-setwrap .dcard code', '.px-meter', '.shell .swatch', '.px-setwrap .swatch',
    // PLUS8: the journey bar's time readout - the x40 sits in a socket between its two presses
    '.travelpanel-accel'],
  input: ['.shell .ft-search', '.wizard .namebox', '.sb-shell .sb-rename input', '.cr-shell .cr-compose input', '.hmsearch input',
    'body .dfsocial-field', 'body .dfchat-input'],
  meterFill: ['.px-fill'],
  header: ['.port-host .port-head', '.px-win .px-tabs', '.talk-head', '.sb-shell .sb-top', '.cr-shell .sb-top', '.trade-shell .sb-top',
    '.tavern-shell .sb-top', '.pack-shell .pack-id', '.hmbox-title', '.loot-win .remotehead',
    // PLUS4: the shelf's own "On the shelf / N items" band - the same header a loot window's
    // remotehead already wears, just never scoped for the trade counter's own copy of that markup
    '.trade-shell .remotehead',
    'body .dfsocial-head', 'body .dfchat-tabs', 'body .dfsocial-tabs'],
  headerRule: ['.shell .ft-drawer-label', '.pack-shell .card h3', '.hmcard h3', '.hmcard h2', '.lv-crown', '.talk-modes', '.talk-cats'],
  footer: ['.port-host .port-foot', '.dlg-shell .dlg-acts', '.trade-shell .trade-footer', '.pack-shell .pack-dock', '.pack-shell .packbar', '.talk-say'],
  footerRule: ['.lv-foot', '.wizard .actionbar'],
  rule: ['.port-host .port-stat', '.px-stat', '.px-sys .row', '.shell .row', '.px-setwrap .row', '.hmresult', '.hmpair', '.cr-shell .cr-head',
    'body .dfprofile-head', 'body .dfsocial-letterhead'],
  // rules that sit ABOVE their content
  ruleTop: ['.px-qarch', '.wplaque-list', 'body .dfchat-form'],
  // a list whose rows are lines, not boxes: the loot window's rows
  // (they are .pack-shell .itemrow too, so this outweighs the tile role)
  listRow: ['.pack-shell .loot-win .itemrow', '.trade-shell .itemrow'],   // PLUS6: the shop's shelf and basket rows too
  // the fading wing rules and dividers of the quest page
  wing: ['.px-qwing'],
  wingFlip: ['.px-qwing.px-flip'],
  railRight: ['.px-qrail', '.shell .side', '.shell .subrail'],
  railLeft: ['.talk-topics', '.shell .detail', 'body .dfchat-who'],
  tabs: ['.px-tabs button', '.talk-mode', 'body .dfsocial-tab', 'body .dfchat-tab'],
  // the CHOSEN option of a row of several (Cloud quality: Default / Low / High, and
  // every tier row like it) - filled green, the colour of a switch that is on.
  // On/off switches already carry their own green and red (.ft-seg-switch).
  chosen: ['.ft-seg:not(.ft-seg-switch) .ft-segb[aria-pressed="true"]', '.ft-seg.ft-seg-switch .ft-segb:not(.off)[aria-pressed="true"]'],
  chosenLocked: ['.ft-seg.locked:not(.ft-seg-switch) .ft-segb[aria-pressed="true"]'],
  qrow: ['.port-host .port-row', '.pick-shell .pick-row', '.px-qrow', '.talk-row'],
  // everything in the online lane's panels that was rounded
  square: ['body .dfsocial', 'body .dfprofile-card', 'body .dfchat-box', 'body .dfsocial-btn', 'body .dfsocial-close',
    'body .dfprofile-close', 'body .dfsocial-field', 'body .dfchat-input'],
};

const list = (sels, suffix = '') => sels.map((s) => `${s}${suffix}`).join(',\n');

/**
 * The window frame as a 9-slice picture: `BAND` pixels a side, drawn
 * pixel for pixel (crispEdges, and used at 1:1 so it is never scaled).
 * From the outside in: the outline, the lit/shaded stone bevel, an
 * engraved black line, and a dark inner lip. The corners are brass
 * fittings with a rivet. Exported so a test can read the geometry.
 */
export const BAND = 12;
/** How many of BAND's pixels are the stone edge; the rest of an edge is
 *  clear, so the brass fittings can stand larger than the frame is thick. */
export const EDGE = 8;
/** How far the picture reaches OUTSIDE the box: the edge minus the box's
 *  own 2px border, which the innermost two pixels land on exactly. */
export const OUTSET = EDGE - 2;
export function frameSvg(t = T) {
  const N = BAND * 2 + 1;
  // one row of a TOP (lit) and a BOTTOM (shaded) edge, outside to in
  const lit = [t.outline, t.stoneHi, t.stoneLit, t.stoneMid, t.stoneLo, t.outline, '#16140f', '#0c0d10'];
  const shade = [t.outline, t.stoneDark, t.stoneDim, '#443e31', '#4f4838', t.outline, t.stoneLo, '#1c1a15'];
  const F = 11;   // the fitting's size, a square with a clipped inner corner
  const rects = [];
  const px = (x, y, c) => { if (c) rects.push(`<rect x='${x}' y='${y}' width='1' height='1' fill='${c}'/>`); };
  // i, j: distance from the corner's two OUTER edges. Returns null where
  // the fitting does not reach, so the stone edge shows through.
  const fitting = (i, j) => {
    if (i >= F || j >= F) return null;
    if (i + j > F + 4) return null;                 // the clipped inner corner
    if (i === 0 || j === 0 || i === F - 1 || j === F - 1 || i + j === F + 4) return t.outline;
    const r = 4;                                    // the rivet, 3x3 with a lit pixel
    if (i >= r && i <= r + 2 && j >= r && j <= r + 2) {
      if (i === r + 1 && j === r + 1) return t.brassHi;
      return (i === r || j === r) ? t.brassDark : t.brassLo;
    }
    if (i === 1 || j === 1) return t.brassHi;
    if (i === F - 2 || j === F - 2 || i + j === F + 3) return t.brassLo;
    return t.brass;
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const inL = x < BAND, inR = x > BAND, inT = y < BAND, inB = y > BAND;
      const dt = y, db = N - 1 - y, dl = x, dr = N - 1 - x;
      if ((inL || inR) && (inT || inB)) {
        const i = inT ? dt : db, j = inL ? dl : dr;
        const f = fitting(i, j);
        if (f) { px(x, y, f); continue; }
        // under the fitting's clipped corner: the two edges meet
        if (i < EDGE && j < EDGE) px(x, y, i <= j ? (inT ? lit[i] : shade[i]) : (inL ? lit[j] : shade[j]));   // a mitre
        else if (i < EDGE) px(x, y, inT ? lit[i] : shade[i]);
        else if (j < EDGE) px(x, y, inL ? lit[j] : shade[j]);
      } else if (inT) { if (dt < EDGE) px(x, y, lit[dt]); }
      else if (inB) { if (db < EDGE) px(x, y, shade[db]); }
      else if (inL) { if (dl < EDGE) px(x, y, lit[dl]); }
      else if (inR) { if (dr < EDGE) px(x, y, shade[dr]); }
    }
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${N}' height='${N}' shape-rendering='crispEdges'>${rects.join('')}</svg>`;
}
const FRAME_URL = `url("data:image/svg+xml,${encodeURIComponent(frameSvg())}")`;

/** The stone grain every window ground carries: a 4px checker at 2%. */
const GRAIN = 'repeating-conic-gradient(rgba(255,255,255,0.022) 0 25%, transparent 0 50%) 0 0 / 4px 4px';

// Bevels, written once: top right bottom left.
const RAISED = `${T.stoneLit} ${T.stoneDim} ${T.stoneDark} ${T.stoneMid}`;
const RAISED_SOFT = `${T.stoneMid} #2e2a21 ${T.stoneDark} ${T.stoneLo}`;
const SUNK = `${T.stoneDark} ${T.stoneMid} ${T.stoneLit} ${T.stoneDim}`;
const BRASS = `${T.brassHi} ${T.brassLo} #5c3f1a ${T.brass}`;
const RING = `0 0 0 1px ${T.outline}`;
const LIT_BAND = 'linear-gradient(180deg, rgba(255,255,255,0.08) 0 2px, transparent 2px calc(100% - 3px), rgba(0,0,0,0.32) calc(100% - 3px))';

export function frameCss(r = FRAME_ROLES) {
  const pressable = [...r.button, ...r.primary];
  return `
/* ── FRAME1: THE STONE-AND-BRASS KIT (ui/enhancedFrame.js) ─────────
   Generated: every rule below comes from a role list in that module.
   Paint only - no widths, no padding, no sizes. */

/* WINDOW */
${list(r.window)} {
  border-image: ${FRAME_URL} ${BAND} / ${BAND}px / ${OUTSET}px stretch;
  background: ${GRAIN}, ${T.ground};
  box-shadow: 4px 4px 0 ${OUTSET}px rgba(0,0,0,0.42);
  outline: none; }
${list(r.windowGround)} { background: ${GRAIN}, ${T.ground}; }
/* the brass fittings stand where the gems stood */
${list(r.window, ' .px-corner')} { display: none; }

/* PANEL */
${list(r.panel)} {
  border-color: ${RAISED};
  background-color: ${T.groundPanel};
  box-shadow: ${RING}, inset 0 0 0 1px rgba(5,6,8,0.75), inset 0 3px 0 -1px rgba(255,255,255,0.04),
    3px 3px 0 1px rgba(0,0,0,0.4);
  outline: none; }
${list(r.panelAccent)} { border-left-color: ${T.brass}; }

/* BUTTON + PRIMARY - raised; brass under the pointer or the pad; sunk
   while held; flat when it cannot be pressed. */
${list(pressable)} {
  border-color: ${RAISED};
  background-color: ${T.groundButton}; background-image: ${LIT_BAND};
  box-shadow: ${RING}, 2px 2px 0 1px rgba(0,0,0,0.45);
  transition: none; }
${list(r.primary)} { border-color: ${BRASS}; background-color: #2a2217; }
${list(pressable, ':hover')},
${list(pressable, ':focus-visible')},
${list(r.button, '.on')},
${list(r.button, '.primary')} {
  border-color: ${BRASS}; background-color: ${T.groundButtonHi}; background-image: ${LIT_BAND}; }
${list(r.primary, ':hover')}, ${list(r.primary, ':focus-visible')} { background-color: #3a2e1c; }
${list(pressable, ':active:not(:disabled)')} {
  border-color: ${SUNK}; translate: 1px 1px;
  box-shadow: ${RING}, inset 2px 2px 0 rgba(0,0,0,0.5); }
${list(pressable, ':disabled')},
${list(pressable, '[disabled]')} {
  border-color: rgba(125,116,96,0.3); background-color: rgba(12,14,18,0.6); background-image: none;
  box-shadow: 0 0 0 1px rgba(5,6,8,0.6); translate: none; }

/* TILE - the button without its drop, for dense grids */
${list(r.tile)} {
  border-color: ${RAISED_SOFT};
  background-image: linear-gradient(180deg, rgba(255,255,255,0.06) 0 2px, transparent 2px);
  box-shadow: ${RING}; transition: none; }
${list(r.tile, ':hover')}, ${list(r.tile, ':focus-visible')} { border-color: ${BRASS}; }
${list(r.tile, '.on')}, ${list(r.tile, '.sel')}, ${list(r.tile, '[aria-pressed="true"]')} {
  border-color: ${BRASS};
  background-image: linear-gradient(180deg, rgba(243,207,134,0.14) 0 2px, rgba(192,138,62,0.08) 2px); }
${list(r.tile, '.dragover')} { box-shadow: ${RING}, inset 0 2px 0 ${T.brass}; }
${list(r.tile, ':active')} { border-color: ${SUNK}; }

/* CHIP - a readout, never pressed */
${list(r.chip)} {
  border-color: ${RAISED_SOFT}; background-color: ${T.groundChip};
  box-shadow: ${RING}, 2px 2px 0 1px rgba(0,0,0,0.35); }

/* WELL - sunk into the surface. Inputs light brass while typed in. */
${list(r.well)} {
  border-color: ${SUNK};
  box-shadow: ${RING}, inset 2px 2px 0 rgba(0,0,0,0.5); }
${list(r.input)} { background-color: rgba(4,5,7,0.7); }
${list(r.input, ':focus')} { border-color: ${T.brassLo} ${T.brass} ${T.brassHi} ${T.brassLo}; outline: none; }

/* METERS - the fill banded like the vitals: lit top, shaded foot, a lit leading edge */
${list(r.meterFill)} {
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.35),
    inset -2px 0 0 rgba(255,255,255,0.4); }
.px-skill .px-fill { box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), inset -2px 0 0 rgba(255,255,255,0.4); }

/* HEADER - the band that names a window: a lit ground over a groove */
${list(r.header)} {
  border-bottom-color: ${T.outline};
  background-image: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015));
  box-shadow: 0 1px 0 ${T.groove}, inset 0 1px 0 rgba(255,255,255,0.05); }
${list(r.headerRule)} { border-bottom-color: ${T.outline}; box-shadow: 0 1px 0 ${T.groove}; }

/* FOOTER - the band the window's actions stand on */
${list(r.footer)} {
  border-top-color: ${T.outline};
  background-image: linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.2));
  box-shadow: inset 0 1px 0 ${T.groove}; }
${list(r.footerRule)} { border-top-color: ${T.outline}; box-shadow: inset 0 1px 0 ${T.groove}; }

/* RULES AND RAILS - engraved: a dark cut with the light catching under it */
${list(r.rule)} { border-bottom-color: rgba(5,6,8,0.6); box-shadow: 0 1px 0 rgba(163,152,128,0.13); }
${list(r.railRight)} { border-right-color: rgba(5,6,8,0.75); }
${list(r.railLeft)} { border-left-color: rgba(5,6,8,0.75); }

/* WHERE YOU ARE - the chosen tab and quest row carry a brass mark, not only a colour */
${list(r.tabs, '.on')} { box-shadow: inset 0 -2px 0 ${T.brass}; background: rgba(192,138,62,0.08); }
${list(r.tabs, ':hover:not(.on)')} { box-shadow: inset 0 -2px 0 rgba(192,138,62,0.4); }
${list(r.qrow, '.on')} { box-shadow: inset 2px 0 0 ${T.brass}; background: rgba(192,138,62,0.07); }

${list(r.ruleTop)} { border-top-color: rgba(5,6,8,0.6); box-shadow: inset 0 1px 0 rgba(163,152,128,0.13); }
.px-qarch.px-qfirst { box-shadow: none; }   /* the first heading has no rule above it */
${list(r.square)} { border-radius: 0; }

/* LIST ROWS - lines, not boxes; the chosen one carries the brass mark */
${list(r.listRow)} { border-bottom-color: rgba(5,6,8,0.55); background-image: none;
  box-shadow: 0 1px 0 rgba(163,152,128,0.1); }
${list(r.listRow, ':hover')}, ${list(r.listRow, ':focus-visible')} { border-bottom-color: rgba(5,6,8,0.55);
  box-shadow: 0 1px 0 rgba(163,152,128,0.1), inset 2px 0 0 rgba(192,138,62,0.45); }
${list(r.listRow, '.on')} { border-bottom-color: rgba(5,6,8,0.55); background-image: none;
  box-shadow: 0 1px 0 rgba(163,152,128,0.1), inset 2px 0 0 ${T.brass}; }

/* THE QUEST PAGE'S WINGS AND DIVIDERS - engraved, fading out */
${list(r.wing)} { background: linear-gradient(180deg, rgba(5,6,8,0.85) 0 1px, rgba(163,152,128,0.55) 1px);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000); mask-image: linear-gradient(90deg, transparent, #000); }
${list(r.wingFlip)} { -webkit-mask-image: linear-gradient(90deg, #000, transparent); mask-image: linear-gradient(90deg, #000, transparent); }
.px-divider::before, .px-divider::after { background: linear-gradient(180deg, rgba(5,6,8,0.85) 0 1px, rgba(163,152,128,0.55) 1px); }

/* THE HOTBAR - ten sockets cut into stone: a stone rim, a sunk face,
   and brass for what is in hand. Prefixed with .hb because the hotbar's
   own sheet is injected after this one. */
.hb .hb-slot { background-color: rgba(10,12,16,0.9); background-image: none;   /* a plain sunk face - no dot dither */
  box-shadow: ${RING}, 2px 2px 0 1px rgba(0,0,0,0.5); }
.hb .hb-frame { border-color: ${RAISED_SOFT};
  box-shadow: inset 0 0 0 1px rgba(5,6,8,0.8), inset 2px 2px 0 1px rgba(0,0,0,0.35); }
.hb .hb-slot.hb-empty .hb-frame { border-style: solid; border-color: rgba(122,114,96,0.35) rgba(37,34,27,0.6) rgba(37,34,27,0.6) rgba(122,114,96,0.3); }
.hb .hb-slot.hb-active .hb-frame { border-color: ${BRASS};
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 0 14px rgba(192,138,62,0.35); }
.hb .hb-key { color: #c9bfa4; text-shadow: 1px 1px 0 #000; }
.hb .hb-wear { box-shadow: 0 0 0 1px ${T.outline}; }
.hb .hb-slot.hb-strike .hb-frame { border-color: ${T.brassHi} ${T.brass} ${T.brassLo} ${T.brassHi}; }

/* THE QUICKSLOT DIAMOND - the rim is a clipped rhombus, so its bevel is
   a BACKGROUND lit from the top left; the ground inside it is sunk. */
.hud-qdiamond .hud-qframe { background: linear-gradient(135deg, ${T.stoneHi} 0%, ${T.stoneMid} 45%, ${T.stoneDim} 70%, ${T.stoneDark} 100%); }
.hud-qdiamond .hud-qground { background: linear-gradient(135deg, rgba(4,5,7,0.92) 0%, rgba(14,16,20,0.86) 55%, rgba(26,28,33,0.84) 100%); }
.hud-qdiamond .hud-qcell.socket .hud-qframe { background: linear-gradient(135deg, rgba(122,114,96,0.55), rgba(37,34,27,0.55)); }
.hud-qdiamond .hud-qcell.cycling .hud-qframe { background: linear-gradient(135deg, #fff39a, ${T.gold} 50%, #9a8a14); }

/* THE HUD'S OTHER TRACKS (target, breath) wear the vitals' frame */
.hud-track { border-color: ${RAISED}; background-color: rgba(8,9,12,0.85);
  box-shadow: ${RING}, 2px 2px 0 1px rgba(0,0,0,0.45); }
.hud-foe .hud-fill { background: linear-gradient(180deg, #f2a597 0 1px, #c8483a 1px calc(100% - 1px), #7a2019 calc(100% - 1px)); }
.hud-breath .hud-fill { box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.35); }
.hud-compass { border-bottom-color: ${T.stoneLit}; box-shadow: 0 2px 0 rgba(5,6,8,0.55); }

/* TOASTS - a HUD line (a skill up, a loot tally, a hunger line) is WORDS, not a box:
   no ground, no frame, a dark outline so it reads against any sky - and it FADES where
   it stands when its time is up (TOAST_FADE_MS, ui/enhancedNotice.js), not slide away. */
/* PLUS1b: the toasts keep their panel (the kit's panel dress, through .notice) - only the leaving changed. */
.notice.notice-toast.notice-out { transform: translateX(0); opacity: 0; transition: opacity ${TOAST_FADE_MS}ms ease-out; }

/* SKILL2: A SKILL-UP IS WORDS, NOT A BOX - the level-up strip above the vitals
   (ui/levelNotice.js) keeps its box for the level row, the one row you act on; a
   skill line is yellow outlined text like the other HUD lines, and every line that
   expires fades where it stands over FADE_MS (700ms) instead of blinking off. */
.lv-note.lv-note-skill { background: none; border-color: transparent; box-shadow: none; }
.lv-note.lv-note-skill .lv-note-gem, .lv-note.lv-note-skill .lv-note-title, .lv-note.lv-note-skill .lv-note-sub {
  color: rgb(243,239,44);
  text-shadow: -1px 0 0 ${T.outline}, 1px 0 0 ${T.outline}, 0 -1px 0 ${T.outline}, 0 1px 0 ${T.outline}, 2px 2px 0 rgb(93,77,12); }
.lv-note.lv-fading { animation: lv-note-fade 700ms ease-out forwards; }
@keyframes lv-note-fade { from { opacity: 1; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .lv-note.lv-fading { animation-duration: 1ms; } }

/* THE CROSSHAIR PLAQUE - it sits on the world you are looking at, so it is a veil, not a
   slab: the panel dress stays (frame, ring), the ground lets the scene through. */
.wplaque, .wplaque-stats { background-color: rgba(10,12,17,0.72);
  box-shadow: ${RING}, inset 0 0 0 1px rgba(5,6,8,0.45), 2px 2px 0 1px rgba(0,0,0,0.25); }
.wplaque { border-color: rgba(154,144,121,0.6) rgba(58,53,42,0.6) rgba(37,34,27,0.6) rgba(110,103,85,0.6); }

/* THE CHOSEN OPTION - green, banded like the fatigue bar, lit on top */
${list(r.chosen)} {
  background: linear-gradient(180deg, #5fc27c 0 1px, #3a9a5a 1px 3px, #2f8a4f 3px calc(100% - 3px), #216b3b calc(100% - 3px));
  color: #f2fbe8; text-shadow: 1px 1px 0 #0a2413; box-shadow: 0 0 0 1px ${T.outline}; }
${list(r.chosen, ':hover:not(:disabled)')} { color: #ffffff; }
/* an option the online lane has set keeps its brass words, on the same green */
${list(r.chosenLocked)} { color: ${T.brassHi}; }

/* SCROLLBARS - a stone slider in a sunk channel */
.shell ::-webkit-scrollbar-thumb, .px-win ::-webkit-scrollbar-thumb {
  background: ${T.stoneMid}; border-color: ${RAISED}; }
.shell ::-webkit-scrollbar-track, .px-win ::-webkit-scrollbar-track { background: rgba(0,0,0,0.35); }

@media (prefers-reduced-motion: reduce) {
  ${list(pressable, ':active:not(:disabled)')} { translate: none; }
}
`;
}

/**
 * PLUS2 (2026-09-25): THE COLOURS - Enhanced Plus's grounds in other stones. The kit above is Slate; a theme repaints
 * the SURFACES only (windows, panels, buttons, tiles, chips, inputs, and the enhanced sheet's own ink/slate/iron), never
 * a frame, a width or a word's colour, so every screen keeps its shape and its brass. Worn as
 * <html data-plus-theme="…">, set from the `plusTheme` pref (ui/enhancedStyle.js) and changed live on the UI Overhaul
 * card. Stone is Daggerfall's own: the grey marbled rock of its spellbook and its sheets.
 */
// PLUS2c: STITCHED, so the tile has no seam. feTurbulence's fractalNoise is only continuous
// INSIDE one filter region; tiled bare, every 220px (marble) or 96px (grit) repeat draws a hard
// line where the noise jumps back to its start - visible as a seam running down (and across) any
// surface wider than one tile, worst in the middle of a panel where a repeat boundary lands. The
// filter region has to be pinned to the tile's own pixel box (x/y/width/height, not the default
// -10%..120%) for `stitchTiles="stitch"` to actually close the loop at that box's edges.
const MARBLE = (tone, a) => `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='m' x='0%' y='0%' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.022 0.05' numOctaves='5' seed='7' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 ${tone} 0 0 0 0 ${tone} 0 0 0 0 ${tone} 0 0 0 ${a} 0'/></filter><rect width='220' height='220' filter='url(%23m)'/></svg>`,
).replace(/%2523/g, '%23')}") 0 0 / 220px 220px`;
/** PLUS2b: the grit - a fine, hard-grained noise over the marble, so the stone reads rough rather than smooth. */
const GRIT = (a) => `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><filter id='g' x='0%' y='0%' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='3' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${a} 0'/></filter><rect width='96' height='96' filter='url(%23g)'/></svg>`,
).replace(/%2523/g, '%23')}")`;
/** PLUS2d: hex -> "r, g, b", for a theme colour that needs to keep an alpha channel
 *  (the crosshair plaque, the Ascend screen's crown/foot) rather than paint solid. */
const rgbOf = (hex) => {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
};
export const PLUS_THEMES = Object.freeze({
  slate: { name: 'Slate', swatch: '#171b21' },   // the kit as it stands
  stone: { name: 'Stone', swatch: '#6a6a64', ink: '#3c3c38', slate: '#4a4a45', iron: '#77776f',
    ground: '#51514c', panel: '#5a5a54', button: '#4a4a45', buttonHi: '#5f5f58', chip: 'rgba(60,60,56,0.9)',
    input: 'rgba(30,30,28,0.75)', marble: MARBLE(1, 0.2), grit: GRIT(0.55) },
  iron: { name: 'Iron', swatch: '#2f3844', ink: '#161b22', slate: '#1f262f', iron: '#3a4552',
    ground: '#232a33', panel: '#28303a', button: '#2c3440', buttonHi: '#36404d', chip: 'rgba(28,34,42,0.9)', input: 'rgba(8,10,14,0.75)' },
  ember: { name: 'Ember', swatch: '#3a1a14', ink: '#1a0d0a', slate: '#24110d', iron: '#4a2a22',
    ground: '#2a1510', panel: '#301914', button: '#3a1d16', buttonHi: '#4a261c', chip: 'rgba(40,20,15,0.9)', input: 'rgba(14,6,4,0.75)' },
  forest: { name: 'Forest', swatch: '#1c2e22', ink: '#0c140f', slate: '#122018', iron: '#2c4234',
    ground: '#15231a', panel: '#1a2b20', button: '#1f3226', buttonHi: '#284030', chip: 'rgba(20,34,25,0.9)', input: 'rgba(5,10,7,0.75)' },
  night: { name: 'Night', swatch: '#18203a', ink: '#0b0f1c', slate: '#121831', iron: '#2c3656',
    ground: '#131a30', panel: '#182038', button: '#1c2542', buttonHi: '#263052', chip: 'rgba(20,26,48,0.9)', input: 'rgba(5,7,14,0.75)' },
});
export const DEFAULT_PLUS_THEME = 'slate';
export function themeCss(id, th, r = FRAME_ROLES) {
  if (!th.ground) return '';
  const at = (sels, suffix = '') => sels.map((x) => `:root[data-plus-theme="${id}"] ${x}${suffix}`).join(',\n');
  const pressable = [...r.button, ...r.primary];
  // PLUS2b: a textured stone lays its grit and marble on EVERY surface - windows, panels, buttons, tiles, chips -
  // under the kit's own light bands, so the whole screen is the one rough rock and not a grey box on a dark one.
  const img = th.marble ? `${th.grit}, ${th.marble.replace(/ 0 0 \/ .*$/, '')}` : '';
  const sizes = th.marble ? '96px 96px, 220px 220px' : '';
  const tex = th.marble ? `${th.grit} 0 0 / 96px 96px, ${th.marble}, ` : '';
  const textured = (sels, band) => (th.marble ? `${at(sels)} { background-image: ${band ? `${band}, ` : ''}${img}; background-size: ${band ? 'auto, ' : ''}${sizes}; }\n` : '');
  return `
/* PLUS2: ${th.name} */
:root[data-plus-theme="${id}"] { --ink: ${th.ink}; --slate: ${th.slate}; --iron: ${th.iron}; }
${at(r.window)}, ${at(r.windowGround)} { background: ${tex}${GRAIN}, ${th.ground}; }
${at(r.panel)} { background-color: ${th.panel}; }
${textured(r.panel)}
/* PLUS4: a skill-up is WORDS, not a box (SKILL2, frameCss above) - Slate never paints a theme sheet
   at all, so that rule stood unchallenged and skill-ups there stayed backgroundless; every OTHER
   theme's panel rule (just above) outweighs it by specificity and put the box back. Repeat the "no
   box" law here, at the theme's own specificity, so every theme reads the same as Slate does. */
:root[data-plus-theme="${id}"] .lv-note.lv-note-skill { background: none; }
/* PLUS6: the same for the HUD's toasts (a skill-up, a loot tally): the theme's panel rule above outweighed the
   kit's "words, not a box" and put the box back on every theme but Slate */
:root[data-plus-theme="${id}"] .notice.notice-toast { background: none; border-color: transparent; box-shadow: none; }
${at(pressable)} { background-color: ${th.button}; }
${at(pressable, ':hover')}, ${at(pressable, ':focus-visible')}, ${at(r.button, '.on')}, ${at(r.button, '.primary')} { background-color: ${th.buttonHi}; }
${textured(pressable, LIT_BAND)}${at(r.tile)} { background-color: ${th.button}; }
${textured(r.tile, 'linear-gradient(180deg, rgba(255,255,255,0.06) 0 2px, transparent 2px)')}${at(r.chip)} { background-color: ${th.chip}; }
${textured(r.chip)}
${at(r.input)} { background-color: ${th.input}; }
/* PLUS2c: the crosshair's world plaque - tinted, never opaque. It reads over the game world, so
   every theme keeps the SAME 0.9 alpha slate wears (see enhancedStyle.js .wplaque/.wplaque-stats)
   rather than the panel role's flat colour, which would black out the world behind it. */
:root[data-plus-theme="${id}"] .wplaque, :root[data-plus-theme="${id}"] .wplaque-stats { background: rgba(${rgbOf(th.panel)}, 0.9); }
/* PLUS2c: the hotbar and the quickslot diamond - the same sunk stone as everything else, but kept
   at slate's own alpha rather than the tile role's flat colour: these sit right over the game
   world (not inside a window), so a theme must tint them, not black them out. */
:root[data-plus-theme="${id}"] .hb .hb-slot { background-color: rgba(${rgbOf(th.panel)}, 0.9); }
/* PLUS6: on EVERY theme the hotbar sockets and the quickslot diamond wear the SAME stone as the status chips
   (Hungry, Dehydrated...) - the chip role's colour, and on a textured theme its grit and marble too - one rock */
:root[data-plus-theme="${id}"] .hb .hb-slot { background-color: ${th.chip}; ${th.marble ? `background-image: ${img}; background-size: ${sizes};` : 'background-image: none;'} }
:root[data-plus-theme="${id}"] .hud-qdiamond .hud-qground { background: ${tex}${th.chip}; }
${th.marble ? `/* PLUS6: on a TEXTURED theme (Stone) the hotbar's sockets and the quickslot diamond wear the very ground the
   status blocks under the vitals do (Hungry, Dehydrated - the chip role): the chip's own colour with the grit and
   the marble over it. Only a textured theme writes this; every other theme keeps its own tint above. */
:root[data-plus-theme="${id}"] .hb .hb-slot { background-color: ${th.chip}; background-image: ${img}; background-size: ${sizes}; }
:root[data-plus-theme="${id}"] .hud-qdiamond .hud-qground { background: ${tex}${th.chip}; }` : ''}
:root[data-plus-theme="${id}"] .hud-qdiamond .hud-qground {
  background: linear-gradient(135deg, rgba(${rgbOf(th.ink)},0.92) 0%, rgba(${rgbOf(th.panel)},0.86) 55%, rgba(${rgbOf(th.button)},0.84) 100%); }
/* PLUS2c: the Ascend screen's crown and foot bars, in the theme's own stone rather than Slate's
   fixed ink - same translucent gradient shape, just the theme's ground fading to its ink. */
:root[data-plus-theme="${id}"] .lv-sky .lv-crown, :root[data-plus-theme="${id}"] .lv-sky .lv-foot {
  background: linear-gradient(180deg, rgba(${rgbOf(th.ground)}, 0.92), rgba(${rgbOf(th.ink)}, 0.9)); }
/* PLUS2b: the rails and the backdrop - a textured stone is the WHOLE screen (the dark starfield put away, the page
   itself the rock); a coloured one tints the starfield from the page's own ink beneath it. */
${at([...r.railRight, ...r.railLeft, '.shell > .side', 'aside.side'])} { background-color: ${th.slate}; }
${textured([...r.railRight, ...r.railLeft, '.shell > .side', 'aside.side'])}${th.marble
    ? `:root[data-plus-theme="${id}"] .px-ground { opacity: 0; }
:root[data-plus-theme="${id}"] body { background: ${tex}${th.ink}; }`
    : `:root[data-plus-theme="${id}"] .px-ground { opacity: 0.4; }`}`;
}
export const THEME_CSS = Object.entries(PLUS_THEMES).map(([id, th]) => themeCss(id, th)).join('\n');

export const FRAME_CSS = `${frameCss()}
/* ── PLUS2: THE COLOURS (after the kit, so a theme's ground wins by the page attribute) ── */
${THEME_CSS}
`;

/**
 * LAYOUT1: THE BUTTON ROWS. The one part of the kit that DOES move
 * things, kept apart from the paint above so that law stays checkable:
 * a window's answers stand CENTRED under what they answer, a fixed gap
 * apart, and every button is at least one width and says its word in
 * the middle - so OK, Yes and Cancel line up the same on every screen.
 */
export const ONE_PANE = ['.rest-shell .px-body > .card'];
export const ACTION_ROWS = ['.px-sys .acts', '.px-win .card .acts', '.pack-shell .acts', '.sb-shell .sb-acts',
  '.cr-shell .sb-acts', '.hmacts', '.lv-acts'];
export const ACTION_BUTTONS = ['.px-sys .act', '.px-win .card .act', '.pack-shell .act', '.sb-shell .sb-acts .act',
  '.cr-shell .sb-acts .act', '.hmroot .act', '.lv-ok', '.talk-head .act', '.talk-say .act'];
export const LAYOUT_CSS = `
/* ── LAYOUT1: BUTTON ROWS (ui/enhancedFrame.js) ─────────────────── */
${list(ACTION_ROWS)} { justify-content: center; gap: 10px; }
${list(ACTION_BUTTONS)} { min-width: 104px; text-align: center; justify-content: center; }

/* ONE PANE - a window whose body is a single card (the rest window: the choice, the
   hours, the sleep, the wake-up) is ONE frame. The card draws no box of its own
   inside the window's, so it is not a screen in a screen. */
${list(ONE_PANE)} { border: 0; background: none; box-shadow: none; outline: none; margin: 0; padding: 18px 22px 16px; }
${list(ONE_PANE.map((s) => `${s}.wake`))} { text-align: center; }
${list(ONE_PANE.map((s) => `${s}.wake p`))} { font-size: 18px; margin: 4px 0 14px; }
${list(ONE_PANE.map((s) => `${s} .acts`))} { justify-content: center; }
`;
