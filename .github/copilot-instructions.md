# Legal CRM - AI Coding Agent Instructions

## Project Overview
This is a legal case management system built with Next.js 15 (App Router), TypeScript, Prisma ORM, and PostgreSQL. It manages contacts, matters (cases), documents, workflows, and a client portal for law firms.

## Architecture Essentials

### Route Structure (Next.js App Router)
- `app/(dashboard)/*` - Internal staff views (lawyers, paralegals, admin)
- `app/(portal)/portal/*` - Client self-service portal (separate auth context)
- `app/portal/*` - Portal authentication pages (login, activate, password reset)
- `app/api/*` - REST API routes (use `withApiHandler` wrapper)

### API Route Pattern (CRITICAL)
All API routes MUST use the centralized error handler:
```typescript
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(async (req, { session, params }) => {
  // session: authenticated user (if requireAuth: true)
  // params: awaited route params (e.g., { id: string })
  // Return NextResponse.json() or throw errors (auto-handled)
}, { requireAuth: true, rateLimit: { limit: 100, windowMs: 60000 } });
```

**Why**: Provides automatic error handling, Prisma error mapping, rate limiting, auth checks, and request logging.

### Client Component Pattern
ALL interactive components MUST declare `"use client"` at the top. Server components fetch data and pass to client components:
```tsx
// app/(dashboard)/matters/[id]/page.tsx (Server Component)
export default async function MatterPage({ params }: { params: { id: string } }) {
  const matter = await fetchMatterData((await params).id);
  return <MatterDetailClient matter={matter} />; // Pass to client component
}
```

## Database & Prisma

### Always Use Transaction for Multi-Step Operations
```typescript
await prisma.$transaction(async (tx) => {
  const matter = await tx.matter.create({ data: { ... } });
  await tx.auditLog.create({ data: { ... } });
});
```

### Schema Knowledge
- **User.role**: ADMIN | LAWYER | PARALEGAL | CLIENT (NO DEFAULT - always explicit)
- **Contact.type**: LEAD | CLIENT | OPPOSING | WITNESS | EXPERT | OTHER
- **Matter** has many-to-many with **Contact** via **MatterParty** (role: PLAINTIFF, DEFENDANT, etc.)
- **MatterTeamMember** links Users to Matters with role-based access
- **WorkflowInstance** has ordered **WorkflowInstanceStep[]** with `actionType` determining handler

## Workflow System (Complex - Read Carefully)

### Handler Registry Pattern
The workflow engine uses a **pluggable handler registry** (`lib/workflows/registry.ts`):
- Each `ActionType` enum value has a corresponding `IActionHandler` implementation
- Handlers are registered at app startup in `lib/workflows/handlers/index.ts`
- New workflow actions require: 1) Add ActionType enum, 2) Create handler, 3) Register in index

### Current Action Types
```typescript
enum ActionType {
  APPROVAL_LAWYER       // Internal approval by lawyer
  SIGNATURE_CLIENT      // Client e-signature request
  REQUEST_DOC_CLIENT    // Document request from client
  PAYMENT_CLIENT        // Payment collection from client
  CHECKLIST             // Multi-item task checklist
  WRITE_TEXT            // Rich text input step
  POPULATE_QUESTIONNAIRE // Dynamic questionnaire generation
}
```

### Step States & Transitions
```typescript
enum ActionState {
  PENDING      // Not yet ready (blocked by prior steps)
  READY        // Can be started
  IN_PROGRESS  // Being worked on
  COMPLETED    // Successfully finished
  FAILED       // Error occurred
  SKIPPED      // Manually skipped (if not required)
}
```

**Critical**: Only steps with `actionState: READY` can be started. Update state via `/api/workflows/instances/[id]/steps/[stepId]/start` and `/complete` endpoints.

## Authorization & Security

### Role-Based Access Control (RBAC)
Use `lib/rbac.ts` for role checks in API routes:
```typescript
import { assertRole } from "@/lib/rbac";

// In API handler
assertRole({ userRole: session?.user?.role, allowedRoles: [Role.ADMIN, Role.LAWYER] });
// Throws if not allowed (auto-caught by withApiHandler)
```

### Route Protection (Middleware)
`middleware.ts` enforces dashboard access:
- CLIENTs are redirected to `/portal`
- `/dashboard/admin/*` requires ADMIN role
- Extend `routeRolePolicies` array for new protected routes

## Development Workflows

### Local Setup (From Clean State)
```bash
npm install
docker compose up -d              # Postgres, MinIO (S3), Redis, MailHog
npx prisma migrate dev --name init
npm run db:seed                   # Creates demo users & data
npm run dev
```

### Quick Database Reset
```bash
./scripts/dev-reset.sh            # Drops, recreates, migrates, seeds
```

