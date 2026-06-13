# DSK - Degeuleule Sa Khalatte

Production-grade, API-driven platform for idea validation, anonymous feedback,
collaboration matching, private project groups (max 10 members), and
startup/enterprise opportunity connection. Bilingual (EN/FR), Wolof-ready.

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Web**: Next.js (App Router, TypeScript), Tailwind CSS, TanStack Query, React Hook Form, Zod
- **Auth**: Auth.js (NextAuth) - credentials + OAuth-ready, JWT sessions
- **DB**: PostgreSQL + Prisma (`packages/db`)
- **Jobs**: Redis + BullMQ (`apps/worker`)
- **i18n**: `packages/i18n` (EN/FR dictionaries, English fallback)

## Workspace layout

```
apps/
  web/      Next.js app (public, app shell, hidden admin, API v1 routes)
  worker/   BullMQ workers (notifications, emails, social-publish, ...)
packages/
  db/       Prisma schema, client, seed
  shared/   Zod schemas, constants (MAX_GROUP_MEMBERS=10), API envelope
  i18n/     Locale dictionaries + translator
  config/   Shared tsconfigs
```

## Getting started

```bash
corepack enable               # ensures pnpm
pnpm install
cp .env.example .env          # fill in secrets
docker compose up -d          # postgres + redis
pnpm db:migrate               # create schema
pnpm db:seed                  # super admin + feature flags
pnpm dev                      # web on :3000 + worker
```

## Core invariants

- **Groups max 10 members**: enforced in service-layer transactions; `MAX_GROUP_MEMBERS` in `@dsk/shared`.
- **Anonymous comments**: public API exposes only a per-idea pseudonym (`displayCode`); the underlying `userId` stays server-side for moderation accountability.
- **Hidden admin**: mounted at an unguessable path, never linked in navigation, returns **404** (not 403) to non-admins. All sensitive actions audit-logged.
- **API-driven**: every page fetches from `/api/v1/*`; no hardcoded frontend data.
- **Integrations**: Meta (Facebook Pages, Instagram professional, WhatsApp Business) and TikTok are separate provider families with encrypted token storage.
