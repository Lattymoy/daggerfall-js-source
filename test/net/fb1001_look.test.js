// FIELD BUGS 2026-10-01 (3): "Switching textures on houses doesnt stay and resets". HOME-LOOK, the owner painting their
// online home's outside in the "Exterior" tab of the yard's decorator panel (ui/decorPanel.js; `06-Systems/Online-Arc.md`
// HOME-LOOK). Three faults, each reproduced on the real modules first:
//
// LOOK-BUTTONS: the painter's three buttons - "The town's own", "Paint it", "Put back" - stood in a row classed as the
// rent tab's (`dfdecor-rent-actions`), and the decorator's own sheet hides that class in every tab but "Rooms to rent"
// (and, again, in the painter's). So a look could be TRIED on the house - every chip previews it - and never painted:
// leaving the tab or closing the panel put it away, as the law says, and the house wore the town's own again. The
// headless DOM the HOME-LOOK pins press buttons in reads no CSS, so they pressed a button no player could see. Here the
// decorator's real sheet is cascaded over the real panel (a small selector matcher below - its classes, attributes,
// :not, descendants and specificity, which is all DECOR_CSS uses).
//
// LOOK-STALE: the client's registry of a town's homes (systems/online/onlineHomes.js) believed an answer that set out BEFORE a
// write of mine landed - a door's re-ask in flight, or the first paint's own read-back when a second look was painted -
// and the town was then believed for a minute with the old look: the house went back. A forced ask behind such a flight
// was dropped (ASYNC NEVER DROPS); now it is asked after it, and the older answer never lands over the newer write.
//
// LOOK-TRIED: closing the panel put a tried look away on the house but left it in the painter, so the panel opened
// again on "Shown on your house. Paint it to keep it" over a house wearing its painted look. Closing is leaving the tab.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DECOR_CSS } from '../../src/ui/decorPanel.js';
import { createOnlineHomes } from '../../src/systems/online/onlineHomes.js';
import { createHomeYards } from '../../src/scenes/homeYards.js';
import { accountHomes, SESSION_KEY, REFUSALS } from '../../src/net/accountClient.js';
import { homeLookOf } from '../../src/net/homeLaw.js';
import { standService, T0, sessionStorageOf } from '../accountDb.mjs';
import { toolRig, fakeDoc, fakeWin, fakeBlocks, rmb, TOWN, settle, all, chipNamed } from '../decorFakes.mjs';

// ── the decorator's sheet, cascaded ─────────────────────────────────
/** A compound selector's parts: its tag, classes, attributes ([name, value|undefined]), :not()s and pseudo-classes. */
function compound(s) {
  const c = { tag: null, classes: [], attrs: [], nots: [], pseudo: [] };
  const tag = /^([a-z*][a-z0-9-]*)/i.exec(s);
  if (tag) c.tag = tag[1].toLowerCase();
  for (const m of s.slice(tag ? tag[1].length : 0).matchAll(/\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]|:not\(([^)]*)\)|(::?)([\w-]+)(?:\([^)]*\))?/g)) {
    if (m[1]) c.classes.push(m[1]);
    else if (m[2]) c.attrs.push([m[2], m[3]]);
    else if (m[4] != null) c.nots.push(compound(m[4].trim()));
    else c.pseudo.push(m[5] + m[6]);
  }
  return c;
}
/** A selector as its compounds, each with the combinator that joins it to the one before. */
const parseSelector = (s) => s.replace(/\s*>\s*/g, ' > ').trim().split(/\s+/).reduce((out, tok) => {
  if (tok === '>') out.pending = '>';
  else { out.push({ c: compound(tok), comb: out.pending ?? ' ' }); out.pending = null; }
  return out;
}, /** @type {any} */ ([]));
const specOf = (c) => (c.classes.length + c.attrs.length + c.pseudo.filter((p) => !p.startsWith('::')).length) * 100 + (c.tag && c.tag !== '*' ? 1 : 0)
  + c.nots.reduce((n, x) => n + specOf(x), 0);
