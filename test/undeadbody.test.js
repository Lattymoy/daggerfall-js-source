// THE UNDEAD LINE, on the mechanism the orc line proved.
//
// Two things must hold, and the first one bit while this was being
// written: a build spec's keys must be REAL. The rig spreads a spec over
// its own BUILD_IDENTITY keys, so an invented one is dropped in silence
// — `gut: 1.24` on the zombie would have shipped a corpse with a flat
// stomach and nothing anywhere to say why. It is a zone now, and this
// test is why nobody has to remember that again.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { UNDEAD_DESIGNS, undeadOpts, UNDEAD_RAMPS } from '../src/characters/undeadBody.js';
import { buildRibcage, buildPelvis } from '../src/characters/pieces/skeletonBones.js';
import { buildNeutralBody, BUILD_IDENTITY } from '../src/characters/neutralBody.js';

const pal = { get: (i) => ({ r: (i * 7) & 255, g: (i * 5) & 255, b: (i * 3) & 255 }) };

test('undead: every build key is one the rig actually has', () => {
  for (const d of UNDEAD_DESIGNS) {
    for (const k of Object.keys(d.build)) {
      assert.ok(k in BUILD_IDENTITY, `${d.name} invents build key "${k}" — the rig will drop it silently`);
    }
  }
});

test('undead: every zone material is declared', () => {
  for (const d of UNDEAD_DESIGNS) {
    for (const z of d.zones) {
      assert.ok(d.mats[z.mat], `${d.name} uses material "${z.mat}" without declaring it`);
    }
  }
});

test('undead: they ride the base face list, adding and dropping none', () => {
  const base = buildNeutralBody({ skin: [[10, 10, 10], [200, 200, 200]], boot: [[5, 5, 5], [90, 90, 90]] });
  for (const d of UNDEAD_DESIGNS) {
    const { ramps, opts } = undeadOpts(d, pal);
    const f = buildNeutralBody(ramps, opts);
    assert.equal(f.length, base.length, `${d.name} changes the face count — it cannot ship as a delta`);
  }
});

test('undead: the zombie belly actually swells', () => {
  const z = UNDEAD_DESIGNS.find((d) => d.name === 'Zombie');
  const { ramps, opts } = undeadOpts(z, pal);
  const without = buildNeutralBody(ramps, { build: opts.build });
  const with_ = buildNeutralBody(ramps, opts);
  let moved = 0;
  for (let i = 0; i < without.length; i++) {
    for (let k = 0; k < 12; k++) {
      if (Math.abs(without[i].p[k] - with_[i].p[k]) > 1e-6) { moved++; break; }
    }
  }
  assert.ok(moved > 100, `only ${moved} faces move — the belly zone is not doing anything`);
});

test('undead: the ramps are index spans into ART_PAL, light to dark', () => {
  for (const [name, span] of Object.entries(UNDEAD_RAMPS)) {
    assert.equal(span.length, 2, `${name} is not a [first,last] span`);
    assert.ok(span[1] > span[0], `${name} runs backwards`);
    assert.ok(span[0] >= 0 && span[1] <= 255, `${name} leaves the palette`);
  }
});

// ── THE SKELETON IS THE ONE THAT NEEDED GEOMETRY ─────────────────
// A zombie is a human gone wrong and a mummy is a human wrapped up;
// both ride the loft. Ribs are separate bones with GAPS between them,
// and no girth multiplier will ever put a hole in a closed loft — so
// the skeleton is the first design here whose silhouette comes from a
// piece rather than from the body.

test('bones go to the bone-bodied, and to nobody else', () => {
  // This read "only the skeleton" until the lich arrived and it failed
  // correctly. A lich IS a skeleton — in robes — so it carries a cage
  // too; what must stay true is that nothing with flesh on it does.
  // THE RULE, NOT THE ROSTER. This listed its members by name and broke
  // twice — once when the lich arrived, once when the ancient lich did.
  // A gate that has to be edited every time a design is added is not
  // guarding a rule, it is keeping a register. What matters is the
  // relationship: ribs belong on bone and nowhere else.
  const withBones = UNDEAD_DESIGNS.filter((d) => d.bones);
  assert.ok(withBones.length > 0, 'nothing carries bones at all');
  for (const d of UNDEAD_DESIGNS) {
    if (d.bones) assert.equal(d.hideRamp, 'bone', `${d.name} has ribs over something that is not bone`);
  }
});

test('lich: bones AND a drape, which is the composition test', () => {
  // Every enemy before it carried one kind of thing: a tusk, a cage, a
  // body. A lich needs the piece table and the drape path to share a
  // figure, and they had never been asked to.
  const l = UNDEAD_DESIGNS.find((d) => d.name === 'Lich');
  assert.ok(l.bones, 'a lich without a ribcage is a wizard');
  assert.ok(l.drape, 'a lich without robes is a skeleton');
  assert.ok(l.mats[l.drape.mat], 'its robe material is not declared');
  // And the drape has to survive undeadOpts, or the viewer never sees it.
  const { drape } = undeadOpts(l, pal);
  assert.equal(drape.name, l.drape.name);
  assert.ok(drape.ramp.length > 2, 'the robe resolved to no colours');
});

