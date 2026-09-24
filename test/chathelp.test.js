// CHAT-HELP (2026-09-23, Mac: "a non-intrusive greeting message that says something along the lines of (use /help
// for commands)"). The chat has had /help since CHAT-CHAN, and nothing pointed a player at it. Each time the player
// goes online the chat greets them with one line that is theirs alone and is never counted unread - it is there when
// they open the chat, and no badge asks them to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChatLog } from '../src/net/chat.js';
import { CHAT_GREETING_TEXT, parseChatLine } from '../src/net/chatCommands.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('CHAT-HELP: the greeting names /help, and /help is the command it names (mutant: the greeting pointing at nothing)', () => {
  assert.match(CHAT_GREETING_TEXT, /\/help\b/);
  assert.deepEqual(parseChatLine(CHAT_GREETING_TEXT.match(/\/help\b/)[0]), { kind: 'help' });
});

test('CHAT-HELP: a quiet line is kept but never counted unread; any other line still is (mutants: quiet ignored; every line quiet)', () => {
  const log = new ChatLog();
  const tab = log.active;
  const line = log.push(tab, { text: CHAT_GREETING_TEXT, system: true }, { quiet: true });
  assert.ok(line, 'the greeting is a line in the log');
  assert.equal(log.tab(tab).messages.at(-1).text, CHAT_GREETING_TEXT);
  assert.equal(log.unreadTotal(), 0, 'and no badge');
  log.push(tab, { text: 'hello', name: 'Ann' });
  assert.equal(log.unreadTotal(), 1, 'a line anyone says still counts');
});

test('CHAT-HELP: the host greets on every join - chatStart pushes it quietly, as the system, on the first tab (mutant: the push dropped)', () => {
  const w = rd('src/scenes/world.js');
  const start = w.indexOf('const chatStart = () => {');
  assert.ok(start > 0);
  const body = w.slice(start, w.indexOf('\n  };', start));
  assert.match(body, /chatLog = new ChatLog\(\);\n\s+chatLinks = new Map\(\);\n\s+chatLog\.push\(chatLog\.active, \{ text: CHAT_GREETING_TEXT, system: true \}, \{ quiet: true \}\);/);
});
