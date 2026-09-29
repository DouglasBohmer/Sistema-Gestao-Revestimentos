interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface ProductImageObject {
  body: ReadableStream<Uint8Array>;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}

interface ProductImageBucket {
  put(
    key: string,
    value: ReadableStream<Uint8Array>,
    options: {
      httpMetadata: { contentType: string };
      customMetadata: Record<string, string>;
    },
  ): Promise<void>;
  get(key: string): Promise<ProductImageObject | null>;
  delete(key: string): Promise<void>;
}

interface Environment {
  API_ORIGIN?: string;
  ASSETS: AssetsBinding;
  PRODUCT_IMAGES?: ProductImageBucket;
}

const PRODUCT_IMAGE_API_PATH = "/api/product-images";
const PRODUCT_IMAGE_PUBLIC_PREFIX = "/product-images/";
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PRODUCT_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

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

function healthUrl(apiOrigin: string): URL {
  // Este endpoint responde sem consultar o banco. O cron mantém somente a
  // instância Render acordada, permitindo que o Neon suspenda sem uso real.
  return new URL("/api/healthz", new URL(apiOrigin));
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
  const error =
    reason === "API_ORIGIN_MISSING"
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

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

function sameOriginRequest(request: Request, requestUrl: URL): boolean {
  return request.headers.get("origin") === requestUrl.origin;
}

async function authenticated(
  request: Request,
  environment: Environment,
): Promise<boolean> {
  if (!environment.API_ORIGIN) return false;

  const headers = new Headers({ accept: "application/json" });
  for (const name of ["cookie", "authorization"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const response = await fetch(
      new URL("/api/auth/session", environment.API_ORIGIN),
      { headers },
    );
    if (!response.ok) return false;
    const session = (await response.json()) as { authenticated?: boolean };
    return session.authenticated === true;
  } catch {
    return false;
  }
}

function imageKeyFromUrl(value: unknown, requestUrl: URL): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;

  try {
    const imageUrl = new URL(value, requestUrl.origin);
    if (imageUrl.origin !== requestUrl.origin) return null;
    if (!imageUrl.pathname.startsWith(PRODUCT_IMAGE_PUBLIC_PREFIX)) return null;
    const key = imageUrl.pathname.slice(PRODUCT_IMAGE_PUBLIC_PREFIX.length);
    return /^[a-f0-9-]+\.(?:jpg|png|webp|avif)$/.test(key) ? key : null;
  } catch {
    return null;
  }
}

async function handleProductImageMutation(
  request: Request,
  requestUrl: URL,
  environment: Environment,
): Promise<Response> {
  if (!environment.PRODUCT_IMAGES) {
    return jsonError(
      "O bucket de imagens do Cloudflare R2 não está configurado.",
      503,
    );
  }
  if (!sameOriginRequest(request, requestUrl)) {
    return jsonError("Origem da requisição inválida.", 403);
  }
  if (!(await authenticated(request, environment))) {
    return jsonError("Autenticação necessária para alterar imagens.", 401);
  }

  if (request.method === "POST") {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError("Selecione um arquivo de imagem.", 400);
    }

    const extension = ALLOWED_PRODUCT_IMAGE_TYPES.get(file.type);
    if (!extension) {
      return jsonError("Use uma imagem JPG, PNG, WebP ou AVIF.", 400);
    }
    if (file.size === 0 || file.size > MAX_PRODUCT_IMAGE_BYTES) {
      return jsonError("A imagem deve ter no máximo 5 MB.", 400);
    }

    const key = `${crypto.randomUUID()}.${extension}`;
    await environment.PRODUCT_IMAGES.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { originalName: file.name.slice(0, 200) },
    });

    return Response.json(
      { url: `${PRODUCT_IMAGE_PUBLIC_PREFIX}${key}` },
      { status: 201 },
    );
  }

  if (request.method === "DELETE") {
    const payload = (await request.json()) as { url?: unknown };
    const key = imageKeyFromUrl(payload.url, requestUrl);
    if (!key)
      return jsonError(
        "A URL informada não pertence ao armazenamento de imagens.",
        400,
      );
    await environment.PRODUCT_IMAGES.delete(key);
    return new Response(null, { status: 204 });
  }

  return new Response(null, {
    status: 405,
    headers: { Allow: "POST, DELETE" },
  });
}

async function serveProductImage(
  requestUrl: URL,
  environment: Environment,
): Promise<Response> {
  if (!environment.PRODUCT_IMAGES) return new Response(null, { status: 404 });

  const key = requestUrl.pathname.slice(PRODUCT_IMAGE_PUBLIC_PREFIX.length);
  if (!/^[a-f0-9-]+\.(?:jpg|png|webp|avif)$/.test(key)) {
    return new Response(null, { status: 404 });
  }

  const image = await environment.PRODUCT_IMAGES.get(key);
  if (!image) return new Response(null, { status: 404 });

  const headers = new Headers({
    "cache-control": "public, max-age=31536000, immutable",
    etag: image.httpEtag,
    "x-content-type-options": "nosniff",
  });
  image.writeHttpMetadata(headers);
  return new Response(image.body, { headers });
}

export default {
  async fetch(request: Request, environment: Environment): Promise<Response> {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname.startsWith(PRODUCT_IMAGE_PUBLIC_PREFIX)) {
      return serveProductImage(requestUrl, environment);
    }
    if (requestUrl.pathname === PRODUCT_IMAGE_API_PATH) {
      return handleProductImageMutation(request, requestUrl, environment);
    }
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

  async scheduled(
    _controller: unknown,
    environment: Environment,
  ): Promise<void> {
    if (!environment.API_ORIGIN) {
      console.error("Ping não executado: API_ORIGIN não está configurada.");
      return;
    }

    try {
      const response = await fetch(healthUrl(environment.API_ORIGIN), {
        headers: { "cache-control": "no-store" },
      });

      if (!response.ok) {
        console.error("Ping do Render respondeu com erro.", response.status);
      }
    } catch (error) {
      console.error("Ping do Render não conseguiu alcançar a API.", error);
    }
  },
};
