// AUDIT ETHER-OW (2026-10-13, the owner: "Lets audit everything and ensure perfection"; bible/01-Overview/audits/Audit-Ether-OW.md)
// - the audit of ELTHERIC, ETHER-DEEP, ETHER-NODES and ETHER-OW, its three lanes' code findings pinned here as the game
// runs them: C2-1 a Motherlode's site a pixel the Watch can vouch for (ETHER-NODES' isle witnesses confirmed ground past
// the Veil, where no receipt is ever minted - a Motherlode there could never be struck); C2-2 an isle charted is a plate
// on the Overworld at once (the lists keyed on DFU's finds alone, a chart by sight came a pixel later); C2-3 no boarding
// "Your Ship" across the Veil (the board is a teleport to the Bay's two ship pixels - from past the Veil it carried a
// captain over without the crossing). C1's and lane T's are pinned in their own slices' files (ether_deep, ether_ow,
// nav_r_raiders, oh_host).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0 } from '../accountDb.mjs';
import { watchPixelOk, watchReceiptValid } from '../../src/net/watchReceipt.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { motherlodeSites } from '../../src/net/motherlodeLaw.js';
import { CLIMATES, REGION_NAMES } from '../../src/formats/mapsTables.js';
import { LOCATION_TYPES, getWorldClimateSettings } from '../../src/formats/mapsFile.js';
import * as ES from '../../src/world/ethericSea.js';
import { etherPlaceIsle, etherPlaceRows, etherTemplateOf, synthesizeEtherLocation, etherPlaceId, ETHER_REGION, ETHER_REGION_NAME } from '../../src/world/etherPlaces.js';
import { createCaptainLedger } from '../../src/systems/naval/captainLedger.js';
import { farPlaces, settlementPixels, TV_FAR_RANGE } from '../../src/systems/travel/travelFarPlaces.js';
import { shipTransition } from '../../src/systems/ship.js';
import { SHIP_TYPES } from '../../src/systems/banking.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const W = src('src/scenes/world.js');
const lift = (head, close = '\n  }\n') => {
  const at = W.indexOf(head);
  assert.ok(at >= 0, `world.js holds ${head.trim()}`);
  return W.slice(at, W.indexOf(close, at) + close.length);
};
const liftLine = (head) => { const at = W.indexOf(head); assert.ok(at >= 0, `world.js holds ${head.trim()}`); return W.slice(at, W.indexOf('\n', at)); };
const run = (env, body) => { const names = Object.keys(env); return new Function(...names, body)(...names.map((k) => env[k])); };

const H = ES.veilhaven();
const M = CLIMATES.Mountain;
const DAY = 86400;
const DAY0 = utcDay(T0);

// ─── C2-1: THE MOTHERLODES' GROUND ─────────────────────────────────────────────────────────────────────────────────

test('AUDIT ETHER-OW C2-1, the law: the Watch\'s ground is the Bay\'s map, one home - the relay mints on it, the service takes a receipt on it, and a Motherlode is sited on it alone: an isle\'s witnessed mountain past the Veil is never a site, the Bay\'s beside it are (mutants: the site\'s pixel unread, the Watch\'s ground the world\'s)', () => {
  assert.deepEqual([watchPixelOk(0, 0), watchPixelOk(999, 499), watchPixelOk(1000, 0), watchPixelOk(0, 500), watchPixelOk(-1, 0), watchPixelOk(0, -1), watchPixelOk(1.5, 2), watchPixelOk(H.px, H.py)],
    [true, true, false, false, false, false, false, false]);
  const claims = { s: 'a'.repeat(16), x: 10, y: 20, c: 1, i: 1000, e: 1060 };
  assert.equal(watchReceiptValid({ ...claims }), true, 'a receipt on the map');
  assert.equal(watchReceiptValid({ ...claims, x: H.px, y: H.py }), false, 'never past the Veil');
  // the sites: the isles' confirmed mountains are never one - alone, none; beside the Bay's, the Bay's
  const isles = Array.from({ length: 6 }, (_, i) => ({ x: H.px + i, y: H.py, climate: M, region: ETHER_REGION }));
  const bay = Array.from({ length: 4 }, (_, i) => ({ x: 200 + i, y: 80, climate: M, region: 21 }));
  for (let day = DAY0; day < DAY0 + 20; day++) {
    assert.deepEqual(motherlodeSites(day, isles), [], 'the isles alone: none');
    const both = motherlodeSites(day, [...isles, ...bay]);
    assert.equal(both.length, 3);
    assert.ok(both.every((s) => watchPixelOk(s.x, s.y)), 'the Bay\'s, every day');
    assert.deepEqual(both, motherlodeSites(day, bay), 'as if the isles were never witnessed');
  }
  // one home: the relay's mint and the service's site read it
  assert.match(src('server/src/index.js'), /const \[x, y\] = mapPixelOfWire\(p\.x, p\.z\);\n {4}if \(!watchPixelOk\(x, y\)\) return;/);
  assert.match(src('src/net/motherlodeLaw.js'), /\.filter\(\(c\) => c && watchPixelOk\(c\.x, c\.y\) && motherlodeGround\(c\.climate\)\)/);
});

