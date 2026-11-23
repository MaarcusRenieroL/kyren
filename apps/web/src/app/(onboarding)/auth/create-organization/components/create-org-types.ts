export type Invite = {
  id: number;
  email: string;
  role: "member" | "admin";
  error?: string;
};

export type ModuleRow = {
  id: string;
  name: string;
  description: string;
  icon: string;
  core: boolean;
  enabled: boolean;
};

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailError(email: string) {
  if (!email.trim()) return undefined;
  if (emailPattern.test(email.trim())) return undefined;

  return email.includes("@") && !email.split("@")[1]?.includes(".")
    ? "This address is missing its ending, like .dev or .com."
    : "That doesn’t look like an email address. Check it for typos.";
}

export const moduleTint: Record<string, string> = {
  projects: "bg-tint-projects",
  tasks: "bg-tint-tasks",
  docs: "bg-tint-docs",
};

export const moduleNote: Record<string, string> = {
  projects: "Stays on while Tasks is on",
  tasks: "Needs Projects",
  docs: "Works alone",
};
