// A placed decoration indoors is named only when the press does something with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indoorDecorHover } from '../../src/systems/worldTooltips.js';

const chair = { model: 41000, storage: false, station: null, item: null };
const named = { catalogueName: 'Chair', containerName: 'Chest', stationName: 'Alchemy' };

test('indoor decoration tooltips name what can be used and leave the rest unnamed', () => {
  assert.equal(indoorDecorHover(null, named), null);
  assert.equal(indoorDecorHover(chair, named), null);
  assert.equal(indoorDecorHover({ ...chair, light: { range: 5 } }, named), null);
  assert.deepEqual(indoorDecorHover({ ...chair, storage: true }, named), { title: 'Chair' });
  assert.deepEqual(indoorDecorHover({ ...chair, storage: true, station: 'alchemy' }, named), { title: 'Chair (Alchemy)' });
  assert.deepEqual(indoorDecorHover({ ...chair, station: 'alchemy' }, { stationName: 'Alchemy' }), { title: 'Alchemy' });
  assert.deepEqual(indoorDecorHover({ ...chair, storage: true }, { containerName: 'Chest' }), { title: 'Chest' });
  assert.deepEqual(indoorDecorHover({ ...chair, item: { id: 1 } }, { ...named, itemTitle: 'Ebony dagger' }), { title: 'Ebony dagger' });
  assert.equal(indoorDecorHover({ ...chair, item: { id: 1 } }, named), null);
  assert.deepEqual(indoorDecorHover(chair, { ...named, boardTitle: 'Guild board' }), { title: 'Guild board' });
});