test('AUDIT ETHER-OW C2-1, the service: the day\'s three read from witnessed ground (the real Worker over node:sqlite) - an isle\'s confirmed pixels past the Veil give no Motherlode, and beside the Bay\'s the three are the Bay\'s (mutant: the site\'s pixel unread)', async () => {
  const realNow = Date.now;
  Date.now = () => (DAY0 * DAY + 60) * 1000;
  try {
    const stand = async (pixels) => {
      const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
      const raw = s.env.DB._raw;
      const witnesses = [await s.registered('Wita'), await s.registered('Witb'), await s.registered('Witc')];
      for (const [x, y, region] of pixels) {
        for (const w of witnesses) {
          raw.prepare('INSERT INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, ?, ?)')
            .run('pixel', `${x},${y}`, w.id, `${M},${region}`, region, DAY0 * DAY - 3600);
        }
      }
      const ann = await s.registered('Ann');
      return s.call('/v1/prof/motherlodes', { character: ann.character }, ann.secret);
    };
    const isles = Array.from({ length: 6 }, (_, i) => [H.px + i, H.py, ETHER_REGION]);
    const none = await stand(isles);
    assert.equal(none.status, 200, JSON.stringify(none.body));
    assert.deepEqual(none.body.lodes, [], 'the isles alone: no Motherlode');
    const bay = Array.from({ length: 4 }, (_, i) => [200 + i, 80, 21]);
    const r = await stand([...isles, ...bay]);
    assert.equal(r.body.lodes.length, 3);
    assert.ok(r.body.lodes.every((l) => watchPixelOk(l.x, l.y)), 'every one a pixel the Watch can vouch for');
  } finally {
    Date.now = realNow;
  }
});

// ─── C2-2: A CHART IS A PLATE AT ONCE ──────────────────────────────────────────────────────────────────────────────

const TOWN = { name: 'Template Town', mapTableData: { mapId: 4242, locationType: LOCATION_TYPES.TownHamlet }, exterior: { exteriorData: { width: 2, height: 2 } }, politic: 1, climate: null };
const RUIN = { name: 'Template Ruin', mapTableData: { mapId: 4343, locationType: LOCATION_TYPES.DungeonRuin }, exterior: { exteriorData: { width: 1, height: 1 } }, hasDungeon: true, dungeon: { blocks: [{}] }, politic: 1, climate: null };

