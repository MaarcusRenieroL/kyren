"use client";

import { useTrpcClient } from "@zentro/api/react";
import { useParams } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { SettingsShell } from "~/src/components/project-detail/settings/settings-shell";
import { ProjectDetail } from "~/src/lib/types";
import { ProjectSettingsLoading } from "~/src/components/project-detail/project-loading";
import { NotFoundContent } from "~/src/components/system/not-found-content";

export default function ProjectSettingsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [missing, setMissing] = useState(false);

  const trpc = useTrpcClient();
  const params = useParams<{ slug: string }>();

  const slug = params.slug;

  useEffect(() => {
    let isMounted = true;

    async function loadProject() {
      try {
        const data = await trpc.project.getProjectBySlug.query({
          slug,
        });

        if (isMounted) {
          setProject(data as ProjectDetail);
        }
      } catch {
        if (isMounted) setMissing(true);
      }
    }

    void loadProject();

    return () => {
      isMounted = false;
    };
  }, [slug, trpc]);

  if (missing) {
    return (
      <NotFoundContent
        inShell
        description="This project doesn’t exist, or you don’t have access to it."
      />
    );
  }

  if (!project) {
    return <ProjectSettingsLoading />;
  }

  return (
    <SettingsShell
      project={{
        name: project.name,
        slug: project.slug,
      }}
    >
      {children}
    </SettingsShell>
  );
}
