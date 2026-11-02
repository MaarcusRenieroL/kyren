/** The auth endpoint for an origin and an optional path prefix, whatever slashes either carries. */
export function authBaseUrl(origin: string, basePath = ""): string {
  const prefix = basePath.replace(/^\/+|\/+$/g, "");

  return `${origin.replace(/\/+$/, "")}${prefix ? `/${prefix}` : ""}/api/auth`;
}
