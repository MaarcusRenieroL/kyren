import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { db } from "../../client/index";
import { files } from "../../schema";
import type { SeedContext } from "./context";

export async function seedFiles({ orgId, members }: SeedContext) {
  const defaultRoot = fileURLToPath(
    new URL("../../../../../apps/web/.uploads/", import.meta.url),
  );
  const root = path.resolve(process.env.FILE_STORAGE_DIR ?? defaultRoot);
  await mkdir(path.join(root, orgId), { recursive: true });

  const examples = [
    {
      name: "Brand guidelines.md",
      mime: "text/markdown",
      body: "# Brand guidelines\n\nUse the primary indigo swatch on a neutral background.\n",
    },
    {
      name: "Release checklist.txt",
      mime: "text/plain",
      body: "Review changes\nRun regression tests\nVerify backups\n",
    },
    {
      name: "Primary indigo.png",
      mime: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGNITvtIU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAMgi6FsP9QbPAAAAAElFTkSuQmCC",
        "base64",
      ),
      width: 32,
      height: 32,
    },
    {
      name: "Planning worksheet.csv",
      mime: "text/csv",
      body: "Quarter,Owner,Deliverable\nQ1,Design,Brand review\nQ2,Engineering,Release review\n",
    },
    {
      name: "Design tokens.json",
      mime: "application/json",
      body: JSON.stringify({ primary: "#6366f1", surface: "#18181b" }, null, 2),
    },
    {
      name: "Onboarding.md",
      mime: "text/markdown",
      body: "# Joining the example workspace\n\nOpen your team page, review its projects, and introduce yourself in chat.\n",
    },
  ];
  const rows = await Promise.all(
    examples.map(async (example) => {
      const id = randomUUID();
      const storageKey = `${orgId}/${id}${path.extname(example.name)}`;
      const bytes = Buffer.from(example.body);
      await writeFile(path.join(root, storageKey), bytes);
      return {
        id,
        organizationId: orgId,
        uploadedByMemberId: members.priya.memberId,
        name: example.name,
        mimeType: example.mime,
        size: bytes.length,
        width: example.width ?? null,
        height: example.height ?? null,
        storageKey,
      };
    }),
  );
  await db.transaction(async (tx) => {
    await tx.delete(files).where(eq(files.organizationId, orgId));
    await tx.insert(files).values(rows);
  });
}
