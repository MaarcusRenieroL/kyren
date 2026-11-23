---
description: Harden the next `todo` module in MODULES.md. Run repeatedly (or on a schedule) to work through the queue.
---
Open `MODULES.md`. Take the first row with status `todo` whose module already exists in code.
If none are left, say "All existing modules hardened. Next: /spec for the unbuilt ones." and list them.

Otherwise run the full `/harden <module>` flow for it.
Never start a second module in the same session.
