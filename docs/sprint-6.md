# Sprint 6 – Client Portal & Communication (v1)

## Goal & Outcomes
- Ship the first client-facing portal with separate navigation, authentication, and authorization paths from the internal dashboard.
- Allow invited clients to activate accounts, log in securely, and view only their assigned matters, documents, and upcoming events.
- Deliver bi-directional messaging and approval workflows so lawyers and clients can collaborate without leaving the platform.
- Ensure every portal interaction is auditable and respects strict document access boundaries via signed URLs and role checks.

## Architecture & Scope
- Introduce `/app/(portal)/…` layout with minimal shared components; reuse design tokens but isolate client navigation shell.
- Extend NextAuth to support `CLIENT` role, invitation activation, and portal-only session handling.
- Reuse existing Prisma models where possible; add client-centric views that always filter by `matter.assignedClientId`.
- Continue using the current API layer; add portal-prefixed endpoints enforcing ownership guards and shared pagination primitives.
- Plan for incremental realtime upgrades later; start with polling/ISR patterns that suit both messaging and approvals.

## Data Model Additions
- `users` table accepts `role:'ADMIN'|'LAWYER'|'PARALEGAL'|'CLIENT'`; new fields: `invitedById`, `invitationToken`, `invitedAt`, `activatedAt`.
- `messages`: `{ id, matterId, senderId, text, createdAt, attachments JSONB?, readAt?, replyToId? }` (attachments store metadata + storage path).
- `approvals`: `{ id, matterId, documentId?, requestedById, requestedAt, resolvedAt?, status:'PENDING'|'APPROVED'|'CHANGES_REQUESTED', clientComment? }`.
- `audit_logs` gain new `context` variants for `PORTAL_MESSAGE`, `PORTAL_APPROVAL`, `PORTAL_DOCUMENT_VIEW`.

## API Surface
- **Auth & Invitation**
  - `POST /api/clients/invite { email, name }` → issues JWT magic link, logs invitation, sends email job.
  - `POST /api/clients/activate { token, password }` → validates token (≤24h), sets password, flips role to `CLIENT`, stores `activatedAt`.
  - `POST /api/portal/login` (NextAuth credentials provider) + `POST /api/portal/password-reset` (request) + `POST /api/portal/password-reset/confirm`.
- **Portal (Client)**
  - `GET /api/portal/matters` → matters assigned to authenticated client; include summary stats (open tasks, pending approvals).
  - `GET /api/portal/documents?matterId=` → only documents flagged as shareable; returns signed download URL (5 min TTL).
  - `GET /api/portal/events?matterId=` → upcoming meetings limited to client’s matter.
  - `GET /api/portal/messages?matterId=&cursor=` → paginated threads with nested replies.
  - `POST /api/portal/messages` → create message; optional attachments (chunk to S3 first, return metadata).
  - `GET /api/portal/approvals?matterId=` → client-facing list with status, requestedBy, timestamps.
  - `POST /api/portal/approvals` → `{ approvalId, action:'APPROVE'|'REQUEST_CHANGES', comment? }`.
- **Lawyer/Internal**
  - `GET /api/clients?search=` → list invited/active clients, include matter counts and pending approvals.
  - `POST /api/approvals/request` → `{ matterId, documentId?, note }` initiates approval, triggers email/in-app notifications.
  - `GET /api/approvals?matterId=` → track lifecycle; include client response metadata and audit markers.

## UI Deliverables
- `/clients` internal list: status chips (Invited, Active, Inactive), invite modal, resend/revoke actions.
- Matter detail tabs extend to `Messages` and `Approvals`; show threaded messaging panel with chronological grouping and simple composer.
- Approval tab for lawyers shows outstanding requests with ability to close, resend, or attach new docs.
- `/portal/login` + password reset views styled with portal branding; display copy describing secure access.
- `/portal` dashboard cards: My Cases (status badges), Upcoming Meetings, Documents Awaiting Approval (`approvals.status === 'PENDING'`).
- `/portal/matters/[id]` detail with tabs `Overview | Documents | Messages | Approvals`, mirroring internal layout but scoped to client data.
- Document tab renders file previews/download via signed URLs and warns before link expiration.
- Messaging tab shows chat bubbles, reply-to context preview, and auto-scroll on new messages.
- Approvals tab lets clients approve or request changes with rich-text note; confirm dialogs before submission.

