// @ts-check
// UI-CALM (2026-10-14) - THE QUIET PASS: one sheet laid after Enhanced Plus's (enhancedStyle.js injectEnhancedStyle),
// so its rules win by order where they say the same thing, and DFO Grimoire inks it as it inks every other sheet.
//
// The report it answers, a player's, in six points: the first screen should ask ONLINE or OFFLINE and nothing else;
// character creation looks like a placeholder of text and buttons; the menus are cluttered and lack hierarchy ("Why are
// horse coat colors huge buttons instead of a selector? Why do they take up more space than the horse stats?"); the
// text is barely readable by default ("New players shouldn't have to fix the UI themselves"); a huge, unmovable horse
// and cart panel stands at the top of the screen, and the temperature belongs in the bottom-left corner; and every new
// system adds a panel - "Show information when it's relevant."
//
// What lives here is TYPE and SPACE - sizes, weights, the words' colours, the gaps - never a paint the kit owns
// (enhancedFrame.js FRAME_ROLES: the edges, the grounds, the brass). The behaviour each of those points needed is in
// its own module: the two-question door (ui/enhanced/enhancedMenu.js drawDoors), the saddle panel shown when it is wanted
// (ui/enhanced/enhancedSaddle.js saddleShown), the temperature in the corner (ui/enhanced/enhancedHud.js), the Stable's look a selector
// (ui/holdingsPages.js lookPicker).
//
// THE TYPE SCALE. Pixelify Sans greys out under 12px (FONT3 measured it), and the windows set their reading text at 10
// and 11 while their presses stood at 17 in capitals - the loudest thing on a page was a choice of coat colour. One
// scale, small to large: a label 12, a line 14, a name 16, a head 18 - presses in the line's size, so the words a
// player reads outweigh the buttons beside them.
import { PIXEL_STACK } from './pixelifyFive.js';
import { WINDOW_FRAME } from './enhanced/enhancedFrame.js';   // UI-CALM II: the walk's panels wear a window's frame

export const UI_CALM_STYLE_ID = 'dagger-ui-calm';

/** The scale, in px: a label (a meter's word, a chip), a line (what a page says), a name, a head. */
export const CALM_TYPE = Object.freeze({ label: 12, line: 14, name: 16, head: 18 });
/** The reading colours on the dark ground: the line (bone) and its quieter twin (no darker than 7:1 on #11141a). */
export const CALM_INK = Object.freeze({ line: '#ddd5bd', quiet: '#bdb4a0' });
/** The prefix a colour rule wears: Plus's alone - DFO Grimoire inks every sheet into its own pages' colours
 *  (grimoireDress.js inkCss), and a colour said here for the dark ground would be inked onto the paper. */
export const P = ':root:not([data-plus-dress="grimoire"])';

