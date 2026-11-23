"use client";

import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";

type CreateOrgActionsProps = {
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  isSubmitting: boolean;
  checkingSlug: boolean;
  created: boolean;
  workspaceSlug: string;
  visibleSlugAvailability: boolean | null;
  sending: boolean;
  validInvitesCount: number;
  onSendInvites: () => void;
  finishing: boolean;
  modulesLoaded: boolean;
  onFinish: () => void;
};

export function CreateOrgActions({
  step,
  setStep,
  isSubmitting,
  checkingSlug,
  created,
  workspaceSlug,
  visibleSlugAvailability,
  sending,
  validInvitesCount,
  onSendInvites,
  finishing,
  modulesLoaded,
  onFinish,
}: CreateOrgActionsProps) {
  return (
    <div className="flex items-center gap-2 pt-1">
      {step > 1 ? (
        <Button
          variant="outline"
          size="lg"
          onClick={() => setStep((value) => value - 1)}
        >
          <ArrowLeftIcon />
          Back
        </Button>
      ) : null}
      <span className="flex-1" />
      {step === 2 ? (
        <Button variant="ghost" size="lg" onClick={() => setStep(3)}>
          Skip for now
        </Button>
      ) : null}
      {step === 1 ? (
        <Button
          type="submit"
          form="workspace-form"
          size="lg"
          loading={
            isSubmitting ||
            checkingSlug ||
            (!created &&
              Boolean(workspaceSlug) &&
              visibleSlugAvailability === null)
          }
        >
          Continue
        </Button>
      ) : null}
      {step === 2 ? (
        <Button size="lg" loading={sending} onClick={onSendInvites}>
          {validInvitesCount > 0
            ? `Send ${validInvitesCount} invite${validInvitesCount === 1 ? "" : "s"}`
            : "Continue"}
        </Button>
      ) : null}
      {step === 3 ? (
        <Button
          size="lg"
          loading={finishing}
          disabled={!modulesLoaded}
          onClick={onFinish}
        >
          Finish setup
        </Button>
      ) : null}
    </div>
  );
}
