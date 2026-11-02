# Reporting exploits, bugs and security issues

DFO Online is a live online game. If you find a way to break it, please tell the developers privately and not in
public: an exploit, a way to duplicate gold or items, or a hole in the accounts or the servers. Once an exploit is
posted publicly it spreads before it can be fixed, and every player pays for it.

## How to report

**In the game (the quickest way, and best for exploits and bugs).** Type `/bug` in chat. On the enhanced skin you can
also open the pause menu, press the mailbox beside the hourglass, then press **Report a bug or exploit**. Choose what it
is, give it a title, and describe what happens and how to make it happen. The report goes only to the developers who
read reports. Moderators and other players cannot see it. Your username and the game's build are sent with it. Your
reports are listed under the form, so you can see whether a developer has read one and how it was closed. In-game
reports need a registered account (a username and a password).

**On GitHub (for security vulnerabilities in the code or the servers).** If this repository's
[Security tab](https://github.com/Lattymoy/daggerfall-js-source/security) shows a **Report a vulnerability** button, use
it: it creates a private advisory that only you and the maintainers can see, and it needs no game account. If the button
is not there, private reporting on GitHub is not switched on yet, so report in the game with `/bug` from a registered
account.

Please don't open a public issue, pull request, chat message or Discord post about an exploit or a vulnerability
until it has been fixed.

To report another player's behaviour in chat (harassment, hate, threats, spam), use `/report <name>` or press their name
in the chat instead. That goes to the moderators.

## What to include

- What happens, and what you expected to happen.
- The steps that make it happen again, as exactly as you can.
- Where it happens: the place in the game, or the route, file or service involved.
- What it gives a player, or could give one: gold, items, levels, or access to someone else's account.

## What counts

The game client (the site at daggerfalljs.dev and the desktop app), the account service, the multiplayer relay, and
the code in this repository. For example:

- creating or duplicating gold, silver, items or other value; getting past a limit, a cooldown or a lock;
- reading or changing another player's account, saves, characters, letters or mailbox;
- taking down or slowing the servers for other players;
- a secret, key or token exposed in the code, a build or a response.

Ordinary bugs are welcome too: in the game with `/bug`, or as a GitHub issue if nothing in them could be abused.
Problems in third-party services (Cloudflare, Patreon, Discord, GitHub) go to those services. Daggerfall's own game
data is not part of this project.

## Acting in good faith

The [Terms of Service](https://daggerfalljs.dev/terms/) forbid exploiting the multiplayer service. Testing a finding
only as far as you need to confirm it, on your own account and characters, then reporting it privately and promptly,
is the kind of report this page asks for. When you do this:

- stop once you have confirmed it, and tell us what it gave you so the developers can take it back out;
- don't read, change or delete another player's data, and don't disrupt the game for anyone else;
- give the developers reasonable time to fix it before you talk about it publicly.

This page does not change the Terms: going further than confirming a finding, or keeping what it gave you, can still
lead to the actions the Terms describe.

## What happens next

A developer reads the report and closes it as **Fixed**, **Won't fix** or **Duplicate**. An in-game report shows this
in your list under the form. A fix ships in an update, and its patch notes say what changed. If you would like to be
credited for a report, say so in it. DFO Online is a free project and has no paid bug bounty.
