# daggerfall-js-source

**Daggerfall JavaScript** - a 1:1 JavaScript port of Daggerfall. Data layer
and game logic translated from Daggerfall Unity (MIT, Interkarma and
contributors); presentation rebuilt on hand-rolled WebGL2. MIT licensed, with
Daggerfall Unity's notice alongside (LICENSE). The project's working name in
the docs and the code is `project-dagger`.

Play it: https://daggerfalljs.dev/

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
- `node tools/siteShots.mjs` - retakes the site's three pictures (public/site/); refuses to run with game data present
- `node tools/verify-deploy.mjs` - after a push: proves the live `/play/` serves your commit

## Desktop app

`app/` is the downloadable build: an Electron shell that loads the
same `dist/` the website deploys and adds what a browser can't -
**saves as real files** (DFU's own layout: `Saves/SAVE<n>/SaveData.txt`
+ `SaveInfo.txt` + `Screenshot.jpg`, settings under `Prefs/`) and
**ARENA2 read straight from your folder on disk** (picked once via a
native dialog - no ingest, no diet, full sky sets). The browser build
is unchanged; the storage seam is `src/systems/appStorage.js`.

```
npm run build && cd app && npm install && npm start
```

`npm run dist` in `app/` packages installers. Details in
`bible/01-Overview/Desktop-App.md`; headless proof:
`xvfb-run -a node tools/appShellProbe.mjs`. The packaged app bundles
NO game data - same doctrine as the site.
