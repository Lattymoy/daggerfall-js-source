// HERALD-CARDS (2026-10-22): a herald's post read as its card (src/net/herald/heraldCard.js) - the parts the herald pins
// name, so a pin says `cardOf(p).fields.Where` rather than walking Discord's embed shape at every assertion.

/** A post's card: its content (a pinging post's alone), its family, title, text, fields by name, footer and colour. */
export function cardOf(body) {
  const e = body?.embeds?.[0] ?? {};
  return {
    content: body?.content ?? null,
    author: e.author?.name ?? null,
    title: e.title ?? null,
    text: e.description ?? null,
    fields: Object.fromEntries((Array.isArray(e.fields) ? e.fields : []).map((f) => [f.name, f.value])),
    footer: e.footer?.text ?? null,
    colour: e.color ?? null,
  };
}

/** Every word a card shows a reader, in its reading order: content, title, text, each field as `name value`, footer. */
export function cardWords(body) {
  const c = cardOf(body);
  return [c.content, c.title, c.text, ...Object.entries(c.fields).map(([k, v]) => `${k} ${v}`), c.footer].filter(Boolean).join('\n');
}
