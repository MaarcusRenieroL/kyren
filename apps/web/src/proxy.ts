import { NextResponse, type NextRequest } from "next/server";

import { paths } from "~/src/lib/paths";

import {
  contentSecurityPolicy,
  publicContentSecurityPolicy,
} from "../security-headers";

// Invitation links stay open to users who already belong to an organization.
const onboardingRoute = "/auth/join-organization";

function isOnboardingRoute(pathname: string) {
  return (
    pathname === onboardingRoute || pathname.startsWith(`${onboardingRoute}/`)
  );
}

// NextURL keeps the base path (e.g. /kyren behind the gateway); new URL() would drop it.
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

/**
 * The marketing site is prerendered and served from the CDN, so it cannot use
 * a per-request CSP nonce. Every route here must stay static and free of user
 * data; a route that needs either belongs outside these prefixes.
 */
export const publicPrefixes = [
  "/about",
  "/changelog",
  "/cookies",
  "/dpa",
  "/modules",
  "/pricing",
  "/privacy",
  "/roadmap",
  "/security",
  "/status",
  "/subprocessors",
  "/terms",
];

function isPublicPage(pathname: string) {
  return (
    pathname === "/" ||
    publicPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

// Better Auth signs the session token. The cookie name only decides whether a
// session lookup is worth doing; the lookup itself decides the redirect.
const sessionCookieNames = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  "better-auth-session_token",
  "__Secure-better-auth-session_token",
];

function hasSessionCookie(request: NextRequest) {
  return sessionCookieNames.some((name) => request.cookies.has(name));
}

/** Whether the page may be shown, or where to send the person instead. */
async function signInGate(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) return null;

  // Loaded only when a protected page is requested: the marketing site never
  // pays to initialize the auth and database stack.
  const { auth } = await import("@kyren/auth");

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
 * Every signed-in page gets a fresh nonce: its scripts run only with it (see
 * the CSP). Next.js reads it from the request's CSP header and puts it on its
 * own scripts; the providers in the workspace and auth layouts read `x-nonce`
 * for the inline scripts they add.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A signed-in visitor should land in the app, not on the marketing page.
  // Only people carrying a session cookie pay for the lookup, so anonymous
  // visitors keep the static, edge-cached page. Check the session itself: a
  // stale cookie must not trap a signed-out person on a redirect loop.
  if (pathname === "/" && hasSessionCookie(request)) {
    const { auth } = await import("@kyren/auth");
    const session = await auth.api.getSession({ headers: request.headers });

    if (session) {
      return NextResponse.redirect(appUrl(request, paths.dashboard()));
    }
  }

  const redirect = await signInGate(request);

  if (redirect) return redirect;

  if (isPublicPage(pathname)) {
    const response = NextResponse.next();

    response.headers.set(
      "content-security-policy",
      publicContentSecurityPolicy(),
    );

    return response;
  }

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
