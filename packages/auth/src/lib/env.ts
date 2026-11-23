const requiredEnv = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "DATABASE_URL",
  "NEXT_PUBLIC_BASE_URL",
  "RESEND_API_KEY",
] as const;

type RequiredEnvKey = (typeof requiredEnv)[number];

function readRequiredEnv(key: RequiredEnvKey): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function validateProductionEnv() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  for (const key of requiredEnv) {
    readRequiredEnv(key);
  }

  if (process.env.BETTER_AUTH_SECRET!.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be at least 32 characters.");
  }

  for (const warning of productionWarnings(process.env)) {
    console.warn(`[kyren] ${warning}`);
  }
}

/**
 * Settings that do not stop the app starting but make production misbehave.
 * They are logged, not thrown, so a deploy is never taken down by them.
 */
export function productionWarnings(env: Record<string, string | undefined>) {
  const warnings: string[] = [];

  if (!env.EMAIL_FROM) {
    warnings.push(
      "EMAIL_FROM is not set. Mail goes out from Resend's test address and reaches only the Resend account owner.",
    );
  }

  if (!env.CRON_SECRET || env.CRON_SECRET.length < 16) {
    warnings.push(
      "CRON_SECRET is missing or short. The scheduled chat jobs will refuse to run.",
    );
  }

  if (env.FILE_STORAGE !== "s3") {
    warnings.push(
      "File storage is on local disk. Uploads are lost when a serverless instance restarts; set FILE_STORAGE=s3.",
    );
  }

  return warnings;
}

// Resend only delivers from its own address to the account owner. Set
// EMAIL_FROM to a sender on a domain verified in Resend to reach everyone.
const defaultEmailFrom = "Kyren <onboarding@resend.dev>";

export const authEnv = {
  get RESEND_API_KEY() {
    return readRequiredEnv("RESEND_API_KEY");
  },
  get EMAIL_FROM() {
    return process.env.EMAIL_FROM || defaultEmailFrom;
  },
};
