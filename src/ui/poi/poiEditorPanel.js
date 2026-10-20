// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-3 (2026-10-14) - THE EDITOR'S PANEL: EVERYTHING A BUILDER READS AND PRESSES.
//
// Mac: "a tool my developers can use without having to access the codebase ... the best it can be" (bible/06-Systems/
// POI-Editor-Arc.md POI-3). The editor's screen over the world (scenes/poiEditorHost.js draws the handles in it):
//
//   - THE BAR (top): the tools (select, move, turn, size - Q W E R), the space (world or the thing's own - X), snap and
//     its steps, undo and redo with what they would undo, the eye's speed, a new POI, an import, the map, and the way
//     out (back to where the body stands, or down to the ground under the eye).
//   - THE OUTLINER (left): the POIs being edited - each its state (new, a draft, sent for approval, live, changed) and
//     its parts and lights to select - and every POI the store holds, searched, to open.
//   - THE INSPECTOR (right): the selection's every field, each change one step of the undo: a POI's name, words, tags,
//     place (its height above the ground or fixed, its turn as Unity's three angles, its size), its mark on the map and
//     its lights; a part's name, offset, turn, size, solidity, shadow and materials. Then what is wrong with it - the
//     law's every problem in the builder's language, each said where it is (poi/poiText.js) - and the store's acts:
//     save the draft, send it for approval, take it back, ask for a live POI's retirement, put back what was saved.
//   - THE IMPORT (a dialog): a .glb, or a .gltf with its files; its parts, what was left out and why, what is past a
//     limit; uploaded once each by name (poi/poiImport.js) and placed where the next click is - and kept in the library
//     too, unless the builder says not (POI-4b).
//   - THE LIBRARY (POI-4b, ui/poi/poiLibraryPanel.js): the bar's Library - every model the builders keep, to place again; a
//     POI or a part kept in it from its inspector.
//   - APPROVALS AND HISTORY (POI-6, ui/poi/poiReviewPanel.js): an approver's queue - what each submission changes, the
//     law's report, before and after where it stands, approve or send back with a word; a POI's every revision, to open
//     again or (an approver) put back in the world.
//   - OUT AND BACK IN (POI-6, poi/poiTransfer.js): a POI's model - or a library entry's - written as a .glb for the
//     builder's own modelling tool; the POIs open in the editor written as a PACK (a .zip with every asset they name),
//     and a pack read back - checked whole, its assets uploaded, its POIs opened as changes to what the store holds.
//
// A REFUSAL IS A SENTENCE: the store's word through the account client's own table (accountRefusalText); a problem
// through the law's. TEXT, NEVER MARKUP: every name a builder typed is written with `textContent`. The panel takes no
// press it does not use - everything else falls through to the editor's world - and its fields keep the keyboard
// while they have it (the editor's keys are not heard while one is focused: ui/input.js isTextEntryTarget).
//
// Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import { t } from '../../systems/textManager.js';   // L10N4: the words through the text core
import { accountRefusalText } from '../../net/accountClient.js';
import { isTextEntryTarget } from '../input.js';   // AUDIT POI U1: a dock held while a field in it is typed in, and then alone
import { poiDocProblems, poiAssetProblems, POI_LIMITS, POI_ALPHA, POI_WRAP, POI_FILTER } from '../../poi/poiLaw.js';
import { eulerOfQuat, quatOfEuler, lawName, newLight } from '../../poi/poiEdit.js';
import { problemText, problemWhere, gltfErrorText, gltfWarningText, meshErrorText, imageErrorText, packErrorText } from '../../poi/poiText.js';
import { poiSaveDraft, poiSubmit, poiWithdraw, poiRetire, poiList, poiHistory, poiPutAsset, poiShelve, poiShelfEntry } from '../../poi/poiService.js';
import { decodePoiMesh, encodePoiMesh, poiMeshFacts } from '../../poi/poiMesh.js';
import { createPoiUvPanel } from './poiUvPanel.js';   // POI-5: the UV editor
import { createPoiLibrary } from './poiLibraryPanel.js';   // POI-4b: the library's shelf
import { createPoiReview } from './poiReviewPanel.js';   // POI-6: the approver's queue, a POI's history
import { exportModel, exportPack, importPack, fileNameOf } from '../../poi/poiTransfer.js';   // POI-6: out and back in
import { readPackBytes } from '../../poi/poiPack.js';
import { poiImageMetaOf } from '../../poi/poiImage.js';
import { readGltf, bakeGltf } from '../../poi/gltfImport.js';
import { prepareImport, uploadImport } from '../../poi/poiImport.js';

export const POI_PANEL_STYLE_ID = 'dfpoi-style';
export const POI_PANEL_CSS = `
/* AUDIT POI (the lead's): 39, under the asset picker's 40 (scenes/dataSource.js ASSET_PICKER_Z; test/scenes/mwattach.test.js MWFIX 1 - nothing at or above it) */
.dfpoi { position: fixed; inset: 0; pointer-events: none; z-index: 39; font: 12px/1.35 system-ui, sans-serif; color: #e9e4d9; }
.dfpoi * { box-sizing: border-box; }
.dfpoi-dock { pointer-events: auto; position: absolute; background: rgba(14, 16, 19, .93); border: 1px solid #6b5230; border-radius: 6px; overflow: auto; }
.dfpoi-bar { top: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; align-items: center; padding: 4px 6px; flex-wrap: wrap; max-width: calc(100vw - 16px); }
.dfpoi-left { top: 56px; left: 8px; width: 250px; bottom: 40px; padding: 6px; }
.dfpoi-right { top: 56px; right: 8px; width: 300px; bottom: 40px; padding: 6px; }
.dfpoi-status { bottom: 8px; left: 50%; transform: translateX(-50%); padding: 4px 10px; max-width: calc(100vw - 16px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dfpoi-status[data-kind="bad"] { border-color: #b4483c; color: #f2b7ae; }
.dfpoi-btn { font: inherit; color: inherit; background: #2a2620; border: 1px solid #6b5230; border-radius: 4px; padding: 3px 7px; cursor: pointer; }
.dfpoi-btn:hover { background: #3a332a; }
.dfpoi-btn[aria-pressed="true"] { background: #6b5230; color: #fff; }
.dfpoi-btn:disabled { opacity: .45; cursor: default; }
.dfpoi-sep { width: 1px; align-self: stretch; background: #6b5230; margin: 0 3px; }
.dfpoi-h { font-weight: 600; margin: 8px 0 4px; color: #d8b77a; }
.dfpoi-row { display: flex; gap: 4px; align-items: center; margin: 2px 0; }
.dfpoi-row > label { flex: 0 0 82px; color: #b9b2a3; }
.dfpoi-row > .dfpoi-grow { flex: 1 1 auto; min-width: 0; }
.dfpoi input, .dfpoi select, .dfpoi textarea { font: inherit; color: inherit; background: #1d1b18; border: 1px solid #4b3c27; border-radius: 3px; padding: 2px 4px; min-width: 0; }
.dfpoi input[type="number"] { width: 64px; }
.dfpoi textarea { width: 100%; min-height: 48px; resize: vertical; }
.dfpoi-item { padding: 2px 4px; border-radius: 3px; cursor: pointer; display: flex; gap: 6px; align-items: baseline; }
.dfpoi-item:hover { background: #2a2620; }
.dfpoi-item[aria-selected="true"] { background: #4b3c27; }
.dfpoi-item .dfpoi-chip { margin-left: auto; font-size: 11px; color: #b9b2a3; }
.dfpoi-sub { padding-left: 14px; }
.dfpoi-problem { color: #f2b7ae; cursor: pointer; margin: 2px 0; }
.dfpoi-problem .dfpoi-where { color: #d8b77a; }
.dfpoi-ok { color: #a9d39a; }
.dfpoi-dialog { pointer-events: auto; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(520px, calc(100vw - 16px)); max-height: calc(100vh - 32px); overflow: auto; padding: 10px; background: rgba(14, 16, 19, .97); border: 1px solid #6b5230; border-radius: 6px; }
.dfpoi-warn { color: #e8cf8a; margin: 2px 0; }
.dfpoi-review { padding: 6px 4px; border-bottom: 1px solid #3a2f20; }
.dfpoi[data-on="0"] .dfpoi-dock, .dfpoi[data-on="0"] .dfpoi-dialog, .dfpoi[data-on="0"] .dfpoi-uv { display: none; }
.dfpoi-launch { pointer-events: auto; position: absolute; left: 8px; bottom: 8px; display: none; }
.dfpoi[data-on="0"] .dfpoi-launch { display: block; }
`;

