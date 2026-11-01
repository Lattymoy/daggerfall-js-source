import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partyVisibilityOptions, partyVisibilityAlpha, partyDistanceAlpha, partyVisibilityMembers, partyPlaceLabel, projectPartyMarker, partyOutlineBounds } from '../../../src/systems/party/partyVisibility.js';
import { partyDistanceText } from '../../../src/systems/party/partyPresentation.js';

test('distance focus uses the world viewport centre, fades smoothly, and leaves offscreen arrows quiet', () => {
  const rect = { left: 100, top: 30, width: 800, height: 400 };
  assert.equal(partyDistanceAlpha({ x: 500, y: 230 }, rect, {}), 1);
  assert.equal(partyDistanceAlpha({ x: 596, y: 230 }, rect, {}), 0.18);
  const mid = partyDistanceAlpha({ x: 564, y: 230 }, rect, {});
  assert.ok(mid > 0.18 && mid < 1);
  assert.equal(partyDistanceAlpha({ x: 500, y: 230, edge: true }, rect, {}), 0.18);
  assert.equal(partyDistanceAlpha({ x: NaN, y: 230 }, rect, {}), 0.18);
  assert.equal(partyDistanceAlpha({ edge: true }, rect, { distanceFocus: false }), 1);
  assert.equal(partyDistanceAlpha({ x: 500, y: 230 }, rect, { idleDistanceAlpha: 0 }), 1);
  assert.equal(partyVisibilityOptions({ focusRadius: 0, idleDistanceAlpha: -1 }).focusRadius, 24);
});

test('invalid options cannot create NaN, zero fade ranges or CSS injection', () => {
  const o = partyVisibilityOptions({ fadeStart: 90, diamondDistance: 5, width: Infinity, nearAlpha: -4, color: 'red;position:fixed' });
  assert.equal(o.fadeStart, 4); assert.equal(o.width, 2); assert.equal(o.nearAlpha, 0); assert.equal(o.color, '#66e5a0');
});

test('distance envelope and crossfade preserve a readable independent diamond', () => {
  assert.deepEqual(partyVisibilityAlpha(0, {}), { outline: 0.9, marker: 0 });
  const mid = partyVisibilityAlpha(60, {});
  assert.ok(Math.abs(mid.outline - 0.1) < 1e-9); assert.equal(mid.marker, 0.45);
  assert.ok(partyVisibilityAlpha(50, {}).outline > 0);
  assert.deepEqual(partyVisibilityAlpha(65, {}), { outline: 0, marker: 0.9 });
  assert.deepEqual(partyVisibilityAlpha(50, { diamonds: false, fade: false }), { outline: 0.9, marker: 0 });
  assert.deepEqual(partyVisibilityAlpha(50, { outline: false }), { outline: 0, marker: 0.9 });
  assert.deepEqual(partyVisibilityAlpha(50, { maxDistance: 10 }), { outline: 0, marker: 0 });
});

test('party membership selects one live body per account and excludes strangers, offline and hidden members', () => {
  const others = [{ acct: 'a', name: 'A' }, { acct: 'b', online: false }, { acct: 'c' }];
  const bodies = [{ acct: 'a', id: 'a1', feet: [1, 2, 3] }, { acct: 'a', id: 'a2', feet: [4, 5, 6] },
    { acct: 'b', id: 'b', feet: [0, 0, 0] }, { acct: 'c', id: 'c', feet: [0, 0, 0] }, { acct: 'stranger', feet: [0, 0, 0] }];
  const result = partyVisibilityMembers({ others, bodies, hidden: (id) => id === 'c' });
  assert.equal(result.length, 1); assert.equal(result[0].id, 'a1'); assert.equal(result[0].exact, true);
  assert.deepEqual(partyVisibilityMembers({ others, bodies, fresh: () => false }), []);
});

test('coarse locations are explicitly approximate and never invented inside another room', () => {
  const others = [{ acct: 'far', p: { px: 5, py: 8, in: 1, loc: 'Dungeon' } }, { acct: 'same', p: { px: 1, py: 2, in: 2 } }];
  const pixelCentre = (x, y) => [x * 10, 0, y * 10];
  assert.deepEqual(partyVisibilityMembers({ others, pixelCentre }), []);
  const rows = partyVisibilityMembers({ others, here: { x: 1, y: 2 }, pixelCentre });
  assert.equal(rows.length, 1); assert.equal(rows[0].exact, false); assert.equal(rows[0].place, 'Dungeon');
});

test('distant party labels distinguish a different region from a local town or dungeon', () => {
  const regionAt = x => x > 10 ? 'Hammerfell' : 'Daggerfall', here = { x: 1, y: 2 };
  assert.equal(partyPlaceLabel({ px: 20, py: 2, loc: 'A distant town', in: 0 }, here, regionAt), 'Hammerfell');
  assert.equal(partyPlaceLabel({ px: 2, py: 2, loc: 'Chesterwark', in: 0 }, here, regionAt), 'Chesterwark');
  assert.equal(partyPlaceLabel({ px: 2, py: 2, loc: 'Test crypt', in: 1 }, here, regionAt), 'Dungeon · Test crypt');
  assert.equal(partyPlaceLabel({}, here, () => { throw Error('no map'); }), 'Location approximate');
});

test('distances remain compact and coarse coordinates never imply exact measurement', () => {
  assert.equal(partyDistanceText(66), '66 m'); assert.equal(partyDistanceText(86074, false), '~86.1 km');
  assert.equal(partyDistanceText(1000), '1.0 km'); assert.equal(partyDistanceText(NaN), '');
});

const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const proj = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, -1, 0, 0, -0.2, 0];
const rect = { left: 10, top: 20, width: 800, height: 600 };
test('projection stays in a reduced viewport and behind-right is not mirrored left', () => {
  const ahead = projectPartyMarker([0, 0, -10], proj, view, rect);
  assert.equal(ahead.x, 410); assert.equal(ahead.y, 320); assert.equal(ahead.edge, false);
  const behind = projectPartyMarker([5, 0, 10], proj, view, rect);
  assert.equal(behind.x, 786); assert.equal(behind.edge, true);
  const rear = projectPartyMarker([0, 0, 10], proj, view, rect);
  assert.equal(rear.y, 596); assert.ok(Number.isFinite(rear.angle));
  assert.equal(projectPartyMarker([NaN, 0, 0], proj, view, rect), null);
});

test('outline bounds reduce distant drawing and remain inside an offset viewport', () => {
  const vp = [20, 30, 800, 500];
  const [x, y, w, h] = partyOutlineBounds([0, 0, -30], 2, proj, view, vp);
  assert.ok(w * h < vp[2] * vp[3] / 4);
  assert.ok(x >= 20 && y >= 30 && x + w <= 820 && y + h <= 530);
  assert.deepEqual(partyOutlineBounds([0, 0, -1], 2, proj, view, vp), vp);
});