test('AUDIT ETHER-OW C2-2: an isle charted while the captain stands on one pixel - by sight, a harbourmaster\'s chart, a corsair\'s papers - is a plate on the Overworld at once, its port\'s grid plate and a far one\'s at the edge; the lists keyed on the charts as on DFU\'s finds (lifted and run; mutants: the key the finds alone, the count unread)', () => {
  const ledger = createCaptainLedger();
  const at = { x: H.px - 6, y: H.py };
  const far = ES.islesNear(at.x, at.y, TV_FAR_RANGE).find((i) => i.kind === 'port' && i !== H && Math.hypot(i.px - at.x, i.py - at.y) <= TV_FAR_RANGE && Math.max(Math.abs(i.px - at.x), Math.abs(i.py - at.y)) > 6);
  assert.ok(far, 'a port past the grid, within the edge\'s range');
  const env = {
    etherSea: true, inEther: ES.inEther, etherPlaceIsle, locationIndex: new Map(), captainLedger: ledger, hasDiscoveredLocationId: () => false, discoveryGeneration: () => 7,
    etherTemplateOf, _etherTemplates: { towns: [TOWN], havens: [TOWN], ruins: [RUIN] }, synthesizeEtherLocation, ETHER_REGION, REGION_NAMES, ETHER_REGION_NAME, getWorldClimateSettings,
    wildHallAt: () => false, wildActiveNow: () => null, wildHallStand: () => null, spawnedHallMapId: () => 0, maps: { getClimateIndex: () => 223 },
    travelLocationSummaryAt: () => null, mapDict: new Map(), travelCheckDiscovered: () => false,
    playerTravelPixel: () => at, state: { terrainDistance: 6 }, tvPlaceRect: (s) => ({ cx: s.pixel.x, cz: s.pixel.y }), farPlaces, settlementPixels, etherPlaceRows, TV_FAR_RANGE,
  };
  const v = run(env, `let tvPlates = { at: null, dg: -1, list: [] }, tvFar = { at: null, near: -1, list: [] }, _tvSettlements = null;
    ${lift('  function etherPlaceClone(isle) {')}
    ${liftLine('  const tvEtherPlace = ')}
    ${liftLine('  const tvEtherKnown = ')}
    ${liftLine('  const tvKnownGen = ')}
    ${lift('  const tvPlaceSummary = (px, py) => {', '\n  };\n')}
    ${lift('  function travelViewPlaces() {')}
    ${lift('  function travelViewFarPlaces() {')}
    return { travelViewPlaces, travelViewFarPlaces };`);
  assert.deepEqual([v.travelViewPlaces(), v.travelViewFarPlaces()], [[], []], 'nothing charted: no plates');
  assert.equal(ledger.chartIsle(H.key), true);
  assert.equal(ledger.chartIsle(far.key), true);
  assert.deepEqual(v.travelViewPlaces().map((p) => p.key), [`place:${etherPlaceId(H)}`], 'Veilhaven\'s plate, the pixel not left');
  assert.deepEqual(v.travelViewFarPlaces().map((p) => p.key), [`far:${etherPlaceId(far)}`], 'and the far port\'s at the edge');
  assert.equal(env.locationIndex.size, 0, 'marked, never stood');
});

// ─── C2-3: NO BOARDING ACROSS THE VEIL ─────────────────────────────────────────────────────────────────────────────

test('AUDIT ETHER-OW C2-3: "Your Ship" is boarded from the Bay alone - past the Veil the board (a teleport to the Bay\'s ship pixels) is refused with the crossing\'s word, and leaving the ship always goes back where it was boarded; the sea off, as ever (lifted and run; mutants: the guard dropped, the leave refused too)', async () => {
  // the board's head, to its first ask of the Veil (the line after it takes the transition)
  const at = W.indexOf('async function boardOrDisembark() {'), end = W.indexOf('\n', W.indexOf('veilRefused(', at)) + 1;
  assert.ok(at >= 0 && end > at && end - at < 2000, 'the Veil asked before the transition is taken');
  assert.ok(W.slice(at, end).includes('    if (!t) return;\n'), 'and after there is one');
  const said = [];
  const mk = ({ ether = true, pixel, board = null }) => {
    const env = {
      etherSea: ether, inEther: ES.inEther, townTalk: { say: (t) => said.push(t) }, worldMoveBusy: () => false, enterLinkedBankCabin: async () => false,
      playerTravelPixel: () => pixel, shipTransition, playerEntity: { ownedShip: SHIP_TYPES.Small, boardShipPosition: board },
      shipMemory: (m) => m, player: { pos: [0, 0, 0] }, groundFrameHeight: () => 0, state: { compensation: [0, 0, 0] }, cam: { yaw: 0 }, STREAMING_TERRAIN_SCALE: 1,
    };
    return run(env, `${lift('  const veilRefused = (to = null) => {', '\n  };\n')}
      ${W.slice(at, end)}    return t;\n  }\n  return boardOrDisembark;`);
  };
  // from past the Veil: refused, said
  assert.equal(await mk({ pixel: { x: H.px, y: H.py } })(), undefined, 'no board from Veilhaven');
  assert.deepEqual(said, ['The Bay\'s magic does not reach across the Veil. Only the crossing does.']);
  // from the Bay: boarded, to the ship's pixel
  assert.deepEqual((await mk({ pixel: { x: 300, y: 200 } })())?.go, { x: 2, y: 2 }, 'the Bay\'s board as ever');
  // aboard: leaving goes back where it was boarded, even across the Veil (it is the way home, never a way over)
  const boarded = { mapPixel: { x: 300, y: 200 }, pos: [0, 0, 0] };
  assert.deepEqual((await mk({ pixel: { x: 2, y: 2 }, board: boarded })())?.go, { x: 300, y: 200 });
  const fromIsle = { mapPixel: { x: H.px, y: H.py }, pos: [0, 0, 0] };
  assert.deepEqual((await mk({ pixel: { x: 2, y: 2 }, board: fromIsle })())?.go, { x: H.px, y: H.py }, 'a ship boarded before the law: the captain sent home');
  // the sea off: no Veil
  assert.deepEqual((await mk({ ether: false, pixel: { x: 300, y: 200 } })())?.go, { x: 2, y: 2 });
  assert.equal(said.length, 1, 'said once, for the one refusal');
});

