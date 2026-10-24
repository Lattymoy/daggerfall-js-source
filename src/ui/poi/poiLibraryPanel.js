// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-4b (2026-10-14) - THE LIBRARY: THE MODELS EVERY BUILDER KEEPS, BROWSED, PLACED AND KEPT.
//
// Mac: "the ability to import models ... a tool my developers can use without having to access the codebase"
// (bible/06-Systems/POI-Editor-Arc.md POI-4b). Two dialogs over the POI editor's panel (ui/poi/poiEditorPanel.js):
//
//   - THE LIBRARY (the bar's Library): every entry on the shelf, newest change first - its picture, its name, its tags,
//     who made it, its parts and triangles - searched by any words of its name, tags or maker, or mine alone. PLACE
//     stands it where the next click meets the ground (its parts and lights, one step - poiEditorHost.js placeAsset); its
//     maker or an approver may CHANGE its name, tags and words, or TAKE IT OFF THE SHELF (asked twice).
//   - KEEP IN THE LIBRARY (a POI's or a part's inspector, and the import's own box): a name, tags and words; the picture
//     drawn from its parts and the entry put (poi/poiShelf.js putOnShelf) - the law's problems said in the dialog, the
//     store's refusal as its sentence.
//
// Every word through the text core (L10N4); every name a builder typed written with `textContent`. Not a DFU member.
// Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import { t } from '../../systems/textManager.js';   // L10N4: the words through the text core
import { mintShelfId, POI_LIMITS } from '../../poi/poiLaw.js';
import { lawName } from '../../poi/poiEdit.js';
import { problemText, problemWhere } from '../../poi/poiText.js';
import { poiShelf, poiShelfEntry, poiShelve, poiUnshelve, poiPutAsset } from '../../poi/poiService.js';
import { decodePoiMesh } from '../../poi/poiMesh.js';
import { shelfEntryOf, putOnShelf } from '../../poi/poiShelf.js';
import { bytesToBase64 } from '../../systems/save/saveTransfer.js';   // the port's one base64 (no atob/btoa in every host)

