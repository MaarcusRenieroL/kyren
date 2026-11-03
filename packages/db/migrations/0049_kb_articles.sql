CREATE TABLE "kbArticle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"audience" text DEFAULT 'internal' NOT NULL,
	"updatedByMemberId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kbArticle" ADD CONSTRAINT "kbArticle_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "kbArticle" ADD CONSTRAINT "kbArticle_updatedByMemberId_member_id_fk" FOREIGN KEY ("updatedByMemberId") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "kbArticle_organization_slug_unique" ON "kbArticle" USING btree ("organizationId","slug");
--> statement-breakpoint
CREATE INDEX "kbArticle_organization_idx" ON "kbArticle" USING btree ("organizationId","status","audience");
