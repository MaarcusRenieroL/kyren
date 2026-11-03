import path from "node:path";

import type { NextConfig } from "next";

import { securityHeaders } from "./security-headers";

const nextConfig: NextConfig = {
  // Set by the gateway so the app can live under /<name>; unset serves it at /.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  devIndicators: {
    position: "bottom-right",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    // The old task-scoped project pages showed sample data; projects live at
    // /projects now.
    return [
      {
        source: "/tasks/projects",
        destination: "/projects",
        permanent: true,
      },
      {
        source: "/tasks/projects/:slug",
        destination: "/projects/:slug",
        permanent: true,
      },
    ];
  },
  transpilePackages: [
    "@zentro/ui",
    "@zentro/db",
    "@zentro/auth",
    "@zentro/modules",
    "@zentro/permissions",
    "@zentro/utils",
  ],
};

export default nextConfig;
