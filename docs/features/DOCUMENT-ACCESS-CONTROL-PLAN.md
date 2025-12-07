# Document Access Control Implementation Plan

## Overview
Implement granular access control for documents, allowing restriction to specific roles or individual matter team members.

## Current State Analysis

### Existing Schema
```prisma
model Document {
  id               String     @id @default(cuid())
  matterId         String?
  contactId        String?
  workflowStepId   String?
  uploaderId       String
  // ... other fields
  // ❌ NO access control fields
}

model MatterTeamMember {
  id        String   @id @default(cuid())
  matterId  String
  userId    String
  role      Role
  addedAt   DateTime @default(now())
  addedBy   String?
  // ✅ Has addedBy for audit trail
}
```

### Audit Logging Status
- ✅ MatterTeamMember has `addedBy` field tracking who added the member
- ❌ No audit log entry in AuditLog table when team member is added
- Need to add audit logging to matter team operations

---

## Phase 1: Database Schema Changes

### 1.1 Add Access Control to Documents

Create new models for flexible access control:

```prisma
// New enum for access scope
enum DocumentAccessScope {
  PUBLIC        // Anyone in the matter can access
  ROLE_BASED    // Restricted to specific roles
  USER_BASED    // Restricted to specific users
  PRIVATE       // Only uploader and admins
}

// Updated Document model
model Document {
  id               String               @id @default(cuid())
  matterId         String?
  contactId        String?
  workflowStepId   String?
  uploaderId       String
  filename         String
  mime             String
  size             Int
  version          Int                  @default(1)
  tags             String[]
  storageKey       String
  hash             String?
  signedAt         DateTime?
  metadata         Json?
  parentDocumentId String?
  
  // NEW: Access Control Fields
  accessScope      DocumentAccessScope  @default(PUBLIC)
  accessMetadata   Json?                // Stores role/user restrictions
  
  createdAt        DateTime             @default(now())
  deletedAt        DateTime?
  deletedBy        String?

  // Existing relations
  matter           Matter?              @relation(fields: [matterId], references: [id])
  contact          Contact?             @relation("DocumentContact", fields: [contactId], references: [id])
  workflowStep     WorkflowInstanceStep? @relation("DocumentWorkflowStep", fields: [workflowStepId], references: [id], onDelete: SetNull)
  uploader         User                 @relation("DocumentUploader", fields: [uploaderId], references: [id])
  parentDocument   Document?            @relation("DocumentVersions", fields: [parentDocumentId], references: [id])
  versions         Document[]           @relation("DocumentVersions")
  taskLinks        TaskLink[]
  approvals        Approval[]
  
  // NEW: Access control relations
  accessGrants     DocumentAccess[]

  @@index([matterId, filename])
  @@index([contactId])
  @@index([workflowStepId])
  @@index([matterId, hash])
  @@index([parentDocumentId])
  @@index([createdAt])
  @@index([accessScope]) // NEW: Index for filtering by access scope
}

// NEW: Explicit access grants (for USER_BASED scope)
model DocumentAccess {
  id         String   @id @default(cuid())
  documentId String
  userId     String
  grantedBy  String
  grantedAt  DateTime @default(now())
  
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  user       User     @relation("DocumentAccessGrants", fields: [userId], references: [id], onDelete: Cascade)
  grantor    User     @relation("DocumentAccessGrantor", fields: [grantedBy], references: [id])
  
  @@unique([documentId, userId])
  @@index([documentId])
  @@index([userId])
}

// Update User model to include new relations
model User {
  // ... existing fields
  
  // NEW relations
  documentAccessGrants DocumentAccess[] @relation("DocumentAccessGrants")
  grantedDocumentAccess DocumentAccess[] @relation("DocumentAccessGrantor")
}
```

### 1.2 AccessMetadata JSON Structure

```typescript
// For ROLE_BASED scope
{
  allowedRoles: ["ADMIN", "LAWYER", "PARALEGAL"] // Array of Role enum values
}

// For USER_BASED scope
// Uses DocumentAccess table instead of JSON
```

---

## Phase 2: Access Control Logic

### 2.1 Permission Checking Helper

