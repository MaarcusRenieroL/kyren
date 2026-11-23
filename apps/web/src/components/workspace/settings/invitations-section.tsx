"use client";

import type { FC } from "react";
import { usePermission } from "~/src/components/permissions/permission-provider";
import { SettingsHeader } from "./settings-kit";
import type { InvitationRow } from "./invitations/invitations-helpers";
import { InviteForm } from "./invitations/invite-form";
import { InvitationsList } from "./invitations/invitations-list";

export type { InvitationRow };

type Props = {
  organizationName: string;
  invitations: InvitationRow[];
};

export const InvitationsSection: FC<Props> = ({
  organizationName,
  invitations,
}) => {
  const canInvite = usePermission("members.invite");

  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        eyebrow="ORGANIZATION"
        title="Invitations"
        description="Invite people by email. Invites expire after 7 days."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[440px_minmax(0,1fr)]">
        {canInvite ? (
          <InviteForm organizationName={organizationName} />
        ) : null}

        <InvitationsList
          invitations={invitations}
          canInvite={canInvite}
        />
      </div>
    </div>
  );
};
