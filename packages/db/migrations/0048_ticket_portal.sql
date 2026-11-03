ALTER TABLE "ticket" ADD COLUMN "portalToken" text;
--> statement-breakpoint
UPDATE "ticket" SET "portalToken" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') WHERE "portalToken" IS NULL;
--> statement-breakpoint
ALTER TABLE "ticket" ALTER COLUMN "portalToken" SET DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
--> statement-breakpoint
ALTER TABLE "ticket" ALTER COLUMN "portalToken" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_portalToken_unique" UNIQUE ("portalToken");
