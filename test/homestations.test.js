// HOME-STATIONS (2026-09-27, Discord - Tabitha: "CRAFTABLE / PURCHASABLE CRAFT / GUILD STATIONS [Spellmaking, Alchemy,
// Enchanting] FOR HOMES / SHIPS").
//
// A PLACED PIECE MAY SERVE A CRAFT. In the owner's own home, house or ship, a placed piece (not one's own item, not one
// that holds things) is made an Alchemy, a Spellmaking or an Enchanting station for a licence paid once
// (net/decorLaw.js DECOR_STATION_FEES - nothing comes back), and pressed it opens that craft's own maker - the guild
// service's window (worldModes.js useDecorStation over openServiceFlow). The piece carries `station` through the law,
// the save and the account service; an online home whose service does not keep it yet is paid nothing. Driven over the
// decorator's own fakes (test/decorFakes.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decorPlaceOf, decorPieceOf, DECOR_STATIONS, DECOR_STATION_FEES, DECOR_STATION_NAMES, DECOR_STATION_SERVICES } from '../src/net/decorLaw.js';
import { DECOR_STATION_UNKEPT, DECOR_STATION_GOLD_WENT } from '../src/scenes/decorTool.js';
import { decorStationWords, decorPlacedSub } from '../src/ui/decorPanel.js';
import { settle, all, one, rows, toolRig, placeFrom } from './decorFakes.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const panelOf = (rig) => rig.doc.body.children.find((c) => c.className === 'dfdecor');
const btn = (root, label) => all(root, 'dfdecor-btn').find((b) => (typeof label === 'string' ? b.textContent === label : label.test(b.textContent)));
const roomTab = (root) => all(root, 'dfdecor-chip').find((c) => /^In this room/.test(c.textContent));
async function placedOne(rig, key = 'm41000') {
  await placeFrom(rig, key);
  rig.frame();
  assert.equal(await rig.tool.commit(), true);
  rig.tool.back();
  return rig.standing.at(-1);
}
function choose(rig, id) {
  rig.frame({ overlayUp: true });   // the tool hands the panel the room as it now stands
  const root = panelOf(rig);
  if (one(root, 'dfdecor-card').dataset.mode !== 'room') roomTab(root).fire('click');
  rows(root).find((r) => r.dataset.key === id).fire('click');
  return root;
}
const PLACE = Object.freeze({ pos: [1, 0, 2], rot: [90, 0, 0], scale: 1, light: null, storage: false, paid: 120 });

test('HOME-STATIONS the law: a piece serves one of three crafts, carried only when it serves one; a craft it does not know, a piece that holds things, and one\'s own item serve none (mutants: any word taken; storage and a station together; the key always written)', () => {
  assert.deepEqual([...DECOR_STATIONS], ['alchemy', 'spells', 'enchant']);
  assert.deepEqual({ ...DECOR_STATION_FEES }, { alchemy: 50000, spells: 100000, enchant: 200000 });   // STATION-FEES: ten times the first pass
  assert.deepEqual({ ...DECOR_STATION_SERVICES }, { alchemy: 'guildServicePotionMaker', spells: 'guildServiceSpellMaker', enchant: 'guildServiceItemMaker' });
  assert.equal(DECOR_STATION_NAMES.spells, 'Spellmaking station');
  assert.equal(decorPlaceOf({ ...PLACE, station: 'alchemy' }).station, 'alchemy');
  assert.equal('station' in decorPlaceOf(PLACE), false, 'a piece that serves no craft reads as it always did');
  assert.equal('station' in decorPlaceOf({ ...PLACE, station: null }), false);
  assert.equal(decorPlaceOf({ ...PLACE, station: 'smithing' }), null);
  assert.equal(decorPlaceOf({ ...PLACE, station: 'spells', storage: true }), null, 'one press, one thing it does');
  assert.ok(decorPieceOf({ id: 'p1', model: 41000, ...PLACE, station: 'enchant' }));
  assert.equal(decorPieceOf({ id: 'p2', item: { t: 1, g: 7 }, flat: [205, 1], ...PLACE, paid: 0, station: 'enchant' }), null, 'one\'s own item serves no craft');
});