test('skeleton: the body is scaled away so the bones ARE the silhouette', () => {
  const s = UNDEAD_DESIGNS.find((d) => d.name === 'Skeletal Warrior');
  // A skeleton whose torso is still human-width is a man in a rib
  // costume: the loft has to get out of the way of the cage.
  assert.ok(s.build.torso < 0.7, `torso ${s.build.torso} is too wide for bone`);
  assert.ok(s.build.neck < 0.7, `neck ${s.build.neck} is too thick for a spine`);
});

test('skeleton: the ribcage has gaps in it', () => {
  const ribs = buildRibcage(undefined, { torso: 0.62, ribs: 6, gap: 0.42 });
  // Six hoops of four faces, plus a sternum. If a change ever collapses
  // the hoops into a solid barrel this count moves and the gaps are the
  // thing that was lost.
  assert.equal(ribs.length, 6 * 4 + 1, 'the cage is not six ribs and a sternum');
  const ys = ribs.flatMap((f) => [f.p[1], f.p[4], f.p[7], f.p[10]]);
  const span = Math.max(...ys) - Math.min(...ys);
  assert.ok(span > 0.25 && span < 0.6, `the cage spans ${span.toFixed(2)} — that is not a chest`);
});

test('skeleton: the pelvis is two blades, not a block', () => {
  const p = buildPelvis(undefined, { torso: 0.62 });
  assert.equal(p.length, 6, 'a hip girdle with a hole through it is six faces, not a box');
  const xs = p.flatMap((f) => [f.p[0], f.p[3], f.p[6], f.p[9]]);
  assert.ok(Math.min(...xs) < 0 && Math.max(...xs) > 0, 'the blades do not sit either side of centre');
});

test('skeleton: its bones are tagged body, so they ride the torso', () => {
  for (const f of [...buildRibcage(), ...buildPelvis()]) {
    assert.equal(f.g, 'body', 'a bone tagged anything else hangs in the air through a swing');
  }
});

// ── THE VAMPIRES: THE FIRST HERE THAT KEEP THEIR BODY ────────────
// Every other design in this file is rotted, wrapped, bone or beast. A
// vampire keeps its body — that is the horror of it — so it says
// everything it says with COLOUR, and colour that does not separate
// says nothing at all.

test('vampire: the pallor reads against the coat', () => {
  const pal = {
    get: (i) => {
      const B = [[200,200,200],[186,176,160],[178,132,84],[214,158,170],[206,176,128],[150,148,172],
                 [120,160,214],[236,236,232],[140,200,200],[206,194,96],[150,196,120],[176,108,66],
                 [190,202,110],[170,150,200],[236,206,140],[222,108,66]];
      const idx = Math.max(0, Math.min(255, i | 0));
      const [r, g, b] = B[(idx >> 4) & 15];
      const k = 1 - (idx & 15) / 15;
      const f = 0.24 + k * 0.86;
      return { r: Math.round(r * f), g: Math.round(g * f), b: Math.round(b * f) };
    },
  };
  const mean = (ramp) => ramp.reduce((a, c) => a + (c[0] + c[1] + c[2]) / 3, 0) / ramp.length;
  for (const name of ['Vampire', 'Ancient Vampire']) {
    const d = UNDEAD_DESIGNS.find((x) => x.name === name);
    const { ramps } = undeadOpts(d, pal);
    const skin = mean(ramps.skin);
    const coat = mean(undeadOpts(d, pal).drape.ramp);
    // A pale face on a dark coat, or the whole figure is a silhouette
    // and the design has said nothing.
    assert.ok(skin > coat * 1.8, `${name}: skin ${skin.toFixed(0)} against coat ${coat.toFixed(0)} — too close to read`);
  }
});

test('vampires keep their body: no bones, and a near-human build', () => {
  for (const name of ['Vampire', 'Ancient Vampire']) {
    const d = UNDEAD_DESIGNS.find((x) => x.name === name);
    assert.ok(!d.bones, `${name} has a ribcage — it is not that kind of undead`);
    for (const [k, v] of Object.entries(d.build)) {
      assert.ok(v > 0.85 && v < 1.2, `${name} ${k}=${v} is not a body it kept`);
    }
  }
});

test('every design that wears something declares the material', () => {
  for (const d of UNDEAD_DESIGNS) {
    if (!d.drape) continue;
    assert.ok(d.mats[d.drape.mat], `${d.name} wears "${d.drape.mat}" without declaring it`);
  }
});

