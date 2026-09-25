// PORT5: the ported windows' and the enhanced list's own layout
// (ui/enhancedPort.js, ui/enhancedPicker.js). A leaf module: the sheet
// appends it, and the stone-and-brass kit (ui/enhancedFrame.js) dresses
// its frames, buttons, tiles and wells by role like every other screen.
import { PIXEL_STACK } from './pixelifyFive.js';

export const PORT_CSS = `
/* ── PORT5: THE PORTED WINDOWS ─────────────────────────────────────── */
.port-host { position: fixed; inset: 0; z-index: 13; font-family: ${PIXEL_STACK};
  -webkit-font-smoothing: none; font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0; color: #d8cfae; }
.port-shell { display: flex; align-items: center; justify-content: center; padding: 24px; }
.port-win.px-win { width: min(640px, 94vw); height: auto; max-height: min(92dvh, 780px); display: flex; flex-direction: column; }
.port-win.size-narrow { width: min(420px, 94vw); }
.port-win.size-wide { width: min(1000px, 96vw); }
.port-inner { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.port-head { padding: 12px 18px 10px; text-align: center; border-bottom: 2px solid rgba(125,116,96,0.55); }
.port-title { margin: 0; font: inherit; font-size: 20px; letter-spacing: 0.18em; text-indent: 0.18em; text-transform: uppercase;
  color: #efe8d6; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.port-sub { display: block; margin-top: 4px; font-size: 13px; letter-spacing: 0.1em; color: #8f8670; }
.port-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
.port-foot { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; padding: 12px 18px 14px;
  border-top: 2px solid rgba(125,116,96,0.55); }

.port-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 104px; min-height: 40px;
  padding: 6px 16px; border: 2px solid rgba(125,116,96,0.55); font: inherit; font-size: 15px; letter-spacing: 0.14em;
  text-indent: 0.14em; text-transform: uppercase; color: #d8cfae; cursor: pointer; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.port-btn:hover, .port-btn.primary, .port-btn.on { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.port-btn:disabled { color: #5e5848; text-shadow: none; cursor: default; }
.port-actions { display: flex; gap: 8px; }
.port-actions.column { flex-direction: column; }
.port-actions.column .port-btn { width: 100%; }
.port-actions.row { justify-content: center; flex-wrap: wrap; }

.port-stats { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 4px 20px; }
.port-stat { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 5px 2px;
  border-bottom: 2px solid rgba(125,116,96,0.3); }
.port-stat dt { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #8f8670; }
.port-stat dd { margin: 0; font-size: 16px; color: #efe8d6; font-variant-numeric: tabular-nums; }
.port-stat.warn dd { color: #e0584a; }
.port-heading { margin: 0 0 8px; font: inherit; font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase; color: #a89f88; }

.port-cols { display: grid; grid-template-columns: var(--port-cols); gap: 18px; align-items: start; }
.port-col, .port-group { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.port-group.port-card { padding: 12px; border: 2px solid rgba(125,116,96,0.55); }

.port-tiles { display: grid; grid-template-columns: repeat(auto-fill, 58px); gap: 6px; overflow-y: auto; padding: 4px; }
.port-tiles.list { grid-template-columns: 1fr; }
.port-tile { position: relative; width: 58px; height: 58px; display: flex; align-items: center; justify-content: center;
  padding: 0; border: 2px solid rgba(125,116,96,0.45); background: rgba(10,12,17,0.6); font: inherit; color: #c5bda2; cursor: pointer; }
.port-tiles.list .port-tile { width: auto; height: auto; min-height: 54px; justify-content: flex-start; gap: 10px; padding: 4px 12px 4px 4px; }
.port-tile.off { opacity: 0.45; cursor: default; }
.port-pic { width: 42px; height: 42px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; font-size: 14px; }
.port-pic img { max-width: 100%; max-height: 100%; image-rendering: pixelated; }
.port-badge { position: absolute; right: 3px; bottom: 1px; font-size: 11px; color: #e2b064; text-shadow: 1px 1px 0 #050608; }
.port-tilewords { display: flex; flex-direction: column; text-align: left; gap: 2px; }
.port-tilename { font-size: 15px; }
.port-tilesub { font-size: 12px; color: #8f8670; }

.port-rows { display: flex; flex-direction: column; overflow-y: auto; }
.port-row { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 38px; padding: 4px 10px; border: 0;
  border-bottom: 2px solid rgba(125,116,96,0.25); background: none; font: inherit; font-size: 15px; color: #d8cfae; text-align: left;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
button.port-row { cursor: pointer; }
.port-rowmark { font-size: 11px; color: rgb(243,239,44); visibility: hidden; }
button.port-row:hover, .port-row.on { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
button.port-row:hover .port-rowmark, .port-row.on .port-rowmark { visibility: visible; }
.port-row.muted { color: #7d7460; }
.port-rowwords { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.port-rowsub { font-size: 12px; color: #8f8670; text-shadow: none; }
.port-rowvalue { margin-left: auto; }
.port-empty { margin: 6px 4px; font-size: 14px; color: #7d7460; grid-column: 1 / -1; }

.port-fieldrow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.port-fieldlabel { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #8f8670; }
.port-field { flex: 1; min-width: 150px; min-height: 38px; display: flex; align-items: center; padding: 4px 10px;
  border: 2px solid rgba(125,116,96,0.55); font-size: 17px; color: #efe8d6; }
.port-fieldvalue:empty::before { content: attr(data-empty); }
.port-caret { color: rgb(243,239,44); animation: port-caret 1s steps(1, end) infinite; }
@keyframes port-caret { 50% { opacity: 0; } }

.port-chiprow { display: flex; flex-direction: column; gap: 6px; }
.port-chiplabel { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #8f8670; }
.port-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.port-btn.port-chip { min-width: 0; min-height: 34px; padding: 4px 10px; font-size: 13px; letter-spacing: 0.06em; text-indent: 0; text-transform: none; }

.port-group.port-spins { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px 16px; }
.port-group.port-spins > .port-heading { grid-column: 1 / -1; margin-bottom: 0; }
.port-spin { display: grid; grid-template-columns: minmax(0, 1fr) 36px 52px 36px; align-items: center; gap: 6px; }
.port-spin.off { opacity: 0.4; }
.port-spinlabel { font-size: 13px; color: #a89f88; }
.port-btn.port-spinbtn { min-width: 36px; min-height: 32px; padding: 0; text-indent: 0; letter-spacing: 0; font-size: 18px; }
.port-spinvalue { text-align: center; font-size: 17px; font-variant-numeric: tabular-nums; color: #efe8d6; }

.port-screen { display: flex; justify-content: center; }
.port-canvas { width: min(640px, 100%); aspect-ratio: 320 / 200; image-rendering: pixelated; background: #000;
  border: 2px solid rgba(125,116,96,0.55); }
.port-text p { margin: 0; font-size: 17px; line-height: 1.5; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.port-text.center { text-align: center; }
.port-picture { display: flex; justify-content: center; }
.port-picture img { width: 48px; height: 48px; image-rendering: pixelated; border: 2px solid rgba(125,116,96,0.55); }
.port-pictureword { min-width: 48px; min-height: 48px; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(125,116,96,0.55); }
.port-icongrid { display: grid; grid-template-columns: repeat(auto-fill, 46px); gap: 6px; max-height: 56dvh; overflow-y: auto; padding: 4px; }
.port-iconcell { width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; padding: 0;
  border: 2px solid rgba(125,116,96,0.45); background: rgba(10,12,17,0.6); cursor: pointer; font: inherit; color: #8f8670; }
.port-iconcell img { width: 32px; height: 32px; image-rendering: pixelated; }
@media (max-width: 760px) { .port-cols { grid-template-columns: 1fr; } }

/* ── PORT5: THE ENHANCED LIST ───────────────────────────────────── */
.pick-shell .pick-win.px-win { width: min(460px, 92vw); max-height: min(80dvh, 640px); display: flex; flex-direction: column; }
.pick-list { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 6px; display: flex; flex-direction: column; }
.pick-row { display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 4px 12px; border: 0; background: none;
  font: inherit; font-size: 16px; color: #d8cfae; text-align: left; cursor: pointer; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.pick-mark { font-size: 11px; color: rgb(243,239,44); visibility: hidden; }
.pick-row:hover, .pick-row.on { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.pick-row:hover .pick-mark, .pick-row.on .pick-mark { visibility: visible; }
.pick-num { margin-left: auto; font-size: 11px; color: #7d7460; text-shadow: none; }
`;
