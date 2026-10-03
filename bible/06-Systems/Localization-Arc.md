# Localization Arc (L10N)

**Mac, 2026-09-27:** *"I want a proper localization/translation integration for our game. I believe patches exist
online, but I want to do this for as many languages as we possibly can and do this right."*

Daggerfall Unity ships one language, English, and lets a translation pack overwrite it in place. The port had no text
layer at all: every string DFU resolves through `TextManager` was an English constant in the code, with the key named
in a comment (the standing MECHANISM departure, Port-Ledger A), and the classic windows could draw ASCII only. This
arc ports DFU's text system 1:1, so every DFU translation pack works as it stands. It then goes past DFU where DFU
stops: real locales, switching in play, plurals, every script, and the port's own strings.

## Mac's decisions (2026-09-27)

Asked the three questions that were his:

1. **Community packs: "Install + bundle allowed".** A player can install any DFU translation pack from their own disk,
   and the port redistributes nothing to make that work. The port bundles a pack only when its terms allow it, credited
   and kept as separately licensed data. Mac asks the other packs' authors for permission.
2. **AI translation: "AI drafts, labeled".** Where no human translation exists, Claude drafts one. That covers all of
   the port's own strings in every language, and whole languages no pack covers. The game says which languages are
   machine translated, and fixes come in through a review file or PRs. A human pack always outranks a draft.
3. **Running the bulk: "Both".** The port's own strings are translated in-session. The large body of game text (about
   250,000 words a language: quests, books, dialogue) goes through a pipeline tool on the Claude API that Mac runs with
   his key (L10N6b).

## What Daggerfall Unity has (the law to port)

Read at DFU commit 2343305 (2026-09-14); v1.1.1 is the latest release.

- **TextManager** (`Assets/Scripts/Game/TextManager.cs`) - ten string-table collections: `Internal_Strings` (990 rows,
  symbolic keys), `Internal_RSC` (1,448 - TEXT.RSC by record id, 9000 split into 9000.1..40), `Internal_Flats` (226),
  `Internal_Quests` (`{QUEST}.{messageId}`), `Internal_Locations` (15,251, by MapId), `Internal_Settings` (32),
  `Internal_Spells` (88), `Internal_Items` (288), `Internal_MagicItems` (59), `Internal_Factions` (366).
  `GetLocalizedText` reads the runtime collection, then the default one, then answers `<LocaleText-NotFound>` or throws.
  The lists (`enemyNames`, `regionNames`, `monthNames`, the building-name part lists...) are newline-separated values,
  split and cached forever. The name helpers take a canonical fallback.
- **StringTableCSVParser / StringTablePatcher** - a pack is one `<collection>.csv` per collection, two columns
  `Key,Value`, UTF-8. It is read by a regex whose quirks every pack is authored against: an unquoted value is cut at its
  first comma, and the header is dropped only when it is exactly `Key,Value`. It is merged key by key over the English
  table. Mods are searched first, then `StreamingAssets/Text`.
- **Quests and books** - `Text/Quests/<QUEST>-LOC.txt` (the QRC half only; lookup `S0000977.1011`) and
  `Text/Books/BOKnnnnn-LOC.txt` (`LocalizedBook.cs`, with header keywords and markup). Menu text lives in Table-format
  `.txt` files (`MainMenu`, `GameSettings`, `DialogShortcuts`, `ModSystem`), name banks in `NameGen.txt`, and
  biographies and FACTION.TXT under StreamingAssets. Mod strings go through `Mod.Localize` and `[<locale>]textdatabase.txt`.
- **No locale switching.** One locale ships ("English (en)"). A pack overwrites English rather than adding a language.
  There are no plurals and no locale fallback chain.
- **Fonts** - `RegisterLocalizedFont` forces SDF on; a pack drops `FONT000x-SDF.ttf` into `StreamingAssets/Fonts`.
  The classic FNT path is Latin-1 at most. There is no RTL, bidi or shaping, and lines wrap at ASCII space only.
