# project-dagger

**Daggerfall JavaScript** - a 1:1 JavaScript port of Daggerfall. Data layer
and game logic translated from Daggerfall Unity (MIT, Interkarma and
contributors); presentation rebuilt on hand-rolled WebGL2.

The site is `index.html` (what it is, how to play, credits); the game is
`play/index.html`, served at `/play/`. Both deploy from `main` to GitHub
Pages. The landing page takes its palette and fonts from the enhanced skin
at build (`scripts/landingHtml.mjs`) and carries no game data or imagery.

Docs live in `bible/` - start at `bible/Home.md`.

Original game data (ARENA2) is required and never committed. Point tests at it
with `ARENA2_PATH`.

## Scripts

- `npm run dev` - Vite dev server
- `npm test` - Node test runner
- `npm run build` - production build
- `npm run check` - test + build (pre-push gate)
- `npm run shot [out.png]` - headless render proof (needs ARENA2_PATH + provisioned Chromium)
- `node tools/landingProbe.mjs` - the landing page and `/play/` in a real browser, no ARENA2 needed
- `node tools/verify-deploy.mjs` - after a push: proves the live `/play/` serves your commit
