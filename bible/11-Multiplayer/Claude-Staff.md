# Claude as Staff

Claude is a staff account that only monitors and reports. It reads what the account service already stored about players and
writes suggestions for staff members to accept or dismiss. It never acts, it is not visible to players, and it never talks in
chat. Staff meet it in the Staff Panel as a list of suggestions. The code is `server-account/src/claudeStaff.js`,
`staffClaude.js` and `staffOrder.js`.

## How it works

**The switch.** `CLAUDE_STAFF` in `server-account/wrangler.toml` is `"on"`; `"off"` stops it at the next deploy. Off, or with no `ANTHROPIC_API_KEY`, the
minute job returns before it reads a row or opens a connection. It does not change `MOD_AI`.

**No sign-in.** Claude runs inside the account service on its minute clock, like the chat reviewer. It writes as the staff
account named by `CLAUDE_STAFF_HANDLE` (default `Claude`). A panel sign-in or enrolment for that handle is always refused
with `staff-login`, so nobody can drive the account from a panel.

**The sweep.** Every 15 minutes it gathers what is new since its last run and sends one batched call to
`CLAUDE_STAFF_MODEL`, answered under a JSON schema. The sources are the chat-report cases with the reviewer's shadow verdict,
Network bursts, the Monster watch, the bot check's reaction timing, copies found, gains no witness explains, trade holds and
the bot-ring query. With fewer than `CLAUDE_STAFF_QUIET_MIN` players online it runs every two hours instead and covers
everything since the last run. The last run is one row in `claude_state`.

**What the model sees.** Players' words go in as JSON inside one tag, with every `<` and `>` escaped, and the prompt says they
are data. Accounts are labelled P1, P2 and so on; no name or id is sent. A call the API never answered is given back. The
day's calls are capped by `CLAUDE_STAFF_DAILY_MAX` and counted in `mod_ai_days` under the key `<day>:claude`.

**Hands off.** When a subject has an open case that a staff member holds with a live claim, or an active freeze, the sweep
writes no suggestion for that subject, sends no Discord card for it and leaves the case alone.

**The bot-ring query.** It needs no model. A receiver is a candidate only when all three hold: two or more accounts sent it
goods in free one-way trades (at least three each, nothing or almost nothing back); each of those accounts plays a scripted
pattern (round the clock, near-equal gaps between harvests, or the same four hours each night in the UTC small hours); and
the receiver claimed little from raids, bounties and camps. Free trades alone flag nothing.

**Suggestions.** Each row in `claude_suggestions` has a kind, the subject account, an optional case id, an urgency, a
summary, the evidence as stored, and one suggested act from the staff doors that already exist (mute, trade hold, watch).
Each new one also posts a card to the moderators' Discord channel, urgent ones first and at most ten a sweep. The card names the
player, gives Claude's reason in its own words and says what it suggests. It carries no chat lines and pings nobody.
Admins read all suggestions; Moderators read the chat reports only.

**Deciding.** Only accounts in `CLAUDE_ORDER_HANDLES` may accept or dismiss, and a refusal is audited as denied. Accepting
records the decision and nothing else. The panel then runs the act through its own door under the deciding member's session,
so the audit log shows who decided and who acted. `/v1/staff/claude/digest` gives those members counts and the top pending
items since a time.

**Orders from outside the panel.** A member on `CLAUDE_ORDER_HANDLES` enrols an Ed25519 public key from their own signed-in
session (`/v1/staff/order-key/add`; two live at most; revoked, never deleted). A request to `POST /v1/staff/order` signed by
that key runs one panel door as that member. The signature covers the handle, a second and a hash of the path and body, and
works once. The same dispatcher a panel session uses checks the role, owner and claim rules, and every audit row carries
`via: claude-project`. Sign-in, key, invite, claim, hiding, following and order-key doors are refused, and every refusal is the word `staff-login`. An order is never an owner: Team, cutting a member off and the audit log answer `staff-owner` to it and stay with a live panel session. No
password is stored and no session outlives the request.

**Keeping.** The hourly job deletes suggestions after 30 days.

## Open

- The scripted-play signs are starting numbers to tune against real accounts.
- The in-game staff tag for the account belongs to the client and the relay, not to this service.
