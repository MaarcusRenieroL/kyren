/**
 * The origins allowed to send state-changing requests to the auth endpoints.
 * Localhost is trusted for development only: in production a page served from
 * someone's own localhost must not pass the origin check.
 */
export function trustedOriginsFor(
  baseURL: string,
  nodeEnv: string | undefined,
) {
  const origins = [new URL(baseURL).origin];

  if (nodeEnv !== "production") origins.push("http://localhost:3000");

  return Array.from(new Set(origins));
}
