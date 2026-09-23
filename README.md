# Daggerfall Enhanced

**Daggerfall Enhanced** - an open-source reimplementation of The Elder Scrolls
II: Daggerfall. Data layer and game logic translated from Daggerfall Unity
(MIT, Interkarma and contributors); presentation rebuilt on hand-rolled WebGL2.
MIT licensed, with Daggerfall Unity's notice alongside (LICENSE). The project's
working name in the docs and the code is `project-dagger`, and the repository,
the live domain and the desktop app's identifier still carry the old
`daggerfall-js` spelling - renaming those is a move outside this tree (BR1).

Play it: https://daggerfalljs.dev/

The site is `index.html` (what it is, how to play, credits); the game is
`play/index.html`, served at `/play/`. Both deploy from `main` to GitHub
Pages. The landing page takes its palette and fonts from the enhanced skin
at build (`scripts/landingHtml.mjs`) and carries no game data or imagery.

Docs live in `bible/` - start at `bible/Home.md`.

Original game data (ARENA2) is required and never committed. Point tests at it
with `ARENA2_PATH`.

## Support development

Daggerfall Enhanced is free and open source. Active development currently
costs about **$600 per month** to sustain across development tooling,
multiplayer infrastructure, testing, builds, releases, and mod compatibility
work.

Support on Ko-fi: https://ko-fi.com/dfjs

The monthly goal, suggested support levels, and funding breakdown are in
[`SUPPORT.md`](SUPPORT.md). Sponsorship does not lock gameplay, source code,
or normal releases behind a paywall.

## Scripts

- `npm run dev` - Vite dev server
- `npm test` - Node test runner
- `npm run build` - production build
- `npm run lint` - eslint over `src/` (no-undef, no-dupe-keys, ...)
- `npm run check` - lint + test + build (pre-push gate)
- `npm run cites [-- --apply]` - re-resolve line cites into files you changed (tools/citeShift.mjs)
- `npm run shot [out.png]` - headless render proof (needs ARENA2_PATH + provisioned Chromium)
- `node tools/landingProbe.mjs` - the landing page and `/play/` in a real browser, no ARENA2 needed
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

`npm run dist` in `app/` packages installers. Every push to main
builds them for all three OSes and attaches them to a GitHub Release
(`.github/workflows/release-desktop.yml`) at `app-v<major>.<minor>.<commit count>`
- the version is derived from the commit, never bumped by hand - and
the landing page's download section points at `releases/latest`.
Pushing a tag shaped `app-v*` cuts one by hand. An installed copy
(the Windows `-setup` install or the Linux AppImage) updates itself in
place on quit; macOS and the portable exe get a notice with a Download
button. Details
in `bible/01-Overview/Desktop-App.md`; headless proof:
`xvfb-run -a node tools/appShellProbe.mjs` (point `DAGGER_SHELL_EXE`
at a packaged binary to prove an installer's payload). The packaged
app bundles NO game data - same doctrine as the site.
