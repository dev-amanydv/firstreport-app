import { FETCH_TIMEOUT_MS, USER_AGENT } from "@fr/shared";

export function httpGet(url: string, headers: Record<string, string> = {}) {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT, ...headers },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

export function isHttpUrl(value: string | null | undefined): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}
