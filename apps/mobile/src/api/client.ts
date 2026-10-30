import { appConfigSchema, feedSchema, type Category } from "@fr/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { z } from "zod";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const PAGE_SIZE = 20;

async function get<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) throw new Error(`GET ${path} → ${response.status}`);
  return schema.parse(await response.json());
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
