"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useTrpcClient } from "@zentro/api/react";
import { authClient } from "@zentro/auth/client";
import { toastError } from "@zentro/ui/lib/toast";
import { slugify } from "@zentro/utils";
import {
  CreateOrganizationFormValues,
  createOrganizationSchema,
} from "~/src/features/auth/lib/zod-schema";
import { paths } from "~/src/lib/paths";
import { trpcResult } from "~/src/lib/trpc-result";
import { CreateOrgActions } from "./components/create-org-actions";
import { CreateOrgHeader } from "./components/create-org-stepper";
import { emailError, type Invite, type ModuleRow } from "./components/create-org-types";
import { StepModules } from "./components/step-modules";
import { StepTeammates } from "./components/step-teammates";
import { StepWorkspace } from "./components/step-workspace";

export default function CreateOrganizationPage() {
  const router = useRouter();
  const trpc = useTrpcClient();
  const [email, setEmail] = useState("");

  useEffect(() => {
    void authClient.getSession().then(({ data }) => {
      setEmail(data?.user.email ?? "");
    });
  }, []);

  const [step, setStep] = useState(1);
  const [created, setCreated] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [checkedSlug, setCheckedSlug] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const [invites, setInvites] = useState<Invite[]>([
    { id: 1, email: "", role: "member" },
    { id: 2, email: "", role: "member" },
  ]);
  const [nextId, setNextId] = useState(3);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [sending, setSending] = useState(false);

  const [modules, setModules] = useState<ModuleRow[] | null>(null);
  const [want, setWant] = useState<Record<string, boolean>>({});
  const [finishing, setFinishing] = useState(false);

  const {
    handleSubmit,
    control,
    setValue,
    formState: { isSubmitting },
  } = useForm<CreateOrganizationFormValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: "", slug: "" },
    mode: "onTouched",
  });

  const name = useWatch({ control, name: "name" }) ?? "";
  const slug = useWatch({ control, name: "slug" }) ?? "";
  const workspaceSlug = slugEdited ? slug : slugify(name);
  const visibleSlugAvailability =
    workspaceSlug && checkedSlug === workspaceSlug ? slugAvailable : null;

  useEffect(() => {
    if (!workspaceSlug || created) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setCheckingSlug(true);
      try {
        const { error } = await authClient.organization.checkSlug({
          slug: workspaceSlug,
        });
        if (cancelled) return;
        setCheckedSlug(workspaceSlug);
        setSlugAvailable(!error);
      } finally {
        if (!cancelled) setCheckingSlug(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [workspaceSlug, created]);

  useEffect(() => {
    if (step !== 3 || modules) return;

    void trpc.modules.list
      .query()
      .then((data) => {
        const rows = (data.modules as ModuleRow[]).filter((row) => !row.core);
        setModules(rows);
        setWant(Object.fromEntries(rows.map((row) => [row.id, row.enabled])));
      })
      .catch(() => {
        toastError("Error", "Could not load modules");
        setModules([]);
      });
  }, [step, modules, trpc]);

  const createWorkspace = async (values: CreateOrganizationFormValues) => {
    if (created) {
      setStep(2);
      return;
    }
    if (!visibleSlugAvailability) return;

    const { data: organization, error } = await authClient.organization.create({
      name: values.name,
      slug: slugify(values.slug),
    });

    if (error) {
      toastError(error, "Could not create organization");
      return;
    }

    const { error: setActiveError } = await authClient.organization.setActive({
      organizationId: organization.id,
    });

    if (setActiveError) {
      toastError(setActiveError, "Could not open the new organization");
      return;
    }

    setCreated(true);
    setStep(2);
  };

  const filled = invites.filter((row) => row.email.trim());
  const valid = filled.filter((row) => !emailError(row.email));

  const sendInvites = async () => {
    const withErrors = invites.map((row) => ({
      ...row,
      error: emailError(row.email),
    }));
    setInvites(withErrors);
    if (withErrors.some((row) => row.error)) return;

    const toSend = withErrors.filter((row) => row.email.trim());
    if (toSend.length === 0) {
      setStep(3);
      return;
    }

    setSending(true);
    const failed: Invite[] = [];

    for (const row of toSend) {
      const { error } = await trpcResult(
        trpc.invitation.invite.mutate({
          email: row.email.trim().toLowerCase(),
          role: row.role,
        }),
      );
      if (error) failed.push({ ...row, error: error.message });
    }

    setSending(false);
    if (failed.length > 0) {
      setInvites(failed);
      return;
    }
    setStep(3);
  };

  const toggleModule = (row: ModuleRow, on: boolean) =>
    setWant((current) => {
      const next = { ...current, [row.id]: on };
      if (row.id === "tasks" && on) next.projects = true;
      return next;
    });

  const finish = async () => {
    if (!modules) return;
    setFinishing(true);

    const changes = modules.filter((row) => want[row.id] !== row.enabled);
    const order = (row: ModuleRow) =>
      want[row.id] ? (row.id === "projects" ? 0 : 1) : (row.id === "tasks" ? 0 : 1);

    for (const row of changes.sort((a, b) => order(a) - order(b))) {
      const { error } = await trpcResult(
        trpc.modules.setEnabled.mutate({
          moduleId: row.id,
          enabled: want[row.id] ?? row.enabled,
        }),
      );
      if (error) {
        toastError(error.statusText, error.message);
        setFinishing(false);
        return;
      }
    }

    router.replace(paths.dashboard());
    router.refresh();
  };

  const eyebrow = `STEP ${step} OF 3`;
  const title = [
    "Name your workspace",
    "Invite your teammates",
    "Choose your modules",
  ][step - 1];
  const description = [
    "This is where your team keeps its projects, tasks and docs.",
    "They’ll get an email with a link to join. You can invite more people later.",
    "Start with what you need today. Everything is linked, so turning one on later fills in the gaps.",
  ][step - 1];

  return (
    <>
      <CreateOrgHeader step={step} email={email} />

      <main className="flex flex-1 justify-center px-5 py-10 sm:px-8 sm:py-16">
        <div className="flex w-full max-w-[640px] flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="font-display text-[1.75rem] leading-8 sm:text-[2rem] sm:leading-9">
              {title}
            </h1>
            <p className="max-w-[540px] text-[15px] leading-[22px] text-ink-2">
              {description}
            </p>
          </div>

          {step === 1 ? (
            <StepWorkspace
              control={control}
              setValue={setValue}
              created={created}
              slugEdited={slugEdited}
              setSlugEdited={setSlugEdited}
              workspaceSlug={workspaceSlug}
              visibleSlugAvailability={visibleSlugAvailability}
              onSubmit={handleSubmit(createWorkspace)}
            />
          ) : null}

          {step === 2 ? (
            <StepTeammates
              invites={invites}
              setInvites={setInvites}
              nextId={nextId}
              setNextId={setNextId}
              pasting={pasting}
              setPasting={setPasting}
              pasted={pasted}
              setPasted={setPasted}
            />
          ) : null}

          {step === 3 ? (
            <StepModules
              modules={modules}
              want={want}
              onToggle={toggleModule}
            />
          ) : null}

          <CreateOrgActions
            step={step}
            setStep={setStep}
            isSubmitting={isSubmitting}
            checkingSlug={checkingSlug}
            created={created}
            workspaceSlug={workspaceSlug}
            visibleSlugAvailability={visibleSlugAvailability}
            sending={sending}
            validInvitesCount={valid.length}
            onSendInvites={sendInvites}
            finishing={finishing}
            modulesLoaded={modules !== null}
            onFinish={finish}
          />
        </div>
      </main>
    </>
  );
}
