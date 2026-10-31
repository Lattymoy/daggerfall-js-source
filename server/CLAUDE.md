# server

The relay: a Cloudflare Worker and its Room Durable Object (`src/index.js`). The pure rules are the client's
`src/net/wire.js`, re-exported by `src/relay.js`; `src/index.js` is the I/O. `test/server/online_relay.test.js` drives the Room
over fake sockets.

**HOST-SPLIT**: new behaviour goes in a Room method of its own (or a module like `src/delveRoom.js`), never in
`_message` or any other function `test/scenes/hostceiling.test.js` holds to a ceiling.