## Notifications & Workflows
- Invitation email template with activation link (JWT token) and expiry messaging; add resend path.
- Email notifications for:
  - Lawyer → client message/approval responses.
  - Client → new lawyer message, new approval request.
- In-app notification bell surfaces portal-related events for lawyers; clients receive simple unread badge counts within portal shell.
- Background worker/service queues notification jobs leveraging existing email infrastructure; ensure idempotency by tokenizing events.

## Security & Compliance
- All portal API routes call `getServerSession()` and verify `session.user.role === 'CLIENT'`; deny otherwise.
- Document download URLs generated via storage SDK `getSignedUrl(objectKey, { expiresIn: 300 })`; audit `documentId`, `clientId`, `timestamp`.
- Messaging/approvals endpoints guard by `matter.assignedClientId === session.user.id`; lawyers limited by their matter access policies.
- Invitation tokens stored hashed (SHA-256) with random salt; single-use enforced at activation.
- Provide `POST /api/clients/revoke` for admins to disable client access (`active=false`) and invalidate sessions.
- Audit log entries for message create, approval transitions, document downloads including actor IP (if available).
- Scheduler job purges expired invitations and cleans orphaned signed URLs.

## Acceptance Criteria
- Invitation → activation flow works end-to-end within 24h validity; expired tokens return actionable error.
- Activated clients can log in via `/portal/login`, view only their assigned matters/documents, and cannot access internal routes.
- Messaging threads display newest messages without page reload (polling ≤30s) and allow attachments up to defined size limit.
- Approval actions record status + timestamps for `requestedAt`, `resolvedAt`, and persist client comments.
- Document downloads require valid signed URL; reuse attempt after expiry forces regeneration through API.
- All portal actions produce audit entries that can be queried by matter and actor.

## Testing & QA
- **Unit:** invitation token encode/decode, role-based guards, approval state machine, signed URL helper.
- **API:** invite → activate → login happy path; 403 for unauthorized matter/doc access; messaging CRUD; approvals workflow (request → approve/change request).
- **E2E:** lawyer invites client → client activates → logs in → sees matter; client sends message → lawyer dashboard updates; lawyer requests approval → client responds → status reflects on both sides.
- **Performance:** message/approval lists paginated (cursor/limit) with P95 < 400 ms for 500 messages; document signed URL generation under 100 ms.
- **Security:** penetration checklist covering token leakage, brute-force lockouts, attachment validation, SSRF protections on uploaded files.

## Risks & Mitigations
- Invitation token misuse → single-use hashed tokens + short TTL + revoke path.
- Messaging race conditions → optimistic UI with server reconciliation, enforce chronological ordering by `createdAt`.
- Attachment storage abuse → file size/type filtering, antivirus scan hook before exposing download URL.
- Client confusion between portals → clear navigation separation, redirect clients away from `/app/(dashboard)` routes.
- Increased email volume → batch notifications and dedupe repeated events within 5-minute window.

## Backlog Breakdown
1. `PORTAL-001` Extend NextAuth for client invitations, activation, and credentials provider.
2. `PORTAL-002` Portal app layout, navigation shell, and route guards.
3. `PORTAL-003` Portal API endpoints for matters/documents/messages/events.
4. `PORTAL-004` Client dashboard UI + matter detail pages (documents/messages/approvals tabs).
5. `COMM-001` Messaging data model, API handlers, threaded UI (internal + portal views).
6. `APPROVAL-001` Approval model, request/response endpoints, lawyer + client UI.
7. `PORTAL-005` Signed document access service with audit logging.
8. `EMAIL-001` Invitation and notification email templates + delivery hooks.
9. `TEST-004` Integration/e2e coverage for lawyer ↔ client flows.
10. `SEC-001` Audit logging, revocation path, and security hardening tasks.
