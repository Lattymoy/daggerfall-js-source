# CLAUDE.md

The docs are `bible/` - start at `bible/Home.md` (its Process rules bind every
change) and read `bible/01-Overview/Port-Doctrine.md` before touching code.
`npm run check` is the gate before a push.

- **Patch notes go in the pull request's description**, under
  `## Patch notes: <title>` (`.github/pull_request_template.md`). The desktop
  release reads them there. Never commit a patch-notes file:
  `test/rel4_release.test.js` fails the suite on one.
- **The bible's indexes are pointers, not records.** A new Active-Arcs entry
  is at most 700 characters, a Testing.md row at most 1,000 (rewrite it -
  never append history), a dated page at most 32 KB:
  `test/growth1_bible.test.js` fails the suite on growth.
