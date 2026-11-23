import { Button } from "@kyren/ui/shadcn/button";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { apiPath } from "~/src/lib/paths";
import styles from "./product-information.module.css";

function Information({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.page}>
      <h1>{title}</h1>
      <p className={styles.intro}>{intro}</p>
      <div className={styles.rows}>{children}</div>
    </section>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.row}>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

export function RoadmapPage() {
  return (
    <Information
      title="Product roadmap"
      intro="Recently shipped capabilities and planned improvements. Planned work has no committed release date."
    >
      <Row title="Shipped · Whiteboards and Calendar">
        Whiteboards include an overview map and shared editing. Calendar
        supports changes to one event or to that event and later events in a
        series.
      </Row>
      <Row title="Shipped · Support operations">
        Saved replies can fill in ticket, customer and agent details. Help
        articles can be moved to trash and restored.
      </Row>
      <Row title="Planned · Project planning">
        Dated milestones and project status updates.
      </Row>
      <Row title="Planned · Files">
        Version history and expiring share links for individual files.
      </Row>
      <Row title="Planned · Help desk">
        Customer satisfaction ratings after a support ticket is resolved.
      </Row>
      <Row title="Planned · Collaboration">
        Live document co-editing and presence.
      </Row>
    </Information>
  );
}

export function ChangelogPage() {
  return (
    <Information
      title="Changelog"
      intro="Highlights from Kyren’s version history. Availability depends on the version your organization runs."
    >
      <Row title="Upload scanning">
        Self-hosted deployments can scan uploaded files with ClamAV.
      </Row>
      <Row title="Whiteboards">
        The rebuilt editor adds shapes, connectors, frames, comments, presence
        and an overview map.
      </Row>
      <Row title="Calendar">
        Change a single event or apply changes to that event and later events in
        the same series.
      </Row>
      <Row title="Self-hosted operations">
        Deployment tooling adds encrypted off-machine backups, restore and
        rollback, and webhook alerts for service health.
      </Row>
      <Row title="Payroll setup">
        Payroll starts disabled for new organizations. A workspace owner can
        enable it when the team is ready.
      </Row>
      <Row title="Internal messages">
        The internal mailbox is labeled Messages to distinguish conversations
        inside the workspace from external email.
      </Row>
    </Information>
  );
}

export function AboutPage() {
  return (
    <Information
      title="About Kyren"
      intro="Kyren brings project work, team conversations and business operations into one organization workspace."
    >
      <Row title="From request to delivery">
        Connect a support ticket to a task, keep its specification in Docs and
        discuss the work in the project channel.
      </Row>
      <Row title="Built for organizations">
        People can belong to more than one organization. Each organization
        controls its own members, roles and enabled modules.
      </Row>
      <Row title="Workspace support">
        For invitations, permissions or deployment support, contact your
        workspace administrator.
      </Row>
    </Information>
  );
}

export function SecurityPage() {
  return (
    <Information
      title="Workspace security"
      intro="Each organization manages access to its workspace."
    >
      <Row title="Sign-in controls">
        Administrators can require two-factor authentication and restrict access
        by IP address.
      </Row>
      <Row title="Upload scanning">
        Self-hosted operators can configure ClamAV to scan uploaded files.
      </Row>
      <Row title="Roles and permissions">
        Kyren includes Owner, Admin and Member roles. Organizations can define
        custom roles and inspect a person’s effective permissions.
      </Row>
      <Row title="Audit log">
        Review recorded changes, filter activity and export audit entries to
        CSV.
      </Row>
    </Information>
  );
}

export function StatusPage() {
  const [state, setState] = useState<"checking" | "ok" | "unavailable">(
    "checking",
  );
  const [checked, setChecked] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function check() {
      try {
        const response = await fetch(apiPath("/api/health"), {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(10000),
          ]),
        });
        const data = await response.json();
        if (!controller.signal.aborted)
          setState(response.ok && data.status === "ok" ? "ok" : "unavailable");
      } catch {
        if (!controller.signal.aborted) setState("unavailable");
      } finally {
        if (!controller.signal.aborted)
          setChecked(new Date().toLocaleTimeString());
      }
    }
    void check();
    return () => controller.abort();
  }, [attempt]);
  return (
    <Information
      title="Service status"
      intro="This check asks the running application to connect to its database."
    >
      <Row title="Application and database">
        <p role="status">
          {state === "checking"
            ? "Checking…"
            : state === "ok"
              ? "Operational"
              : "Unable to verify service health"}
          {checked && state !== "checking" ? ` · Checked at ${checked}` : ""}
        </p>
        <Button
          disabled={state === "checking"}
          onClick={() => {
            setState("checking");
            setAttempt((n) => n + 1);
          }}
        >
          Check again
        </Button>
      </Row>
    </Information>
  );
}
