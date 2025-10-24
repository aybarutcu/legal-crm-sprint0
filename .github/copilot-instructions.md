# Legal CRM – Copilot Instructions

## System Orientation
- Next.js 15 App Router; server loaders in `app/(dashboard)/*` fetch Prisma data and pass it into client components (e.g. `app/(dashboard)/matters/[id]/page.tsx` → `components/matters/MatterDetailClient.tsx`).
- Always `await params` in pages and route handlers because Next 15 provides them as promises (`app/(dashboard)/workflows/instances/[id]/edit/page.tsx` is the reference).
- Use the singleton Prisma client from `lib/prisma.ts`; most tables include soft delete columns (`deletedAt`/`deletedBy`), so guard queries accordingly.
- Path alias `@/*` (see `tsconfig.json`) resolves to the repo root.

## API & Auth
- Wrap every API handler with `withApiHandler` (`lib/api-handler.ts`) for auth, rate limiting, logging, and Prisma error translation (`app/api/workflows/instances/[id]/route.ts` shows the pattern).
- Authorization helpers live in `lib/authorization.ts` and workflow-specific checks in `lib/workflows/permissions.ts`; run `assertMatterAccess` before exposing matter data.
- Bundle multi-step writes inside `prisma.$transaction` blocks and reuse helpers like `ensureActorCanPerform` / `advanceInstanceReadySteps` from `lib/workflows/service.ts`.
- NextAuth session data (`session.user.id`, `session.user.role`) powers RBAC; fetch it with `getAuthSession` (`lib/auth.ts`) on the server.

## Workflow Engine
- Import `@/lib/workflows` before calling runtime helpers so `lib/workflows/handlers/index.ts` registers default action handlers.
- `lib/workflows/runtime.ts` manages `ActionState` transitions, preserves `actionData.config` + `actionData.history`, and exposes `ctx.updateContext` to mutate `WorkflowInstance.contextData`; enforce transitions with `assertTransition`.
- Template, step, and context schemas live in `lib/workflows/schema.ts`, `lib/validation/workflow.ts`, and `lib/workflows/context-schema.ts`; keep enums aligned with `prisma/schema.prisma` when adding new action types or role scopes.
- Branching/dependencies rely on `conditionType`, `conditionConfig`, and `dependsOn`; reuse helpers in `lib/workflows/conditions` and `dependency-resolver.ts` rather than reimplementing graph logic.
- Email notifications are gated by `ENABLE_WORKFLOW_NOTIFICATIONS` and built via `lib/workflows/notifications.ts`; honor the flag and `SMTP_FROM` when sending mail.

## Frontend Patterns
- Server components serialize Date instances to ISO strings before passing data to clients (`WorkflowInstanceCanvasEditor` expects this shape); keep props JSON-safe.
- Workflow UI lives under `components/workflows/*`; canvas editors maintain both step state and editable JSON config strings, so update both when adding fields.
- Detail panes in `components/matters/workflows/WorkflowStepDetail.tsx` read `actionData.config`/`history` for execution widgets—preserve those keys when patching steps.
- Client data fetching favors SWR for refresh-heavy views; for mutations, call API routes and revalidate caches instead of mutating local state only.

## Storage & Integrations
- File flows use `lib/storage.ts` for S3/MinIO; without S3 env vars it falls back to `S3_FAKE_*` URLs. Pair upload URLs from `/api/uploads` with document records.
- Mail transporters sit in `lib/mail/*`; set `SMTP_FROM` or the fallback `Legal CRM <noreply@legalcrm.local>` will appear.
- Calendar defaults such as `CALENDAR_DEFAULT_REMINDER_MINUTES` are consumed in seeds (`prisma/seed.ts`); operational runbooks live in `docs/runbooks/calendar.md`.

## Dev Workflow
- Bootstrap: `npm install`, `docker compose up -d`, `npx prisma migrate dev --name init`, `npx prisma db seed`, then `npm run dev`; use `scripts/dev-reset.sh` for a clean slate.
- Tests: `npm run lint`, `npm run test` (Vitest specs in `tests/unit`/`tests/api`), `npm run e2e` (Playwright in `tests/e2e`); CI expects artifacts in `artifacts/`.
- Regenerate OpenAPI by editing `docs/openapi.yaml` and running `node scripts/gen-openapi.js` to refresh `public/openapi.json`.
- Feature scripts in `scripts/` (`test-lead-workflow.ts`, `test-context-ui.ts`, etc.) are the quickest way to reproduce workflow flows—execute them with `tsx`.

## Reference
- Core domain documentation: `docs/MASTER-SYSTEM-DOCUMENTATION.md` and ADRs in `docs/adr/`.
- Update runbooks under `docs/runbooks/*.md` when altering workflows, calendar jobs, or reminder logic.
- Mirror new environment variables into `.env.example` and confirm automation expectations in `.github/workflows/ci.yml`.
