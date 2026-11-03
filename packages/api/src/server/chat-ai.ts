import { eq } from "@zentro/db/drizzle";
import type { db as Database } from "@zentro/db";
import { organizations } from "@zentro/db/schema";

import type { AuditContext } from "./audit";

/**
 * Summaries and translations. They call the Claude API only when
 * ANTHROPIC_API_KEY is set AND the organization has turned AI on, because
 * using it sends workplace text to a third party. Each use is audited by
 * feature name only, never by content.
 */
const MODEL = process.env.CHAT_AI_MODEL ?? "claude-sonnet-5-5";

export type AiContext = {
  db: typeof Database;
  activeOrganization: { id: string; name: string };
  audit: AuditContext;
};

export async function aiAvailable(db: typeof Database, organizationId: string) {
  if (!process.env.ANTHROPIC_API_KEY) return false;

  const [row] = await db
    .select({ enabled: organizations.aiEnabled })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return row?.enabled ?? false;
}

/**
 * Asks the model one question. Returns null, without sending anything, when
 * AI is not configured or the organization has it switched off.
 * `feature` is a short label such as "summarize a chat", shown in the audit log.
 */
export async function askClaude(
  ctx: AiContext,
  feature: string,
  system: string,
  prompt: string,
) {
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key || !(await aiAvailable(ctx.db, ctx.activeOrganization.id))) {
    ctx.audit.skipped("ai.used");

    return null;
  }

  await ctx.audit.record(ctx.db, {
    action: "ai.used",
    target: { id: ctx.activeOrganization.id, label: feature },
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    return (
      data.content
        ?.filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("")
        .trim() || null
    );
  } catch {
    // A slow or unreachable model must not break the feature; callers fall back.
    return null;
  }
}
