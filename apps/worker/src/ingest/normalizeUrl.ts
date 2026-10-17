import { TRACKING_PARAMS, TRACKING_PARAM_PREFIXES } from "@fr/shared";

function isTrackingParam(name: string) {
  const key = name.toLowerCase();
  return TRACKING_PARAMS.includes(key) || TRACKING_PARAM_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function normalizeUrl(input: string) {
  const url = new URL(input.trim());

  url.hostname = url.hostname.replace(/^(amp|m)\./, "");
  url.hash = "";

  for (const name of [...url.searchParams.keys()]) {
    if (isTrackingParam(name)) url.searchParams.delete(name);
  }

  let path = url.pathname.replace(/\/amp\/?$/, "");
  path = path.replace(/\/+$/, "");
  url.pathname = path || "/";

  return url.toString().replace(/\/$/, "");
}
