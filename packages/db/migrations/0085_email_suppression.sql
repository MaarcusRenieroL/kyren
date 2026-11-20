CREATE TABLE "emailSuppression" (
	"email" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "emailSuppression_reason_check" CHECK ("reason" in ('bounced', 'complained'))
);