// ── THE FRONT DOOR: TWO QUESTIONS ────────────────────────────────────────────────────────────────────────────────────
const DOOR_CSS = `
/* UI-CALM: THE FRONT DOOR'S TWO QUESTIONS (ui/enhanced/enhancedMenu.js drawDoors). Under Plus a level's two pages stand in one
   column; the page heads are the book's (DFO Grimoire), so Plus shows only the offline level's - as a caption. A colour
   is Plus's alone (${P}): DFO Grimoire inks the door its own way. */
.px-menu .px-page { display: contents; }
.px-menu .px-pagehead { display: none; }
.px-menu .px-pagenote { display: none; }
.px-menu .door-word { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
.px-menu .door-name { display: block; }
.px-menu .door-sub { display: block; font-size: 14px; line-height: 1.25; letter-spacing: 0.03em; text-indent: 0; text-transform: none; white-space: normal; }
${P} .px-menu .door-sub { color: ${CALM_INK.quiet}; text-shadow: 1px 1px 0 rgba(0,0,0,0.8); }
${P} .px-menu .doorbtn:hover .door-sub, ${P} .px-menu .doorbtn:focus-visible .door-sub { color: ${CALM_INK.line}; }
.px-home .px-menu[data-level="top"] { gap: 14px; width: min(460px, 100%); }
/* Online first, and the first a player's eye takes: its word in the brass at rest (the gold is the pointer's) */
${P} .px-menu .doorbtn.door-online:not(:hover):not(:focus-visible) .door-name { color: #f3cf86; }
.px-menu[data-level="top"] .doorbtn { min-height: 88px; padding-top: 12px; padding-bottom: 12px; font-size: 34px; }
.px-menu[data-level="offline"] .px-page-games .px-pagehead { display: block; margin: 0 0 2px; text-align: center; font: inherit;
  font-size: 15px; letter-spacing: 0.28em; text-indent: 0.28em; text-transform: uppercase; }
.px-menu[data-level="offline"] .px-page-games .px-pagenote { display: block; margin: 0 0 6px; text-align: center; font-size: 14px; letter-spacing: 0.03em; }
${P} .px-menu[data-level="offline"] .px-page-games .px-pagehead { color: #f3cf86; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
${P} .px-menu[data-level="offline"] .px-page-games .px-pagenote { color: ${CALM_INK.quiet}; text-shadow: 1px 1px 0 rgba(0,0,0,0.8); }
/* the way back is a smaller door, set apart - never mistaken for a game */
.px-menu .doorbtn.door-back { margin-top: 10px; min-height: 40px; font-size: 18px; letter-spacing: 0.16em; text-indent: 0.16em; }
.px-menu .doorbtn.door-back .px-c { font-size: 14px; }
/* Settings and Overhauls stand in the foot's box, beside Screenshots and About (appendPxFoot) - four plaques in a row,
   wrapping to two rows before they would run under the doors */
.px-footright { flex-wrap: wrap; justify-content: flex-end; max-width: min(640px, 60vw); }
/* AUDIT UICALM-FIRM1 L3 H1: THE STAGE ENDS WHERE THE FOOT BEGINS (--px-foot-h, measured: appendPxFoot) - its fixed
   reserve (PX8, DOOR-FIT, SUPPORT1) was the one-row foot's, the two-question door's foot is taller, and a door that ran
   on under it took no tap (Settings did). The stage scrolls above the foot instead; unmeasured, the fixed reserve
   stands. A phone's plaques wrap in a row rather than stand four high. */
.px-home:not(.px-over)[style*="--px-foot-h"] > .px-stage:not(.px-acctstage) { height: calc(100% - var(--px-foot-h)); padding-bottom: 12px; }
@media (max-width: 480px), (max-height: 560px) {
  .px-home:not(.px-over) .px-foot { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; }
  .px-home:not(.px-over) .px-footright, .px-home:not(.px-over) .px-footleft { display: contents; }
  .px-home:not(.px-over) .px-foot .px-build { order: 9; flex-basis: 100%; text-align: center; }
}
@media (max-width: 480px) {
  .px-home:not(.px-over) .px-foot .px-about { font-size: 13px; letter-spacing: 0.06em; padding: 6px 10px; }
}
@media (max-width: 480px) {
  .px-menu[data-level="top"] .doorbtn { min-height: 76px; font-size: 26px; }
  .px-menu .door-sub { font-size: 13px; }
}
@media (max-height: 560px) {
  .px-home .px-menu[data-level="top"] { gap: 8px; }
  .px-menu[data-level="top"] .doorbtn { min-height: 64px; padding-top: 6px; padding-bottom: 6px; font-size: 26px; }
}
/* UI-CALM: the rail's first row, the way home - a quiet row with its arrow, set apart from the sections under it */
.rail .railbtn.railhome { margin-bottom: 8px; }
.rail .railbtn.railhome .rk::before { content: '\\2039'; display: inline-block; margin-right: 10px; }
/* the shell's rail: Offline's doors under their word, as on the door */
.rail .railgroup { display: block; margin: 14px 24px 2px; font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; }
/* a phone's rail wraps its rows - the head takes a whole row of its own, never a slot beside a door (AUDIT UICALM-FIRM1
   L3 L4) */
@media (max-width: 860px), (pointer: coarse) { .shell:not(.wizard) .rail .railgroup { flex: 0 0 100%; margin: 8px 12px 0; } }
${P} .rail .railgroup { color: #9c937d; }
`;