/** The sheet, once. */
export function injectPoiPanelStyle(doc = document) {
  if (doc.getElementById?.(POI_PANEL_STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = POI_PANEL_STYLE_ID;
  el.textContent = POI_PANEL_CSS;
  (doc.head ?? doc.body).append(el);
}

/** A step's label (poiEdit.js labels) as the undo button says it. @param {string | null} label */
export function stepText(label) {
  switch (label) {
    case 'create': return t('poi.editor.step.create', 'new POI');
    case 'remove': return t('poi.editor.step.remove', 'remove POI');
    case 'move': return t('poi.editor.step.move', 'move');
    case 'turn': return t('poi.editor.step.turn', 'turn');
    case 'size': return t('poi.editor.step.size', 'size');
    case 'add part': case 'add parts': return t('poi.editor.step.addPart', 'add part');
    case 'remove part': return t('poi.editor.step.removePart', 'remove part');
    case 'duplicate': return t('poi.editor.step.duplicate', 'duplicate');
    case 'revert': return t('poi.editor.step.revert', 'put back as saved');
    case 'light': return t('poi.editor.step.light', 'light');
    case 'material': return t('poi.editor.step.material', 'material');
    case 'uv': return t('poi.editor.step.uv', 'UVs');
    default: return t('poi.editor.step.edit', 'edit');
  }
}
/** A POI's state in the outliner. @param {any} entry poiEdit.js's @param {boolean} dirty */
export function stateText(entry, dirty) {
  const base = entry.state === 'new' ? t('poi.editor.state.new', 'new')
    : entry.state === 'draft' ? t('poi.editor.state.draft', 'draft')
      : entry.state === 'submitted' ? t('poi.editor.state.submitted', 'sent for approval')
        : entry.state === 'live' ? t('poi.editor.state.live', 'live')
          : entry.state === 'rejected' ? t('poi.editor.state.rejected', 'sent back')
            : String(entry.state);
  return dirty && entry.state !== 'new' ? t('poi.editor.state.changed', '{state}, changed', { state: base }) : base;
}

/**
 * The facts the law's asset check reads, by sha256 (`{ kind: 'mesh', submeshes }` / `{ kind: 'texture', w, h }`, null
 * for one the store does not have) - known from an import's upload, else fetched and read once. Undefined while a
 * fetch is out: a problem is never said about an asset not yet heard of.
 * @param {(sha: string) => Promise<Uint8Array>} fetchAsset
 */
export function createAssetFacts(fetchAsset, onLearned = () => {}) {
  const facts = new Map();
  return {
    put(sha, meta) { facts.set(sha, meta); },
    /** The fact, or undefined while it is being learnt. */
    of(sha) {
      if (facts.has(sha)) return facts.get(sha);
      facts.set(sha, undefined);
      fetchAsset(sha).then((bytes) => {
        // AUDIT POI (the lead's; lane A's S6): the facts the store's law reads, its budgets' too - a model's counts, box
        // and bytes, a picture's size and bytes - so the editor says a POI is over a budget before the store refuses it
        const m = decodePoiMesh(bytes);
        if (!('error' in m)) facts.set(sha, { kind: 'mesh', ...poiMeshFacts(m.mesh), bytes: bytes.byteLength });
        else { const im = poiImageMetaOf(bytes); facts.set(sha, 'error' in im ? null : { kind: 'texture', w: im.w, h: im.h, bytes: bytes.byteLength }); }
        onLearned();
      }, (e) => {
        // a 404 is an asset the store does not have; anything else (offline) is not known - asked again next time
        if (/: 404$/.test(String(e?.message ?? ''))) { facts.set(sha, null); onLearned(); } else facts.delete(sha);
      });
      return undefined;
    },
    known: (sha) => facts.get(sha) !== undefined,
  };
}

/**
 * @param {{
 *   doc?: Document, edit: any, editor: any, feed: any,
 *   io: () => (import('../../poi/poiService.js').PoiIo | null), me: { handle: string | null, builder: boolean, approver: boolean },
 *   onExit: (how: 'back' | 'here') => void, onEnter?: () => void, onJump?: () => void, readFile?: (f: any) => Promise<Uint8Array>,
 *   decodeImage?: ((bytes: Uint8Array) => Promise<{ width: number, height: number, data: Uint8Array | Uint8ClampedArray }>) | null,
 *   rand?: (b: Uint8Array) => Uint8Array, goTo?: (place: any) => void, download?: (name: string, bytes: Uint8Array, type: string) => void,
 * }} deps `onEnter` the launcher's press (the editor opened again after an exit); `decodeImage` a picture decoded (the UV
 *   editor draws the material's under its UVs, the library a model's picture - poi/poiImageDecode.js); `rand` fills bytes
 *   (a library entry's id); `goTo` takes the eye to a document's place (the approver's look); `download` hands the
 *   builder a file
 */
export function createPoiEditorPanel({ doc = document, edit, editor, feed, io, me, onExit, onEnter = () => {}, onJump = () => {}, readFile = async (f) => new Uint8Array(await f.arrayBuffer()), decodeImage = null, rand = (b) => { globalThis.crypto.getRandomValues(/** @type {any} */ (b)); return b; }, goTo = () => {}, download = downloadIn(doc) }) {
  injectPoiPanelStyle(doc);
  const el = (tag, cls = '', text = null) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const btn = (text, onClick, cls = 'dfpoi-btn') => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', (e) => { e.stopPropagation?.(); onClick(); }); return b; };
  const swallow = (e) => e.stopPropagation?.();
  const dock = (cls) => { const d = el('div', `dfpoi-dock ${cls}`); for (const ty of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'contextmenu', 'touchstart']) d.addEventListener(ty, swallow); return d; };

  const root = el('div', 'dfpoi');
  root.dataset.on = '0';
  const bar = dock('dfpoi-bar'), left = dock('dfpoi-left'), right = dock('dfpoi-right'), status = dock('dfpoi-status');
  // closed, the editor is one button in the corner: the world plays, the drafts still stand on this screen
  const launch = btn(t('poi.editor.open', 'POI editor'), () => onEnter(), 'dfpoi-btn dfpoi-launch');
  root.append(bar, left, right, status, launch);
  /** @type {any} */
  let dialog = null;
  let list = null;           // the store's POIs (poiList), once asked
  let search = '';
  let closing = null;        // the POI whose close asks again (it holds unsaved changes)
  let busy = 0;   // the store's acts in flight (a picture's upload may overlap a save)
  // an asset's facts learnt: the inspector drawn again, and the approver's queue (its law reports) - `review` made below
  /** @type {any} */
  let review = null;
  const facts = createAssetFacts((sha) => feed.asset(sha, { auth: io()?.secret ?? null }), () => { schedule(); review?.learned(); });

  const say = (text, kind = 'ok') => { status.textContent = text; status.dataset.kind = kind; };
  const refusal = (r) => (r?.error ? accountRefusalText(r.error) : t('poi.editor.failed', 'That did not go through.'));
  // POI-4b: the library's dialogs, laid in the panel, through its own door to the store
  const library = createPoiLibrary({ doc, host: root, io, feed, me, act: (fn) => act(fn), say, refusal, editor, decodeImage, rand, exportGlb: (model) => exportGlb(model) });
  // POI-6: the approver's queue and a POI's history, laid in the panel the same way (the feed asked again after a verdict)
  review = createPoiReview({ doc, host: root, me, act: (fn) => act(fn), say, refusal, edit, facts, goTo, feed });
  const dialogsClosed = () => { closeDialog(); library.close(); review.close(); };

  // ── RENDERING ────────────────────────────────────────────────────
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    Promise.resolve().then(() => { queued = false; render(); });
  }
  // AUDIT POI U1: a dock is held while a field in it is being TYPED in (ui/input.js isTextEntryTarget, less the inputs
  // nothing is typed into) - and for nothing else. A browser leaves the focus on the button, box or list that was
  // pressed, and a dock held while ANYTHING in it had the focus went on showing itself as it was before the press:
  // "Close" never asked again (its second press threw the work away), Save stayed pressable through its own save, the
  // inspector kept a POI's fields with its new light selected.
  const UNTYPED = new Set(['checkbox', 'radio', 'color', 'file', 'range', 'button', 'submit', 'reset']);
  const typingIn = (n) => { const a = /** @type {any} */ (doc.activeElement); return isTextEntryTarget(a) && !UNTYPED.has(a.type) && typeof n.contains === 'function' && n.contains(a); };
  // AUDIT POI (the lead's; lane D's note): A PRESS HOLDS THE REDRAW UNTIL IT ENDS. A field typed in, then a button pressed:
  // the field's focusout and change come during the press's own mousedown, and a dock drawn again then took the button
  // out from under the pointer - its click never came, and the first press after typing did nothing. Held from the
  // press (the root's capture: before a dock swallows it) to just after its release (the click the release makes runs
  // first), and never longer than PRESS_HOLD_MS - a release the panel never hears (let go outside the window) cannot
  // freeze it.
  let pressAt = -Infinity;
  let gone = false;   // destroyed: a hold's timer, or a draw queued before, draws nothing more
  root.addEventListener('pointerdown', () => { pressAt = Date.now(); }, true);
  const released = () => { setTimeout(() => { pressAt = -Infinity; schedule(); }, 0); };
  root.addEventListener('pointerup', released, true);
  root.addEventListener('pointercancel', released, true);
  function render() {
    if (gone) return;
    const pressed = Date.now() - pressAt;
    if (pressed < PRESS_HOLD_MS) { setTimeout(() => schedule(), PRESS_HOLD_MS - pressed + 1); return; }
    if (!typingIn(bar)) renderBar();
    renderLeft();
    // a field being typed in keeps its text: the inspector is drawn again once it lets go of the keyboard
    if (!typingIn(right)) renderRight();
  }
  for (const d of [bar, left, right]) d.addEventListener('focusout', () => schedule());

  function renderBar() {
    const tool = (m, text, key) => { const b = btn(`${text} (${key})`, () => editor.setMode(m)); b.setAttribute('aria-pressed', String(editor.mode() === m)); return b; };
    const undo = btn(t('poi.editor.undo', 'Undo'), () => { edit.undo(); });
    undo.disabled = !edit.canUndo();
    if (edit.canUndo()) undo.title = t('poi.editor.undoWhat', 'Undo {what} (Ctrl+Z)', { what: stepText(edit.undoLabel()) });
    const redo = btn(t('poi.editor.redo', 'Redo'), () => { edit.redo(); });
    redo.disabled = !edit.canRedo();
    if (edit.canRedo()) redo.title = t('poi.editor.redoWhat', 'Redo {what} (Ctrl+Y)', { what: stepText(edit.redoLabel()) });
    const space = btn(editor.space() === 'world' ? t('poi.editor.spaceWorld', 'World axes (X)') : t('poi.editor.spaceLocal', 'Own axes (X)'), () => editor.setSpace(editor.space() === 'world' ? 'local' : 'world'));
    const snap = btn(t('poi.editor.snap', 'Snap'), () => editor.setSnap(!editor.snapOn()));
    snap.setAttribute('aria-pressed', String(editor.snapOn()));
    snap.title = t('poi.editor.snapHint', 'Snap to the steps. Hold Ctrl to snap for one drag.');
    const steps = editor.snapSteps();
    const stepIn = (k, title) => { const i = numberInput(steps[k], (v) => { if (v > 0) editor.setSnap(editor.snapOn(), { [k]: v }); }, { step: k === 'turn' ? 1 : 0.05, min: 0 }); i.title = title; return i; };
    const speed = el('span', '', t('poi.editor.speed', 'Eye {speed, number} m/s', { speed: Math.round(editor.eyeSpeed() * 10) / 10 }));   // AUDIT POI U13: a number in the reader's own digits
    speed.title = t('poi.editor.speedHint', 'Hold the right mouse button to fly. Use your movement keys, Jump and Crouch to go up and down, Run to go faster, and the mouse wheel to set the speed.');
    const exitBack = btn(t('poi.editor.exitBack', 'Exit to where I stood'), () => onExit('back'));
    const exitHere = btn(t('poi.editor.exitHere', 'Exit here'), () => onExit('here'));
    exitHere.title = t('poi.editor.exitHereHint', 'Leave the editor standing on the ground under the eye.');
    bar.replaceChildren(
      tool('select', t('poi.editor.toolSelect', 'Select'), 'Q'), tool('move', t('poi.editor.toolMove', 'Move'), 'W'),
      tool('turn', t('poi.editor.toolTurn', 'Turn'), 'E'), tool('size', t('poi.editor.toolSize', 'Size'), 'R'),
      el('span', 'dfpoi-sep'), space, snap,
      stepIn('move', t('poi.editor.snapMove', 'Move step (m)')), stepIn('turn', t('poi.editor.snapTurn', 'Turn step (degrees)')), stepIn('size', t('poi.editor.snapSize', 'Size step')),
      el('span', 'dfpoi-sep'), undo, redo, el('span', 'dfpoi-sep'), speed, el('span', 'dfpoi-sep'),
      btn(t('poi.editor.newPoi', 'New POI'), () => { editor.placeNew(t('poi.editor.newName', 'New place')); say(t('poi.editor.placeHint', 'Click the ground where it stands. Esc to stop.')); }),
      btn(t('poi.editor.import', 'Import model'), () => openImport()),
      btn(t('poi.library.title', 'Library'), () => { dialogsClosed(); library.open(); }),
      btn(t('poi.pack.export', 'Export pack'), () => exportOpenPack()),
      btn(t('poi.pack.import', 'Import pack...'), () => choosePack()),
      ...(me.approver ? [btn(t('poi.review.title', 'Approvals'), () => { dialogsClosed(); review.openQueue(); })] : []),
      btn(t('poi.editor.map', 'Map'), () => onJump()),
      el('span', 'dfpoi-sep'), exitBack, exitHere,
    );
  }

  function renderLeft() {
    const sel = edit.selection();
    const out = [el('div', 'dfpoi-h', t('poi.editor.editing', 'Editing'))];
    const ids = edit.ids();
    if (!ids.length) out.push(el('div', 'dfpoi-sub', t('poi.editor.editingNone', 'Nothing open. Open a POI below, or make a new one.')));
    for (const id of ids) {
      const d = edit.docOf(id), e = edit.entryOf(id);
      const row = el('div', 'dfpoi-item');
      row.setAttribute('aria-selected', String(sel?.id === id && sel.part == null && sel.light == null));
      row.append(el('span', '', d.name || id), el('span', 'dfpoi-chip', stateText(e, edit.dirty(id))));
      row.addEventListener('click', () => edit.select({ id, part: null }));
      out.push(row);
      for (const part of d.parts) {
        const pr = el('div', 'dfpoi-item dfpoi-sub', part.name || part.key);
        pr.setAttribute('aria-selected', String(sel?.id === id && sel.part === part.key));
        pr.addEventListener('click', () => edit.select({ id, part: part.key }));
        out.push(pr);
      }
      (d.lights ?? []).forEach((_, i) => {
        const lr = el('div', 'dfpoi-item dfpoi-sub', t('poi.where.light', 'Light {n}', { n: i + 1 }));
        lr.setAttribute('aria-selected', String(sel?.id === id && sel.light === i));
        lr.addEventListener('click', () => edit.select({ id, part: null, light: i }));
        out.push(lr);
      });
    }
    out.push(el('div', 'dfpoi-h', t('poi.editor.all', 'All POIs')));
    const listBox = el('div', 'dfpoi-listbox');
    const find = el('input', 'dfpoi-grow');
    find.type = 'search'; find.value = search; find.placeholder = t('poi.editor.search', 'Search by name');
    find.addEventListener('input', () => { search = find.value; renderList(listBox); });
    const findRow = el('div', 'dfpoi-row');
    findRow.append(find);
    out.push(findRow, btn(t('poi.editor.refresh', 'Refresh the list'), () => refreshList()));
    renderList(listBox);
    out.push(listBox);
    // the search being typed in keeps its field: only the list under it is drawn again
    if (!typingIn(left)) left.replaceChildren(...out);
    else { const old = left.querySelector?.('.dfpoi-listbox'); if (old) renderList(old); }
  }
  function renderList(box) {
    if (!list) { box.replaceChildren(el('div', 'dfpoi-sub', t('poi.editor.listUnasked', 'Press Refresh to see the store\'s POIs.'))); return; }
    const q = search.trim().toLowerCase();
    const rows = list.filter((p) => !q || String(p.name).toLowerCase().includes(q)).slice(0, 200).map((p) => {
      const row = el('div', 'dfpoi-item');
      row.append(el('span', '', String(p.name)), el('span', 'dfpoi-chip', p.liveRev ? t('poi.editor.state.live', 'live') : t('poi.editor.state.unapproved', 'not yet approved')));
      row.addEventListener('click', () => openPoi(p.id));
      return row;
    });
    box.replaceChildren(...(rows.length ? rows : [el('div', 'dfpoi-sub', t('poi.editor.listNone', 'No POI matches.'))]));
  }

  /** A number field that commits on change (Enter or leaving it). */
  function numberInput(value, commit, { step = 0.1, min = -Infinity, max = Infinity } = {}) {
    const i = el('input');
    i.type = 'number'; i.step = String(step); i.value = String(Math.round(value * 1e4) / 1e4);
    if (Number.isFinite(min)) i.min = String(min);
    if (Number.isFinite(max)) i.max = String(max);
    i.addEventListener('change', () => { const v = Number(i.value); if (Number.isFinite(v)) commit(Math.min(max, Math.max(min, v))); });
    return i;
  }
  const field = (label, ...controls) => { const r = el('div', 'dfpoi-row'); r.append(el('label', '', label), ...controls); return r; };
  const vec = (v, commit, opts) => v.map((c, k) => numberInput(c, (x) => { const n = [...v]; n[k] = x; commit(n); }, opts));
  const select = (value, options, commit) => {
    const s = el('select');
    for (const [v, text] of options) { const o = el('option', '', text); o.value = v; if (v === value) o.selected = true; s.append(o); }
    s.value = value;
    s.addEventListener('change', () => commit(s.value));
    return s;
  };
  const check = (value, commit) => { const c = el('input'); c.type = 'checkbox'; c.checked = !!value; c.addEventListener('change', () => commit(!!c.checked)); return c; };
  const text = (value, commit, max) => { const i = el('input', 'dfpoi-grow'); i.type = 'text'; i.value = value ?? ''; i.maxLength = max; i.addEventListener('change', () => commit(i.value)); return i; };

  function renderRight() {
    const sel = edit.selection();
    if (!sel) { right.replaceChildren(el('div', 'dfpoi-h', t('poi.editor.nothingSelected', 'Nothing selected')), el('div', '', t('poi.editor.selectHint', 'Click a POI in the world or the list. Click once to select the POI, and again to select a part.'))); return; }
    const d = edit.docOf(sel.id), entry = edit.entryOf(sel.id);
    const change = (label, fn) => edit.edit(sel.id, label, fn);
    const out = [];
    if (sel.part != null) out.push(...partFields(d, sel, change));
    else if (sel.light != null) out.push(...lightFields(d, sel, change));
    else out.push(...poiFields(d, change));
    out.push(...problemRows(d, sel.id));
    out.push(...actRows(sel.id, d, entry));
    right.replaceChildren(...out);
  }

  function poiFields(d, change) {
    const p = d.place;
    const out = [el('div', 'dfpoi-h', t('poi.editor.poi', 'POI'))];
    out.push(field(t('poi.editor.name', 'Name'), text(d.name, (v) => change('rename', (x) => { x.name = lawName(v); }), POI_LIMITS.name)));
    const about = el('textarea');
    about.value = d.about ?? ''; about.maxLength = POI_LIMITS.about;
    about.addEventListener('change', () => change('about', (x) => { if (about.value.trim()) x.about = about.value; else delete x.about; }));
    out.push(el('div', 'dfpoi-row', t('poi.editor.about', 'Description')), about);
    out.push(field(t('poi.editor.tags', 'Tags'), text((d.tags ?? []).join(', '), (v) => change('tags', (x) => {
      const tags = v.split(',').map((s) => lawName(s, POI_LIMITS.tag)).filter(Boolean).slice(0, POI_LIMITS.tags);
      if (tags.length) x.tags = tags; else delete x.tags;
    }), 300)));
    out.push(el('div', 'dfpoi-h', t('poi.editor.place', 'Place')));
    out.push(field(t('poi.editor.mapPixel', 'Map square'), el('span', '', `${p.px}, ${p.py}`)));
    out.push(field(t('poi.editor.spot', 'Spot (m)'), ...vec([p.x, p.z], ([x, z]) => change('move', (doc) => { doc.place.x = Math.min(Math.max(x, 0), 819.19); doc.place.z = Math.min(Math.max(z, 0), 819.19); }))));
    out.push(field(t('poi.editor.stands', 'Stands'), select(p.ground, [['snap', t('poi.editor.groundSnap', 'on the ground')], ['absolute', t('poi.editor.groundAbsolute', 'at a fixed height')]], (v) => change('ground', (x) => { x.place.ground = v; }))));
    out.push(field(p.ground === 'snap' ? t('poi.editor.lift', 'Above ground (m)') : t('poi.editor.height', 'Height (m)'), numberInput(p.y, (v) => change('move', (x) => { x.place.y = v; }), { step: 0.05, min: -4000, max: 4000 })));
    out.push(field(t('poi.editor.turn', 'Turn (degrees)'), ...vec(eulerOfQuat(p.r), (e) => change('turn', (x) => { x.place.r = quatOfEuler(e); }), { step: 1 })));
    out.push(field(t('poi.editor.size', 'Size'), numberInput(p.s, (v) => change('size', (x) => { x.place.s = v; }), { step: 0.05, min: 0.01, max: 100 })));
    out.push(el('div', 'dfpoi-h', t('poi.editor.mark', 'On the map')));
    const marker = d.marker ?? { show: false };
    out.push(field(t('poi.editor.markShow', 'Show a mark'), check(marker.show, (v) => change('mark', (x) => { x.marker = { ...(x.marker ?? {}), show: v }; }))));
    out.push(field(t('poi.editor.markLabel', 'Label'), text(marker.label ?? '', (v) => change('mark', (x) => { const l = lawName(v, POI_LIMITS.label); x.marker = { ...(x.marker ?? { show: false }) }; if (l) x.marker.label = l; else delete x.marker.label; }), POI_LIMITS.label)));
    out.push(el('div', 'dfpoi-h', t('poi.editor.lights', 'Lights')));
    // AUDIT POI U1: bound to the lights it was drawn with - pressed again before the inspector is, it adds no second one
    const lightsDrawn = d.lights?.length ?? 0;
    out.push(btn(t('poi.editor.addLight', 'Add a light'), () => { if ((edit.docOf(d.id)?.lights?.length ?? 0) === lightsDrawn) edit.edit(d.id, 'light', (x) => { x.lights = [...(x.lights ?? []), newLight()]; }, { id: d.id, part: null, light: lightsDrawn }); }));
    // POI-4b: its parts and lights kept in the library, from the POI's own origin
    if (d.parts.length) out.push(el('div', 'dfpoi-h', t('poi.library.title', 'Library')), btn(t('poi.library.keepPoi', 'Keep it in the library...'), () => { closeDialog(); library.keep({ name: d.name, parts: structuredClone(d.parts), lights: structuredClone(d.lights ?? []) }); }));
    // POI-6: its revisions (once the store has it), and its model out as a .glb
    const more = el('div', 'dfpoi-row');
    if (edit.entryOf(d.id)?.state !== 'new' || edit.entryOf(d.id)?.saved) more.append(btn(t('poi.review.history', 'History...'), () => { dialogsClosed(); review.openHistory(d.id); }));
    if (d.parts.length) more.append(btn(t('poi.export.glb', 'Export model (.glb)'), () => exportGlb({ name: d.name, parts: d.parts, lights: d.lights ?? [] })));
    out.push(more);
    return out;
  }

  function partFields(d, sel, change) {
    const part = d.parts.find((p) => p.key === sel.part);
    if (!part) return [];
    const at = (fn) => (x) => { const p = x.parts.find((q) => q.key === sel.part); if (p) fn(p, x); };
    const out = [el('div', 'dfpoi-h', t('poi.editor.part', 'Part'))];
    out.push(field(t('poi.editor.name', 'Name'), text(part.name ?? '', (v) => change('rename', at((p) => { const n = lawName(v); if (n) p.name = n; else delete p.name; })), POI_LIMITS.name)));
    out.push(field(t('poi.editor.key', 'Key'), el('span', '', part.key)));
    out.push(field(t('poi.editor.offset', 'Offset (m)'), ...vec(part.t, (v) => change('move', at((p) => { p.t = v; })), { step: 0.05, min: -2000, max: 2000 })));
    out.push(field(t('poi.editor.turn', 'Turn (degrees)'), ...vec(eulerOfQuat(part.r), (e) => change('turn', at((p) => { p.r = quatOfEuler(e); })), { step: 1 })));
    out.push(field(t('poi.editor.scale', 'Scale'), ...vec(part.s, (v) => change('size', at((p) => { p.s = v.map((c) => (Math.abs(c) < 0.001 ? 0.001 : c)); })), { step: 0.05, min: -1000, max: 1000 })));
    out.push(field(t('poi.editor.solid', 'Solid'), check(part.collide === 'mesh', (v) => change('solid', at((p) => { p.collide = v ? 'mesh' : 'none'; })))));
    out.push(field(t('poi.editor.shadow', 'Casts a shadow'), check(part.shadow, (v) => change('shadow', at((p) => { p.shadow = v; })))));
    out.push(el('div', 'dfpoi-h', t('poi.editor.materials', 'Materials')));
    part.materials.forEach((m, k) => {
      const mat = (fn) => at((p) => fn(p.materials[k]));
      out.push(el('div', 'dfpoi-sub', t('poi.where.material', 'material {n}', { n: k + 1 })));
      const colour = el('input');
      colour.type = 'color';
      colour.value = `#${m.color.slice(0, 3).map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
      colour.addEventListener('change', () => change('material', mat((x) => { const v = colour.value; x.color = [parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255, x.color[3]]; })));
      out.push(field(t('poi.editor.colour', 'Colour'), colour, numberInput(m.color[3], (a) => change('material', mat((x) => { x.color = [x.color[0], x.color[1], x.color[2], a]; })), { step: 0.05, min: 0, max: 1 })));
      out.push(field(t('poi.editor.alpha', 'Edges'), select(m.alpha, POI_ALPHA.map((a) => [a, alphaText(a)]), (v) => change('material', mat((x) => { x.alpha = v; })))));
      if (m.alpha === 'cutout') out.push(field(t('poi.editor.cutoff', 'Cut at'), numberInput(m.cutoff, (v) => change('material', mat((x) => { x.cutoff = v; })), { step: 0.05, min: 0, max: 1 })));
      out.push(field(t('poi.editor.twoSided', 'Both sides'), check(m.twoSided, (v) => change('material', mat((x) => { x.twoSided = v; })))));
      out.push(field(t('poi.editor.wrap', 'Repeat'), ...[0, 1].map((ax) => select(m.wrap[ax], POI_WRAP.map((w) => [w, wrapModeText(w)]), (v) => change('material', mat((x) => { x.wrap = ax ? [x.wrap[0], v] : [v, x.wrap[1]]; }))))));
      out.push(field(t('poi.editor.filter', 'Picture'), select(m.filter, POI_FILTER.map((f) => [f, f === 'linear' ? t('poi.editor.filterLinear', 'smooth') : t('poi.editor.filterNearest', 'pixelated')]), (v) => change('material', mat((x) => { x.filter = v; })))));
      // POI-5: THE MATERIAL'S PICTURES - its picture and its glow's, each chosen from a file (read by its header, uploaded
      // by its name) or taken off; the glow's colour and its strength (the law's emissive colour is the two multiplied)
      const pictureRow = (label, field2) => {
        const sha = m[field2];
        const name = el('span', 'dfpoi-grow', sha ? sha.slice(0, 10) : t('poi.editor.noPicture', 'none'));
        if (sha) name.title = sha;
        return field(label, name,
          btn(t('poi.editor.choosePicture', 'Choose...'), () => choosePicture((got) => change('material', mat((x) => { x[field2] = got; })))),
          ...(sha ? [btn(t('poi.editor.clearPicture', 'Take off'), () => change('material', mat((x) => { x[field2] = null; })))] : []));
      };
      out.push(pictureRow(t('poi.editor.picture', 'Its picture'), 'texture'));
      out.push(pictureRow(t('poi.editor.glowPicture', 'Glow picture'), 'emissive'));
      const strength = Math.max(...m.emissiveColor, 0);
      const glow = el('input');
      glow.type = 'color';
      glow.value = `#${m.emissiveColor.map((c) => Math.round((strength > 0 ? c / strength : 0) * 255).toString(16).padStart(2, '0')).join('')}`;
      const glowAs = (hex, k2) => [1, 3, 5].map((i) => Math.min(16, (parseInt(hex.slice(i, i + 2), 16) / 255) * k2));
      glow.addEventListener('change', () => change('material', mat((x) => { x.emissiveColor = glowAs(glow.value, Math.max(...x.emissiveColor, 0) || 1); })));
      out.push(field(t('poi.editor.glow', 'Glow'), glow, numberInput(strength, (k2) => change('material', mat((x) => { x.emissiveColor = glowAs(glow.value, k2); })), { step: 0.1, min: 0, max: 16 })));
      // where the picture lies on the faces: KHR_texture_transform's offset, scale and turn (stored in radians)
      out.push(field(t('poi.editor.uvOffset', 'Picture offset'), ...vec(m.uv.offset, (v) => change('material', mat((x) => { x.uv = { ...x.uv, offset: v }; })), { step: 0.01, min: -10000, max: 10000 })));
      out.push(field(t('poi.editor.uvScale', 'Picture repeats'), ...vec(m.uv.scale, (v) => change('material', mat((x) => { x.uv = { ...x.uv, scale: v.map((c) => (Math.abs(c) < 1e-4 ? 1e-4 : c)) }; })), { step: 0.1, min: -10000, max: 10000 })));
      out.push(field(t('poi.editor.uvTurn', 'Picture turn (degrees)'), numberInput((m.uv.rotation * 180) / Math.PI, (deg) => change('material', mat((x) => { x.uv = { ...x.uv, rotation: (deg * Math.PI) / 180 }; })), { step: 1, min: -3600, max: 3600 })));
      out.push(btn(t('poi.editor.editUvs', 'Edit UVs...'), () => openUv(sel.id, part.key, k)));
    });
    // POI-4b: the part alone kept in the library - its own turn and size, standing at the entry's origin
    out.push(btn(t('poi.library.keepPart', 'Keep this part in the library...'), () => { closeDialog(); library.keep({ name: part.name || part.key, parts: [{ ...structuredClone(part), t: [0, 0, 0] }], lights: [] }); }));
    // AUDIT POI U1: the part it was drawn for - it read the selection, and the second press of a double one, the part gone
    // and its POI selected, took the whole new POI
    out.push(btn(t('poi.editor.removePart', 'Remove this part'), () => removePart(sel.id, part.key)));
    return out;
  }

  function lightFields(d, sel, change) {
    const l = d.lights?.[sel.light];
    if (!l) return [];
    const at = (fn) => (x) => { const q = x.lights[sel.light]; if (q) fn(q); };
    const out = [el('div', 'dfpoi-h', t('poi.where.light', 'Light {n}', { n: sel.light + 1 }))];
    out.push(field(t('poi.editor.offset', 'Offset (m)'), ...vec(l.t, (v) => change('light', at((q) => { q.t = v; })), { step: 0.1, min: -2000, max: 2000 })));
    const colour = el('input');
    colour.type = 'color';
    colour.value = `#${l.color.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
    colour.addEventListener('change', () => change('light', at((q) => { const v = colour.value; q.color = [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16) / 255); })));
    out.push(field(t('poi.editor.colour', 'Colour'), colour));
    out.push(field(t('poi.editor.reach', 'Reach (m)'), numberInput(l.radius, (v) => change('light', at((q) => { q.radius = v; })), { step: 0.5, min: 0.5, max: 100 })));
    out.push(field(t('poi.editor.strength', 'Strength'), numberInput(l.intensity, (v) => change('light', at((q) => { q.intensity = v; })), { step: 0.1, min: 0, max: 10 })));
    out.push(field(t('poi.editor.flicker', 'Flickers'), check(l.flicker, (v) => change('light', at((q) => { q.flicker = v; })))));
    // AUDIT POI U1: the light it was drawn for - by its place in the list, the lights as they were: pressed twice it took
    // the next light too, by then at that place
    const drawn = JSON.stringify(d.lights);
    out.push(btn(t('poi.editor.removeLight', 'Remove this light'), () => { if (JSON.stringify(edit.docOf(d.id)?.lights) === drawn) edit.edit(d.id, 'light', (x) => { x.lights.splice(sel.light, 1); }, { id: d.id, part: null, light: null }); }));
    return out;
  }

  /** The document's problems: the law's, then its assets' once every asset is known. */
  function problemsOf(d) {
    const law = poiDocProblems(d);
    const shas = [];
    for (const part of d.parts ?? []) { shas.push(part.mesh); for (const m of part.materials ?? []) { if (m.texture) shas.push(m.texture); if (m.emissive) shas.push(m.emissive); } }
    const known = shas.every((s) => facts.of(s) !== undefined);
    return { list: known ? [...law, ...poiAssetProblems(d, (s) => facts.of(s))] : law, checking: !known };
  }
  function problemRows(d, id) {
    const { list: ps, checking } = problemsOf(d);
    const out = [el('div', 'dfpoi-h', t('poi.editor.problems', 'What is wrong'))];
    if (!ps.length) out.push(el('div', checking ? '' : 'dfpoi-ok', checking ? t('poi.editor.checking', 'Checking its models and pictures...') : t('poi.editor.noProblems', 'Nothing. It can be saved.')));
    for (const p of ps.slice(0, 40)) {
      const row = el('div', 'dfpoi-problem');
      const where = problemWhere(p.path, d);
      if (where) row.append(el('span', 'dfpoi-where', `${where}: `));
      row.append(problemText(p));
      const pi = /^parts\[(\d+)\]/.exec(p.path);
      if (pi) row.addEventListener('click', () => edit.select({ id, part: d.parts[Number(pi[1])]?.key ?? null }));
      out.push(row);
    }
    return out;
  }

  function actRows(id, d, entry) {
    const dirty = edit.dirty(id);
    const { list: ps, checking } = problemsOf(d);
    const save = btn(t('poi.editor.save', 'Save draft (Ctrl+S)'), () => saveDraft(id));
    save.disabled = busy > 0 || !dirty || ps.length > 0 || checking;
    // AUDIT POI U3: a submission is not saved over - the store would make a draft BESIDE it, the submission left waiting
    if (entry.state === 'submitted') save.disabled = true;
    const submit = btn(t('poi.editor.submit', 'Send for approval'), () => submitPoi(id));
    submit.disabled = busy > 0 || ps.length > 0 || checking || entry.state === 'submitted' || entry.state === 'live' && !dirty;
    const out = [el('div', 'dfpoi-h', t('poi.editor.acts', 'Draft')), el('div', 'dfpoi-row')];
    out[1].append(save, submit);
    if (entry.state === 'submitted' && dirty) out.push(el('div', 'dfpoi-warn', withdrawFirstText()));
    const more = el('div', 'dfpoi-row');
    if (entry.state === 'submitted') more.append(btn(t('poi.editor.withdraw', 'Take back to draft'), () => withdrawPoi(id)));
    if (entry.base != null) more.append(btn(t('poi.editor.retire', 'Ask to retire it'), () => retirePoi(id)));
    if (dirty && entry.saved) more.append(btn(t('poi.editor.revert', 'Put back as saved'), () => edit.edit(id, 'revert', (x) => { const s = JSON.parse(entry.saved); for (const k of Object.keys(x)) delete x[k]; Object.assign(x, s); })));
    // AUDIT POI U1: the press means what its button said - "Close" asks again over unsaved work, and only the question closes
    const asked = closing === id;
    more.append(btn(asked ? t('poi.editor.closeUnsaved', 'Close without saving?') : t('poi.editor.close', 'Close'), () => closePoi(id, asked)));
    if (entry.state === 'new' && !entry.saved) more.append(btn(t('poi.editor.discard', 'Throw it away'), () => { edit.remove(id); }));
    out.push(more);
    if (!me.builder) out.push(el('div', 'dfpoi-warn', accountRefusalText('poi-not-builder')));
    return out;
  }

  // ── THE STORE'S ACTS ─────────────────────────────────────────────
  async function act(fn) {
    const i = io();
    if (!i) { say(accountRefusalText('no-session'), 'bad'); return null; }
    busy++; schedule();
    try { return await fn(i); } finally { busy--; schedule(); }
  }
  // AUDIT POI U5: the POIs a store act is out for - one at a time each, whatever asked for it (a button drawn before the
  // act went, Ctrl+S held down and repeating): the second is not sent
  const going = new Set();
  async function once(id, fn) {
    if (going.has(id)) return false;
    going.add(id);
    try { return await fn(); } finally { going.delete(id); }
  }
  const withdrawFirstText = () => t('poi.editor.withdrawFirst', 'It is waiting for approval: take it back to draft to save these changes.');
  /** AUDIT POI U2: the document the store holds for an entry - what it was last saved as (a send and a take-back move
   *  its state, never the screen's changes into "saved"). */
  const heldDoc = (e) => (e?.saved == null ? undefined : JSON.parse(e.saved));
  /** Ctrl+S and the Save button: held as the button holds itself. */
  const saveDraft = (id) => once(id, () => saveNow(id));
  /** `always` saves an unchanged document too (a send of one with no revision of its own). */
  async function saveNow(id, always = false) {
    const d = edit.docOf(id), e = edit.entryOf(id);
    if (!d) return false;
    // AUDIT POI U5: nothing changed is nothing to save
    if (!always && !edit.dirty(id)) return false;
    // AUDIT POI U3: the store saves over a DRAFT of the builder's alone - a submission saved over is a second revision
    // beside it, and the submission left waiting to be approved as it was
    if (e.state === 'submitted') { say(withdrawFirstText(), 'bad'); return false; }
    const { list: ps, checking } = problemsOf(d);
    if (ps.length) { say(t('poi.editor.fixFirst', 'Fix what is wrong before saving ({n}).', { n: ps.length }), 'bad'); return false; }
    // AUDIT POI U5: an asset not yet heard of is not checked - the button waits for it, and so does the key
    if (checking) { say(t('poi.editor.stillChecking', 'Its models and pictures are still being checked: save it once that is done.'), 'bad'); return false; }
    const sent = structuredClone(d);
    const r = await act((i) => poiSaveDraft(i, sent, e.base));
    if (!r) return false;
    if (!r.ok) { say(refusal(r), 'bad'); return false; }
    edit.markSaved(id, { rev: r.data.rev, state: 'draft', doc: sent });
    say(t('poi.editor.saved', 'Saved: draft {rev}.', { rev: r.data.rev }));
    return true;
  }
  const submitPoi = (id) => once(id, async () => {
    const e0 = edit.entryOf(id);
    if (!e0) return;
    // AUDIT POI U4: saved first whenever it has no revision of its own to send - opened from the live one, the history,
    // another builder's or a pack - not only when it is changed (it was sent as `{ rev: null }`, a refusal)
    if ((edit.dirty(id) || e0.rev == null) && !(await saveNow(id, true))) return;
    const e = edit.entryOf(id);
    // AUDIT POI U2: what the store sends is the draft as saved - changes typed while it goes stay unsaved
    const rev = e.rev, held = heldDoc(e);
    const r = await act((i) => poiSubmit(i, id, rev));
    if (!r) return;
    if (!r.ok) { say(refusal(r), 'bad'); return; }
    edit.markSaved(id, { rev, state: 'submitted', doc: held });
    say(t('poi.editor.submitted', 'Sent for approval. An approver will look at it.'));
  });
  const withdrawPoi = (id) => once(id, async () => {
    const e = edit.entryOf(id);
    if (!e) return;
    // AUDIT POI U2: taken back, the store's draft is the submission - the changes made since stay changes to save
    const rev = e.rev, held = heldDoc(e);
    const r = await act((i) => poiWithdraw(i, id, rev));
    if (!r) return;
    if (!r.ok) { say(refusal(r), 'bad'); return; }
    // AUDIT POI (the lead's; lane A's S8): the builder's own draft of it already open beside it (saved from another
    // window) - the store closed this one 'withdrawn' and keeps that one; a save puts this document there
    if (r.data?.state === 'withdrawn') {
      edit.markSaved(id, { rev: null, state: 'draft', unheld: true });
      say(t('poi.editor.withdrawnBeside', 'Taken back. You had another draft of it saved: save to put this one in its place.'));
      return;
    }
    edit.markSaved(id, { rev, state: 'draft', doc: held });
    say(t('poi.editor.withdrawn', 'Taken back: it is a draft again.'));
  });
  const retirePoi = (id) => once(id, async () => {
    const r = await act((i) => poiRetire(i, id));
    if (!r) return;
    say(r.ok ? t('poi.editor.retireAsked', 'Asked: an approver will decide whether it leaves the world.') : refusal(r), r.ok ? 'ok' : 'bad');
  });
  /** `sure` the question asked and answered (AUDIT POI U1: by the button that said so, not by what `closing` is now). */
  function closePoi(id, sure = false) {
    if (edit.dirty(id) && !sure) { closing = id; schedule(); return; }
    closing = null;
    edit.close(id);
  }
  async function refreshList() {
    const r = await act((i) => poiList(i));
    if (!r) return;
    if (!r.ok) { say(refusal(r), 'bad'); return; }
    list = r.data.pois ?? [];
    schedule();
  }
  /** Open a POI from the store: my own open draft of it if I have one, else its live revision, else its newest. */
  async function openPoi(id) {
    if (edit.has(id)) { edit.select({ id, part: null }); return; }
    const r = await act((i) => poiHistory(i, id));
    if (!r) return;
    if (!r.ok) { say(refusal(r), 'bad'); return; }
    const h = r.data;
    const docs = (h.revs ?? []).filter((x) => x.kind === 'doc' && x.doc);
    const mine = [...docs].reverse().find((x) => (x.state === 'draft' || x.state === 'submitted') && me.handle && String(x.author).toLowerCase() === me.handle.toLowerCase());
    const live = docs.find((x) => x.rev === h.liveRev);
    const pick = mine ?? live ?? docs.at(-1);
    if (!pick) { say(t('poi.editor.nothingToOpen', 'It has no document to open.'), 'bad'); return; }
    // AUDIT POI U4: none of mine open and none live - the newest revision: my own sent back (said so, as it was saved), or
    // another builder's, a change to save as my own draft (it opened as a clean "draft" of mine with nothing to send)
    const sentBack = !mine && !live && pick.state === 'rejected' && !!me.handle && String(pick.author).toLowerCase() === me.handle.toLowerCase();
    const others = !mine && !live && !sentBack;
    // AUDIT POI P6: my own draft with the base it was made from - the live one's hid that another's went live since, and
    // its save wrote that base over the store's, so the queue showed it made from the live revision, not stale
    edit.open(id, { doc: pick.doc, ...(others ? { saved: null } : {}), base: mine ? (mine.base ?? null) : sentBack ? (pick.base ?? null) : (h.liveRev ?? null), rev: mine ? mine.rev : null, state: mine ? mine.state : live ? 'live' : sentBack ? 'rejected' : 'draft' });
    edit.select({ id, part: null });
    say(t('poi.editor.opened', 'Opened {name}.', { name: pick.doc.name }));
  }
  /** A picture from a file: read by its header (refused in words), uploaded by its name, handed to `use`. */
  async function takePicture(bytes, use) {
    const meta = poiImageMetaOf(bytes);
    if ('error' in meta) { say(imageErrorText(meta.error), 'bad'); return false; }
    const r = await act((i) => poiPutAsset(i, bytes, 'texture'));
    if (!r) return false;
    if (!r.ok) { say(refusal(r), 'bad'); return false; }
    facts.put(r.data.sha, { kind: 'texture', ...r.data.meta, bytes: bytes.byteLength });
    use(r.data.sha);
    return true;
  }
  function choosePicture(use) {
    const input = el('input');
    input.type = 'file'; input.accept = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';
    input.addEventListener('change', async () => { const f = input.files?.[0]; if (f) await takePicture(await readFile(f), use); });
    input.click?.();
  }
  /** POI-5: the UV editor over a part's material - the part's mesh fetched and read, the material's picture under it;
   *  applied, the mesh made again is uploaded by its name and the part wears it (one step). */
  /** @type {any} */
  let uvDialog = null;
  let uvOpening = false;
  async function openUv(id, key, k) {
    const d = edit.docOf(id), part = d?.parts.find((p) => p.key === key);
    // AUDIT POI U7: one UV editor at a time - asked for again while the first's model is fetched, still one
    if (!part || uvDialog || uvOpening) return;
    const auth = io()?.secret ?? null;
    let bytes = null;
    uvOpening = true;
    try { bytes = await feed.asset(part.mesh, { auth }); } catch { bytes = null; }
    uvOpening = false;
    if (!bytes) { say(t('poi.editor.uvNoMesh', 'The part\'s model would not load.'), 'bad'); return; }
    // AUDIT POI U7, U8: the editor left, or the part gone or dressed anew, while its model came - nothing opened over it
    if (root.dataset.on !== '1' || !edit.docOf(id)?.parts.some((p) => p.key === key && p.mesh === part.mesh)) return;
    const dm = decodePoiMesh(bytes);
    if ('error' in dm) { say(meshErrorText(dm.error), 'bad'); return; }
    const tex = part.materials[k]?.texture;
    const picture = tex && decodeImage ? feed.asset(tex, { auth }).then((b) => decodeImage(b)).catch(() => null) : Promise.resolve(null);
    /** @type {any} */
    let dlg = null;
    dlg = createPoiUvPanel({
      doc, mesh: dm.mesh, sub: k, materials: part.materials.length, picture,
      title: t('poi.editor.uvTitle', 'UVs: {name}', { name: part.name || part.key }),
      onApply: async (mesh) => {
        let out;
        try { out = encodePoiMesh(mesh); } catch (e) { say(meshErrorText(String(e?.message ?? '').replace(/^poi mesh: /, '')), 'bad'); return false; }
        const r = await act((i) => poiPutAsset(i, out, 'mesh'));
        // AUDIT POI U7: closed while it went up (Cancel, the editor left) - let go, as closing says: the part keeps its model
        if (dlg.closed()) return false;
        if (!r) return false;
        if (!r.ok) { say(refusal(r), 'bad'); return false; }
        facts.put(r.data.sha, { kind: 'mesh', ...r.data.meta, bytes: out.byteLength });
        // AUDIT POI U7: the part gone (taken out, its POI closed) - nothing wears it, and nothing is said applied
        if (!edit.docOf(id)?.parts.some((q) => q.key === key)) { say(t('poi.editor.uvGone', 'The part is gone: the UVs were not applied.'), 'bad'); return true; }
        edit.edit(id, 'uv', (x) => { const p = x.parts.find((q) => q.key === key); if (p) p.mesh = r.data.sha; });
        say(t('poi.editor.uvApplied', 'UVs applied. The part now uses its new model.'));
        return true;
      },
      onClose: () => { uvDialog = null; },   // once (AUDIT POI U7: poiUvPanel.js closes once)
    });
    uvDialog = dlg;
    root.append(dlg.root);
    dlg.root.focus?.();
  }
  /** AUDIT POI U1: a part taken out by its key - once; gone, the press does nothing. */
  function removePart(id, key) {
    if (!edit.docOf(id)?.parts.some((p) => p.key === key)) return false;
    return edit.edit(id, 'remove part', (x) => { x.parts = x.parts.filter((p) => p.key !== key); }, { id, part: null });
  }
  function removeSelection() {
    const sel = edit.selection();
    if (!sel) return;
    if (sel.part != null) removePart(sel.id, sel.part);
    else if (sel.light != null) edit.edit(sel.id, 'light', (x) => { x.lights.splice(sel.light, 1); }, { id: sel.id, part: null, light: null });
    else if (edit.entryOf(sel.id)?.state === 'new' && !edit.entryOf(sel.id)?.saved) edit.remove(sel.id);
    else say(t('poi.editor.deleteSaved', 'To take a saved POI out of the world, ask to retire it.'), 'bad');
  }
  function duplicateSelection() {
    const sel = edit.selection();
    if (!sel || sel.part == null) return;
    edit.edit(sel.id, 'duplicate', (x) => {
      const p = x.parts.find((q) => q.key === sel.part);
      if (!p) return;
      const copy = structuredClone(p);
      const taken = new Set(x.parts.map((q) => q.key));
      let n = 2; while (taken.has(`${p.key}-${n}`.slice(0, 32))) n++;
      copy.key = `${p.key}-${n}`.slice(0, 32);
      x.parts.push(copy);
    });
  }

  // ── OUT AND BACK IN (POI-6) ──────────────────────────────────────
  const fetchAsset = (sha) => feed.asset(sha, { auth: io()?.secret ?? null });
  /** A model - a POI's or a library entry's - as a .glb the builder saves. */
  async function exportGlb(model) {
    const r = await act(() => exportModel(model, fetchAsset));
    if (!r) return false;
    if (!r.ok) { say(t('poi.export.failed', 'A model or picture would not load: nothing was saved.'), 'bad'); return false; }
    download(fileNameOf(model.name, 'glb'), r.bytes, 'model/gltf-binary');
    say(t('poi.export.saved', 'Saved {file}.', { file: fileNameOf(model.name, 'glb') }));
    return true;
  }
  /** Every POI open in the editor, as it stands on this screen, written as a pack. */
  async function exportOpenPack() {
    const pois = edit.ids().map((id) => structuredClone(edit.docOf(id)));
    if (!pois.length) { say(t('poi.pack.nothingOpen', 'Open the POIs to pack first.'), 'bad'); return false; }
    const r = await act(() => exportPack({ pois }, fetchAsset));
    if (!r) return false;
    // AUDIT POI C4: a pack refused by its own law said in its words (poiText.js packErrorText); a fetch that failed, as one
    if (!r.ok) { say(r.code && r.code !== 'export-fetch' ? packErrorText(r) : t('poi.export.failed', 'A model or picture would not load: nothing was saved.'), 'bad'); return false; }
    const file = fileNameOf(pois.length === 1 ? pois[0].name : `poi-pack-${pois.length}`, 'zip');
    download(file, r.bytes, 'application/zip');
    say(t('poi.pack.saved', 'Packed {n, plural, one {# POI} other {# POIs}} into {file}.', { n: pois.length, file }));
    return true;
  }
  function choosePack() {
    const input = el('input');
    input.type = 'file'; input.accept = '.zip,application/zip';
    input.addEventListener('change', async () => { const f = input.files?.[0]; if (f) await openPack(await readFile(f)); });
    input.click?.();
  }
  /** A pack read and checked whole, then shown: what it holds, and Upload and open. */
  async function openPack(bytes) {
    // AUDIT POI P5 (C6): read through the pack's own bounded reader - only what a pack holds inflated, each file to its
    // kind's bound, the whole to the pack's (poi/poiPack.js readPackBytes); a zip bomb is refused before it inflates
    let pack;
    try {
      pack = await readPackBytes(bytes);
    } catch { pack = { ok: false, code: 'pack-not-a-pack' }; }
    if (!pack.ok) { say(packErrorText(pack), 'bad'); return false; }
    dialogsClosed();
    const box = el('div', 'dfpoi-dialog');
    for (const ty of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'contextmenu', 'touchstart']) box.addEventListener(ty, swallow);
    const list = el('div', 'dfpoi-sub');
    for (const d of pack.pois) list.append(el('div', '', d.name));
    for (const d of pack.shelf) list.append(el('div', '', t('poi.pack.entryNamed', 'Library: {name}', { name: d.name })));
    const said = el('div');
    const go = btn(t('poi.pack.uploadOpen', 'Upload and open'), () => importOpened(pack, box, go, said));
    const acts = el('div', 'dfpoi-row');
    acts.append(go, btn(t('poi.editor.cancel', 'Cancel'), () => closeDialog()));
    box.append(el('div', 'dfpoi-h', t('poi.pack.title', 'Import a pack')),
      el('div', '', t('poi.pack.holds', '{pois, plural, one {# POI} other {# POIs}}, {entries, plural, one {# library entry} other {# library entries}}, {assets, plural, one {# model or picture} other {# models and pictures}}.', { pois: pack.pois.length, entries: pack.shelf.length, assets: pack.assets.size })),
      list, said, acts);
    dialog = box;
    root.append(box);
    return true;
  }
  /** AUDIT POI C5: the store's refusal of an import as the pack dialog says it - its word, where (an asset, an entry or a
   *  POI by its name), and the law's problems said where they are. */
  function packRefusalRows(pack, r) {
    const at = String(r.at ?? '');
    const named = pack.pois.find((d) => d.name === at) ?? pack.shelf.find((d) => d.name === at) ?? null;
    const where = /^[0-9a-f]{64}$/.test(at) ? t('poi.pack.atAsset', 'A model or picture ({sha})', { sha: at.slice(0, 10) }) : at;
    const rows = [el('div', 'dfpoi-problem', where ? t('poi.pack.refusedAt', '{where}: {word}', { where, word: refusal(r) }) : refusal(r))];
    for (const p of (r.problems ?? []).slice(0, 12)) {
      const w = problemWhere(p.path, named);
      rows.push(el('div', 'dfpoi-problem', w ? `${w}: ${problemText(p)}` : problemText(p)));
    }
    return rows;
  }
  /** AUDIT POI U9: a store ask that goes only while `box` is the dialog open - once it is cancelled (or another dialog
   *  opened over it) it is answered `cancelled` and nothing more goes. */
  const whileOpen = (box, fn) => (...args) => (dialog === box ? fn(...args) : Promise.resolve({ ok: false, error: 'cancelled' }));
  async function importOpened(pack, box, go, said) {
    // AUDIT POI U9: once at a time, and for its own dialog - Cancel (or another dialog opened over it) stops it: nothing
    // more is uploaded, nothing is opened, and its answer closes no dialog the builder opened since
    go.disabled = true;
    said.replaceChildren();
    const mine = () => dialog === box;
    const r = await act((i) => importPack(pack, {
      putAsset: whileOpen(box, (b, k) => poiPutAsset(i, b, k)), history: whileOpen(box, (id) => poiHistory(i, id)), shelve: whileOpen(box, (item) => poiShelve(i, item)), rand,
      shelfEntry: whileOpen(box, (id) => poiShelfEntry(i, id)),   // AUDIT POI P4: the shelf asked before an entry is put (poiTransfer.js)
      progress: (n, of) => { if (mine()) say(t('poi.editor.uploading', 'Uploading {n} of {of}...', { n, of })); },
    }));
    if (!mine()) { if (r) say(t('poi.pack.stopped', 'Stopped. Nothing was opened, but files uploaded before the stop stay in the store.')); return false; }
    go.disabled = false;
    if (!r) return false;
    if (!r.ok) { say(refusal(r), 'bad'); said.replaceChildren(...packRefusalRows(pack, r)); return false; }
    for (const [sha, { bytes, ...a }] of pack.assets) facts.put(sha, { ...a, bytes: bytes.byteLength });
    let opened = 0, kept = 0;
    for (const o of r.open) {
      // changes of the builder's own to that POI are never thrown away for a pack's
      if (edit.has(o.id) && edit.dirty(o.id)) { kept++; continue; }
      if (edit.has(o.id)) edit.close(o.id);
      edit.open(o.id, { doc: structuredClone(o.doc), saved: o.saved, base: o.base, rev: null, state: o.state });
      opened++;
    }
    closeDialog();
    if (r.open[0] && edit.has(r.open[0].id)) edit.select({ id: r.open[0].id, part: null });
    say(t('poi.pack.opened', 'Opened {n, plural, one {# POI} other {# POIs}}; {entries, plural, one {# library entry} other {# library entries}} kept. Save each as a draft to send it.', { n: opened, entries: r.shelved })
      + (kept ? ` ${t('poi.pack.keptOpen', '{n, plural, one {# POI was} other {# POIs were}} left as you had them (unsaved changes).', { n: kept })}` : ''));
    return true;
  }

  // ── THE IMPORT ───────────────────────────────────────────────────
  function openImport() {
    dialogsClosed();
    const box = el('div', 'dfpoi-dialog');
    for (const ty of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'contextmenu', 'touchstart']) box.addEventListener(ty, swallow);
    const files = el('input');
    files.type = 'file'; files.multiple = true; files.accept = '.glb,.gltf,.bin,.png,.jpg,.jpeg,.webp';
    let split = 'whole';
    let uploading = false;
    // AUDIT POI (the lead's; lane E's note): a model shown again for another "Make" is read inside the same refusal as
    // the first - a split that cannot be made says so, and the place button is held, never a throw out of the select
    const splitSel = select(split, [['whole', t('poi.editor.splitWhole', 'One part')], ['nodes', t('poi.editor.splitNodes', 'A part for each object')]], (v) => { split = v; if (lastRead) shown(lastRead); });
    const body = el('div');
    let lastRead = null, prep = null;
    const cancel = btn(t('poi.editor.cancel', 'Cancel'), () => closeDialog());
    const place = btn(t('poi.editor.uploadPlace', 'Upload and place'), () => upload());
    place.disabled = true;
    const acts = el('div', 'dfpoi-row');
    acts.append(place, cancel);
    // POI-4b: kept in the library as it is placed, unless the builder says not
    const keepToo = check(true, () => {});
    box.append(el('div', 'dfpoi-h', t('poi.editor.importTitle', 'Import a model (glTF 2.0)')), el('div', '', t('poi.editor.importHint', 'Choose a .glb, or a .gltf with its .bin and pictures.')), files, field(t('poi.editor.split', 'Make'), splitSel),
      field(t('poi.library.keepImport', 'Keep it in the library too'), keepToo), body, acts);
    files.addEventListener('change', async () => {
      const list = [...(files.files ?? [])];
      const main = list.find((f) => /\.(glb|gltf)$/i.test(f.name));
      if (!main) { body.replaceChildren(el('div', 'dfpoi-problem', t('poi.editor.importNoModel', 'Choose a .glb or .gltf file.'))); return; }
      const side = new Map();
      for (const f of list) if (f !== main) side.set(f.name, await readFile(f));
      try {
        lastRead = readGltf(await readFile(main), { files: side });
      } catch (e) {
        lastRead = null; refused(e);
        return;
      }
      shown(lastRead);
    });
    /** The import refused, in its own words; nothing to place. */
    function refused(e) {
      prep = null; place.disabled = true;
      body.replaceChildren(el('div', 'dfpoi-problem', e?.code ? gltfErrorText(e.code, e.args) : t('poi.editor.importFailed', 'The file could not be read.')));
    }
    function shown(model) { try { show(model); } catch (e) { refused(e); } }
    function show(model) {
      // AUDIT POI U10: never while the parts go up - "Make" or the files changed then re-armed the button and replaced the
      // parts the keeping read after it (a TypeError, nothing kept); both are held until it is done
      if (uploading) return;
      prep = prepareImport(model, bakeGltf(model, { split: /** @type {'whole' | 'nodes'} */ (split) }));
      const rows = [el('div', 'dfpoi-h', t('poi.editor.importParts', 'Parts'))];
      // AUDIT POI U13: each count in its plural ("1 materials" no more)
      for (const p of prep.parts) rows.push(el('div', 'dfpoi-sub', t('poi.editor.importPart', '{name}: {vertices, plural, one {{vertices, number} vertex} other {{vertices, number} vertices}}, {triangles, plural, one {{triangles, number} triangle} other {{triangles, number} triangles}}, {materials, plural, one {# material} other {# materials}}', { name: p.name || '-', vertices: p.vertices, triangles: p.triangles, materials: p.submeshes })));
      // AUDIT POI G7 (the lead's; lane E's note): the model's lights read from it, placed and kept with it
      if (prep.lights?.length) rows.push(el('div', 'dfpoi-sub', t('poi.editor.importLights', '{n, plural, one {# light} other {# lights}}, placed with it', { n: prep.lights.length })));
      for (const r of prep.refused) rows.push(el('div', 'dfpoi-problem', `${r.name || '-'}: ${meshErrorText(r.code)}`));
      for (const w of prep.warnings) rows.push(el('div', 'dfpoi-warn', gltfWarningText(w.code, w)));
      body.replaceChildren(...rows);
      place.disabled = !prep.parts.length;
    }
    async function upload() {
      // AUDIT POI U10: the parts as they stood when it was pressed, once
      const parts = prep;
      if (!parts?.parts.length) return;
      uploading = true;
      place.disabled = true; splitSel.disabled = true; files.disabled = true;
      // AUDIT POI U9: Cancel (or another dialog opened over it) stops it - nothing more uploaded, nothing placed, and its
      // answer closes no dialog the builder opened since
      const mine = () => dialog === box;
      const r = await act((i) => uploadImport(parts, whileOpen(box, (bytes, kind) => poiPutAsset(i, bytes, kind)), (n, of) => { if (mine()) say(t('poi.editor.uploading', 'Uploading {n} of {of}...', { n, of })); }));
      uploading = false;
      splitSel.disabled = false; files.disabled = false;
      if (!mine()) { if (r) say(t('poi.editor.importStopped', 'Stopped: nothing was placed.')); return; }
      if (!r) { place.disabled = false; return; }
      if (!r.ok) { say(refusal(r), 'bad'); place.disabled = false; return; }
      for (const [sha, meta] of r.metas) facts.put(sha, meta);
      closeDialog();
      editor.placeAsset(r.asset, t('poi.editor.newName', 'New place'));
      say(t('poi.editor.placeModel', 'Click where it stands. Esc to stop.'));
      if (keepToo.checked) {
        // its meshes as the import holds them - the picture is drawn from them, none fetched back
        const meshes = new Map();
        r.asset.parts.forEach((part, i) => { const d = decodePoiMesh(parts.parts[i].bytes); if (!('error' in d)) meshes.set(part.mesh, d.mesh); });
        // its lights kept with it (AUDIT POI G7, the lead's: they were left behind, `lights: []`)
        await library.keepNow({ name: r.asset.name, parts: r.asset.parts, lights: r.asset.lights ?? [], meshes });
      }
    }
    dialog = box;
    root.append(box);
  }
  function closeDialog() { dialog?.remove?.(); dialog = null; }

  const offEdit = edit.onChange(() => schedule());
  render();
  return {
    root,
    /** Shown open (the editor's docks) or closed (its launcher alone). */
    setOn(/** @type {boolean} */ on) {
      root.dataset.on = on ? '1' : '0';
      if (on) { schedule(); return; }
      // AUDIT POI U8: leaving the editor lets go of what was open over it - the UV editor (it stood on over the game), the
      // library, the approver's queue and its look (the screen shows the world as it stands again), the panel's own dialog
      dialogsClosed(); uvDialog?.close(); closing = null;
    },
    /** The editor's own change (a tool, the hover, the selection made in the world). */
    refresh: () => schedule(),
    say,
    /** The keyboard's acts the editor hands back (Ctrl+S, Delete, Ctrl+D). */
    acts: { save: () => { const s = edit.selection(); if (s) saveDraft(s.id); }, del: () => removeSelection(), duplicate: () => duplicateSelection() },
    open: (id) => openPoi(id),
    /** POI-5: the UV editor over a part's material, and a picture taken from bytes - the panel's own buttons' doors, a
     *  test's too. */
    openUv: (id, key, k) => openUv(id, key, k),
    uvDialog: () => uvDialog,
    takePicture: (bytes, use) => takePicture(bytes, use),
    refreshList: () => refreshList(),
    /** POI-4b: the library's dialogs (the bar's button, the inspectors' and the import's keeping). */
    library,
    /** POI-6: the approver's queue and a POI's history; a model out as a .glb; a pack out, and one read back from bytes. */
    review,
    exportGlb: (model) => exportGlb(model),
    exportPack: () => exportOpenPack(),
    openPack: (bytes) => openPack(bytes),
    /** Whether a press landed on the panel (the world leaves it alone). */
    owns: (target) => !!target && typeof root.contains === 'function' && root.contains(target),
    destroy() { gone = true; offEdit(); dialogsClosed(); uvDialog?.close(); root.remove?.(); },
  };
}

/** A file handed to the builder: a link to its bytes, pressed. @param {Document} doc */
export const downloadIn = (doc) => (name, bytes, type) => {
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type }));
  const a = doc.createElement('a');
  a.href = url; a.download = name;
  doc.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/** How long a press holds the panel's redraw at most, in milliseconds (a release it never hears lets go then). */
export const PRESS_HOLD_MS = 1500;

/** The alpha modes as the builder reads them. */
export const alphaText = (a) => (a === 'opaque' ? t('poi.editor.alphaOpaque', 'opaque') : a === 'cutout' ? t('poi.editor.alphaCutout', 'cutout') : t('poi.editor.alphaBlend', 'see-through'));
/** The wrap modes as the builder reads them. */
export const wrapModeText = (w) => (w === 'repeat' ? t('poi.editor.wrapRepeat', 'repeat') : w === 'clamp' ? t('poi.editor.wrapClamp', 'clamp') : t('poi.editor.wrapMirror', 'mirror'));