test('HOME-STATIONS the tool and the panel: a placed piece made a station for its licence, said in the room, the chooser cycling the craft free; short of the gold, refused in words and nothing paid; unmade, nothing back; one that holds things is no station, and a station holds nothing (mutants: the licence unpaid; paid short; a refund on unmaking)', async () => {
  const rig = toolRig({ gold: 300_000 });
  const chair = await placedOne(rig);
  const paidBefore = rig.w.paid.length;
  let root = choose(rig, chair.id);
  assert.equal(btn(root, /^Station:/).textContent, 'Station: Alchemy >');
  assert.equal(btn(root, /^Make station/).textContent, 'Make station - 50,000 gold');
  btn(root, /^Make station/).fire('click');
  await settle();
  assert.equal(rig.standing[0].station, 'alchemy');
  assert.deepEqual(rig.w.paid.slice(paidBefore), [50000], 'the licence, once');
  assert.match(rig.said.at(-1), /: Alchemy station\.$/);
  root = choose(rig, chair.id);
  assert.equal(btn(root, /^Unmake station/).textContent, 'Unmake station (nothing back)', 'the chosen station\'s own act');
  assert.equal(btn(root, /^Holds things/).disabled, true, 'a station holds nothing');
  assert.match(decorPlacedSub({ piece: rig.standing[0], holds: false }), /alchemy station$/);
  // the chooser cycles free; a second craft is its own licence (AUDIT S6: and says the first one goes)
  btn(root, /^Station:/).fire('click');
  assert.equal(btn(root, /^Station:/).textContent, 'Station: Spellmaking >');
  assert.equal(btn(root, /^Change station/).textContent, 'Change station - 100,000 gold (no refund)');
  assert.equal(rig.w.paid.length, paidBefore + 1, 'choosing is free');
  btn(root, /^Change station/).fire('click');
  await settle();
  assert.deepEqual([rig.standing[0].station, rig.w.paid.at(-1)], ['spells', 100000]);
  // unmade: nothing back (AUDIT S4: asked twice)
  root = choose(rig, chair.id);
  const credited = rig.w.credited.length;
  btn(root, /^Unmake station/).fire('click');
  await settle();
  assert.equal(rig.standing[0].station, 'spells', 'one press arms');
  btn(root, /^Press again to unmake/).fire('click');
  await settle();
  assert.equal(rig.standing[0].station, undefined);
  assert.equal(rig.w.credited.length, credited, 'the licence is not refunded');
  assert.match(rig.said.at(-1), /is no longer a station\.$/);
  // short of the gold: in words, nothing paid, nothing changed
  rig.w.gold = 100;
  root = choose(rig, chair.id);
  btn(root, /^Station:/).fire('click');   // the offer stayed on the last craft made (Spellmaking): one on is Enchanting
  assert.equal(btn(root, /^Station:/).textContent, 'Station: Enchanting >');
  const paidNow = rig.w.paid.length;
  btn(root, /^Make station/).fire('click');
  await settle();
  assert.equal(rig.standing[0].station, undefined);
  assert.equal(rig.w.paid.length, paidNow);
  assert.match(rig.said.at(-1), /^Enchanting station: 200,000 gold, and you have not that much\.$/);
  // a piece that holds things is no station
  root = choose(rig, chair.id);
  btn(root, /^Holds things/).fire('click');
  await settle();
  root = choose(rig, chair.id);
  assert.equal(rig.standing[0].storage, true);
  assert.equal(btn(root, /^Make station/).disabled, true);
  assert.deepEqual(decorStationWords({ station: 'enchant' }, 'enchant'), { pick: 'Station: Enchanting >', act: 'Unmake station (nothing back)', what: 'arm' });
  assert.deepEqual(decorStationWords({ station: 'enchant' }, 'enchant', true), { pick: 'Station: Enchanting >', act: 'Press again to unmake - nothing back', what: 'station:none' });
});

