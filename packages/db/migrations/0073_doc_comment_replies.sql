ALTER TABLE "docComment" ADD COLUMN "parentId" uuid;
--> statement-breakpoint
ALTER TABLE "docComment" ADD CONSTRAINT "docComment_parentId_docComment_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."docComment"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "doc_comment_parent_idx" ON "docComment" USING btree ("parentId");
