import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

/** The public site is indexed; the app, its API and shared links are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard",
        "/overview",
        "/inbox",
        "/projects",
        "/tasks",
        "/docs",
        "/chat",
        "/files",
        "/calendar",
        "/whiteboards",
        "/mail",
        "/tickets",
        "/hr",
        "/payroll",
        "/payslip",
        "/admin",
        "/settings",
        "/platform",
        "/share/",
        "/support/",
        "/forms/",
        "/dev/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
