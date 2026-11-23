import { createAuthClient } from "better-auth/client";
import {
  emailOTPClient,
  inferAdditionalFields,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { betterAuthAc, betterAuthRoles } from "../access-control";
import { userAdditionalFields } from "../additional-fields";
import { authBaseUrl } from "../lib/base-url";

// Set by the gateway when the app is served under a prefix such as /kyren.
export const authClient = createAuthClient({
  baseURL: authBaseUrl(
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"),
    // Set by the gateway when the app is served under a prefix such as /kyren.
    process.env.NEXT_PUBLIC_BASE_PATH,
  ),
  plugins: [
    emailOTPClient(),
    twoFactorClient(),
    organizationClient({
      ac: betterAuthAc,
      roles: betterAuthRoles,
    }),
    inferAdditionalFields<never, { user: typeof userAdditionalFields }>({
      user: userAdditionalFields,
    }),
  ],
});
