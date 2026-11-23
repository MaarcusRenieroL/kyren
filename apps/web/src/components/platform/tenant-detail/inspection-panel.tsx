import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@zentro/ui/shadcn/table";
import { cell, formatDate, headCell, tableClass } from "../common";
import { Panel } from "./panel";

export type InspectionData = {
  organization: { name: string };
  people: Array<{ name: string; email: string; role: string; joinedAt: Date }>;
  pendingInvitations: number;
  projects: Array<{ name: string }>;
  modules: Array<{ moduleId: string; enabled: boolean }>;
  recent: Array<{
    createdAt: Date;
    action: string;
    targetLabel?: string | null;
    targetType: string;
  }>;
};

export function InspectionPanel({
  inspection,
}: {
  inspection: InspectionData;
}) {
  return (
    <Panel title={`Read-only view of ${inspection.organization.name}`}>
      <p className="text-sm text-ink-2">
        {inspection.people.length} people · {inspection.pendingInvitations}{" "}
        pending invitations · {inspection.projects.length} projects
      </p>
      <Table className={tableClass}>
        <TableHeader>
          <TableRow>
            <TableHead className={headCell}>Person</TableHead>
            <TableHead className={headCell}>Role</TableHead>
            <TableHead className={headCell}>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inspection.people.map((person) => (
            <TableRow key={person.email}>
              <TableCell className={cell}>
                {person.name}
                <div className="text-xs text-ink-2">{person.email}</div>
              </TableCell>
              <TableCell className={cell}>{person.role}</TableCell>
              <TableCell className={cell}>
                {formatDate(person.joinedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-sm text-ink-2">
        Projects: {inspection.projects.map((p) => p.name).join(", ") || "none"}
      </p>
      <p className="text-sm text-ink-2">
        Modules off:{" "}
        {inspection.modules
          .filter((m) => !m.enabled)
          .map((m) => m.moduleId)
          .join(", ") || "none"}
      </p>
      <ul className="text-sm">
        {inspection.recent.map((event, index) => (
          <li key={index} className="text-ink-2">
            {formatDate(event.createdAt)} · {event.action} ·{" "}
            {event.targetLabel ?? event.targetType}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
