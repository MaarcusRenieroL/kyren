CREATE TABLE "docVersion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL,
	"docId" uuid NOT NULL,
	"authorMemberId" uuid,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "docVersion" ADD CONSTRAINT "docVersion_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "docVersion" ADD CONSTRAINT "docVersion_docId_doc_id_fk" FOREIGN KEY ("docId") REFERENCES "public"."doc"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "docVersion" ADD CONSTRAINT "docVersion_authorMemberId_member_id_fk" FOREIGN KEY ("authorMemberId") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "doc_version_doc_updated_idx" ON "docVersion" USING btree ("docId","updatedAt");
--> statement-breakpoint
-- Versions recorded so far live as snapshots on doc.updated activity events.
-- Those were written at the start of each burst of edits (later saves in the
-- burst were not recorded), so old versions hold first-of-burst text.
INSERT INTO "docVersion" ("organizationId", "docId", "authorMemberId", "content", "createdAt", "updatedAt")
SELECT e."organizationId", d."id", m."id", e."metadata"->>'snapshot', e."createdAt", e."createdAt"
FROM "activityEvent" e
JOIN "doc" d ON d."id"::text = e."targetId" AND d."organizationId" = e."organizationId"
LEFT JOIN "member" m ON m."userId" = e."actorUserId" AND m."organizationId" = e."organizationId"
WHERE e."action" = 'doc.updated' AND e."targetType" = 'doc' AND e."metadata" ? 'snapshot';
--> statement-breakpoint
-- The text on screen today is a version too, when no snapshot holds it yet.
-- Its author is whoever edited the doc last, or its creator when nobody has.
INSERT INTO "docVersion" ("organizationId", "docId", "authorMemberId", "content", "createdAt", "updatedAt")
SELECT d."organizationId", d."id",
	COALESCE((
		SELECT m."id" FROM "activityEvent" e
		JOIN "member" m ON m."userId" = e."actorUserId" AND m."organizationId" = e."organizationId"
		WHERE e."organizationId" = d."organizationId" AND e."targetType" = 'doc'
			AND e."targetId" = d."id"::text AND e."action" = 'doc.updated'
		ORDER BY e."createdAt" DESC
		LIMIT 1
	), d."createdByMemberId"),
	d."content", d."updatedAt", d."updatedAt"
FROM "doc" d
WHERE d."content" IS DISTINCT FROM (
	SELECT v."content" FROM "docVersion" v
	WHERE v."docId" = d."id"
	ORDER BY v."updatedAt" DESC
	LIMIT 1
);
