// api/roadmap-proxy/[...path].js
//
// Vercel serverless function. Thin pass-through proxy from roadmap-viax.vercel.app
// to the Railway backend. Exists because the Cowork scheduled-task sandbox blocks
// roadmap-production-2306.up.railway.app via its outbound allowlist but allows
// vercel.app. The scheduled-task calls this proxy; the proxy forwards everything
// (method, headers including X-Scan-Secret, query string, body) to Railway.
//
// Env var required (set in Vercel → Settings → Environment Variables):
//   ROADMAP_BACKEND_URL=https://roadmap-production-2306.up.railway.app
//
// The scheduled task is already configured to call
//   https://roadmap-viax.vercel.app/api/roadmap-proxy/<any backend path>
// with the same X-Scan-Secret header it previously sent directly to Railway.

const BACKEND_URL = process.env.ROADMAP_BACKEND_URL;

// Hop-by-hop headers (RFC 7230 §6.1) + Vercel-injected headers that must not be forwarded.
const STRIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-for",
  "x-real-ip",
  "x-vercel-id",
  "x-vercel-deployment-url",
  "x-vercel-forwarded-for",
  "x-vercel-ip-city",
  "x-vercel-ip-country",
  "x-vercel-ip-country-region",
  "x-vercel-ip-latitude",
  "x-vercel-ip-longitude",
  "x-vercel-ip-timezone",
]);

const STRIP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-encoding", // let the runtime re-encode
  "content-length",   // recomputed automatically
]);

function forwardHeaders(src) {
  const out = {};
  for (const [key, value] of Object.entries(src)) {
    if (value === undefined) continue;
    if (STRIP_REQUEST_HEADERS.has(key.toLowerCase())) continue;
    out[key] = Array.isArray(value) ? value.join(",") : value;
  }
  return out;
}

export default async function handler(req, res) {
  if (!BACKEND_URL) {
    res.status(500).json({
      error: "proxy_misconfigured",
      message: "ROADMAP_BACKEND_URL env var is not set",
    });
    return;
  }

  // req.query.path is populated by the [...path] catch-all segment.
  const pathParam = req.query.path;
  const pathSegments = Array.isArray(pathParam)
    ? pathParam
    : typeof pathParam === "string"
      ? [pathParam]
      : [];

  // Rebuild the query string, excluding the catch-all param itself.
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path") continue;
    if (Array.isArray(value)) {
      for (const v of value) searchParams.append(key, v);
    } else if (value !== undefined) {
      searchParams.append(key, value);
    }
  }
  const search = searchParams.toString();
  const base = BACKEND_URL.replace(/\/+$/, "");
  const upstreamPath = pathSegments.map(encodeURIComponent).join("/");
  const upstreamUrl = `${base}/${upstreamPath}${search ? `?${search}` : ""}`;

  const method = (req.method ?? "GET").toUpperCase();
  const methodHasBody = !["GET", "HEAD"].includes(method);
  let body;
  if (methodHasBody && req.body !== undefined && req.body !== null) {
    body =
      typeof req.body === "string"
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString("utf8")
          : JSON.stringify(req.body);
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method,
      headers: forwardHeaders(req.headers),
      body,
      redirect: "manual",
    });
  } catch (err) {
    res.status(502).json({
      error: "upstream_unreachable",
      message: err?.message ?? String(err),
      upstream: upstreamUrl,
    });
    return;
  }

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}
