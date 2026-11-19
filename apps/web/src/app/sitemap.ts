import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

/** The public pages of the site. */
const pages = [
  "",
  "/modules",
  "/pricing",
  "/about",
  "/security",
  "/roadmap",
  "/changelog",
  "/status",
  "/privacy",
  "/terms",
  "/cookies",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((path) => ({ url: `${base}${path}` }));
}
