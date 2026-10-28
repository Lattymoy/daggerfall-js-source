// AUDIT TESA III E2-2 (2026-10-26; bible/01-Overview/audits/Audit-Tesa-III-E2.md): A CASTLE PAST THE BAY IS ITS CAPITAL'S.
// WW7-4 made each province's crown city keep a castle its Charter's guild may buy (net/castleLaw.js castleKeyOk), but the
// Guild window named a castle by its REGION - the Bay's three crowns' regions are their cities' names, a province's is
// not - so a guild holding Skyrim's Charter was offered "Castle Skyrim", told its door stood "in Skyrim" (it stands in
// Solitude) and Summerset's was "Castle Sumurset Isle"; and the window's own line and the service's `castle-none` still
// said only Daggerfall, Wayrest and Sentinel keep one. tools/mutants/audittesa3e2.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { castleCityOf, CASTLE_REGIONS, castleRegionOk } from '../../src/net/castleLaw.js';
import { REGION_NAMES } from '../../src/formats/mapsTables.js';
import { guildCastleText } from '../../src/ui/socialPanel.js';
import { accountRefusalText } from '../../src/net/accountClient.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('AUDIT TESA III E2-2 the law: a castle\'s city is its crown\'s seat - the Bay\'s three their own, each province\'s its capital, never the province; none where no castle stands (mutants: the region\'s name; any region a city)', () => {
  assert.deepEqual(CASTLE_REGIONS.map((r) => [r, castleCityOf(r)]), [
    [17, 'Daggerfall'], [20, 'Sentinel'], [23, 'Wayrest'],
    [64, 'Solitude'], [65, 'Mournhold'], [66, 'Alinor'], [67, 'Falinesti'], [68, 'Torval'], [69, 'Helstrom'], [70, 'Imperial City'],
  ]);
  for (const r of [0, 5, 21, 61, 62, 63, 71, -1, 1.5]) assert.equal(castleCityOf(r), null, String(r));
  for (const r of CASTLE_REGIONS.filter((x) => x >= 62)) assert.notEqual(castleCityOf(r), REGION_NAMES[r], `region ${r} is no city`);
  assert.equal(castleRegionOk(64), true);
});

test('AUDIT TESA III E2-2 the window and the service\'s word: the Guild window names a castle and an offer by castleCityOf, and its line and `castle-none` say a province\'s capital keeps one too, the Imperial City\'s none (mutants: a castle named by its region; an offer named by its region; the old words)', () => {
  const panel = rd('src/ui/socialPanel.js');
  assert.match(panel, /const city = castleCityOf\(c\.region\) \?\? REGION_NAMES\[c\.region\] \?\? '';/, 'a castle kept');
  assert.match(panel, /const city = castleCityOf\(o\.region\) \?\? REGION_NAMES\[o\.region\] \?\? '', has = /, 'a castle offered');
  assert.doesNotMatch(panel, /const city = REGION_NAMES\[[co]\.region\]/);
  assert.equal(guildCastleText.name(castleCityOf(64)), 'Castle Solitude');
  assert.match(guildCastleText.none(), /Daggerfall, Wayrest, Sentinel or a province's capital, but the Imperial City/);
  assert.match(accountRefusalText('castle-none'), /Daggerfall, Wayrest, Sentinel and each province's capital but the Imperial City\.$/);
});
