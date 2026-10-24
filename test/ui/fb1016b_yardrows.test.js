// YARD-ROWS (FIELD BUGS 2026-10-16b, bible/01-Overview/bugs/Field-Bugs-2026-10-16b.md; the Discord: "Shipyard formatting is
// cooked" - "The text here may need a bit of work, as you can see!"). A shipyard row was a three-track grid whose acts'
// track was `auto`: grid layout grows an auto track to its content's max-content before the fr tracks get a pixel, so a
// fleet row's four presses and her name box took every free pixel and her words stood a word a line, 400-700 px tall
// (measured in Chromium, tools/shipyardWindowProbe.mjs - this file holds the CSS's law; the probe measures it). The acts'
// track is held to fit-content, and a fleet row carries her acts on a line of their own under her words, as the Holdings
// card does (ui/fleetPage.js shipCard).
import { byClass } from '../chargenDom.mjs';   // the suite's minimal DOM (its side effect: the globals)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHIPYARD_CSS, mountShipyardWindow } from '../../src/ui/shipyardWindow.js';

/** A CSS rule's body by its exact selector (the first, outside @media unless asked), or null. */
const ruleOf = (css, selector, { media = false } = {}) => {
  const at = css.indexOf('@media');
  const scope = media ? css.slice(at) : css.slice(0, at < 0 ? undefined : at);
  const m = new RegExp(`(^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(scope);
  return m ? m[2] : null;
};
const tracks = (body) => /grid-template-columns:\s*([^;]+);/.exec(body ?? '')?.[1].trim() ?? null;

test('YARD-ROWS: no shipyard row track sizes to its content\'s max-content - the acts\' track is fit-content; a fleet row is two tracks with her acts a line of their own; the phone\'s one column still wins after both', () => {
  const row = tracks(ruleOf(SHIPYARD_CSS, '.dfyard-row'));
  assert.equal(row, 'minmax(110px, 1fr) minmax(0, 1.6fr) fit-content(40%)');
  assert.ok(!/(^|\s)(auto|max-content)(\s|$)/.test(row), 'no bare auto or max-content track');
  assert.equal(tracks(ruleOf(SHIPYARD_CSS, '.dfyard-fleetrow')), 'minmax(110px, 1fr) minmax(0, 1.6fr)');
  assert.match(ruleOf(SHIPYARD_CSS, '.dfyard-fleetrow .dfyard-acts'), /grid-column:\s*1 \/ -1;/);
  assert.equal(tracks(ruleOf(SHIPYARD_CSS, '.dfyard-row', { media: true })), '1fr', 'a phone: one column');
  assert.ok(SHIPYARD_CSS.indexOf('.dfyard-fleetrow {') < SHIPYARD_CSS.indexOf('@media'), 'the fleet row\'s rules before the phone\'s, so its one column wins');
});

test('YARD-ROWS: the mounted fleet page - every ship\'s row a fleet row, her presses and name box in its acts; the other pages\' rows keep three tracks', () => {
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);
  const fleet = [
    { uid: 801, label: 'Boat', name: 'Boat', hullName: 'Large Boat', where: 'laidup', port: 'Aldwall Rock', worth: 3546, offer: 431, upgrades: {}, sell: null, can: { summon: null, away: 'This ship is already laid up' } },
    { uid: 802, label: 'Borrowed Wings', name: 'Borrowed Wings', hullName: 'Carrack', where: 'laidup', port: 'Aldwall Rock', worth: 65500, offer: 23002, upgrades: { hold: 3 }, sell: null, can: { summon: null, away: 'This ship is already laid up' } },
  ];
  const hands = [{ name: 'Bram Holloway', role: 'Bosun', fights: 3, boardings: 1 }];
  let page = 'fleet';
  const view = mountShipyardWindow(host, {
    page,
    model: () => ({ page, uid: 802, title: "Woodsly's Shipyard", keeper: 'Odwolyn Woodsly', gold: 11235, crewName: "Ashcroft's Crew Hall", crewmaster: 'Ashcroft', fleet, ship: { label: 'Borrowed Wings' }, choices: [], hands, room: { ok: true }, recruits: [] }),
    act: () => ({ ok: true, text: '' }),
  });
  try {
    const rows = byClass(host, 'dfyard-row');
    assert.deepEqual(rows.map((r) => r.getAttribute('data-uid')), ['801', '802']);
    for (const r of rows) {
      assert.ok(r.className.split(' ').includes('dfyard-fleetrow'), 'a fleet row');
      const acts = byClass(r, 'dfyard-acts')[0];
      assert.deepEqual(byClass(acts, 'dfnaval-btn').map((b) => b.textContent), ['Sell', 'Bring here', 'Lay up', 'Rename']);
      assert.equal(byClass(acts, 'dfyard-name').length, 1, 'her name box among her acts');
    }
  } finally { view?.close?.(); host.remove(); }
  const host2 = globalThis.document.createElement('div');
  globalThis.document.body.append(host2);
  page = 'crew';
  const crew = mountShipyardWindow(host2, {
    page,
    model: () => ({ page, uid: 802, title: "Woodsly's Shipyard", keeper: 'Odwolyn Woodsly', gold: 11235, crewName: "Ashcroft's Crew Hall", crewmaster: 'Ashcroft', fleet, ship: { label: 'Borrowed Wings' }, choices: [], hands, room: { ok: true }, recruits: [] }),
    act: () => ({ ok: true, text: '' }),
  });
  try {
    const rows = byClass(host2, 'dfyard-row');
    assert.ok(rows.length > 0);
    assert.ok(rows.every((r) => !r.className.split(' ').includes('dfyard-fleetrow')), 'a hand\'s row keeps three tracks');
  } finally { crew?.close?.(); host2.remove(); }
});

test('YARD-ROWS AUDIT: the swap picker among a recruit\'s presses is capped (min-width 0, a max-width in em, never 100%: a select\'s own width is its longest option\'s, so a percentage cannot hold it) - a long hand\'s name ("in place of Charlotte Montclair, First Mate") never widens the presses\' fit-content track past its 40%; a hand\'s own post keeps its track\'s width', () => {
  const capped = ruleOf(SHIPYARD_CSS, '.dfyard-acts .dfyard-post');
  assert.match(capped ?? '', /min-width:\s*0;/);
  assert.match(capped ?? '', /max-width:\s*\d+(\.\d+)?em;/, 'an em cap');
  assert.ok(!/(max|min)-width/.test(ruleOf(SHIPYARD_CSS, '.dfyard-post') ?? ''), 'the hand\'s post: no cap of its own');
});
