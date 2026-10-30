// FIXED-PVE STAGE 7 (bible/05-Combat/Fixed-PvE.md section 9): a spawn grant stands its seed's template from the
// table at its pixel - the same body and level on the owner's machine and every reader's - and only while the world
// hands the grant host a table (the switch on).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { factionsHolding, pveTableAt, grantTemplateKey, templateFoe, templateDiceRefusal } from '../../../src/systems/pve/pveGrant.js';
import { ORSINIUM_REGION } from '../../../src/systems/pve/pveBestiary.js';
import { TEMPLATE_BY_KEY, templateStats } from '../../../src/systems/pve/pveTemplates.js';
import { grantDiceRefusal, createGrantHost } from '../../../src/scenes/grantHost.js';
import { fixedPveOn } from '../../../src/systems/pve/pveSwitch.js';
import { CLIMATES, BAY_REGION_COUNT } from '../../../src/formats/mapsTables.js';
import { DUNGEON_TYPES } from '../../../src/formats/mapsFile.js';
import { CITIES } from '../../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay } from '../../../src/world/tamriel/tamrielFrame.js';

const mountain = { regionAt: () => ORSINIUM_REGION, climateAt: () => CLIMATES.Mountain, minute: 12 * 60 };
const orcs = pveTableAt(300, 100, mountain);
const grant = (k, s) => ({ k, s, p: [300, 100], m: mountain.minute });

test('STAGE 7: who holds a place - outlaws the open land, the clans their Wrothgar and strongholds, nobody a town', () => {
  assert.deepEqual(factionsHolding(5, 'wild'), ['bandits']);
  assert.deepEqual(factionsHolding(5, 'town'), []);
  assert.deepEqual(factionsHolding(ORSINIUM_REGION, 'road'), ['bandits', 'orc-clans']);
  assert.deepEqual(factionsHolding(62, 'dungeon', DUNGEON_TYPES.OrcStronghold), ['bandits', 'orc-clans']);
});

test('STAGE 7: the table at a grant\'s pixel - the Bay\'s region from the map, a province\'s from its theatre', () => {
  assert.equal(orcs.zone.name, 'Orsinium Area');
  assert.deepEqual(orcs.lists.encounter.map((x) => x.key), ['orc-defender', 'orc-grunt']);
  const [sx, sy] = pictureToBay(...CITIES.find((c) => c.name === 'Solitude').at).map(Math.floor);
  const skyrim = pveTableAt(sx, sy, { ...mountain, regionAt: () => { throw new Error('past the Bay reads no map region'); } });
  assert.equal(skyrim.zone.region, BAY_REGION_COUNT + 2);
  assert.equal(skyrim.zone.pastBay, true);
  const night = pveTableAt(300, 100, { ...mountain, minute: 0 });
  assert.ok(night, 'the minute reaches the hour');
});

test('STAGE 7: a grant\'s members are its seed\'s templates - the same on every machine, a camp its group member by member', () => {
  const keys = [0, 1, 2, 3].map((i) => grantTemplateKey(grant('encr', 77), i, orcs));
  assert.deepEqual([0, 1, 2, 3].map((i) => grantTemplateKey(grant('encr', 77), i, orcs)), keys);
  for (const k of keys) assert.ok(['orc-defender', 'orc-grunt'].includes(k));
  const seen = new Set();
  for (let s = 0; s < 40; s++) seen.add(grantTemplateKey(grant('encr', s), 0, orcs));
  assert.equal(seen.size, 2, 'the die reaches every plain foe');
  let differ = 0;
  for (let s = 0; s < 40; s++) if (grantTemplateKey(grant('encr', s), 0, orcs) !== grantTemplateKey(grant('encr', s), 1, orcs)) differ++;
  assert.ok(differ > 0, 'each member rolls its own die');
  const camp = [0, 1, 2, 3, 4].map((i) => grantTemplateKey(grant('camp', 5), i, orcs));
  assert.deepEqual(camp, ['orc-grunt', 'orc-grunt', 'orc-defender', 'orc-shaman', null], 'the warband, then none');
  assert.equal(grantTemplateKey(grant('band', 5), 0, orcs), null, 'a band stands no template yet');
  assert.equal(grantTemplateKey(grant('encr', 5), 0, null), null);
});

test('STAGE 7: a template stands at its own numbers, never the owner\'s level', () => {
  const f = templateFoe('orc-grunt');
  assert.deepEqual({ ...f }, { key: 'orc-grunt', mobile: 7, ...templateStats(TEMPLATE_BY_KEY.get('orc-grunt')) });
  assert.equal(templateFoe(null), null);
  assert.equal(templateFoe('nobody'), null);
});

test('STAGE 7: a reader refuses a body or level that is not the seed\'s template', () => {
  const gr = grant('encr', 77), want = templateFoe(grantTemplateKey(gr, 0, orcs));
  const rec = (o) => ({ t: want.mobile, l: want.level, gr: [1, 0], ...o });
  assert.equal(templateDiceRefusal(gr, rec({}), orcs), null);
  assert.equal(templateDiceRefusal(gr, rec({ l: undefined }), orcs), null, 'a record that names no level');
  assert.equal(templateDiceRefusal(gr, rec({ t: 3 }), orcs), 'dice');
  assert.equal(templateDiceRefusal(gr, rec({ l: want.level + 1 }), orcs), 'dice', 'no slack: the level is the template\'s');
  assert.equal(templateDiceRefusal(gr, rec({}), null), 'dice', 'no table, no template');
  assert.equal(grantDiceRefusal(gr, rec({ t: 3 }), null, () => null, () => orcs), 'dice');
  assert.equal(grantDiceRefusal(gr, rec({}), null, () => null, () => orcs), null);
  assert.equal(grantDiceRefusal(grant('camp', 5), { t: 7, l: 26, gr: [1, 2] }, null, () => null, () => orcs), null, 'a camp\'s defender');
  assert.equal(grantDiceRefusal(grant('camp', 5), { t: 3, l: 26, gr: [1, 2] }, null, () => null, () => orcs), 'dice', 'and not another body');
  assert.equal(grantDiceRefusal(gr, rec({ t: 3 }), null, () => null), null, 'switched off: the old law reads it');
});

test('STAGE 7: the grant host stands templates only when handed a table - and the switch is off', () => {
  assert.equal(fixedPveOn(), false);
  const gr = grant('encr', 77);
  const off = createGrantHost({ session: () => null });
  assert.equal(off.templateOf(gr, 0), null);
  assert.equal(off.speciesOf(gr, 0, false), -1);
  const on = createGrantHost({ session: () => null, tableAt: () => orcs });
  assert.deepEqual(on.templateOf(gr, 0), templateFoe(grantTemplateKey(gr, 0, orcs)));
  assert.equal(on.speciesOf(gr, 0, false), 7);
  assert.equal(on.templateOf(null, 0), null);
  assert.equal(createGrantHost({ session: () => null, tableAt: () => null }).speciesOf(gr, 0, false), -1);
  assert.match(readFileSync(new URL('../../../src/scenes/grantHost.js', import.meta.url), 'utf8'),
    /const diceRefusal = \(gr, r\) => grantDiceRefusal\(gr, r, climateAt, faunaAt, tableAt\);/, 'the reader\'s check reads the table');
});
