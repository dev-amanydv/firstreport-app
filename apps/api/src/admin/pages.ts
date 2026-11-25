import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  and,
  articles,
  asc,
  count,
  desc,
  eq,
  eventStatus,
  events,
  gte,
  llmCalls,
  sources,
  sql,
  startOfToday,
  stories,
  storySummaries,
} from "@fr/db";
import {
  ADMIN_PAGE_SIZE,
  categorySchema,
  COST_PAGE_DAYS,
  DAILY_BUDGET_HARD,
  DAILY_BUDGET_SOFT,
  FREE_TIER_DAILY_REQUESTS,
  perspectivesEnabled,
  TIMEZONE,
} from "@fr/shared";
import { button, html, layout, time, type Html } from "./html.js";
import type { AdminDeps } from "./routes.js";

const listQuery = z.object({
  status: z.enum(eventStatus.enumValues).optional().or(z.literal("").transform(() => undefined)),
  category: categorySchema.optional().or(z.literal("").transform(() => undefined)),
  page: z.coerce.number().int().min(1).default(1),
  msg: z.string().optional(),
});
const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), msg: z.string().optional() });
const msgQuery = z.object({ msg: z.string().optional() });
const idParams = z.object({ id: z.uuid() });

function send(reply: FastifyReply, page: string) {
  return reply.type("text/html; charset=utf-8").send(page);
}

function pager(base: string, page: number, hasMore: boolean, params: Record<string, string | undefined> = {}) {
  const link = (to: number) => {
    const search = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)), page: String(to) });
    return `${base}?${search}`;
  };
  return html`<p>
    ${page > 1 ? html`<a href="${link(page - 1)}">← newer</a>` : ""}
    ${hasMore ? html` <a href="${link(page + 1)}">older →</a>` : ""}
  </p>`;
}

function select(name: string, options: readonly string[], current: string | undefined) {
  return html`<select name="${name}">
    <option value="">all ${name}</option>
    ${options.map((option) => html`<option ${option === current ? "selected" : ""}>${option}</option>`)}
  </select>`;
}

function statusLabel(status: string) {
  return html`<span class="status-${status}">${status}</span>`;
}

