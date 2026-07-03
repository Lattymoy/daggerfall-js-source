// Vendored from project-final's Rewrite Engine (rewrite/core/palette.js) at C4a -
// same-owner code, flat-pathed; byte-parity against the canonical copy
// is pinned by test/rig.test.js over fixtures/bare-body-parity.json
// (captured from rewrite/rig at vendor time). Do not hand-diverge:
// upstream first, then re-vendor + re-capture.
// Palette + band-quantised flat shading (the voxel pixel-art look).

      // ════════════════════════ palette ════════════════════════
      const P = {
        metal: [104, 114, 129],
        metalD: [64, 70, 81],
        steel: [138, 146, 158],
        fde: [154, 125, 83], // flat-dark-earth furniture
        fdeD: [112, 88, 55],
        poly: [38, 40, 47],
        polyB: [25, 26, 32],
        skin: [205, 156, 119],
        skinL: [226, 181, 144],
        skinM: [186, 138, 104],
        skinD: [150, 108, 79],
        sleeve: [52, 58, 66],
        sleeveD: [36, 41, 48],
        cuff: [40, 44, 52],
        lens: [104, 214, 232],
        red: [210, 72, 60],
        bore: [10, 11, 13],
        white: [232, 234, 238],
      };

      const BANDS = 5;
      const AMB = 0.3;

      function clamp8(v) {
        return v < 0 ? 0 : v > 255 ? 255 : v | 0;
      }
      function shade(base, lit) {
        const t = lit < AMB ? AMB : lit;
        const tt = (t - AMB) / (1 - AMB); // 0..1 across the lit range
        const q = Math.round(tt * (BANDS - 1)) / (BANDS - 1); // banded
        const m = 0.55 + 0.62 * q; // shadow 0.55 -> highlight 1.17
        return [clamp8(base[0] * m), clamp8(base[1] * m), clamp8(base[2] * m)];
      }
      // continuous 0..1 brightness (pre-quantise) -- the rasterizer bands this per pixel for dithering
      function litT(lit) {
        const t = lit < AMB ? AMB : lit;
        return (t - AMB) / (1 - AMB);
      }
      // the BANDS discrete shades of a base colour (same ramp as shade); rasterizer picks one per pixel
      function bandsOf(base) {
        const out = [];
        for (let i = 0; i < BANDS; i++) {
          const m = 0.55 + 0.62 * (i / (BANDS - 1));
          out.push([clamp8(base[0] * m), clamp8(base[1] * m), clamp8(base[2] * m)]);
        }
        return out;
      }

export { P, BANDS, AMB, clamp8, shade, litT, bandsOf };
