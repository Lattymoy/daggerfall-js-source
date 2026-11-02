// SPRITE-GRAD (FIELD BUGS 2026-10-02c, Discord: "Black boxes around sprites in newer builds. Strange black boxes are
// appearing around sprites and 3d models in both app and web versions. Tried on a Mac M3. Does not seem to be resolved
// when changing texture filter options.") - ELITE FOES (2b42f1f9) moved the flats' albedo sample under a ?: (the widened
// quad's margin), and the emission map was read past the cut's discard. A flat's texture carries its whole mip chain
// and texture() picks the level off the 2x2 quad's derivatives, which GLSL ES 3.00 (8.9) leaves undefined inside
// non-uniform control flow: along a sprite's edge, where half a quad's lanes take the other arm, a GPU that does not
// keep those lanes' uv (Apple's, under Metal) read a tiny mip of dark RGB and middling alpha that passed the cut - a
// dark box round every flat, whatever the filter. Both billboard shaders (the classic lane's BB_FS, Enhanced
// Lighting's EL_BB_FS) now sample both maps before any branch or discard and mask the margin after. Compiled and drawn
// on a real WebGL2 context by tools/enhancedLightingProbe.mjs. Red on the record's code (42e50765).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const shader = (src, decl) => {
  const at = src.indexOf(decl);
  assert.ok(at >= 0, `${decl} not found`);
  const body = src.slice(at, src.indexOf('`;', at));
  return body.slice(body.indexOf('void main() {')).replace(/\/\/[^\n]*/g, '');   // the code alone: a comment may say "discard"
};

for (const [name, file, decl] of [['BB_FS', 'src/render/renderer.js', 'const BB_FS = `'], ['EL_BB_FS', 'src/render/enhancedLighting.js', 'export const EL_BB_FS = `']]) {
  test(`SPRITE-GRAD ${name}: the albedo and emission maps are sampled before the first branch or discard of main, never under a ?:, and the margin is masked after (mutants: the ELITE FOES ternary, the emission read past the cut)`, () => {
    const main = shader(read(file), decl);
    const firstIf = main.search(/\bif \(/), firstDiscard = main.indexOf('discard');
    // the chameleon's ripple is a uniform branch on the uv alone - its own line, no sample in it
    const lines = main.split('\n');
    const ripple = lines.findIndex((l) => /if \(uConceal\.x == 1\.0\) uv\.x \+= sin\(/.test(l));
    assert.ok(ripple >= 0, 'the ripple moves the uv on one line');
    const afterRipple = lines.slice(ripple + 1).join('\n');
    const albedo = afterRipple.indexOf('vec4 tex = texture(uTex, uv);');
    const emission = afterRipple.indexOf('vec3 emissionTexel = texture(uEmissionTex, uv).rgb;');
    assert.ok(albedo >= 0 && emission >= 0, 'both maps sampled plainly');
    const nextIf = afterRipple.search(/\bif \(/), nextDiscard = afterRipple.indexOf('discard');
    assert.ok(albedo < nextIf && emission < nextIf && albedo < nextDiscard && emission < nextDiscard, 'both before any branch or discard');
    assert.ok(firstDiscard > main.indexOf('vec4 tex = texture(uTex, uv);'), 'no discard ahead of the sample');
    assert.ok(firstIf >= main.indexOf('if (uConceal.x == 1.0) uv.x'), 'the only branch ahead of the sample is the ripple\'s');
    assert.doesNotMatch(main, /\?\s*vec4\(0\.0\)\s*:\s*texture\(/, 'never under a ?:');
    assert.equal((main.match(/texture\(uEmissionTex/g) ?? []).length, 1, 'the emission map read once, above the cut');
    assert.match(afterRipple, /if \(uv\.x < 0\.0 \|\| uv\.x > 1\.0 \|\| uv\.y < 0\.0 \|\| uv\.y > 1\.0\) tex = vec4\(0\.0\);/, 'the widened quad\'s margin, and the ripple\'s reach, empty');
  });
}