Create `lib/documents/access-control.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type DocumentAccessCheckResult = {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageAccess: boolean;
  reason?: string; // For debugging/audit
};

/**
 * Check if a user can access a document
 */
export async function checkDocumentAccess(
  documentId: string,
  userId: string,
  userRole: Role
): Promise<DocumentAccessCheckResult> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      matter: {
        include: {
          owner: true,
          team: {
            where: { userId },
          },
        },
      },
      uploader: true,
      accessGrants: {
        where: { userId },
      },
    },
  });

  if (!document) {
    return {
      canView: false,
      canEdit: false,
      canDelete: false,
      canManageAccess: false,
      reason: "Document not found",
    };
  }

  // Deleted documents - only admin can access
  if (document.deletedAt) {
    const canAccess = userRole === "ADMIN";
    return {
      canView: canAccess,
      canEdit: false,
      canDelete: canAccess,
      canManageAccess: false,
      reason: canAccess ? "Admin accessing deleted document" : "Document is deleted",
    };
  }

  // Document uploader always has full access
  const isUploader = document.uploaderId === userId;
  
  // Admin always has full access
  const isAdmin = userRole === "ADMIN";
  
  // Matter owner has full access
  const isMatterOwner = document.matter?.ownerId === userId;
  
  // Check if user is in matter team
  const isTeamMember = document.matter?.team && document.matter.team.length > 0;

  // ADMIN and UPLOADER always have full access
  if (isAdmin || isUploader || isMatterOwner) {
    return {
      canView: true,
      canEdit: true,
      canDelete: true,
      canManageAccess: true,
      reason: isAdmin ? "Admin" : isUploader ? "Uploader" : "Matter owner",
    };
  }

  // Check access scope
  switch (document.accessScope) {
    case "PRIVATE":
      return {
        canView: false,
        canEdit: false,
        canDelete: false,
        canManageAccess: false,
        reason: "Document is private",
      };

    case "PUBLIC":
      // Anyone in the matter team can view
      if (!isTeamMember) {
        return {
          canView: false,
          canEdit: false,
          canDelete: false,
          canManageAccess: false,
          reason: "Not a matter team member",
        };
      }
      return {
        canView: true,
        canEdit: false, // Only uploader/owner can edit
        canDelete: false,
        canManageAccess: false,
        reason: "Public document - team member access",
      };

    case "ROLE_BASED": {
      if (!isTeamMember) {
        return {
          canView: false,
          canEdit: false,
          canDelete: false,
          canManageAccess: false,
          reason: "Not a matter team member",
        };
      }

      const metadata = document.accessMetadata as { allowedRoles?: Role[] } | null;
      const allowedRoles = metadata?.allowedRoles || [];
      
      if (!allowedRoles.includes(userRole)) {
        return {
          canView: false,
          canEdit: false,
          canDelete: false,
          canManageAccess: false,
          reason: `Role ${userRole} not in allowed roles: ${allowedRoles.join(", ")}`,
        };
      }

      return {
        canView: true,
        canEdit: false,
        canDelete: false,
        canManageAccess: false,
        reason: "Role-based access granted",
      };
    }

    case "USER_BASED": {
      // Check if user has explicit grant
      const hasGrant = document.accessGrants && document.accessGrants.length > 0;
      
      if (!hasGrant) {
        return {
          canView: false,
          canEdit: false,
          canDelete: false,
          canManageAccess: false,
          reason: "No explicit access grant",
        };
      }

      return {
        canView: true,
        canEdit: false,
        canDelete: false,
        canManageAccess: false,
        reason: "Explicit user access grant",
      };
    }

    default:
      return {
        canView: false,
        canEdit: false,
        canDelete: false,
        canManageAccess: false,
        reason: "Unknown access scope",
      };
  }
}

/**
 * Filter documents list to only those the user can access
 */
export async function filterAccessibleDocuments(
  documents: Array<{ id: string }>,
  userId: string,
  userRole: Role
): Promise<string[]> {
  const accessibleIds: string[] = [];
  
  for (const doc of documents) {
    const access = await checkDocumentAccess(doc.id, userId, userRole);
    if (access.canView) {
      accessibleIds.push(doc.id);
    }
  }
  
  return accessibleIds;
}
```

### 2.2 Update Document API Routes

Update `app/api/documents/[id]/route.ts`:

```typescript
import { checkDocumentAccess } from "@/lib/documents/access-control";

export const GET = withApiHandler<{ id: string }>(async (req, { params, session }) => {
  const { id } = await params;
  
  // Check access
  const access = await checkDocumentAccess(id, session.user.id, session.user.role);
  
  if (!access.canView) {
    return NextResponse.json(
      { error: "Access denied", reason: access.reason },
      { status: 403 }
    );
  }
  
  // ... rest of handler
}, { requireAuth: true });
```

Update `app/api/documents/[id]/download/route.ts` similarly.

---

## Phase 3: UI Components

### 3.1 Document Access Control Dialog

Create `components/documents/DocumentAccessControlDialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Role } from "@prisma/client";

interface DocumentAccessControlDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  matterId: string;
  currentScope: "PUBLIC" | "ROLE_BASED" | "USER_BASED" | "PRIVATE";
  currentAccessMetadata?: { allowedRoles?: Role[] };
  onSave: (scope: string, metadata: any, userGrants?: string[]) => Promise<void>;
}

export function DocumentAccessControlDialog({
  isOpen,
  onClose,
  documentId,
  matterId,
  currentScope,
  currentAccessMetadata,
  onSave,
}: DocumentAccessControlDialogProps) {
  const [scope, setScope] = useState(currentScope);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(
    currentAccessMetadata?.allowedRoles || []
  );
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<Array<{
    id: string;
    name: string;
    email: string;
    role: Role;
  }>>([]);
  const [loading, setLoading] = useState(false);

  // Load matter team members
  useEffect(() => {
    const loadTeam = async () => {
      const res = await fetch(`/api/matters/${matterId}/team`);
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.team);
      }
    };
    if (isOpen && matterId) {
      loadTeam();
    }
  }, [isOpen, matterId]);

  const handleSave = async () => {
    setLoading(true);
    try {
      let metadata = null;
      let userGrants = undefined;

      if (scope === "ROLE_BASED") {
        metadata = { allowedRoles: selectedRoles };
      } else if (scope === "USER_BASED") {
        userGrants = selectedUsers;
      }

      await onSave(scope, metadata, userGrants);
      onClose();
    } catch (error) {
      console.error("Failed to save access control:", error);
      alert("Failed to save access control settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Document Access Control</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Access Scope Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Who can access this document?
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="scope"
                  value="PUBLIC"
                  checked={scope === "PUBLIC"}
                  onChange={(e) => setScope(e.target.value as any)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium text-slate-900">All Team Members</div>
                  <div className="text-xs text-slate-500">
                    Everyone in the matter team can view this document
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="scope"
                  value="ROLE_BASED"
                  checked={scope === "ROLE_BASED"}
                  onChange={(e) => setScope(e.target.value as any)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium text-slate-900">Specific Roles</div>
                  <div className="text-xs text-slate-500">
                    Only team members with selected roles can view
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="scope"
                  value="USER_BASED"
                  checked={scope === "USER_BASED"}
                  onChange={(e) => setScope(e.target.value as any)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium text-slate-900">Specific People</div>
                  <div className="text-xs text-slate-500">
                    Only selected team members can view
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="scope"
                  value="PRIVATE"
                  checked={scope === "PRIVATE"}
                  onChange={(e) => setScope(e.target.value as any)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium text-slate-900">Private</div>
                  <div className="text-xs text-slate-500">
                    Only you and matter owner can view this document
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Role Selection (for ROLE_BASED) */}
          {scope === "ROLE_BASED" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Roles
              </label>
              <div className="space-y-2">
                {["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"].map((role) => (
                  <label key={role} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role as Role)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRoles([...selectedRoles, role as Role]);
                        } else {
                          setSelectedRoles(selectedRoles.filter((r) => r !== role));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700">{role}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* User Selection (for USER_BASED) */}
          {scope === "USER_BASED" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Team Members
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                {teamMembers.map((member) => (
                  <label key={member.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(member.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers([...selectedUsers, member.id]);
                        } else {
                          setSelectedUsers(selectedUsers.filter((id) => id !== member.id));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">{member.name}</div>
                      <div className="text-xs text-slate-500">{member.email} • {member.role}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 3.2 Update DocumentDetailDrawer

Add access control button:

```typescript
// In DocumentDetailDrawer.tsx
<button
  onClick={() => setShowAccessControl(true)}
  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
>
  <LockIcon className="h-4 w-4" />
  Manage Access
</button>