/** A fake node's attribute as the browser reads it: `data-*` off its dataset, `disabled` off the property. */
function attrOf(n, name) {
  if (name.startsWith('data-')) { const v = n.dataset?.[name.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())]; return v == null ? null : String(v); }
  if (name === 'disabled') return n.disabled ? '' : null;
  return n.attrs?.[name] ?? null;
}
function matchCompound(c, n) {
  if (c.tag && c.tag !== '*' && String(n.tag).toLowerCase() !== c.tag) return false;
  const cls = String(n.className ?? '').split(/\s+/);
  if (!c.classes.every((k) => cls.includes(k))) return false;
  if (!c.attrs.every(([k, v]) => { const a = attrOf(n, k); return a !== null && (v === undefined || a === v); })) return false;
  if (c.nots.some((x) => matchCompound(x, n))) return false;
  return c.pseudo.length === 0;   // a state (:hover) is off, a pseudo-element (::before) is not the element
}
function matchPath(parts, path, i, k) {
  if (!matchCompound(parts[k].c, path[i])) return false;
  if (k === 0) return true;
  if (parts[k].comb === '>') return i > 0 && matchPath(parts, path, i - 1, k - 1);
  for (let j = i - 1; j >= 0; j--) if (matchPath(parts, path, j, k - 1)) return true;
  return false;
}
/** Every rule of DECOR_CSS that sets `display`, in the sheet's order (an @media's rules read as standing - none of
 *  the decorator's sets display). */
