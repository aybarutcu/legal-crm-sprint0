# Legal CRM - Master System Documentation

> **Document Version**: 1.0  
> **Last Updated**: October 16, 2025  
> **Status**: ✅ Current - Reflects actual implementation

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Core Features](#core-features)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Authentication & Authorization](#authentication--authorization)
8. [Workflow System](#workflow-system)
9. [Document Management](#document-management)
10. [User Roles & Permissions](#user-roles--permissions)
11. [Client Portal](#client-portal)
12. [Known Issues & Fixes](#known-issues--fixes)
13. [Development Guide](#development-guide)
14. [Deployment](#deployment)

---

## Project Overview

Legal CRM is a comprehensive case management system designed for law firms to manage:
- Client relationships and contacts
- Legal matters (cases)
- Documents and file storage
- Workflows and approvals
- Team collaboration
- Client portal for self-service

### Key Characteristics
- **Multi-tenant**: Supports multiple law firms (future)
- **Role-based**: Admin, Lawyer, Paralegal, Client roles
- **Workflow-driven**: Automated processes for approvals, signatures, document requests
- **Client-facing**: Secure portal for clients to access their cases

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15.0.0 (App Router)
- **UI Library**: React 18.3.1
- **Styling**: Tailwind CSS with custom design system
- **Icons**: Lucide React
- **Forms**: Native React state management
- **Data Fetching**: SWR for client-side data fetching

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Database**: PostgreSQL
- **ORM**: Prisma 5.18.0
- **Authentication**: NextAuth.js 4.24.7
- **Email**: Nodemailer
- **Storage**: AWS S3 (for documents)

### Development Tools
- **Language**: TypeScript
- **Testing**: Vitest (unit), Playwright (e2e)
- **Linting**: ESLint with TypeScript plugin
- **Git Hooks**: Husky
- **Validation**: Zod

### Infrastructure
- **Database**: PostgreSQL 14+
- **File Storage**: AWS S3 (configurable)
- **Environment**: Docker-ready (docker-compose.yml included)

---

## Architecture

### Application Structure

```
legal-crm-sprint0/
├── app/                          # Next.js App Router
│   ├── (dashboard)/             # Internal dashboard routes
│   │   ├── contacts/
│   │   ├── matters/
│   │   ├── documents/
│   │   ├── tasks/
│   │   ├── events/
│   │   ├── workflows/
│   │   └── admin/
│   ├── (marketing)/             # Public marketing pages
│   │   └── login/
│   ├── (portal)/                # Client portal routes
│   │   └── portal/
│   ├── portal/                  # Portal auth pages
│   │   ├── activate/
│   │   ├── login/
│   │   └── password-reset/
│   └── api/                     # API endpoints
│       ├── admin/
│       ├── clients/
│       ├── contacts/
│       ├── matters/
│       ├── workflows/
│       └── ...
├── components/                   # React components
│   ├── admin/
│   ├── contact/
│   ├── dashboard/
│   ├── documents/
│   ├── matters/
│   ├── navigation/
│   ├── portal/
│   ├── tasks/
│   └── workflows/
├── lib/                         # Business logic & utilities
│   ├── workflows/               # Workflow engine
│   │   ├── handlers/            # Action handlers
│   │   └── instances.ts
│   ├── security/                # Security utilities
│   ├── validation/              # Zod schemas
│   ├── mail/                    # Email templates
│   └── ...
├── prisma/                      # Database
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
└── docs/                        # Documentation
```

### Design Patterns

1. **API Handler Pattern**: Centralized error handling via `withApiHandler`
2. **Handler Registry**: Pluggable workflow action handlers
3. **Repository Pattern**: Database access through Prisma Client
4. **Component Composition**: Reusable UI components with clear boundaries

---

## Core Features

### ✅ 1. User Management
- Multi-role system (Admin, Lawyer, Paralegal, Client)
- User invitation flow with email verification
- Password reset functionality
- Active/inactive status management
- Profile management

### ✅ 2. Contact Management
- Create and manage contacts (leads, clients, opposing counsel)
- Contact types: LEAD, CLIENT, OPPOSING, WITNESS, EXPERT, OTHER
- Contact status tracking
- Link contacts to users (for client portal access)
- Contact notes and history
- Convert contacts to clients

### ✅ 3. Matter Management
- Create and track legal matters (cases)
- Matter status: ACTIVE, CLOSED, PENDING, ARCHIVED
- Matter types: configurable based on firm practice areas
- Assign matter owner (lawyer responsible)
- Link clients to matters
- Matter team members with role-based access
- Matter-specific documents, tasks, events, workflows

### ✅ 4. Document Management
- Upload documents (S3 storage)
- Version control (track document versions)
- Document metadata and tagging
- Link documents to matters or contacts
- Document signing workflow
- Soft delete with retention
- Document preview (if supported by browser)
- Secure download with presigned URLs

### ✅ 5. Task Management
- Create tasks with assignments
- Task priorities (LOW, MEDIUM, HIGH, URGENT)
- Due date tracking
- Task status (TODO, IN_PROGRESS, REVIEW, DONE, CANCELLED)
- Task checklists (subtasks)
- Link tasks to matters, contacts, documents

### ✅ 6. Workflow System
**Core Workflow Engine**
- Workflow templates (reusable process definitions)
- Workflow instances (actual running processes)
- Step-by-step execution
- Role-based step assignment
- Workflow context (dynamic data passing between steps)
- Conditional logic support
- AI-powered workflow generation

**Workflow Action Types**
1. **APPROVAL**: Internal approval by lawyer
2. **SIGNATURE**: Client e-signature request
3. **REQUEST_DOC**: Document request from client
4. **PAYMENT**: Payment request from client
5. **CHECKLIST**: Multi-item checklist tasks
6. **WRITE_TEXT**: Text writing/input with rich text support (NEW)

**Workflow Features**
- Template library for common processes
- Import/export workflow templates
- Instance duplication
- Manual step addition/removal
- Step reordering
- Workflow status tracking (DRAFT, ACTIVE, PAUSED, COMPLETED, CANCELLED)
- Execution history and audit logs

### ✅ 7. Calendar & Events
- Create events with date/time
- Link events to matters
- Event types (HEARING, MEETING, DEADLINE, CALL, OTHER)
- Event reminders (TODO: email notifications)
- Calendar view per user
- Matter-specific event timeline

### ✅ 8. Approval System
- Document approval workflows
- Client approval requests
- Approval status tracking
- Approval history

### ✅ 9. Messaging System
- Internal messaging between team members
- Client-lawyer messaging via portal
- Message threads by matter
- Message status (SENT, READ)

### ✅ 10. Notes System
- Add notes to matters, contacts, documents
- Note history
- Author tracking

### ✅ 11. Audit Logging
- Track all important actions
- Actor identification
- Entity type and ID tracking
- Metadata storage
- Timestamp tracking

---

## Database Schema

### Core Models

#### User
```prisma
model User {
  id                     String     @id @default(cuid())
  name                   String?
  email                  String     @unique
  role                   Role       // NO DEFAULT - must be explicit
  status                 UserStatus @default(ACTIVE)
  passwordHash           String?
  invitationToken        String?
  invitedAt              DateTime?
  activatedAt            DateTime?
  isActive               Boolean    @default(true)
  // Relations to all other entities
}

enum Role {
  ADMIN
  LAWYER
  PARALEGAL
  CLIENT
}
```

#### Contact
```prisma
model Contact {
  id          String        @id @default(cuid())
  firstName   String
  lastName    String
  email       String?
  phone       String?
  type        ContactType   @default(LEAD)
  status      ContactStatus @default(ACTIVE)
  userId      String?       // Link to User for portal access
  ownerId     String?       // Lawyer responsible
  // Relations
}

enum ContactType {
  LEAD
  CLIENT
  OPPOSING
  WITNESS
  EXPERT
  OTHER
}
```

#### Matter
```prisma
model Matter {
  id               String       @id @default(cuid())
  title            String
  description      String?
  status           MatterStatus @default(ACTIVE)
  type             String?
  startDate        DateTime     @default(now())
  closeDate        DateTime?
  ownerId          String       // Primary lawyer
  // Relations to contacts, documents, workflows, etc.
}

enum MatterStatus {
  ACTIVE
  CLOSED
  PENDING
  ARCHIVED
}
```

#### MatterTeamMember
```prisma
model MatterTeamMember {
  id          String   @id @default(cuid())
  matterId    String
  userId      String
  roleInMatter String  // e.g., "Lead Attorney", "Paralegal", "Associate"
  accessLevel  String  // "FULL", "READ", "LIMITED"
  addedAt     DateTime @default(now())
}
```

#### WorkflowTemplate
```prisma
model WorkflowTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  category    String?
  isPublic    Boolean  @default(false)
  createdById String
  steps       WorkflowTemplateStep[]
}
```

#### WorkflowInstance
```prisma
model WorkflowInstance {
  id          String                 @id @default(cuid())
  templateId  String?
  matterId    String
  status      WorkflowInstanceStatus @default(DRAFT)
  context     Json                   @default("{}")  // Dynamic data
  createdById String
  steps       WorkflowInstanceStep[]
}

enum WorkflowInstanceStatus {
  DRAFT
  ACTIVE
  PAUSED
  COMPLETED
  CANCELLED
}
```

#### WorkflowInstanceStep
```prisma
model WorkflowInstanceStep {
  id             String      @id @default(cuid())
  instanceId     String
  templateStepId String?
  order          Int
  title          String
  actionType     ActionType
  roleScope      RoleScope
  actionState    ActionState @default(PENDING)
  actionConfig   Json        @default("{}")
  actionData     Json?
  assignedToId   String?
  dueDate        DateTime?
  priority       TaskPriority?
}

enum ActionType {
  APPROVAL
  SIGNATURE
  REQUEST_DOC
  PAYMENT
  CHECKLIST
  WRITE_TEXT
}

enum ActionState {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
  SKIPPED
}

enum RoleScope {
  ADMIN
  LAWYER
  PARALEGAL
  CLIENT
}
```

#### Document
```prisma
model Document {
  id               String    @id @default(cuid())
  matterId         String?
  contactId        String?
  uploaderId       String
  filename         String
  mime             String
  size             Int
  version          Int       @default(1)
  storageKey       String    // S3 key
  hash             String?   // File hash for deduplication
  signedAt         DateTime?
  parentDocumentId String?   // For versions
  deletedAt        DateTime?
  deletedBy        String?
}
```

### Key Relationships

- **User → Contact**: One-to-one (for client portal access)
- **User → Matter**: One-to-many (matter ownership)
- **User → MatterTeamMember**: Many-to-many (team membership)
- **Matter → Contact**: Many-to-many (matter clients)
- **Matter → Document**: One-to-many
- **Matter → WorkflowInstance**: One-to-many
- **WorkflowTemplate → WorkflowInstance**: One-to-many
- **WorkflowInstance → WorkflowInstanceStep**: One-to-many

---

## API Endpoints

### Authentication
- `POST /api/auth/signin` - Login (NextAuth)
- `POST /api/auth/signout` - Logout
- `POST /api/clients/activate` - Activate client portal account
- `POST /api/portal/password-reset` - Reset password

### Admin
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `GET /api/admin/users/[id]` - Get user
- `PUT /api/admin/users/[id]` - Update user
- `DELETE /api/admin/users/[id]` - Delete user
- `POST /api/admin/users/[id]/resend-invite` - Resend invitation

### Clients
- `POST /api/clients/invite` - Invite client (creates user + contact)
- `POST /api/clients/activate` - Activate client account

### Contacts
- `GET /api/contacts` - List contacts (with filters)
- `POST /api/contacts` - Create contact
- `GET /api/contacts/[id]` - Get contact
- `PUT /api/contacts/[id]` - Update contact
- `DELETE /api/contacts/[id]` - Delete contact
- `POST /api/contacts/[id]/convert-to-client` - Convert to client

### Matters
- `GET /api/matters` - List matters
- `POST /api/matters` - Create matter
- `GET /api/matters/[id]` - Get matter with all relations
- `PUT /api/matters/[id]` - Update matter
- `DELETE /api/matters/[id]` - Delete matter
- `POST /api/matters/[id]/clients` - Link client to matter
- `DELETE /api/matters/[id]/clients/[contactId]` - Unlink client
- `GET /api/matters/[id]/team` - Get team members
- `POST /api/matters/[id]/team` - Add team member
- `PUT /api/matters/[id]/team/[memberId]` - Update team member
- `DELETE /api/matters/[id]/team/[memberId]` - Remove team member

### Documents
- `GET /api/matters/[id]/documents` - List matter documents
- `POST /api/matters/[id]/documents` - Upload document
- `GET /api/documents/[id]` - Get document metadata
- `GET /api/documents/[id]/download` - Download document
- `DELETE /api/documents/[id]` - Delete document

### Workflows
- `GET /api/workflows/templates` - List templates
- `POST /api/workflows/templates` - Create template
- `GET /api/workflows/templates/[id]` - Get template
- `PUT /api/workflows/templates/[id]` - Update template
- `DELETE /api/workflows/templates/[id]` - Delete template
- `POST /api/workflows/templates/[id]/instantiate` - Create instance from template
- `GET /api/workflows/instances` - List instances
- `POST /api/workflows/instances` - Create instance
- `GET /api/workflows/instances/[id]` - Get instance
- `PUT /api/workflows/instances/[id]` - Update instance
- `POST /api/workflows/instances/[id]/steps` - Add step
- `PUT /api/workflows/instances/[id]/steps/[stepId]` - Update step
- `POST /api/workflows/instances/[id]/steps/[stepId]/start` - Start step
- `POST /api/workflows/instances/[id]/steps/[stepId]/complete` - Complete step
- `POST /api/workflows/instances/[id]/steps/[stepId]/fail` - Fail step
- `POST /api/agent/workflow/parse` - AI workflow generation

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks/[id]` - Get task
- `PUT /api/tasks/[id]` - Update task
- `DELETE /api/tasks/[id]` - Delete task

### Events
- `GET /api/events` - List events
- `POST /api/events` - Create event
- `GET /api/events/[id]` - Get event
- `PUT /api/events/[id]` - Update event
- `DELETE /api/events/[id]` - Delete event

---

## Authentication & Authorization

### Authentication Methods
1. **Credentials (Email/Password)**: For all user types
2. **Google OAuth**: Optional (configured via env vars)
3. **Azure AD**: Optional (configured via env vars)

### Session Management
- JWT-based sessions via NextAuth
- Session stored in database
- Automatic session refresh
- Secure httpOnly cookies

### Authorization Patterns

#### API Authorization
```typescript
export const GET = withApiHandler(async (req, { session }) => {
  const user = session!.user!; // Guaranteed by withApiHandler
  
  // Role-based check
  if (![Role.ADMIN, Role.LAWYER].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  
  // Resource-based check
  await assertMatterAccess(user, matterId);
});
```

#### Resource Access Rules

**Matter Access**:
- **Admins**: Full access to all matters
- **Lawyers**: Access to owned matters + team member matters
- **Paralegals**: Access to team member matters
- **Clients**: Access only to matters where they are linked as client

**Document Access**:
- Same as matter access (documents inherit matter permissions)

**Workflow Access**:
- Users can execute steps assigned to their role scope
- Admins can modify any workflow
- Lawyers can create/edit workflows for their matters

---

## Workflow System

### Architecture

The workflow system consists of:
1. **Templates**: Reusable workflow definitions
2. **Instances**: Actual running workflows linked to matters
3. **Steps**: Individual actions within a workflow
4. **Handlers**: Action-specific logic for each step type
5. **Context**: Dynamic data passed between steps

### Workflow Lifecycle

```
DRAFT → ACTIVE → [PAUSED] → COMPLETED/CANCELLED
```

1. **DRAFT**: Workflow created but not started
2. **ACTIVE**: Workflow is running, steps can be executed
3. **PAUSED**: Temporarily stopped (manual intervention)
4. **COMPLETED**: All required steps completed
5. **CANCELLED**: Workflow stopped before completion

### Step Lifecycle

```
PENDING → IN_PROGRESS → COMPLETED/FAILED/SKIPPED
```

### Action Handlers

Each action type has a handler implementing:

```typescript
interface IActionHandler<TConfig, TData> {
  type: ActionType;
  validateConfig(config: unknown): void;
  canStart(context: ActionHandlerContext<TConfig>): boolean;
  start(context: ActionHandlerContext<TConfig>): Promise<ActionState>;
  complete(context: ActionHandlerContext<TConfig>, payload: unknown): Promise<ActionState>;
  fail(context: ActionHandlerContext<TConfig>, reason: string): Promise<ActionState>;
  getNextStateOnEvent(currentState: ActionState, event: ActionEvent): ActionState | null;
}
```

#### Available Handlers

1. **APPROVAL**
   - Config: `{ approverRole?, reason? }`
   - Internal approval by lawyers
   - Can approve or reject with comments

2. **SIGNATURE**
   - Config: `{ documentId, signatureType?, instructions? }`
   - Client e-signature request
   - Links to document

3. **REQUEST_DOC**
   - Config: `{ documentName, description?, required?, acceptedTypes? }`
   - Request document upload from client
   - Validates file types

4. **PAYMENT**
   - Config: `{ amount, currency?, description?, dueDate? }`
   - Payment request from client
   - Amount tracking

5. **CHECKLIST**
   - Config: `{ items: [{ label, required?, description? }] }`
   - Multi-item checklist
   - Track completion of individual items

6. **WRITE_TEXT** (NEW)
   - Config: `{ title, description?, placeholder?, minLength?, maxLength?, required? }`
   - Text input/writing task
   - Length validation
   - Future: AI assistance for writing

### Workflow Context

Dynamic data storage for passing information between steps:

```json
{
  "clientName": "John Doe",
  "documentUrl": "https://...",
  "approvalDecision": "approved",
  "submittedText": "...",
  "contactType": "CORPORATE",
  "documentCount": 5,
  "isPreApproved": true
}
```

Context can be used in:
- Step titles (templating)
- Conditional logic (branching)
- Data validation
- Next step determination

### Conditional Workflow Logic (P0.1)

**New Feature**: Steps can now execute conditionally based on runtime context, enabling dynamic branching workflows.

#### Condition Types

1. **ALWAYS** (Default)
   - Step always executes in sequential order
   - No conditional logic
   - Standard behavior for existing workflows

2. **IF_TRUE**
   - Step executes only if condition evaluates to TRUE
   - Skipped if condition evaluates to FALSE
   - Requires `conditionConfig`

3. **IF_FALSE**
   - Step executes only if condition evaluates to FALSE
   - Skipped if condition evaluates to TRUE
   - Requires `conditionConfig`

4. **SWITCH** (Future)
   - Case-based routing
   - Not yet implemented

#### Operators (14 Total)

**Comparison** (6):
- `==` - Equals
- `!=` - Not equals
- `>` - Greater than
- `<` - Less than
- `>=` - Greater than or equal
- `<=` - Less than or equal

**String** (3):
- `contains` - Substring match
- `startsWith` - Prefix match
- `endsWith` - Suffix match

**Array** (2):
- `in` - Value in array
- `notIn` - Value not in array

**Existence** (3):
- `exists` - Field is not null/undefined
- `isEmpty` - Field is null/undefined/empty string
- `isNotEmpty` - Field has a value

#### Simple Condition Example

```json
{
  "conditionType": "IF_TRUE",
  "conditionConfig": {
    "field": "contactType",
    "operator": "==",
    "value": "CORPORATE"
  }
}
```

**Behavior**: Step only executes when `contactType` equals `"CORPORATE"`.

#### Compound Condition Example (AND/OR)

```json
{
  "conditionType": "IF_TRUE",
  "conditionConfig": {
    "operator": "AND",
    "conditions": [
      { "field": "approvalDecision", "operator": "==", "value": "APPROVED" },
      { "field": "documentCount", "operator": ">=", "value": 3 }
    ]
  }
}
```

**Behavior**: Step only executes when BOTH conditions are true (approved AND 3+ documents).

#### Branching with nextStepOnTrue/False

Steps can override sequential flow by specifying target steps:

```json
{
  "order": 2,
  "title": "Check Pre-Approval",
  "conditionType": "IF_TRUE",
  "conditionConfig": {
    "field": "isPreApproved",
    "operator": "==",
    "value": true
  },
  "nextStepOnTrue": 5,    // Jump to step 5 if pre-approved
  "nextStepOnFalse": null  // Continue to step 3 if not
}
```

**Workflow Flow**:
- If `isPreApproved == true`: Skip steps 3-4, jump to step 5
- If `isPreApproved == false`: Continue to step 3 (sequential)

#### Real-World Example: Client Onboarding

```typescript
const template = {
  name: "Client Onboarding",
  steps: [
    {
      order: 1,
      title: "Collect Basic Info",
      actionType: "WRITE_TEXT",
      conditionType: "ALWAYS",
      actionConfig: { title: "Basic Information" }
    },
    {
      order: 2,
      title: "Request Corporate Documents",
      actionType: "REQUEST_DOC",
      conditionType: "IF_TRUE",
      conditionConfig: {
        field: "contactType",
        operator: "==",
        value: "CORPORATE"
      },
      actionConfig: {
        requestText: "Please upload Articles of Incorporation and Operating Agreement"
      }
    },
    {
      order: 3,
      title: "Individual ID Verification",
      actionType: "REQUEST_DOC",
      conditionType: "IF_FALSE",
      conditionConfig: {
        field: "contactType",
        operator: "==",
        value: "CORPORATE"
      },
      actionConfig: {
        requestText: "Please upload driver's license or passport"
      }
    },
    {
      order: 4,
      title: "Manual Review",
      actionType: "APPROVAL",
      conditionType: "IF_FALSE",
      conditionConfig: {
        field: "isPreApproved",
        operator: "==",
        value: true
      },
      nextStepOnTrue: 6  // Skip payment setup if pre-approved
    },
    {
      order: 5,
      title: "Payment Collection",
      actionType: "PAYMENT",
      conditionType: "IF_TRUE",
      conditionConfig: {
        operator: "AND",
        conditions: [
          { field: "approvalDecision", operator: "==", value: "APPROVED" },
          { field: "documentCount", operator: ">=", value: 2 }
        ]
      },
      actionConfig: { amount: 1000, currency: "USD" }
    },
    {
      order: 6,
      title: "Final Setup",
      actionType: "TASK",
      conditionType: "ALWAYS",
      actionConfig: { description: "Complete onboarding tasks" }
    }
  ]
};
```

**Execution Paths**:

**Path 1 - Corporate Pre-Approved Client**:
1. Collect Info (ALWAYS) → 
2. Request Corporate Docs (TRUE: contactType==CORPORATE) →
3. ~~Individual ID~~ (SKIPPED: contactType!=CORPORATE) →
4. ~~Manual Review~~ (SKIPPED: isPreApproved==true, jumps to 6) →
5. ~~Payment~~ (SKIPPED: documentCount condition fails) →
6. Final Setup (ALWAYS)

**Path 2 - Individual Non-Approved Client**:
1. Collect Info (ALWAYS) →
2. ~~Corporate Docs~~ (SKIPPED: contactType!=CORPORATE) →
3. Individual ID (TRUE: contactType!=CORPORATE) →
4. Manual Review (TRUE: isPreApproved==false) →
5. Payment (TRUE: approved AND documentCount≥2) →
6. Final Setup (ALWAYS)

#### Validation API

`POST /api/workflows/validate-condition`

Validates condition structure and optionally evaluates against test context:

```typescript
// Request
{
  "condition": {
    "field": "contactType",
    "operator": "==",
    "value": "CORPORATE"
  },
  "testContext": {  // Optional
    "contactType": "CORPORATE"
  }
}

// Response
{
  "valid": true,
  "message": "Condition is valid",
  "evaluation": {
    "result": true  // Only if testContext provided
  }
}
```

**Use Cases**:
- Real-time validation in UI
- Testing conditions before saving templates
- Debugging conditional workflows

#### UI Components

**ConditionBuilder**: Main editor for creating conditions
- Field autocomplete with 10 common workflow fields
- Operator selector grouped by category
- Smart value input (auto-type conversion)
- Switch between Simple and AND/OR modes
- Branching path configuration

**ConditionDisplay**: Visual representation in template cards
- Color-coded badges (✓ green for IF_TRUE, ✗ red for IF_FALSE)
- Human-readable condition summary
- Nested display for compound conditions

**Integration**: Fully integrated into workflow template editor at `/dashboard/workflows/templates`.

#### Common Workflow Context Fields

Available for use in conditions:

| Field | Type | Description |
|-------|------|-------------|
| `contactType` | string | Type of contact (LEAD, CLIENT, CORPORATE, etc.) |
| `matterType` | string | Type of matter/case |
| `contactEmail` | string | Email address of contact |
| `matterStatus` | string | Current matter status |
| `approvalDecision` | string | Result of approval step (APPROVED/REJECTED) |
| `paymentStatus` | string | Payment status (PENDING/COMPLETED/FAILED) |
| `documentCount` | number | Number of documents collected |
| `isUrgent` | boolean | Whether matter is marked urgent |
| `isPreApproved` | boolean | Whether contact is pre-approved |
| `tags` | array | Tags associated with contact/matter |

**Extensible**: Additional fields can be added to workflow context via handlers using `ctx.updateContext()`.

#### Best Practices

1. **Default to ALWAYS**: Only add conditions when truly needed for branching
2. **Keep Conditions Simple**: Prefer simple conditions over deeply nested compound logic
3. **Document Context Fields**: Comment which fields are set by which steps
4. **Test Branching Paths**: Use validation API to test conditions with sample data
5. **Avoid Required Conditional Steps**: Required steps should generally be ALWAYS
6. **Use Descriptive Step Titles**: Include condition summary in title (e.g., "Request Corporate Docs (if corporate client)")

#### Limitations

- **Max Nesting**: Compound conditions limited to 3 levels (prevents stack overflow)
- **SWITCH Not Implemented**: Use multiple IF_TRUE/IF_FALSE steps instead
- **No Dynamic Context Schema**: Available fields documented but not validated at design time
- **No Visual Flowchart**: Branching shown as text, no diagram (roadmap: P1)

### AI Workflow Generation

POST `/api/agent/workflow/parse`
- Natural language workflow description
- AI generates workflow template with steps
- Supports all action types
- Returns structured JSON

---

## Document Management

### Storage Architecture

- **Backend**: AWS S3 / MinIO
- **Access**: Presigned URLs for secure downloads
- **Uploads**: Direct to S3 via presigned PUT
- **Versioning**: Based on displayName + folder location

### Document Versioning System

#### Version Identifiers
Documents are versioned based on:
1. **displayName**: Primary identifier (required, user-defined)
2. **folderId**: Folder location (optional, but recommended)
3. **matterId**: Auto-populated if uploaded to matter folder (optional)
4. **contactId**: Auto-populated if uploaded to contact folder (optional)

**Key Rule**: Two documents with the same `displayName` in the same folder (or root if no folder) are considered versions of each other.

#### Version Chain Structure
- **Version 1** (original): `id: "abc123"`, `parentDocumentId: null`, `version: 1`, `displayName: "Contract"`
- **Version 2**: `id: "def456"`, `parentDocumentId: "abc123"`, `version: 2`, `displayName: "Contract"`
- **Version 3**: `id: "ghi789"`, `parentDocumentId: "abc123"`, `version: 3`, `displayName: "Contract"`

All versions link to the first version via `parentDocumentId`.

#### Version Metadata Inheritance
When creating a new version, the following fields are inherited from the previous version:
- `displayName` (must match for versioning)
- `tags` (copied from previous version)
- `folderId` (must match for versioning)
- `matterId` (must match for versioning)
- `contactId` (must match for versioning)
- `accessScope` (inherited)
- `accessMetadata` (inherited)

**Note**: `filename` (actual file name) can be different between versions and is NOT used as a version identifier.

#### Upload Conflict Detection
When uploading a document:
1. System checks for existing documents with same `displayName` in same folder
2. If match found, user is prompted: "A document with this name already exists. Create new version?"
3. User can choose:
   - **New Version**: Links to existing document via `parentDocumentId`
   - **New Document**: Creates independent document with different `displayName`

### File Operations

#### Upload Flow
1. User selects file and sets `displayName`, `tags`, `accessScope`
2. System checks for name conflicts in target folder
3. If conflict: Prompt for version vs new document
4. Client requests presigned upload URL from `/api/uploads`
5. Server generates presigned PUT URL with storage key
6. Client uploads directly to S3 using PUT
7. Client calls `/api/documents` to create document record
8. Server validates upload and creates record with appropriate version number

#### Download Flow
1. Client requests document via `/api/documents/{id}/download`
2. Server checks permissions
3. Server generates presigned GET URL (15 min expiry)
4. Client downloads from S3

#### Delete Flow
1. Soft delete (set deletedAt timestamp)
2. Retain metadata for audit
3. S3 object remains (for legal compliance)
4. Hard delete via manual cleanup script

### Document Types
- **Matter Documents**: Linked to cases via `matterId`
- **Contact Documents**: Linked to contacts via `contactId`
- **Workflow Documents**: Linked to workflow steps via `workflowStepId`
- **Client Uploaded**: Via portal or workflow actions

### Master Folders
Master folders are auto-created for matters and contacts:
- `/Matters/{Matter Title}` - Created when document uploaded with `matterId`
- `/Contacts/{Contact Name}` - Created when document uploaded with `contactId`
- These folders auto-sync when matter/contact names change

---

## User Roles & Permissions

### Role Definitions

#### ADMIN
- Full system access
- User management
- Global settings
- All matter access
- Workflow template management

#### LAWYER
- Create and manage matters
- Assign tasks
- Create workflows
- Approve documents
- Manage team members
- Access assigned matters

#### PARALEGAL
- Execute assigned tasks
- Upload documents
- Update matter information
- Limited workflow execution
- Access team matters

#### CLIENT
- Portal access only
- View assigned matters
- Upload requested documents
- Sign documents
- View messages
- Execute client workflow steps

### Permission Matrix

| Action | Admin | Lawyer | Paralegal | Client |
|--------|-------|--------|-----------|--------|
| Create Matter | ✅ | ✅ | ❌ | ❌ |
| Edit Any Matter | ✅ | ❌ | ❌ | ❌ |
| Edit Own Matter | ✅ | ✅ | ❌ | ❌ |
| View Team Matter | ✅ | ✅ | ✅ | ❌ |
| View Client Matter | ✅ | ✅ | ✅ | ✅ |
| Upload Document | ✅ | ✅ | ✅ | ✅* |
| Delete Document | ✅ | ✅ | ❌ | ❌ |
| Create Workflow | ✅ | ✅ | ❌ | ❌ |
| Execute Lawyer Step | ✅ | ✅ | ❌ | ❌ |
| Execute Client Step | ❌ | ❌ | ❌ | ✅ |
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| Invite Clients | ✅ | ✅ | ❌ | ❌ |

*Client can only upload documents when requested via workflow

---

## Client Portal

### Features

1. **Account Activation**
   - Email invitation from lawyer
   - Set password on first login
   - Update profile information

2. **Matter Dashboard**
   - View assigned matters
   - Matter status and timeline
   - Upcoming deadlines

3. **Document Access**
   - View all case documents
   - Download documents
   - Upload requested documents

4. **Workflow Participation**
   - Execute assigned workflow steps
   - Sign documents electronically
   - Upload requested files
   - Make payments
   - Complete forms

5. **Messaging**
   - Send messages to legal team
   - View message history
   - Receive notifications

6. **Events & Calendar**
   - View upcoming events (hearings, meetings)
   - Add to personal calendar

### Portal Routes

- `/portal` - Client dashboard
- `/portal/login` - Client login
- `/portal/activate` - Account activation
- `/portal/password-reset` - Password reset
- `/portal/matters/[id]` - Matter details

---

## Known Issues & Fixes

### ✅ Fixed Issues

#### 1. Client Invitation Auth Bug (Oct 16, 2025)
**Problem**: When clients logged in after activation, a duplicate LAWYER user was created.

**Root Cause**: 
- Auth credentials provider auto-created users with `role: LAWYER`
- Schema had `@default(LAWYER)` on role field

**Fix**:
1. Removed auto-user creation from `/lib/auth.ts`
2. Removed `@default(LAWYER)` from User.role in schema
3. Users must now be explicitly created before login

**Prevention**: All user creation goes through controlled endpoints

#### 2. WRITE_TEXT Validation Errors (Oct 16, 2025)
**Problem**: 422 errors when saving templates/instances with WRITE_TEXT steps

**Root Cause**: 
- `actionTypeSchema` in `/lib/validation/workflow.ts` missing WRITE_TEXT
- `/api/workflows/instances/[id]/steps/route.ts` had inline enum without WRITE_TEXT

**Fix**:
1. Added WRITE_TEXT to actionTypeSchema enum
2. Fixed inline enum in steps API
3. Updated AI agent prompt with WRITE_TEXT guidance

---

## Development Guide

### Setup

```bash
# Clone repository
git clone <repo-url>
cd legal-crm-sprint0

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your database and AWS credentials

# Setup database
npx prisma db push
npx prisma generate

# Seed database (optional)
npm run db:seed

# Start development server
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/legalcrm"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate-random-secret>"

# AWS S3
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="<your-key>"
AWS_SECRET_ACCESS_KEY="<your-secret>"
S3_BUCKET_NAME="legal-crm-documents"

# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="noreply@legalcrm.com"

# Optional: OAuth
GOOGLE_CLIENT_ID="<your-google-client-id>"
GOOGLE_CLIENT_SECRET="<your-google-client-secret>"
AZURE_AD_CLIENT_ID="<your-azure-ad-client-id>"
AZURE_AD_CLIENT_SECRET="<your-azure-ad-client-secret>"
AZURE_AD_TENANT_ID="<your-azure-ad-tenant-id>"

# App URLs
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_PORTAL_URL="http://localhost:3000"

# Client Invite
CLIENT_INVITE_TTL_HOURS="24"
```

### Development Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build           # Build for production
npm start               # Start production server

# Database
npx prisma db push      # Push schema changes
npx prisma generate     # Regenerate Prisma client
npx prisma studio       # Open Prisma Studio (DB GUI)
npx prisma db seed      # Seed database

# Testing
npm test                # Run unit tests
npm run e2e             # Run E2E tests
npm run test:ci         # Run tests with JUnit output
npm run e2e:ci          # Run E2E with JUnit output

# Code Quality
npm run lint            # Run ESLint
npm run format          # Format code with Prettier

# Scripts
npx tsx scripts/delete-user.ts <email> [--confirm]  # Delete user
```

### Adding a New Feature

1. **Database**: Update `prisma/schema.prisma`, run `npx prisma db push`
2. **API**: Create route in `app/api/...`
3. **Validation**: Add Zod schema in `lib/validation/...`
4. **UI**: Create components in `components/...`
5. **Page**: Create page in `app/(dashboard)/...`
6. **Test**: Add tests in `tests/...`
7. **Document**: Update this master doc

### Code Style

- Use TypeScript strict mode
- Follow Airbnb style guide (via ESLint)
- Use functional components with hooks
- Prefer server components where possible
- Use Zod for all API input validation
- Use Prisma transactions for multi-step operations

---

## Deployment

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- AWS S3 bucket
- SMTP server
- Domain name

### Production Checklist

- [ ] Set strong NEXTAUTH_SECRET
- [ ] Configure production database
- [ ] Setup S3 bucket with proper CORS
- [ ] Configure email SMTP
- [ ] Setup domain and SSL certificate
- [ ] Configure OAuth providers (optional)
- [ ] Run database migrations
- [ ] Setup monitoring and logging
- [ ] Configure backup strategy
- [ ] Test email delivery
- [ ] Test document upload/download

### Deployment Options

#### Option 1: Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Configure environment variables in Vercel dashboard
```

#### Option 2: Docker
```bash
# Build image
docker build -t legal-crm .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e NEXTAUTH_SECRET="..." \
  legal-crm
```

#### Option 3: Traditional Server
```bash
# Build
npm run build

# Start with PM2
pm2 start npm --name "legal-crm" -- start
pm2 save
pm2 startup
```

### Database Backups

```bash
# Automated backup script
pg_dump -h localhost -U postgres legalcrm > backup-$(date +%Y%m%d).sql

# Restore
psql -h localhost -U postgres legalcrm < backup-20251016.sql
```

---

## Document Maintenance

### How to Keep This Doc Updated

1. **After Major Feature**: Update relevant section
2. **After Bug Fix**: Add to Known Issues section
3. **Schema Changes**: Update Database Schema section
4. **New API Endpoint**: Update API Endpoints section
5. **Version Bump**: Update document version and date at top

### Deprecated Docs

The following docs are superseded by this master doc:
- `IMPLEMENTATION-SUMMARY.md` (partially outdated)
- `SIMPLE-GUIDE.md` (outdated)
- Various sprint docs (historical reference only)

### Living Sections

These sections require frequent updates:
- Known Issues & Fixes
- API Endpoints (as new endpoints added)
- Workflow Action Types (as new types added)
- Database Schema (as models change)

---

## Support & Contributing

### Getting Help
1. Check this documentation
2. Search existing issues
3. Ask in team chat
4. Create GitHub issue

### Contributing
1. Create feature branch from `main`
2. Make changes with tests
3. Update this documentation
4. Submit PR with clear description
5. Wait for code review

---

**Document Status**: ✅ Current  
**Next Review**: After major feature releases  
**Maintainer**: Development Team
