# CLAUDE.md

The docs are `bible/` - start at `bible/Home.md` (its Process rules bind every
change) and read `bible/01-Overview/Port-Doctrine.md` before touching code.
`npm run check` is the gate before a push.

- **Patch notes go in the pull request's description**, under
  `## Patch notes: <title>` (`.github/pull_request_template.md`). The desktop
  release reads them there. Never commit a patch-notes file:
  `test/rel4_release.test.js` fails the suite on one. Notes fixed after a
  release was cut reach it by dispatching `release-notes.yml` with its tag.
