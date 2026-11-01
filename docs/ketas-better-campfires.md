# Keta's Better Campfires

Optional settings under World > Survival: owned camp beacons, Overworld markers, range, maximum height and opacity. Defaults off. Reads the existing live camp pool; packing/removal and floating-origin movement need no new save data. Hidden/remote camps are excluded and at most16 markers draw.

The beam begins at the fire sprite top, respects scene depth, grows from5m nearby to at most100m far away, and fades from55% of selected opacity to at most0.60. A single procedural quad is used per beam; no particle textures/framebuffer masks. Shader compilation is polled before use. GPU resources are disposed when disabled or the world stops.

No API proposal, patcher, combat rules, inventory automation or account files are included. Live gameplay/FPS acceptance remains pending; synthetic tests do not establish a real frame-rate improvement.
