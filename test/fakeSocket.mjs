// The session pins' fake WebSocket - ONE home (AUDIT WORLD2 D14: world2 and auditworld carried the same copy). A class
// the session is handed as WebSocketImpl; every instance is kept, `sent` holds the raw strings the session wrote (the
// wire's own shape - t first, the prefix the relay reads), `open()` and `receive()` drive it from the test's side.
//
// RPT1026-SECNET (LINE-STALL, bible/06-Systems/Online-Arc.md): AND THE RUNTIME'S PING IS ANSWERED, as the relay's runtime
// answers it in front of every room (server/src/index.js setWebSocketAutoResponse) - a session that hears no answer to
// its ping reads its line as stalled and holds its poses, so a fake that never answered was a dead line in every pin.
// `pong: false` is that dead line, for the pins of the stall itself.
export const RUNTIME_PING = '{"t":"ping"}';
export const RUNTIME_PONG = '{"t":"pong"}';
export function fakeSocketClass({ pong = true } = {}) {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(s); if (pong && s === RUNTIME_PING) this.onmessage?.({ data: RUNTIME_PONG }); }
    close(code, reason) { this.closed = { code, reason }; }
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: typeof o === 'string' ? o : JSON.stringify(o) }); }
    drop(code = 1006, reason = '') { this.onclose?.({ code, reason }); }
  }
  return { FakeWS, sockets };
}