// ── THE HUD: THE TEMPERATURE IN THE CORNER ──────────────────────────────────────────────────────────────────────────
const HUD_CSS = `
/* UI-CALM: THE TEMPERATURE PLATE, IN THE CORNER (ui/enhanced/enhancedHud.js) - the caption's first word in the bottom-left block,
   beside the mode's word, in the flow (TEMP-UI hung it off the compass's right end). Comfortable it says the glyph and the
   number and no more, a little quieter; felt or costing, its word and its scale stand too. */
.hud .hud-qcap .hud-temp { position: relative; left: auto; top: auto; right: auto; transform: none; flex: 0 0 auto; }
.hud .hud-temp[data-level="ok"] .hud-tempword, .hud .hud-temp[data-level="ok"] .hud-tempscale { display: none; }
${P} .hud .hud-temp[data-level="ok"] { opacity: 0.85; }
/* UI-CALM: THE VITALS AT REST (ui/enhanced/enhancedHud.js VITALS_REST_S) fade in six steps; back at once on the first change - and
   always standing while the HUD is arranged */
.hud .hud-bars { transition: opacity 120ms steps(2, end); }
.hud .hud-bars.rest:not([data-hm-edit]) { opacity: 0; transition: opacity 1200ms steps(6, end); }
`;

// ── THE WINDOWS: THE QUIET INK AND THE TYPE FLOOR ───────────────────────────────────────────────────────────────────
const WINDOWS_CSS = `
/* UI-CALM: THE QUIET INK one step lighter - every dim word the windows say (--dim, ENHANCED_TOKENS) stood at #9a9486 on the
   slate; Pixelify at 11 and 12 greys out besides (FONT3), so the two together read as fog. */
${P} { --dim: #b9b2a1; }
/* the pause window's six tabs on one row where the window is wide - they wrapped System onto a row of its own; tighter,
   so English's six fit, and a language whose six do not WRAPS (AUDIT UICALM-FIRM1 L4 M6: held to one row, Spanish,
   Russian and five more ran past the window's edges) */
@media (min-width: 901px) {
  ${P} .px-win > .px-tabs { gap: 2px; }
  ${P} .px-win > .px-tabs button { font-size: 17px; letter-spacing: 0.08em; text-indent: 0.08em; padding: 6px 12px; gap: 6px; }
}
/* THE TYPE FLOOR: no word a player must read under 12px - the settings screen's chips, segments, counts and tags, the
   Overhauls cards' labels, the shell's foot, the tutorials' "new" */
.ft-segb { font-size: 13px; }
.opt-filters .chip, .sec-jumpbtn, .ft-tile-more, .kind, .ft-tile-meta .kind { font-size: 12px; }
.subbtn .count, .sec-head .count, .px-setwrap .subbtn .count, .group-head .count { font-size: 12px; }
.row-note { font-size: 13px; line-height: 1.4; }
.look-title, .look-badge, .look-by, .look-colours-label { font-size: 12px; }
.look-note { font-size: 13px; }
.shell .foot { font-size: 12px; }
.px-qtimed.tut-new { font-size: 12px; }
/* the pack: an empty slot's word was #333c47 on the dark - a socket may be quiet, never unreadable (4:1) */
.wornrow.wornempty .wornslot, .pack-shell .wornpair > .wornrow .wornslot { font-size: 12px; }
${P} .wornrow.wornempty .wornslot { color: #7a776d; }
.pack-shell .shelflabel { font-size: 12px; }
`;

// ── CHARACTER CREATION ──────────────────────────────────────────────────────────────────────────────────────────────
// ── THE SETTINGS SCREEN: ONE KIND OF ROW ───────────────────────────────────────────────────────────────────────────
const SETTINGS_CSS = `
/* UI-CALM II: THE SETTINGS SCREEN READS AS ONE LIST. A Features row and a plain row were two looks side by side (a
   boxed plate with a coloured bar, and a bare line); the tags under a name were boxed capitals in three colours. Every
   option is now the same line - its name, what it is in a quiet hand, its control at the right - and the tags say
   where it applies in words ("Enhanced · DFU Classic"). The card beside the list stands clear of the screen's top. */
.opt-tools { padding: 12px 20px 10px; gap: 8px 12px; }
.opt-filters .chip, .opt-tools .act { letter-spacing: 0.03em; }
/* AUDIT UICALM-FIRM1 L3 L3: the floor's words the first pass left at 11px - the Settings screen's All off and Reset, the
   walk's pool heads ("points to spend"), a phone's map names */
.opt-tools .act, .wizard .poolk { font-size: 12px; }
.sec-jump { padding: 6px 20px 14px; gap: 6px; }
.sec-jumpbtn { letter-spacing: 0.03em; text-transform: none; }
.sec-head { padding: 28px 20px 8px; }
.sec-head h3 { letter-spacing: 0.04em; font-size: 14px; }
.ft-tile, .opt-body > .row { padding-left: 20px; padding-right: 20px; }
.ft-tile::before { width: 2px; top: 14px; bottom: 14px; opacity: 0.8; }
.ft-tile-meta { gap: 0 6px; }
.ft-tile-meta .kind, .row .kinds .kind { border: 0; padding: 0; background: none; font-size: 12px; letter-spacing: 0.03em; text-transform: none; }
.ft-tile-meta .kind + .kind::before { content: '\\00b7'; margin-right: 6px; }
${P} .ft-tile-meta .kind, ${P} .row .kinds .kind { color: #a49c86; }
${P} .ft-tile-meta .kind.mod { color: #7fae9f; }
.row.changed .row-name::after, .ft-tile.changed .ft-tile-name::after { letter-spacing: 0.04em; text-transform: none; }
@media (min-width: 861px) {
  .panes.opt > .detail { padding-top: 16px; box-sizing: border-box; }
}
`;

