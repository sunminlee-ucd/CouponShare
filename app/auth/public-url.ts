function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

function validHost(value: string) {
  return /^[a-z0-9.-]+(?::\d+)?$/i.test(value);
}

export function publicRequestOrigin(request: Request) {
  const configured = (process.env.APP_BASE_URL ?? "").trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      // Fall through to proxy headers.
    }
  }

  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const hostHeader = firstHeaderValue(request.headers.get("host"));
  const host = validHost(forwardedHost)
    ? forwardedHost
    : validHost(hostHeader)
      ? hostHeader
      : new URL(request.url).host;

  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto")).toLowerCase();
  const requestProtocol = new URL(request.url).protocol.replace(":", "").toLowerCase();
  const protocol = forwardedProto === "https" || forwardedProto === "http"
    ? forwardedProto
    : requestProtocol === "http" && /^(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(host)
      ? "http"
      : "https";

  return `${protocol}://${host}`;
}

export function publicRequestUrl(request: Request, pathname: string) {
  return new URL(pathname, `${publicRequestOrigin(request)}/`);
}
