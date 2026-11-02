ALTER TABLE "chatChannel" ADD COLUMN "discussion" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "chatChannel" c SET "discussion" = true FROM "project" p WHERE c."linkType" = 'project' AND c."linkId" = p.id AND c."visibility" = 'private' AND c."topic" = left(p."name", 250);--> statement-breakpoint
UPDATE "chatChannel" c SET "discussion" = true FROM "task" t WHERE c."linkType" = 'task' AND c."linkId" = t.id AND c."visibility" = 'private' AND c."topic" = left(t."name", 250);--> statement-breakpoint
UPDATE "chatChannel" c SET "discussion" = true FROM "doc" d WHERE c."linkType" = 'doc' AND c."linkId" = d.id AND c."visibility" = 'private' AND c."topic" = left(d."title", 250)