const DISPLAY_RULES = [...DECOR_CSS.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap((m) => {
  const d = /(?:^|;)\s*display\s*:\s*([a-z-]+)/.exec(m[2]);
  if (!d) return [];
  return m[1].split(',').map((s) => s.trim()).filter((s) => s && !s.startsWith('@')).map((sel) => {
    const parts = parseSelector(sel);
    return { sel, parts, spec: parts.reduce((n, p) => n + specOf(p.c), 0), value: d[1] };
  });
}).map((r, order) => ({ ...r, order }));
/** The `display` the sheet gives the last node of `path` (the highest specificity, then the later rule), or null. */
function displayOf(path) {
  let best = null;
  for (const r of DISPLAY_RULES) {
    if (!matchPath(r.parts, path, path.length - 1, r.parts.length - 1)) continue;
    if (!best || r.spec > best.spec || (r.spec === best.spec && r.order > best.order)) best = r;
  }
  return best?.value ?? null;
}
/** The path from the document's body to `target`, or null. */
function pathTo(n, target, up = []) {
  const here = [...up, n];
  if (n === target) return here;
  for (const c of n.children ?? []) { const p = pathTo(c, target, here); if (p) return p; }
  return null;
}
/** Whether the decorator's sheet draws `target` at all - neither it nor anything round it `display: none`. */
function shown(doc, target) {
  const path = pathTo(doc.body, target);
  assert.ok(path, 'in the document');
  for (let i = 1; i <= path.length; i++) if (displayOf(path.slice(0, i)) === 'none') return false;
  return true;
}
const btnNamed = (root, label) => all(root, 'dfdecor-btn').find((b) => b.textContent === label);
const panelOf = (doc) => doc.body.children.find((c) => c.className === 'dfdecor');

test('LOOK-BUTTONS (sanity): the cascade reads the sheet as a browser does - the panel drawn only open, a tab\'s own rows drawn and the others\' not, a :not() honoured', async () => {
  const door = { current: null, season: 0, records: () => null, preview() {}, commit: async () => ({ ok: true }) };
  const r = toolRig({ room: { kind: 'home', yard: true, where: 'Your yard', mapId: 7, buildingKey: 300 }, look: () => door });
  r.frame();
  const root = panelOf(r.doc) ?? null;
  assert.equal(r.tool.openPanel(), true);
  for (let i = 0; i < 4; i++) { r.frame({ overlayUp: true }); await settle(); }
  const panel = panelOf(r.doc);
  assert.ok(root === null || root === panel);
  assert.equal(shown(r.doc, panel), true, 'open: drawn (.dfdecor[data-state="open"] over .dfdecor)');
  const card = all(panel, 'dfdecor-card')[0];
  assert.equal(shown(r.doc, btnNamed(panel, 'Place')), true, 'the catalogue\'s Place');
  assert.equal(shown(r.doc, all(panel, 'dfdecor-paint-actions')[0]), false, 'the painter\'s rows, out of the painter (:not)');
  assert.equal(shown(r.doc, btnNamed(panel, 'Offer to rent')), false, 'the rent\'s rows, out of the rent tab');
  chipNamed(panel, 'Exterior').fire('click');
  r.frame({ overlayUp: true });
  assert.equal(card.dataset.mode, 'paint');
  assert.equal(shown(r.doc, btnNamed(panel, 'Place')), false, 'no Place in the painter');
  assert.equal(shown(r.doc, all(panel, 'dfdecor-paint-actions')[0]), true, 'the painter\'s rows');
  assert.equal(shown(r.doc, btnNamed(panel, 'Offer to rent')), false, 'still no rent');
  r.tool.close();
  assert.equal(shown(r.doc, panel), false, 'closed: not drawn');
});

test('LOOK-BUTTONS: in the painter its three buttons - "The town\'s own", "Paint it", "Put back" - are DRAWN, in a row of their own (laid out as a row), never under the rent tab\'s class the sheet hides everywhere else; a tried look can be painted (mutant: the row classed as the rent\'s again)', async () => {
  const calls = [];
  const door = { current: null, season: 0, records: () => null, preview: (l) => calls.push(['preview', l]), commit: async (l) => { calls.push(['commit', l]); return { ok: true }; } };
  const r = toolRig({ room: { kind: 'home', yard: true, where: 'Your yard', mapId: 7, buildingKey: 300 }, look: () => door });
  r.frame();
  assert.equal(r.tool.openPanel(), true);
  for (let i = 0; i < 4; i++) { r.frame({ overlayUp: true }); await settle(); }
  const panel = panelOf(r.doc);
  chipNamed(panel, 'Exterior').fire('click');
  r.frame({ overlayUp: true });
  all(panel, 'dfdecor-row').find((x) => x.dataset.key === 'walls').fire('click');
  chipNamed(panel, 'Manor').fire('click');
  assert.deepEqual(calls.at(-1), ['preview', { walls: { set: 'manor', climate: 'temperate' } }], 'tried on the house');
  const paint = btnNamed(panel, 'Paint it');
  assert.equal(paint.disabled, false, 'it differs from the house: paintable');
  for (const label of ["The town's own", 'Paint it', 'Put back']) assert.equal(shown(r.doc, btnNamed(panel, label)), true, `${label} is drawn in the painter`);
  const row = pathTo(r.doc.body, paint).at(-2);
  assert.ok(!String(row.className).split(/\s+/).includes('dfdecor-rent-actions'), 'not the rent tab\'s row');
  assert.equal(displayOf(pathTo(r.doc.body, row)), 'flex', 'a row of buttons, as the rent\'s are laid out');
  paint.fire('click');
  await settle(); await settle();
  assert.deepEqual(calls.find((c) => c[0] === 'commit')?.[1], { walls: { set: 'manor', climate: 'temperate' } }, 'painted');
  // out of the painter, its row goes with it
  chipNamed(panel, 'Catalog').fire('click');
  assert.equal(shown(r.doc, btnNamed(panel, 'Paint it')), false);
});

/** The yard's decorator on the real registry over the real service: Olga's realm character's home 300 in town 7, her
 *  yard standing (no pieces), the world's painter's preview recorded. */
async function paintRig(t) {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  const homes = createOnlineHomes({ api: accountHomes({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, owner) }), character: () => o.character });
  assert.equal(await homes.ensure(7), true);
  const previews = [];
  const said = [];
  const doc = fakeDoc();
  const homeFrames = new Map([[300, { at: [10, 0, 10], box: [6, 0, 7, 14, 6, 13] }]]);
  const built = new Map([['0,0', { px: 0, py: 0, homeTown: 7, homeFrames, homeRegion: 17 }]]);
  const yards = createHomeYards({
    api: { yards: async () => ({ ok: true, data: { yards: [] } }) }, homes, built: () => built, translation: () => [0, 0, 0],
    feet: () => [18, 0, 10], outside: () => true, eye: () => [18, 1.6, 10],
    collider: () => ({ addMesh() {}, removeBucket() {}, surfaceHit: () => null }),
    meshes: { getGpuMesh: async (id) => id, cpuModels: new Map() }, renderer: { drawMesh() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    getTexture: async () => ({ recordCount: 6 }), uploadRecord() {},
    scanDeps: () => ({ blocks: fakeBlocks([{ type: TOWN, block: rmb([41000]) }]), isTownBlock: (x) => x === TOWN, modelRadius: () => 0.8, flatRadius: async () => 0.2 }),
    character: () => o.character, realm: () => null,
    wallet: () => ({ gold: 0, pay() {}, credit() {} }), regionOf: () => 17,
    doc, win: fakeWin(), canvas: null, touch: false, actionOf: () => null, locked: () => true, cursorOff() {}, stick: () => null,
    say: (l) => said.push(l), refusal: (w) => REFUSALS[w] ?? w, openSlot() {}, now: () => 0,
    look: { preview: (mapId, bk, look) => previews.push([mapId, bk, look]), season: () => 0 },
  });
  const cam = { pos: [18, 1.6, 10], yaw: 0, pitch: 0 };
  const frame = async (overlayUp = false) => { yards.frame({ dt: 1, cam, overlayUp }); await settle(); await settle(); };
  for (let i = 0; i < 3; i++) await frame();
  assert.ok(yards.here(), 'standing on her own lot');
  return { svc, owner, o, homes, yards, doc, previews, said, frame };
}

test('LOOK-BUTTONS end to end: on her own lot the owner opens the decorator, tries Manor walls in the Exterior tab, presses the "Paint it" she can SEE - and the service keeps the look, her registry wears it, the tried look is put away over it, and anyone reading the town is told it (mutant: the row classed as the rent\'s)', async (t) => {
  const r = await paintRig(t);
  assert.equal(r.yards.tool().openPanel(), true);
  await r.frame(true);
  const panel = panelOf(r.doc);
  chipNamed(panel, 'Exterior').fire('click');
  await r.frame(true);
  all(panel, 'dfdecor-row').find((x) => x.dataset.key === 'walls').fire('click');
  chipNamed(panel, 'Swamp').fire('click');
  chipNamed(panel, 'Manor').fire('click');
  const tried = { walls: { set: 'manor', climate: 'swamp' } };
  assert.deepEqual(r.previews.at(-1), [7, 300, tried], 'tried on her house');
  const paint = btnNamed(panel, 'Paint it');
  assert.equal(shown(r.doc, paint), true, 'the button she presses is drawn');
  paint.fire('click');
  // The click starts a real asynchronous service write; a frame count is not its completion.
  const paintedBy = performance.now() + 5000;
  while (!r.said.includes('Your house is painted.') && performance.now() < paintedBy) await r.frame(true);
  assert.ok(r.said.includes('Your house is painted.'), r.said.join(' / '));
  assert.deepEqual(r.homes.homeAt(7, 300).look, tried, 'her registry wears it');
  assert.deepEqual(r.previews.at(-1), [7, 300, undefined], 'the tried look put away - the registry\'s is the one drawn');
  const g = await r.svc.guest();
  const town = await r.svc.call('/v1/homes/town', { mapId: 7 }, g.secret);
  assert.deepEqual(town.body.homes.find((h) => h.buildingKey === 300).look, tried, 'the service keeps it, for everyone');
  // the panel, read again, says nothing is tried: it is the house's look now
  await r.frame(true);
  assert.equal(btnNamed(panel, 'Paint it').disabled, true);
  // leaving the tab after painting never takes the painted look away
  chipNamed(panel, 'Catalog').fire('click');
  await r.frame(true);
  assert.deepEqual(r.homes.homeAt(7, 300).look, tried);
});

// ── LOOK-STALE ─────────────────────────────────────────────────────
/** The registry over the real service through a network that can HOLD a town's answer: the service answers the read
 *  when it is sent (its state as it stands then), and the answer reaches the page when `release()` lets it. */
async function staleRig(t) {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  assert.equal(o.status, 200);
  const held = [];
  let hold = false;
  let townReads = 0;
  const fetch = async (u, i) => {
    const holding = hold;
    const res = await svc.fetch(u, i);
    if (String(u).endsWith('/v1/homes/town')) {
      townReads++;
      if (holding) await new Promise((go) => held.push(go));
    }
    return res;
  };
  const homes = createOnlineHomes({ api: accountHomes({ fetch, storage: sessionStorageOf(SESSION_KEY, owner) }), character: () => o.character, now: () => clock });
  const until = async (fn) => { for (let i = 0; i < 50 && !fn(); i++) await settle(); };
  return {
    svc, homes, held, until, reads: () => townReads,
    hold: (v) => { hold = v; },
    release: () => { for (const go of held.splice(0)) go(); },
    tick: (ms) => { clock += ms; },
  };
}
const MANOR = { walls: { set: 'manor', climate: 'swamp' } };
const DESERT_ROOF = { roof: { climate: 'desert', record: 1 } };

test('LOOK-STALE: a door\'s re-ask of the town in flight when my paint lands - its answer, read before the paint, never lands over it; the town is asked again after it and the house keeps its new look past the minute\'s belief (mutants: the older answer believed; the forced ask dropped behind the flight)', async (t) => {
  const r = await staleRig(t);
  await r.homes.ensure(7);
  assert.equal(r.homes.homeAt(7, 300).look, null);
  r.tick(61_000);   // the town's minute is up - a door's hover asks again...
  r.hold(true);
  const hover = r.homes.ensure(7);
  await r.until(() => r.held.length === 1);
  assert.equal(r.held.length, 1, 'the service answered the town as it stood (the town\'s own), the answer still on its way');
  r.hold(false);
  const w = await r.homes.setLook(7, 300, MANOR);   // ...and the paint lands meanwhile
  assert.equal(w.ok, true);
  assert.deepEqual(r.homes.homeAt(7, 300).look, MANOR, 'shown at once');
  const readsBefore = r.reads();
  const v = r.homes.version();
  r.hold(true);   // the ask that follows is held in its turn...
  r.release();   // ...while the older answer lands
  await hover;
  await r.until(() => r.held.length === 1);
  assert.ok(r.reads() > readsBefore, 'the town asked again AFTER the flight (coalesced, never dropped)');
  assert.deepEqual(r.homes.homeAt(7, 300).look, MANOR, 'the older answer never lands over the newer look - not even until the next answer');
  assert.equal(r.homes.version(), v, 'nothing repainted by it');
  r.hold(false);
  r.release();
  for (let i = 0; i < 6; i++) await settle();
  assert.deepEqual(r.homes.homeAt(7, 300).look, MANOR, 'and the next answer says the same');
  r.tick(30_000);
  await r.homes.ensure(7);
  assert.deepEqual(r.homes.homeAt(7, 300).look, MANOR, 'and believed so for the minute');
});

test('LOOK-STALE: two looks painted one after the other - the first paint\'s read-back, answered before the second landed, never puts the first look back over the second (mutant: the older answer believed)', async (t) => {
  const r = await staleRig(t);
  await r.homes.ensure(7);
  r.hold(true);
  assert.equal((await r.homes.setLook(7, 300, MANOR)).ok, true);
  await r.until(() => r.held.length === 1);
  assert.equal(r.held.length, 1, 'the first paint\'s read-back, answered MANOR, on its way');
  r.hold(false);
  assert.equal((await r.homes.setLook(7, 300, DESERT_ROOF)).ok, true);
  const readsBefore = r.reads();
  r.hold(true);
  r.release();   // the first paint's read-back lands, the second's ask held behind it
  await r.until(() => r.held.length === 1);
  assert.ok(r.reads() > readsBefore);
  assert.deepEqual(r.homes.homeAt(7, 300).look, DESERT_ROOF, 'the first look never comes back, not even for a round trip');
  r.hold(false);
  r.release();
  for (let i = 0; i < 6; i++) await settle();
  assert.deepEqual(r.homes.homeAt(7, 300).look, DESERT_ROOF, 'the second look stays');
  const g = await r.svc.guest();
  assert.deepEqual((await r.svc.call('/v1/homes/town', { mapId: 7 }, g.secret)).body.homes[0].look, homeLookOf(DESERT_ROOF), 'as the service keeps it');
  // an ask that set out AFTER my writes is believed as ever: the town moved on the service, and the page hears it
  r.svc.env.DB._raw.prepare('UPDATE homes SET entry = ? WHERE map_id = 7 AND building_key = 300').run('public');
  await r.homes.ensure(7, { force: true });
  assert.equal(r.homes.homeAt(7, 300).entry, 'public', 'a fresh answer believed');
});

test('LOOK-STALE: a forced ask behind a flight that set out AFTER my last write is that flight - one ask, no second (mutant: every forced ask chained)', async (t) => {
  const r = await staleRig(t);
  await r.homes.ensure(7);
  r.hold(true);
  const a = r.homes.ensure(7, { force: true });
  const b = r.homes.ensure(7, { force: true });
  assert.equal(b, a, 'the same flight');
  await r.until(() => r.held.length === 1);
  r.hold(false);
  const n = r.reads();
  r.release();
  await a;
  for (let i = 0; i < 6; i++) await settle();
  assert.equal(r.reads(), n, 'no second ask');
});

// ── LOOK-TRIED ─────────────────────────────────────────────────────
test('LOOK-TRIED: a look tried and the panel closed is put away in the painter too - opened again, the Exterior tab reads the house\'s own look, "Paint it" has nothing to paint and nothing says it is tried on the house (mutant: the tried look kept past the close)', async () => {
  const calls = [];
  const door = { current: null, season: 0, records: () => null, preview: (l) => calls.push(['preview', l]), commit: async (l) => { calls.push(['commit', l]); return { ok: true }; } };
  const r = toolRig({ room: { kind: 'home', yard: true, where: 'Your yard', mapId: 7, buildingKey: 300 }, look: () => door });
  r.frame();
  assert.equal(r.tool.openPanel(), true);
  for (let i = 0; i < 4; i++) { r.frame({ overlayUp: true }); await settle(); }
  const panel = panelOf(r.doc);
  chipNamed(panel, 'Exterior').fire('click');
  r.frame({ overlayUp: true });
  all(panel, 'dfdecor-row').find((x) => x.dataset.key === 'walls').fire('click');
  chipNamed(panel, 'Manor').fire('click');
  assert.equal(btnNamed(panel, 'Paint it').disabled, false);
  btnNamed(panel, 'Close').fire('click');
  assert.deepEqual(calls.at(-1), ['preview', undefined], 'the house put it away');
  assert.equal(r.tool.openPanel(), true);
  r.frame({ overlayUp: true });
  const card = all(panel, 'dfdecor-card')[0];
  assert.equal(card.dataset.mode, 'paint', 'opened again on the painter');
  const walls = all(panel, 'dfdecor-row').find((x) => x.dataset.key === 'walls');
  assert.equal(all(walls, 'dfdecor-row-sub')[0].textContent, 'The town\'s own', 'the house\'s own look, as it wears it');
  assert.equal(all(walls, 'dfdecor-row-price')[0].textContent, '', 'nothing changed');
  assert.equal(btnNamed(panel, 'Paint it').disabled, true, 'nothing to paint');
  assert.equal(all(panel, 'dfdecor-pick-why')[0].textContent, '', 'and nothing says a look is tried on the house');
});