### Testing Commands
```bash
npm run test          # Vitest unit tests (tests/unit/, tests/api/)
npm run e2e           # Playwright E2E tests (tests/e2e/)
npm run lint          # ESLint with TypeScript
npm run format        # Prettier
```

## Key Conventions

### UI Component Patterns

#### Workflow Timeline (NEW)
The workflow UI uses a horizontal scrollable timeline for better visualization:
- `WorkflowTimeline` - Horizontal scrollable workflow steps with visual indicators
- `WorkflowStepDetail` - Expanded detail view for selected step
- Click any step in timeline to view/edit details below
- Auto-scrolls to selected step and current step on load
- Role-based buttons (Add Workflow, Remove Workflow, Add Step - ADMIN/LAWYER only)

```tsx
<WorkflowTimeline
  workflows={workflows}
  selectedStepId={selectedStepId}
  currentUserRole={currentUserRole}
  onStepClick={(workflowId, stepId) => { /* handle selection */ }}
  onAddWorkflow={() => { /* open workflow dialog */ }}
  onRemoveWorkflow={(id) => { /* remove workflow */ }}
  onAddStep={(workflowId) => { /* add step to workflow */ }}
/>
```

### Validation with Zod
All API inputs validated via `lib/validation/*.ts` schemas:
```typescript
import { matterCreateSchema } from "@/lib/validation/matter";

const body = await req.json();
const validated = matterCreateSchema.parse(body); // Throws ZodError if invalid
```
**Note**: `withApiHandler` auto-catches ZodError and returns 400 with details.

### Environment Variables (Required)
```bash
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<random-string>
NEXTAUTH_URL=http://localhost:3000

# S3 Storage (MinIO for local)
S3_BUCKET=legal-crm-documents
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_ENDPOINT=http://localhost:9000
S3_FORCE_PATH_STYLE=true

# Email (MailHog for local - see http://localhost:8025)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@legalcrm.local
```

### File Upload Flow
1. Client requests signed URL: `POST /api/uploads` → returns `{ url, key }`
2. Client uploads directly to S3 using signed URL (no data through server)
3. Client creates document record: `POST /api/documents` with `{ storageKey: key, ... }`

**Why**: Offloads upload bandwidth from Next.js server to S3 directly.

## Documentation References

- **Full System Docs**: `docs/MASTER-SYSTEM-DOCUMENTATION.md` (1083 lines - architecture, API, schema)
- **Sprint Roadmap**: `docs/SPRINT-ROADMAP.md` (completed features, backlog)
- **Seed Data**: `docs/SEED-DATA.md` (default users, passwords for testing)
- **ADRs**: `docs/adr/*.md` (architectural decision records)
- **OpenAPI Spec**: `docs/openapi.yaml` or `/api/openapi` endpoint

## Common Pitfalls & Solutions

### ❌ Don't: Create API routes without `withApiHandler`
**Why**: Lose automatic error handling, rate limiting, auth, logging.

### ❌ Don't: Forget `"use client"` on interactive components
**Why**: Next.js will error on `useState`, `useEffect`, event handlers in server components.

### ❌ Don't: Use Prisma client in client components
**Why**: Prisma runs in Node.js only. Fetch data in server components/API routes, pass to client via props.

### ✅ Do: Use `await params` in API routes (Next.js 15+)
```typescript
export const GET = withApiHandler<{ id: string }>(async (req, { params }) => {
  const { id } = await params; // Required in Next.js 15
});
```

### ✅ Do: Soft delete instead of hard delete
Most models have `deletedAt` and `deletedBy` fields. Use:
```typescript
await prisma.document.update({
  where: { id },
  data: { deletedAt: new Date(), deletedBy: session.user.id }
});
```

### ✅ Do: Create audit logs for important actions
```typescript
import { createAuditLog } from "@/lib/audit";

await createAuditLog({
  action: "MATTER_CREATED",
  actorId: session.user.id,
  entityType: "Matter",
  entityId: matter.id,
  metadata: { title: matter.title }
});
```

## Current State (Sprint 0 Complete)
All core features implemented and documented. Focus areas for new work:
- UI/UX improvements (see `docs/SPRINT-ROADMAP.md`)
- Questionnaire conditional logic
- Advanced workflow features
- Performance optimization (see `lib/metrics.ts` for instrumentation)

## Questions to Ask Before Starting
1. **Is this an API route?** Use `withApiHandler`
2. **Does it need user interaction?** Add `"use client"`
3. **Creating new workflow action?** Implement `IActionHandler`, register in handlers/index.ts
4. **Modifying database?** Check if model has soft delete fields
5. **New route with role restrictions?** Update `middleware.ts` policies
