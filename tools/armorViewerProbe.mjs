import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ARMOR_CATALOG, MATERIAL_FAMILY } from '../src/characters/armorSet.js';
import { buildNeutralBody } from '../src/characters/neutralBody.js';
import { buildPaperdollPayload } from '../src/characters/paperdollPayload.js';

const expected = [102,103,104,105,106,107,108];
assert.deepEqual(ARMOR_CATALOG.map((a) => a.index), expected);
assert.equal(new Set(ARMOR_CATALOG.map((a) => a.slot)).size, 7);

const D = buildPaperdollPayload(null, null, null);
assert.deepEqual(D.armor.map((a) => a.index), expected);
const base = buildNeutralBody({
  skin: [[48,38,30],[96,72,54],[160,120,88],[220,180,140]],
  boot: [[30,24,20],[80,60,44],[130,100,72]],
});
for (const a of D.armor) {
  for (const family of [MATERIAL_FAMILY.Leather, MATERIAL_FAMILY.Chain, MATERIAL_FAMILY.Plate]) {
    const pack = a.families[family];
    assert.ok(pack, `${a.name} missing family ${family}`);
    if (a.kind === 'body') {
      assert.ok(pack.idx.length > 0, `${a.name} must move body faces`);
      for (let k = 0; k < pack.idx.length; k++) {
        const f = pack.idx[k];
        assert.notEqual(base[f].g, 'head', `${a.name} must never own head faces`);
        let moved = false;
        for (let j = 0; j < 12; j++) {
          if (Math.round(base[f].p[j] * 1000) !== pack.P[k*12+j]) { moved = true; break; }
        }
        assert.ok(moved, `${a.name} face ${f} must be geometry-owned`);
      }
    } else {
      assert.ok(pack.P.length > 0 && pack.C.length > 0, `${a.name} piece must have geometry`);
    }
  }
}
const left = D.armor.find((a) => a.index === 105).families[MATERIAL_FAMILY.Plate];
const right = D.armor.find((a) => a.index === 106).families[MATERIAL_FAMILY.Plate];
assert.equal(new Set(left.G).size, 1, 'left pauldron must be one limb group');
assert.equal(new Set(right.G).size, 1, 'right pauldron must be one limb group');
assert.notEqual(left.G[0], right.G[0], 'left/right pauldrons must animate on different arms');

const html = fs.readFileSync(new URL('../viewer.html', import.meta.url), 'utf8');
for (const id of ['armor-cuirass','armor-gauntlets','armor-greaves','armor-pauldronL','armor-pauldronR','armor-helm','armor-boots','armormat'])
  assert.ok(html.includes(`id=\"${id}\"`), `viewer missing ${id}`);
console.log('armor viewer probe: PASS');
