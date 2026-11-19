CREATE TABLE "kbArticleRevision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"articleId" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" text NOT NULL,
	"audience" text NOT NULL,
	"editedByMemberId" uuid,
	"editedAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kbArticleRevision" ADD CONSTRAINT "kbArticleRevision_articleId_kbArticle_id_fk" FOREIGN KEY ("articleId") REFERENCES "public"."kbArticle"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "kbArticleRevision" ADD CONSTRAINT "kbArticleRevision_editedByMemberId_member_id_fk" FOREIGN KEY ("editedByMemberId") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "kbArticleRevision_article_idx" ON "kbArticleRevision" USING btree ("articleId","createdAt");
