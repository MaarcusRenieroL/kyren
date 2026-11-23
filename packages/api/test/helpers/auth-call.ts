import { auth } from "@zentro/auth";

export const baseUrl = "http://localhost:3000/api/auth";

export async function callAuth(
  headers: Headers,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
) {
  const requestHeaders = new Headers(headers);

  requestHeaders.set("content-type", "application/json");

  return auth.handler(
    new Request(`${baseUrl}${path}`, {
      method,
      headers: requestHeaders,
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    }),
  );
}
