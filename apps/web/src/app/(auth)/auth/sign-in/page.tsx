"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { authClient } from "@kyren/auth/client";
import { toastError } from "@kyren/ui/lib/toast";
import { cn } from "@kyren/ui/lib/utils";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";

import {
  AuthBanner,
  AuthField,
  AuthHeading,
  AuthNote,
  PasswordInput,
} from "~/src/features/auth/components/kit/auth-kit";
import {
  formatMmSs,
  useCountdown,
} from "~/src/features/auth/lib/use-countdown";
import {
  SignInFormValues,
  signInSchema,
} from "~/src/features/auth/lib/zod-schema";
import { getSafeRedirectPath, paths } from "~/src/lib/paths";

function getRedirectTarget() {
  const redirectTo = new URLSearchParams(window.location.search).get(
    "redirectTo",
  );

  return getSafeRedirectPath(redirectTo) ?? paths.dashboard();
}

export default function LoginPage() {
  const router = useRouter();
  const pause = useCountdown();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);

  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = async (formValues: SignInFormValues) => {
    setSignInError(null);

    let retryAfter = 0;
    const { data, error } = await authClient.signIn.email(
      { email: formValues.email, password: formValues.password },
      {
        onError(context) {
          if (context.response.status === 429) {
            retryAfter =
              Number(context.response.headers.get("X-Retry-After")) || 60;
          }
        },
      },
    );

    if (retryAfter > 0) {
      // Paused for this email: the button waits out the countdown.
      pause.start(retryAfter);
      return;
    }

    if (error) {
      setSignInError(
        error.message ?? "That email and password didn’t match. Try again.",
      );
      toastError(error, "Sign in failed");
      return;
    }

    // The password was right but this account also needs a code.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setNeedsCode(true);
      return;
    }

    // The dashboard sends users without an organization or a verified email
    // to the matching onboarding step.
    router.replace(getRedirectTarget());
    router.refresh();
  };

  const paused = !pause.done;

  if (needsCode) {
    return (
      <TwoFactorStep
        onVerified={() => {
          router.replace(getRedirectTarget());
          router.refresh();
        }}
      />
    );
  }

  return (
    <form method="post" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-5">
        <AuthHeading
          title="Sign in to Kyren"
          description="Welcome back. Use your work account."
        />

        {paused ? (
          <AuthBanner title="Too many attempts.">
            For your security we paused sign-in for this email. Try again in{" "}
            <span className="font-mono text-ink">
              {formatMmSs(pause.seconds)}.
            </span>
          </AuthBanner>
        ) : null}

        <Controller
          name="email"
          control={control}
          render={({ field, fieldState }) => (
            <AuthField
              label="Work email"
              htmlFor="email"
              error={fieldState.error?.message}
            >
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={fieldState.error ? "email-error" : undefined}
                className="font-mono text-sm"
                {...field}
              />
            </AuthField>
          )}
        />

        <Controller
          name="password"
          control={control}
          render={({ field, fieldState }) => (
            <AuthField
              label="Password"
              htmlFor="password"
              link={{
                href: paths.auth.forgotPassword(),
                label: "Forgot password?",
              }}
              error={fieldState.error?.message ?? signInError ?? undefined}
            >
              <PasswordInput
                id="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                aria-invalid={
                  fieldState.invalid || Boolean(signInError) || undefined
                }
                aria-describedby={
                  fieldState.error || signInError ? "password-error" : undefined
                }
                {...field}
              />
            </AuthField>
          )}
        />

        <Button
          type="submit"
          loading={isSubmitting}
          disabled={paused}
          // The paused state is the one place the button is disabled, and it
          // says why, in the banner above.
          className={cn("w-full", paused && "opacity-40")}
        >
          Sign in
        </Button>

        {paused ? (
          <AuthNote>
            You can still reset your password. Sign-in unlocks when the timer
            ends.
          </AuthNote>
        ) : null}
      </div>
    </form>
  );
}

/** The second step for accounts with an authenticator app. */
function TwoFactorStep({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const { error: failure } = backup
      ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
      : await authClient.twoFactor.verifyTotp({ code: code.trim() });

    setBusy(false);

    if (failure) {
      setError(
        failure.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "That code didn’t work. Try again.",
      );
      return;
    }

    onVerified();
  }

  return (
    <form method="post" noValidate onSubmit={submit}>
      <div className="flex flex-col gap-5">
        <AuthHeading
          title="Enter your code"
          description={
            backup
              ? "Use one of the backup codes you saved. Each works once."
              : "Open your authenticator app and enter the 6-digit code."
          }
        />
        <AuthField
          label={backup ? "Backup code" : "6-digit code"}
          htmlFor="two-factor-code"
          error={error ?? undefined}
        >
          <Input
            id="two-factor-code"
            inputMode={backup ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoFocus
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "two-factor-code-error" : undefined}
            className="font-mono text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </AuthField>
        <Button
          type="submit"
          loading={busy}
          disabled={!code.trim()}
          className="w-full"
        >
          Verify
        </Button>
        <Button
          variant="custom"
          type="button"
          className="text-sm text-ink-2 underline-offset-2 hover:underline"
          onClick={() => {
            setBackup((value) => !value);
            setCode("");
            setError(null);
          }}
        >
          {backup ? "Use my authenticator app" : "Use a backup code"}
        </Button>
      </div>
    </form>
  );
}
