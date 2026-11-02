// SLOPE-ALL (FIELD BUGS 2026-10-11g #2, the Discord's "Automap in dungeons not showing certain slopes": "the Automap is
// not showing certain slopes within the dungeons, I believe there was an issue like this once before", and "the issue is
// mostly not present without the use of the 'all' option"). The held map's All (ALL-FLOORS) cuts every placed model at
// the slice of the storey it stands on, and spares a face that CLIMBS between storeys - a ramp, a flight's tread. FS_A
// called a face a climb under a literal n.y < 0.97 (14.07 degrees), and Daggerfall's own ramp is 1:4: 14.04 degrees, n.y
// 0.97014 - so every such ramp was cut at its lower storey's slice and its upper run vanished. RAMP-INK (2026-10-05c)
// moved the climb's lower bound to the plan's floor law and left the upper one. The bound is one constant now
// (ui/ink/inkDungeonGL.js CLIMB_NY, climbsOf), and the shader's own expression is read here and run.
// bible/01-Overview/bugs/Field-Bugs-2026-10-11g.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rowMesh, climbsOf, CLIMB_NY, FLOOR_FACE_NY, faceInkOf } from '../../../src/ui/ink/inkDungeonGL.js';

const SRC = readFileSync(new URL('../../../src/ui/ink/inkDungeonGL.js', import.meta.url), 'utf8');
/** A slope along +z rising `rise` in a metre, wound to look up (as the world pass culls it), through the sheet's own mesh. */
const slope = (rise) => rowMesh({ positions: new Float32Array([0, 0, 0, 0, rise, 1, 1, rise, 1, 1, 0, 0]), indices: new Uint16Array([0, 1, 2, 0, 2, 3]), matrix: null });
const deg = (d) => Math.tan((d * Math.PI) / 180);
/** FS_A's ALL-FLOORS climb, as the shader's source writes it, run on (ny, the riser mark) - the GLSL expression with its two
 *  template constants filled as the module fills them. */
const shaderClimbs = (() => {
  const m = /bool climbs = (.+?);/.exec(SRC);
  assert.ok(m, 'FS_A\'s climb is no longer where this pin reads it');
  const js = m[1].replaceAll('${FNY}', FLOOR_FACE_NY.toFixed(6)).replaceAll('${CNY}', CLIMB_NY.toFixed(6)).replaceAll('n.y', 'ny').replaceAll('vN.w', 'w');
  assert.doesNotMatch(js, /\$\{|[A-Za-z_]\w*\s*\(/, 'the climb reads no constant or call this pin does not fill');
  return new Function('ny', 'w', `return ${js};`);   // eslint-disable-line no-new-func
})();

test('SLOPE-ALL: Daggerfall\'s 1:4 ramp CLIMBS - its face looks up at n.y 0.97014, is inked as floor, and FS_A\'s All cut spares it; every walked ramp from 3 to 65 degrees climbs, a level floor and a wall do not (mutants: the 0.97 back; the bound past a level floor; the shader\'s literal)', () => {
  const quarter = slope(0.25);
  assert.ok(Math.abs(quarter.nrm[1] - 1 / Math.hypot(1, 0.25)) < 1e-6, 'a 1:4 ramp looks up at n.y 0.97014');
  assert.equal(faceInkOf(quarter.nrm[1]), 'floor', 'it is ground walked');
  assert.equal(climbsOf(quarter.nrm[1], quarter.nrm[3]), true, 'and it climbs');
  assert.equal(shaderClimbs(quarter.nrm[1], quarter.nrm[3]), true, 'in the shader as it is compiled');
  for (const d of [3, 6, 10, 14, 14.04, 20, 30, 45, 55, 65]) {
    const m = slope(deg(d));
    assert.equal(shaderClimbs(m.nrm[1], m.nrm[3]), true, `${d} degrees climbs`);
    assert.equal(climbsOf(m.nrm[1], m.nrm[3]), shaderClimbs(m.nrm[1], m.nrm[3]), 'climbsOf is the shader\'s law');
  }
  const flat = slope(0);
  assert.equal(shaderClimbs(flat.nrm[1], flat.nrm[3]), false, 'a level floor is cut at its storey');
  assert.equal(shaderClimbs(0.9999, 1), false, 'a floor a hair off level is a floor');
  const wall = slope(deg(75));
  assert.equal(shaderClimbs(wall.nrm[1], wall.nrm[3]), false, 'steeper than the motor walks: a wall, cut');
  assert.equal(shaderClimbs(1, 1.4), true, 'a flight\'s marked tread climbs');
  assert.equal(climbsOf(1, 1.4), true);
});

test('SLOPE-ALL: the bound - past the 1:4 ramp, short of a level floor - and one constant in the shader (mutants: a second literal)', () => {
  assert.ok(CLIMB_NY > 1 / Math.hypot(1, 0.25) && CLIMB_NY < 0.9999, `${CLIMB_NY}`);
  assert.match(SRC, /bool climbs = \(n\.y > \$\{FNY\} && n\.y < \$\{CNY\}\) \|\| \(vN\.w > 1\.2 && vN\.w < 1\.5\);/);
  assert.doesNotMatch(SRC, /n\.y < 0\.9\d/, 'no literal climb bound left in the shader');
  assert.equal((SRC.match(/n\.y > \$\{FNY\}/g) ?? []).length, 4, 'RAMP-INK\'s one floor law, untouched');
});
