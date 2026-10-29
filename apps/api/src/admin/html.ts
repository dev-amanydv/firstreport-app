import { TIMEZONE } from "@fr/shared";

// A tiny escaping template: every interpolated value is escaped unless it is already Html.
export class Html {
  constructor(readonly value: string) {}
  toString() {
    return this.value;
  }
}

type Value = Html | string | number | boolean | null | undefined | Value[];

export function escape(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function render(value: Value): string {
  if (value instanceof Html) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  if (value === null || value === undefined || value === false) return "";
  return escape(String(value));
}

export function html(strings: TemplateStringsArray, ...values: Value[]) {
  return new Html(strings.reduce((out, part, i) => out + part + (i < values.length ? render(values[i]!) : ""), ""));
}

export function time(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-IN", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" });
}

// Admin action forms; the Origin check in auth.ts guards them against cross-site posts.
export function button(action: string, label: string, fields: Record<string, string> = {}) {
  return html`<form method="post" action="${action}" class="inline">
    ${Object.entries(fields).map(([name, value]) => html`<input type="hidden" name="${name}" value="${value}">`)}
    <button>${label}</button>
  </form>`;
}

const nav = [
  ["/admin/events", "Events"],
  ["/admin/stories", "Stories"],
  ["/admin/sources", "Sources"],
  ["/admin/cost", "Cost"],
];

export function layout(title: string, body: Html, message?: string) {
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · FirstReport admin</title>
<style>
  body { font: 14px/1.45 system-ui, sans-serif; margin: 0 auto; max-width: 1100px; padding: 16px; color: #222; }
  nav a { margin-right: 14px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  .inline { display: inline; }
  .muted { color: #777; }
  .msg { background: #fff6cc; padding: 8px 12px; border-radius: 4px; }
  .card { border: 1px solid #ddd; border-radius: 6px; padding: 12px; margin: 8px 0; }
  .status-published { color: #1a7f37; } .status-failed { color: #c62828; } .status-hidden, .status-merged { color: #777; }
  form { margin: 4px 0; } input[type=text] { width: 22em; }
</style>
</head>
<body>
<nav>${nav.map(([href, label]) => html`<a href="${href!}">${label!}</a>`)}</nav>
${message ? html`<p class="msg">${message}</p>` : ""}
<h1>${title}</h1>
${body}
</body>
</html>`.value;
}
