// The session pins' fake WebSocket - ONE home (AUDIT WORLD2 D14: world2 and auditworld carried the same copy). A class
// the session is handed as WebSocketImpl; every instance is kept, `sent` holds the raw strings the session wrote (the
// wire's own shape - t first, the prefix the relay reads), `open()` and `receive()` drive it from the test's side.
export function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(s); }
    close(code, reason) { this.closed = { code, reason }; }
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: typeof o === 'string' ? o : JSON.stringify(o) }); }
    drop(code = 1006, reason = '') { this.onclose?.({ code, reason }); }
  }
  return { FakeWS, sockets };
}