test('HOME-STATIONS an online home: the account service first - a station it keeps is paid after its answer; one whose service drops the craft (a service from before this) is said and paid nothing (mutants: paid before the answer; paid for a dropped craft)', async () => {
  let keeps = true;
  const svc = {
    async place(a) { return { ok: true, data: { piece: a.piece } }; },
    async move(a) { const piece = { ...rig.standing.find((p) => p.id === a.id), ...a.place }; if (!keeps) delete piece.station; return { ok: true, data: { piece } }; },
    async remove(a) { return { ok: true, data: { piece: rig.standing.find((p) => p.id === a.id) } }; },
  };
  const rig = toolRig({ room: { kind: 'home', where: 'Your home', mapId: 77, buildingKey: 9 }, homeDecor: svc, gold: 300_000 });
  const chair = await placedOne(rig);
  keeps = false;
  let root = choose(rig, chair.id);
  const paid = rig.w.paid.length;
  btn(root, /^Make station/).fire('click');
  await settle();
  assert.equal(rig.w.paid.length, paid, 'nothing paid for a craft the service did not keep');
  assert.equal(rig.said.at(-1), DECOR_STATION_UNKEPT);
  assert.equal(rig.standing[0].station, undefined);
  keeps = true;
  root = choose(rig, chair.id);
  btn(root, /^Make station/).fire('click');
  await settle();
  assert.deepEqual([rig.standing[0].station, rig.w.paid.at(-1)], ['alchemy', 50000]);
});