- **Grammar** (`Localization/Grammar.cs`, master only, PR #2667, 2026-05-17) - one `GrammarRules` processor, the
  identity by default. The French pack replaces it with `FrenchGrammarRules` (MIT, Daneel53).
- The translator workflow is DFU's wiki page "Translating Daggerfall Unity".

## What exists online (2026-09-27)

Every full-game translation below targets DFU's own format, so a player can install any of them once L10N3b lands.
None of them translates the port's own strings - those are the port's.

| Language | Project | Coverage | Terms |
|---|---|---|---|
| French | Daneel53, Pango (Nexus 456, GitHub Daneel53/DFU-en-francais) | complete, grammar module | permission needed; `FrenchGrammarRules.cs` is MIT |
| German | Deepfighter, Numenorean (Nexus 826, GitHub deepfighter/daggerfall-deutsch) | near complete, beta | permission needed (whole package, non-commercial, named hosts only) |
| Russian | Jagget (Nexus 511, GitHub Jagget/Daggerfall-Rus) | "the most complete" | permission needed; a chain of earlier authors |
| Ukrainian | Ivan Kuzyk (Nexus 819) | main game and mods | permission needed |
| Portuguese (BR) | Equipe Adaga (Nexus 565) | complete, review pending | credit-only - may be re-uploaded with credit |
| Spanish | NarrodRecandriall (Nexus 1251, GitHub Narrod-Dev) | complete, machine-assisted | GPL-3.0 on GitHub; credit-only on Nexus |
| Italian | XSpettro101X (Nexus 1182) | complete, AI-assisted | credit-only |
| Turkish | w0fie (Nexus 698) | 99%, place names untranslated | credit-only, "some assets belong to other authors" |
| Japanese | sasanoki (Nexus 1195) | in development | no redistribution |
| Korean | munument1 (GitHub munument1/Daggerfall_Unity_kr) | first pass complete, AI-assisted | no license (all rights reserved) |
| Chinese (Traditional) | kuanfu0430 (GitHub fork, `l10n/zh-TW`) | complete | the fork's root LICENSE is DFU's MIT; to be confirmed with the author |
| Chinese (Simplified) | chengdh (GitHub dfu-translation-cn) | machine output, quests missing | GPL-3.0; bundles SimSun, a proprietary font - never bundle that |

None was found for Polish, Czech, Hungarian, Vietnamese, European Portuguese or Dutch, and no Weblate, Crowdin or
Transifex project exists for DFU. The packs' textures and subtitled videos are edits of Bethesda assets and fall
under the port's no-ARENA2 rule. So they are never bundled, whatever the pack's terms say.

## The port before this arc

About 4,750 English sentences and 3,650 labels in code, most of them the port's own (the online game, the enhanced
skin, the port's systems). About 83 files cite `Internal_Strings` keys. The narrow seams that already existed are
`localizedText(key)` (talk, prison, arrest), `localizedLocationName`, `getLocalizedQuestDisplayName` and Travel
Options' `localize`, all wired back to English. Classic windows fold every code point above 127 to `?`, and the
TEXT.RSC, BOK and rumor readers drop high bytes. Saves hold English text (quest messages, notebook entries, rumors,
some item names), and canonical region and location names double as keys. About 2,400 test assertions pin English text.

## The plan

English stays byte-identical as the default throughout.

1. **L10N1 - DFU's text core** (below).
2. **L10N1b - the language setting** (below): a `uiPrefs` key, a picker on the front door's Settings and a first-run
   offer, before ARENA2; applied at once, and the page's `lang` follows.
3. **L10N2 - any script** (below): a locale's registered font turns on the classic SDF arm, with glyphs rasterized on
   demand into a dynamic atlas through canvas, and Chinese and Japanese lines break between characters.
4. **L10N3 - DFU content through the tables**, so a DFU pack works as it stands. In parts, by what a player reads
   most: **L10N3a** TEXT.RSC (below); **L10N3c** the quests' `-LOC` files; **L10N3d** the `Internal_Strings` keys
   (about 306 of DFU's 990, held as constants in some 80 files); **L10N3e** the names and lists (regions, locations,
   spells, items, factions, flats, enemies, the calendar); **L10N3f** books, NameGen, BIOGs, FACTION.TXT and the
   vendored mods' text.
5. **L10N3b - install a DFU pack from disk** (below): a pack (zip or folder) goes into a locale slot, browser or desktop
   app.
6. **L10N4 - the port's own strings** into `Port_Strings`, module by module. The English-only grammar is fixed on the way
   (plurals, possessives, word order, ordinals, a/an), and a lint rule stops new hardcoded strings.
7. **L10N5 - saves hold ids**, and text is rendered again on load.
8. **L10N6 - translations shipped**: the allowed packs bundled with a credits page, AI drafts of `Port_Strings`, a
   machine-translated label, a coverage report per language, and a contribution workflow. **L10N6b** - the pipeline tool.
9. **L10N7 - later**: right-to-left languages, the roughly 160 UI images with English painted into the art, and Unicode
   player names online.

## L10N1 (2026-09-27): DFU's text core

`src/systems/textManager.js`, a leaf module (it imports nothing).

**Ported 1:1:**
- TextManager's collections: `GetLocalizedText`, `GetLocalizedTextWithReversion`, `GetLocalizedTextList`,
  `GetLocalizedTextListFromKeyArray`, `TryGetLocalizedText` and `SplitTextList`.
- The id-keyed name helpers: region, location, spell, item, magic item and faction.
- The runtime collection names, and the localized-font registry, which forces SDF on through a host hook.
- `StringTableCSVParser` - the regex verbatim, with its quirks - and `StringTablePatcher`.
- `GrammarRules`, `DefaultGrammarRules` and `GrammarManager`.
- DFU's `GetDefaultCollectionName` has no `TextFlats` case, so a flats miss falls back to `Internal_Strings`. Kept.
- `GetLocalizedEnemyName`'s index law keeps its one home (`characters/enemyBasics.js` `enemyDisplayName`), which will
  read the list from here.
- `formats/rscTable.js` `parseRscCsv` now rides the one CSV law. The port's own reader kept a trailing newline on nine
  master rows, which `parseRscMarkup` strips anyway. MAC-U's no-imports pin was re-aimed to its stated reason: the
  table's one import is a module that imports nothing, so there is still no cycle with the reader.

**The port's departures** (Port-Ledger A, "THE PORT'S LOCALES"):
- **Locales.** There is a table set per locale, and a lookup walks the chain - the tag, each shorter tag, then `en`
  (`pt-BR`, `pt`, `en`).
- **English stays in the code.** `localizedText(key, en)` answers a table's word or the constant, so English is
  byte-identical by construction. An empty constant stays empty; an empty table value is still the table's word.
- **The list cache** is keyed by locale and cleared by a patch.
- **`Port_Strings` and `t(key, en, args)`.** This is an ICU MessageFormat subset: `{x}`, `{n, number}`,
  `{n, plural, ...}`, `{n, selectordinal, ...}` and `{x, select, ...}`, with categories from `Intl.PluralRules`.
  - `#` prints the plain number, so an English pattern prints exactly what `${n}` did.
  - Apostrophes follow ICU's default mode, so "don't" is plain text.
  - A malformed pattern is answered as it stands, never thrown; `parseMessage` throws, for the catalog checks.
- **The pseudo-locale `qps-ploc`.** Routed text is accented, lengthened by a third and bracketed once. DFU macros,
  `{0}`, `[/markup]`, quest symbols, `<ce>` codes and every argument's value pass whole, and a table's own word is
  never pseudo-localized.

Nothing is routed through it yet: L10N3 moves DFU's keys, and L10N4 moves the port's own strings.

**Pinned:** `test/l10n1.test.js` (13), over fixtures, the vendored master `Internal_RSC.csv` (1,448 rows, as DFU reads
it) and, with a DFU checkout (`DFU_PATH`), DFU's own C#: the collection names, the error string and the CSV line pattern.
The master CSVs read at their own row counts (990, 1,448, 226, 15,251, 32, 88, 288, 59, 366).

**Mutants:** `tools/mutants/l10n1.json` has 22 mutants, 21 dead. One is recorded as equivalent: the clear on a locale
switch is belt-and-braces, because the cache key already carries the locale.

## L10N1b (2026-09-27): the language setting

The player picks a language, and the port's text in it is fetched, applied and remembered.

**The languages** - `src/systems/localeCatalog.js`, pure:
- 25 languages beside English: Bulgarian, Chinese (Simplified and Traditional), Czech, Danish, Dutch, Finnish, French,
  German, Greek, Hungarian, Indonesian, Italian, Japanese, Korean, Norwegian (Bokmål), Polish, Portuguese (Brazil),
  Romanian, Russian, Spanish, Swedish, Turkish, Ukrainian and Vietnamese. The pseudo-locale is hidden (`?lang=` only).
- Each entry has its tag, its own name, its English name, its script and its source. Every language is `machine`
  until a human translation lands. Chinese is tagged by script (`zh-Hans`, `zh-Hant`), not region.
- Right-to-left and complex scripts (Arabic, Hebrew, Persian, Thai, the Indic scripts) wait for L10N7's shaping.
- `resolveLocale` answers English for a tag the catalog lacks or the build holds no text for.
- `localeForBrowser` reads the browser's list in order: the exact tag, then the Chinese and Norwegian folds (`zh-TW`,
  `zh-HK` and `zh-MO` read Traditional; `no` and `nn` read Bokmål), then the language alone (`pt-PT` finds `pt-BR`). A
  browser that lists English first is offered nothing.

**The build** - `src/scenes/localeData.js`:
- Every `locales/<tag>/<table>.csv` is a lazy chunk (`import.meta.glob`, `?raw`), patched into its locale's table of
  the same name. So a DFU pack's own CSVs can sit beside the port's. Under bare node the glob is absent, so node sees
  no files (the module still loads) and the tests feed the same files off the disk.
- A load that fails is forgotten, so the next ask fetches it again.
- Only the chosen language's chain is fetched. `locales/en/` is never loaded: English is the code's.
- `main.js` awaits `initLocale` before any door draws text, behind a dynamic import (BOOT2's ceiling on the entry's
  static graph). `?lang=` wins for one visit; otherwise the `language` pref. A failure leaves English standing.
- The page's `lang` and `dir` follow the locale, for the browser's fonts, hyphenation and screen readers.

**The menu** - `ui/enhancedMenu.js`:
- The rail's thirteen words go through `t()` (`menu.rail.*`). Their ids stay the English labels', so the probes'
  `door-<id>` selectors hold in every language.
- **The Language row** heads Settings > Interface on the front door only; a running game keeps the language it booted
  in. A choice switches at once: the text fetched, the core switched, the menu redrawn. A machine-drafted language
  says "Machine translated".
- **The first-run offer.** A player whose browser reads another language first is asked once, in that language
  (`tIn`), with a note that the translation is machine-made. Either answer is remembered (`languageOffered`). It shows
  only when the boot fetched that language's text, so it can never ask in English.
