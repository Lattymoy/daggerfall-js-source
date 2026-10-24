# Drafting the port's own strings (L10N4, in-session)

This is the brief a session drafter follows. Mac's decision (Localization-Arc.md, "Mac's decisions"): the port's own
strings are drafted in-session by Claude, every language labelled machine-translated until a person's lands.

## What you get and what you write

- An owed file: `{ "<lang>": { "<key>": "<English pattern>" } }` (`node tools/l10nInSession.mjs --owed <lang>` prints it).
- `locales/en/Port_Strings.csv` is the whole English catalog: read neighbouring keys for context (the key's dotted
  prefix says where the string is shown: `stats.` the paperdoll's combat card, `menu.` the front door, `net.` the online
  game, `mods.` the Mods pane...).
- `locales/<lang>/glossary.json` (`{ "English term": "your term" }`) is the language's term list. Read it first, use
  its terms, and add the new recurring terms you settle on (game nouns, UI verbs) so the next batch agrees with you.
- Write your drafts as `{ "<lang>": { "<key>": "<text>" } }` and merge them with
  `node tools/l10nInSession.mjs <your-file>`. It refuses a draft that loses a placeholder and says what is still owed;
  fix and re-run until nothing is refused and nothing is owed for your language.

## The rules

1. Every `{name}` argument stays, spelled exactly; translate the words around it. Reorder freely.
2. Plurals: `{n, plural, one {# day} other {# days}}` - write your language's own categories (`zero`, `one`, `two`,
   `few`, `many`, `other`; always `other`). Languages without plural forms (ja, ko, zh-Hans, zh-Hant, vi, id) write
   `{n, plural, other {# 日}}`. `#` is the number. Keep `selectordinal` and `select` structures and their keys.
3. A literal brace is `'{'`. A lone apostrophe is plain text.
4. Keep symbols the English uses for layout: `·`, `×`, `–`, `%`, `+`, `=`, `…`, `:`, ellipses. Use your language's
   quotation marks and spacing rules (French: espace insécable avant `:` `;` `?` `!`).
5. Register: a fantasy RPG's interface, The Elder Scrolls II: Daggerfall. Short, plain, the way your language's game
   releases write menus and notices. Address the player as games in your language do (German: "du" in notices; French:
   "vous"; Japanese: plain polite).
6. Names: Daggerfall's proper nouns (Daggerfall, Iliac Bay, Tamriel, Sentinel, Wayrest, the Divines, the Daedra) keep
   the form your language's official Elder Scrolls releases use; when unsure, keep the English. Mod names and author
   names never change. Skill, attribute and spell names: Daggerfall Unity's own translation tables carry those, so a
   port string that names one should use the usual game term.
7. Length: the interface is narrow. Prefer the shorter of two good translations for labels and buttons.
8. Never translate a string into English, never leave a key out, never add keys.
