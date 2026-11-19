import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@zentro/auth";

import { paths } from "~/src/lib/paths";

import { contentSecurityPolicy } from "../security-headers";

// Invitation links stay open to users who already belong to an organization.
const onboardingRoute = "/auth/join-organization";

function isOnboardingRoute(pathname: string) {
  return (
    pathname === onboardingRoute || pathname.startsWith(`${onboardingRoute}/`)
  );
}

// NextURL keeps the base path (e.g. /zentro behind the gateway); new URL() would drop it.
function appUrl(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  const target = new URL(path, "http://app.invalid");

  url.pathname = target.pathname;
  url.search = target.search;

  return url;
}

/** Pages that need a signed-in, verified person. */
export const protectedPrefixes = [
  "/dashboard",
  "/overview",
  "/projects",
  "/settings",
  "/docs",
  "/tasks",
  "/module-disabled",
  "/inbox",
  "/files",
  "/chat",
  "/admin",
  "/platform",
  "/calendar",
  "/hr",
  "/mail",
  "/payroll",
  "/payslip",
  "/tickets",
  "/whiteboards",
  "/auth/create-organization",
  "/auth/join-organization",
  "/auth/invite",
];

function isProtected(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Whether the page may be shown, or where to send the person instead. */
async function signInGate(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) return null;

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    const signInUrl = appUrl(request, paths.auth.signIn());

    // Invite links come back to the invitation after signing in.
    if (pathname.startsWith("/auth/invite/")) {
      signInUrl.searchParams.set("redirectTo", pathname);
    }

    return NextResponse.redirect(signInUrl);
  }

  if (!session.user.emailVerified) {
    return NextResponse.redirect(
      appUrl(request, paths.auth.verifyEmail(session.user.email)),
    );
  }

  if (isOnboardingRoute(pathname)) {
    const organizations = await auth.api.listOrganizations({
      headers: request.headers,
    });

    if (organizations.length > 0) {
      return NextResponse.redirect(appUrl(request, paths.dashboard()));
    }
  }

  return null;
}

/**
 * Every page gets a fresh nonce: its scripts run only with it (see the CSP).
 * Next.js reads it from the request's CSP header and puts it on its own
 * scripts; the root layout reads `x-nonce` for the one inline script it adds.
 */
export async function proxy(request: NextRequest) {
  const redirect = await signInGate(request);

  if (redirect) return redirect;

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("content-security-policy", policy);

  return response;
}

export const config = {
  // Every page, not API routes, Next's own files or files with an extension.
  matcher: ["/((?!api/|_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