- **The account window waits** while the offer stands (ACC1f offers it once a visit). The probe found it covering the
  offer, so a French player was asked in English before French. On a phone the offer stands beside the profile
  portrait, not over it.

**The strings** - `tools/l10nExtract.mjs` reads every `t` and `tIn` call off the source with acorn and writes
`locales/en/Port_Strings.csv` (20 strings), or checks it (`--check`). It refuses a key that is not a dotted name, an
English that is not a literal, one key with two Englishes and a pattern the ICU subset cannot read.
`formatStringTableCsv` is the one writer: Key,Value, every value quoted. What DFU's parser cannot read back is refused.
The 25 languages' `Port_Strings.csv` are Claude's drafts (Mac: "AI drafts, labeled"). `locales/README.md` is the
translators' page.

**Pinned:** `test/l10n1b.test.js` (8). It covers the catalog, the pure laws, the English catalog in step with the
source, and every language's file: the writer's own form, every key, a readable pattern, the English's arguments. It
also runs `t` and `tIn` over the drafts and checks the rail's English reads back as its labels. It runs the boot's
laws over files fed off the disk: the saved choice, `?lang=`, the chain fetched once, the offer's preload, and a failed
load leaving English. It pins the boot's order, the prefs and the menu by source, and round-trips the writer. `tools/languageProbe.mjs` (36 checks, Chromium, no ARENA2) shows
the rest: the offer asked in French and answered both ways, only the chosen language fetched, the Settings row
switching French to German to English at once, `?lang=ja` for one visit, the pseudo-locale, and no page errors.

**Mutants:** `tools/mutants/l10n1b.json` has 33 mutants, all dead.

## L10N2 (2026-09-27): the classic screens draw any script

Daggerfall's five FNT fonts hold printable ASCII, and DFU draws them through `Encoding.ASCII`, so a translation's
letters reached the classic windows as question marks. DFU's answer is the localized font: a translation registers a
face for each of the five fonts (`TextManager.RegisterLocalizedFont`, which forces `GUI/SDFFontRendering` on), and
`DaggerfallUI.GetFont` hands that face out ahead of every other while its locale is selected. The port now does the
same.

**Ported:**
- **The dynamic atlas** - `src/ui/glyphFace.js`. DFU makes its faces with `AtlasPopulationMode.Dynamic`:
  `HasSDFGlyph` asks `TryAddCharacter` for a code it has not seen, and a code the font cannot give is remembered as
  missing. Here a glyph is rasterised through canvas the first time it is asked, shelf-packed into 1024-texel pages.
  A page is uploaded before its first draw, and again only after it grew. Metrics stay TMP's, in 45-point units.
- **The priority** - `ui/text.js` `sdfOf`: the current locale's face for the font's name, then a UI pack's (OVH2),
  then Daggerfall's own glyphs. `makeFont` names each font as `DaggerfallFont.FontName` does, which is the key.
- **The forced setting**: registering a face sets `GUI/SDFFontRendering` on in memory, as DFU's setter does.
- OVH2's pack face grows too. It is seeded with the same 191 codes and adds the rest on demand, so a pack's own
  letters (the French pack's `œ`) draw.

**The port's departures** (Port-Ledger A, "THE PORT'S LOCALES"):
- **The port's own faces** - `src/ui/localeFaces.js`. Every language but English gets one face for its five fonts,
  over the system's fonts for its script. So no font file is bundled and no request is made. Han takes its
  region's fonts first, since one code point is drawn differently in Japan, the mainland and Taiwan. A pack's own font
  for the same name is kept, and English registers nothing: Daggerfall's pixel fonts, byte for byte.
- **A glyph the face lacks** draws in the browser's fallback font rather than as `?`, since canvas always finds one.
  Only control codes are missing.
- **The line break** - `ui/talkWindow.js` `wrapText`. Chinese and Japanese put no spaces between words, so a line may
  break between two of their characters (UAX #14's ideographic class). A closing mark or small kana never starts a
  line and an opening mark never ends one (kinsoku). Korean breaks at its spaces, a Latin word inside CJK text stays
  whole, and English breaks exactly where it did. DFU's `TextLabel` only cuts a spaceless row at the overflowing glyph.

**Not owed, found on the way:**
- **Code pages.** DFU decodes TEXT.RSC as UTF-8 a byte at a time (`TextFile.cs:399`), and FACTION.TXT and FLATS.CFG
  whole as UTF-8 (`FactionFile.cs:756`, `FlatsFile.cs:104`), so a high byte from an old code page is U+FFFD there. A
  translation reaches DFU through the string tables, not the classic files, so no decoder is owed.
- **Web fonts for the enhanced skin.** Its text is the browser's, and the page's `lang` (L10N1b) picks each script's
  system font, Han's regional forms included. Its one Google Fonts request stays one.

**Pinned:** `test/l10n2.test.js` (6). It runs the face over a fake canvas: growth, a missing code remembered, shelves
that never overlap, the next row and page, and uploads. It checks the priority, measuring and drawing by code point,
English untouched, the port's faces (a pack's kept, the setting forced, Han by region), the boot installing them, and
the line break against the old law on English. `tools/classicTextProbe.mjs` (45 checks, Chromium, no ARENA2) draws
French, German, Polish, Vietnamese, Russian, Greek, Japanese, both Chinese scripts and Korean through a real WebGL
renderer. Each line's ink ends where its measured advance does, and English, left to Daggerfall's glyphs, draws no
face.

**Mutants:** `tools/mutants/l10n2.json` has 30 mutants, all dead. The first run left four alive (a missing glyph
measured again, `makeFont` not naming its font, kinsoku at a line's head, a Latin word cut inside CJK text), and the
pins were tightened until each died.

## L10N6b (2026-09-27): the translation pipeline

Mac's third decision: the port's own strings are translated in-session, and the game's text (about 250,000 words a
language) goes through a pipeline on the Claude API that he runs with his key. `tools/translate.mjs` is that pipeline.

- **What it writes.** A language's string table, `locales/<tag>/<table>.csv`, in DFU's own format. So a draft and a DFU
  translation pack are the same kind of file, and the game loads both the same way.
- **The sources.** `Port_Strings` from the English catalog, and DFU's nine tables from their English masters under
  `vendor/dfu-text/` (all nine vendored, MIT, from DFU's own folder at 2343305). Every table is read as DFU's LoadCSV
  reads it, the BOM stripped: DFU's masters and a pack's files open with one, and a kept BOM makes the header a row -
  the first cut of the tool would have sent `Key,Value` to be translated.
- **The request.** Rows go out in batches (40 by default, 4 at a time) to the Messages API, and the answer comes back
  through a forced tool. The system prompt is cached, since every batch of a run shares it. It gives the game, the
  language, the register, every placeholder rule, and the language's glossary (`locales/<tag>/glossary.json`), so a
  name is the same in every batch. A rate limit or an overload is waited out with backoff. The model defaults to
  `claude-opus-5-5`; `--model claude-sonnet-5` costs less.
- **No placeholder lost.** A draft is kept only if it carries exactly what its English does: the ICU arguments by name
  for the port's strings (a language's own plural categories allowed), and Daggerfall's %macros, `[/markup]` tags,
  `{n}` arguments and quest symbols, as a multiset. A broken draft is asked for once more with its problem named, and
  left out if it is still broken.
- **No person overwritten.** Beside each table, `<table>.meta.json` keeps a hash of the English the pipeline read and
  of the text it wrote. A row whose text no longer matches was edited by someone, and is theirs from then on: kept,
  marked `human`, never drafted over. When a person's row's English changes, it is reported stale for them to review.
  A machine row is drafted again when its English changes, or on `--retranslate`.
- **No surprise cost.** `--dry-run` prints the prompt and the batches and sends nothing; `--limit` caps a run.
- The 25 languages' `Port_Strings` drafts, written in-session, are recorded as the machine's (`claude-in-session`).
  So the pipeline redrafts them when their English moves, and never mistakes them for a person's.

**Pinned:** `test/l10n6b.test.js` (6): the placeholder law, the ownership plan, a whole run over a stand-in model (the
second ask, the rejection, a person's row kept, the English's order, a second run owing only the broken row), the dry
run, the request's shape against a fake `fetch` (the key, the version, the cache mark, the forced tool, a 429 waited
out, a 400 said), and the in-session drafts' meta.