test('HOME-STATIONS the room and the service: a station pressed opens its craft\'s maker for its owner alone, through the guild service\'s own door; the account service writes the craft with the place (mutants: the station never pressed; any visitor served; the craft never stored)', () => {
  const M = src('src/scenes/worldModes.js');
  assert.match(M, /if \(piece\?\.station\) \{ useDecorStation\(piece\); return; \}/);
  const use = M.slice(M.indexOf('  function useDecorStation(piece) {'), M.indexOf('  function useDecorStation(piece) {') + 900);
  assert.match(use, /if \(!decorOwnerHere\(\)\) \{/, 'the owner\'s alone');
  assert.match(use, /openServiceFlow\(DECOR_STATION_SERVICES\[piece\.station\], \{ guild: null, memberships: null, store: null, rows, route: null \}\)/);
  assert.match(src('server-account/src/decor.js'), /const placeJson = \(\{ pos, rot, scale, light, storage, paid, station \}\) => JSON\.stringify\(\{ pos, rot, scale, light, storage, paid, \.\.\.\(station \? \{ station \} : \{\}\) \}\);/);
});

// ─── AUDIT (the batch's audit, agent E) ────────────────────────────────────────────────────────────────────────────

const onlineRig = (gold, hold = false) => {
  const held = [];
  const sent = [];
  // the service keeps what it is SENT: a move's place is the piece's whole place, its craft included or not
  const answer = (a) => { const { station, ...was } = rig.standing.find((p) => p.id === a.id); return { ok: true, data: { piece: { ...was, ...a.place } } }; };
  const svc = {
    async place(a) { return { ok: true, data: { piece: a.piece } }; },
    move(a) { sent.push(a.place); return hold ? new Promise((res) => held.push(() => res(answer(a)))) : Promise.resolve(answer(a)); },
    async remove() { return { ok: true, data: {} }; },
  };
  const rig = toolRig({ room: { kind: 'home', where: 'Your home', mapId: 77, buildingKey: 9 }, homeDecor: svc, gold });
  const flush = async () => { while (held.length) { held.shift()(); await settle(); await settle(); } };
  return { rig, sent, flush, holdOn: (v) => { hold = v; } };
};

test('AUDIT HOME-STATIONS S1: a moved station stays one - the ghost is built from the piece, craft and all, and the move writes it; online the place the service is sent carries it (mutants: the ghost without the craft; the placer\'s piece without it)', async () => {
  for (const online of [false, true]) {
    const o = online ? onlineRig(300_000) : { rig: toolRig({ gold: 300_000 }), sent: [] };
    const rig = o.rig;
    const chair = await placedOne(rig);
    let root = choose(rig, chair.id);
    btn(root, /^Make station/).fire('click');
    await settle();
    assert.equal(rig.standing[0].station, 'alchemy');
    root = choose(rig, chair.id);
    btn(root, 'Move').fire('click');
    rig.frame(); await settle(); rig.frame();
    assert.equal(await rig.tool.commit(), true);
    await settle();
    assert.equal(rig.standing[0].station, 'alchemy', `${online ? 'online' : 'offline'}: moved, still a station`);
    if (online) assert.equal(o.sent.at(-1).station, 'alchemy', 'the move\'s place carries the craft');
  }
});

test('AUDIT HOME-STATIONS S2: one change of craft at a time - a second press while the account service still answers the first is refused: the licence paid once and the station kept, where it was paid twice or written back over (mutants: no in-flight guard)', async () => {
  const { rig, sent, flush, holdOn } = onlineRig(80_000);   // one licence's gold, not two
  const chair = await placedOne(rig);
  holdOn(true);
  const root = choose(rig, chair.id);
  const paid = rig.w.paid.length;
  const asked = sent.length;
  btn(root, /^Make station/).fire('click');
  btn(root, /^Make station/).fire('click');   // the double click, before the service answers
  await settle();
  await flush();
  assert.deepEqual(rig.w.paid.slice(paid), [50000], 'paid once');
  assert.equal(rig.standing[0].station, 'alchemy', 'and it stands - the second press wrote nothing back');
  assert.equal(sent.length - asked, 1, 'one change asked of the service - not a second, and no roll-back of the one paid for');
  assert.equal(sent.at(-1).station, 'alchemy', 'the service keeps the station the room shows');
  // the gold spent elsewhere while the service answered: it stands as it was, nothing paid, and it says so
  const o2 = onlineRig(300_000);
  const more = await placedOne(o2.rig);
  o2.holdOn(true);
  const root2 = choose(o2.rig, more.id);
  const paid2 = o2.rig.w.paid.length;
  btn(root2, /^Make station/).fire('click');
  await settle();
  o2.rig.w.gold = 100;
  await o2.flush();
  assert.equal(o2.rig.w.paid.length, paid2, 'nothing paid');
  assert.equal(o2.rig.standing[0].station, undefined, 'no station kept');
  assert.equal(o2.rig.said.at(-1), DECOR_STATION_GOLD_WENT);
});

test('AUDIT HOME-STATIONS S3 + S6 + S9: the room\'s view repaints when a piece\'s craft changes (its signature carries the craft), and the button acts as it is painted; a station\'s Remove says the licence does not come back; the chooser is named for a reader (mutants: the craft out of the signature; the act re-read from a newer piece)', async () => {
  const rig = toolRig({ gold: 300_000 });
  const chair = await placedOne(rig);
  const root = choose(rig, chair.id);
  btn(root, /^Make station/).fire('click');
  await settle();
  rig.frame({ overlayUp: true });   // the next frame hands the panel the room as it stands - no row chosen again
  assert.ok(btn(root, /^Unmake station/), 'the button says what the piece now is');
  assert.match(one(root, 'dfdecor-pick-price').textContent, / back \(the station licence is not\)$/);
  assert.equal(btn(root, /^Station:/).attrs['aria-label'], 'Station craft: Alchemy - press for the next');
  // unmade: no gold moves (the view's gold does not change it), and the view still repaints - the craft is its own
  btn(root, /^Unmake station/).fire('click');
  btn(root, /^Press again to unmake/).fire('click');
  await settle();
  rig.frame({ overlayUp: true });
  assert.equal(rig.standing[0].station, undefined);
  assert.equal(btn(root, /^Make station/)?.textContent, 'Make station - 50,000 gold', 'the button says what the piece now is');
  const P = src('src/ui/decorPanel.js');
  assert.match(P, /const what = stationBtn\.dataset\.what;\s*\n\s*if \(what === 'arm'\) \{ stationArmed = it\.piece\.id; paintRoomSide\(\); return; \}\s*\n\s*stationArmed = null;\s*\n\s*if \(what\) onToggle\(it\.piece, what\);/, 'the act the button says');
  assert.match(P, /stationBtn\.dataset\.what = words\.what;/);
});

test('AUDIT HOME-STATIONS S5 + S7 + S8: six acts fit a landscape phone (the side scrolls, a short screen\'s preview gives way); a maker\'s refusal with no record still says so; a station says its craft on the hover (mutants: each dropped)', () => {
  const P = src('src/ui/decorPanel.js');
  assert.match(P, /\.dfdecor-side \{ display: flex; flex-direction: column; gap: 6px; min-height: 0; overflow-y: auto; \}/);
  assert.match(P, /@media \(max-height: 480px\) \{ \.dfdecor-preview \{ min-height: 60px; \} \}/);
  const M = src('src/scenes/worldModes.js');
  assert.match(M, /for \(const t of lines\.length \? lines : \[DECOR_STATION_REFUSED\]\) say\(t\);/);
  assert.match(M, /const DECOR_STATION_REFUSED = 'You cannot use the station right now\.';/);
  assert.match(M, /const craft = piece\.station \? DECOR_STATION_NAMES\[piece\.station\] : null;[^\n]*\n\s*return t \? \{ title: craft \? `\$\{t\} \(\$\{craft\}\)` : t \} : craft \? \{ title: craft \} : null;/);
});