// ─── THE MERGE WITH L10N: THE CHART IN THE PLAYER'S LANGUAGE ───────────────────────────────────────────────────────

test('AUDIT ETHER-OW, the merge with main\'s L10N: the Eltheric chart\'s own words are the text core\'s (L10N4) - in French its title, its line, the ruler\'s Veil, its key, a way and an isle\'s line, its scale and a haunt read French, read when they are drawn (never at load); in English byte for byte as before; the sea\'s name and its bands\', kinds\' and compass words stay `world/ethericSea.js`\'s (mutants: a word left English, a table read at load)', async () => {
  const tm = await import('../../src/systems/textManager.js');
  const M = await import('../../src/ui/etherChartWindow.js');
  const word = { px: H.px, py: H.py, yaw: 0, charted: [H.key], legends: [], stats: { charted: 2, deepest: 3, crossings: 1 } };
  const english = M.chartModel(word, { cx: H.px, cy: H.py, zoom: 2 }, 400, 300);
  assert.deepEqual([english.title, english.sub], [`A chart of ${ES.ETHER_SEA_NAME}`, '2 isles charted - deepest 3 leagues past the Veil - 1 crossing']);
  assert.deepEqual([M.wayWords({ px: 0, py: 0 }, { px: 0, py: 0 }), M.scaleBar(4).words, M.RULER_WORDS.veil[1], M.CHART_KEY[2][1]], ['here', '1 league', 'THE VEIL', 'Wild isle']);
  const rows = tm.loadStringTableCsv(src('locales/fr/Port_Strings.csv'));
  tm.patchLocaleTable('fr', 'Port_Strings', rows);
  const fr = new Map(rows);
  try {
    tm.setLocale('fr');
    const m = M.chartModel(word, { cx: H.px, cy: H.py, zoom: 2 }, 400, 300);
    assert.equal(m.title, fr.get('sea.chart.title').replace('{sea}', ES.ETHER_SEA_NAME));
    assert.match(m.sub, /^2 îles cartographiées - .* 1 traversée$/);
    assert.deepEqual([M.wayWords({ px: 0, py: 0 }, { px: 0, py: 0 }), M.scaleBar(4).words, M.scaleBar(0).words, M.RULER_WORDS.veil[1], [...M.CHART_KEY[2]]],
      [fr.get('sea.chart.here'), '1 lieue', '20 lieues', fr.get('sea.chart.ruler.veil'), ['wild', fr.get('sea.chart.key.wild')]]);
    assert.notEqual(M.CHART_KEY[2][1], 'Wild isle', 'the key read when it is drawn - never frozen at load');
    const ruin = ES.islesNear(H.px, H.py, 40).find((i) => i.kind === 'ruin');
    assert.match(M.isleWords(ruin, { px: ruin.px, py: ruin.py }), new RegExp(`^${M.capFirst(ruin.name)} - ${ES.KIND_WORDS.ruin} - ${fr.get('sea.chart.here')}$`), 'the line\'s words French, the kind ethericSea.js\'s');
    const { hauntOf, legendById } = await import('../../src/systems/naval/etherShips.js');
    const lair = hauntOf(legendById('starless'));
    const haunted = M.chartModel({ ...word, legends: [{ id: 'starless', name: 'The Starless', sails: true, trait: 'night' }, { id: 'starless', name: 'The Starless', sails: false }] }, { cx: lair.px, cy: lair.py, zoom: 2 }, 800, 600);
    assert.deepEqual(haunted.haunts.map((h) => h.sub), [fr.get('sea.chart.hauntNight'), fr.get('sea.chart.hauntSunk')], 'her haunt by night, and sunk');
  } finally {
    tm.setLocale('en');
  }
  assert.deepEqual(M.chartModel(word, { cx: H.px, cy: H.py, zoom: 2 }, 400, 300).sub, english.sub, 'English again, byte for byte');
});