export const POI_LIBRARY_STYLE_ID = 'dfpoi-library-style';
export const POI_LIBRARY_CSS = `
.dfpoi-shelf { width: min(640px, calc(100vw - 16px)); }
.dfpoi-shelf-list { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
.dfpoi-shelf-row { display: flex; gap: 8px; align-items: center; padding: 4px; border-bottom: 1px solid #3a2f20; }
.dfpoi-shelf-thumb { width: 64px; height: 64px; flex: 0 0 64px; background: #121212; border: 1px solid #4b3c27; border-radius: 3px; object-fit: contain; display: flex; align-items: center; justify-content: center; color: #6b5230; font-size: 22px; }
.dfpoi-shelf-thumb img { width: 100%; height: 100%; object-fit: contain; }
.dfpoi-shelf-text { flex: 1 1 auto; min-width: 0; }
.dfpoi-shelf-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dfpoi-shelf-meta { color: #b9b2a3; font-size: 11px; }
.dfpoi-shelf-acts { display: flex; flex-direction: column; gap: 3px; }
`;
export function injectPoiLibraryStyle(doc = document) {
  if (doc.getElementById?.(POI_LIBRARY_STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = POI_LIBRARY_STYLE_ID;
  el.textContent = POI_LIBRARY_CSS;
  (doc.head ?? doc.body).append(el);
}

/** The entries a list shows at first, and each "show more" adds. */
export const SHELF_PAGE = 60;

/** Bytes as a data: URL - a picture shown with no object URL to forget. @param {Uint8Array} bytes */
export const dataUrlOf = (bytes, type = 'image/png') => `data:${type};base64,${bytesToBase64(bytes)}`;

/** Whether an entry matches a search: every word in its name, its tags or its maker's handle. */
export function shelfMatches(item, query) {
  const words = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [item.name, ...(item.tags ?? []), item.by].join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** Tags as a builder types them - comma-separated - as the law takes them. @param {string} text */
export const tagsOf = (text) => [...new Set(String(text ?? '').split(',').map((s) => lawName(s, POI_LIMITS.tag)).filter(Boolean))].slice(0, POI_LIMITS.tags);

/**
 * @param {{
 *   doc?: Document, host: any, io: () => any, feed: any, me: { handle: string | null, builder: boolean, approver: boolean },
 *   act: (fn: (io: any) => Promise<any>) => Promise<any>, say: (text: string, kind?: string) => void, refusal: (r: any) => string,
 *   editor: { placeAsset: (asset: any, fallbackName?: string) => void },
 *   decodeImage?: ((bytes: Uint8Array) => Promise<any>) | null, rand?: (b: Uint8Array) => Uint8Array,
 *   exportGlb?: ((model: { name: string, parts: any[], lights: any[] }) => any) | null,
 * }} deps `host` the element the dialogs are laid in; `act` the panel's door to the store (its busy count); `exportGlb`
 *   the panel's own .glb writer (POI-6)
 */
export function createPoiLibrary({ doc = document, host, io, feed, me, act, say, refusal, editor, decodeImage = null, rand = (b) => { globalThis.crypto.getRandomValues(/** @type {any} */ (b)); return b; }, exportGlb = null }) {
  injectPoiLibraryStyle(doc);
  const el = (tag, cls = '', text = null) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const btn = (text, onClick, cls = 'dfpoi-btn') => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', (e) => { e.stopPropagation?.(); onClick(); }); return b; };
  const swallow = (e) => e.stopPropagation?.();
  const box = (cls) => { const d = el('div', `dfpoi-dialog ${cls}`); for (const ty of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'contextmenu', 'touchstart']) d.addEventListener(ty, swallow); return d; };
  const field = (label, ...controls) => { const r = el('div', 'dfpoi-row'); r.append(el('label', '', label), ...controls); return r; };
  const auth = () => io()?.secret ?? null;
  const mine = (item) => !!me.handle && String(item.by ?? '').toLowerCase() === me.handle.toLowerCase();
  const mayChange = (item) => mine(item) || me.approver;

  /** @type {any} */
  let dialog = null;
  /** @type {any[] | null} */
  let items = null;
  let query = '', mineOnly = false, shown = SHELF_PAGE;
  let editing = null;        // the entry whose words are being changed: `{ id, item, name, tags, about }` (as typed so far)
  let dropping = null;       // the entry whose taking-off asks again
  /** Each picture's data: URL, asked once (a failure forgotten, so it is asked again next time). @type {Map<string, Promise<string | null>>} */
  const thumbs = new Map();
  const thumbUrl = (sha) => {
    if (!thumbs.has(sha)) thumbs.set(sha, Promise.resolve().then(() => feed.asset(sha, { auth: auth() })).then((bytes) => dataUrlOf(bytes), () => { thumbs.delete(sha); return null; }));
    return thumbs.get(sha);
  };

  function close() { dialog?.remove?.(); dialog = null; editing = null; dropping = null; }

  // ── THE LIBRARY ─────────────────────────────────────────────────
  async function open() {
    close();
    dialog = box('dfpoi-shelf');
    host.append(dialog);
    draw();
    await refresh();
  }
  async function refresh() {
    const r = await act((i) => poiShelf(i));
    if (!r) return;
    if (!r.ok) { say(refusal(r), 'bad'); return; }
    items = r.data.items ?? [];
    draw();
  }
  function draw() {
    if (!dialog || dialog.dataset?.kind === 'keep') return;
    const find = el('input', 'dfpoi-grow');
    find.type = 'search'; find.value = query; find.placeholder = t('poi.library.search', 'Search by name, tag or maker');
    const list = el('div', 'dfpoi-shelf-list');
    find.addEventListener('input', () => { query = find.value; shown = SHELF_PAGE; drawList(list); });
    const only = el('input');
    only.type = 'checkbox'; only.checked = mineOnly;
    only.addEventListener('change', () => { mineOnly = !!only.checked; shown = SHELF_PAGE; drawList(list); });
    const top = el('div', 'dfpoi-row');
    top.append(find, only, el('span', '', t('poi.library.mine', 'Mine')), btn(t('poi.editor.refresh', 'Refresh the list'), () => refresh()), btn(t('poi.editor.cancel', 'Cancel'), () => close()));
    dialog.replaceChildren(el('div', 'dfpoi-h', t('poi.library.title', 'Library')), el('div', 'dfpoi-sub', t('poi.library.hint', 'Models shared by every builder. Place one, then click where it should stand.')), top, list);
    drawList(list);
  }
  function drawList(list) {
    if (!items) { list.replaceChildren(el('div', 'dfpoi-sub', t('poi.library.loading', 'Asking the store...'))); return; }
    const hits = items.filter((it) => (!mineOnly || mine(it)) && shelfMatches(it, query));
    const rows = hits.slice(0, shown).map((it) => (editing?.id === it.id ? editRow(it) : row(it)));
    if (!rows.length) rows.push(el('div', 'dfpoi-sub', items.length ? t('poi.library.none', 'Nothing on the shelf matches.') : t('poi.library.empty', 'The shelf is empty. Keep a model from its inspector, or as you import it.')));
    if (hits.length > shown) rows.push(btn(t('poi.library.more', 'Show more ({n} more)', { n: hits.length - shown }), () => { shown += SHELF_PAGE; drawList(list); }));
    list.replaceChildren(...rows);
  }
  /** An entry's picture box: its initial until its picture comes (or for good, when it has none). */
  function thumbOf(it) {
    const pic = el('div', 'dfpoi-shelf-thumb', (String(it.name || '?').trim()[0] ?? '?').toUpperCase());
    if (it.thumb) {
      thumbUrl(it.thumb).then((url) => {
        if (!url) return;
        const img = el('img');
        img.alt = it.name; img.src = url;
        pic.replaceChildren(img);
      });
    }
    return pic;
  }
  function row(it) {
    const r = el('div', 'dfpoi-shelf-row');
    const words = el('div', 'dfpoi-shelf-text');
    words.append(el('div', 'dfpoi-shelf-name', it.name));
    if (it.tags?.length) words.append(el('div', 'dfpoi-shelf-meta', it.tags.join(' · ')));
    words.append(el('div', 'dfpoi-shelf-meta', t('poi.library.facts', 'by {by} · {parts, plural, one {# part} other {# parts}} · {triangles, plural, one {# triangle} other {# triangles}}', { by: it.by, parts: it.parts, triangles: it.triangles })));
    const acts = el('div', 'dfpoi-shelf-acts');
    acts.append(btn(t('poi.library.place', 'Place'), () => place(it)));
    if (exportGlb) acts.append(btn(t('poi.export.glbShort', 'Save as .glb'), () => saveGlb(it)));
    if (mayChange(it)) {
      acts.append(btn(t('poi.library.change', 'Change...'), () => beginEdit(it)));
      acts.append(btn(dropping === it.id ? t('poi.library.dropSure', 'Take it off the shelf?') : t('poi.library.drop', 'Take off the shelf'), () => drop(it)));
    }
    r.append(thumbOf(it), words, acts);
    return r;
  }
  async function place(it) {
    const at = dialog;
    const r = await act((i) => poiShelfEntry(i, it.id));
    // AUDIT POI U11: the answer is for the library that asked - the builder gone on (a keep dialog, the library closed),
    // nothing is placed and no dialog opened since is closed
    if (dialog !== at) return;
    if (!r) return;
    if (!r.ok) { say(refusal(r), 'bad'); return; }
    const item = r.data.item;
    close();
    editor.placeAsset({ name: item.name, parts: item.parts, lights: item.lights ?? [] }, t('poi.editor.newName', 'New place'));
    say(t('poi.editor.placeModel', 'Click where it stands. Esc to stop.'));
  }
  /** POI-6: an entry's model as a .glb, by the panel's writer. */
  async function saveGlb(it) {
    const r = await act((i) => poiShelfEntry(i, it.id));
    if (!r) return;
    if (!r.ok) { say(refusal(r), 'bad'); return; }
    await exportGlb?.({ name: r.data.item.name, parts: r.data.item.parts, lights: r.data.item.lights ?? [] });
  }
  async function beginEdit(it) {
    const at = dialog;
    const r = await act((i) => poiShelfEntry(i, it.id));
    if (dialog !== at) return;   // AUDIT POI U11: for the library that asked
    if (!r) return;
    if (!r.ok) { say(refusal(r), 'bad'); return; }
    const item = r.data.item;
    editing = { id: it.id, item, name: item.name, tags: (item.tags ?? []).join(', '), about: item.about ?? '' };
    draw();
  }
  function editRow(it) {
    const item = editing.item, typed = editing;
    const r = el('div', 'dfpoi-shelf-row');
    const form = el('div', 'dfpoi-shelf-text');
    // AUDIT POI U11: what is typed is kept with the entry being changed - the list drawn again (a search letter, Mine, Show
    // more, another entry's Take off) drew the row from the entry, and the words typed were gone
    const name = el('input', 'dfpoi-grow'); name.type = 'text'; name.value = typed.name; name.maxLength = POI_LIMITS.name;
    const tags = el('input', 'dfpoi-grow'); tags.type = 'text'; tags.value = typed.tags;
    const about = el('textarea'); about.value = typed.about; about.maxLength = POI_LIMITS.about;
    name.addEventListener('input', () => { typed.name = name.value; });
    tags.addEventListener('input', () => { typed.tags = tags.value; });
    about.addEventListener('input', () => { typed.about = about.value; });
    const save = btn(t('poi.library.save', 'Save'), async () => {
      const next = { ...item, name: lawName(name.value) };
      const tg = tagsOf(tags.value), words = about.value.trim();
      if (tg.length) next.tags = tg; else delete next.tags;
      if (words) next.about = words; else delete next.about;
      const res = await act((i) => poiShelve(i, next));
      if (!res) return;
      if (!res.ok) { say(res.problems?.length ? problemLine(res.problems[0], next) : refusal(res), 'bad'); return; }
      // AUDIT POI U11: this row's change done - another entry's begun meanwhile stays open, its words with it
      if (editing === typed) editing = null;
      say(t('poi.library.changed', 'Changed: {name}.', { name: next.name }));
      await refresh();
    });
    form.append(field(t('poi.editor.name', 'Name'), name), field(t('poi.editor.tags', 'Tags'), tags), el('div', 'dfpoi-row', t('poi.editor.about', 'Description')), about);
    const acts = el('div', 'dfpoi-shelf-acts');
    acts.append(save, btn(t('poi.editor.cancel', 'Cancel'), () => { editing = null; draw(); }));
    r.append(thumbOf(it), form, acts);
    return r;
  }
  async function drop(it) {
    if (dropping !== it.id) { dropping = it.id; draw(); return; }
    dropping = null;
    const r = await act((i) => poiUnshelve(i, it.id));
    if (!r) return;
    if (!r.ok) { say(refusal(r), 'bad'); return; }
    say(t('poi.library.dropped', 'Taken off the shelf: {name}.', { name: it.name }));
    await refresh();
  }

  // ── KEEP IN THE LIBRARY ───────────────────────────────────────────
  /** A problem as one line the builder reads - where, then what. */
  const problemLine = (p, item) => { const where = problemWhere(p.path, item); return where ? `${where}: ${problemText(p)}` : problemText(p); };
  /** A part's mesh: one the caller holds, else fetched by its name and read. */
  const meshOfFor = (held) => async (sha) => {
    if (held?.has(sha)) return held.get(sha);
    const d = decodePoiMesh(await feed.asset(sha, { auth: auth() }));
    return 'error' in d ? null : d.mesh;
  };
  const pictureOf = async (sha) => (decodeImage ? decodeImage(await feed.asset(sha, { auth: auth() })) : null);

  /**
   * Keep a model on the shelf, at once: `{ name, parts, lights?, meshes? }` (`meshes` sha -> a mesh the caller holds
   * decoded - an import's - so none is fetched again) with its words. `{ ok, id?, problems? }`.
   */
  async function keepNow(source, { name = source.name, tags = [], about = '' } = {}) {
    const entry = shelfEntryOf({ id: mintShelfId(rand), name: lawName(name) || t('poi.library.unnamed', 'A model'), about, tags, parts: source.parts, lights: source.lights ?? [] });
    const r = await act((i) => putOnShelf(entry, {
      meshOf: meshOfFor(source.meshes), pictureOf,
      putAsset: (bytes, kind) => poiPutAsset(i, bytes, kind), shelve: (item) => poiShelve(i, item),
    }));
    if (!r) return { ok: false };
    if (!r.ok) {
      say(r.problems?.length ? problemLine(r.problems[0], entry) : refusal(r), 'bad');
      return { ok: false, problems: r.problems ?? [] };
    }
    say(t('poi.library.kept', 'Kept in the library: {name}.', { name: entry.name }));
    if (items) await refresh();
    return { ok: true, id: r.id };
  }
  /** The dialog that asks a model's name, tags and words before keeping it. */
  function keep(source) {
    close();
    dialog = box('dfpoi-shelf');
    dialog.dataset.kind = 'keep';
    const name = el('input', 'dfpoi-grow'); name.type = 'text'; name.value = lawName(source.name); name.maxLength = POI_LIMITS.name;
    const tags = el('input', 'dfpoi-grow'); tags.type = 'text'; tags.placeholder = t('poi.library.tagsHint', 'ruin, stone, small');
    const about = el('textarea'); about.maxLength = POI_LIMITS.about;
    const said = el('div');
    const self = dialog;
    const go = btn(t('poi.library.keep', 'Keep it'), async () => {
      go.disabled = true;
      const r = await keepNow(source, { name: name.value, tags: tagsOf(tags.value), about: about.value });
      go.disabled = false;
      // AUDIT POI U11: the answer closes this dialog - never a keep dialog opened since, and the name typed into it
      if (dialog !== self) return;
      if (r.ok) { close(); return; }
      said.replaceChildren(...(r.problems ?? []).slice(0, 12).map((p) => el('div', 'dfpoi-problem', problemLine(p, source))));
    });
    const acts = el('div', 'dfpoi-row');
    acts.append(go, btn(t('poi.editor.cancel', 'Cancel'), () => close()));
    dialog.append(
      el('div', 'dfpoi-h', t('poi.library.keepTitle', 'Keep in the library')),
      el('div', 'dfpoi-sub', t('poi.library.keepHint', 'Every builder can place it. Its picture is drawn from its parts.')),
      el('div', 'dfpoi-sub', t('poi.library.keepWhat', '{parts, plural, one {# part} other {# parts}}, {lights, plural, one {# light} other {# lights}}', { parts: source.parts.length, lights: source.lights?.length ?? 0 })),
      field(t('poi.editor.name', 'Name'), name), field(t('poi.editor.tags', 'Tags'), tags), el('div', 'dfpoi-row', t('poi.editor.about', 'Description')), about, said, acts,
    );
    host.append(dialog);
  }

  return {
    open: () => open(),
    keep: (source) => keep(source),
    keepNow: (source, words) => keepNow(source, words),
    refresh: () => refresh(),
    close,
    dialog: () => dialog,
    items: () => items,
  };
}
