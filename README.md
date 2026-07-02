# project-dagger

1:1 JavaScript port of Daggerfall. Data layer and game logic translated from
Daggerfall Unity (MIT, Interkarma and contributors); presentation rebuilt on
hand-rolled WebGL2; characters rebuilt on our voxel system.

Docs live in `bible/` - start at `bible/Home.md`.

Original game data (ARENA2) is required and never committed. Point tests at it
with `ARENA2_PATH`.

## Scripts

- `npm run dev` - Vite dev server
- `npm test` - Node test runner
- `npm run build` - production build
- `npm run check` - test + build (pre-push gate)
- `npm run shot [out.png]` - headless render proof (needs ARENA2_PATH + provisioned Chromium)
