const production = process.env.NODE_ENV === "production";

/**
 * What a page may load. Scripts run only with this request's nonce (Next.js
 * puts it on its own scripts); `'strict-dynamic'` lets those load the app's
 * chunks, so no inline script without the nonce ever runs. Development also
 * needs eval for hot reloading. Styles stay inline-friendly (the UI sets
 * element styles). Images may come from any https host because link previews
 * show remote pictures. Nothing may frame the app, and forms and base URLs
 * stay on this site.
 */
export function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${production ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Headers every response gets. The CSP is added per page by the proxy, with a
 * fresh nonce; file downloads set a stricter one of their own.
 */
export const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Other sites cannot hold a handle to this window or read its responses.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];