<DocumentAccessControlDialog
  isOpen={showAccessControl}
  onClose={() => setShowAccessControl(false)}
  documentId={document.id}
  matterId={document.matter?.id}
  currentScope={document.accessScope}
  currentAccessMetadata={document.accessMetadata}
  onSave={handleSaveAccessControl}
/>
```

---

## Phase 4: Matter Team Audit Logging

### 4.1 Update MatterTeamMember Creation

Update `app/api/matters/[id]/team/route.ts`:

```typescript
import { recordAuditLog } from "@/lib/audit";

// In POST handler
const member = await prisma.matterTeamMember.create({
  data: {
    matterId: matterId,
    userId: userToAdd.id,
    role: role,
    addedBy: session.user.id,
  },
});

// Record audit log
await recordAuditLog({
  actorId: session.user.id,
  action: "matter.team.add",
  entityType: "MatterTeamMember",
  entityId: member.id,
  metadata: {
    matterId,
    userId: userToAdd.id,
    role,
    userName: userToAdd.name || userToAdd.email,
  },
});
```

### 4.2 Audit Log for Team Member Removal

```typescript
// In DELETE handler
await recordAuditLog({
  actorId: session.user.id,
  action: "matter.team.remove",
  entityType: "MatterTeamMember",
  entityId: memberId,
  metadata: {
    matterId,
    userId: member.userId,
    role: member.role,
  },
});
```

---

## Migration Script

Create `prisma/migrations/YYYYMMDDHHMMSS_add_document_access_control/migration.sql`:

```sql
-- Add DocumentAccessScope enum
CREATE TYPE "DocumentAccessScope" AS ENUM ('PUBLIC', 'ROLE_BASED', 'USER_BASED', 'PRIVATE');

-- Add columns to Document table
ALTER TABLE "Document" ADD COLUMN "accessScope" "DocumentAccessScope" NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "Document" ADD COLUMN "accessMetadata" JSONB;

-- Create DocumentAccess table
CREATE TABLE "DocumentAccess" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAccess_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "Document_accessScope_idx" ON "Document"("accessScope");
CREATE INDEX "DocumentAccess_documentId_idx" ON "DocumentAccess"("documentId");
CREATE INDEX "DocumentAccess_userId_idx" ON "DocumentAccess"("userId");
CREATE UNIQUE INDEX "DocumentAccess_documentId_userId_key" ON "DocumentAccess"("documentId", "userId");

-- Add foreign keys
ALTER TABLE "DocumentAccess" ADD CONSTRAINT "DocumentAccess_documentId_fkey" 
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAccess" ADD CONSTRAINT "DocumentAccess_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAccess" ADD CONSTRAINT "DocumentAccess_grantedBy_fkey" 
    FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

---

## Implementation Checklist

### Database
- [ ] Create migration for schema changes
- [ ] Run `npx prisma migrate dev`
- [ ] Update Prisma schema
- [ ] Regenerate Prisma client

### Backend
- [ ] Create `lib/documents/access-control.ts`
- [ ] Update `app/api/documents/[id]/route.ts`
- [ ] Update `app/api/documents/[id]/download/route.ts`
- [ ] Create `app/api/documents/[id]/access/route.ts` (manage access)
- [ ] Add audit logging to matter team operations
- [ ] Write unit tests for access control logic

### Frontend
- [ ] Create `DocumentAccessControlDialog.tsx`
- [ ] Update `DocumentDetailDrawer.tsx` with access button
- [ ] Add access scope indicator in document lists
- [ ] Update document upload dialog to set initial access scope
- [ ] Add access denied error handling

### Testing
- [ ] Test PUBLIC access (all team members)
- [ ] Test ROLE_BASED access (specific roles)
- [ ] Test USER_BASED access (specific users)
- [ ] Test PRIVATE access (uploader + owner only)
- [ ] Test admin override
- [ ] Test access denied scenarios
- [ ] Verify audit logs for team operations

---

## Future Enhancements

1. **Time-Limited Access**: Add `expiresAt` to `DocumentAccess`
2. **Access Request Workflow**: Allow users to request access
3. **Bulk Access Management**: Change access for multiple documents at once
4. **Access History**: Track who accessed documents when
5. **Share Links**: Generate temporary share links with expiration
6. **Document Watermarking**: Add user info to PDF watermarks
7. **Download Tracking**: Log every document download

---

**Status**: Ready for implementation  
**Priority**: High  
**Estimated Effort**: 2-3 days
