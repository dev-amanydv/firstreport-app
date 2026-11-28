import { appConfigSchema, cardPayloadSchema, exploreSchema, feedSchema, SEARCH_QUERY_MIN, searchResultSchema, summarySchema, timelineSchema, type Category } from "@fr/shared";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { z } from "zod";

const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const PAGE_SIZE = 20;

export class HttpError extends Error {
  status: number;
  constructor(path: string, status: number, method = "GET") {
    super(`${method} ${path} → ${status}`);
    this.status = status;
  }
}

const isNotFound = (error: unknown) => error instanceof HttpError && error.status === 404;

async function get<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) throw new HttpError(path, response.status);
  return schema.parse(await response.json());
}

type Method = "GET" | "POST" | "DELETE";
type RequestOptions<T extends z.ZodType> = { token?: string; body?: object; schema?: T };

// Per-user calls (sign-in, account). Never cached; the session token goes in the Authorization header.
export async function apiRequest<T extends z.ZodType>(
  method: Method,
  path: string,
  options: RequestOptions<T> & { schema: T },
): Promise<z.infer<T>>;
export async function apiRequest(method: Method, path: string, options?: Omit<RequestOptions<z.ZodType>, "schema">): Promise<void>;
export async function apiRequest<T extends z.ZodType>(method: Method, path: string, { token, body, schema }: RequestOptions<T> = {}) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers["content-type"] = "application/json";
  const response = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new HttpError(path, response.status, method);
  return schema ? schema.parse(await response.json()) : undefined;
}

// A missing row is an answer, not a failure: no retries, no error state.
async function getOrNull<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T> | null> {
  try {
    return await get(path, schema);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

// null is the "Top stories" feed: every category.
export function useFeed(category: Category | null) {
  return useInfiniteQuery({
    queryKey: ["feed", category ?? "top"],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (category) params.set("category", category);
      if (pageParam) params.set("cursor", pageParam);
      return get(`/v1/feed?${params}`, feedSchema);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // A refetch would put new cards on top and move the reader's card; Feed resets after a long absence instead.
    refetchOnWindowFocus: false,
  });
}

export function useAppConfig() {
  return useQuery({ queryKey: ["config"], queryFn: () => get("/v1/config", appConfigSchema), staleTime: Infinity });
}

// Fetched only while the sheet is open; the cache keeps it for the closing animation.
export function useTimeline(storyId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["timeline", storyId],
    queryFn: () => get(`/v1/stories/${storyId}/timeline`, timelineSchema),
    enabled,
  });
}

// null when the Story has no summary as of this Event (its first Event, or one not summarised yet).
export function useSummary(storyId: string, asOf: string, enabled: boolean) {
  return useQuery({
    queryKey: ["summary", storyId, asOf],
    queryFn: () => getOrNull(`/v1/stories/${storyId}/summary?asOf=${asOf}`, summarySchema),
    enabled,
  });
}

// null when the Event is gone (hidden or never published). A merged Event redirects to its survivor.
export function useEvent(id: string) {
  return useQuery({ queryKey: ["event", id], queryFn: () => getOrNull(`/v1/events/${id}`, cardPayloadSchema) });
}

export function useExplore() {
  return useQuery({ queryKey: ["explore"], queryFn: () => get("/v1/explore", exploreSchema) });
}

// q is already debounced by the caller. The previous results stay on screen while the next ones load.
export function useSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ["search", query.toLowerCase()],
    queryFn: () => get(`/v1/search?${new URLSearchParams({ q: query })}`, searchResultSchema),
    enabled: query.length >= SEARCH_QUERY_MIN,
    placeholderData: keepPreviousData,
  });
}