export async function pageRoutes(app: FastifyInstance, { db }: AdminDeps) {
  app.get("/events", async (request, reply) => {
    const perspectives = perspectivesEnabled();
    const query = listQuery.parse(request.query);
    const rows = await db
      .select({
        id: events.id,
        status: events.status,
        category: events.category,
        headline: events.headline,
        contested: events.contested,
        articleCount: events.articleCount,
        firstSeenAt: events.firstSeenAt,
        storyId: events.storyId,
        storyLabel: stories.label,
      })
      .from(events)
      .leftJoin(stories, eq(stories.id, events.storyId))
      .where(
        and(
          query.status ? eq(events.status, query.status) : undefined,
          query.category ? eq(events.category, query.category) : undefined,
        ),
      )
      .orderBy(desc(events.firstSeenAt), desc(events.id))
      .limit(ADMIN_PAGE_SIZE + 1)
      .offset((query.page - 1) * ADMIN_PAGE_SIZE);

    const body = html`
      <form method="get">
        ${select("status", eventStatus.enumValues, query.status)}
        ${select("category", categorySchema.options, query.category)}
        <button>Filter</button>
      </form>
      <table>
        <tr><th>First seen</th><th>Status</th><th>Category</th><th>Headline</th><th>Articles</th><th>Story</th></tr>
        ${rows.slice(0, ADMIN_PAGE_SIZE).map(
          (row) => html`<tr>
            <td>${time(row.firstSeenAt)}</td>
            <td>${statusLabel(row.status)}</td>
            <td>${row.category ?? "—"}${perspectives && row.contested ? " · contested" : ""}</td>
            <td><a href="/admin/events/${row.id}">${row.headline ?? html`<span class="muted">(no card)</span>`}</a></td>
            <td>${row.articleCount}</td>
            <td>${row.storyId ? html`<a href="/admin/stories/${row.storyId}">${row.storyLabel ?? "story"}</a>` : "—"}</td>
          </tr>`,
        )}
      </table>
      ${pager("/admin/events", query.page, rows.length > ADMIN_PAGE_SIZE, { status: query.status, category: query.category })}`;
    return send(reply, layout("Events", body, query.msg));
  });

  app.get("/events/:id", async (request, reply) => {
    const perspectives = perspectivesEnabled();
    const { id } = idParams.parse(request.params);
    const { msg } = msgQuery.parse(request.query);
    const [event] = await db
      .select({ event: events, storyLabel: stories.label, storyEventCount: stories.eventCount })
      .from(events)
      .leftJoin(stories, eq(stories.id, events.storyId))
      .where(eq(events.id, id));
    if (!event) return reply.code(404).send("not found");
    const e = event.event;

    const members = await db
      .select({
        source: sources.name,
        title: articles.title,
        url: articles.url,
        lede: articles.lede,
        publishedAt: articles.publishedAt,
      })
      .from(articles)
      .innerJoin(sources, eq(sources.id, articles.sourceId))
      .where(eq(articles.eventId, id))
      .orderBy(asc(articles.publishedAt));

    const base = `/admin/events/${id}`;
    const actions = html`
      <div class="card">
        ${e.status === "published" ? button(`${base}/hide`, "Hide") : ""}
        ${e.status === "hidden" && e.neutral ? button(`${base}/unhide`, "Unhide") : ""}
        ${["published", "failed", "hidden"].includes(e.status) ? button(`${base}/regen`, "Regenerate card") : ""}
        ${perspectives && ["published", "hidden"].includes(e.status)
          ? button(`${base}/flip-contested`, e.contested ? "Make facts-only" : "Make contested (regenerates)")
          : ""}
        ${e.status !== "merged"
          ? html`
            <form method="post" action="${base}/merge">
              <input type="text" name="targetId" placeholder="Event id to merge this one into" required>
              <button>Merge into</button>
            </form>
            <form method="post" action="${base}/move">
              <input type="text" name="storyId" placeholder="Story id to move this Event to" required>
              <button>Move to Story</button>
            </form>`
          : ""}
      </div>`;

    const body = html`
      <p>
        ${statusLabel(e.status)} · ${e.category ?? "no category"} · first seen ${time(e.firstSeenAt)} ·
        ${e.articleCount} articles · prompt v${e.genVersion ?? "—"} · rewrites ${e.regenCount}
        ${e.needsRecheck ? " · needs recheck" : ""}
      </p>
      <p>
        Story: ${e.storyId ? html`<a href="/admin/stories/${e.storyId}">${event.storyLabel ?? e.storyId}</a> (${event.storyEventCount} Events)` : "none"}
        ${e.mergedIntoId ? html` · merged into <a href="/admin/events/${e.mergedIntoId}">${e.mergedIntoId}</a>` : ""}
      </p>
      <p class="muted">id ${e.id}</p>
      ${actions}
      <div class="card">
        <h3>${e.headline ?? "(no card yet)"}</h3>
        ${perspectives
          ? html`<p><b>Neutral:</b> ${e.neutral ?? "—"}</p>
              ${e.contested
                ? html`<p><b>Contested:</b> ${e.contestedReason ?? ""}</p>
                    <p><b>Left:</b> ${e.leftText ?? "—"}</p>
                    <p><b>Right:</b> ${e.rightText ?? "—"}</p>`
                : html`<p class="muted">Facts only</p>`}`
          : html`<p>${e.neutral ?? "—"}</p>`}
        <p class="muted">Entities: ${e.entities.join(", ") || "—"} · label: ${e.storyLabel ?? "—"} · card written ${time(e.cardGeneratedAt)}</p>
      </div>
      <h2>Member articles</h2>
      <table>
        <tr><th>Published</th><th>Source</th><th>Article</th></tr>
        ${members.map(
          (m) => html`<tr>
            <td>${time(m.publishedAt)}</td>
            <td>${m.source}</td>
            <td><a href="${m.url}" rel="noreferrer" target="_blank">${m.title}</a><br><span class="muted">${m.lede}</span></td>
          </tr>`,
        )}
      </table>`;
    return send(reply, layout(e.headline ?? "Event", body, msg));
  });

  app.get("/stories", async (request, reply) => {
    const query = pageQuery.parse(request.query);
    const rows = await db
      .select()
      .from(stories)
      .orderBy(desc(stories.lastEventAt), desc(stories.id))
      .limit(ADMIN_PAGE_SIZE + 1)
      .offset((query.page - 1) * ADMIN_PAGE_SIZE);

    const body = html`
      <table>
        <tr><th>Last Event</th><th>Label</th><th>Events</th><th>Status</th><th>Id</th></tr>
        ${rows.slice(0, ADMIN_PAGE_SIZE).map(
          (row) => html`<tr>
            <td>${time(row.lastEventAt)}</td>
            <td><a href="/admin/stories/${row.id}">${row.label}</a></td>
            <td>${row.eventCount}</td>
            <td>${row.status}</td>
            <td class="muted">${row.id}</td>
          </tr>`,
        )}
      </table>
      ${pager("/admin/stories", query.page, rows.length > ADMIN_PAGE_SIZE)}`;
    return send(reply, layout("Stories", body, query.msg));
  });

  app.get("/stories/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { msg } = msgQuery.parse(request.query);
    const [story] = await db.select().from(stories).where(eq(stories.id, id));
    if (!story) return reply.code(404).send("not found");

    const storyEvents = await db
      .select({ id: events.id, status: events.status, headline: events.headline, firstSeenAt: events.firstSeenAt })
      .from(events)
      .where(eq(events.storyId, id))
      .orderBy(asc(events.firstSeenAt));
    const summaries = await db
      .select({ asOfEventId: storySummaries.asOfEventId, summary: storySummaries.summary, createdAt: storySummaries.createdAt })
      .from(storySummaries)
      .where(eq(storySummaries.storyId, id))
      .orderBy(desc(storySummaries.createdAt));

    const base = `/admin/stories/${id}`;
    const body = html`
      <p>${story.eventCount} published Events · ${story.status} · ${time(story.firstEventAt)} → ${time(story.lastEventAt)}</p>
      <p class="muted">id ${story.id}</p>
      <div class="card">
        <form method="post" action="${base}/rename">
          <input type="text" name="label" value="${story.label}" required>
          <button>Rename</button>
        </form>
        <form method="post" action="${base}/merge">
          <input type="text" name="fromId" placeholder="Story id to merge into this one" required>
          <button>Merge into this Story</button>
        </form>
      </div>
      <h2>Events</h2>
      <table>
        <tr><th>First seen</th><th>Status</th><th>Headline</th></tr>
        ${storyEvents.map(
          (e) => html`<tr>
            <td>${time(e.firstSeenAt)}</td>
            <td>${statusLabel(e.status)}</td>
            <td><a href="/admin/events/${e.id}">${e.headline ?? "(no card)"}</a></td>
          </tr>`,
        )}
      </table>
      <h2>Summaries (newest first)</h2>
      ${summaries.map(
        (s) => html`<div class="card"><p>${s.summary}</p>
          <p class="muted">as of <a href="/admin/events/${s.asOfEventId}">${s.asOfEventId}</a> · ${time(s.createdAt)}</p></div>`,
      )}`;
    return send(reply, layout(story.label, body, msg));
  });

  app.get("/sources", async (request, reply) => {
    const { msg } = msgQuery.parse(request.query);
    const rows = await db.select().from(sources).orderBy(desc(sources.active), asc(sources.name));
    const body = html`
      <table>
        <tr><th>Name</th><th>Active</th><th>Feeds</th><th>Last fetched</th><th>Last new item</th><th></th></tr>
        ${rows.map(
          (row) => html`<tr>
            <td>${row.name}<br><span class="muted">${row.domain}</span></td>
            <td>${row.active ? "yes" : "no"}</td>
            <td>${row.rssUrls.length}</td>
            <td>${time(row.lastFetchedAt)}</td>
            <td>${time(row.lastNewItemAt)}</td>
            <td>${button(`/admin/sources/${row.id}/toggle`, row.active ? "Deactivate" : "Activate")}</td>
          </tr>`,
        )}
      </table>`;
    return send(reply, layout("Sources", body, msg));
  });

  app.get("/cost", async (_request, reply) => {
    const days = await db.execute<{ day: string; purpose: string; calls: number; input: number; output: number; cost: number }>(sql`
      select to_char(created_at at time zone ${TIMEZONE}, 'YYYY-MM-DD') as day, purpose,
        count(*)::int as calls, sum(input_tokens)::int as input, sum(output_tokens)::int as output, sum(cost_usd)::float as cost
      from ${llmCalls}
      where created_at >= ${startOfToday()} - (${COST_PAGE_DAYS - 1}::int * interval '1 day')
      group by 1, 2
      order by 1 desc, 2
    `);
    const today = await db
      .select({ model: llmCalls.model, calls: count(), cost: sql<number>`coalesce(sum(${llmCalls.costUsd}), 0)::float` })
      .from(llmCalls)
      .where(gte(llmCalls.createdAt, startOfToday()))
      .groupBy(llmCalls.model);
    const spentToday = today.reduce((sum, row) => sum + row.cost, 0);
    const freeTier = process.env.GEMINI_FREE_TIER !== "false";

    const totals = new Map<string, number>();
    for (const row of days) totals.set(row.day, (totals.get(row.day) ?? 0) + row.cost);

    const rowsByDay: Html[] = [];
    for (const [day, total] of totals) {
      const parts = days.filter((row) => row.day === day);
      rowsByDay.push(html`<tr><th colspan="4">${day}</th><th>$${total.toFixed(4)}</th></tr>`);
      for (const row of parts) {
        rowsByDay.push(html`<tr>
          <td></td><td>${row.purpose}</td><td>${row.calls}</td><td>${row.input} in / ${row.output} out</td><td>$${row.cost.toFixed(4)}</td>
        </tr>`);
      }
    }

    const body = html`
      <div class="card">
        <p><b>Today (IST):</b> $${spentToday.toFixed(4)} · soft budget $${DAILY_BUDGET_SOFT.toFixed(2)} (skips rewrites) ·
          hard budget $${DAILY_BUDGET_HARD.toFixed(2)} (pauses cards)</p>
        <p class="muted">Costs are at paid prices, also on the free tier.</p>
        <p><b>Requests today:</b>
          ${today.map((row) => {
            const cap = FREE_TIER_DAILY_REQUESTS[row.model];
            return html`${row.model}: ${row.calls}${freeTier && cap ? ` / ${cap} (free tier)` : ""}; `;
          })}
        </p>
      </div>
      <h2>Last ${COST_PAGE_DAYS} days</h2>
      <table>
        <tr><th>Day</th><th>Purpose</th><th>Calls</th><th>Tokens</th><th>Cost (USD)</th></tr>
        ${rowsByDay}
      </table>`;
    return send(reply, layout("Cost", body));
  });
}
