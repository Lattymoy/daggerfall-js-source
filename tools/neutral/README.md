# Neutral-pose paperdoll (redesign)

A ground-up redesign of the dagger paperdoll, NOT constrained to the
reference sprite (Mac's call). Proper standing figure: arms at the
sides, forward-facing legs/feet, designed anatomy. The 1:1 silhouette
pin and the sprite-trace architecture are retired for this model.

- `neutral-body.mjs` - builds the figure as loft profiles (torso,
  neck, head, deltoid/trap, arms, legs) + explicit box feet, then
  bakes ART_PAL palette shading per face (snapped ramp = blocky look).
  Writes a quantized face payload. `node neutral-body.mjs out.json`
- `viewer-template.html` - standalone Three.js orbit viewer (drag /
  pinch), `__PAYLOAD__` placeholder.
- `build-viewer.mjs` - runs the builder + injects payload -> viewer.
  `ARENA2_PATH=... node build-viewer.mjs dagger-viewer.html`

Status: iterating on form/proportion/shading in the viewer. Not yet
wired into the engine rig (buildBody) - that's the integration step.
