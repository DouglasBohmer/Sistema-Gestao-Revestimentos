interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Environment {
  API_ORIGIN?: string;
  ASSETS: AssetsBinding;
}

const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

function isApiRequest(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function targetUrl(requestUrl: URL, apiOrigin: string): URL {
  const origin = new URL(apiOrigin);
  return new URL(`${requestUrl.pathname}${requestUrl.search}`, origin);
}

function upstreamHeaders(request: Request, requestUrl: URL): Headers {
  const headers = new Headers(request.headers);
  HOP_BY_HOP_HEADERS.forEach((name) => headers.delete(name));
  headers.delete("host");
  headers.set("x-forwarded-host", requestUrl.host);
  headers.set("x-forwarded-proto", requestUrl.protocol.replace(/:$/, ""));
  return headers;
}

type UnavailableReason = "API_ORIGIN_MISSING" | "API_UPSTREAM_UNREACHABLE";

function unavailableResponse(reason: UnavailableReason): Response {
  const error = reason === "API_ORIGIN_MISSING"
    ? "A API do RedeASSO ainda não foi configurada no Worker."
    : "A API do RedeASSO não respondeu.";

  return Response.json(
    { error, code: reason },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export default {
  async fetch(request: Request, environment: Environment): Promise<Response> {
    const requestUrl = new URL(request.url);
    if (!isApiRequest(requestUrl.pathname)) {
      return environment.ASSETS.fetch(request);
    }

    if (!environment.API_ORIGIN) {
      return unavailableResponse("API_ORIGIN_MISSING");
    }

    try {
      return await fetch(targetUrl(requestUrl, environment.API_ORIGIN), {
        method: request.method,
        headers: upstreamHeaders(request, requestUrl),
        body: request.body,
        redirect: "manual",
      });
    } catch (error) {
      console.error("Não foi possível alcançar a API de origem.", error);
      return unavailableResponse("API_UPSTREAM_UNREACHABLE");
    }
  },
};
