# Project Plugins Directory

This directory (`.agents/plugins/`) is reserved for project-local Antigravity plugins.

---

## Current Status & Guidelines

- **No Custom Plugin Currently Required**: The project's full functionality (Next.js server, Supabase PostgreSQL via Prisma, Backblaze B2 S3 SDK, and PowerShell bootstrapper) operates cleanly through standard Node.js and Windows tooling without requiring custom agent plugins.
- **No Automatic or Speculative Plugins**: Do not install or invent external plugins automatically. External plugins should only be introduced when there is a concrete, validated requirement.
- **No Fake Windows Driver Plugin**: Windows driver compilation and installation are handled directly via Microsoft Visual Studio 2022 + WDK and `pnputil.exe`. Do not create a synthetic driver plugin.
- **No Fake Supabase Plugin**: Database interaction and migrations are managed directly via Prisma ORM (`@prisma/client` and `prisma CLI`) connecting over standard PostgreSQL protocols.
- **Future Extensibility**: Source control or Git/GitHub integrations may be configured here as plugins in the future if explicitly required.
