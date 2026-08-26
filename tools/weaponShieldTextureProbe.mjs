import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SHIELDS, SHIELD_CATALOG, buildShield } from '../src/characters/shields.js';

const payload = fs.readFileSync(new URL('../src/characters/paperdollPayload.js', import.meta.url), 'utf8');
const viewer = fs.readFileSync(new URL('../src/tools/paperdollViewer.js', import.meta.url), 'utf8');
const tex = fs.readFileSync(new URL('../src/tools/paperdoll/weaponTexture.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../viewer.html', import.meta.url), 'utf8');

assert.deepEqual(Object.values(SHIELDS), [109,110,111,112]);
assert.deepEqual(SHIELD_CATALOG.map((s) => s.name), ['Buckler','Round Shield','Kite Shield','Tower Shield']);
const ramp = [[20,20,20],[220,220,220]];
for (const s of SHIELD_CATALOG) {
  const faces = buildShield(ramp, s.index);
  assert.ok(faces.length >= 36, `${s.name} must be a real extruded piece`);
  assert.ok(faces.every((f) => f.g === 'armR'), `${s.name} must ride the off-hand arm`);
}

for (const api of ['traceWeaponSprite','buildClassicWeaponPieceTexture','buildClassicShieldPieceTexture'])
  assert.ok(tex.includes(`export function ${api}`) || tex.includes(`export async function ${api}`), `missing ${api}`);
assert.ok(tex.includes("registration:'principal-axis-sprite-trace'"), 'weapon art must be traced by its own source axis');
assert.ok(tex.includes("wrapMode:'generated-8-way-axial'"), 'weapons need axial eight-way wraps');
assert.ok(tex.includes("sourceMode:'classic-shield-paperdoll-surface'"), 'shields must use classic paperdoll source art');
assert.ok(tex.includes('weaponDyeColor(material)'), 'weapon material matrix must use classic dye law');
assert.ok(tex.includes('armorArchive(gender, race)'), 'shield archive must follow wearer gender/race');

assert.ok(payload.includes('templateIndex: WEAPONS.Longsword'), 'weapon registry must carry immutable template indices');
assert.ok(payload.includes('templateIndex: WEAPONS[nm]'), 'parameterized weapon families must carry template indices');
assert.ok(payload.includes('shieldPacks: SHIELD_CATALOG.map'), 'payload must ship all shield meshes');
assert.ok(viewer.includes('buildClassicWeaponPieceTexture'), 'viewer missing classic weapon texture path');
assert.ok(viewer.includes('buildClassicShieldPieceTexture'), 'viewer missing classic shield texture path');
assert.ok(viewer.includes('syncActiveWeaponTexture()'), 'weapon texture must refresh with selection/material/gender');
assert.ok(viewer.includes('syncShieldTexture()'), 'shield texture must refresh with selection/material/gender/race');
assert.ok(viewer.includes('SHIELD_DEFS.forEach'), 'viewer must enumerate every shield');
assert.ok(html.includes('id="shield"'), 'viewer shield selector missing');
assert.ok(html.includes('all classic Daggerfall weapons'), 'weapon selector should advertise full classic registry');

console.log('weapon/shield texture probe: PASS');
