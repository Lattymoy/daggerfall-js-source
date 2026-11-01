import test from 'node:test';
import assert from 'node:assert/strict';
import {partyElevationArrow} from '../../../src/systems/party/partyPresentation.js';
test('party elevation uses arrows only for known offsets beyond the same-level band',()=>{
  assert.equal(partyElevationArrow(4),'\u2191');assert.equal(partyElevationArrow(-4),'\u2193');
  for(const n of [0,3,-3,NaN,Infinity,undefined])assert.equal(partyElevationArrow(n),'');
  assert.equal(partyElevationArrow(8,false),'');
});
