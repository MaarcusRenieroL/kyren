import { describe, expect, it } from "vitest";

import { authAllowedDuringMaintenance } from "../src/lib/maintenance";

describe("auth during maintenance", () => {
  it("lets people sign in, pass two-factor, pick an organization and end sessions", () => {
    for (const action of [
      "sign-in/email",
      "sign-out",
      "two-factor/verify-totp",
      "two-factor/verify-backup-code",
      "organization/set-active",
      "revoke-session",
    ]) {
      expect(authAllowedDuringMaintenance(`/zentro/api/auth/${action}`)).toBe(
        true,
      );
      expect(authAllowedDuringMaintenance(`/api/auth/${action}`)).toBe(true);
    }
  });

  it("holds back everything that changes data", () => {
    for (const action of [
      "sign-up/email",
      "organization/create",
      "organization/invite-member",
      "organization/update-member-role",
      "organization/remove-member",
      "organization/accept-invitation",
      "change-password",
      "reset-password",
      "update-user",
      "two-factor/enable",
      "sign-in/email/../../sign-up/email",
    ]) {
      expect(authAllowedDuringMaintenance(`/api/auth/${action}`)).toBe(false);
    }
  });
});
