export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  inviterName: string | null;
};

export type Role = "member" | "admin";

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const DAY = 24 * 60 * 60 * 1000;

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Why an address can't be sent, in words a person can act on. */
export function problemWith(email: string) {
  if (!email.includes("@")) return `${email} is missing the @.`;
  if (!/\.[^\s@.]{2,}$/.test(email.split("@")[1] ?? "")) {
    return `${email} is missing the ending, like .com.`;
  }

  return `${email} doesn’t look like an email address.`;
}

/** The invite's state: pending, expired or accepted. */
export function stateOf(invitation: InvitationRow, now: number) {
  if (invitation.status === "accepted") return "accepted" as const;

  const expired =
    invitation.expiresAt !== null &&
    new Date(invitation.expiresAt).getTime() < now;

  return expired ? ("expired" as const) : ("pending" as const);
}