**Mutants:** `tools/mutants/l10n6b.json` has 20 mutants, all dead.

## L10N3a (2026-09-27): TEXT.RSC in a translation's own words

TEXT.RSC is most of what a classic player reads: message boxes, dialogue frames, character creation, the guilds and
shops. The port's reader (`formats/textRsc.js`, `TextRsc`) is asked about 150 times from some 40 modules, and every
ask goes through its eight readers.

**Ported 1:1:**
- **The table first** - `TextProvider.GetRSCTokens`: the string table `Internal_RSC` (DFU's `RuntimeRSCStrings`, so a
  mod's redirect is honoured) is asked for the record's id before TEXT.RSC is opened.
- **The importer** - `DaggerfallStringTableImporter.ConvertStringToRSCTokens`, as `markupTokens`. A newline is editor
  air, each `[/...]` run is one markup, the prefixed ones (`pos`, `font`, `color`, `scale`, `image`) are parsed and are
  text when they do not match, and an unknown markup is text.
- **The class questions** - DFU's table keys the forty apart (`9000.1`..`9000.40`), and `GetQuestions` reads them a
  token at a time (`GetRSCTokens(string)`, no file to fall back to). `classQuestions.js` reads them so when a
  translation has them, and splits the classic record at its braces when it does not.

**Why tokens.** A row is text, not bytes: its letters are any script's, and `ü` is `0xFC`, JustifyLeft's own byte. So
a row is read into tokens, and each reader answers from them by its byte arm's own law: the variants and their
step-back, R13's draw on a one-variant record, the rows and their centring, the flat pool, `[/end]` ending it all.
The byte arm is untouched.

**English asks no table**: its text is the file's and the carried DFU rows' (`rscTable.js`), exactly as before. A
language walks its chain (`pt-BR`, then `pt`), and a record its table lacks is read from the carried rows and then
the file.

**Pinned:** `test/l10n3a.test.js` (4): the importer's law; each reader over a French row, letters whole, with English
and a missing record on the file; an English table row never asked; the chain, `[/end]`, the carried row beneath a
translation's, a redirected runtime collection; and the class questions both ways.

**Mutants:** `tools/mutants/l10n3a.json` has 21 mutants, all dead. The first run left five alive (English asking a
table, a trailing empty row kept, text past `[/end]` in the random pool, and two readers the file could answer by
coincidence), and the pins were tightened until each died.

## L10N3b (2026-09-27): a DFU translation pack, installed from the player's own files

Mac's first decision: a player installs any DFU translation pack from their own disk, and the port bundles only the
packs whose terms allow it (L10N6). Nothing of a pack is committed or uploaded here: the player brings their own, as
they bring ARENA2, a music pack or their Morrowind files.

- **What a pack holds** - `src/systems/translationPacks.js`, pure. Each file is read by the folder DFU reads it from:
  the last `Text` or `Fonts` folder on its path, in any case and with either slash. So a pack's own top folder, a zip's,
  or a whole `StreamingAssets` tree all read the same.
  - `Text/<Table>.csv` - a string table.
  - `Text/Quests/<QUEST>-LOC.txt` and `Text/Books/<BOOK>-LOC.txt`.
  - `Text/NameGen.txt`, and `Text/<Name>.txt` text tables (MainMenu, a grammar's lists).
  - `Fonts/FONT000N-SDF.ttf|otf` and its `.txt`.
  - Anything else (a README, the translators' tools, textures) is left. A pick with no table, quest or book is no
    translation, and is refused without changing anything.
- **Where it is kept** - `src/scenes/translationStore.js`: an IndexedDB database of its own
  (`daggerfall-translations`), as the roads cache has its own, so the game-data database needs no version bump. One
  pack a language: a new one replaces the old whole. Text is decoded as UTF-8 with the BOM stripped, as a StreamReader
  strips it; a font is kept as bytes.
- **Put to use** - `scenes/localeData.js`. A language's text loads the build's drafts first and then the pack over
  them (StringTablePatcher's overwrite), so a person's translation outranks a machine's, key by key. A key the pack
  lacks keeps its draft.
  - The pack's font is loaded as a FontFace and registered as DFU registers a localized font, ahead of the language's
    own face; a font the pack does not bring keeps that face.
  - Its quests', books', name banks' and text tables' text is kept for the readers that ask (`localePackText`, the
    chain walked). L10N3c and L10N3f are those readers.
  - Installed or removed, the language's tables are emptied and read again at once, so the change shows without a
    reload. The packs are read before the boot registers any language.
- **The row** - Settings > Interface, under the Language row, on the front door: "Translation pack", with Install (a
  folder, or its .zip), Replace and Remove, and the pack's name and counts once installed. English has none: English is
  the game's own. The language select no longer stretches over its row's words.

**Pinned:** `test/l10n3b.test.js` (5): the classifier (the last `Text` on a path, any case, either slash, a later file
of a kind and name replacing an earlier), the store over an in-memory IndexedDB (only what the game reads, text and
bytes, a replacement, a refusal that changes nothing, another language's files never mixed in, removal, no IndexedDB
at all), the pack at work over the drafts (and pt's pack text beneath pt-BR's), its font where a FontFace exists, and
the row by source. `tools/translationPackProbe.mjs` installs a real pack through the row in Chromium (`PACK_DIR`, a
pack on your own disk): run with the French pack, 354 files from its folder and 352 from its zip, its
`Internal_Strings` and TEXT.RSC rows live, its FONT0003 the face drawn, all of it still there after a reload and gone
after Remove - 13 checks.

**Mutants:** `tools/mutants/l10n3b.json` has 23 mutants, all dead. The first run left three alive (the first `Text`
on a path read instead of the last, one language's files mixed into another's, and the pack text's chain walk), and
the pins were tightened until each died.

## L10N3c (2026-09-27): a quest in a translation's own words

DFU keeps a translation's quest text in a `-LOC` file beside the quest: `S0000977-LOC.txt`, its header and its QRC
messages, no logic. `src/systems/quest/localizedQuest.js` ports the three places DFU reads it.

**Ported 1:1:**
- **`Parser.ParseLocalized`** (`parseLocalizedQuest`). It reads the DisplayName, and each message by its id: a fixed
  type's from the static-messages table, any other from its header. An empty line an author left inside a message is
  kept as `' '`, comments are skipped, and everything past `QBN:` is ignored. It throws where the C# throws: a stray
  block-level line that is not one field, an id that is no number, an id twice.
- **`ParseLocalizedQuestText`**. The current language's `-LOC` file is parsed once, and its messages are added to the
  language's `Internal_Quests` as `QUEST.messageId`, only where the table has no entry yet. A file that throws, or has
  no DisplayName, or no message, is said on the console and read as none, as DFU logs and answers false.
- **`Quest.GetMessage`**. The table is asked for `QUEST.messageId`; when it answers, the translation is read into the
  same Message (`ReplaceMessage`), every time it is asked. A message the file lacks keeps its own source, and a message
  the quest has not is null, as DFU answers.
- **`ParseQuest`'s tail**. Both parse doors (`scheduleQuest`, `parseQuestForLists`) take the file's DisplayName, and
  the guild list's label (`getLocalizedQuestDisplayName`, which the offer flow had and no host passed) is wired to it.
- **A save loading.** DFU parses the file again (`RestoreLocalizedQuestMessages`). Here the parse is lazy, per
  language, and goes stale with the text itself (`textRevision`), so a restored quest reads its translation on its
  first message.

**The file** comes from the player's pack: the text core keeps a pack's documents (`setLocaleDocuments`,
`localeDocument`), read along the chain like a table, so the quest machine never reaches into the scene loader.
English has no `-LOC` file, so its quests read their vendored source, byte for byte.

**What DFU does that the port keeps, and L10N5 owes:** the message a translation replaced is the one a save stores.
So a quest begun in French is saved in French and stays French in English, in DFU as here.

**Pinned:** `test/l10n3c.test.js` (4), over the real `S0000977` (the Curse of Daggerfall) and a `-LOC` fixture written
for the test (no pack's text is committed). It covers the parser's law and its throws; the quest in French (the
DisplayName, a message read into the same Message twice, a table row already there kept, a message the file lacks, a
message the quest has not); English untouched; a file that will not do; fresh documents parsed afresh; and a
forgotten language.

**Mutants:** `tools/mutants/l10n3c.json` has 15 mutants, all dead. The first run left one alive (a comment between
the messages), and the fixture gained one.

## L10N3d (2026-09-27): DFU's interface words, part 1 - the tables

The port holds many of DFU's `Internal_Strings` values as constants, in tables keyed by DFU's own key. DFU reads each
one with `GetLocalizedText(key)` at the moment it shows it. `localizedStrings(en, collection)` in the text core does the
same: every property is a getter that asks the current language's table, with the port's English as the fallback. The
table stays frozen and enumerable, and in English it reads byte for byte as before.

**Converted, 17 tables and 223 keys:** `REVEAL_NOTE_TEXT` (world.js), `TALK_STRINGS`, `DECOR_SIZES`,
`DISPEL_MAGIC_TEXT`, `SOUL_TRAP_TEXT`, `DOOR_SPELL_TEXT`, the notebook's and the quest macros' `EN`, `LABELS` (special
advantages), `DIRECTION_HINTS`, `USE_TEXT`, `AUTOMAP_STRINGS`, `EXTERIOR_AUTOMAP_STRINGS`, `REP_LABELS`, the quest
journal's `TITLES`, `SW_TEXT` and `SPELL_MAKER_TIPS`. `MODE_ICON_SUFFIX` stays as it is: it holds file suffixes, not
words.

**One key is not DFU's English.** The reputation window's "Peasants" copies the painted art. DFU keys that group
`commoners` ("Commoners", the key `GoodRepWith` and `BadRepWith` use). The label keeps its English, and a translation
reads DFU's `commoners` row, so a French window has no English word left in it.

**A parity pin the tables never had:** every key of every converted table is one of DFU's 990 and holds DFU's English
byte for byte (`vendor/dfu-text/Internal_Strings.csv`), with that one named exception.

**Part 2, the groundwork.** Two more helpers in the text core. `localizedTable({ name: [dfuKey, English] })` is a table
keyed by the port's own names whose words are DFU's (a guild service is `Training`, its label DFU's `serviceTraining`).
`formatText(pattern, ...args)` is C#'s `string.Format` for DFU's patterns: `{n}`, and `{n:00}` zero-padded. A
placeholder a translation has but no argument fills is left standing, where the C# would throw.
`tools/l10nRouted.mjs` reads every routed word off the source (its English a literal, or the module's own `const`). `test/l10n3d_sites.test.js` holds each one to DFU's key
and English, holds each single word to being read where it is shown (never at module load), and counts the routed
words file by file. At the groundwork: 223 words in 14 files, 213 of DFU's 990 keys. DFU's own code asks for 713 keys by
name, and the port routes 140 of them.

**Part 2, the scene hosts.** The four scene hosts (world.js, worldModes.js, exterior.js, dungeonContext.js) now read
DFU's words where they show them: "Game saved." and "Game loaded." (SaveLoadManager), the two travel refusals
(DaggerfallUI), "You have no spellbook!" (EntityEffectManager), the automap's "Custom name: " (ExteriorAutomap), "You
get no response.", the repair service's fallback title and its notebook line (`repairNote`, through `formatText`). The
port's own words beside them ("Save failed ...", the repair list's keys) wait for L10N4.

**Part 2, the settings and controls.** 45 words in 7 files:
- The enum rows DFU words through its tables read them through `enumWords` (settingsLaw.js) when drawn, while
  `ENUM_LAW` stays the stored-index law.
- The five settings labels that are DFU's words (the Depth of Field sliders, two effect pages' titles) and the retro
  tip.
- The mouse controls window: title, CONTINUE, keybind faces, sliders, checkboxes and threshold, from TextSettings.
- The grid's, the joystick window's and the enhanced pane's prompts, and the remove prompt's `{0}` pattern.

The settings screen's other labels are the port's own copy (Settings-Screen-Spec) and wait for L10N4. The port has no
effect config pages, so their words are not routed. Two exceptions are named. `FourThree` is DFU's shipped "4:3" (the
master CSV reads "4:03", a spreadsheet's reading of it). "Depth Of Field" is the screen's Title Case. Three of DFU's
settings rows (`meleeAttackDetection` and its two companions) are in DFU's shipped asset but missing from its master
CSV, so they wait on a vendored source.

**Part 2, the shops and services.** 88 words in 17 files:
- The guilds: rank titles through the rank-list keys, the temples' female titles, the divines' names and descriptions,
  "nonMember" and the Knightly Order's house refusal.
- The 20 service labels (`SERVICE_LABEL`, a `localizedTable` over the service enum) and the members-only refusal.
- The trade window's refusals, tally, letter of credit and steal lines.
- The repair status words, the bank's status rows and refusals, and the purchase price line.
- The tavern's menu and its free-room lines.

The scene hosts call the batch's readers for Stendarr's mercy, the magicka refusal and the repair refusals, and the
loan reminders (worldTick.js) go through `formatText`. Three differences from DFU were found and left for a later fix,
since fixing them changes English:
- The bank names a house "<name>'s residence" where DFU's `playerResidence` is "%s's house".
- The deed note differs from DFU's `houseDeed`.
- The donation and cure boxes print `%gdd` raw, because the port's macro data has no god description.

**Part 2, the effects and activation.** 156 words in 20 files:
- The effect catalogue's group and subgroup names have one home (spellEffects.js), read by DFU's key per effect class.
  DFU's broker sorts and matches the localized names, so the spellbook and spell maker list a translation's names.
  The English identity keys stay as they are.
- The buff-start and magic refusal lines, and the potion names.
- The vampire and were race names, over the stored English override.
- The enchantment names and labels whose port English is DFU's.
- Activation: too far, you see, the interaction modes, lock chances, closed buildings, the corpse lines.
- The torch, the skill-up notice and climbing.

DFU's `true` ("True", the three True effects) stays English. The master CSV holds it as `TRUE,TRUE` (a spreadsheet
boolean), packs do the same, and DFU's patcher matches keys exactly, so DFU shows "True" in every language too.

Found and left, as fixing them changes English:
- The port derives the enchantment names in Title Case where DFU writes "Bad rep with", "Cast when held:" and so on.
- Four enchantment label sets differ from DFU.
- The port's own prose stands where DFU has lines for the lycanthrope's dream, hunt and once-a-day lines, lock
  picking, collecting arrows and pacifying.
- "You are not successful." lacks DFU's ellipsis.

**Part 2, talk, the macros and the text of things.** 188 words in 24 files:
- TalkManager's topic words and categories.
- The honorifics and the race names (%ra).
- The ruler titles (%rt, %t, %lt1).
- The quest macros (%ltn, %lp, %cn2, %ct, %sea, the divines).
- The biography's provinces and lands (%hpn, %hpw).
- Item materials, conditions, long names and potion and ingredient names, through DFU's own format strings.
- The item powers lists.
- The backstab and ineffective-material lines.
- The thirteen building-name lists, each drawn over a translation's own length.
- The calendar's day, month, sign and season lists and its three date formats.
- The quest lines that fill %s and %map after the lookup.

The exported English lists (`DAY_NAMES`, `TAVERNS_A` ...) became readers (`dayNames()` ...), because a copy taken at
module load would freeze whatever language was chosen then. `SEASON_NAMES` stays, since the quest Season trigger
compares against it. Names that are also identifiers keep their English identity: `materialName`, the race
templates' `name` (compared to `entity.race`), and the canonical capitals.

**Part 2, the windows.** 104 words in 25 files, in each window's own code and in both skins:
- The pack's refusals and gold panel.
- The save and pause doors.
- The spellbook's prompts and its target and element descriptions.
- The spell maker and the icon picker.
- The journal's tips and its confirmations.
- The rest window's prompts and refusals.
- The character creator: the help titles, the 18 class names (a computed key, as DFU's `GetLocalizedText(career.Name)`)
  and the prompts.
- The character sheet's affiliation, level progress and hand-to-hand lines.
- The potion maker, the travel map and the bookshelf.
- The prison's days: DFU's `%d` replace, then `processGrammar`.

One exception is named: the enhanced rest card asks DFU's field label as a question ("Rest how many hours?"), where DFU
has "Rest how many hours : ".

**Part 2, between the batches.** A batch that found a DFU line in a file it did not own reported it, and the lines were
routed after the merge:
- "You are too far away..." at every reach in the six scene hosts and the horse cart.
- The interaction-mode line.
- The locked door.
- The daylight travel refusal (the map door and the party's).
- The exhausted swimmer, "You feel somewhat bad.", the afloat latch, the weapon hand's switch and the pinched purse.

A second round routed:
- The court's crime names (by DFU's enum names) and the sentence's rows, with `%gtp`/`%dip` filled after the lookup.
- The `%nt` tavern fallback, the broken item, backstab and ineffective material, the potion card, the reputation-change
  words and the Create Item picker.
- The magic-item, transport, enchanting and level-up refusals, and the trade windows' fallbacks.
- The skill names: `SKILL_NAMES`, a getter per element. Orcish and Daedric revert to the language's own name for a pack
  that predates their skill rows, as `GetLocalizedTextWithReversion` does.
- The profile card's attribute and vital words.
- The race every screen shows. `raceDisplayName` takes a key or a stored name, and `liveRaceName` gives the curse's name
  for the cursed and the birth race's shown name for everyone else. The template's `name` stays the English identity.

The skill Pickpocket keeps the port's English: DFU ships "Pickpocketing", and that is reported, not changed here.

The Features tile now shows DFU's dungeon-texture words (`shown`) while its `labels` stay the law All off reads. The
menu clock reads the time off the date: it used to split the formatted date line at " on ", which a translation's
pattern need not contain.

**Part 2 in sum.** 945 routed words in 102 files cover 791 of DFU's 990 `Internal_Strings` keys (213 before part 2),
plus 22 TextSettings keys. Against the real French pack (DFU-en-francais), 790 of the 791 have a row; only `cityWall`
is missing, a key newer than that pack. All 22 TextSettings keys have one. So a French player reads about 800 of the
interface's words in French.

What stays unrouted:
- Keys for features the port does not have (the effect config pages, the setup wizard, PlayerGPS's unknown-region arm).
- Keys whose words the port shows in its own English, the fidelity differences listed above.
- The name lists, which are L10N3e's.

**Pinned:** `test/l10n3d.test.js` (3). It covers parity for all 223 keys, the module-private tables read off their
source, and each reputation group reading its label. Each exported table answers a French row in French, and its own
English before French is chosen and after. It also covers `localizedStrings` itself: a mod's runtime collection
redirect, and another collection when asked.

**Mutants:** `tools/mutants/l10n3d.json` has 22 mutants, all dead: the getter, the collection, enumerability, the
freeze, each of the 17 tables reverted to a plain frozen English object, and the reputation group's key.

## L10N3e (2026-09-27): the names of things

DFU names a place, a region, an enemy, a spell, an item, a magic item and a faction through TextManager's name
lookups. Each reads a pack's table by the thing's own id (`Internal_Locations` by map id, `Internal_Items` by
template index ...) and falls back to the game's canonical name. It does so only where the name is shown: the
canonical name stays the key that discovery, saves and quests read. DFU calls them at 63 places.

**The groundwork.** The text core had six of the seven lookups from L10N1, with no callers yet. It gains the seventh:
`getLocalizedEnemyName`, whose MobileTypes id reads the `enemyNames` list (a class at 43 + id - 128). A custom enemy, a
missing list or a short one answers the port's own name. `tools/l10nRouted.mjs`'s `namedSites` reads every lookup
site off the source. `test/l10n3e_names.test.js` counts them file by file (NAMED) and holds each to being made where
the name is shown, never at module load.

**Enemies and factions (the beings batch).** 10 lookups in 8 files:
- The enemy in the you-see and just-died lines.
- A body's name (`corpseEntityName`) on its plaque and its loot tab.
- The pacification line.
- The guild on the affiliation row.
- The greeting's faction names.
- `%fl1`/`%fl2`/`%ol1`'s lord and `%dae`'s prince.
- An Individual's shown name (`staticNpcShownName`).

The keys stay canonical: `ENEMY_NAMES`, the faction records, `staticNpcName`, the `DAEDRA` table. All 62 enemy ids
and a sample of faction ids match the real French pack's rows.

**Places and regions (the places batch).** 25 lookups in 10 files. A location reads `Internal_Locations` by its
MapTableData.MapId, never its index; a region reads the `regionNames` row by index:
- Where am I, the regional building's %fcn, and the town host's %cn.
- Building names: the name bag carries a shown pair beside the canonical one, and a shop's %cn and the bank's region
  print the shown pair.
- A quest Place's and Person's macros, the building a quest names, and %cn / %crn / %reg / %cn2.
- The journal's find-place entry and its goto.
- The travel map: the region label, the location in it, the find and list (over `localizedMapNameLookup`), the
  confirmation's %tcn and the teleport box.
- The bank's status rows, the deed's region, %reg in its records, and the loan reminder.

The keys stay canonical: `cityName` (discovery), a journey's and a teleport's destination, a quest site, and the
palace a building's canonical location chooses. `getLocalizedRegionName` gained a guard: an index that is no integer
reads the canonical name (C#'s int cannot be one; the port's `undefined` had read `list[undefined]`). Pinned by
`test/l10n3e_places.test.js` (13); mutants `l10n3eplaces` 25, all dead.

**Items, magic items and spells (the things batch).** 9 lookups in 5 files, shown through two helpers. The item and
the book's spell keep their canonical name, which is a key (saves, the artifact test, the Arrow filters, the boat
test's bundle):
- `shownItemName` (itemInfo.js): an item's name by its template index while the name is still the template's, else
  the MAGIC.DEF row with the same name by its `index` (the record's stream position). Items carry no MAGIC.DEF index,
  so this is a name match.
- `shownSpellName` (loot.js, beside the SPELLS.STD registry): a spell by its index while its name is still the stock
  record's own, or that name without its leading `!`. A renamed, made or RRI spell shows the name it carries.
- Reached from: the item's long name and Info box, a soul trap's soul (%hs), potion recipes, "Equipping %s", the
  enchantment pickers and %mpw, the item maker's label, the use-magic-item list, the spellbook's rows, label and sorts,
  the enhanced book, the spell slot, the hotbar and the active-spell icons. A cast bundle stores `bundleSpellIndex`
  beside its canonical `bundleName`.

Checked against the real French pack's ids (none of its text committed): all 288 item templates, 59 magic items (by
stream position), 88 spells and the 73 CastWhen* ids are present, and every sampled row names the right thing. One save-side effect: a quickslot's item
label is written at slot time, so in French it holds the French name; it shows only for an item that is gone and is
never a key (L10N5 stores ids). Pinned by `test/l10n3e_things.test.js` (12); mutants `l10n3ethings` 9 (the lookups) and
`l10n3ethings2` 22 (every call to the two helpers), all dead to that file alone.

Left for later (files other batches own, or an import cycle): the trade and repair lists' `_itemLabel`, the Dispel
pickers, the readied spell on the HUDs, quest items' artifact arm, the ally-cast sentences, `equip.js`'s broken line
and `useItem.js`'s %it lines (itemInfo imports both, so the name has to be handed in).

**The scene hosts (the scenes batch).** The names world.js, exterior.js, worldModes.js, dungeonContext.js and the HUDs
show, each key still canonical:
- Places: a map's revealed place by its MapId, the readMap note and %map as shown while discovery files the canonical
  name (the guilds' notes keep DFU's canonical `revealedDungeon.Name`); the guilds' %dng; the bulletin heading; the town
  map's plates and title; the notebook header's %cn; the dungeon host's %cn; the topics carry the location's ids so the
  name bag shows its pair; "You arrive at X." (the port's own words).
- Things: the trade and repair lists' item names (and so the repair note, written in the language of the moment, as
  DFU's is), the Dispel Magic pickers, the readied spell on both HUDs, and the ally-cast lines composed on the caster's
  side - the frame still carries the canonical name, so no localized name crosses the wire.
- Beings: the dungeon's corpse plaque (`corpseEntityName`); a static NPC's shown name on the hover plaques, the Info line
  and the talk window's name plate, while the talk partner's `nameNPC` (compared with a quest Person's name) stays
  canonical; %fon/%kno for knightly orders and the prince in the port's own summoning lines; the revealed guild halls.

Two lookups the quest batch also added are kept once: the name bag's guild-hall and temple names come from
`buildingNames.js`'s `shownFactionNames` (the bag's canonical resolvers unchanged), and the talk topics' organization
captions are looked up in `topicTree.js` (world.js's dep hands the record's own name). Pinned by
`test/l10n3e_scenes.test.js` (19); mutants `l10n3escenes` 49, all dead to that file alone.

**Left (the port's own text, or protocol):** the target's ally-cast and duel lines (the frames carry no spell index -
adding one is a protocol change), the PC greeting's %n for a named lord (`npcSession.js`, `talkMacros.js`,
`answerPipeline.js` - a shown name beside `nameNPC` is needed), the party travel lines and the hub arrival line (the
port's own words, whose place name also fills a network frame), "You are entering %s" (PlayerEnterExit.cs:1387, not
ported) and NewLocationAlert (no port equivalent).

**The quest and the systems (the quest batch).** The quest machine's names and its two grammar hooks:
- A Foe's name by its MobileTypes id; a quest artifact's through `shownItemName`; an Individual's or a Daedra's name by
  its faction id (`shownPersonName`), the questor's guild and a person's own faction; a flat's caption by
  `(archive<<7)+record` from `Internal_Flats`; the race name through `raceDisplayName`.
- The faction macros: %kno/%fon (localized before "The " is trimmed, as QuestMCP.cs:60-61 does), %vcn, %rn, %nrn and
  %fx1/%fx2, each by its record's id.
- The talk topics' organization, person and thing captions. The same-person compares stay canonical.
- Guild-hall and temple building names, through a shown pair beside the canonical one (`shownFactionNames`).
- The broken-item line, the light lines and the dying light take the item's shown name from their caller
  (`nameOf`), since itemInfo imports those modules.
- **Grammar:** the macro pass runs `processGrammar` over each token after the macros (QuestMacroHelper.cs:158), and a
  Person hands the grammar the NPC's gender from the last referenced resource (Person.cs:298).

`displayName`, `typeName` and every name a save or a compare holds stay canonical. The French pack's 366 faction
rows (262 of them with grammar tokens) and its flats were checked against the ids read, locally. Pinned by
`test/l10n3e_quest.test.js` (16); mutants `l10n3equest` 37, all dead to that file alone.

## L10N3f (2026-09-28): a translation's books, name banks and text databases

A DFU pack ships more than tables; L10N3b installs it all and the text core keeps it. These are the readers.

**Books.** `src/systems/localizedBook.js` ports LocalizedBook.cs: a `Text/Books/<BOOK>-LOC.txt` read by its header keys
and its content, File.ReadAllLines' line law and all.
- The reader opens the language's -LOC book first and fetches the BOK file only where there is none
  (DaggerfallBookReaderWindow.cs:155-176), and lays it out as CreateBookLabels does: `[/center]`, `[/font=N]` (held
  across blank lines; only alignment, colour and scale reset), `[/color=]` and `[/scale=]` (a scaled label wraps at
  MaxWidth / scale), on both skins.
- GetBookTitle reads the -LOC title first (ItemHelper.cs:567-586), so the item's name, the scroller's tooltip, the
  bookshelf and %bt all show the language's title; the item stays keyed by its message. %ba takes the -LOC author.
- GetRandomBookID's conditions: IsUnique, and WhenVarSet through `setBookGlobalVars`, a seam the quest machine's
  globals still have to be wired into (until then, a WhenVarSet book is withheld).
- Over the French pack (locally): 93 books, all with the seven header keys; all 92 mapped ids open with a title.

**Name banks.** `nameHelper.js` reads the pack's `NameGen.txt` in FullSerializer's lenient JSON (the French file has a
missing and a trailing comma). The banks are read **once per page**, at the first name the game makes, and held until
the page reloads - DFU reads NameGen once, in NameHelper's constructor. A generated name is a key: a static NPC's name
is made again from its seed at every talk and compared with a quest Person's saved one (TalkManager.cs:3159,
topicTree.js:561), so both must come from the same banks. In the port a language changes only on the front door, and
leaving a game reloads the page, so once per page is DFU's once per run. A save or a party member made under other
banks keeps its spellings (DFU does the same across an install); L10N5 is the fix. The French banks spell every human
name as English does.

**Text databases.** `src/systems/textDatabases.js`: TextManager.GetText/HasText over a pack's `Text/<name>.txt`, in
DFU's Table schema.
- DialogShortcuts: a pack's file replaces the table whole (DaggerfallShortcut.cs:307-326) - in French, Yes is O. The
  controls windows' prompts answer by those letters, under DFU's modifier rule (a Y with Ctrl, Shift or Alt held no
  longer answers, as the Yes/No box already behaved).
- GameSettings: the words the three controls windows read (primary/secondary, the joystick pane's 16 labels).
- MainMenu and ModSystem have no port window to read them.

**Not yet:** the message boxes' Yes/No keys are still hard-coded `KeyY`/`KeyN` in about fifteen windows; the settings
screen's GameSettings help text; `[/image=]` (the store keeps no BookImages) and DFU's SDF page panel; a mod's text
(`Mod.TryLocalize` reads `Text/mod_<FileName>.txt` first, which a pack may ship, but the port's Mods pane is its own UI,
and the classifier drops a `mod_` file with a hyphen). French moves TalkCopy to N, which shadows the port's own N
page-scroll in the talk window. FrenchAdjectives.txt and FrenchNames.txt are read only by the French pack's companion
mod, which has no license and is not ported.

**English differences found and left:** DFU's English build reads its own 93 -LOC books where the port reads the BOK
files, so four titles differ (22, 35, 43, and 16, which has no id in the port's mapping) and DFU withholds books 112
and 113 until LiftedCurse is set; the port's classic BOK layout resets the font on a blank line, which DFU's -LOC
layout does not; the controls grid shows PRIMARY/SECONDARY in capitals.

Pinned by `test/l10n3f_readers.test.js` (8) and `test/l10n3f_databases.test.js` (5); mutants `l10n3f` 49, all dead.

## L10N4 (2026-09-28): the port's own strings - the ratchet first

The port's own words (menus, the enhanced interface, the online game, every notice DFU does not have) reach a player in
their language only through `t(key, en, args)` and the `Port_Strings` catalog. Before any are moved, the plan's "lint
rule that stops new hardcoded strings": `tools/l10nHardcoded.mjs` counts the prose still written into the code - every
string or template literal of two words or more that is not a text-core call's argument, a console line, a thrown
error, an import, an object key, CSS or an identifier run - and `test/l10n4_hardcoded.test.js` pins the counts file by
file. A count may only fall; a new sentence fails the suite where it is written. It is a heuristic (a data table's
English counts; a one-word label does not), which is why it is a ratchet and not the definition of done.

At its start: 5,121 such literals in 340 files. The largest: the mods' own settings (`modSettings.js`, 510), the front
door (`enhancedMenu.js`, 223), the Features screen (`features.js`, 208) and the settings screen's copy
(`settingsCopy.js`, 184; `settingsText.js`, 156).

**The drafts come in by one door.** Every machine-made language covers the English catalog exactly and records each row
as the machine's, so a batch that adds keys ships its drafts in all 25 languages. `tools/l10nInSession.mjs` merges a
`{ lang: { key: text } }` file through the pipeline's own placeholder law (a lost ICU argument is refused; a
language's own plural categories are allowed), keeps a row a person edited, drops a row the catalog no longer has,
writes the table in the catalog's order and records each row as `claude-in-session`; `--owed` lists what each
language still owes, as a template to draft from. Pinned by `test/l10n4_insession.test.js` (2); mutants
`l10n4insession` 6, all dead.

## L10N3g (2026-09-27): the French pack's grammar

"DFU en français" writes its text with grammar tokens: `{.le}{.FS}épée`, `{Number?niveau#niveaux}`,
`{monsieur/madame}`, `{#ajusté#ajustés#ajustée#ajustées}`. 940 of its rows carry them. It ships a processor that
resolves them, FrenchGrammarRules.cs (Daneel53, MIT), which DFU runs wherever it calls
`GrammarManager.ProcessGrammar`. Without it, a French player reads the tokens raw.

**Ported:** `src/systems/grammar/frenchGrammar.js`. It is the C# in behaviour, with its MIT notice in the file and in
`LICENSE`. The pack's text is its authors' work and is still never bundled; this code is MIT.
- Articles agree with the gender and number token behind them.
- The h aspiré, elision, and the condensed doubles (de le -> du, à les -> aux).
- The hero's and the NPC's gender.
- The adjective's forms, including the fifth for beau/vieux/nouveau/fou.
- Plural by number, and the min/Min/Maj casing tokens.

The C#'s quirks are kept:
- The gender carries from one text to the next.
- An unknown token prints the pack's own " -UT: ... - " marker.
- A DFU token such as `{0}` is left in place.

Over the pack's own rows, all 940 but one resolve. The exception is the pack's `Devin{eresse}`, which DFU's processor
flags too.

**Chosen per language.** The text core keeps a registry (`registerGrammarRules`), so it stays import-free. The
French rules register themselves and are chosen whenever French is on the locale's chain. The hero's and the NPC's
gender getters are the manager's, so a getter handed in under English still answers after a switch.

**Run where DFU runs it (the wiring batch).** 19 call sites, pinned file by file by `tools/l10nRouted.mjs`'s
`grammarSites` (the GRAMMAR map in `test/l10n3g_wiring.test.js`), none at module load:
- The HUD's popup text (`HudText.add`, PopupText.cs:117-118): the row, the repeat test and the notebook's line all
  take the processed text, so a building's name on activation (PlayerActivate.cs:472) is covered with no scene edit.
- Every classic message box, in `normalizeRows` (MultiFormatTextLabel.cs:230): string rows, tab-stopped cells and
  row records, before they are measured. An input box's typed row opts out (`field: true`), as DFU's TextBox does.
- Each tooltip row as it is drawn (ToolTip.cs:215); the box is still sized from the raw rows, as DFU's is.
- The exterior automap's plate label and its tooltip (DaggerfallExteriorAutomapWindow.cs:878, :885); the building's
  name stays the key.
- The history window's lines, the race label on both character sheets, chargen's class list and class questions, the
  court's days until freedom, and the talk window: the greeting, the question and answer as they are filed, the NPC's
  name plate, the question line and the topic captions (DaggerfallTalkWindow.cs:390, :642, :873, :1100, :1248, :1256,
  :1268), on both skins.
- **The hero's gender:** chargen's pick hands it over at once (CreateCharGenderSelect.cs:63/:70), so the rest of the
  wizard reads it; `finishChargen` and `bootWorld` hand over the live hero at every start, a load included
  (StartGameBehaviour.cs:147). The NPC's gender comes from the quest batch (Person.cs:298).

Over the French pack's rows (locally), 1,158 token lines in Internal_Strings and TEXT.RSC resolve through these sites;
the one left is `Devin{eresse}`, as before. Pinned by `test/l10n3g_wiring.test.js` (11); mutants `l10n3gwiring` 25
(each call, the typed-row opt-out and each gender hand-over reverted), all dead to that file alone.

**Not yet (files other batches own):** the enhanced skin's click-anywhere notices (`enhancedNotice.js`), its Yes/No
card and keyed menus, the input box's typed row, the quest log, the Daedra summoning window, the inventory's info
panel, the enhanced chargen's boxes, the enhanced history and town map, and the dev boot routes' hero gender.
