---
description: Interview me and write the spec for a new module. Usage: /spec <module>
argument-hint: <module-name>
---
This is my touchpoint. Interview me about the `$ARGUMENTS` module, max 8 questions, one batch.
Ask about: who uses it, the 3–5 core jobs, what it must NOT do, data it owns, how it links to tasks/docs/chat, permissions by role.

Then write `specs/$ARGUMENTS.md`:
- Purpose (2 lines)
- User journeys as acceptance criteria (Given / When / Then) — these become the E2E tests
- Data model (tables, key fields)
- Permissions matrix (owner / admin / member / guest)
- Out of scope
- `STATUS: DRAFT`

Show it to me. I change `DRAFT` to `APPROVED` myself.