const CHARGEN_CSS = `
/* UI-CALM: THE CLASS LIST IN ITS THREE WAYS, each under its head across the list's columns, a row its name and the two
   attributes it leans on; the card beside it the class's profile (ui/enhanced/enhancedChargen.js classStage) */
.wizard .classlist .classway { grid-column: 1 / -1; margin: 14px 0 4px; padding: 0 0 4px 2px; font-size: 13px; letter-spacing: 0.22em;
  text-transform: uppercase; border-bottom: 1px solid transparent; }
.wizard .classlist .classway:first-child { margin-top: 2px; }
${P} .wizard .classlist .classway { color: #f3cf86; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); border-bottom-color: rgba(192,138,62,0.45); }
.wizard .classlist .row-sub { font-size: 13px; }
.wizard .dcard .cprof-way { margin: -4px 0 10px; font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase; }
${P} .wizard .dcard .cprof-way { color: #f3cf86; }
.wizard .cprofile { display: flex; flex-direction: column; gap: 8px; margin: 0 0 12px; }
/* one grid for the eight rows, so every bar starts where the longest word ends ("Intelligence" pushed its own bar right
   of the seven others' when each row was its own grid) */
.wizard .cprof-attrs { display: grid; grid-template-columns: max-content minmax(40px, 1fr) 2.4em; align-items: center; gap: 4px 10px; }
.wizard .cprof-attr { display: contents; font-size: 13px; }
.wizard .cprof-name { white-space: nowrap; }
.wizard .cprof-bar { position: relative; height: 8px; box-sizing: border-box; border: 1px solid transparent; }
.wizard .cprof-fill { position: absolute; left: 0; top: 0; bottom: 0; }
.wizard .cprof-v { text-align: right; font-variant-numeric: tabular-nums; }
.wizard .cprof-skills { display: grid; grid-template-columns: 5.6em minmax(0, 1fr); gap: 10px; margin: 0; font-size: 13px; line-height: 1.4; }
.wizard .cprof-label { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; }
${P} .wizard .cprof-name, ${P} .wizard .cprof-label { color: #bdb4a0; }
${P} .wizard .cprof-v, ${P} .wizard .cprof-skills { color: #ddd5bd; }
/* a bar's colours are Plus's, as every colour here (AUDIT UICALM-FIRM1 L5 L3: they stood for both dresses - the
   Grimoire inks its own, grimoireDress.js) */
${P} .wizard .cprof-bar { border-color: #050608; background: rgba(5,6,8,0.6); box-shadow: 0 0 0 1px #5a5446; }
${P} .wizard .cprof-fill { background: #c08a3e; }
/* a phone keeps the card to the class's name and its door: the list is what it must scroll (chargenPhoneProbe) */
@media (max-width: 860px), (max-height: 500px) { .wizard .cprofile { display: none; } }
/* every stage's way on stands at the action bar's far end, Back at its near one - the eye ends on it */
.wizard .actionbar .act.primary { margin-left: auto; min-width: 180px; }
/* ...and on a phone it keeps the screen: no floor under it, and a bar of three that does not fit wraps, the way on to
   the far end of its own row (AUDIT UICALM-FIRM1 L3 M4: Back, Start over and Begin your life ran past a 360px screen) */
@media (max-width: 860px) {
  .wizard .actionbar { flex-wrap: wrap; }
  .wizard .actionbar .act.primary { min-width: 0; }
}

/* UI-CALM II (2026-10-14, a player: "it looks in general cheap - letters overlapping, dotted lines everywhere, the
   highlighting of words is bad, the summary board looks cut off ... massively polish all this"). THE WALK'S PAGE: what a
   stage says stands in one measured column, its card beside it at the column's top - never a list stretched across
   the whole screen with its numbers at the far edge, and never three grounds (the rail's, the list's, the card's
   column) meeting at hard edges. A desk's layout; a phone keeps its own (enhancedStyle.js, max-width 860px). */
@media (min-width: 861px) {
  .wizard .stagebody { grid-template-columns: minmax(0, 760px) minmax(330px, 400px); justify-content: center;
    gap: 28px; padding: 26px 32px 18px; box-sizing: border-box; }
  .wizard .stagebody.mapstage { grid-template-columns: minmax(0, 1fr) minmax(330px, 400px); }
  .wizard .stagebody.solo { grid-template-columns: minmax(0, 1fr); padding: 0; }
  .wizard .stagebody > .detail { background: none !important; border: 0 !important; box-shadow: none !important; display: flex; flex-direction: column;
    min-height: 0; overflow: visible; }
  /* ONE SCROLL: the stage scrolls when what it holds is taller than the screen, never a panel inside it - a list sized
     to its rows rounded a pixel over its own box and drew a bar beside eight rows that fit */
  .wizard .stagebody:not(.solo) { overflow-y: auto; overflow-x: hidden; }
  .wizard .stagebody > .list { align-self: start; max-height: none; overflow: visible; }
  /* the skills' three groups: one panel the width of what it holds, not three columns at the screen's far edges */
  .wizard .stagebody.solo { overflow-y: auto; overflow-x: hidden; }
  .wizard .stagebody.solo > .skillpane { max-width: 1040px; margin: 26px auto 18px; box-sizing: border-box; align-self: start; max-height: none; overflow: visible; }
  .wizard .stagebody > .detail > .dcard:not(.confirm) { max-height: none; overflow: visible; }
}
/* a small desk (the rail takes a quarter of it): the column and its card as close as they always stood, and the map
   over its prompt, so the map keeps the width */
@media (min-width: 861px) and (max-width: 1179px) {
  .wizard .stagebody { grid-template-columns: minmax(0, 1fr) minmax(270px, 320px); gap: 14px; padding: 14px 14px 10px; }
  .wizard .stagebody.solo { padding: 0; }
}
@media (min-width: 861px) and (max-width: 1179px) and (min-height: 600px) {
  .wizard .stagebody.mapstage { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
  .wizard .stagebody.mapstage > .detail { max-height: 42vh; }
  .wizard .stagebody.mapstage > .detail .dcard:not(.confirm) { max-width: 560px; margin: 0 auto; }
}
/* the card is as tall as what it says, and never taller than the stage: a long description scrolls INSIDE it while
   its presses stand under it ("Play as ..." was below the card's foot) */
.wizard .dcard { box-sizing: border-box; max-height: 100%; overflow-y: auto; }
.wizard .dcard.confirm { display: flex; flex-direction: column; overflow: hidden; }
.wizard .dcard.confirm .dscroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding-right: 4px; }
.wizard .dcard.confirm .acts { flex: none; margin-top: 12px; }
/* ...and on a phone the sheet it rides in is a column that bounds it, so its words scroll and its presses stand on the
   screen (AUDIT UICALM-FIRM1 L3 M7: the sheet grew to the card and "Play as" stood a screen below) */
@media (max-width: 860px) {
  .wizard .stagebody > .detail.wizsheet:has(> .dcard.confirm) { display: flex; flex-direction: column; overflow: hidden; }
  .wizard .stagebody > .detail.wizsheet > .sheet-close { flex: none; }
  .wizard .stagebody > .detail.wizsheet > .dcard.confirm { flex: 1 1 auto; min-height: 0; max-height: none; }
}
.wizard .dcard .acts { display: flex; flex-wrap: wrap; gap: 8px; }

/* THE MAP: its own aspect, as large as the stage lets it be, the names laid over it as small plates (enhancedChargen.js
   mapPane - pixel-sized, so crisp in either dress, and moved off one another by untangleLabels) */
.wizard .mappane { container-type: size; padding: 0; min-height: 0; height: 100%; }
.wizard .mapbox { position: relative; width: min(100cqw, 160cqh); aspect-ratio: 320 / 200; margin: auto; }
.wizard .mapbox .map { position: absolute; inset: 0; width: 100%; height: 100%; }
.wizard .maplabels { position: absolute; inset: 0; pointer-events: none; }
.wizard .maplabel { position: absolute; translate: -50% -50%; pointer-events: auto; white-space: nowrap; margin: 0;
  padding: 3px 9px; min-height: 0; line-height: 1.15; font-size: 13px; letter-spacing: 0.03em; text-transform: none;
  border-radius: 0; cursor: pointer; transition: none; }
.wizard .maplabel.inert { pointer-events: none; cursor: default; padding: 0 4px; font-size: 12px; font-style: italic; }
.wizard .provlabel { display: none; }
${P} .wizard .prov { fill: #1b222b; stroke: #4a5563; stroke-width: 0.7; }
${P} .wizard .prov.hot:not(.inert), ${P} .wizard .prov:not(.inert):hover { fill: #29323e; stroke: #b9b2a1; }
${P} .wizard .prov.on { fill: rgba(192,138,62,0.34); stroke: #e0b062; stroke-width: 1; }
${P} .wizard .prov.inert { fill: #12161c; stroke: #2a313b; }
${P} .wizard .maplabel { background: rgba(10,12,16,0.86); color: #ddd5bd; border: 1px solid rgba(125,116,96,0.5); text-shadow: none;
  box-shadow: 0 2px 0 rgba(0,0,0,0.45); }
${P} .wizard .maplabel.hot, ${P} .wizard .maplabel:hover, ${P} .wizard .maplabel:focus-visible { color: #fff6dc; border-color: #e0b062; outline: none; }
${P} .wizard .maplabel.on { background: #e0b062; color: #16110a; border-color: #f3cf86; }
${P} .wizard .maplabel.inert { background: none; border: 0; box-shadow: none; color: #77715f; }

/* A STAGE THAT IS ONLY ITS QUESTION: the question, and its answers as cards one can see are pressable - a word with a
   rule under it read as a link, and the chosen one was told from the other by an underline */
.wizard .choose { gap: 30px; }
.wizard .choose h2 { text-transform: none; letter-spacing: 0.04em; text-indent: 0; font-size: 28px; }
.wizard .bigchoice { grid-template-columns: repeat(2, minmax(220px, 300px)); gap: 16px; justify-content: center; }
.wizard .bigchoice.tall { grid-template-columns: repeat(2, minmax(240px, 320px)); }
.wizard .bigchoice .bigbtn { min-height: 120px; padding: 22px 24px; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 8px; text-align: center; text-transform: none; letter-spacing: 0.04em; font-size: 22px;
  text-decoration: none; }
.wizard .bigchoice .bigbtn .bigk { font-size: 20px; letter-spacing: 0.03em; }
.wizard .bigchoice .bigbtn .bign { font-size: 14px; line-height: 1.35; margin: 0; letter-spacing: 0.01em; }
${P} .wizard .bigchoice .bigbtn { background: rgba(12,15,20,0.78); border: 2px solid rgba(125,116,96,0.45); color: #ddd5bd; text-shadow: 1px 1px 0 rgba(0,0,0,0.7); }
${P} .wizard .bigchoice .bigbtn .bigk { color: #ece5d2; }
${P} .wizard .bigchoice .bigbtn .bign { color: #b9b2a1; text-shadow: none; }
${P} .wizard .bigchoice .bigbtn:hover, ${P} .wizard .bigchoice .bigbtn:focus-visible { background: rgba(28,24,17,0.86); border-color: #c08a3e; color: #fff3cf; outline: none; }
${P} .wizard .bigchoice .bigbtn.on { border-color: #e0b062; box-shadow: inset 0 0 0 2px rgba(224,176,98,0.35); color: #f3cf86; }
.wizard .choose .acts { display: flex; justify-content: center; gap: 10px; }
.wizard .namebox { text-align: center; }
@media (max-width: 860px) {
  .wizard .maplabel { font-size: 12px; padding: 2px 5px; }
  .wizard .bigchoice, .wizard .bigchoice.tall { grid-template-columns: minmax(0, 1fr); }
  .wizard .bigchoice .bigbtn { min-height: 84px; }
}

/* PROSE AND HEADS: Plus's two-pixel drop shadow under every word read as print run off a stencil - one pixel, and none
   under a card's prose (its ground is dark enough) */
${P} .wizard .choose h2 { text-shadow: 1px 2px 0 rgba(0,0,0,0.75); }
${P} .wizard .dcard p, ${P} .wizard .dcard .attrhelp p { text-shadow: none; color: #cfc7b0; }
${P} .wizard .dcard { background: rgba(10,12,16,0.82); }
/* THE PANELS ARE WINDOWS: the list, the skills' page and the card beside them wear the windows' own carved frame and
   ground (enhancedFrame.js WINDOW_FRAME) - not a hairline round a tinted box set down on the sky */
${P} .wizard .stagebody > .list, ${P} .wizard .stagebody.solo > .skillpane, ${P} .wizard .stagebody > .detail > .dcard {
  border: 2px solid transparent; border-image: ${WINDOW_FRAME.image}; background: ${WINDOW_FRAME.ground}; box-shadow: ${WINDOW_FRAME.shadow};
  padding: 10px 12px; box-sizing: border-box; }
${P} .wizard .stagebody > .detail > .dcard { padding: 20px 22px 22px; }
/* the chosen row: a lit bar at its edge and a warmer ground - not a box drawn round the row and its presses */
.wizard .list .row.on, .wizard .skillpane .row.on { outline: none; }
${P} .wizard .list .row.on, ${P} .wizard .skillpane .row.on { background: linear-gradient(90deg, rgba(224,176,98,0.18), rgba(224,176,98,0.03) 70%); box-shadow: inset 3px 0 0 #e0b062; }
${P} .wizard .list .row.on .row-name, ${P} .wizard .skillpane .row.on .row-name { color: #fff3cf; }
/* a way on that waits ("18 left to spend") is read, not hidden: it says what is left */
${P} .wizard .act.primary[disabled] { opacity: 1; color: #bdb4a0; }   /* AUDIT UICALM-FIRM1 L3 M5: an ink of its own - the opacity alone over the shell's disabled grey read at 1.46:1 */
/* a scroll that is needed is a thin one in the frame's own colours - a ::-webkit-scrollbar one (CURSOR-EDGE: the
   standard pair only where that is not, or Chromium draws the native one and its OS arrow) */
@media (any-pointer: fine) {
${P} .wizard::-webkit-scrollbar, ${P} .wizard ::-webkit-scrollbar { width: 6px; height: 6px; } }
${P} .wizard::-webkit-scrollbar-track, ${P} .wizard ::-webkit-scrollbar-track { background: transparent; }
${P} .wizard::-webkit-scrollbar-thumb, ${P} .wizard ::-webkit-scrollbar-thumb { background: #6b6350; border: 0; }
@supports not selector(::-webkit-scrollbar) {
${P} .wizard, ${P} .wizard * { scrollbar-width: thin; scrollbar-color: #6b6350 transparent; } }
/* the card's figures read as words: "Carry weight", not a spaced capital whisper */
.wizard .dcard .stats dt { font-size: 13px; letter-spacing: 0.02em; text-transform: none; }
${P} .wizard .dcard .stats dt { color: #bdb4a0; }
${P} .wizard .row-name { text-shadow: 1px 1px 0 rgba(0,0,0,0.7); }
`;

/** The whole sheet. */
export const UI_CALM_CSS = `/* UI-CALM (ui/uiCalmStyle.js) - laid after Enhanced Plus's sheet */
${DOOR_CSS}
${HUD_CSS}
${WINDOWS_CSS}
${SETTINGS_CSS}
${CHARGEN_CSS}`;

/** Lay the sheet on a page, after whatever enhanced sheet is there (idempotent). Plus only: the caller asks. */
export function injectUiCalmStyle(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById(UI_CALM_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = UI_CALM_STYLE_ID;
  st.textContent = UI_CALM_CSS;
  doc.head.append(st);
}

/** The stack a calm rule that sets its own face names (the kit's, so a sheet injected alone still has it). */
export const CALM_STACK = PIXEL_STACK;