// ── A DRAPE HAS TO FIT WHO IS WEARING IT ─────────────────────────
// Every garment is carved once and shared by every design that asks for
// it — one grid per name, which is what keeps the payload small. But
// the BODY under it is resized by its build spec, and nothing was
// telling the cloth: every drape sat at scale 1.000 whoever wore it. A
// lich's robe was cut for a full-grown man and hung on a 0.60 torso;
// the ancient vampire is broader than the vampire and wore the same
// cloak; and where a design wears plate the armour displaces further
// out again and came straight through the garment.

const DRAPE_CLEARANCE = 1.06;
function drapeFit(design) {
  if (!design || !design.build) return 1;
  const b = design.build;
  const girth = (b.torso ?? 1) * 0.75 + (b.shoulder ?? 1) * 0.25;
  let under = 0;
  for (const z of design.zones || []) {
    if (!z.groups || !z.groups.includes('body')) continue;
    under = Math.max(under, z.th || 0);
  }
  return girth * DRAPE_CLEARANCE + under * 2.2;
}

test('drape: it clears the body it hangs on, for every wearer', () => {
  for (const d of UNDEAD_DESIGNS) {
    if (!d.drape) continue;
    const k = drapeFit(d);
    const torso = d.build.torso ?? 1;
    assert.ok(k > torso, `${d.name}: drape ${k.toFixed(3)} inside torso ${torso} — the wearer comes through it`);
  }
});

test('drape: it clears what the design wears UNDER it', () => {
  // A garment over plate has to start outside the plate. Two designs
  // with the same girth and different armour must not get the same fit.
  const bare = { build: { torso: 1, shoulder: 1 }, zones: [] };
  const plated = { build: { torso: 1, shoulder: 1 }, zones: [{ groups: ['body'], th: 0.03 }] };
  assert.ok(drapeFit(plated) > drapeFit(bare), 'armour does not push the garment out');
});

test('drape: girth only — a garment is never scaled in height', () => {
  // The rig's own law: every exported constant on it is a HEIGHT, so
  // scaling a garment vertically drops its hem through the floor on a
  // giant and hitches it to the knee on a lich.
  const src = readFileSync(new URL('../src/tools/paperdollViewer.js', import.meta.url), 'utf8');
  const call = /drapedMeshes\[nm\]\.scale\.set\(([^)]*)\)/.exec(src);
  assert.ok(call, 'nothing scales the drape at all');
  const [x, y, z] = call[1].split(',').map((t) => t.trim());
  assert.equal(y, '1', `the drape is scaled in Y (${y}) — heights are not ours to touch`);
  assert.equal(x, z, 'the drape is scaled unevenly across the body');
});

// ── SPECTRAL: THE FIRST DESIGN THAT IS NOT A SHAPE ───────────────
// Every enemy before these said what it was with geometry and colour —
// a tusk, a rib, a horse, a robe. A ghost has nothing to ADD to the
// figure and everything to take away: what makes it a ghost is that you
// see the wall through it, which is a material property, and the
// character path had never been asked for one.

test('spectral: only the spectral are, and they say how much', () => {
  const ghosts = UNDEAD_DESIGNS.filter((d) => d.spectral);
  assert.ok(ghosts.length >= 2, 'the spectral pair is not there');
  for (const d of ghosts) {
    assert.ok(d.spectral.opacity > 0.15, `${d.name} at ${d.spectral.opacity} is a smear, not a figure`);
    assert.ok(d.spectral.opacity < 0.7, `${d.name} at ${d.spectral.opacity} is not see-through`);
  }
});

test('spectral: a wraith is LESS there than a ghost', () => {
  // They are the same absence at different depths. At equal opacity a
  // wraith is just a blue ghost, and the difference between them has to
  // be the difference the eye actually sees.
  const g = UNDEAD_DESIGNS.find((d) => d.name === 'Ghost');
  const w = UNDEAD_DESIGNS.find((d) => d.name === 'Wraith');
  assert.ok(w.spectral.opacity < g.spectral.opacity, 'the wraith is no fainter than the ghost');
  assert.ok(w.build.torso < g.build.torso, 'the wraith is no thinner than the ghost');
});

test('spectral: the transparency does not outlive the ghost', () => {
  // The body material is SHARED by every design. Set it transparent for
  // a ghost and forget to set it back, and the next orc you pick is a
  // see-through orc.
  const src = readFileSync(new URL('../src/tools/paperdollViewer.js', import.meta.url), 'utf8');
  const sets = src.match(/mat\.transparent = [^;]+;/g) || [];
  assert.ok(sets.length >= 2, 'transparency is set but never cleared');
  assert.ok(
    sets.some((t) => /= false/.test(t)),
    'nothing ever sets the body back to solid',
  );
  // And a translucent body must not occlude its own far side.
  assert.ok(/mat\.depthWrite = !spec/.test(src), 'a see-through body still writes depth');
});
