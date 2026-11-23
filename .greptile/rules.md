# Zentro pull request review

Prioritize actionable findings about security, data integrity, and behavior regressions. Explain the affected code path and the change needed to fix it.

- Trace tenant-owned reads and writes through the API procedure or route, permission checks, and database query. Check that resource lookups, joins, and mutations are scoped to the active organization, including when a request supplies an ID or slug.
- Check that server-side authorization preserves organization, team, and project scope, including private projects, explicit deny overrides, and disabled modules. For changed authorization behavior, look for regression coverage of the denied case.
- Check public shares, ticket intake and portal routes, API keys, webhooks, and file downloads for correct access checks and handling of secrets and personal data. Flag sensitive fields exposed in responses, logs, exports, or AI inputs.
- Check writes that span multiple records for transaction boundaries and retry safety. Pay particular attention to audit records, background jobs, and payroll approval and payment state transitions.
- Check migrations for compatibility with existing data and previously deployed code. Flag missing constraints or backfills when they affect correctness.
