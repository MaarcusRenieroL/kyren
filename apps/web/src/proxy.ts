import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@zentro/auth";

import { paths } from "~/src/lib/paths";

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/overview/:path*",
    "/projects/:path*",
    "/settings/:path*",
    "/docs/:path*",
    "/tasks/:path*",
    "/module-disabled",
    "/inbox/:path*",
    "/files/:path*",
    "/chat/:path*",
    "/admin/:path*",
    "/calendar/:path*",
    "/hr/:path*",
    "/mail/:path*",
    "/payroll/:path*",
    "/tickets/:path*",
    "/whiteboards/:path*",
    "/auth/create-organization/:path*",
    "/auth/join-organization/:path*",
    "/auth/invite/:path*",
  ],
};
